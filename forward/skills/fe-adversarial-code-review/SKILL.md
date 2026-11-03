---
name: fe-adversarial-code-review
description: REVFORGE F7 skill. Independent adversarial review of the Java implementation and its tests for incorrect business behaviour, missing requirements, data conversion defects, numeric differences, security issues, unsupported assumptions, incomplete test coverage, wrong error handling and legacy compatibility risks. Read-only on reviewed material; recommends, never accepts.
allowed-tools: Read, Grep, Glob, Write
---

# fe-adversarial-code-review

Owned by agent **fe-independent-reviewer** (F7). Dispatchable only after gate G6 (independent verification) has passed.

```json revforge-skill
{
  "skill": "fe-adversarial-code-review",
  "owner_agent": "F7",
  "version": "1.0",
  "output_contracts": ["forward/review-report"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/agents/F1/<packet>/draft_requirements.json",
    "workflow/agents/F2/<packet>/data_mappings.json",
    "workflow/agents/F3/<packet>/architecture_decisions.json",
    "workflow/agents/F4/<packet>/stories.json",
    "<java_target_dir>/** (read-only)",
    "workflow/agents/F6/<packet>/equivalence_assessment.json"
  ],
  "executes": []
}
```

## Purpose and responsibility

Try to prove the implementation wrong. Compare the Java against the approved requirements, data contracts, ADRs, stories and executed verification. Look for:
- business-behaviour deviations;
- missing requirements;
- conversion and numeric defects;
- security issues;
- unsupported assumptions;
- weak tests;
- incorrect error handling;
- compatibility risks.

Report findings with severity and whether they block. Produce a recommendation for the human acceptance gate G8. Never modify reviewed material.

## Required input artifacts

- The approved requirements, data contracts, ADRs and stories.
- The Java sources and implementation manifest, read-only.
- The F6 verification report and equivalence assessment.
- The evidence packets and the legacy logic, for the source behaviour.

## Input validation

1. Stop with `blocked` if any of these fails:
   - G6 is `PASS`;
   - the packet is dispatchable;
   - both F7 skills are installed.
2. Every reviewed artifact must be listed in the packet with its SHA-256. A reviewed file that changed since the packet was prepared is reported as a blocking finding.
3. Copy `inputs_used` paths and hashes from the packet.

## Execution procedure

1. For each approved requirement, locate the implementing symbols through the implementation manifest. Check that the code does exactly what the requirement and the legacy logic state: values, conditions, branches, return codes.
2. For each data-contract field used, check that the Java type, scale, rounding, padding, sign and encoding match the contract.
3. Check the error handling: file-status mapping, SQLCODE handling, return codes and termination paths, against F2 and the ADRs.
4. Check security: input validation, injection in SQL or file paths, secrets in code, unsafe deserialisation.
5. Check the tests: is every acceptance criterion covered, are boundaries and invalid data tested, and is any `EQUIVALENCE_UNVERIFIED` result hidden?
6. Check the assumptions: any behaviour without requirement or ADR support.
7. Record each finding (`RV-NNN`): category, severity, `blocking`, description, the artifact path and source refs.
8. Write `blocking_findings.json` (`record_type: "blocking_findings"`) and `acceptance_recommendation.json` (`record_type: "acceptance_recommendation"`), both with contract `forward/review-report`. Set `recommend_acceptance: false` whenever a blocking finding exists, and `decided_by: "human_gate_G8"`. Write `review_report.md`.

## Source grounding

Every finding cites the requirement, contract or ADR that defines the expected behaviour, and the legacy statement or paragraph IDs. Opinions without evidence are not findings.

## Outputs and contracts

`blocking_findings.json` and `acceptance_recommendation.json` (contract `forward/review-report`, common forward header F7), plus `review_report.md`. All are written in the packet output directory.

## Allowed tools and operations

Read, Grep and Glob on every reviewed artifact listed in the packet (requirements, contracts, ADRs, stories, Java sources, F6 reports). Write only `blocking_findings.json`, `acceptance_recommendation.json` and `review_report.md` inside `packet.permissions.output_dir`. No Edit, no Bash, no network; reviewed material is read-only.

## Forbidden operations

- Modifying Java, tests, contracts, requirements or any other agent's output.
- Accepting the system or recording an approval.
- Downgrading or omitting findings to reach a positive recommendation.

## Error handling and stop conditions

- G6 is not `PASS`: return `blocked`.
- A reviewed artifact is missing or changed: blocking finding, and continue.
- The review is incomplete: return `incomplete`. Never recommend acceptance from a partial review.

## Quality checks

1. Every approved requirement was reviewed.
2. Every finding has evidence and a severity.
3. `recommend_acceptance` is false whenever any blocking finding exists.
4. `decided_by` is the human gate.

## Source-ID traceability

Findings cite permanent source IDs and requirement IDs. Together with `fe-end-to-end-trace-audit`, this closes the chain from source to verification.

## Orchestrator integration

Listed in the F7 receipt and validated by the runtime. Gate G7 evaluates the review in the runtime. Acceptance is gate G8, by a human.
