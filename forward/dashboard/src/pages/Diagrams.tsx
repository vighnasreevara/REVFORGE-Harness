import { Link, useParams } from 'react-router-dom';
import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, Code, IdLink, KeyValue, Kpi, LinkList, PageHeader, Source, Sources, StatusBadge, Unavailable } from '../components/ui';
import { DataTable, FilterBar, ResetButton, SearchInput, SelectFilter, type Column } from '../components/controls';
import { MermaidView } from '../components/MermaidView';
import { useQuery } from '../lib/hooks';
import { matchesText, uniqueSorted, type SortDir } from '../lib/table';
import { DIAGRAM_MAPPING, RULE_STATUS, statusOf } from '../lib/status';
import { humanize, int } from '../lib/format';
import type { Diagram } from '../evidence/types';
import { gapLimitedEdges } from '../evidence/model';

const SRC = ['forward/reports/step-22/diagram-reconciliation.json', 'forward/reports/step-23/diagram-gap-impact.json'];

const COLUMNS: Column<Diagram>[] = [
  { key: 'id', header: 'Diagram', render: (d) => <IdLink to={`/diagrams/${d.id}`}>{d.id}</IdLink>, sort: (d) => d.id },
  { key: 'title', header: 'Title', render: (d) => <span className="text-sm">{d.title}</span>, sort: (d) => d.title },
  { key: 'type', header: 'Type', render: (d) => <span className="text-xs">{humanize(d.type)}</span>, sort: (d) => d.type },
  { key: 'programs', header: 'Program', render: (d) => <span className="flex flex-wrap gap-1">{(d.program ? [d.program] : d.programs.slice(0, 3)).map((p) => <IdLink key={p} to={`/programs/${p}`}>{p}</IdLink>)}{!d.program && d.programs.length > 3 && <span className="text-xs text-slate-500">+{d.programs.length - 3}</span>}</span>, sort: (d) => d.program ?? d.programs[0] ?? null },
  { key: 'mapping', header: 'Java mapping', render: (d) => <StatusBadge info={statusOf(DIAGRAM_MAPPING, d.mapping)} />, sort: (d) => d.mapping },
  { key: 'edges', header: 'Edges', render: (d) => <span className="tabular-nums text-xs">{int(d.reverseEdges)}</span>, sort: (d) => d.reverseEdges },
  { key: 'gaplimited', header: 'Gap-limited edges', render: (d) => <span className="tabular-nums text-xs">{int(gapLimited(d))}</span>, sort: (d) => gapLimited(d) },
  { key: 'missing', header: 'Not found in Java', render: (d) => <span className="tabular-nums text-xs">{int(d.edgesNotFoundInJava)}</span>, sort: (d) => d.edgesNotFoundInJava },
  { key: 'gaps', header: 'Program gaps', render: (d) => <span className="tabular-nums text-xs">{d.gaps === null ? '—' : int(d.gaps)}</span>, sort: (d) => d.gaps },
];

const gapLimited = (d: Diagram) => gapLimitedEdges(d);

export function DiagramList() {
  const m = useModel();
  const [q, set, reset] = useQuery({ q: '', type: '', mapping: '', program: '', sort: 'id', dir: 'asc', page: '1' });
  if (!m.diagrams) return <Unavailable what="diagram reconciliation" paths={[SRC[0]]} />;
  const { list, summary } = m.diagrams;
  const rows = list.filter((d) => (!q.type || d.type === q.type) && (!q.mapping || d.mapping === q.mapping) && (!q.program || d.program === q.program || d.programs.includes(q.program)) && matchesText([d.id, d.title, d.program, d.file, ...d.programs], q.q));
  const pfe = summary.processFlowEdges;
  return (
    <div className="space-y-4">
      <PageHeader title="Diagram explorer" subtitle={`All ${list.length} reverse-engineering diagrams compared with the Java structure. Mermaid sources are rendered from the committed reverse artifacts; nothing is drawn that the evidence does not contain.`} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Diagrams" value={int(summary.total)} />
        <Kpi label="Comparable Java counterpart" value={int(list.filter((d) => d.mapping !== 'UNMAPPABLE').length)} hint={`${int(list.filter((d) => d.mapping === 'UNMAPPABLE').length)} without`} />
        <Kpi label="Process-flow edges" value={int(pfe.total)} />
        <Kpi label="Structurally represented" value={int(pfe.supported_by_java_structure)} />
        <Kpi label="Gap-limited / unassessable" value={`${int(pfe.gap_limited)} / ${int(pfe.unassessable)}`} />
        <Kpi label="Without Java counterpart" value={int(pfe.not_found_in_java)} hint="process-flow edges" />
      </div>
      <FilterBar>
        <SearchInput label="Search diagrams" value={q.q} onChange={(v) => set({ q: v, page: '1' })} placeholder="Diagram ID, title, program or file" />
        <SelectFilter label="Type" value={q.type} onChange={(v) => set({ type: v, page: '1' })} options={Object.entries(summary.byType).map(([k, v]) => ({ value: k, label: humanize(k), count: v }))} />
        <SelectFilter label="Java mapping" value={q.mapping} onChange={(v) => set({ mapping: v, page: '1' })} options={Object.entries(summary.mapping).map(([k, v]) => ({ value: k, label: statusOf(DIAGRAM_MAPPING, k).label, count: v }))} />
        <SelectFilter label="Program" value={q.program} onChange={(v) => set({ program: v, page: '1' })} options={uniqueSorted(list.flatMap((d) => [d.program, ...d.programs])).map((p) => ({ value: p, label: p }))} />
        <ResetButton onClick={reset} />
      </FilterBar>
      <DataTable rows={rows} columns={COLUMNS} rowKey={(d) => d.id} sortKey={q.sort} sortDir={q.dir as SortDir} onSort={(sort, dir) => set({ sort, dir })} page={Number(q.page) || 1} onPage={(p) => set({ page: String(p) })} pageSize={30} noun="diagrams" caption="Reverse-engineering diagrams" />
      <Sources paths={SRC} />
    </div>
  );
}

export function DiagramDetail() {
  const { id = '' } = useParams();
  const m = useModel();
  if (!m.diagrams) return <Unavailable what="diagram reconciliation" paths={[SRC[0]]} />;
  const d = m.diagrams.list.find((x) => x.id === id);
  if (!d)
    return (
      <Card>
        <p className="text-sm">
          No diagram <Code>{id}</Code>. <Link className="text-blue-700 underline" to="/diagrams">Back to diagrams</Link>
        </p>
      </Card>
    );
  const rules = m.rules ?? [];
  return (
    <div className="space-y-4">
      <PageHeader title={d.title} subtitle={<span className="inline-flex flex-wrap gap-2"><StatusBadge info={statusOf(DIAGRAM_MAPPING, d.mapping)} /><Badge>{humanize(d.type)}</Badge>{d.incomplete && <Badge tone="partial">reverse diagram incomplete</Badge>}{d.truncated && <Badge tone="partial">truncated</Badge>}</span>}>
        <Link to="/diagrams" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">← All diagrams</Link>
      </PageHeader>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Structural mapping">
          <KeyValue
            items={[
              ['Diagram ID', <Code>{d.id}</Code>],
              ['Source file', <Source path={d.file} />],
              ['Programs', <LinkList ids={d.program ? [d.program] : d.programs} to={(p) => `/programs/${p}`} />],
              ['Java class', d.javaClass ? <Code>{d.javaClass}</Code> : null],
              ['Reverse nodes / edges', `${int(d.reverseNodes)} / ${int(d.reverseEdges)}`],
              ['Nodes by forward mapping', Object.keys(d.nodesByForwardMapping).length ? Object.entries(d.nodesByForwardMapping).map(([k, v]) => `${humanize(k)} ${v}`).join(' · ') : null],
              ['Unresolved nodes', d.unresolvedNodes.length ? <span className="font-mono text-xs">{d.unresolvedNodes.join(', ')}</span> : 'none'],
              ['Edges not found in Java', int(d.edgesNotFoundInJava)],
              ['Note', d.note],
            ]}
          />
        </Card>
        <Card title="Edge classification">
          {Object.keys(d.edgesClassified).length ? (
            <ul className="space-y-1 text-sm">
              {Object.entries(d.edgesClassified)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="flex items-start justify-between gap-3 border-b border-slate-100 py-1 dark:border-slate-800">
                    <span className="text-xs text-slate-700 dark:text-slate-200">{k}</span>
                    <span className="font-semibold tabular-nums">{int(v)}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="text-sm italic text-slate-500">Edge classification applies to process-flow diagrams only.</p>
          )}
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Rules annotated</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {d.rulesAnnotated.length
              ? d.rulesAnnotated.map((r) => {
                  const rule = rules.find((x) => x.id === r);
                  return (
                    <span key={r} className="inline-flex items-center gap-1">
                      <IdLink to={`/rules/${r}`}>{r}</IdLink>
                      {rule && <StatusBadge info={statusOf(RULE_STATUS, rule.status)} />}
                    </span>
                  );
                })
              : <span className="text-xs italic text-slate-400">none</span>}
          </div>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Gap-limited relationships</h3>
          <p className="text-sm">
            {int(gapLimited(d))} edge(s) end at a forward gap.{' '}
            {d.gaps !== null && (
              <>
                The programs it references have {int(d.gaps)} gap record(s): {Object.entries(d.gapGroups).map(([g, v]) => `${g} ${v}`).join(', ')}.
              </>
            )}
          </p>
        </Card>
      </div>
      <Card title="Diagram (reverse-engineering source)">
        {d.mermaidPath ? <MermaidView path={d.mermaidPath} /> : <p className="text-sm italic text-slate-500">No committed Mermaid source for this diagram; only the structural mapping above is shown.</p>}
      </Card>
      <Sources paths={SRC} />
    </div>
  );
}
