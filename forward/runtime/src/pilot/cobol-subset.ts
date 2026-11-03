/**
 * Strict parser for the COBOL subset the local converter translates (STEP 11,
 * extended in STEP 15 for the constructs the application's programs use). It
 * accepts only constructs whose meaning it can translate exactly and refuses
 * everything else with UnsupportedConstruct; it never guesses. Supported:
 *   data        WORKING-STORAGE elementary items and groups of elementary items (also via COPY);
 *               one LINKAGE group; PIC X(n), 9(n), S9(n), with V9(m) scale; DISPLAY (zoned, or
 *               SIGN LEADING SEPARATE) and binary COMP/COMP-4/BINARY; VALUE; level-88 conditions
 *   verbs       MOVE (incl. reference modification), SET cond TO TRUE, INITIALIZE group|item,
 *               IF/ELSE/END-IF, EVALUATE TRUE|item WHEN ... [OTHER] END-EVALUATE,
 *               PERFORM p [THRU q], CALL 'literal' USING items, GOBACK, EXIT, EXIT PARAGRAPH, CONTINUE
 *   conditions  condition-name | operand [NOT] relop operand | operand IS [NOT] NUMERIC|ALPHABETIC |
 *               NOT c | c AND c | c OR c | abbreviated combined relations (AND|OR [NOT] relop operand)
 * Gap analysis: a CALL whose target has no source among the converter's COBOL files is an undefined
 * external call; a name declared nowhere is an undeclared name; a MOVE of alphanumeric content into a
 * numeric item is an undefined data conversion for non-digit content; a variable MOVE into a binary
 * item may exceed its digits (compiler TRUNC option). Each gets a deterministic ID, its source context,
 * the statements and paragraphs that depend on it, and a stable cross-reference ID.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { codeText, SourceFile, sourceFile } from '../../../verification/src/cobol-source';
import { LayoutNode, parseDataDivision } from '../../../verification/src/layout';

export class UnsupportedConstruct extends Error {
  constructor(readonly line: number, readonly construct: string) {
    super(`unsupported construct at line ${line}: ${construct}`);
  }
}

export type FieldType =
  | { kind: 'alnum'; length: number }
  /** digits = total digit positions (integer + scale). */
  | { kind: 'numeric'; digits: number; scale: number; signed: boolean; usage: 'display' | 'binary'; signSeparate: boolean };
export interface Field {
  name: string;
  section: string;
  level: number;
  line: number;
  type: FieldType;
  offset: number;
  length: number;
  value: string | null;
  group: string | null;
  conditions: Array<{ name: string; values: string[]; line: number }>;
}
export interface DataModel {
  linkage: { name: string; line: number; length: number; fields: Field[] } | null;
  working: Field[];
  groups: Map<string, string[]>;
  conditions: Map<string, { field: string; values: string[]; line: number }>;
  fields: Map<string, Field>;
}

export type RefMod = { start: number; length: number };
export type Operand = { kind: 'field'; name: string; refmod?: RefMod } | { kind: 'number'; value: number; text?: string } | { kind: 'string'; value: string } | { kind: 'figurative'; value: 'ZERO' | 'SPACE' };
export type RelOp = '=' | '<' | '>' | '<=' | '>=' | '<>';
export type Cond =
  | { kind: 'condition'; name: string; line: number }
  | { kind: 'compare'; left: Operand; op: RelOp; right: Operand; line: number }
  | { kind: 'class'; operand: Operand; test: 'NUMERIC' | 'ALPHABETIC'; negated: boolean; line: number }
  | { kind: 'not'; inner: Cond; line: number }
  | { kind: 'and' | 'or'; left: Cond; right: Cond; line: number };
export type Stmt =
  | { kind: 'move'; line: number; end: number; from: Operand; to: string[] }
  | { kind: 'set'; line: number; end: number; condition: string }
  | { kind: 'initialize'; line: number; end: number; targets: string[] }
  | { kind: 'if'; line: number; end: number; cond: Cond; then: Stmt[]; else: Stmt[] }
  | { kind: 'evaluate_true'; line: number; end: number; whens: Array<{ line: number; condition: string; body: Stmt[] }>; other: Stmt[] | null }
  | { kind: 'evaluate'; line: number; end: number; subject: string; whens: Array<{ line: number; lo: number; hi: number; body: Stmt[] }>; other: Stmt[] | null }
  | { kind: 'perform'; line: number; end: number; target: string; thru: string | null }
  | { kind: 'call'; line: number; end: number; target: string; using: string[] }
  | { kind: 'goback' | 'exit' | 'exit_paragraph' | 'continue'; line: number; end: number };
export interface Paragraph {
  name: string | null;
  line: number;
  end_line: number;
  body: Stmt[];
}
export interface ParsedProgram {
  program_id: string;
  file: string;
  sha256: string;
  using: string[];
  data: DataModel;
  paragraphs: Paragraph[];
}

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */

function fieldType(n: LayoutNode, usage: string | null): FieldType {
  const pic = (n.pic ?? '').toUpperCase().replace(/(.)\((\d+)\)/g, (_, c, k) => c.repeat(Number(k)));
  const u = (usage ?? 'DISPLAY').toUpperCase();
  if (/^X+$/.test(pic)) {
    if (u !== 'DISPLAY') throw new UnsupportedConstruct(n.line, `${n.name} PIC X USAGE ${u}`);
    return { kind: 'alnum', length: pic.length };
  }
  const m = /^(S?)(9+)(?:V(9+))?$/.exec(pic);
  if (!m) throw new UnsupportedConstruct(n.line, `${n.name} PIC ${n.pic}`);
  const binary = /^(COMP|COMP-4|BINARY)$/.test(u);
  if (!binary && u !== 'DISPLAY') throw new UnsupportedConstruct(n.line, `${n.name} USAGE ${u}`);
  if (binary && m[3]) throw new UnsupportedConstruct(n.line, `${n.name} binary item with decimal scale`);
  return { kind: 'numeric', digits: m[2].length + (m[3]?.length ?? 0), scale: m[3]?.length ?? 0, signed: m[1] === 'S', usage: binary ? 'binary' : 'display', signSeparate: !!n.sign_separate };
}
const lengthOf = (t: FieldType) => (t.kind === 'alnum' ? t.length : t.usage === 'binary' ? (t.digits <= 4 ? 2 : t.digits <= 9 ? 4 : 8) : t.digits + (t.signSeparate ? 1 : 0));

export function dataModel(file: SourceFile, resolve: (m: string) => SourceFile | null): DataModel {
  const dd = parseDataDivision(file, resolve);
  const conditions = new Map<string, { field: string; values: string[]; line: number }>();
  const fields = new Map<string, Field>();
  const groups = new Map<string, string[]>();
  const leaf = (n: LayoutNode, section: string, offset: number, usage: string | null, group: string | null): Field => {
    if (n.occurs || n.redefines) throw new UnsupportedConstruct(n.line, `${n.name} ${n.occurs ? 'OCCURS' : 'REDEFINES'}`);
    if (fields.has(n.name)) throw new UnsupportedConstruct(n.line, `${n.name} is declared more than once (qualification is outside the subset)`);
    const type = fieldType(n, n.usage ?? usage);
    const f: Field = { name: n.name, section, level: n.level, line: n.line, type, offset, length: lengthOf(type), value: n.values[0] ?? null, group, conditions: n.conditions.map((c) => ({ name: c.name.toUpperCase(), values: c.values, line: c.line })) };
    for (const c of f.conditions) conditions.set(c.name, { field: f.name, values: c.values, line: c.line });
    fields.set(f.name, f);
    return f;
  };
  const children = (r: LayoutNode, section: string) => {
    let off = 0;
    const fs_: Field[] = [];
    for (const c of r.children) {
      if (c.children.length) throw new UnsupportedConstruct(c.line, `nested group ${c.name}`);
      const f = leaf(c, section, off, r.usage, r.name);
      off += f.length;
      fs_.push(f);
    }
    groups.set(r.name, fs_.map((f) => f.name));
    return { fields: fs_, length: off };
  };
  let linkage: DataModel['linkage'] = null;
  const working: Field[] = [];
  for (const r of dd.records) {
    const section = r.section.toUpperCase();
    if (!/WORKING-STORAGE|LINKAGE/.test(section)) throw new UnsupportedConstruct(r.root.line, `${section} records`);
    if (r.root.occurs || r.root.redefines) throw new UnsupportedConstruct(r.root.line, `${r.root.name} ${r.root.occurs ? 'OCCURS' : 'REDEFINES'}`);
    if (/LINKAGE/.test(section)) {
      if (!r.root.children.length || linkage) throw new UnsupportedConstruct(r.root.line, `LINKAGE record ${r.root.name} (exactly one group record is supported)`);
      const g = children(r.root, section);
      linkage = { name: r.root.name, line: r.root.line, length: g.length, fields: g.fields };
    } else if (r.root.children.length) working.push(...children(r.root, section).fields);
    else working.push(leaf(r.root, section, 0, null, null));
  }
  return { linkage, working, groups, conditions, fields };
}

/* ------------------------------------------------------------------ */
/* procedure division                                                  */
/* ------------------------------------------------------------------ */

interface Tok {
  t: string;
  kind: 'word' | 'number' | 'string' | 'period' | 'op' | 'lparen' | 'rparen' | 'colon' | 'other';
  line: number;
}

function tokenize(lines: Array<{ n: number; text: string }>): Tok[] {
  const out: Tok[] = [];
  for (const { n, text } of lines) {
    const re = /\s*(?:('(?:[^']|'')*'|"(?:[^"]|"")*")|(>=|<=|[<>=])|([+-]?\d+(?:\.\d+)?)(?![A-Z0-9-])|([A-Z0-9][A-Z0-9-]*)|(\.)(?=\s|$)|(\()|(\))|(:)|(\S))/giy;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) && m[0].length) {
      if (m[1]) out.push({ t: m[1].slice(1, -1).replace(/''/g, "'").replace(/""/g, '"'), kind: 'string', line: n });
      else if (m[2]) out.push({ t: m[2], kind: 'op', line: n });
      else if (m[3]) out.push({ t: m[3], kind: 'number', line: n });
      else if (m[4]) out.push({ t: m[4].toUpperCase(), kind: 'word', line: n });
      else if (m[5]) out.push({ t: '.', kind: 'period', line: n });
      else if (m[6]) out.push({ t: '(', kind: 'lparen', line: n });
      else if (m[7]) out.push({ t: ')', kind: 'rparen', line: n });
      else if (m[8]) out.push({ t: ':', kind: 'colon', line: n });
      // Kept as a token so the parser refuses the construct (e.g. the statement) that uses it.
      else if (m[9]) out.push({ t: m[9], kind: 'other', line: n });
    }
  }
  return out;
}

const VERBS = new Set(['MOVE', 'SET', 'INITIALIZE', 'IF', 'EVALUATE', 'PERFORM', 'CALL', 'GOBACK', 'EXIT', 'CONTINUE']);
const TERMINATORS = new Set(['ELSE', 'END-IF', 'WHEN', 'END-EVALUATE']);
const CLASS_TESTS = new Set(['NUMERIC', 'ALPHABETIC']);

export function parseProgram(file: string, resolve: (m: string) => SourceFile | null = () => null): ParsedProgram {
  const text = fs.readFileSync(file, 'utf8');
  const src = sourceFile(file, text);
  const id = /PROGRAM-ID\.\s*([A-Z0-9-]+)/i.exec(text)?.[1]?.toUpperCase();
  if (!id) throw new UnsupportedConstruct(1, 'missing PROGRAM-ID');
  const data = dataModel(src, resolve);
  const procAt = src.lines.findIndex((l) => /^\s*PROCEDURE\s+DIVISION\b/i.test(codeText(l) ?? ''));
  if (procAt < 0) throw new UnsupportedConstruct(1, 'missing PROCEDURE DIVISION');
  const lines = src.lines.map((l, i) => ({ n: i + 1, text: codeText(l) ?? '' })).filter((x) => x.n > procAt + 1 && x.text.trim());
  const header = /PROCEDURE\s+DIVISION(?:\s+USING\s+([A-Z0-9 -]+))?\s*\./i.exec(codeText(src.lines[procAt]) ?? '');
  if (!header) throw new UnsupportedConstruct(procAt + 1, 'PROCEDURE DIVISION header');
  const using = (header[1] ?? '').trim().split(/\s+/).filter(Boolean).map((x) => x.toUpperCase());
  const toks = tokenize(lines);
  // Paragraph headers: a word followed by a period at the start of a sentence, written in area A.
  const areaA = new Set(lines.filter((x) => /^ {0,3}[A-Z0-9][A-Z0-9-]*\s*\.\s*$/i.test(x.text)).map((x) => x.n));
  let i = 0;
  const peek = (k = 0) => toks[i + k];
  const next = () => toks[i++];
  const expect = (t: string) => {
    const k = next();
    if (!k || k.t !== t) throw new UnsupportedConstruct(k?.line ?? 0, `expected ${t}, found ${k?.t ?? 'end of program'}`);
    return k;
  };
  const isWord = (k: Tok | undefined, ...ws: string[]) => !!k && k.kind === 'word' && ws.includes(k.t);
  const operand = (): Operand => {
    const k = next();
    if (!k) throw new UnsupportedConstruct(0, 'missing operand');
    if (k.kind === 'number') return { kind: 'number', value: Number(k.t), text: k.t };
    if (k.kind === 'string') return { kind: 'string', value: k.t };
    if (k.kind === 'word' && /^(ZERO|ZEROS|ZEROES)$/.test(k.t)) return { kind: 'figurative', value: 'ZERO' };
    if (k.kind === 'word' && /^(SPACE|SPACES)$/.test(k.t)) return { kind: 'figurative', value: 'SPACE' };
    if (k.kind === 'word' && !VERBS.has(k.t)) {
      if (peek()?.kind === 'lparen') {
        next();
        const s = next();
        expect(':');
        const l = next();
        expect(')');
        if (s?.kind !== 'number' || l?.kind !== 'number') throw new UnsupportedConstruct(k.line, `reference modification of ${k.t} with non-literal bounds`);
        return { kind: 'field', name: k.t, refmod: { start: Number(s.t), length: Number(l.t) } };
      }
      return { kind: 'field', name: k.t };
    }
    throw new UnsupportedConstruct(k.line, `operand ${k.t}`);
  };
  /** [IS] [NOT] relop, or null when the next tokens are not a relational operator. */
  const relop = (): RelOp | null => {
    const save = i;
    if (isWord(peek(), 'IS')) next();
    let neg = false;
    if (isWord(peek(), 'NOT')) {
      next();
      neg = true;
    }
    const k = peek();
    let op: '=' | '<' | '>' | '<=' | '>=' | null = null;
    if (k?.kind === 'op') {
      next();
      op = k.t as any;
    } else if (isWord(k, 'EQUAL', 'GREATER', 'LESS')) {
      next();
      if (isWord(peek(), 'TO', 'THAN')) next();
      if (k.t !== 'EQUAL' && isWord(peek(), 'OR')) throw new UnsupportedConstruct(k.line, `${k.t} OR EQUAL`);
      op = k.t === 'EQUAL' ? '=' : k.t === 'GREATER' ? '>' : '<';
    }
    if (!op) {
      i = save;
      return null;
    }
    if (!neg) return op;
    if (op === '=') return '<>';
    if (op === '<') return '>=';
    if (op === '>') return '<=';
    throw new UnsupportedConstruct(k!.line, `NOT ${op}`);
  };
  let lastRel: { subject: Operand } | null = null;
  const primary = (): Cond => {
    const start = peek();
    if (isWord(start, 'NOT')) {
      next();
      return { kind: 'not', inner: primary(), line: start.line };
    }
    if (start?.kind === 'lparen') throw new UnsupportedConstruct(start.line, 'parenthesised condition');
    // Abbreviated combined relation: [NOT] relop operand, reusing the previous subject.
    const save = i;
    const abbreviated = lastRel ? relop() : null;
    if (abbreviated && lastRel) return { kind: 'compare', left: lastRel.subject, op: abbreviated, right: operand(), line: start.line };
    i = save;
    const left = operand();
    // Class test: [IS] [NOT] NUMERIC|ALPHABETIC.
    const s2 = i;
    if (isWord(peek(), 'IS')) next();
    let neg = false;
    if (isWord(peek(), 'NOT') && CLASS_TESTS.has(peek(1)?.t ?? '')) {
      next();
      neg = true;
    }
    if (isWord(peek(), 'NUMERIC', 'ALPHABETIC')) return { kind: 'class', operand: left, test: next().t as any, negated: neg, line: start.line };
    i = s2;
    const op = relop();
    if (op) {
      lastRel = { subject: left };
      return { kind: 'compare', left, op, right: operand(), line: start.line };
    }
    if (left.kind !== 'field' || left.refmod) throw new UnsupportedConstruct(start.line, 'condition');
    return { kind: 'condition', name: left.name, line: start.line };
  };
  const andTerm = (): Cond => {
    let c = primary();
    while (isWord(peek(), 'AND')) {
      const k = next();
      c = { kind: 'and', left: c, right: primary(), line: k.line };
    }
    return c;
  };
  const condition = (): Cond => {
    lastRel = null;
    let c = andTerm();
    while (isWord(peek(), 'OR')) {
      const k = next();
      c = { kind: 'or', left: c, right: andTerm(), line: k.line };
    }
    return c;
  };
  const statements = (stopAt: Set<string>): Stmt[] => {
    const out: Stmt[] = [];
    while (peek() && peek().kind !== 'period' && !(peek().kind === 'word' && stopAt.has(peek().t))) out.push(statement());
    return out;
  };
  const lastLine = () => toks[i - 1]?.line ?? 0;
  const names = (): string[] => {
    const out: string[] = [];
    while (peek()?.kind === 'word' && !VERBS.has(peek().t) && !TERMINATORS.has(peek().t)) out.push(next().t);
    return out;
  };
  const statement = (): Stmt => {
    const k = next();
    if (k.kind !== 'word' || !VERBS.has(k.t)) throw new UnsupportedConstruct(k.line, `statement ${k.t}`);
    switch (k.t) {
      case 'MOVE': {
        const from = operand();
        expect('TO');
        const to = names();
        if (!to.length) throw new UnsupportedConstruct(k.line, 'MOVE without receiving item');
        return { kind: 'move', line: k.line, end: lastLine(), from, to };
      }
      case 'SET': {
        const c = next();
        expect('TO');
        expect('TRUE');
        return { kind: 'set', line: k.line, end: lastLine(), condition: c.t };
      }
      case 'INITIALIZE': {
        const targets = names();
        if (!targets.length || isWord(peek(), 'REPLACING')) throw new UnsupportedConstruct(k.line, 'INITIALIZE without target or with REPLACING');
        return { kind: 'initialize', line: k.line, end: lastLine(), targets };
      }
      case 'IF': {
        const cond = condition();
        if (peek()?.t === 'THEN') next();
        const then = statements(new Set(['ELSE', 'END-IF']));
        let els: Stmt[] = [];
        if (peek()?.t === 'ELSE') {
          next();
          els = statements(new Set(['END-IF']));
        }
        if (peek()?.t === 'END-IF') next();
        return { kind: 'if', line: k.line, end: lastLine(), cond, then, else: els };
      }
      case 'EVALUATE': {
        const subj = next();
        const isTrue = subj.t === 'TRUE';
        const whens: any[] = [];
        let other: Stmt[] | null = null;
        while (peek()?.t === 'WHEN') {
          const w = next();
          if (peek()?.t === 'OTHER') {
            next();
            other = statements(new Set(['WHEN', 'END-EVALUATE']));
            continue;
          }
          if (isTrue) {
            const c = next();
            if (c.kind !== 'word') throw new UnsupportedConstruct(c.line, `WHEN ${c.t} under EVALUATE TRUE`);
            whens.push({ line: w.line, condition: c.t, body: statements(new Set(['WHEN', 'END-EVALUATE'])) });
          } else {
            const lo = next();
            if (lo.kind !== 'number') throw new UnsupportedConstruct(lo.line, `WHEN ${lo.t}`);
            let hi = lo;
            if (peek()?.t === 'THRU' || peek()?.t === 'THROUGH') {
              next();
              hi = next();
              if (hi.kind !== 'number') throw new UnsupportedConstruct(hi.line, `THRU ${hi.t}`);
            }
            whens.push({ line: w.line, lo: Number(lo.t), hi: Number(hi.t), body: statements(new Set(['WHEN', 'END-EVALUATE'])) });
          }
        }
        expect('END-EVALUATE');
        return isTrue ? { kind: 'evaluate_true', line: k.line, end: lastLine(), whens, other } : { kind: 'evaluate', line: k.line, end: lastLine(), subject: subj.t, whens, other };
      }
      case 'PERFORM': {
        const t = next();
        if (t.kind !== 'word') throw new UnsupportedConstruct(t.line, `PERFORM ${t.t}`);
        let thru: string | null = null;
        if (peek()?.t === 'THRU' || peek()?.t === 'THROUGH') {
          next();
          thru = next().t;
        }
        if (peek()?.kind === 'word' && /^(UNTIL|VARYING|TIMES|WITH)$/.test(peek().t)) throw new UnsupportedConstruct(peek().line, `PERFORM ${peek().t}`);
        return { kind: 'perform', line: k.line, end: lastLine(), target: t.t, thru };
      }
      case 'CALL': {
        const t = next();
        if (t.kind !== 'string') throw new UnsupportedConstruct(t.line, 'dynamic CALL (target is not a literal)');
        const using: string[] = [];
        if (peek()?.t === 'USING') {
          next();
          while (peek()?.kind === 'word' && !VERBS.has(peek().t) && !TERMINATORS.has(peek().t)) {
            const u = next().t;
            if (/^BY$|^REFERENCE$|^CONTENT$|^VALUE$/.test(u)) throw new UnsupportedConstruct(t.line, `CALL ... BY ${u}`);
            using.push(u);
          }
        }
        return { kind: 'call', line: k.line, end: lastLine(), target: t.t.toUpperCase(), using };
      }
      case 'GOBACK':
        return { kind: 'goback', line: k.line, end: k.line };
      case 'EXIT':
        if (isWord(peek(), 'PARAGRAPH')) {
          next();
          return { kind: 'exit_paragraph', line: k.line, end: k.line };
        }
        if (isWord(peek(), 'PROGRAM', 'SECTION', 'PERFORM')) throw new UnsupportedConstruct(k.line, `EXIT ${peek().t}`);
        return { kind: 'exit', line: k.line, end: k.line };
      default:
        return { kind: 'continue', line: k.line, end: k.line };
    }
  };

  const paragraphs: Paragraph[] = [];
  let cur: Paragraph = { name: null, line: toks[0]?.line ?? procAt + 2, end_line: 0, body: [] };
  while (i < toks.length) {
    const k = peek();
    if (k.kind === 'word' && areaA.has(k.line) && toks[i + 1]?.kind === 'period') {
      if (cur.body.length || cur.name) paragraphs.push(cur);
      cur = { name: k.t, line: k.line, end_line: 0, body: [] };
      i += 2;
      continue;
    }
    cur.body.push(...statements(new Set()));
    if (peek()?.kind === 'period') next();
    else if (peek()) throw new UnsupportedConstruct(peek().line, `unexpected ${peek().t}`);
  }
  paragraphs.push(cur);
  for (let p = 0; p < paragraphs.length; p++) paragraphs[p].end_line = (paragraphs[p + 1]?.line ?? src.lines.length + 1) - 1;
  const sha256 = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return { program_id: id, file, sha256, using, data, paragraphs };
}

/* ------------------------------------------------------------------ */
/* walking and gap analysis                                            */
/* ------------------------------------------------------------------ */

export function walk(ss: Stmt[], fn: (s: Stmt, depth: number) => void, depth = 0): void {
  for (const s of ss) {
    fn(s, depth);
    if (s.kind === 'if') {
      walk(s.then, fn, depth + 1);
      walk(s.else, fn, depth + 1);
    } else if (s.kind === 'evaluate_true' || s.kind === 'evaluate') {
      for (const w of s.whens as any[]) walk(w.body, fn, depth + 1);
      if (s.other) walk(s.other, fn, depth + 1);
    }
  }
}

export function condNames(c: Cond): string[] {
  const op = (o: Operand) => (o.kind === 'field' ? [o.name] : []);
  switch (c.kind) {
    case 'condition':
      return [c.name];
    case 'compare':
      return [...op(c.left), ...op(c.right)];
    case 'class':
      return op(c.operand);
    case 'not':
      return condNames(c.inner);
    default:
      return [...condNames(c.left), ...condNames(c.right)];
  }
}

export function namesOf(s: Stmt): string[] {
  const op = (o: Operand) => (o.kind === 'field' ? [o.name] : []);
  switch (s.kind) {
    case 'move':
      return [...op(s.from), ...s.to];
    case 'set':
      return [s.condition];
    case 'initialize':
      return s.targets;
    case 'if':
      return condNames(s.cond);
    case 'evaluate':
      return [s.subject];
    case 'evaluate_true':
      return s.whens.map((w) => w.condition);
    case 'call':
      return s.using;
    default:
      return [];
  }
}

/** Paragraph indexes a PERFORM executes (THRU ranges in source order). */
export function performRange(p: ParsedProgram, s: { target: string; thru: string | null; line: number }): number[] {
  const a = p.paragraphs.findIndex((x) => x.name === s.target);
  const b = s.thru ? p.paragraphs.findIndex((x) => x.name === s.thru) : a;
  if (a < 0 || b < 0 || b < a) throw new UnsupportedConstruct(s.line, `PERFORM ${s.target}${s.thru ? ` THRU ${s.thru}` : ''} (target not found or range reversed)`);
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}

export interface Gap {
  gap_id: string;
  /** Cross-reference to the program-wide gap identity used by the approval closure and the Step 12 handoff. */
  stable_ref: string;
  kind: 'UNDEFINED_EXTERNAL_CALL' | 'UNDECLARED_NAME' | 'DATA_CONVERSION_UNDEFINED' | 'COMPILER_OPTION_DEPENDENT';
  subject: string;
  description: string;
  origin: { file: string; sha256: string; paragraph: string | null; line: number; end_line: number; excerpt: Array<{ line: number; text: string }> };
  affected_items: string[];
  dependent_statements: Array<{ line: number; kind: string; reason: string }>;
  affected_paragraphs: string[];
  reached_from: Array<{ paragraph: string | null; line: number; via: string }>;
  status: 'OPEN';
  resolution_required: string;
}

const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A data item with a VALUE that no statement of the program changes (a constant). */
export function isConstant(p: ParsedProgram, name: string): boolean {
  const f = p.data.fields.get(name);
  if (!f || f.value === null) return false;
  let written = false;
  for (const q of p.paragraphs)
    walk(q.body, (s) => {
      if ((s.kind === 'move' && s.to.includes(name)) || (s.kind === 'initialize' && (s.targets.includes(name) || (f.group !== null && s.targets.includes(f.group)))) || (s.kind === 'set' && p.data.conditions.get(s.condition)?.field === name) || (s.kind === 'call' && s.using.includes(name))) written = true;
    });
  return !written;
}

/** Undefined external calls, undeclared names and undefined data conversions, each with what depends on it. */
export function findGaps(p: ParsedProgram, availablePrograms: Set<string>, srcLines: string[]): Gap[] {
  const gaps: Gap[] = [];
  const declared = new Set([...p.data.fields.keys(), ...p.data.conditions.keys(), ...p.data.groups.keys(), ...(p.data.linkage ? [p.data.linkage.name] : [])]);
  const excerpt = (from: number, to: number) => srcLines.slice(from - 1, to).map((text, k) => ({ line: from + k, text }));
  const performers = (idx: number) => {
    const out: Array<{ paragraph: string | null; line: number; via: string }> = [];
    p.paragraphs.forEach((q) =>
      walk(q.body, (s) => {
        if (s.kind === 'perform' && performRange(p, s).includes(idx)) out.push({ paragraph: q.name, line: s.line, via: `PERFORM ${s.target}${s.thru ? ` THRU ${s.thru}` : ''}` });
      }),
    );
    return out;
  };
  p.paragraphs.forEach((para, idx) => {
    const flat: Stmt[] = [];
    walk(para.body, (s) => flat.push(s));
    const pname = para.name ?? '(unnamed)';
    flat.forEach((s, k) => {
      if (s.kind === 'call' && !availablePrograms.has(s.target)) {
        const tainted = new Set(s.using);
        const dependent: Array<{ line: number; kind: string; reason: string }> = [];
        for (const x of flat.slice(k + 1)) {
          if (dependent.some((d) => d.line === x.line)) continue;
          if (!namesOf(x).some((n) => tainted.has(n))) continue;
          dependent.push({ line: x.line, kind: x.kind, reason: `uses ${namesOf(x).filter((n) => tainted.has(n)).join(', ')} after the call` });
          // Everything nested under a dependent condition depends on it too.
          if (x.kind === 'if' || x.kind === 'evaluate' || x.kind === 'evaluate_true') walk(x.kind === 'if' ? [...x.then, ...x.else] : [...(x.whens as any[]).flatMap((w) => w.body), ...(x.other ?? [])], (y) => dependent.push({ line: y.line, kind: y.kind, reason: `nested under the dependent ${x.kind.toUpperCase().replace('_TRUE', '')} at line ${x.line}` }));
        }
        gaps.push({
          gap_id: '',
          stable_ref: `GAP-${slug(p.program_id)}-${slug(pname)}-CALL-${slug(s.target)}`,
          kind: 'UNDEFINED_EXTERNAL_CALL',
          subject: s.target,
          description: `CALL '${s.target}' has no source among the converter's programs: its behaviour and its effect on ${s.using.join(', ') || 'shared data'} are unknown`,
          origin: { file: path.basename(p.file), sha256: p.sha256, paragraph: para.name, line: s.line, end_line: s.end, excerpt: excerpt(para.line, para.end_line) },
          affected_items: s.using,
          dependent_statements: [{ line: s.line, kind: 'call', reason: 'the call itself' }, ...dependent],
          affected_paragraphs: [pname],
          reached_from: performers(idx),
          status: 'OPEN',
          resolution_required: `the source or an approved specification of ${s.target} (behaviour, parameters, effect on each argument and its return values)`,
        });
      }
      if (s.kind === 'move') {
        const src = s.from.kind === 'field' ? p.data.fields.get(s.from.name) : null;
        for (const t of s.to) {
          const tf = p.data.fields.get(t);
          if (!tf || tf.type.kind !== 'numeric') continue;
          const alnumSource = (src && src.type.kind === 'alnum') || (s.from.kind === 'field' && !!s.from.refmod) || (s.from.kind === 'field' && p.data.groups.has(s.from.name));
          if (alnumSource)
            gaps.push({ gap_id: '', stable_ref: `GAP-${slug(p.program_id)}-${slug(pname)}-ALNUM-TO-NUMERIC-${slug(t)}`, kind: 'DATA_CONVERSION_UNDEFINED', subject: t, description: `MOVE of alphanumeric ${s.from.kind === 'field' ? s.from.name : ''} to numeric ${t}: defined only when the content is all digits; otherwise the result depends on the compiler and the data representation`, origin: { file: path.basename(p.file), sha256: p.sha256, paragraph: para.name, line: s.line, end_line: s.end, excerpt: excerpt(s.line, s.end) }, affected_items: [t], dependent_statements: [{ line: s.line, kind: 'move', reason: 'content that is not all digits' }], affected_paragraphs: [pname], reached_from: performers(idx), status: 'OPEN', resolution_required: 'the business rule for non-digit input, or the compiler options and a captured legacy run' });
          else if (tf.type.usage === 'binary' && src && src.type.kind === 'numeric' && !(isConstant(p, src.name) && Math.abs(Number(src.value)) < 10 ** tf.type.digits) && src.type.digits - src.type.scale > tf.type.digits)
            gaps.push({ gap_id: '', stable_ref: `GAP-${slug(p.program_id)}-${slug(pname)}-TRUNC-${slug(t)}`, kind: 'COMPILER_OPTION_DEPENDENT', subject: t, description: `MOVE of ${src.name} into binary ${t}: values beyond ${tf.type.digits} digits behave according to the compiler TRUNC option`, origin: { file: path.basename(p.file), sha256: p.sha256, paragraph: para.name, line: s.line, end_line: s.end, excerpt: excerpt(s.line, s.end) }, affected_items: [t], dependent_statements: [{ line: s.line, kind: 'move', reason: `values beyond ${tf.type.digits} digits` }], affected_paragraphs: [pname], reached_from: performers(idx), status: 'OPEN', resolution_required: 'the compile options (TRUNC) of the legacy program' });
        }
      }
      for (const n of namesOf(s)) {
        if (!declared.has(n) && !gaps.some((g) => g.kind === 'UNDECLARED_NAME' && g.subject === n))
          gaps.push({
            gap_id: '',
            stable_ref: `GAP-${slug(p.program_id)}-${slug(pname)}-${slug(n)}`,
            kind: 'UNDECLARED_NAME',
            subject: n,
            description: `${n} is used but declared nowhere in the converter's sources`,
            origin: { file: path.basename(p.file), sha256: p.sha256, paragraph: para.name, line: s.line, end_line: s.end, excerpt: excerpt(s.line, s.end) },
            affected_items: [n],
            dependent_statements: flat.filter((x) => namesOf(x).includes(n)).map((x) => ({ line: x.line, kind: x.kind, reason: `uses ${n}` })),
            affected_paragraphs: [pname],
            reached_from: performers(idx),
            status: 'OPEN',
            resolution_required: `a declaration (layout and meaning) of ${n}`,
          });
      }
    });
  });
  gaps.forEach((g, k) => (g.gap_id = `GAP-${p.program_id}-${String(k + 1).padStart(4, '0')}`));
  return gaps;
}
