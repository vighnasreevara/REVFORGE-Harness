# Engineering handover and quality

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** what was handed over, under which conditions, what was verified at handover, and what quality fixes followed? The handover documents themselves are in [`forward/handover/`](../../handover/). Start with the [final handover checklist](../../handover/FINAL-HANDOVER-CHECKLIST.md).

## Reports

| Report | Descriptive name | Responsibility |
|---|---|---|
| [STEP-25](../STEP-25-FINAL-HANDOVER-ASSESSMENT.md) | final handover assessment | conditional engineering closure, quality gates, regression, coverage, BMad state, provenance |
| [Post-handover quality review](../POST-HANDOVER-QUALITY-REVIEW.md) | post-handover quality review | the fixes made after handover (dashboard fail-closed loading, CI) and their verification |
| [Git regression stabilization](../GIT-REGRESSION-STABILIZATION.md) | Git tracking and regression stabilization | the tracking policy and the regression repaired after `forward/` was committed |

## Evidence ([`step-25/`](../step-25/))

- [quality gates and closure](../step-25/quality-gates-and-closure.json) and [regression summary](../step-25/regression-summary.json)
- regression runs: [regression-runs.jsonl](../step-25/regression-runs.jsonl) and [clean-clone-runs.jsonl](../step-25/clean-clone-runs.jsonl)
- [repository integrity](../step-25/repository-integrity.json) and [source integrity](../step-25/source-integrity.json)
- [coverage](../step-25/coverage.json) and [gap register validation](../step-25/gap-register-validation.json)
- [BMad governance](../step-25/bmad-governance.json) and [dashboard validation](../step-25/dashboard-validation.json)
- [snapshot before](../step-25/snapshot-before.json) and [snapshot after](../step-25/snapshot-after.json)

**SHA-256-bound:**
- [`forward/handover/HANDOVER-MANIFEST.json`](../../handover/HANDOVER-MANIFEST.json) records hashes of the handover documents, of the STEP-20 to STEP-25 reports, of the BMad end-to-end and Git stabilization assessments, of key evidence files and of every `step-25/` file;
- `forward/tools/step25-final.py check` (also run in CI) verifies them.

**Related topics:** [source integrity](source-integrity-and-traceability.md) · [dashboard validation](dashboard-validation.md) · [master gap register](master-gap-register.md)
