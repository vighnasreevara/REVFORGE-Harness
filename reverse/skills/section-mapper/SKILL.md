---
name: section-mapper
description: >
  Takes the AST JSON produced by the cobol-ast-parser skill for a single
  program and enriches it with a control flow graph. Scans the PROCEDURE
  DIVISION of each paragraph for PERFORM, PERFORM UNTIL, PERFORM VARYING,
  PERFORM THRU, GO TO, and ALTER statements. Resolves each to the target
  paragraph or section name. Builds a directed control flow graph where
  nodes are paragraphs and edges are typed control transfers. Flags
  unstructured constructs (GO TO, ALTER, PERFORM THRU) for the Logic Agent.
  Called once per program by the Parser Agent, after cobol-ast-parser.
  REVFORGE: edges reference permanent Paragraph, Section and Statement IDs and
  are registered in Neo4j; this skill also completes and verifies the parse run.
---

## Purpose

Read the paragraph boundaries from the AST produced by cobol-ast-parser.
For each paragraph, scan its source lines and detect all control transfer
statements: PERFORM variants, GO TO, and ALTER. Build a typed, directed
control flow graph (CFG) at the paragraph level.

Do NOT interpret what the control flow means for business logic. Record
structure only — who calls whom, what type of call, and any flags that
the Logic Agent needs to investigate.

REVFORGE enhancement: every edge also carries the Statement ID of the
statement that makes the transfer, and the Paragraph or Section IDs at both
ends. The edges are registered in Neo4j as `PERFORMS` and
`TRANSFERS_CONTROL_TO` relationships. The skill then completes the parse run:
it marks items not seen in this run as inactive, and verifies registry
integrity.

---

## Control transfer statement types

| Statement | Edge type | Notes |
|---|---|---|
| `PERFORM para-name` | `PERFORM_SIMPLE` | Single paragraph call, returns |
| `PERFORM para-name THRU para-name-2` | `PERFORM_THRU` | Range of paragraphs — flag as complex |
| `PERFORM para-name UNTIL condition` | `PERFORM_UNTIL` | Loop — record condition text verbatim |
| `PERFORM para-name VARYING ... UNTIL` | `PERFORM_VARYING` | Indexed loop — record index and bounds |
| `PERFORM para-name TIMES` | `PERFORM_TIMES` | Fixed-count loop |
| `PERFORM section-name` | `PERFORM_SECTION` | Entire section call |
| `GO TO para-name` | `GOTO` | Unconditional jump — flag as unstructured |
| `GO TO para-1 para-2 ... DEPENDING ON var` | `GOTO_DEPENDING` | Computed jump — flag, record variable name |
| `ALTER para-name TO PROCEED TO para-name-2` | `ALTER` | Modifies a GO TO target — flag as critical |
| `NEXT SENTENCE` | `NEXT_SENTENCE` | Falls to next sentence — record position |
| `EXIT` | `EXIT` | Paragraph exit — no transfer |

REVFORGE: `PERFORM para-name THRU para-name-2 UNTIL/VARYING/TIMES` keeps edge
type `PERFORM_THRU` and records the loop clause in `condition_text`.

---

## Grep patterns per paragraph

For each paragraph, extract its source lines (start_line to end_line from AST).
Then apply these patterns within those lines only:

```bash
# Extract just the paragraph's lines from the file
sed -n "${START},${END}p" "$FILE" > /tmp/para_lines.txt

# PERFORM simple
grep -niE "PERFORM\s+([A-Z0-9\-]+)(\s+THRU\s+([A-Z0-9\-]+))?" /tmp/para_lines.txt

# PERFORM UNTIL
grep -niE "PERFORM\s+([A-Z0-9\-]+)\s+UNTIL\s+(.*)" /tmp/para_lines.txt

# PERFORM VARYING
grep -niE "PERFORM\s+([A-Z0-9\-]+)\s+VARYING\s+(.*)" /tmp/para_lines.txt

# PERFORM TIMES
grep -niE "PERFORM\s+([A-Z0-9\-]+)\s+([0-9]+|[A-Z0-9\-]+)\s+TIMES" /tmp/para_lines.txt

# Inline PERFORM (no target — body follows)
grep -niE "PERFORM\s+(UNTIL|VARYING|WITH\s+TEST)" /tmp/para_lines.txt

# GO TO simple
grep -niE "GO\s+TO\s+([A-Z0-9\-]+)" /tmp/para_lines.txt

# GO TO DEPENDING ON
grep -niE "GO\s+TO\s+(([A-Z0-9\-]+\s+)+)DEPENDING\s+ON\s+([A-Z0-9\-]+)" /tmp/para_lines.txt

# ALTER
grep -niE "ALTER\s+([A-Z0-9\-]+)\s+TO\s+(PROCEED\s+TO\s+)?([A-Z0-9\-]+)" /tmp/para_lines.txt
```

REVFORGE: the authoritative source for edges is the statement list from
cobol-ast-parser Phase 5. Every `PERFORM`, `GO TO` and `ALTER` statement there
produces its edge(s), and `source_line` is the statement's `start_line`. Use
the grep patterns above (with the Grep tool, or by reading the lines, never
writing temporary files) as a **cross-check of statement existence only**. A
grep hit that has no matching statement, or a transfer statement that the
greps miss, is logged as a `warning` in `cfg_issues`
(`cfg_statement_mismatch`) and never silently dropped. Ignore hits in comment
lines.

The edge **type** comes from the statement's full text, which spans
continuation lines. For example, `PERFORM A` on one line followed by
`THRU A-EXIT` on the next is `PERFORM_THRU`, even though the single-line grep
sees only `PERFORM A`.

---

## PERFORM THRU handling

`PERFORM A-PARA THRU B-PARA` means all paragraphs between A-PARA and B-PARA
(in source order) are executed sequentially.

When detected:
1. Record a `PERFORM_THRU` edge from source paragraph to A-PARA
2. Look up the paragraph list from the AST to find all paragraphs between
   A-PARA and B-PARA (inclusive) in source order
3. Record an `implicit_thru_range` array listing all paragraphs in the range
4. Flag the edge with `"unstructured": true`
5. Log a `warning` issue — PERFORM THRU obscures control flow

REVFORGE: also record `thru_end` (B-PARA), `thru_end_paragraph_id` and
`implicit_thru_range_ids` (the Paragraph IDs of the range, same order).

---

## Inline PERFORM handling

`PERFORM UNTIL ... END-PERFORM` (no target paragraph) is an inline loop.
The body is contained within the same paragraph.

When detected:
1. Create a self-referencing node: edge from paragraph back to itself
2. Edge type: `PERFORM_INLINE`
3. Record `"inline": true` and the condition text verbatim
4. Record start line and `END-PERFORM` line as the loop boundary

```bash
# Find END-PERFORM to close inline loop
grep -niE "END-PERFORM" /tmp/para_lines.txt
```

REVFORGE: the loop body statements are the inline PERFORM statement's `BODY`
children. The `PERFORM_INLINE` edge stays in the JSON CFG only. It is not
registered in Neo4j, because the nesting is already stored as
`CONTAINS_STATEMENT`.

---

## Target resolution

For each detected PERFORM or GO TO target:
1. Look up the target name in the AST's `procedure_division.paragraphs` list
2. If found → `"resolved": true`
3. If not found in paragraphs → look in `procedure_division.sections`
4. If still not found → `"resolved": false`, log `warning`
   (may be in a COPYed section or external program)

REVFORGE: on resolution, copy the target's `paragraph_id` (or `section_id`
for a section) into `to_paragraph_id` / `to_section_id`. If a name matches
more than one paragraph (duplicate declarations or the same name in several
sections), the target is ambiguous: set `"resolved": false` and
`"ambiguous_target": true`, log a `warning`, and register no relationship for
it.

---

## Unstructured construct flags

Flag the following with `"unstructured": true` on the edge AND add an
entry to the program's `unstructured_constructs` list:

- Any `GO TO` edge
- Any `GO TO ... DEPENDING ON` edge
- Any `PERFORM THRU` edge
- Any `ALTER` statement (flag as `"severity": "critical"` — ALTER is the
  most dangerous COBOL construct; it changes GO TO targets at runtime)

These flags are consumed by the Logic Agent and the Synthesis Agent
(BRD gap section).

REVFORGE: each `unstructured_constructs` entry also carries `statement_id` and
`paragraph_id`.

---

## Control flow graph construction rules

```
1. Start with the paragraph list from the AST as nodes
2. For each paragraph:
   a. Scan its line range using the grep patterns above
   b. For each match create an edge (see schema below)
   c. Resolve the target to a known paragraph or section
   d. Apply unstructured flags where needed
3. Identify entry points:
   - The first paragraph in PROCEDURE DIVISION is the implicit entry point
   - Any paragraph named in a JCL EXEC step is also an entry point
   - Any paragraph targeted by CICS LINK or XCTL is also an entry point
4. Identify terminal nodes:
   - Paragraphs containing STOP RUN, GOBACK, or EXIT PROGRAM
5. Identify dead paragraphs:
   - Paragraphs with no incoming edges and not an entry point → flag as dead code
```

REVFORGE notes for rule 5: an incoming edge includes membership of an
`implicit_thru_range`, so the paragraphs inside a `PERFORM … THRU …` range are
not dead-code candidates.

---

## Output schema — control flow graph (added to program AST)

This skill adds a `control_flow_graph` section to the program AST JSON
produced by cobol-ast-parser:

```json
{
  "control_flow_graph": {
    "entry_points": ["0000-MAIN"],
    "entry_point_ids": ["SYS-CARDDEMO-001-FIL-0001-PAR-0001"],
    "terminal_nodes": ["9999-EXIT"],
    "nodes": [
      {
        "id": "0000-MAIN",
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0001",
        "type": "paragraph",
        "section": "0000-MAIN",
        "section_id": "SYS-CARDDEMO-001-FIL-0001-SEC-0004",
        "start_line": 425,
        "end_line": 480,
        "is_entry_point": true,
        "is_terminal": false,
        "is_dead_code": false,
        "unstructured_constructs": []
      },
      {
        "id": "0100-OPEN-FILES",
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0002",
        "type": "paragraph",
        "section": "0000-MAIN",
        "section_id": "SYS-CARDDEMO-001-FIL-0001-SEC-0004",
        "start_line": 482,
        "end_line": 510,
        "is_entry_point": false,
        "is_terminal": false,
        "is_dead_code": false,
        "unstructured_constructs": []
      },
      {
        "id": "9999-EXIT",
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0009",
        "type": "paragraph",
        "section": null,
        "section_id": null,
        "start_line": 885,
        "end_line": 892,
        "is_entry_point": false,
        "is_terminal": true,
        "is_dead_code": false,
        "unstructured_constructs": []
      }
    ],
    "edges": [
      {
        "from": "0000-MAIN",
        "to": "0100-OPEN-FILES",
        "type": "PERFORM_SIMPLE",
        "resolved": true,
        "unstructured": false,
        "source_line": 431,
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000004",
        "from_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0001",
        "to_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0002",
        "to_section_id": null
      },
      {
        "from": "0000-MAIN",
        "to": "0200-PROCESS-RECORDS",
        "type": "PERFORM_UNTIL",
        "resolved": true,
        "unstructured": false,
        "condition_text": "WS-EOF-FLAG = 'Y'",
        "source_line": 445,
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000005",
        "from_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0001",
        "to_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0003",
        "to_section_id": null
      },
      {
        "from": "0300-VALIDATE",
        "to": "0350-ERROR-HANDLER",
        "type": "GOTO",
        "resolved": true,
        "unstructured": true,
        "source_line": 612,
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000031",
        "from_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0004",
        "to_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0005",
        "to_section_id": null
      },
      {
        "from": "0400-CALC-LOOP",
        "to": "0400-CALC-LOOP",
        "type": "PERFORM_INLINE",
        "resolved": true,
        "unstructured": false,
        "inline": true,
        "condition_text": "WS-IDX > WS-MAX-ITEMS",
        "loop_start_line": 700,
        "loop_end_line": 748,
        "source_line": 700,
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000040",
        "from_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0006",
        "to_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0006",
        "to_section_id": null
      },
      {
        "from": "0500-ROUTE",
        "to": null,
        "type": "GOTO_DEPENDING",
        "resolved": false,
        "unstructured": true,
        "depending_variable": "WS-TRANS-TYPE",
        "possible_targets": ["1000-CREDIT", "1100-DEBIT", "1200-TRANSFER"],
        "possible_target_ids": ["SYS-CARDDEMO-001-FIL-0001-PAR-0010", "SYS-CARDDEMO-001-FIL-0001-PAR-0011", "SYS-CARDDEMO-001-FIL-0001-PAR-0012"],
        "source_line": 820,
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000052",
        "from_paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0007",
        "to_paragraph_id": null,
        "to_section_id": null
      }
    ],
    "unstructured_constructs": [
      {
        "type": "GOTO",
        "paragraph": "0300-VALIDATE",
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0004",
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000031",
        "target": "0350-ERROR-HANDLER",
        "line": 612,
        "severity": "warning"
      },
      {
        "type": "GOTO_DEPENDING",
        "paragraph": "0500-ROUTE",
        "paragraph_id": "SYS-CARDDEMO-001-FIL-0001-PAR-0007",
        "statement_id": "SYS-CARDDEMO-001-FIL-0001-STMT-000052",
        "depending_variable": "WS-TRANS-TYPE",
        "line": 820,
        "severity": "warning"
      }
    ],
    "dead_code_candidates": [],
    "cfg_issues": []
  }
}
```

REVFORGE: `from`, `to`, `type`, `resolved`, `unstructured`, `source_line` and
the other original fields keep their meaning. The `*_id` fields are added. An
unresolved target has `to_paragraph_id` and `to_section_id` = `null`.

---

## Neo4j registration and run completion (REVFORGE)

The rules of the cobol-ast-parser skill apply here too:
- IDs come only from Neo4j.
- Queries are used verbatim, with parameters.
- A read is sent only after the writes it depends on have returned.

### Step 1 — register control-flow relationships

Build one relationship entry per resolved target:

| Edge type | `rel_type` | `edge_type` | `role` | Target |
|---|---|---|---|---|
| `PERFORM_SIMPLE`, `PERFORM_UNTIL`, `PERFORM_VARYING`, `PERFORM_TIMES` | `PERFORMS` | the edge type | `TARGET` | paragraph |
| `PERFORM_SECTION` | `PERFORMS` | `PERFORM_SECTION` | `TARGET` | section |
| `PERFORM_THRU` | `PERFORMS` | `PERFORM_THRU` | `START` (to A) and `THRU_END` (to B) | paragraphs |
| `GOTO` | `TRANSFERS_CONTROL_TO` | `GOTO` | `TARGET` | paragraph |
| `GOTO_DEPENDING` | `TRANSFERS_CONTROL_TO` | `GOTO_DEPENDING` | `DEPENDING_TARGET` (one per possible target) | paragraphs |
| `ALTER` | `TRANSFERS_CONTROL_TO` | `ALTER` | `ALTERED_PARAGRAPH` and `NEW_TARGET` | paragraphs |

`PERFORM_INLINE`, `NEXT_SENTENCE`, `EXIT` and unresolved or ambiguous targets
produce no relationship. `statement_id` is the transferring statement;
`target_id` is a Paragraph ID or Section ID of this file.

```cypher
// REVFORGE-QUERY: register-control-flow (write)
// params: file_id, run_id, worker_id,
//   edges: [{statement_id, rel_type, target_id, edge_type, role}]
// Replaces this file's control-flow relationships with the ones from this run.
MATCH (q:ParserSequence {file_id: $file_id})
WHERE q.active_run_id = $run_id AND q.active_worker_id = $worker_id
SET q.locked_at = datetime()
WITH q
CALL {
  WITH q
  MATCH (:CobolStatement {file_id: $file_id})-[r:PERFORMS|TRANSFERS_CONTROL_TO]->()
  DELETE r
}
CALL {
  WITH q
  UNWIND $edges AS e
  MATCH (s:CobolStatement {statement_id: e.statement_id, file_id: $file_id, last_run_id: $run_id})
  OPTIONAL MATCH (tp:CobolParagraph {paragraph_id: e.target_id, file_id: $file_id})
  OPTIONAL MATCH (ts:CobolSection {section_id: e.target_id, file_id: $file_id})
  WITH s, e, coalesce(tp, ts) AS t
  WHERE t IS NOT NULL
  FOREACH (_ IN CASE WHEN e.rel_type = 'PERFORMS' THEN [1] ELSE [] END |
    CREATE (s)-[:PERFORMS {edge_type: e.edge_type, role: e.role, run_id: $run_id}]->(t))
  FOREACH (_ IN CASE WHEN e.rel_type = 'TRANSFERS_CONTROL_TO' THEN [1] ELSE [] END |
    CREATE (s)-[:TRANSFERS_CONTROL_TO {edge_type: e.edge_type, role: e.role, run_id: $run_id}]->(t))
}
```

The result's `relationships_created` must equal the number of entries sent.
If it does not, compare the entries with the statement and paragraph
identities, fix the parameters (never the IDs), and resend once.

### Step 2 — complete the parse run

Send only after every write for this file has returned. The expected counts
are the numbers of sections, paragraphs and statements submitted in this run.
If the registry has seen fewer, nothing is marked inactive, and the run stays
open.

```cypher
// REVFORGE-QUERY: finalize-parse-run (write)
// params: file_id, run_id, worker_id, expected_sections, expected_paragraphs, expected_statements
MATCH (q:ParserSequence {file_id: $file_id})
WHERE q.active_run_id = $run_id AND q.active_worker_id = $worker_id
CALL { WITH q MATCH (s:CobolStatement {file_id: $file_id, last_run_id: $run_id}) RETURN count(s) AS seen_statements }
CALL { WITH q MATCH (p:CobolParagraph {file_id: $file_id, last_run_id: $run_id}) RETURN count(p) AS seen_paragraphs }
CALL { WITH q MATCH (c:CobolSection {file_id: $file_id, last_run_id: $run_id}) RETURN count(c) AS seen_sections }
WITH q, seen_statements, seen_paragraphs, seen_sections
WHERE seen_statements = $expected_statements AND seen_paragraphs = $expected_paragraphs
  AND seen_sections = $expected_sections
CALL {
  WITH q
  MATCH (s:CobolStatement {file_id: $file_id, status: 'ACTIVE'})
  WHERE coalesce(s.last_run_id, '') <> $run_id
  SET s.status = 'INACTIVE', s.inactivated_run_id = $run_id, s.inactivated_at = datetime()
}
CALL {
  WITH q
  MATCH (p:CobolParagraph {file_id: $file_id, status: 'ACTIVE'})
  WHERE coalesce(p.last_run_id, '') <> $run_id
  SET p.status = 'INACTIVE', p.inactivated_run_id = $run_id, p.inactivated_at = datetime()
}
CALL {
  WITH q
  MATCH (c:CobolSection {file_id: $file_id, status: 'ACTIVE'})
  WHERE coalesce(c.last_run_id, '') <> $run_id
  SET c.status = 'INACTIVE', c.inactivated_run_id = $run_id, c.inactivated_at = datetime()
}
SET q.last_completed_run_id = $run_id, q.last_completed_at = datetime(), q.active_run_id = null,
    q.active_worker_id = null
```

### Step 3 — verify integrity

```cypher
// REVFORGE-QUERY: verify-parse-integrity (read)
// params: file_id, run_id
MATCH (q:ParserSequence {file_id: $file_id})
CALL {
  WITH q
  MATCH (s:CobolStatement {file_id: $file_id})
  RETURN count(s) AS statements, count(DISTINCT s.statement_id) AS distinct_statement_ids,
         count(DISTINCT s.statement_number) AS distinct_statement_numbers,
         coalesce(max(s.statement_number), 0) AS max_statement_number,
         sum(CASE WHEN s.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_statements,
         sum(CASE WHEN s.status = 'ACTIVE' AND s.review_status = 'REVIEW_REQUIRED' THEN 1 ELSE 0 END) AS review_required_statements
}
CALL {
  WITH q
  MATCH (s:CobolStatement {file_id: $file_id, status: 'ACTIVE'})
  OPTIONAL MATCH (parent)-[:CONTAINS_STATEMENT]->(s)
  WITH s, count(parent) AS parents
  RETURN sum(CASE WHEN parents = 1 THEN 0 ELSE 1 END) AS active_statements_without_one_parent
}
CALL {
  WITH q
  MATCH (p:CobolParagraph {file_id: $file_id})
  RETURN count(p) AS paragraphs, count(DISTINCT p.paragraph_id) AS distinct_paragraph_ids,
         coalesce(max(p.paragraph_number), 0) AS max_paragraph_number,
         sum(CASE WHEN p.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_paragraphs
}
CALL {
  WITH q
  MATCH (c:CobolSection {file_id: $file_id})
  RETURN count(c) AS sections, count(DISTINCT c.section_id) AS distinct_section_ids,
         coalesce(max(c.section_number), 0) AS max_section_number,
         sum(CASE WHEN c.status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_sections
}
CALL {
  WITH q
  OPTIONAL MATCH (:CobolStatement {file_id: $file_id})-[r:PERFORMS|TRANSFERS_CONTROL_TO]->()
  RETURN count(r) AS control_flow_relationships
}
RETURN $file_id AS file_id, q.active_run_id AS active_run_id,
       q.last_completed_run_id = $run_id AS run_completed,
       statements, active_statements, review_required_statements,
       paragraphs, active_paragraphs, sections, active_sections, control_flow_relationships,
       q.stmt_seq AS statement_counter, q.par_seq AS paragraph_counter, q.sec_seq AS section_counter,
       (statements = distinct_statement_ids AND statements = distinct_statement_numbers
        AND max_statement_number <= q.stmt_seq AND active_statements_without_one_parent = 0
        AND paragraphs = distinct_paragraph_ids AND max_paragraph_number <= q.par_seq
        AND sections = distinct_section_ids AND max_section_number <= q.sec_seq
        AND q.active_run_id IS NULL AND q.last_completed_run_id = $run_id) AS consistent
```

`consistent` and `run_completed` must both be `true`. In addition:
- `active_statements` must equal the statements submitted.
- `active_paragraphs` and `active_sections` must equal the paragraphs and
  sections submitted.
- `control_flow_relationships` must equal the relationship entries sent.

Otherwise record an `error` issue `registry_integrity_failure` with the
returned row, and write no `raw_structure` file for this program.

---

## Parser artifact manifest

After all programs are processed, the Parser Agent writes a combined
`parser_artifact.json`:

```json
{
  "meta": {
    "generated_at": "ISO-8601 timestamp",
    "agent_version": "2_parser@1.0",
    "source_artifact": "inventory_artifact.json",
    "programs_parsed": 42,
    "programs_failed": 2,
    "system_id": "SYS-CARDDEMO-001",
    "system_name": "CARDDEMO",
    "parse_run_ids": ["PRUN-20261021T101500Z-12345"]
  },
  "stats": {
    "total_paragraphs": 1847,
    "total_sections": 203,
    "total_perform_edges": 634,
    "total_goto_edges": 89,
    "total_alter_statements": 3,
    "total_inline_performs": 47,
    "total_dead_code_candidates": 12,
    "programs_with_unstructured_flow": 18,
    "total_statements": 15230,
    "total_review_required_statements": 4,
    "total_uncertain_statements": 7
  },
  "programs": [
    {
      "program_id": "CBACT01C",
      "source_file": "app/cbl/CBACT01C.CBL",
      "ast_file": "raw_structure/SYS-CARDDEMO-001-FIL-0001__CBACT01C.json",
      "total_lines": 892,
      "paragraph_count": 24,
      "section_count": 5,
      "has_unstructured_flow": true,
      "has_alter": false,
      "dead_code_candidates": 0,
      "parse_status": "success",
      "system_id": "SYS-CARDDEMO-001",
      "file_id": "SYS-CARDDEMO-001-FIL-0001",
      "path_id": "SYS-CARDDEMO-001-PATH-0001",
      "file_name": "CBACT01C.CBL",
      "statement_count": 412,
      "perform_edges": 30,
      "goto_edges": 2,
      "control_flow_relationships": 34,
      "review_required_statements": 0,
      "uncertain_statements": 0,
      "parse_run_id": "PRUN-20261021T101500Z-12345"
    }
  ],
  "issues": []
}
```

REVFORGE notes:
- Counting rules:
  - `perform_edges` counts the JSON CFG edges whose type starts with
    `PERFORM_`, except `PERFORM_INLINE`.
  - `goto_edges` counts `GOTO` and `GOTO_DEPENDING` edges.
  - Each program entry also has `control_flow_relationships`: the number of
    registered Neo4j relationships, where a `PERFORM_THRU` edge counts 2.
  - `stats.total_perform_edges` and `stats.total_goto_edges` are the sums.
- `ast_file` is `raw_structure/{FILE_ID}__{PROGRAM_ID}.json`. Including the
  File ID prevents collisions when two files declare the same Program ID.
- `total_sections` counts the registered sections of all divisions.
- `parse_status` is `success`, `partial` (parsed with `UNCERTAIN` statements
  or unresolved items), `empty` (no PROCEDURE DIVISION or empty file) or
  `failed` (not parsed; see `issues`).

---

## Error handling

| Condition | Action |
|---|---|
| Paragraph target not found in AST | Log `warning` in `cfg_issues`, set `resolved: false` |
| ALTER statement detected | Log `critical` issue — record both the ALTER paragraph and target |
| PERFORM THRU range is ambiguous | Log `warning`, record start only, set `implicit_thru_range: null` |
| Inline PERFORM missing END-PERFORM | Log `error`, mark loop boundary as end of paragraph |
| Paragraph with no outgoing edges (not terminal) | Flag as `dead_code_candidate` with `info` severity. REVFORGE: superseded — dead-code candidates follow construction rule 5 (no **incoming** edges, not an entry point, not in a THRU range). A leaf paragraph with no outgoing edges is normal and is not flagged |
| GO TO targeting a paragraph in a different section | Log `warning` — cross-section jump increases complexity |
| Target name matches more than one paragraph | `resolved: false`, `ambiguous_target: true`, log `warning`; no relationship registered |
| Grep cross-check disagrees with the statement list | Log `warning` `cfg_statement_mismatch` in `cfg_issues` |
| `register-control-flow` creates a different number of relationships | Fix the parameters and resend once; then log `error` and stop for this file |
| `finalize-parse-run` does not complete the run (counts differ) | Log `error` `parse_run_incomplete`; write no `raw_structure` file |
| `verify-parse-integrity` fails | Log `error` `registry_integrity_failure`; write no `raw_structure` file |
