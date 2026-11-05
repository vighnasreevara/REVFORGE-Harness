# Business-rule verification

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** for each business rule mined by reverse engineering, is it implemented in Java, and how was it tested? Rule IDs are the reverse-engineering IDs and are never renumbered.

## Reports

| Report | Scope |
|---|---|
| [STEP-17 functional completeness assessment](../STEP-17-FUNCTIONAL-ASSESSMENT.md) | rule-by-rule test status after the full-application conversion |
| [STEP-20 remediation assessment](../STEP-20-REMEDIATION-ASSESSMENT.md) | rule status changes caused by the converter fixes |
| [STEP-22 final reconciliation](../STEP-22-FINAL-RECONCILIATION.md) | the final rule reconciliation |
| [STEP-23 master gap register](../STEP-23-MASTER-GAP-REGISTER.md) | the gaps that affect business rules |

## Evidence, in chronological order

1. The source of the rules (reverse engineering, read-only): [`output/rules/rules_artifact.json`](../../../output/rules/rules_artifact.json).
2. [`step-17/business-rules-reconciliation.json`](../step-17/business-rules-reconciliation.json): rule status after STEP 17.
3. [`reverse-forward/business-rule-mapping.json`](../reverse-forward/business-rule-mapping.json): the rule-to-Java mapping in the first reconciliation.
4. [`step-20/business-rule-status-changes.json`](../step-20/business-rule-status-changes.json): the changes made in STEP 20.
5. **The final state:** [`step-22/business-rule-reconciliation.json`](../step-22/business-rule-reconciliation.json) and [`step-22/reconcile-final/business-rule-mapping.json`](../step-22/reconcile-final/business-rule-mapping.json).
6. [`step-23/business-rule-gap-impact.json`](../step-23/business-rule-gap-impact.json): the open gaps for each rule.
7. [`step-25/coverage.json`](../step-25/coverage.json): the coverage confirmed at handover.

**Related topics:** [reverse–forward reconciliation](reverse-forward-reconciliation.md) · [COBOL-to-Java conversion](cobol-to-java-conversion.md) · [master gap register](master-gap-register.md)
