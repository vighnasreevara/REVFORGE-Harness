# COBOL-to-Java conversion

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** how was COBOL converted to Java (the local deterministic converter, the engineering gates, authorization), what was generated, and how complete is it? Generated Java lives in the git-ignored `forward/generated/java/` and is not linked here.

## Reports (in the order the work happened)

| Report | Descriptive name | Responsibility |
|---|---|---|
| [STEP-11](../STEP-11-REPORT.md) | architecture readiness and synthetic conversion pilot | the architecture inventory, the RTNCDE00 modernization plan, the isolated synthetic pilot |
| [STEP-14](../STEP-14-REPORT.md) | source readiness and conversion prioritisation | the SOURCE_READINESS and CONVERSION_VALIDATION gates; PORTVALD chosen and prepared |
| [STEP-15](../STEP-15-REPORT.md) | local converter completion | the converter extended to every construct PORTVALD uses, proven on synthetic programs |
| [STEP-16](../STEP-16-REPORT.md) | first real generation (PORTVALD) | program-scoped authorization, generation, compilation, review of the test cases |
| [STEP-17 final report](../STEP-17-FINAL-REPORT.md) | full-application conversion | the integrated Java application and what was not converted |
| [STEP-17 functional assessment](../STEP-17-FUNCTIONAL-ASSESSMENT.md) | functional completeness assessment | rule-level test status (see [business-rule verification](business-rule-verification.md)) |
| [STEP-20](../STEP-20-REMEDIATION-ASSESSMENT.md) | gap remediation and converter improvements | converter defects fixed, per-program readiness before and after |
| [Application modernization status](../APPLICATION-MODERNIZATION-STATUS.md) | application modernization status (current) | per-program conversion status. **Living:** the `pilot` command regenerates it. |

## Evidence folders

- [`step-11/`](../step-11/): [architecture inventory](../step-11/architecture-inventory.md), [RTNCDE00 architecture preview](../step-11/rtncde00-architecture-preview.md), [RTNCDE00 modernization plan](../step-11/rtncde00-modernization-plan.md), the [synthetic pilot result](../step-11/pilot/pilot-result.json), [gap handoff demonstration](../step-11/gap-handoff-demonstration.md).
- [`step-14/`](../step-14/): [conversion candidates](../step-14/conversion-candidates.json), [PORTVALD conversion spec](../step-14/portvald-conversion-spec.md), [test cases](../step-14/portvald-test-cases.json), [source readiness](../step-14/source-readiness-PORTVALD.json).
- [`step-15/`](../step-15/): [application status](../step-15/application-status.json), the synthetic pilot results.
- [`step-16/`](../step-16/): [PORTVALD review](../step-16/portvald-review.json), [application status](../step-16/application-status.json).
- [`step-17/`](../step-17/): [application status](../step-17/application-status.json), [business-rule reconciliation](../step-17/business-rules-reconciliation.json).
- [`step-20/`](../step-20/): [converter defects](../step-20/converter-defects.json), [implementation changes](../step-20/implementation-changes.json), [before/after](../step-20/before-after.json), [updated gaps](../step-20/updated-gaps.json), [readiness failures](../step-20/readiness-failures.json), per-program readiness [before](../step-20/readiness-before/) and [after](../step-20/readiness/), [regression evidence](../step-20/regression-evidence.json).

**Path used by:**
- `forward/runtime/src/commands/pilot.ts` writes into `step-11`, `step-12` and `step-15`, and regenerates the living status report;
- `forward/tools/reverse-forward-reconcile.py`, `step22-final.py`, `step23-gaps.py` and `step25-final.py` read `step-17`;
- `step20-report.py`, `step21-report.py`, `reverse-forward-report.py` and the CI JSON check (`step-20/readiness-before/CURSMGR.json`) read `step-20`.

**Related topics:** [business-rule verification](business-rule-verification.md) · [reverse–forward reconciliation](reverse-forward-reconciliation.md) · [backup and recovery](backup-and-recovery.md)
