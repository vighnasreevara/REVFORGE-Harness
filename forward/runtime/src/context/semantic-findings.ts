/**
 * Recorded semantic-dependency findings (STEP 12). The G2 snapshot computes
 * semantic dependency edges live, and fails closed whether or not anything is
 * recorded. These records make each newly found edge reviewable and auditable.
 *
 * Records are SDF-NNNN in workflow/context. They are versioned per item,
 * sealed in the audit log and never rewritten. An unchanged finding is not
 * recorded again. Earlier records (ESU, EAR, gate results, receipts) are not
 * touched.
 */
import { createHash } from 'crypto';
import { buildSnapshot } from '../approval/snapshot';
import { evaluateScope, parseSelector } from '../approval/scope';
import { sha256File } from '../core/fsutil';
import { mutate, Workflow } from '../orchestrator/orchestrator';
import { CONTEXT_DIR } from './context';

const digest = (o: unknown) => createHash('sha256').update(JSON.stringify(o)).digest('hex');

export function semanticFindings(wf: Workflow): any[] {
  return wf.store.list(CONTEXT_DIR).filter((f) => f.startsWith('SDF-')).map((f) => wf.store.readRecord(CONTEXT_DIR, f));
}

/** Items whose reached behaviour depends on a blocking decision they were not linked to before. */
export function semanticReport(wf: Workflow, scope?: string): any {
  const snap = buildSnapshot(wf);
  const ev = scope ? evaluateScope(snap, parseSelector(scope)) : null;
  const inScope = (id: string) => !ev || ev.findings.some((f) => f.id === id);
  const results = snap.items
    .filter((it) => (it.semantic_dependencies ?? []).some((d) => d.added) && inScope(it.id))
    .map((it) => ({
      item_id: it.id,
      item_kind: it.kind,
      item_sha256: it.sha256,
      evidence_status: it.evidence_status,
      claim_result: it.claim?.result ?? null,
      edges: (it.semantic_dependencies ?? []).filter((d) => d.added).map((d) => ({ decision_id: d.decision_id, names: d.names, statements: d.statements })),
      finding: 'SEMANTIC_DEPENDENCY_ON_OPEN_DECISION',
      reason: 'the cited behaviour uses name(s) the program declares nowhere; their meaning is the subject of the linked blocking decision(s), so the literal claim check cannot establish the runtime behaviour',
    }));
  return {
    contract: 'verification/semantic-dependency-report',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: wf.run.manifestSha256,
    scope: scope ?? 'application',
    summary: { items: results.length, edges: results.reduce((n, r) => n + r.edges.length, 0), by_kind: Object.fromEntries([...new Set(results.map((r) => r.item_kind))].map((k) => [k, results.filter((r) => r.item_kind === k).length])) },
    results,
  };
}

export function recordSemanticFindings(wf: Workflow, report: any): Array<{ finding_id: string; item_id: string; version: number; new: boolean }> {
  return mutate(wf, 'semantic dependency findings', () => {
    const all = semanticFindings(wf);
    const out: Array<{ finding_id: string; item_id: string; version: number; new: boolean }> = [];
    for (const r of report.results) {
      const content = digest(r);
      const mine = all.filter((a) => a.item_id === r.item_id).sort((a, b) => a.version - b.version);
      const prev = mine[mine.length - 1];
      if (prev && prev.content_sha256 === content) {
        out.push({ finding_id: prev.finding_id, item_id: r.item_id, version: prev.version, new: false });
        continue;
      }
      const id = `SDF-${String(wf.store.list(CONTEXT_DIR).filter((f) => f.startsWith('SDF-')).length + 1).padStart(4, '0')}`;
      const rec = {
        contract: 'verification/semantic-dependency',
        contract_version: '1.0',
        finding_id: id,
        item_id: r.item_id,
        version: (prev?.version ?? 0) + 1,
        supersedes: prev?.finding_id ?? null,
        recorded_at: new Date().toISOString(),
        baseline_manifest_sha256: wf.run.manifestSha256,
        item_sha256: r.item_sha256,
        content_sha256: content,
        result: r,
        effect: 'the G2 snapshot links the item to the listed blocking decisions (computed live, fail-closed); no decision is resolved and no earlier record is changed',
      };
      const v = wf.run.ctx.contracts.validate('verification/semantic-dependency', rec);
      if (!v.valid) throw new Error(`semantic dependency finding violates its contract: ${v.errors.join('; ')}`);
      const f = wf.store.writeRecord(CONTEXT_DIR, `${id}.json`, rec);
      wf.store.append('semantic_dependency_recorded', { finding_id: id, item_id: r.item_id, version: rec.version, decisions: r.edges.map((e: any) => e.decision_id), sha256: sha256File(f) });
      all.push(rec);
      out.push({ finding_id: id, item_id: r.item_id, version: rec.version, new: true });
    }
    wf.store.writeState(wf.state);
    return out;
  });
}
