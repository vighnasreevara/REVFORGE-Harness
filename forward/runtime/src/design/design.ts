/**
 * Design artefacts under human approval (STEP 7): the F3 architecture set
 * (G2) and the F4 story set (validated automatically before F5). This module derives, from the runtime's own
 * records only:
 *   - the G1-approved scope context (re-verified G1 approval, approved
 *     requirements and their content hash, the dependency manifest);
 *   - the artefact set an agent actually delivered (latest accepted,
 *     completed receipt; files re-hashed);
 *   - the legacy compatibility concerns that apply to the scope, from source
 *     facts (edges, JCL, data and file items, requirement text);
 *   - scope-aware semantic validation of an architecture or a story set.
 * A schema-valid document is never enough: every check binds the artefact to
 * the approved scope, its source identities and its upstream approvals.
 */
import * as fs from 'fs';
import * as path from 'path';
import { digest } from '../approval/canonical';
import { evaluateG1Gate } from '../approval/approvals';
import { ScopeEvaluation } from '../approval/scope';
import { Snapshot } from '../approval/snapshot';
import { readJson, sha256File } from '../core/fsutil';
import { acceptedReceipts, Workflow } from '../orchestrator/orchestrator';
import { reconcileScope, Reconciliation } from '../bmad/reconcile';

export interface Check {
  id: string;
  ok: boolean;
  detail: string;
}

export const CONCERNS = ['decimal_precision', 'batch_execution', 'file_organization', 'record_layouts', 'return_codes', 'jcl_dependencies', 'db2_transactions', 'cics_interfaces', 'checkpoint_restart', 'shared_dependencies'] as const;
export type Concern = (typeof CONCERNS)[number];

const USABLE = new Set(['VERIFIED', 'APPROVED_EXCEPTION']);

/* ------------------------------------------------------------------ */
/* approved scope (G1)                                                 */
/* ------------------------------------------------------------------ */

export interface ApprovedRequirement {
  id: string;
  sha256: string;
  units: string[];
  file_ids: string[];
  source_refs: any[];
  rule_ids: string[];
}

export interface ApprovedScope {
  ok: boolean;
  reason: string;
  g2_status: string;
  approval_id: string | null;
  approval_sha256: string | null;
  scope: string | null;
  scope_sha256: string | null;
  ev: ScopeEvaluation | null;
  rec: Reconciliation | null;
  requirements: ApprovedRequirement[];
  requirements_sha256: string | null;
  runtime_ids: string[];
  data_record_ids: string[];
  scope_file_ids: string[];
  dependency: { units: any[]; data_contracts: any[]; runtime_requirements: any[]; decisions: any[] } | null;
}

/** The scope G1 approves right now (approval re-verified against current content), or why there is none. */
export function approvedScope(wf: Workflow, snap: Snapshot): ApprovedScope {
  const g2 = evaluateG1Gate(wf, snap.at);
  const none = (reason: string): ApprovedScope => ({ ok: false, reason, g2_status: g2.result.status, approval_id: null, approval_sha256: null, scope: null, scope_sha256: null, ev: null, rec: null, requirements: [], requirements_sha256: null, runtime_ids: [], data_record_ids: [], scope_file_ids: [], dependency: null });
  if (g2.result.status !== 'PASS' || !g2.evaluation) return none(`G1 re-evaluated now: ${g2.result.status} — ${g2.result.reason}`);
  const chosen = (g2.evaluation.approvals as any[]).filter((a) => a.valid && a.decision === 'approved').pop();
  if (!chosen) return none('G1 has no valid signed approval');
  const ev = g2.evaluation as ScopeEvaluation;
  const rec = reconcileScope(snap, ev.selector_text, ev);
  const reqs: ApprovedRequirement[] = ev.findings
    .filter((f) => f.kind === 'requirement' && USABLE.has(f.outcome))
    .map((f) => {
      const i = snap.itemById.get(f.id)!;
      const rules = [...snap.ruleEntries.entries()].filter(([, es]) => es.some((e) => e.requirement_ids.includes(f.id))).map(([id]) => id).sort();
      return { id: f.id, sha256: i.sha256, units: i.units.map((u) => u.name), file_ids: [...new Set(i.source_refs.map((r: any) => r?.file_id).filter(Boolean))].sort() as string[], source_refs: i.source_refs, rule_ids: rules };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const dependency = {
    units: rec.units.map((u) => ({ name: u.name, file_id: u.file_id, relation: u.relation, source_sha256: u.source_sha256 })),
    data_contracts: rec.data_contracts.map((d) => ({ id: d.id, sha256: d.record_sha256, outcome: d.outcome })),
    runtime_requirements: rec.runtime_requirements.map((r) => ({ id: r.id, sha256: r.record_sha256, outcome: r.outcome })),
    decisions: rec.decisions.map((d) => ({ id: d.id, status: d.status, resolution_id: snap.resolutions.get(d.id)?.effective?.resolution_id ?? null, effective_blocking: d.effective_blocking })),
  };
  return {
    ok: true,
    reason: `G1 PASS for ${ev.selector_text} (${chosen.approval_id})`,
    g2_status: 'PASS',
    approval_id: chosen.approval_id,
    approval_sha256: sha256File(wf.store.p('approvals', `${chosen.approval_id}.json`)),
    scope: ev.selector_text,
    scope_sha256: ev.scope_sha256,
    ev,
    rec,
    requirements: reqs,
    requirements_sha256: digest(reqs.map((r) => ({ id: r.id, sha256: r.sha256 }))),
    runtime_ids: rec.runtime_requirements.filter((r) => r.usable).map((r) => r.id),
    data_record_ids: rec.data_contracts.filter((d) => d.kind === 'data_record').map((d) => d.id),
    scope_file_ids: rec.units.map((u) => u.file_id),
    dependency,
  };
}

/* ------------------------------------------------------------------ */
/* artefact sets                                                       */
/* ------------------------------------------------------------------ */

export interface ArtifactSet {
  agent: 'F3' | 'F4';
  receipt_id: string;
  files: Array<{ name: string; path: string; sha256: string }>;
  docs: Record<string, any>;
  sha256: string;
  problems: string[];
}

/** The latest accepted, completed receipt of `agent`, with its outputs re-hashed against the hashes recorded at acceptance. */
export function artifactSet(wf: Workflow, agent: 'F3' | 'F4'): ArtifactSet | null {
  const rs = acceptedReceipts(wf).filter((r) => r.receipt?.agent === agent && r.receipt?.outcome === 'completed');
  if (!rs.length) return null;
  const r = rs[rs.length - 1];
  const problems: string[] = [];
  const files: ArtifactSet['files'] = [];
  const docs: Record<string, any> = {};
  for (const o of r.receipt.outputs ?? []) {
    const abs = path.resolve(wf.run.ctx.repoRoot, o.path);
    const recorded = r.verdict.provenance?.outputs.find((x) => x.path === o.path)?.runtime_sha256 ?? null;
    const now = sha256File(abs);
    if (!recorded) problems.push(`${o.path}: no hash was recorded at acceptance`);
    else if (now !== recorded) problems.push(`${o.path}: ${now ? 'changed since acceptance (tampered)' : 'missing'}`);
    files.push({ name: path.basename(o.path), path: String(o.path), sha256: recorded ?? '0'.repeat(64) });
    if (abs.endsWith('.json') && fs.existsSync(abs)) {
      const j = readJson(abs);
      if (j.ok) docs[path.basename(o.path)] = j.data;
    }
  }
  return { agent, receipt_id: r.receipt_id, files, docs, sha256: digest({ receipt_id: r.receipt_id, files }), problems };
}

/* ------------------------------------------------------------------ */
/* compatibility concerns                                              */
/* ------------------------------------------------------------------ */

/** Concerns that apply to the scope, each with the source fact that makes it apply. */
export function applicableConcerns(snap: Snapshot, s: ApprovedScope): Array<{ concern: Concern; reason: string }> {
  if (!s.rec) return [];
  const out: Array<{ concern: Concern; reason: string }> = [];
  const names = new Set(s.rec.units.map((u) => u.name));
  const progs = snap.sys.programs.filter((p) => names.has(p.program_id));
  const edges = progs.flatMap((p) => [...(p.includes ?? []), ...(p.calls_out ?? []), ...((p as any).called_by ?? [])]);
  const jobs = snap.sys.jcl_jobs.filter((j) => (j.programs ?? []).some((p: string) => names.has(p)));
  const dataRecords = s.rec.data_contracts.filter((d) => d.kind === 'data_record');
  const fileOps = s.rec.data_contracts.filter((d) => d.kind === 'file_operations');
  const text = [...s.rec.requirements, ...s.rec.runtime_requirements].map((r) => JSON.stringify(snap.itemById.get(r.id)?.data ?? {})).join(' ');
  if (dataRecords.length) {
    out.push({ concern: 'decimal_precision', reason: `${dataRecords.length} COBOL data record(s) in scope (PIC / COMP-3 / zoned numeric types)` });
    out.push({ concern: 'record_layouts', reason: `${dataRecords.length} record layout(s) in scope` });
  }
  if (fileOps.length) out.push({ concern: 'file_organization', reason: `${fileOps.length} file-operation item(s) in scope` });
  if (progs.length) out.push({ concern: 'return_codes', reason: `${progs.length} COBOL program(s) set return codes for their callers or the job step` });
  if (jobs.length) {
    out.push({ concern: 'batch_execution', reason: `run by JCL job(s) ${jobs.map((j) => j.job_name).join(', ')}` });
    out.push({ concern: 'jcl_dependencies', reason: `JCL job(s) ${jobs.map((j) => j.job_name).join(', ')} reference scope programs` });
  }
  if (edges.some((e) => e.type === 'SQL_INCLUDE')) out.push({ concern: 'db2_transactions', reason: 'scope programs include SQL areas (EXEC SQL INCLUDE)' });
  if (edges.some((e) => /CICS/.test(e.type))) out.push({ concern: 'cics_interfaces', reason: 'scope programs take part in CICS LINK/XCTL interfaces' });
  if (/checkpoint|restart/i.test(text)) out.push({ concern: 'checkpoint_restart', reason: 'approved requirements describe checkpoint / restart behaviour' });
  if (s.rec.units.some((u) => u.relation !== 'primary') || edges.some((e) => e.type === 'STATIC_CALL' && !names.has(e.to))) out.push({ concern: 'shared_dependencies', reason: `shared units in scope: ${s.rec.units.filter((u) => u.relation !== 'primary').map((u) => u.name).join(', ') || 'calls outside the scope'}` });
  return out;
}

/* ------------------------------------------------------------------ */
/* validation                                                          */
/* ------------------------------------------------------------------ */

const fileIdsOf = (refs: any[]) => [...new Set((refs ?? []).map((r) => r?.file_id).filter(Boolean))] as string[];

function acyclic(nodes: string[], edges: Map<string, string[]>): { ok: boolean; order: string[]; cycle: string[] } {
  const state = new Map<string, number>();
  const order: string[] = [];
  let cycle: string[] = [];
  const visit = (n: string, stack: string[]): boolean => {
    if (state.get(n) === 2) return true;
    if (state.get(n) === 1) {
      cycle = [...stack.slice(stack.indexOf(n)), n];
      return false;
    }
    state.set(n, 1);
    for (const m of edges.get(n) ?? []) if (nodes.includes(m) && !visit(m, [...stack, n])) return false;
    state.set(n, 2);
    order.push(n);
    return true;
  };
  for (const n of [...nodes].sort()) if (!visit(n, [])) return { ok: false, order, cycle };
  return { ok: true, order, cycle };
}

export interface ArchitectureValidation {
  ok: boolean;
  checks: Check[];
  components: Map<string, any>;
  adrs: Map<string, any>;
  needs_co_approval: boolean;
  concerns: Array<{ concern: Concern; reason: string }>;
}

export function validateArchitecture(wf: Workflow, snap: Snapshot, s: ApprovedScope, a: ArtifactSet | null): ArchitectureValidation {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const res: ArchitectureValidation = { ok: false, checks, components: new Map(), adrs: new Map(), needs_co_approval: false, concerns: [] };
  if (!a) {
    add('architecture_output', false, 'no accepted, completed F3 receipt: there is no real architecture output');
    return res;
  }
  add('architecture_output', !a.problems.length, a.problems.length ? a.problems.join('; ') : `${a.receipt_id}: ${a.files.length} file(s) unchanged since acceptance`);
  const docs = Object.values(a.docs).filter((d: any) => d?.contract === 'forward/architecture-record');
  const contractProblems: string[] = [];
  for (const d of docs) {
    const v = wf.run.ctx.contracts.validate('forward/architecture-record', d);
    if (!v.valid) contractProblems.push(...v.errors.slice(0, 3));
  }
  add('contract', docs.length > 0 && !contractProblems.length, docs.length ? (contractProblems.length ? contractProblems.join('; ') : `${docs.length} architecture record(s) satisfy forward/architecture-record`) : 'no architecture record in the F3 output');
  const types = new Set(docs.map((d: any) => d.record_type));
  add('record_types', types.has('component_design') && types.has('architecture_decisions'), `record types present: ${[...types].join(', ') || 'none'} (component_design and architecture_decisions are required)`);
  const baseOk = docs.length > 0 && docs.every((d: any) => d.baseline?.manifest_sha256 === wf.run.manifestSha256);
  add('baseline_current', baseOk, baseOk ? 'architecture was produced on the current baseline' : 'architecture was produced on a different baseline (stale)');
  if (!s.ok) {
    add('approved_scope', false, s.reason);
    return res;
  }
  const bound = docs.length > 0 && docs.every((d: any) => d.approved_inputs?.requirements_approval === s.approval_id);
  add('requirements_approval_bound', bound, bound ? `designed for the current G1 approval ${s.approval_id} (${s.scope})` : `architecture names requirements approval ${[...new Set(docs.map((d: any) => d.approved_inputs?.requirements_approval))].join(', ') || 'none'}, current is ${s.approval_id}`);

  for (const d of docs) for (const c of d.components ?? []) res.components.set(c.component_id, c);
  for (const d of docs) for (const x of d.adrs ?? []) res.adrs.set(x.adr_id, x);
  const comps = [...res.components.values()];
  const usable = new Set(s.requirements.map((r) => r.id));
  const cited = new Set<string>(comps.flatMap((c) => c.requirement_ids));
  const missing = [...usable].filter((id) => !cited.has(id));
  add('requirements_coverage', !missing.length, missing.length ? `approved requirement(s) no component implements: ${missing.join(', ')}` : `all ${usable.size} approved requirement(s) are mapped to components`);
  const outside = [...cited].filter((id) => !usable.has(id));
  add('requirements_in_scope', !outside.length, outside.length ? `components cite requirements that are not approved in this scope: ${outside.join(', ')}` : 'components cite approved requirements only');
  const scopeFiles = new Set(s.scope_file_ids);
  const badUnits = comps.flatMap((c) => c.replaces_units).filter((u: any) => !scopeFiles.has(u.file_id)).map((u: any) => u.name);
  const primaries = s.rec!.units.filter((u) => u.relation === 'primary' && u.unit_kind === 'program').map((u) => u.file_id);
  const unreplaced = primaries.filter((f) => !comps.some((c) => c.replaces_units.some((u: any) => u.file_id === f)));
  add('units_in_scope', !badUnits.length && !unreplaced.length, badUnits.length ? `components replace units outside the scope: ${badUnits.join(', ')}` : unreplaced.length ? `primary program(s) no component replaces: ${unreplaced.join(', ')}` : 'components replace scope units only and cover every primary program');
  const dangling = comps.flatMap((c) => c.depends_on.filter((x: string) => !res.components.has(x) || x === c.component_id).map((x: string) => `${c.component_id}->${x}`));
  const cyc = acyclic([...res.components.keys()], new Map(comps.map((c) => [c.component_id, c.depends_on])));
  add('component_dependencies', !dangling.length && cyc.ok, dangling.length ? `dangling or self dependencies: ${dangling.join(', ')}` : cyc.ok ? `${comps.length} component(s), dependency graph acyclic` : `component dependency cycle: ${cyc.cycle.join(' -> ')}`);
  const fw = docs.flatMap((d: any) => d.technical_baseline?.frameworks ?? []);
  const fwBad = fw.filter((f: any) => !res.adrs.has(f.adr_id));
  add('technology_decisions', !fwBad.length, fwBad.length ? `framework choice(s) without an ADR: ${fwBad.map((f: any) => f.name).join(', ')}` : `${fw.length} framework choice(s), each justified by an ADR with alternatives (no framework is assumed)`);
  const adrBad = [...res.adrs.values()].filter((x) => fileIdsOf(x.source_refs).some((f) => !scopeFiles.has(f)) || !fileIdsOf(x.source_refs).length).map((x) => x.adr_id);
  add('adr_source_identity', res.adrs.size > 0 && !adrBad.length, !res.adrs.size ? 'no architecture decision records' : adrBad.length ? `ADR(s) cite no source or source outside the scope: ${adrBad.join(', ')}` : `${res.adrs.size} ADR(s) cite scope sources`);
  const riskBad = [...res.adrs.values()].filter((x) => x.compatibility_risks.length && (!x.testing_implications.length || !x.required_approvals.includes('architecture_owner'))).map((x) => x.adr_id);
  add('compatibility_risks_treated', !riskBad.length, riskBad.length ? `ADR(s) with compatibility risks but no testing implications or architecture-owner approval: ${riskBad.join(', ')}` : 'every compatibility risk has testing implications and architecture-owner approval');
  res.needs_co_approval = [...res.adrs.values()].some((x) => x.behavior_change === true);

  if (s.data_record_ids.length) {
    const f2 = new Set(acceptedReceipts(wf).filter((r) => r.receipt?.agent === 'F2').map((r) => r.receipt_id));
    const named = docs.flatMap((d: any) => d.approved_inputs?.data_contract_receipts ?? []);
    const bad = named.filter((x: string) => !f2.has(x));
    add('data_contracts', named.length > 0 && !bad.length, !named.length ? `${s.data_record_ids.length} data record(s) in scope but the architecture names no F2 data-contract receipt` : bad.length ? `unknown data-contract receipts: ${bad.join(', ')}` : `data contracts from ${named.join(', ')}`);
  }
  const concerns = docs.flatMap((d: any) => d.compatibility_concerns ?? []);
  res.concerns = applicableConcerns(snap, s);
  const decisionsResolved = (id: string | null) => !!id && snap.resolutions.get(id)?.status === 'resolved';
  const unaddressed = res.concerns.filter((c) => {
    const e = concerns.find((x: any) => x.concern === c.concern);
    if (!e) return true;
    if (e.treatment === 'addressed_by_adr') return !e.adr_ids.length || e.adr_ids.some((id: string) => !res.adrs.has(id));
    if (e.treatment === 'deferred_to_decision') return !decisionsResolved(e.decision_id);
    return true;
  });
  add('compatibility_concerns', !unaddressed.length, unaddressed.length ? `applicable concern(s) not addressed by an ADR or a resolved decision: ${unaddressed.map((c) => `${c.concern} (${c.reason})`).join('; ')}` : `${res.concerns.length} applicable concern(s) addressed: ${res.concerns.map((c) => c.concern).join(', ') || 'none'}`);
  const rtCovered = new Set<string>(concerns.flatMap((c: any) => c.runtime_requirement_ids));
  const rtMissing = s.runtime_ids.filter((id) => !rtCovered.has(id));
  add('runtime_semantics', !rtMissing.length, rtMissing.length ? `runtime requirement(s) not treated by any compatibility concern: ${rtMissing.join(', ')}` : `${s.runtime_ids.length} runtime requirement(s) treated`);
  const material = docs.flatMap((d: any) => d.assumptions ?? []).filter((x: any) => x.material && !decisionsResolved(x.decision_id));
  add('assumptions', !material.length, material.length ? `material assumption(s) not backed by a resolved decision: ${material.map((x: any) => x.assumption_id).join(', ')}` : 'no unapproved material assumption');
  const blocking = s.rec!.decisions.filter((d) => d.effective_blocking).map((d) => d.id);
  add('blocking_decisions', !blocking.length, blocking.length ? `unresolved blocking decisions in scope: ${blocking.join(', ')}` : 'no unresolved blocking decision in scope');
  res.ok = checks.every((c) => c.ok);
  return res;
}

export interface StoryValidation {
  ok: boolean;
  checks: Check[];
  order: string[];
  story_ids: string[];
}

export function validateStories(wf: Workflow, snap: Snapshot, s: ApprovedScope, arch: { approval_id: string | null; components: Map<string, any> }, set: ArtifactSet | null): StoryValidation {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const res: StoryValidation = { ok: false, checks, order: [], story_ids: [] };
  if (!set) {
    add('story_output', false, 'no accepted, completed F4 receipt: there are no development stories');
    return res;
  }
  add('story_output', !set.problems.length, set.problems.length ? set.problems.join('; ') : `${set.receipt_id}: ${set.files.length} file(s) unchanged since acceptance`);
  const docs = Object.values(set.docs).filter((d: any) => d?.contract === 'forward/development-stories');
  const cp: string[] = [];
  for (const d of docs) {
    const v = wf.run.ctx.contracts.validate('forward/development-stories', d);
    if (!v.valid) cp.push(...v.errors.slice(0, 3));
  }
  add('contract', docs.length > 0 && !cp.length, docs.length ? (cp.length ? cp.join('; ') : `${docs.length} story document(s) satisfy forward/development-stories`) : 'no story document in the F4 output');
  const baseOk = docs.length > 0 && docs.every((d: any) => d.baseline?.manifest_sha256 === wf.run.manifestSha256);
  add('baseline_current', baseOk, baseOk ? 'stories were produced on the current baseline' : 'stories were produced on a different baseline (stale)');
  if (!s.ok) {
    add('approved_scope', false, s.reason);
    return res;
  }
  const bound = docs.length > 0 && docs.every((d: any) => d.approval_baseline?.requirements_gate_result === s.approval_id && d.approval_baseline?.architecture_gate_result === arch.approval_id);
  add('approvals_bound', bound && !!arch.approval_id, bound && arch.approval_id ? `planned against ${s.approval_id} and ${arch.approval_id}` : `stories name ${[...new Set(docs.map((d: any) => `${d.approval_baseline?.requirements_gate_result}/${d.approval_baseline?.architecture_gate_result}`))].join(', ')}, current approvals are ${s.approval_id}/${arch.approval_id ?? 'none (G2 not passed)'}`);
  // Each story ID is one story; duplicates across documents are rejected.
  const stories = new Map<string, any>();
  const dup: string[] = [];
  for (const d of docs) for (const x of d.stories ?? []) (stories.has(x.story_id) ? dup.push(x.story_id) : stories.set(x.story_id, x));
  const epics = docs.flatMap((d: any) => d.epics ?? []);
  res.story_ids = [...stories.keys()].sort();
  add('stories_present', stories.size > 0 && !dup.length, !stories.size ? 'the story set is empty' : dup.length ? `duplicate story IDs: ${[...new Set(dup)].join(', ')}` : `${stories.size} story(ies) in ${epics.length} epic(s)`);
  const all = [...stories.values()];
  const usable = new Set(s.requirements.map((r) => r.id));
  const cited = new Set<string>(all.flatMap((x) => x.requirement_ids));
  const missing = [...usable].filter((id) => !cited.has(id));
  add('requirements_coverage', !missing.length, missing.length ? `approved requirement(s) without a story: ${missing.join(', ')}` : `all ${usable.size} approved requirement(s) covered`);
  const unsupported = [...cited].filter((id) => !usable.has(id));
  add('no_unsupported_behaviour', !unsupported.length, unsupported.length ? `stories introduce behaviour outside the approved requirements: ${unsupported.join(', ')}` : 'stories implement approved requirements only');
  const archBad = all.flatMap((x) => x.component_ids.filter((c: string) => !arch.components.has(c) || !arch.components.get(c).requirement_ids.some((r: string) => x.requirement_ids.includes(r))).map((c: string) => `${x.story_id}->${c}`));
  const epicBad = epics.flatMap((e: any) => [...e.component_ids.filter((c: string) => !arch.components.has(c)), ...e.story_ids.filter((sid: string) => !stories.has(sid))].map((x: string) => `${e.epic_id}:${x}`));
  const orphan = [...stories.keys()].filter((sid) => !epics.some((e: any) => e.story_ids.includes(sid)));
  add('architecture_references', !archBad.length && !epicBad.length && !orphan.length, archBad.length ? `story components that are not approved components implementing the story's requirements: ${archBad.join(', ')}` : epicBad.length ? `epics reference unknown components or stories: ${epicBad.join(', ')}` : orphan.length ? `stories in no epic: ${orphan.join(', ')}` : 'every story references approved components that implement its requirements');
  const depBad = all.flatMap((x) => x.dependencies.filter((d: string) => d === x.story_id || !stories.has(d)).map((d: string) => `${x.story_id}->${d}`));
  const cyc = acyclic([...stories.keys()], new Map(all.map((x) => [x.story_id, x.dependencies])));
  res.order = cyc.order;
  add('dependencies_ordering', !depBad.length && cyc.ok, depBad.length ? `unknown or self dependencies: ${depBad.join(', ')}` : cyc.ok ? `implementation order: ${cyc.order.join(' -> ')}` : `story dependency cycle: ${cyc.cycle.join(' -> ')}`);
  const scopeFiles = new Set(s.scope_file_ids);
  const vague = /\b(TBD|TODO|etc)\b|\?\?|as appropriate|works correctly/i;
  const acBad = all.flatMap((x) => x.acceptance_criteria.filter((c: any) => vague.test(c.criterion) || !c.verifies_source?.file_id || !scopeFiles.has(c.verifies_source.file_id)).map(() => x.story_id));
  add('acceptance_criteria', !acBad.length, acBad.length ? `acceptance criteria that are vague or not tied to a scope source: ${[...new Set(acBad)].join(', ')}` : 'every acceptance criterion is concrete and verifies a scope source');
  const noTests = all.filter((x) => !x.testing_expectations.length).map((x) => x.story_id);
  add('independent_testing', !noTests.length, noTests.length ? `stories without independent testing expectations: ${noTests.join(', ')}` : 'every story defines independent testing expectations');
  const dataIds = new Set(s.data_record_ids);
  const dataBad = all.flatMap((x) => x.data_contracts.filter((d: string) => !dataIds.has(d)).map((d: string) => `${x.story_id}:${d}`));
  add('data_contracts', !dataBad.length, dataBad.length ? `stories cite data contracts outside the scope: ${dataBad.join(', ')}` : 'data contracts cited are scope data records');
  const open = all.flatMap((x) => [...x.blocking_decisions.filter((d: string) => snap.resolutions.get(d)?.status !== 'resolved').map((d: string) => `${x.story_id}:${d}`), ...(x.readiness.status !== 'ready' || x.readiness.unmet.length ? [`${x.story_id}:readiness ${x.readiness.status}`] : [])]);
  const scopeBlocking = s.rec!.decisions.filter((d) => d.effective_blocking).map((d) => d.id);
  add('no_material_blockers', !open.length && !scopeBlocking.length, open.length ? `unresolved blockers: ${open.join(', ')}` : scopeBlocking.length ? `unresolved blocking decisions in scope: ${scopeBlocking.join(', ')}` : 'no unresolved material blocker in the implementation scope');
  // Trace: COBOL source -> reverse finding (rule) -> approved requirement -> architecture component -> story.
  const byReq = new Map(s.requirements.map((r) => [r.id, r]));
  const traceBad: string[] = [];
  for (const x of all) {
    const reqFiles = new Set(x.requirement_ids.flatMap((id: string) => byReq.get(id)?.file_ids ?? []));
    if (fileIdsOf(x.source_refs).some((f) => !reqFiles.has(f))) traceBad.push(`${x.story_id}: cites source outside its requirements`);
    for (const id of x.requirement_ids) {
      const r = byReq.get(id);
      if (r && !r.file_ids.length) traceBad.push(`${x.story_id}: ${id} has no COBOL source reference`);
      if (r && !r.rule_ids.length) traceBad.push(`${x.story_id}: ${id} is linked to no reverse finding (rule)`);
    }
  }
  add('end_to_end_trace', !traceBad.length, traceBad.length ? traceBad.slice(0, 6).join('; ') : 'every story traces COBOL source -> reverse rule -> approved requirement -> component -> story');
  res.ok = checks.every((c) => c.ok);
  return res;
}
