/**
 * Full-application front end of the local converter (STEP 17). Extends the
 * STEP 11/15 subset parser to the constructs the application's programs use,
 * without guessing:
 *   preprocessing  COPY [REPLACING ==a== BY ==b==], EXEC SQL INCLUDE, continuation
 *                  lines; every code line keeps its origin (file, line)
 *   data           FILE / WORKING-STORAGE / LOCAL-STORAGE / LINKAGE records through the
 *                  shared layout parser (nested groups, OCCURS, REDEFINES, COMP, COMP-3,
 *                  SIGN, edited pictures, 88-levels with THRU), FILE-CONTROL entries
 *   procedure      sections and paragraphs; MOVE, SET, INITIALIZE, IF, EVALUATE (ALSO,
 *                  THRU, ANY, TRUE/FALSE), PERFORM (THRU, TIMES, UNTIL, VARYING, inline,
 *                  TEST AFTER), CALL (BY REFERENCE/CONTENT, ON EXCEPTION), CANCEL, GOBACK,
 *                  STOP RUN, EXIT [PROGRAM|PARAGRAPH|PERFORM], GO TO [DEPENDING ON],
 *                  CONTINUE, NEXT SENTENCE, DISPLAY, ACCEPT, OPEN, CLOSE, READ, WRITE,
 *                  REWRITE, DELETE, START, ADD, SUBTRACT, MULTIPLY, DIVIDE, COMPUTE,
 *                  STRING, EXEC SQL / EXEC CICS (kept as external boundaries)
 * A statement it cannot parse is kept as an `untranslated` statement with its
 * text and reason; the back end turns it into an explicit gap, never a no-op.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { codeText, parseDataEntry, SourceFile, sourceFile } from '../../../verification/src/cobol-source';
import { LayoutNode, parseDataDivision } from '../../../verification/src/layout';

export interface Origin {
  file: string;
  line: number;
  /** COPY instance (index into the program's includes + 1); 0 or absent for the program's own lines. */
  inst?: number;
}
export interface XLine {
  text: string;
  origin: Origin;
}
export interface Include {
  name: string;
  origin: Origin;
  resolved: boolean;
  path: string | null;
  replacing: Array<[string, string]>;
}

/* ------------------------------------------------------------------ */
/* preprocessing                                                       */
/* ------------------------------------------------------------------ */

export type MemberResolver = (member: string) => { path: string; rel: string; text: string } | null;

const rawCode = (raw: string): { ind: string; text: string } | null => {
  if (raw.trim() === '') return { ind: ' ', text: '' };
  const fixed = raw.length >= 7 && /^[ 0-9]{6}$/.test(raw.slice(0, 6));
  if (!fixed) return /^\s*\*>/.test(raw) || /^\*/.test(raw) ? null : { ind: ' ', text: raw };
  const ind = raw[6];
  if (ind === '*' || ind === '/') return null;
  if (!/[ \-dD$]/.test(ind)) return { ind: ' ', text: raw.slice(6) };
  return { ind, text: raw.slice(7, 72) };
};

function applyReplacing(text: string, rep: Array<[string, string]>): string {
  let t = text;
  for (const [a, b] of rep) {
    if (/^[A-Z0-9-]+$/i.test(a)) t = t.replace(new RegExp(`(?<![A-Z0-9-])${a.replace(/[-]/g, '\\-')}(?![A-Z0-9-])`, 'gi'), b);
    else t = t.split(a).join(b);
  }
  return t;
}

/** Expands COPY members and continuation lines into code lines with their origins. */
export function expand(file: string, rel: string, text: string, resolve: MemberResolver, includes: Include[] = [], chain: string[] = [], rep: Array<[string, string]> = [], inst = 0): XLine[] {
  const out: XLine[] = [];
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  for (let i = 0; i < raw.length; i++) {
    const c = rawCode(raw[i]);
    if (c === null) continue;
    const origin: Origin = inst ? { file: rel, line: i + 1, inst } : { file: rel, line: i + 1 };
    let t = rep.length ? applyReplacing(c.text, rep) : c.text;
    if (c.ind === '-' && out.length) {
      // Continuation: a continued literal resumes after the first quote; other text joins the previous line.
      const prev = out[out.length - 1];
      const body = t.replace(/^\s*/, '');
      const open = /(['"])(?:(?!\1).)*$/.test(prev.text.replace(/'[^']*'|"[^"]*"/g, ''));
      prev.text = open && /^['"]/.test(body) ? prev.text.replace(/\s+$/, '') + body.slice(1) : prev.text.replace(/\s+$/, '') + ' ' + body;
      continue;
    }
    // COPY member [REPLACING ...]. (possibly over several lines)
    const head = /^\s*COPY\s+["']?([A-Z0-9-]+)["']?/i.exec(t) ?? /^\s*EXEC\s+SQL\s+INCLUDE\s+([A-Z0-9-]+)/i.exec(t);
    if (head) {
      let stmt = t;
      let j = i;
      const done = (s: string) => (/^\s*EXEC/i.test(s) ? /END-EXEC/i.test(s) : /\.\s*$/.test(s.replace(/==[^=]*==/g, '""')));
      while (!done(stmt) && j + 1 < raw.length) {
        j++;
        const n = rawCode(raw[j]);
        if (n !== null) stmt += ' ' + n.text.trim();
      }
      const name = head[1].toUpperCase();
      const replacing: Array<[string, string]> = [];
      const r = /\bREPLACING\b([\s\S]*)$/i.exec(stmt);
      if (r) for (const m of r[1].matchAll(/==([^=]*)==\s+BY\s+==([^=]*)==|([A-Z0-9-]+)\s+BY\s+([A-Z0-9-]+)/gi)) replacing.push([(m[1] ?? m[3]).trim(), (m[2] ?? m[4]).trim()]);
      const circular = chain.includes(name);
      const member = circular ? null : resolve(name);
      includes.push({ name, origin, resolved: !!member, path: member?.rel ?? null, replacing });
      if (member) out.push(...expand(member.path, member.rel, member.text, resolve, includes, [...chain, name], [...rep, ...replacing], includes.length));
      else out.push({ text: `       *> UNRESOLVED-COPY ${name}`, origin });
      i = j;
      continue;
    }
    out.push({ text: t, origin });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */

export type ItemKind = 'GROUP' | 'ALNUM' | 'DISPLAY' | 'BINARY' | 'PACKED' | 'EDITED' | 'INDEX' | 'UNSUPPORTED';
export interface Value {
  kind: 'string' | 'number' | 'figurative' | 'all';
  text: string;
}
export interface Item {
  id: number;
  name: string;
  level: number;
  record: Rec;
  parent: Item | null;
  children: Item[];
  off: number;
  size: number;
  occurs: Array<{ count: number; stride: number }>;
  ownOccurs: number | null;
  kind: ItemKind;
  digits: number;
  scale: number;
  signed: boolean;
  signSep: boolean;
  signLead: boolean;
  edit: string | null;
  values: Value[];
  conditions: Array<{ name: string; origin: Origin; values: Array<{ lo: Value; hi: Value | null }>; falseValue: Value | null }>;
  origin: Origin;
  redefines: string | null;
  filler: boolean;
  unsupported: string | null;
  javaName: string;
  indexNames: string[];
}
export interface Rec {
  name: string;
  section: string;
  fd: string | null;
  size: number;
  storage: string;
  root: Item;
  origin: Origin;
  shared: string | null;
}
export interface FileControl {
  name: string;
  assign: string;
  organization: 'SEQUENTIAL' | 'INDEXED' | 'RELATIVE' | 'LINE SEQUENTIAL';
  access: 'SEQUENTIAL' | 'RANDOM' | 'DYNAMIC';
  recordKey: Ref | null;
  alternateKeys: string[];
  status: Ref | null;
  optional: boolean;
  origin: Origin;
}
export interface FdInfo {
  name: string;
  records: string[];
  recordingMode: string | null;
  origin: Origin;
}

function parseValues(text: string): { values: Value[]; thru: Array<{ lo: Value; hi: Value | null }>; falseValue: Value | null } {
  const up = text;
  const m = /(?<![A-Z0-9-])VALUES?\s+(?:ARE\s+|IS\s+)?([\s\S]*?)\.?\s*$/i.exec(up);
  const out: Value[] = [];
  const thru: Array<{ lo: Value; hi: Value | null }> = [];
  let falseValue: Value | null = null;
  if (!m) return { values: out, thru, falseValue };
  let body = m[1];
  const f = /\bWHEN\s+SET\s+TO\s+FALSE\s+(?:IS\s+)?([\s\S]*)$/i.exec(body);
  if (f) {
    body = body.slice(0, f.index);
    falseValue = parseValues(`VALUE ${f[1]}`).values[0] ?? null;
  }
  const re = /\s*(?:(ALL)\s+)?(?:X'([0-9A-F]*)'|'((?:[^']|'')*)'|"((?:[^"]|"")*)"|([+-]?\d*\.?\d+)|\b(ZEROS?|ZEROES|SPACES?|HIGH-VALUES?|LOW-VALUES?|QUOTES?|NULLS?)\b)(\s+(?:THRU|THROUGH)\s+)?/giy;
  let mm: RegExpExecArray | null;
  let pendingLo: Value | null = null;
  while ((mm = re.exec(body)) && mm[0].length) {
    let v: Value;
    if (mm[2] !== undefined) v = { kind: 'string', text: Buffer.from(mm[2], 'hex').toString('latin1') };
    else if (mm[3] !== undefined) v = { kind: 'string', text: mm[3].replace(/''/g, "'") };
    else if (mm[4] !== undefined) v = { kind: 'string', text: mm[4].replace(/""/g, '"') };
    else if (mm[5] !== undefined) v = { kind: 'number', text: mm[5] };
    else v = { kind: 'figurative', text: mm[6].toUpperCase().replace(/^(ZERO|ZEROS|ZEROES)$/, 'ZERO').replace(/^SPACES?$/, 'SPACE').replace(/^HIGH-VALUES?$/, 'HIGH-VALUE').replace(/^LOW-VALUES?$/, 'LOW-VALUE').replace(/^QUOTES?$/, 'QUOTE').replace(/^NULLS?$/, 'NULL') };
    if (mm[1]) v = { kind: 'all', text: v.text };
    if (pendingLo) {
      thru.push({ lo: pendingLo, hi: v });
      pendingLo = null;
    } else if (mm[7]) pendingLo = v;
    else thru.push({ lo: v, hi: null });
    out.push(v);
    while (body[re.lastIndex] === ',' || body[re.lastIndex] === ' ') re.lastIndex++;
  }
  return { values: out, thru, falseValue };
}

const expandPic = (p: string) => p.toUpperCase().replace(/(.)\((\d+)\)/g, (_, c: string, n: string) => c.repeat(Number(n)));

export interface DataModel {
  records: Rec[];
  items: Item[];
  files: FileControl[];
  fds: FdInfo[];
  flags: string[];
}

/** Data division model built on the shared layout parser, from the expanded lines. */
export function dataModel(xl: XLine[]): DataModel {
  // The layout parser reads fixed-format lines; trimmed code text is read as free format.
  const lines = xl.map((l) => l.text.trimStart());
  const syn: SourceFile = sourceFile('expanded', lines.join('\n'));
  const dd = parseDataDivision(syn, () => null);
  const items: Item[] = [];
  const records: Rec[] = [];
  const entryText = (ln: number) => parseDataEntry(syn, ln)?.text ?? '';
  let nid = 0;
  const jnames = new Set<string>();
  const jname = (n: string) => {
    let b = n.replace(/-/g, '_').replace(/[^A-Za-z0-9_]/g, '_');
    if (/^\d/.test(b)) b = '_' + b;
    let k = b;
    let i = 2;
    while (jnames.has(k)) k = `${b}_${i++}`;
    jnames.add(k);
    return k;
  };
  const build = (n: LayoutNode, rec: Rec, parent: Item | null, inheritedUsage: string | null, enclosing: Array<{ count: number; stride: number }>): Item => {
    const text = entryText(n.line);
    const usage = n.usage_explicit ? n.usage : inheritedUsage;
    const occ = n.occurs ? [...enclosing, { count: n.occurs.max, stride: n.size ?? 0 }] : enclosing;
    const it: Item = {
      id: nid++,
      name: n.name.toUpperCase(),
      level: n.level,
      record: rec,
      parent,
      children: [],
      off: n.offset ?? 0,
      size: n.size ?? 0,
      occurs: occ,
      ownOccurs: n.occurs ? n.occurs.max : null,
      kind: 'GROUP',
      digits: 0,
      scale: 0,
      signed: false,
      signSep: n.sign_separate,
      signLead: /(?<![A-Z0-9-])SIGN\s+(IS\s+)?LEADING\b/i.test(text),
      edit: null,
      values: [],
      conditions: n.conditions.map((c) => {
        const t = parseValues(entryText(c.line));
        return { name: c.name.toUpperCase(), origin: xl[c.line - 1]?.origin ?? { file: '?', line: 0 }, values: t.thru, falseValue: t.falseValue };
      }),
      origin: xl[n.line - 1]?.origin ?? { file: '?', line: 0 },
      redefines: n.redefines ? n.redefines.toUpperCase() : null,
      filler: /^FILLER$/i.test(n.name),
      unsupported: null,
      javaName: '',
      indexNames: (/(?<![A-Z0-9-])INDEXED\s+BY\s+([A-Z0-9-]+(?:[\s,]+[A-Z0-9-]+)*)/i.exec(text)?.[1] ?? '').toUpperCase().split(/[\s,]+/).filter((w) => w && !/^(ASCENDING|DESCENDING|VALUE|VALUES|PIC|PICTURE|USAGE|KEY|IS|DEPENDING|ON)$/.test(w)),
    };
    it.javaName = jname(it.filler ? `FILLER_${it.origin.line}` : it.name);
    it.values = parseValues(text.replace(/\bOCCURS\b[\s\S]*$/i, (s) => s)).values;
    if (n.occurs?.depending_on) it.unsupported = 'OCCURS DEPENDING ON';
    if (/(?<![A-Z0-9-])JUST(IFIED)?(?![A-Z0-9-])/i.test(text)) it.unsupported = 'JUSTIFIED';
    if (/(?<![A-Z0-9-])SYNC(HRONIZED)?(?![A-Z0-9-])/i.test(text)) it.unsupported = 'SYNCHRONIZED';
    if (n.children.length) {
      it.kind = 'GROUP';
      it.children = n.children.map((ch) => build(ch, rec, it, usage, occ));
    } else if (/(?<![A-Z0-9-])INDEXED\s+BY\b/i.test(text) && !n.pic) it.unsupported = 'item without PIC';
    else if (!n.pic) {
      if (usage === 'INDEX') {
        it.kind = 'INDEX';
        it.size = 4;
      } else it.unsupported = usage === 'POINTER' ? 'USAGE POINTER' : 'item without PIC or subordinate items';
    } else {
      const pic = expandPic(n.pic);
      const sz = n.size;
      if (sz === null) it.unsupported = `size of ${n.name} is not determinable`;
      if (/^[XA]+$/.test(pic)) {
        it.kind = 'ALNUM';
        if (usage && usage !== 'DISPLAY') it.unsupported = `PIC ${n.pic} USAGE ${usage}`;
      } else if (/^S?[9P]+(V[9P]*)?$|^S?V?[9P]+$/.test(pic) && !/P/.test(pic)) {
        it.digits = (pic.match(/9/g) ?? []).length;
        it.scale = pic.includes('V') ? (pic.split('V')[1].match(/9/g) ?? []).length : 0;
        it.signed = pic.startsWith('S');
        it.kind = usage === 'PACKED_DECIMAL' ? 'PACKED' : usage === 'BINARY' || usage === 'COMP-5' ? 'BINARY' : usage === null || usage === 'DISPLAY' ? 'DISPLAY' : 'UNSUPPORTED';
        if (it.kind === 'UNSUPPORTED') it.unsupported = `USAGE ${usage}`;
        if (it.digits > 31) it.unsupported = `${it.digits} digits`;
      } else if (/^[9Z*,.B0/+\-$CRDBV]+$/.test(pic) && /[Z*,.+\-$]|CR|DB|B|0|\//.test(pic)) {
        it.kind = 'EDITED';
        it.edit = pic;
        it.digits = (pic.match(/[9Z*]/g) ?? []).length;
      } else if (/^[XA9B0/]+$/.test(pic)) {
        it.kind = 'ALNUM';
      } else it.unsupported = `PIC ${n.pic}`;
    }
    if (it.unsupported) it.kind = 'UNSUPPORTED';
    items.push(it);
    return it;
  };
  for (const r of dd.records) {
    const origin = xl[r.root.line - 1]?.origin ?? { file: '?', line: 0 };
    const section = r.section.toUpperCase();
    const rec: Rec = { name: r.root.name.toUpperCase(), section, fd: r.fd ? r.fd.toUpperCase() : null, size: r.size ?? 0, storage: '', root: null as any, origin, shared: null };
    rec.root = build(r.root, rec, null, null, []);
    if (r.size === null) rec.root.unsupported = rec.root.unsupported ?? `record ${rec.name} has no determinable size (${r.flags.join('; ') || 'incomplete layout'})`;
    records.push(rec);
  }
  // Shared storage: records of one FD; a level-01 REDEFINES of an earlier record.
  for (const r of records) {
    if (r.fd) r.shared = `FD:${r.fd}`;
    else if (r.root.redefines) r.shared = records.find((x) => x.name === r.root.redefines)?.storage ? `REC:${r.root.redefines}` : `REC:${r.root.redefines}`;
  }
  const xtext = xl.map((l) => l.text);
  const files = fileControl(xl);
  const fds: FdInfo[] = dd.fds.map((f) => {
    let t = '';
    for (let k = f.line - 1; k < xtext.length; k++) {
      t += ' ' + xtext[k];
      if (/\.\s*$/.test(xtext[k])) break;
    }
    return { name: f.name.toUpperCase(), records: f.records.map((x) => x.toUpperCase()), recordingMode: /\bRECORDING\s+(?:MODE\s+)?(?:IS\s+)?([A-Z])\b/i.exec(t)?.[1]?.toUpperCase() ?? null, origin: xl[f.line - 1]?.origin ?? { file: '?', line: 0 } };
  });
  return { records, items, files, fds, flags: dd.flags };
}

function fileControl(xl: XLine[]): FileControl[] {
  const out: FileControl[] = [];
  const start = xl.findIndex((l) => /^\s*FILE-CONTROL\s*\./i.test(l.text));
  if (start < 0) return out;
  let text = '';
  const origins: Array<{ at: number; origin: Origin }> = [];
  for (let k = start + 1; k < xl.length; k++) {
    if (/^\s*(I-O-CONTROL|DATA\s+DIVISION|[A-Z-]+\s+SECTION)\b/i.test(xl[k].text)) break;
    origins.push({ at: text.length, origin: xl[k].origin });
    text += ' ' + xl[k].text;
  }
  for (const m of text.matchAll(/\bSELECT\s+(OPTIONAL\s+)?([A-Z0-9-]+)([\s\S]*?)\.(?=\s|$)/gi)) {
    const body = m[3].toUpperCase();
    const origin = [...origins].reverse().find((o) => o.at <= (m.index ?? 0))?.origin ?? { file: '?', line: 0 };
    const ref = (s: string | undefined): Ref | null => (s ? { name: s.split(/\s+OF\s+|\s+IN\s+/)[0], qual: s.split(/\s+(?:OF|IN)\s+/).slice(1), subs: [], refmod: null } : null);
    const org = /\bORGANIZATION\s+(?:IS\s+)?(LINE\s+SEQUENTIAL|SEQUENTIAL|INDEXED|RELATIVE)/.exec(body)?.[1]?.replace(/\s+/, ' ') as any;
    out.push({
      name: m[2].toUpperCase(),
      assign: /\bASSIGN\s+(?:TO\s+)?['"]?([A-Z0-9$#@.-]+)/.exec(body)?.[1] ?? m[2].toUpperCase(),
      organization: org ?? 'SEQUENTIAL',
      access: (/\bACCESS\s+(?:MODE\s+)?(?:IS\s+)?(SEQUENTIAL|RANDOM|DYNAMIC)/.exec(body)?.[1] as any) ?? 'SEQUENTIAL',
      recordKey: ref(/\bRECORD\s+KEY\s+(?:IS\s+)?([A-Z0-9-]+(?:\s+(?:OF|IN)\s+[A-Z0-9-]+)*)/.exec(body.replace(/\bALTERNATE\s+RECORD\s+KEY\s+(?:IS\s+)?[A-Z0-9-]+/g, ''))?.[1]),
      alternateKeys: [...body.matchAll(/\bALTERNATE\s+RECORD\s+KEY\s+(?:IS\s+)?([A-Z0-9-]+)/g)].map((x) => x[1]),
      status: ref(/\bFILE\s+STATUS\s+(?:IS\s+)?([A-Z0-9-]+(?:\s+(?:OF|IN)\s+[A-Z0-9-]+)*)/.exec(body)?.[1]),
      optional: !!m[1],
      origin,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* procedure division: AST                                             */
/* ------------------------------------------------------------------ */

export interface Ref {
  name: string;
  qual: string[];
  subs: Expr[];
  refmod: { start: Expr; len: Expr | null } | null;
}
export type Operand =
  | { kind: 'ref'; ref: Ref }
  | { kind: 'string'; value: string }
  | { kind: 'number'; text: string }
  | { kind: 'figurative'; value: string }
  | { kind: 'all'; value: string }
  | { kind: 'function'; name: string; args: Expr[]; refmod: { start: Expr; len: Expr | null } | null };
export type Expr = { kind: 'operand'; operand: Operand } | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '**'; left: Expr; right: Expr } | { kind: 'neg'; inner: Expr };
export type RelOp = '=' | '<' | '>' | '<=' | '>=' | '<>';
export type Cond =
  | { kind: 'name'; ref: Ref }
  | { kind: 'rel'; left: Expr; op: RelOp; right: Expr }
  | { kind: 'class'; operand: Expr; test: string; negated: boolean }
  | { kind: 'sign'; operand: Expr; test: 'POSITIVE' | 'NEGATIVE' | 'ZERO'; negated: boolean }
  | { kind: 'not'; inner: Cond }
  | { kind: 'and' | 'or'; left: Cond; right: Cond };
export interface Target {
  ref: Ref;
  rounded: boolean;
}
export type WhenObj = { kind: 'any' } | { kind: 'true' } | { kind: 'false' } | { kind: 'cond'; cond: Cond } | { kind: 'value'; lo: Expr; hi: Expr | null; negated: boolean };
export interface Varying {
  ref: Ref;
  from: Expr;
  by: Expr;
  until: Cond;
}
type Base = { origin: Origin; end: Origin; text: string };
export type Stmt = Base &
  (
    | { kind: 'move'; from: Expr; to: Ref[]; corresponding: boolean }
    | { kind: 'set_cond'; conds: Ref[]; value: boolean }
    | { kind: 'set_to'; targets: Ref[]; value: Expr }
    | { kind: 'set_by'; targets: Ref[]; up: boolean; by: Expr }
    | { kind: 'initialize'; targets: Ref[]; replacing: Array<{ category: string; by: Expr }> }
    | { kind: 'if'; cond: Cond; then: Stmt[]; else: Stmt[] }
    | { kind: 'evaluate'; subjects: Array<{ kind: 'true' } | { kind: 'false' } | { kind: 'expr'; expr: Expr } | { kind: 'cond'; cond: Cond }>; whens: Array<{ alts: WhenObj[][]; body: Stmt[] }>; other: Stmt[] | null }
    | { kind: 'perform'; target: string; thru: string | null; times: Expr | null; until: Cond | null; testAfter: boolean; varying: Varying[] }
    | { kind: 'perform_inline'; body: Stmt[]; times: Expr | null; until: Cond | null; testAfter: boolean; varying: Varying[] }
    | { kind: 'call'; target: Operand; using: Array<{ mode: 'REFERENCE' | 'CONTENT' | 'VALUE'; operand: Operand | null }>; returning: Ref | null; onException: Stmt[] | null; notOnException: Stmt[] | null }
    | { kind: 'cancel'; targets: Operand[] }
    | { kind: 'goback' }
    | { kind: 'stop_run' }
    | { kind: 'exit' }
    | { kind: 'exit_program' }
    | { kind: 'exit_paragraph' }
    | { kind: 'exit_section' }
    | { kind: 'exit_perform'; cycle: boolean }
    | { kind: 'continue' }
    | { kind: 'next_sentence' }
    | { kind: 'goto'; targets: string[]; depending: Ref | null }
    | { kind: 'display'; items: Expr[]; upon: string | null; noAdvancing: boolean }
    | { kind: 'accept'; target: Ref; from: string | null }
    | { kind: 'open'; entries: Array<{ mode: 'INPUT' | 'OUTPUT' | 'I-O' | 'EXTEND'; files: string[] }> }
    | { kind: 'close'; files: string[] }
    | { kind: 'read'; file: string; next: boolean; into: Ref | null; key: Ref | null; atEnd: Stmt[] | null; notAtEnd: Stmt[] | null; invalid: Stmt[] | null; notInvalid: Stmt[] | null }
    | { kind: 'write'; record: Ref; from: Expr | null; invalid: Stmt[] | null; notInvalid: Stmt[] | null; advancing: string | null }
    | { kind: 'rewrite'; record: Ref; from: Expr | null; invalid: Stmt[] | null; notInvalid: Stmt[] | null }
    | { kind: 'delete'; file: string; invalid: Stmt[] | null; notInvalid: Stmt[] | null }
    | { kind: 'start'; file: string; op: string; key: Ref | null; invalid: Stmt[] | null; notInvalid: Stmt[] | null }
    | { kind: 'arith'; verb: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE'; operands: Expr[]; to: Target[]; giving: Target[]; form: string; remainder: Ref | null; divisor: Expr | null; sizeError: Stmt[] | null; notSizeError: Stmt[] | null }
    | { kind: 'compute'; targets: Target[]; expr: Expr; sizeError: Stmt[] | null; notSizeError: Stmt[] | null }
    | { kind: 'string'; items: Array<{ src: Expr; delim: Expr | null }>; into: Ref; pointer: Ref | null; overflow: Stmt[] | null; notOverflow: Stmt[] | null }
    | { kind: 'exec'; lang: string; body: string }
    | { kind: 'untranslated'; reason: string }
  );
export interface Paragraph {
  name: string | null;
  section: string | null;
  origin: Origin;
  end: Origin;
  /** Statements grouped by sentence (NEXT SENTENCE jumps to the end of the sentence). */
  sentences: Stmt[][];
}
export interface AppProgram {
  program_id: string;
  file: string;
  rel: string;
  sha256: string;
  includes: Include[];
  lines: XLine[];
  data: DataModel;
  using: string[];
  paragraphs: Paragraph[];
  sections: Array<{ name: string; first: number; last: number }>;
  declaratives: boolean;
}

/* ------------------------------------------------------------------ */
/* procedure division: tokens                                          */
/* ------------------------------------------------------------------ */

interface Tok {
  t: string;
  kind: 'word' | 'number' | 'string' | 'period' | 'op' | 'lparen' | 'rparen' | 'colon' | 'other';
  x: number;
  col: number;
}

function tokenize(xl: XLine[], from: number, to: number): Tok[] {
  const out: Tok[] = [];
  for (let x = from; x < to; x++) {
    const text = xl[x].text;
    if (/^\s*\*>/.test(text)) continue;
    const re = /\s*(?:(X)'([0-9A-Fa-f]*)'|('(?:[^']|'')*'|"(?:[^"]|"")*")|(\*\*|>=|<=|<>|[<>=+*/])|([+-]?\d*\.\d+|[+-]?\d+)(?![A-Z0-9-])|([A-Z0-9][A-Z0-9-]*[A-Z0-9]|[A-Z0-9])|(-)|(\.)(?=\s|$)|(\()|(\))|(:)|([,;])|(\S))/giy;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && m[0].length) {
      const col = m.index + m[0].length - m[0].trimStart().length;
      if (m[1]) out.push({ t: Buffer.from(m[2], 'hex').toString('latin1'), kind: 'string', x, col });
      else if (m[3]) out.push({ t: m[3].slice(1, -1).replace(/''/g, "'").replace(/""/g, '"'), kind: 'string', x, col });
      else if (m[4]) out.push({ t: m[4], kind: 'op', x, col });
      else if (m[5]) {
        // "+1"/"-1" directly after an operand is a binary operator followed by a number.
        const prev = out[out.length - 1];
        if (/^[+-]/.test(m[5]) && prev && prev.x === x && (prev.kind === 'word' || prev.kind === 'number' || prev.kind === 'rparen') && !(prev.kind === 'word' && /^(TO|BY|FROM|GIVING|INTO|UNTIL|THAN|=|VALUE|WHEN|OF|IN)$/.test(prev.t))) {
          out.push({ t: m[5][0], kind: 'op', x, col });
          out.push({ t: m[5].slice(1), kind: 'number', x, col: col + 1 });
        } else out.push({ t: m[5], kind: 'number', x, col });
      } else if (m[6]) out.push({ t: m[6].toUpperCase(), kind: 'word', x, col });
      else if (m[7]) out.push({ t: '-', kind: 'op', x, col });
      else if (m[8]) out.push({ t: '.', kind: 'period', x, col });
      else if (m[9]) out.push({ t: '(', kind: 'lparen', x, col });
      else if (m[10]) out.push({ t: ')', kind: 'rparen', x, col });
      else if (m[11]) out.push({ t: ':', kind: 'colon', x, col });
      else if (m[12]) continue;
      else out.push({ t: m[13], kind: 'other', x, col });
    }
  }
  return out;
}

export class ParseError extends Error {
  constructor(readonly x: number, msg: string) {
    super(msg);
  }
}

const VERBS = new Set('ACCEPT ADD CALL CANCEL CLOSE COMPUTE CONTINUE DELETE DISPLAY DIVIDE EVALUATE EXEC EXIT GOBACK GO IF INITIALIZE INSPECT MOVE MULTIPLY NEXT OPEN PERFORM READ RELEASE RETURN REWRITE SEARCH SET SORT START STOP STRING SUBTRACT UNSTRING WRITE MERGE ENTRY ALTER'.split(' '));
const SCOPE_END = new Set('ELSE END-IF WHEN END-EVALUATE END-PERFORM END-READ END-WRITE END-REWRITE END-DELETE END-START END-CALL END-ADD END-SUBTRACT END-MULTIPLY END-DIVIDE END-COMPUTE END-STRING END-SEARCH END-RETURN END-ACCEPT END-DISPLAY END-UNSTRING'.split(' '));
const FIGS: Record<string, string> = { ZERO: 'ZERO', ZEROS: 'ZERO', ZEROES: 'ZERO', SPACE: 'SPACE', SPACES: 'SPACE', 'HIGH-VALUE': 'HIGH-VALUE', 'HIGH-VALUES': 'HIGH-VALUE', 'LOW-VALUE': 'LOW-VALUE', 'LOW-VALUES': 'LOW-VALUE', QUOTE: 'QUOTE', QUOTES: 'QUOTE', NULL: 'NULL', NULLS: 'NULL' };
const NOT_DATA = new Set([...VERBS, ...SCOPE_END, 'TO', 'FROM', 'BY', 'GIVING', 'INTO', 'USING', 'UNTIL', 'VARYING', 'THRU', 'THROUGH', 'TIMES', 'AND', 'OR', 'NOT', 'IS', 'THEN', 'ROUNDED', 'REMAINDER', 'ON', 'AT', 'INVALID', 'DELIMITED', 'POINTER', 'WITH', 'UPON', 'OF', 'IN', 'ALSO', 'OTHER', 'END', 'SIZE', 'ERROR', 'EXCEPTION', 'OVERFLOW', 'KEY', 'RECORD', 'NEXT', 'RETURNING', 'AFTER', 'BEFORE', 'ADVANCING', 'EQUAL', 'GREATER', 'LESS', 'THAN', 'TRUE', 'FALSE', 'ANY', 'NUMERIC', 'ALPHABETIC', 'POSITIVE', 'NEGATIVE', 'CORRESPONDING', 'CORR', 'REPLACING', 'DATA', 'TEST', 'DEPENDING', 'REFERENCE', 'CONTENT', 'VALUE', 'NO', 'LINES', 'LINE', 'PAGE', 'CYCLE', 'SENTENCE', 'ALL', 'ALPHABETIC-UPPER', 'ALPHABETIC-LOWER', 'UP', 'DOWN']);

/* ------------------------------------------------------------------ */
/* procedure division: parser                                          */
/* ------------------------------------------------------------------ */

export function parseApp(file: string, rel: string, resolve: MemberResolver): AppProgram {
  const text = fs.readFileSync(file, 'utf8');
  const includes: Include[] = [];
  const xl = expand(file, rel, text, resolve, includes);
  const idLine = xl.find((l) => /PROGRAM-ID\s*\.?\s*['"]?([A-Z0-9-]+)/i.test(l.text));
  const id = idLine ? /PROGRAM-ID\s*\.?\s*['"]?([A-Z0-9-]+)/i.exec(idLine.text)![1].toUpperCase() : null;
  if (!id) throw new ParseError(0, 'missing PROGRAM-ID');
  const data = dataModel(xl);
  const procAt = xl.findIndex((l) => /^\s*PROCEDURE\s+DIVISION\b/i.test(l.text));
  const sha256 = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (procAt < 0) return { program_id: id, file, rel, sha256, includes, lines: xl, data, using: [], paragraphs: [], sections: [], declaratives: false };
  let hdr = '';
  let k = procAt;
  for (; k < xl.length; k++) {
    hdr += ' ' + xl[k].text;
    if (/\.\s*$/.test(xl[k].text)) break;
  }
  const using = (/\bUSING\s+([\s\S]*?)(?:RETURNING[\s\S]*)?\.\s*$/i.exec(hdr)?.[1] ?? '').toUpperCase().split(/\s+/).filter((w) => w && !/^BY$|^REFERENCE$|^VALUE$|^CONTENT$/.test(w));
  const toks = tokenize(xl, k + 1, xl.length);
  const declaratives = toks.some((t) => t.t === 'DECLARATIVES');
  // Procedure names: a word in area A (code columns 0-3) followed by a period, or by SECTION and a period.
  const isHeader = (i: number) => {
    const a = toks[i];
    if (!a || a.kind !== 'word' && a.kind !== 'number' || a.col > 3) return null;
    // A procedure name is never a reserved verb or scope terminator: `EXIT.` indented less than four columns
    // (free-form source) is the EXIT statement of the current paragraph.
    if (VERBS.has(a.t) || SCOPE_END.has(a.t)) return null;
    if (toks[i + 1]?.kind === 'period' && toks[i + 1].x === a.x) return { name: a.t, section: false, len: 2 };
    if (toks[i + 1]?.t === 'SECTION' && toks[i + 2]?.kind === 'period') return { name: a.t, section: true, len: 3 };
    return null;
  };
  const procNames = new Set<string>();
  for (let i = 0; i < toks.length; i++) {
    const h = isHeader(i);
    if (h) procNames.add(h.name);
  }
  let i = 0;
  const peek = (n = 0) => toks[i + n];
  const next = () => toks[i++];
  const isW = (t: Tok | undefined, ...ws: string[]) => !!t && t.kind === 'word' && ws.includes(t.t);
  const fail = (msg: string): never => {
    throw new ParseError(peek()?.x ?? toks[toks.length - 1]?.x ?? 0, msg);
  };
  const expectW = (...ws: string[]) => {
    const t = next();
    if (!isW(t, ...ws)) fail(`expected ${ws.join('|')}, found ${t?.t ?? 'end'}`);
    return t;
  };
  const optW = (...ws: string[]) => {
    if (isW(peek(), ...ws)) {
      next();
      return true;
    }
    return false;
  };
  const origin = (t: Tok | undefined): Origin => (t ? xl[t.x].origin : { file: rel, line: 0 });
  const atBoundary = () => {
    const t = peek();
    return !t || t.kind === 'period' || (t.kind === 'word' && (VERBS.has(t.t) || SCOPE_END.has(t.t))) || isHeader(i) !== null;
  };

  /* -------- operands and expressions -------- */
  const refmodOrSubs = (r: Ref) => {
    while (peek()?.kind === 'lparen') {
      // A '(' after a name: subscripts, or reference modification when a ':' appears at depth 1.
      let depth = 0;
      let colon = false;
      for (let j = i; j < toks.length; j++) {
        if (toks[j].kind === 'lparen') depth++;
        else if (toks[j].kind === 'rparen') {
          depth--;
          if (depth === 0) break;
        } else if (toks[j].kind === 'colon' && depth === 1) colon = true;
      }
      next();
      if (colon) {
        const start = expr();
        if (peek()?.kind !== 'colon') fail('expected : in reference modification');
        next();
        const len = peek()?.kind === 'rparen' ? null : expr();
        if (next()?.kind !== 'rparen') fail('expected ) after reference modification');
        r.refmod = { start, len };
      } else {
        if (r.refmod) fail('subscript after reference modification');
        while (peek() && peek().kind !== 'rparen') r.subs.push(expr());
        next();
      }
    }
  };
  const ref = (): Ref => {
    const t = next();
    if (!t || t.kind !== 'word' || NOT_DATA.has(t.t) && !['RETURN-CODE'].includes(t.t)) fail(`expected a data name, found ${t?.t ?? 'end'}`);
    const r: Ref = { name: t.t, qual: [], subs: [], refmod: null };
    while (isW(peek(), 'OF', 'IN') && peek(1)?.kind === 'word') {
      next();
      r.qual.push(next().t);
    }
    refmodOrSubs(r);
    return r;
  };
  const operand = (): Operand => {
    const t = peek();
    if (!t) fail('missing operand');
    if (t.kind === 'string') {
      next();
      // IBM literal concatenation: 'abc' & 'def'.
      let v = t.t;
      while (peek()?.kind === 'other' && peek().t === '&' && peek(1)?.kind === 'string') {
        next();
        v += next().t;
      }
      return { kind: 'string', value: v };
    }
    if (t.kind === 'number') {
      next();
      return { kind: 'number', text: t.t };
    }
    if (t.kind === 'word' && FIGS[t.t]) {
      next();
      return { kind: 'figurative', value: FIGS[t.t] };
    }
    if (isW(t, 'ALL') && (peek(1)?.kind === 'string' || FIGS[peek(1)?.t ?? ''])) {
      next();
      const v = next();
      return v.kind === 'string' ? { kind: 'all', value: v.t } : { kind: 'figurative', value: FIGS[v.t] };
    }
    if (isW(t, 'FUNCTION')) {
      next();
      const name = next().t;
      const args: Expr[] = [];
      let refmod: { start: Expr; len: Expr | null } | null = null;
      if (peek()?.kind === 'lparen' && !/^(CURRENT-DATE|RANDOM|WHEN-COMPILED)$/.test(name)) {
        next();
        while (peek() && peek().kind !== 'rparen') args.push(expr());
        next();
      } else if (peek()?.kind === 'lparen' && name === 'RANDOM') {
        next();
        while (peek() && peek().kind !== 'rparen') args.push(expr());
        next();
      }
      if (peek()?.kind === 'lparen') {
        next();
        const start = expr();
        if (next()?.kind !== 'colon') fail('expected : after FUNCTION reference');
        const len = peek()?.kind === 'rparen' ? null : expr();
        next();
        refmod = { start, len };
      }
      return { kind: 'function', name, args, refmod };
    }
    if (isW(t, 'LENGTH') && isW(peek(1), 'OF')) {
      next();
      next();
      return { kind: 'function', name: 'LENGTH', args: [{ kind: 'operand', operand: { kind: 'ref', ref: ref() } }], refmod: null };
    }
    return { kind: 'ref', ref: ref() };
  };
  const primaryExpr = (): Expr => {
    const t = peek();
    if (t?.kind === 'lparen') {
      next();
      const e = expr();
      if (next()?.kind !== 'rparen') fail('expected )');
      return e;
    }
    if (t?.kind === 'op' && (t.t === '-' || t.t === '+')) {
      next();
      const inner = powExpr();
      return t.t === '-' ? { kind: 'neg', inner } : inner;
    }
    return { kind: 'operand', operand: operand() };
  };
  const powExpr = (): Expr => {
    let l = primaryExpr();
    while (peek()?.kind === 'op' && peek().t === '**') {
      next();
      l = { kind: 'binary', op: '**', left: l, right: primaryExpr() };
    }
    return l;
  };
  const mulExpr = (): Expr => {
    let l = powExpr();
    while (peek()?.kind === 'op' && (peek().t === '*' || peek().t === '/')) {
      const o = next().t as '*' | '/';
      l = { kind: 'binary', op: o, left: l, right: powExpr() };
    }
    return l;
  };
  const expr = (): Expr => {
    let l = mulExpr();
    while (peek()?.kind === 'op' && (peek().t === '+' || peek().t === '-')) {
      const o = next().t as '+' | '-';
      l = { kind: 'binary', op: o, left: l, right: mulExpr() };
    }
    return l;
  };

  /* -------- conditions -------- */
  const relop = (): RelOp | null => {
    const save = i;
    optW('IS');
    let neg = false;
    if (isW(peek(), 'NOT')) {
      next();
      neg = true;
    }
    const t = peek();
    let op: RelOp | null = null;
    if (t?.kind === 'op' && ['=', '<', '>', '<=', '>=', '<>'].includes(t.t)) {
      next();
      op = t.t as RelOp;
    } else if (isW(t, 'EQUAL', 'EQUALS')) {
      next();
      optW('TO');
      op = '=';
    } else if (isW(t, 'GREATER', 'LESS')) {
      next();
      optW('THAN');
      if (isW(peek(), 'OR') && isW(peek(1), 'EQUAL')) {
        next();
        next();
        optW('TO');
        op = t!.t === 'GREATER' ? '>=' : '<=';
      } else op = t!.t === 'GREATER' ? '>' : '<';
    }
    if (!op) {
      i = save;
      return null;
    }
    if (!neg) return op;
    return ({ '=': '<>', '<': '>=', '>': '<=', '<=': '>', '>=': '<', '<>': '=' } as Record<RelOp, RelOp>)[op];
  };
  let lastRel: { subject: Expr; op: RelOp } | null = null;
  const cprimary = (): Cond => {
    const t = peek();
    if (isW(t, 'NOT')) {
      // NOT followed by a relational operator belongs to an abbreviated relation.
      const save = i;
      if (lastRel) {
        const op = relop();
        if (op) return { kind: 'rel', left: lastRel.subject, op, right: expr() };
        i = save;
      }
      next();
      return { kind: 'not', inner: cprimary() };
    }
    if (t?.kind === 'lparen') {
      const save = i;
      try {
        next();
        const c = cond();
        if (peek()?.kind !== 'rparen') throw new ParseError(t.x, 'expected )');
        next();
        // "(a + b) > c": a parenthesised arithmetic expression starting a relation.
        if (!relopAhead()) return c;
      } catch (e) {
        if (!(e instanceof ParseError)) throw e;
      }
      i = save;
    }
    if (lastRel) {
      const save = i;
      const op = relop();
      if (op) {
        lastRel = { subject: lastRel.subject, op };
        return { kind: 'rel', left: lastRel.subject, op, right: expr() };
      }
      i = save;
    }
    const left = expr();
    const save2 = i;
    optW('IS');
    let neg = false;
    if (isW(peek(), 'NOT') && isW(peek(1), 'NUMERIC', 'ALPHABETIC', 'ALPHABETIC-UPPER', 'ALPHABETIC-LOWER', 'POSITIVE', 'NEGATIVE', 'ZERO')) {
      next();
      neg = true;
    }
    if (isW(peek(), 'NUMERIC', 'ALPHABETIC', 'ALPHABETIC-UPPER', 'ALPHABETIC-LOWER')) return { kind: 'class', operand: left, test: next().t, negated: neg };
    if (isW(peek(), 'POSITIVE', 'NEGATIVE') || (isW(peek(), 'ZERO') && (neg || !relopAheadAt(i + 1)))) {
      if (isW(peek(), 'ZERO') && !neg && peek(1) && !atCondEnd(i + 1)) {
        /* ZERO as an operand of an abbreviated relation is handled below */
      } else return { kind: 'sign', operand: left, test: next().t as any, negated: neg };
    }
    i = save2;
    const op = relop();
    if (op) {
      const right = expr();
      lastRel = { subject: left, op };
      return { kind: 'rel', left, op, right };
    }
    // An operand alone after AND/OR: abbreviated relation with the previous subject and operator.
    if (lastRel && left.kind === 'operand' && (left.operand.kind !== 'ref' || !procNames.has(left.operand.ref.name))) {
      if (left.kind === 'operand' && left.operand.kind === 'ref' && isConditionName(left.operand.ref.name)) return { kind: 'name', ref: left.operand.ref };
      return { kind: 'rel', left: lastRel.subject, op: lastRel.op, right: left };
    }
    if (left.kind === 'operand' && left.operand.kind === 'ref') return { kind: 'name', ref: left.operand.ref };
    return fail('condition');
  };
  const relopAheadAt = (j: number) => {
    const t = toks[j];
    return !!t && ((t.kind === 'op' && ['=', '<', '>', '<=', '>=', '<>'].includes(t.t)) || (t.kind === 'word' && ['EQUAL', 'GREATER', 'LESS', 'NOT', 'IS'].includes(t.t)));
  };
  const relopAhead = () => relopAheadAt(i);
  const atCondEnd = (j: number) => {
    const t = toks[j];
    return !t || t.kind === 'period' || (t.kind === 'word' && (['AND', 'OR', 'THEN'].includes(t.t) || VERBS.has(t.t) || SCOPE_END.has(t.t)));
  };
  const condNames = new Set(data.items.flatMap((it) => it.conditions.map((c) => c.name)));
  const dataNames = new Set([...data.items.map((it) => it.name), ...condNames, 'RETURN-CODE']);
  const isConditionName = (n: string) => condNames.has(n);
  const cand = (): Cond => {
    let c = cprimary();
    while (isW(peek(), 'AND')) {
      next();
      c = { kind: 'and', left: c, right: cprimary() };
    }
    return c;
  };
  const cond = (): Cond => {
    let c = cand();
    while (isW(peek(), 'OR')) {
      next();
      c = { kind: 'or', left: c, right: cand() };
    }
    return c;
  };
  const condition = (): Cond => {
    lastRel = null;
    return cond();
  };

  /* -------- statements -------- */
  const stopSet = (...extra: string[]) => new Set([...extra]);
  const statements = (stop: Set<string>): Stmt[] => {
    const out: Stmt[] = [];
    while (peek() && peek().kind !== 'period' && !(peek().kind === 'word' && (stop.has(peek().t) || SCOPE_END.has(peek().t))) && isHeader(i) === null) {
      if (peek().kind === 'word' && stop.has('NOT') && peek().t === 'NOT') break;
      out.push(statement());
    }
    return out;
  };
  /** Statements of a conditional phrase (AT END, INVALID KEY, ON SIZE ERROR ...). */
  const phrase = (...stops: string[]) => statements(new Set([...stops, 'NOT', 'AT', 'INVALID', 'ON']));
  const textOf = (a: number, b: number) =>
    toks
      .slice(a, b)
      .map((t) => (t.kind === 'string' ? `'${t.t}'` : t.t))
      .join(' ');
  const statement = (): Stmt => {
    const start = i;
    const t0 = peek();
    try {
      const s = statementInner();
      return { ...s, origin: origin(t0), end: origin(toks[i - 1]), text: textOf(start, i) } as Stmt;
    } catch (e) {
      if (!(e instanceof ParseError)) throw e;
      // Recovery: skip to the next statement boundary at this level; keep the text as an untranslated statement.
      i = start + 1;
      let depth = 0;
      while (peek() && peek().kind !== 'period' && isHeader(i) === null) {
        const t = peek();
        if (t.kind === 'word' && (t.t === 'EXEC')) depth++;
        if (t.kind === 'word' && t.t === 'END-EXEC') depth--;
        if (depth <= 0 && t.kind === 'word' && (VERBS.has(t.t) || SCOPE_END.has(t.t))) break;
        next();
      }
      return { kind: 'untranslated', reason: e.message, origin: origin(t0), end: origin(toks[i - 1]), text: textOf(start, i) } as Stmt;
    }
  };
  const targets = (): Target[] => {
    const out: Target[] = [];
    while (peek()?.kind === 'word' && !NOT_DATA.has(peek().t) && !procNames.has(peek().t)) {
      const r = ref();
      out.push({ ref: r, rounded: optW('ROUNDED') });
    }
    return out;
  };
  const refs = (): Ref[] => {
    const out: Ref[] = [];
    while (peek()?.kind === 'word' && !NOT_DATA.has(peek().t) && !procNames.has(peek().t)) out.push(ref());
    return out;
  };
  const sizePhrases = (end: string) => {
    let sizeError: Stmt[] | null = null;
    let notSizeError: Stmt[] | null = null;
    for (;;) {
      if (isW(peek(), 'ON') && isW(peek(1), 'SIZE')) {
        next();
        next();
        expectW('ERROR');
        sizeError = phrase(end);
      } else if (isW(peek(), 'SIZE') && isW(peek(1), 'ERROR')) {
        next();
        next();
        sizeError = phrase(end);
      } else if (isW(peek(), 'NOT') && (isW(peek(1), 'ON', 'SIZE'))) {
        next();
        optW('ON');
        expectW('SIZE');
        expectW('ERROR');
        notSizeError = phrase(end);
      } else break;
    }
    optW(end);
    return { sizeError, notSizeError };
  };
  const keyPhrases = (end: string) => {
    let invalid: Stmt[] | null = null;
    let notInvalid: Stmt[] | null = null;
    let atEnd: Stmt[] | null = null;
    let notAtEnd: Stmt[] | null = null;
    for (;;) {
      if (isW(peek(), 'INVALID')) {
        next();
        optW('KEY');
        invalid = phrase(end);
      } else if (isW(peek(), 'NOT') && isW(peek(1), 'INVALID')) {
        next();
        next();
        optW('KEY');
        notInvalid = phrase(end);
      } else if (isW(peek(), 'AT') && isW(peek(1), 'END')) {
        next();
        next();
        atEnd = phrase(end);
      } else if (isW(peek(), 'END') && !isW(peek(1), 'OF')) {
        next();
        atEnd = phrase(end);
      } else if (isW(peek(), 'NOT') && (isW(peek(1), 'AT') || isW(peek(1), 'END'))) {
        next();
        optW('AT');
        expectW('END');
        notAtEnd = phrase(end);
      } else break;
    }
    optW(end);
    return { invalid, notInvalid, atEnd, notAtEnd };
  };
  const varyings = (): Varying[] => {
    const out: Varying[] = [];
    do {
      const r = ref();
      expectW('FROM');
      const from = expr();
      expectW('BY');
      const by = expr();
      expectW('UNTIL');
      out.push({ ref: r, from, by, until: condition() });
    } while (optW('AFTER'));
    return out;
  };
  const statementInner = (): any => {
    const t = next();
    if (t.kind !== 'word' || !VERBS.has(t.t)) fail(`statement ${t.t}`);
    switch (t.t) {
      case 'MOVE': {
        const corresponding = optW('CORRESPONDING', 'CORR');
        const from = expr();
        expectW('TO');
        const to = refs();
        if (!to.length) fail('MOVE without receiving item');
        return { kind: 'move', from, to, corresponding };
      }
      case 'SET': {
        const ts = refs();
        if (!ts.length) fail('SET target');
        if (optW('UP', 'DOWN')) {
          const up = toks[i - 1].t === 'UP';
          expectW('BY');
          return { kind: 'set_by', targets: ts, up, by: expr() };
        }
        expectW('TO');
        if (isW(peek(), 'TRUE', 'FALSE')) return { kind: 'set_cond', conds: ts, value: next().t === 'TRUE' };
        return { kind: 'set_to', targets: ts, value: expr() };
      }
      case 'INITIALIZE': {
        const ts = refs();
        const replacing: Array<{ category: string; by: Expr }> = [];
        if (optW('REPLACING')) {
          while (isW(peek(), 'ALPHANUMERIC', 'NUMERIC', 'ALPHABETIC', 'ALPHANUMERIC-EDITED', 'NUMERIC-EDITED', 'NATIONAL')) {
            const category = next().t;
            optW('DATA');
            expectW('BY');
            replacing.push({ category, by: expr() });
          }
        }
        return { kind: 'initialize', targets: ts, replacing };
      }
      case 'IF': {
        const c = condition();
        optW('THEN');
        const then = isW(peek(), 'NEXT') && isW(peek(1), 'SENTENCE') ? (next(), next(), [{ kind: 'next_sentence', origin: origin(toks[i - 2]), end: origin(toks[i - 1]), text: 'NEXT SENTENCE' }]) : statements(stopSet('ELSE'));
        let els: Stmt[] = [];
        if (optW('ELSE')) els = isW(peek(), 'NEXT') && isW(peek(1), 'SENTENCE') ? (next(), next(), [{ kind: 'next_sentence', origin: origin(toks[i - 2]), end: origin(toks[i - 1]), text: 'NEXT SENTENCE' } as Stmt]) : statements(stopSet());
        optW('END-IF');
        return { kind: 'if', cond: c, then, else: els };
      }
      case 'EVALUATE': {
        const subjects: any[] = [];
        do {
          if (isW(peek(), 'TRUE', 'FALSE')) subjects.push({ kind: next().t === 'TRUE' ? 'true' : 'false' });
          else {
            const save = i;
            const e = expr();
            if (!isW(peek(), 'ALSO', 'WHEN')) {
              i = save;
              subjects.push({ kind: 'cond', cond: condition() });
            } else subjects.push({ kind: 'expr', expr: e });
          }
        } while (optW('ALSO'));
        const whens: Array<{ alts: WhenObj[][]; body: Stmt[] }> = [];
        let other: Stmt[] | null = null;
        let pending: WhenObj[][] = [];
        while (isW(peek(), 'WHEN')) {
          next();
          if (optW('OTHER')) {
            other = statements(stopSet('WHEN'));
            continue;
          }
          const objs: WhenObj[] = [];
          subjects.forEach((s: any, k: number) => {
            if (k > 0) expectW('ALSO');
            if (optW('ANY')) objs.push({ kind: 'any' });
            else if (s.kind === 'true' || s.kind === 'false') {
              if (isW(peek(), 'TRUE', 'FALSE') && (atCondEnd(i + 1) || isW(peek(1), 'ALSO', 'WHEN'))) objs.push({ kind: next().t === 'TRUE' ? 'true' : 'false' });
              else objs.push({ kind: 'cond', cond: condition() });
            } else if (isW(peek(), 'TRUE', 'FALSE')) objs.push({ kind: next().t === 'TRUE' ? 'true' : 'false' });
            else {
              const negated = optW('NOT');
              const lo = expr();
              const hi = optW('THRU', 'THROUGH') ? expr() : null;
              objs.push({ kind: 'value', lo, hi, negated });
            }
          });
          pending.push(objs);
          // Consecutive WHEN phrases without statements share the next body.
          if (isW(peek(), 'WHEN') && !isW(peek(1), 'OTHER')) continue;
          whens.push({ alts: pending, body: statements(stopSet('WHEN')) });
          pending = [];
        }
        if (pending.length) whens.push({ alts: pending, body: [] });
        optW('END-EVALUATE');
        return { kind: 'evaluate', subjects, whens, other };
      }
      case 'PERFORM': {
        let testAfter = false;
        const loop = () => {
          let times: Expr | null = null;
          let until: Cond | null = null;
          let varying: Varying[] = [];
          if (isW(peek(), 'WITH') || isW(peek(), 'TEST')) {
            optW('WITH');
            expectW('TEST');
            testAfter = next().t === 'AFTER';
          }
          if (optW('UNTIL')) until = condition();
          else if (optW('VARYING')) varying = varyings();
          else if (peek() && (peek().kind === 'number' || (peek().kind === 'word' && !procNames.has(peek().t) && !VERBS.has(peek().t))) && isW(toks[nextAfterOperand(i)], 'TIMES')) {
            times = expr();
            expectW('TIMES');
          }
          return { times, until, varying };
        };
        // A procedure name, or a name that is neither a data item nor a keyword: a PERFORM of a
        // procedure the source does not define (kept; the back end reports it as a gap).
        const w = peek();
        const procLike = w?.kind === 'word' && (procNames.has(w.t) || (!dataNames.has(w.t) && !NOT_DATA.has(w.t) && !FIGS[w.t] && !isW(toks[nextAfterOperand(i)], 'TIMES')));
        if (procLike) {
          const target = next().t;
          const thru = optW('THRU', 'THROUGH') ? next().t : null;
          const l = loop();
          return { kind: 'perform', target, thru, ...l, testAfter };
        }
        const l = loop();
        const body = statements(stopSet('END-PERFORM'));
        expectW('END-PERFORM');
        return { kind: 'perform_inline', body, ...l, testAfter };
      }
      case 'CALL': {
        const target = operand();
        const using: any[] = [];
        let mode: 'REFERENCE' | 'CONTENT' | 'VALUE' = 'REFERENCE';
        if (optW('USING')) {
          for (;;) {
            if (optW('BY')) {
              mode = next().t as any;
              continue;
            }
            if (isW(peek(), 'REFERENCE', 'CONTENT', 'VALUE')) {
              mode = next().t as any;
              continue;
            }
            if (isW(peek(), 'OMITTED')) {
              next();
              using.push({ mode, operand: null });
              continue;
            }
            const p = peek();
            if (!p || p.kind === 'period' || (p.kind === 'word' && (NOT_DATA.has(p.t) && !['ADDRESS', 'LENGTH'].includes(p.t)))) break;
            if (p.kind !== 'word' && p.kind !== 'string' && p.kind !== 'number') break;
            using.push({ mode, operand: operand() });
          }
        }
        const returning = optW('RETURNING') ? ref() : null;
        let onException: Stmt[] | null = null;
        let notOnException: Stmt[] | null = null;
        for (;;) {
          if ((isW(peek(), 'ON') && isW(peek(1), 'EXCEPTION', 'OVERFLOW')) || isW(peek(), 'EXCEPTION', 'OVERFLOW')) {
            optW('ON');
            next();
            onException = phrase('END-CALL');
          } else if (isW(peek(), 'NOT') && (isW(peek(1), 'ON', 'EXCEPTION'))) {
            next();
            optW('ON');
            expectW('EXCEPTION');
            notOnException = phrase('END-CALL');
          } else break;
        }
        optW('END-CALL');
        return { kind: 'call', target, using, returning, onException, notOnException };
      }
      case 'CANCEL': {
        const ts: Operand[] = [];
        while (peek() && (peek().kind === 'string' || (peek().kind === 'word' && !NOT_DATA.has(peek().t)))) ts.push(operand());
        return { kind: 'cancel', targets: ts };
      }
      case 'GOBACK':
        return { kind: 'goback' };
      case 'STOP': {
        if (optW('RUN')) return { kind: 'stop_run' };
        fail('STOP literal');
        return null;
      }
      case 'EXIT': {
        if (optW('PROGRAM')) return { kind: 'exit_program' };
        if (optW('PARAGRAPH')) return { kind: 'exit_paragraph' };
        if (optW('SECTION')) return { kind: 'exit_section' };
        if (optW('PERFORM')) return { kind: 'exit_perform', cycle: optW('CYCLE') };
        return { kind: 'exit' };
      }
      case 'CONTINUE':
        return { kind: 'continue' };
      case 'NEXT':
        expectW('SENTENCE');
        return { kind: 'next_sentence' };
      case 'GO': {
        optW('TO');
        const ts: string[] = [];
        while (peek()?.kind === 'word' && procNames.has(peek().t)) ts.push(next().t);
        if (!ts.length) fail('GO TO without a procedure name');
        let depending: Ref | null = null;
        if (optW('DEPENDING')) {
          optW('ON');
          depending = ref();
        }
        return { kind: 'goto', targets: ts, depending };
      }
      case 'DISPLAY': {
        const items: Expr[] = [];
        while (peek() && peek().kind !== 'period' && !(peek().kind === 'word' && (NOT_DATA.has(peek().t) || procNames.has(peek().t)) && !FIGS[peek().t] && !['FUNCTION', 'LENGTH', 'ALL'].includes(peek().t))) items.push({ kind: 'operand', operand: operand() });
        let upon: string | null = null;
        if (optW('UPON')) upon = next().t;
        let noAdvancing = false;
        if (isW(peek(), 'WITH') || isW(peek(), 'NO')) {
          optW('WITH');
          expectW('NO');
          expectW('ADVANCING');
          noAdvancing = true;
        }
        optW('END-DISPLAY');
        return { kind: 'display', items, upon, noAdvancing };
      }
      case 'ACCEPT': {
        const target = ref();
        let from: string | null = null;
        if (optW('FROM')) {
          const w = next().t;
          from = w;
          if (w === 'DATE' && isW(peek(), 'YYYYMMDD')) from = `DATE ${next().t}`;
          else if (w === 'DAY' && isW(peek(), 'YYYYDDD')) from = `DAY ${next().t}`;
          else if (isW(peek(), 'STAMP')) from = `${w} ${next().t}`;
        }
        optW('END-ACCEPT');
        return { kind: 'accept', target, from };
      }
      case 'OPEN': {
        const entries: any[] = [];
        while (isW(peek(), 'INPUT', 'OUTPUT', 'I-O', 'EXTEND')) {
          const mode = next().t;
          const files: string[] = [];
          while (peek()?.kind === 'word' && !NOT_DATA.has(peek().t) && !['INPUT', 'OUTPUT', 'I-O', 'EXTEND'].includes(peek().t)) files.push(next().t);
          entries.push({ mode, files });
        }
        if (!entries.length) fail('OPEN without a mode');
        return { kind: 'open', entries };
      }
      case 'CLOSE': {
        const files: string[] = [];
        while (peek()?.kind === 'word' && !NOT_DATA.has(peek().t)) files.push(next().t);
        return { kind: 'close', files };
      }
      case 'READ': {
        const file = next().t;
        const next_ = optW('NEXT');
        if (optW('PREVIOUS')) fail('READ PREVIOUS');
        optW('RECORD');
        const into = optW('INTO') ? ref() : null;
        let key: Ref | null = null;
        if (optW('KEY')) {
          optW('IS');
          key = ref();
        }
        const p = keyPhrases('END-READ');
        return { kind: 'read', file, next: next_, into, key, ...p };
      }
      case 'WRITE': {
        const record = ref();
        const from = optW('FROM') ? expr() : null;
        let advancing: string | null = null;
        if (isW(peek(), 'BEFORE', 'AFTER')) {
          const s = i;
          next();
          optW('ADVANCING');
          while (peek() && !atBoundary() && !isW(peek(), 'INVALID', 'NOT', 'AT', 'END-OF-PAGE', 'EOP')) next();
          advancing = textOf(s, i);
        }
        const p = keyPhrases('END-WRITE');
        return { kind: 'write', record, from, invalid: p.invalid, notInvalid: p.notInvalid, advancing };
      }
      case 'REWRITE': {
        const record = ref();
        const from = optW('FROM') ? expr() : null;
        const p = keyPhrases('END-REWRITE');
        return { kind: 'rewrite', record, from, invalid: p.invalid, notInvalid: p.notInvalid };
      }
      case 'DELETE': {
        const file = next().t;
        optW('RECORD');
        const p = keyPhrases('END-DELETE');
        return { kind: 'delete', file, invalid: p.invalid, notInvalid: p.notInvalid };
      }
      case 'START': {
        const file = next().t;
        let op = '=';
        let key: Ref | null = null;
        if (optW('KEY')) {
          const r = relop();
          if (!r) fail('START KEY relation');
          op = r!;
          key = ref();
        }
        const p = keyPhrases('END-START');
        return { kind: 'start', file, op, key, invalid: p.invalid, notInvalid: p.notInvalid };
      }
      case 'ADD':
      case 'SUBTRACT':
      case 'MULTIPLY':
      case 'DIVIDE': {
        const verb = t.t as any;
        if (optW('CORRESPONDING', 'CORR')) fail(`${verb} CORRESPONDING`);
        const operands: Expr[] = [];
        while (peek() && !isW(peek(), 'TO', 'FROM', 'BY', 'INTO', 'GIVING')) operands.push({ kind: 'operand', operand: operand() });
        let to: Target[] = [];
        let giving: Target[] = [];
        let form = '';
        let divisor: Expr | null = null;
        let remainder: Ref | null = null;
        const sep = next();
        form = sep?.t ?? '';
        if (verb === 'ADD' && form === 'GIVING') giving = targets();
        else if ((verb === 'MULTIPLY' && form === 'BY') || (verb === 'DIVIDE' && (form === 'INTO' || form === 'BY'))) {
          // MULTIPLY a BY b [GIVING c]; DIVIDE a INTO b [GIVING c]; DIVIDE a BY b GIVING c.
          const save = i;
          const second = targets();
          if (isW(peek(), 'GIVING')) {
            i = save;
            divisor = { kind: 'operand', operand: operand() };
            next();
            giving = targets();
          } else to = second;
        } else {
          to = targets();
          if (optW('GIVING')) giving = targets();
        }
        if (optW('REMAINDER')) remainder = ref();
        const { sizeError, notSizeError } = sizePhrases(`END-${verb}`);
        return { kind: 'arith', verb, operands, to, giving, form, remainder, divisor, sizeError, notSizeError };
      }
      case 'COMPUTE': {
        const ts = targets();
        if (!(peek()?.kind === 'op' && peek().t === '=') && !isW(peek(), 'EQUAL')) fail('COMPUTE without =');
        next();
        const e = expr();
        const { sizeError, notSizeError } = sizePhrases('END-COMPUTE');
        return { kind: 'compute', targets: ts, expr: e, sizeError, notSizeError };
      }
      case 'STRING': {
        const items: Array<{ src: Expr; delim: Expr | null }> = [];
        const pending: Expr[] = [];
        while (peek() && !isW(peek(), 'INTO')) {
          if (optW('DELIMITED')) {
            optW('BY');
            const d = optW('SIZE') ? null : ({ kind: 'operand', operand: operand() } as Expr);
            for (const p of pending.splice(0)) items.push({ src: p, delim: d });
            continue;
          }
          pending.push({ kind: 'operand', operand: operand() });
        }
        for (const p of pending.splice(0)) items.push({ src: p, delim: null });
        expectW('INTO');
        const into = ref();
        let pointer: Ref | null = null;
        if (isW(peek(), 'WITH') || isW(peek(), 'POINTER')) {
          optW('WITH');
          expectW('POINTER');
          pointer = ref();
        }
        let overflow: Stmt[] | null = null;
        let notOverflow: Stmt[] | null = null;
        for (;;) {
          if ((isW(peek(), 'ON') && isW(peek(1), 'OVERFLOW')) || isW(peek(), 'OVERFLOW')) {
            optW('ON');
            next();
            overflow = phrase('END-STRING');
          } else if (isW(peek(), 'NOT') && isW(peek(1), 'ON', 'OVERFLOW')) {
            next();
            optW('ON');
            expectW('OVERFLOW');
            notOverflow = phrase('END-STRING');
          } else break;
        }
        optW('END-STRING');
        return { kind: 'string', items, into, pointer, overflow, notOverflow };
      }
      case 'EXEC': {
        const lang = next().t;
        const s = i;
        while (peek() && !isW(peek(), 'END-EXEC')) next();
        const body = textOf(s, i);
        expectW('END-EXEC');
        return { kind: 'exec', lang, body };
      }
      default:
        return fail(`statement ${t.t} is not translated by the converter`);
    }
  };
  const nextAfterOperand = (j: number) => {
    let k2 = j + 1;
    if (toks[k2]?.kind === 'lparen') {
      let d = 0;
      for (; k2 < toks.length; k2++) {
        if (toks[k2].kind === 'lparen') d++;
        else if (toks[k2].kind === 'rparen' && --d === 0) return k2 + 1;
      }
    }
    return k2;
  };
  const startsStatementOrEnd = (j: number) => {
    const t = toks[j];
    return !t || t.kind === 'period' || (t.kind === 'word' && (VERBS.has(t.t) || SCOPE_END.has(t.t)));
  };

  /* -------- paragraphs -------- */
  const paragraphs: Paragraph[] = [];
  const sections: Array<{ name: string; first: number; last: number }> = [];
  let section: string | null = null;
  let cur = null as Paragraph | null;
  const newPara = (name: string | null, at: Tok | undefined) => {
    if (cur && (cur.name !== null || cur.sentences.some((s) => s.length))) paragraphs.push(cur);
    cur = { name, section, origin: origin(at), end: origin(at), sentences: [] };
  };
  // Skip DECLARATIVES (reported as unsupported by the back end).
  newPara(null, toks[0]);
  while (i < toks.length) {
    const h = isHeader(i);
    if (h) {
      const at = peek();
      i += h.len;
      if (h.section) {
        if (sections.length) sections[sections.length - 1].last = paragraphs.length + (cur && (cur.name !== null || cur.sentences.some((s) => s.length)) ? 1 : 0) - 1;
        section = h.name;
        newPara(h.name, at);
        sections.push({ name: h.name, first: paragraphs.length, last: -1 });
      } else newPara(h.name, at);
      continue;
    }
    if (isW(peek(), 'END') && isW(peek(1), 'DECLARATIVES')) {
      i += 3;
      continue;
    }
    if (isW(peek(), 'DECLARATIVES')) {
      i += 2;
      continue;
    }
    const sentence = statements(new Set());
    if (peek()?.kind === 'period') next();
    else if (peek() && isHeader(i) === null) {
      // An unexpected token: keep it, with the rest of the sentence, as an untranslated statement.
      const t0 = peek();
      const s = i;
      while (peek() && peek().kind !== 'period' && isHeader(i) === null) next();
      sentence.push({ kind: 'untranslated', reason: `unexpected ${t0.t}`, origin: origin(t0), end: origin(toks[i - 1]), text: textOf(s, i) } as Stmt);
      if (peek()?.kind === 'period') next();
    }
    cur!.sentences.push(sentence);
    if (toks[i - 1]) cur!.end = origin(toks[i - 1]);
  }
  if (cur) paragraphs.push(cur);
  if (sections.length) sections[sections.length - 1].last = paragraphs.length - 1;
  // Section ranges: from the section's own (header) paragraph to the paragraph before the next section.
  for (let s = 0; s < sections.length; s++) {
    sections[s].first = paragraphs.findIndex((p) => p.name === sections[s].name && p.section === sections[s].name);
    sections[s].last = s + 1 < sections.length ? paragraphs.findIndex((p) => p.name === sections[s + 1].name && p.section === sections[s + 1].name) - 1 : paragraphs.length - 1;
  }
  return { program_id: id, file, rel, sha256, includes, lines: xl, data, using, paragraphs, sections, declaratives };
}

/** All statements of a list, depth-first (including nested bodies). */
export function walkStmts(ss: Stmt[], fn: (s: Stmt) => void): void {
  for (const s of ss) {
    fn(s);
    const anyS = s as any;
    for (const k of ['then', 'else', 'body', 'other', 'onException', 'notOnException', 'atEnd', 'notAtEnd', 'invalid', 'notInvalid', 'sizeError', 'notSizeError', 'overflow', 'notOverflow']) if (Array.isArray(anyS[k])) walkStmts(anyS[k], fn);
    if (s.kind === 'evaluate') for (const w of s.whens) walkStmts(w.body, fn);
  }
}

export const relPath = (p: string) => p.split(path.sep).join('/');
