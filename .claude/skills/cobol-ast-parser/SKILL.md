---
name: cobol-ast-parser
description: >
  Opens a single COBOL program file and extracts its full structural
  hierarchy: all four DIVISIONs, SECTIONs within each, paragraph names
  and their line boundaries in the PROCEDURE DIVISION, WORKING-STORAGE
  entries (01-level groups and their children), FILE SECTION FD/SD
  descriptors, LINKAGE SECTION entries, and COPY statement positions.
  Produces a structured AST-like JSON object for one program. Called once
  per program by the Parser Agent. Does not interpret logic or data meaning.
  REVFORGE: also extracts every executable statement (with nesting) and
  registers permanent Section, Paragraph and Statement IDs in Neo4j.
---

## Purpose

Read one COBOL source file top to bottom. Identify and record every
structural boundary — where each DIVISION starts, where each SECTION
starts, where each paragraph starts and ends. Extract data definition
entries from DATA DIVISION sections. Record COPY statement positions as
stubs (do not expand them).

Produce a single JSON object: the program's raw structural AST.

REVFORGE enhancement: also split the PROCEDURE DIVISION into individual
executable statements, keeping nesting (Phase 5). Register sections,
paragraphs and statements in the Neo4j registry, which issues their permanent
IDs (Phase 6). This skill never invents or numbers an ID.

---

## COBOL fixed-format column rules

Always apply before reading any line:

| Columns (1-based) | Index (0-based) | Content | Action |
|---|---|---|---|
| 1–6 | 0–5 | Sequence number | Ignore |
| 7 | 6 | Indicator | `*` or `/` → skip line (comment); `D` → include |
| 8–11 | 7–10 | Area A | Division/section/01-level headers land here |
| 12–72 | 11–71 | Area B | Statements, paragraph bodies, data clauses |
| 73–80 | 72–79 | Identification | Ignore |

**Area A (columns 8–11):** DIVISION headers, SECTION headers, 01-level and
77-level data entries, and paragraph names all start here.

**Area B (columns 12–72):** Subordinate data entries (02–49 level), PERFORM,
MOVE, IF, EVALUATE, CALL, and all other statements start here.

### Source format detection (REVFORGE)

Before applying the column rules, decide the file's format and record it as
`source_format`:

- `free` if the file contains `>>SOURCE FORMAT FREE` / `>>SOURCE FREE`, or if
  its `IDENTIFICATION DIVISION` (or `ID DIVISION`) header starts before
  column 8.
- `fixed` otherwise.

In `free` format, program text is the whole line; a comment is a line whose
first non-blank characters are `*>` or `*`, plus anything after `*>`. Paragraph
names are names that start a line and are followed by a period, outside any
statement. Log an `info` parse issue `free_format_source`.

In both formats, remove inline `*>` comments before analysing a line.

**Misplaced comment indicator.** In fixed format, a line whose first non-blank
character in columns 8–72 is `*` (e.g. `* Take a checkpoint` starting in
column 12) is not valid program text. Treat it as a comment, not a statement.
Log one `warning` parse issue `misplaced_comment_indicator` per file, listing
the line numbers.

---

## Phase 1 — Division boundary detection

Scan the entire file line by line. Detect these markers (case-insensitive,
Area A or B):

```bash
# All four divisions
grep -niE "^\s{0,6}[^*/].{0,6}(IDENTIFICATION|ENVIRONMENT|DATA|PROCEDURE)\s+DIVISION" "$FILE"

# Sections within DATA DIVISION
grep -niE "^\s{0,6}[^*/].{0,6}(FILE|WORKING-STORAGE|LOCAL-STORAGE|LINKAGE|COMMUNICATION|REPORT)\s+SECTION" "$FILE"

# PROCEDURE DIVISION (may have USING clause on same or next line)
grep -niE "^\s{0,6}[^*/].{0,6}PROCEDURE\s+DIVISION" "$FILE"
```

Record start line number for each. Compute end line as (next division start - 1)
or end-of-file.

REVFORGE: also record the ENVIRONMENT DIVISION sections (`CONFIGURATION`,
`INPUT-OUTPUT`). Every section of every division is registered in Phase 6.

---

## Phase 2 — IDENTIFICATION DIVISION extraction

Within the IDENTIFICATION DIVISION, extract:

```bash
grep -niE "^\s{0,6}[^*/].{0,6}PROGRAM-ID\.\s+([A-Z0-9\-]+)"    "$FILE"
grep -niE "^\s{0,6}[^*/].{0,6}AUTHOR\.\s*(.*)"                  "$FILE"
grep -niE "^\s{0,6}[^*/].{0,6}DATE-WRITTEN\.\s*(.*)"            "$FILE"
grep -niE "^\s{0,6}[^*/].{0,6}DATE-COMPILED\.\s*(.*)"           "$FILE"
```

REVFORGE: `program_id` in the output is the value from the Agent 1 inventory,
never a re-derived value. If the PROGRAM-ID found here differs, keep the
inventory value and log a `warning` parse issue `program_id_mismatch` with both
values. If the file has more than one PROGRAM-ID (nested or batch programs),
parse the first program only and log a `warning` issue
`multiple_programs_not_parsed` listing the others.

---

## Phase 3 — DATA DIVISION extraction

### FILE SECTION — FD and SD entries

```bash
# FD (File Description) and SD (Sort Description) headers
grep -niE "^\s{0,6}[^*/].{0,3}(FD|SD)\s+([A-Z0-9\-]+)" "$FILE"
```

For each FD/SD found, record:
- File name (token after FD/SD)
- RECORDING MODE clause if present
- RECORD CONTAINS clause if present
- BLOCK CONTAINS clause if present
- Start line and end line (next FD/SD or next SECTION boundary)

Do NOT parse the 01-level record layout under each FD here — that is
the Data Agent's job. Record only the FD header and its line range.

### WORKING-STORAGE SECTION — data hierarchy

Extract the data item hierarchy using level numbers:

```bash
# All level-numbered entries in WORKING-STORAGE (levels 01–49, 77, 88)
grep -niE "^\s{0,6}[^*/].\s+(0?1|0?2|0?3|0?4|0?5|0?6|0?7|0?8|0?9|[1-4][0-9]|77|88)\s+([A-Z0-9\-]+)" "$FILE"
```

For each entry record:
- Level number (normalised to integer: `01`, `77`, `88`)
- Data name (FILLER if anonymous)
- PIC clause if present on same or continuation line
- OCCURS clause if present (flag as table)
- REDEFINES clause target if present
- VALUE clause if present (literal only — do not evaluate)
- Line number
- Whether it contains a COPY statement instead of inline definition

Level hierarchy rules:
- Level 01 and 77 → top-level entries (children of WORKING-STORAGE)
- Level 02–49 → children of the nearest preceding lower level number
- Level 88 → condition names, children of their parent data item
- FILLER items → record with name `"FILLER"` and a generated unique suffix
  (REVFORGE: `"filler_key": "FILLER_NNNN"`, where NNNN is the 4-digit line number)

### LINKAGE SECTION

Apply the same extraction as WORKING-STORAGE. Mark all entries with
`"section": "LINKAGE"`.

### COPY stubs in DATA DIVISION

Wherever a `COPY` statement appears inside the DATA DIVISION, record a
stub entry instead of expanding it:

```json
{
  "type": "copy_stub",
  "copybook": "CVACT01Y",
  "library": null,
  "line": 145,
  "section": "WORKING-STORAGE",
  "parent_level": "01",
  "note": "Expanded by Data Agent"
}
```

REVFORGE:
- Every stub, in `copy_stubs` and in the data entries, carries
  `include_kind`: `"COPY"`, or `"SQL_INCLUDE"` for `EXEC SQL INCLUDE x END-EXEC`
  (`copybook` = `x`).
- `EXEC SQL BEGIN DECLARE SECTION` / `END DECLARE SECTION` lines in the DATA
  DIVISION are recorded in `data_division.sql_declare_sections` as
  `[{start_line, end_line}]`. They are not data entries.

---

## Phase 4 — PROCEDURE DIVISION extraction

### USING clause (parameters)

```bash
# PROCEDURE DIVISION USING parameters
grep -niE "PROCEDURE\s+DIVISION\s+USING\s+(.*)" "$FILE"
```

Record each parameter name listed after USING.

### Section headers within PROCEDURE DIVISION

```bash
# Named sections inside PROCEDURE DIVISION (Area A, followed by SECTION keyword)
grep -niE "^.{7}([A-Z0-9\-]+)\s+SECTION\." "$FILE"
```

### Paragraph names

Paragraph names appear in Area A (columns 8–11 start) and are followed
by a period on the same line or immediately after:

```bash
# Paragraph names — start in Area A, end with period
grep -niE "^.{7}([A-Z0-9\-]+)\s*\." "$FILE"
```

Disambiguate paragraph names from data entries and section headers:
- If the line number falls within DATA DIVISION bounds → skip
- If the token is a known COBOL reserved word → skip
- If the token is immediately followed by `SECTION` → it is a section header

REVFORGE: a paragraph name must **begin in Area A** (columns 8–11 in fixed
format). Scope terminators and statement fragments that end with a period —
`END-EXEC.`, `END-IF.`, `END-PERFORM.`, `END-EVALUATE.`, `GOBACK.`, `EXIT.`,
a file name on its own line — are never paragraph names, even when the grep
above matches them. Confirm every candidate by reading the line.

REVFORGE — a lone name in Area A with **no period**, which only happens in a
truncated or damaged file (for example `P200-EXIT` as the last line), is
recorded as a paragraph header. Log a `warning` parse issue
`paragraph_header_without_period`. Never record it as a statement.

For each paragraph, record:
- Name
- Start line
- End line (line before next paragraph or end of PROCEDURE DIVISION)
- Parent section name (if the paragraph is inside a named section)
- Whether it contains any PERFORM, GO TO, CALL, or STOP RUN statements
  (boolean flags — do not extract the statements themselves here)

REVFORGE:
- The boolean flags are derived from the statements extracted in Phase 5,
  so they always agree with them.
- `has_stop_run` is true only for `STOP RUN`.
- Paragraph IDs are registered for PROCEDURE DIVISION paragraphs only.
  ENVIRONMENT DIVISION paragraphs (`FILE-CONTROL`, `SOURCE-COMPUTER`, …) are
  recorded in the JSON as before, but not registered.

### STOP RUN / GOBACK / EXIT PROGRAM detection

```bash
grep -niE "(STOP\s+RUN|GOBACK|EXIT\s+PROGRAM)" "$FILE"
```

Record line numbers — these are terminal points in control flow.

REVFORGE: `EXEC CICS RETURN` and `EXEC CICS XCTL` are also terminal points
(types `CICS RETURN`, `CICS XCTL`). Take every terminal from the Phase 5
statement list and record its `statement_id`.

---

## Phase 5 — Executable statement extraction (REVFORGE)

Split the body of every paragraph into executable statements. This is
**structure only**: never interpret what a statement means, and never invent
syntax that is not in the file. Read the source with line numbers, using the
Read tool.

### What is a statement

A statement starts with a COBOL verb. `statement_type` is the verb in
uppercase, with multi-word verbs written with one space between words:

`ACCEPT ADD ALTER CALL CANCEL CLOSE COMPUTE CONTINUE DELETE DISPLAY DIVIDE
EVALUATE EXEC CICS EXEC SQL EXIT GO TO GOBACK IF INITIALIZE INSPECT MERGE MOVE
MULTIPLY NEXT SENTENCE OPEN PERFORM READ RELEASE RETURN REWRITE SEARCH SET SORT
START STOP STRING SUBTRACT UNSTRING WRITE`

A `COPY` inside the PROCEDURE DIVISION is recorded as a statement of type
`COPY` (a stub — do not expand it). Anything else that occupies a statement
position gets type `UNKNOWN` and `extraction_status: "UNCERTAIN"`.

**Not statements:** scope terminators (`END-IF`, `END-EVALUATE`,
`END-PERFORM`, `END-READ`, `END-WRITE`, `END-CALL`, `END-COMPUTE`,
`END-STRING`, `END-EXEC`, …), `ELSE`, `WHEN`, the conditional phrases listed
below, `THEN`, and the separator period. They only end or divide the statement
they belong to.

### Compound statements and branches

A statement that contains other statements is a **compound** statement. Its
nested statements are its children, grouped into **branches**:

| Statement | Branch labels (exact text) |
|---|---|
| `IF` | `THEN`, `ELSE` |
| `EVALUATE` | `WHEN <phrase>` for each WHEN group, `WHEN OTHER` |
| `SEARCH` | `AT END`, `WHEN <phrase>` |
| Inline `PERFORM` (PERFORM … END-PERFORM with no procedure name) | `BODY` |
| `READ`, `RETURN` | `AT END`, `NOT AT END`, `INVALID KEY`, `NOT INVALID KEY` |
| `WRITE`, `REWRITE`, `DELETE`, `START` | `INVALID KEY`, `NOT INVALID KEY`, `AT END-OF-PAGE`, `NOT AT END-OF-PAGE` |
| `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `COMPUTE` | `ON SIZE ERROR`, `NOT ON SIZE ERROR` |
| `CALL` | `ON EXCEPTION`, `NOT ON EXCEPTION`, `ON OVERFLOW` |
| `STRING`, `UNSTRING` | `ON OVERFLOW`, `NOT ON OVERFLOW` |

- Write branch labels in this canonical form even when optional words are
  omitted in the source (`SIZE ERROR` → `ON SIZE ERROR`, `END` → `AT END`).
- `WHEN <phrase>`: the WHEN keyword plus its selection text, whitespace
  collapsed (e.g. `WHEN 'CR'`). Several WHENs stacked before one group of
  statements form one label: `WHEN 'A' WHEN 'B'`. If two branches of the same
  statement would get the same label, append ` #2`, ` #3`, … to the later ones
  and log an `info` issue.
- `ELSE IF …` is an `IF` statement that is the child of the `ELSE` branch.
- A `PERFORM` that names a procedure (`PERFORM X`, `PERFORM X THRU Y`,
  `PERFORM X UNTIL …`, `PERFORM X VARYING …`, `PERFORM X n TIMES`) is a simple
  statement. Only `PERFORM … END-PERFORM` with no procedure name has a `BODY`.
- A conditional statement without a scope terminator ends at the next period,
  or at the `ELSE` / conditional phrase that closes its branch.

### Statement text

`text` is the statement's own source text:
- Program text only: columns 8–72 in fixed format, the whole line in free
  format. Remove comment lines and inline `*>` comments. Join the lines of a
  multi-line statement with a single space.
- Keep the original spelling, letter case and spacing within each line. Do
  not reformat, expand or correct anything.
- **Simple statement:** from its verb up to, not including, the next verb,
  scope terminator, `ELSE`, `WHEN` or conditional phrase, or the separator
  period.
- **Compound statement:** the **header only** — from the verb up to, not
  including, its first branch keyword or first nested statement. For example
  `IF WS-STATUS = '00'`, `EVALUATE TRUE`, `READ IN-FILE INTO WS-REC`,
  `PERFORM UNTIL WS-EOF = 'Y'`. The children carry their own text.
- `EXEC SQL … END-EXEC` and `EXEC CICS … END-EXEC` are single statements
  whose text runs from `EXEC` through `END-EXEC`.

Changing whitespace, line breaks or blank lines never changes a statement:
Neo4j compares statements by their text with whitespace collapsed and one
trailing period removed (`normalized_text`).

### Statement fields

| Field | Rule |
|---|---|
| `local_id` | `L1`, `L2`, … in pre-order across the whole file (a parent before its children, children in source order). Run-local only — never stored as an identity |
| `paragraph` | Name of the paragraph the statement belongs to |
| `parent_local_id` | `local_id` of the enclosing compound statement; `null` at paragraph level |
| `branch` | Branch label in the parent; `null` at paragraph level |
| `depth` | 0 at paragraph level; parent depth + 1 |
| `sibling_index` | 1, 2, … in source order among statements with the same parent and branch (for depth 0: the paragraph's top-level statements) |
| `statement_type` | See above |
| `text` | See above |
| `start_line` | Line of the statement's verb |
| `end_line` | Last line holding the statement's text, its nested statements or its scope terminator. A separator period alone on a later line is not counted |
| `extraction_status` | `OK`, or `UNCERTAIN` when a boundary or type cannot be decided from the source |

When `extraction_status` is `UNCERTAIN`, also log a `warning` parse issue
`uncertain_statement` with the lines and the reason. **Do not guess:** an
unbalanced scope, an unreadable line or an unknown verb is recorded as found
and flagged.

### Statements outside a paragraph

Statements between `PROCEDURE DIVISION` (or a section header) and the first
paragraph name belong to an unnamed paragraph called `(UNNAMED)` in that
scope. Log an `info` issue `unnamed_paragraph`.
- Its `start_line` is the first line after the division or section header,
  including any `USING` lines.
- Its `end_line` is the line before the first named paragraph, or the end of
  that section or division.
- Each scope has at most one `(UNNAMED)` paragraph. Its identity key contains
  the scope, so unnamed paragraphs in different sections never collide.

---

## Phase 6 — Permanent identity registration (REVFORGE)

### Identifiers

| ID | Format | Example | Identity key (never line numbers) |
|---|---|---|---|
| Section ID | `{FILE_ID}-SEC-{NNNN}` | `SYS-BANKING-001-FIL-0001-SEC-0001` | File ID + division name + section name |
| Paragraph ID | `{FILE_ID}-PAR-{NNNN}` | `SYS-BANKING-001-FIL-0001-PAR-0001` | File ID + parent section ID (or `PROGRAM` for paragraphs outside a named section) + paragraph name |
| Statement ID | `{FILE_ID}-STMT-{NNNNNN}` | `SYS-BANKING-001-FIL-0001-STMT-000001` | Matched by evidence (see "Statement matching") |

Numbers come from per-file counters in Neo4j and only ever increase; numbers
of removed items are never reused. Line numbers are stored as metadata only.
The numbering order is an allocation detail. Statement IDs are allocated
level by level, so they are **not** in source order. Use `start_line`,
`sibling_index` and `local_id` for order, never the ID.

**Absolute rules**
1. Never compute, guess or edit a Section, Paragraph or Statement ID. Copy
   every ID verbatim from a Neo4j result of this run.
2. Never change Agent 1 identities (`system_id`, `file_id`, `path_id`,
   `program_id`). They come from the inventory and the Agent 1 registry.
3. Use only the queries in this section and in the section-mapper skill, with
   values passed as parameters.
4. Send a read only after the writes it depends on have **returned** — never
   in the same parallel group of tool calls. The MCP server executes
   concurrent requests concurrently.
5. If Neo4j is unreachable, the registry constraints are missing, or any
   section, paragraph or statement has no ID after registration, stop for this
   file and record the error. Do not write its `raw_structure` file with
   missing or invented IDs.

**Duplicates.** If a division declares the same section name twice, or a
scope declares the same paragraph name twice, give the second one
`occurrence: 2` (third `3`, …). It is then registered under its own identity
with `review_status: "REVIEW_REQUIRED"`, and a `warning` parse issue
`duplicate_declaration` is logged. Duplicates are never merged.

### Statement matching (done by Neo4j, not by you)

`register-statements` compares each statement with the **active** registered
statements in the same scope (same paragraph, same parent statement, same
branch). It applies these steps in order:

| Step | Evidence | Result |
|---|---|---|
| A | Same normalized text **and** same previous and next sibling text; unique on both sides | Existing ID reused, `match: UNCHANGED` |
| B | Same normalized text, unique on both sides | Existing ID reused, `match: MATCHED_BY_TEXT` (e.g. reordered, neighbours changed) |
| C | Identical duplicates, same count on both sides | Existing IDs reused in source order, `match: MATCHED_BY_ORDER` |
| D | Text changed, but both neighbours are matched and exactly one unmatched old statement of the same type lies between them | Existing ID reused, `match: MODIFIED` |
| E | Same text as unmatched old statements, but steps A–D cannot decide | **New** ID, `review_status: REVIEW_REQUIRED`, linked `REVIEW_CANDIDATE` to every possible old statement |
| — | No evidence | New ID, `match: NEW` |

Consequences:
- Blank lines and re-wrapping never change IDs.
- An inserted statement gets a new ID, and existing statements keep theirs.
- A statement moved to **another** paragraph or parent gets a new ID, because
  its scope differs. The old one becomes `INACTIVE` when the run completes.
- If a compound statement's own header changes and step D cannot match it,
  it gets a new ID, so its children also get new IDs.
- Statements not seen in a **completed** run become `INACTIVE` (section-mapper,
  `finalize-parse-run`). Their IDs are never reused.

### Step 1 — verify the registry

```cypher
// REVFORGE-QUERY: verify-parser-registry (read)
SHOW CONSTRAINTS YIELD name
WHERE name STARTS WITH 'revforge_parser_' OR name STARTS WITH 'revforge_registry_'
RETURN sum(CASE WHEN name STARTS WITH 'revforge_parser_' THEN 1 ELSE 0 END) AS parser_constraints,
       sum(CASE WHEN name STARTS WITH 'revforge_registry_' THEN 1 ELSE 0 END) AS registry_constraints
```

Continue only if `parser_constraints = 6` and `registry_constraints = 7`.
Otherwise stop and ask for the one-time initialisation. The MCP write tool
rejects schema commands.

**One-time initialisation (administrator, via `cypher-shell` or Neo4j Browser):**

```cypher
// REVFORGE-QUERY: init-parser-registry (admin, run once; idempotent)
CREATE CONSTRAINT revforge_parser_state_file IF NOT EXISTS
  FOR (q:ParserSequence) REQUIRE q.file_id IS UNIQUE;
CREATE CONSTRAINT revforge_parser_section_id IF NOT EXISTS
  FOR (n:CobolSection) REQUIRE n.section_id IS UNIQUE;
CREATE CONSTRAINT revforge_parser_section_key IF NOT EXISTS
  FOR (n:CobolSection) REQUIRE n.identity_key IS UNIQUE;
CREATE CONSTRAINT revforge_parser_paragraph_id IF NOT EXISTS
  FOR (n:CobolParagraph) REQUIRE n.paragraph_id IS UNIQUE;
CREATE CONSTRAINT revforge_parser_paragraph_key IF NOT EXISTS
  FOR (n:CobolParagraph) REQUIRE n.identity_key IS UNIQUE;
CREATE CONSTRAINT revforge_parser_statement_id IF NOT EXISTS
  FOR (n:CobolStatement) REQUIRE n.statement_id IS UNIQUE;
CREATE INDEX revforge_parser_statement_scope IF NOT EXISTS
  FOR (n:CobolStatement) ON (n.file_id, n.scope_key);
CREATE INDEX revforge_parser_statement_run IF NOT EXISTS
  FOR (n:CobolStatement) ON (n.file_id, n.last_run_id);
```

### Step 2 — confirm the Agent 1 identities

```cypher
// REVFORGE-QUERY: resolve-files (read)
// params: system_id, file_ids: [string]
MATCH (:System {system_id: $system_id})-[:HAS_FILE]->(f:SourceFile)-[:LOCATED_AT]->(p:FilePath)
WHERE f.file_id IN $file_ids
RETURN f.file_id AS file_id, p.path_id AS path_id, p.relative_path AS relative_path,
       f.file_name AS file_name, f.program_id AS program_id
```

Each inventory entry must come back with the same `path_id`, `relative_path`
and `program_id`. If a File ID is missing, or any value differs, do not parse
that file. Record an `error` issue `inventory_identity_mismatch`; never invent
or repair an ID.

### Step 3 — begin the parse run and register sections and paragraphs

`run_id` and `worker_id` are the agent's parse-run and worker identifiers (see
the agent definition). They are not permanent IDs. Every write in this skill
and in section-mapper passes both.

```cypher
// REVFORGE-QUERY: begin-parse-run (write)
// params: system_id, file_id, run_id, worker_id, takeover_run_id (null unless taking over a stale run),
//   sections:   [{division, name, occurrence, start_line, end_line}]
//   paragraphs: [{section_division, section_name, section_occurrence, name, occurrence, start_line, end_line}]
//   (section_division / section_name / section_occurrence are null for paragraphs outside a named section)
MATCH (:System {system_id: $system_id})-[:HAS_FILE]->(f:SourceFile {file_id: $file_id})
MERGE (q:ParserSequence {file_id: $file_id})
  ON CREATE SET q.system_id = $system_id, q.sec_seq = 0, q.par_seq = 0, q.stmt_seq = 0,
                q.created_at = datetime()
SET q.lock_touched_at = datetime()  // exclusive lock first, so the ownership check sees committed state
MERGE (f)-[:HAS_PARSER_STATE]->(q)
WITH f, q
WHERE q.active_run_id IS NULL
   OR (q.active_run_id = $run_id AND q.active_worker_id = $worker_id)
   OR q.active_run_id = $takeover_run_id
SET q.taken_over_run_id = CASE WHEN q.active_run_id IS NOT NULL AND q.active_run_id <> $run_id
                               THEN q.active_run_id ELSE q.taken_over_run_id END,
    q.active_run_id = $run_id, q.active_worker_id = $worker_id, q.run_started_at = datetime()
WITH f, q
CALL {
  WITH f, q
  UNWIND $sections AS s
  WITH f, q, s, $file_id + '|' + s.division + '|' + s.name +
       CASE WHEN coalesce(s.occurrence, 1) > 1 THEN '#' + toString(s.occurrence) ELSE '' END AS key
  OPTIONAL MATCH (existing:CobolSection {identity_key: key})
  FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
    SET q.sec_seq = q.sec_seq + 1
    CREATE (n:CobolSection {
      section_id: $file_id + '-SEC-' +
        CASE WHEN q.sec_seq < 10000 THEN right('000' + toString(q.sec_seq), 4) ELSE toString(q.sec_seq) END,
      section_number: q.sec_seq, identity_key: key, system_id: $system_id, file_id: $file_id,
      division: s.division, name: s.name, occurrence: coalesce(s.occurrence, 1),
      registered_at: datetime()})
    CREATE (f)-[:HAS_SECTION]->(n)
  )
  WITH s, key
  MATCH (n:CobolSection {identity_key: key})
  SET n.start_line = s.start_line, n.end_line = s.end_line, n.status = 'ACTIVE',
      n.last_run_id = $run_id, n.last_seen_at = datetime(),
      n.review_status = CASE WHEN coalesce(s.occurrence, 1) > 1 THEN 'REVIEW_REQUIRED'
                             ELSE coalesce(n.review_status, 'NONE') END
}
CALL {
  WITH f, q
  UNWIND $paragraphs AS p
  OPTIONAL MATCH (sec:CobolSection {identity_key: $file_id + '|' + coalesce(p.section_division, '') + '|' +
       coalesce(p.section_name, '') +
       CASE WHEN coalesce(p.section_occurrence, 1) > 1 THEN '#' + toString(p.section_occurrence) ELSE '' END})
  WITH f, q, p, sec
  WHERE p.section_name IS NULL OR sec IS NOT NULL
  WITH f, q, p, sec, $file_id + '|' + coalesce(sec.section_id, 'PROGRAM') + '|' + p.name +
       CASE WHEN coalesce(p.occurrence, 1) > 1 THEN '#' + toString(p.occurrence) ELSE '' END AS key
  OPTIONAL MATCH (existing:CobolParagraph {identity_key: key})
  FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
    SET q.par_seq = q.par_seq + 1
    CREATE (n:CobolParagraph {
      paragraph_id: $file_id + '-PAR-' +
        CASE WHEN q.par_seq < 10000 THEN right('000' + toString(q.par_seq), 4) ELSE toString(q.par_seq) END,
      paragraph_number: q.par_seq, identity_key: key, system_id: $system_id, file_id: $file_id,
      name: p.name, occurrence: coalesce(p.occurrence, 1),
      scope: coalesce(sec.section_id, 'PROGRAM'), section_id: sec.section_id,
      registered_at: datetime()})
    FOREACH (x IN CASE WHEN sec IS NULL THEN [f] ELSE [] END | CREATE (x)-[:HAS_PARAGRAPH]->(n))
    FOREACH (x IN CASE WHEN sec IS NULL THEN [] ELSE [sec] END | CREATE (x)-[:HAS_PARAGRAPH]->(n))
  )
  WITH p, key
  MATCH (n:CobolParagraph {identity_key: key})
  SET n.start_line = p.start_line, n.end_line = p.end_line, n.status = 'ACTIVE',
      n.last_run_id = $run_id, n.last_seen_at = datetime(),
      n.review_status = CASE WHEN coalesce(p.occurrence, 1) > 1 THEN 'REVIEW_REQUIRED'
                             ELSE coalesce(n.review_status, 'NONE') END
}
```

Then, once that call has returned, read the structure identities:

```cypher
// REVFORGE-QUERY: fetch-structure-identities (read)
// params: file_id, run_id
MATCH (q:ParserSequence {file_id: $file_id})
OPTIONAL MATCH (c:CobolSection {file_id: $file_id, last_run_id: $run_id})
WITH q, collect(c {.section_id, .identity_key, .division, .name, .occurrence, .review_status}) AS sections
OPTIONAL MATCH (p:CobolParagraph {file_id: $file_id, last_run_id: $run_id})
RETURN q.active_run_id AS active_run_id, q.active_worker_id AS active_worker_id,
       toString(q.run_started_at) AS run_started_at, sections,
       collect(p {.paragraph_id, .identity_key, .section_id, .name, .occurrence, .review_status}) AS paragraphs
```

**Parse lock.** Each file can be parsed by only one run at a time:
- `begin-parse-run` takes the file's lock only if no other run holds it, the
  same `run_id` + `worker_id` is resuming, or `takeover_run_id` names the
  current holder.
- Every later write checks `run_id` **and** `worker_id`, so a run without the
  lock changes nothing.

`active_run_id` and `active_worker_id` from `fetch-structure-identities` must
equal yours. If they do not, the file is locked by another run:
- Stop for this file, and log an `error` `parse_run_locked` with the holder's
  `active_run_id` and `run_started_at`.
- Do not retry, and never take over on your own.
- Pass `takeover_run_id` only when the agent input `PARSE_TAKEOVER_RUN_ID`
  names that exact holder. That means a person has confirmed the holder run is
  dead (for example, after a crash).

Every submitted section and paragraph must appear exactly once.

### Step 4 — register statements

Send the statements in batches. A batch holds **whole paragraphs** (never
split a paragraph) and at most about 200 statements. `max_depth` is the
largest `depth` in the batch. Each statement's `paragraph_id` comes from Step 3.

```cypher
// REVFORGE-QUERY: register-statements (write)
// params: system_id, file_id, run_id, worker_id, max_depth,
//   statements: [{local_id, paragraph_id, parent_local_id, branch, sibling_index, depth,
//                 statement_type, text, start_line, end_line, extraction_status}]
MATCH (q:ParserSequence {file_id: $file_id})
WHERE q.active_run_id = $run_id AND q.active_worker_id = $worker_id
SET q.locked_at = datetime()  // exclusive lock on this file's counters
WITH q
UNWIND range(0, $max_depth) AS depth
CALL {
  WITH q, depth
  UNWIND [s IN $statements WHERE s.depth = depth] AS s
  OPTIONAL MATCH (parent:CobolStatement {file_id: $file_id, last_run_id: $run_id, last_local_id: s.parent_local_id})
  OPTIONAL MATCH (para:CobolParagraph {paragraph_id: s.paragraph_id, file_id: $file_id, last_run_id: $run_id})
  WITH q, s, parent, para,
       reduce(acc = '', w IN [x IN split(replace(replace(replace(trim(s.text), '\r', ' '), '\n', ' '), '\t', ' '), ' ')
              WHERE x <> ''] | acc + CASE WHEN acc = '' THEN '' ELSE ' ' END + w) AS ws
  WHERE para IS NOT NULL AND (s.parent_local_id IS NULL OR parent IS NOT NULL)
  WITH q, s, para, parent.statement_id AS parent_statement_id,
       CASE WHEN ws ENDS WITH '.' THEN trim(left(ws, size(ws) - 1)) ELSE ws END AS norm
  WITH q, s, para, parent_statement_id, norm,
       s.paragraph_id + '|' + coalesce(parent_statement_id, '') + '|' + coalesce(s.branch, '') AS scope_key
  ORDER BY scope_key, s.sibling_index
  WITH q, para, parent_statement_id, scope_key, collect({s: s, norm: norm}) AS raw
  WITH q, para, parent_statement_id, scope_key,
       [i IN range(0, size(raw) - 1) | {
          local_id: raw[i].s.local_id, idx: raw[i].s.sibling_index, norm: raw[i].norm,
          type: raw[i].s.statement_type, s: raw[i].s,
          prev: CASE WHEN i = 0 THEN '<START>' ELSE raw[i - 1].norm END,
          next: CASE WHEN i = size(raw) - 1 THEN '<END>' ELSE raw[i + 1].norm END}] AS news
  // Idempotency: statements already registered in this run (an earlier committed batch) are skipped
  OPTIONAL MATCH (done:CobolStatement {file_id: $file_id, last_run_id: $run_id})
  WHERE done.last_local_id IN [n IN news | n.local_id]
  WITH q, para, parent_statement_id, scope_key, news,
       [x IN collect(done.last_local_id) WHERE x IS NOT NULL] AS done_ids
  WITH q, para, parent_statement_id, scope_key, news,
       [n IN news WHERE NOT n.local_id IN done_ids] AS todo
  OPTIONAL MATCH (o:CobolStatement {file_id: $file_id, scope_key: scope_key, status: 'ACTIVE'})
  WHERE coalesce(o.last_run_id, '') <> $run_id
  WITH q, para, parent_statement_id, scope_key, news, todo,
       [x IN collect({id: o.statement_id, norm: o.normalized_text, prev: o.prev_text, next: o.next_text,
                      idx: o.sibling_index, type: o.statement_type}) WHERE x.id IS NOT NULL] AS olds
  // Step A: same text and same neighbours, unique on both sides
  WITH q, para, parent_statement_id, scope_key, news, todo, olds,
       [n IN todo WHERE size([o IN olds WHERE o.norm = n.norm AND o.prev = n.prev AND o.next = n.next]) = 1
                    AND size([m IN todo WHERE m.norm = n.norm AND m.prev = n.prev AND m.next = n.next]) = 1
        | {local_id: n.local_id, how: 'UNCHANGED',
           id: [o IN olds WHERE o.norm = n.norm AND o.prev = n.prev AND o.next = n.next][0].id}] AS pa
  WITH q, para, parent_statement_id, scope_key, news, olds, pa,
       [n IN todo WHERE NOT n.local_id IN [p IN pa | p.local_id]] AS nb,
       [o IN olds WHERE NOT o.id IN [p IN pa | p.id]] AS ob
  // Step B: same text, unique on both sides
  WITH q, para, parent_statement_id, scope_key, news, olds, pa, nb, ob,
       [n IN nb WHERE size([o IN ob WHERE o.norm = n.norm]) = 1 AND size([m IN nb WHERE m.norm = n.norm]) = 1
        | {local_id: n.local_id, how: 'MATCHED_BY_TEXT', id: [o IN ob WHERE o.norm = n.norm][0].id}] AS pb
  WITH q, para, parent_statement_id, scope_key, news, olds, pa + pb AS pab,
       [n IN nb WHERE NOT n.local_id IN [p IN pb | p.local_id]] AS nc,
       [o IN ob WHERE NOT o.id IN [p IN pb | p.id]] AS oc
  // Step C: identical duplicates with equal counts, paired in source order
  WITH q, para, parent_statement_id, scope_key, news, olds, pab, nc, oc,
       [n IN nc WHERE size([m IN nc WHERE m.norm = n.norm]) > 1
                  AND size([m IN nc WHERE m.norm = n.norm]) = size([o IN oc WHERE o.norm = n.norm])
        | {local_id: n.local_id, how: 'MATCHED_BY_ORDER',
           id: [o IN oc WHERE o.norm = n.norm
                AND size([o2 IN oc WHERE o2.norm = n.norm AND o2.idx < o.idx]) =
                    size([m IN nc WHERE m.norm = n.norm AND m.idx < n.idx])][0].id}] AS pc
  WITH q, para, parent_statement_id, scope_key, news, olds, pab + pc AS pabc,
       [n IN nc WHERE NOT n.local_id IN [p IN pc | p.local_id]] AS nd,
       [o IN oc WHERE NOT o.id IN [p IN pc | p.id]] AS od
  // Step D: one modified statement between two matched neighbours
  WITH q, para, parent_statement_id, scope_key, news, olds, pabc, nd, od,
       [n IN nd | {n: n,
          has_prev: size([m IN news WHERE m.idx < n.idx]) > 0,
          has_next: size([m IN news WHERE m.idx > n.idx]) > 0,
          pm: head([p IN pabc WHERE p.local_id = last([m IN news WHERE m.idx < n.idx]).local_id]),
          nm: head([p IN pabc WHERE p.local_id = head([m IN news WHERE m.idx > n.idx]).local_id])}] AS nd1
  WITH q, para, parent_statement_id, scope_key, news, pabc, nd, od,
       [x IN nd1 | x {.*,
          lo: CASE WHEN NOT x.has_prev THEN -1
                   WHEN x.pm IS NULL THEN null ELSE head([o IN olds WHERE o.id = x.pm.id]).idx END,
          hi: CASE WHEN NOT x.has_next THEN 2147483647
                   WHEN x.nm IS NULL THEN null ELSE head([o IN olds WHERE o.id = x.nm.id]).idx END}] AS nd2
  WITH q, para, parent_statement_id, scope_key, news, pabc, nd, od,
       [x IN nd2 WHERE x.lo IS NOT NULL AND x.hi IS NOT NULL
                   AND size([o IN od WHERE o.idx > x.lo AND o.idx < x.hi]) = 1
                   AND [o IN od WHERE o.idx > x.lo AND o.idx < x.hi][0].type = x.n.type
        | {local_id: x.n.local_id, how: 'MODIFIED',
           id: [o IN od WHERE o.idx > x.lo AND o.idx < x.hi][0].id}] AS pd
  WITH q, para, parent_statement_id, scope_key, news, pabc + pd AS matched,
       [n IN nd WHERE NOT n.local_id IN [p IN pd | p.local_id]] AS ne,
       [o IN od WHERE NOT o.id IN [p IN pd | p.id]] AS oe
  // Step E: unresolved identical text -> new ID flagged for review; otherwise new
  WITH q, para, parent_statement_id, scope_key, news, matched,
       [n IN ne | {local_id: n.local_id, candidates: [o IN oe WHERE o.norm = n.norm | o.id],
                   how: CASE WHEN size([o IN oe WHERE o.norm = n.norm]) > 0 THEN 'NEW_REVIEW_REQUIRED' ELSE 'NEW' END}] AS created
  CALL {
    WITH news, matched
    UNWIND matched AS m
    MATCH (o:CobolStatement {statement_id: m.id})
    WITH o, m, head([n IN news WHERE n.local_id = m.local_id]) AS n
    SET o.last_run_id = $run_id, o.last_local_id = n.local_id, o.sibling_index = n.idx,
        o.prev_text = n.prev, o.next_text = n.next, o.source_text = n.s.text, o.normalized_text = n.norm,
        o.statement_type = n.type, o.start_line = n.s.start_line, o.end_line = n.s.end_line,
        o.extraction_status = coalesce(n.s.extraction_status, 'OK'), o.last_match = m.how,
        o.status = 'ACTIVE', o.last_seen_at = datetime()
  }
  CALL {
    WITH q, para, parent_statement_id, scope_key, news, created
    UNWIND created AS m
    WITH q, para, parent_statement_id, scope_key, m, head([n IN news WHERE n.local_id = m.local_id]) AS n
    OPTIONAL MATCH (ps:CobolStatement {statement_id: parent_statement_id})
    FOREACH (_ IN [1] |
      SET q.stmt_seq = q.stmt_seq + 1
      CREATE (st:CobolStatement {
        statement_id: $file_id + '-STMT-' +
          CASE WHEN q.stmt_seq < 1000000 THEN right('00000' + toString(q.stmt_seq), 6) ELSE toString(q.stmt_seq) END,
        statement_number: q.stmt_seq, system_id: $system_id, file_id: $file_id,
        paragraph_id: n.s.paragraph_id, parent_statement_id: parent_statement_id, branch: n.s.branch,
        scope_key: scope_key, depth: n.s.depth, sibling_index: n.idx,
        statement_type: n.type, source_text: n.s.text, normalized_text: n.norm,
        prev_text: n.prev, next_text: n.next, start_line: n.s.start_line, end_line: n.s.end_line,
        extraction_status: coalesce(n.s.extraction_status, 'OK'), status: 'ACTIVE',
        review_status: CASE WHEN size(m.candidates) > 0 THEN 'REVIEW_REQUIRED' ELSE 'NONE' END,
        last_match: m.how, last_run_id: $run_id, last_local_id: n.local_id,
        registered_at: datetime(), last_seen_at: datetime()})
      FOREACH (x IN CASE WHEN ps IS NULL THEN [para] ELSE [] END |
        CREATE (x)-[:CONTAINS_STATEMENT]->(st))
      FOREACH (x IN CASE WHEN ps IS NULL THEN [] ELSE [ps] END |
        CREATE (x)-[:CONTAINS_STATEMENT {branch: n.s.branch}]->(st))
      FOREACH (cid IN m.candidates |
        MERGE (c:CobolStatement {statement_id: cid})
        SET c.review_status = 'REVIEW_REQUIRED'
        CREATE (st)-[:REVIEW_CANDIDATE]->(c))
    )
  }
}
```

Retry rules:
- **A failed call** (error) is rolled back completely. Resend the **same**
  batch once.
- **A call that succeeded but left statements unregistered** (they are
  missing from `fetch-statement-identities`, e.g. a wrong `paragraph_id` or
  `parent_local_id`): fix the parameters and resend the **whole** batch. Never
  send just the missing statements, because their neighbours provide the
  matching context. Statements already registered in this run are recognised
  by `local_id` and skipped, so a resent batch never duplicates them.
- If it fails again, stop for this file.
- Send `null` as JSON `null`, never as the string `"null"`.

Then, once every batch has returned, read the statement identities:

```cypher
// REVFORGE-QUERY: fetch-statement-identities (read)
// params: file_id, run_id
MATCH (s:CobolStatement {file_id: $file_id, last_run_id: $run_id})
RETURN s.last_local_id AS local_id, s.statement_id AS statement_id,
       s.parent_statement_id AS parent_statement_id, s.last_match AS match,
       s.review_status AS review_status,
       [(s)-[:REVIEW_CANDIDATE]->(c) | c.statement_id] AS review_candidates
ORDER BY toInteger(substring(s.last_local_id, 1))
```

Every submitted `local_id` must come back exactly once. Copy `statement_id`,
`match`, `review_status` and `review_candidates` into the statement. Then
continue with the section-mapper skill, which completes the parse run.

---

## Output schema — single program AST

```json
{
  "program_summary": {"program_id": "CBACT01C", "source_file": "app/cbl/CBACT01C.CBL", "ast_file": "raw_structure/SYS-CARDDEMO-001-FIL-0001__CBACT01C.json", "total_lines": 892, "paragraph_count": 24, "section_count": 5, "has_unstructured_flow": true, "has_alter": false, "dead_code_candidates": 0, "parse_status": "success", "system_id": "SYS-CARDDEMO-001", "file_id": "SYS-CARDDEMO-001-FIL-0001", "path_id": "SYS-CARDDEMO-001-PATH-0001", "file_name": "CBACT01C.CBL", "statement_count": 412, "perform_edges": 30, "goto_edges": 2, "control_flow_relationships": 34, "review_required_statements": 0, "uncertain_statements": 0, "parse_run_id": "PRUN-20261021T101500Z-12345"},
  "program_id": "CBACT01C",
  "source_file": "app/cbl/CBACT01C.CBL",
  "total_lines": 892,
  "system_id": "SYS-CARDDEMO-001",
  "file_id": "SYS-CARDDEMO-001-FIL-0001",
  "path_id": "SYS-CARDDEMO-001-PATH-0001",
  "file_name": "CBACT01C.CBL",
  "relative_path": "app/cbl/CBACT01C.CBL",
  "parse_run_id": "PRUN-20261021T101500Z-12345",
  "source_format": "fixed",
  "identification_division": {
    "start_line": 1,
    "end_line": 18,
    "program_id": "CBACT01C",
    "author": "AWS",
    "date_written": "2022-06-10"
  },
  "environment_division": {
    "start_line": 19,
    "end_line": 45,
    "sections": [
      { "section_id": "SYS-CARDDEMO-001-FIL-0001-SEC-0001", "name": "INPUT-OUTPUT", "start_line": 21, "end_line": 45 }
    ],
    "file_control_entries": [
      { "select_name": "ACCT-FILE", "assign_to": "ACCTFILE", "line": 28 }
    ]
  },
  "data_division": {
    "start_line": 46,
    "end_line": 420,
    "file_section": {
      "section_id": "SYS-CARDDEMO-001-FIL-0001-SEC-0002",
      "start_line": 48,
      "entries": [
        {
          "type": "FD",
          "file_name": "ACCT-FILE",
          "line": 50,
          "end_line": 78,
          "record_contains": "300 CHARACTERS",
          "recording_mode": "F"
        }
      ]
    },
    "working_storage_section": {
      "section_id": "SYS-CARDDEMO-001-FIL-0001-SEC-0003",
      "start_line": 80,
      "entries": [
        {
          "level": 1,
          "name": "WS-RETURN-CODE",
          "pic": "S9(04) COMP",
          "value": "ZEROS",
          "line": 85,
          "redefines": null,
          "occurs": null,
          "children": []
        },
        {
          "level": 1,
          "name": "WS-ACCT-REC",
          "pic": null,
          "line": 90,
          "children": [
            {
              "level": 5,
              "name": "WS-ACCT-ID",
              "pic": "X(11)",
              "line": 92
            }
          ]
        },
        {
          "type": "copy_stub",
          "copybook": "CVACT01Y",
          "library": null,
          "line": 145,
          "section": "WORKING-STORAGE",
          "parent_level": "01"
        }
      ]
    },
    "linkage_section": {
      "section_id": null,
      "start_line": null,
      "entries": []
    }
  },
  "procedure_division": {
    "start_line": 421,
    "end_line": 892,
    "using_parameters": [],
    "sections": [
      {
        "section_id": "SYS-CARDDEMO-001-FIL-0001-SEC-0004",
        "name": "0000-MAIN",
        "start_line": 425,
        "end_line": 530
      }
    ],
    "paragraphs": [
      {
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0001",
        "name": "0000-MAIN",
        "section": "0000-MAIN",
        "section_id": "SYS-CARDDEMO-001-FIL-0001-SEC-0004",
        "start_line": 425,
        "end_line": 480,
        "has_perform": true,
        "has_goto": false,
        "has_call": false,
        "has_stop_run": false,
        "review_status": "NONE",
        "statement_ids": ["SYS-CARDDEMO-001-FIL-0001-STMT-000001", "SYS-CARDDEMO-001-FIL-0001-STMT-000002"]
      }
    ],
    "statements": [
      {
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000001",
        "local_id": "L1",
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0001",
        "paragraph": "0000-MAIN",
        "parent_statement_id": null,
        "branch": null,
        "depth": 0,
        "sibling_index": 1,
        "statement_type": "IF",
        "source_text": "IF WS-RETURN-CODE NOT = ZEROS",
        "start_line": 426,
        "end_line": 429,
        "extraction_status": "OK",
        "match": "UNCHANGED",
        "review_status": "NONE",
        "review_candidates": []
      },
      {
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000003",
        "local_id": "L2",
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0001",
        "paragraph": "0000-MAIN",
        "parent_statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000001",
        "branch": "THEN",
        "depth": 1,
        "sibling_index": 1,
        "statement_type": "PERFORM",
        "source_text": "PERFORM 9999-ABEND",
        "start_line": 427,
        "end_line": 427,
        "extraction_status": "OK",
        "match": "UNCHANGED",
        "review_status": "NONE",
        "review_candidates": []
      }
    ],
    "terminal_statements": [
      { "type": "STOP RUN", "line": 888, "paragraph": "9999-EXIT",
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0009",
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000140" }
    ]
  },
  "copy_stubs": [
    {
      "copybook": "CVACT01Y",
      "division": "DATA",
      "section": "WORKING-STORAGE",
      "line": 145
    }
  ],
  "parse_issues": []
}
```

REVFORGE field notes:
- `program_summary` is the first key, written on one line. It is the
  program's entry in `parser_artifact.json` `programs[]` (see the
  section-mapper skill, "Parser artifact manifest"). The section-mapper skill
  adds `control_flow_graph`, and its edge counts complete the summary.
- `program_id`, `system_id`, `file_id`, `path_id`, `file_name` and
  `relative_path` are copied from the Agent 1 inventory. `source_file` keeps
  its original meaning: the repository-relative path.
- Every section object carries `section_id`. A section that is not present
  has `section_id: null`.
- `paragraphs[].statement_ids` lists the paragraph's top-level statements in
  order. `statements` is the flat list of all statements in `local_id` order.
  Nesting is given by `parent_statement_id` and `branch`.

---

## Error handling

| Condition | Action |
|---|---|
| File not found | Log `error` in `parse_issues`, return partial result |
| DIVISION boundary not detected | Log `warning`, continue with what was found |
| Ambiguous paragraph name (matches reserved word) | Skip and log `info` |
| PIC clause spans continuation line | Concatenate both lines before extracting |
| Level number out of sequence (e.g. 01 → 05 → 02) | Log `warning`, record as-is |
| Line exceeds column 72 (free-format indicator) | Log `info`, switch to free-format mode for that file |
| File is empty or has no PROCEDURE DIVISION | Log `warning` `empty_or_incomplete_source`; register only the sections found; no statements |
| Statement boundary or type cannot be decided | Record it with `extraction_status: "UNCERTAIN"`, log `warning` `uncertain_statement` |
| Duplicate section or paragraph declaration | Register as a separate occurrence with `REVIEW_REQUIRED`, log `warning` `duplicate_declaration` |
| Agent 1 identity missing or different | Do not parse the file, log `error` `inventory_identity_mismatch` |
| Neo4j unavailable, constraints missing, or an item has no ID after registration | Stop for this file, log `error` `registry_failure`; write no `raw_structure` file for it |
| File locked by another run (`active_run_id`/`active_worker_id` differ) | Stop for this file, log `error` `parse_run_locked` with the holder; take over only via `PARSE_TAKEOVER_RUN_ID` |
