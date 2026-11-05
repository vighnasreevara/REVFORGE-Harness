/**
 * STEP 20 tests: corrections of the source-readiness dependency closure
 * (compiler-defined names, SPECIAL-NAMES mnemonics, INDEXED BY index names,
 * a missing PERFORM target failing closed instead of crashing). Every
 * correction is checked together with the case that must stay unresolved.
 * The real run is used read-only.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { loadWorkflow } from '../runtime/src/orchestrator/orchestrator';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { behaviourClosure } from '../runtime/src/approval/closure';
import { sourceReadiness } from '../runtime/src/pilot/gates';
import { parseApp } from '../runtime/src/pilot/cobol-app';
import { emitApp } from '../runtime/src/pilot/java-app';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { wfOf } from './helpers/g2fixture';
import { contextFixture } from './helpers/contextfixture';

const REPO = path.resolve(FORWARD_DIR, '..');
const fixtures: Fixture[] = [];
after(() => {
  for (const f of fixtures.splice(0)) cleanup(f);
});

describe('STEP 20 - readiness closure corrections (synthetic, fail-closed)', () => {
  test('a mnemonic without a SPECIAL-NAMES declaration stays an unknown dependency', () => {
    const { ctx } = contextFixture(fixtures, { progExtra: ["           DISPLAY 'X' UPON NOCONS."] });
    const c = behaviourClosure(buildSnapshot(wfOf(ctx)), 'BRAVO02', 'P1');
    assert.equal(c.status, 'UNRESOLVED');
    assert.ok(c.unresolved_reasons.some((r) => /NOCONS is neither declared/.test(r)));
    assert.deepEqual(c.special_registers, []);
  });
});

describe('STEP 20 - converter: reserved words are never paragraph headers', () => {
  test('free-form `EXIT.` indented less than four columns is the EXIT statement of the current paragraph', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rf20-'));
    try {
      // Free-form layout: paragraph names in column 1, statements indented three columns.
      const src = ['IDENTIFICATION DIVISION.', 'PROGRAM-ID. FREEX1.', 'DATA DIVISION.', 'WORKING-STORAGE SECTION.', '01 WS-A PIC X.', 'PROCEDURE DIVISION.', 'MAIN-PARA.', "   MOVE 'A' TO WS-A", '   PERFORM P1 THRU P1-EXIT', '   GOBACK.', 'P1.', "   MOVE 'B' TO WS-A.", 'P1-EXIT.', '   EXIT.'].join('\n') + '\n';
      fs.writeFileSync(path.join(d, 'F.cbl'), src);
      const p = parseApp(path.join(d, 'F.cbl'), 'F.cbl', () => null);
      assert.deepEqual(p.paragraphs.map((q) => q.name), ['MAIN-PARA', 'P1', 'P1-EXIT']);
      const exit = p.paragraphs[2].sentences.flat();
      assert.deepEqual(exit.map((s) => [s.kind, s.origin.line]), [['exit', 14]]);
      const em = emitApp(p, { available: new Set(), lineText: () => '' });
      assert.deepEqual(em.gaps, []);
      assert.ok(em.source_map.statements.some((m) => m.cobol_line === 14 && !m.gap_id), 'the EXIT statement is mapped');
      assert.ok(!em.source_map.paragraphs.some((m: any) => m.paragraph === 'EXIT'));
    } finally {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });
});

describe('STEP 20 - readiness closure corrections (real run, read-only)', () => {
  const realRunsDir = path.join(FORWARD_DIR, 'runs');
  const run = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
  const src = process.env.REVFORGE_COBOL_SOURCE_ROOT && !/revforge-fwd-/.test(process.env.REVFORGE_COBOL_SOURCE_ROOT) ? process.env.REVFORGE_COBOL_SOURCE_ROOT : path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
  const skip = !run || !fs.existsSync(src);
  let wf: ReturnType<typeof loadWorkflow> | undefined;
  const real = () => {
    if (!wf) {
      process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
      wf = loadWorkflow(loadContext({ forwardDir: FORWARD_DIR }), run!);
    }
    return wf;
  };
  const unknown = (c: { unresolved_reasons: string[] }, name: string) => c.unresolved_reasons.some((r) => r.includes(`${name} is neither declared`));

  test('RETURN-CODE is recorded as a special register, and NEXT (READ ... NEXT RECORD) is a reserved word', { skip }, () => {
    const snap = buildSnapshot(real());
    const c = behaviourClosure(snap, 'PORTREAD', '1000-INITIALIZE');
    assert.equal(unknown(c, 'RETURN-CODE'), false);
    assert.deepEqual(c.special_registers.map((x) => x.name), ['RETURN-CODE']);
    assert.equal(unknown(behaviourClosure(snap, 'PORTREAD', '2000-PROCESS'), 'NEXT'), false);
  });

  test('a SPECIAL-NAMES mnemonic (CONSOLE IS CONS) resolves in every program that declares it', { skip }, () => {
    for (const p of ['TSTGEN00', 'TSTVAL00', 'UTLMNT00', 'UTLMON00']) assert.equal(sourceReadiness(real(), p).closures.some((c: any) => unknown(c, 'CONS')), false, p);
  });

  test('an INDEXED BY index name resolves; an undeclared subscript in the same program stays unknown', { skip }, () => {
    const r = sourceReadiness(real(), 'PRCSEQ00');
    assert.equal(r.closures.some((c: any) => unknown(c, 'WS-PROC-IX')), false);
    assert.equal(r.closures.some((c: any) => unknown(c, 'WS-SUB')), true, 'WS-SUB is never declared in PRCSEQ00');
  });

  test('a PERFORM of a paragraph missing from the source fails closed instead of aborting the gate', { skip }, () => {
    const r = sourceReadiness(real(), 'CURSMGR');
    assert.equal(r.status, 'FAIL');
    const c = r.closures.find((x: any) => x.behaviour_id === 'CURSMGR:P300-FETCH-DATA');
    assert.ok(c, 'the missing target is still listed as a behaviour closure');
    assert.equal(c.status, 'UNRESOLVED');
    assert.ok(c.unresolved_reasons.some((x: string) => /P300-FETCH-DATA is not a paragraph of CURSMGR/.test(x)));
  });

  test('non-standard ACCEPT FROM TIME STAMP and the self-including SQLCA still fail readiness', { skip }, () => {
    assert.ok(sourceReadiness(real(), 'AUDPROC').closures.some((c: any) => unknown(c, 'STAMP')));
    const rc = sourceReadiness(real(), 'RTNCDE00');
    assert.equal(rc.checks.find((c) => c.id === 'copybooks_resolved')!.ok, false);
    assert.match(rc.checks.find((c) => c.id === 'copybooks_resolved')!.detail, /SQLCA@6/);
  });

  test('file I/O and CALL side effects are documented as blocking OPEN gaps; the behaviours stay PARTIAL', { skip }, () => {
    const r = sourceReadiness(real(), 'PORTREAD');
    const file = r.gaps.filter((g: any) => g.kind === 'EXTERNAL_FILE_RUNTIME');
    assert.ok(file.length > 0);
    assert.ok(file.every((g: any) => g.blocking === true && g.status === 'OPEN'));
    assert.ok(r.behaviours.filter((b: any) => b.kind === 'performed_range').every((b: any) => b.classification === 'PARTIAL'), 'documenting a gap never reclassifies a behaviour');
    const call = sourceReadiness(real(), 'BCHCTL00').gaps.filter((g: any) => g.kind === 'EXTERNAL_PROGRAM_CALL');
    assert.ok(call.length > 0 && call.every((g: any) => g.blocking === true));
  });

  test('PROGNAME passes readiness on its actual gate conditions; generation stays unauthorised', { skip }, () => {
    const r = sourceReadiness(real(), 'PROGNAME');
    assert.equal(r.status, 'PASS', JSON.stringify(r.checks.filter((c) => !c.ok)));
    assert.ok(r.closures.every((c: any) => c.status === 'RESOLVED'));
    assert.equal(loadContext({ forwardDir: FORWARD_DIR }).config.generation.java_generation_allowed, false);
  });
});
