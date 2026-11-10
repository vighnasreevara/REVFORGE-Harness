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
import { acceptedReceipts, mutate, Workflow } from '../orchestrator/orchestrator';
import { unitKey } from '../orchestrator/extracts';
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
/** Completion stays outside BMad: the independent F6 test receipt and the F7 review receipt. */
export const ACCEPTANCE_OUTSIDE_BMAD = 'completion rests on the independent F6 test receipt and the F7 review receipt, deliberately outside BMad';

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

/**
 * Independent evidence of the governed lifecycle that BMad does not produce (end-to-end integration):
 *   F2 - accepted data-mapping deliveries for every unit of the scope (the same ledger the readiness gate reads);
 *   F6 - accepted independent test receipts whose packet covers every program of the scope.
 * Neither is a BMad workflow; both are required for BMAD_COMPLIANT.
 */
export function independentEvidence(wf: Workflow, scope: string): { f2: { status: 'ACCEPTED' | 'MISSING'; units: string[]; missing: string[] }; f6: { status: 'ACCEPTED' | 'MISSING'; receipts: string[] } } {
  const snap = buildSnapshot(wf);
  let units: any[] = [];
  try {
    units = evaluateScope(snap, parseSelector(scope)).units;
  } catch {
    units = [];
  }
  const missing = units.filter((u) => snap.coverage.F2.get(unitKey({ unit_kind: u.unit_kind, name: u.name, file_id: u.file_id })) !== 'completed').map((u) => u.name);
  const programs = units.filter((u) => u.unit_kind === 'program' && u.role === 'primary').map((u) => u.name as string);
  const f6 = acceptedReceipts(wf).filter((r) => r.receipt?.agent === 'F6').filter((r) => {
    let packet: any = null;
    try {
      packet = wf.store.readRecord('packets', `${r.packet_id}.json`);
    } catch {
      return false;
    }
    const covered = new Set<string>((packet?.units ?? []).map((u: any) => u.name));
    return programs.length > 0 && programs.every((p) => covered.has(p));
  });
  return {
    f2: { status: units.length && !missing.length ? 'ACCEPTED' : 'MISSING', units: units.map((u) => u.name), missing: units.length ? missing : ['(scope has no units)'] },
    f6: { status: f6.length ? 'ACCEPTED' : 'MISSING', receipts: f6.map((r) => r.receipt_id) },
  };
}

/** BMad drafts a forward agent receives as non-authoritative inputs (they never replace source-derived requirements). */
export const DRAFT_INPUTS: Record<string, string[]> = { F3: ['BMAD-PRD'], F4: ['BMAD-PRD', 'BMAD-ARCH'], F5: ['BMAD-EPICS', 'BMAD-SPRINT'], F7: ['BMAD-BUILD'] };

/**
 * Verified LIVE BMad drafts for a dispatch packet of `agent` covering `programs`: every document of a receipt that
 * counts for its own scope, where that scope's programs are all within the packet. Empty when nothing is verified.
 */
export function verifiedDrafts(wf: Workflow, agent: string, programs: string[]): Array<{ kind: string; required: false; files: Array<{ path: string; sha256: string | null; present: boolean }> }> {
  const wanted = DRAFT_INPUTS[agent] ?? [];
  if (!wanted.length) return [];
  const inPacket = new Set(programs);
  const out: Array<{ kind: string; required: false; files: Array<{ path: string; sha256: string | null; present: boolean }> }> = [];
  const byScope = new Map<string, { sha: string | null }>();
  for (const r of receiptFacts(wf)) {
    if (!wanted.includes(r.binding_id) || !/^programs:/.test(r.scope)) continue;
    const progs = r.scope.replace(/^programs:/, '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!progs.every((p) => inPacket.has(p))) continue;
    if (!byScope.has(r.scope)) byScope.set(r.scope, { sha: scopeOf(wf, r.scope).sha });
    if (!receiptCounts(r, r.binding_id, r.scope, byScope.get(r.scope)!.sha).ok) continue;
    const rec = bmadReceipts(wf).find((x) => x.receipt_id === r.receipt_id);
    out.push({ kind: `bmad-draft:${r.binding_id}:${r.receipt_id}`, required: false, files: (rec?.documents ?? []).map((d: any) => ({ path: d.path, sha256: d.sha256, present: sha256File(path.resolve(wf.run.ctx.repoRoot, d.path)) === d.sha256 })) });
  }
  return out;
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
  const ind = independentEvidence(wf, scope);
  // Up to sprint only the F2 contracts are needed; the full lifecycle also needs the independent F6 test receipt.
  const needF6 = !opts.upTo || GOVERNED_STAGES.findIndex((x) => x.stage === opts.upTo) >= GOVERNED_STAGES.findIndex((x) => x.stage === 'review');
  const indOk = ind.f2.status === 'ACCEPTED' && (!needF6 || ind.f6.status === 'ACCEPTED');
  return {
    scope: s.text,
    scope_sha256: s.sha,
    scope_error: s.error,
    mandatory: bmadMandatory(wf.run.ctx),
    status: stages.every((x) => x.status === 'RECEIPT_VERIFIED') && indOk && !s.error ? 'BMAD_COMPLIANT' : 'BMAD_BLOCKED',
    stages,
    independent_evidence: ind,
    acceptance: ACCEPTANCE_OUTSIDE_BMAD,
  };
}

/** The operations a governed run performs per stage; replaced by test doubles only in tests (execution_mode SIMULATION). */
export interface StageDeps {
  preflight: (wf: Workflow, bindingKey: string, scope: string, o: any) => any;
  prepare: (wf: Workflow, bindingKey: string, scope: string) => any;
  execute: (wf: Workflow, packetId: string, runner: Runner, probe?: Probe) => any;
  verify: (wf: Workflow, scope: string, stage: Stage) => { status: string; reasons: string[] };
  /** SIMULATION only: replaces the F2/F6 evidence lookup. */
  independent?: (wf: Workflow, scope: string) => ReturnType<typeof independentEvidence>;
}
const LIVE_DEPS: StageDeps = {
  preflight: (wf, b, sc, o) => preflight(wf, b, sc, o),
  prepare: (wf, b, sc) => preparePacket(wf, b, sc, 'LIVE'),
  execute: (wf, p, r, probe) => executeLive(wf, p, r, probe),
  verify: (wf, sc, st) => governanceVerdict(wf, sc).stages.find((x: any) => x.stage === st) ?? { status: 'NOT_ATTEMPTED', reasons: [] },
};

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
  opts: { runner?: Runner | null; probe?: Probe; isolation?: any; egress?: any; assessment?: any; deps?: StageDeps; simulation?: boolean } = {},
): any {
  const started = new Date().toISOString();
  const s = scopeOf(wf, scope);
  // Test doubles may replace the stage operations only as an explicit SIMULATION, which never counts as BMad execution.
  if (opts.deps && !opts.simulation) throw new Error('stage test doubles require simulation: true');
  const deps = opts.deps ?? LIVE_DEPS;
  const before = governanceVerdict(wf, scope);
  const ind = opts.simulation && deps.independent ? deps.independent(wf, scope) : independentEvidence(wf, scope);
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
    if (prior?.status === 'RECEIPT_VERIFIED' && !opts.simulation) {
      row.status = 'RECEIPT_VERIFIED';
      row.receipt_id = prior.receipt_id;
      continue;
    }
    // Independent evidence the stage depends on: F2 data contracts before architecture, the F6 test receipt before review.
    if (g.stage === 'architecture' && ind.f2.status !== 'ACCEPTED') {
      row.status = 'BLOCKED';
      row.blockers.push(`F2 data-mapping deliveries are not accepted for ${ind.f2.missing.join(', ')}: architecture needs the independent data contracts`);
      stopped = true;
      continue;
    }
    if (g.stage === 'review' && ind.f6.status !== 'ACCEPTED') {
      row.status = 'BLOCKED';
      row.blockers.push('no accepted independent F6 test receipt covers this scope: review needs the independent test evidence');
      stopped = true;
      continue;
    }
    const pf = deps.preflight(wf, g.binding_id, s.text, { probe: opts.probe, record: !opts.simulation, isolation: opts.isolation, egress: opts.egress, assessment: opts.assessment });
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
      const packet = deps.prepare(wf, g.binding_id, s.text);
      const res = deps.execute(wf, packet.packet_id, opts.runner, opts.probe);
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
        const v = deps.verify(wf, scope, g.stage);
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
  const allVerified = stages.every((x) => x.status === 'RECEIPT_VERIFIED') && ind.f2.status === 'ACCEPTED' && ind.f6.status === 'ACCEPTED' && !s.error;
  const status = allVerified && !opts.simulation ? 'BMAD_COMPLIANT' : 'BMAD_BLOCKED';
  const independent = { f2: ind.f2, f6: ind.f6, note: 'F2 and F6 are independent of BMad; their accepted deliveries are required evidence of the governed lifecycle' };
  if (opts.simulation) {
    // A simulation is never sealed, never counted and never BMAD_COMPLIANT; it reports what the sequence would do.
    return { record_id: null, contract: 'bmad/governed-run', contract_version: '1.0', execution_mode: 'SIMULATION', started_at: started, ended_at: new Date().toISOString(), scope: s.text, scope_sha256: s.sha, mandatory: bmadMandatory(wf.run.ctx), status, simulated_outcome: allVerified ? 'ALL_STAGES_PASSED_IN_SIMULATION' : 'BLOCKED_IN_SIMULATION', stages, independent_evidence: independent, fallback: 'none', local_conversion_invoked: false, note: 'SIMULATION with test doubles: not BMad execution, not evidence, never recorded' };
  }
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
      execution_mode: 'LIVE',
      status,
      stages,
      independent_evidence: independent,
      fallback: 'none',
      local_conversion_invoked: false,
      note: status === 'BMAD_COMPLIANT' ? 'every lifecycle stage has a verified LIVE receipt for this scope; completion still needs the independent F6 receipt and the F7 review receipt' : 'BMAD_BLOCKED: the run stopped at the first stage that could not launch; nothing ran outside BMad in its place',
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

