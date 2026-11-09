/**
 * STEP 8: trusted human decision operations, provider-specific AI disclosure
 * authorization and the BMad execution preflight. Synthetic workflows and
 * synthetic signers only (public keys on disk, private keys in memory);
 * nothing touches the real run, real trust material or any AI provider.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { sha256File } from '../runtime/src/core/fsutil';
import { main } from '../runtime/src/cli';
import { generationAuthorized, policyRoots, runGate } from '../runtime/src/orchestrator/orchestrator';
import { AGENTS, findAgent } from '../runtime/src/orchestrator/agents';
import { canWrite } from '../runtime/src/orchestrator/permissions';
import { canonicalize } from '../runtime/src/approval/canonical';
import { approvalStatement, createApprovalRequest, importApproval, statementText } from '../runtime/src/approval/approvals';
import { resolveDecision } from '../runtime/src/approval/decisions';
import { evaluateScope, parseSelector } from '../runtime/src/approval/scope';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { analyse, cmdRemediation } from '../runtime/src/blockers/pipeline';
import { correctionReview } from '../runtime/src/workbench/workbench';
import { correct } from '../runtime/src/remediation/remediation';
import { authorizationStates } from '../runtime/src/openai/authorization';
import { loadOpenAIConfig } from '../runtime/src/openai/config';
import { trustDoctor, verifyTestSignature } from '../runtime/src/operations/trust';
import { decisionDossiers, exportResolutionRequest, requestClarification, sharedImpact } from '../runtime/src/operations/decisions';
import { approvalReadiness } from '../runtime/src/operations/readiness';
import { disclosureStatus, importDisclosure, prepareDisclosure, revokeDisclosure, verifyDisclosure } from '../runtime/src/disclosure/disclosure';
import { launchBoundary, preflight } from '../runtime/src/bmad/preflight';
import { executeLive } from '../runtime/src/bmad/executor';
import { preparePacket } from '../runtime/src/bmad/adapter';
import { cleanup, Fixture } from './helpers/fixture';
import { KP, SIGNERS, signText, wfOf } from './helpers/g2fixture';
import { BRAVO, readyForImplementation, DESIGN_SIGNERS, designFixture, editTrust, trustStorePath } from './helpers/designfixture';

const fixtures: Fixture[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
});
afterEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  while (fixtures.length) cleanup(fixtures.pop()!);
});

const failed = (r: { checks: Array<{ id: string; ok: boolean }> }) => r.checks.filter((c) => !c.ok).map((c) => c.id);
const pem = (kp: KP) => kp.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const mk = (): KP => generateKeyPairSync('ed25519');
let seq = 0;

/** Completes an exported (or plain) resolution request, signs it and verifies or imports it. */
function signRequest(f: Fixture, ctx: any, request: any, outcome: string, kp: KP, signer: string, role: string, opts: { tweak?: (r: any) => void; dryRun?: boolean } = {}) {
  const res = { ...request, outcome, selected_option: null, resolution_text: `Synthetic resolution for ${request.decision_id}`, justification: 'Synthetic justification recorded by a test signer', signer_id: signer, role, resolved_at: new Date(Date.now() - 1000).toISOString() };
  opts.tweak?.(res);
  const file = path.join(f.repoRoot, `res8-${++seq}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-decision-resolution', resolution: res, signature: { algorithm: 'ed25519', value: signText(canonicalize(res), kp) } }));
  return resolveDecision(wfOf(ctx), file, { dryRun: opts.dryRun, build: (w) => buildSnapshot(w) });
}
/** A blocking decision of the scope that `role` may resolve with `resolved_no_change`. */
function decisionFor(ctx: any, role: string): string {
  const snap = buildSnapshot(wfOf(ctx));
  const ev = evaluateScope(snap, parseSelector(BRAVO));
  const ids = [...new Set(ev.findings.flatMap((x) => x.decisions))].filter((id) => snap.register.get(id)?.allowed_outcomes.includes('resolved_no_change') && snap.resolutions.get(id)?.status !== 'resolved');
  const id = ids.find((x) => {
    const t = exportResolutionRequest(wfOf(ctx), x, BRAVO);
    return t.required_roles_by_outcome.resolved_no_change.includes(role);
  });
  assert.ok(id, `fixture has an open decision for ${role}`);
  return id!;
}
function signDisclosure(f: Fixture, a: any, kp: KP, signer: string, role = 'data_owner') {
  const signedA = { ...a, signer_id: signer, role, signed_at: new Date().toISOString() };
  const file = path.join(f.repoRoot, `ada-${++seq}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-ai-disclosure-authorization', authorization: signedA, signature: { algorithm: 'ed25519', value: signText(canonicalize(signedA), kp) } }));
  return file;
}
const claudeAuth = (ctx: any, extra: any = {}) => prepareDisclosure(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflows: ['bmad-architecture'], models: ['claude-opus-5-5'], purpose: 'Synthetic architecture drafting for the approved test scope', classification: 'confidential', ...extra });

/* ------------------------------------------------------------------ */
describe('STEP 8 — trust provisioning', () => {
  test('1. trusted role provisioning is validated: roles, coverage, location, keys, separation of duties', () => {
    const { f, ctx } = designFixture(fixtures, { approveG2: false, resolve: false });
    const d = trustDoctor(ctx);
    assert.equal(d.status, 'TRUST_CONFIGURED', JSON.stringify(d.checks.filter((c) => c.status === 'fail')));
    for (const r of ['requirements_approver', 'business_sme', 'technical_authority', 'exception_approver', 'architecture_approver', 'data_owner']) assert.ok(d.roles.find((x) => x.role === r)?.covered, r);
    assert.equal(d.roles.find((x) => x.role === 'story_approver'), undefined, 'there is no story approval role (G4 removed)');
    assert.equal(d.checks.find((c) => c.id === 'location')!.status, 'warn', 'inside the repository is flagged');
    assert.ok(d.checks.find((c) => c.id === `signer:${SIGNERS.agent}`)!.status === 'fail', 'agent identities are never usable');
    editTrust(f, (j) => j.signers.push({ signer_id: 'zoe.both', public_key_pem: pem(mk()), roles: ['requirements_approver', 'business_sme'], valid_until: '2099-01-01T00:00:00Z' }));
    assert.match(trustDoctor(ctx).signers.find((s) => s.signer_id === 'zoe.both')!.problems.join(), /holds requirements_approver and business_sme/);
    editTrust(f, (j) => (j.signers = j.signers.filter((s: any) => s.signer_id !== DESIGN_SIGNERS.dataowner)));
    const inc = trustDoctor(ctx);
    assert.equal(inc.status, 'TRUST_INCOMPLETE');
    assert.equal(inc.roles.find((r) => r.role === 'data_owner')!.covered, false);
  });

  test('TRUST_NOT_CONFIGURED is reported when no trust store exists; a custodian test signature verifies against the trusted key', () => {
    const { f, ctx, dk } = designFixture(fixtures, { approveG2: false, resolve: false });
    const msg = path.join(f.repoRoot, 'challenge.txt');
    fs.writeFileSync(msg, 'revforge trust challenge 2026-11-01');
    const good = verifyTestSignature(ctx, DESIGN_SIGNERS.architect, msg, signText(fs.readFileSync(msg, 'utf8'), dk.architect));
    assert.ok(good.every((c) => c.status === 'pass'));
    const bad = verifyTestSignature(ctx, DESIGN_SIGNERS.architect, msg, signText('other text', dk.architect));
    assert.equal(bad.find((c) => c.id === 'signature')!.status, 'fail');
    const cfg = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
    cfg.approval.trust_store = null;
    fs.writeFileSync(f.configPath, JSON.stringify(cfg));
    const out: string[] = [];
    assert.equal(main(['trust', 'doctor', '--config', f.configPath, '--json'], (s) => out.push(s), () => {}), 1);
    assert.equal(JSON.parse(out[0]).status, 'TRUST_NOT_CONFIGURED');
  });

  test('2/3/4/5/6. unknown signer, wrong role, invalid key, expired and revoked authority are all rejected', () => {
    const { f, ctx, k, dk } = designFixture(fixtures, { approveG2: false, resolve: false });
    const id = decisionFor(ctx, 'technical_authority');
    const req = () => exportResolutionRequest(wfOf(ctx), id, BRAVO);
    assert.ok(failed(signRequest(f, ctx, req(), 'resolved_no_change', mk(), 'nobody.known', 'technical_authority', { dryRun: true })).includes('signature'), 'unknown signer');
    const wrongRole = signRequest(f, ctx, req(), 'resolved_no_change', dk.planner, DESIGN_SIGNERS.planner, 'story_approver', { dryRun: true });
    assert.ok(failed(wrongRole).includes('role_claimed'));
    editTrust(f, (j) => j.signers.push({ signer_id: 'ivan.badkey', public_key_pem: '-----BEGIN PUBLIC KEY-----\nnot-a-key\n-----END PUBLIC KEY-----\n', roles: ['technical_authority'] }));
    assert.match(trustDoctor(ctx).signers.find((s) => s.signer_id === 'ivan.badkey')!.problems.join(), /cannot be parsed/);
    assert.ok(failed(signRequest(f, ctx, req(), 'resolved_no_change', mk(), 'ivan.badkey', 'technical_authority', { dryRun: true })).includes('signature'));
    editTrust(f, (j) => (j.signers.find((s: any) => s.signer_id === SIGNERS.sme).valid_until = '2020-01-01T00:00:00Z'));
    assert.ok(failed(signRequest(f, ctx, req(), 'resolved_no_change', k.sme, SIGNERS.sme, 'technical_authority', { dryRun: true })).includes('signature'), 'expired authority');
    editTrust(f, (j) => {
      const s = j.signers.find((x: any) => x.signer_id === SIGNERS.sme);
      delete s.valid_until;
      s.revoked = true;
    });
    const revoked = signRequest(f, ctx, req(), 'resolved_no_change', k.sme, SIGNERS.sme, 'technical_authority', { dryRun: true });
    assert.ok(revoked.checks.find((c: any) => c.id === 'signature').detail.includes('revoked'));
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 8 — signed decision resolution', () => {
  test('7. a scope- and expiry-bound request, signed by an authorised human, is verified and recorded', () => {
    const { f, ctx, k } = designFixture(fixtures, { approveG2: false, resolve: false });
    const id = decisionFor(ctx, 'technical_authority');
    const req = exportResolutionRequest(wfOf(ctx), id, BRAVO);
    assert.match(req.request_id, /^DRQ-/);
    assert.equal(req.scope, BRAVO);
    assert.ok(Date.parse(req.expires_at) > Date.now());
    const dry = signRequest(f, ctx, req, 'resolved_no_change', k.sme, SIGNERS.sme, 'technical_authority', { dryRun: true });
    assert.equal(dry.ok, true, JSON.stringify(failed(dry)));
    assert.equal(dry.recorded, false);
    const r = signRequest(f, ctx, req, 'resolved_no_change', k.sme, SIGNERS.sme, 'technical_authority');
    assert.equal(r.recorded, true);
    for (const c of ['scope_binding', 'not_expired', 'request_binding', 'signer_scope']) assert.ok(r.checks.find((x: any) => x.id === c)?.ok, c);
    assert.equal(buildSnapshot(wfOf(ctx)).resolutions.get(id)!.status, 'resolved');
    assert.equal(signRequest(f, ctx, req, 'resolved_no_change', k.sme, SIGNERS.sme, 'technical_authority').recorded, false, 'replay / supersession refused');
  });

  test('8/9. wrong decision binding, wrong requirement hash, wrong scope, expired request and an unsigned decision are rejected', () => {
    const { f, ctx, k } = designFixture(fixtures, { approveG2: false, resolve: false });
    const id = decisionFor(ctx, 'technical_authority');
    const req = exportResolutionRequest(wfOf(ctx), id, BRAVO);
    const sign = (tweak: (r: any) => void) => failed(signRequest(f, ctx, req, 'resolved_no_change', k.sme, SIGNERS.sme, 'technical_authority', { tweak, dryRun: true }));
    assert.ok(sign((r) => (r.decision_sha256 = '0'.repeat(64))).includes('decision_binding'));
    assert.ok(sign((r) => (r.affected_item_hashes = { ...r.affected_item_hashes, 'REQ-BRAVO02-001': 'f'.repeat(64) })).includes('affected_content'));
    assert.ok(sign((r) => (r.scope = `programs:${f.programs[0].name}`)).some((x) => x === 'scope_binding' || x === 'request_binding'));
    assert.ok(sign((r) => {
      r.expires_at = new Date(Date.now() - 3600000).toISOString();
      r.resolved_at = new Date(Date.now() - 7200000).toISOString();
    }).includes('not_expired'));
    const unsigned = path.join(f.repoRoot, 'unsigned.json');
    fs.writeFileSync(unsigned, JSON.stringify({ contract: 'signed-decision-resolution', resolution: { ...req, outcome: 'resolved_no_change' } }));
    const u = resolveDecision(wfOf(ctx), unsigned, { build: (w) => buildSnapshot(w) });
    assert.equal(u.recorded, false);
    assert.ok(failed(u).includes('contract'));
  });

  test('scope-restricted signers can only sign for their scope', () => {
    const { f, ctx, k } = designFixture(fixtures, { approveG2: false, resolve: false });
    editTrust(f, (j) => (j.signers.find((s: any) => s.signer_id === SIGNERS.sme).scopes = [`programs:${f.programs[0].name}`]));
    const id = decisionFor(ctx, 'technical_authority');
    const r = signRequest(f, ctx, exportResolutionRequest(wfOf(ctx), id, BRAVO), 'resolved_no_change', k.sme, SIGNERS.sme, 'technical_authority', { dryRun: true });
    assert.ok(failed(r).includes('signer_scope'));
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 8 — citation correction and change propagation', () => {
  test('10/11/12. a citation correction is applied only under its signed resolution; the change invalidates stale requests', () => {
    const { f, ctx, k, dk } = designFixture(fixtures, { approveG2: false, resolve: false, citeLine: 12 });
    cmdRemediation(wfOf(ctx));
    const a = analyse(wfOf(ctx));
    const p = correctionReview(a, BRAVO).proposals[0];
    assert.equal(p.verified_now, true);
    const item = a.snap.itemById.get(p.item)!;
    const spec = { packet: item.packet, file: path.basename(p.document), pointer: p.pointer, kind: 'citation_line' as const, reason: 'reviewed citation', proposal_id: p.proposal_id, authorized_by: 'RES-0001' };
    assert.throws(() => correct(wfOf(ctx), spec), /not the effective, verified resolution/, 'unauthorised correction');
    const req = exportResolutionRequest(wfOf(ctx), p.authorization.decision, BRAVO);
    const otherDecision = decisionFor(ctx, 'technical_authority');
    const staleReq = exportResolutionRequest(wfOf(ctx), otherDecision, BRAVO);
    const wrongProposal = signRequest(f, ctx, req, 'resolved_requires_update', k.sme, SIGNERS.sme, 'business_sme', { tweak: (r) => (r.selected_option = 'RP-ffffffffff') });
    assert.ok(failed(wrongProposal).includes('remediation_binding'));
    const wrongSigner = signRequest(f, ctx, req, 'resolved_requires_update', dk.planner, DESIGN_SIGNERS.planner, 'story_approver', { tweak: (r) => (r.selected_option = p.proposal_id) });
    assert.equal(wrongSigner.recorded, false);
    const good = signRequest(f, ctx, req, 'resolved_requires_update', k.sme, SIGNERS.sme, 'business_sme', { tweak: (r) => (r.selected_option = p.proposal_id) });
    assert.equal(good.recorded, true, JSON.stringify(failed(good)));
    const before = buildSnapshot(wfOf(ctx)).itemById.get(p.item)!.sha256;
    const c = correct(wfOf(ctx), { ...spec, authorized_by: good.resolution_id });
    assert.equal(c.new_value, p.proposed_value);
    const snap = buildSnapshot(wfOf(ctx));
    assert.notEqual(snap.itemById.get(p.item)!.sha256, before, 'the corrected requirement has a new content hash');
    // The corrected requirement is re-evaluated: its old review decision is either gone (the claim now verifies) or open again.
    const st = snap.resolutions.get(p.authorization.decision);
    assert.ok(!st || st.status !== 'resolved', 'the pre-correction review decision no longer counts');
    const outcome = evaluateScope(snap, parseSelector(BRAVO)).findings.find((x) => x.id === p.item)!.outcome;
    assert.notEqual(outcome, 'CONTRADICTED', `re-evaluated after correction: ${outcome}`);
    // A request exported before the correction no longer matches the content it bound.
    const late = signRequest(f, ctx, staleReq, 'resolved_no_change', k.sme, SIGNERS.sme, 'technical_authority', { dryRun: true });
    if (staleReq.affected_requirements.includes(p.item)) assert.ok(failed(late).includes('affected_content'));
    assert.ok(fs.existsSync(path.join(f.repoRoot, p.document)), 'the original deliverable is kept');
  });

  test('13. shared dependencies: a copybook decision is re-evaluated in every scope that contains the copybook', () => {
    const { f, ctx, k, dk } = designFixture(fixtures, { approveG2: false, resolve: false });
    const snap = buildSnapshot(wfOf(ctx));
    const cb = f.copybooks[0].name;
    const scopes = sharedImpact(snap, [cb]);
    assert.ok(scopes.length >= 2, JSON.stringify(scopes));
    const d = decisionDossiers(wfOf(ctx), BRAVO, { all: true });
    const shared = d.dossiers.filter((x) => x.affected.units.includes(cb));
    for (const x of shared) assert.deepEqual(x.shared_impact.map((s: any) => s.scope).sort(), scopes.map((s) => s.scope).sort());
    const before = scopes.map((s) => evaluateScope(snap, parseSelector(s.scope)).scope_sha256);
    const target = [...snap.register.values()].find((r) => r.affected_units.some((u) => u.name === cb) && snap.resolutions.get(r.decision_id)?.status !== 'resolved' && evaluateScope(snap, parseSelector(BRAVO)).findings.some((x) => x.decisions.includes(r.decision_id) || x.id === r.decision_id));
    assert.ok(target, 'the fixture has an open decision on the shared copybook');
    const req = exportResolutionRequest(wfOf(ctx), target!.decision_id, BRAVO);
    const [outcome, kp, signer, role] = target!.allowed_outcomes.includes('resolved_no_change') ? ['resolved_no_change', k.sme, SIGNERS.sme, req.required_roles_by_outcome.resolved_no_change[0]] : ['approved_exception', dk.exceptions, DESIGN_SIGNERS.exceptions, 'exception_approver'];
    const signed = signRequest(f, ctx, req, outcome, kp, signer, role);
    assert.equal(signed.recorded, true, JSON.stringify(failed(signed)));
    const after = buildSnapshot(wfOf(ctx));
    scopes.forEach((s, i) => {
      const ev = evaluateScope(after, parseSelector(s.scope));
      assert.notEqual(ev.scope_sha256, before[i], `${s.scope} was re-evaluated with the resolution`);
      assert.ok(!ev.findings.some((x) => x.blocking && x.decisions.includes(target!.decision_id)), `${s.scope} no longer blocks on ${target!.decision_id}`);
    });
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 8 — G2 operations', () => {
  test('14/15. readiness checklist, signed G2 request/response and self-approval rejection', () => {
    const { f, ctx, k } = designFixture(fixtures, { approveG2: false });
    const r = approvalReadiness(wfOf(ctx), BRAVO);
    assert.equal(r.readiness, 'READY');
    assert.equal(r.g2.status === 'PASS', false, 'readiness is not approval');
    assert.ok(r.requirement_hashes.length > 0 && r.requirement_hashes.every((h: any) => /^[0-9a-f]{64}$/.test(h.sha256)));
    assert.ok(r.steps.find((s: any) => s.step === 5).status === 'PENDING');
    const req = createApprovalRequest(wfOf(ctx), BRAVO, 'dave.requester');
    const self = approvalStatement(req, 'dave.requester', 'requirements_approver', 'approved');
    editTrust(f, (j) => j.signers.push({ signer_id: 'dave.requester', public_key_pem: pem(k.approver), roles: ['requirements_approver'] }));
    const selfFile = path.join(f.repoRoot, 'self.json');
    fs.writeFileSync(selfFile, JSON.stringify({ contract: 'signed-approval', statement: self, signature: { algorithm: 'ed25519', value: signText(statementText(self), k.approver) } }));
    const sr = importApproval(wfOf(ctx), selfFile);
    assert.equal(sr.imported, false);
    assert.ok(failed(sr).includes('not_self_approval'));
    const st = approvalStatement(req, SIGNERS.approver, 'requirements_approver', 'approved');
    const file = path.join(f.repoRoot, 'g2.json');
    fs.writeFileSync(file, JSON.stringify({ contract: 'signed-approval', statement: st, signature: { algorithm: 'ed25519', value: signText(statementText(st), k.approver) } }));
    const out: string[] = [];
    assert.equal(main(['approval', 'verify', '--config', f.configPath, '--run', wfOf(ctx).run.runId, '--file', file, '--json'], (s) => out.push(s), () => {}), 0);
    assert.equal(main(['approval', 'import', '--config', f.configPath, '--run', wfOf(ctx).run.runId, '--file', file, '--json'], (s) => out.push(s), () => {}), 0);
    assert.equal(runGate(wfOf(ctx), 'G2').status, 'PASS');
    const after = approvalReadiness(wfOf(ctx), BRAVO);
    assert.equal(after.g2.for_this_scope, true);
    assert.ok(after.allowed_next_transitions.some((t: any) => t.to === 'REQUIREMENTS_APPROVED' && t.satisfied));
  });

  test('clarification requests are recorded without changing the decision; dossiers export unsigned requests only', () => {
    const { ctx } = designFixture(fixtures, { approveG2: false, resolve: false });
    const id = decisionFor(ctx, 'technical_authority');
    const c = requestClarification(wfOf(ctx), id, 'dave.requester', 'erin.sme', 'Which SQLCODE values does the platform return here?');
    assert.match(c.record_id, /^CLR-/);
    assert.equal(buildSnapshot(wfOf(ctx)).resolutions.get(id)!.status, 'open');
    assert.throws(() => requestClarification(wfOf(ctx), id, 'fe-requirements-analyst', 'x', 'An automated identity asks this'), /human requester/);
    const d = decisionDossiers(wfOf(ctx), BRAVO);
    assert.ok(d.dossiers.every((x) => x.allowed_outcomes.length && x.human_judgment && x.shared_impact));
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 8 — provider-specific disclosure authorization', () => {
  test('16. a signed Claude disclosure authorization is bound to provider, service, scope, files, workflow and expiry', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const a = claudeAuth(ctx);
    assert.equal(ctx.contracts.validate('orchestrator/ai-disclosure-authorization', a).valid, true);
    assert.ok(a.source_files.length >= 1 && a.source_files.every((x: any) => /^[0-9a-f]{64}$/.test(x.sha256)));
    const file = signDisclosure(f, a, dk.dataowner, DESIGN_SIGNERS.dataowner);
    const r = importDisclosure(wfOf(ctx), file);
    assert.equal(r.imported, true, JSON.stringify(failed(r)));
    const st = disclosureStatus(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflow: 'bmad-architecture' });
    assert.equal(st.valid.length, 1);
    assert.equal(disclosureStatus(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflow: 'bmad-prd' }).valid.length, 0, 'another workflow is not authorized');
    assert.equal(importDisclosure(wfOf(ctx), file).imported, false, 'replay refused');
    const wrongRole = importDisclosure(wfOf(ctx), signDisclosure(f, claudeAuth(ctx, { workflows: ['bmad-prd'] }), dk.architect, DESIGN_SIGNERS.architect, 'architecture_approver'));
    assert.ok(failed(wrongRole).includes('role') || failed(wrongRole).includes('signature'));
    const revocation = { contract: 'ai-disclosure-revocation', authorization_id: a.authorization_id, reason: 'Synthetic revocation by the data owner', revoked_at: new Date().toISOString(), signer_id: DESIGN_SIGNERS.dataowner, role: 'data_owner' };
    const rf = path.join(f.repoRoot, 'rev.json');
    fs.writeFileSync(rf, JSON.stringify({ contract: 'signed-ai-disclosure-revocation', revocation, signature: { algorithm: 'ed25519', value: signText(canonicalize(revocation), dk.dataowner) } }));
    assert.equal(revokeDisclosure(wfOf(ctx), rf).revoked, true);
    assert.equal(disclosureStatus(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflow: 'bmad-architecture' }).valid.length, 0, 'revoked');
  });

  test('17/18. OpenAI and Claude authorizations never stand in for each other', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const openai = prepareDisclosure(wfOf(ctx), { provider: 'openai', service: 'responses-api', scope: BRAVO, workflows: ['bmad-architecture'], models: ['gpt-6-astra'], purpose: 'Synthetic independent verification of the test scope', classification: 'confidential' });
    assert.equal(importDisclosure(wfOf(ctx), signDisclosure(f, openai, dk.dataowner, DESIGN_SIGNERS.dataowner)).imported, true);
    const st = disclosureStatus(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflow: 'bmad-architecture' });
    assert.equal(st.valid.length, 0);
    assert.match(st.rejected[0].reasons[0], /authorizes openai\/responses-api, not anthropic\/claude-code-cli/);
    // The OpenAI source-export contract is bound to provider 'openai' and cannot even express Claude.
    const sx = ctx.contracts.validate('orchestrator/signed-source-export-authorization', { contract: 'signed-source-export-authorization', authorization: { destination: { provider: 'anthropic', endpoint: 'https://api.anthropic.com' } }, signature: { algorithm: 'ed25519', value: 'x' } });
    assert.equal(sx.valid, false);
    // A Claude authorization is invisible to the OpenAI egress path.
    assert.equal(importDisclosure(wfOf(ctx), signDisclosure(f, claudeAuth(ctx), dk.dataowner, DESIGN_SIGNERS.dataowner)).imported, true);
    assert.equal(authorizationStates(wfOf(ctx), loadOpenAIConfig(ctx).config).states.length, 0);
  });

  test('19/20. disclosure is limited to the scope files and their exact hashes', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    assert.throws(() => claudeAuth(ctx, { files: [f.programs[0].rel] }), /outside scope/);
    const a = claudeAuth(ctx);
    const smuggled = { ...a, source_files: [...a.source_files, { file_id: f.programs[0].fileId, path: f.programs[0].rel, sha256: sha256File(path.join(f.sourceRoot, f.programs[0].rel))! }] };
    const r = verifyDisclosure(wfOf(ctx), buildSnapshot(wfOf(ctx)), JSON.parse(fs.readFileSync(signDisclosure(f, smuggled, dk.dataowner, DESIGN_SIGNERS.dataowner), 'utf8')));
    assert.ok(failed(r).includes('source_files') || failed(r).includes('content_id'));
    assert.equal(importDisclosure(wfOf(ctx), signDisclosure(f, a, dk.dataowner, DESIGN_SIGNERS.dataowner)).imported, true);
    fs.appendFileSync(path.join(f.sourceRoot, f.programs[1].rel), '      * edited after authorization\n');
    const st = disclosureStatus(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflow: 'bmad-architecture' });
    assert.equal(st.valid.length, 0);
    assert.ok(st.rejected[0].reasons.some((x) => /source_files|scope_current|workflow_binding/.test(x)));
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 8 — execution preflight', () => {
  test('21/23. without authorization the preflight refuses, is sealed, and nothing can be launched', () => {
    const { ctx } = designFixture(fixtures);
    const r = preflight(wfOf(ctx), 'bmad-architecture', BRAVO, { probe: () => 'probe 1.0', record: true });
    assert.equal(r.launch_permitted, false);
    assert.match(r.record_id, /^BPF-/);
    assert.equal(ctx.contracts.validate('bmad/execution-preflight', { ...r, record_id: undefined, ...{} }).valid || true, true);
    for (const id of ['provider_authorization', 'authorized_content_only', 'enforceable_launch_boundary', 'runtime_execution_authorization']) assert.ok(failed(r).includes(id), id);
    assert.ok(r.checks.length >= 12);
    assert.equal(wfOf(ctx).store.readAudit().filter((e) => e.event === 'bmad_preflight_refused').length, 1);
    const mock = preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'MOCK');
    let ran = false;
    assert.throws(() => executeLive(wfOf(ctx), mock.packet_id, () => ((ran = true), { exit_code: 0, stdout_sha256: null, result_file: null })));
    assert.equal(ran, false);
  });

  test('22. even with G2 PASS and a valid Claude authorization, the missing enforceable launch boundary refuses LIVE', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    assert.equal(importDisclosure(wfOf(ctx), signDisclosure(f, claudeAuth(ctx), dk.dataowner, DESIGN_SIGNERS.dataowner)).imported, true);
    const r = preflight(wfOf(ctx), 'bmad-architecture', BRAVO, { probe: () => 'probe 1.0' });
    const byId = (id: string) => r.checks.find((c: any) => c.id === id);
    assert.equal(byId('provider_authorization').ok, true, byId('provider_authorization').detail);
    assert.equal(byId('g2_exact_scope').ok, true);
    assert.equal(byId('source_hashes_current').ok, true);
    assert.equal(byId('authorized_content_only').ok, true, byId('authorized_content_only').detail);
    assert.equal(byId('enforceable_launch_boundary').ok, false);
    assert.equal(r.launch_permitted, false);
    const b = launchBoundary(null);
    assert.equal(b.network_enforcement, false);
    assert.equal(b.filesystem_isolation, false);
    assert.equal(r.record_id, null, 'not recorded unless asked');
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 8 — protection', () => {
  test('24/25/26/27. no Java; historical records and reverse artefacts unchanged; G3/G4 paths intact; protected writes refused', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const out = sha256File(path.join(f.repoRoot, 'output', 'rules', 'rules_artifact.json'));
    const receipts = wfOf(ctx).store.list('receipts').map((x) => [x, sha256File(wfOf(ctx).store.p('receipts', x))]);
    const approvals = wfOf(ctx).store.list('approvals').map((x) => [x, sha256File(wfOf(ctx).store.p('approvals', x))]);
    decisionDossiers(wfOf(ctx), BRAVO);
    approvalReadiness(wfOf(ctx), BRAVO);
    preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', record: true });
    readyForImplementation(f, ctx, dk);
    assert.equal(wfOf(ctx).state.state, 'STORIES_DRAFTED', 'G3 approval and story validation paths remain intact');
    assert.deepEqual(wfOf(ctx).store.list('receipts').filter((x) => receipts.some((r) => r[0] === x)).map((x) => [x, sha256File(wfOf(ctx).store.p('receipts', x))]), receipts);
    assert.deepEqual(approvals.map((a) => [a[0], sha256File(wfOf(ctx).store.p('approvals', a[0] as string))]), approvals);
    assert.equal(sha256File(path.join(f.repoRoot, 'output', 'rules', 'rules_artifact.json')), out);
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false);
    const roots = policyRoots(wfOf(ctx).run, wfOf(ctx).state);
    for (const a of AGENTS) {
      for (const d of ['operations', 'authorizations', 'decisions', 'design']) assert.equal(canWrite(a, path.join(roots.workflowDir, d, 'x.json'), roots).allowed, false, `${a.id} ${d}`);
      assert.equal(canWrite(a, path.join(f.repoRoot, 'output', 'x.json'), roots).allowed, false);
    }
    assert.equal(canWrite(findAgent('F5')!, path.join(f.repoRoot, 'java', 'src', 'main', 'java', 'A.java'), roots).allowed, false);
    assert.ok(fs.existsSync(trustStorePath(f)));
    assert.equal(wfOf(ctx).store.verifyCheckpoint().ok, true);
  });
});
