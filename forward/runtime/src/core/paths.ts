/**
 * Path normalisation. The reverse artifacts were produced on Windows and
 * contain absolute paths such as "D:/PROJECTS/REVFORGE-Harness/output/...".
 * The forward runtime must work on any OS, so it never relies on those
 * absolute paths: it keeps them verbatim and derives a repo-relative form
 * from known anchors.
 */

export type PathKind = 'windows_absolute' | 'posix_absolute' | 'relative';

export interface PathRef {
  raw: string;
  kind: PathKind;
  repo_relative: string | null;
}

export function pathKind(raw: string): PathKind {
  if (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith('\\\\')) return 'windows_absolute';
  if (raw.startsWith('/')) return 'posix_absolute';
  return 'relative';
}

export function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Derive a repo-relative path. `anchors` are top-level repository directories
 * (for example "output", ".claude", "references"); an absolute path is cut at
 * the first anchor segment. `repoRootHint` (the absolute repo root the reverse
 * run used, if known) is stripped first.
 */
export function normalizePath(raw: string, anchors: string[], repoRootHint?: string | null): PathRef {
  const kind = pathKind(raw);
  const posix = toPosix(raw).replace(/\/+/g, '/');
  if (kind === 'relative') {
    return { raw, kind, repo_relative: posix.replace(/^\.\//, '') };
  }
  if (repoRootHint) {
    const hint = toPosix(repoRootHint).replace(/\/+$/, '');
    if (posix.toLowerCase().startsWith(hint.toLowerCase() + '/')) {
      return { raw, kind, repo_relative: posix.slice(hint.length + 1) };
    }
  }
  const segs = posix.split('/');
  for (let i = 0; i < segs.length; i++) {
    if (anchors.includes(segs[i])) return { raw, kind, repo_relative: segs.slice(i).join('/') };
  }
  return { raw, kind, repo_relative: null };
}
