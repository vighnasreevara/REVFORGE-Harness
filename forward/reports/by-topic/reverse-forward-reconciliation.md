# Reverse–forward reconciliation

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** for each element that reverse engineering found, what exists on the forward (Java) side, and how was it verified? Elements: program, paragraph, statement, record, field, copybook, JCL, dependency, diagram, business rule and gap.

## Reports (read in this order)

| Report | Scope |
|---|---|
| [Reverse vs forward artifact reconciliation](../REVERSE-FORWARD-RECONCILIATION.md) | the first reconciliation of the reverse artifacts against the converted application |
| [STEP-20 remediation assessment](../STEP-20-REMEDIATION-ASSESSMENT.md) | how the reconciliation changed after the STEP-20 converter fixes (the earlier baseline is kept in `step-20/baseline-step19/`) |
| [STEP-22 final reconciliation](../STEP-22-FINAL-RECONCILIATION.md) | **the final, authoritative reconciliation**, used by the dashboard and the handover |

## Evidence

- [`reverse-forward/`](../reverse-forward/): the first reconciliation.
  - Per-element mappings: [programs](../reverse-forward/program-mapping.json), [paragraphs](../reverse-forward/paragraph-mapping.json), [business rules](../reverse-forward/business-rule-mapping.json), [data](../reverse-forward/data-mapping.json), [copybooks](../reverse-forward/copybook-mapping.json), [JCL](../reverse-forward/jcl-mapping.json), [dependencies](../reverse-forward/dependency-mapping.json), [diagrams](../reverse-forward/diagram-mapping.json).
  - Also: [gap reconciliation](../reverse-forward/gap-reconciliation.json), [summary](../reverse-forward/summary.json), [verification runs](../reverse-forward/verification-runs.jsonl).
- [`step-20/baseline-step19/`](../step-20/baseline-step19/): the reconciliation as it stood before STEP 20.
- [`step-22/`](../step-22/): the final reconciliation. Start at [final-summary.json](../step-22/final-summary.json).
  - Per-element files: [program](../step-22/program-reconciliation.json), [paragraph](../step-22/paragraph-reconciliation.json), [statement](../step-22/statement-reconciliation.json), [control flow](../step-22/control-flow-reconciliation.json), [record](../step-22/record-reconciliation.json), [field](../step-22/field-reconciliation.json), [copybook](../step-22/copybook-reconciliation.json), [JCL](../step-22/jcl-reconciliation.json), [dependency](../step-22/dependency-reconciliation.json), [diagram](../step-22/diagram-reconciliation.json), [business rule](../step-22/business-rule-reconciliation.json), [gap](../step-22/gap-reconciliation.json).
  - [Verification results](../step-22/verification-results.json) and per-program [readiness](../step-22/readiness/).
  - Reconciliation tool output: [reconcile-run/](../step-22/reconcile-run/) and [reconcile-final/](../step-22/reconcile-final/).
  - An [interrupted run, kept as a record](../step-22/interrupted-run-20261103/NOTE.md).
- [`bmad-end-to-end/reconcile-run/`](../bmad-end-to-end/reconcile-run/): the reconciliation re-run during the BMad end-to-end assessment.

**Used by:**
- the dashboard (`forward/dashboard/evidence-sources.json` reads files from `step-22/`);
- the handover manifest;
- `forward/tools/step22-final.py`, `step23-gaps.py` and `step25-final.py`.

**Related topics:** [business-rule verification](business-rule-verification.md) · [master gap register](master-gap-register.md) · [source integrity](source-integrity-and-traceability.md)
