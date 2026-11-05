// Builds the dashboard model from the loaded evidence bundle. Pure and
// deterministic: the same bundle always yields the same model. Totals are
// recounted from the detailed records and cross-checked against the recorded
// summaries; any disagreement becomes a validation issue, never a silent fix.
import { Checker, countBy, sameCounts, type CrossCheck } from './check';
import type { Bundle } from './loader';
import type {
  Bmad, BmadWorkflow, CoverageRow, DependencyGraph, Diagram, Gap, GraphEdge, Model, OwnerRole, Program,
  ProgramClass, Ratio, ReadinessDetail, RoadmapPhase, RootCauseGroup, Rule, RuleStatus, RunRecord, Severity, Testing,
} from './types';

type Obj = Record<string, unknown>;
const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low'];

/** Repository-relative form of an absolute path recorded by a local run. */
export function relativizePaths(text: string): string {
  return text.replace(/[A-Za-z]:[\\/][^\s()]*?REVFORGE-Harness[\\/]([^\s()]*)/g, (_m, rest: string) => rest.replace(/\\/g, '/'));
}

const o = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const a = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const s = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const counts = (v: unknown): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [k, x] of Object.entries(o(v))) if (typeof x === 'number') out[k] = x;
  return out;
};

export function buildModel(bundle: Bundle): Model {
  const crossChecks: CrossCheck[] = [];
  const data = bundle.data;
  const has = (k: string) => data[k] !== undefined;

  const model: Model = {
    manifest: bundle.manifest,
    baselineCommit: bundle.manifest?.baseline_commit ?? null,
    step22BaselineCommit: null,
    summary: { ratios: {}, gapsBySeverity: null, gapsByDependency: null, reverseHistorical: null, bmadStatus: null, cobolEquivalence: null, acceptance: [] },
    coverage: [],
    programs: null,
    rules: null,
    gaps: null,
    gapSummary: null,
    graph: null,
    groups: null,
    roadmap: null,
    owners: null,
    diagrams: null,
    bmad: null,
    testing: null,
    jcl: null,
    validation: { issues: [...bundle.issues], crossChecks, datasets: bundle.datasets },
  };
  const issues = model.validation.issues;
  const checker = (dataset: string) => {
    const c = new Checker(dataset);
    (c as { issues: unknown }).issues = issues;
    return c;
  };

  // ---- STEP-22 final summary -------------------------------------------------
  if (has('finalSummary')) {
    const c = checker('finalSummary');
    const fs = c.obj(data.finalSummary, 'final-summary') ?? {};
    model.step22BaselineCommit = s(fs.baseline_commit);
    for (const m of c.arr<Obj>(fs.metrics, 'metrics') ?? []) {
      const metric = c.str(m.metric, 'metrics[].metric');
      const num = c.num(m.numerator, `${metric}.numerator`);
      const den = c.num(m.denominator, `${metric}.denominator`);
      if (metric && num !== undefined && den !== undefined) {
        if (num > den) c.report('error', `${metric}: numerator ${num} exceeds denominator ${den}`);
        model.summary.ratios[metric] = { metric, numerator: num, denominator: den, definition: s(m.definition) ?? '', source: `forward/reports/step-22/${s(m.source) ?? 'final-summary.json'}` };
      }
    }
    const g = o(fs.gaps);
    model.summary.gapsBySeverity = counts(g.by_severity);
    model.summary.gapsByDependency = counts(g.by_dependency);
    if (n(g.reverse_historical) !== null) model.summary.reverseHistorical = { total: n(g.reverse_historical)!, disposition: counts(g.reverse_disposition) };
    model.summary.bmadStatus = s(fs.bmad);
    model.summary.cobolEquivalence = s(fs.cobol_equivalence);
    model.summary.acceptance = a<Obj>(fs.acceptance).map((x) => ({ criterion: s(x.criterion) ?? '', met: x.met === true }));
  }
  const ratio = (k: string): Ratio | undefined => model.summary.ratios[k];

  // ---- Register (STEP-23) --------------------------------------------------------
  let gapIndex = new Map<string, Gap>();
  if (has('register')) {
    const c = checker('register');
    const recs = c.arr<Obj>(o(data.register).records, 'records') ?? [];
    const gaps: Gap[] = [];
    for (const r of recs) {
      const id = c.str(r.master_id, 'records[].master_id');
      if (!id) continue;
      const sev = s(r.severity) as Severity | null;
      if (!sev || !SEVERITY_ORDER.includes(sev)) c.report('error', `${id}: unknown severity ${String(r.severity)}`);
      gaps.push({
        id,
        originalId: s(r.original_id),
        inventoryCategory: s(r.inventory_category) ?? '',
        sourceRun: s(r.source_run) ?? '',
        sourceReference: s(r.source_reference) ?? '',
        stableRef: s(r.stable_ref),
        sourcePath: s(r.source_path),
        sourceLine: n(r.source_line),
        sourceIdentity: (Array.isArray(r.source_identity) ? a<string>(r.source_identity) : s(r.source_identity)) ?? null,
        sourceSha256: s(r.source_sha256),
        evidenceSha256: s(r.evidence_sha256),
        forwardReference: s(r.forward_reference),
        kind: s(r.kind) ?? '',
        subject: s(r.subject) ?? '',
        description: s(r.description) ?? '',
        programs: a<string>(r.programs),
        javaClasses: a<string>(r.java_classes),
        paragraphs: a(r.paragraphs),
        statements: a(r.statements),
        dataItems: a<string>(r.data_items),
        copybooks: a<string>(r.copybooks),
        severity: (sev ?? 'low') as Severity,
        dependencyGroup: s(r.repository_dependency_group),
        category: s(r.category) ?? '',
        rootCauseGroup: s(r.root_cause_group) ?? '',
        rootCause: s(r.root_cause) ?? '',
        priority: (s(r.priority) ?? '') as Gap['priority'],
        priorityRationale: s(r.priority_rationale) ?? '',
        status: s(r.status) ?? '',
        verificationState: s(r.verification_state) ?? '',
        rules: a<string>(r.rules),
        ruleLinks: a(r.rule_links),
        diagrams: a<string>(r.diagrams),
        jclJobs: a<string>(r.jcl_jobs),
        externalDependencies: a<string>(r.external_dependencies),
        owner: s(r.owner) ?? '',
        approver: s(r.approver),
        externalOwner: s(r.external_owner),
        requiredTechnicalAction: s(r.required_technical_action),
        requiredBusinessDecision: s(r.required_business_decision),
        requiredSourceCorrection: s(r.required_source_correction),
        requiredExternalSystem: s(r.required_external_system),
        approvalRequirements: s(r.approval_requirements),
        verificationMethod: s(r.verification_method),
        closureCriteria: s(r.closure_criteria),
        resolutionEvidence: r.resolution_evidence ?? null,
        originalScope: s(r.original_scope),
        reverseClassification: s(r.reverse_classification),
        nextAction: s(r.required_technical_action) ?? s(r.required_business_decision) ?? s(r.required_source_correction) ?? s(r.required_external_system),
        blockedBy: [],
        blocks: [],
      });
      if (!s(r.owner)) c.report('error', `${id}: no owner role recorded`);
    }
    const ids = gaps.map((g) => g.id);
    if (new Set(ids).size !== ids.length) c.report('error', 'duplicate master gap identities');
    gapIndex = new Map(gaps.map((g) => [g.id, g]));
    model.gaps = gaps;
  }

  if (has('gapSummary')) {
    const c = checker('gapSummary');
    const gs = c.obj(data.gapSummary, 'gap-summary') ?? {};
    const rh = o(gs.reverse_historical);
    model.gapSummary = {
      total: c.num(gs.total, 'total') ?? NaN,
      byInventory: counts(gs.by_inventory_category),
      byCategory: counts(gs.by_category),
      bySeverity: counts(gs.by_severity),
      byPriority: counts(gs.by_priority),
      byStatus: counts(gs.by_status),
      byOwner: counts(gs.by_owner),
      reverseHistorical: n(rh.total) !== null ? { total: n(rh.total)!, disposition: counts(rh.disposition), arithmetic: s(rh.arithmetic) ?? '' } : null,
    };
    if (model.gaps) {
      const g = model.gaps;
      const sum = model.gapSummary;
      crossChecks.push(c.equal('register.total', sum.total, g.length, 'gap-summary total and register records'));
      const pairs: [string, Record<string, number>, (x: Gap) => string][] = [
        ['by_inventory_category', sum.byInventory, (x) => x.inventoryCategory],
        ['by_category', sum.byCategory, (x) => x.category],
        ['by_severity', sum.bySeverity, (x) => x.severity],
        ['by_priority', sum.byPriority, (x) => x.priority],
        ['by_status', sum.byStatus, (x) => x.status],
        ['by_owner', sum.byOwner, (x) => x.owner],
      ];
      for (const [name, recorded, key] of pairs) {
        const ok = sameCounts(recorded, countBy(g, key));
        crossChecks.push({ name: `register.${name}`, dataset: 'gapSummary', expected: Object.keys(recorded).length, actual: Object.keys(countBy(g, key)).length, ok, detail: `gap-summary ${name} equals the recount of register records` });
        if (!ok) c.report('error', `register.${name}: gap-summary differs from the recount of the register`);
      }
      if (model.summary.gapsBySeverity) {
        const ok = sameCounts(model.summary.gapsBySeverity, countBy(g, (x) => x.severity));
        crossChecks.push({ name: 'register.severity_vs_step22', dataset: 'finalSummary', expected: 569, actual: g.length, ok, detail: 'STEP-22 final-summary severity counts equal the STEP-23 register' });
        if (!ok) c.report('error', 'STEP-22 severity counts differ from the STEP-23 register');
      }
    }
  }

  // ---- Dependency graph ----------------------------------------------------------
  if (has('dependencyGraph')) {
    const c = checker('dependencyGraph');
    const dg = c.obj(data.dependencyGraph, 'dependency-graph') ?? {};
    const nodes = (c.arr<Obj>(dg.nodes, 'nodes') ?? []).map((x) => ({ id: s(x.id) ?? '', type: s(x.type) ?? '', label: s(x.label) ?? s(x.id) ?? '' }));
    const edges: GraphEdge[] = (c.arr<Obj>(dg.edges, 'edges') ?? []).map((x) => ({
      from: s(x.from) ?? '',
      to: s(x.to) ?? '',
      relation: s(x.relation) ?? '',
      evidence: s(x.evidence) ?? '',
      confidence: (s(x.confidence) ?? '') as GraphEdge['confidence'],
    }));
    const sm = o(dg.summary);
    const graph: DependencyGraph = {
      nodes,
      edges,
      rootBlockers: a<string>(dg.root_blockers),
      independentGaps: a<string>(dg.independent_gaps),
      cycles: a(sm.cycles),
      summary: {
        nodes: n(sm.nodes) ?? NaN,
        edges: n(sm.edges) ?? NaN,
        byRelation: counts(sm.by_relation),
        byConfidence: counts(sm.by_confidence),
        rootBlockers: n(sm.root_blockers) ?? NaN,
        independentGaps: n(sm.independent_gaps) ?? NaN,
      },
    };
    const nodeIds = new Set(nodes.map((x) => x.id));
    const dangling = edges.filter((e) => !nodeIds.has(e.from) || !nodeIds.has(e.to)).length;
    if (dangling) c.report('error', `${dangling} edge(s) reference unknown nodes`);
    const unknownConf = edges.filter((e) => !['EVIDENCED', 'EVIDENCED_BY_TEXT', 'HYPOTHESIS'].includes(e.confidence)).length;
    if (unknownConf) c.report('error', `${unknownConf} edge(s) have no recognised confidence`);
    crossChecks.push(c.equal('graph.nodes', graph.summary.nodes, nodes.length, 'recorded and counted nodes'));
    crossChecks.push(c.equal('graph.edges', graph.summary.edges, edges.length, 'recorded and counted edges'));
    for (const conf of ['EVIDENCED', 'EVIDENCED_BY_TEXT', 'HYPOTHESIS'])
      crossChecks.push(c.equal(`graph.${conf}`, graph.summary.byConfidence[conf], edges.filter((e) => e.confidence === conf).length, `recorded and counted ${conf} edges`));
    crossChecks.push(c.equal('graph.root_blockers', graph.summary.rootBlockers, graph.rootBlockers.length, 'recorded and listed root blockers'));
    crossChecks.push(c.equal('graph.cycles', 0, findCycle(edges) ? 1 : 0, 'expected and detected cycles'));
    // Gap-to-gap relations on each register record.
    for (const e of edges) {
      const from = gapIndex.get(e.from);
      const to = gapIndex.get(e.to);
      if (from && to) {
        from.blocks.push(e.to);
        to.blockedBy.push(e.from);
      }
    }
    model.graph = graph;
  }

  // ---- Root-cause groups, roadmap, ownership ------------------------------------
  if (has('rootCauseGroups')) {
    const c = checker('rootCauseGroups');
    model.groups = (c.arr<Obj>(o(data.rootCauseGroups).groups, 'groups') ?? []).map((g): RootCauseGroup => {
      const members = a<string>(g.members);
      const recs = members.map((m) => gapIndex.get(m)).filter((x): x is Gap => !!x);
      if (model.gaps && recs.length !== members.length) c.report('error', `${s(g.group_id)}: ${members.length - recs.length} member(s) not in the register`);
      const id = s(g.group_id) ?? '';
      crossChecks.push(c.equal(`group.${id}.members`, n(g.member_count) ?? undefined, members.length, 'recorded member_count and listed members'));
      return {
        id,
        title: s(g.title) ?? '',
        category: s(g.category) ?? '',
        rootCause: s(g.root_cause) ?? '',
        members,
        memberCount: members.length,
        programs: a<string>(g.programs),
        rules: a<string>(g.rules),
        dependencies: a<string>(g.dependencies),
        owner: s(g.owner) ?? '',
        externalOwner: s(g.external_owner),
        resolutionRequirements: s(g.resolution_requirements) ?? '',
        validationEvidence: s(g.validation_evidence) ?? '',
        severityMix: countBy(recs, (x) => x.severity),
        priorityMix: countBy(recs, (x) => x.priority),
      };
    });
    if (model.gaps) {
      const covered = model.groups.flatMap((g) => g.members);
      crossChecks.push(c.equal('groups.cover_register_once', model.gaps.length, new Set(covered).size === covered.length ? covered.length : -1, 'register records and group members (each exactly once)'));
    }
  }

  if (has('roadmap')) {
    const c = checker('roadmap');
    const sizes = new Map((model.groups ?? []).map((g) => [g.id, g.members] as const));
    const phases: RoadmapPhase[] = (c.arr<Obj>(o(data.roadmap).phases, 'phases') ?? []).map((p) => {
      const groups = a<string>(p.groups);
      const recounted = groups.reduce((t, g) => t + (sizes.get(g)?.length ?? 0), 0);
      const phase = s(p.phase) ?? '';
      if (model.groups) crossChecks.push(c.equal(`roadmap.${phase}.gaps`, n(p.gaps) ?? undefined, recounted, `phase ${phase} recorded gaps and its groups' members`));
      return {
        phase,
        title: s(p.title) ?? '',
        groups,
        gaps: n(p.gaps) ?? NaN,
        roles: a<string>(p.roles),
        prerequisites: s(p.prerequisites) ?? '',
        requiredEvidence: s(p.required_evidence) ?? '',
        exitCriteria: s(p.exit_criteria) ?? '',
        remainingBlockers: s(p.remaining_blockers) ?? '',
        recountedMembers: recounted,
      };
    });
    const where = new Map<string, string[]>();
    for (const p of phases) for (const g of p.groups) for (const m of sizes.get(g) ?? []) where.set(m, [...(where.get(m) ?? []), p.phase]);
    const memberships = [...where.values()].reduce((t, v) => t + v.length, 0);
    model.roadmap = {
      phases,
      memberships,
      uniqueMembers: where.size,
      multiPhase: [...where.entries()].filter(([, v]) => v.length > 1).map(([id, v]) => ({ id, phases: v })).sort((x, y) => x.id.localeCompare(y.id)),
    };
    if (model.gaps) crossChecks.push(c.equal('roadmap.unique_members', model.gaps.length, where.size, 'register records and unique phase members'));
  }

  if (has('ownershipMatrix')) {
    const c = checker('ownershipMatrix');
    const om = o(data.ownershipMatrix);
    const roles: OwnerRole[] = (c.arr<Obj>(om.roles, 'roles') ?? []).map((r) => ({
      role: s(r.role) ?? '',
      gaps: n(r.gaps) ?? NaN,
      groups: a<string>(r.groups),
      approvers: a<string>(r.approvers),
      externalOwners: a<string>(r.external_owners),
    }));
    model.owners = { roles, ownerReviewRequired: n(om.owner_review_required) ?? NaN, names: s(om.names) ?? '' };
    if (model.gaps) {
      const byOwner = countBy(model.gaps, (g) => g.owner);
      for (const r of roles) crossChecks.push(c.equal(`owner.${r.role}`, r.gaps, byOwner[r.role] ?? 0, `ownership matrix and register records for ${r.role}`));
    }
  }

  // ---- Programs -------------------------------------------------------------------
  if (has('programRecon')) {
    const c = checker('programRecon');
    const pr = c.obj(data.programRecon, 'program-reconciliation') ?? {};
    const impacts = new Map(a<Obj>(o(data.programGapImpact).programs).map((x) => [s(x.program) ?? '', x]));
    const byProgram = new Map<string, Gap[]>();
    for (const g of model.gaps ?? []) for (const p of g.programs) byProgram.set(p, [...(byProgram.get(p) ?? []), g]);
    const programs: Program[] = (c.arr<Obj>(pr.programs, 'programs') ?? []).map((p) => {
      const id = s(p.program) ?? '';
      const cls = s(p.classification) as ProgramClass;
      if (!['COMPLETE', 'PARTIAL', 'MISSING'].includes(cls)) c.report('error', `${id}: unknown classification ${String(p.classification)}`);
      const im = impacts.get(id);
      const t = o(p.tests);
      const own = byProgram.get(id) ?? [];
      const sev = SEVERITY_ORDER.find((x) => own.some((g) => g.severity === x)) ?? null;
      const para = o(p.paragraphs);
      return {
        id,
        fileId: s(p.file_id) ?? '',
        source: s(p.source) ?? '',
        sourceSha256: s(p.source_sha256) ?? '',
        javaClass: s(p.java_class),
        javaFiles: a<string>(p.java_files),
        localAuthorization: s(p.local_authorization),
        classification: cls,
        paragraphs: { reverse: n(para.reverse), mapped: n(para.mapped), testExecuted: n(para.test_executed) },
        statements: counts(p.statements),
        ruleStatuses: counts(p.business_rules),
        ruleIds: a<string>(p.rule_ids),
        dependencies: a<Obj>(p.dependencies).map((d) => ({ type: s(d.type) ?? '', to: s(d.to) ?? '', forward: s(d.forward) ?? '' })),
        unsupported: counts(p.unsupported_statements),
        tests: {
          checks: (t.checks as Program['tests']['checks']) ?? null,
          scenarios: (t.scenarios as Program['tests']['scenarios']) ?? null,
          statementCoverage: (t.statement_coverage as Program['tests']['statementCoverage']) ?? null,
        },
        validation: { exitCode: n(o(p.validation).exit_code), result: relativizePaths(s(o(p.validation).result) ?? '') },
        readiness: { status: s(o(p.readiness).status) ?? '', failingChecks: a<string>(o(p.readiness).failing_checks) },
        forwardGapIds: a<string>(o(p.remaining_gaps).register_ids),
        bmadGovernance: s(p.bmad_governance),
        cobolEquivalence: s(p.cobol_equivalence) ?? '',
        impact: im
          ? {
              gaps: n(im.gaps) ?? NaN,
              critical: n(im.critical) ?? NaN,
              high: n(im.high) ?? NaN,
              byCategory: counts(im.by_category),
              rootBlockers: a<string>(im.root_blockers),
              directReadinessBlockers: a<string>(im.direct_readiness_blockers),
              externalBlockers: n(im.external_blockers) ?? NaN,
              businessDecisionBlockers: n(im.business_decision_blockers) ?? NaN,
              verificationBlockers: n(im.verification_blockers) ?? NaN,
              nextActions: a<string>(im.next_actions),
              note: s(im.note) ?? '',
            }
          : null,
        gapIds: own.map((g) => g.id),
        maxSeverity: sev,
        readinessDetail: readinessDetail(bundle.readiness[id], id),
      };
    });
    model.programs = programs;
    const sm = counts(pr.summary);
    const byClass = countBy(programs, (p) => p.classification);
    for (const k of ['COMPLETE', 'PARTIAL', 'MISSING']) crossChecks.push(c.equal(`programs.${k}`, sm[k], byClass[k] ?? 0, `recorded and counted ${k} programs`));
    crossChecks.push(c.equal('programs.complete_vs_step22', ratio('programs_complete')?.numerator, byClass.COMPLETE ?? 0, 'final-summary programs_complete and program records'));
    crossChecks.push(c.equal('programs.with_java', ratio('programs_with_java')?.numerator, programs.filter((p) => p.javaClass).length, 'final-summary programs_with_java and program records'));
    crossChecks.push(c.equal('programs.total', ratio('programs_with_java')?.denominator, programs.length, 'final-summary program total and program records'));
    crossChecks.push(c.equal('programs.validation_pass', ratio('validation_pass')?.numerator, programs.filter((p) => p.validation.exitCode === 0).length, 'final-summary validation_pass and program validation exit codes'));
    crossChecks.push(c.equal('programs.readiness_pass', ratio('readiness_pass')?.numerator, programs.filter((p) => p.readiness.status === 'PASS').length, 'final-summary readiness_pass and program readiness'));
    const readinessFiles = Object.values(bundle.readiness).map(o);
    if (readinessFiles.length) {
      crossChecks.push(c.equal('readiness.files', programs.length, readinessFiles.length, 'programs and committed readiness results'));
      crossChecks.push(c.equal('readiness.files_pass', ratio('readiness_pass')?.numerator, readinessFiles.filter((r) => r.status === 'PASS').length, 'final-summary readiness_pass and readiness result files'));
    }
    const impactSummary = o(o(data.programGapImpact).summary);
    if (n(impactSummary.readiness_pass) !== null) crossChecks.push(c.equal('readiness.step23', n(impactSummary.readiness_pass)!, programs.filter((p) => p.readiness.status === 'PASS').length, 'STEP-23 program-gap-impact readiness_pass and STEP-22 program records'));
    for (const p of programs) if (p.cobolEquivalence !== 'NOT_ESTABLISHED') c.report('warning', `${p.id}: cobol_equivalence is ${p.cobolEquivalence}`);
  }

  // ---- Business rules -------------------------------------------------------------
  if (has('ruleRecon')) {
    const c = checker('ruleRecon');
    const rr = c.obj(data.ruleRecon, 'business-rule-reconciliation') ?? {};
    const impacts = new Map(a<Obj>(o(data.ruleGapImpact).rules).map((x) => [s(x.rule) ?? '', x]));
    const reverse = new Map(a<Obj>(o(data.rulesArtifact).business_rules).map((x) => [s(x.rule_id) ?? '', x]));
    const rules: Rule[] = (c.arr<Obj>(rr.rules, 'rules') ?? []).map((r) => {
      const id = s(r.rule) ?? '';
      const im = impacts.get(id);
      const rv = o(r.reverse);
      const ra = reverse.get(id);
      const status = s(r.status) as RuleStatus;
      if (!['IMPLEMENTED_VERIFIED', 'IMPLEMENTED_VERIFIED_TO_GAP', 'IMPLEMENTED_NOT_EXERCISED', 'BLOCKED'].includes(status)) c.report('error', `${id}: unknown status ${String(r.status)}`);
      return {
        id,
        name: s(r.name) ?? '',
        category: s(r.category) ?? '',
        program: s(r.program) ?? '',
        cobol: s(r.cobol) ?? '',
        java: s(r.java),
        tests: a<Obj>(r.tests).map((t) => ({ scenario: s(t.scenario) ?? '', result: s(t.result) ?? '', asserted: a<string>(t.asserted) })),
        verifiedBehaviour: s(r.verified_behaviour) ?? '',
        unverifiedBehaviour: s(r.unverified_behaviour) ?? '',
        status,
        classification: s(r.classification) ?? '',
        implemented: r.implemented === true,
        cobolEquivalent: r.cobol_equivalent === true,
        reverse: {
          confidence: s(rv.confidence),
          requiresSmeReview: typeof rv.requires_sme_review === 'boolean' ? rv.requires_sme_review : null,
          condition: s(rv.condition),
          statementId: s(rv.statement_id),
          paragraph: s(rv.paragraph),
        },
        description: ra ? s(ra.description) : null,
        ruleSet: ra ? s(ra.rule_set_id) : null,
        gapIds: im ? a<string>(im.gaps) : [],
        flags: im
          ? {
              blockedByMissingImplementation: im.blocked_by_missing_implementation === true,
              affectedByMissingSource: im.affected_by_missing_source === true,
              requiresBusinessDecision: im.requires_business_decision === true,
              needsExternalEnvironment: im.needs_external_environment === true,
              implementedNotIndependentlyVerified: im.implemented_not_independently_verified === true,
              awaitingLegacyEquivalence: im.awaiting_legacy_equivalence === true,
            }
          : null,
      };
    });
    model.rules = rules;
    const recorded = counts(o(rr.summary).by_status);
    const recount = countBy(rules, (r) => r.status);
    for (const k of Object.keys(recorded)) crossChecks.push(c.equal(`rules.${k}`, recorded[k], recount[k] ?? 0, `recorded and counted ${k} rules`));
    crossChecks.push(c.equal('rules.total', ratio('rules_source_derived_tested')?.denominator, rules.length, 'final-summary rule total and rule records'));
    crossChecks.push(c.equal('rules.verified_vs_step22', ratio('rules_source_derived_tested')?.numerator, recount.IMPLEMENTED_VERIFIED ?? 0, 'final-summary verified rules and rule records'));
    crossChecks.push(c.equal('rules.to_gap_vs_step22', ratio('rules_tested_up_to_gap')?.numerator, recount.IMPLEMENTED_VERIFIED_TO_GAP ?? 0, 'final-summary rules verified to a gap and rule records'));
    crossChecks.push(c.equal('rules.blocked_vs_step22', ratio('rules_blocked')?.numerator, recount.BLOCKED ?? 0, 'final-summary blocked rules and rule records'));
    crossChecks.push(c.equal('rules.cobol_equivalent', ratio('rules_cobol_equivalent')?.numerator, rules.filter((r) => r.cobolEquivalent).length, 'final-summary COBOL-equivalent rules and rule records'));
    const linked = rules.filter((r) => r.gapIds.length > 0).length;
    const recLinked = n(o(o(data.ruleGapImpact).summary).with_linked_gaps);
    if (recLinked !== null) crossChecks.push(c.equal('rules.with_linked_gaps', recLinked, linked, 'STEP-23 rules with linked gaps and rule records'));
    if (model.gaps) {
      const missing = rules.flatMap((r) => r.gapIds).filter((g) => !gapIndex.has(g));
      if (missing.length) c.report('error', `${missing.length} rule-to-gap link(s) name records not in the register`);
    }
  }

  // ---- STEP-22 detail recounts (comparison page) ---------------------------------
  const recount = (dataset: string, metric: string, num: number | undefined, den: number | undefined) => {
    const r = ratio(metric);
    const c = checker(dataset);
    crossChecks.push(c.equal(`${metric}.numerator`, r?.numerator, num, `final-summary ${metric} numerator and ${dataset} records`));
    crossChecks.push(c.equal(`${metric}.denominator`, r?.denominator, den, `final-summary ${metric} denominator and ${dataset} records`));
  };
  const rows = (k: string, field: string) => a<Obj>(o(data[k])[field]);
  const where = <T extends Obj>(list: T[], f: (x: T) => boolean) => list.filter(f).length;
  const breakdowns: Record<string, Record<string, number>> = {};
  if (has('paragraphRecon')) {
    const p = rows('paragraphRecon', 'paragraphs');
    recount('paragraphRecon', 'paragraphs_mapped', where(p, (x) => x.mapping === 'STRUCTURAL'), p.length);
    recount('paragraphRecon', 'paragraphs_test_executed', where(p, (x) => x.evidence === 'TEST_VERIFIED'), p.length);
    breakdowns.paragraphs = countBy(p, (x) => String(x.evidence));
  }
  if (has('statementRecon')) {
    const st = rows('statementRecon', 'statements');
    recount('statementRecon', 'statements_mapped', where(st, (x) => x.forward === 'MAPPED'), st.length);
    recount('statementRecon', 'statements_test_executed', where(st, (x) => x.execution === 'TEST_EXECUTED'), st.length);
    recount('statementRecon', 'statements_at_gaps', where(st, (x) => x.forward === 'GAP'), st.length);
    breakdowns.statements = countBy(st, (x) => String(x.execution));
  }
  if (has('controlFlowRecon')) {
    for (const [field, metric] of [['perform_edges', 'perform_edges_structural'], ['branches', 'branches_structural'], ['loops', 'loops_structural']] as const) {
      const list = rows('controlFlowRecon', field);
      recount('controlFlowRecon', metric, where(list, (x) => x.forward === 'STRUCTURAL'), list.length);
      breakdowns[field] = countBy(list, (x) => String(x.forward));
    }
  }
  if (has('fieldRecon')) {
    const f = rows('fieldRecon', 'fields_rows');
    recount('fieldRecon', 'fields_consistent', where(f, (x) => x.forward === 'CONSISTENT'), f.length);
    const cond = rows('fieldRecon', 'conditions');
    recount('fieldRecon', 'conditions_value_checked', where(cond, (x) => x.evidence === 'TEST_VERIFIED'), cond.length);
  }
  if (has('recordRecon')) {
    const r = rows('recordRecon', 'records');
    recount('recordRecon', 'records_represented', where(r, (x) => x.forward === 'REPRESENTED'), r.length);
  }
  if (has('copybookRecon')) {
    const cb = rows('copybookRecon', 'copybooks');
    recount('copybookRecon', 'copybooks_complete', where(cb, (x) => x.status === 'MODEL' || x.status === 'COMPLETE_IN_PROGRAM'), where(cb, (x) => x.status !== 'NOT_USED'));
    breakdowns.copybooks = countBy(cb, (x) => String(x.status));
  }
  if (has('jclRecon')) {
    const jobs = rows('jclRecon', 'jobs');
    recount('jclRecon', 'jcl_end_to_end_tested', where(jobs, (x) => x.status === 'IMPLEMENTED_TEST_VERIFIED'), jobs.length);
    breakdowns.jcl = countBy(jobs, (x) => String(x.status));
    model.jcl = jobs.map((j) => ({ job: s(j.job) ?? '', source: s(j.source) ?? '', status: s(j.status) ?? '', integrationTest: s(j.integration_test) ?? '', forwardJob: s(j.forward_job), restart: s(j.restart) ?? '' }));
  }

  // ---- Diagrams -------------------------------------------------------------------
  if (has('diagramRecon')) {
    const c = checker('diagramRecon');
    const dr = c.obj(data.diagramRecon, 'diagram-reconciliation') ?? {};
    const impacts = new Map(a<Obj>(o(data.diagramGapImpact).diagrams).map((x) => [s(x.diagram_id) ?? '', x]));
    const paths = new Set(bundle.diagramPaths);
    const list: Diagram[] = (c.arr<Obj>(dr.diagrams, 'diagrams') ?? []).map((d) => {
      const id = s(d.diagram_id) ?? '';
      const im = impacts.get(id);
      const file = s(d.file) ?? '';
      return {
        id,
        type: s(d.type) ?? '',
        file,
        title: s(d.title) ?? id,
        program: s(d.program),
        programs: im ? a<string>(im.programs) : a<string>(d.programs),
        javaClass: s(d.java_class),
        mapping: s(d.mapping) ?? '',
        reverseNodes: n(d.reverse_nodes) ?? NaN,
        reverseEdges: n(d.reverse_edges) ?? NaN,
        edgesClassified: counts(d.edges_classified),
        edgesNotFoundInJava: a(d.edges_not_found_in_java).length,
        unresolvedNodes: a<string>(d.unresolved_nodes),
        rulesAnnotated: a<string>(d.rules_annotated),
        incomplete: d.incomplete === true,
        truncated: d.truncated === true,
        nodesByForwardMapping: counts(d.nodes_by_forward_mapping),
        gaps: im ? n(im.gaps) : null,
        gapGroups: im ? counts(im.gap_groups) : {},
        mermaidPath: paths.has(file) ? file : null,
        note: s(d.note),
      };
    });
    const sm = o(dr.summary);
    const pfe = counts(sm.process_flow_edges);
    model.diagrams = {
      list,
      summary: { total: n(sm.total) ?? NaN, byType: counts(sm.by_type), mapping: counts(sm.mapping), processFlowEdges: pfe, edgesNotFoundInJava: list.reduce((t, d) => t + d.edgesNotFoundInJava, 0) },
    };
    crossChecks.push(c.equal('diagrams.total', model.diagrams.summary.total, list.length, 'recorded and listed diagrams'));
    crossChecks.push(c.equal('diagrams_mappable.numerator', ratio('diagrams_mappable')?.numerator, list.filter((d) => d.mapping !== 'UNMAPPABLE').length, 'final-summary mappable diagrams and diagram records'));
    crossChecks.push(c.equal('diagrams.gap_limited', pfe.gap_limited, list.reduce((t, d) => t + gapLimitedEdges(d), 0), 'recorded and counted gap-limited process-flow edges'));
    crossChecks.push(c.equal('diagrams.not_found_in_java', pfe.not_found_in_java, model.diagrams.summary.edgesNotFoundInJava, 'recorded and counted process-flow edges without a Java counterpart'));
    crossChecks.push(c.equal('diagram_process_edges_supported.numerator', ratio('diagram_process_edges_supported')?.numerator, pfe.supported_by_java_structure, 'final-summary and diagram-reconciliation supported edges'));
    crossChecks.push(c.equal('diagrams.mermaid_sources', list.length, list.filter((d) => d.mermaidPath).length, 'diagram records and committed Mermaid sources'));
  }

  // ---- BMad governance --------------------------------------------------------------
  if (has('bmadStatus') || has('bmadBlockers')) {
    const c = checker('bmad');
    const st = o(data.bmadStatus);
    const bl = o(data.bmadBlockers);
    const run = data.governedRun !== undefined ? o(data.governedRun) : null;
    const bindings = o(data.bmadBindings);
    const stages = new Map(a<Obj>(run?.stages).map((x) => [s(x.binding_id) ?? '', x]));
    const workflows: BmadWorkflow[] = a<Obj>(bindings.bindings).map((b, i) => {
      const id = s(b.binding_id) ?? '';
      const stg = stages.get(id);
      const status = stg ? s(stg.status) : null;
      return {
        order: i + 1,
        bindingId: id,
        workflowId: s(b.workflow_id) ?? '',
        purpose: s(b.purpose) ?? '',
        agent: s(b.agent) ?? '',
        allowedStates: a<string>(b.allowed_states),
        requiresGates: a<string>(b.requires_gates),
        mayWriteCode: b.may_write_code === true,
        mayApprove: b.may_approve === true,
        configured: true,
        stage: stg ? s(stg.stage) : null,
        stageStatus: status,
        preflightId: stg ? s(stg.preflight_id) : null,
        authorizationId: stg ? s(stg.authorization_id) : null,
        receiptId: stg ? s(stg.receipt_id) : null,
        executed: !!stg && status === 'RECEIPT_VERIFIED' && !!s(stg.receipt_id),
        blockers: stg ? a<string>(stg.blockers) : [],
      };
    });
    const pr = o(st.portread);
    const ie = o(pr.independent_evidence);
    const metrics = counts(st.metrics);
    const bmad: Bmad = {
      status: s(st.status) ?? s(bl.status) ?? '',
      release: s(st.release) ?? '',
      mandatory: st.mandatory === true,
      bindingsValid: st.bindings_valid === true,
      liveRequested: o(bindings.live_execution).requested === true,
      metrics,
      portread: {
        verdict: s(pr.verdict) ?? '',
        exitCode: n(pr.exit_code),
        f2: { status: s(o(ie.f2).status) ?? '', units: a<string>(o(ie.f2).units), missing: a<string>(o(ie.f2).missing) },
        f6: { status: s(o(ie.f6).status) ?? '', receipts: a(o(ie.f6).receipts) },
      },
      localJava: { programs: n(o(st.local_java).programs) ?? NaN, classification: s(o(st.local_java).classification) ?? '' },
      governedRun: run
        ? {
            id: s(run.record_id) ?? '',
            scope: s(run.scope) ?? '',
            status: s(run.status) ?? '',
            mode: s(run.execution_mode) ?? '',
            startedAt: s(run.started_at) ?? '',
            endedAt: s(run.ended_at) ?? '',
            fallback: s(run.fallback) ?? '',
            localConversionInvoked: run.local_conversion_invoked === true,
            note: s(run.note) ?? '',
          }
        : null,
      preflight: s(bl.preflight),
      blockers: a<Obj>(bl.blockers).map((x) => ({ check: s(x.check) ?? '', detail: s(x.detail) ?? '' })),
      disclosure: Object.keys(o(bl.disclosure_request)).length
        ? {
            authorizationId: s(o(bl.disclosure_request).authorization_id) ?? '',
            signed: o(bl.disclosure_request).signed === true,
            expiresAt: s(o(bl.disclosure_request).expires_at) ?? '',
            note: s(o(bl.disclosure_request).note) ?? '',
          }
        : null,
      independentAgents: a<Obj>(bindings.independent_agents).map((x) => ({ agent: s(x.agent) ?? '', reason: s(x.reason) ?? '' })),
      registerRecords: a<string>(bl.register_records),
      workflows,
    };
    if (s(st.status) && s(bl.status) && st.status !== bl.status) c.report('error', 'STEP-22 and STEP-23 BMad status differ');
    if (workflows.length) {
      crossChecks.push(c.equal('bmad.configured', metrics.configured_workflows, workflows.length, 'recorded configured workflows and bindings'));
      crossChecks.push(c.equal('bmad.executed', metrics.executed_live, workflows.filter((w) => w.executed).length, 'recorded live executions and governed-run stages with verified receipts'));
      crossChecks.push(c.equal('bmad.blocked', metrics.blocked_workflows, workflows.filter((w) => w.stageStatus === 'BLOCKED' || w.stageStatus === 'NOT_ATTEMPTED').length, 'recorded blocked workflows and governed-run stages'));
    }
    crossChecks.push(c.equal('bmad.executed_vs_step22', ratio('bmad_workflows_executed')?.numerator, metrics.executed_live, 'final-summary and bmad-governance-status live executions'));
    model.bmad = bmad;
  }

  // ---- Testing ----------------------------------------------------------------------
  if (has('verificationResults')) {
    const c = checker('verificationResults');
    const vr = c.obj(data.verificationResults, 'verification-results') ?? {};
    const runs: RunRecord[] = a<Obj>(vr.runs).map((r) => ({ command: s(r.command) ?? '', exitCode: n(r.exit_code), result: relativizePaths(s(r.result) ?? '') }));
    const integrate = runs.find((r) => r.command.includes('pilot integrate'))?.result ?? '';
    const grab = (re: RegExp) => {
      const m = integrate.match(re);
      try {
        return m ? (JSON.parse(m[1]) as { PASS: number; BLOCKED_AS_EXPECTED: number; FAIL: number; total: number }) : null;
      } catch {
        return null;
      }
    };
    const summary: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(o(vr.summary))) if (typeof v === 'string' || typeof v === 'number') summary[k] = v;
    const testing: Testing = {
      summary,
      step22Runs: runs,
      step23Runs: a<Obj>(data.step23Regression).map((r) => ({ command: s(r.command) ?? '', exitCode: n(r.exit_code), result: relativizePaths(s(r.result) ?? '') })),
      integration: {
        programTests: grab(/program tests \(isolated\): (\{[^}]*\})/),
        scenarios: grab(/scenarios (\{[^}]*\})/),
        runtimeUnitTests: grab(/runtime unit tests: (\{[^}]*\})/),
      },
      baselineCommit: model.step22BaselineCommit,
    };
    const validates = runs.filter((r) => r.command.includes('pilot validate'));
    if (validates.length) crossChecks.push(c.equal('testing.validate_runs', ratio('validation_pass')?.numerator, validates.filter((r) => r.exitCode === 0).length, 'final-summary validation_pass and recorded validate runs'));
    const readies = runs.filter((r) => r.command.includes('pilot readiness'));
    if (readies.length) crossChecks.push(c.equal('testing.readiness_runs', ratio('readiness_pass')?.numerator, readies.filter((r) => r.exitCode === 0).length, 'final-summary readiness_pass and recorded readiness runs'));
    model.testing = testing;
  }

  model.coverage = coverageRows(model, breakdowns);
  if (model.programs) {
    const eq = model.programs.filter((p) => p.cobolEquivalence !== 'NOT_ESTABLISHED').length;
    model.coverage.push({ metric: 'programs_cobol_equivalent', area: 'Programs', measure: 'Independently established COBOL-equivalent', kind: 'equivalence', numerator: eq, denominator: model.programs.length, definition: 'programs whose cobol_equivalence is not NOT_ESTABLISHED / programs', source: 'forward/reports/step-22/program-reconciliation.json' });
  }

  // Required datasets that are absent make whole pages unavailable; say so once.
  for (const d of bundle.datasets) if (d.required && d.status !== 'loaded') issues.push({ level: 'error', dataset: d.key, message: `required dataset ${d.path} is ${d.status}` });
  return model;
}

function readinessDetail(raw: unknown, id: string): ReadinessDetail | null {
  if (raw === undefined) return null;
  const r = o(raw);
  const auth = o(r.authorisation);
  return {
    status: s(r.status) ?? '',
    checks: a<Obj>(r.checks).map((c) => ({ id: s(c.id) ?? '', ok: c.ok === true, detail: relativizePaths(s(c.detail) ?? '') })),
    gates: Object.fromEntries(Object.entries(o(auth.gates)).map(([k, v]) => [k, String(v)])),
    behaviours: a(r.behaviours).length,
    openDecisions: a(r.open_decisions).length,
    blockingGaps: a<Obj>(r.gaps).filter((g) => g.blocking === true).length,
    generationAuthorized: typeof auth.generation_authorized === 'boolean' ? auth.generation_authorized : null,
    source: `forward/reports/step-22/readiness/${id}.json`,
  };
}

function coverageRows(model: Model, breakdowns: Record<string, Record<string, number>>): CoverageRow[] {
  const spec: [string, string, CoverageRow['kind'], string, string?][] = [
    ['Programs', 'Java present', 'implemented', 'programs_with_java'],
    ['Programs', 'Complete under current criteria', 'verification', 'programs_complete'],
    ['Programs', 'Conversion validation passed', 'test', 'validation_pass'],
    ['Programs', 'Source readiness passed', 'verification', 'readiness_pass'],
    ['Paragraphs', 'Mapped to a Java method', 'structural', 'paragraphs_mapped'],
    ['Paragraphs', 'Executed by passing tests', 'test', 'paragraphs_test_executed', 'paragraphs'],
    ['Statements', 'Mapped to a Java statement', 'structural', 'statements_mapped'],
    ['Statements', 'At explicit gap sites', 'structural', 'statements_at_gaps'],
    ['Statements', 'Executed by passing tests', 'test', 'statements_test_executed', 'statements'],
    ['PERFORM relationships', 'Java target matches', 'structural', 'perform_edges_structural', 'perform_edges'],
    ['Branches', 'Java condition present', 'structural', 'branches_structural', 'branches'],
    ['Loops', 'Java loop present', 'structural', 'loops_structural', 'loops'],
    ['Fields', 'Identical attributes', 'structural', 'fields_consistent'],
    ['Fields', 'Level-88 conditions value-checked', 'test', 'conditions_value_checked'],
    ['Records', 'Represented in Java', 'structural', 'records_represented'],
    ['Copybooks', 'Complete (of copybooks used by a program)', 'structural', 'copybooks_complete', 'copybooks'],
    ['Diagrams', 'Java counterpart to compare', 'structural', 'diagrams_mappable'],
    ['Diagrams', 'Process-flow edges supported by Java structure', 'structural', 'diagram_process_edges_supported'],
    ['JCL jobs', 'Passing an end-to-end Java test', 'test', 'jcl_end_to_end_tested', 'jcl'],
    ['Business rules', 'Verified by source-derived tests', 'verification', 'rules_source_derived_tested'],
    ['Business rules', 'Verified up to a downstream gap', 'verification', 'rules_tested_up_to_gap'],
    ['Business rules', 'Blocked at a gap site', 'implemented', 'rules_blocked'],
    ['Business rules', 'Legacy-execution equivalence evidence', 'equivalence', 'rules_cobol_equivalent'],
    ['BMad', 'Bound workflows executed LIVE', 'verification', 'bmad_workflows_executed'],
  ];
  const out: CoverageRow[] = [];
  for (const [area, measure, kind, metric, bd] of spec) {
    const r = model.summary.ratios[metric];
    if (!r) continue;
    out.push({ metric, area, measure, kind, numerator: r.numerator, denominator: r.denominator, definition: r.definition, source: r.source, breakdown: bd ? breakdowns[bd] : undefined });
  }
  return out;
}

/** Process-flow edges whose classification ends at or passes through a forward gap. */
export function gapLimitedEdges(d: { edgesClassified: Record<string, number> }): number {
  return Object.entries(d.edgesClassified)
    .filter(([k]) => /GAP|UNRESOLVED/i.test(k))
    .reduce((t, [, v]) => t + v, 0);
}

/** Iterative DFS cycle detection over the directed edges. */
export function findCycle(edges: { from: string; to: string }[]): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  const state = new Map<string, 1 | 2>();
  for (const start of adj.keys()) {
    if (state.has(start)) continue;
    const stack: [string, number][] = [[start, 0]];
    state.set(start, 1);
    while (stack.length) {
      const top = stack[stack.length - 1];
      const next = adj.get(top[0]) ?? [];
      if (top[1] < next.length) {
        const v = next[top[1]++];
        const st = state.get(v);
        if (st === 1) return true;
        if (!st) {
          state.set(v, 1);
          stack.push([v, 0]);
        }
      } else {
        state.set(top[0], 2);
        stack.pop();
      }
    }
  }
  return false;
}
