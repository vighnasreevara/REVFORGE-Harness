/**
 * Review-package assembly (STEP 10): everything an authorised reviewer needs
 * for one scope, regenerated from the current canonical records only.
 *
 *  - dependencyFactSheet: for a decision on shared source (e.g. a copybook),
 *    what the available COBOL demonstrates (declarations, values, inclusion
 *    and self-inclusion), which names the programs use without any
 *    declaration in the repository, which programs and scopes depend on it,
 *    and what is therefore outside the source and must be decided.
 *  - staleRequests: previously exported unsigned resolution requests whose
 *    bound decision content or item hashes no longer match (never reusable).
 *  - reviewPackage: scope manifest, digests, requirements with every evidence
 *    layer, rules, data and runtime contracts, supplements, adjudications,
 *    blocking decisions, remediation proposals, shared impacts, roles, fresh
 *    requests and the exact READY / PASS conditions.
 * It never resolves, signs, corrects or approves anything.
 */
import * as fs from 'fs';
import * as path from 'path';
import { evaluateG2Gate } from '../approval/approvals';
import { evaluateScope, parseSelector, selectorText } from '../approval/scope';
import { Snapshot } from '../approval/snapshot';
import { requiredRoles } from '../approval/decisions';
import { decisionNames } from '../approval/semantic';
import { Analysis, analyse } from '../blockers/pipeline';
import { SourceReader } from '../blockers/deterministic';
import { codeText } from '../../../verification/src/cobol-source';
import { buildSymbolIndex } from '../../../verification/src/context';
import { parseDataDivision } from '../../../verification/src/layout';
import { Workflow } from '../orchestrator/orchestrator';
import { reconcileScope } from '../bmad/reconcile';
import { checkItem } from '../context/context';
import { correctionReview } from '../workbench/workbench';
import { exportResolutionRequest, sharedImpact } from './decisions';
import { trustDoctor } from './trust';

/** Facts about a decision's shared units, from the original source; names it cannot find stay unknown. */
export function dependencyFactSheet(snap: Snapshot, decisionId: string): any {
  const d = snap.register.get(decisionId);
  if (!d) return null;
  const reader = new SourceReader(snap);
  const units = d.affected_units.map((u) => u.name);
  const words = decisionNames(d.question);
  const copybooks = snap.sys.copybooks.filter((c) => c.file_id && (units.includes(c.name) || d.question.includes(c.name)));
  const books = copybooks.map((c) => {
    const src = reader.byFileId(c.file_id!);
    if (!src) return { name: c.name, file_id: c.file_id, available: false };
    const dd = parseDataDivision({ path: src.abs, lines: [`       DATA DIVISION.`, ...src.file.lines] }, () => null);
    const idx = buildSymbolIndex(dd, src.abs);
    const self = src.file.lines.map((l, i) => ({ line: i + 1, text: codeText(l) ?? '' })).filter((x) => new RegExp(`\\b(COPY|INCLUDE)\\s+${c.name}\\b`, 'i').test(x.text));
    const includers = snap.sys.edges.filter((e: any) => e.to === c.name && (e.type === 'COPY' || e.type === 'SQL_INCLUDE')).map((e: any) => e.from);
    return {
      name: c.name,
      file_id: c.file_id,
      path: src.rel,
      sha256: src.sha256,
      available: true,
      self_inclusion: self.map((x) => ({ line: x.line, text: x.text.trim() })),
      declarations: [...idx.byName.values()].flat().map((x) => ({ kind: x.kind, name: x.name, level: x.level, line: x.line, values: x.values, parent: x.parent?.name ?? null })),
      included_by_programs: [...new Set(includers)].sort(),
    };
  });
  const declaredAnywhere = (name: string) => snap.sys.programs.some((p) => {
    const s = reader.byFileId(p.file_id);
    return !!s && buildSymbolIndex(s.dd, s.abs).byName.has(name);
  }) || books.some((b: any) => (b.declarations ?? []).some((x: any) => x.name === name));
  const usage = words.filter((w) => !units.includes(w) && !copybooks.some((c) => c.name === w)).map((w) => {
    const using = snap.sys.programs.filter((p) => {
      const s = reader.byFileId(p.file_id);
      return !!s && s.file.lines.some((l) => {
        const t = codeText(l);
        return t !== null && new RegExp(`(?<![A-Z0-9-])${w}(?![A-Z0-9-])`, 'i').test(t.replace(/'[^']*'|"[^"]*"/g, ''));
      });
    }).map((p) => p.program_id);
    return { name: w, declared_in_repository: declaredAnywhere(w), used_by_programs: using.sort() };
  }).filter((u) => u.used_by_programs.length || u.declared_in_repository);
  const scopes = sharedImpact(snap, units.length ? units : copybooks.map((c) => c.name));
  return {
    decision_id: decisionId,
    kind: d.kind,
    question: d.question,
    options_recorded: d.options,
    allowed_outcomes: d.allowed_outcomes.map((o) => ({ outcome: o, roles: requiredRoles(snap, d.kind, o) })),
    affected_units: units,
    affected_requirements: d.affected_requirements,
    copybooks: books,
    names_used_by_programs: usage,
    affected_scopes: scopes.map((s) => ({ scope: s.scope, readiness: s.readiness, blocking: s.blocking })),
    counts: { affected_units: units.length, affected_requirements: d.affected_requirements.length, affected_program_scopes: scopes.length },
    separation: {
      A_source_demonstrates: books.flatMap((b: any) => [b.available ? `${b.path} (sha256 ${String(b.sha256).slice(0, 12)}…) declares ${(b.declarations ?? []).filter((x: any) => x.level === 1).map((x: any) => x.name).join(', ') || 'no 01-level record'} with ${(b.declarations ?? []).filter((x: any) => x.values.length).length} VALUE clause(s)` : `${b.name}: source unavailable`, ...(b.self_inclusion ?? []).map((x: any) => `${b.name} line ${x.line} includes itself: "${x.text}"`), `${b.name} is included by ${(b.included_by_programs ?? []).length} program(s)`]),
      B_external_environment_may_provide: usage.filter((u) => !u.declared_in_repository).map((u) => `${u.name}: used by ${u.used_by_programs.length} program(s) but declared nowhere in the repository; a DB2 precompiler or runtime normally supplies such names, which the repository cannot confirm`),
      C_unsupported_assumptions: [`any layout, field order or value meaning of ${usage.filter((u) => !u.declared_in_repository).map((u) => u.name).join(', ') || 'undeclared names'} beyond what the repository declares`, `the target runtime (e.g. database version) that would supply ${books.map((b: any) => b.name).join(', ') || 'the shared member'} and those names`],
      D_missing_artifacts: [...books.filter((b: any) => (b.self_inclusion ?? []).length).map((b: any) => `the real ${b.name} member (the repository copy includes itself)`), ...usage.filter((u) => !u.declared_in_repository).map((u) => `a declaration of ${u.name}`)],
      E_must_be_decided: `the technical authority must choose one allowed outcome (${d.allowed_outcomes.join(', ')}); the runtime does not choose`,
    },
  };
}

/** Exported unsigned requests (JSON files with decision_sha256) that no longer match the current decision or items. */
export function staleRequests(snap: Snapshot, dirs: string[]): Array<{ file: string; decision_id: string; request_id: string | null; stale: boolean; reasons: string[] }> {
  const out: Array<{ file: string; decision_id: string; request_id: string | null; stale: boolean; reasons: string[] }> = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.json') ? [path.join(d, e.name)] : []));
    for (const f of walk(dir)) {
      let r: any;
      try {
        r = JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch {
        continue;
      }
      if (r?.contract !== 'decision-resolution' || !r.decision_id) continue;
      const d = snap.register.get(r.decision_id);
      const reasons: string[] = [];
      if (!d) reasons.push(`${r.decision_id} is no longer in the register`);
      else {
        if (d.sha256 !== r.decision_sha256) reasons.push('the decision content changed (new options, evidence or affected items)');
        for (const [id, h] of Object.entries(r.affected_item_hashes ?? {})) if (snap.itemById.get(id)?.sha256 !== h) reasons.push(`${id} content changed`);
      }
      if (r.baseline_manifest_sha256 !== snap.wf.run.manifestSha256) reasons.push('different baseline');
      if (r.expires_at && Date.parse(r.expires_at) < snap.at.getTime()) reasons.push(`expired at ${r.expires_at}`);
      if (r.supersedes !== (snap.resolutions.get(r.decision_id)?.effective?.resolution_id ?? null)) reasons.push('the effective resolution changed');
      out.push({ file: f, decision_id: r.decision_id, request_id: r.request_id ?? null, stale: reasons.length > 0, reasons });
    }
  }
  return out;
}

export function reviewPackage(wf: Workflow, scope: string, opts: { exportDir: string; staleDirs: string[]; a?: Analysis }): any {
  const a = opts.a ?? analyse(wf);
  const snap = a.snap;
  const sel = selectorText(parseSelector(scope));
  const ev = evaluateScope(snap, parseSelector(sel));
  const rec = reconcileScope(snap, sel, ev);
  const reader = new SourceReader(snap);
  const trust = trustDoctor(wf.run.ctx);
  const g2 = evaluateG2Gate(wf, snap.at);
  const finding = (id: string) => ev.findings.find((f) => f.id === id);
  const reqs = [...rec.requirements, ...rec.runtime_requirements].map((r) => {
    const it = snap.itemById.get(r.id)!;
    const c = checkItem(snap, reader, it);
    const sups = [...snap.contextSupplements.values()].filter((s) => s.record.item_id === r.id).map((s) => ({ id: s.record.supplement_id, version: s.record.version, status: s.record.result.status, eligible: s.record.acceptance.eligible, current: s.current, problems: s.problems }));
    const adjs = [...snap.evidenceAdjudications.values()].filter((x) => x.record.item_id === r.id).map((x) => ({ id: x.record.adjudication_id, version: x.record.version, classification: x.record.result.classification, superseding_status: x.record.result.superseding_status, current: x.current }));
    const accepted = snap.resolutions.get(`RVW-${r.id}`)?.status === 'resolved' && /^ESU-/.test(String(snap.resolutions.get(`RVW-${r.id}`)?.effective?.resolution?.selected_option ?? ''));
    return {
      id: r.id,
      kind: r.kind,
      statement: it.data.statement ?? null,
      sha256: it.sha256,
      g2_outcome: finding(r.id)?.outcome ?? null,
      blocking: finding(r.id)?.blocking ?? false,
      g2_reasons: finding(r.id)?.reasons ?? [],
      layers: {
        source_evidence_found: c.additional_references.length > 0 || c.literal_support.some((l) => l.support === 'in_statement'),
        deterministically_verified: c.status === 'CONTEXT_SUPPORTED',
        accepted_by_authorised_reviewer: accepted,
        human_decision_resolved: snap.resolutions.get(`RVW-${r.id}`)?.status === 'resolved',
      },
      earlier_claim_check: it.claim?.result ?? null,
      context_status: c.status,
      inspect: c.refs.filter((x: any) => x.statement_range).map((x: any) => ({ file: x.path, lines: x.statement_range, cited_line: x.cited_line, cited_line_inside_statement: x.cited_line_inside_statement })),
      chains: c.additional_references.map((x) => ({ condition: x.condition, usage: x.usage, declared: `${x.declared_in}:${x.line}`, values: x.values, permanent_id: x.condition_id })),
      supplements: sups,
      adjudications: adjs,
    };
  });
  const decisions = rec.decisions.filter((d) => d.effective_blocking).map((d) => {
    const reg = snap.register.get(d.id)!;
    return { decision_id: d.id, kind: d.kind, class: d.class, question: reg.question, outcomes: reg.allowed_outcomes.map((o) => ({ outcome: o, roles: requiredRoles(snap, reg.kind, o) })), decision_sha256: reg.sha256, facts: ['technical', 'data_layout'].includes(String(reg.kind)) ? dependencyFactSheet(snap, d.id) : null };
  });
  const corrections = correctionReview(a, sel).proposals;
  const reqDir = path.join(opts.exportDir, 'resolution-requests');
  fs.mkdirSync(reqDir, { recursive: true });
  const fresh = decisions.map((d) => {
    const r = exportResolutionRequest(wf, d.decision_id, sel);
    const f = path.join(reqDir, `${d.decision_id}.request.json`);
    fs.writeFileSync(f, JSON.stringify(r, null, 2) + '\n', 'utf8');
    return { decision_id: d.decision_id, request_id: r.request_id, file: f, expires_at: r.expires_at, decision_sha256: r.decision_sha256 };
  });
  const stale = staleRequests(snap, opts.staleDirs).filter((s) => !s.file.startsWith(reqDir));
  const blocking = ev.findings.filter((f) => f.blocking).map((f) => ({ kind: f.kind, id: f.id, outcome: f.outcome, reason: f.reasons[0] }));
  return {
    contract: 'g2-review-package',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    status: 'NOT_APPROVED',
    scope: sel,
    scope_sha256: ev.scope_sha256,
    baseline_manifest_sha256: wf.run.manifestSha256,
    readiness: ev.readiness,
    units: rec.units,
    requirements: reqs,
    rules: rec.rules,
    data_and_runtime_contracts: rec.data_contracts,
    decisions_blocking: decisions,
    decisions_all: rec.decisions.map((d) => ({ id: d.id, class: d.class, blocking: d.effective_blocking, status: d.status })),
    remediation_proposals: corrections.map((p: any) => ({ proposal_id: p.proposal_id, item: p.item, pointer: p.pointer, from: p.original_value, to: p.proposed_value, original_line_text: p.original_line_text, proposed_line_text: p.proposed_line_text, verified_now: p.verified_now, decision: p.authorization.decision, roles: p.authorization.required_roles, claim_supported_after_correction: p.claim_supported_after_correction })),
    shared_impacts: decisions.filter((d) => d.facts).map((d) => ({ decision_id: d.decision_id, scopes: d.facts.affected_scopes.map((s: any) => s.scope) })),
    roles_required: [...new Set(decisions.flatMap((d) => d.outcomes.flatMap((o) => o.roles)))].sort(),
    trust: { status: trust.status, uncovered: trust.roles.filter((r) => !r.covered).map((r) => r.role) },
    fresh_requests: fresh,
    stale_requests: stale,
    blocking_findings: blocking,
    ready_conditions: blocking.map((b) => `${b.kind} ${b.id} must stop blocking (${b.outcome})`),
    pass_conditions: ['the scope is READY (no blocking finding)', 'a trust store with a usable requirements_approver', 'an approval request exported for the current scope digest', 'a signed approval by a requirements_approver who is not the requester, imported and re-verified', `G2 re-evaluated to PASS for exactly ${sel}`],
    g2: { status: g2.result.status, reason: g2.result.reason },
  };
}
