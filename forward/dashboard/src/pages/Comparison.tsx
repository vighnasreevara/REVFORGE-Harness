import { useModel } from '../evidence/EvidenceContext';
import { Card, CobolRef, Notice, PageHeader, RatioBar, Source, StatusBadge, Unavailable } from '../components/ui';
import { SelectFilter } from '../components/controls';
import { useQuery } from '../lib/hooks';
import { COVERAGE_KIND, statusOf } from '../lib/status';
import { humanize, int } from '../lib/format';

const KINDS = ['structural', 'implemented', 'test', 'verification', 'equivalence'] as const;

export default function Comparison() {
  const m = useModel();
  const [q, set] = useQuery({ kind: '' });
  if (!m.coverage.length) return <Unavailable what="reverse-vs-forward metrics" paths={['forward/reports/step-22/final-summary.json']} />;
  const rows = m.coverage.filter((c) => !q.kind || c.kind === q.kind);
  const areas = [...new Set(rows.map((r) => r.area))];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Reverse vs forward comparison"
        subtitle="Each reverse-engineered element compared with the generated Java. Rows are numerator / denominator as recorded in the STEP-22 final summary, each recounted from the detailed reconciliation records."
      >
        <SelectFilter label="Evidence kind" value={q.kind} onChange={(kind) => set({ kind })} options={KINDS.map((k) => ({ value: k, label: COVERAGE_KIND[k].label }))} />
      </PageHeader>

      <Card title="What each kind of evidence means">
        <ul className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-5">
          {KINDS.map((k) => (
            <li key={k} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
              <StatusBadge info={COVERAGE_KIND[k]} />
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300">{COVERAGE_KIND[k].hint}</p>
            </li>
          ))}
        </ul>
        <Notice tone="unestablished">
          These measures are not added up into one modernization percentage: a mapped statement is not a tested statement, and a tested statement is not a legacy-equivalent one.
        </Notice>
      </Card>

      {areas.map((area) => (
        <Card key={area} title={area}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">{area} reverse-vs-forward measures</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Measure</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Evidence kind</th>
                  <th scope="col" className="w-56 py-1.5 pr-3 font-semibold">Coverage</th>
                  <th scope="col" className="py-1.5 font-semibold">Definition and source</th>
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.area === area)
                  .map((r) => (
                    <tr key={r.metric} className="border-t border-slate-100 align-top dark:border-slate-800">
                      <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">{r.measure}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge info={statusOf(COVERAGE_KIND, r.kind)} />
                      </td>
                      <td className="py-2 pr-3">
                        <RatioBar num={r.numerator} den={r.denominator} tone={statusOf(COVERAGE_KIND, r.kind).tone} label={r.measure} />
                      </td>
                      <td className="py-2 text-xs text-slate-600 dark:text-slate-300">
                        <div>{r.definition}</div>
                        {r.breakdown && (
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-slate-500 dark:text-slate-400">
                            {Object.entries(r.breakdown)
                              .sort((a, b) => b[1] - a[1])
                              .map(([k, v]) => (
                                <span key={k}>
                                  {humanize(k === 'null' ? 'gap (no Java)' : k)}: <span className="font-semibold tabular-nums">{int(v)}</span>
                                </span>
                              ))}
                          </div>
                        )}
                        <div className="mt-1">
                          <Source path={r.source} />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {area === 'Copybooks' && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              The denominator counts copybooks used by at least one program; copybooks used by none (NOT_USED) are excluded, as recorded.
            </p>
          )}
        </Card>
      ))}

      {m.jcl && (!q.kind || q.kind === 'test') && (
        <Card title="JCL jobs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <caption className="sr-only">JCL jobs and their forward status</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Job</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Status</th>
                  <th scope="col" className="py-1.5 pr-3 font-semibold">Integration test</th>
                  <th scope="col" className="py-1.5 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {m.jcl.map((j) => (
                  <tr key={j.job} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 pr-3 font-mono text-xs font-semibold">{j.job}</td>
                    <td className="py-1.5 pr-3">
                      <StatusBadge info={j.status === 'IMPLEMENTED_TEST_VERIFIED' ? { tone: 'verified', label: 'End-to-end test passes' } : j.status.startsWith('IMPLEMENTED_BLOCKED') ? { tone: 'partial', label: 'Blocked at a step' } : { tone: 'neutral', label: humanize(j.status) }} />
                    </td>
                    <td className="py-1.5 pr-3 text-xs">{humanize(j.integrationTest)}</td>
                    <td className="py-1.5 text-xs">
                      <CobolRef path={j.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">COBOL equivalence is not claimed for any job.</p>
        </Card>
      )}
    </div>
  );
}
