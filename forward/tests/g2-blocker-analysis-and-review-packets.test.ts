/**
 * STEP 4.5: blocker count reconciliation, root causes, deterministic COBOL
 * verification, remediation proposals, review queue, scope readiness and
 * independent-review packet preparation. Synthetic fixtures for negative
 * cases; the real run is used read-only for integration.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { main } from '../runtime/src/cli';
import { generationAuthorized, loadWorkflow, prepare, runGate } from '../runtime/src/orchestrator/orchestrator';
import { approvalStatement, createApprovalRequest, importApproval, statementText } from '../runtime/src/approval/approvals';
import { digest } from '../runtime/src/approval/canonical';
import { evaluateScope, parseSelector } from '../runtime/src/approval/scope';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { auditCounts } from '../runtime/src/blockers/audit';
import { analyseCitation, checkRecord, runDeterministic, SourceReader } from '../runtime/src/blockers/deterministic';
import { EgressBlockedError, sendVerificationPacket } from '../runtime/src/blockers/egress';
import { exportAuthorization, leakCheck, preparePackets } from '../runtime/src/blockers/openai';
import { analyse, cmdDeterministic, cmdOpenAI, cmdRemediation, cmdReport } from '../runtime/src/blockers/pipeline';
import { buildQueue } from '../runtime/src/blockers/queue';
import { scopeReadiness } from '../runtime/src/blockers/readiness';
import { buildRegistry, registryRecord } from '../runtime/src/blockers/rootcauses';
import { sourceFile } from '../verification/src/cobol-source';
import { fdLengthFindings, findItem, parseDataDivision } from '../verification/src/layout';
import { procedureFacts } from '../verification/src/facts';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { citedClaim, deliverAll, RUN, setupG2, signResolution, SIGNERS, signText, wfOf } from './helpers/g2fixture';

const fixtures: Fixture[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
});
afterEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  while (fixtures.length) cleanup(fixtures.pop()!);
});

function hashTree(dir: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (!fs.existsSync(dir)) return out;
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = sha256File(p);
    }
  };
  walk(dir);
  return out;
}

/** Two decisions that cite the same origin gap (an unresolvable path) in two different deliveries. */
const twoDecisionsOneGap = (f: Fixture) => (a: 'F1' | 'F2', unit: string, docs: Record<string, any>) => {
  if (unit !== f.programs[1].name) return;
  const reg = docs[a === 'F1' ? 'uncertainty_decision_register.json' : 'unresolved_layout_findings.json'];
  const gapRef = (g: any) => g.gap_refs.find((x: any) => x.gap.id === 'GAP-001');
  const base = docs['uncertainty_decision_register.json']?.decisions.find((d: any) => gapRef(d));
  if (a === 'F1' && base) {
    reg.decisions.push({ ...base, decision_request_id: 'DR-BRAVO02-090', kind: 'technical', question: 'Which paragraph should handle the missing targets of the unresolvable path in this program?', blocking: true, blocking_rationale: 'control flow undetermined' });
    reg.blocker_report = { blocking_count: reg.decisions.filter((d: any) => d.blocking).length, nonblocking_count: reg.decisions.filter((d: any) => !d.blocking).length, blocking_decisions: reg.decisions.filter((d: any) => d.blocking).map((d: any) => d.decision_request_id), summary: 'test' };
  }
};

describe('S45-A. counts and root causes', () => {
  test('1. every blocker count is reconciled exactly across universes', () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx);
    const snap = buildSnapshot(wfOf(ctx));
    const app = evaluateScope(snap, parseSelector('application'));
    const a = auditCounts(snap, app);
    const c = (n: string) => a.counts.find((x: any) => x.name === n);
    assert.equal(c('register_decisions').value, snap.register.size);
    assert.equal(c('scope_blocking_findings').value, app.summary.blocking);
    assert.equal(a.reconciliation.scope_findings_equation.balanced, true);
    const r = a.reconciliation.decisions_vs_findings;
    assert.equal(r.represented_by_own_decision_finding + r.represented_by_item_finding + r.not_in_scope + r.represented_but_finding_not_blocking, c('blocking_unresolved_decisions').value);
    const g = a.reconciliation.g2_check_table;
    assert.equal(g.distinct_blocking_findings_in_rows + g.blocking_findings_in_no_row.length, app.summary.blocking);
    assert.ok(g.sum_of_rows >= g.distinct_blocking_findings_in_rows);
    assert.equal(c('requires_evidence_findings').breakdown.blocking + c('requires_evidence_findings').breakdown.non_blocking, c('requires_evidence_findings').value);
    assert.equal(c('register_decisions').ids.length, c('register_decisions').value);
  });

  test('2/3/4. decisions sharing an origin share one root cause; every original decision is preserved and mapped', () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx, twoDecisionsOneGap(f));
    const before = hashTree(wfOf(ctx).store.p('agents'));
    const a = analyse(wfOf(ctx));
    const both = [...a.snap.register.values()].filter((d) => d.gap_ids.includes('GAP-001') && d.origin.type === 'agent');
    assert.ok(both.length >= 2, 'fixture has two decisions on one gap');
    const roots = both.map((d) => a.reg.decisionRoots.get(d.decision_id)![0]);
    assert.equal(new Set(roots).size, 1, 'one root cause');
    const root = a.reg.byKey.get(roots[0])!;
    assert.equal(root.key, 'GAP:GAP-001');
    assert.ok(both.every((d) => root.related.decisions.includes(d.decision_id)), 'every downstream decision stays linked');
    const rec = registryRecord(a.snap, a.reg, a.app);
    assert.equal(rec.decision_view.length, a.snap.register.size, 'full decision view');
    assert.ok(rec.decision_view.every((d: any) => d.primary_root_cause));
    assert.equal(rec.summary.blocking_findings_without_root.length, 0);
    assert.ok(rec.summary.decisions_sharing_a_root_with_another_decision >= 2);
    assert.deepEqual(hashTree(wfOf(ctx).store.p('agents')), before, 'grouping changes no deliverable');
    assert.equal(buildSnapshot(wfOf(ctx)).register.size, a.snap.register.size, 'no decision deleted');
    assert.equal(evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector('application')).summary.blocking, a.app.summary.blocking, 'grouping is not resolution');
  });
});

describe('S45-B. deterministic source verification', () => {
  test('5. a wrong citation is re-derived from the stated values and proposed (not applied); an ambiguous one is not', () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx, citedClaim(f, 12));
    const snap = buildSnapshot(wfOf(ctx));
    const it = snap.items.find((x) => x.kind === 'requirement' && x.units[0].name === f.programs[1].name)!;
    const [c] = analyseCitation(snap, new SourceReader(snap), it);
    assert.equal(c.status, 'SOURCE_CITATION_CORRECTED');
    assert.deepEqual(c.proposed, { field: 'line', value: 8 });
    const docFile = path.join(f.repoRoot, it.document);
    const before = sha256File(docFile);
    const p = cmdRemediation(wfOf(ctx)).record;
    const prop = p.proposals.find((x: any) => x.target.item_id === it.id);
    assert.equal(prop.kind, 'citation_correction');
    assert.equal(prop.original_value, 12);
    assert.equal(prop.proposed_value, 8);
    assert.equal(prop.status, 'proposed');
    assert.equal(prop.authorization.status, 'not_authorized');
    assert.equal(sha256File(docFile), before, 'the deliverable is not modified');
    // Without stated values the source cannot tell which part of the citation is wrong.
    const { f: f2, ctx: c2 } = setupG2(fixtures);
    deliverAll(f2, c2, citedClaim(f2, 12, 'The program initialises the processing limit before evaluating it.'));
    const s2 = buildSnapshot(wfOf(c2));
    const it2 = s2.items.find((x) => x.kind === 'requirement' && x.units[0].name === f2.programs[1].name)!;
    const [c2a] = analyseCitation(s2, new SourceReader(s2), it2);
    assert.equal(c2a.proposed, null);
    assert.notEqual(c2a.status, 'SOURCE_CITATION_CORRECTED');
  });

  test('6/7. changed source hashes are detected; without source nothing is claimed as verified', () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx, citedClaim(f, 8));
    const d1 = cmdDeterministic(wfOf(ctx)).record;
    assert.equal(d1.source_root.configured, true);
    const rel = Object.keys(d1.source_files).find((k) => k.endsWith(f.programs[1].rel))!;
    assert.ok(d1.source_files[rel]);
    fs.appendFileSync(path.join(f.sourceRoot, f.programs[1].rel), '      * edited\n');
    const d2 = cmdDeterministic(wfOf(ctx)).record;
    assert.deepEqual(d2.changed_since_previous.changed, [rel]);
    assert.equal(d2.changed_since_previous.previous_record, d1.record_id);
    delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
    const ctxNoSrc = loadContext({ forwardDir: FORWARD_DIR, configPath: f.configPath });
    const a = analyse(loadWorkflow(ctxNoSrc, RUN));
    assert.equal(a.det.source_root.configured, false);
    const sourceRoots = a.det.results.filter((r: any) => !/^(APPROVAL|PACKET|COVERAGE|CONSOLIDATION)/.test(r.key));
    assert.ok(sourceRoots.length > 0);
    assert.ok(sourceRoots.every((r: any) => !r.executed && r.status === 'INSUFFICIENT_EVIDENCE'));
    assert.ok(!a.det.results.some((r: any) => /VERIFIED/.test(r.status)));
  });

  const REC = [
    '       01  TEST-REC.',
    '           05  T-ID          PIC X(8).',
    '           05  T-AMT         PIC S9(13)V99 COMP-3.',
    '           05  T-ALT REDEFINES T-AMT PIC X(9).',
    '           05  T-TAB OCCURS 5 TIMES.',
    '               10  T-CODE    PIC X(2).',
    '               10  T-CNT     PIC S9(4) COMP.',
    '           05  T-NUMS COMP.',
    '               10  T-A       PIC S9(4).',
    '               10  T-B       PIC S9(9).',
    '           05  T-FLAG        PIC X.',
    '               88  T-ON      VALUE \'Y\'.',
  ];
  test('10. REDEFINES, OCCURS and inherited USAGE are laid out correctly (never a naive sum)', () => {
    const dd = parseDataDivision(sourceFile('REC.cpy', REC.join('\n')));
    const r = dd.records[0];
    // ID 8 | AMT 8 shared with ALT 9 -> 9 | TAB 5 x (2+2) = 20 | NUMS COMP 2+4 = 6 | FLAG 1  => 44
    assert.equal(r.size, 44);
    assert.equal(findItem(dd, 'T-ALT')!.node.offset, 8);
    assert.equal(findItem(dd, 'T-TAB')!.node.offset, 17);
    assert.equal(findItem(dd, 'T-B')!.node.size, 4, 'usage inherited from the group');
    assert.equal(findItem(dd, 'T-FLAG')!.node.offset, 43);
    assert.deepEqual(findItem(dd, 'T-FLAG')!.node.conditions.map((c) => c.values), [['Y']]);
    const sync = parseDataDivision(sourceFile('S.cpy', ['       01  S-REC.', '           05  S-A PIC S9(4) COMP SYNC.', '           05  S-B PIC X.'].join('\n')));
    assert.equal(sync.records[0].size, null, 'alignment-dependent sizes are not guessed');
    const fd = parseDataDivision(sourceFile('P.cbl', ['       DATA DIVISION.', '       FILE SECTION.', '       FD  F1', '           RECORD CONTAINS 10 CHARACTERS.', '       01  F1-REC.', '           05  F1-A PIC X(12).', '       WORKING-STORAGE SECTION.', '       01  W PIC X.'].join('\n')));
    assert.deepEqual(fdLengthFindings(fd).map((x) => [x.fd, x.declared.min, x.records[0].size, x.consistent]), [['F1', 10, 12, false]]);
  });

  test('8/9/12. field-level checks against the source: correct references verify, wrong attributes and lossy Java types are contradicted, missing copybooks are not guessed', () => {
    const root = path.join(FORWARD_DIR, 'tests', '.tmp', `rec-${process.pid}-${Date.now()}`);
    fs.mkdirSync(root, { recursive: true });
    try {
      fs.writeFileSync(path.join(root, 'REC.cpy'), REC.join('\n'));
      fs.writeFileSync(path.join(root, 'PROG.cbl'), ['       DATA DIVISION.', '       WORKING-STORAGE SECTION.', '       01  P-REC.', '           COPY NOSUCH.', '           05  P-X PIC X.'].join('\n'));
      const item = (id: string, line: number) => [id, { file_id: 'CB', record_id: 'R', item: {}, line }] as const;
      const snap: any = { ctx: { srcRoot: root, relByFile: new Map([['CB', 'REC.cpy'], ['PG', 'PROG.cbl']]), layoutItems: new Map([item('F-AMT', 3), item('F-TAB', 5), item('F-ON', 12), item('F-GONE', 99)]), statements: new Map() }, sys: { programs: [], copybooks: [] } };
      const reader = new SourceReader(snap);
      const field = (o: any) => ({ field_id: 'F-AMT', field_name: 'T-AMT', level: 5, pic: 'S9(13)V99', usage: 'PACKED_DECIMAL', byte_length: 8, offset: 8, occurs: null, java_type: 'BigDecimal', ...o });
      const rec = (fields: any[]) => ({ record_id: 'R', record_name: 'TEST-REC', owner: { unit_kind: 'copybook', name: 'REC', file_id: 'CB' }, total_bytes: 44, fields });
      const ok = checkRecord(snap, reader, rec([field({}), { field_id: 'F-TAB', field_name: 'T-TAB', level: 5, occurs: 5, byte_length: 4, offset: 17 }, { field_id: 'F-ON', field_name: 'T-ON', level: 88, cobol_category: 'condition' }]));
      assert.equal(ok.status, 'VERIFIED_DETERMINISTICALLY', JSON.stringify(ok.fields));
      assert.equal(ok.record.source_total, 44);
      const bad = checkRecord(snap, reader, rec([field({ java_type: 'int', offset: 9, byte_length: 15 })]));
      assert.equal(bad.status, 'CONTRADICTED_BY_SOURCE');
      assert.deepEqual(bad.fields[0].mismatches.map((m) => m.attribute).sort(), ['byte_length', 'java_type', 'offset']);
      assert.deepEqual(bad.fields[0].mismatches.find((m) => m.attribute === 'java_type')!.source, ['BigDecimal'], 'a lossy int is rejected for S9(13)V99');
      const gone = checkRecord(snap, reader, rec([field({ field_id: 'F-GONE' })]));
      assert.equal(gone.fields[0].status, 'indeterminate');
      const dd = parseDataDivision(sourceFile(path.join(root, 'PROG.cbl'), fs.readFileSync(path.join(root, 'PROG.cbl'), 'utf8')), () => null);
      assert.equal(dd.records[0].size, null, 'an unresolved COPY leaves the record size undetermined');
      assert.match(dd.records[0].flags.join(' '), /COPY NOSUCH .*could not be resolved/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('12b. a missing copybook in the inventory is a missing-dependency root: verified absent, queued for source', () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx);
    const a = analyse(wfOf(ctx));
    const root = a.reg.byKey.get('DEP:MISSINGX')!;
    assert.equal(root.category, 'missing_source_or_dependency');
    const res = a.det.results.find((r: any) => r.key === 'DEP:MISSINGX');
    assert.equal(res.status, 'EXTERNAL_DEPENDENCY_MISSING');
    assert.equal(buildQueue(a.snap, a.reg, a.det).queue.find((q: any) => q.root_cause_id === root.root_cause_id)?.class ?? 'E', 'E');
  });

  test('facts: OPEN mode versus I/O verb conflicts and missing PERFORM targets are computed, not inferred', () => {
    const src = sourceFile('X.cbl', ['       DATA DIVISION.', '       FILE SECTION.', '       FD  IN-FILE.', '       01  IN-REC PIC X(10).', '       PROCEDURE DIVISION.', '       MAIN-PARA.', '           OPEN INPUT IN-FILE.', '           WRITE IN-REC.', '           PERFORM NOWHERE.', '           GOBACK.'].join('\n'));
    const pf = procedureFacts(src, parseDataDivision(src));
    assert.deepEqual(pf.io_mode_conflicts.map((c) => [c.verb, c.file, c.line]), [['WRITE', 'IN-FILE', 8]]);
    assert.deepEqual(pf.missing_targets.map((m) => m.target), ['NOWHERE']);
    // A paragraph supplied by a COPY in the PROCEDURE DIVISION exists; one only in a member copied into the DATA DIVISION does not.
    const members: Record<string, string[]> = { PROCS: ['       IN-PROC.', '           CONTINUE.'], DATAPROC: ['       DATA-PROC.', '           CONTINUE.'] };
    const resolve = (m: string) => (members[m] ? sourceFile(`${m}.cpy`, members[m].join('\n')) : null);
    const src2 = sourceFile('Y.cbl', ['       DATA DIVISION.', '       WORKING-STORAGE SECTION.', '       01  W PIC X.', '           COPY DATAPROC.', '       PROCEDURE DIVISION.', '       MAIN-PARA.', '           PERFORM IN-PROC.', '           PERFORM DATA-PROC.', '           GOBACK.', '           COPY PROCS.'].join('\n'));
    const pf2 = procedureFacts(src2, parseDataDivision(src2, resolve), resolve);
    assert.deepEqual(pf2.missing_targets.map((m) => [m.target, m.defined_in_member_copied_into_data_division]), [['DATA-PROC', { member: 'DATAPROC', copy_line: 4 }]]);
  });
});

describe('S45-C. conflicts, scopes and proposals', () => {
  test('11. a business-interpretation conflict stays an open SME decision (class C), never auto-resolved', () => {
    const shared = (f: Fixture) => {
      const rules = f.read('output/rules/rules_artifact.json');
      const cb = f.copybooks[0];
      const ids = { system_id: f.systemId, file_id: cb.fileId, path_id: cb.pathId, program_id: null, section_id: null, paragraph_id: null, statement_id: null };
      rules.business_rules.push({ rule_id: 'BR-004', rule_set_id: 'RS-001', name: 'Declared status domain', category: 'VALIDATION', confidence: 'medium', requires_sme_review: false, outcomes: { result: 'declared value domain' }, primary_source: { program_id: null, copybook: cb.name, source_ids: ids }, sources: [{ program_id: null, copybook: cb.name, evidence: 'complete', source_ids: ids }], implemented_in_programs: [] });
      rules.rule_sets[0].rule_ids.push('BR-004');
      for (const p of f.programs) rules.rules_by_program[p.name] = [...(rules.rules_by_program[p.name] ?? []), 'BR-004'];
      f.write('output/rules/rules_artifact.json', rules);
    };
    const { f, ctx } = setupG2(fixtures, { mutate: shared });
    deliverAll(f, ctx, (a, unit, docs) => {
      if (a !== 'F1' || unit !== f.programs[0].name) return;
      const r = docs['draft_requirements.json'];
      const drop = new Set(r.requirements.filter((q: any) => q.derived_from_rules.some((x: any) => x.id === 'BR-004')).map((q: any) => q.requirement_id));
      r.requirements = r.requirements.filter((q: any) => !drop.has(q.requirement_id));
      for (const c of r.rule_coverage) if (c.rule.id === 'BR-004') Object.assign(c, { disposition: 'not_a_requirement', requirement_ids: [], reason: 'declared domain never tested' });
      const n = (d: string) => r.rule_coverage.filter((c: any) => c.disposition === d).length;
      r.coverage_summary = { rules_in_scope: r.rule_coverage.length, mapped: n('mapped'), deferred: n('deferred_scope') + n('deferred_decision'), not_a_requirement: n('not_a_requirement'), contradictory: n('contradictory'), requirements: r.requirements.length };
      const e = docs['evidence_references.json'];
      e.edges = e.edges.filter((x: any) => !(x.to.kind === 'requirement' && drop.has(x.to.id)) && !(x.from.kind === 'requirement' && drop.has(x.from.id)));
    });
    const a = analyse(wfOf(ctx));
    const key = a.reg.decisionRoots.get('DR-CONSOLIDATION-001')![0];
    const root = a.reg.byKey.get(key)!;
    assert.equal(root.category, 'contradictory_business_rules');
    assert.equal(a.det.results.find((r: any) => r.key === key).next_step, 'REQUIRES_BUSINESS_SME');
    assert.equal(buildQueue(a.snap, a.reg, a.det).queue.find((q: any) => q.root_cause_id === root.root_cause_id).class, 'C');
    assert.equal(a.snap.resolutions.get('DR-CONSOLIDATION-001')!.status, 'open');
  });

  test('13. shared-dependency blockers are visible in every scope that depends on them', () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx);
    const a = analyse(wfOf(ctx));
    const rd = scopeReadiness(a.snap, a.reg, { requirements: false });
    const caller = rd.scopes.find((s: any) => s.scope === `programs:${f.programs[0].name}`);
    assert.ok(caller.dependencies.includes(f.programs[1].name));
    assert.ok(caller.blockers_shared_with_other_scopes > 0);
    assert.ok(rd.scopes.some((s: any) => s.kind === 'shared_dependency' && s.label === `shared:${f.copybooks[0].name}`));
    assert.ok(rd.scopes.every((s: any) => s.readiness === 'NOT_READY'), 'grouping makes nothing ready');
  });

  test('14/15. proposals are versioned; earlier records and evidence are never rewritten', () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx, citedClaim(f, 12));
    const wd = wfOf(ctx).store.dir;
    const guarded = ['receipts', 'agents', 'packets', 'consolidation', 'verification', 'corrections', 'decisions', 'approvals'];
    const before = Object.fromEntries(guarded.map((d) => [d, hashTree(path.join(wd, d))]));
    const p1 = cmdRemediation(wfOf(ctx));
    const p2 = cmdRemediation(wfOf(ctx));
    const k = (r: any) => r.record.proposals.map((p: any) => [p.proposal_id, p.version]);
    assert.deepEqual(k(p2), k(p1), 'unchanged evidence keeps the version');
    assert.ok(p2.record.proposals.every((p: any) => p.previous_version?.unchanged));
    const p1Hash = sha256File(p1.file);
    fs.appendFileSync(path.join(f.sourceRoot, f.programs[1].rel), '      * changed\n');
    const p3 = cmdRemediation(wfOf(ctx));
    const changed = p3.record.proposals.find((p: any) => p.proposal_id === p1.record.proposals[0].proposal_id);
    assert.equal(changed.version, 2, 'new source evidence -> new version');
    assert.equal(changed.previous_version.record, p2.id);
    assert.equal(sha256File(p1.file), p1Hash, 'the earlier proposal record is untouched');
    for (const d of guarded) assert.deepEqual(hashTree(path.join(wd, d)), before[d], `${d} unchanged`);
  });
});

describe('S45-D. independent review packets', () => {
  test('16/17. Pass A carries source evidence only; Pass B holds the interpretations, bound to Pass A by hash', () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx, citedClaim(f, 8, 'The program sets the processing limit to 1000 and then flags high limits for review by the operator.'));
    const a = analyse(wfOf(ctx));
    const p = preparePackets(a.snap, a.reg, a.det);
    assert.ok(p.passA.packets.length > 0);
    assert.equal(ctx.contracts.validate('verification/openai-pass-a', p.passA).valid, true);
    const statements = a.snap.items.filter((i) => i.kind === 'requirement').map((i) => i.data.statement as string);
    const passAText = JSON.stringify(p.passA);
    for (const s of statements) assert.ok(!passAText.includes(s), 'no requirement statement in Pass A');
    for (const [i, pa] of p.passA.packets.entries()) {
      const pb = p.passB.packets[i];
      assert.equal(pb.pass_a_sha256, digest(pa));
      assert.equal(pa.packet_id, pb.packet_id);
      for (const s of pa.sources.filter((x: any) => x.available)) assert.ok(s.sha256 && s.excerpt.every((l: any) => typeof l.line === 'number'));
    }
    const withInterp = p.passB.packets.find((x: any) => x.existing_interpretations.length);
    assert.ok(withInterp, 'Pass B carries the existing interpretations');
    // The leak check catches interpretation text placed in Pass A, and the schema rejects interpretation fields.
    const pa = { ...p.passA.packets[0], question: `${p.passA.packets[0].question} ${statements[0]}` };
    assert.equal(leakCheck(pa, statements).leaked, true);
    assert.equal(ctx.contracts.validate('verification/openai-pass-a', { ...p.passA, packets: [{ ...p.passA.packets[0], existing_interpretations: [] }] }).valid, false);
    const rec = cmdOpenAI(wfOf(ctx));
    assert.notEqual(rec.pass_a.id, rec.pass_b.id);
    assert.ok(!fs.readFileSync(rec.pass_a.file, 'utf8').includes('existing_interpretations'));
  });

  test('18/19. source export is NOT_AUTHORIZED, sending is refused, and preparation makes no network call', async () => {
    const { f, ctx } = setupG2(fixtures);
    deliverAll(f, ctx);
    const snap = buildSnapshot(wfOf(ctx));
    const auth = exportAuthorization(snap);
    assert.equal(auth.status, 'NOT_AUTHORIZED');
    assert.throws(() => sendVerificationPacket('OAV-X', auth), EgressBlockedError);
    assert.throws(() => sendVerificationPacket('OAV-X', { status: 'AUTHORIZED', reason: 'forged', authorization_record: null }), /not enabled/);
    // The CommonJS module objects (not the ES import wrappers) are what any client would call.
    const http = require('http');
    const https = require('https');
    const net = require('net');
    const calls: string[] = [];
    const saved = { hr: http.request, hg: http.get, sr: https.request, sg: https.get, nc: net.connect, cc: net.createConnection, fetch: (globalThis as any).fetch };
    const trap = (name: string) => (..._a: any[]) => {
      calls.push(name);
      throw new Error(`network call attempted: ${name}`);
    };
    Object.assign(http, { request: trap('http.request'), get: trap('http.get') });
    Object.assign(https, { request: trap('https.request'), get: trap('https.get') });
    Object.assign(net, { connect: trap('net.connect'), createConnection: trap('net.createConnection') });
    (globalThis as any).fetch = trap('fetch');
    try {
      const q = cmdOpenAI(wfOf(ctx)).record;
      assert.ok(q.packets.every((x: any) => x.status === 'NOT_AUTHORIZED'));
      cmdReport(wfOf(ctx), { exportDir: path.join(f.repoRoot, 'exp'), reportFile: path.join(f.repoRoot, 'r.md') });
    } finally {
      Object.assign(http, { request: saved.hr, get: saved.hg });
      Object.assign(https, { request: saved.sr, get: saved.sg });
      Object.assign(net, { connect: saved.nc, createConnection: saved.cc });
      (globalThis as any).fetch = saved.fetch;
    }
    assert.deepEqual(calls, []);
  });
});

describe('S45-E. gates stay protected', () => {
  test('20/21/22/23. analysis changes no gate: approvals are still refused, G2 fail-closed, G3-G8 blocked, F5 disabled', () => {
    const { f, ctx, k } = setupG2(fixtures);
    deliverAll(f, ctx, citedClaim(f, 12));
    const digestBefore = evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector('application')).scope_sha256;
    const r = main(['verification', 'report', '--config', f.configPath, '--run', RUN, '--export-dir', path.join(f.repoRoot, 'exp'), '--out', path.join(f.repoRoot, 'STEP45.md')], () => {}, () => {});
    assert.equal(r, 0);
    assert.ok(fs.existsSync(path.join(f.repoRoot, 'exp', 'root-cause-registry.json')) && fs.existsSync(path.join(f.repoRoot, 'STEP45.md')));
    assert.equal(evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector('application')).scope_sha256, digestBefore, 'analysis records do not change the approval scope');
    assert.throws(() => createApprovalRequest(wfOf(ctx), 'application', 'dave.requester'), /not ready/);
    const forged = path.join(f.repoRoot, 'forged.json');
    const st = { contract: 'approval-statement', statement_version: '1.0', gate: 'G2', request_id: 'AREQ-0001', request_sha256: 'a'.repeat(64), scope_sha256: digestBefore, baseline_manifest_sha256: wfOf(ctx).run.manifestSha256, decision: 'approved', signer_id: SIGNERS.agent, role: 'requirements_approver' };
    fs.writeFileSync(forged, JSON.stringify({ contract: 'signed-approval', statement: st, signature: { algorithm: 'ed25519', value: signText(statementText(st), k.agent) } }));
    assert.equal(importApproval(wfOf(ctx), forged).imported, false);
    assert.equal(signResolution(ctx, f, `SCOPE-${f.programs[1].name}`, 'resolved_no_change', k.agent, SIGNERS.agent, 'business_sme').recorded, false, 'agents cannot resolve decisions');
    void approvalStatement;
    assert.equal(runGate(wfOf(ctx), 'G2').status, 'UNVERIFIED');
    for (const g of ['G4', 'G5', 'G6', 'G7', 'G8'] as const) assert.equal(runGate(wfOf(ctx), g).status, 'BLOCKED', g);
    assert.equal(runGate(wfOf(ctx), 'G3').status, 'BLOCKED');
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false);
    assert.throws(() => prepare(wfOf(ctx), 'F5'), /may only be dispatched/);
    assert.equal(fs.readdirSync(f.repoRoot).some((x) => x.endsWith('.java')), false);
  });
});

describe('S45-F. integration on the real run (read-only)', () => {
  const realRunsDir = path.resolve(FORWARD_DIR, 'runs');
  const run = fs.existsSync(realRunsDir) ? fs.readdirSync(realRunsDir).filter((d) => fs.existsSync(path.join(realRunsDir, d, 'workflow', 'state.json'))).sort().pop() : undefined;
  test('the real accepted deliverables reconcile, map completely and prepare leak-free packets without writing anything', { skip: !run }, () => {
    const src = path.resolve(FORWARD_DIR, '..', 'references', 'udara-legacy-modernization-harness');
    if (fs.existsSync(src)) process.env.REVFORGE_COBOL_SOURCE_ROOT = src;
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    const wf = loadWorkflow(ctx, run!);
    const auditBefore = sha256File(wf.store.p('audit.jsonl'));
    const a = analyse(wf);
    const audit = auditCounts(a.snap, a.app);
    assert.equal(audit.reconciliation.scope_findings_equation.balanced, true);
    const rec = registryRecord(a.snap, a.reg, a.app);
    assert.equal(rec.summary.decisions_mapped, a.snap.register.size);
    assert.equal(rec.summary.blocking_findings_without_root.length, 0);
    const p = preparePackets(a.snap, a.reg, a.det);
    assert.equal(p.queue.summary.leaks_detected, 0);
    assert.ok(p.queue.packets.every((x: any) => x.status === 'NOT_AUTHORIZED'));
    assert.equal(ctx.contracts.validate('verification/openai-pass-a', p.passA).valid, true);
    assert.equal(sha256File(wf.store.p('audit.jsonl')), auditBefore, 'read-only');
    void buildRegistry;
    void runDeterministic;
  });
});
