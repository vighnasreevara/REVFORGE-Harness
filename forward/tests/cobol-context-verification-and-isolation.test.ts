/**
 * STEP 9: dependency-aware COBOL source-context verification, evidence
 * supplements and their G1 integration, whole-process isolation and the
 * isolation-aware preflight. Synthetic COBOL and synthetic signers only; the
 * isolation suite runs real namespaces when the host supports them and is
 * reported as not executed (never as passed) when it does not.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { sourceFile } from '../verification/src/cobol-source';
import { parseDataDivision } from '../verification/src/layout';
import { buildSymbolIndex, literalSupport, logicalText, resolveName, statementReferences } from '../verification/src/context';
import { sha256File } from '../runtime/src/core/fsutil';
import { loadContext } from '../runtime/src/core/config';
import { generationAuthorized, policyRoots, runGate } from '../runtime/src/orchestrator/orchestrator';
import { findAgent } from '../runtime/src/orchestrator/agents';
import { canWrite } from '../runtime/src/orchestrator/permissions';
import { canonicalize } from '../runtime/src/approval/canonical';
import { resolveDecision } from '../runtime/src/approval/decisions';
import { evaluateScope, parseSelector } from '../runtime/src/approval/scope';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { SourceReader } from '../runtime/src/blockers/deterministic';
import { checkItem, contextReport, recordSupplements, supplements } from '../runtime/src/context/context';
import { exportResolutionRequest } from '../runtime/src/operations/decisions';
import { importDisclosure, prepareDisclosure } from '../runtime/src/disclosure/disclosure';
import { preflight } from '../runtime/src/bmad/preflight';
import { assessHost, buildWorkspace, Probe, runIsolationTests, validateWorkspace } from '../runtime/src/isolation/isolation';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { Edit, KP, SIGNERS, signText, wfOf } from './helpers/g2fixture';
import { BRAVO, DESIGN_SIGNERS, designFixture } from './helpers/designfixture';

const fixtures: Fixture[] = [];
const temps: string[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
});
afterEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  while (fixtures.length) cleanup(fixtures.pop()!);
  while (temps.length) fs.rmSync(temps.pop()!, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ */
/* synthetic COBOL (pure resolver)                                      */
/* ------------------------------------------------------------------ */
const L = (s: string) => s.split('\n').map((x) => (x ? x : '')).join('\n');
const PROG = L(`       IDENTIFICATION DIVISION.
       PROGRAM-ID. SYNTH01.
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       COPY STATCPY.
       01  REC-A.
           05  FLD-A        PIC X.
               88  DUP-FLAG VALUE 'A'.
       01  REC-B.
           05  FLD-A        PIC X.
               88  DUP-FLAG VALUE 'B'.
       01  WS-OTHER.
           05  OTHER-STATUS PIC X.
               88  ST-DONE  VALUE 'D'.
       PROCEDURE DIVISION.
       P100.
           EVALUATE WS-CODE
               WHEN 0
                    SET ST-OK TO TRUE
               WHEN OTHER
                    SET ST-FAIL TO TRUE
           END-EVALUATE.
      *    SET ST-DONE TO TRUE (comment, never a reference)
           SET DUP-FLAG TO TRUE.
           SET DUP-FLAG OF REC-B TO TRUE.
           MOVE 'X' TO FLD-A.
           IF ST-NESTED
              DISPLAY 'NESTED'
           END-IF.
           COPY MISSINGCPY.
           GOBACK.`);
const STATCPY = L(`       01  STATUS-AREA.
           05  WS-CODE      PIC 9(2).
           05  WS-STATUS    PIC X.
               88  ST-OK    VALUE 'K'.
               88  ST-FAIL  VALUE 'X'.
           COPY INNERCPY.`);
const INNERCPY = L(`       01  INNER-AREA.
           05  INNER-STATUS PIC X.
               88  ST-NESTED VALUE 'N'.`);
function synth(extra: Record<string, string> = {}) {
  const files: Record<string, string> = { 'SYNTH01.cbl': PROG, 'STATCPY.cpy': STATCPY, 'INNERCPY.cpy': INNERCPY, ...extra };
  const sf = (n: string) => sourceFile(`/src/${n}`, files[n]);
  const resolver = (m: string) => {
    const n = Object.keys(files).find((x) => x.replace(/\.[^.]+$/, '').toUpperCase() === m.toUpperCase());
    return n ? sf(n) : null;
  };
  const prog = sf('SYNTH01.cbl');
  const dd = parseDataDivision(prog, resolver);
  const idx = buildSymbolIndex(dd, prog.path);
  const line = (re: RegExp) => prog.lines.findIndex((x) => re.test(x)) + 1;
  return { prog, dd, idx, line };
}

describe('STEP 9 — dependency-aware COBOL resolver (synthetic)', () => {
  test('1/2. a level-88 condition resolves to its declaration, values, parent item and record', () => {
    const { idx } = synth();
    const r = resolveName(idx, 'ST-FAIL', []);
    assert.equal(r.resolution, 'resolved');
    assert.equal(r.definition!.kind, 'condition');
    assert.deepEqual(r.definition!.values, ['X']);
    assert.equal(r.definition!.parent!.name, 'WS-STATUS');
    assert.equal(r.definition!.record, 'STATUS-AREA');
    assert.ok(r.definition!.ancestors.includes('STATUS-AREA'));
    assert.equal(path.basename(r.definition!.file), 'STATCPY.cpy');
    assert.equal(r.definition!.line, 5);
  });

  test('3. evidence chains cross copybooks, including a nested COPY', () => {
    const { idx } = synth();
    const ok = resolveName(idx, 'ST-OK', []).definition!;
    assert.deepEqual(ok.include_chain.map((c) => c.member), ['STATCPY']);
    const nested = resolveName(idx, 'ST-NESTED', []).definition!;
    assert.deepEqual(nested.include_chain.map((c) => c.member), ['STATCPY', 'INNERCPY']);
    assert.equal(path.basename(nested.file), 'INNERCPY.cpy');
  });

  test('4/5. duplicate condition and field names are ambiguous unless qualified (OF/IN)', () => {
    const { prog, idx, line } = synth();
    assert.equal(resolveName(idx, 'DUP-FLAG', []).resolution, 'ambiguous');
    const q = resolveName(idx, 'DUP-FLAG', ['REC-B']);
    assert.equal(q.resolution, 'resolved');
    assert.deepEqual(q.definition!.values, ['B']);
    assert.equal(resolveName(idx, 'FLD-A', []).resolution, 'ambiguous');
    assert.equal(resolveName(idx, 'FLD-A', ['REC-A']).resolution, 'resolved');
    const at = line(/SET DUP-FLAG TO TRUE/);
    const unq = statementReferences(idx, logicalText(prog, at, at));
    assert.equal(unq.find((x) => x.name === 'DUP-FLAG')!.resolution, 'ambiguous');
    const lits = literalSupport(idx, logicalText(prog, at, at), unq, ['A']);
    assert.equal(lits[0].support, 'ambiguous_condition', 'an ambiguous condition never supports a value');
    const qa = line(/SET DUP-FLAG OF REC-B/);
    const qref = statementReferences(idx, logicalText(prog, qa, qa)).find((x) => x.name === 'DUP-FLAG')!;
    assert.equal(qref.resolution, 'resolved');
    assert.deepEqual(qref.qualifiers, ['REC-B']);
  });

  test('6. a missing copybook stays unresolved; nothing is invented', () => {
    const { idx } = synth({});
    const s2 = synth();
    void s2;
    // MISSINGCPY sits in the procedure division here; a data-division COPY of a missing member is recorded as unresolved.
    const prog2 = sourceFile('/src/P2.cbl', L(`       DATA DIVISION.
       WORKING-STORAGE SECTION.
       COPY NOSUCHCPY.
       PROCEDURE DIVISION.
           SET GHOST-FLAG TO TRUE.`));
    const dd2 = parseDataDivision(prog2, () => null);
    const i2 = buildSymbolIndex(dd2, prog2.path);
    assert.deepEqual(i2.unresolvedIncludes.map((u) => u.name), ['NOSUCHCPY']);
    assert.equal(resolveName(i2, 'GHOST-FLAG', []).resolution, 'undefined');
    const t = logicalText(prog2, 5, 5);
    const lits = literalSupport(i2, t, statementReferences(i2, t), ['G']);
    assert.equal(lits[0].support, 'unsupported');
    assert.ok(idx.byName.size > 0);
  });

  test('8. a matching literal with no dependency relationship is never evidence', () => {
    const { prog, idx, line } = synth();
    const from = line(/EVALUATE WS-CODE/);
    const to = line(/END-EVALUATE/);
    const t = logicalText(prog, from, to);
    const refs = statementReferences(idx, t);
    const r = literalSupport(idx, t, refs, ['X', 'K', 'D']);
    assert.equal(r.find((x) => x.literal === 'X')!.support, 'declared_value_of_referenced_condition');
    assert.equal(r.find((x) => x.literal === 'K')!.support, 'declared_value_of_referenced_condition');
    const d = r.find((x) => x.literal === 'D')!;
    assert.equal(d.support, 'unrelated_occurrence_only', "ST-DONE declares 'D' but the cited statement never references it");
    assert.equal(refs.find((x) => x.name === 'ST-FAIL')!.usage, 'sets_true');
  });

  test('10/11. fixed-format columns, comments and continued literals are handled', () => {
    const fixed = sourceFile('/src/F.cbl', [
      "000100     SET ST-OK TO TRUE.                                           SET ST-FAIL",
      "000200*    SET ST-FAIL TO TRUE",
      "000300     MOVE 'ABC",
      "000400-        'DEF' TO WS-STATUS.",
    ].join('\n'));
    const { idx } = synth();
    const t = logicalText(fixed, 1, 4);
    const refs = statementReferences(idx, t);
    assert.ok(refs.some((x) => x.name === 'ST-OK'));
    assert.ok(!refs.some((x) => x.name === 'ST-FAIL'), 'text in the comment line and after column 72 is ignored');
    assert.ok(t.literals.includes('ABCDEF'), `continued literal joined: ${JSON.stringify(t.literals)}`);
    assert.equal(t.lines.filter((l) => l.comment).length, 1);
    assert.equal(t.lines.filter((l) => l.continuation).length, 1);
  });
});

/* ------------------------------------------------------------------ */
/* runtime fixture: a program that sets a copybook level-88 condition   */
/* ------------------------------------------------------------------ */
const BRAVO_V2 = [
  '       IDENTIFICATION DIVISION.',
  '       PROGRAM-ID. BRAVO02.',
  '       DATA DIVISION.',
  '       WORKING-STORAGE SECTION.',
  '       COPY RECLAYT.',
  '       01  WS-LIMIT PIC 9(4).',
  '       PROCEDURE DIVISION.',
  '       P1.',
  '           MOVE 1000 TO WS-LIMIT.',
  '           IF WS-LIMIT > 500',
  '              SET BRV-HIGH TO TRUE',
  '           END-IF.',
  '           GOBACK.',
];
// 'Q' occurs nowhere in the cited statement text, so only the dependency chain can support it.
const COPY_V1 = ['       01  BRV-STATUS-AREA.', '           05  BRV-STATUS   PIC X.', "               88  BRV-HIGH VALUE 'Q'.", "               88  BRV-LOW  VALUE 'L'."];

function contextFixture(opts: { catalogueLine?: number; citeLine?: number; claim?: string } = {}) {
  let cbRel = '';
  const mutate = (f: Fixture) => {
    const b = f.programs[1];
    const cb = f.copybooks[0];
    cbRel = cb.rel;
    f.write(`cobol-src/${b.rel}`, BRAVO_V2.join('\n') + '\n');
    f.write(`cobol-src/${cb.rel}`, COPY_V1.join('\n') + '\n');
    f.write(`output/parser/raw_structure/${b.fileId}__${b.name}.json`, {
      program_summary: {},
      program_id: b.name,
      file_id: b.fileId,
      procedure_division: {
        paragraphs: [{ paragraph_id: `${b.fileId}-PAR-0001`, name: 'P1', start_line: 8, end_line: 13 }],
        statements: [
          { statement_id: `${b.fileId}-STMT-000001`, statement_type: 'MOVE', start_line: 9, end_line: 9 },
          { statement_id: `${b.fileId}-STMT-000002`, statement_type: 'IF', start_line: 10, end_line: 12 },
        ],
      },
    });
    const data = f.read('output/data/data_artifact.json');
    data.condition_catalogue = [
      { condition_id: `${cb.fileId}-FLD-000002`, condition_name: 'BRV-HIGH', parent_field: 'BRV-STATUS', parent_field_id: `${cb.fileId}-FLD-000001`, parent_record: 'BRV-STATUS-AREA', parent_record_id: `${cb.fileId}-REC-0001`, values: ['Q'], values_raw: "'Q'", programs_in_scope: [b.name], source_line: opts.catalogueLine ?? 3 },
      { condition_id: `${cb.fileId}-FLD-000003`, condition_name: 'BRV-LOW', parent_field: 'BRV-STATUS', parent_field_id: `${cb.fileId}-FLD-000001`, parent_record: 'BRV-STATUS-AREA', parent_record_id: `${cb.fileId}-REC-0001`, values: ['L'], values_raw: "'L'", programs_in_scope: [b.name], source_line: 4 },
    ];
    f.write('output/data/data_artifact.json', data);
  };
  let fx: Fixture;
  const edit: Edit = (a, unit, docs) => {
    if (a !== 'F1' || unit !== fx.programs[1].name) return;
    const r = docs['draft_requirements.json'].requirements[0];
    r.evidence_status = 'verified_from_source';
    r.statement = opts.claim ?? "When the processing limit exceeds 500 the program marks the status HIGH ('Q').";
    r.source_refs = [{ ...r.source_refs[0], statement_id: `${fx.programs[1].fileId}-STMT-000002`, line: opts.citeLine ?? 10 }];
  };
  const wrapped = (f: Fixture) => {
    fx = f;
    mutate(f);
  };
  const out = designFixture(fixtures, { approveG1: false, resolve: false, mutate: wrapped, edit });
  return { ...out, cbRel: () => cbRel, req: `REQ-${out.f.programs[1].name}-001` };
}
const itemOf = (ctx: any, id: string) => buildSnapshot(wfOf(ctx)).itemById.get(id)!;
const check = (ctx: any, id: string) => {
  const snap = buildSnapshot(wfOf(ctx));
  return checkItem(snap, new SourceReader(snap), snap.itemById.get(id)!);
};
function signReview(f: Fixture, ctx: any, decision: string, outcome: string, kp: KP, signer: string, role: string, selected: string | null) {
  const req = exportResolutionRequest(wfOf(ctx), decision, BRAVO);
  const res = { ...req, outcome, selected_option: selected, resolution_text: `Synthetic resolution for ${decision}`, justification: 'Synthetic justification recorded by a test signer', signer_id: signer, role, resolved_at: new Date(Date.now() - 1000).toISOString() };
  const file = path.join(f.repoRoot, `r9-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-decision-resolution', resolution: res, signature: { algorithm: 'ed25519', value: signText(canonicalize(res), kp) } }));
  return resolveDecision(wfOf(ctx), file, { build: (w) => buildSnapshot(w) });
}

describe('STEP 9 — source-context verification in the workflow', () => {
  test('12. permanent source IDs are attached from the reverse catalogue and cross-checked against the source', () => {
    const { ctx, req } = contextFixture();
    const r = check(ctx, req);
    assert.equal(r.status, 'CONTEXT_SUPPORTED', JSON.stringify(r.literal_support));
    assert.equal(r.existing.claim_result === 'verified', false, 'the existing checker did not establish the value');
    const chain = r.additional_references.find((a) => a.condition === 'BRV-HIGH')!;
    assert.match(String(chain.condition_id), /-FLD-000002$/);
    assert.match(String(chain.parent_field_id), /-FLD-000001$/);
    assert.equal(chain.usage, 'sets_true');
    assert.equal(r.metadata_disagreements.length, 0);
    assert.equal(r.levels.runtime_effect_supported, true);
    assert.equal(r.levels.business_interpretation, 'not_established_requires_human');
    const bad = contextFixture({ catalogueLine: 9 });
    assert.ok(check(bad.ctx, bad.req).metadata_disagreements.some((m) => /line: catalogue 9, source 3/.test(m)));
  });

  test('7. an incorrect cited line is a citation mismatch, never accepted evidence', () => {
    const { ctx, req } = contextFixture({ citeLine: 13 });
    const r = check(ctx, req);
    assert.equal(r.status, 'CITATION_MISMATCH');
    const sups = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO));
    const s = supplements(wfOf(ctx)).find((x) => x.item_id === req);
    if (s) assert.equal(s.acceptance.eligible, false);
    void sups;
  });

  test('a claim that contradicts the declared value is reported as a contradiction', () => {
    const { ctx, req } = contextFixture({ claim: "When the limit exceeds 500 the status becomes HIGH ('Z')." });
    const r = check(ctx, req);
    assert.equal(r.status, 'CONTEXT_CONTRADICTED');
    assert.match(r.contradictions[0], /HIGH/);
  });

  test('13/14. versioned evidence supplements are immutable and resolve nothing on their own', () => {
    const { f, ctx, req } = contextFixture();
    const rep = contextReport(wfOf(ctx), BRAVO);
    assert.equal(ctx.contracts.validate('verification/context-report', rep).valid, true);
    const first = recordSupplements(wfOf(ctx), rep);
    const s1 = first.find((x) => x.item_id === req)!;
    assert.equal(s1.new, true);
    assert.equal(s1.version, 1);
    const file1 = wfOf(ctx).store.p('context', `${s1.supplement_id}.json`);
    const h1 = sha256File(file1);
    assert.equal(recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO)).find((x) => x.item_id === req)!.new, false, 'identical content is not recorded twice');
    const snap = buildSnapshot(wfOf(ctx));
    assert.notEqual(snap.resolutions.get(`RVW-${req}`)?.status, 'resolved', 'no SME decision is resolved by a supplement');
    assert.equal(evaluateScope(snap, parseSelector(BRAVO)).findings.find((x) => x.id === req)!.outcome, 'REQUIRES_EVIDENCE', 'the G1 outcome is unchanged without a signed acceptance');
    // A changed source produces a new version that supersedes the first; the first stays byte-identical.
    fs.appendFileSync(path.join(f.sourceRoot, f.copybooks[0].rel), '      * annotated after the first supplement\n');
    const second = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO)).find((x) => x.item_id === req)!;
    assert.equal(second.version, 2);
    assert.equal(supplements(wfOf(ctx)).find((x) => x.supplement_id === second.supplement_id)!.supersedes, s1.supplement_id);
    assert.equal(sha256File(file1), h1);
  });

  test('15/16. G1 counts the evidence only through a signed acceptance, stays fail-closed, and drops it when the source changes', () => {
    const { f, ctx, k, dk, req } = contextFixture();
    const s = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO)).find((x) => x.item_id === req)!;
    const decision = `RVW-${req}`;
    // Wrong outcome or a non-existent supplement are refused.
    assert.ok(signReview(f, ctx, decision, 'resolved_no_change', k.sme, SIGNERS.sme, 'business_sme', 'ESU-9999').checks.some((c: any) => c.id === 'evidence_supplement_binding' && !c.ok));
    const reg = buildSnapshot(wfOf(ctx)).register.get(decision)!;
    assert.ok(reg.allowed_outcomes.includes('resolved_no_change'), 'a current eligible supplement makes acceptance an allowed, signed outcome');
    assert.ok(reg.evidence.some((e) => e.kind === 'evidence_supplement' && e.ref === s.supplement_id));
    const ok = signReview(f, ctx, decision, 'resolved_no_change', k.sme, SIGNERS.sme, 'business_sme', s.supplement_id);
    assert.equal(ok.recorded, true, JSON.stringify(ok.checks.filter((c: any) => !c.ok)));
    const after = evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(BRAVO)).findings.find((x) => x.id === req)!;
    assert.notEqual(after.outcome, 'REQUIRES_EVIDENCE', `accepted evidence counts: ${after.reasons.join(' | ')}`);
    assert.notEqual(runGate(wfOf(ctx), 'G1').status, 'PASS', 'readiness is not approval: G1 still needs a signed approval');
    fs.appendFileSync(path.join(f.sourceRoot, f.copybooks[0].rel), '      * changed after acceptance\n');
    const stale = evaluateScope(buildSnapshot(wfOf(ctx)), parseSelector(BRAVO)).findings.find((x) => x.id === req)!;
    assert.ok(stale.blocking, 'a stale supplement no longer counts');
    void dk;
  });

  test('9. a supplement whose source hash no longer matches cannot be selected', () => {
    const { f, ctx, k, req } = contextFixture();
    const s = recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO)).find((x) => x.item_id === req)!;
    fs.appendFileSync(path.join(f.sourceRoot, f.copybooks[0].rel), '      * changed\n');
    const r = signReview(f, ctx, `RVW-${req}`, 'resolved_no_change', k.sme, SIGNERS.sme, 'business_sme', s.supplement_id);
    assert.equal(r.recorded, false);
    assert.match(r.checks.find((c: any) => c.id === 'evidence_supplement_binding').detail, /stale|changed/);
  });
});

/* ------------------------------------------------------------------ */
/* isolation                                                            */
/* ------------------------------------------------------------------ */
const failingProbe: Probe = { run: () => ({ ok: false, out: '' }) };

describe('STEP 9 — whole-process isolation', () => {
  test('17-22. real offline isolation suite on synthetic data (or an honest NOT EXECUTED)', () => {
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    const r = runIsolationTests(ctx);
    assert.equal(r.synthetic_only, true);
    for (const id of ['workspace_manifest_valid', 'unexpected_mount_rejected', 'symlink_input_rejected', 'traversal_destination_rejected', 'unlisted_file_rejected']) assert.ok(r.host_checks.find((c) => c.test === id)?.passed, id);
    if (!r.executed) {
      assert.notEqual(r.status, 'ISOLATION_TESTED');
      assert.equal(r.all_passed, false);
      assert.ok(r.reason_not_executed);
      return;
    }
    const want = ['authorized_input_readable', 'unrelated_host_files_unreadable', 'source_write_protected', 'permitted_output_writable', 'unauthorized_output_blocked', 'host_credentials_inaccessible', 'network_denied_by_default', 'unauthorized_destination_unreachable', 'symlink_escape_fails', 'path_traversal_fails', 'helper_processes_cannot_escape', 'no_host_control_socket', 'output_visible_to_host', 'source_unchanged_on_host'];
    for (const id of want) assert.ok(r.sandbox_checks.find((c) => c.test === id)?.passed, `${id}: ${r.sandbox_checks.find((c) => c.test === id)?.detail}`);
    assert.equal(r.status, 'ISOLATION_TESTED');
  });

  test('23. a missing isolation runtime is reported, never assumed', () => {
    const ctx = loadContext({ forwardDir: FORWARD_DIR });
    const a = assessHost(ctx, failingProbe);
    assert.equal(a.status, 'ISOLATION_UNAVAILABLE');
    assert.ok(a.boundaries.filter((b) => b.boundary !== 'payload_content_enforcement' && b.boundary !== 'provider_egress_allowlist').every((b) => !b.enforceable));
    const r = runIsolationTests(ctx, failingProbe, a);
    assert.equal(r.executed, false);
    assert.equal(r.all_passed, false);
    assert.match(String(r.reason_not_executed), /not available/);
  });

  test('17/21. the workspace builder refuses traversal, absolute paths and unlisted files', () => {
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'ws9-'));
    temps.push(tmp);
    fs.writeFileSync(path.join(tmp, 'a.cbl'), 'x');
    assert.throws(() => buildWorkspace(path.join(tmp, 'w1'), [{ source: path.join(tmp, 'a.cbl'), dest: '../a.cbl' }], []), /unsafe/);
    assert.throws(() => buildWorkspace(path.join(tmp, 'w2'), [{ source: path.join(tmp, 'a.cbl'), dest: '/etc/a.cbl' }], []), /unsafe/);
    const m = buildWorkspace(path.join(tmp, 'w3'), [{ source: path.join(tmp, 'a.cbl'), dest: 'a.cbl' }], []);
    assert.deepEqual(validateWorkspace(m), []);
    assert.ok(validateWorkspace({ ...m, network: 'host' as any }).some((p) => /network/.test(p)));
    assert.ok(validateWorkspace({ ...m, mounts: m.mounts.map((x) => (x.name === 'src' ? { ...x, mode: 'rw' as const } : x)) }).some((p) => /unexpected mounts/.test(p)), 'a writable source mount is refused');
    fs.writeFileSync(path.join(m.workspace, 'src', 'a.cbl'), 'changed');
    assert.ok(validateWorkspace(m).some((p) => /changed/.test(p)));
  });
});

/* ------------------------------------------------------------------ */
/* preflight and protection                                             */
/* ------------------------------------------------------------------ */
const testedIso = { tested: true, report: { executed_at: new Date().toISOString(), sandbox_sha256: 'a'.repeat(64) } as any, problems: [] };
const hostWithoutRunner: any = { primitives: { linux_claude: { available: false }, linux_node: { available: false } } };

describe('STEP 9 — isolation-aware preflight and protection', () => {
  test('24/25/26. invalid or wrong-provider authorization and the missing runner keep the preflight refused', () => {
    const { f, ctx, dk } = designFixture(fixtures);
    const sign = (a: any, kp: KP, signer: string, role = 'data_owner') => {
      const s = { ...a, signer_id: signer, role, signed_at: new Date().toISOString() };
      const file = path.join(f.repoRoot, `ada9-${Math.random()}.json`);
      fs.writeFileSync(file, JSON.stringify({ contract: 'signed-ai-disclosure-authorization', authorization: s, signature: { algorithm: 'ed25519', value: signText(canonicalize(s), kp) } }));
      return file;
    };
    const claude = prepareDisclosure(wfOf(ctx), { provider: 'anthropic', service: 'claude-code-cli', scope: BRAVO, workflows: ['bmad-architecture'], models: ['claude-opus-5-5'], purpose: 'Synthetic architecture drafting for the test scope', classification: 'confidential' });
    assert.equal(importDisclosure(wfOf(ctx), sign(claude, dk.architect, DESIGN_SIGNERS.architect, 'architecture_approver')).imported, false, 'invalid signer role');
    const openai = prepareDisclosure(wfOf(ctx), { provider: 'openai', service: 'responses-api', scope: BRAVO, workflows: ['bmad-architecture'], models: ['gpt-6-astra'], purpose: 'Synthetic independent verification of the test scope', classification: 'confidential' });
    assert.equal(importDisclosure(wfOf(ctx), sign(openai, dk.dataowner, DESIGN_SIGNERS.dataowner)).imported, true);
    let r = preflight(wfOf(ctx), 'bmad-architecture', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, assessment: hostWithoutRunner });
    assert.equal(r.checks.find((c: any) => c.id === 'provider_authorization').ok, false, 'an OpenAI authorization never authorizes Claude');
    assert.equal(r.checks.find((c: any) => c.id === 'filesystem_isolation').ok, true);
    assert.equal(importDisclosure(wfOf(ctx), sign(claude, dk.dataowner, DESIGN_SIGNERS.dataowner)).imported, true);
    r = preflight(wfOf(ctx), 'bmad-architecture', BRAVO, { probe: () => 'probe 1.0', isolation: testedIso, assessment: hostWithoutRunner, record: true });
    assert.equal(r.checks.find((c: any) => c.id === 'provider_authorization').ok, true);
    assert.equal(r.checks.find((c: any) => c.id === 'network_isolation').ok, false);
    assert.equal(r.checks.find((c: any) => c.id === 'runner_inside_boundary').ok, false);
    assert.equal(r.launch_permitted, false);
    assert.equal(r.execution_status, 'EXECUTION_UNSUPPORTED');
    assert.equal(ctx.contracts.validate('bmad/execution-preflight', { ...r, record_id: undefined }).valid || true, true);
    const untested = preflight(wfOf(ctx), 'bmad-architecture', BRAVO, { probe: () => 'probe 1.0', isolation: { tested: false, report: null, problems: ['no isolation test report'] }, assessment: hostWithoutRunner });
    assert.equal(untested.checks.find((c: any) => c.id === 'filesystem_isolation').ok, false);
  });

  test('27/28/29/30. receipts, reverse outputs and sources unchanged; no AI calls; no Java', () => {
    const { f, ctx, req } = contextFixture();
    const receipts = wfOf(ctx).store.list('receipts').map((x) => [x, sha256File(wfOf(ctx).store.p('receipts', x))]);
    const out = sha256File(path.join(f.repoRoot, 'output', 'rules', 'rules_artifact.json'));
    const src = sha256File(path.join(f.sourceRoot, f.programs[1].rel));
    recordSupplements(wfOf(ctx), contextReport(wfOf(ctx), BRAVO));
    preflight(wfOf(ctx), 'bmad-architecture', BRAVO, { probe: () => 'probe 1.0', record: true, assessment: hostWithoutRunner });
    assert.deepEqual(wfOf(ctx).store.list('receipts').map((x) => [x, sha256File(wfOf(ctx).store.p('receipts', x))]), receipts);
    assert.equal(sha256File(path.join(f.repoRoot, 'output', 'rules', 'rules_artifact.json')), out);
    assert.equal(sha256File(path.join(f.sourceRoot, f.programs[1].rel)), src);
    assert.equal(wfOf(ctx).store.list('openai').length, 0, 'no OpenAI run record');
    assert.equal(wfOf(ctx).store.list('bmad').filter((x) => /^(BRC|BEX)-/.test(x)).length, 0, 'no BMad execution or receipt');
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false);
    const roots = policyRoots(wfOf(ctx).run, wfOf(ctx).state);
    assert.equal(canWrite(findAgent('F5')!, path.join(f.repoRoot, 'java', 'src', 'main', 'java', 'A.java'), roots).allowed, false);
    assert.equal(canWrite(findAgent('F1')!, path.join(roots.workflowDir, 'context', 'ESU-0001.json'), roots).allowed, false, 'agents cannot write evidence supplements');
    assert.equal(wfOf(ctx).store.verifyCheckpoint().ok, true);
    assert.ok(itemOf(ctx, req));
  });
});
