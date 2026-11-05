import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, IdLink, Kpi, Notice, PageHeader, RatioBar, Sources, StatusBadge, Unavailable } from '../components/ui';
import { BarList } from '../components/charts';
import { SelectFilter } from '../components/controls';
import { useQuery } from '../lib/hooks';
import { PROGRAM_STATUS, READINESS, statusOf } from '../lib/status';
import { int, shortSha } from '../lib/format';
import type { Program } from '../evidence/types';

const SRC = ['forward/reports/step-22/verification-results.json', 'forward/reports/step-22/final-summary.json', 'forward/reports/step-22/readiness/', 'forward/reports/step-23/regression-runs.jsonl'];

/** Parses "ℹ tests 412 ℹ pass 412 ℹ fail 0 ℹ skipped 0" as recorded by the regression. */
export function parseNodeTestSummary(s: string | number | undefined): { tests: number; pass: number; fail: number; skipped: number } | null {
  if (typeof s !== 'string') return null;
  const get = (k: string) => {
    const m = s.match(new RegExp(`${k}\\s+(\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const tests = get('tests');
  const pass = get('pass');
  const fail = get('fail');
  if (tests === null || pass === null || fail === null) return null;
  return { tests, pass, fail, skipped: get('skipped') ?? 0 };
}

/** "41/42" → [41, 42]. */
export function parseFraction(s: string | number | undefined): [number, number] | null {
  const m = typeof s === 'string' ? s.match(/^(\d+)\/(\d+)$/) : null;
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/** Number of programs failing each readiness check. */
export function failingCheckCounts(programs: Program[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of programs) for (const c of p.readiness.failingChecks) out[c] = (out[c] ?? 0) + 1;
  return out;
}

export default function Testing() {
  const m = useModel();
  const [q, set] = useQuery({ readiness: '', cls: '' });
  const t = m.testing;
  if (!t) return <Unavailable what="recorded verification results" paths={[SRC[0]]} />;
  const npm = parseNodeTestSummary(t.summary.npm_test);
  const validate = parseFraction(t.summary.validate);
  const readiness = parseFraction(t.summary.readiness);
  const rt = t.integration.runtimeUnitTests;
  const programs = m.programs ?? [];
  const rows = programs.filter((p) => (!q.readiness || p.readiness.status === q.readiness) && (!q.cls || p.classification === q.cls));
  const fails = failingCheckCounts(programs);
  const r = (k: string) => m.summary.ratios[k];
  const unverifiedRules = m.rules ? m.rules.filter((x) => x.status !== 'IMPLEMENTED_VERIFIED').length : null;

  return (
    <div className="space-y-4">
      <PageHeader title="Testing and readiness" subtitle="Recorded verification results from the committed STEP-22 verification run and the STEP-23 regression. These are historical results, not live CI." />
      <Notice tone="neutral">
        Recorded verification results · STEP-22 run measured at <span className="font-mono">{shortSha(t.baselineCommit)}</span>. A passing build or test suite shows the Java behaves as the source-derived expectations say; it is not proof of COBOL equivalence.
      </Notice>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Harness tests (npm test)" value={npm ? `${int(npm.pass)} / ${int(npm.tests)}` : 'not recorded'} hint={npm ? `${npm.fail} fail · ${npm.skipped} skipped` : undefined} />
        <Kpi label="Java runtime tests" value={rt ? `${int(rt.PASS)} / ${int(rt.total)}` : String(t.summary.runtime_tests ?? 'not recorded')} hint={rt ? `${rt.FAIL} fail` : undefined} />
        <Kpi label="Pilot validation" value={validate ? `${validate[0]} / ${validate[1]}` : 'not recorded'} hint="CONVERSION_VALIDATION" />
        <Kpi label="Pilot readiness" value={readiness ? `${readiness[0]} / ${readiness[1]}` : 'not recorded'} hint="SOURCE_READINESS" />
        <Kpi label="Doctor" value={String(t.summary.doctor ?? '—').replace('FAIL checks: ', 'fail ').replace('; OK checks: ', ' · ok ')} />
        <Kpi label="Agent sync" value={String(t.summary.sync ?? '—').replace('entries not in sync: ', '') + ' out of sync'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Program integration (recorded)">
          {t.integration.programTests && t.integration.scenarios ? (
            <div className="space-y-4">
              {[['Program tests (isolated)', t.integration.programTests], ['Scenarios', t.integration.scenarios]].map(([label, v]) => {
                const x = v as NonNullable<typeof t.integration.programTests>;
                return (
                  <div key={label as string}>
                    <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{label as string}</div>
                    <RatioBar num={x.PASS} den={x.total} tone="verified" label={`${label} pass`} />
                    <p className="mt-1 text-xs text-slate-500">{int(x.BLOCKED_AS_EXPECTED)} blocked as expected at gaps · {int(x.FAIL)} fail</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm italic text-slate-500">No integration summary recorded.</p>
          )}
        </Card>
        <Card title="Source-derived test coverage">
          <div className="space-y-3">
            {[
              ['Statements executed by passing tests', r('statements_test_executed')],
              ['Paragraphs executed by passing tests', r('paragraphs_test_executed')],
              ['Rules verified by source-derived tests', r('rules_source_derived_tested')],
              ['JCL jobs passing an end-to-end test', r('jcl_end_to_end_tested')],
            ].map(([label, x]) =>
              x && typeof x === 'object' ? (
                <div key={label as string}>
                  <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{label as string}</div>
                  <RatioBar num={x.numerator} den={x.denominator} tone="verified" label={label as string} />
                </div>
              ) : null,
            )}
          </div>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Unverified behaviour</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {r('statements_test_executed') && <li>{int(r('statements_test_executed')!.denominator - r('statements_test_executed')!.numerator)} statements not executed by any passing test</li>}
            {unverifiedRules !== null && <li>{int(unverifiedRules)} rules not fully verified (to a gap, unreachable or blocked)</li>}
            <li>All behaviour: no legacy COBOL execution to compare against</li>
          </ul>
        </Card>
      </div>

      <Card title="Readiness by program">
        <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">Programs failing each check</h3>
            <BarList label="Programs failing each readiness check" labelWidth={170} tone="blocked" data={Object.entries(fails).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k, value: v }))} />
            <p className="mt-2 text-xs text-slate-500">A program can fail more than one check.</p>
          </div>
          <div>
            <div className="mb-2 flex flex-wrap gap-3">
              <SelectFilter label="Readiness" value={q.readiness} onChange={(v) => set({ readiness: v })} options={['PASS', 'FAIL'].map((k) => ({ value: k, label: READINESS[k].label, count: programs.filter((p) => p.readiness.status === k).length }))} />
              <SelectFilter label="Classification" value={q.cls} onChange={(v) => set({ cls: v })} options={['COMPLETE', 'PARTIAL', 'MISSING'].map((k) => ({ value: k, label: PROGRAM_STATUS[k].label }))} />
            </div>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Readiness and validation per program</caption>
                <thead className="sticky top-0 bg-white dark:bg-slate-900">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th scope="col" className="py-1 font-semibold">Program</th>
                    <th scope="col" className="py-1 font-semibold">Readiness</th>
                    <th scope="col" className="py-1 font-semibold">Failing checks</th>
                    <th scope="col" className="py-1 font-semibold">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                      <td className="py-1"><IdLink to={`/programs/${p.id}`}>{p.id}</IdLink></td>
                      <td className="py-1"><StatusBadge info={statusOf(READINESS, p.readiness.status)} /></td>
                      <td className="py-1"><span className="flex flex-wrap gap-1">{p.readiness.failingChecks.map((c) => <Badge key={c} tone="blocked">{c}</Badge>)}</span></td>
                      <td className="py-1"><StatusBadge info={p.validation.exitCode === 0 ? { tone: 'verified', label: 'pass' } : { tone: 'blocked', label: 'fail' }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`STEP-22 verification run (${t.step22Runs.length} commands)`}>
          <RunTable runs={t.step22Runs} />
        </Card>
        <Card title={`STEP-23 regression (${t.step23Runs.length} commands)`}>
          {t.step23Runs.length ? <RunTable runs={t.step23Runs} /> : <p className="text-sm italic text-slate-500">regression-runs.jsonl not available.</p>}
          <p className="mt-2 text-xs text-slate-500">A non-zero exit can be the expected result: <code>bmad governance</code> exits 3 because BMad is blocked, and readiness exits 1 for programs that fail it.</p>
        </Card>
      </div>
      <Sources paths={SRC} />
    </div>
  );
}

function RunTable({ runs }: { runs: { command: string; exitCode: number | null; result: string }[] }) {
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-xs">
        <caption className="sr-only">Recorded commands and results</caption>
        <thead className="sticky top-0 bg-white dark:bg-slate-900">
          <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th scope="col" className="py-1 font-semibold">Exit</th>
            <th scope="col" className="py-1 font-semibold">Command</th>
            <th scope="col" className="py-1 font-semibold">Result</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 align-top dark:border-slate-800">
              <td className="py-1 pr-2 font-mono">{r.exitCode ?? '—'}</td>
              <td className="py-1 pr-2 font-mono break-all">{r.command}</td>
              <td className="py-1 break-words text-slate-600 dark:text-slate-300">{r.result.length > 220 ? `${r.result.slice(0, 220)}…` : r.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
