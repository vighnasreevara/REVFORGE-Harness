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
  // Fail closed: bytes are parsed only after their SHA-256 matches the recorded value.
  const integrity = await verifyBytes(bytes, file.sha256);
  if (integrity !== 'verified') {
    const why = REJECTED[integrity];
    check.report('error', `${file.path}: ${why}; not loaded`);
    return { state: { ...base, status: 'rejected', integrity, message: why } };
  }
  try {
    const value = parse(decode(bytes), format);
    return { state: { ...base, status: 'loaded', integrity }, value };
  } catch (e) {
    check.report('error', `${file.path}: not valid ${format.toUpperCase()} (${(e as Error).message})`);
    return { state: { ...base, status: 'invalid', integrity, message: 'unparseable' } };
  }
}

type Integrity = DatasetState['integrity'];

const REJECTED: Record<Exclude<Integrity, 'verified'>, string> = {
  mismatch: 'SHA-256 differs from the manifest (copy is stale or altered)',
  'not-checked': 'SHA-256 could not be computed (Web Crypto unavailable), so the file is unverified',
  'no-expected-hash': 'the manifest records no SHA-256 for this file, so it cannot be verified',
};

/** 'verified' only when a recorded hash exists, Web Crypto is available and the digests are equal. */
export async function verifyBytes(bytes: Uint8Array, expected: string | undefined): Promise<Integrity> {
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) return 'no-expected-hash';
  let digest: string | null = null;
  try {
    digest = await sha256Hex(bytes);
  } catch {
    digest = null;
  }
  if (digest === null) return 'not-checked';
  return digest === expected ? 'verified' : 'mismatch';
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

export type TextResult =
  | { ok: true; text: string; integrity: 'verified' }
  | { ok: false; reason: 'unauthorized' | 'missing' | 'rejected'; integrity?: Integrity; message: string };

/**
 * Fetch one committed Mermaid source on demand. The text is returned only for a path the manifest lists
 * and only after its SHA-256 is verified; anything else is refused with a reason and no text.
 */
export async function loadText(fetcher: Fetcher, manifest: Manifest, path: string): Promise<TextResult> {
  const file = manifest.collections.flatMap((c) => c.files).find((f) => f.path === path);
  if (!file) return { ok: false, reason: 'unauthorized', message: `${path} is not listed in the evidence manifest` };
  if (file.missing) return { ok: false, reason: 'missing', message: `${path} is not present in the repository` };
  const bytes = await fetcher(path);
  if (!bytes) return { ok: false, reason: 'missing', message: `${path} could not be loaded (run npm run evidence)` };
  const integrity = await verifyBytes(bytes, file.sha256);
  if (integrity !== 'verified') return { ok: false, reason: 'rejected', integrity, message: `${path}: ${REJECTED[integrity]}` };
  return { ok: true, text: decode(bytes), integrity };
}
