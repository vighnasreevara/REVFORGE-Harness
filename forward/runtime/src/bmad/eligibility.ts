/**
 * BMad workflow eligibility (STEP 6). Facts are gathered from the runtime's
 * own records (workflow state, gate results on the current baseline, a fresh
 * G2 evaluation with every imported approval re-verified, receipts, the
 * verified release and the binding validation); `decide` is a pure function
 * of a binding, a mode and those facts, so every rule can be tested on its
 * own. Nothing here dispatches, approves or changes the workflow.
 */
import { parseSelector, selectorText } from '../approval/scope';
import { evaluateG2Gate, evaluateScopeText } from '../approval/approvals';
import { gatePassed } from '../orchestrator/gates';
import { acceptedReceipts, generationAuthorized, policyRoots, Workflow } from '../orchestrator/orchestrator';
import { sha256File } from '../core/fsutil';
import * as path from 'path';
import { Binding, BindingValidation } from './bindings';
import { Check, ReleaseVerification } from './release';

export type Mode = 'DISCOVERY' | 'DRY_RUN' | 'MOCK' | 'LIVE';
export const MODES: Mode[] = ['DISCOVERY', 'DRY_RUN', 'MOCK', 'LIVE'];
export const GATE_IDS = ['G2', 'G3', 'G4', 'G5', 'G6'] as const;

export interface UpstreamReceipt {
  receipt_id: string;
  binding_id: string;
  scope_sha256: string;
  mode: 'MOCK' | 'LIVE';
  accepted: boolean;
  agent: string;
  sha256: string;
  documents: Array<{ path: string; sha256: string }>;
  /** The recorded result envelope (read back from its sealed file). */
  result?: any;
}

export interface Facts {
  state: string;
  baseline: { run_id: string; manifest_sha256: string };
  gates: Record<string, boolean>;
  g2: { status: string; reason: string; scope: string | null; scope_sha256: string | null; approval_id: string | null };
  scope: { text: string; sha256: string | null; readiness: string | null; error: string | null };
  release: { ok: boolean; detail: string };
  binding: { ok: boolean; detail: string };
  java_target_dir: string | null;
  generation_authorized: boolean;
  receipts: Record<string, number>;
  upstream: UpstreamReceipt[];
}

/** Accepted, non-mock BMad receipts usable as upstream evidence for `binding` on this scope digest. */
export function liveUpstream(f: Facts, binding: string, scopeSha: string | null): UpstreamReceipt[] {
  return f.upstream.filter((u) => u.binding_id === binding && u.accepted && u.mode === 'LIVE' && u.scope_sha256 === scopeSha);
}

export function decide(b: Binding, mode: Mode, f: Facts): { eligible: boolean; checks: Check[]; reasons: string[] } {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  add('mode', mode !== 'DISCOVERY', mode === 'DISCOVERY' ? 'DISCOVERY only lists the catalogue; it never prepares a workflow' : `mode ${mode}`);
  add('release_verified', f.release.ok, f.release.detail);
  add('binding_valid', f.binding.ok, f.binding.detail);
  add('workflow_state', b.allowed_states.includes(f.state), b.allowed_states.includes(f.state) ? `workflow state ${f.state}` : `workflow state is ${f.state}; ${b.binding_id} is allowed only in ${b.allowed_states.join(', ')}`);
  for (const g of b.requires_gates) add(`gate_${g}`, !!f.gates[g], f.gates[g] ? `${g} PASS recorded on baseline ${f.baseline.manifest_sha256.slice(0, 12)}…` : `${g} has not passed on the current baseline`);
  if (b.requires_gates.includes('G2')) {
    add('g2_reverified', f.g2.status === 'PASS', f.g2.status === 'PASS' ? `G2 re-evaluated now: PASS (${f.g2.approval_id})` : `G2 re-evaluated now: ${f.g2.status} — ${f.g2.reason}`);
    const exact = f.g2.status === 'PASS' && !!f.scope.sha256 && f.g2.scope === f.scope.text && f.g2.scope_sha256 === f.scope.sha256;
    add('exact_scope', exact, f.scope.error ? `scope ${f.scope.text} cannot be evaluated: ${f.scope.error}` : exact ? `approved scope ${f.g2.scope} (digest ${String(f.g2.scope_sha256).slice(0, 16)}…) is exactly the requested scope` : `requested scope ${f.scope.text}${f.scope.sha256 ? ` (digest ${f.scope.sha256.slice(0, 16)}…)` : ''} is not the G2-approved scope (${f.g2.scope ?? 'none approved'}${f.g2.scope_sha256 ? `, digest ${f.g2.scope_sha256.slice(0, 16)}…` : ''})`);
  }
  for (const r of b.requires) {
    switch (r) {
      case 'architecture_artifacts': {
        const n = (f.receipts.F3 ?? 0) + liveUpstream(f, 'BMAD-ARCH', f.scope.sha256).length;
        add(r, n > 0, n ? `${n} recorded architecture result(s) for this scope` : 'no accepted F3 receipt or recorded BMad architecture result for this scope (mock results never count)');
        break;
      }
      case 'approved_stories': {
        const n = (f.receipts.F4 ?? 0) + liveUpstream(f, 'BMAD-EPICS', f.scope.sha256).length;
        add(r, n > 0 && !!f.gates.G4, n && f.gates.G4 ? `${n} story result(s), approved at G4` : `stories are not approved (${n} story result(s); G4 ${f.gates.G4 ? 'PASS' : 'not passed'})`);
        break;
      }
      case 'java_target_dir':
        add(r, !!f.java_target_dir, f.java_target_dir ? `authorised Java target ${f.java_target_dir}` : 'no Java target directory is authorised (orchestrator.java_target_dir is null)');
        break;
      case 'generation_authorized':
        add(r, f.generation_authorized, f.generation_authorized ? 'Java generation authorised (config flag and G4 PASS)' : 'Java generation is not authorised (generation.java_generation_allowed and G4 PASS are both required)');
        break;
      case 'implementation_artifacts': {
        const n = (f.receipts.F5 ?? 0) + liveUpstream(f, 'BMAD-BUILD', f.scope.sha256).length;
        add(r, n > 0, n ? `${n} recorded implementation result(s) with current hashes` : 'no actual implementation artefacts are recorded for this scope');
        break;
      }
      case 'independent_test_receipt':
        add(r, (f.receipts.F6 ?? 0) > 0 && !!f.gates.G6, (f.receipts.F6 ?? 0) > 0 && f.gates.G6 ? `${f.receipts.F6} accepted F6 receipt(s); G6 PASS` : 'independent F6 testing has not been recorded and passed (G6); review is not possible without it');
        break;
      case 'reviewer_not_implementer': {
        const impl = new Set(f.upstream.filter((u) => u.binding_id === 'BMAD-BUILD').map((u) => u.agent));
        if (f.receipts.F5) impl.add('F5');
        add(r, !impl.has(b.agent), impl.has(b.agent) ? `${b.agent} produced the implementation and cannot review it` : `reviewer ${b.agent} did not produce the implementation`);
        break;
      }
    }
  }
  const reasons = checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`);
  return { eligible: reasons.length === 0, checks, reasons };
}

/** Gathers facts from the workflow's own records; reads only. */
export function gatherFacts(wf: Workflow, scope: string, rel: ReleaseVerification, bv: BindingValidation | null, upstream: UpstreamReceipt[]): Facts {
  const base = { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 };
  const gates: Record<string, boolean> = {};
  for (const g of GATE_IDS) gates[g] = gatePassed(wf.state, g, wf.run.manifestSha256);
  let text = scope;
  let sha: string | null = null;
  let readiness: string | null = null;
  let error: string | null = null;
  try {
    text = selectorText(parseSelector(scope));
    const ev = evaluateScopeText(wf, text);
    text = ev.selector_text;
    sha = ev.scope_sha256;
    readiness = ev.readiness;
  } catch (e) {
    error = (e as Error).message;
  }
  const g2 = evaluateG2Gate(wf);
  const chosen = g2.evaluation?.approvals?.filter((a: any) => a.valid && a.decision === 'approved').pop() ?? null;
  const receipts: Record<string, number> = {};
  for (const r of acceptedReceipts(wf)) if (r.receipt?.outcome === 'completed') receipts[r.receipt.agent] = (receipts[r.receipt.agent] ?? 0) + 1;
  // Upstream BMad results only count while every document they recorded is unchanged.
  const current = upstream.map((u) => ({ ...u, accepted: u.accepted && u.documents.every((d) => sha256File(path.resolve(wf.run.ctx.repoRoot, d.path)) === d.sha256) }));
  const roots = policyRoots(wf.run, wf.state);
  return {
    state: String(wf.state.state),
    baseline: base,
    gates,
    g2: { status: g2.result.status, reason: g2.result.reason, scope: g2.result.status === 'PASS' ? g2.evaluation?.selector_text ?? null : null, scope_sha256: g2.result.status === 'PASS' ? g2.evaluation?.scope_sha256 ?? null : null, approval_id: chosen?.approval_id ?? null },
    scope: { text, sha256: sha, readiness, error },
    release: { ok: rel.ok, detail: rel.ok ? `${rel.package}@${rel.version} verified (${rel.checks.length} checks)` : rel.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`).join(' | ') },
    binding: { ok: !!bv?.ok, detail: !bv ? 'no such binding' : bv.ok ? `${bv.binding_id} -> ${bv.workflow_id} (${bv.agent}) valid` : bv.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`).join(' | ') },
    java_target_dir: roots.javaTargetDir,
    generation_authorized: generationAuthorized(wf.run, wf.state),
    receipts,
    upstream: current,
  };
}

/** Facts established by the executor and the sealed execution preflight (STEP 21); a missing fact counts as absent. */
export interface LiveFacts {
  installation_verified: boolean;
  /** The valid signed anthropic / claude-code-cli disclosure authorization for this scope and workflow, if any. */
  authorization_id: string | null;
  /** The sealed preflight permitted the launch (scope, G2, release, binding, authorization, isolation, limits, boundary). */
  launch_permitted: boolean;
}

/**
 * LIVE needs everything MOCK needs plus conditions no configuration flag can
 * supply on its own. Every reason is listed. Without facts from the executor
 * and the execution preflight, LIVE is always refused.
 */
export function liveGate(eligible: boolean, requested: boolean, facts?: LiveFacts): string[] {
  const reasons: string[] = [];
  if (!eligible) reasons.push('the workflow is not eligible for this scope (see eligibility checks)');
  if (!requested) reasons.push('bindings.json live_execution.requested is false');
  if (!facts?.installation_verified) reasons.push('no verified isolated BMad installation is recorded (the release is staged only; the installer was not run)');
  if (!facts?.authorization_id) reasons.push('no signed BMad execution authorization exists (no valid anthropic / claude-code-cli disclosure authorization for this scope and workflow)');
  if (!facts?.launch_permitted) reasons.push('no LIVE executor dispatch is permitted: the execution preflight for this workflow and scope did not permit a launch');
  return reasons;
}
