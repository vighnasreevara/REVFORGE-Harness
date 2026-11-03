import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { assertNotCodeOutput, GenerationPolicy } from './guard';

export type JsonRead =
  | { ok: true; data: unknown; bytes: number; sha256: string }
  | { ok: false; reason: 'missing' | 'unreadable' | 'invalid_json'; error: string };

export function sha256Buffer(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function sha256File(p: string): string | null {
  try {
    return sha256Buffer(fs.readFileSync(p));
  } catch {
    return null;
  }
}

export function readJson(p: string): JsonRead {
  if (!fs.existsSync(p)) return { ok: false, reason: 'missing', error: `file not found: ${p}` };
  let buf: Buffer;
  try {
    buf = fs.readFileSync(p);
  } catch (e) {
    return { ok: false, reason: 'unreadable', error: (e as Error).message };
  }
  try {
    // Strip a UTF-8 BOM if present; JSON.parse rejects it.
    const text = buf.toString('utf8').replace(/^﻿/, '');
    return { ok: true, data: JSON.parse(text), bytes: buf.length, sha256: sha256Buffer(buf) };
  } catch (e) {
    return { ok: false, reason: 'invalid_json', error: (e as Error).message };
  }
}

/** Combined hash of a set of files (sorted by name), for per-program file families. */
export function combinedHash(files: string[]): { count: number; sha256: string } {
  const h = createHash('sha256');
  const sorted = [...files].sort();
  for (const f of sorted) {
    h.update(path.basename(f));
    h.update('\0');
    h.update(sha256File(f) ?? 'MISSING');
    h.update('\n');
  }
  return { count: sorted.length, sha256: h.digest('hex') };
}

/** Writer for run outputs. Refuses code-generation targets (see guard.ts). */
export class OutputWriter {
  readonly written: string[] = [];
  constructor(
    readonly root: string,
    private readonly policy: GenerationPolicy,
  ) {}

  private target(rel: string): string {
    const abs = path.resolve(this.root, rel);
    const rootAbs = path.resolve(this.root);
    if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
      throw new Error(`refusing to write outside the run directory: ${rel}`);
    }
    assertNotCodeOutput(abs, this.policy);
    return abs;
  }

  writeJson(rel: string, data: unknown): string {
    const abs = this.target(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n', 'utf8');
    this.written.push(abs);
    return abs;
  }

  writeText(rel: string, text: string): string {
    const abs = this.target(rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text, 'utf8');
    this.written.push(abs);
    return abs;
  }
}
