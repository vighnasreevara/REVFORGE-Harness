import * as fs from 'fs';
import * as path from 'path';
import { tally } from '../../../verification/src/evidence';
import { ArtifactSet } from './artifacts';
import { RuntimeContext } from './config';
import { GitInfo } from './git';
import {
  DiagramRef,
  DiscoveredSystem,
  NormalizedGap,
  NormalizedRule,
  ProgramRecord,
  RunLocalRef,
  sourceRunKey,
  sourceRunOf,
  SourceRun,
} from './model';
import { normalizePath, PathRef } from './paths';

export const CONTRACT_VERSION = '1.0';
export const DRAFT_NOTE =
  'Draft planning output generated from the reverse-engineering artifacts. It has not been reviewed by an SME and no live Neo4j verification was performed by the forward runtime.';
export const PATH_ANCHORS = ['output', '.claude', 'references', 'docs', 'forward', 'src'];

export interface Header {
  contract: string;
  contract_version: string;
  forward_run_id: string;
  generated_at: string;
  status: 'draft' | 'unverified' | 'verified';
  status_note: string;
  baseline_manifest: string;
}

export function header(contract: string, runId: string, generatedAt: string, status: Header['status'] = 'draft'): Header {
  return { contract, contract_version: CONTRACT_VERSION, forward_run_id: runId, generated_at: generatedAt, status, status_note: DRAFT_NOTE, baseline_manifest: 'baseline_manifest.json' };
}

/* ------------------------------------------------------------------ */
/* COBOL source availability                                           */
/* ------------------------------------------------------------------ */

export interface SourceAvailability {
  configured: boolean;
  origin: RuntimeContext['sourceRootOrigin'];
  root: string | null;
  root_exists: boolean;
  recorded_reverse_root: PathRef | null;
  programs_checked: number;
  programs_found: number;
  copybooks_checked: number;
  copybooks_found: number;
  missing: string[];
  available_by_file_id: Record<string, boolean>;
  note: string;
}

export function checkSourceAvailability(ctx: RuntimeContext, sys: DiscoveredSystem, programs: ProgramRecord[], recordedRoot: string | null): SourceAvailability {
  const root = ctx.sourceRoot;
  const rootExists = !!root && fs.existsSync(root) && fs.statSync(root).isDirectory();
  const byFile: Record<string, boolean> = {};
  const missing: string[] = [];
  let pf = 0;
  let cf = 0;
  const check = (fileId: string | null, rel: string | null): boolean => {
    const ok = rootExists && !!rel && fs.existsSync(path.join(root as string, rel));
    if (fileId) byFile[fileId] = ok;
    if (!ok && rel) missing.push(rel);
    return ok;
  };
  for (const p of programs) if (check(p.file_id, p.relative_path)) pf++;
  for (const c of sys.copybooks) if (check(c.file_id, c.relative_path)) cf++;
  const note = !root
    ? 'Original COBOL source is not configured. Forward planning relies on the reverse artifacts only; statements cannot be re-verified against the source.'
    : !rootExists
      ? `Configured COBOL source root does not exist: ${root}`
      : missing.length > 0
        ? `${missing.length} source file(s) listed in the inventory were not found under the configured root.`
        : 'All inventoried program and copybook sources were found under the configured root.';
  return {
    configured: !!root,
    origin: ctx.sourceRootOrigin,
    root,
    root_exists: rootExists,
    recorded_reverse_root: recordedRoot ? normalizePath(recordedRoot, PATH_ANCHORS) : null,
    programs_checked: programs.length,
    programs_found: pf,
    copybooks_checked: sys.copybooks.length,
    copybooks_found: cf,
    missing: missing.slice(0, 200),
    available_by_file_id: byFile,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* Baseline manifest                                                   */
/* ------------------------------------------------------------------ */

export function buildBaselineManifest(args: {
  ctx: RuntimeContext;
  set: ArtifactSet;
  sys: DiscoveredSystem;
  git: GitInfo;
  runId: string;
  generatedAt: string;
  selection: { mode: 'all' | 'subset'; requested: string[]; selected: number; unknown: string[] };
  source: SourceAvailability;
  packageVersion: string;
}): any {
  const { ctx, set, sys, git, runId, generatedAt } = args;
  const inputs = Object.values(set.artifacts).map((a) => ({
    key: a.key,
    path: a.repo_path,
    required: a.required,
    present: a.present,
    valid: a.valid,
    sha256: a.sha256,
    bytes: a.bytes,
    agent_version: a.agent_version,
    generated_at: a.generated_at,
    run_ids: a.run_ids,
  }));
  const sourceRuns: Record<string, SourceRun> = {};
  for (const a of Object.values(set.artifacts)) if (a.parsed && a.sha256 && a.format === 'json') sourceRuns[sourceRunKey(a)] = sourceRunOf(a);
  const upstream: any[] = [];
  for (const a of Object.values(set.artifacts)) {
    const v = a.data?.source_id_verification ?? a.data?.meta?.source_id_verification ?? a.data?.meta?.registry_verification ?? a.data?.meta?.registry;
    if (v && typeof v === 'object') {
      upstream.push({
        artifact: a.repo_path,
        reported_by: a.agent_version,
        query: v.query ?? null,
        consistent: typeof v.consistent === 'boolean' ? v.consistent : typeof v.integrity_consistent === 'boolean' ? v.integrity_consistent : null,
        note: 'Recorded by the reverse agent at generation time; not re-executed by the forward runtime.',
      });
    }
  }
  return {
    ...header('baseline-manifest', runId, generatedAt),
    repository: {
      root_name: path.basename(ctx.repoRoot),
      git,
    },
    runtime: { node_version: process.version, platform: process.platform, forward_package_version: args.packageVersion },
    config: { path: path.relative(ctx.repoRoot, ctx.configPath).split(path.sep).join('/'), sha256: ctx.configSha256, generation: ctx.config.generation },
    system: { system_id: sys.system_id, system_name: sys.system_name },
    selection: args.selection,
    inputs,
    per_program_files: {
      logic: { ...set.perProgramHashes.logic, invalid: set.logicFiles.filter((f) => !f.valid).map((f) => f.repo_path) },
      raw_structure: { ...set.perProgramHashes.raw_structure, invalid: set.rawStructureFiles.filter((f) => !f.valid).map((f) => f.repo_path) },
    },
    source_runs: sourceRuns,
    cobol_source: {
      configured: args.source.configured,
      origin: args.source.origin,
      available: args.source.root_exists && args.source.programs_found === args.source.programs_checked,
      programs_found: args.source.programs_found,
      programs_checked: args.source.programs_checked,
      recorded_reverse_root: args.source.recorded_reverse_root,
    },
    neo4j: {
      live_verification_performed: false,
      statement: 'The forward runtime did not connect to Neo4j. Permanent IDs were checked for format and cross-artifact consistency only.',
      recorded_upstream_verifications: upstream,
    },
    id_policy:
      'Permanent source IDs (SYS-/FIL-/PATH-/SEC-/PAR-/STMT-/REC-/FLD-) are copied unchanged from the reverse artifacts and never created or repaired. BR-, RS-, GAP-, ASM- and similar catalogue IDs are run-local; every reference to them names its source run (see source_runs). DEC- decision IDs are local to this forward run.',
  };
}

/* ------------------------------------------------------------------ */
/* Evidence packets                                                    */
/* ------------------------------------------------------------------ */

export type ProgramReadiness = 'blocked' | 'needs_sme_decision' | 'design_candidate';

export interface ProgramAssessment {
  program_id: string;
  file_id: string;
  readiness: ProgramReadiness;
  blockers: string[];
  cautions: string[];
  source_available: boolean;
}

export function assessProgram(p: ProgramRecord, rules: NormalizedRule[], gaps: NormalizedGap[], sourceAvailable: boolean, inherited: NormalizedGap[] = []): ProgramAssessment {
  const blockers: string[] = [];
  const cautions: string[] = [];
  if (!p.parse) blockers.push('no parser entry');
  else if (['failed', 'empty', 'not_parsed'].includes(p.parse.status)) blockers.push(`parse status '${p.parse.status}'`);
  if (!p.logic) blockers.push('no logic entry');
  else if (['empty', 'skipped'].includes(p.logic.status)) blockers.push(`logic status '${p.logic.status}'`);
  for (const g of gaps) if (g.severity === 'critical') blockers.push(`critical gap ${g.ref.id}: ${g.title}`);

  if (p.logic && p.logic.unresolvable_paths > 0) cautions.push(`${p.logic.unresolvable_paths} unresolvable path(s)`);
  if (p.logic && p.logic.unresolved_ids > 0) cautions.push(`${p.logic.unresolved_ids} unresolved ID reference(s)`);
  const sme = rules.filter((r) => r.requires_sme_review);
  if (sme.length) cautions.push(`${sme.length} rule(s) require SME review`);
  const unc = rules.filter((r) => r.evidence_class === 'uncertain');
  if (unc.length) cautions.push(`${unc.length} rule(s) with uncertain evidence`);
  const high = gaps.filter((g) => g.severity === 'high');
  if (high.length) cautions.push(`${high.length} high-severity gap(s)`);
  const unresolved = [...p.calls_out, ...p.includes].filter((e) => !e.resolved);
  if (unresolved.length) cautions.push(`${unresolved.length} unresolved call/include reference(s)`);
  const inhSevere = inherited.filter((g) => g.severity === 'critical' || g.severity === 'high');
  if (inhSevere.length) cautions.push(`included copybook(s) carry ${inhSevere.length} critical/high gap(s): ${inhSevere.map((g) => g.ref.id).join(', ')}`);
  if (p.duplicate_program_id) cautions.push('Program ID is declared by more than one file');
  if (p.logic?.upstream_verdict && p.logic.upstream_verdict !== 'VALID') cautions.push(`upstream verification verdict ${p.logic.upstream_verdict}`);

  const readiness: ProgramReadiness = blockers.length ? 'blocked' : cautions.length ? 'needs_sme_decision' : 'design_candidate';
  return { program_id: p.program_id, file_id: p.file_id, readiness, blockers, cautions, source_available: sourceAvailable };
}

export function programRules(p: ProgramRecord, rules: NormalizedRule[], inScope: Map<string, string[]>): { implemented: NormalizedRule[]; in_scope: NormalizedRule[] } {
  const implemented = rules.filter((r) => r.implemented_in.includes(p.program_id) || r.sources.some((s) => s.source_ids?.file_id === p.file_id));
  const implIds = new Set(implemented.map((r) => r.ref.id));
  const scopeIds = new Set(inScope.get(p.program_id) ?? []);
  const in_scope = rules.filter((r) => scopeIds.has(r.ref.id) && !implIds.has(r.ref.id));
  return { implemented, in_scope };
}

export function programGaps(p: ProgramRecord, gaps: NormalizedGap[]): NormalizedGap[] {
  return gaps.filter((g) => g.programs.includes(p.program_id) || g.file_ids.includes(p.file_id));
}

/**
 * Gaps recorded against a copybook (or other included member) that the program
 * includes through a resolved COPY/INCLUDE edge. They are inherited cautions,
 * not blockers of the program: the gap itself is decided once, system-wide.
 */
export function inheritedGaps(p: ProgramRecord, gaps: NormalizedGap[]): NormalizedGap[] {
  const included = new Set(p.includes.filter((e) => e.resolved && e.target_file_id).map((e) => e.target_file_id as string));
  const names = new Set(p.includes.filter((e) => e.resolved).map((e) => e.to));
  const direct = new Set(programGaps(p, gaps).map((g) => g.ref.id));
  return gaps.filter((g) => !direct.has(g.ref.id) && (g.file_ids.some((f) => included.has(f)) || g.programs.some((x) => names.has(x))));
}

/**
 * Programs a gap concerns: the programs it names directly plus the users of
 * any copybook (or other non-program file) it names. Used for selection scope.
 */
export function gapScopePrograms(g: NormalizedGap, sys: DiscoveredSystem): string[] {
  const programs = new Set(sys.programs.map((p) => p.program_id));
  const out = new Set(g.programs.filter((x) => programs.has(x)));
  for (const c of sys.copybooks) {
    if ((c.file_id && g.file_ids.includes(c.file_id)) || g.programs.includes(c.name)) for (const u of c.used_by) out.add(u);
  }
  for (const p of sys.programs) if (g.file_ids.includes(p.file_id)) out.add(p.program_id);
  return [...out].sort();
}

export function programDiagrams(p: ProgramRecord, diagrams: DiagramRef[], byFileId: Record<string, string[]> | undefined): DiagramRef[] {
  const ids = new Set(byFileId?.[p.file_id] ?? []);
  return diagrams.filter((d) => d.program_id === p.program_id || d.file_ids.includes(p.file_id) || ids.has(d.diagram_id));
}

const ruleEntry = (r: NormalizedRule, p: ProgramRecord | null) => ({
  ref: r.ref,
  rule_set: r.rule_set,
  name: r.name,
  category: r.category,
  confidence: r.confidence,
  requires_sme_review: r.requires_sme_review,
  evidence_class: r.evidence_class,
  evidence_reasons: r.evidence_reasons,
  dead_code: r.dead_code,
  sources: p ? r.sources.filter((s) => s.program_id === p.program_id || s.source_ids?.file_id === p.file_id) : r.sources,
});

export function buildEvidencePacket(args: {
  runId: string;
  generatedAt: string;
  p: ProgramRecord;
  assessment: ProgramAssessment;
  rules: { implemented: NormalizedRule[]; in_scope: NormalizedRule[] };
  gaps: NormalizedGap[];
  inheritedGaps: NormalizedGap[];
  diagrams: DiagramRef[];
  records: any[];
  logicFile: { repo_path: string; sha256: string | null; valid: boolean } | null;
  rawFile: { repo_path: string; sha256: string | null; valid: boolean } | null;
}): any {
  const { p } = args;
  const classes = args.rules.implemented.map((r) => r.evidence_class);
  return {
    ...header('evidence-packet', args.runId, args.generatedAt),
    program: {
      program_id: p.program_id,
      source_ids: { system_id: p.system_id, file_id: p.file_id, path_id: p.path_id },
      relative_path: p.relative_path,
      size_bytes: p.size_bytes,
      inventory_subtype: p.inventory_subtype,
      entry_types: p.logic?.entry_types ?? [],
      duplicate_program_id: p.duplicate_program_id,
    },
    source_files: {
      cobol_source_available: args.assessment.source_available,
      raw_structure: args.rawFile,
      logic_file: args.logicFile,
    },
    structure: p.parse,
    logic: p.logic,
    dependencies: {
      calls_out: p.calls_out,
      called_by: p.called_by,
      includes: p.includes,
      jcl_jobs: p.jcl_jobs,
      evidence_note: 'Resolved inventory edges are structural facts (confirmed); unresolved edges are uncertain and are listed as gaps.',
    },
    data_records: args.records.map((r) => ({
      record_id: r.record_id,
      record_name: r.record_name,
      file_id: r.file_id,
      owner: r.file_id === p.file_id ? 'program' : 'copybook',
      source_type: r.source_type ?? null,
      section: r.section ?? null,
    })),
    rules: {
      implemented: args.rules.implemented.map((r) => ruleEntry(r, p)),
      in_scope_via_copybook: args.rules.in_scope.map((r) => ruleEntry(r, null)),
      evidence_summary: tally(classes),
    },
    gaps: args.gaps.map((g) => ({
      ref: g.ref,
      gap_type: g.gap_type,
      severity: g.severity,
      title: g.title,
      requires_sme_review: g.requires_sme_review,
      confidence: g.confidence,
      expanded_items: g.items.filter((i) => !i.program_id || i.program_id === p.program_id || i.file_id === p.file_id).map((i) => i.item_id),
    })),
    inherited_gaps: args.inheritedGaps.map((g) => ({
      ref: g.ref,
      gap_type: g.gap_type,
      severity: g.severity,
      title: g.title,
      via_file_ids: g.file_ids,
      note: 'Recorded against an included copybook or member; decided once system-wide.',
    })),
    diagrams: {
      role: 'supporting',
      note: 'Diagrams illustrate the structural evidence above; behaviour is never inferred from a diagram alone.',
      items: args.diagrams.map((d) => ({ diagram_id: d.diagram_id, type: d.type, file: d.file, incomplete: d.incomplete, truncated: d.truncated, edge_evidence: d.edge_evidence })),
    },
    readiness: { status: args.assessment.readiness, blockers: args.assessment.blockers, cautions: args.assessment.cautions },
  };
}

/* ------------------------------------------------------------------ */
/* Rule and gap summaries                                              */
/* ------------------------------------------------------------------ */

const countBy = <T>(xs: T[], f: (x: T) => string): Record<string, number> => {
  const o: Record<string, number> = {};
  for (const x of xs) o[f(x)] = (o[f(x)] ?? 0) + 1;
  return o;
};

export function buildRuleSummary(runId: string, generatedAt: string, rules: NormalizedRule[], ruleSets: any[], sourceRun: string): any {
  return {
    ...header('rule-summary', runId, generatedAt),
    source_run: sourceRun,
    counts: {
      total: rules.length,
      by_category: countBy(rules, (r) => r.category),
      by_confidence: countBy(rules, (r) => r.confidence),
      by_evidence_class: countBy(rules, (r) => r.evidence_class),
      requires_sme_review: rules.filter((r) => r.requires_sme_review).length,
      dead_code: rules.filter((r) => r.dead_code).length,
      copybook_level: rules.filter((r) => r.copybook_level).length,
    },
    rule_sets: ruleSets.map((s) => ({ ref: { id: s.rule_set_id, scope: 'run-local', source_run: sourceRun }, name: s.name ?? null, rule_ids: s.rule_ids ?? [] })),
    rules: rules.map((r) => ({
      ref: r.ref,
      rule_set: r.rule_set,
      name: r.name,
      category: r.category,
      confidence: r.confidence,
      requires_sme_review: r.requires_sme_review,
      evidence_class: r.evidence_class,
      evidence_reasons: r.evidence_reasons,
      dead_code: r.dead_code,
      copybook_level: r.copybook_level,
      implemented_in: r.implemented_in,
      file_ids: r.file_ids,
    })),
  };
}

export function buildGapSummary(runId: string, generatedAt: string, gaps: NormalizedGap[], sourceRun: string, assumptions: any[]): any {
  const items = gaps.flatMap((g) => g.items);
  return {
    ...header('gap-summary', runId, generatedAt),
    source_run: sourceRun,
    counts: {
      total: gaps.length,
      expanded_items: items.length,
      by_severity: countBy(gaps, (g) => g.severity),
      by_type: countBy(gaps, (g) => g.gap_type),
      requires_sme_review: gaps.filter((g) => g.requires_sme_review).length,
      grouped_gaps: gaps.filter((g) => g.items.length > 1).length,
      gaps_without_items: gaps.filter((g) => g.items.length === 0).length,
      gaps_without_source_reference: gaps.filter((g) => g.missing_source_reference).length,
      items_by_reference_status: countBy(items, (i) => i.reference_status),
    },
    gaps: gaps.map((g) => ({
      ref: g.ref,
      gap_type: g.gap_type,
      also_types: g.also_types,
      severity: g.severity,
      title: g.title,
      requires_sme_review: g.requires_sme_review,
      confidence: g.confidence,
      programs: g.programs,
      file_ids: g.file_ids,
      missing_source_reference: g.missing_source_reference,
      related_rules: g.related_rules,
      related_gaps: g.related_gaps,
      item_count: g.items.length,
    })),
    expanded_items: items,
    assumptions: assumptions.map((a) => ({ ref: { id: a.assumption_id, scope: 'run-local', source_run: sourceRun }, description: a.description, confidence: a.confidence ?? null })),
  };
}

/* ------------------------------------------------------------------ */
/* Decision backlog                                                    */
/* ------------------------------------------------------------------ */

export interface Decision {
  decision_id: string;
  kind: 'source_access' | 'gap_resolution' | 'rule_confirmation' | 'assumption_confirmation' | 'selection';
  severity: 'critical' | 'high' | 'medium' | 'low';
  blocking: boolean;
  status: 'open';
  question: string;
  recommended_action: string | null;
  programs: string[];
  file_ids: string[];
  refs: RunLocalRef[];
}

export function buildDecisionBacklog(args: {
  runId: string;
  generatedAt: string;
  sys: DiscoveredSystem;
  gaps: NormalizedGap[];
  rules: NormalizedRule[];
  assumptions: any[];
  gapsRun: string;
  source: SourceAvailability;
  selectedFileIds: Set<string>;
  selectedPrograms: Set<string>;
  unknownSelection: string[];
}): any {
  const out: Omit<Decision, 'decision_id'>[] = [];
  const inScope = (programs: string[], files: string[]) =>
    programs.length + files.length === 0 || programs.some((p) => args.selectedPrograms.has(p)) || files.some((f) => args.selectedFileIds.has(f));
  const gapInScope = (g: NormalizedGap) => g.programs.length + g.file_ids.length === 0 || gapScopePrograms(g, args.sys).some((p) => args.selectedPrograms.has(p));

  if (args.unknownSelection.length) {
    out.push({ kind: 'selection', severity: 'high', blocking: true, status: 'open', question: `The requested selection names programs that the inventory does not contain: ${args.unknownSelection.join(', ')}. Correct the selection.`, recommended_action: null, programs: [], file_ids: [], refs: [] });
  }
  if (!args.source.root_exists || args.source.programs_found < args.source.programs_checked) {
    out.push({
      kind: 'source_access',
      severity: 'high',
      blocking: false,
      status: 'open',
      question: 'Provide access to the original COBOL source library so that forward design and generated code can be re-verified against the source (currently: ' + args.source.note + ')',
      recommended_action: 'Set cobol_source.root in forward/config/forward.config.json or the environment variable named there.',
      programs: [],
      file_ids: [],
      refs: [],
    });
  }
  const sevRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const gapDecisions = args.gaps
    .filter((g) => (g.severity === 'critical' || g.severity === 'high' || g.requires_sme_review) && gapInScope(g))
    .sort((a, b) => (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9) || a.ref.id.localeCompare(b.ref.id));
  for (const g of gapDecisions) {
    out.push({
      kind: 'gap_resolution',
      severity: (['critical', 'high', 'medium', 'low'].includes(g.severity) ? g.severity : 'medium') as Decision['severity'],
      blocking: g.severity === 'critical',
      status: 'open',
      question: `${g.title} — how should forward engineering treat this?`,
      recommended_action: g.recommended_action,
      programs: gapScopePrograms(g, args.sys),
      file_ids: g.file_ids,
      refs: [g.ref, ...g.related_rules],
    });
  }
  for (const r of args.rules.filter((r) => r.requires_sme_review && inScope(r.implemented_in, r.file_ids))) {
    out.push({
      kind: 'rule_confirmation',
      severity: r.evidence_class === 'uncertain' && r.confidence === 'low' ? 'high' : 'medium',
      blocking: false,
      status: 'open',
      question: `Confirm, correct or reject rule '${r.name}' (${r.confidence} confidence, ${r.evidence_class}) before it becomes a requirement.`,
      recommended_action: r.sme_review_note,
      programs: r.implemented_in,
      file_ids: r.file_ids,
      refs: [r.ref],
    });
  }
  for (const a of args.assumptions) {
    out.push({
      kind: 'assumption_confirmation',
      severity: 'low',
      blocking: false,
      status: 'open',
      question: `Confirm reverse-engineering assumption: ${a.description}`,
      recommended_action: null,
      programs: [],
      file_ids: [],
      refs: [{ id: a.assumption_id, scope: 'run-local', source_run: args.gapsRun }],
    });
  }
  const decisions: Decision[] = out.map((d, i) => ({ decision_id: `DEC-${String(i + 1).padStart(4, '0')}`, ...d }));
  return {
    ...header('decision-backlog', args.runId, args.generatedAt),
    id_note: 'DEC- identifiers are local to this forward run.',
    counts: {
      total: decisions.length,
      blocking: decisions.filter((d) => d.blocking).length,
      by_kind: countBy(decisions, (d) => d.kind),
      by_severity: countBy(decisions, (d) => d.severity),
    },
    decisions,
  };
}

/* ------------------------------------------------------------------ */
/* Readiness report                                                    */
/* ------------------------------------------------------------------ */

export interface Check {
  id: string;
  status: 'pass' | 'warn' | 'fail' | 'info';
  detail: string;
}

export type OverallReadiness = 'not_ready' | 'conditionally_ready' | 'ready';

export function overallReadiness(assessments: ProgramAssessment[], checks: Check[], blockingDecisions: number): { status: OverallReadiness; reasons: string[] } {
  const fatal: string[] = [];
  const conditions: string[] = [];
  const candidates = assessments.filter((a) => a.readiness === 'design_candidate').length;
  if (checks.some((c) => c.status === 'fail')) fatal.push('at least one readiness check failed');
  if (assessments.length === 0) fatal.push('no programs selected');
  if (candidates === 0 && assessments.length > 0) fatal.push('no program is a design candidate');
  if (candidates < assessments.length) conditions.push(`${assessments.length - candidates} program(s) blocked or awaiting SME decisions`);
  if (blockingDecisions > 0) conditions.push(`${blockingDecisions} blocking decision(s) open`);
  if (checks.some((c) => c.status === 'warn')) conditions.push('readiness warnings present (see checks)');
  if (assessments.some((a) => !a.source_available)) conditions.push('original COBOL source not available for re-verification');
  if (fatal.length) return { status: 'not_ready', reasons: [...fatal, ...conditions] };
  return conditions.length ? { status: 'conditionally_ready', reasons: conditions } : { status: 'ready', reasons: ['all checks passed'] };
}

export function renderReadinessMarkdown(r: any): string {
  const lines: string[] = [];
  lines.push(`# Forward-engineering readiness report (DRAFT)`, '');
  lines.push(`- Forward run: \`${r.forward_run_id}\``);
  lines.push(`- Generated: ${r.generated_at}`);
  lines.push(`- System: ${r.system.system_id ?? 'unknown'} (${r.system.system_name ?? 'unnamed'})`);
  lines.push(`- Overall readiness: **${r.overall.status}**`);
  for (const x of r.overall.reasons) lines.push(`  - ${x}`);
  lines.push('', `> ${r.status_note}`, '');
  lines.push('## Discovered system', '', '| Measure | Count |', '|---|---|');
  for (const [k, v] of Object.entries(r.counts)) lines.push(`| ${k.replace(/_/g, ' ')} | ${v} |`);
  lines.push('', '## Checks', '', '| Check | Status | Detail |', '|---|---|---|');
  for (const c of r.checks) lines.push(`| ${c.id} | ${c.status} | ${String(c.detail).replace(/\|/g, '\\|')} |`);
  lines.push('', '## Program readiness', '', '| Program | File ID | Readiness | Blockers | Cautions |', '|---|---|---|---|---|');
  for (const p of r.programs) {
    lines.push(`| ${p.program_id} | \`${p.file_id}\` | ${p.readiness} | ${p.blockers.join('; ').replace(/\|/g, '\\|') || '—'} | ${p.cautions.join('; ').replace(/\|/g, '\\|') || '—'} |`);
  }
  lines.push('', '## Decision backlog', '', `${r.decisions.total} open decision(s), ${r.decisions.blocking} blocking. See \`decision_backlog.json\`.`, '');
  lines.push('## Evidence policy', '', '- Permanent source IDs are copied unchanged from the reverse artifacts.', '- BR-/RS-/GAP-/ASM- IDs are run-local and are always cited with their source run.', '- Diagrams are supporting evidence only.', '- No live Neo4j verification was performed by the forward runtime.', '- No Java code was generated.', '');
  return lines.join('\n');
}
