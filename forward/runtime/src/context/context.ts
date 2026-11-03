/**
 * Source-context verification (STEP 9). For every requirement (and runtime
 * requirement) it re-checks the cited executable statements against the
 * original COBOL with dependency awareness: data and level-88 condition names
 * the statement references are resolved (with OF/IN qualification) through
 * the COPY-expanded DATA DIVISION to their declaring file, line, parent item,
 * declared VALUE(S), inclusion chain, file hashes and permanent IDs from the
 * reverse data catalogue (whose metadata is cross-checked against the
 * source). Each claimed literal is supported only through the cited statement
 * or a condition the statement actually SETs or tests.
 *
 * Verification levels are kept apart: symbol exists, resolves
 * unambiguously, value declared, statement references it, runtime effect
 * supported. Business interpretation is never established here: it stays
 * with an authorised human. Results feed G2 only through a versioned,
 * immutable evidence supplement (ESU) that a signed review resolution must
 * explicitly select.
 */
import * as path from 'path';
import { buildSnapshot, Item, Snapshot } from '../approval/snapshot';
import { evaluateScope, parseSelector } from '../approval/scope';
import { digest } from '../approval/canonical';
import { SourceReader } from '../blockers/deterministic';
import { claimLiterals } from '../remediation/remediation';
import { sha256File } from '../core/fsutil';
import { mutate, Workflow } from '../orchestrator/orchestrator';
import { buildSymbolIndex, LiteralResult, literalSupport, logicalText, statementReferences, SymbolDef } from '../../../verification/src/context';

export const CONTEXT_DIR = 'context';
export type ContextStatus = 'CONTEXT_SUPPORTED' | 'CONTEXT_PARTIAL' | 'CONTEXT_UNSUPPORTED' | 'CONTEXT_UNRESOLVED' | 'CONTEXT_CONTRADICTED' | 'CITATION_MISMATCH' | 'SOURCE_UNAVAILABLE' | 'NOT_APPLICABLE';

export interface ContextResult {
  item_id: string;
  kind: string;
  item_sha256: string;
  claim: string;
  claimed_literals: string[];
  existing: { claim_result: string | null; reasons: string[] };
  refs: any[];
  levels: { symbol_exists: boolean; symbol_resolved: boolean; value_declared: boolean; statement_references: boolean; runtime_effect_supported: boolean; business_interpretation: 'not_established_requires_human' };
  status: ContextStatus;
  literal_support: LiteralResult[];
  additional_references: Array<{ condition: string; declared_in: string; line: number; values: string[]; parent: string | null; condition_id: string | null; parent_field_id: string | null; include_chain: any[]; usage: string }>;
  contradictions: string[];
  metadata_disagreements: string[];
  uncertainties: string[];
  source_hashes: Array<{ path: string; sha256: string | null }>;
  human_decision_needed: { needed: boolean; why: string };
  result_sha256: string;
}

function catalogue(snap: Snapshot): { conditions: any[]; fields: Map<string, any> } {
  const d: any = (snap.set.artifacts as any).data?.data ?? {};
  return { conditions: d.condition_catalogue ?? [], fields: new Map((d.field_catalogue ?? []).map((f: any) => [f.field_id, f])) };
}

/** Permanent IDs for a condition declared in `relPath` at `line`, cross-checked against the source. */
function permanentFor(snap: Snapshot, cat: ReturnType<typeof catalogue>, def: SymbolDef, srcRoot: string | null): { condition_id: string | null; parent_field_id: string | null; agrees: string[]; disagrees: string[] } {
  const rel = srcRoot ? path.relative(srcRoot, def.file).split(path.sep).join('/') : def.file;
  const fileId = [...snap.ctx.relByFile.entries()].find(([, r]) => r === rel)?.[0] ?? null;
  const c = cat.conditions.find((x) => x.condition_name === def.name && (x.condition_id ?? '').startsWith(`${fileId}-`));
  if (!c) return { condition_id: null, parent_field_id: null, agrees: [], disagrees: fileId ? [`${def.name} (${rel}:${def.line}) has no entry in the reverse condition catalogue for ${fileId}`] : [] };
  const agrees: string[] = [];
  const disagrees: string[] = [];
  (c.source_line === def.line ? agrees : disagrees).push(`line: catalogue ${c.source_line}, source ${def.line}`);
  const same = JSON.stringify([...(c.values ?? [])].map(String).sort()) === JSON.stringify([...def.values].map(String).sort());
  (same ? agrees : disagrees).push(`values: catalogue ${JSON.stringify(c.values)}, source ${JSON.stringify(def.values)}`);
  (c.parent_field === def.parent?.name ? agrees : disagrees).push(`parent: catalogue ${c.parent_field}, source ${def.parent?.name}`);
  return { condition_id: c.condition_id, parent_field_id: c.parent_field_id, agrees, disagrees: disagrees.map((x) => `${def.name}: ${x}`) };
}

/** Pairs like "SEVERE ('F')" in a claim: the label must agree with the condition that declares the value. */
function labelPairs(claim: string): Array<{ label: string; value: string }> {
  return [...claim.matchAll(/\b([A-Za-z][A-Za-z-]{2,})\s*\(\s*'([^']+)'\s*\)/g)].map((m) => ({ label: m[1].toUpperCase(), value: m[2].toUpperCase() }));
}

export function checkItem(snap: Snapshot, reader: SourceReader, it: Item): ContextResult {
  const claim = it.kind === 'requirement' ? `${it.data.title ?? ''} ${it.data.statement ?? ''}` : String(it.data.statement ?? '');
  const lits = [...new Set(claimLiterals(claim).filter((l) => !/^\d+$/.test(l)))];
  const cat = catalogue(snap);
  const refs: any[] = [];
  const support: LiteralResult[][] = [];
  const extra: ContextResult['additional_references'] = [];
  const contradictions: string[] = [];
  const disagreements: string[] = [];
  const uncertainties: string[] = [];
  const hashes = new Map<string, string | null>();
  let citationMismatch = false;
  let anyStatement = false;
  let unavailable = false;
  const lv = { symbol_exists: false, symbol_resolved: false, value_declared: false, statement_references: false, runtime_effect_supported: false, business_interpretation: 'not_established_requires_human' as const };

  it.source_refs.forEach((r: any, i: number) => {
    if (!r?.file_id) return;
    const src = reader.byFileId(r.file_id);
    if (!src) {
      unavailable = true;
      refs.push({ ref_index: i, file_id: r.file_id, status: 'source_unavailable' });
      return;
    }
    hashes.set(src.rel, src.sha256);
    for (const inc of src.includedFiles) hashes.set(inc, reader.accessed.get(inc) ?? null);
    if (r.field_id && !r.statement_id) {
      const f = cat.fields.get(r.field_id);
      const idx = buildSymbolIndex(src.dd, src.abs);
      const defs = f ? idx.byName.get(String(f.field_name).toUpperCase()) ?? [] : [];
      refs.push({ ref_index: i, file_id: r.file_id, field_id: r.field_id, field: f ? { name: f.field_name, qualified_name: f.qualified_name, source_line: f.source_line } : null, field_in_source: defs.map((d) => ({ file: path.basename(d.file), line: d.line })), status: !f ? 'unknown_permanent_id' : defs.length ? 'field_resolves' : 'field_not_found_in_source' });
      if (!f) uncertainties.push(`ref ${i}: permanent field ID ${r.field_id} is not in the reverse field catalogue`);
      else if (defs.length && f.source_line && !defs.some((d) => d.line === f.source_line)) disagreements.push(`${f.field_name}: catalogue line ${f.source_line}, source line(s) ${defs.map((d) => d.line).join(', ')}`);
      return;
    }
    const st = r.statement_id ? snap.ctx.statements.get(r.statement_id) : null;
    if (!st) {
      refs.push({ ref_index: i, file_id: r.file_id, statement_id: r.statement_id ?? null, status: r.statement_id ? 'statement_id_unknown' : 'no_statement_cited' });
      if (r.statement_id) uncertainties.push(`ref ${i}: statement ${r.statement_id} is not in the parser artifacts`);
      return;
    }
    anyStatement = true;
    const range: [number, number] = [st.start_line, st.end_line ?? st.start_line];
    const lineInside = typeof r.line !== 'number' || (r.line >= range[0] && r.line <= range[1]);
    if (!lineInside) citationMismatch = true;
    const idx = buildSymbolIndex(src.dd, src.abs);
    const t = logicalText(src.file, range[0], range[1]);
    const refsIn = statementReferences(idx, t);
    const ls = literalSupport(idx, t, refsIn, lits);
    support.push(ls);
    for (const u of idx.unresolvedIncludes) uncertainties.push(`COPY ${u.name} at ${path.basename(u.file)}:${u.line} ${u.circular ? 'is circular' : 'cannot be resolved'}: symbols it would define stay unresolved`);
    const conds = refsIn.filter((x) => x.definition?.kind === 'condition' || x.resolution !== 'resolved');
    if (refsIn.some((x) => x.resolution === 'resolved')) lv.symbol_exists = true;
    for (const x of refsIn.filter((y) => y.resolution === 'ambiguous')) uncertainties.push(`${x.name} is ambiguous (${x.candidates} declarations); qualify it (OF/IN) to resolve`);
    for (const x of conds.filter((y) => y.resolution === 'resolved')) {
      const d = x.definition!;
      const perm = permanentFor(snap, cat, d, snap.ctx.srcRoot);
      disagreements.push(...perm.disagrees);
      lv.symbol_resolved = true;
      if (d.values.length) lv.value_declared = true;
      if (x.usage !== 'referenced') lv.statement_references = true;
      if (x.usage === 'sets_true') lv.runtime_effect_supported = true;
      extra.push({ condition: d.name, declared_in: snap.ctx.srcRoot ? path.relative(snap.ctx.srcRoot, d.file).split(path.sep).join('/') : d.file, line: d.line, values: d.values, parent: d.parent?.name ?? null, condition_id: perm.condition_id, parent_field_id: perm.parent_field_id, include_chain: d.include_chain.map((c) => ({ member: c.member, included_from: snap.ctx.srcRoot ? path.relative(snap.ctx.srcRoot, c.included_from).split(path.sep).join('/') : c.included_from, line: c.line })), usage: x.usage });
    }
    // Label/value pairs in the claim must agree with the referenced conditions that declare the value.
    for (const p of labelPairs(claim)) {
      const named = conds.filter((x) => x.resolution === 'resolved' && x.definition!.name.split('-').includes(p.label));
      if (named.length && !named.some((x) => x.definition!.values.map((v) => v.toUpperCase()).includes(p.value))) contradictions.push(`claim pairs ${p.label} with '${p.value}', but ${named.map((x) => `${x.definition!.name} declares ${JSON.stringify(x.definition!.values)}`).join('; ')}`);
    }
    refs.push({ ref_index: i, file_id: r.file_id, path: src.rel, sha256: src.sha256, statement_id: r.statement_id, statement_range: range, cited_line: r.line ?? null, cited_line_inside_statement: lineInside, comment_lines_skipped: t.lines.filter((l) => l.comment).length, continuation_lines_joined: t.lines.filter((l) => l.continuation).length, references: refsIn.map((x) => ({ name: x.name, qualifiers: x.qualifiers, usage: x.usage, resolution: x.resolution, candidates: x.candidates, declared: x.definition ? { kind: x.definition.kind, line: x.definition.line, file: path.basename(x.definition.file), values: x.definition.values } : null })), literals: ls });
  });

  // Merge literal support across statements: a literal is supported if any cited statement supports it.
  const rank: Record<string, number> = { in_statement: 4, declared_value_of_referenced_condition: 3, ambiguous_condition: 2, unrelated_occurrence_only: 1, unsupported: 0 };
  const merged = lits.map((l) => support.map((s) => s.find((x) => x.literal === l)!).filter(Boolean).sort((a, b) => rank[b.support] - rank[a.support])[0] ?? { literal: l, support: 'unsupported' as const, via: [], unrelated: [] });
  const ok = merged.filter((m) => m.support === 'in_statement' || m.support === 'declared_value_of_referenced_condition').length;
  let status: ContextStatus;
  if (!it.source_refs.some((r: any) => r?.file_id)) status = 'NOT_APPLICABLE';
  else if (unavailable && !anyStatement) status = 'SOURCE_UNAVAILABLE';
  else if (!anyStatement) status = 'CONTEXT_UNRESOLVED';
  else if (contradictions.length) status = 'CONTEXT_CONTRADICTED';
  else if (citationMismatch) status = 'CITATION_MISMATCH';
  else if (merged.some((m) => m.support === 'ambiguous_condition')) status = 'CONTEXT_UNRESOLVED';
  else if (!lits.length || ok === lits.length) status = 'CONTEXT_SUPPORTED';
  else status = ok ? 'CONTEXT_PARTIAL' : 'CONTEXT_UNSUPPORTED';
  for (const m of merged.filter((x) => x.support === 'unrelated_occurrence_only')) uncertainties.push(`'${m.literal}' is declared by ${m.unrelated.map((u) => `${u.name} (${path.basename(u.file)}:${u.line})`).join(', ')}, but no cited statement references it: not counted as evidence`);
  const human = status === 'CONTEXT_SUPPORTED'
    ? 'the source structurally supports the stated values; whether this is the intended business behaviour is an interpretation only an authorised reviewer can confirm (by selecting the evidence supplement in a signed resolution)'
    : status === 'CITATION_MISMATCH'
      ? 'the cited line lies outside the cited statement: an authorised citation correction is needed before the evidence can count'
      : 'the source does not establish the claim deterministically; an authorised decision is still required';
  const base = {
    item_id: it.id,
    kind: it.kind,
    item_sha256: it.sha256,
    claim: claim.trim(),
    claimed_literals: lits,
    existing: { claim_result: it.claim?.result ?? null, reasons: it.claim?.reasons ?? [] },
    refs,
    levels: lv,
    status,
    literal_support: merged,
    additional_references: extra,
    contradictions,
    metadata_disagreements: [...new Set(disagreements)],
    uncertainties: [...new Set(uncertainties)],
    source_hashes: [...hashes.entries()].map(([p, h]) => ({ path: p, sha256: h })).sort((a, b) => (a.path < b.path ? -1 : 1)),
    human_decision_needed: { needed: true, why: human },
  };
  return { ...base, result_sha256: digest(base) };
}

/** Context checks for the requirement and runtime-requirement items of a scope (or the whole system). */
export function contextReport(wf: Workflow, scope?: string, snap: Snapshot = buildSnapshot(wf)): any {
  const reader = new SourceReader(snap);
  const ids = scope ? new Set(evaluateScope(snap, parseSelector(scope)).findings.map((f) => f.id)) : null;
  const items = snap.items.filter((i) => (i.kind === 'requirement' || i.kind === 'runtime_requirement') && (!ids || ids.has(i.id)));
  const results = items.map((i) => checkItem(snap, reader, i));
  const by: Record<string, number> = {};
  for (const r of results) by[r.status] = (by[r.status] ?? 0) + 1;
  const improved = results.filter((r) => r.existing.claim_result !== 'verified' && r.additional_references.some((a) => r.literal_support.some((l) => l.via.some((v) => v.condition === a.condition))));
  return {
    contract: 'verification/context-report',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: wf.run.manifestSha256,
    scope: scope ?? 'application',
    source_available: reader.available,
    summary: { items: results.length, by_status: by, dependency_chains: results.reduce((n, r) => n + r.additional_references.length, 0), additional_references_supporting_claims: results.reduce((n, r) => n + r.literal_support.filter((l) => l.support === 'declared_value_of_referenced_condition').length, 0), items_with_new_evidence: improved.length, contradictions: results.filter((r) => r.contradictions.length).length, metadata_disagreements: results.reduce((n, r) => n + r.metadata_disagreements.length, 0) },
    results,
  };
}

/* ------------------------------------------------------------------ */
/* evidence supplements                                                */
/* ------------------------------------------------------------------ */

export function supplements(wf: Workflow): any[] {
  return wf.store.list(CONTEXT_DIR).filter((f) => f.startsWith('ESU-')).map((f) => wf.store.readRecord(CONTEXT_DIR, f));
}

function sealedHash(wf: Workflow, id: string): string | null {
  let h: string | null = null;
  for (const e of wf.store.readAudit()) if (e.event === 'context_supplement_recorded' && (e.data as any).supplement_id === id) h = (e.data as any).sha256;
  return h;
}

/** Whether a supplement is intact and still describes the current item and source. */
export function supplementState(snap: Snapshot, s: any): { current: boolean; problems: string[] } {
  const problems: string[] = [];
  if (sealedHash(snap.wf, s.supplement_id) !== sha256File(snap.wf.store.p(CONTEXT_DIR, `${s.supplement_id}.json`))) problems.push(`${s.supplement_id} does not match its sealed hash`);
  if (s.baseline_manifest_sha256 !== snap.wf.run.manifestSha256) problems.push('different baseline');
  const it = snap.itemById.get(s.item_id);
  if (!it || it.sha256 !== s.item_sha256) problems.push(`${s.item_id} changed since the supplement`);
  // Only the latest version of an item's supplement can count (STEP 10): superseded evidence is never current proof.
  const later = supplements(snap.wf).filter((x) => x.item_id === s.item_id && x.version > s.version);
  if (later.length) problems.push(`superseded by ${later.map((x) => x.supplement_id).join(', ')}`);
  for (const h of s.result.source_hashes) if (snap.ctx.srcRoot && sha256File(path.join(snap.ctx.srcRoot, h.path)) !== h.sha256) problems.push(`source ${h.path} changed since the supplement`);
  return { current: !problems.length, problems };
}

/**
 * Records versioned evidence supplements for items whose existing claim check
 * is not verified but the dependency-aware check found additional source
 * evidence (or a contradiction / citation mismatch to document). Identical
 * content is not recorded twice; a changed result is a new version that
 * names the version it supersedes. Nothing else changes.
 */
export function recordSupplements(wf: Workflow, report: any): Array<{ supplement_id: string; item_id: string; version: number; status: string; new: boolean }> {
  return mutate(wf, 'context supplements', () => {
    const out: Array<{ supplement_id: string; item_id: string; version: number; status: string; new: boolean }> = [];
    const all = supplements(wf);
    for (const r of report.results as ContextResult[]) {
      // Advisory: an item the existing claim check verified but the dependency-aware check does not support
      // (e.g. a single-letter value matched only as a substring of a data name) is documented for review.
      const advisory = r.existing.claim_result === 'verified' && ['CONTEXT_UNSUPPORTED', 'CONTEXT_PARTIAL', 'CONTEXT_CONTRADICTED', 'CITATION_MISMATCH'].includes(r.status) && r.claimed_literals.length > 0;
      if (r.existing.claim_result === 'verified' && !advisory) continue;
      const relevant = advisory || r.additional_references.length > 0 || r.contradictions.length > 0 || r.status === 'CITATION_MISMATCH';
      if (!relevant) continue;
      const mine = all.filter((s) => s.item_id === r.item_id).sort((a, b) => a.version - b.version);
      const prev = mine[mine.length - 1];
      if (prev && prev.result.result_sha256 === r.result_sha256) {
        out.push({ supplement_id: prev.supplement_id, item_id: r.item_id, version: prev.version, status: prev.result.status, new: false });
        continue;
      }
      const n = wf.store.list(CONTEXT_DIR).filter((f) => f.startsWith('ESU-')).length + 1;
      const id = `ESU-${String(n).padStart(4, '0')}`;
      const decision = `RVW-${r.item_id}`;
      const rec = {
        contract: 'verification/evidence-supplement',
        contract_version: '1.0',
        supplement_id: id,
        item_id: r.item_id,
        item_kind: r.kind,
        item_sha256: r.item_sha256,
        version: (prev?.version ?? 0) + 1,
        supersedes: prev?.supplement_id ?? null,
        recorded_at: new Date().toISOString(),
        baseline_manifest_sha256: wf.run.manifestSha256,
        method: 'dependency-aware COBOL source-context verification (verification/src/context.ts): statement range from parser IDs, symbol resolution through the COPY-expanded DATA DIVISION, level-88 VALUE support only through SET/tested references',
        result: r,
        acceptance: { decision_id: decision, required: true, how: advisory ? `advisory: the existing claim check accepted this item, the dependency-aware check does not (${r.status}); a reviewer should confirm or correct the citation` : `a signed resolution of ${decision} with outcome resolved_no_change and selected_option ${id}`, eligible: !advisory && r.status === 'CONTEXT_SUPPORTED' },
        effect: 'none until accepted: an unsigned supplement never changes a G2 outcome, resolves a decision or alters a requirement or receipt',
      };
      const v = wf.run.ctx.contracts.validate('verification/evidence-supplement', rec);
      if (!v.valid) throw new Error(`evidence supplement violates its contract: ${v.errors.join('; ')}`);
      const f = wf.store.writeRecord(CONTEXT_DIR, `${id}.json`, rec);
      wf.store.append('context_supplement_recorded', { supplement_id: id, item_id: r.item_id, version: rec.version, status: r.status, sha256: sha256File(f) });
      all.push(rec);
      out.push({ supplement_id: id, item_id: r.item_id, version: rec.version, status: r.status, new: true });
    }
    wf.store.writeState(wf.state);
    return out;
  });
}
