/**
 * Review of dispatch packets that have no accepted receipt. A packet is
 * superseded only when the runtime's own records show it is: every unit it
 * covered (programs, for legacy packets without units) is covered by a LATER
 * packet of the same agent that has an accepted, completed receipt. Anything
 * else is still required. Receipts are never fabricated; superseded packets
 * are recorded in a new, sealed packet-status record and the packets
 * themselves are left untouched.
 */
import { sha256File } from '../core/fsutil';
import { mutate, RecordedReceipt, Workflow } from '../orchestrator/orchestrator';

export interface PacketReview {
  packet_id: string;
  agent: string;
  created_at: string;
  packet_sha256: string | null;
  dispatchable: boolean;
  blockers: string[];
  covered_file_ids: string[];
  legacy_without_units: boolean;
  covered_by: Array<{ packet_id: string; receipt_id: string; created_at: string }>;
  uncovered_file_ids: string[];
  status: 'superseded' | 'still_required';
  justification: string;
}

function fileIds(p: any): { ids: string[]; legacy: boolean } {
  if (Array.isArray(p.units) && p.units.length) return { ids: p.units.map((u: any) => u.file_id), legacy: false };
  return { ids: (p.programs ?? []).map((x: any) => x.file_id).filter(Boolean), legacy: !Array.isArray(p.units) };
}

/** Live analysis of every packet without an accepted completed receipt. */
export function analyzePackets(wf: Workflow): PacketReview[] {
  const packets = wf.store.list('packets').map((f) => wf.store.readRecord<any>('packets', f));
  const receipts = wf.store.list('receipts').map((f) => wf.store.readRecord<RecordedReceipt>('receipts', f));
  const accepted = new Map<string, string>();
  for (const r of receipts) if (r.verdict.accepted && r.receipt?.outcome === 'completed') accepted.set(r.packet_id, r.receipt_id);
  const out: PacketReview[] = [];
  for (const p of packets) {
    if (accepted.has(p.packet_id)) continue;
    const { ids, legacy } = fileIds(p);
    const later = packets.filter((q) => q.agent.id === p.agent.id && q.packet_id !== p.packet_id && q.created_at > p.created_at && accepted.has(q.packet_id));
    const covered_by: PacketReview['covered_by'] = [];
    const uncovered: string[] = [];
    for (const id of ids) {
      const q = later.find((x) => fileIds(x).ids.includes(id));
      if (!q) uncovered.push(id);
      else if (!covered_by.some((c) => c.packet_id === q.packet_id)) covered_by.push({ packet_id: q.packet_id, receipt_id: accepted.get(q.packet_id)!, created_at: q.created_at });
    }
    const superseded = ids.length > 0 && uncovered.length === 0;
    const why = !p.dispatchable ? `never dispatchable (${(p.blockers ?? []).join('; ') || 'no reason recorded'}), so no completed receipt was possible` : 'dispatchable but never receipted';
    out.push({
      packet_id: p.packet_id,
      agent: p.agent.id,
      created_at: p.created_at,
      packet_sha256: sha256File(wf.store.p('packets', `${p.packet_id}.json`)),
      dispatchable: p.dispatchable === true,
      blockers: p.blockers ?? [],
      covered_file_ids: ids,
      legacy_without_units: legacy,
      covered_by,
      uncovered_file_ids: uncovered,
      status: superseded ? 'superseded' : 'still_required',
      justification: superseded
        ? `${why}; all ${ids.length} ${legacy ? 'program(s)' : 'unit(s)'} are covered by later accepted packet(s) ${covered_by.map((c) => `${c.packet_id} (${c.receipt_id})`).join(', ')}`
        : ids.length === 0
          ? `${why}; the packet names no units, so supersession cannot be shown`
          : `${why}; ${uncovered.length} of ${ids.length} unit(s) are not covered by any later accepted packet`,
    });
  }
  return out;
}

export function latestPacketStatus(wf: Workflow): { id: string; record: any } | null {
  const files = wf.store.list('packet-status');
  if (!files.length) return null;
  const f = files[files.length - 1];
  return { id: f.replace(/\.json$/, ''), record: wf.store.readRecord('packet-status', f) };
}

/** Records the current packet review as a sealed packet-status record. */
export function recordPacketReview(wf: Workflow): any {
  return mutate(wf, 'packets review', () => {
    const reviews = analyzePackets(wf);
    const rec = {
      contract: 'packet-status',
      contract_version: '1.0',
      generated_at: new Date().toISOString(),
      baseline_manifest_sha256: wf.run.manifestSha256,
      rule: 'A packet without an accepted receipt is superseded only when every unit it covered is covered by a later packet of the same agent with an accepted, completed receipt. Superseded packets are excluded from the completion denominator; packets and receipts are not modified and no receipt is created.',
      packets: reviews,
      summary: { unreceipted: reviews.length, superseded: reviews.filter((r) => r.status === 'superseded').length, still_required: reviews.filter((r) => r.status === 'still_required').length },
    };
    const v = wf.run.ctx.contracts.validate('orchestrator/packet-status', rec);
    if (!v.valid) throw new Error(`packet-status record violates its contract: ${v.errors.join('; ')}`);
    const n = wf.store.list('packet-status').length + 1;
    const id = `PST-${String(n).padStart(4, '0')}`;
    const file = wf.store.writeRecord('packet-status', `${id}.json`, rec);
    wf.store.append('packet_review_recorded', { record: `packet-status/${id}.json`, sha256: sha256File(file), summary: rec.summary, superseded: reviews.filter((r) => r.status === 'superseded').map((r) => r.packet_id) });
    wf.store.writeState(wf.state);
    return { id, ...rec };
  });
}
