export const int = (v: number | null | undefined) => (v === null || v === undefined || Number.isNaN(v) ? '—' : v.toLocaleString('en-US'));

/** A ratio is always shown with its numerator and denominator; the percentage is only a reading aid. */
export const ratioText = (num: number, den: number) => `${int(num)} / ${int(den)}`;

export const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(num === den || num === 0 ? 0 : 1)}%` : '—');

export const shortSha = (sha: string | null | undefined, len = 7) => (sha ? sha.slice(0, len) : 'unknown');

export const REPO_URL = 'https://github.com/vighnasreevara/REVFORGE-Harness';

/** GitHub link to a committed file at the evidence baseline commit. */
export function repoLink(path: string, commit: string | null, line?: number | null): string {
  const ref = commit ?? 'main';
  const clean = path.replace(/^\/+/, '').split('#')[0];
  return `${REPO_URL}/blob/${ref}/${clean.split('/').map(encodeURIComponent).join('/')}${line ? `#L${line}` : ''}`;
}

export const humanize = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function plural(n: number, one: string, many = `${one}s`) {
  return `${int(n)} ${n === 1 ? one : many}`;
}
