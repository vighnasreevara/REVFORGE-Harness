/**
 * STEP 13 tests: typed behaviour scopes (functional and runtime requirements),
 * the deterministic dependency closure, shared-decision attribution, deferred
 * gaps, and scoped Ed25519 approval (synthetic signers in isolated fixtures
 * only). The real run is used read-only as the RTNCDE00 regression.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'crypto';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { generationAuthorized, loadWorkflow, runGate } from '../runtime/src/orchestrator/orchestrator';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { evaluateScope, parseSelector, selectorText } from '../runtime/src/approval/scope';
import { approvalStatement, createApprovalRequest, evaluateG2Gate, importApproval, statementText } from '../runtime/src/approval/approvals';
import { behaviourClosure } from '../runtime/src/approval/closure';
import { approvedScope, validateArchitecture } from '../runtime/src/design/design';
import { trustDoctor } from '../runtime/src/operations/trust';
import { behaviourScope } from '../runtime/src/pilot/scope';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { KP, SIGNERS, signText, wfOf } from './helpers/g2fixture';
import { designFixture } from './helpers/designfixture';
import { contextFixture } from './helpers/contextfixture';

const REPO = path.resolve(FORWARD_DIR, '..');
const fixtures: Fixture[] = [];
after(() => {
  for (const f of fixtures.splice(0)) cleanup(f);
});
const BEH = 'behaviour:BRAVO02:P1:requirement=REQ-BRAVO02-001';

/** A READY behaviour scope in the synthetic workflow, with a signed-approval helper (synthetic keys, in memory). */
function scopedFixture() {
  const out = designFixture(fixtures, { approveG2: false });
  const sign = (req: any, signer: string = SIGNERS.approver, kp: KP = out.k.approver) => {
    const st = approvalStatement(req, signer, 'requirements_approver', 'approved');
    const file = path.join(out.f.repoRoot, `g2-scoped-${Date.now()}-${Math.random()}.json`);
    fs.writeFileSync(file, JSON.stringify({ contract: 'signed-approval', statement: st, signature: { algorithm: 'ed25519', value: signText(statementText(st), kp) } }));
    return file;
  };
  return { ...out, sign };
}
const programFile = (f: Fixture) => path.join(f.repoRoot, 'cobol-src', f.programs[1].rel);

/* ------------------------------------------------------------------ */
describe('STEP 13 - behaviour scopes on synthetic fixtures', () => {
  test('9. an unknown name in the behaviour makes the closure UNRESOLVED and blocks the scope', () => {
    const { ctx, req } = contextFixture(fixtures, { progExtra: ['           IF MYSTERY-FLAG = 1', '              MOVE 2 TO WS-LIMIT', '           END-IF.'] });
    const ev = evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(`behaviour:BRAVO02:P1:requirement=${req}`));
    assert.equal(ev.behaviour!.closure.status, 'UNRESOLVED');
    assert.ok(ev.behaviour!.closure.unresolved_reasons.some((r) => /MYSTERY-FLAG .*unknown dependency/.test(r)));
    const f = ev.findings.find((x) => x.kind === 'unresolved_closure')!;
    assert.equal(f.blocking, true);
    assert.equal(ev.readiness, 'NOT_READY');
  });

  test('4/5. indirect SQL (a consumed input written by embedded SQL elsewhere) and CALL closure are never treated as independent', () => {
    const sql = contextFixture(fixtures, { progExtra: ['           GOBACK.', '       P2.', '           EXEC SQL SELECT C INTO :WS-LIMIT FROM TAB1 END-EXEC.'] });
    const c = behaviourClosure(buildSnapshot(wfOf(sql.ctx)), 'BRAVO02', 'P1');
    const w = c.input_writers.find((x) => x.field === 'WS-LIMIT' && x.sql)!;
    assert.ok(w, 'the SQL writer of WS-LIMIT is part of the closure');
    assert.ok(c.external.some((e) => e.kind === 'embedded_sql' && e.relation === 'input_writer'));
    const ev = evaluateScope(buildSnapshot(wfOf(sql.ctx)), parseSelector(`behaviour:BRAVO02:P1:requirement=${sql.req}`));
    assert.ok(ev.findings.some((x) => x.kind === 'closure_gap' && /SQL-SELECT-TAB1/.test(x.id) && x.blocking), 'the transitive SQL gap blocks');
    const call = contextFixture(fixtures, { progExtra: ["           CALL 'NOPROG01'."] });
    const cc = behaviourClosure(buildSnapshot(wfOf(call.ctx)), 'BRAVO02', 'P1');
    assert.equal(cc.status, 'UNRESOLVED');
    assert.ok(cc.unresolved_reasons.some((r) => /NOPROG01.*not in the inventory/.test(r)));
  });

  test('18/19/21. a valid synthetic scoped approval passes G2 for that subset only; G3 sees only its requirements', () => {
    const { f, ctx, sign } = scopedFixture();
    const wf = wfOf(ctx);
    const ev = evaluateScope(buildSnapshot(wf), parseSelector(BEH));
    assert.equal(ev.readiness, 'READY', JSON.stringify(ev.findings.filter((x) => x.blocking)));
    const req = createApprovalRequest(wf, BEH, 'dave.requester');
    assert.equal(req.payload.scope.behaviour.closure_sha256, ev.behaviour!.closure.sha256);
    assert.deepEqual(req.payload.scope.behaviour.items.map((i: any) => i.id), ['REQ-BRAVO02-001']);
    assert.match(req.payload.scope.behaviour.covers_only, /approves nothing else in BRAVO02/);
    const r = importApproval(wf, sign(req));
    assert.equal(r.imported, true, JSON.stringify(r.checks?.filter((c: any) => !c.ok)));
    assert.equal(runGate(wf, 'G2').status, 'PASS');
    const s = approvedScope(wf, buildSnapshot(wf));
    assert.equal(s.ok, true);
    assert.equal(s.scope, selectorText(parseSelector(BEH)));
    assert.deepEqual(s.requirements.map((x) => x.id), ['REQ-BRAVO02-001']);
    // 19: the program scope is a different scope with a different digest; the approval never stands for it.
    const prog = evaluateScope(buildSnapshot(wf), parseSelector('programs:BRAVO02'));
    assert.notEqual(prog.scope_sha256, s.scope_sha256);
    assert.notEqual(s.ev!.selector.kind, 'programs');
    // 21: an architecture citing a requirement outside the approved subset is refused by the existing G3 check.
    const arch = { agent: 'F3' as const, receipt_id: 'RCT-X', files: [], sha256: 'x', problems: [], docs: { 'c.json': { contract: 'forward/architecture-record', record_type: 'component_design', baseline: { manifest_sha256: wf.run.manifestSha256 }, approved_inputs: { requirements_approval: s.approval_id }, components: [{ component_id: 'C1', requirement_ids: ['REQ-BRAVO02-001', 'REQ-ALPHA01-001'], replaces_units: [], depends_on: [] }] } } };
    const v = validateArchitecture(wf, buildSnapshot(wf), s, arch);
    assert.equal(v.checks.find((c) => c.id === 'requirements_in_scope')!.ok, false);
    // 22: G2 PASS for a subset never authorises Java generation.
    assert.equal(generationAuthorized(wf.run, wf.state), false);
    void f;
  });

  test('15/16/17. stale source, changed closure and replay are rejected', () => {
    const a = scopedFixture();
    const req = createApprovalRequest(wfOf(a.ctx), BEH, 'dave.requester');
    const file = a.sign(req);
    fs.appendFileSync(programFile(a.f), '      * comment only: the source bytes change\n');
    const r = importApproval(wfOf(a.ctx), file);
    assert.equal(r.imported, false, 'stale source hash');
    assert.ok(r.checks.some((c: any) => c.id === 'scope_current' && !c.ok));

    const b = scopedFixture();
    const reqB = createApprovalRequest(wfOf(b.ctx), BEH, 'dave.requester');
    const before = evaluateScope(buildSnapshot(wfOf(b.ctx)), parseSelector(BEH)).behaviour!.closure.sha256;
    const src = fs.readFileSync(programFile(b.f), 'utf8').replace('           GOBACK.', '           MOVE 7 TO WS-LIMIT.\n           GOBACK.');
    fs.writeFileSync(programFile(b.f), src);
    assert.notEqual(evaluateScope(buildSnapshot(wfOf(b.ctx)), parseSelector(BEH)).behaviour!.closure.sha256, before, 'closure changed');
    assert.equal(importApproval(wfOf(b.ctx), b.sign(reqB)).imported, false, 'changed dependency closure');

    const c = scopedFixture();
    const reqC = createApprovalRequest(wfOf(c.ctx), BEH, 'dave.requester');
    const fileC = c.sign(reqC);
    assert.equal(importApproval(wfOf(c.ctx), fileC).imported, true);
    assert.equal(importApproval(wfOf(c.ctx), fileC).imported, false, 'a replayed approval is not imported twice');
  });

  test('20. unknown signers, self-approval and the wrong subset are rejected', () => {
    const { ctx, sign } = scopedFixture();
    const wf = wfOf(ctx);
    const req = createApprovalRequest(wf, BEH, 'dave.requester');
    const mallory = generateKeyPairSync('ed25519');
    assert.equal(importApproval(wf, sign(req, 'mallory.unknown', mallory)).imported, false, 'unknown signer');
    const self = createApprovalRequest(wf, BEH, SIGNERS.approver);
    assert.equal(importApproval(wf, sign(self)).imported, false, 'self-approval');
    // The program scope is not READY here, so a subset approval can never be turned into a program request.
    assert.throws(() => createApprovalRequest(wf, 'programs:BRAVO02,ALPHA01,CHARLIE3', 'dave.requester'), /not ready/);
  });

  test('23. audit history is append-only across scoped requests and imports', () => {
    const { ctx, sign } = scopedFixture();
    const wf = wfOf(ctx);
    const before = fs.readFileSync(wf.store.p('audit.jsonl'), 'utf8');
    importApproval(wf, sign(createApprovalRequest(wf, BEH, 'dave.requester')));
    const now = fs.readFileSync(wf.store.p('audit.jsonl'), 'utf8');
    assert.ok(now.startsWith(before), 'earlier audit entries are unchanged');
    assert.equal(wf.store.verifyCheckpoint().ok, true);
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 13 - RTNCDE00 regression on the real run (read-only)', () => {
  const realRunsDir = path.resolve(FORWARD_DIR, 'runs');
  const run = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
  const src = process.env.REVFORGE_COBOL_SOURCE_ROOT || path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
  const skip = !run || !fs.existsSync(src);
  const P200 = 'behaviour:RTNCDE00:P200-SET-RETURN-CODE:requirement=REQ-RTNCDE00-002,requirement=REQ-RTNCDE00-003,runtime_requirement=RT-RTNCDE00-001';
  let cache: any = null;
  const real = () => {
    if (cache) return cache;
    process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    const wf = loadWorkflow(ctx, run!);
    const audit = sha256File(wf.store.p('audit.jsonl'));
    const snap = buildSnapshot(wf);
    cache = { ctx, wf, snap, audit, ev: (s: string) => evaluateScope(snap, parseSelector(s)) };
    return cache;
  };

  test('1/2. typed mixed scopes: canonical identity, exact digest, wrong kinds refused; requirements selectors unchanged', { skip }, () => {
    const { ev } = real();
    const a = ev(P200);
    const b = ev('behaviour:RTNCDE00:P200-SET-RETURN-CODE:runtime_requirement=RT-RTNCDE00-001,requirement=REQ-RTNCDE00-003,requirement=REQ-RTNCDE00-002');
    assert.equal(a.selector_text, b.selector_text, 'order-independent canonical identity');
    assert.equal(a.scope_sha256, b.scope_sha256);
    assert.deepEqual(a.behaviour!.items.map((i: any) => `${i.kind}=${i.id}`), ['requirement=REQ-RTNCDE00-002', 'requirement=REQ-RTNCDE00-003', 'runtime_requirement=RT-RTNCDE00-001']);
    assert.ok(a.behaviour!.items.every((i: any) => /^[0-9a-f]{64}$/.test(i.sha256)));
    assert.notEqual(a.scope_sha256, ev('programs:RTNCDE00').scope_sha256);
    assert.notEqual(a.scope_sha256, ev('behaviour:RTNCDE00:P200-SET-RETURN-CODE:requirement=REQ-RTNCDE00-002,requirement=REQ-RTNCDE00-003').scope_sha256);
    assert.throws(() => ev('behaviour:RTNCDE00:P200-SET-RETURN-CODE:runtime_requirement=REQ-RTNCDE00-002'), /wrong ID, kind or program/);
    assert.throws(() => ev('requirements:RT-RTNCDE00-001'), /unknown requirements/, 'the existing requirements selector is not loosened');
  });

  test('3/6. P200 closure: direct fields with permanent IDs, level-88 conditions of RTNCODE, PERFORM THRU range, trigger', { skip }, () => {
    const c = real().ev(P200).behaviour!.closure;
    assert.equal(c.status, 'RESOLVED');
    assert.equal(c.source!.sha256, '7cb951ea1f418c19ddd61c0eca00f21108af5f364b5ecf05742cbc428862994e');
    assert.deepEqual(c.range, ['P200-SET-RETURN-CODE', 'P200-EXIT']);
    const direct = c.statements.filter((s: any) => s.relation === 'direct').map((s: any) => s.line);
    assert.equal(Math.min(...direct), 64);
    assert.ok(direct.includes(81));
    assert.ok(c.statements.some((s: any) => s.relation === 'trigger' && s.line === 37));
    const f = Object.fromEntries(c.fields.map((x: any) => [x.name, x]));
    assert.equal(f['RC-NEW-CODE'].permanent_id, 'SYS-PORTFOLIO-001-FIL-0013-FLD-000011');
    for (const [n, v, l] of [['RC-STATUS-SUCCESS', 'S', 17], ['RC-STATUS-WARNING', 'W', 18], ['RC-STATUS-ERROR', 'E', 19], ['RC-STATUS-SEVERE', 'F', 20]] as const) {
      assert.equal(f[n].kind, 'condition');
      assert.deepEqual(f[n].values, [v]);
      assert.equal(f[n].line, l);
    }
    assert.deepEqual(c.units.map((u: any) => u.name).sort(), ['RTNCDE00', 'RTNCODE']);
    assert.deepEqual(c.inputs, ['RC-HIGHEST-CODE', 'RC-NEW-CODE']);
    assert.ok(c.input_writers.every((w: any) => !w.sql && !w.depends_on.length), 'its inputs are produced only by SQL-free, decision-free statements');
    assert.deepEqual(c.external, []);
  });

  test('7/8. SQLCA decisions apply to P400 and to the program, and are excluded from P200 with recorded reasons', { skip }, () => {
    const { ev } = real();
    const p200 = Object.fromEntries(ev(P200).behaviour!.decision_attribution.map((a: any) => [a.decision_id, a]));
    for (const id of ['DR-DB2CONN-002', 'DR-F2-0011-001']) {
      assert.equal(p200[id].applicable, false, id);
      assert.ok(p200[id].reason.length > 20);
    }
    assert.match(p200['DR-F2-0011-001'].reason, /no closure statement or input writer is embedded SQL/);
    const p400 = ev('behaviour:RTNCDE00:P400-LOG-RETURN-CODE:runtime_requirement=RT-RTNCDE00-002');
    const a400 = Object.fromEntries(p400.behaviour!.decision_attribution.map((a: any) => [a.decision_id, a]));
    assert.equal(a400['DR-DB2CONN-002'].applicable, true);
    assert.equal(a400['DR-F2-0011-001'].applicable, true);
    assert.ok(p400.behaviour!.closure.units.some((u: any) => u.name === 'SQLCA'));
    const prog = ev('programs:RTNCDE00');
    for (const id of ['DR-DB2CONN-002', 'DR-F2-0011-001']) assert.ok(prog.findings.some((x: any) => x.id === id && x.blocking), `${id} still blocks the program`);
  });

  test('10/11/14. a missing runtime requirement, an omitted rule and invalidated evidence all block', { skip }, () => {
    const { ev } = real();
    const noRt = ev('behaviour:RTNCDE00:P200-SET-RETURN-CODE:requirement=REQ-RTNCDE00-002,requirement=REQ-RTNCDE00-003');
    assert.ok(noRt.findings.some((x: any) => x.kind === 'missing_required_item' && x.id === 'RT-RTNCDE00-001' && x.blocking));
    const no002 = ev('behaviour:RTNCDE00:P200-SET-RETURN-CODE:requirement=REQ-RTNCDE00-003,runtime_requirement=RT-RTNCDE00-001');
    assert.ok(no002.findings.some((x: any) => x.kind === 'omitted_rule' && x.id === 'BR-039' && x.blocking));
    assert.ok(no002.findings.some((x: any) => x.kind === 'missing_required_item' && x.id === 'REQ-RTNCDE00-002'));
    const full = ev(P200);
    const r2 = full.findings.find((x: any) => x.id === 'REQ-RTNCDE00-002');
    assert.equal(r2.outcome, 'REQUIRES_EVIDENCE');
    assert.ok(r2.reasons.some((x: string) => /EAR-0002/.test(x)));
    assert.deepEqual(full.findings.filter((x: any) => x.blocking).map((x: any) => x.id).sort(), ['REQ-RTNCDE00-002', 'REQ-RTNCDE00-003'], 'only its own evidence reviews block P200');
    assert.equal(full.readiness, 'NOT_READY');
  });

  test('12/13. every program gap is traced (same IDs as Step 12); numeric-range gaps are a supported domain, not legacy behaviour', { skip }, () => {
    const { ev, wf } = real();
    const b = ev(P200).behaviour!;
    const pilot = behaviourScope(wf, 'programs:RTNCDE00').programs[0].gaps.map((g: any) => g.gap_id).sort();
    assert.deepEqual(b.gaps.map((g: any) => g.gap_id).sort(), pilot);
    for (const g of b.gaps.filter((x: any) => !x.in_closure)) assert.match(g.handoff, /still applies to the full program/);
    const trunc = ev(P200).findings.filter((x: any) => x.kind === 'deferred_domain');
    assert.equal(trunc.length, 2);
    for (const t of trunc) {
      assert.equal(t.blocking, false);
      assert.equal(t.outcome, 'EXCLUDED_WITH_JUSTIFICATION');
      assert.match(t.reasons[0], /fail explicitly as an unsupported pilot case/);
      assert.match(t.reasons[0], /No legacy result or rejection behaviour is implied/);
    }
  });

  test('20/22/23/24. real G2 stays blocked, no Java, nothing written, reverse outputs protected', { skip }, () => {
    const { wf, ctx, audit } = real();
    assert.equal(trustDoctor(ctx).status, 'TRUST_NOT_CONFIGURED');
    assert.notEqual(evaluateG2Gate(wf).result.status, 'PASS');
    assert.equal(generationAuthorized(wf.run, wf.state), false);
    assert.equal(spawnSync('git', ['-C', REPO, 'ls-files', '*.java'], { encoding: 'utf8' }).stdout.trim(), '');
    assert.equal(sha256File(wf.store.p('audit.jsonl')), audit, 'scope evaluation wrote nothing');
    assert.equal(spawnSync('git', ['-C', REPO, 'status', '--porcelain', '--', 'output', '.claude/agents', '.claude/skills'], { encoding: 'utf8' }).stdout.split('\n').filter((l) => l && !/^\?\? \.claude\/(agents|skills)\/fe-/.test(l)).join('\n'), '', 'reverse outputs and agents unchanged');
  });
});
