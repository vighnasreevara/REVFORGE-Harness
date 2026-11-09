/**
 * BMad end-to-end integration tests: the LIVE runner adapter, F2/F6
 * independent evidence, BMad drafts in forward dispatch packets, the governed
 * lifecycle as a controlled SIMULATION, and the closed local-generation
 * bypass. Test doubles never produce counted BMad execution: a SIMULATION is
 * never sealed and never BMAD_COMPLIANT. Synthetic fixtures and keys only; the
 * real run is used read only.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { main } from '../runtime/src/cli';
import { bmadLifecycleEvidence, generationAuthorized } from '../runtime/src/orchestrator/orchestrator';
import { canonicalize } from '../runtime/src/approval/canonical';
import { importDisclosure, prepareDisclosure } from '../runtime/src/disclosure/disclosure';
import { bmadReceipts, mockResult, preparePacket } from '../runtime/src/bmad/adapter';
import { handleExecutionOutcome } from '../runtime/src/bmad/executor';
import { preflight } from '../runtime/src/bmad/preflight';
import { governanceVerdict, governedRun, independentEvidence, StageDeps, verifiedDrafts } from '../runtime/src/bmad/governance';
import { planLaunch, sandboxArgv, sandboxRunner } from '../runtime/src/bmad/runner';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { KP, signText, wfOf } from './helpers/g2fixture';
import { BRAVO, DESIGN_SIGNERS, designFixture } from './helpers/designfixture';

const REPO = path.resolve(FORWARD_DIR, '..');
const fixtures: Fixture[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
});
afterEach(() => {
  while (fixtures.length) cleanup(fixtures.pop()!);
});

function signedDisclosure(f: Fixture, a: any, kp: KP, signer: string, role = 'data_owner') {
  const s = { ...a, signer_id: signer, role, signed_at: new Date().toISOString() };
  const file = path.join(f.repoRoot, `ada-e2e-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-ai-disclosure-authorization', authorization: s, signature: { algorithm: 'ed25519', value: signText(canonicalize(s), kp) } }));
  return file;
}
const accepted = { f2: { status: 'ACCEPTED' as const, units: ['BRAVO02'], missing: [] }, f6: { status: 'ACCEPTED' as const, receipts: ['RCP-TEST'] } };
/** Test doubles for every stage operation: permitted preflight, a packet, a validated execution and a verified stage. */
const passing = (calls: string[], over: Partial<StageDeps> = {}): StageDeps => ({
  preflight: (_w, b) => (calls.push(`preflight ${b}`), { record_id: null, launch_permitted: true, authorization_id: 'ADA-test-double' }),
  prepare: (_w, b) => (calls.push(`prepare ${b}`), { packet_id: `BPK-${b}` }),
  execute: (_w, p) => (calls.push(`execute ${p}`), { status: 'completed_validated', execution_record: `BRC-${p}`, receipt: { receipt_id: `BRC-${p}` } }),
  verify: () => ({ status: 'RECEIPT_VERIFIED', reasons: ['test double'] }),
  independent: () => accepted,
  ...over,
});
const runnerDouble = () => ({ exit_code: 0, stdout_sha256: null, result_file: null });

describe('BMad end-to-end - governed lifecycle (controlled SIMULATION, never evidence)', () => {
  test('a fully passing simulated lifecycle is reported as a simulation, never sealed and never BMAD_COMPLIANT', () => {
    const { ctx } = designFixture(fixtures);
    const before = wfOf(ctx).store.list('bmad').length;
    const calls: string[] = [];
    const r = governedRun(wfOf(ctx), BRAVO, { runner: runnerDouble, simulation: true, deps: passing(calls) });
    assert.equal(r.execution_mode, 'SIMULATION');
    assert.equal(r.simulated_outcome, 'ALL_STAGES_PASSED_IN_SIMULATION');
    assert.equal(r.status, 'BMAD_BLOCKED', 'a simulation never makes a scope compliant');
    assert.equal(r.record_id, null);
    assert.equal(wfOf(ctx).store.list('bmad').length, before, 'nothing was recorded');
    assert.deepEqual(r.stages.map((s: any) => s.status), Array(6).fill('RECEIPT_VERIFIED'));
    assert.equal(calls.filter((c) => c.startsWith('preflight')).length, 6, 'every stage passes its own preflight first');
    assert.equal(governanceVerdict(wfOf(ctx), BRAVO).status, 'BMAD_BLOCKED');
  });

  test('stage test doubles are refused outside an explicit simulation', () => {
    const { ctx } = designFixture(fixtures);
    assert.throws(() => governedRun(wfOf(ctx), BRAVO, { runner: runnerDouble, deps: passing([]) }), /simulation: true/);
  });

  test('a failed BMad stage stops the lifecycle; later stages are not attempted', () => {
    const { ctx } = designFixture(fixtures);
    const calls: string[] = [];
    const r = governedRun(wfOf(ctx), BRAVO, { runner: runnerDouble, simulation: true, deps: passing(calls, { execute: (_w, p) => (calls.push(`execute ${p}`), p === 'BPK-BMAD-ARCH' ? { status: 'failed', execution_record: 'BEX-test', receipt: null } : { status: 'completed_validated', execution_record: 'x', receipt: { receipt_id: 'x' } }) }) });
    assert.deepEqual(r.stages.map((s: any) => s.status), ['RECEIPT_VERIFIED', 'EXECUTION_FAILED', 'NOT_ATTEMPTED', 'NOT_ATTEMPTED', 'NOT_ATTEMPTED', 'NOT_ATTEMPTED']);
    assert.ok(!calls.some((c) => /EPICS|SPRINT|BUILD|REVIEW/.test(c)));
  });

  test('missing F2 data-mapping evidence blocks architecture; missing F6 test evidence blocks review', () => {
    const { ctx } = designFixture(fixtures);
    const noF2 = governedRun(wfOf(ctx), BRAVO, { runner: runnerDouble, simulation: true, deps: passing([], { independent: () => ({ ...accepted, f2: { status: 'MISSING', units: ['BRAVO02'], missing: ['BRAVO02'] } }) }) });
    assert.equal(noF2.stages[1].status, 'BLOCKED');
    assert.match(noF2.stages[1].blockers[0], /F2 data-mapping deliveries are not accepted/);
    const noF6 = governedRun(wfOf(ctx), BRAVO, { runner: runnerDouble, simulation: true, deps: passing([], { independent: () => ({ ...accepted, f6: { status: 'MISSING', receipts: [] } }) }) });
    assert.equal(noF6.stages[5].status, 'BLOCKED');
    assert.match(noF6.stages[5].blockers[0], /independent F6 test receipt/);
    assert.equal(noF6.simulated_outcome, 'BLOCKED_IN_SIMULATION');
  });

  test('the governed run never falls back to the local converter', () => {
    const { ctx } = designFixture(fixtures, { approveG1: false });
    const r = governedRun(wfOf(ctx), BRAVO, { runner: null, probe: () => 'probe 1.0' });
    assert.equal(r.fallback, 'none');
    assert.equal(r.local_conversion_invoked, false);
    assert.equal(r.execution_mode, 'LIVE');
    assert.ok(r.independent_evidence.f2 && r.independent_evidence.f6);
    const src = fs.readFileSync(path.join(FORWARD_DIR, 'runtime', 'src', 'bmad', 'governance.ts'), 'utf8') + fs.readFileSync(path.join(FORWARD_DIR, 'runtime', 'src', 'bmad', 'runner.ts'), 'utf8');
    assert.doesNotMatch(src, /from '\.\.\/pilot\//, 'the BMad dispatcher and runner import nothing from the local converter');
  });
});

describe('BMad end-to-end - LIVE runner adapter (sandbox test double)', () => {
  test('the runner refuses without a permitted recorded preflight and a recorded disclosure authorization; the sandbox is never called', () => {
    const { ctx } = designFixture(fixtures);
    let called = false;
    const run = sandboxRunner(wfOf(ctx), { sandbox: () => ((called = true), { exit_code: 0, stdout: '', stderr: '' }) });
    const out = run({ mode: 'LIVE', preflight_id: null, authorization_id: null, workflow_id: 'bmad-prd', scope: BRAVO, inputs: [] });
    assert.equal(out.exit_code, 126);
    assert.match(out.error!, /no recorded preflight/);
    assert.match(out.error!, /no recorded disclosure authorization/);
    assert.equal(called, false);
  });

  test('a refused preflight, a preflight for another scope and an uninstalled workflow definition are refused', () => {
    const { ctx } = designFixture(fixtures);
    const pf = preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', record: true });
    let p = planLaunch(wfOf(ctx), { mode: 'LIVE', preflight_id: pf.record_id, authorization_id: null, workflow_id: 'bmad-prd', scope: BRAVO, inputs: [] });
    assert.ok(p.problems.some((x) => /did not permit the launch/.test(x)));
    p = planLaunch(wfOf(ctx), { mode: 'LIVE', preflight_id: pf.record_id, authorization_id: null, workflow_id: 'bmad-prd', scope: 'programs:OTHER01', inputs: [] });
    assert.ok(p.problems.some((x) => /did not permit|not this launch/.test(x)), 'incorrect scope');
    p = planLaunch(wfOf(ctx), { mode: 'LIVE', preflight_id: pf.record_id, authorization_id: null, workflow_id: 'bmad-not-a-workflow', scope: BRAVO, inputs: [] });
    assert.ok(p.problems.some((x) => /not installed|no installed workspace/.test(x)), 'missing workflow definition');
  });

  test('a stale authorized source hash refuses the launch', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const req = prepareDisclosure(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflows: ['bmad-prd'], models: ['claude-opus-5-5'], purpose: 'Synthetic requirements drafting for the test scope', classification: 'confidential' });
    const imp = importDisclosure(wfOf(ctx), signedDisclosure(f, req, dk.dataowner, DESIGN_SIGNERS.dataowner));
    assert.equal(imp.imported, true);
    assert.ok(ctx.sourceRoot, 'the fixture has a source root');
    const file = path.join(ctx.sourceRoot!, req.source_files[0].path);
    fs.appendFileSync(file, '      * changed after authorization\n');
    const p = planLaunch(wfOf(ctx), { mode: 'LIVE', preflight_id: null, authorization_id: req.authorization_id, workflow_id: 'bmad-prd', scope: BRAVO, inputs: [] });
    assert.ok(p.problems.some((x) => /stale hash/.test(x)), p.problems.join(' | '));
  });

  test('the sandbox command runs Claude Code from the read-only inputs and writes only to /work/out', () => {
    const argv = sandboxArgv({ workflow_id: 'bmad-prd', command: { args: ['-p', 'x', '--restricted', '--disallowedTools', 'WebFetch,WebSearch,Bash,PowerShell'] } });
    assert.equal(argv[0], 'sh');
    assert.match(argv[2], /cd \/work\/inputs/);
    assert.ok(argv.includes('--restricted') && argv.includes('--disallowedTools'));
    assert.match(argv[argv.indexOf('-p') + 1], /\/work\/out/);
  });
});

describe('BMad end-to-end - receipts, drafts and forward consumption', () => {
  test('a MOCK receipt edited to claim LIVE is not sealed and never counts', () => {
    const { ctx } = designFixture(fixtures);
    const p = preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'MOCK');
    const m = mockResult(wfOf(ctx), p.packet_id);
    handleExecutionOutcome(wfOf(ctx), p.packet_id, { exit_code: 0, stdout_sha256: null, result_file: path.resolve(ctx.repoRoot, m.result_file) });
    const rc = bmadReceipts(wfOf(ctx))[0];
    const file = wfOf(ctx).store.p('bmad', `${rc.receipt_id}.json`);
    fs.writeFileSync(file, JSON.stringify({ ...rc, mode: 'LIVE', evidence_status: 'DRAFT_PENDING_HUMAN_APPROVAL' }, null, 2));
    const v = governanceVerdict(wfOf(ctx), BRAVO);
    assert.equal(v.stages[0].status, 'EXECUTED_REJECTED');
    assert.ok(v.stages[0].reasons.some((r: string) => /not sealed/.test(r)));
    assert.deepEqual(verifiedDrafts(wfOf(ctx), 'F3', ['BRAVO02']), [], 'a forged receipt never becomes a forward input');
  });

  test('forward packets receive BMad drafts only as optional inputs of the agents that consume them', () => {
    const { ctx } = designFixture(fixtures);
    for (const a of ['F1', 'F2', 'F6']) assert.deepEqual(verifiedDrafts(wfOf(ctx), a, ['BRAVO02']), [], `${a} never receives BMad drafts`);
    assert.deepEqual(verifiedDrafts(wfOf(ctx), 'F3', ['BRAVO02']), [], 'no verified LIVE receipt exists');
    const ind = independentEvidence(wfOf(ctx), BRAVO);
    assert.ok(['ACCEPTED', 'MISSING'].includes(ind.f2.status) && ['ACCEPTED', 'MISSING'].includes(ind.f6.status));
  });
});

describe('BMad end-to-end - Java generation bypasses are closed (real run read only)', () => {
  test('generation stays unauthorised and a NEW local-generation authorisation is refused BMAD_BLOCKED', () => {
    const { ctx } = designFixture(fixtures);
    const e = bmadLifecycleEvidence(wfOf(ctx), BRAVO, 'sprint');
    assert.equal(e.required, true);
    assert.equal(e.ok, false);
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false);
    const realRun = path.join(FORWARD_DIR, 'runs');
    const src = path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
    const input = path.join(FORWARD_DIR, 'pilot', 'authorizations', 'APPLICATION.authorization-input.json');
    if (!fs.existsSync(realRun) || !fs.existsSync(src) || !fs.existsSync(input)) return;
    process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
    const all = JSON.parse(fs.readFileSync(input, 'utf8'));
    const one = { ...all, authorizations: all.authorizations.filter((a: any) => a.program === 'PORTREAD') };
    const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-e2e-')), 'portread.json');
    fs.writeFileSync(tmp, JSON.stringify(one));
    const latest = fs.readdirSync(realRun).filter((d) => fs.existsSync(path.join(realRun, d, 'workflow', 'state.json'))).sort().pop()!;
    const genDir = path.join(realRun, latest, 'workflow', 'generation');
    const before = fs.readdirSync(genDir).length;
    const err: string[] = [];
    const code = main(['pilot', 'authorize', '--input', tmp], () => undefined, (s) => err.push(s));
    assert.equal(code, 1);
    assert.ok(err.some((s) => /BMAD_BLOCKED/.test(s)), err.join('\n'));
    assert.equal(fs.readdirSync(genDir).length, before, 'no authorisation record was written');
    fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  });
});
