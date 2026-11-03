/**
 * Deterministic canonical JSON (RFC 8785 / JCS-compatible for the value types
 * used by approval records): object keys sorted by UTF-16 code units, no
 * insignificant whitespace, ECMAScript number formatting. The canonical text
 * is what a human signs; its SHA-256 is the digest every record binds to.
 */
import { createHash } from 'crypto';

export function canonicalize(v: unknown): string {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'boolean':
      return v ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(v)) throw new Error('a non-finite number cannot be canonicalised');
      return JSON.stringify(v);
    case 'string':
      return JSON.stringify(v);
    case 'object': {
      if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonicalize(x))).join(',')}]`;
      const o = v as Record<string, unknown>;
      const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
      return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(o[k])}`).join(',')}}`;
    }
    default:
      throw new Error(`a ${typeof v} value cannot be canonicalised`);
  }
}

export function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** SHA-256 of the canonical JSON form of `v`. */
export function digest(v: unknown): string {
  return sha256Text(canonicalize(v));
}
