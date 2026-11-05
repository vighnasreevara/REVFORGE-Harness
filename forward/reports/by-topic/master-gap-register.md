# Master gap register

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** what is still unresolved, why, what does it affect, who owns it, and in what order should it be remediated? The register consolidates and plans. It resolves nothing, and gap IDs are never changed.

## Report

[STEP-23: Master Gap Register](../STEP-23-MASTER-GAP-REGISTER.md): consolidation, classification, root causes, impact, ownership and the remediation roadmap.

## Evidence ([`step-23/`](../step-23/))

| File | Content |
|---|---|
| [master-gap-register.json](../step-23/master-gap-register.json) and [.csv](../step-23/master-gap-register.csv) | **the register** (authoritative) |
| [gap-summary.json](../step-23/gap-summary.json) and [dashboard-gap-summary.json](../step-23/dashboard-gap-summary.json) | summary counts, and the dashboard's view of them |
| [root-cause-groups.json](../step-23/root-cause-groups.json) | gaps grouped by root cause |
| [program-gap-impact.json](../step-23/program-gap-impact.json), [business-rule-gap-impact.json](../step-23/business-rule-gap-impact.json), [diagram-gap-impact.json](../step-23/diagram-gap-impact.json) | impact by program, business rule and diagram |
| [dependency-graph.json](../step-23/dependency-graph.json) and [.mmd](../step-23/dependency-graph.mmd) | the gap dependency graph |
| [ownership-matrix.json](../step-23/ownership-matrix.json) | ownership |
| [remediation-roadmap.json](../step-23/remediation-roadmap.json) | the remediation order |
| [bmad-governance-blockers.json](../step-23/bmad-governance-blockers.json) | gaps that block BMad governance |
| [validation-results.json](../step-23/validation-results.json) and [regression-runs.jsonl](../step-23/regression-runs.jsonl) | register validation |

**Inputs and later checks:**
- the reverse register [`output/final_report/gaps_register.json`](../../../output/final_report/gaps_register.json);
- [`step-22/gap-reconciliation.json`](../step-22/gap-reconciliation.json);
- [`step-20/updated-gaps.json`](../step-20/updated-gaps.json);
- the handover check [`step-25/gap-register-validation.json`](../step-25/gap-register-validation.json).

**Path used by:**
- the dashboard (`forward/dashboard/evidence-sources.json` and many pages);
- the handover manifest and handover documents;
- `forward/tests/dashboard-backup-exclusion-policy.test.ts`;
- `forward/tools/step23-gaps.py` and `step25-final.py`.

**Related topics:** [business-rule verification](business-rule-verification.md) · [dashboard validation](dashboard-validation.md) · [BMad governance](bmad-governance-and-execution.md)
