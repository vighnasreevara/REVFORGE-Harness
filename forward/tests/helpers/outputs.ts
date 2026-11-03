/**
 * Test-only reference producer: builds minimal deliverables that satisfy the
 * forward contracts and semantic checks for a packet, using the packet's own
 * runtime extracts. Used to exercise receipt acceptance and to mutate valid
 * documents into precisely malformed ones for negative tests.
 */
import * as fs from 'fs';
import * as path from 'path';
import { classifyRule } from '../../verification/src/evidence';
import { allowedJavaTypes, cobolCategory } from '../../verification/src/numeric';

const SOURCE_REF_KEYS = ['file_id', 'path_id', 'section_id', 'paragraph_id', 'statement_id', 'record_id', 'field_id'];
const pad = (n: number) => String(n).padStart(3, '0');

export function readPacket(repoRoot: string, runsDir: string, runId: string, packetId: string): any {
  return JSON.parse(fs.readFileSync(path.join(runsDir, runId, 'workflow', 'packets', `${packetId}.json`), 'utf8'));
}

function extract(repoRoot: string, packet: any, name: string): any {
  const f = packet.inputs.find((i: any) => i.kind === `extract:${name}`)?.files[0];
  return JSON.parse(fs.readFileSync(path.join(repoRoot, f.path), 'utf8'));
}

function header(packet: any, contract: string, agentName: string, skills: string[]): any {
  const firstInput = packet.inputs.flatMap((i: any) => i.files).find((f: any) => f.present);
  return {
    contract,
    contract_version: '1.0',
    authoring_agent: { id: packet.agent.id, name: agentName },
    packet_id: packet.packet_id,
    baseline: { run_id: packet.baseline.run_id, manifest_sha256: packet.baseline.manifest_sha256 },
    generated_at: new Date().toISOString(),
    skills_used: skills,
    inputs_used: [{ path: firstInput.path, sha256: firstInput.sha256 }],
    units_covered: packet.units,
    unresolved_findings: [] as any[],
  };
}

function sourceRef(ids: any): any {
  const out: any = {};
  for (const k of SOURCE_REF_KEYS) out[k] = ids?.[k] ?? null;
  return out;
}

export function produceF1(repoRoot: string, packet: any): Record<string, any> {
  const rules = extract(repoRoot, packet, 'rules_extract');
  const gaps = extract(repoRoot, packet, 'gaps_extract');
  const skills = ['fe-source-grounded-requirements', 'fe-uncertainty-decision-register'];
  const unitName = packet.units[0].name.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  const reqs: any[] = [];
  const cov: any[] = [];
  const decisions: any[] = [];
  const edges: any[] = [];
  let dr = 0;
  const newDr = () => `DR-${unitName}-${pad(++dr)}`;
  for (const id of rules.rules_in_scope as string[]) {
    const r = rules.rules.find((x: any) => x.rule_id === id);
    const cls = classifyRule({ confidence: r.confidence, requires_sme_review: r.requires_sme_review, dead_code: r.dead_code, source_evidence: (r.sources ?? []).map((s: any) => s.evidence) });
    const ref = { id, scope: 'run-local', source_run: rules.source_run };
    const units = packet.units.filter((u: any) => (r.sources ?? []).some((s: any) => s.program_id === u.name)).length ? packet.units.filter((u: any) => (r.sources ?? []).some((s: any) => s.program_id === u.name)) : [packet.units[0]];
    if (cls.evidence_class === 'uncertain') {
      const d = newDr();
      decisions.push({ decision_request_id: d, kind: 'business', question: `Confirm or correct the behaviour stated by ${id}: ${r.name}`, blocking: false, blocking_rationale: 'rule is uncertain; no requirement depends on it yet', status: 'open', affected_requirements: [], affected_units: units, gap_refs: [], rule_refs: [ref], source_refs: (r.sources ?? []).map((s: any) => sourceRef(s.source_ids)), evidence_status: 'unresolved', raised_by_skill: 'fe-uncertainty-decision-register' });
      cov.push({ rule: ref, disposition: 'deferred_decision', requirement_ids: [], decision_requests: [d], reason: `uncertain evidence: ${cls.reasons.join(', ')}` });
      continue;
    }
    const rid = `REQ-${unitName}-${pad(reqs.length + 1)}`;
    reqs.push({
      requirement_id: rid,
      title: r.name,
      statement: `The system shall preserve the recovered behaviour: ${r.name}.`,
      category: r.category,
      status: 'draft',
      approval_status: 'not_approved',
      evidence_class: cls.evidence_class,
      evidence_status: 'reverse_artifact_supported',
      confidence: r.confidence,
      requires_sme_review: !!r.requires_sme_review,
      derived_from_rules: [ref],
      source_refs: (r.sources ?? []).map((s: any) => sourceRef(s.source_ids)).filter((x: any) => x.file_id),
      units,
      open_decisions: [],
    });
    cov.push({ rule: ref, disposition: 'mapped', requirement_ids: [rid], reason: 'executable behaviour with sufficient evidence' });
    for (const s of r.sources ?? []) if (s.source_ids?.statement_id) edges.push({ from: { kind: 'source_id', id: s.source_ids.statement_id }, to: { kind: 'reverse_rule', id, source_run: rules.source_run }, relation: 'extracted_from', evidence_status: 'reverse_artifact_supported' });
    edges.push({ from: { kind: 'reverse_rule', id, source_run: rules.source_run }, to: { kind: 'requirement', id: rid }, relation: 'derived_from', evidence_status: 'reverse_artifact_supported' });
  }
  for (const g of gaps.gaps as any[]) {
    if (g.severity !== 'critical' && g.severity !== 'high') continue;
    const items = (gaps.expanded_items as any[]).filter((i) => i.gap_id === g.gap_id).map((i) => i.item_id);
    decisions.push({ decision_request_id: newDr(), kind: 'technical', question: `How should forward engineering treat ${g.gap_id}: ${g.title}?`, blocking: g.severity === 'critical', blocking_rationale: g.severity === 'critical' ? 'critical gap removes the source behaviour' : 'high gap; requirements can proceed with the gap recorded', status: 'open', affected_requirements: [], affected_units: [packet.units[0]], gap_refs: [{ gap: { id: g.gap_id, scope: 'run-local', source_run: gaps.source_run }, items, all_items_included: true }], rule_refs: [], source_refs: [], evidence_status: 'unresolved', raised_by_skill: 'fe-uncertainty-decision-register' });
  }
  const count = (d: string) => cov.filter((c) => c.disposition === d).length;
  const blocking = decisions.filter((d) => d.blocking).map((d) => d.decision_request_id);
  return {
    'draft_requirements.json': { ...header(packet, 'forward/requirements', 'fe-requirements-analyst', skills), requirements: reqs, rule_coverage: cov, contradictions: [], coverage_summary: { rules_in_scope: rules.rules_in_scope.length, mapped: count('mapped'), deferred: count('deferred_scope') + count('deferred_decision'), not_a_requirement: count('not_a_requirement'), contradictory: count('contradictory'), requirements: reqs.length } },
    'uncertainty_decision_register.json': { ...header(packet, 'forward/decision-requests', 'fe-requirements-analyst', skills), decisions, blocker_report: { blocking_count: blocking.length, nonblocking_count: decisions.length - blocking.length, blocking_decisions: blocking, summary: 'test register' } },
    'evidence_references.json': { ...header(packet, 'forward/traceability-edges', 'fe-requirements-analyst', skills), edges, breaks: [] },
  };
}

export function produceF2(repoRoot: string, packet: any): Record<string, any> {
  const data = extract(repoRoot, packet, 'data_extract');
  const skills = ['fe-copybook-layout-contract', 'fe-cobol-runtime-file-semantics'];
  const unitByFile = new Map(packet.units.map((u: any) => [u.file_id, u]));
  const records = (data.records as any[]).map((r) => {
    const fields = (r.catalogue_fields as any[]).filter((f) => f.field_id && !f.is_condition).map((f) => {
      const facts = { normalized_type: f.normalized_type ?? null, storage_type: f.storage_type ?? null, length: f.length ?? null, decimal_places: f.decimal_places ?? null };
      const allowed = allowedJavaTypes(facts);
      const cat = cobolCategory(facts);
      return {
        field_id: f.field_id, field_name: f.field_name, level: f.level ?? 5, cobol_category: cat, pic: f.pic_raw ?? null,
        usage: f.storage_type === 'BINARY' ? 'BINARY' : f.storage_type === 'PACKED_DECIMAL' ? 'PACKED_DECIMAL' : cat === 'unknown' ? 'UNKNOWN' : 'DISPLAY',
        signed: f.signed ?? null, digits: f.length ?? null, decimals: f.decimal_places ?? null, byte_length: f.bytes ?? null, offset: null, offset_basis: 'unresolved', occurs: f.occurs_max ?? null, redefines_field_id: null,
        java_type: allowed[0] ?? null, java_type_rationale: allowed.length ? 'first permitted mapping' : 'no supported representation in the catalogue', evidence_status: allowed.length ? 'reverse_artifact_supported' : 'unresolved',
        ...(allowed.length ? {} : { unresolved_reason: 'catalogue lacks type facts' }),
      };
    });
    return { record_id: r.record.record_id, record_name: r.record.record_name, owner: unitByFile.get(r.record.file_id), total_bytes: r.record.total_bytes ?? null, length_evidence_status: 'reverse_artifact_supported', fields, evidence_status: 'reverse_artifact_supported' };
  });
  const h = header(packet, 'forward/data-contracts', 'fe-data-mapping-specialist', skills);
  h.unresolved_findings = (data.unresolved_copy_stubs as any[]).map((s, i) => ({ finding_id: `UF-${i + 1}`, description: s.message, evidence_status: 'unresolved' }));
  const progUnits = packet.units.filter((u: any) => u.unit_kind === 'program');
  return {
    'data_mappings.json': { ...h, encoding_assumption: { encoding: 'EBCDIC (IBM-037)', evidence_status: 'inferred', rationale: 'z/OS DISPLAY data; not stated in the evidence' }, records, verification_findings: [] },
    'file_operation_requirements.json': {
      ...header(packet, 'forward/file-runtime-semantics', 'fe-data-mapping-specialist', skills),
      programs: progUnits.map((u: any) => ({ unit: u, execution_model: 'unknown', execution_model_evidence: { evidence_status: 'unresolved', basis: 'test producer', source_refs: [] }, files: [], db2: null, cics: null, return_code_behavior: 'not determined', checkpoint_restart: null, call_dependencies: [], jcl: [], compatibility_requirements: [], unresolved_questions: [] })),
    },
    'unresolved_layout_findings.json': { ...header(packet, 'forward/decision-requests', 'fe-data-mapping-specialist', skills), decisions: [], blocker_report: { blocking_count: 0, nonblocking_count: 0, blocking_decisions: [], summary: 'none' } },
  };
}

/** Writes deliverables into the packet output dir and a receipt at packet.receipt_path; returns the receipt path. */
export function writeDeliverables(repoRoot: string, packet: any, docs: Record<string, any>, receiptExtra: Record<string, unknown> = {}, outcome = 'completed'): string {
  const outDir = path.join(repoRoot, packet.permissions.output_dir);
  fs.mkdirSync(outDir, { recursive: true });
  const outputs = Object.entries(docs).map(([name, doc]) => {
    const p = path.join(outDir, name);
    fs.writeFileSync(p, typeof doc === 'string' ? doc : JSON.stringify(doc, null, 2));
    return { path: path.relative(repoRoot, p).split(path.sep).join('/'), sha256: null, contract: null };
  });
  const receipt = { contract: 'agent-receipt', packet_id: packet.packet_id, agent: packet.agent.id, outcome, outputs, skills_used: packet.skills.map((s: any) => ({ name: s.name, status: s.status })), findings: [], blockers: [], ...receiptExtra };
  const rp = path.join(repoRoot, packet.receipt_path);
  fs.writeFileSync(rp, JSON.stringify(receipt, null, 2));
  return rp;
}
