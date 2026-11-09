/**
 * STEP 4: G2 requirements verification and the human approval boundary.
 * Signing keys are generated in memory for these synthetic fixtures only;
 * nothing here touches the real workflow run.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync, KeyObject, sign as edSign } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadContext, RuntimeContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { runPlan } from '../runtime/src/commands/plan';
import { AGENTS } from '../runtime/src/orchestrator/agents';
import { advance, generationAuthorized, initWorkflow, loadWorkflow, prepare, prepareBatches, recordReceipt, runGate, status, runPrecheck } from '../runtime/src/orchestrator/orchestrator';
import { SKILLS } from '../runtime/src/orchestrator/skills';
import { consolidate, correct } from '../runtime/src/remediation/remediation';
import { approvalStatement, createApprovalRequest, importApproval, statementText, verifyApprovalFile } from '../runtime/src/approval/approvals';
import { canonicalize, digest } from '../runtime/src/approval/canonical';
import { resolutionTemplate, resolveDecision } from '../runtime/src/approval/decisions';
import { recordPacketReview } from '../runtime/src/approval/packets';
import { evaluateScope, parseSelector, ScopeEvaluation } from '../runtime/src/approval/scope';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { cleanup, Fixture, FORWARD_DIR, makeFixture } from './helpers/fixture';
import { produceF1, produceF2, readPacket, writeDeliverables } from './helpers/outputs';

const REPO = path.resolve(FORWARD_DIR, '..');
const RUN = 'FWD-T4';
const fixtures: Fixture[] = [];

type KP = { publicKey: KeyObject; privateKey: KeyObject };
type Keys = Record<'alice' | 'bob' | 'carol' | 'mallory' | 'eve' | 'agent', KP>;
const SIGNERS = { alice: 'alice.approver', bob: 'bob.sme', carol: 'carol.exceptions', mallory: 'mallory.viewer', eve: 'eve.unknown', agent: 'fe-requirements-analyst' } as const;
const sign = (text: string, kp: KP) => edSign(null, Buffer.from(text, 'utf8'), kp.privateKey).toString('base64');
const pem = (kp: KP) => kp.publicKey.export({ type: 'spki', format: 'pem' }).toString();

const SOURCE = [
  '       IDENTIFICATION DIVISION.',
  '       PROGRAM-ID. BRAVO02.',
  '       DATA DIVISION.',
  '       WORKING-STORAGE SECTION.',
  '       01  WS-LIMIT PIC 9(4).',
  '       PROCEDURE DIVISION.',
  '       P1.',
  '           MOVE 1000 TO WS-LIMIT.',
  '           IF WS-LIMIT > 500',
  "              DISPLAY 'HIGH'",
  '           END-IF.',
  '           GOBACK.',
];

interface Opts {
  trust?: boolean;
  skills?: boolean;
  policy?: Record<string, unknown>;
  mutate?: (f: Fixture) => void;
}

function setup(opts: Opts = {}) {
  const f = makeFixture({ withSource: true });
  fixtures.push(f);
  fs.mkdirSync(path.join(f.repoRoot, '.claude', 'agents'), { recursive: true });
  for (const a of AGENTS) fs.copyFileSync(path.join(REPO, '.claude', 'agents', `${a.name}.agent.md`), path.join(f.repoRoot, '.claude', 'agents', `${a.name}.agent.md`));
  if (opts.skills !== false) installSkills(f);
  // Parser statements and real source text for BRAVO02 so that claims can be checked independently.
  const b = f.programs[1];
  f.write(`output/parser/raw_structure/${b.fileId}__${b.name}.json`, {
    program_summary: {},
    program_id: b.name,
    file_id: b.fileId,
    procedure_division: {
      paragraphs: [{ paragraph_id: `${b.fileId}-PAR-0001`, name: 'P1', start_line: 7, end_line: 12 }],
      statements: [
        { statement_id: `${b.fileId}-STMT-000001`, statement_type: 'MOVE', start_line: 8, end_line: 8 },
        { statement_id: `${b.fileId}-STMT-000002`, statement_type: 'IF', start_line: 9, end_line: 11 },
      ],
    },
  });
  f.write(`cobol-src/${b.rel}`, SOURCE.join('\n') + '\n');
  const rules = f.read('output/rules/rules_artifact.json');
  rules.rules_by_program = { [f.programs[0].name]: ['BR-001', 'BR-003'], [b.name]: ['BR-002'], [f.programs[2].name]: [] };
  f.write('output/rules/rules_artifact.json', rules);
  // Keys exist only in memory; the trust store holds public keys only and lives outside the run directory.
  const mk = (): KP => generateKeyPairSync('ed25519');
  const k: Keys = { alice: mk(), bob: mk(), carol: mk(), mallory: mk(), eve: mk(), agent: mk() };
  const cfg = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
  cfg.approval = { ...cfg.approval, trust_store: opts.trust === false ? null : 'trust/trust-store.json', g2: { ...cfg.approval.g2, ...(opts.policy ?? {}) } };
  fs.writeFileSync(f.configPath, JSON.stringify(cfg, null, 2));
  f.write('trust/trust-store.json', {
    contract: 'approval-trust-store',
    contract_version: '1.0',
    issued_by: 'synthetic test custodian',
    signers: [
      { signer_id: SIGNERS.alice, public_key_pem: pem(k.alice), roles: ['requirements_approver'] },
      { signer_id: SIGNERS.bob, public_key_pem: pem(k.bob), roles: ['business_sme', 'technical_authority', 'product_owner'] },
      { signer_id: SIGNERS.carol, public_key_pem: pem(k.carol), roles: ['exception_approver'] },
      { signer_id: SIGNERS.mallory, public_key_pem: pem(k.mallory), roles: ['observer'] },
      { signer_id: SIGNERS.agent, public_key_pem: pem(k.agent), roles: ['requirements_approver', 'business_sme'] },
    ],
  });
  opts.mutate?.(f);
  process.env.REVFORGE_COBOL_SOURCE_ROOT = f.sourceRoot;
  const ctx = loadContext({ forwardDir: FORWARD_DIR, configPath: f.configPath });
  runPlan(ctx, { runId: RUN });
  initWorkflow(ctx, RUN);
  assert.equal(runPrecheck(wf(ctx), 'EVIDENCE').status, 'PASS');
  assert.equal(advance(wf(ctx), 'EVIDENCE_VALIDATED').accepted, true);
  return { f, ctx, k };
}
function installSkills(f: Fixture) {
  for (const s of SKILLS) f.write(`.claude/skills/${s.name}/SKILL.md`, fs.readFileSync(path.join(REPO, 'forward', 'skills', s.name, 'SKILL.md'), 'utf8'));
}
const wf = (ctx: RuntimeContext) => loadWorkflow(ctx, RUN);

type Edit = (agent: 'F1' | 'F2', unit: string, docs: Record<string, any>, packet: any) => void;
/** Delivers F1 and F2 for every unit (one unit per batch), drafts requirements and consolidates. */
function deliver(f: Fixture, ctx: RuntimeContext, edit?: Edit) {
  for (const a of ['F1', 'F2'] as const) {
    for (const p of prepareBatches(wf(ctx), a, 1)) {
      const packet = readPacket(f.repoRoot, f.runsDir, RUN, p.packet_id);
      const docs = a === 'F1' ? produceF1(f.repoRoot, packet) : produceF2(f.repoRoot, packet);
      edit?.(a, packet.units[0].name, docs, packet);
      const rec = recordReceipt(wf(ctx), writeDeliverables(f.repoRoot, packet, docs));
      assert.equal(rec.verdict.accepted, true, `${p.packet_id}: ${rec.verdict.violations.join(' | ')}`);
    }
  }
  assert.equal(advance(wf(ctx), 'REQUIREMENTS_DRAFTED').accepted, true);
  consolidate(wf(ctx));
}

/** BRAVO02's requirement becomes an independently checkable source claim citing line 8 (or `line`). */
const verifiedClaim = (f: Fixture, line = 8): Edit => (a, unit, docs) => {
  if (a !== 'F1' || unit !== f.programs[1].name) return;
  const r = docs['draft_requirements.json'].requirements[0];
  r.evidence_status = 'verified_from_source';
  r.statement = 'The program sets the processing limit to 1000 before it evaluates the limit.';
  r.source_refs = [{ ...r.source_refs[0], statement_id: `${f.programs[1].fileId}-STMT-000001`, line }];
};

function ev(ctx: RuntimeContext, scope: string): ScopeEvaluation {
  return evaluateScope(buildSnapshot(wf(ctx)), parseSelector(scope));
}

let seq = 0;
function resolve(ctx: RuntimeContext, f: Fixture, decisionId: string, outcome: string, kp: KP, signer: string, role: string, tweak?: (r: any) => void, dryRun = false): any {
  const t = resolutionTemplate(buildSnapshot(wf(ctx)), decisionId);
  const res = { ...t, outcome, selected_option: null, resolution_text: `Synthetic resolution for ${decisionId}`, justification: 'Synthetic justification recorded by a test signer', signer_id: signer, role, resolved_at: new Date(Date.now() - 1000).toISOString() };
  tweak?.(res);
  const signed = { contract: 'signed-decision-resolution', resolution: res, signature: { algorithm: 'ed25519', value: sign(canonicalize(res), kp) } };
  const file = path.join(f.repoRoot, `resolution-${++seq}.json`);
  fs.writeFileSync(file, JSON.stringify(signed));
  return { file, signed, r: resolveDecision(wf(ctx), file, { dryRun, build: (w) => buildSnapshot(w) }) };
}

/** Signs the decisions a scope needs, the way the fixture's humans would. */
function resolveScope(ctx: RuntimeContext, f: Fixture, k: Keys, scope: string): ScopeEvaluation {
  for (let i = 0; i < 6; i++) {
    const snap = buildSnapshot(wf(ctx));
    const e = evaluateScope(snap, parseSelector(scope));
    const todo = [...new Set(e.findings.filter((x) => x.blocking).flatMap((x) => x.decisions))].filter((id) => snap.register.has(id) && snap.resolutions.get(id)!.status !== 'resolved');
    if (!todo.length) return e;
    for (const id of todo) {
      const d = snap.register.get(id)!;
      if (d.allowed_outcomes.includes('approved_exception') && /REQUIRES_EVIDENCE/.test(d.question)) resolve(ctx, f, id, 'approved_exception', k.carol, SIGNERS.carol, 'exception_approver');
      else if (d.allowed_outcomes.includes('resolved_no_change')) resolve(ctx, f, id, 'resolved_no_change', k.bob, SIGNERS.bob, ['technical', 'data_layout', 'runtime_semantics'].includes(d.kind) ? 'technical_authority' : 'business_sme');
      else resolve(ctx, f, id, 'excluded_from_scope', k.bob, SIGNERS.bob, 'business_sme');
    }
  }
  return ev(ctx, scope);
}

function approve(ctx: RuntimeContext, f: Fixture, k: Keys, scope: string, o: { requestedBy?: string; signer?: [string, KP, string]; decision?: 'approved' | 'rejected'; tamper?: (s: any) => void; request?: any } = {}) {
  const req = o.request ?? createApprovalRequest(wf(ctx), scope, o.requestedBy ?? 'dave.requester');
  const [id, kp, role] = o.signer ?? [SIGNERS.alice, k.alice, 'requirements_approver'];
  const st = approvalStatement(req, id, role, o.decision ?? 'approved');
  const signed = { contract: 'signed-approval', statement: st, signature: { algorithm: 'ed25519', value: sign(statementText(st), kp) } };
  o.tamper?.(signed);
  const file = path.join(f.repoRoot, `approval-${++seq}.json`);
  fs.writeFileSync(file, JSON.stringify(signed));
  return { req, file, signed, r: importApproval(wf(ctx), file) };
}
const failed = (r: any) => r.checks.filter((c: any) => !c.ok).map((c: any) => c.id);
const BRAVO = 'programs:BRAVO02';

function hashTree(dir: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = sha256File(p);
    }
  };
  walk(dir);
  return out;
}

beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
});
afterEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  while (fixtures.length) cleanup(fixtures.pop()!);
});

describe('S4-A. readiness, scopes and evidence outcomes', () => {
  test('1. readiness is evaluated per scope and never equals approval', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    const e = ev(ctx, BRAVO);
    assert.equal(e.readiness, 'NOT_READY');
    assert.ok(e.findings.some((x) => x.id === 'SCOPE-BRAVO02' && x.blocking), 'unclassified program needs a scope decision');
    const req = e.findings.find((x) => x.kind === 'requirement')!;
    assert.equal(req.outcome, 'VERIFIED', req.reasons.join(' | '));
    const ready = resolveScope(ctx, f, k, BRAVO);
    assert.equal(ready.readiness, 'READY', JSON.stringify(ready.findings.filter((x) => x.blocking)));
    const g2 = runGate(wf(ctx), 'G2');
    assert.equal(g2.status, 'UNVERIFIED', 'READY alone never passes G2');
    assert.ok(g2.checks.some((c) => c.id === 'human_approval' && c.status === 'fail'));
  });

  test('2/3. unrelated decisions do not block a scope; shared dependencies and exclusions cannot hide blockers', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    const [alpha, bravo, charlie] = f.programs.map((p) => p.name);
    const b = ev(ctx, BRAVO);
    assert.deepEqual(b.units.map((u) => u.name).sort(), [bravo, f.copybooks[0].name].sort());
    assert.ok(b.excluded.decisions.some((d) => d.id.startsWith(`DR-${alpha}`)), 'ALPHA01 decisions are outside the BRAVO02 scope');
    assert.ok(!b.findings.some((x) => x.id.startsWith(`DR-${alpha}`) || x.id === `SCOPE-${alpha}`));
    const a = ev(ctx, `programs:${alpha}`);
    assert.deepEqual(a.units.filter((u) => u.role === 'dependency').map((u) => u.name).sort(), [bravo, charlie, f.copybooks[0].name].sort());
    assert.ok(a.findings.some((x) => x.id === 'SCOPE-BRAVO02' && x.blocking), "a called program's blocker is visible in the caller's scope");
    // Excluding BRAVO02 cannot hide it from ALPHA01, which calls it.
    resolve(ctx, f, 'SCOPE-BRAVO02', 'excluded_from_scope', k.bob, SIGNERS.bob, 'business_sme');
    const a2 = ev(ctx, `programs:${alpha}`);
    assert.ok(a2.findings.some((x) => x.kind === 'excluded_dependency' && x.id === bravo && x.blocking));
    const app = ev(ctx, 'application');
    assert.ok(app.excluded.units.some((u) => u.name === bravo), 'in the application scope the exclusion is recorded with its justification');
    assert.ok(app.findings.some((x) => x.kind === 'excluded_dependency' && x.id === bravo), 'but the caller still depends on it');
  });

  test('4. canonical rule coverage: every rule in scope needs a disposition', () => {
    const { f, ctx } = setup();
    deliver(f, ctx);
    const snap = buildSnapshot(wf(ctx));
    const app = evaluateScope(snap, parseSelector('application'));
    assert.deepEqual(app.findings.filter((x) => x.category === 'rule_coverage').map((x) => x.id).sort(), ['BR-001', 'BR-002', 'BR-003']);
    snap.ruleEntries.delete('BR-002');
    const r = evaluateScope(snap, parseSelector('application')).findings.find((x) => x.id === 'BR-002')!;
    assert.equal(r.outcome, 'REQUIRES_EVIDENCE');
    assert.match(r.reasons[0], /no disposition/);
    const deferred = app.findings.find((x) => x.id === 'BR-003')!;
    assert.equal(deferred.outcome, 'REQUIRES_SME_DECISION', 'deferred behaviour is missing behaviour until its decision is resolved');
  });

  test('5. a cross-batch conflict blocks every scope that shares the rule until a signed SME decision', () => {
    const shared = (f: Fixture) => {
      const rules = f.read('output/rules/rules_artifact.json');
      const cb = f.copybooks[0];
      const ids = { system_id: f.systemId, file_id: cb.fileId, path_id: cb.pathId, program_id: null, section_id: null, paragraph_id: null, statement_id: null };
      rules.business_rules.push({ rule_id: 'BR-004', rule_set_id: 'RS-001', name: 'Declared status domain', category: 'VALIDATION', confidence: 'medium', requires_sme_review: false, outcomes: { result: 'declared value domain' }, primary_source: { program_id: null, copybook: cb.name, source_ids: ids }, sources: [{ program_id: null, copybook: cb.name, evidence: 'complete', source_ids: ids }], implemented_in_programs: [] });
      rules.rule_sets[0].rule_ids.push('BR-004');
      for (const p of f.programs) rules.rules_by_program[p.name] = [...(rules.rules_by_program[p.name] ?? []), 'BR-004'];
      f.write('output/rules/rules_artifact.json', rules);
    };
    const { f, ctx, k } = setup({ mutate: shared });
    deliver(f, ctx, (a, unit, docs) => {
      if (a !== 'F1' || unit !== f.programs[0].name) return;
      const r = docs['draft_requirements.json'];
      const drop = new Set(r.requirements.filter((q: any) => q.derived_from_rules.some((x: any) => x.id === 'BR-004')).map((q: any) => q.requirement_id));
      r.requirements = r.requirements.filter((q: any) => !drop.has(q.requirement_id));
      for (const c of r.rule_coverage) if (c.rule.id === 'BR-004') Object.assign(c, { disposition: 'not_a_requirement', requirement_ids: [], reason: 'declared domain never tested' });
      const n = (d: string) => r.rule_coverage.filter((c: any) => c.disposition === d).length;
      r.coverage_summary = { rules_in_scope: r.rule_coverage.length, mapped: n('mapped'), deferred: n('deferred_scope') + n('deferred_decision'), not_a_requirement: n('not_a_requirement'), contradictory: n('contradictory'), requirements: r.requirements.length };
      const e = docs['evidence_references.json'];
      e.edges = e.edges.filter((x: any) => !(x.to.kind === 'requirement' && drop.has(x.to.id)) && !(x.from.kind === 'requirement' && drop.has(x.from.id)));
    });
    for (const s of [BRAVO, `programs:${f.programs[2].name}`]) {
      const c = ev(ctx, s).findings.find((x) => x.id === 'BR-004')!;
      assert.equal(c.category, 'reconciliation');
      assert.equal(c.outcome, 'REQUIRES_SME_DECISION');
      assert.deepEqual(c.decisions, ['DR-CONSOLIDATION-001']);
    }
    assert.equal(resolve(ctx, f, 'DR-CONSOLIDATION-001', 'resolved_no_change', k.bob, SIGNERS.bob, 'business_sme').r.recorded, true);
    assert.equal(ev(ctx, BRAVO).findings.find((x) => x.id === 'BR-004')!.outcome, 'VERIFIED');
  });

  test('6. missing source evidence is never upgraded: reverse-artifact-only and unverifiable claims require evidence', () => {
    const { f, ctx } = setup();
    deliver(f, ctx);
    const r = ev(ctx, BRAVO).findings.find((x) => x.kind === 'requirement')!;
    assert.equal(r.outcome, 'REQUIRES_EVIDENCE');
    assert.match(r.reasons.join(' '), /reverse artifacts only/);
    // Same verified_from_source claim, but the source is no longer reachable: it cannot be confirmed.
    const { f: f2, ctx: c2 } = setup();
    deliver(f2, c2, verifiedClaim(f2));
    fs.rmSync(path.join(f2.sourceRoot, f2.programs[1].rel));
    const r2 = ev(c2, BRAVO).findings.find((x) => x.kind === 'requirement')!;
    assert.equal(r2.outcome, 'REQUIRES_EVIDENCE');
    assert.match(r2.reasons.join(' '), /not confirmed|not available/);
  });

  test('7. a citation mismatch is CONTRADICTED and cannot be waived by an exception', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f, 12));
    const r = ev(ctx, BRAVO).findings.find((x) => x.kind === 'requirement')!;
    assert.equal(r.outcome, 'CONTRADICTED');
    assert.match(r.reasons.join(' '), /outside .*STMT-000001/);
    const rv = buildSnapshot(wf(ctx)).register.get(`RVW-${r.id}`)!;
    assert.ok(!rv.allowed_outcomes.includes('approved_exception'));
    const x = resolve(ctx, f, rv.decision_id, 'approved_exception', k.carol, SIGNERS.carol, 'exception_approver');
    assert.equal(x.r.recorded, false);
    assert.ok(failed(x.r).includes('outcome_allowed'));
  });

  test('8. a contradicted runtime claim blocks its scope', () => {
    const { f, ctx } = setup();
    deliver(f, ctx, (a, unit, docs) => {
      if (a !== 'F2' || unit !== f.programs[1].name) return;
      docs['file_operation_requirements.json'].programs[0].compatibility_requirements = [{ statement: 'The limit check compares against 500.', evidence_status: 'verified_from_source', source_refs: [{ file_id: f.programs[1].fileId, statement_id: `${f.programs[1].fileId}-STMT-000002`, line: 8 }] }];
    });
    const rt = ev(ctx, BRAVO).findings.find((x) => x.kind === 'runtime_requirement')!;
    assert.equal(rt.id, 'RT-BRAVO02-001');
    assert.equal(rt.outcome, 'CONTRADICTED');
    assert.equal(rt.blocking, true);
  });
});

describe('S4-B. decision resolution', () => {
  test('9. an authorised signed resolution is recorded, bound and superseded only explicitly', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    const a = resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.bob, SIGNERS.bob, 'business_sme');
    assert.equal(a.r.recorded, true, JSON.stringify(failed(a.r)));
    const st = buildSnapshot(wf(ctx)).resolutions.get('SCOPE-BRAVO02')!;
    assert.equal(st.status, 'resolved');
    assert.equal(st.effective.resolution.decision_sha256, buildSnapshot(wf(ctx)).register.get('SCOPE-BRAVO02')!.sha256);
    // A second resolution must name the one it supersedes; both stay on record.
    const noSup = resolve(ctx, f, 'SCOPE-BRAVO02', 'excluded_from_scope', k.bob, SIGNERS.bob, 'business_sme', (r) => (r.supersedes = null));
    assert.ok(failed(noSup.r).includes('supersession'));
    const b = resolve(ctx, f, 'SCOPE-BRAVO02', 'excluded_from_scope', k.bob, SIGNERS.bob, 'business_sme');
    assert.equal(b.r.recorded, true);
    const st2 = buildSnapshot(wf(ctx)).resolutions.get('SCOPE-BRAVO02')!;
    assert.equal(st2.effective.resolution_id, b.r.resolution_id);
    assert.deepEqual(st2.history, [a.r.resolution_id, b.r.resolution_id]);
    assert.ok(fs.existsSync(wf(ctx).store.p('decisions', `${a.r.resolution_id}.json`)), 'the superseded resolution is preserved');
  });

  test('10. unauthorised, agent, tampered, replayed and stale resolutions are rejected', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    assert.ok(failed(resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.mallory, SIGNERS.mallory, 'business_sme').r).includes('signature'), 'signer without the role');
    assert.ok(failed(resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.carol, SIGNERS.carol, 'exception_approver').r).includes('role_claimed'), 'exception approver cannot answer a scope decision');
    const agent = resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.agent, SIGNERS.agent, 'business_sme').r;
    assert.ok(failed(agent).includes('not_agent') && failed(agent).includes('signature'), 'an agent identity can never resolve a decision');
    assert.ok(failed(resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.eve, SIGNERS.eve, 'business_sme').r).includes('signature'), 'unknown signer');
    const t = resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.bob, SIGNERS.bob, 'business_sme', undefined, true);
    assert.equal(t.r.ok, true, 'dry run validates without recording');
    t.signed.resolution.justification = 'Changed after signing to a different justification';
    fs.writeFileSync(t.file, JSON.stringify(t.signed));
    assert.ok(failed(resolveDecision(wf(ctx), t.file, { build: (w) => buildSnapshot(w) })).includes('signature'), 'tampered after signing');
    const ok = resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.bob, SIGNERS.bob, 'business_sme');
    assert.equal(ok.r.recorded, true);
    assert.ok(failed(resolveDecision(wf(ctx), ok.file, { build: (w) => buildSnapshot(w) })).includes('not_replayed'), 'replay');
    const stale = resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.bob, SIGNERS.bob, 'business_sme', (r) => (r.decision_sha256 = digest('older')));
    assert.ok(failed(stale.r).includes('decision_binding'));
    const audit = wf(ctx).store.readAudit().filter((e) => e.event === 'decision_resolution_rejected');
    assert.ok(audit.length >= 6, 'every rejection is audited');
    assert.equal(wf(ctx).store.list('decisions').length, 1, 'only the authorised resolution was recorded');
  });
});

describe('S4-C. signed approval', () => {
  test('11. a verified signed approval of a READY scope passes G2 and authorises REQUIREMENTS_APPROVED', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    assert.equal(resolveScope(ctx, f, k, BRAVO).readiness, 'READY');
    assert.equal(advance(wf(ctx), 'REQUIREMENTS_APPROVED').accepted, false, 'no approval yet');
    const a = approve(ctx, f, k, BRAVO);
    assert.equal(a.r.imported, true, JSON.stringify(failed(a.r)));
    const g2 = runGate(wf(ctx), 'G2');
    assert.equal(g2.status, 'PASS', g2.reason + ' ' + JSON.stringify(g2.checks.filter((c) => c.status === 'fail')));
    assert.ok(g2.inputs.some((i) => i.kind === 'g2_evaluation') && g2.inputs.some((i) => i.kind === 'approval'));
    const t = advance(wf(ctx), 'REQUIREMENTS_APPROVED');
    assert.equal(t.accepted, true, t.reason);
    assert.match(wf(ctx).state.history.at(-1)!.evidence!, /^gates\/G2-/);
  });

  test('12. unknown signers and signers without the approver role are rejected', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    resolveScope(ctx, f, k, BRAVO);
    const req = createApprovalRequest(wf(ctx), BRAVO, 'dave.requester');
    assert.ok(failed(approve(ctx, f, k, BRAVO, { request: req, signer: [SIGNERS.eve, k.eve, 'requirements_approver'] }).r).includes('signature'));
    assert.ok(failed(approve(ctx, f, k, BRAVO, { request: req, signer: [SIGNERS.bob, k.bob, 'requirements_approver'] }).r).includes('role'));
    assert.ok(failed(approve(ctx, f, k, BRAVO, { request: req, signer: [SIGNERS.alice, k.bob, 'requirements_approver'] }).r).includes('signature'), "someone else's key");
    assert.equal(runGate(wf(ctx), 'G2').status, 'UNVERIFIED');
  });

  test('13. a tampered statement or request is rejected', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    resolveScope(ctx, f, k, BRAVO);
    const req = createApprovalRequest(wf(ctx), BRAVO, 'dave.requester');
    const rej = approve(ctx, f, k, BRAVO, { request: req, decision: 'rejected', tamper: (s) => (s.statement.decision = 'approved') });
    assert.ok(failed(rej.r).includes('signature'), 'decision flipped after signing');
    const reqFile = wf(ctx).store.p('approvals', 'requests', `${req.request_id}.json`);
    const doc = JSON.parse(fs.readFileSync(reqFile, 'utf8'));
    doc.payload.requested_by = 'someone.else';
    fs.writeFileSync(reqFile, JSON.stringify(doc, null, 2) + '\n');
    assert.ok(failed(approve(ctx, f, k, BRAVO, { request: req }).r).includes('request_intact'));
  });

  test('14. an approval for content that changed since the request is stale', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, (a, unit, docs, packet) => {
      verifiedClaim(f)(a, unit, docs, packet);
      if (a === 'F1' && unit === f.programs[1].name) docs['draft_requirements.json'].requirements[0].statement = 'Two checks apply: the program sets the processing limit to 1000.';
    });
    resolveScope(ctx, f, k, BRAVO);
    const req = createApprovalRequest(wf(ctx), BRAVO, 'dave.requester');
    const pk = wf(ctx).store.list('receipts').map((x) => wf(ctx).store.readRecord<any>('receipts', x)).find((r) => r.receipt.agent === 'F1' && r.packet_id && readPacket(f.repoRoot, f.runsDir, RUN, r.packet_id).units[0].name === f.programs[1].name)!.packet_id;
    const c = correct(wf(ctx), { packet: pk, file: 'draft_requirements.json', pointer: '/requirements/0/statement', kind: 'count_word', count_pointer: '/requirements/0/source_refs', reason: 'count disagrees with cited references' });
    assert.match(c.new_value, /^One checks apply/);
    const a = approve(ctx, f, k, BRAVO, { request: req });
    assert.equal(a.r.imported, false);
    assert.ok(failed(a.r).includes('scope_current'), JSON.stringify(failed(a.r)));
  });

  test('15. a changed source or reverse baseline invalidates an imported approval', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    resolveScope(ctx, f, k, BRAVO);
    assert.equal(approve(ctx, f, k, BRAVO).r.imported, true);
    assert.equal(runGate(wf(ctx), 'G2').status, 'PASS');
    fs.appendFileSync(path.join(f.sourceRoot, f.programs[1].rel), '      * edited after approval\n');
    const g = runGate(wf(ctx), 'G2');
    assert.equal(g.status, 'UNVERIFIED');
    assert.match(g.checks.find((c) => c.id === 'human_approval')!.detail, /stale/);
    const inv = f.read('output/inventory/inventory_artifact.json');
    inv.stats.programs = 99;
    f.write('output/inventory/inventory_artifact.json', inv);
    assert.equal(runGate(wf(ctx), 'G2').status, 'FAIL', 'reverse baseline changed');
  });

  test('16. replayed approvals and statements bound to another scope are rejected', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    resolveScope(ctx, f, k, BRAVO);
    const first = approve(ctx, f, k, BRAVO);
    assert.equal(first.r.imported, true);
    assert.ok(failed(importApproval(wf(ctx), first.file)).includes('not_replayed'));
    const reqScope = `requirements:${ev(ctx, BRAVO).findings.find((x) => x.kind === 'requirement')!.id}`;
    const other = createApprovalRequest(wf(ctx), reqScope, 'dave.requester');
    assert.notEqual(other.payload.scope.scope_sha256, first.req.payload.scope.scope_sha256);
    const mixed = approve(ctx, f, k, reqScope, { request: other, tamper: (s) => {
      s.statement.scope_sha256 = first.req.payload.scope.scope_sha256;
      s.signature.value = sign(statementText(s.statement), k.alice);
    } });
    assert.ok(failed(mixed.r).includes('statement_binding'));
  });

  test('17. without a trust anchor nothing can be approved or resolved, and G2 stays UNVERIFIED', () => {
    const { f, ctx, k } = setup({ trust: false });
    deliver(f, ctx, verifiedClaim(f));
    const r = resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.bob, SIGNERS.bob, 'business_sme');
    assert.equal(r.r.recorded, false);
    assert.match(r.r.checks.find((c: any) => c.id === 'signature').detail, /no trust store/);
    const g2 = runGate(wf(ctx), 'G2');
    assert.equal(g2.status, 'UNVERIFIED');
    assert.match(g2.checks.find((c) => c.id === 'trust_anchor')!.detail, /no trust store is configured/);
    // A store inside the workflow run directory is not a trust anchor.
    process.env.REVFORGE_APPROVAL_TRUST_STORE = path.join(f.runsDir, 'trust.json');
    fs.copyFileSync(path.join(f.repoRoot, 'trust', 'trust-store.json'), process.env.REVFORGE_APPROVAL_TRUST_STORE);
    assert.equal(buildSnapshot(wf(ctx)).trust.usable, false);
    // Private keys are refused outright.
    process.env.REVFORGE_APPROVAL_TRUST_STORE = path.join(f.repoRoot, 'bad-trust.json');
    fs.writeFileSync(process.env.REVFORGE_APPROVAL_TRUST_STORE, JSON.stringify({ contract: 'approval-trust-store', note: k.bob.privateKey.export({ type: 'pkcs8', format: 'pem' }) }));
    assert.match(buildSnapshot(wf(ctx)).trust.problems.join(' '), /private key/);
  });

  test('18. self-approval and agent requesters are rejected', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    resolveScope(ctx, f, k, BRAVO);
    assert.throws(() => createApprovalRequest(wf(ctx), BRAVO, 'fe-requirements-analyst'), /human requester/);
    const self = approve(ctx, f, k, BRAVO, { requestedBy: SIGNERS.alice });
    assert.ok(failed(self.r).includes('not_self_approval'));
    const agent = approve(ctx, f, k, BRAVO, { signer: [SIGNERS.agent, k.agent, 'requirements_approver'] });
    assert.ok(failed(agent.r).includes('not_self_approval') && failed(agent.r).includes('signature'));
    assert.equal(runGate(wf(ctx), 'G2').status, 'UNVERIFIED');
  });
});

describe('S4-D. packets, receipts and workflow protection', () => {
  test('19. superseded packets are recorded with justification; still-required packets block', () => {
    const { f, ctx } = setup({ skills: false });
    const legacy = prepare(wf(ctx), 'F1');
    assert.equal(legacy.dispatchable, false);
    installSkills(f);
    deliver(f, ctx, verifiedClaim(f));
    const before = ev(ctx, BRAVO).findings.find((x) => x.id === legacy.packet_id)!;
    assert.equal(before.blocking, true);
    assert.match(before.reasons[0], /not yet recorded/);
    const rec = recordPacketReview(wf(ctx));
    assert.equal(rec.packets.find((p: any) => p.packet_id === legacy.packet_id).status, 'superseded');
    assert.equal(ev(ctx, BRAVO).findings.find((x) => x.id === legacy.packet_id)!.outcome, 'EXCLUDED_WITH_JUSTIFICATION');
    const s = status(wf(ctx));
    assert.ok(!s.packets.awaiting_receipt.includes(legacy.packet_id) && s.packets.superseded.includes(legacy.packet_id));
    assert.equal(wf(ctx).store.list('receipts').filter((x) => x.includes(legacy.packet_id)).length, 0, 'no receipt is fabricated');
    // A dispatchable packet nobody delivered is still required.
    const open = prepare(wf(ctx), 'F1', { programs: [f.programs[1].name] });
    assert.equal(recordPacketReview(wf(ctx)).packets.find((p: any) => p.packet_id === open.packet_id).status, 'still_required');
    assert.ok(ev(ctx, BRAVO).findings.find((x) => x.id === open.packet_id)!.blocking);
  });

  test('20. receipts and deliverables stay byte-identical; a modified deliverable fails G2', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    const dir = wf(ctx).store.p('receipts');
    const agents = wf(ctx).store.p('agents');
    const before = { ...hashTree(dir), ...hashTree(agents) };
    resolveScope(ctx, f, k, BRAVO);
    approve(ctx, f, k, BRAVO);
    runGate(wf(ctx), 'G2');
    recordPacketReview(wf(ctx));
    assert.deepEqual({ ...hashTree(dir), ...hashTree(agents) }, before);
    const doc = Object.keys(before).find((x) => x.endsWith('data_mappings.json'))!;
    fs.appendFileSync(path.join(agents, doc), ' ');
    const g = runGate(wf(ctx), 'G2');
    assert.equal(g.status, 'FAIL');
    assert.match(g.reason, /modified after acceptance/);
  });

  test('21/22. transitions: approval authorises REQUIREMENTS_APPROVED; later changes block the workflow and F3', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    const r0 = advance(wf(ctx), 'REQUIREMENTS_APPROVED');
    assert.equal(r0.accepted, false);
    assert.match(r0.reason, /G2 has not passed/);
    resolveScope(ctx, f, k, BRAVO);
    approve(ctx, f, k, BRAVO);
    assert.equal(advance(wf(ctx), 'REQUIREMENTS_APPROVED').accepted, true);
    assert.equal(advance(wf(ctx), 'ARCHITECTURE_DRAFTED').accepted, false, 'needs an F3 receipt');
    // A new signed resolution changes the approved content: the approval no longer verifies.
    resolve(ctx, f, 'SCOPE-BRAVO02', 'resolved_no_change', k.bob, SIGNERS.bob, 'business_sme', (r) => (r.resolution_text = 'Re-confirmed with a different rationale'));
    assert.equal(runGate(wf(ctx), 'G2').status, 'UNVERIFIED');
    assert.equal(wf(ctx).state.state, 'BLOCKED');
    assert.match(wf(ctx).state.blockers[0], /G2 approval no longer valid/);
    assert.throws(() => prepare(wf(ctx), 'F3'), /may only be dispatched|G2 has not passed/);
    const back = advance(wf(ctx), 'REQUIREMENTS_APPROVED');
    assert.equal(back.accepted, false, 'unblocking re-evaluates G2');
    assert.match(back.reason, /G2 still UNVERIFIED/);
  });

  test('23/24/25. G3-G8 stay protected, Java stays blocked, reverse files are untouched', () => {
    const { f, ctx, k } = setup();
    const outBefore = hashTree(path.join(f.repoRoot, 'output'));
    const srcBefore = hashTree(f.sourceRoot);
    deliver(f, ctx, verifiedClaim(f));
    resolveScope(ctx, f, k, BRAVO);
    approve(ctx, f, k, BRAVO);
    assert.equal(runGate(wf(ctx), 'G2').status, 'PASS');
    assert.notEqual(runGate(wf(ctx), 'G3').status, 'PASS');
    assert.equal(generationAuthorized(wf(ctx).run, wf(ctx).state), false);
    assert.throws(() => prepare(wf(ctx), 'F5'), /may only be dispatched/);
    assert.deepEqual(hashTree(path.join(f.repoRoot, 'output')), outBefore);
    assert.deepEqual(hashTree(f.sourceRoot), srcBefore);
  });

  test('approval files verify read-only and an approval rejection is recorded but never passes', () => {
    const { f, ctx, k } = setup();
    deliver(f, ctx, verifiedClaim(f));
    resolveScope(ctx, f, k, BRAVO);
    const req = createApprovalRequest(wf(ctx), BRAVO, 'dave.requester');
    const st = approvalStatement(req, SIGNERS.alice, 'requirements_approver', 'rejected');
    const file = path.join(f.repoRoot, 'rejected.json');
    fs.writeFileSync(file, JSON.stringify({ contract: 'signed-approval', statement: st, signature: { algorithm: 'ed25519', value: sign(statementText(st), k.alice) } }));
    const audit = wf(ctx).store.readAudit().length;
    assert.equal(verifyApprovalFile(wf(ctx), file).ok, true);
    assert.equal(wf(ctx).store.readAudit().length, audit, 'verify does not write');
    assert.equal(importApproval(wf(ctx), file).imported, true);
    assert.equal(runGate(wf(ctx), 'G2').status, 'UNVERIFIED', 'a signed rejection never passes G2');
  });
});
