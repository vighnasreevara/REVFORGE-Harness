/**
 * Synthetic two-gate workflow demonstration (environment SYNTHETIC_INTERVIEW_DEMO).
 *
 * Happy path: all nine demo steps (two pre-checks, the human gates G2 and G3,
 * five automated steps) pass on the committed synthetic inputs, with
 * real Java 21 compilation and test execution, an independent oracle, demo
 * approvals for G2 and G3 only, signed with an ephemeral key, and the real
 * project left unchanged.
 *
 * Negative paths: each test injects one defect (into a temporary copy of the
 * inputs or through a demo hook) and checks that the demonstration stops at
 * the right step with a diagnostic and a nonzero exit code. Tests that need a
 * JDK skip themselves without one and never pass by assumption.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { FORWARD_DIR } from './helpers/fixture';
import { loadContext } from '../runtime/src/core/config';
import { assertGenerationAllowed, GenerationNotAuthorizedError } from '../runtime/src/core/guard';
import { loadPolicy } from '../runtime/src/approval/policy';
import { loadTrustStore, verifySignature } from '../runtime/src/approval/trust';
import { receiptCounts } from '../runtime/src/bmad/governance';
import { detectToolchain } from '../runtime/src/pilot/pilot';
import { DEMO_GATES, DEMO_STEPS, DemoHooks, DemoRefused, evaluateDemoStep, initRun, requestApproval, runDemo, STEP_SPECS } from '../runtime/src/demo/gates';
import { EphemeralAuthority, statementText } from '../runtime/src/demo/signing';
import { expectedResult } from '../runtime/src/demo/oracle';

const ctx = loadContext({ forwardDir: FORWARD_DIR });
const INPUTS = path.join(FORWARD_DIR, 'demo', 'gates', 'synthetic');
const JAVA = detectToolchain().java.available;
const NO_JDK = JAVA ? false : 'no JDK (set REVFORGE_JAVA_HOME): Java compilation and tests cannot run';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-demo-gates-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
let n = 0;
const outDir = () => path.join(tmp, `run-${++n}`);
const sha = (p: string) => createHash('sha256').update(fs.readFileSync(p)).digest('hex');

/** A temporary copy of the synthetic inputs; `rebaseline` rewrites its baseline after a deliberate change. */
function copyInputs(): string {
  const d = path.join(tmp, `inputs-${++n}`);
  fs.cpSync(INPUTS, d, { recursive: true });
  return d;
}
function rebaseline(d: string): void {
  const f = path.join(d, 'baseline.json');
  const b = JSON.parse(fs.readFileSync(f, 'utf8'));
  b.inputs = b.inputs.filter((i: any) => fs.existsSync(path.join(d, i.path))).map((i: any) => ({ ...i, sha256: sha(path.join(d, i.path)) }));
  fs.writeFileSync(f, JSON.stringify(b, null, 2) + '\n');
}
const statuses = (s: any) => Object.fromEntries(s.steps.map((g: any) => [g.step, g.demo_status]));
const stepResult = (run: any, g: string) => JSON.parse(fs.readFileSync(path.join(run.outDir, 'steps', `${g}.result.json`), 'utf8'));
const failedChecks = (run: any, g: string) => stepResult(run, g).checks.filter((c: any) => !c.ok).map((c: any) => c.id);
/** Asserts the run stopped at `step` (earlier steps PASS, `step` FAIL, later NOT_RUN) with a nonzero exit code. */
function assertStoppedAt(res: ReturnType<typeof runDemo>, step: string): void {
  const st = statuses(res.summary);
  const i = DEMO_STEPS.indexOf(step as any);
  for (const g of DEMO_STEPS.slice(0, i)) assert.equal(st[g], 'PASS', `${g} should pass before ${step}`);
  assert.equal(st[step], 'FAIL', `${step} should fail`);
  for (const g of DEMO_STEPS.slice(i + 1)) assert.equal(st[g], 'NOT_RUN', `${g} must not run after ${step} failed`);
  assert.equal(res.exitCode, 1);
  assert.equal(res.summary.verdict, 'SYNTHETIC_DEMO_FAILED');
  assert.equal(res.summary.stopped_at, step);
  assert.ok(res.summary.steps[i].reason.length > 10, 'a failing step gives a diagnostic');
}
const mutateJava = (from: RegExp, to: string): DemoHooks => ({
  afterGeneration: (src) => {
    const f = path.join(src, 'revforge', 'app', 'demoord1', 'Demoord1.java');
    const text = fs.readFileSync(f, 'utf8');
    assert.match(text, from, 'the mutation target exists in the generated Java');
    fs.writeFileSync(f, text.replace(from, to));
  },
});

describe('synthetic two-gate demonstration: happy path', () => {
  test('the two gates G2 and G3 and every automated step pass with executed checks, and nothing real changes', { skip: NO_JDK }, () => {
    const configBefore = sha(ctx.configPath);
    const res = runDemo({ ctx, outDir: outDir() });
    const s = res.summary;
    assert.equal(res.exitCode, 0, JSON.stringify(s.steps.filter((g: any) => g.demo_status !== 'PASS')));
    assert.deepEqual(Object.keys(statuses(s)), ['BASELINE', 'EVIDENCE', 'G2', 'G3', 'STORIES', 'BUILD', 'VERIFY', 'REVIEW', 'COMPLETE']);
    assert.deepEqual(Object.values(statuses(s)), Array(9).fill('PASS'));
    assert.equal(s.verdict, 'SYNTHETIC_DEMO_COMPLETED');
    // Only G2 and G3 are gates, and they are the only signed approvals.
    assert.deepEqual([...DEMO_GATES], ['G2', 'G3']);
    assert.deepEqual(DEMO_STEPS.filter((g) => STEP_SPECS[g].kind === 'gate'), ['G2', 'G3']);
    assert.deepEqual(fs.readdirSync(path.join(res.run.outDir, 'approvals')).sort(), ['G2.approval.json', 'G3.approval.json']);
    assert.equal(s.environment, 'SYNTHETIC_INTERVIEW_DEMO');
    assert.equal(s.production_authorization, 'NOT_GRANTED');
    assert.equal(s.real_bmad_execution, 'NOT_EXECUTED');
    assert.equal(s.legacy_equivalence, 'NOT_ESTABLISHED');
    // Every PASS is backed by evaluated checks, all of which passed.
    for (const g of DEMO_STEPS) {
      const r = stepResult(res.run, g);
      assert.equal(r.kind, STEP_SPECS[g].kind);
      assert.ok(r.checks.length >= 5, `${g} evaluated ${r.checks.length} checks`);
      assert.ok(r.checks.every((c: any) => c.ok));
      assert.equal(r.production_authorization, 'NOT_GRANTED');
    }
    // Real Java 21 build and tests, and the independent oracle.
    const g5 = stepResult(res.run, 'BUILD').details;
    assert.equal(g5.build.exit_code, 0);
    assert.equal(g5.tests.passed, g5.tests.scenarios);
    const g6 = stepResult(res.run, 'VERIFY').details;
    assert.ok(g6.cases.total >= 250 && g6.cases.matched === g6.cases.total);
    assert.equal(g6.cobol_reference, 'NOT_EXECUTED');
    // BMad: six bindings simulated, none counted as execution.
    assert.equal(s.bmad.simulated_stages, 6);
    assert.equal(s.bmad.counted_as_bmad_execution, 0);
    assert.deepEqual(s.bmad.stages.map((b: any) => b.binding_id), ['BMAD-PRD', 'BMAD-ARCH', 'BMAD-EPICS', 'BMAD-SPRINT', 'BMAD-BUILD', 'BMAD-REVIEW']);
    assert.ok(s.bmad.stages.every((b: any) => b.mode === 'SIMULATED'));
    // The real project is reported unchanged.
    assert.equal(s.real_project_status.generation_java_generation_allowed, false);
    assert.equal(s.real_project_status.bmad_governance_mandatory, true);
    assert.deepEqual(s.real_project_status.gap_register, { records: 569, open: 569 });
    if (typeof s.real_project_status.business_rule_identities === 'number') assert.equal(s.real_project_status.business_rule_identities, 154);
    assert.equal(sha(ctx.configPath), configBefore);
    // No private key material is ever written; the report shows nine DEMO PASS rows.
    assert.equal(stepResult(res.run, 'COMPLETE').details.completion, 'SYNTHETIC_DEMO_COMPLETED');
    for (const f of fs.readdirSync(res.run.outDir, { recursive: true }) as string[]) {
      const p = path.join(res.run.outDir, f);
      if (fs.statSync(p).isFile() && !p.endsWith('.class')) assert.doesNotMatch(fs.readFileSync(p, 'utf8'), /PRIVATE KEY/, `${f} holds no private key`);
    }
    const report = fs.readFileSync(path.join(res.run.outDir, 'DEMO-REPORT.md'), 'utf8');
    assert.equal((report.match(/\| \*\*DEMO PASS\*\* \|/g) ?? []).length, 9);
    assert.match(report, /NOT_GRANTED/);
  });

  test('the oracle reproduces the worked examples of the requirements', () => {
    const req = JSON.parse(fs.readFileSync(path.join(INPUTS, 'requirements', 'requirements.json'), 'utf8'));
    for (const e of req.examples) assert.deepEqual(expectedResult(e.order), e.expected, e.id);
  });
});

describe('synthetic two-gate demonstration: negative paths', () => {
  test('BASELINE: an altered source hash stops the run', () => {
    const d = copyInputs();
    fs.appendFileSync(path.join(d, 'source', 'DEMOORD1.cbl'), '      * an unreviewed edit\n');
    const res = runDemo({ ctx, inputDir: d, outDir: outDir() });
    assertStoppedAt(res, 'BASELINE');
    assert.ok(failedChecks(res.run, 'BASELINE').includes('source_hash'));
    assert.match(res.summary.steps[0].reason, /does not match the recorded/);
  });

  test('BASELINE: an unexpected extra input file stops the run', () => {
    const d = copyInputs();
    fs.writeFileSync(path.join(d, 'source', 'EXTRA.cbl'), '      * not baselined\n');
    const res = runDemo({ ctx, inputDir: d, outDir: outDir() });
    assertStoppedAt(res, 'BASELINE');
    assert.deepEqual(failedChecks(res.run, 'BASELINE'), ['no_unexpected_files']);
  });

  test('EVIDENCE: missing reverse-engineering evidence stops the run (even with a consistent baseline)', () => {
    const d = copyInputs();
    fs.rmSync(path.join(d, 'reverse', 'reverse-evidence.json'));
    rebaseline(d);
    const res = runDemo({ ctx, inputDir: d, outDir: outDir() });
    assertStoppedAt(res, 'EVIDENCE');
    assert.deepEqual(failedChecks(res.run, 'EVIDENCE'), ['reverse_present']);
  });

  test('EVIDENCE: evidence that does not match the source stops the run', () => {
    const d = copyInputs();
    const f = path.join(d, 'reverse', 'reverse-evidence.json');
    const rev = JSON.parse(fs.readFileSync(f, 'utf8'));
    rev.statements[5].line += 1;
    fs.writeFileSync(f, JSON.stringify(rev, null, 2));
    rebaseline(d);
    const res = runDemo({ ctx, inputDir: d, outDir: outDir() });
    assertStoppedAt(res, 'EVIDENCE');
    assert.ok(failedChecks(res.run, 'EVIDENCE').includes('statements_match_source'));
  });

  test('G2: an invalid approval signature stops the run', () => {
    const hooks: DemoHooks = {
      approve: (g, u, sign) => {
        const r = sign(u);
        if (g !== 'G2') return r;
        const b = Buffer.from(r.signature.value, 'base64');
        b[0] ^= 0xff;
        return { ...r, signature: { ...r.signature, value: b.toString('base64') } };
      },
    };
    const res = runDemo({ ctx, outDir: outDir(), hooks });
    assertStoppedAt(res, 'G2');
    assert.deepEqual(failedChecks(res.run, 'G2'), ['approval_signature']);
    assert.match(res.summary.steps[2].reason, /signature does not verify/);
  });

  test('G2: an approval of different requirements content stops the run', () => {
    const hooks: DemoHooks = { approve: (g, u, sign) => sign(g === 'G2' ? { ...u, subject: { ...u.subject, sha256: 'a'.repeat(64) } } : u) };
    const res = runDemo({ ctx, outDir: outDir(), hooks });
    assertStoppedAt(res, 'G2');
    assert.deepEqual(failedChecks(res.run, 'G2'), ['approval_subject_bound']);
  });

  test('G2: a demo trust store replaced during the run cannot introduce another key', () => {
    const intruder = new EphemeralAuthority();
    const hooks: DemoHooks = {
      afterStep: (g, run) => {
        if (g === 'EVIDENCE') intruder.writeTrustStore(path.join(run.outDir, 'trust'), new Date(Date.now() + 3600e3).toISOString());
      },
      approve: (_g, u) => intruder.sign(u),
    };
    const res = runDemo({ ctx, outDir: outDir(), hooks });
    assertStoppedAt(res, 'G2');
    assert.deepEqual(failedChecks(res.run, 'G2'), ['approval_signature']);
    assert.match(res.summary.steps[2].reason, /replaced after the run started/);
  });

  test('G2: an approval edited after signing stops the run', () => {
    const res = runDemo({ ctx, outDir: outDir(), hooks: { approve: (g, u, sign) => (g === 'G2' ? { ...sign(u), signed_at: '2020-01-01T00:00:00.000Z' } : sign(u)) } });
    assertStoppedAt(res, 'G2');
    assert.deepEqual(failedChecks(res.run, 'G2'), ['approval_signature']);
  });

  test('G2: a validly signed approval bound to another demo run stops the run', () => {
    const res = runDemo({ ctx, outDir: outDir(), hooks: { approve: (g, u, sign) => sign(g === 'G2' ? { ...u, binding: { ...u.binding, demo_run_id: 'DEMO-OTHER-RUN' } } : u) } });
    assertStoppedAt(res, 'G2');
    assert.deepEqual(failedChecks(res.run, 'G2'), ['approval_run_and_baseline_bound']);
  });

  test('G3: a missing architecture approval stops the run', () => {
    const res = runDemo({ ctx, outDir: outDir(), hooks: { approve: (g, u, sign) => (g === 'G3' ? null : sign(u)) } });
    assertStoppedAt(res, 'G3');
    assert.deepEqual(failedChecks(res.run, 'G3'), ['approval_present']);
  });

  test('STORIES: a story citing an unknown requirement stops the run (an automated check, not an approval)', () => {
    const d = copyInputs();
    const f = path.join(d, 'design', 'development-plan.json');
    const plan = JSON.parse(fs.readFileSync(f, 'utf8'));
    plan.stories[0].requirement_ids.push('REQ-DEMO-999');
    fs.writeFileSync(f, JSON.stringify(plan, null, 2));
    rebaseline(d);
    const res = runDemo({ ctx, inputDir: d, outDir: outDir() });
    assertStoppedAt(res, 'STORIES');
    assert.deepEqual(failedChecks(res.run, 'STORIES'), ['stories_trace_requirements']);
    assert.match(stepResult(res.run, 'STORIES').reason, /REQ-DEMO-999/);
    assert.ok(!fs.existsSync(path.join(res.run.outDir, 'approvals', 'G4.approval.json')), 'there is no story approval');
  });

  test('there is no G4 or G8: a demo approval for any gate other than G2 and G3 is contract-invalid', () => {
    const run = initRun({ ctx, outDir: outDir() });
    evaluateDemoStep(run, 'BASELINE');
    evaluateDemoStep(run, 'EVIDENCE');
    const rec = JSON.parse(fs.readFileSync(requestApproval(run, 'G2')!, 'utf8'));
    assert.equal(ctx.contracts.validate('demo/approval', rec).valid, true);
    for (const g of ['G0', 'G1', 'G4', 'G5', 'G6', 'G7', 'G8']) assert.equal(ctx.contracts.validate('demo/approval', { ...rec, gate: g }).valid, false, g);
  });

  test('BUILD: a Java compilation failure stops the run', { skip: NO_JDK }, () => {
    const res = runDemo({ ctx, outDir: outDir(), hooks: mutateJava(/public final class Demoord1/, 'public final class Demoord1 { int broken = ; }\nclass Unused') });
    assertStoppedAt(res, 'BUILD');
    assert.ok(failedChecks(res.run, 'BUILD').includes('compiled'));
    assert.notEqual(stepResult(res.run, 'BUILD').details.build.exit_code, 0);
  });

  test('BUILD: a failing Java test stops the run', { skip: NO_JDK }, () => {
    const res = runDemo({ ctx, outDir: outDir(), hooks: mutateJava(/new BigDecimal\("695"\)/, 'new BigDecimal("696")') });
    assertStoppedAt(res, 'BUILD');
    assert.ok(failedChecks(res.run, 'BUILD').includes('functional_tests'));
    assert.match(stepResult(res.run, 'BUILD').reason, /LS-SHIPPING-CENTS = 696/);
  });

  test('VERIFY: Java that differs from the independent oracle stops the run (a defect the BUILD tests missed)', { skip: NO_JDK }, () => {
    const res = runDemo({ ctx, outDir: outDir(), hooks: mutateJava(/(new BigDecimal\("50000"\)\)) >= 0/, '$1 > 0') });
    assertStoppedAt(res, 'VERIFY');
    assert.ok(failedChecks(res.run, 'VERIFY').includes('java_matches_oracle'));
    assert.match(stepResult(res.run, 'VERIFY').reason, /subtotal 50000|50000/);
  });

  test('REVIEW: tampered test evidence is a blocking review finding', { skip: NO_JDK }, () => {
    const hooks: DemoHooks = { afterStep: (g, run) => g === 'VERIFY' && fs.appendFileSync(path.join(run.outDir, 'build', 'functional-results.json'), ' ') };
    const res = runDemo({ ctx, outDir: outDir(), hooks });
    assertStoppedAt(res, 'REVIEW');
    assert.deepEqual(failedChecks(res.run, 'REVIEW'), ['test_evidence_integrity']);
    const review = JSON.parse(fs.readFileSync(path.join(res.run.outDir, 'steps', 'REVIEW.review.json'), 'utf8'));
    assert.equal(review.decision, 'FAIL');
    assert.ok(review.findings.some((f: any) => f.blocking));
  });

  test('COMPLETE: a review result edited after the review stops completion', { skip: NO_JDK }, () => {
    const hooks: DemoHooks = { afterStep: (g, run) => g === 'REVIEW' && fs.appendFileSync(path.join(run.outDir, 'steps', 'REVIEW.review.json'), ' ') };
    const res = runDemo({ ctx, outDir: outDir(), hooks });
    assertStoppedAt(res, 'COMPLETE');
    assert.ok(failedChecks(res.run, 'COMPLETE').includes('evidence_complete'));
    assert.equal(stepResult(res.run, 'COMPLETE').details.completion, 'NOT_COMPLETED');
  });

  test('COMPLETE: Java changed after the review stops completion', { skip: NO_JDK }, () => {
    const hooks: DemoHooks = {
      afterStep: (g, run) => {
        if (g !== 'REVIEW') return;
        const build = JSON.parse(fs.readFileSync(path.join(run.outDir, 'build', 'build.json'), 'utf8'));
        fs.appendFileSync(path.join(run.outDir, build.compiled_sources[0].path), '\n// edited after review\n');
      },
    };
    const res = runDemo({ ctx, outDir: outDir(), hooks });
    assertStoppedAt(res, 'COMPLETE');
    assert.deepEqual(failedChecks(res.run, 'COMPLETE'), ['evidence_complete']);
  });

  test('a later step attempted before its prerequisite passes is BLOCKED', () => {
    const run = initRun({ ctx, outDir: outDir() });
    const r = evaluateDemoStep(run, 'G3');
    assert.equal(r.demo_status, 'BLOCKED');
    assert.match(r.reason, /prerequisite G2 has not passed/);
    assert.equal(evaluateDemoStep(run, 'STORIES').demo_status, 'BLOCKED', 'story validation needs G3');
    // A recorded PASS whose result file was changed afterwards no longer counts.
    assert.equal(evaluateDemoStep(run, 'BASELINE').demo_status, 'PASS');
    assert.equal(evaluateDemoStep(run, 'EVIDENCE').demo_status, 'PASS');
    fs.appendFileSync(path.join(run.outDir, 'steps', 'EVIDENCE.result.json'), ' ');
    requestApproval(run, 'G2');
    const g2 = evaluateDemoStep(run, 'G2');
    assert.equal(g2.demo_status, 'BLOCKED');
    assert.match(g2.reason, /result file is missing or changed/);
  });

  test('demo approvals and simulated BMad receipts are never production authorisation', () => {
    // A SIMULATED BMad record is refused by the real receipt counter.
    const counted = receiptCounts({ receipt_id: 'SIM-1', binding_id: 'BMAD-PRD', mode: 'SIMULATED', accepted: true, intact: true, evidence_status: 'SIMULATED', scope: 'programs:DEMOORD1', scope_sha256: 'x', documents_intact: true }, 'BMAD-PRD', 'programs:DEMOORD1', 'x');
    assert.equal(counted.ok, false);
    assert.match(counted.reason, /never BMad execution evidence/);
    // A demo approval does not verify against the real trust anchor.
    const run = initRun({ ctx, outDir: outDir() });
    evaluateDemoStep(run, 'BASELINE');
    evaluateDemoStep(run, 'EVIDENCE');
    const f = requestApproval(run, 'G2')!;
    const rec = JSON.parse(fs.readFileSync(f, 'utf8'));
    const real = loadTrustStore(ctx, loadPolicy(ctx));
    assert.equal(verifySignature(real, rec.signer.signer_id, statementText(rec), rec.signature.value, ['requirements_approver']).ok, false);
    // Independently of the configuration: a configured trust store holding other keys does not accept it either.
    const other = new EphemeralAuthority();
    const storeFile = other.writeTrustStore(path.join(tmp, `other-store-${++n}`), new Date(Date.now() + 3600e3).toISOString());
    const doc = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    doc.signers[0].signer_id = 'requirements-owner';
    doc.signers[0].roles = ['requirements_approver'];
    fs.writeFileSync(storeFile, JSON.stringify(doc));
    const configured = loadTrustStore(ctx, { ...loadPolicy(ctx), trust_store: storeFile, trust_store_env: '' });
    assert.equal(configured.usable, true);
    assert.equal(verifySignature(configured, rec.signer.signer_id, statementText(rec), rec.signature.value, ['requirements_approver']).ok, false);
    assert.equal(rec.production_authorization, 'NOT_GRANTED');
    // The real generation guard still refuses, even when handed demo results as if they were a generation gate.
    assert.throws(() => assertGenerationAllowed(ctx.config.generation, [{ gate_id: 'GENERATION', approved: true }]), GenerationNotAuthorizedError);
    // The demo refuses to write into the real workflow runs or the reverse artifacts.
    assert.throws(() => initRun({ ctx, outDir: path.join(ctx.runsDir, 'demo-attempt') }), DemoRefused);
    assert.throws(() => initRun({ ctx, outDir: path.join(ctx.repoRoot, 'output', 'demo-attempt') }), DemoRefused);
    assert.equal(fs.existsSync(path.join(ctx.runsDir, 'demo-attempt')), false);
  });

  test('the CLI exits nonzero with a diagnostic when a demo step fails', () => {
    const d = copyInputs();
    fs.appendFileSync(path.join(d, 'source', 'DEMOORD1.cbl'), '      * edit\n');
    const x = spawnSync(process.execPath, [path.join(FORWARD_DIR, 'dist', 'runtime', 'src', 'cli.js'), 'demo', 'gates', '--input', d, '--out', outDir()], { encoding: 'utf8', timeout: 300000 });
    assert.equal(x.status, 1, x.stderr);
    assert.match(x.stdout, /BASELINE Baseline pre-check\s+\(precheck\)\s+DEMO FAIL/);
    assert.match(x.stdout, /SYNTHETIC_DEMO_FAILED/);
    assert.match(x.stdout, /NOT_GRANTED/);
  });
});
