/**
 * STEP 7: scope reconciliation, G3 / G4 approval gates, dependency-aware
 * approval invalidation and the isolated BMad executor. Synthetic workflows,
 * synthetic signers (public keys only on disk) and temporary copies of the
 * BMad integration directory; nothing touches the real run, the repository
 * .claude/ directory or reverse artifacts.
 */
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { main } from '../runtime/src/cli';
import { advance, generationAuthorized, policyRoots, runGate } from '../runtime/src/orchestrator/orchestrator';
import { AGENTS, findAgent } from '../runtime/src/orchestrator/agents';
import { GATES } from '../runtime/src/orchestrator/gates';
import { canWrite } from '../runtime/src/orchestrator/permissions';
import { evaluateScope, parseSelector } from '../runtime/src/approval/scope';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { reconcileScope } from '../runtime/src/bmad/reconcile';
import { buildMapping } from '../runtime/src/bmad/mapping';
import { loadBindings } from '../runtime/src/bmad/bindings';
import { BMAD_DIR_ENV } from '../runtime/src/bmad/release';
import { preparePacket, mockResult } from '../runtime/src/bmad/adapter';
import { executeLive, executionManifest, executorDoctor, executorEligibility, handleExecutionOutcome } from '../runtime/src/bmad/executor';
import { createDesignRequest, designApprovals, evaluateDesignGate, invalidations } from '../runtime/src/design/approvals';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { signResolution, SIGNERS, wfOf } from './helpers/g2fixture';
import { approveArchitecture, approveStories, BRAVO, deliverArchitecture, deliverStories, DESIGN_SIGNERS, designFixture, editTrust, signDesign } from './helpers/designfixture';

const fixtures: Fixture[] = [];
const temps: string[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
  delete process.env[BMAD_DIR_ENV];
});
afterEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env[BMAD_DIR_ENV];
  while (fixtures.length) cleanup(fixtures.pop()!);
  while (temps.length) fs.rmSync(temps.pop()!, { recursive: true, force: true });
});

const REAL_BMAD = path.join(FORWARD_DIR, 'integrations', 'bmad');
const failed = (r: { checks: Array<{ id: string; ok: boolean }> }) => r.checks.filter((c) => !c.ok).map((c) => c.id);
const gateFails = (r: any) => r.result.checks.filter((c: any) => c.status === 'fail').map((c: any) => c.id);
function hashTree(dir: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const walk = (d: string) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = sha256File(p);
    }
  };
  walk(dir);
  return out;
}
/** A temporary BMad integration directory: the pinned release and bindings, plus an optional fake executor. */
function tempIntegration(opts: { executor?: 'copy' | 'none' } = {}): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad7-'));
  temps.push(dir);
  for (const n of ['release.pin.json', 'workflow-registry.json', 'bindings.json', 'mapping.json']) fs.copyFileSync(path.join(REAL_BMAD, n), path.join(dir, n));
  fs.cpSync(path.join(REAL_BMAD, 'staging'), path.join(dir, 'staging'), { recursive: true });
  if (opts.executor === 'copy') fs.cpSync(path.join(REAL_BMAD, 'staging', 'bmad-method-6.12.4', 'package'), path.join(dir, 'executor', 'bmad-method-6.12.4'), { recursive: true });
  process.env[BMAD_DIR_ENV] = dir;
  return dir;
}

/* ------------------------------------------------------------------ */
describe('STEP 7 — scope reconciliation', () => {
  test('1. scope expansion is explained: every item has an inclusion class and reason; runtime requirements are separate', () => {
    const { ctx } = designFixture(fixtures, { approveG2: false });
    const snap = buildSnapshot(wfOf(ctx));
    const r = reconcileScope(snap, BRAVO);
    assert.equal(ctx.contracts.validate('bmad/scope-reconciliation', r).valid, true);
    assert.ok(r.units.some((u) => u.relation === 'primary' && u.name === 'BRAVO02'));
    for (const x of [...r.requirements, ...r.runtime_requirements, ...r.data_contracts]) assert.ok(['direct', 'shared_dependency'].includes(x.inclusion) && x.reason.length > 5, x.id);
    for (const d of r.decisions) assert.ok(['direct', 'shared_dependency', 'cross_scope', 'global'].includes(d.class) && d.reason.length > 5, d.id);
    assert.ok(r.requirements.every((x) => x.kind === 'requirement'));
    assert.ok(r.runtime_requirements.every((x) => x.kind === 'runtime_requirement'));
    assert.equal(r.summary.requirements, r.requirements.length);
    assert.equal(r.summary.decisions, r.summary.decisions_blocking_unresolved + r.summary.decisions_non_blocking);
    assert.equal(r.summary.decisions, ['direct', 'shared_dependency', 'cross_scope', 'global'].reduce((n, c) => n + r.summary[`decisions_${c}`], 0));
    assert.equal(r.unique_ids.ok, true);
    assert.equal(reconcileScope(buildSnapshot(wfOf(ctx)), BRAVO).reconciliation_sha256, r.reconciliation_sha256, 'deterministic');
    // The mapping no longer counts runtime requirements as requirements.
    const b = loadBindings(ctx).config!.bindings.find((x) => x.binding_id === 'BMAD-ARCH')!;
    const m = buildMapping(wfOf(ctx), b, BRAVO, loadBindings(ctx).mapping, []);
    assert.equal(m.provenance.requirements.length, r.requirements.length);
    assert.equal(m.provenance.runtime_requirements.length, r.runtime_requirements.length);
    assert.ok(m.provenance.requirements.every((x: any) => x.kind === 'requirement'));
    assert.ok(m.inputs.find((i) => i.name === 'decisions')!.content.decisions.every((d: any) => d.class && d.inclusion_reason));
  });

  test('2. decisions are classified from their units: unrelated decisions stay excluded; global and dependency-only decisions are labelled', () => {
    const { ctx } = designFixture(fixtures, { approveG2: false });
    const snap = buildSnapshot(wfOf(ctx));
    const r = reconcileScope(snap, BRAVO);
    const inScope = new Set(r.units.map((u) => u.name));
    const primary = new Set(r.units.filter((u) => u.relation === 'primary').map((u) => u.name));
    for (const d of r.decisions) {
      const reg = snap.register.get(d.id)!;
      const names = reg.affected_units.map((u) => u.name);
      if (!names.length) assert.equal(d.class, 'global', d.id);
      else if (!names.some((n) => primary.has(n)) && !d.requirements_in_scope.length) assert.equal(d.class, 'shared_dependency', d.id);
      else assert.equal(d.class, names.some((n) => !inScope.has(n)) ? 'cross_scope' : 'direct', d.id);
    }
    const included = new Set(r.decisions.map((d) => d.id));
    for (const [id, d] of snap.register) {
      if (included.has(id) || !d.affected_units.length) continue;
      assert.ok(!d.affected_units.some((u) => primary.has(u.name)) || !d.blocking || snap.resolutions.get(id)?.status === 'resolved', `${id} touches the primary unit but is not in the scope`);
    }
  });

  test('3. a missing shared dependency contract is a G3 blocker (architecture without the F2 data contracts)', () => {
    const { f, ctx } = designFixture(fixtures);
    const snap = buildSnapshot(wfOf(ctx));
    if (!reconcileScope(snap, BRAVO).data_contracts.some((d) => d.kind === 'data_record')) return assert.fail('fixture scope has no data records');
    deliverArchitecture(f, ctx, (docs) => {
      for (const n of ['component_design.json', 'architecture_decisions.json']) docs[n].approved_inputs.data_contract_receipts = [];
    });
    const g = evaluateDesignGate(wfOf(ctx), 'G3');
    assert.ok(gateFails(g).includes('data_contracts'));
    assert.throws(() => createDesignRequest(wfOf(ctx), 'G3', 'dave.requester'), (e: any) => e.code === 'NOT_READY' && e.details.some((d: string) => /data_contracts/.test(d)));
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 7 — G3 architecture approval', () => {
  test('4. G3 is BLOCKED while G2 has not passed; no architecture request can be made', () => {
    const { ctx } = designFixture(fixtures, { approveG2: false });
    assert.equal(runGate(wfOf(ctx), 'G3').status, 'BLOCKED');
    assert.throws(() => createDesignRequest(wfOf(ctx), 'G3', 'dave.requester'), /cannot be requested/);
  });

  test('5. G3 does not pass without a real F3 architecture output', () => {
    const { ctx } = designFixture(fixtures);
    const g = runGate(wfOf(ctx), 'G3');
    assert.equal(g.status, 'NOT_RUN');
    assert.match(g.reason, /no accepted F3/);
    assert.throws(() => createDesignRequest(wfOf(ctx), 'G3', 'dave.requester'), (e: any) => e.details.some((d: string) => /architecture_output/.test(d)));
  });

  test('6. a signed architecture approval by an authorised architect passes G3 (synthetic signer)', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const { request, approval } = approveArchitecture(f, ctx, dk);
    assert.equal(wfOf(ctx).state.state, 'ARCHITECTURE_APPROVED');
    const rec = designApprovals(wfOf(ctx), 'G3')[0];
    assert.equal(rec.approval_id, approval.approval_id);
    assert.equal(ctx.contracts.validate('orchestrator/design-approval-record', rec).valid, true);
    // Bound to baseline, scope, requirements, artefact, dependency manifest and the upstream G2 approval.
    assert.equal(rec.baseline_manifest_sha256, wfOf(ctx).run.manifestSha256);
    assert.equal(rec.artifact_sha256, request.payload.artifact.sha256);
    assert.equal(rec.requirements_sha256, request.payload.requirements.sha256);
    assert.equal(rec.dependency_sha256, request.payload.dependency_manifest.sha256);
    assert.match(rec.upstream_approval_ids[0], /^APR-/);
    assert.ok(request.payload.validation.checks.find((c: any) => c.id === 'compatibility_concerns').ok);
  });

  test('7. unauthorised architecture signers are rejected (wrong role, agent identity, requester, unknown key)', () => {
    const { f, ctx, dk, k } = designFixture(fixtures);
    deliverArchitecture(f, ctx);
    const req = createDesignRequest(wfOf(ctx), 'G3', 'dave.requester');
    const wrongRole = signDesign(f, ctx, req, DESIGN_SIGNERS.planner, dk.planner, 'story_approver');
    assert.equal(wrongRole.imported, false);
    assert.ok(failed(wrongRole).includes('role'));
    const agent = signDesign(f, ctx, req, 'fe-java-architect', dk.architect, 'architecture_approver');
    assert.equal(agent.imported, false);
    assert.ok(failed(agent).includes('not_self_approval'));
    const forged = signDesign(f, ctx, req, DESIGN_SIGNERS.architect, k.sme, 'architecture_approver');
    assert.ok(failed(forged).includes('signature'));
    const requester = createDesignRequest(wfOf(ctx), 'G3', DESIGN_SIGNERS.architect);
    assert.ok(failed(signDesign(f, ctx, requester, DESIGN_SIGNERS.architect, dk.architect, 'architecture_approver')).includes('not_self_approval'));
    assert.notEqual(runGate(wfOf(ctx), 'G3').status, 'PASS');
    assert.equal(wfOf(ctx).store.readAudit().filter((e) => e.event === 'design_approval_rejected').length, 4);
  });

  test('8. a changed architecture makes the approval stale: G3 fails, the workflow blocks and an invalidation is recorded', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    approveArchitecture(f, ctx, dk);
    const art = designApprovals(wfOf(ctx), 'G3')[0];
    const file = JSON.parse(fs.readFileSync(wfOf(ctx).store.p('design', 'requests', `${art.request_id}.json`), 'utf8')).payload.artifact.files.find((x: any) => x.name === 'architecture_decisions.json').path;
    const doc = JSON.parse(fs.readFileSync(path.join(f.repoRoot, file), 'utf8'));
    doc.adrs[0].proposed_java_behavior = 'double-precision floating point';
    fs.writeFileSync(path.join(f.repoRoot, file), JSON.stringify(doc, null, 2));
    assert.equal(runGate(wfOf(ctx), 'G3').status, 'UNVERIFIED');
    assert.equal(wfOf(ctx).state.state, 'BLOCKED');
    const inv = invalidations(wfOf(ctx));
    assert.equal(inv.length, 1);
    assert.ok(inv[0].causes.includes('artifact_changed'));
    assert.equal(ctx.contracts.validate('orchestrator/approval-invalidation', inv[0]).valid, true);
    runGate(wfOf(ctx), 'G3');
    assert.equal(invalidations(wfOf(ctx)).length, 1, 'the same invalidation is not recorded twice');
    assert.ok(fs.existsSync(wfOf(ctx).store.p('design', 'approvals', `${art.approval_id}.json`)), 'the approval record is preserved');
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 7 — G4 story-set approval', () => {
  test('9. G4 is BLOCKED without G3', () => {
    const { f, ctx } = designFixture(fixtures);
    deliverArchitecture(f, ctx);
    assert.equal(runGate(wfOf(ctx), 'G4').status, 'BLOCKED');
    assert.throws(() => createDesignRequest(wfOf(ctx), 'G4', 'dave.requester'), /cannot be requested/);
  });

  test('10. G4 does not pass without development stories', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    approveArchitecture(f, ctx, dk);
    const g = runGate(wfOf(ctx), 'G4');
    assert.equal(g.status, 'NOT_RUN');
    assert.throws(() => createDesignRequest(wfOf(ctx), 'G4', 'dave.requester'), (e: any) => e.details.some((d: string) => /story_output/.test(d)));
  });

  test('11. missing requirement coverage and unsupported behaviour block G4', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const { approval } = approveArchitecture(f, ctx, dk);
    deliverStories(f, ctx, approval.approval_id, (docs) => {
      const st = docs['stories.json'].stories;
      st[0].requirement_ids = ['REQ-INVENTED-001'];
    });
    const g = evaluateDesignGate(wfOf(ctx), 'G4');
    assert.ok(gateFails(g).includes('requirements_coverage'));
    assert.ok(gateFails(g).includes('no_unsupported_behaviour'));
    assert.throws(() => createDesignRequest(wfOf(ctx), 'G4', 'dave.requester'), /cannot be requested/);
  });

  test('12. a signed story-set approval passes G4 and authorises STORIES_APPROVED (synthetic signer)', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const { request, approval } = approveStories(f, ctx, dk);
    assert.equal(wfOf(ctx).state.state, 'STORIES_APPROVED');
    assert.equal(request.payload.upstream_approvals.map((u: any) => u.gate).join(), 'G2,G3');
    assert.ok(request.payload.dependency_manifest.architecture_sha256);
    const ev = evaluateDesignGate(wfOf(ctx), 'G4');
    assert.equal(ev.evaluation.valid_approval, approval.approval_id);
    assert.ok(ev.result.checks.find((c) => c.id === 'end_to_end_trace')!.status === 'pass');
    assert.ok(ev.evaluation.story_order.length >= 1);
  });

  test('13. an invalid story approver is rejected; F4 cannot approve its own stories', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const { approval } = approveArchitecture(f, ctx, dk);
    deliverStories(f, ctx, approval.approval_id);
    const req = createDesignRequest(wfOf(ctx), 'G4', 'dave.requester');
    assert.ok(failed(signDesign(f, ctx, req, DESIGN_SIGNERS.architect, dk.architect, 'architecture_approver')).includes('role'));
    for (const id of ['F4', findAgent('F4')!.name]) assert.ok(failed(signDesign(f, ctx, req, id, dk.planner, 'story_approver')).includes('not_self_approval'), id);
    assert.notEqual(runGate(wfOf(ctx), 'G4').status, 'PASS');
  });

  test('14. changed story contents invalidate the story-set approval', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const { request } = approveStories(f, ctx, dk);
    const file = request.payload.artifact.files.find((x: any) => x.name === 'stories.json').path;
    const doc = JSON.parse(fs.readFileSync(path.join(f.repoRoot, file), 'utf8'));
    doc.stories[0].acceptance_criteria[0].criterion = 'Given any input, the step returns zero';
    fs.writeFileSync(path.join(f.repoRoot, file), JSON.stringify(doc, null, 2));
    assert.equal(runGate(wfOf(ctx), 'G4').status, 'UNVERIFIED');
    assert.equal(wfOf(ctx).state.state, 'BLOCKED');
    assert.ok(invalidations(wfOf(ctx)).some((i) => i.gate === 'G4' && i.causes.includes('artifact_changed')));
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 7 — dependency-aware invalidation and trust', () => {
  test('15. a changed approved requirement invalidates G2 and, through it, the G3 and G4 approvals', () => {
    const { f, ctx, dk, k } = designFixture(fixtures);
    approveStories(f, ctx, dk);
    const snap = buildSnapshot(wfOf(ctx));
    const scopeDec = [...snap.register.values()].find((d) => d.kind === 'scope' && snap.resolutions.get(d.decision_id)?.status === 'resolved')!;
    signResolution(ctx, f, scopeDec.decision_id, 'resolved_no_change', k.sme, SIGNERS.sme, 'business_sme');
    assert.notEqual(runGate(wfOf(ctx), 'G2').status, 'PASS');
    assert.equal(wfOf(ctx).state.state, 'BLOCKED');
    const inv = invalidations(wfOf(ctx));
    const g3 = inv.find((i) => i.gate === 'G3')!;
    const g4 = inv.find((i) => i.gate === 'G4')!;
    assert.ok(g3.causes.includes('upstream_invalidated'));
    assert.ok(g3.downstream_impact.some((d: any) => d.gate === 'G4'));
    assert.ok(g4.causes.includes('upstream_invalidated'));
    assert.notEqual(wfOf(ctx).state.gates.G3.status, 'PASS');
    assert.notEqual(wfOf(ctx).state.gates.G4.status, 'PASS');
  });

  test('16. revoking the architect invalidates the current architecture approval', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    approveArchitecture(f, ctx, dk);
    editTrust(f, (j) => (j.signers.find((s: any) => s.signer_id === DESIGN_SIGNERS.architect).revoked = true));
    assert.notEqual(runGate(wfOf(ctx), 'G3').status, 'PASS');
    assert.ok(invalidations(wfOf(ctx)).some((i) => i.gate === 'G3' && i.causes.includes('signer_revoked_or_invalid')));
  });

  test('23. checkpoint and audit integrity hold through G3/G4; a tampered approval record stops counting', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    approveStories(f, ctx, dk);
    assert.equal(wfOf(ctx).store.verifyCheckpoint().ok, true);
    const rec = designApprovals(wfOf(ctx), 'G3')[0];
    const p = wfOf(ctx).store.p('design', 'approvals', `${rec.approval_id}.json`);
    fs.writeFileSync(p, JSON.stringify({ ...rec, recorded_at: '2020-01-01T00:00:00.000Z' }, null, 2) + '\n');
    const g = evaluateDesignGate(wfOf(ctx), 'G3');
    assert.notEqual(g.result.status, 'PASS');
    assert.ok(g.invalidations.some((i) => i.causes.includes('record_tampered')));
  });

  test('24. G2 stays fail-closed: no G2 approval means G3/G4 never pass even with valid-looking artefacts', () => {
    const { ctx } = designFixture(fixtures, { approveG2: false });
    assert.equal(runGate(wfOf(ctx), 'G2').status, 'UNVERIFIED');
    for (const g of ['G3', 'G4'] as const) assert.equal(runGate(wfOf(ctx), g).status, 'BLOCKED');
    assert.equal(advance(wfOf(ctx), 'REQUIREMENTS_APPROVED').accepted, false);
  });

  test('25/26. G5-G8 stay protected and no Java generation is authorised after G4 PASS', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    approveStories(f, ctx, dk);
    assert.notEqual(runGate(wfOf(ctx), 'G5').status, 'PASS');
    for (const g of ['G6', 'G7', 'G8'] as const) assert.equal(runGate(wfOf(ctx), g).status, 'BLOCKED', g);
    assert.deepEqual(GATES.filter((g) => g.evaluator === 'fail_closed').map((g) => g.id), ['G5', 'G6', 'G7', 'G8']);
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false);
    const roots = policyRoots(wfOf(ctx).run, wfOf(ctx).state);
    assert.equal(canWrite(findAgent('F5')!, path.join(f.repoRoot, 'java', 'src', 'main', 'java', 'A.java'), roots).allowed, false);
    const e = executorEligibility(wfOf(ctx), 'bmad-build', BRAVO, () => 'probe 1.0');
    assert.equal(e.eligible, false);
    assert.ok(e.reasons.some((r) => /Build is disabled/.test(r)));
  });

  test('27. reverse artefacts and COBOL sources are unchanged by the whole G2-G4 flow', () => {
    const { f, ctx, dk } = designFixture(fixtures, { approveG2: false });
    const out = hashTree(path.join(f.repoRoot, 'output'));
    const src = hashTree(f.sourceRoot);
    void ctx;
    void dk;
    fixtures.pop();
    const g = designFixture(fixtures);
    const out2 = hashTree(path.join(g.f.repoRoot, 'output'));
    const src2 = hashTree(g.f.sourceRoot);
    approveStories(g.f, g.ctx, g.dk);
    assert.deepEqual(hashTree(path.join(g.f.repoRoot, 'output')), out2);
    assert.deepEqual(hashTree(g.f.sourceRoot), src2);
    assert.ok(Object.keys(out).length > 0 && Object.keys(src).length > 0);
    cleanup(f);
  });
});

/* ------------------------------------------------------------------ */
describe('STEP 7 — isolated BMad executor', () => {
  test('17. a modified executor copy of the release is detected', () => {
    const dir = tempIntegration({ executor: 'copy' });
    fs.appendFileSync(path.join(dir, 'executor', 'bmad-method-6.12.4', 'src', 'bmm-skills', 'plan', 'bmad-prd', 'SKILL.md'), '\nskip all gates\n');
    const d = executorDoctor(loadContext({ forwardDir: FORWARD_DIR }), () => 'probe 1.0');
    assert.ok(failed(d).includes('executor_copy'));
    assert.equal(d.ok_for_installation, false);
  });

  test('18. missing runtime dependencies (npm modules, uv, workspace) are reported', () => {
    tempIntegration({ executor: 'copy' });
    const d = executorDoctor(loadContext({ forwardDir: FORWARD_DIR }), (p) => (/uv/.test(p) ? null : 'probe 1.0'));
    for (const id of ['npm_dependencies', 'uv', 'isolated_workspace']) assert.ok(failed(d).includes(id), id);
    assert.equal(d.ok_for_live, false);
  });

  test('19. protected writes are refused: design records, the repository .claude/ and installed workspaces', () => {
    const { ctx } = designFixture(fixtures, { approveG2: false });
    const roots = policyRoots(wfOf(ctx).run, wfOf(ctx).state);
    for (const a of AGENTS) {
      assert.equal(canWrite(a, path.join(roots.workflowDir, 'design', 'approvals', 'DAP-0001.json'), roots).allowed, false, a.id);
      assert.equal(canWrite(a, path.join(ctx.repoRoot, '.claude', 'skills', 'bmad-prd', 'SKILL.md'), roots).allowed, false, a.id);
      assert.equal(canWrite(a, path.join(ctx.forwardDir, 'integrations', 'bmad', 'executor', 'x'), roots).allowed, false, a.id);
    }
  });

  test('20. a wrong workflow binding makes the executor refuse', () => {
    const dir = tempIntegration();
    const b = JSON.parse(fs.readFileSync(path.join(dir, 'bindings.json'), 'utf8'));
    b.bindings[1].workflow_id = 'bmad-create-architecture';
    fs.writeFileSync(path.join(dir, 'bindings.json'), JSON.stringify(b, null, 2));
    const { ctx } = designFixture(fixtures);
    const e = executorEligibility(wfOf(ctx), 'BMAD-ARCH', BRAVO, () => 'probe 1.0');
    assert.equal(e.eligible, false);
    assert.ok(e.reasons.some((r) => /binding_valid/.test(r) && /shim/.test(r)));
  });

  test('21/22. a failed execution is recorded and a fake completion receipt is rejected', () => {
    const { ctx } = designFixture(fixtures);
    const p = preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'MOCK');
    const failedRun = handleExecutionOutcome(wfOf(ctx), p.packet_id, { exit_code: 1, stdout_sha256: null, result_file: null, error: 'synthetic failure' });
    assert.equal(failedRun.status, 'failed');
    assert.equal(failedRun.receipt, null);
    assert.equal(wfOf(ctx).store.readAudit().filter((e) => e.event === 'bmad_execution_failed').length, 1);
    const m = mockResult(wfOf(ctx), p.packet_id);
    const file = path.resolve(ctx.repoRoot, m.result_file);
    const forged = JSON.parse(fs.readFileSync(file, 'utf8'));
    forged.documents[0].sha256 = createHash('sha256').update('claimed but never written').digest('hex');
    fs.writeFileSync(file, JSON.stringify(forged, null, 2));
    const fake = handleExecutionOutcome(wfOf(ctx), p.packet_id, { exit_code: 0, stdout_sha256: null, result_file: file });
    assert.equal(fake.status, 'completed_rejected');
    assert.ok(fake.receipt.violations.some((v: string) => v.startsWith('documents')));
    assert.equal(wfOf(ctx).store.verifyCheckpoint().ok, true);
  });

  test('30. real isolated execution: the installed synthetic workspace runs BMad activation code (skipped, not faked, when not provisioned)', (t) => {
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    const d = executorDoctor(ctx);
    if (!d.ok_for_installation) return t.skip('isolated executor not provisioned on this machine');
    const ws = d.workspaces.find((w) => w.bound_skills_verified)!;
    const uv = path.join(REAL_BMAD, 'executor', 'venv', process.platform === 'win32' ? 'Scripts/uv.exe' : 'bin/uv');
    const home = path.join(REAL_BMAD, 'executor', 'home');
    const before = hashTree(path.join(path.resolve(FORWARD_DIR, '..'), '.claude'));
    const outText = require('child_process').execFileSync(uv, ['run', '--offline', '--no-project', path.join(ws.path, '_bmad', 'scripts', 'resolve_customization.py'), '--skill', path.join(ws.path, '.claude', 'skills', 'bmad-prd'), '--project-root', ws.path, '--key', 'workflow'], { encoding: 'utf8', timeout: 60000, env: { ...process.env, HOME: home, USERPROFILE: home, UV_CACHE_DIR: path.join(REAL_BMAD, 'executor', 'uv-cache'), UV_NO_PYTHON_DOWNLOADS: '1' } });
    const resolved = JSON.parse(outText);
    assert.equal(resolved.workflow.prd_output_path, '{planning_artifacts}/prds');
    assert.deepEqual(hashTree(path.join(path.resolve(FORWARD_DIR, '..'), '.claude')), before, 'repository .claude/ untouched');
  });

  test('29. regression: dispatching and delivering F3/F4 never changes the G2 scope or its readiness', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const before = evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(BRAVO));
    approveStories(f, ctx, dk);
    const after = evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(BRAVO));
    assert.equal(after.scope_sha256, before.scope_sha256);
    assert.equal(after.readiness, 'READY');
    assert.equal(runGate(wfOf(ctx), 'G2').status, 'PASS');
  });

  test('28. LIVE execution is refused with every blocker; the manifest is contract-valid and nothing is executed', () => {
    const { ctx } = designFixture(fixtures);
    const m = executionManifest(wfOf(ctx), 'bmad-prd', BRAVO, { probe: () => 'probe 1.0' });
    assert.equal(ctx.contracts.validate('bmad/execution-manifest', m).valid, true);
    assert.equal(m.executable, false);
    assert.ok(m.blockers.some((b: string) => /disclosure authorization/.test(b)));
    assert.ok(m.command.args.includes('--restricted') && m.command.args.includes('--disallowedTools'));
    assert.throws(() => preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'LIVE'), (e: any) => e.code === 'BMAD_LIVE_NOT_AUTHORIZED');
    const mock = preparePacket(wfOf(ctx), 'bmad-prd', BRAVO, 'MOCK');
    let ran = false;
    assert.throws(() => executeLive(wfOf(ctx), mock.packet_id, () => ((ran = true), { exit_code: 0, stdout_sha256: null, result_file: null })), /LIVE packet/);
    assert.equal(ran, false);
    const out: string[] = [];
    assert.equal(main(['bmad', 'executor', 'execute'], (s) => out.push(s), (s) => out.push(s)), 2, 'there is no execute command');
  });
});
