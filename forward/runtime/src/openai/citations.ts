/**
 * Independent validation of every model citation against the original
 * source, read locally and read-only. A citation is VERIFIED only when:
 *   - its path is one of the files supplied in the packet and resolves
 *     inside the configured source root (no traversal, no symlink escape);
 *   - the file's SHA-256 still equals the packet's (no stale evidence);
 *   - its one-based line range exists and lies within the supplied excerpt;
 *   - its quoted text occurs in those lines (fixed-format columns removed,
 *     whitespace normalised, continuation lines joined);
 *   - any permanent ID exists in the reverse identity mapping, belongs to the
 *     cited file and overlaps the cited lines.
 * Findings are then checked for the operation kind they claim and for the
 * data names they use. A verified citation proves that the evidence exists,
 * not that the interpretation is right: semantic status stays advisory.
 */
import * as fs from 'fs';
import { codeText } from '../../../verification/src/cobol-source';
import { sha256File } from '../core/fsutil';
import { Snapshot } from '../approval/snapshot';
import { SourceReader } from '../blockers/deterministic';
import { LayoutNode } from '../../../verification/src/layout';
import { safeSourcePath } from './authorization';

export interface CitationCheck {
  citation: any;
  status: 'VERIFIED' | 'REJECTED';
  reasons: string[];
}

const norm = (s: string) => String(s ?? '').toUpperCase().replace(/\s+/g, ' ').trim();

const KIND_VERBS: Record<string, RegExp> = {
  arithmetic: /\b(ADD|SUBTRACT|MULTIPLY|DIVIDE|COMPUTE)\b/,
  condition: /\b(IF|EVALUATE|WHEN|UNTIL)\b/,
  control_transfer: /\b(PERFORM|GO\s+TO|GOBACK|STOP\s+RUN|EXIT|CALL)\b/,
  file_io: /\b(OPEN|CLOSE|READ|WRITE|REWRITE|DELETE|START)\b/,
  database: /\bEXEC\s+SQL\b/,
  call: /\bCALL\b/,
  data_movement: /\b(MOVE|SET|INITIALIZE|STRING|UNSTRING|ACCEPT)\b/,
};

export class CitationValidator {
  private files = new Map<string, { abs: string; sha256: string | null; lines: string[] } | null>();
  private names = new Map<string, Set<string>>();
  constructor(
    private readonly snap: Snapshot,
    private readonly packet: any,
    private readonly reader = new SourceReader(snap),
  ) {}

  private file(path: string) {
    if (!this.files.has(path)) {
      const abs = safeSourcePath(this.snap.wf.run.ctx, path);
      this.files.set(path, abs ? { abs, sha256: sha256File(abs), lines: fs.readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n').split('\n') } : null);
    }
    return this.files.get(path)!;
  }

  /** Data names declared in a supplied file (with its resolvable copybooks). */
  declared(path: string): Set<string> {
    if (this.names.has(path)) return this.names.get(path)!;
    const s = new Set<string>();
    const f = this.file(path);
    const parsed = f ? this.reader.byPath(f.abs) : null;
    const walk = (n: LayoutNode) => {
      s.add(n.name);
      n.conditions.forEach((c) => s.add(c.name));
      n.children.forEach(walk);
    };
    parsed?.dd.records.forEach((r) => walk(r.root));
    parsed?.dd.fds.forEach((fd) => s.add(fd.name));
    parsed?.pf.paragraphs.forEach((p) => s.add(p.name));
    for (const d of this.packet.definitions ?? []) if (d.file === path) {
      s.add(String(d.name).toUpperCase());
      for (const c of d.condition_names ?? []) s.add(String(c.name).toUpperCase());
    }
    this.names.set(path, s);
    return s;
  }

  citedText(c: any): string {
    const f = this.file(c.path);
    if (!f) return '';
    return f.lines.slice(c.line_start - 1, c.line_end).map((l) => codeText(l) ?? '').join(' ');
  }

  check(c: any): CitationCheck {
    const reasons: string[] = [];
    // A packet may supply several excerpt ranges of the same file: the supplied lines are their union.
    const ranges = (this.packet.sources ?? []).filter((s: any) => s.path === c?.path && s.available);
    const src = ranges.length ? { sha256: ranges[0].sha256, excerpt: ranges.flatMap((s: any) => s.excerpt ?? []) } : null;
    if (!src) return { citation: c, status: 'REJECTED', reasons: [`${c?.path} was not supplied to the verifier (no file outside the packet is ever read)`] };
    if (ranges.some((s: any) => s.sha256 !== src.sha256)) return { citation: c, status: 'REJECTED', reasons: [`${c.path} was supplied with inconsistent hashes`] };
    const f = this.file(c.path);
    if (!f) return { citation: c, status: 'REJECTED', reasons: [`${c.path} is outside the configured source root or missing`] };
    if (f.sha256 !== src.sha256) reasons.push(`stale source: ${c.path} hash is now ${String(f.sha256).slice(0, 12)}…, the packet was built on ${String(src.sha256).slice(0, 12)}…`);
    const a = Number(c.line_start);
    const b = Number(c.line_end);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 1 || b < a || b > f.lines.length) reasons.push(`lines ${c.line_start}-${c.line_end} do not exist in ${c.path} (${f.lines.length} lines)`);
    else {
      const supplied = new Set((src.excerpt ?? []).map((l: any) => l.line));
      const outside = [];
      for (let n = a; n <= b; n++) if (!supplied.has(n)) outside.push(n);
      if (outside.length) reasons.push(`lines ${outside.slice(0, 5).join(', ')} were not in the supplied excerpt`);
      const q = norm(c.quoted_text);
      if (!q) reasons.push('empty quoted_text');
      else if (!norm(this.citedText(c)).includes(q)) reasons.push(`quoted_text does not occur in ${c.path}:${a}-${b}`);
    }
    if (c.permanent_id !== null && c.permanent_id !== undefined) {
      const id = String(c.permanent_id);
      const st = this.snap.ctx.statements.get(id) ?? this.snap.ctx.paragraphs.get(id);
      const li = this.snap.ctx.layoutItems.get(id);
      const fileOf = st?.file_id ?? li?.file_id ?? null;
      const rel = fileOf ? this.snap.ctx.relByFile.get(fileOf) : null;
      if (!st && !li) reasons.push(`permanent ID ${id} does not exist in the reverse identity mapping (fabricated)`);
      else if (rel !== c.path) reasons.push(`permanent ID ${id} belongs to ${rel}, not ${c.path}`);
      else if (st && ((st.end_line ?? st.start_line) < a || st.start_line > b)) reasons.push(`permanent ID ${id} (lines ${st.start_line}-${st.end_line}) does not overlap the cited lines`);
      else if (li && li.line !== null && (li.line < a || li.line > b)) reasons.push(`permanent ID ${id} (line ${li.line}) is not within the cited lines`);
    }
    return { citation: c, status: reasons.length ? 'REJECTED' : 'VERIFIED', reasons };
  }

  /** Checks a Pass A operation: its citations, the claimed operation kind and the data names it uses. */
  checkOperation(op: any): { citations: CitationCheck[]; reasons: string[]; ok: boolean } {
    const citations = (op.citations ?? []).map((c: any) => this.check(c));
    const reasons: string[] = [];
    if (!citations.length) reasons.push('operation has no citation');
    if (citations.some((c: CitationCheck) => c.status === 'REJECTED')) reasons.push('one or more citations rejected');
    const verified = citations.filter((c: CitationCheck) => c.status === 'VERIFIED');
    const text = norm(verified.map((c: CitationCheck) => this.citedText(c.citation)).join(' '));
    const re = KIND_VERBS[op.kind];
    if (re && verified.length && !re.test(text)) reasons.push(`claimed ${op.kind} operation is not present in the cited lines`);
    if (op.calculation && verified.length && !KIND_VERBS.arithmetic.test(text)) reasons.push('a calculation is claimed but the cited lines contain no arithmetic statement');
    const paths = [...new Set(verified.map((c: CitationCheck) => c.citation.path))];
    for (const name of [...(op.data_read ?? []), ...(op.data_modified ?? [])]) {
      const n = norm(name);
      if (!n) continue;
      const known = paths.some((p) => this.declared(p as string).has(n)) || text.includes(n);
      if (!known) reasons.push(`data item ${name} is neither declared in the supplied source nor present in the cited lines`);
    }
    return { citations, reasons, ok: reasons.length === 0 };
  }

  /** A reported missing dependency must be referenced by the cited lines and absent from the supplied data, or listed in the packet's missing context. */
  checkDependency(dep: any): { citations: CitationCheck[]; reasons: string[]; ok: boolean } {
    const citations = (dep.citations ?? []).map((c: any) => this.check(c));
    const reasons: string[] = [];
    const n = norm(dep.name);
    const listed = (this.packet.missing_context ?? []).some((m: string) => norm(m).includes(n));
    const verified = citations.filter((c: CitationCheck) => c.status === 'VERIFIED');
    const referenced = verified.some((c: CitationCheck) => norm(this.citedText(c.citation)).includes(n));
    const supplied = (this.packet.sources ?? []).some((s: any) => this.declared(s.path).has(n)) || (this.packet.definitions ?? []).some((d: any) => norm(d.name) === n);
    if (!listed && !referenced) reasons.push(`dependency ${dep.name} is not referenced by the cited lines nor listed as missing context (invented)`);
    if (supplied) reasons.push(`dependency ${dep.name} is declared in the supplied data, so it is not missing`);
    if (citations.some((c: CitationCheck) => c.status === 'REJECTED')) reasons.push('one or more citations rejected');
    return { citations, reasons, ok: reasons.length === 0 };
  }
}
