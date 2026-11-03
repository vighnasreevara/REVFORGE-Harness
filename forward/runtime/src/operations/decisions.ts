/**
 * Human decision operations (STEP 8). For every blocking decision of a scope
 * this builds a decision dossier a trusted human can act on:
 *   - the exact question, options, allowed outcomes and the roles that may
 *     sign each (with the current trust coverage);
 *   - every affected requirement with its claim, its cited source lines read
 *     now from the original COBOL (and their sha256);
 *   - an evidence analysis: which stated values the cited statements contain,
 *     where the missing ones occur in the scope's sources (including 88-level
 *     condition names and where the cited code sets them), what the source
 *     establishes and what remains for a human;
 *   - related remediation proposals, re-derived from the source now;
 *   - the prepared independent-verification packet (never sent);
 *   - the shared-dependency impact: every program scope that contains the
 *     decision's units, with its current readiness.
 * It also exports unsigned, scope- and expiry-bound resolution requests and
 * records clarification requests. Nothing here resolves, signs or applies.
 */
import * as fs from 'fs';
import * as path from 'path';
import { resolutionTemplate, requiredRoles } from '../approval/decisions';
import { evaluateScope, parseSelector, selectorText } from '../approval/scope';
import { buildSnapshot, Snapshot } from '../approval/snapshot';
import { AGENT_IDENTITY } from '../approval/trust';
import { analyse, Analysis } from '../blockers/pipeline';
import { latestStep45 } from '../blockers/records';
import { SourceReader } from '../blockers/deterministic';
import { excerpt } from '../../../verification/src/facts';
import { claimLiterals } from '../remediation/remediation';
import { digest } from '../approval/canonical';
import { sha256File } from '../core/fsutil';
import { mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { reconcileScope } from '../bmad/reconcile';
import { correctionReview, decisionPackets } from '../workbench/workbench';
import { trustDoctor } from './trust';

export const OPS_DIR = 'operations';

/** Program scopes whose unit closure contains any of `units`, with their current readiness. */
export function sharedImpact(snap: Snapshot, units: string[]): Array<{ scope: string; readiness: string; blocking: number; contains: string[] }> {
  if (!units.length) return [];
  const out: Array<{ scope: string; readiness: string; blocking: number; contains: string[] }> = [];
  for (const p of snap.sys.programs) {
    let ev;
    try {
      ev = evaluateScope(snap, { kind: 'programs', programs: [p.program_id] });
    } catch {
      continue;
    }
    const contains = ev.units.map((u) => u.name).filter((n) => units.includes(n));
    if (contains.length) out.push({ scope: ev.selector_text, readiness: ev.readiness, blocking: ev.summary.blocking, contains });
  }
  return out.sort((a, b) => (a.scope < b.scope ? -1 : 1));
}

/** Where each stated value missing from the cited statements occurs in the given source files. */
function locateValues(reader: SourceReader, files: string[], values: string[], citedFileId: string | null, citedRange: [number, number] | null): any[] {
  const cited = citedFileId ? reader.byFileId(citedFileId) : null;
  return values.map((v) => {
    const occurrences: any[] = [];
    for (const fid of files) {
      const src = reader.byFileId(fid);
      if (!src) continue;
      src.file.lines.forEach((text: string, i: number) => {
        if (!new RegExp(`['"]${v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'i').test(text) || /^.{6}[*/]/.test(text)) return;
        const cond = /^\s*\d*\s*88\s+([A-Z0-9-]+)\s+VALUES?\b/i.exec(text.slice(6))?.[1] ?? null;
        let used: any[] = [];
        if (cond && cited) {
          used = cited.file.lines
            .map((t: string, j: number) => ({ line: j + 1, text: t.trimEnd() }))
            .filter((x: any) => new RegExp(`\\b${cond}\\b`, 'i').test(x.text) && !/^.{6}[*/]/.test(x.text))
            .map((x: any) => ({ ...x, inside_cited_statement: !!citedRange && x.line >= citedRange[0] && x.line <= citedRange[1] }));
        }
        occurrences.push({ path: src.rel, sha256: src.sha256, line: i + 1, text: text.trimEnd(), condition_name: cond, condition_used_in_cited_file: used });
      });
    }
    const viaCondition = occurrences.find((o) => o.condition_used_in_cited_file.some((u: any) => u.inside_cited_statement));
    return {
      value: v,
      occurrences,
      finding: viaCondition
        ? `'${v}' is the VALUE of condition ${viaCondition.condition_name} (${viaCondition.path}:${viaCondition.line}); the cited statement sets or tests that condition at line(s) ${viaCondition.condition_used_in_cited_file.filter((u: any) => u.inside_cited_statement).map((u: any) => u.line).join(', ')}. The value is reachable from the cited code through the condition name, but the citation does not name the defining line.`
        : occurrences.length
          ? `'${v}' occurs in the scope sources (${occurrences.map((o) => `${o.path}:${o.line}`).join(', ')}) but not inside the cited statement.`
          : `'${v}' does not occur in any scope source file: it cannot be established from the source.`,
    };
  });
}

function requirementEvidence(snap: Snapshot, reader: SourceReader, id: string, scopeFiles: string[], det: any[]): any {
  const it = snap.itemById.get(id);
  if (!it) return { id, missing: true };
  const refs = it.source_refs.map((r: any) => {
    const st = r?.statement_id ? snap.ctx.statements.get(r.statement_id) : null;
    const src = r?.file_id ? reader.byFileId(r.file_id) : null;
    const from = st?.start_line ?? r?.line ?? null;
    const to = st ? st.end_line ?? st.start_line : from;
    return { ref: r, path: src?.rel ?? null, sha256: src?.sha256 ?? null, statement_range: (st ? [st.start_line, st.end_line ?? st.start_line] : null) as [number, number] | null, cited_line: r?.line ?? null, cited_line_inside_statement: st && typeof r?.line === 'number' ? r.line >= st.start_line && r.line <= (st.end_line ?? st.start_line) : null, lines: src && from ? excerpt(src.file, from, Math.min(to ?? from, from + 40)) : [] };
  });
  const checks = det.flatMap((d: any) => d.checks ?? []).filter((c: any) => c.subject === id);
  const statedCheck = checks.find((c: any) => c.id === 'stated_values');
  const missing = statedCheck ? (/missing: (.+)$/.exec(statedCheck.detail)?.[1] ?? '').split(/,\s*/).filter(Boolean) : [];
  const primaryRef = refs.find((r: any) => r.statement_range) ?? refs[0];
  return {
    id,
    kind: it.kind,
    sha256: it.sha256,
    evidence_status_declared: it.evidence_status,
    claim: it.data.statement ?? null,
    title: it.data.title ?? null,
    stated_values: claimLiterals(`${it.data.title ?? ''} ${it.data.statement ?? ''}`),
    cited_sources: refs,
    deterministic_checks: checks,
    missing_values: missing.length ? locateValues(reader, scopeFiles, missing, primaryRef?.ref?.file_id ?? null, (primaryRef?.statement_range as [number, number] | null) ?? null) : [],
  };
}

export interface DossierSet {
  contract: 'decision-dossiers';
  contract_version: '1.0';
  generated_at: string;
  scope: string;
  scope_sha256: string;
  baseline_manifest_sha256: string;
  trust_status: string;
  dossiers: any[];
  summary: Record<string, number>;
}

/** Dossiers for the blocking (or, with `all`, every) unresolved decision of `scope`. */
export function decisionDossiers(wf: Workflow, scope: string, opts: { all?: boolean; a?: Analysis } = {}): DossierSet {
  const a = opts.a ?? analyse(wf);
  const snap = a.snap;
  const sel = selectorText(parseSelector(scope));
  const ev = evaluateScope(snap, parseSelector(sel));
  const rec = reconcileScope(snap, sel, ev);
  const reader = new SourceReader(snap);
  const packets = decisionPackets(a, sel);
  const corrections = correctionReview(a, sel);
  const queue = latestStep45(wf, 'openai-verification-queue')?.record.packets ?? [];
  const trust = trustDoctor(wf.run.ctx);
  const scopeFiles = rec.units.map((u) => u.file_id);
  const chosen = rec.decisions.filter((d) => (opts.all ? d.status !== 'resolved' : d.effective_blocking));
  const dossiers = chosen.map((rd) => {
    const d = snap.register.get(rd.id)!;
    const roots = (a.reg.decisionRoots.get(rd.id) ?? []).map((k) => a.reg.byKey.get(k)).filter(Boolean) as any[];
    const rootIds = new Set(roots.map((r) => r.root_cause_id));
    const det = a.det.results.filter((r: any) => rootIds.has(r.root_cause_id));
    const myPackets = packets.packets.filter((p: any) => p.decisions.some((x: any) => x.decision_id === rd.id));
    const reqs = d.affected_requirements.filter((r) => ev.findings.some((f) => f.id === r) || snap.itemById.get(r)?.units.some((u) => rec.units.some((x) => x.name === u.name)));
    const itemIds = new Set([...reqs, ...(d.origin.type === 'derived' && d.origin.item ? [d.origin.item.id] : [])]);
    const outcomes = d.allowed_outcomes.map((o) => {
      const roles = requiredRoles(snap, d.kind, o);
      return { outcome: o, roles, signers_available: trust.roles.filter((r) => roles.includes(r.role)).flatMap((r) => r.signers) };
    });
    const evidence = [...itemIds].map((id) => requirementEvidence(snap, reader, id, scopeFiles, det));
    const sourceHashes = [...new Map(evidence.flatMap((e: any) => (e.cited_sources ?? []).filter((s: any) => s.path).map((s: any) => [s.path, s.sha256]))).entries()].map(([p, h]) => ({ path: p, sha256: h }));
    const establishes = det.map((r: any) => ({ root_cause_id: r.root_cause_id, status: r.status, establishes: r.establishes, does_not_establish: r.does_not_establish, next_step: r.next_step }));
    const needsHuman = d.kind === 'review' || d.kind === 'business' || d.kind === 'scope' || det.some((r: any) => !/VERIFIED|CORRECTED/.test(r.status)) || outcomes.length > 1;
    return {
      decision_id: rd.id,
      kind: d.kind,
      origin: d.origin.type,
      blocking: d.blocking,
      status: rd.status,
      inclusion: { class: rd.class, reason: rd.reason },
      question: d.question,
      options_recorded: d.options,
      blocking_rationale: d.blocking_rationale,
      allowed_outcomes: outcomes,
      decision_sha256: d.sha256,
      affected: { requirements: d.affected_requirements, requirements_in_scope: reqs, units: d.affected_units.map((u) => u.name), source_ids: d.source_refs.length },
      root_causes: roots.map((r) => ({ root_cause_id: r.root_cause_id, title: r.title })),
      source_evidence: myPackets.flatMap((p: any) => p.source_evidence),
      evidence_analysis: { requirements: evidence, deterministic: establishes, objective_facts: myPackets.map((p: any) => p.objective_technical_fact) },
      remediation: corrections.proposals.filter((p: any) => itemIds.has(p.item) || p.authorization.decision === rd.id),
      independent_review: queue.filter((q: any) => rootIds.has(q.root_cause_id)).map((q: any) => ({ packet_id: q.packet_id, status: q.status, sources: q.sources, source_lines: q.source_lines, note: 'prepared, never sent; sending needs a signed OpenAI source-export authorization and an explicit LIVE run' })),
      shared_impact: sharedImpact(snap, d.affected_units.map((u) => u.name)),
      source_hashes: sourceHashes,
      human_judgment: { required: needsHuman, why: needsHuman ? 'the source establishes facts, not the business or technical choice this decision asks for; only a signer with an authorised role can choose an outcome' : 'a technical reviewer must still confirm the source fact before any correction is applied' },
    };
  });
  return {
    contract: 'decision-dossiers',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    scope: sel,
    scope_sha256: ev.scope_sha256,
    baseline_manifest_sha256: wf.run.manifestSha256,
    trust_status: trust.status,
    dossiers,
    summary: { decisions: dossiers.length, with_remediation: dossiers.filter((d) => d.remediation.length).length, cross_scope: dossiers.filter((d) => d.shared_impact.length > 1).length },
  };
}

/** Unsigned resolution request bound to the decision, its scope, the baseline, the item hashes and an expiry. */
export function exportResolutionRequest(wf: Workflow, decisionId: string, scope: string, ttlHours?: number): any {
  const snap = buildSnapshot(wf);
  if (!snap.register.has(decisionId)) throw new OrchestratorError(`unknown decision ${decisionId}`, 'UNKNOWN_DECISION');
  const ev = evaluateScope(snap, parseSelector(scope));
  if (!ev.findings.some((f) => f.decisions.includes(decisionId) || f.id === decisionId)) throw new OrchestratorError(`${decisionId} is not part of scope ${ev.selector_text}`, 'USAGE');
  return resolutionTemplate(snap, decisionId, { scope: ev.selector_text, ttlHours });
}

/** Records a clarification request (it does not resolve or change the decision). */
export function requestClarification(wf: Workflow, decisionId: string, requestedBy: string, addressedTo: string, question: string): any {
  return mutate(wf, `clarify ${decisionId}`, () => {
    if (!requestedBy || AGENT_IDENTITY.test(requestedBy)) throw new OrchestratorError(`clarification requests must name a human requester; '${requestedBy}' is not acceptable`, 'USAGE');
    if (String(question ?? '').trim().length < 10) throw new OrchestratorError('the clarification question must state at least 10 characters', 'USAGE');
    const snap = buildSnapshot(wf);
    const d = snap.register.get(decisionId);
    if (!d) throw new OrchestratorError(`unknown decision ${decisionId}`, 'UNKNOWN_DECISION');
    const n = wf.store.list(`${OPS_DIR}/clarifications`).length + 1;
    const id = `CLR-${String(n).padStart(4, '0')}`;
    const rec = { record_id: id, contract: 'clarification-request', contract_version: '1.0', decision_id: decisionId, decision_sha256: d.sha256, baseline_manifest_sha256: wf.run.manifestSha256, requested_by: requestedBy, addressed_to: addressedTo, question, requested_at: new Date().toISOString(), effect: 'none: the decision stays open until a signed resolution is imported' };
    const f = wf.store.writeRecord(`${OPS_DIR}/clarifications`, `${id}.json`, rec);
    wf.store.append('clarification_requested', { record: `${OPS_DIR}/clarifications/${id}.json`, decision_id: decisionId, requested_by: requestedBy, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return rec;
  });
}

/** Seals an operations record (dossiers, readiness, reviews) and returns its ID. Called under the workflow lock. */
export function sealOps(wf: Workflow, kind: string, data: any): { id: string; sha256: string } {
  const n = wf.store.list(OPS_DIR).filter((f) => f.startsWith(`${kind}-`)).length + 1;
  const id = `${kind}-${String(n).padStart(4, '0')}`;
  const f = wf.store.writeRecord(OPS_DIR, `${id}.json`, { record_id: id, content_sha256: digest(data), ...data });
  const sha = sha256File(f)!;
  wf.store.append('operations_record_written', { record: `${OPS_DIR}/${id}.json`, kind, sha256: sha });
  return { id, sha256: sha };
}

export function writeExport(dir: string, name: string, data: any): string {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name);
  fs.writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', 'utf8');
  return f;
}
