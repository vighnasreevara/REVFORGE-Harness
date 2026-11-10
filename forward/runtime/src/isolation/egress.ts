/**
 * Provider-egress component for BMad LIVE runs.
 *
 * The whole-process sandbox (`sandbox.sh`) has no network by default. A LIVE
 * run must reach the AI provider and nothing else, so this module adds one
 * verified path:
 *
 *   sandboxed command --HTTPS_PROXY--> 127.0.0.1:3128 (socat, inside the
 *   sandbox's own network namespace) --> /work/egress.sock (the one bind-mounted
 *   socket node) --> egress-proxy.mjs (outside the namespaces, in WSL) -->
 *   api.anthropic.com:443 only.
 *
 * The proxy is CONNECT-only with an exact host:port allowlist (default
 * api.anthropic.com:443). It answers everything else with 4xx before any name
 * is resolved, and logs one JSON line per decision (no headers, no payload).
 *
 * `verifyEgress` is the executed self-test: it runs the proxy and the sandbox
 * in egress mode on synthetic data and proves, from inside the boundary, that
 * the provider is reachable through the proxy, that other destinations,
 * methods and direct connections fail, and that the credential file and host
 * paths are invisible. No credential is ever sent: the self-test uses a
 * synthetic marker in place of a key and never transmits it. Missing
 * prerequisites are reported as `executed: false`, never as a pass.
 *
 * Limits (stated, not hidden): the proxy enforces the destination only. TLS is
 * end to end between Claude Code and the provider, so request content is not
 * inspected; what can be disclosed is limited by the minimal workspace. The
 * boundary shares the WSL2 kernel with the host distribution. The allowlisted
 * name is resolved by the host's DNS.
 */
import { ChildProcess, spawn, spawnSync } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { buildWorkspace, hostProbe, Probe, runSandboxed, sandboxScript, wslPath } from './isolation';

export const PROVIDER_ALLOWLIST = ['api.anthropic.com:443'];
export const egressProxyScript = (ctx: RuntimeContext) => path.join(path.dirname(sandboxScript(ctx)), 'egress-proxy.mjs');
export const EGRESS_REPORT = (ctx: RuntimeContext) => path.join(path.dirname(sandboxScript(ctx)), 'egress-test-report.json');
const MAX_REPORT_AGE_MS = 7 * 24 * 3600000;
const DIR_RE = /^\/tmp\/revforge-egress-[0-9a-f]{12,32}$/;

/* ------------------------------------------------------------------ */
/* Linux shell (WSL on Windows, bash elsewhere)                         */
/* ------------------------------------------------------------------ */

export interface LinuxShell {
  /** Runs `bash -c script _ ...args` synchronously. Arguments are passed as argv, never interpolated. */
  run(script: string, args?: string[], timeoutMs?: number): { ok: boolean; code: number | null; stdout: string; stderr: string };
  /** Starts `bash -c script _ ...args` in the background. */
  spawn(script: string, args?: string[]): ChildProcess;
}

export function linuxShell(distro: string | null): LinuxShell {
  const argv = (script: string, args: string[]) => (process.platform === 'win32' ? { cmd: 'wsl.exe', args: ['-d', distro ?? 'Ubuntu', '--exec', 'bash', '-c', script, 'revforge', ...args] } : { cmd: 'bash', args: ['-c', script, 'revforge', ...args] });
  return {
    run(script, args = [], timeoutMs = 60000) {
      const a = argv(script, args);
      const r = spawnSync(a.cmd, a.args, { encoding: 'utf8', timeout: timeoutMs, windowsHide: true });
      return { ok: r.status === 0, code: r.status, stdout: String(r.stdout ?? '').replace(/\0/g, ''), stderr: String(r.stderr ?? '').replace(/\0/g, '') };
    },
    spawn(script, args = []) {
      const a = argv(script, args);
      return spawn(a.cmd, a.args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    },
  };
}

/* ------------------------------------------------------------------ */
/* proxy lifecycle                                                      */
/* ------------------------------------------------------------------ */

export interface EgressLogEntry {
  time: string;
  host: string | null;
  port: number | null;
  method?: string | null;
  decision: 'allowed' | 'denied';
  status: number;
  reason: string;
  bytes_up: number;
  bytes_down: number;
  duration_ms: number;
}

export interface EgressSummary {
  proxy_sha256: string | null;
  sandbox_sha256: string | null;
  allowlist: string[];
  started_at: string;
  stopped_at: string;
  log_sha256: string;
  log_lines: number;
  connections_allowed: number;
  connections_denied: number;
  allowed_destinations: string[];
  denied_destinations: string[];
  bytes_up: number;
  bytes_down: number;
  malformed_log_lines: number;
}

export interface EgressProxyHandle {
  id: string;
  dir: string;
  socket: string;
  log: string;
  allowlist: string[];
  started_at: string;
  stop(): EgressSummary;
}

export type EgressStarter = (ctx: RuntimeContext, opts: { distro: string | null }) => EgressProxyHandle;

const LOG_KEYS = new Set(['time', 'host', 'port', 'method', 'decision', 'status', 'reason', 'bytes_up', 'bytes_down', 'duration_ms']);

/** Summarises a proxy log (JSON lines). Pure. */
export function summarizeEgressLog(text: string): { entries: EgressLogEntry[]; malformed: number; sha256: string } {
  const entries: EgressLogEntry[] = [];
  let malformed = 0;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      const e = JSON.parse(line);
      if (!e || typeof e !== 'object' || Object.keys(e).some((k) => !LOG_KEYS.has(k)) || (e.decision !== 'allowed' && e.decision !== 'denied')) malformed++;
      else entries.push(e);
    } catch {
      malformed++;
    }
  }
  return { entries, malformed, sha256: createHash('sha256').update(text, 'utf8').digest('hex') };
}

function summary(ctx: RuntimeContext, allowlist: string[], startedAt: string, logText: string): EgressSummary {
  const s = summarizeEgressLog(logText);
  const dest = (e: EgressLogEntry) => (e.host ? `${e.host}:${e.port}` : `(${e.method ?? 'malformed'})`);
  const allowed = s.entries.filter((e) => e.decision === 'allowed');
  const denied = s.entries.filter((e) => e.decision === 'denied');
  return {
    proxy_sha256: sha256File(egressProxyScript(ctx)),
    sandbox_sha256: sha256File(sandboxScript(ctx)),
    allowlist,
    started_at: startedAt,
    stopped_at: new Date().toISOString(),
    log_sha256: s.sha256,
    log_lines: s.entries.length + s.malformed,
    connections_allowed: allowed.length,
    connections_denied: denied.length,
    allowed_destinations: [...new Set(allowed.map(dest))].sort(),
    denied_destinations: [...new Set(denied.map(dest))].sort(),
    bytes_up: allowed.reduce((n, e) => n + (e.bytes_up || 0), 0),
    bytes_down: allowed.reduce((n, e) => n + (e.bytes_down || 0), 0),
    malformed_log_lines: s.malformed,
  };
}

/**
 * Starts the allowlist proxy inside WSL (outside the sandbox) in a run-specific directory
 * /tmp/revforge-egress-<id>/ (mode 700) and waits for its socket. Throws if it does not come up.
 */
export function startEgressProxy(ctx: RuntimeContext, opts: { distro: string | null; shell?: LinuxShell; extraAllow?: string[]; limits?: { maxTunnels?: number; idleMs?: number; maxBytes?: number } }): EgressProxyHandle {
  const shell = opts.shell ?? linuxShell(opts.distro);
  const id = randomBytes(8).toString('hex');
  const dir = `/tmp/revforge-egress-${id}`;
  const extra = (opts.extraAllow ?? []).flatMap((a) => ['--allow', a]);
  const lim = opts.limits ?? {};
  const limArgs = [...(lim.maxTunnels ? ['--max-tunnels', String(lim.maxTunnels)] : []), ...(lim.idleMs ? ['--idle-ms', String(lim.idleMs)] : []), ...(lim.maxBytes ? ['--max-bytes', String(lim.maxBytes)] : [])];
  const startedAt = new Date().toISOString();
  const child = shell.spawn('set -eu; d="$1"; shift; umask 077; mkdir -m 700 -- "$d"; exec node "$@" --socket "$d/egress.sock" --log "$d/egress.log" --pid-file "$d/proxy.pid"', [dir, wslPath(egressProxyScript(ctx)), ...extra, ...limArgs]);
  let stderr = '';
  child.stderr?.on('data', (c) => (stderr += String(c)));
  child.on('error', () => undefined);
  const wait = shell.run('for i in $(seq 1 100); do [ -S "$1/egress.sock" ] && [ -s "$1/proxy.pid" ] && exit 0; sleep 0.1; done; exit 1', [dir], 30000);
  // Stops the proxy (pid file), waits for its socket to go, prints the log and removes the run directory.
  const STOP = 'd="$1"; [ -f "$d/proxy.pid" ] && kill "$(cat "$d/proxy.pid")" 2>/dev/null; for i in $(seq 1 30); do [ -S "$d/egress.sock" ] || break; sleep 0.1; done; [ -f "$d/egress.log" ] && cat -- "$d/egress.log"; rm -rf -- "$d"; exit 0';
  const cleanup = () => shell.run(STOP, [dir], 30000);
  if (!wait.ok) {
    if (DIR_RE.test(dir)) cleanup();
    try {
      child.kill();
    } catch {
      /* already gone */
    }
    throw new Error(`the egress proxy did not start (${(stderr || wait.stderr).trim().slice(0, 300) || 'no socket within 10 s'})`);
  }
  const allowlist = [...new Set([...PROVIDER_ALLOWLIST, ...(opts.extraAllow ?? [])])];
  let stopped: EgressSummary | null = null;
  return {
    id,
    dir,
    socket: `${dir}/egress.sock`,
    log: `${dir}/egress.log`,
    allowlist,
    started_at: startedAt,
    stop() {
      if (stopped) return stopped;
      if (!DIR_RE.test(dir)) throw new Error(`refusing to remove unexpected directory ${dir}`);
      const r = cleanup();
      try {
        child.kill();
      } catch {
        /* already gone */
      }
      stopped = summary(ctx, allowlist, startedAt, r.stdout);
      return stopped;
    },
  };
}

/* ------------------------------------------------------------------ */
/* executed self-test                                                   */
/* ------------------------------------------------------------------ */

const EGRESS_PROBE = String.raw`
import glob, json, os, socket, ssl, sys
res = []
def t(name, ok, detail):
    res.append({"test": name, "passed": bool(ok), "detail": str(detail)[:300]})
key_path = sys.argv[1]
PROXY = ("127.0.0.1", 3128)
def proxy_request(raw):
    s = socket.create_connection(PROXY, timeout=15)
    s.sendall(raw)
    buf = b""
    while b"\r\n\r\n" not in buf and len(buf) < 4096:
        c = s.recv(1024)
        if not c:
            break
        buf += c
    return s, buf.split(b"\r\n", 1)[0].decode("latin1")
def connect_status(target):
    try:
        s, st = proxy_request(("CONNECT %s HTTP/1.1\r\nHost: %s\r\n\r\n" % (target, target)).encode())
        s.close()
        return st
    except Exception as e:
        return "error " + repr(e)
env = dict(os.environ)
t("proxy_environment_set", env.get("HTTPS_PROXY") == "http://127.0.0.1:3128" and env.get("HTTP_PROXY") == "http://127.0.0.1:3128", "HTTPS_PROXY/HTTP_PROXY point to the loopback bridge")
allowed_env = {"PATH", "HOME", "LANG", "TMPDIR", "HTTPS_PROXY", "HTTP_PROXY", "https_proxy", "http_proxy", "ANTHROPIC_API_KEY", "PWD", "SHLVL", "_", "OLDPWD"}
extra = sorted(k for k in env if k not in allowed_env)
t("environment_allowlisted", not extra, "unexpected variables: %s" % extra)
k = env.get("ANTHROPIC_API_KEY", "")
t("credential_delivered_by_environment_only", k.startswith("REVFORGE-SYNTHETIC-NOT-A-KEY-") and not os.path.exists(key_path), "synthetic credential present in the environment; the env file path is not visible (value never printed or sent)")
try:
    s, st = proxy_request(b"CONNECT api.anthropic.com:443 HTTP/1.1\r\nHost: api.anthropic.com:443\r\n\r\n")
    tls = None; verified = False; answer = None
    if st.startswith("HTTP/1.1 200"):
        ctx = ssl.create_default_context()
        cas = sorted(glob.glob("/usr/share/ca-certificates/mozilla/*.crt"))
        if cas:
            ctx.load_verify_locations(cadata="".join(open(p, encoding="ascii", errors="ignore").read() for p in cas))
            verified = True
        else:
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        ss = ctx.wrap_socket(s, server_hostname="api.anthropic.com")
        tls = ss.version()
        ss.sendall(b"HEAD / HTTP/1.1\r\nHost: api.anthropic.com\r\nUser-Agent: revforge-egress-selftest\r\nConnection: close\r\n\r\n")
        answer = ss.recv(512).split(b"\r\n", 1)[0].decode("latin1")
        ss.close()
    else:
        s.close()
    t("allowlisted_provider_reachable", st.startswith("HTTP/1.1 200") and tls is not None, "proxy %r; TLS %s; certificate verified %s; provider answered %r; no credential sent" % (st, tls, verified, answer))
except Exception as e:
    t("allowlisted_provider_reachable", False, repr(e))
st = connect_status("example.com:443")
t("non_allowlisted_host_refused", st.startswith("HTTP/1.1 403"), "CONNECT example.com:443 -> %r" % st)
st = connect_status("api.anthropic.com:80")
t("non_allowlisted_port_refused", st.startswith("HTTP/1.1 403"), "CONNECT api.anthropic.com:80 -> %r" % st)
st = connect_status("1.1.1.1:443")
t("ip_literal_refused", st.startswith("HTTP/1.1 403"), "CONNECT 1.1.1.1:443 -> %r" % st)
try:
    s, st = proxy_request(b"GET http://example.com/ HTTP/1.1\r\nHost: example.com\r\n\r\n"); s.close()
except Exception as e:
    st = "error " + repr(e)
t("plain_http_refused", st.startswith("HTTP/1.1 405"), "GET http://example.com/ -> %r" % st)
try:
    s, st = proxy_request(b"NOT A REQUEST\r\n\r\n"); s.close()
except Exception as e:
    st = "error " + repr(e)
t("malformed_request_refused", st.startswith("HTTP/1.1 400"), "malformed head -> %r" % st)
def connect(host, port):
    try:
        s = socket.create_connection((host, port), timeout=3); s.close(); return True
    except Exception:
        return False
def resolves(h):
    try:
        socket.getaddrinfo(h, 443); return True
    except Exception:
        return False
direct = {"1.1.1.1:443": connect("1.1.1.1", 443), "8.8.8.8:53": connect("8.8.8.8", 53), "160.79.104.10:443": connect("160.79.104.10", 443)}
dns = {"api.anthropic.com": resolves("api.anthropic.com"), "example.com": resolves("example.com")}
t("direct_connection_blocked", not any(direct.values()), "direct connections succeeded: %s" % [k for k, v in direct.items() if v])
t("dns_unavailable", not any(dns.values()), "names resolved: %s" % [k for k, v in dns.items() if v])
devs = [l.split(":")[0].strip() for l in open("/proc/net/dev").read().splitlines()[2:]]
routes = open("/proc/net/route").read().splitlines()[1:]
t("loopback_only", devs == ["lo"] and not routes, "interfaces %s, routes %d" % (devs, len(routes)))
hidden = [p for p in ["/mnt", "/mnt/c", "/mnt/d", "/home", "/root", "/run", "/init", "/etc/shadow", "/etc/resolv.conf", key_path, os.path.dirname(key_path)] if os.path.exists(p) and p not in ("/tmp",)]
t("host_paths_hidden", not hidden, "visible: %s" % hidden)
status = open("/proc/self/status").read()
capeff = [l for l in status.splitlines() if l.startswith("CapEff")][0].split()[1]
nnp = [l for l in status.splitlines() if l.startswith("NoNewPrivs")][0].split()[1]
t("privileges_dropped", capeff == "0000000000000000" and nnp == "1", "CapEff %s, NoNewPrivs %s" % (capeff, nnp))
print("REVFORGE_EGRESS_RESULTS " + json.dumps(res))
`;

export type EgressStatus = 'EGRESS_VERIFIED' | 'EGRESS_NOT_VERIFIED' | 'EGRESS_NOT_EXECUTED';
export interface EgressCheck {
  test: string;
  passed: boolean;
  detail: string;
}
export interface EgressTestReport {
  contract: 'bmad/egress-test-report';
  contract_version: '1.0';
  executed_at: string;
  executed: boolean;
  reason_not_executed: string | null;
  synthetic_only: true;
  credential_sent: false;
  proxy_sha256: string | null;
  sandbox_sha256: string | null;
  allowlist: string[];
  host: { platform: string; distro: string | null };
  prerequisites: Array<{ name: string; available: boolean; detail: string }>;
  host_checks: EgressCheck[];
  sandbox_checks: EgressCheck[];
  proxy_log: { sha256: string; lines: number; allowed: number; denied: number; allowed_destinations: string[]; denied_destinations: string[] } | null;
  all_passed: boolean;
  status: EgressStatus;
}

/** Prerequisites inside WSL / Linux, probed without installing anything. */
export function egressPrerequisites(probe: Probe = hostProbe): { distro: string | null; items: EgressTestReport['prerequisites'] } {
  const win = process.platform === 'win32';
  const items: EgressTestReport['prerequisites'] = [];
  let distro: string | null = null;
  if (win) {
    const l = probe.run('wsl.exe', ['-l', '-v']);
    const row = l.ok ? l.out.split('\n').map((x) => x.replace(/\*/g, '').trim()).find((x) => /\s2$/.test(x) && !/^NAME/.test(x) && !/^docker-desktop/i.test(x)) : undefined;
    distro = row ? row.split(/\s+/)[0] : null;
    items.push({ name: 'wsl2_distribution', available: !!distro, detail: distro ? `${distro} (WSL 2)` : 'no WSL 2 distribution found' });
    if (!distro) return { distro, items };
  }
  const inLinux = (cmd: string) => (win ? probe.run('wsl.exe', ['-d', distro!, '--exec', 'bash', '-c', cmd], 60000) : probe.run('bash', ['-c', cmd], 60000));
  for (const [name, cmd] of [
    ['node', 'command -v node'],
    ['socat', 'test -x /usr/bin/socat && echo /usr/bin/socat'],
    ['iproute2', 'test -x /usr/sbin/ip && echo /usr/sbin/ip'],
    ['python3', 'test -x /usr/bin/python3 && echo /usr/bin/python3'],
    ['unshare', 'command -v unshare'],
    ['setpriv', 'test -x /usr/bin/setpriv && echo /usr/bin/setpriv'],
  ] as const) {
    const r = inLinux(cmd);
    items.push({ name, available: r.ok && !!r.out, detail: r.ok && r.out ? r.out.split('\n')[0] : 'not installed' });
  }
  const u = inLinux('unshare --user --map-root-user --mount --net --pid --fork true && echo USERNS_OK');
  items.push({ name: 'unprivileged_user_namespaces', available: u.ok && /USERNS_OK/.test(u.out), detail: u.ok && /USERNS_OK/.test(u.out) ? 'available' : 'cannot create namespaces' });
  return { distro: win ? distro : null, items };
}

/**
 * Executed self-test of the provider-egress component. Writes the report to
 * integrations/bmad/isolation/egress-test-report.json (or `reportPath`) unless `write` is false.
 */
export function verifyEgress(ctx: RuntimeContext, probe: Probe = hostProbe, opts: { reportPath?: string; write?: boolean; shell?: LinuxShell; starter?: EgressStarter } = {}): EgressTestReport {
  const pre = egressPrerequisites(probe);
  const r: EgressTestReport = {
    contract: 'bmad/egress-test-report',
    contract_version: '1.0',
    executed_at: new Date().toISOString(),
    executed: false,
    reason_not_executed: null,
    synthetic_only: true,
    credential_sent: false,
    proxy_sha256: sha256File(egressProxyScript(ctx)),
    sandbox_sha256: sha256File(sandboxScript(ctx)),
    allowlist: [...PROVIDER_ALLOWLIST],
    host: { platform: `${process.platform} ${os.arch()}`, distro: pre.distro },
    prerequisites: pre.items,
    host_checks: [],
    sandbox_checks: [],
    proxy_log: null,
    all_passed: false,
    status: 'EGRESS_NOT_EXECUTED',
  };
  const script = fs.existsSync(sandboxScript(ctx)) ? fs.readFileSync(sandboxScript(ctx), 'utf8') : '';
  const proxy = fs.existsSync(egressProxyScript(ctx)) ? fs.readFileSync(egressProxyScript(ctx), 'utf8') : '';
  r.host_checks.push({ test: 'proxy_script_present', passed: !!r.proxy_sha256, detail: r.proxy_sha256 ? `egress-proxy.mjs sha256 ${r.proxy_sha256}` : 'egress-proxy.mjs missing' });
  r.host_checks.push({ test: 'sandbox_egress_mode_present', passed: /--net egress SOCKET/.test(script) && /UNIX-CONNECT:\/work\/egress\.sock/.test(script), detail: r.sandbox_sha256 ? `sandbox.sh sha256 ${r.sandbox_sha256}` : 'sandbox.sh missing' });
  r.host_checks.push({ test: 'default_allowlist_is_provider_only', passed: /DEFAULT_ALLOWLIST = Object\.freeze\(\['api\.anthropic\.com:443'\]\)/.test(proxy), detail: 'the proxy default allowlist is exactly api.anthropic.com:443' });
  const finish = () => {
    r.all_passed = r.executed && [...r.host_checks, ...r.sandbox_checks].every((c) => c.passed) && r.sandbox_checks.length > 0;
    r.status = r.all_passed ? 'EGRESS_VERIFIED' : r.executed ? 'EGRESS_NOT_VERIFIED' : 'EGRESS_NOT_EXECUTED';
    const v = ctx.contracts.validate('bmad/egress-test-report', r);
    if (!v.valid) throw new Error(`egress test report violates its contract: ${v.errors.join('; ')}`);
    if (opts.write !== false) {
      const file = opts.reportPath ?? EGRESS_REPORT(ctx);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(r, null, 2) + '\n', 'utf8');
    }
    return r;
  };
  const missing = pre.items.filter((p) => !p.available).map((p) => p.name);
  if (missing.length) {
    r.reason_not_executed = `prerequisites missing${pre.distro ? ` in WSL (${pre.distro})` : process.platform === 'win32' ? '' : ' on this host'}: ${missing.join(', ')}`;
    return finish();
  }
  if (!r.host_checks.every((c) => c.passed)) {
    r.reason_not_executed = `component files incomplete: ${r.host_checks.filter((c) => !c.passed).map((c) => c.test).join(', ')}`;
    return finish();
  }
  const shell = opts.shell ?? linuxShell(pre.distro);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-egress-'));
  const testId = randomBytes(8).toString('hex');
  const keyDir = `/tmp/revforge-egress-key-${testId}`;
  const marker = `REVFORGE-SYNTHETIC-NOT-A-KEY-${testId}`;
  let handle: EgressProxyHandle | null = null;
  try {
    fs.writeFileSync(path.join(tmp, 'SYNTH01.cbl'), '       IDENTIFICATION DIVISION.\n       PROGRAM-ID. SYNTH01.\n');
    fs.writeFileSync(path.join(tmp, 'egress_probe.py'), EGRESS_PROBE);
    const m = buildWorkspace(path.join(tmp, 'ws'), [{ source: path.join(tmp, 'SYNTH01.cbl'), dest: 'SYNTH01.cbl' }], [{ source: path.join(tmp, 'egress_probe.py'), dest: 'egress_probe.py' }]);
    // A synthetic env file (mode 600) inside WSL: proves the credential path without any real key.
    const mk = shell.run('set -eu; umask 077; mkdir -m 700 -- "$1"; printf "ANTHROPIC_API_KEY=%s\\n" "$2" > "$1/synthetic.env"', [keyDir, marker]);
    if (!mk.ok) {
      r.reason_not_executed = `could not create the synthetic env file in WSL: ${mk.stderr.slice(0, 200)}`;
      return finish();
    }
    try {
      handle = (opts.starter ?? ((c, o) => startEgressProxy(c, { ...o, shell })))(ctx, { distro: pre.distro });
    } catch (e) {
      r.reason_not_executed = (e as Error).message;
      return finish();
    }
    const run = runSandboxed(ctx, m, ['/usr/bin/python3', '/work/inputs/egress_probe.py', `${keyDir}/synthetic.env`], pre.distro, 180000, { egressSocket: handle.socket, envFile: `${keyDir}/synthetic.env` });
    const sum = handle.stop();
    handle = null;
    const line = run.stdout.split('\n').find((l) => l.startsWith('REVFORGE_EGRESS_RESULTS '));
    if (!line) {
      r.reason_not_executed = `the sandbox did not run in egress mode: exit ${run.exit_code}; ${run.stderr.replace(marker, '[synthetic]').slice(0, 300)}`;
      return finish();
    }
    r.executed = true;
    r.sandbox_checks = JSON.parse(line.slice('REVFORGE_EGRESS_RESULTS '.length));
    r.proxy_log = { sha256: sum.log_sha256, lines: sum.log_lines, allowed: sum.connections_allowed, denied: sum.connections_denied, allowed_destinations: sum.allowed_destinations, denied_destinations: sum.denied_destinations };
    const logText = JSON.stringify(sum);
    r.sandbox_checks.push({ test: 'proxy_logged_decisions', passed: sum.allowed_destinations.includes('api.anthropic.com:443') && sum.denied_destinations.includes('example.com:443') && sum.allowed_destinations.every((d) => PROVIDER_ALLOWLIST.includes(d)) && sum.malformed_log_lines === 0, detail: `allowed ${sum.allowed_destinations.join(', ') || 'none'}; denied ${sum.denied_destinations.join(', ') || 'none'}; ${sum.malformed_log_lines} malformed line(s)` });
    r.sandbox_checks.push({ test: 'credential_never_in_proxy_log', passed: !logText.includes(marker) && !run.stdout.includes(marker) && !run.stderr.includes(marker), detail: 'the synthetic credential marker appears in no log or output' });
    return finish();
  } finally {
    if (handle) {
      try {
        handle.stop();
      } catch {
        /* best effort */
      }
    }
    shell.run('case "$1" in /tmp/revforge-egress-key-*) rm -rf -- "$1" ;; esac', [keyDir], 30000);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/* evidence for the preflight                                           */
/* ------------------------------------------------------------------ */

/** The recorded egress self-test, if it is current, executed, fully passed and for the current proxy and sandbox scripts. */
export function egressEvidence(ctx: RuntimeContext, at = new Date(), file = EGRESS_REPORT(ctx)): { verified: boolean; report: EgressTestReport | null; problems: string[] } {
  if (!fs.existsSync(file)) return { verified: false, report: null, problems: ['no egress test report: run bmad executor egress-test on this host'] };
  let r: EgressTestReport;
  try {
    r = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return { verified: false, report: null, problems: [`the egress test report is unreadable: ${(e as Error).message}`] };
  }
  const problems: string[] = [];
  const v = ctx.contracts.validate('bmad/egress-test-report', r);
  if (!v.valid) problems.push(`the egress test report violates bmad/egress-test-report: ${v.errors.slice(0, 3).join('; ')}`);
  if (!r.executed) problems.push(`the egress self-test was not executed: ${r.reason_not_executed}`);
  const failed = [...(r.host_checks ?? []), ...(r.sandbox_checks ?? [])].filter((c) => !c.passed).map((c) => c.test);
  if (!r.all_passed || failed.length || !(r.sandbox_checks ?? []).length) problems.push(`egress checks failed: ${failed.join(', ') || 'no sandbox checks recorded'}`);
  if (r.status !== 'EGRESS_VERIFIED') problems.push(`egress status ${r.status}`);
  if (r.proxy_sha256 !== sha256File(egressProxyScript(ctx))) problems.push('egress-proxy.mjs changed since it was verified');
  if (r.sandbox_sha256 !== sha256File(sandboxScript(ctx))) problems.push('sandbox.sh changed since the egress self-test');
  if (JSON.stringify(r.allowlist) !== JSON.stringify(PROVIDER_ALLOWLIST)) problems.push(`the verified allowlist ${JSON.stringify(r.allowlist)} is not exactly ${JSON.stringify(PROVIDER_ALLOWLIST)}`);
  if (r.credential_sent !== false) problems.push('the self-test claims a credential was sent');
  const age = at.getTime() - Date.parse(r.executed_at);
  if (!(age <= MAX_REPORT_AGE_MS)) problems.push(`the egress test report is older than 7 days (${r.executed_at})`);
  return { verified: !problems.length, report: r, problems };
}

/** The configured provider credential file (a WSL path), or null. The file is never read here. */
export function providerCredentialFile(ctx: RuntimeContext): string | null {
  const v = (ctx.config as any).bmad?.provider_credential_file;
  return typeof v === 'string' && v.length ? v : null;
}
