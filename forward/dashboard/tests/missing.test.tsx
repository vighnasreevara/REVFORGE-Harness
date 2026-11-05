// Missing, altered or malformed evidence is reported and never replaced by zeros.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { loadBundle, type Fetcher } from '../src/evidence/loader';
import { buildModel } from '../src/evidence/model';
import { EvidenceProvider } from '../src/evidence/EvidenceContext';
import Overview from '../src/pages/Overview';
import { GapRegister } from '../src/pages/Gaps';
import { fsFetcher, without } from './evidence';

const REGISTER = 'forward/reports/step-23/master-gap-register.json';

test('a missing required dataset is reported and its section is unavailable', async () => {
  const model = buildModel(await loadBundle(without([REGISTER])));
  expect(model.gaps).toBeNull();
  expect(model.validation.datasets.find((d) => d.path === REGISTER)?.status).toBe('missing');
  expect(model.validation.issues.some((i) => i.level === 'error' && i.message.includes(REGISTER))).toBe(true);
  // Cross-checks that depend on the register report "unavailable", not agreement.
  expect(model.validation.crossChecks.find((c) => c.name === 'register.total')).toBeUndefined();

  render(
    <EvidenceProvider model={model}>
      <MemoryRouter>
        <Overview />
      </MemoryRouter>
    </EvidenceProvider>,
  );
  expect(screen.getByText(/Evidence unavailable: primary KPIs/)).toBeInTheDocument();
  const tile = screen.getByText('Open gap records').parentElement!;
  expect(tile).toHaveTextContent('unavailable');
  expect(tile).not.toHaveTextContent(/^Open gap records0/);
});

test('the gap register page shows an evidence-unavailable state', async () => {
  const model = buildModel(await loadBundle(without([REGISTER])));
  render(
    <EvidenceProvider model={model}>
      <MemoryRouter initialEntries={['/gaps']}>
        <GapRegister />
      </MemoryRouter>
    </EvidenceProvider>,
  );
  expect(screen.getByRole('alert')).toHaveTextContent('master gap register');
});

test('no manifest: nothing is loaded and the reason is given', async () => {
  const bundle = await loadBundle(without(['manifest.json']));
  expect(bundle.manifest).toBeNull();
  expect(bundle.issues[0].message).toMatch(/npm run evidence/);
  const model = buildModel(bundle);
  expect([model.programs, model.rules, model.gaps, model.graph, model.bmad]).toEqual([null, null, null, null, null]);
});

test('an altered evidence copy fails its integrity check', async () => {
  const tampered: Fetcher = async (p) => {
    const bytes = await fsFetcher(p);
    if (!bytes || !p.endsWith('/gap-summary.json')) return bytes;
    const text = new TextDecoder().decode(bytes).replace('"total": 569', '"total": 570');
    return new TextEncoder().encode(text);
  };
  const model = buildModel(await loadBundle(tampered));
  expect(model.validation.datasets.find((d) => d.path.endsWith('/gap-summary.json'))?.integrity).toBe('mismatch');
  expect(model.validation.issues.some((i) => /SHA-256 differs/.test(i.message))).toBe(true);
  // and the recount exposes the altered total
  expect(model.validation.crossChecks.find((c) => c.name === 'register.total')?.ok).toBe(false);
});

test('malformed JSON is reported as invalid', async () => {
  const broken: Fetcher = async (p) => (p.endsWith('ownership-matrix.json') ? new TextEncoder().encode('{ not json') : fsFetcher(p));
  const model = buildModel(await loadBundle(broken));
  expect(model.validation.datasets.find((d) => d.path.endsWith('ownership-matrix.json'))?.status).toBe('invalid');
  expect(model.owners).toBeNull();
});
