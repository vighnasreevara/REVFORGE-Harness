/**
 * Application-wide modernization status (STEP 15). For every real program:
 * inventory facts, SOURCE_READINESS (engineering gate 1), the local
 * converter's capability (parse only), generation authorisation, and an
 * honest conversion status. Also coverage of copybooks, DB2 definitions,
 * JCL, business rules and gap groups.
 *
 * While generation is unauthorised the converter only PARSES real programs,
 * to report which constructs it supports. It emits no Java for them, and no
 * source text leaves the machine: only metadata (paths, hashes, construct
 * names, line numbers) is reported.
 *
 * STEP 16: a program whose Java was generated under a valid program-scoped
 * local authorisation (forward/generated/java/<PROGRAM>/) and whose output
 * passes CONVERSION_VALIDATION takes the validated label; its business rules
 * are mapped to Java through the source map.
 *
 * Status vocabulary:
 *   COMPLETE / PARTIAL / FAILED  only for Java actually generated and validated (CONVERSION_VALIDATION)
 *   BLOCKED                      work began but conversion is blocked (authorisation, source or converter support)
 *   NOT_ATTEMPTED                no work began
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { buildSnapshot } from '../approval/snapshot';
import { SourceReader } from '../blockers/deterministic';
import { Workflow } from '../orchestrator/orchestrator';
import { RuntimeContext } from '../core/config';
import { readSource, resolveMember } from '../../../verification/src/facts';
import { codeText } from '../../../verification/src/cobol-source';
import { findGaps, parseProgram, UnsupportedConstruct } from './cobol-subset';
import { authorisationStatus, conversionValidation, sourceReadiness } from './gates';
import { checkLocalAuthorization } from './authorization';

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Construct families the converter does not yet translate (or translates only partly), detected per code line. */
export const CONSTRUCTS: Record<string, RegExp> = {
  file_section: /^\s*FD\s+/,
  file_io: /\b(OPEN|CLOSE|READ|WRITE|REWRITE|START)\b/,
  embedded_sql: /\bEXEC\s+SQL\b/,
  cics: /\bEXEC\s+CICS\b/,
  packed_decimal: /\b(COMP-3|PACKED-DECIMAL)\b/,
  occurs: /\bOCCURS\b/,
  redefines: /\bREDEFINES\b/,
  perform_loop: /\bPERFORM\b.*\b(UNTIL|VARYING|TIMES)\b/,
  arithmetic: /^\s*(COMPUTE|ADD|SUBTRACT|MULTIPLY|DIVIDE)\b/,
  string_ops: /^\s*(STRING|UNSTRING|INSPECT)\b/,
  go_to: /\bGO\s+TO\b/,
  call: /^\s*CALL\b/,
  display_accept: /^\s*(DISPLAY|ACCEPT)\b/,
  intrinsic_function: /\bFUNCTION\s+[A-Z]/,
};

export function applicationStatus(wf: Workflow, ctx: RuntimeContext): any {
  const snap = buildSnapshot(wf);
  const reader = new SourceReader(snap);
  const auth = authorisationStatus(wf, ctx);
  const root = snap.ctx.srcRoot;
  const resolve = (m: string) => {
    const p = resolveMember(reader.idx, m);
    return p ? readSource(p)?.file ?? null : null;
  };
  const inventory = new Set(snap.sys.programs.map((p) => p.program_id));
  const rulesByProgram = new Map<string, string[]>();
  for (const [id, r] of snap.rules) for (const pid of new Set([r.primary_source?.program_id, ...(r.sources ?? []).map((s: any) => s.program_id)].filter(Boolean) as string[])) rulesByProgram.set(pid, [...(rulesByProgram.get(pid) ?? []), id]);

  const programs = snap.sys.programs.map((p) => {
    const src = reader.byFileId(p.file_id);
    const rel = snap.ctx.relByFile.get(p.file_id) ?? null;
    const row: any = { program: p.program_id, source: rel, source_available: !!src && src.pf.statements.length > 0, source_sha256: src?.sha256 ?? null, includes: src?.dd.includes.map((i) => i.name) ?? [], calls: src?.pf.calls.map((c) => c.target) ?? [], sql: src?.pf.sql.length ?? 0, cics: src ? src.file.lines.filter((l) => /EXEC\s+CICS/i.test(l)).length : 0, file_io: src?.pf.io.length ?? 0, rules: (rulesByProgram.get(p.program_id) ?? []).sort() };
    // Engineering gate 1.
    try {
      const g = sourceReadiness(wf, p.program_id);
      row.source_readiness = { status: g.status, failing: g.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`.slice(0, 300)), behaviours: g.behaviours.map((b: any) => b.classification), gaps: g.gaps.map((x: any) => x.gap_id) };
    } catch (e: any) {
      row.source_readiness = { status: 'FAIL', failing: [`evaluation error: ${String(e.message).slice(0, 200)}`], behaviours: [], gaps: [] };
    }
    // Converter capability: parse only; no Java is emitted for real source.
    if (src && root) {
      try {
        const prog = parseProgram(src.abs, resolve);
        const gaps = findGaps(prog, new Set(), src.file.lines);
        const inv = prog.paragraphs.flatMap((q) => q.body).length;
        const notes: string[] = [];
        if (!prog.data.linkage || prog.using.length !== 1) notes.push('not a single-LINKAGE callable program (batch/online entry needs a launcher the converter does not generate)');
        const calls = gaps.filter((g) => g.kind === 'UNDEFINED_EXTERNAL_CALL' && inventory.has(g.subject)).map((g) => g.subject);
        if (calls.length) notes.push(`calls inventory program(s) ${[...new Set(calls)].join(', ')} (multi-program linking is not generated yet)`);
        const entry = prog.paragraphs[0];
        if (entry?.body[entry.body.length - 1]?.kind !== 'goback') notes.push('the entry paragraph does not end with GOBACK');
        row.converter = { parse: 'SUPPORTED', top_level_statements: inv, gaps: gaps.map((g) => ({ kind: g.kind, subject: g.subject, line: g.origin.line, stable_ref: g.stable_ref })), pre_emission_findings: notes, ready: notes.length === 0 };
      } catch (e: any) {
        if (e instanceof UnsupportedConstruct) row.converter = { parse: 'UNSUPPORTED', line: e.line, construct: e.construct, ready: false };
        else row.converter = { parse: 'ERROR', error: String(e.message).slice(0, 200), ready: false };
      }
    } else row.converter = { parse: 'NO_SOURCE', ready: false };
    // Construct families present (counts of code lines only; no source text is reported).
    if (src) {
      const code = src.file.lines.map((l) => codeText(l)).filter((x): x is string => x !== null).map((x) => x.toUpperCase());
      const has = (re: RegExp) => code.filter((x) => re.test(x)).length;
      row.constructs = Object.fromEntries(
        Object.entries(CONSTRUCTS)
          .map(([k, re]) => [k, has(re)] as const)
          .filter(([, n]) => n > 0),
      );
    } else row.constructs = {};
    // Program-scoped local authorisation and any authorised generation output.
    const genDir = path.join(ctx.forwardDir, 'generated', 'java', p.program_id);
    const local = checkLocalAuthorization(wf, ctx, p.program_id, genDir, snap.at);
    row.local_authorization = local.authorization ? { record_id: local.authorization.record_id, ok: local.ok, failing: local.checks.filter((c) => !c.ok).map((c) => c.id) } : null;
    row.generation_authorized = auth.generation_authorized || local.ok;
    row.java_files = [];
    row.compilation = 'NOT_RUN';
    row.tests = 'NOT_RUN';
    row.conversion_status = 'BLOCKED';
    const resultFile = path.join(genDir, 'pilot-result.json');
    if (local.ok && fs.existsSync(resultFile)) {
      const r = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
      const v = conversionValidation(ctx, genDir);
      row.generation = { output_dir: local.authorization.output_dir, authorization: r.authorization?.record_id ?? null, conversion_validation: v.status, label: v.label, failing: v.checks.filter((c) => !c.ok).map((c) => c.id), gaps: (r.gaps ?? []).map((g: any) => g.gap_id), counts: r.execution?.counts ?? null, equivalence: r.equivalence ?? null };
      // STEP 17: a program whose every executed check stays blocked fails the gate only on tests_passed; it is still generated and tested.
      const allBlocked = row.generation.failing.length === 1 && row.generation.failing[0] === 'tests_passed' && r.execution?.counts?.PASS === 0 && r.execution?.counts?.FAIL === 0;
      row.generation.gap_kinds = (r.gaps ?? []).reduce((m: Record<string, number>, g: any) => ({ ...m, [g.kind]: (m[g.kind] ?? 0) + 1 }), {});
      row.generation.scenarios = r.behaviour_cases ?? null;
      row.generation.sql_boundaries = (r.gaps ?? []).filter((g: any) => /^EXEC SQL/.test(g.subject)).length;
      row.generation.cics_boundaries = (r.gaps ?? []).filter((g: any) => /^EXEC CICS/.test(g.subject)).length;
      if (r.conversion_status === 'FAILED' && r.failure) {
        row.conversion_status = 'FAILED';
        row.blocked_by = [r.conversion_status_reason ?? r.failure.construct];
        return row;
      }
      if ((v.status === 'PASS' || allBlocked) && r.authorization?.record_id === local.authorization.record_id && r.inputs?.[0]?.sha256 === row.source_sha256) {
        const map = JSON.parse(fs.readFileSync(path.join(genDir, 'source-map.json'), 'utf8'));
        row.source_map = map;
        row.result_gaps = (r.gaps ?? []).map((g: any) => ({ gap_id: g.gap_id, kind: g.kind, subject: g.subject }));
        row.coverage = r.coverage ?? null;
        row.cond_checks = (r.execution?.cases ?? []).filter((c: any) => /^C88 /.test(c.id)).map((c: any) => ({ name: c.id.slice(4), status: c.status }));
        row.generation_copybooks = local.authorization.copybooks.map((c: any) => c.path);
        row.java_files = JSON.parse(fs.readFileSync(path.join(genDir, 'evidence-manifest.json'), 'utf8')).outputs.map((o: any) => o.path).filter((x: string) => x.endsWith('.java'));
        row.compilation = r.compilation?.status ?? 'NOT_RUN';
        row.tests = r.execution?.counts ? `${r.execution.counts.PASS} passed, ${r.execution.counts.BLOCKED_AS_EXPECTED} blocked as expected, ${r.execution.counts.FAIL} failed` : 'NOT_RUN';
        row.conversion_status = v.label;
        row.conversion_status = r.conversion_status;
        row.blocked_by = [...(row.generation.gaps.length ? [`${row.generation.gaps.length} open gap(s): ${Object.entries(row.generation.gap_kinds).map(([k, n]) => `${k} ${n}`).join(', ')} (paths blocked)`] : []), ...(allBlocked ? ['CONVERSION_VALIDATION: no passing check (every executed path is blocked)'] : []), `equivalence: ${r.equivalence}`];
        return row;
      }
    }
    row.blocked_by = [...(row.generation_authorized ? [] : ['generation not authorised']), ...(row.generation && row.generation.conversion_validation !== 'PASS' ? [`CONVERSION_VALIDATION FAIL (${row.generation.failing.join(', ')})`] : []), ...(row.source_available ? [] : ['no source statements']), ...(row.source_readiness.status === 'PASS' ? [] : ['SOURCE_READINESS FAIL']), ...(row.converter.ready ? [] : [`converter: ${row.converter.parse === 'UNSUPPORTED' ? `${row.converter.construct} (line ${row.converter.line})` : row.converter.parse === 'SUPPORTED' ? row.converter.pre_emission_findings.join('; ') : row.converter.parse}`])];
    return row;
  });

  // Copybooks, DB2 definitions, JCL. A copybook bound into a validated authorised generation has its record classes generated there.
  const javaModel = (rel: string | null) => {
    const g = programs.filter((p) => p.java_files.length && rel && (p.generation_copybooks ?? []).includes(rel));
    return g.length ? `GENERATED with ${g.map((p) => `${p.program} (${p.generation.output_dir})`).join(', ')}` : 'NOT_GENERATED';
  };
  const copybooks = snap.sys.copybooks.map((c) => ({ copybook: c.name, path: c.file_id ? snap.ctx.relByFile.get(c.file_id) ?? null : null, sha256: c.file_id ? snap.sourceHashes.get(c.file_id) ?? null : null, used_by: programs.filter((p) => p.includes.includes(c.name)).map((p) => p.program), data_records: snap.items.filter((i) => i.kind === 'data_record' && i.units.some((u) => u.file_id === c.file_id)).length, java_model: javaModel(c.file_id ? snap.ctx.relByFile.get(c.file_id) ?? null : null) }));
  const walk = (d: string): string[] => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
  const files = root ? walk(root) : [];
  const relOf = (f: string) => path.relative(root!, f).split(path.sep).join('/');
  const db2 = files.filter((f) => /\.(sql|ddl)$/i.test(f) && /database/i.test(f)).map((f) => {
    const text = fs.readFileSync(f, 'utf8');
    const tables = [...new Set([...text.matchAll(/CREATE\s+TABLE\s+([A-Z0-9_.]+)/gi)].map((m) => m[1].toUpperCase()))];
    return { definition: relOf(f), sha256: sha(fs.readFileSync(f)), tables, used_by: programs.filter((p) => { const s = reader.byProgram(p.program); return !!s && s.pf.sql.some((q) => tables.some((t) => new RegExp(`\\b${t.split('.').pop()}\\b`, 'i').test(q.text))); }).map((p) => p.program), java: `NOT_GENERATED (SQL communication-area and status-code semantics unresolved; open decisions: ${[...snap.register.values()].filter((d) => d.blocking && /SQLCODE/.test(d.question)).map((d) => d.decision_id).join(', ') || 'none recorded'})` };
  });
  const jcl = files.filter((f) => /\.jcl$/i.test(f)).map((f) => {
    const text = fs.readFileSync(f, 'utf8');
    return { jcl: relOf(f), sha256: sha(fs.readFileSync(f)), steps: [...text.matchAll(/EXEC\s+PGM=([A-Z0-9#@$]+)/gi)].map((m) => m[1].toUpperCase()), launcher: 'NOT_GENERATED (scheduler, dataset and restart semantics are not converted)' };
  });

  // Business rules and gap groups.
  // STEP 17 reconciliation: a rule is judged on its own COBOL statement span (parser statement
  // boundaries), not on its paragraph. Status:
  //   IMPLEMENTED_VERIFIED       Java present, no gap in the span, executed by a passing source-derived scenario
  //                              (level-88 rules: the condition's SET/test check passed in the generated Java)
  //   IMPLEMENTED_EXERCISED      executed only on scenario paths that end at an expected gap later on
  //   IMPLEMENTED_NOT_EXERCISED  Java present, no gap in the span, no scenario reaches it
  //   BLOCKED                    a gap lies inside the rule's own statement span
  //   NOT_GENERATED              no Java for the rule's program or copybook
  const RESOLUTION: Record<string, string> = {
    EXTERNAL_SYSTEM_BOUNDARY: 'needs a DB2 or CICS runtime with validated semantics (not available; not resolvable from the source)',
    UNDECLARED_NAME: 'source defect: the name is declared nowhere in the authorised source (SQLCODE/EIB* come from the DB2/CICS precompilers)',
    UNDEFINED_PROCEDURE: 'source defect: the performed paragraph does not exist in the program',
    UNSUPPORTED_DATA: 'source defect: the item or file has no determinable layout (empty group, SELECT without FD)',
    COMPILER_OPTION_DEPENDENT: 'needs the legacy environment definition (non-standard ACCEPT FROM TIME STAMP, FUNCTION RANDOM)',
    UNTRANSLATED_STATEMENT: 'invalid COBOL as written, or a construct the converter does not translate',
    UNDEFINED_EXTERNAL_CALL: 'the called program is outside the application inventory',
    DATA_CONVERSION_UNDEFINED: 'needs a business decision for non-digit content',
  };
  const condRule = (r: any) => [...String(r.condition?.text ?? '').matchAll(/\b88\s+([A-Z0-9-]+)|\/\s*([A-Z0-9-]+)\s+'/g)].map((m) => m[1] ?? m[2]);
  const rules = [...snap.rules.entries()].map(([id, r]) => {
    const es = snap.ruleEntries.get(id) ?? [];
    const progId = r.primary_source?.program_id ?? null;
    const prog = programs.find((p) => p.program === progId);
    const line = r.primary_source?.line ?? null;
    const fileId = r.primary_source?.source_ids?.file_id ?? null;
    const cobolFile = fileId ? snap.ctx.relByFile.get(fileId) ?? null : null;
    const base = { rule: id, name: r.name, category: r.category, program: progId, cobol: cobolFile && line !== null ? `${cobolFile}:${line}` : null, dispositions: [...new Set(es.map((e) => e.disposition))], requirements: [...new Set(es.flatMap((e) => e.requirement_ids))] };
    const isCondition = /^\s*[A-Z0-9-]+\s+88\b/.test(String(r.condition?.text ?? '')) || /\b88\s+[A-Z0-9-]+/.test(String(r.condition?.text ?? ''));
    // Level-88 rules (declarations): verified when the generated condition check passed in some program.
    if (isCondition && (!prog || !line || !reader.byProgram(progId!)?.pf.statements.some((x) => x.line === line))) {
      const names = condRule(r);
      const hits = programs.filter((p) => (p.cond_checks ?? []).some((c: any) => names.includes(c.name) && c.status === 'PASS')).map((p) => p.program);
      const declared = programs.filter((p) => (p.cond_checks ?? []).some((c: any) => names.includes(c.name))).map((p) => p.program);
      return { ...base, kind: 'condition-declaration', tests: programs.flatMap((p) => (p.cond_checks ?? []).filter((c: any) => names.includes(c.name)).map((c: any) => ({ scenario: `${p.program}: C88 ${c.name}`, result: c.status, asserted: ['stored condition value', 'condition true'] }))), remaining_evidence: 'procedure-level use of the condition in a verified path; legacy execution results', java: hits.length ? `Cond88 ${names.join(', ')} in ${hits.join(', ')}` : null, status: hits.length ? 'IMPLEMENTED_VERIFIED' : declared.length ? 'BLOCKED' : 'NOT_GENERATED', evidence: hits.length ? `generated condition check (SET TO TRUE stores the declared value; the condition is then true) passed in ${hits.join(', ')}` : declared.length ? 'condition generated but its check failed' : 'no converted program declares these conditions', blockers: [], resolution: hits.length ? null : 'no converted program COPYs the declaring copybook' };
    }
    if (!prog?.source_map || line === null) return { ...base, kind: 'statement', java: null, status: 'NOT_GENERATED', evidence: prog ? `program ${progId}: ${prog.conversion_status}` : 'no converted program', blockers: [], resolution: prog?.blocked_by?.join('; ') ?? 'no program source' };
    // The rule line may be a statement, a clause inside one (WHEN, AT END ...) or a paragraph header.
    const facts = reader.byProgram(progId!)?.pf.statements ?? [];
    const para = prog.source_map.paragraphs.find((x: any) => x.cobol_file === cobolFile && x.cobol_lines[0] === line);
    const enclosing = facts.filter((x) => x.line <= line && x.end_line >= line).sort((a, b) => a.end_line - a.line - (b.end_line - b.line))[0];
    const startLine = para ? para.cobol_lines[0] : enclosing ? enclosing.line : line;
    const endLine = para ? para.cobol_lines[1] : enclosing ? enclosing.end_line : line;
    const inSpan: any[] = prog.source_map.statements.filter((x: any) => x.cobol_file === cobolFile && x.cobol_line >= startLine && x.cobol_line <= endLine);
    // A rule line that is no statement (a blank or continuation line): the nearest preceding statement.
    if (!inSpan.length) inSpan.push(...prog.source_map.statements.filter((x: any) => x.cobol_file === cobolFile && x.cobol_line <= line).sort((p: any, q: any) => q.cobol_line - p.cobol_line).slice(0, 1));
    const at = inSpan.sort((a: any, b: any) => a.cobol_line - b.cobol_line || a.java_line - b.java_line)[0];
    const gapIds = [...new Set(inSpan.map((x: any) => x.gap_id).filter(Boolean))] as string[];
    const blockers = gapIds.map((g) => prog.result_gaps.find((x: any) => x.gap_id === g)).filter(Boolean);
    const java = at ? `${at.java_file}:${at.java_line}` : null;
    if (!at) return { ...base, kind: 'statement', java: null, status: 'NOT_GENERATED', evidence: `line ${line} is not a mapped statement of ${progId}`, blockers: [], resolution: 'the rule line is not a procedure statement of the program' };
    if (blockers.length) return { ...base, kind: 'statement', span: [startLine, endLine], java, status: 'BLOCKED', evidence: `${blockers.length} gap(s) inside the rule's statement span`, blockers, resolution: [...new Set(blockers.map((b: any) => RESOLUTION[b.kind] ?? b.kind))].join('; ') };
    const cov = prog.coverage;
    const covLine = at.cobol_line;
    // Tests that executed the rule's statement (scenario id, its result, and the state it asserted).
    const tests = (cov?.scenarios ?? []).filter((x: any) => x.lines.includes(covLine)).map((x: any) => ({ scenario: x.id, result: x.status, asserted: x.asserted }));
    const passed = tests.filter((x: any) => x.result === 'PASS');
    const toGap = tests.filter((x: any) => x.result === 'BLOCKED_AS_EXPECTED' && x.asserted.length);
    const status = passed.length ? 'IMPLEMENTED_VERIFIED' : toGap.length ? 'IMPLEMENTED_VERIFIED_TO_GAP' : tests.length ? 'IMPLEMENTED_EXERCISED' : 'IMPLEMENTED_NOT_EXERCISED';
    const evidence =
      status === 'IMPLEMENTED_VERIFIED'
        ? `executed by ${passed.length} passing source-derived scenario(s)`
        : status === 'IMPLEMENTED_VERIFIED_TO_GAP'
          ? `executed by ${toGap.length} scenario(s) whose asserted state matched the source; their paths then end at an expected gap`
          : status === 'IMPLEMENTED_EXERCISED'
            ? 'executed only on paths that end at an expected gap, with no state asserted'
            : 'translated; no source-derived scenario reaches this statement';
    const remaining =
      status === 'IMPLEMENTED_VERIFIED'
        ? 'legacy execution results (COBOL runtime equivalence)'
        : status === 'IMPLEMENTED_VERIFIED_TO_GAP'
          ? 'resolution of the downstream gap, then an end-to-end scenario; legacy execution results'
          : 'a scenario asserting the rule outcome; legacy execution results';
    return { ...base, kind: 'statement', span: [startLine, endLine], java, status, evidence, tests, remaining_evidence: remaining, blockers: [], resolution: null };
  });
  const gapGroups = { total: snap.gaps.length, by_severity: Object.fromEntries([...new Set(snap.gaps.map((g: any) => g.severity))].map((s) => [s, snap.gaps.filter((g: any) => g.severity === s).length])) };

  // The source map was only needed to map rules to Java; it is in the generation output.
  for (const p of programs) {
    delete p.source_map;
    delete p.result_gaps;
    delete p.cond_checks;
  }
  // STEP 17: the integrated application (forward/generated/java/app) and its test results.
  const intFile = path.join(ctx.forwardDir, 'generated', 'java', 'app', 'integration-result.json');
  const integration = fs.existsSync(intFile) ? (() => {
    const r = JSON.parse(fs.readFileSync(intFile, 'utf8'));
    return { programs: r.programs.length, excluded: r.excluded, java_files: r.files, compilation: r.compilation?.status, jobs: r.jobs.map((j: any) => ({ name: j.name, steps: j.steps.map((s: any) => `${s.pgm}${s.converted ? '' : ' (not converted)'}`) })), tests: r.tests ? { runtime_unit: r.tests.runtime_unit.counts, program_tests: r.tests.program_tests.counts, scenarios: r.tests.program_tests.scenario_counts, integration: r.tests.integration.counts } : null };
  })() : null;
  const count = (st: string) => programs.filter((p) => p.conversion_status === st).length;
  return {
    contract: 'pilot/application-status',
    generated_at: snap.at.toISOString(),
    baseline: { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 },
    authorisation: auth,
    counts: {
      programs: programs.length,
      attempted: programs.length,
      locally_authorised: programs.filter((p) => p.local_authorization?.ok).length,
      java_generated: programs.filter((p) => p.java_files.length).length,
      compiled: programs.filter((p) => p.compilation === 'COMPILED').length,
      tested: programs.filter((p) => p.tests !== 'NOT_RUN').length,
      COMPLETE: count('COMPLETE'),
      PARTIAL: count('PARTIAL'),
      FAILED: count('FAILED'),
      BLOCKED: count('BLOCKED'),
      NOT_ATTEMPTED: count('NOT_ATTEMPTED'),
      source_readiness_pass: programs.filter((p) => p.source_readiness.status === 'PASS').length,
      converter_ready: programs.filter((p) => p.converter.ready).length,
      converter_parse_supported: programs.filter((p) => p.converter.parse === 'SUPPORTED').length,
    },
    // Converter backlog: how many programs contain each construct family the converter does not yet translate.
    construct_backlog: Object.keys(CONSTRUCTS)
      .map((k) => ({ construct: k, programs: programs.filter((p) => p.constructs?.[k]).map((p) => p.program) }))
      .filter((x) => x.programs.length)
      .sort((a, b) => b.programs.length - a.programs.length),
    programs,
    copybooks,
    db2,
    jcl,
    rules: { total: rules.length, by_status: Object.fromEntries(['IMPLEMENTED_VERIFIED', 'IMPLEMENTED_VERIFIED_TO_GAP', 'IMPLEMENTED_EXERCISED', 'IMPLEMENTED_NOT_EXERCISED', 'BLOCKED', 'NOT_GENERATED'].map((k) => [k, rules.filter((r) => r.status === k).length])), implemented: rules.filter((r) => r.status.startsWith('IMPLEMENTED')).length, blocked_by_gap: rules.filter((r) => r.status === 'BLOCKED').length, by_disposition: Object.fromEntries([...new Set(rules.flatMap((r) => r.dispositions.length ? r.dispositions : ['none']))].map((d) => [d, rules.filter((r) => (r.dispositions.length ? r.dispositions : ['none']).includes(d)).length])), list: rules },
    gap_groups: gapGroups,
    integration,
    database: { definitions: db2.length, sql_operations_implemented: 0, sql_boundaries: programs.reduce((n, p) => n + (p.generation?.sql_boundaries ?? 0), 0), cics_boundaries: programs.reduce((n, p) => n + (p.generation?.cics_boundaries ?? 0), 0) },
  };
}

/** Plain-English Markdown for APPLICATION-MODERNIZATION-STATUS.md. */
export function renderApplicationStatus(s: any): string {
  const L: string[] = [];
  const c = s.counts;
  L.push('# Application modernization status', '');
  L.push(`Generated ${s.generated_at} from run \`${s.baseline.run_id}\` (baseline \`${s.baseline.manifest_sha256.slice(0, 12)}…\`).`, '');
  L.push(`**Workflow (F5) Java generation authorised: ${s.authorisation.generation_authorized ? 'yes' : 'NO'}**${s.authorisation.blockers.length ? `. Blockers: ${s.authorisation.blockers.join('; ')}.` : ''}`, '');
  L.push(`**Program-scoped local generation authorised (policy program_scoped_local_v1): ${c.locally_authorised} program(s)** (${s.programs.filter((p: any) => p.local_authorization?.ok).map((p: any) => `${p.program} under ${p.local_authorization.record_id}`).join(', ') || 'none'}). Every other program stays blocked.`, '');
  L.push('No source analysis or architecture preparation is counted as a converted program below.', '');
  L.push('## Program counts', '');
  L.push('| Measure | Count |', '|---|---|');
  for (const [k, v] of [['Programs in inventory', c.programs], ['Programs attempted (analysed)', c.attempted], ['Programs locally authorised', c.locally_authorised], ['Programs with Java generated', c.java_generated], ['Programs compiled', c.compiled], ['Programs tested', c.tested], ['COMPLETE', c.COMPLETE], ['PARTIAL', c.PARTIAL], ['FAILED', c.FAILED], ['BLOCKED', c.BLOCKED], ['NOT_ATTEMPTED', c.NOT_ATTEMPTED], ['SOURCE_READINESS PASS', c.source_readiness_pass], ['Parsed completely by the local converter', c.converter_parse_supported], ['Converter-ready (parse + pre-emission checks)', c.converter_ready]]) L.push(`| ${k} | ${v} |`);
  L.push('', '## Programs', '');
  L.push('| Program | Source | SHA-256 | Copybooks | Rules | SOURCE_READINESS | STEP 15 subset parser | Generation authorised | Java files | Compiled | Tests | Status | Blocked by / outstanding |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const p of s.programs) {
    const conv = p.converter.parse === 'SUPPORTED' ? `supported${p.converter.gaps.length ? `, ${p.converter.gaps.length} gap(s)` : ''}${p.converter.pre_emission_findings.length ? `; ${p.converter.pre_emission_findings.join('; ')}` : ''}` : p.converter.parse === 'UNSUPPORTED' ? `unsupported: ${p.converter.construct} (line ${p.converter.line})` : p.converter.parse;
    L.push(`| ${p.program} | ${p.source_available ? 'yes' : 'no'} | \`${p.source_sha256 ? p.source_sha256.slice(0, 12) + '…' : '-'}\` | ${p.includes.join(', ') || '-'} | ${p.rules.length} | ${p.source_readiness.status}${p.source_readiness.status === 'FAIL' ? ` (${p.source_readiness.failing.map((f: string) => f.split(':')[0]).join(', ')})` : ''} | ${conv.replace(/\|/g, '/')} | ${p.generation_authorized ? `yes (${p.local_authorization?.ok ? p.local_authorization.record_id : 'workflow'})` : 'no'} | ${p.java_files.length} | ${p.compilation === 'NOT_RUN' ? 'not run' : p.compilation} | ${p.tests === 'NOT_RUN' ? 'not run' : p.tests} | **${p.conversion_status}** | ${p.blocked_by.join('; ').replace(/\|/g, '/')} |`);
  }
  if (s.integration) {
    const i = s.integration;
    L.push('', '## Integrated Java application', '');
    L.push(`\`forward/generated/java/app/\`: ${i.programs} programs, ${i.java_files} Java files, compilation **${i.compilation}**. Excluded: ${i.excluded.map((x: any) => `${x.program} (${x.reason})`).join('; ') || 'none'}.`, '');
    if (i.tests) {
      L.push('| Test layer | Passed | Blocked as expected | Failed | Total |', '|---|---|---|---|---|');
      for (const [k, v] of [['Runtime unit tests', i.tests.runtime_unit], ['Program checks (VALUE, gap probes, scenarios)', i.tests.program_tests], ['  of which source-derived scenarios', i.tests.scenarios], ['Integration tests (CALLs, JCL jobs)', i.tests.integration]] as Array<[string, any]>) L.push(`| ${k} | ${v.PASS} | ${v.BLOCKED_AS_EXPECTED} | ${v.FAIL} | ${v.total} |`);
    }
    L.push('', `JCL jobs converted to job definitions: ${i.jobs.length} (${i.jobs.map((j: any) => `${j.name}: ${j.steps.join(', ')}`).join('; ')}).`);
    L.push('', `Database: ${s.database.sql_operations_implemented} SQL operations implemented against DB2; ${s.database.sql_boundaries} executable EXEC SQL and ${s.database.cics_boundaries} EXEC CICS statements are explicit boundaries (no DB2 or CICS available; no SQLCODE or response is invented).`);
  }
  L.push('', '## Construct families in the source (STEP 15 inventory; translated by the STEP 17 converter unless listed as gaps)', '', '| Construct family | Programs | Which |', '|---|---|---|');
  for (const b of s.construct_backlog) L.push(`| ${b.construct} | ${b.programs.length} | ${b.programs.join(', ')} |`);
  L.push('', '## Copybooks', '', '| Copybook | Path | Used by | Data records (F2) | Java model |', '|---|---|---|---|---|');
  for (const x of s.copybooks) L.push(`| ${x.copybook} | ${x.path ?? '-'} | ${x.used_by.join(', ') || '-'} | ${x.data_records} | ${x.java_model} |`);
  L.push('', '## DB2 definitions', '', '| Definition | Tables | Used by (embedded SQL) | Java |', '|---|---|---|---|');
  for (const x of s.db2) L.push(`| ${x.definition} | ${x.tables.join(', ') || '-'} | ${x.used_by.join(', ') || '-'} | ${x.java} |`);
  L.push('', '## JCL', '', '| JCL | Programs executed | Launcher |', '|---|---|---|');
  for (const x of s.jcl) L.push(`| ${x.jcl} | ${x.steps.join(', ') || '-'} | ${x.launcher} |`);
  L.push('', '## Business rules', '');
  L.push(`${s.rules.total} canonical rules, judged on each rule's own statement span: ${Object.entries(s.rules.by_status).map(([k, v]) => `${k} ${v}`).join(', ')} (equivalence with the legacy system unverified). By F1 disposition: ${Object.entries(s.rules.by_disposition).map(([k, v]) => `${k} ${v}`).join(', ')}. Per-rule program, line, requirements and status are in the JSON (\`rules.list\`).`, '');
  L.push('## Gap groups', '');
  L.push(`${s.gap_groups.total} reverse-engineering gap groups (${Object.entries(s.gap_groups.by_severity).map(([k, v]) => `${k} ${v}`).join(', ')}); none is resolved by this step.`, '');
  return L.join('\n') + '\n';
}
