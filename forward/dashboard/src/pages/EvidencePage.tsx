import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, Code, Kpi, Notice, PageHeader, Source, StatusBadge } from '../components/ui';
import { SelectFilter } from '../components/controls';
import { useQuery } from '../lib/hooks';
import { int, shortSha } from '../lib/format';

const INTEGRITY: Record<string, { tone: 'verified' | 'blocked' | 'neutral'; label: string; hint?: string }> = {
  verified: { tone: 'verified', label: 'SHA-256 matches' },
  mismatch: { tone: 'blocked', label: 'SHA-256 mismatch', hint: 'The copy differs from the hash recorded from the committed file; it is not loaded.' },
  'no-expected-hash': { tone: 'blocked', label: 'no recorded hash', hint: 'The manifest records no SHA-256 for this file; it cannot be verified and is not loaded.' },
  'not-checked': { tone: 'blocked', label: 'unverifiable', hint: 'Web Crypto was unavailable or the file was absent; nothing unverified is loaded.' },
};

export default function EvidencePage() {
  const m = useModel();
  const v = m.validation;
  const [q, set] = useQuery({ show: '' });
  const failed = v.crossChecks.filter((c) => !c.ok);
  const errors = v.issues.filter((i) => i.level === 'error');
  const lastCommit = new Map((m.manifest?.sources ?? []).map((s) => [s.path, s.last_commit]));
  const checks = q.show === 'failed' ? failed : v.crossChecks;
  return (
    <div className="space-y-4">
      <PageHeader title="Evidence validation" subtitle="How the dashboard verifies its own inputs: every file is a byte-for-byte copy of a committed artifact, hash-checked at load, and every total is recounted from the detailed records and compared with the recorded summary." />
      {errors.length ? (
        <Notice tone="blocked">{errors.length} evidence error(s). Affected values are shown as unavailable rather than substituted.</Notice>
      ) : (
        <Notice tone="verified">All {v.datasets.length} evidence files loaded and all {v.crossChecks.length} cross-checks agree.</Notice>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Baseline commit" value={<span className="font-mono text-lg">{shortSha(m.baselineCommit, 10)}</span>} hint={m.manifest?.baseline_commit_date ?? undefined} />
        <Kpi label="Evidence files" value={`${v.datasets.filter((d) => d.status === 'loaded').length} / ${v.datasets.length}`} hint={`${int(v.datasets.filter((d) => d.integrity === 'verified').length)} hash-verified`} />
        <Kpi label="Cross-checks" value={`${v.crossChecks.length - failed.length} / ${v.crossChecks.length}`} hint="recount equals recorded summary" />
        <Kpi label="Issues" value={int(v.issues.length)} hint={`${errors.length} error(s)`} />
      </div>

      {v.issues.length > 0 && (
        <Card title="Issues">
          <ul className="space-y-1 text-sm">
            {v.issues.map((i, k) => (
              <li key={k} className="flex items-start gap-2">
                <Badge tone={i.level === 'error' ? 'blocked' : i.level === 'warning' ? 'partial' : 'neutral'}>{i.level}</Badge>
                <span><span className="font-mono text-xs">{i.dataset}</span> {i.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Cross-checks" right={<SelectFilter label="Show" value={q.show} onChange={(show) => set({ show })} options={[{ value: 'failed', label: 'Disagreements only', count: failed.length }]} />}>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Evidence cross-checks</caption>
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1 font-semibold">Check</th>
                <th scope="col" className="py-1 font-semibold">Result</th>
                <th scope="col" className="py-1 text-right font-semibold">Recorded</th>
                <th scope="col" className="py-1 text-right font-semibold">Recounted</th>
                <th scope="col" className="py-1 pl-3 font-semibold">What is compared</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={`${c.dataset}-${c.name}`} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="py-1 font-mono text-xs">{c.name}</td>
                  <td className="py-1"><StatusBadge info={c.ok ? { tone: 'verified', label: 'agrees' } : { tone: 'blocked', label: 'disagrees' }} /></td>
                  <td className="py-1 text-right tabular-nums">{c.expected === undefined ? 'unavailable' : int(c.expected)}</td>
                  <td className="py-1 text-right tabular-nums">{c.actual === undefined ? 'unavailable' : int(c.actual)}</td>
                  <td className="py-1 pl-3 text-xs text-slate-600 dark:text-slate-300">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Evidence files">
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[820px] text-sm">
            <caption className="sr-only">Evidence files read by the dashboard</caption>
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1 font-semibold">File</th>
                <th scope="col" className="py-1 font-semibold">Required</th>
                <th scope="col" className="py-1 font-semibold">Status</th>
                <th scope="col" className="py-1 font-semibold">Integrity</th>
                <th scope="col" className="py-1 font-semibold">Last changed in</th>
              </tr>
            </thead>
            <tbody>
              {v.datasets.map((d) => {
                const lc = lastCommit.get(d.path);
                return (
                  <tr key={d.path} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1"><Source path={d.path} /></td>
                    <td className="py-1 text-xs">{d.required ? 'yes' : 'no'}</td>
                    <td className="py-1">
                      <StatusBadge info={d.status === 'loaded' ? { tone: 'structural', label: 'loaded' } : { tone: 'blocked', label: d.status === 'rejected' ? 'rejected (not loaded)' : d.status }} />
                      {d.message && d.status !== 'loaded' && <div className="mt-0.5 max-w-xs text-[11px] text-rose-700 dark:text-rose-300">{d.message}</div>}
                    </td>
                    <td className="py-1"><StatusBadge info={INTEGRITY[d.integrity]} /></td>
                    <td className="py-1 text-xs">{lc ? <><Code>{shortSha(lc.sha)}</Code> {lc.date.slice(0, 10)}</> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Sources are listed in <Code>forward/dashboard/evidence-sources.json</Code> and copied by <Code>npm run evidence</Code>, which also writes the manifest with each file's SHA-256 and git blob.</p>
      </Card>
    </div>
  );
}
