import { useMemo } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Download, Lock } from 'lucide-react';
import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, CobolRef, Code, IdLink, KeyValue, LinkList, Notice, PageHeader, Source, Sources, StatusBadge, Unavailable } from '../components/ui';
import { DataTable, Drawer, FilterBar, ResetButton, SearchInput, SelectFilter, type Column } from '../components/controls';
import { BarList } from '../components/charts';
import { useQuery } from '../lib/hooks';
import { download, EMPTY_GAP_FILTERS, filterGaps, gapsToCsv, PRIORITY_RANK, SEVERITY_RANK, sortGaps, uniqueSorted, type GapSortKey, type SortDir } from '../lib/table';
import { categoryLabel, CATEGORY_LABEL, SEVERITY, statusOf } from '../lib/status';
import { humanize, int } from '../lib/format';
import { countBy } from '../evidence/check';
import type { Gap } from '../evidence/types';

const SRC = 'forward/reports/step-23/master-gap-register.json';
const PRIORITY_TONE = { P0: 'blocked', P1: 'serious', P2: 'partial', P3: 'neutral' } as const;

const DEFAULTS = { ...EMPTY_GAP_FILTERS, sort: 'id', dir: 'asc', page: '1', size: '25' };

export function GapRegister() {
  const m = useModel();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [q, set, reset] = useQuery(DEFAULTS);
  const gaps = m.gaps;
  const filtered = useMemo(() => (gaps ? filterGaps(gaps, q) : []), [gaps, q]);
  if (!gaps) return <Unavailable what="master gap register" paths={[SRC]} />;

  const selected = id ? gaps.find((g) => g.id === id) : undefined;
  const sorted = sortGaps(filtered, q.sort as GapSortKey, q.dir as SortDir);
  const open = (g: string) => navigate({ pathname: `/gaps/${g}`, search: location.search });
  const close = () => navigate({ pathname: '/gaps', search: location.search });
  const opts = (key: (g: Gap) => string, label: (v: string) => string = (v) => v) => {
    const c = countBy(gaps, key);
    return uniqueSorted(Object.keys(c)).map((v) => ({ value: v, label: label(v), count: c[v] }));
  };
  const active = Object.keys(EMPTY_GAP_FILTERS).some((k) => q[k as keyof typeof EMPTY_GAP_FILTERS]);

  const columns: Column<Gap>[] = [
    {
      key: 'id',
      header: 'Master ID',
      render: (g) => (
        <button type="button" onClick={() => open(g.id)} className="font-mono text-xs font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-blue-300">
          {g.id}
        </button>
      ),
      sort: (g) => g.id,
      className: 'whitespace-nowrap',
    },
    { key: 'original', header: 'Original ID', render: (g) => (g.originalId ? <Code title={g.originalId}>{g.originalId}</Code> : <span className="text-xs italic text-slate-400">consolidated record</span>), className: 'max-w-[11rem]' },
    { key: 'category', header: 'Category', render: (g) => <span className="text-xs">{categoryLabel(g.category)}</span>, sort: (g) => g.category, className: 'min-w-[7rem]' },
    { key: 'group', header: 'Root cause', render: (g) => <div className="w-48 text-xs" title={g.rootCause}><span className="font-mono font-semibold">{g.rootCauseGroup}</span><div className="truncate text-slate-500 dark:text-slate-400">{g.rootCause}</div></div>, sort: (g) => g.rootCauseGroup },
    { key: 'severity', header: 'Severity', render: (g) => <StatusBadge info={statusOf(SEVERITY, g.severity)} />, sort: (g) => SEVERITY_RANK[g.severity] },
    { key: 'priority', header: 'Priority', render: (g) => <Badge tone={PRIORITY_TONE[g.priority]}>{g.priority}</Badge>, sort: (g) => PRIORITY_RANK[g.priority] },
    { key: 'owner', header: 'Owner role', render: (g) => <span className="text-xs">{g.owner}</span>, sort: (g) => g.owner, className: 'min-w-[7rem]' },
    { key: 'program', header: 'Program', render: (g) => (g.programs.length ? <span className="flex flex-wrap gap-1">{g.programs.map((p) => <IdLink key={p} to={`/programs/${p}`}>{p}</IdLink>)}</span> : <span className="text-xs italic text-slate-400">—</span>), sort: (g) => g.programs[0] ?? null },
    { key: 'rule', header: 'Rules', render: (g) => { const r = [...new Set([...g.rules, ...g.ruleLinks.map((l) => l.rule)])]; return r.length ? <span className="flex flex-wrap gap-1">{r.slice(0, 3).map((x) => <IdLink key={x} to={`/rules/${x}`}>{x}</IdLink>)}{r.length > 3 && <span className="text-xs text-slate-500">+{r.length - 3}</span>}</span> : <span className="text-xs italic text-slate-400">—</span>; } },
    { key: 'dependency', header: 'Dependency', render: (g) => <span className="text-xs">{g.blockedBy.length ? `blocked by ${g.blockedBy.length}` : ''}{g.blockedBy.length && g.blocks.length ? ' · ' : ''}{g.blocks.length ? `blocks ${g.blocks.length}` : ''}{!g.blockedBy.length && !g.blocks.length ? (g.dependencyGroup ?? '—') : ''}</span> },
    { key: 'status', header: 'Status', render: (g) => <Badge tone="partial">{g.status}</Badge> },
    { key: 'action', header: 'Required next action', render: (g) => <span className="line-clamp-2 text-xs text-slate-600 dark:text-slate-300" title={g.nextAction ?? undefined}>{g.nextAction ?? 'not recorded'}</span>, className: 'min-w-[16rem] max-w-[22rem]' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Master gap register" subtitle={`The STEP-23 canonical register: ${int(gaps.length)} records, every one OPEN. Stable MGR identities, original IDs and source provenance are preserved.`}>
        <button
          type="button"
          onClick={() => download(`revforge-gaps-${filtered.length}-of-${gaps.length}.csv`, gapsToCsv(sorted))}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        >
          <Download aria-hidden className="h-4 w-4" /> Export CSV ({int(filtered.length)})
        </button>
      </PageHeader>
      <Notice tone="neutral">
        <span className="inline-flex items-center gap-1.5">
          <Lock aria-hidden className="h-3.5 w-3.5" /> Read-only. The dashboard cannot modify, close or delete gap records; closure requires the evidence named in each record.
        </span>
      </Notice>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Category totals">
          <BarList
            label="Gap records by category"
            labelWidth={190}
            data={Object.keys(CATEGORY_LABEL)
              .map((k) => ({ key: k, label: CATEGORY_LABEL[k], value: gaps.filter((g) => g.category === k).length, to: `/gaps?category=${k}` }))
              .sort((a, b) => b.value - a.value)}
          />
        </Card>
        <Card title="Owner roles">
          <BarList label="Gap records by owner role" labelWidth={190} data={Object.entries(countBy(gaps, (g) => g.owner)).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, label: k, value: v, tone: k === 'OWNER_REVIEW_REQUIRED' ? 'partial' : 'structural', to: `/gaps?owner=${encodeURIComponent(k)}` }))} />
        </Card>
      </div>
      <FilterBar>
        <SearchInput label="Search gap records" value={q.q} onChange={(v) => set({ q: v, page: '1' })} placeholder="ID, subject, description, path, program, rule" />
        <SelectFilter label="Category" value={q.category} onChange={(v) => set({ category: v, page: '1' })} options={opts((g) => g.category, categoryLabel)} />
        <SelectFilter label="Severity" value={q.severity} onChange={(v) => set({ severity: v, page: '1' })} options={opts((g) => g.severity, (v) => SEVERITY[v]?.label ?? v)} />
        <SelectFilter label="Priority" value={q.priority} onChange={(v) => set({ priority: v, page: '1' })} options={opts((g) => g.priority)} />
        <SelectFilter label="Owner" value={q.owner} onChange={(v) => set({ owner: v, page: '1' })} options={opts((g) => g.owner)} />
        <SelectFilter label="Program" value={q.program} onChange={(v) => set({ program: v, page: '1' })} options={uniqueSorted(gaps.flatMap((g) => g.programs)).map((p) => ({ value: p, label: p, count: gaps.filter((g) => g.programs.includes(p)).length }))} />
        <SelectFilter label="Root cause" value={q.group} onChange={(v) => set({ group: v, page: '1' })} options={opts((g) => g.rootCauseGroup)} />
        <SelectFilter label="Inventory" value={q.inventory} onChange={(v) => set({ inventory: v, page: '1' })} options={opts((g) => g.inventoryCategory, humanize)} />
        <SelectFilter label="Page size" allLabel="25" value={q.size === '25' ? '' : q.size} onChange={(v) => set({ size: v || '25', page: '1' })} options={[{ value: '50', label: '50' }, { value: '100', label: '100' }, { value: '600', label: 'All' }]} />
        <ResetButton onClick={reset} disabled={!active} />
      </FilterBar>
      {q.rule && (
        <p className="text-sm">
          Showing records linked to rule <IdLink to={`/rules/${q.rule}`}>{q.rule}</IdLink>. <button type="button" className="text-blue-700 underline dark:text-blue-300" onClick={() => set({ rule: '' })}>Clear</button>
        </p>
      )}
      <DataTable rows={sorted} columns={columns} rowKey={(g) => g.id} sortKey={q.sort} sortDir={q.dir as SortDir} onSort={(sort, dir) => set({ sort, dir })} page={Number(q.page) || 1} onPage={(p) => set({ page: String(p) })} pageSize={Number(q.size) || 25} noun="gap records" caption="Master gap register records" />
      <Sources paths={[SRC, 'forward/reports/step-23/master-gap-register.csv']} />
      <Drawer open={!!id} title={selected ? `${selected.id} · ${selected.subject}` : `Gap ${id}`} onClose={close}>
        {selected ? <GapDetail g={selected} /> : <p className="text-sm">No register record <Code>{id}</Code>.</p>}
      </Drawer>
    </div>
  );
}

export function GapDetail({ g }: { g: Gap }) {
  const ruleIds = [...new Set([...g.rules, ...g.ruleLinks.map((l) => l.rule)])];
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge info={statusOf(SEVERITY, g.severity)} />
        <Badge tone={PRIORITY_TONE[g.priority]}>{g.priority}</Badge>
        <Badge tone="partial">{g.status}</Badge>
        <Badge>{categoryLabel(g.category)}</Badge>
        <Badge>{humanize(g.inventoryCategory)}</Badge>
      </div>
      <p className="text-slate-700 dark:text-slate-200">{g.description}</p>
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Provenance</h3>
        <KeyValue
          items={[
            ['Master ID', <Code>{g.id}</Code>],
            ['Original ID', g.originalId ? <Code wrap>{g.originalId}</Code> : 'none (consolidated verification record)'],
            ['Source run', g.sourceRun],
            ['Source reference', /^(forward|output)\//.test(g.sourceReference) && !g.sourceReference.startsWith('forward/generated/') ? <Source path={g.sourceReference.split('#')[0]} label={g.sourceReference} /> : <Code wrap title="Generated output (git-ignored); the committed register holds the record">{g.sourceReference}</Code>],
            ['Stable reference', g.stableRef ? <Code wrap>{g.stableRef}</Code> : null],
            ['COBOL location', g.sourcePath ? <span><CobolRef path={g.sourcePath} /> {g.sourceLine && <span className="text-xs text-slate-500">line {g.sourceLine}</span>}</span> : g.originalScope ? `scope ${g.originalScope}` : null],
            ['Source identity', g.sourceIdentity ? <Code wrap>{Array.isArray(g.sourceIdentity) ? g.sourceIdentity.join(', ') : g.sourceIdentity}</Code> : null],
            ['Source SHA-256', g.sourceSha256 ? <Code wrap>{g.sourceSha256}</Code> : null],
            ['Evidence SHA-256', g.evidenceSha256 ? <Code wrap>{g.evidenceSha256}</Code> : null],
            ['Forward reference', g.forwardReference ? <Code>{g.forwardReference}</Code> : null],
            ['Kind', <Code>{g.kind}</Code>],
            ['Reverse classification', g.reverseClassification],
          ]}
        />
      </section>
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Scope</h3>
        <KeyValue
          items={[
            ['Programs', <LinkList ids={g.programs} to={(p) => `/programs/${p}`} />],
            ['Paragraphs', g.paragraphs.length ? <div className="flex flex-col gap-0.5">{g.paragraphs.map((p) => <span key={p.paragraph_id} className="text-xs"><Code>{p.name}</Code> <span className="font-mono text-slate-500">{p.paragraph_id}</span></span>)}</div> : null],
            ['Statements', g.statements.length ? <div className="flex flex-col gap-0.5">{g.statements.map((s) => <span key={s.statement_id} className="font-mono text-xs">line {s.line} · {s.statement_id}</span>)}</div> : null],
            ['Data items', g.dataItems.length ? g.dataItems.join(', ') : null],
            ['Copybooks', g.copybooks.length ? g.copybooks.join(', ') : null],
            ['Business rules', <LinkList ids={ruleIds} to={(r) => `/rules/${r}`} />],
            ['Diagrams', <LinkList ids={g.diagrams} to={(d) => `/diagrams/${d}`} />],
            ['JCL jobs', g.jclJobs.length ? g.jclJobs.join(', ') : null],
          ]}
        />
        {g.ruleLinks.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {g.ruleLinks.map((l, i) => (
              <li key={i}>
                <IdLink to={`/rules/${l.rule}`}>{l.rule}</IdLink> <Badge>{l.relation}</Badge> {l.evidence}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Root cause and dependencies</h3>
        <KeyValue
          items={[
            ['Root cause', <span><Link to={`/roadmap#${g.rootCauseGroup}`} className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">{g.rootCauseGroup}</Link> {g.rootCause}</span>],
            ['Dependency group', g.dependencyGroup],
            ['External dependencies', g.externalDependencies.length ? g.externalDependencies.join('; ') : null],
            ['Blocked by', <LinkList ids={g.blockedBy} to={(x) => `/gaps/${x}`} />],
            ['Blocks', <LinkList ids={g.blocks} to={(x) => `/gaps/${x}`} />],
            ['Graph', <Link to={`/dependencies?focus=${g.id}`} className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">Explore neighbourhood →</Link>],
            ['Priority rationale', g.priorityRationale],
          ]}
        />
      </section>
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Resolution</h3>
        <KeyValue
          items={[
            ['Owner role', g.owner],
            ['Approver', g.approver],
            ['External owner', g.externalOwner],
            ['Technical action', g.requiredTechnicalAction],
            ['Business decision', g.requiredBusinessDecision],
            ['Source correction', g.requiredSourceCorrection],
            ['External system', g.requiredExternalSystem],
            ['Approval requirements', g.approvalRequirements],
            ['Verification method', g.verificationMethod],
            ['Closure criteria', g.closureCriteria],
            ['Verification state', g.verificationState],
            ['Resolution evidence', g.resolutionEvidence === null ? <span className="italic text-slate-500">none: the record stays OPEN until closure is evidenced</span> : <Code wrap>{JSON.stringify(g.resolutionEvidence)}</Code>],
          ]}
        />
      </section>
      <Sources paths={[SRC]} />
    </div>
  );
}
