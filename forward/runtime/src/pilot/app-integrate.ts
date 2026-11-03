/**
 * Integrated Java application (STEP 17): assembles every authorised, compiled
 * program conversion into one plain Java 21 project at the authorised
 * integration directory (forward/generated/java/app/), with
 *   the runtime (forward/runtime/java), the converted programs, the shared
 *   copybook models (one class per layout; identical content required),
 *   revforge.app.Programs   the program registry (CALL resolves to converted programs)
 *   revforge.app.batch.Jobs the JCL jobs converted to job definitions
 *   revforge.app.Main       command line: run a job or a program
 * compiles it (javac -Xlint:all -Werror) and runs, in this order: the runtime
 * unit tests, every program's tests in isolation, and the integration tests
 * (forward/pilot/app-fixtures/integration/*.json: CALLs across programs, jobs).
 *
 * Guards: the consolidated scope manifest hash, every included program's
 * authorisation (exact program, hashes, output directory), the JCL hashes and
 * the integration directory named in the manifest. Programs that are not
 * authorised or did not compile are left out and reported.
 */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { mutate, Workflow } from '../orchestrator/orchestrator';
import { authorizationRecords, checkLocalAuthorization, integrationScope } from './authorization';
import { listJava, RUNTIME_DIR } from './app-convert';
import { classOf, packageOf } from './java-app';
import { detectToolchain, PilotRefused, Toolchain } from './pilot';

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const jstr = (s: string) => JSON.stringify(s);

export interface JclJob {
  name: string;
  source: string;
  steps: Array<{ name: string; pgm: string; parm: string | null; cond: string | null; dds: Array<{ name: string; dsn: string | null; sysout: boolean; dummy: boolean; instream: boolean }> }>;
  notes: string[];
}

/** JCL: JOB, EXEC PGM= (PARM, COND), DD (DSN, SYSOUT, DUMMY, in-stream *), continuation after a trailing comma. */
export function parseJcl(text: string, source: string): JclJob {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const stmts: Array<{ name: string; op: string; operands: string }> = [];
  let instream = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].slice(0, 72);
    if (instream) {
      if (/^\/\*/.test(l) || /^\/\/ /.test(l) || /^\/\/[A-Z0-9#@$]/.test(l)) instream = false;
      else continue;
      if (/^\/\*/.test(l)) continue;
    }
    if (!/^\/\//.test(l) || /^\/\/\*/.test(l)) continue;
    const m = /^\/\/([A-Z0-9#@$.]*)\s+(\S+)\s*(.*)$/.exec(l);
    if (!m) continue;
    let operands = m[3].replace(/\s.*$/, '');
    while (/,$/.test(operands) && i + 1 < lines.length && /^\/\/\s+\S/.test(lines[i + 1])) {
      i++;
      operands += lines[i].slice(0, 72).replace(/^\/\/\s+/, '').replace(/\s.*$/, '');
    }
    stmts.push({ name: m[1], op: m[2], operands });
    if (m[2] === 'DD' && /^(\*|DATA)(?![A-Z0-9#@$-])/.test(operands)) instream = true;
  }
  const job: JclJob = { name: '', source, steps: [], notes: [] };
  const param = (ops: string, key: string) => {
    const re = new RegExp(`(?:^|,)${key}=(\\([^)]*\\)|'[^']*'|[^,]+)`);
    const m = re.exec(ops);
    return m ? m[1].replace(/^'|'$/g, '') : null;
  };
  for (const s of stmts) {
    if (s.op === 'JOB') job.name = s.name;
    else if (s.op === 'EXEC') {
      const pgm = param(s.operands, 'PGM') ?? (/^([A-Z0-9#@$]+)/.exec(s.operands)?.[1] ? `PROC:${/^([A-Z0-9#@$]+)/.exec(s.operands)![1]}` : 'UNKNOWN');
      job.steps.push({ name: s.name || `STEP${job.steps.length + 1}`, pgm, parm: param(s.operands, 'PARM'), cond: param(s.operands, 'COND'), dds: [] });
    } else if (s.op === 'DD') {
      const step = job.steps[job.steps.length - 1];
      if (!step) continue;
      if (!s.name) {
        job.notes.push(`${step.name}: DD concatenation is not represented (first data set used)`);
        continue;
      }
      step.dds.push({ name: s.name, dsn: param(s.operands, 'DSN') ?? param(s.operands, 'DSNAME'), sysout: /(?:^|,)SYSOUT=/.test(s.operands), dummy: /^DUMMY\b/.test(s.operands), instream: /^(\*|DATA)(?![A-Z0-9#@$-])/.test(s.operands) });
    }
  }
  if (!job.name) job.name = path.basename(source).replace(/\.[^.]+$/, '').toUpperCase();
  return job;
}

function copyTree(from: string, to: string, onFile: (rel: string, data: Buffer) => void) {
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const p = path.join(from, e.name);
    if (e.isDirectory()) copyTree(p, path.join(to, e.name), onFile);
    else onFile(path.join(to, e.name), fs.readFileSync(p));
  }
}

export function integrateApp(wf: Workflow, ctx: RuntimeContext, o: { toolchain?: Toolchain; at?: Date } = {}): any {
  const tc = o.toolchain ?? detectToolchain();
  const recs = authorizationRecords(wf);
  const scope = integrationScope(wf, ctx);
  if (!scope.ok) throw new PilotRefused(`the integrated build is not authorised: ${scope.detail}`);
  const withManifest = { scope_manifest: scope.scope_manifest! };
  const manifest = scope.manifest;
  const appDir = path.resolve(ctx.repoRoot, manifest.integration_dir);
  if (path.relative(path.join(ctx.forwardDir, 'generated', 'java'), appDir).split(path.sep).join('/') !== 'app') throw new PilotRefused(`integration directory ${manifest.integration_dir} is not the authorised one`);
  const root = ctx.sourceRoot!;
  // Programs: authorised, converted and compiled.
  const included: Array<{ program: string; pkg: string; cls: string; dir: string; fixtures: string | null }> = [];
  const excluded: Array<{ program: string; reason: string }> = [];
  for (const program of [...new Set(recs.map((r: any) => r.program as string))]) {
    const dir = path.join(ctx.forwardDir, 'generated', 'java', program);
    const a = checkLocalAuthorization(wf, ctx, program, dir, o.at);
    if (!a.ok) {
      excluded.push({ program, reason: `not authorised: ${a.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}` });
      continue;
    }
    const rf = path.join(dir, 'pilot-result.json');
    const r = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : null;
    if (!r || r.compilation?.status !== 'COMPILED' || !r.generation) {
      excluded.push({ program, reason: r ? `conversion ${r.conversion_status}: ${r.conversion_status_reason ?? r.failure?.construct ?? ''}` : 'not converted' });
      continue;
    }
    const fx = path.join(ctx.forwardDir, 'pilot', 'app-fixtures', `${program}.json`);
    included.push({ program, pkg: r.generation.package, cls: r.generation.class, dir, fixtures: fs.existsSync(fx) ? fx : null });
  }
  // JCL (hash-checked against the manifest).
  const jobs: JclJob[] = [];
  for (const j of manifest.jcl as Array<{ path: string; sha256: string }>) {
    const abs = path.join(root, j.path);
    if (!fs.existsSync(abs) || sha(fs.readFileSync(abs)) !== j.sha256) throw new PilotRefused(`JCL ${j.path} changed or is missing; the integrated build is not authorised`);
    jobs.push(parseJcl(fs.readFileSync(abs, 'utf8'), j.path));
  }
  // Assemble.
  fs.rmSync(appDir, { recursive: true, force: true });
  const src = path.join(appDir, 'src');
  const written = new Map<string, string>();
  const conflicts: string[] = [];
  const put = (abs: string, data: Buffer | string) => {
    const rel = path.relative(src, abs).split(path.sep).join('/');
    const h = sha(data);
    if (written.has(rel)) {
      if (written.get(rel) !== h) conflicts.push(rel);
      return;
    }
    written.set(rel, h);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, data);
  };
  copyTree(RUNTIME_DIR(ctx.forwardDir), src, put);
  for (const p of included) copyTree(path.join(p.dir, 'java', 'src'), src, put);
  if (conflicts.length) throw new PilotRefused(`shared copybook models differ between programs: ${conflicts.join(', ')}`);
  const gen = (rel: string, lines: string[]) => put(path.join(src, rel), lines.join('\n') + '\n');
  gen('revforge/app/Programs.java', [
    'package revforge.app;',
    '',
    'import revforge.cobol.RunUnit;',
    '',
    '// GENERATED by the REVFORGE integration step: every converted program, registered under its PROGRAM-ID.',
    'public final class Programs {',
    '  private Programs() {}',
    '',
    '  public static void registerAll() {',
    ...included.map((p) => `    RunUnit.register(${jstr(p.program)}, ${p.pkg}.${p.cls}::new);`),
    '  }',
    '',
    '  public static final String[] CONVERTED = {' + included.map((p) => jstr(p.program)).join(', ') + '};',
    '}',
  ]);
  gen('revforge/app/batch/Jobs.java', [
    'package revforge.app.batch;',
    '',
    'import java.util.List;',
    'import revforge.cobol.batch.JobRunner.Dd;',
    'import revforge.cobol.batch.JobRunner.Job;',
    'import revforge.cobol.batch.JobRunner.Step;',
    '',
    '// GENERATED by the REVFORGE integration step from the JCL members (DD name to data set, PARM, COND).',
    'public final class Jobs {',
    '  private Jobs() {}',
    '',
    '  public static final List<String> NAMES = List.of(' + jobs.map((j) => jstr(j.name)).join(', ') + ');',
    '',
    '  public static Job get(String name) {',
    '    return switch (name) {',
    ...jobs.map(
      (j) =>
        `      case ${jstr(j.name)} -> new Job(${jstr(j.name)}, ${jstr(j.source)}, List.of(${j.steps
          .map((s) => `new Step(${jstr(s.name)}, ${jstr(s.pgm)}, ${s.parm === null ? 'null' : jstr(s.parm)}, ${s.cond === null ? 'null' : jstr(s.cond)}, List.of(${s.dds.filter((d) => d.name !== 'STEPLIB' && d.name !== 'JOBLIB').map((d) => `new Dd(${jstr(d.name)}, ${d.dsn ? jstr(d.dsn) : 'null'}, ${d.sysout}, ${d.dummy || d.instream})`).join(', ')}))`)
          .join(', ')}));`,
    ),
    '      default -> throw new IllegalArgumentException("no job " + name);',
    '    };',
    '  }',
    '}',
  ]);
  gen('revforge/app/Main.java', [
    'package revforge.app;',
    '',
    'import java.nio.file.Path;',
    'import revforge.app.batch.Jobs;',
    'import revforge.cobol.RunUnit;',
    'import revforge.cobol.batch.JobRunner;',
    '',
    '// GENERATED: command line of the converted application.',
    '//   java -cp classes revforge.app.Main job <JOB> <data-root>      run a converted JCL job (DSN = file under data-root)',
    '//   java -cp classes revforge.app.Main program <PROGRAM-ID>       run a program as the main program (DD names from -Ddd.<NAME>=<path>)',
    'public final class Main {',
    '  private Main() {}',
    '',
    '  public static void main(String[] args) throws Exception {',
    '    Programs.registerAll();',
    '    if (args.length >= 3 && args[0].equals("job")) {',
    '      for (JobRunner.StepResult r : JobRunner.run(Jobs.get(args[1]), Path.of(args[2]), null)) System.out.println(r.step() + " " + r.pgm() + " " + r.outcome() + (r.returnCode() == null ? "" : " RC=" + r.returnCode()));',
    '    } else if (args.length >= 2 && args[0].equals("program")) {',
    '      final RunUnit ru = new RunUnit();',
    '      System.getProperties().stringPropertyNames().stream().filter(k -> k.startsWith("dd.")).forEach(k -> ru.datasets.put(k.substring(3), Path.of(System.getProperty(k))));',
    '      System.exit(ru.runMain(args[1]));',
    '    } else {',
    '      System.err.println("usage: job <JOB> <data-root> | program <PROGRAM-ID>");',
    '      System.exit(2);',
    '    }',
    '  }',
    '}',
  ]);
  fs.writeFileSync(path.join(appDir, 'README.md'), [
    '# REVFORGE converted application (generated)',
    '',
    'Plain Java 21, no external dependencies. Generated by `pilot convert-app` and `pilot integrate` from the authorised COBOL sources; do not edit.',
    '',
    '```',
    'javac -encoding UTF-8 -Xlint:all -Werror -d classes @sources.txt',
    'java -cp classes revforge.cobol.testing.RuntimeTests',
    'java -cp classes revforge.app.Main job <JOB> <data-root>',
    '```',
    '',
    'Gaps (behaviour the source does not define, DB2/CICS boundaries, missing paragraphs and declarations) throw `UnresolvedGapException`; see each program\'s `pilot-result.json` and `STEP-17-FINAL-REPORT.md`.',
    '',
  ].join('\n'));
  const javaFiles = listJava(src).sort();
  fs.writeFileSync(path.join(appDir, 'sources.txt'), javaFiles.map((f) => path.relative(appDir, f).split(path.sep).join('/')).join('\n') + '\n');
  const result: any = { contract: 'pilot/app-integration', contract_version: '1.0', generated_at: new Date().toISOString(), scope_manifest: withManifest.scope_manifest, integration_dir: manifest.integration_dir, programs: included.map((p) => p.program), excluded, jobs: jobs.map((j) => ({ name: j.name, source: j.source, steps: j.steps.map((s) => ({ step: s.name, pgm: s.pgm, converted: included.some((p) => p.program === s.pgm), dds: s.dds.map((d) => d.name) })), notes: j.notes })), files: javaFiles.length };
  if (!tc.java.available) result.compilation = { status: 'JAVA_TOOLCHAIN_UNAVAILABLE' };
  else {
    const classes = path.join(appDir, 'classes');
    fs.mkdirSync(classes, { recursive: true });
    const cc = spawnSync(tc.java.javac!, ['-encoding', 'UTF-8', '-Xlint:all', '-Werror', '-d', classes, '@sources.txt'], { cwd: appDir, encoding: 'utf8', timeout: 900000 });
    result.compilation = { status: cc.status === 0 ? 'COMPILED' : 'COMPILATION_FAILED', javac: tc.java.version, files: javaFiles.length, diagnostics: `${cc.stdout}${cc.stderr}`.trim().split(/\r?\n/).filter(Boolean).slice(0, 40) };
    if (cc.status === 0) {
      const parse = (out: string) => out.split(/\r?\n/).filter((l) => l.startsWith('CASE|')).map((l) => {
        const [, id, status, gap, detail] = l.split('|');
        return { id, status, gap_id: gap === '-' ? null : gap, detail: detail || undefined };
      });
      const tally = (cs: any[]) => ({ PASS: cs.filter((c) => c.status === 'PASS').length, BLOCKED_AS_EXPECTED: cs.filter((c) => c.status === 'BLOCKED_AS_EXPECTED').length, FAIL: cs.filter((c) => c.status === 'FAIL').length, total: cs.length });
      const java = (args: string[]) => spawnSync(tc.java.java!, ['-cp', classes, ...args], { encoding: 'latin1', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
      const rt = java(['revforge.cobol.testing.RuntimeTests']);
      const unit = java(['revforge.cobol.testing.TestMain', '--isolated', ...included.flatMap((p) => [`${p.pkg}.${p.cls}`, p.fixtures ?? '-'])]);
      const integ = java(['revforge.cobol.testing.Integration', path.join(ctx.forwardDir, 'pilot', 'app-fixtures', 'integration')]);
      const cases = { runtime: parse(rt.stdout), programs: parse(unit.stdout), integration: parse(integ.stdout) };
      result.tests = {
        runtime_unit: { exit_code: rt.status, counts: tally(cases.runtime) },
        program_tests: { exit_code: unit.status, counts: tally(cases.programs), scenario_counts: tally(cases.programs.filter((c) => !/:(INIT|PROBE|C88) /.test(c.id))) },
        integration: { exit_code: integ.status, counts: tally(cases.integration), stderr: integ.stderr.trim().split(/\r?\n/).filter(Boolean).slice(0, 10) },
        cases,
      };
    }
  }
  const files: Array<{ path: string; sha256: string }> = [...written.entries()].map(([rel, h]) => ({ path: `src/${rel}`, sha256: h })).sort((a, b) => a.path.localeCompare(b.path));
  fs.writeFileSync(path.join(appDir, 'integration-result.json'), JSON.stringify(result, null, 2));
  const manifestBody = { contract: 'pilot/evidence-manifest', contract_version: '1.0', inputs: [withManifest.scope_manifest, ...manifest.jcl], outputs: files, result_sha256: sha(fs.readFileSync(path.join(appDir, 'integration-result.json'))) };
  const body = JSON.stringify(manifestBody, null, 2);
  fs.writeFileSync(path.join(appDir, 'evidence-manifest.json'), JSON.stringify({ ...manifestBody, manifest_sha256: sha(body) }, null, 2));
  mutate(wf, 'local generation integrated', () => {
    wf.store.append('local_generation_integrated', { integration_dir: manifest.integration_dir, scope_manifest_sha256: withManifest.scope_manifest.sha256, programs: included.length, excluded: excluded.map((x) => x.program), compilation: result.compilation?.status, tests: result.tests ? { runtime: result.tests.runtime_unit.counts, programs: result.tests.program_tests.counts, integration: result.tests.integration.counts } : null, evidence_manifest_sha256: sha(body) });
    wf.store.writeState(wf.state);
  });
  return result;
}

export { packageOf, classOf };
