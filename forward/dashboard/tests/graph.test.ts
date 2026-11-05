// Focused neighbourhoods and hypothesis handling in the dependency graph.
import { DEFAULT_VIEW, downstreamCount, index, neighbourhood } from '../src/lib/graph';
import { findCycle } from '../src/evidence/model';
import { realModel } from './evidence';

test('hiding hypotheses removes exactly the HYPOTHESIS edges and reports them', async () => {
  const g = (await realModel()).model.graph!;
  const ix = index(g);
  const hyp = g.edges.find((e) => e.confidence === 'HYPOTHESIS')!;
  const shown = neighbourhood(ix, hyp.from, { ...DEFAULT_VIEW, depth: 1 });
  expect(shown.edges.some((e) => e.confidence === 'HYPOTHESIS')).toBe(true);
  const hidden = neighbourhood(ix, hyp.from, { ...DEFAULT_VIEW, depth: 1, includeHypotheses: false });
  expect(hidden.edges.some((e) => e.confidence === 'HYPOTHESIS')).toBe(false);
  expect(hidden.hiddenHypotheses).toBe(shown.edges.filter((e) => e.confidence === 'HYPOTHESIS').length);
});

test('a neighbourhood respects direction and the node cap', async () => {
  const g = (await realModel()).model.graph!;
  const ix = index(g);
  const ext = 'EXT-DB2';
  const down = neighbourhood(ix, ext, { ...DEFAULT_VIEW, depth: 1, direction: 'downstream', maxNodes: 1000 });
  expect(down.edges.every((e) => e.from === ext)).toBe(true);
  expect(down.nodes.length).toBe(1 + new Set(g.edges.filter((e) => e.from === ext).map((e) => e.to)).size);
  const capped = neighbourhood(ix, ext, { ...DEFAULT_VIEW, depth: 3, maxNodes: 20 });
  expect(capped.nodes.length).toBeLessThanOrEqual(20);
  expect(capped.truncated).toBe(true);
  expect(capped.edges.every((e) => capped.nodes.some((n) => n.id === e.from) && capped.nodes.some((n) => n.id === e.to))).toBe(true);
});

test('root blockers reach downstream nodes; graph has no cycle', async () => {
  const g = (await realModel()).model.graph!;
  const ix = index(g);
  expect(g.rootBlockers.every((id) => downstreamCount(ix, id) > 0)).toBe(true);
  expect(findCycle(g.edges)).toBe(false);
  expect(findCycle([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }])).toBe(true);
});
