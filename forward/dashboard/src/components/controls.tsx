import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, RotateCcw, Search, X } from 'lucide-react';
import { paginate, sortBy, type SortDir, type SortValue } from '../lib/table';
import { int } from '../lib/format';

const field =
  'h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const id = useId();
  return (
    <div className="relative min-w-[14rem] flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${field} w-full pl-8`} />
    </div>
  );
}

export function SelectFilter({ label, value, onChange, options, allLabel = 'All' }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string; count?: number }[]; allLabel?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} max-w-[16rem]`}>
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.count !== undefined ? ` (${o.count})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ResetButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-1.5 self-end rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      <RotateCcw aria-hidden className="h-3.5 w-3.5" /> Reset filters
    </button>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div role="search" className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {children}
    </div>
  );
}

export function Pager({ page, pages, start, end, total, onPage, noun }: { page: number; pages: number; start: number; end: number; total: number; onPage: (p: number) => void; noun: string }) {
  const btn = 'inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800';
  return (
    <nav aria-label={`${noun} pages`} className="flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-slate-600 dark:text-slate-300">
      <span aria-live="polite">
        {total ? `${int(start)}–${int(end)} of ${int(total)} ${noun}` : `0 ${noun}`}
      </span>
      <span className="flex items-center gap-1.5">
        <button type="button" className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft aria-hidden className="h-3.5 w-3.5" /> Prev
        </button>
        <span className="tabular-nums">
          Page {page} / {pages}
        </span>
        <button type="button" className={btn} onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
          Next <ChevronRight aria-hidden className="h-3.5 w-3.5" />
        </button>
      </span>
    </nav>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sort?: (row: T) => SortValue;
  className?: string;
}

/** Sortable, paginated table. Sort state is lifted so pages can keep it in the URL. */
export function DataTable<T>({
  rows, columns, rowKey, sortKey, sortDir, onSort, page, onPage, pageSize = 25, noun, caption, empty,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  sortKey: string;
  sortDir: SortDir;
  onSort: (key: string, dir: SortDir) => void;
  page: number;
  onPage: (p: number) => void;
  pageSize?: number;
  noun: string;
  caption: string;
  empty?: ReactNode;
}) {
  const col = columns.find((c) => c.key === sortKey && c.sort);
  const sorted = col ? sortBy(rows, col.sort!, sortDir, rowKey) : rows;
  const pg = paginate(sorted, page, pageSize);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {columns.map((c) => {
                const active = c.key === sortKey;
                const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-2 py-2 font-semibold ${c.className ?? ''}`}>
                    {c.sort ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.key, active && sortDir === 'asc' ? 'desc' : 'asc')}
                        className="inline-flex items-center gap-1 uppercase hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:text-white"
                      >
                        {c.header} <Icon aria-hidden className="h-3 w-3" />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pg.rows.map((r) => (
              <tr key={rowKey(r)} className="border-b border-slate-100 align-top hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                {columns.map((c) => (
                  <td key={c.key} className={`px-2 py-2 ${c.className ?? ''}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!pg.rows.length && (empty ?? <p className="py-8 text-center text-sm italic text-slate-500">No {noun} match these filters.</p>)}
      </div>
      <Pager page={pg.page} pages={pg.pages} start={pg.start} end={pg.end} total={pg.total} onPage={onPage} noun={noun} />
    </div>
  );
}

/** Side drawer for record details; Escape closes it and focus moves into it. */
export function Drawer({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-slate-900/40" />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl outline-none dark:bg-slate-900">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
