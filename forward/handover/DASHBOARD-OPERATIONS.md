# Dashboard operations

The *REVFORGE Modernization Command Center* (`forward/dashboard/`) is a read-only React application over the committed evidence. Full details are in `forward/dashboard/README.md` and `forward/reports/STEP-24-DASHBOARD-ASSESSMENT.md`.

## Run it

```bash
cd forward/dashboard
npm ci                              # pinned dependencies from package-lock.json
npm run dev                         # http://127.0.0.1:5180  (copies the evidence first)
npm run build && npm run preview    # production build, http://127.0.0.1:5181
```

It needs Node.js 20+ and Git: the evidence copy reads files committed at `HEAD`. It must be served over HTTP. It makes no network request beyond its own origin.

## Pages

Overview, Reverse vs forward, Programs (42), Business rules (154), Master gap register (569), Dependency analysis (705 nodes), Root cause and roadmap, Diagrams (65), BMad governance, Testing and readiness, Handover and evidence, Evidence validation.

## Refreshing after new reports

1. Commit the new or changed reports. Only committed files are shown.
2. `npm run evidence` copies them and writes `public/evidence/manifest.json` with SHA-256 hashes, git blobs and last commits. `dev`, `test` and `build` run it automatically.
3. Check the **Evidence validation** page (`#/evidence`): every file should be hash-verified, and every cross-check should agree.
4. Optionally run `npm run report` to refresh `forward/reports/step-24/`. To check without overwriting, set `REVFORGE_REPORT_OUT=<folder>` (added in STEP-25).

A file listed in `evidence-sources.json` but missing, unparseable or altered is shown as *evidence unavailable*, never as zero.

## Verify it

| Command | Checks |
|---|---|
| `npm run typecheck` | strict TypeScript |
| `npm test` | 40 tests: evidence integrity, metrics, filters, pagination, CSV, graph, missing data, pages |
| `npm run smoke` | after `build`: serves `dist/`, checks the CSP and every evidence hash, renders 14 routes in headless Edge or Chrome |

## What it never does

- It never changes reports, approvals, gaps or BMad state.
- It never claims COBOL equivalence or BMad execution.
- It never sends data anywhere.
- It never shows restricted COBOL or generated Java contents: it shows their paths, hashes and IDs only.
