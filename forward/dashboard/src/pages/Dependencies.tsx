import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useModel } from '../evidence/EvidenceContext';
import { Badge, Card, IdLink, Kpi, Notice, PageHeader, Sources, StatusBadge, Unavailable } from '../components/ui';
import { SelectFilter } from '../components/controls';
import { GraphCanvas } from '../components/GraphCanvas';
import { useDark } from '../components/charts';
import { useQuery } from '../lib/hooks';
import { downstreamCount, index, neighbourhood, NODE_TYPE_LABEL, readinessProgram, type Direction } from '../lib/graph';
import { CONFIDENCE, statusOf } from '../lib/status';
import { humanize, int } from '../lib/format';

const SRC = 'forward/reports/step-23/dependency-graph.json';

/** Where a graph node leads in the rest of the dashboard. */
export function nodeHref(id: string): string | null {
  if (id.startsWith('MGR-')) return `/gaps/${id}`;
  if (id.startsWith('BR-')) return `/rules/${id}`;
  const p = readinessProgram(id);
  return p ? `/programs/${p}` : null;
}

export default function Dependencies() {
  const m = useModel();
  const graph = m.graph;
  const ix = useMemo(() => (graph ? index(graph) : null), [graph]);
  const ranked = useMemo(
    () => (graph && ix ? graph.rootBlockers.map((id) => ({ id, down: downstreamCount(ix, id) })).sort((a, b) => b.down - a.down || a.id.localeCompare(b.id)) : []),
    [graph, ix],
  );
  const [q, set] = useQuery({ focus: '', select: '', depth: '2', dir: 'both', hyp: 'show', rel: '', max: '120', hubs: '' });
  const dark = useDark();
  const focus = q.focus || ranked[0]?.id || '';
  const view = useMemo(() => {
    if (!graph || !ix || !ix.nodes.has(focus)) return null;
    const v = neighbourhood(ix, focus, { depth: Number(q.depth) || 2, direction: q.dir as Direction, includeHypotheses: q.hyp !== 'hide', maxNodes: Number(q.max) || 120, expandHubs: q.hubs === 'expand' });
    if (!q.rel) return v;
    const edges = v.edges.filter((e) => e.relation === q.rel);
    const keep = new Set([focus, ...edges.flatMap((e) => [e.from, e.to])]);
    return { ...v, edges, nodes: v.nodes.filter((n) => keep.has(n.id)) };
  }, [graph, ix, focus, q.depth, q.dir, q.hyp, q.rel, q.max, q.hubs]);

  if (!graph || !ix) return <Unavailable what="dependency graph" paths={[SRC]} />;
  const selected = q.select && ix.nodes.has(q.select) ? q.select : focus;
  const node = ix.nodes.get(selected);
  const conf = graph.summary.byConfidence;
  const nodeOptions = graph.nodes.map((n) => n.id).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  return (
    <div className="space-y-4">
      <PageHeader title="Dependency analysis" subtitle="How gaps block one another, business rules and readiness results. Explored one focused neighbourhood at a time so the 705-node graph stays readable." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Nodes" value={int(graph.nodes.length)} source={SRC} />
        <Kpi label="Edges" value={int(graph.edges.length)} />
        <Kpi label="Directly evidenced" value={int(conf.EVIDENCED)} />
        <Kpi label="Evidenced by text" value={int(conf.EVIDENCED_BY_TEXT)} />
        <Kpi label="Hypotheses" value={int(conf.HYPOTHESIS)} hint="Likely, unproven relations" />
        <Kpi label="Cycles" value={graph.cycles.length ? int(graph.cycles.length) : 'none'} hint={`${int(graph.rootBlockers.length)} root blockers · ${int(graph.independentGaps.length)} independent gaps`} />
      </div>

      <Card title="Explore">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col">
            <label htmlFor="focus-node" className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Focus node
            </label>
            <input
              id="focus-node"
              list="graph-nodes"
              defaultValue={focus}
              key={focus}
              onChange={(e) => ix.nodes.has(e.target.value) && set({ focus: e.target.value, select: '' })}
              placeholder="MGR-0001, BR-035, EXT-DB2…"
              className="h-9 w-64 rounded-lg border border-slate-300 bg-white px-2.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
            />
            <datalist id="graph-nodes">
              {nodeOptions.map((id) => (
                <option key={id} value={id} />
              ))}
            </datalist>
          </div>
          <SelectFilter label="Depth" allLabel="2 hops" value={q.depth === '2' ? '' : q.depth} onChange={(v) => set({ depth: v || '2' })} options={[{ value: '1', label: '1 hop' }, { value: '3', label: '3 hops' }, { value: '4', label: '4 hops' }]} />
          <SelectFilter label="Direction" allLabel="Both directions" value={q.dir === 'both' ? '' : q.dir} onChange={(v) => set({ dir: v || 'both' })} options={[{ value: 'upstream', label: 'Upstream (what blocks it)' }, { value: 'downstream', label: 'Downstream (what it blocks)' }]} />
          <SelectFilter label="Relation" allLabel="All relations" value={q.rel} onChange={(v) => set({ rel: v })} options={Object.entries(graph.summary.byRelation).map(([k, v]) => ({ value: k, label: humanize(k), count: v }))} />
          <SelectFilter label="Max nodes" allLabel="120" value={q.max === '120' ? '' : q.max} onChange={(v) => set({ max: v || '120' })} options={[{ value: '60', label: '60' }, { value: '250', label: '250' }]} />
          <label className="inline-flex h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={q.hyp !== 'hide'} onChange={(e) => set({ hyp: e.target.checked ? 'show' : 'hide' })} className="h-4 w-4" />
            Show hypothetical relationships
          </label>
          <label className="inline-flex h-9 items-center gap-2 text-sm" title="Shared prerequisites such as EXT-DB2 connect to dozens of gaps. Focus one directly to see all of them.">
            <input type="checkbox" checked={q.hubs === 'expand'} onChange={(e) => set({ hubs: e.target.checked ? 'expand' : '' })} className="h-4 w-4" />
            Expand through shared prerequisites
          </label>
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300" aria-label="Legend">
          <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block w-6 border-t-2 border-blue-600" /> evidenced</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block w-6 border-t-2 border-dotted border-blue-600" /> evidenced by text</li>
          <li className="inline-flex items-center gap-1.5"><span aria-hidden className="inline-block w-6 border-t-2 border-dashed border-violet-600" /> hypothesis</li>
          <li>■ gap · ● rule · ◆ failing readiness · ⬢ prerequisite / missing member</li>
        </ul>
      </Card>

      {view ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Card title={`Neighbourhood of ${focus}: ${view.nodes.length} nodes, ${view.edges.length} edges`}>
            {view.truncated && <Notice tone="partial">The neighbourhood was capped at {q.max} nodes. Narrow the depth, direction or relation to see the rest.</Notice>}
            {view.hiddenHypotheses > 0 && <p className="mb-2 text-xs text-slate-500">{view.hiddenHypotheses} hypothetical relation(s) hidden.</p>}
            <GraphCanvas view={view} selected={selected} onSelect={(id) => set({ select: id })} dark={dark} />
          </Card>
          <Card title="Selected node">
            {node ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{node.id}</span>
                  <Badge>{NODE_TYPE_LABEL[node.type] ?? node.type}</Badge>
                </div>
                {node.label !== node.id && <p className="text-slate-700 dark:text-slate-200">{node.label}</p>}
                <div className="flex flex-wrap gap-2 text-xs">
                  {nodeHref(node.id) && <Link to={nodeHref(node.id)!} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">Open record →</Link>}
                  {node.id !== focus && <button type="button" onClick={() => set({ focus: node.id, select: '' })} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">Focus here</button>}
                  <span className="text-slate-500">{int(downstreamCount(ix, node.id))} downstream node(s)</span>
                </div>
                {[['Blocked by / depends on', ix.inc.get(node.id) ?? [], 'from'] as const, ['Blocks / leads to', ix.out.get(node.id) ?? [], 'to'] as const].map(([title, list, end]) => (
                  <div key={title}>
                    <h3 className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title} ({list.length})</h3>
                    <ul className="mt-1 max-h-56 space-y-1.5 overflow-y-auto pr-1">
                      {list.slice(0, 60).map((e, i) => (
                        <li key={i} className="text-xs">
                          <button type="button" onClick={() => set({ select: e[end] })} className="font-mono font-semibold text-blue-700 hover:underline dark:text-blue-300">{e[end]}</button>{' '}
                          <StatusBadge info={statusOf(CONFIDENCE, e.confidence)} /> <span className="text-slate-500">{humanize(e.relation)}</span>
                          <div className="text-slate-600 dark:text-slate-300">{e.evidence}</div>
                        </li>
                      ))}
                      {list.length > 60 && <li className="text-xs text-slate-500">+{list.length - 60} more</li>}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-slate-500">Select a node in the graph or the edge table.</p>
            )}
          </Card>
        </div>
      ) : (
        <Card>
          <p className="text-sm">Choose a focus node that exists in the graph.</p>
        </Card>
      )}

      {view && (
        <Card title="Edges in this view">
          <div className="max-h-96 overflow-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">Edges of the current neighbourhood</caption>
              <thead className="sticky top-0 bg-white dark:bg-slate-900">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="py-1 font-semibold">From</th>
                  <th scope="col" className="py-1 font-semibold">Relation</th>
                  <th scope="col" className="py-1 font-semibold">To</th>
                  <th scope="col" className="py-1 font-semibold">Confidence</th>
                  <th scope="col" className="py-1 font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {view.edges.map((e, i) => (
                  <tr key={i} className="border-t border-slate-100 align-top dark:border-slate-800">
                    <td className="py-1"><button type="button" onClick={() => set({ select: e.from })} className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">{e.from}</button></td>
                    <td className="py-1 text-xs">{humanize(e.relation)}</td>
                    <td className="py-1"><button type="button" onClick={() => set({ select: e.to })} className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">{e.to}</button></td>
                    <td className="py-1"><StatusBadge info={statusOf(CONFIDENCE, e.confidence)} /></td>
                    <td className="py-1 text-xs text-slate-600 dark:text-slate-300">{e.evidence}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title={`Root blockers (${ranked.length}), by downstream reach`}>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">A root blocker has an outgoing edge and no incoming gap-to-gap edge. Downstream reach counts every node reachable from it, including hypothetical edges.</p>
        <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
          {ranked.slice(0, 30).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1 dark:border-slate-800">
              <span className="flex items-center gap-2">
                <button type="button" onClick={() => set({ focus: r.id, select: '' })} className="font-mono text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">{r.id}</button>
                <IdLink to={`/gaps/${r.id}`}>record</IdLink>
              </span>
              <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">{int(r.down)} downstream</span>
            </li>
          ))}
        </ol>
      </Card>
      <Sources paths={[SRC, 'forward/reports/step-23/dependency-graph.mmd']} />
    </div>
  );
}
