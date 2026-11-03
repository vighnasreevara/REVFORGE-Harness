/**
 * Full-application back end of the local converter (STEP 17): emits plain
 * Java 21 for one parsed program against the hand-written runtime
 * (forward/runtime/java/revforge/cobol). Data items are typed views of byte
 * storage (so REDEFINES, OCCURS, group moves and fixed-length records keep
 * their COBOL meaning); copybooks become shared model classes; paragraphs
 * become methods run with COBOL PERFORM/fall-through semantics.
 *
 * Nothing is guessed. Every construct whose behaviour is not defined by the
 * available source becomes a numbered gap with an explicit Java site that
 * throws UnresolvedGapException (unconditionally, or for data-conversion gaps
 * only when the undefined case actually occurs). Gaps are:
 *   EXTERNAL_SYSTEM_BOUNDARY   executable EXEC SQL / EXEC CICS (no DB2 or CICS here)
 *   UNDEFINED_EXTERNAL_CALL    CALL of a program outside the application
 *   UNDEFINED_PROCEDURE        PERFORM / GO TO of a paragraph the source does not define
 *   UNDECLARED_NAME            a name declared nowhere (or ambiguous)
 *   UNSUPPORTED_DATA           a reference to an item whose layout is not determinable
 *   DATA_CONVERSION_UNDEFINED  alphanumeric content moved into a numeric item, etc.
 *   COMPILER_OPTION_DEPENDENT  results that depend on the compiler (FUNCTION RANDOM ...)
 *   UNTRANSLATED_STATEMENT     a statement the converter cannot parse or translate
 */
import { createHash } from 'crypto';
import { AppProgram, Cond, Expr, FileControl, Item, Operand, Origin, Rec, Ref, Stmt, Value, WhenObj } from './cobol-app';

export interface AppGap {
  gap_id: string;
  stable_ref: string;
  kind: string;
  subject: string;
  description: string;
  origin: { file: string; sha256: string; paragraph: string | null; line: number; end_line: number; excerpt: Array<{ line: number; text: string }> };
  affected_items: string[];
  dependent_statements: Array<{ line: number; file: string; kind: string; reason: string }>;
  affected_paragraphs: string[];
  reached_from: Array<{ paragraph: string | null; line: number; via: string }>;
  status: 'OPEN';
  resolution_required: string;
  conditional: boolean;
}
export interface MapEntry {
  cobol_file: string;
  cobol_line: number;
  kind: string;
  java_file: string;
  java_line: number;
  gap_id: string | null;
}
export interface InitCheck {
  item: string;
  java: string;
  expected_hex: string;
}
export interface AppEmitted {
  pkg: string;
  cls: string;
  files: Record<string, string>;
  models: string[];
  gaps: AppGap[];
  source_map: { program: string; cobol_file: string; cobol_sha256: string; paragraphs: any[]; statements: MapEntry[]; gaps: any[] };
  init_checks: InitCheck[];
  notes: string[];
  stats: { statements: number; items: number; files: number; models: number };
}

class EmitGap extends Error {
  constructor(readonly kind: string, readonly subject: string, readonly description: string, readonly resolution: string) {
    super(description);
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/[^a-z0-9]/g, '');
export const packageOf = (id: string) => `revforge.app.${id.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
export const classOf = (id: string) => cap(id.replace(/[^A-Za-z0-9]/g, ''));
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const jstr = (s: string) => '"' + [...s].map((c) => (c === '"' ? '\\"' : c === '\\' ? '\\\\' : c.charCodeAt(0) < 0x20 || c.charCodeAt(0) > 0x7e ? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}` : c)).join('') + '"';
const bd = (t: string) => `new BigDecimal(${jstr(t.replace(/^\+/, '').replace(/^(-?)\./, '$10.'))})`;
const FIG: Record<string, string> = { SPACE: 'Fig.SPACE', ZERO: 'Fig.ZERO', 'HIGH-VALUE': 'Fig.HIGH_VALUE', 'LOW-VALUE': 'Fig.LOW_VALUE', QUOTE: 'Fig.QUOTE' };
const EXECUTABLE_SQL = /^(SELECT|INSERT|UPDATE|DELETE|OPEN|CLOSE|FETCH|COMMIT|ROLLBACK|CONNECT|DISCONNECT|SAVEPOINT|RELEASE|SET|CALL|EXECUTE|PREPARE|LOCK|MERGE|VALUES|GET|DESCRIBE|ALLOCATE|ASSOCIATE|FREE|SIGNAL|REFRESH|TRUNCATE|DROP|CREATE|ALTER|GRANT|REVOKE|LABEL|COMMENT|RENAME)\b/i;

/* ------------------------------------------------------------------ */
/* VALUE encoding (independent of the Java runtime, for init checks)   */
/* ------------------------------------------------------------------ */

function encodeValue(it: Item, v: Value): Buffer | null {
  const len = it.size;
  const pad = (s: string) => Buffer.from((s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length)), 'latin1');
  const fig = (f: string) => ({ SPACE: ' ', ZERO: '0', 'HIGH-VALUE': '\xff', 'LOW-VALUE': '\x00', QUOTE: '"' } as Record<string, string>)[f];
  if (it.kind === 'ALNUM' || it.kind === 'GROUP' || it.kind === 'EDITED') {
    if (v.kind === 'string') return pad(v.text);
    if (v.kind === 'figurative') return fig(v.text) === undefined ? null : Buffer.from(fig(v.text).repeat(len), 'latin1');
    if (v.kind === 'all') return Buffer.from(v.text.repeat(Math.ceil(len / Math.max(1, v.text.length))).slice(0, len), 'latin1');
    if (v.kind === 'number' && it.kind !== 'EDITED') return pad(v.text.replace(/^[+-]/, '').replace('.', ''));
    return null;
  }
  let num: { neg: boolean; digits: string } | null = null;
  if (v.kind === 'number') {
    const neg = v.text.startsWith('-');
    const [ip, fp = ''] = v.text.replace(/^[+-]/, '').split('.');
    const frac = (fp + '0'.repeat(it.scale)).slice(0, it.scale);
    const int = ip.replace(/^0+/, '') || '0';
    if (int.length > it.digits - it.scale) return null;
    num = { neg: neg && it.signed, digits: (int === '0' ? '' : int) + frac || '0' };
  } else if (v.kind === 'figurative' && v.text === 'ZERO') num = { neg: false, digits: '0' };
  else if (v.kind === 'figurative' && it.kind === 'DISPLAY' && fig(v.text)) return Buffer.from(fig(v.text).repeat(len), 'latin1');
  if (!num) return null;
  if (/^0+$/.test(num.digits)) num.neg = false;
  if (it.kind === 'DISPLAY') {
    const ds = num.digits.padStart(it.digits, '0').slice(-it.digits);
    if (!it.signed) return Buffer.from(ds, 'latin1');
    if (it.signSep) return Buffer.from(it.signLead ? (num.neg ? '-' : '+') + ds : ds + (num.neg ? '-' : '+'), 'latin1');
    const at = it.signLead ? 0 : ds.length - 1;
    const d = Number(ds[at]);
    const ch = num.neg ? (d === 0 ? '}' : String.fromCharCode(74 + d - 1)) : d === 0 ? '{' : String.fromCharCode(65 + d - 1);
    return Buffer.from(ds.slice(0, at) + ch + ds.slice(at + 1), 'latin1');
  }
  if (it.kind === 'BINARY' || it.kind === 'INDEX') {
    let x = BigInt(num.digits) * (num.neg ? -1n : 1n);
    const out = Buffer.alloc(len);
    if (x < 0n) x += 1n << BigInt(8 * len);
    for (let i = len - 1; i >= 0; i--) {
      out[i] = Number(x & 0xffn);
      x >>= 8n;
    }
    return out;
  }
  if (it.kind === 'PACKED') {
    const nd = len * 2 - 1;
    const ds = num.digits.padStart(nd, '0').slice(-nd);
    const sn = !it.signed ? 0xf : num.neg ? 0xd : 0xc;
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) out[i] = (Number(ds[2 * i]) << 4) | (i < len - 1 ? Number(ds[2 * i + 1]) : sn);
    return out;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* emitter                                                             */
/* ------------------------------------------------------------------ */

export function emitApp(p: AppProgram, opts: { available: Set<string>; lineText: (file: string, line: number) => string }): AppEmitted {
  const pkg = packageOf(p.program_id);
  const cls = classOf(p.program_id);
  const file = `${pkg.replace(/\./g, '/')}/${cls}.java`;
  const notes: string[] = [];
  const gaps: AppGap[] = [];
  const smap: MapEntry[] = [];
  const out: string[] = [];
  const emit = (s: string) => out.push(s);
  const items = p.data.items;
  const byName = new Map<string, Item[]>();
  for (const it of items) if (!it.filler) byName.set(it.name, [...(byName.get(it.name) ?? []), it]);
  const conds: Array<{ name: string; item: Item; java: string; c: Item['conditions'][number] }> = [];
  const condJava = new Set<string>();
  for (const it of items)
    for (const c of it.conditions) {
      let j = `C_${c.name.replace(/-/g, '_')}`;
      for (let k = 2; condJava.has(j); k++) j = `C_${c.name.replace(/-/g, '_')}_${k}`;
      condJava.add(j);
      conds.push({ name: c.name, item: it, java: j, c });
    }
  const indexes = new Map<string, { java: string; item: Item }>();
  for (const it of items) for (const n of it.indexNames) if (!indexes.has(n)) indexes.set(n, { java: `X_${n.replace(/-/g, '_')}`, item: it });
  const files = new Map(p.data.files.map((f) => [f.name, f]));
  const fdOf = new Map<string, string>();
  for (const fd of p.data.fds) for (const r of fd.records) fdOf.set(r, fd.name);
  const recByName = new Map(p.data.records.map((r) => [r.name, r]));
  const paraIdx = new Map<string, number>();
  p.paragraphs.forEach((q, k) => {
    if (q.name && !paraIdx.has(q.name)) paraIdx.set(q.name, k);
  });
  const sectionRange = new Map(p.sections.map((s) => [s.name, [s.first, s.last] as [number, number]]));
  const unresolved = [...new Set(p.includes.filter((x) => !x.resolved).map((x) => x.name))];
  const unresolvedNote = unresolved.length ? ` (COPY/INCLUDE member(s) ${unresolved.join(', ')} are not available: the communication area supplied by the DB2 precompiler, or members absent from the source)` : '';
  const ancestors = (it: Item) => {
    const a: Item[] = [];
    for (let x = it.parent; x; x = x.parent) a.push(x);
    return a;
  };
  const recUsable = (r: Rec) => !r.root.unsupported || r.root.kind !== 'UNSUPPORTED' || r.size > 0;
  const usable = (it: Item) => it.kind !== 'UNSUPPORTED' && !ancestors(it).some((a) => a.kind === 'UNSUPPORTED') && !(it.record.root.unsupported && it.record.size === 0) && it.record.size > 0;

  /* -------- storage -------- */
  const storageOf = (r: Rec): string => {
    if (r.fd) return `S_FD_${r.fd.replace(/-/g, '_')}`;
    if (r.root.redefines && recByName.has(r.root.redefines)) return storageOf(recByName.get(r.root.redefines)!);
    return `S_${r.root.javaName}`;
  };
  const storages = new Map<string, { name: string; size: number; linkage: boolean }>();
  for (const r of p.data.records) {
    if (r.size <= 0) {
      notes.push(`record ${r.name} (${r.origin.file}:${r.origin.line}) has no determinable layout (${r.root.unsupported ?? 'incomplete'}); references to it are gaps`);
      continue;
    }
    const s = storageOf(r);
    const prev = storages.get(s);
    storages.set(s, { name: r.fd ?? r.root.redefines ?? r.name, size: Math.max(prev?.size ?? 0, r.size), linkage: /LINKAGE/.test(r.section) });
    r.storage = s;
  }
  for (const r of p.data.records) if (r.size > 0) r.storage = storageOf(r);

  /* -------- copybook models -------- */
  const models = new Map<number, { cls: string; base: number; rec: Rec; items: Item[]; names: Map<number, string>; file: string; text: string }>();
  const modelFiles: Record<string, string> = {};
  {
    const byInst = new Map<number, Item[]>();
    for (const it of items) if (it.origin.inst && usable(it)) byInst.set(it.origin.inst, [...(byInst.get(it.origin.inst) ?? []), it]);
    for (const [inst, its] of byInst) {
      const inc = p.includes[inst - 1];
      if (!inc) continue;
      const rec = its[0].record;
      // A model needs one record and no OCCURS from outside the copybook.
      if (its.some((x) => x.record !== rec) || its.some((x) => [x, ...ancestors(x)].some((a) => a.ownOccurs !== null && a.origin.inst !== inst))) {
        notes.push(`COPY ${inc.name} at ${inc.origin.file}:${inc.origin.line} is placed inside an outer table or spans records; its items are generated in the program`);
        continue;
      }
      const base = Math.min(...its.map((x) => x.off));
      const used = new Set<string>();
      const names = new Map<number, string>();
      for (const x of its) {
        let n = x.filler ? `FILLER_${x.origin.line}` : x.name.replace(/-/g, '_');
        if (/^\d/.test(n)) n = '_' + n;
        let k = n;
        for (let j = 2; used.has(k); j++) k = `${n}_${j}`;
        used.add(k);
        names.set(x.id, k);
      }
      const sig = createHash('sha256')
        .update(JSON.stringify(its.map((x) => [names.get(x.id), x.off - base, x.size, x.kind, x.digits, x.scale, x.signed, x.signSep, x.signLead, x.edit, x.occurs])))
        .digest('hex')
        .slice(0, 8);
      const mcls = `${classOf(inc.name)}${inc.replacing.length ? '_' + inc.replacing.map(([, b]) => classOf(b)).join('') : ''}`;
      const lines: string[] = [];
      lines.push('package revforge.app.copybooks;', '', 'import revforge.cobol.Field;', 'import revforge.cobol.Storage;', '');
      lines.push(`// GENERATED by the REVFORGE local converter from copybook ${inc.path} (layout signature ${sig}).`);
      lines.push('// Shared Java model of the copybook: each item is a typed view at its offset from the copybook start.');
      lines.push(`/** COPY ${inc.name}${inc.replacing.length ? ` REPLACING ${inc.replacing.map(([a, b]) => `${a} BY ${b}`).join(', ')}` : ''}. */`);
      lines.push(`public final class ${mcls} {`);
      lines.push(`  public static final String SIGNATURE = "${sig}";`);
      for (const x of its) lines.push(`  public final Field ${names.get(x.id)}; // ${x.origin.file}:${x.origin.line} ${x.level} ${x.name}`);
      lines.push('', `  public ${mcls}(Storage st, int base) {`);
      for (const x of its) lines.push(`    ${names.get(x.id)} = ${fieldCtor(x, 'st', `base + ${x.off - base}`)};`);
      lines.push('  }', '}', '');
      models.set(inst, { cls: mcls, base, rec, items: its, names, file: `revforge/app/copybooks/${mcls}.java`, text: lines.join('\n') });
      modelFiles[`revforge/app/copybooks/${mcls}.java`] = lines.join('\n');
    }
  }
  function fieldCtor(x: Item, st: string, off: string): string {
    const kind = x.kind === 'INDEX' ? 'BINARY' : x.kind;
    const digits = x.kind === 'INDEX' ? 9 : x.digits;
    const occ = x.occurs.length ? `, new int[] {${x.occurs.map((o) => o.count).join(', ')}}, new int[] {${x.occurs.map((o) => o.stride).join(', ')}}` : ', new int[0], new int[0]';
    return `new Field(${st}, ${off}, ${x.size}, Field.Kind.${kind}, ${digits}, ${x.scale}, ${x.signed || x.kind === 'INDEX'}, ${x.signSep}, ${x.signLead}, ${x.edit ? jstr(x.edit) : 'null'}, ${jstr(x.name)}${occ})`;
  }

  /* -------- name resolution -------- */
  const matchesQual = (chain: Item[], qual: string[]) => {
    let k = 0;
    for (const a of chain) if (k < qual.length && a.name === qual[k]) k++;
    return k === qual.length;
  };
  const resolveItem = (r: Ref): Item => {
    if (r.name === 'RETURN-CODE') throw new EmitGap('UNDECLARED_NAME', r.name, 'RETURN-CODE used as an item', '');
    const cand = (byName.get(r.name) ?? []).filter((it) => matchesQual(ancestors(it), r.qual));
    if (!cand.length) throw new EmitGap('UNDECLARED_NAME', r.name, `${r.name}${r.qual.length ? ' OF ' + r.qual.join(' OF ') : ''} is used but declared nowhere in the program or its available copybooks${unresolvedNote}`, `a declaration (layout and meaning) of ${r.name}`);
    if (cand.length > 1) throw new EmitGap('UNDECLARED_NAME', r.name, `${r.name} is declared ${cand.length} times and the reference is not qualified enough to choose one`, `a qualified reference to ${r.name}`);
    const it = cand[0];
    if (!usable(it)) throw new EmitGap('UNSUPPORTED_DATA', r.name, `${r.name} (${it.origin.file}:${it.origin.line}) has no determinable layout: ${it.unsupported ?? ancestors(it).find((a) => a.unsupported)?.unsupported ?? it.record.root.unsupported ?? 'incomplete record'}`, `the complete layout of ${r.name}`);
    return it;
  };
  const sub = (e: Expr) => (e.kind === 'operand' && e.operand.kind === 'number' && /^\d+$/.test(e.operand.text) ? e.operand.text : `${numx(e)}.intValueExact()`);
  const fieldRef = (r: Ref): string => {
    if (r.name === 'RETURN-CODE' && !byName.has('RETURN-CODE')) return 'ru.returnCode';
    if (indexes.has(r.name) && !byName.has(r.name)) return indexes.get(r.name)!.java;
    const it = resolveItem(r);
    let j = it.javaName;
    if (it.occurs.length) {
      if (r.subs.length !== it.occurs.length) throw new EmitGap('UNDECLARED_NAME', r.name, `${r.name} needs ${it.occurs.length} subscript(s); the reference has ${r.subs.length}`, `a valid reference to ${r.name}`);
      j += `.at(${r.subs.map(sub).join(', ')})`;
    } else if (r.subs.length) throw new EmitGap('UNDECLARED_NAME', r.name, `${r.name} is not a table item but is subscripted`, `a valid reference to ${r.name}`);
    if (r.refmod) j += `.ref(${sub(r.refmod.start)}${r.refmod.len ? `, ${sub(r.refmod.len)}` : ''})`;
    return j;
  };
  const condRef = (r: Ref): string | null => {
    const cand = conds.filter((c) => c.name === r.name && matchesQual([c.item, ...ancestors(c.item)], r.qual));
    if (!cand.length) return null;
    if (cand.length > 1) throw new EmitGap('UNDECLARED_NAME', r.name, `condition ${r.name} is declared ${cand.length} times`, `a qualified reference to ${r.name}`);
    const c = cand[0];
    if (!usable(c.item)) throw new EmitGap('UNSUPPORTED_DATA', r.name, `condition ${r.name} belongs to ${c.item.name}, which has no determinable layout`, `the layout of ${c.item.name}`);
    if (c.item.occurs.length) {
      if (r.subs.length !== c.item.occurs.length) throw new EmitGap('UNDECLARED_NAME', r.name, `condition ${r.name} needs ${c.item.occurs.length} subscript(s)`, '');
      return `${c.java}.at(${r.subs.map(sub).join(', ')})`;
    }
    return c.java;
  };
  const itemOfRef = (r: Ref): Item | null => {
    if (r.name === 'RETURN-CODE' && !byName.has('RETURN-CODE')) return null;
    if (indexes.has(r.name) && !byName.has(r.name)) return null;
    return resolveItem(r);
  };

  /* -------- operands and expressions -------- */
  let dataGapFor: ((src: Operand, dst: Item | null) => string | null) | null = null;
  function obj(e: Expr): string {
    if (e.kind !== 'operand') return numx(e);
    const o = e.operand;
    switch (o.kind) {
      case 'ref': {
        const c = byName.has(o.ref.name) || o.ref.name === 'RETURN-CODE' || indexes.has(o.ref.name) ? null : condRef(o.ref);
        if (c) throw new EmitGap('UNDECLARED_NAME', o.ref.name, `condition name ${o.ref.name} used as a data item`, '');
        return fieldRef(o.ref);
      }
      case 'string':
        return jstr(o.value);
      case 'number':
        return bd(o.text);
      case 'figurative':
        if (!FIG[o.value]) throw new EmitGap('DATA_CONVERSION_UNDEFINED', o.value, `figurative constant ${o.value} has no defined value outside DB2/pointer contexts`, `the meaning of ${o.value} here`);
        return FIG[o.value];
      case 'all':
        return `Fig.all(${jstr(o.value)})`;
      case 'function':
        return fn(o);
    }
  }
  function fn(o: Extract<Operand, { kind: 'function' }>): string {
    let base: string;
    switch (o.name) {
      case 'CURRENT-DATE':
        base = 'Ops.currentDate(ru)';
        break;
      case 'NUMVAL':
        base = `Ops.numval(${obj(o.args[0])})`;
        break;
      case 'UPPER-CASE':
        base = `Ops.upper(${obj(o.args[0])})`;
        break;
      case 'LOWER-CASE':
        base = `Ops.lower(${obj(o.args[0])})`;
        break;
      case 'LENGTH':
        base = `Ops.length(${obj(o.args[0])})`;
        break;
      case 'RANDOM':
        throw new EmitGap('COMPILER_OPTION_DEPENDENT', 'FUNCTION RANDOM', 'FUNCTION RANDOM returns an implementation-defined pseudo-random sequence; the legacy sequence is not reproducible from the source', 'the legacy pseudo-random algorithm, or an approved replacement');
      default:
        throw new EmitGap('UNTRANSLATED_STATEMENT', `FUNCTION ${o.name}`, `intrinsic function ${o.name} is not translated by the converter`, `a translation of FUNCTION ${o.name}`);
    }
    if (o.refmod) return `Ops.substr(${base}, ${sub(o.refmod.start)}, ${o.refmod.len ? sub(o.refmod.len) : `${base}.length() - ${sub(o.refmod.start)} + 1`})`;
    return base;
  }
  function numx(e: Expr): string {
    switch (e.kind) {
      case 'operand':
        return e.operand.kind === 'number' ? bd(e.operand.text) : `Ops.num(${obj(e)})`;
      case 'neg':
        return `Ops.neg(${numx(e.inner)})`;
      case 'binary': {
        const f = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '**': 'pow' }[e.op];
        return `Ops.${f}(${numx(e.left)}, ${numx(e.right)})`;
      }
    }
  }
  const isNumericExpr = (e: Expr) => e.kind !== 'operand';

  /* -------- conditions -------- */
  function cnd(c: Cond): string {
    switch (c.kind) {
      case 'name': {
        const cr = condRef(c.ref);
        if (cr) return `${cr}.isTrue()`;
        if (byName.has(c.ref.name)) throw new EmitGap('UNDECLARED_NAME', c.ref.name, `${c.ref.name} is used as a condition but is a data item, not a condition name`, '');
        throw new EmitGap('UNDECLARED_NAME', c.ref.name, `condition ${c.ref.name} is used but declared nowhere in the program or its copybooks`, `a declaration of condition ${c.ref.name}`);
      }
      case 'rel': {
        const l = isNumericExpr(c.left) ? numx(c.left) : obj(c.left);
        const r = isNumericExpr(c.right) ? numx(c.right) : obj(c.right);
        return `Ops.compare(${l}, ${r}) ${c.op === '=' ? '==' : c.op === '<>' ? '!=' : c.op} 0`;
      }
      case 'class': {
        const t = c.test === 'NUMERIC' ? `Ops.isNumeric(${obj(c.operand)})` : c.test === 'ALPHABETIC' ? `Ops.isAlphabetic(${obj(c.operand)})` : (() => {
          throw new EmitGap('UNTRANSLATED_STATEMENT', c.test, `class test ${c.test} is not translated`, '');
        })();
        return c.negated ? `!${t}` : t;
      }
      case 'sign': {
        const t = `Ops.sign(${obj(c.operand)}) ${c.test === 'POSITIVE' ? '> 0' : c.test === 'NEGATIVE' ? '< 0' : '== 0'}`;
        return c.negated ? `!(${t})` : t;
      }
      case 'not':
        return `!(${cnd(c.inner)})`;
      case 'and':
        return `(${cnd(c.left)} && ${cnd(c.right)})`;
      case 'or':
        return `(${cnd(c.left)} || ${cnd(c.right)})`;
    }
  }

  /* -------- gaps -------- */
  let curPara: { name: string | null; idx: number } = { name: null, idx: 0 };
  const gapMethods: string[] = [];
  const probes: Array<{ id: string; code: string }> = [];
  const performers = (idx: number) => {
    const res: Array<{ paragraph: string | null; line: number; via: string }> = [];
    p.paragraphs.forEach((q) =>
      q.sentences.forEach((ss) =>
        walkAll(ss, (s) => {
          if (s.kind === 'perform') {
            const rg = range(s.target, s.thru);
            if (rg && idx >= rg[0] && idx <= rg[1]) res.push({ paragraph: q.name, line: s.origin.line, via: `PERFORM ${s.target}${s.thru ? ` THRU ${s.thru}` : ''}` });
          }
        }),
      ),
    );
    return res;
  };
  const addGap = (kind: string, subject: string, description: string, resolution: string, s: Stmt, conditional: boolean, refKind?: string): string => {
    const id = `GAP-${p.program_id}-${String(gaps.length + 1).padStart(4, '0')}`;
    const pname = curPara.name ?? '(unnamed)';
    let stable = refKind === 'ALNUM' ? `GAP-${slug(p.program_id)}-${slug(pname)}-ALNUM-TO-NUMERIC-${slug(subject)}` : `GAP-${slug(p.program_id)}-${slug(pname)}-${slug(kind)}-${slug(subject).slice(0, 40)}`;
    for (let k = 2; gaps.some((g) => g.stable_ref === stable); k++) stable = stable.replace(/(-\d+)?$/, `-${k}`);
    const excerpt: Array<{ line: number; text: string }> = [];
    for (let l = s.origin.line; l <= Math.max(s.origin.line, s.end.file === s.origin.file ? s.end.line : s.origin.line); l++) excerpt.push({ line: l, text: opts.lineText(s.origin.file, l) });
    const dependent: AppGap['dependent_statements'] = [];
    walkAll([s], (x) => dependent.push({ line: x.origin.line, file: x.origin.file, kind: x.kind, reason: x === s ? 'the statement itself' : 'nested under the blocked statement' }));
    gaps.push({
      gap_id: id,
      stable_ref: stable,
      kind,
      subject,
      description,
      origin: { file: s.origin.file, sha256: s.origin.file === p.rel ? p.sha256 : '', paragraph: curPara.name, line: s.origin.line, end_line: s.end.line, excerpt },
      affected_items: [subject],
      dependent_statements: dependent,
      affected_paragraphs: [pname],
      reached_from: performers(curPara.idx),
      status: 'OPEN',
      resolution_required: resolution || 'source evidence or an approved specification of the behaviour',
      conditional,
    });
    return id;
  };
  const gapSite = (id: string, desc: string) => {
    const m = `g${id.slice(-4)}`;
    gapMethods.push(`  /** ${id}: ${desc.replace(/\*\//g, '* /')} */`, `  void ${m}() {`, `    throw new UnresolvedGapException(${jstr(id)}, ${jstr(desc.slice(0, 300))});`, '  }', '');
    probes.push({ id, code: `${m}();` });
    return `${m}();`;
  };

  /* -------- statements -------- */
  let ind = 2;
  let labelN = 0;
  const loopLabels: string[] = [];
  let sentenceLabel = '';
  const line = (s: string) => emit('  '.repeat(ind) + s);
  // Conditional gaps (runtime-guarded sites) found while emitting a statement are attached to its mapping.
  const pendingGaps: string[] = [];
  const mapStmt = (s: Stmt, gapId: string | null = null) => {
    smap.push({ cobol_file: s.origin.file, cobol_line: s.origin.line, kind: s.kind, java_file: file, java_line: out.length, gap_id: gapId ?? pendingGaps[0] ?? null });
    for (const g of pendingGaps.splice(0).slice(gapId ? 0 : 1)) smap.push({ cobol_file: s.origin.file, cobol_line: s.origin.line, kind: `${s.kind}:guard`, java_file: file, java_line: out.length, gap_id: g });
  };
  const mapNested = (s: Stmt, gapId: string) => walkAll([s], (x) => (x === s ? undefined : smap.push({ cobol_file: x.origin.file, cobol_line: x.origin.line, kind: x.kind, java_file: file, java_line: out.length, gap_id: gapId })));
  const loc = (s: Stmt) => `// ${s.origin.file}:${s.origin.line}`;
  const block = (ss: Stmt[] | null) => {
    ind++;
    for (const s of ss ?? []) stmt(s);
    ind--;
  };
  function range(target: string, thru: string | null): [number, number] | null {
    const a = sectionRange.get(target) ?? (paraIdx.has(target) ? [paraIdx.get(target)!, paraIdx.get(target)!] : null);
    if (!a) return null;
    if (!thru) return a as [number, number];
    const b = sectionRange.get(thru) ?? (paraIdx.has(thru) ? [paraIdx.get(thru)!, paraIdx.get(thru)!] : null);
    if (!b) return null;
    return [a[0], b[1]];
  }
  // Statement coverage: each statement of the program's own source records its line when executed.
  const covLine = (s: Stmt) => {
    if (s.origin.file === p.rel) line(`c(${s.origin.line});`);
  };
  function stmt(s: Stmt): void {
    const save = out.length;
    try {
      covLine(s);
      stmtInner(s);
    } catch (e) {
      if (!(e instanceof EmitGap)) throw e;
      out.length = save;
      pendingGaps.length = 0;
      smap.splice(smap.findIndex((m) => m.java_line > save) >= 0 ? smap.findIndex((m) => m.java_line > save) : smap.length);
      const id = addGap(e.kind, e.subject, e.description, e.resolution, s, false);
      covLine(s);
      line(`${gapSite(id, `${e.description} (${s.origin.file}:${s.origin.line})`)} ${loc(s)} ${s.kind.toUpperCase()}`);
      mapStmt(s, id);
      mapNested(s, id);
    }
  }
  const jumpTo = (expr: string) => `if (true) ${expr};`;
  const moveCode = (src: Expr, to: Ref, s: Stmt): string => {
    const dstItem = itemOfRef(to);
    const dst = fieldRef(to);
    const srcObj = obj(src);
    const numericDst = !!dstItem && ['DISPLAY', 'BINARY', 'PACKED'].includes(dstItem.kind);
    if (numericDst && src.kind === 'operand') {
      const o = src.operand;
      if (o.kind === 'figurative' && o.value !== 'ZERO') throw new EmitGap('DATA_CONVERSION_UNDEFINED', dstItem!.name, `MOVE ${o.value} to numeric ${dstItem!.name} is not a defined move`, 'the intended content of the numeric item');
      if (o.kind === 'all') throw new EmitGap('DATA_CONVERSION_UNDEFINED', dstItem!.name, `MOVE ALL literal to numeric ${dstItem!.name}`, 'the intended content of the numeric item');
      if (o.kind === 'string' && !/^\d+$/.test(o.value)) throw new EmitGap('DATA_CONVERSION_UNDEFINED', dstItem!.name, `MOVE of the non-numeric literal '${o.value}' to numeric ${dstItem!.name}`, 'the intended content of the numeric item');
      const srcItem = o.kind === 'ref' ? itemOfRef(o.ref) : null;
      const alnumSrc = (srcItem && ['ALNUM', 'GROUP'].includes(srcItem.kind)) || (o.kind === 'ref' && !!o.ref.refmod) || (o.kind === 'function' && /^(CURRENT-DATE|UPPER-CASE|LOWER-CASE)$/.test(o.name));
      if (srcItem && srcItem.kind === 'EDITED') throw new EmitGap('DATA_CONVERSION_UNDEFINED', dstItem!.name, `MOVE of numeric-edited ${srcItem.name} to numeric ${dstItem!.name} (de-editing)`, 'the de-editing rule');
      if (alnumSrc) {
        const id = addGap('DATA_CONVERSION_UNDEFINED', dstItem!.name, `MOVE of alphanumeric ${o.kind === 'ref' ? o.ref.name : `FUNCTION ${(o as any).name}`} to numeric ${dstItem!.name}: defined only when the content is all digits; otherwise the result depends on the compiler and the data representation`, 'the business rule for non-digit content, or the compiler options and a captured legacy run', s, true, 'ALNUM');
        // Probe: the same move with content that is not all digits.
        const probeSrc = o.kind === 'ref' ? fieldRef({ ...o.ref, subs: o.ref.subs.map(() => ({ kind: 'operand', operand: { kind: 'number', text: '1' } }) as Expr) }) : null;
        const probeDst = fieldRef({ ...to, subs: to.subs.map(() => ({ kind: 'operand', operand: { kind: 'number', text: '1' } }) as Expr) });
        probes.push({ id, code: probeSrc ? `{ final Field s = ${probeSrc}; s.fill('X'); Ops.move(s, ${probeDst}, ${jstr(id)}); }` : `Ops.move("X", ${probeDst}, ${jstr(id)});` });
        pendingGaps.push(id);
        return `Ops.move(${srcObj}, ${dst}, ${jstr(id)});`;
      }
    }
    return `Ops.move(${srcObj}, ${dst});`;
  };
  const sizeBlock = (sz: string, s: { sizeError: Stmt[] | null; notSizeError: Stmt[] | null }) => {
    if (s.sizeError || s.notSizeError) {
      line(`if (${sz}) {`);
      block(s.sizeError);
      line('} else {');
      block(s.notSizeError);
      line('}');
    }
  };
  const fileFor = (name: string): FileControl => {
    const f = files.get(name);
    if (!f) throw new EmitGap('UNDECLARED_NAME', name, `file ${name} has no SELECT entry`, `the FILE-CONTROL entry of ${name}`);
    if (!fileDecl.has(name)) throw new EmitGap('UNSUPPORTED_DATA', name, `file ${name} could not be generated: ${fileProblem.get(name) ?? 'no FD record'}`, `the FD and organisation of ${name}`);
    return f;
  };
  const fileOfRecord = (r: Ref): { f: FileControl; rec: Item } => {
    const it = resolveItem(r);
    const fd = it.record.fd;
    if (!fd || it.parent) throw new EmitGap('UNDECLARED_NAME', r.name, `${r.name} is not a record of a file`, '');
    return { f: fileFor(fd), rec: it };
  };
  const keyPhrase = (fj: string, s: { atEnd?: Stmt[] | null; notAtEnd?: Stmt[] | null; invalid?: Stmt[] | null; notInvalid?: Stmt[] | null }, onOk?: () => void) => {
    const branches: Array<[string, Stmt[] | null]> = [];
    if (s.atEnd) branches.push([`${fj}.atEnd()`, s.atEnd]);
    if (s.invalid) branches.push([`${fj}.invalidKey()`, s.invalid]);
    const okBody = s.notAtEnd ?? s.notInvalid ?? null;
    if (!branches.length && !okBody && !onOk) return;
    let first = true;
    for (const [c, b] of branches) {
      line(`${first ? '' : '} else '}if (${c}) {`);
      block(b);
      first = false;
    }
    if (okBody || onOk) {
      line(`${first ? '' : '} else '}if (${fj}.ok()) {`);
      ind++;
      onOk?.();
      ind--;
      block(okBody);
    }
    line('}');
  };
  function stmtInner(s: Stmt): void {
    switch (s.kind) {
      case 'move': {
        if (s.corresponding) throw new EmitGap('UNTRANSLATED_STATEMENT', 'MOVE CORRESPONDING', 'MOVE CORRESPONDING is not translated by the converter', '');
        const codes = s.to.map((t) => moveCode(s.from, t, s));
        line(`${codes[0]} ${loc(s)} MOVE`);
        mapStmt(s);
        for (const c of codes.slice(1)) line(c);
        return;
      }
      case 'set_cond': {
        const codes = s.conds.map((c) => {
          const cr = condRef(c);
          if (!cr) throw new EmitGap('UNDECLARED_NAME', c.name, `condition ${c.name} is used but declared nowhere in the program or its copybooks`, `a declaration of condition ${c.name}`);
          if (s.value) return `${cr}.setTrue();`;
          const cd = conds.find((x) => x.name === c.name)!;
          return `${cr}.setFalse(${cd.c.falseValue ? valueObj(cd.item, cd.c.falseValue) : 'null'});`;
        });
        line(`${codes[0]} ${loc(s)} SET`);
        mapStmt(s);
        for (const c of codes.slice(1)) line(c);
        return;
      }
      case 'set_to': {
        const codes = s.targets.map((t) => `Ops.move(${obj(s.value)}, ${fieldRef(t)});`);
        line(`${codes[0]} ${loc(s)} SET`);
        mapStmt(s);
        for (const c of codes.slice(1)) line(c);
        return;
      }
      case 'set_by': {
        const codes = s.targets.map((t) => {
          const f = fieldRef(t);
          return `Ops.store(${f}, Ops.${s.up ? 'add' : 'sub'}(Ops.num(${f}), ${numx(s.by)}), false, false);`;
        });
        line(`${codes[0]} ${loc(s)} SET`);
        mapStmt(s);
        for (const c of codes.slice(1)) line(c);
        return;
      }
      case 'initialize': {
        const codes: string[] = [];
        for (const t of s.targets) {
          const it = itemOfRef(t);
          if (!it) {
            codes.push(`Ops.initialize(${fieldRef(t)});`);
            continue;
          }
          const base = fieldRef(t);
          const leaves: Item[] = [];
          const collect = (x: Item, top: boolean) => {
            if (!top && (x.filler || x.redefines)) return;
            if (x.children.length) x.children.forEach((c) => collect(c, false));
            else if (usable(x)) leaves.push(x);
          };
          collect(it, true);
          const extraDims = (x: Item) => x.occurs.slice(it.occurs.length);
          const prefixSubs = t.subs.map(sub);
          for (const x of leaves) {
            const dims = extraDims(x);
            const idx = dims.map((_, k) => `i${k + 1}`);
            const subsAll = [...prefixSubs, ...idx];
            const f = x === it ? base : `${x.javaName}${subsAll.length ? `.at(${subsAll.join(', ')})` : ''}`;
            const call = s.replacing.length
              ? `Ops.initializeReplacing(${f}, ${s.replacing.find((r) => /ALPHANUMERIC|ALPHABETIC/.test(r.category)) ? obj(s.replacing.find((r) => /ALPHANUMERIC|ALPHABETIC/.test(r.category))!.by) : 'null'}, ${s.replacing.find((r) => /^NUMERIC/.test(r.category)) ? obj(s.replacing.find((r) => /^NUMERIC/.test(r.category))!.by) : 'null'});`
              : `Ops.initialize(${f});`;
            codes.push(dims.reduceRight((acc, d, k) => `for (int i${k + 1} = 1; i${k + 1} <= ${d.count}; i${k + 1}++) ${acc}`, call));
          }
        }
        if (!codes.length) codes.push('// (no elementary items to initialize)');
        line(`${codes[0]} ${loc(s)} INITIALIZE`);
        mapStmt(s);
        for (const c of codes.slice(1)) line(c);
        return;
      }
      case 'if': {
        line(`if (${cnd(s.cond)}) { ${loc(s)} IF`);
        mapStmt(s);
        block(s.then);
        if (s.else.length) {
          line('} else {');
          block(s.else);
        }
        line('}');
        return;
      }
      case 'evaluate': {
        const subj = s.subjects;
        const alt = (objs: WhenObj[]) =>
          objs
            .map((o, k) => {
              const sj = subj[k];
              if (o.kind === 'any') return 'true';
              if (sj.kind === 'true' || sj.kind === 'false') {
                const neg = sj.kind === 'false';
                if (o.kind === 'cond') return neg ? `!(${cnd(o.cond)})` : cnd(o.cond);
                if (o.kind === 'true') return neg ? 'false' : 'true';
                if (o.kind === 'false') return neg ? 'true' : 'false';
                if (o.kind === 'value') {
                  // A bare name under EVALUATE TRUE is a condition name.
                  if (o.lo.kind === 'operand' && o.lo.operand.kind === 'ref' && !o.hi) {
                    const c = cnd({ kind: 'name', ref: o.lo.operand.ref });
                    return neg !== o.negated ? `!(${c})` : c;
                  }
                  throw new EmitGap('UNTRANSLATED_STATEMENT', 'EVALUATE', 'a value object under EVALUATE TRUE', '');
                }
              }
              if (sj.kind === 'cond') {
                if (o.kind === 'true') return cnd(sj.cond);
                if (o.kind === 'false') return `!(${cnd(sj.cond)})`;
                throw new EmitGap('UNTRANSLATED_STATEMENT', 'EVALUATE', 'a non-boolean object for a condition subject', '');
              }
              if (sj.kind === 'expr' && o.kind === 'value') {
                const sv = isNumericExpr(sj.expr) ? numx(sj.expr) : obj(sj.expr);
                const lo = isNumericExpr(o.lo) ? numx(o.lo) : obj(o.lo);
                const t = o.hi ? `(Ops.compare(${sv}, ${lo}) >= 0 && Ops.compare(${sv}, ${isNumericExpr(o.hi) ? numx(o.hi) : obj(o.hi)}) <= 0)` : `Ops.compare(${sv}, ${lo}) == 0`;
                return o.negated ? `!${t}` : t;
              }
              throw new EmitGap('UNTRANSLATED_STATEMENT', 'EVALUATE', 'an EVALUATE object that does not match its subject', '');
            })
            .join(' && ');
        let first = true;
        mapStmt(s);
        const at = out.length;
        for (const w of s.whens) {
          const c = w.alts.map((a) => `(${alt(a)})`).join(' || ');
          line(`${first ? '' : '} else '}if (${c}) {${first ? ` ${loc(s)} EVALUATE` : ''}`);
          first = false;
          block(w.body);
        }
        if (s.other) {
          if (first) line(`{ ${loc(s)} EVALUATE (WHEN OTHER only)`);
          else line('} else {');
          block(s.other);
          first = false;
        }
        if (!first) line('}');
        else line(`// ${s.origin.file}:${s.origin.line} EVALUATE without WHEN`);
        smap[smap.length - 1 - countSince(at)].java_line = at + 1;
        return;
      }
      case 'perform': {
        const rg = range(s.target, s.thru);
        if (!rg) throw new EmitGap('UNDEFINED_PROCEDURE', s.thru && !range(s.target, null) ? s.target : s.thru ?? s.target, `PERFORM ${s.target}${s.thru ? ` THRU ${s.thru}` : ''}: the procedure is not defined in the program (the source as written would not compile)`, 'the missing paragraph(s) of the program');
        const call = `perform(${rg[0]}, ${rg[1]});`;
        loopHead(s, call, `PERFORM ${s.target}${s.thru ? ` THRU ${s.thru}` : ''}`);
        return;
      }
      case 'perform_inline': {
        loopHead(s, null, 'PERFORM (inline)');
        return;
      }
      case 'call': {
        const t = s.target;
        let name: string;
        if (t.kind === 'string') name = jstr(t.value.trim().toUpperCase());
        else if (t.kind === 'ref') name = `${fieldRef(t.ref)}.raw().trim()`;
        else throw new EmitGap('UNTRANSLATED_STATEMENT', 'CALL', 'CALL target', '');
        const args = s.using.map((u) => {
          if (!u.operand) throw new EmitGap('UNTRANSLATED_STATEMENT', 'CALL OMITTED', 'CALL ... OMITTED', '');
          if (u.mode === 'VALUE') throw new EmitGap('UNTRANSLATED_STATEMENT', 'CALL BY VALUE', 'CALL ... BY VALUE', 'the callee interface');
          const o = u.operand;
          if (o.kind === 'ref') return `${fieldRef(o.ref)}.area()${u.mode === 'CONTENT' ? '.copy()' : ''}`;
          if (o.kind === 'string') return `literalArea(${jstr(o.value)})`;
          throw new EmitGap('UNTRANSLATED_STATEMENT', 'CALL argument', `CALL argument of kind ${o.kind}`, '');
        });
        if (s.returning) throw new EmitGap('UNTRANSLATED_STATEMENT', 'CALL RETURNING', 'CALL ... RETURNING', '');
        if (t.kind === 'string' && !opts.available.has(t.value.trim().toUpperCase()) && !s.onException) throw new EmitGap('UNDEFINED_EXTERNAL_CALL', t.value.trim().toUpperCase(), `CALL '${t.value.trim().toUpperCase()}' has no source in the application inventory: its behaviour and its effect on ${s.using.map((u) => (u.operand?.kind === 'ref' ? u.operand.ref.name : 'literal')).join(', ') || 'shared data'} are unknown`, `the source or an approved specification of ${t.value.trim().toUpperCase()}`);
        const callExpr = `ru.call(${name}${args.length ? ', ' + args.join(', ') : ''})`;
        if (s.onException || s.notOnException) {
          line(`if (!${callExpr}) { ${loc(s)} CALL`);
          mapStmt(s);
          block(s.onException);
          line('} else {');
          block(s.notOnException);
          line('}');
        } else {
          // Without ON EXCEPTION, a program missing at run time blocks the path (a dynamic CALL target is data).
          const id = t.kind === 'string' ? null : addGap('UNDEFINED_EXTERNAL_CALL', `CALL ${t.kind === 'ref' ? t.ref.name : ''}`, `dynamic CALL through ${t.kind === 'ref' ? t.ref.name : ''}: the target program is data; a target outside the converted application is unknown`, 'the possible target programs', s, true);
          if (id) probes.push({ id, code: `if (!ru.call("REVFORGE-NO-SUCH-PROGRAM")) throw new UnresolvedGapException(${jstr(id)}, "dynamic CALL target not available");` });
          line(`if (!${callExpr}) throw new UnresolvedGapException(${jstr(id ?? 'RUNTIME-CALL-UNAVAILABLE')}, "CALL target not available in this run unit"); ${loc(s)} CALL`);
          mapStmt(s, id);
        }
        return;
      }
      case 'cancel': {
        const codes = s.targets.map((t) => (t.kind === 'string' ? `ru.cancel(${jstr(t.value.trim().toUpperCase())});` : t.kind === 'ref' ? `ru.cancel(${fieldRef(t.ref)}.raw().trim());` : '// CANCEL'));
        line(`${codes[0]} ${loc(s)} CANCEL`);
        mapStmt(s);
        for (const c of codes.slice(1)) line(c);
        return;
      }
      case 'goback':
        line(`${jumpTo('throw goback()')} ${loc(s)} GOBACK`);
        mapStmt(s);
        return;
      case 'stop_run':
        line(`${jumpTo('throw stopRun()')} ${loc(s)} STOP RUN`);
        mapStmt(s);
        return;
      case 'exit_program':
        line(`exitProgram(); ${loc(s)} EXIT PROGRAM`);
        mapStmt(s);
        return;
      case 'exit':
        line(`${loc(s)} EXIT (no operation)`);
        mapStmt(s);
        return;
      case 'continue':
        line(`${loc(s)} CONTINUE`);
        mapStmt(s);
        return;
      case 'exit_paragraph':
        line(`${jumpTo('return -1')} ${loc(s)} EXIT PARAGRAPH`);
        mapStmt(s);
        return;
      case 'next_sentence':
        line(`${jumpTo(`break ${sentenceLabel}`)} ${loc(s)} NEXT SENTENCE`);
        mapStmt(s);
        return;
      case 'exit_perform': {
        if (!loopLabels.length) throw new EmitGap('UNTRANSLATED_STATEMENT', 'EXIT PERFORM', 'EXIT PERFORM outside an inline PERFORM', '');
        line(`${jumpTo(`${s.cycle ? 'continue' : 'break'} ${loopLabels[loopLabels.length - 1]}`)} ${loc(s)} EXIT PERFORM`);
        mapStmt(s);
        return;
      }
      case 'exit_section':
        throw new EmitGap('UNTRANSLATED_STATEMENT', 'EXIT SECTION', 'EXIT SECTION is not translated', '');
      case 'goto': {
        const idx = s.targets.map((t) => {
          if (!paraIdx.has(t) && !sectionRange.has(t)) throw new EmitGap('UNDEFINED_PROCEDURE', t, `GO TO ${t}: the procedure is not defined in the program (the source as written would not compile)`, `the paragraph ${t}`);
          return paraIdx.get(t) ?? sectionRange.get(t)![0];
        });
        if (!s.depending) {
          line(`${jumpTo(`return ${idx[0]}`)} ${loc(s)} GO TO ${s.targets[0]}`);
          mapStmt(s);
          return;
        }
        line(`switch (Ops.num(${fieldRef(s.depending)}).intValue()) { ${loc(s)} GO TO DEPENDING ON`);
        mapStmt(s);
        idx.forEach((k, n) => line(`  case ${n + 1}: return ${k};`));
        line('  default: break;');
        line('}');
        return;
      }
      case 'display':
        line(`ru.display(${!s.noAdvancing}${s.items.length ? ', ' + s.items.map((e) => obj(e)).join(', ') : ''}); ${loc(s)} DISPLAY${s.upon ? ` UPON ${s.upon}` : ''}`);
        mapStmt(s);
        return;
      case 'accept': {
        const f = fieldRef(s.target);
        if (!s.from) line(`ru.accept(${f}); ${loc(s)} ACCEPT`);
        else if (['DATE', 'DATE YYYYMMDD', 'DAY', 'DAY YYYYDDD', 'TIME', 'DAY-OF-WEEK'].includes(s.from)) line(`ru.acceptFrom(${f}, ${jstr(s.from)}); ${loc(s)} ACCEPT FROM ${s.from}`);
        else throw new EmitGap('COMPILER_OPTION_DEPENDENT', `ACCEPT FROM ${s.from}`, `ACCEPT ${s.target.name} FROM ${s.from}: not a standard source; its content is defined by the legacy environment`, `the format of ${s.from} in the legacy environment`);
        mapStmt(s);
        return;
      }
      case 'open': {
        const codes = s.entries.flatMap((e) => e.files.map((f) => (fileFor(f), `F_${f.replace(/-/g, '_')}.open(CobolFile.Mode.${e.mode === 'I-O' ? 'IO' : e.mode});`)));
        line(`${codes[0]} ${loc(s)} OPEN`);
        mapStmt(s);
        for (const c of codes.slice(1)) line(c);
        return;
      }
      case 'close': {
        const codes = s.files.map((f) => (fileFor(f), `F_${f.replace(/-/g, '_')}.close();`));
        line(`${codes[0] ?? '// CLOSE'} ${loc(s)} CLOSE`);
        mapStmt(s);
        for (const c of codes.slice(1)) line(c);
        return;
      }
      case 'read': {
        const f = fileFor(s.file);
        const fj = `F_${s.file.replace(/-/g, '_')}`;
        if (s.key && f.recordKey && s.key.name !== f.recordKey.name) throw new EmitGap('UNTRANSLATED_STATEMENT', `READ ${s.file} KEY ${s.key.name}`, `READ by the alternate key ${s.key.name}`, 'alternate-index support');
        const nextRead = s.next || f.access === 'SEQUENTIAL' || f.organization !== 'INDEXED';
        const intoCode = s.into ? `Ops.move(${fdRecordField(s.file)}, ${fieldRef(s.into)});` : null;
        line(`${fj}.${nextRead ? 'readNext' : 'read'}(); ${loc(s)} READ`);
        mapStmt(s);
        keyPhrase(fj, s, intoCode ? () => line(intoCode) : undefined);
        return;
      }
      case 'write':
      case 'rewrite': {
        if (s.kind === 'write' && s.advancing) throw new EmitGap('UNTRANSLATED_STATEMENT', 'WRITE ADVANCING', `WRITE ... ${s.advancing}: carriage control is not represented`, 'the printer-control convention of the dataset');
        const { f, rec } = fileOfRecord(s.record);
        const fj = `F_${f.name.replace(/-/g, '_')}`;
        if (s.from) line(`Ops.move(${obj(s.from)}, ${rec.javaName}); ${loc(s)} ${s.kind.toUpperCase()} FROM`);
        line(`${fj}.${s.kind}(${rec.size});${s.from ? '' : ` ${loc(s)} ${s.kind.toUpperCase()}`}`);
        mapStmt(s);
        keyPhrase(fj, s);
        return;
      }
      case 'delete': {
        fileFor(s.file);
        const fj = `F_${s.file.replace(/-/g, '_')}`;
        line(`${fj}.delete(); ${loc(s)} DELETE`);
        mapStmt(s);
        keyPhrase(fj, s);
        return;
      }
      case 'start': {
        const f = fileFor(s.file);
        if (s.key && f.recordKey && s.key.name !== f.recordKey.name) throw new EmitGap('UNTRANSLATED_STATEMENT', `START ${s.file} KEY ${s.key.name}`, `START on ${s.key.name}, which is not the record key`, 'alternate-index support');
        const op = s.op === '<>' || s.op === '<' || s.op === '<=' ? null : s.op;
        if (!op) throw new EmitGap('UNTRANSLATED_STATEMENT', `START ${s.op}`, `START KEY ${s.op}`, '');
        const fj = `F_${s.file.replace(/-/g, '_')}`;
        line(`${fj}.start(${jstr(op)}); ${loc(s)} START`);
        mapStmt(s);
        keyPhrase(fj, s);
        return;
      }
      case 'arith': {
        const has = !!s.sizeError || !!s.notSizeError;
        const sz = `sz${++labelN}`;
        const r: string[] = [];
        const sum = (es: Expr[]) => es.map(numx).reduce((a, b) => `Ops.add(${a}, ${b})`);
        const st = (t: { ref: Ref; rounded: boolean }, v: string) => r.push(`${sz} |= !Ops.store(${fieldRef(t.ref)}, ${v}, ${t.rounded}, ${has});`);
        const val = (t: { ref: Ref }) => `Ops.num(${fieldRef(t.ref)})`;
        if (s.verb === 'ADD') {
          if (s.giving.length) {
            const v = s.to.length ? `Ops.add(${sum(s.operands)}, ${s.to.map(val).reduce((a, b) => `Ops.add(${a}, ${b})`)})` : sum(s.operands);
            s.giving.forEach((t) => st(t, v));
          } else s.to.forEach((t) => st(t, `Ops.add(${val(t)}, ${sum(s.operands)})`));
        } else if (s.verb === 'SUBTRACT') {
          if (s.giving.length) {
            if (s.to.length !== 1) throw new EmitGap('UNTRANSLATED_STATEMENT', 'SUBTRACT', 'SUBTRACT ... GIVING needs exactly one minuend', '');
            s.giving.forEach((t) => st(t, `Ops.sub(${val(s.to[0])}, ${sum(s.operands)})`));
          } else s.to.forEach((t) => st(t, `Ops.sub(${val(t)}, ${sum(s.operands)})`));
        } else if (s.verb === 'MULTIPLY') {
          if (s.giving.length) s.giving.forEach((t) => st(t, `Ops.mul(${numx(s.operands[0])}, ${numx(s.divisor!)})`));
          else s.to.forEach((t) => st(t, `Ops.mul(${numx(s.operands[0])}, ${val(t)})`));
        } else {
          // DIVIDE a INTO b: b / a. DIVIDE a INTO b GIVING c: b / a. DIVIDE a BY b GIVING c: a / b.
          const a = numx(s.operands[0]);
          if (s.giving.length) {
            const [num, den] = s.form === 'INTO' ? [numx(s.divisor!), a] : [a, numx(s.divisor!)];
            s.giving.forEach((t) => st(t, `Ops.div(${num}, ${den})`));
            if (s.remainder) r.push(`${sz} |= !Ops.remainder(${fieldRef(s.remainder)}, ${num}, ${den}, ${fieldRef(s.giving[0].ref)}, ${has});`);
          } else {
            if (s.form !== 'INTO') throw new EmitGap('UNTRANSLATED_STATEMENT', 'DIVIDE BY', 'DIVIDE ... BY without GIVING', '');
            s.to.forEach((t) => st(t, `Ops.div(${val(t)}, ${a})`));
          }
        }
        line(`{ boolean ${sz} = false; ${loc(s)} ${s.verb}`);
        mapStmt(s);
        ind++;
        r.forEach((x) => line(x));
        sizeBlock(sz, s);
        ind--;
        line('}');
        return;
      }
      case 'compute': {
        const has = !!s.sizeError || !!s.notSizeError;
        const sz = `sz${++labelN}`;
        line(`{ boolean ${sz} = false; final BigDecimal v${labelN} = ${numx(s.expr)}; ${loc(s)} COMPUTE`);
        mapStmt(s);
        const v = `v${labelN}`;
        ind++;
        for (const t of s.targets) line(`${sz} |= !Ops.store(${fieldRef(t.ref)}, ${v}, ${t.rounded}, ${has});`);
        sizeBlock(sz, s);
        ind--;
        line('}');
        return;
      }
      case 'string': {
        const ov = `ov${++labelN}`;
        line(`{ final boolean ${ov} = Ops.string(${fieldRef(s.into)}, ${s.pointer ? fieldRef(s.pointer) : 'null'}, new Object[] {${s.items.map((x) => obj(x.src)).join(', ')}}, new Object[] {${s.items.map((x) => (x.delim ? obj(x.delim) : 'null')).join(', ')}}); ${loc(s)} STRING`);
        mapStmt(s);
        ind++;
        if (s.overflow || s.notOverflow) {
          line(`if (${ov}) {`);
          block(s.overflow);
          line('} else {');
          block(s.notOverflow);
          line('}');
        }
        ind--;
        line('}');
        return;
      }
      case 'exec': {
        const body = s.body.trim();
        // DECLARE CURSOR/TABLE/STATEMENT/VARIABLE are compile-time declarations; DECLARE GLOBAL TEMPORARY TABLE is executable.
        if (s.lang === 'SQL' && !EXECUTABLE_SQL.test(body) && !/^DECLARE\s+GLOBAL\s+TEMPORARY\b/i.test(body)) {
          line(`// ${s.origin.file}:${s.origin.line} EXEC SQL ${body.split(/\s+/).slice(0, 3).join(' ')} (declarative; no run-time effect)`);
          mapStmt(s);
          return;
        }
        const verb = body.split(/\s+/).slice(0, s.lang === 'SQL' ? 2 : 1).join(' ');
        throw new EmitGap('EXTERNAL_SYSTEM_BOUNDARY', `EXEC ${s.lang} ${verb}`, `EXEC ${s.lang} ${verb}: the ${s.lang === 'SQL' ? 'DB2 database' : 'CICS transaction environment'} is not available to the converted application; no ${s.lang === 'SQL' ? 'SQLCODE or row' : 'response'} is invented`, `a ${s.lang === 'SQL' ? 'database access layer validated against DB2 (tables, host variables, SQLCODE handling, commit scope)' : 'CICS replacement design (COMMAREA, RESP codes, LINK targets)'}`);
      }
      case 'untranslated':
        throw new EmitGap('UNTRANSLATED_STATEMENT', s.text.split(/\s+/).slice(0, 3).join(' '), `statement not translated: ${s.reason}`, 'a corrected source statement or an approved specification');
    }
  }
  function countSince(at: number) {
    let n = 0;
    for (let k = smap.length - 1; k >= 0 && smap[k].java_line > at; k--) n++;
    return n;
  }
  function loopHead(s: Extract<Stmt, { kind: 'perform' } | { kind: 'perform_inline' }>, call: string | null, what: string) {
    const label = `L${++labelN}`;
    const body = () => {
      if (call) line(call);
      else {
        loopLabels.push(label);
        block(s.kind === 'perform_inline' ? s.body : []);
        loopLabels.pop();
      }
    };
    const inner = () => {
      ind++;
      body();
      ind--;
    };
    if (s.varying.length) {
      const vs = s.varying;
      line(`${label}: { ${loc(s)} ${what} VARYING`);
      mapStmt(s);
      ind++;
      const open = (k: number) => {
        const v = vs[k];
        line(`Ops.move(${obj(v.from)}, ${fieldRef(v.ref)});`);
        line(`while (!(${cnd(v.until)})) {`);
        ind++;
        if (k + 1 < vs.length) open(k + 1);
        else body();
        line(`Ops.store(${fieldRef(v.ref)}, Ops.add(Ops.num(${fieldRef(v.ref)}), ${numx(v.by)}), false, false);`);
        ind--;
        line('}');
      };
      if (s.testAfter) throw new EmitGap('UNTRANSLATED_STATEMENT', 'PERFORM VARYING WITH TEST AFTER', 'PERFORM VARYING WITH TEST AFTER', '');
      open(0);
      ind--;
      line('}');
      // Inline bodies use the label for EXIT PERFORM: the outer labelled block.
      return;
    }
    if (s.until) {
      if (s.testAfter) {
        line(`${label}: do { ${loc(s)} ${what} WITH TEST AFTER UNTIL`);
        mapStmt(s);
        inner();
        line(`} while (!(${cnd(s.until)}));`);
      } else {
        line(`${label}: while (!(${cnd(s.until)})) { ${loc(s)} ${what} UNTIL`);
        mapStmt(s);
        inner();
        line('}');
      }
      return;
    }
    if (s.times) {
      line(`${label}: for (int t${labelN} = ${numx(s.times)}.intValueExact(); t${labelN} > 0; t${labelN}--) { ${loc(s)} ${what} TIMES`);
      mapStmt(s);
      inner();
      line('}');
      return;
    }
    if (call) {
      line(`${call} ${loc(s)} ${what}`);
      mapStmt(s);
      return;
    }
    line(`${label}: { ${loc(s)} ${what}`);
    mapStmt(s);
    inner();
    line('}');
  }
  function fdRecordField(fileName: string): string {
    const fd = p.data.fds.find((x) => x.name === fileName);
    const rec = fd ? p.data.records.find((r) => r.name === fd.records[0]) : null;
    if (!rec) throw new EmitGap('UNSUPPORTED_DATA', fileName, `file ${fileName} has no record description`, '');
    return rec.root.javaName;
  }
  function valueObj(it: Item, v: Value): string {
    const numeric = ['DISPLAY', 'BINARY', 'PACKED', 'INDEX'].includes(it.kind);
    if (v.kind === 'number') return numeric ? bd(v.text) : jstr(v.text.replace(/^\+/, ''));
    if (v.kind === 'string') return jstr(v.text);
    if (v.kind === 'all') return `Fig.all(${jstr(v.text)})`;
    if (!FIG[v.text]) throw new EmitGap('DATA_CONVERSION_UNDEFINED', v.text, `figurative constant ${v.text}`, '');
    return FIG[v.text];
  }
  function walkAll(ss: Stmt[], fn2: (s: Stmt) => void) {
    for (const s of ss) {
      fn2(s);
      const a = s as any;
      for (const k of ['then', 'else', 'body', 'other', 'onException', 'notOnException', 'atEnd', 'notAtEnd', 'invalid', 'notInvalid', 'sizeError', 'notSizeError', 'overflow', 'notOverflow']) if (Array.isArray(a[k])) walkAll(a[k], fn2);
      if (s.kind === 'evaluate') for (const w of s.whens) walkAll(w.body, fn2);
    }
  }

  /* -------- files -------- */
  const fileDecl = new Map<string, string>();
  const fileProblem = new Map<string, string>();
  for (const f of p.data.files) {
    const fd = p.data.fds.find((x) => x.name === f.name);
    const recs = fd ? fd.records.map((r) => recByName.get(r)).filter((r): r is Rec => !!r && r.size > 0) : [];
    if (!fd || !recs.length) {
      fileProblem.set(f.name, fd ? 'its record layout is not determinable' : 'no FD entry');
      continue;
    }
    if (f.organization === 'RELATIVE' || f.organization === 'LINE SEQUENTIAL') {
      fileProblem.set(f.name, `ORGANIZATION ${f.organization} is not supported`);
      continue;
    }
    let keyOff = 0;
    let keyLen = 0;
    if (f.organization === 'INDEXED') {
      const k = f.recordKey ? (byName.get(f.recordKey.name) ?? []).filter((x) => x.record.fd === f.name) : [];
      if (k.length !== 1) {
        fileProblem.set(f.name, `the RECORD KEY ${f.recordKey?.name ?? '(none)'} is not an item of its record`);
        continue;
      }
      keyOff = k[0].off;
      keyLen = k[0].size;
    }
    const recLen = Math.max(...recs.map((r) => r.size));
    fileDecl.set(f.name, `new CobolFile(ru, ${jstr(f.name)}, ${jstr(f.assign)}, CobolFile.Org.${f.organization}, CobolFile.Access.${f.access}, S_FD_${f.name.replace(/-/g, '_')}, ${recLen}, ${fd.recordingMode === 'V'}, ${keyOff}, ${keyLen})`);
  }

  /* -------- program body -------- */
  p.paragraphs.forEach((q, k) => {
    curPara = { name: q.name, idx: k };
    ind = 1;
    line(`// ${q.origin.file}:${q.origin.line}-${q.end.line} ${q.name ?? '(statements before the first paragraph)'}`);
    line(`private int p${k}() {`);
    ind = 2;
    q.sentences.forEach((ss, n) => {
      if (!ss.length) return;
      sentenceLabel = `s${k}_${n}`;
      line(`${sentenceLabel}: {`);
      ind++;
      for (const s of ss) stmt(s);
      ind--;
      line('}');
    });
    line('return -1;');
    ind = 1;
    line('}');
    line('');
  });

  /* -------- class assembly -------- */
  const head: string[] = [];
  const H = (s: string) => head.push(s);
  H(`package ${pkg};`, );
  H('');
  H('import java.math.BigDecimal;');
  H('import java.util.LinkedHashMap;');
  H('import java.util.Map;');
  H('import revforge.cobol.Area;');
  H('import revforge.cobol.CobolFile;');
  H('import revforge.cobol.CobolProgram;');
  H('import revforge.cobol.Cond88;');
  H('import revforge.cobol.Field;');
  H('import revforge.cobol.Fig;');
  H('import revforge.cobol.Ops;');
  H('import revforge.cobol.RunUnit;');
  H('import revforge.cobol.Storage;');
  H('import revforge.cobol.UnresolvedGapException;');
  H('');
  H(`// GENERATED by the REVFORGE local converter from ${p.rel} (sha256 ${p.sha256}).`);
  H('// Not approved and not evidence for any workflow gate; behaviour is source-derived; legacy equivalence is not established.');
  H(`// Open gaps: ${gaps.length}${gaps.length ? ` (${gaps.map((g) => g.gap_id).join(', ')})` : ''}; paths through them are blocked.`);
  H(`/** Program ${p.program_id}. One instance is one program in a run unit: WORKING-STORAGE lives in instance fields. */`);
  H(`@SuppressWarnings("unused")`);
  H(`public final class ${cls} extends CobolProgram {`);
  H(`  public static final String PROGRAM_ID = ${jstr(p.program_id)};`);
  H(`  static final int PARAGRAPHS = ${Math.max(1, p.paragraphs.length)};`);
  H('');
  H('  // storage areas');
  for (const [name, st] of storages) H(`  final Storage ${name} = new Storage(${jstr(st.name)}, ${st.size});`);
  if (indexes.size) H(`  final Storage S__INDEXES = new Storage("INDEXES", ${indexes.size * 4});`);
  H('');
  H('  // copybook models');
  const modelVars = new Map<number, string>();
  for (const [inst, m] of models) {
    const v = `M${inst}_${m.cls}`;
    modelVars.set(inst, v);
    H(`  final revforge.app.copybooks.${m.cls} ${v} = new revforge.app.copybooks.${m.cls}(${m.rec.storage}, ${m.base});`);
  }
  H('');
  H('  // data items');
  for (const it of items) {
    if (!usable(it) || !it.record.storage) continue;
    const m = it.origin.inst ? models.get(it.origin.inst) : undefined;
    const mv = it.origin.inst ? modelVars.get(it.origin.inst) : undefined;
    if (m && mv && m.names.has(it.id)) H(`  final Field ${it.javaName} = ${mv}.${m.names.get(it.id)}; // ${it.origin.file}:${it.origin.line} ${it.level} ${it.name}`);
    else H(`  final Field ${it.javaName} = ${fieldCtor(it, it.record.storage, String(it.off))}; // ${it.origin.file}:${it.origin.line} ${it.level} ${it.name}`);
  }
  let ix = 0;
  for (const [n, x] of indexes) H(`  final Field ${x.java} = new Field(S__INDEXES, ${4 * ix++}, 4, Field.Kind.BINARY, 9, 0, true, false, false, null, ${jstr(n)}, new int[0], new int[0]); // INDEXED BY ${n} (${x.item.name})`);
  H('');
  H('  // level-88 condition names');
  for (const c of conds) {
    if (!usable(c.item) || !c.item.record.storage) continue;
    try {
      const lo = c.c.values.map((v) => valueObj(c.item, v.lo)).join(', ');
      const hi = c.c.values.map((v) => (v.hi ? valueObj(c.item, v.hi) : 'null')).join(', ');
      H(`  final Cond88 ${c.java} = new Cond88(${jstr(c.name)}, ${c.item.javaName}, new Object[] {${lo}}, new Object[] {${hi}}); // ${c.c.origin.file}:${c.c.origin.line}`);
    } catch (e) {
      if (!(e instanceof EmitGap)) throw e;
      notes.push(`condition ${c.name}: ${e.description}`);
    }
  }
  H('');
  H('  // files');
  for (const [n, d] of fileDecl) H(`  final CobolFile F_${n.replace(/-/g, '_')};`);
  for (const [n, why] of fileProblem) notes.push(`file ${n}: ${why}; statements using it are gaps`);
  H('');
  H(`  public ${cls}(RunUnit ru) {`);
  H('    super(ru);');
  for (const [n, d] of fileDecl) {
    const f = files.get(n)!;
    let st = '';
    if (f.status) {
      try {
        st = `.status(${fieldRef(f.status)})`;
      } catch (e) {
        if (!(e instanceof EmitGap)) throw e;
        notes.push(`file ${n}: FILE STATUS ${f.status.name} is not usable (${e.description})`);
      }
    }
    H(`    F_${n.replace(/-/g, '_')} = ${d}${st};`);
  }
  H('    initialValues();');
  H('  }');
  H('');
  // VALUE clauses (WORKING-STORAGE and LOCAL-STORAGE only).
  const initChecks: InitCheck[] = [];
  H('  /** VALUE clauses of WORKING-STORAGE (storage without a VALUE clause starts as LOW-VALUES). */');
  H('  private void initialValues() {');
  for (const it of items) {
    if (!usable(it) || !it.record.storage || !/WORKING-STORAGE|LOCAL-STORAGE/.test(it.record.section) || !it.values.length) continue;
    const v = it.values[0];
    let code: string;
    try {
      const target = (idx: string[]) => `${it.javaName}${idx.length ? `.at(${idx.join(', ')})` : ''}`;
      const val = it.kind === 'GROUP' ? (v.kind === 'string' ? jstr(v.text) : v.kind === 'all' ? `Fig.all(${jstr(v.text)})` : FIG[v.text] ?? 'null') : valueObj(it, v);
      const dims = it.occurs;
      const idx = dims.map((_, k) => `i${k + 1}`);
      const raw = it.kind === 'GROUP' || (v.kind === 'figurative' && v.text !== 'ZERO' && ['DISPLAY', 'BINARY', 'PACKED'].includes(it.kind));
      const one = raw ? `${target(idx)}.setRaw(${v.kind === 'string' ? jstr(v.text) : `${val}.repeat(${it.size})`});` : `Ops.move(${val}, ${target(idx)});`;
      code = dims.reduceRight((acc, d, k) => `for (int i${k + 1} = 1; i${k + 1} <= ${d.count}; i${k + 1}++) ${acc}`, one);
      H(`    ${code} // ${it.origin.file}:${it.origin.line} ${it.name}`);
      const enc = encodeValue(it, v);
      if (enc && !it.occurs.length && it.kind !== 'EDITED') initChecks.push({ item: it.name, java: it.javaName, expected_hex: enc.toString('hex') });
    } catch (e) {
      if (!(e instanceof EmitGap)) throw e;
      notes.push(`VALUE of ${it.name}: ${e.description}`);
    }
  }
  H('  }');
  H('');
  H('  @Override');
  H('  public String programId() {');
  H('    return PROGRAM_ID;');
  H('  }');
  H('');
  H('  @Override');
  H('  protected int paragraphCount() {');
  H('    return PARAGRAPHS;');
  H('  }');
  H('');
  H('  @Override');
  H('  protected void bind(Area[] args) {');
  p.using.forEach((u, k) => {
    const r = recByName.get(u);
    if (r && r.size > 0) H(`    if (args.length > ${k} && args[${k}] != null) ${r.storage}.bind(args[${k}]);`);
    else notes.push(`PROCEDURE DIVISION USING ${u}: not a usable LINKAGE record`);
  });
  H('  }');
  H('');
  H('  /** COBOL source location of each gap site (fixtures name blocked paths by source line). */');
  H('  @Override');
  H('  public String gapSite(String gapId) {');
  H('    switch (gapId) {');
  for (const g of gaps) H(`      case ${jstr(g.gap_id)}: return ${jstr(`${g.origin.file}:${g.origin.line}`)};`);
  H('      default: return null;');
  H('    }');
  H('  }');
  H('');
  H('  @Override');
  H('  public Area[] ownLinkage() {');
  H(`    return new Area[] {${p.using.map((u) => recByName.get(u)).filter((r): r is Rec => !!r && r.size > 0).map((r) => `${r.storage}.area()`).join(', ')}};`);
  H('  }');
  H('');
  H('  static Area literalArea(String s) {');
  H('    final Storage st = new Storage("literal", s.length());');
  H('    final Area a = st.area();');
  H('    a.put(Ops.latin1(s));');
  H('    return a;');
  H('  }');
  H('');
  H('  @Override');
  H('  protected int paragraph(int i) {');
  H('    switch (i) {');
  p.paragraphs.forEach((_, k) => H(`      case ${k}: return p${k}();`));
  H('      default: throw new IllegalArgumentException("paragraph " + i);');
  H('    }');
  H('  }');
  H('');
  H('  /** Named data items, level-88 conditions and files (for tests and integration). */');
  H('  @Override');
  H('  public Map<String, Object> items() {');
  H('    final Map<String, Object> m = new LinkedHashMap<>();');
  const seen = new Map<string, number>();
  for (const it of items) if (!it.filler) seen.set(it.name, (seen.get(it.name) ?? 0) + 1);
  for (const it of items) {
    if (it.filler || !usable(it) || !it.record.storage) continue;
    const key = seen.get(it.name)! > 1 && it.parent ? `${it.name} OF ${it.parent.name}` : it.name;
    H(`    m.put(${jstr(key)}, ${it.javaName});`);
  }
  for (const c of conds) if (usable(c.item) && c.item.record.storage) H(`    m.put(${jstr(c.name)}, ${c.java});`);
  for (const [n] of fileDecl) H(`    m.put(${jstr('FILE ' + n)}, F_${n.replace(/-/g, '_')});`);
  H('    return m;');
  H('  }');
  H('');
  H('  /** Executes the Java site of one gap (tests: the path must stay blocked). */');
  H('  public void probe(String gapId) {');
  H('    switch (gapId) {');
  for (const pr of probes) H(`      case ${jstr(pr.id)}: ${pr.code} return;`);
  H('      default: throw new IllegalArgumentException(gapId);');
  H('    }');
  H('  }');
  H('');
  // Source-map Java lines were counted within the paragraph block; shift them past the header and gap sites.
  const bodyStart = head.length + gapMethods.length;
  for (const e of smap) e.java_line += bodyStart;
  const text = [...head, ...gapMethods, ...out, '}', ''].join('\n');
  // Test class: VALUE checks and gap probes.
  const tests: string[] = [];
  tests.push(`package ${pkg};`, '', 'import revforge.cobol.RunUnit;', 'import revforge.cobol.testing.Report;', '');
  tests.push(`// GENERATED by the REVFORGE local converter: checks derived from ${p.rel}, not from the generated Java.`);
  tests.push(`public final class ${cls}Tests {`);
  tests.push(`  private ${cls}Tests() {}`, '');
  tests.push('  public static void run(Report r) {');
  tests.push(`    final ${cls} p = new ${cls}(new RunUnit());`);
  for (const c of initChecks) tests.push(`    r.bytes("INIT ${c.item}", ${jstr(c.expected_hex)}, p.${c.java});`);
  // Level-88 conditions: SET TO TRUE stores the first value (encoded here, independently of the runtime).
  for (const c of conds) {
    if (!usable(c.item) || !c.item.record.storage || c.item.occurs.length || !c.c.values.length) continue;
    const enc = encodeValue(c.item, c.c.values[0].lo);
    if (enc) tests.push(`    { final ${cls} q = new ${cls}(new RunUnit()); r.cond("C88 ${c.name}", ${jstr(enc.toString('hex'))}, q.${c.java}, q.${c.item.javaName}); }`);
  }
  for (const g of gaps) tests.push(`    r.gap("PROBE ${g.gap_id}", ${jstr(g.gap_id)}, () -> new ${cls}(new RunUnit()).probe(${jstr(g.gap_id)}));`);
  tests.push('  }', '}', '');
  const outFiles: Record<string, string> = { [file]: text, [`${pkg.replace(/\./g, '/')}/${cls}Tests.java`]: tests.join('\n'), ...modelFiles };
  let stmts = 0;
  p.paragraphs.forEach((q) => q.sentences.forEach((ss) => walkAll(ss, () => stmts++)));
  return {
    pkg,
    cls,
    files: outFiles,
    models: [...models.values()].map((m) => m.cls),
    gaps,
    source_map: {
      program: p.program_id,
      cobol_file: p.rel,
      cobol_sha256: p.sha256,
      paragraphs: p.paragraphs.map((q, k) => ({ paragraph: q.name, cobol_file: q.origin.file, cobol_lines: [q.origin.line, q.end.line], java_file: file, java_method: `p${k}`, blocked_by: gaps.filter((g) => g.affected_paragraphs.includes(q.name ?? '(unnamed)')).map((g) => g.gap_id) })),
      statements: smap,
      gaps: gaps.map((g) => ({ gap_id: g.gap_id, interface: 'revforge/cobol/UnresolvedGapException.java', placeholder: file, call_sites: smap.filter((m) => m.gap_id === g.gap_id).map((m) => ({ java_file: m.java_file, java_line: m.java_line })), affected_methods: [`p${p.paragraphs.findIndex((q) => (q.name ?? '(unnamed)') === g.affected_paragraphs[0])}`] })),
    },
    init_checks: initChecks,
    notes,
    stats: { statements: stmts, items: items.length, files: fileDecl.size, models: models.size },
  };
}
