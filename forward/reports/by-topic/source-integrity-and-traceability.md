# Source integrity and traceability

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** is the evidence tied to the exact COBOL source, reverse artifacts and repository state it claims? Does each result trace back to the permanent source IDs (`SYS-`, `FIL-`, `PATH-`, `PAR-`, `STMT-`, `REC-`, `FLD-`)?

## Reports

| Report | What it establishes |
|---|---|
| [STEP-22 final reconciliation](../STEP-22-FINAL-RECONCILIATION.md) | SHA-256 hashes of the reverse artifacts, the COBOL source and the generated Java tree, recorded as the reconciliation baseline |
| [Git regression stabilization](../GIT-REGRESSION-STABILIZATION.md) | the Git tracking policy (hand-written Java runtime tracked, generated Java ignored), fresh-clone results, and the regression it repaired |
| [STEP-9: COBOL evidence verification and isolation](../STEP-9-REPORT.md) | dependency-aware verification of requirement evidence against the COBOL source context; process isolation for Claude and BMad |
| [STEP-25 final handover assessment](../STEP-25-FINAL-HANDOVER-ASSESSMENT.md) | the source, repository and provenance checks at handover |

## Evidence

- [`step-22/source-integrity.json`](../step-22/source-integrity.json): the recorded source and artifact hashes. **SHA-256-bound:** later checks compare against it.
- [`step-25/source-integrity.json`](../step-25/source-integrity.json) and [`step-25/repository-integrity.json`](../step-25/repository-integrity.json): integrity results at handover.
- [`step-25/snapshot-before.json`](../step-25/snapshot-before.json) and [`step-25/snapshot-after.json`](../step-25/snapshot-after.json): repository snapshots taken before and after the STEP-25 audit.
- [`git-stabilization/`](../git-stabilization/): [tracking policy](../git-stabilization/tracking-policy.json), [integrity](../git-stabilization/integrity.json), [fresh-clone results](../git-stabilization/fresh-clone-results.json), [failure inventory](../git-stabilization/failure-inventory.json), and the regression runs.
- [`step-9/`](../step-9/): [context verification report](../step-9/context-verification-report.md), [application-level report](../step-9/application/context-verification-report.md), [approval readiness](../step-9/approval-readiness.json).

**Checked by:** `forward/tools/step25-final.py check` and the *Repository and report integrity* job in `.github/workflows/revforge-ci.yml`.

**Related topics:** [reverse–forward reconciliation](reverse-forward-reconciliation.md) · [backup and recovery](backup-and-recovery.md) · [engineering handover](engineering-handover-and-quality.md)
