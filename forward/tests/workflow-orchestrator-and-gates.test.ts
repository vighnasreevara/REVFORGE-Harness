import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { runPlan } from '../runtime/src/commands/plan';
import { EXIT, main } from '../runtime/src/cli';
import { AGENTS, checkDefinition, findAgent, REQUIRED_SECTIONS } from '../runtime/src/orchestrator/agents';
import { classifyProgram } from '../runtime/src/orchestrator/classification';
import { acceptedGateIds, evaluateEvidenceCheck, GATE_SCHEME, gateIdOfKey, gateKey, gatePassed, GATES, isLegacyGateScheme, openRun, precheckPassed, PRECHECKS, validateApproval } from '../runtime/src/orchestrator/gates';
import { advance, blockedReport, initWorkflow, loadWorkflow, OrchestratorError, policyRoots, prepare, receiptOutcome, recordReceipt, resume, runGate, runPrecheck, status } from '../runtime/src/orchestrator/orchestrator';
import { canRead, canWrite } from '../runtime/src/orchestrator/permissions';
import { APPROVAL_STATES, findTransition, TRANSITIONS } from '../runtime/src/orchestrator/states';
import { WorkflowStore } from '../runtime/src/orchestrator/store';
import { cleanup, Fixture, FORWARD_DIR, makeFixture } from './helpers/fixture';
import { produceF1, produceF2, readPacket } from './helpers/outputs';

const REAL_AGENTS = path.resolve(FORWARD_DIR, 'agents');
const REAL_SKILLS = path.resolve(FORWARD_DIR, 'skills');
let fx: Fixture;
const fixtures: Fixture[] = [];

function setup(opts: { skillsFor?: string[]; javaAllowed?: boolean; targetDir?: string } = {}) {
  const f = makeFixture();
  fixtures.push(f);
  fs.mkdirSync(path.join(f.repoRoot, '.claude', 'agents'), { recursive: true });
  for (const a of AGENTS) fs.copyFileSync(path.join(REAL_AGENTS, `${a.name}.agent.md`), path.join(f.repoRoot, '.claude', 'agents', `${a.name}.agent.md`));
  for (const id of opts.skillsFor ?? []) for (const s of findAgent(id)!.skills) f.write(`.claude/skills/${s}/SKILL.md`, fs.readFileSync(path.join(REAL_SKILLS, s, 'SKILL.md'), 'utf8'));
  if (opts.javaAllowed !== undefined || opts.targetDir) {
    const cfg = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
    if (opts.javaAllowed !== undefined) cfg.generation.java_generation_allowed = opts.javaAllowed;
    if (opts.targetDir) cfg.orchestrator.java_target_dir = opts.targetDir;
    fs.writeFileSync(f.configPath, JSON.stringify(cfg));
  }
  const ctx = loadContext({ forwardDir: FORWARD_DIR, configPath: f.configPath });
  runPlan(ctx, { runId: 'FWD-T2' });
  return { f, ctx };
}

/** Init + evidence pre-check + EVIDENCE_VALIDATED. */
function validated(opts: Parameters<typeof setup>[0] = {}) {
  const s = setup(opts);
  initWorkflow(s.ctx, 'FWD-T2');
  assert.equal(runPrecheck(loadWorkflow(s.ctx, 'FWD-T2'), 'EVIDENCE').status, 'PASS');
  assert.equal(advance(loadWorkflow(s.ctx, 'FWD-T2'), 'EVIDENCE_VALIDATED').accepted, true);
  return s;
}

/** Writes contract-valid agent outputs (or deliberately altered ones) and a receipt file; returns the receipt path. */
function writeReceipt(f: Fixture, packetId: string, agent: string, opts: { outcome?: string; names?: string[]; extra?: Record<string, unknown>; outputContent?: Record<string, unknown>; outDir?: string; badHash?: boolean } = {}) {
  const a = findAgent(agent)!;
  const pfile = path.join(f.runsDir, 'FWD-T2', 'workflow', 'packets', `${packetId}.json`);
  const packet = fs.existsSync(pfile) ? readPacket(f.repoRoot, f.runsDir, 'FWD-T2', packetId) : null;
  let docs: Record<string, any> = {};
  if (packet && packet.dispatchable) docs = a.id === 'F1' ? produceF1(f.repoRoot, packet) : a.id === 'F2' ? produceF2(f.repoRoot, packet) : {};
  else for (const o of a.outputs) docs[o.name] = { status: 'draft' };
  if (opts.names) {
    const keep: Record<string, any> = {};
    for (const n of opts.names) keep[n] = docs[n] ?? 'class Requirement {}\n';
    docs = keep;
  }
  if (opts.outputContent) {
    const first = Object.keys(docs).find((n) => n.endsWith('.json'))!;
    docs[first] = { ...docs[first], ...opts.outputContent };
  }
  const outDir = opts.outDir ?? (packet ? path.join(f.repoRoot, packet.permissions.output_dir) : path.join(f.runsDir, 'FWD-T2', 'workflow', 'agents', a.id));
  fs.mkdirSync(outDir, { recursive: true });
  const outputs = Object.entries(docs).map(([n, d]) => {
    const p = path.join(outDir, n);
    fs.writeFileSync(p, typeof d === 'string' ? d : JSON.stringify(d, null, 2));
    return { path: path.relative(f.repoRoot, p).split(path.sep).join('/'), sha256: opts.badHash ? '0'.repeat(64) : sha256File(p)! };
  });
  const receipt = { contract: 'agent-receipt', packet_id: packetId, agent: a.id, outcome: opts.outcome ?? 'completed', outputs, skills_used: a.skills.map((s) => ({ name: s, status: 'INSTALLED' })), findings: [], blockers: [], ...(opts.extra ?? {}) };
  const file = path.join(f.repoRoot, `receipt-${packetId}-${Math.random().toString(16).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(receipt));
  return file;
}

beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
});
afterEach(() => {
  while (fixtures.length) cleanup(fixtures.pop()!);
});

describe('S2-1. seven-agent registration', () => {
  test('seven agents with unique ids, unique fe- names and fourteen distinct skills', () => {
    assert.equal(AGENTS.length, 7);
    assert.deepEqual(AGENTS.map((a) => a.id), ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7']);
    assert.equal(new Set(AGENTS.map((a) => a.name)).size, 7);
    assert.ok(AGENTS.every((a) => a.name.startsWith('fe-')));
    const skills = AGENTS.flatMap((a) => a.skills);
    assert.equal(skills.length, 14);
    assert.equal(new Set(skills).size, 14);
  });

  test('the Claude Code definition files exist and agree with the runtime registry', () => {
    for (const a of AGENTS) {
      const c = checkDefinition(REAL_AGENTS, a);
      assert.deepEqual(c.problems, [], `${a.name}: ${c.problems.join('; ')}`);
      assert.equal(c.frontmatter!.name, a.name);
    }
    const names = fs.readdirSync(REAL_AGENTS).filter((f) => f.startsWith('fe-'));
    assert.equal(names.length, 7, 'exactly seven fe- definitions');
  });

  test('a definition that grants extra tools or drops a section is flagged', () => {
    const { f } = setup();
    const dir = path.join(f.repoRoot, '.claude', 'agents');
    const a = findAgent('F7')!;
    const p = path.join(dir, `${a.name}.agent.md`);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('tools: Read, Grep, Glob, Write', 'tools: Read, Grep, Glob, Write, Edit, Bash').replace('## Stop conditions', '## Stopping'));
    const c = checkDefinition(dir, a);
    assert.ok(c.problems.some((x) => /beyond the runtime policy: Edit, Bash/.test(x)));
    assert.ok(c.problems.some((x) => /Stop conditions/.test(x)));
    const errs: string[] = [];
    assert.equal(main(['agents', '--config', f.configPath], () => undefined, (s) => errs.push(s)), 1);
  });
});

describe('S2-2. agent input/output declarations', () => {
  test('every agent declares inputs, outputs, a dispatch state, its gate or pre-checks and forbidden actions', () => {
    for (const a of AGENTS) {
      assert.ok(a.inputs.length > 0 && a.inputs.some((i) => i.required), a.id);
      assert.ok(a.outputs.length >= 3, a.id);
      assert.ok(a.dispatch_states.length > 0, a.id);
      assert.ok(a.forbidden.some((x) => /approved/.test(x)), a.id);
    }
    // F1/F2 need the automated pre-checks, F3 needs G1, F4/F5 need G2; F6/F7 follow the F5/F6 receipts through their dispatch states.
    assert.deepEqual(Object.fromEntries(AGENTS.map((a) => [a.id, a.requires_gate])), { F1: null, F2: null, F3: 'G1', F4: 'G2', F5: 'G2', F6: null, F7: null });
    for (const id of ['F1', 'F2']) assert.deepEqual(findAgent(id)!.requires_prechecks, ['BASELINE', 'EVIDENCE'], id);
    assert.deepEqual(findAgent('F6')!.dispatch_states, ['IMPLEMENTATION_BUILT', 'TESTING']);
    assert.deepEqual(findAgent('F7')!.dispatch_states, ['REVIEWING']);
    assert.equal(AGENTS.filter((a) => a.may_write_code).map((a) => a.id).join(), 'F5');
    assert.ok(REQUIRED_SECTIONS.includes('Stop conditions'));
  });

  test('a dispatch packet lists hashed inputs, skills, permissions and expected outputs', () => {
    const { f, ctx } = validated();
    const p = prepare(loadWorkflow(ctx, 'FWD-T2'), 'F1');
    for (const i of findAgent('F1')!.inputs) assert.ok(p.inputs.some((x) => x.kind === i.kind), `declared input ${i.kind} missing`);
    assert.ok(p.inputs.some((x) => x.kind === 'extract:rules_extract'), 'runtime extract present');
    const ev = p.inputs.find((i) => i.kind === 'plan:evidence_packets')!;
    assert.equal(ev.files.length, f.programs.length);
    assert.ok(ev.files.every((x) => x.present && /^[0-9a-f]{64}$/.test(x.sha256 ?? '')));
    assert.deepEqual(p.expected_outputs.map((o) => o.name), findAgent('F1')!.outputs.map((o) => o.name));
    assert.equal(p.permissions.may_write_code, false);
  });
});

describe('S2-3. state transitions', () => {
  test('forbidden transitions do not exist in the table', () => {
    assert.equal(findTransition('REQUIREMENTS_DRAFTED', 'IMPLEMENTING', null), null);
    assert.equal(findTransition('BLOCKED', 'COMPLETED', 'REVIEWING'), null);
    assert.equal(findTransition('EVIDENCE_VALIDATED', 'REQUIREMENTS_APPROVED', null), null);
    assert.equal(findTransition('COMPLETED', 'BLOCKED', null), null);
    assert.equal(findTransition('ARCHITECTURE_APPROVED', 'IMPLEMENTING', null), null, 'implementation needs drafted stories');
    assert.equal(findTransition('FAILED', 'BASELINE_LOADED', null), null);
    assert.equal(findTransition('BLOCKED', 'TESTING', 'REVIEWING'), null, 'BLOCKED may only return to the state it blocked');
  });

  test('every way into an approval state is guarded by a runtime gate', () => {
    for (const s of APPROVAL_STATES) {
      const into = TRANSITIONS.filter((t) => t.to === s);
      assert.ok(into.length > 0);
      assert.ok(into.every((t) => t.guard.kind === 'gate'), `${s} reachable without a gate`);
    }
  });

  test('illegal requests are rejected, audited and reported', () => {
    const { ctx } = setup();
    initWorkflow(ctx, 'FWD-T2');
    const r1 = advance(loadWorkflow(ctx, 'FWD-T2'), 'IMPLEMENTING');
    assert.equal(r1.accepted, false);
    const r2 = advance(loadWorkflow(ctx, 'FWD-T2'), 'REQUIREMENTS_APPROVED');
    assert.equal(r2.accepted, false);
    const r3 = advance(loadWorkflow(ctx, 'FWD-T2'), 'NONSENSE');
    assert.equal(r3.accepted, false);
    const wf = loadWorkflow(ctx, 'FWD-T2');
    assert.equal(wf.state.state, 'BASELINE_LOADED');
    assert.equal(wf.store.readAudit().filter((e) => e.event === 'transition_rejected').length, 3);
    const out: string[] = [];
    main(['workflow', 'blocked', '--run', 'FWD-T2', '--config', JSON.parse(JSON.stringify(ctx.configPath))], (s) => out.push(s));
    assert.ok(out.join('\n').includes('BASELINE_LOADED -> IMPLEMENTING'));
  });

  test('moving to BLOCKED needs a reason; leaving it needs the cause cleared', () => {
    const { ctx } = setup();
    initWorkflow(ctx, 'FWD-T2');
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T2'), 'BLOCKED').accepted, false);
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T2'), 'BLOCKED', { reason: 'SME unavailable' }).accepted, true);
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T2'), 'COMPLETED').accepted, false);
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE_VALIDATED').accepted, false);
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T2'), 'BASELINE_LOADED', { reason: 'SME available again' }).accepted, true);
  });
});

describe('S2-4. resume and checkpoint integrity', () => {
  test('a state file edited outside the runtime is refused', () => {
    const { ctx } = setup();
    initWorkflow(ctx, 'FWD-T2');
    const store = new WorkflowStore(path.join(ctx.runsDir, 'FWD-T2'));
    const s = JSON.parse(fs.readFileSync(store.p('state.json'), 'utf8'));
    s.state = 'REQUIREMENTS_APPROVED';
    fs.writeFileSync(store.p('state.json'), JSON.stringify(s));
    assert.throws(() => advance(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE_VALIDATED'), (e: unknown) => e instanceof OrchestratorError && e.code === 'CHECKPOINT_INVALID');
    const r = resume(ctx, 'FWD-T2');
    assert.equal(r.resumed, false);
    assert.ok(r.problems.some((p: string) => /modified outside the runtime/.test(p)));
  });

  test('a tampered audit log is refused', () => {
    const { ctx } = setup();
    initWorkflow(ctx, 'FWD-T2');
    const store = new WorkflowStore(path.join(ctx.runsDir, 'FWD-T2'));
    const lines = fs.readFileSync(store.p('audit.jsonl'), 'utf8').trim().split('\n');
    const e = JSON.parse(lines[0]);
    e.data = { forged: true };
    lines[0] = JSON.stringify(e);
    fs.writeFileSync(store.p('audit.jsonl'), lines.join('\n') + '\n');
    assert.equal(resume(ctx, 'FWD-T2').resumed, false);
  });

  test('an interrupted operation (stale lock, unsealed audit event) blocks work until resume verifies it', () => {
    const { ctx } = setup();
    initWorkflow(ctx, 'FWD-T2');
    const store = new WorkflowStore(path.join(ctx.runsDir, 'FWD-T2'));
    store.append('half_written_operation', { note: 'simulated crash' });
    fs.writeFileSync(store.p('operation.lock'), JSON.stringify({ op: 'precheck EVIDENCE', pid: 1, at: new Date().toISOString() }));
    assert.throws(() => runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE'), OrchestratorError);
    fs.rmSync(store.p('operation.lock'));
    assert.throws(() => runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE'), /checkpoint/);
    fs.writeFileSync(store.p('operation.lock'), JSON.stringify({ op: 'precheck EVIDENCE', pid: 1, at: new Date().toISOString() }));
    const r = resume(ctx, 'FWD-T2');
    assert.equal(r.resumed, true);
    assert.equal(r.interrupted_events_sealed, true);
    assert.equal(r.recovered_lock.op, 'precheck EVIDENCE');
    assert.equal(runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE').status, 'PASS');
    assert.equal(status(loadWorkflow(ctx, 'FWD-T2')).checkpoint.verified, true);
  });
});

describe('S2-5. automated pre-checks (formerly G0 and G1)', () => {
  test('the baseline pre-check passes on an intact baseline and init lands in BASELINE_LOADED', () => {
    const { ctx } = setup();
    const wf = initWorkflow(ctx, 'FWD-T2');
    assert.equal(wf.state.prechecks!.BASELINE.status, 'PASS');
    assert.equal(wf.state.gates.G0, undefined, 'G0 is no longer a gate');
    assert.equal(wf.state.state, 'BASELINE_LOADED');
    const g = JSON.parse(fs.readFileSync(wf.store.p('prechecks', wf.state.prechecks!.BASELINE.result_file), 'utf8'));
    assert.ok(g.inputs.length > 1 && g.evaluated_at && g.reason);
    assert.equal(ctx.contracts.validate('orchestrator/precheck-result', g).valid, true);
    assert.deepEqual(PRECHECKS.map((c) => c.id), ['BASELINE', 'EVIDENCE']);
  });

  test('the evidence pre-check is BLOCKED before the baseline pre-check and FAILs on tampered evidence', () => {
    const { f, ctx } = setup();
    const run = openRun(ctx, 'FWD-T2');
    assert.equal(evaluateEvidenceCheck(run, null).status, 'BLOCKED');
    initWorkflow(ctx, 'FWD-T2');
    const pkt = path.join(f.runsDir, 'FWD-T2', 'evidence_packets', `${f.programs[0].fileId}__${f.programs[0].name}.json`);
    const j = JSON.parse(fs.readFileSync(pkt, 'utf8'));
    j.data_records.push({ record_id: `${f.systemId}-FIL-0999-REC-0001`, file_id: `${f.systemId}-FIL-0999`, owner: 'program' });
    fs.writeFileSync(pkt, JSON.stringify(j));
    const r = runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE');
    assert.equal(r.status, 'FAIL');
    assert.match(r.reason, /not present in the reverse inputs/);
    assert.equal(loadWorkflow(ctx, 'FWD-T2').state.state, 'BLOCKED');
  });
});

describe('S2-6. the two human gates G1 and G2', () => {
  test('G1 and G2 never PASS without a signed human approval, even with receipts and a forged approval', () => {
    const { f, ctx } = validated({ skillsFor: ['F1', 'F2'] });
    for (const id of ['F1', 'F2']) {
      const p = prepare(loadWorkflow(ctx, 'FWD-T2'), id);
      assert.equal(recordReceipt(loadWorkflow(ctx, 'FWD-T2'), writeReceipt(f, p.packet_id, id)).verdict.accepted, true);
    }
    const wf = loadWorkflow(ctx, 'FWD-T2');
    const rc = wf.store.list('receipts')[0].replace('.json', '');
    fs.writeFileSync(wf.store.p('approvals', 'forged.json'), JSON.stringify({ contract: 'approval-record', gate: 'G1', decision: 'approved', actor: { kind: 'agent', id: 'fe-requirements-analyst' }, recorded_by: 'runtime', recorded_at: new Date().toISOString(), bound_receipts: [{ receipt_id: rc, sha256: sha256File(wf.store.p('receipts', `${rc}.json`)) }] }));
    const g2 = runGate(loadWorkflow(ctx, 'FWD-T2'), 'G1');
    assert.equal(g2.status, 'UNVERIFIED');
    assert.ok(g2.checks.some((c) => c.id === 'human_approval' && /must come from a human/.test(c.detail)));
    assert.equal(runGate(loadWorkflow(ctx, 'FWD-T2'), 'G2').status, 'BLOCKED');
    const human = { contract: 'approval-record', gate: 'G1', decision: 'approved', actor: { kind: 'human', id: 'sme' }, recorded_by: 'runtime', recorded_at: new Date().toISOString(), bound_receipts: [{ receipt_id: rc, sha256: sha256File(wf.store.p('receipts', `${rc}.json`)) }] };
    assert.deepEqual(validateApproval(human, 'G1', wf.store), []);
    fs.writeFileSync(wf.store.p('approvals', 'human.json'), JSON.stringify(human));
    assert.equal(runGate(loadWorkflow(ctx, 'FWD-T2'), 'G1').status, 'UNVERIFIED', 'even a valid approval cannot pass a gate without its evaluator');
  });

  test('only G1 and G2 exist, both human; G2 is BLOCKED without G1 and a result for a removed gate is contract-invalid', () => {
    const { ctx } = validated();
    assert.deepEqual(GATES.map((g) => g.id), ['G1', 'G2']);
    assert.ok(GATES.every((g) => g.human_approval && g.evaluator === 'implemented'));
    assert.notEqual(runGate(loadWorkflow(ctx, 'FWD-T2'), 'G1').status, 'PASS');
    const g3 = runGate(loadWorkflow(ctx, 'FWD-T2'), 'G2');
    assert.equal(g3.status, 'BLOCKED');
    assert.equal(ctx.contracts.validate('orchestrator/gate-result', g3).valid, true);
    for (const removed of ['G0', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']) assert.equal(ctx.contracts.validate('orchestrator/gate-result', { ...g3, gate: removed }).valid, false, removed);
  });

  test('approval states are unreachable in STEP 2', () => {
    const { f, ctx } = validated({ skillsFor: ['F1'] });
    const p = prepare(loadWorkflow(ctx, 'FWD-T2'), 'F1');
    recordReceipt(loadWorkflow(ctx, 'FWD-T2'), writeReceipt(f, p.packet_id, 'F1'));
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T2'), 'REQUIREMENTS_DRAFTED').accepted, true);
    const r = advance(loadWorkflow(ctx, 'FWD-T2'), 'REQUIREMENTS_APPROVED');
    assert.equal(r.accepted, false);
    assert.match(r.reason, /G1 has not passed/);
  });
});

describe('S2-6b. gate renumbering (2026-11-09): G1/G2 now, legacy states keep G2/G3', () => {
  test('a new workflow records gate_scheme 2; its G1 (requirements) never counts as the EVIDENCE pre-check, while a legacy G1 PASS does', () => {
    const { ctx } = setup();
    const wf = initWorkflow(ctx, 'FWD-T2');
    assert.equal(wf.state.gate_scheme, GATE_SCHEME);
    assert.equal(GATE_SCHEME, 2);
    assert.equal(ctx.contracts.validate('orchestrator/workflow-state', wf.state).valid, true);
    assert.equal(ctx.contracts.validate('orchestrator/workflow-state', { ...wf.state, gate_scheme: 3 }).valid, false);
    const sha = wf.run.manifestSha256;
    const pass = { status: 'PASS', result_file: 'x.json', evaluated_at: new Date().toISOString(), baseline_sha256: sha };
    const base = { ...wf.state, prechecks: { BASELINE: wf.state.prechecks!.BASELINE } };
    const fresh = { ...base, gates: { G1: pass } };
    assert.equal(isLegacyGateScheme(fresh), false);
    assert.equal(gatePassed(fresh, 'G1', sha), true);
    assert.equal(precheckPassed(fresh, 'EVIDENCE', sha), false, 'a gate_scheme 2 G1 is the requirements gate, never the evidence pre-check');
    assert.equal(precheckPassed({ ...base, prechecks: {}, gates: { G0: pass } }, 'BASELINE', sha), false, 'a gate_scheme 2 state has no legacy G0 gate');
    const legacy = { ...fresh, gate_scheme: undefined };
    assert.equal(isLegacyGateScheme(legacy), true);
    assert.equal(precheckPassed(legacy, 'EVIDENCE', sha), true, 'a legacy G1 PASS is the former evidence gate');
    assert.equal(precheckPassed({ ...legacy, prechecks: {}, gates: { G0: pass } }, 'BASELINE', sha), true, 'a legacy G0 PASS is the former baseline gate');
    assert.equal(gatePassed(legacy, 'G1', sha), false, 'a legacy state stores the requirements gate under G2');
    const legacyAll = { ...legacy, gates: { G0: pass, G1: pass, G2: pass } };
    assert.equal(gatePassed(legacyAll, 'G1', sha), true, 'legacy G2 = requirements');
    assert.equal(gatePassed(legacyAll, 'G2', sha), false, 'legacy G3 (architecture) has not run');
    assert.equal(gatePassed({ ...legacyAll, gates: { G3: pass } }, 'G2', sha), true, 'legacy G3 = architecture');
    assert.deepEqual(['G1', 'G2'].map((g) => gateKey(legacy, g)), ['G2', 'G3']);
    assert.deepEqual(['G1', 'G2'].map((g) => gateKey(fresh, g)), ['G1', 'G2']);
    assert.deepEqual(['G0', 'G1', 'G2', 'G3'].map((k) => gateIdOfKey(legacy, k)), [null, null, 'G1', 'G2']);
    assert.deepEqual(['G1', 'G2', 'G3'].map((k) => gateIdOfKey(fresh, k)), ['G1', 'G2', null]);
    assert.deepEqual([acceptedGateIds(legacy, 'G1'), acceptedGateIds(legacy, 'G2')], [['G1', 'G2'], ['G2', 'G3']]);
    assert.deepEqual([acceptedGateIds(fresh, 'G1'), acceptedGateIds(fresh, 'G2')], [['G1'], ['G2']]);
    const human = { contract: 'approval-record', gate: 'G2', decision: 'approved', actor: { kind: 'human', id: 'sme' }, recorded_by: 'runtime', recorded_at: new Date().toISOString(), bound_receipts: [] };
    assert.ok(validateApproval(human, 'G1', wf.store).includes('approval is for G2, not G1'));
    assert.ok(!validateApproval(human, 'G1', wf.store, acceptedGateIds(legacy, 'G1')).includes('approval is for G2, not G1'), 'a legacy G2 record is a requirements approval');
    // Statements signed before the renumbering still satisfy the contract they are re-verified against.
    const st = { contract: 'approval-statement', statement_version: '1.0', request_id: 'AREQ-0001', request_sha256: 'a'.repeat(64), scope_sha256: 'b'.repeat(64), baseline_manifest_sha256: 'c'.repeat(64), decision: 'approved', signer_id: 'alice', role: 'requirements_approver' };
    const sig = { algorithm: 'ed25519', value: 'A'.repeat(86) + '==' };
    for (const gate of ['G1', 'G2']) assert.equal(ctx.contracts.validate('orchestrator/signed-approval', { contract: 'signed-approval', statement: { ...st, gate }, signature: sig }).valid, true, gate);
    assert.equal(ctx.contracts.validate('orchestrator/signed-approval', { contract: 'signed-approval', statement: { ...st, gate: 'G3' }, signature: sig }).valid, false);
  });

  test('a legacy workflow state (no gate_scheme) is read through the mapping, keeps its old keys and is never migrated', () => {
    const { ctx } = validated();
    // Rewrite the workflow as written before the renumbering and the two-gate change: no marker, the evidence check recorded as gate G1.
    const w = loadWorkflow(ctx, 'FWD-T2');
    const evidence = { ...w.state.prechecks!.EVIDENCE };
    delete w.state.gate_scheme;
    delete w.state.prechecks!.EVIDENCE;
    w.state.gates = { G1: evidence };
    w.store.writeState(w.state);
    const wf = loadWorkflow(ctx, 'FWD-T2');
    assert.equal(precheckPassed(wf.state, 'EVIDENCE', wf.run.manifestSha256), true, 'the legacy G1 PASS counts as the evidence pre-check');
    const st = status(wf);
    assert.equal(st.gate_scheme, 'legacy');
    assert.deepEqual(st.gates, { G1: 'NOT_RUN', G2: 'NOT_RUN' }, 'the legacy evidence gate G1 is not reported as the requirements gate');
    assert.equal(st.prechecks.EVIDENCE, 'PASS');
    const g1 = runGate(loadWorkflow(ctx, 'FWD-T2'), 'G1');
    assert.equal(g1.gate, 'G1');
    assert.notEqual(g1.status, 'BLOCKED', 'the legacy evidence result satisfies the prerequisite');
    assert.notEqual(g1.status, 'PASS');
    const g2 = runGate(loadWorkflow(ctx, 'FWD-T2'), 'G2');
    assert.equal(g2.status, 'BLOCKED');
    const after = loadWorkflow(ctx, 'FWD-T2').state;
    assert.equal(after.gate_scheme, undefined, 'a legacy state is never migrated');
    assert.deepEqual(after.gates.G1, evidence, 'the legacy evidence record is untouched');
    assert.equal(after.gates.G2.status, g1.status);
    assert.match(after.gates.G2.result_file, /^G2-/);
    assert.equal(after.gates.G3.status, 'BLOCKED');
    assert.match(after.gates.G3.result_file, /^G3-/);
    const stored = JSON.parse(fs.readFileSync(loadWorkflow(ctx, 'FWD-T2').store.p('gates', after.gates.G3.result_file), 'utf8'));
    assert.equal(stored.gate, 'G2', 'the result itself carries the current gate ID');
    assert.equal(ctx.contracts.validate('orchestrator/gate-result', stored).valid, true);
    assert.deepEqual(status(loadWorkflow(ctx, 'FWD-T2')).gates, { G1: g1.status, G2: 'BLOCKED' });
    assert.deepEqual(blockedReport(loadWorkflow(ctx, 'FWD-T2')).non_passing_gates.map((g: any) => g.gate).sort(), ['G1', 'G2']);
  });
});

describe('S2-7. unauthorized Java generation', () => {
  test('F5 cannot be dispatched and generation is not authorised even with the config flag on', () => {
    const { ctx } = validated({ javaAllowed: true, targetDir: 'java-target', skillsFor: ['F5'] });
    assert.throws(() => prepare(loadWorkflow(ctx, 'FWD-T2'), 'F5'), /may only be dispatched in STORIES_DRAFTED/);
    const wf = loadWorkflow(ctx, 'FWD-T2');
    const roots = policyRoots(wf.run, wf.state);
    assert.equal(roots.generationAuthorized, false, 'G2 has not passed');
    const d = canWrite(findAgent('F5')!, path.join(ctx.repoRoot, 'java-target', 'src', 'main', 'java', 'App.java'), roots);
    assert.equal(d.allowed, false);
    assert.match(d.reason, /not authorised/);
    assert.equal(main(['generate', '--config', ctx.configPath], () => undefined, () => undefined), EXIT.NOT_AUTHORIZED);
  });

  test('a receipt that declares Java output is rejected', () => {
    const { f, ctx } = validated({ skillsFor: ['F1'] });
    const p = prepare(loadWorkflow(ctx, 'FWD-T2'), 'F1');
    const dir = path.join(f.runsDir, 'FWD-T2', 'workflow', 'agents', 'F1', p.packet_id);
    const file = writeReceipt(f, p.packet_id, 'F1', { names: [...findAgent('F1')!.outputs.map((o) => o.name), 'Requirement.java'] });
    assert.ok(fs.existsSync(path.join(dir, 'Requirement.java')));
    const r = recordReceipt(loadWorkflow(ctx, 'FWD-T2'), file);
    assert.equal(r.verdict.accepted, false);
    assert.ok(r.verdict.violations.some((v) => /may not write Java/.test(v)));
  });
});

describe('S2-8. tool and path permissions', () => {
  test('least-privilege write scopes are enforced by the runtime', () => {
    const { ctx } = validated();
    const wf = loadWorkflow(ctx, 'FWD-T2');
    const roots = { ...policyRoots(wf.run, wf.state), sourceRoot: path.join(ctx.repoRoot, 'cobol-src') };
    const w = (id: string, rel: string) => canWrite(findAgent(id)!, path.join(ctx.repoRoot, rel), roots).allowed;
    const wd = path.relative(ctx.repoRoot, roots.workflowDir);
    assert.equal(w('F1', `${wd}/agents/F1/draft_requirements.json`), true);
    assert.equal(w('F1', `${wd}/agents/F3/java_architecture.md`), false, 'another agent output dir');
    assert.equal(w('F2', 'output/data/data_artifact.json'), false, 'reverse outputs');
    assert.equal(w('F3', '.claude/agents/1_inventory_c.agent.md'), false, 'reverse agents');
    assert.equal(w('F4', 'cobol-src/src/prog/X.cbl'), false, 'COBOL source');
    assert.equal(w('F6', `${wd}/state.json`), false, 'runtime records');
    assert.equal(w('F6', `${wd}/approvals/a.json`), false, 'approvals');
    assert.equal(w('F6', 'java-target/src/main/java/Fix.java'), false, 'tester may not repair code');
    assert.equal(w('F7', `${wd}/agents/F5/Impl.java`), false, 'reviewer read-only for Java');
    assert.equal(w('F3', `${wd}/agents/F3/pom.xml`), false, 'architect may not write build files');
    assert.equal(canRead(findAgent('F1')!, path.join(ctx.repoRoot, '.mcp.json'), roots).allowed, false);
    assert.equal(canRead(findAgent('F1')!, path.join(ctx.repoRoot, 'output', 'rules', 'rules_artifact.json'), roots).allowed, true);
  });

  test('a receipt naming a path outside the agent scope is rejected', () => {
    const { f, ctx } = validated({ skillsFor: ['F2'] });
    const p = prepare(loadWorkflow(ctx, 'FWD-T2'), 'F2');
    const r = recordReceipt(loadWorkflow(ctx, 'FWD-T2'), writeReceipt(f, p.packet_id, 'F2', { outDir: path.join(f.runsDir, 'FWD-T2', 'workflow', 'agents', 'F1') }));
    assert.equal(r.verdict.accepted, false);
    assert.ok(r.verdict.violations.some((v) => /may only write inside/.test(v)));
  });
});

describe('S2-9. run-local IDs', () => {
  test('the evidence pre-check fails when a rule reference is bound to a different reverse run', () => {
    const { f, ctx } = setup();
    initWorkflow(ctx, 'FWD-T2');
    const p = path.join(f.runsDir, 'FWD-T2', 'rule_summary.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.rules[0].ref.source_run = 'rules@5_rules@1.0#000000000000';
    fs.writeFileSync(p, JSON.stringify(j));
    const r = runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE');
    assert.equal(r.status, 'FAIL');
    assert.ok(r.checks.some((c) => c.id === 'run_local_ids' && c.status === 'fail'));
  });

  test('packets and receipts carry the exact baseline manifest hash', () => {
    const { ctx } = validated();
    const wf = loadWorkflow(ctx, 'FWD-T2');
    const pkt = prepare(wf, 'F1');
    assert.equal(pkt.baseline.manifest_sha256, wf.run.manifestSha256);
    assert.equal(wf.state.baseline.inputs.rules, wf.run.manifest.inputs.find((i: any) => i.key === 'rules').sha256);
  });
});

describe('S2-10. grouped-gap preservation', () => {
  test('the evidence pre-check fails when an expanded gap item is dropped', () => {
    const { f, ctx } = setup();
    initWorkflow(ctx, 'FWD-T2');
    const p = path.join(f.runsDir, 'FWD-T2', 'gap_summary.json');
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    j.expanded_items.pop();
    fs.writeFileSync(p, JSON.stringify(j));
    const r = runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE');
    assert.ok(r.checks.some((c) => c.id === 'grouped_gaps_preserved' && c.status === 'fail'));
  });
});

describe('S2-11. missing source evidence', () => {
  test('a missing evidence packet blocks dispatch and fails the evidence pre-check', () => {
    const { f, ctx } = validated({ skillsFor: ['F1'] });
    fs.rmSync(path.join(f.runsDir, 'FWD-T2', 'evidence_packets', `${f.programs[0].fileId}__${f.programs[0].name}.json`));
    const p = prepare(loadWorkflow(ctx, 'FWD-T2'), 'F1');
    assert.equal(p.dispatchable, false);
    assert.ok(p.blockers.some((b) => /plan:evidence_packets/.test(b)));
    assert.equal(runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE').status, 'FAIL');
  });

  test('skills not installed make a packet undispatchable and are reported as SKILL_NOT_INSTALLED', () => {
    const { ctx } = validated();
    const p = prepare(loadWorkflow(ctx, 'FWD-T2'), 'F2');
    assert.equal(p.dispatchable, false);
    assert.deepEqual(p.skills.map((s) => s.status), ['SKILL_NOT_INSTALLED', 'SKILL_NOT_INSTALLED']);
    assert.match(p.invocation, /NOT DISPATCHABLE/);
  });
});

describe('S2-12. template/application classification', () => {
  const prog = (rel: string): any => ({ program_id: 'P', file_id: 'SYS-T-001-FIL-0001', relative_path: rel });
  test('agreeing path and narrative confirm a template, which needs a scope decision', () => {
    const c = classifyProgram(prog('src/templates/program/x.cbl'), 'Program P is a program template, not a business program.', [], []);
    assert.equal(c.class, 'template');
    assert.equal(c.confidence, 'confirmed');
    assert.equal(c.modernization_scope, 'requires_scope_decision');
  });
  test('conflicting signals give an uncertain, unknown class', () => {
    const c = classifyProgram(prog('src/test/x.cbl'), 'P is a program template for batch jobs.', [], []);
    assert.equal(c.class, 'unknown');
    assert.equal(c.confidence, 'uncertain');
    assert.ok(c.conflicts.length > 0);
  });
  test('a narrative-only signal is inferred and the path disagreement is surfaced', () => {
    const c = classifyProgram(prog('src/programs/portfolio/x.cbl'), 'P is a batch test-data program that writes records.', [], []);
    assert.equal(c.class, 'test_tool');
    assert.equal(c.confidence, 'inferred');
    assert.ok(c.conflicts[0].includes('narrative only'));
  });
  test('no evidence at all is not treated as an application candidate', () => {
    const c = classifyProgram(prog('x.cbl'), null, [], []);
    assert.equal(c.confidence, 'uncertain');
    assert.equal(c.modernization_scope, 'requires_scope_decision');
  });
  test('business text that merely mentions a test is still an application', () => {
    const c = classifyProgram(prog('src/programs/batch/x.cbl'), 'P validates transactions and writes a test of limits to the log.', [], []);
    assert.equal(c.class, 'application');
    assert.equal(c.modernization_scope, 'candidate');
  });
});

describe('S2-13. malformed agent outputs', () => {
  const run = (mod: (f: Fixture, pkt: string) => string, pattern: RegExp, skills = ['F1']) => {
    const { f, ctx } = validated({ skillsFor: skills });
    const p = prepare(loadWorkflow(ctx, 'FWD-T2'), 'F1');
    const r = recordReceipt(loadWorkflow(ctx, 'FWD-T2'), mod(f, p.packet_id));
    assert.equal(r.verdict.accepted, false);
    assert.ok(r.verdict.violations.some((v) => pattern.test(v)), r.verdict.violations.join(' | '));
    assert.equal(loadWorkflow(ctx, 'FWD-T2').state.state, 'EVIDENCE_VALIDATED');
  };
  test('invalid JSON', () => run((f) => { const x = path.join(f.repoRoot, 'bad.json'); fs.writeFileSync(x, '{ nope'); return x; }, /not valid JSON/));
  test('agent asserts an approval in the receipt', () => run((f, p) => writeReceipt(f, p, 'F1', { extra: { approved: true } }), /may not assert approvals|additional properties/));
  test('agent asserts an approval inside an output', () => run((f, p) => writeReceipt(f, p, 'F1', { outputContent: { requirements: [], gate_status: 'PASS' } }), /asserts approvals/));
  test('declared hash does not match', () => run((f, p) => writeReceipt(f, p, 'F1', { badHash: true }), /SHA-256/));
  test('completed without all expected outputs', () => run((f, p) => writeReceipt(f, p, 'F1', { names: ['draft_requirements.json'] }), /missing expected outputs/));
  test('unknown packet', () => run((f) => writeReceipt(f, 'PKT-0099-F1', 'F1'), /unknown packet/));
  test('completed outcome for an undispatchable packet', () => run((f, p) => writeReceipt(f, p, 'F1'), /not dispatchable/, []));
  test('agent mismatch', () => run((f, p) => { const x = writeReceipt(f, p, 'F1'); const j = JSON.parse(fs.readFileSync(x, 'utf8')); j.agent = 'F2'; fs.writeFileSync(x, JSON.stringify(j)); return x; }, /does not match packet agent/));
  test('a blocked outcome is recorded without moving the workflow', () => {
    const { f, ctx } = validated({ skillsFor: ['F1'] });
    const p = prepare(loadWorkflow(ctx, 'FWD-T2'), 'F1');
    const r = recordReceipt(loadWorkflow(ctx, 'FWD-T2'), writeReceipt(f, p.packet_id, 'F1', { outcome: 'blocked', names: [] }));
    assert.equal(r.verdict.accepted, true);
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T2'), 'REQUIREMENTS_DRAFTED').accepted, false);
  });
});

describe('S2-14. stale baseline', () => {
  test('a changed reverse artifact fails the baseline pre-check, blocks the workflow and refuses resume', () => {
    const { f, ctx } = validated();
    const rules = f.read('output/rules/rules_artifact.json');
    rules.business_rules[0].confidence = 'high';
    f.write('output/rules/rules_artifact.json', rules);
    const r = advance(loadWorkflow(ctx, 'FWD-T2'), 'REQUIREMENTS_DRAFTED');
    assert.equal(r.accepted, false);
    assert.match(r.reason, /baseline no longer intact/);
    const g0 = runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'BASELINE');
    assert.equal(g0.status, 'FAIL');
    assert.match(g0.reason, /stale baseline/);
    assert.equal(loadWorkflow(ctx, 'FWD-T2').state.state, 'BLOCKED');
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T2'), 'EVIDENCE_VALIDATED').accepted, false, 'cannot unblock while stale');
    assert.equal(resume(ctx, 'FWD-T2').resumed, false);
    assert.throws(() => prepare(loadWorkflow(ctx, 'FWD-T2'), 'F1'), /may only be dispatched/);
  });

  test('a replaced baseline manifest is detected', () => {
    const { f, ctx } = setup();
    initWorkflow(ctx, 'FWD-T2');
    const m = path.join(f.runsDir, 'FWD-T2', 'baseline_manifest.json');
    const j = JSON.parse(fs.readFileSync(m, 'utf8'));
    j.status_note = 'edited';
    fs.writeFileSync(m, JSON.stringify(j, null, 2));
    const g0 = runPrecheck(loadWorkflow(ctx, 'FWD-T2'), 'BASELINE');
    assert.equal(g0.status, 'FAIL');
    assert.ok(g0.checks.some((c) => c.id === 'workflow_binding' && c.status === 'fail'));
  });
});

describe('S2-15. Step 1 CLI preserved', () => {
  test('doctor, validate and plan behave as before; workflow commands work through the CLI', () => {
    const { ctx } = setup();
    const out: string[] = [];
    const o = (s: string) => out.push(s);
    assert.equal(main(['validate', '--config', ctx.configPath], o, o), EXIT.OK);
    assert.equal(main(['plan', '--all', '--config', ctx.configPath, '--run-id', 'FWD-T2B'], o, o), EXIT.OK);
    assert.equal(main(['plan', '--config', ctx.configPath], o, o), EXIT.USAGE);
    assert.equal(main(['workflow', 'init', '--run', 'FWD-T2B', '--config', ctx.configPath], o, o), EXIT.OK);
    assert.equal(main(['workflow', 'precheck', '--check', 'EVIDENCE', '--run', 'FWD-T2B', '--config', ctx.configPath], o, o), EXIT.OK);
    assert.equal(main(['workflow', 'advance', '--to', 'IMPLEMENTING', '--run', 'FWD-T2B', '--config', ctx.configPath], o, o), 1);
    assert.equal(main(['workflow', 'status', '--run', 'FWD-T2B', '--config', ctx.configPath, '--json'], o, o), EXIT.OK);
    const st = JSON.parse(out[out.length - 1]);
    assert.equal(st.state, 'BASELINE_LOADED');
    assert.equal(st.prechecks.EVIDENCE, 'PASS');
    assert.deepEqual(Object.keys(st.gates), ['G1', 'G2']);
    assert.equal(main(['workflow', 'resume', '--run', 'FWD-T2B', '--config', ctx.configPath], o, o), EXIT.OK);
    assert.equal(main(['workflow', 'bogus', '--config', ctx.configPath], o, o), 2);
  });
});

describe('S2-16. testing and completion need passing results (no human gate after G2)', () => {
  const ok = { contract: 'forward/verification-report', record_type: 'junit_results', test_runs: [{ command: 'mvn test', exit_code: 0, tests: 12, failures: 0, errors: 0, skipped: 0, executed_at: '2026-11-08T10:00:00Z' }], equivalence: [] };
  const eqOk = { contract: 'forward/verification-report', record_type: 'equivalence_assessment', test_runs: [], equivalence: [{ requirement_id: 'REQ-0001', status: 'EQUIVALENCE_UNVERIFIED', compared_aspects: [], reference_evidence: [], differences: [] }] };
  const recommend = (yes: boolean, blocking = false) => ({ contract: 'forward/review-report', record_type: 'acceptance_recommendation', findings: blocking ? [{ review_finding_id: 'RF-0001', blocking: true }] : [], recommendation: { recommend_acceptance: yes, reasons: [yes ? 'all requirements traced' : 'numeric rounding differs'], decided_by: 'workflow_completion_after_review' } });
  const noBlocking = { contract: 'forward/review-report', record_type: 'blocking_findings', findings: [], recommendation: { recommend_acceptance: true, reasons: ['none'], decided_by: 'workflow_completion_after_review' } };
  function rec(f: Fixture, agent: string, docs: Record<string, any>) {
    const outputs = Object.entries(docs).map(([n, d]) => {
      const file = path.join(f.repoRoot, 'out', agent, n);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(d));
      return { path: `out/${agent}/${n}`, sha256: sha256File(file)! };
    });
    return { receipt_id: `RCP-${agent}`, packet_id: `PKT-${agent}`, recorded_at: new Date().toISOString(), receipt: { agent, outcome: 'completed', outputs }, verdict: { accepted: true, violations: [] } } as any;
  }
  const wfFor = (f: Fixture) => ({ run: { ctx: { repoRoot: f.repoRoot } } }) as any;

  test('TESTING -> REVIEWING needs executed, passing F6 tests and no behaviour reported DIFFERENT', () => {
    const f = makeFixture();
    fixtures.push(f);
    const wf = wfFor(f);
    assert.equal(receiptOutcome(wf, 'TESTING', 'REVIEWING', rec(f, 'F6', { 'junit_results.json': ok, 'equivalence_assessment.json': eqOk })), null);
    const failing = { ...ok, test_runs: [{ ...ok.test_runs[0], exit_code: 1, failures: 2 }] };
    assert.match(receiptOutcome(wf, 'TESTING', 'REVIEWING', rec(f, 'F6', { 'junit_results.json': failing, 'equivalence_assessment.json': eqOk }))!, /did not pass/);
    assert.match(receiptOutcome(wf, 'TESTING', 'REVIEWING', rec(f, 'F6', { 'junit_results.json': { ...ok, test_runs: [] }, 'equivalence_assessment.json': eqOk }))!, /no executed test/);
    const diff = { ...eqOk, equivalence: [{ ...eqOk.equivalence[0], status: 'DIFFERENT' }] };
    assert.match(receiptOutcome(wf, 'TESTING', 'REVIEWING', rec(f, 'F6', { 'junit_results.json': ok, 'equivalence_assessment.json': diff }))!, /differs from the COBOL reference for REQ-0001/);
    assert.match(receiptOutcome(wf, 'TESTING', 'REVIEWING', rec(f, 'F6', { 'equivalence_assessment.json': eqOk }))!, /has no junit_results.json/);
    assert.equal(receiptOutcome(wf, 'TESTING', 'IMPLEMENTING', rec(f, 'F6', { 'junit_results.json': failing })), null, 'rework needs no passing result');
  });

  test('REVIEWING -> COMPLETED needs an F7 acceptance recommendation without blocking findings, unchanged since acceptance', () => {
    const f = makeFixture();
    fixtures.push(f);
    const wf = wfFor(f);
    assert.equal(receiptOutcome(wf, 'REVIEWING', 'COMPLETED', rec(f, 'F7', { 'acceptance_recommendation.json': recommend(true), 'blocking_findings.json': noBlocking })), null);
    assert.match(receiptOutcome(wf, 'REVIEWING', 'COMPLETED', rec(f, 'F7', { 'acceptance_recommendation.json': recommend(false), 'blocking_findings.json': noBlocking }))!, /does not recommend acceptance: numeric rounding differs/);
    assert.match(receiptOutcome(wf, 'REVIEWING', 'COMPLETED', rec(f, 'F7', { 'acceptance_recommendation.json': recommend(true, true), 'blocking_findings.json': noBlocking }))!, /blocking finding\(s\): RF-0001/);
    const r = rec(f, 'F7', { 'acceptance_recommendation.json': recommend(true), 'blocking_findings.json': noBlocking });
    fs.writeFileSync(path.join(f.repoRoot, 'out', 'F7', 'acceptance_recommendation.json'), JSON.stringify(recommend(true)) + ' ');
    assert.match(receiptOutcome(wf, 'REVIEWING', 'COMPLETED', r)!, /changed since RCP-F7 was accepted/);
    assert.equal(receiptOutcome(wf, 'REVIEWING', 'IMPLEMENTING', rec(f, 'F7', { 'acceptance_recommendation.json': recommend(false) })), null, 'rework needs no passing result');
    assert.equal(findTransition('REVIEWING', 'COMPLETED', null)!.guard.kind, 'receipt');
  });
});
