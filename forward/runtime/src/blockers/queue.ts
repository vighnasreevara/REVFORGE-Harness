/**
 * Human review queue: one entry per blocking root cause (not per decision),
 * classified by what is needed next:
 *   A  deterministically verifiable technical issue (the source settles a fact)
 *   B  interpretation needing independent semantic review (prepared for Step 5)
 *   C  genuine business decision (business SME)
 *   D  technical / architecture decision (technical authority)
 *   E  missing source or dependency (needs material that is not in the checkout)
 *   Z  approval prerequisite (trust anchor, signed approval)
 * The full decision view stays available unchanged; this queue only orders
 * the work. Nothing in it is resolved or authorised.
 */
import { Snapshot } from '../approval/snapshot';
import { Registry, RootCause } from './rootcauses';

const SEV = ['critical', 'high', 'medium', 'low'];

export function classify(r: RootCause, res: any): { class: string; label: string; readiness: string } {
  if (r.category === 'approval_prerequisite') return { class: 'Z', label: 'approval prerequisite', readiness: 'awaiting_trust_provisioning_and_ready_scope' };
  if (r.category === 'missing_source_or_dependency' && (res?.status === 'EXTERNAL_DEPENDENCY_MISSING' || res?.next_step === 'REQUIRES_SOURCE')) return { class: 'E', label: 'missing source or dependency', readiness: 'awaiting_source_or_documentation' };
  if (res?.next_step === 'REQUIRES_SOURCE' || res?.status === 'EXTERNAL_DEPENDENCY_MISSING') return { class: 'E', label: 'missing source or dependency', readiness: 'awaiting_source_or_documentation' };
  if (res?.next_step === 'REQUIRES_PROPOSAL_REVIEW' || (['incorrect_source_citation', 'data_layout_inconsistency', 'missing_evidence'].includes(r.category) && ['VERIFIED_DETERMINISTICALLY', 'CONTRADICTED_BY_SOURCE', 'SOURCE_CITATION_CORRECTED'].includes(res?.status) && res?.next_step !== 'REQUIRES_INDEPENDENT_SEMANTIC_REVIEW')) return { class: 'A', label: 'deterministically verifiable technical issue', readiness: res?.executed ? 'ready_for_technical_review' : 'awaiting_source_check' };
  if (res?.next_step === 'REQUIRES_INDEPENDENT_SEMANTIC_REVIEW') return { class: 'B', label: 'interpretation needing independent semantic review', readiness: 'awaiting_independent_semantic_review' };
  if (res?.next_step === 'REQUIRES_BUSINESS_SME') return { class: 'C', label: 'business decision', readiness: res?.executed ? 'ready_for_human_decision' : 'evidence_incomplete' };
  return { class: 'D', label: 'technical or architecture decision', readiness: res?.executed ? 'ready_for_human_decision' : 'evidence_incomplete' };
}

export function functionalArea(snap: Snapshot, programs: string[]): string {
  const dirs = new Set<string>();
  for (const p of programs) {
    const rec = snap.sys.programs.find((x) => x.program_id === p);
    const parts = (rec?.relative_path ?? '').split('/');
    if (parts.length > 1) dirs.add(parts[parts.length - 2]);
  }
  return dirs.size ? [...dirs].sort().join('+') : 'system-wide';
}

export function buildQueue(snap: Snapshot, reg: Registry, det: any): any {
  const res = new Map<string, any>(det.results.map((r: any) => [r.root_cause_id, r]));
  const entries = reg.roots.filter((r) => r.blocking).map((r) => {
    const x = res.get(r.root_cause_id);
    const c = classify(r, x);
    return {
      root_cause_id: r.root_cause_id,
      class: c.class,
      class_label: c.label,
      title: r.title,
      category: r.category,
      functional_area: functionalArea(snap, r.impacted_programs),
      programs: r.impacted_programs,
      evidence_quality: x?.status ?? 'not_checked',
      deterministic_next_step: x?.next_step ?? null,
      establishes: x?.establishes ?? null,
      severity: r.severity,
      required_authority: r.required_authority,
      downstream_impact: { decisions: r.related.decisions.length, blocking_findings: r.approval_scope_impact.application_blocking_findings, requirements: r.related.requirements.length, data_contracts: r.related.data_contracts.length, program_scopes_blocked: r.approval_scope_impact.program_scopes_blocked.length },
      decisions: r.related.decisions,
      readiness_for_review: c.readiness,
      resolution_status: r.resolution_status,
    };
  });
  entries.sort((a, b) => a.class.localeCompare(b.class) || SEV.indexOf(a.severity) - SEV.indexOf(b.severity) || b.downstream_impact.blocking_findings - a.downstream_impact.blocking_findings || (a.root_cause_id < b.root_cause_id ? -1 : 1));
  const tally = (f: (e: any) => string) => entries.reduce((m: Record<string, number>, e) => ((m[f(e)] = (m[f(e)] ?? 0) + 1), m), {});
  const decisionsByClass: Record<string, number> = {};
  for (const e of entries) decisionsByClass[e.class] = (decisionsByClass[e.class] ?? 0) + e.decisions.length;
  return {
    contract: 'decision-review-queue',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: snap.wf.run.manifestSha256,
    classes: { A: 'deterministically verifiable technical issues', B: 'interpretation disagreements for independent semantic review (Step 5)', C: 'genuine business decisions', D: 'technical / architecture decisions', E: 'missing source or dependency', Z: 'approval prerequisites' },
    rule: 'One entry per blocking root cause. Every decision stays in the full decision view; nothing here is resolved or authorised.',
    summary: { entries: entries.length, by_class: tally((e) => e.class), decisions_linked_by_class: decisionsByClass, by_readiness: tally((e) => e.readiness_for_review), by_area: tally((e) => e.functional_area), full_decision_view_size: snap.register.size },
    queue: entries.map((e, i) => ({ position: i + 1, ...e })),
  };
}
