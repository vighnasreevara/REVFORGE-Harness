// Small runtime guards for evidence JSON. Each guard records an issue instead of
// throwing, and returns undefined for a wrong value: a missing or malformed
// field is never silently replaced by zero or an empty string.

export type IssueLevel = 'error' | 'warning' | 'info';

export interface Issue {
  level: IssueLevel;
  dataset: string;
  message: string;
}

export class Checker {
  readonly issues: Issue[] = [];

  constructor(public dataset: string) {}

  scoped(dataset: string): Checker {
    const c = new Checker(dataset);
    (c as { issues: Issue[] }).issues = this.issues;
    return c;
  }

  report(level: IssueLevel, message: string): void {
    this.issues.push({ level, dataset: this.dataset, message });
  }

  obj(v: unknown, where: string): Record<string, unknown> | undefined {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    this.report('error', `${where}: expected an object, found ${kind(v)}`);
    return undefined;
  }

  arr<T = unknown>(v: unknown, where: string): T[] | undefined {
    if (Array.isArray(v)) return v as T[];
    this.report('error', `${where}: expected an array, found ${kind(v)}`);
    return undefined;
  }

  num(v: unknown, where: string): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    this.report('error', `${where}: expected a number, found ${kind(v)}`);
    return undefined;
  }

  str(v: unknown, where: string): string | undefined {
    if (typeof v === 'string') return v;
    this.report('error', `${where}: expected a string, found ${kind(v)}`);
    return undefined;
  }

  /** A string or null (null is a recorded value, e.g. "no Java class"). */
  strOrNull(v: unknown, where: string): string | null | undefined {
    if (v === null) return null;
    return this.str(v, where);
  }

  bool(v: unknown, where: string): boolean | undefined {
    if (typeof v === 'boolean') return v;
    this.report('error', `${where}: expected a boolean, found ${kind(v)}`);
    return undefined;
  }

  /** Record a cross-check between two independently derived numbers. */
  equal(name: string, a: number | undefined, b: number | undefined, detail: string): CrossCheck {
    const ok = a !== undefined && b !== undefined && a === b;
    if (!ok) this.report('error', `${name}: ${detail} disagree (${fmt(a)} vs ${fmt(b)})`);
    return { name, dataset: this.dataset, expected: a, actual: b, ok, detail };
  }
}

export interface CrossCheck {
  name: string;
  dataset: string;
  expected: number | undefined;
  actual: number | undefined;
  ok: boolean;
  detail: string;
}

function kind(v: unknown): string {
  if (v === undefined) return 'nothing';
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'an array';
  return typeof v;
}

function fmt(v: number | undefined): string {
  return v === undefined ? 'unavailable' : String(v);
}

export function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const it of items) {
    const k = key(it);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function sameCounts(a: Record<string, number> | undefined, b: Record<string, number> | undefined): boolean {
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] ?? 0) !== (b[k] ?? 0)) return false;
  return true;
}
