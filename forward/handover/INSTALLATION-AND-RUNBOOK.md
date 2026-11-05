# Installation and runbook

## Three environments

What you can run depends on what you have. Do not copy restricted material into Git to make a pure checkout "work".

| | A. Pure Git checkout | B. Developer environment | C. Fully authorized modernization environment |
|---|---|---|---|
| Contains | committed source, reports, reverse artifacts, dashboard | A + restricted COBOL source root, `forward/runs/`, `forward/generated/`, local tools (JDK, Python, a browser) | B + DB2, CICS, platform services, a legacy COBOL runtime, signed authorizations, trust store, isolated runner and egress |
| Works | forward build, `doctor`, git-policy and backup tests, Java runtime library compile and `RuntimeTests`, dashboard (install, evidence, build, tests, smoke), STEP-25 audit (source checks report NOT_VERIFIABLE_HERE) | everything in this repository: full `npm test`, `pilot integrate`, `validate` and `readiness`, the source-integrity audit | governed BMad runs, G2–G8, equivalence verification, closing external-dependency gaps |
| Status at handover | verified in STEP-25 (clean clone) | verified in STEP-25 | **does not exist yet** |

## Requirements

- Git
- Node.js 20 or later (Node 22 was used)
- JDK 21: set `REVFORGE_JAVA_HOME`, for example `C:/Program Files/Microsoft/jdk-21…`
- Python 3 (3.12 was used), for `forward/tools/*.py`
- Optional:
  - Edge or Chrome, for the dashboard smoke test;
  - Claude Code with a Neo4j instance and the Cypher MCP server, for reverse engineering.
- For environment B:
  - `REVFORGE_COBOL_SOURCE_ROOT`, the authorized COBOL checkout;
  - the local run `forward/runs/FWD-20261031T172520Z-66b3`;
  - `forward/generated/java/`.

## Setup

```bash
git clone https://github.com/vighnasreevara/REVFORGE-Harness.git
cd REVFORGE-Harness/forward && npm ci && npm run build
cd dashboard && npm ci
```

On Windows, clone to a short path. The longest tracked path is about 180 characters, and the default limit is 260 (MAX_PATH).

## Everyday commands (from `forward/`)

| Purpose | Command |
|---|---|
| Environment check | `node dist/runtime/src/cli.js doctor` |
| Agent and skill drift | `node dist/runtime/src/cli.js sync-agents --check` |
| Contract validation | `node dist/runtime/src/cli.js validate` |
| Full tests | `npm test` (builds first; about 40–70 minutes; run with nothing else heavy) |
| Java runtime tests | `"$REVFORGE_JAVA_HOME/bin/java" -cp generated/java/app/classes revforge.cobol.testing.RuntimeTests` (after `pilot integrate`) |
| Integration build and tests | `node dist/runtime/src/cli.js pilot integrate` (B: rebuilds `generated/java/app/`, appends one event to the run record) |
| Conversion validation | `node dist/runtime/src/cli.js pilot validate --out generated/java/<PROGRAM>` |
| Source readiness | `node dist/runtime/src/cli.js pilot readiness --program <PROGRAM>` |
| BMad checks | `node dist/runtime/src/cli.js bmad doctor`; `bmad governance --scope programs:PORTREAD` (exit 3 = blocked, expected) |
| Workflow state | `node dist/runtime/src/cli.js workflow status` |
| Gap register re-validation | `python tools/step25-final.py audit` (read-only; writes `reports/step-25/` and the handover manifest) |

**Reverse engineering.** In Claude Code, configure `.mcp.json` from `.mcp.json.example`, point Agent 1 at the source root, and run `1_inventory_c` to `7_synthesis_c` in order. See the top-level `README.md`.

**Local converter.** `pilot run` performs synthetic pilots only. Real conversion (`pilot generate`, `pilot convert-app`) needs a program-scoped authorization, and new authorizations need BMad lifecycle evidence. See `forward/docs/PILOT-OPERATIONS.md`.

## Reports

Each STEP has a generator in `forward/tools/`: `step22-final.py`, `step23-gaps.py`, `step25-final.py`; the dashboard has `npm run report`. Historical generators rewrite their own report folders. Re-run them only intentionally, and compare the output with the committed version before committing.

## Backup and restore

```bash
node forward/tools/backup.js create --dest <folder outside the repo>
node forward/tools/backup.js verify <archive.tgz>
node forward/tools/backup.js restore-test <archive.tgz> [--checkout] [--build] [--test] [--cleanup]
```

The backup is code-only:
- It archives untracked, ignored and modified files, and lists committed files by git blob.
- It excludes run records, generated Java, COBOL, credentials, report exports and, since STEP-25, the dashboard's reproducible output (exclusion policy 2).
- Archives made under policy 1 still verify against their own rules.

Details are in `forward/docs/PROJECT-RECOVERY-OPERATIONS.md`.

## Troubleshooting

| Symptom | Cause and action |
|---|---|
| `git clone` fails with "Filename too long" | Use a short clone path or `git config core.longpaths true`. |
| A test reports `EXECUTION_FAILED` or `COMPILATION_FAILED` after about 300 s, with empty diagnostics | `javac`/`java` hit the 300 s subprocess limit under machine load. Re-run the suite alone (`node --test dist/tests/<suite>.test.js`), then the full suite with nothing else running. Do not raise the timeout. |
| Hash-bound evidence fails after checkout | Line endings: `.gitattributes` enforces LF. Re-checkout with LF. The one exception, `output/diagram/diagrams_artifact.json`, is marked `-text` and is checked out with its recorded CRLF bytes (see SOURCE-TRACEABILITY.md). Never edit hash-bound artifacts or recorded hashes by hand. |
| Dashboard shows "Evidence unavailable" | Run `npm run evidence`; the named file must be committed at `HEAD`. |
| `bmad governance` exits 3 | Expected: BMad live execution is blocked (see BMAD-GOVERNANCE.md). |
| `pilot readiness` exits 1 | Expected for 36 of 42 programs (failing checks recorded per program). |
| Source-integrity checks show NOT_VERIFIABLE_HERE | Environment A: configure `REVFORGE_COBOL_SOURCE_ROOT` (environment B). |
