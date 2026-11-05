/**
 * STEP 15 tests: the extended local converter (named entry paragraphs,
 * reference modification, class tests, combined and abbreviated conditions,
 * EXIT PARAGRAPH, INITIALIZE, decimal scale, binary items, copybooks in
 * WORKING-STORAGE), its explicit guards for undefined data conversions and
 * binary truncation, refusals with source locations, and generation
 * authorisation staying enforced for real programs. Synthetic programs only
 * are converted; the real PORTVALD source is only parsed (no Java).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { loadWorkflow } from '../runtime/src/orchestrator/orchestrator';
import { findGaps, parseProgram, UnsupportedConstruct } from '../runtime/src/pilot/cobol-subset';
import { emitJava } from '../runtime/src/pilot/java-emit';
import { detectToolchain, PilotRefused, runPilot, Toolchain } from '../runtime/src/pilot/pilot';
import { authorisationStatus, conversionValidation } from '../runtime/src/pilot/gates';
import { FORWARD_DIR } from './helpers/fixture';

import { javaTrackingViolations } from './helpers/gitpolicy';
const REPO = path.resolve(FORWARD_DIR, '..');
const temps: string[] = [];
after(() => {
  for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rf15-'));
  temps.push(d);
  return d;
};
const TC = detectToolchain();
const NO_COBOL: Toolchain = { ...TC, cobol: { available: false, cobc: null, version: null, source: null } };
/** A tiny synthetic program in a temporary file (fixed format). */
function program(data: string[], proc: string[]): string {
  const f = path.join(tmp(), 'SYNT.cbl');
  const lines = ['       IDENTIFICATION DIVISION.', '       PROGRAM-ID. SYNT01.', '       DATA DIVISION.', '       WORKING-STORAGE SECTION.', ...data, '       LINKAGE SECTION.', '       01  T-REQ.', '           05  T-IN    PIC X(10).', '           05  T-RC    PIC S9(4) COMP.', '       PROCEDURE DIVISION USING T-REQ.', ...proc];
  fs.writeFileSync(f, lines.join('\n') + '\n');
  return f;
}

/* ------------------------------------------------------------------ */
describe('STEP 15 - converter language support (synthetic)', () => {
  test('digit-led paragraph names, abbreviated combined relations, class tests and EXIT PARAGRAPH parse into the expected structure', () => {
    const f = program(['       01  T-NUM   PIC X(3).'], ['       0000-MAIN.', '           IF T-IN NOT = \'AAA\'', '              AND NOT = \'BBB\'', '               MOVE 1 TO T-RC', '               EXIT PARAGRAPH', '           END-IF', '           IF T-IN(1:3) IS NOT NUMERIC OR T-IN = ZEROS', '               MOVE 2 TO T-RC', '           END-IF', '           GOBACK', '           .']);
    const p = parseProgram(f);
    assert.deepEqual(p.paragraphs.map((x) => x.name), ['0000-MAIN']);
    const first = p.paragraphs[0].body[0] as any;
    assert.equal(first.kind, 'if');
    assert.equal(first.cond.kind, 'and');
    assert.equal(first.cond.left.op, '<>');
    // AND NOT = 'BBB' reuses the subject: NOT (T-IN = 'BBB'), which evaluates exactly like T-IN NOT = 'BBB'.
    assert.equal(first.cond.right.kind, 'not');
    assert.equal(first.cond.right.inner.op, '=');
    assert.equal(first.cond.right.inner.left.name, 'T-IN');
    assert.equal(first.cond.right.inner.right.value, 'BBB');
    assert.equal(first.then[1].kind, 'exit_paragraph');
    const second = p.paragraphs[0].body[1] as any;
    assert.equal(second.cond.kind, 'or');
    assert.equal(second.cond.left.kind, 'class');
    assert.equal(second.cond.left.negated, true);
    assert.deepEqual(second.cond.left.operand.refmod, { start: 1, length: 3 });
  });

  test('constructs outside the subset are refused with their source location, never dropped', () => {
    const packed = program(['       01  T-P     PIC S9(5)V99 COMP-3.'], ['       0000-MAIN.', '           GOBACK.']);
    assert.throws(() => parseProgram(packed), (e: any) => e instanceof UnsupportedConstruct && /T-P/.test(e.construct) && e.line > 0);
    const nested = program(['       01  T-G.', '           05  T-H.', '               10  T-I PIC X.'], ['       0000-MAIN.', '           GOBACK.']);
    assert.throws(() => parseProgram(nested), (e: any) => e instanceof UnsupportedConstruct && /nested group T-H/.test(e.construct));
    const loop = program([], ['       0000-MAIN.', '           PERFORM 1000-X UNTIL T-RC = 1', '           GOBACK.', '       1000-X.', '           MOVE 1 TO T-RC.']);
    assert.throws(() => parseProgram(loop), (e: any) => e instanceof UnsupportedConstruct && /PERFORM UNTIL/.test(e.construct));
    const ordering = program([], ['       0000-MAIN.', '           IF T-IN > \'M\'', '               MOVE 1 TO T-RC', '           END-IF', '           GOBACK.']);
    const p = parseProgram(ordering);
    assert.throws(() => emitJava(p, findGaps(p, new Set(), []), 'x.y'), (e: any) => e instanceof UnsupportedConstruct && /collating sequence/.test(e.construct), 'alphanumeric ordering is not guessed');
  });

  test('binary truncation: a variable that can exceed the PIC is guarded with a gap; a fitting constant is not', () => {
    const f = program(['       01  T-BIG   PIC S9(6).', '       01  T-ONE   PIC S9(4) VALUE +7.'], ['       0000-MAIN.', '           MOVE T-BIG TO T-RC', '           MOVE T-ONE TO T-RC', '           GOBACK.']);
    const p = parseProgram(f);
    const gaps = findGaps(p, new Set(), fs.readFileSync(f, 'utf8').split('\n'));
    assert.deepEqual(gaps.map((g) => [g.kind, g.subject, g.origin.line]), [['COMPILER_OPTION_DEPENDENT', 'T-RC', 13]]);
    const java = Object.values(emitJava(p, gaps, 'x.y').files).join('\n');
    assert.match(java, /Cobol\.binaryWithinDigits\(this\.tBig, 4, "GAP-SYNT01-0001"\)/);
    assert.match(java, /this\.tOne, 4, true\)/, 'the constant is moved without a guard');
  });

  test('SYNVAL01 converts, compiles with -Werror, passes its source-derived cases and keeps the undefined MOVE blocked (PARTIAL)', (t) => {
    if (!TC.java.available) return t.skip('no JDK found; Java execution not faked');
    const root = tmp();
    const dir = path.join(root, 'synthetic-val');
    fs.cpSync(path.join(FORWARD_DIR, 'pilot', 'synthetic-val'), dir, { recursive: true, filter: (s) => path.basename(s) !== 'out' });
    const r = runPilot({ dir, pilotRoot: root, forbiddenRoots: [path.join(REPO, 'references'), path.join(REPO, 'output')], toolchain: NO_COBOL });
    assert.equal(r.compilation.status, 'COMPILED', JSON.stringify(r.compilation.diagnostics));
    assert.deepEqual(r.execution.counts, { PASS: 18, BLOCKED_AS_EXPECTED: 1, FAIL: 0, total: 19 });
    assert.equal(r.conversion_status, 'PARTIAL');
    assert.equal(r.gaps.length, 1);
    assert.equal(r.gaps[0].kind, 'DATA_CONVERSION_UNDEFINED');
    assert.equal(r.gaps[0].stable_ref, 'GAP-SYNVAL01-4000-CHECK-PRICE-ALNUM-TO-NUMERIC-OV-PRICE');
    assert.equal(r.trace_audit.mapped_statements, r.trace_audit.statements);
    const g = conversionValidation(loadContext({ forwardDir: FORWARD_DIR }), path.join(dir, 'out'), dir);
    assert.equal(g.status, 'PASS', JSON.stringify(g.checks.filter((c) => !c.ok)));
    assert.equal(g.label, 'PARTIAL');
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 15 - real programs stay unconverted without authorisation (read-only)', () => {
  const realRunsDir = path.resolve(FORWARD_DIR, 'runs');
  const run = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
  const src = process.env.REVFORGE_COBOL_SOURCE_ROOT || path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
  const skip = !run || !fs.existsSync(src);

  test('PORTVALD parses completely with the converter (no Java emitted) and keeps its documented gap', { skip }, () => {
    const file = path.join(src, 'src', 'programs', 'portfolio', 'PORTVALD.cbl');
    const cpy = path.join(src, 'src', 'copybook', 'common');
    const p = parseProgram(file, (m) => (fs.existsSync(path.join(cpy, `${m}.cpy`)) ? { path: path.join(cpy, `${m}.cpy`), lines: fs.readFileSync(path.join(cpy, `${m}.cpy`), 'utf8').replace(/\r\n?/g, '\n').split('\n') } : null));
    assert.equal(p.program_id, 'PORTVALD');
    const gaps = findGaps(p, new Set(), []);
    assert.deepEqual(gaps.map((g) => g.stable_ref), ['GAP-PORTVALD-4000-VALIDATE-AMOUNT-ALNUM-TO-NUMERIC-VAL-TEMP-NUM']);
  });

  test('generation authorisation is still enforced: the pilot refuses real programs and the guard reports every blocker', { skip }, () => {
    process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    const auth = authorisationStatus(loadWorkflow(ctx, run!), ctx);
    assert.equal(auth.generation_authorized, false);
    assert.equal(auth.blockers.length, 4);
    assert.equal(ctx.config.generation.java_generation_allowed, false);
    // A pilot definition that points at real source is refused, even if it claims to be synthetic.
    const root = tmp();
    const dir = path.join(root, 'real');
    fs.mkdirSync(path.join(dir, 'cobol'), { recursive: true });
    fs.copyFileSync(path.join(FORWARD_DIR, 'pilot', 'synthetic-val', 'pilot.json'), path.join(dir, 'pilot.json'));
    assert.throws(() => runPilot({ dir, pilotRoot: root, forbiddenRoots: [dir], toolchain: NO_COBOL }), PilotRefused);
    assert.deepEqual(javaTrackingViolations(REPO), [], 'only the hand-written Java runtime is tracked; no generated or other Java');
  });
});
