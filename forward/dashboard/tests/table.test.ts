// Gap filtering, sorting, pagination and CSV export.
import { EMPTY_GAP_FILTERS, filterGaps, GAP_CSV_HEADER, gapsToCsv, paginate, sortGaps, toCsv } from '../src/lib/table';
import { realModel } from './evidence';

test('filters reproduce the recorded category, severity and owner totals', async () => {
  const gaps = (await realModel()).model.gaps!;
  const f = (patch: Partial<typeof EMPTY_GAP_FILTERS>) => filterGaps(gaps, { ...EMPTY_GAP_FILTERS, ...patch }).length;
  expect(f({})).toBe(569);
  expect(f({ category: 'SOURCE_MISSING' })).toBe(267);
  expect(f({ category: 'EXTERNAL_DEPENDENCY' })).toBe(133);
  expect(f({ severity: 'critical' })).toBe(8);
  expect(f({ priority: 'P1' })).toBe(109);
  expect(f({ owner: 'OWNER_REVIEW_REQUIRED' })).toBe(28);
  expect(f({ group: 'RCG-01' })).toBe(75);
  expect(f({ inventory: 'reverse_gap' })).toBe(174);
  expect(f({ program: 'POSUPDT', severity: 'critical' })).toBeGreaterThan(0);
  expect(f({ category: 'SOURCE_MISSING', severity: 'critical', owner: 'Business SME' })).toBe(0);
});

test('text search matches every term across ID, subject and description', async () => {
  const gaps = (await realModel()).model.gaps!;
  expect(filterGaps(gaps, { ...EMPTY_GAP_FILTERS, q: 'MGR-0566' }).map((g) => g.id)).toEqual(['MGR-0566']);
  const both = filterGaps(gaps, { ...EMPTY_GAP_FILTERS, q: 'posupdt empty' });
  expect(both.length).toBeGreaterThan(0);
  expect(both.every((g) => JSON.stringify(g).toLowerCase().includes('posupdt'))).toBe(true);
});

test('rule filter follows both rule lists and rule links', async () => {
  const { gaps, rules } = (await realModel()).model;
  const br = rules!.find((r) => r.id === 'BR-001')!;
  const linked = filterGaps(gaps!, { ...EMPTY_GAP_FILTERS, rule: 'BR-001' }).map((g) => g.id).sort();
  expect(linked).toEqual([...br.gapIds].sort());
});

test('sorting by severity puts critical first and keeps a stable ID order', async () => {
  const gaps = (await realModel()).model.gaps!;
  const s = sortGaps(gaps, 'severity', 'asc');
  expect(s.slice(0, 8).every((g) => g.severity === 'critical')).toBe(true);
  expect(s.slice(0, 8).map((g) => g.id)).toEqual([...s.slice(0, 8).map((g) => g.id)].sort());
  expect(sortGaps(gaps, 'id', 'desc')[0].id).toBe('MGR-0569');
});

test('pagination covers all 569 records exactly once', async () => {
  const gaps = (await realModel()).model.gaps!;
  const first = paginate(gaps, 1, 25);
  expect([first.pages, first.start, first.end, first.total]).toEqual([23, 1, 25, 569]);
  const last = paginate(gaps, 23, 25);
  expect([last.rows.length, last.start, last.end]).toEqual([19, 551, 569]);
  expect(paginate(gaps, 99, 25).page).toBe(23);
  const seen = Array.from({ length: 23 }, (_, i) => paginate(gaps, i + 1, 25).rows.map((g) => g.id)).flat();
  expect(new Set(seen).size).toBe(569);
});

test('CSV export: header, one row per record, quoting and formula neutralisation', async () => {
  const gaps = (await realModel()).model.gaps!;
  const csv = gapsToCsv(gaps);
  const lines = csv.trimEnd().split('\r\n');
  expect(lines[0]).toBe(GAP_CSV_HEADER.join(','));
  // Count records by their leading master ID (fields may contain quoted line breaks).
  expect(csv.match(/(^|\r\n)MGR-\d{4},/g)!.length).toBe(569);
  expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['=SUM(A1)', null]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=SUM(A1),\r\n');
});
