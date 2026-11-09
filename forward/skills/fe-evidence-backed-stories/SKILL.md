---
name: fe-evidence-backed-stories
description: REVFORGE F4 skill. Converts approved requirements and approved architecture into epics and implementation stories, each with requirement references, source evidence, scope, dependencies, data contracts, acceptance criteria, testing expectations, blocking decisions and the approval baseline. Program-agnostic.
allowed-tools: Read, Grep, Glob, Write
---

# fe-evidence-backed-stories

Owned by agent **fe-development-planner** (F4). Dispatchable only after gate G2 (approved architecture) has passed.

```json revforge-skill
{
  "skill": "fe-evidence-backed-stories",
  "owner_agent": "F4",
  "version": "1.0",
  "output_contracts": ["forward/development-stories"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/gates/G1-*.json",
    "workflow/gates/G2-*.json",
    "workflow/agents/F3/<packet>/component_design.json",
    "workflow/agents/F3/<packet>/architecture_decisions.json",
    "workflow/agents/F1/<packet>/draft_requirements.json",
    "workflow/agents/F1/<packet>/uncertainty_decision_register.json",
    "workflow/agents/F2/<packet>/data_mappings.json",
    "forward/runs/<run>/gap_summary.json"
  ],
  "executes": []
}
```

## Purpose and responsibility

Break the approved architecture into implementable, testable stories. Each story is small enough to implement and verify on its own. It cites the requirements it implements and the components it builds, and states:
- acceptance criteria that check named legacy behaviour (statement or paragraph IDs);
- dependencies;
- the data contracts it uses;
- the decisions that still block it.

The skill names no program and assumes no pilot scope. Scope comes only from the approved inputs.

## Required input artifacts

- The G1 and G2 gate results, both `PASS` on the packet baseline.
- From accepted F3 receipts: `component_design.json` and `architecture_decisions.json`.
- From accepted F1 receipts: the approved requirements and the decision register.
- From accepted F2 receipts: the data contracts.
- `gap_summary.json`: the open gap items that stories depend on.

## Input validation

1. Stop with `blocked` if G1 or G2 is not `PASS` on the packet baseline, the packet is not dispatchable, or a skill is not installed.
2. Every component referenced must exist in the approved component design. Every requirement must be approved.
3. Copy `inputs_used` paths and hashes from the packet.

## Execution procedure

1. Create one epic (`EPIC-NNN`) per component, or per closely coupled group of components.
2. For each component, split the implemented requirements into stories (`STORY-NNN`):
   - the record codec first;
   - then the core processing;
   - then error and return-code handling;
   - then the integration boundary.

   Order them by dependency.
3. For each story, record:
   - `requirement_ids`, `component_ids` and `source_refs` (statement and paragraph IDs of the legacy behaviour);
   - `implementation_scope`;
   - `dependencies`;
   - `data_contracts` (Record IDs);
   - `testing_expectations`;
   - `blocking_decisions`: the open DR IDs that touch its requirements.
4. Write acceptance criteria as observable checks. Each one cites the legacy statement or paragraph it verifies in `verifies_source`. Examples:
   - "Given a PORT-STATUS value outside the 88-level set, the record is rejected with return code 8": use values from the evidence, never invented ones.
5. Set `readiness` provisionally to `unverified`; `fe-sprint-readiness` decides the final status.
6. Set `approval_baseline` to the G1 and G2 result files.
7. Write `stories.json` and `epics.json` (contract `forward/development-stories`).

## Source grounding

Acceptance criteria use the values, codes and conditions recorded in the approved requirements and the reverse logic. Where the evidence for a criterion is uncertain, the story keeps the related decision as blocking. It never fills in the expected value.

## Outputs and contracts

`epics.json` and `stories.json` both use contract `forward/development-stories`. Both carry the common forward header (F4) and are written in the packet output directory.

## Allowed tools and operations

Read, Grep and Glob on the approved inputs listed in the packet (gate results, F1/F2/F3 outputs, gap summary). Write only `epics.json` and `stories.json` (and nothing else) inside `packet.permissions.output_dir`. No Bash, no Edit of other agents' files, no Java or build files, no network, no Neo4j access.

## Forbidden operations

- Writing stories for unapproved requirements or components.
- Marking a story authorised for implementation.
- Inventing acceptance values.
- Hard-coding program names or pilot scope into the procedure.
- Writing code or modifying other agents' outputs.

## Error handling and stop conditions

- Approved inputs missing: return `blocked`.
- A requirement cannot be expressed as a testable criterion: keep the story `blocked`, with the reason in `readiness.unmet`.
- Not every approved requirement is covered by a story: return `incomplete`.

## Quality checks

1. Every approved requirement appears in at least one story.
2. Every story has at least one acceptance criterion with `verifies_source`.
3. Every blocking DR is open in the decision register.
4. Story dependencies form a DAG (no cycles).
5. Every data contract referenced exists in the F2 data contracts.

## Source-ID traceability

Stories cite requirement IDs, component IDs, Record IDs and the statement and paragraph IDs of legacy behaviour. This continues the chain `component → story` (`planned_in`).

## Orchestrator integration

The F4 receipt lists `epics.json`, `stories.json` and `sprint_readiness.md`. The runtime validates them. An accepted completed receipt allows `ARCHITECTURE_APPROVED → STORIES_DRAFTED`. There is no story approval gate: the runtime validates the story set against the approved requirements and the G2 architecture, and F5 can be dispatched only while that validation passes. Java generation needs G2 PASS and the config flag.
