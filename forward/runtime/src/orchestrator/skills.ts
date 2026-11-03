/**
 * Forward skill registry and validation. The fourteen skill names and their
 * owning roles are fixed; their content is validated from the actual
 * .claude/skills/<name>/SKILL.md files. A skill is reported INSTALLED only
 * when its file passes every check below.
 */
import * as fs from 'fs';
import * as path from 'path';
import { sha256File } from '../core/fsutil';
import { AgentId, AGENTS, parseFrontmatter } from './agents';

export interface SkillSpec {
  name: string;
  owner: AgentId;
  output_contracts: string[];
  write_scope: 'agent_output_dir' | 'java_target_dir';
  /** Commands the skill may ask its agent to execute (Bash); [] for analysis-only skills. */
  may_execute: string[];
}

export const SKILLS: SkillSpec[] = [
  { name: 'fe-source-grounded-requirements', owner: 'F1', output_contracts: ['forward/requirements', 'forward/traceability-edges'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-uncertainty-decision-register', owner: 'F1', output_contracts: ['forward/decision-requests'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-copybook-layout-contract', owner: 'F2', output_contracts: ['forward/data-contracts', 'forward/decision-requests'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-cobol-runtime-file-semantics', owner: 'F2', output_contracts: ['forward/file-runtime-semantics'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-java-architecture-spine', owner: 'F3', output_contracts: ['forward/architecture-record'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-legacy-compatibility-adr', owner: 'F3', output_contracts: ['forward/architecture-record'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-evidence-backed-stories', owner: 'F4', output_contracts: ['forward/development-stories'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-sprint-readiness', owner: 'F4', output_contracts: ['forward/development-stories'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-java-batch-implementation', owner: 'F5', output_contracts: ['forward/implementation-manifest'], write_scope: 'java_target_dir', may_execute: ['mvn'] },
  { name: 'fe-compiler-repair', owner: 'F5', output_contracts: ['forward/implementation-manifest'], write_scope: 'java_target_dir', may_execute: ['mvn'] },
  { name: 'fe-independent-fixture-design', owner: 'F6', output_contracts: ['forward/test-fixture-manifest'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-legacy-java-equivalence', owner: 'F6', output_contracts: ['forward/verification-report'], write_scope: 'agent_output_dir', may_execute: ['mvn'] },
  { name: 'fe-adversarial-code-review', owner: 'F7', output_contracts: ['forward/review-report'], write_scope: 'agent_output_dir', may_execute: [] },
  { name: 'fe-end-to-end-trace-audit', owner: 'F7', output_contracts: ['forward/traceability-edges'], write_scope: 'agent_output_dir', may_execute: [] },
];

export const SKILL_SECTIONS = [
  'Purpose and responsibility',
  'Required input artifacts',
  'Input validation',
  'Execution procedure',
  'Source grounding',
  'Outputs and contracts',
  'Allowed tools and operations',
  'Forbidden operations',
  'Error handling and stop conditions',
  'Quality checks',
  'Source-ID traceability',
  'Orchestrator integration',
];

const METADATA_KEYS = new Set(['skill', 'owner_agent', 'version', 'output_contracts', 'write_scope', 'reads', 'executes']);
const FORBIDDEN_READS = /(^|\/)(\.mcp\.json|\.env|settings\.local\.json)$|(^|\/)\.git(\/|$)/i;

export type SkillState = 'INSTALLED' | 'SKILL_NOT_INSTALLED' | 'SKILL_INVALID';

export interface SkillStatus {
  name: string;
  owner: AgentId | null;
  status: SkillState;
  path: string;
  sha256: string | null;
  problems: string[];
}

export function skillSpec(name: string): SkillSpec | undefined {
  return SKILLS.find((s) => s.name === name);
}

/** Extracts the ```json revforge-skill ... ``` metadata block. */
export function skillMetadata(text: string): { data: any; error: string | null } {
  const m = /```json\s+revforge-skill\s*\r?\n([\s\S]*?)\r?\n```/.exec(text);
  if (!m) return { data: null, error: 'missing ```json revforge-skill metadata block' };
  try {
    return { data: JSON.parse(m[1]), error: null };
  } catch (e) {
    return { data: null, error: `metadata block is not valid JSON: ${(e as Error).message}` };
  }
}

function sectionBodies(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const parts = text.split(/^##\s+/m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const title = (nl < 0 ? p : p.slice(0, nl)).trim();
    out.set(title, nl < 0 ? '' : p.slice(nl + 1).trim());
  }
  return out;
}

/** Validates one skill file against the registry. */
export function validateSkill(skillsDir: string, name: string): SkillStatus {
  const spec = skillSpec(name);
  const p = path.join(skillsDir, name, 'SKILL.md');
  const res: SkillStatus = { name, owner: spec?.owner ?? null, status: 'SKILL_NOT_INSTALLED', path: p, sha256: null, problems: [] };
  if (!spec) {
    res.status = 'SKILL_INVALID';
    res.problems.push(`'${name}' is not one of the fourteen registered forward skills`);
    return res;
  }
  if (!fs.existsSync(p)) {
    res.problems.push('SKILL.md not found');
    return res;
  }
  res.sha256 = sha256File(p);
  const text = fs.readFileSync(p, 'utf8');
  const problems = res.problems;
  const fm = parseFrontmatter(text);
  if (!fm) problems.push('no YAML front matter');
  else {
    if (fm.name !== name) problems.push(`front-matter name '${fm.name}' does not match directory '${name}'`);
    if (!fm.description || fm.description.length < 40) problems.push('front-matter description missing or too short');
    const owner = AGENTS.find((a) => a.id === spec.owner)!;
    const tools = (fm['allowed-tools'] ?? '').split(',').map((t) => t.trim()).filter(Boolean);
    const extra = tools.filter((t) => !owner.allowed_tools.includes(t));
    if (extra.length) problems.push(`allowed-tools exceed the owning agent's tools: ${extra.join(', ')}`);
  }
  const sections = sectionBodies(text);
  for (const s of SKILL_SECTIONS) {
    const body = [...sections.entries()].find(([t]) => t.toLowerCase().startsWith(s.toLowerCase()))?.[1];
    if (body === undefined) problems.push(`missing section '## ${s}'`);
    else if (body.replace(/\s+/g, ' ').length < 120) problems.push(`section '${s}' is too thin to be actionable`);
  }
  const meta = skillMetadata(text);
  if (meta.error) problems.push(meta.error);
  else {
    const d = meta.data;
    const unknown = Object.keys(d).filter((k) => !METADATA_KEYS.has(k));
    if (unknown.length) problems.push(`metadata requests unsupported operations/keys: ${unknown.join(', ')}`);
    if (d.skill !== name) problems.push(`metadata skill '${d.skill}' does not match '${name}'`);
    if (d.owner_agent !== spec.owner) problems.push(`metadata owner '${d.owner_agent}' does not match registry owner ${spec.owner}`);
    const contracts: string[] = Array.isArray(d.output_contracts) ? d.output_contracts : [];
    if (contracts.slice().sort().join() !== spec.output_contracts.slice().sort().join()) problems.push(`metadata output_contracts [${contracts.join(', ')}] differ from registry [${spec.output_contracts.join(', ')}]`);
    if (d.write_scope !== spec.write_scope) problems.push(`metadata write_scope '${d.write_scope}' is not permitted (expected '${spec.write_scope}')`);
    const reads: string[] = Array.isArray(d.reads) ? d.reads : [];
    if (!reads.length) problems.push('metadata declares no input artifacts (reads)');
    const badReads = reads.filter((r) => FORBIDDEN_READS.test(r));
    if (badReads.length) problems.push(`metadata requests forbidden reads: ${badReads.join(', ')}`);
    const exec: string[] = Array.isArray(d.executes) ? d.executes : [];
    const badExec = exec.filter((e) => !spec.may_execute.includes(e));
    if (badExec.length) problems.push(`metadata requests unauthorised execution: ${badExec.join(', ')}`);
  }
  for (const c of spec.output_contracts) if (!text.includes(c)) problems.push(`body does not reference output contract ${c}`);
  const ownerName = AGENTS.find((a) => a.id === spec.owner)!.name;
  if (!text.includes(ownerName)) problems.push(`body does not name its owning agent ${ownerName}`);
  res.status = problems.length ? 'SKILL_INVALID' : 'INSTALLED';
  return res;
}

export interface SkillInventory {
  skills: SkillStatus[];
  unexpected: string[];
  duplicates: string[];
  ownership: Array<{ agent: AgentId; skills: string[]; ok: boolean; problem: string | null }>;
  ok: boolean;
}

/** Validates all fourteen skills, ownership (exactly two per agent), duplicates and unexpected fe-* skills. */
export function validateSkillInventory(skillsDir: string): SkillInventory {
  const skills = SKILLS.map((s) => validateSkill(skillsDir, s.name));
  const present = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('fe-')).map((d) => d.name) : [];
  const unexpected = present.filter((n) => !skillSpec(n));
  // Duplicate front-matter names across fe-* directories.
  const byName = new Map<string, string[]>();
  for (const dir of present) {
    const f = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(f)) continue;
    const fm = parseFrontmatter(fs.readFileSync(f, 'utf8'));
    const n = fm?.name ?? dir;
    byName.set(n, [...(byName.get(n) ?? []), dir]);
  }
  const duplicates = [...byName.entries()].filter(([, dirs]) => dirs.length > 1).map(([n, dirs]) => `${n} declared by ${dirs.join(', ')}`);
  for (const s of skills) {
    const dirs = byName.get(s.name) ?? [];
    if (dirs.length > 1) {
      s.status = 'SKILL_INVALID';
      s.problems.push(`skill name declared by more than one directory: ${dirs.join(', ')}`);
    }
  }
  const ownership = AGENTS.map((a) => {
    const owned = SKILLS.filter((s) => s.owner === a.id).map((s) => s.name);
    const declared = [...a.skills];
    const ok = owned.length === 2 && owned.slice().sort().join() === declared.slice().sort().join();
    return { agent: a.id, skills: owned, ok, problem: ok ? null : `agent ${a.id} declares [${declared.join(', ')}] but owns [${owned.join(', ')}]` };
  });
  const ok = skills.every((s) => s.status === 'INSTALLED') && !unexpected.length && !duplicates.length && ownership.every((o) => o.ok) && new Set(SKILLS.map((s) => s.name)).size === 14;
  return { skills, unexpected, duplicates, ownership, ok };
}

/** Prefixes of the only untracked paths the forward harness may add under .claude/. */
export function allowedForwardAdditions(): string[] {
  return [...AGENTS.map((a) => `.claude/agents/${a.name}.agent.md`), ...SKILLS.map((s) => `.claude/skills/${s.name}/`)];
}
