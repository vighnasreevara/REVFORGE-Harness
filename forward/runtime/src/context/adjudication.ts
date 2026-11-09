/**
 * Evidence adjudication (STEP 10). Two cohorts are re-examined against the
 * original COBOL, never trusting either checker's earlier output:
 *
 *  - newly supported: the earlier claim check did not verify the item, the
 *    dependency-aware check supports it. Each chain is re-followed (source
 *    hashes, permanent IDs, catalogue agreement, every stated value) and
 *    classified SOURCE_CHAIN_VERIFIED | _PARTIAL | _AMBIGUOUS |
 *    _CONTRADICTED | _UNAVAILABLE. These are evidence classes, not approvals:
 *    acceptance still needs a signed resolution.
 *
 *  - questionable earlier verifications: the earlier check verified the item,
 *    the dependency-aware check does not. The earlier check is reproduced
 *    exactly (verifyTextClaim) and every value it matched is classified by
 *    HOW it matched: as a literal, as a number, as a word, or only as a
 *    substring inside a data name. If the earlier result rests only on such
 *    false matches and no cited statement supports the value, the record
 *    carries EVIDENCE_INVALIDATED; while current it supersedes the earlier
 *    verification in the G1 snapshot (fail-closed). Statements elsewhere
 *    that do support the value are recorded as alternative evidence for a
 *    human citation update; they never count automatically.
 *
 * Records are versioned, sealed and immutable. Nothing here resolves a
 * decision, approves anything or changes a requirement or receipt.
 */
import * as path from 'path';
import { buildSnapshot, Item, Snapshot } from '../approval/snapshot';
import { digest } from '../approval/canonical';
import { evaluateScope, parseSelector } from '../approval/scope';
import { SourceReader } from '../blockers/deterministic';
import { sha256File } from '../core/fsutil';
import { mutate, Workflow } from '../orchestrator/orchestrator';
import { verifyTextClaim } from '../remediation/remediation';
import { buildSymbolIndex, literalSupport, logicalText, statementReferences } from '../../../verification/src/context';
import { checkItem, ContextResult, CONTEXT_DIR } from './context';

export type ChainClass = 'SOURCE_CHAIN_VERIFIED' | 'SOURCE_CHAIN_PARTIAL' | 'SOURCE_CHAIN_AMBIGUOUS' | 'SOURCE_CHAIN_CONTRADICTED' | 'SOURCE_CHAIN_UNAVAILABLE';
export type MatchKind = 'literal' | 'number' | 'word' | 'substring_of_name' | 'not_present';
export type Diagnosis = 'INCORRECT_VERIFICATION_METHOD' | 'UNSUPPORTED_SOURCE_CITATION' | 'CORRECT_CLAIM_ALTERNATIVE_EVIDENCE' | 'INCORRECT_CLAIM' | 'GENUINE_SEMANTIC_UNCERTAINTY' | 'EARLIER_VERIFICATION_DEFENSIBLE';

const claimText = (it: Item) => (it.kind === 'requirement' ? `${it.data.title} ${it.data.statement}` : String(it.data.statement ?? ''));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** How a value occurs in a cited range: the way the earlier substring check saw it, classified honestly. */
export function matchKind(t: { words: string; literals: string[] }, value: string): MatchKind {
  const v = value.toUpperCase();
  if (t.literals.some((l) => l.toUpperCase() === v || (v.length >= 2 && l.toUpperCase().includes(v)))) return 'literal';
  if (/^\d+$/.test(v) && new RegExp(`(?<![A-Z0-9-])${v}(?![A-Z0-9-])`).test(t.words)) return 'number';
  if (new RegExp(`(?<![A-Z0-9-])${esc(v)}(?![A-Z0-9-])`).test(t.words)) return 'word';
  if (t.words.includes(v)) return 'substring_of_name';
  return 'not_present';
}

/** The ranges the earlier check read for each reference (statement, paragraph or line +/- 3). */
function citedRanges(snap: Snapshot, refs: any[]): Array<{ file_id: string; from: number; to: number; statement_id: string | null }> {
  const out: Array<{ file_id: string; from: number; to: number; statement_id: string | null }> = [];
  for (const r of refs ?? []) {
    if (!r?.file_id) continue;
    const st = r.statement_id ? snap.ctx.statements.get(r.statement_id) : null;
    const pg = !st && r.paragraph_id ? snap.ctx.paragraphs.get(r.paragraph_id) : null;
    if (st) out.push({ file_id: r.file_id, from: st.start_line, to: st.end_line ?? st.start_line, statement_id: r.statement_id });
    else if (pg) out.push({ file_id: r.file_id, from: pg.start_line, to: pg.end_line, statement_id: null });
    else if (typeof r.line === 'number') out.push({ file_id: r.file_id, from: r.line - 3, to: r.line + 3, statement_id: null });
  }
  return out;
}

/** Statements of the cited program (other than the cited ones) that reference a condition declaring `value`. */
function alternativeEvidence(snap: Snapshot, reader: SourceReader, fileId: string, value: string, exclude: Set<string>): any[] {
  const src = reader.byFileId(fileId);
  if (!src) return [];
  const idx = buildSymbolIndex(src.dd, src.abs);
  const out: any[] = [];
  for (const [id, st] of snap.ctx.statements) {
    if (!id.startsWith(`${fileId}-STMT-`) || exclude.has(id)) continue;
    const t = logicalText(src.file, st.start_line, st.end_line ?? st.start_line);
    const refs = statementReferences(idx, t);
    const s = literalSupport(idx, t, refs, [value])[0];
    if (s.support === 'declared_value_of_referenced_condition' || s.support === 'in_statement') out.push({ statement_id: id, lines: [st.start_line, st.end_line ?? st.start_line], statement_type: st.statement_type ?? null, support: s.support, via: s.via.map((v) => ({ condition: v.condition, usage: v.usage, declared: `${path.basename(v.definition.file)}:${v.definition.line}` })) });
    if (out.length >= 5) break;
  }
  return out;
}

export function adjudicateItem(snap: Snapshot, reader: SourceReader, it: Item, ctx?: ContextResult): any | null {
  const r = ctx ?? checkItem(snap, reader, it);
  const oldVerified = it.claim?.result === 'verified';
  const viaChain = r.literal_support.some((l) => l.support === 'declared_value_of_referenced_condition');
  const newlySupported = !oldVerified && r.status === 'CONTEXT_SUPPORTED' && viaChain;
  const questionable = oldVerified && ['CONTEXT_UNSUPPORTED', 'CONTEXT_PARTIAL', 'CONTEXT_CONTRADICTED', 'CITATION_MISMATCH'].includes(r.status) && r.claimed_literals.length > 0;
  if (!newlySupported && !questionable) return null;
  const files = r.source_hashes.map((h) => ({ ...h, current: snap.ctx.srcRoot ? sha256File(path.join(snap.ctx.srcRoot, h.path)) : null }));
  const hashesOk = files.length > 0 && files.every((f) => f.current === f.sha256);
  const base: any = {
    item_id: it.id,
    item_kind: it.kind,
    item_sha256: it.sha256,
    claim: claimText(it).trim(),
    earlier_result: { method: 'verifyTextClaim: claimed values (quoted literals, multi-digit numbers) searched as plain substrings of the cited range text', result: it.claim?.result ?? null, reasons: it.claim?.reasons ?? [] },
    context_result: { status: r.status, result_sha256: r.result_sha256, literal_support: r.literal_support.map((l) => ({ literal: l.literal, support: l.support, via: l.via.map((v) => v.condition) })) },
    source_files: files,
    permanent_ids: r.additional_references.map((a) => ({ condition: a.condition, condition_id: a.condition_id, parent_field_id: a.parent_field_id })),
    remaining_uncertainty: [...r.uncertainties, 'business interpretation is not established by any source check'],
    needs_human_acceptance: true,
  };
  if (newlySupported) {
    const ambiguous = r.literal_support.some((l) => l.support === 'ambiguous_condition') || r.uncertainties.some((u) => /ambiguous/.test(u));
    const allIds = r.additional_references.every((a) => a.condition_id);
    let cls: ChainClass;
    if (!hashesOk) cls = 'SOURCE_CHAIN_UNAVAILABLE';
    else if (r.contradictions.length) cls = 'SOURCE_CHAIN_CONTRADICTED';
    else if (ambiguous) cls = 'SOURCE_CHAIN_AMBIGUOUS';
    else if (r.literal_support.every((l) => l.support === 'in_statement' || l.support === 'declared_value_of_referenced_condition') && allIds && !r.metadata_disagreements.length && r.refs.every((x: any) => x.cited_line_inside_statement !== false)) cls = 'SOURCE_CHAIN_VERIFIED';
    else cls = 'SOURCE_CHAIN_PARTIAL';
    return { ...base, cohort: 'newly_supported', classification: cls, classification_reasons: [!hashesOk ? 'source hashes differ or source unavailable' : null, r.contradictions.length ? r.contradictions.join('; ') : null, ambiguous ? 'an ambiguous symbol is involved' : null, !allIds ? 'a chain has no permanent ID in the reverse catalogue' : null, r.metadata_disagreements.length ? `catalogue disagrees: ${r.metadata_disagreements.join('; ')}` : null].filter(Boolean), superseding_status: null };
  }
  // Questionable earlier verification: reproduce it and classify every match it relied on.
  const old = verifyTextClaim(snap.ctx, claimText(it), it.source_refs);
  const ranges = citedRanges(snap, it.source_refs);
  const texts = ranges.map((g) => {
    const src = reader.byFileId(g.file_id);
    return src ? { ...g, t: logicalText(src.file, Math.max(1, g.from), g.to) } : null;
  }).filter(Boolean) as Array<{ file_id: string; from: number; to: number; statement_id: string | null; t: ReturnType<typeof logicalText> }>;
  const matched: string[] = old.checks.literals_in_cited_lines ?? [];
  const matches = matched.map((v) => {
    const kinds = texts.map((x) => matchKind(x.t, v));
    const best: MatchKind = (['literal', 'number', 'word', 'substring_of_name', 'not_present'] as MatchKind[]).find((k) => kinds.includes(k)) ?? 'not_present';
    return { value: v, match: best, context_support: r.literal_support.find((l) => l.literal.toUpperCase() === v.toUpperCase())?.support ?? (/^\d+$/.test(v) ? 'numeric (not re-evaluated by the dependency check)' : 'not evaluated') };
  });
  const falseOnly = matches.filter((m) => m.match === 'substring_of_name' && !['in_statement', 'declared_value_of_referenced_condition'].includes(String(m.context_support)));
  const cited = new Set(ranges.map((g) => g.statement_id).filter(Boolean) as string[]);
  const fileId = ranges[0]?.file_id ?? null;
  const alternatives = fileId ? falseOnly.map((m) => ({ value: m.value, statements: alternativeEvidence(snap, reader, fileId, m.value, cited) })) : [];
  const diagnosis: Diagnosis[] = [];
  if (falseOnly.length) diagnosis.push('INCORRECT_VERIFICATION_METHOD', 'UNSUPPORTED_SOURCE_CITATION');
  if (alternatives.some((a) => a.statements.length)) diagnosis.push('CORRECT_CLAIM_ALTERNATIVE_EVIDENCE');
  if (r.contradictions.length) diagnosis.push('INCORRECT_CLAIM');
  if (r.literal_support.some((l) => l.support === 'ambiguous_condition')) diagnosis.push('GENUINE_SEMANTIC_UNCERTAINTY');
  if (!falseOnly.length && !r.contradictions.length) diagnosis.push('EARLIER_VERIFICATION_DEFENSIBLE');
  const invalid = falseOnly.length > 0 || r.contradictions.length > 0;
  return {
    ...base,
    cohort: 'questionable_earlier_verification',
    reproduced_earlier_result: { result: old.result, literals_in_cited_lines: matched, literals_elsewhere_in_file: old.checks.literals_elsewhere_in_file },
    matches,
    alternative_evidence: alternatives,
    diagnosis,
    classification: invalid ? (r.contradictions.length ? 'SOURCE_CHAIN_CONTRADICTED' : alternatives.some((a) => a.statements.length) ? 'SOURCE_CHAIN_PARTIAL' : 'SOURCE_CHAIN_UNAVAILABLE') : 'SOURCE_CHAIN_VERIFIED',
    superseding_status: invalid ? 'EVIDENCE_INVALIDATED' : 'EARLIER_VERIFICATION_CONFIRMED',
    superseding_reason: invalid
      ? `the earlier verification relied on value(s) ${falseOnly.map((m) => `'${m.value}'`).join(', ')} matched only as a substring inside a data name in the cited text, and no cited statement supports them${r.contradictions.length ? `; contradiction: ${r.contradictions.join('; ')}` : ''}${alternatives.some((a) => a.statements.length) ? '; other statements in the program do support the value (alternative evidence for a citation update by a reviewer)' : ''}`
      : 'every value the earlier check matched occurs as a literal, number or word in the cited text',
  };
}

/* ------------------------------------------------------------------ */
/* records                                                             */
/* ------------------------------------------------------------------ */

export function adjudications(wf: Workflow): any[] {
  return wf.store.list(CONTEXT_DIR).filter((f) => f.startsWith('EAR-')).map((f) => wf.store.readRecord(CONTEXT_DIR, f));
}
function sealed(wf: Workflow, id: string): string | null {
  let h: string | null = null;
  for (const e of wf.store.readAudit()) if (e.event === 'evidence_adjudicated' && (e.data as any).adjudication_id === id) h = (e.data as any).sha256;
  return h;
}

/**
 * Whether an adjudication record applies now: sealed, latest version for its
 * item, same baseline, same item content and same source bytes.
 */
export function adjudicationState(snap: Snapshot, all: any[], a: any, it: Item | undefined): { current: boolean; problems: string[] } {
  const problems: string[] = [];
  if (sealed(snap.wf, a.adjudication_id) !== sha256File(snap.wf.store.p(CONTEXT_DIR, `${a.adjudication_id}.json`))) problems.push(`${a.adjudication_id} does not match its sealed hash`);
  const later = all.filter((x) => x.item_id === a.item_id && x.version > a.version);
  if (later.length) problems.push(`superseded by ${later.map((x) => x.adjudication_id).join(', ')}`);
  if (a.baseline_manifest_sha256 !== snap.wf.run.manifestSha256) problems.push('different baseline');
  if (!it || it.sha256 !== a.item_sha256) problems.push(`${a.item_id} changed since the adjudication`);
  for (const f of a.result.source_files) if (snap.ctx.srcRoot && sha256File(path.join(snap.ctx.srcRoot, f.path)) !== f.sha256) problems.push(`source ${f.path} changed since the adjudication`);
  return { current: !problems.length, problems };
}

export function adjudicationReport(wf: Workflow, scope?: string, snap: Snapshot = buildSnapshot(wf)): any {
  const reader = new SourceReader(snap);
  const ids = scope ? new Set(evaluateScope(snap, parseSelector(scope)).findings.map((f) => f.id)) : null;
  const results = snap.items
    .filter((i) => (i.kind === 'requirement' || i.kind === 'runtime_requirement') && (!ids || ids.has(i.id)))
    .map((i) => adjudicateItem(snap, reader, i))
    .filter(Boolean);
  const count = (k: string, v: string) => results.filter((r: any) => r[k] === v).length;
  return {
    contract: 'verification/evidence-adjudication-report',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: wf.run.manifestSha256,
    scope: scope ?? 'application',
    summary: {
      newly_supported: results.filter((r: any) => r.cohort === 'newly_supported').length,
      questionable_earlier_verifications: results.filter((r: any) => r.cohort === 'questionable_earlier_verification').length,
      by_classification: Object.fromEntries(['SOURCE_CHAIN_VERIFIED', 'SOURCE_CHAIN_PARTIAL', 'SOURCE_CHAIN_AMBIGUOUS', 'SOURCE_CHAIN_CONTRADICTED', 'SOURCE_CHAIN_UNAVAILABLE'].map((c) => [c, count('classification', c)])),
      evidence_invalidated: count('superseding_status', 'EVIDENCE_INVALIDATED'),
      earlier_verification_confirmed: count('superseding_status', 'EARLIER_VERIFICATION_CONFIRMED'),
    },
    results,
  };
}

/** Records versioned adjudications (new version only when the content changed). Never resolves anything. */
export function recordAdjudications(wf: Workflow, report: any): Array<{ adjudication_id: string; item_id: string; version: number; classification: string; superseding_status: string | null; new: boolean }> {
  return mutate(wf, 'evidence adjudication', () => {
    const all = adjudications(wf);
    const out: Array<{ adjudication_id: string; item_id: string; version: number; classification: string; superseding_status: string | null; new: boolean }> = [];
    for (const r of report.results) {
      const content = digest(r);
      const mine = all.filter((a) => a.item_id === r.item_id).sort((a, b) => a.version - b.version);
      const prev = mine[mine.length - 1];
      if (prev && prev.content_sha256 === content) {
        out.push({ adjudication_id: prev.adjudication_id, item_id: r.item_id, version: prev.version, classification: prev.result.classification, superseding_status: prev.result.superseding_status, new: false });
        continue;
      }
      const id = `EAR-${String(wf.store.list(CONTEXT_DIR).filter((f) => f.startsWith('EAR-')).length + 1).padStart(4, '0')}`;
      const esu = [...wf.store.list(CONTEXT_DIR)].filter((f) => f.startsWith('ESU-')).map((f) => wf.store.readRecord(CONTEXT_DIR, f)).filter((s: any) => s.item_id === r.item_id).map((s: any) => s.supplement_id);
      const rec = {
        contract: 'verification/evidence-adjudication',
        contract_version: '1.0',
        adjudication_id: id,
        item_id: r.item_id,
        version: (prev?.version ?? 0) + 1,
        supersedes: prev?.adjudication_id ?? null,
        recorded_at: new Date().toISOString(),
        baseline_manifest_sha256: wf.run.manifestSha256,
        item_sha256: r.item_sha256,
        linked: { evidence_supplements: esu, original_finding: `${r.item_kind}:${r.item_id}` },
        content_sha256: content,
        result: r,
        effect: r.superseding_status === 'EVIDENCE_INVALIDATED' ? 'while current, the G1 snapshot treats the earlier verification of this item as unverified (fail-closed); no decision is resolved' : 'informational: classifies the evidence; acceptance still needs a signed resolution',
      };
      const v = wf.run.ctx.contracts.validate('verification/evidence-adjudication', rec);
      if (!v.valid) throw new Error(`evidence adjudication violates its contract: ${v.errors.join('; ')}`);
      const f = wf.store.writeRecord(CONTEXT_DIR, `${id}.json`, rec);
      wf.store.append('evidence_adjudicated', { adjudication_id: id, item_id: r.item_id, version: rec.version, classification: r.classification, superseding_status: r.superseding_status, sha256: sha256File(f) });
      all.push(rec);
      out.push({ adjudication_id: id, item_id: r.item_id, version: rec.version, classification: r.classification, superseding_status: r.superseding_status, new: true });
    }
    wf.store.writeState(wf.state);
    return out;
  });
}
