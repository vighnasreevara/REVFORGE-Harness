/**
 * Provider-egress component tests: the allowlist proxy's pure decision
 * function and its socket behaviour (loopback TCP with an injected upstream:
 * no external network), the sandbox network arguments, the egress self-test
 * report contract and evidence (passing, failing, stale hashes, old reports),
 * the preflight network checks, the LIVE runner wiring with injected sandbox
 * and proxy, and the credential never appearing in records or logs.
 * WSL-dependent tests run only when WSL 2 with node, socat, iproute2, python3,
 * unshare and setpriv is available, and are skipped with the precise reason
 * otherwise. Synthetic data only; no credential is ever created or sent.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as net from 'net';
import * as os from 'os';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { canonicalize } from '../runtime/src/approval/canonical';
import { importDisclosure, prepareDisclosure } from '../runtime/src/disclosure/disclosure';
import { bmadSummary } from '../runtime/src/bmad/adapter';
import { handleExecutionOutcome } from '../runtime/src/bmad/executor';
import { launchBoundary, preflight } from '../runtime/src/bmad/preflight';
import { launchPlanned, sandboxRunner } from '../runtime/src/bmad/runner';
import { Probe, sandboxNetArgs, sandboxScript, wslPath } from '../runtime/src/isolation/isolation';
import { EgressProxyHandle, EgressSummary, EgressTestReport, egressEvidence, egressPrerequisites, egressProxyScript, linuxShell, PROVIDER_ALLOWLIST, providerCredentialFile, summarizeEgressLog, verifyEgress } from '../runtime/src/isolation/egress';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { KP, signText, wfOf } from './helpers/g2fixture';
import { BRAVO, DESIGN_SIGNERS, designFixture } from './helpers/designfixture';

const PROXY_FILE = path.join(FORWARD_DIR, 'integrations', 'bmad', 'isolation', 'egress-proxy.mjs');
// A native dynamic import (the compiled tests are CommonJS; the proxy is an ES module).
const importEsm = new Function('u', 'return import(u)') as (u: string) => Promise<any>;
let P: any;
before(async () => {
  P = await importEsm(pathToFileURL(PROXY_FILE).href);
});

const fixtures: Fixture[] = [];
const temps: string[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
});
afterEach(() => {
  while (fixtures.length) cleanup(fixtures.pop()!);
  while (temps.length) fs.rmSync(temps.pop()!, { recursive: true, force: true });
});
const tmpDir = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-egress-'));
  temps.push(d);
  return d;
};
const req = (line: string, headers: string[] = []) => [line, ...headers].join('\r\n');

/* ------------------------------------------------------------------ */
describe('provider egress - proxy decision function (pure)', () => {
  test('the default allowlist is exactly api.anthropic.com:443', () => {
    assert.deepEqual([...P.DEFAULT_ALLOWLIST], ['api.anthropic.com:443']);
    assert.deepEqual(P.buildAllowlist(), ['api.anthropic.com:443']);
    assert.deepEqual(PROVIDER_ALLOWLIST, ['api.anthropic.com:443'], 'the runtime and the proxy agree');
  });

  test('an allowlisted CONNECT is allowed (host matched case-insensitively)', () => {
    for (const line of ['CONNECT api.anthropic.com:443 HTTP/1.1', 'CONNECT API.Anthropic.COM:443 HTTP/1.0']) {
      const d = P.decide(req(line, ['Host: api.anthropic.com:443', 'User-Agent: x']));
      assert.equal(d.allow, true, line);
      assert.equal(d.status, 200);
      assert.equal(d.host, 'api.anthropic.com');
      assert.equal(d.port, 443);
    }
  });

  test('other hosts, look-alike hosts, IP literals and other ports are refused with 403', () => {
    for (const t of ['example.com:443', 'api.anthropic.com.evil.example:443', 'evil.api.anthropic.com:443', 'api.anthropic.com.:443', 'anthropic.com:443', '1.1.1.1:443', '160.79.104.10:443', 'api.anthropic.com:80', 'api.anthropic.com:8443', 'localhost:443']) {
      const d = P.decide(req(`CONNECT ${t} HTTP/1.1`));
      assert.equal(d.allow, false, t);
      assert.equal(d.status, 403, `${t}: ${d.reason}`);
    }
  });

  test('every non-CONNECT method is refused with 405 (plain HTTP is never forwarded)', () => {
    for (const line of ['GET http://example.com/ HTTP/1.1', 'GET / HTTP/1.1', 'POST https://api.anthropic.com/v1/messages HTTP/1.1', 'HEAD http://api.anthropic.com/ HTTP/1.1', 'PUT x HTTP/1.1', 'OPTIONS * HTTP/1.1']) {
      const d = P.decide(req(line, ['Host: example.com']));
      assert.equal(d.allow, false, line);
      assert.equal(d.status, 405, line);
    }
  });

  test('malformed requests are refused with 400', () => {
    const bad = [
      '',
      'CONNECT api.anthropic.com:443',
      'connect api.anthropic.com:443 HTTP/1.1',
      'CONNECT api.anthropic.com:443 HTTP/2',
      'CONNECT  api.anthropic.com:443 HTTP/1.1',
      'CONNECT api.anthropic.com HTTP/1.1',
      'CONNECT [::1]:443 HTTP/1.1',
      'CONNECT user@api.anthropic.com:443 HTTP/1.1',
      'CONNECT api.anthropic.com:0 HTTP/1.1',
      'CONNECT api.anthropic.com:99999 HTTP/1.1',
      req('CONNECT api.anthropic.com:443 HTTP/1.1', ['not a header']),
      req('CONNECT api.anthropic.com:443 HTTP/1.1', ['X: \u0001']),
      'CONNECT api.anthropic.com:443 HTTP/1.1\nHost: x',
      'NOT A REQUEST',
    ];
    for (const h of bad) {
      const d = P.decide(h);
      assert.equal(d.allow, false, JSON.stringify(h));
      assert.equal(d.status, 400, `${JSON.stringify(h)}: ${d.reason}`);
    }
    assert.equal(P.decide(42 as any).status, 400);
  });

  test('limits: oversized heads, the concurrent tunnel limit and the byte budget refuse', () => {
    assert.equal(P.decide(req('CONNECT api.anthropic.com:443 HTTP/1.1', [`X: ${'a'.repeat(9000)}`])).status, 431);
    const line = 'CONNECT api.anthropic.com:443 HTTP/1.1';
    assert.equal(P.decide(line, { active: 7, limits: { maxTunnels: 8 } }).allow, true);
    assert.equal(P.decide(line, { active: 8, limits: { maxTunnels: 8 } }).status, 503);
    assert.equal(P.decide(line, { totalBytes: 999, limits: { maxTotalBytes: 1000 } }).allow, true);
    assert.equal(P.decide(line, { totalBytes: 1000, limits: { maxTotalBytes: 1000 } }).status, 503);
    assert.equal(P.decide('CONNECT example.com:443 HTTP/1.1', { active: 99 }).status, 403, 'the allowlist is decided before limits');
  });

  test('extra allowlist entries only by explicit argument, and only exact DNS names', () => {
    assert.deepEqual(P.buildAllowlist(['Statsig.Anthropic.com:443']), ['api.anthropic.com:443', 'statsig.anthropic.com:443']);
    assert.equal(P.decide('CONNECT statsig.anthropic.com:443 HTTP/1.1').status, 403, 'not allowed by default');
    assert.equal(P.decide('CONNECT statsig.anthropic.com:443 HTTP/1.1', { allowlist: P.buildAllowlist(['statsig.anthropic.com:443']) }).allow, true);
    for (const e of ['*.anthropic.com:443', '1.1.1.1:443', 'localhost:443', 'api.anthropic.com', 'api.anthropic.com:0', 'a b:443']) assert.throws(() => P.parseAllowEntry(e), new RegExp('invalid allowlist'), e);
  });

  test('the command line refuses unknown arguments and relative paths', () => {
    assert.throws(() => P.parseArgs(['--socket', 'rel.sock', '--log', '/tmp/l']), /absolute/);
    assert.throws(() => P.parseArgs(['--socket', '/tmp/s', '--log', '/tmp/l', '--open-all', 'x']), /unknown argument/);
    assert.throws(() => P.parseArgs(['--socket', '/tmp/s', '--log', '/tmp/l', '--max-tunnels', '-1']), /positive integer/);
    const o = P.parseArgs(['--socket', '/tmp/s', '--log', '/tmp/l', '--max-tunnels', '2', '--idle-ms', '500', '--max-bytes', '100']);
    assert.deepEqual(o.limits, { maxTunnels: 2, idleMs: 500, maxTotalBytes: 100 });
  });
});

/* ------------------------------------------------------------------ */
describe('provider egress - proxy socket behaviour (loopback only, injected upstream)', () => {
  let upstream: net.Server;
  let upstreamPort = 0;
  const connects: Array<{ host: string; port: number }> = [];
  before(async () => {
    upstream = net.createServer((s) => s.on('data', (c) => s.write(Buffer.concat([Buffer.from('echo:'), c]))));
    await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', () => r()));
    upstreamPort = (upstream.address() as net.AddressInfo).port;
  });
  after(() => upstream.close());

  async function withProxy(fn: (port: number, logFile: string) => Promise<void>, limits: any = {}) {
    const dir = tmpDir();
    const logFile = path.join(dir, 'egress.log');
    const { server } = P.createProxy({ logPath: logFile, limits, connect: (o: any) => (connects.push(o), net.connect({ host: '127.0.0.1', port: upstreamPort })) });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    try {
      await fn((server.address() as net.AddressInfo).port, logFile);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }
  const exchange = (port: number, send: string, then?: string) =>
    new Promise<string>((resolve) => {
      const c = net.connect({ host: '127.0.0.1', port });
      let got = '';
      let sent = false;
      c.on('data', (d) => {
        got += d.toString('latin1');
        if (then && !sent && got.includes('\r\n\r\n')) {
          sent = true;
          c.write(then);
          setTimeout(() => c.end(), 150);
        }
      });
      c.on('close', () => resolve(got));
      c.on('error', () => resolve(got));
      c.write(send);
      if (!then) setTimeout(() => c.end(), 1500);
    });
  const waitLog = async (f: string, n: number) => {
    for (let i = 0; i < 50 && (!fs.existsSync(f) || fs.readFileSync(f, 'utf8').trim().split('\n').length < n); i++) await new Promise((r) => setTimeout(r, 50));
    return fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  };

  test('an allowlisted tunnel relays bytes and logs only destination, decision and byte counts', async () => {
    await withProxy(async (port, logFile) => {
      connects.length = 0;
      const got = await exchange(port, 'CONNECT api.anthropic.com:443 HTTP/1.1\r\nHost: api.anthropic.com:443\r\nX-Probe-Secret: s3cr3t-header\r\n\r\n', 'payload-s3cr3t');
      assert.match(got, /^HTTP\/1\.1 200 Connection Established\r\n\r\n/);
      assert.match(got, /echo:payload-s3cr3t/);
      assert.deepEqual(connects, [{ host: 'api.anthropic.com', port: 443 }]);
      const [e] = await waitLog(logFile, 1);
      assert.equal(e.decision, 'allowed');
      assert.equal(e.host, 'api.anthropic.com');
      assert.equal(e.bytes_up, 'payload-s3cr3t'.length);
      assert.equal(e.bytes_down, 'echo:payload-s3cr3t'.length);
      assert.deepEqual(Object.keys(e).sort(), ['bytes_down', 'bytes_up', 'decision', 'duration_ms', 'host', 'method', 'port', 'reason', 'status', 'time']);
      const raw = fs.readFileSync(logFile, 'utf8');
      assert.doesNotMatch(raw, /s3cr3t|X-Probe|Host:/, 'no header or payload is ever logged');
    });
  });

  test('refused requests never resolve or connect anything and are logged as denied', async () => {
    await withProxy(async (port, logFile) => {
      connects.length = 0;
      assert.match(await exchange(port, 'CONNECT example.com:443 HTTP/1.1\r\n\r\n'), /^HTTP\/1\.1 403 /);
      assert.match(await exchange(port, 'GET http://example.com/ HTTP/1.1\r\nHost: example.com\r\n\r\n'), /^HTTP\/1\.1 405 /);
      assert.match(await exchange(port, 'garbage\r\n\r\n'), /^HTTP\/1\.1 400 /);
      assert.match(await exchange(port, `CONNECT api.anthropic.com:443 HTTP/1.1\r\nX: ${'a'.repeat(9000)}`), /^HTTP\/1\.1 431 /);
      assert.deepEqual(connects, [], 'no upstream connection was opened for any refused request');
      const entries = await waitLog(logFile, 4);
      assert.ok(entries.every((e) => e.decision === 'denied' && e.bytes_up === 0 && e.bytes_down === 0));
      assert.deepEqual(entries.map((e) => e.status), [403, 405, 400, 431]);
    });
  });

  test('the total byte budget closes a tunnel', async () => {
    await withProxy(
      async (port, logFile) => {
        const got = await exchange(port, 'CONNECT api.anthropic.com:443 HTTP/1.1\r\n\r\n', 'x'.repeat(64));
        assert.doesNotMatch(got, /echo:/, 'nothing relayed past the budget');
        const [e] = await waitLog(logFile, 1);
        assert.match(e.reason, /byte budget/);
      },
      { maxTotalBytes: 16 },
    );
  });
});

/* ------------------------------------------------------------------ */
describe('provider egress - sandbox network arguments', () => {
  test('none is the default; egress needs an absolute socket; a credential file only with egress', () => {
    assert.deepEqual(sandboxNetArgs(), ['--net', 'none']);
    assert.deepEqual(sandboxNetArgs({ egressSocket: '/tmp/revforge-egress-0123456789ab/egress.sock' }), ['--net', 'egress', '/tmp/revforge-egress-0123456789ab/egress.sock']);
    assert.deepEqual(sandboxNetArgs({ egressSocket: '/tmp/s.sock', envFile: '/home/u/.revforge/anthropic.key' }), ['--net', 'egress', '/tmp/s.sock', '--env-file', '/home/u/.revforge/anthropic.key']);
    assert.throws(() => sandboxNetArgs({ envFile: '/home/u/k' }), /only accepted with provider egress/);
    assert.throws(() => sandboxNetArgs({ egressSocket: 'relative.sock' }), /absolute WSL path/);
    assert.throws(() => sandboxNetArgs({ egressSocket: '/tmp/s', envFile: 'C:\\key' }), /absolute WSL path/);
  });

  test('the sandbox script keeps none as default, fails closed without ip/socat and never logs the credential', () => {
    const s = fs.readFileSync(path.join(FORWARD_DIR, 'integrations', 'bmad', 'isolation', 'sandbox.sh'), 'utf8');
    assert.match(s, /NET=none/);
    assert.match(s, /\/usr\/bin\/env -i PATH=\/usr\/bin:\/bin HOME=\/tmp LANG=C\.UTF-8 TMPDIR=\/tmp "\$@"/, 'none mode keeps env -i');
    assert.match(s, /\/usr\/sbin\/ip \(iproute2\) is missing; egress mode fails closed/);
    assert.match(s, /\/usr\/bin\/socat is missing; egress mode fails closed/);
    assert.match(s, /accessible by group or others/);
    assert.match(s, /TCP-LISTEN:3128,bind=127\.0\.0\.1,fork,reuseaddr UNIX-CONNECT:\/work\/egress\.sock/);
    assert.doesNotMatch(s, /echo[^\n]*\$val|echo[^\n]*CRED\[|set -x/, 'no credential value is ever echoed');
  });
});

/** A report that would count: executed, every check passed, current script hashes. */
const passingReport = (ctx: any, over: Partial<EgressTestReport> = {}): EgressTestReport => ({
  contract: 'bmad/egress-test-report',
  contract_version: '1.0',
  executed_at: new Date().toISOString(),
  executed: true,
  reason_not_executed: null,
  synthetic_only: true,
  credential_sent: false,
  proxy_sha256: sha256File(egressProxyScript(ctx)),
  sandbox_sha256: sha256File(sandboxScript(ctx)),
  allowlist: ['api.anthropic.com:443'],
  host: { platform: 'test', distro: 'Ubuntu' },
  prerequisites: [{ name: 'socat', available: true, detail: '/usr/bin/socat' }],
  host_checks: [{ test: 'proxy_script_present', passed: true, detail: 'x' }],
  sandbox_checks: [{ test: 'allowlisted_provider_reachable', passed: true, detail: 'x' }, { test: 'non_allowlisted_host_refused', passed: true, detail: 'x' }],
  proxy_log: { sha256: 'b'.repeat(64), lines: 2, allowed: 1, denied: 1, allowed_destinations: ['api.anthropic.com:443'], denied_destinations: ['example.com:443'] },
  all_passed: true,
  status: 'EGRESS_VERIFIED',
  ...over,
});

/* ------------------------------------------------------------------ */
describe('provider egress - self-test report and evidence', () => {
  const ctx = loadContext({ forwardDir: FORWARD_DIR });
  const passing = (over: Partial<EgressTestReport> = {}) => passingReport(ctx, over);
  const write = (r: any) => {
    const f = path.join(tmpDir(), 'egress-test-report.json');
    fs.writeFileSync(f, JSON.stringify(r));
    return f;
  };

  test('a current, executed, fully passed report for the current scripts is verified evidence', () => {
    const r = passing();
    assert.deepEqual(ctx.contracts.validate('bmad/egress-test-report', r).errors, []);
    const ev = egressEvidence(ctx, new Date(), write(r));
    assert.deepEqual(ev.problems, []);
    assert.equal(ev.verified, true);
  });

  test('missing, not executed, failed, stale-hash, old, widened or forged reports are not evidence', () => {
    assert.match(egressEvidence(ctx, new Date(), path.join(tmpDir(), 'none.json')).problems[0], /no egress test report/);
    const cases: Array<[any, RegExp]> = [
      [passing({ executed: false, reason_not_executed: 'prerequisites missing in WSL (Ubuntu): socat', all_passed: false, status: 'EGRESS_NOT_EXECUTED', sandbox_checks: [] }), /not executed: prerequisites missing/],
      [passing({ all_passed: false, status: 'EGRESS_NOT_VERIFIED', sandbox_checks: [{ test: 'direct_connection_blocked', passed: false, detail: 'x' }] }), /checks failed: direct_connection_blocked/],
      [passing({ sandbox_checks: [{ test: 'dns_unavailable', passed: false, detail: 'x' }] }), /checks failed: dns_unavailable/],
      [passing({ proxy_sha256: 'c'.repeat(64) }), /egress-proxy\.mjs changed/],
      [passing({ sandbox_sha256: 'd'.repeat(64) }), /sandbox\.sh changed/],
      [passing({ executed_at: new Date(Date.now() - 8 * 24 * 3600000).toISOString() }), /older than 7 days/],
      [passing({ allowlist: ['api.anthropic.com:443', 'example.com:443'] }), /not exactly/],
      [{ ...passing(), credential_sent: true }, /violates|credential was sent/],
      [{ ...passing(), extra: 1 }, /violates/],
    ];
    for (const [r, re] of cases) {
      const ev = egressEvidence(ctx, new Date(), write(r));
      assert.equal(ev.verified, false, String(re));
      assert.match(ev.problems.join(' | '), re);
    }
  });

  test('missing prerequisites are reported as not executed with the precise reason, never as a pass', () => {
    const fail: Probe = { run: () => ({ ok: false, out: '' }) };
    const r = verifyEgress(ctx, fail, { write: false });
    assert.equal(r.executed, false);
    assert.equal(r.all_passed, false);
    assert.equal(r.status, 'EGRESS_NOT_EXECUTED');
    assert.match(String(r.reason_not_executed), process.platform === 'win32' ? /wsl2_distribution/ : /node, socat/);
    assert.deepEqual(r.sandbox_checks, []);
    assert.deepEqual(ctx.contracts.validate('bmad/egress-test-report', r).errors, []);
    // WSL present, but node and socat missing inside it.
    const partial: Probe = {
      run: (cmd, args) => {
        const s = args.join(' ');
        if (cmd === 'wsl.exe' && args[0] === '-l') return { ok: true, out: '  NAME      STATE           VERSION\n* Ubuntu    Running         2' };
        if (/node|socat/.test(s)) return { ok: false, out: '' };
        if (/USERNS_OK/.test(s)) return { ok: true, out: 'USERNS_OK' };
        return { ok: true, out: '/usr/bin/x' };
      },
    };
    const p = verifyEgress(ctx, partial, { write: false });
    assert.equal(p.executed, false);
    assert.match(String(p.reason_not_executed), /prerequisites missing.*: node, socat$/);
    assert.equal(egressEvidence(ctx, new Date(), write(p)).verified, false);
  });

  test('the proxy log summary counts decisions and flags unexpected fields', () => {
    const lines = [
      { time: 't', host: 'api.anthropic.com', port: 443, method: 'CONNECT', decision: 'allowed', status: 200, reason: 'ok', bytes_up: 10, bytes_down: 20, duration_ms: 1 },
      { time: 't', host: 'example.com', port: 443, method: 'CONNECT', decision: 'denied', status: 403, reason: 'no', bytes_up: 0, bytes_down: 0, duration_ms: 1 },
      { time: 't', host: null, port: null, decision: 'denied', status: 400, reason: 'bad', bytes_up: 0, bytes_down: 0, duration_ms: 1, header: 'Authorization: x' },
    ];
    const s = summarizeEgressLog(lines.map((l) => JSON.stringify(l)).join('\n') + '\nnot json\n');
    assert.equal(s.entries.length, 2);
    assert.equal(s.malformed, 2);
    assert.match(s.sha256, /^[0-9a-f]{64}$/);
  });

  test('the shipped configuration has no credential path; LIVE stays unrequested', () => {
    assert.equal(providerCredentialFile(ctx), null);
    const b = JSON.parse(fs.readFileSync(path.join(FORWARD_DIR, 'integrations', 'bmad', 'bindings.json'), 'utf8'));
    assert.equal(b.live_execution.requested, false);
  });
});

/* ------------------------------------------------------------------ */
const testedIso = { tested: true, report: { executed_at: new Date().toISOString(), sandbox_sha256: 'a'.repeat(64) } as any, problems: [] };
const verifiedEgress = { verified: true, report: { executed_at: new Date().toISOString(), proxy_sha256: 'e'.repeat(64), sandbox_sha256: 'f'.repeat(64) } as any, problems: [] };
const unverifiedEgress = { verified: false, report: null, problems: ['egress-proxy.mjs changed since it was verified'] };
const hostWithRunner: any = { primitives: { linux_claude: { available: true }, linux_node: { available: true } } };
const hostWithoutRunner: any = { primitives: { linux_claude: { available: false }, linux_node: { available: false } } };
function signedDisclosure(f: Fixture, a: any, kp: KP, signer: string) {
  const s = { ...a, signer_id: signer, role: 'data_owner', signed_at: new Date().toISOString() };
  const file = path.join(f.repoRoot, `ada-egress-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-ai-disclosure-authorization', authorization: s, signature: { algorithm: 'ed25519', value: signText(canonicalize(s), kp) } }));
  return file;
}

describe('provider egress - preflight network checks', () => {
  test('with verified egress on a tested boundary, network_isolation passes; LIVE is still refused by the other checks', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const claude = prepareDisclosure(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflows: ['bmad-prd'], models: ['claude-opus-5-5'], purpose: 'Synthetic requirements drafting for the test scope', classification: 'confidential' });
    assert.equal(importDisclosure(wfOf(ctx), signedDisclosure(f, claude, dk.dataowner, DESIGN_SIGNERS.dataowner)).imported, true);
    const r = preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, egress: verifiedEgress, assessment: hostWithRunner });
    const by = (id: string) => r.checks.find((c: any) => c.id === id);
    assert.equal(by('network_isolation').ok, true, by('network_isolation').detail);
    assert.match(by('network_isolation').detail, /provider egress verified/);
    assert.equal(by('enforceable_launch_boundary').ok, true, by('enforceable_launch_boundary').detail);
    assert.equal(r.launch_boundary.network_enforcement, true);
    assert.equal(by('provider_authorization').ok, true);
    assert.equal(by('runtime_execution_authorization').ok, false, 'live_execution.requested stays false and the executor is not verified');
    assert.equal(r.launch_permitted, false, 'egress never authorizes a launch by itself');
    assert.equal(r.egress.verified, true);
    const { record_id: _id, ...sealed } = r;
    assert.deepEqual(ctx.contracts.validate('bmad/execution-preflight', sealed).errors, []);
  });

  test('an unverified or stale egress component keeps network_isolation and the launch boundary failing', () => {
    const { ctx } = designFixture(fixtures);
    const r = preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, egress: unverifiedEgress, assessment: hostWithRunner });
    const by = (id: string) => r.checks.find((c: any) => c.id === id);
    assert.equal(by('network_isolation').ok, false);
    assert.match(by('network_isolation').detail, /exists but is not verified \(egress-proxy\.mjs changed since it was verified\)/);
    assert.equal(by('enforceable_launch_boundary').ok, false);
    assert.match(by('enforceable_launch_boundary').detail, /exists but is not verified on this host/);
    assert.equal(r.launch_boundary.network_enforcement, false);
    assert.equal(r.execution_status, 'EXECUTION_UNSUPPORTED');
  });

  test('verified egress never compensates for an untested filesystem boundary or a missing runner', () => {
    const { ctx } = designFixture(fixtures);
    const untested = preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', isolation: { tested: false, report: null, problems: ['no isolation test report'] }, egress: verifiedEgress, assessment: hostWithRunner });
    assert.equal(untested.checks.find((c: any) => c.id === 'network_isolation').ok, false);
    assert.equal(untested.checks.find((c: any) => c.id === 'enforceable_launch_boundary').ok, false);
    const noRunner = preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, egress: verifiedEgress, assessment: hostWithoutRunner });
    assert.equal(noRunner.checks.find((c: any) => c.id === 'network_isolation').ok, true);
    assert.equal(noRunner.checks.find((c: any) => c.id === 'enforceable_launch_boundary').ok, false);
    const b = launchBoundary(null, { tested: true, problems: [], runnerInside: true, egress: { verified: false, problems: [] } });
    assert.equal(b.enforceable, false);
    assert.ok(b.gaps.some((g) => /provider-egress component/.test(g)));
  });

  test('a recorded report with a stale script hash is not evidence, so the preflight network check fails', () => {
    const { ctx } = designFixture(fixtures);
    const f = path.join(tmpDir(), 'egress-test-report.json');
    fs.writeFileSync(f, JSON.stringify(passingReport(ctx)));
    const good = egressEvidence(ctx, new Date(), f);
    assert.equal(good.verified, true, good.problems.join('; '));
    assert.equal(preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, egress: good, assessment: hostWithRunner }).checks.find((c: any) => c.id === 'network_isolation').ok, true);
    fs.writeFileSync(f, JSON.stringify(passingReport(ctx, { sandbox_sha256: '0'.repeat(64) })));
    const stale = egressEvidence(ctx, new Date(), f);
    assert.equal(stale.verified, false);
    const r = preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, egress: stale, assessment: hostWithRunner });
    const n = r.checks.find((c: any) => c.id === 'network_isolation');
    assert.equal(n.ok, false);
    assert.match(n.detail, /sandbox\.sh changed since the egress self-test/);
  });
});

/* ------------------------------------------------------------------ */
describe('provider egress - LIVE runner wiring (injected sandbox and proxy)', () => {
  const MARKER = 'REVFORGE-SYNTHETIC-NOT-A-KEY-RUNNER-TEST';
  function setup() {
    const { ctx } = designFixture(fixtures);
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, 'A.cbl'), 'x');
    fs.writeFileSync(path.join(dir, 'in.json'), '{}');
    const keyFile = path.join(dir, 'anthropic.key');
    fs.writeFileSync(keyFile, `ANTHROPIC_API_KEY=${MARKER}\n`, { mode: 0o600 });
    const plan = { src: [{ source: path.join(dir, 'A.cbl'), dest: 'A.cbl' }], inputs: [{ source: path.join(dir, 'in.json'), dest: 'mapped/in.json' }] };
    const manifest = { mode: 'LIVE', binding_id: 'BMAD-PRD', workflow_id: 'bmad-prd', scope: BRAVO, command: { args: ['-p', 'x', '--restricted'] }, output_dir: null };
    const calls: string[] = [];
    const summary: EgressSummary = { proxy_sha256: 'a'.repeat(64), sandbox_sha256: 'b'.repeat(64), allowlist: ['api.anthropic.com:443'], started_at: 't0', stopped_at: 't1', log_sha256: 'c'.repeat(64), log_lines: 3, connections_allowed: 2, connections_denied: 1, allowed_destinations: ['api.anthropic.com:443'], denied_destinations: ['example.com:443'], bytes_up: 100, bytes_down: 200, malformed_log_lines: 0 };
    const starter = (_c: any, o: { distro: string | null }): EgressProxyHandle => {
      calls.push(`start ${o.distro}`);
      return { id: '0123456789abcdef', dir: '/tmp/revforge-egress-0123456789abcdef', socket: '/tmp/revforge-egress-0123456789abcdef/egress.sock', log: '/tmp/revforge-egress-0123456789abcdef/egress.log', allowlist: ['api.anthropic.com:443'], started_at: 't0', stop: () => (calls.push('stop'), summary) };
    };
    return { ctx, dir, keyFile: wslPath(keyFile), plan, manifest, calls, starter, summary };
  }

  test('without a configured credential file the runner refuses before starting the proxy or the sandbox', () => {
    const s = setup();
    let ran = false;
    const out = launchPlanned(wfOf(s.ctx), s.manifest, s.plan, { credentialFile: null, egress: s.starter, sandbox: () => ((ran = true), { exit_code: 0, stdout: '', stderr: '' }), workspaceRoot: s.dir });
    assert.equal(out.exit_code, 126);
    assert.match(out.error!, /no provider credential file is configured/);
    assert.deepEqual(s.calls, []);
    assert.equal(ran, false);
    assert.equal(launchPlanned(wfOf(s.ctx), s.manifest, s.plan, { credentialFile: 'relative/key', egress: s.starter, workspaceRoot: s.dir }).exit_code, 126);
  });

  test('a LIVE launch starts the proxy, runs the sandbox in egress mode with the credential path, stops the proxy and returns its summary', () => {
    const s = setup();
    let seen: any = null;
    const out = launchPlanned(wfOf(s.ctx), s.manifest, s.plan, {
      credentialFile: s.keyFile,
      distro: 'Ubuntu',
      egress: s.starter,
      sandbox: (_c, ws, argv, distro, _t, netOpts) => {
        s.calls.push('sandbox');
        seen = { ws, argv, distro, netOpts };
        return { exit_code: 3, stdout: 'x', stderr: 'workflow failed' };
      },
      workspaceRoot: s.dir,
    });
    assert.deepEqual(s.calls, ['start Ubuntu', 'sandbox', 'stop']);
    assert.deepEqual(seen.netOpts, { egressSocket: '/tmp/revforge-egress-0123456789abcdef/egress.sock', envFile: s.keyFile });
    assert.deepEqual(sandboxNetArgs(seen.netOpts).slice(0, 3), ['--net', 'egress', '/tmp/revforge-egress-0123456789abcdef/egress.sock']);
    assert.equal(seen.distro, 'Ubuntu');
    assert.equal(out.exit_code, 3);
    assert.deepEqual(out.egress, s.summary);
  });

  test('the proxy is stopped when the sandbox throws, and the sandbox never runs when the proxy fails to start', () => {
    const s = setup();
    const out = launchPlanned(wfOf(s.ctx), s.manifest, s.plan, { credentialFile: s.keyFile, egress: s.starter, sandbox: () => { throw new Error('boom'); }, workspaceRoot: s.dir });
    assert.equal(out.exit_code, 125);
    assert.deepEqual(s.calls, ['start null', 'stop']);
    assert.deepEqual(out.egress, s.summary);
    let ran = false;
    const out2 = launchPlanned(wfOf(s.ctx), s.manifest, s.plan, { credentialFile: s.keyFile, egress: () => { throw new Error('no socket within 10 s'); }, sandbox: () => ((ran = true), { exit_code: 0, stdout: '', stderr: '' }), workspaceRoot: s.dir });
    assert.equal(out2.exit_code, 125);
    assert.match(out2.error!, /provider egress proxy failed to start/);
    assert.equal(ran, false);
  });

  test('the egress summary is sealed with the execution; the credential value appears in no record, audit entry or outcome', () => {
    const s = setup();
    const out = launchPlanned(wfOf(s.ctx), s.manifest, s.plan, { credentialFile: s.keyFile, egress: s.starter, sandbox: () => ({ exit_code: 1, stdout: '', stderr: 'failed' }), workspaceRoot: s.dir });
    const wf = wfOf(s.ctx);
    const h = handleExecutionOutcome(wf, 'BPK-EGRESS-TEST', out);
    assert.equal(h.status, 'failed');
    const bex = wf.store.readRecord('bmad', `${h.execution_record}.json`);
    assert.match(bex.egress_record, /^BEG-\d{4}$/);
    assert.equal(bex.egress.log_sha256, 'c'.repeat(64));
    const beg = wf.store.readRecord('bmad', `${bex.egress_record}.json`);
    assert.equal(beg.egress.connections_allowed, 2);
    assert.equal(beg.egress.connections_denied, 1);
    assert.ok(wf.store.readAudit().some((e) => e.event === 'bmad_egress_recorded'));
    assert.equal(bmadSummary(wf).records_intact, true, 'BEG and BEX records are sealed');
    const everything = [JSON.stringify(out), ...wf.store.list('bmad').map((f) => fs.readFileSync(wf.store.p('bmad', f), 'utf8')), JSON.stringify(wf.store.readAudit())].join('\n');
    assert.ok(!everything.includes(MARKER), 'the credential value is never read or recorded');
    assert.ok(!everything.includes('ANTHROPIC_API_KEY='), 'no credential line is recorded');
  });

  test('the runner refuses before any launch when the plan is refused (no proxy, no sandbox)', () => {
    const s = setup();
    let ran = false;
    const out = sandboxRunner(wfOf(s.ctx), { credentialFile: s.keyFile, egress: s.starter, sandbox: () => ((ran = true), { exit_code: 0, stdout: '', stderr: '' }) })({ mode: 'LIVE', preflight_id: null, authorization_id: null, workflow_id: 'bmad-prd', scope: BRAVO, inputs: [] });
    assert.equal(out.exit_code, 126);
    assert.deepEqual(s.calls, []);
    assert.equal(ran, false);
  });

  test('the runtime never reads the credential file', () => {
    const src = ['runner.ts', '../isolation/egress.ts', '../isolation/isolation.ts'].map((f) => fs.readFileSync(path.join(FORWARD_DIR, 'runtime', 'src', 'bmad', f), 'utf8')).join('\n');
    assert.doesNotMatch(src, /readFileSync\([^)]*(credential|envFile|keyFile)/i);
  });
});

/* ------------------------------------------------------------------ */
describe('provider egress - WSL (executed when the prerequisites exist)', () => {
  const ctx = loadContext({ forwardDir: FORWARD_DIR });
  const pre = egressPrerequisites();
  const missing = pre.items.filter((p) => !p.available).map((p) => p.name);
  const skip = missing.length ? `WSL egress prerequisites missing: ${missing.join(', ')} (install in WSL: sudo apt-get install -y nodejs npm socat iproute2)` : false;

  test('sandbox.sh refuses an env file that is group/world readable, has no allowlisted key, or is used with --net none; the value is never printed', { skip }, () => {
    const shell = linuxShell(pre.distro);
    const script = wslPath(sandboxScript(ctx));
    const r = shell.run(
      'set -u; S="$1"; T=$(mktemp -d); mkdir "$T/s" "$T/i" "$T/o"; umask 022; printf "ANTHROPIC_API_KEY=SYNTH-VALUE-XYZ\\n" > "$T/open.env"; umask 077; printf "OTHER=1\\n" > "$T/other.env"; printf "ANTHROPIC_API_KEY=SYNTH-VALUE-XYZ\\n" > "$T/ok.env"; ' +
        'python3 -c "import socket,sys,time; s=socket.socket(socket.AF_UNIX); s.bind(sys.argv[1]); time.sleep(6)" "$T/p.sock" & sleep 0.5; ' +
        'bash "$S" "$T/s" "$T/i" "$T/o" --net egress "$T/p.sock" --env-file "$T/open.env" -- /usr/bin/true; echo "RC1=$?"; ' +
        'bash "$S" "$T/s" "$T/i" "$T/o" --net egress "$T/p.sock" --env-file "$T/other.env" -- /usr/bin/true; echo "RC2=$?"; ' +
        'bash "$S" "$T/s" "$T/i" "$T/o" --env-file "$T/ok.env" -- /usr/bin/true; echo "RC3=$?"; ' +
        'bash "$S" "$T/s" "$T/i" "$T/o" --net egress "$T/s" -- /usr/bin/true; echo "RC4=$?"; ' +
        'bash "$S" "$T/s" "$T/i" "$T/o" --net egress "$T/p.sock" --env-file "$T/ok.env" -- /usr/bin/env; echo "RC5=$?"; wait; rm -rf "$T"',
      [script],
      120000,
    );
    for (const rc of ['RC1=68', 'RC2=68', 'RC3=68', 'RC4=67', 'RC5=0']) assert.ok(r.stdout.includes(rc), `${rc}: ${r.stdout.slice(0, 600)} ${r.stderr.slice(0, 600)}`);
    assert.match(r.stderr, /accessible by group or others \(mode 644\)/);
    assert.match(r.stderr, /no allowlisted entry/);
    assert.match(r.stderr, /only accepted with --net egress/);
    assert.match(r.stderr, /not an existing Unix socket/);
    // RC5: the dummy socket does not serve, but the environment of the command is allowlisted and carries the key.
    assert.match(r.stdout, /ANTHROPIC_API_KEY=SYNTH-VALUE-XYZ[\s\S]*RC5=0/);
    assert.doesNotMatch(r.stderr, /SYNTH-VALUE-XYZ/, 'the value never reaches stderr');
    const env = r.stdout.split('RC4=')[1] ?? '';
    for (const l of env.split('\n').filter((x) => /^[A-Za-z_]+=/.test(x))) assert.match(l, /^(PATH|HOME|LANG|TMPDIR|HTTPS_PROXY|HTTP_PROXY|https_proxy|http_proxy|ANTHROPIC_API_KEY|PWD|SHLVL|_)=/, l);
  });

  test('the executed egress self-test passes on this host (synthetic data, no credential sent)', { skip }, () => {
    const r = verifyEgress(ctx, undefined, { write: false });
    assert.equal(r.credential_sent, false);
    assert.equal(r.executed, true, String(r.reason_not_executed));
    const failed = [...r.host_checks, ...r.sandbox_checks].filter((c) => !c.passed);
    assert.deepEqual(failed, [], JSON.stringify(failed));
    assert.equal(r.status, 'EGRESS_VERIFIED');
    assert.deepEqual(r.proxy_log?.allowed_destinations, ['api.anthropic.com:443']);
  });
});
