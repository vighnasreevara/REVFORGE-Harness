# BMad governance and execution

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** how is the BMad method release staged, bound to the forward agents and enforced? Which conditions block live execution? Which receipts count?

## Reports (in the order the work happened)

| Report | Descriptive name | Responsibility |
|---|---|---|
| [STEP-6](../STEP-6-REPORT.md) | BMad release staging and adapter | the pinned release, workflow bindings, eligibility, the adapter |
| [BMad integration status](../bmad-integration-report.md) ([JSON](../bmad-integration-report.json)) | BMad integration status (current) | the staged and installed state and record integrity. **Living:** the `bmad` command regenerates it. |
| [STEP-7](../STEP-7-REPORT.md) | scope reconciliation, G3/G4 gates and the BMad executor | the design approval gates and the isolated executor |
| [BMad executor report](../bmad-executor-report.json) | BMad executor status (current) | **Living:** the `bmad` command regenerates it. |
| [STEP-9](../STEP-9-REPORT.md) | COBOL evidence verification and execution isolation | the whole-process isolation that BMad execution requires |
| [STEP-20](../STEP-20-REMEDIATION-ASSESSMENT.md) | gap remediation and converter improvements | BMad preflight results for STEP-20 work |
| [STEP-21](../STEP-21-BMAD-INTEGRATION-ASSESSMENT.md) | mandatory BMad governance and the PORTREAD pilot | mandatory enforcement, the governed dispatcher, receipt counting, the LIVE gate |
| [BMad end-to-end integration assessment](../BMAD-END-TO-END-INTEGRATION-ASSESSMENT.md) | BMad end-to-end enforcement verification | the final BMad classification, the bypass audit, the lifecycle mapping |

## Evidence

- [`step-8/bmad-preflight-bmad-architecture.json`](../step-8/bmad-preflight-bmad-architecture.json): the first execution preflight.
- [`step-9/isolation-capability-assessment.json`](../step-9/isolation-capability-assessment.json) and [`step-9/isolation-test-report.json`](../step-9/isolation-test-report.json).
- [`step-20/bmad-execution.json`](../step-20/bmad-execution.json) and the preflight captures in [`step-20/bmad/`](../step-20/bmad/).
- [`step-21/`](../step-21/): [installation audit](../step-21/bmad-installation-audit.json), [workflow mapping](../step-21/bmad-workflow-mapping.json), [receipt validation](../step-21/bmad-receipt-validation.json), [blockers](../step-21/bmad-blockers.json), [environment readiness](../step-21/environment-readiness.json), [PORTREAD pilot manifest](../step-21/portread-pilot-manifest.json), [summary](../step-21/step21-summary.json).
- [`bmad-end-to-end/`](../bmad-end-to-end/): [compliance assessment](../bmad-end-to-end/compliance-assessment.json), [bypass audit](../bmad-end-to-end/bypass-audit.json), [architecture audit](../bmad-end-to-end/architecture-audit.json), [lifecycle mapping](../bmad-end-to-end/lifecycle-mapping.json), [live runner status](../bmad-end-to-end/live-runner-status.json), [PORTREAD governed run](../bmad-end-to-end/portread-governed-run.json), [blockers](../bmad-end-to-end/blockers.json).
- Status at later steps: [`step-22/bmad-governance-status.json`](../step-22/bmad-governance-status.json), [`step-23/bmad-governance-blockers.json`](../step-23/bmad-governance-blockers.json), [`step-25/bmad-governance.json`](../step-25/bmad-governance.json).

**Path used by:**
- the dashboard's BMad page and the handover manifest (`bmad-end-to-end/portread-governed-run.json`);
- `forward/tools/bmad-e2e-report.py`, `step21-report.py`, `step23-gaps.py` and `step25-final.py`;
- `forward/runtime/src/commands/bmad.ts`, which writes the two living reports.

**Related topics:** [independent AI verification](independent-ai-verification.md) · [master gap register](master-gap-register.md) · [engineering handover](engineering-handover-and-quality.md)
