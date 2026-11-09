/**
 * Scope readiness from the existing G1 evaluator (no separate policy): the
 * application, every discovered program, every shared-dependency scope (the
 * programs that share a copybook) and every requirement. Each scope's
 * blockers are split into scope-specific and shared ones and into source
 * evidence defects, SME decisions, technical decisions and approval
 * prerequisites. Grouping by root cause is reported but never changes the
 * gate's READY/NOT_READY.
 */
import { evaluateScope, Finding, ScopeEvaluation, Selector } from '../approval/scope';
import { Snapshot } from '../approval/snapshot';
import { ITEM_KINDS } from './audit';
import { Registry } from './rootcauses';

function classifyFinding(snap: Snapshot, f: Finding): 'source_evidence_defect' | 'sme_decision' | 'technical_decision' | 'other' {
  if (ITEM_KINDS.includes(f.kind) || f.kind === 'contradiction' || (f.kind === 'rule' && f.outcome !== 'REQUIRES_SME_DECISION') || f.kind.startsWith('coverage') || f.kind === 'packet' || f.kind.endsWith('dependency')) return f.outcome === 'REQUIRES_SME_DECISION' ? 'sme_decision' : 'source_evidence_defect';
  const d = snap.register.get(f.id);
  if (d) return ['technical', 'data_layout', 'runtime_semantics'].includes(d.kind) ? 'technical_decision' : 'sme_decision';
  if (f.kind === 'rule') return 'sme_decision';
  return 'other';
}

export function scopeRow(snap: Snapshot, reg: Registry, label: string, kind: string, ev: ScopeEvaluation) {
  const primary = new Set(ev.units.filter((u) => u.role === 'primary').map((u) => u.name));
  const blockers = ev.findings.filter((f) => f.blocking);
  const split = { specific: 0, shared: 0 };
  const by: Record<string, number> = { source_evidence_defect: 0, sme_decision: 0, technical_decision: 0, other: 0 };
  const roots = new Set<string>();
  for (const f of blockers) {
    const shared = f.units.some((u) => !primary.has(u)) || !f.units.length;
    split[shared ? 'shared' : 'specific']++;
    by[classifyFinding(snap, f)]++;
    const k = reg.findingRoots.get(`${f.kind}|${f.id}`)?.[0];
    if (k) roots.add(reg.byKey.get(k)?.root_cause_id ?? k);
  }
  const approvalPrereqs = reg.roots.filter((r) => r.category === 'approval_prerequisite').map((r) => r.title);
  return {
    scope: ev.selector_text,
    label,
    kind,
    readiness: ev.readiness,
    scope_sha256: ev.scope_sha256,
    units: ev.units.length,
    dependencies: ev.units.filter((u) => u.role === 'dependency').map((u) => u.name),
    blocking_findings: blockers.length,
    blockers_specific_to_scope: split.specific,
    blockers_shared_with_other_scopes: split.shared,
    source_evidence_defects: by.source_evidence_defect,
    sme_decisions: by.sme_decision,
    technical_decisions: by.technical_decision,
    other: by.other,
    approval_prerequisites: approvalPrereqs,
    distinct_root_causes: roots.size,
    requirements: ev.summary.requirements,
    integrity_ok: ev.integrity.ok,
  };
}

export function scopeReadiness(snap: Snapshot, reg: Registry, opts: { requirements?: boolean } = {}): any {
  const rows: any[] = [];
  const run = (label: string, kind: string, sel: Selector) => rows.push(scopeRow(snap, reg, label, kind, evaluateScope(snap, sel)));
  run('application', 'application', { kind: 'application' });
  for (const p of snap.sys.programs) run(p.program_id, 'program', { kind: 'programs', programs: [p.program_id] });
  for (const c of snap.sys.copybooks) {
    const users = [...new Set(c.used_by.filter((u) => snap.sys.programs.some((p) => p.program_id === u)))].sort();
    if (c.file_id && users.length > 1) run(`shared:${c.name}`, 'shared_dependency', { kind: 'programs', programs: users });
  }
  if (opts.requirements !== false) for (const it of snap.items.filter((i) => i.kind === 'requirement')) run(it.id, 'requirement', { kind: 'requirements', requirement_ids: [it.id] });
  const tally = (k: string) => rows.filter((r) => r.kind === k).reduce((m: Record<string, number>, r) => ((m[r.readiness] = (m[r.readiness] ?? 0) + 1), m), {});
  return {
    contract: 'scope-readiness',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: snap.wf.run.manifestSha256,
    evaluator: 'the STEP 4 G1 scope evaluator (unchanged policy); READY is never approval',
    trust_anchor_usable: snap.trust.usable,
    summary: { application: tally('application'), programs: tally('program'), shared_dependency_scopes: tally('shared_dependency'), requirements: tally('requirement') },
    scopes: rows,
  };
}
