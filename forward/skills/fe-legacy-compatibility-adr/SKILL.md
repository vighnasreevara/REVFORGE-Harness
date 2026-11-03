---
name: fe-legacy-compatibility-adr
description: REVFORGE F3 skill. Writes Architecture Decision Records for every point where the Java design touches legacy COBOL behaviour - existing behaviour, proposed Java behaviour, source evidence, compatibility risks, alternatives, required approvals and testing implications. No ADR authorises a behaviour change by itself.
allowed-tools: Read, Grep, Glob, Write
---

# fe-legacy-compatibility-adr

Owned by agent **fe-java-architect** (F3). Run with `fe-java-architecture-spine` on the same packet, after G2.

```json revforge-skill
{
  "skill": "fe-legacy-compatibility-adr",
  "owner_agent": "F3",
  "version": "1.0",
  "output_contracts": ["forward/architecture-record"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/agents/F3/<packet>/component_design.json",
    "workflow/agents/F1/<packet>/draft_requirements.json",
    "workflow/agents/F2/<packet>/data_mappings.json",
    "workflow/agents/F2/<packet>/file_operation_requirements.json",
    "output/logic/program_logic/*_logic.json"
  ],
  "executes": []
}
```

## Purpose and responsibility

Make every legacy-compatibility choice explicit and reviewable. Typical choices:
- numeric representation;
- packed-decimal codecs;
- file organisation replacements;
- file-status and return-code mapping;
- DB2 commit points;
- CICS COMMAREA exchange;
- error-routine semantics;
- any deliberate behaviour change.

Each ADR is `proposed` and lists the approvals it needs. The F3 agent cannot authorise a change in business behaviour.

## Required input artifacts

- `component_design.json` from the same packet: the components and frameworks that need ADRs.
- The approved requirements: the behaviour that must be preserved.
- The F2 data contracts and runtime semantics: the legacy representations and runtime behaviour.
- The per-program logic files, for the exact legacy behaviour and its statement and paragraph IDs.

## Input validation

1. The packet must be dispatchable and G2 must be `PASS`. `component_design.json` must exist in the output directory; if it does not, run `fe-java-architecture-spine` first.
2. Each framework listed in `technical_baseline.frameworks` must get an ADR. Every compatibility requirement from F2 that the design changes or abstracts must get an ADR.
3. Copy `inputs_used` paths and hashes from the packet.

## Execution procedure

1. List the decision points:
   - each framework;
   - each record codec (DISPLAY, packed, binary, sign handling, encoding);
   - each file organisation and access mode;
   - each status-code and return-code mapping;
   - each DB2 transaction boundary;
   - each CICS interaction;
   - each place where the design deviates from the COBOL behaviour.
2. For each point write an ADR (`ADR-NNN`) with:
   - `existing_cobol_behavior`, quoted from the logic or runtime semantics, with `source_refs` (statement and paragraph IDs);
   - `proposed_java_behavior`;
   - `behavior_change` (true when observable behaviour differs);
   - `compatibility_risks`;
   - at least one alternative, including "preserve the exact COBOL behaviour";
   - `required_approvals`: always `architecture_owner`; add `business_sme` when `behavior_change` is true; add `operations` for scheduling or restart changes;
   - `testing_implications`, naming the fixtures F6 must create.
3. Set every ADR `status` to `proposed`.
4. Write `architecture_decisions.json` with contract `forward/architecture-record`, `record_type: "architecture_decisions"`, the same `technical_baseline` and `approved_inputs`, and an empty `components` list or the components each ADR concerns.

## Source grounding

The existing-behaviour text of each ADR comes from reverse evidence and is cited by permanent IDs. Proposed behaviour must satisfy the approved requirement it serves. Where the evidence is uncertain, the ADR records that and depends on the related open decision request.

## Outputs and contracts

`architecture_decisions.json` uses contract `forward/architecture-record` and carries the common forward header (F3). It is written only in the packet output directory.

## Allowed tools and operations

- Read, Grep and Glob on approved inputs and reverse evidence.
- Write in the packet output directory.

No Bash, no code, no network.

## Forbidden operations

- Marking an ADR accepted or approved.
- Recording a behaviour change without `business_sme` approval listed.
- Omitting the "preserve legacy behaviour" alternative.
- Writing code.
- Modifying other agents' outputs or reverse artifacts.

## Error handling and stop conditions

- Missing component design or approved inputs: stop with `blocked`.
- Legacy behaviour cannot be determined from the evidence: write the ADR with an unresolved finding, and do not propose a behaviour change.
- Not every decision point is covered: return `incomplete`.

## Quality checks

1. Every framework and every behaviour-changing design choice has an ADR.
2. Every ADR has source refs, at least one alternative and the required approvals.
3. `behavior_change: true` always lists `business_sme`.
4. All statuses are `proposed`.

## Source-ID traceability

ADR `source_refs` copy statement, paragraph, record and field IDs exactly. ADRs are linked to requirements and components so that F7 can trace `requirement → ADR → component`.

## Orchestrator integration

`architecture_decisions.json` is listed in the F3 receipt together with `component_design.json` and `java_architecture.md`. The runtime validates the outputs. A human reviews the ADRs at gate G3. Until G3 passes, no story or code may rely on them.
