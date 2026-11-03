import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { loadArtifacts, requiredFailures } from '../core/artifacts';
import { RuntimeContext } from '../core/config';
import { OutputWriter } from '../core/fsutil';
import { gitInfo } from '../core/git';
import { discoverSystem, indexDiagrams, normalizeGaps, normalizeRules, rulesInScopeByProgram, selectPrograms, sourceRunKey } from '../core/model';
import {
  assessProgram,
  buildBaselineManifest,
  buildDecisionBacklog,
  buildEvidencePacket,
  buildGapSummary,
  buildRuleSummary,
  Check,
  checkSourceAvailability,
  header,
  overallReadiness,
  inheritedGaps,
  programDiagrams,
  programGaps,
  programRules,
  renderReadinessMarkdown,
} from '../core/planning';
import { runValidation } from './validate';

export class PlanError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'PlanError';
  }
}

export interface PlanResult {
  runId: string;
  runDir: string;
  files: string[];
  counts: Record<string, number>;
  overall: { status: string; reasons: string[] };
  decisions: { total: number; blocking: number };
}

/** Reverse-harness paths whose local modification is reported in the manifest. */
export const PROTECTED_PREFIXES = ['.claude/agents/', '.claude/skills/', 'output/'];

export function newRunId(now: Date = new Date()): string {
  const ts = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `FWD-${ts}-${randomBytes(2).toString('hex')}`;
}

function packageVersion(ctx: RuntimeContext): string {
  try {
    return JSON.parse(fs.readFileSync(path.join(ctx.forwardDir, 'package.json'), 'utf8')).version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function runPlan(ctx: RuntimeContext, opts: { runId?: string; now?: Date } = {}): PlanResult {
  const set = loadArtifacts(ctx);
  const failed = requiredFailures(set);
  if (failed.length) {
    throw new PlanError('required reverse artifacts are missing or invalid; planning was not started', failed.flatMap((a) => a.errors.slice(0, 5)));
  }
  const validation = runValidation(ctx, set);
  const sys = discoverSystem(set);
  const selection = ctx.config.selection.programs;
  const { selected, unknown } = selectPrograms(sys, selection);
  if (selection !== 'all' && selected.length === 0) {
    throw new PlanError('the program selection matched no discovered program', unknown);
  }

  const now = opts.now ?? new Date();
  const generatedAt = now.toISOString();
  const runId = opts.runId ?? newRunId(now);
  const runDir = path.join(ctx.runsDir, runId);
  if (fs.existsSync(runDir)) throw new PlanError(`run directory already exists: ${runDir}`);
  const writer = new OutputWriter(runDir, ctx.config.generation);

  const rulesA = set.artifacts.rules;
  const gapsA = set.artifacts.gaps;
  const rules = normalizeRules(rulesA);
  const inScope = rulesInScopeByProgram(rulesA);
  const gaps = normalizeGaps(gapsA);
  const diagrams = indexDiagrams(set.artifacts.diagrams);
  const byFileId = set.artifacts.diagrams?.data?.diagrams_by_file_id;
  const records: any[] = set.artifacts.data?.data?.record_catalogue ?? [];
  const copybookCount = sys.copybooks.filter((c) => c.type === 'copybook').length;
  const source = checkSourceAvailability(ctx, sys, selected, set.artifacts.inventory.data?.meta?.repo_root ?? null);
  const git = gitInfo(ctx.repoRoot, PROTECTED_PREFIXES);

  const validate = (contract: string, data: unknown): void => {
    const v = ctx.contracts.validate(contract, data);
    if (!v.valid) throw new PlanError(`generated output violates contract ${contract}`, v.errors);
  };

  // Baseline manifest.
  const manifest = buildBaselineManifest({
    ctx,
    set,
    sys,
    git,
    runId,
    generatedAt,
    selection: { mode: selection === 'all' ? 'all' : 'subset', requested: selection === 'all' ? [] : selection, selected: selected.length, unknown },
    source,
    packageVersion: packageVersion(ctx),
  });
  validate('output/baseline-manifest', manifest);
  writer.writeJson('baseline_manifest.json', manifest);

  // Program inventory.
  const assessments = new Map(
    selected.map((p) => {
      const pr = programRules(p, rules, inScope);
      return [p.file_id, assessProgram(p, pr.implemented, programGaps(p, gaps), source.available_by_file_id[p.file_id] === true, inheritedGaps(p, gaps))];
    }),
  );
  const inventory = {
    ...header('program-inventory', runId, generatedAt),
    system: { system_id: sys.system_id, system_name: sys.system_name },
    discovery_basis: 'Programs, copybooks, JCL and edges discovered from the inventory artifact and joined with parser, logic, rules, gaps and diagrams by permanent File ID.',
    selection: { mode: selection === 'all' ? 'all' : 'subset', selected: selected.length, unknown },
    counts: {
      programs_discovered: sys.programs.length,
      programs_selected: selected.length,
      copybooks: copybookCount,
      other_include_members: sys.copybooks.length - copybookCount,
      jcl_jobs: sys.jcl_jobs.length,
      other_files: sys.other_files.length,
      dependency_edges: sys.edges.length,
      unresolved_edges: sys.unresolved_edges.length,
    },
    programs: selected.map((p) => {
      const pr = programRules(p, rules, inScope);
      return {
        program_id: p.program_id,
        source_ids: { system_id: p.system_id, file_id: p.file_id, path_id: p.path_id },
        relative_path: p.relative_path,
        size_bytes: p.size_bytes,
        inventory_subtype: p.inventory_subtype,
        entry_types: p.logic?.entry_types ?? [],
        duplicate_program_id: p.duplicate_program_id,
        parse_status: p.parse?.status ?? null,
        logic_status: p.logic?.status ?? null,
        rules_implemented: pr.implemented.length,
        rules_in_scope_via_copybook: pr.in_scope.length,
        gaps: programGaps(p, gaps).length,
        diagrams: programDiagrams(p, diagrams, byFileId).length,
        calls_out: p.calls_out.map((e) => e.to),
        called_by: p.called_by.map((e) => e.from),
        includes: p.includes.map((e) => e.to),
        jcl_jobs: p.jcl_jobs.map((j) => j.job_name),
        readiness: assessments.get(p.file_id)!.readiness,
        evidence_packet: `evidence_packets/${p.file_id}__${p.program_id}.json`,
      };
    }),
    copybooks: sys.copybooks,
    jcl_jobs: sys.jcl_jobs,
    other_files: sys.other_files,
    unresolved_edges: sys.unresolved_edges,
    coverage_mismatches: sys.coverage_mismatches,
  };
  validate('output/program-inventory', inventory);
  writer.writeJson('program_inventory.json', inventory);

  // Evidence packets.
  const logicByFile = new Map(set.logicFiles.map((f) => [f.file_id, f]));
  const rawByFile = new Map(set.rawStructureFiles.map((f) => [f.file_id, f]));
  for (const p of selected) {
    const pr = programRules(p, rules, inScope);
    const lf = logicByFile.get(p.file_id);
    const rf = rawByFile.get(p.file_id);
    const packet = buildEvidencePacket({
      runId,
      generatedAt,
      p,
      assessment: assessments.get(p.file_id)!,
      rules: pr,
      gaps: programGaps(p, gaps),
      inheritedGaps: inheritedGaps(p, gaps),
      diagrams: programDiagrams(p, diagrams, byFileId),
      records: records.filter((r) => r.file_id === p.file_id || (Array.isArray(r.used_by_programs) && r.used_by_programs.includes(p.program_id))),
      logicFile: lf ? { repo_path: lf.repo_path, sha256: lf.sha256, valid: lf.valid } : null,
      rawFile: rf ? { repo_path: rf.repo_path, sha256: rf.sha256, valid: rf.valid } : null,
    });
    validate('output/evidence-packet', packet);
    writer.writeJson(`evidence_packets/${p.file_id}__${p.program_id}.json`, packet);
  }

  // Rule and gap summaries.
  const ruleSummary = buildRuleSummary(runId, generatedAt, rules, rulesA.data?.rule_sets ?? [], sourceRunKey(rulesA));
  validate('output/rule-summary', ruleSummary);
  writer.writeJson('rule_summary.json', ruleSummary);
  const assumptions: any[] = gapsA.data?.assumptions ?? [];
  const gapSummary = buildGapSummary(runId, generatedAt, gaps, sourceRunKey(gapsA), assumptions);
  validate('output/gap-summary', gapSummary);
  writer.writeJson('gap_summary.json', gapSummary);

  // Decision backlog.
  const backlog = buildDecisionBacklog({
    runId,
    generatedAt,
    sys,
    gaps,
    rules,
    assumptions,
    gapsRun: sourceRunKey(gapsA),
    source,
    selectedFileIds: new Set(selected.map((p) => p.file_id)),
    selectedPrograms: new Set(selected.map((p) => p.program_id)),
    unknownSelection: unknown,
  });
  validate('output/decision-backlog', backlog);
  writer.writeJson('decision_backlog.json', backlog);

  // Readiness report.
  const errors = validation.findings.filter((f) => f.severity === 'error');
  const warnings = validation.findings.filter((f) => f.severity === 'warning');
  const checks: Check[] = [
    { id: 'reverse_artifacts_valid', status: errors.length ? 'fail' : 'pass', detail: errors.length ? `${errors.length} validation error(s): ${errors.slice(0, 3).map((e) => e.message).join(' | ')}` : 'all required reverse artifacts satisfy their input contracts and cross-references' },
    { id: 'validation_warnings', status: warnings.length ? 'warn' : 'pass', detail: warnings.length ? warnings.slice(0, 5).map((w) => w.message).join(' | ') : 'none' },
    { id: 'program_selection', status: unknown.length ? 'fail' : 'pass', detail: unknown.length ? `unknown programs requested: ${unknown.join(', ')}` : `${selected.length} of ${sys.programs.length} discovered program(s) selected` },
    { id: 'cobol_source_available', status: source.root_exists && source.programs_found === source.programs_checked ? 'pass' : 'warn', detail: source.note },
    { id: 'neo4j_live_verification', status: 'info', detail: 'not performed by the forward runtime; upstream verification results are recorded in the baseline manifest' },
    { id: 'java_generation', status: 'info', detail: `not authorised in ${ctx.config.generation.current_step}; no Java code was generated` },
  ];
  const programAssessments = [...assessments.values()];
  const overall = overallReadiness(programAssessments, checks, backlog.counts.blocking);
  const counts = {
    programs_discovered: sys.programs.length,
    programs_selected: selected.length,
    copybooks: copybookCount,
    other_include_members: sys.copybooks.length - copybookCount,
    jcl_jobs: sys.jcl_jobs.length,
    business_rules: rules.length,
    gaps: gaps.length,
    gap_items_expanded: gaps.reduce((n, g) => n + g.items.length, 0),
    diagrams: diagrams.length,
    design_candidates: programAssessments.filter((a) => a.readiness === 'design_candidate').length,
    needs_sme_decision: programAssessments.filter((a) => a.readiness === 'needs_sme_decision').length,
    blocked: programAssessments.filter((a) => a.readiness === 'blocked').length,
  };
  const readiness = {
    ...header('readiness-report', runId, generatedAt),
    system: { system_id: sys.system_id, system_name: sys.system_name },
    overall,
    counts,
    checks,
    source_availability: { configured: source.configured, root_exists: source.root_exists, programs_found: source.programs_found, programs_checked: source.programs_checked, note: source.note },
    decisions: { total: backlog.counts.total, blocking: backlog.counts.blocking },
    programs: programAssessments,
  };
  validate('output/readiness-report', readiness);
  writer.writeJson('readiness_report.json', readiness);
  writer.writeText('readiness_report.md', renderReadinessMarkdown(readiness));

  fs.mkdirSync(ctx.runsDir, { recursive: true });
  fs.writeFileSync(path.join(ctx.runsDir, 'LATEST'), runId + '\n', 'utf8');

  return { runId, runDir, files: writer.written, counts, overall, decisions: { total: backlog.counts.total, blocking: backlog.counts.blocking } };
}
