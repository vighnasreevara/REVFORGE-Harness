---
name: fe-cobol-runtime-file-semantics
description: REVFORGE F2 skill. Documents the legacy runtime behaviour of each program in a dispatch packet - execution model (batch, online CICS, callable service, template, utility, test tool), file organisation, access mode, OPEN/READ/WRITE/REWRITE/CLOSE operations, file status handling, DB2 and CICS interfaces, JCL dependencies, return codes and restart - with source-grounded evidence.
allowed-tools: Read, Grep, Glob, Write
---

# fe-cobol-runtime-file-semantics

Owned by agent **fe-data-mapping-specialist** (F2). Executed on the same dispatchable packet as `fe-copybook-layout-contract`.

```json revforge-skill
{
  "skill": "fe-cobol-runtime-file-semantics",
  "owner_agent": "F2",
  "version": "1.0",
  "output_contracts": ["forward/file-runtime-semantics"],
  "write_scope": "agent_output_dir",
  "reads": [
    "workflow/packets/<packet>.json",
    "workflow/extracts/<packet>/file_context.json",
    "workflow/extracts/<packet>/data_extract.json",
    "output/inventory/inventory_artifact.json",
    "output/parser/raw_structure/*.json",
    "output/logic/program_logic/*_logic.json",
    "<packet.source.root>/<unit relative_path> (only when packet.source.available)"
  ],
  "executes": []
}
```

## Purpose and responsibility

For every program unit in the packet, record how the program actually runs. That covers its execution model, its files and their operations, its status-code handling, its DB2 and CICS interfaces, its call and JCL dependencies, return codes, checkpoint/restart behaviour and termination. The result is compatibility requirements that a Java design must honour. The procedure classifies programs from evidence: it does not assume that every COBOL program becomes a plain Java batch job. Copybook units in the packet have no runtime behaviour and are not listed here.

## Required input artifacts

- `workflow/extracts/<packet>/file_context.json`. Per program unit it holds `file_control_entries` (SELECT name, ASSIGN target, line), `file_section` (FD entries), `entry_types` (from the logic agent), `calls_out`, `includes`, `jcl_jobs`, and the paths of the raw-structure and logic files.
- The per-program logic file. Read `paragraphs[].pseudocode` together with `pseudocode_statement_ids` and `statement_ids`, plus `branch_map`, `execution_traces`, `program_narrative` and `trace_issues`.
- The raw-structure file (`procedure_division`, `control_flow_graph`).
- The original source under `packet.source.root` when it is available. Use it for the ORGANIZATION, ACCESS MODE, RECORD KEY and FILE STATUS clauses that the reverse artifacts do not carry.

## Input validation

1. Stop with `blocked` if the packet is not dispatchable, a skill is not installed or a required input is missing.
2. Check that each program unit has a logic file and a raw-structure file listed under its `program:<name>` input. If one is missing, record the program with `execution_model: "unknown"` and an unresolved question.
3. Copy the `path` and `sha256` of each input you read into `inputs_used`, exactly as the packet gives them.

## Execution procedure

1. **Execution model.** Derive it from the evidence, in this order: `entry_types`, the narrative's first sentence, the PROCEDURE DIVISION USING/LINKAGE, CICS RETURN/LINK usage, JCL steps and classification.
   - Map batch_main to `batch_main`; called/batch subprogram to `batch_subprogram` or `callable_service`; CICS online to `online_cics_transaction` or `online_cics_subprogram`.
   - Use `template`, `utility` or `test_tool` when the classification says so.
   - Use `empty` when the source is empty.
   Record the basis and source refs in `execution_model_evidence`.
2. **Files.** For each SELECT entry, record `select_name` and `assign_to`.
   - Take `organization`, `access_mode`, `record_key` and `file_status_field` from the source when it is available (`verified_from_source`).
   - Otherwise take them from logic or pseudocode evidence (`reverse_artifact_supported` or `inferred`), or set `unknown` (`unresolved`).
   - Link the record IDs of the FD record from `data_extract.json` where the FD's record is known.
3. **Operations.** Scan the program's paragraphs for OPEN, READ, WRITE, REWRITE, DELETE, START and CLOSE against each file.
   - Record each one with its `statement_id` (from `pseudocode_statement_ids`), `paragraph_id`, open `mode` and evidence status.
   - Never cite a statement or paragraph ID from another program.
4. **Status codes.** List the file-status values the code tests (`'00'`, `'10'`, `'23'` and so on) in `status_codes_handled`. Describe AT END and INVALID KEY handling in the compatibility requirements.
5. **DB2.** Where the logic shows EXEC SQL, record the statements (type, table, host variables, statement ID). Also record how SQLCODE is checked and the COMMIT/ROLLBACK behaviour. SQLCODE without a Field ID is a precompiler-provided item: note that, and never invent an ID.
6. **CICS.** Record LINK, XCTL, RETURN (TRANSID), HANDLE CONDITION and RESP usage, and the COMMAREA layout name. A HANDLE CONDITION transfer is runtime-only behaviour and must be stated as such.
7. **Return codes and termination.** Record RETURN-CODE values set, GOBACK or STOP RUN paths, and error routines that do or do not stop processing.
8. **Checkpoint and restart.** Record any checkpoint/restart calls or commit intervals; write `null` when there are none.
9. **Dependencies.** Record `call_dependencies` from `calls_out` (target, type, resolved, target File ID, statement ID if known) and `jcl` from `jcl_jobs`.
10. **Compatibility requirements.** Write one entry for each behaviour that Java must reproduce: file status semantics, record ordering, key access, return codes, commit points, COMMAREA exchange. Each entry needs at least one source ref and an evidence status.
11. **Unresolved questions.** Add one finding for each runtime fact that cannot be determined: missing paragraphs, organisation not stated, runtime-only transfers, recursive PERFORMs.
12. Write `file_operation_requirements.json` (contract `forward/file-runtime-semantics`), with one `programs[]` entry per program unit.

## Source grounding

Every operation cites the statement that performs it. Every execution model cites the evidence that determines it. When the reverse logic says a target paragraph is missing or a call is unresolved, the semantics record that gap rather than assuming what the missing code did. Source text is cited only when it was actually read (packet `source.available`).

## Outputs and contracts

Write `file_operation_requirements.json`, with contract `forward/file-runtime-semantics`, inside `packet.permissions.output_dir`. Give it the common forward header (F2, the packet, the baseline, `units_covered` equal to the packet units including copybook units, `inputs_used` and `unresolved_findings`).

## Allowed tools and operations

- Read, Grep and Glob on the packet inputs and the reverse artifacts.
- Read the original source when the packet says it is available.
- Write inside the output directory only.

No Bash, no network, no Neo4j.

## Forbidden operations

- Assuming file organisation or access mode without evidence (use `unknown`).
- Citing statement or paragraph IDs that belong to another program.
- Classifying an online CICS program as batch.
- Inventing DB2 tables or CICS transactions.
- Writing code, or modifying reverse artifacts or sources.

## Error handling and stop conditions

- A logic file is missing for a program: record the program with an unresolved execution model and continue.
- A program's source file is empty: set `execution_model: "empty"` and add an unresolved question.
- The packet is undispatchable or an input is missing: return `blocked`.
- Not every program unit has been covered: return `incomplete`.

## Quality checks

1. Every program unit in the packet has exactly one `programs[]` entry.
2. Every operation's statement and paragraph IDs start with the program's File ID.
3. Every compatibility requirement has at least one source ref.
4. `verified_from_source` is used only when the source is available.
5. Unresolved runtime facts appear in `unresolved_questions`.

The runtime enforces checks 1, 2 and 4, and rejects the receipt on any failure.

## Source-ID traceability

- Statement, paragraph, record and File IDs are copied exactly from the logic, raw-structure and data artifacts.
- JCL job File IDs and call target File IDs come from the inventory.
- Unresolved call targets keep `target_file_id: null`.

## Orchestrator integration

This output is listed in the same F2 receipt as the data contracts and the layout findings. The runtime validates it against the contract, checks ID ownership, records provenance and updates the F2 coverage ledger. Its compatibility requirements become inputs to F3 only after the requirements gate (G2), which is decided by a human.
