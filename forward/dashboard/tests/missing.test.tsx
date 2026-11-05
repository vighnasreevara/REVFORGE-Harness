// Missing, altered, unverifiable or malformed evidence is reported, never loaded into the
// model, and never replaced by zeros. Integrity is fail-closed: bytes are parsed only after
// their SHA-256 matches the manifest.
import { createHash } from 'node:crypto';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { loadBundle, loadText, type Fetcher } from '../src/evidence/loader';
import { buildModel } from '../src/evidence/model';
import { EvidenceProvider } from '../src/evidence/EvidenceContext';
import type { Manifest, Model } from '../src/evidence/types';
import Overview from '../src/pages/Overview';
import Comparison from '../src/pages/Comparison';
import EvidencePage from '../src/pages/EvidencePage';
import { GapRegister } from '../src/pages/Gaps';
import { ProgramList } from '../src/pages/Programs';
import { RuleList } from '../src/pages/Rules';
import { MermaidView } from '../src/components/MermaidView';
import { fsFetcher, without } from './evidence';

const REGISTER = 'forward/reports/step-23/master-gap-register.json';
const PROGRAMS = 'forward/reports/step-22/program-reconciliation.json';
const RULES = 'forward/reports/step-22/business-rule-reconciliation.json';
const SUMMARY = 'forward/reports/step-22/final-summary.json';
const GAP_SUMMARY = 'forward/reports/step-23/gap-summary.json';
const OWNERS = 'forward/reports/step-23/ownership-matrix.json';
const DIAGRAM = 'output/diagram/diagrams/flow_PORTREAD.mmd';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Serve `path` with its text changed by `edit` (valid syntax, different bytes). */
const altered = (path: string, edit: (text: string) => string): Fetcher => async (p) => {
  const bytes = await fsFetcher(p);
  if (!bytes || p !== path) return bytes;
  const out = edit(dec(bytes));
  if (out === dec(bytes)) throw new Error(`test edit did not change ${path}`);
  return enc(out);
};

/** Also rewrite the manifest entry for `path` (e.g. record the hash of new bytes, or drop the hash). */
const withManifest = (base: Fetcher, path: string, change: (entry: { sha256?: string }) => void): Fetcher => async (p) => {
  if (p !== 'manifest.json') return base(p);
  const m = JSON.parse(dec((await fsFetcher('manifest.json'))!)) as Manifest;
  for (const f of [...m.sources, ...m.collections.flatMap((c) => c.files)]) if (f.path === path) change(f);
  return enc(JSON.stringify(m));
};

const model = async (f: Fetcher) => buildModel(await loadBundle(f));
const dataset = (m: Model, path: string) => m.validation.datasets.find((d) => d.path === path);

function show(m: Model, path: string, element: React.ReactElement, fetcher: Fetcher = fsFetcher) {
  return render(
    <EvidenceProvider model={m} fetcher={fetcher}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={element} />
        </Routes>
      </MemoryRouter>
    </EvidenceProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

test('12. valid, unchanged evidence loads normally and is fully verified', async () => {
  const m = await model(fsFetcher);
  expect(m.validation.datasets.every((d) => d.status === 'loaded' && d.integrity === 'verified')).toBe(true);
  expect([m.programs?.length, m.rules?.length, m.gaps?.length, m.diagrams?.list.length]).toEqual([42, 154, 569, 65]);
  expect(m.validation.issues).toEqual([]);
});

test('1. a missing required dataset is reported and its section is unavailable', async () => {
  const m = await model(without([REGISTER]));
  expect(m.gaps).toBeNull();
  expect(dataset(m, REGISTER)?.status).toBe('missing');
  expect(m.validation.issues.some((i) => i.level === 'error' && i.message.includes(REGISTER))).toBe(true);
  // Cross-checks that depend on the register report "unavailable", not agreement.
  expect(m.validation.crossChecks.find((c) => c.name === 'register.total')).toBeUndefined();
  show(m, '/', <Overview />);
  expect(screen.getByText(/Evidence unavailable: primary KPIs/)).toBeInTheDocument();
  const tile = screen.getByText('Open gap records').parentElement!;
  expect(tile).toHaveTextContent('unavailable');
  expect(tile).not.toHaveTextContent(/^Open gap records0/);
});

test('the gap register page shows an evidence-unavailable state when the register is missing', async () => {
  show(await model(without([REGISTER])), '/gaps', <GapRegister />);
  expect(screen.getByRole('alert')).toHaveTextContent('master gap register');
});

test('no manifest: nothing is loaded and the reason is given', async () => {
  const bundle = await loadBundle(without(['manifest.json']));
  expect(bundle.manifest).toBeNull();
  expect(bundle.issues[0].message).toMatch(/npm run evidence/);
  const m = buildModel(bundle);
  expect([m.programs, m.rules, m.gaps, m.graph, m.bmad]).toEqual([null, null, null, null, null]);
});

test('2. altered content with valid syntax is rejected before parsing and never reaches the model', async () => {
  const m = await model(altered(GAP_SUMMARY, (t) => t.replace('"total": 569', '"total": 570')));
  const d = dataset(m, GAP_SUMMARY)!;
  expect([d.status, d.integrity]).toEqual(['rejected', 'mismatch']);
  expect(m.gapSummary).toBeNull();
  expect(m.validation.issues.some((i) => i.level === 'error' && i.message.includes(GAP_SUMMARY) && /SHA-256 differs/.test(i.message))).toBe(true);
  // The altered total is not used anywhere: no cross-check was computed from it.
  expect(m.validation.crossChecks.find((c) => c.name === 'register.total')).toBeUndefined();
  expect(JSON.stringify(m)).not.toContain('"total":570');
});

test('3. a modified gap register cannot populate the dashboard', async () => {
  const m = await model(altered(REGISTER, (t) => t.replace('"status": "OPEN"', '"status": "CLOSED"')));
  expect(dataset(m, REGISTER)?.status).toBe('rejected');
  expect(m.gaps).toBeNull();
  show(m, '/gaps', <GapRegister />);
  expect(screen.getByRole('alert')).toHaveTextContent('master gap register');
  expect(screen.queryByText('CLOSED')).toBeNull();
});

test('4. a modified program reconciliation cannot populate the program explorer', async () => {
  const m = await model(altered(PROGRAMS, (t) => t.replace('"classification": "PARTIAL"', '"classification": "COMPLETE"')));
  expect(dataset(m, PROGRAMS)?.status).toBe('rejected');
  expect(m.programs).toBeNull();
  show(m, '/programs', <ProgramList />);
  expect(screen.getByRole('alert')).toHaveTextContent('program reconciliation');
  expect(screen.queryByRole('table')).toBeNull();
});

test('5. a modified rule reconciliation cannot populate the rules explorer', async () => {
  const m = await model(altered(RULES, (t) => t.replace('"status": "BLOCKED"', '"status": "IMPLEMENTED_VERIFIED"')));
  expect(dataset(m, RULES)?.status).toBe('rejected');
  expect(m.rules).toBeNull();
  show(m, '/rules', <RuleList />);
  expect(screen.getByRole('alert')).toHaveTextContent('business-rule reconciliation');
});

test('6. a mismatched summary file cannot influence displayed totals', async () => {
  const m = await model(altered(SUMMARY, (t) => t.replace(/"numerator": 390,/, '"numerator": 402,')));
  expect(dataset(m, SUMMARY)?.status).toBe('rejected');
  expect(m.summary.ratios).toEqual({});
  expect(m.coverage.filter((c) => c.metric !== 'programs_cobol_equivalent')).toEqual([]);
  show(m, '/comparison', <Comparison />);
  expect(screen.getByRole('alert')).toHaveTextContent('reverse-vs-forward metrics');
  expect(screen.queryByText(/402 \/ 402/)).toBeNull();
});

test('7. an altered Mermaid source is neither rendered nor shown', async () => {
  const m = await model(fsFetcher);
  const tampered = altered(DIAGRAM, (t) => t.replace('flowchart', 'flowchart %% injected\n'));
  show(m, '/diagrams/FLOW-PORTREAD', <MermaidView path={DIAGRAM} />, tampered);
  expect(await screen.findByRole('alert')).toHaveTextContent(/Diagram unavailable: .*SHA-256 differs/);
  expect(document.querySelector('pre')).toBeNull();
  expect(screen.queryByText(/injected/)).toBeNull();
  expect(screen.queryByRole('button', { name: /Show Mermaid source/ })).toBeNull();
});

test('8. a diagram path the manifest does not list is refused', async () => {
  const m = await model(fsFetcher);
  for (const p of ['output/diagram/diagrams/not_listed.mmd', '../../.mcp.json', 'forward/reports/step-23/master-gap-register.json']) {
    const r = await loadText(fsFetcher, m.manifest!, p);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('unauthorized');
  }
  const ok = await loadText(fsFetcher, m.manifest!, DIAGRAM);
  expect(ok.ok && ok.integrity === 'verified').toBe(true);
});

test('9. invalid JSON is unavailable even when its hash is recorded', async () => {
  const broken = enc('{ not json');
  const f = withManifest(async (p) => (p === OWNERS ? broken : fsFetcher(p)), OWNERS, (e) => (e.sha256 = sha(broken)));
  const m = await model(f);
  const d = dataset(m, OWNERS)!;
  expect([d.status, d.integrity]).toEqual(['invalid', 'verified']);
  expect(m.owners).toBeNull();
});

test('invalid JSON with a mismatched hash is rejected before parsing', async () => {
  const m = await model(async (p) => (p === OWNERS ? enc('{ not json') : fsFetcher(p)));
  expect(dataset(m, OWNERS)?.status).toBe('rejected');
  expect(m.owners).toBeNull();
});

test('10. a file without a recorded SHA-256 is rejected', async () => {
  const m = await model(withManifest(fsFetcher, OWNERS, (e) => delete e.sha256));
  const d = dataset(m, OWNERS)!;
  expect([d.status, d.integrity]).toEqual(['rejected', 'no-expected-hash']);
  expect(m.owners).toBeNull();
  expect(m.validation.issues.some((i) => i.message.includes(OWNERS) && /no SHA-256/.test(i.message))).toBe(true);
});

test('11. without Web Crypto every file is unverified and nothing is loaded', async () => {
  vi.stubGlobal('crypto', {});
  const m = await model(fsFetcher);
  expect(m.validation.datasets.length).toBeGreaterThan(0);
  expect(m.validation.datasets.every((d) => d.status === 'rejected' && d.integrity === 'not-checked')).toBe(true);
  expect([m.programs, m.rules, m.gaps, m.graph, m.bmad, m.diagrams, m.groups]).toEqual([null, null, null, null, null, null, null]);
  expect(m.coverage.filter((c) => c.metric !== 'programs_cobol_equivalent')).toEqual([]);
  const r = await loadText(fsFetcher, m.manifest!, DIAGRAM);
  expect(r.ok).toBe(false);
  if (!r.ok) expect([r.reason, r.integrity]).toEqual(['rejected', 'not-checked']);
});

test('the evidence validation page lists every rejected file with its reason', async () => {
  const tampered = withManifest(altered(PROGRAMS, (t) => t.replace('"classification": "PARTIAL"', '"classification": "COMPLETE"')), OWNERS, (e) => delete e.sha256);
  const m = await model(tampered);
  show(m, '/evidence', <EvidencePage />);
  expect(screen.getByText(/evidence error\(s\)/)).toBeInTheDocument();
  const row = (path: string) => screen.getByText(path, { selector: 'span' }).closest('tr')!;
  expect(row(PROGRAMS)).toHaveTextContent(/rejected \(not loaded\).*SHA-256 differs.*SHA-256 mismatch/);
  expect(row(OWNERS)).toHaveTextContent(/rejected \(not loaded\).*no SHA-256.*no recorded hash/);
});
