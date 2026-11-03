/**
 * Canonical decision register and controlled decision resolution.
 *
 * The register holds (1) every decision raised by an accepted F1/F2
 * delivery, (2) the cross-batch decisions of the current consolidation
 * record and (3) decisions the runtime derives from the evidence: a review
 * decision for every item that is not independently verified, a scope
 * decision for every program whose classification needs one, and a review
 * decision for every gap no decision or requirement addresses.
 *
 * A decision is resolved only by a signed resolution from an authorised human
 * (Ed25519, verified against the external trust store). Resolutions bind to
 * the decision's exact content hash, the baseline and the affected items'
 * hashes; they are never edited or deleted: a change is a new resolution that
 * explicitly supersedes the previous one. Claude Code never answers a
 * decision: the runtime only verifies and records what a human signed.
 */
import * as fs from 'fs';
import * as path from 'path';
import { sha256File } from '../core/fsutil';
import { Unit } from '../orchestrator/extracts';
import { mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { canonicalize, digest } from './canonical';
import { DecisionKind } from './policy';
import type { Snapshot } from './snapshot';
import { AGENT_IDENTITY, scopeAllowed, verifySignature } from './trust';
import { evaluateScope, parseSelector, selectorText } from './scope';

export type ResolutionOutcome = 'resolved_no_change' | 'resolved_requires_update' | 'excluded_from_scope' | 'approved_exception';

export interface RegDecision {
  decision_id: string;
  kind: DecisionKind;
  question: string;
  options: string[];
  blocking: boolean;
  blocking_rationale: string;
  affected_requirements: string[];
  affected_units: Unit[];
  gap_ids: string[];
  rule_ids: string[];
  source_refs: any[];
  evidence: Array<{ kind: string; ref: string; sha256?: string | null; detail?: string }>;
  origin: { type: 'agent'; packet: string; receipt: string; file: string } | { type: 'consolidation'; record: string } | { type: 'derived'; reason: string; item?: { kind: string; id: string; sha256: string } };
  allowed_outcomes: ResolutionOutcome[];
  sha256: string;
}

export interface ResolutionState {
  status: 'resolved' | 'open' | 'stale' | 'untrusted';
  effective: any | null;
  outcome: ResolutionOutcome | null;
  history: string[];
  problems: string[];
}

const KINDS: DecisionKind[] = ['business', 'technical', 'scope', 'data_layout', 'runtime_semantics', 'review'];
const PERMANENT = /^SYS-[A-Z0-9]{2,20}-\d{3}-(FIL|PATH)-\d{4}(-[A-Z]{3,4}-\d{4,6})?$/;
const now = () => new Date().toISOString();

export function requiredRoles(snap: Snapshot, kind: DecisionKind, outcome: ResolutionOutcome): string[] {
  if (outcome === 'approved_exception') return snap.policy.roles.exception;
  return snap.policy.roles.decision[kind] ?? snap.policy.roles.decision.business;
}

function sourceIds(refs: any[]): string[] {
  const out = new Set<string>();
  for (const r of refs ?? []) for (const v of Object.values(r ?? {})) if (typeof v === 'string' && PERMANENT.test(v)) out.add(v);
  return [...out].sort();
}

function unitsForFiles(snap: Snapshot, fileIds: string[]): Unit[] {
  const out: Unit[] = [];
  for (const id of fileIds) {
    const p = snap.sys.programs.find((x) => x.file_id === id);
    if (p) out.push({ unit_kind: 'program', name: p.program_id, file_id: p.file_id });
    const c = snap.sys.copybooks.find((x) => x.file_id === id);
    if (c && c.file_id) out.push({ unit_kind: 'copybook', name: c.name, file_id: c.file_id });
  }
  return out;
}

function finish(d: Omit<RegDecision, 'sha256'>): RegDecision {
  const { origin, ...content } = d;
  const bind = origin.type === 'derived' ? { ...content, item: origin.item ?? null } : content;
  return { ...d, sha256: digest(bind) };
}

export function buildRegister(snap: Snapshot): Map<string, RegDecision> {
  const reg = new Map<string, RegDecision>();
  const put = (d: RegDecision) => {
    if (reg.has(d.decision_id)) snap.problems.push(`duplicate decision ID ${d.decision_id} (${JSON.stringify(d.origin)}); the first occurrence is used`);
    else reg.set(d.decision_id, d);
  };
  const base: Omit<RegDecision, 'decision_id' | 'kind' | 'question' | 'origin' | 'allowed_outcomes' | 'sha256'> = { options: [], blocking: true, blocking_rationale: '', affected_requirements: [], affected_units: [], gap_ids: [], rule_ids: [], source_refs: [], evidence: [] };
  const smeException = snap.policy.g2.allow_exceptions_for.includes('REQUIRES_SME_DECISION');

  // 1. Decisions raised by accepted deliveries.
  for (const { d, packet, receipt, file, sha } of snap.agentDecisions) {
    const allowed: ResolutionOutcome[] = ['resolved_no_change', 'excluded_from_scope'];
    if ((d.affected_requirements ?? []).length) allowed.push('resolved_requires_update');
    if (smeException) allowed.push('approved_exception');
    put(finish({
      ...base,
      decision_id: d.decision_request_id,
      kind: KINDS.includes(d.kind) ? d.kind : 'business',
      question: d.question,
      options: d.options ?? [],
      blocking: d.blocking === true,
      blocking_rationale: d.blocking_rationale,
      affected_requirements: [...(d.affected_requirements ?? [])].sort(),
      affected_units: d.affected_units ?? [],
      gap_ids: (d.gap_refs ?? []).map((g: any) => g.gap.id),
      rule_ids: (d.rule_refs ?? []).map((r: any) => r.id),
      source_refs: d.source_refs ?? [],
      evidence: [{ kind: 'deliverable', ref: file, sha256: sha }, ...(d.gap_refs ?? []).map((g: any) => ({ kind: 'gap', ref: g.gap.id, detail: `items ${g.items.join(', ')}` })), ...(d.rule_refs ?? []).map((r: any) => ({ kind: 'reverse_rule', ref: r.id }))],
      origin: { type: 'agent', packet, receipt, file },
      allowed_outcomes: allowed,
    }));
  }

  // 2. Cross-batch decisions from the consolidation record.
  for (const d of snap.consolidation.decisions) {
    const ruleIds: string[] = (d.rule_refs ?? []).map((r: any) => (typeof r === 'string' ? r : r.id));
    const conflict = snap.consolidation.conflicts.find((c: any) => ruleIds.includes(c.rule_id));
    const reqs = [...new Set<string>((conflict?.dispositions ?? []).flatMap((e: any) => e.requirement_ids ?? []))].sort();
    const programs = Object.entries(snap.rulesByProgram).filter(([, ids]) => ruleIds.some((r) => ids.includes(r))).map(([p]) => p);
    const units: Unit[] = snap.sys.programs.filter((p) => programs.includes(p.program_id)).map((p) => ({ unit_kind: 'program', name: p.program_id, file_id: p.file_id }));
    const cbName = ruleIds.map((r) => snap.rules.get(r)?.primary_source?.copybook).find(Boolean);
    const cb = cbName ? snap.sys.copybooks.find((c) => c.name === cbName && c.file_id) : null;
    if (cb) units.push({ unit_kind: 'copybook', name: cb.name, file_id: cb.file_id! });
    const allowed: ResolutionOutcome[] = ['resolved_no_change', 'excluded_from_scope'];
    if (reqs.length) allowed.push('resolved_requires_update');
    put(finish({
      ...base,
      decision_id: d.decision_request_id,
      kind: 'business',
      question: d.question,
      options: (conflict?.dispositions ?? []).map((e: any) => `${e.disposition} (as ${e.packet})`),
      blocking: d.blocking !== false,
      blocking_rationale: d.blocking_rationale ?? 'cross-batch disagreement',
      affected_requirements: reqs,
      affected_units: units,
      rule_ids: ruleIds,
      evidence: [{ kind: 'consolidation', ref: snap.consolidation.record ?? '' }, ...(conflict?.dispositions ?? []).map((e: any) => ({ kind: 'disposition', ref: `${e.packet}:${e.disposition}`, detail: e.reason }))],
      origin: { type: 'consolidation', record: snap.consolidation.record ?? '' },
      allowed_outcomes: allowed,
    }));
  }

  // 3a. Review decisions for items that are not independently verified.
  for (const it of snap.items) {
    const open = it.components.filter((c) => c.outcome !== 'VERIFIED');
    if (!open.length) continue;
    const allowed: ResolutionOutcome[] = ['excluded_from_scope', 'resolved_requires_update'];
    if (open.some((c) => c.outcome === 'REQUIRES_SME_DECISION')) allowed.unshift('resolved_no_change');
    if (open.some((c) => (snap.policy.g2.allow_exceptions_for as string[]).includes(c.outcome))) allowed.push('approved_exception');
    // STEP 9: a current, eligible dependency-verified evidence supplement can be accepted (signed resolved_no_change selecting it).
    const esus = [...(snap.contextSupplements?.values() ?? [])].filter((e) => e.current && e.record.item_id === it.id && e.record.item_sha256 === it.sha256 && e.record.acceptance.eligible);
    if (esus.length && open.some((c) => c.outcome === 'REQUIRES_EVIDENCE' && c.source === 'evidence') && !allowed.includes('resolved_no_change')) allowed.unshift('resolved_no_change');
    const key = it.kind === 'data_record' ? `REC-${it.id}` : it.id;
    put(finish({
      ...base,
      decision_id: `RVW-${key}`,
      kind: 'review',
      question: `${it.kind} ${it.id} (${it.units.map((u) => u.name).join(', ')}) is not approvable as drafted: ${[...new Set(open.map((c) => `${c.outcome}: ${c.reason}`))].join(' | ')}`,
      options: allowed.map((o) => o),
      blocking: open.some((c) => c.outcome !== 'APPROVED_EXCEPTION'),
      blocking_rationale: 'the item cannot be approved until its evidence is verified, it is excluded with justification, or (where policy permits) an exception is signed',
      affected_requirements: it.kind === 'requirement' ? [it.id] : [],
      affected_units: it.units,
      source_refs: it.source_refs,
      evidence: [{ kind: it.kind, ref: it.id, sha256: it.sha256, detail: it.document }, ...(it.claim ? [{ kind: 'source_check', ref: it.claim.result, detail: it.claim.reasons.join('; ') }] : []), ...esus.map((e) => ({ kind: 'evidence_supplement', ref: e.record.supplement_id, sha256: e.record.result.result_sha256, detail: `${e.record.result.status} v${e.record.version}: accept with resolved_no_change selecting ${e.record.supplement_id}` }))],
      origin: { type: 'derived', reason: 'item not independently verified or flagged for review', item: { kind: it.kind, id: it.id, sha256: it.sha256 } },
      allowed_outcomes: allowed,
    }));
  }

  // 3b. Scope decisions for programs whose classification needs one.
  for (const c of snap.classification.filter((x) => x.modernization_scope !== 'candidate')) {
    put(finish({
      ...base,
      decision_id: `SCOPE-${c.program_id.toUpperCase().replace(/[^A-Z0-9-]/g, '-')}`,
      kind: 'scope',
      question: `${c.program_id} is classified ${c.class} (${c.confidence}): ${c.scope_reason}. Keep it in the modernisation scope (resolved_no_change) or exclude it (excluded_from_scope)?`,
      options: ['resolved_no_change', 'excluded_from_scope'],
      blocking_rationale: 'classification never authorises modernisation; a human must decide the scope',
      affected_units: [{ unit_kind: 'program', name: c.program_id, file_id: c.file_id }],
      source_refs: [{ file_id: c.file_id }],
      evidence: (c.signals ?? []).map((s) => ({ kind: 'classification_signal', ref: s.source, detail: `${s.value} -> ${s.implies}` })),
      origin: { type: 'derived', reason: 'program classification requires a scope decision', item: { kind: 'classification', id: c.program_id, sha256: digest(c) } },
      allowed_outcomes: ['resolved_no_change', 'excluded_from_scope'],
    }));
  }

  // 3c. Review decisions for gaps no decision or requirement addresses.
  for (const g of snap.gaps) {
    const id = g.ref?.id;
    if (!id || snap.addressedGaps.has(id)) continue;
    put(finish({
      ...base,
      decision_id: `RVW-${id}`,
      kind: 'review',
      question: `${id} (${g.severity}, ${g.gap_type}) is not addressed by any decision or requirement: ${g.title}. Acknowledge it as a known limitation (resolved_no_change) or exclude the affected units?`,
      blocking: snap.policy.g2.blocking_gap_severities.includes(g.severity),
      blocking_rationale: `gap severity ${g.severity}`,
      affected_units: unitsForFiles(snap, g.file_ids ?? []),
      gap_ids: [id],
      source_refs: (g.file_ids ?? []).map((f: string) => ({ file_id: f })),
      evidence: [{ kind: 'gap', ref: id, detail: `${g.item_count} item(s); programs ${(g.programs ?? []).join(', ') || 'none (system-level)'}` }],
      origin: { type: 'derived', reason: 'gap not addressed by any decision or requirement', item: { kind: 'gap', id, sha256: digest(g) } },
      allowed_outcomes: ['resolved_no_change', 'excluded_from_scope'],
    }));
  }
  return reg;
}

/* ------------------------------------------------------------------ */
/* resolution records                                                  */
/* ------------------------------------------------------------------ */

export function resolutionRecords(wf: Workflow): any[] {
  return wf.store.list('decisions').filter((f) => f.startsWith('RES-')).map((f) => wf.store.readRecord('decisions', f));
}

/** Current state of every decision: the latest non-superseded resolution, re-verified now. */
export function resolutionStates(snap: Snapshot): Map<string, ResolutionState> {
  const recs = resolutionRecords(snap.wf);
  const sealed = new Map<string, string>();
  for (const e of snap.wf.store.readAudit()) if (e.event === 'decision_resolved') sealed.set((e.data as any).resolution_id, (e.data as any).sha256);
  const out = new Map<string, ResolutionState>();
  for (const [id, d] of snap.register) {
    const mine = recs.filter((r) => r.resolution.decision_id === id).sort((a, b) => (a.resolution_id < b.resolution_id ? -1 : 1));
    const superseded = new Set(mine.map((r) => r.resolution.supersedes).filter(Boolean));
    const eff = [...mine].reverse().find((r) => !superseded.has(r.resolution_id)) ?? null;
    const st: ResolutionState = { status: 'open', effective: null, outcome: null, history: mine.map((r) => r.resolution_id), problems: [] };
    if (eff) {
      const p: string[] = [];
      const file = snap.wf.store.p('decisions', `${eff.resolution_id}.json`);
      if (sealed.get(eff.resolution_id) !== sha256File(file)) p.push(`${eff.resolution_id} does not match the hash sealed in the audit log`);
      const sig = verifySignature(snap.trust, eff.resolution.signer_id, canonicalize(eff.resolution), eff.signature?.value, requiredRoles(snap, d.kind, eff.resolution.outcome), snap.at);
      if (!sig.ok) p.push(...sig.problems.map((x) => `${eff.resolution_id}: ${x}`));
      const untrusted = p.length > 0;
      if (eff.resolution.decision_sha256 !== d.sha256) p.push(`${eff.resolution_id} resolved a different version of ${id} (the decision content changed since)`);
      if (eff.resolution.baseline_manifest_sha256 !== snap.wf.run.manifestSha256) p.push(`${eff.resolution_id} was made on a different baseline`);
      if (!d.allowed_outcomes.includes(eff.resolution.outcome)) p.push(`${eff.resolution_id}: outcome ${eff.resolution.outcome} is no longer allowed for ${id}`);
      st.effective = eff;
      st.outcome = eff.resolution.outcome;
      st.problems = p;
      st.status = !p.length ? 'resolved' : untrusted ? 'untrusted' : 'stale';
    }
    out.set(id, st);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* template, verification and recording                                */
/* ------------------------------------------------------------------ */

/** Optional request bindings (STEP 8): the scope the resolution is requested for and an expiry. */
export interface TemplateOptions {
  scope?: string;
  ttlHours?: number;
}

export function resolutionTemplate(snap: Snapshot, decisionId: string, opts: TemplateOptions = {}): any {
  const d = snap.register.get(decisionId);
  if (!d) throw new OrchestratorError(`unknown decision ${decisionId}`, 'UNKNOWN_DECISION');
  const st = snap.resolutions.get(decisionId)!;
  const hashes: Record<string, string> = {};
  for (const r of d.affected_requirements) {
    const it = snap.itemById.get(r);
    hashes[r] = it ? it.sha256 : 'MISSING';
  }
  if (d.origin.type === 'derived' && d.origin.item) hashes[d.origin.item.id] = d.origin.item.sha256;
  const base = {
    contract: 'decision-resolution',
    contract_version: '1.0',
    decision_id: d.decision_id,
    decision_sha256: d.sha256,
    decision_kind: d.kind,
    workflow_id: snap.wf.state.workflow_id,
    run_id: snap.wf.run.runId,
    baseline_manifest_sha256: snap.wf.run.manifestSha256,
    affected_requirements: d.affected_requirements,
    affected_item_hashes: hashes,
    affected_source_ids: sourceIds(d.source_refs),
    affected_units: d.affected_units.map((u) => u.name).sort(),
    original_problem: d.question,
    available_evidence: d.evidence,
    allowed_outcomes: d.allowed_outcomes,
    required_roles_by_outcome: Object.fromEntries(d.allowed_outcomes.map((o) => [o, requiredRoles(snap, d.kind, o)])),
    impacted_artifacts: [...new Set([...(d.origin.type === 'agent' ? [d.origin.file] : []), ...d.affected_requirements.map((r) => snap.itemById.get(r)?.document).filter(Boolean)])] as string[],
    outcome: null,
    selected_option: null,
    resolution_text: '',
    justification: '',
    signer_id: '',
    role: '',
    resolved_at: '',
    supersedes: st.effective?.resolution_id ?? null,
  };
  if (!opts.scope && opts.ttlHours === undefined) return base;
  const scope = opts.scope ? selectorText(parseSelector(opts.scope)) : undefined;
  const expires_at = new Date(snap.at.getTime() + (opts.ttlHours ?? snap.policy.request_ttl_hours) * 3600000).toISOString();
  const bound = { ...base, ...(scope ? { scope } : {}), expires_at };
  return { ...bound, request_id: requestIdOf(bound) };
}

/** Deterministic ID of an exported resolution request: its binding fields, hashed. */
export function requestIdOf(r: any): string {
  return `DRQ-${digest({ decision_id: r.decision_id, decision_sha256: r.decision_sha256, baseline: r.baseline_manifest_sha256, hashes: r.affected_item_hashes, scope: r.scope ?? null, expires_at: r.expires_at ?? null }).slice(0, 12)}`;
}

const sameSet = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

export function verifyResolution(snap: Snapshot, signed: any): { ok: boolean; checks: Array<{ id: string; ok: boolean; detail: string }>; decision: RegDecision | null } {
  const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const v = snap.wf.run.ctx.contracts.validate('orchestrator/signed-decision-resolution', signed);
  add('contract', v.valid, v.valid ? 'signed resolution satisfies its contract' : v.errors.slice(0, 5).join('; '));
  if (!v.valid) return { ok: false, checks, decision: null };
  const r = signed.resolution;
  const d = snap.register.get(r.decision_id) ?? null;
  add('decision_exists', !!d, d ? `${r.decision_id} is in the canonical register` : `${r.decision_id} is not in the canonical register`);
  if (!d) return { ok: false, checks, decision: null };
  const tpl = resolutionTemplate(snap, d.decision_id);
  add('decision_binding', r.decision_sha256 === d.sha256 && r.decision_kind === d.kind, r.decision_sha256 === d.sha256 ? 'bound to the current decision content' : 'decision content changed since the template was made (stale)');
  add('baseline_binding', r.baseline_manifest_sha256 === snap.wf.run.manifestSha256 && r.run_id === snap.wf.run.runId && r.workflow_id === snap.wf.state.workflow_id && snap.g0.status === 'PASS', r.baseline_manifest_sha256 === snap.wf.run.manifestSha256 ? `baseline intact (G0 ${snap.g0.status})` : 'resolution is bound to a different baseline');
  const scopeOk = sameSet(r.affected_requirements, tpl.affected_requirements) && sameSet(r.affected_source_ids, tpl.affected_source_ids) && canonicalize(r.affected_item_hashes) === canonicalize(tpl.affected_item_hashes) && r.original_problem === tpl.original_problem;
  add('affected_content', scopeOk, scopeOk ? `bound to ${tpl.affected_requirements.length} requirement(s), ${tpl.affected_source_ids.length} source ID(s) and the exact item hashes` : 'affected requirements, source IDs, item hashes or the original problem differ from the register');
  add('outcome_allowed', d.allowed_outcomes.includes(r.outcome), d.allowed_outcomes.includes(r.outcome) ? `outcome ${r.outcome} is allowed` : `outcome ${r.outcome} is not allowed for ${d.decision_id} (allowed: ${d.allowed_outcomes.join(', ')})`);
  const roles = requiredRoles(snap, d.kind, r.outcome);
  add('role_claimed', roles.includes(r.role), roles.includes(r.role) ? `claimed role ${r.role} is authorised` : `role ${r.role} is not one of ${roles.join(', ')}`);
  add('not_agent', !AGENT_IDENTITY.test(r.signer_id), AGENT_IDENTITY.test(r.signer_id) ? `${r.signer_id} is an agent or automated identity` : 'signer is not an agent identity');
  const sig = verifySignature(snap.trust, r.signer_id, canonicalize(r), signed.signature.value, roles, snap.at);
  add('signature', sig.ok && (!sig.signer || sig.signer.roles.includes(r.role)), sig.ok ? `Ed25519 signature by ${r.signer_id} verified (key ${sig.signer!.fingerprint.slice(0, 16)}…)` : sig.problems.join('; '));
  const t = Date.parse(r.resolved_at);
  const skew = snap.policy.max_clock_skew_minutes * 60000;
  add('timestamp', Number.isFinite(t) && t <= snap.at.getTime() + skew, Number.isFinite(t) ? (t <= snap.at.getTime() + skew ? 'resolved_at is not in the future' : 'resolved_at is in the future') : 'resolved_at is not a timestamp');
  const st = snap.resolutions.get(d.decision_id)!;
  const expect = st.effective?.resolution_id ?? null;
  add('supersession', (r.supersedes ?? null) === expect, (r.supersedes ?? null) === expect ? (expect ? `explicitly supersedes ${expect}` : 'first resolution of this decision') : expect ? `${d.decision_id} already has resolution ${expect}; a new resolution must name it in supersedes` : `supersedes ${r.supersedes}, but ${d.decision_id} has no effective resolution`);
  const replay = resolutionRecords(snap.wf).some((x) => x.signature?.value === signed.signature.value);
  add('not_replayed', !replay, replay ? 'this signed resolution was already recorded (replay)' : 'not previously recorded');
  add('content', String(r.resolution_text ?? '').trim().length >= 10 && String(r.justification ?? '').trim().length >= 10, 'resolution_text and justification must each state at least 10 characters');
  // STEP 8 request bindings (optional fields; checked whenever present).
  if (r.scope !== undefined) {
    let inScope = false;
    let why = '';
    try {
      const ev = evaluateScope(snap, parseSelector(r.scope));
      inScope = ev.findings.some((f) => f.decisions.includes(d.decision_id) || f.id === d.decision_id);
      why = inScope ? `${d.decision_id} belongs to scope ${ev.selector_text}` : `${d.decision_id} is not part of scope ${ev.selector_text}`;
    } catch (e) {
      why = `scope ${r.scope} cannot be evaluated: ${(e as Error).message}`;
    }
    add('scope_binding', inScope, why);
  }
  add('signer_scope', scopeAllowed(sig.signer, r.scope ?? null), scopeAllowed(sig.signer, r.scope ?? null) ? (sig.signer?.scopes ? `signer is authorised for scope ${r.scope}` : 'signer has no scope restriction') : `signer ${r.signer_id} is restricted to ${sig.signer!.scopes!.join(', ')} and cannot sign ${r.scope ? `for ${r.scope}` : 'an unscoped resolution'}`);
  if (r.expires_at !== undefined) {
    const exp = Date.parse(r.expires_at);
    const ok = Number.isFinite(exp) && Date.parse(r.resolved_at) <= exp && snap.at.getTime() <= exp + skew;
    add('not_expired', ok, ok ? `request valid until ${r.expires_at}` : `resolution request expired at ${r.expires_at}`);
  }
  if (r.request_id !== undefined) add('request_binding', r.request_id === requestIdOf(r), r.request_id === requestIdOf(r) ? `bound to exported request ${r.request_id}` : `request_id ${r.request_id} does not match the bound fields (tampered or foreign request)`);
  if (typeof r.selected_option === 'string' && /^ESU-/.test(r.selected_option)) {
    const e = snap.contextSupplements.get(r.selected_option);
    const target = e && (d.affected_requirements.includes(e.record.item_id) || (d.origin.type === 'derived' && d.origin.item?.id === e.record.item_id));
    const ok = !!e && !!target && e.current && e.record.result.status === 'CONTEXT_SUPPORTED' && r.outcome === 'resolved_no_change';
    add('evidence_supplement_binding', ok, !e ? `${r.selected_option} is not a recorded evidence supplement` : !target ? `${r.selected_option} concerns ${e.record.item_id}, which ${d.decision_id} does not cover` : !e.current ? `${r.selected_option} is stale: ${e.problems.join('; ')}` : e.record.result.status !== 'CONTEXT_SUPPORTED' ? `${r.selected_option} has status ${e.record.result.status}; only CONTEXT_SUPPORTED evidence can be accepted` : r.outcome !== 'resolved_no_change' ? 'an evidence supplement is accepted only with outcome resolved_no_change' : `accepts ${r.selected_option} (v${e.record.version}) for ${e.record.item_id}`);
  }
  if (typeof r.selected_option === 'string' && /^RP-/.test(r.selected_option)) {
    const { latestStep45 } = require('../blockers/records') as typeof import('../blockers/records');
    const p = (latestStep45(snap.wf, 'remediation-proposals')?.record.proposals ?? []).find((x: any) => x.proposal_id === r.selected_option);
    const item = p ? snap.itemById.get(p.target.item_id) : undefined;
    const target = p && (d.affected_requirements.includes(p.target.item_id) || (d.origin.type === 'derived' && d.origin.item?.id === p.target.item_id));
    const srcOk = !!p && (p.source_hashes ?? []).every((h: any) => snap.ctx.srcRoot && sha256File(path.join(snap.ctx.srcRoot, h.path)) === h.sha256);
    const ok = !!p && !!target && r.outcome === 'resolved_requires_update' && item?.sha256 === p.target.item_sha256 && srcOk;
    add('remediation_binding', ok, !p ? `${r.selected_option} is not in the latest remediation proposals` : !target ? `${r.selected_option} targets ${p.target.item_id}, which ${d.decision_id} does not cover` : r.outcome !== 'resolved_requires_update' ? `a remediation proposal can only be selected with outcome resolved_requires_update` : item?.sha256 !== p.target.item_sha256 ? `${p.target.item_id} changed since ${r.selected_option} was proposed` : !srcOk ? 'source changed since the proposal was made' : `selects ${r.selected_option} for ${p.target.item_id} (item and source hashes current)`);
  }
  return { ok: checks.every((c) => c.ok), checks, decision: d };
}

export function resolveDecision(wf: Workflow, file: string, opts: { dryRun?: boolean; build: (wf: Workflow) => Snapshot }): any {
  const run = () => {
    let signed: any;
    try {
      signed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      throw new OrchestratorError(`cannot read signed resolution ${file}: ${(e as Error).message}`, 'USAGE');
    }
    const snap = opts.build(wf);
    const v = verifyResolution(snap, signed);
    if (opts.dryRun) return { recorded: false, dry_run: true, ...v, decision: v.decision?.decision_id ?? null };
    if (!v.ok) {
      wf.store.append('decision_resolution_rejected', { decision_id: signed?.resolution?.decision_id ?? null, file_sha256: sha256File(file), problems: v.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`) });
      wf.store.writeState(wf.state);
      return { recorded: false, ...v, decision: v.decision?.decision_id ?? null };
    }
    const n = wf.store.list('decisions').filter((f) => f.startsWith('RES-')).length + 1;
    const id = `RES-${String(n).padStart(4, '0')}`;
    const sig = verifySignature(snap.trust, signed.resolution.signer_id, canonicalize(signed.resolution), signed.signature.value, [], snap.at);
    const rec = {
      contract: 'decision-resolution-record',
      contract_version: '1.0',
      resolution_id: id,
      recorded_at: now(),
      recorded_by: 'runtime',
      decision_id: signed.resolution.decision_id,
      resolution: signed.resolution,
      signature: signed.signature,
      signer: { signer_id: signed.resolution.signer_id, role: signed.resolution.role, key_fingerprint: sig.signer?.fingerprint ?? null, display_name: sig.signer?.display_name ?? null },
      trust_store_sha256: snap.trust.sha256,
      required_roles: requiredRoles(snap, v.decision!.kind, signed.resolution.outcome),
      verification: { status: 'signature_verified', checks: v.checks },
    };
    const cv = wf.run.ctx.contracts.validate('orchestrator/decision-resolution-record', rec);
    if (!cv.valid) throw new OrchestratorError('resolution record violates its contract', 'CONTRACT', cv.errors);
    const f = wf.store.writeRecord('decisions', `${id}.json`, rec);
    wf.store.append('decision_resolved', { resolution_id: id, decision_id: rec.decision_id, outcome: signed.resolution.outcome, signer: rec.signer.signer_id, supersedes: signed.resolution.supersedes ?? null, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { recorded: true, resolution_id: id, ...v, decision: rec.decision_id };
  };
  return opts.dryRun ? run() : mutate(wf, 'decisions resolve', run);
}
