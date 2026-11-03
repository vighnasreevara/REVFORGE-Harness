/**
 * STEP 4.5 analysis pipeline. Each command builds the current snapshot,
 * evaluates scopes with the existing G2 evaluator, derives the requested
 * analysis and seals it as a numbered workflow/step45 record. The analysis
 * never changes decisions, resolutions, receipts, deliverables or gates.
 */
import * as fs from 'fs';
import * as path from 'path';
import { digest } from '../approval/canonical';
import { evaluateScope, ScopeEvaluation } from '../approval/scope';
import { buildSnapshot, Snapshot } from '../approval/snapshot';
import { mutate, Workflow } from '../orchestrator/orchestrator';
import { auditCounts, inputsOf } from './audit';
import { runDeterministic, SourceReader } from './deterministic';
import { preparePackets } from './openai';
import { loadOpenAIConfig } from '../openai/config';
import { buildProposals } from './proposals';
import { buildQueue } from './queue';
import { scopeReadiness } from './readiness';
import { latestStep45, sealStep45 } from './records';
import { buildRegistry, Registry, registryRecord } from './rootcauses';
import { renderStep45Report } from './report';

export interface Analysis {
  snap: Snapshot;
  app: ScopeEvaluation;
  programScopes: Map<string, ScopeEvaluation>;
  reg: Registry;
  det: any;
  inputs_sha256: string;
}

export function analyse(wf: Workflow): Analysis {
  const snap = buildSnapshot(wf);
  const app = evaluateScope(snap, { kind: 'application' });
  const programScopes = new Map(snap.sys.programs.map((p) => [p.program_id, evaluateScope(snap, { kind: 'programs', programs: [p.program_id] })]));
  const reg = buildRegistry(snap, app, programScopes);
  const det = runDeterministic(snap, reg, latestStep45(wf, 'deterministic-verification')?.record ?? null);
  const status = new Map<string, string>(det.results.map((r: any) => [r.root_cause_id, r.status]));
  for (const r of reg.roots) r.evidence_status = status.get(r.root_cause_id) ?? 'not_checked';
  return { snap, app, programScopes, reg, det, inputs_sha256: digest(inputsOf(snap)) };
}

const stamp = (a: Analysis, rec: any) => ({ ...rec, analysis_inputs_sha256: a.inputs_sha256 });

export function cmdAudit(wf: Workflow) {
  return mutate(wf, 'verification blockers audit', () => {
    const a = analyse(wf);
    const rec = stamp(a, auditCounts(a.snap, a.app));
    const s = sealStep45(wf, 'blocker-count-audit', rec);
    return { ...s, record: { record_id: s.id, ...rec } };
  });
}

export function cmdRootCauses(wf: Workflow) {
  return mutate(wf, 'verification blockers root-causes', () => {
    const a = analyse(wf);
    const rec = stamp(a, registryRecord(a.snap, a.reg, a.app));
    const s = sealStep45(wf, 'root-cause-registry', rec, 'verification/root-cause-registry');
    return { ...s, record: { record_id: s.id, ...rec } };
  });
}

export function cmdClassify(wf: Workflow) {
  return mutate(wf, 'verification blockers classify', () => {
    const a = analyse(wf);
    const rec = stamp(a, buildQueue(a.snap, a.reg, a.det));
    const s = sealStep45(wf, 'decision-review-queue', rec);
    return { ...s, record: { record_id: s.id, ...rec } };
  });
}

export function cmdDeterministic(wf: Workflow) {
  return mutate(wf, 'verification source deterministic', () => {
    const a = analyse(wf);
    const rec = stamp(a, a.det);
    const s = sealStep45(wf, 'deterministic-verification', rec);
    return { ...s, record: { record_id: s.id, ...rec } };
  });
}

export function cmdRemediation(wf: Workflow) {
  return mutate(wf, 'verification remediation prepare', () => {
    const a = analyse(wf);
    const rec = stamp(a, buildProposals(a.snap, a.reg, a.det, latestStep45(wf, 'remediation-proposals')?.record ?? null));
    const s = sealStep45(wf, 'remediation-proposals', rec, 'verification/remediation-proposals');
    return { ...s, record: { record_id: s.id, ...rec } };
  });
}

export function cmdReadiness(wf: Workflow, opts: { requirements?: boolean } = {}) {
  return mutate(wf, 'verification scope readiness', () => {
    const a = analyse(wf);
    const rec = stamp(a, scopeReadiness(a.snap, a.reg, opts));
    const s = sealStep45(wf, 'scope-readiness', rec);
    return { ...s, record: { record_id: s.id, ...rec } };
  });
}

export function cmdOpenAI(wf: Workflow) {
  return mutate(wf, 'verification openai prepare', () => {
    const a = analyse(wf);
    const p = preparePackets(a.snap, a.reg, a.det, new SourceReader(a.snap), { alsoCategories: loadOpenAIConfig(wf.run.ctx).config.selection.prepare_also_categories });
    const sa = sealStep45(wf, 'openai-pass-a', stamp(a, p.passA), 'verification/openai-pass-a');
    const sb = sealStep45(wf, 'openai-pass-b', stamp(a, p.passB), 'verification/openai-pass-b');
    const q = stamp(a, { ...p.queue, pass_a_record: { id: sa.id, sha256: sa.sha256 }, pass_b_record: { id: sb.id, sha256: sb.sha256 } });
    const s = sealStep45(wf, 'openai-verification-queue', q);
    return { ...s, record: { record_id: s.id, ...q }, pass_a: sa, pass_b: sb };
  });
}

/** Runs every analysis once, seals each record, exports copies and renders the consolidated report. */
export function cmdReport(wf: Workflow, opts: { exportDir: string; reportFile: string }) {
  return mutate(wf, 'verification report', () => {
    const a = analyse(wf);
    const audit = stamp(a, auditCounts(a.snap, a.app));
    const registry = stamp(a, registryRecord(a.snap, a.reg, a.app));
    const det = stamp(a, a.det);
    const proposals = stamp(a, buildProposals(a.snap, a.reg, a.det, latestStep45(wf, 'remediation-proposals')?.record ?? null));
    const queue = stamp(a, buildQueue(a.snap, a.reg, a.det));
    const readiness = stamp(a, scopeReadiness(a.snap, a.reg));
    const p = preparePackets(a.snap, a.reg, a.det, new SourceReader(a.snap), { alsoCategories: loadOpenAIConfig(wf.run.ctx).config.selection.prepare_also_categories });
    const sealed: Record<string, { id: string; sha256: string; data: any }> = {};
    const seal = (name: string, data: any, schema?: string) => {
      const s = sealStep45(wf, name, data, schema);
      sealed[name] = { id: s.id, sha256: s.sha256, data: { record_id: s.id, ...data } };
      return s;
    };
    seal('blocker-count-audit', audit);
    seal('root-cause-registry', registry, 'verification/root-cause-registry');
    seal('deterministic-verification', det);
    seal('remediation-proposals', proposals, 'verification/remediation-proposals');
    seal('decision-review-queue', queue);
    seal('scope-readiness', readiness);
    const sa = seal('openai-pass-a', stamp(a, p.passA), 'verification/openai-pass-a');
    const sb = seal('openai-pass-b', stamp(a, p.passB), 'verification/openai-pass-b');
    seal('openai-verification-queue', stamp(a, { ...p.queue, pass_a_record: { id: sa.id, sha256: sa.sha256 }, pass_b_record: { id: sb.id, sha256: sb.sha256 } }));
    fs.mkdirSync(opts.exportDir, { recursive: true });
    for (const name of ['blocker-count-audit', 'root-cause-registry', 'deterministic-verification', 'remediation-proposals', 'decision-review-queue', 'scope-readiness', 'openai-verification-queue']) {
      fs.writeFileSync(path.join(opts.exportDir, `${name}.json`), JSON.stringify({ exported_copy_of: `workflow/step45/${sealed[name].id}.json`, sealed_sha256: sealed[name].sha256, ...sealed[name].data }, null, 2) + '\n', 'utf8');
    }
    const md = renderStep45Report(a, { audit, registry, det, proposals, queue, readiness, packets: p.queue, sealed: Object.fromEntries(Object.entries(sealed).map(([k, v]) => [k, { id: v.id, sha256: v.sha256 }])) });
    fs.writeFileSync(opts.reportFile, md, 'utf8');
    return { sealed: Object.fromEntries(Object.entries(sealed).map(([k, v]) => [k, { id: v.id, sha256: v.sha256 }])), export_dir: opts.exportDir, report: opts.reportFile, summary: { audit: audit.counts.map((c: any) => ({ name: c.name, value: c.value })), registry: registry.summary, deterministic: det.summary, proposals: proposals.summary, queue: queue.summary, readiness: readiness.summary, openai: p.queue.summary } };
  });
}
