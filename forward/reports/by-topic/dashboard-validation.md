# Dashboard validation

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** does the modernization dashboard show only committed, hash-verified evidence, and does every metric it displays agree with the evidence? The dashboard source and its operating notes are in [`forward/dashboard/`](../../dashboard/README.md).

## Reports

| Report | Responsibility |
|---|---|
| [STEP-24: Modernization Dashboard Assessment](../STEP-24-DASHBOARD-ASSESSMENT.md) | architecture, acceptance criteria, evidence mapping, tests, accessibility and performance |
| [Post-handover quality review](../POST-HANDOVER-QUALITY-REVIEW.md) | fail-closed evidence loading (SHA-256 required) and the CI that was added |
| [STEP-25 handover](../STEP-25-FINAL-HANDOVER-ASSESSMENT.md) | the dashboard checks at handover |

## Evidence

- [`step-24/`](../step-24/): [metric validation](../step-24/metric-validation.json), [evidence source mapping](../step-24/evidence-source-mapping.json), [dashboard architecture](../step-24/dashboard-architecture.json), [page inventory](../step-24/page-inventory.json), [build and test results](../step-24/build-test-results.json), [smoke results](../step-24/smoke-results.json), [accessibility and performance](../step-24/accessibility-performance.json), [limitations](../step-24/limitations-and-step25.json), regression runs.
- [`step-25/dashboard-validation.json`](../step-25/dashboard-validation.json): the dashboard checks at handover.

**Re-validated by:** the *Dashboard* job in `.github/workflows/revforge-ci.yml`:
- `npm run evidence`;
- `npm test`;
- `scripts/evidence-report.ts`, writing to a temporary folder (the committed `step-24/` evidence is never rewritten);
- the browser smoke test.

**Related topics:** [master gap register](master-gap-register.md) · [reverse–forward reconciliation](reverse-forward-reconciliation.md) · [engineering handover](engineering-handover-and-quality.md)
