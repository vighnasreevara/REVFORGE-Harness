// Focused views of the 705-node dependency graph. The whole graph is never drawn
// at once: a view is the neighbourhood of one node, capped in size.
import type { DependencyGraph, GraphEdge, GraphNode } from '../evidence/types';

export type Direction = 'both' | 'upstream' | 'downstream';

export interface GraphView {
  focus: string;
  /** Hop distance of each node from the focus. */
  depthOf: Record<string, number>;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  hiddenHypotheses: number;
}

export interface ViewOptions {
  depth: number;
  direction: Direction;
  includeHypotheses: boolean;
  maxNodes: number;
  /** Expand through shared prerequisites (EXT-DB2 has 75 gaps). Off by default; focusing one always shows its gaps. */
  expandHubs: boolean;
}

export const DEFAULT_VIEW: ViewOptions = { depth: 2, direction: 'both', includeHypotheses: true, maxNodes: 120, expandHubs: false };

export const isHub = (type: string) => type.endsWith('_prerequisite');

export function index(graph: DependencyGraph) {
  const out = new Map<string, GraphEdge[]>();
  const inc = new Map<string, GraphEdge[]>();
  for (const e of graph.edges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e]);
    inc.set(e.to, [...(inc.get(e.to) ?? []), e]);
  }
  return { out, inc, nodes: new Map(graph.nodes.map((n) => [n.id, n])) };
}

export type GraphIndex = ReturnType<typeof index>;

/** Breadth-first neighbourhood of `focus`, following edges in the chosen direction. */
export function neighbourhood(ix: GraphIndex, focus: string, opt: ViewOptions): GraphView {
  const seen = new Set<string>([focus]);
  const depthOf: Record<string, number> = { [focus]: 0 };
  const edges = new Map<string, GraphEdge>();
  let frontier = [focus];
  let truncated = false;
  let hidden = 0;
  for (let d = 0; d < opt.depth && frontier.length; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      if (id !== focus && !opt.expandHubs && isHub(ix.nodes.get(id)?.type ?? '')) continue;
      const cand = [
        ...(opt.direction !== 'upstream' ? (ix.out.get(id) ?? []).map((e) => [e, e.to] as const) : []),
        ...(opt.direction !== 'downstream' ? (ix.inc.get(id) ?? []).map((e) => [e, e.from] as const) : []),
      ];
      for (const [e, other] of cand) {
        if (!opt.includeHypotheses && e.confidence === 'HYPOTHESIS') {
          hidden++;
          continue;
        }
        if (!seen.has(other)) {
          if (seen.size >= opt.maxNodes) {
            truncated = true;
            continue;
          }
          seen.add(other);
          depthOf[other] = d + 1;
          next.push(other);
        }
        edges.set(`${e.from}->${e.to}:${e.relation}`, e);
      }
    }
    frontier = next;
  }
  const nodes = [...seen].map((id) => ix.nodes.get(id) ?? { id, type: 'unknown', label: id });
  return { focus, depthOf, nodes, edges: [...edges.values()].filter((e) => seen.has(e.from) && seen.has(e.to)), truncated, hiddenHypotheses: hidden };
}

/** Number of nodes reachable downstream of `id` (what resolving it could unblock). */
export function downstreamCount(ix: GraphIndex, id: string, includeHypotheses = true): number {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    for (const e of ix.out.get(cur) ?? []) {
      if (!includeHypotheses && e.confidence === 'HYPOTHESIS') continue;
      if (!seen.has(e.to)) {
        seen.add(e.to);
        stack.push(e.to);
      }
    }
  }
  return seen.size;
}

export const NODE_TYPE_LABEL: Record<string, string> = {
  gap: 'Gap record',
  business_rule: 'Business rule',
  readiness: 'Failing readiness result',
  external_prerequisite: 'External prerequisite',
  governance_prerequisite: 'Governance prerequisite',
  missing_member: 'Missing COPY/INCLUDE member',
  verification: 'Verification prerequisite',
};

/** Program named by a readiness node (READINESS-<PROGRAM>), for drill-down links. */
export const readinessProgram = (id: string) => (id.startsWith('READINESS-') ? id.slice('READINESS-'.length) : null);
