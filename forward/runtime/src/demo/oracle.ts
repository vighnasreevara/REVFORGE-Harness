/**
 * Independent behavioural oracle for the synthetic demo program DEMOORD1 (demo gate G6).
 *
 * Written from forward/demo/gates/synthetic/requirements/requirements.json only:
 * it implements REQ-DEMO-001..008 directly in integer arithmetic (BigInt cents).
 * It deliberately imports nothing: it never parses the COBOL, never reads or
 * calls the generated Java and never uses the converter or the Java runtime.
 * Demo gate G6 checks this independence by inspecting the compiled module.
 */

export interface DemoOrder {
  tier: string;
  line_count: number;
  /** [quantity, unit price in cents] per line; only the first line_count lines are priced. */
  lines: Array<[number, number]>;
}

export interface DemoResult {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  return_code: number;
}

const ZERO: DemoResult = { subtotal: 0, discount: 0, shipping: 0, total: 0, return_code: 0 };

/** Expected result of one call, from the requirements alone. */
export function expectedResult(order: DemoOrder): DemoResult {
  // REQ-DEMO-008: every output starts at zero on every call.
  // REQ-DEMO-001: the line count is checked first.
  if (order.line_count < 1 || order.line_count > 5) return { ...ZERO, return_code: 8 };
  // REQ-DEMO-002: then the tier.
  if (!['S', 'G', 'P'].includes(order.tier)) return { ...ZERO, return_code: 4 };
  // REQ-DEMO-003 and REQ-DEMO-004: price the first line_count lines; any zero quantity rejects the order.
  let subtotal = 0n;
  for (let i = 0; i < order.line_count; i++) {
    const [qty, unit] = order.lines[i] ?? [0, 0];
    if (qty === 0) return { ...ZERO, return_code: 12 };
    subtotal += BigInt(qty) * BigInt(unit);
  }
  // REQ-DEMO-005: the first matching discount rule; BigInt division truncates like COMPUTE without ROUNDED.
  let discount = 0n;
  if (order.tier === 'P' && subtotal >= 50000n) discount = (subtotal * 15n) / 100n;
  else if ((order.tier === 'G' || order.tier === 'P') && subtotal >= 10000n) discount = (subtotal * 5n) / 100n;
  // REQ-DEMO-006: shipping below a net of 7500 cents.
  const shipping = subtotal - discount < 7500n ? 695n : 0n;
  // REQ-DEMO-007: the total.
  const total = subtotal - discount + shipping;
  return { subtotal: Number(subtotal), discount: Number(discount), shipping: Number(shipping), total: Number(total), return_code: 0 };
}

/** The requirement IDs a case exercises, derived from the oracle's own decision path. */
export function exercisedRequirements(order: DemoOrder, r: DemoResult): string[] {
  const reqs = new Set<string>(['REQ-DEMO-008']);
  if (r.return_code === 8) reqs.add('REQ-DEMO-001');
  else if (r.return_code === 4) reqs.add('REQ-DEMO-002');
  else if (r.return_code === 12) reqs.add('REQ-DEMO-004');
  else ['REQ-DEMO-003', 'REQ-DEMO-005', 'REQ-DEMO-006', 'REQ-DEMO-007'].forEach((x) => reqs.add(x));
  if (order.line_count >= 1 && order.line_count <= 5 && r.return_code !== 8) reqs.add('REQ-DEMO-001');
  return [...reqs].sort();
}

/** Small deterministic PRNG (mulberry32) so the seeded cases are reproducible. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OracleCase {
  id: string;
  category: 'boundary' | 'negative' | 'seeded' | 'example';
  title: string;
  order: DemoOrder;
  /** Output values a caller leaves behind before the call (REQ-DEMO-008: they must never survive). */
  preset: DemoResult;
  expected: DemoResult;
  requirement_ids: string[];
}

const single = (tier: string, qty: number, unit: number): DemoOrder => ({ tier, line_count: 1, lines: [[qty, unit]] });

/** Boundary, negative and seeded random cases, with expectations from the oracle. */
export function generateCases(seed: number, seededCount: number, examples: Array<{ id: string; title: string; order: DemoOrder }> = []): OracleCase[] {
  const rnd = prng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rnd() * (hi - lo + 1));
  const preset = (): DemoResult => ({ subtotal: int(0, 999999999), discount: int(0, 999999999), shipping: int(0, 99999), total: int(0, 999999999), return_code: int(0, 99) });
  const raw: Array<Omit<OracleCase, 'expected' | 'requirement_ids' | 'preset'>> = [];
  const add = (category: OracleCase['category'], title: string, order: DemoOrder) => raw.push({ id: '', category, title, order });

  // Thresholds, one cent either side, for every tier.
  for (const tier of ['S', 'G', 'P']) {
    for (const v of [7499, 7500, 7501, 9999, 10000, 10001, 49999, 50000, 50001]) add('boundary', `tier ${tier}, subtotal ${v}`, single(tier, 1, v));
  }
  // Net-of-discount shipping boundary for discounted orders (gold 5%: net 7500 needs a subtotal of about 7895).
  for (const v of [7894, 7895, 7896, 7897]) add('boundary', `gold subtotal ${v} (below the discount threshold)`, single('G', 1, v));
  // Truncation of fractional cents.
  for (const v of [10001, 10019, 10020, 50001, 50006, 50007, 99999]) add('boundary', `fraction truncation at ${v}`, single('P', 1, v));
  // Line counts around the valid range.
  for (const n of [0, 1, 5, 6, 99]) add(n >= 1 && n <= 5 ? 'boundary' : 'negative', `line count ${n}`, { tier: 'G', line_count: n, lines: Array.from({ length: 5 }, () => [2, 3000] as [number, number]) });
  // Unknown tiers, alone and together with an invalid line count (precedence).
  for (const t of ['X', ' ', 's', 'g', 'Z']) add('negative', `unknown tier '${t}'`, single(t, 1, 1000));
  add('negative', 'unknown tier and line count 0 (line count wins)', { tier: 'X', line_count: 0, lines: [[1, 1]] });
  // A zero quantity in every position, and after the last priced line (ignored).
  for (let k = 0; k < 5; k++) add('negative', `zero quantity on line ${k + 1} of 5`, { tier: 'P', line_count: 5, lines: Array.from({ length: 5 }, (_, i) => [i === k ? 0 : 3, 25000] as [number, number]) });
  add('boundary', 'zero quantity after the last priced line is ignored', { tier: 'S', line_count: 2, lines: [[1, 100], [1, 100], [0, 100]] });
  // Extremes.
  add('boundary', 'maximum order', { tier: 'P', line_count: 5, lines: Array.from({ length: 5 }, () => [999, 99999] as [number, number]) });
  add('boundary', 'minimum priced order (1 x 0 cents)', single('S', 1, 0));
  add('boundary', 'quantity 999 x 1 cent', single('G', 1, 999));
  // Seeded random orders across the whole input domain.
  for (let i = 0; i < seededCount; i++) {
    const tier = ['S', 'G', 'P', 'S', 'G', 'P', 'Q'][int(0, 6)];
    const n = int(0, 6);
    const lines = Array.from({ length: 5 }, () => [rnd() < 0.06 ? 0 : int(1, 999), int(0, 99999) >> int(0, 12)] as [number, number]);
    add(n < 1 || n > 5 || tier === 'Q' ? 'negative' : 'seeded', `seeded order ${i + 1}`, { tier, line_count: n, lines });
  }
  for (const e of examples) raw.push({ id: e.id, category: 'example', title: e.title, order: { ...e.order, lines: [...e.order.lines, ...Array.from({ length: Math.max(0, 5 - e.order.lines.length) }, () => [1, 0] as [number, number])].slice(0, 5) } });
  return raw.map((c, i) => {
    const expected = expectedResult(c.order);
    return { ...c, id: c.id || `OR-${String(i + 1).padStart(4, '0')}`, preset: preset(), expected, requirement_ids: exercisedRequirements(c.order, expected) };
  });
}
