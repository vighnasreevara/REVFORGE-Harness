// Evidence parsing, validation and the primary metrics, checked against the
// committed reports read directly (independently of the adapter).
import fs from 'node:fs';
import path from 'node:path';
import { EVIDENCE, realModel } from './evidence';

const raw = (p: string) => JSON.parse(fs.readFileSync(path.join(EVIDENCE, p), 'utf8'));
const S22 = 'forward/reports/step-22';
const S23 = 'forward/reports/step-23';

describe('evidence loading and validation', () => {
  test('every evidence file loads, parses and matches its committed SHA-256', async () => {
    const { model } = await realModel();
    const manifest = raw('manifest.json');
    expect(manifest.totals.missing).toEqual([]);
    expect(manifest.totals.uncommitted).toEqual([]);
    expect(model.validation.datasets.length).toBe(manifest.totals.files - manifest.collections.find((c: { key: string }) => c.key === 'diagrams').files.length);
    for (const d of model.validation.datasets) {
      expect(d.status, d.path).toBe('loaded');
      expect(d.integrity, d.path).toBe('verified');
    }
  });

  test('no validation issue and every cross-check agrees', async () => {
    const { model } = await realModel();
    expect(model.validation.issues).toEqual([]);
    expect(model.validation.crossChecks.length).toBeGreaterThan(100);
    expect(model.validation.crossChecks.filter((c) => !c.ok)).toEqual([]);
  });

  test('preserves source identities', async () => {
    const { model } = await realModel();
    const reg = raw(`${S23}/master-gap-register.json`).records;
    expect(model.gaps!.map((g) => g.id)).toEqual(reg.map((r: { master_id: string }) => r.master_id));
    expect(model.gaps!.map((g) => g.originalId)).toEqual(reg.map((r: { original_id: string | null }) => r.original_id));
    const rules = raw(`${S22}/business-rule-reconciliation.json`).rules;
    expect(model.rules!.map((r) => r.id)).toEqual(rules.map((r: { rule: string }) => r.rule));
  });

  test('absolute local paths in recorded results are shown repository-relative', async () => {
    const { model } = await realModel();
    const text = JSON.stringify([model.programs, model.testing]);
    expect(text).not.toMatch(/[A-Za-z]:\\\\PROJECTS/);
    expect(model.programs!.find((p) => p.id === 'PORTREAD')!.validation.result).toContain('forward/generated/java/PORTREAD');
  });
});

describe('primary metrics agree with the committed reports', () => {
  test('programs', async () => {
    const { model } = await realModel();
    const pr = raw(`${S22}/program-reconciliation.json`);
    const p = model.programs!;
    expect(p.length).toBe(pr.programs.length);
    expect(p.length).toBe(42);
    expect(p.filter((x) => x.javaClass).length).toBe(41);
    expect(p.filter((x) => x.classification === 'COMPLETE').map((x) => x.id).sort()).toEqual(['PORTREAD', 'PROGNAME']);
    expect(p.filter((x) => x.classification === 'PARTIAL').length).toBe(pr.summary.PARTIAL);
    expect(p.filter((x) => x.classification === 'MISSING').map((x) => x.id)).toEqual(['POSUPDT']);
    expect(p.filter((x) => x.readiness.status === 'PASS').length).toBe(6);
    expect(p.filter((x) => x.cobolEquivalence !== 'NOT_ESTABLISHED').length).toBe(0);
  });

  test('business rules', async () => {
    const { model } = await realModel();
    const by = raw(`${S22}/business-rule-reconciliation.json`).summary.by_status;
    const r = model.rules!;
    expect(r.length).toBe(154);
    for (const [k, v] of Object.entries(by)) expect(r.filter((x) => x.status === k).length).toBe(v);
    expect(r.filter((x) => x.status === 'IMPLEMENTED_VERIFIED').length).toBe(67);
    expect(r.filter((x) => x.cobolEquivalent).length).toBe(0);
    expect(r.filter((x) => x.description).length).toBe(154);
  });

  test('gap register totals', async () => {
    const { model } = await realModel();
    const gs = raw(`${S23}/gap-summary.json`);
    const g = model.gaps!;
    expect(g.length).toBe(569);
    expect(g.every((x) => x.status === 'OPEN')).toBe(true);
    for (const [k, v] of Object.entries(gs.by_category)) expect(g.filter((x) => x.category === k).length).toBe(v);
    expect(gs.by_category).toMatchObject({ SOURCE_MISSING: 267, EXTERNAL_DEPENDENCY: 133, BUSINESS_DECISION_REQUIRED: 108, REVERSE_ARTIFACT_QUALITY: 27, SOURCE_DEFECT: 21 });
  });

  test('reverse vs forward coverage equals the STEP-22 final summary', async () => {
    const { model } = await realModel();
    const fs22 = raw(`${S22}/final-summary.json`).metrics as { metric: string; numerator: number; denominator: number }[];
    const want: Record<string, [number, number]> = {
      programs_with_java: [41, 42], programs_complete: [2, 42], paragraphs_mapped: [390, 402], paragraphs_test_executed: [95, 402],
      statements_mapped: [1337, 1936], statements_test_executed: [414, 1936], perform_edges_structural: [397, 524], branches_structural: [190, 254],
      loops_structural: [26, 32], fields_consistent: [966, 1009], records_represented: [196, 231],
    };
    for (const [k, [n, d]] of Object.entries(want)) {
      const row = model.coverage.find((c) => c.metric === k)!;
      const rec = fs22.find((x) => x.metric === k)!;
      expect([row.numerator, row.denominator], k).toEqual([rec.numerator, rec.denominator]);
      expect([row.numerator, row.denominator], k).toEqual([n, d]);
    }
  });

  test('dependency graph keeps its evidence classifications', async () => {
    const { model } = await realModel();
    const g = model.graph!;
    expect([g.nodes.length, g.edges.length]).toEqual([705, 877]);
    const c = (k: string) => g.edges.filter((e) => e.confidence === k).length;
    expect([c('EVIDENCED'), c('EVIDENCED_BY_TEXT'), c('HYPOTHESIS')]).toEqual([794, 38, 45]);
    expect(g.cycles).toEqual([]);
    expect(g.edges.filter((e) => e.confidence === 'HYPOTHESIS').every((e) => e.relation === 'LIKELY_DECLARES')).toBe(true);
  });

  test('roadmap: 570 phase memberships are 569 unique records', async () => {
    const { model } = await realModel();
    const rm = model.roadmap!;
    expect(rm.phases.map((p) => p.phase)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(rm.memberships).toBe(570);
    expect(rm.uniqueMembers).toBe(569);
    expect(rm.multiPhase).toEqual([{ id: 'MGR-0566', phases: ['B', 'D'] }]);
    expect(model.groups!.length).toBe(23);
  });

  test('diagrams', async () => {
    const { model } = await realModel();
    const d = model.diagrams!;
    expect(d.list.length).toBe(65);
    expect(d.list.filter((x) => x.mapping !== 'UNMAPPABLE').length).toBe(60);
    expect(d.summary.processFlowEdges).toMatchObject({ total: 912, supported_by_java_structure: 639, gap_limited: 162, unassessable: 80, not_found_in_java: 31 });
    expect(d.list.every((x) => x.mermaidPath)).toBe(true);
  });

  test('BMad is blocked: six workflows configured, none authorized or executed', async () => {
    const { model } = await realModel();
    const b = model.bmad!;
    expect(b.status).toBe('BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED');
    expect(b.mandatory).toBe(true);
    expect(b.workflows.map((w) => w.bindingId)).toEqual(['BMAD-PRD', 'BMAD-ARCH', 'BMAD-EPICS', 'BMAD-SPRINT', 'BMAD-BUILD', 'BMAD-REVIEW']);
    expect(b.workflows.filter((w) => w.executed || w.authorizationId || w.receiptId)).toEqual([]);
    expect(b.metrics).toMatchObject({ configured_workflows: 6, authorized_workflows: 0, executed_live: 0, verified_receipts: 0, blocked_workflows: 6 });
    expect(b.portread.verdict).toBe('BMAD_BLOCKED');
    expect(b.portread.f6.status).toBe('MISSING');
  });

  test('model building is deterministic', async () => {
    const { bundle, model } = await realModel();
    const { buildModel } = await import('../src/evidence/model');
    expect(JSON.stringify(buildModel(bundle))).toBe(JSON.stringify(model));
  });
});
