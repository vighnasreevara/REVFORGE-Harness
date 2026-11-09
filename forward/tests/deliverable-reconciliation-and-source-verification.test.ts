import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadContext, RuntimeContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { runPlan } from '../runtime/src/commands/plan';
import { AGENTS } from '../runtime/src/orchestrator/agents';
import { advance, initWorkflow, loadWorkflow, prepare, prepareBatches, recordReceipt, runGate, runPrecheck } from '../runtime/src/orchestrator/orchestrator';
import { SKILLS } from '../runtime/src/orchestrator/skills';
import { claimLiterals, consolidate, correct, Ctx, loadTrackedIssues, reconcile, recordAccess, statementForLine, verifyField, verifySources, verifyTextClaim } from '../runtime/src/remediation/remediation';
import { accessFor, parseTranscript } from '../runtime/src/remediation/transcripts';
import { cleanup, Fixture, FORWARD_DIR, makeFixture } from './helpers/fixture';
import { produceF1, produceF2, readPacket, writeDeliverables } from './helpers/outputs';

const REPO = path.resolve(FORWARD_DIR, '..');
const fixtures: Fixture[] = [];
const tmpDirs: string[] = [];
const RUN = 'FWD-T35';

function setup(opts: { mutate?: (f: Fixture) => void; withSource?: boolean } = {}) {
  const f = makeFixture({ withSource: opts.withSource });
  fixtures.push(f);
  fs.mkdirSync(path.join(f.repoRoot, '.claude', 'agents'), { recursive: true });
  for (const a of AGENTS) fs.copyFileSync(path.join(REPO, 'forward', 'agents', `${a.name}.agent.md`), path.join(f.repoRoot, '.claude', 'agents', `${a.name}.agent.md`));
  for (const s of SKILLS) f.write(`.claude/skills/${s.name}/SKILL.md`, fs.readFileSync(path.join(REPO, 'forward', 'skills', s.name, 'SKILL.md'), 'utf8'));
  opts.mutate?.(f);
  if (opts.withSource) process.env.REVFORGE_COBOL_SOURCE_ROOT = f.sourceRoot;
  const ctx = loadContext({ forwardDir: FORWARD_DIR, configPath: f.configPath });
  runPlan(ctx, { runId: RUN });
  initWorkflow(ctx, RUN);
  assert.equal(runPrecheck(loadWorkflow(ctx, RUN), 'EVIDENCE').status, 'PASS');
  assert.equal(advance(loadWorkflow(ctx, RUN), 'EVIDENCE_VALIDATED').accepted, true);
  return { f, ctx };
}
const wf = (ctx: RuntimeContext) => loadWorkflow(ctx, RUN);
const pk = (f: Fixture, id: string) => readPacket(f.repoRoot, f.runsDir, RUN, id);

/** Adds a copybook-declared rule that is in scope of every program (so it appears in every F1 batch). */
function sharedCopybookRule(f: Fixture) {
  const rules = f.read('output/rules/rules_artifact.json');
  const cb = f.copybooks[0];
  const ids = { system_id: f.systemId, file_id: cb.fileId, path_id: cb.pathId, program_id: null, section_id: null, paragraph_id: null, statement_id: null };
  rules.business_rules.push({ rule_id: 'BR-004', rule_set_id: 'RS-001', name: 'Declared status domain', category: 'VALIDATION', confidence: 'medium', requires_sme_review: false, outcomes: { result: 'declared value domain; never tested' }, primary_source: { program_id: null, copybook: cb.name, source_ids: ids }, sources: [{ program_id: null, copybook: cb.name, evidence: 'complete', source_ids: ids }], implemented_in_programs: [] });
  rules.rule_sets[0].rule_ids.push('BR-004');
  for (const p of f.programs) rules.rules_by_program[p.name] = [...(rules.rules_by_program[p.name] ?? []), 'BR-004'];
  f.write('output/rules/rules_artifact.json', rules);
}

/** Turns the BR-004 disposition of an F1 delivery into not_a_requirement (a different, still valid interpretation). */
function declineBR004(docs: Record<string, any>) {
  const r = docs['draft_requirements.json'];
  const drop = new Set(r.requirements.filter((q: any) => q.derived_from_rules.some((x: any) => x.id === 'BR-004')).map((q: any) => q.requirement_id));
  r.requirements = r.requirements.filter((q: any) => !drop.has(q.requirement_id));
  for (const c of r.rule_coverage) if (c.rule.id === 'BR-004') Object.assign(c, { disposition: 'not_a_requirement', requirement_ids: [], reason: 'declared domain never tested by code' });
  const n = (d: string) => r.rule_coverage.filter((c: any) => c.disposition === d).length;
  r.coverage_summary = { rules_in_scope: r.rule_coverage.length, mapped: n('mapped'), deferred: n('deferred_scope') + n('deferred_decision'), not_a_requirement: n('not_a_requirement'), contradictory: n('contradictory'), requirements: r.requirements.length };
  const e = docs['evidence_references.json'];
  e.edges = e.edges.filter((x: any) => !(x.to.kind === 'requirement' && drop.has(x.to.id)) && !(x.from.kind === 'requirement' && drop.has(x.from.id)));
}

beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
});
afterEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  while (fixtures.length) cleanup(fixtures.pop()!);
  while (tmpDirs.length) fs.rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe('S35-A. numerical reconciliation (per-ID accounting)', () => {
  test('batch entries reconcile to canonical rules; conflicting duplicates and a wrong reported decision count are flagged', () => {
    const { f, ctx } = setup({ mutate: sharedCopybookRule });
    const ps = prepareBatches(wf(ctx), 'F1', 1);
    assert.equal(ps.length, f.programs.length);
    ps.forEach((p, i) => {
      const packet = pk(f, p.packet_id);
      const docs = produceF1(f.repoRoot, packet);
      if (i === 1) declineBR004(docs);
      const rec = recordReceipt(wf(ctx), writeDeliverables(f.repoRoot, packet, docs));
      assert.equal(rec.verdict.accepted, true, rec.verdict.violations.join(' | '));
    });
    const actual = reconcile(wf(ctx), { decisions: 999 });
    const br4 = actual.per_rule.find((r: any) => r.rule_id === 'BR-004');
    assert.equal(br4.entry_count, f.programs.length);
    assert.equal(br4.status, 'duplicate_conflicting');
    assert.match(br4.multi_entry_reason, /copybook-declared rule/);
    assert.equal(actual.rules.balanced, true);
    assert.equal(actual.rules.coverage_entries, actual.rules.canonical + actual.rules.extra_entries);
    assert.deepEqual(actual.rules.missing, []);
    assert.equal(actual.decisions.reported_matches, false, 'a wrong reported total is not silently accepted');
    assert.equal(actual.decisions.unique_ids, actual.decisions.total);
  });
});

describe('S35-C. access evidence and provenance supplements', () => {
  test('transcript access levels distinguish read, other lines, file grep, directory grep, failed reads and none', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-tr-'));
    tmpDirs.push(dir);
    const file = path.join(dir, 'src', 'A.cbl');
    const other = path.join(dir, 'src', 'B.cbl');
    const failed = path.join(dir, 'src', 'C.cbl');
    const lines = [
      { agentId: 'x1', message: { content: [{ type: 'tool_use', id: 't1', name: 'Read', input: { file_path: file, offset: 10, limit: 5 } }] } },
      { message: { content: [{ type: 'tool_use', id: 't2', name: 'Grep', input: { path: other, pattern: 'X' } }] } },
      { message: { content: [{ type: 'tool_use', id: 't3', name: 'Grep', input: { path: path.join(dir, 'src'), pattern: 'Y' } }] } },
      { message: { content: [{ type: 'tool_use', id: 't4', name: 'Read', input: { file_path: failed } }] } },
      { message: { content: [{ type: 'tool_result', tool_use_id: 't4', is_error: true, content: 'not found' }] } },
    ];
    const tf = path.join(dir, 't.jsonl');
    fs.writeFileSync(tf, lines.map((l) => JSON.stringify(l)).join('\n'));
    const t = parseTranscript(tf);
    assert.equal(t.agent_id, 'x1');
    assert.equal(accessFor(t, file, [12]), 'read_covering_citation');
    assert.equal(accessFor(t, file, [40]), 'file_read_other_lines');
    assert.equal(accessFor(t, other), 'grep_only');
    assert.equal(accessFor(t, path.join(dir, 'src', 'D.cbl')), 'grep_directory_only');
    assert.equal(accessFor(t, failed), 'grep_directory_only', 'a failed Read is not access');
    assert.equal(accessFor(t, path.join(dir, 'elsewhere.cbl')), 'not_demonstrated');
    assert.equal(accessFor(null, file), 'not_demonstrated');
  });

  test('declared inputs_used without transcript evidence are recorded as not evidenced; the receipt is not rewritten; records are versioned', () => {
    const { f, ctx } = setup();
    const p = prepare(wf(ctx), 'F1');
    const packet = pk(f, p.packet_id);
    const rec = recordReceipt(wf(ctx), writeDeliverables(f.repoRoot, packet, produceF1(f.repoRoot, packet)));
    assert.equal(rec.verdict.accepted, true);
    const receiptFile = path.join(f.runsDir, RUN, 'workflow', 'receipts', `${rec.receipt_id}.json`);
    const before = sha256File(receiptFile);
    const tf = path.join(f.repoRoot, 'transcript.jsonl');
    fs.writeFileSync(tf, JSON.stringify({ agentId: 'y', message: { content: [{ type: 'tool_use', id: 'r1', name: 'Read', input: { file_path: path.join(f.runsDir, RUN, 'workflow', 'packets', `${p.packet_id}.json`) } }] } }));
    const a1 = recordAccess(wf(ctx), p.packet_id, tf);
    assert.equal(a1.provenance_status, 'declared_inputs_not_evidenced');
    assert.ok(a1.provenance_by_output.every((d: any) => d.declared_not_read.length > 0));
    assert.equal(sha256File(receiptFile), before, 'historical receipt unchanged');
    const a2 = recordAccess(wf(ctx), p.packet_id, tf);
    assert.notEqual(a1.id, a2.id, 'a new version, not an overwrite');
  });

  test('future receipts record supplied inputs, declared reads and access status separately', () => {
    const { f, ctx } = setup();
    const p = prepare(wf(ctx), 'F1');
    const packet = pk(f, p.packet_id);
    const rp = writeDeliverables(f.repoRoot, packet, produceF1(f.repoRoot, packet), { declared_reads: [packet.inputs[0].files[0].path] });
    const rec = recordReceipt(wf(ctx), rp);
    assert.equal(rec.verdict.accepted, true, rec.verdict.violations.join(' | '));
    const acc = rec.verdict.provenance!.access!;
    assert.ok(acc.inputs_supplied > 1);
    assert.deepEqual(acc.declared_reads, [packet.inputs[0].files[0].path]);
    assert.ok(acc.inputs_used_declared >= 1);
    assert.equal(acc.status, 'agent_declared_unverified');
  });
});

describe('S35-B. independent source verification', () => {
  const COPY = [
    '      * test copybook',
    '       01  REC-A.',
    '           05  F-ID          PIC X(8).',
    '           05  F-AMT         PIC S9(13)V99 COMP-3.',
    '           05  F-CNT         PIC 9(4) COMP.',
    '           05  F-STAT        PIC X(1).',
    '               88  F-OK      VALUE \'A\'.',
  ];
  const PROG = Array.from({ length: 30 }, (_, i) => (i === 19 ? "           IF WS-CODE = 'INIT'" : i === 20 ? '              MOVE 1000 TO WS-LIMIT' : i === 21 ? '           END-IF.' : '      *'));
  function ctx(): Ctx {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-src-'));
    tmpDirs.push(root);
    fs.mkdirSync(path.join(root, 'cp'), { recursive: true });
    fs.writeFileSync(path.join(root, 'cp', 'RECA.cpy'), COPY.join('\n'));
    fs.writeFileSync(path.join(root, 'cp', 'PROG.cbl'), PROG.join('\n'));
    const item = (id: string, name: string, line: number, extra: any = {}) => ({ field_id: id, name, level: 5, line, ...extra });
    const children = [item('F-1', 'F-ID', 3), item('F-2', 'F-AMT', 4), item('F-3', 'F-CNT', 5), item('F-4', 'F-STAT', 6, { children: [{ field_id: 'F-5', name: 'F-OK', level: 88, line: 7, is_condition: true }] })];
    const rec = { record_id: 'R-1', children, file_id: 'CB' };
    const layoutItems = new Map<string, any>();
    for (const it of children) layoutItems.set(it.field_id, { file_id: 'CB', record_id: 'R-1', item: it, line: it.line });
    layoutItems.set('F-5', { file_id: 'CB', record_id: 'R-1', item: children[3].children![0], line: 7 });
    return {
      srcRoot: root,
      relByFile: new Map([['CB', 'cp/RECA.cpy'], ['PG', 'cp/PROG.cbl']]),
      files: new Map(),
      statements: new Map([['S-1', { statement_id: 'S-1', statement_type: 'IF', start_line: 20, end_line: 22, file_id: 'PG' }], ['S-2', { statement_id: 'S-2', statement_type: 'MOVE', start_line: 21, end_line: 21, file_id: 'PG' }]]),
      paragraphs: new Map(),
      layoutItems,
      layoutRecords: new Map([['R-1', rec]]),
    } as Ctx;
  }
  const base = { field_name: 'F-AMT', level: 5, pic: 'S9(13)V99 COMP-3', usage: 'PACKED_DECIMAL', byte_length: 8, occurs: null, offset: 8, offset_basis: 'verified_from_source', cobol_category: 'numeric_packed' };

  test('a correct field claim (PIC, usage, size, offset) is verified from the source text', () => {
    assert.equal(verifyField(ctx(), { field_id: 'F-2', ...base }).result, 'verified');
    assert.equal(verifyField(ctx(), { field_id: 'F-3', field_name: 'F-CNT', level: 5, pic: '9(4)', usage: 'BINARY', byte_length: 2, offset: 16, offset_basis: 'verified_from_source' }).result, 'verified');
    assert.equal(verifyField(ctx(), { field_id: 'F-5', field_name: 'F-OK', level: 88, cobol_category: 'condition' }).result, 'verified');
  });
  test('wrong PIC, usage, size or offset is contradicted', () => {
    for (const bad of [{ pic: 'S9(11)V99 COMP-3' }, { usage: 'DISPLAY' }, { byte_length: 15 }, { offset: 9 }, { field_name: 'F-OTHER' }, { level: 10 }]) {
      const r = verifyField(ctx(), { field_id: 'F-2', ...base, ...bad });
      assert.equal(r.result, 'contradicted', JSON.stringify(bad));
    }
  });
  test('missing source or unknown field is unverified, never verified', () => {
    const c = ctx();
    c.srcRoot = null;
    assert.equal(verifyField(c, { field_id: 'F-2', ...base }).result, 'unverified');
    assert.equal(verifyField(ctx(), { field_id: 'F-404', ...base }).result, 'unverified');
  });
  test('text claims: supported, misplaced citation, unsupported literal, no locatable reference', () => {
    assert.equal(verifyTextClaim(ctx(), "When the code is 'INIT' the limit becomes 1000", [{ file_id: 'PG', statement_id: 'S-1', line: 21 }]).result, 'verified');
    assert.equal(verifyTextClaim(ctx(), "When the code is 'INIT'", [{ file_id: 'PG', statement_id: 'S-1', line: 25 }]).result, 'contradicted');
    assert.equal(verifyTextClaim(ctx(), "When the code is 'TERM'", [{ file_id: 'PG', statement_id: 'S-1' }]).result, 'unverified');
    assert.equal(verifyTextClaim(ctx(), "When the code is 'INIT'", [{ file_id: 'PG' }]).result, 'unverified');
    assert.equal(verifyTextClaim(ctx(), "When the code is 'INIT'", [{ file_id: 'PG', statement_id: 'S-404' }]).result, 'contradicted');
  });
  test('literal extraction ignores possessive apostrophes (regression)', () => {
    assert.deepEqual(claimLiterals("BCHCTL00's code 'INIT' sets mode 'I'; the program's limit is 1000"), ['INIT', 'I', '1000']);
  });
  test('statementForLine picks the innermost statement covering the line', () => {
    const st = [{ statement_id: 'IF', file_id: 'P', start_line: 180, end_line: 188 }, { statement_id: 'ADD', file_id: 'P', start_line: 183, end_line: 183 }, { statement_id: 'X', file_id: 'Q', start_line: 183, end_line: 183 }];
    assert.equal(statementForLine(st, 'P', 183).statement_id, 'ADD');
    assert.equal(statementForLine(st, 'P', 181).statement_id, 'IF');
    assert.equal(statementForLine(st, 'P', 300), null);
  });
  test('verify-sources keeps source availability, demonstrated access and claim verification as separate statuses', () => {
    const { f, ctx: c } = setup({ withSource: true });
    const p = prepare(wf(c), 'F1');
    const packet = pk(f, p.packet_id);
    assert.equal(packet.source.available, true);
    const docs = produceF1(f.repoRoot, packet);
    docs['draft_requirements.json'].requirements[0].evidence_status = 'verified_from_source';
    assert.equal(recordReceipt(wf(c), writeDeliverables(f.repoRoot, packet, docs)).verdict.accepted, true);
    const v = verifySources(wf(c));
    const claim = v.claims.find((x: any) => x.kind === 'requirement');
    assert.equal(claim.source_available, true);
    assert.deepEqual(claim.access_demonstrated, ['no_transcript']);
    assert.notEqual(claim.claim_verification, 'verified', 'the synthetic statement IDs do not exist in the parser structure');
    assert.notEqual(claim.effective_status, 'verified_from_source');
  });
});

describe('S35-D/E. corrections, consolidation and retained issues', () => {
  test('a count correction is computed by the runtime, versioned, validated, and leaves the original untouched; a non-error is refused', () => {
    const { f, ctx } = setup();
    const p = prepare(wf(ctx), 'F2');
    const packet = pk(f, p.packet_id);
    const docs = produceF2(f.repoRoot, packet);
    docs['data_mappings.json'].unresolved_findings = [{ finding_id: 'UF-1', description: 'Two items are unresolved (A; B; C)', evidence_status: 'unresolved', source_refs: [{ file_id: f.programs[0].fileId }, { file_id: f.programs[1].fileId }, { file_id: f.programs[2].fileId }] }];
    const rec = recordReceipt(wf(ctx), writeDeliverables(f.repoRoot, packet, docs));
    assert.equal(rec.verdict.accepted, true, rec.verdict.violations.join(' | '));
    const orig = path.join(f.repoRoot, packet.permissions.output_dir, 'data_mappings.json');
    const before = sha256File(orig);
    const c = correct(wf(ctx), { packet: p.packet_id, file: 'data_mappings.json', pointer: '/unresolved_findings/0/description', kind: 'count_word', count_pointer: '/unresolved_findings/0/source_refs', reason: 'count disagrees with listed items' });
    assert.equal(c.new_value, 'Three items are unresolved (A; B; C)');
    assert.equal(c.evidence.actual_count, 3);
    assert.equal(c.validation.valid, true);
    assert.equal(sha256File(orig), before);
    assert.equal(c.target.original_sha256, before);
    assert.ok(fs.existsSync(path.join(f.repoRoot, c.applied_copy.path)));
    assert.throws(() => correct(wf(ctx), { packet: p.packet_id, file: 'data_mappings.json', pointer: '/unresolved_findings/0/description', kind: 'count_word', count_pointer: '/unresolved_findings/0/source_refs', reason: 'again' }), /nothing to correct/);
    assert.throws(() => correct(wf(ctx), { packet: p.packet_id, file: 'not_an_output.json', pointer: '/x', kind: 'count_word', count_pointer: '/y', reason: 'x' }), /not an output/);
    const cons = consolidate(wf(ctx));
    const used = cons.inputs.flatMap((i: any) => i.documents).find((d: any) => d.path.endsWith('data_mappings.json'));
    assert.equal(used.used, c.applied_copy.path, 'consolidation reads the corrected version');
    assert.equal(cons.corrections_applied.length, 1);
  });

  test('cross-batch disagreements become open blocking SME decisions; nothing is auto-resolved', () => {
    const { f, ctx } = setup({ mutate: sharedCopybookRule });
    prepareBatches(wf(ctx), 'F1', 1).forEach((p, i) => {
      const packet = pk(f, p.packet_id);
      const docs = produceF1(f.repoRoot, packet);
      if (i === 0) declineBR004(docs);
      assert.equal(recordReceipt(wf(ctx), writeDeliverables(f.repoRoot, packet, docs)).verdict.accepted, true);
    });
    const issues = path.join(f.repoRoot, 'tracked-issues.json');
    fs.writeFileSync(issues, JSON.stringify({ issues: [{ issue: 'status domain', patterns: ['BR-004', 'domain'] }, { issue: 'absent', patterns: ['NO-SUCH-THING'] }] }));
    const cons = consolidate(wf(ctx), { trackedIssuesFile: issues });
    assert.deepEqual(cons.retained_issues.map((r: any) => [r.issue, r.status, r.decisions]), [['status domain', 'SME_BLOCKED', ['DR-CONSOLIDATION-001']], ['absent', 'NOT_FOUND', []]]);
    assert.equal(cons.tracked_issues_source.sha256, sha256File(issues));
    assert.equal(cons.rules.conflicts.length, 1);
    const conflict = cons.rules.conflicts[0];
    assert.equal(conflict.rule_id, 'BR-004');
    assert.equal(conflict.resolution, 'SME_DECISION');
    assert.equal(conflict.auto_corrected, false);
    assert.deepEqual(conflict.reverse_artifact.outcomes, { result: 'declared value domain; never tested' });
    const d = cons.register.find((x: any) => x.decision_request_id === 'DR-CONSOLIDATION-001');
    assert.ok(d && d.blocking && d.status === 'open');
    assert.equal(cons.decisions.total, cons.decisions.original + 1);
  });

  test('the shipped tracked-issue patterns are well-formed regexes with no control characters (regression: "\\b" stored as backspace)', () => {
    const t = loadTrackedIssues(path.join(FORWARD_DIR, 'config', 'tracked-issues.json'));
    assert.ok(t.issues.length > 0);
    for (const i of t.issues) for (const p of i.patterns) assert.ok(!/[\x00-\x1f]/.test(p.source), `${i.issue}: pattern ${JSON.stringify(p.source)} contains a control character`);
    const len = t.issues.find((i) => i.patterns.some((p) => p.test('103') && !p.test('1030')));
    assert.ok(len, 'a word-boundary pattern still matches its number');
  });
});
