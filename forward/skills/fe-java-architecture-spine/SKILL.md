---
name: fe-java-architecture-spine
description: REVFORGE F3 skill. Designs the target Java 21 / Maven architecture - modules, components, interfaces and dependencies - from approved requirements, verified data contracts and runtime semantics, distinguishing batch jobs, online transactions, shared services and integration boundaries. Introduces no framework without an approved ADR.
allowed-tools: Read, Grep, Glob, Write
---

# fe-java-architecture-spine

Owned by agent **fe-java-architect** (F3). Dispatchable only after gate G2 (approved requirements) has passed on the current baseline.

```json revforge-skill
{
  "skill": "fe-java-architecture-spine",
  "owner_agent": "F3",
  "version": "1.0",
  "output_contracts": ["forward/architecture-record"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/gates/G2-*.json",
    "workflow/agents/F1/<packet>/draft_requirements.json",
    "workflow/agents/F1/<packet>/uncertainty_decision_register.json",
    "workflow/agents/F2/<packet>/data_mappings.json",
    "workflow/agents/F2/<packet>/file_operation_requirements.json",
    "forward/runs/<run>/evidence_packets/*.json"
  ],
  "executes": []
}
```

## Purpose and responsibility

Define the Java 21 and Maven architecture that implements the **approved** requirements while preserving the legacy data, error and execution contracts. That means modules, components and their responsibilities, the interfaces between them, the dependency graph, and the boundaries between batch processing, online transactions, shared services and integrations. Unresolved decisions and assumptions stay visible. No framework (Spring Boot, Spring Batch, REST, JPA or similar) enters the design without a proposed ADR that a human approves at G3.

## Required input artifacts

- The G2 gate result (status `PASS` on the packet baseline) and the approval record it cites.
- The accepted F1 receipts and their `draft_requirements.json` and `uncertainty_decision_register.json`. Only requirements covered by the G2 approval are in scope.
- The accepted F2 receipts with their `data_mappings.json` and `file_operation_requirements.json`, which describe each program's execution model, files, DB2, CICS and return codes.
- The evidence packets (call graph, JCL jobs, entry types).

## Input validation

1. Stop with `blocked` if the packet is not dispatchable, G2 is not `PASS` on the packet baseline, or either F3 skill is not installed.
2. Load every requirement and check `approval_status` against the G2 approval record. Requirements that are not approved are excluded and listed in `unresolved_findings`.
3. Check that every unit you design for has a data-contract and runtime-semantics entry from an accepted F2 receipt.
4. Copy `inputs_used` paths and hashes from the packet.

## Execution procedure

1. Group the requirements by unit and execution model (`file_operation_requirements.json` `programs[].execution_model`). Batch main programs become batch-job components. Called services become shared-service components. CICS transactions become online-transaction components behind an explicit integration boundary.
2. Define one component (`CMP-<NAME>`) per cohesive responsibility. Give each its `kind`, `responsibility`, the units it replaces (`replaces_units`), the approved `requirement_ids` it implements, its `interfaces` (each naming the data contract or record ID it exchanges) and `depends_on`.
3. Add a `file_codec` component for every record contract that crosses a file or COMMAREA boundary. Its interface names the Record ID and states the encoding assumption from F2.
4. Add an `error_handling` component that reproduces the legacy return-code and file-status contracts recorded by F2.
5. Fix `technical_baseline` to Java version `21` and build tool `maven`. Each entry in `frameworks` must reference an ADR from `fe-legacy-compatibility-adr`.
6. Write `component_design.json` (contract `forward/architecture-record`, `record_type: "component_design"`). Set `approved_inputs.requirements_approval` to the G2 result file and list the F2 receipt IDs.
7. Write `java_architecture.md`. It covers the module layout, component responsibilities, a Mermaid dependency diagram, the data, error and execution contracts, assumptions and open decisions.

## Source grounding

Every component traces to approved requirement IDs and to the units it replaces. Interfaces cite Record and Field IDs from the F2 data contracts. Any behaviour the design changes relative to COBOL must have an ADR. The design never assumes behaviour for an unresolved gap: it isolates that gap behind an interface with an open decision.

## Outputs and contracts

- `component_design.json`: contract `forward/architecture-record`, `record_type: "component_design"`.
- `java_architecture.md`: the human-readable architecture document.

Both go in the packet output directory, with the common forward header (F3, packet, baseline, `inputs_used`, `units_covered`, `unresolved_findings`).

## Allowed tools and operations

- Read, Grep and Glob on approved inputs and evidence.
- Write in the packet output directory only.

No Bash, no Java source, no build files, no network.

## Forbidden operations

- Writing Java, `pom.xml` or any `src/main` tree.
- Designing for unapproved requirements, or resolving open decisions on the SME's behalf.
- Adding frameworks or persistence technology without an ADR.
- Changing business behaviour silently.
- Modifying any other agent's outputs or the reverse artifacts.

## Error handling and stop conditions

- G2 has not passed or approved inputs are missing: stop with `blocked`.
- Conflicting requirements: design neither variant; record a finding and an ADR candidate.
- A unit without F2 contracts: exclude it and record why.
- Incomplete coverage of approved requirements: return `incomplete`.

## Quality checks

1. Every approved requirement is implemented by at least one component, or is explicitly excluded with a reason.
2. No component references an unapproved requirement.
3. Every framework entry has an ADR.
4. Every interface names a contract.
5. The dependency graph is acyclic or its cycles are justified.
6. The Java version is 21 and the build tool is Maven.

## Source-ID traceability

Components carry `replaces_units` with File IDs, `requirement_ids`, and interface record IDs. The traceability chain continues as `requirement → component` (`designed_by`) edges, which F7 audits end to end.

## Orchestrator integration

The receipt at `packet.receipt_path` lists both outputs with their contracts. The runtime validates schema and provenance. Only an accepted completed F3 receipt lets the runtime move `REQUIREMENTS_APPROVED → ARCHITECTURE_DRAFTED`. Approval of the architecture is gate G3, decided by a human.
