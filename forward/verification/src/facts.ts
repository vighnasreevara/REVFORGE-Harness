/**
 * Deterministic procedure-division facts read from the original COBOL text:
 * paragraphs, OPEN modes, file I/O verbs, PERFORM/GO TO targets, CALL
 * targets, SQL COMMIT/ROLLBACK, conditions and arithmetic. These are
 * syntactic facts only: they establish what the source says, never what the
 * business intends, and reachability is reported as "not referenced", never
 * as proven dead code.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { codeText, SourceFile, sourceFile } from './cobol-source';
import { DataDivision } from './layout';

export interface SourceIndex {
  root: string | null;
  files: Map<string, string[]>; // upper-cased member name (no extension) -> absolute paths (sorted)
}

/** Read-only index of the source tree by member name (several files may share a name, e.g. a program and its JCL). */
export function indexSourceTree(root: string | null): SourceIndex {
  const files = new Map<string, string[]>();
  if (!root || !fs.existsSync(root)) return { root: null, files };
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const key = path.basename(e.name, path.extname(e.name)).toUpperCase();
        files.set(key, [...(files.get(key) ?? []), p].sort());
      }
    }
  };
  walk(root);
  return { root, files };
}

const COPY_EXT = ['.cpy', '.copy', '.cbl', '.cob', ''];

/** The file a COPY/INCLUDE member resolves to: copybook extensions first, never JCL or other members. */
export function resolveMember(idx: SourceIndex, member: string): string | null {
  const cands = idx.files.get(member.toUpperCase()) ?? [];
  for (const ext of COPY_EXT) {
    const hit = cands.find((p) => path.extname(p).toLowerCase() === ext);
    if (hit) return hit;
  }
  return null;
}

export function readSource(abs: string): { file: SourceFile; sha256: string; bytes: number } | null {
  if (!fs.existsSync(abs)) return null;
  const buf = fs.readFileSync(abs);
  return { file: sourceFile(abs, buf.toString('utf8')), sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
}

export interface Statement {
  line: number;
  end_line: number;
  verb: string;
  text: string;
}

export interface ProcedureFacts {
  procedure_start: number | null;
  paragraphs: Array<{ name: string; line: number; section: boolean; member?: string }>;
  statements: Statement[];
  opens: Array<{ file: string; mode: string; line: number }>;
  io: Array<{ verb: string; target: string; file: string | null; line: number }>;
  performs: Array<{ target: string; thru: string | null; line: number; until: string | null }>;
  gotos: Array<{ target: string; line: number }>;
  calls: Array<{ target: string; dynamic: boolean; line: number }>;
  sql: Array<{ kind: string; line: number; text: string }>;
  missing_targets: Array<{ target: string; line: number; via: string; defined_in_member_copied_into_data_division: { member: string; copy_line: number } | null }>;
  unreferenced_paragraphs: string[];
  io_mode_conflicts: Array<{ file: string; verb: string; line: number; opened_as: string[] }>;
}

const VERBS = /^(ACCEPT|ADD|CALL|CLOSE|COMPUTE|CONTINUE|DELETE|DISPLAY|DIVIDE|ELSE|END-[A-Z-]+|EVALUATE|EXEC|EXIT|GO|GOBACK|IF|INITIALIZE|INSPECT|MOVE|MULTIPLY|OPEN|PERFORM|READ|RELEASE|RETURN|REWRITE|SEARCH|SET|SORT|START|STOP|STRING|SUBTRACT|UNSTRING|WHEN|WRITE)\b/;

function memberParagraphs(m: SourceFile): string[] {
  const out: string[] = [];
  for (const raw of m.lines) {
    const c = codeText(raw);
    if (c === null) continue;
    const t = c.trim().toUpperCase();
    const hdr = /^([A-Z0-9][A-Z0-9-]*)(\s+SECTION)?\s*\.\s*$/.exec(t);
    if (hdr && !VERBS.test(t)) out.push(hdr[1]);
  }
  return out;
}

/**
 * Splits the procedure division into verb-led statements (a statement runs until the next verb or period).
 * COPY members inside the procedure division contribute their paragraphs; a target found only in a member
 * that is copied into the DATA DIVISION is reported as such (it is still not a procedure paragraph).
 */
export function procedureFacts(f: SourceFile, dd: DataDivision | null, resolve: (member: string) => SourceFile | null = () => null): ProcedureFacts {
  const facts: ProcedureFacts = { procedure_start: null, paragraphs: [], statements: [], opens: [], io: [], performs: [], gotos: [], calls: [], sql: [], missing_targets: [], unreferenced_paragraphs: [], io_mode_conflicts: [] };
  let start = 0;
  for (let n = 1; n <= f.lines.length; n++) {
    const c = codeText(f.lines[n - 1]);
    if (c !== null && /^\s*PROCEDURE\s+DIVISION\b/i.test(c)) {
      start = n;
      break;
    }
  }
  if (!start) return facts;
  facts.procedure_start = start;
  let cur: Statement | null = null;
  let inSql = false;
  for (let n = start + 1; n <= f.lines.length; n++) {
    const raw = f.lines[n - 1];
    const c = codeText(raw);
    if (c === null || !c.trim()) continue;
    const t = c.trim().toUpperCase();
    // Fixed format: a header starts in Area A (columns 8-11). Free format: anywhere, with no verb.
    const fixedLine = raw.length >= 7 && /^[ 0-9]{6}$/.test(raw.slice(0, 6));
    const areaA = fixedLine ? /^ {0,3}\S/.test(raw.slice(7)) : true;
    const hdr = /^([A-Z0-9][A-Z0-9-]*)(\s+SECTION)?\s*\.\s*$/.exec(t);
    if (areaA && hdr && !VERBS.test(t)) {
      facts.paragraphs.push({ name: hdr[1], line: n, section: !!hdr[2] });
      cur = null;
      continue;
    }
    if (inSql) {
      if (cur) {
        cur.text += ' ' + t;
        cur.end_line = n;
      }
      if (/\bEND-EXEC\b/.test(t)) inSql = false;
      continue;
    }
    const cp = /^COPY\s+["']?([A-Z0-9-]+)/.exec(t);
    if (cp) {
      const m = resolve(cp[1]);
      for (const name of m ? memberParagraphs(m) : []) facts.paragraphs.push({ name, line: n, section: false, member: cp[1] });
      cur = null;
      continue;
    }
    const v = VERBS.exec(t);
    if (v) {
      cur = { line: n, end_line: n, verb: v[1], text: t };
      facts.statements.push(cur);
      if (v[1] === 'EXEC' && !/\bEND-EXEC\b/.test(t)) inSql = true;
    } else if (cur) {
      cur.text += ' ' + t;
      cur.end_line = n;
    }
  }
  const recordFile = new Map<string, string>();
  for (const fd of dd?.fds ?? []) for (const r of fd.records) recordFile.set(r, fd.name);
  const paraNames = new Set(facts.paragraphs.map((p) => p.name));
  for (const s of facts.statements) {
    const t = s.text.replace(/\.\s*$/, '');
    if (s.verb === 'OPEN') {
      let mode = '';
      for (const tok of t.split(/\s+/).slice(1)) {
        if (/^(INPUT|OUTPUT|I-O|EXTEND)$/.test(tok)) mode = tok;
        else if (mode && /^[A-Z0-9-]+$/.test(tok)) facts.opens.push({ file: tok, mode, line: s.line });
      }
    }
    const io = /^(READ|WRITE|REWRITE|DELETE|START)\s+([A-Z0-9-]+)/.exec(t);
    if (io) facts.io.push({ verb: io[1], target: io[2], file: io[1] === 'WRITE' || io[1] === 'REWRITE' ? recordFile.get(io[2]) ?? null : io[2], line: s.line });
    const pf = /^PERFORM\s+([A-Z0-9][A-Z0-9-]*)(?:\s+(?:THRU|THROUGH)\s+([A-Z0-9-]+))?(?:[\s\S]*?\bUNTIL\s+(.*))?/.exec(t);
    if (pf && !/^(UNTIL|VARYING|WITH|TEST)$/.test(pf[1]) && !/^\d+$/.test(pf[1])) facts.performs.push({ target: pf[1], thru: pf[2] ?? null, line: s.line, until: pf[3] ?? null });
    const go = /^GO\s+(?:TO\s+)?([A-Z0-9-]+)/.exec(t);
    if (go) facts.gotos.push({ target: go[1], line: s.line });
    const call = /^CALL\s+(?:'([^']+)'|"([^"]+)"|([A-Z0-9-]+))/.exec(t);
    if (call) facts.calls.push({ target: call[1] ?? call[2] ?? call[3], dynamic: !!call[3], line: s.line });
    const sql = /^EXEC\s+SQL\s+([A-Z]+)/.exec(t);
    if (sql) facts.sql.push({ kind: sql[1], line: s.line, text: t });
  }
  // Members copied into the DATA DIVISION may define paragraphs that are then not procedure paragraphs.
  const dataMembers = (dd?.includes ?? []).filter((i) => i.resolved && i.file === f.path).map((i) => ({ i, paras: new Set(memberParagraphs(resolve(i.name) ?? { path: '', lines: [] })) }));
  const elsewhere = (t: string) => {
    const hit = dataMembers.find((x) => x.paras.has(t));
    return hit ? { member: hit.i.name, copy_line: hit.i.line } : null;
  };
  for (const p of facts.performs) {
    if (!paraNames.has(p.target)) facts.missing_targets.push({ target: p.target, line: p.line, via: 'PERFORM', defined_in_member_copied_into_data_division: elsewhere(p.target) });
    if (p.thru && !paraNames.has(p.thru)) facts.missing_targets.push({ target: p.thru, line: p.line, via: 'PERFORM THRU', defined_in_member_copied_into_data_division: elsewhere(p.thru) });
  }
  for (const g of facts.gotos) if (!paraNames.has(g.target)) facts.missing_targets.push({ target: g.target, line: g.line, via: 'GO TO', defined_in_member_copied_into_data_division: elsewhere(g.target) });
  const referenced = new Set([...facts.performs.flatMap((p) => [p.target, p.thru ?? '']), ...facts.gotos.map((g) => g.target)]);
  facts.unreferenced_paragraphs = facts.paragraphs.slice(1).filter((p) => !referenced.has(p.name)).map((p) => p.name);
  const modes = new Map<string, Set<string>>();
  for (const o of facts.opens) modes.set(o.file, new Set([...(modes.get(o.file) ?? []), o.mode]));
  for (const x of facts.io) {
    if (!x.file || !modes.has(x.file)) continue;
    const m = [...modes.get(x.file)!];
    const writes = ['WRITE', 'REWRITE', 'DELETE'].includes(x.verb);
    const reads = ['READ', 'START'].includes(x.verb);
    const canWrite = m.some((k) => k === 'OUTPUT' || k === 'I-O' || k === 'EXTEND');
    const canRead = m.some((k) => k === 'INPUT' || k === 'I-O');
    if ((writes && !canWrite) || (reads && !canRead) || (x.verb === 'REWRITE' && !m.includes('I-O')) || (x.verb === 'DELETE' && !m.includes('I-O'))) facts.io_mode_conflicts.push({ file: x.file, verb: x.verb, line: x.line, opened_as: m });
  }
  return facts;
}

/** Numbered source excerpt (comments kept, as in the original). */
export function excerpt(f: SourceFile, from: number, to: number): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  for (let n = Math.max(1, from); n <= Math.min(f.lines.length, to); n++) out.push({ line: n, text: f.lines[n - 1] });
  return out;
}

/** The paragraph containing a line, and the statements in it. */
export function contextFor(pf: ProcedureFacts, line: number): { paragraph: string | null; from: number; to: number; statements: Statement[]; performed_from: number[] } {
  const ps = pf.paragraphs.filter((p) => p.line <= line);
  const p = ps.length ? ps[ps.length - 1] : null;
  const next = p ? pf.paragraphs.find((q) => q.line > p.line) : null;
  const from = p ? p.line : line;
  const to = next ? next.line - 1 : Math.max(line, ...pf.statements.map((s) => s.end_line));
  return { paragraph: p?.name ?? null, from, to, statements: pf.statements.filter((s) => s.line >= from && s.line <= to), performed_from: p ? pf.performs.filter((x) => x.target === p.name || x.thru === p.name).map((x) => x.line) : [] };
}
