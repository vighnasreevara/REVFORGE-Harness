/**
 * Deterministic COBOL evidence checks for root causes, read-only against the
 * configured original source checkout.
 *
 * What a check can establish is stated precisely:
 *   VERIFIED_STRUCTURALLY      the cited source exists and has the stated shape
 *                              (statement, keyword, literal values present);
 *                              behaviour and business meaning are NOT proven
 *   VERIFIED_DETERMINISTICALLY a fact computed from the source (record size,
 *                              PIC/USAGE/offset, OPEN mode vs I/O verb,
 *                              missing PERFORM target, reference counts)
 *   SOURCE_CITATION_CORRECTED  the cited statement/line is wrong and the source
 *                              identifies the correct one (a proposal only)
 *   CONTRADICTED_BY_SOURCE     the source disagrees with the claim
 *   EXTERNAL_DEPENDENCY_MISSING the member/program/source the claim needs is absent
 *   INSUFFICIENT_EVIDENCE      the source cannot settle it
 *   NOT_APPLICABLE_WITH_EVIDENCE the check does not apply, with the evidence why
 * and the next step needed (business SME, technical SME, independent semantic
 * review, approval). Nothing here resolves a decision or changes an outcome.
 */
import * as fs from 'fs';
import * as path from 'path';
import { normPic, rangeText, SourceFile } from '../../../verification/src/cobol-source';
import { contextFor, excerpt, indexSourceTree, procedureFacts, ProcedureFacts, readSource, resolveMember, SourceIndex } from '../../../verification/src/facts';
import { DataDivision, fdLengthFindings, javaTypesFor, LayoutNode, parseDataDivision } from '../../../verification/src/layout';
import { Item, Snapshot } from '../approval/snapshot';
import { claimLiterals, statementForLine } from '../remediation/remediation';
import { ITEM_KINDS } from './audit';
import { Registry, RootCause } from './rootcauses';

export type VStatus = 'VERIFIED_STRUCTURALLY' | 'VERIFIED_DETERMINISTICALLY' | 'SOURCE_CITATION_CORRECTED' | 'INSUFFICIENT_EVIDENCE' | 'CONTRADICTED_BY_SOURCE' | 'EXTERNAL_DEPENDENCY_MISSING' | 'NOT_APPLICABLE_WITH_EVIDENCE';
export type NextStep = 'REQUIRES_BUSINESS_SME' | 'REQUIRES_TECHNICAL_SME' | 'REQUIRES_INDEPENDENT_SEMANTIC_REVIEW' | 'REQUIRES_APPROVAL' | 'REQUIRES_SOURCE' | 'REQUIRES_PROPOSAL_REVIEW';

export interface Check {
  id: string;
  subject: string;
  status: VStatus;
  detail: string;
  evidence?: any;
}

export interface RootResult {
  root_cause_id: string;
  key: string;
  category: string;
  executed: boolean;
  checks: Check[];
  status: VStatus;
  next_step: NextStep;
  establishes: string;
  does_not_establish: string;
  source_files: Array<{ path: string; sha256: string | null }>;
}

const STATUS_RANK: VStatus[] = ['NOT_APPLICABLE_WITH_EVIDENCE', 'VERIFIED_STRUCTURALLY', 'VERIFIED_DETERMINISTICALLY', 'SOURCE_CITATION_CORRECTED', 'INSUFFICIENT_EVIDENCE', 'EXTERNAL_DEPENDENCY_MISSING', 'CONTRADICTED_BY_SOURCE'];
const worstStatus = (xs: VStatus[]): VStatus => xs.reduce((w, s) => (STATUS_RANK.indexOf(s) > STATUS_RANK.indexOf(w) ? s : w), xs[0] ?? 'INSUFFICIENT_EVIDENCE');

interface Parsed {
  abs: string;
  rel: string;
  sha256: string | null;
  bytes: number;
  file: SourceFile;
  dd: DataDivision;
  pf: ProcedureFacts;
  codeLines: number;
  includedFiles: string[];
}

export class SourceReader {
  readonly idx: SourceIndex;
  private cache = new Map<string, Parsed | null>();
  readonly accessed = new Map<string, string | null>();
  /** Files read while checking the current root cause (cached reads included). */
  touched: Set<string> | null = null;
  constructor(readonly snap: Snapshot) {
    this.idx = indexSourceTree(snap.ctx.srcRoot);
  }
  get available(): boolean {
    return !!this.snap.ctx.srcRoot;
  }
  byFileId(fileId: string | null | undefined): Parsed | null {
    if (!fileId) return null;
    const rel = this.snap.ctx.relByFile.get(fileId);
    if (!rel || !this.snap.ctx.srcRoot) return null;
    return this.byPath(path.join(this.snap.ctx.srcRoot, rel));
  }
  byProgram(name: string): Parsed | null {
    const p = this.snap.sys.programs.find((x) => x.program_id === name);
    return p ? this.byFileId(p.file_id) : null;
  }
  byPath(abs: string): Parsed | null {
    this.touched?.add(this.rel(abs));
    if (this.cache.has(abs)) {
      for (const inc of this.cache.get(abs)?.includedFiles ?? []) this.touched?.add(inc);
      return this.cache.get(abs)!;
    }
    const r = readSource(abs);
    let out: Parsed | null = null;
    if (r) {
      const included: string[] = [];
      const resolveFile = (m: string) => {
        const p = resolveMember(this.idx, m);
        return p ? readSource(p)?.file ?? null : null;
      };
      const dd = parseDataDivision(r.file, (m) => {
        const p = resolveMember(this.idx, m);
        const s = p ? readSource(p) : null;
        if (p) {
          this.accessed.set(this.rel(p), s?.sha256 ?? null);
          included.push(this.rel(p));
          this.touched?.add(this.rel(p));
        }
        return s?.file ?? null;
      });
      out = { abs, rel: this.rel(abs), sha256: r.sha256, bytes: r.bytes, file: r.file, dd, pf: procedureFacts(r.file, dd, resolveFile), codeLines: r.file.lines.filter((l) => l.trim() && !/^.{6}[*/]/.test(l)).length, includedFiles: included };
    }
    this.accessed.set(this.rel(abs), out?.sha256 ?? null);
    this.cache.set(abs, out);
    return out;
  }
  rel(abs: string): string {
    return this.snap.ctx.srcRoot ? path.relative(this.snap.ctx.srcRoot, abs).split(path.sep).join('/') : abs;
  }
}

/* ------------------------------------------------------------------ */
/* citations                                                           */
/* ------------------------------------------------------------------ */

export interface CitationAnalysis {
  item: string;
  ref_index: number;
  original: { statement_id: string | null; line: number | null };
  proposed: { field: 'line' | 'statement_id'; value: string | number } | null;
  alternatives: Array<{ field: string; value: string | number; literal_support: number | null; statement_range: [number, number] | null }>;
  literals: string[];
  status: VStatus;
  claim_supported_after_correction: boolean | null;
  reasons: string[];
}

function itemText(it: Item): string {
  if (it.kind === 'requirement') return `${it.data.title} ${it.data.statement}`;
  if (it.kind === 'runtime_requirement') return it.data.statement;
  return '';
}

/** Re-derives a contradicted citation from the source: which of the cited statement or the cited line is wrong. */
export function analyseCitation(snap: Snapshot, reader: SourceReader, it: Item): CitationAnalysis[] {
  const out: CitationAnalysis[] = [];
  const text = itemText(it);
  const lits = claimLiterals(text).map((l) => l.toUpperCase());
  const stmts = [...snap.ctx.statements.values()];
  it.source_refs.forEach((r: any, i: number) => {
    if (!r?.file_id) return;
    const st = r.statement_id ? snap.ctx.statements.get(r.statement_id) : null;
    const lineOut = st && typeof r.line === 'number' && (r.line < st.start_line || r.line > (st.end_line ?? st.start_line));
    if (!(lineOut || (r.statement_id && !st))) return;
    const src = reader.byFileId(r.file_id);
    const a: CitationAnalysis = { item: it.id, ref_index: i, original: { statement_id: r.statement_id ?? null, line: r.line ?? null }, proposed: null, alternatives: [], literals: lits, status: 'INSUFFICIENT_EVIDENCE', claim_supported_after_correction: null, reasons: [] };
    if (!src) {
      a.status = 'EXTERNAL_DEPENDENCY_MISSING';
      a.reasons.push('source file is not available; the citation cannot be re-derived');
      out.push(a);
      return;
    }
    const support = (from: number, to: number) => (lits.length ? lits.filter((l) => rangeText(src.file, from, to).toUpperCase().includes(l)).length : null);
    if (st) {
      const to = st.end_line ?? st.start_line;
      a.alternatives.push({ field: 'line', value: st.start_line, literal_support: support(st.start_line, to), statement_range: [st.start_line, to] });
    }
    if (typeof r.line === 'number') {
      const at = statementForLine(stmts, r.file_id, r.line);
      if (at && at.statement_id !== r.statement_id) a.alternatives.push({ field: 'statement_id', value: at.statement_id, literal_support: support(at.start_line, at.end_line ?? at.start_line), statement_range: [at.start_line, at.end_line ?? at.start_line] });
    }
    if (!a.alternatives.length) a.reasons.push('neither the cited statement nor a statement at the cited line exists in the parser structure');
    else if (!lits.length) a.reasons.push(`the claim states no literal values, so the source cannot tell whether the statement (${a.alternatives.map((x) => `${x.field}=${x.value}`).join(' or ')}) or the line is wrong`);
    else {
      const best = [...a.alternatives].sort((x, y) => (y.literal_support ?? 0) - (x.literal_support ?? 0));
      if (best.length === 1 || (best[0].literal_support ?? 0) > (best[1].literal_support ?? 0)) {
        if ((best[0].literal_support ?? 0) > 0) {
          a.proposed = { field: best[0].field as any, value: best[0].value };
          a.status = 'SOURCE_CITATION_CORRECTED';
          a.claim_supported_after_correction = best[0].literal_support === lits.length;
          a.reasons.push(`${best[0].literal_support}/${lits.length} stated value(s) occur at ${best[0].field}=${best[0].value} (lines ${best[0].statement_range?.join('-')})${best[1] ? `, ${best[1].literal_support ?? 0} at the alternative` : ''}`);
        } else a.reasons.push('no stated value occurs at either candidate location');
      } else a.reasons.push(`the stated values are equally supported at ${best.map((x) => `${x.field}=${x.value}`).join(' and ')}; the source does not decide`);
    }
    if (a.status === 'INSUFFICIENT_EVIDENCE' && a.alternatives.length) a.status = 'CONTRADICTED_BY_SOURCE';
    out.push(a);
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* data records                                                        */
/* ------------------------------------------------------------------ */

function nodeIndex(dd: DataDivision): Map<string, { node: LayoutNode; usage: string; root: LayoutNode }> {
  const m = new Map<string, { node: LayoutNode; usage: string; root: LayoutNode }>();
  for (const r of dd.records) {
    const walk = (n: LayoutNode, inh: string | null) => {
      const usage = n.usage_explicit ? (n.usage as string) : inh ?? 'DISPLAY';
      m.set(`${n.file.toLowerCase()}#${n.line}`, { node: n, usage, root: r.root });
      for (const c of n.children) walk(c, n.usage_explicit ? n.usage : inh);
    };
    walk(r.root, null);
  }
  return m;
}

/** Condition-names (88) of a data division with their values and owning field. */
export function conditionIndex(dd: DataDivision): Map<string, { name: string; values: string[]; line: number; field: string; field_line: number }> {
  const m = new Map<string, { name: string; values: string[]; line: number; field: string; field_line: number }>();
  const walk = (n: LayoutNode) => {
    for (const c of n.conditions) m.set(`${n.file}#${c.line}`, { name: c.name, values: c.values, line: c.line, field: n.name, field_line: n.line });
    n.children.forEach(walk);
  };
  dd.records.forEach((r) => walk(r.root));
  return m;
}

const USAGE_EQ = (claimed: string | null, parsed: string) => {
  const n = (u: string | null) => (u === 'COMP' || u === 'COMP-4' ? 'BINARY' : u === 'COMP-3' ? 'PACKED_DECIMAL' : u);
  return n(claimed) === n(parsed);
};

export interface FieldCheck {
  field_id: string | null;
  field_name: string;
  status: 'verified' | 'contradicted' | 'indeterminate';
  mismatches: Array<{ attribute: string; claimed: unknown; source: unknown }>;
  notes: string[];
  source: { path: string; line: number } | null;
}

/** Compares an F2 data-record mapping field by field with the layout computed from the source text. */
export function checkRecord(snap: Snapshot, reader: SourceReader, rec: any): { status: VStatus; fields: FieldCheck[]; record: { claimed_total: number | null; source_total: number | null; determinate: boolean; flags: string[] }; source: string | null } {
  const owner = rec.owner?.file_id ? reader.byFileId(rec.owner.file_id) : null;
  if (!owner) return { status: reader.available ? 'EXTERNAL_DEPENDENCY_MISSING' : 'INSUFFICIENT_EVIDENCE', fields: [], record: { claimed_total: rec.total_bytes ?? null, source_total: null, determinate: false, flags: [reader.available ? 'owner source file missing' : 'source root not configured'] }, source: null };
  const idx = nodeIndex(owner.dd);
  const fields: FieldCheck[] = [];
  let root: LayoutNode | null = null;
  for (const f of rec.fields ?? []) {
    const li = f.field_id ? snap.ctx.layoutItems.get(f.field_id) : undefined;
    const rel = li ? snap.ctx.relByFile.get(li.file_id) : undefined;
    const abs = rel && snap.ctx.srcRoot ? path.join(snap.ctx.srcRoot, rel) : null;
    const fc: FieldCheck = { field_id: f.field_id ?? null, field_name: f.field_name, status: 'indeterminate', mismatches: [], notes: [], source: abs && li?.line ? { path: reader.rel(abs), line: li.line } : null };
    fields.push(fc);
    if (!abs || !li?.line) {
      fc.notes.push('no source location for this field (no Field ID or layout line)');
      continue;
    }
    if (f.level === 88 || f.cobol_category === 'condition') {
      const parent = [...idx.values()].find((x) => x.node.conditions.some((c) => c.line === li.line && x.node.file.toLowerCase() === abs.toLowerCase()));
      if (parent) fc.status = 'verified';
      else fc.notes.push('condition-name not found at its source line');
      continue;
    }
    const hit = idx.get(`${abs.toLowerCase()}#${li.line}`);
    if (!hit) {
      fc.notes.push(`no data entry at ${reader.rel(abs)}:${li.line} in the computed layout of ${owner.rel}`);
      continue;
    }
    root = root ?? hit.root;
    const n = hit.node;
    const mm = (attribute: string, claimed: unknown, source: unknown) => fc.mismatches.push({ attribute, claimed, source });
    const name = String(f.field_name ?? '').toUpperCase();
    if (!(n.name === name || (n.name === 'FILLER' && name.startsWith('FILLER')))) mm('field_name', f.field_name, n.name);
    if (typeof f.level === 'number' && f.level !== n.level) mm('level', f.level, n.level);
    if (n.pic) {
      if (f.pic && normPic(f.pic) !== normPic(n.pic)) mm('pic', f.pic, n.pic);
      if (f.usage && !['GROUP', 'UNKNOWN'].includes(f.usage) && !USAGE_EQ(f.usage, hit.usage)) mm('usage', f.usage, hit.usage);
      const allowed = javaTypesFor(n, hit.usage);
      if (f.java_type && allowed.length && !allowed.includes(f.java_type)) mm('java_type', f.java_type, allowed);
      if (f.java_type && !allowed.length) fc.notes.push(`no Java type is supported for PIC ${n.pic} USAGE ${hit.usage}`);
    }
    if (n.size === null) fc.notes.push(`size not determinable from the source (${[...n.flags].join('; ') || 'incomplete layout'})`);
    else if (typeof f.byte_length === 'number' && f.byte_length !== n.size) mm('byte_length', f.byte_length, n.size);
    const occ = n.occurs ? n.occurs.max : null;
    if ((f.occurs ?? null) !== occ && !(f.occurs === 1 && occ === null)) mm('occurs', f.occurs ?? null, occ);
    if (typeof f.offset === 'number' && n.offset !== null && n.size !== null && f.offset !== n.offset) mm('offset', f.offset, n.offset);
    fc.status = fc.mismatches.length ? 'contradicted' : fc.notes.some((x) => /not determinable|no Java type/.test(x)) ? 'indeterminate' : 'verified';
  }
  const rootRec = owner.dd.records.find((r) => r.root === root) ?? owner.dd.records.find((r) => r.root.name === String(rec.record_name ?? '').toUpperCase()) ?? null;
  const record = { claimed_total: rec.total_bytes ?? null, source_total: rootRec?.size ?? null, determinate: !!rootRec?.determinate, flags: rootRec?.flags ?? [] };
  const statuses: VStatus[] = fields.map((f) => (f.status === 'verified' ? 'VERIFIED_DETERMINISTICALLY' : f.status === 'contradicted' ? 'CONTRADICTED_BY_SOURCE' : 'INSUFFICIENT_EVIDENCE'));
  if (record.claimed_total !== null && record.source_total !== null && record.claimed_total !== record.source_total) statuses.push('CONTRADICTED_BY_SOURCE');
  if (rootRec && rootRec.flags.some((x) => /could not be resolved|circular/.test(x))) statuses.push('EXTERNAL_DEPENDENCY_MISSING');
  return { status: statuses.length ? worstStatus(statuses) : 'INSUFFICIENT_EVIDENCE', fields, record, source: owner.rel };
}

/* ------------------------------------------------------------------ */
/* per root cause                                                      */
/* ------------------------------------------------------------------ */

function refCheck(snap: Snapshot, reader: SourceReader, ref: any, subject: string): Check | null {
  if (!ref?.file_id) return null;
  const src = reader.byFileId(ref.file_id);
  if (!src) return { id: 'source_reference', subject, status: reader.available ? 'EXTERNAL_DEPENDENCY_MISSING' : 'INSUFFICIENT_EVIDENCE', detail: `source of ${ref.file_id} is ${reader.available ? 'missing from the checkout' : 'not configured'}` };
  if (ref.statement_id) {
    const st = snap.ctx.statements.get(ref.statement_id);
    if (!st) {
      // A missing statement contradicts the citation only when the parser structure covers that file at all.
      const parsed = [...snap.ctx.statements.values()].some((x) => x.file_id === ref.file_id);
      return { id: 'source_reference', subject, status: parsed ? 'CONTRADICTED_BY_SOURCE' : 'INSUFFICIENT_EVIDENCE', detail: parsed ? `${ref.statement_id} is not in the parser structure of ${src.rel}` : `the parser structure has no statements for ${src.rel}; ${ref.statement_id} cannot be checked` };
    }
    const kw = String(st.statement_type ?? '').split(/\s+/)[0].toUpperCase();
    const ok = rangeText(src.file, st.start_line, st.end_line ?? st.start_line).toUpperCase().includes(kw);
    return { id: 'source_reference', subject, status: ok ? 'VERIFIED_STRUCTURALLY' : 'CONTRADICTED_BY_SOURCE', detail: ok ? `${ref.statement_id} (${st.statement_type}) is at ${src.rel}:${st.start_line}` : `${ref.statement_id} (${st.statement_type}) not found at ${src.rel}:${st.start_line}` };
  }
  if (typeof ref.line === 'number') {
    const ok = ref.line >= 1 && ref.line <= src.file.lines.length;
    return { id: 'source_reference', subject, status: ok ? 'VERIFIED_STRUCTURALLY' : 'CONTRADICTED_BY_SOURCE', detail: ok ? `${src.rel}:${ref.line} exists` : `${src.rel} has no line ${ref.line}` };
  }
  return { id: 'source_reference', subject, status: 'VERIFIED_STRUCTURALLY', detail: `${src.rel} exists (sha256 ${String(src.sha256).slice(0, 12)}…)` };
}

const DECLARED_KEYWORDS = new Set('IF ELSE END-IF MOVE TO FROM BY INTO GIVING ADD SUBTRACT MULTIPLY DIVIDE COMPUTE PERFORM UNTIL VARYING THRU THROUGH TIMES EVALUATE WHEN OTHER END-EVALUATE AND OR NOT EQUAL GREATER LESS THAN ZERO ZEROS ZEROES SPACE SPACES TRUE FALSE SET CALL USING DISPLAY ACCEPT READ WRITE REWRITE DELETE OPEN CLOSE INPUT OUTPUT I-O EXTEND AT END NOT-AT INVALID KEY GO GOBACK EXIT STOP RUN EXEC SQL END-EXEC CONTINUE INITIALIZE STRING UNSTRING DELIMITED SIZE INSPECT REPLACING TALLYING ALL OF IN IS ARE WITH RETURN-CODE SQLCODE SQLSTATE HIGH-VALUES LOW-VALUES NEXT RECORD FUNCTION CURRENT-DATE LENGTH ADDRESS VALUE VALUES'.split(' '));

function declaredNames(src: { dd: DataDivision; pf: ProcedureFacts }): Set<string> {
  const s = new Set<string>();
  const walk = (n: LayoutNode) => {
    s.add(n.name);
    n.conditions.forEach((c) => s.add(c.name));
    n.children.forEach(walk);
  };
  src.dd.records.forEach((r) => walk(r.root));
  src.dd.fds.forEach((f) => s.add(f.name));
  src.pf.paragraphs.forEach((p) => s.add(p.name));
  return s;
}

export function runDeterministic(snap: Snapshot, reg: Registry, previous: any | null): any {
  const reader = new SourceReader(snap);
  const results: RootResult[] = [];
  const programFacts: Record<string, any> = {};
  const factsFor = (prog: string) => {
    if (programFacts[prog] !== undefined) return programFacts[prog];
    const src = reader.byProgram(prog);
    programFacts[prog] = src
      ? {
          source: src.rel,
          sha256: src.sha256,
          fd_record_lengths: fdLengthFindings(src.dd).filter((x) => x.consistent !== true),
          io_mode_conflicts: src.pf.io_mode_conflicts,
          missing_perform_or_goto_targets: src.pf.missing_targets,
          unreferenced_paragraphs: src.pf.unreferenced_paragraphs,
          sql_commit_rollback: src.pf.sql.filter((x) => /COMMIT|ROLLBACK/.test(x.kind)).map((x) => ({ line: x.line, kind: x.kind })),
          unresolved_includes: src.dd.includes.filter((i) => !i.resolved).map((i) => ({ name: i.name, line: i.line, circular: i.circular })),
          indeterminate_records: src.dd.records.filter((r) => !r.determinate).map((r) => ({ record: r.root.name, why: r.flags.slice(0, 2) })),
        }
      : null;
    return programFacts[prog];
  };
  const itemsOf = (r: RootCause) => r.related.findings.map((k) => k.split('|')).filter(([kind]) => ITEM_KINDS.includes(kind)).map(([kind, id]) => snap.items.find((x) => x.kind === kind && x.id === id)).filter(Boolean) as Item[];
  const rawGap = (id: string) => ((snap.set.artifacts.gaps?.data?.gaps ?? []) as any[]).find((g) => g.gap_id === id);

  for (const r of reg.roots) {
    const checks: Check[] = [];
    reader.touched = new Set<string>();
    const [type, rest] = [r.key.split(':')[0], r.key.slice(r.key.indexOf(':') + 1)];
    let next: NextStep = ['unsupported_business_interpretation', 'contradictory_business_rules', 'program_scope_uncertainty'].includes(r.category) ? 'REQUIRES_BUSINESS_SME' : 'REQUIRES_TECHNICAL_SME';
    let establishes = '';
    let notEstablished = 'business intent, and behaviour beyond the cited source text';
    if (!reader.available && type !== 'APPROVAL' && type !== 'PACKET' && type !== 'COVERAGE' && type !== 'CONSOLIDATION') {
      results.push({ root_cause_id: r.root_cause_id, key: r.key, category: r.category, executed: false, checks: [{ id: 'source_root', subject: r.key, status: 'INSUFFICIENT_EVIDENCE', detail: 'the original COBOL source root is not configured: no deterministic check was executed' }], status: 'INSUFFICIENT_EVIDENCE', next_step: next, establishes: 'nothing (source unavailable)', does_not_establish: 'anything about the source', source_files: [] });
      continue;
    }
    switch (type) {
      case 'DEP': {
        const member = resolveMember(reader.idx, rest);
        for (const e of snap.sys.unresolved_edges.filter((x) => x.to === rest)) {
          const src = reader.byProgram(e.from);
          const line = e.line && src ? src.file.lines[e.line - 1] ?? '' : '';
          checks.push({ id: 'reference_in_source', subject: `${e.from}:${e.line}`, status: src && new RegExp(`\\b${rest}\\b`, 'i').test(line) ? 'VERIFIED_STRUCTURALLY' : 'INSUFFICIENT_EVIDENCE', detail: src ? `${src.rel}:${e.line}: ${line.trim()}` : `${e.from} source not available` });
        }
        checks.push(member ? { id: 'member_in_checkout', subject: rest, status: 'VERIFIED_STRUCTURALLY', detail: `${reader.rel(member)} exists in the checkout although the inventory left the edge unresolved` } : { id: 'member_in_checkout', subject: rest, status: 'EXTERNAL_DEPENDENCY_MISSING', detail: `no member named ${rest} (any extension) exists anywhere in the source checkout (${reader.idx.files.size} member names indexed)` });
        establishes = member ? 'the member exists in the checkout' : `the reference exists and ${rest} is absent from the provided source`;
        notEstablished = 'whether the member is supplied by a load library, the platform or a vendor at run time';
        next = member ? 'REQUIRES_TECHNICAL_SME' : 'REQUIRES_SOURCE';
        break;
      }
      case 'GAP': {
        const g = rawGap(rest);
        const prog = g?.source_program ?? null;
        const src = prog ? reader.byProgram(prog) ?? (snap.sys.copybooks.find((c) => c.name === prog) ? reader.byFileId(snap.sys.copybooks.find((c) => c.name === prog)!.file_id) : null) : null;
        if (g?.gap_type === 'EMPTY_SOURCE') {
          const p = snap.sys.programs.find((x) => x.program_id === prog);
          const s = p ? reader.byFileId(p.file_id) : null;
          checks.push(s ? { id: 'source_content', subject: prog, status: s.codeLines === 0 ? 'EXTERNAL_DEPENDENCY_MISSING' : 'CONTRADICTED_BY_SOURCE', detail: `${s.rel}: ${s.bytes} byte(s), ${s.codeLines} code line(s)` } : { id: 'source_content', subject: prog, status: 'EXTERNAL_DEPENDENCY_MISSING', detail: 'source file absent' });
          establishes = 'the delivered source contains no program text';
          next = 'REQUIRES_SOURCE';
        } else if (g?.gap_type === 'CIRCULAR_COPY') {
          const self = src?.dd.includes.find((i) => i.name === prog) ?? null;
          checks.push(src ? { id: 'self_inclusion', subject: prog, status: self ? 'VERIFIED_DETERMINISTICALLY' : 'CONTRADICTED_BY_SOURCE', detail: self ? `${src.rel}:${self.line} includes ${prog} itself` : `${src.rel} does not include itself` } : { id: 'self_inclusion', subject: prog, status: 'EXTERNAL_DEPENDENCY_MISSING', detail: 'member not available' });
          establishes = 'the member includes itself, so its layout cannot be expanded from the repository';
          notEstablished = 'which communication area the precompiler actually supplies';
        } else if (src && typeof g?.source_line === 'number') {
          const ctx = contextFor(src.pf, g.source_line);
          checks.push({ id: 'location', subject: `${prog}:${g.source_line}`, status: g.source_line <= src.file.lines.length ? 'VERIFIED_STRUCTURALLY' : 'CONTRADICTED_BY_SOURCE', detail: `${src.rel}:${g.source_line} in paragraph ${ctx.paragraph ?? '(none)'}`, evidence: { excerpt: excerpt(src.file, g.source_line - 2, g.source_line + 2) } });
          if (['UNDECLARED_DATA_NAME', 'INVALID_QUALIFICATION', 'AMBIGUOUS_DATA_REFERENCE'].includes(g.gap_type)) {
            const names = declaredNames(src);
            const tokens = (rangeText(src.file, g.source_line, g.source_line).toUpperCase().match(/[A-Z][A-Z0-9-]*[A-Z0-9]/g) ?? []).filter((t) => !DECLARED_KEYWORDS.has(t) && t.includes('-') || /^[A-Z]+\d+$/.test(t));
            const undeclared = tokens.filter((t) => !names.has(t));
            checks.push({ id: 'data_names_declared', subject: `${prog}:${g.source_line}`, status: undeclared.length ? 'VERIFIED_DETERMINISTICALLY' : 'INSUFFICIENT_EVIDENCE', detail: undeclared.length ? `not declared in the program or its resolvable copybooks: ${[...new Set(undeclared)].join(', ')}` : 'every data name on the line is declared; the gap concerns qualification or meaning' });
            establishes = undeclared.length ? 'which referenced names have no declaration in the available source' : 'the names are declared';
          } else {
            const missing = src.pf.missing_targets;
            checks.push({ id: 'control_flow_targets', subject: prog, status: missing.length ? 'VERIFIED_DETERMINISTICALLY' : 'VERIFIED_STRUCTURALLY', detail: missing.length ? `PERFORM/GO TO targets with no procedure paragraph: ${missing.map((m) => `${m.target}@${m.line}${m.defined_in_member_copied_into_data_division ? ` (in ${m.defined_in_member_copied_into_data_division.member}, copied into the DATA DIVISION)` : ''}`).join(', ')}` : 'every PERFORM/GO TO target exists', evidence: { paragraph: ctx.paragraph, performed_from: ctx.performed_from, until: src.pf.performs.filter((p) => p.line >= ctx.from && p.line <= ctx.to && p.until).map((p) => ({ line: p.line, until: p.until })) } });
            establishes = missing.length ? 'which control-flow targets are absent' : 'the cited location and its control-flow context';
            if (['SUSPECTED_LOGIC_DEFECT', 'UNSTRUCTURED_FLOW', 'RECURSIVE_PERFORM'].includes(g.gap_type)) next = 'REQUIRES_INDEPENDENT_SEMANTIC_REVIEW';
          }
        } else checks.push({ id: 'location', subject: r.key, status: 'INSUFFICIENT_EVIDENCE', detail: g ? 'the gap names no locatable program line' : 'gap not in the reverse register' });
        break;
      }
      case 'CIT': {
        const it = snap.itemById.get(rest);
        for (const a of it ? analyseCitation(snap, reader, it) : []) checks.push({ id: 'citation', subject: `${a.item} ref ${a.ref_index}`, status: a.status, detail: `${a.reasons.join('; ')}${a.proposed ? ` -> propose ${a.proposed.field}=${a.proposed.value}${a.claim_supported_after_correction === false ? ' (not every stated value occurs there)' : ''}` : ''}`, evidence: a });
        establishes = 'whether the cited statement or the cited line is wrong, from the stated values';
        notEstablished = 'that the requirement is correct once the citation is fixed';
        next = checks.some((c) => c.status === 'SOURCE_CITATION_CORRECTED') ? 'REQUIRES_PROPOSAL_REVIEW' : 'REQUIRES_INDEPENDENT_SEMANTIC_REVIEW';
        break;
      }
      case 'CONTRA':
      case 'XBATCH': {
        const rules = type === 'CONTRA' ? rest.split('+') : r.related.rules;
        const valueSets: Array<{ rule: string; field: string; values: string[]; source: string }> = [];
        const condNames = new Set<string>();
        for (const id of rules) {
          const rule = snap.rules.get(id);
          const ids = rule?.primary_source?.source_ids ?? {};
          const chk = refCheck(snap, reader, { file_id: ids.file_id, statement_id: ids.statement_id ?? null, line: rule?.primary_source?.line ?? null }, id);
          if (chk) checks.push(chk);
          const src = reader.byFileId(ids.file_id);
          if (!src) continue;
          const conds = conditionIndex(src.dd);
          const st = ids.statement_id ? snap.ctx.statements.get(ids.statement_id) : null;
          const line: number | null = st?.start_line ?? rule?.primary_source?.line ?? null;
          if (line === null) continue;
          // The rule's line is a data entry (or its 88) in a copybook, or a statement naming condition-names.
          const atLine = [...conds.values()].filter((c) => c.line === line || c.field_line === line);
          const named = (rangeText(src.file, line, st?.end_line ?? line).toUpperCase().match(/[A-Z][A-Z0-9-]*/g) ?? []).flatMap((t) => [...conds.values()].filter((c) => c.name === t || c.field === t));
          for (const c of [...new Set([...atLine, ...named])]) {
            condNames.add(c.name);
            condNames.add(c.field);
            valueSets.push({ rule: id, field: c.field, values: c.values, source: `${src.rel}:${c.line} (${c.name})` });
          }
        }
        if (valueSets.length) checks.push({ id: 'declared_values', subject: rules.join(', '), status: 'VERIFIED_DETERMINISTICALLY', detail: valueSets.map((v) => `${v.rule}: ${v.field} ${v.values.join(',')} (${v.source})`).join('; '), evidence: valueSets });
        if (condNames.size) {
          const refs: Array<{ program: string; line: number; verb: string }> = [];
          for (const p of snap.sys.programs) {
            const s = reader.byProgram(p.program_id);
            for (const st of s?.pf.statements ?? []) for (const n of condNames) if (new RegExp(`\\b${n}\\b`).test(st.text)) refs.push({ program: p.program_id, line: st.line, verb: st.verb });
          }
          const tests = refs.filter((x) => ['IF', 'EVALUATE', 'WHEN', 'PERFORM'].includes(x.verb));
          checks.push({ id: 'procedure_references', subject: [...condNames].join(', '), status: 'VERIFIED_DETERMINISTICALLY', detail: `${refs.length} procedure statement(s) reference these names; ${tests.length} test them (IF/EVALUATE/WHEN/PERFORM UNTIL)`, evidence: refs.slice(0, 50) });
        }
        establishes = 'the declared value domains and where (and whether) the code tests them';
        notEstablished = 'which domain or disposition the business intends';
        next = 'REQUIRES_BUSINESS_SME';
        break;
      }
      case 'SCOPE': {
        const p = snap.sys.programs.find((x) => x.program_id === rest);
        const c = snap.classification.find((x) => x.program_id === rest);
        const src = reader.byProgram(rest);
        checks.push({ id: 'program_facts', subject: rest, status: src ? 'VERIFIED_STRUCTURALLY' : 'EXTERNAL_DEPENDENCY_MISSING', detail: `${src ? `${src.rel} (${src.codeLines} code lines)` : 'source absent'}; run by JCL: ${p?.jcl_jobs.map((j) => j.job_name).join(', ') || 'none'}; called by: ${p?.called_by.map((e) => e.from).join(', ') || 'none'}; classification ${c?.class} (${c?.confidence}): ${c?.scope_reason ?? ''}` });
        establishes = 'how the program is invoked and what its classification rests on';
        notEstablished = 'whether the business wants it modernised';
        next = 'REQUIRES_BUSINESS_SME';
        break;
      }
      case 'APPROVAL':
        checks.push({ id: 'trust_and_approval', subject: rest, status: 'INSUFFICIENT_EVIDENCE', detail: rest === 'TRUST_ANCHOR' ? `trust store: ${snap.trust.problems.join('; ') || 'usable'}` : 'no signed approval can exist before the scope is READY and a trust anchor exists' });
        establishes = 'the approval prerequisite is unmet';
        notEstablished = '-';
        next = 'REQUIRES_APPROVAL';
        break;
      case 'PACKET': {
        const pk = snap.packets.find((x) => x.packet_id === rest);
        const rec = snap.packetStatus?.superseded.has(rest);
        checks.push({ id: 'packet_status', subject: rest, status: pk?.status === 'superseded' && rec ? 'NOT_APPLICABLE_WITH_EVIDENCE' : 'INSUFFICIENT_EVIDENCE', detail: pk ? pk.justification : 'packet has a receipt' });
        establishes = 'packet completion from runtime records';
        next = 'REQUIRES_TECHNICAL_SME';
        break;
      }
      default: {
        // EVID, LAYOUT, RULE, INTERP, DEC, COVERAGE, CONSOLIDATION
        const items = itemsOf(r);
        for (const it of items) {
          if (it.kind === 'data_record') {
            const res = checkRecord(snap, reader, it.data.record);
            const bad = res.fields.filter((f) => f.status === 'contradicted');
            const ind = res.fields.filter((f) => f.status === 'indeterminate');
            checks.push({ id: 'record_layout', subject: it.id, status: res.status, detail: `${res.fields.length} field(s): ${res.fields.length - bad.length - ind.length} match the source, ${bad.length} contradicted${bad.length ? ` (${bad.slice(0, 3).map((f) => `${f.field_name}: ${f.mismatches.map((m) => `${m.attribute} ${JSON.stringify(m.claimed)} vs ${JSON.stringify(m.source)}`).join(', ')}`).join('; ')})` : ''}, ${ind.length} indeterminate; record bytes claimed ${res.record.claimed_total} vs source ${res.record.source_total}${res.record.flags.length ? ` [${res.record.flags.slice(0, 2).join('; ')}]` : ''}`, evidence: res });
          } else if (it.kind === 'file_operations') {
            const src = reader.byFileId(it.units[0]?.file_id);
            checks.push({ id: 'file_operations', subject: it.id, status: src ? (src.pf.io_mode_conflicts.length ? 'VERIFIED_DETERMINISTICALLY' : 'VERIFIED_STRUCTURALLY') : 'EXTERNAL_DEPENDENCY_MISSING', detail: src ? `OPEN modes ${JSON.stringify(src.pf.opens.map((o) => `${o.file}:${o.mode}@${o.line}`))}; I/O ${src.pf.io.length}; mode conflicts ${JSON.stringify(src.pf.io_mode_conflicts)}` : 'source absent' });
          } else {
            const refs = it.source_refs.map((ref: any) => refCheck(snap, reader, ref, it.id)).filter(Boolean) as Check[];
            checks.push(...refs);
            const lits = claimLiterals(itemText(it)).map((l) => l.toUpperCase());
            const texts = it.source_refs.map((ref: any) => {
              const st = ref.statement_id ? snap.ctx.statements.get(ref.statement_id) : null;
              const s = reader.byFileId(ref.file_id);
              return s && st ? rangeText(s.file, st.start_line, st.end_line ?? st.start_line).toUpperCase() : '';
            });
            if (lits.length) {
              const found = lits.filter((l) => texts.some((t) => t.includes(l)));
              checks.push({ id: 'stated_values', subject: it.id, status: found.length === lits.length && refs.every((x) => x.status === 'VERIFIED_STRUCTURALLY') ? 'VERIFIED_STRUCTURALLY' : 'INSUFFICIENT_EVIDENCE', detail: `${found.length}/${lits.length} stated value(s) occur in the cited statements${found.length < lits.length ? `; missing: ${lits.filter((l) => !found.includes(l)).join(', ')}` : ''}` });
            }
          }
        }
        // Decisions without items: check the cited source and attach unit facts.
        for (const id of r.related.primary_decisions.slice(0, 20)) {
          const d = snap.register.get(id);
          if (!d || d.origin.type === 'derived') continue;
          for (const ref of d.source_refs.slice(0, 5)) {
            const chk = refCheck(snap, reader, ref, id);
            if (chk) checks.push(chk);
          }
        }
        if (type === 'RULE') {
          const rule = snap.rules.get(rest);
          const ids = rule?.primary_source?.source_ids ?? {};
          const chk = refCheck(snap, reader, { file_id: ids.file_id, statement_id: ids.statement_id ?? null }, rest);
          if (chk) checks.push(chk);
        }
        if (!checks.length) checks.push({ id: 'no_source_check', subject: r.key, status: 'INSUFFICIENT_EVIDENCE', detail: type === 'COVERAGE' || type === 'CONSOLIDATION' ? 'a runtime-record problem, not a source question' : 'nothing in the root cause cites checkable source' });
        const allStructural = checks.every((c) => c.status === 'VERIFIED_STRUCTURALLY');
        establishes = items.some((i) => i.kind === 'data_record') ? 'field PIC/USAGE/size/offset/OCCURS, Java type compatibility and record size from the source text' : allStructural ? 'the cited source exists with the stated statements and values' : 'which cited facts the source supports';
        if (type === 'EVID' && items.every((i) => i.kind === 'data_record')) next = 'REQUIRES_TECHNICAL_SME';
        else if (['EVID', 'RULE', 'INTERP'].includes(type) && !checks.some((c) => c.status === 'CONTRADICTED_BY_SOURCE')) next = 'REQUIRES_INDEPENDENT_SEMANTIC_REVIEW';
        else if (checks.some((c) => c.status === 'CONTRADICTED_BY_SOURCE') && items.some((i) => i.kind === 'data_record')) next = 'REQUIRES_PROPOSAL_REVIEW';
      }
    }
    // Program facts bear on every data-layout, runtime and control-flow root, whatever its key.
    if (['data_layout_inconsistency', 'runtime_behavior_uncertainty', 'control_flow_uncertainty'].includes(r.category)) {
      for (const prog of r.source.programs.slice(0, 10)) {
        const f = factsFor(prog);
        if (!f) continue;
        if (f.fd_record_lengths.length) checks.push({ id: 'fd_record_length', subject: prog, status: 'VERIFIED_DETERMINISTICALLY', detail: f.fd_record_lengths.map((x: any) => `FD ${x.fd} RECORD CONTAINS ${x.declared.min}${x.declared.max ? `-${x.declared.max}` : ''} vs ${x.records.map((y: any) => `${y.name}=${y.size ?? '?'}`).join(', ')}`).join('; '), evidence: f.fd_record_lengths });
        if (f.io_mode_conflicts.length) checks.push({ id: 'open_mode_vs_io', subject: prog, status: 'VERIFIED_DETERMINISTICALLY', detail: f.io_mode_conflicts.map((x: any) => `${x.verb} ${x.file} at line ${x.line} but opened only ${x.opened_as.join('/')}`).join('; '), evidence: f.io_mode_conflicts });
        if (f.missing_perform_or_goto_targets.length) checks.push({ id: 'missing_targets', subject: prog, status: 'VERIFIED_DETERMINISTICALLY', detail: f.missing_perform_or_goto_targets.map((x: any) => `${x.via} ${x.target}@${x.line}${x.defined_in_member_copied_into_data_division ? ` (defined in ${x.defined_in_member_copied_into_data_division.member}, copied into the DATA DIVISION at line ${x.defined_in_member_copied_into_data_division.copy_line})` : ''}`).join(', ') });
      }
    }
    const files = [...reader.touched].sort().map((p) => ({ path: p, sha256: reader.accessed.get(p) ?? null }));
    reader.touched = null;
    results.push({ root_cause_id: r.root_cause_id, key: r.key, category: r.category, executed: true, checks, status: worstStatus(checks.map((c) => c.status)), next_step: next, establishes, does_not_establish: notEstablished, source_files: files });
  }

  // Structural verification of every program and copybook file, and change detection.
  const structure: any[] = [];
  for (const p of snap.sys.programs) {
    const s = reader.byFileId(p.file_id);
    const stmts = [...snap.ctx.statements.values()].filter((x) => x.file_id === p.file_id);
    const bad = s ? stmts.filter((x) => !rangeText(s.file, x.start_line, x.end_line ?? x.start_line).toUpperCase().includes(String(x.statement_type ?? '').split(/\s+/)[0].toUpperCase())) : [];
    const paras = [...snap.ctx.paragraphs.values()].filter((x) => x.file_id === p.file_id);
    // '(UNNAMED)' is the parser's label for statements before the first paragraph, not a source name.
    const badParas = s ? paras.filter((x) => !/^\(.*\)$/.test(String(x.name ?? '')) && !(rangeText(s.file, x.start_line, x.start_line).toUpperCase().includes(String(x.name ?? x.paragraph_name ?? '').toUpperCase()))) : [];
    structure.push({ program: p.program_id, file_id: p.file_id, source: s?.rel ?? null, sha256: s?.sha256 ?? null, bytes: s?.bytes ?? null, statements: stmts.length, statements_not_at_cited_lines: bad.map((x) => x.statement_id).slice(0, 20), statement_mismatches: bad.length, paragraphs: paras.length, paragraph_mismatches: badParas.length, includes: s?.dd.includes.map((i) => ({ name: i.name, resolved: i.resolved, circular: i.circular })) ?? [], calls: s?.pf.calls.map((x) => ({ target: x.target, dynamic: x.dynamic, known: snap.sys.programs.some((q) => q.program_id === x.target) || !!resolveMember(reader.idx, x.target) })) ?? [], status: !s ? 'EXTERNAL_DEPENDENCY_MISSING' : bad.length || badParas.length ? 'CONTRADICTED_BY_SOURCE' : 'VERIFIED_STRUCTURALLY' });
    factsFor(p.program_id);
  }
  for (const c of snap.sys.copybooks) if (c.file_id) reader.byFileId(c.file_id);
  const hashes = Object.fromEntries([...reader.accessed.entries()].sort());
  const prev: Record<string, string | null> = previous?.source_files ?? {};
  const changed = Object.keys(hashes).filter((k) => k in prev && prev[k] !== hashes[k]);
  const tally = (xs: RootResult[], f: (r: RootResult) => string) => xs.reduce((m: Record<string, number>, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
  return {
    contract: 'deterministic-verification',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: snap.wf.run.manifestSha256,
    source_root: { configured: reader.available, origin: snap.wf.run.ctx.sourceRootOrigin, files_indexed: [...reader.idx.files.values()].reduce((n, x) => n + x.length, 0), access: 'read-only' },
    source_files: hashes,
    changed_since_previous: { previous_record: previous?.record_id ?? null, changed },
    statuses: {
      VERIFIED_STRUCTURALLY: 'the cited source exists with the stated statement, keyword or values; behaviour and meaning are not proven',
      VERIFIED_DETERMINISTICALLY: 'a fact computed from the source text (sizes, PIC/USAGE/offsets, OPEN modes vs I/O, missing targets, reference counts)',
      SOURCE_CITATION_CORRECTED: 'the source identifies the correct citation; recorded as a proposal, not applied',
      CONTRADICTED_BY_SOURCE: 'the source disagrees with the claim',
      EXTERNAL_DEPENDENCY_MISSING: 'a member, program or source text needed is absent',
      INSUFFICIENT_EVIDENCE: 'the source cannot settle the question',
      NOT_APPLICABLE_WITH_EVIDENCE: 'the check does not apply, with recorded evidence',
    },
    summary: { roots: results.length, executed: results.filter((r) => r.executed).length, by_status: tally(results, (r) => r.status), by_next_step: tally(results, (r) => r.next_step), programs_structurally_verified: structure.filter((s) => s.status === 'VERIFIED_STRUCTURALLY').length, programs: structure.length },
    program_structure: structure,
    program_facts: programFacts,
    results,
  };
}
