/**
 * STEP 17 tests: the full-application converter (front end, Java back end,
 * runtime), the consolidated authorisation and its guards, the integrated
 * build, and read-only checks of the real conversion campaign.
 * Mechanisms use synthetic COBOL in temporary files; the real run is read only.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { loadWorkflow } from '../runtime/src/orchestrator/orchestrator';
import { authorizationRecords, checkLocalAuthorization, integrationScope, LocalAuthorizationInput, recordLocalAuthorization } from '../runtime/src/pilot/authorization';
import { expand, parseApp, walkStmts } from '../runtime/src/pilot/cobol-app';
import { emitApp } from '../runtime/src/pilot/java-app';
import { convertAppProgram, listJava, RUNTIME_DIR } from '../runtime/src/pilot/app-convert';
import { parseJcl } from '../runtime/src/pilot/app-integrate';
import { conversionValidation } from '../runtime/src/pilot/gates';
import { detectToolchain, PilotRefused } from '../runtime/src/pilot/pilot';
import { AGENTS, checkDefinition } from '../runtime/src/orchestrator/agents';
import { SKILLS } from '../runtime/src/orchestrator/skills';
import { mirrorStatus, syncMirror } from '../runtime/src/orchestrator/mirror';
import { canWrite } from '../runtime/src/orchestrator/permissions';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { setupG2, wfOf } from './helpers/g2fixture';

import { javaTrackingViolations } from './helpers/gitpolicy';
const REPO = path.resolve(FORWARD_DIR, '..');
const temps: string[] = [];
const fixtures: Fixture[] = [];
after(() => {
  for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  for (const f of fixtures.splice(0)) cleanup(f);
});
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rf17-'));
  temps.push(d);
  return d;
};
const TC = detectToolchain();
const fixed = (lines: string[]) => lines.map((l) => (l.startsWith('*') ? '      ' + l : '       ' + l)).join('\n') + '\n';

/** A synthetic program exercising files, tables, arithmetic, STRING, EVALUATE, gaps. */
const SYN = fixed([
  'IDENTIFICATION DIVISION.',
  'PROGRAM-ID. SYNAPP1.',
  'ENVIRONMENT DIVISION.',
  'INPUT-OUTPUT SECTION.',
  'FILE-CONTROL.',
  '    SELECT ACCT-FILE ASSIGN TO ACCTDD',
  '        ORGANIZATION IS INDEXED',
  '        ACCESS MODE IS DYNAMIC',
  '        RECORD KEY IS ACCT-ID',
  '        FILE STATUS IS WS-FS.',
  'DATA DIVISION.',
  'FILE SECTION.',
  'FD  ACCT-FILE.',
  '01  ACCT-REC.',
  '    05  ACCT-ID        PIC X(4).',
  '    05  ACCT-BAL       PIC S9(5)V99 COMP-3.',
  'WORKING-STORAGE SECTION.',
  '01  WS-FS              PIC XX.',
  '01  WS-TOTAL           PIC S9(7)V99 VALUE ZERO.',
  '01  WS-TABLE.',
  '    05  WS-ENTRY OCCURS 3 TIMES INDEXED BY WS-IX.',
  '        10  WS-AMT     PIC 9(3).',
  '01  WS-MSG             PIC X(20) VALUE SPACES.',
  '01  WS-SMALL           PIC 9(2) VALUE 0.',
  '01  WS-FLAG            PIC X VALUE \'N\'.',
  '    88  WS-OVER                VALUE \'Y\'.',
  '    88  WS-VALUE-OK            VALUE \'V\'.',
  'COPY SYNCPY REPLACING ==:P:== BY ==XY==.',
  'LINKAGE SECTION.',
  '01  LS-REQ.',
  '    05  LS-CODE        PIC X.',
  '    05  LS-RESULT      PIC S9(7)V99.',
  'PROCEDURE DIVISION USING LS-REQ.',
  '0000-MAIN.',
  '    EVALUATE LS-CODE',
  "        WHEN 'S'  PERFORM 1000-SUM THRU 1000-EXIT",
  "        WHEN 'F'  PERFORM 2000-FILE",
  "        WHEN 'Q'  EXEC SQL SELECT 1 INTO :WS-SMALL FROM T",
  '                  END-EXEC',
  '        WHEN OTHER PERFORM 9999-MISSING',
  '    END-EVALUATE',
  '    GOBACK.',
  '1000-SUM.',
  '    MOVE 100 TO WS-AMT(1)',
  '    MOVE 250 TO WS-AMT(2)',
  '    MOVE 7 TO WS-AMT(3)',
  '    PERFORM VARYING WS-IX FROM 1 BY 1 UNTIL WS-IX > 3',
  '        ADD WS-AMT(WS-IX) TO WS-TOTAL',
  '    END-PERFORM',
  '    COMPUTE LS-RESULT ROUNDED = WS-TOTAL / 3',
  '    ADD 99 TO WS-SMALL',
  '        ON SIZE ERROR SET WS-OVER TO TRUE',
  '    END-ADD',
  '    ADD 1 TO WS-SMALL',
  '        ON SIZE ERROR SET WS-OVER TO TRUE',
  '    END-ADD',
  "    MOVE 'AB' & 'CD' TO XY-NAME",
  "    STRING 'TOTAL=' DELIMITED BY SIZE",
  "           'OK END' DELIMITED BY SPACE",
  '           INTO WS-MSG.',
  '1000-EXIT.',
  '    EXIT.',
  '2000-FILE.',
  '    OPEN I-O ACCT-FILE',
  "    MOVE 'A002' TO ACCT-ID",
  '    READ ACCT-FILE',
  '        INVALID KEY MOVE -1 TO LS-RESULT',
  '        NOT INVALID KEY MOVE ACCT-BAL TO LS-RESULT',
  '    END-READ',
  '    CLOSE ACCT-FILE.',
]);
const CPY = fixed(['01  :P:-AREA.', '    05  :P:-NAME       PIC X(4).']);

function synProgram() {
  const d = tmp();
  fs.writeFileSync(path.join(d, 'SYNAPP1.cbl'), SYN);
  fs.writeFileSync(path.join(d, 'SYNCPY.cpy'), CPY);
  const resolve = (m: string) => (m === 'SYNCPY' ? { path: path.join(d, 'SYNCPY.cpy'), rel: 'SYNCPY.cpy', text: CPY } : null);
  return { d, p: parseApp(path.join(d, 'SYNAPP1.cbl'), 'SYNAPP1.cbl', resolve) };
}

/* ------------------------------------------------------------------ */
describe('STEP 17 - full-application front end (synthetic)', () => {
  test('COPY REPLACING, continuation lines and include origins are expanded with their source lines', () => {
    const lines = expand('x.cbl', 'x.cbl', fixed(['01  A PIC X(10) VALUE \'ABC', '-   \'DEF\'.', 'COPY M REPLACING ==:P:== BY ==Q==.']).replace(/^       -/m, '      -'), (m) => (m === 'M' ? { path: 'm.cpy', rel: 'm.cpy', text: fixed(['01  :P:-X PIC X.']) } : null));
    assert.match(lines[0].text, /'ABCDEF'/);
    assert.equal(lines[1].text.trim(), '01  Q-X PIC X.');
    assert.deepEqual(lines[1].origin, { file: 'm.cpy', line: 1, inst: 1 });
  });

  test('data model: OCCURS with INDEXED BY, COMP-3 size, 88 values (a VALUE inside a condition name is not the VALUE clause)', () => {
    const { p } = synProgram();
    const it = (n: string) => p.data.items.find((x) => x.name === n)!;
    assert.deepEqual(it('WS-AMT').occurs, [{ count: 3, stride: 3 }]);
    assert.deepEqual(it('WS-ENTRY').indexNames, ['WS-IX']);
    assert.equal(it('ACCT-BAL').size, 4);
    assert.equal(it('ACCT-BAL').kind, 'PACKED');
    const flag = it('WS-FLAG');
    assert.deepEqual(flag.conditions.map((c) => [c.name, c.values.map((v) => v.lo.text)]), [['WS-OVER', ['Y']], ['WS-VALUE-OK', ['V']]]);
    assert.ok(p.data.items.some((x) => x.name === 'XY-NAME'), 'COPY REPLACING applied');
  });

  test('procedure: PERFORM THRU, inline VARYING, size phrases, & concatenation, EXEC SQL and an undefined PERFORM target are parsed, nothing dropped', () => {
    const { p } = synProgram();
    const kinds: string[] = [];
    p.paragraphs.forEach((q) => q.sentences.forEach((s) => walkStmts(s, (x) => kinds.push(x.kind))));
    assert.ok(!kinds.includes('untranslated'), kinds.join(','));
    for (const k of ['evaluate', 'perform', 'perform_inline', 'compute', 'arith', 'string', 'exec', 'read', 'open', 'close']) assert.ok(kinds.includes(k), k);
    const mv = [] as any[];
    p.paragraphs.forEach((q) => q.sentences.forEach((s) => walkStmts(s, (x) => x.kind === 'move' && mv.push(x))));
    assert.ok(mv.some((x) => x.from.kind === 'operand' && x.from.operand.kind === 'string' && x.from.operand.value === 'ABCD'));
  });

  test('back end: gaps are explicit (EXEC SQL boundary, undefined procedure) and every statement is mapped to Java', () => {
    const { p } = synProgram();
    const em = emitApp(p, { available: new Set(['SYNAPP1']), lineText: () => '' });
    assert.deepEqual(em.gaps.map((g) => g.kind).sort(), ['EXTERNAL_SYSTEM_BOUNDARY', 'UNDEFINED_PROCEDURE']);
    let n = 0;
    p.paragraphs.forEach((q) => q.sentences.forEach((s) => walkStmts(s, () => n++)));
    assert.equal(em.source_map.statements.length, n);
    assert.ok(Object.keys(em.files).some((f) => f.startsWith('revforge/app/copybooks/')), 'the copybook becomes a shared model');
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 17 - generated Java compiles and behaves as the source defines (synthetic, needs a JDK)', () => {
  test('SYNAPP1: table sum, ROUNDED, ON SIZE ERROR, STRING, indexed READ of COMP-3, and blocked gaps', (t) => {
    if (!TC.java.available) return t.skip('no JDK');
    const { d, p } = synProgram();
    const em = emitApp(p, { available: new Set(['SYNAPP1']), lineText: () => '' });
    const src = path.join(d, 'src');
    for (const [rel, text] of Object.entries(em.files)) {
      fs.mkdirSync(path.dirname(path.join(src, rel)), { recursive: true });
      fs.writeFileSync(path.join(src, rel), text);
    }
    const classes = path.join(d, 'classes');
    const files = [...listJava(RUNTIME_DIR(FORWARD_DIR)), ...listJava(src)];
    const cc = spawnSync(TC.java.javac!, ['-encoding', 'UTF-8', '-Xlint:all', '-Werror', '-d', classes, ...files], { encoding: 'utf8' });
    assert.equal(cc.status, 0, cc.stdout + cc.stderr);
    const gap = (k: string) => em.gaps.find((g) => g.kind === k)!.gap_id;
    const fx = {
      program: 'SYNAPP1',
      scenarios: [
        { id: 'S', kind: 'call', set: { 'LS-CODE': 'S' }, expect: { outcome: 'GOBACK', items: { 'LS-RESULT': '119.00', 'WS-TOTAL': '357', 'WS-SMALL': '99', 'WS-OVER': true, 'WS-MSG': 'TOTAL=OK', 'XY-NAME': 'ABCD', 'WS-AMT(2)': '250' } } },
        { id: 'F', kind: 'call', set: { 'LS-CODE': 'F' }, datasets: { ACCTDD: { records: ['A001' + String.fromCharCode(0x00, 0x12, 0x34, 0x5c), 'A002' + String.fromCharCode(0x00, 0x05, 0x00, 0x0d)] } }, expect: { outcome: 'GOBACK', items: { 'LS-RESULT': '-50.00', 'WS-FS': '00' } } },
        { id: 'X', kind: 'call', set: { 'LS-CODE': 'X' }, expect: { outcome: `BLOCKED ${gap('UNDEFINED_PROCEDURE')}` } },
        { id: 'Q', kind: 'call', set: { 'LS-CODE': 'Q' }, expect: { outcome: `BLOCKED ${gap('EXTERNAL_SYSTEM_BOUNDARY')}` } },
      ],
    };
    fs.writeFileSync(path.join(d, 'fx.json'), JSON.stringify(fx));
    const x = spawnSync(TC.java.java!, ['-cp', classes, 'revforge.cobol.testing.TestMain', `${em.pkg}.${em.cls}`, path.join(d, 'fx.json')], { encoding: 'latin1' });
    const cases = x.stdout.split(/\r?\n/).filter((l) => l.startsWith('CASE|'));
    const fails = cases.filter((l) => l.split('|')[2] === 'FAIL');
    assert.deepEqual(fails, [], x.stdout + x.stderr);
    assert.ok(cases.some((l) => l.startsWith('CASE|S|PASS')) && cases.some((l) => l.startsWith('CASE|F|PASS')));
    assert.ok(cases.filter((l) => l.includes('|BLOCKED_AS_EXPECTED|')).length >= 4, 'scenarios X, Q and both gap probes stay blocked');
  });

  test('runtime unit tests: COBOL representations, MOVE, arithmetic, editing, collation, files all pass', (t) => {
    if (!TC.java.available) return t.skip('no JDK');
    const d = tmp();
    const cc = spawnSync(TC.java.javac!, ['-encoding', 'UTF-8', '-Xlint:all', '-Werror', '-d', d, ...listJava(RUNTIME_DIR(FORWARD_DIR))], { encoding: 'utf8' });
    assert.equal(cc.status, 0, cc.stdout + cc.stderr);
    const x = spawnSync(TC.java.java!, ['-cp', d, 'revforge.cobol.testing.RuntimeTests'], { encoding: 'utf8' });
    const sum = /SUMMARY\|(\d+)\|(\d+)\|(\d+)/.exec(x.stdout);
    assert.ok(sum && Number(sum[1]) >= 31 && sum[3] === '0', x.stdout);
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 17 - consolidated authorisation and guards (synthetic)', () => {
  function setup() {
    const { f, ctx } = setupG2(fixtures);
    const src = path.join(f.sourceRoot, 'src/app/SYNAPP1.cbl');
    fs.mkdirSync(path.dirname(src), { recursive: true });
    fs.writeFileSync(src, SYN);
    fs.writeFileSync(path.join(f.sourceRoot, 'src/app/SYNCPY.cpy'), CPY);
    fs.writeFileSync(path.join(f.sourceRoot, 'src/app/JOB.jcl'), '//SYNJOB JOB (A)\n//S1 EXEC PGM=SYNAPP1\n');
    const mf = path.join(ctx.repoRoot, 'forward/pilot/authorizations/APP.json');
    fs.mkdirSync(path.dirname(mf), { recursive: true });
    fs.writeFileSync(mf, JSON.stringify({ integration_dir: 'forward/generated/java/app/', jcl: [] }));
    const input: LocalAuthorizationInput = {
      program: 'SYNAPP1',
      source: { path: 'src/app/SYNAPP1.cbl', sha256: sha256File(src)! },
      copybooks: [{ path: 'src/app/SYNCPY.cpy', sha256: sha256File(path.join(f.sourceRoot, 'src/app/SYNCPY.cpy'))! }],
      dependencies: [{ path: 'src/app/JOB.jcl', sha256: sha256File(path.join(f.sourceRoot, 'src/app/JOB.jcl'))! }],
      scope_manifest: { path: 'forward/pilot/authorizations/APP.json', sha256: sha256File(mf)! },
      output_dir: 'forward/generated/java/SYNAPP1/',
      purpose: 'synthetic',
      external_ai_disclosure: 'none',
      ai_review_in_session_permitted: false,
      accepted_by: 'synthetic.owner',
      accepted_at: '2026-11-03T00:00:00Z',
      valid_until: '2026-12-03T00:00:00Z',
      presented_text: 'synthetic consolidated text',
      acceptance_evidence: 'synthetic',
    };
    recordLocalAuthorization(wfOf(ctx), input, 'synthetic policy');
    return { f, ctx, out: path.join(ctx.repoRoot, 'forward/generated/java/SYNAPP1'), mf };
  }
  const AT = new Date('2026-11-10T00:00:00Z');

  test('a consolidated record binds dependencies and the scope manifest; a change to either voids it', () => {
    const { f, ctx, out, mf } = setup();
    const ok = checkLocalAuthorization(wfOf(ctx), ctx, 'SYNAPP1', out, AT);
    assert.equal(ok.ok, true, JSON.stringify(ok.checks.filter((c) => !c.ok)));
    assert.equal(integrationScope(wfOf(ctx), ctx).ok, true);
    fs.appendFileSync(path.join(f.sourceRoot, 'src/app/JOB.jcl'), '//* changed\n');
    assert.deepEqual(checkLocalAuthorization(wfOf(ctx), ctx, 'SYNAPP1', out, AT).checks.filter((c) => !c.ok).map((c) => c.id), ['dependencies_unchanged']);
    fs.writeFileSync(mf, '{}');
    assert.equal(integrationScope(wfOf(ctx), ctx).ok, false);
  });

  test('convert-app refuses another program or another output directory, and converts the authorised one', (t) => {
    const { ctx, out } = setup();
    assert.throws(() => convertAppProgram(wfOf(ctx), ctx, { program: 'BRAVO02', out: path.join(ctx.repoRoot, 'forward/generated/java/BRAVO02'), available: new Set(), at: AT }), PilotRefused);
    assert.throws(() => convertAppProgram(wfOf(ctx), ctx, { program: 'SYNAPP1', out: path.join(ctx.repoRoot, 'forward/generated/java/OTHER'), available: new Set(), at: AT }), PilotRefused);
    if (!TC.java.available) return t.skip('no JDK');
    const r = convertAppProgram(wfOf(ctx), ctx, { program: 'SYNAPP1', out, available: new Set(['SYNAPP1']), at: AT });
    assert.equal(r.compilation.status, 'COMPILED', JSON.stringify(r.compilation.diagnostics));
    assert.equal(r.conversion_status, 'PARTIAL');
    assert.equal(r.execution.counts.FAIL, 0);
    const g = conversionValidation(ctx, out);
    assert.equal(g.status, 'PASS', JSON.stringify(g.checks.filter((c) => !c.ok)));
    assert.ok(wfOf(ctx).store.readAudit().some((e: any) => e.event === 'local_generation_performed' && e.data.program === 'SYNAPP1'));
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 17 - JCL and the CONVERSION_VALIDATION label rule', () => {
  test('JCL: steps, PARM, COND, DSN, SYSOUT, DUMMY, continuation and in-stream data', () => {
    const j = parseJcl(['//J1 JOB (A),\'X\',', '//  CLASS=A', '//S1 EXEC PGM=P1,PARM=\'ABC\',', '//   COND=(4,LT)', '//IN DD DSN=A.B.C,DISP=SHR', '//OUT DD SYSOUT=*', '//NUL DD DUMMY', '//SYSIN DD *', 'DATA LINE', '/*', '//S2 EXEC PGM=IDCAMS'].join('\n'), 'x.jcl');
    assert.equal(j.name, 'J1');
    assert.deepEqual(j.steps.map((s) => [s.name, s.pgm, s.parm, s.cond]), [['S1', 'P1', 'ABC', '(4,LT)'], ['S2', 'IDCAMS', null, null]]);
    assert.deepEqual(j.steps[0].dds.map((d) => [d.name, d.dsn, d.sysout, d.dummy, d.instream]), [['IN', 'A.B.C', false, false, false], ['OUT', null, true, false, false], ['NUL', null, false, true, false], ['SYSIN', null, false, false, true]]);
  });

  test('COMPLETE needs a passing source-derived scenario; without one a gap-free conversion is PARTIAL', () => {
    const src = fs.readFileSync(path.join(FORWARD_DIR, 'runtime', 'src', 'pilot', 'gates.ts'), 'utf8');
    assert.match(src, /r\.behaviour_verified === false \? 'PARTIAL' : 'COMPLETE'/);
  });

  test('EXEC SQL DECLARE GLOBAL TEMPORARY TABLE is executable (a boundary gap); DECLARE CURSOR is declarative', () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, 'S.cbl'), fixed(['IDENTIFICATION DIVISION.', 'PROGRAM-ID. SQLDECL.', 'DATA DIVISION.', 'WORKING-STORAGE SECTION.', '01 WS-A PIC X.', 'PROCEDURE DIVISION.', 'P1.', '    EXEC SQL DECLARE C1 CURSOR FOR SELECT A FROM T', '    END-EXEC', '    EXEC SQL DECLARE GLOBAL TEMPORARY TABLE SESSION.T', '        (A CHAR(1)) END-EXEC', '    GOBACK.']));
    const em = emitApp(parseApp(path.join(d, 'S.cbl'), 'S.cbl', () => null), { available: new Set(), lineText: () => '' });
    assert.deepEqual(em.gaps.map((g) => [g.kind, g.origin.line]), [['EXTERNAL_SYSTEM_BOUNDARY', 10]]);
  });

  test('the converter and runtime name no inventory program or copybook', () => {
    for (const f of ['cobol-app.ts', 'java-app.ts', 'app-convert.ts', 'app-integrate.ts']) assert.doesNotMatch(fs.readFileSync(path.join(FORWARD_DIR, 'runtime', 'src', 'pilot', f), 'utf8'), /\b(PORTVALD|PORTREAD|ERRPROC|SQLCA|RTNCDE00|IDCAMS)\b/);
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 17 - real campaign (read-only)', () => {
  const realRunsDir = path.resolve(FORWARD_DIR, 'runs');
  const run = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
  const src = process.env.REVFORGE_COBOL_SOURCE_ROOT && !/revforge-fwd-/.test(process.env.REVFORGE_COBOL_SOURCE_ROOT) ? process.env.REVFORGE_COBOL_SOURCE_ROOT : path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
  const gen = path.join(FORWARD_DIR, 'generated', 'java');
  const skip = !run || !fs.existsSync(src) || !fs.existsSync(path.join(gen, 'app', 'integration-result.json'));
  const realCtx = () => {
    process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
    return loadContext({ forwardDir: FORWARD_DIR });
  };

  test('every one of the 42 programs is authorised by its own record under one consolidated scope', { skip }, () => {
    const ctx = realCtx();
    const wf = loadWorkflow(ctx, run!);
    const progs = new Set(authorizationRecords(wf).map((r: any) => r.program));
    assert.equal(progs.size, 42);
    assert.equal(integrationScope(wf, ctx).ok, true);
    assert.equal(ctx.config.generation.java_generation_allowed, false, 'the global flag is unchanged');
  });

  test('41 programs generate, compile and pass CONVERSION_VALIDATION; POSUPDT has no program to convert', { skip }, () => {
    const ctx = realCtx();
    const dirs = fs.readdirSync(gen).filter((d) => d !== 'app' && fs.existsSync(path.join(gen, d, 'pilot-result.json')));
    const results = dirs.map((d) => ({ d, r: JSON.parse(fs.readFileSync(path.join(gen, d, 'pilot-result.json'), 'utf8')) }));
    const compiled = results.filter((x) => x.r.compilation?.status === 'COMPILED');
    assert.equal(compiled.length, 41);
    assert.equal(results.find((x) => x.d === 'POSUPDT')?.r.conversion_status, 'FAILED');
    for (const x of compiled) {
      const g = conversionValidation(ctx, path.join(gen, x.d));
      assert.equal(x.r.execution.counts.FAIL, 0, x.d);
      // A program whose every executed check stays blocked has nothing passing: the gate fails it on tests_passed only.
      if (x.r.execution.counts.PASS === 0) assert.deepEqual(g.checks.filter((c) => !c.ok).map((c) => c.id), ['tests_passed'], x.d);
      else assert.equal(g.status, 'PASS', `${x.d}: ${JSON.stringify(g.checks.filter((c) => !c.ok))}`);
    }
  });

  test('the integrated application compiles and its runtime, program and integration tests have no failure', { skip }, () => {
    const r = JSON.parse(fs.readFileSync(path.join(gen, 'app', 'integration-result.json'), 'utf8'));
    assert.equal(r.compilation.status, 'COMPILED');
    assert.equal(r.programs.length, 41);
    for (const k of ['runtime_unit', 'program_tests', 'integration']) assert.equal(r.tests[k].counts.FAIL, 0, k);
    assert.ok(r.tests.integration.counts.total >= 28);
  });

  test('generated output stays out of git and backups', () => {
    assert.equal(spawnSync('git', ['-C', REPO, 'check-ignore', 'forward/generated/java/app/src/x.java'], { encoding: 'utf8' }).status, 0);
    assert.deepEqual(javaTrackingViolations(REPO), [], 'only the hand-written Java runtime is tracked; no generated or other Java');
  });
});

/* ------------------------------------------------------------------ */
describe('forward agents and skills live in forward/ (Claude Code copy in .claude/)', () => {
  test('the configuration points the orchestrator at forward/agents and forward/skills, and every definition there is valid', () => {
    const cfg = JSON.parse(fs.readFileSync(path.join(FORWARD_DIR, 'config', 'forward.config.json'), 'utf8'));
    assert.equal(cfg.orchestrator.agents_dir, 'forward/agents');
    assert.equal(cfg.orchestrator.skills_dir, 'forward/skills');
    for (const a of AGENTS) {
      const d = checkDefinition(path.join(FORWARD_DIR, 'agents'), a);
      assert.ok(d.present && d.problems.length === 0, `${a.name}: ${d.problems.join('; ')}`);
    }
    for (const s of SKILLS) assert.ok(fs.existsSync(path.join(FORWARD_DIR, 'skills', s.name, 'SKILL.md')), s.name);
    // Only forward definitions are here; the reverse harness stays in .claude/.
    assert.ok(fs.readdirSync(path.join(FORWARD_DIR, 'agents')).every((f) => /^fe-/.test(f) || f === 'README.md'));
    assert.ok(fs.readdirSync(path.join(FORWARD_DIR, 'skills')).every((f) => /^fe-/.test(f) || f === 'README.md'));
  });

  test('the .claude/ copies match forward/ in this repository', () => {
    const ctx = { repoRoot: REPO, forwardDir: FORWARD_DIR } as any;
    const st = mirrorStatus(ctx);
    assert.equal(st.in_sync, true, JSON.stringify(st.entries.filter((e) => e.status !== 'IN_SYNC').map((e) => [e.name, e.status])));
  });

  test('sync-agents repairs drift from forward/, removes stale skill files and never touches reverse-harness files', () => {
    const root = tmp();
    const fwd = path.join(root, 'forward');
    fs.cpSync(path.join(FORWARD_DIR, 'agents'), path.join(fwd, 'agents'), { recursive: true });
    fs.cpSync(path.join(FORWARD_DIR, 'skills'), path.join(fwd, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(root, '.claude', 'agents'), { recursive: true });
    fs.writeFileSync(path.join(root, '.claude', 'agents', '1_inventory_c.agent.md'), 'reverse agent');
    const ctx = { repoRoot: root, forwardDir: fwd } as any;
    assert.equal(mirrorStatus(ctx).entries.filter((e) => e.status === 'MISSING').length, AGENTS.length + SKILLS.length);
    syncMirror(ctx);
    assert.equal(mirrorStatus(ctx).in_sync, true);
    fs.appendFileSync(path.join(root, '.claude', 'agents', `${AGENTS[0].name}.agent.md`), 'edited in the wrong place');
    fs.writeFileSync(path.join(root, '.claude', 'skills', SKILLS[0].name, 'stale.md'), 'stale');
    assert.deepEqual(mirrorStatus(ctx).entries.filter((e) => e.status !== 'IN_SYNC').map((e) => e.name), [AGENTS[0].name, SKILLS[0].name]);
    const r = syncMirror(ctx);
    assert.equal(r.written.length, 2);
    assert.equal(mirrorStatus(ctx).in_sync, true);
    assert.equal(fs.existsSync(path.join(root, '.claude', 'skills', SKILLS[0].name, 'stale.md')), false);
    assert.equal(fs.readFileSync(path.join(root, '.claude', 'agents', '1_inventory_c.agent.md'), 'utf8'), 'reverse agent');
  });

  test('no forward agent may write its own definitions in forward/agents or forward/skills', () => {
    const roots = { repoRoot: REPO, forwardDir: FORWARD_DIR, workflowDir: path.join(FORWARD_DIR, 'runs', 'x', 'workflow'), sourceRoot: null } as any;
    for (const a of AGENTS) {
      assert.equal(canWrite(a, path.join(FORWARD_DIR, 'agents', `${a.name}.agent.md`), roots).allowed, false, a.name);
      assert.equal(canWrite(a, path.join(FORWARD_DIR, 'skills', SKILLS[0].name, 'SKILL.md'), roots).allowed, false, a.name);
    }
  });
});
