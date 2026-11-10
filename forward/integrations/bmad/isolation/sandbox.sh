#!/bin/bash
# REVFORGE whole-process sandbox for WSL2 / Linux (STEP 9).
#
# usage: sandbox.sh SRC_DIR INPUTS_DIR OUT_DIR [--net none | --net egress SOCKET_PATH]
#                   [--env-file FILE] -- COMMAND [ARGS...]
#
# Runs COMMAND and every process it starts inside new user, mount, network,
# PID, IPC and UTS namespaces (util-linux unshare, unprivileged). The process
# tree sees a fresh root that contains only:
#   /usr (read-only; /bin /lib /lib64 /sbin are symlinks into it)
#   /work/src     SRC_DIR, read-only
#   /work/inputs  INPUTS_DIR, read-only
#   /work/out     OUT_DIR, the only writable host directory
#   /tmp          private tmpfs
#   /proc         of the new PID namespace only
#   /dev/null, /dev/zero, /dev/urandom, /dev/random
#   /etc          minimal passwd/group/hosts written here
# The old root (Windows drives under /mnt, the user's home, /run, sockets) is
# detached with pivot_root + lazy unmount, so it is unreachable. Before the
# command starts, all capabilities are dropped (bounding, inheritable,
# ambient) and no_new_privs is set, so it cannot mount, pivot, chroot or
# regain privileges. The environment is replaced.
#
# Network modes:
#   none (default)  the network namespace has only an unconfigured loopback:
#                   no route anywhere. The environment is replaced (env -i).
#   egress SOCKET   provider egress through the separately verified allowlist
#                   proxy (egress-proxy.mjs), which runs OUTSIDE these
#                   namespaces and listens on the Unix socket SOCKET. Only that
#                   socket node is bind-mounted, at /work/egress.sock (nothing
#                   else of its directory). Inside the new network namespace
#                   only loopback is brought up and socat bridges
#                   127.0.0.1:3128 to the socket; HTTPS_PROXY / HTTP_PROXY point
#                   there. There is no DNS, no other interface and no route: a
#                   connection that does not go through the proxy has nowhere
#                   to go, and the proxy itself allows only allowlisted CONNECT
#                   destinations. Missing ip or socat fails closed.
#
# --env-file FILE (egress mode only): read in stage 1, outside the namespaces.
#   KEY=VALUE lines; only allowlisted names (ANTHROPIC_API_KEY) are passed to
#   the command's environment, never on a command line. The file must be a
#   regular file owned by the caller and not group/world accessible. Its value
#   is never echoed, logged or written anywhere; the file itself is not visible
#   inside the sandbox.
set -euo pipefail

stage="${REVFORGE_SBX_STAGE:-1}"
CRED_NAMES="ANTHROPIC_API_KEY"

if [ "$stage" = "1" ]; then
  usage() { echo "usage: sandbox.sh SRC INPUTS OUT [--net none | --net egress SOCKET] [--env-file FILE] -- CMD..." >&2; exit 64; }
  [ $# -ge 5 ] || usage
  SRC=$(realpath -e "$1"); INP=$(realpath -e "$2"); OUT=$(realpath -e "$3"); shift 3
  NET=none; SOCK=""; ENVF=""; seen_net=0; seen_env=0
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do
    case "$1" in
      --net)
        [ "$seen_net" = 0 ] || { echo "sandbox: --net given twice" >&2; exit 65; }
        seen_net=1
        case "${2:-}" in
          none) NET=none; shift 2 ;;
          egress) [ -n "${3:-}" ] && [ "${3:-}" != "--" ] || { echo "sandbox: --net egress needs SOCKET_PATH" >&2; exit 65; }
                  NET=egress; SOCK="$3"; shift 3 ;;
          *) echo "sandbox: --net must be none or egress SOCKET_PATH" >&2; exit 65 ;;
        esac ;;
      --env-file)
        [ "$seen_env" = 0 ] || { echo "sandbox: --env-file given twice" >&2; exit 65; }
        seen_env=1
        [ -n "${2:-}" ] && [ "${2:-}" != "--" ] || { echo "sandbox: --env-file needs FILE" >&2; exit 65; }
        ENVF="$2"; shift 2 ;;
      *) echo "sandbox: unknown option $1" >&2; exit 64 ;;
    esac
  done
  [ "${1:-}" = "--" ] || { echo "sandbox: missing -- before the command" >&2; exit 64; }
  shift
  [ $# -ge 1 ] || usage
  for d in "$SRC" "$INP" "$OUT"; do
    [ -d "$d" ] && [ ! -L "$d" ] || { echo "sandbox: $d is not a real directory" >&2; exit 66; }
  done
  if [ "$NET" = "egress" ]; then
    case "$SOCK" in /*) ;; *) echo "sandbox: the egress socket path must be absolute" >&2; exit 67 ;; esac
    [ -S "$SOCK" ] && [ ! -L "$SOCK" ] || { echo "sandbox: $SOCK is not an existing Unix socket" >&2; exit 67; }
    SOCK=$(realpath -e -- "$SOCK")
    [ "$(stat -c %u -- "$SOCK")" = "$(id -u)" ] || { echo "sandbox: the egress socket is not owned by the caller" >&2; exit 67; }
    [ -x /usr/sbin/ip ] || { echo "sandbox: /usr/sbin/ip (iproute2) is missing; egress mode fails closed" >&2; exit 67; }
    [ -x /usr/bin/socat ] || { echo "sandbox: /usr/bin/socat is missing; egress mode fails closed" >&2; exit 67; }
  fi
  if [ -n "$ENVF" ]; then
    [ "$NET" = "egress" ] || { echo "sandbox: --env-file is only accepted with --net egress" >&2; exit 68; }
    [ -f "$ENVF" ] && [ ! -L "$ENVF" ] || { echo "sandbox: the env file is not a regular file" >&2; exit 68; }
    [ "$(stat -c %u -- "$ENVF")" = "$(id -u)" ] || { echo "sandbox: the env file is not owned by the caller" >&2; exit 68; }
    mode=$(stat -c %a -- "$ENVF")
    (( (8#$mode & 8#077) == 0 )) || { echo "sandbox: the env file is accessible by group or others (mode $mode); use chmod 600" >&2; exit 68; }
    found=0; ignored=0
    while IFS= read -r line || [ -n "$line" ]; do
      line=${line%$'\r'}
      case "$line" in ''|'#'*) continue ;; esac
      name=${line%%=*}
      [ "$name" != "$line" ] || { echo "sandbox: malformed line in the env file (no '=')" >&2; exit 68; }
      val=${line#*=}
      case "$val" in \"*\") val=${val#\"}; val=${val%\"} ;; \'*\') val=${val#\'}; val=${val%\'} ;; esac
      allowed=0
      for n in $CRED_NAMES; do [ "$name" = "$n" ] && allowed=1; done
      if [ "$allowed" = 1 ] && [ -n "$val" ]; then
        export "REVFORGE_SBX_CRED_$name=$val"; found=$((found + 1))
      else
        ignored=$((ignored + 1))
      fi
    done < "$ENVF"
    unset line val
    [ "$found" -ge 1 ] || { echo "sandbox: the env file has no allowlisted entry ($CRED_NAMES)" >&2; exit 68; }
    [ "$ignored" = 0 ] || echo "sandbox: ignored $ignored non-allowlisted env file entr(y/ies)" >&2
  fi
  export REVFORGE_SBX_STAGE=2 REVFORGE_SBX_SRC="$SRC" REVFORGE_SBX_INP="$INP" REVFORGE_SBX_OUT="$OUT" REVFORGE_SBX_NET="$NET" REVFORGE_SBX_SOCK="$SOCK"
  exec unshare --user --map-root-user --mount --net --pid --ipc --uts --fork --kill-child -- /bin/bash "$(realpath -e "$0")" "$@"
fi

# ---- stage 2: inside the new namespaces ----
SRC="$REVFORGE_SBX_SRC"; INP="$REVFORGE_SBX_INP"; OUT="$REVFORGE_SBX_OUT"; NET="${REVFORGE_SBX_NET:-none}"; SOCK="${REVFORGE_SBX_SOCK:-}"
declare -A CRED=()
for n in $CRED_NAMES; do
  v="REVFORGE_SBX_CRED_$n"
  if [ -n "${!v:-}" ]; then CRED[$n]="${!v}"; fi
  unset "$v"
done
unset v REVFORGE_SBX_STAGE REVFORGE_SBX_SRC REVFORGE_SBX_INP REVFORGE_SBX_OUT REVFORGE_SBX_NET REVFORGE_SBX_SOCK
case "$NET" in none|egress) ;; *) echo "sandbox: invalid network mode" >&2; exit 65 ;; esac
mount --make-rprivate /
NEW=$(mktemp -d /tmp/revforge-sbx.XXXXXX)
mount -t tmpfs -o size=64m,mode=755 tmpfs "$NEW"
mkdir -p "$NEW"/usr "$NEW"/work/src "$NEW"/work/inputs "$NEW"/work/out "$NEW"/tmp "$NEW"/proc "$NEW"/dev "$NEW"/etc "$NEW"/oldroot
mount --rbind /usr "$NEW/usr"
mount -o remount,bind,ro "$NEW/usr"
for l in bin lib lib64 sbin; do [ -e "/usr/$l" ] && ln -s "usr/$l" "$NEW/$l"; done
for d in null zero urandom random; do
  touch "$NEW/dev/$d"; mount --bind "/dev/$d" "$NEW/dev/$d"
done
printf 'root:x:0:0:sandbox:/tmp:/bin/sh\nnobody:x:65534:65534::/nonexistent:/usr/sbin/nologin\n' > "$NEW/etc/passwd"
printf 'root:x:0:\nnogroup:x:65534:\n' > "$NEW/etc/group"
printf '127.0.0.1 localhost\n' > "$NEW/etc/hosts"
mount --bind "$SRC" "$NEW/work/src";    mount -o remount,bind,ro "$NEW/work/src"
mount --bind "$INP" "$NEW/work/inputs"; mount -o remount,bind,ro "$NEW/work/inputs"
mount --bind "$OUT" "$NEW/work/out"
if [ "$NET" = "egress" ]; then
  # Only the socket node itself: a bind mount of one file, never its directory.
  [ -S "$SOCK" ] || { echo "sandbox: the egress socket disappeared" >&2; exit 67; }
  touch "$NEW/work/egress.sock"; mount --bind "$SOCK" "$NEW/work/egress.sock"
fi
mount -t tmpfs -o size=64m tmpfs "$NEW/tmp"
mount -t proc -o nosuid,nodev,noexec proc "$NEW/proc"
cd "$NEW"
pivot_root . oldroot
cd /
umount -l /oldroot
rmdir /oldroot
mount -o remount,bind,ro /
cd /work
DROP=(/usr/bin/setpriv --no-new-privs --inh-caps=-all --ambient-caps=-all --bounding-set=-all --)
if [ "$NET" = "none" ]; then
  exec "${DROP[@]}" /usr/bin/env -i PATH=/usr/bin:/bin HOME=/tmp LANG=C.UTF-8 TMPDIR=/tmp "$@"
fi

# ---- egress mode: loopback only, socat bridge to the proxy socket ----
[ -x /usr/sbin/ip ] || { echo "sandbox: /usr/sbin/ip missing inside the sandbox; egress fails closed" >&2; exit 67; }
[ -x /usr/bin/socat ] || { echo "sandbox: /usr/bin/socat missing inside the sandbox; egress fails closed" >&2; exit 67; }
/usr/sbin/ip link set lo up
devs=""; i=0
while IFS= read -r l; do
  i=$((i + 1)); [ "$i" -gt 2 ] || continue
  n=${l%%:*}; devs="$devs${n// /} "
done < /proc/net/dev
unset i l n
[ "$devs" = "lo " ] || { echo "sandbox: unexpected network interfaces ($devs); egress fails closed" >&2; exit 67; }
"${DROP[@]}" /usr/bin/env -i PATH=/usr/bin:/bin /usr/bin/socat TCP-LISTEN:3128,bind=127.0.0.1,fork,reuseaddr UNIX-CONNECT:/work/egress.sock </dev/null >/dev/null 2>&1 &
BRIDGE=$!
up=0
for _ in $(seq 1 50); do
  if grep -q ' 0100007F:0C38 00000000:0000 0A ' /proc/net/tcp 2>/dev/null; then up=1; break; fi
  kill -0 "$BRIDGE" 2>/dev/null || break
  sleep 0.1
done
[ "$up" = 1 ] || { kill "$BRIDGE" 2>/dev/null || true; echo "sandbox: the egress bridge did not start; egress fails closed" >&2; exit 67; }
# Replace the environment: drop every inherited variable, then set only the allowlisted ones.
# The credential is passed through the environment only, never on a command line.
for v in $(compgen -e); do unset "$v" 2>/dev/null || true; done
export PATH=/usr/bin:/bin HOME=/tmp LANG=C.UTF-8 TMPDIR=/tmp
export HTTPS_PROXY=http://127.0.0.1:3128 HTTP_PROXY=http://127.0.0.1:3128 https_proxy=http://127.0.0.1:3128 http_proxy=http://127.0.0.1:3128
for n in "${!CRED[@]}"; do export "$n=${CRED[$n]}"; done
unset CRED n
exec "${DROP[@]}" "$@"
