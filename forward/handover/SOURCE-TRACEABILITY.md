# Source traceability and integrity

## Permanent IDs

The reverse Agents 1–3 register every source element in the Neo4j registry and give it a permanent ID. Later agents and the whole forward harness copy these IDs unchanged. They never create or repair one.

| Element | Example | Created by |
|---|---|---|
| System | `SYS-PORTFOLIO-001` | Agent 1 |
| File / Path | `SYS-PORTFOLIO-001-FIL-0070` / `…-PATH-0070` | Agent 1 |
| Section / Paragraph | `…-FIL-0042-PAR-0001` | Agent 2 |
| Statement | `SYS-PORTFOLIO-001-FIL-0042-STMT-000001` | Agent 2 |
| Record / Field | `…-FIL-0042-FLD-000011` | Agent 3 |

Catalogue IDs are run-local. Their binding to the exact reverse run is recorded through the artifact SHA-256s in the forward baseline manifest:
- `BR-nnn` (rules) and `GAP-…` (gaps) from the reverse run;
- `MGR-nnnn` (master register) from the forward reports.

## The trace chain

**COBOL line → statement ID → paragraph ID → business rule → requirement / data contract → Java method and statement → source-derived scenario → reconciliation → gap record.**

| Link | Recorded in |
|---|---|
| Statement and paragraph to Java | `forward/reports/step-22/statement-reconciliation.json`, `paragraph-reconciliation.json`: 1,337 of 1,936 statements and 390 of 402 paragraphs mapped |
| Rule to Java and tests | `business-rule-reconciliation.json`: COBOL `file:line`, Java `file:line`, scenarios and outcomes |
| Field and record to Java | `field-reconciliation.json`, `record-reconciliation.json` |
| Diagram edge to Java | `diagram-reconciliation.json` |
| Gap to source | `forward/reports/step-23/master-gap-register.json`: `source_path`, `source_line`, `source_identity`, `source_sha256`, `evidence_sha256`, `source_reference` |

## Integrity results (STEP-25 audit)

From `forward/reports/step-25/source-integrity.json`, produced by `python forward/tools/step25-final.py audit`:

| Check | Result | Needs |
|---|---|---|
| Inventoried source files present | 83/83 | restricted source (environment B) |
| Recorded authorization hashes match | 82/82 | restricted source |
| File without a recorded authorization hash | 1: `src/maps/INQSET.bms` (BMS map, other-file registry), disclosed | committed files |
| Program sizes match the inventory | 42/42 | restricted source |
| Sources unchanged since STEP-22 | 83/83 | restricted source |
| Reverse artifacts unchanged | 11/11 against the STEP-22 hashes and 11/11 against the run baseline manifest, in the developer tree **and in a fresh checkout** (after the correction below) | committed files / local run |
| Git blobs match the recorded hashes | 11/11 after the correction (was 10/11) | committed files |
| Generated Java unchanged | 145 program sources, tree `d31fac95…` as recorded | local generated Java |
| Business-rule identities | 154, identical in the reverse artifact, STEP-17, STEP-22 and STEP-23 | committed files |
| Statement identities | 1,936, all unique, all traced in STEP-22 | committed files |
| Hand-written Java runtime | 20 files tracked in Git; generated Java git-ignored | committed files |

### Finding and correction: one reverse artifact was hash-bound to CRLF bytes

**Finding (STEP-25 clean-clone check).** `output/diagram/diagrams_artifact.json` was committed with LF line endings (`* text=auto eol=lf`). Its SHA-256 `bde93ef6400a7317…`, the value bound by STEP-22, the forward run baseline manifest (790,963 bytes) and seven other committed reports, is of its CRLF bytes. A fresh checkout therefore got `7154d49b…`, and G0 against the existing run failed:

> stale baseline: output/diagram/diagrams_artifact.json (baseline bde93ef6400a…, now 7154d49b225f…)

**Exact recovery.** Converting every LF of the committed blob to CRLF reproduces `bde93ef6…` byte-for-byte, equal to the developer working copy:
- 26,381 CRLF line endings; no lone CR or LF;
- JSON structurally identical.

No recorded hash or manifest was changed, and no re-baseline was needed.

**Correction.**
- **One line in `.gitattributes`:** `output/diagram/diagrams_artifact.json -text` (no end-of-line conversion for this single file; normalization stays on for the rest of the repository).
- **The artifact:** re-staged with `git add --renormalize`, so its blob now holds the exact CRLF bytes.
- **Verified in throwaway clones** with identical object IDs:
  - a fresh checkout reproduces `bde93ef6…`;
  - `git status` is clean;
  - G0 passes ("11 inputs and per-program file sets match the recorded SHA-256 values");
  - the STEP-25 audit reports 0 failures.

In a pure Git checkout (environment A), the checks that need the restricted source, the local run or the generated Java report `NOT_VERIFIABLE_HERE`. They are never reported as passed.
