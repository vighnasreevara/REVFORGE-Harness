/**
 * Scope reconciliation (STEP 7). Explains every item a scope contributes to a
 * BMad mapping: which units are primary, which are direct or transitive
 * dependencies, and why each requirement, runtime requirement, data contract,
 * rule and decision is included. The scope membership itself is the G1 scope
 * evaluator's (it decides what G1 approves); this module never changes it,
 * it only classifies and explains it, so the mapping can tell direct items
 * from shared-dependency, cross-scope and system-wide (global) ones and
 * blocking from non-blocking decisions.
 */
import { evaluateScope, parseSelector, ScopeEvaluation } from '../approval/scope';
import { Snapshot } from '../approval/snapshot';
import { digest } from '../approval/canonical';

export type UnitRelation = 'primary' | 'direct_dependency' | 'transitive_dependency';
export type DecisionClass = 'direct' | 'shared_dependency' | 'cross_scope' | 'global';

export interface ReconciledUnit {
  name: string;
  unit_kind: string;
  file_id: string;
  relation: UnitRelation;
  needed_by: string[];
  via: string[];
  source_sha256: string | null;
}

export interface ReconciledItem {
  id: string;
  kind: string;
  outcome: string;
  blocking: boolean;
  usable: boolean;
  units: string[];
  inclusion: 'direct' | 'shared_dependency';
  reason: string;
  record_sha256: string | null;
}

export interface ReconciledDecision {
  id: string;
  kind: string | null;
  blocking: boolean;
  status: string;
  effective_blocking: boolean;
  class: DecisionClass;
  reason: string;
  via: string[];
  units_in_scope: string[];
  units_outside_scope: string[];
  requirements_in_scope: string[];
  origin: string;
}

export interface Reconciliation {
  contract: 'bmad/scope-reconciliation';
  contract_version: '1.0';
  scope: string;
  scope_sha256: string;
  baseline: { run_id: string; manifest_sha256: string };
  units: ReconciledUnit[];
  requirements: ReconciledItem[];
  runtime_requirements: ReconciledItem[];
  data_contracts: ReconciledItem[];
  rules: Array<{ id: string; outcome: string; requirement_ids: string[]; source_run: string | null }>;
  decisions: ReconciledDecision[];
  excluded: { requirements: number; decisions: number; rules: number; units: Array<{ name: string; reason: string }>; sample: Array<{ id: string; reason: string }> };
  unique_ids: { duplicates: string[]; ok: boolean };
  summary: Record<string, number>;
  reconciliation_sha256: string;
}

const USABLE = new Set(['VERIFIED', 'APPROVED_EXCEPTION']);

export function reconcileScope(snap: Snapshot, scope: string, ev: ScopeEvaluation = evaluateScope(snap, parseSelector(scope))): Reconciliation {
  const byProg = new Map(snap.sys.programs.map((p) => [p.program_id, p]));
  const primary = new Set(ev.units.filter((u) => u.role === 'primary').map((u) => u.name));
  const inScope = new Set(ev.units.map((u) => u.name));

  // Dependency relations from the same include / call edges the scope closure follows.
  const neededBy = new Map<string, Set<string>>();
  const via = new Map<string, Set<string>>();
  for (const u of ev.units) {
    const p = byProg.get(u.name);
    if (!p) continue;
    for (const e of [...(p.includes ?? []), ...(p.calls_out ?? [])]) {
      if (!inScope.has(e.to) || e.to === u.name) continue;
      (neededBy.get(e.to) ?? neededBy.set(e.to, new Set()).get(e.to)!).add(u.name);
      (via.get(e.to) ?? via.set(e.to, new Set()).get(e.to)!).add(e.type);
    }
  }
  const units: ReconciledUnit[] = ev.units.map((u) => {
    const nb = [...(neededBy.get(u.name) ?? [])].sort();
    const relation: UnitRelation = u.role === 'primary' ? 'primary' : nb.some((n) => primary.has(n)) ? 'direct_dependency' : 'transitive_dependency';
    return { name: u.name, unit_kind: u.unit_kind, file_id: u.file_id, relation, needed_by: nb, via: [...(via.get(u.name) ?? [])].sort(), source_sha256: u.source_sha256 };
  });
  const relationOf = new Map(units.map((u) => [u.name, u.relation]));

  const items = (kinds: string[]): ReconciledItem[] =>
    ev.findings
      .filter((f) => kinds.includes(f.kind) && f.outcome !== 'EXCLUDED_WITH_JUSTIFICATION')
      .map((f) => {
        const i = snap.itemById.get(f.id);
        const names = i ? i.units.map((x) => x.name) : f.units;
        const direct = names.some((n) => primary.has(n));
        return {
          id: f.id,
          kind: f.kind,
          outcome: f.outcome,
          blocking: f.blocking,
          usable: USABLE.has(f.outcome),
          units: names,
          inclusion: direct ? ('direct' as const) : ('shared_dependency' as const),
          reason: direct ? `belongs to primary unit ${names.filter((n) => primary.has(n)).join(', ')}` : `belongs to ${names.map((n) => `${n} (${relationOf.get(n) ?? 'outside'}, needed by ${[...(neededBy.get(n) ?? [])].join(', ') || '?'})`).join(', ')}`,
          record_sha256: i?.sha256 ?? f.sha256,
        };
      })
      .sort((a, b) => (a.id < b.id ? -1 : 1));

  const srcRun = Object.keys(snap.wf.run.manifest?.source_runs ?? {}).find((r) => r.startsWith('rules@')) ?? null;
  const rules = [...new Set(ev.findings.filter((f) => f.kind === 'rule').map((f) => f.id))].sort().map((id) => ({
    id,
    outcome: ev.findings.find((f) => f.kind === 'rule' && f.id === id)!.outcome,
    requirement_ids: [...new Set((snap.ruleEntries.get(id) ?? []).flatMap((e) => e.requirement_ids))].sort(),
    source_run: srcRun,
  }));

  const reqIds = new Set(ev.findings.filter((f) => f.kind === 'requirement').map((f) => f.id));
  const decVia = new Map<string, string[]>();
  for (const f of ev.findings) for (const d of f.decisions) (decVia.get(d) ?? decVia.set(d, []).get(d)!).push(`${f.kind}:${f.id}`);
  const decisions: ReconciledDecision[] = [...decVia.entries()]
    .map(([id, v]) => {
      const d = snap.register.get(id);
      const st = snap.resolutions.get(id);
      const names = [...new Set((d?.affected_units ?? []).map((u) => u.name))];
      const inside = names.filter((n) => inScope.has(n)).sort();
      const outside = names.filter((n) => !inScope.has(n)).sort();
      const reqs = (d?.affected_requirements ?? []).filter((r) => reqIds.has(r)).sort();
      let cls: DecisionClass;
      let reason: string;
      if (!names.length) {
        cls = 'global';
        reason = `names no unit (system-wide${d?.gap_ids.length ? `, from ${d.gap_ids.join(', ')}` : ''}); the G1 scope evaluator applies unit-less gaps and decisions to every scope`;
      } else if (inside.some((n) => primary.has(n)) || reqs.length) {
        cls = outside.length ? 'cross_scope' : 'direct';
        reason = cls === 'direct' ? `affects primary unit(s) ${inside.filter((n) => primary.has(n)).join(', ') || '-'}${reqs.length ? ` and requirement(s) ${reqs.join(', ')}` : ''}` : `affects ${inside.join(', ')} in scope and ${outside.length} unit(s) outside it (${outside.slice(0, 6).join(', ')}${outside.length > 6 ? ', …' : ''}); one decision shared across scopes`;
      } else {
        cls = 'shared_dependency';
        reason = `affects only dependency unit(s) ${inside.join(', ')} in scope${outside.length ? ` (and ${outside.length} unit(s) outside it)` : ''}`;
      }
      const resolved = st?.status === 'resolved';
      return { id, kind: d?.kind ?? null, blocking: !!d?.blocking, status: st?.status ?? 'open', effective_blocking: !!d?.blocking && !resolved, class: cls, reason, via: v.sort(), units_in_scope: inside, units_outside_scope: outside, requirements_in_scope: reqs, origin: d?.origin.type ?? 'unknown' };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  const all = [...ev.findings.map((f) => `${f.kind}|${f.id}`)];
  const duplicates = [...new Set(all.filter((x, i) => all.indexOf(x) !== i))];
  const requirements = items(['requirement']);
  const runtime = items(['runtime_requirement']);
  const data = items(['data_record', 'file_operations']);
  const summary: Record<string, number> = {
    units_primary: units.filter((u) => u.relation === 'primary').length,
    units_direct_dependency: units.filter((u) => u.relation === 'direct_dependency').length,
    units_transitive_dependency: units.filter((u) => u.relation === 'transitive_dependency').length,
    requirements: requirements.length,
    requirements_direct: requirements.filter((r) => r.inclusion === 'direct').length,
    requirements_blocking: requirements.filter((r) => r.blocking).length,
    runtime_requirements: runtime.length,
    data_contracts: data.length,
    data_contracts_from_dependencies: data.filter((d) => d.inclusion === 'shared_dependency').length,
    rules: rules.length,
    decisions: decisions.length,
    decisions_blocking_unresolved: decisions.filter((d) => d.effective_blocking).length,
    decisions_non_blocking: decisions.filter((d) => !d.effective_blocking).length,
  };
  for (const c of ['direct', 'shared_dependency', 'cross_scope', 'global'] as DecisionClass[]) summary[`decisions_${c}`] = decisions.filter((d) => d.class === c).length;
  const base = {
    contract: 'bmad/scope-reconciliation' as const,
    contract_version: '1.0' as const,
    scope: ev.selector_text,
    scope_sha256: ev.scope_sha256,
    baseline: { run_id: snap.wf.run.runId, manifest_sha256: snap.wf.run.manifestSha256 },
    units,
    requirements,
    runtime_requirements: runtime,
    data_contracts: data,
    rules,
    decisions,
    excluded: { requirements: ev.excluded.requirements.length, decisions: ev.excluded.decisions.length, rules: ev.excluded.rules, units: ev.excluded.units, sample: [...ev.excluded.requirements, ...ev.excluded.decisions].slice(0, 10) },
    unique_ids: { duplicates, ok: duplicates.length === 0 },
    summary,
  };
  return { ...base, reconciliation_sha256: digest(base) };
}
