# Isolated Claude Code / BMad execution

This guide is for the operator and the administrator who prepare a future, authorized BMad run.

## Why whole-process isolation

According to the official Claude Code documentation:
- the built-in sandbox covers **shell commands only**. Claude's file tools, MCP servers and hooks run outside it, and `Read` deny rules do not stop arbitrary subprocesses;
- the network proxy filters by **hostname** and does not inspect TLS by default.

So the boundary must contain the **whole** Claude Code process: a container, a VM or a whole-process sandbox.

## What this host supports (assessed 2026-11-01)

`bmad isolation doctor` probes the real host.

**Host:** Windows 11 Home (hypervisor present; Windows Sandbox and the Hyper-V manager are not available on Home).

**WSL2 distribution:** Ubuntu 24.04.4, kernel 6.6.87.2.

**Available inside WSL2:**
- util-linux `unshare` and `setpriv`;
- unprivileged user, mount, network and PID namespaces.

**Not available:**
- Docker or Podman, on the host or in WSL;
- bubblewrap, socat or firejail;
- Node.js or Claude Code inside WSL;
- passwordless sudo (installing packages is an administrator action).

## The boundary: `forward/integrations/bmad/isolation/sandbox.sh`

It runs a command and **every process it starts** inside new user, mount, network, PID, IPC and UTS namespaces, then `pivot_root`s into a minimal root:

| Path | Access |
|---|---|
| `/usr` | read-only (`/bin`, `/lib` and `/sbin` link into it) |
| `/work/src` | read-only: the authorized source files only |
| `/work/inputs` | read-only: the mapped inputs only |
| `/work/out` | the **only** writable host directory |
| `/tmp` | private tmpfs |
| `/proc` | the new PID namespace only |
| `/dev` | null, zero, random, urandom |
| `/etc` | minimal passwd, group and hosts |

**Absent or removed:**
- **The old root:** detached, so the Windows drives (`/mnt/c`, `/mnt/d`), home directories, `/run`, the WSL interop socket and any Docker socket are unreachable.
- **Network:** the namespace has no configured interface, so there is no route and no DNS.
- **Privileges:** all capabilities are dropped and `no_new_privs` is set, so the process cannot mount, pivot, chroot or regain privileges.
- **Environment:** replaced with `env -i`.

**Workspace.** It is built from an explicit file list by `buildWorkspace`:
- files are copied, never linked;
- symlinks are refused;
- `..` and absolute destinations are refused;
- every file is hashed.

`validateWorkspace` refuses, before any launch:
- extra or writable source mounts;
- unlisted or changed files;
- symlinks;
- any network mode other than `none`.

Signing keys, the trust store, credentials, SSH keys and the user's home are never placed in it.

## Commands

| Command | What it does |
|---|---|
| `bmad isolation doctor` | host assessment and which boundaries are enforceable |
| `bmad isolation manifest --scope programs:<P>` | the minimal workspace plan: files, hashes, mounts; nothing is built |
| `bmad isolation test [--record]` | the offline adversarial suite on a **synthetic** COBOL project (never REVFORGE source) |
| `bmad executor preflight --workflow W --scope S` | the sealed preflight, never launches |

`bmad isolation test` checks:
- authorized reads;
- host files unreadable;
- source write-protected;
- only the output directory is writable;
- credentials absent;
- network and arbitrary destinations unreachable;
- symlink and traversal escapes;
- helper processes unable to mount, unshare, chroot or run Windows binaries;
- no host-control socket;
- the workspace builder refusals.

The recorded report pins the launcher's sha256 and expires after 7 days.

## Statuses (never interchangeable)

| Status | Meaning |
|---|---|
| `ISOLATION_AVAILABLE` | the primitives exist |
| `ISOLATION_CONFIGURED` | the launcher is present and pinned |
| `ISOLATION_TESTED` | the offline suite passed on this host |
| `EXECUTION_AUTHORIZED` | every preflight check passed |
| `EXECUTION_BLOCKED` | a mandatory condition is missing |
| `EXECUTION_UNSUPPORTED` | the runner cannot run inside the boundary here |

A passing isolation test is **not** permission to send COBOL to a model.

## What still blocks a LIVE run

1. **Claude Code is not inside the boundary.** Node.js and Claude Code are not installed in WSL2. An administrator must install a pinned version under a path the sandbox exposes read-only.
2. **Provider egress must be verified on the host.** By default the boundary has no network at all. The provider-egress component exists (`egress-proxy.mjs`, a CONNECT-only allowlist proxy for `api.anthropic.com:443` outside the namespaces, and `sandbox.sh --net egress`), but it counts only after `bmad executor egress-test` has executed and passed on this host for the current proxy and sandbox scripts. See [BMAD-INTEGRATION-OPERATIONS.md §9](BMAD-INTEGRATION-OPERATIONS.md#9-provider-egress-component).

   Even then, **TLS to the provider is end-to-end**:
   - request content cannot be inspected;
   - only the minimal workspace limits what can be disclosed;
   - a hostname allowlist does not prove the exact payload is authorized.
3. **Authorizations.** A `data_owner`-signed Anthropic / `claude-code-cli` disclosure authorization, G1 PASS for the exact scope, REQUIREMENTS_APPROVED, and `live_execution.requested: true`.

**Shared kernel.** The namespaces share the WSL2 kernel with the distribution. It is a strong process boundary, not a VM boundary; for kernel-level separation, use a VM.
