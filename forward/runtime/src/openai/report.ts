/**
 * OpenAI verification report: rendered only from sealed run records. Mock
 * results are labelled as mock throughout; nothing here is presented as
 * real semantic verification unless a LIVE run with verified authorization
 * produced it.
 */
import { Workflow } from '../orchestrator/orchestrator';
import { authorizationStates } from './authorization';
import { apiKeyPresent, OpenAIConfig } from './config';
import { LIVE_NOT_AUTHORIZED, listRuns, OPENAI_DIR, usageSummary } from './engine';

const t = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';
const esc = (s: unknown) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');

function records(wf: Workflow, sub: string): any[] {
  return wf.store.list(`${OPENAI_DIR}/${sub}`).map((f) => wf.store.readRecord(`${OPENAI_DIR}/${sub}`, f));
}

export function openaiReport(wf: Workflow, cfg: OpenAIConfig): { markdown: string; data: any } {
  const runs = listRuns(wf);
  const passA = records(wf, 'pass-a');
  const passB = records(wf, 'pass-b');
  const adv = records(wf, 'advisory');
  const auth = authorizationStates(wf, cfg);
  const usage = usageSummary(wf);
  const live = runs.some((r) => r.live_status === 'LIVE_EXECUTED_WITH_VERIFIED_AUTHORIZATION');
  const cites = { verified: 0, rejected: 0 };
  const rejectedWhy: Record<string, number> = {};
  for (const r of [...passA, ...passB]) for (const f of r.findings) for (const c of f.citations) {
    if (c.status === 'VERIFIED') cites.verified++;
    else {
      cites.rejected++;
      for (const w of c.reasons) {
        const k = w.replace(/[A-Za-z0-9_./-]*\.(cbl|cpy|cob)[^ ]*/gi, '<file>').replace(/\d+/g, 'N').slice(0, 80);
        rejectedWhy[k] = (rejectedWhy[k] ?? 0) + 1;
      }
    }
  }
  const classes: Record<string, number> = {};
  for (const r of passB) for (const f of r.findings) classes[f.classification] = (classes[f.classification] ?? 0) + 1;
  const L: string[] = [];
  L.push('# OpenAI independent verification report', '');
  L.push(`Run \`${wf.run.runId}\` — baseline \`${wf.run.manifestSha256}\`. Configured provider ${cfg.provider}, model \`${cfg.model ?? 'not configured'}\` (capabilities verified ${cfg.model_verification?.verified_on ?? 'never'} from ${cfg.model_verification?.source ?? 'n/a'}), template ${cfg.template_version}.`, '');
  L.push(`**Live status: ${live ? 'LIVE verification executed with verified authorization' : LIVE_NOT_AUTHORIZED}.** Network enabled: ${cfg.network_enabled}; API key present: ${apiKeyPresent(cfg) ? 'yes (not shown)' : 'no'}; trust anchor: ${auth.trust.usable ? 'usable' : 'not provisioned'}; valid source-export authorizations: ${auth.states.filter((s) => s.valid).length} of ${auth.states.length}.`, '');
  L.push('## Runs', '', '| Run | Kind | Mode | Provider/model | Packets | Requests | Live status |', '|---|---|---|---|---|---|---|');
  for (const r of runs) L.push(`| ${r.verification_run_id} | ${r.kind} | ${r.mode} | ${r.provider} / ${r.model} | ${r.results.length} | ${r.requests.length} | ${esc(r.live_status).slice(0, 120)} |`);
  L.push('');
  const lastReview = [...runs].reverse().find((r) => r.kind === 'review');
  if (lastReview?.selection?.selected) {
    L.push(`Latest review ${lastReview.verification_run_id}: ${lastReview.selection.eligible} eligible packet(s), ${lastReview.selection.blocked.length} blocked, ${lastReview.selection.selected.length} selected (max ${lastReview.selection.max_packets}), ${lastReview.selection.not_selected} eligible but not selected.`, '');
    const why: Record<string, number> = {};
    for (const b of lastReview.selection.blocked) for (const w of b.reasons) why[w.replace(/[0-9a-f]{12}…/g, '…').slice(0, 90)] = (why[w.replace(/[0-9a-f]{12}…/g, '…').slice(0, 90)] ?? 0) + 1;
    L.push(`Blocked packets by reason: ${t(why)}.`, '');
  }
  L.push('## Pass A (independent interpretation)', '', '| Packet | Run | Mode | Status | Operations verified / total | Missing deps verified / total | Failures |', '|---|---|---|---|---|---|---|');
  for (const r of passA) {
    const ops = r.findings.filter((f: any) => f.kind === 'operation');
    const deps = r.findings.filter((f: any) => f.kind === 'missing_dependency');
    L.push(`| ${r.packet_id} | ${r.verification_run_id} | ${r.mode} | ${r.status} | ${ops.filter((f: any) => f.evidence_integrity === 'VERIFIED').length}/${ops.length} | ${deps.filter((f: any) => f.evidence_integrity === 'VERIFIED').length}/${deps.length} | ${esc(r.failures.map((f: any) => f.kind).join(', '))} |`);
  }
  L.push('', `Citations checked locally: ${cites.verified} verified, ${cites.rejected} rejected (${t(rejectedWhy)}).`, '');
  L.push('## Pass B (comparison with existing interpretations)', '', `Classifications: ${t(classes)}.`, '', '| Packet | Run | Mode | Status | Comparisons | Disagreements | Not compared |', '|---|---|---|---|---|---|---|');
  for (const r of passB) L.push(`| ${r.packet_id} | ${r.verification_run_id} | ${r.mode} | ${r.status} | ${r.findings.length} | ${r.findings.filter((f: any) => ['DISAGREEMENT', 'UNSUPPORTED_INTERPRETATION'].includes(f.classification)).length} | ${r.interpretations_not_compared.length} |`);
  L.push('', '### Disagreements', '');
  const dis = passB.flatMap((r) => r.findings.filter((f: any) => ['DISAGREEMENT', 'UNSUPPORTED_INTERPRETATION'].includes(f.classification)).map((f: any) => ({ r, f })));
  if (!dis.length) L.push('None recorded.', '');
  else {
    L.push('| Packet | Interpretation | Classification | Integrity | Explanation |', '|---|---|---|---|---|');
    for (const { r, f } of dis.slice(0, 50)) L.push(`| ${r.packet_id} (${r.mode}) | ${esc(f.content.interpretation_id)} | ${f.classification} | ${f.evidence_integrity} | ${esc(f.content.explanation).slice(0, 200)} |`);
    L.push('');
  }
  L.push('## Advisory review records', '', `Outcomes: ${t(adv.reduce((m: Record<string, number>, a) => ((m[a.advisory_outcome] = (m[a.advisory_outcome] ?? 0) + 1), m), {}))}. Advisory proposals: ${adv.reduce((n, a) => n + a.proposals.length, 0)} (deterministically supported ${adv.reduce((n, a) => n + a.proposals.filter((p: any) => p.deterministically_supported).length, 0)}). Every record states: ${adv[0]?.binding ?? 'advisory only'}.`, '');
  L.push('## Usage and budget', '', `Actual provider usage: ${usage.actual_provider_usage.calls} call(s), ${usage.actual_provider_usage.input_tokens} input / ${usage.actual_provider_usage.output_tokens} output tokens, $${usage.actual_provider_usage.cost_usd}.`, '', `Simulated mock usage (not OpenAI usage, no cost incurred): ${usage.simulated_mock_usage.calls} call(s), ${usage.simulated_mock_usage.input_tokens} input / ${usage.simulated_mock_usage.output_tokens} output tokens (would cost $${usage.simulated_mock_usage.cost_usd} at configured pricing).`, '', `Per-run budget: ${JSON.stringify(cfg.budget)}.`, '');
  L.push('## What this is and is not', '', '- Mock results come from an offline syntactic reader and a literal-overlap comparison. They exercise the pipeline, contracts and validators; they are not semantic verification.', '- A verified citation shows the cited evidence exists; it does not establish that an interpretation is correct.', '- Model findings are advisory. No decision was resolved, no requirement approved, no blocker removed and no gate or workflow state changed.', '');
  return { markdown: L.join('\n') + '\n', data: { runs: runs.length, pass_a: passA.length, pass_b: passB.length, advisory: adv.length, citations: cites, classifications: classes, live_executed: live, usage } };
}
