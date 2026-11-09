/**
 * Approval scopes and the deterministic G2 readiness evaluation.
 *
 * A scope is the entire application, an explicit program set, or an explicit
 * requirement set. Program scopes pull in their shared dependencies (included
 * copybooks and, by policy, statically called programs) so that a blocker in
 * a dependency can never be hidden by choosing a narrow scope. Every item in
 * scope is classified VERIFIED, REQUIRES_EVIDENCE, REQUIRES_SME_DECISION,
 * CONTRADICTED, EXCLUDED_WITH_JUSTIFICATION or APPROVED_EXCEPTION; the scope
 * is READY only when nothing blocks and the evidence base is intact. READY is
 * never approval: G2 additionally needs a verified, signed human approval of
 * this exact scope digest.
 */
import { gateSpec } from '../orchestrator/gates';
import { rulesInScope, Unit, unitKey } from '../orchestrator/extracts';
import { digest } from './canonical';
import { RegDecision, ResolutionState } from './decisions';
import { Outcome } from './policy';
import { BLOCKING, Component, Item, Snapshot, worst } from './snapshot';
import type { Closure, ProgramGap } from './closure';
import { decisionNames } from './semantic';

export type ItemRef = { kind: 'requirement' | 'runtime_requirement'; id: string };
/**
 * STEP 13: a behaviour scope selects one behaviour (a PERFORM range) of one program and an exact, typed set of
 * functional and runtime requirements. Its units, data contracts, decisions and gaps come from the deterministic
 * dependency closure (approval/closure.ts). It never stands for the whole program.
 */
export type Selector =
  | { kind: 'application' }
  | { kind: 'programs'; programs: string[] }
  | { kind: 'requirements'; requirement_ids: string[] }
  | { kind: 'behaviour'; program: string; entry: string; items: ItemRef[] };

export function parseSelector(text: string): Selector {
  const t = (text ?? '').trim();
  if (!t || t === 'application') return { kind: 'application' };
  const b = t.match(/^behaviour:([A-Z0-9-]+):([A-Z0-9-]+):(.+)$/i);
  if (b) {
    const items = [...new Set(b[3].split(',').map((x) => x.trim()).filter(Boolean))].map((x) => {
      const m2 = /^(requirement|runtime_requirement)=([A-Z0-9-]+)$/i.exec(x);
      if (!m2) throw new Error(`invalid item '${x}' in behaviour scope: use requirement=ID or runtime_requirement=ID`);
      return { kind: m2[1].toLowerCase() as ItemRef['kind'], id: m2[2].toUpperCase() };
    });
    if (!items.length) throw new Error(`behaviour scope '${text}' selects no requirement`);
    items.sort((x, y) => (`${x.kind}=${x.id}` < `${y.kind}=${y.id}` ? -1 : 1));
    return { kind: 'behaviour', program: b[1].toUpperCase(), entry: b[2].toUpperCase(), items };
  }
  const m = t.match(/^(programs|requirements):(.+)$/);
  if (!m) throw new Error(`invalid scope '${text}': use application | programs:A,B | requirements:REQ-1,REQ-2 | behaviour:PROGRAM:PARAGRAPH:requirement=ID,runtime_requirement=ID`);
  const list = [...new Set(m[2].split(',').map((x) => x.trim()).filter(Boolean))].sort();
  if (!list.length) throw new Error(`scope '${text}' names nothing`);
  return m[1] === 'programs' ? { kind: 'programs', programs: list } : { kind: 'requirements', requirement_ids: list };
}

export function selectorText(s: Selector): string {
  if (s.kind === 'behaviour') return `behaviour:${s.program}:${s.entry}:${s.items.map((i) => `${i.kind}=${i.id}`).join(',')}`;
  return s.kind === 'application' ? 'application' : s.kind === 'programs' ? `programs:${s.programs.join(',')}` : `requirements:${s.requirement_ids.join(',')}`;
}

export type Category =
  | 'requirement_evidence'
  | 'runtime_evidence'
  | 'data_contract'
  | 'rule_coverage'
  | 'reconciliation'
  | 'contradiction'
  | 'decision'
  | 'gap'
  | 'classification'
  | 'coverage'
  | 'packet'
  | 'dependency'
  | 'provenance';

export interface Finding {
  category: Category;
  kind: string;
  id: string;
  units: string[];
  outcome: Outcome;
  blocking: boolean;
  reasons: string[];
  decisions: string[];
  sha256: string | null;
}

export interface ScopeEvaluation {
  contract: 'g2-scope-evaluation';
  contract_version: '1.0';
  selector: Selector;
  selector_text: string;
  baseline: { run_id: string; manifest_sha256: string; g0: string };
  policy_sha256: string;
  units: Array<{ name: string; file_id: string; unit_kind: string; role: 'primary' | 'dependency'; source_sha256: string | null; classification: string | null }>;
  excluded: { units: Array<{ name: string; reason: string }>; requirements: Array<{ id: string; reason: string }>; decisions: Array<{ id: string; reason: string }>; rules: number };
  findings: Finding[];
  summary: { by_outcome: Record<string, number>; by_category: Record<string, Record<string, number>>; blocking: number; requirements: Record<string, number> };
  integrity: { ok: boolean; problems: string[] };
  verification: { source_root_configured: boolean; digest: string };
  provenance: { policy: string; packets: Array<{ packet: string; status: string | null }> };
  readiness: 'READY' | 'NOT_READY';
  scope_sha256: string;
  /** STEP 13: present only for behaviour scopes. */
  behaviour?: { closure: Closure; items: Array<ItemRef & { sha256: string }>; decision_attribution: DecisionAttribution[]; gaps: Array<ProgramGap & { handoff: string }>; note: string };
}

const SEVERITY: Record<Outcome, number> = { CONTRADICTED: 5, REQUIRES_EVIDENCE: 4, REQUIRES_SME_DECISION: 3, APPROVED_EXCEPTION: 2, VERIFIED: 1, EXCLUDED_WITH_JUSTIFICATION: 0 };

function resolved(st: ResolutionState | undefined): boolean {
  return st?.status === 'resolved';
}

/** Units of the scope: primaries, dependency closure, and exclusions decided by signed resolutions. */
function scopeUnits(snap: Snapshot, sel: Selector, findings: Finding[]) {
  const progs = snap.sys.programs;
  const byProg = new Map(progs.map((p) => [p.program_id, p]));
  const byFile = new Map<string, Unit>();
  for (const p of progs) byFile.set(p.file_id, { unit_kind: 'program', name: p.program_id, file_id: p.file_id });
  for (const c of snap.sys.copybooks) if (c.file_id) byFile.set(c.file_id, { unit_kind: 'copybook', name: c.name, file_id: c.file_id });
  const cbByName = new Map(snap.sys.copybooks.filter((c) => c.file_id).map((c) => [c.name, c]));
  const primary: Unit[] = [];
  if (sel.kind === 'application') primary.push(...byFile.values());
  else if (sel.kind === 'programs') {
    const unknown: string[] = [];
    for (const n of sel.programs) {
      const p = byProg.get(n) ?? progs.find((x) => x.file_id === n);
      if (p) primary.push(byFile.get(p.file_id)!);
      else unknown.push(n);
    }
    if (unknown.length) throw new Error(`unknown programs in scope: ${unknown.join(', ')}`);
  } else if (sel.kind === 'requirements') {
    const unknown = sel.requirement_ids.filter((r) => !snap.itemById.has(r) || snap.itemById.get(r)!.kind !== 'requirement');
    if (unknown.length) throw new Error(`unknown requirements in scope: ${unknown.join(', ')}`);
    for (const r of sel.requirement_ids) for (const u of snap.itemById.get(r)!.units) if (byFile.has(u.file_id)) primary.push(byFile.get(u.file_id)!);
  }

  // Exclusions: a signed excluded_from_scope on a scope decision, or on a unit-level decision that names no requirement.
  const excludedBy = new Map<string, string>();
  for (const [id, d] of snap.register) {
    const st = snap.resolutions.get(id);
    if (!resolved(st) || st!.outcome !== 'excluded_from_scope') continue;
    if (d.kind === 'scope' || (d.origin.type !== 'derived' && !d.affected_requirements.length) || (d.origin.type === 'derived' && d.gap_ids.length)) {
      for (const u of d.affected_units) excludedBy.set(unitKey(u), `${id} (${st!.effective.resolution_id}): ${st!.effective.resolution.justification}`);
    }
  }

  const role = new Map<string, 'primary' | 'dependency'>();
  const excluded: Array<{ name: string; reason: string }> = [];
  const queue: Unit[] = [];
  for (const u of primary) {
    const why = excludedBy.get(unitKey(u));
    if (why && sel.kind !== 'requirements') {
      if (!excluded.some((x) => x.name === u.name)) excluded.push({ name: u.name, reason: `excluded with justification by ${why}` });
      continue;
    }
    if (!role.has(unitKey(u))) {
      role.set(unitKey(u), 'primary');
      queue.push(u);
    }
  }
  const unresolved: Array<{ from: string; to: string; type: string }> = [];
  const neededBy = new Map<string, string>();
  while (queue.length) {
    const u = queue.shift()!;
    if (u.unit_kind !== 'program') continue;
    const p = byProg.get(u.name);
    const deps: Unit[] = [];
    for (const e of p?.includes ?? []) {
      const c = cbByName.get(e.to);
      if (c) deps.push(byFile.get(c.file_id!)!);
      else unresolved.push({ from: u.name, to: e.to, type: e.type });
    }
    if (snap.policy.g2.include_called_programs) for (const e of p?.calls_out ?? []) {
      const q = byProg.get(e.to);
      if (q) deps.push(byFile.get(q.file_id)!);
      else unresolved.push({ from: u.name, to: e.to, type: e.type });
    }
    for (const dep of deps) {
      if (role.has(unitKey(dep))) continue;
      role.set(unitKey(dep), 'dependency');
      neededBy.set(unitKey(dep), u.name);
      queue.push(dep);
      const why = excludedBy.get(unitKey(dep));
      if (why) findings.push({ category: 'dependency', kind: 'excluded_dependency', id: dep.name, units: [dep.name, u.name], outcome: 'REQUIRES_SME_DECISION', blocking: true, reasons: [`${dep.name} was excluded (${why}) but ${u.name} in this scope depends on it; the exclusion would hide a cross-scope blocker`], decisions: [], sha256: null });
    }
  }
  // Unresolved dependencies are blockers unless a gap or decision in scope names them.
  const units = [...role.keys()].map((k) => [...byFile.values()].find((u) => unitKey(u) === k)!);
  const scopeNames = new Set(units.map((u) => u.name));
  const covering = (name: string) => {
    const re = new RegExp(`\\b${name.replace(/[^A-Za-z0-9]/g, '.')}\\b`, 'i');
    const gaps = snap.gaps.filter((g) => (g.programs ?? []).some((p: string) => scopeNames.has(p)) && re.test(`${g.title} ${g.description ?? ''}`)).map((g) => g.ref.id);
    const decs = [...snap.register.values()].filter((d) => d.affected_units.some((u) => scopeNames.has(u.name)) && re.test(d.question)).map((d) => d.decision_id);
    return [...gaps, ...decs];
  };
  for (const e of unresolved) {
    const by = covering(e.to);
    findings.push({ category: 'dependency', kind: 'unresolved_dependency', id: `${e.from}->${e.to}`, units: [e.from], outcome: 'REQUIRES_EVIDENCE', blocking: by.length === 0, reasons: [by.length ? `${e.type} ${e.to} is not in the inventory; tracked by ${by.join(', ')}` : `${e.type} ${e.to} is not in the inventory and no gap or decision in scope addresses it`], decisions: by.filter((x) => !/^GAP-/.test(x)), sha256: null });
  }
  return { units, role, excluded, neededBy };
}

/** Applies the decisions that bear on one item to its components. */
function itemFinding(snap: Snapshot, it: Item, decisionIds: string[]): Finding {
  const comps: Component[] = it.components.map((c) => ({ ...c }));
  const reasons: string[] = [];
  const decisions: string[] = [];
  let excluded: string | null = null;
  const extra: Array<{ outcome: Outcome; reason: string }> = [];
  for (const id of decisionIds) {
    const d = snap.register.get(id);
    if (!d) {
      extra.push({ outcome: 'REQUIRES_EVIDENCE', reason: `references ${id}, which is not in the canonical decision register` });
      continue;
    }
    decisions.push(id);
    const st = snap.resolutions.get(id)!;
    if (!resolved(st)) {
      if (d.blocking) extra.push({ outcome: 'REQUIRES_SME_DECISION', reason: `blocked by ${id} (${st.status}${st.problems.length ? `: ${st.problems[0]}` : ''})` });
      continue;
    }
    const r = st.effective.resolution;
    if (st.outcome === 'excluded_from_scope') excluded = `${id} (${st.effective.resolution_id}): ${r.justification}`;
    if (st.outcome === 'resolved_requires_update' && r.affected_item_hashes?.[it.id] === it.sha256) extra.push({ outcome: 'REQUIRES_EVIDENCE', reason: `${id} (${st.effective.resolution_id}) requires this item to be revised; its content is unchanged since` });
  }
  // The item's own review decision.
  const key = it.kind === 'data_record' ? `RVW-REC-${it.id}` : `RVW-${it.id}`;
  const rv = snap.register.get(key);
  if (rv) {
    decisions.push(key);
    const st = snap.resolutions.get(key)!;
    if (resolved(st)) {
      const rid = st.effective.resolution_id;
      if (st.outcome === 'excluded_from_scope') excluded = `${key} (${rid}): ${st.effective.resolution.justification}`;
      if (st.outcome === 'resolved_no_change') for (const c of comps) if (c.outcome === 'REQUIRES_SME_DECISION' && (c.source === 'evidence' || c.source === 'sme_flag')) {
        c.outcome = 'VERIFIED';
        c.reason = `${c.reason} — confirmed by ${rid}`;
      }
      // STEP 9: a dependency-verified evidence supplement counts only when this signed review resolution explicitly
      // selects it and it still describes the current item and source; a contradiction or partial support never counts.
      const sel = st.effective.resolution.selected_option;
      const esu = st.outcome === 'resolved_no_change' && typeof sel === 'string' && /^ESU-/.test(sel) ? snap.contextSupplements.get(sel) : undefined;
      if (esu) {
        const ok = esu.current && esu.record.item_id === it.id && esu.record.item_sha256 === it.sha256 && esu.record.result.status === 'CONTEXT_SUPPORTED';
        if (ok) for (const c of comps) if (c.outcome === 'REQUIRES_EVIDENCE' && c.source === 'evidence') {
          c.outcome = 'VERIFIED';
          c.reason = `${c.reason} — dependency-verified source evidence ${sel} accepted by ${rid}`;
        }
        if (!ok) reasons.push(`${sel} selected by ${rid} does not count: ${esu.current ? `status ${esu.record.result.status}` : esu.problems.join('; ')}`);
      }
      if (st.outcome === 'approved_exception') for (const c of comps) if ((snap.policy.g2.allow_exceptions_for as string[]).includes(c.outcome)) {
        c.outcome = 'APPROVED_EXCEPTION';
        c.reason = `${c.reason} — accepted as a signed exception by ${rid}`;
      }
      if (st.outcome === 'resolved_requires_update' && st.effective.resolution.affected_item_hashes?.[it.id] === it.sha256) extra.push({ outcome: 'REQUIRES_EVIDENCE', reason: `${key} (${rid}) requires this item to be revised; its content is unchanged since` });
    } else if (st.status !== 'open') reasons.push(`${key}: ${st.status} (${st.problems[0] ?? ''})`);
  }
  const all = [...comps, ...extra];
  for (const c of all) if (c.outcome !== 'VERIFIED') reasons.push(`${c.outcome}: ${c.reason}`);
  if (!reasons.length) reasons.push(...comps.map((c) => c.reason));
  const outcome: Outcome = excluded ? 'EXCLUDED_WITH_JUSTIFICATION' : worst(all.map((c) => c.outcome));
  if (excluded) reasons.unshift(`excluded with justification by ${excluded}`);
  const category = it.kind === 'requirement' ? 'requirement_evidence' : it.kind === 'data_record' ? 'data_contract' : 'runtime_evidence';
  return { category, kind: it.kind, id: it.id, units: it.units.map((u) => u.name), outcome, blocking: BLOCKING.includes(outcome), reasons: [...new Set(reasons)], decisions: [...new Set(decisions)], sha256: it.sha256 };
}

function decisionFinding(d: RegDecision, st: ResolutionState): Finding {
  const base = { category: (d.kind === 'scope' ? 'classification' : d.gap_ids.length && d.origin.type === 'derived' ? 'gap' : d.origin.type === 'consolidation' ? 'reconciliation' : 'decision') as Category, kind: `decision:${d.kind}`, id: d.decision_id, units: d.affected_units.map((u) => u.name), decisions: [d.decision_id], sha256: d.sha256 };
  if (st.status === 'resolved') {
    const o: Outcome = st.outcome === 'excluded_from_scope' ? 'EXCLUDED_WITH_JUSTIFICATION' : st.outcome === 'approved_exception' ? 'APPROVED_EXCEPTION' : 'VERIFIED';
    return { ...base, outcome: o, blocking: false, reasons: [`resolved by ${st.effective.resolution_id} (${st.outcome}, signed by ${st.effective.resolution.signer_id} as ${st.effective.resolution.role})`] };
  }
  const why = st.status === 'open' ? 'open' : `${st.status}: ${st.problems.join('; ')}`;
  return { ...base, outcome: 'REQUIRES_SME_DECISION', blocking: d.blocking, reasons: [`${d.blocking ? 'blocking' : 'non-blocking'} decision ${why} — ${d.question.slice(0, 300)}`] };
}

export function evaluateScope(snap: Snapshot, sel: Selector): ScopeEvaluation {
  const findings: Finding[] = [];
  // STEP 13: a behaviour scope takes its units, items and decisions from the deterministic dependency closure.
  const closure = sel.kind === 'behaviour' ? (require('./closure') as typeof import('./closure')).behaviourClosure(snap, sel.program, sel.entry) : null;
  const { units, role, excluded: excludedUnits } = closure ? closureUnits(closure) : scopeUnits(snap, sel, findings);
  const fileIds = new Set(units.map((u) => u.file_id));
  const names = new Set(units.map((u) => u.name));
  const inScope = (us: Unit[]) => us.some((u) => fileIds.has(u.file_id));
  const excluded = { units: excludedUnits, requirements: [] as Array<{ id: string; reason: string }>, decisions: [] as Array<{ id: string; reason: string }>, rules: 0 };

  // Items.
  const selReqs = sel.kind === 'requirements' ? new Set(sel.requirement_ids) : null;
  const items: Item[] = [];
  if (closure && sel.kind === 'behaviour') items.push(...behaviourItems(snap, sel, closure, excluded));
  else for (const it of snap.items) {
    if (!inScope(it.units)) {
      if (it.kind === 'requirement') excluded.requirements.push({ id: it.id, reason: 'its unit is outside this scope' });
      continue;
    }
    if (it.kind === 'requirement' && selReqs && !selReqs.has(it.id)) {
      excluded.requirements.push({ id: it.id, reason: 'not in the requested requirement set' });
      continue;
    }
    items.push(it);
  }
  const reqIds = new Set(items.filter((i) => i.kind === 'requirement').map((i) => i.id));

  // Decisions that apply to this scope (a decision outside the scope never blocks it; a shared one always applies).
  const applicable: RegDecision[] = [];
  const attribution = closure && sel.kind === 'behaviour' ? attributeDecisions(snap, sel, closure) : null;
  if (attribution)
    for (const a of attribution) {
      if (a.applicable) applicable.push(snap.register.get(a.decision_id)!);
      else excluded.decisions.push({ id: a.decision_id, reason: a.reason });
    }
  else for (const d of snap.register.values()) {
    const touchesReq = d.affected_requirements.some((r) => reqIds.has(r));
    const unitLevel = d.affected_units.some((u) => fileIds.has(u.file_id)) && (!selReqs || !d.affected_requirements.length);
    const global = !d.affected_units.length && !d.affected_requirements.length;
    if (touchesReq || unitLevel || global) applicable.push(d);
    else if (d.origin.type !== 'derived' || d.kind === 'scope') excluded.decisions.push({ id: d.decision_id, reason: d.affected_requirements.length && selReqs ? 'affects only requirements outside the requested set' : 'affects no unit or requirement in this scope' });
  }
  const applicableIds = new Set(applicable.map((d) => d.decision_id));

  for (const it of items) {
    const ids = new Set<string>(it.open_decisions);
    if (it.kind === 'requirement' || (closure && it.kind === 'runtime_requirement')) for (const d of applicable) if (d.affected_requirements.includes(it.id)) ids.add(d.decision_id);
    findings.push(itemFinding(snap, it, [...ids]));
  }
  if (closure && sel.kind === 'behaviour') findings.push(...behaviourFindings(snap, sel, closure, applicable));
  for (const d of applicable) {
    if (d.origin.type === 'derived' && d.origin.item && ['requirement', 'runtime_requirement', 'file_operations', 'data_record'].includes(d.origin.item.kind)) continue;
    findings.push(decisionFinding(d, snap.resolutions.get(d.decision_id)!));
  }

  // Canonical rule coverage for the scope.
  const ruleIds = new Set<string>();
  if (selReqs || closure) {
    for (const it of items.filter((i) => i.kind === 'requirement')) for (const r of it.data.derived_from_rules ?? []) ruleIds.add(r.id);
    for (const [id, es] of snap.ruleEntries) if (es.some((e) => e.requirement_ids.some((r) => reqIds.has(r)))) ruleIds.add(id);
  } else {
    // Same rule scope as the F1 packets (rules_by_program, implementing programs and rule sources).
    for (const id of rulesInScope(snap.set, units.filter((u) => u.unit_kind === 'program').map((u) => u.name))) ruleIds.add(id);
    for (const [id, r] of snap.rules) if (r.primary_source?.copybook && names.has(r.primary_source.copybook)) ruleIds.add(id);
  }
  excluded.rules = snap.rules.size - ruleIds.size;
  for (const id of [...ruleIds].sort()) {
    const es = snap.ruleEntries.get(id) ?? [];
    const f: Finding = { category: 'rule_coverage', kind: 'rule', id, units: [], outcome: 'VERIFIED', blocking: false, reasons: [], decisions: [], sha256: es.length ? es.map((e) => e.sha256).join('+') : null };
    const dispositions = [...new Set(es.map((e) => e.disposition))];
    if (!snap.rules.has(id)) Object.assign(f, { outcome: 'REQUIRES_EVIDENCE', reasons: [`${id} is not a canonical reverse rule`] });
    else if (!es.length) Object.assign(f, { outcome: 'REQUIRES_EVIDENCE', reasons: ['canonical rule has no disposition in any accepted F1 delivery'] });
    else if (dispositions.length > 1) {
      const cd = [...snap.register.values()].find((d) => d.origin.type === 'consolidation' && d.rule_ids.includes(id));
      f.category = 'reconciliation';
      f.decisions = cd ? [cd.decision_id] : [];
      if (cd && resolved(snap.resolutions.get(cd.decision_id))) Object.assign(f, { outcome: 'VERIFIED', reasons: [`batches disagreed (${es.map((e) => `${e.packet}=${e.disposition}`).join(', ')}); resolved by ${snap.resolutions.get(cd.decision_id)!.effective.resolution_id}`] });
      else Object.assign(f, { outcome: 'REQUIRES_SME_DECISION', reasons: [`batches disagree: ${es.map((e) => `${e.packet}=${e.disposition}`).join(', ')}; ${cd ? `awaiting ${cd.decision_id}` : 'no consolidation decision registered'}`] });
    } else {
      const d = dispositions[0];
      const decs = [...new Set(es.flatMap((e) => e.decision_requests))];
      f.decisions = decs;
      const allResolved = decs.length > 0 && decs.every((x) => resolved(snap.resolutions.get(x)));
      if (d === 'mapped') {
        const missing = es.flatMap((e) => e.requirement_ids).filter((r) => !snap.itemById.has(r));
        Object.assign(f, missing.length ? { outcome: 'REQUIRES_EVIDENCE', reasons: [`mapped to unknown requirement(s) ${missing.join(', ')}`] } : { reasons: [`mapped to ${[...new Set(es.flatMap((e) => e.requirement_ids))].join(', ')}`] });
      } else if (d === 'deferred_decision') Object.assign(f, allResolved ? { reasons: [`deferred decisions resolved (${decs.join(', ')})`] } : { outcome: 'REQUIRES_SME_DECISION', reasons: [`behaviour is not captured in any requirement; deferred pending ${decs.join(', ') || 'an unnamed decision'}`] });
      else if (d === 'contradictory') Object.assign(f, allResolved ? { reasons: [`contradiction resolved (${decs.join(', ')})`] } : { outcome: 'CONTRADICTED', reasons: [`rule evidence is contradictory; pending ${decs.join(', ') || 'an unnamed decision'}`] });
      else Object.assign(f, { outcome: 'EXCLUDED_WITH_JUSTIFICATION', reasons: [`agent disposition ${d}: ${es[0].reason} (shown to the approver; not a human exclusion)`] });
    }
    f.blocking = BLOCKING.includes(f.outcome);
    findings.push(f);
  }

  // Contradictions recorded by F1.
  for (const c of snap.contradictions) {
    // A behaviour scope takes a contradiction when it concerns its rules, or its program without naming any rule (fail-closed).
    if (closure ? !(c.rule_ids.some((r) => ruleIds.has(r)) || (!c.rule_ids.length && c.file_ids.includes(closure.file_id))) : !c.file_ids.some((f) => fileIds.has(f)) && !c.rule_ids.some((r) => ruleIds.has(r))) continue;
    const ok = c.decision && resolved(snap.resolutions.get(c.decision));
    findings.push({ category: 'contradiction', kind: 'contradiction', id: c.id, units: [], outcome: ok ? 'VERIFIED' : 'CONTRADICTED', blocking: !ok, reasons: [ok ? `resolved by ${snap.resolutions.get(c.decision!)!.effective.resolution_id}` : `${c.data.description}${c.decision ? ` (awaiting ${c.decision})` : ' (no decision raised)'}`], decisions: c.decision ? [c.decision] : [], sha256: c.sha256 });
  }

  // Coverage: every unit in scope needs accepted F1 (programs) and F2 deliveries.
  for (const u of units) {
    const k = unitKey(u);
    const need: Array<'F1' | 'F2'> = u.unit_kind === 'program' ? ['F1', 'F2'] : ['F2'];
    for (const a of need) {
      const s = snap.coverage[a].get(k);
      // Only units the agent's ledger defines (e.g. not DCLGEN/SQL includes for F2) need its delivery.
      if (s !== undefined && s !== 'completed') findings.push({ category: 'coverage', kind: `coverage:${a}`, id: `${a}:${u.name}`, units: [u.name], outcome: 'REQUIRES_EVIDENCE', blocking: true, reasons: [`${u.name} has no accepted ${a} delivery (${s ?? 'not in ledger'})`], decisions: [], sha256: null });
    }
  }
  // Packets without receipts that touch the scope. Only the agents whose deliveries G2 approves (its required
  // receipts, F1/F2) can leave the requirements incomplete; a later F3+ dispatch never changes the G2 scope.
  const g2Agents = new Set<string>(gateSpec('G2')!.required_receipts);
  for (const p of snap.packets) {
    if (!g2Agents.has(p.agent)) continue;
    if (!p.covered_file_ids.some((f) => fileIds.has(f))) continue;
    const recorded = snap.packetStatus?.superseded.has(p.packet_id) ?? false;
    if (p.status === 'superseded' && recorded) findings.push({ category: 'packet', kind: 'packet', id: p.packet_id, units: [], outcome: 'EXCLUDED_WITH_JUSTIFICATION', blocking: false, reasons: [`superseded (recorded in ${snap.packetStatus!.id}): ${p.justification}`], decisions: [], sha256: p.packet_sha256 });
    else findings.push({ category: 'packet', kind: 'packet', id: p.packet_id, units: [], outcome: 'REQUIRES_EVIDENCE', blocking: true, reasons: [p.status === 'superseded' ? `superseded on the evidence but not yet recorded (run 'workflow packets review'): ${p.justification}` : `still required: ${p.justification}`], decisions: [], sha256: p.packet_sha256 });
  }
  // Cross-batch consolidation must be current.
  if (!snap.consolidation.current) findings.push({ category: 'reconciliation', kind: 'consolidation', id: snap.consolidation.record ?? 'CONS-(none)', units: [], outcome: 'REQUIRES_EVIDENCE', blocking: true, reasons: snap.consolidation.problems, decisions: [], sha256: null });

  // Provenance policy: claims are accepted only on independent verification, never on an agent's declaration.
  const packetsInScope = [...new Set(items.map((i) => i.packet))].sort();
  const prov = packetsInScope.map((p) => ({ packet: p, status: snap.access.get(p) ?? null }));
  const weak = prov.filter((p) => p.status !== 'declared_inputs_evidenced');
  if (!snap.policy.g2.accept_independent_verification_without_read_telemetry) for (const p of weak) findings.push({ category: 'provenance', kind: 'provenance', id: p.packet, units: [], outcome: 'REQUIRES_EVIDENCE', blocking: true, reasons: [`read telemetry ${p.status ?? 'not recorded'}; policy requires evidenced reads`], decisions: [], sha256: null });

  // Integrity of the evidence base.
  const integrity: string[] = [];
  if (snap.g0.status !== 'PASS') integrity.push(`baseline integrity pre-check ${snap.g0.status}: ${snap.g0.reason}`);
  // Tampering anywhere in the accepted evidence base fails every scope (consolidation and shared decisions read it all).
  for (const m of snap.integrity.modified_outputs) integrity.push(`accepted deliverable modified after acceptance: ${m}`);
  integrity.push(...snap.integrity.receipt_hash_changes);
  integrity.push(...snap.problems);

  findings.sort((a, b) => (SEVERITY[b.outcome] - SEVERITY[a.outcome]) || (a.category < b.category ? -1 : a.category > b.category ? 1 : a.id < b.id ? -1 : 1));
  const by_outcome: Record<string, number> = {};
  const by_category: Record<string, Record<string, number>> = {};
  for (const f of findings) {
    by_outcome[f.outcome] = (by_outcome[f.outcome] ?? 0) + 1;
    by_category[f.category] = by_category[f.category] ?? {};
    by_category[f.category][f.outcome] = (by_category[f.category][f.outcome] ?? 0) + 1;
  }
  const reqOutcomes: Record<string, number> = {};
  for (const f of findings.filter((x) => x.kind === 'requirement')) reqOutcomes[f.outcome] = (reqOutcomes[f.outcome] ?? 0) + 1;
  const blocking = findings.filter((f) => f.blocking).length;
  const classification = new Map(snap.classification.map((c) => [c.file_id, `${c.class} (${c.confidence}) ${c.modernization_scope}`]));
  const unitRows = units.map((u) => ({ name: u.name, file_id: u.file_id, unit_kind: u.unit_kind, role: role.get(unitKey(u))!, source_sha256: snap.sourceHashes.get(u.file_id) ?? null, classification: classification.get(u.file_id) ?? null })).sort((a, b) => (a.file_id < b.file_id ? -1 : 1));
  const baseline = { run_id: snap.wf.run.runId, manifest_sha256: snap.wf.run.manifestSha256, g0: snap.g0.status };
  const receiptsInScope = snap.integrity.receipt_hashes.filter((r) => snap.receipts.some((x) => x.receipt_id === r.receipt_id && packetsInScope.includes(x.packet_id)));
  const behaviour =
    closure && sel.kind === 'behaviour'
      ? {
          closure,
          items: sel.items.map((i) => ({ ...i, sha256: snap.itemById.get(i.id)!.sha256 })),
          decision_attribution: attribution!,
          gaps: closure.program_gaps.map((g) => ({ ...g, handoff: g.in_closure ? (g.blocking ? 'blocks this scope' : 'deferred: outside the supported input domain of this scope') : 'deferred: outside this scope; still applies to the full program' })),
          note: 'Approval of this behaviour scope approves only the selected items of this behaviour; it never implies approval of the program.',
        }
      : null;
  const scope_sha256 = digest({
    selector: sel,
    baseline: { run_id: baseline.run_id, manifest_sha256: baseline.manifest_sha256, inputs: snap.wf.state.baseline.inputs, per_program: snap.wf.state.baseline.per_program },
    policy_sha256: snap.policy_sha256,
    units: unitRows,
    findings: findings.map((f) => ({ id: f.id, kind: f.kind, outcome: f.outcome, sha256: f.sha256, decisions: f.decisions })),
    decisions: [...applicableIds].sort().map((id) => ({ id, sha256: snap.register.get(id)!.sha256, resolution: snap.resolutions.get(id)!.effective?.resolution_id ?? null, resolution_signature: snap.resolutions.get(id)!.effective?.signature?.value ?? null })),
    receipts: receiptsInScope,
    excluded,
    verification_digest: snap.verification_digest,
    // Only behaviour scopes add this key, so the digests of every other scope kind are unchanged.
    ...(behaviour ? { behaviour: { closure_sha256: behaviour.closure.sha256, source: behaviour.closure.source, items: behaviour.items, decision_attribution: behaviour.decision_attribution.map((a) => [a.decision_id, a.applicable, a.sha256, a.reason]), gaps: behaviour.gaps.map((g) => [g.gap_id, g.in_closure, g.blocking]) } } : {}),
  });
  return {
    ...(behaviour ? { behaviour } : {}),
    contract: 'g2-scope-evaluation',
    contract_version: '1.0',
    selector: sel,
    selector_text: selectorText(sel),
    baseline,
    policy_sha256: snap.policy_sha256,
    units: unitRows,
    excluded,
    findings,
    summary: { by_outcome, by_category, blocking, requirements: reqOutcomes },
    integrity: { ok: integrity.length === 0, problems: integrity },
    verification: { source_root_configured: !!snap.ctx.srcRoot, digest: snap.verification_digest },
    provenance: {
      policy: snap.policy.g2.accept_independent_verification_without_read_telemetry
        ? `Claims are accepted only when this runtime independently re-verified them against the original source; agent read telemetry is recorded but not required. ${weak.length} of ${prov.length} packet(s) in scope lack evidenced read telemetry; none of their claims is accepted on the agent's declaration.`
        : 'Policy requires evidenced read telemetry for every packet in scope.',
      packets: prov,
    },
    readiness: blocking === 0 && integrity.length === 0 ? 'READY' : 'NOT_READY',
    scope_sha256,
  };
}

/* ------------------------------------------------------------------ */
/* behaviour scopes (STEP 13)                                          */
/* ------------------------------------------------------------------ */

export interface DecisionAttribution {
  decision_id: string;
  kind: string;
  blocking: boolean;
  applicable: boolean;
  reason: string;
  edges: string[];
  affected_units: string[];
  affected_requirements: string[];
  sha256: string;
}

function closureUnits(c: Closure): { units: Unit[]; role: Map<string, 'primary' | 'dependency'>; excluded: Array<{ name: string; reason: string }> } {
  const role = new Map<string, 'primary' | 'dependency'>();
  for (const u of c.units) role.set(unitKey(u), u.file_id === c.file_id ? 'primary' : 'dependency');
  return { units: c.units, role, excluded: [] };
}

/** The typed selected items, plus the data contracts and file operations the closure actually touches. */
function behaviourItems(snap: Snapshot, sel: Extract<Selector, { kind: 'behaviour' }>, c: Closure, excluded: { requirements: Array<{ id: string; reason: string }> }): Item[] {
  const wrong = sel.items.filter((i) => {
    const it = snap.itemById.get(i.id);
    return !it || it.kind !== i.kind || !it.units.some((u) => u.file_id === c.file_id);
  });
  if (wrong.length) throw new Error(`unknown items in behaviour scope (wrong ID, kind or program): ${wrong.map((i) => `${i.kind}=${i.id}`).join(', ')}`);
  const selected = new Set(sel.items.map((i) => i.id));
  const fieldNames = new Set(c.fields.map((f) => f.name));
  const closureFids = new Set(c.units.map((u) => u.file_id));
  const out: Item[] = [];
  for (const it of snap.items) {
    if (selected.has(it.id)) out.push(it);
    else if (it.kind === 'data_record' && it.units.some((u) => closureFids.has(u.file_id)) && ((it.data.record?.fields ?? []) as any[]).some((f) => fieldNames.has(String(f.field_name ?? f.name ?? '').toUpperCase()))) out.push(it);
    else if (it.kind === 'file_operations' && it.units.some((u) => u.file_id === c.file_id) && c.external.some((e) => e.kind === 'file_io')) out.push(it);
    else if ((it.kind === 'requirement' || it.kind === 'runtime_requirement') && it.units.some((u) => u.file_id === c.file_id)) excluded.requirements.push({ id: it.id, reason: 'not selected in this behaviour scope' });
  }
  return out;
}

/**
 * Which decisions materially apply to the behaviour. A decision applies when it names a selected item, is an open
 * decision of one, owns an undeclared name the closure uses, names something inside the closure, is global, or
 * concerns a copybook the closure includes. It is excluded only when the dependency analysis places it outside
 * the closure. A decision whose subject cannot be located applies (fail-closed). Nothing is resolved or deleted.
 */
function attributeDecisions(snap: Snapshot, sel: Extract<Selector, { kind: 'behaviour' }>, c: Closure): DecisionAttribution[] {
  const selected = new Set(sel.items.map((i) => i.id));
  const closureFids = new Set(c.units.map((u) => u.file_id));
  const programFids = new Set([c.file_id, ...c.context.copybooks.map((n) => snap.sys.copybooks.find((x) => x.name === n)?.file_id).filter((x): x is string => !!x)]);
  // The program's own name never locates a subject inside it (it names the whole program).
  const inside = new Set([...c.fields.map((f) => f.name), ...c.range, ...c.paragraphs.transitive, ...c.units.map((u) => u.name), ...c.inputs, ...c.outputs, ...c.undeclared.map((u) => u.name), ...c.external.map((e) => e.target ?? '')].filter((n) => n && n !== c.program));
  const outside = new Set([...c.context.paragraphs, ...c.context.copybooks, ...c.context.undeclared, ...c.context.tables, ...c.context.data_names].filter((n) => !inside.has(n) && n !== c.program));
  const out: DecisionAttribution[] = [];
  for (const d of snap.register.values()) {
    const subj = [...new Set([...decisionNames(d.question), ...(d.question.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+\b/g) ?? [])])];
    const hits = subj.filter((n) => inside.has(n));
    const outs = subj.filter((n) => outside.has(n));
    const selReq = d.affected_requirements.filter((r) => selected.has(r));
    const openOn = sel.items.filter((i) => snap.itemById.get(i.id)!.open_decisions.includes(d.decision_id)).map((i) => i.id);
    const undecl = c.undeclared.filter((u) => u.decisions.includes(d.decision_id)).map((u) => u.name);
    const unitHit = d.affected_units.filter((u) => closureFids.has(u.file_id));
    const progHit = d.affected_units.filter((u) => programFids.has(u.file_id));
    const global = !d.affected_units.length && !d.affected_requirements.length;
    const row = (applicable: boolean, reason: string, edges: string[]): DecisionAttribution => ({ decision_id: d.decision_id, kind: d.kind, blocking: d.blocking, applicable, reason, edges, affected_units: d.affected_units.map((u) => u.name), affected_requirements: d.affected_requirements, sha256: d.sha256 });
    if (selReq.length) out.push(row(true, `names selected item(s) ${selReq.join(', ')}`, selReq.map((r) => `decision->${r}`)));
    else if (openOn.length) out.push(row(true, `open decision of selected item(s) ${openOn.join(', ')}`, openOn.map((r) => `${r}->decision`)));
    else if (undecl.length) out.push(row(true, `the closure uses ${undecl.join(', ')}, which this decision concerns`, c.undeclared.filter((u) => undecl.includes(u.name)).flatMap((u) => u.lines.map((l) => `line ${l} uses ${u.name}`))));
    else if (hits.length && (unitHit.length || progHit.length)) out.push(row(true, `its subject ${hits.join(', ')} is in the closure`, hits.map((h) => `closure contains ${h}`)));
    else if (global) out.push(row(true, 'global decision (no unit, no requirement): applies to every scope', []));
    else if (unitHit.length) {
      if (d.affected_requirements.length) out.push(row(false, `affects only requirements outside the selection (${d.affected_requirements.join(', ')}), and nothing in the closure uses its subject`, []));
      else if (unitHit.every((u) => u.unit_kind === 'copybook')) out.push(row(true, `concerns ${unitHit.map((u) => u.name).join(', ')}, which the closure includes`, unitHit.map((u) => `closure includes ${u.name}: ${c.unit_reasons[u.name]}`)));
      else if (outs.length) out.push(row(false, `concerns ${c.program}, but its subject (${outs.join(', ')}) lies outside the closure`, []));
      else out.push(row(true, `concerns ${c.program} and its subject cannot be located in the source: applies (fail-closed)`, []));
    } else if (progHit.length)
      out.push(row(false, `concerns ${progHit.map((u) => u.name).join(', ')}, which ${c.program} includes but the closure does not: no closure field or condition is declared there, no closure statement or input writer is embedded SQL${outs.length ? `, and the closure uses none of ${outs.join(', ')}` : ''}`, []));
  }
  return out.sort((a, b) => (a.decision_id < b.decision_id ? -1 : 1));
}

/** Findings that only a behaviour scope has: unresolved closure, missing required items, omitted rules, gaps in the closure. */
function behaviourFindings(snap: Snapshot, sel: Extract<Selector, { kind: 'behaviour' }>, c: Closure, applicable: RegDecision[]): Finding[] {
  const out: Finding[] = [];
  if (c.status === 'UNRESOLVED') out.push({ category: 'dependency', kind: 'unresolved_closure', id: `${c.program}:${c.entry}`, units: [c.program], outcome: 'REQUIRES_EVIDENCE', blocking: true, reasons: c.unresolved_reasons, decisions: [], sha256: c.sha256 });
  const selected = new Set(sel.items.map((i) => i.id));
  const direct = c.statements.filter((s) => s.relation === 'direct');
  const inDirect = (l: number) => direct.some((s) => l >= s.line && l <= s.end_line);
  for (const it of snap.items) {
    if ((it.kind !== 'requirement' && it.kind !== 'runtime_requirement') || selected.has(it.id) || !it.units.some((u) => u.file_id === c.file_id)) continue;
    const lines = (it.source_refs ?? []).filter((r: any) => r.file_id === c.file_id && Number.isInteger(r.line)).map((r: any) => r.line as number).filter(inDirect);
    if (lines.length) out.push({ category: 'dependency', kind: 'missing_required_item', id: it.id, units: [c.program], outcome: 'REQUIRES_EVIDENCE', blocking: true, reasons: [`${it.kind} ${it.id} cites line ${lines.join(', ')} inside ${c.entry} but is not selected: the scope would leave that statement's requirement unapproved`], decisions: [], sha256: it.sha256 });
  }
  for (const [id, r] of snap.rules) {
    const lines = [r.primary_source, ...(r.sources ?? [])].filter((s: any) => s && s.program_id === c.program && Number.isInteger(s.line)).map((s: any) => s.line as number).filter(inDirect);
    if (!lines.length) continue;
    const mapped = [...new Set((snap.ruleEntries.get(id) ?? []).flatMap((e) => e.requirement_ids))];
    if (!mapped.some((m) => selected.has(m))) out.push({ category: 'rule_coverage', kind: 'omitted_rule', id, units: [c.program], outcome: 'REQUIRES_EVIDENCE', blocking: true, reasons: [`${id} has its source at line ${[...new Set(lines)].join(', ')} inside ${c.entry}, but none of its requirements (${mapped.join(', ') || 'none'}) is selected`], decisions: [], sha256: null });
  }
  const applicableIds = new Set(applicable.map((d) => d.decision_id));
  for (const g of c.program_gaps.filter((x) => x.in_closure)) {
    if (g.blocking) out.push({ category: 'gap', kind: 'closure_gap', id: g.gap_id, units: [c.program], outcome: g.decisions.length ? 'REQUIRES_SME_DECISION' : 'REQUIRES_EVIDENCE', blocking: true, reasons: [`${g.missing}; ${g.why}`], decisions: g.decisions.filter((d) => applicableIds.has(d)), sha256: null });
    else out.push({ category: 'gap', kind: 'deferred_domain', id: g.gap_id, units: [c.program], outcome: 'EXCLUDED_WITH_JUSTIFICATION', blocking: false, reasons: [`${g.missing}. Values beyond the PIC digits are outside the supported input domain of this scope; such an input must fail explicitly as an unsupported pilot case. No legacy result or rejection behaviour is implied, and the gap stays open.`], decisions: [], sha256: null });
  }
  return out;
}
