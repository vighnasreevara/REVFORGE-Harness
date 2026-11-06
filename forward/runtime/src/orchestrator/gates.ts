/**
 * Gate framework G0-G8. Every result carries a status, a reason, the input
 * evidence it looked at and a timestamp.
 *   PASS        evaluated and satisfied
 *   FAIL        evaluated and not satisfied
 *   BLOCKED     a prerequisite gate has not passed on the current baseline
 *   NOT_RUN     nothing has been submitted for this gate yet
 *   UNVERIFIED  evidence exists but cannot be verified (evaluator or approval missing)
 * G0 and G1 are fully evaluated from STEP 1 evidence. G2 is evaluated by the
 * approval module (runtime/src/approval): it PASSes only for a READY scope with
 * a re-verified, signed human approval. G3 and G4 likewise need a re-verified,
 * signed approval of the exact architecture / story set (design module, STEP 7).
 * G5-G8 are fail-closed and never PASS.
 */
import * as fs from 'fs';
import * as path from 'path';
import { collectPermanentIds } from '../../../verification/src/ids';
import { loadArtifacts } from '../core/artifacts';
import { RuntimeContext } from '../core/config';
import { readJson, sha256File } from '../core/fsutil';
import { gitInfo } from '../core/git';
import { discoverSystem, sourceRunKey } from '../core/model';
import { runValidation } from '../commands/validate';
import { PROTECTED_PREFIXES } from '../commands/plan';
import { AgentId } from './agents';
import { WorkflowStateRecord, WorkflowStore } from './store';

export type GateStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN' | 'UNVERIFIED';
export type GateId = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6' | 'G7' | 'G8';

export interface GateCheck {
  id: string;
  status: 'pass' | 'fail' | 'warn' | 'info';
  detail: string;
}

export interface GateResult {
  contract: 'gate-result';
  contract_version: string;
  gate: GateId;
  name: string;
  status: GateStatus;
  reason: string;
  evaluated_at: string;
  evaluator: 'implemented' | 'fail_closed';
  baseline: { run_id: string; manifest_sha256: string };
  inputs: Array<{ kind: string; ref: string; sha256: string | null }>;
  checks: GateCheck[];
  limitations: string[];
}

export interface GateSpec {
  id: GateId;
  name: string;
  prerequisite: GateId | null;
  evaluator: 'implemented' | 'fail_closed';
  required_receipts: AgentId[];
  human_approval: boolean;
  pending_until: string;
}

export const GATES: GateSpec[] = [
  { id: 'G0', name: 'Baseline integrity', prerequisite: null, evaluator: 'implemented', required_receipts: [], human_approval: false, pending_until: 'available' },
  { id: 'G1', name: 'Evidence verification', prerequisite: 'G0', evaluator: 'implemented', required_receipts: [], human_approval: false, pending_until: 'available' },
  { id: 'G2', name: 'Approved requirements', prerequisite: 'G1', evaluator: 'implemented', required_receipts: ['F1', 'F2'], human_approval: true, pending_until: 'available (signed human approval required)' },
  { id: 'G3', name: 'Approved architecture', prerequisite: 'G2', evaluator: 'implemented', required_receipts: ['F3'], human_approval: true, pending_until: 'available (signed architecture approval required)' },
  { id: 'G4', name: 'Approved development stories', prerequisite: 'G3', evaluator: 'implemented', required_receipts: ['F4'], human_approval: true, pending_until: 'available (signed story-set approval required)' },
  { id: 'G5', name: 'Java build and tests', prerequisite: 'G4', evaluator: 'fail_closed', required_receipts: ['F5'], human_approval: false, pending_until: 'runtime-executed Maven build (later step)' },
  { id: 'G6', name: 'Independent behavioural/equivalence verification', prerequisite: 'G5', evaluator: 'fail_closed', required_receipts: ['F6'], human_approval: false, pending_until: 'executed equivalence evidence (later step)' },
  { id: 'G7', name: 'Independent review', prerequisite: 'G6', evaluator: 'fail_closed', required_receipts: ['F7'], human_approval: false, pending_until: 'review contracts (later step)' },
  { id: 'G8', name: 'Human acceptance', prerequisite: 'G7', evaluator: 'fail_closed', required_receipts: [], human_approval: true, pending_until: 'human acceptance recording (later step)' },
];

export function gateSpec(id: string): GateSpec | undefined {
  return GATES.find((g) => g.id === id.toUpperCase());
}

export interface RunHandle {
  ctx: RuntimeContext;
  runId: string;
  runDir: string;
  manifestPath: string;
  manifest: any;
  manifestSha256: string;
}

export function openRun(ctx: RuntimeContext, runIdOrLatest: string): RunHandle {
  let runId = runIdOrLatest;
  if (runId === 'latest') {
    const latest = path.join(ctx.runsDir, 'LATEST');
    if (!fs.existsSync(latest)) throw new Error(`no plan run found in ${ctx.runsDir}; run 'plan --all' first`);
    runId = fs.readFileSync(latest, 'utf8').trim();
  }
  if (!/^[A-Za-z0-9._-]+$/.test(runId)) throw new Error(`invalid run id: ${runId}`);
  const runDir = path.join(ctx.runsDir, runId);
  const manifestPath = path.join(runDir, 'baseline_manifest.json');
  const r = readJson(manifestPath);
  if (!r.ok) throw new Error(`run ${runId} has no readable baseline manifest: ${r.error}`);
  return { ctx, runId, runDir, manifestPath, manifest: r.data, manifestSha256: r.sha256 };
}

const result = (spec: GateSpec, run: RunHandle, at: string, status: GateStatus, reason: string, extra: Partial<GateResult> = {}): GateResult => ({
  contract: 'gate-result',
  contract_version: '1.0',
  gate: spec.id,
  name: spec.name,
  status,
  reason,
  evaluated_at: at,
  evaluator: spec.evaluator,
  baseline: { run_id: run.runId, manifest_sha256: run.manifestSha256 },
  inputs: [{ kind: 'baseline_manifest', ref: path.relative(run.ctx.repoRoot, run.manifestPath).split(path.sep).join('/'), sha256: run.manifestSha256 }],
  checks: [],
  limitations: [],
  ...extra,
});

/** True when the state's latest result for `gate` is PASS and was evaluated on this baseline. */
export function gatePassed(state: WorkflowStateRecord | null, gate: string, manifestSha: string): boolean {
  const g = state?.gates[gate];
  return !!g && g.status === 'PASS' && g.baseline_sha256 === manifestSha;
}

/* ------------------------------------------------------------------ */
/* G0 baseline integrity                                               */
/* ------------------------------------------------------------------ */

export function evaluateG0(run: RunHandle, state: WorkflowStateRecord | null, at = new Date().toISOString()): GateResult {
  const spec = gateSpec('G0')!;
  const checks: GateCheck[] = [];
  const inputs: GateResult['inputs'] = [];
  const v = run.ctx.contracts.validate('output/baseline-manifest', run.manifest);
  checks.push({ id: 'manifest_contract', status: v.valid ? 'pass' : 'fail', detail: v.valid ? 'baseline manifest satisfies its contract' : v.errors.slice(0, 5).join('; ') });
  if (!v.valid) return result(spec, run, at, 'FAIL', 'baseline manifest is malformed', { checks });

  const set = loadArtifacts(run.ctx);
  const changed: string[] = [];
  for (const i of run.manifest.inputs as any[]) {
    const now = set.artifacts[i.key];
    const cur = now?.present ? now.sha256 : null;
    inputs.push({ kind: `reverse:${i.key}`, ref: i.path, sha256: cur });
    if (i.required && (!i.present || !i.valid)) checks.push({ id: `input_${i.key}`, status: 'fail', detail: `required input ${i.path} was missing or invalid when the baseline was recorded` });
    if ((i.sha256 ?? null) !== cur) changed.push(`${i.path} (baseline ${String(i.sha256).slice(0, 12)}…, now ${String(cur).slice(0, 12)}…)`);
  }
  for (const k of ['logic', 'raw_structure'] as const) {
    const base = run.manifest.per_program_files?.[k]?.sha256;
    const cur = set.perProgramHashes[k].sha256;
    inputs.push({ kind: `per_program:${k}`, ref: `${set.perProgramHashes[k].count} files`, sha256: cur });
    if (base !== cur) changed.push(`per-program ${k} files`);
  }
  checks.push({ id: 'input_hashes', status: changed.length ? 'fail' : 'pass', detail: changed.length ? `stale baseline: ${changed.join('; ')}` : `${run.manifest.inputs.length} inputs and per-program file sets match the recorded SHA-256 values` });

  const git = gitInfo(run.ctx.repoRoot, PROTECTED_PREFIXES);
  if (git.available) {
    const rev = git.reverse_paths_changed ?? [];
    checks.push({ id: 'reverse_harness_unchanged', status: rev.length ? 'fail' : 'pass', detail: rev.length ? `local changes under reverse-harness paths: ${rev.slice(0, 10).join(', ')}` : 'no local changes under reverse/, .claude/agents, .claude/skills or output/' });
    const recorded = run.manifest.repository?.git?.commit ?? null;
    checks.push({ id: 'git_commit', status: recorded && recorded !== git.commit ? 'warn' : 'pass', detail: recorded === git.commit ? `HEAD ${git.commit} matches the baseline` : `HEAD is ${git.commit}; baseline recorded ${recorded} (artifact hashes are authoritative)` });
  } else {
    checks.push({ id: 'git', status: 'warn', detail: `git unavailable: ${git.error}` });
  }
  if (state && state.baseline.manifest_sha256 !== run.manifestSha256) {
    checks.push({ id: 'workflow_binding', status: 'fail', detail: 'the baseline manifest was replaced after this workflow was created' });
  }
  const limitations = ['Neo4j was not queried: permanent IDs are checked against the recorded artifacts only.'];
  const failed = checks.filter((c) => c.status === 'fail');
  return result(spec, run, at, failed.length ? 'FAIL' : 'PASS', failed.length ? failed.map((c) => c.detail).join(' | ') : 'baseline inputs are present, valid and unchanged', { checks, inputs: [...result(spec, run, at, 'PASS', '').inputs, ...inputs], limitations });
}

/* ------------------------------------------------------------------ */
/* G1 evidence verification                                            */
/* ------------------------------------------------------------------ */

export function evaluateG1(run: RunHandle, state: WorkflowStateRecord | null, at = new Date().toISOString()): GateResult {
  const spec = gateSpec('G1')!;
  if (!gatePassed(state, 'G0', run.manifestSha256)) return result(spec, run, at, 'BLOCKED', 'G0 has not passed on the current baseline');
  const checks: GateCheck[] = [];
  const inputs: GateResult['inputs'] = [];
  const ctx = run.ctx;
  const set = loadArtifacts(ctx);
  const val = runValidation(ctx, set);
  const errs = val.findings.filter((f) => f.severity === 'error');
  checks.push({ id: 'reverse_validation', status: errs.length ? 'fail' : 'pass', detail: errs.length ? `${errs.length} error(s): ${errs.slice(0, 3).map((e) => e.message).join(' | ')}` : 'reverse artifacts satisfy contracts and cross-references' });

  const readRun = (name: string, contract: string) => {
    const f = path.join(run.runDir, name);
    const r = readJson(f);
    inputs.push({ kind: `plan:${name}`, ref: name, sha256: r.ok ? r.sha256 : null });
    if (!r.ok) {
      checks.push({ id: `report_${name}`, status: 'fail', detail: `${name}: ${r.error}` });
      return null;
    }
    const v = ctx.contracts.validate(contract, r.data);
    checks.push({ id: `report_${name}`, status: v.valid ? 'pass' : 'fail', detail: v.valid ? `${name} satisfies ${contract}` : v.errors.slice(0, 3).join('; ') });
    return v.valid ? (r.data as any) : null;
  };
  const inv = readRun('program_inventory.json', 'output/program-inventory');
  const rules = readRun('rule_summary.json', 'output/rule-summary');
  const gaps = readRun('gap_summary.json', 'output/gap-summary');
  readRun('decision_backlog.json', 'output/decision-backlog');
  readRun('readiness_report.json', 'output/readiness-report');

  // Discovery must still match what the plan recorded.
  const sys = discoverSystem(set);
  if (inv) {
    const planned = new Set((inv.programs as any[]).map((p) => p.source_ids.file_id));
    const discovered = new Set(sys.programs.map((p) => p.file_id));
    const missing = [...planned].filter((f) => !discovered.has(f));
    checks.push({ id: 'discovery_consistent', status: missing.length ? 'fail' : 'pass', detail: missing.length ? `planned programs no longer discovered: ${missing.join(', ')}` : `${planned.size} planned program(s) still discovered` });
  }

  // Permanent IDs in the plan outputs must exist in the reverse inputs.
  const inputIds = new Set<string>();
  const add = (v: unknown) => {
    for (const s of collectPermanentIds(v).values()) for (const id of s) inputIds.add(id);
  };
  for (const a of Object.values(set.artifacts)) if (a.format === 'json' && a.data) add(a.data);
  for (const f of set.logicFiles) if (f.data) add(f.data);
  let packetsOk = 0;
  const packetProblems: string[] = [];
  if (inv) {
    for (const p of inv.programs as any[]) {
      const f = path.join(run.runDir, p.evidence_packet);
      const r = readJson(f);
      if (!r.ok) {
        packetProblems.push(`${p.evidence_packet}: ${r.error}`);
        continue;
      }
      const v = ctx.contracts.validate('output/evidence-packet', r.data);
      if (!v.valid) {
        packetProblems.push(`${p.evidence_packet}: ${v.errors[0]}`);
        continue;
      }
      const pkt = r.data as any;
      if (pkt.program.source_ids.file_id !== p.source_ids.file_id) packetProblems.push(`${p.evidence_packet}: File ID mismatch`);
      const foreign: string[] = [];
      for (const s of collectPermanentIds(pkt).values()) for (const id of s) if (!inputIds.has(id)) foreign.push(id);
      if (foreign.length) packetProblems.push(`${p.evidence_packet}: ${foreign.length} permanent ID(s) not present in the reverse inputs (${foreign.slice(0, 3).join(', ')})`);
      else packetsOk++;
    }
    checks.push({ id: 'evidence_packets', status: packetProblems.length ? 'fail' : 'pass', detail: packetProblems.length ? packetProblems.slice(0, 5).join(' | ') : `${packetsOk} evidence packet(s) valid; every permanent ID traces to a reverse input` });
  }

  // Run-local IDs must be bound to the exact current reverse run.
  const runs = run.manifest.source_runs ?? {};
  const currentKeys = new Set(Object.values(set.artifacts).filter((a) => a.parsed && a.format === 'json').map((a) => sourceRunKey(a)));
  const refProblems: string[] = [];
  const checkRef = (ref: any, where: string) => {
    if (!ref || ref.scope !== 'run-local') refProblems.push(`${where}: reference is not scoped run-local`);
    else if (!runs[ref.source_run]) refProblems.push(`${where}: source run ${ref.source_run} not in the manifest`);
    else if (!currentKeys.has(ref.source_run)) refProblems.push(`${where}: source run ${ref.source_run} no longer matches the current artifact`);
  };
  if (rules) for (const r of rules.rules as any[]) checkRef(r.ref, r.ref?.id);
  if (gaps) for (const g of gaps.gaps as any[]) checkRef(g.ref, g.ref?.id);
  checks.push({ id: 'run_local_ids', status: refProblems.length ? 'fail' : 'pass', detail: refProblems.length ? refProblems.slice(0, 5).join(' | ') : 'all BR-/GAP- references are bound to the current reverse run' });

  // Rule and grouped-gap preservation.
  const regRules = (set.artifacts.rules?.data?.business_rules ?? []) as any[];
  const regGaps = (set.artifacts.gaps?.data?.gaps ?? []) as any[];
  if (rules) {
    const same = rules.rules.length === regRules.length && regRules.every((r: any) => rules.rules.some((x: any) => x.ref.id === r.rule_id && x.confidence === r.confidence && x.requires_sme_review === (r.requires_sme_review === true)));
    checks.push({ id: 'rules_preserved', status: same ? 'pass' : 'fail', detail: same ? `${regRules.length} rule(s) preserved with confidence and SME flags (none treated as approved)` : 'rule summary does not match the rules artifact' });
  }
  if (gaps) {
    const affected = regGaps.reduce((n: number, g: any) => n + (Array.isArray(g.affected) ? g.affected.length : 0), 0);
    const ids = new Set((gaps.gaps as any[]).map((g) => g.ref.id));
    const same = gaps.gaps.length === regGaps.length && regGaps.every((g: any) => ids.has(g.gap_id)) && gaps.expanded_items.length === affected;
    checks.push({ id: 'grouped_gaps_preserved', status: same ? 'pass' : 'fail', detail: same ? `${regGaps.length} gap(s) and ${affected} affected item(s) preserved; expansion is not resolution` : 'gap summary does not match the gaps register' });
  }

  const limitations = [
    'Verification is artifact-level: statements are not re-verified against original COBOL source by this gate.',
    'Neo4j was not queried; upstream verification results are recorded, not re-executed.',
  ];
  if (!run.manifest.cobol_source?.available) limitations.push('Original COBOL source is not available for this baseline.');
  const failed = checks.filter((c) => c.status === 'fail');
  return result(spec, run, at, failed.length ? 'FAIL' : 'PASS', failed.length ? failed.map((c) => `${c.id}: ${c.detail}`).join(' | ') : 'evidence packets, summaries and references verified against the reverse artifacts', {
    checks,
    inputs: [...result(spec, run, at, 'PASS', '').inputs, ...inputs],
    limitations,
  });
}

/* ------------------------------------------------------------------ */
/* Approvals and fail-closed gates G2-G8                               */
/* ------------------------------------------------------------------ */

export interface ApprovalRecord {
  contract: 'approval-record';
  gate: GateId;
  decision: 'approved' | 'rejected';
  actor: { kind: 'human' | 'agent' | 'runtime'; id: string };
  recorded_by: 'runtime';
  recorded_at: string;
  bound_receipts: Array<{ receipt_id: string; sha256: string }>;
}

/** Validates an approval record. Approvals asserted by an agent are always rejected. */
export function validateApproval(rec: any, gate: GateId, store: WorkflowStore): string[] {
  const problems: string[] = [];
  if (!rec || rec.contract !== 'approval-record') return ['not an approval record'];
  if (rec.gate !== gate) problems.push(`approval is for ${rec.gate}, not ${gate}`);
  if (rec.actor?.kind !== 'human') problems.push(`approvals must come from a human, not '${rec.actor?.kind}'`);
  if (rec.recorded_by !== 'runtime') problems.push('approval was not recorded by the runtime');
  if (rec.decision !== 'approved') problems.push(`decision is '${rec.decision}'`);
  for (const b of rec.bound_receipts ?? []) {
    const f = store.p('receipts', `${b.receipt_id}.json`);
    if (sha256File(f) !== b.sha256) problems.push(`bound receipt ${b.receipt_id} is missing or changed`);
  }
  if (!(rec.bound_receipts ?? []).length) problems.push('approval is not bound to any receipt');
  return problems;
}

export function evaluateFailClosed(gate: GateId, run: RunHandle, state: WorkflowStateRecord | null, store: WorkflowStore | null, at = new Date().toISOString()): GateResult {
  const spec = gateSpec(gate)!;
  if (spec.prerequisite && !gatePassed(state, spec.prerequisite, run.manifestSha256)) {
    return result(spec, run, at, 'BLOCKED', `prerequisite ${spec.prerequisite} has not passed on the current baseline`);
  }
  const checks: GateCheck[] = [];
  const inputs = result(spec, run, at, 'NOT_RUN', '').inputs;
  const accepted = store ? store.list('receipts').map((f) => store.readRecord('receipts', f)).filter((r: any) => r.verdict?.accepted && r.receipt?.outcome === 'completed') : [];
  for (const a of spec.required_receipts) {
    const r = accepted.filter((x: any) => x.receipt.agent === a);
    checks.push({ id: `receipt_${a}`, status: r.length ? 'info' : 'fail', detail: r.length ? `${r.length} accepted completed receipt(s) from ${a}` : `no accepted completed receipt from ${a}` });
    for (const x of r) inputs.push({ kind: `receipt:${a}`, ref: x.receipt_id, sha256: store ? sha256File(store.p('receipts', `${x.receipt_id}.json`)) : null });
  }
  const missing = checks.filter((c) => c.status === 'fail');
  if (missing.length) return result(spec, run, at, 'NOT_RUN', `nothing to evaluate: ${missing.map((c) => c.detail).join('; ')}`, { checks, inputs });
  if (spec.human_approval) {
    const approvals = store ? store.list('approvals').map((f) => store.readRecord('approvals', f)).filter((r: any) => r?.gate === gate) : [];
    const valid = approvals.filter((r) => store && validateApproval(r, gate, store).length === 0);
    checks.push({ id: 'human_approval', status: valid.length ? 'info' : 'fail', detail: valid.length ? `${valid.length} runtime-recorded human approval(s)` : approvals.length ? `approval record(s) rejected: ${approvals.map((r) => validateApproval(r, gate, store!).join(', ')).join(' | ')}` : 'no human approval recorded' });
  }
  checks.push({ id: 'content_evaluator', status: 'fail', detail: `content verification for ${gate} is not implemented yet (${spec.pending_until})` });
  return result(spec, run, at, 'UNVERIFIED', `${gate} cannot be verified yet: ${spec.pending_until}; fail-closed`, { checks, inputs, limitations: ['A gate that has not been fully evaluated never reports PASS.'] });
}

export function evaluateGate(gate: GateId, run: RunHandle, state: WorkflowStateRecord | null, store: WorkflowStore | null, at?: string): GateResult {
  if (gate === 'G0') return evaluateG0(run, state, at);
  if (gate === 'G1') return evaluateG1(run, state, at);
  return evaluateFailClosed(gate, run, state, store, at);
}
