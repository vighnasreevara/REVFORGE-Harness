---
name: record-layout-parser
description: >
  Parses COBOL copybook files and inline WORKING-STORAGE sections to extract
  the full field-level layout of every data record. Resolves level number
  hierarchies, expands PIC clauses into typed field definitions, handles
  REDEFINES aliases, OCCURS tables, and 88-level condition names. Produces
  one structured JSON layout file per copybook and per program WS section.
  COPY stubs identified by the Parser Agent are expanded using the parsed
  copybook layouts. Called by the Data Agent before data-dictionary-builder.
  REVFORGE: registers permanent Record IDs and Field IDs in Neo4j, linked to the
  Agent 1 File IDs and Agent 2 Section IDs.
---

# Skill — record layout parser

## Purpose

Open each copybook file and each program's inline WORKING-STORAGE section.
Walk the level-number hierarchy top-down. For every field, extract its name,
level, PIC clause (parsed into type/length/decimal), REDEFINES target,
OCCURS clause, VALUE, and 88-level conditions. Produce a flat-then-nested
JSON layout that the data-dictionary-builder can normalise.

Do NOT interpret what fields mean. Record structure and attributes only.

REVFORGE enhancement:
- Every record and field is registered in the Neo4j data registry, which issues
  permanent Record IDs and Field IDs (Phase 7). This skill never invents or
  numbers an ID.
- For programs, the WORKING-STORAGE and LINKAGE hierarchy comes from the Agent 2
  `raw_structure` file, which was verified against the source. The FILE SECTION
  record layouts, which Agent 2 does not parse, and all copybooks are read from
  the source here.

---

## COBOL fixed-format column rules

Apply to all `.cbl` and `.cpy` files:

| Columns (1-based) | Action |
|---|---|
| 1–6 | Ignore (sequence numbers) |
| 7 | `*` or `/` → skip line (comment) |
| 8–11 | Area A — 01, 77-level entries start here |
| 12–72 | Area B — subordinate entries and clauses start here |
| 73–80 | Ignore |

Continuation lines: if column 7 is `-`, the line continues the previous
line's clause. Concatenate columns 12–72 of the continuation onto the
previous line before parsing.

REVFORGE: a line whose first non-blank character in columns 8–72 is `*` is a
misplaced comment. Skip it and log a `warning` `misplaced_comment_indicator`.
For free-format sources (Agent 2 `source_format: "free"`), the program text is
the whole line.

---

## Phase 1 — level number hierarchy extraction

### Detect all data entries

```bash
# All level-numbered entries (01–49, 77, 88) — skip comment lines
grep -niE "^.{6}[^*/]\s+(0?1|0?2|0?3|0?4|0?5|0?6|0?7|0?8|0?9|[1-4][0-9]|77|88)\s+([A-Z0-9\-]+)" "$FILE"
```

For each match record:
- Line number
- Level number (normalise: strip leading zero → integer)
- Data name (if `FILLER` → generate `FILLER_NNNN` using line number)
- Raw remainder of the line (contains PIC, OCCURS, REDEFINES, VALUE clauses)

### Hierarchy rules

Build a tree from the flat list using these rules:

```
- Level 01 and 77 → root entries (direct children of their section)
- Level 02–49 → child of the nearest preceding entry with a lower level number
- Level 88 → condition name, always child of its immediately preceding entry
  (regardless of level number difference)
- Level 66 → RENAMES entry — record separately, do not nest as child
- If level sequence skips (e.g. 01 → 05 → 03) → log warning, attach 03
  as sibling of 05 (same parent as 05)
```

REVFORGE:
- **Where the entries come from.**
  - Program WORKING-STORAGE / LINKAGE / LOCAL-STORAGE: take the entries and
    hierarchy from the Agent 2 `raw_structure` file (`data_division.*.entries`,
    including its `copy_stub` entries), then read the source lines to complete
    each entry's clauses.
  - FILE SECTION: read the 01-level records under each FD/SD from the source.
  - Copybooks: read the whole `.cpy` file.
- **A copybook's records are its top-level entries**, whatever their level
  number. If they are not 01/77 (e.g. a copybook of 05-level items meant to
  sit under a program's 01), mark them `is_fragment: true`.
- **What is not parsed.**
  - Procedure code inside a copybook (paragraphs and statements, e.g. in a
    copybook that mixes data and procedures) is not a data layout. Skip it and
    log an `info` `procedure_code_in_copybook`.
  - `EXEC SQL INCLUDE x END-EXEC` is a copy stub of `include_kind: "SQL_INCLUDE"`.
  - `EXEC SQL DECLARE ... TABLE` blocks are DB2 declarations, not COBOL data
    items. Log an `info`.
  - Files of type `db2` (`.sql` DDL) are not COBOL layouts. Skip them, log an
    `info` `non_cobol_layout_skipped`, and register nothing for them.
- **FILLER** keeps `FILLER_NNNN` as its display key (`filler_key`). Its
  permanent identity uses its position instead (see Phase 7).

---

## Phase 2 — PIC clause parsing

For each elementary item (an entry that has a PIC clause), extract and
parse the PIC string:

```bash
# PIC clause — may use PIC or PICTURE, with optional IS
grep -iE "PIC(TURE)?\s+(IS\s+)?([X9AVSZB\(\)\/\+\-\.\,\*\$]+)" <<< "$REMAINDER"
```

### PIC clause type classification

| PIC pattern | COBOL type | Normalised type | Notes |
|---|---|---|---|
| `9(n)` | Numeric | `INTEGER` | Length = n |
| `9(n)V9(d)` | Numeric decimal | `DECIMAL` | Length = n+d, decimal = d |
| `S9(n)` | Signed numeric | `SIGNED_INTEGER` | Sign flag = true |
| `S9(n)V9(d)` | Signed decimal | `SIGNED_DECIMAL` | Sign flag = true |
| `9(n) COMP` / `9(n) COMP-3` | Binary/packed | `BINARY` / `PACKED_DECIMAL` | Note storage type |
| `X(n)` | Alphanumeric | `STRING` | Length = n |
| `A(n)` | Alphabetic | `ALPHA` | Length = n |
| `X` (no parens) | Alphanumeric | `STRING` | Length = 1 |
| `9` (no parens) | Numeric | `INTEGER` | Length = 1 |
| `V9(n)` | Implied decimal | `DECIMAL` | Length = n, integer part = 0 |
| `9(n)V` | Integer with implied decimal | `DECIMAL` | Decimal = 0 |
| `AAAA...` (repeated) | Alphabetic | `ALPHA` | Count repeated chars |
| `XXXX...` (repeated) | Alphanumeric | `STRING` | Count repeated chars |
| `9999...` (repeated) | Numeric | `INTEGER` | Count repeated chars |

### PIC length extraction

For PIC `X(15)` → length = 15
For PIC `XXX` → count characters → length = 3
For PIC `9(7)V99` → integer digits = 7, decimal digits = 2, total length = 9
For PIC `S9(5) COMP-3` → packed decimal, length = 3 bytes (ceiling of (5+1)/2)

Record both the raw PIC string and the parsed attributes.

REVFORGE — rules that make the attributes exact:
- **Expand repeat counts before counting.** `X(2)9(3)` is 5 characters.
  `length` is the number of character positions or digits, excluding `S`, `V`
  and `P`.
- **Edited pictures** (`Z`, `B`, `/`, `,`, `.`, `+`, `-`, `*`, `$`, `CR`, `DB`)
  are `normalized_type: "NUMERIC_EDITED"`. Their `length` is the number of
  character positions.
- **`pic_raw` is the PIC string exactly as written.** It is never truncated,
  for example `X(26)`, not `X(`.
- **`bytes` for an elementary item:**

| Storage | Bytes |
|---|---|
| `DISPLAY` | `length`, +1 when `SIGN … SEPARATE` |
| `PACKED_DECIMAL` (COMP-3) | `floor(digits / 2) + 1` |
| `BINARY` / `NATIVE_BINARY` (COMP, COMP-4, COMP-5, BINARY) | 1–4 digits → 2; 5–9 → 4; 10–18 → 8 |
| `FLOAT_SINGLE` (COMP-1) | 4 |
| `FLOAT_DOUBLE` (COMP-2) | 8 |
| `INDEX` | 4 |
| `POINTER` | 4 |

- **Group items and 88-levels get `bytes: null` from this skill.** Neo4j
  computes group sizes (Phase 7, `finalize-data-run`).
- **A USAGE clause on a group** applies to its elementary children.
- **`normalized_type` describes the value; `storage_type` describes the
  USAGE.** Signed binary `S9(4) COMP` is therefore `SIGNED_INTEGER` with
  storage `BINARY`, and `S9(7)V99 COMP-3` is `SIGNED_DECIMAL` with
  `PACKED_DECIMAL`. The table's `BINARY` / `PACKED_DECIMAL` normalized types
  are expressed through `storage_type` instead.
- **`pic` is written as Agent 2 records it:** the PICTURE string followed by a
  USAGE given in the same entry, e.g. `S9(4) COMP`. `pic_parsed.raw` is the
  same text.
- **VALUE literals are kept exactly as written,** quotes included
  (`'VS'`, `+0`, `SPACES`). An 88-level has `value: null`; its literals are in
  `values_raw` / `values`.
- **FILLER:** `name` is `FILLER_NNNN` (4-digit line), `is_filler` is `true`,
  and the path segment is `FILLER#k` (see Phase 7).

### USAGE clause (storage type)

```bash
grep -iE "USAGE\s+(IS\s+)?(COMP|COMP-1|COMP-2|COMP-3|COMP-4|COMP-5|BINARY|PACKED-DECIMAL|DISPLAY|INDEX|POINTER)" <<< "$REMAINDER"
```

| USAGE value | Storage type |
|---|---|
| `DISPLAY` (default) | Standard character storage |
| `COMP` / `COMP-4` / `BINARY` | Binary integer |
| `COMP-1` | Single-precision float |
| `COMP-2` | Double-precision float |
| `COMP-3` / `PACKED-DECIMAL` | Packed decimal (BCD) |
| `COMP-5` | Native binary |
| `INDEX` | Table index |
| `POINTER` | Memory pointer |

REVFORGE: the `storage_type` values are `DISPLAY`, `BINARY`, `FLOAT_SINGLE`,
`FLOAT_DOUBLE`, `PACKED_DECIMAL`, `NATIVE_BINARY`, `INDEX` and `POINTER`. The
keyword is also accepted without `USAGE IS`.

---

## Phase 3 — REDEFINES extraction

```bash
grep -iE "REDEFINES\s+([A-Z0-9\-]+)" <<< "$REMAINDER"
```

Rules:
- Record the target field name (what is being redefined)
- The REDEFINES entry occupies the same storage as the target
- Both entries should have the same total byte length — if not, log `warning`
- Do NOT follow the REDEFINES to resolve target structure here; the
  data-dictionary-builder resolves the alias relationship
- Multiple entries can REDEFINES the same target — record all of them

REVFORGE:
- Also record `redefines_path`: the target's path (Phase 7) within the same
  record. The target is the preceding entry at the same level under the same
  parent.
- For a level-01 record that REDEFINES another 01, record the target record
  name in the record's `redefines`.
- Neo4j stores these as `REDEFINES` relationships. The byte-length check is
  done by the data-dictionary-builder on the computed sizes.

---

## Phase 4 — OCCURS extraction

```bash
# Simple OCCURS
grep -iE "OCCURS\s+([0-9]+)\s+TIMES?" <<< "$REMAINDER"

# OCCURS with variable limit (ODO — OCCURS DEPENDING ON)
grep -iE "OCCURS\s+([0-9]+)\s+TO\s+([0-9]+)\s+TIMES?\s+DEPENDING\s+ON\s+([A-Z0-9\-]+)" <<< "$REMAINDER"

# INDEXED BY
grep -iE "INDEXED\s+BY\s+([A-Z0-9\-]+)" <<< "$REMAINDER"

# KEY IS (for sorted tables)
grep -iE "(ASCENDING|DESCENDING)\s+KEY\s+(IS\s+)?([A-Z0-9\-]+)" <<< "$REMAINDER"
```

Record:
- Minimum occurs (0 if DEPENDING ON, else same as max)
- Maximum occurs
- Whether variable-length (DEPENDING ON)
- Depending-on field name if variable-length
- Index name(s) from INDEXED BY
- Key field(s) and sort order if present

REVFORGE: for `OCCURS n TO m … DEPENDING ON`, the minimum is `n` as written.
The 0 above applies only when no lower bound is given.

---

## Phase 5 — 88-level condition extraction

```bash
# 88-level conditions — VALUE or VALUES, single or list
grep -niE "^.{6}[^*/]\s+88\s+([A-Z0-9\-]+)\s+(VALUE(S)?\s+(IS|ARE)?\s+(.+))" "$FILE"
```

For each 88-level entry record:
- Condition name
- Parent field name (the immediately preceding non-88 entry)
- Value list (may be a single value, a list, or a THRU range)
- Whether it is a negation (FALSE clause)

Value list patterns:
- Single: `VALUE 'Y'` → `["Y"]`
- List: `VALUES 'A' 'B' 'C'` → `["A", "B", "C"]`
- Range: `VALUE 1 THRU 9` → `{"from": 1, "to": 9}`
- Mixed: `VALUES 0 THRU 5 10 20` → `[{"from": 0, "to": 5}, 10, 20]`

REVFORGE:
- **Values.** `values` are the literals exactly as written: quoted literals
  without their quotes, numbers as numbers, figurative constants such as
  `SPACES` as strings. `values_raw` is the clause text after `VALUE`/`VALUES`.
  A condition whose values cannot be split reliably keeps `values_raw`, sets
  `values: null` and logs an `info`.
- **Placement.** An 88-level is a field under its parent field, with
  `is_condition: true`. An 88 under a level-01 or 77 elementary record is a
  field of that record.

---

## Phase 6 — COPY stub expansion

After parsing all copybooks, go back to each program's AST and expand
COPY stubs recorded by the cobol-ast-parser skill:

```
For each copy_stub in program AST:
  1. Look up copybook_id in parsed copybook layouts
  2. If found: inline the copybook's field tree at the stub's position
     - Inherit the parent level context (e.g. if stub is inside a level 01,
       adjust child level numbers accordingly — REPLACING clause may apply)
  3. If REPLACING clause present: apply text substitution to all field names
     before inlining
  4. If not found: leave as unresolved stub, log warning
```

### COPY REPLACING handling

```bash
# COPY with REPLACING clause
grep -iE "COPY\s+([A-Z0-9\-]+)\s+REPLACING\s+(.*)" "$FILE"
```

REPLACING syntax: `==OLD-TEXT== BY ==NEW-TEXT==`
Apply all substitution pairs to field names and literals in the copybook
before inlining. Record the substitutions in the layout output.

REVFORGE — expansion keeps one identity per definition:
- A copybook's records and fields are registered **once**, under the
  copybook's File ID. Programs do not re-register them.
- In the program layout JSON, an expanded stub is a **summary**, not a copy of
  the copybook's field tree:
  - one entry per copybook record: `record_id`, `name` (with REPLACING applied
    for display), `total_bytes`, `layout_file`;
  - `expanded_from: {copybook, copybook_file_id, line, replacing}`.

  The fields themselves are in the copybook's own layout and catalogue
  entries, under the copybook's IDs.
- In Neo4j, the expansion is an `EXPANDS_COPY` relationship from the holder
  (the program record or field that contains the stub, or the Agent 2 section
  for a stub directly under an FD or section) to each top-level record of the
  copybook. The program file also gets `USES_COPYBOOK` to the copybook file.
  REPLACING pairs are stored on the relationship.
- A REPLACING pattern that matches nothing in the copybook is logged as an
  `info` `replacing_no_effect`.
- A copybook that is missing from the inventory, or has no File ID or no
  registered records, stays an unresolved stub. Log a `warning`.
- `COPY x` of a name that is a program, not a copybook (inventory `type` is
  `program`), is also unresolved. Log a `warning` `copy_target_is_program`.

---

## Phase 7 — Permanent identity registration (REVFORGE)

### Identifiers

| ID | Format | Example | Identity key (never line numbers) |
|---|---|---|---|
| Record ID | `{FILE_ID}-REC-{NNNN}` | `SYS-BANKING-001-FIL-0004-REC-0001` | defining File ID + section + record name |
| Field ID | `{FILE_ID}-FLD-{NNNNNN}` | `SYS-BANKING-001-FIL-0004-FLD-000001` | Record ID + field path |

- **Defining file.** The copybook's File ID for copybook records; the
  program's File ID for program records.
- **Section.** `COPYBOOK` for copybook records; `FILE`, `WORKING-STORAGE`,
  `LINKAGE` or `LOCAL-STORAGE` for program records.
- **Duplicate record names.** A second record with the same name in the same
  section gets `occurrence: 2` (then 3, …). Its key ends in `#2`, it is marked
  `REVIEW_REQUIRED`, and a `warning` `duplicate_declaration` is logged.
- **Field path.** The names from the record's first child level down to the
  field, joined with `.`. For example, `LS-SYSTEM-INFO.LS-SYSTEM-ID` in record
  `LS-AUDIT-REQUEST`.
  - A `FILLER` segment is `FILLER#k`, where k is its 1-based position among
    the FILLER children of the same parent.
  - A repeated non-FILLER name under the same parent is `NAME#k` (k ≥ 2).
  - Paths are unique within a record.
- **Allocation.** Numbers come from per-file counters in Neo4j, only increase,
  and are never reused.

Consequences:
- An unchanged item keeps its ID whatever its line.
- A renamed item, or one moved under another parent, gets a new ID; the old
  one becomes `INACTIVE` when the run completes.
- Inserting a FILLER before other FILLERs under the same parent renumbers
  those FILLERs' paths.

**Absolute rules**
1. Never compute, guess or edit a Record ID or Field ID. Copy every ID
   verbatim from a Neo4j result of this run.
2. Never change Agent 1 or Agent 2 identities.
3. Use only the queries in this section and in the data-dictionary-builder
   skill, with values passed as parameters (JSON `null`, never the string
   `"null"`).
4. Send a read only after the writes it depends on have **returned**. Never
   put them in the same parallel group of tool calls.
5. If Neo4j is unreachable, constraints are missing, the file is locked by
   another run, or any record or field has no ID after registration, stop for
   this file. Record the error and write no layout for it.

### Step 1 — verify the registries

```cypher
// REVFORGE-QUERY: verify-data-registry (read)
SHOW CONSTRAINTS YIELD name
WHERE name STARTS WITH 'revforge_'
RETURN sum(CASE WHEN name STARTS WITH 'revforge_data_' THEN 1 ELSE 0 END) AS data_constraints,
       sum(CASE WHEN name STARTS WITH 'revforge_parser_' THEN 1 ELSE 0 END) AS parser_constraints,
       sum(CASE WHEN name STARTS WITH 'revforge_registry_' THEN 1 ELSE 0 END) AS registry_constraints
```

Continue only if `data_constraints = 5`, `parser_constraints = 6` and
`registry_constraints = 7`.

**One-time initialisation (administrator, via `cypher-shell` or Neo4j Browser):**

```cypher
// REVFORGE-QUERY: init-data-registry (admin, run once; idempotent)
CREATE CONSTRAINT revforge_data_state_file IF NOT EXISTS
  FOR (q:DataSequence) REQUIRE q.file_id IS UNIQUE;
CREATE CONSTRAINT revforge_data_record_id IF NOT EXISTS
  FOR (n:DataRecord) REQUIRE n.record_id IS UNIQUE;
CREATE CONSTRAINT revforge_data_record_key IF NOT EXISTS
  FOR (n:DataRecord) REQUIRE n.identity_key IS UNIQUE;
CREATE CONSTRAINT revforge_data_field_id IF NOT EXISTS
  FOR (n:DataField) REQUIRE n.field_id IS UNIQUE;
CREATE CONSTRAINT revforge_data_field_key IF NOT EXISTS
  FOR (n:DataField) REQUIRE n.identity_key IS UNIQUE;
CREATE INDEX revforge_data_field_run IF NOT EXISTS
  FOR (n:DataField) ON (n.file_id, n.last_run_id);
CREATE INDEX revforge_data_record_run IF NOT EXISTS
  FOR (n:DataRecord) ON (n.file_id, n.last_run_id);
```

### Step 2 — take the file's data lock

`run_id` and `worker_id` come from the agent definition.

```cypher
// REVFORGE-QUERY: begin-data-run (write)
// params: system_id, file_id, run_id, worker_id, takeover_run_id (null unless taking over a stale run)
MATCH (:System {system_id: $system_id})-[:HAS_FILE]->(f:SourceFile {file_id: $file_id})
MERGE (q:DataSequence {file_id: $file_id})
  ON CREATE SET q.system_id = $system_id, q.rec_seq = 0, q.fld_seq = 0, q.created_at = datetime()
SET q.lock_touched_at = datetime()  // exclusive lock first, so the ownership check sees committed state
MERGE (f)-[:HAS_DATA_STATE]->(q)
WITH f, q
WHERE q.active_run_id IS NULL
   OR (q.active_run_id = $run_id AND q.active_worker_id = $worker_id)
   OR q.active_run_id = $takeover_run_id
WITH f, q, (q.active_run_id IS NULL OR q.active_run_id <> $run_id) AS fresh
SET q.taken_over_run_id = CASE WHEN q.active_run_id IS NOT NULL AND q.active_run_id <> $run_id
                               THEN q.active_run_id ELSE q.taken_over_run_id END,
    q.active_run_id = $run_id, q.active_worker_id = $worker_id, q.run_started_at = datetime()
WITH f, q, fresh
// a new run rebuilds this file's derived relationships (not on resume)
CALL {
  WITH f, fresh
  WITH f, fresh WHERE fresh
  OPTIONAL MATCH (f)-[u:USES_COPYBOOK]->()
  DELETE u
}
CALL {
  WITH fresh
  WITH fresh WHERE fresh
  OPTIONAL MATCH (r:DataRecord {file_id: $file_id})-[e:EXPANDS_COPY|REDEFINES]->()
  DELETE e
}
CALL {
  WITH fresh
  WITH fresh WHERE fresh
  OPTIONAL MATCH (x:DataField {file_id: $file_id})-[e:EXPANDS_COPY|REDEFINES]->()
  DELETE e
}
CALL {
  WITH fresh
  WITH fresh WHERE fresh
  OPTIONAL MATCH (s:CobolSection {file_id: $file_id})-[e:EXPANDS_COPY]->()
  DELETE e
}
```

Then, after that call has returned, read the lock state:

```cypher
// REVFORGE-QUERY: fetch-data-lock (read)
// params: file_id
MATCH (q:DataSequence {file_id: $file_id})
RETURN q.active_run_id AS active_run_id, q.active_worker_id AS active_worker_id,
       toString(q.run_started_at) AS run_started_at, q.last_completed_run_id AS last_completed_run_id
```

If `active_run_id` and `active_worker_id` are not yours, the file is locked by
another run:
- Stop for this file, and log an `error` `data_run_locked` with the holder.
- Pass `takeover_run_id` only when the agent input `DATA_TAKEOVER_RUN_ID`
  names that exact holder, which a person has confirmed is dead.

### Step 3 — register records, fields and expansions

Send the file's layout in batches. Each batch holds **whole records** and at
most about 250 fields. Copybooks must be registered (and their runs completed)
before the programs that expand them.

| List | Entry fields |
|---|---|
| `records` | `local_id` (`R1`, `R2`, … per file), `name`, `occurrence`, `section`, `level`, `start_line`, `end_line`, `is_fragment`, `section_id` (Agent 2 CobolSection ID for program records, else `null`), `fd_name` (FD/SD file name for FILE records, else `null`), `redefines` (redefined record name or `null`); for an elementary 01/77 also `pic`, `normalized_type`, `length`, `decimal_places`, `signed`, `storage_type`, `bytes`, `value` |
| `fields` | `local_id` (`F1`, `F2`, … per file, in source order), `record_local_id`, `parent_local_id` (`null` when the parent is the record), `seq` (1-based position among the parent's children), `path`, `name`, `level`, `is_group`, `is_filler`, `is_condition`, `pic`, `normalized_type`, `length`, `decimal_places`, `signed`, `storage_type`, `bytes`, `occurs_min`, `occurs_max`, `depending_on`, `indexed_by` (list), `value`, `values_raw`, `redefines_path`, `start_line`, `end_line` |
| `copy_expansions` | `holder_local_id` (record or field local ID that contains the stub, or `null`), `section_id` (Agent 2 section ID when `holder_local_id` is `null`), `copybook`, `copybook_file_id` (from the inventory `copybook_registry`), `line`, `include_kind`, `replacing` (text or `null`) |

Unused attributes are `null`.

```cypher
// REVFORGE-QUERY: register-layout (write)
// params: system_id, file_id, run_id, worker_id, records, fields, copy_expansions (see the table above)
MATCH (:System {system_id: $system_id})-[:HAS_FILE]->(f:SourceFile {file_id: $file_id})
MATCH (q:DataSequence {file_id: $file_id})
WHERE q.active_run_id = $run_id AND q.active_worker_id = $worker_id
SET q.locked_at = datetime()  // exclusive lock on this file's counters
WITH f, q
CALL {
  WITH f, q
  UNWIND $records AS r
  WITH f, q, r, $file_id + '|' + r.section + '|' + r.name +
       CASE WHEN coalesce(r.occurrence, 1) > 1 THEN '#' + toString(r.occurrence) ELSE '' END AS key
  OPTIONAL MATCH (existing:DataRecord {identity_key: key})
  FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
    SET q.rec_seq = q.rec_seq + 1
    CREATE (n:DataRecord {
      record_id: $file_id + '-REC-' +
        CASE WHEN q.rec_seq < 10000 THEN right('000' + toString(q.rec_seq), 4) ELSE toString(q.rec_seq) END,
      record_number: q.rec_seq, identity_key: key, system_id: $system_id, file_id: $file_id,
      section: r.section, name: r.name, occurrence: coalesce(r.occurrence, 1), registered_at: datetime()})
    CREATE (f)-[:DEFINES_RECORD]->(n)
  )
  WITH r, key
  MATCH (n:DataRecord {identity_key: key})
  SET n.level = r.level, n.start_line = r.start_line, n.end_line = r.end_line,
      n.is_fragment = coalesce(r.is_fragment, false), n.fd_name = r.fd_name, n.redefines = r.redefines,
      n.pic = r.pic, n.normalized_type = r.normalized_type, n.length = r.length,
      n.decimal_places = r.decimal_places, n.signed = r.signed, n.storage_type = r.storage_type,
      n.elementary_bytes = r.bytes, n.value = r.value,
      n.status = 'ACTIVE', n.last_run_id = $run_id, n.last_local_id = r.local_id, n.last_seen_at = datetime(),
      n.review_status = CASE WHEN coalesce(r.occurrence, 1) > 1 THEN 'REVIEW_REQUIRED'
                             ELSE coalesce(n.review_status, 'NONE') END
  WITH n, r
  OPTIONAL MATCH (sec:CobolSection {section_id: r.section_id, file_id: $file_id})
  FOREACH (s IN CASE WHEN sec IS NULL THEN [] ELSE [sec] END | MERGE (s)-[:DECLARES_RECORD]->(n))
}
CALL {
  WITH q
  UNWIND $fields AS fl
  MATCH (rec:DataRecord {file_id: $file_id, last_run_id: $run_id, last_local_id: fl.record_local_id})
  WITH q, fl, rec, rec.record_id + '|' + fl.path AS key
  OPTIONAL MATCH (existing:DataField {identity_key: key})
  FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
    SET q.fld_seq = q.fld_seq + 1
    CREATE (:DataField {
      field_id: $file_id + '-FLD-' +
        CASE WHEN q.fld_seq < 1000000 THEN right('00000' + toString(q.fld_seq), 6) ELSE toString(q.fld_seq) END,
      field_number: q.fld_seq, identity_key: key, system_id: $system_id, file_id: $file_id,
      record_id: rec.record_id, path: fl.path, registered_at: datetime()})
  )
  WITH fl, rec, key
  MATCH (n:DataField {identity_key: key})
  SET n.name = fl.name, n.qualified_name = rec.name + '.' + fl.path, n.level = fl.level, n.seq = fl.seq,
      n.is_group = coalesce(fl.is_group, false), n.is_filler = coalesce(fl.is_filler, false),
      n.is_condition = coalesce(fl.is_condition, false), n.pic = fl.pic,
      n.normalized_type = fl.normalized_type, n.length = fl.length, n.decimal_places = fl.decimal_places,
      n.signed = fl.signed, n.storage_type = fl.storage_type, n.elementary_bytes = fl.bytes,
      n.occurs_min = fl.occurs_min, n.occurs_max = fl.occurs_max, n.depending_on = fl.depending_on,
      n.indexed_by = fl.indexed_by, n.value = fl.value, n.values_raw = fl.values_raw,
      n.redefines_path = fl.redefines_path, n.start_line = fl.start_line, n.end_line = fl.end_line,
      n.status = 'ACTIVE', n.last_run_id = $run_id, n.last_local_id = fl.local_id, n.last_seen_at = datetime()
}
CALL {
  WITH q
  UNWIND $fields AS fl
  MATCH (n:DataField {file_id: $file_id, last_run_id: $run_id, last_local_id: fl.local_id})
  OPTIONAL MATCH (pf:DataField {file_id: $file_id, last_run_id: $run_id, last_local_id: fl.parent_local_id})
  OPTIONAL MATCH (pr:DataRecord {file_id: $file_id, last_run_id: $run_id, last_local_id: fl.record_local_id})
  WITH n, fl, CASE WHEN fl.parent_local_id IS NULL THEN pr ELSE pf END AS parent
  WHERE parent IS NOT NULL
  MERGE (parent)-[c:CONTAINS_FIELD]->(n)
  SET c.seq = fl.seq
}
CALL {
  WITH q
  UNWIND [fl IN $fields WHERE fl.redefines_path IS NOT NULL] AS fl
  MATCH (n:DataField {file_id: $file_id, last_run_id: $run_id, last_local_id: fl.local_id})
  OPTIONAL MATCH (t:DataField {identity_key: n.record_id + '|' + fl.redefines_path})
  SET n.redefines_resolved = t IS NOT NULL
  FOREACH (x IN CASE WHEN t IS NULL THEN [] ELSE [t] END | MERGE (n)-[:REDEFINES]->(x))
}
CALL {
  WITH q
  UNWIND [r IN $records WHERE r.redefines IS NOT NULL] AS r
  MATCH (n:DataRecord {file_id: $file_id, last_run_id: $run_id, last_local_id: r.local_id})
  OPTIONAL MATCH (t:DataRecord {identity_key: $file_id + '|' + r.section + '|' + r.redefines})
  SET n.redefines_resolved = t IS NOT NULL
  FOREACH (x IN CASE WHEN t IS NULL THEN [] ELSE [t] END | MERGE (n)-[:REDEFINES]->(x))
}
CALL {
  WITH f, q
  UNWIND $copy_expansions AS ce
  OPTIONAL MATCH (hr:DataRecord {file_id: $file_id, last_run_id: $run_id, last_local_id: ce.holder_local_id})
  OPTIONAL MATCH (hf:DataField {file_id: $file_id, last_run_id: $run_id, last_local_id: ce.holder_local_id})
  OPTIONAL MATCH (hs:CobolSection {section_id: ce.section_id, file_id: $file_id})
  WITH f, ce, coalesce(hf, hr, hs) AS holder
  OPTIONAL MATCH (cf:SourceFile {file_id: ce.copybook_file_id})
  FOREACH (c IN CASE WHEN cf IS NULL THEN [] ELSE [cf] END |
    MERGE (f)-[u:USES_COPYBOOK {line: ce.line}]->(c)
    SET u.copybook = ce.copybook, u.include_kind = ce.include_kind, u.replacing = ce.replacing,
        u.run_id = $run_id)
  WITH ce, holder, cf
  OPTIONAL MATCH (cf)-[:DEFINES_RECORD]->(cr:DataRecord {status: 'ACTIVE'})
  WITH ce, holder, cr
  WHERE holder IS NOT NULL AND cr IS NOT NULL
  MERGE (holder)-[e:EXPANDS_COPY {line: ce.line, target: cr.record_id}]->(cr)
  SET e.copybook = ce.copybook, e.include_kind = ce.include_kind, e.replacing = ce.replacing,
      e.run_id = $run_id
}
```

- If a batch call **fails**, it was rolled back completely. Resend the same
  batch once.
- If a batch **succeeded** but left items unregistered (wrong local IDs or
  parents): fix the parameters and resend the whole batch. It never creates a
  second ID for a key that already exists, so resending is safe.
- If it fails again, stop for this file.

### Step 4 — complete the file's data run

Send only after every batch for this file has returned. The expected counts
are the records and fields submitted in this run. If the registry has seen
fewer, nothing is marked inactive and the run stays open.

```cypher
// REVFORGE-QUERY: finalize-data-run (write)
// params: file_id, run_id, worker_id, expected_records, expected_fields
MATCH (q:DataSequence {file_id: $file_id})
WHERE q.active_run_id = $run_id AND q.active_worker_id = $worker_id
CALL { WITH q MATCH (r:DataRecord {file_id: $file_id, last_run_id: $run_id}) RETURN count(r) AS seen_records }
CALL { WITH q MATCH (x:DataField {file_id: $file_id, last_run_id: $run_id}) RETURN count(x) AS seen_fields }
WITH q, seen_records, seen_fields
WHERE seen_records = $expected_records AND seen_fields = $expected_fields
CALL {
  WITH q
  MATCH (r:DataRecord {file_id: $file_id, status: 'ACTIVE'}) WHERE coalesce(r.last_run_id, '') <> $run_id
  SET r.status = 'INACTIVE', r.inactivated_run_id = $run_id, r.inactivated_at = datetime()
}
CALL {
  WITH q
  MATCH (x:DataField {file_id: $file_id, status: 'ACTIVE'}) WHERE coalesce(x.last_run_id, '') <> $run_id
  SET x.status = 'INACTIVE', x.inactivated_run_id = $run_id, x.inactivated_at = datetime()
}
// sizes: elementary bytes as given; groups = sum of descendants x OCCURS, excluding REDEFINES subtrees
CALL {
  WITH q
  MATCH (x:DataField {file_id: $file_id, last_run_id: $run_id})
  WHERE NOT x.is_group
  SET x.bytes = x.elementary_bytes
}
CALL {
  WITH q
  MATCH (g:DataField {file_id: $file_id, last_run_id: $run_id, is_group: true})
  OPTIONAL MATCH p = (g)-[:CONTAINS_FIELD*1..]->(e:DataField {status: 'ACTIVE'})
  WHERE e.elementary_bytes IS NOT NULL AND NOT e.is_group AND NOT e.is_condition
    AND none(x IN nodes(p)[1..] WHERE x.redefines_path IS NOT NULL)
  WITH g, sum(e.elementary_bytes * reduce(m = 1, x IN nodes(p)[1..] | m * coalesce(x.occurs_max, 1))) AS b
  SET g.bytes = b
}
CALL {
  WITH q
  MATCH (r:DataRecord {file_id: $file_id, last_run_id: $run_id})
  OPTIONAL MATCH p = (r)-[:CONTAINS_FIELD*1..]->(e:DataField {status: 'ACTIVE'})
  WHERE e.elementary_bytes IS NOT NULL AND NOT e.is_group AND NOT e.is_condition
    AND none(x IN nodes(p)[1..] WHERE x.redefines_path IS NOT NULL)
  WITH r, sum(e.elementary_bytes * reduce(m = 1, x IN nodes(p)[1..] | m * coalesce(x.occurs_max, 1))) AS own
  OPTIONAL MATCH (r)-[:CONTAINS_FIELD*0..]->(h)-[:EXPANDS_COPY]->(cr:DataRecord {status: 'ACTIVE'})
  WITH r, own, sum(coalesce(cr.total_bytes, 0)) AS expanded
  SET r.inline_bytes = own + coalesce(r.elementary_bytes, 0),
      r.total_bytes = own + coalesce(r.elementary_bytes, 0) + expanded
}
SET q.last_completed_run_id = $run_id, q.last_completed_at = datetime(),
    q.active_run_id = null, q.active_worker_id = null
```

### Step 5 — verify, then fetch the identities

```cypher
// REVFORGE-QUERY: verify-data-integrity (read)
// params: file_id, run_id
MATCH (q:DataSequence {file_id: $file_id})
CALL {
  WITH q
  MATCH (r:DataRecord {file_id: $file_id})
  OPTIONAL MATCH (fl:SourceFile {file_id: $file_id})-[:DEFINES_RECORD]->(r)
  RETURN count(r) AS records, count(DISTINCT r.record_id) AS distinct_record_ids,
         coalesce(max(r.record_number), 0) AS max_record_number,
         sum(CASE WHEN r.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_records,
         sum(CASE WHEN fl IS NULL THEN 1 ELSE 0 END) AS records_without_file
}
CALL {
  WITH q
  MATCH (x:DataField {file_id: $file_id})
  RETURN count(x) AS fields, count(DISTINCT x.field_id) AS distinct_field_ids,
         coalesce(max(x.field_number), 0) AS max_field_number,
         sum(CASE WHEN x.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_fields
}
CALL {
  WITH q
  MATCH (x:DataField {file_id: $file_id, status: 'ACTIVE'})
  OPTIONAL MATCH (p)-[:CONTAINS_FIELD]->(x)
  WITH x, count(p) AS parents
  RETURN sum(CASE WHEN parents = 1 THEN 0 ELSE 1 END) AS active_fields_without_one_parent
}
RETURN $file_id AS file_id, q.active_run_id AS active_run_id,
       q.last_completed_run_id = $run_id AS run_completed,
       records, active_records, fields, active_fields,
       q.rec_seq AS record_counter, q.fld_seq AS field_counter,
       (records = distinct_record_ids AND max_record_number <= q.rec_seq AND records_without_file = 0
        AND fields = distinct_field_ids AND max_field_number <= q.fld_seq
        AND active_fields_without_one_parent = 0
        AND q.active_run_id IS NULL AND q.last_completed_run_id = $run_id) AS consistent
```

`consistent` and `run_completed` must be `true`, and `active_records` and
`active_fields` must equal what was submitted. Then:

```cypher
// REVFORGE-QUERY: fetch-data-identities (read)
// params: file_id, run_id
MATCH (n:DataRecord|DataField {file_id: $file_id, last_run_id: $run_id})
RETURN n.last_local_id AS local_id, CASE WHEN n:DataRecord THEN n.record_id ELSE n.field_id END AS id,
       CASE WHEN n:DataRecord THEN 'record' ELSE 'field' END AS kind,
       n.record_id AS record_id, n.bytes AS bytes, n.total_bytes AS total_bytes,
       n.inline_bytes AS inline_bytes, n.redefines_resolved AS redefines_resolved,
       n.review_status AS review_status
ORDER BY kind DESC, toInteger(substring(n.last_local_id, 1))
```

For a field, `record_id` is its record and `id` is its Field ID. Every
submitted `local_id` must come back exactly once. Copy the IDs and the
computed sizes into the layout:
- a field's `bytes` is the returned `bytes`;
- a record's `bytes` and `total_bytes` are the returned `total_bytes`, and
  `inline_bytes` is the record's own fields without expanded copybooks.

If the file registered copy stubs, also read them back and check that each
submitted stub appears with the expected number of `EXPANDS_COPY` targets:

```cypher
// REVFORGE-QUERY: fetch-copy-expansions (read)
// params: file_id
MATCH (f:SourceFile {file_id: $file_id})-[u:USES_COPYBOOK]->(c:SourceFile)
OPTIONAL MATCH (h)-[e:EXPANDS_COPY {line: u.line}]->(cr:DataRecord)
WHERE h.file_id = $file_id
RETURN u.line AS line, u.copybook AS copybook, c.file_id AS copybook_file_id, u.replacing AS replacing,
       collect(DISTINCT coalesce(h.record_id, h.field_id, h.section_id)) AS holders,
       collect(DISTINCT cr.record_id) AS expanded_record_ids
ORDER BY line
```

A stub with an empty `expanded_record_ids` is unresolved: log a `warning`.

---

## Output schema — layout file per copybook/program WS

```json
{
  "id": "CVACT01Y",
  "source_type": "copybook",
  "source_file": "app/copy/CVACT01Y.CPY",
  "used_by_programs": ["CBACT01C", "COACT01C", "COACT02C"],
  "total_fields": 24,
  "total_bytes": 300,
  "system_id": "SYS-CARDDEMO-001",
  "file_id": "SYS-CARDDEMO-001-FIL-0002",
  "path_id": "SYS-CARDDEMO-001-PATH-0002",
  "data_run_id": "DRUN-20261025T101500Z-12345",
  "records": [
    {
      "record_id": "SYS-CARDDEMO-001-FIL-0002-REC-0001",
      "section": "COPYBOOK",
      "is_fragment": false,
      "level": 1,
      "name": "ACCOUNT-RECORD",
      "pic": null,
      "type": "GROUP",
      "storage_type": "DISPLAY",
      "bytes": 300,
      "redefines": null,
      "occurs": null,
      "value": null,
      "line": 5,
      "children": [
        {
          "field_id": "SYS-CARDDEMO-001-FIL-0002-FLD-000001",
          "path": "ACCT-ID",
          "level": 5,
          "name": "ACCT-ID",
          "pic": "X(11)",
          "pic_parsed": {
            "raw": "X(11)",
            "normalized_type": "STRING",
            "length": 11,
            "decimal_places": 0,
            "signed": false,
            "storage_type": "DISPLAY"
          },
          "bytes": 11,
          "redefines": null,
          "occurs": null,
          "value": null,
          "line": 7,
          "children": []
        },
        {
          "field_id": "SYS-CARDDEMO-001-FIL-0002-FLD-000002",
          "path": "ACCT-BALANCE",
          "level": 5,
          "name": "ACCT-BALANCE",
          "pic": "S9(10)V99 COMP-3",
          "pic_parsed": {
            "raw": "S9(10)V99 COMP-3",
            "normalized_type": "SIGNED_DECIMAL",
            "length": 12,
            "decimal_places": 2,
            "signed": true,
            "storage_type": "PACKED_DECIMAL",
            "bytes": 7
          },
          "redefines": null,
          "occurs": null,
          "value": "ZEROS",
          "line": 9,
          "children": [
            {
              "field_id": "SYS-CARDDEMO-001-FIL-0002-FLD-000003",
              "path": "ACCT-BALANCE.ACCT-OVERDRAWN",
              "level": 88,
              "name": "ACCT-OVERDRAWN",
              "pic": null,
              "type": "CONDITION",
              "parent_field": "ACCT-BALANCE",
              "values": [{"from": -999999999.99, "to": -0.01}],
              "line": 10,
              "children": []
            }
          ]
        },
        {
          "field_id": "SYS-CARDDEMO-001-FIL-0002-FLD-000004",
          "path": "FILLER#1",
          "filler_key": "FILLER_0015",
          "level": 5,
          "name": "FILLER_0015",
          "pic": "X(10)",
          "pic_parsed": {
            "raw": "X(10)",
            "normalized_type": "STRING",
            "length": 10,
            "signed": false,
            "storage_type": "DISPLAY"
          },
          "is_filler": true,
          "line": 15,
          "children": []
        },
        {
          "field_id": "SYS-CARDDEMO-001-FIL-0002-FLD-000005",
          "path": "ACCT-TYPE-REDEF",
          "level": 5,
          "name": "ACCT-TYPE-REDEF",
          "pic": "9(3)",
          "redefines": "ACCT-TYPE-CODE",
          "redefines_path": "ACCT-TYPE-CODE",
          "pic_parsed": {
            "raw": "9(3)",
            "normalized_type": "INTEGER",
            "length": 3
          },
          "line": 22,
          "children": []
        },
        {
          "field_id": "SYS-CARDDEMO-001-FIL-0002-FLD-000006",
          "path": "TRANS-TABLE",
          "level": 5,
          "name": "TRANS-TABLE",
          "pic": null,
          "type": "GROUP",
          "occurs": {
            "min": 1,
            "max": 12,
            "variable_length": false,
            "depending_on": null,
            "indexed_by": ["TRANS-IDX"],
            "keys": [{"field": "TRANS-DATE", "order": "ASCENDING"}]
          },
          "line": 28,
          "children": []
        }
      ]
    }
  ],
  "copy_expansions": [],
  "layout_issues": []
}
```

REVFORGE field notes:
- `id`, `source_type`, `source_file`, `used_by_programs`, `total_fields`,
  `total_bytes`, `records`, `children` and `layout_issues` keep their
  meaning.
- `system_id`, `file_id` and `path_id` are the defining file's Agent 1
  identities. `record_id` and `field_id` are the permanent IDs from Neo4j.
- `bytes` (groups and records) and `total_bytes` are the values computed by
  `finalize-data-run`.
- For a program layout, `source_type` is `"program_ws"` and `records` holds
  all its FILE, WORKING-STORAGE, LINKAGE and LOCAL-STORAGE records in source
  order, each with `section` and (FILE records) `fd_name`. An expanded copy
  stub appears as an entry `{"type": "copy_expansion", "copybook", "copybook_file_id",
  "line", "replacing", "records": [copybook records with their copybook IDs]}`
  at the stub's position.
- `copy_expansions` lists the stubs registered in Neo4j.
- `total_fields` counts this file's registered fields; expanded copybook
  fields are not counted.
- The file-level `total_bytes` is the sum of the file's own records'
  `total_bytes`. A copybook expanded directly under an FD or a section, with
  no enclosing 01, belongs to no record of the program. It counts in the
  copybook's own records only, and is listed in `copy_expansions`.
- Layout file names: `data_layouts/{FILE_ID}__{COPYBOOK}.json` and
  `data_layouts/{FILE_ID}__{PROGRAM_ID}_WS.json`.

### Catalogue fragments (REVFORGE)

Next to each layout, write the file's catalogue entries for the
data-dictionary-builder, **one JSON object per line** (no commas, no
brackets), in `data_layouts/_catalogue/`:

| File | One line per |
|---|---|
| `{FILE_ID}.records.jsonl` | record — the `record_catalogue` entry |
| `{FILE_ID}.fields.jsonl` | elementary field (not group, not 88) — the `field_catalogue` entry |
| `{FILE_ID}.conditions.jsonl` | 88-level — the `condition_catalogue` entry |
| `{FILE_ID}.redefines.jsonl` | REDEFINES item — `{record_id, field_id, path, redefines, redefines_target_id, redefines_resolved}` |
| `{FILE_ID}.issues.jsonl` | layout issue — `{severity, type, file_id, source_id, line, message}` |

The entry formats are defined in the data-dictionary-builder skill. An empty
list is an empty file.

---

## Error handling

| Condition | Action |
|---|---|
| PIC clause spans multiple lines | Concatenate continuation lines before parsing |
| PIC clause is unrecognised | Record raw string, set `normalized_type: "UNKNOWN"`, log `warning` |
| REDEFINES target not found in same record | Log `warning`, record `redefines_resolved: false` |
| OCCURS DEPENDING ON variable not in same record | Log `warning`, record field name only |
| Copybook not found for COPY stub | Leave as unresolved stub, log `warning` |
| REPLACING clause substitution produces duplicate name | Log `warning`, append `_R` suffix |
| Level sequence invalid | Log `warning`, best-effort parent assignment |
| Continuation line missing | Log `warning`, parse what is available |
| Agent 2 `raw_structure` file missing for a program | Do not parse that program's WS/LS; log `error` `parser_output_missing` |
| `.sql` DDL file in `copybook_registry` | Skip, log `info` `non_cobol_layout_skipped` |
| Neo4j unavailable, constraints missing, or an item has no ID after registration | Stop for this file, log `error` `registry_failure`; write no layout for it |
| File locked by another run | Stop for this file, log `error` `data_run_locked`; take over only via `DATA_TAKEOVER_RUN_ID` |
| `finalize-data-run` does not complete (counts differ) | Log `error` `data_run_incomplete`; write no layout |
