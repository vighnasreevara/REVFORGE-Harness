/**
 * Semantic dependency edges (STEP 12). A literal claim check can verify that a
 * cited statement exists and contains the stated values while the behaviour
 * still depends on a name the program never declares (for example a status
 * field supplied by a precompiler). Such names are invisible to the symbol
 * resolver, so no decision was ever linked to the requirement.
 *
 * For every requirement and runtime requirement, this follows the paragraph
 * that contains the cited line and every paragraph it PERFORMs (THRU ranges,
 * transitively). Then it links the item to each blocking decision that
 * concerns the program (or a copybook it includes) and names a word that the
 * reached statements use but the program declares nowhere. Literals never
 * count, and inside embedded SQL only :host variables are COBOL names.
 *
 * The link is added to the item's open decisions. While the decision is
 * unresolved, the item is REQUIRES_SME_DECISION (fail-closed). A signed
 * resolution clears it through the existing mechanism. Nothing is resolved
 * or excluded here.
 */
import { Item, Snapshot } from './snapshot';
import { SourceReader } from '../blockers/deterministic';
import { buildSymbolIndex } from '../../../verification/src/context';
import { Statement } from '../../../verification/src/facts';

/** COBOL / embedded-SQL reserved words that are never data names. */
export const RESERVED_WORDS = new Set(['INCLUDE', 'END-EXEC', 'EXEC', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'COMMIT', 'ROLLBACK', 'DECLARE', 'CURSOR', 'FETCH', 'WHERE', 'VALUES', 'COPY', 'DIVISION', 'SECTION', 'PERFORM', 'MOVE', 'DISPLAY', 'EVALUATE', 'PROGRAM', 'PROGRAMS', 'FIELD', 'RECORD', 'STANDARD', 'WORKING-STORAGE', 'LINKAGE', 'PROCEDURE']);

/** Candidate data names a decision is about (upper-case words of five or more characters). */
export function decisionNames(question: string): string[] {
  return [...new Set((question.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*\b/g) ?? []).filter((w) => w.length >= 5 && /[A-Z]{3}/.test(w) && !RESERVED_WORDS.has(w)))];
}

// Literals never name data; inside embedded SQL only host variables (:NAME) are COBOL names.
export const codeWords = (t: string) => (/^EXEC\s+SQL\b/i.test(t) ? (t.match(/:[A-Z0-9-]+/gi) ?? []).join(' ') : t.replace(/'[^']*'|"[^"]*"/g, "''"));
export const usesWord = (text: string, w: string) => new RegExp(`(?<![A-Z0-9-])${w.replace(/-/g, '\\-')}(?![A-Z0-9-])`, 'i').test(codeWords(text));

type Parsed = NonNullable<ReturnType<SourceReader['byFileId']>>;

/** The paragraph containing `line` and every paragraph it PERFORMs (THRU ranges, transitively), with their statements. */
export function reachedStatements(prog: Parsed, line: number): { paragraphs: string[]; statements: Array<Statement & { paragraph: string | null }> } {
  const pf = prog.pf;
  const paraOf = (l: number) => [...pf.paragraphs].reverse().find((p) => p.line <= l)?.name ?? null;
  const spanOf = (name: string | null): [number, number] => {
    if (!name) return [pf.procedure_start ?? 1, (pf.paragraphs[0]?.line ?? prog.file.lines.length + 1) - 1];
    const i = pf.paragraphs.findIndex((p) => p.name === name);
    return [pf.paragraphs[i].line, (pf.paragraphs[i + 1]?.line ?? prog.file.lines.length + 1) - 1];
  };
  const paragraphs: string[] = [];
  const statements: Array<Statement & { paragraph: string | null }> = [];
  const seen = new Set<string>();
  const visit = (name: string | null) => {
    const key = name ?? '(unnamed)';
    if (seen.has(key)) return;
    seen.add(key);
    paragraphs.push(key);
    const [lo, hi] = spanOf(name);
    statements.push(...pf.statements.filter((s) => s.line >= lo && s.line <= hi).map((s) => ({ ...s, paragraph: name })));
    for (const p of pf.performs.filter((x) => x.line >= lo && x.line <= hi)) {
      const i = pf.paragraphs.findIndex((q) => q.name === p.target);
      const j = p.thru ? pf.paragraphs.findIndex((q) => q.name === p.thru) : i;
      for (let k = i; k >= 0 && k <= j; k++) visit(pf.paragraphs[k].name);
    }
  };
  visit(paraOf(line));
  return { paragraphs, statements };
}

/**
 * Names a program uses without declaring that are the subject of a blocking decision on the program or a
 * copybook it includes, mapped to those decisions. Only names absent from the program's symbol index count.
 */
export function unresolvedNames(snap: Snapshot, program: string, prog: Parsed, idx: ReturnType<typeof buildSymbolIndex>): Map<string, string[]> {
  const units = new Set([program, ...snap.sys.edges.filter((e: any) => e.from === program && (e.type === 'COPY' || e.type === 'SQL_INCLUDE')).map((e: any) => e.to)]);
  // Only plausible data names: never a paragraph, section, file or program name, or a COBOL reserved word.
  const notData = new Set<string>([
    ...prog.pf.paragraphs.map((p) => p.name.toUpperCase()),
    ...prog.dd.fds.map((f) => f.name.toUpperCase()),
    ...prog.pf.opens.map((o) => o.file.toUpperCase()),
    ...prog.pf.io.flatMap((x) => [x.target, x.file ?? '']).map((x) => x.toUpperCase()),
    ...snap.sys.programs.map((p) => p.program_id.toUpperCase()),
    ...snap.sys.copybooks.map((c) => c.name.toUpperCase()),
  ]);
  const out = new Map<string, string[]>();
  for (const d of snap.register.values()) {
    if (!d.blocking || d.origin.type === 'derived' || !d.affected_units.some((u) => units.has(u.name))) continue;
    for (const n of decisionNames(d.question)) if (!idx.byName.has(n) && !notData.has(n) && !COBOL_WORDS.has(n) && !/^SYS-/.test(n)) out.set(n, [...(out.get(n) ?? []), d.decision_id]);
  }
  return out;
}

/** COBOL reserved words of five or more characters that can appear in procedure statements (never data names). */
export const COBOL_WORDS = new Set(['ACCEPT', 'ALPHABETIC', 'ALPHABETIC-LOWER', 'ALPHABETIC-UPPER', 'ALPHANUMERIC', 'ASCENDING', 'CANCEL', 'CLOSE', 'COMPUTE', 'CONTINUE', 'CORRESPONDING', 'COUNT', 'DELIMITED', 'DESCENDING', 'DISPLAY', 'DIVIDE', 'ENTRY', 'EVALUATE', 'EXCEPTION', 'EXTEND', 'FALSE', 'FUNCTION', 'GIVING', 'GOBACK', 'GREATER', 'INITIALIZE', 'INPUT', 'INSPECT', 'INVALID', 'LENGTH', 'MERGE', 'MULTIPLY', 'NEGATIVE', 'NUMERIC', 'OMITTED', 'OUTPUT', 'PERFORM', 'POINTER', 'POSITIVE', 'RANDOM', 'RECORD', 'RELEASE', 'REMAINDER', 'REPLACING', 'RETURN', 'RETURNING', 'REWRITE', 'ROUNDED', 'SEARCH', 'SENTENCE', 'SEQUENTIAL', 'SPACE', 'SPACES', 'START', 'STRING', 'SUBTRACT', 'TALLYING', 'TIMES', 'UNSTRING', 'UNTIL', 'UPPER', 'USING', 'VALUE', 'VARYING', 'WRITE', 'ZEROES', 'ZEROS', 'CURRENT-DATE', 'WHEN-COMPILED', 'HIGH-VALUE', 'HIGH-VALUES', 'LOW-VALUE', 'LOW-VALUES', 'QUOTE', 'QUOTES', 'CONVERTING', 'INITIAL', 'AFTER', 'BEFORE', 'ADVANCING', 'CICS', 'HANDLE', 'RESP2', 'COMMAREA', 'PROGRAM', 'XCTL', 'RECEIVE', 'SEND', 'COMMIT', 'ROLLBACK', 'CONNECT', 'DISCONNECT', 'RIDFLD', 'DATASET', 'MAPSET', 'MAPONLY', 'DATAONLY', 'ERASE', 'NOHANDLE', 'QUEUE', 'KEYLENGTH', 'GENERIC', 'GTEQ', 'UPDATE', 'TRANSID', 'CONDITION', 'ABEND', 'ABCODE', 'FREEKB', 'CURSOR', 'FROMLENGTH', 'MAXLENGTH']);

export interface SemanticDependency {
  decision_id: string;
  names: string[];
  statements: Array<{ line: number; paragraph: string | null; text: string }>;
  added: boolean;
}

/** Semantic dependency edges for every requirement and runtime requirement (empty without a source root). */
export function semanticDependencies(snap: Snapshot, reader: SourceReader = new SourceReader(snap)): Map<string, SemanticDependency[]> {
  const out = new Map<string, SemanticDependency[]>();
  if (!snap.ctx.srcRoot || ![...snap.register.values()].some((d) => d.blocking)) return out;
  const perProgram = new Map<string, Map<string, string[]>>();
  for (const it of snap.items) {
    if (it.kind !== 'requirement' && it.kind !== 'runtime_requirement') continue;
    const ref = (it.source_refs ?? []).find((r: any) => r.file_id && Number.isInteger(r.line));
    const prog = ref ? reader.byFileId(ref.file_id) : null;
    const unit = it.units.find((u) => u.file_id === ref?.file_id);
    if (!prog || !unit) continue;
    if (!perProgram.has(prog.abs)) perProgram.set(prog.abs, unresolvedNames(snap, unit.name, prog, buildSymbolIndex(prog.dd, prog.abs)));
    const names = perProgram.get(prog.abs)!;
    if (!names.size) continue;
    const reached = reachedStatements(prog, ref.line).statements;
    const byDecision = new Map<string, string[]>();
    for (const [n, ds] of names) if (reached.some((s) => usesWord(s.text, n))) for (const d of ds) byDecision.set(d, [...(byDecision.get(d) ?? []), n]);
    const deps: SemanticDependency[] = [...byDecision.entries()].sort().map(([id, ns]) => ({
      decision_id: id,
      names: ns,
      statements: reached.filter((s) => ns.some((n) => usesWord(s.text, n))).map((s) => ({ line: s.line, paragraph: s.paragraph, text: s.text })),
      added: !it.open_decisions.includes(id) && !snap.register.get(id)!.affected_requirements.includes(it.id),
    }));
    if (deps.length) out.set(it.id, deps);
  }
  return out;
}

/** Links each item to the blocking decisions its reached behaviour depends on (fail-closed while they are open). */
export function applySemanticDependencies(snap: Snapshot): void {
  for (const [id, deps] of semanticDependencies(snap)) {
    const it = snap.itemById.get(id) as Item;
    it.semantic_dependencies = deps;
    it.open_decisions = [...new Set([...it.open_decisions, ...deps.map((d) => d.decision_id)])];
  }
}
