/**
 * System model built dynamically from the reverse artifacts. Nothing here
 * knows any program name, count, rule or workflow of a particular system:
 * programs, copybooks, JCL and dependencies are discovered from the
 * inventory and joined with the parser, logic, rules, gaps and diagram
 * artifacts by permanent File ID (and Program ID where the artifact only
 * carries the name).
 */
import { classifyRule, EvidenceClass } from '../../../verification/src/evidence';
import { isPermanentId, owningFileId, permanentIdKind, runLocalIdKind } from '../../../verification/src/ids';
import { ArtifactSet, LoadedArtifact } from './artifacts';

/* ------------------------------------------------------------------ */
/* Source runs                                                         */
/* ------------------------------------------------------------------ */

export interface SourceRun {
  artifact: string;
  agent_version: string | null;
  generated_at: string | null;
  sha256: string;
  run_ids: string[];
}

export function sourceRunKey(a: LoadedArtifact): string {
  return `${a.key}@${a.agent_version ?? 'unknown'}#${(a.sha256 ?? 'nohash').slice(0, 12)}`;
}

export function sourceRunOf(a: LoadedArtifact): SourceRun {
  return { artifact: a.repo_path, agent_version: a.agent_version, generated_at: a.generated_at, sha256: a.sha256 ?? '0'.repeat(64), run_ids: a.run_ids };
}

export interface RunLocalRef {
  id: string;
  scope: 'run-local';
  source_run: string;
}

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

const CALL_TYPES = /CALL|LINK|XCTL|TRANSID/i;
const INCLUDE_TYPES = /COPY|INCLUDE/i;

export interface EdgeRef {
  from: string;
  to: string;
  type: string;
  resolved: boolean;
  line: number | null;
  target_file_id: string | null;
}

export interface ProgramRecord {
  program_id: string;
  file_id: string;
  path_id: string | null;
  system_id: string | null;
  relative_path: string | null;
  file_name: string | null;
  size_bytes: number | null;
  inventory_subtype: string | null;
  duplicate_program_id: boolean;
  parse: { status: string; paragraph_count: number | null; statement_count: number | null; parse_run_id: string | null; ast_file: string | null } | null;
  logic: {
    status: string;
    upstream_verdict: string | null;
    logic_file: string | null;
    unresolvable_paths: number;
    unresolved_ids: number;
    unresolved_id_breakdown: Record<string, number> | null;
    dead_code_confirmed: number;
    entry_types: string[];
  } | null;
  calls_out: EdgeRef[];
  called_by: EdgeRef[];
  includes: EdgeRef[];
  jcl_jobs: Array<{ job_name: string; file_id: string | null; step: string | null }>;
}

export interface CopybookRecord {
  name: string;
  file_id: string | null;
  path_id: string | null;
  type: string | null;
  relative_path: string | null;
  used_by: string[];
}

export interface JclRecord {
  job_name: string;
  file_id: string | null;
  path_id: string | null;
  relative_path: string | null;
  programs: string[];
}

export interface DiscoveredSystem {
  system_id: string | null;
  system_name: string | null;
  programs: ProgramRecord[];
  copybooks: CopybookRecord[];
  jcl_jobs: JclRecord[];
  other_files: Array<{ id: string; file_id: string | null; type: string | null; relative_path: string | null }>;
  edges: EdgeRef[];
  unresolved_edges: EdgeRef[];
  /** Programs present in parser/logic but absent from the inventory, or vice versa. */
  coverage_mismatches: string[];
}

export function discoverSystem(set: ArtifactSet): DiscoveredSystem {
  const inv = set.artifacts.inventory?.data ?? {};
  const parser = set.artifacts.parser?.data ?? {};
  const logic = set.artifacts.logic?.data ?? {};

  const fileIdByName = new Map<string, string>();
  const nameCount = new Map<string, number>();
  const regs: any[] = [...(inv.file_registry ?? []), ...(inv.copybook_registry ?? []), ...(inv.jcl_registry ?? []), ...(inv.other_file_registry ?? [])];
  for (const r of inv.file_registry ?? []) nameCount.set(r.program_id, (nameCount.get(r.program_id) ?? 0) + 1);
  for (const r of regs) {
    const name = r.program_id ?? r.id;
    if (name && r.file_id && !fileIdByName.has(`${r.type ?? ''}:${name}`)) fileIdByName.set(`${r.type ?? ''}:${name}`, r.file_id);
  }
  const progFileId = (name: string): string | null => fileIdByName.get(`program:${name}`) ?? null;
  const anyFileId = (name: string): string | null => {
    for (const [k, v] of fileIdByName) if (k.endsWith(`:${name}`)) return v;
    return null;
  };

  const edges: EdgeRef[] = ((inv.call_graph?.edges ?? []) as any[]).map((e) => ({
    from: e.from,
    to: e.to,
    type: e.type,
    resolved: e.resolved === true,
    line: typeof e.source_line_hint === 'number' ? e.source_line_hint : null,
    target_file_id: e.resolved ? (INCLUDE_TYPES.test(e.type) ? anyFileId(e.to) : progFileId(e.to) ?? anyFileId(e.to)) : null,
  }));

  const parserByFile = new Map<string, any>();
  for (const p of parser.programs ?? []) parserByFile.set(p.file_id, p);
  const logicByFile = new Map<string, any>();
  for (const p of logic.programs ?? []) logicByFile.set(p.file_id, p);
  const logicFileByFile = new Map<string, any>();
  for (const f of set.logicFiles) if (f.file_id && f.data) logicFileByFile.set(f.file_id, f.data);

  const jcl: JclRecord[] = ((inv.jcl_registry ?? []) as any[]).map((j) => ({
    job_name: j.job_name ?? j.id,
    file_id: j.file_id ?? null,
    path_id: j.path_id ?? null,
    relative_path: j.relative_path ?? j.path ?? null,
    programs: [...new Set(((j.steps ?? []) as any[]).map((s) => s.program).filter((x: unknown): x is string => typeof x === 'string'))],
  }));

  const programs: ProgramRecord[] = ((inv.file_registry ?? []) as any[])
    .filter((r) => r.type === 'program')
    .map((r) => {
      const pr = parserByFile.get(r.file_id);
      const lg = logicByFile.get(r.file_id);
      const lf = logicFileByFile.get(r.file_id);
      const entryTypes = new Set<string>();
      for (const t of (lf?.execution_traces ?? []) as any[]) if (typeof t?.entry_type === 'string') entryTypes.add(t.entry_type);
      const jobs: ProgramRecord['jcl_jobs'] = [];
      for (const j of (inv.jcl_registry ?? []) as any[]) {
        for (const s of (j.steps ?? []) as any[]) if (s.program === r.program_id) jobs.push({ job_name: j.job_name ?? j.id, file_id: j.file_id ?? null, step: s.step_name ?? null });
      }
      return {
        program_id: r.program_id,
        file_id: r.file_id,
        path_id: r.path_id ?? null,
        system_id: r.system_id ?? inv.meta?.system_id ?? null,
        relative_path: r.relative_path ?? r.path ?? null,
        file_name: r.file_name ?? null,
        size_bytes: typeof r.size_bytes === 'number' ? r.size_bytes : null,
        inventory_subtype: r.subtype ?? null,
        duplicate_program_id: (nameCount.get(r.program_id) ?? 0) > 1,
        parse: pr
          ? { status: pr.parse_status, paragraph_count: pr.paragraph_count ?? null, statement_count: pr.statement_count ?? null, parse_run_id: pr.parse_run_id ?? null, ast_file: pr.ast_file ?? null }
          : null,
        logic: lg
          ? {
              status: lg.logic_status,
              upstream_verdict: lg.upstream_verdict ?? null,
              logic_file: lg.logic_file ?? null,
              unresolvable_paths: lg.unresolvable_paths ?? 0,
              unresolved_ids: typeof lg.unresolved_ids === 'number' ? lg.unresolved_ids : lg.unresolved_ids?.total ?? 0,
              unresolved_id_breakdown: lg.unresolved_id_breakdown ?? null,
              dead_code_confirmed: lg.dead_code_confirmed ?? 0,
              entry_types: [...entryTypes].sort(),
            }
          : null,
        calls_out: edges.filter((e) => e.from === r.program_id && CALL_TYPES.test(e.type)),
        called_by: edges.filter((e) => e.to === r.program_id && CALL_TYPES.test(e.type)),
        includes: edges.filter((e) => e.from === r.program_id && INCLUDE_TYPES.test(e.type)),
        jcl_jobs: jobs,
      };
    });

  const coverage: string[] = [];
  const invFiles = new Set(programs.map((p) => p.file_id));
  for (const p of parser.programs ?? []) if (!invFiles.has(p.file_id)) coverage.push(`parser lists ${p.program_id} (${p.file_id}) which the inventory does not register as a program`);
  for (const p of logic.programs ?? []) if (!invFiles.has(p.file_id)) coverage.push(`logic lists ${p.program_id} (${p.file_id}) which the inventory does not register as a program`);
  for (const p of programs) {
    if (!p.parse) coverage.push(`${p.program_id} (${p.file_id}) has no parser entry`);
    if (!p.logic) coverage.push(`${p.program_id} (${p.file_id}) has no logic entry`);
  }

  return {
    system_id: inv.meta?.system_id ?? null,
    system_name: inv.meta?.system_display_name ?? inv.meta?.system_name ?? null,
    programs,
    copybooks: ((inv.copybook_registry ?? []) as any[]).map((c) => ({
      name: c.id,
      file_id: c.file_id ?? null,
      path_id: c.path_id ?? null,
      type: c.type ?? null,
      relative_path: c.relative_path ?? c.path ?? null,
      used_by: Array.isArray(c.used_by) ? c.used_by : [],
    })),
    jcl_jobs: jcl,
    other_files: ((inv.other_file_registry ?? []) as any[]).map((o) => ({ id: o.id, file_id: o.file_id ?? null, type: o.type ?? null, relative_path: o.relative_path ?? o.path ?? null })),
    edges,
    unresolved_edges: edges.filter((e) => !e.resolved),
    coverage_mismatches: coverage,
  };
}

/** Applies a program selection (Program IDs or File IDs). Unknown entries are returned, never guessed. */
export function selectPrograms(sys: DiscoveredSystem, selection: 'all' | string[]): { selected: ProgramRecord[]; unknown: string[] } {
  if (selection === 'all') return { selected: sys.programs, unknown: [] };
  const wanted = new Set(selection);
  const selected = sys.programs.filter((p) => wanted.has(p.program_id) || wanted.has(p.file_id));
  const matched = new Set(selected.flatMap((p) => [p.program_id, p.file_id]));
  return { selected, unknown: selection.filter((s) => !matched.has(s)) };
}

/* ------------------------------------------------------------------ */
/* Rules                                                               */
/* ------------------------------------------------------------------ */

export interface NormalizedRuleSource {
  program_id: string | null;
  copybook: string | null;
  paragraph: string | null;
  line: number | null;
  evidence: string | null;
  source_ids: Record<string, string | null>;
}

export interface NormalizedRule {
  ref: RunLocalRef;
  rule_set: RunLocalRef | null;
  name: string;
  category: string;
  confidence: string;
  requires_sme_review: boolean;
  sme_review_note: string | null;
  dead_code: boolean;
  evidence_class: EvidenceClass;
  evidence_reasons: string[];
  /** Programs whose code implements the rule (from the rule's sources). */
  implemented_in: string[];
  /** File IDs cited by the rule's sources (programs or copybooks). */
  file_ids: string[];
  copybook_level: boolean;
  sources: NormalizedRuleSource[];
}

export function normalizeRules(rulesArtifact: LoadedArtifact): NormalizedRule[] {
  const run = sourceRunKey(rulesArtifact);
  return ((rulesArtifact.data?.business_rules ?? []) as any[]).map((r) => {
    const sources: NormalizedRuleSource[] = ((r.sources ?? []) as any[]).map((s) => ({
      program_id: s.program_id ?? null,
      copybook: s.copybook ?? null,
      paragraph: s.paragraph ?? null,
      line: typeof s.line === 'number' ? s.line : null,
      evidence: s.evidence ?? null,
      source_ids: s.source_ids ?? {},
    }));
    const cls = classifyRule({
      confidence: r.confidence,
      requires_sme_review: r.requires_sme_review === true,
      dead_code: r.dead_code === true,
      source_evidence: sources.map((s) => s.evidence),
    });
    const implemented = new Set<string>();
    for (const p of (r.implemented_in_programs ?? []) as string[]) implemented.add(p);
    for (const s of sources) if (s.program_id) implemented.add(s.program_id);
    const fileIds = new Set<string>();
    for (const s of [...sources, r.primary_source ?? {}]) {
      const f = s?.source_ids?.file_id;
      if (typeof f === 'string') fileIds.add(f);
    }
    return {
      ref: { id: r.rule_id, scope: 'run-local' as const, source_run: run },
      rule_set: r.rule_set_id ? { id: r.rule_set_id, scope: 'run-local' as const, source_run: run } : null,
      name: r.name,
      category: r.category,
      confidence: r.confidence,
      requires_sme_review: r.requires_sme_review === true,
      sme_review_note: r.sme_review_note ?? null,
      dead_code: r.dead_code === true,
      evidence_class: cls.evidence_class,
      evidence_reasons: cls.reasons,
      implemented_in: [...implemented].sort(),
      file_ids: [...fileIds].sort(),
      copybook_level: !r.primary_source?.program_id && !!(r.primary_source?.copybook ?? sources.some((s) => s.copybook)),
      sources,
    };
  });
}

/** Rules in a program's scope because they are declared in a copybook it uses (rules_by_program minus implemented). */
export function rulesInScopeByProgram(rulesArtifact: LoadedArtifact): Map<string, string[]> {
  const m = new Map<string, string[]>();
  const rbp = rulesArtifact.data?.rules_by_program;
  if (rbp && typeof rbp === 'object') for (const [p, ids] of Object.entries(rbp)) if (Array.isArray(ids)) m.set(p, ids as string[]);
  return m;
}

/* ------------------------------------------------------------------ */
/* Gaps                                                                */
/* ------------------------------------------------------------------ */

export type ReferenceStatus = 'permanent_id' | 'name_or_line_only' | 'catalogue_only' | 'none';

export interface ExpandedGapItem {
  item_id: string;
  gap: RunLocalRef;
  index: number;
  program_id: string | null;
  file_id: string | null;
  permanent_ids: { file_ids: string[]; paragraph_ids: string[]; statement_ids: string[]; record_ids: string[]; field_ids: string[] };
  run_local_refs: { rule_ids: string[]; diagram_ids: string[]; other: string[] };
  reference_status: ReferenceStatus;
  detail: Record<string, unknown>;
}

export interface NormalizedGap {
  ref: RunLocalRef;
  gap_type: string;
  also_types: string[];
  severity: string;
  title: string;
  requires_sme_review: boolean;
  confidence: string | null;
  source_program: string | null;
  file_ids: string[];
  programs: string[];
  related_rules: RunLocalRef[];
  related_gaps: RunLocalRef[];
  recommended_action: string | null;
  source_ids: Record<string, unknown> | null;
  missing_source_reference: boolean;
  items: ExpandedGapItem[];
}

const NAME_KEYS = ['name', 'names', 'paragraph', 'target', 'line', 'lines', 'construct', 'copybook', 'copy', 'include', 'record', 'holder', 'program', 'programs', 'handler'];

function collectStrings(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) for (const x of v) collectStrings(x, out);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) collectStrings(x, out);
}

export function expandGapItem(gap: any, item: Record<string, unknown>, index: number, run: string): ExpandedGapItem {
  const strings: string[] = [];
  collectStrings(item, strings);
  const perm = { file_ids: [] as string[], paragraph_ids: [] as string[], statement_ids: [] as string[], record_ids: [] as string[], field_ids: [] as string[] };
  const local = { rule_ids: [] as string[], diagram_ids: [] as string[], other: [] as string[] };
  for (const s of new Set(strings)) {
    const k = permanentIdKind(s);
    if (k === 'file') perm.file_ids.push(s);
    else if (k === 'paragraph') perm.paragraph_ids.push(s);
    else if (k === 'statement') perm.statement_ids.push(s);
    else if (k === 'record') perm.record_ids.push(s);
    else if (k === 'field') perm.field_ids.push(s);
    const rk = runLocalIdKind(s);
    if (rk === 'rule') local.rule_ids.push(s);
    else if (rk) local.other.push(s);
  }
  if (typeof item.diagram_id === 'string') local.diagram_ids.push(item.diagram_id);
  const anyPerm = Object.values(perm).some((a) => a.length > 0);
  const anyLocal = local.rule_ids.length + local.diagram_ids.length + local.other.length > 0;
  const anyName = NAME_KEYS.some((k) => item[k] !== undefined && item[k] !== null);
  const status: ReferenceStatus = anyPerm ? 'permanent_id' : anyName ? 'name_or_line_only' : anyLocal ? 'catalogue_only' : 'none';
  const ownFile =
    (typeof item.file_id === 'string' && isPermanentId(item.file_id) ? (item.file_id as string) : null) ??
    [...perm.statement_ids, ...perm.paragraph_ids, ...perm.record_ids, ...perm.field_ids].map(owningFileId).find((f) => !!f) ??
    (typeof gap.source_ids?.file_id === 'string' ? gap.source_ids.file_id : null);
  const program = typeof item.program === 'string' ? item.program : gap.source_program ?? null;
  return {
    item_id: `${gap.gap_id}#${String(index + 1).padStart(2, '0')}`,
    gap: { id: gap.gap_id, scope: 'run-local', source_run: run },
    index,
    program_id: program,
    file_id: ownFile,
    permanent_ids: perm,
    run_local_refs: local,
    reference_status: status,
    detail: item,
  };
}

export function normalizeGaps(gapsArtifact: LoadedArtifact): NormalizedGap[] {
  const run = sourceRunKey(gapsArtifact);
  return ((gapsArtifact.data?.gaps ?? []) as any[]).map((g) => {
    const items = Array.isArray(g.affected) ? (g.affected as any[]).map((it, i) => expandGapItem(g, it ?? {}, i, run)) : [];
    const fileIds = new Set<string>();
    const sid = g.source_ids ?? {};
    if (typeof sid.file_id === 'string') fileIds.add(sid.file_id);
    if (Array.isArray(sid.file_ids)) for (const f of sid.file_ids) if (typeof f === 'string') fileIds.add(f);
    for (const it of items) if (it.file_id) fileIds.add(it.file_id);
    const programs = new Set<string>();
    if (g.source_program) programs.add(g.source_program);
    for (const it of items) if (it.program_id) programs.add(it.program_id);
    for (const it of items) {
      const ps = it.detail.programs;
      if (Array.isArray(ps)) for (const p of ps) if (typeof p === 'string') programs.add(p);
    }
    return {
      ref: { id: g.gap_id, scope: 'run-local' as const, source_run: run },
      gap_type: g.gap_type,
      also_types: Array.isArray(g.also_types) ? g.also_types : [],
      severity: g.severity,
      title: g.title,
      requires_sme_review: g.requires_sme_review === true,
      confidence: g.confidence ?? null,
      source_program: g.source_program ?? null,
      file_ids: [...fileIds].sort(),
      programs: [...programs].sort(),
      related_rules: ((g.related_rule_ids ?? []) as string[]).map((id) => ({ id, scope: 'run-local' as const, source_run: run })),
      related_gaps: ((g.related_gap_ids ?? []) as string[]).map((id) => ({ id, scope: 'run-local' as const, source_run: run })),
      recommended_action: g.recommended_action ?? null,
      source_ids: g.source_ids ?? null,
      missing_source_reference: fileIds.size === 0 && !g.source_program,
      items,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Diagrams (supporting evidence only)                                 */
/* ------------------------------------------------------------------ */

export interface DiagramRef {
  diagram_id: string;
  type: string;
  file: string;
  program_id: string | null;
  incomplete: boolean;
  truncated: boolean;
  edge_evidence: { confirmed: number; uncertain: number; unsupported: number };
  file_ids: string[];
}

export function indexDiagrams(diagramsArtifact: LoadedArtifact | undefined): DiagramRef[] {
  const d = diagramsArtifact?.data;
  if (!d) return [];
  const all: any[] = [
    ...(d.component_diagrams ?? []),
    ...(d.erd_diagrams ?? (d.erd ? [d.erd] : [])),
    ...(d.sequence_diagrams ?? []),
    ...(d.process_flow_diagrams ?? []),
  ];
  const seen = new Map<string, DiagramRef>();
  for (const x of all) {
    if (!x?.diagram_id || seen.has(x.diagram_id)) continue;
    const ev = { confirmed: 0, uncertain: 0, unsupported: 0 };
    for (const e of (x.edge_evidence ?? []) as any[]) if (e?.evidence in ev) ev[e.evidence as keyof typeof ev] += 1;
    seen.set(x.diagram_id, {
      diagram_id: x.diagram_id,
      type: x.type,
      file: x.file,
      program_id: x.program_id ?? x.focal_program ?? null,
      incomplete: x.incomplete === true,
      truncated: x.truncated === true,
      edge_evidence: ev,
      file_ids: Array.isArray(x.source_ids?.file_ids) ? x.source_ids.file_ids : [],
    });
  }
  return [...seen.values()];
}
