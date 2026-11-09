/**
 * Deterministic dependency closure of one behaviour of one program (STEP 13).
 * It is the evidence base of a `behaviour:` G1 scope.
 *
 * Direct: the statements of the behaviour's PERFORM range (entry paragraph
 * THRU the paragraph every PERFORM of it names).
 *
 * Transitive:
 *   - paragraphs PERFORMed from there (transitively);
 *   - the dispatch statement that triggers the range;
 *   - every statement anywhere in the program that writes a field the
 *     behaviour consumes (directly, through an ancestor group, or by SQL
 *     INTO), with that writer's own dependencies;
 *   - statically CALLed programs;
 *   - copybooks that declare a referenced field or condition;
 *   - when any closure statement or writer is embedded SQL, the program's SQL
 *     communication area includes.
 *
 * Fail-closed. The closure is UNRESOLVED when it meets something it cannot
 * analyse: an unknown name, an ambiguous reference, GO TO, ALTER, a dynamic
 * CALL, EXEC CICS, ENTRY, a missing PERFORM target, conflicting THRU ranges,
 * or unavailable source. A name the program never declares is never
 * "independent". It either belongs to a blocking decision (which then
 * applies) or makes the closure unresolved.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Snapshot } from './snapshot';
import { COBOL_WORDS, reachedStatements, unresolvedNames, usesWord } from './semantic';
import { SourceReader } from '../blockers/deterministic';
import { buildSymbolIndex, logicalText, statementReferences } from '../../../verification/src/context';
import { findItem } from '../../../verification/src/layout';
import { codeText, picFacts } from '../../../verification/src/cobol-source';
import { Statement } from '../../../verification/src/facts';
import { Unit } from '../orchestrator/extracts';

const sha = (o: unknown) => createHash('sha256').update(JSON.stringify(o)).digest('hex');
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const STRUCTURAL = new Set(['EXIT', 'END-IF', 'END-EVALUATE', 'ELSE', 'GOBACK', 'CONTINUE']);
/** Words that are never data names in procedure statements (fail-closed: anything else must resolve). */
const KEYWORDS = new Set([
  ...COBOL_WORDS,
  'IF', 'ELSE', 'END-IF', 'EVALUATE', 'WHEN', 'OTHER', 'END-EVALUATE', 'SET', 'TO', 'TRUE', 'FALSE', 'MOVE', 'NOT', 'AND', 'OR', 'THRU', 'THROUGH',
  'PERFORM', 'END-PERFORM', 'UNTIL', 'ALSO', 'OF', 'IN', 'ADD', 'GIVING', 'EXEC', 'SQL', 'END-EXEC', 'INTO', 'FROM', 'WHERE', 'SELECT', 'INSERT',
  'VALUES', 'GOBACK', 'EXIT', 'ZERO', 'IS', 'EQUAL', 'LESS', 'THAN', 'CALL', 'BY', 'REFERENCE', 'CONTENT', 'THEN', 'END-CALL', 'END-COMPUTE',
  'END-ADD', 'END-SUBTRACT', 'END-MULTIPLY', 'END-DIVIDE', 'END-STRING', 'END-UNSTRING', 'END-READ', 'END-WRITE', 'END-REWRITE', 'END-START',
  'END-DELETE', 'END-SEARCH', 'END-RETURN', 'END-ACCEPT', 'END-DISPLAY', 'MAX', 'MIN', 'NULL', 'FOR', 'ON', 'AT', 'END', 'SIZE', 'ERROR',
  'KEY', 'OPEN', 'CLOSE', 'READ', 'STOP', 'RUN', 'DATE', 'TIME', 'DAY', 'ALL', 'COUNT', 'WITH', 'UP', 'DOWN', 'NO', 'LINE', 'PAGE',
  'PARAGRAPH', 'SECTION',
  // Reserved words of OPEN I-O, READ ... NEXT RECORD, DELETE file, DISPLAY ... UPON and ACCEPT ... FROM DATE YYYYMMDD.
  'I-O', 'NEXT', 'DELETE', 'UPON', 'YYYYMMDD',
]);
/**
 * Compiler-defined data names that need no declaration. They are recorded in the closure (`special_registers`),
 * never treated as keywords: RETURN-CODE is the program's return-code special register (IBM Enterprise COBOL).
 */
const SPECIAL_REGISTERS = new Set(['RETURN-CODE']);

/** Mnemonic names declared in the SPECIAL-NAMES paragraph (`CONSOLE IS CONS`). A mnemonic used but not declared stays unknown. */
function mnemonicNames(prog: Parsed): Set<string> {
  const out = new Set<string>();
  let inside = false;
  for (const raw of prog.file.lines) {
    const t = codeText(raw)?.trim().toUpperCase() ?? '';
    if (!t) continue;
    if (/^SPECIAL-NAMES\b/.test(t)) inside = true;
    else if (inside && /^(INPUT-OUTPUT|FILE-CONTROL|DATA|PROCEDURE|[A-Z0-9-]+\s+(SECTION|DIVISION))\b/.test(t)) break;
    if (inside) for (const m of t.matchAll(/\b[A-Z][A-Z0-9-]*\s+IS\s+([A-Z][A-Z0-9-]*)/g)) out.add(m[1]);
  }
  return out;
}
/** Index names declared by OCCURS ... INDEXED BY in the data division of the program or an included member. */
function indexNames(prog: Parsed): Set<string> {
  const out = new Set<string>();
  const texts = [prog.file.lines, ...prog.includedFiles.map((f) => { try { return fs.readFileSync(f, 'utf8').split(/\r?\n/); } catch { return []; } })];
  for (const lines of texts) {
    const code = lines.map((l) => codeText(l) ?? '').join(' ').toUpperCase().split(/\bPROCEDURE\s+DIVISION\b/)[0];
    for (const m of code.matchAll(/(?<![A-Z0-9-])INDEXED\s+BY\s+([A-Z0-9-]+(?:[\s,]+[A-Z0-9-]+)*)/g))
      for (const w of m[1].split(/[\s,]+/)) if (w && !/^(ASCENDING|DESCENDING|VALUE|VALUES|PIC|PICTURE|USAGE|KEY|IS|DEPENDING|ON|OCCURS|REDEFINES|COMP|COMP-3|BINARY)$/.test(w)) out.add(w);
  }
  return out;
}
const UNANALYSABLE: Array<[RegExp, string]> = [
  [/^GO\b/i, 'GO TO transfers control outside structured PERFORM flow'],
  [/^ALTER\b/i, 'ALTER changes control flow at run time'],
  [/^EXEC\s+CICS\b/i, 'EXEC CICS hands control and data to the transaction monitor'],
  [/^ENTRY\b/i, 'ENTRY adds an alternative entry point'],
];

export interface ClosureStatement {
  line: number;
  end_line: number;
  paragraph: string | null;
  verb: string;
  text: string;
  relation: 'direct' | 'performed' | 'trigger' | 'input_writer';
}
export interface FieldDep {
  name: string;
  kind: 'item' | 'condition';
  declared_in: string;
  line: number;
  values: string[];
  parent: string | null;
  permanent_id: string | null;
  relation: 'direct' | 'transitive';
}
export interface ProgramGap {
  gap_id: string;
  kind: 'UNDECLARED_NAME_SEMANTICS' | 'EXTERNAL_DATABASE_RUNTIME' | 'COMPILER_OPTION_DEPENDENT' | 'DATA_CONVERSION_UNDEFINED';
  paragraph: string | null;
  lines: number[];
  subject: string;
  decisions: string[];
  blocking: boolean;
  missing: string;
  in_closure: boolean;
  why: string;
}
export interface Closure {
  status: 'RESOLVED' | 'UNRESOLVED';
  unresolved_reasons: string[];
  program: string;
  file_id: string;
  source: { path: string; sha256: string | null } | null;
  entry: string;
  range: string[];
  statements: ClosureStatement[];
  paragraphs: { direct: string[]; transitive: string[] };
  fields: FieldDep[];
  inputs: string[];
  outputs: string[];
  input_writers: Array<{ field: string; line: number; paragraph: string | null; text: string; via: string; depends_on: string[]; sql: boolean }>;
  calls: Array<{ target: string; line: number; dynamic: boolean }>;
  external: Array<{ kind: 'embedded_sql' | 'file_io'; line: number; operation: string; target: string | null; relation: string }>;
  undeclared: Array<{ name: string; decisions: string[]; lines: number[] }>;
  /** Compiler-defined special registers the behaviour reads or writes (no declaration exists to depend on). */
  special_registers: Array<{ name: string; lines: number[] }>;
  units: Unit[];
  unit_reasons: Record<string, string>;
  domain_restrictions: Array<{ line: number; item: string; pic: string }>;
  program_gaps: ProgramGap[];
  /** Program-wide names used to attribute decisions (paragraphs, included copybooks, undeclared names). */
  context: { paragraphs: string[]; copybooks: string[]; undeclared: string[]; tables: string[]; data_names: string[] };
  sha256: string;
}

type Parsed = NonNullable<ReturnType<SourceReader['byFileId']>>;

function writesOf(text: string, idx: ReturnType<typeof buildSymbolIndex>): { writes: string[]; via: string } {
  const up = text.toUpperCase().replace(/\.\s*$/, '');
  const out = new Set<string>();
  let via = '';
  if (/^MOVE\b/.test(up)) {
    via = 'MOVE';
    for (const w of (up.split(/\s+TO\s+/)[1] ?? '').split(/[\s,]+/)) if (w) out.add(w);
  } else if (/^SET\b/.test(up)) {
    via = 'SET';
    for (const w of (/^SET\s+(.+?)\s+TO\s+/.exec(up)?.[1] ?? '').split(/[\s,]+/)) if (w) out.add(idx.byName.get(w)?.find((d) => d.kind === 'condition')?.parent?.name ?? w);
  } else if (/^INITIALIZE\s+/.test(up)) {
    via = 'INITIALIZE';
    for (const w of up.replace(/^INITIALIZE\s+/, '').split(/[\s,]+/)) if (w && !KEYWORDS.has(w)) out.add(w);
  } else if (/^EXEC\s+SQL\b/.test(up)) {
    via = 'SQL INTO';
    for (const m of (/\bINTO\b([\s\S]*?)\bFROM\b/.exec(up)?.[1] ?? '').matchAll(/:([A-Z0-9-]+)/g)) out.add(m[1]);
  } else if (/^(ADD|SUBTRACT|COMPUTE|MULTIPLY|DIVIDE|STRING|UNSTRING|ACCEPT|READ|RETURN|INSPECT)\b/.test(up)) {
    // Arithmetic and I/O receivers: the names after TO/GIVING/INTO, or the first operand of COMPUTE/INSPECT.
    via = up.split(/\s+/)[0];
    const m = /\b(?:GIVING|INTO|TO)\s+([A-Z0-9-]+(?:\s*,?\s*[A-Z0-9-]+)*)/.exec(up) ?? /^(?:COMPUTE|INSPECT)\s+([A-Z0-9-]+)/.exec(up);
    for (const w of (m?.[1] ?? '').split(/[\s,]+/)) if (w && !KEYWORDS.has(w)) out.add(w);
  }
  return { writes: [...out], via };
}

export interface MoveHazard {
  kind: 'TRUNC' | 'ALNUM_TO_NUMERIC';
  line: number;
  source: string;
  target: string;
  detail: string;
}

/**
 * Data-conversion hazards of a MOVE whose result is not fully defined by the source:
 *  - TRUNC: a binary receiver fed from a variable item (truncation beyond the PIC digits depends on the compiler
 *    TRUNC option); never for a VALUE constant that no statement changes and that fits the receiver;
 *  - ALNUM_TO_NUMERIC: an alphanumeric (or group) sender into a numeric receiver. The result is defined only when
 *    the sending content is all digits; otherwise it depends on the compiler and the data representation.
 */
export function moveHazards(prog: Parsed, idx: ReturnType<typeof buildSymbolIndex>, s: { line: number; verb: string; text: string }): MoveHazard[] {
  if (s.verb !== 'MOVE') return [];
  const m = /^MOVE\s+([A-Z0-9-]+)(\([^)]*\))?\s+TO\s+(.+?)\.?\s*$/i.exec(s.text.trim());
  if (!m || /^(ZERO|ZEROS|ZEROES|SPACE|SPACES|HIGH-VALUES?|LOW-VALUES?|QUOTES?|ALL)$/i.test(m[1]) || /^[+-]?\d/.test(m[1])) return [];
  const src = findItem(prog.dd, m[1]);
  if (!src) return [];
  const isNumeric = (pic: string | null) => !!pic && /9/.test(pic) && !/[XA]/i.test(pic);
  const srcNumeric = isNumeric(src.node.pic);
  const constant = src.node.values.length > 0 && !prog.pf.statements.some((x) => x.line !== s.line && writesOf(x.text, idx).writes.some((w) => ancestorsOf(idx, src.node.name).includes(w)));
  const out: MoveHazard[] = [];
  for (const t of m[3].split(/[\s,]+/).filter(Boolean)) {
    const tgt = findItem(prog.dd, t);
    if (!tgt || !isNumeric(tgt.node.pic)) continue;
    if (!srcNumeric) out.push({ kind: 'ALNUM_TO_NUMERIC', line: s.line, source: `${m[1]}${m[2] ?? ''}`, target: t, detail: `MOVE of alphanumeric ${m[1]}${m[2] ?? ''} (${src.node.pic ?? 'group'}) to numeric ${t} (PIC ${tgt.node.pic}${/COMP/i.test(tgt.usage) ? ` ${tgt.usage}` : ''}): defined only when the sending content is all digits; otherwise the result depends on the compiler and the data representation` });
    else if (/^(COMP|COMP-4|BINARY)$/i.test(tgt.usage)) {
      const fits = constant && src.node.values.every((v) => Math.abs(Number(v)) < 10 ** picFacts(tgt.node.pic ?? '').digits);
      if (!fits) out.push({ kind: 'TRUNC', line: s.line, source: m[1], target: t, detail: `binary ${t} (PIC ${tgt.node.pic} ${tgt.usage}) fed from variable ${m[1]}: values beyond ${picFacts(tgt.node.pic ?? '').digits} digits behave according to the compiler TRUNC option` });
    }
  }
  return out;
}

/** The names a statement writes, including every ancestor group (a group write overwrites its members). */
function ancestorsOf(idx: ReturnType<typeof buildSymbolIndex>, name: string): string[] {
  const d = idx.byName.get(name)?.[0];
  return d ? [...d.ancestors, name] : [name];
}

export function behaviourClosure(snap: Snapshot, program: string, entry: string, reader: SourceReader = new SourceReader(snap)): Closure {
  const reasons: string[] = [];
  const p = snap.sys.programs.find((x) => x.program_id === program);
  if (!p) throw new Error(`unknown program in scope: ${program}`);
  const empty = (why: string): Closure => ({ status: 'UNRESOLVED', unresolved_reasons: [why], program, file_id: p.file_id, source: null, entry, range: [], statements: [], paragraphs: { direct: [], transitive: [] }, fields: [], inputs: [], outputs: [], input_writers: [], calls: [], external: [], undeclared: [], special_registers: [], units: [{ unit_kind: 'program', name: program, file_id: p.file_id }], unit_reasons: { [program]: 'primary' }, domain_restrictions: [], program_gaps: [], context: { paragraphs: [], copybooks: [], undeclared: [], tables: [], data_names: [] }, sha256: sha({ program, entry, why }) });
  const prog: Parsed | null = reader.byFileId(p.file_id);
  if (!prog) return empty('the program source is not available (configure the COBOL source root)');
  const pf = prog.pf;
  const idx = buildSymbolIndex(prog.dd, prog.abs);
  const iEntry = pf.paragraphs.findIndex((q) => q.name === entry.toUpperCase());
  if (iEntry < 0) return empty(`PERFORM target ${entry.toUpperCase()} is not a paragraph of ${program}`);
  const thrus = [...new Set(pf.performs.filter((x) => x.target === pf.paragraphs[iEntry].name).map((x) => x.thru ?? x.target))];
  if (thrus.length > 1) reasons.push(`${entry} is performed with different THRU ranges (${thrus.join(', ')})`);
  const jEnd = thrus.length === 1 ? pf.paragraphs.findIndex((q) => q.name === thrus[0]) : iEntry;
  const range = pf.paragraphs.slice(iEntry, Math.max(iEntry, jEnd) + 1).map((q) => q.name);
  for (const m of pf.missing_targets) reasons.push(`PERFORM/GO TO target ${m.target} (line ${m.line}) is not a paragraph of ${program}`);

  // Direct and performed statements.
  const stmts: ClosureStatement[] = [];
  const add = (s: Statement & { paragraph: string | null }, relation: ClosureStatement['relation']) => {
    if (!stmts.some((x) => x.line === s.line)) stmts.push({ line: s.line, end_line: s.end_line, paragraph: s.paragraph, verb: s.verb, text: s.text, relation });
  };
  const transitiveParas = new Set<string>();
  for (const name of range) {
    const r = reachedStatements(prog, pf.paragraphs.find((q) => q.name === name)!.line);
    for (const s of r.statements) add(s, range.includes(s.paragraph ?? '') ? 'direct' : 'performed');
    for (const x of r.paragraphs) if (!range.includes(x)) transitiveParas.add(x);
  }
  // The dispatch statements that select the range (control-flow interaction).
  for (const per of pf.performs.filter((x) => x.target === pf.paragraphs[iEntry].name)) {
    const host = [...pf.statements].reverse().find((s) => s.line < per.line && s.verb === 'WHEN');
    if (host) add({ ...host, paragraph: [...pf.paragraphs].reverse().find((q) => q.line <= host.line)?.name ?? null }, 'trigger');
  }
  const own = stmts.filter((s) => s.relation !== 'trigger');

  // Unanalysable constructs and calls.
  const calls = pf.calls.filter((c) => own.some((s) => c.line >= s.line && c.line <= s.end_line)).map((c) => ({ target: c.target, line: c.line, dynamic: c.dynamic }));
  for (const c of calls.filter((x) => x.dynamic)) reasons.push(`dynamic CALL at line ${c.line} (target not a literal)`);
  for (const s of own) for (const [re, why] of UNANALYSABLE) if (re.test(s.text)) reasons.push(`line ${s.line}: ${why}`);

  // References: every word must be a keyword, a declared name, a paragraph, a literal or an undeclared name owned by a decision.
  const undeclaredByDecision = unresolvedNames(snap, program, prog, idx);
  const paraNames = new Set(pf.paragraphs.map((q) => q.name));
  const fileNames = new Set([...prog.dd.fds.map((f) => f.name.toUpperCase()), ...pf.io.map((x) => (x.file ?? x.target).toUpperCase())]);
  const fields = new Map<string, FieldDep>();
  const declFile = new Map<string, string>();
  const undeclared = new Map<string, { name: string; decisions: string[]; lines: number[] }>();
  const registers = new Map<string, number[]>();
  const mnemonics = mnemonicNames(prog);
  const indexes = indexNames(prog);
  const fieldId = (name: string, file: string, line: number) => {
    const rel = snap.ctx.srcRoot ? path.relative(snap.ctx.srcRoot, file).split(path.sep).join('/') : file;
    const fid = [...snap.ctx.relByFile.entries()].find(([, r]) => r === rel)?.[0] ?? null;
    const data: any = (snap.set.artifacts as any).data?.data ?? {};
    return (data.field_catalogue ?? []).find((f: any) => f.field_name === name && f.file_id === fid && f.source_line === line)?.field_id ?? (data.condition_catalogue ?? []).find((c: any) => c.condition_name === name && String(c.condition_id ?? '').startsWith(`${fid}-`) && c.source_line === line)?.condition_id ?? null;
  };
  const scan = (s: ClosureStatement, relation: FieldDep['relation']) => {
    const t = logicalText(prog.file, s.line, s.end_line);
    for (const r of statementReferences(idx, t)) {
      if (r.resolution === 'ambiguous') reasons.push(`line ${s.line}: ${r.name} is ambiguous (${r.candidates} declarations)`);
      if (r.resolution !== 'resolved' || !r.definition) continue;
      const d = r.definition;
      declFile.set(r.name, d.file);
      if (!fields.has(r.name) || relation === 'direct') fields.set(r.name, { name: r.name, kind: d.kind, declared_in: path.basename(d.file), line: d.line, values: d.values, parent: d.parent?.name ?? null, permanent_id: fieldId(r.name, d.file, d.line), relation: fields.get(r.name)?.relation === 'direct' ? 'direct' : relation });
    }
    const code = /^EXEC\s+SQL\b/i.test(s.text) ? (s.text.match(/:[A-Z0-9-]+/gi) ?? []).map((x) => x.slice(1)).join(' ') : t.words;
    for (const w of code.split(/[\s(),.:=<>+*/]+/).filter((x) => /^[A-Z][A-Z0-9-]*$/.test(x) && !/^__LIT/.test(x))) {
      if (KEYWORDS.has(w) || idx.byName.has(w) || paraNames.has(w) || fileNames.has(w) || mnemonics.has(w) || indexes.has(w)) continue;
      if (SPECIAL_REGISTERS.has(w)) {
        const ls = registers.get(w) ?? [];
        if (!ls.includes(s.line)) ls.push(s.line);
        registers.set(w, ls);
        continue;
      }
      const ds = undeclaredByDecision.get(w);
      if (ds) {
        const u = undeclared.get(w) ?? { name: w, decisions: ds, lines: [] };
        if (!u.lines.includes(s.line)) u.lines.push(s.line);
        undeclared.set(w, u);
      } else reasons.push(`line ${s.line}: ${w} is neither declared, a keyword, a paragraph nor the subject of a blocking decision (unknown dependency)`);
    }
  };
  for (const s of own) scan(s, s.relation === 'direct' ? 'direct' : 'transitive');
  for (const s of stmts.filter((x) => x.relation === 'trigger')) scan(s, 'transitive');

  // Inputs and outputs of the behaviour (own statements).
  const outputs = new Set<string>();
  const inputs = new Set<string>();
  for (const s of own) {
    const w = writesOf(s.text, idx);
    for (const x of w.writes) outputs.add(x);
    const t = logicalText(prog.file, s.line, s.end_line);
    for (const r of statementReferences(idx, t)) {
      if (r.resolution !== 'resolved' || !r.definition) continue;
      const name = r.definition.kind === 'condition' ? r.definition.parent?.name ?? r.name : r.name;
      if (r.definition.kind === 'condition' && r.usage === 'sets_true') continue;
      if (!w.writes.includes(name) || r.usage === 'tested') inputs.add(name);
    }
  }
  // A field read only after this behaviour wrote it is still an input when another path reads it first; keep reads conservative.
  // Writers of consumed inputs anywhere in the program (data produced by other paragraphs, other invocations).
  const unresolvedForMark = new Map([...undeclaredByDecision.entries()]);
  const input_writers: Closure['input_writers'] = [];
  const paraOf = (line: number) => [...pf.paragraphs].reverse().find((q) => q.line <= line)?.name ?? null;
  for (const s of pf.statements) {
    if (own.some((x) => x.line === s.line)) continue;
    const w = writesOf(s.text, idx);
    if (!w.writes.length) continue;
    const touched = [...inputs].filter((f) => w.writes.some((x) => ancestorsOf(idx, f).includes(x)));
    if (!touched.length) continue;
    // Does the writer itself depend on an unresolved name (directly or by an enclosing condition)?
    const para = paraOf(s.line);
    const paraStmts = pf.statements.filter((x) => paraOf(x.line) === para);
    const depends: string[] = [];
    let depth: string[][] = [];
    for (const x of paraStmts) {
      const ownNames = [...unresolvedForMark.keys()].filter((n) => usesWord(x.text, n));
      if (x.line === s.line) depends.push(...ownNames, ...depth.flat());
      if (x.verb === 'IF' || x.verb === 'EVALUATE') depth.push(ownNames);
      if ((x.verb === 'END-IF' || x.verb === 'END-EVALUATE') && depth.length) depth.pop();
      if (/\.\s*$/.test(x.text)) depth = [];
      if (x.line >= s.line) break;
    }
    const sql = /^EXEC\s+SQL\b/i.test(s.text);
    for (const f of touched) input_writers.push({ field: f, line: s.line, paragraph: para, text: s.text, via: w.via, depends_on: [...new Set(depends)], sql });
    if (!stmts.some((x) => x.line === s.line)) stmts.push({ line: s.line, end_line: s.end_line, paragraph: para, verb: s.verb, text: s.text, relation: 'input_writer' });
  }
  for (const wr of input_writers) for (const n of wr.depends_on) {
    const u = undeclared.get(n) ?? { name: n, decisions: undeclaredByDecision.get(n) ?? [], lines: [] };
    if (!u.lines.includes(wr.line)) u.lines.push(wr.line);
    undeclared.set(n, u);
  }

  // External operations (own statements and input writers).
  const external: Closure['external'] = [];
  for (const s of [...own, ...stmts.filter((x) => x.relation === 'input_writer')]) {
    if (/^EXEC\s+SQL\b/i.test(s.text)) external.push({ kind: 'embedded_sql', line: s.line, operation: /^EXEC\s+SQL\s+(\w+)/i.exec(s.text)?.[1]?.toUpperCase() ?? 'SQL', target: /\b(?:INSERT\s+INTO|FROM|UPDATE)\s+([A-Z][A-Z0-9_]*)/i.exec(s.text)?.[1]?.toUpperCase() ?? null, relation: s.relation });
  }
  for (const x of pf.io.filter((io) => [...own, ...stmts.filter((y) => y.relation === 'input_writer')].some((s) => io.line >= s.line && io.line <= s.end_line))) external.push({ kind: 'file_io', line: x.line, operation: x.verb, target: x.file ?? x.target, relation: 'direct' });

  // Units: the program, copybooks declaring referenced names, called programs, and SQL includes when SQL is involved.
  const units: Unit[] = [{ unit_kind: 'program', name: program, file_id: p.file_id }];
  const unit_reasons: Record<string, string> = { [program]: 'primary: the behaviour belongs to it' };
  const addUnit = (u: Unit, why: string) => {
    if (units.some((x) => x.file_id === u.file_id)) return;
    units.push(u);
    unit_reasons[u.name] = why;
  };
  const fileIdOf = (abs: string) => {
    const rel = snap.ctx.srcRoot ? path.relative(snap.ctx.srcRoot, abs).split(path.sep).join('/') : abs;
    return [...snap.ctx.relByFile.entries()].find(([, r]) => r === rel)?.[0] ?? null;
  };
  for (const f of fields.values()) {
    const fid = fileIdOf(declFile.get(f.name)!);
    const cb = fid ? snap.sys.copybooks.find((c) => c.file_id === fid) : null;
    if (cb?.file_id) addUnit({ unit_kind: 'copybook', name: cb.name, file_id: cb.file_id }, `declares ${[...fields.values()].filter((x) => x.declared_in === f.declared_in).map((x) => x.name).join(', ')}`);
    else if (fid !== p.file_id) reasons.push(`${f.name} is declared in ${f.declared_in}, which is neither the program nor an inventoried copybook`);
  }
  for (const c of calls.filter((x) => !x.dynamic)) {
    const q = snap.sys.programs.find((x) => x.program_id === c.target);
    if (q) addUnit({ unit_kind: 'program', name: q.program_id, file_id: q.file_id }, `CALLed at line ${c.line}`);
    else reasons.push(`CALL '${c.target}' at line ${c.line}: the called program is not in the inventory`);
  }
  if (external.some((e) => e.kind === 'embedded_sql')) {
    for (const e of snap.sys.edges.filter((x: any) => x.from === program && x.type === 'SQL_INCLUDE')) {
      const cb = snap.sys.copybooks.find((c) => c.name === e.to && c.file_id);
      if (cb) addUnit({ unit_kind: 'copybook', name: cb.name, file_id: cb.file_id! }, `SQL communication area: embedded SQL at line(s) ${external.filter((x) => x.kind === 'embedded_sql').map((x) => x.line).join(', ')} updates it implicitly`);
    }
  }

  // Binary receiving items moved from another item: truncation depends on the compiler TRUNC option.
  const domain_restrictions = own.flatMap((s) => moveHazards(prog, idx, s).filter((h) => h.kind === 'TRUNC').map((h) => ({ line: h.line, item: h.target, pic: h.detail })));

  const program_gaps = programGaps(snap, program, prog, idx, undeclaredByDecision, new Set(stmts.map((s) => s.line)), new Set(own.map((s) => s.line)));
  const status = reasons.length ? 'UNRESOLVED' : 'RESOLVED';
  const body = {
    program,
    source: { path: prog.rel, sha256: prog.sha256 },
    entry: pf.paragraphs[iEntry].name,
    range,
    statements: stmts.sort((a, b) => a.line - b.line).map((s) => [s.line, s.end_line, s.relation, s.text]),
    fields: [...fields.values()].map((f) => [f.name, f.declared_in, f.line, f.permanent_id, f.relation]).sort(),
    input_writers: input_writers.map((w) => [w.field, w.line, w.depends_on, w.sql]),
    calls,
    external,
    undeclared: [...undeclared.values()],
    // Present only when used, so that closures without special registers keep their sealed hash.
    ...(registers.size ? { special_registers: [...registers.entries()] } : {}),
    units: units.map((u) => [u.name, u.file_id, snap.sourceHashes.get(u.file_id) ?? null]),
    unresolved_reasons: reasons,
  };
  return {
    status,
    unresolved_reasons: [...new Set(reasons)],
    program,
    file_id: p.file_id,
    source: { path: prog.rel, sha256: prog.sha256 },
    entry: pf.paragraphs[iEntry].name,
    range,
    statements: stmts.sort((a, b) => a.line - b.line),
    paragraphs: { direct: range, transitive: [...transitiveParas, ...new Set(stmts.filter((s) => s.relation === 'trigger' || s.relation === 'input_writer').map((s) => s.paragraph ?? '(entry)'))].filter((x, i, a) => a.indexOf(x) === i) },
    fields: [...fields.values()],
    inputs: [...inputs].sort(),
    outputs: [...outputs].sort(),
    input_writers,
    calls,
    external,
    undeclared: [...undeclared.values()],
    special_registers: [...registers.entries()].map(([name, lines]) => ({ name, lines })),
    units,
    unit_reasons,
    domain_restrictions,
    program_gaps,
    context: {
      paragraphs: pf.paragraphs.map((q) => q.name),
      copybooks: snap.sys.edges.filter((e: any) => e.from === program && (e.type === 'COPY' || e.type === 'SQL_INCLUDE')).map((e: any) => e.to),
      undeclared: [...undeclaredByDecision.keys()],
      data_names: [...idx.byName.keys()].sort(),
      tables: [...new Set(pf.sql.map((x) => /\b(?:INSERT\s+INTO|FROM|UPDATE)\s+([A-Z][A-Z0-9_]*)/i.exec(x.text)?.[1]?.toUpperCase()).filter((x): x is string => !!x))],
    },
    sha256: sha(body),
  };
}

/** Program-wide gaps with stable IDs (same scheme as the Step 12 pilot), each marked in or outside the closure. */
function programGaps(snap: Snapshot, program: string, prog: Parsed, idx: ReturnType<typeof buildSymbolIndex>, undeclared: Map<string, string[]>, closureLines: Set<number>, ownLines: Set<number>): ProgramGap[] {
  const pf = prog.pf;
  const gaps: ProgramGap[] = [];
  const paraOf = (line: number) => [...pf.paragraphs].reverse().find((q) => q.line <= line)?.name ?? null;
  for (const q of pf.paragraphs) {
    const r = reachedStatements(prog, q.line);
    const mine = r.statements.filter((s) => s.paragraph === q.name);
    // Undeclared names used here, and statements nested under a condition that uses them.
    for (const [n, ds] of undeclared) {
      const lines: number[] = [];
      let open: number[] = [];
      for (const s of mine) {
        const uses = usesWord(s.text, n);
        if (uses || open.length) lines.push(s.line);
        if ((s.verb === 'IF' || s.verb === 'EVALUATE') && uses) open.push(s.line);
        if ((s.verb === 'END-IF' || s.verb === 'END-EVALUATE') && open.length) open.pop();
        if (/\.\s*$/.test(s.text)) open = [];
      }
      const meaningful = lines.filter((l) => !STRUCTURAL.has(mine.find((s) => s.line === l)!.verb));
      if (!meaningful.length) continue;
      const inC = meaningful.some((l) => closureLines.has(l));
      gaps.push({ gap_id: `GAP-${slug(program)}-${slug(q.name)}-${slug(n)}`, kind: 'UNDECLARED_NAME_SEMANTICS', paragraph: q.name, lines: meaningful, subject: n, decisions: ds, blocking: true, missing: `${n} is declared nowhere; its meaning is the subject of ${ds.join(', ')}`, in_closure: inC, why: inC ? `closure statement(s) ${meaningful.filter((l) => closureLines.has(l)).join(', ')} use it or are guarded by it` : `none of lines ${meaningful.join(', ')} is a closure statement, an input writer of the closure or its trigger` });
    }
    for (const s of mine.filter((x) => /^EXEC\s+SQL\b/i.test(x.text))) {
      const op = /^EXEC\s+SQL\s+(\w+)/i.exec(s.text)?.[1]?.toUpperCase() ?? 'STMT';
      const table = /\b(?:INSERT\s+INTO|FROM|UPDATE)\s+([A-Z][A-Z0-9_]*)/i.exec(s.text)?.[1]?.toUpperCase() ?? 'UNKNOWN';
      const inC = closureLines.has(s.line);
      gaps.push({ gap_id: `GAP-${slug(program)}-${slug(q.name)}-SQL-${slug(op)}-${slug(table)}`, kind: 'EXTERNAL_DATABASE_RUNTIME', paragraph: q.name, lines: [s.line], subject: `${op} ${table}`, decisions: [], blocking: true, missing: `the database runtime behaviour of ${op} on ${table}`, in_closure: inC, why: inC ? `line ${s.line} is in the closure` : `line ${s.line} is outside the closure and writes no field the closure consumes` });
    }
    for (const s of mine) {
      for (const h of moveHazards(prog, idx, s)) {
        const inC = ownLines.has(s.line);
        if (h.kind === 'TRUNC') {
          const it = findItem(prog.dd, h.target)!;
          gaps.push({ gap_id: `GAP-${slug(program)}-${slug(q.name)}-TRUNC-${slug(h.target)}`, kind: 'COMPILER_OPTION_DEPENDENT', paragraph: q.name, lines: [s.line], subject: h.target, decisions: [], blocking: false, missing: `the compiler TRUNC option (binary item ${h.target} PIC ${it.node.pic})`, in_closure: inC, why: inC ? `line ${s.line} is in the closure: values beyond ${picFacts(it.node.pic ?? '').digits} digits are outside the supported input domain until the option is known` : `line ${s.line} is outside the closure` });
        } else
          gaps.push({ gap_id: `GAP-${slug(program)}-${slug(q.name)}-ALNUM-TO-NUMERIC-${slug(h.target)}`, kind: 'DATA_CONVERSION_UNDEFINED', paragraph: q.name, lines: [s.line], subject: h.target, decisions: [], blocking: true, missing: `${h.detail}`, in_closure: inC, why: inC ? `line ${s.line} is in the closure: for inputs that are not all digits the result is not defined by the source` : `line ${s.line} is outside the closure` });
      }
    }
  }
  void paraOf;
  void idx;
  return [...new Map(gaps.map((g) => [g.gap_id, g])).values()];
}
