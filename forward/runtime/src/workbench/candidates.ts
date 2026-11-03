/**
 * Candidate approval scopes (STEP 5.5). Every discovered program scope (the
 * program plus its shared dependencies) and every requirement scope is
 * evaluated with the existing G2 scope evaluator, and its remaining work is
 * expressed in root causes classified by who must act (Step 4.5 classes):
 *   A technical fact the source can verify    B independent semantic review
 *   C business SME decision                    D technical / architecture decision
 *   E missing source or runtime dependency     Z approval prerequisite (global)
 * Ranking prefers the least human work and dependency complexity among scopes
 * that are a meaningful, source-grounded business function: an application
 * program with source text and at least one requirement whose citation the
 * source supports. Templates, test tools, utilities and empty sources are
 * kept in the comparison but are not recommended without a scope decision.
 * Nothing here approves, resolves or excludes anything.
 */
import { evaluateScope, ScopeEvaluation, Selector } from '../approval/scope';
import { Analysis } from '../blockers/pipeline';
import { classify } from '../blockers/queue';
import { ITEM_KINDS } from '../blockers/audit';

/** Weights express how hard each class of root cause is to clear (E needs material that may not exist). */
export const CLASS_WEIGHT: Record<string, number> = { A: 1, B: 2, C: 3, D: 3, E: 6 };
export const DEPENDENCY_WEIGHT = 0.5;

export interface Candidate {
  scope: string;
  kind: 'program' | 'requirement';
  primary: string;
  classification: { class: string; confidence: string; modernization_scope: string } | null;
  source: { files: number; empty: boolean; code_lines: number | null };
  units: Array<{ name: string; file_id: string; role: string; unit_kind: string }>;
  requirements: Array<{ id: string; outcome: string; evidence_status: string }>;
  rules: string[];
  permanent_ids: number;
  evidence: { verified: number; unverified: number; contradicted: number };
  blocking_findings: number;
  root_causes: Record<string, string[]>; // class -> root cause IDs
  root_cause_count: number;
  blocking_decisions: { business: string[]; technical: string[]; scope: string[]; review: string[]; consolidation: string[] };
  missing_dependencies: string[];
  pending_citation_corrections: string[];
  readiness: string;
  scope_sha256: string;
  meaningful: boolean;
  meaningful_reasons: string[];
  workload_score: number;
}

/**
 * Root causes that must be cleared for a blocking finding to stop blocking:
 * the finding's own evidence problems plus the roots of the blocking,
 * unresolved decisions on it. Roots reached only through a non-blocking or
 * resolved decision stay linked in the registry (traceability) but are not
 * work required to unblock this scope.
 */
export function blockingRootKeys(a: Analysis, f: { kind: string; id: string; decisions: string[] }): string[] {
  const all = a.reg.findingRoots.get(`${f.kind}|${f.id}`) ?? [];
  const viaAny = new Set(f.decisions.flatMap((d) => a.reg.decisionRoots.get(d) ?? []));
  const viaBlocking = new Set(f.decisions.filter((d) => a.snap.register.get(d)?.blocking && a.snap.resolutions.get(d)?.status !== 'resolved').flatMap((d) => a.reg.decisionRoots.get(d) ?? []));
  // A decision finding is its own decision: all of its roots apply.
  if (a.snap.register.has(f.id)) return all;
  return all.filter((k) => !viaAny.has(k) || viaBlocking.has(k));
}

export function rootClasses(a: Analysis): Map<string, string> {
  const res = new Map<string, any>(a.det.results.map((r: any) => [r.root_cause_id, r]));
  return new Map(a.reg.roots.map((r) => [r.root_cause_id, classify(r, res.get(r.root_cause_id)).class]));
}

export function candidate(a: Analysis, sel: Selector, kind: 'program' | 'requirement', primary: string, classes: Map<string, string>, proposals: any[]): Candidate {
  const ev: ScopeEvaluation = evaluateScope(a.snap, sel);
  const blocking = ev.findings.filter((f) => f.blocking);
  const rootIds = new Set<string>();
  // Every root cause linked to a blocking finding (primary or secondary) needs its own human action.
  for (const f of blocking) for (const k of blockingRootKeys(a, f)) {
    const r = a.reg.byKey.get(k);
    if (r) rootIds.add(r.root_cause_id);
  }
  const byClass: Record<string, string[]> = {};
  for (const id of rootIds) (byClass[classes.get(id) ?? '?'] = byClass[classes.get(id) ?? '?'] ?? []).push(id);
  for (const k of Object.keys(byClass)) byClass[k].sort();
  const decisions = { business: [] as string[], technical: [] as string[], scope: [] as string[], review: [] as string[], consolidation: [] as string[] };
  const decisionIds = new Set<string>(blocking.flatMap((f) => f.decisions));
  for (const id of decisionIds) {
    const d = a.snap.register.get(id);
    if (!d || !d.blocking || a.snap.resolutions.get(id)?.status === 'resolved') continue;
    if (d.origin.type === 'consolidation') decisions.consolidation.push(id);
    else if (d.kind === 'scope') decisions.scope.push(id);
    else if (d.kind === 'review') decisions.review.push(id);
    else if (d.kind === 'business') decisions.business.push(id);
    else decisions.technical.push(id);
  }
  for (const k of Object.keys(decisions) as Array<keyof typeof decisions>) decisions[k].sort();
  const reqFindings = ev.findings.filter((f) => f.kind === 'requirement');
  const reqs = reqFindings.map((f) => ({ id: f.id, outcome: f.outcome, evidence_status: a.snap.itemById.get(f.id)?.evidence_status ?? 'unknown' }));
  const items = ev.findings.filter((f) => ITEM_KINDS.includes(f.kind)).map((f) => a.snap.itemById.get(f.id)).filter(Boolean);
  const evidence = { verified: items.filter((i) => i!.claim?.result === 'verified' || i!.components.every((c) => c.outcome === 'VERIFIED')).length, unverified: 0, contradicted: items.filter((i) => i!.components.some((c) => c.outcome === 'CONTRADICTED')).length };
  evidence.unverified = items.length - evidence.verified - evidence.contradicted;
  const perm = new Set<string>();
  for (const i of items) for (const r of i!.source_refs) for (const v of Object.values(r ?? {})) if (typeof v === 'string' && /^SYS-/.test(v)) perm.add(v);
  const rules = new Set<string>(ev.findings.filter((f) => f.kind === 'rule').map((f) => f.id));
  const missing = [...new Set([...ev.findings.filter((f) => f.kind === 'unresolved_dependency').map((f) => f.id.split('->')[1]), ...(byClass.E ?? []).map((id) => a.reg.roots.find((r) => r.root_cause_id === id)!.title)])].sort();
  const reqIds = new Set(reqs.map((r) => r.id));
  const pending = proposals.filter((p) => reqIds.has(p.target.item_id) || ev.units.some((u) => p.target.item_id?.includes?.(u.file_id))).map((p) => p.proposal_id).sort();
  const prog = kind === 'program' ? primary : a.snap.itemById.get(primary)?.units[0]?.name ?? primary;
  const cls = a.snap.classification.find((c) => c.program_id === prog) ?? null;
  const det = a.det.program_structure.find((s: any) => s.program === prog);
  const facts = a.det.program_facts?.[prog];
  const empty = !det?.source || (det.bytes ?? 0) <= 1;
  const reasons: string[] = [];
  if (!cls || cls.class !== 'application') reasons.push(`classified ${cls ? `${cls.class} (${cls.confidence})` : 'unclassified'}, not an application function`);
  if (cls && cls.modernization_scope !== 'candidate') reasons.push('needs a signed scope decision before it can be a modernisation candidate');
  if (empty) reasons.push('source text is missing or empty');
  if (!reqs.length) reasons.push('no requirement is in scope');
  if (reqs.length && !items.some((i) => i!.kind === 'requirement' && (i!.claim?.result === 'verified' || i!.components.every((c) => c.outcome === 'VERIFIED')))) reasons.push('no requirement in scope is independently verified against the source');
  if ((byClass.E ?? []).length) reasons.push(`depends on ${byClass.E.length} missing source/runtime dependenc${byClass.E.length === 1 ? 'y' : 'ies'}`);
  const deps = ev.units.filter((u) => u.role === 'dependency').length;
  const score = Object.entries(byClass).reduce((n, [c, ids]) => n + (CLASS_WEIGHT[c] ?? 0) * ids.length, 0) + DEPENDENCY_WEIGHT * deps;
  void facts;
  return {
    scope: ev.selector_text,
    kind,
    primary,
    classification: cls ? { class: cls.class, confidence: cls.confidence, modernization_scope: cls.modernization_scope } : null,
    source: { files: ev.units.length, empty, code_lines: det?.bytes ?? null },
    units: ev.units.map((u) => ({ name: u.name, file_id: u.file_id, role: u.role, unit_kind: u.unit_kind })),
    requirements: reqs,
    rules: [...rules].sort(),
    permanent_ids: perm.size,
    evidence,
    blocking_findings: blocking.length,
    root_causes: byClass,
    root_cause_count: rootIds.size,
    blocking_decisions: decisions,
    missing_dependencies: missing,
    pending_citation_corrections: pending,
    readiness: ev.readiness,
    scope_sha256: ev.scope_sha256,
    meaningful: reasons.length === 0,
    meaningful_reasons: reasons,
    workload_score: Math.round(score * 10) / 10,
  };
}

/** All program and requirement scopes, ranked: meaningful scopes first, then least work, then fewer dependencies, then more requirements. */
export function rankCandidates(a: Analysis, proposals: any[]): { programs: Candidate[]; requirements: Candidate[] } {
  const classes = rootClasses(a);
  const order = (xs: Candidate[]) =>
    xs.sort((x, y) => Number(y.meaningful) - Number(x.meaningful) || x.workload_score - y.workload_score || x.units.length - y.units.length || y.requirements.length - x.requirements.length || (x.scope < y.scope ? -1 : 1));
  const programs = order(a.snap.sys.programs.map((p) => candidate(a, { kind: 'programs', programs: [p.program_id] }, 'program', p.program_id, classes, proposals)));
  const requirements = order(a.snap.items.filter((i) => i.kind === 'requirement').map((i) => candidate(a, { kind: 'requirements', requirement_ids: [i.id] }, 'requirement', i.id, classes, proposals)));
  return { programs, requirements };
}

/** Plain explanation of a candidate's suitability, derived only from its metrics. */
export function explain(c: Candidate): string {
  const parts: string[] = [];
  parts.push(`${c.scope}: ${c.requirements.length} requirement(s), ${c.units.length} unit(s) (${c.units.filter((u) => u.role === 'dependency').length} shared dependenc${c.units.filter((u) => u.role === 'dependency').length === 1 ? 'y' : 'ies'}), ${c.blocking_findings} blocking finding(s) from ${c.root_cause_count} root cause(s) [${Object.entries(c.root_causes).map(([k, v]) => `${k}:${v.length}`).join(' ')}], workload score ${c.workload_score}.`);
  if (c.meaningful) parts.push('Suitable: an application function with source text and at least one source-verified requirement.');
  else parts.push(`Not recommended: ${c.meaningful_reasons.join('; ')}.`);
  if (c.missing_dependencies.length) parts.push(`Missing dependencies: ${c.missing_dependencies.join(', ')}.`);
  return parts.join(' ');
}
