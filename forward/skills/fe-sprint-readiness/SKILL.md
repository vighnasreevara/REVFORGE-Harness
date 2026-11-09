---
name: fe-sprint-readiness
description: REVFORGE F4 skill. Decides, per story, whether it is ready for implementation by checking approved requirements, approved architecture, resolved blocking decisions, data contracts, source evidence, dependencies, acceptance criteria and test prerequisites. Incomplete stories stay blocked or unverified.
allowed-tools: Read, Grep, Glob, Write
---

# fe-sprint-readiness

Owned by agent **fe-development-planner** (F4). Run after `fe-evidence-backed-stories` on the same packet.

```json revforge-skill
{
  "skill": "fe-sprint-readiness",
  "owner_agent": "F4",
  "version": "1.0",
  "output_contracts": ["forward/development-stories"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/agents/F4/<packet>/stories.json",
    "workflow/agents/F1/<packet>/uncertainty_decision_register.json",
    "workflow/agents/F2/<packet>/data_mappings.json",
    "workflow/gates/G1-*.json",
    "workflow/gates/G2-*.json"
  ],
  "executes": []
}
```

## Purpose and responsibility

Give every story a readiness status (`ready`, `blocked` or `unverified`), with the exact list of unmet conditions, and publish a sprint readiness report. A story is `ready` only when every condition below is satisfied by recorded evidence. "Ready" is a planning statement, not an authorisation: implementation needs G2 PASS, a story set that passes the runtime's validation, and generation authorisation.

## Required input artifacts

- `stories.json` from the same packet.
- The decision register: the open and blocking DRs.
- The approved requirement list and the G1/G2 gate results.
- The F2 data contracts: Record IDs and field evidence status.
- Any recorded human decisions that resolve DRs. These appear only through runtime approval records, never through agent text.

## Input validation

1. `stories.json` must exist and match `forward/development-stories`. Otherwise run `fe-evidence-backed-stories` first, or return `incomplete`.
2. G1 and G2 must be `PASS` on the packet baseline. If not, every story is `blocked`.
3. Copy `inputs_used` paths and hashes from the packet.

## Execution procedure

For each story, check in order and record every failure in `readiness.unmet`:

1. All `requirement_ids` are approved (G1).
2. All `component_ids` exist in the approved architecture (G2).
3. No `blocking_decisions` entry is still open in the decision register.
4. Every `data_contracts` Record ID has a data contract whose fields are not `unresolved`.
5. Every acceptance criterion has a `verifies_source` with a File ID.
6. Every dependency story is itself `ready` or already implemented.
7. Testing prerequisites are named. These are the fixtures F6 will need, such as captured COBOL reference outputs. Missing references keep the story `unverified`.

Then set the status:
- `ready` when nothing is unmet;
- `blocked` when items 1–4 or 6 fail;
- `unverified` when only evidence for items 5 or 7 is missing.

Rewrite `stories.json` with the readiness filled in. Write `sprint_readiness.md`: a table of stories with status and unmet items, the totals, and the decisions whose resolution would unblock the most stories.

## Source grounding

Readiness is computed from recorded artifacts only: gate results, the decision register, data contracts and story fields. Nothing is marked satisfied because it seems likely or because the agent believes it.

## Outputs and contracts

- `stories.json`: updated, contract `forward/development-stories`.
- `sprint_readiness.md`: the human-readable report.

Both carry the common forward header (F4) and are written in the packet output directory.

## Allowed tools and operations

Read, Grep and Glob on `stories.json`, the decision register, the data contracts and the gate results listed in the packet. Write only the updated `stories.json` and `sprint_readiness.md` inside `packet.permissions.output_dir`. No Bash, no code, no network, no Neo4j access, no edits outside the output directory.

## Forbidden operations

- Marking a story `ready` with any unmet condition.
- Treating a decision as resolved without a runtime approval record.
- Authorising implementation.
- Modifying other agents' outputs.

## Error handling and stop conditions

- Stories missing or invalid: return `incomplete`.
- Gate results missing: mark all stories `blocked` and complete the report.
- Packet undispatchable: return `blocked`.

## Quality checks

1. The status follows exactly from `unmet`: empty means `ready`.
2. The report's counts equal the story statuses.
3. No `ready` story depends on a story that is not `ready`.

## Source-ID traceability

Readiness keeps the story's requirement, component, record and source IDs unchanged. Each unmet item names the decision, record or story it concerns.

## Orchestrator integration

Listed in the F4 receipt. The runtime validates `stories.json` against the approved requirements and the G2 architecture. F5 can be dispatched only while that validation passes, and only for authorised stories.
