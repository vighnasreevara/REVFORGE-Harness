/**
 * Behaviour-level scope analysis and minimal candidate selection (STEP 12).
 * For each primary program of a scope it decomposes the procedure into
 * behaviours:
 *   - each PERFORM range the entry paragraph executes, with the WHEN that triggers it;
 *   - the entry dispatch itself;
 *   - the implicit no-match path of an EVALUATE TRUE without WHEN OTHER.
 *
 * For each behaviour it records:
 *   - the exact statements, the inputs read and outputs written, conditions, and side effects (embedded SQL, CALLs, file I/O);
 *   - the declared field dependencies (with permanent IDs where the catalogue agrees);
 *   - names it uses that the program declares nowhere, and the blocking decisions they wait for;
 *   - domain restrictions (binary truncation that depends on the compiler TRUNC option);
 *   - the requirements whose cited behaviour reaches it.
 *
 * Classification:
 *   VERIFIED_CANDIDATE  no dependent or external statement
 *   PARTIAL             some statements independent, some dependent or external
 *   GAP                 every statement dependent or external
 *
 * A behaviour is a SCOPE CANDIDATE only by requirement closure. Every
 * requirement that covers it must cover nothing but VERIFIED_CANDIDATE
 * behaviour, and none of its inputs may be written by a blocked behaviour.
 * The exact requirement subset is then evaluated with the existing G1 engine,
 * read-only. Limitations of the engine are reported, never worked around.
 *
 * Nothing is approved, resolved, excluded or generated here.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateScope, parseSelector, selectorText } from '../approval/scope';
import { Snapshot } from '../approval/snapshot';
import { requiredRoles } from '../approval/decisions';
import { reachedStatements, unresolvedNames, usesWord } from '../approval/semantic';
import { moveHazards } from '../approval/closure';
import { SourceReader } from '../blockers/deterministic';
import { analyse } from '../blockers/pipeline';
import { Workflow } from '../orchestrator/orchestrator';
import { buildSymbolIndex, logicalText, statementReferences } from '../../../verification/src/context';
import { findItem } from '../../../verification/src/layout';
import { picFacts } from '../../../verification/src/cobol-source';
import { Statement } from '../../../verification/src/facts';
import { dependencyFactSheet } from '../operations/package';
import { impliedTests, markDependencies } from './plan';

export type BehaviourClass = 'VERIFIED_CANDIDATE' | 'PARTIAL' | 'GAP';
const STRUCTURAL = new Set(['EXIT', 'END-IF', 'END-EVALUATE', 'ELSE', 'GOBACK']);
const sha = (o: unknown) => createHash('sha256').update(typeof o === 'string' ? o : JSON.stringify(o)).digest('hex');
const slug = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Pure classification (exported for tests). */
export function classifyBehaviour(meaningful: number, dependentOrExternal: number): BehaviourClass {
  if (!dependentOrExternal) return 'VERIFIED_CANDIDATE';
  return dependentOrExternal >= meaningful ? 'GAP' : 'PARTIAL';
}

/**
 * Requirement closure (exported for tests). The candidate's requirement set is the covering requirements whose whole
 * coverage is VERIFIED_CANDIDATE. Overlapping requirements that also describe unresolved behaviour cannot be part of
 * the subset (approving them would approve the unresolved part). They are listed, never dropped silently, and stay
 * blocking for the full program scope.
 */
export function closure(behaviour: string, coverage: Map<string, string[]>, classOf: Map<string, BehaviourClass>): { closed: boolean; requirements: string[]; overlapping: Array<{ requirement: string; unresolved: Array<{ behaviour: string; class: BehaviourClass }> }> } {
  const covering = [...coverage.entries()].filter(([, bs]) => bs.includes(behaviour)).map(([r]) => r).sort();
  const unresolved = (r: string) => coverage.get(r)!.filter((b) => classOf.get(b) !== 'VERIFIED_CANDIDATE').map((b) => ({ behaviour: b, class: classOf.get(b)! }));
  const requirements = covering.filter((r) => !unresolved(r).length);
  const overlapping = covering.filter((r) => unresolved(r).length).map((r) => ({ requirement: r, unresolved: unresolved(r) }));
  return { closed: requirements.length > 0, requirements, overlapping };
}

export function behaviourScope(wf: Workflow, scope: string): any {
  const a = analyse(wf);
  const snap: Snapshot = a.snap;
  const sel = selectorText(parseSelector(scope));
  const ev = evaluateScope(snap, parseSelector(sel));
  const reader = new SourceReader(snap);
  const programs = ev.units.filter((u) => u.role === 'primary' && u.unit_kind === 'program');
  const results = programs.map((u) => programScope(snap, reader, ev, u.name, u.file_id));
  return {
    contract: 'pilot/verified-scope',
    contract_version: '1.0',
    status: 'NON_AUTHORITATIVE',
    note: 'Behaviour classification and candidate selection only. A VERIFIED_CANDIDATE is not approved, and nothing is generated before genuine signed G1 and G2 approvals and an explicit generation authorisation.',
    generated_at: snap.at.toISOString(),
    baseline: { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 },
    scope: sel,
    scope_sha256: ev.scope_sha256,
    readiness: ev.readiness,
    programs: results,
  };
}

function programScope(snap: Snapshot, reader: SourceReader, ev: any, program: string, fileId: string): any {
  const prog = reader.byFileId(fileId);
  if (!prog) return { program, source_available: false };
  const pf = prog.pf;
  const idx = buildSymbolIndex(prog.dd, prog.abs);
  const unresolved = unresolvedNames(snap, program, prog, idx);
  const srcRoot = snap.ctx.srcRoot!;
  const fileIdOf = (abs: string) => [...snap.ctx.relByFile.entries()].find(([, r]) => r === path.relative(srcRoot, abs).split(path.sep).join('/'))?.[0] ?? null;
  const data: any = (snap.set.artifacts as any).data?.data ?? {};
  const fieldId = (name: string, file: string, line: number) => {
    const fid = fileIdOf(file);
    return (data.field_catalogue ?? []).find((f: any) => f.field_name === name && f.file_id === fid && f.source_line === line)?.field_id ?? (data.condition_catalogue ?? []).find((c: any) => c.condition_name === name && String(c.condition_id ?? '').startsWith(`${fid}-`) && c.source_line === line)?.condition_id ?? null;
  };
  const sources = [{ path: prog.rel, sha256: prog.sha256 }, ...prog.includedFiles.map((rel) => ({ path: rel, sha256: reader.accessed.get(rel) ?? null }))].filter((x, i, arr) => arr.findIndex((y) => y.path === x.path) === i);

  // Entry paragraph: dispatch and the behaviours it performs.
  // The entry logic is either unnamed (before the first paragraph header) or the first named paragraph.
  const unnamedEnd = (pf.paragraphs[0]?.line ?? prog.file.lines.length + 1) - 1;
  const unnamed = pf.statements.filter((s) => s.line >= (pf.procedure_start ?? 1) && s.line <= unnamedEnd);
  const entryPara = unnamed.length ? null : pf.paragraphs[0]?.name ?? null;
  const entryEnd = unnamed.length ? unnamedEnd : (pf.paragraphs[1]?.line ?? prog.file.lines.length + 1) - 1;
  const entry = unnamed.length ? unnamed : pf.statements.filter((s) => s.line >= (pf.paragraphs[0]?.line ?? 0) && s.line <= entryEnd);
  const entryKey = entryPara ?? '(unnamed)';
  const defs: Array<{ id: string; trigger: any; paragraphs: string[] }> = [];
  let when: Statement | null = null;
  for (const s of entry) {
    if (s.verb === 'WHEN') when = s;
    if (s.verb === 'END-EVALUATE') when = null;
    const p = pf.performs.find((x) => x.line === s.line);
    if (!p) continue;
    const i = pf.paragraphs.findIndex((q) => q.name === p.target);
    const j = p.thru ? pf.paragraphs.findIndex((q) => q.name === p.thru) : i;
    const names = pf.paragraphs.slice(i, j + 1).map((q) => q.name);
    const cond = when ? /^WHEN\s+([A-Z0-9-]+)\.?$/i.exec(when.text)?.[1]?.toUpperCase() ?? null : null;
    const cdef = cond ? idx.byName.get(cond)?.find((d) => d.kind === 'condition') ?? null : null;
    defs.push({ id: p.target, trigger: when ? { line: when.line, text: when.text, condition: cond, values: cdef?.values ?? null, field: cdef?.parent?.name ?? null } : null, paragraphs: names });
  }
  const evalTrueNoOther = entry.some((s) => /^EVALUATE\s+TRUE\b/i.test(s.text)) && !entry.some((s) => /^WHEN\s+OTHER\b/i.test(s.text));

  const analyseStatements = (stmts: Array<Statement & { paragraph: string | null }>) => {
    const marked = markDependencies(stmts, unresolved);
    const rows = marked.filter((s) => !STRUCTURAL.has(s.verb)).map((s) => {
      const refs = statementReferences(idx, logicalText(prog.file, s.line, s.end_line)).filter((r) => r.resolution === 'resolved' && r.definition);
      const up = s.text.toUpperCase().replace(/\.\s*$/, '');
      const writes = new Set<string>();
      if (/^MOVE\b/.test(up)) for (const w of (up.split(/\s+TO\s+/)[1] ?? '').split(/[\s,]+/)) if (w) writes.add(w);
      // SET cond-1 [cond-2 ...] TO TRUE: the targets precede TO.
      if (/^SET\b/.test(up)) for (const w of (/^SET\s+(.+?)\s+TO\s+/.exec(up)?.[1] ?? '').split(/[\s,]+/)) if (w) writes.add(w);
      if (/^INITIALIZE\s+/.test(up)) writes.add(up.split(/\s+/)[1]);
      if (/^EXEC\s+SQL\s+SELECT/.test(up)) for (const m of (/\bINTO\b([\s\S]*?)\bFROM\b/.exec(up)?.[1] ?? '').matchAll(/:([A-Z0-9-]+)/g)) writes.add(m[1]);
      // SET condition TO TRUE writes the condition's parent item.
      const written = [...writes].map((w) => idx.byName.get(w)?.find((d) => d.kind === 'condition')?.parent?.name ?? w);
      const reads = [...new Set(refs.map((r) => (r.definition!.kind === 'condition' && r.usage !== 'tested' ? null : r.definition!.kind === 'condition' ? r.definition!.parent?.name ?? r.name : r.name)).filter((n): n is string => !!n && !writes.has(n)))];
      const external = /^EXEC\s+SQL\b/i.test(up) ? { kind: 'embedded_sql', operation: /^EXEC\s+SQL\s+(\w+)/.exec(up)?.[1] ?? null, table: /\b(?:INSERT\s+INTO|FROM|UPDATE)\s+([A-Z][A-Z0-9_]*)/.exec(up)?.[1] ?? null } : s.verb === 'CALL' ? { kind: 'call', operation: 'CALL', table: null } : ['READ', 'WRITE', 'REWRITE', 'OPEN', 'CLOSE', 'START', 'DELETE'].includes(s.verb) ? { kind: 'file_io', operation: s.verb, table: null } : null;
      return {
        line: s.line,
        end_line: s.end_line,
        paragraph: s.paragraph,
        verb: s.verb,
        text: s.text,
        reads,
        writes: [...new Set(written)],
        function_inputs: /FUNCTION\s+CURRENT-DATE/.test(up) ? ['FUNCTION CURRENT-DATE (system date and time)'] : [],
        external,
        depends_on: s.depends_on,
        inherited_from_line: s.inherited_from,
        references: refs.map((r) => ({ name: r.name, kind: r.definition!.kind, declared_in: path.basename(r.definition!.file), line: r.definition!.line, values: r.definition!.values, permanent_id: fieldId(r.name, r.definition!.file, r.definition!.line) })),
      };
    });
    return { all: marked, rows };
  };

  const behaviour = (id: string, kind: string, trigger: any, paragraphs: string[], stmts: Array<Statement & { paragraph: string | null }>) => {
    const { all, rows } = analyseStatements(stmts);
    // Data-conversion hazards (shared with the approval closure): an undefined alphanumeric-to-numeric MOVE makes the
    // statement's result unknown for non-digit content; binary truncation only restricts the supported input domain.
    const hazards = rows.flatMap((r) => moveHazards(prog, idx, r));
    const blockedRows = rows.filter((r) => r.depends_on.length || r.external || hazards.some((h) => h.kind === 'ALNUM_TO_NUMERIC' && h.line === r.line));
    const cls = kind === 'no_match' ? 'VERIFIED_CANDIDATE' : classifyBehaviour(rows.length, blockedRows.length);
    const domain = hazards.filter((h) => h.kind === 'TRUNC').map((h) => {
      const pic = findItem(prog.dd, h.target)?.node.pic ?? '';
      return { line: h.line, item: h.target, pic, restriction: `values beyond the ${picFacts(pic).digits} digits of PIC ${pic} behave according to the compiler TRUNC option, which the repository does not record` };
    });
    const conversions = hazards.filter((h) => h.kind === 'ALNUM_TO_NUMERIC');
    return {
      behaviour_id: `${program}:${id}`,
      kind,
      trigger,
      paragraphs,
      source_lines: rows.length ? [Math.min(...rows.map((r) => r.line)), Math.max(...rows.map((r) => r.end_line))] : null,
      classification: cls,
      statements: rows,
      inputs: [...new Set(rows.flatMap((r) => [...r.reads, ...r.function_inputs]))].sort(),
      outputs: [...new Set(rows.flatMap((r) => r.writes))].sort(),
      conditions: rows.filter((r) => ['IF', 'EVALUATE', 'WHEN'].includes(r.verb)).map((r) => ({ line: r.line, text: r.text })),
      side_effects: rows.filter((r) => r.external).map((r) => ({ line: r.line, ...r.external })),
      unresolved_dependencies: [...new Map(rows.flatMap((r) => r.depends_on.map((d) => [d.name, d] as const))).values()],
      domain_restrictions: domain,
      undefined_conversions: conversions,
      implied_tests: impliedTests(all, (n) => idx.byName.get(n)?.find((d) => d.kind === 'condition')?.values ?? null),
      covered_by: [] as string[],
    };
  };

  const behaviours: any[] = defs.map((d) => {
    const stmts: Array<Statement & { paragraph: string | null }> = [];
    for (const p of d.paragraphs) for (const s of reachedStatements(prog, pf.paragraphs.find((q) => q.name === p)!.line).statements) if (!stmts.some((x) => x.line === s.line)) stmts.push(s);
    return behaviour(d.id, 'performed_range', d.trigger, d.paragraphs, stmts.sort((x, y) => x.line - y.line));
  });
  const dispatch = behaviour('ENTRY-DISPATCH', 'dispatch', null, [entryPara ?? '(entry)'], entry.map((s) => ({ ...s, paragraph: entryPara })));
  // The dispatch's observable result is whatever the selected behaviour does: it is only as verified as its targets.
  const worst = behaviours.some((b) => b.classification !== 'VERIFIED_CANDIDATE') ? 'PARTIAL' : dispatch.classification;
  dispatch.classification = worst;
  behaviours.unshift(dispatch);
  if (evalTrueNoOther) behaviours.push({ ...behaviour('NO-MATCH', 'no_match', { line: null, text: 'no WHEN condition is true (no WHEN OTHER)', condition: null, values: null, field: null }, [], []), outputs: [], inputs: [] });

  // Coverage: requirements whose cited behaviour reaches each behaviour.
  const items = snap.items.filter((it) => (it.kind === 'requirement' || it.kind === 'runtime_requirement') && it.units.some((x) => x.file_id === fileId) && ev.findings.some((f: any) => f.id === it.id));
  const coverage = new Map<string, string[]>();
  for (const it of items) {
    const ref = (it.source_refs ?? []).find((r: any) => r.file_id === fileId && Number.isInteger(r.line));
    if (!ref) continue;
    const reached = new Set(reachedStatements(prog, ref.line).paragraphs);
    const bs = behaviours.filter((b) => (b.kind === 'dispatch' || b.kind === 'no_match' ? reached.has(entryKey) : b.paragraphs.some((p: string) => reached.has(p)))).map((b) => b.behaviour_id);
    coverage.set(it.id, bs);
    for (const b of behaviours) if (bs.includes(b.behaviour_id)) b.covered_by.push(it.id);
  }
  const classOf = new Map(behaviours.map((b) => [b.behaviour_id, b.classification as BehaviourClass]));
  const finding = (id: string) => ev.findings.find((f: any) => f.id === id);

  // Cross-call data flow: an input written by a blocked behaviour may carry unverified values into the candidate.
  const blockedWrites = new Map<string, string[]>();
  for (const b of behaviours.filter((x) => x.classification !== 'VERIFIED_CANDIDATE' && x.kind === 'performed_range')) for (const o of b.outputs) blockedWrites.set(o, [...(blockedWrites.get(o) ?? []), b.behaviour_id]);

  const candidates = behaviours
    .filter((b) => b.classification === 'VERIFIED_CANDIDATE')
    .map((b) => {
      const c = closure(b.behaviour_id, coverage, classOf);
      const tainted = b.inputs.filter((i: string) => blockedWrites.has(i)).map((i: string) => ({ input: i, written_by: blockedWrites.get(i) }));
      const reason = !c.closed
        ? `every covering requirement (${c.overlapping.map((o) => o.requirement).join(', ') || 'none'}) also covers unresolved behaviour (${[...new Set(c.overlapping.flatMap((o) => o.unresolved.map((u) => `${u.behaviour} ${u.class}`)))].join(', ')}): approving it would approve that behaviour`
        : tainted.length
          ? `input(s) ${tainted.map((t: any) => t.input).join(', ')} are written by blocked behaviour`
          : `closure holds with ${c.requirements.join(', ')}${c.overlapping.length ? `; overlapping ${c.overlapping.map((o) => o.requirement).join(', ')} stay outside the subset (they also cover unresolved behaviour)` : ''}`;
      return { behaviour_id: b.behaviour_id, statements: b.statements.length, requirements: c.requirements, overlapping_requirements: c.overlapping, closed: c.closed && !tainted.length, tainted_inputs: tainted, reason };
    })
    .sort((x, y) => Number(y.closed) - Number(x.closed) || x.statements - y.statements);
  const selected = candidates.find((c) => c.closed) ?? null;

  const gaps = gapHandoff(snap, program, prog, behaviours, coverage);
  const g2 = selected ? subsetEligibility(snap, selected, behaviours, coverage, program) : null;

  return {
    program,
    file_id: fileId,
    source_available: true,
    sources,
    unresolved_names: Object.fromEntries(unresolved),
    behaviours,
    requirement_coverage: Object.fromEntries([...coverage.entries()].map(([r, bs]) => [r, { behaviours: bs, g2_outcome: finding(r)?.outcome ?? null, blocking: finding(r)?.blocking ?? null, decisions: finding(r)?.decisions ?? [] }])),
    candidates,
    selected_candidate: selected ? candidateManifest(snap, selected, behaviours, coverage, sources, gaps, g2) : null,
    no_candidate_reason: selected ? null : 'no VERIFIED_CANDIDATE behaviour satisfies requirement closure',
    gaps,
    g2_subset_eligibility: g2,
  };
}

/** One stable, never-resolved-here gap per unresolved dependency, external operation and domain restriction. */
function gapHandoff(snap: Snapshot, program: string, prog: any, behaviours: any[], coverage: Map<string, string[]>): any[] {
  const gaps: any[] = [];
  const reqsFor = (b: any) => [...coverage.entries()].filter(([, bs]) => bs.includes(b.behaviour_id)).map(([r]) => r).sort();
  const facts = new Map<string, any>();
  const fact = (id: string) => (facts.has(id) ? facts.get(id) : (facts.set(id, dependencyFactSheet(snap, id)), facts.get(id)));
  for (const b of behaviours.filter((x) => x.kind === 'performed_range')) {
    const para = b.paragraphs[0];
    const trigger = b.trigger ? `${b.trigger.condition ?? b.trigger.text}${b.trigger.values ? ` (${b.trigger.values.map((v: string) => `'${v}'`).join(', ')})` : ''}` : 'its PERFORM';
    for (const dep of b.unresolved_dependencies) {
      const rows = b.statements.filter((r: any) => r.depends_on.some((d: any) => d.name === dep.name));
      const decisions = dep.decisions as string[];
      gaps.push({
        gap_id: `GAP-${slug(program)}-${slug(para)}-${slug(dep.name)}`,
        kind: 'UNDECLARED_NAME_SEMANTICS',
        behaviour_id: b.behaviour_id,
        source: { path: prog.rel, sha256: prog.sha256, lines: rows.map((r: any) => r.line), statements: rows.map((r: any) => ({ line: r.line, text: r.text })) },
        missing_fact: `${dep.name} is used but declared nowhere in the repository; its layout and value meanings are the subject of ${decisions.join(', ')}${fact(decisions[0])?.separation?.D_missing_artifacts?.length ? ` (missing: ${fact(decisions[0]).separation.D_missing_artifacts.join('; ')})` : ''}`,
        why_unsafe: `the outputs of these statements (${[...new Set(rows.flatMap((r: any) => r.writes))].join(', ') || 'control flow'}) depend on a value whose meaning is not established; any Java mapping would invent it`,
        affected_requirements: reqsFor(b),
        affected_java_component: `outcome mapping of behaviour ${para} (behind a port whose only implementation throws until the gap is resolved)`,
        required_action: decisions.map((d) => `${d}: a signed resolution by ${[...new Set((snap.register.get(d)?.allowed_outcomes ?? []).flatMap((o) => requiredRoles(snap, snap.register.get(d)!.kind, o)))].join('/')}`),
        validation_evidence: `the real definition of ${dep.name} for the target runtime and a captured legacy run showing each outcome branch`,
        blocks_execution_path: `request ${trigger} -> ${para}: statements ${rows.map((r: any) => r.line).join(', ')}`,
        blocking: true,
        status: 'OPEN',
      });
    }
    for (const se of b.side_effects.filter((s: any) => s.kind === 'embedded_sql')) {
      const row = b.statements.find((r: any) => r.line === se.line);
      gaps.push({
        gap_id: `GAP-${slug(program)}-${slug(para)}-SQL-${slug(se.operation ?? 'STMT')}-${slug(se.table ?? 'UNKNOWN')}`,
        kind: 'EXTERNAL_DATABASE_RUNTIME',
        behaviour_id: b.behaviour_id,
        source: { path: prog.rel, sha256: prog.sha256, lines: [row.line, row.end_line], statements: [{ line: row.line, text: row.text }] },
        missing_fact: `the runtime behaviour of embedded SQL ${se.operation} on ${se.table}: database product and version, host-variable conversions, NULL and no-row results, constraint violations and the status they report`,
        why_unsafe: 'the result and every status it produces come from an external database the repository does not describe; a Java implementation would have to assume them',
        affected_requirements: reqsFor(b),
        affected_java_component: `database port for ${se.operation} ${se.table} (interface only; no implementation until specified)`,
        required_action: ['an approved specification of the database interaction (technical authority), recorded as an ADR at G2'],
        validation_evidence: 'a captured run against the real (or an approved equivalent) database for each outcome, including errors',
        blocks_execution_path: `request ${trigger} -> ${para}: statement ${row.line}`,
        blocking: true,
        status: 'OPEN',
      });
    }
    // File I/O and CALL side effects make a behaviour non-verified exactly like embedded SQL, so they are documented the
    // same way (STEP 20): one gap per paragraph, operation and file or callee, never resolved here.
    const external = new Map<string, { kind: string; op: string; target: string; rows: any[] }>();
    for (const se of b.side_effects.filter((s: any) => s.kind === 'file_io' || s.kind === 'call')) {
      const row = b.statements.find((r: any) => r.line === se.line);
      const up = String(row.text).toUpperCase();
      const target = se.kind === 'call' ? /^CALL\s+['"]?([A-Z0-9-]+)/.exec(up)?.[1] ?? 'DYNAMIC' : /^(?:OPEN\s+(?:INPUT|OUTPUT|I-O|EXTEND)|READ|WRITE|REWRITE|DELETE|START|CLOSE)\s+([A-Z0-9-]+)/.exec(up)?.[1] ?? 'UNKNOWN';
      const key = `${se.kind}:${se.operation}:${target}`;
      const e = external.get(key) ?? { kind: se.kind, op: se.operation, target, rows: [] as any[] };
      e.rows.push(row);
      external.set(key, e);
    }
    for (const e of external.values()) {
      const file = e.kind === 'file_io';
      gaps.push({
        gap_id: `GAP-${slug(program)}-${slug(para)}-${file ? 'FILE' : 'CALL'}-${slug(e.op)}-${slug(e.target)}`,
        kind: file ? 'EXTERNAL_FILE_RUNTIME' : 'EXTERNAL_PROGRAM_CALL',
        behaviour_id: b.behaviour_id,
        source: { path: prog.rel, sha256: prog.sha256, lines: e.rows.map((r: any) => r.line), statements: e.rows.map((r: any) => ({ line: r.line, text: r.text })) },
        missing_fact: file
          ? `the run-time behaviour of ${e.op} on ${e.target}: the dataset bound to it (JCL DD), its content and record encoding, and the file-system status outcomes the COBOL source does not define`
          : `the behaviour of the called program ${e.target} for this USING interface; it is established only by ${e.target}'s own closure and evidence, never by this behaviour`,
        why_unsafe: file
          ? 'the records read and the statuses reported come from a dataset outside the program; a Java implementation verified only against source-derived fixtures does not establish them'
          : `the outputs this behaviour receives back from ${e.target} are not part of this closure; treating them as known would assume the callee's behaviour`,
        affected_requirements: reqsFor(b),
        affected_java_component: file ? `file port for ${e.op} ${e.target} (runtime file semantics; dataset contents unverified)` : `call to ${e.target} through the program registry`,
        required_action: file ? ['the dataset definitions (JCL DD, organisation, record format) and a captured legacy run for each status outcome (technical authority)'] : [`${e.target}: its own source readiness and a recorded interface contract for the USING parameters`],
        validation_evidence: file ? 'a captured legacy run against the real (or an approved equivalent) dataset, including end-of-file and error statuses' : `a captured legacy run of the call to ${e.target} for each outcome it returns`,
        blocks_execution_path: `request ${trigger} -> ${para}: statement(s) ${e.rows.map((r: any) => r.line).join(', ')}`,
        blocking: true,
        status: 'OPEN',
      });
    }
    for (const h of b.undefined_conversions ?? []) {
      gaps.push({
        gap_id: `GAP-${slug(program)}-${slug(para)}-ALNUM-TO-NUMERIC-${slug(h.target)}`,
        kind: 'DATA_CONVERSION_UNDEFINED',
        behaviour_id: b.behaviour_id,
        source: { path: prog.rel, sha256: prog.sha256, lines: [h.line], statements: b.statements.filter((r: any) => r.line === h.line).map((r: any) => ({ line: r.line, text: r.text })) },
        missing_fact: h.detail,
        why_unsafe: `for content that is not all digits the value of ${h.target}, and every result computed from it, is not defined by the source; a Java conversion would have to invent it`,
        affected_requirements: reqsFor(b),
        affected_java_component: `input conversion of behaviour ${para}: only all-digit content is supported; anything else fails explicitly as unsupported`,
        required_action: ['the business rule for non-numeric and decimal input (business SME), or the compiler options and a captured legacy run (technical authority)'],
        validation_evidence: 'a captured legacy run with non-digit, decimal, signed and space-padded input',
        blocks_execution_path: `request ${trigger} -> ${para}: statement ${h.line} for content that is not all digits`,
        blocking: true,
        status: 'OPEN',
      });
    }
    for (const d of b.domain_restrictions) {
      gaps.push({
        gap_id: `GAP-${slug(program)}-${slug(para)}-TRUNC-${slug(d.item)}`,
        kind: 'COMPILER_OPTION_DEPENDENT',
        behaviour_id: b.behaviour_id,
        source: { path: prog.rel, sha256: prog.sha256, lines: [d.line], statements: b.statements.filter((r: any) => r.line === d.line).map((r: any) => ({ line: r.line, text: r.text })) },
        missing_fact: `the compiler TRUNC option used for ${program} (binary item ${d.item} ${d.pic})`,
        why_unsafe: d.restriction,
        affected_requirements: reqsFor(b),
        affected_java_component: `input validation of behaviour ${para}: values outside the PIC range are rejected, not truncated, until the option is known`,
        required_action: ['the build/compile options of the legacy program (technical authority)'],
        validation_evidence: 'the compile listing or JCL showing TRUNC(STD|OPT|BIN), or a captured run with an out-of-range value',
        blocks_execution_path: `only inputs outside the PIC range of ${d.item}`,
        blocking: false,
        status: 'OPEN',
      });
    }
  }
  return [...new Map(gaps.map((g) => [g.gap_id, g])).values()];
}

/** The exact requirement subset, evaluated read-only with the existing G1 engine, plus the limitations found. */
function subsetEligibility(snap: Snapshot, selected: any, behaviours: any[], coverage: Map<string, string[]>, program: string): any {
  // The engine accepts only requirement IDs in a requirements selector; runtime requirements are included unit-wide.
  const named = selected.requirements.filter((id: string) => snap.itemById.get(id)?.kind === 'requirement');
  const implicit = selected.requirements.filter((id: string) => !named.includes(id));
  if (!named.length) return { selector: null, representable_without_policy_change: false, limitations: [{ id: 'L0', limitation: 'the candidate consists only of runtime requirements, which a requirements selector cannot name', effect: 'no subset scope can be expressed', minimal_policy_change: 'allow runtime requirement IDs in the requirements selector' }] };
  const selector = `requirements:${named.join(',')}`;
  const ev = evaluateScope(snap, parseSelector(selector));
  const inCandidate = new Set(selected.requirements);
  const candidateDecisions = new Set(ev.findings.filter((f) => inCandidate.has(f.id)).flatMap((f) => f.decisions));
  const b = behaviours.find((x) => x.behaviour_id === selected.behaviour_id);
  const names = new Set(b.statements.flatMap((r: any) => r.references.map((x: any) => x.name)));
  const blocking = ev.findings.filter((f) => f.blocking).map((f) => {
    let category: string;
    if (inCandidate.has(f.id)) category = 'candidate_requirement';
    else if (candidateDecisions.has(f.id)) category = 'decision_required_by_candidate';
    else if (f.kind.startsWith('decision')) {
      const d = snap.register.get(f.id);
      const usesItsNames = !!d && b.statements.some((r: any) => (d.question.match(/\b[A-Z][A-Z0-9-]{4,}\b/g) ?? []).some((n) => names.has(n) || usesWord(r.text, n)));
      category = usesItsNames ? 'shared_dependency_used_by_candidate' : 'shared_dependency_not_used_by_candidate';
    } else category = 'item_outside_candidate';
    return { id: f.id, kind: f.kind, outcome: f.outcome, category, reasons: f.reasons.slice(0, 2), decisions: f.decisions };
  });
  const limitations: any[] = [];
  const outside = blocking.filter((x) => x.category === 'item_outside_candidate');
  if (outside.length || implicit.length)
    limitations.push({
      id: 'L1',
      limitation: `a requirements:<ids> selector accepts and filters only items of kind "requirement": runtime requirement IDs are rejected (so ${implicit.join(', ') || 'none of the candidate items'} could only be included implicitly), and every runtime requirement, file-operation and data-record item of the unit is included`,
      effect: `blocking items outside the candidate are in the subset scope: ${outside.map((x) => x.id).join(', ')}`,
      minimal_policy_change: 'let the requirements selector also select runtime requirements by ID (RT-*), and include the unit\'s data contracts only when a selected item references their fields; everything selected still needs evidence and a signature',
    });
  const shared = blocking.filter((x) => x.category === 'shared_dependency_not_used_by_candidate');
  if (shared.length)
    limitations.push({
      id: 'L2',
      limitation: 'a unit-level decision with no affected requirements applies to every scope on the unit, even when the selected behaviour never reaches what it concerns',
      effect: `decisions not reached by the candidate still block it: ${shared.map((x) => x.id).join(', ')}`,
      minimal_policy_change: 'apply such a decision to a requirements subset only when a selected item reaches its subject (the same semantic edge G1 now computes), and list it as a reviewable, traceable deferral otherwise. It is never excluded or resolved implicitly, and it still applies to the program scope.',
    });
  return {
    selector,
    named_requirements: named,
    implicitly_included_candidate_items: implicit,
    scope_sha256: ev.scope_sha256,
    readiness: ev.readiness,
    blocking_findings: blocking,
    counts: Object.fromEntries([...new Set(blocking.map((x) => x.category))].map((c) => [c, blocking.filter((x) => x.category === c).length])),
    representable_without_policy_change: !limitations.length,
    limitations,
    note: 'Read-only evaluation. Nothing was approved; G1 for this subset would still need the listed decisions signed, a trust store, an exported request and a signed approval bound to this exact scope digest.',
  };
}

function candidateManifest(snap: Snapshot, selected: any, behaviours: any[], coverage: Map<string, string[]>, sources: any[], gaps: any[], g2: any): any {
  const b = behaviours.find((x) => x.behaviour_id === selected.behaviour_id);
  const reqs = selected.requirements.map((id: string) => {
    const it = snap.itemById.get(id)!;
    return { id, kind: it.kind, item_sha256: it.sha256, statement: it.data.statement ?? it.data.title ?? '', rules: (it.data.derived_from_rules ?? []).map((r: any) => r.id ?? r), cited: it.source_refs?.[0] ?? null };
  });
  const excluded = behaviours.filter((x) => x.behaviour_id !== b.behaviour_id).map((x) => ({ behaviour_id: x.behaviour_id, classification: x.classification, why_excluded: x.classification === 'VERIFIED_CANDIDATE' ? 'verified, but its covering requirement(s) also cover unresolved behaviour (no requirement closure)' : 'depends on unresolved or external behaviour' }));
  // Every covering requirement reaches the whole behaviour; the cited statement is marked per requirement.
  const traceability = b.statements.map((r: any) => ({
    cobol_line: r.line,
    statement: r.text,
    requirements: reqs.map((q: any) => (q.cited?.line >= r.line && q.cited?.line <= r.end_line ? `${q.id} (cited)` : q.id)),
    fields: r.references.map((x: any) => `${x.name} (${x.declared_in}:${x.line}${x.permanent_id ? `, ${x.permanent_id}` : ''})`),
  }));
  return {
    behaviour_id: b.behaviour_id,
    classification: b.classification,
    source_identity: sources,
    source_lines: b.source_lines,
    paragraphs: b.paragraphs,
    trigger: b.trigger,
    requirements: reqs,
    overlapping_requirements: selected.overlapping_requirements,
    output_specification: b.outputs.map((o: string) => {
      const naming = reqs.filter((q: any) => usesWord(q.statement, o)).map((q: any) => q.id);
      return { output: o, named_by: naming, status: naming.length ? 'named by a candidate requirement' : 'not named by any candidate requirement: the reviewer must confirm the requirement text covers it' };
    }),
    rule_ids: [...new Set(reqs.flatMap((q: any) => q.rules))].sort(),
    inputs: b.inputs,
    outputs: b.outputs,
    conditions: b.conditions,
    side_effects: b.side_effects,
    data_dependencies: [...new Map(b.statements.flatMap((r: any) => r.references).map((x: any) => [`${x.name}:${x.declared_in}:${x.line}`, x])).values()],
    control_flow_boundary: `enters at ${b.paragraphs[0]} (PERFORM ${b.paragraphs[0]}${b.paragraphs.length > 1 ? ` THRU ${b.paragraphs[b.paragraphs.length - 1]}` : ''}), returns to the caller's dispatch; the dispatch itself is excluded`,
    domain_restrictions: b.domain_restrictions,
    gaps_affecting_candidate: gaps.filter((g) => g.behaviour_id === b.behaviour_id),
    tainted_inputs: selected.tainted_inputs,
    implied_tests: b.implied_tests,
    traceability,
    excluded_behaviour: excluded,
    content_sha256: sha({ b: b.statements.map((r: any) => [r.line, r.text]), reqs: reqs.map((q: any) => [q.id, q.item_sha256]), sources }),
    g2_subset: g2 ? { selector: g2.selector, scope_sha256: g2.scope_sha256, readiness: g2.readiness } : null,
  };
}

export function writeScope(dir: string, name: string, data: any): string {
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, name);
  fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
  return f;
}
