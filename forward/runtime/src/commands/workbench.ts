/**
 * `workbench <action>`: STEP 5.5 human decision workbench. Every action seals
 * a preparation record under workflow/step55; none resolves, approves,
 * authorizes, corrects or sends anything.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { loadWorkflow, mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { analyse, Analysis } from '../blockers/pipeline';
import { latestStep45 } from '../blockers/records';
import { CLASS_WEIGHT, DEPENDENCY_WEIGHT, explain, rankCandidates } from '../workbench/candidates';
import { checklist, correctionReview, decisionPackets, evidencePackage, openaiPilot, scopeReadinessReport, trustReadiness } from '../workbench/workbench';
import { renderCandidates, renderChecklist, renderPackets, renderReadiness, renderStep55 } from '../workbench/report';

type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);
export const STEP55_DIR = 'step55';

function seal(wf: Workflow, name: string, data: any): { id: string; sha256: string } {
  const n = wf.store.list(STEP55_DIR).filter((f) => f.startsWith(`${name}-`)).length + 1;
  const id = `${name}-${String(n).padStart(4, '0')}`;
  const file = wf.store.writeRecord(STEP55_DIR, `${id}.json`, { record_id: id, ...data });
  const sha256 = sha256File(file)!;
  wf.store.append('step55_record_written', { record: `${STEP55_DIR}/${id}.json`, kind: name, sha256 });
  return { id, sha256 };
}

export function candidatesRecord(a: Analysis): any {
  const props = latestStep45(a.snap.wf, 'remediation-proposals')?.record.proposals ?? [];
  const r = rankCandidates(a, props);
  const top = r.programs.slice(0, 3).map((x, i) => ({ rank: i + 1, scope: x.scope, meaningful: x.meaningful, workload_score: x.workload_score, explanation: explain(x) }));
  const rec = r.programs.find((x) => x.meaningful) ?? null;
  return {
    contract: 'approval-scope-candidates',
    contract_version: '1.0',
    generated_at: a.snap.at.toISOString(),
    baseline_manifest_sha256: a.snap.wf.run.manifestSha256,
    weights: { class: CLASS_WEIGHT, dependency: DEPENDENCY_WEIGHT },
    programs: r.programs,
    requirements: r.requirements,
    top_three: top,
    recommended: rec ? { scope: rec.scope, primary: rec.primary, scope_sha256: rec.scope_sha256 } : null,
    recommendation_reason: rec ? `${explain(rec)} It is the meaningful program scope with the least weighted human work; ${r.programs.filter((x) => !x.meaningful).length} other program scope(s) were not recommended (templates, test tools, utilities, empty sources or no verified requirement). It is a proposal for human review, not an approval.` : 'no program scope is a meaningful, source-grounded application function',
  };
}

export function workbenchCommand(ctx: RuntimeContext, action: string | undefined, flags: Flags, json: boolean, out: Out, err: Out): number {
  const runId = str(flags, 'run') ?? 'latest';
  const print = (o: unknown, text: () => void) => (json ? out(JSON.stringify(o, null, 2)) : text());
  try {
    const wf = loadWorkflow(ctx, runId);
    return mutate(wf, `workbench ${action}`, () => {
      const a = analyse(wf);
      const cand = candidatesRecord(a);
      const scope = str(flags, 'scope') ?? cand.recommended?.scope;
      if (!scope && action !== 'candidates' && action !== 'trust') throw new OrchestratorError('no scope given and no meaningful scope recommended (--scope ...)', 'USAGE');
      const rolesFor = (pkg: any) => [...new Set([...(pkg?.required_authorities ?? []), ...a.snap.policy.roles.requirements_approval, ...(require('../openai/config') as typeof import('../openai/config')).loadOpenAIConfig(ctx).config.source_export.required_roles])].sort();
      let result: any;
      switch (action) {
        case 'candidates': {
          const s = seal(wf, 'scope-candidates', cand);
          result = { record: s.id, ...cand, programs: undefined, requirements: undefined };
          print(result, () => {
            for (const x of cand.top_three) out(`${x.rank}. ${x.explanation}`);
            out(`recommended: ${cand.recommended?.scope ?? 'none'} (proposal, not approval) — ${s.id}`);
          });
          break;
        }
        case 'package': {
          const pkg = evidencePackage(a, scope!);
          const s = seal(wf, 'scope-evidence-package', pkg);
          print({ record: s.id, ...pkg }, () => out(`${s.id}: ${pkg.manifest.scope} ${pkg.manifest.readiness}; ${pkg.requirements.length} requirement(s), ${pkg.root_causes.length} root cause(s), ${pkg.blocking_decisions.length} blocking decision(s)`));
          break;
        }
        case 'decisions': {
          const p = decisionPackets(a, scope!, str(flags, 'export-dir') ? path.resolve(str(flags, 'export-dir')!) : undefined);
          const s = seal(wf, 'decision-packets', p);
          print({ record: s.id, ...p }, () => {
            for (const x of p.packets) out(`  ${x.root_cause_id} [${x.class}] ${x.title.slice(0, 80)} — decisions ${x.decisions.map((d: any) => d.decision_id).join(', ') || 'none'}`);
            out(`${s.id}: ${p.summary.root_causes} root cause(s) ${JSON.stringify(p.summary.by_class)}, ${p.summary.blocking_decisions} blocking decision(s)`);
          });
          break;
        }
        case 'corrections': {
          const c = correctionReview(a, str(flags, 'all') ? null : scope ?? null);
          const s = seal(wf, 'correction-review', c);
          print({ record: s.id, ...c }, () => {
            for (const p of c.proposals) out(`  ${p.proposal_id} ${p.item} ${p.pointer}: ${p.original_value} -> ${p.proposed_value} (verified now: ${p.verified_now}; ${p.authorization.status} via ${p.authorization.decision})`);
            out(`${s.id}: ${c.summary.proposals} proposal(s), ${c.summary.verified_now} verified against current source, ${c.summary.authorized} authorized`);
          });
          break;
        }
        case 'trust': {
          const pkg = scope ? evidencePackage(a, scope) : null;
          const t = trustReadiness(a, rolesFor(pkg));
          const s = seal(wf, 'trust-readiness', t);
          print({ record: s.id, ...t }, () => {
            out(`${s.id}: ${t.status}${t.problems.length ? ` — ${t.problems.join('; ')}` : ''}`);
            for (const r of t.roles) out(`  ${r.role}: ${r.covered ? r.signers.join(', ') : 'no trusted signer'}`);
          });
          break;
        }
        case 'pilot': {
          const p = openaiPilot(a, scope!, Number(str(flags, 'max') ?? 3));
          const s = seal(wf, 'openai-pilot', p);
          print({ record: s.id, ...p }, () => {
            out(`${s.id}: ${p.status}; ${p.cases.length} case(s); upper-bound cost $${p.total_estimate.cost_usd_upper_bound}`);
            for (const b of p.blocked_by) out(`  blocked: ${b}`);
          });
          break;
        }
        case 'readiness': {
          const pkg = evidencePackage(a, scope!);
          const r = scopeReadinessReport(a, scope!, trustReadiness(a, rolesFor(pkg)));
          const s = seal(wf, 'scope-g2-readiness', r);
          print({ record: s.id, ...r }, () => {
            out(`${s.id}: ${r.scope} ${r.readiness}; G1 can pass: ${r.g2_can_pass}`);
            for (const w of r.why_g2_cannot_pass) out(`  - ${w}`);
          });
          break;
        }
        case 'checklist':
        case 'report': {
          const dir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-5.5'));
          const pkg = evidencePackage(a, scope!);
          const packets = decisionPackets(a, scope!, action === 'report' ? path.join(dir, 'resolution-requests') : undefined);
          const corrections = correctionReview(a, scope!);
          const trust = trustReadiness(a, rolesFor(pkg));
          const pilot = openaiPilot(a, scope!, 3);
          const readiness = scopeReadinessReport(a, scope!, trust);
          const list = checklist(a, pkg, packets, corrections, trust, pilot);
          if (action === 'checklist') {
            const s = seal(wf, 'approval-checklist', list);
            print({ record: s.id, ...list }, () => {
              for (const x of list.actions) out(`  ${x.step}. [${x.actor}] ${x.status}: ${x.action}`);
            });
            break;
          }
          const queue = { scope, root_causes: pkg.root_causes, packets_summary: packets.summary };
          const sealed: Record<string, any> = {};
          for (const [k, v] of Object.entries({ 'scope-candidates': cand, 'scope-evidence-package': pkg, 'root-cause-review-queue': queue, 'decision-packets': packets, 'correction-review': corrections, 'trust-readiness': trust, 'openai-pilot': pilot, 'scope-g2-readiness': readiness, 'approval-checklist': list })) sealed[k] = seal(wf, k, v);
          fs.mkdirSync(dir, { recursive: true });
          const w = (name: string, data: any) => fs.writeFileSync(path.join(dir, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', 'utf8');
          w('scope-candidates.json', cand);
          w('first-scope-recommendation.md', renderCandidates(cand));
          w('scope-evidence-package.json', pkg);
          w('root-cause-review-queue.json', queue);
          w('decision-packets.json', packets);
          w('decision-packets.md', renderPackets(packets));
          w('correction-review.json', corrections);
          w('trust-readiness.json', trust);
          w('openai-pilot.json', pilot);
          if (pilot.authorization_request) w('openai-pilot-authorization-request.json', pilot.authorization_request.payload);
          w('scope-g2-readiness.json', readiness);
          w('scope-g2-readiness.md', renderReadiness(readiness, trust));
          w('approval-operations-checklist.json', list);
          w('approval-operations-checklist.md', renderChecklist(list));
          const report = path.resolve(str(flags, 'out') ?? path.join(ctx.forwardDir, 'reports', 'STEP-5.5-REPORT.md'));
          fs.writeFileSync(report, renderStep55({ candidates: cand, pkg, packets, corrections, trust, pilot, readiness, checklist: list, sealed }), 'utf8');
          result = { sealed, export_dir: dir, report };
          print(result, () => {
            for (const [k, v] of Object.entries(sealed)) out(`  sealed ${k}: workflow/step55/${v.id}.json`);
            out(`  exports: ${dir}`);
            out(`  report: ${report}`);
          });
          break;
        }
        default:
          err('workbench: use candidates | package | decisions | corrections | trust | pilot | readiness | checklist | report [--scope S] [--export-dir DIR]');
          return 2;
      }
      wf.store.writeState(wf.state);
      return 0;
    });
  } catch (e) {
    if (e instanceof OrchestratorError) {
      err(`workbench ${action}: ${e.message}`);
      for (const d of e.details) err(`  - ${d}`);
      return 1;
    }
    err(`workbench ${action}: ${(e as Error)?.message ?? e}`);
    return 1;
  }
}
