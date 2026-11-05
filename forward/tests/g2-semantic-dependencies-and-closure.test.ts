/**
 * STEP 12 tests: semantic dependency edges in G2 (a behaviour that uses a name
 * declared nowhere waits for the blocking decision about it), behaviour
 * classification, verified-subset requirement closure, the gap handoff, exact
 * scope hashes and the real workflow staying unapproved. Synthetic fixtures
 * for mechanisms; the real run is only read.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { generationAuthorized, loadWorkflow } from '../runtime/src/orchestrator/orchestrator';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { evaluateScope, parseSelector } from '../runtime/src/approval/scope';
import { evaluateG2Gate } from '../runtime/src/approval/approvals';
import { COBOL_WORDS, decisionNames, usesWord } from '../runtime/src/approval/semantic';
import { recordSemanticFindings, semanticFindings, semanticReport } from '../runtime/src/context/semantic-findings';
import { adjudications } from '../runtime/src/context/adjudication';
import { behaviourScope, classifyBehaviour, closure } from '../runtime/src/pilot/scope';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { signResolution, wfOf } from './helpers/g2fixture';
import { BRAVO, DESIGN_SIGNERS } from './helpers/designfixture';
import { contextFixture } from './helpers/contextfixture';

import { javaTrackingViolations } from './helpers/gitpolicy';
const REPO = path.resolve(FORWARD_DIR, '..');
const fixtures: Fixture[] = [];
after(() => {
  for (const f of fixtures.splice(0)) cleanup(f);
});

/** BRAVO02 whose paragraph also tests EXT-STATUS-CODE, a name declared nowhere, plus a blocking decision about it. */
function undeclaredFixture(o: { name?: string } = {}) {
  const name = o.name ?? 'EXT-STATUS-CODE';
  return contextFixture(fixtures, {
    progExtra: [`           IF ${name} = 0`, '              MOVE 1 TO WS-LIMIT', '           END-IF.'],
    extraEdit: (a, unit, docs, packet) => {
      if (a !== 'F1' || unit !== 'BRAVO02') return;
      const reg = docs['uncertainty_decision_register.json'];
      reg.decisions.push({ decision_request_id: 'DR-BRAVO02-901', kind: 'technical', question: `Which component supplies ${name}, and what do its values mean?`, blocking: true, blocking_rationale: 'the status meaning is not in the repository', status: 'open', affected_requirements: [], affected_units: [packet.units[0]], gap_refs: [], rule_refs: [], source_refs: [], evidence_status: 'unresolved', raised_by_skill: 'fe-uncertainty-decision-register' });
      // Keep the register's own blocker report consistent (the receipt validator checks it).
      reg.blocker_report.blocking_decisions = reg.decisions.filter((d: any) => d.blocking).map((d: any) => d.decision_request_id);
      reg.blocker_report.blocking_count = reg.blocker_report.blocking_decisions.length;
      reg.blocker_report.nonblocking_count = reg.decisions.length - reg.blocker_report.blocking_count;
    },
  });
}

/* ------------------------------------------------------------------ */
describe('STEP 12 - G2 semantic dependency edges', () => {
  test('1. a requirement whose behaviour uses an undeclared name waits for the blocking decision about it (fail-closed)', () => {
    const { ctx, req } = undeclaredFixture();
    const snap = buildSnapshot(wfOf(ctx));
    const it = snap.itemById.get(req)!;
    assert.deepEqual(it.semantic_dependencies!.map((d) => [d.decision_id, d.names, d.added]), [['DR-BRAVO02-901', ['EXT-STATUS-CODE'], true]]);
    assert.ok(it.semantic_dependencies![0].statements.some((s) => /IF EXT-STATUS-CODE = 0/.test(s.text)));
    const f = evaluateScope(snap, parseSelector(BRAVO)).findings.find((x) => x.id === req)!;
    assert.equal(f.blocking, true);
    assert.ok(f.decisions.includes('DR-BRAVO02-901'));
    assert.ok(f.reasons.some((r) => /blocked by DR-BRAVO02-901/.test(r)));
  });

  test('2. declared names never create an edge, and a signed resolution clears the edge through the normal path', () => {
    const declared = undeclaredFixture({ name: 'WS-LIMIT' });
    assert.equal(buildSnapshot(wfOf(declared.ctx)).itemById.get(declared.req)!.semantic_dependencies, undefined, 'WS-LIMIT is declared: no edge');
    const { f, ctx, dk, req } = undeclaredFixture();
    assert.ok(evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(BRAVO)).findings.find((x) => x.id === req)!.reasons.some((r) => /DR-BRAVO02-901/.test(r)));
    const r = signResolution(ctx, f, 'DR-BRAVO02-901', 'resolved_no_change', dk.techauth, DESIGN_SIGNERS.techauth, 'technical_authority');
    assert.equal(r.recorded, true, JSON.stringify(r.checks?.filter((c: any) => !c.ok)));
    const after = evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(BRAVO)).findings.find((x) => x.id === req)!;
    assert.ok(!after.reasons.some((x) => /blocked by DR-BRAVO02-901/.test(x)), 'resolved decisions no longer block');
  });

  test('3. only plausible data names count: literals, SQL text, reserved words, paragraph names never create edges', () => {
    assert.equal(usesWord("MOVE 'EXT-STATUS-CODE' TO X", 'EXT-STATUS-CODE'), false, 'a literal is not a name');
    assert.equal(usesWord('EXEC SQL SELECT COUNTER INTO :WS-A FROM TAB END-EXEC', 'COUNTER'), false, 'SQL column, not a COBOL name');
    assert.equal(usesWord('EXEC SQL SELECT C INTO :WS-AMOUNT FROM TAB END-EXEC', 'WS-AMOUNT'), true, 'host variable');
    assert.ok(COBOL_WORDS.has('WRITE') && COBOL_WORDS.has('NUMERIC') && COBOL_WORDS.has('GOBACK'));
    assert.deepEqual(decisionNames('Does SQLCODE in PROGRAM X mean what SELECT says?'), ['SQLCODE']);
  });

  test('4. recorded findings are versioned and sealed; unchanged findings are not re-recorded; earlier records untouched', () => {
    const { ctx } = undeclaredFixture();
    const wf = wfOf(ctx);
    const before = fs.readdirSync(wf.store.p('receipts')).map((x) => [x, sha256File(wf.store.p('receipts', x))]);
    const r = semanticReport(wf);
    assert.ok(r.results.length >= 1);
    const first = recordSemanticFindings(wf, r);
    assert.ok(first.every((x) => x.new));
    const again = recordSemanticFindings(wf, semanticReport(wf));
    assert.ok(again.every((x) => !x.new), 'unchanged findings are not re-recorded');
    assert.equal(semanticFindings(wf).length, first.length);
    assert.ok(wf.store.readAudit().some((e: any) => e.event === 'semantic_dependency_recorded'));
    assert.deepEqual(fs.readdirSync(wf.store.p('receipts')).map((x) => [x, sha256File(wf.store.p('receipts', x))]), before);
    assert.equal(wf.store.verifyCheckpoint().ok, true);
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 12 - behaviour classification and closure', () => {
  test('5. classification and requirement closure', () => {
    assert.equal(classifyBehaviour(5, 0), 'VERIFIED_CANDIDATE');
    assert.equal(classifyBehaviour(5, 2), 'PARTIAL');
    assert.equal(classifyBehaviour(3, 3), 'GAP');
    const cls = new Map<string, any>([['A', 'VERIFIED_CANDIDATE'], ['B', 'VERIFIED_CANDIDATE'], ['C', 'PARTIAL']]);
    const cov = new Map([['R-ALL', ['A', 'B', 'C']], ['R-A', ['A']], ['R-AB', ['A', 'B']]]);
    const a = closure('A', cov, cls);
    assert.equal(a.closed, true);
    assert.deepEqual(a.requirements, ['R-A', 'R-AB']);
    assert.deepEqual(a.overlapping.map((o) => o.requirement), ['R-ALL'], 'an overlapping requirement that also covers unresolved behaviour stays outside, listed');
    const onlyOverlap = closure('A', new Map([['R-ALL', ['A', 'C']]]), cls);
    assert.equal(onlyOverlap.closed, false, 'a behaviour covered only by a requirement with unresolved behaviour is not a candidate');
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 12 - the real run (read-only)', () => {
  const realRunsDir = path.resolve(FORWARD_DIR, 'runs');
  const run = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
  const src = process.env.REVFORGE_COBOL_SOURCE_ROOT || path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
  const skip = !run || !fs.existsSync(src);
  const P = ['R', 'T', 'N', 'C', 'D', 'E', '0', '0'].join('');
  const real = () => {
    process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    return { ctx, wf: loadWorkflow(ctx, run!) };
  };

  test('6. SQLCODE-dependent runtime requirements now wait for the SQLCA decisions; unrelated items are not invalidated', { skip }, () => {
    const { wf } = real();
    const ev = evaluateScope(buildSnapshot(wf), parseSelector(`programs:${P}`));
    const f = (id: string) => ev.findings.find((x) => x.id === id)!;
    for (const id of [`RT-${P}-002`, `RT-${P}-003`]) {
      assert.equal(f(id).outcome, 'REQUIRES_SME_DECISION', id);
      assert.ok(f(id).decisions.includes('DR-DB2CONN-002') && f(id).decisions.includes('DR-F2-0011-001'), id);
    }
    assert.equal(f(`RT-${P}-001`).outcome, 'VERIFIED', 'the SQL-free runtime requirement is unaffected');
    assert.deepEqual(f(`REQ-${P}-003`).decisions, [`RVW-REQ-${P}-003`], 'REQ-003 waits only for its own review');
    assert.equal(ev.readiness, 'NOT_READY');
  });

  test('7/8/9. smallest candidate, required gaps, exact scope hashes, nothing approved or written', { skip }, () => {
    const { ctx, wf } = real();
    const audit = sha256File(wf.store.p('audit.jsonl'));
    const ears = adjudications(wf).map((a) => [a.adjudication_id, sha256File(wf.store.p('context', `${a.adjudication_id}.json`))]);
    const m = behaviourScope(wf, `programs:${P}`);
    assert.equal(ctx.contracts.validate('pilot/verified-scope', m).valid, true);
    const p = m.programs[0];
    const cls = Object.fromEntries(p.behaviours.map((b: any) => [b.behaviour_id.split(':')[1], b.classification]));
    assert.equal(cls['P200-SET-RETURN-CODE'], 'VERIFIED_CANDIDATE');
    assert.equal(cls['P400-LOG-RETURN-CODE'], 'PARTIAL');
    assert.equal(cls['P500-ANALYZE-CODES'], 'GAP');
    assert.equal(cls['ENTRY-DISPATCH'], 'PARTIAL');
    const c = p.selected_candidate;
    assert.equal(c.behaviour_id, `${P}:P200-SET-RETURN-CODE`);
    assert.deepEqual(c.requirements.map((r: any) => r.id), [`REQ-${P}-002`, `REQ-${P}-003`, `RT-${P}-001`]);
    assert.deepEqual(c.overlapping_requirements.map((o: any) => o.requirement), [`REQ-${P}-001`]);
    assert.deepEqual(c.tainted_inputs, []);
    for (const b of ['P100-INIT-RETURN-CODES', 'P300-GET-RETURN-CODE']) assert.equal(p.candidates.find((x: any) => x.behaviour_id.endsWith(b)).closed, false, `${b}: only REQ-001 covers it`);
    // Required gaps stay blocking and open; the candidate's own restriction does not block it.
    const gaps = Object.fromEntries(p.gaps.map((g: any) => [g.gap_id, g]));
    assert.equal(gaps[`GAP-${P}-P400-LOG-RETURN-CODE-SQLCODE`].blocking, true);
    assert.equal(gaps[`GAP-${P}-P500-ANALYZE-CODES-SQLCODE`].blocking, true);
    assert.ok(p.gaps.every((g: any) => g.status === 'OPEN'));
    assert.ok(c.gaps_affecting_candidate.every((g: any) => g.blocking === false));
    // The subset is a different, exact scope; the engine's limitations are reported, not bypassed.
    const g = p.g2_subset_eligibility;
    assert.equal(g.selector, `requirements:REQ-${P}-002,REQ-${P}-003`);
    assert.notEqual(g.scope_sha256, m.scope_sha256);
    assert.equal(g.readiness, 'NOT_READY');
    assert.deepEqual(g.limitations.map((l: any) => l.id), ['L1', 'L2']);
    assert.equal(g.representable_without_policy_change, false);
    // Deterministic: the same manifest content and gap IDs on a second evaluation.
    const m2 = behaviourScope(wf, `programs:${P}`);
    assert.equal(m2.programs[0].selected_candidate.content_sha256, c.content_sha256);
    assert.deepEqual(m2.programs[0].gaps.map((x: any) => x.gap_id), p.gaps.map((x: any) => x.gap_id));
    // Nothing approved, nothing written, history untouched.
    assert.notEqual(evaluateG2Gate(wf).result.status, 'PASS');
    assert.equal(fs.readdirSync(wf.store.p('approvals')).filter((x) => /^(APR|RES)-/.test(x)).length, 0);
    assert.equal(sha256File(wf.store.p('audit.jsonl')), audit);
    assert.deepEqual(adjudications(wf).map((a) => [a.adjudication_id, sha256File(wf.store.p('context', `${a.adjudication_id}.json`))]), ears);
  });

  test('10. no production Java generation', { skip }, () => {
    const { wf, ctx } = real();
    assert.equal(generationAuthorized(wf.run, wf.state), false);
    assert.equal(ctx.config.generation.java_generation_allowed, false);
    assert.deepEqual(javaTrackingViolations(REPO), [], 'only the hand-written Java runtime is tracked; no generated or other Java');
  });
});
