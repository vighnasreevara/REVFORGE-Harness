/**
 * Versioned REVFORGE -> BMad input mapping (STEP 6). Builds the inputs a
 * bound BMad workflow may read for one exact scope, directly from the
 * runtime's records: accepted requirement and data items of the scope, the
 * canonical rules with the reverse run that issued their IDs, signed decision
 * resolutions, the signed G2 approval and recorded upstream results. Nothing
 * is summarised or rewritten; every element keeps its IDs, source references
 * and record hash, and the provenance sidecar repeats them for re-checking.
 */
import { buildSnapshot, Snapshot } from '../approval/snapshot';
import { evaluateScope, parseSelector, ScopeEvaluation } from '../approval/scope';
import { approvalRecords, evaluateG2Gate } from '../approval/approvals';
import { canonicalize } from '../approval/canonical';
import { sha256Buffer } from '../core/fsutil';
import { Workflow } from '../orchestrator/orchestrator';
import { Binding } from './bindings';
import { UpstreamReceipt } from './eligibility';
import { reconcileScope, Reconciliation } from './reconcile';

export interface MappedInput {
  name: string;
  content: any;
  sha256: string;
}

export interface Mapping {
  mapping_version: string;
  scope: string;
  scope_sha256: string;
  readiness: string;
  provenance: any;
  inputs: MappedInput[];
  reconciliation: Reconciliation;
}

const USABLE = new Set(['VERIFIED', 'APPROVED_EXCEPTION']);
export const jsonText = (x: unknown) => JSON.stringify(x, null, 2) + '\n';

function rulesSourceRun(snap: Snapshot): string | null {
  // source_runs is keyed "<artifact>@<agent version>#<sha prefix>".
  const runs = Object.keys(snap.wf.run.manifest?.source_runs ?? {});
  return runs.find((r) => r.startsWith('rules@')) ?? null;
}

/** Builds the mapped inputs and their shared provenance for `binding` on `scope`. Reads only. */
export function buildMapping(wf: Workflow, binding: Binding, scope: string, mappingSpec: any, upstream: UpstreamReceipt[], snap: Snapshot = buildSnapshot(wf)): Mapping {
  const ev: ScopeEvaluation = evaluateScope(snap, parseSelector(scope));
  const findings = ev.findings.filter((f) => f.outcome !== 'EXCLUDED_WITH_JUSTIFICATION');
  const items = (kinds: string[]) =>
    findings
      .filter((f) => kinds.includes(f.kind))
      .map((f) => ({ f, i: snap.itemById.get(f.id) }))
      .filter((x) => !!x.i)
      .map(({ f, i }) => ({ id: i!.id, kind: i!.kind, outcome: f.outcome, usable: USABLE.has(f.outcome), record_sha256: i!.sha256, receipt: i!.receipt, units: i!.units.map((u) => u.name), source_refs: i!.source_refs, open_decisions: i!.open_decisions, content: i!.data }))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  // Every included item carries the reason it is in scope (direct, shared dependency, cross-scope or global).
  const rec = reconcileScope(snap, scope, ev);
  const why = new Map<string, { inclusion: string; reason: string }>([...rec.requirements, ...rec.runtime_requirements, ...rec.data_contracts].map((r) => [r.id, { inclusion: r.inclusion, reason: r.reason }]));
  const withWhy = <T extends { id: string }>(xs: T[]) => xs.map((x) => ({ ...x, inclusion: why.get(x.id)?.inclusion ?? 'direct', inclusion_reason: why.get(x.id)?.reason ?? '' }));
  const requirements = withWhy(items(['requirement']));
  const runtime = withWhy(items(['runtime_requirement']));
  const data = withWhy(items(['data_record', 'file_operations']));
  const srcRun = rulesSourceRun(snap);
  const ruleIds = [...new Set(findings.filter((f) => f.kind === 'rule').map((f) => f.id))].sort();
  const rules = ruleIds.map((id) => ({ id, source_run: srcRun, outcome: findings.find((f) => f.kind === 'rule' && f.id === id)!.outcome, requirement_ids: [...new Set((snap.ruleEntries.get(id) ?? []).flatMap((e) => e.requirement_ids))].sort(), rule: snap.rules.get(id) ?? null }));
  const decisions = rec.decisions.map((x) => {
    const r = snap.resolutions.get(x.id);
    const d = snap.register.get(x.id);
    return { id: x.id, kind: x.kind, question: d?.question ?? null, status: x.status, blocking: x.blocking, effective_blocking: x.effective_blocking, class: x.class, inclusion_reason: x.reason, via: x.via, resolution_id: r?.effective?.resolution_id ?? null, outcome: r?.outcome ?? null, resolution_text: r?.effective?.resolution?.resolution_text ?? null };
  });
  const g2 = evaluateG2Gate(wf, snap.at);
  const validIds = new Set((g2.evaluation?.approvals ?? []).filter((a: any) => a.valid && a.decision === 'approved').map((a: any) => a.approval_id));
  const approvals = approvalRecords(wf)
    .filter((a) => validIds.has(a.approval_id) && a.scope.selector_text === ev.selector_text)
    .map((a) => ({ approval_id: a.approval_id, signer_id: a.signer.signer_id, role: a.signer.role, scope_sha256: a.scope.scope_sha256 }));
  const live = (b: string) => upstream.filter((u) => u.binding_id === b && u.accepted && u.mode === 'LIVE' && u.scope_sha256 === ev.scope_sha256);
  const ups = upstream.filter((u) => u.accepted && u.mode === 'LIVE' && u.scope_sha256 === ev.scope_sha256).map((u) => ({ receipt_id: u.receipt_id, binding_id: u.binding_id, sha256: u.sha256 }));

  const provenance = {
    contract: 'bmad/provenance',
    contract_version: '1.0',
    mapping_version: mappingSpec.mapping_version,
    binding_id: binding.binding_id,
    workflow_id: binding.workflow_id,
    scope: ev.selector_text,
    scope_sha256: ev.scope_sha256,
    baseline: { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 },
    requirements: requirements.map((r) => ({ id: r.id, kind: r.kind, record_sha256: r.record_sha256, receipt: r.receipt, outcome: r.outcome, inclusion: r.inclusion, source_refs: r.source_refs })),
    runtime_requirements: runtime.map((r) => ({ id: r.id, kind: r.kind, record_sha256: r.record_sha256, receipt: r.receipt, outcome: r.outcome, inclusion: r.inclusion, source_refs: r.source_refs })),
    rules: rules.map((r) => ({ id: r.id, source_run: r.source_run, requirement_ids: r.requirement_ids })),
    data_contracts: data.map((d) => ({ id: d.id, kind: d.kind, record_sha256: d.record_sha256, receipt: d.receipt })),
    decisions: decisions.map((d) => ({ id: d.id, resolution_id: d.resolution_id, outcome: d.outcome, class: d.class, effective_blocking: d.effective_blocking })),
    reconciliation_sha256: rec.reconciliation_sha256,
    approvals,
    upstream_receipts: ups,
  };
  const common = { mapping_version: mappingSpec.mapping_version, scope: ev.selector_text, scope_sha256: ev.scope_sha256, baseline_manifest_sha256: wf.run.manifestSha256 };
  const docs: Record<string, any> = {
    'approved-requirements': { ...common, requirements },
    'runtime-requirements': { ...common, runtime_requirements: runtime },
    'business-rules': { ...common, rules_source_run: srcRun, rules },
    'data-contracts': { ...common, data_contracts: data },
    decisions: { ...common, decisions },
    approval: { ...common, approvals, g2: { status: g2.result.status, reason: g2.result.reason } },
    architecture: { ...common, upstream: ups.filter((u) => u.binding_id === 'BMAD-ARCH') },
    stories: { ...common, upstream: ups.filter((u) => u.binding_id === 'BMAD-EPICS'), story_ids: [...new Set(live('BMAD-EPICS').flatMap((u) => (u.result?.epics ?? []).flatMap((e: any) => e.stories.map((s: any) => s.story_id))))].sort() },
    implementation: { ...common, upstream: ups.filter((u) => u.binding_id === 'BMAD-BUILD'), files: live('BMAD-BUILD').flatMap((u) => (u.result?.files ?? []).map((f: any) => ({ path: f.path, sha256: f.sha256, receipt_id: u.receipt_id }))) },
    'independent-tests': { ...common, note: 'F6 receipts are read from the forward workflow receipts; BMad never produces them' },
  };
  const spec: Array<{ name: string }> = mappingSpec.inputs[binding.binding_id] ?? [];
  const inputs = spec.map((s) => {
    const content = docs[s.name];
    if (content === undefined) throw new Error(`mapping ${mappingSpec.mapping_version} names unknown input '${s.name}' for ${binding.binding_id}`);
    return { name: s.name, content, sha256: sha256Buffer(jsonText(content)) };
  });
  return { mapping_version: mappingSpec.mapping_version, scope: ev.selector_text, scope_sha256: ev.scope_sha256, readiness: ev.readiness, provenance, inputs, reconciliation: rec };
}

/** Requirement IDs a result may cite: usable (verified or approved-exception) requirements of the scope. */
export function usableRequirementIds(m: Mapping): Set<string> {
  const doc = m.inputs.find((i) => i.name === 'approved-requirements')?.content;
  const src = doc ?? { requirements: m.provenance.requirements.map((r: any) => ({ ...r, usable: USABLE.has(r.outcome), kind: r.kind })) };
  return new Set<string>(src.requirements.filter((r: any) => r.usable && r.kind === 'requirement').map((r: any) => r.id));
}

export const provenanceDigest = (p: any) => sha256Buffer(canonicalize(p));
