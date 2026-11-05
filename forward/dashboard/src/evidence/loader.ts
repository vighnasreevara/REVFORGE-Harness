// Loads the evidence copies listed in public/evidence/manifest.json. Each file's
// SHA-256 is compared with the manifest, which recorded it from the committed
// file, so the dashboard shows exactly the committed bytes or says it does not.
import { Checker, type Issue } from './check';
import type { DatasetState, Manifest } from './types';

/** Returns the raw bytes of an evidence file, or null when it does not exist. */
export type Fetcher = (path: string) => Promise<Uint8Array | null>;

export interface Bundle {
  manifest: Manifest | null;
  data: Record<string, unknown>;
  readiness: Record<string, unknown>;
  /** Committed Mermaid sources by repository path (fetched on demand). */
  diagramPaths: string[];
  datasets: DatasetState[];
  issues: Issue[];
}

export const browserFetcher: Fetcher = async (path) => {
  const res = await fetch(`${import.meta.env.BASE_URL}evidence/${path}`, { cache: 'no-cache' });
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
};

export async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const decoder = new TextDecoder('utf-8', { fatal: false });

export function decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

function parse(text: string, format: 'json' | 'jsonl'): unknown {
  if (format === 'jsonl') return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
  return JSON.parse(text);
}

async function loadOne(
  fetcher: Fetcher,
  file: { path: string; missing: boolean; sha256?: string },
  key: string,
  required: boolean,
  format: 'json' | 'jsonl',
  check: Checker,
): Promise<{ state: DatasetState; value?: unknown }> {
  const base = { key, path: file.path, required };
  const level = required ? 'error' : 'warning';
  if (file.missing) {
    check.report(level, `${file.path} is not present in the repository`);
    return { state: { ...base, status: 'missing', integrity: 'not-checked', message: 'not present in the repository' } };
  }
  const bytes = await fetcher(file.path);
  if (!bytes) {
    check.report(level, `${file.path} could not be loaded (run npm run evidence)`);
    return { state: { ...base, status: 'missing', integrity: 'not-checked', message: 'evidence copy not found' } };
  }
  const digest = await sha256Hex(bytes);
  const integrity = digest === null ? 'not-checked' : digest === file.sha256 ? 'verified' : 'mismatch';
  if (integrity === 'mismatch') check.report('error', `${file.path}: SHA-256 differs from the manifest (copy is stale or altered)`);
  try {
    const value = parse(decode(bytes), format);
    return { state: { ...base, status: 'loaded', integrity }, value };
  } catch (e) {
    check.report('error', `${file.path}: not valid ${format.toUpperCase()} (${(e as Error).message})`);
    return { state: { ...base, status: 'invalid', integrity, message: 'unparseable' } };
  }
}

export async function loadBundle(fetcher: Fetcher): Promise<Bundle> {
  const check = new Checker('manifest');
  const bundle: Bundle = { manifest: null, data: {}, readiness: {}, diagramPaths: [], datasets: [], issues: check.issues };
  const raw = await fetcher('manifest.json');
  if (!raw) {
    check.report('error', 'public/evidence/manifest.json is missing: run `npm run evidence` to copy the committed evidence');
    return bundle;
  }
  let manifest: Manifest;
  try {
    manifest = JSON.parse(decode(raw)) as Manifest;
  } catch {
    check.report('error', 'manifest.json is not valid JSON');
    return bundle;
  }
  if (manifest.contract !== 'dashboard/evidence-manifest' || !Array.isArray(manifest.sources) || !Array.isArray(manifest.collections)) {
    check.report('error', 'manifest.json does not follow the dashboard/evidence-manifest contract');
    return bundle;
  }
  bundle.manifest = manifest;
  for (const p of manifest.totals?.modified_since_commit ?? []) check.report('warning', `${p} differs from the baseline commit`);
  for (const p of manifest.totals?.uncommitted ?? []) check.report('warning', `${p} is not committed`);

  const jobs: Promise<void>[] = manifest.sources.map(async (s) => {
    const r = await loadOne(fetcher, s, s.key, s.required, s.format ?? 'json', check.scoped(s.key));
    bundle.datasets.push(r.state);
    if (r.value !== undefined) bundle.data[s.key] = r.value;
  });
  for (const c of manifest.collections) {
    if (c.required && c.files.length === 0) check.scoped(c.key).report('error', `${c.dir}: no committed ${c.ext} files`);
    if (c.load === 'lazy') {
      if (c.key === 'diagrams') bundle.diagramPaths = c.files.filter((f) => !f.missing).map((f) => f.path);
      continue;
    }
    for (const f of c.files) {
      jobs.push(
        (async () => {
          const name = f.path.slice(c.dir.length + 1, -c.ext.length);
          const r = await loadOne(fetcher, f, `${c.key}:${name}`, c.required, 'json', check.scoped(c.key));
          bundle.datasets.push(r.state);
          if (r.value !== undefined && c.key === 'readiness') bundle.readiness[name] = r.value;
        })(),
      );
    }
  }
  await Promise.all(jobs);
  bundle.datasets.sort((a, b) => a.path.localeCompare(b.path));
  return bundle;
}

/** Fetch one committed Mermaid source on demand, with the same integrity check. */
export async function loadText(fetcher: Fetcher, manifest: Manifest, path: string): Promise<{ text: string; integrity: DatasetState['integrity'] } | null> {
  const file = manifest.collections.flatMap((c) => c.files).find((f) => f.path === path);
  if (!file || file.missing) return null;
  const bytes = await fetcher(path);
  if (!bytes) return null;
  const digest = await sha256Hex(bytes);
  return { text: decode(bytes), integrity: digest === null ? 'not-checked' : digest === file.sha256 ? 'verified' : 'mismatch' };
}
