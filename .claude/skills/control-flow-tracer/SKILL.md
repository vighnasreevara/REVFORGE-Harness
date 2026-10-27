---
name: control-flow-tracer
description: >
  Takes a single program's AST (from the Parser Agent) and its control flow
  graph, then walks all execution paths from each entry point. Resolves
  PERFORM chains into ordered call sequences, traces IF/EVALUATE/AT END
  branching conditions, annotates each branch with the data fields it tests,
  identifies loops and their termination conditions, confirms or refutes
  dead code candidates, and produces an annotated execution trace with
  path summaries. Called by the Logic Agent before pseudocode-generator.
  REVFORGE: trace elements carry the permanent Paragraph and Statement IDs
  from Agent 2, and condition fields carry the permanent Record/Field IDs
  from Agent 3, retrieved from Neo4j — never allocated here.
---

# Skill — control flow tracer

## Purpose

Starting from each entry point paragraph, walk the control flow graph
produced by the Parser Agent. Follow every PERFORM edge, resolve branch
conditions by reading the actual COBOL source lines, and build an ordered
execution trace that shows what runs in what sequence, under what conditions.

Annotate every branching point with the fields it tests and the outcomes
of each branch. Identify loops and their termination conditions. Confirm
or dismiss dead code candidates flagged by the Parser Agent.

Do NOT translate statements to pseudocode — that is the pseudocode-generator
skill's job. Extract execution order and branch conditions only.

REVFORGE enhancement (permanent ID reuse only):
- Every step, branch and loop carries the Statement and Paragraph IDs of the
  Agent 2 statement it comes from (`raw_structure` file,
  `procedure_division.statements[]` and `paragraphs[]`). The statement is
  found by its paragraph and line (`start_line`…`end_line`).
- Every field name in `condition_fields` is matched to its permanent Record or
  Field ID by the read query in "Field ID lookup" below.
- This skill never allocates, computes or edits an ID. An element that cannot
  be matched to exactly one existing ID gets `null` and is flagged
  `unresolved` (see the error-handling rows marked REVFORGE).
- The bash snippets show the search patterns; in REVFORGE run them with the
  Grep tool or read the lines with Read. Do not write temporary files or run
  scripts.

---

## Phase 1 — entry point identification

Load entry points from the program AST's `control_flow_graph.entry_points`.

Supplement with:
- The first paragraph in `procedure_division.paragraphs` (always an entry)
- Any paragraph referenced in `jcl_registry` steps (batch entry points)
- Any paragraph targeted by `CICS_LINK` or `CICS_XCTL` edges in the
  inventory call graph (online entry points)

For each entry point, initialise a separate execution trace.

REVFORGE: each trace carries `entry_point_id`, the Paragraph ID from
`control_flow_graph.entry_point_ids` (or the paragraph's `paragraph_id`).

---

## Phase 2 — PERFORM chain resolution

Walk the CFG edge list from the current paragraph. For each outgoing edge:

### PERFORM_SIMPLE
```
Record: call to target paragraph
Next: after target paragraph returns, continue from calling paragraph
```

### PERFORM_UNTIL
```bash
# Read the condition from source lines around the PERFORM statement
sed -n "${PERFORM_LINE}p" "$SOURCE_FILE" | grep -iE "UNTIL\s+(.*)"
```
Record:
- Target paragraph name
- Condition text verbatim (raw COBOL)
- Fields referenced in condition (look up each token in field_catalogue)
- Condition test time: `BEFORE` (default) or `AFTER` (WITH TEST AFTER)
- Loop type: `WHILE` (test before) or `DO_WHILE` (test after)

### PERFORM_VARYING
```bash
sed -n "${PERFORM_LINE},${PERFORM_LINE+5}p" "$SOURCE_FILE" | \
  grep -iE "VARYING\s+([A-Z0-9\-]+)\s+FROM\s+(.*)\s+BY\s+(.*)\s+UNTIL\s+(.*)"
```
Record:
- Index variable name
- FROM value (literal or field name)
- BY value (increment — literal or field name)
- UNTIL condition text
- Fields referenced

### PERFORM_THRU
Record the full paragraph range (from AST `implicit_thru_range`).
Flag as `"unstructured": true`.
Add each paragraph in range as an ordered sub-step in the trace.

### PERFORM_INLINE
```bash
# Find END-PERFORM boundary
sed -n "${LOOP_START},${PARA_END}p" "$SOURCE_FILE" | grep -niE "END-PERFORM"
```
Record as a self-contained block with condition and body line range.

REVFORGE: each step carries `statement_id` and `paragraph_id` (the CFG edge's
`statement_id` and `from_paragraph_id`), and `target_paragraph_id` /
`target_section_id` copied from the edge's `to_paragraph_id` /
`to_section_id`. An unresolved edge keeps `null` target IDs.

REVFORGE — `EXEC CICS HANDLE CONDITION`: Agent 2 registers no control-flow
edge for it. Record one step per `condition(paragraph)` pair with
`action: "CICS_HANDLE_CONDITION"`, `condition` = the CICS condition name,
`target` = the paragraph name as written, `unstructured: true` and
`runtime_conditional: true`. The step registers a handler only; the
transfer happens at run time and only if that condition is raised, so it
is not traced as an executed path. `target_paragraph_id` is copied from the
program's `procedure_division.paragraphs` entry whose `name` equals the
target exactly, when exactly one such paragraph exists. Otherwise it is
`null`, and the step is listed in `unresolvable_paths`. No CFG edge or
Neo4j relationship is added.

---

## Phase 3 — branch condition extraction

For every branching statement inside each paragraph, extract the full
condition and map it to data fields.

### IF statement extraction

```bash
# IF statement — may span multiple lines
sed -n "${START},${END}p" "$SOURCE_FILE" | grep -niE "^\s{0,6}[^*/].{4,}\bIF\b\s+(.*)"
```

For each IF, trace through to find matching ELSE and END-IF:

```bash
# ELSE clause
grep -niE "^\s{0,6}[^*/].{4,}\bELSE\b" /tmp/para_lines.txt

# END-IF
grep -niE "^\s{0,6}[^*/].{4,}\bEND-IF\b" /tmp/para_lines.txt
```

Record:
```json
{
  "type": "IF",
  "line": 445,
  "condition_text": "WS-RETURN-CODE NOT EQUAL ZEROS",
  "condition_fields": ["WS-RETURN-CODE"],
  "has_else": true,
  "then_line_range": [446, 452],
  "else_line_range": [454, 460],
  "end_if_line": 461,
  "nested_depth": 1
}
```

Detect nested IFs by tracking depth counter — increment on `IF`, decrement
on `END-IF`. Flag nesting depth > 3 as `"complex": true`.

### EVALUATE statement extraction

```bash
# EVALUATE header
grep -niE "^\s{0,6}[^*/].{4,}\bEVALUATE\b\s+(.*)" /tmp/para_lines.txt

# WHEN clauses
grep -niE "^\s{0,6}[^*/].{4,}\bWHEN\b\s+(.*)" /tmp/para_lines.txt

# WHEN OTHER
grep -niE "^\s{0,6}[^*/].{4,}\bWHEN\s+OTHER\b" /tmp/para_lines.txt

# END-EVALUATE
grep -niE "^\s{0,6}[^*/].{4,}\bEND-EVALUATE\b" /tmp/para_lines.txt
```

For EVALUATE TRUE ALSO TRUE (multi-subject):
- Record each subject separately
- Each WHEN clause has multiple conditions (one per subject)
- Record as a condition matrix

```json
{
  "type": "EVALUATE",
  "line": 520,
  "subjects": ["TRUE", "TRUE"],
  "when_clauses": [
    {
      "conditions": ["WS-TRANS-TYPE = 'CR'", "WS-AMOUNT > ZERO"],
      "condition_fields": ["WS-TRANS-TYPE", "WS-AMOUNT"],
      "body_line_range": [522, 528]
    },
    {
      "conditions": ["WS-TRANS-TYPE = 'DR'", "ANY"],
      "condition_fields": ["WS-TRANS-TYPE"],
      "body_line_range": [530, 536]
    },
    {
      "conditions": ["OTHER"],
      "condition_fields": [],
      "body_line_range": [538, 542],
      "is_default": true
    }
  ],
  "end_evaluate_line": 543
}
```

### AT END / INVALID KEY / ON EXCEPTION extraction

These are implicit branches on I/O operations:

```bash
# READ ... AT END
grep -niE "\bREAD\b.+\bAT\s+END\b" /tmp/para_lines.txt

# READ ... NOT AT END
grep -niE "\bREAD\b.+\bNOT\s+AT\s+END\b" /tmp/para_lines.txt

# WRITE/REWRITE ... INVALID KEY
grep -niE "\b(WRITE|REWRITE|DELETE)\b.+\bINVALID\s+KEY\b" /tmp/para_lines.txt

# CALL ... ON EXCEPTION / ON OVERFLOW
grep -niE "\bCALL\b.+\b(ON\s+EXCEPTION|ON\s+OVERFLOW)\b" /tmp/para_lines.txt
```

Record:
```json
{
  "type": "AT_END",
  "operation": "READ",
  "file_name": "ACCT-FILE",
  "line": 612,
  "at_end_line_range": [613, 616],
  "not_at_end_line_range": [618, 625],
  "condition_fields": ["ACCT-FILE"],
  "io_status_field": "WS-FILE-STATUS"
}
```

REVFORGE: each branch record carries `statement_id` and `paragraph_id` of the
branching statement (the Agent 2 compound statement at that `line`); each
outcome may carry `statement_ids` — the Agent 2 statements directly inside
that branch. `condition_fields` keeps the names; `condition_field_ids` adds
one lookup result per name (see "Field ID lookup").

---

## Phase 4 — loop detection and termination analysis

For every PERFORM_UNTIL, PERFORM_VARYING, and PERFORM_INLINE edge in the CFG:

1. Extract the termination condition fields
2. Look up each field in `data_artifact.field_catalogue`
3. Identify what statements inside the loop body modify those fields
4. Determine loop termination pattern:

| Pattern | Classification |
|---|---|
| Field set by READ AT END | `FILE_EXHAUSTION_LOOP` |
| Field set by counter increment vs fixed limit | `COUNTED_LOOP` |
| Field set by external CALL result | `EXTERNAL_TERMINATION_LOOP` |
| Field never modified in loop body | `POTENTIAL_INFINITE_LOOP` — flag warning |
| Field modified conditionally | `CONDITIONAL_TERMINATION_LOOP` |

```bash
# Find all MOVE statements that set the termination condition field
grep -niE "\bMOVE\b.+\bTO\s+${FIELD_NAME}\b" /tmp/para_lines.txt

# Find all COMPUTE/ADD/SUBTRACT statements
grep -niE "\b(COMPUTE|ADD|SUBTRACT)\b.*\b${FIELD_NAME}\b" /tmp/para_lines.txt
```

REVFORGE: each loop carries `statement_id` (the PERFORM), `paragraph_id`,
`target_paragraph_id`, `condition_field_ids`, and
`modifying_statement_ids` — the Statement IDs of the statements found in
step 3 (matched by line).

---

## Phase 5 — dead code confirmation

The Parser Agent flagged dead code candidates (paragraphs with no incoming
edges and not an entry point). Confirm or dismiss each:

```
For each dead_code_candidate paragraph:
  1. Search ALL program source lines for the paragraph name as a PERFORM target
     grep -niE "PERFORM\s+${PARA_NAME}" "$SOURCE_FILE"
  2. Search for it as a GO TO target
     grep -niE "GO\s+TO\s+${PARA_NAME}" "$SOURCE_FILE"
  3. Search for it in PERFORM THRU ranges
     grep -niE "THRU\s+${PARA_NAME}" "$SOURCE_FILE"
  4. If any match found → dismiss dead code flag (was missed by CFG builder)
  5. If no match found → confirm dead code, record in trace
```

REVFORGE: each `dead_code_confirmed` entry is
`{paragraph, paragraph_id}`.

---

## Field ID lookup (REVFORGE)

Look up each distinct field name used in `condition_fields` (once per name
per program). `X OF Y` / `X IN Y` is sent as `name: "X"`, `qualifiers:
["Y"]`. Send at most 200 names per call; `ref_key` (`R1`, `R2`, …) is
run-local, not an identity. Use the Neo4j MCP **read** tool.

```cypher
// REVFORGE-QUERY: resolve-field-references (read)
// params: file_id, refs: [{ref_key, name, qualifiers: [string]}]
// Scope: the file's own ACTIVE records plus the ACTIVE records of the copybooks it uses (USES_COPYBOOK).
MATCH (f:SourceFile {file_id: $file_id})
CALL {
  WITH f
  MATCH (f)-[:DEFINES_RECORD]->(r:DataRecord {status: 'ACTIVE'})
  RETURN collect(r) AS own
}
CALL {
  WITH f
  OPTIONAL MATCH (f)-[:USES_COPYBOOK]->(:SourceFile)-[:DEFINES_RECORD]->(r:DataRecord {status: 'ACTIVE'})
  RETURN collect(DISTINCT r) AS copied
}
WITH own, own + [r IN copied WHERE NOT r IN own] AS scope
UNWIND $refs AS ref
CALL {
  WITH scope, ref
  UNWIND scope AS r
  WITH r, ref WHERE r.name = ref.name AND size(coalesce(ref.qualifiers, [])) = 0
  RETURN collect({kind: 'record', id: r.record_id, qualified_name: r.name, defined_in: r.file_id}) AS record_hits
}
CALL {
  WITH scope, ref
  UNWIND scope AS r
  MATCH p = (r)-[:CONTAINS_FIELD*1..]->(x:DataField {name: ref.name, status: 'ACTIVE'})
  WITH r, x, ref, [n IN nodes(p)[0..-1] | n.name] AS ancestors
  WHERE all(q IN coalesce(ref.qualifiers, []) WHERE q IN ancestors)
  RETURN collect(DISTINCT {kind: CASE WHEN x.is_condition THEN 'condition' ELSE 'field' END, id: x.field_id,
                 qualified_name: x.qualified_name, defined_in: x.file_id}) AS field_hits
}
// Qualified names through a COPY held by one of the file's own records (EXPANDS_COPY).
// Valid only for a fragment copybook (no 01 of its own; its items are subordinate to the holder).
// A copybook that starts with its own 01 begins a separate record, so qualifying its fields by the
// holder is not valid COBOL: those candidates are reported, never resolved.
CALL {
  WITH own, ref
  UNWIND own AS r
  MATCH p1 = (r)-[:CONTAINS_FIELD*0..]->(h)-[:EXPANDS_COPY]->(cr:DataRecord {status: 'ACTIVE'})
  MATCH p2 = (cr)-[:CONTAINS_FIELD*1..]->(x:DataField {name: ref.name, status: 'ACTIVE'})
  WITH ref, cr, x, [n IN nodes(p1) | n.name] + [n IN nodes(p2)[1..-1] | n.name] AS ancestors
  WHERE size(coalesce(ref.qualifiers, [])) > 0 AND all(q IN ref.qualifiers WHERE q IN ancestors)
  RETURN collect(DISTINCT CASE WHEN cr.is_fragment THEN {kind: CASE WHEN x.is_condition THEN 'condition' ELSE 'field' END,
                 id: x.field_id, qualified_name: x.qualified_name, defined_in: x.file_id} END) AS fragment_hits,
         collect(DISTINCT CASE WHEN NOT coalesce(cr.is_fragment, false) THEN x.field_id END) AS level01_copy_candidates
}
WITH ref, level01_copy_candidates,
     reduce(acc = [], h IN record_hits + field_hits + fragment_hits | CASE WHEN h.id IN [a IN acc | a.id] THEN acc ELSE acc + [h] END) AS hits
RETURN ref.ref_key AS ref_key, ref.name AS name, ref.qualifiers AS qualifiers,
       CASE size(hits) WHEN 0 THEN 'UNRESOLVED' WHEN 1 THEN 'RESOLVED' ELSE 'AMBIGUOUS' END AS resolution,
       CASE WHEN size(hits) = 1 THEN hits[0].id END AS target_id,
       CASE WHEN size(hits) = 1 THEN hits[0].kind END AS target_kind,
       CASE WHEN size(hits) = 1 THEN hits[0].qualified_name END AS qualified_name,
       CASE WHEN size(hits) = 1 THEN hits[0].defined_in END AS defined_in,
       CASE WHEN size(hits) > 1 THEN [h IN hits | h.id] ELSE [] END AS candidate_ids,
       CASE WHEN size(hits) = 0 AND size(level01_copy_candidates) > 0 THEN 'QUALIFIER_HOLDS_LEVEL01_COPY' END AS unresolved_reason,
       CASE WHEN size(hits) = 0 THEN level01_copy_candidates ELSE [] END AS invalid_qualification_candidates
ORDER BY ref_key
```

Each `condition_field_ids` entry is `{name, qualifiers, resolution,
target_id, target_kind, candidate_ids}` copied from the result:
- `RESOLVED` → `target_id` is the existing Record ID or Field ID.
- `UNRESOLVED` or `AMBIGUOUS` → `target_id: null` (and the candidates for
  `AMBIGUOUS`). Never choose one of several candidates and never guess.
- When the result has `unresolved_reason: "QUALIFIER_HOLDS_LEVEL01_COPY"`,
  the entry also carries `unresolved_reason` and
  `invalid_qualification_candidates` (copied as returned). The name is
  qualified by a record that holds a `COPY` of a copybook beginning with
  its own 01, so the field is not subordinate to the qualifier. The
  reference stays `UNRESOLVED`; the candidates are evidence for review,
  not a match.
- Names that are not data items (literals, figurative constants, file
  names, special registers such as `RETURN-CODE`) are not looked up.
- Index names declared with `INDEXED BY` are not data items and have no
  Field ID. They are not looked up: their entry is `{name, resolution:
  "INDEX_NAME", target_id: null}`, they are not counted as unresolved,
  and they keep their role in the trace (loop index, `SET`, `SEARCH`
  subscript).

---

## Output schema — execution trace (added to program logic file)

```json
{
  "program_id": "CBACT01C",
  "execution_traces": [
    {
      "entry_point": "0000-MAIN",
      "entry_type": "batch_main",
      "steps": [
        {
          "step": 1,
          "paragraph": "0000-MAIN",
          "action": "PERFORM",
          "target": "0100-OPEN-FILES",
          "condition": null,
          "line": 431
        },
        {
          "step": 2,
          "paragraph": "0000-MAIN",
          "action": "PERFORM_UNTIL",
          "target": "0200-PROCESS-RECORDS",
          "condition": {
            "text": "WS-EOF-FLAG = 'Y'",
            "fields": ["WS-EOF-FLAG"],
            "test_time": "BEFORE",
            "loop_type": "WHILE",
            "termination_pattern": "FILE_EXHAUSTION_LOOP"
          },
          "line": 445
        },
        {
          "step": 3,
          "paragraph": "0000-MAIN",
          "action": "PERFORM",
          "target": "9000-CLOSE-FILES",
          "condition": null,
          "line": 460
        },
        {
          "step": 4,
          "paragraph": "0000-MAIN",
          "action": "STOP_RUN",
          "target": null,
          "condition": null,
          "line": 465
        }
      ]
    }
  ],
  "branch_map": [
    {
      "paragraph": "0200-PROCESS-RECORDS",
      "branches": [
        {
          "type": "IF",
          "line": 520,
          "condition_text": "WS-ACCT-TYPE = 'CREDIT'",
          "condition_fields": ["WS-ACCT-TYPE"],
          "outcomes": [
            { "label": "THEN", "line_range": [521, 530] },
            { "label": "ELSE", "line_range": [532, 540] }
          ]
        }
      ]
    }
  ],
  "loops": [
    {
      "paragraph": "0000-MAIN",
      "target": "0200-PROCESS-RECORDS",
      "type": "PERFORM_UNTIL",
      "condition_fields": ["WS-EOF-FLAG"],
      "termination_pattern": "FILE_EXHAUSTION_LOOP",
      "line": 445
    }
  ],
  "dead_code_confirmed": [],
  "unresolvable_paths": [],
  "trace_issues": []
}
```

REVFORGE: all fields above keep their names and meaning; downstream
consumers that ignore the added fields are unaffected. Added fields (all
copied from verified upstream JSON or Neo4j read results, `null` when not
matched):

| Element | Added fields |
|---|---|
| execution trace | `entry_point_id` |
| step | `statement_id`, `paragraph_id`, `target_paragraph_id`, `target_section_id`; `condition.field_ids`; for `CICS_HANDLE_CONDITION` steps also `condition`, `unstructured`, `runtime_conditional` |
| `branch_map` entry | `paragraph_id` |
| branch | `statement_id`, `paragraph_id`, `condition_field_ids`; outcome `statement_ids` |
| loop | `statement_id`, `paragraph_id`, `target_paragraph_id`, `condition_field_ids`, `modifying_statement_ids` |
| `dead_code_confirmed` entry | `paragraph`, `paragraph_id` |
| `unresolvable_paths` entry | `statement_id`, `paragraph_id`, `target` (as written) |

---

## Error handling

| Condition | Action |
|---|---|
| Entry point paragraph not found in AST | Log `error`, skip trace for that entry point |
| PERFORM target not in CFG | Log `warning`, record as `"unresolvable"` step |
| IF without matching END-IF | Log `warning`, estimate boundary at next paragraph start |
| EVALUATE without END-EVALUATE | Log `warning`, treat next WHEN or paragraph boundary as end |
| Loop with no termination condition field found | Log `warning`, classify as `POTENTIAL_INFINITE_LOOP` |
| Nested IF depth > 5 | Log `warning`, flag as `"high_complexity"` |
| GO TO mid-paragraph | Log in `trace_issues`, record as unconditional jump step |
| Circular PERFORM chain (recursion) | Log `error`, record cycle and stop tracing that path |
| REVFORGE: no Agent 2 statement matches a step, branch or loop by paragraph and line | Set its `statement_id: null`, log `warning` `statement_id_unresolved` in `trace_issues` |
| REVFORGE: field name `UNRESOLVED` or `AMBIGUOUS` in the lookup | Keep `target_id: null`, log `info` `field_id_unresolved` / `field_id_ambiguous` with the name (and candidates) |
| REVFORGE: `unresolved_reason: "QUALIFIER_HOLDS_LEVEL01_COPY"` | Keep `target_id: null`, log `warning` `invalid_qualification` with the name, qualifier and `invalid_qualification_candidates` |
