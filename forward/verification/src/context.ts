/**
 * Dependency-aware COBOL source-context resolution (STEP 9). Pure functions
 * over the original source text and the parsed DATA DIVISION (COPY members
 * expanded by `parseDataDivision`):
 *   - a symbol index of data items and level-88 condition names with their
 *     parent item, ancestors (for qualification), declaring file and line,
 *     declared VALUE(S) and COPY inclusion chain;
 *   - the logical text of a statement range (comments dropped, continued
 *     literals joined, literals separated from words);
 *   - the data names a statement references, resolved with OF/IN
 *     qualification; ambiguous or undefined names stay unresolved;
 *   - support for each literal a claim states: inside the statement, or the
 *     declared VALUE of a condition the statement actually SETs or tests.
 * A literal that merely occurs elsewhere in the source never supports a
 * claim: a dependency from the cited statement to the declaration is
 * required. Business interpretation is never established here.
 */
import { DataDivision, LayoutNode } from './layout';
import { codeText, SourceFile } from './cobol-source';

export interface IncludeLink {
  member: string;
  included_from: string;
  line: number;
}

export interface SymbolDef {
  kind: 'item' | 'condition';
  name: string;
  file: string;
  line: number;
  level: number;
  values: string[];
  /** Ancestor names from the record root down to the parent (for OF/IN qualification). */
  ancestors: string[];
  parent: { name: string; line: number; file: string } | null;
  record: string;
  include_chain: IncludeLink[];
}

export interface SymbolIndex {
  byName: Map<string, SymbolDef[]>;
  unresolvedIncludes: Array<{ name: string; file: string; line: number; circular: boolean }>;
}

const base = (p: string) => p.replace(/\\/g, '/').split('/').pop()!.replace(/\.[^.]+$/, '').toUpperCase();

/** COPY chain from the program down to the file that declares a symbol (by member name = file stem). */
function chainFor(dd: DataDivision, file: string, programFile: string): IncludeLink[] {
  const chain: IncludeLink[] = [];
  let cur = file;
  const seen = new Set<string>();
  while (cur !== programFile && !seen.has(cur)) {
    seen.add(cur);
    const inc = dd.includes.find((i) => i.resolved && i.name.toUpperCase() === base(cur));
    if (!inc) break;
    chain.unshift({ member: inc.name, included_from: inc.file, line: inc.line });
    cur = inc.file;
  }
  return chain;
}

export function buildSymbolIndex(dd: DataDivision, programFile: string): SymbolIndex {
  const byName = new Map<string, SymbolDef[]>();
  const add = (d: SymbolDef) => (byName.get(d.name) ?? byName.set(d.name, []).get(d.name)!).push(d);
  const walk = (n: LayoutNode, ancestors: string[], record: string, parent: LayoutNode | null) => {
    add({ kind: 'item', name: n.name, file: n.file, line: n.line, level: n.level, values: n.values, ancestors, parent: parent ? { name: parent.name, line: parent.line, file: parent.file } : null, record, include_chain: chainFor(dd, n.file, programFile) });
    for (const c of n.conditions) add({ kind: 'condition', name: c.name.toUpperCase(), file: n.file, line: c.line, level: 88, values: c.values, ancestors: [...ancestors, n.name], parent: { name: n.name, line: n.line, file: n.file }, record, include_chain: chainFor(dd, n.file, programFile) });
    for (const ch of n.children) walk(ch, [...ancestors, n.name], record, n);
  };
  for (const r of dd.records) walk(r.root, [], r.root.name, null);
  return { byName, unresolvedIncludes: dd.includes.filter((i) => !i.resolved || i.circular).map((i) => ({ name: i.name, file: i.file, line: i.line, circular: i.circular })) };
}

export interface LogicalText {
  /** Upper-case code with literals replaced by placeholders (for word scanning). */
  words: string;
  /** Literals in order of appearance (continuations joined). */
  literals: string[];
  lines: Array<{ line: number; text: string; comment: boolean; continuation: boolean }>;
}

/** Logical statement text of lines from..to: comments dropped, continuation lines joined into the open literal. */
export function logicalText(f: SourceFile, from: number, to: number): LogicalText {
  let code = '';
  const lines: LogicalText['lines'] = [];
  for (let n = Math.max(1, from); n <= Math.min(f.lines.length, to); n++) {
    const raw = f.lines[n - 1] ?? '';
    const c = codeText(raw);
    const continuation = raw.length >= 7 && /^[ 0-9]{6}$/.test(raw.slice(0, 6)) && raw[6] === '-';
    lines.push({ line: n, text: raw, comment: c === null, continuation });
    if (c === null) continue;
    if (continuation) {
      // Continued literal: the text resumes after the first quote of the continuation line.
      const t = c.replace(/^\s*/, '');
      const q = t.search(/['"]/);
      code = code.replace(/\s+$/, '') + (q >= 0 ? t.slice(q + 1) : t);
    } else code += ' ' + c;
  }
  const literals: string[] = [];
  const words = code.replace(/'([^']*)'|"([^"]*)"/g, (_, a, b) => {
    literals.push(a ?? b);
    return ` __LIT${literals.length - 1}__ `;
  }).toUpperCase();
  return { words, literals, lines };
}

export interface Reference {
  name: string;
  qualifiers: string[];
  usage: 'sets_true' | 'sets_false' | 'tested' | 'referenced';
  resolution: 'resolved' | 'ambiguous' | 'undefined';
  definition: SymbolDef | null;
  candidates: number;
}

const RESERVED = new Set(['IF', 'ELSE', 'END-IF', 'EVALUATE', 'WHEN', 'OTHER', 'END-EVALUATE', 'SET', 'TO', 'TRUE', 'FALSE', 'MOVE', 'NOT', 'AND', 'OR', 'THRU', 'THROUGH', 'PERFORM', 'UNTIL', 'ALSO', 'OF', 'IN', 'COMPUTE', 'ADD', 'SUBTRACT', 'GIVING', 'DISPLAY', 'EXEC', 'SQL', 'END-EXEC', 'INTO', 'FROM', 'WHERE', 'SELECT', 'CONTINUE', 'GOBACK', 'EXIT', 'ZERO', 'ZEROS', 'ZEROES', 'SPACE', 'SPACES', 'IS', 'EQUAL', 'GREATER', 'LESS', 'THAN', 'CALL', 'USING', 'BY', 'REFERENCE', 'CONTENT', 'VALUE']);

/** Resolves a (possibly qualified) name against the index. */
export function resolveName(idx: SymbolIndex, name: string, qualifiers: string[]): { resolution: Reference['resolution']; definition: SymbolDef | null; candidates: number } {
  const all = idx.byName.get(name.toUpperCase()) ?? [];
  const fit = all.filter((d) => qualifiers.every((q) => d.ancestors.includes(q.toUpperCase()) || d.record === q.toUpperCase()));
  if (!fit.length) return { resolution: 'undefined', definition: null, candidates: all.length };
  // Duplicate definitions with identical declarations (the same copybook expanded twice) are one symbol.
  const distinct = [...new Map(fit.map((d) => [`${d.file}:${d.line}:${d.ancestors.join('.')}`, d])).values()];
  if (distinct.length > 1) return { resolution: 'ambiguous', definition: null, candidates: distinct.length };
  return { resolution: 'resolved', definition: distinct[0], candidates: 1 };
}

/** Data and condition names referenced by a statement, with qualification and usage. */
export function statementReferences(idx: SymbolIndex, t: LogicalText): Reference[] {
  const toks = t.words.split(/[\s(),.:=<>+*/]+/).filter(Boolean);
  const out: Reference[] = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    if (!/^[A-Z][A-Z0-9-]*$/.test(w) || RESERVED.has(w) || /^__LIT/.test(w)) continue;
    if ((toks[i - 1] === 'OF' || toks[i - 1] === 'IN') && i > 1) continue; // qualifier of the previous name
    const qualifiers: string[] = [];
    for (let j = i + 1; j + 1 < toks.length && (toks[j] === 'OF' || toks[j] === 'IN'); j += 2) qualifiers.push(toks[j + 1]);
    const r = resolveName(idx, w, qualifiers);
    if (r.resolution === 'undefined' && !(idx.byName.has(w))) {
      // Not a data name of this program (verb, paragraph, figurative constant): ignore unless it looks qualified.
      if (!qualifiers.length) continue;
    }
    const after = toks.slice(i + 1 + qualifiers.length * 2, i + 4 + qualifiers.length * 2);
    const before = toks[i - 1];
    const isCond = r.definition?.kind === 'condition' || (idx.byName.get(w) ?? []).some((d) => d.kind === 'condition');
    const usage: Reference['usage'] = before === 'SET' || (toks[i - 2] === 'SET' && false) ? (after[0] === 'TO' && after[1] === 'TRUE' ? 'sets_true' : after[0] === 'TO' && after[1] === 'FALSE' ? 'sets_false' : 'referenced') : isCond && ['IF', 'WHEN', 'NOT', 'AND', 'OR', 'UNTIL'].includes(before ?? '') ? 'tested' : 'referenced';
    out.push({ name: w, qualifiers, usage, resolution: r.resolution, definition: r.definition, candidates: r.candidates });
  }
  return out;
}

export type LiteralSupport = 'in_statement' | 'declared_value_of_referenced_condition' | 'unrelated_occurrence_only' | 'ambiguous_condition' | 'unsupported';

export interface LiteralResult {
  literal: string;
  support: LiteralSupport;
  via: Array<{ condition: string; usage: Reference['usage']; definition: SymbolDef }>;
  unrelated: Array<{ name: string; file: string; line: number }>;
}

/**
 * Support for each claimed literal from one statement: present in the statement text,
 * or the declared VALUE of a condition the statement SETs or tests (resolved
 * unambiguously). Occurrences with no such dependency are reported, never counted.
 */
export function literalSupport(idx: SymbolIndex, t: LogicalText, refs: Reference[], claimed: string[]): LiteralResult[] {
  const lits = t.literals.map((l) => l.toUpperCase());
  // A multi-character value quoted from part of a longer literal (e.g. a DISPLAY message) is in the statement;
  // a single character must equal a whole literal, so 'A' never matches inside 'ABC'.
  const inStmtLit = (v: string) => lits.some((l) => l === v || (v.length >= 2 && l.includes(v)));
  const numbers = new Set((t.words.match(/\b\d+\b/g) ?? []).map(String));
  const conds = refs.filter((r) => r.usage !== 'referenced' || r.definition?.kind === 'condition');
  return claimed.map((lit) => {
    const L = lit.toUpperCase();
    if (inStmtLit(L) || (/^\d+$/.test(L) && numbers.has(L))) return { literal: lit, support: 'in_statement' as const, via: [], unrelated: [] };
    const via = conds.filter((r) => r.resolution === 'resolved' && r.definition!.kind === 'condition' && r.definition!.values.map((v) => v.toUpperCase()).includes(L)).map((r) => ({ condition: r.name, usage: r.usage, definition: r.definition! }));
    if (via.length) return { literal: lit, support: 'declared_value_of_referenced_condition' as const, via, unrelated: [] };
    const ambiguous = conds.some((r) => r.resolution === 'ambiguous' && (idx.byName.get(r.name) ?? []).some((d) => d.values.map((v) => v.toUpperCase()).includes(L)));
    const unrelated = [...idx.byName.values()].flat().filter((d) => d.values.map((v) => v.toUpperCase()).includes(L)).map((d) => ({ name: d.name, file: d.file, line: d.line }));
    return { literal: lit, support: ambiguous ? ('ambiguous_condition' as const) : unrelated.length ? ('unrelated_occurrence_only' as const) : ('unsupported' as const), via: [], unrelated };
  });
}
