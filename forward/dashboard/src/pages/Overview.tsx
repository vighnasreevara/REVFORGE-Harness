import { Link } from 'react-router-dom';
import { useModel } from '../evidence/EvidenceContext';
import { BarList, type BarDatum } from '../components/charts';
import { Badge, Card, Kpi, Notice, PageHeader, RatioBar, Sources, StatusBadge, Unavailable } from '../components/ui';
import { int, shortSha } from '../lib/format';
import { COVERAGE_KIND, PROGRAM_STATUS, READINESS, RULE_STATUS, SEVERITY, statusOf } from '../lib/status';
import { countBy } from '../evidence/check';

const S22 = 'forward/reports/step-22';
const S23 = 'forward/reports/step-23';

export default function Overview() {
  const m = useModel();
  const programs = m.programs;
  const rules = m.rules;
  const gaps = m.gaps;
  const src = (key: string) => m.manifest?.sources.find((s) => s.key === key);
  const fs = src('finalSummary');
  const reg = src('register');

  const programDist: BarDatum[] = programs
    ? (['COMPLETE', 'PARTIAL', 'MISSING'] as const).map((k) => ({ key: k, label: PROGRAM_STATUS[k].label, value: programs.filter((p) => p.classification === k).length, tone: PROGRAM_STATUS[k].tone, to: `/programs?cls=${k}` }))
    : [];
  const ruleDist: BarDatum[] = rules
    ? Object.keys(RULE_STATUS).map((k) => ({ key: k, label: RULE_STATUS[k].label, value: rules.filter((r) => r.status === k).length, tone: RULE_STATUS[k].tone, to: `/rules?status=${k}` }))
    : [];
  const sevCounts = gaps ? countBy(gaps, (g) => g.severity) : {};
  const sevDist: BarDatum[] = ['critical', 'high', 'medium', 'low'].map((k) => ({ key: k, label: SEVERITY[k].label, value: sevCounts[k] ?? 0, tone: SEVERITY[k].tone, to: `/gaps?severity=${k}` }));
  const readyDist: BarDatum[] = programs
    ? ['PASS', 'FAIL'].map((k) => ({ key: k, label: READINESS[k].label, value: programs.filter((p) => p.readiness.status === k).length, tone: READINESS[k].tone, to: `/testing?readiness=${k}` }))
    : [];

  const count = (pred: boolean[] | undefined) => (pred ? pred.filter(Boolean).length : undefined);
  const equivalent = count(programs?.map((p) => p.cobolEquivalence !== 'NOT_ESTABLISHED'));
  const kpi = (v: number | undefined) => (v === undefined ? 'unavailable' : int(v));
  const coverageKeys = ['programs_with_java', 'paragraphs_mapped', 'statements_mapped', 'statements_test_executed', 'rules_source_derived_tested', 'readiness_pass', 'programs_cobol_equivalent'];
  const coverage = coverageKeys.map((k) => m.coverage.find((c) => c.metric === k)).filter((c): c is NonNullable<typeof c> => !!c);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Executive overview"
        subtitle="Engineering status of the COBOL-to-Java modernization as recorded in the committed STEP-22 reconciliation and STEP-23 master gap register. Values are historical reported results, read from the evidence files, not live status."
      />
      <Notice tone="unestablished">
        <strong>COBOL-to-Java behavioral equivalence has not been established.</strong> No COBOL compiler or captured legacy execution is available; every
        program and rule records <code>cobol_equivalence: {m.summary.cobolEquivalence ?? 'not recorded'}</code>. Passing builds and source-derived tests do not prove equivalence.
      </Notice>

      {!programs || !rules || !gaps ? (
        <Unavailable what="primary KPIs" paths={[`${S22}/program-reconciliation.json`, `${S22}/business-rule-reconciliation.json`, `${S23}/master-gap-register.json`].filter((_, i) => ![programs, rules, gaps][i])} />
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi label="COBOL programs" value={kpi(programs?.length)} to="/programs" source={`${S22}/program-reconciliation.json`} />
        <Kpi label="Java present" value={kpi(count(programs?.map((p) => !!p.javaClass)))} hint="Generated Java exists (not a quality claim)" to="/programs" />
        <Kpi label="Complete (current criteria)" value={kpi(count(programs?.map((p) => p.classification === 'COMPLETE')))} hint="PORTREAD, PROGNAME" to="/programs?cls=COMPLETE" />
        <Kpi label="Partial" value={kpi(count(programs?.map((p) => p.classification === 'PARTIAL')))} to="/programs?cls=PARTIAL" />
        <Kpi label="Missing" value={kpi(count(programs?.map((p) => p.classification === 'MISSING')))} hint="POSUPDT: source is empty" to="/programs?cls=MISSING" />
        <Kpi label="Business rules" value={kpi(rules?.length)} to="/rules" source={`${S22}/business-rule-reconciliation.json`} />
        <Kpi label="Java-verified rules" value={kpi(count(rules?.map((r) => r.status === 'IMPLEMENTED_VERIFIED')))} hint="By source-derived tests; not legacy-compared" to="/rules?status=IMPLEMENTED_VERIFIED" />
        <Kpi label="Open gap records" value={kpi(count(gaps?.map((g) => g.status === 'OPEN')))} hint={`of ${kpi(gaps?.length)} register records`} to="/gaps" source={`${S23}/master-gap-register.json`} />
        <Kpi label="Readiness passing" value={kpi(count(programs?.map((p) => p.readiness.status === 'PASS')))} hint="SOURCE_READINESS gate" to="/testing" />
        <Kpi label="COBOL-equivalent programs" value={kpi(equivalent)} hint="Independently established: none" to="/handover#limitations" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Program implementation">
          <BarList data={programDist} label="Programs by implementation classification" />
          <Sources paths={[`${S22}/program-reconciliation.json`]} />
        </Card>
        <Card title="Business-rule verification">
          <BarList data={ruleDist} label="Business rules by verification status" labelWidth={230} />
          <Sources paths={[`${S22}/business-rule-reconciliation.json`]} />
        </Card>
        <Card title="Open gaps by severity">
          <BarList data={sevDist} label="Open gap records by severity" labelWidth={90} />
          <Sources paths={[`${S23}/master-gap-register.json`]} />
        </Card>
        <Card title="Source readiness">
          <BarList data={readyDist} label="Programs by SOURCE_READINESS result" labelWidth={120} />
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Readiness is an engineering gate: the source is understood well enough to convert. It never authorizes generation and is not equivalence.</p>
          <Sources paths={[`${S22}/readiness/`, `${S22}/verification-results.json`]} />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Forward engineering coverage" className="xl:col-span-2" right={<Link to="/comparison" className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">All comparisons →</Link>}>
          <ul className="space-y-3">
            {coverage.map((c) => (
              <li key={`${c.area}-${c.measure}`} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_14rem]">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {c.area}: {c.measure}
                  </div>
                  <StatusBadge info={statusOf(COVERAGE_KIND, c.kind)} />
                </div>
                <RatioBar num={c.numerator} den={c.denominator} tone={statusOf(COVERAGE_KIND, c.kind).tone} label={`${c.area} ${c.measure}`} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Each measure is a different kind of evidence. They are deliberately not combined into one modernization percentage.</p>
          <Sources paths={[`${S22}/final-summary.json`]} />
        </Card>
        <Card title="BMad governance">
          {m.bmad ? (
            <div className="space-y-3 text-sm">
              <StatusBadge wrap info={{ tone: 'blocked', label: m.bmad.status }} />
              <ul className="grid grid-cols-2 gap-2">
                {[
                  ['Configured', m.bmad.metrics.configured_workflows],
                  ['Authorized', m.bmad.metrics.authorized_workflows],
                  ['Executed live', m.bmad.metrics.executed_live],
                  ['Verified receipts', m.bmad.metrics.verified_receipts],
                  ['Blocked', m.bmad.metrics.blocked_workflows],
                  ['Governed runs', m.bmad.metrics.governed_runs],
                ].map(([k, v]) => (
                  <li key={k as string} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">{k}</div>
                    <div className="text-lg font-bold tabular-nums">{int(v as number)}</div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Mandatory: <Badge tone="structural">{m.bmad.mandatory ? 'yes' : 'no'}</Badge> · PORTREAD governed run <Badge tone="blocked">{m.bmad.portread.verdict}</Badge>
              </p>
              <Link to="/bmad" className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                Governance details →
              </Link>
            </div>
          ) : (
            <Unavailable what="BMad governance status" paths={[`${S22}/bmad-governance-status.json`, `${S23}/bmad-governance-blockers.json`]} />
          )}
        </Card>
      </div>

      <Card title="Evidence snapshot">
        <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Evidence baseline commit</dt>
            <dd className="font-mono">{shortSha(m.baselineCommit, 12)}</dd>
            <dd className="text-xs text-slate-500">{m.manifest?.baseline_commit_date ?? 'date not recorded'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">STEP-22 reconciliation</dt>
            <dd className="font-mono">{shortSha(fs?.last_commit?.sha, 12)}</dd>
            <dd className="text-xs text-slate-500">committed {fs?.last_commit?.date ?? 'unknown'} · measured at {shortSha(m.step22BaselineCommit)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">STEP-23 master gap register</dt>
            <dd className="font-mono">{shortSha(reg?.last_commit?.sha, 12)}</dd>
            <dd className="text-xs text-slate-500">committed {reg?.last_commit?.date ?? 'unknown'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Evidence files</dt>
            <dd>
              {m.validation.datasets.filter((d) => d.integrity === 'verified').length} / {m.validation.datasets.length} hash-verified
            </dd>
            <dd className="text-xs">
              <Link to="/evidence" className="font-semibold text-blue-700 hover:underline dark:text-blue-300">
                Validation report →
              </Link>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
