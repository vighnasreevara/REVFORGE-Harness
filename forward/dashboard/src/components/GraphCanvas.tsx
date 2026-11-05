// Cytoscape rendering of one focused neighbourhood. Loaded lazily; the edge
// table next to it carries the same information for keyboard and screen readers.
import { useEffect, useRef } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type cytoscape from 'cytoscape';
import type { Core } from 'cytoscape';
import type { GraphView } from '../lib/graph';

const NODE_COLOR: Record<string, [string, string]> = {
  gap: ['#d03b3b', '#e66767'],
  business_rule: ['#2a78d6', '#3987e5'],
  readiness: ['#ec835a', '#ec835a'],
  external_prerequisite: ['#52514e', '#c3c2b7'],
  governance_prerequisite: ['#52514e', '#c3c2b7'],
  missing_member: ['#6250d6', '#9085e9'],
  verification: ['#52514e', '#c3c2b7'],
};

export const isJsdom = () => typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);

export function GraphCanvas({ view, selected, onSelect, dark }: { view: GraphView; selected: string; onSelect: (id: string) => void; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (isJsdom() || !ref.current) return;
    let alive = true;
    const i = dark ? 1 : 0;
    import('cytoscape').then(({ default: cytoscape }) => {
      if (!alive || !ref.current) return;
      cy.current?.destroy();
      const inst = cytoscape({
        container: ref.current,
        elements: [
          // Gap records are labelled by their stable MGR ID, as everywhere else in the dashboard.
          ...view.nodes.map((n) => {
            const label = n.type === 'gap' ? n.id : n.label;
            return { data: { id: n.id, label: label.length > 26 ? `${label.slice(0, 25)}…` : label, type: n.type } };
          }),
          ...view.edges.map((e, k) => ({ data: { id: `e${k}`, source: e.from, target: e.to, confidence: e.confidence, relation: e.relation } })),
        ],
        style: [
          {
            selector: 'node',
            style: {
              'background-color': (el: { data: (k: string) => string }) => (NODE_COLOR[el.data('type')] ?? NODE_COLOR.verification)[i],
              label: 'data(label)',
              color: dark ? '#f0efec' : '#0b0b0b',
              'font-size': 9,
              'min-zoomed-font-size': 6,
              'text-valign': 'bottom',
              'text-margin-y': 3,
              width: 14,
              height: 14,
              'border-width': 2,
              'border-color': dark ? '#1a1a19' : '#fcfcfb',
            },
          },
          { selector: 'node[type = "gap"]', style: { shape: 'round-rectangle' } },
          { selector: 'node[type = "business_rule"]', style: { shape: 'ellipse' } },
          { selector: 'node[type = "readiness"]', style: { shape: 'diamond' } },
          { selector: 'node[type *= "prerequisite"], node[type = "verification"], node[type = "missing_member"]', style: { shape: 'hexagon' } },
          {
            selector: 'edge',
            style: {
              width: 1.5,
              'curve-style': 'bezier',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 0.8,
              'line-color': dark ? '#3987e5' : '#2a78d6',
              'target-arrow-color': dark ? '#3987e5' : '#2a78d6',
            },
          },
          { selector: 'edge[confidence = "EVIDENCED_BY_TEXT"]', style: { 'line-style': 'dotted', width: 2 } },
          { selector: 'edge[confidence = "HYPOTHESIS"]', style: { 'line-style': 'dashed', 'line-dash-pattern': [6, 4], 'line-color': dark ? '#9085e9' : '#6250d6', 'target-arrow-color': dark ? '#9085e9' : '#6250d6' } },
          { selector: '.focus', style: { width: 22, height: 22, 'border-color': dark ? '#fab219' : '#0b0b0b', 'border-width': 3 } },
          { selector: '.dim', style: { opacity: 0.18 } },
        ],
        // Rings by hop distance from the focus: readable even when one node has many neighbours.
        layout: {
          name: 'concentric',
          concentric: (n: { id: () => string }) => 10 - (view.depthOf[n.id()] ?? 9),
          levelWidth: () => 1,
          minNodeSpacing: 18,
          padding: 24,
          animate: false,
        } as cytoscape.LayoutOptions,
        wheelSensitivity: 0.25,
        minZoom: 0.15,
        maxZoom: 3,
      });
      inst.on('tap', 'node', (e) => select.current(e.target.id()));
      cy.current = inst;
      highlight(inst, selected, view.focus);
    });
    return () => {
      alive = false;
      cy.current?.destroy();
      cy.current = null;
    };
    // Re-create only when the view or theme changes; selection is applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dark]);

  useEffect(() => {
    if (cy.current) highlight(cy.current, selected, view.focus);
  }, [selected, view.focus]);

  const btn = 'rounded-md bg-white/90 p-1.5 text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white dark:bg-slate-800/90 dark:text-slate-200 dark:ring-slate-700';
  if (isJsdom()) return <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">Graph canvas is not rendered in this environment; the edge table below lists the same relations.</div>;
  return (
    <div className="relative">
      <div ref={ref} role="img" aria-label={`Dependency neighbourhood of ${view.focus}: ${view.nodes.length} nodes, ${view.edges.length} edges. The edge table below lists them.`} className="h-[520px] w-full rounded-xl border border-slate-200 bg-[#fcfcfb] dark:border-slate-800 dark:bg-[#1a1a19]" />
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        <button type="button" className={btn} aria-label="Zoom in" onClick={() => cy.current?.zoom({ level: cy.current.zoom() * 1.25, renderedPosition: { x: (ref.current?.clientWidth ?? 0) / 2, y: 260 } })}>
          <ZoomIn aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" className={btn} aria-label="Zoom out" onClick={() => cy.current?.zoom({ level: cy.current.zoom() / 1.25, renderedPosition: { x: (ref.current?.clientWidth ?? 0) / 2, y: 260 } })}>
          <ZoomOut aria-hidden className="h-4 w-4" />
        </button>
        <button type="button" className={btn} aria-label="Fit to view" onClick={() => cy.current?.fit(undefined, 24)}>
          <Maximize2 aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function highlight(cy: Core, selected: string, focus: string) {
  cy.elements().removeClass('dim focus');
  cy.getElementById(focus).addClass('focus');
  const sel = cy.getElementById(selected);
  if (sel.nonempty() && selected !== focus) {
    const keep = sel.closedNeighborhood();
    cy.elements().not(keep).addClass('dim');
    sel.addClass('focus');
  }
}
