/**
 * Git tracking policy for Java sources. The hand-written COBOL runtime
 * (package revforge.cobol under forward/runtime/java/) is application source
 * and is tracked. Every other tracked .java file is a violation, in
 * particular generated programs (forward/generated/, package revforge.app.*)
 * and compilation output. Used by the STEP 11-17 "no production Java" checks.
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export const HANDWRITTEN_JAVA_ROOT = 'forward/runtime/java/revforge/cobol/';

/** Why a tracked .java path is not allowed, or null when it is the hand-written runtime (pure; exported for tests). */
export function javaTrackingViolation(rel: string, content: string | null): string | null {
  const p = rel.replace(/\\/g, '/');
  if (/(^|\/)generated\//.test(p)) return 'generated Java output';
  if (!p.startsWith(HANDWRITTEN_JAVA_ROOT)) return 'Java outside the hand-written runtime';
  if (content === null) return 'unreadable';
  const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(content)?.[1] ?? null;
  if (!pkg || !(pkg === 'revforge.cobol' || pkg.startsWith('revforge.cobol.'))) return `package ${pkg ?? '(none)'} is not the runtime package revforge.cobol`;
  const expected = path.posix.dirname(p.slice('forward/runtime/java/'.length)).replace(/\//g, '.');
  if (pkg !== expected) return `package ${pkg} does not match its directory (${expected})`;
  return null;
}

export function trackedJava(repo: string): string[] {
  return spawnSync('git', ['-C', repo, 'ls-files', '*.java'], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);
}

/** Tracked .java files that break the policy (empty when only the hand-written runtime is tracked). */
export function javaTrackingViolations(repo: string): Array<{ path: string; reason: string }> {
  return trackedJava(repo)
    .map((p) => {
      const abs = path.join(repo, p);
      return { path: p, reason: javaTrackingViolation(p, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null) };
    })
    .filter((x): x is { path: string; reason: string } => x.reason !== null);
}
