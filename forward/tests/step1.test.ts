import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { collectPermanentIds, isPermanentId, owningFileId, permanentIdKind, runLocalIdKind } from '../verification/src/ids';
import { classifyRule } from '../verification/src/evidence';
import { loadArtifacts } from '../runtime/src/core/artifacts';
import { loadContext } from '../runtime/src/core/config';
import { OutputWriter } from '../runtime/src/core/fsutil';
import { assertGenerationAllowed, GenerationNotAuthorizedError, isCodeGenerationPath } from '../runtime/src/core/guard';
import { discoverSystem, expandGapItem, normalizeGaps, normalizeRules, selectPrograms, sourceRunKey } from '../runtime/src/core/model';
import { normalizePath } from '../runtime/src/core/paths';
import { runDoctor } from '../runtime/src/commands/doctor';
import { PlanError, runPlan } from '../runtime/src/commands/plan';
import { runValidation } from '../runtime/src/commands/validate';
import { EXIT, main } from '../runtime/src/cli';
import { cleanup, Fixture, FORWARD_DIR, makeFixture } from './helpers/fixture';

const ENV = 'REVFORGE_COBOL_SOURCE_ROOT';
let fx: Fixture;
const fixtures: Fixture[] = [];
const ctxFor = (f: Fixture, extra: Record<string, unknown> = {}) => loadContext({ forwardDir: FORWARD_DIR, configPath: f.configPath, ...extra });
const make = (o?: Parameters<typeof makeFixture>[0]) => {
  const f = makeFixture(o);
  fixtures.push(f);
  return f;
};
const runFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? runFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]));

beforeEach(() => {
  delete process.env[ENV];
  fx = make();
});
afterEach(() => {
  while (fixtures.length) cleanup(fixtures.pop()!);
});

describe('1. dynamic program discovery', () => {
  test('discovers exactly the programs, copybooks and JCL in the inventory', () => {
    const sys = discoverSystem(loadArtifacts(ctxFor(fx)));
    assert.deepEqual(sys.programs.map((p) => p.program_id), fx.programs.map((p) => p.name));
    assert.deepEqual(sys.programs.map((p) => p.file_id), fx.programs.map((p) => p.fileId));
    assert.equal(sys.copybooks.length, fx.copybooks.length);
    assert.equal(sys.jcl_jobs.length, 1);
    assert.equal(sys.unresolved_edges.length, 1);
    assert.deepEqual(sys.coverage_mismatches, []);
  });

  test('a different system with a different count is discovered without code changes', () => {
    const names = ['ZULU', 'YANKEE', 'XRAY', 'WHISKEY', 'VICTOR', 'UNIFORM', 'TANGO'];
    const f = make({ system: 'OTHERSYS', programs: names, copybooks: ['CPA', 'CPB'] });
    const sys = discoverSystem(loadArtifacts(ctxFor(f)));
    assert.equal(sys.system_id, 'SYS-OTHERSYS-001');
    assert.equal(sys.programs.length, names.length);
    assert.equal(sys.copybooks.length, 2);
    const first = sys.programs.find((p) => p.program_id === 'ZULU')!;
    assert.equal(first.calls_out.length, names.length - 1);
    assert.equal(first.jcl_jobs.length, 1);
  });

  test('program selection accepts Program IDs or File IDs and reports unknown names', () => {
    const sys = discoverSystem(loadArtifacts(ctxFor(fx)));
    const r = selectPrograms(sys, [fx.programs[0].name, fx.programs[1].fileId, 'NOPE']);
    assert.deepEqual(r.selected.map((p) => p.program_id), [fx.programs[0].name, fx.programs[1].name]);
    assert.deepEqual(r.unknown, ['NOPE']);
  });

  test('plan --programs subset only produces packets for the selection', () => {
    const r = runPlan(ctxFor(fx, { programs: [fx.programs[0].name] }), { runId: 'FWD-TEST-SUBSET' });
    const packets = fs.readdirSync(path.join(r.runDir, 'evidence_packets'));
    assert.deepEqual(packets, [`${fx.programs[0].fileId}__${fx.programs[0].name}.json`]);
    assert.equal(r.counts.programs_discovered, fx.programs.length);
    assert.equal(r.counts.programs_selected, 1);
  });
});

describe('2. valid and invalid JSON inputs', () => {
  test('valid inputs validate with no errors', () => {
    const r = runValidation(ctxFor(fx));
    assert.equal(r.ok, true, JSON.stringify(r.findings.filter((f) => f.severity === 'error')));
  });

  test('syntactically invalid JSON is reported as unparseable', () => {
    fx.write('output/rules/rules_artifact.json', '{ "meta": { "agent_version": ');
    const r = runValidation(ctxFor(fx));
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.code === 'artifact_unparseable' && f.artifact === 'output/rules/rules_artifact.json'));
  });

  test('a contract violation (bad confidence, malformed permanent ID) is reported', () => {
    const rules = fx.read('output/rules/rules_artifact.json');
    rules.business_rules[0].confidence = 'certain';
    rules.business_rules[1].sources[0].source_ids.file_id = 'FIL-12';
    fx.write('output/rules/rules_artifact.json', rules);
    const r = runValidation(ctxFor(fx));
    const v = r.findings.find((f) => f.code === 'contract_violation');
    assert.ok(v, 'expected a contract_violation');
    assert.match(v!.message, /confidence/);
  });

  test('dangling run-local and foreign permanent references are errors', () => {
    const gaps = fx.read('output/final_report/gaps_register.json');
    gaps.gaps[0].related_rule_ids.push('BR-999');
    gaps.gaps[0].affected.push({ statement_id: `${fx.systemId}-FIL-9999-STMT-000001` });
    fx.write('output/final_report/gaps_register.json', gaps);
    const codes = runValidation(ctxFor(fx)).findings.map((f) => f.code);
    assert.ok(codes.includes('dangling_rule_ref'));
    assert.ok(codes.includes('unknown_file_id'));
  });

  test('an invalid configuration is rejected', () => {
    const cfg = JSON.parse(fs.readFileSync(fx.configPath, 'utf8'));
    cfg.selection.programs = 'some';
    fs.writeFileSync(fx.configPath, JSON.stringify(cfg));
    assert.throws(() => ctxFor(fx), /invalid configuration/);
  });
});

describe('3. missing required reverse artifacts', () => {
  test('doctor, validate and plan all fail, and plan writes nothing', () => {
    const f = make({ omit: ['gaps'] });
    const ctx = ctxFor(f);
    const d = runDoctor(ctx);
    assert.equal(d.ok, false);
    assert.equal(d.checks.find((c) => c.id === 'artifact_gaps')!.status, 'fail');
    const v = runValidation(ctx);
    assert.ok(v.findings.some((x) => x.code === 'required_artifact_missing' && x.artifact === 'output/final_report/gaps_register.json'));
    assert.throws(() => runPlan(ctx, { runId: 'FWD-TEST-MISSING' }), PlanError);
    assert.equal(fs.existsSync(path.join(f.runsDir, 'FWD-TEST-MISSING')), false);
  });

  test('CLI plan exits non-zero when an artifact is missing', () => {
    const f = make({ omit: ['logic'] });
    const errs: string[] = [];
    const code = main(['plan', '--all', '--config', f.configPath], () => undefined, (s) => errs.push(s));
    assert.equal(code, EXIT.CHECK_FAILED);
    assert.ok(errs.join('\n').includes('logic_artifact.json'));
  });

  test('a missing per-program logic file is an error', () => {
    fs.rmSync(path.join(fx.repoRoot, `output/logic/program_logic/${fx.programs[0].fileId}__${fx.programs[0].name}_logic.json`));
    const r = runValidation(ctxFor(fx));
    assert.ok(r.findings.some((x) => x.code === 'per_program_file_missing'));
  });
});

describe('4. preservation of permanent source IDs', () => {
  test('every permanent ID in the plan outputs exists in the inputs, unchanged', () => {
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-IDS' });
    const inputIds = new Set<string>();
    for (const rel of ['inventory/inventory_artifact.json', 'parser/parser_artifact.json', 'data/data_artifact.json', 'logic/logic_artifact.json', 'rules/rules_artifact.json', 'diagram/diagrams_artifact.json', 'final_report/gaps_register.json']) {
      for (const s of collectPermanentIds(fx.read(`output/${rel}`)).values()) for (const id of s) inputIds.add(id);
    }
    for (const f of runFiles(path.join(fx.repoRoot, 'output/logic/program_logic'))) for (const s of collectPermanentIds(JSON.parse(fs.readFileSync(f, 'utf8'))).values()) for (const id of s) inputIds.add(id);
    let seen = 0;
    for (const f of runFiles(r.runDir).filter((x) => x.endsWith('.json'))) {
      for (const s of collectPermanentIds(JSON.parse(fs.readFileSync(f, 'utf8'))).values()) {
        for (const id of s) {
          seen++;
          assert.ok(inputIds.has(id), `${path.basename(f)} contains an ID not present in the inputs: ${id}`);
        }
      }
    }
    assert.ok(seen > 0);
  });

  test('evidence packets carry the inventory File ID and Path ID of their program', () => {
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-PACKET' });
    for (const p of fx.programs) {
      const pkt = JSON.parse(fs.readFileSync(path.join(r.runDir, 'evidence_packets', `${p.fileId}__${p.name}.json`), 'utf8'));
      assert.equal(pkt.program.source_ids.file_id, p.fileId);
      assert.equal(pkt.program.source_ids.path_id, p.pathId);
      assert.equal(pkt.program.source_ids.system_id, fx.systemId);
    }
  });

  test('null source references stay null and are never filled in', () => {
    const gaps = normalizeGaps(loadArtifacts(ctxFor(fx)).artifacts.gaps);
    const sysGap = gaps.find((g) => g.gap_type === 'DIAGRAM_RENDER_UNVERIFIED')!;
    assert.deepEqual(sysGap.file_ids, []);
    assert.equal(sysGap.missing_source_reference, true);
    assert.equal((sysGap.source_ids as any).file_id, null);
  });

  test('ID classification', () => {
    assert.equal(permanentIdKind('SYS-ABC-001-FIL-0001-STMT-000007'), 'statement');
    assert.equal(permanentIdKind('SYS-ABC-001-PATH-0001'), 'path');
    assert.equal(owningFileId('SYS-ABC-001-FIL-0001-FLD-000002'), 'SYS-ABC-001-FIL-0001');
    assert.equal(isPermanentId('…-FLD-000007'), false);
    assert.equal(runLocalIdKind('GAP-012'), 'gap');
    assert.equal(isPermanentId('BR-001'), false);
  });
});

describe('5. run-local rule and gap identities', () => {
  test('rule and gap refs are scoped run-local and bound to the exact source run', () => {
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-RUNLOCAL' });
    const manifest = JSON.parse(fs.readFileSync(path.join(r.runDir, 'baseline_manifest.json'), 'utf8'));
    const rules = JSON.parse(fs.readFileSync(path.join(r.runDir, 'rule_summary.json'), 'utf8'));
    const gaps = JSON.parse(fs.readFileSync(path.join(r.runDir, 'gap_summary.json'), 'utf8'));
    for (const x of rules.rules) {
      assert.equal(x.ref.scope, 'run-local');
      const run = manifest.source_runs[x.ref.source_run];
      assert.ok(run, `unknown source run ${x.ref.source_run}`);
      assert.equal(run.artifact, 'output/rules/rules_artifact.json');
      assert.equal(run.sha256, manifest.inputs.find((i: any) => i.key === 'rules').sha256);
    }
    for (const g of gaps.gaps) {
      assert.equal(g.ref.scope, 'run-local');
      assert.equal(manifest.source_runs[g.ref.source_run].artifact, 'output/final_report/gaps_register.json');
    }
  });

  test('a changed rules artifact yields a different source-run key', () => {
    const before = sourceRunKey(loadArtifacts(ctxFor(fx)).artifacts.rules);
    const rules = fx.read('output/rules/rules_artifact.json');
    rules.business_rules[0].name = 'Renamed';
    fx.write('output/rules/rules_artifact.json', rules);
    const after = sourceRunKey(loadArtifacts(ctxFor(fx)).artifacts.rules);
    assert.notEqual(before, after);
  });

  test('confidence and SME flags are preserved; evidence classes follow the reverse labelling rule', () => {
    const rules = normalizeRules(loadArtifacts(ctxFor(fx)).artifacts.rules);
    const byId = Object.fromEntries(rules.map((r) => [r.ref.id, r]));
    assert.equal(byId['BR-001'].evidence_class, 'confirmed');
    assert.equal(byId['BR-002'].evidence_class, 'inferred');
    assert.equal(byId['BR-003'].evidence_class, 'uncertain');
    assert.equal(byId['BR-003'].confidence, 'low');
    assert.equal(byId['BR-003'].requires_sme_review, true);
    assert.equal(classifyRule({ confidence: 'high', requires_sme_review: false, source_evidence: ['complete', 'partial'] }).evidence_class, 'uncertain');
    assert.equal(classifyRule({ confidence: 'high', requires_sme_review: false, dead_code: true, source_evidence: ['complete'] }).evidence_class, 'uncertain');
  });
});

describe('6. expansion of grouped gaps', () => {
  test('each affected item becomes an addressable item with extracted references', () => {
    const gaps = normalizeGaps(loadArtifacts(ctxFor(fx)).artifacts.gaps);
    const g = gaps.find((x) => x.ref.id === 'GAP-001')!;
    assert.deepEqual(g.items.map((i) => i.item_id), ['GAP-001#01', 'GAP-001#02', 'GAP-001#03']);
    assert.equal(g.items[0].reference_status, 'permanent_id');
    assert.equal(g.items[0].permanent_ids.statement_ids.length, 1);
    assert.equal(g.items[0].file_id, owningFileId(g.items[0].permanent_ids.statement_ids[0]));
    assert.equal(g.items[2].reference_status, 'name_or_line_only');
    assert.deepEqual(g.items[2].detail, { name: 'UNDECLARED-X', line: 30 });
    const rg = gaps.find((x) => x.ref.id === 'GAP-004')!;
    assert.equal(rg.items[0].reference_status, 'catalogue_only');
    assert.deepEqual(rg.items[0].run_local_refs.rule_ids, ['BR-003']);
  });

  test('empty and reference-free items are handled explicitly', () => {
    const it = expandGapItem({ gap_id: 'GAP-050', source_program: null, source_ids: null }, {}, 0, 'gaps@x#y');
    assert.equal(it.reference_status, 'none');
    assert.equal(it.file_id, null);
    assert.equal(it.program_id, null);
  });

  test('the gap summary counts every expanded item', () => {
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-GAPS' });
    const s = JSON.parse(fs.readFileSync(path.join(r.runDir, 'gap_summary.json'), 'utf8'));
    const expected = fx.read('output/final_report/gaps_register.json').gaps.reduce((n: number, g: any) => n + g.affected.length, 0);
    assert.equal(s.counts.expanded_items, expected);
    assert.equal(s.expanded_items.length, expected);
    assert.equal(s.counts.grouped_gaps, 2);
  });
});

describe('7. prevention of unauthorized Java generation', () => {
  test('code-generation paths are recognised', () => {
    for (const p of ['out/App.java', 'pom.xml', 'build.gradle.kts', 'svc/src/main/java/a/B.txt', 'x\\src\\main\\java\\Y.java']) assert.equal(isCodeGenerationPath(p), true, p);
    for (const p of ['readiness_report.md', 'evidence_packets/a.json', 'notes/java-notes.md']) assert.equal(isCodeGenerationPath(p), false, p);
  });

  test('the output writer refuses Java sources and build files', () => {
    const w = new OutputWriter(path.join(fx.repoRoot, 'w'), { java_generation_allowed: false, current_step: 'STEP-1' });
    assert.throws(() => w.writeText('Foo.java', 'class Foo {}'), GenerationNotAuthorizedError);
    assert.throws(() => w.writeText('pom.xml', '<project/>'), GenerationNotAuthorizedError);
    assert.throws(() => w.writeJson('../escape.json', {}), /outside the run directory/);
    assert.equal(fs.existsSync(path.join(fx.repoRoot, 'w', 'Foo.java')), false);
  });

  test('enabling the config flag alone is not enough: an approved gate is required', () => {
    assert.throws(() => assertGenerationAllowed({ java_generation_allowed: true, current_step: 'STEP-1' }), /approved generation gate/);
    assert.throws(() => assertGenerationAllowed({ java_generation_allowed: true, current_step: 'STEP-1' }, [{ gate_id: 'GENERATION', approved: false }]), GenerationNotAuthorizedError);
  });

  test('CLI generate is refused and plan writes no code files', () => {
    const errs: string[] = [];
    assert.equal(main(['generate', '--config', fx.configPath], () => undefined, (s) => errs.push(s)), EXIT.NOT_AUTHORIZED);
    assert.match(errs.join('\n'), /not authorised/);
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-NOCODE' });
    assert.equal(runFiles(r.runDir).filter((f) => isCodeGenerationPath(f)).length, 0);
  });
});

describe('8. readiness when original COBOL source is unavailable', () => {
  test('source unavailable: warning, never "ready", programs flagged, decision raised', () => {
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-NOSRC' });
    const rep = JSON.parse(fs.readFileSync(path.join(r.runDir, 'readiness_report.json'), 'utf8'));
    assert.equal(rep.checks.find((c: any) => c.id === 'cobol_source_available').status, 'warn');
    assert.notEqual(rep.overall.status, 'ready');
    assert.ok(rep.overall.reasons.some((x: string) => /source not available/.test(x)));
    assert.ok(rep.programs.every((p: any) => p.source_available === false));
    const backlog = JSON.parse(fs.readFileSync(path.join(r.runDir, 'decision_backlog.json'), 'utf8'));
    assert.ok(backlog.decisions.some((d: any) => d.kind === 'source_access'));
    const manifest = JSON.parse(fs.readFileSync(path.join(r.runDir, 'baseline_manifest.json'), 'utf8'));
    assert.equal(manifest.cobol_source.available, false);
    assert.ok(fs.readFileSync(path.join(r.runDir, 'readiness_report.md'), 'utf8').includes('DRAFT'));
  });

  test('a configured root that does not exist is also reported, not trusted', () => {
    const r = runPlan(ctxFor(fx, { sourceRoot: path.join(fx.repoRoot, 'no-such-dir') }), { runId: 'FWD-TEST-BADSRC' });
    const rep = JSON.parse(fs.readFileSync(path.join(r.runDir, 'readiness_report.json'), 'utf8'));
    assert.equal(rep.source_availability.root_exists, false);
    assert.match(rep.source_availability.note, /does not exist/);
  });

  test('source available via the environment variable: check passes', () => {
    const f = make({ withSource: true });
    process.env[ENV] = f.sourceRoot;
    const r = runPlan(ctxFor(f), { runId: 'FWD-TEST-SRC' });
    const rep = JSON.parse(fs.readFileSync(path.join(r.runDir, 'readiness_report.json'), 'utf8'));
    assert.equal(rep.checks.find((c: any) => c.id === 'cobol_source_available').status, 'pass');
    assert.ok(rep.programs.every((p: any) => p.source_available === true));
  });
});

describe('9. readiness, decisions and evidence policy', () => {
  test('empty source program and critical gap block the program; a blocking decision exists', () => {
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-READY' });
    const rep = JSON.parse(fs.readFileSync(path.join(r.runDir, 'readiness_report.json'), 'utf8'));
    const last = fx.programs[fx.programs.length - 1];
    assert.equal(rep.programs.find((p: any) => p.program_id === last.name).readiness, 'blocked');
    const backlog = JSON.parse(fs.readFileSync(path.join(r.runDir, 'decision_backlog.json'), 'utf8'));
    assert.ok(backlog.decisions.some((d: any) => d.blocking && d.refs[0].id === 'GAP-002'));
    assert.ok(backlog.decisions.every((d: any, i: number) => d.decision_id === `DEC-${String(i + 1).padStart(4, '0')}`));
    assert.equal(rep.status, 'draft');
  });

  test('the manifest never claims live Neo4j verification', () => {
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-NEO' });
    const m = JSON.parse(fs.readFileSync(path.join(r.runDir, 'baseline_manifest.json'), 'utf8'));
    assert.equal(m.neo4j.live_verification_performed, false);
    assert.ok(m.neo4j.recorded_upstream_verifications.every((v: any) => /not re-executed/.test(v.note)));
  });

  test('diagrams are attached as supporting evidence only', () => {
    const r = runPlan(ctxFor(fx), { runId: 'FWD-TEST-DIAG' });
    const p = fx.programs[0];
    const pkt = JSON.parse(fs.readFileSync(path.join(r.runDir, 'evidence_packets', `${p.fileId}__${p.name}.json`), 'utf8'));
    assert.equal(pkt.diagrams.role, 'supporting');
    assert.ok(pkt.diagrams.items.some((d: any) => d.diagram_id === `FLOW-${p.name}`));
    assert.equal(pkt.rules.implemented.length, 2);
  });

  test('re-using an existing run ID is refused', () => {
    runPlan(ctxFor(fx), { runId: 'FWD-TEST-DUP' });
    assert.throws(() => runPlan(ctxFor(fx), { runId: 'FWD-TEST-DUP' }), /already exists/);
  });
});

describe('10. cross-platform path handling', () => {
  test('Windows absolute paths are kept verbatim and mapped repo-relative', () => {
    const anchors = ['output', 'references'];
    const a = normalizePath('D:/PROJECTS/Repo/output/rules/rules_artifact.json', anchors);
    assert.deepEqual(a, { raw: 'D:/PROJECTS/Repo/output/rules/rules_artifact.json', kind: 'windows_absolute', repo_relative: 'output/rules/rules_artifact.json' });
    assert.equal(normalizePath('C:\\work\\repo\\output\\x.json', anchors).repo_relative, 'output/x.json');
    assert.equal(normalizePath('/home/u/repo/output/x.json', anchors, '/home/u/repo').repo_relative, 'output/x.json');
    assert.equal(normalizePath('Z:/elsewhere/file.json', anchors).repo_relative, null);
    assert.equal(normalizePath('output/x.json', anchors).kind, 'relative');
  });
});

describe('11. no hardcoded system knowledge', () => {
  test('runtime source names no program, copybook or JCL from the real reverse inventory', () => {
    const inv = path.resolve(FORWARD_DIR, '..', 'output', 'inventory', 'inventory_artifact.json');
    if (!fs.existsSync(inv)) return;
    const d = JSON.parse(fs.readFileSync(inv, 'utf8'));
    const names = new Set<string>([...d.file_registry.map((r: any) => r.program_id), ...d.copybook_registry.map((r: any) => r.id), ...d.jcl_registry.map((r: any) => r.job_name ?? r.id)]);
    const files = [...runFiles(path.join(FORWARD_DIR, 'runtime', 'src')), ...runFiles(path.join(FORWARD_DIR, 'verification', 'src'))].filter((f) => f.endsWith('.ts'));
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      for (const n of names) assert.ok(!new RegExp(`\\b${n}\\b`).test(text), `${path.basename(f)} mentions ${n}`);
      assert.ok(!/SYS-[A-Z0-9]{2,20}-\d{3}-FIL-\d{4}/.test(text), `${path.basename(f)} contains a concrete File ID`);
    }
  });
});

describe('12. integration against the real reverse artifacts (if present)', () => {
  test('validate and plan --all succeed and match counts derived from the inputs', (t) => {
    const repo = path.resolve(FORWARD_DIR, '..');
    if (!fs.existsSync(path.join(repo, 'output', 'inventory', 'inventory_artifact.json'))) {
      t.skip('reverse artifacts not present');
      return;
    }
    const runsDir = path.join(FORWARD_DIR, 'tests', '.tmp', 'runs');
    fs.rmSync(runsDir, { recursive: true, force: true });
    const ctx = loadContext({ forwardDir: FORWARD_DIR, runsDir });
    const v = runValidation(ctx);
    assert.equal(v.ok, true, JSON.stringify(v.findings.filter((f) => f.severity === 'error')).slice(0, 2000));
    const inv = JSON.parse(fs.readFileSync(path.join(repo, 'output/inventory/inventory_artifact.json'), 'utf8'));
    const rules = JSON.parse(fs.readFileSync(path.join(repo, 'output/rules/rules_artifact.json'), 'utf8'));
    const gaps = JSON.parse(fs.readFileSync(path.join(repo, 'output/final_report/gaps_register.json'), 'utf8'));
    const r = runPlan(ctx, { runId: 'FWD-TEST-REAL' });
    assert.equal(r.counts.programs_discovered, inv.file_registry.filter((x: any) => x.type === 'program').length);
    assert.equal(r.counts.business_rules, rules.business_rules.length);
    assert.equal(r.counts.gaps, gaps.gaps.length);
    assert.equal(r.counts.gap_items_expanded, gaps.gaps.reduce((n: number, g: any) => n + (g.affected?.length ?? 0), 0));
    assert.equal(fs.readdirSync(path.join(r.runDir, 'evidence_packets')).length, r.counts.programs_selected);
    fs.rmSync(path.join(FORWARD_DIR, 'tests', '.tmp'), { recursive: true, force: true });
  });
});
