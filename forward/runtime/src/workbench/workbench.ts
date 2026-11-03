/**
 * Human decision workbench (STEP 5.5): everything an authorized human needs
 * to verify evidence, resolve decisions and approve ONE scope, computed from
 * the current canonical records. It prepares; it never resolves, approves,
 * authorizes, corrects or sends anything.
 */
import * as fs from 'fs';
import * as path from 'path';
import { G2_CHECK_SETS } from '../approval/approvals';
import { requiredRoles, resolutionTemplate } from '../approval/decisions';
import { evaluateScope, parseSelector, ScopeEvaluation } from '../approval/scope';
import { sha256File } from '../core/fsutil';
import { sourceRunKey } from '../core/model';
import { Analysis } from '../blockers/pipeline';
import { classify } from '../blockers/queue';
import { analyseCitation, SourceReader } from '../blockers/deterministic';
import { locations } from '../blockers/openai';
import { latestStep45 } from '../blockers/records';
import { ITEM_KINDS } from '../blockers/audit';
import { RootCause } from '../blockers/rootcauses';
import { excerpt } from '../../../verification/src/facts';
import { authorizationStates, authorizationTemplate } from '../openai/authorization';
import { costUsd, loadOpenAIConfig } from '../openai/config';
import { eligibility, LIVE_NOT_AUTHORIZED, listRuns, loadPacketSet, select } from '../openai/engine';
import { INSTRUCTIONS_A, INSTRUCTIONS_B, passAData, wrapData } from '../openai/prompts';
import { apiKeyPresent } from '../openai/config';
import { blockingRootKeys, Candidate } from './candidates';

const CLASS_TEXT: Record<string, string> = {
  A: 'technical fact verifiable from source',
  B: 'interpretation needing independent review',
  C: 'business decision for a business SME',
  D: 'architecture / technical decision for a technical authority',
  E: 'missing source or runtime dependency',
  Z: 'approval prerequisite',
};

export const OUTCOME_EFFECT: Record<string, string> = {
  resolved_no_change: 'The drafted item stands; the decision stops blocking. Any missing source evidence on the item still has to be established separately.',
  resolved_requires_update: 'The affected item stays blocked until its content changes (new content hash, e.g. an authorized correction or re-delivery); it is then re-evaluated.',
  excluded_from_scope: 'The affected requirement(s) (or, for a scope decision, the unit) leave the scope with the written justification. A unit another unit in scope depends on cannot be hidden this way.',
  approved_exception: 'Items that only lack evidence are accepted as they are by an exception approver. Never available for contradicted items.',
};

function rootsOf(a: Analysis, ev: ScopeEvaluation): RootCause[] {
  const ids = new Set<string>();
  for (const f of ev.findings.filter((x) => x.blocking)) for (const k of blockingRootKeys(a, f)) ids.add(k);
  return [...ids].map((k) => a.reg.byKey.get(k)!).filter(Boolean).sort((x, y) => (x.root_cause_id < y.root_cause_id ? -1 : 1));
}

/* ------------------------------------------------------------------ */
/* scoped evidence package                                             */
/* ------------------------------------------------------------------ */

export function evidencePackage(a: Analysis, scope: string): any {
  const snap = a.snap;
  const ev = evaluateScope(snap, parseSelector(scope));
  const reader = new SourceReader(snap);
  const res = new Map<string, any>(a.det.results.map((r: any) => [r.root_cause_id, r]));
  const rulesRun = snap.set.artifacts.rules ? sourceRunKey(snap.set.artifacts.rules) : null;
  const gapsRun = snap.set.artifacts.gaps ? sourceRunKey(snap.set.artifacts.gaps) : null;
  const items = ev.findings.filter((f) => ITEM_KINDS.includes(f.kind)).map((f) => ({ f, it: snap.itemById.get(f.id)! })).filter((x) => x.it);
  const cite = (ref: any) => {
    const s = reader.byFileId(ref.file_id);
    const st = ref.statement_id ? snap.ctx.statements.get(ref.statement_id) : null;
    const from = st?.start_line ?? ref.line ?? null;
    const to = st?.end_line ?? st?.start_line ?? ref.line ?? null;
    return { ...ref, source_path: s?.rel ?? snap.ctx.relByFile.get(ref.file_id) ?? null, source_sha256: s?.sha256 ?? null, excerpt: s && from ? excerpt(s.file, from, to ?? from) : [], statement_lines: st ? [st.start_line, st.end_line ?? st.start_line] : null };
  };
  const roots = rootsOf(a, ev);
  const classes = new Map(roots.map((r) => [r.root_cause_id, classify(r, res.get(r.root_cause_id)).class]));
  const decisions = [...new Set(ev.findings.filter((f) => f.blocking).flatMap((f) => f.decisions))].map((id) => snap.register.get(id)).filter((d) => d && d.blocking && snap.resolutions.get(d.decision_id)?.status !== 'resolved');
  const authorities = new Set<string>(snap.policy.roles.requirements_approval);
  for (const d of decisions) for (const o of d!.allowed_outcomes) requiredRoles(snap, d!.kind, o).forEach((r) => authorities.add(r));
  // Other scopes that share a unit or a decision with this one (change impact).
  const unitIds = new Set(ev.units.map((u) => u.file_id));
  const sharedWith = snap.sys.programs.filter((p) => !ev.units.some((u) => u.name === p.program_id)).filter((p) => {
    const o = evaluateScope(snap, { kind: 'programs', programs: [p.program_id] });
    return o.units.some((u) => unitIds.has(u.file_id));
  }).map((p) => p.program_id);
  return {
    contract: 'scope-evidence-package',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    status: 'PREPARED_FOR_HUMAN_REVIEW (not approved)',
    manifest: { scope: ev.selector_text, selector: ev.selector, scope_sha256: ev.scope_sha256, readiness: ev.readiness, policy_sha256: snap.policy_sha256 },
    baseline: { run_id: snap.wf.run.runId, manifest_sha256: snap.wf.run.manifestSha256, reverse_inputs: snap.wf.state.baseline.inputs, per_program: snap.wf.state.baseline.per_program, rules_source_run: rulesRun, gaps_source_run: gapsRun },
    units: ev.units.map((u) => ({ ...u, source_path: snap.ctx.relByFile.get(u.file_id) ?? null })),
    dependency_closure: { primary: ev.units.filter((u) => u.role === 'primary').map((u) => u.name), dependencies: ev.units.filter((u) => u.role === 'dependency').map((u) => ({ name: u.name, unit_kind: u.unit_kind, file_id: u.file_id })), unresolved: ev.findings.filter((f) => f.category === 'dependency').map((f) => ({ id: f.id, blocking: f.blocking, reason: f.reasons[0] })) },
    requirements: items.filter((x) => x.f.kind === 'requirement').map(({ f, it }) => ({ requirement_id: it.id, sha256: it.sha256, title: it.data.title, statement: it.data.statement, category: it.data.category, evidence_status: it.evidence_status, source_check: it.claim, g2_outcome: f.outcome, blocking: f.blocking, reasons: f.reasons, derived_from_rules: (it.data.derived_from_rules ?? []).map((r: any) => ({ id: r.id, scope: 'run-local', source_run: r.source_run ?? rulesRun })), open_decisions: it.open_decisions, citations: it.source_refs.map(cite) })),
    business_rules: ev.findings.filter((f) => f.kind === 'rule').map((f) => ({ rule_id: f.id, scope: 'run-local', source_run: rulesRun, name: snap.rules.get(f.id)?.name ?? null, g2_outcome: f.outcome, reasons: f.reasons, dispositions: (snap.ruleEntries.get(f.id) ?? []).map((e) => ({ packet: e.packet, disposition: e.disposition, requirement_ids: e.requirement_ids })) })),
    data_contracts: items.filter((x) => x.f.kind === 'data_record').map(({ f, it }) => ({ record_id: it.id, sha256: it.sha256, record_name: it.data.record_name, fields: it.data.fields, owner: it.units[0]?.name, g2_outcome: f.outcome, reasons: f.reasons })),
    file_runtime_contracts: items.filter((x) => ['runtime_requirement', 'file_operations'].includes(x.f.kind)).map(({ f, it }) => ({ id: it.id, kind: it.kind, sha256: it.sha256, statement: it.kind === 'runtime_requirement' ? it.data.statement : `${it.data.operations} file operation(s) on ${it.data.files.join(', ')}`, evidence_status: it.evidence_status, g2_outcome: f.outcome, reasons: f.reasons, citations: it.source_refs.map(cite) })),
    evidence_defects: ev.findings.filter((f) => f.blocking && (ITEM_KINDS.includes(f.kind) || f.kind === 'rule' || f.kind === 'contradiction')).map((f) => ({ kind: f.kind, id: f.id, outcome: f.outcome, reasons: f.reasons })),
    root_causes: roots.map((r) => ({ root_cause_id: r.root_cause_id, class: classes.get(r.root_cause_id), class_meaning: CLASS_TEXT[classes.get(r.root_cause_id) ?? 'D'], title: r.title, category: r.category, deterministic: { status: res.get(r.root_cause_id)?.status ?? null, establishes: res.get(r.root_cause_id)?.establishes ?? null }, decisions_in_scope: r.related.decisions.filter((d) => decisions.some((x) => x!.decision_id === d)) })),
    blocking_decisions: decisions.map((d) => ({ decision_id: d!.decision_id, kind: d!.kind, origin: d!.origin.type, sha256: d!.sha256, question: d!.question, allowed_outcomes: d!.allowed_outcomes, primary_root_cause: a.reg.byKey.get(a.reg.decisionRoots.get(d!.decision_id)?.[0] ?? '')?.root_cause_id ?? null })),
    required_authorities: [...authorities].sort(),
    g2_readiness: { readiness: ev.readiness, blocking_findings: ev.summary.blocking, by_outcome: ev.summary.by_outcome, integrity: ev.integrity },
    change_impact: {
      scopes_sharing_units: sharedWith,
      note: 'Resolving a decision on a shared dependency, applying a correction or changing a shared data contract changes the digest of every scope containing it and invalidates any approval of those scopes. Approval of this scope is bound to its exact digest.',
      traceability: 'Requirement -> reverse rule (run-local, bound to the reverse run) -> permanent source IDs -> source lines with SHA-256, as listed per requirement.',
    },
  };
}

/* ------------------------------------------------------------------ */
/* decision review packets                                             */
/* ------------------------------------------------------------------ */

export function decisionPackets(a: Analysis, scope: string, exportDir?: string): any {
  const snap = a.snap;
  const ev = evaluateScope(snap, parseSelector(scope));
  const reader = new SourceReader(snap);
  const res = new Map<string, any>(a.det.results.map((r: any) => [r.root_cause_id, r]));
  const advisory = new Map<string, string[]>();
  for (const r of listRuns(snap.wf).filter((x) => x.kind === 'compare')) for (const x of r.results) advisory.set(x.packet, [...(advisory.get(x.packet) ?? []), `${r.verification_run_id} (${r.mode})`]);
  const blockingDecisionIds = new Set(ev.findings.filter((f) => f.blocking).flatMap((f) => f.decisions).filter((id) => snap.register.get(id)?.blocking && snap.resolutions.get(id)?.status !== 'resolved'));
  const packets = rootsOf(a, ev).map((r) => {
    const d = res.get(r.root_cause_id);
    const cls = classify(r, d).class;
    const findings = ev.findings.filter((f) => f.blocking && blockingRootKeys(a, f).includes(r.key));
    const decs = [...new Set([...r.related.decisions.filter((id) => blockingDecisionIds.has(id)), ...findings.flatMap((f) => f.decisions).filter((id) => blockingDecisionIds.has(id) && (a.reg.decisionRoots.get(id) ?? []).includes(r.key))])].sort();
    const evidence = locations(snap, r).slice(0, 6).map((l) => {
      const s = reader.byFileId(l.file_id);
      return { path: s?.rel ?? snap.ctx.relByFile.get(l.file_id) ?? null, sha256: s?.sha256 ?? null, lines: [l.from, l.to], excerpt: s ? excerpt(s.file, l.from, l.to) : [], available: !!s };
    });
    const established = ['VERIFIED_DETERMINISTICALLY', 'CONTRADICTED_BY_SOURCE', 'SOURCE_CITATION_CORRECTED', 'EXTERNAL_DEPENDENCY_MISSING'].includes(d?.status);
    const decisionsOut = decs.map((id) => {
      const x = snap.register.get(id)!;
      const t = resolutionTemplate(snap, id);
      let file: string | null = null;
      if (exportDir) {
        fs.mkdirSync(exportDir, { recursive: true });
        file = path.join(exportDir, `${id}.resolution-request.json`);
        fs.writeFileSync(file, JSON.stringify(t, null, 2) + '\n', 'utf8');
      }
      return {
        decision_id: id,
        kind: x.kind,
        origin: x.origin.type,
        question: x.question,
        options_recorded_by_agent: x.options,
        supported_outcomes: x.allowed_outcomes.map((o) => ({ outcome: o, effect: OUTCOME_EFFECT[o], authorized_roles: requiredRoles(snap, x.kind, o) })),
        decision_sha256: x.sha256,
        resolution_request: file ? path.relative(snap.wf.run.ctx.repoRoot, file).split(path.sep).join('/') : null,
        status: snap.resolutions.get(id)?.status ?? 'open',
      };
    });
    const packetId = `OAV-${r.root_cause_id.slice(3)}`;
    return {
      root_cause_id: r.root_cause_id,
      class: cls,
      class_meaning: CLASS_TEXT[cls],
      title: r.title,
      what_the_cobol_appears_to_do: d?.establishes ? `Deterministic checks establish ${d.establishes}.` : 'No deterministic statement is available.',
      deterministic_checks: (d?.checks ?? []).slice(0, 8).map((c: any) => ({ check: c.id, status: c.status, detail: c.detail })),
      source_evidence: evidence,
      why_the_issue_exists: [...new Set(findings.flatMap((f) => f.reasons))].slice(0, 6),
      objective_technical_fact: established ? { proven: true, statement: `The source establishes ${d.establishes} (${d.status}).` } : { proven: false, statement: `The source does not settle this (${d?.status ?? 'not checked'}).` },
      why_human_judgment_is_needed: cls === 'A' ? 'A technical reviewer must confirm the source fact and authorize the corresponding correction or acceptance; the runtime never applies it on its own.' : cls === 'E' ? 'The required source or runtime component is not in the checkout; someone must supply it or confirm how it is provided.' : `The source does not establish ${d?.does_not_establish ?? 'the intended behaviour'}; that needs ${CLASS_TEXT[cls]}.`,
      affected: { requirements: r.related.requirements.filter((id) => ev.findings.some((f) => f.id === id)), data_contracts: r.related.data_contracts.filter((id) => ev.findings.some((f) => f.id === id)), findings: findings.map((f) => `${f.kind}:${f.id}`) },
      decisions: decisionsOut,
      authorized_roles: r.required_authority,
      ai_advisory: advisory.has(packetId) ? { runs: advisory.get(packetId), note: 'Advisory only (mock unless a LIVE run is listed); never a decision.' } : null,
      required_remediation: r.required_remediation,
    };
  });
  return {
    contract: 'decision-review-packets',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    scope: ev.selector_text,
    scope_sha256: ev.scope_sha256,
    rule: 'Packets explain; they do not decide. A decision is resolved only by importing a signed resolution from an authorized human (workflow decisions resolve).',
    summary: { root_causes: packets.length, by_class: packets.reduce((m: Record<string, number>, p) => ((m[p.class] = (m[p.class] ?? 0) + 1), m), {}), blocking_decisions: blockingDecisionIds.size },
    packets,
  };
}

/* ------------------------------------------------------------------ */
/* citation correction review                                          */
/* ------------------------------------------------------------------ */

export function correctionReview(a: Analysis, scope: string | null): any {
  const snap = a.snap;
  const props = latestStep45(snap.wf, 'remediation-proposals');
  const reader = new SourceReader(snap);
  const inScope = scope ? new Set(evaluateScope(snap, parseSelector(scope)).findings.map((f) => f.id)) : null;
  const rows = (props?.record.proposals ?? []).filter((p: any) => !inScope || inScope.has(p.target.item_id)).map((p: any) => {
    const item = snap.itemById.get(p.target.item_id);
    const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
    checks.push({ id: 'item_unchanged', ok: !!item && item.sha256 === p.target.item_sha256, detail: item ? (item.sha256 === p.target.item_sha256 ? 'the cited item is unchanged since the proposal' : 'the item changed since the proposal') : 'item no longer exists' });
    for (const h of p.source_hashes ?? []) {
      const now = snap.ctx.srcRoot ? sha256File(path.join(snap.ctx.srcRoot, h.path)) : null;
      checks.push({ id: `source:${h.path}`, ok: now === h.sha256, detail: now === h.sha256 ? `${h.path} hash unchanged` : `${h.path} changed (${String(now).slice(0, 12)}…)` });
    }
    const again = item ? analyseCitation(snap, reader, item).find((x) => p.target.pointer.includes(`/source_refs/${x.ref_index}/`)) : null;
    checks.push({ id: 'rederived', ok: !!again?.proposed && again.proposed.value === p.proposed_value, detail: again ? `re-derived: ${again.reasons.join('; ')}` : 'could not re-derive' });
    const ref = item?.source_refs[Number(/source_refs\/(\d+)/.exec(p.target.pointer)?.[1] ?? 0)];
    const s = ref ? reader.byFileId(ref.file_id) : null;
    const line = (n: number) => (s ? excerpt(s.file, n, n)[0]?.text ?? null : null);
    const decision = p.target.item_kind === 'data_record' ? `RVW-REC-${p.target.item_id}` : `RVW-${p.target.item_id}`;
    return {
      proposal_id: p.proposal_id,
      version: p.version,
      kind: p.kind,
      item: p.target.item_id,
      document: p.target.document,
      pointer: p.target.pointer,
      original_value: p.original_value,
      proposed_value: p.proposed_value,
      original_line_text: typeof p.original_value === 'number' ? line(p.original_value) : null,
      proposed_line_text: typeof p.proposed_value === 'number' ? line(p.proposed_value) : null,
      reason: p.reason,
      claim_supported_after_correction: again?.claim_supported_after_correction ?? null,
      checks,
      verified_now: checks.every((c) => c.ok),
      authorization: {
        status: 'NOT_AUTHORIZED',
        decision,
        decision_status: snap.resolutions.get(decision)?.status ?? 'not in register',
        required_roles: snap.register.get(decision) ? requiredRoles(snap, snap.register.get(decision)!.kind, 'resolved_requires_update') : p.required_role,
        steps: [`workflow decisions template --decision ${decision} --out ${decision}.json`, `the reviewer sets outcome=resolved_requires_update and selected_option=${p.proposal_id}, signs it, then: workflow decisions resolve --file signed.json`, `workflow correct --packet ${item?.packet ?? '<packet>'} --file ${path.basename(p.target.document)} --pointer ${p.target.pointer} --kind citation_line --proposal ${p.proposal_id} --authorized-by RES-NNNN --reason "<reason>"`],
      },
      effect: 'Applying it creates a new versioned correction overlay; the original deliverable is untouched. The requirement then has a new content hash and is re-verified against the corrected citation; its review decision becomes stale and must be re-decided on the new content.',
    };
  });
  return { contract: 'correction-review', contract_version: '1.0', generated_at: snap.at.toISOString(), proposal_record: props?.id ?? null, scope, proposals: rows, summary: { proposals: rows.length, verified_now: rows.filter((r: any) => r.verified_now).length, authorized: 0 } };
}

/* ------------------------------------------------------------------ */
/* trust readiness                                                     */
/* ------------------------------------------------------------------ */

export function trustReadiness(a: Analysis, rolesNeeded: string[]): any {
  const t = a.snap.trust;
  const now = new Date();
  const coverage = rolesNeeded.map((role) => {
    const signers = [...t.signers.values()].filter((s) => s.roles.includes(role) && !s.revoked && (!s.valid_until || new Date(s.valid_until) >= now) && (!s.valid_from || new Date(s.valid_from) <= now));
    return { role, signers: signers.map((s) => s.signer_id), covered: signers.length > 0 };
  });
  const status = !t.configured ? 'TRUST_NOT_CONFIGURED' : !t.usable ? 'TRUST_INVALID' : coverage.every((c) => c.covered) ? 'TRUST_CONFIGURED' : 'TRUST_INCOMPLETE';
  return { status, configured: t.configured, usable: t.usable, origin: t.origin, file: t.file, sha256: t.sha256, problems: t.problems, roles: coverage, rule: 'The harness never generates or trusts an identity itself; signers come only from the externally provisioned trust store (public keys only).' };
}

/* ------------------------------------------------------------------ */
/* OpenAI live pilot (prepared, not sent)                              */
/* ------------------------------------------------------------------ */

export function openaiPilot(a: Analysis, scope: string, max = 3): any {
  const wf = a.snap.wf;
  const cfg = loadOpenAIConfig(wf.run.ctx).config;
  const set = loadPacketSet(wf);
  const ev = evaluateScope(a.snap, parseSelector(scope));
  const scopeRoots = new Set(rootsOf(a, ev).map((r) => r.root_cause_id));
  const settled = new Set(['VERIFIED_DETERMINISTICALLY', 'CONTRADICTED_BY_SOURCE', 'SOURCE_CITATION_CORRECTED', 'EXTERNAL_DEPENDENCY_MISSING']);
  const el = eligibility(a, set, cfg).filter((e) => scopeRoots.has(e.root_cause_id));
  const unsettled = el.filter((e) => e.eligible && !settled.has(e.deterministic_status ?? ''));
  const chosen = select(unsettled, { ...cfg, selection: { ...cfg.selection, max_packets: max } }, { max }).selected;
  const est = (s: string) => Math.ceil(s.length / 4);
  const cases = chosen.map((e) => {
    const pa = set.passA.get(e.packet_id);
    const pb = set.passB.get(e.packet_id);
    const aIn = est(INSTRUCTIONS_A + wrapData(passAData(pa)));
    const bContext = { existing_interpretations: pb.existing_interpretations, conflicting_interpretations: pb.conflicting_interpretations, deterministic_results: pb.deterministic_results, sources: passAData(pa).sources };
    const bIn = est(INSTRUCTIONS_B + JSON.stringify(bContext)) + cfg.request.max_output_tokens; // Pass B also carries Pass A's output (bounded by the output cap)
    const tokens = { pass_a_input: aIn, pass_a_output_max: cfg.request.max_output_tokens, pass_b_input_max: bIn, pass_b_output_max: cfg.request.max_output_tokens };
    const cost = (costUsd(cfg, { input_tokens: aIn + bIn, cached_input_tokens: 0, output_tokens: 2 * cfg.request.max_output_tokens }) ?? null);
    return {
      packet_id: e.packet_id,
      root_cause_id: e.root_cause_id,
      category: e.category,
      deterministic_status: e.deterministic_status,
      why_selected: 'unresolved meaning in the chosen scope; the source checks do not settle it',
      source_evidence: pa.sources.filter((s: any) => s.available).map((s: any) => ({ path: s.path, sha256: s.sha256, lines: s.lines, excerpt_lines: s.excerpt.length })),
      definitions: pa.definitions.map((d: any) => `${d.name} ${d.pic ?? ''} ${d.usage ?? ''}`.trim()),
      pass_a_question: pa.question,
      pass_b_context: { existing_interpretations: pb.existing_interpretations.map((x: any) => `${x.source}:${x.id}`), conflicting: pb.conflicting_interpretations.length, deterministic_status: pb.deterministic_results?.status ?? null },
      data_classification: pa.data_classification,
      estimated_tokens: tokens,
      estimated_cost_usd_upper_bound: cost,
      review_steps: ['run Pass A (review) and record it', 'validate every citation locally (file in scope, hash, lines, quoted text, IDs)', 'run Pass B (compare) on the verified Pass A findings', 'route the advisory record to the root-cause review queue', 'a human decides; the model output never resolves anything'],
    };
  });
  const auth = authorizationStates(wf, cfg);
  const template = cases.length ? authorizationTemplate(wf, cfg, cases.map((c) => c.packet_id), [...set.passA.values()]) : null;
  if (template) template.limits = { max_requests: cases.length * 2 * (cfg.request.max_retries + 1), max_chars_per_request: 200000, max_excerpt_lines_per_request: 400 };
  return {
    contract: 'openai-live-pilot',
    contract_version: '1.0',
    generated_at: a.snap.at.toISOString(),
    scope: ev.selector_text,
    model: cfg.model,
    pricing: cfg.pricing,
    status: LIVE_NOT_AUTHORIZED,
    blocked_by: [...(cfg.network_enabled ? [] : ['network disabled (openai_verification.network_enabled=false)']), ...(apiKeyPresent(cfg) ? [] : [`${cfg.api_key_env} not set`]), ...(auth.trust.usable ? [] : ['no trust anchor']), ...(auth.states.some((s) => s.valid) ? [] : ['no signed source-export authorization'])],
    candidates_in_scope: el.length,
    unsettled_eligible: unsettled.length,
    cases,
    total_estimate: { input_tokens_max: cases.reduce((n, c) => n + c.estimated_tokens.pass_a_input + c.estimated_tokens.pass_b_input_max, 0), output_tokens_max: cases.reduce((n, c) => n + c.estimated_tokens.pass_a_output_max + c.estimated_tokens.pass_b_output_max, 0), cost_usd_upper_bound: Math.round(cases.reduce((n, c) => n + (c.estimated_cost_usd_upper_bound ?? 0), 0) * 1e6) / 1e6 },
    authorization_request: template ? { status: 'UNSIGNED — for a real data owner to review, complete and sign outside the harness', payload: template } : null,
    note: 'Nothing was sent. Model output stays advisory even after an authorized live review.',
  };
}

/* ------------------------------------------------------------------ */
/* checklist and scope readiness                                       */
/* ------------------------------------------------------------------ */

export function scopeReadinessReport(a: Analysis, scope: string, trust: any): any {
  const ev = evaluateScope(a.snap, parseSelector(scope));
  const F = ev.findings;
  const checks = G2_CHECK_SETS.map((c) => {
    const s = c.select(F).filter((f) => f.blocking);
    return { check: c.id, blocking: s.length, items: s.map((f) => `${f.kind}:${f.id} (${f.outcome})`) };
  }).filter((c) => c.blocking > 0);
  const roots = rootsOf(a, ev);
  const decisions = [...new Set(F.filter((f) => f.blocking).flatMap((f) => f.decisions))].filter((id) => a.snap.register.get(id)?.blocking && a.snap.resolutions.get(id)?.status !== 'resolved');
  const approvals = a.snap.wf.store.list('approvals').filter((x) => x.startsWith('APR-'));
  const reasons = [
    ...(ev.readiness === 'READY' ? [] : [`scope is NOT_READY: ${ev.summary.blocking} blocking finding(s) from ${roots.length} root cause(s)`]),
    ...(trust.status === 'TRUST_CONFIGURED' ? [] : [`${trust.status}: no usable trust anchor with the required roles`]),
    ...(approvals.length ? [] : ['no signed requirements approval has been imported for this (or any) scope']),
    ...(ev.integrity.ok ? [] : ev.integrity.problems),
  ];
  return {
    contract: 'scope-g2-readiness',
    contract_version: '1.0',
    generated_at: a.snap.at.toISOString(),
    scope: ev.selector_text,
    scope_sha256: ev.scope_sha256,
    readiness: ev.readiness,
    unique_root_causes: roots.length,
    blocking_findings: ev.summary.blocking,
    blocking_decisions: decisions.sort(),
    source_evidence_issues: F.filter((f) => f.blocking && (ITEM_KINDS.includes(f.kind) || f.kind === 'contradiction' || f.kind === 'rule')).map((f) => ({ id: f.id, kind: f.kind, outcome: f.outcome, reason: f.reasons[0] })),
    failing_checks: checks,
    trust: trust.status,
    g2_can_pass: false,
    why_g2_cannot_pass: reasons,
    note: 'Evaluated with the existing G2 scope evaluator. A signed approval is valid only for this exact scope digest and baseline.',
  };
}

export function checklist(a: Analysis, pkg: any, packets: any, corrections: any, trust: any, pilot: any): any {
  const byClass = (c: string) => packets.packets.filter((p: any) => p.class === c);
  const decs = (c: string) => [...new Set(byClass(c).flatMap((p: any) => p.decisions.map((d: any) => d.decision_id)))] as string[];
  const scope = pkg.manifest.scope;
  const statusOf = (ids: string[]) => (ids.length === 0 ? 'not_applicable' : ids.every((id) => a.snap.resolutions.get(id)?.status === 'resolved') ? 'done' : 'pending');
  const neededRoles = pkg.required_authorities;
  const actions: any[] = [];
  const add = (x: any) => actions.push({ step: actions.length + 1, ...x });
  add({ actor: 'claude_code', action: 'Prepare the scope recommendation, evidence package, decision packets, correction review, pilot and this checklist', ids: [], evidence: 'current canonical records', role: 'runtime (no authority)', input: 'workflow records', output: 'sealed workbench records and reports', status: 'done', depends_on: [], verified_by: 'workbench report (sealed records in workflow/step55)' });
  add({ actor: 'key_custodian', action: 'Provision the external trust store with public keys for every role this scope needs; set REVFORGE_APPROVAL_TRUST_STORE or approval.trust_store', ids: neededRoles, evidence: 'organizational identity verification of each signer', role: 'organizational key custodian', input: 'signers\' Ed25519 public keys', output: 'trust-store JSON (public keys only)', status: trust.status === 'TRUST_CONFIGURED' ? 'done' : 'pending', depends_on: [], verified_by: 'workbench trust => TRUST_CONFIGURED' });
  add({ actor: 'data_owner', action: 'Optional pilot: review and sign the source-export authorization for the prepared cases, then the operator imports it', ids: pilot.cases.map((c: any) => c.packet_id), evidence: 'pilot authorization request (files, hashes, model, limits, expiry)', role: 'data_owner', input: 'openai-pilot-authorization-request.json', output: 'signed-source-export-authorization; verification openai authorize --file', status: pilot.cases.length ? 'pending' : 'not_applicable', depends_on: [2], verified_by: 'verification openai doctor => authorization VALID' });
  add({ actor: 'claude_code', action: 'Optional pilot: run LIVE review and compare on the authorized cases; route advisory records to the review queue', ids: pilot.cases.map((c: any) => c.packet_id), evidence: 'signed authorization, API key, network enabled by the operator', role: 'operator', input: 'authorized packets', output: 'advisory Pass A/B records (never decisions)', status: pilot.cases.length ? 'blocked' : 'not_applicable', depends_on: [3], verified_by: 'verification openai report (LIVE_EXECUTED_WITH_VERIFIED_AUTHORIZATION)' });
  add({ actor: 'technical_reviewer', action: 'Review the citation correction proposals; if correct, sign the item review decision (resolved_requires_update, selected_option = proposal) and apply the correction', ids: corrections.proposals.map((p: any) => `${p.proposal_id} (${p.authorization.decision})`), evidence: 'correction review: original vs proposed line text, hashes, re-derivation', role: corrections.proposals[0]?.authorization.required_roles?.join(' or ') ?? 'review role', input: 'decision template; correction review', output: 'signed resolution, then workflow correct --kind citation_line', status: corrections.proposals.length ? 'pending' : 'not_applicable', depends_on: [2], verified_by: 'workflow decisions list (resolved) and a new COR record' });
  add({ actor: 'technical_reviewer', action: 'Confirm the technical facts established from source (class A) and sign the corresponding review decisions', ids: decs('A'), evidence: 'decision packets class A (deterministic checks and excerpts)', role: 'technical_authority / business_sme per decision', input: 'resolution requests', output: 'signed resolutions', status: statusOf(decs('A')), depends_on: [2, 5], verified_by: 'workflow decisions resolve; workflow g2 evaluate --scope' });
  add({ actor: 'technical_authority', action: 'Decide the technical / architecture questions (class D)', ids: decs('D'), evidence: 'decision packets class D', role: 'technical_authority', input: 'resolution requests', output: 'signed resolutions', status: statusOf(decs('D')), depends_on: [2], verified_by: 'workflow decisions list --scope' });
  add({ actor: 'business_sme', action: 'Confirm, correct or exclude the interpretations that need independent review and business judgment (classes B and C), using the pilot results only as advisory input', ids: [...decs('B'), ...decs('C')], evidence: 'decision packets classes B/C; optional advisory pilot records', role: 'business_sme (exception_approver for approved_exception)', input: 'resolution requests', output: 'signed resolutions', status: statusOf([...decs('B'), ...decs('C')]), depends_on: [2, 4], verified_by: 'workflow decisions list --scope' });
  add({ actor: 'technical_reviewer', action: 'Supply or account for missing source / runtime dependencies (class E)', ids: decs('E'), evidence: 'decision packets class E', role: 'technical_authority', input: 'missing members', output: 'source added read-only and the reverse/forward steps re-run, or a signed resolution', status: byClass('E').length ? 'pending' : 'not_applicable', depends_on: [], verified_by: 'verification source deterministic' });
  add({ actor: 'claude_code', action: 'Re-evaluate the scope after the signed actions; if deliverables changed, re-run consolidation and verification first', ids: [scope], evidence: 'imported signed resolutions and corrections', role: 'runtime (no authority)', input: 'current records', output: 'scope READY or the remaining blockers', status: 'pending', depends_on: [5, 6, 7, 8, 9], verified_by: `workflow g2 evaluate --scope ${scope}` });
  add({ actor: 'operator', action: 'Export the approval request for the READY scope', ids: [scope], evidence: 'READY evaluation', role: 'operator (requester, not the approver)', input: 'READY scope', output: 'AREQ-NNNN with the exact scope digest', status: 'blocked', depends_on: [10], verified_by: `workflow approval request --scope ${scope} --requested-by <operator>` });
  add({ actor: 'requirements_approver', action: 'Review the request and sign the approval statement; the operator imports it', ids: ['AREQ (to be created)'], evidence: 'approval request, evidence package, decision outcomes', role: 'requirements_approver (not the requester)', input: 'canonical statement', output: 'signed-approval; workflow approval import', status: 'blocked', depends_on: [2, 11], verified_by: 'workflow approval import (all checks ok)' });
  add({ actor: 'claude_code', action: 'Evaluate G2 and request the transition', ids: ['G2'], evidence: 'imported approval re-verified against current content', role: 'runtime', input: 'workflow', output: 'G2 PASS for the scope; REQUIREMENTS_APPROVED', status: 'blocked', depends_on: [12], verified_by: 'workflow gate --gate G2; workflow advance --to REQUIREMENTS_APPROVED' });
  const workload = packets.packets.map((p: any) => ({ root_cause_id: p.root_cause_id, class: p.class, title: p.title, decisions: p.decisions.map((d: any) => d.decision_id), authorized_roles: p.authorized_roles }));
  return { contract: 'approval-operations-checklist', contract_version: '1.0', generated_at: a.snap.at.toISOString(), scope, actions, consolidated_human_workload: workload, summary: { actions: actions.length, pending: actions.filter((x) => x.status === 'pending').length, blocked: actions.filter((x) => x.status === 'blocked').length, done: actions.filter((x) => x.status === 'done').length, root_causes: workload.length, decisions: new Set(workload.flatMap((w: any) => w.decisions)).size } };
}

export type { Candidate };
