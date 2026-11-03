/**
 * STEP 16 tests: the program-scoped local generation authorisation (policy
 * program_scoped_local_v1) and authorised generation. Mechanisms are tested
 * on a synthetic fixture workflow with the synthetic SYNVAL01 program placed
 * in the fixture source tree: a missing, expired, tampered or mismatched
 * authorisation (program, source hash, copybook hash, output directory)
 * refuses generation; a valid one generates, compiles, tests and audits.
 * The global flag, the orchestrator guard and G0-G8 stay unchanged. The real
 * run is read only: PORTVALD's authorisation and generated output are
 * checked when present, and no other program is authorised.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { loadContext, RuntimeContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { generationAuthorized, loadWorkflow } from '../runtime/src/orchestrator/orchestrator';
import { checkLocalAuthorization, LocalAuthorizationInput, recordLocalAuthorization } from '../runtime/src/pilot/authorization';
import { fieldListFixtures, generateAuthorized } from '../runtime/src/pilot/generate';
import { authorisationStatus, conversionValidation } from '../runtime/src/pilot/gates';
import { detectToolchain, PilotRefused, Toolchain } from '../runtime/src/pilot/pilot';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { setupG2, wfOf } from './helpers/g2fixture';

const REPO = path.resolve(FORWARD_DIR, '..');
const fixtures: Fixture[] = [];
after(() => {
  for (const f of fixtures.splice(0)) cleanup(f);
});
const TC = detectToolchain();
const NO_COBOL: Toolchain = { ...TC, cobol: { available: false, cobc: null, version: null, source: null } };
const sha = (f: string) => sha256File(f)!;
const VAL = path.join(FORWARD_DIR, 'pilot', 'synthetic-val');
const AT = new Date('2026-11-10T00:00:00Z');

/** The synthetic SYNVAL01 cases expressed as reviewed test cases (the input format of `pilot generate`). */
function synvalCases(): any {
  const fx = JSON.parse(fs.readFileSync(path.join(VAL, 'fixtures', 'cases.json'), 'utf8'));
  return {
    contract: 'pilot/conversion-test-cases',
    status: 'synthetic',
    program: 'SYNVAL01',
    cases: fx.cases.map((k: any) => {
      const [type, value, rc, msg] = k.input.split('|');
      const input = rc === '0' && msg === '' ? value : `${value} (with a previous return code ${rc} and message '${msg}' in the area)`;
      if (k.expected.blocked) return { id: k.id, type, input, expected: { unsupported: k.expected.reason } };
      const [, , erc, emsg] = k.expected.image.split('|');
      return { id: k.id, type, input, expected: { return_code: Number(erc), message: emsg } };
    }),
  };
}

/** A fixture workflow whose source tree holds the synthetic SYNVAL01 program and copybook. */
function setup(authorize = true) {
  const { f, ctx } = setupG2(fixtures);
  for (const [from, to] of [['SYNVAL01.cbl', 'src/gen/SYNVAL01.cbl'], ['SYNVALC.cpy', 'src/gen/copy/SYNVALC.cpy']]) {
    fs.mkdirSync(path.dirname(path.join(f.sourceRoot, to)), { recursive: true });
    fs.copyFileSync(path.join(VAL, 'cobol', from), path.join(f.sourceRoot, to));
  }
  const out = path.join(ctx.repoRoot, 'forward', 'generated', 'java', 'SYNVAL01');
  const input: LocalAuthorizationInput = {
    program: 'SYNVAL01',
    source: { path: 'src/gen/SYNVAL01.cbl', sha256: sha(path.join(f.sourceRoot, 'src/gen/SYNVAL01.cbl')) },
    copybooks: [{ path: 'src/gen/copy/SYNVALC.cpy', sha256: sha(path.join(f.sourceRoot, 'src/gen/copy/SYNVALC.cpy')) }],
    output_dir: 'forward/generated/java/SYNVAL01/',
    purpose: 'synthetic test of the local generation authorisation',
    external_ai_disclosure: 'none',
    ai_review_in_session_permitted: false,
    accepted_by: 'synthetic.owner',
    accepted_at: '2026-11-02T00:00:00Z',
    valid_until: '2026-12-02T00:00:00Z',
    presented_text: 'Synthetic authorisation text for SYNVAL01.',
    acceptance_evidence: 'synthetic test fixture',
  };
  const ids = authorize ? recordLocalAuthorization(wfOf(ctx), input, 'synthetic policy statement') : null;
  return { f, ctx, out, input, ids };
}
const failing = (ctx: RuntimeContext, program: string, out: string, at = AT) => checkLocalAuthorization(wfOf(ctx), ctx, program, out, at).checks.filter((c) => !c.ok).map((c) => c.id);

/* ------------------------------------------------------------------ */
describe('STEP 16 - program-scoped local generation authorisation (synthetic)', () => {
  test('without an adopted policy and authorisation, generation is refused and nothing is generated', () => {
    const { ctx, out } = setup(false);
    assert.deepEqual(failing(ctx, 'SYNVAL01', out), ['policy_adopted', 'program_authorized']);
    assert.throws(() => generateAuthorized(wfOf(ctx), ctx, { program: 'SYNVAL01', out, cases: synvalCases(), casesFile: path.join(VAL, 'fixtures', 'cases.json'), javaPackage: 'x.y', toolchain: NO_COBOL, at: AT }), PilotRefused);
    assert.equal(fs.existsSync(out), false);
  });

  test('a valid authorisation passes every check, is sealed in the audit log and changes no global flag, guard or gate', () => {
    const { ctx, out, ids } = setup();
    assert.deepEqual(ids, { policy_id: 'LGP-0001', authorization_id: 'LGA-0001' });
    const r = checkLocalAuthorization(wfOf(ctx), ctx, 'SYNVAL01', out, AT);
    assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c) => !c.ok)));
    const events = wfOf(ctx).store.readAudit().map((e: any) => e.event);
    assert.ok(events.includes('local_generation_policy_adopted') && events.includes('local_generation_authorized'));
    assert.equal(ctx.config.generation.java_generation_allowed, false);
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false, 'the F5 orchestrator guard is not opened');
    assert.equal(authorisationStatus(wfOf(ctx), ctx).generation_authorized, false);
    // A second authorisation reuses the adopted policy.
    const again = recordLocalAuthorization(wfOf(ctx), { ...JSON.parse(fs.readFileSync(wfOf(ctx).store.p('generation', 'LGA-0001.json'), 'utf8')), record_id: undefined }, 'x');
    assert.deepEqual(again, { policy_id: 'LGP-0001', authorization_id: 'LGA-0002' });
  });

  test('another program, another output directory or an expired record is refused', () => {
    const { ctx, out } = setup();
    assert.deepEqual(failing(ctx, 'BRAVO02', out), ['program_authorized']);
    assert.deepEqual(failing(ctx, 'SYNVAL01', path.join(ctx.repoRoot, 'forward', 'generated', 'java', 'OTHER')), ['output_dir_authorized']);
    assert.deepEqual(failing(ctx, 'SYNVAL01', path.join(ctx.repoRoot, 'forward', 'generated', 'java')), ['output_dir_authorized']);
    assert.deepEqual(failing(ctx, 'SYNVAL01', out, new Date('2026-12-03T00:00:00Z')), ['not_expired']);
    assert.deepEqual(failing(ctx, 'SYNVAL01', out, new Date('2026-11-01T00:00:00Z')), ['not_expired']);
  });

  test('a changed source or copybook hash voids the authorisation; restoring the content restores it', () => {
    const { f, ctx, out } = setup();
    const src = path.join(f.sourceRoot, 'src/gen/SYNVAL01.cbl');
    const cpy = path.join(f.sourceRoot, 'src/gen/copy/SYNVALC.cpy');
    const s0 = fs.readFileSync(src);
    fs.appendFileSync(src, '      * changed\n');
    assert.deepEqual(failing(ctx, 'SYNVAL01', out), ['source_unchanged']);
    assert.throws(() => generateAuthorized(wfOf(ctx), ctx, { program: 'SYNVAL01', out, cases: synvalCases(), casesFile: path.join(VAL, 'fixtures', 'cases.json'), javaPackage: 'x.y', toolchain: NO_COBOL, at: AT }), /source_unchanged/);
    fs.writeFileSync(src, s0);
    const c0 = fs.readFileSync(cpy);
    fs.appendFileSync(cpy, '      * changed\n');
    assert.deepEqual(failing(ctx, 'SYNVAL01', out), ['copybooks_unchanged']);
    fs.writeFileSync(cpy, c0);
    assert.deepEqual(failing(ctx, 'SYNVAL01', out), []);
  });

  test('a tampered record breaks its audit seal; records violating the contract are not written', () => {
    const { ctx, out, input } = setup();
    const file = wfOf(ctx).store.p('generation', 'LGA-0001.json');
    const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.writeFileSync(file, JSON.stringify({ ...rec, valid_until: '2099-01-01T00:00:00Z' }, null, 2));
    assert.deepEqual(failing(ctx, 'SYNVAL01', out), ['record_sealed']);
    assert.throws(() => recordLocalAuthorization(wfOf(ctx), { ...input, program: 'X1', external_ai_disclosure: 'openai' as any }, 'x'), /contract/);
    assert.throws(() => recordLocalAuthorization(wfOf(ctx), { ...input, program: 'X2', output_dir: 'output/java/' }, 'x'), /contract/);
    assert.equal(fs.existsSync(wfOf(ctx).store.p('generation', 'LGA-0002.json')), false);
  });

  test('reviewed test cases convert into field-list fixtures, including prior output contents and blocked gaps', () => {
    const fx = fieldListFixtures({ program: 'P', status: 'reviewed', cases: [
      { id: 'A', type: 'A', input: '123 (with a previous return code 9 and message \'X\' in the area)', expected: { return_code: 2, message: 'Bad' } },
      { id: 'B', type: 'M', input: '1.5', expected: { unsupported: 'GAP-P-0001-TEMP' } },
      { id: 'C', type: 'T', input: ' STK', expected: { return_code: 0, message: '' } },
    ] });
    assert.deepEqual(fx.cases.map((k: any) => [k.input, k.expected]), [
      ['A|123|9|X', { image: 'A|123|2|Bad' }],
      ['M|1.5|0|', { blocked: true, reason: 'GAP-P-0001-TEMP' }],
      ['T| STK|0|', { image: 'T| STK|0|' }],
    ]);
    assert.equal(fx.synthetic, false);
  });

  test('an authorised generation converts, compiles, tests, validates and is audited; the result is non-synthetic and bound to its record', (t) => {
    if (!TC.java.available) return t.skip('no JDK');
    const { ctx, out } = setup();
    const r = generateAuthorized(wfOf(ctx), ctx, { program: 'SYNVAL01', out, cases: synvalCases(), casesFile: path.join(VAL, 'fixtures', 'cases.json'), javaPackage: 'revforge.generated.synval01', toolchain: NO_COBOL, at: AT });
    assert.equal(r.synthetic, false);
    assert.equal(r.authorization.record_id, 'LGA-0001');
    assert.equal(r.conversion_status, 'PARTIAL');
    assert.deepEqual(r.execution.counts, { PASS: 18, BLOCKED_AS_EXPECTED: 1, FAIL: 0, total: 19 });
    assert.equal(r.equivalence, 'EQUIVALENCE_UNVERIFIED');
    const v = ctx.contracts.validate('pilot/pilot-result', r);
    assert.equal(v.valid, true, v.errors.join('; '));
    assert.equal(ctx.contracts.validate('pilot/pilot-result', { ...r, authorization: undefined }).valid, false, 'a non-synthetic result must carry its authorisation');
    const g = conversionValidation(ctx, out);
    assert.equal(g.status, 'PASS', JSON.stringify(g.checks.filter((c) => !c.ok)));
    assert.equal(g.label, 'PARTIAL');
    const ev = wfOf(ctx).store.readAudit().filter((e: any) => e.event === 'local_generation_performed');
    assert.equal(ev.length, 1);
    assert.equal((ev[0].data as any).record_id, 'LGA-0001');
    assert.equal((ev[0].data as any).evidence_manifest_sha256, r.evidence.manifest_sha256);
    assert.equal(wfOf(ctx).store.verifyCheckpoint().ok, true);
  });

  test('the synthetic pilot still refuses non-synthetic definitions and stays isolated from the workflow', () => {
    const def = JSON.parse(fs.readFileSync(path.join(VAL, 'pilot.json'), 'utf8'));
    assert.equal(def.synthetic, true);
    const src = fs.readFileSync(path.join(FORWARD_DIR, 'runtime', 'src', 'pilot', 'pilot.ts'), 'utf8');
    assert.match(src, /def\.synthetic !== true\) throw new PilotRefused/);
    assert.match(src, /workflow_used: false, approvals_used: false, production_generation: false, external_ai_calls: false/);
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 16 - real run: PORTVALD only (read-only)', () => {
  const realRunsDir = path.resolve(FORWARD_DIR, 'runs');
  const run = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
  const src = process.env.REVFORGE_COBOL_SOURCE_ROOT && !/revforge-fwd-/.test(process.env.REVFORGE_COBOL_SOURCE_ROOT) ? process.env.REVFORGE_COBOL_SOURCE_ROOT : path.resolve(REPO, 'references', 'udara-legacy-modernization-harness');
  const realCtx = () => {
    process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
    return loadContext({ forwardDir: FORWARD_DIR });
  };
  const authorised = !!run && fs.existsSync(path.join(realRunsDir, run, 'workflow', 'generation', 'LGA-0001.json'));
  const skip = !run || !fs.existsSync(src) || !authorised;

  test('only the accepted PORTVALD record exists; it passes for its directory and no other program is authorised', { skip }, () => {
    const ctx = realCtx();
    const wf = loadWorkflow(ctx, run!);
    const out = path.join(FORWARD_DIR, 'generated', 'java', 'PORTVALD');
    const r = checkLocalAuthorization(wf, ctx, 'PORTVALD', out, AT);
    assert.equal(r.ok, true, JSON.stringify(r.checks.filter((c) => !c.ok)));
    assert.equal(r.authorization.accepted_by, 'Vighnasree Vara');
    assert.equal(r.authorization.source.sha256, '5957fd22546258ae4d9e28847269168d1824bf8d11a9e661f9f62a5adc47f603');
    assert.equal(r.authorization.copybooks[0].sha256, '8d9c7666b01561c4eba4d1e0a95b9da62baaa60c9dcfc2aa5effff06854104bf');
    // STEP 17: the owner accepted one consolidated record; every other LGA record belongs to that scope
    // (bound to the scope manifest). Nothing outside an accepted record is authorised.
    const recs = wf.store.list('generation').filter((f) => f.startsWith('LGA-')).map((f) => wf.store.readRecord('generation', f));
    assert.equal(recs.find((x: any) => x.record_id === 'LGA-0001').program, 'PORTVALD');
    for (const x of recs.filter((y: any) => y.record_id !== 'LGA-0001')) assert.ok(x.scope_manifest && x.accepted_by === 'Vighnasree Vara', x.record_id);
    for (const p of ['NOTAPROG', 'PORTUPD2']) assert.equal(checkLocalAuthorization(wf, ctx, p, path.join(FORWARD_DIR, 'generated', 'java', p), AT).ok, false);
    assert.equal(checkLocalAuthorization(wf, ctx, 'PORTVALD', path.join(FORWARD_DIR, 'generated', 'java'), AT).ok, false);
    // The global flag and the orchestrator guard are unchanged.
    assert.equal(ctx.config.generation.java_generation_allowed, false);
    assert.equal(authorisationStatus(wf, ctx).generation_authorized, false);
  });

  // STEP 17 regenerated PORTVALD with the full-application converter: the same 17 reviewed cases
  // (V01-V17) run as scenarios beside VALUE checks and gap probes.
  test('the generated PORTVALD output validates as PARTIAL with 16 passing cases and V14 blocked', { skip: skip || !fs.existsSync(path.join(FORWARD_DIR, 'generated', 'java', 'PORTVALD', 'pilot-result.json')) }, () => {
    const ctx = realCtx();
    const out = path.join(FORWARD_DIR, 'generated', 'java', 'PORTVALD');
    const g = conversionValidation(ctx, out);
    assert.equal(g.status, 'PASS', JSON.stringify(g.checks.filter((c) => !c.ok)));
    assert.equal(g.label, 'PARTIAL');
    const r = JSON.parse(fs.readFileSync(path.join(out, 'pilot-result.json'), 'utf8'));
    assert.equal(r.synthetic, false);
    assert.equal(r.authorization.record_id, 'LGA-0001');
    const v = r.execution.cases.filter((c: any) => /^V\d\d$/.test(c.id));
    assert.equal(v.length, 17);
    assert.deepEqual(v.filter((c: any) => c.status === 'PASS').length, 16);
    assert.deepEqual(v.filter((c: any) => c.status !== 'PASS').map((c: any) => [c.id, c.status]), [['V14', 'BLOCKED_AS_EXPECTED']]);
    assert.equal(r.execution.counts.FAIL, 0);
    assert.deepEqual(r.gaps.map((x: any) => x.stable_ref), ['GAP-PORTVALD-4000-VALIDATE-AMOUNT-ALNUM-TO-NUMERIC-VAL-TEMP-NUM']);
  });

  test('generated output is git-ignored, excluded from backups, and no Java is tracked', () => {
    const ig = spawnSync('git', ['-C', REPO, 'check-ignore', 'forward/generated/java/PORTVALD/x.java'], { encoding: 'utf8' });
    assert.equal(ig.status, 0, 'forward/generated/ must be ignored');
    assert.match(fs.readFileSync(path.join(FORWARD_DIR, 'tools', 'backup.js'), 'utf8'), /\^forward\\\/generated\\\//);
    assert.equal(spawnSync('git', ['-C', REPO, 'ls-files', '*.java'], { encoding: 'utf8' }).stdout.trim(), '');
  });

  test('the authorisation and generation runtime names no inventory program', () => {
    for (const f of ['authorization.ts', 'generate.ts']) assert.doesNotMatch(fs.readFileSync(path.join(FORWARD_DIR, 'runtime', 'src', 'pilot', f), 'utf8'), /PORTVALD|PORTVAL\b|RTNCDE00/);
  });
});
