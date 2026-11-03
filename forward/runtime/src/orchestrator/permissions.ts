/**
 * Least-privilege path policy, enforced by the runtime for every path an
 * agent declares as an output (and for any read the orchestrator performs on
 * an agent's behalf). Agent prompt text has no influence on these checks.
 */
import * as path from 'path';
import { isCodeGenerationPath } from '../core/guard';
import { AgentSpec } from './agents';

export interface PolicyRoots {
  repoRoot: string;
  /** forward/runs/<run>/workflow */
  workflowDir: string;
  /** Original COBOL source root, if configured. */
  sourceRoot: string | null;
  /** Explicitly authorised Java target directory (null = none authorised). */
  javaTargetDir: string | null;
  /** True only when generation is authorised by config AND an approved gate. */
  generationAuthorized: boolean;
}

export interface PermissionDecision {
  allowed: boolean;
  reason: string;
}

const norm = (p: string) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
const within = (p: string, dir: string) => {
  const a = norm(p);
  const d = norm(dir).replace(/\/+$/, '');
  return a === d || a.startsWith(d + '/');
};

/** Reverse-harness and source locations no forward agent may ever write. */
export function protectedRoots(r: PolicyRoots): string[] {
  const out = [
    path.join(r.repoRoot, 'output'),
    path.join(r.repoRoot, '.claude'),
    path.join(r.repoRoot, 'references'),
    path.join(r.repoRoot, 'forward', 'runtime'),
    path.join(r.repoRoot, 'forward', 'verification'),
    path.join(r.repoRoot, 'forward', 'contracts'),
    path.join(r.repoRoot, 'forward', 'config'),
    // The forward agents' and skills' own definitions (canonical copies; the .claude/ mirrors are covered above).
    path.join(r.repoRoot, 'forward', 'agents'),
    path.join(r.repoRoot, 'forward', 'skills'),
    path.join(r.repoRoot, '.git'),
  ];
  if (r.sourceRoot) out.push(r.sourceRoot);
  return out;
}

export function agentOutputDir(r: PolicyRoots, a: AgentSpec): string {
  return path.join(r.workflowDir, 'agents', a.id);
}

export function canWrite(a: AgentSpec, target: string, r: PolicyRoots): PermissionDecision {
  for (const p of protectedRoots(r)) if (within(target, p)) return { allowed: false, reason: `${a.name} may not write to protected location ${p}` };
  if (within(target, path.join(r.workflowDir, 'state.json')) || within(target, path.join(r.workflowDir, 'audit.jsonl')) || within(target, path.join(r.workflowDir, 'gates')) || within(target, path.join(r.workflowDir, 'receipts')) || within(target, path.join(r.workflowDir, 'approvals')) || within(target, path.join(r.workflowDir, 'packets')) || within(target, path.join(r.workflowDir, 'extracts')) || within(target, path.join(r.workflowDir, 'coverage')) || within(target, path.join(r.workflowDir, 'verification')) || within(target, path.join(r.workflowDir, 'corrections')) || within(target, path.join(r.workflowDir, 'consolidation')) || within(target, path.join(r.workflowDir, 'decisions')) || within(target, path.join(r.workflowDir, 'g2')) || within(target, path.join(r.workflowDir, 'packet-status')) || within(target, path.join(r.workflowDir, 'step45')) || within(target, path.join(r.workflowDir, 'step55')) || within(target, path.join(r.workflowDir, 'openai')) || within(target, path.join(r.workflowDir, 'authorizations')) || within(target, path.join(r.workflowDir, 'bmad')) || within(target, path.join(r.workflowDir, 'design')) || within(target, path.join(r.workflowDir, 'operations')) || within(target, path.join(r.workflowDir, 'context')) || within(target, path.join(r.workflowDir, 'program_classification.json'))) {
    return { allowed: false, reason: 'workflow state, audit, gate, approval, packet, receipt, extract and coverage records are written only by the runtime' };
  }
  const code = isCodeGenerationPath(target);
  if (code) {
    if (!a.may_write_code) return { allowed: false, reason: `${a.name} may not write Java or build files` };
    if (!r.generationAuthorized) return { allowed: false, reason: 'Java generation is not authorised (config flag and approved gate required)' };
    if (!r.javaTargetDir) return { allowed: false, reason: 'no Java target directory has been authorised' };
    if (!within(target, r.javaTargetDir)) return { allowed: false, reason: `Java may only be written inside ${r.javaTargetDir}` };
    return { allowed: true, reason: 'inside the authorised Java target directory' };
  }
  if (a.may_write_code && r.generationAuthorized && r.javaTargetDir && within(target, r.javaTargetDir)) return { allowed: true, reason: 'inside the authorised Java target directory' };
  if (within(target, agentOutputDir(r, a))) return { allowed: true, reason: 'inside the agent output directory' };
  return { allowed: false, reason: `${a.name} may only write inside ${agentOutputDir(r, a)}` };
}

/** Reads: everything under the repository except credentials and VCS internals. */
export function canRead(a: AgentSpec, target: string, r: PolicyRoots): PermissionDecision {
  const base = path.basename(target).toLowerCase();
  if (base === '.mcp.json' || base === '.env' || base.endsWith('.env') || base === 'settings.local.json') return { allowed: false, reason: 'credentials and local settings are never readable by agents' };
  if (within(target, path.join(r.repoRoot, '.git'))) return { allowed: false, reason: 'VCS internals are not agent inputs' };
  if (within(target, r.repoRoot) || (r.sourceRoot && within(target, r.sourceRoot))) return { allowed: true, reason: 'repository or configured source root' };
  return { allowed: false, reason: `${a.name} may only read inside the repository or the configured COBOL source root` };
}
