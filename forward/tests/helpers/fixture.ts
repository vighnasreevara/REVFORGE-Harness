/**
 * Builds a small, synthetic reverse-engineering dataset in a temporary
 * directory. Names and counts are deliberately unlike any real system so that
 * tests prove the runtime discovers everything dynamically.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface FixtureOptions {
  system?: string;
  programs?: string[];
  copybooks?: string[];
  /** Omit these artifact keys from the generated dataset. */
  omit?: string[];
  /** Create COBOL source files under <root>/cobol-src. */
  withSource?: boolean;
}

export interface Fixture {
  repoRoot: string;
  forwardDir: string;
  configPath: string;
  runsDir: string;
  sourceRoot: string;
  systemId: string;
  programs: Array<{ name: string; fileId: string; pathId: string; rel: string }>;
  copybooks: Array<{ name: string; fileId: string; pathId: string; rel: string }>;
  write(rel: string, data: unknown): void;
  read(rel: string): any;
}

export const FORWARD_DIR = path.resolve(__dirname, '..', '..', '..');

const pad = (n: number, w: number) => String(n).padStart(w, '0');

export function makeFixture(opts: FixtureOptions = {}): Fixture {
  const sys = opts.system ?? 'TESTSYS';
  const systemId = `SYS-${sys}-001`;
  const names = opts.programs ?? ['ALPHA01', 'BRAVO02', 'CHARLIE3'];
  const cbNames = opts.copybooks ?? ['RECLAYT'];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-fwd-'));
  let n = 0;
  const copybooks = cbNames.map((name) => {
    n++;
    return { name, fileId: `${systemId}-FIL-${pad(n, 4)}`, pathId: `${systemId}-PATH-${pad(n, 4)}`, rel: `src/copy/${name}.cpy` };
  });
  const programs = names.map((name) => {
    n++;
    return { name, fileId: `${systemId}-FIL-${pad(n, 4)}`, pathId: `${systemId}-PATH-${pad(n, 4)}`, rel: `src/prog/${name}.cbl` };
  });
  n++;
  const jcl = { name: 'JOBX', fileId: `${systemId}-FIL-${pad(n, 4)}`, pathId: `${systemId}-PATH-${pad(n, 4)}`, rel: 'src/jcl/JOBX.jcl' };

  const write = (rel: string, data: unknown) => {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  };
  const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  const omit = new Set(opts.omit ?? []);
  const winRoot = 'C:/Work/Legacy-Repo';

  const cb0 = copybooks[0];
  const edges: any[] = [];
  programs.forEach((p, i) => {
    if (cb0) edges.push({ from: p.name, to: cb0.name, type: 'COPY', resolved: true, source_line_hint: 10 + i });
    if (i > 0) edges.push({ from: programs[0].name, to: p.name, type: 'STATIC_CALL', resolved: true, source_line_hint: 40 + i });
  });
  edges.push({ from: programs[programs.length - 1].name, to: 'MISSINGX', type: 'COPY', resolved: false, source_line_hint: 12 });

  const inventory = {
    meta: { generated_at: '2026-01-01T00:00:00Z', repo_root: `${winRoot}/references/src-repo`, agent_version: '1_inventory@1.0', system_id: systemId, system_name: sys },
    stats: { programs: programs.length },
    file_registry: programs.map((p) => ({ id: p.name, program_id: p.name, system_id: systemId, file_id: p.fileId, path_id: p.pathId, file_name: `${p.name}.cbl`, path: p.rel, relative_path: p.rel, type: 'program', subtype: 'unknown', size_bytes: 100 })),
    copybook_registry: copybooks.map((c) => ({ id: c.name, system_id: systemId, file_id: c.fileId, path_id: c.pathId, file_name: `${c.name}.cpy`, path: c.rel, relative_path: c.rel, type: 'copybook', used_by: programs.map((p) => p.name) })),
    jcl_registry: [{ id: jcl.name, system_id: systemId, file_id: jcl.fileId, path_id: jcl.pathId, relative_path: jcl.rel, job_name: jcl.name, steps: [{ step_name: 'S1', program: programs[0].name, type: 'cobol' }] }],
    other_file_registry: [],
    call_graph: { nodes: [...programs.map((p) => ({ id: p.name, type: 'program' })), ...copybooks.map((c) => ({ id: c.name, type: 'copybook' }))], edges },
    issues: [],
  };

  const parser = {
    meta: { generated_at: '2026-01-01T01:00:00Z', agent_version: '2_parser@1.0', system_id: systemId, parse_run_ids: ['PRUN-TEST-1'] },
    stats: {},
    programs: programs.map((p, i) => ({
      program_id: p.name,
      file_id: p.fileId,
      path_id: p.pathId,
      parse_status: i === programs.length - 1 && programs.length > 2 ? 'empty' : 'success',
      ast_file: `raw_structure/${p.fileId}__${p.name}`,
      paragraph_count: 2,
      statement_count: 3,
      parse_run_id: 'PRUN-TEST-1',
    })),
    issues: [],
  };

  const recs = [
    ...copybooks.map((c) => ({ record_id: `${c.fileId}-REC-0001`, file_id: c.fileId, record_name: `${c.name}-REC`, source_type: 'copybook', used_by_programs: programs.map((p) => p.name) })),
    ...programs.map((p) => ({ record_id: `${p.fileId}-REC-0001`, file_id: p.fileId, record_name: `WS-${p.name}`, source_type: 'program', used_by_programs: [p.name] })),
  ];
  const data = {
    meta: { generated_at: '2026-01-01T02:00:00Z', agent_version: '3_data@1.0', system_id: systemId, data_run_ids: ['DRUN-TEST-1'] },
    record_catalogue: recs,
    field_catalogue: recs.map((r) => ({ record_id: r.record_id, field_id: `${r.file_id}-FLD-000001`, field_name: 'F1' })),
    condition_catalogue: [],
    data_model: { entities: [], relationships: [] },
    issues: [],
  };

  const logic = {
    meta: { generated_at: '2026-01-01T03:00:00Z', agent_version: '4_logic@1.0', system_id: systemId },
    stats: {},
    programs: programs.map((p, i) => ({
      program_id: p.name,
      file_id: p.fileId,
      logic_file: `program_logic/${p.fileId}__${p.name}_logic.json`,
      logic_status: parser.programs[i].parse_status === 'empty' ? 'empty' : i === 1 ? 'partial' : 'success',
      upstream_verdict: 'VALID',
      unresolvable_paths: i === 1 ? 1 : 0,
      unresolved_ids: i === 1 ? 1 : 0,
    })),
    issues: [],
  };

  const stmt = (p: { fileId: string }, k: number) => `${p.fileId}-STMT-${pad(k, 6)}`;
  const par = (p: { fileId: string }, k: number) => `${p.fileId}-PAR-${pad(k, 4)}`;
  const srcIds = (p: { fileId: string; pathId: string; name: string }) => ({ system_id: systemId, file_id: p.fileId, path_id: p.pathId, program_id: p.name, section_id: null, paragraph_id: par(p, 1), statement_id: stmt(p, 1) });
  const rules = {
    meta: { generated_at: '2026-01-01T04:00:00Z', agent_version: '5_rules@1.0', system_id: systemId },
    stats: {},
    rule_sets: [{ rule_set_id: 'RS-001', name: 'Set', rule_ids: ['BR-001', 'BR-002', 'BR-003'] }],
    business_rules: [
      { rule_id: 'BR-001', rule_set_id: 'RS-001', name: 'Confirmed rule', category: 'VALIDATION', confidence: 'confirmed', requires_sme_review: false, primary_source: { program_id: programs[0].name, source_ids: srcIds(programs[0]) }, sources: [{ program_id: programs[0].name, evidence: 'complete', source_ids: srcIds(programs[0]) }], implemented_in_programs: [programs[0].name] },
      { rule_id: 'BR-002', rule_set_id: 'RS-001', name: 'Medium rule', category: 'CALCULATION', confidence: 'medium', requires_sme_review: false, primary_source: { program_id: programs[1 % programs.length].name, source_ids: srcIds(programs[1 % programs.length]) }, sources: [{ program_id: programs[1 % programs.length].name, evidence: 'complete', source_ids: srcIds(programs[1 % programs.length]) }] },
      { rule_id: 'BR-003', rule_set_id: 'RS-001', name: 'Low partial rule', category: 'ROUTING', confidence: 'low', requires_sme_review: true, primary_source: { program_id: programs[0].name, source_ids: srcIds(programs[0]) }, sources: [{ program_id: programs[0].name, evidence: 'partial', source_ids: srcIds(programs[0]) }] },
    ],
    rules_by_program: Object.fromEntries(programs.map((p) => [p.name, []])),
    issues: [],
  };

  const diagrams = {
    meta: { generated_at: '2026-01-01T05:00:00Z', agent_version: '6_diagram@1.0', system_id: systemId },
    component_diagrams: [{ diagram_id: 'COMP-OVERVIEW', file: 'diagrams/component_overview.mmd', type: 'component', source_ids: { file_ids: programs.map((p) => p.fileId) }, edge_evidence: [{ from: 'A', to: 'B', evidence: 'confirmed' }] }],
    erd_diagrams: [],
    sequence_diagrams: [],
    process_flow_diagrams: programs.map((p) => ({ diagram_id: `FLOW-${p.name}`, file: `diagrams/flow_${p.name}.mmd`, type: 'process_flow', program_id: p.name, incomplete: false, edge_evidence: [{ from: 'S', to: 'E', evidence: 'confirmed' }, { from: 'E', to: 'X', evidence: 'unsupported' }] })),
    diagrams_by_file_id: {},
    source_id_verification: { query: 'verify-diagram-source-ids', consistent: true },
  };

  const last = programs[programs.length - 1];
  const gaps = {
    meta: { generated_at: '2026-01-01T06:00:00Z', agent_version: '7_synthesis@1.0', system_id: systemId },
    gaps: [
      {
        gap_id: 'GAP-001', gap_type: 'UNRESOLVABLE_PATH', severity: 'high', title: `${programs[1 % programs.length].name}: targets missing`, requires_sme_review: true,
        source_program: programs[1 % programs.length].name, related_rule_ids: ['BR-002'], related_gap_ids: [],
        source_ids: { system_id: systemId, file_id: programs[1 % programs.length].fileId },
        affected: [
          { paragraph: 'P1', statement_id: stmt(programs[1 % programs.length], 2), line: 20, target: 'MISSING-A' },
          { paragraph: 'P1', statement_id: stmt(programs[1 % programs.length], 3), line: 21, target: 'MISSING-B' },
          { name: 'UNDECLARED-X', line: 30 },
        ],
      },
      { gap_id: 'GAP-002', gap_type: 'EMPTY_SOURCE', severity: 'critical', title: `${last.name} source is empty`, requires_sme_review: true, source_program: last.name, related_rule_ids: [], related_gap_ids: [], source_ids: { system_id: systemId, file_id: last.fileId }, affected: [{ program: last.name }] },
      { gap_id: 'GAP-003', gap_type: 'DIAGRAM_RENDER_UNVERIFIED', severity: 'medium', title: 'Rendering unverified', requires_sme_review: false, source_program: null, related_rule_ids: [], related_gap_ids: [], source_ids: { system_id: systemId, file_id: null }, affected: [{ diagrams: 1 }, {}] },
      { gap_id: 'GAP-004', gap_type: 'SME_REVIEW_REQUIRED', severity: 'high', title: 'Rule needs review', requires_sme_review: true, source_program: programs[0].name, related_rule_ids: ['BR-003'], related_gap_ids: ['GAP-001'], source_ids: { system_id: systemId, file_id: programs[0].fileId }, affected: [{ rule_id: 'BR-003', evidence: 'partial' }] },
    ],
    assumptions: [{ assumption_id: 'ASM-001', description: 'Test assumption', confidence: 'medium' }],
  };

  if (!omit.has('inventory')) write('output/inventory/inventory_artifact.json', inventory);
  if (!omit.has('parser')) {
    write('output/parser/parser_artifact.json', parser);
    for (const p of programs) write(`output/parser/raw_structure/${p.fileId}__${p.name}.json`, { program_summary: {}, program_id: p.name, file_id: p.fileId });
  }
  if (!omit.has('data')) write('output/data/data_artifact.json', data);
  if (!omit.has('logic')) {
    write('output/logic/logic_artifact.json', logic);
    for (const [i, p] of programs.entries()) {
      write(`output/logic/program_logic/${p.fileId}__${p.name}_logic.json`, {
        program_summary: { program_id: p.name, file_id: p.fileId, logic_status: logic.programs[i].logic_status },
        program_id: p.name,
        system_id: systemId,
        file_id: p.fileId,
        path_id: p.pathId,
        execution_traces: [{ entry_type: i === 0 ? 'batch' : 'called_subprogram' }],
        paragraphs: [{ name: 'P1', paragraph_id: par(p, 1) }],
      });
    }
  }
  if (!omit.has('rules')) write('output/rules/rules_artifact.json', rules);
  if (!omit.has('diagrams')) write('output/diagram/diagrams_artifact.json', diagrams);
  if (!omit.has('gaps')) write('output/final_report/gaps_register.json', gaps);
  if (!omit.has('brd')) write('output/final_report/brd.md', '# BRD\n\nSynthetic test BRD.\n');

  const sourceRoot = path.join(root, 'cobol-src');
  if (opts.withSource) {
    for (const x of [...programs, ...copybooks]) write(`cobol-src/${x.rel}`, '       IDENTIFICATION DIVISION.\n');
  }

  const cfg = JSON.parse(fs.readFileSync(path.join(FORWARD_DIR, 'config', 'forward.config.json'), 'utf8'));
  cfg.repo_root = root;
  cfg.runs_dir = 'forward-runs';
  cfg.optional_artifacts = {};
  // Fixture repositories keep agents and skills in the Claude Code layout under .claude/.
  cfg.orchestrator = { ...cfg.orchestrator, agents_dir: '.claude/agents', skills_dir: '.claude/skills' };
  const configPath = path.join(root, 'forward.config.json');
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));

  return { repoRoot: root, forwardDir: FORWARD_DIR, configPath, runsDir: path.join(root, 'forward-runs'), sourceRoot, systemId, programs, copybooks, write, read };
}

export function cleanup(f: Fixture): void {
  fs.rmSync(f.repoRoot, { recursive: true, force: true });
}
