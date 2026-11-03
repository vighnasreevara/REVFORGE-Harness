# REVFORGE forward contracts

All contracts are JSON Schema (draft-07), loaded by `runtime/src/core/contracts.ts` and validated with Ajv v8. Schema validity is necessary but not sufficient: the runtime also runs deterministic semantic checks (`verification/src/semantic.ts`) on every forward deliverable before it accepts a receipt.

## 1. Canonical forward-workflow deliverables (`forward/`)

These are the outputs of the seven forward agents. Each starts with the shared header in `forward-common.schema.json`:
- `contract`
- `contract_version`
- `authoring_agent`
- `packet_id`
- `baseline` (run ID and manifest SHA-256)
- `generated_at`
- `skills_used`
- `inputs_used` (path and SHA-256)
- `units_covered`
- `unresolved_findings`

The receipt provenance records each output's content hash, computed by the runtime.

| Contract | Produced by | Skill | Key semantic checks |
|---|---|---|---|
| `forward/requirements` | F1 | fe-source-grounded-requirements | Every in-scope rule has exactly one disposition (none is silently discarded). No requirement claims a higher confidence or evidence class than its rules, and SME flags are kept. Coverage counts are exact. Requirement IDs are unique across batches. |
| `forward/decision-requests` | F1, F2 | fe-uncertainty-decision-register, fe-copybook-layout-contract | Gap items belong to their gap, and full sets are marked `all_items_included`. Every critical or high gap in scope has a request. Blocker counts are exact. Every decision is `open`. |
| `forward/data-contracts` | F2 | fe-copybook-layout-contract | Every catalogued record and field is present. `java_type` must be in the permitted set (`verification/src/numeric.ts`); float and double are not representable. Category, decimals and sign match the catalogue. A field with no ID stays unresolved. Unresolved copybook stubs are reported. |
| `forward/file-runtime-semantics` | F2 | fe-cobol-runtime-file-semantics | There is one entry per program unit. Statement and paragraph IDs belong to the program's own File ID. |
| `forward/architecture-record` | F3 | fe-java-architecture-spine, fe-legacy-compatibility-adr | Java 21 and Maven. Every framework needs an ADR. ADRs are only `proposed`. A behaviour change requires business-SME approval. |
| `forward/development-stories` | F4 | fe-evidence-backed-stories, fe-sprint-readiness | Every acceptance criterion cites the legacy source it verifies. Readiness is `ready`, `blocked` or `unverified`. |
| `forward/implementation-manifest` | F5 | fe-java-batch-implementation, fe-compiler-repair | Generation must be authorised. Every Java element is traced to its story, requirement and source. Repairs must be behaviour-neutral. |
| `forward/test-fixture-manifest` | F6 | fe-independent-fixture-design | `derived_from_java: false`. Every expected result has a basis. |
| `forward/verification-report` | F6 | fe-legacy-java-equivalence | `EQUIVALENT` requires hashed reference evidence; otherwise the result is `EQUIVALENCE_UNVERIFIED`. |
| `forward/review-report` | F7 | fe-adversarial-code-review | `decided_by: human_gate_G8`. The reviewer recommends; it never accepts. |
| `forward/traceability-edges` | F1, F7 | fe-source-grounded-requirements, fe-end-to-end-trace-audit | Source-ID nodes must be known permanent IDs. Reverse nodes must be bound to a current reverse run. |

On every deliverable, the runtime also checks:
- that every permanent ID exists in the reverse inputs;
- that every run-local reference (`BR-`, `RS-`, `GAP-`) is bound to a current `source_run`;
- that `verified_from_source` is claimed only when the packet had the source available;
- that the packet, agent, baseline and units match;
- that `inputs_used` hashes equal the packet's;
- that there are no approval fields or values.

## 2. Orchestration contracts (`orchestrator/`)

These are written by the runtime, except `agent-receipt`, which an agent submits.
- `workflow-state`
- `gate-result`
- `dispatch-packet`
- `agent-receipt`
- `approval-record`

## 3. Intake contracts (`input/`)

These describe the consumed core of the reverse-engineering artifacts:
- `inventory-artifact`
- `parser-artifact`
- `data-artifact`
- `logic-artifact`
- `rules-artifact`
- `diagrams-artifact`
- `gaps-register`
- `logic-program-file`

## 4. Planning outputs (`output/`) and configuration

**STEP 1 planning reports:**
- `baseline-manifest`
- `program-inventory`
- `evidence-packet`
- `rule-summary`
- `gap-summary`
- `decision-backlog`
- `readiness-report`

**Shared definitions and configuration:**
- `common.schema.json`: the shared definitions.
- `forward-config.schema.json`: the execution configuration.
