---
name: fe-compiler-repair
description: REVFORGE F5 skill. Controlled compilation repair - diagnoses actual compiler failures, applies only behaviour-neutral technical corrections inside the authorised Java target directory, reruns the build and affected tests, and logs every change; stops when a fix would need an architectural or business decision. Blocked in STEP 3.
allowed-tools: Read, Grep, Glob, Write, Edit, Bash
---

# fe-compiler-repair

Owned by agent **fe-java-developer** (F5). Used only inside an authorised F5 implementation run. **No Java generation or repair runs in STEP 3.**

```json revforge-skill
{
  "skill": "fe-compiler-repair",
  "owner_agent": "F5",
  "version": "1.0",
  "output_contracts": ["forward/implementation-manifest"],
  "write_scope": "java_target_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "<java_target_dir>/**",
    "workflow/agents/F2/<packet>/data_mappings.json",
    "workflow/agents/F3/<packet>/architecture_decisions.json"
  ],
  "executes": ["mvn"]
}
```

## Purpose and responsibility

Get the authorised implementation to compile without changing what it does. Repairs are limited to technical problems: imports, generics, type mismatches that the F2 contract already decides, missing accessors, syntax. Every change is logged with its diagnostic and its rebuild result. The skill stops as soon as a fix would change business behaviour, a data type, an interface or the architecture.

## Required input artifacts

- The actual compiler output from `mvn -q -B verify` in the Java target directory.
- The sources in the target directory, and the implementation manifest.
- The F2 data contracts, the authority for types, and the F3 ADRs, the authority for behaviour and structure.

## Input validation

1. The packet must be dispatchable with generation authorised and a target directory set. Otherwise stop with `blocked`; this always applies in STEP 3.
2. Repair only failures reproduced by a build you ran yourself. Never repair from a remembered or reported error.
3. The files to change must lie inside the target directory and must not be F6-owned tests.

## Execution procedure

1. Run `mvn -q -B verify`. Capture each diagnostic: file, line and message.
2. Classify each diagnostic:
   - **technical**: import, syntax, visibility, generic bound, or a type already prescribed by the data contract;
   - **behavioural**: logic, values, control flow;
   - **architectural**: interfaces, modules, dependencies.
3. For technical diagnostics only, apply the smallest edit that resolves them. Record `diagnostic`, `file`, `change` and `behavior_neutral: true`.
4. Re-run the build and the tests of the affected module. Record `rebuild_exit_code`.
5. Repeat until the build passes, or until a diagnostic is behavioural or architectural. In that case stop and report a blocker naming the decision needed.
6. Update `build_results.json` (contract `forward/implementation-manifest`, `record_type: "build_results"`): append to `build.repairs`, set the final exit code, and record the new SHA-256 of every changed file in the implementation manifest.

## Source grounding

Each repair cites the compiler diagnostic that caused it. Type fixes cite the F2 field contract that prescribes the type. No repair alters a value, condition, return code or file-status mapping that traces to a requirement.

## Outputs and contracts

- Updated `build_results.json` and `implementation_manifest.json` (contract `forward/implementation-manifest`), in the target directory.
- The repaired sources, in the target directory only.

## Allowed tools and operations

- Read, Grep and Glob on the target directory and the contracts.
- Edit and Write inside the target directory.
- Bash only for `mvn` builds and tests there.

## Forbidden operations

- Changing business behaviour, numeric types or scales, interfaces or module structure to make the build pass.
- Deleting or weakening tests, or editing F6-owned tests.
- Suppressing compiler checks.
- Writing outside the target directory.
- Reporting a passing build that was not observed.

## Error handling and stop conditions

- Behavioural or architectural diagnostics: stop with `blocked` and name the required decision.
- The same diagnostic persists after three attempts: stop with `failed` and attach the diagnostic.
- Generation not authorised: stop with `blocked`.

## Quality checks

1. Every repair is behaviour-neutral and logged with its diagnostic and rebuild result.
2. The final exit code is the one actually observed.
3. Changed files have updated hashes in the manifest.
4. No test was removed or disabled.

## Source-ID traceability

Repairs keep the manifest's story, requirement and source-ID links of each symbol. A repaired symbol keeps its trace; nothing is re-attributed.

## Orchestrator integration

Repairs are reported in the F5 receipt. Gate G5 re-executes the build in the runtime. Repairs never move the workflow state themselves.
