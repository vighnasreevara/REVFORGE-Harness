import { Link, useParams } from 'react-router-dom';
import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, CobolRef, Code, IdLink, KeyValue, LinkList, Notice, PageHeader, Sources, StatusBadge, Unavailable } from '../components/ui';
import { DataTable, FilterBar, ResetButton, SearchInput, SelectFilter, type Column } from '../components/controls';
import { useQuery } from '../lib/hooks';
import { matchesText, uniqueSorted, type SortDir } from '../lib/table';
import { RULE_STATUS, statusOf } from '../lib/status';
import { humanize, int } from '../lib/format';
import type { Rule } from '../evidence/types';

const SRC = ['forward/reports/step-22/business-rule-reconciliation.json', 'forward/reports/step-23/business-rule-gap-impact.json', 'output/rules/rules_artifact.json'];
const STATUS_ORDER = ['IMPLEMENTED_VERIFIED', 'IMPLEMENTED_VERIFIED_TO_GAP', 'IMPLEMENTED_NOT_EXERCISED', 'BLOCKED'];

export function EquivalenceExplainer() {
  return (
    <Notice tone="unestablished">
      <strong>Java-verified is not COBOL-equivalent.</strong> A Java-verified rule is exercised by passing scenarios whose expected results were derived from the COBOL source. An
      independently COBOL-equivalent rule would also need the same inputs run through the legacy COBOL program with matching outputs. No legacy execution evidence exists, so 0 rules are
      COBOL-equivalent.
    </Notice>
  );
}

const COLUMNS: Column<Rule>[] = [
  { key: 'id', header: 'Rule', render: (r) => <IdLink to={`/rules/${r.id}`}>{r.id}</IdLink>, sort: (r) => r.id },
  { key: 'name', header: 'Name', render: (r) => <span className="text-sm">{r.name}</span>, sort: (r) => r.name },
  { key: 'program', header: 'Program', render: (r) => <IdLink to={`/programs/${r.program}`}>{r.program}</IdLink>, sort: (r) => r.program },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge info={statusOf(RULE_STATUS, r.status)} />, sort: (r) => STATUS_ORDER.indexOf(r.status) },
  { key: 'category', header: 'Category', render: (r) => <span className="text-xs">{humanize(r.category)}</span>, sort: (r) => r.category },
  { key: 'gaps', header: 'Linked gaps', render: (r) => <span className="tabular-nums">{int(r.gapIds.length)}</span>, sort: (r) => r.gapIds.length },
  { key: 'tests', header: 'Scenarios', render: (r) => <span className="text-xs tabular-nums">{r.tests.filter((t) => t.result === 'PASS').length} pass / {r.tests.length}</span>, sort: (r) => r.tests.length },
];

export function RuleList() {
  const m = useModel();
  const [q, set, reset] = useQuery({ q: '', status: '', program: '', category: '', linked: '', gap: '', sort: 'id', dir: 'asc', page: '1' });
  if (!m.rules) return <Unavailable what="business-rule reconciliation" paths={[SRC[0]]} />;
  const rows = m.rules.filter(
    (r) =>
      (!q.status || r.status === q.status) &&
      (!q.program || r.program === q.program) &&
      (!q.category || r.category === q.category) &&
      (!q.linked || (q.linked === 'yes' ? r.gapIds.length > 0 : r.gapIds.length === 0)) &&
      (!q.gap || r.gapIds.some((g) => g.toLowerCase() === q.gap.trim().toLowerCase())) &&
      matchesText([r.id, r.name, r.program, r.description, r.cobol, r.java], q.q),
  );
  const count = (f: (r: Rule) => boolean) => m.rules!.filter(f).length;
  return (
    <div className="space-y-4">
      <PageHeader title="Business rules explorer" subtitle={`All ${m.rules.length} business rules mined by the reverse pipeline, with their forward verification status and linked gap records.`} />
      <EquivalenceExplainer />
      <FilterBar>
        <SearchInput label="Search rules" value={q.q} onChange={(v) => set({ q: v, page: '1' })} placeholder="Rule ID, name, description or program" />
        <SelectFilter label="Status" value={q.status} onChange={(v) => set({ status: v, page: '1' })} options={STATUS_ORDER.map((k) => ({ value: k, label: RULE_STATUS[k].label, count: count((r) => r.status === k) }))} />
        <SelectFilter label="COBOL program" value={q.program} onChange={(v) => set({ program: v, page: '1' })} options={uniqueSorted(m.rules.map((r) => r.program)).map((p) => ({ value: p, label: p, count: count((r) => r.program === p) }))} />
        <SelectFilter label="Category" value={q.category} onChange={(v) => set({ category: v, page: '1' })} options={uniqueSorted(m.rules.map((r) => r.category)).map((c) => ({ value: c, label: humanize(c) }))} />
        <SelectFilter label="Linked gap" value={q.linked} onChange={(v) => set({ linked: v, page: '1' })} options={[{ value: 'yes', label: 'Has linked gaps', count: count((r) => r.gapIds.length > 0) }, { value: 'no', label: 'No linked gaps', count: count((r) => !r.gapIds.length) }]} />
        <div className="flex flex-col">
          <label htmlFor="gap-id" className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Linked to gap ID
          </label>
          <input id="gap-id" value={q.gap} onChange={(e) => set({ gap: e.target.value, page: '1' })} placeholder="MGR-0002" className="h-9 w-32 rounded-lg border border-slate-300 bg-white px-2.5 text-sm dark:border-slate-700 dark:bg-slate-900" />
        </div>
        <ResetButton onClick={reset} />
      </FilterBar>
      <DataTable rows={rows} columns={COLUMNS} rowKey={(r) => r.id} sortKey={q.sort} sortDir={q.dir as SortDir} onSort={(sort, dir) => set({ sort, dir })} page={Number(q.page) || 1} onPage={(p) => set({ page: String(p) })} pageSize={40} noun="rules" caption="Business rules" />
      <Sources paths={SRC} />
    </div>
  );
}

export function RuleDetail() {
  const { id = '' } = useParams();
  const m = useModel();
  if (!m.rules) return <Unavailable what="business-rule reconciliation" paths={[SRC[0]]} />;
  const r = m.rules.find((x) => x.id === id);
  if (!r)
    return (
      <Card>
        <p className="text-sm">
          No rule <Code>{id}</Code>. <Link className="text-blue-700 underline" to="/rules">Back to rules</Link>
        </p>
      </Card>
    );
  const [cobolPath, cobolLine] = r.cobol.split(':');
  const remaining = [
    r.unverifiedBehaviour,
    r.flags?.requiresBusinessDecision && 'a signed business SME decision on the linked decision gaps',
    r.flags?.affectedByMissingSource && 'the missing source members linked to this rule',
    r.flags?.needsExternalEnvironment && 'the external environment (DB2, CICS or platform service) the rule depends on',
    r.flags?.awaitingLegacyEquivalence && 'legacy COBOL execution evidence for an equivalence comparison',
  ].filter((x): x is string => !!x);
  return (
    <div className="space-y-4">
      <PageHeader title={`${r.id} · ${r.name}`} subtitle={<span className="inline-flex flex-wrap gap-2"><StatusBadge info={statusOf(RULE_STATUS, r.status)} /><StatusBadge info={{ tone: 'unestablished', label: r.cobolEquivalent ? 'COBOL-equivalent' : 'Not COBOL-equivalent' }} /></span>}>
        <Link to="/rules" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">← All rules</Link>
      </PageHeader>
      <EquivalenceExplainer />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Rule">
          <KeyValue
            items={[
              ['Rule ID', <Code>{r.id}</Code>],
              ['Program', <IdLink to={`/programs/${r.program}`}>{r.program}</IdLink>],
              ['Category', humanize(r.category)],
              ['Rule set', r.ruleSet],
              ['Business description', r.description],
              ['Classification', r.classification],
            ]}
          />
        </Card>
        <Card title="Traceability">
          <KeyValue
            items={[
              ['COBOL reference', <span><CobolRef path={cobolPath} /> {cobolLine && <span className="text-xs text-slate-500">line {cobolLine}</span>}</span>],
              ['Paragraph', r.reverse.paragraph ? <Code>{r.reverse.paragraph}</Code> : null],
              ['Statement ID', r.reverse.statementId ? <Code>{r.reverse.statementId}</Code> : null],
              ['Condition', r.reverse.condition ? <Code wrap>{r.reverse.condition}</Code> : null],
              ['Reverse confidence', r.reverse.confidence],
              ['SME review requested', r.reverse.requiresSmeReview === null ? null : r.reverse.requiresSmeReview ? 'yes' : 'no'],
              ['Java reference', r.java ? <Code title="Generated Java under forward/generated/ (git-ignored, local only)">{r.java}</Code> : <span className="italic text-slate-500">no Java site (blocked)</span>],
            ]}
          />
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={`Verification evidence (${r.tests.length} scenarios)`}>
          <p className="mb-2 text-sm">{r.verifiedBehaviour || <span className="italic text-slate-500">no verified behaviour recorded</span>}</p>
          {r.tests.length ? (
            <table className="w-full text-sm">
              <caption className="sr-only">Scenarios asserting {r.id}</caption>
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-1 font-semibold">Scenario</th>
                  <th scope="col" className="py-1 font-semibold">Outcome</th>
                  <th scope="col" className="py-1 font-semibold">Asserted state</th>
                </tr>
              </thead>
              <tbody>
                {r.tests.map((t, i) => (
                  <tr key={`${t.scenario}-${i}`} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="py-1 font-mono text-xs">{t.scenario}</td>
                    <td className="py-1">
                      <StatusBadge info={t.result === 'PASS' ? { tone: 'verified', label: 'pass' } : t.result === 'BLOCKED_AS_EXPECTED' ? { tone: 'partial', label: 'blocked as expected' } : { tone: 'blocked', label: humanize(t.result) }} />
                    </td>
                    <td className="py-1 text-xs text-slate-600 dark:text-slate-300">{t.asserted.length ? t.asserted.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm italic text-slate-500">No scenario exercises this rule.</p>
          )}
        </Card>
        <Card title={`Related gaps (${r.gapIds.length})`} right={r.gapIds.length ? <Link to={`/gaps?rule=${r.id}`} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Open in register →</Link> : undefined}>
          <LinkList ids={r.gapIds} to={(g) => `/gaps/${g}`} />
          {r.flags && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.flags.blockedByMissingImplementation && <Badge tone="blocked">blocked by missing implementation</Badge>}
              {r.flags.affectedByMissingSource && <Badge tone="partial">affected by missing source</Badge>}
              {r.flags.requiresBusinessDecision && <Badge tone="partial">requires business decision</Badge>}
              {r.flags.needsExternalEnvironment && <Badge tone="partial">needs external environment</Badge>}
              {r.flags.implementedNotIndependentlyVerified && <Badge tone="neutral">not independently verified</Badge>}
              {r.flags.awaitingLegacyEquivalence && <Badge tone="unestablished">awaiting legacy equivalence</Badge>}
            </div>
          )}
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Remaining verification requirements</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {remaining.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Card>
      </div>
      <Sources paths={SRC} />
    </div>
  );
}
