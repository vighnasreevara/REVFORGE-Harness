/**
 * Versioned remediation proposals. A proposal records what the source shows
 * should change in an accepted deliverable (a citation, a field attribute,
 * a record size) together with the original and new evidence, the checks
 * executed, the source hashes, the affected requirements and decisions, the
 * authority needed and the downstream invalidation impact.
 *
 * A proposal is never applied here and never becomes a correction on its
 * own: it needs a signed resolution of the item's review decision
 * (resolved_requires_update) and then a validated, versioned correction.
 * Originals, receipts, previous corrections and earlier proposals are never
 * modified; a changed proposal gets a new version.
 */
import { digest } from '../approval/canonical';
import { Snapshot } from '../approval/snapshot';
import { deliveries } from '../remediation/remediation';
import { CitationAnalysis, FieldCheck } from './deterministic';
import { Registry } from './rootcauses';
import { relPath } from './records';

interface DocRef {
  path: string;
  used: string;
  sha256: string | null;
  data: any;
}

function docsByPacket(snap: Snapshot): Map<string, Map<string, DocRef>> {
  const m = new Map<string, Map<string, DocRef>>();
  for (const d of deliveries(snap.wf, { corrected: true })) {
    const inner = new Map<string, DocRef>();
    for (const [name, x] of d.docs) inner.set(name, { path: x.path, used: relPath(snap.wf, x.abs), sha256: x.sha256, data: x.data });
    m.set(d.packet.packet_id, inner);
  }
  return m;
}

function pointerFor(snap: Snapshot, docs: Map<string, Map<string, DocRef>>, kind: string, id: string, packet: string): { doc: DocRef; base: string } | null {
  const pk = docs.get(packet);
  if (!pk) return null;
  if (kind === 'requirement') {
    const doc = pk.get('draft_requirements.json');
    const i = (doc?.data.requirements ?? []).findIndex((r: any) => r.requirement_id === id);
    return doc && i >= 0 ? { doc, base: `/requirements/${i}` } : null;
  }
  if (kind === 'runtime_requirement') {
    const doc = pk.get('file_operation_requirements.json');
    const m = /^RT-(.+)-(\d{3})$/.exec(id);
    if (!doc || !m) return null;
    const pi = (doc.data.programs ?? []).findIndex((p: any) => p.unit.name.toUpperCase().replace(/[^A-Z0-9-]/g, '-') === m[1]);
    return pi >= 0 ? { doc, base: `/programs/${pi}/compatibility_requirements/${Number(m[2]) - 1}` } : null;
  }
  if (kind === 'data_record') {
    const doc = pk.get('data_mappings.json');
    const rid = id.split('@')[0];
    const i = (doc?.data.records ?? []).findIndex((r: any) => r.record_id === rid);
    return doc && i >= 0 ? { doc, base: `/records/${i}` } : null;
  }
  return null;
}

export function buildProposals(snap: Snapshot, reg: Registry, det: any, previous: any | null): any {
  const docs = docsByPacket(snap);
  const prev = new Map<string, any>((previous?.proposals ?? []).map((p: any) => [p.proposal_key, p]));
  const out: any[] = [];
  const rootByKey = new Map(reg.roots.map((r) => [r.root_cause_id, r]));
  const relatedDecisions = (itemId: string) => [...snap.register.values()].filter((d) => d.affected_requirements.includes(itemId) || (d.origin.type === 'derived' && d.origin.item?.id === itemId)).map((d) => d.decision_id).sort();
  const scopesFor = (unitNames: string[], kind: string, id: string) => ['application', ...unitNames.map((u) => `programs:${u}`), ...(kind === 'requirement' ? [`requirements:${id}`] : [])];
  const add = (p: any) => {
    const content = { target: p.target.pointer, document: p.target.document, original_value: p.original_value, proposed_value: p.proposed_value, alternatives: p.alternatives, source_hashes: p.source_hashes };
    const cd = digest(content);
    const before = prev.get(p.proposal_key);
    const version = before ? (before.content_sha256 === cd ? before.version : before.version + 1) : 1;
    out.push({ ...p, version, content_sha256: cd, previous_version: before ? { record: previous.record_id, version: before.version, unchanged: before.content_sha256 === cd } : null });
  };
  for (const r of det.results) {
    const root = rootByKey.get(r.root_cause_id);
    const sources = r.source_files.length ? r.source_files : [];
    for (const c of r.checks) {
      if (c.id === 'citation' && c.status === 'SOURCE_CITATION_CORRECTED') {
        const a: CitationAnalysis = c.evidence;
        const it = snap.itemById.get(a.item)!;
        const loc = pointerFor(snap, docs, it.kind, it.id, it.packet);
        if (!loc || !a.proposed) continue;
        const pointer = `${loc.base}/source_refs/${a.ref_index}/${a.proposed.field}`;
        const rv = it.kind === 'data_record' ? `RVW-REC-${it.id}` : `RVW-${it.id}`;
        add({
          proposal_id: `RP-${digest(`${loc.doc.path}#${pointer}`).slice(0, 10)}`,
          proposal_key: `${loc.doc.path}#${pointer}`,
          kind: 'citation_correction',
          root_cause_id: r.root_cause_id,
          status: 'proposed',
          target: { document: loc.doc.path, read_from: loc.doc.used, document_sha256: loc.doc.sha256, pointer, item_kind: it.kind, item_id: it.id, item_sha256: it.sha256 },
          original_finding: { item: it.id, version_sha256: it.sha256, citation: a.original, claim: it.kind === 'requirement' ? it.data.statement : it.data.statement },
          original_value: a.original[a.proposed.field],
          proposed_value: a.proposed.value,
          alternatives: a.alternatives,
          original_evidence: { claim_check: it.claim },
          new_evidence: { citation_analysis: a },
          deterministic_checks: [{ id: c.id, status: c.status, detail: c.detail }],
          source_hashes: sources,
          reason: `The cited ${a.proposed.field === 'line' ? 'line lies outside the cited statement' : 'statement is not the one at the cited line'}; the stated values occur at ${a.proposed.field}=${a.proposed.value}. ${a.claim_supported_after_correction === false ? 'Not every stated value occurs there: the requirement text itself still needs review.' : ''}`.trim(),
          affected_requirements: it.kind === 'requirement' ? [it.id] : [],
          affected_decisions: relatedDecisions(it.id),
          required_role: snap.policy.roles.decision.review,
          authorization: { status: 'not_authorized', requires: `a signed resolution of ${rv} with outcome resolved_requires_update by ${snap.policy.roles.decision.review.join(' or ')}, then a validated versioned correction${a.proposed.field === 'statement_id' && it.kind !== 'data_record' ? " (workflow correct --kind statement_for_line supports this change)" : ' (a line-number correction kind does not exist yet; it needs a later step or a re-delivery)'}` },
          invalidation_impact: { item_hash_changes: true, scopes: scopesFor(it.units.map((u) => u.name), it.kind, it.id), note: 'Applying the correction changes the item hash, which changes these scope digests and invalidates any approval of them.' },
        });
      }
      if (c.id === 'record_layout' && c.evidence) {
        const it = snap.items.find((x) => x.kind === 'data_record' && x.id === c.subject);
        if (!it) continue;
        const loc = pointerFor(snap, docs, 'data_record', it.id, it.packet);
        if (!loc) continue;
        const rec = loc.doc.data.records[Number(loc.base.split('/')[2])];
        const recEv = c.evidence;
        const fieldChecks: FieldCheck[] = recEv.fields ?? [];
        fieldChecks.forEach((fc) => {
          if (fc.status !== 'contradicted') return;
          const fi = (rec.fields ?? []).findIndex((f: any) => (f.field_id ?? f.field_name) === (fc.field_id ?? fc.field_name));
          for (const m of fc.mismatches) {
            const pointer = `${loc.base}/fields/${fi}/${m.attribute}`;
            const choice = m.attribute === 'java_type';
            add({
              proposal_id: `RP-${digest(`${loc.doc.path}#${pointer}`).slice(0, 10)}`,
              proposal_key: `${loc.doc.path}#${pointer}`,
              kind: choice ? 'java_type_compatibility' : 'field_attribute_correction',
              root_cause_id: r.root_cause_id,
              status: 'proposed',
              target: { document: loc.doc.path, read_from: loc.doc.used, document_sha256: loc.doc.sha256, pointer, item_kind: 'data_record', item_id: it.id, item_sha256: it.sha256 },
              original_finding: { item: it.id, version_sha256: it.sha256, field: fc.field_id ?? fc.field_name },
              original_value: m.claimed,
              proposed_value: choice ? null : m.source,
              alternatives: choice ? (m.source as string[]).map((v) => ({ value: v })) : [],
              original_evidence: { field: (rec.fields ?? [])[fi] ?? null },
              new_evidence: { source: fc.source, computed: m.source },
              deterministic_checks: [{ id: c.id, status: c.status, detail: c.detail }],
              source_hashes: sources,
              reason: choice ? `Java type ${JSON.stringify(m.claimed)} cannot represent the source PIC/USAGE; permitted: ${(m.source as string[]).join(', ')}. Choosing among them is a technical decision.` : `The source defines ${m.attribute} as ${JSON.stringify(m.source)}, not ${JSON.stringify(m.claimed)}.`,
              affected_requirements: [],
              affected_decisions: relatedDecisions(it.id),
              required_role: snap.policy.roles.decision.data_layout,
              authorization: { status: 'not_authorized', requires: `a signed resolution of RVW-REC-${it.id} with outcome resolved_requires_update by ${snap.policy.roles.decision.data_layout.join(' or ')}, then a validated correction or F2 re-delivery` },
              invalidation_impact: { item_hash_changes: true, scopes: scopesFor(it.units.map((u) => u.name), 'data_record', it.id), note: 'Changing the data contract changes the record hash, every scope containing the unit, and any approval of them.' },
            });
          }
        });
        if (recEv.record?.claimed_total !== null && recEv.record?.source_total !== null && recEv.record.claimed_total !== recEv.record.source_total) {
          const pointer = `${loc.base}/total_bytes`;
          add({
            proposal_id: `RP-${digest(`${loc.doc.path}#${pointer}`).slice(0, 10)}`,
            proposal_key: `${loc.doc.path}#${pointer}`,
            kind: 'record_size_correction',
            root_cause_id: r.root_cause_id,
            status: 'proposed',
            target: { document: loc.doc.path, read_from: loc.doc.used, document_sha256: loc.doc.sha256, pointer, item_kind: 'data_record', item_id: it.id, item_sha256: it.sha256 },
            original_finding: { item: it.id, version_sha256: it.sha256 },
            original_value: recEv.record.claimed_total,
            proposed_value: recEv.record.source_total,
            alternatives: [],
            original_evidence: { total_bytes: recEv.record.claimed_total },
            new_evidence: { computed_from_source: recEv.record.source_total, flags: recEv.record.flags },
            deterministic_checks: [{ id: c.id, status: c.status, detail: c.detail }],
            source_hashes: sources,
            reason: `The record layout in the source occupies ${recEv.record.source_total} bytes (REDEFINES/OCCURS applied), not ${recEv.record.claimed_total}.`,
            affected_requirements: [],
            affected_decisions: relatedDecisions(it.id),
            required_role: snap.policy.roles.decision.data_layout,
            authorization: { status: 'not_authorized', requires: `a signed resolution of RVW-REC-${it.id} (resolved_requires_update), then a validated correction or F2 re-delivery` },
            invalidation_impact: { item_hash_changes: true, scopes: scopesFor(it.units.map((u) => u.name), 'data_record', it.id), note: 'Changing the data contract changes every scope containing the unit.' },
          });
        }
      }
    }
    void root;
  }
  const tally = (f: (p: any) => string) => out.reduce((m: Record<string, number>, p) => ((m[f(p)] = (m[f(p)] ?? 0) + 1), m), {});
  return {
    contract: 'remediation-proposals',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: snap.wf.run.manifestSha256,
    rule: 'Proposals are evidence-backed suggestions. None is applied or authorised here; each needs a signed resolution and a validated versioned correction. Originals, receipts, previous corrections and earlier proposals are never modified.',
    previous_record: previous?.record_id ?? null,
    summary: { proposals: out.length, by_kind: tally((p) => p.kind), new: out.filter((p) => !p.previous_version).length, changed: out.filter((p) => p.previous_version && !p.previous_version.unchanged).length, unchanged: out.filter((p) => p.previous_version?.unchanged).length, authorized: 0 },
    proposals: out,
  };
}
