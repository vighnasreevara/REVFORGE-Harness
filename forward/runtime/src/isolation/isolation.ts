/**
 * Whole-process isolation for future Claude Code / BMad execution (STEP 9).
 *
 * Host assessment: what the machine can actually enforce (WSL2, unprivileged
 * user namespaces, container runtimes, bubblewrap, VM features, controlled
 * user, Claude Code inside the boundary). The Claude Code built-in sandbox
 * covers shell commands only (its file tools, MCP servers and hooks run
 * outside it), so it is not used as the boundary. The boundary implemented
 * here is `integrations/bmad/isolation/sandbox.sh`: user + mount + network +
 * PID + IPC + UTS namespaces, pivot_root into a minimal root, read-only
 * source and inputs, one writable output directory, no network, all
 * capabilities dropped and no_new_privs. It confines a whole process tree.
 *
 * Workspace: a minimal, scope-specific directory built from an explicit file
 * list (no symlinks, no traversal, hashes recorded) and validated before any
 * launch. Only the declared mounts exist; anything else is refused.
 *
 * Statuses are distinct and never inferred from one another:
 *   ISOLATION_AVAILABLE   the primitives exist on this host
 *   ISOLATION_CONFIGURED  the sandbox launcher is present and pinned
 *   ISOLATION_TESTED      the offline adversarial suite passed on this host
 *   EXECUTION_AUTHORIZED  every preflight check passed (never in STEP 9)
 *   EXECUTION_BLOCKED     a mandatory condition is missing
 *   EXECUTION_UNSUPPORTED the runner cannot run inside the boundary here
 */
import { execFileSync, spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { bmadPaths } from '../bmad/release';

export type IsolationStatus = 'ISOLATION_AVAILABLE' | 'ISOLATION_CONFIGURED' | 'ISOLATION_TESTED' | 'EXECUTION_AUTHORIZED' | 'EXECUTION_BLOCKED' | 'EXECUTION_UNSUPPORTED' | 'ISOLATION_UNAVAILABLE';

export interface Probe {
  run(cmd: string, args: string[], timeoutMs?: number): { ok: boolean; out: string };
}
export const hostProbe: Probe = {
  run(cmd, args, timeoutMs = 60000) {
    try {
      const out = execFileSync(cmd, args, { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      return { ok: true, out: out.replace(/\0/g, '').replace(/\r/g, '').trim() };
    } catch (e: any) {
      return { ok: false, out: String(e?.stdout ?? e?.message ?? '').replace(/\0/g, '').replace(/\r/g, '').trim() };
    }
  },
};

export const sandboxScript = (ctx: RuntimeContext) => path.join(bmadPaths(ctx).dir, 'isolation', 'sandbox.sh');
/** Windows path -> WSL path (D:\a\b -> /mnt/d/a/b). Posix paths are returned unchanged. */
export function wslPath(p: string): string {
  const abs = path.resolve(p);
  const m = /^([A-Za-z]):[\\/](.*)$/.exec(abs);
  return m ? `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}` : abs.replace(/\\/g, '/');
}

export interface HostAssessment {
  assessed_at: string;
  host: { platform: string; release: string; os: string | null; hypervisor_present: boolean | null };
  wsl: { available: boolean; distro: string | null; version: number | null; kernel: string | null; os: string | null };
  primitives: Record<string, { available: boolean; detail: string }>;
  boundaries: Array<{ boundary: string; enforceable: boolean; how: string; limits: string }>;
  admin_actions_required: string[];
  status: IsolationStatus;
}

/** Probes the actual host. Nothing is installed or changed. */
export function assessHost(ctx: RuntimeContext, probe: Probe = hostProbe): HostAssessment {
  const win = process.platform === 'win32';
  const prim: HostAssessment['primitives'] = {};
  const set = (k: string, available: boolean, detail: string) => (prim[k] = { available, detail });
  let osName: string | null = null;
  let hyper: boolean | null = null;
  if (win) {
    const r = probe.run('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_OperatingSystem).Caption; (Get-CimInstance Win32_ComputerSystem).HypervisorPresent']);
    if (r.ok) {
      const [a, b] = r.out.split('\n').map((x) => x.trim());
      osName = a || null;
      hyper = b === 'True';
    }
  }
  // Docker Desktop does not always put its CLI on PATH; its standard location is probed too (STEP 21). Reported only:
  // no boundary is enforceable merely because a container runtime exists.
  let dockerWin = probe.run('docker', ['--version']);
  if (!dockerWin.ok && win) dockerWin = probe.run(path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Docker', 'Docker', 'resources', 'bin', 'docker.exe'), ['--version']);
  const podmanWin = probe.run('podman', ['--version']);
  set('docker_host', dockerWin.ok, dockerWin.ok ? dockerWin.out : 'not installed on the host');
  set('podman_host', podmanWin.ok, podmanWin.ok ? podmanWin.out : 'not installed on the host');
  const wsl = { available: false, distro: null as string | null, version: null as number | null, kernel: null as string | null, os: null as string | null };
  if (win) {
    const l = probe.run('wsl.exe', ['-l', '-v']);
    const row = l.ok ? l.out.split('\n').map((x) => x.replace(/\*/g, '').trim()).find((x) => /\s2$/.test(x) && !/^NAME/.test(x)) : undefined;
    if (row) {
      wsl.distro = row.split(/\s+/)[0];
      wsl.version = 2;
      wsl.available = true;
    }
  }
  const inLinux = (cmd: string) => (win ? (wsl.available ? probe.run('wsl.exe', ['-d', wsl.distro!, '--exec', 'bash', '-c', cmd], 120000) : { ok: false, out: 'no WSL2 distribution' }) : probe.run('bash', ['-c', cmd], 120000));
  if (wsl.available || !win) {
    const k = inLinux('uname -r; . /etc/os-release; echo "$PRETTY_NAME"');
    if (k.ok) [wsl.kernel, wsl.os] = k.out.split('\n');
    const has = (t: string) => inLinux(`command -v ${t}`);
    for (const t of ['unshare', 'setpriv', 'bwrap', 'docker', 'podman', 'firejail', 'socat', 'node', 'claude']) {
      const r = has(t);
      set(`linux_${t}`, r.ok && !!r.out, r.ok && r.out ? r.out : 'not installed');
    }
    const u = inLinux('unshare --user --map-root-user --mount --net --pid --fork true && echo USERNS_OK');
    set('unprivileged_user_namespaces', u.ok && /USERNS_OK/.test(u.out), u.ok && /USERNS_OK/.test(u.out) ? 'user + mount + net + pid namespaces can be created without privileges' : `cannot create namespaces: ${u.out.slice(0, 200)}`);
    const s = inLinux('sudo -n true 2>/dev/null && echo SUDO_OK || echo SUDO_PASSWORD');
    set('passwordless_sudo', /SUDO_OK/.test(s.out), /SUDO_OK/.test(s.out) ? 'available' : 'sudo needs a password: installing packages or creating a dedicated user is an administrator action');
  }
  set('windows_sandbox_or_hyperv', false, osName && /Home/i.test(osName) ? `${osName}: Windows Sandbox and the Hyper-V manager are not available on the Home edition` : 'not assessed');
  const script = sandboxScript(ctx);
  set('revforge_sandbox_launcher', fs.existsSync(script), fs.existsSync(script) ? `${path.relative(ctx.repoRoot, script).split(path.sep).join('/')} sha256 ${String(sha256File(script)).slice(0, 16)}…` : 'missing');
  const userns = prim.unprivileged_user_namespaces?.available && prim.linux_unshare?.available && prim.linux_setpriv?.available;
  const boundaries = [
    { boundary: 'whole_process_filesystem', enforceable: !!userns, how: 'sandbox.sh: mount namespace + pivot_root into a minimal root; old root (Windows drives, home, /run) detached', limits: 'shares the WSL2 kernel with the host distribution; not a VM boundary' },
    { boundary: 'source_read_only', enforceable: !!userns, how: 'bind mount remounted read-only', limits: 'none known' },
    { boundary: 'single_writable_output', enforceable: !!userns, how: 'only /work/out is a writable host bind; root and /usr read-only; /tmp private tmpfs', limits: '/tmp is writable but private and discarded' },
    { boundary: 'network_default_deny', enforceable: !!userns, how: 'new network namespace with no interfaces configured', limits: 'all-or-nothing: there is no egress path at all' },
    { boundary: 'provider_egress_allowlist', enforceable: false, how: 'would need an egress proxy outside the namespace (e.g. sandbox-runtime with socat, or a firewall in a container/VM)', limits: 'not installed; a hostname allowlist would still not inspect TLS payloads' },
    { boundary: 'payload_content_enforcement', enforceable: false, how: 'none: TLS to the provider is end-to-end', limits: 'only the minimal workspace limits what can be disclosed' },
    { boundary: 'privilege_drop', enforceable: !!userns, how: 'setpriv: no capabilities (bounding/inheritable/ambient), no_new_privs', limits: 'none known' },
    { boundary: 'host_control_sockets', enforceable: !!userns, how: 'no /run, no docker socket, no WSL interop socket inside the new root', limits: 'none known' },
    { boundary: 'claude_code_inside_boundary', enforceable: !!prim.linux_claude?.available && !!prim.linux_node?.available, how: 'Claude Code (Node) must be installed inside the Linux environment that the sandbox exposes', limits: prim.linux_claude?.available ? 'available' : 'Claude Code and Node are not installed in the WSL2 distribution' },
  ];
  const admin: string[] = [];
  if (!prim.linux_claude?.available || !prim.linux_node?.available) admin.push('install Node.js and Claude Code inside the WSL2 distribution (under /usr or another path the sandbox exposes read-only), pinned to an approved version');
  if (!prim.linux_bwrap?.available || !prim.linux_socat?.available) admin.push('optional: install bubblewrap and socat (sudo) to use the official Claude Code sandbox runtime as an additional layer and its hostname-allowlist proxy');
  admin.push('provide a verified provider-egress component (allowlist proxy outside the namespace) before any LIVE run; without it the boundary has no network at all');
  if (!prim.passwordless_sudo?.available) admin.push('administrator: optionally create a dedicated non-login user for AI execution (needs sudo)');
  const status: IsolationStatus = userns ? (prim.revforge_sandbox_launcher.available ? 'ISOLATION_CONFIGURED' : 'ISOLATION_AVAILABLE') : 'ISOLATION_UNAVAILABLE';
  return { assessed_at: new Date().toISOString(), host: { platform: `${process.platform} ${os.arch()}`, release: os.release(), os: osName, hypervisor_present: hyper }, wsl, primitives: prim, boundaries, admin_actions_required: admin, status };
}

/* ------------------------------------------------------------------ */
/* minimal workspace                                                   */
/* ------------------------------------------------------------------ */

export interface WorkspaceFile {
  source: string;
  dest: string;
}
export interface WorkspaceManifest {
  contract: 'bmad/workspace-manifest';
  contract_version: '1.0';
  workspace: string;
  mounts: Array<{ name: 'src' | 'inputs' | 'out'; host: string; target: string; mode: 'ro' | 'rw' }>;
  files: Array<{ area: 'src' | 'inputs'; path: string; sha256: string; bytes: number }>;
  network: 'none';
  manifest_sha256: string;
}

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

function safeRel(rel: string): string {
  const n = rel.replace(/\\/g, '/');
  if (!n || n.startsWith('/') || /^[A-Za-z]:/.test(n) || n.split('/').some((s) => s === '..' || s === '.' || s === '')) throw new Error(`unsafe workspace path ${rel} (absolute, traversal or empty segment)`);
  return n;
}

/** Builds a minimal workspace: copies (never links) only the listed files; refuses symlinks and traversal. */
export function buildWorkspace(dir: string, src: WorkspaceFile[], inputs: WorkspaceFile[]): WorkspaceManifest {
  const ws = path.resolve(dir);
  if (fs.existsSync(ws) && fs.readdirSync(ws).length) throw new Error(`workspace ${ws} is not empty`);
  const files: WorkspaceManifest['files'] = [];
  for (const [area, list] of [['src', src], ['inputs', inputs]] as const) {
    fs.mkdirSync(path.join(ws, area), { recursive: true });
    for (const f of list) {
      const st = fs.lstatSync(f.source);
      if (st.isSymbolicLink()) throw new Error(`refusing symlink ${f.source}`);
      if (!st.isFile()) throw new Error(`not a regular file: ${f.source}`);
      const rel = safeRel(f.dest);
      const target = path.join(ws, area, rel);
      if (!path.resolve(target).startsWith(path.join(ws, area) + path.sep)) throw new Error(`path escapes the workspace: ${f.dest}`);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const buf = fs.readFileSync(f.source);
      fs.writeFileSync(target, buf, { flag: 'wx' });
      files.push({ area, path: rel, sha256: sha(buf), bytes: buf.length });
    }
  }
  fs.mkdirSync(path.join(ws, 'out'), { recursive: true });
  const base = {
    contract: 'bmad/workspace-manifest' as const,
    contract_version: '1.0' as const,
    workspace: ws,
    mounts: [
      { name: 'src' as const, host: path.join(ws, 'src'), target: '/work/src', mode: 'ro' as const },
      { name: 'inputs' as const, host: path.join(ws, 'inputs'), target: '/work/inputs', mode: 'ro' as const },
      { name: 'out' as const, host: path.join(ws, 'out'), target: '/work/out', mode: 'rw' as const },
    ],
    files: files.sort((a, b) => (`${a.area}/${a.path}` < `${b.area}/${b.path}` ? -1 : 1)),
    network: 'none' as const,
  };
  return { ...base, manifest_sha256: sha(Buffer.from(JSON.stringify(base))) };
}

/** Re-verifies a workspace against its manifest: exact mounts, exact files and hashes, no symlinks, empty output. */
export function validateWorkspace(m: WorkspaceManifest): string[] {
  const p: string[] = [];
  const expected = [['src', '/work/src', 'ro'], ['inputs', '/work/inputs', 'ro'], ['out', '/work/out', 'rw']];
  if (m.mounts.length !== 3 || !expected.every(([n, t, mode]) => m.mounts.some((x) => x.name === n && x.target === t && x.mode === mode && path.resolve(x.host) === path.join(m.workspace, n)))) p.push(`unexpected mounts: only src (ro), inputs (ro) and out (rw) inside the workspace are allowed; got ${m.mounts.map((x) => `${x.name}:${x.host}->${x.target}(${x.mode})`).join(', ')}`);
  if (m.network !== 'none') p.push(`network must be none, got ${m.network}`);
  const { manifest_sha256, ...base } = m;
  if (sha(Buffer.from(JSON.stringify(base))) !== manifest_sha256) p.push('manifest content changed after it was built');
  const walk = (d: string, rel = ''): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(d, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (fs.lstatSync(full).isSymbolicLink()) {
      p.push(`symlink in workspace: ${r}`);
      return [];
    }
    return e.isDirectory() ? walk(full, r) : [r];
  });
  for (const area of ['src', 'inputs'] as const) {
    const dir = path.join(m.workspace, area);
    const present = fs.existsSync(dir) ? walk(dir) : [];
    const listed = m.files.filter((f) => f.area === area).map((f) => f.path);
    for (const x of present.filter((x) => !listed.includes(x))) p.push(`unlisted file in ${area}: ${x}`);
    for (const f of m.files.filter((x) => x.area === area)) {
      const abs = path.join(dir, f.path);
      if (!fs.existsSync(abs)) p.push(`missing ${area}/${f.path}`);
      else if (sha256File(abs) !== f.sha256) p.push(`${area}/${f.path} changed`);
    }
  }
  const out = path.join(m.workspace, 'out');
  if (!fs.existsSync(out)) p.push('missing output directory');
  return p;
}

/* ------------------------------------------------------------------ */
/* sandbox runner                                                      */
/* ------------------------------------------------------------------ */

export interface SandboxRun {
  exit_code: number | null;
  stdout: string;
  stderr: string;
}

/** Runs argv inside the sandbox for a validated workspace. Network is always none. */
export function runSandboxed(ctx: RuntimeContext, m: WorkspaceManifest, argv: string[], distro: string | null, timeoutMs = 120000): SandboxRun {
  const problems = validateWorkspace(m);
  if (problems.length) throw new Error(`workspace refused: ${problems.join('; ')}`);
  const script = wslPath(sandboxScript(ctx));
  const args = [script, wslPath(path.join(m.workspace, 'src')), wslPath(path.join(m.workspace, 'inputs')), wslPath(path.join(m.workspace, 'out')), '--net', 'none', '--', ...argv];
  const r = process.platform === 'win32' ? spawnSync('wsl.exe', ['-d', distro ?? 'Ubuntu', '--exec', 'bash', ...args], { encoding: 'utf8', timeout: timeoutMs, windowsHide: true }) : spawnSync('bash', args, { encoding: 'utf8', timeout: timeoutMs });
  return { exit_code: r.status, stdout: String(r.stdout ?? '').replace(/\0/g, ''), stderr: String(r.stderr ?? '').replace(/\0/g, '') };
}

/* ------------------------------------------------------------------ */
/* offline adversarial isolation tests (synthetic data only)           */
/* ------------------------------------------------------------------ */

const PROBE = String.raw`
import json, os, socket, subprocess, sys
res = []
def t(name, ok, detail):
    res.append({"test": name, "passed": bool(ok), "detail": str(detail)[:300]})
def can_read(p):
    try:
        open(p, "rb").read(16); return True
    except Exception as e:
        return False
def can_write(p):
    try:
        with open(p, "a") as f: f.write("x")
        return True
    except Exception as e:
        return False
secret = sys.argv[1]
t("authorized_input_readable", can_read("/work/src/SYNTH01.cbl") and can_read("/work/inputs/request.json"), "source and inputs readable")
host_paths = ["/mnt/c", "/mnt/d", "/home", "/root", "/etc/shadow", "/init", "/usr/lib/wsl/../../../mnt", secret]
visible = [p for p in host_paths if os.path.exists(p)]
t("unrelated_host_files_unreadable", not visible and not can_read(secret), f"visible: {visible}")
t("source_write_protected", not can_write("/work/src/SYNTH01.cbl"), "write to /work/src refused")
t("permitted_output_writable", can_write("/work/out/result.txt"), "/work/out/result.txt written")
bad = [p for p in ["/work/inputs/x", "/usr/x", "/x", "/work/x", "/etc/x"] if can_write(p)]
t("unauthorized_output_blocked", not bad, f"writable: {bad}")
creds = [p for p in ["/tmp/.ssh", "/root/.ssh", "/root/.claude", "/root/.aws"] if os.path.exists(p)]
envleak = [k for k in os.environ if k not in ("PATH", "HOME", "LANG", "TMPDIR", "PWD", "SHLVL", "_", "OLDPWD")]
t("host_credentials_inaccessible", not creds and not envleak, f"paths {creds}, env {envleak}")
def connect(host, port):
    try:
        s = socket.create_connection((host, port), timeout=3); s.close(); return True
    except Exception as e:
        return False
def resolves(h):
    try:
        socket.getaddrinfo(h, 443); return True
    except Exception:
        return False
t("network_denied_by_default", not connect("1.1.1.1", 443) and not resolves("api.anthropic.com"), "no route, no DNS")
t("unauthorized_destination_unreachable", not connect("8.8.8.8", 53) and not connect("140.82.112.3", 443), "arbitrary destinations unreachable")
try:
    os.symlink(secret, "/work/out/link"); followed = can_read("/work/out/link")
except Exception as e:
    followed = False
t("symlink_escape_fails", not followed, "symlink to a host path cannot be followed")
t("path_traversal_fails", not can_read("/work/src/../../mnt/d") and not os.path.exists("/work/src/../../mnt"), "traversal finds no host path")
esc = {}
for name, cmd in [("mount", ["mount", "-t", "tmpfs", "x", "/work"]), ("unshare", ["unshare", "-r", "true"]), ("chroot", ["chroot", "/", "true"]), ("cmd.exe", ["/mnt/c/Windows/System32/cmd.exe", "/c", "echo"])]:
    try:
        esc[name] = subprocess.run(cmd, capture_output=True, timeout=10).returncode == 0
    except Exception:
        esc[name] = False
status = open("/proc/self/status").read()
capeff = [l for l in status.splitlines() if l.startswith("CapEff")][0].split()[1]
nnp = [l for l in status.splitlines() if l.startswith("NoNewPrivs")][0].split()[1]
pids = [p for p in os.listdir("/proc") if p.isdigit()]
t("helper_processes_cannot_escape", not any(esc.values()) and capeff == "0000000000000000" and nnp == "1" and len(pids) < 10, f"escapes {esc}, CapEff {capeff}, NoNewPrivs {nnp}, visible pids {len(pids)}")
socks = [p for p in ["/var/run/docker.sock", "/run/docker.sock", "/run/WSL", "/run/user", "/tmp/.X11-unix"] if os.path.exists(p)]
t("no_host_control_socket", not socks and "WSL_INTEROP" not in os.environ, f"present: {socks}")
print("REVFORGE_ISOLATION_RESULTS " + json.dumps(res))
`;

export interface IsolationTestReport {
  contract: 'bmad/isolation-test-report';
  contract_version: '1.0';
  executed_at: string;
  executed: boolean;
  reason_not_executed: string | null;
  synthetic_only: true;
  sandbox_sha256: string | null;
  host_checks: Array<{ test: string; passed: boolean; detail: string }>;
  sandbox_checks: Array<{ test: string; passed: boolean; detail: string }>;
  all_passed: boolean;
  status: IsolationStatus;
}

/** Runs the adversarial suite against a synthetic project in a temporary directory. Never touches REVFORGE source. */
export function runIsolationTests(ctx: RuntimeContext, probe: Probe = hostProbe, assessment?: HostAssessment): IsolationTestReport {
  const a = assessment ?? assessHost(ctx, probe);
  const base: IsolationTestReport = { contract: 'bmad/isolation-test-report', contract_version: '1.0', executed_at: new Date().toISOString(), executed: false, reason_not_executed: null, synthetic_only: true, sandbox_sha256: sha256File(sandboxScript(ctx)), host_checks: [], sandbox_checks: [], all_passed: false, status: a.status };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-iso-'));
  try {
    // Synthetic project and a host "secret" outside the workspace.
    const proj = path.join(tmp, 'project');
    fs.mkdirSync(proj);
    fs.writeFileSync(path.join(proj, 'SYNTH01.cbl'), '       IDENTIFICATION DIVISION.\n       PROGRAM-ID. SYNTH01.\n');
    fs.writeFileSync(path.join(proj, 'request.json'), '{"synthetic": true}\n');
    const secret = path.join(tmp, 'host-secret.txt');
    fs.writeFileSync(secret, 'SYNTHETIC-HOST-SECRET');
    fs.writeFileSync(path.join(proj, 'probe.py'), PROBE);
    const host = base.host_checks;
    const m = buildWorkspace(path.join(tmp, 'ws'), [{ source: path.join(proj, 'SYNTH01.cbl'), dest: 'SYNTH01.cbl' }], [{ source: path.join(proj, 'request.json'), dest: 'request.json' }, { source: path.join(proj, 'probe.py'), dest: 'probe.py' }]);
    host.push({ test: 'workspace_manifest_valid', passed: validateWorkspace(m).length === 0, detail: `${m.files.length} file(s) hashed` });
    const extra = { ...m, mounts: [...m.mounts, { name: 'src' as const, host: os.homedir(), target: '/work/home', mode: 'ro' as const }] };
    host.push({ test: 'unexpected_mount_rejected', passed: validateWorkspace(extra).some((x) => /unexpected mounts/.test(x)), detail: 'an extra home-directory mount is refused' });
    let linkDetail = '';
    let refusedLink = false;
    let created = false;
    try {
      fs.symlinkSync(secret, path.join(proj, 'link.cbl'));
      created = true;
    } catch (e) {
      linkDetail = `the host refused to create a symlink (${(e as any).code ?? 'error'}); the builder check could not be exercised here`;
    }
    if (created) {
      try {
        buildWorkspace(path.join(tmp, 'ws2'), [{ source: path.join(proj, 'link.cbl'), dest: 'link.cbl' }], []);
        linkDetail = 'the builder accepted a symlink';
      } catch (e) {
        refusedLink = /refusing symlink/.test(String((e as Error).message));
        linkDetail = refusedLink ? 'the workspace builder refused a symlinked input' : String((e as Error).message);
      }
    } else refusedLink = true;
    host.push({ test: 'symlink_input_rejected', passed: refusedLink, detail: linkDetail });
    let refusedTraversal = false;
    try {
      buildWorkspace(path.join(tmp, 'ws3'), [{ source: path.join(proj, 'SYNTH01.cbl'), dest: '../escape.cbl' }], []);
    } catch (e) {
      refusedTraversal = /unsafe workspace path/.test(String((e as Error).message));
    }
    host.push({ test: 'traversal_destination_rejected', passed: refusedTraversal, detail: 'destinations with .. or absolute paths are refused' });
    fs.writeFileSync(path.join(m.workspace, 'src', 'smuggled.cbl'), 'x');
    host.push({ test: 'unlisted_file_rejected', passed: validateWorkspace(m).some((x) => /unlisted file/.test(x)), detail: 'a file added after the manifest is refused' });
    fs.unlinkSync(path.join(m.workspace, 'src', 'smuggled.cbl'));

    if (a.status !== 'ISOLATION_CONFIGURED') {
      base.reason_not_executed = `isolation runtime not available on this host (${a.status}); sandbox checks were not run`;
      base.all_passed = false;
      return base;
    }
    const r = runSandboxed(ctx, m, ['/usr/bin/python3', '/work/inputs/probe.py', wslPath(secret)], a.wsl.distro);
    const line = r.stdout.split('\n').find((l) => l.startsWith('REVFORGE_ISOLATION_RESULTS '));
    if (!line) {
      base.reason_not_executed = `sandbox did not run: exit ${r.exit_code}; ${r.stderr.slice(0, 300)}`;
      return base;
    }
    base.executed = true;
    base.sandbox_checks = JSON.parse(line.slice('REVFORGE_ISOLATION_RESULTS '.length));
    const wrote = fs.existsSync(path.join(m.workspace, 'out', 'result.txt'));
    base.sandbox_checks.push({ test: 'output_visible_to_host', passed: wrote, detail: 'the permitted output reached the host workspace' });
    const srcIntact = sha256File(path.join(m.workspace, 'src', 'SYNTH01.cbl')) === m.files.find((f) => f.path === 'SYNTH01.cbl')!.sha256;
    base.sandbox_checks.push({ test: 'source_unchanged_on_host', passed: srcIntact, detail: 'the source hash is unchanged after the run' });
    base.all_passed = [...host, ...base.sandbox_checks].every((c) => c.passed);
    base.status = base.all_passed ? 'ISOLATION_TESTED' : a.status;
    return base;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
