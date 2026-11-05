# REVFORGE Modernization Command Center

A read-only dashboard over the committed REVFORGE evidence: the STEP-22 reverse-forward reconciliation, the STEP-23 master gap register, BMad governance records and the reverse-engineering artifacts. It shows recorded engineering status. It does not run the harness, change approval states, or modify any report.

> COBOL-to-Java behavioral equivalence has not been established. The dashboard says so on every page where it matters, and never presents a build, test or "complete" classification as equivalence.

## Quick start

Requirements: Node.js 20 or later (the repository uses `~/.revforge/node`, Node 22) and Git. A browser is needed only to view the dashboard.

```bash
cd forward/dashboard
npm ci              # install the pinned dependencies (package-lock.json)
npm run dev         # copy the evidence, then serve on http://127.0.0.1:5180
```

| Command | What it does |
|---|---|
| `npm run evidence` | Copies the committed evidence into `public/evidence/` and writes `manifest.json`. Runs automatically before `dev`, `test` and `build`. |
| `npm run dev` | Development server on 127.0.0.1:5180. |
| `npm run typecheck` | Strict TypeScript check of the app, tests and scripts. |
| `npm test` | Vitest suite: evidence parsing and validation, metrics, filters, pagination, CSV export, graph, missing data, page rendering and navigation. |
| `npm run build` | Typecheck, then a production build into `dist/`. |
| `npm run preview` | Serves `dist/` on 127.0.0.1:5181. |
| `npm run smoke` | End-to-end smoke test of `dist/`: serves it, checks the CSP and every evidence hash, and renders 14 routes in headless Edge or Chrome if installed (`REVFORGE_SMOKE_BROWSER` overrides the path). |
| `npm run report` | Writes the STEP-24 structured evidence to `forward/reports/step-24/`. |

The production build uses relative paths and hash routing, so `dist/` can be served from any static folder. It has to be served over HTTP, not opened as a `file://` page, because it fetches the evidence files.

## Pages

| Route | Page |
|---|---|
| `#/` | Executive overview: primary KPIs, distributions, coverage by evidence kind, BMad status, evidence snapshot |
| `#/comparison` | Reverse vs forward: programs, paragraphs, statements, PERFORM edges, branches, loops, fields, records, copybooks, diagrams, JCL |
| `#/programs`, `#/programs/:id` | All 42 programs, filters, sorting, and per-program drill-down |
| `#/rules`, `#/rules/:id` | All 154 business rules, filters, and per-rule verification evidence |
| `#/gaps`, `#/gaps/:id` | The 569-record master gap register: filters, sorting, pagination, detail drawer and CSV export |
| `#/dependencies` | Dependency graph explorer (focused neighbourhoods, hypothesis toggle) |
| `#/roadmap` | 23 root-cause groups, five remediation phases, ownership matrix |
| `#/diagrams`, `#/diagrams/:id` | 65 reverse diagrams, Java mapping and Mermaid rendering |
| `#/bmad` | BMad governance: six workflows, blockers, PORTREAD governed run |
| `#/testing` | Recorded verification results and readiness by program |
| `#/handover` | Architecture, artifact index, provenance, blockers, limitations |
| `#/evidence` | Evidence validation: file integrity, cross-checks, issues |

Filters, sorting and pagination are kept in the URL, so any filtered view can be linked.

## Data pipeline

```
evidence-sources.json ──► scripts/sync-evidence.mjs ──► public/evidence/<repo path> + manifest.json
                                                              │
                         src/evidence/loader.ts  ◄────────────┘  (fetch, SHA-256 check, parse)
                                   │
                         src/evidence/model.ts   (typed datasets, recounts, cross-checks)
                                   │
                              src/pages/*         (read-only views)
```

- **Only committed evidence.** `evidence-sources.json` lists every file the dashboard may read. The sync script copies a file only if it is committed at `HEAD`. It records the file's SHA-256, its git blob and the commit that last changed it. It flags any working-copy file that differs from `HEAD`.
- **Integrity at load, fail-closed.** Each file is hashed in the browser (Web Crypto) and compared with the manifest *before* it is parsed. A file is loaded only if:
  - the manifest records a SHA-256 for it;
  - Web Crypto is available;
  - the digests match;
  - and it parses.

  Otherwise it is **rejected**: it never reaches the model, and the Evidence validation page shows the reason (mismatch, no recorded hash, or unverifiable).
- **Mermaid sources** are fetched only for paths the manifest lists and are rendered only after the same verification. An altered, unlisted or unverifiable diagram is refused, not shown.
- **What the check proves, and what it does not.** `npm run evidence` produces the manifest locally from the Git checkout. The browser check therefore proves that the served copies are consistent with that manifest. It does not authenticate the manifest, the repository or a deployment. That would need a separate trust mechanism, such as a signed release or a signed manifest, which this project does not have.
- **Recount and cross-check.** Totals are recomputed from the detailed records (programs, rules, gap records, paragraphs, statements, control flow, fields, records, copybooks, JCL jobs, diagrams, graph edges, roadmap memberships, BMad stages) and compared with the recorded summaries. The **Evidence validation** page lists every check.
- **No substitution.** If a required file is missing, unparseable or altered, its section shows an *evidence unavailable* state. A value is never replaced with zero or a sample.
- **No restricted source.** COBOL source paths are shown as text and never fetched, because the restricted checkout in `references/` is not committed. Generated Java (`forward/generated/`) is git-ignored and is referred to by path only.

To update the dashboard after new reports are committed, run `npm run evidence`, or any command that runs it automatically.

## Status vocabulary

| Tone | Used for |
|---|---|
| Green, shield icon | A recorded passing test or gate (source-derived verification, readiness pass). |
| Blue, shapes icon | Structural mapping: a Java element exists at the same identity. |
| Amber | Partial, or verified only up to a gap. |
| Red | Blocked, missing or failing. |
| Violet | Legacy equivalence: not established. |

Green is never used just because a Java file exists. Every status pairs its colour with an icon and a text label.

## Security and privacy

- The production build sets a Content-Security-Policy: same-origin only, no inline scripts, no external fonts, CDNs or telemetry.
- Mermaid runs with `securityLevel: 'strict'` and without HTML labels.
- CSV export prefixes cells that a spreadsheet would treat as formulas.
- `public/evidence/`, `dist/` and `node_modules/` are git-ignored.

## Project layout

```
forward/dashboard/
  evidence-sources.json     the evidence registry
  scripts/                  sync-evidence.mjs, evidence-report.ts, smoke.mjs
  src/evidence/             types, guards, loader, model, React context
  src/lib/                  status vocabulary, formatting, table/CSV, graph, hooks
  src/components/           layout, UI, charts, controls, graph canvas, Mermaid view
  src/pages/                the eleven pages and evidence validation
  tests/                    Vitest suites
```

The visual design adapts the earlier *Forward Engineering Dashboard* reference (dark navigation rail, slate page, white rounded cards, soft status pills). Its demonstration data and unrelated tabs were not reused.
