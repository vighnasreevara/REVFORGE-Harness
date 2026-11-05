// Test fetcher over the byte-for-byte evidence copies in public/evidence/.
import fs from 'node:fs';
import path from 'node:path';
import { loadBundle, type Bundle, type Fetcher } from '../src/evidence/loader';
import { buildModel } from '../src/evidence/model';
import type { Model } from '../src/evidence/types';

export const EVIDENCE = path.resolve(__dirname, '..', 'public', 'evidence');

export const fsFetcher: Fetcher = async (p) => {
  const f = path.join(EVIDENCE, p);
  return fs.existsSync(f) ? new Uint8Array(fs.readFileSync(f)) : null;
};

/** A fetcher that hides some paths, to exercise the evidence-unavailable states. */
export const without = (hidden: string[]): Fetcher => async (p) => (hidden.some((h) => p.endsWith(h)) ? null : fsFetcher(p));

let cached: Promise<{ bundle: Bundle; model: Model }> | null = null;
export function realModel() {
  cached ??= loadBundle(fsFetcher).then((bundle) => ({ bundle, model: buildModel(bundle) }));
  return cached;
}
