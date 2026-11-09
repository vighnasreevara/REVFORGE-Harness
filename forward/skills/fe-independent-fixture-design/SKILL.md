---
name: fe-independent-fixture-design
description: REVFORGE F6 skill. Designs independent test fixtures from original source evidence and approved requirements - normal, boundary, invalid data, numeric precision, rounding, file behaviour, error cases, return codes, restart/checkpoint and online interaction - with expected results that are never derived from the generated Java.
allowed-tools: Read, Grep, Glob, Write
---

# fe-independent-fixture-design

Owned by agent **fe-independent-tester** (F6). Dispatchable only after the F5 implementation has been built (accepted F5 receipt).

```json revforge-skill
{
  "skill": "fe-independent-fixture-design",
  "owner_agent": "F6",
  "version": "1.0",
  "output_contracts": ["forward/test-fixture-manifest"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/agents/F1/<packet>/draft_requirements.json",
    "workflow/agents/F2/<packet>/data_mappings.json",
    "workflow/agents/F2/<packet>/file_operation_requirements.json",
    "workflow/agents/F4/<packet>/stories.json",
    "output/logic/program_logic/*_logic.json",
    "<packet.source.root>/<unit relative_path> (when available)"
  ],
  "executes": []
}
```

## Purpose and responsibility

Specify the independent test cases that decide whether the Java implementation reproduces the approved legacy behaviour. Expected results come from:
- the source semantics;
- the approved requirements;
- or captured COBOL reference output.

They never come from running or reading the F5 Java. Coverage spans:
- normal paths and boundaries;
- invalid data;
- numeric precision and rounding;
- file behaviour;
- error cases and return codes;
- restart/checkpoint;
- online interaction, where relevant.

## Required input artifacts

- The approved requirements (G1) and the validated story acceptance criteria (F4).
- The F2 data contracts (types, scales, test vectors) and runtime semantics (file status, return codes, commits).
- The per-program logic files and, when available, the original source.
- Captured COBOL reference outputs, if the packet lists any.

## Input validation

1. Stop with `blocked` if any of these fails:
   - an accepted F5 receipt exists (the workflow is in `IMPLEMENTATION_BUILT` or `TESTING`);
   - the packet is dispatchable;
   - both F6 skills are installed.
2. Exclude requirements that are not approved, and list them in `unresolved_findings`.
3. Do not open F5 sources to derive expected values. The fixture's `derived_from_java` must be `false`.

## Execution procedure

1. For each approved requirement and each acceptance criterion, derive fixtures (`FIX-NNN`) per category:
   - **normal**: a representative valid input;
   - **boundary**: limits from the PIC sizes, OCCURS bounds and LIMIT_CHECK rules;
   - **invalid_data**: non-numeric data in numeric fields, values outside the 88-level sets;
   - **numeric_precision** and **rounding**: COMPUTE with ROUNDED versus truncation, scale handling for implied decimals, packed-decimal sign nibbles;
   - **file_behavior**: missing file, end of file, duplicate key, record not found;
   - **error_case** and **return_code**: each RETURN-CODE value set by the program;
   - **restart_checkpoint**: where F2 recorded checkpoint or commit behaviour;
   - **online_interaction**: COMMAREA in and out, HANDLE CONDITION paths.
2. For each fixture, write:
   - `input_description` and `expected_result`;
   - `expected_result_basis`: `source_semantics`, `approved_requirement` or `captured_cobol_reference`;
   - `requirement_ids` and `source_refs` (statement and paragraph IDs).
3. Where an expected result cannot be grounded, do not write the fixture. Record an unresolved finding instead.
4. Write `test_fixture_manifest.json` (contract `forward/test-fixture-manifest`). Write the fixture data files under the packet output directory.

## Source grounding

Expected values follow COBOL semantics as stated in the evidence: MOVE truncation and padding, decimal alignment, ROUNDED, SIZE ERROR, file-status codes, and the program's own return codes. When the semantics depend on compiler options or runtime settings that are not in the evidence, the fixture is not written and an unresolved finding records the dependency.

## Outputs and contracts

`test_fixture_manifest.json`, contract `forward/test-fixture-manifest`, with the common forward header (F6), plus the fixture data files. Everything is written in the packet output directory only.

## Allowed tools and operations

- Read, Grep and Glob on approved requirements, contracts, logic and source.
- Write in the packet output directory.

No Bash in this skill. Test execution belongs to `fe-legacy-java-equivalence`.

## Forbidden operations

- Deriving expected results from the generated Java or its test output.
- Writing to the Java target directory or repairing implementation code.
- Inventing expected values without a basis.
- Modifying other agents' outputs.

## Error handling and stop conditions

- The implementation has not been built, or approved inputs are missing: return `blocked`.
- No grounded expectation for a requirement: record an unresolved finding and continue.
- Not every approved requirement has at least one fixture or finding: return `incomplete`.

## Quality checks

1. Every fixture has `derived_from_java: false`, a basis, requirement IDs and source refs.
2. Every approved requirement has a fixture or an explicit finding.
3. Every category relevant to the requirement's behaviour is covered.

## Source-ID traceability

Fixtures cite the requirement IDs and the legacy statement and paragraph IDs they exercise. This continues the chain `story/java → test_fixture` (`tested_by`).

## Orchestrator integration

The fixture manifest is listed in the F6 receipt. `fe-legacy-java-equivalence` executes the fixtures. The runtime validates the outputs. The runtime moves the work to review only when the executed tests pass and no requirement is `DIFFERENT`.
