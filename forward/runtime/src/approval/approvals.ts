/**
 * The G2 human approval boundary and the G2 gate evaluator.
 *
 *  1. `approval request` exports an immutable approval request for a READY
 *     scope: the exact baseline, the scope digest and the per-requirement
 *     outcomes and hashes, with a nonce, an expiry and the requester.
 *  2. A human signs the canonical approval statement (Ed25519) outside the
 *     harness with a key whose PUBLIC half is in the external trust store.
 *  3. `approval import` verifies the signature, the signer's role, that the
 *     signer is neither an agent nor the requester, that the request is
 *     intact, unexpired and unused, and that the scope is still READY with
 *     the same digest. Only then is a signed-approval record written.
 *  4. G2 PASSes only while such an approval re-verifies against the current
 *     content. Readiness alone never passes G2; nothing is approved from a
 *     CLI flag or an agent statement.
 */
import { randomBytes } from 'crypto';
import * as fs from 'fs';
import { sha256File } from '../core/fsutil';
import { GateCheck, gatePassed, GateResult, gateSpec, precheckPassed, validateApproval } from '../orchestrator/gates';
import { mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { canonicalize, digest } from './canonical';
import { evaluateScope, Finding, parseSelector, ScopeEvaluation, Selector, selectorText } from './scope';
import { buildSnapshot, Snapshot } from './snapshot';
import { AGENT_IDENTITY, scopeAllowed, verifySignature } from './trust';

const now = () => new Date().toISOString();

export function approvalRequests(wf: Workflow): any[] {
  return wf.store.list('approvals/requests').map((f) => wf.store.readRecord('approvals/requests', f));
}
export function approvalRecords(wf: Workflow): any[] {
  return wf.store.list('approvals').filter((f) => f.startsWith('APR-')).map((f) => wf.store.readRecord('approvals', f));
}
function sealedHashes(wf: Workflow, event: string, key: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of wf.store.readAudit()) if (e.event === event) m.set((e.data as any)[key], (e.data as any).sha256);
  return m;
}

/* ------------------------------------------------------------------ */
/* request                                                             */
/* ------------------------------------------------------------------ */

export function createApprovalRequest(wf: Workflow, scope: string, requestedBy: string): any {
  return mutate(wf, 'approval request', () => {
    if (!requestedBy || AGENT_IDENTITY.test(requestedBy)) throw new OrchestratorError(`approval requests must name a human requester (--requested-by); '${requestedBy}' is not acceptable`, 'USAGE');
    const snap = buildSnapshot(wf);
    const sel = parseSelector(scope);
    const ev = evaluateScope(snap, sel);
    if (ev.readiness !== 'READY') {
      wf.store.append('approval_request_refused', { scope: ev.selector_text, scope_sha256: ev.scope_sha256, blocking: ev.summary.blocking, integrity: ev.integrity.problems.slice(0, 10) });
      wf.store.writeState(wf.state);
      throw new OrchestratorError(`scope ${ev.selector_text} is not ready for approval: ${ev.summary.blocking} blocking finding(s)${ev.integrity.ok ? '' : `, integrity: ${ev.integrity.problems.slice(0, 3).join('; ')}`}`, 'NOT_READY', ev.findings.filter((f) => f.blocking).slice(0, 20).map((f) => `${f.outcome} ${f.kind} ${f.id}: ${f.reasons[0]}`));
    }
    const n = wf.store.list('approvals/requests').length + 1;
    const request_id = `AREQ-${String(n).padStart(4, '0')}`;
    const created = new Date();
    const payload = {
      contract: 'approval-request-payload',
      contract_version: '1.0',
      request_id,
      gate: 'G2',
      workflow_id: wf.state.workflow_id,
      run_id: wf.run.runId,
      baseline: { manifest_sha256: wf.run.manifestSha256, inputs: wf.state.baseline.inputs, per_program: wf.state.baseline.per_program },
      scope: {
        selector: ev.selector,
        selector_text: ev.selector_text,
        scope_sha256: ev.scope_sha256,
        units: ev.units.map((u) => ({ name: u.name, file_id: u.file_id, role: u.role, source_sha256: u.source_sha256 })),
        requirements: ev.findings.filter((f) => f.kind === 'requirement').map((f) => ({ id: f.id, sha256: f.sha256, outcome: f.outcome })),
        runtime_requirements: ev.findings.filter((f) => f.kind === 'runtime_requirement').map((f) => ({ id: f.id, sha256: f.sha256, outcome: f.outcome })),
        ...(ev.behaviour
          ? {
              behaviour: {
                program: ev.behaviour.closure.program,
                entry: ev.behaviour.closure.entry,
                range: ev.behaviour.closure.range,
                source: ev.behaviour.closure.source,
                closure_sha256: ev.behaviour.closure.sha256,
                items: ev.behaviour.items,
                applicable_decisions: ev.behaviour.decision_attribution.filter((d: any) => d.applicable).map((d: any) => ({ id: d.decision_id, sha256: d.sha256 })),
                excluded_decisions: ev.behaviour.decision_attribution.filter((d: any) => !d.applicable).map((d: any) => ({ id: d.decision_id, reason: d.reason })),
                deferred_gaps: ev.behaviour.gaps.map((g: any) => ({ gap_id: g.gap_id, in_closure: g.in_closure, blocking: g.blocking })),
                covers_only: `behaviour ${ev.behaviour.closure.entry} of ${ev.behaviour.closure.program}; approving it approves nothing else in ${ev.behaviour.closure.program}`,
              },
            }
          : {}),
        summary: ev.summary,
        excluded: { units: ev.excluded.units, requirements: ev.excluded.requirements.length, decisions: ev.excluded.decisions.length, rules: ev.excluded.rules },
        verification_digest: ev.verification.digest,
        provenance_policy: ev.provenance.policy,
      },
      policy_sha256: snap.policy_sha256,
      required_roles: snap.policy.roles.requirements_approval,
      approval_covers: 'Approval accepts the listed requirements (exact content hashes), their business interpretation, the listed exclusions and exceptions, and the scope boundary. It does not approve architecture or code.',
      requested_by: requestedBy,
      created_at: created.toISOString(),
      expires_at: new Date(created.getTime() + snap.policy.request_ttl_hours * 3600000).toISOString(),
      nonce: randomBytes(16).toString('hex'),
    };
    const rec = { contract: 'approval-request', contract_version: '1.0', request_id, request_sha256: digest(payload), payload };
    const v = wf.run.ctx.contracts.validate('orchestrator/approval-request', rec);
    if (!v.valid) throw new OrchestratorError('approval request violates its contract', 'CONTRACT', v.errors);
    const file = wf.store.writeRecord('approvals/requests', `${request_id}.json`, rec);
    wf.store.append('approval_requested', { request_id, request_sha256: rec.request_sha256, scope: ev.selector_text, scope_sha256: ev.scope_sha256, requested_by: requestedBy, expires_at: payload.expires_at, sha256: sha256File(file) });
    wf.store.writeState(wf.state);
    return { ...rec, file };
  });
}

/** The exact statement a signer signs (its canonical JSON text is the signed message). */
export function approvalStatement(request: any, signerId: string, role: string, decision: 'approved' | 'rejected', comment?: string): any {
  return {
    contract: 'approval-statement',
    statement_version: '1.0',
    gate: 'G2',
    request_id: request.request_id,
    request_sha256: request.request_sha256,
    scope_sha256: request.payload.scope.scope_sha256,
    baseline_manifest_sha256: request.payload.baseline.manifest_sha256,
    decision,
    signer_id: signerId,
    role,
    ...(comment ? { comment } : {}),
  };
}

export function statementText(statement: any): string {
  return canonicalize(statement);
}

/* ------------------------------------------------------------------ */
/* verification                                                        */
/* ------------------------------------------------------------------ */

export interface ApprovalCheck {
  id: string;
  ok: boolean;
  detail: string;
}

/** Checks a signed approval against the current state. `existing` is the APR record when re-verifying an imported approval. */
export function checkApproval(snap: Snapshot, signed: any, opts: { existing?: any; evaluations?: Map<string, ScopeEvaluation> } = {}): { ok: boolean; checks: ApprovalCheck[]; request: any | null; evaluation: ScopeEvaluation | null } {
  const wf = snap.wf;
  const checks: ApprovalCheck[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const v = wf.run.ctx.contracts.validate('orchestrator/signed-approval', signed);
  add('contract', v.valid, v.valid ? 'signed approval satisfies its contract' : v.errors.slice(0, 5).join('; '));
  if (!v.valid) return { ok: false, checks, request: null, evaluation: null };
  const st = signed.statement;
  const reqFile = wf.store.p('approvals', 'requests', `${st.request_id}.json`);
  if (!fs.existsSync(reqFile)) {
    add('request_exists', false, `approval request ${st.request_id} does not exist in this workflow`);
    return { ok: false, checks, request: null, evaluation: null };
  }
  const request = JSON.parse(fs.readFileSync(reqFile, 'utf8'));
  const sealed = sealedHashes(wf, 'approval_requested', 'request_id').get(st.request_id);
  const intact = sealed === sha256File(reqFile) && digest(request.payload) === request.request_sha256;
  add('request_intact', intact, intact ? `${st.request_id} matches the hash sealed in the audit log` : `${st.request_id} was altered after it was issued (tampered)`);
  const bound = st.request_sha256 === request.request_sha256 && st.scope_sha256 === request.payload.scope.scope_sha256 && st.baseline_manifest_sha256 === request.payload.baseline.manifest_sha256 && st.gate === 'G2';
  add('statement_binding', bound, bound ? 'statement binds the exact request, scope digest and baseline' : 'statement does not bind this request\'s digest, scope or baseline (scope mismatch)');
  const roles = snap.policy.roles.requirements_approval;
  const sig = verifySignature(snap.trust, st.signer_id, statementText(st), signed.signature.value, roles, snap.at);
  add('trust_anchor', snap.trust.usable, snap.trust.usable ? `trust store ${snap.trust.origin} (${String(snap.trust.sha256).slice(0, 16)}…) with ${snap.trust.signers.size} signer(s)` : snap.trust.problems.join('; '));
  add('signature', sig.ok, sig.ok ? `Ed25519 signature by ${st.signer_id} verified (key ${sig.signer!.fingerprint.slice(0, 16)}…)` : sig.problems.join('; '));
  add('role', roles.includes(st.role) && !!sig.signer?.roles.includes(st.role), roles.includes(st.role) ? (sig.signer?.roles.includes(st.role) ? `role ${st.role} is authorised` : `signer does not hold role ${st.role}`) : `role ${st.role} cannot approve requirements (needs ${roles.join(' or ')})`);
  const scopeOk = scopeAllowed(sig.signer, request.payload.scope.selector_text);
  add('signer_scope', scopeOk, scopeOk ? (sig.signer?.scopes ? `signer is authorised for ${request.payload.scope.selector_text}` : 'signer has no scope restriction') : `signer ${st.signer_id} is restricted to ${sig.signer!.scopes!.join(', ')}`);
  const self = AGENT_IDENTITY.test(st.signer_id) || (snap.policy.require_distinct_requester && st.signer_id === request.payload.requested_by);
  add('not_self_approval', !self, self ? `${st.signer_id} requested this approval or is an agent identity; self-approval is rejected` : `signer differs from the requester (${request.payload.requested_by})`);
  if (!opts.existing) {
    const t = snap.at.getTime();
    add('not_expired', t <= Date.parse(request.payload.expires_at), t <= Date.parse(request.payload.expires_at) ? `request valid until ${request.payload.expires_at}` : `request expired at ${request.payload.expires_at}`);
    const used = approvalRecords(wf).find((r) => r.request_id === st.request_id || r.signature?.value === signed.signature.value);
    add('not_replayed', !used, used ? `${used.approval_id} already consumed this request or signature (replay)` : 'request has not been used');
  } else {
    const sealedApr = sealedHashes(wf, 'approval_imported', 'approval_id').get(opts.existing.approval_id);
    const ok = sealedApr === sha256File(wf.store.p('approvals', `${opts.existing.approval_id}.json`));
    add('record_intact', ok, ok ? `${opts.existing.approval_id} matches the hash sealed in the audit log` : `${opts.existing.approval_id} was altered after import`);
  }
  const baseOk = request.payload.baseline.manifest_sha256 === wf.run.manifestSha256 && snap.g0.status === 'PASS';
  add('baseline_current', baseOk, baseOk ? 'baseline unchanged and intact (baseline pre-check PASS)' : `baseline changed or not intact (baseline pre-check ${snap.g0.status})`);
  let ev: ScopeEvaluation | null = null;
  try {
    const key = canonicalize(request.payload.scope.selector);
    ev = opts.evaluations?.get(key) ?? evaluateScope(snap, request.payload.scope.selector as Selector);
    opts.evaluations?.set(key, ev);
  } catch (e) {
    add('scope_current', false, `scope can no longer be evaluated: ${(e as Error).message}`);
  }
  if (ev) {
    add('scope_current', ev.scope_sha256 === request.payload.scope.scope_sha256, ev.scope_sha256 === request.payload.scope.scope_sha256 ? 'requirements, decisions, sources and evidence are unchanged since the request (same scope digest)' : `content changed since the request (stale): scope digest ${ev.scope_sha256.slice(0, 16)}… != ${String(request.payload.scope.scope_sha256).slice(0, 16)}…`);
    add('ready', ev.readiness === 'READY', ev.readiness === 'READY' ? 'scope is ready' : `scope is no longer ready: ${ev.summary.blocking} blocking finding(s)`);
  }
  return { ok: checks.every((c) => c.ok), checks, request, evaluation: ev };
}

export function verifyApprovalFile(wf: Workflow, file: string): any {
  const signed = readSigned(file);
  const snap = buildSnapshot(wf);
  const r = checkApproval(snap, signed);
  return { ok: r.ok, checks: r.checks, request_id: r.request?.request_id ?? null, decision: signed?.statement?.decision ?? null };
}

function readSigned(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new OrchestratorError(`cannot read signed approval ${file}: ${(e as Error).message}`, 'USAGE');
  }
}

export function importApproval(wf: Workflow, file: string): any {
  return mutate(wf, 'approval import', () => {
    const signed = readSigned(file);
    const snap = buildSnapshot(wf);
    const r = checkApproval(snap, signed);
    if (!r.ok) {
      wf.store.append('approval_rejected', { request_id: signed?.statement?.request_id ?? null, signer_id: signed?.statement?.signer_id ?? null, file_sha256: sha256File(file), problems: r.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`) });
      wf.store.writeState(wf.state);
      return { imported: false, checks: r.checks };
    }
    const n = wf.store.list('approvals').filter((f) => f.startsWith('APR-')).length + 1;
    const approval_id = `APR-${String(n).padStart(4, '0')}`;
    const sig = verifySignature(snap.trust, signed.statement.signer_id, statementText(signed.statement), signed.signature.value, [], snap.at);
    const rec = {
      contract: 'signed-approval-record',
      contract_version: '1.0',
      approval_id,
      gate: 'G2',
      decision: signed.statement.decision,
      recorded_at: now(),
      recorded_by: 'runtime',
      request_id: r.request.request_id,
      request_sha256: r.request.request_sha256,
      scope: { selector: r.request.payload.scope.selector, selector_text: r.request.payload.scope.selector_text, scope_sha256: r.request.payload.scope.scope_sha256 },
      baseline_manifest_sha256: r.request.payload.baseline.manifest_sha256,
      signer: { signer_id: signed.statement.signer_id, role: signed.statement.role, key_fingerprint: sig.signer!.fingerprint, display_name: sig.signer!.display_name },
      trust_store_sha256: snap.trust.sha256,
      statement: signed.statement,
      signature: signed.signature,
      verification: { checks: r.checks },
    };
    const v = wf.run.ctx.contracts.validate('orchestrator/signed-approval-record', rec);
    if (!v.valid) throw new OrchestratorError('approval record violates its contract', 'CONTRACT', v.errors);
    const f = wf.store.writeRecord('approvals', `${approval_id}.json`, rec);
    wf.store.append('approval_imported', { approval_id, request_id: rec.request_id, decision: rec.decision, signer: rec.signer.signer_id, scope_sha256: rec.scope.scope_sha256, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { imported: true, approval_id, decision: rec.decision, checks: r.checks };
  });
}

/* ------------------------------------------------------------------ */
/* G2 gate                                                             */
/* ------------------------------------------------------------------ */

const DRAFTED_OR_LATER = ['REQUIREMENTS_DRAFTED', 'REQUIREMENTS_APPROVED', 'ARCHITECTURE_DRAFTED', 'ARCHITECTURE_APPROVED', 'STORIES_DRAFTED', 'IMPLEMENTING', 'IMPLEMENTATION_BUILT', 'TESTING', 'REVIEWING', 'COMPLETED'];

/**
 * The finding sets behind each G2 evidence check. Shared with the STEP 4.5
 * count audit so the gate table and the reconciliation use one definition.
 * Sets overlap on purpose (e.g. a contradicted requirement is in both
 * requirement_evidence and contradicted_claims).
 */
export const G2_CHECK_SETS: Array<{ id: string; label: string; select: (F: Finding[]) => Finding[]; blockingOnly?: boolean }> = [
  { id: 'canonical_rule_coverage', label: 'canonical rules in scope (including cross-batch conflicts)', select: (F) => F.filter((f) => ['rule_coverage', 'reconciliation'].includes(f.category) && f.kind === 'rule') },
  { id: 'cross_batch_reconciliation', label: 'cross-batch consolidation and conflicts', select: (F) => F.filter((f) => f.category === 'reconciliation') },
  { id: 'requirement_evidence', label: 'requirements', select: (F) => F.filter((f) => f.category === 'requirement_evidence') },
  { id: 'runtime_evidence', label: 'runtime requirements and file operations', select: (F) => F.filter((f) => f.category === 'runtime_evidence') },
  { id: 'semantic_contradictions', label: 'recorded contradictions', select: (F) => F.filter((f) => f.category === 'contradiction') },
  { id: 'contradicted_claims', label: 'contradicted items', select: (F) => F.filter((f) => f.outcome === 'CONTRADICTED') },
  { id: 'blocking_decisions', label: 'decisions raised by agents', select: (F) => F.filter((f) => f.category === 'decision') },
  { id: 'data_contracts', label: 'data contracts and unit coverage', select: (F) => F.filter((f) => ['data_contract', 'coverage'].includes(f.category)) },
  { id: 'source_references', label: 'items with missing or unresolved source references', blockingOnly: true, select: (F) => F.filter((f) => f.blocking && f.reasons.some((r) => /source reference|not in the parser structure|not in the reverse inventory|no File ID/.test(r))) },
  { id: 'scoped_gaps', label: 'unaddressed gaps and unresolved dependencies', select: (F) => F.filter((f) => ['gap', 'dependency'].includes(f.category)) },
  { id: 'traceability', label: 'traceability breaks', blockingOnly: true, select: (F) => F.filter((f) => f.blocking && f.reasons.some((r) => /derived from|maps to|mapped to unknown/.test(r))) },
  { id: 'scope_classification', label: 'program scope decisions and packet completion', select: (F) => F.filter((f) => ['classification', 'packet'].includes(f.category)) },
  { id: 'provenance', label: 'provenance policy findings', select: (F) => F.filter((f) => f.category === 'provenance') },
];

function setCheck(id: string, F: Finding[]): GateCheck {
  const def = G2_CHECK_SETS.find((x) => x.id === id)!;
  const fs_ = def.select(F);
  const block = fs_.filter((f) => f.blocking);
  if (def.blockingOnly) return { id, status: block.length ? 'fail' : 'pass', detail: `${block.length} ${def.label}${block.length ? `: ${block.slice(0, 3).map((f) => f.id).join(', ')}` : ''}` };
  const by: Record<string, number> = {};
  for (const f of fs_) by[f.outcome] = (by[f.outcome] ?? 0) + 1;
  return { id, status: block.length ? 'fail' : 'pass', detail: `${def.label}: ${fs_.length} item(s) ${JSON.stringify(by)}${block.length ? `; blocking e.g. ${block.slice(0, 3).map((f) => `${f.id} (${f.outcome})`).join(', ')}` : ''}` };
}

/** Evaluates G2 for the workflow. Pure: the caller records the gate result and the evaluation. */
export function evaluateG2Gate(wf: Workflow, at = new Date()): { result: GateResult; evaluation: any | null } {
  const spec = gateSpec('G2')!;
  const baseResult = (status: GateResult['status'], reason: string, extra: Partial<GateResult> = {}): GateResult => ({
    contract: 'gate-result',
    contract_version: '1.0',
    gate: 'G2',
    name: spec.name,
    status,
    reason,
    evaluated_at: at.toISOString(),
    evaluator: 'implemented',
    baseline: { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 },
    inputs: [{ kind: 'baseline_manifest', ref: wf.state.baseline.manifest_path, sha256: wf.run.manifestSha256 }],
    checks: [],
    limitations: [],
    ...extra,
  });
  if (!precheckPassed(wf.state, 'EVIDENCE', wf.run.manifestSha256)) return { result: baseResult('BLOCKED', 'the evidence pre-check has not passed on the current baseline'), evaluation: null };
  const snap = buildSnapshot(wf, at);
  const checks: GateCheck[] = [];
  const inputs: GateResult['inputs'] = [];
  checks.push({ id: 'baseline_integrity', status: snap.g0.status === 'PASS' ? 'pass' : 'fail', detail: snap.g0.status === 'PASS' ? 'baseline manifest and reverse inputs unchanged (baseline pre-check re-evaluated)' : `baseline pre-check ${snap.g0.status}: ${snap.g0.reason}` });
  const drafted = DRAFTED_OR_LATER.includes(String(wf.state.state)) || (wf.state.state === 'BLOCKED' && DRAFTED_OR_LATER.includes(String(wf.state.blocked_from)));
  checks.push({ id: 'requirements_drafted', status: drafted ? 'pass' : 'fail', detail: drafted ? `workflow state ${wf.state.state}` : `workflow state is ${wf.state.state}; G2 approval needs REQUIREMENTS_DRAFTED (readiness is reported for information only)` });
  for (const r of snap.receipts) inputs.push({ kind: `receipt:${r.receipt.agent}`, ref: r.receipt_id, sha256: snap.integrity.receipt_hashes.find((x) => x.receipt_id === r.receipt_id)?.sha256 ?? null });

  // Approvals: every imported approval is re-verified against the current content.
  const evaluations = new Map<string, ScopeEvaluation>();
  const aprs = approvalRecords(wf).map((a) => ({ a, r: checkApproval(snap, { contract: 'signed-approval', statement: a.statement, signature: a.signature }, { existing: a, evaluations }) }));
  const valid = aprs.filter((x) => x.r.ok && x.a.decision === 'approved');
  const chosen = valid.length ? valid[valid.length - 1] : null;
  const lastApr = aprs.length ? aprs[aprs.length - 1] : null;
  const sel: Selector = chosen ? chosen.a.scope.selector : lastApr ? lastApr.a.scope.selector : parseSelector(snap.policy.g2.default_scope);
  const ev = evaluations.get(canonicalize(sel)) ?? evaluateScope(snap, sel);
  inputs.push({ kind: 'trust_store', ref: snap.trust.file ?? '(none configured)', sha256: snap.trust.sha256 });
  for (const x of aprs) inputs.push({ kind: 'approval', ref: x.a.approval_id, sha256: sha256File(wf.store.p('approvals', `${x.a.approval_id}.json`)) });

  const F = ev.findings;
  checks.push({ id: 'deliverable_integrity', status: ev.integrity.ok ? 'pass' : 'fail', detail: ev.integrity.ok ? 'accepted deliverables and receipts are unchanged since acceptance' : ev.integrity.problems.slice(0, 5).join(' | ') });
  for (const id of ['canonical_rule_coverage', 'cross_batch_reconciliation', 'requirement_evidence', 'runtime_evidence', 'semantic_contradictions', 'contradicted_claims', 'blocking_decisions', 'data_contracts', 'source_references', 'scoped_gaps', 'traceability', 'scope_classification']) checks.push(setCheck(id, F));
  checks.push({ id: 'provenance_policy', status: F.some((f) => f.category === 'provenance' && f.blocking) ? 'fail' : 'info', detail: ev.provenance.policy });
  checks.push({ id: 'readiness', status: ev.readiness === 'READY' ? 'pass' : 'fail', detail: `scope ${ev.selector_text}: ${ev.readiness} — ${ev.summary.blocking} blocking finding(s); outcomes ${JSON.stringify(ev.summary.by_outcome)}; scope digest ${ev.scope_sha256}` });
  checks.push({ id: 'trust_anchor', status: snap.trust.usable ? 'pass' : 'fail', detail: snap.trust.usable ? `trust store (${snap.trust.origin}) ${String(snap.trust.sha256).slice(0, 16)}… with ${snap.trust.signers.size} signer(s)` : `no usable trust anchor: ${snap.trust.problems.join('; ')}` });
  const legacy = wf.store.list('approvals').filter((f) => !f.startsWith('APR-')).map((f) => ({ f, r: wf.store.readRecord('approvals', f) })).filter((x) => x.r?.gate === 'G2');
  const legacyNote = legacy.length ? `; ignored ${legacy.length} unsigned approval-record file(s): ${legacy.map((x) => `${x.f}: ${[...validateApproval(x.r, 'G2', wf.store), 'not a signed approval'].join(', ')}`).join(' | ')}` : '';
  checks.push({
    id: 'human_approval',
    status: chosen ? 'pass' : 'fail',
    detail: chosen
      ? `${chosen.a.approval_id} signed by ${chosen.a.signer.signer_id} (${chosen.a.signer.role}) for scope ${chosen.a.scope.selector_text}; re-verified against current content`
      : `${aprs.length ? `no imported approval is valid now: ${aprs.map((x) => `${x.a.approval_id} (${x.a.decision}): ${x.r.checks.filter((c) => !c.ok).map((c) => c.detail).join('; ') || 'decision is not approved'}`).join(' | ')}` : 'no signed human approval has been imported'}${legacyNote}`,
  });

  const evaluation = { ...ev, gate_checks: checks, approvals: aprs.map((x) => ({ approval_id: x.a.approval_id, decision: x.a.decision, valid: x.r.ok, failed_checks: x.r.checks.filter((c) => !c.ok) })) };
  let status: GateResult['status'];
  let reason: string;
  if (snap.g0.status !== 'PASS' || !ev.integrity.ok) {
    status = 'FAIL';
    reason = `evidence base is not intact: ${[...(snap.g0.status !== 'PASS' ? [snap.g0.reason] : []), ...ev.integrity.problems].slice(0, 3).join(' | ')}`;
  } else if (chosen && ev.readiness === 'READY' && checks.every((c) => c.status !== 'fail')) {
    status = 'PASS';
    reason = `requirements scope ${ev.selector_text} is ready and approved by ${chosen.a.signer.signer_id} (${chosen.a.approval_id}); approval bound to scope digest ${ev.scope_sha256}`;
  } else {
    status = 'UNVERIFIED';
    const why = checks.filter((c) => c.status === 'fail').map((c) => c.id);
    reason = `G2 not approved for scope ${ev.selector_text}: ${ev.readiness}${ev.readiness === 'NOT_READY' ? ` (${ev.summary.blocking} blocking finding(s))` : ''}; failing checks: ${why.join(', ')}`;
  }
  const limitations = [
    'READY means the scope may be presented for a decision; only a re-verified signed human approval passes G2.',
    'A verified source citation shows the cited source text exists; the business interpretation is what the human approves.',
  ];
  if (!snap.ctx.srcRoot) limitations.push('Original COBOL source is not configured: no claim can be independently verified.');
  return { result: baseResult(status, reason, { checks, inputs: [...baseResult(status, reason).inputs, ...inputs], limitations }), evaluation };
}

export function evaluateScopeText(wf: Workflow, scope: string): ScopeEvaluation {
  return evaluateScope(buildSnapshot(wf), parseSelector(scope));
}

export { selectorText };
