/**
 * Builds the semantic-check context for a packet from the actual reverse
 * artifacts (including data layouts and per-program logic files) and the
 * runtime's own records.
 */
import * as fs from 'fs';
import * as path from 'path';
import { collectPermanentIds } from '../../../verification/src/ids';
import { SemanticContext } from '../../../verification/src/semantic';
import { ArtifactSet } from '../core/artifacts';
import { normalizeGaps, normalizeRules, sourceRunKey } from '../core/model';
import type { DispatchPacket, Workflow } from './orchestrator';

let cache: { key: string; ids: Set<string> } | null = null;

function permanentIdUniverse(set: ArtifactSet): Set<string> {
  const key = Object.values(set.artifacts).map((a) => a.sha256).join('|') + set.perProgramHashes.logic.sha256;
  if (cache && cache.key === key) return cache.ids;
  const ids = new Set<string>();
  const add = (v: unknown) => {
    for (const s of collectPermanentIds(v).values()) for (const id of s) ids.add(id);
  };
  for (const a of Object.values(set.artifacts)) if (a.format === 'json' && a.data) add(a.data);
  for (const f of [...set.logicFiles, ...set.rawStructureFiles]) if (f.data) add(f.data);
  const layouts = set.artifacts.data ? path.join(path.dirname(set.artifacts.data.path), 'data_layouts') : null;
  if (layouts && fs.existsSync(layouts)) for (const f of fs.readdirSync(layouts)) if (f.endsWith('.json')) add(JSON.parse(fs.readFileSync(path.join(layouts, f), 'utf8')));
  cache = { key, ids };
  return ids;
}

export function buildSemanticContext(wf: Workflow, packet: DispatchPacket, set: ArtifactSet, agentSkills: string[], otherRequirementIds: Set<string>): SemanticContext {
  const rules = new Map<string, { confidence: string; requires_sme_review: boolean; evidence_class: string }>();
  for (const r of normalizeRules(set.artifacts.rules)) rules.set(r.ref.id, { confidence: r.confidence, requires_sme_review: r.requires_sme_review, evidence_class: r.evidence_class });
  const gaps = new Map<string, { items: string[]; severity: string; requires_sme_review: boolean }>();
  for (const g of normalizeGaps(set.artifacts.gaps)) gaps.set(g.ref.id, { items: g.items.map((i) => i.item_id), severity: g.severity, requires_sme_review: g.requires_sme_review });
  const data = set.artifacts.data?.data ?? {};
  const records = new Map<string, { file_id: string; total_bytes: number | null }>();
  const recordsByFile = new Map<string, string[]>();
  for (const r of (data.record_catalogue ?? []) as any[]) {
    records.set(r.record_id, { file_id: r.file_id, total_bytes: r.total_bytes ?? null });
    recordsByFile.set(r.file_id, [...(recordsByFile.get(r.file_id) ?? []), r.record_id]);
  }
  const fields: SemanticContext['fields'] = new Map();
  const elementary = new Map<string, string[]>();
  for (const f of (data.field_catalogue ?? []) as any[]) {
    if (!f.field_id) continue;
    fields.set(f.field_id, { record_id: f.record_id, normalized_type: f.normalized_type ?? null, storage_type: f.storage_type ?? null, length: f.length ?? null, decimal_places: f.decimal_places ?? null, signed: f.signed ?? null, is_condition: false });
    if (!f.is_condition) elementary.set(f.record_id, [...(elementary.get(f.record_id) ?? []), f.field_id]);
  }
  for (const c of (data.condition_catalogue ?? []) as any[]) fields.set(c.condition_id, { record_id: c.parent_record_id ?? null, parent_record_id: c.parent_record_id ?? null, normalized_type: null, storage_type: null, length: null, decimal_places: null, signed: null, is_condition: true });
  const stubsByFile = new Map<string, string[]>();
  for (const i of (data.issues ?? []) as any[]) {
    if (!/unresolved_copy_stub|copy_target_is_program/.test(String(i.type))) continue;
    const m = /(?:COPY|INCLUDE)\s+([A-Z0-9][A-Z0-9-]*)/i.exec(String(i.message ?? ''));
    if (m && i.file_id) stubsByFile.set(i.file_id, [...(stubsByFile.get(i.file_id) ?? []), m[1]]);
  }
  const packetInputs = new Map<string, string | null>();
  for (const i of packet.inputs) for (const f of i.files) packetInputs.set(f.path, f.sha256);
  const currentSourceRuns = new Set(Object.values(set.artifacts).filter((a) => a.parsed && a.format === 'json').map((a) => sourceRunKey(a)));
  return {
    agent: packet.agent.id,
    packetId: packet.packet_id,
    manifestSha: wf.run.manifestSha256,
    units: (packet as any).units ?? [],
    sourceAvailable: (packet as any).source?.available === true,
    agentSkills,
    packetInputs,
    permanentIds: permanentIdUniverse(set),
    currentSourceRuns,
    rules,
    gaps,
    rulesInScope: (packet as any).scope?.rules_in_scope ?? [],
    gapsInScope: (packet as any).scope?.gaps_in_scope ?? [],
    records,
    recordsByFile,
    fields,
    elementaryFieldsByRecord: elementary,
    stubsByFile,
    otherRequirementIds,
  };
}
