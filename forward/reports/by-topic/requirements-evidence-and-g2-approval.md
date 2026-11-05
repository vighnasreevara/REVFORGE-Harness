# Requirements evidence and G2 approval

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** how were the drafted requirements checked against the COBOL source? What blocks the G2 requirements gate, and what would a human approver need to decide or sign?

## Reports (in the order the work happened)

| Report | Descriptive name | Responsibility |
|---|---|---|
| [STEP-3.5](../STEP-3.5-REPORT.md) | agent deliverable defect remediation | per-ID reconciliation of the agent deliverables; independent source verification; versioned corrections |
| [G2 readiness report](../G2-READINESS-REPORT.md) | G2 readiness and blockers (current) | G2 readiness of the real run. **Living:** `workflow g2 report` regenerates it. |
| [STEP-4.5](../STEP-4.5-REPORT.md) | G2 blocker root causes and deterministic verification | blocker-count audit, the root-cause registry, deterministic COBOL verification, remediation proposals |
| [STEP-5.5](../STEP-5.5-REPORT.md) | G2 decision workbench and first scope | scope candidates, the evidence package, decision packets, trust readiness; recommends the first scope |
| [STEP-8](../STEP-8-REPORT.md) | trusted decisions and G2 unblocking | trusted decision operations, decision dossiers, the RTNCDE00 G2 checklist, resolution requests |
| [STEP-10](../STEP-10-REPORT.md) | evidence adjudication and RTNCDE00 approval readiness | adjudication of earlier and new evidence; the RTNCDE00 review package |
| [STEP-12](../STEP-12-REPORT.md) | RTNCDE00 pilot scope and behaviour classification | semantic dependencies, behaviour classification, the verified scope, the approval checklist |
| [STEP-13](../STEP-13-REPORT.md) | scoped approval of verified behaviour | typed behaviour scopes and their review packages; approval prerequisites |

## Evidence folders

- [`step-4.5/`](../step-4.5/): [blocker-count audit](../step-4.5/blocker-count-audit.json), [root-cause registry](../step-4.5/root-cause-registry.json), [deterministic verification](../step-4.5/deterministic-verification.json), [decision review queue](../step-4.5/decision-review-queue.json), [remediation proposals](../step-4.5/remediation-proposals.json), [scope readiness](../step-4.5/scope-readiness.json).
- [`step-5.5/`](../step-5.5/): [scope G2 readiness](../step-5.5/scope-g2-readiness.md), [decision packets](../step-5.5/decision-packets.md), [first-scope recommendation](../step-5.5/first-scope-recommendation.md), [approval operations checklist](../step-5.5/approval-operations-checklist.md), [trust readiness](../step-5.5/trust-readiness.json), resolution requests.
- [`step-8/`](../step-8/): [RTNCDE00 G2 checklist](../step-8/RTNCDE00-G2-CHECKLIST.md), [approval readiness](../step-8/approval-readiness.json), [decision dossiers](../step-8/decision-dossiers.json), resolution requests.
- [`step-10/`](../step-10/): [evidence adjudication](../step-10/evidence-adjudication.json), [RTNCDE00 review package](../step-10/review-package-programs_RTNCDE00.md), resolution requests.
- [`step-12/`](../step-12/): [behaviour classification](../step-12/behaviour-classification.md), [semantic dependencies](../step-12/semantic-dependencies.json), [verified scope](../step-12/verified-scope-programs_RTNCDE00.json), [approval checklist](../step-12/approval-checklist.md), [gap handoff](../step-12/gap-handoff.md).
- [`step-13/`](../step-13/): [P200 approval prerequisites](../step-13/p200-approval-prerequisites.md), [P200 scoped gap handoff](../step-13/p200-scoped-gap-handoff.md), the behaviour scopes and their review packages.

**Path used by:**
- the runtime writes into these folders: `step-4.5` (`commands/verification.ts`), `step-5.5` (`commands/workbench.ts`), `step-8` (`commands/operations.ts`), `step-10` (`commands/context.ts`, `commands/operations.ts`) and `step-12` (`commands/context.ts`, `commands/pilot.ts`);
- `forward/tools/git-stabilization-report.py` reads `step-13`.

**Related topics:** [independent AI verification](independent-ai-verification.md) · [source integrity](source-integrity-and-traceability.md) · [COBOL-to-Java conversion](cobol-to-java-conversion.md)
