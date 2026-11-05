// Filtering, sorting, pagination and CSV export shared by the explorers.
// All functions are pure so they can be tested without rendering.
import type { Gap, Priority, Severity } from '../evidence/types';

export type SortDir = 'asc' | 'desc';

export interface Page<T> {
  rows: T[];
  page: number;
  pages: number;
  total: number;
  start: number;
  end: number;
}

export function paginate<T>(rows: T[], page: number, size: number): Page<T> {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, page), pages);
  const start = (p - 1) * size;
  const slice = rows.slice(start, start + size);
  return { rows: slice, page: p, pages, total: rows.length, start: rows.length ? start + 1 : 0, end: start + slice.length };
}

export type SortValue = string | number | null | undefined;

export function sortBy<T>(rows: T[], value: (r: T) => SortValue, dir: SortDir, tie: (r: T) => string): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Unrecorded values always sort last, whatever the direction.
    if (va === null || va === undefined) return vb === null || vb === undefined ? tie(a).localeCompare(tie(b)) : 1;
    if (vb === null || vb === undefined) return -1;
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'en', { numeric: true });
    return c !== 0 ? c * sign : tie(a).localeCompare(tie(b), 'en', { numeric: true });
  });
}

export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
export const PRIORITY_RANK: Record<Priority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export interface GapFilters {
  q: string;
  category: string;
  severity: string;
  priority: string;
  owner: string;
  program: string;
  group: string;
  rule: string;
  inventory: string;
}

export const EMPTY_GAP_FILTERS: GapFilters = { q: '', category: '', severity: '', priority: '', owner: '', program: '', group: '', rule: '', inventory: '' };

export function matchesText(haystack: (string | null | undefined)[], q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return needle.split(/\s+/).every((t) => haystack.some((h) => h?.toLowerCase().includes(t)));
}

export function filterGaps(gaps: Gap[], f: GapFilters): Gap[] {
  return gaps.filter(
    (g) =>
      (!f.category || g.category === f.category) &&
      (!f.severity || g.severity === f.severity) &&
      (!f.priority || g.priority === f.priority) &&
      (!f.owner || g.owner === f.owner) &&
      (!f.program || g.programs.includes(f.program)) &&
      (!f.group || g.rootCauseGroup === f.group) &&
      (!f.rule || g.rules.includes(f.rule) || g.ruleLinks.some((l) => l.rule === f.rule)) &&
      (!f.inventory || g.inventoryCategory === f.inventory) &&
      matchesText([g.id, g.originalId, g.subject, g.description, g.rootCause, g.kind, g.sourcePath, ...g.programs, ...g.rules], f.q),
  );
}

export type GapSortKey = 'id' | 'severity' | 'priority' | 'category' | 'owner' | 'program' | 'group';

export function sortGaps(gaps: Gap[], key: GapSortKey, dir: SortDir): Gap[] {
  const value = (g: Gap): SortValue => {
    switch (key) {
      case 'severity':
        return SEVERITY_RANK[g.severity];
      case 'priority':
        return PRIORITY_RANK[g.priority];
      case 'category':
        return g.category;
      case 'owner':
        return g.owner;
      case 'program':
        return g.programs[0] ?? null;
      case 'group':
        return g.rootCauseGroup;
      default:
        return g.id;
    }
  };
  return sortBy(gaps, value, dir, (g) => g.id);
}

/** RFC 4180 CSV. Cells that a spreadsheet would execute as a formula are prefixed with a quote. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let t = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export const GAP_CSV_HEADER = [
  'master_id', 'original_id', 'inventory_category', 'category', 'root_cause_group', 'root_cause', 'severity', 'priority',
  'owner', 'programs', 'rules', 'blocked_by', 'blocks', 'status', 'required_next_action', 'source_reference',
];

export function gapsToCsv(gaps: Gap[]): string {
  return toCsv(
    GAP_CSV_HEADER,
    gaps.map((g) => [
      g.id, g.originalId, g.inventoryCategory, g.category, g.rootCauseGroup, g.rootCause, g.severity, g.priority,
      g.owner, g.programs.join(' '), [...new Set([...g.rules, ...g.ruleLinks.map((l) => l.rule)])].join(' '),
      g.blockedBy.join(' '), g.blocks.join(' '), g.status, g.nextAction, g.sourceReference,
    ]),
  );
}

export function download(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const uniqueSorted = (values: (string | null | undefined)[]) => [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
