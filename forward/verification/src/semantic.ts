/**
 * Deterministic semantic checks for forward deliverables. A document that
 * satisfies its JSON Schema is still rejected when it fabricates IDs, binds a
 * run-local ID to a stale reverse run, silently drops a rule or gap item,
 * upgrades confidence, invents a layout or a lossy numeric type, or claims
 * source verification without available source.
 */
import { allowedJavaTypes, cobolCategory } from './numeric';
import { collectPermanentIds, owningFileId } from './ids';

export interface UnitRef {
  unit_kind: 'program' | 'copybook';
  name: string;
  file_id: string;
}

export interface SemanticContext {
  agent: string;
  packetId: string;
  manifestSha: string;
  units: UnitRef[];
  sourceAvailable: boolean;
  agentSkills: string[];
  packetInputs: Map<string, string | null>;
  permanentIds: Set<string>;
  currentSourceRuns: Set<string>;
  rules: Map<string, { confidence: string; requires_sme_review: boolean; evidence_class: string }>;
  gaps: Map<string, { items: string[]; severity: string; requires_sme_review: boolean }>;
  rulesInScope: string[];
  gapsInScope: string[];
  records: Map<string, { file_id: string; total_bytes: number | null }>;
  recordsByFile: Map<string, string[]>;
  fields: Map<string, { record_id: string | null; normalized_type: string | null; storage_type: string | null; length: number | null; decimal_places: number | null; signed: boolean | null; is_condition: boolean; parent_record_id?: string | null }>;
  elementaryFieldsByRecord: Map<string, string[]>;
  stubsByFile: Map<string, string[]>;
  otherRequirementIds: Set<string>;
}

const CLASS_RANK: Record<string, number> = { confirmed: 2, inferred: 1, uncertain: 0 };
const CONF_RANK: Record<string, number> = { confirmed: 3, high: 2, medium: 1, low: 0 };
const unitKey = (u: UnitRef) => `${u.unit_kind}:${u.file_id}`;

function runLocalRefs(v: unknown, out: Array<{ id: string; source_run: string }> = []): Array<{ id: string; source_run: string }> {
  if (Array.isArray(v)) v.forEach((x) => runLocalRefs(x, out));
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.scope === 'run-local' && typeof o.id === 'string' && typeof o.source_run === 'string') out.push({ id: o.id, source_run: o.source_run });
    for (const x of Object.values(o)) runLocalRefs(x, out);
  }
  return out;
}

function evidenceStatuses(v: unknown, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x) => evidenceStatuses(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if ((k === 'evidence_status' || k === 'length_evidence_status' || k === 'offset_basis') && typeof x === 'string') out.push(x);
      else evidenceStatuses(x, out);
    }
  }
  return out;
}

/** Checks every forward document shares: header binding, provenance, IDs and run bindings. */
export function checkHeader(contract: string, doc: any, ctx: SemanticContext): string[] {
  const p: string[] = [];
  if (doc.contract !== contract) p.push(`declared contract ${contract} but document says ${doc.contract}`);
  if (doc.authoring_agent?.id !== ctx.agent) p.push(`authoring_agent ${doc.authoring_agent?.id} is not the packet agent ${ctx.agent}`);
  if (doc.packet_id !== ctx.packetId) p.push(`packet_id ${doc.packet_id} does not match ${ctx.packetId}`);
  if (doc.baseline?.manifest_sha256 !== ctx.manifestSha) p.push('baseline manifest digest does not match the current baseline (stale or foreign baseline)');
  for (const s of doc.skills_used ?? []) if (!ctx.agentSkills.includes(s)) p.push(`skills_used names ${s}, which the agent does not own`);
  const want = new Set(ctx.units.map(unitKey));
  const got = new Set(((doc.units_covered ?? []) as UnitRef[]).map(unitKey));
  if (want.size !== got.size || [...want].some((k) => !got.has(k))) p.push(`units_covered does not match the packet units (${[...want].length} expected, ${got.size} declared)`);
  for (const i of doc.inputs_used ?? []) {
    if (!ctx.packetInputs.has(i.path)) p.push(`inputs_used lists ${i.path}, which is not a packet input`);
    else if (i.sha256 !== null && ctx.packetInputs.get(i.path) !== i.sha256) p.push(`inputs_used hash for ${i.path} does not match the packet`);
  }
  const bad: string[] = [];
  for (const set of collectPermanentIds(doc).values()) for (const id of set) if (!ctx.permanentIds.has(id)) bad.push(id);
  if (bad.length) p.push(`${bad.length} permanent ID(s) not present in the reverse inputs (fabricated or foreign): ${bad.slice(0, 5).join(', ')}`);
  for (const r of runLocalRefs(doc)) {
    if (!ctx.currentSourceRuns.has(r.source_run)) p.push(`run-local ${r.id} is bound to ${r.source_run}, not to a current reverse run (stale)`);
    else if (/^BR-/.test(r.id) && !ctx.rules.has(r.id)) p.push(`rule ${r.id} does not exist in the bound rules run`);
    else if (/^GAP-/.test(r.id) && !ctx.gaps.has(r.id)) p.push(`gap ${r.id} does not exist in the bound gaps run`);
  }
  if (!ctx.sourceAvailable && evidenceStatuses(doc).includes('verified_from_source')) p.push('claims verified_from_source, but original COBOL source was not available to this packet');
  return p;
}

function checkRequirements(doc: any, ctx: SemanticContext): string[] {
  const p: string[] = [];
  const reqs: any[] = doc.requirements ?? [];
  const ids = new Set<string>();
  for (const r of reqs) {
    if (ids.has(r.requirement_id)) p.push(`duplicate requirement_id ${r.requirement_id}`);
    ids.add(r.requirement_id);
    if (ctx.otherRequirementIds.has(r.requirement_id)) p.push(`requirement_id ${r.requirement_id} collides with an already accepted batch`);
    const derived = (r.derived_from_rules ?? []).map((x: any) => ctx.rules.get(x.id)).filter(Boolean);
    if (derived.length) {
      const minClass = Math.min(...derived.map((d: any) => CLASS_RANK[d.evidence_class] ?? 0));
      const minConf = Math.min(...derived.map((d: any) => CONF_RANK[d.confidence] ?? 0));
      if ((CLASS_RANK[r.evidence_class] ?? 0) > minClass) p.push(`${r.requirement_id} claims evidence class ${r.evidence_class}, stronger than its weakest source rule`);
      if ((CONF_RANK[r.confidence] ?? 0) > minConf) p.push(`${r.requirement_id} claims confidence ${r.confidence}, higher than its weakest source rule`);
      if (derived.some((d: any) => d.requires_sme_review) && !r.requires_sme_review) p.push(`${r.requirement_id} drops the SME-review flag of a source rule`);
    }
    const unitKeys = new Set(ctx.units.map(unitKey));
    for (const u of r.units ?? []) if (!unitKeys.has(unitKey(u))) p.push(`${r.requirement_id} names unit ${u.name}, outside the packet`);
  }
  const cov: any[] = doc.rule_coverage ?? [];
  const seen = new Map<string, number>();
  for (const c of cov) seen.set(c.rule?.id, (seen.get(c.rule?.id) ?? 0) + 1);
  const missing = ctx.rulesInScope.filter((id) => !seen.has(id));
  if (missing.length) p.push(`${missing.length} in-scope rule(s) silently discarded (no rule_coverage entry): ${missing.slice(0, 8).join(', ')}`);
  const dup = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (dup.length) p.push(`rules with more than one coverage entry: ${dup.join(', ')}`);
  const extra = [...seen.keys()].filter((id) => !ctx.rulesInScope.includes(id));
  if (extra.length) p.push(`rule_coverage lists rules outside the packet scope: ${extra.slice(0, 8).join(', ')}`);
  for (const c of cov) {
    if ((c.disposition === 'mapped') && !(c.requirement_ids ?? []).length) p.push(`${c.rule.id} is 'mapped' but names no requirement`);
    for (const rid of c.requirement_ids ?? []) if (!ids.has(rid)) p.push(`${c.rule.id} maps to unknown requirement ${rid}`);
  }
  for (const r of reqs) {
    for (const d of r.derived_from_rules ?? []) {
      const c = cov.find((x) => x.rule?.id === d.id);
      if (!c || !(c.requirement_ids ?? []).includes(r.requirement_id)) p.push(`${r.requirement_id} derives from ${d.id}, but the coverage entry does not list it`);
    }
  }
  const s = doc.coverage_summary ?? {};
  const count = (d: string) => cov.filter((c) => c.disposition === d).length;
  if (s.rules_in_scope !== ctx.rulesInScope.length) p.push(`coverage_summary.rules_in_scope ${s.rules_in_scope} != ${ctx.rulesInScope.length}`);
  if (s.mapped !== count('mapped')) p.push('coverage_summary.mapped does not match rule_coverage');
  if (s.deferred !== count('deferred_scope') + count('deferred_decision')) p.push('coverage_summary.deferred does not match rule_coverage');
  if (s.not_a_requirement !== count('not_a_requirement')) p.push('coverage_summary.not_a_requirement does not match rule_coverage');
  if (s.contradictory !== count('contradictory')) p.push('coverage_summary.contradictory does not match rule_coverage');
  if (s.requirements !== reqs.length) p.push('coverage_summary.requirements does not match the requirements list');
  return p;
}

function checkDecisions(doc: any, ctx: SemanticContext, siblingRequirementIds: Set<string> | null): string[] {
  const p: string[] = [];
  const ds: any[] = doc.decisions ?? [];
  const ids = new Set<string>();
  for (const d of ds) {
    if (ids.has(d.decision_request_id)) p.push(`duplicate decision_request_id ${d.decision_request_id}`);
    ids.add(d.decision_request_id);
    for (const g of d.gap_refs ?? []) {
      const gap = ctx.gaps.get(g.gap?.id);
      if (!gap) continue;
      const wrong = (g.items ?? []).filter((i: string) => !gap.items.includes(i));
      if (wrong.length) p.push(`${d.decision_request_id}: items ${wrong.join(', ')} do not belong to ${g.gap.id}`);
      const complete = gap.items.every((i) => (g.items ?? []).includes(i));
      if (g.all_items_included && !complete) p.push(`${d.decision_request_id}: claims all items of ${g.gap.id} but omits some`);
      if (!g.all_items_included && complete) p.push(`${d.decision_request_id}: lists every item of ${g.gap.id} but says all_items_included=false`);
      if (!g.all_items_included && !String(g.excluded_items_reason ?? '').trim()) p.push(`${d.decision_request_id}: partial item list for ${g.gap.id} without excluded_items_reason`);
    }
    if (siblingRequirementIds) for (const r of d.affected_requirements ?? []) if (!siblingRequirementIds.has(r) && !ctx.otherRequirementIds.has(r)) p.push(`${d.decision_request_id} references unknown requirement ${r}`);
  }
  const b = doc.blocker_report ?? {};
  const blocking = ds.filter((d) => d.blocking).map((d) => d.decision_request_id);
  if (b.blocking_count !== blocking.length) p.push('blocker_report.blocking_count does not match the decisions');
  if (b.nonblocking_count !== ds.length - blocking.length) p.push('blocker_report.nonblocking_count does not match the decisions');
  if ([...(b.blocking_decisions ?? [])].sort().join() !== blocking.slice().sort().join()) p.push('blocker_report.blocking_decisions does not list exactly the blocking decisions');
  if (ctx.agent === 'F1') {
    const referenced = new Set(ds.flatMap((d) => (d.gap_refs ?? []).map((g: any) => g.gap?.id)));
    const severe = ctx.gapsInScope.filter((id) => {
      const g = ctx.gaps.get(id);
      return g && (g.severity === 'critical' || g.severity === 'high');
    });
    const dropped = severe.filter((id) => !referenced.has(id));
    if (dropped.length) p.push(`${dropped.length} critical/high gap(s) in scope have no decision request: ${dropped.slice(0, 8).join(', ')}`);
  }
  return p;
}

function checkDataContracts(doc: any, ctx: SemanticContext): string[] {
  const p: string[] = [];
  const unitKeys = new Set(ctx.units.map(unitKey));
  const coveredRecords = new Set<string>();
  for (const r of doc.records ?? []) {
    if (!unitKeys.has(unitKey(r.owner))) p.push(`record ${r.record_name} is owned by ${r.owner?.name}, outside the packet`);
    if (r.record_id) {
      const rec = ctx.records.get(r.record_id);
      if (!rec) continue;
      coveredRecords.add(r.record_id);
      if (rec.file_id !== r.owner?.file_id) p.push(`record ${r.record_id} belongs to ${rec.file_id}, not to owner ${r.owner?.file_id}`);
      const listed = new Set((r.fields ?? []).map((f: any) => f.field_id).filter(Boolean));
      const expected = ctx.elementaryFieldsByRecord.get(r.record_id) ?? [];
      const omitted = expected.filter((f) => !listed.has(f));
      if (omitted.length) p.push(`record ${r.record_id}: ${omitted.length} catalogued field(s) silently omitted (${omitted.slice(0, 3).join(', ')})`);
    } else if (r.evidence_status !== 'unresolved') p.push(`record ${r.record_name} has no Record ID but is not marked unresolved`);
    for (const f of r.fields ?? []) {
      const where = `${r.record_name}.${f.field_name}`;
      if (!f.field_id) {
        if (f.evidence_status !== 'unresolved' || f.java_type !== null || !String(f.unresolved_reason ?? '').trim()) p.push(`${where}: field without a Field ID must be unresolved, with java_type null and an unresolved_reason`);
        continue;
      }
      const cat = ctx.fields.get(f.field_id);
      if (!cat) continue;
      const owner = cat.record_id ?? cat.parent_record_id;
      if (r.record_id && owner && owner !== r.record_id) p.push(`${where}: field ${f.field_id} belongs to record ${owner}`);
      if (cat.is_condition) continue;
      const facts = { normalized_type: cat.normalized_type, storage_type: cat.storage_type, length: cat.length, decimal_places: cat.decimal_places };
      const expectedCat = cobolCategory(facts);
      if (f.cobol_category !== 'group' && f.cobol_category !== expectedCat) p.push(`${where}: cobol_category ${f.cobol_category} contradicts the catalogue (${expectedCat})`);
      if (f.cobol_category !== 'group') {
        const allowed = allowedJavaTypes(facts);
        if (f.java_type !== null && !allowed.includes(f.java_type)) p.push(`${where}: java_type ${f.java_type} is not a permitted mapping for ${expectedCat} (${cat.length} digits, ${cat.decimal_places ?? 0} decimals); allowed: ${allowed.join('/') || 'none'}`);
        if (f.java_type === null && f.evidence_status !== 'unresolved') p.push(`${where}: java_type null requires evidence_status unresolved`);
        if (allowed.length === 0 && f.java_type !== null) p.push(`${where}: unsupported representation must stay unresolved`);
        if ((cat.decimal_places ?? 0) !== (f.decimals ?? 0) && expectedCat.startsWith('numeric')) p.push(`${where}: decimals ${f.decimals} contradict the catalogue (${cat.decimal_places})`);
        if (cat.signed !== null && f.signed !== null && cat.signed !== f.signed) p.push(`${where}: signed=${f.signed} contradicts the catalogue`);
      }
    }
    for (const v of r.test_vectors ?? []) {
      const fld = (r.fields ?? []).find((x: any) => x.field_id === v.field_id);
      if (!fld) p.push(`test vector for ${v.field_id} does not reference a field of ${r.record_name}`);
      else if (fld.evidence_status === 'unresolved') p.push(`test vector for unresolved field ${v.field_id} is not grounded`);
    }
  }
  for (const u of ctx.units) {
    const owned = ctx.recordsByFile.get(u.file_id) ?? [];
    const omitted = owned.filter((r) => !coveredRecords.has(r));
    if (omitted.length) p.push(`unit ${u.name}: ${omitted.length} catalogued record(s) silently omitted (${omitted.slice(0, 3).join(', ')})`);
  }
  p.push(...checkStubsReported(doc, ctx));
  return p;
}

/** Every unresolved COPY/INCLUDE stub in a packet unit must be reported as unresolved, never filled in. */
function checkStubsReported(doc: any, ctx: SemanticContext): string[] {
  const p: string[] = [];
  const text = JSON.stringify([doc.unresolved_findings ?? [], doc.verification_findings ?? [], doc.decisions ?? []]).toUpperCase();
  for (const u of ctx.units) for (const stub of ctx.stubsByFile.get(u.file_id) ?? []) if (!text.includes(stub.toUpperCase())) p.push(`unresolved copybook ${stub} in ${u.name} is not reported as an unresolved finding`);
  return p;
}

function checkRuntimeSemantics(doc: any, ctx: SemanticContext): string[] {
  const p: string[] = [];
  const programUnits = ctx.units.filter((u) => u.unit_kind === 'program');
  const covered = new Set(((doc.programs ?? []) as any[]).map((x) => x.unit?.file_id));
  for (const u of programUnits) if (!covered.has(u.file_id)) p.push(`program unit ${u.name} has no runtime-semantics entry`);
  for (const prog of doc.programs ?? []) {
    if (!ctx.units.some((u) => u.unit_kind === 'program' && u.file_id === prog.unit?.file_id)) p.push(`runtime semantics for ${prog.unit?.name}, which is not a program unit of the packet`);
    for (const f of prog.files ?? [])
      for (const o of f.operations ?? []) {
        for (const id of [o.statement_id, o.paragraph_id]) if (id && owningFileId(id) !== prog.unit?.file_id) p.push(`${prog.unit?.name} ${f.select_name} ${o.verb}: ${id} belongs to another file`);
      }
  }
  return p;
}

function checkTraceEdges(doc: any, ctx: SemanticContext, siblingRequirementIds: Set<string> | null): string[] {
  const p: string[] = [];
  for (const e of doc.edges ?? []) {
    for (const n of [e.from, e.to]) {
      if (n.kind === 'source_id' && !ctx.permanentIds.has(n.id)) p.push(`edge node source_id ${n.id} is not a known permanent ID`);
      if ((n.kind === 'reverse_rule' || n.kind === 'reverse_gap' || n.kind === 'gap_item') && !ctx.currentSourceRuns.has(n.source_run)) p.push(`edge node ${n.id} bound to stale run ${n.source_run}`);
      if (n.kind === 'reverse_rule' && !ctx.rules.has(n.id)) p.push(`edge node rule ${n.id} unknown`);
      if (n.kind === 'gap_item') {
        const g = ctx.gaps.get(n.id.split('#')[0]);
        if (!g || !g.items.includes(n.id)) p.push(`edge node gap item ${n.id} unknown`);
      }
      if (n.kind === 'requirement' && siblingRequirementIds && !siblingRequirementIds.has(n.id) && !ctx.otherRequirementIds.has(n.id)) p.push(`edge node requirement ${n.id} unknown`);
    }
  }
  return p;
}

/** Runs the header checks plus the contract-specific checks. `siblings` are the other documents of the same receipt. */
export function checkDocument(contract: string, doc: any, ctx: SemanticContext, siblings: Array<{ contract: string; doc: any }> = []): string[] {
  const p = checkHeader(contract, doc, ctx);
  const reqDoc = siblings.find((s) => s.contract === 'forward/requirements')?.doc;
  const reqIds = reqDoc ? new Set<string>(((reqDoc.requirements ?? []) as any[]).map((r) => r.requirement_id)) : null;
  switch (contract) {
    case 'forward/requirements':
      p.push(...checkRequirements(doc, ctx));
      break;
    case 'forward/decision-requests':
      p.push(...checkDecisions(doc, ctx, ctx.agent === 'F1' ? reqIds ?? new Set() : null));
      break;
    case 'forward/data-contracts':
      p.push(...checkDataContracts(doc, ctx));
      break;
    case 'forward/file-runtime-semantics':
      p.push(...checkRuntimeSemantics(doc, ctx));
      break;
    case 'forward/traceability-edges':
      p.push(...checkTraceEdges(doc, ctx, reqIds));
      break;
    default:
      break;
  }
  return p;
}
