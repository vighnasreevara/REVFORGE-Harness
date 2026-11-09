/**
 * `verification` command: STEP 4.5 blocker analysis. Every sub-command seals
 * a new analysis record; none changes evidence, decisions or gates.
 */
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { loadWorkflow, OrchestratorError } from '../orchestrator/orchestrator';
import { openaiCommand } from './openai';
import { contextCommand } from './context';
import { cmdAudit, cmdClassify, cmdDeterministic, cmdOpenAI, cmdReadiness, cmdRemediation, cmdReport, cmdRootCauses } from '../blockers/pipeline';

type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);
const tally = (o: Record<string, number> | undefined) => Object.entries(o ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';

export function verificationCommand(ctx: RuntimeContext, group: string | undefined, action: string | undefined, flags: Flags, json: boolean, out: Out, err: Out): number | Promise<number> {
  // STEP 5 independent verification (all actions except the STEP 4.5 packet preparation).
  if (group === 'openai' && action !== 'prepare') return openaiCommand(ctx, action, flags, json, out, err);
  // STEP 9 dependency-aware source-context verification.
  if (group === 'context') return contextCommand(ctx, action, flags, json, out, err);
  const runId = str(flags, 'run') ?? 'latest';
  const print = (o: unknown, text: () => void) => (json ? out(JSON.stringify(o, null, 2)) : text());
  const key = `${group ?? ''} ${action ?? ''}`.trim();
  try {
    const wf = loadWorkflow(ctx, runId);
    switch (key) {
      case 'blockers audit': {
        const r = cmdAudit(wf);
        print(r.record, () => {
          out(`${r.id}: blocker count audit (${r.record.scope})`);
          for (const c of r.record.counts) out(`  ${c.name}: ${c.value} — ${c.unit}`);
          const e = r.record.reconciliation.scope_findings_equation;
          out(`  blocking findings ${e.blocking_findings} = ${tally(e.by_kind)} (balanced: ${e.balanced})`);
          const g = r.record.reconciliation.g2_check_table;
          out(`  G1 check rows sum ${g.sum_of_rows} over ${g.distinct_blocking_findings_in_rows} distinct blocking findings (${g.blocking_findings_in_no_row.length} in no row)`);
        });
        return 0;
      }
      case 'blockers root-causes': {
        const r = cmdRootCauses(wf);
        const s = r.record.summary;
        print(r.record, () => {
          out(`${r.id}: ${s.root_causes} root causes (${s.blocking_root_causes} blocking); ${s.decisions_mapped}/${s.register_decisions} decisions and ${s.blocking_findings_mapped}/${s.blocking_findings} blocking findings mapped`);
          out(`  ${s.decisions_sharing_a_root_with_another_decision} decisions share a root cause with another decision; blocking by category: ${tally(s.blocking_by_category)}`);
        });
        return s.blocking_findings_without_root.length ? 1 : 0;
      }
      case 'blockers classify': {
        const r = cmdClassify(wf);
        print(r.record, () => {
          out(`${r.id}: ${r.record.summary.entries} queue entries — ${tally(r.record.summary.by_class)}`);
          for (const [k, v] of Object.entries(r.record.classes)) out(`  ${k}: ${v} — ${r.record.summary.by_class[k] ?? 0} root cause(s), ${r.record.summary.decisions_linked_by_class[k] ?? 0} decision(s)`);
        });
        return 0;
      }
      case 'source deterministic': {
        const r = cmdDeterministic(wf);
        print(r.record, () => {
          out(`${r.id}: source ${r.record.source_root.configured ? 'configured (read-only)' : 'NOT configured — no checks executed'}; ${r.record.summary.executed}/${r.record.summary.roots} root causes checked`);
          out(`  outcomes: ${tally(r.record.summary.by_status)}`);
          out(`  next steps: ${tally(r.record.summary.by_next_step)}`);
          out(`  programs structurally verified: ${r.record.summary.programs_structurally_verified}/${r.record.summary.programs}; changed sources since previous run: ${r.record.changed_since_previous.changed.length}`);
        });
        return 0;
      }
      case 'remediation prepare': {
        const r = cmdRemediation(wf);
        print(r.record, () => {
          out(`${r.id}: ${r.record.summary.proposals} proposal(s) — ${tally(r.record.summary.by_kind)}; authorised ${r.record.summary.authorized}`);
          for (const p of r.record.proposals) out(`  ${p.proposal_id} v${p.version} ${p.kind} ${p.target.item_id} ${p.target.pointer}: ${JSON.stringify(p.original_value)} -> ${JSON.stringify(p.proposed_value)}`);
        });
        return 0;
      }
      case 'scope readiness': {
        const r = cmdReadiness(wf, { requirements: flags['no-requirements'] !== true });
        print(r.record, () => {
          for (const [k, v] of Object.entries(r.record.summary)) out(`  ${k}: ${tally(v as any)}`);
          for (const s of r.record.scopes.filter((x: any) => x.kind !== 'requirement')) out(`  ${s.label.padEnd(24)} ${s.readiness.padEnd(9)} blocking ${String(s.blocking_findings).padStart(4)} (specific ${s.blockers_specific_to_scope}, shared ${s.blockers_shared_with_other_scopes}; evidence ${s.source_evidence_defects}, SME ${s.sme_decisions}, technical ${s.technical_decisions}; ${s.distinct_root_causes} root causes)`);
        });
        return 0;
      }
      case 'openai prepare': {
        const r = cmdOpenAI(wf);
        print(r.record, () => {
          out(`${r.id}: ${r.record.summary.packets} packet(s) prepared, none sent — ${tally(r.record.summary.by_status)}`);
          out(`  source export: ${r.record.export_authorization.status} — ${r.record.export_authorization.reason}`);
          out(`  pass A: ${r.pass_a.id}; pass B: ${r.pass_b.id}; leaks detected ${r.record.summary.leaks_detected}`);
        });
        return 0;
      }
      case 'report': {
        const fwd = ctx.forwardDir;
        const r = cmdReport(wf, { exportDir: path.resolve(str(flags, 'export-dir') ?? path.join(fwd, 'reports', 'step-4.5')), reportFile: path.resolve(str(flags, 'out') ?? path.join(fwd, 'reports', 'STEP-4.5-REPORT.md')) });
        print(r, () => {
          for (const [k, v] of Object.entries(r.sealed)) out(`  sealed ${k}: workflow/step45/${v.id}.json`);
          out(`  exports: ${r.export_dir}`);
          out(`  report: ${r.report}`);
        });
        return 0;
      }
      default:
        err('verification: use blockers audit | blockers root-causes | blockers classify | source deterministic | remediation prepare | scope readiness | report | openai doctor|packets|prepare|review|compare|report|usage|authorize|revoke|authorization-request');
        return 2;
    }
  } catch (e) {
    if (e instanceof OrchestratorError) {
      err(`verification ${key}: ${e.message}`);
      for (const d of e.details) err(`  - ${d}`);
      return 1;
    }
    if (e instanceof Error) {
      err(`verification ${key}: ${e.message}`);
      return 1;
    }
    throw e;
  }
}
