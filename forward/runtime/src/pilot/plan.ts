/**
 * Source-backed modernization plan (STEP 11): for every requirement of one
 * scope, what the original COBOL establishes, what depends on an unresolved
 * decision, and therefore what a later authorized conversion may implement.
 *
 * Classification (per requirement, never an approval):
 *   FULLY_SOURCE_SUPPORTED          evidence established, nothing reached depends on an open decision -> VERIFIED
 *   PARTIALLY_SUPPORTED             evidence established, some reached statements depend on one       -> PARTIAL
 *   DEPENDENT_ON_TECHNICAL_DECISION evidence established, every reached statement depends on one      -> GAP
 *   INSUFFICIENT_EVIDENCE           the cited evidence does not establish the claim                    -> GAP
 *   CONTRADICTED                    the source contradicts the cited evidence                          -> GAP
 *
 * "Reached" means the paragraph containing the cited statement (which
 * prepares and consumes its data) and every paragraph it PERFORMs (THRU
 * ranges and transitively). A statement depends on a decision when it uses a name that
 * the decision's dependency fact sheet shows is declared nowhere in the
 * repository; statements nested under such an IF/EVALUATE depend on it too.
 * Embedded SQL is an external interface, reported with the table definition
 * found in the source tree (if any). Nothing is resolved, excluded or
 * approved here; the G2 outcome and the open decisions are reported as is.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Item, Snapshot } from '../approval/snapshot';
import { evaluateScope, parseSelector, selectorText } from '../approval/scope';
import { SourceReader } from '../blockers/deterministic';
import { analyse } from '../blockers/pipeline';
import { checkItem } from '../context/context';
import { adjudications, adjudicationState } from '../context/adjudication';
import { dependencyFactSheet } from '../operations/package';
import { requiredRoles } from '../approval/decisions';
import { Workflow } from '../orchestrator/orchestrator';
import { Statement } from '../../../verification/src/facts';
import { buildSymbolIndex } from '../../../verification/src/context';
import { reachedStatements, usesWord } from '../approval/semantic';

export type SupportClass = 'FULLY_SOURCE_SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'DEPENDENT_ON_TECHNICAL_DECISION' | 'INSUFFICIENT_EVIDENCE' | 'CONTRADICTED';
export type Category = 'VERIFIED' | 'PARTIAL' | 'GAP';

export const CATEGORY: Record<SupportClass, Category> = {
  FULLY_SOURCE_SUPPORTED: 'VERIFIED',
  PARTIALLY_SUPPORTED: 'PARTIAL',
  DEPENDENT_ON_TECHNICAL_DECISION: 'GAP',
  INSUFFICIENT_EVIDENCE: 'GAP',
  CONTRADICTED: 'GAP',
};

/** Pure classification from the established facts (exported for tests). */
export function classify(f: { contradicted: boolean; evidence_established: boolean; statements: number; dependent: number }): SupportClass {
  if (f.contradicted) return 'CONTRADICTED';
  if (!f.evidence_established) return 'INSUFFICIENT_EVIDENCE';
  if (!f.dependent) return 'FULLY_SOURCE_SUPPORTED';
  return f.dependent >= f.statements ? 'DEPENDENT_ON_TECHNICAL_DECISION' : 'PARTIALLY_SUPPORTED';
}

const STRUCTURAL = new Set(['EXIT', 'END-IF', 'END-EVALUATE', 'ELSE', 'GOBACK']);

interface Marked extends Statement {
  paragraph: string | null;
  depends_on: Array<{ name: string; decisions: string[] }>;
  inherited_from: number | null;
}

/** Marks each statement that uses an unresolved name, or is nested under a conditional that does. */
export function markDependencies(stmts: Array<Statement & { paragraph: string | null }>, unresolved: Map<string, string[]>): Marked[] {
  const out: Marked[] = [];
  const stack: Array<{ line: number; dep: Marked['depends_on'] }> = [];
  for (const s of stmts) {
    const own = [...unresolved.entries()].filter(([n]) => usesWord(s.text, n)).map(([name, decisions]) => ({ name, decisions }));
    const outer = stack.find((x) => x.dep.length) ?? null;
    out.push({ ...s, depends_on: own.length ? own : outer ? outer.dep : [], inherited_from: !own.length && outer ? outer.line : null });
    if (s.verb === 'IF' || s.verb === 'EVALUATE') stack.push({ line: s.line, dep: own.length ? own : outer?.dep ?? [] });
    if ((s.verb === 'END-IF' || s.verb === 'END-EVALUATE') && stack.length) stack.pop();
    if (/\.\s*$/.test(s.text)) stack.length = 0;
  }
  return out;
}

/** Deterministic test cases implied by the branches of the reached statements. */
export function impliedTests(stmts: Statement[], conditionValue: (name: string) => string[] | null): string[] {
  const tests: string[] = [];
  let subject: string | null = null;
  const nums: number[] = [];
  const flush = (other: boolean) => {
    if (subject && nums.length && other) tests.push(`${subject} outside every listed range (e.g. ${Math.min(...nums) - 1} and ${Math.max(...nums) + 1}) takes the OTHER branch`);
  };
  for (const s of stmts) {
    const t = s.text.replace(/\.\s*$/, '');
    let m: RegExpExecArray | null;
    if ((m = /^EVALUATE\s+(.+)$/i.exec(t))) {
      subject = m[1].toUpperCase() === 'TRUE' ? null : m[1];
      nums.length = 0;
    } else if ((m = /^WHEN\s+(-?\d+)\s+THRU\s+(-?\d+)$/i.exec(t)) && subject) {
      const [lo, hi] = [Number(m[1]), Number(m[2])];
      nums.push(lo, hi);
      tests.push(`${subject} = ${lo} and ${subject} = ${hi} (range boundaries) take the WHEN ${lo} THRU ${hi} branch`);
    } else if ((m = /^WHEN\s+(-?\d+)$/i.exec(t)) && subject) {
      nums.push(Number(m[1]));
      tests.push(`${subject} = ${m[1]} takes the WHEN ${m[1]} branch`);
    } else if (/^WHEN\s+OTHER$/i.test(t)) flush(true);
    else if ((m = /^WHEN\s+([A-Z0-9-]+)$/i.exec(t))) {
      const v = conditionValue(m[1].toUpperCase());
      tests.push(v ? `the declared value(s) ${v.map((x) => `'${x}'`).join(', ')} of ${m[1].toUpperCase()} select its branch` : `${m[1].toUpperCase()} selects its branch (declared value not resolved)`);
    } else if ((m = /^END-EVALUATE$/i.exec(t)) && subject === null) {
      /* EVALUATE TRUE without OTHER: a value matching no condition performs nothing. */
    } else if ((m = /^IF\s+(.+?)\s*(>=|<=|>|<|=)\s*(.+)$/i.exec(t))) tests.push(`IF ${m[1]} ${m[2]} ${m[3]}: one case each with ${m[1]} less than, equal to and greater than ${m[3]}`);
  }
  if (stmts.some((s) => /^EVALUATE\s+TRUE/i.test(s.text)) && !stmts.some((s) => /^WHEN\s+OTHER/i.test(s.text))) tests.push('a request value matching no WHEN condition performs nothing and leaves every output unchanged');
  return [...new Set(tests)];
}

export function modernizationPlan(wf: Workflow, scope: string): any {
  const a = analyse(wf);
  const snap: Snapshot = a.snap;
  const sel = selectorText(parseSelector(scope));
  const ev = evaluateScope(snap, parseSelector(sel));
  const reader = new SourceReader(snap);
  const findingFor = (id: string) => ev.findings.find((f) => f.id === id);
  const ears = adjudications(wf);

  // Open blocking decisions of this scope, and the names their fact sheets show are declared nowhere.
  const open = (id: string) => snap.register.has(id) && snap.resolutions.get(id)?.status !== 'resolved';
  const openDecisions = [...new Set(ev.findings.filter((f) => f.blocking && f.kind.startsWith('decision')).map((f) => f.id))].filter(open).sort();
  const unitNames = new Set(ev.units.map((u) => u.name));
  const itemIds = new Set(ev.findings.map((f) => f.id));
  const advisory = [...snap.register.values()].filter((d) => open(d.decision_id) && !openDecisions.includes(d.decision_id) && !d.decision_id.startsWith('RVW-') && (d.affected_requirements.some((r) => itemIds.has(r)) || d.affected_units.some((u) => unitNames.has(u.name))));
  const facts = new Map(openDecisions.map((id) => [id, dependencyFactSheet(snap, id)]));
  const unresolved = new Map<string, string[]>();
  for (const [id, fs_] of facts) for (const u of fs_?.names_used_by_programs ?? []) if (!u.declared_in_repository) unresolved.set(u.name, [...(unresolved.get(u.name) ?? []), id]);

  const items = snap.items.filter((it) => (it.kind === 'requirement' || it.kind === 'runtime_requirement') && findingFor(it.id));
  const tableDdl = (table: string) => {
    if (!snap.ctx.srcRoot) return null;
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.(sql|ddl)$/i.test(e.name) ? [path.join(d, e.name)] : []));
    for (const f of walk(snap.ctx.srcRoot)) {
      const t = fs.readFileSync(f, 'utf8');
      if (new RegExp(`CREATE\\s+TABLE\\s+${table}\\b`, 'i').test(t)) return { path: path.relative(snap.ctx.srcRoot, f).split(path.sep).join('/'), sha256: createHash('sha256').update(fs.readFileSync(f)).digest('hex') };
    }
    return null;
  };

  const requirements = items.map((it) => planItem(snap, reader, it, findingFor(it.id)!, ears, unresolved, facts, tableDdl));
  const count = (k: string) => Object.fromEntries([...new Set(requirements.map((r) => r[k]))].sort().map((v) => [v, requirements.filter((r) => r[k] === v).length]));
  return {
    contract: 'pilot/modernization-plan',
    contract_version: '1.0',
    status: 'NON_AUTHORITATIVE',
    note: 'Planning classification only. It approves, resolves and excludes nothing; implementation of any category still requires the scope to pass G2 (and G3/G4) with genuine signed approvals.',
    scope: sel,
    generated_at: snap.at.toISOString(),
    baseline: { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 },
    scope_sha256: ev.scope_sha256,
    readiness: ev.readiness,
    blocking_findings: ev.findings.filter((f) => f.blocking).map((f) => ({ id: f.id, kind: f.kind, outcome: f.outcome })),
    units: ev.units.map((u) => ({ name: u.name, kind: u.unit_kind, role: u.role, source_sha256: u.source_sha256 })),
    open_decisions: openDecisions.map((id) => {
      const d = snap.register.get(id)!;
      const f = facts.get(id);
      return { decision_id: id, kind: d.kind, roles: [...new Set(d.allowed_outcomes.flatMap((o) => requiredRoles(snap, d.kind, o)))].sort(), unresolved_names: (f?.names_used_by_programs ?? []).filter((u: any) => !u.declared_in_repository).map((u: any) => u.name), missing_artifacts: f?.separation?.D_missing_artifacts ?? [] };
    }),
    advisory_open_decisions: advisory.map((d) => ({ decision_id: d.decision_id, kind: d.kind, blocking: false, question: d.question })),
    unresolved_names: Object.fromEntries(unresolved),
    requirements,
    counts: { by_class: count('support_class'), by_category: count('category') },
  };
}

function planItem(snap: Snapshot, reader: SourceReader, it: Item, finding: { outcome: string; blocking: boolean; reasons: string[]; decisions: string[] }, ears: any[], unresolved: Map<string, string[]>, facts: Map<string, any>, tableDdl: (t: string) => any): any {
  const ctxr = checkItem(snap, reader, it);
  const ref = ctxr.refs.find((r: any) => r.statement_range) ?? null;
  const prog = ref ? reader.byFileId(ref.file_id) : null;
  const latestEar = ears.filter((x) => x.item_id === it.id).sort((x, y) => y.version - x.version)[0] ?? null;
  const earCurrent = latestEar ? adjudicationState(snap, ears, latestEar, it).current : false;
  const established =
    it.claim?.result === 'verified'
      ? { established: true, by: 'deterministic claim check of the cited statement' }
      : latestEar && earCurrent && latestEar.result.classification === 'SOURCE_CHAIN_VERIFIED'
        ? { established: true, by: `${latestEar.adjudication_id}: SOURCE_CHAIN_VERIFIED (dependency-aware source chain)` }
        : { established: false, by: latestEar ? `${latestEar.adjudication_id}: ${latestEar.result.classification}${latestEar.result.superseding_status ? `, ${latestEar.result.superseding_status}` : ''}` : `claim check: ${it.claim?.result ?? 'none'}` };

  let reached: Marked[] = [];
  let paragraphs: string[] = [];
  if (prog && ref) {
    const r = reachedStatements(prog, ref.statement_range[0]);
    paragraphs = r.paragraphs;
    reached = markDependencies(r.statements, unresolved);
  }
  const symbols = prog ? buildSymbolIndex(prog.dd, prog.abs) : null;
  const meaningful = reached.filter((s) => !STRUCTURAL.has(s.verb));
  const dependent = meaningful.filter((s) => s.depends_on.length);
  const support = classify({ contradicted: finding.outcome === 'CONTRADICTED', evidence_established: established.established, statements: meaningful.length, dependent: dependent.length });
  const decisionsInvolved = [...new Set(dependent.flatMap((s) => s.depends_on.flatMap((d) => d.decisions)))].sort();
  const sql = meaningful.filter((s) => /^EXEC\s+SQL/i.test(s.text)).map((s) => {
    const table = /\b(?:INSERT\s+INTO|FROM|UPDATE)\s+([A-Z][A-Z0-9_]*)/i.exec(s.text)?.[1]?.toUpperCase() ?? null;
    return { line: s.line, end_line: s.end_line, operation: /^EXEC\s+SQL\s+(\w+)/i.exec(s.text)?.[1].toUpperCase(), table, table_definition: table ? tableDdl(table) : null };
  });
  const condValue = (name: string) => {
    const d = symbols?.byName.get(name) ?? [];
    return d.length === 1 ? d[0].values : null;
  };
  const independent = meaningful.filter((s) => !s.depends_on.length);
  const hashes = [...new Map(ctxr.source_hashes.map((h) => [h.path, h.sha256])).entries()].map(([p, sha256]) => ({ path: p, sha256 }));
  if (prog && !hashes.some((h) => h.path === prog.rel)) hashes.unshift({ path: prog.rel, sha256: prog.sha256 });
  return {
    id: it.id,
    kind: it.kind,
    item_sha256: it.sha256,
    statement: it.data.statement ?? it.data.title ?? '',
    support_class: support,
    category: CATEGORY[support],
    g2: { outcome: finding.outcome, blocking: finding.blocking, reasons: finding.reasons, decisions: finding.decisions },
    evidence: {
      established: established.established,
      by: established.by,
      context_status: ctxr.status,
      cited: ref ? { path: ref.path, statement_id: ref.statement_id, statement_range: ref.statement_range, cited_line: ref.cited_line, cited_line_inside_statement: ref.cited_line_inside_statement } : null,
      dependencies: ctxr.refs.flatMap((r: any) => (r.references ?? []).filter((x: any) => x.declared).map((x: any) => ({ name: x.name, usage: x.usage, declared_in: x.declared.file, line: x.declared.line, values: x.declared.values }))),
      source_hashes: hashes,
    },
    reached_paragraphs: paragraphs,
    statements: { reached: meaningful.length, independent: independent.length, dependent: dependent.length },
    independent_portion: independent.map((s) => ({ paragraph: s.paragraph, line: s.line, end_line: s.end_line, text: s.text })),
    dependent_portion: dependent.map((s) => ({ paragraph: s.paragraph, line: s.line, end_line: s.end_line, text: s.text, depends_on: s.depends_on, inherited_from_line: s.inherited_from })),
    external_interfaces: sql,
    missing_information: [
      ...decisionsInvolved.flatMap((d) => facts.get(d)?.separation?.D_missing_artifacts ?? []),
      ...(established.established ? [] : [`the cited evidence does not establish the claim (${established.by})`]),
      ...(finding.outcome === 'CONTRADICTED' ? finding.reasons.filter((r) => /CONTRADICTED/.test(r)) : []),
    ].filter((x, i, arr) => arr.indexOf(x) === i),
    depends_on_decisions: decisionsInvolved,
    required_human_decisions: [...new Set([...finding.decisions, ...decisionsInvolved])].filter((id) => snap.resolutions.get(id)?.status !== 'resolved').sort(),
    implementable_independently: support === 'FULLY_SOURCE_SUPPORTED' ? 'yes, once the scope is approved' : support === 'PARTIALLY_SUPPORTED' ? 'only the independent portion, once the scope is approved; the dependent portion stays a preserved gap' : 'no',
    implied_tests: impliedTests(reached, condValue),
  };
}
