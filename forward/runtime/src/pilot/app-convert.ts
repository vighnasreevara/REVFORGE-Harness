/**
 * Authorised full-application conversion of one program (STEP 17).
 *
 * The same guarded path as STEP 16 (checkLocalAuthorization for exactly this
 * program and output directory; COPY members only from the record's
 * hash-bound copybooks; hashes re-checked afterwards; the operation sealed in
 * the audit log), with the full-application front and back end of the local
 * converter. The result uses the pilot/pilot-result contract and the
 * evidence manifest, so CONVERSION_VALIDATION judges it like any conversion.
 *
 * Tests (run with the generated Java, results parsed from CASE lines):
 *   INIT    VALUE clauses: storage after construction equals the VALUE encoded
 *           by the converter's own (TypeScript) encoder, not by the runtime
 *   PROBE   every gap's Java site throws UnresolvedGapException with its ID
 *   S..     source-derived scenarios from forward/pilot/app-fixtures/<PROGRAM>.json
 * A program is COMPLETE only without gaps and with at least one passing
 * source-derived scenario; otherwise PARTIAL (or FAILED on any failure).
 */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { mutate, Workflow } from '../orchestrator/orchestrator';
import { checkLocalAuthorization } from './authorization';
import { AppProgram, parseApp, ParseError, walkStmts } from './cobol-app';
import { AppEmitted, emitApp } from './java-app';
import { detectToolchain, finish, PilotRefused, Toolchain } from './pilot';

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
export const RUNTIME_DIR = (forwardDir: string) => path.join(forwardDir, 'runtime', 'java');

export function listJava(d: string): string[] {
  return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listJava(path.join(d, e.name)) : e.name.endsWith('.java') ? [path.join(d, e.name)] : [])) : [];
}

export interface AppConvertOptions {
  program: string;
  out: string;
  available: Set<string>;
  toolchain?: Toolchain;
  at?: Date;
}

export function convertAppProgram(wf: Workflow, ctx: RuntimeContext, o: AppConvertOptions): any {
  const out = path.resolve(o.out);
  const auth = checkLocalAuthorization(wf, ctx, o.program, out, o.at);
  if (!auth.ok) throw new PilotRefused(`local generation of ${o.program} is not authorised: ${auth.checks.filter((c) => !c.ok).map((c) => `${c.id} (${c.detail})`).join('; ')}`);
  const a = auth.authorization;
  const root = ctx.sourceRoot!;
  const tc = o.toolchain ?? detectToolchain();
  const copy = new Map<string, { path: string; rel: string }>(a.copybooks.map((c: any) => [path.basename(c.path).replace(/\.[^.]+$/, '').toUpperCase(), { path: path.join(root, c.path), rel: c.path }]));
  const resolve = (m: string) => {
    const c = copy.get(m.toUpperCase());
    return c ? { path: c.path, rel: c.rel, text: fs.readFileSync(c.path, 'utf8') } : null;
  };
  const fixtureFile = path.join(ctx.forwardDir, 'pilot', 'app-fixtures', `${o.program}.json`);
  const runtimeFiles = listJava(RUNTIME_DIR(ctx.forwardDir)).sort();
  const inputs = [
    { path: a.source.path, sha256: a.source.sha256 },
    ...a.copybooks.map((c: any) => ({ path: c.path, sha256: c.sha256 })),
    ...(fs.existsSync(fixtureFile) ? [{ path: path.relative(ctx.repoRoot, fixtureFile).split(path.sep).join('/'), sha256: sha(fs.readFileSync(fixtureFile)) }] : []),
    ...runtimeFiles.map((f) => ({ path: path.relative(ctx.repoRoot, f).split(path.sep).join('/'), sha256: sha(fs.readFileSync(f)) })),
  ];
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const result: any = {
    contract: 'pilot/pilot-result',
    contract_version: '1.0',
    synthetic: false,
    statement: `Authorised local deterministic generation under ${a.record_id} (${a.policy}); full-application converter (STEP 17); not an F5 agent generation and not a G2-G4 approval.`,
    generated_at: new Date().toISOString(),
    inputs,
    stages: ['inspection', 'generation', 'compilation', 'execution', 'cobol_reference', 'trace_audit', 'evidence'],
    isolation: { output_dir: out, workflow_used: true, approvals_used: false, production_generation: false, external_ai_calls: false, authorization_record: a.record_id },
    toolchain: tc,
    authorization: { record_id: a.record_id, policy: a.policy, program: a.program, source_sha256: a.source.sha256, output_dir: a.output_dir, accepted_by: a.accepted_by, accepted_at: a.accepted_at, valid_until: a.valid_until, checks: auth.checks },
  };
  const seal = (r: any) => {
    const after = checkLocalAuthorization(wf, ctx, o.program, out, o.at);
    if (!after.ok) throw new PilotRefused(`the authorised inputs changed during generation: ${after.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`);
    mutate(wf, 'local generation performed', () => {
      wf.store.append('local_generation_performed', { record_id: a.record_id, program: o.program, output_dir: a.output_dir, source_sha256: a.source.sha256, converter: 'full-application (STEP 17)', conversion_status: r.conversion_status, compilation: r.compilation?.status ?? 'NOT_RUN', execution: r.execution?.counts ?? null, gaps: (r.gaps ?? []).length, evidence_manifest_sha256: r.evidence?.manifest_sha256 ?? null });
      wf.store.writeState(wf.state);
    });
    return r;
  };

  // 1. Inspection.
  let prog: AppProgram;
  try {
    prog = parseApp(path.join(root, a.source.path), a.source.path, resolve);
  } catch (e) {
    if (!(e instanceof ParseError)) throw e;
    return seal(finish(out, { ...result, conversion_status: 'FAILED', conversion_status_reason: `the source cannot be converted: ${e.message}`, failure: { stage: 'inspection', construct: e.message }, gaps: [] }));
  }
  const srcText = new Map<string, string[]>();
  const lineText = (file: string, line: number) => {
    if (!srcText.has(file)) {
      const abs = file === a.source.path ? path.join(root, a.source.path) : path.join(root, file);
      srcText.set(file, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n').split('\n') : []);
    }
    return (srcText.get(file)![line - 1] ?? '').replace(/\s+$/, '');
  };
  result.inspection = {
    program_id: prog.program_id,
    sha256: prog.sha256,
    paragraphs: prog.paragraphs.map((p) => ({ name: p.name, lines: [p.origin.line, p.end.line] })),
    sections: prog.sections,
    records: prog.data.records.map((r) => ({ name: r.name, section: r.section, fd: r.fd, size: r.size, origin: r.origin })),
    files: prog.data.files.map((f) => ({ name: f.name, assign: f.assign, organization: f.organization, access: f.access })),
    includes: prog.includes.map((i) => ({ name: i.name, resolved: i.resolved, path: i.path, origin: i.origin })),
    using: prog.using,
    declaratives: prog.declaratives,
  };

  // 2. Generation.
  const em: AppEmitted = emitApp(prog, { available: o.available, lineText });
  const srcDir = path.join(out, 'java', 'src');
  for (const [rel, text] of Object.entries(em.files)) {
    const f = path.join(srcDir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  fs.writeFileSync(path.join(out, 'source-map.json'), JSON.stringify(em.source_map, null, 2));
  result.gaps = em.gaps.map(({ conditional, ...g }) => ({ ...g, conditional }));
  result.generation = { package: em.pkg, class: em.cls, files: Object.keys(em.files).sort().map((rel) => ({ path: `java/src/${rel}`, sha256: sha(em.files[rel]), lines: em.files[rel].split('\n').length - 1 })), copybook_models: em.models, source_map: 'source-map.json', notes: em.notes, stats: em.stats };
  result.gap_trace = em.gaps.map((g) => ({ gap_id: g.gap_id, kind: g.kind, subject: g.subject, cobol: `${g.origin.file}:${g.origin.line}`, java: em.source_map.gaps.find((x: any) => x.gap_id === g.gap_id) ?? null, conditional: g.conditional }));

  // 3. Compilation (with the runtime).
  if (!tc.java.available) {
    result.compilation = { status: 'JAVA_TOOLCHAIN_UNAVAILABLE' };
    result.execution = { status: 'NOT_RUN', reason: 'no Java toolchain' };
    result.conversion_status = 'NOT_EXECUTED';
  } else {
    const classes = path.join(out, 'java', 'classes');
    fs.mkdirSync(classes, { recursive: true });
    const javaFiles = [...runtimeFiles, ...Object.keys(em.files).map((rel) => path.join(srcDir, rel))];
    const argFile = path.join(out, 'java', 'javac-args.txt');
    fs.writeFileSync(argFile, javaFiles.map((f) => `"${f.replace(/\\/g, '/')}"`).join('\n'));
    const cc = spawnSync(tc.java.javac!, ['-encoding', 'UTF-8', '-Xlint:all', '-Werror', '-d', classes, `@${argFile}`], { encoding: 'utf8', timeout: 600000 });
    fs.rmSync(argFile, { force: true });
    result.compilation = { status: cc.status === 0 ? 'COMPILED' : 'COMPILATION_FAILED', javac: tc.java.version, command: `javac -encoding UTF-8 -Xlint:all -Werror -d java/classes <runtime ${runtimeFiles.length} + generated ${Object.keys(em.files).length} files>`, exit_code: cc.status, diagnostics: `${cc.stdout}${cc.stderr}`.trim().split(/\r?\n/).filter(Boolean).slice(0, 40) };
    // 4. Tests.
    if (cc.status === 0) {
      const x = spawnSync(tc.java.java!, ['-cp', classes, 'revforge.cobol.testing.TestMain', `${em.pkg}.${em.cls}`, fs.existsSync(fixtureFile) ? fixtureFile : '-'], { encoding: 'latin1', timeout: 600000 });
      const cases = x.stdout
        .split(/\r?\n/)
        .filter((l) => l.startsWith('CASE|'))
        .map((l) => {
          const [, id, status, gap, detail] = l.split('|');
          return { id, status, gap_id: gap === '-' ? null : gap, detail: detail || undefined, kind: id.startsWith('INIT') ? 'init' : id.startsWith('C88 ') ? 'condition_check' : id.startsWith('PROBE') ? 'gap_probe' : id.startsWith('TESTS') ? 'harness' : 'scenario' };
        });
      const tally = { PASS: cases.filter((c) => c.status === 'PASS').length, BLOCKED_AS_EXPECTED: cases.filter((c) => c.status === 'BLOCKED_AS_EXPECTED').length, FAIL: cases.filter((c) => c.status === 'FAIL').length, total: cases.length };
      result.execution = { status: x.status === 0 && /SUMMARY\|/.test(x.stdout) ? 'EXECUTED' : 'EXECUTION_FAILED', exit_code: x.status, stderr: x.stderr.trim().split(/\r?\n/).filter(Boolean).slice(0, 20), cases, counts: tally };
      // Statement coverage: COVER|scenario|OK or FAIL|PROGRAM:line,...;PROGRAM:line,...
      const status = new Map(cases.map((c) => [c.id, c.status]));
      const passing = new Set<number>();
      const blockedPaths = new Set<number>();
      const perScenario: Array<{ id: string; status: string; lines: number[]; asserted: string[] }> = [];
      for (const l of x.stdout.split(/\r?\n/).filter((y) => y.startsWith('COVER|'))) {
        const [, id, ok, spec, assertedText] = l.split('|');
        if (ok !== 'OK') continue;
        const mine = (spec ?? '').split(';').filter(Boolean).map((part) => part.split(':')).find(([pg]) => pg === (result.inspection?.program_id ?? ''));
        perScenario.push({ id, status: status.get(id) ?? 'UNKNOWN', lines: (mine?.[1] ?? '').split(',').filter(Boolean).map(Number), asserted: (assertedText ?? '').split(',').filter(Boolean) });
        for (const part of (spec ?? '').split(';').filter(Boolean)) {
          const [prog, lines] = part.split(':');
          if (prog !== prog.toUpperCase() || prog !== (result.inspection?.program_id ?? prog)) continue;
          for (const n of (lines ?? '').split(',').filter(Boolean)) (status.get(id) === 'PASS' ? passing : blockedPaths).add(Number(n));
        }
      }
      const programLines = new Set<number>();
      prog.paragraphs.forEach((q) => q.sentences.forEach((ss) => walkStmts(ss, (s) => s.origin.file === a.source.path && programLines.add(s.origin.line))));
      result.coverage = {
        statement_lines: programLines.size,
        executed_in_passing_scenarios: [...passing].filter((n) => programLines.has(n)).sort((m, n) => m - n),
        executed_only_in_blocked_scenarios: [...blockedPaths].filter((n) => programLines.has(n) && !passing.has(n)).sort((m, n) => m - n),
        scenarios: perScenario,
        note: 'Lines of COBOL statements executed by source-derived scenarios whose expectations all matched (PASS), and lines reached only on paths that end at an expected gap.',
      };
      const sc = cases.filter((c) => c.kind === 'scenario');
      result.behaviour_cases = { scenarios: sc.length, passed: sc.filter((c) => c.status === 'PASS').length, blocked_as_expected: sc.filter((c) => c.status === 'BLOCKED_AS_EXPECTED').length, failed: sc.filter((c) => c.status === 'FAIL').length, fixtures: fs.existsSync(fixtureFile) ? path.relative(ctx.repoRoot, fixtureFile).split(path.sep).join('/') : null };
    } else result.execution = { status: 'NOT_RUN', reason: 'compilation failed' };
  }
  result.cobol_reference = tc.cobol.available ? { status: 'NOT_CAPTURED', detail: 'a COBOL compiler is available but no legacy run of this program was captured' } : { status: 'COBOL_COMPILER_UNAVAILABLE', detail: 'no COBOL compiler: the legacy program was not executed and no reference outputs exist' };
  result.validation = { kind: 'FIXTURE_BASED', fixtures_provenance: 'INIT checks from VALUE clauses, gap probes, and scenarios written from the COBOL source by the converter author (same session; not an independent human review)', statement: 'Java outputs were compared only with source-derived expectations. This is fixture-based validation, NOT runtime COBOL/Java equivalence.' };
  result.equivalence = 'EQUIVALENCE_UNVERIFIED';
  // 5. Trace audit.
  const all: string[] = [];
  prog.paragraphs.forEach((p) => p.sentences.forEach((ss) => walkStmts(ss, (s) => all.push(`${s.origin.file}:${s.origin.line}:${s.kind}`))));
  const mappedKeys = new Set(em.source_map.statements.map((m) => `${m.cobol_file}:${m.cobol_line}:${m.kind}`));
  const unmapped = all.filter((k) => !mappedKeys.has(k));
  const findings: string[] = [];
  if (unmapped.length) findings.push(`COBOL statements without a Java mapping: ${[...new Set(unmapped)].slice(0, 20).join(', ')}`);
  for (const g of em.gaps) {
    const t = em.source_map.gaps.find((x: any) => x.gap_id === g.gap_id);
    if (!t || !t.call_sites.length) findings.push(`${g.gap_id} has no Java call site`);
    if (!(result.execution?.cases ?? []).some((c: any) => c.gap_id === g.gap_id && c.status === 'BLOCKED_AS_EXPECTED')) findings.push(`${g.gap_id}: no executed probe demonstrates that its path stays blocked`);
  }
  const counts = result.execution?.counts;
  const behaviourVerified = (result.behaviour_cases?.passed ?? 0) > 0;
  result.behaviour_verified = behaviourVerified;
  if (!result.conversion_status) result.conversion_status = result.compilation?.status !== 'COMPILED' || result.execution?.status !== 'EXECUTED' || counts?.FAIL ? 'FAILED' : em.gaps.length || !behaviourVerified ? 'PARTIAL' : 'COMPLETE';
  result.conversion_status_reason =
    result.conversion_status === 'COMPLETE'
      ? 'every statement translated without gaps, compiled, and source-derived scenarios passed'
      : result.conversion_status === 'PARTIAL'
        ? em.gaps.length
          ? `the Java compiles and every executed check passes, but ${em.gaps.length} gap(s) stay open and their paths are blocked`
          : 'no gaps, but no source-derived scenario has demonstrated the behaviour yet'
        : result.conversion_status === 'FAILED'
          ? result.compilation?.status !== 'COMPILED'
            ? 'the generated Java does not compile'
            : `${counts?.FAIL ?? '?'} check(s) failed`
          : 'not executed';
  result.trace_audit = { statements: all.length, mapped_statements: all.length - unmapped.length, gaps_traced: em.gaps.length, passing_cases: counts?.PASS ?? 0, findings, verdict: findings.length ? 'FINDINGS' : 'NO_FINDINGS', notes: em.notes };
  return seal(finish(out, result));
}
