import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadContext, RuntimeContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { gitInfo } from '../runtime/src/core/git';
import { runPlan } from '../runtime/src/commands/plan';
import { AGENTS, findAgent } from '../runtime/src/orchestrator/agents';
import { computeLedger } from '../runtime/src/orchestrator/ledger';
import { advance, initWorkflow, loadWorkflow, policyRoots, prepare, prepareBatches, recordReceipt, runGate, runPrecheck } from '../runtime/src/orchestrator/orchestrator';
import { canWrite } from '../runtime/src/orchestrator/permissions';
import { allowedForwardAdditions, SKILLS, validateSkill, validateSkillInventory } from '../runtime/src/orchestrator/skills';
import { allowedJavaTypes } from '../verification/src/numeric';
import { cleanup, Fixture, FORWARD_DIR, makeFixture } from './helpers/fixture';
import { produceF1, produceF2, readPacket, writeDeliverables } from './helpers/outputs';

const REPO = path.resolve(FORWARD_DIR, '..');
const REAL_AGENTS = path.join(REPO, 'forward', 'agents');
const REAL_SKILLS = path.join(REPO, 'forward', 'skills');
const fixtures: Fixture[] = [];

function setup(opts: { skills?: boolean; mutate?: (f: Fixture) => void } = {}) {
  const f = makeFixture();
  fixtures.push(f);
  fs.mkdirSync(path.join(f.repoRoot, '.claude', 'agents'), { recursive: true });
  for (const a of AGENTS) fs.copyFileSync(path.join(REAL_AGENTS, `${a.name}.agent.md`), path.join(f.repoRoot, '.claude', 'agents', `${a.name}.agent.md`));
  if (opts.skills !== false) for (const s of SKILLS) f.write(`.claude/skills/${s.name}/SKILL.md`, fs.readFileSync(path.join(REAL_SKILLS, s.name, 'SKILL.md'), 'utf8'));
  opts.mutate?.(f);
  const ctx = loadContext({ forwardDir: FORWARD_DIR, configPath: f.configPath });
  runPlan(ctx, { runId: 'FWD-T3' });
  initWorkflow(ctx, 'FWD-T3');
  assert.equal(runPrecheck(loadWorkflow(ctx, 'FWD-T3'), 'EVIDENCE').status, 'PASS');
  assert.equal(advance(loadWorkflow(ctx, 'FWD-T3'), 'EVIDENCE_VALIDATED').accepted, true);
  return { f, ctx };
}

function packetFor(f: Fixture, ctx: RuntimeContext, agent: string) {
  const p = prepare(loadWorkflow(ctx, 'FWD-T3'), agent);
  return readPacket(f.repoRoot, f.runsDir, 'FWD-T3', p.packet_id);
}

function record(ctx: RuntimeContext, receiptPath: string) {
  return recordReceipt(loadWorkflow(ctx, 'FWD-T3'), receiptPath);
}

/** Runs produce -> mutate -> record and returns the verdict. */
function attempt(agent: 'F1' | 'F2', mutate: (docs: Record<string, any>, packet: any) => void, opts: Parameters<typeof setup>[0] = {}) {
  const { f, ctx } = setup(opts);
  const packet = packetFor(f, ctx, agent);
  assert.equal(packet.dispatchable, true, packet.blockers.join('; '));
  const docs = agent === 'F1' ? produceF1(f.repoRoot, packet) : produceF2(f.repoRoot, packet);
  mutate(docs, packet);
  return { f, ctx, packet, rec: record(ctx, writeDeliverables(f.repoRoot, packet, docs)) };
}

const violated = (rec: any, re: RegExp) => assert.ok(rec.verdict.violations.some((v: string) => re.test(v)), rec.verdict.violations.join(' | ') || 'no violations');

beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
});
afterEach(() => {
  while (fixtures.length) cleanup(fixtures.pop()!);
});

describe('S3-1/2. fourteen skills registered, two per agent', () => {
  test('all fourteen real skills validate and every agent owns exactly two', () => {
    const inv = validateSkillInventory(REAL_SKILLS);
    assert.equal(inv.skills.length, 14);
    assert.deepEqual(inv.skills.filter((s) => s.status !== 'INSTALLED').map((s) => `${s.name}: ${s.problems.join('; ')}`), []);
    assert.equal(inv.unexpected.length, 0);
    assert.equal(inv.duplicates.length, 0);
    assert.ok(inv.ownership.every((o) => o.ok && o.skills.length === 2));
    for (const a of AGENTS) assert.deepEqual(SKILLS.filter((s) => s.owner === a.id).map((s) => s.name).sort(), [...a.skills].sort());
    assert.equal(inv.ok, true);
  });
});

describe('S3-3. invalid skill metadata is rejected', () => {
  const variants: Array<[string, (t: string) => string, RegExp]> = [
    ['wrong front-matter name', (t) => t.replace('name: fe-source-grounded-requirements', 'name: fe-other'), /does not match directory/],
    ['wrong owner', (t) => t.replace('"owner_agent": "F1"', '"owner_agent": "F3"'), /does not match registry owner/],
    ['write scope escalation', (t) => t.replace('"write_scope": "agent_output_dir"', '"write_scope": "output"'), /write_scope/],
    ['unauthorised operation key', (t) => t.replace('"executes": []', '"executes": [], "neo4j_write": true'), /unsupported operations/],
    ['unauthorised execution', (t) => t.replace('"executes": []', '"executes": ["bash"]'), /unauthorised execution/],
    ['tool escalation', (t) => t.replace('allowed-tools: Read, Grep, Glob, Write', 'allowed-tools: Read, Grep, Glob, Write, Bash'), /exceed the owning agent/],
    ['missing section', (t) => t.replace('## Quality checks', '## Checks'), /missing section '## Quality checks'/],
    // Line-ending independent: a Windows checkout (core.autocrlf) holds the skill with CRLF.
    ['placeholder section', (t) => t.replace(/## Forbidden operations\r?\n\r?\n[\s\S]*?\r?\n\r?\n## Error/, '## Forbidden operations\n\nTBD\n\n## Error'), /too thin/],
    ['wrong contracts', (t) => t.replace('"output_contracts": ["forward/requirements", "forward/traceability-edges"]', '"output_contracts": ["forward/requirements"]'), /output_contracts/],
    ['broken metadata', (t) => t.replace('```json revforge-skill', '```json other'), /metadata block/],
  ];
  for (const [label, edit, re] of variants) {
    test(label, () => {
      const f = makeFixture();
      fixtures.push(f);
      const name = 'fe-source-grounded-requirements';
      f.write(`.claude/skills/${name}/SKILL.md`, edit(fs.readFileSync(path.join(REAL_SKILLS, name, 'SKILL.md'), 'utf8')));
      const s = validateSkill(path.join(f.repoRoot, '.claude', 'skills'), name);
      assert.equal(s.status, 'SKILL_INVALID');
      assert.ok(s.problems.some((p) => re.test(p)), s.problems.join(' | '));
    });
  }
});

describe('S3-4/5. missing, invalid and duplicate skills', () => {
  test('missing skills block dispatch; an invalid skill blocks dispatch as SKILL_INVALID', () => {
    const { f, ctx } = setup({
      skills: true,
      mutate: (fx) => fx.write('.claude/skills/fe-cobol-runtime-file-semantics/SKILL.md', '---\nname: fe-cobol-runtime-file-semantics\n---\nstub\n'),
    });
    const p2 = packetFor(f, ctx, 'F2');
    assert.equal(p2.dispatchable, false);
    assert.ok(p2.blockers.some((b: string) => /^SKILL_INVALID: fe-cobol-runtime-file-semantics/.test(b)));
    fs.rmSync(path.join(f.repoRoot, '.claude', 'skills', 'fe-source-grounded-requirements'), { recursive: true });
    const p1 = packetFor(f, ctx, 'F1');
    assert.ok(p1.blockers.some((b: string) => /^SKILL_NOT_INSTALLED: fe-source-grounded-requirements/.test(b)));
  });

  test('duplicate skill names and unexpected fe-* skill directories are rejected', () => {
    const f = makeFixture();
    fixtures.push(f);
    for (const s of SKILLS) f.write(`.claude/skills/${s.name}/SKILL.md`, fs.readFileSync(path.join(REAL_SKILLS, s.name, 'SKILL.md'), 'utf8'));
    f.write('.claude/skills/fe-impostor/SKILL.md', fs.readFileSync(path.join(REAL_SKILLS, 'fe-sprint-readiness', 'SKILL.md'), 'utf8'));
    const inv = validateSkillInventory(path.join(f.repoRoot, '.claude', 'skills'));
    assert.equal(inv.ok, false);
    assert.deepEqual(inv.unexpected, ['fe-impostor']);
    assert.ok(inv.duplicates.some((d) => d.startsWith('fe-sprint-readiness')));
    assert.equal(inv.skills.find((s) => s.name === 'fe-sprint-readiness')!.status, 'SKILL_INVALID');
  });
});

describe('S3-6/7/8. output contracts, source IDs and run bindings', () => {
  test('a reference F1 delivery is accepted with recorded provenance', () => {
    const { f, rec } = attempt('F1', () => undefined);
    assert.equal(rec.verdict.accepted, true, rec.verdict.violations.join(' | '));
    const prov = rec.verdict.provenance!;
    for (const o of prov.outputs) {
      assert.equal(o.runtime_sha256, sha256File(path.join(f.repoRoot, o.path)));
      assert.ok(o.contract?.startsWith('forward/'));
      assert.equal(o.schema_valid, true);
      assert.deepEqual(o.semantic_problems, []);
    }
    assert.ok(prov.skills.every((s) => /^[0-9a-f]{64}$/.test(s.sha256 ?? '')));
    assert.ok(/^[0-9a-f]{64}$/.test(prov.packet_sha256 ?? ''));
  });
  test('schema violation (requirement without source refs) is rejected', () => {
    const { rec } = attempt('F1', (d) => (d['draft_requirements.json'].requirements[0].source_refs = []));
    violated(rec, /violates forward\/requirements/);
  });
  test('fabricated permanent source ID is rejected', () => {
    const { rec } = attempt('F1', (d) => (d['draft_requirements.json'].requirements[0].source_refs[0].statement_id = 'SYS-TESTSYS-001-FIL-0002-STMT-999999'));
    violated(rec, /not present in the reverse inputs/);
  });
  test('a null File ID stays acceptable only where the contract allows it', () => {
    const { rec } = attempt('F1', (d) => (d['draft_requirements.json'].requirements[0].source_refs = [{ file_id: null }]));
    assert.equal(rec.verdict.accepted, true, rec.verdict.violations.join(' | '));
  });
  test('stale reverse-run binding is rejected', () => {
    const { rec } = attempt('F1', (d) => {
      const r = d['draft_requirements.json'];
      r.requirements[0].derived_from_rules[0].source_run = 'rules@5_rules@1.0#000000000000';
    });
    violated(rec, /not to a current reverse run \(stale\)/);
  });
  test('silently discarding an in-scope rule is rejected', () => {
    const { rec } = attempt('F1', (d) => {
      const r = d['draft_requirements.json'];
      r.rule_coverage = r.rule_coverage.filter((c: any) => c.disposition !== 'deferred_decision');
    });
    violated(rec, /silently discarded/);
  });
  test('upgrading confidence or dropping an SME flag is rejected', () => {
    const { rec } = attempt('F1', (d) => {
      const q = d['draft_requirements.json'].requirements.find((x: any) => x.confidence === 'medium');
      q.confidence = 'confirmed';
      q.evidence_class = 'confirmed';
    });
    violated(rec, /stronger than its weakest source rule|higher than its weakest source rule/);
  });
  test('claiming source verification without available source is rejected', () => {
    const { rec } = attempt('F1', (d) => (d['draft_requirements.json'].requirements[0].evidence_status = 'verified_from_source'));
    violated(rec, /verified_from_source/);
  });
  test('a wrong baseline digest in a deliverable is rejected', () => {
    const { rec } = attempt('F1', (d) => (d['evidence_references.json'].baseline.manifest_sha256 = 'f'.repeat(64)));
    violated(rec, /baseline manifest digest/);
  });
});

describe('S3-9. grouped gaps keep all affected items', () => {
  test('claiming all items while omitting one is rejected', () => {
    const { rec } = attempt('F1', (d) => {
      const g = d['uncertainty_decision_register.json'].decisions.find((x: any) => x.gap_refs.some((r: any) => r.items.length > 1)).gap_refs[0];
      g.items = g.items.slice(1);
    });
    violated(rec, /claims all items .* but omits some/);
  });
  test('an item from a different gap is rejected', () => {
    const { rec } = attempt('F1', (d) => d['uncertainty_decision_register.json'].decisions.find((x: any) => x.gap_refs.length).gap_refs[0].items.push('GAP-999#01'));
    violated(rec, /do not belong to/);
  });
  test('dropping a critical/high gap from the register is rejected', () => {
    const { rec } = attempt('F1', (d) => {
      const reg = d['uncertainty_decision_register.json'];
      reg.decisions = reg.decisions.filter((x: any) => !x.gap_refs.length);
      const blocking = reg.decisions.filter((x: any) => x.blocking).map((x: any) => x.decision_request_id);
      reg.blocker_report = { blocking_count: blocking.length, nonblocking_count: reg.decisions.length - blocking.length, blocking_decisions: blocking, summary: 'x' };
    });
    violated(rec, /critical\/high gap\(s\) in scope have no decision request/);
  });
});

/** Gives the fixture a real-looking numeric field and an unresolved copybook stub before planning. */
function dataMutation(f: Fixture) {
  const d = f.read('output/data/data_artifact.json');
  const fld = d.field_catalogue[0];
  Object.assign(fld, { normalized_type: 'SIGNED_DECIMAL', storage_type: 'PACKED_DECIMAL', length: 15, decimal_places: 2, signed: true, pic_raw: 'S9(13)V99 COMP-3', bytes: 8 });
  d.issues.push({ severity: 'warning', type: 'unresolved_copy_stub', file_id: f.programs[0].fileId, source_id: f.programs[0].name, line: 21, message: 'COPY MISSBOOK: copybook not in the inventory copybook_registry; stub left unresolved' });
  f.write('output/data/data_artifact.json', d);
}

describe('S3-10/11. copybook layouts and numeric mappings (F2)', () => {
  test('a reference F2 delivery is accepted', () => {
    const { rec } = attempt('F2', () => undefined, { mutate: dataMutation });
    assert.equal(rec.verdict.accepted, true, rec.verdict.violations.join(' | '));
  });
  test('a missing copybook must remain an unresolved finding', () => {
    const { rec } = attempt('F2', (d) => (d['data_mappings.json'].unresolved_findings = []), { mutate: dataMutation });
    violated(rec, /unresolved copybook MISSBOOK .* not reported/);
  });
  test('a fabricated record layout for the missing copybook is rejected', () => {
    const { rec } = attempt('F2', (d, p) => d['data_mappings.json'].records.push({ record_id: `${p.units[0].file_id}-REC-0042`, record_name: 'MISSBOOK-REC', owner: p.units[0], total_bytes: 10, length_evidence_status: 'inferred', fields: [], evidence_status: 'inferred' }), { mutate: dataMutation });
    violated(rec, /not present in the reverse inputs/);
  });
  test('a lossy numeric mapping is rejected; float/double are not even representable', () => {
    const { rec } = attempt('F2', (d) => {
      const fld = d['data_mappings.json'].records.flatMap((r: any) => r.fields).find((x: any) => x.decimals === 2);
      fld.java_type = 'long';
    }, { mutate: dataMutation });
    violated(rec, /java_type long is not a permitted mapping/);
    const { rec: rec2 } = attempt('F2', (d) => (d['data_mappings.json'].records.flatMap((r: any) => r.fields).find((x: any) => x.decimals === 2).java_type = 'double'), { mutate: dataMutation });
    violated(rec2, /violates forward\/data-contracts/);
    assert.deepEqual(allowedJavaTypes({ normalized_type: 'SIGNED_DECIMAL', storage_type: 'PACKED_DECIMAL', length: 15, decimal_places: 2 }), ['BigDecimal']);
    assert.deepEqual(allowedJavaTypes({ normalized_type: 'INTEGER', storage_type: 'DISPLAY', length: 20, decimal_places: 0 }), ['BigDecimal', 'BigInteger']);
    assert.deepEqual(allowedJavaTypes({ normalized_type: 'MYSTERY', storage_type: null, length: null, decimal_places: null }), []);
  });
  test('an unresolved representation must keep java_type null', () => {
    const { rec } = attempt('F2', (d) => {
      const fld = d['data_mappings.json'].records.flatMap((r: any) => r.fields).find((x: any) => x.java_type === null);
      fld.java_type = 'String';
      fld.evidence_status = 'inferred';
    }, { mutate: dataMutation });
    violated(rec, /not a permitted mapping|unsupported representation/);
  });
  test('omitting a catalogued field is rejected', () => {
    const { rec } = attempt('F2', (d) => (d['data_mappings.json'].records[0].fields = d['data_mappings.json'].records[0].fields.slice(1)), { mutate: dataMutation });
    violated(rec, /silently omitted/);
  });
});

describe('S3-12/13/14. writes, hashes and self-approval', () => {
  test('an output in another packet directory is rejected', () => {
    const { f, ctx } = setup();
    const p1 = packetFor(f, ctx, 'F1');
    const docs = produceF1(f.repoRoot, p1);
    const p1b = packetFor(f, ctx, 'F1');
    const moved = { ...p1, permissions: { ...p1.permissions, output_dir: p1b.permissions.output_dir } };
    const rec = record(ctx, writeDeliverables(f.repoRoot, { ...moved, receipt_path: p1.receipt_path }, docs));
    violated(rec, /outside this packet's output_dir/);
  });
  test('a stated hash that does not match is rejected; null hashes are sealed by the runtime', () => {
    const { f, ctx } = setup();
    const p = packetFor(f, ctx, 'F1');
    const rp = writeDeliverables(f.repoRoot, p, produceF1(f.repoRoot, p));
    const r = JSON.parse(fs.readFileSync(rp, 'utf8'));
    r.outputs[0].sha256 = 'a'.repeat(64);
    fs.writeFileSync(rp, JSON.stringify(r));
    violated(record(ctx, rp), /does not match its declared SHA-256/);
  });
  test('self-approval in a deliverable or a receipt is rejected', () => {
    const { rec } = attempt('F1', (d) => (d['draft_requirements.json'].requirements[0].approval_status = 'approved'));
    violated(rec, /asserts approvals|violates forward\/requirements/);
    const { rec: rec2 } = attempt('F1', (d) => (d['draft_requirements.json'].requirements[0].status = 'approved'));
    violated(rec2, /asserts approvals/);
  });
  test('a skill edited after dispatch invalidates the receipt', () => {
    const { f, ctx } = setup();
    const p = packetFor(f, ctx, 'F1');
    const rp = writeDeliverables(f.repoRoot, p, produceF1(f.repoRoot, p));
    fs.appendFileSync(path.join(f.repoRoot, '.claude', 'skills', 'fe-source-grounded-requirements', 'SKILL.md'), '\nextra\n');
    violated(record(ctx, rp), /changed after the packet was prepared/);
  });
});

describe('S3-15. F5 Java generation stays blocked', () => {
  test('F5 cannot be dispatched and cannot write Java even with valid skills', () => {
    const { ctx } = setup();
    assert.throws(() => prepare(loadWorkflow(ctx, 'FWD-T3'), 'F5'), /may only be dispatched/);
    const wf = loadWorkflow(ctx, 'FWD-T3');
    const d = canWrite(findAgent('F5')!, path.join(ctx.repoRoot, 'java', 'src', 'main', 'java', 'A.java'), policyRoots(wf.run, wf.state));
    assert.equal(d.allowed, false);
    for (const s of SKILLS.filter((x) => x.owner === 'F5')) assert.equal(s.write_scope, 'java_target_dir');
  });
});

describe('S3-19. batches and coverage ledger', () => {
  test('one accepted batch never completes the stage', () => {
    const { f, ctx } = setup();
    const packets = prepareBatches(loadWorkflow(ctx, 'FWD-T3'), 'F1', 1);
    assert.equal(packets.length, f.programs.length);
    const p0 = readPacket(f.repoRoot, f.runsDir, 'FWD-T3', packets[0].packet_id);
    assert.equal(record(ctx, writeDeliverables(f.repoRoot, p0, produceF1(f.repoRoot, p0))).verdict.accepted, true);
    const l = computeLedger(loadWorkflow(ctx, 'FWD-T3'), findAgent('F1')!);
    assert.equal(l.completed, 1);
    assert.equal(l.complete, false);
    const r = advance(loadWorkflow(ctx, 'FWD-T3'), 'REQUIREMENTS_DRAFTED');
    assert.equal(r.accepted, false);
    assert.match(r.reason, /coverage incomplete: 1\/\d+/);
    assert.equal(prepareBatches(loadWorkflow(ctx, 'FWD-T3'), 'F1', 1).length, 0, 'in-progress units are not re-batched');
    for (const p of packets.slice(1)) {
      const pk = readPacket(f.repoRoot, f.runsDir, 'FWD-T3', p.packet_id);
      assert.equal(record(ctx, writeDeliverables(f.repoRoot, pk, produceF1(f.repoRoot, pk))).verdict.accepted, true);
    }
    assert.equal(computeLedger(loadWorkflow(ctx, 'FWD-T3'), findAgent('F1')!).complete, true);
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T3'), 'REQUIREMENTS_DRAFTED').accepted, true);
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T3'), 'REQUIREMENTS_APPROVED').accepted, false, 'no self-approval path');
  });
});

describe('S3-19b. copybook-only batches', () => {
  test('a batch of copybook units is dispatchable and draws evidence from including programs', () => {
    const { f, ctx } = setup();
    const p = prepare(loadWorkflow(ctx, 'FWD-T3'), 'F2', { units: f.copybooks.map((c) => ({ unit_kind: 'copybook' as const, name: c.name, file_id: c.fileId })) });
    assert.equal(p.dispatchable, true, p.blockers.join('; '));
    assert.ok(p.inputs.find((i) => i.kind === 'plan:evidence_packets')!.files.length > 0);
    const pk = readPacket(f.repoRoot, f.runsDir, 'FWD-T3', p.packet_id);
    assert.equal(record(ctx, writeDeliverables(f.repoRoot, pk, produceF2(f.repoRoot, pk))).verdict.accepted, true);
  });
});

describe('S3-git. narrow protection for forward additions', () => {
  test('only the declared agent files and skill directories are allowed additions', () => {
    const allowed = allowedForwardAdditions();
    assert.equal(allowed.filter((p) => p.startsWith('.claude/skills/')).length, 14);
    assert.equal(allowed.filter((p) => p.startsWith('.claude/agents/')).length, 7);
    assert.ok(!allowed.includes('.claude/skills/'));
    const info = gitInfo(REPO, ['.claude/agents/', '.claude/skills/', 'output/']);
    if (info.available) assert.deepEqual(info.reverse_paths_changed, [], 'real repository: reverse harness untouched');
  });
});

describe('S3-16/17. real reverse artifacts: F1 and F2 batches through the runtime', () => {
  const realCtx = () => {
    const runsDir = path.join(FORWARD_DIR, 'tests', '.tmp', 'runs-s3');
    fs.rmSync(runsDir, { recursive: true, force: true });
    return loadContext({ forwardDir: FORWARD_DIR, runsDir });
  };
  test('F1: every reverse rule is in some batch scope and a real batch is accepted', (t) => {
    if (!fs.existsSync(path.join(REPO, 'output', 'rules', 'rules_artifact.json'))) return t.skip('no reverse artifacts');
    const ctx = realCtx();
    runPlan(ctx, { runId: 'FWD-T3-REAL' });
    initWorkflow(ctx, 'FWD-T3-REAL');
    assert.equal(runPrecheck(loadWorkflow(ctx, 'FWD-T3-REAL'), 'EVIDENCE').status, 'PASS');
    assert.equal(advance(loadWorkflow(ctx, 'FWD-T3-REAL'), 'EVIDENCE_VALIDATED').accepted, true);
    const ps = prepareBatches(loadWorkflow(ctx, 'FWD-T3-REAL'), 'F1', 14);
    assert.ok(ps.length > 1 && ps.every((p) => p.dispatchable));
    const rules = JSON.parse(fs.readFileSync(path.join(REPO, 'output', 'rules', 'rules_artifact.json'), 'utf8')).business_rules.map((r: any) => r.rule_id);
    const covered = new Set(ps.flatMap((p) => p.scope.rules_in_scope));
    assert.deepEqual(rules.filter((r: string) => !covered.has(r)), [], 'no reverse rule falls outside every batch');
    const p0 = JSON.parse(fs.readFileSync(path.join(ctx.runsDir, 'FWD-T3-REAL', 'workflow', 'packets', `${ps[0].packet_id}.json`), 'utf8'));
    const rec = recordReceipt(loadWorkflow(ctx, 'FWD-T3-REAL'), writeDeliverables(REPO, p0, produceF1(REPO, p0)));
    assert.equal(rec.verdict.accepted, true, rec.verdict.violations.slice(0, 5).join(' | '));
    const l = computeLedger(loadWorkflow(ctx, 'FWD-T3-REAL'), findAgent('F1')!);
    assert.equal(l.complete, false);
    assert.equal(l.completed, ps[0].units.length);
  });

  test('F2: a real data batch (programs and copybooks) is accepted and copybook stubs stay unresolved', (t) => {
    if (!fs.existsSync(path.join(REPO, 'output', 'data', 'data_artifact.json'))) return t.skip('no reverse artifacts');
    const ctx = realCtx();
    runPlan(ctx, { runId: 'FWD-T3-REAL2' });
    initWorkflow(ctx, 'FWD-T3-REAL2');
    runPrecheck(loadWorkflow(ctx, 'FWD-T3-REAL2'), 'EVIDENCE');
    advance(loadWorkflow(ctx, 'FWD-T3-REAL2'), 'EVIDENCE_VALIDATED');
    const ps = prepareBatches(loadWorkflow(ctx, 'FWD-T3-REAL2'), 'F2', 100);
    assert.equal(ps.length, 1);
    const p = JSON.parse(fs.readFileSync(path.join(ctx.runsDir, 'FWD-T3-REAL2', 'workflow', 'packets', `${ps[0].packet_id}.json`), 'utf8'));
    assert.ok(p.units.some((u: any) => u.unit_kind === 'copybook') && p.units.some((u: any) => u.unit_kind === 'program'));
    const docs = produceF2(REPO, p);
    const ok = recordReceipt(loadWorkflow(ctx, 'FWD-T3-REAL2'), writeDeliverables(REPO, p, docs));
    assert.equal(ok.verdict.accepted, true, ok.verdict.violations.slice(0, 5).join(' | '));
    fs.rmSync(path.join(FORWARD_DIR, 'tests', '.tmp'), { recursive: true, force: true });
  });
});
