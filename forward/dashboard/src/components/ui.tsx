// Shared building blocks, adapted from the Forward Engineering Dashboard design
// reference (white rounded cards on a slate plane, dark navigation, soft pills).
import type { ReactNode } from 'react';
import { CircleDashed, CircleHelp, CircleSlash, FileSearch, OctagonAlert, ShieldCheck, Shapes, TriangleAlert, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { StatusInfo, Tone } from '../lib/status';
import { pct, repoLink, ratioText } from '../lib/format';
import { useEvidence } from '../evidence/EvidenceContext';

const TONE_CLASS: Record<Tone, string> = {
  verified: 'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800',
  structural: 'bg-blue-50 text-blue-800 ring-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:ring-blue-800',
  partial: 'bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800',
  serious: 'bg-orange-50 text-orange-900 ring-orange-200 dark:bg-orange-950/60 dark:text-orange-200 dark:ring-orange-800',
  blocked: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800',
  missing: 'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:ring-rose-800',
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700',
  unestablished: 'bg-violet-50 text-violet-800 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-200 dark:ring-violet-800',
};

export const TONE_BAR: Record<Tone, string> = {
  verified: 'bg-emerald-600 dark:bg-emerald-500',
  structural: 'bg-blue-600 dark:bg-blue-500',
  partial: 'bg-amber-400',
  serious: 'bg-orange-400',
  blocked: 'bg-rose-600 dark:bg-rose-500',
  missing: 'bg-rose-600 dark:bg-rose-500',
  neutral: 'bg-slate-400 dark:bg-slate-500',
  unestablished: 'bg-violet-600 dark:bg-violet-400',
};

const TONE_ICON: Record<Tone, typeof ShieldCheck> = {
  verified: ShieldCheck,
  structural: Shapes,
  partial: CircleDashed,
  serious: TriangleAlert,
  blocked: OctagonAlert,
  missing: CircleSlash,
  neutral: CircleHelp,
  unestablished: CircleHelp,
};

/** A status is never colour alone: icon + label, with the definition as a tooltip. */
export function StatusBadge({ info, className = '', wrap = false }: { info: StatusInfo; className?: string; wrap?: boolean }) {
  const Icon = TONE_ICON[info.tone];
  return (
    <span title={info.hint} className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${wrap ? '' : 'whitespace-nowrap'} ${TONE_CLASS[info.tone]} ${className}`}>
      <Icon aria-hidden className="h-3 w-3 shrink-0" strokeWidth={2.5} />
      <span className={wrap ? '' : 'truncate'}>{info.label}</span>
    </span>
  );
}

export function Badge({ children, tone = 'neutral', title }: { children: ReactNode; tone?: Tone; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '', title, right, id }: { children: ReactNode; className?: string; title?: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section id={id} aria-label={typeof title === 'string' ? title : undefined} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Kpi({ label, value, hint, to, source }: { label: string; value: ReactNode; hint?: string; to?: string; source?: string }) {
  const body = (
    <>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{hint}</div>}
    </>
  );
  const cls = 'block rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900';
  return to ? (
    <Link to={to} title={source} className={`${cls} hover:border-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:hover:border-blue-700`}>
      {body}
    </Link>
  ) : (
    <div title={source} className={cls}>
      {body}
    </div>
  );
}

/** numerator / denominator with a bar; the percentage is secondary. */
export function RatioBar({ num, den, tone = 'structural', label }: { num: number; den: number; tone?: Tone; label?: string }) {
  const w = den > 0 ? Math.max(0, Math.min(100, (num / den) * 100)) : 0;
  return (
    <div className="min-w-[8rem]">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold tabular-nums text-slate-800 dark:text-slate-100">{ratioText(num, den)}</span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">{pct(num, den)}</span>
      </div>
      <div role="img" aria-label={`${label ?? ''} ${num} of ${den}`} className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

export function Code({ children, wrap = false, title }: { children: ReactNode; wrap?: boolean; title?: string }) {
  return (
    <code title={title} className={`inline-block max-w-full rounded bg-slate-100 px-1.5 py-0.5 align-middle font-mono text-[11px] text-slate-700 dark:bg-slate-800 dark:text-slate-200 ${wrap ? 'break-all' : 'truncate'}`}>
      {children}
    </code>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm italic text-slate-500 dark:text-slate-400">{children}</p>;
}

/** Shown wherever a required dataset is absent: never a zero or a blank page. */
export function Unavailable({ what, paths }: { what: string; paths: string[] }) {
  return (
    <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-100">
      <div className="flex items-center gap-2 font-semibold">
        <FileSearch aria-hidden className="h-4 w-4" /> Evidence unavailable: {what}
      </div>
      <p className="mt-1">The dashboard does not substitute values. Restore the committed file(s) and run <Code>npm run evidence</Code>:</p>
      <ul className="mt-1 list-disc pl-5">
        {paths.map((p) => (
          <li key={p}>
            <Code wrap>{p}</Code>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cites the committed file a value came from, linked at the evidence baseline commit. */
export function Source({ path, line, label }: { path: string; line?: number | null; label?: string }) {
  const { model } = useEvidence();
  return (
    <a
      href={repoLink(path, model?.baselineCommit ?? null, line)}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex max-w-full items-center gap-1 font-mono text-[11px] text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
      title={`Open ${path} at the evidence baseline commit (GitHub)`}
    >
      <span className="truncate">{label ?? path}{line ? `:${line}` : ''}</span>
      <ExternalLink aria-hidden className="h-3 w-3 shrink-0" />
    </a>
  );
}

/** A path inside the restricted COBOL source checkout: shown, never linked (it is not committed here). */
export function CobolRef({ path }: { path: string | null | undefined }) {
  if (!path) return <span className="text-xs italic text-slate-400">not recorded</span>;
  return (
    <Code wrap title="Path in the restricted COBOL source repository (references/, not committed in this repository)">
      {path}
    </Code>
  );
}

export function Sources({ paths }: { paths: string[] }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
      <span>Source:</span>
      {paths.map((p) => (
        <Source key={p} path={p} />
      ))}
    </p>
  );
}

export function Notice({ tone = 'unestablished', children }: { tone?: Tone; children: ReactNode }) {
  const Icon = TONE_ICON[tone];
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2 text-sm ring-1 ${TONE_CLASS[tone]}`}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(9rem,max-content)_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:pt-0.5">{k}</dt>
          <dd className="min-w-0 break-words text-slate-800 dark:text-slate-100">{v ?? <span className="italic text-slate-400">not recorded</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function IdLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="whitespace-nowrap font-mono text-xs font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-blue-300">
      {children}
    </Link>
  );
}

export function LinkList({ ids, to, limit = 40 }: { ids: string[]; to: (id: string) => string; limit?: number }) {
  if (!ids.length) return <span className="text-xs italic text-slate-400">none recorded</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.slice(0, limit).map((id) => (
        <IdLink key={id} to={to(id)}>
          {id}
        </IdLink>
      ))}
      {ids.length > limit && <span className="text-xs text-slate-500">+{ids.length - limit} more</span>}
    </div>
  );
}
