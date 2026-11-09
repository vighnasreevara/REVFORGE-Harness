/**
 * Forward agent registry. This table is the runtime's source of truth for
 * what each specialist may read, write and use; the Claude Code definition
 * files in .claude/agents/fe-*.agent.md are checked against it, and the
 * orchestrator enforces it independently of any prompt text.
 */
import * as fs from 'fs';
import * as path from 'path';

export type AgentId = 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';

export type InputKind =
  | 'reverse:brd'
  | 'reverse:rules'
  | 'reverse:logic'
  | 'reverse:data'
  | 'reverse:parser'
  | 'reverse:inventory'
  | 'reverse:gaps'
  | 'plan:evidence_packets'
  | 'plan:readiness'
  | 'plan:decision_backlog'
  | 'plan:gap_summary'
  | 'plan:rule_summary'
  | 'plan:program_inventory'
  | 'plan:baseline_manifest'
  | 'workflow:classification'
  | `receipt:${AgentId}`;

export interface AgentSpec {
  id: AgentId;
  name: string;
  title: string;
  responsibility: string;
  /** Workflow states in which the agent may be dispatched. */
  dispatch_states: string[];
  /** State the runtime moves to once a completed receipt is accepted (null = no state change). */
  drafts_state: string | null;
  /** Coverage units the agent works through in dispatch batches ([] = whole-system work). */
  unit_kinds: Array<'program' | 'copybook'>;
  /** Gate (G2 or G3) that must have PASSed on the current baseline before dispatch. */
  requires_gate: string | null;
  /** Pre-checks that must have PASSed on the current baseline before dispatch. */
  requires_prechecks?: Array<'BASELINE' | 'EVIDENCE'>;
  inputs: Array<{ kind: InputKind; required: boolean }>;
  outputs: Array<{ name: string; kind: 'json' | 'markdown' | 'java' | 'build'; contract: string | null }>;
  skills: [string, string];
  /** Claude Code tools the definition file may grant. */
  allowed_tools: string[];
  /** May the agent write Java/build files at all (subject to generation authorisation). */
  may_write_code: boolean;
  /** May the agent modify files another agent produced. */
  may_modify_foreign_outputs: boolean;
  forbidden: string[];
}

const COMMON_FORBIDDEN = [
  'modify reverse-engineering agents, skills or output/ artifacts',
  'modify original COBOL, copybook or JCL sources',
  'write to Neo4j',
  'create, renumber or repair permanent source IDs',
  'declare a gate passed or a deliverable approved',
  'treat BR-/RS-/GAP- catalogue IDs as stable across reverse runs',
];

export const AGENTS: AgentSpec[] = [
  {
    id: 'F1',
    unit_kinds: ['program'],
    name: 'fe-requirements-analyst',
    title: 'Requirements Analyst',
    responsibility: 'Analyse reverse evidence and prepare source-grounded candidate requirements, uncertainty records and decision records.',
    dispatch_states: ['EVIDENCE_VALIDATED', 'REQUIREMENTS_DRAFTED'],
    drafts_state: 'REQUIREMENTS_DRAFTED',
    requires_gate: null,
    requires_prechecks: ['BASELINE', 'EVIDENCE'],
    inputs: [
      { kind: 'reverse:brd', required: true },
      { kind: 'reverse:rules', required: true },
      { kind: 'plan:evidence_packets', required: true },
      { kind: 'reverse:logic', required: true },
      { kind: 'reverse:gaps', required: true },
      { kind: 'plan:decision_backlog', required: true },
      { kind: 'plan:baseline_manifest', required: true },
      { kind: 'workflow:classification', required: true },
    ],
    outputs: [
      { name: 'draft_requirements.json', kind: 'json', contract: 'forward/requirements' },
      { name: 'uncertainty_decision_register.json', kind: 'json', contract: 'forward/decision-requests' },
      { name: 'evidence_references.json', kind: 'json', contract: 'forward/traceability-edges' },
    ],
    skills: ['fe-source-grounded-requirements', 'fe-uncertainty-decision-register'],
    allowed_tools: ['Read', 'Grep', 'Glob', 'Write'],
    may_write_code: false,
    may_modify_foreign_outputs: false,
    forbidden: [...COMMON_FORBIDDEN, 'write Java or build files', 'present a low-confidence or uncertain rule as a verified requirement'],
  },
  {
    id: 'F2',
    unit_kinds: ['program', 'copybook'],
    name: 'fe-data-mapping-specialist',
    title: 'COBOL Data Mapping Specialist',
    responsibility: 'Analyse COBOL records, fields, copybook layouts and file semantics and produce data mappings, file-operation requirements and unresolved layout findings.',
    dispatch_states: ['EVIDENCE_VALIDATED', 'REQUIREMENTS_DRAFTED'],
    drafts_state: null,
    requires_gate: null,
    requires_prechecks: ['BASELINE', 'EVIDENCE'],
    inputs: [
      { kind: 'reverse:data', required: true },
      { kind: 'reverse:parser', required: true },
      { kind: 'reverse:inventory', required: true },
      { kind: 'plan:evidence_packets', required: true },
      { kind: 'plan:gap_summary', required: true },
      { kind: 'plan:baseline_manifest', required: true },
    ],
    outputs: [
      { name: 'data_mappings.json', kind: 'json', contract: 'forward/data-contracts' },
      { name: 'file_operation_requirements.json', kind: 'json', contract: 'forward/file-runtime-semantics' },
      { name: 'unresolved_layout_findings.json', kind: 'json', contract: 'forward/decision-requests' },
    ],
    skills: ['fe-copybook-layout-contract', 'fe-cobol-runtime-file-semantics'],
    allowed_tools: ['Read', 'Grep', 'Glob', 'Write'],
    may_write_code: false,
    may_modify_foreign_outputs: false,
    forbidden: [...COMMON_FORBIDDEN, 'write Java or build files', 'invent a layout for a missing copybook'],
  },
  {
    id: 'F3',
    unit_kinds: [],
    name: 'fe-java-architect',
    title: 'Java Architect',
    responsibility: 'Design the target Java architecture from approved requirements, verified data mappings and resolved technical decisions, with architecture decision records.',
    dispatch_states: ['REQUIREMENTS_APPROVED', 'ARCHITECTURE_DRAFTED'],
    drafts_state: 'ARCHITECTURE_DRAFTED',
    requires_gate: 'G2',
    inputs: [
      { kind: 'receipt:F1', required: true },
      { kind: 'receipt:F2', required: true },
      { kind: 'plan:decision_backlog', required: true },
      { kind: 'plan:evidence_packets', required: true },
      { kind: 'plan:baseline_manifest', required: true },
    ],
    outputs: [
      { name: 'java_architecture.md', kind: 'markdown', contract: null },
      { name: 'architecture_decisions.json', kind: 'json', contract: 'forward/architecture-record' },
      { name: 'component_design.json', kind: 'json', contract: 'forward/architecture-record' },
    ],
    skills: ['fe-java-architecture-spine', 'fe-legacy-compatibility-adr'],
    allowed_tools: ['Read', 'Grep', 'Glob', 'Write'],
    may_write_code: false,
    may_modify_foreign_outputs: false,
    forbidden: [...COMMON_FORBIDDEN, 'write Java or build files', 'design for requirements that are not approved'],
  },
  {
    id: 'F4',
    unit_kinds: [],
    name: 'fe-development-planner',
    title: 'Development Planner',
    responsibility: 'Turn the approved architecture, requirements and data contracts into evidence-backed epics, stories, acceptance criteria and a sprint readiness report.',
    dispatch_states: ['ARCHITECTURE_APPROVED', 'STORIES_DRAFTED'],
    drafts_state: 'STORIES_DRAFTED',
    requires_gate: 'G3',
    inputs: [
      { kind: 'receipt:F3', required: true },
      { kind: 'receipt:F1', required: true },
      { kind: 'receipt:F2', required: true },
      { kind: 'plan:decision_backlog', required: true },
      { kind: 'plan:gap_summary', required: true },
      { kind: 'plan:baseline_manifest', required: true },
    ],
    outputs: [
      { name: 'epics.json', kind: 'json', contract: 'forward/development-stories' },
      { name: 'stories.json', kind: 'json', contract: 'forward/development-stories' },
      { name: 'sprint_readiness.md', kind: 'markdown', contract: null },
    ],
    skills: ['fe-evidence-backed-stories', 'fe-sprint-readiness'],
    allowed_tools: ['Read', 'Grep', 'Glob', 'Write'],
    may_write_code: false,
    may_modify_foreign_outputs: false,
    forbidden: [...COMMON_FORBIDDEN, 'write Java or build files', 'create stories for unapproved architecture or unresolved blocking decisions'],
  },
  {
    id: 'F5',
    unit_kinds: [],
    name: 'fe-java-developer',
    title: 'Java Developer',
    responsibility: 'Implement authorised development stories as Java sources with a Maven build, an implementation manifest and build results, inside the explicitly authorised target directory only.',
    dispatch_states: ['STORIES_DRAFTED', 'IMPLEMENTING'],
    drafts_state: null,
    requires_gate: 'G3',
    inputs: [
      { kind: 'receipt:F4', required: true },
      { kind: 'receipt:F3', required: true },
      { kind: 'receipt:F2', required: true },
      { kind: 'plan:baseline_manifest', required: true },
    ],
    outputs: [
      { name: 'java_sources', kind: 'java', contract: null },
      { name: 'pom.xml', kind: 'build', contract: null },
      { name: 'implementation_manifest.json', kind: 'json', contract: 'forward/implementation-manifest' },
      { name: 'build_results.json', kind: 'json', contract: 'forward/implementation-manifest' },
    ],
    skills: ['fe-java-batch-implementation', 'fe-compiler-repair'],
    allowed_tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'],
    may_write_code: true,
    may_modify_foreign_outputs: false,
    forbidden: [...COMMON_FORBIDDEN, 'write outside the authorised Java target directory', 'implement unapproved or unauthorised stories', 'edit tests owned by the independent tester'],
  },
  {
    id: 'F6',
    unit_kinds: [],
    name: 'fe-independent-tester',
    title: 'Independent Tester',
    responsibility: 'Independently test the generated Java against approved requirements and independent fixtures, and assess equivalence with available COBOL reference behaviour, without repairing implementation code.',
    dispatch_states: ['IMPLEMENTATION_BUILT', 'TESTING'],
    drafts_state: null,
    requires_gate: null,
    inputs: [
      { kind: 'receipt:F5', required: true },
      { kind: 'receipt:F1', required: true },
      { kind: 'plan:evidence_packets', required: true },
      { kind: 'plan:baseline_manifest', required: true },
    ],
    outputs: [
      { name: 'test_fixture_manifest.json', kind: 'json', contract: 'forward/test-fixture-manifest' },
      { name: 'verification_report.md', kind: 'markdown', contract: null },
      { name: 'junit_results.json', kind: 'json', contract: 'forward/verification-report' },
      { name: 'equivalence_assessment.json', kind: 'json', contract: 'forward/verification-report' },
      { name: 'unresolved_test_findings.json', kind: 'json', contract: 'forward/verification-report' },
    ],
    skills: ['fe-independent-fixture-design', 'fe-legacy-java-equivalence'],
    allowed_tools: ['Read', 'Grep', 'Glob', 'Write', 'Bash'],
    may_write_code: false,
    may_modify_foreign_outputs: false,
    forbidden: [...COMMON_FORBIDDEN, 'repair or edit implementation code', 'claim equivalence without executed reference evidence'],
  },
  {
    id: 'F7',
    unit_kinds: [],
    name: 'fe-independent-reviewer',
    title: 'Independent Reviewer',
    responsibility: 'Review the implementation and audit end-to-end traceability from COBOL source IDs through requirements, architecture, stories, Java and tests, and recommend acceptance or rejection.',
    dispatch_states: ['REVIEWING'],
    drafts_state: null,
    requires_gate: null,
    inputs: [
      { kind: 'receipt:F1', required: true },
      { kind: 'receipt:F3', required: true },
      { kind: 'receipt:F4', required: true },
      { kind: 'receipt:F5', required: true },
      { kind: 'receipt:F6', required: true },
      { kind: 'plan:evidence_packets', required: true },
      { kind: 'plan:baseline_manifest', required: true },
    ],
    outputs: [
      { name: 'review_report.md', kind: 'markdown', contract: null },
      { name: 'traceability_audit.json', kind: 'json', contract: 'forward/traceability-edges' },
      { name: 'blocking_findings.json', kind: 'json', contract: 'forward/review-report' },
      { name: 'acceptance_recommendation.json', kind: 'json', contract: 'forward/review-report' },
    ],
    skills: ['fe-adversarial-code-review', 'fe-end-to-end-trace-audit'],
    allowed_tools: ['Read', 'Grep', 'Glob', 'Write'],
    may_write_code: false,
    may_modify_foreign_outputs: false,
    forbidden: [...COMMON_FORBIDDEN, 'modify generated Java, tests or approved evidence', 'accept the system (acceptance is a human gate)'],
  },
];

export function findAgent(key: string): AgentSpec | undefined {
  const k = key.trim();
  return AGENTS.find((a) => a.id === k.toUpperCase() || a.name === k);
}

/* ------------------------------------------------------------------ */
/* Claude Code definition files                                        */
/* ------------------------------------------------------------------ */

export interface DefinitionCheck {
  agent: AgentId;
  name: string;
  path: string;
  present: boolean;
  frontmatter: Record<string, string> | null;
  tools: string[];
  problems: string[];
}

/** Minimal YAML front-matter reader for `key: value` and folded `key: >` blocks. */
export function parseFrontmatter(text: string): Record<string, string> | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!m) return null;
  const out: Record<string, string> = {};
  let key: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      out[key] = kv[2] === '>' || kv[2] === '|' ? '' : kv[2].trim();
    } else if (key && /^\s+/.test(line)) {
      out[key] = (out[key] ? out[key] + ' ' : '') + line.trim();
    }
  }
  return out;
}

export function definitionPath(agentsDir: string, a: AgentSpec): string {
  return path.join(agentsDir, `${a.name}.agent.md`);
}

/** Section headings every forward agent definition must contain. */
export const REQUIRED_SECTIONS = [
  'Responsibility',
  'Required inputs',
  'Expected outputs',
  'Permitted tools',
  'Forbidden actions',
  'Evidence and source-ID requirements',
  'Contracts',
  'Quality gates',
  'Error handling',
  'Stop conditions',
  'Skills',
];

export function checkDefinition(agentsDir: string, a: AgentSpec): DefinitionCheck {
  const p = definitionPath(agentsDir, a);
  const res: DefinitionCheck = { agent: a.id, name: a.name, path: p, present: fs.existsSync(p), frontmatter: null, tools: [], problems: [] };
  if (!res.present) {
    res.problems.push('definition file missing');
    return res;
  }
  const text = fs.readFileSync(p, 'utf8');
  const fm = parseFrontmatter(text);
  res.frontmatter = fm;
  if (!fm) {
    res.problems.push('no YAML front matter');
    return res;
  }
  if (fm.name !== a.name) res.problems.push(`front-matter name '${fm.name}' does not match '${a.name}'`);
  if (!fm.description) res.problems.push('front-matter description missing');
  res.tools = (fm.tools ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  if (!res.tools.length) res.problems.push('front-matter tools missing (an omitted tools field would grant every tool)');
  const extra = res.tools.filter((t) => !a.allowed_tools.includes(t));
  if (extra.length) res.problems.push(`grants tools beyond the runtime policy: ${extra.join(', ')}`);
  for (const s of REQUIRED_SECTIONS) if (!new RegExp(`^##\\s+${s}\\b`, 'mi').test(text)) res.problems.push(`missing section '## ${s}'`);
  for (const s of a.skills) if (!text.includes(s)) res.problems.push(`does not name skill ${s}`);
  for (const o of a.outputs) if (!text.includes(o.name)) res.problems.push(`does not name output ${o.name}`);
  return res;
}
