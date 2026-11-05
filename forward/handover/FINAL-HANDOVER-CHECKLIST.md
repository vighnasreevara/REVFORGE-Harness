# Final handover checklist

Status values:
- **Done:** completed and verified.
- **Finding:** completed, with an issue recorded.
- **Owner:** needs a decision or action outside engineering.
- **Not done:** not possible yet.

## Engineering handover

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Architecture documented (8 diagrams, all rendered with Mermaid 11.6) | Done | ARCHITECTURE.md |
| 2 | Reverse engineering documented | Done | REVERSE-ENGINEERING.md |
| 3 | Forward engineering and coverage documented | Done | FORWARD-ENGINEERING.md, `reports/step-25/coverage.json` |
| 4 | BMad governance and blockers documented | Done | BMAD-GOVERNANCE.md, `reports/step-25/bmad-governance.json` |
| 5 | COBOL sources present and authorization hashes match (83/83, 82/82; INQSET.bms has no recorded hash, disclosed) | Done (environment B) | `reports/step-25/source-integrity.json` |
| 6 | Reverse artifacts unchanged, also in a fresh checkout | Done: the CRLF-bound hash of `diagrams_artifact.json` was found and corrected (byte-exact, staged); fresh checkout 11/11; G0 PASS | SOURCE-TRACEABILITY.md, TESTING-AND-VERIFICATION.md |
| 7 | Rule (154) and statement (1,936) identities unchanged | Done | `source-integrity.json` |
| 8 | Generated Java unchanged (145 sources); hand-written runtime tracked (20); generated Java ignored | Done | `source-integrity.json`, `repository-integrity.json` |
| 9 | Master gap register intact (569 OPEN; 15/15 checks) | Done | `reports/step-25/gap-register-validation.json` |
| 10 | Dashboard validated (40/40, 20/20, 18/25/114 metrics) | Done | TESTING-AND-VERIFICATION.md |
| 11 | Forward regression (418/418, runtime 34/34, validate 41/42, readiness 6/42) | Done | `reports/step-25/regression-runs.jsonl` |
| 12 | Pure-checkout reproducibility (environment A) and repaired fresh clone | Done | `reports/step-25/clean-clone-runs.jsonl` |
| 13 | Backup excludes reproducible dashboard output; restore still verified | Done | `tools/backup.js` (policy 2), `tests/step25.test.ts` |
| 14 | Handover manifest with SHA-256 of every referenced file | Done | HANDOVER-MANIFEST.json |
| 15 | STEP-25 assessment | Done | `reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md` |
| 16 | Commit and push of STEP-25 | **Not done**: files are staged for review. Until committed, the staged correction under `output/` makes doctor warn and 4 protection tests fail in the developer tree, by design | — |

## Owner decisions and external requirements

| # | Item | Status | Who |
|---|---|---|---|
| 17 | Review and commit the staged byte-preservation correction (`.gitattributes` `-text` exception + CRLF blob) | Owner | Project owner |
| 18 | Name people for the role-based owners; resolve the 28 OWNER_REVIEW_REQUIRED records | Owner | Project owner |
| 19 | Provide the missing source members, paragraphs and copybooks; correct invalid source (phase A) | Owner | COBOL maintainer / source owner |
| 20 | Signed business decisions (108 records) | Owner | Business SME |
| 21 | DB2, CICS, legacy environment definitions, platform services (phase B) | Owner | DB2 and CICS administrators; Platform engineering |
| 22 | Legacy COBOL runtime or captured executions for equivalence (MGR-0566) | Owner | QA / independent verification; Platform engineering |
| 23 | BMad prerequisites: trust store, signed disclosure (ADA-8154d6398d4d is unsigned and expires 2026-11-06T20:45:24Z), G2 for the exact scope, F6 receipt, isolated runner, egress, live enablement, generation authorization | Owner | Data owner; Security / authorization approver; Platform engineering |
| 24 | Production replacement criteria (functional, performance, operations, cut-over) | Not done | Project owner |
| 25 | CI for the forward harness and the dashboard | Not done | Project owner / Platform engineering |

## Classification

| Classification | Assigned |
|---|---|
| ENGINEERING_HANDOVER_COMPLETE | yes (the integrity finding of item 6 is corrected and verified; the correction awaits commit) |
| CONDITIONAL_ENGINEERING_CLOSURE | yes |
| NOT_PRODUCTION_READY | yes |
| LEGACY_EQUIVALENCE_NOT_ESTABLISHED | yes |
