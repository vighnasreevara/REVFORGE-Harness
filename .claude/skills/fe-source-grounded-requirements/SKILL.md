---
name: fe-source-grounded-requirements
description: REVFORGE F1 skill. Turns the reverse-engineering business rules, logic and evidence for the units of one dispatch packet into draft, source-grounded forward requirements with complete rule coverage and traceability edges. Never approves, never invents behaviour.
allowed-tools: Read, Grep, Glob, Write
---

# fe-source-grounded-requirements

Owned by agent **fe-requirements-analyst** (F1). Executed only on a dispatchable packet prepared by the REVFORGE Forward Orchestrator.

```json revforge-skill
{
  "skill": "fe-source-grounded-requirements",
  "owner_agent": "F1",
  "version": "1.0",
  "output_contracts": ["forward/requirements", "forward/traceability-edges"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/extracts/<packet>/rules_extract.json",
    "workflow/extracts/<packet>/gaps_extract.json",
    "workflow/extracts/<packet>/program_context.json",
    "output/rules/rules_artifact.json",
    "output/logic/logic_artifact.json",
    "output/logic/program_logic/*_logic.json",
    "output/final_report/brd.md",
    "forward/runs/<run>/evidence_packets/*.json",
    "forward/runs/<run>/baseline_manifest.json"
  ],
  "executes": []
}
```

## Purpose and responsibility

Produce **draft** forward requirements for exactly the units (programs) listed in the packet, grounded in the reverse rules, the per-program logic and the evidence packets. Every in-scope reverse rule receives exactly one disposition in `rule_coverage`, so that no recovered behaviour is silently discarded, and every requirement traces back to its rules and to permanent COBOL source IDs. Calculations, validations, routing decisions, limit checks, error handling and compliance behaviour are preserved as the reverse evidence states them. Nothing here is approved: approval happens only at gate G2 by a human.

## Required input artifacts

All paths come from the dispatch packet (`inputs[].files[].path`) and are relative to the repository root:
- `workflow/extracts/<packet>/rules_extract.json` — the verbatim rule objects in scope (`rules`), the list `rules_in_scope`, and `source_run` (the run binding for every `BR-`/`RS-` reference);
- `workflow/extracts/<packet>/gaps_extract.json` — gaps and expanded items (used for `gap_items` and open-decision links);
- `workflow/extracts/<packet>/program_context.json` — classification, modernization scope, entry types, logic file and evidence packet per unit;
- per-program logic files (`output/logic/program_logic/<FILE_ID>__<PROGRAM>_logic.json`): `program_narrative`, `paragraphs[].pseudocode`, `branch_map`, `paragraph_id`/`statement_ids`;
- evidence packets (`forward/runs/<run>/evidence_packets/*.json`) and the BRD (`output/final_report/brd.md`, supporting documentation only);
- the baseline manifest (its SHA-256 is the packet's `baseline.manifest_sha256`).

## Input validation

1. Read the packet. Stop with outcome `blocked` if `dispatchable` is false, if either skill status is not `INSTALLED`, or if any required input has `present: false`.
2. Read `rules_extract.json`. Confirm that every ID in `rules_in_scope` has a rule object in `rules`; if not, stop with `blocked` (the extract is inconsistent).
3. Confirm that `rules_extract.source_run` and `gaps_extract.source_run` are non-empty; these keys bind every run-local ID you write.
4. Record every input file you actually read in `inputs_used`, copying `path` and `sha256` exactly from the packet (you cannot compute hashes; never alter them).
5. If `packet.source.available` is false, you may not use `verified_from_source` anywhere.

## Execution procedure

1. For each unit in `packet.units`, read its logic file and evidence packet so that you understand what the program does (narrative, entry types, paragraphs, readiness, classification).
2. Walk `rules_in_scope` in order. For each rule read its `name`, `description`, `condition`, `outcomes`, `confidence`, `requires_sme_review`, `dead_code`, `sources[].evidence` and `sources[].source_ids`.
3. Compute the rule's evidence class exactly as the runtime does: **uncertain** if confidence is `low`, any source evidence is not `complete`, `requires_sme_review` is true, or `dead_code` is true; otherwise **inferred** if confidence is `medium`; otherwise **confirmed**.
4. Choose one disposition per rule:
   - `mapped` — the rule describes executable business behaviour of an in-scope program whose classification is an application candidate. Create or extend one or more requirements (one rule may produce several requirements; several rules may merge into one requirement).
   - `deferred_scope` — the only implementing programs are classified template, test tool, utility or uncertain (`modernization_scope: requires_scope_decision`). Reference the scope decision request.
   - `deferred_decision` — the rule is uncertain (low confidence, partial evidence, SME flag, dead code) and its meaning must be decided before it can be a requirement. Reference a decision request.
   - `not_a_requirement` — a technical declaration with no business behaviour (for example a value domain that no code tests). State why.
   - `contradictory` — the rule conflicts with another rule or with the logic; add a `contradictions` entry and a decision request.
5. Write each requirement:
   - `requirement_id`: `REQ-<UNIT NAME>-NNN`, NNN restarting at 001 per unit, using a unit name from this packet (IDs must not collide with other batches);
   - `statement`: the behaviour in plain business language, including exact values, limits, codes and arithmetic from the rule and logic, never improved or generalised;
   - `category`: the rule category (or DATA / INTERFACE / PROCESSING for a requirement drawn from logic without a rule);
   - `status: "draft"`, `approval_status: "not_approved"`;
   - `evidence_class` no stronger than the weakest derived rule, `confidence` no higher than the lowest derived rule, `requires_sme_review: true` if any derived rule has it;
   - `evidence_status`: `reverse_artifact_supported` by default; `verified_from_source` only if the source is available and you read the cited lines; `inferred` for logic-derived requirements; `unresolved` when evidence is missing;
   - `derived_from_rules`: `{ "id": "BR-…", "scope": "run-local", "source_run": "<rules_extract.source_run>" }`;
   - `source_refs`: copied from the rule's `sources[].source_ids` (only `file_id`, `path_id`, `section_id`, `paragraph_id`, `statement_id`, `record_id`, `field_id`, plus `relative_path`/`line` when known) and the condition's `subject_field_id` as `field_id`;
   - `units`: the packet units the behaviour belongs to; `open_decisions`: DR IDs that constrain it; `gap_items`: related `GAP-NNN#NN` items.
6. Fill `rule_coverage` with exactly one entry per rule in `rules_in_scope`, listing every requirement ID that derives from the rule (and every decision request for deferred or contradictory rules), with a concrete `reason`.
7. Fill `coverage_summary` by counting: `rules_in_scope`, `mapped`, `deferred` (= deferred_scope + deferred_decision), `not_a_requirement`, `contradictory`, `requirements`.
8. Write `draft_requirements.json` (contract `forward/requirements`).
9. Write `evidence_references.json` (contract `forward/traceability-edges`): for every requirement add edges `source_id → reverse_rule` (`extracted_from`), `reverse_rule → requirement` (`derived_from`, or `split_from`/`merged_from` for one-to-many/many-to-one), and `requirement → decision_request` (`constrained_by`); reverse nodes carry `source_run`. List rules with no requirement as `breaks` with problem `missing_downstream` and a detail naming the disposition.

## Source grounding

Requirements state only what the reverse rules, logic pseudocode and evidence packets show. Do not add validations, defaults, error messages or arithmetic that are not in the evidence. Where the logic references a paragraph that is missing from the source, an undeclared data name or a missing copybook, the requirement records the gap item and an open decision instead of guessing. The BRD is supporting documentation; when it disagrees with the structured artifacts, the artifacts win and the disagreement becomes a contradiction.

## Outputs and contracts

Write only inside `packet.permissions.output_dir`:
- `draft_requirements.json` — contract `forward/requirements` (`forward/contracts/forward/requirements.schema.json`);
- `evidence_references.json` — contract `forward/traceability-edges`.

Both start with the common header: `contract`, `contract_version: "1.0"`, `authoring_agent: {"id":"F1","name":"fe-requirements-analyst"}`, `packet_id`, `baseline` (run_id and manifest_sha256 copied from the packet), `generated_at` (ISO-8601 UTC), `skills_used`, `inputs_used`, `units_covered` (exactly `packet.units`), `unresolved_findings`.

## Allowed tools and operations

Read, Grep and Glob on the packet inputs and the repository; Write only inside the packet's `output_dir`. No Bash, no network, no Neo4j.

## Forbidden operations

- Approving requirements or writing `approved`, `approval`, gate or sign-off fields or values.
- Creating, renumbering or repairing permanent source IDs, or citing an ID that is not in the inputs.
- Binding a `BR-`/`GAP-` ID to any run other than the extract's `source_run`.
- Dropping an in-scope rule, raising confidence, or clearing an SME flag.
- Writing outside the output directory, writing code, or modifying reverse artifacts or COBOL sources.

## Error handling and stop conditions

- Inconsistent extract, missing input or undispatchable packet: stop, write no deliverables, return outcome `blocked` with the reason in `blockers`.
- A rule you cannot interpret: disposition `deferred_decision` with a decision request; never guess.
- Running out of capacity before every in-scope rule is covered: return outcome `incomplete` and list what is missing; never return `completed` with partial coverage.

## Quality checks

Before returning: (1) every `rules_in_scope` ID appears exactly once in `rule_coverage`; (2) every `mapped` entry names at least one requirement and every requirement's derived rules list it back; (3) no requirement's class/confidence exceeds its rules and SME flags are preserved; (4) `coverage_summary` counts match; (5) every requirement has at least one `source_refs` entry with a File ID; (6) `units_covered` equals the packet units; (7) both files are valid JSON. The runtime repeats these checks and rejects the receipt on any failure.

## Source-ID traceability

Permanent IDs (`SYS-…-FIL-NNNN`, `-PAR-`, `-STMT-`, `-REC-`, `-FLD-`, `-PATH-`) are copied character for character; a `null` stays `null`. Run-local IDs are always objects with `scope: "run-local"` and the extract's `source_run`. Split and merged rules are expressed with one-to-many and many-to-one `derived_from_rules` and the matching traceability relations.

## Orchestrator integration

The runtime prepared the packet, extracts and output directory. After writing the deliverables, write `receipt.json` at `packet.receipt_path` with contract `agent-receipt`: `packet_id`, `agent: "F1"`, `outcome`, `outputs` (each `{ "path": <repo-relative path>, "sha256": null, "contract": "<contract>" }` — the runtime computes the hashes), `skills_used` (both F1 skills with status `INSTALLED`), `findings`, `blockers`. The operator records it with `workflow record`; only the runtime accepts receipts, updates the coverage ledger and moves the workflow state.
