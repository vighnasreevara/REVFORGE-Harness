import * as fs from 'fs';
import { mirrorStatus } from '../orchestrator/mirror';
import * as path from 'path';
import { loadArtifacts } from '../core/artifacts';
import { RuntimeContext } from '../core/config';
import { gitInfo } from '../core/git';
import { PROTECTED_PREFIXES } from './plan';

export interface DoctorCheck {
  id: string;
  status: 'ok' | 'warn' | 'fail' | 'info';
  detail: string;
}

/** Environment and input inspection. Read-only apart from a write probe in the runs directory. */
export function runDoctor(ctx: RuntimeContext): { ok: boolean; checks: DoctorCheck[] } {
  const checks: DoctorCheck[] = [];
  const major = Number(process.versions.node.split('.')[0]);
  checks.push({ id: 'node_version', status: major >= 20 ? 'ok' : 'fail', detail: `Node ${process.version} (requires >= 20)` });
  for (const dep of ['ajv', 'ajv-formats']) {
    try {
      require.resolve(dep, { paths: [ctx.forwardDir] });
      checks.push({ id: `dependency_${dep}`, status: 'ok', detail: 'installed' });
    } catch {
      checks.push({ id: `dependency_${dep}`, status: 'fail', detail: 'not installed; run npm install in forward/' });
    }
  }
  checks.push({ id: 'config', status: 'ok', detail: `${path.relative(ctx.repoRoot, ctx.configPath)} is valid` });
  checks.push({ id: 'contracts', status: ctx.contracts.names.length ? 'ok' : 'fail', detail: `${ctx.contracts.names.length} contract(s) loaded` });
  checks.push({ id: 'repo_root', status: fs.existsSync(ctx.repoRoot) ? 'ok' : 'fail', detail: ctx.repoRoot });

  const git = gitInfo(ctx.repoRoot, PROTECTED_PREFIXES);
  checks.push({
    id: 'git',
    status: git.available ? 'ok' : 'warn',
    detail: git.available ? `branch ${git.branch ?? '(detached)'} at ${git.commit}; ${git.changed_paths} changed path(s)` : `git unavailable: ${git.error}`,
  });
  if (git.reverse_paths_changed && git.reverse_paths_changed.length) {
    checks.push({ id: 'reverse_harness_untouched', status: 'warn', detail: `reverse-harness paths have local changes: ${git.reverse_paths_changed.slice(0, 10).join(', ')}` });
  } else if (git.available) {
    checks.push({ id: 'reverse_harness_untouched', status: 'ok', detail: 'no local changes under .claude/agents, .claude/skills or output/' });
  }

  // Forward agents and skills: forward/ is authoritative; .claude/ holds the copy Claude Code discovers.
  const mirror = mirrorStatus(ctx);
  const drift = mirror.entries.filter((e) => e.status !== 'IN_SYNC');
  checks.push({ id: 'forward_agents_mirror', status: drift.length ? 'fail' : 'ok', detail: drift.length ? `forward agents/skills differ from their .claude/ copies (run sync-agents): ${drift.map((e) => `${e.name} ${e.status}`).join(', ')}` : `${mirror.entries.length} forward agents and skills in forward/ match their .claude/ copies` });

  const set = loadArtifacts(ctx);
  for (const a of Object.values(set.artifacts)) {
    const status: DoctorCheck['status'] = !a.present ? (a.required ? 'fail' : 'warn') : !a.parsed ? 'fail' : !a.valid ? (a.required ? 'fail' : 'warn') : 'ok';
    const detail = a.present
      ? `${a.repo_path} (${a.bytes ?? '?'} bytes${a.agent_version ? `, ${a.agent_version}` : ''})${a.errors.length ? ': ' + a.errors.slice(0, 2).join('; ') : ''}`
      : a.errors[0];
    checks.push({ id: `artifact_${a.key}`, status, detail });
  }
  const badLogic = set.logicFiles.filter((f) => !f.valid).length;
  const badRaw = set.rawStructureFiles.filter((f) => !f.valid).length;
  checks.push({ id: 'per_program_logic_files', status: badLogic ? 'fail' : 'ok', detail: `${set.logicFiles.length - badLogic}/${set.logicFiles.length} valid` });
  checks.push({ id: 'per_program_raw_structure_files', status: badRaw ? 'fail' : 'ok', detail: `${set.rawStructureFiles.length - badRaw}/${set.rawStructureFiles.length} valid` });

  if (!ctx.sourceRoot) {
    checks.push({ id: 'cobol_source', status: 'warn', detail: 'original COBOL source not configured (cobol_source.root or its environment variable); planning will rely on reverse artifacts only' });
  } else {
    checks.push({ id: 'cobol_source', status: fs.existsSync(ctx.sourceRoot) ? 'ok' : 'warn', detail: `${ctx.sourceRoot} (${ctx.sourceRootOrigin}) ${fs.existsSync(ctx.sourceRoot) ? 'exists' : 'does not exist'}` });
  }
  try {
    fs.mkdirSync(ctx.runsDir, { recursive: true });
    const probe = path.join(ctx.runsDir, `.doctor-probe-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.rmSync(probe);
    checks.push({ id: 'runs_dir_writable', status: 'ok', detail: ctx.runsDir });
  } catch (e) {
    checks.push({ id: 'runs_dir_writable', status: 'fail', detail: `${ctx.runsDir}: ${(e as Error).message}` });
  }
  checks.push({ id: 'neo4j', status: 'info', detail: 'not contacted (STEP 1 performs no live Neo4j verification)' });
  checks.push({ id: 'java_generation', status: 'info', detail: `disabled (generation.java_generation_allowed=${ctx.config.generation.java_generation_allowed}, ${ctx.config.generation.current_step})` });
  return { ok: !checks.some((c) => c.status === 'fail'), checks };
}
