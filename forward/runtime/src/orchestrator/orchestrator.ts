/**
 * The Forward Orchestrator: the single deterministic controller of the
 * forward workflow. Claude Code subagents do the analysis work; this runtime
 * decides what may run, validates what goes in and comes out, evaluates
 * gates, moves the state machine and keeps the audit trail. No agent output
 * can pass a gate or move the workflow into an approval state.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { readJson, sha256File } from '../core/fsutil';
import { assertGenerationAllowed, GenerationNotAuthorizedError } from '../core/guard';
import { discoverSystem, selectPrograms } from '../core/model';
import { loadArtifacts } from '../core/artifacts';
import { AgentSpec, AGENTS, findAgent, InputKind } from './agents';
import { validateSkill } from './skills';
import { allUnits, buildF1Extracts, buildF2Extracts, gapsInScope, rulesInScope, Unit, unitKey } from './extracts';
import { computeLedger, planBatches, writeLedger } from './ledger';
import { buildSemanticContext } from './evidence-index';
import { checkDocument } from '../../../verification/src/semantic';
import { Classification, classifyProgram } from './classification';
import { evaluateG0, evaluateGate, gatePassed, GateId, GateResult, gateSpec, openRun, RunHandle } from './gates';
import { agentOutputDir, canWrite, PolicyRoots } from './permissions';
import { AnyState, findTransition, INITIAL, isState, WorkflowState } from './states';
import { WorkflowStateRecord, WorkflowStore } from './store';

export class OrchestratorError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'OrchestratorError';
  }
}

export interface Workflow {
  run: RunHandle;
  store: WorkflowStore;
  state: WorkflowStateRecord;
}

const now = () => new Date().toISOString();

function storeFor(ctx: RuntimeContext, runDir: string): WorkflowStore {
  return new WorkflowStore(runDir, (st) => ctx.contracts.validate('orchestrator/workflow-state', st).errors);
}

export function policyRoots(run: RunHandle, state: WorkflowStateRecord | null): PolicyRoots {
  const cfg: any = run.ctx.config;
  const target = cfg.orchestrator?.java_target_dir ? path.resolve(run.ctx.repoRoot, cfg.orchestrator.java_target_dir) : null;
  return {
    repoRoot: run.ctx.repoRoot,
    workflowDir: new WorkflowStore(run.runDir).dir,
    sourceRoot: run.ctx.sourceRoot,
    javaTargetDir: target,
    generationAuthorized: generationAuthorized(run, state),
  };
}

/** Java generation needs the config flag AND an approved generation gate (G4 PASS on this baseline). */
/**
 * Mandatory-BMad lifecycle evidence for a new governed operation on `scope` (end-to-end integration): verified LIVE
 * receipts for every stage up to `upTo` plus the independent F2 (and, for the full lifecycle, F6) evidence. Loaded
 * lazily so modules that must not import BMad (the pilot) can still enforce it.
 */
export function bmadLifecycleEvidence(wf: Workflow, scope: string, upTo?: string): { required: boolean; ok: boolean; status: string; reasons: string[] } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const g = require('../bmad/governance');
  if (!g.bmadMandatory(wf.run.ctx)) return { required: false, ok: true, status: 'NOT_MANDATORY', reasons: [] };
  const v = g.governanceVerdict(wf, scope, upTo ? { upTo } : {});
  const reasons = [...v.stages.filter((s: any) => s.status !== 'RECEIPT_VERIFIED').map((s: any) => `${s.stage} (${s.workflow_id}): ${s.reasons[0]}`), ...(v.independent_evidence.f2.status !== 'ACCEPTED' ? [`F2 data mapping not accepted for ${v.independent_evidence.f2.missing.join(', ')}`] : [])];
  return { required: true, ok: v.status === 'BMAD_COMPLIANT', status: v.status, reasons };
}

export function generationAuthorized(run: RunHandle, state: WorkflowStateRecord | null): boolean {
  try {
    assertGenerationAllowed(run.ctx.config.generation, [{ gate_id: 'GENERATION', approved: gatePassed(state, 'G4', run.manifestSha256) }]);
    // STEP 21: with mandatory BMad governance, generation also needs verified LIVE BMad receipts up to sprint
    // (loaded lazily: the governance module depends on this one).
    if ((run.ctx.config as any).bmad_governance?.mandatory) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const g = require('../bmad/governance');
      if (!g.bmadGenerationReady(loadWorkflow(run.ctx, run.runId)).ok) return false;
    }
    return true;
  } catch (e) {
    if (e instanceof GenerationNotAuthorizedError) return false;
    throw e;
  }
}

function skillsDir(ctx: RuntimeContext): string {
  const cfg: any = ctx.config;
  return path.resolve(ctx.repoRoot, cfg.orchestrator?.skills_dir ?? '.claude/skills');
}
export function agentsDir(ctx: RuntimeContext): string {
  const cfg: any = ctx.config;
  return path.resolve(ctx.repoRoot, cfg.orchestrator?.agents_dir ?? '.claude/agents');
}

/* ------------------------------------------------------------------ */
/* Loading and guarded mutation                                        */
/* ------------------------------------------------------------------ */

export function loadWorkflow(ctx: RuntimeContext, runId = 'latest'): Workflow {
  const run = openRun(ctx, runId);
  const store = storeFor(ctx, run.runDir);
  if (!store.exists()) throw new OrchestratorError(`no workflow for run ${run.runId}; run 'workflow init' first`, 'NO_WORKFLOW');
  return { run, store, state: store.readState() };
}

/** Runs a mutating operation under the lock, after verifying the checkpoint. */
export function mutate<T>(wf: Workflow, op: string, fn: (wf: Workflow) => T): T {
  const cp = wf.store.verifyCheckpoint();
  if (!cp.ok) throw new OrchestratorError('workflow checkpoint verification failed; refusing to continue', 'CHECKPOINT_INVALID', cp.problems);
  wf.store.lock(op);
  try {
    return fn(wf);
  } finally {
    wf.store.unlock();
  }
}

function setState(wf: Workflow, to: WorkflowState, guard: string, evidence: string | null, extra: Partial<WorkflowStateRecord> = {}): void {
  const s = wf.state;
  const from = s.state;
  if (to === 'BLOCKED' && from !== 'BLOCKED') s.blocked_from = isState(from) ? (from as WorkflowState) : null;
  if (from === 'BLOCKED' && to !== 'BLOCKED') {
    s.blocked_from = null;
    s.blockers = [];
  }
  Object.assign(s, extra);
  s.history.push({ seq: s.history.length + 1, at: now(), from, to, guard, evidence });
  s.state = to;
  wf.store.append('transition', { from, to, guard, evidence });
}

/* ------------------------------------------------------------------ */
/* init                                                                */
/* ------------------------------------------------------------------ */

export function initWorkflow(ctx: RuntimeContext, runId = 'latest'): Workflow {
  const run = openRun(ctx, runId);
  const store = storeFor(ctx, run.runDir);
  if (store.exists()) throw new OrchestratorError(`workflow already exists for run ${run.runId}; use 'workflow resume'`, 'EXISTS');
  store.ensureLayout();
  store.lock('init');
  try {
    const at = now();
    const set = loadArtifacts(ctx);
    const state: WorkflowStateRecord = {
      contract: 'workflow-state',
      contract_version: '1.0',
      workflow_id: `WF-${run.runId}`,
      run_id: run.runId,
      created_at: at,
      updated_at: at,
      baseline: {
        run_id: run.runId,
        manifest_path: path.relative(ctx.repoRoot, run.manifestPath).split(path.sep).join('/'),
        manifest_sha256: run.manifestSha256,
        inputs: Object.fromEntries((run.manifest.inputs as any[]).map((i) => [i.key, i.sha256 ?? null])),
        per_program: { logic: run.manifest.per_program_files.logic.sha256, raw_structure: run.manifest.per_program_files.raw_structure.sha256 },
        git_commit: run.manifest.repository?.git?.commit ?? null,
      },
      state: INITIAL,
      blocked_from: null,
      blockers: [],
      history: [],
      gates: {},
      packets: [],
      receipts: [],
      checkpoint: { seq: 0, at, state_sha256: '', audit_head: '', audit_entries: 0 },
    };
    const wf: Workflow = { run, store, state };
    store.append('workflow_created', { workflow_id: state.workflow_id, baseline: state.baseline });

    // Evidence-based program classification (never an authorisation).
    const sys = discoverSystem(set);
    const narr = new Map(set.logicFiles.filter((f) => f.data).map((f) => [f.file_id, typeof f.data.program_narrative === 'string' ? f.data.program_narrative : null]));
    const invIssues: any[] = set.artifacts.inventory?.data?.issues ?? [];
    const gaps: any[] = set.artifacts.gaps?.data?.gaps ?? [];
    const classes: Classification[] = sys.programs.map((p) =>
      classifyProgram(
        p,
        narr.get(p.file_id) ?? null,
        invIssues.filter((i) => (i.source_file ?? i.path) === p.relative_path).map((i) => String(i.message ?? '')),
        gaps.filter((g) => g.source_program === p.program_id).map((g) => `${g.title} ${g.description ?? ''}`),
      ),
    );
    const counts: Record<string, number> = {};
    for (const c of classes) counts[`${c.class}:${c.confidence}`] = (counts[`${c.class}:${c.confidence}`] ?? 0) + 1;
    fs.writeFileSync(store.p('program_classification.json'), JSON.stringify({ contract: 'program-classification', generated_at: at, baseline_manifest_sha256: run.manifestSha256, counts, programs: classes }, null, 2) + '\n');
    store.append('classification_recorded', { counts });

    const g0 = evaluateG0(run, state, at);
    recordGate(wf, g0);
    if (g0.status === 'PASS') setState(wf, 'BASELINE_LOADED', 'gate:G0', `gates/${state.gates.G0.result_file}`);
    else setState(wf, 'BLOCKED', 'gate:G0 failed', `gates/${state.gates.G0.result_file}`, { blockers: [g0.reason] });
    store.writeState(state);
    return wf;
  } finally {
    store.unlock();
  }
}

/**
 * Evaluates a gate from the current records. G2 is evaluated by the approval
 * module (scope readiness + re-verified signed approval); its full evaluation
 * is sealed as a g2/G2E-NNNN record referenced by the gate result.
 */
function freshGate(wf: Workflow, gate: GateId): GateResult {
  if (gate === 'G3' || gate === 'G4') {
    // G3/G4: signed architecture / story-set approval re-verified against current content (design module).
    const d = require('../design/approvals') as typeof import('../design/approvals');
    const o = d.evaluateDesignGate(wf, gate);
    const sub = `${d.DESIGN_DIR}/evaluations`;
    const id = `${gate}E-${String(wf.store.list(sub).filter((f) => f.startsWith(gate)).length + 1).padStart(4, '0')}`;
    const file = wf.store.writeRecord(sub, `${id}.json`, { evaluation_id: id, evaluated_at: o.result.evaluated_at, gate_status: o.result.status, ...o.evaluation });
    const sha = sha256File(file);
    o.result.inputs.push({ kind: `${gate.toLowerCase()}_evaluation`, ref: `${sub}/${id}.json`, sha256: sha });
    wf.store.append('design_evaluation_recorded', { evaluation_id: id, gate, status: o.result.status, sha256: sha });
    d.sealInvalidations(wf, o.invalidations);
    return o.result;
  }
  if (gate !== 'G2') return evaluateGate(gate, wf.run, wf.state, wf.store);
  // Loaded lazily: the approval module builds on this orchestrator.
  const g2 = require('../approval/approvals') as typeof import('../approval/approvals');
  const { result, evaluation } = g2.evaluateG2Gate(wf);
  if (evaluation) {
    const id = `G2E-${String(wf.store.list('g2').length + 1).padStart(4, '0')}`;
    const file = wf.store.writeRecord('g2', `${id}.json`, { ...evaluation, evaluation_id: id, evaluated_at: result.evaluated_at, gate_status: result.status });
    const sha = sha256File(file);
    result.inputs.push({ kind: 'g2_evaluation', ref: `g2/${id}.json`, sha256: sha });
    wf.store.append('g2_evaluation_recorded', { evaluation_id: id, scope: evaluation.selector_text, readiness: evaluation.readiness, blocking: evaluation.summary.blocking, scope_sha256: evaluation.scope_sha256, sha256: sha });
  }
  return result;
}

const ARCH_APPROVED_OR_LATER: string[] = ['ARCHITECTURE_APPROVED', 'STORIES_DRAFTED', 'STORIES_APPROVED', 'IMPLEMENTING', 'IMPLEMENTATION_BUILT', 'TESTING', 'REVIEWING', 'AWAITING_ACCEPTANCE'];
const STORIES_APPROVED_OR_LATER: string[] = ['STORIES_APPROVED', 'IMPLEMENTING', 'IMPLEMENTATION_BUILT', 'TESTING', 'REVIEWING', 'AWAITING_ACCEPTANCE'];
const APPROVED_OR_LATER: string[] = ['REQUIREMENTS_APPROVED', 'ARCHITECTURE_DRAFTED', 'ARCHITECTURE_APPROVED', 'STORIES_DRAFTED', 'STORIES_APPROVED', 'IMPLEMENTING', 'IMPLEMENTATION_BUILT', 'TESTING', 'REVIEWING', 'AWAITING_ACCEPTANCE'];

function recordGate(wf: Workflow, r: GateResult): void {
  const v = wf.run.ctx.contracts.validate('orchestrator/gate-result', r);
  if (!v.valid) throw new OrchestratorError('gate result violates its contract', 'CONTRACT', v.errors);
  const n = wf.store.list('gates').length + 1;
  const file = `${r.gate}-${String(n).padStart(4, '0')}.json`;
  wf.store.writeRecord('gates', file, r);
  wf.state.gates[r.gate] = { status: r.status, result_file: file, evaluated_at: r.evaluated_at, baseline_sha256: r.baseline.manifest_sha256 };
  wf.store.append('gate_evaluated', { gate: r.gate, status: r.status, reason: r.reason, file });
}

/* ------------------------------------------------------------------ */
/* gates and transitions                                               */
/* ------------------------------------------------------------------ */

export function runGate(wf: Workflow, gate: GateId): GateResult {
  return mutate(wf, `gate ${gate}`, () => {
    const r = freshGate(wf, gate);
    recordGate(wf, r);
    // A failed baseline or evidence gate blocks the workflow.
    if ((gate === 'G0' || gate === 'G1') && r.status === 'FAIL' && wf.state.state !== 'BLOCKED' && wf.state.state !== 'FAILED' && wf.state.state !== 'ACCEPTED') {
      setState(wf, 'BLOCKED', `gate:${gate} failed`, `gates/${wf.state.gates[gate].result_file}`, { blockers: [r.reason] });
    }
    // Approved requirements whose approval no longer verifies invalidate everything built on them.
    if (gate === 'G2' && r.status !== 'PASS' && APPROVED_OR_LATER.includes(String(wf.state.state))) {
      setState(wf, 'BLOCKED', 'gate:G2 approval invalidated', `gates/${wf.state.gates.G2.result_file}`, { blockers: [`G2 approval no longer valid: ${r.reason}`] });
    }
    for (const [g, from] of [['G3', ARCH_APPROVED_OR_LATER], ['G4', STORIES_APPROVED_OR_LATER]] as const) {
      if (gate === g && r.status !== 'PASS' && from.includes(String(wf.state.state))) {
        setState(wf, 'BLOCKED', `gate:${g} approval invalidated`, `gates/${wf.state.gates[g].result_file}`, { blockers: [`${g} approval no longer valid: ${r.reason}`] });
      }
    }
    // Dependency-aware invalidation: a failing upstream gate re-evaluates the downstream gates that hold approvals.
    if (r.status !== 'PASS' && (gate === 'G2' || gate === 'G3')) {
      const d = require('../design/approvals') as typeof import('../design/approvals');
      for (const g of gate === 'G2' ? (['G3', 'G4'] as GateId[]) : (['G4'] as GateId[])) if (d.designApprovals(wf, g as 'G3' | 'G4').length) recordGate(wf, freshGate(wf, g));
    }
    wf.store.writeState(wf.state);
    return r;
  });
}

export interface TransitionOutcome {
  accepted: boolean;
  from: AnyState;
  to: string;
  reason: string;
}

function reject(wf: Workflow, to: string, reason: string, by: string): TransitionOutcome {
  wf.store.append('transition_rejected', { from: wf.state.state, to, reason, requested_by: by });
  wf.store.writeState(wf.state);
  return { accepted: false, from: wf.state.state, to, reason };
}

export function advance(wf: Workflow, to: string, opts: { reason?: string; requestedBy?: string } = {}): TransitionOutcome {
  return mutate(wf, `advance ${to}`, () => {
    const by = opts.requestedBy ?? 'cli';
    const s = wf.state;
    if (!isState(to)) return reject(wf, to, `unknown state '${to}'`, by);
    const t = findTransition(s.state, to, s.blocked_from);
    if (!t) return reject(wf, to, `transition ${s.state} -> ${to} is not allowed`, by);
    // Every transition re-checks that the baseline is unchanged.
    if (to !== 'BLOCKED' && to !== 'FAILED') {
      const g0 = evaluateG0(wf.run, s);
      if (g0.status !== 'PASS') {
        recordGate(wf, g0);
        return reject(wf, to, `baseline no longer intact: ${g0.reason}`, by);
      }
    }
    let evidence: string | null = null;
    const g = t.guard;
    if (g.kind === 'gate') {
      // Approval gates are re-evaluated at transition time: a stale PASS never authorises a transition.
      if (g.gate === 'G2' || g.gate === 'G3' || g.gate === 'G4') recordGate(wf, freshGate(wf, g.gate as GateId));
      if (!gatePassed(s, g.gate, wf.run.manifestSha256)) return reject(wf, to, `${g.gate} has not passed on the current baseline (latest: ${s.gates[g.gate]?.status ?? 'NOT_RUN'})`, by);
      evidence = `gates/${s.gates[g.gate].result_file}`;
    } else if (g.kind === 'receipt') {
      const enteredAt = [...s.history].reverse().find((h) => h.to === s.state)?.at ?? s.created_at;
      const r = acceptedReceipts(wf).filter((x) => x.receipt.agent === g.agent && x.receipt.outcome === 'completed' && x.recorded_at >= enteredAt);
      if (!r.length) return reject(wf, to, `no accepted completed receipt from ${g.agent} since entering ${s.state}`, by);
      const spec = findAgent(g.agent)!;
      if (spec.unit_kinds.length) {
        const l = computeLedger(wf, spec);
        writeLedger(wf, l);
        if (!l.complete) return reject(wf, to, `${g.agent} coverage incomplete: ${l.completed}/${l.units_total} units completed (${l.in_progress} in progress, ${l.pending} pending)`, by);
      }
      evidence = `receipts/${r[r.length - 1].receipt_id}.json`;
    } else if (g.kind === 'dispatch') {
      const pk = wf.store.list('packets').map((f) => wf.store.readRecord('packets', f)).filter((p: any) => p.agent.id === g.agent && p.dispatchable);
      if (!pk.length) return reject(wf, to, `no dispatchable packet for ${g.agent}`, by);
      evidence = `packets/${pk[pk.length - 1].packet_id}.json`;
    } else {
      if ((to === 'BLOCKED' || to === 'FAILED') && !opts.reason) return reject(wf, to, `a reason is required to move to ${to}`, by);
      if (s.state === 'BLOCKED' && to !== 'FAILED') {
        // Unblocking: the cause must be gone. Re-evaluate the gate that blocked, if any.
        const blockingGate = [...s.history].reverse().find((h) => h.to === 'BLOCKED')?.guard.match(/gate:(G\d)/)?.[1] as GateId | undefined;
        if (blockingGate) {
          const r = freshGate(wf, blockingGate);
          recordGate(wf, r);
          if (r.status !== 'PASS') return reject(wf, to, `blocking gate ${blockingGate} still ${r.status}: ${r.reason}`, by);
        } else if (!opts.reason) return reject(wf, to, 'a reason confirming the blocker is cleared is required', by);
      }
    }
    setState(wf, to, g.kind === 'gate' ? `gate:${g.gate}` : g.kind === 'none' ? `manual:${opts.reason ?? g.note}` : `${g.kind}:${g.agent}`, evidence, to === 'BLOCKED' ? { blockers: [opts.reason as string] } : {});
    wf.store.writeState(s);
    return { accepted: true, from: wf.state.history[wf.state.history.length - 1].from, to, reason: 'guard satisfied' };
  });
}

/* ------------------------------------------------------------------ */
/* dispatch packets                                                    */
/* ------------------------------------------------------------------ */

function inputFiles(wf: Workflow, kind: InputKind, programs: Set<string> | null): Array<{ path: string; sha256: string | null; present: boolean }> {
  const ctx = wf.run.ctx;
  const rel = (p: string) => path.relative(ctx.repoRoot, p).split(path.sep).join('/');
  const f = (abs: string) => ({ path: rel(abs), sha256: sha256File(abs), present: fs.existsSync(abs) });
  const art: Record<string, string> = ctx.config.reverse_artifacts;
  if (kind.startsWith('reverse:')) {
    const key = kind.slice(8);
    return art[key] ? [f(path.resolve(ctx.repoRoot, art[key]))] : [];
  }
  if (kind === 'plan:evidence_packets') {
    const invPath = path.join(wf.run.runDir, 'program_inventory.json');
    const inv = readJson(invPath);
    if (!inv.ok) return [{ path: rel(invPath), sha256: null, present: false }];
    const files = ((inv.data as any).programs as any[])
      .filter((p) => !programs || programs.has(p.source_ids.file_id))
      .map((p) => f(path.join(wf.run.runDir, p.evidence_packet)));
    // Units with no related program (e.g. a copybook nothing includes): the program inventory is the evidence anchor.
    return files.length ? files : [f(invPath)];
  }
  if (kind.startsWith('plan:')) {
    const name = kind.slice(5) === 'readiness' ? 'readiness_report' : kind.slice(5);
    return [f(path.join(wf.run.runDir, `${name}.json`))];
  }
  if (kind === 'workflow:classification') return [f(wf.store.p('program_classification.json'))];
  if (kind.startsWith('receipt:')) {
    const agent = kind.slice(8);
    const rs = acceptedReceipts(wf).filter((r) => r.receipt.agent === agent && r.receipt.outcome === 'completed');
    if (!rs.length) return [{ path: `receipts/(none from ${agent})`, sha256: null, present: false }];
    const last = rs[rs.length - 1];
    return [f(wf.store.p('receipts', `${last.receipt_id}.json`)), ...last.receipt.outputs.map((o: any) => f(path.resolve(ctx.repoRoot, o.path)))];
  }
  return [];
}

export interface DispatchPacket {
  contract: 'dispatch-packet';
  contract_version: string;
  packet_id: string;
  created_at: string;
  workflow_id: string;
  workflow_state: AnyState;
  baseline: { run_id: string; manifest_sha256: string };
  agent: { id: string; name: string; definition: string };
  dispatchable: boolean;
  blockers: string[];
  units: Unit[];
  programs: Array<{ program_id: string; file_id: string; classification: string; modernization_scope: string }>;
  inputs: Array<{ kind: string; required: boolean; files: Array<{ path: string; sha256: string | null; present: boolean }> }>;
  scope: { rules_in_scope: string[]; gaps_in_scope: string[] };
  source: { available: boolean; root: string | null; origin: string; note: string };
  skills: Array<{ name: string; status: string; sha256: string | null }>;
  permissions: { output_dir: string; may_write_code: boolean; generation_authorized: boolean; allowed_tools: string[]; forbidden: string[] };
  expected_outputs: Array<{ name: string; kind: string; contract: string | null }>;
  receipt_path: string;
  invocation: string;
}

function rel(wf: Workflow, p: string): string {
  return path.relative(wf.run.ctx.repoRoot, p).split(path.sep).join('/');
}

export function prepare(wf: Workflow, agentKey: string, opts: { programs?: string[]; units?: Unit[] } = {}): DispatchPacket {
  const a = findAgent(agentKey);
  if (!a) throw new OrchestratorError(`unknown agent '${agentKey}'`, 'UNKNOWN_AGENT', AGENTS.map((x) => `${x.id} ${x.name}`));
  return mutate(wf, `prepare ${a.id}`, () => {
    const s = wf.state;
    const refuse = (reason: string) => {
      wf.store.append('dispatch_rejected', { agent: a.id, state: s.state, reason });
      wf.store.writeState(s);
      return new OrchestratorError(`cannot dispatch ${a.name}: ${reason}`, 'DISPATCH_REJECTED');
    };
    if (!a.dispatch_states.includes(s.state)) throw refuse(`workflow state is ${s.state}; ${a.id} may only be dispatched in ${a.dispatch_states.join(', ')}`);
    if (a.requires_gate === 'G2' || a.requires_gate === 'G3' || a.requires_gate === 'G4') recordGate(wf, freshGate(wf, a.requires_gate as GateId));
    if (a.requires_gate && !gatePassed(s, a.requires_gate, wf.run.manifestSha256)) throw refuse(`${a.requires_gate} has not passed on the current baseline`);
    const g0 = evaluateG0(wf.run, s);
    if (g0.status !== 'PASS') {
      recordGate(wf, g0);
      throw refuse(`baseline no longer intact: ${g0.reason}`);
    }

    const classification = JSON.parse(fs.readFileSync(wf.store.p('program_classification.json'), 'utf8')).programs as Classification[];
    const set = loadArtifacts(wf.run.ctx);
    const sys = discoverSystem(set);

    // Units: explicit, from a program selection, or every unit of the agent's kinds.
    let units: Unit[];
    if (opts.units && opts.units.length) units = opts.units;
    else if (opts.programs && opts.programs.length) {
      const sel = selectPrograms(sys, opts.programs);
      if (sel.unknown.length) throw refuse(`unknown programs requested: ${sel.unknown.join(', ')}`);
      units = sel.selected.map((p) => ({ unit_kind: 'program' as const, name: p.program_id, file_id: p.file_id }));
    } else units = a.unit_kinds.length ? allUnits(sys, a.unit_kinds) : sys.programs.map((p) => ({ unit_kind: 'program' as const, name: p.program_id, file_id: p.file_id }));
    const known = new Set(allUnits(sys, ['program', 'copybook']).map(unitKey));
    const unknownUnits = units.filter((u) => !known.has(unitKey(u)));
    if (unknownUnits.length) throw refuse(`units not discovered in the inventory: ${unknownUnits.map((u) => u.name).join(', ')}`);
    if (a.unit_kinds.length && units.some((u) => !a.unit_kinds.includes(u.unit_kind))) throw refuse(`${a.id} does not work on ${[...new Set(units.map((u) => u.unit_kind))].join('/')} units`);
    const programUnits = units.filter((u) => u.unit_kind === 'program');
    const fileIds = new Set(programUnits.map((u) => u.file_id));
    // Copybook units draw their program evidence from the programs that include them.
    for (const u of units.filter((x) => x.unit_kind === 'copybook')) {
      const cb = sys.copybooks.find((c) => c.file_id === u.file_id);
      for (const name of cb?.used_by ?? []) {
        const prog = sys.programs.find((x) => x.program_id === name);
        if (prog) fileIds.add(prog.file_id);
      }
    }

    const blockers: string[] = [];
    const inputs = a.inputs.map((i) => {
      const files = inputFiles(wf, i.kind, fileIds);
      if (i.required && (!files.length || files.some((f) => !f.present))) blockers.push(`required input ${i.kind} is not available`);
      return { kind: i.kind as string, required: i.required, files };
    });
    const skills = a.skills.map((n) => validateSkill(skillsDir(wf.run.ctx), n));
    for (const sk of skills) if (sk.status !== 'INSTALLED') blockers.push(`${sk.status}: ${sk.name}${sk.problems.length ? ` (${sk.problems.slice(0, 3).join('; ')})` : ''}`);
    const roots = policyRoots(wf.run, s);
    if (a.may_write_code && !roots.generationAuthorized) blockers.push('Java generation is not authorised (config flag and G4 PASS required)');
    const outOfScope = classification.filter((c) => fileIds.has(c.file_id) && c.modernization_scope !== 'candidate');
    if (a.may_write_code && outOfScope.length) blockers.push(`${outOfScope.length} selected program(s) need a modernisation scope decision`);

    const n = wf.store.list('packets').length + 1;
    const packetId = `PKT-${String(n).padStart(4, '0')}-${a.id}`;
    const outDir = path.join(agentOutputDir(roots, a), packetId);

    // Runtime-prepared extracts (deterministic slices of the reverse artifacts).
    let extractFiles: string[] = [];
    const exDir = wf.store.p('extracts', packetId);
    if (a.id === 'F1') extractFiles = buildF1Extracts(exDir, set, sys, units, classification, wf.run.runDir, wf.run.ctx.repoRoot);
    if (a.id === 'F2') extractFiles = buildF2Extracts(exDir, set, sys, units, wf.run.ctx.repoRoot);
    for (const f of extractFiles) inputs.push({ kind: `extract:${path.basename(f, '.json')}`, required: true, files: [{ path: rel(wf, f), sha256: sha256File(f), present: true }] });
    if (a.id === 'F2') {
      inputs.push({ kind: 'reverse:data_layouts', required: true, files: units.map((u) => {
        const dir = path.join(path.dirname(set.artifacts.data.path), 'data_layouts');
        const f = fs.existsSync(dir) ? fs.readdirSync(dir).find((x) => x.startsWith(`${u.file_id}__`)) : undefined;
        const abs = f ? path.join(dir, f) : path.join(dir, `${u.file_id}__(missing)`);
        return { path: rel(wf, abs), sha256: sha256File(abs), present: fs.existsSync(abs) };
      }).filter((f) => f.present) });
    }
    if (a.id === 'F1' || a.id === 'F2') {
      for (const u of programUnits) {
        const p = sys.programs.find((x) => x.file_id === u.file_id);
        const lf = set.logicFiles.find((x) => x.file_id === u.file_id);
        const rf = set.rawStructureFiles.find((x) => x.file_id === u.file_id);
        const files = [lf, rf].filter(Boolean).map((x) => ({ path: x!.repo_path, sha256: x!.sha256, present: x!.present }));
        if (files.length) inputs.push({ kind: `program:${p?.program_id ?? u.name}`, required: true, files });
      }
    }

    // Verified LIVE BMad drafts of the packet's programs, as optional non-authoritative inputs (F3, F4, F5, F7 only;
    // F2 and F6 stay independent of BMad). Loaded lazily: the governance module depends on this one.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    inputs.push(...require('../bmad/governance').verifiedDrafts(wf, a.id, programUnits.map((u) => u.name)));

    const srcAvailable = !!wf.run.ctx.sourceRoot && fs.existsSync(wf.run.ctx.sourceRoot) && fs.statSync(wf.run.ctx.sourceRoot).isDirectory();
    const packet: DispatchPacket = {
      contract: 'dispatch-packet',
      contract_version: '1.0',
      packet_id: packetId,
      created_at: now(),
      workflow_id: s.workflow_id,
      workflow_state: s.state,
      baseline: { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 },
      agent: { id: a.id, name: a.name, definition: rel(wf, path.join(agentsDir(wf.run.ctx), `${a.name}.agent.md`)) },
      dispatchable: blockers.length === 0,
      blockers,
      units,
      programs: programUnits.map((u) => {
        const c = classification.find((x) => x.file_id === u.file_id);
        return { program_id: u.name, file_id: u.file_id, classification: c ? `${c.class} (${c.confidence})` : 'unclassified', modernization_scope: c?.modernization_scope ?? 'requires_scope_decision' };
      }),
      inputs,
      scope: {
        rules_in_scope: a.id === 'F1' ? rulesInScope(set, programUnits.map((u) => u.name)) : [],
        gaps_in_scope: a.id === 'F1' || a.id === 'F2' ? gapsInScope(set, sys, units) : [],
      },
      source: {
        available: srcAvailable,
        root: srcAvailable ? wf.run.ctx.sourceRoot : null,
        origin: wf.run.ctx.sourceRootOrigin,
        note: srcAvailable
          ? 'Original COBOL source is readable under root (unit relative_path values are relative to it). verified_from_source may be claimed only for facts actually checked against that text.'
          : 'Original COBOL source is not available to this packet: verified_from_source must not be claimed.',
      },
      skills: skills.map((x) => ({ name: x.name, status: x.status, sha256: x.sha256 })),
      permissions: {
        output_dir: rel(wf, outDir),
        may_write_code: a.may_write_code && roots.generationAuthorized,
        generation_authorized: roots.generationAuthorized,
        allowed_tools: a.allowed_tools,
        forbidden: a.forbidden,
      },
      expected_outputs: a.outputs,
      receipt_path: rel(wf, path.join(outDir, 'receipt.json')),
      invocation: blockers.length
        ? `NOT DISPATCHABLE: ${blockers.join('; ')}`
        : `Invoke Claude Code subagent '${a.name}' with this packet. It runs its two skills, writes only inside output_dir, writes an agent-receipt to receipt_path, and the operator records it with 'workflow record --receipt ${rel(wf, path.join(outDir, 'receipt.json'))}'.`,
    };
    const v = wf.run.ctx.contracts.validate('orchestrator/dispatch-packet', packet);
    if (!v.valid) throw new OrchestratorError('dispatch packet violates its contract', 'CONTRACT', v.errors);
    wf.store.writeRecord('packets', `${packet.packet_id}.json`, packet);
    fs.mkdirSync(outDir, { recursive: true });
    s.packets.push(packet.packet_id);
    wf.store.append('packet_prepared', { packet_id: packet.packet_id, agent: a.id, dispatchable: packet.dispatchable, units: units.length, blockers });
    if (a.unit_kinds.length) writeLedger(wf, computeLedger(wf, a));
    wf.store.writeState(s);
    return packet;
  });
}

/** Prepares one packet per pending batch of units for a unit-based agent. */
export function prepareBatches(wf: Workflow, agentKey: string, size: number): DispatchPacket[] {
  const a = findAgent(agentKey);
  if (!a) throw new OrchestratorError(`unknown agent '${agentKey}'`, 'UNKNOWN_AGENT');
  if (!a.unit_kinds.length) throw new OrchestratorError(`${a.id} does not work in unit batches`, 'NOT_BATCHABLE');
  if (!Number.isInteger(size) || size < 1) throw new OrchestratorError('batch size must be a positive integer', 'USAGE');
  const batches = planBatches(computeLedger(wf, a), size);
  const out: DispatchPacket[] = [];
  for (const b of batches) {
    const fresh = loadWorkflow(wf.run.ctx, wf.run.runId);
    out.push(prepare(fresh, a.id, { units: b }));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* receipts                                                            */
/* ------------------------------------------------------------------ */

export interface RecordedReceipt {
  receipt_id: string;
  packet_id: string;
  recorded_at: string;
  receipt: any;
  verdict: {
    accepted: boolean;
    violations: string[];
    provenance?: {
      packet_sha256: string | null;
      skills: Array<{ name: string; sha256: string | null }>;
      access?: { inputs_supplied: number; declared_reads: string[] | null; inputs_used_declared: number; status: 'agent_declared_unverified' };
      outputs: Array<{ path: string; stated_sha256: string | null; runtime_sha256: string | null; contract: string | null; schema_valid: boolean | null; semantic_problems: string[] }>;
    };
  };
}

export function acceptedReceipts(wf: Workflow): RecordedReceipt[] {
  return wf.store.list('receipts').map((f) => wf.store.readRecord<RecordedReceipt>('receipts', f)).filter((r) => r.verdict.accepted);
}

const APPROVAL_KEYS = /^(approved|approval|approvals|gate_status|gate_result|gate_passed|passed_gates|accepted_by|sign_?off)$/i;
const APPROVAL_VALUES = /^(approved|accepted|pass|passed)$/i;

function findApprovalAssertions(v: unknown, at = '$'): string[] {
  const out: string[] = [];
  if (Array.isArray(v)) v.forEach((x, i) => out.push(...findApprovalAssertions(x, `${at}[${i}]`)));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (APPROVAL_KEYS.test(k)) out.push(`${at}.${k}`);
      else if (/(^|_)status$/i.test(k) && typeof x === 'string' && APPROVAL_VALUES.test(x)) out.push(`${at}.${k}=${x}`);
      out.push(...findApprovalAssertions(x, `${at}.${k}`));
    }
  }
  return out;
}

/** Number of distinct input paths the deliverables declare in inputs_used (an agent declaration, not access evidence). */
function declaredInputsUsed(wf: Workflow, outs: Array<{ path: string }>): number {
  const paths = new Set<string>();
  for (const o of outs) {
    const j = readJson(path.resolve(wf.run.ctx.repoRoot, o.path));
    if (j.ok) for (const x of (((j.data as any).inputs_used ?? []) as any[])) paths.add(x.path);
  }
  return paths.size;
}

/** Requirement IDs from other accepted F1 receipts (for cross-batch uniqueness and references). */
function acceptedRequirementIds(wf: Workflow, exceptPacket: string): Set<string> {
  const ids = new Set<string>();
  for (const r of acceptedReceipts(wf)) {
    if (r.packet_id === exceptPacket || r.receipt?.agent !== 'F1') continue;
    for (const o of r.receipt.outputs ?? []) {
      if (path.basename(o.path) !== 'draft_requirements.json') continue;
      const j = readJson(path.resolve(wf.run.ctx.repoRoot, o.path));
      if (j.ok) for (const q of ((j.data as any).requirements ?? []) as any[]) ids.add(q.requirement_id);
    }
  }
  return ids;
}

export function recordReceipt(wf: Workflow, receiptFile: string): RecordedReceipt {
  return mutate(wf, 'record receipt', () => {
    const violations: string[] = [];
    const r = readJson(receiptFile);
    let receipt: any = null;
    if (!r.ok) violations.push(`receipt is not valid JSON: ${r.error}`);
    else {
      receipt = r.data;
      const v = wf.run.ctx.contracts.validate('orchestrator/agent-receipt', receipt);
      if (!v.valid) violations.push(...v.errors.map((e) => `contract: ${e}`));
      const asserted = findApprovalAssertions(receipt);
      if (asserted.length) violations.push(`agents may not assert approvals or gate results (${asserted.join(', ')})`);
    }
    const packetId: string = typeof receipt?.packet_id === 'string' ? receipt.packet_id : 'UNKNOWN';
    let packet: DispatchPacket | null = null;
    if (!/^PKT-\d{4}-F[1-7]$/.test(packetId) || !fs.existsSync(wf.store.p('packets', `${packetId}.json`))) violations.push(`unknown packet ${packetId}`);
    else packet = wf.store.readRecord<DispatchPacket>('packets', `${packetId}.json`);
    const agent: AgentSpec | undefined = packet ? findAgent(packet.agent.id) : undefined;
    if (packet && receipt && receipt.agent !== packet.agent.id) violations.push(`receipt agent ${receipt.agent} does not match packet agent ${packet.agent.id}`);
    if (packet && wf.store.list('receipts').some((f) => {
      const x = wf.store.readRecord<RecordedReceipt>('receipts', f);
      return x.packet_id === packetId && x.verdict.accepted;
    })) violations.push(`packet ${packetId} already has an accepted receipt`);
    if (packet && packet.baseline.manifest_sha256 !== wf.run.manifestSha256) violations.push('packet was prepared against a different baseline');
    if (packet && receipt?.outcome === 'completed' && !packet.dispatchable) violations.push(`packet ${packetId} was not dispatchable (${packet.blockers.join('; ')}); a completed outcome is impossible`);

    // Skills: the receipt must name exactly the packet's skills, and the skill files must be unchanged since dispatch.
    const skillProv: Array<{ name: string; sha256: string | null }> = [];
    if (packet && receipt && Array.isArray(receipt.skills_used)) {
      const want = packet.skills.map((x) => x.name).sort().join();
      const got = (receipt.skills_used as any[]).map((x) => x.name).sort().join();
      if (receipt.outcome === 'completed' && want !== got) violations.push(`skills_used [${got}] do not match the packet skills [${want}]`);
      for (const sk of packet.skills) {
        const now = validateSkill(skillsDir(wf.run.ctx), sk.name);
        skillProv.push({ name: sk.name, sha256: now.sha256 });
        if (sk.sha256 && now.sha256 !== sk.sha256) violations.push(`skill ${sk.name} changed after the packet was prepared`);
      }
    }

    const outProv: NonNullable<RecordedReceipt['verdict']['provenance']>['outputs'] = [];
    if (agent && packet && receipt && Array.isArray(receipt.outputs)) {
      const roots = policyRoots(wf.run, wf.state);
      const outDir = path.resolve(wf.run.ctx.repoRoot, packet.permissions.output_dir);
      const docs: Array<{ contract: string; doc: any; path: string }> = [];
      for (const o of receipt.outputs) {
        const abs = path.resolve(wf.run.ctx.repoRoot, String(o.path ?? ''));
        const entry = { path: String(o.path), stated_sha256: o.sha256 ?? null, runtime_sha256: null as string | null, contract: null as string | null, schema_valid: null as boolean | null, semantic_problems: [] as string[] };
        outProv.push(entry);
        const perm = canWrite(agent, abs, roots);
        if (!perm.allowed) {
          violations.push(`output ${o.path}: ${perm.reason}`);
          continue;
        }
        const relToOut = path.relative(outDir, abs);
        if (relToOut.startsWith('..') || path.isAbsolute(relToOut)) {
          violations.push(`output ${o.path} is outside this packet's output_dir ${packet.permissions.output_dir}`);
          continue;
        }
        if (!fs.existsSync(abs)) {
          violations.push(`output ${o.path} does not exist`);
          continue;
        }
        entry.runtime_sha256 = sha256File(abs);
        if (o.sha256 !== null && o.sha256 !== undefined && o.sha256 !== entry.runtime_sha256) violations.push(`output ${o.path} does not match its declared SHA-256`);
        const spec = agent.outputs.find((x) => x.name === path.basename(abs));
        if (spec?.contract) {
          entry.contract = spec.contract;
          if (o.contract && o.contract !== spec.contract) violations.push(`output ${o.path} declares contract ${o.contract}, expected ${spec.contract}`);
        }
        if (abs.toLowerCase().endsWith('.json')) {
          const j = readJson(abs);
          if (!j.ok) {
            violations.push(`output ${o.path} is not valid JSON: ${j.error}`);
            continue;
          }
          const asserted = findApprovalAssertions(j.data);
          if (asserted.length) violations.push(`output ${o.path} asserts approvals or gate results (${asserted.slice(0, 5).join(', ')})`);
          if (entry.contract) {
            const sv = wf.run.ctx.contracts.validate(entry.contract, j.data);
            entry.schema_valid = sv.valid;
            if (!sv.valid) violations.push(...sv.errors.slice(0, 10).map((e) => `output ${path.basename(abs)} violates ${entry.contract}: ${e}`));
            else docs.push({ contract: entry.contract, doc: j.data, path: String(o.path) });
          }
        }
      }
      // Deterministic semantic checks on every schema-valid deliverable.
      if (docs.length) {
        const set = loadArtifacts(wf.run.ctx);
        const ctx = buildSemanticContext(wf, packet, set, agent.skills, acceptedRequirementIds(wf, packetId));
        for (const d of docs) {
          const probs = checkDocument(d.contract, d.doc, ctx, docs);
          const entry = outProv.find((x) => x.path === d.path)!;
          entry.semantic_problems = probs;
          violations.push(...probs.slice(0, 25).map((x) => `output ${path.basename(d.path)}: ${x}`));
          if (probs.length > 25) violations.push(`output ${path.basename(d.path)}: ... ${probs.length - 25} more semantic problems`);
        }
      }
      if (receipt.outcome === 'completed') {
        const names = new Set(receipt.outputs.map((o: any) => path.basename(String(o.path))));
        const missing = agent.outputs.filter((o) => o.kind !== 'java' && !names.has(o.name)).map((o) => o.name);
        if (missing.length) violations.push(`completed receipt is missing expected outputs: ${missing.join(', ')}`);
      }
    }
    // The reverse harness must still be intact after the agent ran.
    const g0 = evaluateG0(wf.run, wf.state);
    if (g0.status !== 'PASS') violations.push(`baseline integrity failed after the agent ran: ${g0.reason}`);

    const rec: RecordedReceipt = {
      receipt_id: `RCPT-${String(wf.store.list('receipts').length + 1).padStart(4, '0')}-${packet?.agent.id ?? 'UNKNOWN'}`,
      packet_id: packetId,
      recorded_at: now(),
      receipt,
      verdict: {
        accepted: violations.length === 0,
        violations,
        provenance: {
          packet_sha256: packet ? sha256File(wf.store.p('packets', `${packetId}.json`)) : null,
          skills: skillProv,
          // Supplied inputs, agent-declared reads and declared inputs_used are recorded separately;
          // none of them is evidence of access until transcript evidence is attached (workflow verify-access).
          access: {
            inputs_supplied: packet ? packet.inputs.reduce((n, i) => n + i.files.length, 0) : 0,
            declared_reads: Array.isArray(receipt?.declared_reads) ? receipt.declared_reads : null,
            inputs_used_declared: declaredInputsUsed(wf, outProv),
            status: 'agent_declared_unverified',
          },
          outputs: outProv,
        },
      },
    };
    wf.store.writeRecord('receipts', `${rec.receipt_id}.json`, rec);
    wf.state.receipts.push(rec.receipt_id);
    wf.store.append(rec.verdict.accepted ? 'receipt_accepted' : 'receipt_rejected', { receipt_id: rec.receipt_id, packet_id: packetId, outcome: receipt?.outcome ?? null, violations: violations.slice(0, 50) });
    if (g0.status !== 'PASS') {
      recordGate(wf, g0);
      if (wf.state.state !== 'BLOCKED') setState(wf, 'BLOCKED', 'gate:G0 failed', `gates/${wf.state.gates.G0.result_file}`, { blockers: [g0.reason] });
    } else if (receipt?.outcome === 'blocked' || receipt?.outcome === 'failed') {
      wf.store.append('agent_reported_problem', { receipt_id: rec.receipt_id, outcome: receipt.outcome, blockers: receipt.blockers ?? [] });
    }
    if (agent?.unit_kinds.length) writeLedger(wf, computeLedger(wf, agent));
    wf.store.writeState(wf.state);
    return rec;
  });
}

/* ------------------------------------------------------------------ */
/* inspection: status, blocked report, resume                          */
/* ------------------------------------------------------------------ */

export function status(wf: Workflow): any {
  const s = wf.state;
  const receipts = wf.store.list('receipts').map((f) => wf.store.readRecord<RecordedReceipt>('receipts', f));
  const receipted = new Set(receipts.filter((r) => r.verdict.accepted).map((r) => r.packet_id));
  const pst = wf.store.list('packet-status');
  const superseded = new Set<string>(pst.length ? (wf.store.readRecord<any>('packet-status', pst[pst.length - 1]).packets ?? []).filter((p: any) => p.status === 'superseded').map((p: any) => p.packet_id) : []);
  const pending = s.packets.filter((p) => !receipted.has(p) && !superseded.has(p));
  const cp = wf.store.verifyCheckpoint();
  return {
    workflow_id: s.workflow_id,
    run_id: s.run_id,
    state: s.state,
    blocked_from: s.blocked_from,
    blockers: s.blockers,
    baseline: { manifest_sha256: s.baseline.manifest_sha256, git_commit: s.baseline.git_commit },
    gates: Object.fromEntries(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'].map((g) => [g, s.gates[g]?.status ?? 'NOT_RUN'])),
    history: s.history.map((h) => `${h.seq}. ${h.from} -> ${h.to} [${h.guard}]`),
    packets: { total: s.packets.length, awaiting_receipt: pending, superseded: [...superseded].sort(), packet_status_record: pst.length ? pst[pst.length - 1] : null },
    receipts: { accepted: receipts.filter((r) => r.verdict.accepted).length, rejected: receipts.filter((r) => !r.verdict.accepted).length },
    checkpoint: { seq: s.checkpoint.seq, verified: cp.ok, problems: cp.problems },
    lock: wf.store.lockInfo(),
    java_generation_authorized: generationAuthorized(wf.run, s),
  };
}

export function blockedReport(wf: Workflow): any {
  const audit = wf.store.readAudit();
  return {
    state: wf.state.state,
    blockers: wf.state.blockers,
    rejected_transitions: audit.filter((e) => e.event === 'transition_rejected').map((e) => ({ at: e.at, ...(e.data as object) })),
    rejected_dispatches: audit.filter((e) => e.event === 'dispatch_rejected').map((e) => ({ at: e.at, ...(e.data as object) })),
    rejected_receipts: audit.filter((e) => e.event === 'receipt_rejected').map((e) => ({ at: e.at, ...(e.data as object) })),
    non_passing_gates: Object.entries(wf.state.gates).filter(([, g]) => g.status !== 'PASS').map(([id, g]) => ({ gate: id, status: g.status, result: g.result_file })),
    undispatchable_packets: wf.store.list('packets').map((f) => wf.store.readRecord<DispatchPacket>('packets', f)).filter((p) => !p.dispatchable).map((p) => ({ packet_id: p.packet_id, blockers: p.blockers })),
  };
}

export function resume(ctx: RuntimeContext, runId = 'latest'): any {
  const wf = loadWorkflow(ctx, runId);
  const cp = wf.store.verifyCheckpoint();
  const lock = wf.store.lockInfo();
  const audit = wf.store.verifyAudit();
  const interrupted = audit.ok && audit.entries > wf.state.checkpoint.audit_entries;
  // Events after the checkpoint are acceptable only if the chain is intact (interrupted write); anything else refuses.
  const hard = cp.problems.filter((p) => !/recorded after the last checkpoint/.test(p));
  if (hard.length) {
    return { resumed: false, state: wf.state.state, problems: hard, action: 'refused: workflow records were altered outside the runtime; start a new workflow from a fresh plan run' };
  }
  const g0 = evaluateG0(wf.run, wf.state);
  // Records are intact, so a lock left by an interrupted operation can be cleared.
  if (lock) wf.store.unlock();
  wf.store.lock('resume');
  try {
    wf.store.append('resume_attempt', { interrupted_events: interrupted ? audit.entries - wf.state.checkpoint.audit_entries : 0, stale_lock: lock, g0: g0.status });
    if (g0.status !== 'PASS') {
      recordGate(wf, g0);
      if (wf.state.state !== 'BLOCKED' && wf.state.state !== 'FAILED' && wf.state.state !== 'ACCEPTED') setState(wf, 'BLOCKED', 'gate:G0 failed', `gates/${wf.state.gates.G0.result_file}`, { blockers: [g0.reason] });
      wf.store.writeState(wf.state);
      return { resumed: false, state: wf.state.state, problems: [g0.reason], action: 'refused: baseline changed (stale baseline); re-plan and start a new workflow' };
    }
    wf.store.writeState(wf.state);
  } finally {
    wf.store.unlock();
  }
  const st = status(wf);
  return { resumed: true, state: wf.state.state, recovered_lock: lock, interrupted_events_sealed: interrupted, awaiting_receipt: st.packets.awaiting_receipt, gates: st.gates, problems: [] };
}

export { gateSpec };
