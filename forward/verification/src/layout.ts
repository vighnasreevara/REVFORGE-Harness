/**
 * Source-level COBOL record layout calculation, read directly from the
 * original text (never from the reverse artifacts).
 *
 * - Hierarchy from level numbers (01-49, 77; 88 attaches to its item; 66
 *   RENAMES is flagged unsupported).
 * - USAGE is inherited from enclosing groups; SIGN ... SEPARATE adds a byte.
 * - REDEFINES shares storage with the redefined item: the slot takes the
 *   larger of the two (never a naive sum). OCCURS multiplies; OCCURS ...
 *   DEPENDING ON uses the maximum and marks the size variable.
 * - COPY statements are expanded when the member can be found; otherwise the
 *   record is marked incomplete. SYNCHRONIZED, INDEX and POINTER items make
 *   the size indeterminate (alignment and pointer size are implementation
 *   dependent): no size is claimed rather than a guessed one.
 */
import { allowedJavaTypes, JavaType } from './numeric';
import { codeText, DataEntry, parseDataEntry, picFacts, SourceFile, storageBytes } from './cobol-source';

export interface LayoutNode {
  file: string;
  line: number;
  level: number;
  name: string;
  pic: string | null;
  usage: string | null;
  usage_explicit: boolean;
  sign_separate: boolean;
  occurs: { min: number; max: number; depending_on: string | null } | null;
  redefines: string | null;
  values: string[];
  children: LayoutNode[];
  conditions: Array<{ name: string; line: number; values: string[] }>;
  flags: string[];
  size: number | null;
  offset: number | null;
}

export interface LayoutRecord {
  root: LayoutNode;
  section: string;
  fd: string | null;
  size: number | null;
  determinate: boolean;
  variable: boolean;
  flags: string[];
}

export interface FdEntry {
  name: string;
  line: number;
  file: string;
  record_contains: { min: number; max: number | null } | null;
  records: string[];
}

export interface DataDivision {
  records: LayoutRecord[];
  fds: FdEntry[];
  includes: Array<{ name: string; line: number; file: string; resolved: boolean; circular: boolean }>;
  flags: string[];
}

export type Resolver = (member: string) => SourceFile | null;

const ENTRY = /^\s*(\d{1,2})\s+[A-Z0-9]/i;
const DIVISION = (name: string) => new RegExp(`^\\s*${name}\\s+DIVISION\\b`, 'i');

function usageOf(text: string): { usage: string | null; explicit: boolean } {
  const up = text.toUpperCase();
  if (/\b(COMP-3|COMPUTATIONAL-3|PACKED-DECIMAL)\b/.test(up)) return { usage: 'PACKED_DECIMAL', explicit: true };
  if (/\b(COMP-5|COMPUTATIONAL-5)\b/.test(up)) return { usage: 'COMP-5', explicit: true };
  if (/\b(COMP-1|COMPUTATIONAL-1|COMP-2|COMPUTATIONAL-2)\b/.test(up)) return { usage: 'FLOAT', explicit: true };
  if (/\b(COMP|COMPUTATIONAL|BINARY|COMP-4|COMPUTATIONAL-4)\b/.test(up)) return { usage: 'BINARY', explicit: true };
  if (/\bUSAGE\s+(IS\s+)?INDEX\b|\bINDEX\b\s*\.?$/.test(up)) return { usage: 'INDEX', explicit: true };
  if (/\bPOINTER\b/.test(up)) return { usage: 'POINTER', explicit: true };
  if (/\bUSAGE\s+(IS\s+)?DISPLAY\b/.test(up)) return { usage: 'DISPLAY', explicit: true };
  return { usage: null, explicit: false };
}

function node(f: SourceFile, e: DataEntry): LayoutNode {
  const up = e.text.toUpperCase();
  const u = usageOf(e.text);
  const occ = /\bOCCURS\s+(\d+)(?:\s+TO\s+(\d+))?(?:\s+TIMES)?(?:[\s\S]*?\bDEPENDING\s+(?:ON\s+)?([A-Z0-9-]+))?/.exec(up);
  const flags: string[] = [];
  if (/\bSYNC(HRONIZED)?\b/.test(up)) flags.push('synchronized: alignment is implementation dependent');
  if (e.level === 66) flags.push('RENAMES (level 66) is not supported');
  return {
    file: f.path,
    line: e.start_line,
    level: e.level,
    name: e.name,
    pic: e.pic,
    usage: u.usage,
    usage_explicit: u.explicit,
    sign_separate: /\bSIGN\s+(IS\s+)?(LEADING|TRAILING)?\s*SEPARATE\b/.test(up),
    occurs: occ ? { min: Number(occ[1]), max: Number(occ[2] ?? occ[1]), depending_on: occ[3] ?? null } : null,
    redefines: e.redefines,
    values: e.values,
    children: [],
    conditions: [],
    flags,
    size: null,
    offset: null,
  };
}

/** Parses the DATA DIVISION of `f`, expanding COPY members through `resolve`. */
export function parseDataDivision(f: SourceFile, resolve: Resolver = () => null): DataDivision {
  const out: DataDivision = { records: [], fds: [], includes: [], flags: [] };
  let section = 'WORKING-STORAGE';
  let fd: FdEntry | null = null;
  const stack: LayoutNode[] = [];
  let last: LayoutNode | null = null;
  const closeRecord = () => {
    stack.length = 0;
  };
  const visit = (src: SourceFile, from: number, to: number, chain: string[]) => {
    for (let n = from; n <= to; n++) {
      const c = codeText(src.lines[n - 1] ?? '');
      if (c === null || !c.trim()) continue;
      const t = c.trim().toUpperCase();
      if (DIVISION('PROCEDURE').test(t)) return 'end';
      const sec = /^(FILE|WORKING-STORAGE|LOCAL-STORAGE|LINKAGE|COMMUNICATION|REPORT|SCREEN)\s+SECTION\b/.exec(t);
      if (sec) {
        section = sec[1];
        fd = null;
        closeRecord();
        continue;
      }
      const fdm = /^(FD|SD|RD)\s+([A-Z0-9-]+)/.exec(t);
      if (fdm) {
        let text = t;
        let m = n;
        while (!/\.\s*$/.test(text) && m < to) {
          m++;
          const cc = codeText(src.lines[m - 1] ?? '');
          if (cc !== null) text += ' ' + cc.trim().toUpperCase();
        }
        const rc = /\bRECORD\s+(?:CONTAINS\s+)?(\d+)(?:\s+TO\s+(\d+))?\s*(?:CHARACTERS)?/.exec(text);
        const vr = /\bRECORD\s+(?:IS\s+)?VARYING\b[^.]*?FROM\s+(\d+)\s+TO\s+(\d+)/.exec(text);
        fd = { name: fdm[2], line: n, file: src.path, record_contains: vr ? { min: Number(vr[1]), max: Number(vr[2]) } : rc ? { min: Number(rc[1]), max: rc[2] ? Number(rc[2]) : null } : null, records: [] };
        out.fds.push(fd);
        closeRecord();
        n = m;
        continue;
      }
      const cp = /^COPY\s+["']?([A-Z0-9-]+)["']?/.exec(t) ?? /^EXEC\s+SQL\s+INCLUDE\s+([A-Z0-9-]+)/.exec(t);
      if (cp) {
        const name = cp[1];
        const circular = chain.includes(name);
        const member = circular ? null : resolve(name);
        out.includes.push({ name, line: n, file: src.path, resolved: !!member, circular });
        if (circular) out.flags.push(`circular COPY of ${name} in ${src.path}`);
        if (member) {
          visit(member, 1, member.lines.length, [...chain, name]);
        } else if (stack.length) {
          stack[0].flags.push(`COPY ${name} at ${src.path}:${n} ${circular ? 'is circular' : 'could not be resolved'}; layout incomplete`);
        } else {
          out.flags.push(`COPY ${name} at ${src.path}:${n} ${circular ? 'is circular' : 'could not be resolved'}`);
        }
        continue;
      }
      if (!ENTRY.test(c)) continue;
      const e = parseDataEntry(src, n);
      if (!e) continue;
      n = e.end_line;
      if (e.level === 88) {
        if (last) last.conditions.push({ name: e.name, line: e.start_line, values: e.values });
        continue;
      }
      const nd = node(src, e);
      if (e.level === 1 || e.level === 77 || e.level === 66) {
        if (e.level === 66) {
          out.flags.push(`RENAMES ${e.name} at ${src.path}:${e.start_line} is not supported`);
          continue;
        }
        stack.length = 0;
        stack.push(nd);
        out.records.push({ root: nd, section, fd: section === 'FILE' && fd ? fd.name : null, size: null, determinate: false, variable: false, flags: [] });
        if (section === 'FILE' && fd) fd.records.push(nd.name);
      } else {
        while (stack.length && stack[stack.length - 1].level >= e.level) stack.pop();
        if (!stack.length) {
          out.flags.push(`level ${e.level} ${e.name} at ${src.path}:${e.start_line} has no enclosing record`);
          continue;
        }
        stack[stack.length - 1].children.push(nd);
        stack.push(nd);
      }
      last = nd;
    }
    return 'continue';
  };
  let start = 1;
  for (let n = 1; n <= f.lines.length; n++) {
    const c = codeText(f.lines[n - 1]);
    if (c !== null && DIVISION('DATA').test(c.trim())) {
      start = n + 1;
      break;
    }
  }
  visit(f, start, f.lines.length, []);
  for (const r of out.records) {
    const res = sizeOf(r.root, null);
    r.size = res.size;
    r.determinate = res.size !== null;
    r.variable = res.variable;
    r.flags = collectFlags(r.root);
    assignOffsets(r.root, 0);
  }
  return out;
}

function collectFlags(n: LayoutNode): string[] {
  return [...n.flags.map((x) => `${n.name}: ${x}`), ...n.children.flatMap(collectFlags)];
}

/** Effective usage: an item without its own USAGE clause takes the nearest group's. */
function effectiveUsage(n: LayoutNode, inherited: string | null): string {
  return n.usage_explicit ? (n.usage as string) : inherited ?? 'DISPLAY';
}

/** Storage size of an item: REDEFINES share storage (larger wins), OCCURS multiplies. */
export function sizeOf(n: LayoutNode, inherited: string | null): { size: number | null; variable: boolean } {
  const usage = effectiveUsage(n, inherited);
  const times = n.occurs ? n.occurs.max : 1;
  const variable = !!n.occurs?.depending_on || n.occurs !== null && n.occurs.min !== n.occurs.max;
  if (n.flags.some((x) => /synchronized|RENAMES|could not be resolved|is circular/.test(x))) return { size: (n.size = null), variable };
  if (n.pic) {
    if (usage === 'FLOAT' || usage === 'INDEX' || usage === 'POINTER') return { size: (n.size = null), variable };
    const st = usage === 'PACKED_DECIMAL' ? 'PACKED_DECIMAL' : usage === 'BINARY' || usage === 'COMP-5' ? (usage as any) : 'DISPLAY';
    let s = storageBytes(n.pic, st);
    if (n.sign_separate && st === 'DISPLAY' && picFacts(n.pic).signed) s += 1;
    n.size = s;
    return { size: s * times, variable };
  }
  if (!n.children.length) {
    n.flags.push(usage === 'INDEX' || usage === 'POINTER' ? `USAGE ${usage} size is implementation dependent` : 'has neither a PIC nor subordinate items in the available source');
    return { size: (n.size = null), variable };
  }
  const slots: Array<{ name: string; size: number }> = [];
  let anyVar = variable;
  for (const ch of n.children) {
    const r = sizeOf(ch, n.usage_explicit ? n.usage : inherited);
    anyVar = anyVar || r.variable;
    if (r.size === null) return { size: (n.size = null), variable: anyVar };
    if (ch.redefines) {
      const slot = slots.find((s) => s.name === ch.redefines);
      if (!slot) {
        n.flags.push(`${ch.name} REDEFINES ${ch.redefines}, which is not an earlier sibling`);
        return { size: (n.size = null), variable: anyVar };
      }
      slot.size = Math.max(slot.size, r.size);
      continue;
    }
    slots.push({ name: ch.name, size: r.size });
  }
  const one = slots.reduce((a, s) => a + s.size, 0);
  n.size = one;
  return { size: one * times, variable: anyVar };
}

/** Offsets: a REDEFINES starts where the redefined item starts, and the next item follows the larger of the two. */
function assignOffsets(n: LayoutNode, base: number): void {
  n.offset = base;
  let cursor = base;
  const at = new Map<string, number>();
  for (const ch of n.children) {
    const redefining = !!ch.redefines && at.has(ch.redefines);
    const off = redefining ? at.get(ch.redefines!)! : cursor;
    assignOffsets(ch, off);
    at.set(ch.name, off);
    if (ch.size !== null) cursor = Math.max(redefining ? cursor : off, off + ch.size * (ch.occurs ? ch.occurs.max : 1));
  }
}

export function findItem(dd: DataDivision, name: string): { record: LayoutRecord; node: LayoutNode; usage: string } | null {
  const up = name.toUpperCase();
  for (const r of dd.records) {
    const walk = (n: LayoutNode, inh: string | null): { node: LayoutNode; usage: string } | null => {
      const u = effectiveUsage(n, inh);
      if (n.name === up) return { node: n, usage: u };
      for (const c of n.children) {
        const x = walk(c, n.usage_explicit ? n.usage : inh);
        if (x) return x;
      }
      return null;
    };
    const hit = walk(r.root, null);
    if (hit) return { record: r, ...hit };
  }
  return null;
}

/** Java types a source item permits (same rules the F2 contract enforces). */
export function javaTypesFor(n: LayoutNode, usage: string): JavaType[] {
  if (n.children.length) return ['Group'];
  if (!n.pic) return [];
  const f = picFacts(n.pic);
  const normalized = f.alnum ? 'STRING' : f.edited ? 'NUMERIC_EDITED' : f.decimals > 0 ? (f.signed ? 'SIGNED_DECIMAL' : 'DECIMAL') : f.signed ? 'SIGNED_INTEGER' : 'INTEGER';
  const storage = usage === 'PACKED_DECIMAL' ? 'PACKED_DECIMAL' : usage === 'BINARY' || usage === 'COMP-5' ? 'BINARY' : usage === 'DISPLAY' ? 'DISPLAY' : 'UNKNOWN';
  return allowedJavaTypes({ normalized_type: normalized, storage_type: storage, length: f.alnum ? f.displayLength : f.digits, decimal_places: f.decimals });
}

/** FD RECORD CONTAINS versus the sizes of the records described under it. */
export function fdLengthFindings(dd: DataDivision): Array<{ fd: string; file: string; line: number; declared: { min: number; max: number | null }; records: Array<{ name: string; size: number | null }>; consistent: boolean | null }> {
  return dd.fds
    .filter((fd) => fd.record_contains)
    .map((fd) => {
      const recs = dd.records.filter((r) => r.fd === fd.name).map((r) => ({ name: r.root.name, size: r.size }));
      const d = fd.record_contains!;
      const known = recs.filter((r) => r.size !== null);
      const consistent = !recs.length || known.length < recs.length ? null : known.every((r) => (d.max === null ? r.size === d.min : r.size! >= d.min && r.size! <= d.max));
      return { fd: fd.name, file: fd.file, line: fd.line, declared: d, records: recs, consistent };
    });
}
