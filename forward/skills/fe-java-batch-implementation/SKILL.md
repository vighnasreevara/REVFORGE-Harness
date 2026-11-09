---
name: fe-java-batch-implementation
description: REVFORGE F5 skill. Implements authorised, approved stories as Java 21 / Maven modules inside the authorised Java target directory, preserving approved business behaviour, COBOL numeric and data semantics, and error/return-code behaviour, with a full implementation manifest. Respects the actual application type (batch, online, service). Blocked in STEP 3.
allowed-tools: Read, Grep, Glob, Write, Edit, Bash
---

# fe-java-batch-implementation

Owned by agent **fe-java-developer** (F5). **STEP 3 restriction: no production Java is generated.** Every F5 packet is undispatchable until G2 has passed, the F4 story set validates, generation has been authorised in config, and a Java target directory has been named.

```json revforge-skill
{
  "skill": "fe-java-batch-implementation",
  "owner_agent": "F5",
  "version": "1.0",
  "output_contracts": ["forward/implementation-manifest"],
  "write_scope": "java_target_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/gates/G2-*.json",
    "workflow/agents/F4/<packet>/stories.json",
    "workflow/agents/F3/<packet>/component_design.json",
    "workflow/agents/F3/<packet>/architecture_decisions.json",
    "workflow/agents/F2/<packet>/data_mappings.json",
    "workflow/agents/F2/<packet>/file_operation_requirements.json"
  ],
  "executes": ["mvn"]
}
```

## Purpose and responsibility

Implement exactly the validated stories of the packet, as Java 21 code in a Maven build, following the approved architecture and ADRs. The code must:
- preserve the approved behaviour;
- preserve the COBOL data semantics (BigDecimal scale for implied decimals, packed and binary codecs, sign handling, fixed-length and space-padded alphanumerics);
- preserve file-status and return-code behaviour.

The skill's name does not authorise turning online CICS programs or callable services into batch jobs. The approved architecture decides the application type.

## Required input artifacts

- The G2 gate result (`PASS`), and a packet whose `permissions.generation_authorized` is true and `may_write_code` is true.
- The authorised stories (`stories.json`, readiness `ready`, validated by the runtime against G2).
- The approved component design and ADRs (F3), and the data contracts and runtime semantics (F2).
- The Java target directory given in the packet permissions.

## Input validation

1. Stop immediately with `blocked` if any of these is false:
   - the packet is dispatchable;
   - generation is authorised;
   - a target directory exists;
   - G2 is `PASS` on the packet baseline and the story set validates.
   This is always the case in STEP 3.
2. Implement only stories that are approved and `ready`. Any other story becomes a blocker.
3. Copy `inputs_used` paths and hashes from the packet.

## Execution procedure

1. Create the Maven module layout prescribed by the component design under the target directory: `pom.xml` with Java 21, and `src/main/java` and `src/test/java` inside it.
2. Implement the record codecs from the data contracts first. Use the exact `java_type` per field. Respect offsets, lengths, encoding, sign and scale. Add codec unit tests from the F2 test vectors.
3. Implement each story's processing logic exactly as its approved requirements and acceptance criteria state. Map legacy return codes and file-status values as the ADRs specify.
4. After each story, run `mvn -q -B verify` in the target directory. Record the command, exit code and a log excerpt.
5. Write `implementation_manifest.json` (contract `forward/implementation-manifest`, `record_type: "implementation"`). It lists every Java file and public symbol with its SHA-256, story IDs, requirement IDs and source refs.
6. Write `build_results.json` (`record_type: "build_results"`) with the last build outcome, `executed_by: "agent"`. Independent testing (F6) re-runs the build itself; this report alone never passes testing.

## Source grounding

Every class and method implements specific approved requirements and cites the legacy statement and paragraph IDs it reproduces. Where an approved requirement relies on an unresolved field or gap, implementation stops for that story. The behaviour is never guessed.

## Outputs and contracts

Inside the authorised Java target directory only:
- Java sources and `pom.xml`;
- `implementation_manifest.json` and `build_results.json`, both with contract `forward/implementation-manifest`.

Both JSON files carry the common forward header (F5).

## Allowed tools and operations

- Read, Grep and Glob on approved inputs.
- Write and Edit inside the Java target directory only.
- Bash only to run `mvn` in that directory.

No network beyond Maven dependency resolution that the architecture approved.

## Forbidden operations

- Writing outside the target directory.
- Touching COBOL sources, reverse outputs, `.claude/`, the forward runtime or Neo4j.
- Implementing stories outside the validated story set.
- Changing behaviour to simplify the code.
- Using float or double for COBOL numerics.
- Editing F6-owned tests.
- Reporting an unexecuted build.

## Error handling and stop conditions

- Generation not authorised: stop immediately with `blocked`. This always applies in STEP 3.
- An ambiguous story or missing contract: stop that story and report it as a blocker.
- A compiler failure: use `fe-compiler-repair` within its limits.
- A change would require a business or architecture decision: stop with `blocked`.

## Quality checks

1. Every implemented symbol traces to a story, a requirement and source refs.
2. No numeric field uses a type outside the F2 contract.
3. The build was actually executed and its result recorded.
4. No file was written outside the target directory. The runtime enforces this through its path policy.

## Source-ID traceability

The implementation manifest continues the chain `story → java` (`implemented_by`) with permanent source IDs, so F6 and F7 can trace every element back to COBOL.

## Orchestrator integration

The runtime rejects any receipt with code paths outside the target directory, or with any code at all while generation is unauthorised. The runtime accepts the F5 receipt, not this skill's own claim, before `IMPLEMENTING → IMPLEMENTATION_BUILT` is allowed; F6 then tests the build independently.
