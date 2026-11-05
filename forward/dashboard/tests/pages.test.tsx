// Pages render from the real evidence; navigation, filters, drill-downs and export work.
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EvidenceProvider } from '../src/evidence/EvidenceContext';
import { AppRoutes } from '../src/App';
import { NAV } from '../src/components/Layout';
import { fsFetcher, realModel } from './evidence';
import type { Model } from '../src/evidence/types';

let model: Model;
beforeAll(async () => {
  model = (await realModel()).model;
});

function renderAt(path: string) {
  return render(
    <EvidenceProvider model={model} fetcher={fsFetcher}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </EvidenceProvider>,
  );
}

const heading = () => screen.getByRole('heading', { level: 1 });

test('every page in the navigation renders its heading', async () => {
  const user = userEvent.setup();
  renderAt('/');
  const nav = screen.getByRole('navigation', { name: 'Dashboard pages' });
  const expected: Record<string, string> = {
    '/': 'Executive overview', '/comparison': 'Reverse vs forward comparison', '/programs': 'Program explorer', '/rules': 'Business rules explorer',
    '/gaps': 'Master gap register', '/dependencies': 'Dependency analysis', '/roadmap': 'Root cause and remediation roadmap', '/diagrams': 'Diagram explorer',
    '/bmad': 'BMad governance', '/testing': 'Testing and readiness', '/handover': 'Handover and evidence', '/evidence': 'Evidence validation',
  };
  for (const item of NAV) {
    await user.click(within(nav).getByRole('link', { name: item.label }));
    expect(heading()).toHaveTextContent(expected[item.to]);
  }
});

test('overview: KPIs from the evidence and the equivalence statement', () => {
  renderAt('/');
  expect(screen.getAllByText('COBOL-to-Java behavioral equivalence has not been established.').length).toBeGreaterThan(0);
  const main = within(screen.getByRole('main'));
  const kpi = (label: string) => main.getByText(label, { selector: 'div' }).parentElement!;
  expect(kpi('COBOL programs')).toHaveTextContent('42');
  expect(kpi('Java present')).toHaveTextContent('41');
  expect(kpi('Complete (current criteria)')).toHaveTextContent('2');
  expect(kpi('Partial')).toHaveTextContent('39');
  expect(kpi('Missing')).toHaveTextContent('1');
  expect(kpi('Business rules')).toHaveTextContent('154');
  expect(kpi('Java-verified rules')).toHaveTextContent('67');
  expect(kpi('Open gap records')).toHaveTextContent('569');
  expect(kpi('Readiness passing')).toHaveTextContent('6');
  expect(kpi('COBOL-equivalent programs')).toHaveTextContent('0');
});

test('program explorer lists all 42 programs and filters by classification', async () => {
  const user = userEvent.setup();
  renderAt('/programs');
  expect(screen.getByText('1–42 of 42 programs')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Classification'), 'COMPLETE');
  expect(screen.getByText('1–2 of 2 programs')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'PORTREAD' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'PROGNAME' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /Reset filters/ }));
  expect(screen.getByText('1–42 of 42 programs')).toBeInTheDocument();
});

test('PORTREAD is complete under current criteria but not COBOL-equivalent; POSUPDT is missing', () => {
  const { unmount } = renderAt('/programs/PORTREAD');
  expect(screen.getByText(/complete under the current criteria/)).toBeInTheDocument();
  expect(screen.getByText(/It is not independently COBOL-equivalent/)).toBeInTheDocument();
  expect(screen.getByText('COBOL equivalence Not established')).toBeInTheDocument();
  unmount();
  renderAt('/programs/POSUPDT');
  expect(screen.getByText(/the committed source is empty/)).toBeInTheDocument();
});

test('program drill-down links to its rules and gaps', async () => {
  const user = userEvent.setup();
  renderAt('/programs/BCHCTL00');
  await user.click(screen.getByRole('link', { name: 'BR-001' }));
  expect(heading()).toHaveTextContent('BR-001');
  expect(screen.getByText(/Java-verified is not COBOL-equivalent/)).toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: /Open in register/ }));
  expect(heading()).toHaveTextContent('Master gap register');
  expect(screen.getByText(/Showing records linked to rule/)).toBeInTheDocument();
});

test('rules explorer: 154 rules, status filter', async () => {
  const user = userEvent.setup();
  renderAt('/rules');
  expect(screen.getByText('1–40 of 154 rules')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Status'), 'IMPLEMENTED_VERIFIED');
  expect(screen.getByText('1–40 of 67 rules')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Status'), 'BLOCKED');
  expect(screen.getByText('1–32 of 32 rules')).toBeInTheDocument();
});

test('gap register: 569 records, filters, pagination, detail drawer, CSV export', async () => {
  const user = userEvent.setup();
  renderAt('/gaps');
  expect(screen.getByText('1–25 of 569 gap records')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Next page' }));
  expect(screen.getByText('26–50 of 569 gap records')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Severity'), 'critical');
  expect(screen.getByText('1–8 of 8 gap records')).toBeInTheDocument();

  let exported = '';
  const create = vi.fn((b: Blob) => {
    const reader = new FileReader();
    reader.onload = () => (exported = String(reader.result));
    reader.readAsText(b);
    return 'blob:test';
  });
  Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await user.click(screen.getByRole('button', { name: /Export CSV \(8\)/ }));
  await waitFor(() => expect(exported).not.toBe(''));
  expect(exported.match(/(^|\r\n)MGR-\d{4},/g)!.length).toBe(8);
  expect(click).toHaveBeenCalledOnce();
  click.mockRestore();

  await user.click(screen.getByRole('button', { name: 'MGR-0566' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(/none: the record stays OPEN/)).toBeInTheDocument();
  expect(within(dialog).getByText('forward/reports/bmad-end-to-end/master-gap-register.json#MGR-0566')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('dependency analysis toggles hypothetical relationships', async () => {
  const user = userEvent.setup();
  const hyp = model.graph!.edges.find((e) => e.confidence === 'HYPOTHESIS')!;
  renderAt(`/dependencies?focus=${hyp.from}&depth=1`);
  const table = () => screen.getByRole('table', { name: 'Edges of the current neighbourhood' });
  expect(within(table()).getAllByText('Hypothesis').length).toBeGreaterThan(0);
  await user.click(screen.getByRole('checkbox', { name: 'Show hypothetical relationships' }));
  expect(within(table()).queryAllByText('Hypothesis')).toHaveLength(0);
  expect(screen.getByText(/hypothetical relation\(s\) hidden/)).toBeInTheDocument();
});

test('BMad page shows the blocked status and no executed or authorized workflow', () => {
  renderAt('/bmad');
  expect(screen.getAllByText(/BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED/).length).toBeGreaterThan(0);
  const rows = within(screen.getByRole('table', { name: 'BMad workflows and their governance state' })).getAllByRole('row').slice(1);
  expect(rows).toHaveLength(6);
  // The governed run stopped at its first stage; the rest were never attempted.
  const execution = rows.map((r) => within(r).getAllByRole('cell')[5].textContent ?? '');
  expect(execution[0]).toMatch(/^Blocked/);
  for (const e of execution.slice(1)) expect(e).toMatch(/^Not attempted/);
  for (const r of rows) {
    expect(r).toHaveTextContent('Not authorized');
    expect(within(r).getAllByRole('cell')[5]).not.toHaveTextContent(/^Executed/);
    expect(within(r).getAllByRole('cell')[6]).toHaveTextContent('None');
  }
  // read-only: no form controls that could change approval state
  expect(screen.queryAllByRole('button', { name: /approve|authori[sz]e|execute|sign/i })).toHaveLength(0);
});

test('testing page: recorded results and readiness drill-down', async () => {
  const user = userEvent.setup();
  renderAt('/testing');
  expect(screen.getByText('Harness tests (npm test)').parentElement).toHaveTextContent('412 / 412');
  expect(screen.getByText('Java runtime tests').parentElement).toHaveTextContent('34 / 34');
  expect(screen.getByText('Pilot validation').parentElement).toHaveTextContent('41 / 42');
  expect(screen.getByText('Pilot readiness').parentElement).toHaveTextContent('6 / 42');
  await user.selectOptions(screen.getAllByLabelText('Readiness')[0], 'PASS');
  const t = screen.getByRole('table', { name: 'Readiness and validation per program' });
  expect(within(t).getAllByRole('row')).toHaveLength(7);
});

test('roadmap shows 570 memberships as 569 unique records', () => {
  renderAt('/roadmap');
  expect(screen.getByText(/570 phase memberships represent 569 unique gap records/)).toBeInTheDocument();
  expect(screen.getByText(/belongs to phases B and D/)).toBeInTheDocument();
});

test('diagram detail keeps the source evidence and shows the committed Mermaid source', async () => {
  renderAt('/diagrams/FLOW-PORTREAD');
  expect(screen.getByText('output/diagram/diagrams/flow_PORTREAD.mmd')).toBeInTheDocument();
  expect(await screen.findByText('source hash-verified')).toBeInTheDocument();
  expect(document.querySelector('pre')?.textContent).toMatch(/^(flowchart|graph)/m);
});

test('evidence validation reports all cross-checks agreeing', () => {
  renderAt('/evidence');
  expect(screen.getByText(/all \d+ cross-checks agree/)).toBeInTheDocument();
});
