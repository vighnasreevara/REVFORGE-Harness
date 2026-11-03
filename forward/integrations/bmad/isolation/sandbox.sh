#!/bin/bash
# REVFORGE whole-process sandbox for WSL2 / Linux (STEP 9).
#
# usage: sandbox.sh SRC_DIR INPUTS_DIR OUT_DIR [--net none] -- COMMAND [ARGS...]
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
# detached with pivot_root + lazy unmount, so it is unreachable. The network
# namespace has only an unconfigured loopback: no route anywhere. Before the
# command starts, all capabilities are dropped (bounding, inheritable,
# ambient) and no_new_privs is set, so it cannot mount, pivot, chroot or
# regain privileges. The environment is replaced (env -i).
#
# Only network mode "none" exists. A future provider egress path must be a
# separately verified component; this script never opens the network.
set -euo pipefail

stage="${REVFORGE_SBX_STAGE:-1}"

if [ "$stage" = "1" ]; then
  [ $# -ge 5 ] || { echo "usage: sandbox.sh SRC INPUTS OUT [--net none] -- CMD..." >&2; exit 64; }
  SRC=$(realpath -e "$1"); INP=$(realpath -e "$2"); OUT=$(realpath -e "$3"); shift 3
  if [ "${1:-}" = "--net" ]; then
    [ "${2:-}" = "none" ] || { echo "sandbox: only --net none is supported" >&2; exit 65; }
    shift 2
  fi
  [ "${1:-}" = "--" ] || { echo "sandbox: missing -- before the command" >&2; exit 64; }
  shift
  for d in "$SRC" "$INP" "$OUT"; do
    [ -d "$d" ] && [ ! -L "$d" ] || { echo "sandbox: $d is not a real directory" >&2; exit 66; }
  done
  export REVFORGE_SBX_STAGE=2 REVFORGE_SBX_SRC="$SRC" REVFORGE_SBX_INP="$INP" REVFORGE_SBX_OUT="$OUT"
  exec unshare --user --map-root-user --mount --net --pid --ipc --uts --fork --kill-child -- /bin/bash "$(realpath -e "$0")" "$@"
fi

# ---- stage 2: inside the new namespaces ----
SRC="$REVFORGE_SBX_SRC"; INP="$REVFORGE_SBX_INP"; OUT="$REVFORGE_SBX_OUT"
unset REVFORGE_SBX_STAGE REVFORGE_SBX_SRC REVFORGE_SBX_INP REVFORGE_SBX_OUT
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
mount -t tmpfs -o size=64m tmpfs "$NEW/tmp"
mount -t proc -o nosuid,nodev,noexec proc "$NEW/proc"
cd "$NEW"
pivot_root . oldroot
cd /
umount -l /oldroot
rmdir /oldroot
mount -o remount,bind,ro /
cd /work
exec /usr/bin/setpriv --no-new-privs --inh-caps=-all --ambient-caps=-all --bounding-set=-all -- \
  /usr/bin/env -i PATH=/usr/bin:/bin HOME=/tmp LANG=C.UTF-8 TMPDIR=/tmp "$@"
