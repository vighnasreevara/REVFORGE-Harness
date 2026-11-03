/**
 * Mandatory BMad governance of the forward workflow (STEP 21).
 *
 * A governed forward run of one exact scope passes through the six bound BMad
 * lifecycle stages in order (requirements, architecture, stories, sprint,
 * implementation, review). A stage counts only through a verified LIVE
 * receipt: accepted by the receipt validator, sealed and intact, for the
 * current scope digest, with every document it lists unchanged. MOCK receipts
 * never count.
 *
 * `governedRun` is the dispatcher: for each stage not yet verified it records
 * the execution preflight and launches only when the preflight permits it and
 * a LIVE runner exists. The first stage that cannot launch stops the run,
 * which is sealed as BMAD_BLOCKED (`BGR-NNNN`). It never falls back to the
 * local converter or any other ungoverned workflow.
 *
 * When `bmad_governance.mandatory` is set, Java generation through the
 * workflow additionally needs the stages up to sprint to be verified for some
 * scope (`bmadGenerationReady`); the implementation stage cannot require
 * itself. Local LGA conversions are separate, historically authorised records
 * and are never reported as BMad-governed.
 */
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { evaluateScope, parseSelector } from '../approval/scope';
import { buildSnapshot } from '../approval/snapshot';
import { mutate, Workflow } from '../orchestrator/orchestrator';
import { BMAD_RECORDS, bmadReceipts, preparePacket, upstreamReceipts } from './adapter';
import { executeLive, Probe, Runner } from './executor';
import { preflight } from './preflight';

export const GOVERNED_STAGES = [
  { stage: 'requirements', binding_id: 'BMAD-PRD', workflow_id: 'bmad-prd', agent: 'F1' },
  { stage: 'architecture', binding_id: 'BMAD-ARCH', workflow_id: 'bmad-architecture', agent: 'F3' },
  { stage: 'stories', binding_id: 'BMAD-EPICS', workflow_id: 'bmad-create-epics-and-stories', agent: 'F4' },
  { stage: 'sprint', binding_id: 'BMAD-SPRINT', workflow_id: 'bmad-sprint-planning', agent: 'F4' },
  { stage: 'implementation', binding_id: 'BMAD-BUILD', workflow_id: 'bmad-build', agent: 'F5' },
  { stage: 'review', binding_id: 'BMAD-REVIEW', workflow_id: 'bmad-code-review', agent: 'F7' },
] as const;
export type Stage = (typeof GOVERNED_STAGES)[number]['stage'];
export type StageStatus = 'RECEIPT_VERIFIED' | 'EXECUTED_REJECTED' | 'EXECUTION_FAILED' | 'BLOCKED' | 'NOT_ATTEMPTED';
/** Acceptance stays outside BMad: the independent F6 receipt and gates G6-G8. */
export const ACCEPTANCE_OUTSIDE_BMAD = 'acceptance is the independent F6 test receipt and gates G6-G8, deliberately outside BMad';

export const bmadMandatory = (ctx: RuntimeContext): boolean => !!(ctx.config as any).bmad_governance?.mandatory;

export interface ReceiptFacts {
  receipt_id: string;
  binding_id: string;
  mode: string;
  accepted: boolean;
  /** Sealed in the audit chain and its result file unchanged. */
  intact: boolean;
  evidence_status: string;
  scope: string;
  scope_sha256: string | null;
  /** Every document the receipt lists still has its recorded hash. */
  documents_intact: boolean;
}

/** Whether one receipt counts as BMad execution evidence for a stage of this exact scope (pure; exported for tests). */
export function receiptCounts(r: ReceiptFacts, bindingId: string, scope: string, scopeSha: string | null): { ok: boolean; reason: string } {
  if (r.binding_id !== bindingId) return { ok: false, reason: `${r.receipt_id} is for ${r.binding_id}` };
  if (r.scope !== scope) return { ok: false, reason: `${r.receipt_id} is for scope ${r.scope}` };
  if (!r.accepted || r.evidence_status === 'REJECTED') return { ok: false, reason: `${r.receipt_id} was rejected by the receipt validator` };
  if (r.mode !== 'LIVE') return { ok: false, reason: `${r.receipt_id} is a ${r.mode} receipt (MOCK_NOT_EVIDENCE): never BMad execution evidence` };
  if (!r.intact) return { ok: false, reason: `${r.receipt_id} is not sealed or its result changed since recording` };
  if (!r.documents_intact) return { ok: false, reason: `${r.receipt_id}: a listed document changed or is missing` };
  if (!scopeSha || r.scope_sha256 !== scopeSha) return { ok: false, reason: `${r.receipt_id} was recorded for scope digest ${String(r.scope_sha256).slice(0, 12)}…, not the current one` };
  return { ok: true, reason: `${r.receipt_id}: verified LIVE receipt for the current scope` };
}

function receiptFacts(wf: Workflow): ReceiptFacts[] {
  const up = new Map(upstreamReceipts(wf).map((u) => [u.receipt_id, u]));
  return bmadReceipts(wf).map((r) => ({
    receipt_id: r.receipt_id,
    binding_id: r.binding_id,
    mode: r.mode,
    accepted: !!r.accepted,
    // upstreamReceipts accepts a receipt only when it is sealed and its result file is unchanged.
    intact: !!up.get(r.receipt_id)?.accepted,
    evidence_status: r.evidence_status,
    scope: r.scope,
    scope_sha256: r.scope_sha256,
    documents_intact: (r.documents ?? []).every((d: any) => sha256File(path.resolve(wf.run.ctx.repoRoot, d.path)) === d.sha256),
  }));
}

function scopeOf(wf: Workflow, scope: string): { text: string; sha: string | null; error: string | null } {
  try {
    const ev = evaluateScope(buildSnapshot(wf), parseSelector(scope));
    return { text: ev.selector_text, sha: ev.scope_sha256, error: null };
  } catch (e) {
    return { text: scope, sha: null, error: (e as Error).message };
  }
}

/** The governance verdict of one scope from the recorded receipts (read-only). */
export function governanceVerdict(wf: Workflow, scope: string, opts: { upTo?: Stage } = {}): any {
  const s = scopeOf(wf, scope);
  const facts = receiptFacts(wf);
  const last = opts.upTo ? GOVERNED_STAGES.findIndex((x) => x.stage === opts.upTo) : GOVERNED_STAGES.length - 1;
  const stages = GOVERNED_STAGES.slice(0, last + 1).map((g) => {
    const mine = facts.filter((r) => r.binding_id === g.binding_id && r.scope === s.text);
    const judged = mine.map((r) => ({ r, v: receiptCounts(r, g.binding_id, s.text, s.sha) }));
    const ok = judged.find((x) => x.v.ok);
    return {
      ...g,
      status: ok ? 'RECEIPT_VERIFIED' : mine.length ? 'EXECUTED_REJECTED' : 'NOT_ATTEMPTED',
      receipt_id: ok?.r.receipt_id ?? null,
      reasons: ok ? [ok.v.reason] : judged.length ? judged.map((x) => x.v.reason) : ['no BMad receipt recorded for this stage and scope'],
    };
  });
  return {
    scope: s.text,
    scope_sha256: s.sha,
    scope_error: s.error,
    mandatory: bmadMandatory(wf.run.ctx),
    status: stages.every((x) => x.status === 'RECEIPT_VERIFIED') && !s.error ? 'BMAD_COMPLIANT' : 'BMAD_BLOCKED',
    stages,
    acceptance: ACCEPTANCE_OUTSIDE_BMAD,
  };
}

export function governedRuns(wf: Workflow): any[] {
  return wf.store.list(BMAD_RECORDS).filter((f) => f.startsWith('BGR-')).map((f) => wf.store.readRecord(BMAD_RECORDS, f));
}

/**
 * The BMad-governed dispatcher for one scope. Stages run in order; nothing is launched without a permitted, recorded
 * preflight and a LIVE runner. The run is sealed as a BGR record (BMAD_COMPLIANT only when every stage is verified).
 */
export function governedRun(
  wf: Workflow,
  scope: string,
  opts: { runner?: Runner | null; probe?: Probe; isolation?: any; assessment?: any } = {},
): any {
  const started = new Date().toISOString();
  const s = scopeOf(wf, scope);
  const before = governanceVerdict(wf, scope);
  const stages: any[] = [];
  let stopped = false;
  for (const g of GOVERNED_STAGES) {
    const row = { stage: g.stage, binding_id: g.binding_id, workflow_id: g.workflow_id, agent: g.agent, status: 'NOT_ATTEMPTED' as StageStatus, preflight_id: null as string | null, authorization_id: null as string | null, receipt_id: null as string | null, execution_record: null as string | null, blockers: [] as string[] };
    stages.push(row);
    if (stopped) {
      row.blockers.push('not attempted: an earlier stage is blocked');
      continue;
    }
    const prior = before.stages.find((x: any) => x.stage === g.stage);
    if (prior?.status === 'RECEIPT_VERIFIED') {
      row.status = 'RECEIPT_VERIFIED';
      row.receipt_id = prior.receipt_id;
      continue;
    }
    const pf = preflight(wf, g.binding_id, s.text, { probe: opts.probe, record: true, isolation: opts.isolation, assessment: opts.assessment });
    row.preflight_id = pf.record_id;
    row.authorization_id = pf.authorization_id ?? null;
    if (!pf.launch_permitted) {
      row.status = 'BLOCKED';
      row.blockers.push(...(pf.refusal_reasons ?? []));
      stopped = true;
      continue;
    }
    if (!opts.runner) {
      row.status = 'BLOCKED';
      row.blockers.push('no LIVE runner is available on this host: the headless Claude Code runner must run inside the verified isolation boundary');
      stopped = true;
      continue;
    }
    try {
      const packet = preparePacket(wf, g.binding_id, s.text, 'LIVE');
      const res = executeLive(wf, packet.packet_id, opts.runner, opts.probe);
      row.execution_record = res.execution_record;
      row.receipt_id = res.receipt?.receipt_id ?? null;
      if (res.status === 'failed') {
        row.status = 'EXECUTION_FAILED';
        row.blockers.push(`execution failed (${res.execution_record})`);
        stopped = true;
      } else if (res.status === 'completed_rejected') {
        row.status = 'EXECUTED_REJECTED';
        row.blockers.push(...(res.receipt?.violations ?? []));
        stopped = true;
      } else {
        const v = governanceVerdict(wf, scope).stages.find((x: any) => x.stage === g.stage);
        row.status = v?.status === 'RECEIPT_VERIFIED' ? 'RECEIPT_VERIFIED' : 'EXECUTED_REJECTED';
        if (row.status !== 'RECEIPT_VERIFIED') {
          row.blockers.push(...(v?.reasons ?? []));
          stopped = true;
        }
      }
    } catch (e) {
      row.status = 'BLOCKED';
      row.blockers.push((e as Error).message, ...(((e as any).details as string[]) ?? []));
      stopped = true;
    }
  }
  const status = stages.every((x) => x.status === 'RECEIPT_VERIFIED') && !s.error ? 'BMAD_COMPLIANT' : 'BMAD_BLOCKED';
  return mutate(wf, `bmad governed run ${s.text}`, () => {
    const n = wf.store.list(BMAD_RECORDS).filter((f) => f.startsWith('BGR-')).length + 1;
    const id = `BGR-${String(n).padStart(4, '0')}`;
    const rec = {
      record_id: id,
      contract: 'bmad/governed-run',
      contract_version: '1.0',
      started_at: started,
      ended_at: new Date().toISOString(),
      scope: s.text,
      scope_sha256: s.sha,
      mandatory: bmadMandatory(wf.run.ctx),
      status,
      stages,
      fallback: 'none',
      local_conversion_invoked: false,
      note: status === 'BMAD_COMPLIANT' ? 'every lifecycle stage has a verified LIVE receipt for this scope; acceptance remains the independent F6 receipt and gates G6-G8' : 'BMAD_BLOCKED: the run stopped at the first stage that could not launch; nothing ran outside BMad in its place',
    };
    const v = wf.run.ctx.contracts.validate('bmad/governed-run', rec);
    if (!v.valid) throw new Error(`governed run violates bmad/governed-run: ${v.errors.join('; ')}`);
    const file = wf.store.writeRecord(BMAD_RECORDS, `${id}.json`, rec);
    wf.store.append('bmad_governed_run', { record: `${BMAD_RECORDS}/${id}.json`, kind: 'BGR', scope: s.text, status, sha256: sha256File(file) });
    wf.store.writeState(wf.state);
    return rec;
  });
}

/**
 * The mandatory-BMad condition for Java generation through the workflow: some governed scope has verified LIVE
 * receipts for every stage up to sprint (re-verified now). Always satisfied when governance is not mandatory.
 */
export function bmadGenerationReady(wf: Workflow): { ok: boolean; detail: string } {
  if (!bmadMandatory(wf.run.ctx)) return { ok: true, detail: 'BMad governance is not mandatory in this configuration' };
  const scopes = [...new Set(governedRuns(wf).map((r) => r.scope as string))];
  for (const sc of scopes) {
    const v = governanceVerdict(wf, sc, { upTo: 'sprint' });
    if (v.status === 'BMAD_COMPLIANT') return { ok: true, detail: `${sc}: requirements, architecture, stories and sprint verified by LIVE receipts` };
  }
  return { ok: false, detail: scopes.length ? `no governed scope has verified LIVE receipts up to sprint (${scopes.join(', ')})` : 'no BMad-governed run exists: BMAD_BLOCKED' };
}

/** Label for a local (LGA) conversion: historically authorised, never BMad-governed. */
export function localConversionGovernance(ctx: RuntimeContext): string {
  return bmadMandatory(ctx) ? 'LOCAL_LGA_NOT_BMAD_GOVERNED (BMad is mandatory for governed runs; this conversion ran under a local-generation authorization)' : 'LOCAL_LGA';
}

