/**
 * Isolated synthetic conversion pilot (STEP 11). Runs one synthetic COBOL
 * program end to end without touching any workflow, gate or approval:
 *
 *   inspect (subset parse) -> extract behaviour -> find and preserve gaps ->
 *   generate Java -> compile (javac) -> run the fixture cases -> compare with
 *   the independently written expectations -> (if a COBOL compiler exists)
 *   capture and compare a COBOL reference run -> trace audit -> evidence
 *   manifest.
 *
 * Refusals: the definition must declare `synthetic: true`; the program may
 * not live under the configured COBOL source root, the reverse outputs or
 * the reference tree; generated output stays inside the pilot root. Missing
 * tools are reported as such (JAVA_TOOLCHAIN_UNAVAILABLE,
 * COBOL_COMPILER_UNAVAILABLE); results are never fabricated. A program with
 * any open gap is PARTIAL, never COMPLETE, and equivalence is claimed only
 * against a real COBOL reference run.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { findGaps, Gap, ParsedProgram, parseProgram, performRange, Stmt, UnsupportedConstruct, walk } from './cobol-subset';
import { emitJava } from './java-emit';
import { sourceFile } from '../../../verification/src/cobol-source';

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const inside = (child: string, parent: string) => {
  const r = path.relative(path.resolve(parent), path.resolve(child));
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};

export class PilotRefused extends Error {}

export interface Toolchain {
  java: { available: boolean; javac: string | null; java: string | null; version: string | null; source: string | null };
  cobol: { available: boolean; cobc: string | null; version: string | null; source: string | null };
}

function probe(cmd: string, args: string[]): string | null {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 30000 });
  return r.status === 0 ? `${r.stdout}${r.stderr}`.trim().split(/\r?\n/)[0] : null;
}

/** Finds a JDK (REVFORGE_JAVA_HOME, JAVA_HOME, then PATH) and a COBOL compiler (REVFORGE_COBC, then PATH). Never installs anything. */
export function detectToolchain(env: NodeJS.ProcessEnv = process.env): Toolchain {
  const exe = (n: string) => (process.platform === 'win32' ? `${n}.exe` : n);
  const java: Toolchain['java'] = { available: false, javac: null, java: null, version: null, source: null };
  for (const [src, home] of [['REVFORGE_JAVA_HOME', env.REVFORGE_JAVA_HOME], ['JAVA_HOME', env.JAVA_HOME]] as const) {
    if (!home) continue;
    const javac = path.join(home, 'bin', exe('javac'));
    const v = fs.existsSync(javac) ? probe(javac, ['-version']) : null;
    if (v) {
      Object.assign(java, { available: true, javac, java: path.join(home, 'bin', exe('java')), version: v, source: src });
      break;
    }
  }
  if (!java.available) {
    const v = probe('javac', ['-version']);
    if (v) Object.assign(java, { available: true, javac: 'javac', java: 'java', version: v, source: 'PATH' });
  }
  const cobol: Toolchain['cobol'] = { available: false, cobc: null, version: null, source: null };
  const cands: Array<[string, string]> = env.REVFORGE_COBC ? [['REVFORGE_COBC', env.REVFORGE_COBC]] : [];
  cands.push(['PATH', 'cobc']);
  for (const [src, c] of cands) {
    const v = probe(c, ['--version']);
    if (v) {
      Object.assign(cobol, { available: true, cobc: c, version: v, source: src });
      break;
    }
  }
  return { java, cobol };
}

export interface PilotOptions {
  dir: string;
  pilotRoot: string;
  out?: string;
  /** Directories the pilot must never read a program from (real COBOL, reverse outputs, references). */
  forbiddenRoots: string[];
  toolchain?: Toolchain;
}

const STAGES = [
  { stage: 'inspection', analogue: 'reverse agents 2-3 (parser, data)', execution: 'deterministic tool (strict COBOL subset parser)' },
  { stage: 'behaviour extraction', analogue: 'F1 requirements analyst', execution: 'deterministic tool (dispatch table, decision tables, statement inventory); no agent invoked' },
  { stage: 'gap analysis', analogue: 'F1 uncertainty register / F2 data mapping', execution: 'deterministic tool' },
  { stage: 'architecture', analogue: 'F3 Java architect', execution: 'not executed (fixed pilot layout: one class per program, record, port, placeholder); no F3 agent invoked' },
  { stage: 'implementation', analogue: 'F5 Java developer', execution: 'deterministic generator; the F5 agent was NOT invoked and production generation stays unauthorized' },
  { stage: 'testing', analogue: 'F6 independent tester', execution: 'real javac/java execution against specification-derived fixtures; no F6 agent invoked' },
  { stage: 'review', analogue: 'F7 independent reviewer', execution: 'deterministic trace audit; no F7 agent invoked' },
];

export function runPilot(o: PilotOptions): any {
  const dir = path.resolve(o.dir);
  const pilotRoot = path.resolve(o.pilotRoot);
  if (!inside(dir, pilotRoot)) throw new PilotRefused(`${dir} is outside the pilot root ${pilotRoot}`);
  const defFile = path.join(dir, 'pilot.json');
  if (!fs.existsSync(defFile)) throw new PilotRefused(`no pilot.json in ${dir}`);
  const def = JSON.parse(fs.readFileSync(defFile, 'utf8'));
  if (def.synthetic !== true) throw new PilotRefused('the pilot definition does not declare synthetic: true; real programs are never converted by the pilot');
  const progFile = path.resolve(dir, def.program);
  for (const r of o.forbiddenRoots.filter(Boolean)) if (inside(progFile, r)) throw new PilotRefused(`${progFile} is inside a protected source root (${r}); the pilot converts synthetic programs only`);
  if (!inside(progFile, dir)) throw new PilotRefused(`${progFile} is outside the pilot directory`);
  const out = path.resolve(o.out ?? path.join(dir, 'out'));
  if (!inside(out, pilotRoot)) throw new PilotRefused(`output ${out} is outside the pilot root ${pilotRoot}; pilot Java never leaves it`);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const tc = o.toolchain ?? detectToolchain();

  const inputs = ['pilot.json', def.program, def.driver, def.specification, def.fixtures].filter(Boolean).map((rel: string) => ({ path: rel.split(path.sep).join('/'), sha256: sha(fs.readFileSync(path.join(dir, rel))) }));
  const fixtures = JSON.parse(fs.readFileSync(path.join(dir, def.fixtures), 'utf8'));
  const copyDirs = (def.copy_dirs ?? []).map((d: string) => path.resolve(dir, d));
  const resolve = (m: string) => {
    for (const d of copyDirs) for (const ext of ['.cpy', '.cbl', '']) if (fs.existsSync(path.join(d, m + ext))) return sourceFile(path.join(d, m + ext), fs.readFileSync(path.join(d, m + ext), 'utf8'));
    return null;
  };
  const available = new Set<string>(
    copyDirs.flatMap((d: string) => (fs.existsSync(d) ? fs.readdirSync(d) : []).filter((f) => /\.(cbl|cob)$/i.test(f)).map((f) => /PROGRAM-ID\.\s*([A-Z0-9-]+)/i.exec(fs.readFileSync(path.join(d, f), 'utf8'))?.[1]?.toUpperCase()).filter(Boolean) as string[]),
  );
  return convertCore({ progFile, resolve, available, pkg: def.java_package, out, fixtures, inputs, statement: def.statement, synthetic: true, isolation: { pilot_dir: dir, output_dir: out, workflow_used: false, approvals_used: false, production_generation: false, external_ai_calls: false }, tc, refDir: dir, refDef: def });
}

export interface CoreInput {
  progFile: string;
  resolve: (m: string) => ReturnType<typeof sourceFile> | null;
  /** Program IDs whose source is available to the converter (a CALL to any other program is a gap). */
  available: Set<string>;
  pkg: string;
  out: string;
  fixtures: any;
  inputs: Array<{ path: string; sha256: string }>;
  statement: string;
  synthetic: boolean;
  isolation: Record<string, unknown>;
  tc: Toolchain;
  refDir: string;
  refDef: any;
  /** STEP 16: the scoped local-generation authorisation a real conversion runs under. */
  authorization?: Record<string, unknown>;
}

/** The conversion pipeline shared by synthetic pilots and authorised real conversions (callers enforce their own refusals). */
export function convertCore(c: CoreInput): any {
  const { progFile, resolve, out, fixtures, tc } = c;
  const result: any = {
    contract: 'pilot/pilot-result',
    contract_version: '1.0',
    synthetic: c.synthetic,
    statement: c.statement,
    generated_at: new Date().toISOString(),
    inputs: c.inputs,
    stages: STAGES,
    isolation: c.isolation,
    toolchain: tc,
    ...(c.authorization ? { authorization: c.authorization } : {}),
  };

  // 1-2. Inspection and behaviour extraction.
  let prog: ParsedProgram;
  try {
    prog = parseProgram(progFile, resolve);
  } catch (e) {
    if (e instanceof UnsupportedConstruct) return { ...result, conversion_status: 'FAILED', failure: { stage: 'inspection', line: e.line, construct: e.construct } };
    throw e;
  }
  const srcLines = fs.readFileSync(progFile, 'utf8').replace(/\r\n?/g, '\n').split('\n');
  const available = new Set(c.available);
  available.delete(prog.program_id);
  const gaps = findGaps(prog, available, srcLines);
  result.inspection = {
    program_id: prog.program_id,
    sha256: prog.sha256,
    interface: prog.data.linkage && { record: prog.data.linkage.name, length: prog.data.linkage.length, fields: prog.data.linkage.fields.map((f) => ({ name: f.name, offset: f.offset, length: f.length, type: f.type, conditions: f.conditions })) },
    working_storage: prog.data.working.map((f) => ({ name: f.name, type: f.type, value: f.value, line: f.line })),
    paragraphs: prog.paragraphs.map((p) => ({ name: p.name, lines: [p.line, p.end_line], statements: count(p.body) })),
  };
  result.extraction = extract(prog);
  result.gaps = gaps;
  result.behaviours = classifyBranches(prog, gaps);

  // 3. Generation (inside the pilot output only).
  let emitted;
  try {
    emitted = emitJava(prog, gaps, c.pkg);
  } catch (e) {
    if (e instanceof UnsupportedConstruct) return finish(out, { ...result, conversion_status: 'FAILED', failure: { stage: 'generation', line: e.line, construct: e.construct } });
    throw e;
  }
  const srcDir = path.join(out, 'java', 'src');
  for (const [rel, text] of Object.entries(emitted.files)) {
    const f = path.join(srcDir, rel);
    if (!inside(f, out)) throw new PilotRefused(`generated path ${rel} escapes the output directory`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  fs.writeFileSync(path.join(out, 'source-map.json'), JSON.stringify(emitted.source_map, null, 2));
  result.generation = { files: Object.keys(emitted.files).sort().map((rel) => ({ path: `java/src/${rel}`, sha256: sha(emitted.files[rel]), lines: emitted.files[rel].split('\n').length - 1 })), source_map: 'source-map.json' };
  result.gap_trace = gaps.map((g) => ({ gap_id: g.gap_id, kind: g.kind, subject: g.subject, cobol: `${g.origin.file}:${g.origin.line}`, java: emitted.source_map.gaps.find((x) => x.gap_id === g.gap_id) ?? null, blocked_behaviours: result.behaviours.filter((b: any) => b.blocked_by.includes(g.gap_id)).map((b: any) => b.branch) }));

  // 4. Compilation.
  if (!tc.java.available) {
    result.compilation = { status: 'JAVA_TOOLCHAIN_UNAVAILABLE', detail: 'no javac found via REVFORGE_JAVA_HOME, JAVA_HOME or PATH; nothing was compiled or executed' };
    result.execution = { status: 'NOT_RUN', reason: 'no Java toolchain' };
  } else {
    const classes = path.join(out, 'java', 'classes');
    fs.mkdirSync(classes, { recursive: true });
    const javaFiles = Object.keys(emitted.files).map((rel) => path.join(srcDir, rel));
    const javacArgs = ['-encoding', 'UTF-8', '-Xlint:all', '-Werror', '-d', classes, ...javaFiles];
    const cc = spawnSync(tc.java.javac!, javacArgs, { encoding: 'utf8', timeout: 300000 });
    result.compilation = { status: cc.status === 0 ? 'COMPILED' : 'COMPILATION_FAILED', javac: tc.java.version, command: `javac ${javacArgs.slice(0, 6).join(' ')} <${javaFiles.length} source files>`, exit_code: cc.status, diagnostics: `${cc.stdout}${cc.stderr}`.trim().split(/\r?\n/).filter(Boolean).slice(0, 40), class_files: cc.status === 0 ? listFiles(classes).filter((f) => f.endsWith('.class')).length : 0 };
    // 5. Fixture execution and comparison.
    if (cc.status === 0) {
      const stdin = fixtures.cases.map((k: any) => k.input).join('\n') + '\n';
      const x = spawnSync(tc.java.java!, ['-cp', classes, `${c.pkg}.PilotHarness`], { input: stdin, encoding: 'utf8', timeout: 300000 });
      const lines = x.stdout.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length);
      result.execution = { status: x.status === 0 && lines.length === fixtures.cases.length ? 'EXECUTED' : 'EXECUTION_FAILED', exit_code: x.status, stderr: x.stderr.trim().split(/\r?\n/).filter(Boolean).slice(0, 20), cases: compare(fixtures.cases, lines, gaps) };
      result.execution.counts = tally(result.execution.cases);
    } else result.execution = { status: 'NOT_RUN', reason: 'compilation failed' };
  }

  // 6. COBOL reference (only with a real compiler).
  result.cobol_reference = cobolReference(tc, c.refDir, c.refDef, out, fixtures);
  const javaPassed = result.execution?.status === 'EXECUTED' && result.execution.counts.FAIL === 0;
  result.validation = {
    kind: result.cobol_reference.status === 'CAPTURED' ? 'COBOL_REFERENCE_AND_FIXTURES' : 'FIXTURE_BASED',
    fixtures_provenance: fixtures.provenance,
    statement:
      result.cobol_reference.status === 'CAPTURED'
        ? 'Java outputs were compared with a captured COBOL reference run and with the fixture expectations.'
        : 'Java outputs were compared only with specification-derived fixture expectations. This is fixture-based validation, NOT runtime COBOL/Java equivalence.',
  };
  result.equivalence = result.cobol_reference.status === 'CAPTURED' && result.cobol_reference.matches_java === true ? 'EQUIVALENT_ON_EXECUTED_FIXTURES' : 'EQUIVALENCE_UNVERIFIED';
  result.conversion_status =!javaPassed ? (result.compilation.status === 'JAVA_TOOLCHAIN_UNAVAILABLE' ? 'NOT_EXECUTED' : 'FAILED') : gaps.length ? 'PARTIAL' : 'COMPLETE';
  result.conversion_status_reason =
    result.conversion_status === 'PARTIAL'
      ? `the Java compiles and every verified path matches its fixtures, but ${gaps.length} gap(s) stay open (${gaps.map((g) => g.gap_id).join(', ')}) and their paths are blocked`
      : result.conversion_status === 'COMPLETE'
        ? 'every path translated and matched its fixtures'
        : result.conversion_status === 'NOT_EXECUTED'
          ? 'no Java toolchain: nothing was compiled or run'
          : 'compilation or a fixture comparison failed';
  result.trace_audit = traceAudit(prog, gaps, emitted.source_map, result);
  return finish(out, result);
}

function listFiles(d: string): string[] {
  return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(path.join(d, e.name)) : [path.join(d, e.name)])) : [];
}

function count(ss: Stmt[]): number {
  let n = 0;
  walk(ss, () => n++);
  return n;
}

/** The dispatch table and decision tables, as data. */
function extract(p: ParsedProgram): any {
  const dispatch: any[] = [];
  const tables: any[] = [];
  p.paragraphs.forEach((para) =>
    walk(para.body, (s) => {
      if (s.kind === 'evaluate_true') {
        for (const w of s.whens) {
          const c = p.data.conditions.get(w.condition);
          dispatch.push({ line: w.line, condition: w.condition, field: c?.field ?? null, values: c?.values ?? null, performs: w.body.filter((b) => b.kind === 'perform').map((b: any) => performRange(p, b).map((k) => p.paragraphs[k].name)), other_statements: w.body.filter((b) => b.kind !== 'perform').map((b) => b.kind) });
        }
        if (s.other) dispatch.push({ line: s.line, condition: 'OTHER', statements: s.other.map((b) => ({ kind: b.kind, line: b.line })) });
      }
      if (s.kind === 'evaluate') tables.push({ paragraph: para.name, line: s.line, subject: s.subject, rows: [...s.whens.map((w) => ({ when: w.lo === w.hi ? `${w.lo}` : `${w.lo} THRU ${w.hi}`, sets: w.body.filter((b) => b.kind === 'set').map((b: any) => b.condition) })), ...(s.other ? [{ when: 'OTHER', sets: s.other.filter((b) => b.kind === 'set').map((b: any) => b.condition) }] : [])] });
    }),
  );
  return { dispatch, decision_tables: tables };
}

/** Each dispatch branch is VERIFIED (fully translated from source) or GAP (reaches an open gap). */
function classifyBranches(p: ParsedProgram, gaps: Gap[]): any[] {
  const out: any[] = [];
  const entry = p.paragraphs[0];
  walk(entry.body, (s) => {
    if (s.kind !== 'evaluate_true') return;
    const branch = (label: string, values: string[] | null, body: Stmt[], line: number) => {
      const paras = body.filter((b) => b.kind === 'perform').flatMap((b: any) => performRange(p, b).map((k) => p.paragraphs[k].name ?? '(unnamed)'));
      const blocked = gaps.filter((g) => g.affected_paragraphs.some((a) => paras.includes(a)) || g.dependent_statements.some((d) => d.line >= line && d.line <= Math.max(line, ...body.map((b) => b.end)))).map((g) => g.gap_id);
      out.push({ branch: label, values, line, paragraphs: paras, category: blocked.length ? 'GAP' : 'VERIFIED', blocked_by: blocked });
    };
    for (const w of s.whens) branch(w.condition, p.data.conditions.get(w.condition)?.values ?? null, w.body, w.line);
    if (s.other) branch('OTHER', null, s.other, s.line);
  });
  return out;
}

function compare(cases: any[], lines: string[], gaps: Gap[]): any[] {
  return cases.map((k, i) => {
    const actual = lines[i] ?? null;
    if (k.expected.blocked) {
      const gid = /^BLOCKED (\S+)$/.exec(actual ?? '')?.[1] ?? null;
      const g = gaps.find((x) => x.gap_id === gid);
      const ok = !!g && k.expected.reason.includes(g.subject);
      return { id: k.id, title: k.title, expected: `BLOCKED (${k.expected.reason})`, actual, status: ok ? 'BLOCKED_AS_EXPECTED' : 'FAIL', gap_id: gid };
    }
    return { id: k.id, title: k.title, expected: k.expected.image, actual, status: actual === k.expected.image ? 'PASS' : 'FAIL' };
  });
}
const tally = (cs: any[]) => ({ PASS: cs.filter((c) => c.status === 'PASS').length, BLOCKED_AS_EXPECTED: cs.filter((c) => c.status === 'BLOCKED_AS_EXPECTED').length, FAIL: cs.filter((c) => c.status === 'FAIL').length, total: cs.length });

function cobolReference(tc: Toolchain, dir: string, def: any, out: string, fixtures: any): any {
  if (!tc.cobol.available) return { status: 'COBOL_COMPILER_UNAVAILABLE', detail: 'no COBOL compiler (REVFORGE_COBC or cobc on PATH); the synthetic COBOL was not executed and no reference outputs exist' };
  if (!def.driver) return { status: 'NO_DRIVER', detail: 'the pilot definition names no driver program' };
  const exe = path.join(out, 'cobol', process.platform === 'win32' ? 'driver.exe' : 'driver');
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  const c = spawnSync(tc.cobol.cobc!, ['-x', '-o', exe, path.join(dir, def.driver), path.join(dir, def.program)], { encoding: 'utf8', timeout: 300000 });
  if (c.status !== 0) return { status: 'COBOL_COMPILATION_FAILED', diagnostics: `${c.stdout}${c.stderr}`.trim().split(/\r?\n/).slice(0, 20) };
  const verified = fixtures.cases.filter((k: any) => !k.expected.blocked);
  const x = spawnSync(exe, [], { input: verified.map((k: any) => k.input).join('\n') + '\n*END\n', encoding: 'utf8', timeout: 300000 });
  const lines = x.stdout.replace(/\r\n?/g, '\n').split('\n').filter((l) => l.length);
  const rows = verified.map((k: any, i: number) => ({ id: k.id, cobol: lines[i] ?? null, fixture: k.expected.image, agrees_with_fixture: lines[i] === k.expected.image }));
  return { status: x.status === 0 && lines.length === verified.length ? 'CAPTURED' : 'COBOL_EXECUTION_FAILED', exit_code: x.status, rows, matches_java: null };
}

/** F7-analogue checks: every COBOL statement mapped, every gap traced and still blocked, nothing claimed beyond the evidence. */
function traceAudit(p: ParsedProgram, gaps: Gap[], sm: any, r: any): any {
  const findings: string[] = [];
  const all: Stmt[] = [];
  p.paragraphs.forEach((q) => walk(q.body, (s) => all.push(s)));
  const mapped = new Set(sm.statements.map((s: any) => s.cobol_line));
  const unmapped = all.filter((s) => !mapped.has(s.line));
  if (unmapped.length) findings.push(`COBOL statements without a Java mapping: ${unmapped.map((s) => s.line).join(', ')}`);
  for (const g of gaps) {
    const t = sm.gaps.find((x: any) => x.gap_id === g.gap_id);
    if (g.kind === 'UNDEFINED_EXTERNAL_CALL' && (!t || !t.call_sites.length)) findings.push(`${g.gap_id} has no Java call site`);
    if (!(r.execution?.cases ?? []).some((c: any) => c.gap_id === g.gap_id && c.status === 'BLOCKED_AS_EXPECTED')) findings.push(`${g.gap_id}: no executed fixture demonstrates that its path stays blocked`);
  }
  if (gaps.length && r.conversion_status === 'COMPLETE') findings.push('a program with open gaps is reported COMPLETE');
  const unvalued = p.data.working.filter((w) => w.value === null).map((w) => {
    const firstWrite = gaps.find((g) => g.affected_items.includes(w.name));
    return `${w.name} has no VALUE clause; ${firstWrite ? `it is only read after ${firstWrite.gap_id} writes it` : 'its initial content is not specified by the source'}`;
  });
  const covered = new Set((r.execution?.cases ?? []).filter((c: any) => c.status === 'PASS').map((c: any) => c.id));
  return {
    statements: all.length,
    mapped_statements: all.length - unmapped.length,
    gaps_traced: gaps.length,
    verified_branches: r.behaviours.filter((b: any) => b.category === 'VERIFIED').map((b: any) => b.branch),
    passing_cases: covered.size,
    notes: unvalued,
    findings,
    verdict: findings.length ? 'FINDINGS' : 'NO_FINDINGS',
  };
}

/** Writes the result and an evidence manifest (sha256 of every input, generated file and the result). */
export function finish(out: string, result: any): any {
  const files: Array<{ path: string; sha256: string }> = [];
  const walkDir = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkDir(p);
      else if (!/\.class$/.test(e.name) && e.name !== 'evidence-manifest.json' && e.name !== 'pilot-result.json') files.push({ path: path.relative(out, p).split(path.sep).join('/'), sha256: sha(fs.readFileSync(p)) });
    }
  };
  fs.writeFileSync(path.join(out, 'pilot-result.json'), JSON.stringify(result, null, 2));
  walkDir(out);
  files.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = { contract: 'pilot/evidence-manifest', contract_version: '1.0', inputs: result.inputs, outputs: files, result_sha256: sha(fs.readFileSync(path.join(out, 'pilot-result.json'))) };
  const body = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(path.join(out, 'evidence-manifest.json'), JSON.stringify({ ...manifest, manifest_sha256: sha(body) }, null, 2));
  return { ...result, evidence: { manifest: 'evidence-manifest.json', manifest_sha256: sha(body), files: files.length } };
}

/** Re-hashes a pilot output directory against its evidence manifest. */
export function verifyPilotEvidence(out: string, dir?: string): { ok: boolean; problems: string[] } {
  const m = JSON.parse(fs.readFileSync(path.join(out, 'evidence-manifest.json'), 'utf8'));
  const problems: string[] = [];
  const { manifest_sha256, ...body } = m;
  if (createHash('sha256').update(JSON.stringify(body, null, 2)).digest('hex') !== manifest_sha256) problems.push('manifest digest mismatch');
  for (const f of m.outputs) {
    const p = path.join(out, f.path);
    if (!fs.existsSync(p)) problems.push(`missing ${f.path}`);
    else if (sha(fs.readFileSync(p)) !== f.sha256) problems.push(`${f.path} changed`);
  }
  if (sha(fs.readFileSync(path.join(out, 'pilot-result.json'))) !== m.result_sha256) problems.push('pilot-result.json changed');
  if (dir) for (const f of m.inputs) if (sha(fs.readFileSync(path.join(dir, f.path))) !== f.sha256) problems.push(`input ${f.path} changed`);
  return { ok: !problems.length, problems };
}
