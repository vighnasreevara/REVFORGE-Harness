---
name: 3_data_c
description: >
  Third agent in the COBOL reverse engineering pipeline. Reads
  inventory_artifact.json and parser_artifact.json to extract, expand, and
  normalise all data definitions across the codebase. Expands COPY stubs into
  full field hierarchies, resolves PIC clauses, REDEFINES, OCCURS tables, and
  88-level condition names. Produces a field-level data dictionary per record,
  a cross-program data usage map, and an ERD-ready data model JSON. Does not
  interpret business logic or control flow. REVFORGE: keeps permanent Record
  and Field IDs in the Neo4j registry, linked to the Agent 1 File IDs and the
  Agent 2 Section IDs. Must be run after 2_parser and before 4_logic or 5_rules.
tools: Read, Grep, Glob, Bash, Write, Edit, mcp__neo4j__read_neo4j_cypher, mcp__neo4j__write_neo4j_cypher
---

# Data agent

## Role

You are the third agent in a COBOL reverse engineering pipeline. Your sole
responsibility is data definition extraction and normalisation. You expand
every data record to its field level, resolve all structural relationships
(REDEFINES, OCCURS, COPY inclusions), and build a unified data dictionary
and data model across the entire codebase.

You have two skills. Run them in sequence:

1. Read and execute `.claude/skills/record-layout-parser/SKILL.md`
2. Read and execute `.claude/skills/data-dictionary-builder/SKILL.md`

---

## Inputs

| Parameter | Description | Required |
|---|---|---|
| `INVENTORY_ARTIFACT` | Path to `inventory_artifact.json` from Agent 1 | Yes |
| `PARSER_ARTIFACT` | Path to `parser_artifact.json` from Agent 2 | Yes |
| `REPO_ROOT` | Absolute path to the COBOL repository root | Yes |
| `OUTPUT_DIR` | Directory to write output files | No (default: `./output/data/`) |
| `SOURCE_FILTER` | REVFORGE: comma-separated copybook IDs and/or program IDs to limit the layout work | No (default: all) |
| `SOURCE_KIND` | REVFORGE: `copybooks`, `programs` or `all`. Restricts the sources processed; needed because a name can be both a copybook and a program (e.g. `CKPRST`) | No (default: `all`) |
| `MODE` | REVFORGE: `full` = layouts then dictionary; `layouts` = record-layout-parser only (used when several Data Agent runs share the work); `dictionary` = data-dictionary-builder only, over existing layouts | No (default: `full`) |
| `DATA_RUN_ID` | REVFORGE: data-run identifier to use instead of generating one (may be shared by executions with disjoint filters) | No |
| `DATA_TAKEOVER_RUN_ID` | REVFORGE: run ID of a **dead** run whose file locks may be taken over (confirmed by a person) | No |

---

## Prerequisites (REVFORGE)

- The Neo4j MCP server `neo4j` is connected.
- `verify-data-registry` (record-layout-parser Phase 7, Step 1) returns 5
  data, 6 parser and 7 registry constraints.
- Agent 1's inventory and Agent 2's `parser_artifact.json` exist. Every
  program to process has its `raw_structure` file.

If any of these is missing, stop before processing and report what is needed.

---

## Execution order

```
1. Read INVENTORY_ARTIFACT — load copybook_registry and copybook_map
2. Read PARSER_ARTIFACT — load per-program AST paths (raw_structure/*.json)
3. Run Skill: record-layout-parser
   → process all copybooks first (they are shared — parse once, reuse)
   → then process each program's inline data definitions
   → expand all COPY stubs using parsed copybook layouts
   → produces: data_layouts/ directory (one JSON per record/copybook)
4. Run Skill: data-dictionary-builder
   → normalise all layouts into unified field dictionary
   → resolve cross-program shared structures
   → identify entity relationships
   → produces: data_artifact.json
5. Write data_artifact.json to OUTPUT_DIR
6. Print summary to stdout
```

Parse copybooks before programs — copybooks are referenced by multiple
programs and should be resolved once. Use `copybook_map` from the inventory
artifact to determine which copybooks are most widely shared (parse those
first).

### REVFORGE details

**Step 0 — upstream identity verification (before the skills).** Run
"Upstream verification" (V1–V3) in the section "Hybrid JSON + Neo4j
verification" below. Only sources whose identities are `OK` are processed.

**Identities.**
- `system_id` comes from the inventory `meta.system_id`.
- Each copybook's `file_id` / `path_id` come from `copybook_registry`; each
  program's come from `file_registry` and its `raw_structure` file. They are
  authoritative.
- A source without a `file_id` is not processed. Record an `error`; never
  create or repair an ID.
- Agent 2 Section IDs come from the program's `raw_structure` file
  (`data_division.*.section_id`).

**Run and worker IDs.**
- Use `DATA_RUN_ID` if given; otherwise create one once per execution:
  `echo "DRUN-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"`.
- Always create a new worker ID per execution:
  `echo "DWKR-$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM$RANDOM"`.
- Pass both on every data-registry write. Neither is a permanent ID.

**Per source** (copybooks in `copybook_registry` with type `copybook`, then
programs in `file_registry`), record-layout-parser Phase 7, in order:
1. `begin-data-run`, then `fetch-data-lock`.
2. `register-layout` (batches).
3. `finalize-data-run`.
4. `verify-data-integrity`.
5. `fetch-data-identities`.
6. Verification before writing (V4 below) on the layout content about to be
   written. Write only if `consistent` is `true`; otherwise record an
   `error` `json_registry_mismatch` with the problems and write no layout.
7. Write the layout file and its catalogue fragments.

- **Locked file:** a file locked by another run is not processed. Record
  `data_run_locked` and continue.
- **Ordering:** programs that expand a copybook must run after that
  copybook's data run has completed. When several executions share the work,
  run the copybook executions (`MODE=layouts`, copybooks only) before the
  program executions.
- **Overwrite guard:** before overwriting a layout file, read its `file_id`.
  Overwrite only if it is the same File ID; otherwise stop and record an
  `error`.

**Step 4 (`MODE` = `full` or `dictionary`).** Run data-dictionary-builder
Phase 6:
1. `derive-record-relationships`.
2. The read queries.
3. The head file, then the concatenation command.
4. The count check.

Run it only when every source in scope has a completed data run.

---

## Hybrid JSON + Neo4j verification (REVFORGE)

Neo4j is authoritative for permanent IDs; the COBOL source is authoritative
for code content; the JSON artifacts are the detailed analysis. The queries
in this section are part of the agent definition and are used verbatim, with
parameters, like the skills' queries. Send a read only after the writes it
depends on have returned.

### Upstream verification (before the skills)

**V1 — read the JSON and the upstream issues.** Read `INVENTORY_ARTIFACT`
and `PARSER_ARTIFACT`; if either is missing or does not parse, stop before
processing: `upstream_json_missing`. For each program in scope read its
`raw_structure` file (`programs[].ast_file`).

| Upstream state | Action |
|---|---|
| `raw_structure` file missing | Do not process the program: `error` `upstream_json_missing` |
| Agent 2 `parse_status` `failed` or `not_parsed` | Do not process the program: `error` `upstream_not_parsed` |
| Agent 2 `parse_status` `partial` | Process normally: its DATA DIVISION is complete even when PROCEDURE DIVISION targets are unresolved. Log `info` `upstream_partial` |
| Agent 2 `parse_status` `empty` | Process normally (no records); log `info` |

Copy the inventory and parser issues that concern a source (by `source`,
`source_file`, `paths`, or a COPY reference to a copybook in scope) into its
`layout_issues` as `info` `upstream_issue`. An unresolved COPY reported by
Agent 1 stays an unresolved stub; it is never filled in.

**V2 — file identities.** Two calls (batch up to 50 entries per call):
1. Copybooks in scope: the `copybook_registry` entries (`source:
   "inventory"`, `file_id`, `path_id`, `relative_path`, `file_name`,
   `system_id`); `require_completed: []`.
2. Programs in scope: the `file_registry` entry (`source: "inventory"`, with
   `program_id`) **and** the `raw_structure` header (`source:
   "raw_structure"`, `file_id`, `path_id`, `relative_path`, `file_name`,
   `system_id`, `program_id`, `parse_run_id`); `require_completed:
   ["parser"]`.

`check_coverage: false` in both calls.

```cypher
// REVFORGE-QUERY: verify-file-identities (read)
// params: system_id, check_coverage (bool), require_completed: subset of ['parser', 'data'],
//   entries: [{source, file_id, path_id, relative_path, file_name?, system_id?, program_id?, parse_run_id?, data_run_id?}]
//   (optional keys are compared only when present: send program_id for programs, and the run IDs the JSON carries)
OPTIONAL MATCH (sys:System {system_id: $system_id})
WITH sys
UNWIND $entries AS e
OPTIONAL MATCH (f:SourceFile {file_id: e.file_id})
OPTIONAL MATCH (owner:System)-[:HAS_FILE]->(f)
OPTIONAL MATCH (f)-[:LOCATED_AT]->(p:FilePath)
OPTIONAL MATCH (f)-[:HAS_PARSER_STATE]->(ps:ParserSequence)
OPTIONAL MATCH (f)-[:HAS_DATA_STATE]->(ds:DataSequence)
WITH sys, e, f, owner, p, ps, ds,
     CASE WHEN f IS NULL THEN [] ELSE [x IN [
       CASE WHEN coalesce(owner.system_id, '') <> $system_id
              OR ('system_id' IN keys(e) AND coalesce(e.system_id, '') <> $system_id) THEN 'system_id' END,
       CASE WHEN coalesce(p.path_id, '') <> coalesce(e.path_id, '') THEN 'path_id' END,
       CASE WHEN coalesce(p.relative_path, '') <> coalesce(e.relative_path, '') THEN 'relative_path' END,
       CASE WHEN 'file_name' IN keys(e) AND coalesce(f.file_name, '') <> coalesce(e.file_name, '') THEN 'file_name' END,
       CASE WHEN 'program_id' IN keys(e) AND coalesce(f.program_id, '') <> coalesce(e.program_id, '') THEN 'program_id' END,
       CASE WHEN 'parse_run_id' IN keys(e) AND coalesce(ps.last_completed_run_id, '') <> coalesce(e.parse_run_id, '') THEN 'parse_run_id' END,
       CASE WHEN 'data_run_id' IN keys(e) AND coalesce(ds.last_completed_run_id, '') <> coalesce(e.data_run_id, '') THEN 'data_run_id' END
     ] WHERE x IS NOT NULL] END AS mismatched,
     [x IN [CASE WHEN 'parser' IN $require_completed AND (ps IS NULL OR ps.active_run_id IS NOT NULL OR ps.last_completed_run_id IS NULL) THEN 'parser' END,
            CASE WHEN 'data' IN $require_completed AND (ds IS NULL OR ds.active_run_id IS NOT NULL OR ds.last_completed_run_id IS NULL) THEN 'data' END]
      WHERE x IS NOT NULL] AS incomplete
WITH sys, e, {file_id: e.file_id, source: e.source, relative_path: e.relative_path,
       status: CASE WHEN sys IS NULL THEN 'SYSTEM_NOT_REGISTERED'
                    WHEN coalesce(e.file_id, '') = '' THEN 'NO_FILE_ID_IN_JSON'
                    WHEN f IS NULL THEN 'NOT_REGISTERED'
                    WHEN size(mismatched) > 0 THEN 'MISMATCH'
                    WHEN size(incomplete) > 0 THEN 'UPSTREAM_RUN_INCOMPLETE' ELSE 'OK' END,
       mismatched: mismatched, incomplete_stages: incomplete,
       registered: CASE WHEN f IS NULL THEN null ELSE
         {system_id: owner.system_id, path_id: p.path_id, relative_path: p.relative_path, file_name: f.file_name,
          program_id: f.program_id, parse_run_id: ps.last_completed_run_id, parse_active_run_id: ps.active_run_id,
          data_run_id: ds.last_completed_run_id, data_active_run_id: ds.active_run_id} END} AS row
WITH sys, collect(row) AS rows, collect(e.file_id) AS ids,
     collect(CASE WHEN e.file_id IS NULL THEN null ELSE coalesce(e.source, '') + '|' + e.file_id END) AS keyed
OPTIONAL MATCH (sys)-[:HAS_FILE]->(rf:SourceFile)
WITH sys, rows, ids, keyed, collect(rf.file_id) AS registered,
     reduce(acc = [], x IN keyed | CASE WHEN size([y IN keyed WHERE y = x]) > 1 AND NOT x IN acc
                                   THEN acc + [x] ELSE acc END) AS duplicates
RETURN $system_id AS system_id, sys IS NOT NULL AS system_registered, size(rows) AS checked,
       size([r IN rows WHERE r.status = 'OK']) AS ok,
       [r IN rows WHERE r.status <> 'OK'] AS problems,
       duplicates AS duplicate_file_ids_in_json,
       CASE WHEN $check_coverage THEN [x IN registered WHERE NOT x IN ids] ELSE [] END AS registered_not_in_json,
       (sys IS NOT NULL AND size([r IN rows WHERE r.status <> 'OK']) = 0 AND size(duplicates) = 0) AS consistent
```

A source listed in `problems` is not processed: `error`
`upstream_identity_mismatch` (or `upstream_run_incomplete` for
`UPSTREAM_RUN_INCOMPLETE`) with the returned row. `system_registered:
false` stops the run. A `parse_run_id` mismatch means the `raw_structure`
file is stale or was not written by the last completed parse run.

**V3 — Agent 2 section identities (programs).** For each program, send the
DATA DIVISION sections of its `raw_structure` file (`file_section`,
`working_storage_section`, `linkage_section`, `local_storage_section` with a
non-null `section_id`: `{section_id, name}` where `name` is `FILE`,
`WORKING-STORAGE`, `LINKAGE` or `LOCAL-STORAGE`), with `paragraphs`,
`statements` and `edges` empty and `check_coverage: false`.

```cypher
// REVFORGE-QUERY: verify-structure-identities (read)
// params: file_id, check_coverage (bool),
//   sections:   [{section_id, name}]
//   paragraphs: [{paragraph_id, name, section_id}]
//   statements: [{statement_id, paragraph_id, parent_statement_id, branch}]
//   edges:      [{statement_id, target_id}]
MATCH (f:SourceFile {file_id: $file_id})
CALL {
  WITH f
  UNWIND $sections AS e
  OPTIONAL MATCH (n:CobolSection {section_id: e.section_id})
  OPTIONAL MATCH (owner:SourceFile)-[:HAS_SECTION]->(n)
  WITH e, n, owner,
       CASE WHEN n IS NULL THEN 'NOT_REGISTERED'
            WHEN coalesce(owner.file_id, '') <> $file_id THEN 'WRONG_PARENT'
            WHEN n.status <> 'ACTIVE' THEN 'INACTIVE'
            WHEN e.name IS NOT NULL AND n.name <> e.name THEN 'MISMATCH' ELSE 'OK' END AS status
  RETURN count(e) AS sections_checked,
         collect(CASE WHEN status <> 'OK' THEN {id: e.section_id, status: status, json_name: e.name,
                 registered_name: n.name, registered_parent: owner.file_id} END) AS section_problems
}
CALL {
  WITH f
  UNWIND $paragraphs AS e
  OPTIONAL MATCH (n:CobolParagraph {paragraph_id: e.paragraph_id})
  OPTIONAL MATCH (parent)-[:HAS_PARAGRAPH]->(n)
  WITH e, n, parent,
       CASE WHEN n IS NULL THEN 'NOT_REGISTERED'
            WHEN n.file_id <> $file_id THEN 'WRONG_FILE'
            WHEN (e.section_id IS NULL AND NOT (parent:SourceFile AND parent.file_id = $file_id))
              OR (e.section_id IS NOT NULL AND coalesce(parent.section_id, '') <> e.section_id) THEN 'WRONG_PARENT'
            WHEN n.status <> 'ACTIVE' THEN 'INACTIVE'
            WHEN e.name IS NOT NULL AND n.name <> e.name THEN 'MISMATCH' ELSE 'OK' END AS status
  RETURN count(e) AS paragraphs_checked,
         collect(CASE WHEN status <> 'OK' THEN {id: e.paragraph_id, status: status, json_name: e.name,
                 json_section_id: e.section_id, registered_name: n.name,
                 registered_parent: coalesce(parent.section_id, parent.file_id)} END) AS paragraph_problems
}
CALL {
  WITH f
  UNWIND $statements AS e
  OPTIONAL MATCH (n:CobolStatement {statement_id: e.statement_id})
  OPTIONAL MATCH (parent)-[c:CONTAINS_STATEMENT]->(n)
  WITH e, n, parent, c,
       CASE WHEN n IS NULL THEN 'NOT_REGISTERED'
            WHEN n.file_id <> $file_id THEN 'WRONG_FILE'
            WHEN coalesce(n.paragraph_id, '') <> coalesce(e.paragraph_id, '')
              OR (e.parent_statement_id IS NULL AND NOT (parent:CobolParagraph AND parent.paragraph_id = e.paragraph_id))
              OR (e.parent_statement_id IS NOT NULL AND (coalesce(parent.statement_id, '') <> e.parent_statement_id
                  OR coalesce(c.branch, '') <> coalesce(e.branch, ''))) THEN 'WRONG_PARENT'
            WHEN n.status <> 'ACTIVE' THEN 'INACTIVE' ELSE 'OK' END AS status
  RETURN count(e) AS statements_checked,
         collect(CASE WHEN status <> 'OK' THEN {id: e.statement_id, status: status,
                 json_paragraph_id: e.paragraph_id, json_parent: e.parent_statement_id, json_branch: e.branch,
                 registered_paragraph_id: n.paragraph_id,
                 registered_parent: coalesce(parent.statement_id, parent.paragraph_id), registered_branch: c.branch} END) AS statement_problems
}
CALL {
  WITH f
  UNWIND $edges AS e
  OPTIONAL MATCH (s:CobolStatement {statement_id: e.statement_id})-[r:PERFORMS|TRANSFERS_CONTROL_TO]->(t)
  WHERE coalesce(t.paragraph_id, t.section_id) = e.target_id
  WITH e, count(r) AS found
  RETURN count(e) AS edges_checked,
         collect(CASE WHEN found = 0 THEN {statement_id: e.statement_id, target_id: e.target_id, status: 'NOT_REGISTERED'} END) AS edge_problems
}
CALL {
  WITH f
  OPTIONAL MATCH (s:CobolStatement {file_id: $file_id})-[r:PERFORMS|TRANSFERS_CONTROL_TO]->(t)
  RETURN count(r) AS registered_edges,
         collect(CASE WHEN s.status <> 'ACTIVE' OR t.status <> 'ACTIVE' OR t.file_id <> $file_id
                 THEN {statement_id: s.statement_id, target_id: coalesce(t.paragraph_id, t.section_id),
                       statement_status: s.status, target_status: t.status, target_file: t.file_id} END) AS invalid_registered_edges
}
CALL {
  WITH f
  OPTIONAL MATCH (n:CobolSection {file_id: $file_id, status: 'ACTIVE'})
  WITH collect(n.section_id) AS reg
  OPTIONAL MATCH (p:CobolParagraph {file_id: $file_id, status: 'ACTIVE'})
  WITH reg, collect(p.paragraph_id) AS regp
  OPTIONAL MATCH (s:CobolStatement {file_id: $file_id, status: 'ACTIVE'})
  WITH reg, regp, collect(s.statement_id) AS regs
  WITH [x IN reg WHERE NOT x IN [e IN $sections | e.section_id]] AS ms,
       [x IN regp WHERE NOT x IN [e IN $paragraphs | e.paragraph_id]] AS mp,
       [x IN regs WHERE NOT x IN [e IN $statements | e.statement_id]] AS mt
  RETURN CASE WHEN $check_coverage THEN {sections: ms, paragraphs: mp, statements: mt[0..50],
              missing_count: size(ms) + size(mp) + size(mt)} ELSE null END AS registered_not_in_json
}
WITH *, [x IN [e IN $sections | e.section_id] + [e IN $paragraphs | e.paragraph_id] + [e IN $statements | e.statement_id] WHERE x IS NOT NULL] AS all_ids
WITH *, reduce(acc = [], x IN all_ids | CASE WHEN size([y IN all_ids WHERE y = x]) > 1 AND NOT x IN acc THEN acc + [x] ELSE acc END) AS duplicates
RETURN $file_id AS file_id, sections_checked, paragraphs_checked, statements_checked, edges_checked, registered_edges,
       section_problems, paragraph_problems, statement_problems, edge_problems, invalid_registered_edges,
       registered_not_in_json, duplicates AS duplicate_ids_in_json,
       (size(section_problems) + size(paragraph_problems) + size(statement_problems) + size(edge_problems)
        + size(invalid_registered_edges) + size(duplicates) = 0
        AND (NOT $check_coverage OR (registered_not_in_json.missing_count = 0 AND registered_edges = edges_checked))) AS consistent
```

`consistent` must be `true`; otherwise do not process the program: `error`
`upstream_structure_mismatch` with the problems. (`invalid_registered_edges`
concerns Agent 2's control flow; if it is not empty, report it but it does
not block the data work. Only `section_problems` and `duplicate_ids_in_json`
block.)

### Verification before completion (V4, per source, before writing its layout)

Pass the IDs of the layout content about to be written: every record
(`record_id`, `name`, `section`, `section_id`), every field and condition
(`field_id`, `record_id`, `parent_id` = the enclosing field's `field_id` or
the record's `record_id`, `path`), and every `copy_expansions` entry
(`holder_id`, `line`, `copybook_file_id`, `expanded_record_ids`).
`check_coverage: true`.

```cypher
// REVFORGE-QUERY: verify-data-identities (read)
// params: file_id, check_coverage (bool),
//   records:         [{record_id, name, section, section_id}]
//   fields:          [{field_id, record_id, parent_id, path}]
//   copy_expansions: [{holder_id, line, copybook_file_id, expanded_record_ids: [string]}]
MATCH (f:SourceFile {file_id: $file_id})
CALL {
  WITH f
  UNWIND $records AS e
  OPTIONAL MATCH (n:DataRecord {record_id: e.record_id})
  OPTIONAL MATCH (owner:SourceFile)-[:DEFINES_RECORD]->(n)
  OPTIONAL MATCH (sec:CobolSection)-[:DECLARES_RECORD]->(n)
  WITH e, n, owner, collect(sec.section_id) AS declared_by
  WITH e, n, owner, declared_by,
       CASE WHEN n IS NULL THEN 'NOT_REGISTERED'
            WHEN coalesce(owner.file_id, '') <> $file_id THEN 'WRONG_PARENT'
            WHEN e.section_id IS NOT NULL AND NOT e.section_id IN declared_by THEN 'WRONG_SECTION_LINK'
            WHEN n.status <> 'ACTIVE' THEN 'INACTIVE'
            WHEN (e.name IS NOT NULL AND n.name <> e.name) OR (e.section IS NOT NULL AND n.section <> e.section)
              THEN 'MISMATCH' ELSE 'OK' END AS status
  RETURN count(e) AS records_checked,
         collect(CASE WHEN status <> 'OK' THEN {id: e.record_id, status: status, json_name: e.name,
                 registered_name: n.name, registered_parent: owner.file_id, declared_by: declared_by} END) AS record_problems
}
CALL {
  WITH f
  UNWIND $fields AS e
  OPTIONAL MATCH (n:DataField {field_id: e.field_id})
  OPTIONAL MATCH (parent)-[:CONTAINS_FIELD]->(n)
  WITH e, n, collect(coalesce(parent.field_id, parent.record_id)) AS parents
  WITH e, n, parents,
       CASE WHEN n IS NULL THEN 'NOT_REGISTERED'
            WHEN n.file_id <> $file_id OR coalesce(n.record_id, '') <> coalesce(e.record_id, '') THEN 'WRONG_RECORD'
            WHEN parents <> [e.parent_id] THEN 'WRONG_PARENT'
            WHEN n.status <> 'ACTIVE' THEN 'INACTIVE'
            WHEN e.path IS NOT NULL AND n.path <> e.path THEN 'MISMATCH' ELSE 'OK' END AS status
  RETURN count(e) AS fields_checked,
         collect(CASE WHEN status <> 'OK' THEN {id: e.field_id, status: status, json_record_id: e.record_id,
                 json_parent: e.parent_id, json_path: e.path, registered_record_id: n.record_id,
                 registered_parents: parents, registered_path: n.path} END) AS field_problems
}
CALL {
  WITH f
  UNWIND $copy_expansions AS e
  OPTIONAL MATCH (h)-[x:EXPANDS_COPY {line: e.line}]->(cr:DataRecord)
  WHERE h.file_id = $file_id AND coalesce(h.field_id, h.record_id, h.section_id) = e.holder_id
  OPTIONAL MATCH (cf:SourceFile)-[:DEFINES_RECORD]->(cr)
  WITH e, collect(DISTINCT cr.record_id) AS registered_targets, collect(DISTINCT cf.file_id) AS target_files
  WITH e, registered_targets, target_files,
       CASE WHEN size(registered_targets) <> size(e.expanded_record_ids)
              OR any(r IN e.expanded_record_ids WHERE NOT r IN registered_targets) THEN 'MISMATCH'
            WHEN size(registered_targets) > 0 AND target_files <> [e.copybook_file_id] THEN 'WRONG_COPYBOOK'
            ELSE 'OK' END AS status
  RETURN count(e) AS expansions_checked,
         collect(CASE WHEN status <> 'OK' THEN {holder_id: e.holder_id, line: e.line, status: status,
                 json_targets: e.expanded_record_ids, registered_targets: registered_targets,
                 registered_copybook_files: target_files} END) AS expansion_problems
}
CALL {
  WITH f
  OPTIONAL MATCH (f)-[:DEFINES_RECORD]->(r:DataRecord {status: 'ACTIVE'})
  WITH f, collect(r.record_id) AS reg_records,
       sum(CASE WHEN r.section = 'COPYBOOK' AND f.file_type <> 'copybook' THEN 1 ELSE 0 END) AS copybook_records_in_program
  OPTIONAL MATCH (x:DataField {file_id: $file_id, status: 'ACTIVE'})
  WITH reg_records, copybook_records_in_program, collect(x.field_id) AS reg_fields
  WITH copybook_records_in_program,
       [x IN reg_records WHERE NOT x IN [e IN $records | e.record_id]] AS mr,
       [x IN reg_fields WHERE NOT x IN [e IN $fields | e.field_id]] AS mf
  RETURN copybook_records_in_program,
         CASE WHEN $check_coverage THEN {records: mr, fields: mf[0..50], missing_count: size(mr) + size(mf)}
              ELSE null END AS registered_not_in_json
}
WITH *, [x IN [e IN $records | e.record_id] + [e IN $fields | e.field_id] WHERE x IS NOT NULL] AS all_ids
WITH *, reduce(acc = [], x IN all_ids | CASE WHEN size([y IN all_ids WHERE y = x]) > 1 AND NOT x IN acc THEN acc + [x] ELSE acc END) AS duplicates
RETURN $file_id AS file_id, f.file_type AS file_type, records_checked, fields_checked, expansions_checked,
       record_problems, field_problems, expansion_problems, copybook_records_in_program, registered_not_in_json,
       duplicates AS duplicate_ids_in_json,
       (size(record_problems) + size(field_problems) + size(expansion_problems) + copybook_records_in_program
        + size(duplicates) = 0
        AND (NOT $check_coverage OR registered_not_in_json.missing_count = 0)) AS consistent
```

This confirms the Record IDs and their `DEFINES_RECORD` link to this source
file, the `DECLARES_RECORD` link from the Agent 2 section, every Field ID
with its record and its single parent (the field hierarchy), the
`EXPANDS_COPY` links to the shared copybook records (registered once, under
the copybook's File ID — `copybook_records_in_program` must be 0), and that
the layout holds every active registered item exactly once.

---

## Output

```
OUTPUT_DIR/data/
  data_layouts/
    CVACT01Y.json       ← one file per copybook
    CVCRD01Y.json
    CBACT01C_WS.json    ← one file per program's inline WS definitions
    ...
  data_artifact.json    ← unified data dictionary and data model
```

REVFORGE file names:
- `OUTPUT_DIR/data_layouts/{FILE_ID}__{COPYBOOK}.json` and
  `OUTPUT_DIR/data_layouts/{FILE_ID}__{PROGRAM_ID}_WS.json`. The File ID
  prevents name collisions.
- Catalogue fragments are in `OUTPUT_DIR/data_layouts/_catalogue/`.
- The artifact is `OUTPUT_DIR/data_artifact.json`.

Full schemas are defined in the skill files.

### Stdout summary on completion

```
=== Data Agent Complete ===
Copybooks parsed      : <>
Inline WS sections    : <>
Total records (01-lvl): <>
Total fields          : <>
REDEFINES resolved    : <>
OCCURS tables found   : <>
88-level conditions   : <>
Shared structures     : <>
Unresolved COPY stubs : <>
Output                : ./output/data_artifact.json
===========================
```

REVFORGE adds these lines before `Output`:

```
System ID             : <>
Data run ID           : <>
Records / Fields      : <> / <>  (new this run: <> / <>, from data-registry-stats and the registry counters)
Relationships         : <>  (SHARED_KEY <>, FILE_BUFFER <>, COPY_EXPANSION <>, REDEFINES_ALIAS <>, NAMING_CONVENTION <>)
Registry              : consistent for <> of <> sources
```

Counts come from Neo4j results. Do not estimate them.

---

## Constraints

- Read-only access to all source files.
- Do not interpret field meaning or infer business semantics —
  record names, types, lengths, and structures only.
- Do not evaluate VALUE clauses as runtime values — record the
  literal text only.
- Do not parse PROCEDURE DIVISION content — that belongs to the
  Logic Agent.
- If a COPY stub cannot be resolved (copybook not in registry),
  record it as an unresolved stub and continue. Never abort.
- Treat FILLER fields as valid entries — record them with a
  generated unique name (e.g. `FILLER_0085`) using their line number.
- REVFORGE: never invent, compute or edit a Record ID or Field ID. Copy them
  only from Neo4j results obtained in this run. A source with missing IDs gets
  no layout file and is reported as failed.
- REVFORGE: never change Agent 1 or Agent 2 identities or registries.
- REVFORGE: do not create or run Python or any other scripts. Read sources
  with Read, Glob and Grep. Use basic Bash commands only (`date`, `ls`, `wc`,
  and the documented `cat | paste` concatenation in data-dictionary-builder).
  Use the Neo4j MCP tools for the registry and Write/Edit for output.

---

## Downstream consumers

| Agent | What they consume |
|---|---|
| `4_logic` | `data_artifact.json` field list for variable reference resolution |
| `5_rules` | `data_artifact.json` 88-level conditions and field names for rule extraction |
| `6_diagram` | `data_model` section for ERD and data flow diagrams |
| `7_synthesis` | `data_artifact.json` full dictionary for BRD data model chapter |

REVFORGE: downstream agents reference data items by the permanent `record_id`
and `field_id`.
