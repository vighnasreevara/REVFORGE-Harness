# Forward-engineering reports (STEP 1)

`plan` writes one run directory per execution under `forward/runs/<run-id>/` (Git-ignored). Run IDs have the form `FWD-<UTC timestamp>-<4 hex>`, and `forward/runs/LATEST` names the most recent run. Every JSON report is validated against its contract in `forward/contracts/output/` before it is written. If a report does not satisfy its contract, the run stops and the report is not written.

All STEP 1 reports have `status: "draft"`. They are planning material derived from the reverse-engineering artifacts. They have not been reviewed by an SME, and the forward runtime performs no live Neo4j verification.

| File | Contract | Content |
|---|---|---|
| `baseline_manifest.json` | `output/baseline-manifest` | Git branch, commit and dirty state; SHA-256, agent version and run IDs of every reverse input; combined hashes of the per-program logic and raw-structure files; the `source_runs` table that run-local IDs point to; COBOL source availability; Neo4j verification results recorded upstream, attributed and never presented as live checks. |
| `program_inventory.json` | `output/program-inventory` | Programs discovered from the inventory and joined by File ID with parser, logic, rules, gaps and diagrams; copybooks and other include members; JCL jobs; dependency edges; unresolved edges; coverage mismatches. |
| `evidence_packets/<FILE_ID>__<PROGRAM>.json` | `output/evidence-packet` | One per selected program: permanent identity, parse and logic status, dependencies, data records, implemented rules and rules in scope through a copybook (each with confidence, SME flag and evidence class), direct and inherited gaps with their expanded item IDs, supporting diagrams, and a readiness assessment. |
| `rule_summary.json` | `output/rule-summary` | Every business rule as a run-local reference, with counts by category, confidence and evidence class. |
| `gap_summary.json` | `output/gap-summary` | Every gap, with each grouped gap expanded into items (`GAP-NNN#NN`); the permanent and catalogue IDs extracted from each item; a reference status (`permanent_id`, `name_or_line_only`, `catalogue_only`, `none`); and the assumptions. |
| `decision_backlog.json` | `output/decision-backlog` | Open decisions (`DEC-NNNN`, local to the run): source access, gap resolutions (critical and high, or SME-flagged), rule confirmations and assumption confirmations. Decisions for critical gaps are blocking. |
| `readiness_report.json` / `.md` | `output/readiness-report` | Overall readiness (`not_ready`, `conditionally_ready` or `ready`) with its reasons, the checks, per-program readiness (`blocked`, `needs_sme_decision` or `design_candidate`) with blockers and cautions, and source availability. |

## Identifier policy

- **Permanent source IDs** (`SYS-…`, `…-FIL-NNNN`, `…-PATH-NNNN`, `…-SEC-`, `…-PAR-`, `…-STMT-`, `…-REC-`, `…-FLD-`) are copied unchanged. A `null` recorded upstream stays `null`.
- **Catalogue IDs** (`BR-`, `RS-`, `GAP-`, `ASM-`, …) are run-local. They always appear as `{ "id", "scope": "run-local", "source_run" }`, where `source_run` is a key in the manifest's `source_runs` (artifact, agent version, generation time, SHA-256).
- **Evidence classes** follow the reverse Synthesis agent's rule:
  - **confirmed**: confirmed or high confidence with complete evidence.
  - **inferred**: medium confidence.
  - **uncertain**: low confidence, partial evidence, SME review required, or dead code.
- **Diagrams** are supporting evidence only.

## Readiness rules

A program is **blocked** in any of these cases:
- it has no parser or logic entry;
- its parse or logic status is `empty`, `failed` or `skipped`;
- a critical gap names it directly.

It **needs an SME decision** if it has any of these:
- unresolvable paths or unresolved IDs;
- rules flagged for SME review or with uncertain evidence;
- high-severity gaps;
- unresolved call or include references;
- a duplicate Program ID;
- a non-`VALID` upstream verdict;
- a critical or high gap inherited from an included copybook.

Otherwise it is a **design candidate**.

The overall status is **`ready`** only when all of the following hold:
- every selected program is a design candidate;
- no check failed or warned;
- no blocking decision is open;
- the original COBOL source is available.

## Test file names in historical reports

The STEP reports and their machine evidence refer to the forward test files by their historical names (`step1.test.ts` to `step25.test.ts`), because they record what ran at the time. They are left unchanged. The files now have descriptive names; see [`docs/TEST-FILE-RENAME-MAP.md`](../docs/TEST-FILE-RENAME-MAP.md) for the mapping and [`tests/README.md`](../tests/README.md) for what each file covers.
