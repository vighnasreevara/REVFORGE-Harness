/**
 * STEP 11 tests: verified / partial / gap classification, the isolated
 * synthetic COBOL-to-Java pilot (real javac/java when a JDK is available,
 * skipped - never faked - when not), gap preservation and traceability,
 * recovery completeness, and the real workflow staying fail-closed. The real
 * run is only read.
 */
import { gateRecord } from '../runtime/src/orchestrator/gates';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { generationAuthorized, loadWorkflow, prepare, runGate } from '../runtime/src/orchestrator/orchestrator';
import { evaluateG1Gate } from '../runtime/src/approval/approvals';
import { trustDoctor } from '../runtime/src/operations/trust';
import { CATEGORY, classify, impliedTests, markDependencies, modernizationPlan } from '../runtime/src/pilot/plan';
import { findGaps, parseProgram, UnsupportedConstruct } from '../runtime/src/pilot/cobol-subset';
import { emitJava } from '../runtime/src/pilot/java-emit';
import { detectToolchain, PilotRefused, runPilot, Toolchain, verifyPilotEvidence } from '../runtime/src/pilot/pilot';
import { main } from '../runtime/src/cli';
import { checkLocalAuthorization, integrationScope } from '../runtime/src/pilot/authorization';
import { procedureFacts } from '../verification/src/facts';
import { sourceFile } from '../verification/src/cobol-source';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { wfOf } from './helpers/g2fixture';
import { designFixture, readyForImplementation } from './helpers/designfixture';

import { javaTrackingViolations } from './helpers/gitpolicy';
const backup = require(path.join(FORWARD_DIR, 'tools', 'backup.js'));
const REPO = path.resolve(FORWARD_DIR, '..');
const PILOT = path.join(FORWARD_DIR, 'pilot', 'synthetic-rc');
const fixtures: Fixture[] = [];
const temps: string[] = [];
after(() => {
  for (const f of fixtures.splice(0)) cleanup(f);
  for (const d of temps.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
const tmpdir = (p = 'rf11-') => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), p));
  temps.push(d);
  return d;
};
/** A private copy of the synthetic pilot (inputs only) under a temporary pilot root. */
function pilotCopy(edit?: (dir: string) => void): { root: string; dir: string } {
  const root = tmpdir();
  const dir = path.join(root, 'synthetic-rc');
  fs.cpSync(PILOT, dir, { recursive: true, filter: (s) => !/[\\/]out([\\/]|$)/.test(path.relative(PILOT, s)) && path.basename(s) !== 'out' });
  edit?.(dir);
  return { root, dir };
}
const TC = detectToolchain();
const NO_COBOL: Toolchain = { ...TC, cobol: { available: false, cobc: null, version: null, source: null } };
const NO_JAVA: Toolchain = { java: { available: false, javac: null, java: null, version: null, source: null }, cobol: NO_COBOL.cobol };
const run = (o: { root: string; dir: string }, tc: Toolchain = NO_COBOL) => runPilot({ dir: o.dir, pilotRoot: o.root, forbiddenRoots: [path.join(REPO, 'references'), path.join(REPO, 'output')], toolchain: tc });
const needJava = (t: any) => (TC.java.available ? false : (t.skip('no JDK found (REVFORGE_JAVA_HOME, JAVA_HOME or PATH); Java execution not faked'), true));

const realRunsDir = path.resolve(FORWARD_DIR, 'runs');
const realRun = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
// The configured COBOL source root wins (a restored checkout has no references/ directory).
const realSrc = process.env.REVFORGE_COBOL_SOURCE_ROOT || path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
const realCtx = () => {
  if (fs.existsSync(realSrc)) process.env.REVFORGE_COBOL_SOURCE_ROOT = realSrc;
  return loadContext({ forwardDir: FORWARD_DIR });
};

/* ------------------------------------------------------------------ */
describe('STEP 11 - verified / partial / gap classification', () => {
  test('1. the five support classes map to VERIFIED / PARTIAL / GAP and never to approval', () => {
    assert.equal(classify({ contradicted: true, evidence_established: true, statements: 3, dependent: 0 }), 'CONTRADICTED');
    assert.equal(classify({ contradicted: false, evidence_established: false, statements: 3, dependent: 0 }), 'INSUFFICIENT_EVIDENCE');
    assert.equal(classify({ contradicted: false, evidence_established: true, statements: 3, dependent: 0 }), 'FULLY_SOURCE_SUPPORTED');
    assert.equal(classify({ contradicted: false, evidence_established: true, statements: 3, dependent: 1 }), 'PARTIALLY_SUPPORTED');
    assert.equal(classify({ contradicted: false, evidence_established: true, statements: 3, dependent: 3 }), 'DEPENDENT_ON_TECHNICAL_DECISION');
    assert.deepEqual(Object.values(CATEGORY).sort(), ['GAP', 'GAP', 'GAP', 'PARTIAL', 'VERIFIED']);
  });

  test('3. dependency-aware partial conversion: only statements using an unresolved name (and what they guard) depend on it', () => {
    const src = sourceFile('X.cbl', [
      '       PROCEDURE DIVISION.',
      '       P1.',
      '           MOVE 1 TO WS-A.',
      '           EXEC SQL INSERT INTO TAB1 (COLA) VALUES (:WS-A) END-EXEC.',
      '           IF SQLCODE = 0',
      '              MOVE 0 TO WS-RC',
      '           ELSE',
      '              MOVE 8 TO WS-RC',
      '           END-IF.',
      '           MOVE WS-A TO WS-B.',
    ].join('\n'));
    const pf = procedureFacts(src, null);
    const marked = markDependencies(pf.statements.map((s) => ({ ...s, paragraph: 'P1' })), new Map([['SQLCODE', ['DR-X']], ['COLA', ['DR-Y']]]));
    const dep = marked.filter((s) => s.depends_on.length).map((s) => s.line);
    assert.deepEqual(dep, [5, 6, 7, 8, 9], 'the IF, its branches and END-IF depend; column names inside SQL are not COBOL names');
    assert.equal(marked.find((s) => s.line === 6)!.inherited_from, 5);
    const meaningful = marked.filter((s) => !['ELSE', 'END-IF'].includes(s.verb));
    assert.equal(classify({ contradicted: false, evidence_established: true, statements: meaningful.length, dependent: meaningful.filter((s) => s.depends_on.length).length }), 'PARTIALLY_SUPPORTED');
    const tests = impliedTests(pf.statements, () => null);
    assert.ok(tests.some((t) => /IF SQLCODE = 0/.test(t)));
  });

  test('2/11. RTNCDE00 on the real run: source-backed classes, G1 untouched and fail-closed, nothing written', { skip: !realRun || !fs.existsSync(realSrc) }, () => {
    const ctx = realCtx();
    const wf = loadWorkflow(ctx, realRun!);
    const audit = sha256File(wf.store.p('audit.jsonl'));
    const state = sha256File(wf.store.p('state.json'));
    const scope = ['programs', ['R', 'T', 'N', 'C', 'D', 'E', '0', '0'].join('')].join(':');
    const plan = modernizationPlan(wf, scope);
    assert.equal(ctx.contracts.validate('pilot/modernization-plan', plan).valid, true);
    const cls = Object.fromEntries(plan.requirements.map((r: any) => [r.id.replace(/^(REQ|RT)-[A-Z0-9]+-/, '$1-'), [r.category, r.support_class]]));
    assert.deepEqual(cls['REQ-001'], ['PARTIAL', 'PARTIALLY_SUPPORTED']);
    assert.deepEqual(cls['REQ-002'], ['GAP', 'INSUFFICIENT_EVIDENCE']);
    assert.deepEqual(cls['REQ-003'], ['VERIFIED', 'FULLY_SOURCE_SUPPORTED']);
    assert.deepEqual(cls['REQ-004'], ['GAP', 'CONTRADICTED']);
    assert.deepEqual(cls['RT-001'], ['VERIFIED', 'FULLY_SOURCE_SUPPORTED']);
    // A planning class never changes G1: the scope stays NOT_READY and every G1 outcome is reported as is.
    assert.equal(plan.readiness, 'NOT_READY');
    assert.equal(plan.status, 'NON_AUTHORITATIVE');
    const req3 = plan.requirements.find((r: any) => r.id.endsWith('-003') && r.kind === 'requirement');
    assert.equal(req3.g2.blocking, true, 'source-verified evidence is not acceptance: REQ-003 still blocks');
    assert.ok(req3.required_human_decisions.length >= 1);
    // No fabricated behaviour: dependent statements carry the decisions they wait for.
    for (const r of plan.requirements) for (const d of r.dependent_portion) assert.ok(d.depends_on.every((x: any) => x.decisions.length > 0));
    assert.notEqual(evaluateG1Gate(wf).result.status, 'PASS');
    assert.equal(sha256File(wf.store.p('audit.jsonl')), audit, 'read-only');
    assert.equal(sha256File(wf.store.p('state.json')), state, 'read-only');
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 11 - synthetic pilot', () => {
  test('2. no fabricated behaviour: constructs outside the subset and undeclared names are refused, not guessed', () => {
    const p = pilotCopy((d) => {
      const f = path.join(d, 'cobol', 'SYNRC01.cbl');
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('           MOVE SYN-PEAK-CODE TO SYN-OUT-CODE.', '           COMPUTE SYN-OUT-CODE = SYN-PEAK-CODE * 2.'));
    });
    const r = run(p, NO_JAVA);
    assert.equal(r.conversion_status, 'FAILED');
    assert.equal(r.failure.stage, 'inspection');
    assert.match(r.failure.construct, /COMPUTE/);
    assert.equal(fs.existsSync(path.join(p.dir, 'out', 'java')), false, 'nothing generated');
    const q = pilotCopy((d) => {
      const f = path.join(d, 'cobol', 'SYNRC01.cbl');
      fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('MOVE SYN-PEAK-CODE TO SYN-OUT-CODE.', 'MOVE WS-UNKNOWN-ITEM TO SYN-OUT-CODE.'));
    });
    const prog = parseProgram(path.join(q.dir, 'cobol', 'SYNRC01.cbl'));
    const gaps = findGaps(prog, new Set(), fs.readFileSync(path.join(q.dir, 'cobol', 'SYNRC01.cbl'), 'utf8').split(/\r?\n/));
    assert.ok(gaps.some((g) => g.kind === 'UNDECLARED_NAME' && g.subject === 'WS-UNKNOWN-ITEM'));
    assert.throws(() => emitJava(prog, gaps, 'x.y'), (e: any) => e instanceof UnsupportedConstruct && /WS-UNKNOWN-ITEM/.test(e.construct));
  });

  test('5/6. the synthetic Java compiles (javac -Werror) and every verified fixture case passes', (t) => {
    if (needJava(t)) return;
    const p = pilotCopy();
    const r = run(p);
    assert.equal(r.compilation.status, 'COMPILED', JSON.stringify(r.compilation.diagnostics));
    assert.equal(r.execution.status, 'EXECUTED');
    assert.equal(r.execution.counts.FAIL, 0);
    assert.equal(r.execution.counts.PASS, 14);
    assert.equal(r.execution.counts.BLOCKED_AS_EXPECTED, 1);
    assert.ok(r.execution.cases.some((c: any) => c.id === 'C11' && c.status === 'PASS' && c.actual.endsWith('20')), 'error case: negative code rejected');
    assert.ok(r.execution.cases.some((c: any) => c.id === 'C13' && c.status === 'PASS' && c.actual.endsWith('90')), 'error case: unknown action');
    assert.equal(loadContext({ forwardDir: FORWARD_DIR }).contracts.validate('pilot/pilot-result', r).valid, true);
  });

  test('6. a wrong fixture expectation is detected and the conversion is FAILED, not PARTIAL', (t) => {
    if (needJava(t)) return;
    const p = pilotCopy((d) => {
      const f = path.join(d, 'fixtures', 'cases.json');
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      j.cases.find((c: any) => c.id === 'C05').expected.image = j.cases.find((c: any) => c.id === 'C05').expected.image.replace('T+0000', 'N+0000');
      fs.writeFileSync(f, JSON.stringify(j));
    });
    const r = run(p);
    assert.equal(r.execution.counts.FAIL, 1);
    assert.equal(r.execution.cases.find((c: any) => c.id === 'C05').status, 'FAIL');
    assert.equal(r.conversion_status, 'FAILED');
  });

  test('4/7/9. unresolved paths stay blocked; without a COBOL compiler validation is fixture-based and equivalence UNVERIFIED; open gaps mean PARTIAL', (t) => {
    if (needJava(t)) return;
    const r = run(pilotCopy(), NO_COBOL);
    assert.equal(r.cobol_reference.status, 'COBOL_COMPILER_UNAVAILABLE');
    assert.equal(r.validation.kind, 'FIXTURE_BASED');
    assert.equal(r.equivalence, 'EQUIVALENCE_UNVERIFIED');
    assert.equal(r.conversion_status, 'PARTIAL');
    const blocked = r.execution.cases.find((c: any) => c.id === 'C15');
    assert.equal(blocked.status, 'BLOCKED_AS_EXPECTED');
    assert.equal(blocked.actual, `BLOCKED ${r.gaps[0].gap_id}`);
    assert.deepEqual(r.behaviours.filter((b: any) => b.category === 'GAP').map((b: any) => b.branch), ['SYN-ACT-PUBLISH']);
    // The contract itself refuses the two false claims.
    const reg = loadContext({ forwardDir: FORWARD_DIR }).contracts;
    assert.equal(reg.validate('pilot/pilot-result', { ...r, conversion_status: 'COMPLETE' }).valid, false, 'gaps + COMPLETE is invalid');
    assert.equal(reg.validate('pilot/pilot-result', { ...r, equivalence: 'EQUIVALENT_ON_EXECUTED_FIXTURES' }).valid, false, 'fixture-based + equivalent is invalid');
  });

  test('7. without a JDK nothing is compiled or executed and nothing is claimed', () => {
    const r = run(pilotCopy(), NO_JAVA);
    assert.equal(r.compilation.status, 'JAVA_TOOLCHAIN_UNAVAILABLE');
    assert.equal(r.execution.status, 'NOT_RUN');
    assert.equal(r.conversion_status, 'NOT_EXECUTED');
    assert.equal(r.equivalence, 'EQUIVALENCE_UNVERIFIED');
    assert.ok(r.trace_audit.findings.some((f: string) => /no executed fixture/.test(f)));
  });

  test('8. gap-to-Java traceability: COBOL call site -> gap -> interface, placeholder and Java call line; every statement mapped; evidence is tamper-evident', (t) => {
    if (needJava(t)) return;
    const p = pilotCopy();
    const r = run(p);
    const g = r.gap_trace[0];
    assert.equal(g.kind, 'UNDEFINED_EXTERNAL_CALL');
    assert.match(g.cobol, /SYNRC01\.cbl:\d+/);
    const out = path.join(p.dir, 'out', 'java', 'src');
    const iface = fs.readFileSync(path.join(out, g.java.interface), 'utf8');
    const placeholder = fs.readFileSync(path.join(out, g.java.placeholder), 'utf8');
    assert.match(iface, new RegExp(`REVFORGE-GAP ${g.gap_id}`));
    assert.match(placeholder, /INCOMPLETE PLACEHOLDER/);
    assert.match(placeholder, /throw new UnresolvedGapException/);
    const site = g.java.call_sites[0];
    const javaLine = fs.readFileSync(path.join(out, site.java_file), 'utf8').split('\n')[site.java_line - 1];
    assert.match(javaLine, /\.call\(/);
    assert.match(javaLine, new RegExp(`:${g.cobol.split(':')[1]} CALL`));
    assert.equal(r.trace_audit.mapped_statements, r.trace_audit.statements);
    assert.equal(r.trace_audit.verdict, 'NO_FINDINGS');
    assert.deepEqual(r.gaps[0].origin.excerpt.length > 0, true, 'original context preserved');
    assert.equal(verifyPilotEvidence(path.join(p.dir, 'out'), p.dir).ok, true);
    fs.appendFileSync(path.join(out, g.java.placeholder), '\n// edited\n');
    assert.equal(verifyPilotEvidence(path.join(p.dir, 'out'), p.dir).ok, false);
  });

  test('14. protected sources: real COBOL roots, non-synthetic definitions and output outside the pilot root are refused', () => {
    const p = pilotCopy();
    assert.throws(() => runPilot({ dir: p.dir, pilotRoot: p.root, forbiddenRoots: [p.dir], toolchain: NO_JAVA }), PilotRefused);
    const q = pilotCopy((d) => {
      const f = path.join(d, 'pilot.json');
      fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(fs.readFileSync(f, 'utf8')), synthetic: false }));
    });
    assert.throws(() => run(q, NO_JAVA), /synthetic: true/);
    assert.throws(() => runPilot({ dir: p.dir, pilotRoot: p.root, out: tmpdir(), forbiddenRoots: [], toolchain: NO_JAVA }), /outside the pilot root/);
  });

  test('15. the pilot and planner make no external AI or network calls', () => {
    const files = [...fs.readdirSync(path.join(FORWARD_DIR, 'runtime', 'src', 'pilot')).map((f) => path.join(FORWARD_DIR, 'runtime', 'src', 'pilot', f)), path.join(FORWARD_DIR, 'runtime', 'src', 'commands', 'pilot.ts')];
    for (const f of files) {
      const t = fs.readFileSync(f, 'utf8');
      const imports = [...t.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
      assert.ok(!imports.some((i) => /openai|\/bmad\/|^https?$|^net$|^http2$|undici/.test(i)), `${path.basename(f)} imports ${imports.join(', ')}`);
      assert.ok(!/\bfetch\(/.test(t), `${path.basename(f)} calls fetch`);
    }
    const r = run(pilotCopy(), NO_JAVA);
    assert.equal(r.isolation.external_ai_calls, false);
    assert.equal(r.isolation.workflow_used, false);
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 11 - workflow and protection', () => {
  test('8. synthetic F1-F4 workflow reaches G2 and validated stories in an isolated fixture; F5 still cannot write Java', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    readyForImplementation(f, ctx, dk);
    const wf = wfOf(ctx);
    assert.equal(wf.state.state, 'STORIES_DRAFTED');
    assert.ok(!path.resolve(wf.store.p('')).startsWith(path.resolve(realRunsDir)), 'the synthetic workflow lives outside the real runs');
    assert.equal(generationAuthorized(wf.run, wf.state), false, 'config flag is off: G2 PASS alone never authorises generation');
    const pk = prepare(wf, 'F5');
    assert.equal(pk.permissions.may_write_code, false);
    assert.equal(pk.permissions.generation_authorized, false);
    assert.match(JSON.stringify(pk), /Java generation is not authorised/);
    assert.equal(runGate(wf, 'G2').status, 'PASS', 'G2 still passes; only the config flag is missing');
  });

  test('10/12. the real workflow holds no approvals or resolutions, trust is not configured, and G1/G2 are not PASS', { skip: !realRun }, () => {
    const ctx = realCtx();
    const wf = loadWorkflow(ctx, realRun!);
    const recs = (dir: string) => (fs.existsSync(wf.store.p(dir)) ? fs.readdirSync(wf.store.p(dir)) : []);
    assert.equal(recs('approvals').filter((x) => /^(APR|RES)-/.test(x)).length, 0);
    const all: string[] = [];
    const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : all.push(e.name)));
    walk(wf.store.p(''));
    assert.equal(all.filter((n) => /^(APR|RES|DAP)-\d+/.test(n)).length, 0, 'no signed approval or resolution record of any kind');
    assert.equal(trustDoctor(ctx).status, 'TRUST_NOT_CONFIGURED');
    // Read through the gate-key mapping: the real run may be a legacy state whose raw G1 key is the former evidence gate.
    assert.notEqual(gateRecord(wf.state, 'G2')?.status, 'PASS');
    assert.notEqual(gateRecord(wf.state, 'G1')?.status, 'PASS');
  });

  test('16. no production Java generation: generation unauthorised, the generate command refused, Java only inside pilot output or an authorised local generation directory', { skip: !realRun }, () => {
    const ctx = realCtx();
    const wf = loadWorkflow(ctx, realRun!);
    assert.equal(generationAuthorized(wf.run, wf.state), false);
    assert.equal(ctx.config.generation.java_generation_allowed, false);
    const errs: string[] = [];
    assert.notEqual(main(['generate'], () => undefined, (s) => errs.push(s)), 0);
    const java: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (!['node_modules', '.git', 'references', 'executor', 'staging'].includes(e.name)) walk(p);
        } else if (e.name.endsWith('.java')) java.push(path.relative(REPO, p).split(path.sep).join('/'));
      }
    };
    walk(REPO);
    // STEP 16: besides synthetic pilot output, Java may exist only in a generation directory whose
    // program-scoped local authorisation passes for exactly that program and directory.
    // STEP 17: or in the integration directory named by an unchanged consolidated scope manifest.
    const scope = integrationScope(wf, ctx);
    const unauthorised = java.filter((j) => {
      if (/^forward\/pilot\/[^/]+\/out\/java\//.test(j)) return false;
      if (scope.ok && scope.integration_dir && j.startsWith(scope.integration_dir)) return false;
      // The hand-written runtime library (no source-derived content; never marked GENERATED).
      if (/^forward\/runtime\/java\//.test(j)) return !fs.readFileSync(path.join(REPO, j), 'utf8').startsWith('// GENERATED') && /GENERATED by the REVFORGE/.test(fs.readFileSync(path.join(REPO, j), 'utf8'));
      const m = /^forward\/generated\/java\/([A-Z0-9-]+)\//.exec(j);
      return !m || !checkLocalAuthorization(wf, ctx, m[1], path.join(REPO, 'forward', 'generated', 'java', m[1])).ok;
    });
    assert.deepEqual(unauthorised, [], 'Java exists only in synthetic pilot output or an authorised local generation directory');
    assert.deepEqual(javaTrackingViolations(REPO), [], 'only the hand-written Java runtime is tracked; no generated or other Java');
  });

  test('13. recovery completeness: pilot sources and STEP 11 code are backed up, pilot output is not, and a disposable checkout restores cleanly', () => {
    const d = backup.discover();
    // Recoverable = archived (untracked, ignored, modified) or tracked at the recorded commit.
    const paths = new Set([...d.included, ...d.tracked].map((f: any) => f.path));
    assert.deepEqual(d.tracked_secrets, [], 'no committed file contains a secret pattern');
    for (const p of ['forward/runtime/src/pilot/plan.ts', 'forward/runtime/src/pilot/pilot.ts', 'forward/pilot/synthetic-rc/cobol/SYNRC01.cbl', 'forward/pilot/synthetic-rc/fixtures/cases.json', 'forward/contracts/pilot/pilot-result.schema.json', 'forward/tests/synthetic-conversion-pilot.test.ts']) assert.ok(paths.has(p), p);
    assert.ok(![...paths].some((p) => /^forward\/pilot\/[^/]+\/out\//.test(p as string)));
    // Transient test workspaces written by concurrently running test files are never backed up.
    assert.ok(backup.EXCLUDE.some(([re]: [RegExp]) => re.test('forward/tests/.tmp/runs-s3/X/workflow/state.json')));
    assert.ok(![...paths].some((p) => /^forward\/tests\/\.tmp\//.test(p as string)));
    const b = backup.create(tmpdir('rf11b-'));
    const r = backup.restoreTest(b.archive, { checkout: true, cleanup: true });
    for (const c of r.checks) assert.ok(c.ok, `${c.id}: ${c.detail}`);
    assert.ok(r.checks.some((c: any) => c.id === 'git_baseline'));
    assert.ok(r.checks.some((c: any) => c.id === 'tracked_files_intact'));
    assert.equal(fs.existsSync(r.restore_dir), false, 'disposable checkout removed');
  });
});
