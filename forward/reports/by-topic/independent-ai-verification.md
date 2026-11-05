# Independent AI verification

> **Navigation page.** It links to the original reports and evidence. It holds no results of its own. Nothing linked here was moved, renamed or rewritten. Where this page and a linked report differ, the report is authoritative.

**Answers:** how is the independent OpenAI semantic verification gated (disabled by default; signed source-export authorization required), and what has actually run? Read the linked reports for the live status. A mock or offline run is never semantic verification.

## Reports

| Report | Descriptive name | Responsibility |
|---|---|---|
| [STEP-5](../STEP-5-REPORT.md) | OpenAI semantic verification boundary | the verification pipeline, the authorization boundary, offline and mock execution |
| [OpenAI verification report](../openai-verification-report.md) ([JSON](../openai-verification-report.json)) | OpenAI verification status (current) | the provider, model and authorization state of the real run. **Living:** the `openai` command regenerates it. |

## Evidence

- [`step-4.5/openai-verification-queue.json`](../step-4.5/openai-verification-queue.json): the findings queued for independent review.
- [`step-5.5/openai-pilot.json`](../step-5.5/openai-pilot.json) and [`step-5.5/openai-pilot-authorization-request.json`](../step-5.5/openai-pilot-authorization-request.json): pilot preparation and the unsigned authorization request.
- [`step-21/authorization-request-PORTREAD.unsigned.json`](../step-21/authorization-request-PORTREAD.unsigned.json): the unsigned AI disclosure request for the PORTREAD BMad pilot.

**Related topics:** [requirements evidence and G2 approval](requirements-evidence-and-g2-approval.md) · [BMad governance](bmad-governance-and-execution.md)
