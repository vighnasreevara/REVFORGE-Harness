/**
 * Human-readable STEP 4.5 report, rendered only from the sealed analysis
 * records of one run. Tracked regression issues are located through the
 * configured tracked-issue patterns (config/tracked-issues.json), never
 * through names in code.
 */
import * as path from 'path';
import { loadTrackedIssues } from '../remediation/remediation';
import type { Analysis } from './pipeline';

const t = (o: Record<string, number> | undefined) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
const esc = (s: string) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');

export function renderStep45Report(a: Analysis, r: { audit: any; registry: any; det: any; proposals: any; queue: any; readiness: any; packets: any; sealed: Record<string, { id: string; sha256: string }> }): string {
  const L: string[] = [];
  const c = (name: string) => r.audit.counts.find((x: any) => x.name === name);
  const rec = r.audit.reconciliation;
  L.push('# STEP 4.5 — G2 blocker consolidation, root causes and deterministic source verification', '');
  L.push(`Run \`${a.snap.wf.run.runId}\`, baseline \`${a.snap.wf.run.manifestSha256}\`, generated ${a.snap.at.toISOString()} by \`verification report\`. Every figure below is computed from the sealed records listed at the end; nothing was resolved, approved or excluded by this analysis.`, '');
  L.push('## 1. Count reconciliation', '');
  L.push('| Count | Value | What it counts |', '|---|---|---|');
  for (const x of r.audit.counts) L.push(`| ${x.name} | ${x.value} | ${esc(x.definition).slice(0, 220)} |`);
  L.push('');
  L.push(`- Register decisions by origin: ${t(c('register_decisions').breakdown)}.`);
  L.push(`- Blocking unresolved decisions by origin: ${t(c('blocking_unresolved_decisions').breakdown)}.`);
  L.push(`- Each blocking decision appears in the application scope ${rec.decisions_vs_findings.represented_by_own_decision_finding}× as its own finding and ${rec.decisions_vs_findings.represented_by_item_finding}× through the item it reviews (${rec.decisions_vs_findings.not_in_scope} not in scope).`);
  L.push(`- Blocking findings: ${rec.scope_findings_equation.blocking_findings} = ${t(rec.scope_findings_equation.by_kind)} (balanced: ${rec.scope_findings_equation.balanced}). ${rec.decisions_vs_findings.blocking_findings_without_a_decision} blocking findings have no decision behind them (rules, contradictions, coverage, packets, dependencies); ${rec.decisions_vs_findings.item_findings_blocked_only_by_other_decisions} items are blocked only through another subject's decision.`);
  L.push(`- REQUIRES_EVIDENCE findings: ${c('requires_evidence_findings').value} = ${c('requires_evidence_findings').breakdown.blocking} blocking + ${c('requires_evidence_findings').breakdown.non_blocking} non-blocking (${t(c('requires_evidence_findings').breakdown.by_category)}).`);
  L.push(`- CONTRADICTED findings: ${c('contradicted_findings').value} (${t(c('contradicted_findings').breakdown)}).`);
  L.push(`- G2 check table: the rows sum to ${rec.g2_check_table.sum_of_rows} but cover ${rec.g2_check_table.distinct_blocking_findings_in_rows} distinct blocking findings (rows overlap: ${rec.g2_check_table.pairwise_overlaps.map((o: any) => `${o.a}∩${o.b}=${o.shared}`).join(', ') || 'none'}); ${rec.g2_check_table.blocking_findings_in_no_row.length} blocking findings are in no row.`, '');

  const s = r.registry.summary;
  L.push('## 2. Root causes', '');
  L.push(`**Unique root causes:** the ${s.blocking_findings} blocking findings stem from ${s.primary_root_causes_of_blocking_findings} distinct primary root causes; the ${s.blocking_unresolved_decisions} blocking decisions from ${s.primary_root_causes_of_blocking_decisions}; together ${s.primary_root_causes_of_blocking_findings_or_decisions}. The registry holds ${s.root_causes} roots in all; ${s.blocking_root_causes} are linked (primarily or secondarily) to something blocking.`, '');
  L.push(`${s.root_causes} root causes (${s.blocking_root_causes} blocking) link all ${s.decisions_mapped}/${s.register_decisions} decisions and ${s.blocking_findings_mapped}/${s.blocking_findings} blocking findings (unmapped: ${s.blocking_findings_without_root.length}). ${s.decisions_sharing_a_root_with_another_decision} decisions share their primary root cause with at least one other decision (${s.roots_with_several_decisions} roots carry several decisions). Grouping removed no decision and no blocker.`, '');
  L.push(`Blocking root causes by category: ${t(s.blocking_by_category)}.`, '');
  L.push('Largest blocking root causes:', '', '| Root cause | Category | Decisions | Blocking findings | Program scopes blocked | Evidence |', '|---|---|---|---|---|---|');
  for (const x of [...r.registry.roots].filter((y: any) => y.blocking).sort((p: any, q: any) => q.related.decisions.length + q.approval_scope_impact.application_blocking_findings - (p.related.decisions.length + p.approval_scope_impact.application_blocking_findings)).slice(0, 15)) L.push(`| ${x.root_cause_id} ${esc(x.title).slice(0, 80)} | ${x.category} | ${x.related.decisions.length} | ${x.approval_scope_impact.application_blocking_findings} | ${x.approval_scope_impact.program_scopes_blocked.length} | ${x.evidence_status} |`);
  L.push('');

  L.push('## 3. Deterministic source verification', '');
  L.push(`Source root ${r.det.source_root.configured ? `configured (${r.det.source_root.origin}, ${r.det.source_root.files_indexed} files, read-only)` : '**not configured — no source check executed**'}; ${r.det.summary.programs_structurally_verified}/${r.det.summary.programs} programs structurally verified (every parser statement and paragraph at its cited line). Source files changed since the previous run: ${r.det.changed_since_previous.changed.length ? r.det.changed_since_previous.changed.join(', ') : 'none'}${r.det.changed_since_previous.previous_record ? ` (vs ${r.det.changed_since_previous.previous_record})` : ' (first run)'}.`, '');
  L.push(`Root-cause outcomes: ${t(r.det.summary.by_status)}.`, '');
  L.push(`Next step required: ${t(r.det.summary.by_next_step)}.`, '');
  const pf = r.det.program_facts as Record<string, any>;
  const facts = Object.entries(pf).filter(([, f]) => f && (f.fd_record_lengths.length || f.io_mode_conflicts.length || f.missing_perform_or_goto_targets.length));
  if (facts.length) {
    L.push('Facts computed from the source (not interpretations):', '');
    for (const [p, f] of facts) {
      for (const x of f.fd_record_lengths) L.push(`- ${p}: FD ${x.fd} declares RECORD CONTAINS ${x.declared.min}${x.declared.max ? ` TO ${x.declared.max}` : ''}; its record(s) occupy ${x.records.map((y: any) => `${y.name}=${y.size ?? '?'} bytes`).join(', ')}.`);
      for (const x of f.io_mode_conflicts) L.push(`- ${p}: ${x.verb} ${x.file} at line ${x.line}, but the file is opened only ${x.opened_as.join('/')}.`);
      for (const x of f.missing_perform_or_goto_targets) L.push(`- ${p}: ${x.via} ${x.target} at line ${x.line} has no paragraph in the PROCEDURE DIVISION${x.defined_in_member_copied_into_data_division ? ` (a paragraph of that name is in member ${x.defined_in_member_copied_into_data_division.member}, which is copied into the DATA DIVISION at line ${x.defined_in_member_copied_into_data_division.copy_line})` : ' or in any member copied into it'}.`);
    }
    L.push('');
  }

  const tracked = loadTrackedIssues(path.join(a.snap.wf.run.ctx.forwardDir, 'config', 'tracked-issues.json'));
  if (tracked.issues.length) {
    L.push('### Tracked Step 3.5 issues (located through config/tracked-issues.json)', '', '| Issue | Root cause(s) | Deterministic outcome | Next step | What the source establishes |', '|---|---|---|---|---|');
    const res = new Map<string, any>(r.det.results.map((x: any) => [x.root_cause_id, x]));
    for (const i of tracked.issues) {
      const roots = r.registry.roots.filter((x: any) => x.related.decisions.some((d: string) => {
        const dec = a.snap.register.get(d);
        return dec && i.patterns.every((p) => p.test(JSON.stringify({ id: d, q: dec.question, rules: dec.rule_ids })));
      }));
      const shown = roots.slice(0, 3);
      L.push(`| ${esc(i.issue)} | ${shown.map((x: any) => x.root_cause_id).join(', ') || 'none found'}${roots.length > 3 ? ` (+${roots.length - 3})` : ''} | ${shown.map((x: any) => res.get(x.root_cause_id)?.status).join(', ')} | ${[...new Set(shown.map((x: any) => res.get(x.root_cause_id)?.next_step))].join(', ')} | ${esc(shown.map((x: any) => res.get(x.root_cause_id)?.establishes).filter(Boolean).join('; ')).slice(0, 200)} |`);
    }
    L.push('');
  }
  const cit = r.det.results.filter((x: any) => x.key.startsWith('CIT:'));
  if (cit.length) {
    L.push('### Contradicted citations', '', '| Item | Outcome | Analysis |', '|---|---|---|');
    for (const x of cit) L.push(`| ${x.key.slice(4)} | ${x.status} | ${esc(x.checks.map((ch: any) => ch.detail).join('; ')).slice(0, 260)} |`);
    L.push('');
  }

  L.push('## 4. Remediation proposals', '');
  L.push(`${r.proposals.summary.proposals} proposal(s) (${t(r.proposals.summary.by_kind)}); new ${r.proposals.summary.new}, changed ${r.proposals.summary.changed}, unchanged ${r.proposals.summary.unchanged}. **Authorised: ${r.proposals.summary.authorized}.** None is applied; each needs a signed resolution and a validated versioned correction.`, '');
  if (r.proposals.proposals.length) {
    L.push('| Proposal | Kind | Target | Original → proposed | Authority |', '|---|---|---|---|---|');
    for (const p of r.proposals.proposals.slice(0, 40)) L.push(`| ${p.proposal_id} v${p.version} | ${p.kind} | ${esc(p.target.item_id)} ${esc(p.target.pointer)} | ${esc(JSON.stringify(p.original_value))} → ${esc(JSON.stringify(p.proposed_value ?? p.alternatives.map((x: any) => x.value)))} | ${p.required_role.join(' / ')} |`);
    L.push('');
  }

  L.push('## 5. Review queue (one entry per blocking root cause)', '');
  L.push(`${r.queue.summary.entries} entries; full decision view unchanged (${r.queue.summary.full_decision_view_size} decisions).`, '', '| Class | Meaning | Root causes | Decisions linked |', '|---|---|---|---|');
  for (const [k, v] of Object.entries(r.queue.classes)) L.push(`| ${k} | ${v} | ${r.queue.summary.by_class[k] ?? 0} | ${r.queue.summary.decisions_linked_by_class[k] ?? 0} |`);
  L.push('', `Readiness for review: ${t(r.queue.summary.by_readiness)}. By functional area: ${t(r.queue.summary.by_area)}.`, '');

  L.push('## 6. Scope readiness (existing G2 evaluator)', '');
  L.push(`Application: ${t(r.readiness.summary.application)}; programs: ${t(r.readiness.summary.programs)}; shared-dependency scopes: ${t(r.readiness.summary.shared_dependency_scopes)}; requirements: ${t(r.readiness.summary.requirements)}. Trust anchor usable: ${r.readiness.trust_anchor_usable}.`, '');
  L.push('| Scope | Readiness | Blocking | Specific | Shared | Source-evidence | SME | Technical | Root causes |', '|---|---|---|---|---|---|---|---|---|');
  for (const x of r.readiness.scopes.filter((y: any) => y.kind !== 'requirement')) L.push(`| ${esc(x.label)} | ${x.readiness} | ${x.blocking_findings} | ${x.blockers_specific_to_scope} | ${x.blockers_shared_with_other_scopes} | ${x.source_evidence_defects} | ${x.sme_decisions} | ${x.technical_decisions} | ${x.distinct_root_causes} |`);
  const reqs = r.readiness.scopes.filter((y: any) => y.kind === 'requirement');
  L.push('', `Requirement scopes: ${reqs.length}; READY ${reqs.filter((x: any) => x.readiness === 'READY').length}; fewest blockers: ${[...reqs].sort((p: any, q: any) => p.blocking_findings - q.blocking_findings).slice(0, 5).map((x: any) => `${x.label} (${x.blocking_findings})`).join(', ')}.`, '');

  L.push('## 7. Independent semantic review packets (prepared, not sent)', '');
  L.push(`${r.packets.summary.packets} packet(s); status ${t(r.packets.summary.by_status)}; leaks detected ${r.packets.summary.leaks_detected}; packets without available source ${r.packets.summary.without_available_source}. Source export: **${r.packets.export_authorization.status}** — ${esc(r.packets.export_authorization.reason)}`, '');
  L.push(`${r.packets.separation}`, '');

  L.push('## 8. Gate and approval status', '');
  L.push(`Application scope ${a.app.readiness} (${a.app.summary.blocking} blocking). Trust anchor ${a.snap.trust.usable ? 'usable' : 'not provisioned'}. No decision was resolved, no requirement approved, no correction applied by STEP 4.5.`, '');
  L.push('## Sealed records', '', '| Record | SHA-256 |', '|---|---|');
  for (const [k, v] of Object.entries(r.sealed)) L.push(`| workflow/step45/${v.id}.json (${k}) | \`${v.sha256}\` |`);
  return L.join('\n') + '\n';
}
