---
name: fe-legacy-java-equivalence
description: REVFORGE F6 skill. Compares the behaviour of the generated Java with trustworthy COBOL reference behaviour (output values, file bytes, record order, return codes, errors, numeric results, persistent state, side effects). Without a trusted COBOL execution or captured reference it reports EQUIVALENCE_UNVERIFIED, never equivalence from compilation or unit tests alone.
allowed-tools: Read, Grep, Glob, Write, Bash
---

# fe-legacy-java-equivalence

Owned by agent **fe-independent-tester** (F6). Run after `fe-independent-fixture-design`, once the F5 implementation has been built.

```json revforge-skill
{
  "skill": "fe-legacy-java-equivalence",
  "owner_agent": "F6",
  "version": "1.0",
  "output_contracts": ["forward/verification-report"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/agents/F6/<packet>/test_fixture_manifest.json",
    "<java_target_dir>/** (read and execute only)",
    "captured COBOL reference outputs listed in the packet"
  ],
  "executes": ["mvn"]
}
```

## Purpose and responsibility

Run the independent fixtures against the Java build. For each requirement, decide `EQUIVALENT`, `DIFFERENT` or `EQUIVALENCE_UNVERIFIED`:
- `EQUIVALENT` requires comparison with trustworthy reference evidence, meaning captured COBOL outputs or execution logs with their hashes.
- When no trusted reference exists, the status is `EQUIVALENCE_UNVERIFIED`. This holds even if all Java tests pass.

The skill never repairs the implementation.

## Required input artifacts

- `test_fixture_manifest.json` and the fixture data from this packet.
- The built Java in the target directory, used read-only.
- Captured COBOL reference outputs or execution logs, if any are listed as packet inputs, with their SHA-256 values.
- The approved requirements.

## Input validation

1. Stop with `blocked` if the implementation has not been built, the packet is not dispatchable, or the fixture manifest is missing or invalid.
2. Verify that every reference artifact's SHA-256 matches the packet. A reference that does not match is untrusted and gives `EQUIVALENCE_UNVERIFIED`.
3. Copy `inputs_used` paths and hashes from the packet.

## Execution procedure

1. Run the fixtures as JUnit tests from your own test sources. Write them in your output directory and point the build at them; never edit F5 sources. Use `mvn -q -B test`.
2. Record each run in `test_runs`: command, exit code, test, failure, error and skip counts, and the timestamp. Write `junit_results.json` (`record_type: "junit_results"`).
3. For each requirement, compare the Java results with the reference evidence on the relevant aspects:
   - output values;
   - output file bytes;
   - record ordering;
   - return codes;
   - error behaviour;
   - numeric results (exact scale);
   - persistent state;
   - side effects.

   List the aspects compared and every difference found.
4. Set the status:
   - `EQUIVALENT` only with at least one trusted reference and no differences;
   - `DIFFERENT` when there are differences;
   - `EQUIVALENCE_UNVERIFIED` when there is no trusted reference.
5. Write `equivalence_assessment.json` (`record_type: "equivalence_assessment"`) and `unresolved_test_findings.json` (`record_type: "unresolved_findings"`), both with contract `forward/verification-report`. Write `verification_report.md`.

## Source grounding

Equivalence claims rest only on executed comparisons with hashed reference artifacts. Compilation success, Java unit tests and code similarity are recorded as test results, never as equivalence evidence.

## Outputs and contracts

`junit_results.json`, `equivalence_assessment.json` and `unresolved_test_findings.json` (contract `forward/verification-report`, common forward header F6), plus `verification_report.md`. All are written in the packet output directory.

## Allowed tools and operations

- Read on the fixtures, the build and the references.
- Bash only for `mvn` test execution.
- Write in the packet output directory.

The Java target directory is read-only for this agent.

## Forbidden operations

- Editing, repairing or reformatting implementation code or F5 build files.
- Reporting `EQUIVALENT` without trusted reference evidence.
- Hiding failing tests.
- Modifying other agents' outputs.

## Error handling and stop conditions

- The build does not run: record `test_runs` with the observed exit code, then stop with `failed`.
- Reference evidence is missing or untrusted: `EQUIVALENCE_UNVERIFIED`. That is not an error.
- The implementation has not been built: return `blocked`.

## Quality checks

1. Every `EQUIVALENT` has at least one reference with a SHA-256 and at least one compared aspect. The contract enforces this.
2. Test counts match the JUnit reports.
3. Every `DIFFERENT` lists its differences.
4. No file was written outside the output directory.

## Source-ID traceability

Each equivalence entry names its requirement ID. Through the fixture manifest it links to source refs, continuing `test_fixture → verification` (`verified_by`).

## Orchestrator integration

The runtime reads the executed evidence: a `DIFFERENT` result stops the work from moving to review. An `EQUIVALENCE_UNVERIFIED` result is reported to the F7 reviewer and must be addressed in the review. F6's receipt never moves the workflow by itself.
