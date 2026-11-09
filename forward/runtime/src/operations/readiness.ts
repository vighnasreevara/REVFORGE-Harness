/**
 * G2 approval readiness checklist for one scope (STEP 8). Readiness and
 * approval stay separate: even when every finding is supported, G2 passes
 * only on a re-verified signed human approval. This checklist shows the
 * exact human work left, who may sign it, the current trust configuration,
 * the requirement content hashes an approval would bind, what forces
 * re-approval, and the commands for each step. It never resolves, signs or
 * approves anything.
 */
import { evaluateG2Gate } from '../approval/approvals';
import { evaluateScope, parseSelector, selectorText } from '../approval/scope';
import { requiredRoles } from '../approval/decisions';
import { analyse, Analysis } from '../blockers/pipeline';
import { gatePassed } from '../orchestrator/gates';
import { Workflow } from '../orchestrator/orchestrator';
import { allowedTargets } from '../orchestrator/states';
import { reconcileScope } from '../bmad/reconcile';
import { correctionReview } from '../workbench/workbench';
import { trustDoctor } from './trust';
import { sharedImpact } from './decisions';

export function approvalReadiness(wf: Workflow, scope: string, a: Analysis = analyse(wf)): any {
  const snap = a.snap;
  const sel = selectorText(parseSelector(scope));
  const ev = evaluateScope(snap, parseSelector(sel));
  const rec = reconcileScope(snap, sel, ev);
  const trust = trustDoctor(wf.run.ctx);
  const corrections = correctionReview(a, sel);
  const g2 = evaluateG2Gate(wf, snap.at);
  const g2ForScope = g2.result.status === 'PASS' && g2.evaluation?.selector_text === ev.selector_text;
  const signersFor = (roles: string[]) => trust.roles.filter((r) => roles.includes(r.role)).flatMap((r) => r.signers);

  const decisions = rec.decisions.filter((d) => d.effective_blocking).map((d) => {
    const reg = snap.register.get(d.id)!;
    const outcomes = reg.allowed_outcomes.map((o) => ({ outcome: o, roles: requiredRoles(snap, reg.kind, o), signers_available: signersFor(requiredRoles(snap, reg.kind, o)) }));
    return { decision_id: d.id, kind: d.kind, class: d.class, inclusion_reason: d.reason, status: d.status, outcomes, can_be_signed_now: outcomes.some((o) => o.signers_available.length > 0), commands: [`decisions export-request --decision ${d.id} --scope ${sel} --out ${d.id}.request.json`, `(the authorised signer completes and signs it outside REVFORGE)`, `decisions verify-resolution --file ${d.id}.signed.json`, `decisions import-resolution --file ${d.id}.signed.json`] };
  });
  const outstanding = ev.findings.filter((f) => f.blocking && (f.kind === 'requirement' || f.kind === 'runtime_requirement' || f.kind === 'data_record' || f.kind === 'file_operations')).map((f) => ({ id: f.id, kind: f.kind, outcome: f.outcome, reasons: f.reasons, decisions: f.decisions }));
  const shared = rec.decisions.filter((d) => d.class === 'cross_scope' || d.class === 'shared_dependency').map((d) => ({ decision_id: d.id, class: d.class, blocking: d.effective_blocking, units_outside_scope: d.units_outside_scope, other_scopes_affected: sharedImpact(snap, snap.register.get(d.id)!.affected_units.map((u) => u.name)).filter((s) => s.scope !== sel).map((s) => s.scope) }));
  const reqHashes = ev.findings.filter((f) => f.kind === 'requirement' || f.kind === 'runtime_requirement').map((f) => ({ id: f.id, kind: f.kind, outcome: f.outcome, sha256: snap.itemById.get(f.id)?.sha256 ?? null }));
  const ready = ev.readiness === 'READY';
  const trusted = trust.status === 'TRUST_CONFIGURED' || (trust.status === 'TRUST_INCOMPLETE' && trust.roles.filter((r) => r.covered).length > 0);
  const transitions = allowedTargets(wf.state.state as any, wf.state.blocked_from).filter((t) => t.to !== 'BLOCKED' && t.to !== 'FAILED').map((t) => ({ to: t.to, guard: t.guard.kind === 'gate' ? `gate ${t.guard.gate}` : t.guard.kind === 'receipt' ? `receipt ${t.guard.agent}` : t.guard.kind, satisfied: t.guard.kind === 'gate' ? gatePassed(wf.state, t.guard.gate, wf.run.manifestSha256) : null }));
  const step = (n: number, actor: string, action: string, status: 'DONE' | 'PENDING' | 'BLOCKED', detail: string) => ({ step: n, actor, action, status, detail });
  const steps = [
    step(1, 'key custodian', 'provision the external trust store with real signers for the required roles', trust.status === 'TRUST_CONFIGURED' ? 'DONE' : 'PENDING', `${trust.status}${trust.roles.filter((r) => !r.covered).length ? `; uncovered roles: ${trust.roles.filter((r) => !r.covered).map((r) => r.role).join(', ')}` : ''}`),
    step(2, 'technical reviewer', 'review and authorise (or reject) each source-citation correction, then apply it', corrections.proposals.length ? 'PENDING' : 'DONE', corrections.proposals.length ? corrections.proposals.map((p: any) => `${p.proposal_id} ${p.item} ${p.pointer}: ${p.original_value} -> ${p.proposed_value} (re-verified now: ${p.verified_now}; ${p.authorization.decision} ${p.authorization.decision_status})`).join(' | ') : 'no pending correction'),
    step(3, 'business SME / technical authority / exception approver', 'sign a resolution for every blocking decision', decisions.length ? (trusted ? 'PENDING' : 'BLOCKED') : 'DONE', decisions.length ? `${decisions.length} blocking decision(s): ${decisions.map((d) => `${d.decision_id} (${[...new Set(d.outcomes.flatMap((o) => o.roles))].join('/')})`).join(', ')}` : 'none'),
    step(4, 'operator', 're-evaluate the scope after every import or correction (content hashes change; stale resolutions must be re-decided)', ready ? 'DONE' : 'PENDING', `scope ${sel}: ${ev.readiness}, ${ev.summary.blocking} blocking finding(s), digest ${ev.scope_sha256.slice(0, 16)}…`),
    step(5, 'operator', 'export the G2 approval request (only for a READY scope)', ready ? 'PENDING' : 'BLOCKED', ready ? `approval export-request --scope ${sel} --requested-by <operator>` : 'scope is not READY'),
    step(6, 'requirements approver', 'review the request and sign the approval statement outside REVFORGE', ready && trusted ? 'PENDING' : 'BLOCKED', 'role requirements_approver; must not be the requester'),
    step(7, 'operator', 'verify and import the signed approval, re-evaluate G2', g2ForScope ? 'DONE' : 'BLOCKED', 'approval verify --file signed.json; approval import --file signed.json; workflow gate --gate G2'),
    step(8, 'operator', 'advance to REQUIREMENTS_APPROVED (re-evaluates G2 at the transition)', g2ForScope ? 'PENDING' : 'BLOCKED', 'workflow advance --to REQUIREMENTS_APPROVED'),
  ];
  return {
    contract: 'g2-approval-readiness',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    scope: sel,
    scope_sha256: ev.scope_sha256,
    baseline_manifest_sha256: wf.run.manifestSha256,
    workflow_state: wf.state.state,
    readiness: ev.readiness,
    blocking_findings: ev.summary.blocking,
    g2: { status: g2.result.status, for_this_scope: g2ForScope, reason: g2.result.reason },
    trust: { status: trust.status, roles: trust.roles.map((r) => ({ role: r.role, covered: r.covered, signers: r.signers })) },
    required_decisions: decisions,
    citation_corrections: corrections.proposals,
    outstanding_evidence: outstanding,
    shared_dependencies: shared,
    requirement_hashes: reqHashes,
    reapproval_rules: [
      'Any signed resolution, applied correction, source edit, baseline change or policy change alters the scope digest; a pending approval request then becomes stale and a new one must be exported.',
      'A correction gives the requirement a new content hash: its review decision becomes stale and must be decided again on the corrected content.',
      'A resolution is bound to the decision content and the affected item hashes; if either changes before import, it is rejected.',
      'An imported approval is re-verified at every G2 evaluation; when its content changes, G2 stops passing and a G3 approval built on it is invalidated.',
    ],
    allowed_next_transitions: transitions,
    steps,
    approval_possible_now: ready && trusted,
    note: 'Readiness is not approval: G2 passes only on a re-verified signed approval by a requirements approver.',
  };
}
