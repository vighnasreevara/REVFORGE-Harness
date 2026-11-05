/**
 * STEP 21 tests: mandatory BMad governance. Every negative condition (missing
 * installation, disclosure authorization, trusted signer, G2, enabled
 * workflow, runner, provider connectivity; failed execution; missing or
 * invalid receipt) keeps the governed run BMAD_BLOCKED without any fallback.
 * The positive case uses an explicit test double: it proves the counting rule
 * only and is never LIVE BMad execution. Synthetic fixtures and synthetic keys
 * only; the real run is read only.
 */
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { generationAuthorized } from '../runtime/src/orchestrator/orchestrator';
import { canonicalize } from '../runtime/src/approval/canonical';
import { importDisclosure, prepareDisclosure } from '../runtime/src/disclosure/disclosure';
import { mockResult, preparePacket } from '../runtime/src/bmad/adapter';
import { liveGate } from '../runtime/src/bmad/eligibility';
import { disabledReason, handleExecutionOutcome } from '../runtime/src/bmad/executor';
import { preflight } from '../runtime/src/bmad/preflight';
import { bmadGenerationReady, GOVERNED_STAGES, governanceVerdict, governedRun, localConversionGovernance, receiptCounts } from '../runtime/src/bmad/governance';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { KP, signText, wfOf } from './helpers/g2fixture';
import { BRAVO, DESIGN_SIGNERS, designFixture } from './helpers/designfixture';

const fixtures: Fixture[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
});
afterEach(() => {
  while (fixtures.length) cleanup(fixtures.pop()!);
});

const testedIso = { tested: true, report: { executed_at: new Date().toISOString(), sandbox_sha256: 'a'.repeat(64) } as any, problems: [] };
const hostWithoutRunner: any = { primitives: { linux_claude: { available: false }, linux_node: { available: false } } };
const neverRun = () => {
  throw new Error('the runner must not be called');
};

function signedDisclosure(f: Fixture, a: any, kp: KP, signer: string, role = 'data_owner') {
  const s = { ...a, signer_id: signer, role, signed_at: new Date().toISOString() };
  const file = path.join(f.repoRoot, `ada21-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-ai-disclosure-authorization', authorization: s, signature: { algorithm: 'ed25519', value: signText(canonicalize(s), kp) } }));
  return file;
}
const claudeRequest = (ctx: any, workflows = ['bmad-prd']) =>
  prepareDisclosure(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflows, models: ['claude-opus-5-5'], purpose: 'Synthetic requirements drafting for the test scope', classification: 'confidential' });

describe('STEP 21 - mandatory BMad governance: blocked conditions', () => {
  test('the shipped configuration makes BMad mandatory; generation stays unauthorised without verified LIVE receipts', () => {
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    assert.equal((ctx.config as any).bmad_governance.mandatory, true);
    const { ctx: fx } = designFixture(fixtures);
    assert.equal(bmadGenerationReady(wfOf(fx)).ok, false);
    assert.match(bmadGenerationReady(wfOf(fx)).detail, /BMAD_BLOCKED|no BMad-governed run/);
    assert.equal(generationAuthorized(wfOf(fx).run, wfOf(fx).state), false);
    assert.match(localConversionGovernance(ctx), /^LOCAL_LGA_NOT_BMAD_GOVERNED/, 'local conversions are never labelled BMad-governed');
  });

  test('missing G2 approval: the governed run stops at requirements, records BMAD_BLOCKED and runs nothing in its place', () => {
    const { ctx } = designFixture(fixtures, { approveG2: false });
    const r = governedRun(wfOf(ctx), BRAVO, { runner: neverRun as any, probe: () => 'probe 1.0', isolation: testedIso, assessment: hostWithoutRunner });
    assert.equal(r.status, 'BMAD_BLOCKED');
    assert.equal(ctx.contracts.validate('bmad/governed-run', r).valid, true);
    assert.equal(r.fallback, 'none');
    assert.equal(r.local_conversion_invoked, false);
    assert.equal(r.stages[0].status, 'BLOCKED');
    assert.ok(r.stages[0].blockers.some((b: string) => /g2/i.test(b)));
    assert.ok(r.stages[0].preflight_id, 'the refusal is a sealed preflight');
    assert.deepEqual(r.stages.slice(1).map((s: any) => s.status), Array(GOVERNED_STAGES.length - 1).fill('NOT_ATTEMPTED'));
    assert.ok(wfOf(ctx).store.readAudit().some((e) => e.event === 'bmad_governed_run'));
  });

  test('missing source-sharing authorization blocks the launch even with G2 PASS', () => {
    const { ctx } = designFixture(fixtures);
    const r = governedRun(wfOf(ctx), BRAVO, { runner: neverRun as any, probe: () => 'probe 1.0', isolation: testedIso, assessment: hostWithoutRunner });
    assert.equal(r.status, 'BMAD_BLOCKED');
    assert.ok(r.stages[0].blockers.some((b: string) => /disclosure authorization/.test(b)));
    assert.equal(r.stages[0].authorization_id, null);
  });

  test('an untrusted signer or a wrong signer role never authorises disclosure', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const stranger = generateKeyPairSync('ed25519') as unknown as KP;
    assert.equal(importDisclosure(wfOf(ctx), signedDisclosure(f, claudeRequest(ctx), stranger, 'mallory.unknown')).imported, false, 'untrusted signer');
    assert.equal(importDisclosure(wfOf(ctx), signedDisclosure(f, claudeRequest(ctx), dk.architect, DESIGN_SIGNERS.architect, 'architecture_approver')).imported, false, 'wrong role');
    const pf = preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, assessment: hostWithoutRunner });
    assert.equal(pf.checks.find((c: any) => c.id === 'provider_authorization').ok, false);
  });

  test('missing Claude Code runtime and provider connectivity keep the launch refused with a valid authorization', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    assert.equal(importDisclosure(wfOf(ctx), signedDisclosure(f, claudeRequest(ctx), dk.dataowner, DESIGN_SIGNERS.dataowner)).imported, true);
    const r = governedRun(wfOf(ctx), BRAVO, { runner: neverRun as any, probe: () => 'probe 1.0', isolation: testedIso, assessment: hostWithoutRunner });
    assert.equal(r.status, 'BMAD_BLOCKED');
    const pf = wfOf(ctx).store.readRecord('bmad', `${r.stages[0].preflight_id}.json`);
    assert.equal(pf.checks.find((c: any) => c.id === 'provider_authorization').ok, true);
    assert.equal(pf.checks.find((c: any) => c.id === 'runner_inside_boundary').ok, false, 'missing Claude Code runtime');
    assert.equal(pf.checks.find((c: any) => c.id === 'network_isolation').ok, false, 'no verified provider route');
  });

  test('missing BMad installation (no executor tools) is a blocker', () => {
    const { ctx } = designFixture(fixtures);
    const pf = preflight(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => null, isolation: testedIso, assessment: hostWithoutRunner });
    assert.equal(pf.launch_permitted, false);
    assert.ok(pf.refusal_reasons.some((x: string) => /executor|installation|claude/i.test(x)));
  });

  test('a disabled workflow (Build without authorised generation) is a blocker', () => {
    const { ctx } = designFixture(fixtures);
    assert.match(disabledReason(ctx, 'BMAD-BUILD')!, /java_generation_allowed is false/);
    assert.equal(disabledReason(ctx, 'BMAD-PRD'), null);
    const pf = preflight(wfOf(ctx), 'bmad-build', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, assessment: hostWithoutRunner });
    assert.equal(pf.checks.find((c: any) => c.id === 'binding_and_agent').ok, false);
  });

  test('without a LIVE runner a permitted stage is still blocked (no runner on this host is never silently replaced)', () => {
    const { ctx } = designFixture(fixtures);
    const r = governedRun(wfOf(ctx), BRAVO, { runner: null, probe: () => 'probe 1.0', isolation: testedIso, assessment: hostWithoutRunner });
    assert.equal(r.status, 'BMAD_BLOCKED');
    assert.equal(r.local_conversion_invoked, false);
  });
});

describe('STEP 21 - receipts: execution failure, invalid and MOCK receipts never count', () => {
  test('a failed execution is a BEX record and the stage stays unverified', () => {
    const { ctx } = designFixture(fixtures);
    const p = preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'MOCK');
    const out = handleExecutionOutcome(wfOf(ctx), p.packet_id, { exit_code: 1, stdout_sha256: null, result_file: null, error: 'synthetic workflow failure' });
    assert.equal(out.status, 'failed');
    const v = governanceVerdict(wfOf(ctx), BRAVO);
    assert.equal(v.status, 'BMAD_BLOCKED');
    assert.equal(v.stages[0].status, 'NOT_ATTEMPTED');
  });

  test('a rejected (forged) receipt and an accepted MOCK receipt are both not BMad execution evidence', () => {
    const { ctx } = designFixture(fixtures);
    const p = preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'MOCK');
    const m = mockResult(wfOf(ctx), p.packet_id);
    const file = path.resolve(ctx.repoRoot, m.result_file);
    const forged = JSON.parse(fs.readFileSync(file, 'utf8'));
    forged.documents[0].sha256 = createHash('sha256').update('never written').digest('hex');
    fs.writeFileSync(file, JSON.stringify(forged, null, 2));
    const fake = handleExecutionOutcome(wfOf(ctx), p.packet_id, { exit_code: 0, stdout_sha256: null, result_file: file });
    assert.equal(fake.status, 'completed_rejected');
    const p2 = preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'MOCK');
    const m2 = mockResult(wfOf(ctx), p2.packet_id);
    const mock = handleExecutionOutcome(wfOf(ctx), p2.packet_id, { exit_code: 0, stdout_sha256: null, result_file: path.resolve(ctx.repoRoot, m2.result_file) });
    assert.equal(mock.status, 'completed_validated', 'the MOCK result itself is valid');
    assert.equal(mock.receipt.evidence_status, 'MOCK_NOT_EVIDENCE');
    const v = governanceVerdict(wfOf(ctx), BRAVO);
    assert.equal(v.stages[0].status, 'EXECUTED_REJECTED');
    assert.ok(v.stages[0].reasons.some((r: string) => /MOCK_NOT_EVIDENCE/.test(r)));
    assert.ok(v.stages[0].reasons.some((r: string) => /rejected/.test(r)));
    assert.equal(v.status, 'BMAD_BLOCKED');
  });

  test('test double (NOT live execution): only an accepted, sealed, intact LIVE receipt for the current scope digest counts', () => {
    const base = { receipt_id: 'BRC-TEST', binding_id: 'BMAD-PRD', mode: 'LIVE', accepted: true, intact: true, evidence_status: 'DRAFT_PENDING_HUMAN_APPROVAL', scope: BRAVO, scope_sha256: 'd'.repeat(64), documents_intact: true };
    assert.equal(receiptCounts(base, 'BMAD-PRD', BRAVO, 'd'.repeat(64)).ok, true);
    assert.equal(receiptCounts({ ...base, mode: 'MOCK', evidence_status: 'MOCK_NOT_EVIDENCE' }, 'BMAD-PRD', BRAVO, 'd'.repeat(64)).ok, false);
    assert.equal(receiptCounts({ ...base, accepted: false, evidence_status: 'REJECTED' }, 'BMAD-PRD', BRAVO, 'd'.repeat(64)).ok, false);
    assert.equal(receiptCounts({ ...base, intact: false }, 'BMAD-PRD', BRAVO, 'd'.repeat(64)).ok, false);
    assert.equal(receiptCounts({ ...base, documents_intact: false }, 'BMAD-PRD', BRAVO, 'd'.repeat(64)).ok, false);
    assert.equal(receiptCounts(base, 'BMAD-PRD', BRAVO, 'e'.repeat(64)).ok, false, 'stale scope digest');
    assert.equal(receiptCounts(base, 'BMAD-ARCH', BRAVO, 'd'.repeat(64)).ok, false, 'wrong stage');
  });

  test('the LIVE gate refuses without executor and preflight facts and clears only when every fact holds', () => {
    assert.ok(liveGate(true, true).length >= 3);
    assert.ok(liveGate(true, true, { installation_verified: true, authorization_id: 'ADA-x', launch_permitted: false }).some((r) => /preflight/.test(r)));
    assert.ok(liveGate(true, false, { installation_verified: true, authorization_id: 'ADA-x', launch_permitted: true }).some((r) => /requested is false/.test(r)));
    assert.deepEqual(liveGate(true, true, { installation_verified: true, authorization_id: 'ADA-x', launch_permitted: true }), []);
  });

  test('a LIVE packet is still refused in the synthetic environment: the preflight is the launch authority', () => {
    const { ctx } = designFixture(fixtures);
    assert.throws(() => preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'LIVE'), (e: any) => e.code === 'BMAD_LIVE_NOT_AUTHORIZED' && e.details.some((d: string) => /preflight .*did not permit/.test(d)));
  });
});
