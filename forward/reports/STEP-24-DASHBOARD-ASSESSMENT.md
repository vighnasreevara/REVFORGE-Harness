# STEP-24: Modernization Dashboard Assessment

**Status: COMPLETE.** All 16 acceptance criteria are met. One environmental test timeout in the forward regression is explained in [Regression](#6-regression).

| | |
|---|---|
| Deliverable | `forward/dashboard/`: *REVFORGE Modernization Command Center* (React, TypeScript, Vite) |
| Evidence baseline | `5d33425c19561db0db97dea1096c4029a51fffaf` (STEP-23 commit). STEP-22 was measured at `373fac1`. |
| Structured evidence | `forward/reports/step-24/` |
| Committed | In the STEP-24 finalization commit `feat: add evidence-backed REVFORGE modernization dashboard`, after the revalidation in [Finalization validation](#12-finalization-validation). Dashboard development itself committed nothing. |

> **COBOL-to-Java behavioral equivalence has not been established.** The dashboard states this on the overview, rule, program, testing and handover pages. It shows 0 of 42 programs and 0 of 154 rules as COBOL-equivalent, because those are the recorded values.

---

## 1. Architecture

The dashboard is a static single-page application with a read-only evidence pipeline. It has no server, no database and no network access beyond its own origin.

```
evidence-sources.json ──► scripts/sync-evidence.mjs ──► public/evidence/<repo path> + manifest.json
   (30 files + 42 readiness                  (copies only files committed at HEAD;
    results + 65 Mermaid sources)             SHA-256, git blob, last commit)
                                                              │
               src/evidence/loader.ts ◄───────────────────────┘  fetch, SHA-256 check against the manifest, parse
                         │
               src/evidence/model.ts     typed datasets; every total recounted from detail and cross-checked
                         │
                    src/pages/*           eleven pages plus evidence validation; nothing writes back
```

| Layer | Choice |
|---|---|
| Framework | React 19.1, TypeScript 5.6 (strict), Vite 6.3 |
| Styling | Tailwind CSS 3.4, class-based light and dark themes |
| Charts | Recharts 3.1: horizontal bars with value labels and a table view on every chart |
| Graph | Cytoscape.js 3.32, lazy-loaded; focused neighbourhoods, concentric layout |
| Diagrams | Mermaid 11.6, lazy-loaded, `securityLevel: 'strict'`, no HTML labels |
| Routing | React Router 7 (hash routing, so `dist/` works from any static folder) |
| Icons | lucide-react |
| Tests | Vitest 3.2 and Testing Library (jsdom), plus a headless Edge/Chrome smoke test |

All versions are pinned exactly in `package.json`, and `package-lock.json` locks the tree.

**Design reference.** The extracted *Forward Engineering Dashboard* reference (React 19, Vite, Tailwind, Lucide) was inspected but not executed. The dashboard adapts its layout: dark navigation rail `#1e2536`, slate page, white rounded cards, header chips and soft status pills. Its demonstration data, budget/story/agent tabs and "Live" indicator were not reused.

**Security.**
- The production build carries a Content-Security-Policy: same-origin only, no inline scripts, no external fonts, CDNs or telemetry.
- COBOL source paths are shown as text and never fetched.
- Generated Java is referenced by path only, because it is git-ignored.
- CSV export neutralises spreadsheet formulas.
- No secrets are read or embedded.

## 2. Pages and features

| Route | Page | Main features |
|---|---|---|
| `#/` | Executive overview | 10 KPIs read from the evidence; program, rule, severity and readiness distributions; coverage by evidence kind; BMad status; evidence date, source report and baseline commit; the equivalence statement |
| `#/comparison` | Reverse vs forward | 25 measures, each numerator/denominator, labelled as *structural mapping*, *implemented*, *test execution*, *source-derived verification* or *legacy equivalence*; breakdowns; JCL jobs. No combined percentage. |
| `#/programs`, `#/programs/:id` | Program explorer | All 42 programs. Search; classification, readiness and severity filters; sorting by gaps, rules or validation. Detail shows provenance, coverage, rules, gaps, dependencies, tests, readiness checks and gates, and next actions. PORTREAD and PROGNAME are *complete under current criteria*; POSUPDT is *missing (empty source)*. |
| `#/rules`, `#/rules/:id` | Business rules | All 154 rules. Search; status, program, category, linked-gap and gap-ID filters. Detail shows description, COBOL and Java references, scenarios and outcomes, related gaps and remaining requirements. Includes the Java-verified vs COBOL-equivalent explanation. |
| `#/gaps`, `#/gaps/:id` | Master gap register | All 569 OPEN records. Search; filters by category, severity, priority, owner, program, root cause, inventory and rule; sorting; pagination (25/50/100/all); detail drawer with full provenance; CSV export of the filtered set. Read-only. |
| `#/dependencies` | Dependency analysis | Neighbourhoods with depth, direction, relation and node-cap controls; node search; zoom, pan and fit; selection highlighting; evidence panel; hypothesis toggle (hypotheses drawn dashed); root blockers ranked by downstream reach; accessible edge table |
| `#/roadmap` | Root cause and roadmap | 23 groups with size, severity mix, programs, rules, owner, dependencies, resolution and closure evidence; phases A–E with recounted membership; "570 memberships = 569 unique records"; ownership matrix |
| `#/diagrams`, `#/diagrams/:id` | Diagram explorer | All 65 diagrams. Type, mapping and program filters; edge classification; gap-limited edges; Mermaid rendering with a source view and hash check |
| `#/bmad` | BMad governance | Six workflows with agent, configured, authorization, execution, receipt, gates and blockers; mandatory governance; F2 and F6 independence; grouped blockers; PORTREAD governed run BGR-0004. No control changes any approval state. |
| `#/testing` | Testing and readiness | Recorded harness, runtime, validation and readiness results; integration counts; source-derived coverage; unverified behaviour; readiness drill-down; STEP-22 and STEP-23 run logs |
| `#/handover` | Handover and evidence | Architecture, artifact index with links, provenance, reconciliation acceptance, blockers and next actions, limitations |
| `#/evidence` | Evidence validation | Per-file status and SHA-256 integrity; all cross-checks; issues |

Filter, sort and page state is kept in the URL, so filtered views can be linked. The full list is in `step-24/page-inventory.json`.

## 3. Evidence consumed

All files are committed at the baseline commit, and each is copied byte-for-byte and hash-verified at load.

| Group | Files |
|---|---|
| STEP-22 | `final-summary`, `bmad-governance-status`, the `program`, `business-rule`, `diagram`, `paragraph`, `statement`, `control-flow`, `field`, `record`, `copybook`, `jcl` and `dependency` reconciliations, `verification-results`, `readiness/*.json` (42) |
| STEP-23 | `master-gap-register`, `gap-summary`, `dashboard-gap-summary`, `root-cause-groups`, `dependency-graph`, `program-`, `business-rule-` and `diagram-gap-impact`, `ownership-matrix`, `remediation-roadmap`, `bmad-governance-blockers`, `validation-results`, `regression-runs.jsonl` |
| BMad | `bmad-end-to-end/portread-governed-run.json`, `integrations/bmad/bindings.json` |
| Reverse | `output/rules/rules_artifact.json` (rule descriptions), `output/diagram/diagrams/*.mmd` (65, loaded on demand) |

Totals: 137 files and 6.3 MiB. None are missing, uncommitted or modified. The page-to-source mapping is in `step-24/evidence-source-mapping.json`.

## 4. Metric validation

The adapter recounts every total from the detailed records and compares it with the recorded summary. `npm run report` also compares the dashboard's values with values read directly from the reports, independently of the adapter.

| Result | |
|---|---|
| Primary metrics | **18/18 agree** |
| Coverage metrics | **25/25 agree** |
| Cross-checks | **114/114 agree** |
| Validation issues | 0 |
| Evidence files hash-verified | 72/72 eager; 65 Mermaid sources verified when opened |

| Metric | Dashboard | Report |
|---|---|---|
| COBOL programs | 42 | 42 |
| Java present | 41 | 41 |
| Complete / partial / missing | 2 / 39 / 1 | 2 / 39 / 1 |
| Business rules | 154 | 154 |
| Rules Java-verified / to gap / unreachable / blocked | 67 / 15 / 40 / 32 | 67 / 15 / 40 / 32 |
| Open gap records | 569 | 569 |
| Readiness passing | 6 | 6 |
| COBOL-equivalent programs | 0 | 0 |
| Paragraphs mapped / executed | 390/402, 95/402 | same |
| Statements mapped / executed | 1,337/1,936, 414/1,936 | same |
| PERFORM, branches, loops | 397/524, 190/254, 26/32 | same |
| Fields, records | 966/1,009, 196/231 | same |
| Graph nodes / edges | 705 / 877 (794 evidenced, 38 by text, 45 hypotheses, no cycles) | same |
| Diagrams | 65; 60 comparable; 912 edges: 639 structural, 162 gap-limited, 80 unassessable, 31 not in Java | same |
| Roadmap | 570 memberships, 569 unique (MGR-0566 in B and D) | same |
| BMad | 6 configured, 0 authorized, 0 executed, 0 receipts, 6 blocked | same |

Two consistency checks were added during development:
- **Copybooks:** 19/19 counts copybooks used by a program, out of 25 in total (6 are not used).
- **Gap-limited edges:** the recorded 162 equals the sum of the per-diagram edge classes that end at or pass through a gap.

**Missing-data behaviour** is tested:
- A missing, malformed or altered dataset is reported, and its section shows *evidence unavailable*.
- Tampering with `gap-summary.json` fails the SHA-256 check and the recount.
- No value is ever replaced with zero or sample data.

## 5. Build and tests

| Check | Result |
|---|---|
| `npm run evidence` (twice) | 137 files; manifest byte-identical across runs |
| `npm run typecheck` | no errors |
| `npm test` (Vitest) | **40/40 passed** in 5 files: evidence 13, missing data 5, table 6, graph 3, pages 13 |
| `npm run build` | succeeds; 45 assets; entry chunk 379 KB; Mermaid and Cytoscape split into lazy chunks |
| `npm run smoke` | **20/20 passed**: preview server; CSP present; no external scripts; all 137 served files match their SHA-256; 14 routes rendered in headless Edge, including the Mermaid SVG and the Cytoscape canvas |
| `npm run report` (twice) | STEP-24 JSON byte-identical across runs |

The frontend tests cover:
- evidence parsing and validation, and summary metrics;
- program and rule classifications, gap totals, gap filtering and pagination;
- the dependency hypothesis toggle and BMad blocked status;
- readiness figures, missing datasets, navigation through all 12 pages, CSV export, and the detail drawer with Escape.

## 6. Regression

The existing forward regression ran sequentially after the dashboard work. It is recorded in `step-24/regression-runs.jsonl`.

| Check | Result |
|---|---|
| `npm run build` | no errors |
| `doctor` | OK (24 OK, 0 FAIL) |
| `sync-agents --check` | 0 out of sync |
| `bmad doctor` | OK, bmad-method 6.12.4, 6 bindings valid |
| `bmad governance --scope programs:PORTREAD` | `BMAD_BLOCKED`, exit 3 (expected) |
| Java `RuntimeTests` | **34/34** |
| `npm test` (full run 1) | **411/412**. The one failure is environmental; see below. |
| `step15.test.js` rerun on its own | **6/6**; SYNVAL01 passed in 1.9 s with a real `javac -Werror` compile |
| `npm test` (full run 2) | **412/412** (68 minutes) |
| `git status` | only `forward/dashboard/`, `forward/reports/step-24/` and this report are new; no tracked file is modified |

**The 411/412 failure is environmental.**
- **What failed:** test *SYNVAL01 converts, compiles with -Werror…* returned `COMPILATION_FAILED` with empty diagnostics after 428 s.
- **Why that points to a timeout:** the pilot runs `javac` with a 300 s timeout (`runtime/src/pilot/pilot.ts`). A killed compiler produces no diagnostics. The machine was heavily loaded, and the full suite took 64 minutes.
- **Not reproducible:** on its own the suite passes 6/6 in 18 s, and a second full sequential run passed **412/412**.
- **Not caused by STEP-24:** STEP-24 changed nothing in the forward runtime, converter, tests or Java.
- **Seen before:** STEP-23 hit the same pattern in `step11` (`EXECUTION_FAILED` after a 300 s `java` timeout). It passed when rerun, and a full rerun gave 412/412.
- **Policy:** no test or timeout was changed to hide the failure.

## 7. Accessibility and performance

- **Accessibility:**
  - landmarks, a skip-to-content control, and focus moved to the page on navigation;
  - labelled controls, and sort headers that are buttons with `aria-sort`;
  - a dialog that closes on Escape and restores focus;
  - captioned tables, a table view for every chart, and an edge table as the graph's non-visual equivalent;
  - every status shown with an icon and text, never colour alone;
  - light, dark and system themes, and reduced-motion support.
- **Colour:** checked with the dataviz palette validator. The fixed status palette does not pass categorical colour-vision gates on its own (warning vs serious). That is why labels and tables carry every value.
- **Visual checks:** screenshots in headless Edge at 1440 px (light and dark) and 820 px (tablet). These led to two fixes: the graph switched from a breadthfirst to a concentric layout and stopped expanding shared prerequisites, and gap-register rows were tightened.
- **Performance:**
  - 72 evidence files are loaded once, and 65 diagram sources on demand.
  - Tables paginate: 569 gap records at 25, 50, 100 or all per page.
  - The graph is never drawn whole. The default view is depth 2 capped at 120 nodes; across all 705 focus nodes only one default view hits the cap, and it says so.
  - Cytoscape and Mermaid load only on their pages.
  - No telemetry or third-party requests.

Details are in `step-24/accessibility-performance.json`.

## 8. Known limitations

The full list is in `step-24/limitations-and-step25.json`.

1. The dashboard shows recorded results, not live CI. New results appear only after they are committed and `npm run evidence` is rerun.
2. COBOL source and generated Java are not committed, so the dashboard shows their paths, hashes and IDs, not their contents.
3. Source links point to the evidence baseline commit recorded in the manifest, so they resolve only once that commit is pushed. In a fresh checkout the baseline is that checkout's `HEAD`.
4. The dependency graph is explored by neighbourhood; truncation is always stated.
5. Mermaid rendering under the production CSP was verified in a real browser for sample diagrams, not for all 65 individually.
6. Accessibility was verified structurally and by tests. No automated WCAG audit or screen-reader session was run.
7. The dashboard must be served over HTTP (`npm run preview`, or any static server).
8. `forward/tools/backup.js` excludes `forward/node_modules`, `forward/dist` and `forward/runs`, but not the dashboard's ignored `node_modules`, `dist` or `public/evidence`. A backup taken with them present would archive those reproducible files. Tests are unaffected. `backup.js` was not changed in STEP-24.

The engineering limitations the dashboard reports are unchanged:
- no legacy runtime equivalence;
- missing source and copybooks;
- DB2 and CICS dependencies;
- platform services;
- business SME decisions;
- BMad authorization and live-execution prerequisites;
- unverified data and runtime semantics.

## 9. STEP-25 handover tasks

1. ~~Commit STEP-24~~: done in the finalization commit (dashboard source, `package-lock.json`, `forward/reports/step-24/`, this report).
2. Decide where the dashboard is served for the handover audience, and whether the evidence may leave the local environment.
3. Add `npm ci`, `npm test`, `npm run build` and `npm run smoke` for the dashboard to the project's CI.
4. Rerun `npm run evidence` and `npm run report` whenever new reports are committed.
5. Have the project owner assign named owners to the role-based owners, including the 28 `OWNER_REVIEW_REQUIRED` records.
6. Plan remediation phases A–E. Dates, budgets and resources are not in the evidence and are not assumed.
7. Resolve the BMad prerequisites before any governed run: G2 approval, a signed disclosure authorization, a provider egress component, a runner inside the isolation boundary, and an F6 receipt.
8. Optional: an automated accessibility audit, a browser render of all 65 diagrams, and a screen-reader pass.
9. Decide whether `backup.js` should also exclude the dashboard's ignored folders (limitation 8).

## 10. Running the dashboard

```bash
cd forward/dashboard
npm ci
npm run dev          # http://127.0.0.1:5180
# or
npm run build && npm run preview   # http://127.0.0.1:5181
npm test             # frontend tests
npm run smoke        # end-to-end smoke test of dist/
npm run report       # refresh forward/reports/step-24/
```

## 11. Integrity of this step

- No COBOL source was changed or read, and no Java was regenerated.
- No Java business logic, rule identity, gap identity or historical report was changed.
- BMad governance, approval gates, trust stores, isolation and generation settings are unchanged; no receipts were fabricated.
- No source was sent to an external service.
- No test was weakened. The dashboard is read-only and reads only committed evidence.

## 12. Finalization validation

Before the STEP-24 commit, everything was rerun sequentially on the baseline `5d33425`, with the STEP-24 files uncommitted. Each run is recorded with the `finalization:` prefix in `step-24/regression-runs.jsonl`.

| Check | Result |
|---|---|
| `npm ci` (lockfile) | 400 packages, exit 0 |
| `npm run build` (evidence copy, strict `tsc`, Vite) | 137 files, none missing or modified; build succeeds |
| `npm test` | **40/40** |
| `npm run smoke` | **20/20**; output byte-identical to `smoke-results.json` |
| `npm run report` | 18/18 primary, 25/25 coverage, 114/114 cross-checks; the six deterministic STEP-24 files are byte-identical |
| Forward `npm run build` | no errors |
| `doctor` | OK, 24 OK, 0 FAIL |
| `sync-agents --check` | 21 entries in sync, 0 other |
| `bmad doctor` | OK |
| `bmad governance --scope programs:PORTREAD` | `BMAD_BLOCKED`, exit 3 (expected) |
| Java `RuntimeTests` | **34/34** |
| Forward `npm test` | **412/412** (42 minutes) |

The STEP-24 files were also scanned before staging: no secrets (using the backup tool's own patterns), no absolute local paths, no file over 500 KB, LF line endings. The run log's one CRLF line, left by a Windows append, was normalized; no content changed. `node_modules/`, `dist/` and `public/evidence/` stay ignored and are recreated by `npm ci` and `npm run evidence`.

