/**
 * STEP 14 tests: the two active engineering gates (SOURCE_READINESS,
 * CONVERSION_VALIDATION) composed from existing verification, the
 * complete-program candidate ranking, the data-conversion hazard that keeps an
 * undefined MOVE from passing as verified, and generation authorisation staying
 * exactly as before. Synthetic fixtures for mechanisms; the real run read-only.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { generationAuthorized, loadWorkflow } from '../runtime/src/orchestrator/orchestrator';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { behaviourClosure } from '../runtime/src/approval/closure';
import { authorisationStatus, conversionCandidates, conversionValidation, sourceReadiness } from '../runtime/src/pilot/gates';
import { detectToolchain, runPilot, Toolchain } from '../runtime/src/pilot/pilot';
import { behaviourScope } from '../runtime/src/pilot/scope';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { wfOf } from './helpers/g2fixture';
import { contextFixture } from './helpers/contextfixture';

import { javaTrackingViolations } from './helpers/gitpolicy';
const REPO = path.resolve(FORWARD_DIR, '..');
const fixtures: Fixture[] = [];
const temps: string[] = [];
after(() => {
  for (const f of fixtures.splice(0)) cleanup(f);
  for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const TC = detectToolchain();
const NO_COBOL: Toolchain = { ...TC, cobol: { available: false, cobc: null, version: null, source: null } };
function syntheticConversion(): { root: string; dir: string; out: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rf14-'));
  temps.push(root);
  const dir = path.join(root, 'synthetic-rc');
  fs.cpSync(path.join(FORWARD_DIR, 'pilot', 'synthetic-rc'), dir, { recursive: true, filter: (s) => path.basename(s) !== 'out' });
  runPilot({ dir, pilotRoot: root, forbiddenRoots: [path.join(REPO, 'references'), path.join(REPO, 'output')], toolchain: NO_COBOL });
  return { root, dir, out: path.join(dir, 'out') };
}

/* ------------------------------------------------------------------ */
describe('STEP 14 - engineering gate 1: SOURCE_READINESS (synthetic)', () => {
  test('a complete synthetic program with delivered F1/F2 passes; the gate never authorises generation', () => {
    const { ctx } = contextFixture(fixtures, {});
    const g = sourceReadiness(wfOf(ctx), 'BRAVO02');
    assert.equal(g.status, 'PASS', JSON.stringify(g.checks.filter((c) => !c.ok)));
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false);
    assert.equal(authorisationStatus(wfOf(ctx), ctx).generation_authorized, false);
  });

  test('an unknown name, a stub paragraph or an undefined data conversion is never ready-and-verified', () => {
    const unknown = contextFixture(fixtures, { progExtra: ['           IF MYSTERY-FLAG = 1', '              MOVE 2 TO WS-LIMIT', '           END-IF.'] });
    // An unknown name in the (named) entry paragraph: the dependencies are not identified, so the gate fails.
    const u = sourceReadiness(wfOf(unknown.ctx), 'BRAVO02');
    assert.equal(u.status, 'FAIL');
    assert.ok(u.checks.some((x) => x.id === 'dependencies_identified' && !x.ok && /MYSTERY-FLAG/.test(x.detail)));
    const conv = contextFixture(fixtures, { progExtra: ['           MOVE BRV-STATUS TO WS-LIMIT.'] });
    const c = behaviourClosure(buildSnapshot(wfOf(conv.ctx)), 'BRAVO02', 'P1');
    const gap = c.program_gaps.find((g) => g.kind === 'DATA_CONVERSION_UNDEFINED')!;
    assert.ok(gap, 'an alphanumeric-to-numeric MOVE is an undefined data conversion');
    assert.equal(gap.blocking, true);
    assert.equal(gap.in_closure, true);
    // P8 has no statements (the fixture's final GOBACK lands in P9).
    const stub = contextFixture(fixtures, { progExtra: ['           GOBACK.', '       P8.', '       P9.'] });
    const g = sourceReadiness(wfOf(stub.ctx), 'BRAVO02');
    assert.equal(g.status, 'FAIL');
    assert.ok(g.checks.some((x) => x.id === 'complete_program' && !x.ok && /P8/.test(x.detail)));
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 14 - engineering gate 2: CONVERSION_VALIDATION (synthetic conversion)', () => {
  test('a compiled, tested, traced conversion with preserved gaps passes as PARTIAL; tampering, a wrong label or a missing placeholder fail', (t) => {
    if (!TC.java.available) return t.skip('no JDK found; Java execution not faked');
    const reg = loadContext({ forwardDir: FORWARD_DIR });
    const a = syntheticConversion();
    const ok = conversionValidation(reg, a.out, a.dir);
    assert.equal(ok.status, 'PASS', JSON.stringify(ok.checks.filter((c) => !c.ok)));
    assert.equal(ok.label, 'PARTIAL');
    // Claiming COMPLETE with an open gap is caught (label and evidence).
    const b = syntheticConversion();
    const rf = path.join(b.out, 'pilot-result.json');
    fs.writeFileSync(rf, JSON.stringify({ ...JSON.parse(fs.readFileSync(rf, 'utf8')), conversion_status: 'COMPLETE' }));
    const bad = conversionValidation(reg, b.out, b.dir);
    assert.equal(bad.status, 'FAIL');
    assert.ok(bad.checks.some((c) => c.id === 'label_accurate' && !c.ok));
    assert.ok(bad.checks.some((c) => c.id === 'evidence_intact' && !c.ok));
    // Removing the placeholder evidence (no demonstrated blocked path) is fabrication.
    const c = syntheticConversion();
    const cf = path.join(c.out, 'pilot-result.json');
    const r = JSON.parse(fs.readFileSync(cf, 'utf8'));
    r.execution.cases = r.execution.cases.filter((k: any) => k.status !== 'BLOCKED_AS_EXPECTED');
    fs.writeFileSync(cf, JSON.stringify(r));
    assert.ok(conversionValidation(reg, c.out).checks.some((x) => x.id === 'no_fabrication' && !x.ok));
  });

  test('without a conversion output the gate fails; it never passes by default', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'rf14e-'));
    temps.push(empty);
    const g = conversionValidation(loadContext({ forwardDir: FORWARD_DIR }), empty);
    assert.equal(g.status, 'FAIL');
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 14 - real repository (read-only)', () => {
  const realRunsDir = path.resolve(FORWARD_DIR, 'runs');
  const run = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
  const src = process.env.REVFORGE_COBOL_SOURCE_ROOT || path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
  const skip = !run || !fs.existsSync(src);
  const real = () => {
    process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    return { ctx, wf: loadWorkflow(ctx, run!) };
  };

  test('complete-program selection is generic: the first eligible candidate is a self-contained program, not a paragraph and not P200', { skip }, () => {
    const { wf } = real();
    const list = conversionCandidates(wf);
    const first = list.find((c) => c.eligible);
    assert.equal(first.program, 'PORTVALD');
    assert.equal(first.metrics.external_operations, 0);
    assert.ok(list.some((c) => c.program === 'PROGNAME' && !c.eligible), 'templates are excluded');
    assert.ok(list.some((c) => c.program === 'CKPRST' && !c.eligible && c.reasons.some((r: string) => /stub/.test(r))), 'stubs are excluded');
  });

  test('PORTVALD: SOURCE_READINESS passes with the undefined amount conversion documented; generation stays unauthorised', { skip }, () => {
    const { wf, ctx } = real();
    const audit = sha256File(wf.store.p('audit.jsonl'));
    const g = sourceReadiness(wf, 'PORTVALD');
    assert.equal(g.status, 'PASS', JSON.stringify(g.checks.filter((c) => !c.ok)));
    const cls = Object.fromEntries(g.behaviours.map((b: any) => [b.behaviour_id.split(':')[1], b.classification]));
    assert.equal(cls['1000-VALIDATE-ID'], 'VERIFIED_CANDIDATE');
    assert.equal(cls['3000-VALIDATE-TYPE'], 'VERIFIED_CANDIDATE');
    assert.equal(cls['4000-VALIDATE-AMOUNT'], 'PARTIAL', 'the alphanumeric-to-numeric MOVE is not verified behaviour');
    assert.deepEqual(g.gaps.map((x: any) => x.gap_id), ['GAP-PORTVALD-4000-VALIDATE-AMOUNT-ALNUM-TO-NUMERIC-VAL-TEMP-NUM']);
    assert.ok(!g.gaps.some((x: any) => /TRUNC-LS-RETURN-CODE/.test(x.gap_id)), 'unchanged VALUE constants are not truncation hazards');
    const auth = authorisationStatus(wf, ctx, 'PORTVALD');
    assert.equal(auth.generation_authorized, false);
    assert.ok(auth.blockers.some((b: string) => /java_generation_allowed is false/.test(b)));
    assert.equal(ctx.config.generation.java_generation_allowed, false);
    assert.equal(sha256File(wf.store.p('audit.jsonl')), audit, 'read-only');
    assert.deepEqual(javaTrackingViolations(REPO), [], 'only the hand-written Java runtime is tracked; no generated or other Java');
  });

  test('earlier RTNCDE00 findings are preserved (8 gaps, same IDs)', { skip }, () => {
    const { wf } = real();
    const gaps = behaviourScope(wf, 'programs:RTNCDE00').programs[0].gaps.map((g: any) => g.gap_id);
    assert.equal(gaps.length, 8);
    assert.ok(gaps.includes('GAP-RTNCDE00-P200-SET-RETURN-CODE-TRUNC-RC-HIGHEST-CODE'));
  });
});
