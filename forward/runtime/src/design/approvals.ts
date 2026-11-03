/**
 * G3 (architecture) and G4 (story set) human approval and gate evaluation
 * (STEP 7). Same trust model as G2: the external trust store, Ed25519
 * signatures over canonical JSON, separation of duties and runtime-sealed
 * records. Additional bindings: the approved-requirements content hash, the
 * exact artefact hash, the dependency manifest and the upstream approvals
 * (G2 for G3; G2 and G3 for G4).
 *
 *  1. `design request` is issued only for an artefact that passes validation
 *     against the currently approved scope.
 *  2. A human with the policy role signs the statement outside the harness.
 *  3. `design import` verifies everything; only then a DAP record is written.
 *  4. The gate PASSes only while the approval re-verifies against current
 *     content. When an approved artefact, its requirements, its sources, its
 *     upstream approval or its signer's authority changes, the approval stops
 *     counting and an invalidation record (INV) names the cause and the
 *     downstream approvals affected. Nothing is deleted or rewritten.
 */
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import { canonicalize, digest } from '../approval/canonical';
import { buildSnapshot, Snapshot } from '../approval/snapshot';
import { AGENT_IDENTITY, scopeAllowed, verifySignature } from '../approval/trust';
import { sha256File } from '../core/fsutil';
import { findAgent } from '../orchestrator/agents';
import { gatePassed, GateCheck, GateResult, gateSpec } from '../orchestrator/gates';
import { mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { approvedScope, ApprovedScope, artifactSet, ArtifactSet, Check, validateArchitecture, validateStories } from './design';

export type DesignGate = 'G3' | 'G4';
export const DESIGN_DIR = 'design';

/** Roles that may sign each gate. G3 also needs a technical authority when an ADR changes legacy behaviour. Bound into every request (policy digest). */
export const DESIGN_POLICY = {
  version: '1.0',
  G3: { approver_roles: ['architecture_approver'], co_approval_roles_when_behavior_change: ['technical_authority'] },
  G4: { approver_roles: ['story_approver'] },
  revocation_invalidates_existing: true,
};
export const designPolicyDigest = () => digest(DESIGN_POLICY);

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* current context                                                     */
/* ------------------------------------------------------------------ */

export interface DesignContext {
  gate: DesignGate;
  ok: boolean;
  blocked: string | null;
  scope: ApprovedScope;
  artifact: ArtifactSet | null;
  validation: { ok: boolean; checks: Check[] };
  upstream: Array<{ gate: 'G2' | 'G3'; approval_id: string; sha256: string }>;
  architecture_sha256: string | null;
  co_roles: string[];
  dependency: any | null;
  dependency_sha256: string | null;
  g3: { approval_id: string | null; components: Map<string, any>; artifact_sha256: string | null } | null;
  story_order: string[];
}

/** What a G3 / G4 approval must match right now. */
export function designContext(wf: Workflow, gate: DesignGate, snap: Snapshot = buildSnapshot(wf)): DesignContext {
  const scope = approvedScope(wf, snap);
  if (gate === 'G3') {
    const artifact = artifactSet(wf, 'F3');
    const v = validateArchitecture(wf, snap, scope, artifact);
    const upstream = scope.ok ? [{ gate: 'G2' as const, approval_id: scope.approval_id!, sha256: scope.approval_sha256! }] : [];
    const dependency = scope.dependency ? { ...scope.dependency, architecture_sha256: null } : null;
    return { gate, ok: scope.ok && !!artifact && v.ok, blocked: scope.ok ? null : scope.reason, scope, artifact, validation: v, upstream, architecture_sha256: null, co_roles: v.needs_co_approval ? DESIGN_POLICY.G3.co_approval_roles_when_behavior_change : [], dependency, dependency_sha256: dependency ? digest(dependency) : null, g3: { approval_id: null, components: v.components, artifact_sha256: artifact?.sha256 ?? null }, story_order: [] };
  }
  const g3 = evaluateDesignGate(wf, 'G3', snap);
  const g3ok = g3.result.status === 'PASS' && !!g3.evaluation?.valid_approval;
  const g3ctx = g3.context;
  const artifact = artifactSet(wf, 'F4');
  const v = validateStories(wf, snap, scope, { approval_id: g3ok ? g3.evaluation.valid_approval : null, components: g3ctx.g3?.components ?? new Map() }, artifact);
  const upstream = scope.ok && g3ok ? [{ gate: 'G2' as const, approval_id: scope.approval_id!, sha256: scope.approval_sha256! }, { gate: 'G3' as const, approval_id: g3.evaluation.valid_approval, sha256: sha256File(wf.store.p(DESIGN_DIR, 'approvals', `${g3.evaluation.valid_approval}.json`))! }] : [];
  const dependency = scope.dependency ? { ...scope.dependency, architecture_sha256: g3ctx.artifact?.sha256 ?? null } : null;
  return { gate, ok: scope.ok && g3ok && !!artifact && v.ok, blocked: !scope.ok ? scope.reason : !g3ok ? `G3 re-evaluated now: ${g3.result.status} — ${g3.result.reason}` : null, scope, artifact, validation: v, upstream, architecture_sha256: g3ctx.artifact?.sha256 ?? null, co_roles: [], dependency, dependency_sha256: dependency ? digest(dependency) : null, g3: { approval_id: g3ok ? g3.evaluation.valid_approval : null, components: g3ctx.g3?.components ?? new Map(), artifact_sha256: g3ctx.artifact?.sha256 ?? null }, story_order: (v as any).order ?? [] };
}

/* ------------------------------------------------------------------ */
/* requests                                                            */
/* ------------------------------------------------------------------ */

export function designRequests(wf: Workflow): any[] {
  return wf.store.list(`${DESIGN_DIR}/requests`).map((f) => wf.store.readRecord(`${DESIGN_DIR}/requests`, f));
}
export function designApprovals(wf: Workflow, gate?: DesignGate): any[] {
  return wf.store.list(`${DESIGN_DIR}/approvals`).map((f) => wf.store.readRecord(`${DESIGN_DIR}/approvals`, f)).filter((a) => !gate || a.gate === gate);
}
export function invalidations(wf: Workflow): any[] {
  return wf.store.list(`${DESIGN_DIR}/invalidations`).map((f) => wf.store.readRecord(`${DESIGN_DIR}/invalidations`, f));
}
function sealed(wf: Workflow, event: string, key: string, id: string): string | null {
  let h: string | null = null;
  for (const e of wf.store.readAudit()) if (e.event === event && (e.data as any)[key] === id) h = (e.data as any).sha256;
  return h;
}

export function createDesignRequest(wf: Workflow, gate: DesignGate, requestedBy: string): any {
  return mutate(wf, `${gate} approval request`, () => {
    if (!requestedBy || AGENT_IDENTITY.test(requestedBy)) throw new OrchestratorError(`approval requests must name a human requester (--requested-by); '${requestedBy}' is not acceptable`, 'USAGE');
    const snap = buildSnapshot(wf);
    const c = designContext(wf, gate, snap);
    if (!c.ok) {
      const problems = [...(c.blocked ? [c.blocked] : []), ...c.validation.checks.filter((x) => !x.ok).map((x) => `${x.id}: ${x.detail}`)];
      wf.store.append('design_approval_request_refused', { gate, requested_by: requestedBy, problems: problems.slice(0, 20) });
      wf.store.writeState(wf.state);
      throw new OrchestratorError(`${gate} approval cannot be requested: the ${gate === 'G3' ? 'architecture' : 'story set'} is not valid for the approved scope`, 'NOT_READY', problems);
    }
    const n = wf.store.list(`${DESIGN_DIR}/requests`).length + 1;
    const request_id = `DREQ-${String(n).padStart(4, '0')}`;
    const created = new Date();
    const policy = snap.policy;
    const payload = {
      contract: 'design-approval-request-payload',
      contract_version: '1.0',
      request_id,
      gate,
      workflow_id: wf.state.workflow_id,
      run_id: wf.run.runId,
      baseline: { manifest_sha256: wf.run.manifestSha256 },
      scope: { selector_text: c.scope.scope!, scope_sha256: c.scope.scope_sha256! },
      requirements: { sha256: c.scope.requirements_sha256!, ids: c.scope.requirements.map((r) => r.id) },
      upstream_approvals: c.upstream,
      artifact: { kind: gate === 'G3' ? 'architecture' : 'story_set', agent: gate === 'G3' ? 'F3' : 'F4', receipt_id: c.artifact!.receipt_id, files: c.artifact!.files, sha256: c.artifact!.sha256 },
      dependency_manifest: { sha256: c.dependency_sha256!, ...c.dependency },
      validation: { ok: true, checks: c.validation.checks },
      policy_sha256: designPolicyDigest(),
      required_roles: gate === 'G3' ? DESIGN_POLICY.G3.approver_roles : DESIGN_POLICY.G4.approver_roles,
      co_approval_roles: c.co_roles,
      approval_covers:
        gate === 'G3'
          ? 'Approval accepts this exact architecture (files and hashes) for the listed approved requirements, dependency manifest and upstream requirements approval: components, ADRs, technology choices and the treatment of every compatibility concern. It does not approve stories or code.'
          : 'Approval authorises this exact story set (files and hashes) for implementation against the listed approved requirements and architecture: scope, ordering, acceptance criteria and testing expectations. It does not approve code.',
      requested_by: requestedBy,
      created_at: created.toISOString(),
      expires_at: new Date(created.getTime() + policy.request_ttl_hours * 3600000).toISOString(),
      nonce: randomBytes(16).toString('hex'),
    };
    const rec = { contract: 'design-approval-request', contract_version: '1.0', request_id, request_sha256: digest(payload), payload };
    const v = wf.run.ctx.contracts.validate('orchestrator/design-approval-request', rec);
    if (!v.valid) throw new OrchestratorError('design approval request violates its contract', 'CONTRACT', v.errors);
    const file = wf.store.writeRecord(`${DESIGN_DIR}/requests`, `${request_id}.json`, rec);
    wf.store.append('design_approval_requested', { request_id, gate, request_sha256: rec.request_sha256, scope: payload.scope.selector_text, artifact_sha256: payload.artifact.sha256, requested_by: requestedBy, expires_at: payload.expires_at, sha256: sha256File(file) });
    wf.store.writeState(wf.state);
    return { ...rec, file };
  });
}

/** The statement a signer signs; its canonical JSON is the signed message. */
export function designStatement(request: any, signerId: string, role: string, decision: 'approved' | 'rejected', signedAt = new Date().toISOString(), comment?: string): any {
  const p = request.payload;
  return {
    contract: 'design-approval-statement',
    statement_version: '1.0',
    gate: p.gate,
    request_id: request.request_id,
    request_sha256: request.request_sha256,
    scope_sha256: p.scope.scope_sha256,
    requirements_sha256: p.requirements.sha256,
    artifact_sha256: p.artifact.sha256,
    dependency_sha256: p.dependency_manifest.sha256,
    upstream_approval_ids: p.upstream_approvals.map((u: any) => u.approval_id),
    baseline_manifest_sha256: p.baseline.manifest_sha256,
    decision,
    signer_id: signerId,
    role,
    signed_at: signedAt,
    ...(comment ? { comment } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* verification                                                        */
/* ------------------------------------------------------------------ */

export function checkDesignApproval(wf: Workflow, snap: Snapshot, signed: any, current: DesignContext, opts: { existing?: any } = {}): { ok: boolean; checks: Check[]; request: any | null } {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const v = wf.run.ctx.contracts.validate('orchestrator/signed-design-approval', signed);
  add('contract', v.valid, v.valid ? 'signed design approval satisfies its contract' : v.errors.slice(0, 5).join('; '));
  if (!v.valid) return { ok: false, checks, request: null };
  const st = signed.statement;
  const reqFile = wf.store.p(DESIGN_DIR, 'requests', `${st.request_id}.json`);
  if (!fs.existsSync(reqFile)) {
    add('request_exists', false, `approval request ${st.request_id} does not exist in this workflow`);
    return { ok: false, checks, request: null };
  }
  const request = JSON.parse(fs.readFileSync(reqFile, 'utf8'));
  const p = request.payload;
  const intact = sealed(wf, 'design_approval_requested', 'request_id', st.request_id) === sha256File(reqFile) && digest(p) === request.request_sha256;
  add('request_intact', intact, intact ? `${st.request_id} matches the hash sealed in the audit log` : `${st.request_id} was altered after it was issued (tampered)`);
  const bound =
    st.gate === p.gate && st.gate === current.gate && st.request_sha256 === request.request_sha256 && st.scope_sha256 === p.scope.scope_sha256 && st.requirements_sha256 === p.requirements.sha256 && st.artifact_sha256 === p.artifact.sha256 && st.dependency_sha256 === p.dependency_manifest.sha256 && st.baseline_manifest_sha256 === p.baseline.manifest_sha256 && canonicalize(st.upstream_approval_ids) === canonicalize(p.upstream_approvals.map((u: any) => u.approval_id));
  add('statement_binding', bound, bound ? 'statement binds the exact request, scope, requirements, artefact, dependency manifest, upstream approvals and baseline' : 'statement does not bind this request\'s content (mismatched digest, gate, artefact or upstream approval)');
  const allowed = [...p.required_roles, ...p.co_approval_roles];
  const sig = verifySignature(snap.trust, st.signer_id, canonicalize(st), signed.signature.value, allowed, snap.at);
  add('trust_anchor', snap.trust.usable, snap.trust.usable ? `trust store ${snap.trust.origin} (${String(snap.trust.sha256).slice(0, 16)}…)` : snap.trust.problems.join('; ') || 'no usable trust store');
  add('signature', sig.ok, sig.ok ? `Ed25519 signature by ${st.signer_id} verified (key ${sig.signer!.fingerprint.slice(0, 16)}…)` : sig.problems.join('; '));
  const roleOk = allowed.includes(st.role) && !!sig.signer?.roles.includes(st.role);
  add('role', roleOk, roleOk ? `role ${st.role} is authorised for ${p.gate}` : allowed.includes(st.role) ? `signer does not hold role ${st.role}` : `role ${st.role} cannot approve ${p.gate} (needs ${allowed.join(' or ')})`);
  const scopeOk = scopeAllowed(sig.signer, p.scope.selector_text);
  add('signer_scope', scopeOk, scopeOk ? (sig.signer?.scopes ? `signer is authorised for ${p.scope.selector_text}` : 'signer has no scope restriction') : `signer ${st.signer_id} is restricted to ${sig.signer!.scopes!.join(', ')}`);
  const author = findAgent(p.artifact.agent);
  const self = AGENT_IDENTITY.test(st.signer_id) || st.signer_id === author?.name || st.signer_id === author?.id || (snap.policy.require_distinct_requester && st.signer_id === p.requested_by);
  add('not_self_approval', !self, self ? `${st.signer_id} is the requester, the authoring agent or an automated identity; self-approval is rejected` : `signer is neither the requester (${p.requested_by}) nor the authoring agent (${author?.name})`);
  if (!opts.existing) {
    const t = snap.at.getTime();
    add('not_expired', t <= Date.parse(p.expires_at), t <= Date.parse(p.expires_at) ? `request valid until ${p.expires_at}` : `request expired at ${p.expires_at}`);
    const skew = snap.policy.max_clock_skew_minutes * 60000;
    const signedOk = Date.parse(st.signed_at) >= Date.parse(p.created_at) - skew && Date.parse(st.signed_at) <= t + skew;
    add('signed_at', signedOk, signedOk ? `signed at ${st.signed_at}` : `signed_at ${st.signed_at} is before the request or in the future`);
    const used = designApprovals(wf).find((r) => r.signature?.value === signed.signature.value || (r.request_id === st.request_id && r.signer.signer_id === st.signer_id));
    add('not_replayed', !used, used ? `${used.approval_id} already recorded this signature or this signer's decision on ${st.request_id} (replay)` : 'first decision of this signer on this request');
  } else {
    const ok = sealed(wf, 'design_approval_imported', 'approval_id', opts.existing.approval_id) === sha256File(wf.store.p(DESIGN_DIR, 'approvals', `${opts.existing.approval_id}.json`));
    add('record_intact', ok, ok ? `${opts.existing.approval_id} matches the hash sealed in the audit log` : `${opts.existing.approval_id} was altered after import`);
  }
  // Currency: the approval counts only while the content it approved is exactly the current content.
  const baseOk = p.baseline.manifest_sha256 === wf.run.manifestSha256 && snap.g0.status === 'PASS';
  add('baseline_current', baseOk, baseOk ? 'source and reverse baseline unchanged (G0 PASS)' : `baseline changed or not intact (G0 ${snap.g0.status})`);
  const ups = current.upstream.map((u) => u.approval_id);
  const upOk = !current.blocked && canonicalize(ups) === canonicalize(p.upstream_approvals.map((u: any) => u.approval_id)) && current.upstream.every((u) => p.upstream_approvals.some((x: any) => x.approval_id === u.approval_id && x.sha256 === u.sha256));
  add('upstream_current', upOk, upOk ? `upstream approval(s) ${ups.join(', ')} still valid` : current.blocked ? `upstream no longer valid: ${current.blocked}` : `upstream approvals are now ${ups.join(', ') || 'none'}, approval bound ${p.upstream_approvals.map((u: any) => u.approval_id).join(', ')}`);
  add('scope_current', current.scope.scope_sha256 === p.scope.scope_sha256, current.scope.scope_sha256 === p.scope.scope_sha256 ? 'scope digest unchanged' : 'scope content changed since the request (stale)');
  add('requirements_current', current.scope.requirements_sha256 === p.requirements.sha256, current.scope.requirements_sha256 === p.requirements.sha256 ? 'approved requirements unchanged' : 'approved requirements changed since the request');
  add('artifact_current', current.artifact?.sha256 === p.artifact.sha256 && !current.artifact?.problems.length, current.artifact?.sha256 === p.artifact.sha256 && !current.artifact?.problems.length ? `${p.artifact.kind} unchanged (${p.artifact.receipt_id})` : `${p.artifact.kind} changed since the request: ${current.artifact ? (current.artifact.problems.join('; ') || `now ${current.artifact.receipt_id} (${current.artifact.sha256.slice(0, 16)}…)`) : 'none delivered'}`);
  add('dependency_current', current.dependency_sha256 === p.dependency_manifest.sha256, current.dependency_sha256 === p.dependency_manifest.sha256 ? 'dependency manifest unchanged' : 'dependency manifest changed since the request (units, data contracts, runtime requirements, decisions or architecture)');
  add('artifact_valid', current.validation.ok, current.validation.ok ? 'artefact still passes its validation' : `artefact validation now fails: ${current.validation.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`);
  return { ok: checks.every((c) => c.ok), checks, request };
}

function readSigned(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new OrchestratorError(`cannot read signed approval ${file}: ${(e as Error).message}`, 'USAGE');
  }
}

export function verifyDesignApprovalFile(wf: Workflow, file: string): any {
  const signed = readSigned(file);
  const gate = signed?.statement?.gate === 'G4' ? 'G4' : 'G3';
  const snap = buildSnapshot(wf);
  const r = checkDesignApproval(wf, snap, signed, designContext(wf, gate, snap));
  return { ok: r.ok, gate, checks: r.checks, request_id: r.request?.request_id ?? null, decision: signed?.statement?.decision ?? null };
}

export function importDesignApproval(wf: Workflow, file: string): any {
  return mutate(wf, 'design approval import', () => {
    const signed = readSigned(file);
    const gate: DesignGate = signed?.statement?.gate === 'G4' ? 'G4' : 'G3';
    const snap = buildSnapshot(wf);
    const r = checkDesignApproval(wf, snap, signed, designContext(wf, gate, snap));
    if (!r.ok) {
      wf.store.append('design_approval_rejected', { gate, request_id: signed?.statement?.request_id ?? null, signer_id: signed?.statement?.signer_id ?? null, file_sha256: sha256File(file), problems: r.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`) });
      wf.store.writeState(wf.state);
      return { imported: false, gate, checks: r.checks };
    }
    const n = wf.store.list(`${DESIGN_DIR}/approvals`).length + 1;
    const approval_id = `DAP-${String(n).padStart(4, '0')}`;
    const st = signed.statement;
    const sig = verifySignature(snap.trust, st.signer_id, canonicalize(st), signed.signature.value, [], snap.at);
    const rec = {
      contract: 'design-approval-record',
      contract_version: '1.0',
      approval_id,
      gate,
      decision: st.decision,
      recorded_at: now(),
      recorded_by: 'runtime',
      request_id: r.request.request_id,
      request_sha256: r.request.request_sha256,
      scope: { selector_text: r.request.payload.scope.selector_text, scope_sha256: r.request.payload.scope.scope_sha256 },
      requirements_sha256: st.requirements_sha256,
      artifact_sha256: st.artifact_sha256,
      dependency_sha256: st.dependency_sha256,
      upstream_approval_ids: st.upstream_approval_ids,
      baseline_manifest_sha256: st.baseline_manifest_sha256,
      signer: { signer_id: st.signer_id, role: st.role, key_fingerprint: sig.signer!.fingerprint, display_name: sig.signer!.display_name },
      trust_store_sha256: snap.trust.sha256!,
      statement: st,
      signature: signed.signature,
      verification: { checks: r.checks },
    };
    const v = wf.run.ctx.contracts.validate('orchestrator/design-approval-record', rec);
    if (!v.valid) throw new OrchestratorError('design approval record violates its contract', 'CONTRACT', v.errors);
    const f = wf.store.writeRecord(`${DESIGN_DIR}/approvals`, `${approval_id}.json`, rec);
    wf.store.append('design_approval_imported', { approval_id, gate, request_id: rec.request_id, decision: rec.decision, signer: st.signer_id, role: st.role, artifact_sha256: rec.artifact_sha256, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { imported: true, approval_id, gate, decision: rec.decision, checks: r.checks };
  });
}

/* ------------------------------------------------------------------ */
/* gates                                                               */
/* ------------------------------------------------------------------ */

const CAUSE: Record<string, string> = {
  baseline_current: 'baseline_changed',
  scope_current: 'scope_changed',
  requirements_current: 'requirements_changed',
  artifact_current: 'artifact_changed',
  artifact_valid: 'artifact_changed',
  dependency_current: 'dependency_changed',
  upstream_current: 'upstream_invalidated',
  signature: 'signer_revoked_or_invalid',
  role: 'signer_revoked_or_invalid',
  record_intact: 'record_tampered',
  request_intact: 'record_tampered',
  statement_binding: 'record_tampered',
  trust_anchor: 'trust_unavailable',
};

export interface DesignGateOutcome {
  result: GateResult;
  evaluation: any;
  context: DesignContext;
  invalidations: any[];
}

export function evaluateDesignGate(wf: Workflow, gate: DesignGate, snap: Snapshot = buildSnapshot(wf)): DesignGateOutcome {
  const spec = gateSpec(gate)!;
  const at = snap.at.toISOString();
  const context = designContext(wf, gate, snap);
  const checks: GateCheck[] = [];
  const inputs: GateResult['inputs'] = [{ kind: 'baseline_manifest', ref: wf.state.baseline.manifest_path, sha256: wf.run.manifestSha256 }];
  const result = (status: GateResult['status'], reason: string): GateResult => ({ contract: 'gate-result', contract_version: '1.0', gate, name: spec.name, status, reason, evaluated_at: at, evaluator: 'implemented', baseline: { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 }, inputs, checks, limitations: ['Only a re-verified, signed human approval of the exact current artefact passes this gate; a valid schema or an agent statement never does.'] });

  // Every recorded approval is re-verified against the current content.
  const recs = designApprovals(wf, gate);
  const verified = recs.map((a) => ({ a, r: checkDesignApproval(wf, snap, { contract: 'signed-design-approval', statement: a.statement, signature: a.signature }, context, { existing: a }) }));
  const invalid = verified
    .filter((x) => x.a.decision === 'approved' && !x.r.ok)
    .map((x) => {
      const failed = x.r.checks.filter((c) => !c.ok);
      const causes = [...new Set(failed.map((c) => CAUSE[c.id]).filter(Boolean))].sort();
      const downstream = gate === 'G3' ? designApprovals(wf, 'G4').filter((d) => d.upstream_approval_ids.includes(x.a.approval_id)).map((d) => ({ gate: 'G4', approval_id: d.approval_id })) : [];
      return { gate, approval_id: x.a.approval_id, causes: causes.length ? causes : ['artifact_changed'], failed_checks: failed, downstream_impact: downstream, causes_sha256: digest({ approval_id: x.a.approval_id, causes }) };
    });
  for (const x of verified) inputs.push({ kind: 'design_approval', ref: x.a.approval_id, sha256: sha256File(wf.store.p(DESIGN_DIR, 'approvals', `${x.a.approval_id}.json`)) });
  if (context.artifact) inputs.push({ kind: `receipt:${context.artifact.agent}`, ref: context.artifact.receipt_id, sha256: context.artifact.sha256 });

  const prereq = spec.prerequisite!;
  const evaluation: any = { gate, scope: context.scope.scope, scope_sha256: context.scope.scope_sha256, artifact: context.artifact ? { receipt_id: context.artifact.receipt_id, sha256: context.artifact.sha256 } : null, validation: context.validation, approvals: verified.map((x) => ({ approval_id: x.a.approval_id, decision: x.a.decision, signer: x.a.signer.signer_id, role: x.a.signer.role, valid: x.r.ok, failed_checks: x.r.checks.filter((c) => !c.ok) })), valid_approval: null, co_approval_required: context.co_roles, story_order: context.story_order };
  if (!gatePassed(wf.state, prereq, wf.run.manifestSha256)) return { result: result('BLOCKED', `prerequisite ${prereq} has not passed on the current baseline`), evaluation, context, invalidations: invalid };
  checks.push({ id: 'upstream_approval', status: context.blocked ? 'fail' : 'pass', detail: context.blocked ?? `${context.upstream.map((u) => `${u.gate} ${u.approval_id}`).join(', ')} re-verified now` });
  if (context.blocked) return { result: result('BLOCKED', `upstream approval is not valid now: ${context.blocked}`), evaluation, context, invalidations: invalid };
  for (const c of context.validation.checks) checks.push({ id: c.id, status: c.ok ? 'pass' : 'fail', detail: c.detail });
  if (!context.artifact) return { result: result('NOT_RUN', `nothing to evaluate: no accepted ${gate === 'G3' ? 'F3 architecture' : 'F4 story'} output`), evaluation, context, invalidations: invalid };

  const roles = gate === 'G3' ? DESIGN_POLICY.G3.approver_roles : DESIGN_POLICY.G4.approver_roles;
  const valid = verified.filter((x) => x.r.ok);
  const primary = valid.filter((x) => x.a.decision === 'approved' && roles.includes(x.a.signer.role)).pop();
  const co = context.co_roles.length ? valid.filter((x) => x.a.decision === 'approved' && context.co_roles.includes(x.a.signer.role) && x.a.signer.signer_id !== primary?.a.signer.signer_id).pop() : null;
  const rejected = valid.filter((x) => x.a.decision === 'rejected' && x.a.artifact_sha256 === context.artifact!.sha256);
  checks.push({ id: 'human_approval', status: primary ? 'pass' : 'fail', detail: primary ? `${primary.a.approval_id} signed by ${primary.a.signer.signer_id} (${primary.a.signer.role}); re-verified against the current artefact` : verified.length ? `no valid approval by ${roles.join(' or ')}: ${verified.map((x) => `${x.a.approval_id} (${x.a.decision}, ${x.a.signer.role}): ${x.r.checks.filter((c) => !c.ok).map((c) => c.detail).join('; ') || 'not an approving role'}`).join(' | ')}` : `no signed ${gate} approval has been imported` });
  if (context.co_roles.length) checks.push({ id: 'co_approval', status: co ? 'pass' : 'fail', detail: co ? `${co.a.approval_id} signed by ${co.a.signer.signer_id} (${co.a.signer.role})` : `an ADR changes legacy behaviour: a separate approval by ${context.co_roles.join(' or ')} is required` });
  if (rejected.length) checks.push({ id: 'not_rejected', status: 'fail', detail: `rejected by ${rejected.map((x) => `${x.a.signer.signer_id} (${x.a.approval_id})`).join(', ')}` });
  checks.push({ id: 'trust_anchor', status: snap.trust.usable ? 'pass' : 'fail', detail: snap.trust.usable ? `trust store with ${snap.trust.signers.size} signer(s)` : snap.trust.problems.join('; ') || 'no trust store' });
  const failing = checks.filter((c) => c.status === 'fail');
  if (!failing.length && primary) {
    evaluation.valid_approval = primary.a.approval_id;
    return { result: result('PASS', `${gate === 'G3' ? 'architecture' : 'story set'} ${context.artifact.receipt_id} for ${context.scope.scope} approved by ${primary.a.signer.signer_id} (${primary.a.approval_id})${co ? ` and ${co.a.signer.signer_id} (${co.a.approval_id})` : ''}; bound to artefact ${context.artifact.sha256.slice(0, 16)}…`), evaluation, context, invalidations: invalid };
  }
  return { result: result('UNVERIFIED', `${gate} not approved for ${context.scope.scope}: failing checks ${failing.map((c) => c.id).join(', ')}`), evaluation, context, invalidations: invalid };
}

/** Seals invalidation records not already recorded with the same causes. Called under the workflow lock. */
export function sealInvalidations(wf: Workflow, list: any[]): string[] {
  const out: string[] = [];
  const existing = invalidations(wf);
  for (const x of list) {
    if (existing.some((e) => e.approval_id === x.approval_id && e.causes_sha256 === x.causes_sha256)) continue;
    const id = `INV-${String(wf.store.list(`${DESIGN_DIR}/invalidations`).length + 1).padStart(4, '0')}`;
    const rec = { contract: 'approval-invalidation', contract_version: '1.0', invalidation_id: id, detected_at: now(), ...x };
    const v = wf.run.ctx.contracts.validate('orchestrator/approval-invalidation', rec);
    if (!v.valid) throw new OrchestratorError('invalidation record violates its contract', 'CONTRACT', v.errors);
    const f = wf.store.writeRecord(`${DESIGN_DIR}/invalidations`, `${id}.json`, rec);
    wf.store.append('approval_invalidated', { invalidation_id: id, gate: x.gate, approval_id: x.approval_id, causes: x.causes, downstream: x.downstream_impact.map((d: any) => d.approval_id), sha256: sha256File(f) });
    out.push(id);
  }
  return out;
}
