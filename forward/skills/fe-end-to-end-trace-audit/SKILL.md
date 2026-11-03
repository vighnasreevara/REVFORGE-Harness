---
name: fe-end-to-end-trace-audit
description: REVFORGE F7 skill. Audits complete traceability - COBOL source ID -> reverse finding -> requirement -> architecture -> story -> Java -> independent test -> verification result - detecting missing, stale or conflicting references and handling split and merged business rules correctly.
allowed-tools: Read, Grep, Glob, Write
---

# fe-end-to-end-trace-audit

Owned by agent **fe-independent-reviewer** (F7). Run with `fe-adversarial-code-review` after gate G6.

```json revforge-skill
{
  "skill": "fe-end-to-end-trace-audit",
  "owner_agent": "F7",
  "version": "1.0",
  "output_contracts": ["forward/traceability-edges"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "forward/runs/<run>/baseline_manifest.json",
    "workflow/agents/F1/*/evidence_references.json",
    "workflow/agents/F1/*/draft_requirements.json",
    "workflow/agents/F3/*/component_design.json",
    "workflow/agents/F4/*/stories.json",
    "<java_target_dir>/implementation_manifest.json",
    "workflow/agents/F6/*/test_fixture_manifest.json",
    "workflow/agents/F6/*/equivalence_assessment.json"
  ],
  "executes": []
}
```

## Purpose and responsibility

Build and check the complete trace graph for the reviewed scope. Every in-scope permanent COBOL source ID and every reverse rule must reach a verification result. Every Java element must lead back to the source. Breaks, stale reverse-run bindings and conflicting references are reported. Split rules (one rule, several requirements) and merged rules (several rules, one requirement) are traced explicitly.

## Required input artifacts

- The baseline manifest: its `source_runs` decide which run bindings are current.
- F1 `evidence_references.json` and requirements; F3 component design.
- F4 stories; F5 implementation manifest; F6 fixture manifest and equivalence assessment.
- All of these come from accepted receipts on the current baseline, as listed in the packet.

## Input validation

1. G6 must be `PASS` and the packet dispatchable; otherwise stop with `blocked`.
2. Every input must come from an accepted receipt on the packet baseline. Inputs from a different baseline are stale and are recorded as breaks.
3. Copy `inputs_used` paths and hashes from the packet.

## Execution procedure

1. Load the F1 edges: `source_id → reverse_rule → requirement`.
2. Add edges from the downstream artifacts:
   - `requirement → component` (`designed_by`) from the component design;
   - `component → story` (`planned_in`) from the stories;
   - `story → java` (`implemented_by`) from the implementation manifest;
   - `java → test_fixture` (`tested_by`) from the fixtures;
   - `test_fixture → verification` (`verified_by`) from the equivalence assessment.
3. Check run bindings. Every `reverse_rule`, `reverse_gap` and `gap_item` node needs a `source_run` present in the manifest's `source_runs`. Otherwise record a `stale_run_binding` break. Never compare runs by catalogue number alone.
4. Walk forward from every in-scope source ID and rule. A node with no downstream edge at the expected stage is a `missing_downstream` break.
5. Walk backward from every Java element and verification. Missing upstream links are `missing_upstream` breaks.
6. Report `conflicting_reference` when the same requirement or story ID points to different sources in different artifacts. Report `unknown_id` for IDs that exist in no artifact.
7. For split rules, check that each derived requirement reaches verification. For merged rules, check that the merged requirement's verification covers every source rule.
8. Write `traceability_audit.json` (contract `forward/traceability-edges`) with all edges and breaks.

## Source grounding

Edges come only from recorded artifacts. A link is never inferred from a name similarity. A link that is plausible but not recorded is a break.

## Outputs and contracts

`traceability_audit.json`, contract `forward/traceability-edges`, with the common forward header (F7). Written in the packet output directory.

## Allowed tools and operations

Read, Grep and Glob on every trace input listed in the packet (manifest, F1 edges and requirements, F3 design, F4 stories, F5 manifest, F6 fixtures and assessment). Write only `traceability_audit.json` inside `packet.permissions.output_dir`. No Edit, no Bash, no network; traced artifacts are read-only.

## Forbidden operations

- Adding links that no artifact records.
- Modifying any traced artifact.
- Treating catalogue IDs from different reverse runs as the same item.
- Recommending acceptance with unexplained breaks.

## Error handling and stop conditions

- Missing artifacts: record a break for each and continue.
- G6 is not `PASS`: return `blocked`.
- The trace walk is incomplete: return `incomplete`.

## Quality checks

1. Every in-scope rule and source ID is either fully traced or appears in `breaks`.
2. Every reverse node has a current `source_run`.
3. Split and merged rules are fully traced.
4. Edge endpoints exist in their artifacts.

## Source-ID traceability

This skill is the final traceability check. Its edge list is the authoritative record of the chain, from COBOL source ID to verification result, for gate G7.

## Orchestrator integration

Listed in the F7 receipt with the review report. The runtime validates the edges (known permanent IDs, current run bindings). Gate G7 uses the breaks, and G8 is a human decision.
