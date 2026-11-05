import { Link, useParams } from 'react-router-dom';
import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, CobolRef, Code, IdLink, KeyValue, LinkList, Notice, PageHeader, RatioBar, Sources, StatusBadge, Unavailable } from '../components/ui';
import { DataTable, FilterBar, ResetButton, SearchInput, SelectFilter, type Column } from '../components/controls';
import { useQuery } from '../lib/hooks';
import { matchesText, SEVERITY_RANK, type SortDir } from '../lib/table';
import { PROGRAM_STATUS, READINESS, RULE_STATUS, SEVERITY, statusOf, categoryLabel } from '../lib/status';
import { humanize, int } from '../lib/format';
import type { Program } from '../evidence/types';

const SRC = ['forward/reports/step-22/program-reconciliation.json', 'forward/reports/step-23/program-gap-impact.json', 'forward/reports/step-23/master-gap-register.json'];

/** Notes that the evidence records for specific programs. */
export function programNote(p: Program): { tone: 'verified' | 'missing'; text: string } | null {
  if (p.classification === 'COMPLETE')
    return { tone: 'verified', text: `${p.id} is complete under the current criteria: Java compiled, every check passes, conversion validation passes, readiness passes and no forward gap is open. It is not independently COBOL-equivalent (cobol_equivalence: ${p.cobolEquivalence}).` };
  if (p.classification === 'MISSING')
    return { tone: 'missing', text: `${p.id} has no Java: ${p.readiness.failingChecks.includes('source_available') ? 'the committed source is empty, so readiness fails at source_available and nothing can be converted.' : 'the source cannot be converted.'}` };
  return null;
}

const COLUMNS: Column<Program>[] = [
  { key: 'id', header: 'Program', render: (p) => <IdLink to={`/programs/${p.id}`}>{p.id}</IdLink>, sort: (p) => p.id },
  { key: 'cls', header: 'Classification', render: (p) => <StatusBadge info={statusOf(PROGRAM_STATUS, p.classification)} />, sort: (p) => p.classification },
  { key: 'java', header: 'Java class', render: (p) => (p.javaClass ? <Code>{p.javaClass}</Code> : <span className="text-xs italic text-slate-400">none</span>), sort: (p) => p.javaClass },
  { key: 'readiness', header: 'Readiness', render: (p) => <StatusBadge info={statusOf(READINESS, p.readiness.status)} />, sort: (p) => p.readiness.status },
  {
    key: 'gaps',
    header: 'Gap records',
    render: (p) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="tabular-nums font-semibold">{int(p.gapIds.length)}</span>
        {p.maxSeverity && <StatusBadge info={{ ...SEVERITY[p.maxSeverity], label: `max ${SEVERITY[p.maxSeverity].label.toLowerCase()}` }} />}
      </span>
    ),
    sort: (p) => p.gapIds.length,
    className: 'whitespace-nowrap',
  },
  { key: 'rules', header: 'Rules', render: (p) => <span className="tabular-nums">{int(p.ruleIds.length)}</span>, sort: (p) => p.ruleIds.length },
  {
    key: 'validation',
    header: 'Conversion validation',
    render: (p) => <StatusBadge info={p.validation.exitCode === 0 ? { tone: 'verified', label: 'Validation pass' } : { tone: 'blocked', label: 'Validation fail' }} />,
    sort: (p) => (p.validation.exitCode === null ? null : p.validation.exitCode === 0 ? 0 : 1),
  },
  {
    key: 'checks',
    header: 'Program checks',
    render: (p) => (p.tests.checks ? <span className="text-xs tabular-nums">{p.tests.checks.PASS} pass · {p.tests.checks.BLOCKED_AS_EXPECTED} blocked · {p.tests.checks.FAIL} fail</span> : <span className="text-xs italic text-slate-400">no tests</span>),
    sort: (p) => p.tests.checks?.PASS ?? null,
  },
];

export function ProgramList() {
  const m = useModel();
  const [q, set, reset] = useQuery({ q: '', cls: '', readiness: '', severity: '', sort: 'id', dir: 'asc', page: '1' });
  if (!m.programs) return <Unavailable what="program reconciliation" paths={[SRC[0]]} />;
  const rows = m.programs.filter(
    (p) =>
      (!q.cls || p.classification === q.cls) &&
      (!q.readiness || p.readiness.status === q.readiness) &&
      (!q.severity || (q.severity === 'none' ? p.maxSeverity === null : p.maxSeverity !== null && SEVERITY_RANK[p.maxSeverity] <= SEVERITY_RANK[q.severity as keyof typeof SEVERITY_RANK])) &&
      matchesText([p.id, p.javaClass, p.source, ...p.ruleIds], q.q),
  );
  const count = (f: (p: Program) => boolean) => m.programs!.filter(f).length;
  return (
    <div className="space-y-4">
      <PageHeader title="Program explorer" subtitle={`All ${m.programs.length} COBOL programs with their Java implementation, readiness, rules and gap records.`} />
      <FilterBar>
        <SearchInput label="Search programs" value={q.q} onChange={(v) => set({ q: v, page: '1' })} placeholder="Program, Java class or rule ID" />
        <SelectFilter label="Classification" value={q.cls} onChange={(v) => set({ cls: v, page: '1' })} options={['COMPLETE', 'PARTIAL', 'MISSING'].map((k) => ({ value: k, label: PROGRAM_STATUS[k].label, count: count((p) => p.classification === k) }))} />
        <SelectFilter label="Readiness" value={q.readiness} onChange={(v) => set({ readiness: v, page: '1' })} options={['PASS', 'FAIL'].map((k) => ({ value: k, label: READINESS[k].label, count: count((p) => p.readiness.status === k) }))} />
        <SelectFilter
          label="Gap severity (at least)"
          value={q.severity}
          onChange={(v) => set({ severity: v, page: '1' })}
          options={[...['critical', 'high', 'medium', 'low'].map((k) => ({ value: k, label: SEVERITY[k].label })), { value: 'none', label: 'No gap records' }]}
        />
        <ResetButton onClick={reset} />
      </FilterBar>
      <DataTable
        rows={rows}
        columns={COLUMNS}
        rowKey={(p) => p.id}
        sortKey={q.sort}
        sortDir={q.dir as SortDir}
        onSort={(sort, dir) => set({ sort, dir })}
        page={Number(q.page) || 1}
        onPage={(p) => set({ page: String(p) })}
        pageSize={50}
        noun="programs"
        caption="COBOL programs"
      />
      <Sources paths={SRC} />
    </div>
  );
}

export function ProgramDetail() {
  const { id = '' } = useParams();
  const m = useModel();
  const p = m.programs?.find((x) => x.id === id);
  if (!m.programs) return <Unavailable what="program reconciliation" paths={[SRC[0]]} />;
  if (!p)
    return (
      <Card>
        <p className="text-sm">
          No program <Code>{id}</Code> in the reconciliation. <Link className="text-blue-700 underline" to="/programs">Back to programs</Link>
        </p>
      </Card>
    );
  const note = programNote(p);
  const rules = (m.rules ?? []).filter((r) => r.program === p.id || p.ruleIds.includes(r.id));
  const st = p.statements;
  const stTotal = Object.values(st).reduce((t, v) => t + v, 0);
  return (
    <div className="space-y-4">
      <PageHeader title={p.id} subtitle={<span className="inline-flex flex-wrap items-center gap-2"><StatusBadge info={statusOf(PROGRAM_STATUS, p.classification)} /><StatusBadge info={statusOf(READINESS, p.readiness.status)} /><StatusBadge info={{ tone: 'unestablished', label: `COBOL equivalence ${humanize(p.cobolEquivalence)}` }} /></span>}>
        <Link to="/programs" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">← All programs</Link>
      </PageHeader>
      {note && <Notice tone={note.tone}>{note.text}</Notice>}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Identity and provenance">
          <KeyValue
            items={[
              ['COBOL program ID', <Code>{p.id}</Code>],
              ['Source file', <CobolRef path={p.source} />],
              ['File ID', <Code>{p.fileId}</Code>],
              ['Source SHA-256', <Code wrap>{p.sourceSha256}</Code>],
              ['Java class', p.javaClass ? <Code>{p.javaClass}</Code> : <span className="italic text-slate-500">none: no Java was generated</span>],
              ['Java files', p.javaFiles.length ? <div className="flex flex-col gap-1">{p.javaFiles.map((f) => <Code key={f} title="Generated Java under forward/generated/ (git-ignored, local only)">{f}</Code>)}</div> : null],
              ['Local authorization', p.localAuthorization ? <Code>{p.localAuthorization}</Code> : null],
              ['BMad governance', p.bmadGovernance ? <Badge tone="partial">{p.bmadGovernance}</Badge> : null],
            ]}
          />
        </Card>
        <Card title="Coverage">
          <div className="space-y-3">
            {p.paragraphs.reverse !== null && p.paragraphs.reverse > 0 ? (
              <>
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Paragraphs mapped to Java methods (structural)</div>
                  <RatioBar num={p.paragraphs.mapped ?? 0} den={p.paragraphs.reverse} tone="structural" label="paragraphs mapped" />
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Paragraphs executed by passing tests</div>
                  <RatioBar num={p.paragraphs.testExecuted ?? 0} den={p.paragraphs.reverse} tone="verified" label="paragraphs executed" />
                </div>
              </>
            ) : (
              <p className="text-sm italic text-slate-500">No paragraphs recorded for this program.</p>
            )}
            {stTotal > 0 && (
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Statements mapped to Java (structural)</div>
                <RatioBar num={st.MAPPED ?? 0} den={stTotal} tone="structural" label="statements mapped" />
                <p className="mt-1 text-xs text-slate-500">{int(st.GAP ?? 0)} at explicit gap sites</p>
              </div>
            )}
            {p.tests.statementCoverage && (
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Statements executed in passing scenarios</div>
                <RatioBar num={p.tests.statementCoverage.executed_in_passing_scenarios} den={p.tests.statementCoverage.statements} tone="verified" label="statements executed" />
                <p className="mt-1 text-xs text-slate-500">{int(p.tests.statementCoverage.executed_only_on_blocked_paths)} executed only on paths blocked at gaps</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Business rules (${rules.length})`}>
          {rules.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {rules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <IdLink to={`/rules/${r.id}`}>{r.id}</IdLink> <span className="text-sm text-slate-700 dark:text-slate-200">{r.name}</span>
                  </span>
                  <StatusBadge info={statusOf(RULE_STATUS, r.status)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-slate-500">No business rules are attributed to this program.</p>
          )}
        </Card>
        <Card title={`Gap records (${p.gapIds.length})`} right={p.gapIds.length ? <Link to={`/gaps?program=${p.id}`} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Open in register →</Link> : undefined}>
          <LinkList ids={p.gapIds} to={(g) => `/gaps/${g}`} />
          {p.impact && (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(p.impact.byCategory).map(([k, v]) => (
                  <Badge key={k}>{categoryLabel(k)}: {v}</Badge>
                ))}
              </div>
              <KeyValue
                items={[
                  ['Forward gaps (STEP-22)', int(p.forwardGapIds.length)],
                  ['Direct readiness blockers', <LinkList ids={p.impact.directReadinessBlockers} to={(g) => `/gaps/${g}`} />],
                  ['Root blockers', <LinkList ids={p.impact.rootBlockers} to={(g) => `/dependencies?focus=${g}`} />],
                  ['External / business / verification blockers', `${int(p.impact.externalBlockers)} / ${int(p.impact.businessDecisionBlockers)} / ${int(p.impact.verificationBlockers)}`],
                ]}
              />
              <p className="text-xs text-slate-500">{p.impact.note}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Tests and validation">
          <KeyValue
            items={[
              ['Program checks', p.tests.checks ? `${p.tests.checks.PASS} pass · ${p.tests.checks.BLOCKED_AS_EXPECTED} blocked as expected · ${p.tests.checks.FAIL} fail (of ${p.tests.checks.total})` : 'no tests recorded'],
              ['Scenarios', p.tests.scenarios ? `${p.tests.scenarios.passed} pass · ${p.tests.scenarios.blocked_as_expected} blocked as expected · ${p.tests.scenarios.failed} fail (of ${p.tests.scenarios.scenarios})` : 'no scenarios recorded'],
              ['Fixtures', p.tests.scenarios?.fixtures ? <Code>{p.tests.scenarios.fixtures}</Code> : null],
              ['Conversion validation', <span><StatusBadge info={p.validation.exitCode === 0 ? { tone: 'verified', label: 'pass' } : { tone: 'blocked', label: 'fail' }} /> <span className="text-xs text-slate-600 dark:text-slate-300">{p.validation.result}</span></span>],
              ['Unsupported statements', Object.keys(p.unsupported).length ? Object.entries(p.unsupported).map(([k, v]) => `${humanize(k)}: ${v}`).join(' · ') : 'none'],
            ]}
          />
          <p className="mt-2 text-xs text-slate-500">"Blocked as expected" means the check stopped at a recorded gap, as the source-derived expectation predicts. It is not a pass.</p>
        </Card>
        <Card title="Readiness">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge info={statusOf(READINESS, p.readiness.status)} />
            {p.readiness.failingChecks.map((c) => (
              <Badge key={c} tone="blocked">{c}</Badge>
            ))}
          </div>
          {p.readinessDetail ? (
            <>
              <ul className="space-y-1 text-sm">
                {p.readinessDetail.checks.map((c) => (
                  <li key={c.id} className="flex items-start gap-2">
                    <StatusBadge info={c.ok ? { tone: 'verified', label: 'ok' } : { tone: 'blocked', label: 'fails' }} />
                    <span className="min-w-0">
                      <span className="font-mono text-xs font-semibold">{c.id}</span>
                      <span className="block break-words text-xs text-slate-500 dark:text-slate-400">{c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {Object.entries(p.readinessDetail.gates).map(([g, v]) => (
                  <Badge key={g} tone={v === 'PASS' ? 'verified' : v === 'UNVERIFIED' ? 'partial' : 'blocked'}>{g} {v}</Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {int(p.readinessDetail.behaviours)} behaviours · {int(p.readinessDetail.blockingGaps)} blocking readiness gaps · {int(p.readinessDetail.openDecisions)} open decisions · generation authorized: {String(p.readinessDetail.generationAuthorized)}
              </p>
              <Sources paths={[p.readinessDetail.source]} />
            </>
          ) : (
            <p className="text-sm italic text-slate-500">No committed readiness result for this program.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Dependencies">
          {p.dependencies.length ? (
            <table className="w-full text-sm">
              <caption className="sr-only">Dependencies of {p.id}</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-1 font-semibold">Type</th>
                  <th scope="col" className="py-1 font-semibold">Target</th>
                  <th scope="col" className="py-1 font-semibold">Forward</th>
                </tr>
              </thead>
              <tbody>
                {p.dependencies.map((d, i) => (
                  <tr key={`${d.type}-${d.to}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 text-xs">{d.type}</td>
                    <td className="py-1">{m.programs!.some((x) => x.id === d.to) ? <IdLink to={`/programs/${d.to}`}>{d.to}</IdLink> : <Code>{d.to}</Code>}</td>
                    <td className="py-1 text-xs">
                      <StatusBadge info={/^(RESOLVED|IMPLEMENTED)/.test(d.forward) ? { tone: 'structural', label: humanize(d.forward) } : { tone: 'partial', label: humanize(d.forward) }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm italic text-slate-500">No dependencies recorded.</p>
          )}
        </Card>
        <Card title="Required next actions">
          {p.impact?.nextActions.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {p.impact.nextActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm italic text-slate-500">No next actions recorded in program-gap-impact.json.</p>
          )}
        </Card>
      </div>
      <Sources paths={SRC} />
    </div>
  );
}
