/**
 * STEP 10: evidence adjudication, fail-closed G1 evidence selection, review
 * packages, stale requests and the recoverable backup. Synthetic COBOL,
 * synthetic signers and temporary directories only.
 */
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { sha256File } from '../runtime/src/core/fsutil';
import { generationAuthorized, policyRoots, runGate } from '../runtime/src/orchestrator/orchestrator';
import { findAgent } from '../runtime/src/orchestrator/agents';
import { canWrite } from '../runtime/src/orchestrator/permissions';
import { canonicalize } from '../runtime/src/approval/canonical';
import { resolveDecision } from '../runtime/src/approval/decisions';
import { evaluateScope, parseSelector } from '../runtime/src/approval/scope';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { SourceReader } from '../runtime/src/blockers/deterministic';
import { checkItem, contextReport, recordSupplements, supplements } from '../runtime/src/context/context';
import { adjudicateItem, adjudicationReport, adjudications, matchKind, recordAdjudications } from '../runtime/src/context/adjudication';
import { exportResolutionRequest, sharedImpact } from '../runtime/src/operations/decisions';
import { dependencyFactSheet, reviewPackage, staleRequests } from '../runtime/src/operations/package';
import { logicalText } from '../verification/src/context';
import { sourceFile } from '../verification/src/cobol-source';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { KP, SIGNERS, signText, wfOf } from './helpers/g2fixture';
import { BRAVO, DESIGN_SIGNERS } from './helpers/designfixture';
import { contextFixture } from './helpers/contextfixture';

const backup = require(path.join(FORWARD_DIR, 'tools', 'backup.js'));
const fixtures: Fixture[] = [];
const temps: string[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
});
afterEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  while (fixtures.length) cleanup(fixtures.pop()!);
  while (temps.length) fs.rmSync(temps.pop()!, { recursive: true, force: true });
});
const tmpdir = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rf10-'));
  temps.push(d);
  return d;
};
const item = (ctx: any, id: string) => buildSnapshot(wfOf(ctx)).itemById.get(id)!;
const finding = (ctx: any, id: string) => evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(BRAVO)).findings.find((f) => f.id === id)!;
function sign(f: Fixture, ctx: any, decision: string, outcome: string, kp: KP, signer: string, role: string, selected: string | null, req?: any) {
  const r0 = req ?? exportResolutionRequest(wfOf(ctx), decision, BRAVO);
  const res = { ...r0, outcome, selected_option: selected, resolution_text: `Synthetic resolution for ${decision}`, justification: 'Synthetic justification recorded by a test signer', signer_id: signer, role, resolved_at: new Date(Date.now() - 1000).toISOString() };
  const file = path.join(f.repoRoot, `r10-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-decision-resolution', resolution: res, signature: { algorithm: 'ed25519', value: signText(canonicalize(res), kp) } }));
  return resolveDecision(wfOf(ctx), file, { build: (w) => buildSnapshot(w) });
}
/** A claim whose 'H' the earlier checker finds only inside the data name BRV-HIGH. */
const FALSE_POSITIVE = { claim: "When the limit exceeds 500 the status is set to HIGH ('H').", value: 'Q' };

/* ------------------------------------------------------------------ */
describe('STEP 10 — adjudication of earlier and new evidence', () => {
  test('2/11. an earlier verification that rests on a substring inside a data name is proven false and superseded (fail-closed)', () => {
    const { ctx, req } = contextFixture(fixtures, { ...FALSE_POSITIVE, copyExtra: ["               88  BRV-HOLD VALUE 'H'."], progExtra: ['           IF BRV-HOLD', "              DISPLAY 'ON HOLD'", '           END-IF.'] });
    assert.equal(item(ctx, req).claim!.result, 'verified', 'the earlier checker accepted it');
    const snap = buildSnapshot(wfOf(ctx));
    const a = adjudicateItem(snap, new SourceReader(snap), snap.itemById.get(req)!);
    assert.equal(a.cohort, 'questionable_earlier_verification');
    assert.deepEqual(a.matches.map((m: any) => `${m.value}:${m.match}`).sort(), ['500:number', 'H:substring_of_name'], 'a genuine number is told apart from the false substring');
    assert.equal(a.superseding_status, 'EVIDENCE_INVALIDATED');
    assert.ok(a.diagnosis.includes('INCORRECT_VERIFICATION_METHOD') && a.diagnosis.includes('UNSUPPORTED_SOURCE_CITATION'));
    assert.ok(a.diagnosis.includes('CORRECT_CLAIM_ALTERNATIVE_EVIDENCE'), 'an uncited statement testing BRV-HOLD supports the value');
    assert.equal(a.alternative_evidence[0].statements[0].via[0].condition, 'BRV-HOLD');
    const before = evaluateScope(snap, parseSelector(BRAVO)).scope_sha256;
    const rec = recordAdjudications(wfOf(ctx), adjudicationReport(wfOf(ctx), BRAVO));
    assert.ok(rec.some((x) => x.item_id === req && x.new && x.superseding_status === 'EVIDENCE_INVALIDATED'));
    const it = item(ctx, req);
    assert.equal(it.claim!.result, 'unverified', 'G1 no longer uses the false verification');
    assert.equal(finding(ctx, req).outcome, 'REQUIRES_EVIDENCE');
    assert.notEqual(evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(BRAVO)).scope_sha256, before, '18. the scope digest changes');
    assert.equal(buildSnapshot(wfOf(ctx)).resolutions.get(`RVW-${req}`)?.status ?? 'open', 'open', 'no decision is resolved by an evidence change');
  });

  test('3. a genuine literal, number or word is a defensible match; containment in a longer literal counts, single letters must be whole literals', () => {
    const t = logicalText(sourceFile('/x.cbl', "           DISPLAY 'RECORDS DELETED: ' WS-COUNT 'A'.\n           MOVE 1000 TO WS-LIMIT."), 1, 2);
    assert.equal(matchKind(t, 'Records deleted:'), 'literal');
    assert.equal(matchKind(t, 'A'), 'literal');
    assert.equal(matchKind(t, '1000'), 'number');
    assert.equal(matchKind(t, 'WS-LIMIT'), 'word');
    assert.equal(matchKind(t, 'S'), 'substring_of_name');
    assert.equal(matchKind(t, 'ZZ'), 'not_present');
  });

  test('1/12. a new dependency chain is verified, linked to its supplement, and accepted only by a signed review', () => {
    const { f, ctx, k, req } = contextFixture(fixtures);
    const sups = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO));
    const s = sups.find((x) => x.item_id === req)!;
    const rec = recordAdjudications(wfOf(ctx), adjudicationReport(wfOf(ctx), BRAVO)).find((x) => x.item_id === req)!;
    assert.equal(rec.classification, 'SOURCE_CHAIN_VERIFIED');
    assert.equal(adjudications(wfOf(ctx)).find((x) => x.adjudication_id === rec.adjudication_id)!.linked.evidence_supplements[0], s.supplement_id);
    assert.equal(finding(ctx, req).outcome, 'REQUIRES_EVIDENCE', 'verified evidence is not acceptance');
    assert.equal(sign(f, ctx, `RVW-${req}`, 'resolved_no_change', k.sme, SIGNERS.sme, 'business_sme', s.supplement_id).recorded, true);
    assert.notEqual(finding(ctx, req).outcome, 'REQUIRES_EVIDENCE', '15. signed acceptance makes the evidence count');
  });

  test('16. an unauthorised signer cannot accept evidence', () => {
    const { f, ctx, dk, req } = contextFixture(fixtures);
    const s = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO)).find((x) => x.item_id === req)!;
    const r = sign(f, ctx, `RVW-${req}`, 'resolved_no_change', dk.architect, DESIGN_SIGNERS.architect, 'architecture_approver', s.supplement_id);
    assert.equal(r.recorded, false);
    assert.ok(r.checks.some((c: any) => (c.id === 'role_claimed' || c.id === 'signature') && !c.ok));
  });

  test('4/5/6/17. conflicting and superseded evidence fails closed; a stale request cannot be reused', () => {
    const { f, ctx, k, req } = contextFixture(fixtures);
    const v1 = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO)).find((x) => x.item_id === req)!;
    const oldReq = exportResolutionRequest(wfOf(ctx), `RVW-${req}`, BRAVO);
    const dir = tmpdir();
    fs.writeFileSync(path.join(dir, 'old.request.json'), JSON.stringify(oldReq));
    fs.appendFileSync(path.join(f.sourceRoot, f.copybooks[0].rel), '      * edited\n');
    const v2 = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO)).find((x) => x.item_id === req)!;
    assert.equal(v2.version, 2);
    const snap = buildSnapshot(wfOf(ctx));
    assert.equal(snap.contextSupplements.get(v1.supplement_id)!.current, false, 'superseded evidence is never current');
    assert.ok(snap.contextSupplements.get(v1.supplement_id)!.problems.some((p) => /superseded|changed/.test(p)));
    const stale = staleRequests(snap, [dir]);
    assert.equal(stale[0].stale, true, `stale: ${stale[0].reasons.join('; ')}`);
    const r = sign(f, ctx, `RVW-${req}`, 'resolved_no_change', k.sme, SIGNERS.sme, 'business_sme', v1.supplement_id, oldReq);
    assert.equal(r.recorded, false);
    assert.ok(r.checks.some((c: any) => !c.ok && ['decision_binding', 'evidence_supplement_binding', 'affected_content'].includes(c.id)));
  });

  test('6. a changed source makes an invalidation stale but still fail-closed until re-adjudicated', () => {
    const { f, ctx, req } = contextFixture(fixtures, FALSE_POSITIVE);
    recordAdjudications(wfOf(ctx), adjudicationReport(wfOf(ctx), BRAVO));
    fs.appendFileSync(path.join(f.sourceRoot, f.programs[1].rel), '      * edited after adjudication\n');
    const it = item(ctx, req);
    assert.equal(it.claim!.result, 'unverified');
    assert.match(it.claim!.reasons[0], /re-adjudication required/);
  });

  test('9. a wrong field-parent relationship in the catalogue keeps the chain partial', () => {
    const { ctx, req } = contextFixture(fixtures, { catalogueParent: 'WRONG-PARENT' });
    const snap = buildSnapshot(wfOf(ctx));
    const a = adjudicateItem(snap, new SourceReader(snap), snap.itemById.get(req)!);
    assert.equal(a.classification, 'SOURCE_CHAIN_PARTIAL');
    assert.ok(a.classification_reasons.some((r: string) => /parent: catalogue WRONG-PARENT/.test(r)));
  });

  test('7/8/10. missing copybooks, duplicate 88 names and unrelated literals never produce a verified chain', () => {
    const dup = contextFixture(fixtures, { copyExtra: ['       01  OTHER-AREA.', '           05  OTHER-STATUS PIC X.', "               88  BRV-HIGH VALUE 'Q'."] });
    let snap = buildSnapshot(wfOf(dup.ctx));
    let c = checkItem(snap, new SourceReader(snap), snap.itemById.get(dup.req)!);
    assert.equal(c.status, 'CONTEXT_UNRESOLVED', 'duplicate condition names are ambiguous');
    const unrel = contextFixture(fixtures, { claim: "When the limit exceeds 500 the status becomes LOW ('L')." });
    snap = buildSnapshot(wfOf(unrel.ctx));
    c = checkItem(snap, new SourceReader(snap), snap.itemById.get(unrel.req)!);
    assert.equal(c.literal_support[0].support, 'unrelated_occurrence_only');
    assert.notEqual(c.status, 'CONTEXT_SUPPORTED');
    const miss = contextFixture(fixtures, { copyExtra: ['           COPY NOSUCHCPY.'] });
    snap = buildSnapshot(wfOf(miss.ctx));
    c = checkItem(snap, new SourceReader(snap), snap.itemById.get(miss.req)!);
    assert.ok(c.uncertainties.some((u) => /NOSUCHCPY.*cannot be resolved/.test(u)));
  });

  test('13. an incorrect citation stays a mismatch and cannot be accepted', () => {
    const { ctx, req } = contextFixture(fixtures, { citeLine: 13 });
    const sups = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO));
    const s = supplements(wfOf(ctx)).find((x) => x.item_id === req);
    if (s) assert.equal(s.acceptance.eligible, false);
    void sups;
    assert.equal(finding(ctx, req).outcome, 'CONTRADICTED');
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 10 — shared dependencies, packages and gates', () => {
  test('14/19. a self-including shared copybook is reported with every dependent program and scope; the decision stays open', () => {
    const { f, ctx } = contextFixture(fixtures, { copyExtra: ['           COPY RECLAYT.'] });
    const snap = buildSnapshot(wfOf(ctx));
    const cb = f.copybooks[0].name;
    const d = [...snap.register.values()].find((x) => x.affected_units.some((u) => u.name === cb));
    assert.ok(d, 'a decision on the shared copybook exists');
    const facts = dependencyFactSheet(snap, d!.decision_id);
    const book = facts.copybooks.find((b: any) => b.name === cb);
    assert.ok(book.self_inclusion.length >= 1, 'self-inclusion detected');
    assert.ok(book.included_by_programs.length >= 2);
    assert.deepEqual(facts.affected_scopes.map((s: any) => s.scope).sort(), sharedImpact(snap, d!.affected_units.map((u) => u.name)).map((s) => s.scope).sort());
    assert.ok(facts.separation.E_must_be_decided.includes('technical authority') || facts.separation.E_must_be_decided.includes('must choose'));
    assert.notEqual(snap.resolutions.get(d!.decision_id)?.status, 'resolved');
  });

  test('a review package is complete, not an approval, and regenerates fresh requests while flagging stale ones', () => {
    const { ctx } = contextFixture(fixtures, FALSE_POSITIVE);
    const dir = tmpdir();
    const p1 = reviewPackage(wfOf(ctx), BRAVO, { exportDir: dir, staleDirs: [dir] });
    assert.equal(p1.status, 'NOT_APPROVED');
    assert.ok(p1.requirements.length >= 1 && p1.units.length >= 1 && p1.pass_conditions.length >= 4);
    for (const r of p1.requirements) assert.ok('accepted_by_authorised_reviewer' in r.layers && 'deterministically_verified' in r.layers);
    fs.renameSync(path.join(dir, 'resolution-requests'), path.join(dir, 'earlier'));
    recordAdjudications(wfOf(ctx), adjudicationReport(wfOf(ctx), BRAVO));
    const p2 = reviewPackage(wfOf(ctx), BRAVO, { exportDir: dir, staleDirs: [path.join(dir, 'earlier')] });
    assert.notEqual(p2.scope_sha256, p1.scope_sha256);
    assert.ok(p2.fresh_requests.length >= 1);
  });

  test('20/21/22. G1 cannot accept invalid evidence or pass without signatures; G2/G4 stay protected', () => {
    const { f, ctx, k, req } = contextFixture(fixtures, FALSE_POSITIVE);
    recordAdjudications(wfOf(ctx), adjudicationReport(wfOf(ctx), BRAVO));
    const sups = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO));
    const s = sups.find((x) => x.item_id === req);
    if (s) {
      const r = sign(f, ctx, `RVW-${req}`, 'resolved_no_change', k.sme, SIGNERS.sme, 'business_sme', s.supplement_id);
      assert.equal(r.recorded, false, 'invalid or advisory evidence cannot be accepted');
    }
    assert.ok(finding(ctx, req).blocking);
    assert.notEqual(runGate(wfOf(ctx), 'G1').status, 'PASS');
    assert.equal(runGate(wfOf(ctx), 'G2').status, 'BLOCKED');
  });

  test('28/29/30. historical receipts and reverse outputs unchanged; no Java', () => {
    const { f, ctx } = contextFixture(fixtures, FALSE_POSITIVE);
    const receipts = wfOf(ctx).store.list('receipts').map((x) => [x, sha256File(wfOf(ctx).store.p('receipts', x))]);
    const out = sha256File(path.join(f.repoRoot, 'output', 'data', 'data_artifact.json'));
    recordAdjudications(wfOf(ctx), adjudicationReport(wfOf(ctx), BRAVO));
    reviewPackage(wfOf(ctx), BRAVO, { exportDir: tmpdir(), staleDirs: [] });
    assert.deepEqual(wfOf(ctx).store.list('receipts').map((x) => [x, sha256File(wfOf(ctx).store.p('receipts', x))]), receipts);
    assert.equal(sha256File(path.join(f.repoRoot, 'output', 'data', 'data_artifact.json')), out);
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false);
    assert.equal(canWrite(findAgent('F5')!, path.join(f.repoRoot, 'java', 'src', 'main', 'java', 'A.java'), policyRoots(wfOf(ctx).run, wfOf(ctx).state)).allowed, false);
    assert.equal(wfOf(ctx).store.verifyCheckpoint().ok, true);
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 10 — recoverable backup', () => {
  test('23/24. the inventory covers the implementation (agents, skills, sources, lockfile) and excludes secrets', () => {
    const d = backup.discover();
    // The implementation is recoverable: archived (untracked, ignored or modified) or tracked at the recorded commit.
    const recoverable = [...d.included, ...d.tracked];
    const paths = new Set(recoverable.map((f: any) => f.path));
    for (const p of ['forward/package.json', 'forward/package-lock.json', 'forward/tsconfig.json', 'forward/runtime/src/cli.ts', 'forward/runtime/java/revforge/cobol/CobolProgram.java', 'forward/integrations/bmad/release.pin.json', 'forward/integrations/bmad/isolation/sandbox.sh']) assert.ok(paths.has(p), p);
    assert.equal(recoverable.filter((f: any) => /^\.claude\/agents\/fe-/.test(f.path)).length, 7);
    assert.equal(new Set(recoverable.filter((f: any) => /^\.claude\/skills\/fe-/.test(f.path)).map((f: any) => f.path.split('/')[2])).size, 14);
    assert.ok(d.tracked.every((f: any) => /^[0-9a-f]{40}$/.test(f.blob)), 'tracked files carry their git blob ids');
    assert.ok(!d.included.some((f: any) => d.tracked.some((t: any) => t.path === f.path)), 'a file is either archived or recoverable from the commit, never both');
    for (const set of [d.included, d.tracked]) {
      // Only the empty placeholder that keeps forward/runs/ in the tree may sit under an excluded root.
      assert.deepEqual(set.filter((f: any) => /^forward\/(runs|node_modules|dist|generated)\//.test(f.path) && !(f.path === 'forward/runs/.gitkeep' && f.bytes === 0)).map((f: any) => f.path), []);
      assert.ok(!set.some((f: any) => /^references\//.test(f.path) || /\.mcp\.json$|\.env/.test(f.path)));
    }
    assert.deepEqual(d.tracked_secrets, [], 'no committed file contains a secret pattern');
    // Synthetic secret shapes are assembled at runtime so this file never looks like a secret itself
    // (a file that did would be left out of the backup).
    assert.equal(backup.hasSecret('NEO4J_' + 'PASSWORD=hunter2isnotreal')?.[1], 'database password assignment');
    assert.deepEqual(d.excluded.filter((e: any) => /secret/.test(e.reason) && /^forward\/(runtime|verification|tests|tools|contracts|docs)\//.test(e.path)), [], 'no implementation source is left out as a secret');
    assert.equal(backup.hasSecret('key sk-ant-' + 'A'.repeat(30))?.[1], 'API key');
    assert.equal(backup.hasSecret('-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(64)), backup.hasSecret('-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(64)));
    assert.ok(backup.hasSecret('-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(64)));
    assert.equal(backup.hasSecret("const KEY = 'sk-test-REVFORGE-0123456789abcdefghij';"), null, 'the documented synthetic test value is not a secret');
  });

  test('25. archives with absolute paths, traversal or links are refused before extraction', () => {
    const d = tmpdir();
    fs.mkdirSync(path.join(d, 'a', 'b'), { recursive: true });
    fs.writeFileSync(path.join(d, 'a', 'evil.txt'), 'x');
    const evil = path.join(d, 'evil.tgz');
    const r = spawnSync(backup.TAR, ['-P', '-czf', evil, '-C', path.join(d, 'a', 'b'), '../evil.txt'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const v = backup.verify(evil);
    assert.equal(v.ok, false);
    assert.ok(v.problems.some((p: string) => /traversal|outside the expected roots/.test(p)));
  });

  test('26/27. a real backup restores into an isolated directory with every hash, agent and skill intact', () => {
    const dest = tmpdir();
    const b = backup.create(dest);
    assert.ok(!path.resolve(b.dir).toLowerCase().startsWith(path.resolve(FORWARD_DIR, '..').toLowerCase() + path.sep));
    assert.throws(() => backup.create(path.join(FORWARD_DIR, 'tmp-backup')), /outside the repository/);
    const r = backup.restoreTest(b.archive, { build: false, test: false });
    temps.push(r.restore_dir);
    for (const c of r.checks) assert.ok(c.ok, `${c.id}: ${c.detail}`);
    // A tampered inventory hash of an archived file is detected (a pristine clone has no uncommitted file to archive;
    // the tracked-file tamper check below always runs).
    const inv = JSON.parse(fs.readFileSync(b.inventory, 'utf8'));
    if (inv.entries.length) {
      inv.entries[0].sha256 = '0'.repeat(64);
      fs.writeFileSync(b.inventory, JSON.stringify(inv));
      const r2 = backup.restoreTest(b.archive, { build: false, test: false });
      temps.push(r2.restore_dir);
      assert.equal(r2.checks.find((c: any) => c.id === 'hashes_match').ok, false);
    }
    // A tracked file recorded with a blob the commit does not hold is detected (incomplete or stale recovery set).
    const inv2 = JSON.parse(fs.readFileSync(b.inventory, 'utf8'));
    assert.ok(inv2.tracked_at_commit.entries.length > 0, 'the inventory lists the files recoverable from the commit');
    inv2.tracked_at_commit.entries[0].blob = '0'.repeat(40);
    fs.writeFileSync(b.inventory, JSON.stringify(inv2));
    const r3 = backup.restoreTest(b.archive, { build: false, test: false });
    temps.push(r3.restore_dir);
    assert.equal(r3.checks.find((c: any) => c.id === 'tracked_at_commit').ok, false);
    void execFileSync;
  });
});
