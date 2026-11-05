// Writes the STEP-24 structured evidence to forward/reports/step-24/ from the
// same adapter the dashboard uses. Deterministic: no timestamps or timings; the
// commands that were run and their results live in regression-runs.jsonl.
// Usage: npm run report   (after npm run evidence and npm run build)
// REVFORGE_REPORT_OUT=<dir> writes elsewhere (used to re-check the committed STEP-24 evidence without overwriting it).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadBundle, type Fetcher } from '../src/evidence/loader';
import { buildModel } from '../src/evidence/model';
import { index, neighbourhood, DEFAULT_VIEW } from '../src/lib/graph';

const DASH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(DASH, '..', '..');
const EVIDENCE = path.join(DASH, 'public', 'evidence');
const OUT = process.env.REVFORGE_REPORT_OUT ? path.resolve(process.env.REVFORGE_REPORT_OUT) : path.join(REPO, 'forward', 'reports', 'step-24');
const fetcher: Fetcher = async (p) => {
  const f = path.join(EVIDENCE, p);
  return fs.existsSync(f) ? new Uint8Array(fs.readFileSync(f)) : null;
};
const write = (name: string, obj: unknown) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(obj, null, 1) + '\n', 'utf8');
};
const read = (rel: string) => JSON.parse(fs.readFileSync(path.join(EVIDENCE, rel), 'utf8'));

const bundle = await loadBundle(fetcher);
const m = buildModel(bundle);
const manifest = m.manifest!;
const sha = (key: string) => manifest.sources.find((s) => s.key === key);
const S22 = 'forward/reports/step-22';
const S23 = 'forward/reports/step-23';

// ---- Primary metrics: dashboard value vs the value read directly from the report --------------
const fs22 = read(`${S22}/final-summary.json`).metrics as { metric: string; numerator: number; denominator: number }[];
const ratio = (k: string) => fs22.find((x) => x.metric === k)!;
const pr = read(`${S22}/program-reconciliation.json`);
const rr = read(`${S22}/business-rule-reconciliation.json`).summary;
const gs = read(`${S23}/gap-summary.json`);
const dg = read(`${S23}/dependency-graph.json`).summary;
const bm = read(`${S22}/bmad-governance-status.json`).metrics;
const P = m.programs!;
const R = m.rules!;
const G = m.gaps!;
const primary: [string, string, number, number, string][] = [
  ['programs_total', 'Total COBOL programs', P.length, pr.programs.length, `${S22}/program-reconciliation.json`],
  ['programs_java_present', 'Java-present programs', P.filter((p) => p.javaClass).length, ratio('programs_with_java').numerator, `${S22}/final-summary.json`],
  ['programs_complete', 'Complete programs', P.filter((p) => p.classification === 'COMPLETE').length, pr.summary.COMPLETE, `${S22}/program-reconciliation.json`],
  ['programs_partial', 'Partial programs', P.filter((p) => p.classification === 'PARTIAL').length, pr.summary.PARTIAL, `${S22}/program-reconciliation.json`],
  ['programs_missing', 'Missing programs', P.filter((p) => p.classification === 'MISSING').length, pr.summary.MISSING, `${S22}/program-reconciliation.json`],
  ['rules_total', 'Total business rules', R.length, rr.total, `${S22}/business-rule-reconciliation.json`],
  ['rules_java_verified', 'Source-derived Java-verified rules', R.filter((r) => r.status === 'IMPLEMENTED_VERIFIED').length, rr.by_status.IMPLEMENTED_VERIFIED, `${S22}/business-rule-reconciliation.json`],
  ['rules_verified_to_gap', 'Rules verified up to a downstream gap', R.filter((r) => r.status === 'IMPLEMENTED_VERIFIED_TO_GAP').length, rr.by_status.IMPLEMENTED_VERIFIED_TO_GAP, `${S22}/business-rule-reconciliation.json`],
  ['rules_unreachable', 'Unreachable rules', R.filter((r) => r.status === 'IMPLEMENTED_NOT_EXERCISED').length, rr.by_status.IMPLEMENTED_NOT_EXERCISED, `${S22}/business-rule-reconciliation.json`],
  ['rules_blocked', 'Blocked rules', R.filter((r) => r.status === 'BLOCKED').length, rr.by_status.BLOCKED, `${S22}/business-rule-reconciliation.json`],
  ['gaps_open', 'Open gap records', G.filter((g) => g.status === 'OPEN').length, gs.by_status.OPEN, `${S23}/gap-summary.json`],
  ['programs_readiness_pass', 'Programs passing readiness', P.filter((p) => p.readiness.status === 'PASS').length, ratio('readiness_pass').numerator, `${S22}/final-summary.json`],
  ['programs_cobol_equivalent', 'Independently established COBOL-equivalent programs', P.filter((p) => p.cobolEquivalence !== 'NOT_ESTABLISHED').length, pr.programs.filter((p: { cobol_equivalence: string }) => p.cobol_equivalence !== 'NOT_ESTABLISHED').length, `${S22}/program-reconciliation.json`],
  ['graph_nodes', 'Dependency graph nodes', m.graph!.nodes.length, dg.nodes, `${S23}/dependency-graph.json`],
  ['graph_edges', 'Dependency graph edges', m.graph!.edges.length, dg.edges, `${S23}/dependency-graph.json`],
  ['graph_hypotheses', 'Hypothetical edges', m.graph!.edges.filter((e) => e.confidence === 'HYPOTHESIS').length, dg.by_confidence.HYPOTHESIS, `${S23}/dependency-graph.json`],
  ['bmad_executed_live', 'BMad workflows executed live', m.bmad!.workflows.filter((w) => w.executed).length, bm.executed_live, `${S22}/bmad-governance-status.json`],
  ['bmad_blocked', 'BMad workflows blocked', m.bmad!.workflows.filter((w) => w.stageStatus === 'BLOCKED' || w.stageStatus === 'NOT_ATTEMPTED').length, bm.blocked_workflows, `${S22}/bmad-governance-status.json`],
];
const coverage = m.coverage.map((c) => {
  const rec = fs22.find((x) => x.metric === c.metric);
  return { metric: c.metric, area: c.area, measure: c.measure, evidence_kind: c.kind, dashboard: `${c.numerator}/${c.denominator}`, recorded: rec ? `${rec.numerator}/${rec.denominator}` : 'derived', agrees: rec ? rec.numerator === c.numerator && rec.denominator === c.denominator : true, source: c.source };
});

write('metric-validation.json', {
  contract: 'step-24/metric-validation',
  fields: {
    'primary_metrics[].dashboard': 'value computed by the dashboard adapter from detailed records',
    'primary_metrics[].recorded': 'value read directly from the committed report (independent of the adapter)',
    cross_checks: 'every recount the adapter performs, with the recorded summary it is compared to',
  },
  baseline_commit: m.baselineCommit,
  primary_metrics: primary.map(([metric, label, dashboard, recorded, source]) => ({ metric, label, dashboard, recorded, agrees: dashboard === recorded, source })),
  coverage_metrics: coverage,
  cross_checks: { total: m.validation.crossChecks.length, agree: m.validation.crossChecks.filter((c) => c.ok).length, disagree: m.validation.crossChecks.filter((c) => !c.ok), checks: m.validation.crossChecks },
  issues: m.validation.issues,
  datasets: {
    total: m.validation.datasets.length,
    loaded: m.validation.datasets.filter((d) => d.status === 'loaded').length,
    sha256_verified: m.validation.datasets.filter((d) => d.integrity === 'verified').length,
    lazily_loaded_mermaid_sources: manifest.collections.find((c) => c.key === 'diagrams')?.files.length ?? 0,
  },
  status: primary.every(([, , a, b]) => a === b) && coverage.every((c) => c.agrees) && m.validation.crossChecks.every((c) => c.ok) && !m.validation.issues.length ? 'ALL_METRICS_AGREE' : 'DISAGREEMENTS_FOUND',
});

// ---- Evidence source mapping ------------------------------------------------------------------
const PAGES: { route: string; page: string; datasets: string[]; features: string[] }[] = [
  { route: '/', page: 'Executive overview', datasets: ['finalSummary', 'programRecon', 'ruleRecon', 'register', 'bmadStatus', 'readiness'], features: ['10 primary KPIs read from evidence', 'program, rule, severity and readiness distributions (chart + table view)', 'forward coverage by evidence kind', 'BMad status', 'evidence date, source report and baseline commit', 'equivalence-not-established statement'] },
  { route: '/comparison', page: 'Reverse vs forward comparison', datasets: ['finalSummary', 'paragraphRecon', 'statementRecon', 'controlFlowRecon', 'fieldRecon', 'recordRecon', 'copybookRecon', 'diagramRecon', 'jclRecon'], features: ['24+ measures with numerator/denominator', 'evidence-kind filter (structural, implemented, test, verification, equivalence)', 'per-measure breakdowns', 'JCL job table', 'no combined modernization percentage'] },
  { route: '/programs, /programs/:id', page: 'Program explorer', datasets: ['programRecon', 'programGapImpact', 'register', 'ruleRecon', 'readiness'], features: ['search', 'classification, readiness and severity filters', 'sort by gap count, rule count, validation status', 'detail: provenance, coverage, rules, gaps, dependencies, tests, readiness checks and gates, next actions', 'PORTREAD/PROGNAME complete-under-criteria and POSUPDT empty-source notes'] },
  { route: '/rules, /rules/:id', page: 'Business rules explorer', datasets: ['ruleRecon', 'ruleGapImpact', 'rulesArtifact'], features: ['search by rule ID/name', 'status, program, category, linked-gap and gap-ID filters', 'sort by status', 'detail: description, COBOL and Java references, scenarios and outcomes, related gaps, remaining verification', 'Java-verified vs COBOL-equivalent explanation'] },
  { route: '/gaps, /gaps/:id', page: 'Master gap register', datasets: ['register', 'gapSummary', 'dependencyGraph'], features: ['569 records, paginated (25/50/100/all)', 'search', 'category, severity, priority, owner, program, root-cause, inventory and rule filters', 'sorting', 'detail drawer with full provenance', 'CSV export of the filtered set', 'read-only'] },
  { route: '/dependencies', page: 'Dependency analysis', datasets: ['dependencyGraph', 'register'], features: ['focused neighbourhoods (depth, direction, relation, node cap)', 'node search', 'zoom, pan, fit', 'selection highlighting', 'evidence detail panel', 'hypothesis toggle; dashed hypothesis edges', 'shared-prerequisite expansion toggle', 'root blockers by downstream reach', 'accessible edge table'] },
  { route: '/roadmap', page: 'Root cause and remediation roadmap', datasets: ['rootCauseGroups', 'roadmap', 'ownershipMatrix', 'register'], features: ['23 groups with size, severity mix, programs, rules, owner, dependencies, resolution and closure evidence', 'five phases with recounted membership', '570 memberships = 569 unique records statement', 'ownership matrix'] },
  { route: '/diagrams, /diagrams/:id', page: 'Diagram explorer', datasets: ['diagramRecon', 'diagramGapImpact', 'diagrams (Mermaid, lazy)'], features: ['search', 'type, mapping and program filters', 'structural mapping, edge classification, gap-limited edges', 'Mermaid rendering with securityLevel strict, source view, hash check'] },
  { route: '/bmad', page: 'BMad governance', datasets: ['bmadStatus', 'bmadBlockers', 'governedRun', 'bmadBindings'], features: ['six workflows with agent, configured, authorization, execution, receipt, blockers', 'mandatory governance, F2 and F6 independence', 'approval/disclosure and isolation/runtime blockers', 'PORTREAD governed run', 'no control that changes any approval state'] },
  { route: '/testing', page: 'Testing and readiness', datasets: ['verificationResults', 'step23Regression', 'finalSummary', 'programRecon', 'readiness'], features: ['recorded harness, runtime, validation and readiness results', 'program integration counts', 'source-derived coverage and unverified behaviour', 'readiness drill-down by program', 'STEP-22 and STEP-23 run logs'] },
  { route: '/handover', page: 'Handover and evidence', datasets: ['finalSummary', 'register', 'rootCauseGroups', 'roadmap', 'bmadStatus', 'verificationResults'], features: ['architecture', 'reverse and forward artifact index with links', 'source provenance', 'reconciliation acceptance', 'remaining blockers and next actions', 'limitations'] },
  { route: '/evidence', page: 'Evidence validation', datasets: ['(all)'], features: ['per-file status and SHA-256 integrity', 'every cross-check', 'issues'] },
];
write('evidence-source-mapping.json', {
  contract: 'step-24/evidence-source-mapping',
  baseline_commit: m.baselineCommit,
  registry: 'forward/dashboard/evidence-sources.json',
  sources: manifest.sources.map((s) => ({ key: s.key, path: s.path, step: s.step, required: s.required, sha256: s.sha256, git_blob_head: s.git_blob_head, last_commit: s.last_commit })),
  collections: manifest.collections.map((c) => ({ key: c.key, dir: c.dir, files: c.files.length, load: c.load })),
  pages: PAGES.map((p) => ({ route: p.route, page: p.page, datasets: p.datasets.map((d) => ({ key: d, path: sha(d)?.path ?? (d === 'readiness' ? `${S22}/readiness/*.json` : d) })) })),
  primary_metric_sources: primary.map(([metric, , , , source]) => ({ metric, source })),
});

write('page-inventory.json', { contract: 'step-24/page-inventory', pages: PAGES.map(({ route, page, features }) => ({ route, page, features })) });

// ---- Architecture -----------------------------------------------------------------------------------
const pkg = JSON.parse(fs.readFileSync(path.join(DASH, 'package.json'), 'utf8'));
const dist = path.join(DASH, 'dist', 'assets');
const assets = fs.existsSync(dist) ? fs.readdirSync(dist).sort().map((f) => ({ file: f, bytes: fs.statSync(path.join(dist, f)).size })) : [];
const entry = assets.filter((a) => /^index-.*\.js$/.test(a.file)).reduce((t, a) => t + a.bytes, 0);
write('dashboard-architecture.json', {
  contract: 'step-24/dashboard-architecture',
  location: 'forward/dashboard/',
  stack: { framework: 'React 19 + TypeScript 5.6 (strict)', build: 'Vite 6', styling: 'Tailwind CSS 3 (class-based dark mode)', charts: 'Recharts 3', icons: 'lucide-react', routing: 'React Router 7 (HashRouter: works from any static folder)', graph: 'Cytoscape.js (lazy-loaded)', diagrams: 'Mermaid 11 (lazy-loaded, securityLevel strict)', tests: 'Vitest + Testing Library (jsdom); headless Edge/Chrome smoke test' },
  dependencies: pkg.dependencies,
  dev_dependencies: pkg.devDependencies,
  data_pipeline: [
    'evidence-sources.json names every committed file the dashboard may read (30 files + readiness/*.json + 65 Mermaid sources)',
    'scripts/sync-evidence.mjs copies them byte-for-byte into public/evidence/ and writes manifest.json (SHA-256, git blob at HEAD, last commit); only files committed at HEAD are copied',
    'src/evidence/loader.ts fetches each file, verifies its SHA-256 against the manifest, parses it, and records missing/invalid/mismatched datasets',
    'src/evidence/model.ts builds typed datasets, recounts every total from detailed records and cross-checks it against recorded summaries; a missing dataset yields null (an "evidence unavailable" state), never zero',
    'pages read only the model; nothing writes back to the repository',
  ],
  layers: {
    'src/evidence': 'contracts (types.ts), guards (check.ts), loader, model builder, React context',
    'src/lib': 'status vocabulary, formatting, table filter/sort/paginate/CSV, graph neighbourhoods, URL-state hooks',
    'src/components': 'layout, UI primitives, charts, controls (table, drawer, filters), graph canvas, Mermaid view',
    'src/pages': 'eleven pages plus evidence validation',
    tests: 'evidence, missing-data, table, graph and page tests',
    scripts: 'sync-evidence, evidence-report, smoke',
  },
  security: ['production Content-Security-Policy: default-src self, no inline scripts, no external origins', 'no network calls beyond the dashboard origin; no telemetry; no fonts or CDNs', 'Mermaid in strict mode without HTML labels', 'COBOL source paths shown as text, never fetched (restricted source is not committed)', 'CSV export neutralises spreadsheet formulas'],
  build_assets: { files: assets.length, total_bytes: assets.reduce((t, a) => t + a.bytes, 0), entry_bytes: entry, largest: [...assets].sort((a, b) => b.bytes - a.bytes).slice(0, 6) },
  evidence_bytes: manifest.totals.bytes,
});

// ---- Accessibility and performance (deterministic facts; measured runs are in regression-runs.jsonl) ----
const ix = index(m.graph!);
const views = m.graph!.nodes.map((n) => neighbourhood(ix, n.id, DEFAULT_VIEW));
write('accessibility-performance.json', {
  contract: 'step-24/accessibility-performance',
  accessibility: [
    { check: 'Landmarks and skip control', how: 'aside navigation, main region, skip-to-content button; focus moves to main on route change', verified_by: 'tests/pages.test.tsx (navigation via role=navigation)' },
    { check: 'Every control is labelled', how: 'label elements for search, selects and inputs; aria-label on icon buttons', verified_by: 'tests query controls by accessible name (getByLabelText / getByRole name)' },
    { check: 'Keyboard operation', how: 'all actions are buttons or links; sortable headers are buttons with aria-sort; drawer closes on Escape and restores focus', verified_by: 'tests/pages.test.tsx (keyboard Escape closes the gap drawer)' },
    { check: 'Status is never colour alone', how: 'every status badge has an icon and a text label; chart bars have axis labels and value labels', verified_by: 'component design; dataviz palette validator (see palette_validation)' },
    { check: 'Charts have a table view', how: 'every bar chart toggles to a captioned table', verified_by: 'charts.tsx BarList' },
    { check: 'Graph has a non-visual equivalent', how: 'the edge table lists every edge in the current view with confidence and evidence; selection works from the table', verified_by: 'tests/pages.test.tsx (hypothesis toggle asserted on the edge table)' },
    { check: 'Tables have captions and scoped headers', how: 'sr-only captions, th scope=col', verified_by: 'tests query tables by caption' },
    { check: 'Light and dark themes', how: 'system/light/dark switch; Tailwind dark variants; chart fills switch to dark steps', verified_by: 'headless Edge screenshots during STEP-24 (light, dark, 820px tablet)' },
    { check: 'Reduced motion', how: 'prefers-reduced-motion disables transitions and smooth scrolling', verified_by: 'index.css' },
  ],
  palette_validation: {
    tool: 'dataviz validate_palette.js',
    result: 'The fixed status colours (critical #d03b3b, serious #ec835a, warning #fab219, neutral #898781, good #0ca30c) fail the categorical gates (lightness band, chroma, warning-vs-serious separation); this is expected for a status palette.',
    mitigation: 'Status colours are never the only encoding: each bar is named on its axis, carries its value label and has a table view; each badge carries an icon and text.',
  },
  performance: {
    evidence_files_eager: m.validation.datasets.length,
    evidence_bytes_total: manifest.totals.bytes,
    mermaid_sources_lazy: manifest.collections.find((c) => c.key === 'diagrams')?.files.length ?? 0,
    lazy_chunks: ['cytoscape (dependency page only)', 'mermaid (diagram detail only)'],
    gap_table_page_sizes: [25, 50, 100, 'all (569)'],
    graph: {
      nodes: m.graph!.nodes.length,
      rendering: 'one focused neighbourhood at a time (default depth 2, node cap 120, shared prerequisites not expanded); never the full graph',
      default_view_max_nodes_over_all_focus_nodes: Math.max(...views.map((v) => v.nodes.length)),
      default_view_truncated_focus_nodes: views.filter((v) => v.truncated).length,
    },
    network: 'only same-origin requests for the evidence copies; no telemetry, fonts or CDNs',
  },
});

// ---- Build / test / smoke results, summarised from the recorded runs -----------------------------------
const runsFile = path.join(OUT, 'regression-runs.jsonl');
const runs = fs.existsSync(runsFile) ? fs.readFileSync(runsFile, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)) : [];
write('build-test-results.json', {
  contract: 'step-24/build-test-results',
  source: 'forward/reports/step-24/regression-runs.jsonl (commands in execution order)',
  runs: runs.map((r: { command: string; exit_code: number; result: string }) => ({ command: r.command, exit_code: r.exit_code, result: r.result })),
  smoke: fs.existsSync(path.join(OUT, 'smoke-results.json')) ? 'smoke-results.json' : 'not run',
});

// Determinism aid: hash of every file written above.
const written = ['metric-validation.json', 'evidence-source-mapping.json', 'page-inventory.json', 'dashboard-architecture.json', 'accessibility-performance.json', 'build-test-results.json'];
for (const f of written) console.log(`${f}  ${createHash('sha256').update(fs.readFileSync(path.join(OUT, f))).digest('hex').slice(0, 16)}`);
const mv = JSON.parse(fs.readFileSync(path.join(OUT, 'metric-validation.json'), 'utf8'));
console.log(`metric validation: ${mv.status}; ${mv.primary_metrics.filter((x: { agrees: boolean }) => x.agrees).length}/${mv.primary_metrics.length} primary, ${mv.cross_checks.agree}/${mv.cross_checks.total} cross-checks`);
