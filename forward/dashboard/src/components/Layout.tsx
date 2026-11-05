import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BookOpenCheck, Boxes, ChevronDown, FileCheck2, GitCompareArrows, Gauge, Layers, ListChecks, Map as MapIcon, Monitor, Moon, Network, ScrollText, ShieldAlert, Sun, Workflow, FlaskConical,
} from 'lucide-react';
import { useEvidence } from '../evidence/EvidenceContext';
import { useTheme, type Theme } from '../lib/hooks';
import { shortSha } from '../lib/format';
import { Badge } from './ui';

export const NAV = [
  { to: '/', label: 'Executive overview', icon: Gauge, end: true },
  { to: '/comparison', label: 'Reverse vs forward', icon: GitCompareArrows },
  { to: '/programs', label: 'Programs', icon: Boxes },
  { to: '/rules', label: 'Business rules', icon: ListChecks },
  { to: '/gaps', label: 'Master gap register', icon: ScrollText },
  { to: '/dependencies', label: 'Dependency analysis', icon: Network },
  { to: '/roadmap', label: 'Root cause & roadmap', icon: MapIcon },
  { to: '/diagrams', label: 'Diagrams', icon: Layers },
  { to: '/bmad', label: 'BMad governance', icon: ShieldAlert },
  { to: '/testing', label: 'Testing & readiness', icon: FlaskConical },
  { to: '/handover', label: 'Handover & evidence', icon: BookOpenCheck },
  { to: '/evidence', label: 'Evidence validation', icon: FileCheck2 },
] as const;

function Sidebar() {
  const { model } = useEvidence();
  const [open, setOpen] = useState(false);
  const verified = model?.validation.datasets.filter((d) => d.integrity === 'verified').length ?? 0;
  const total = model?.validation.datasets.length ?? 0;
  return (
    <aside className="flex w-full flex-col gap-4 bg-[#1e2536] px-4 py-5 text-slate-200 lg:sticky lg:top-0 lg:h-screen lg:w-[260px] lg:shrink-0 lg:overflow-y-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow">
          <Workflow aria-hidden className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-bold leading-tight text-white">REVFORGE</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Modernization Command Center</div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="main-nav"
        className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 lg:hidden"
      >
        {open ? 'Hide' : 'Show'} navigation <ChevronDown aria-hidden className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <nav id="main-nav" aria-label="Dashboard pages" className={`${open ? 'flex' : 'hidden'} flex-col gap-0.5 lg:flex`}>
        {NAV.map(({ to, label, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${
                isActive ? 'bg-blue-600/90 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon aria-hidden className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto hidden rounded-xl border border-white/5 bg-[#262e40] p-3 text-[11px] leading-relaxed text-slate-300 lg:block">
        <div className="font-semibold text-white">Evidence snapshot</div>
        <div>
          Baseline <span className="font-mono">{shortSha(model?.baselineCommit)}</span>
        </div>
        <div>
          {verified}/{total} files hash-verified
        </div>
        <div className="mt-1 text-slate-400">Recorded results from committed reports. Not live CI. Read-only.</div>
      </div>
    </aside>
  );
}

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

function Header() {
  const { model } = useEvidence();
  const [theme, setTheme] = useTheme();
  const issues = model?.validation.issues.filter((i) => i.level === 'error').length ?? 0;
  const chip = 'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm dark:border-slate-700 dark:bg-slate-900';
  return (
    <header className="flex flex-wrap items-center gap-2">
      <span className={chip} title={model?.baselineCommit ?? undefined}>
        <span className="text-slate-500 dark:text-slate-400">Evidence baseline</span>
        <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{shortSha(model?.baselineCommit)}</span>
      </span>
      <span className={chip} title={model?.step22BaselineCommit ?? undefined}>
        <span className="text-slate-500 dark:text-slate-400">STEP-22 measured at</span>
        <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">{shortSha(model?.step22BaselineCommit)}</span>
      </span>
      <span className={chip}>
        <span className="text-slate-500 dark:text-slate-400">Reports</span>
        <span className="font-semibold text-slate-800 dark:text-slate-100">STEP-22 reconciliation · STEP-23 master gap register</span>
      </span>
      <Badge tone={issues ? 'blocked' : 'verified'} title="Validation of the evidence itself (see Evidence validation)">
        {issues ? `${issues} evidence issue(s)` : 'Evidence cross-checks pass'}
      </Badge>
      <div role="radiogroup" aria-label="Colour theme" className="ml-auto inline-flex rounded-full border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            title={`${label} theme`}
            onClick={() => setTheme(value)}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${theme === value ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <Icon aria-hidden className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex">
      <button
        type="button"
        onClick={() => document.getElementById('main')?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-slate-900"
      >
        Skip to content
      </button>
      <Sidebar />
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 space-y-4 px-4 py-5 outline-none lg:px-6">
        <Header />
        {children}
      </main>
    </div>
  );
}
