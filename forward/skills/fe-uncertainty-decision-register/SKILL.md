---
name: fe-uncertainty-decision-register
description: REVFORGE F1 skill. Builds the unresolved-decision register and blocker report for one dispatch packet from gaps, expanded gap items, confidence and SME flags, contradictions and scope questions. Records decisions to be made; never makes them.
allowed-tools: Read, Grep, Glob, Write
---

# fe-uncertainty-decision-register

Owned by agent **fe-requirements-analyst** (F1). Run after `fe-source-grounded-requirements` on the same dispatchable packet.

```json revforge-skill
{
  "skill": "fe-uncertainty-decision-register",
  "owner_agent": "F1",
  "version": "1.0",
  "output_contracts": ["forward/decision-requests"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/extracts/<packet>/gaps_extract.json",
    "workflow/extracts/<packet>/rules_extract.json",
    "workflow/extracts/<packet>/program_context.json",
    "<output_dir>/draft_requirements.json",
    "output/final_report/gaps_register.json",
    "forward/runs/<run>/decision_backlog.json"
  ],
  "executes": []
}
```

## Purpose and responsibility

Identify every ambiguity, conflict, missing behaviour and scope question that stands between the reverse evidence and approvable requirements for the packet's units, and record each as an **open** decision request addressed to the right decision maker (business SME or technical owner), with its real blocking impact. Grouped gaps keep all of their individual affected items. This skill never decides, never approves and never closes a decision.

## Required input artifacts

- `workflow/extracts/<packet>/gaps_extract.json`: `gaps` (verbatim register entries), `expanded_items` (`item_id`, `gap_id`, `severity`, `reference_status`, `detail`), `assumptions`, `source_run`;
- `workflow/extracts/<packet>/rules_extract.json` (confidence, SME flags, `source_run`);
- `workflow/extracts/<packet>/program_context.json` (classification and modernization scope per unit);
- the `draft_requirements.json` you produced in the same packet output directory (requirement IDs, deferred and contradictory rules);
- `scope.gaps_in_scope` in the packet.

## Input validation

1. The packet must be dispatchable and both F1 skills `INSTALLED`; otherwise stop with `blocked`.
2. `draft_requirements.json` must exist in the output directory and be valid JSON; if not, run `fe-source-grounded-requirements` first or stop with `incomplete`.
3. Every gap ID in `packet.scope.gaps_in_scope` must appear in `gaps_extract.gaps`; every `expanded_items[].gap_id` must be one of those gaps.
4. Copy the `path`/`sha256` of every input you read into `inputs_used` exactly as listed in the packet.

## Execution procedure

1. **Gap decisions.** For every gap in scope with severity `critical` or `high`, create one decision request (`DR-<UNIT>-NNN`) whose `gap_refs` contains `{ "gap": {"id","scope":"run-local","source_run": gaps_extract.source_run}, "items": [all of its GAP-NNN#NN items], "all_items_included": true }`. Medium/low or SME-flagged gaps may also get requests when they affect requirements. If you deliberately split one grouped gap across several requests, set `all_items_included: false` and give `excluded_items_reason` naming where the remaining items are handled.
2. **Rule decisions.** For every rule that `draft_requirements.json` marks `deferred_decision` or `contradictory`, create a `business` decision asking the SME to confirm, correct or reject the stated behaviour; quote the rule condition and outcome, cite its source IDs in `source_refs`, and add the rule to `rule_refs`.
3. **Scope decisions.** For every unit whose classification is not an application candidate, create a `scope` decision asking whether it is modernised, retired, replaced by a framework service or kept as test tooling.
4. **Technical decisions.** Record technical questions (missing copybooks, undeclared data names, runtime-only CICS transfers, recursive PERFORMs, unstructured PERFORM THRU ranges) as `technical` decisions with the related gap items.
5. **Blocking.** Mark `blocking: true` only when a requirement or unit cannot be specified without the answer (critical gaps, missing source or copybooks that hold the behaviour, contradictions in mapped rules); otherwise `false`. Always explain the decision in `blocking_rationale`.
6. Fill `affected_requirements` (IDs from `draft_requirements.json`), `affected_units`, `evidence_status` (usually `unresolved` or `reverse_artifact_supported`), `raised_by_skill: "fe-uncertainty-decision-register"`, `status: "open"`.
7. Write `blocker_report`: `blocking_count`, `nonblocking_count`, `blocking_decisions` (exactly the blocking IDs) and a one-paragraph `summary`.
8. Write `uncertainty_decision_register.json` (contract `forward/decision-requests`). Update `draft_requirements.json` `open_decisions` and `rule_coverage[].decision_requests` so both files reference the same DR IDs.

## Source grounding

Each decision quotes the evidence that creates the uncertainty: the gap description and items, the rule text, the conflicting values or the missing paragraph names. Options, when offered, come from the evidence (for example the two conflicting value sets); never invent a preferred answer.

## Outputs and contracts

Write `uncertainty_decision_register.json` with contract `forward/decision-requests` inside `packet.permissions.output_dir`, with the common forward header (`authoring_agent` F1, `packet_id`, `baseline`, `generated_at`, `skills_used`, `inputs_used`, `units_covered` = packet units, `unresolved_findings`).

## Allowed tools and operations

Read, Grep and Glob on packet inputs; Write inside the output directory only (including the consistency update to `draft_requirements.json`). No Bash, no network, no Neo4j.

## Forbidden operations

- Answering, closing or approving a decision; any status other than `open`.
- Treating a gap as resolved because it was expanded or referenced.
- Dropping gap items, inventing items, or binding a gap to another run.
- Writing outside the output directory or modifying reverse artifacts.

## Error handling and stop conditions

- A gap whose items are missing from the extract: record an `unresolved_findings` entry and continue; do not fabricate items.
- Requirements file missing or invalid: stop with outcome `incomplete`.
- Any input missing: stop with `blocked`.

## Quality checks

(1) every critical/high gap in scope is referenced by at least one decision; (2) every listed item belongs to its gap and full sets are marked `all_items_included: true`; (3) blocker counts and lists match the decisions; (4) every `affected_requirements` ID exists in `draft_requirements.json`; (5) all statuses are `open`. The runtime rejects the receipt if any check fails.

## Source-ID traceability

`source_refs` copy permanent IDs exactly from the gap `source_ids`, item details and rule sources. Gap, item and rule references are run-local and carry the extract's `source_run`. Gap item IDs keep the `GAP-NNN#NN` form so that every individual affected item remains addressable after grouping.

## Orchestrator integration

This skill's output is listed in the same F1 receipt as the requirements. The runtime validates both together (cross-references between DR IDs and requirement IDs), records provenance, and later feeds the open decisions into gate G1, where a human decides. The agent never evaluates a gate.
