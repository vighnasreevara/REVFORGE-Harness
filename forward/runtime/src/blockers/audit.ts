/**
 * Deterministic reconciliation of the G1 blocker counts.
 *
 * Several numbers describe G1 and they count different things:
 *   - register decisions (agent, consolidation and runtime-derived),
 *   - blocking unresolved decisions (a property of the whole register),
 *   - blocking findings of a scope (items, rules, decisions, contradictions,
 *     coverage, packets, dependencies — one per evaluated subject),
 *   - findings by outcome (REQUIRES_EVIDENCE, CONTRADICTED, ...), and
 *   - the G1 check table, whose rows are overlapping finding sets.
 * This module recomputes each count from the runtime's records, lists the
 * exact identifiers, and proves how the universes map onto each other. It
 * never changes a finding to make totals agree.
 */
import { G1_CHECK_SETS } from '../approval/approvals';
import { RegDecision } from '../approval/decisions';
import { Finding, ScopeEvaluation } from '../approval/scope';
import { Snapshot } from '../approval/snapshot';
import { relPath } from './records';

export const ITEM_KINDS = ['requirement', 'runtime_requirement', 'file_operations', 'data_record'];

/** Subtype of a register decision, from its origin (never from its text). */
export function decisionSubtype(d: RegDecision): string {
  if (d.origin.type === 'agent') return `agent:${d.kind}`;
  if (d.origin.type === 'consolidation') return 'consolidation';
  if (d.kind === 'scope') return 'derived:scope';
  if (d.origin.item?.kind === 'gap') return 'derived:unaddressed_gap';
  return `derived:review:${d.origin.item?.kind ?? 'item'}`;
}

const tally = <T>(xs: T[], key: (x: T) => string) => xs.reduce((m: Record<string, number>, x) => ((m[key(x)] = (m[key(x)] ?? 0) + 1), m), {});
const ids = (xs: Array<{ id?: string; decision_id?: string }>) => xs.map((x) => (x.id ?? x.decision_id) as string).sort();

export function inputsOf(snap: Snapshot): Array<{ kind: string; path: string; sha256: string | null }> {
  const wf = snap.wf;
  const out: Array<{ kind: string; path: string; sha256: string | null }> = [{ kind: 'baseline_manifest', path: wf.state.baseline.manifest_path, sha256: wf.run.manifestSha256 }];
  for (const r of snap.receipts) {
    out.push({ kind: `receipt:${r.receipt.agent}`, path: relPath(wf, wf.store.p('receipts', `${r.receipt_id}.json`)), sha256: snap.integrity.receipt_hashes.find((x) => x.receipt_id === r.receipt_id)?.sha256 ?? null });
    for (const o of r.verdict.provenance?.outputs ?? []) out.push({ kind: 'deliverable', path: o.path, sha256: o.runtime_sha256 });
  }
  if (snap.consolidation.record) out.push({ kind: 'consolidation', path: `workflow/consolidation/${snap.consolidation.record}.json`, sha256: null });
  if (snap.packetStatus) out.push({ kind: 'packet_status', path: `workflow/packet-status/${snap.packetStatus.id}.json`, sha256: null });
  out.push({ kind: 'policy', path: 'config/forward.config.json#approval', sha256: snap.policy_sha256 });
  return out;
}

export function auditCounts(snap: Snapshot, app: ScopeEvaluation): any {
  const reg = [...snap.register.values()];
  const unresolved = (d: RegDecision) => snap.resolutions.get(d.decision_id)!.status !== 'resolved';
  const blockingDecisions = reg.filter((d) => d.blocking && unresolved(d));
  const F = app.findings;
  const blockingFindings = F.filter((f) => f.blocking);
  const findingById = new Map(F.map((f) => [`${f.kind}|${f.id}`, f]));
  const findingIds = new Set(F.map((f) => f.id));

  // How each blocking decision appears in the application scope.
  const representation = blockingDecisions.map((d) => {
    const item = d.origin.type === 'derived' ? d.origin.item : undefined;
    let how: string;
    let finding: string | null = null;
    if (item && ITEM_KINDS.includes(item.kind)) {
      const f = findingById.get(`${item.kind}|${item.id}`);
      how = f ? (f.blocking ? 'as_its_item_finding' : 'item_finding_not_blocking') : 'item_not_in_scope';
      finding = f?.id ?? null;
    } else if (findingIds.has(d.decision_id)) {
      const f = F.find((x) => x.id === d.decision_id)!;
      how = f.blocking ? 'as_its_own_decision_finding' : 'own_finding_not_blocking';
      finding = f.id;
    } else how = 'not_in_scope';
    return { decision_id: d.decision_id, subtype: decisionSubtype(d), representation: how, finding };
  });

  // What each blocking finding stands for.
  const kindOf = (f: Finding): string => {
    if (ITEM_KINDS.includes(f.kind)) {
      const own = snap.register.get(f.kind === 'data_record' ? `RVW-REC-${f.id}` : `RVW-${f.id}`);
      const ownBlocking = own && own.blocking && unresolved(own);
      const viaOthers = f.decisions.filter((x) => !x.startsWith('RVW-'));
      return ownBlocking ? 'item_with_own_review_decision' : viaOthers.length ? 'item_blocked_only_by_other_decisions' : 'item_without_decision';
    }
    if (snap.register.has(f.id)) return `decision:${decisionSubtype(snap.register.get(f.id)!)}`;
    return `non_decision:${f.category}:${f.kind}`;
  };
  const blockingByKind = tally(blockingFindings, kindOf);

  // Each blocking finding is counted once; the G1 check rows overlap.
  const checkSets = G1_CHECK_SETS.map((c) => {
    const s = c.select(F).filter((f) => f.blocking);
    return { check: c.id, label: c.label, blocking: s.length, ids: s.map((f) => `${f.kind}|${f.id}`).sort() };
  });
  const union = new Set(checkSets.flatMap((c) => c.ids));
  const overlap: Array<{ a: string; b: string; shared: number }> = [];
  for (let i = 0; i < checkSets.length; i++) for (let j = i + 1; j < checkSets.length; j++) {
    const b = new Set(checkSets[j].ids);
    const shared = checkSets[i].ids.filter((x) => b.has(x)).length;
    if (shared) overlap.push({ a: checkSets[i].check, b: checkSets[j].check, shared });
  }
  const notInAnyCheck = blockingFindings.filter((f) => !union.has(`${f.kind}|${f.id}`)).map((f) => ({ id: f.id, kind: f.kind, category: f.category }));

  const evidence = F.filter((f) => f.outcome === 'REQUIRES_EVIDENCE');
  const contradicted = F.filter((f) => f.outcome === 'CONTRADICTED');
  const repCounts = tally(representation, (r) => r.representation);
  const equation = {
    blocking_findings: blockingFindings.length,
    by_kind: blockingByKind,
    sum_by_kind: Object.values(blockingByKind).reduce((a, b) => a + b, 0),
    balanced: Object.values(blockingByKind).reduce((a, b) => a + b, 0) === blockingFindings.length,
  };
  return {
    contract: 'blocker-count-audit',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: snap.wf.run.manifestSha256,
    scope: app.selector_text,
    scope_sha256: app.scope_sha256,
    inputs: inputsOf(snap),
    counts: [
      {
        name: 'register_decisions',
        value: reg.length,
        definition: 'Every decision in the canonical register: decisions raised by accepted F1/F2 deliveries, cross-batch decisions of the current consolidation record, and decisions the runtime derives (one review decision per item that is not independently verified, one scope decision per program whose classification needs one, one review decision per gap no decision or requirement addresses).',
        method: 'buildRegister(snapshot); one entry per decision ID',
        unit: 'decision record',
        can_overlap: 'no (IDs are unique); several decisions may share one root cause',
        breakdown: tally(reg, decisionSubtype),
        ids: ids(reg),
      },
      {
        name: 'blocking_unresolved_decisions',
        value: blockingDecisions.length,
        definition: 'Register decisions with blocking=true whose current resolution status is not resolved (open, stale or untrusted). A property of the whole register, independent of any scope.',
        method: 'register.filter(blocking && resolution.status != resolved)',
        unit: 'decision record',
        can_overlap: 'no',
        breakdown: tally(blockingDecisions, decisionSubtype),
        representation_in_scope: repCounts,
        ids: ids(blockingDecisions),
      },
      {
        name: 'scope_blocking_findings',
        value: blockingFindings.length,
        definition: `Findings of scope ${app.selector_text} with blocking=true. One finding per evaluated subject: item (requirement, runtime requirement, file-operation set, data record), canonical rule, applicable non-item decision, recorded contradiction, coverage gap, unaccounted packet, unresolved dependency. A derived item-review decision is represented by its item finding, not counted twice.`,
        method: 'evaluateScope(snapshot, selector).findings.filter(blocking)',
        unit: 'finding (subject), not root cause',
        can_overlap: 'one subject per finding; one root cause can produce many findings',
        breakdown: { by_category: tally(blockingFindings, (f) => f.category), by_outcome: tally(blockingFindings, (f) => f.outcome), by_kind: blockingByKind },
        ids: blockingFindings.map((f) => `${f.kind}|${f.id}`).sort(),
      },
      {
        name: 'requires_evidence_findings',
        value: evidence.length,
        definition: 'Findings whose outcome is REQUIRES_EVIDENCE, blocking or not (unresolved dependencies that a gap or decision already tracks are REQUIRES_EVIDENCE but not blocking).',
        method: 'findings.filter(outcome == REQUIRES_EVIDENCE)',
        unit: 'finding',
        can_overlap: 'no',
        breakdown: { blocking: evidence.filter((f) => f.blocking).length, non_blocking: evidence.filter((f) => !f.blocking).length, by_category: tally(evidence, (f) => f.category) },
        ids: evidence.map((f) => `${f.kind}|${f.id}`).sort(),
      },
      {
        name: 'contradicted_findings',
        value: contradicted.length,
        definition: 'Findings whose outcome is CONTRADICTED: citation or attribute mismatches found by the source check, contradictory rule dispositions, and contradictions recorded by F1. Several may describe one underlying conflict (see the root-cause registry).',
        method: 'findings.filter(outcome == CONTRADICTED)',
        unit: 'finding',
        can_overlap: 'one conflict may appear as rule findings and as recorded contradictions',
        breakdown: tally(contradicted, (f) => `${f.category}:${f.kind}`),
        ids: contradicted.map((f) => `${f.kind}|${f.id}`).sort(),
      },
    ],
    reconciliation: {
      scope_findings_equation: equation,
      decisions_vs_findings: {
        blocking_unresolved_decisions: blockingDecisions.length,
        represented_by_own_decision_finding: repCounts.as_its_own_decision_finding ?? 0,
        represented_by_item_finding: repCounts.as_its_item_finding ?? 0,
        not_in_scope: (repCounts.not_in_scope ?? 0) + (repCounts.item_not_in_scope ?? 0),
        represented_but_finding_not_blocking: (repCounts.item_finding_not_blocking ?? 0) + (repCounts.own_finding_not_blocking ?? 0),
        blocking_findings_without_a_decision: blockingFindings.filter((f) => kindOf(f).startsWith('non_decision') || kindOf(f) === 'item_without_decision').length,
        item_findings_blocked_only_by_other_decisions: blockingByKind.item_blocked_only_by_other_decisions ?? 0,
        explanation: 'Blocking decisions and blocking findings are different universes. Each blocking decision appears in the scope either as its own finding (agent, consolidation, scope and unaddressed-gap decisions) or through the item it reviews. Findings without a decision (rules, contradictions, coverage, packets, dependencies) add to the finding count; items blocked only through another decision repeat that decision\'s effect on a second subject.',
      },
      g2_check_table: {
        rows: checkSets.map(({ ids: _i, ...rest }) => rest),
        sum_of_rows: checkSets.reduce((a, c) => a + c.blocking, 0),
        distinct_blocking_findings_in_rows: union.size,
        blocking_findings_in_no_row: notInAnyCheck,
        pairwise_overlaps: overlap,
        explanation: 'Check rows are overlapping views of the same findings, so their sum exceeds the number of distinct blocking findings; findings counted by no row are listed explicitly.',
      },
    },
  };
}
