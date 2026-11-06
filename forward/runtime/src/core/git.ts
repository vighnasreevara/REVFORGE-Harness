import { execFileSync } from 'child_process';
import { discoveryChanges } from '../orchestrator/mirror';
import { allowedForwardAdditions } from '../orchestrator/skills';

export interface GitInfo {
  available: boolean;
  branch: string | null;
  commit: string | null;
  dirty: boolean | null;
  changed_paths: number | null;
  reverse_paths_changed: string[] | null;
  error?: string;
}

function git(repoRoot: string, args: string[]): string {
  return execFileSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/**
 * Read-only Git inspection. `protectedPrefixes` are reverse-harness paths whose
 * local modification is reported (the forward runtime never edits them).
 */
export function gitInfo(repoRoot: string, protectedPrefixes: string[], allowedNewPrefixes: string[] = allowedForwardAdditions()): GitInfo {
  try {
    const commit = git(repoRoot, ['rev-parse', 'HEAD']);
    let branch: string | null = git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch === 'HEAD') branch = null;
    // Not trimmed: porcelain status codes start with a significant space (" M path").
    const status = execFileSync('git', ['-C', repoRoot, 'status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const lines = status.split(/\r?\n/).filter((l) => l.length > 3);
    const entries = lines.map((l) => ({ code: l.slice(0, 2), path: l.slice(3).replace(/^"|"$/g, '') }));
    // New untracked files under an explicitly allowed prefix (forward agent definitions) are not reverse changes;
    // any modification, deletion or rename of a tracked reverse file is.
    const reverse = entries
      .filter((e) => protectedPrefixes.some((pre) => e.path.startsWith(pre)))
      .filter((e) => !(e.code === '??' && allowedNewPrefixes.some((pre) => e.path.startsWith(pre))))
      .map((e) => e.path);
    // .claude/agents and .claude/skills are generated and git-ignored, so Git cannot see edits there.
    // Compare them with their canonical sources instead (edited, source-less or unregistered entries).
    for (const p of discoveryChanges(repoRoot)) if (protectedPrefixes.some((pre) => p.startsWith(pre)) && !reverse.includes(p)) reverse.push(p);
    return { available: true, branch, commit, dirty: lines.length > 0, changed_paths: lines.length, reverse_paths_changed: reverse };
  } catch (e) {
    return {
      available: false,
      branch: null,
      commit: null,
      dirty: null,
      changed_paths: null,
      reverse_paths_changed: null,
      error: (e as Error).message.split('\n')[0],
    };
  }
}
