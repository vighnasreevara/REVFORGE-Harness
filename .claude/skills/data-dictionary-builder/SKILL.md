---
name: data-dictionary-builder
description: >
  Takes all layout JSON files produced by the record-layout-parser skill and
  normalises them into a unified, codebase-wide data dictionary. Deduplicates
  shared copybook structures, resolves REDEFINES alias chains, maps fields to
  the programs that read or write them, identifies candidate entity
  relationships between records (shared key fields, foreign key patterns),
  and produces the data_artifact.json containing the full data dictionary,
  a flat field catalogue, and an ERD-ready entity-relationship model.
  Called by the Data Agent after record-layout-parser.
  REVFORGE: every entry carries the permanent Record and Field IDs; cross-record
  relationships are derived deterministically in Neo4j.
---

# Skill — data dictionary builder

## Purpose

Aggregate all per-layout JSON files into a single, unified data model.
Normalise duplicates, resolve REDEFINES chains, enrich each field with
cross-program usage metadata, detect candidate relationships between records,
and produce the final data artifact that downstream agents use as their
authoritative data reference.

Do NOT interpret field purpose or business meaning — use field names,
types, and structural patterns only to infer relationships.

REVFORGE enhancement:
- The catalogues are built from the one-line catalogue fragments written by
  record-layout-parser (`data_layouts/_catalogue/`), so the artifact never
  needs whole layouts to be re-read.
- The cross-record work runs as Neo4j queries over the permanent registry:
  relationships, REDEFINES groups and statistics.
- `record_id` and `field_id` are the permanent IDs. The original name-based
  keys are kept as `record_key` and `field_key`.

---

## Phase 1 — record deduplication

Copybooks are parsed once but used by many programs. Build a master record
catalogue where each copybook layout appears exactly once.

### Deduplication rules

```
1. Load all layout JSON files from data_layouts/
2. Separate into two groups:
   a. Copybook layouts  (source_type == "copybook")
   b. Program WS layouts (source_type == "program_ws")
3. For copybook layouts: use the copybook ID as the canonical record ID
   (e.g. CVACT01Y → one entry in master catalogue)
4. For program WS layouts: each 01-level group becomes its own record entry
   - If an 01-level group is just a COPY stub expansion, point to the
     canonical copybook record rather than duplicating
5. Assign each record a stable unique ID:
   format: REC-{SOURCE_ID}-{RECORD_NAME}
   e.g.:   REC-CVACT01Y-ACCOUNT-RECORD
           REC-CBACT01C_WS-WS-CONTROL-BLOCK
```

REVFORGE:
- Deduplication is guaranteed by the registry: copybook records exist once,
  under the copybook's File ID, and programs reference them through
  `EXPANDS_COPY`.
- The name-based ID of rule 5 is kept as `record_key`. `record_id` is the
  permanent Record ID (`{FILE_ID}-REC-NNNN`).
- An 01 whose only content is a COPY stub keeps its own record entry (it is a
  declared item), with `expands_copybooks` pointing to the canonical copybook
  record IDs.

---

## Phase 2 — flat field catalogue

Flatten every record's nested hierarchy into a flat list of elementary
fields (leaf nodes only — group items are retained as structural metadata
but not as individual catalogue entries).

For each elementary field produce a catalogue entry:

```
field_id         : globally unique ID
                   format: FLD-{RECORD_ID}-{FIELD_NAME}
                   e.g.:   FLD-REC-CVACT01Y-ACCOUNT-RECORD-ACCT-ID
record_id        : parent record ID
field_name       : COBOL name (uppercase)
qualified_name   : full dotted path from 01-level
                   e.g.: ACCOUNT-RECORD.ACCT-ID
level            : level number (integer)
normalized_type  : from PIC parsed output
length           : total character/byte length
decimal_places   : decimal digits (0 if integer or string)
signed           : boolean
storage_type     : DISPLAY / BINARY / PACKED_DECIMAL / etc.
is_filler        : boolean
is_condition     : boolean (true for 88-level entries)
redefines        : field_id of redefined field, or null
occurs_max       : max occurs, or null if not a table entry
source_line      : original line in source file
```

REVFORGE:
- `field_id` is the permanent Field ID (`{FILE_ID}-FLD-NNNNNN`), and
  `record_id` is the permanent Record ID. The name-based IDs above are kept as
  `field_key` / `record_key`.
- `redefines` holds the permanent Field ID of the redefined field.
- Elementary 01/77 records also appear in the field catalogue, as an entry with
  `field_id: null` and `record_level_item: true`, so that every elementary
  data item can be looked up in one list.

### Handling REDEFINES in the flat catalogue

When field B REDEFINES field A:
- Both A and B appear in the flat catalogue as separate entries
- B's entry has `redefines: "FLD-...-A"`
- Add a `redefines_group` object listing all fields that share the same
  storage (A and all its redefines siblings)

```json
"redefines_groups": [
  {
    "storage_anchor": "FLD-REC-CVACT01Y-ACCOUNT-RECORD-ACCT-TYPE-CODE",
    "aliases": [
      "FLD-REC-CVACT01Y-ACCOUNT-RECORD-ACCT-TYPE-REDEF"
    ],
    "bytes": 3,
    "note": "Same 3 bytes interpreted as X(3) or 9(3)"
  }
]
```

REVFORGE: build `redefines_groups` from the `fetch-redefines-groups` query
(Phase 6). It returns the anchor, the aliases and their computed sizes. A
group whose sizes differ gets `bytes_mismatch: true` and a `warning` issue.

---

## Phase 3 — cross-program field usage mapping

For each field in the flat catalogue, determine which programs use it
and in what role.

### Usage detection strategy

Using the inventory artifact's `copybook_map`:
- If a copybook is used by programs A, B, C → all fields in that copybook
  are potentially used by A, B, C
- Record usage as `"potential"` — exact read/write analysis is the
  Logic Agent's job

Mark fields from widely-shared copybooks (used by 5+ programs) as
`"high_shared"` — these are the most important fields for the BRD
data model chapter.

```json
"field_usage": {
  "field_id": "FLD-REC-CVACT01Y-ACCOUNT-RECORD-ACCT-ID",
  "used_by_programs": ["CBACT01C", "COACT01C", "COACT02C"],
  "usage_type": "potential",
  "shared_level": "high_shared"
}
```

REVFORGE:
- `used_by_programs` for copybook fields is the union of the inventory
  `copybook_map` and the inventory `call_graph` `SQL_INCLUDE` edges for that
  copybook, as program IDs.
- A program field's `used_by_programs` is its own program.
- `shared_level` is `high_shared` (5+ programs), `shared` (2–4) or `local` (1).

---

## Phase 4 — entity relationship detection

Identify candidate relationships between records using structural heuristics.
These are candidates only — the Logic Agent confirms them.

### Heuristic 1 — shared key field names

If two different records both contain a field with the same name and the
same PIC clause (type + length), they likely share a key relationship.

```
For each pair of records (A, B):
  For each field in A:
    If B contains a field with:
      - Same name (exact match, case-insensitive)
      - Same normalized_type
      - Same length
    → candidate relationship: A relates to B via field-name
```

### Heuristic 2 — naming convention patterns

Common COBOL key field naming patterns signal relationships:

| Pattern | Likely meaning |
|---|---|
| Field ends with `-ID` | Primary or foreign key identifier |
| Field ends with `-KEY` | Key field |
| Field ends with `-NBR` or `-NUM` or `-NO` | Numeric identifier |
| Field ends with `-CODE` or `-CD` | Code/lookup key |
| Field ends with `-DATE` or `-DT` | Date field — link temporal records |
| Field name contains another record's base name | Foreign key candidate |

For each field matching a key pattern, check if any other record has a
field with the same name → candidate relationship.

### Heuristic 3 — FD to WS record pairing

Each FD entry in the FILE SECTION declares a file record. The corresponding
WORKING-STORAGE section often has a matching 01-level group that mirrors
the FD record layout (used as an I/O buffer).

Detect these pairs:
- FD `ACCT-FILE` → look for WS group `WS-ACCT-REC` or `ACCT-RECORD` or
  similar (strip common prefixes WS-, WRK-, IO-, BUF-)
- If found → record as a `FILE_BUFFER` relationship

### Relationship types

| Type | Meaning |
|---|---|
| `SHARED_KEY` | Two records share a common key field name and type |
| `FILE_BUFFER` | WS record is the I/O buffer for an FD file record |
| `REDEFINES_ALIAS` | Same storage interpreted differently |
| `COPY_EXPANSION` | Record is an expansion of a copybook |
| `NAMING_CONVENTION` | Key naming pattern suggests relationship |

REVFORGE — all heuristics run as one deterministic Neo4j query
(`derive-record-relationships`, Phase 6), with this interpretation:
- **Which records are compared.** Heuristics 1 and 2 compare **entity
  records** only: copybook records and FILE SECTION records. Comparing every
  WORKING-STORAGE scratch item would relate programs merely because they share
  names such as `WS-FILE-STATUS`.
- **`SHARED_KEY`** (confidence `high`): same name with a key-pattern suffix
  (`-ID`, `-KEY`, `-NBR`, `-NUM`, `-NO`, `-CODE`, `-CD`) **and** same
  `normalized_type` and `length` (Heuristic 1 restricted by Heuristic 2).
- **`NAMING_CONVENTION`** (confidence `low`): same key-pattern name, but the
  type or length differ.
- **`FILE_BUFFER`** (confidence `medium`): a FILE record and a
  WORKING-STORAGE record of the same program whose names match after the
  prefixes `WS-`, `WRK-`, `IO-` and `BUF-`, and the suffixes `-REC`, `-RECORD`
  and `-FILE` on the FD name, are removed.
- **`COPY_EXPANSION`** (confidence `high`): a program record that expands a
  copybook record.
- **`REDEFINES_ALIAS`** (confidence `high`): a record that REDEFINES another
  record.
- `-DATE`/`-DT` matches are not used. Dates are shared by unrelated records
  and would add noise.

---

## Phase 5 — 88-level condition catalogue

Build a separate catalogue of all 88-level condition names across the
codebase. These represent coded values and are critical for the Rules Agent.

For each 88-level entry record:
- Condition name
- Parent field name and record
- Value set (values or ranges)
- All programs that have access to this condition (via copybook usage)

Group conditions by parent field — a field with many 88-level children
is a status/type/code field and is high priority for business rule extraction.

```json
"condition_catalogue": [
  {
    "condition_name": "ACCT-OVERDRAWN",
    "parent_field": "ACCT-BALANCE",
    "parent_record": "REC-CVACT01Y-ACCOUNT-RECORD",
    "values": [{"from": -999999999.99, "to": -0.01}],
    "programs_in_scope": ["CBACT01C", "COACT01C"],
    "condition_group_size": 4,
    "note": "4 conditions on ACCT-BALANCE — likely a status field"
  }
]
```

REVFORGE: each condition entry also carries `condition_id` (the 88-level's
permanent Field ID), `parent_field_id`, `parent_record_id` (permanent IDs) and
`values_raw`. `parent_record` keeps the name-based key.

---

## Phase 6 — registry queries and assembly (REVFORGE)

The rules of the record-layout-parser skill apply here too:
- Queries are used verbatim, with parameters.
- A read is sent only after the writes it depends on have returned.
- No ID is ever invented.

Run this phase only after **every** file's data run has completed
(record-layout-parser Step 4).

### Catalogue entry formats (the fragments)

**`record_catalogue` entry** (`*.records.jsonl`):

```json
{"record_id": "SYS-CARDDEMO-001-FIL-0002-REC-0001", "record_key": "REC-CVACT01Y-ACCOUNT-RECORD", "record_name": "ACCOUNT-RECORD", "source_id": "CVACT01Y", "source_type": "copybook", "section": "COPYBOOK", "file_id": "SYS-CARDDEMO-001-FIL-0002", "path_id": "SYS-CARDDEMO-001-PATH-0002", "source_file": "app/copy/CVACT01Y.CPY", "section_id": null, "fd_name": null, "level": 1, "is_fragment": false, "used_by_programs": ["CBACT01C", "COACT01C"], "total_fields": 24, "total_bytes": 300, "inline_bytes": 300, "has_redefines": true, "has_occurs": false, "expands_copybooks": [], "field_ids": ["SYS-CARDDEMO-001-FIL-0002-FLD-000001"], "start_line": 5}
```

- `field_ids` lists all of the record's own fields (groups, elementary,
  88-levels) in source order.
- `expands_copybooks` lists the copybook record IDs it expands.

**`field_catalogue` entry** (`*.fields.jsonl`), elementary fields only:

```json
{"field_id": "SYS-CARDDEMO-001-FIL-0002-FLD-000001", "field_key": "FLD-REC-CVACT01Y-ACCOUNT-RECORD-ACCT-ID", "record_id": "SYS-CARDDEMO-001-FIL-0002-REC-0001", "file_id": "SYS-CARDDEMO-001-FIL-0002", "field_name": "ACCT-ID", "path": "ACCT-ID", "qualified_name": "ACCOUNT-RECORD.ACCT-ID", "level": 5, "pic_raw": "X(11)", "normalized_type": "STRING", "length": 11, "decimal_places": 0, "signed": false, "storage_type": "DISPLAY", "bytes": 11, "is_filler": false, "is_condition": false, "redefines": null, "occurs_max": null, "source_line": 7, "used_by_programs": ["CBACT01C", "COACT01C"], "shared_level": "shared"}
```

**`condition_catalogue` entry** (`*.conditions.jsonl`): as in Phase 5, with
the REVFORGE fields. `note` is neutral, for example
`"4 conditions on ACCT-STATUS"`. It never interprets meaning, so wording
such as "likely a status field" is not used.

**Elementary 01/77 record in the field catalogue:** `field_id: null`,
`record_level_item: true`, `path: null`, `field_key: "FLD-" + record_key`,
plus the record's PIC attributes and `bytes` = its `total_bytes`.
The record name is not repeated: record_key `REC-PORTTRAN_WS-WS-EOF-FLAG`
gives field_key `FLD-REC-PORTTRAN_WS-WS-EOF-FLAG`.

### Derive record relationships

```cypher
// REVFORGE-QUERY: derive-record-relationships (write)
// params: system_id, run_id (the agent's data run ID)
// Rebuilds all RELATED_RECORD relationships of the system.
MATCH (s:System {system_id: $system_id})
CALL {
  WITH s
  MATCH (s)-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(:DataRecord)-[rel:RELATED_RECORD]->()
  DELETE rel
}
CALL {
  WITH s
  MATCH (s)-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(a:DataRecord {status: 'ACTIVE'})
  WHERE a.section IN ['COPYBOOK', 'FILE']
  MATCH (a)-[:CONTAINS_FIELD*1..]->(fa:DataField {status: 'ACTIVE', is_group: false, is_condition: false, is_filler: false})
  WITH s, a, fa
  WHERE any(sfx IN ['-ID', '-KEY', '-NBR', '-NUM', '-NO', '-CODE', '-CD'] WHERE fa.name ENDS WITH sfx)
  MATCH (s)-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(b:DataRecord {status: 'ACTIVE'})
  WHERE b.section IN ['COPYBOOK', 'FILE'] AND a.record_id < b.record_id
  MATCH (b)-[:CONTAINS_FIELD*1..]->(fb:DataField {status: 'ACTIVE', is_group: false, is_condition: false,
                                                  is_filler: false, name: fa.name})
  WITH a, b, fa.name AS via,
       max(CASE WHEN fa.normalized_type = fb.normalized_type AND fa.length = fb.length THEN 1 ELSE 0 END) AS exact
  MERGE (a)-[r:RELATED_RECORD {type: CASE WHEN exact = 1 THEN 'SHARED_KEY' ELSE 'NAMING_CONVENTION' END,
                               via_field: via}]->(b)
  SET r.confidence = CASE WHEN exact = 1 THEN 'high' ELSE 'low' END, r.run_id = $run_id
}
CALL {
  WITH s
  MATCH (s)-[:HAS_FILE]->(pf:SourceFile)-[:DEFINES_RECORD]->(fr:DataRecord {status: 'ACTIVE', section: 'FILE'})
  MATCH (pf)-[:DEFINES_RECORD]->(wr:DataRecord {status: 'ACTIVE', section: 'WORKING-STORAGE'})
  WITH fr, wr,
       [p IN ['WS-', 'WRK-', 'IO-', 'BUF-'] WHERE wr.name STARTS WITH p | substring(wr.name, size(p))] + [wr.name] AS wbases,
       [x IN [fr.name, fr.fd_name] WHERE x IS NOT NULL] AS fnames
  WITH fr, wr, wbases,
       fnames + [n IN fnames WHERE n ENDS WITH '-FILE' | left(n, size(n) - 5)]
              + [n IN fnames WHERE n ENDS WITH '-RECORD' | left(n, size(n) - 7)]
              + [n IN fnames WHERE n ENDS WITH '-REC' | left(n, size(n) - 4)] AS fbases
  WITH fr, wr, [b IN wbases | b] + [b IN wbases WHERE b ENDS WITH '-REC' | left(b, size(b) - 4)]
                 + [b IN wbases WHERE b ENDS WITH '-RECORD' | left(b, size(b) - 7)] AS wall, fbases
  WHERE any(w IN wall WHERE w IN fbases)
  MERGE (wr)-[r:RELATED_RECORD {type: 'FILE_BUFFER', via_field: fr.name}]->(fr)
  SET r.confidence = 'medium', r.run_id = $run_id
}
CALL {
  WITH s
  MATCH (s)-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(pr:DataRecord {status: 'ACTIVE'})
  MATCH (pr)-[:CONTAINS_FIELD*0..]->(h)-[:EXPANDS_COPY]->(cr:DataRecord {status: 'ACTIVE'})
  WITH DISTINCT pr, cr
  MERGE (pr)-[r:RELATED_RECORD {type: 'COPY_EXPANSION', via_field: cr.name}]->(cr)
  SET r.confidence = 'high', r.run_id = $run_id
}
CALL {
  WITH s
  MATCH (s)-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(a:DataRecord {status: 'ACTIVE'})-[:REDEFINES]->(b:DataRecord)
  MERGE (a)-[r:RELATED_RECORD {type: 'REDEFINES_ALIAS', via_field: b.name}]->(b)
  SET r.confidence = 'high', r.run_id = $run_id
}
```

### Read the data model, REDEFINES groups and statistics

Send these only after `derive-record-relationships` has returned.

```cypher
// REVFORGE-QUERY: fetch-data-model (read)
// params: system_id
MATCH (s:System {system_id: $system_id})-[:HAS_FILE]->(f:SourceFile)-[:DEFINES_RECORD]->(r:DataRecord {status: 'ACTIVE'})
WHERE r.section IN ['COPYBOOK', 'FILE']
OPTIONAL MATCH (r)-[:CONTAINS_FIELD*1..]->(k:DataField {status: 'ACTIVE', is_group: false, is_condition: false})
WITH f, r, collect(DISTINCT k) AS elems
OPTIONAL MATCH (user:SourceFile)-[:USES_COPYBOOK]->(f)
WITH f, r, elems, collect(DISTINCT user.program_id) AS users
OPTIONAL MATCH (r)-[rel:RELATED_RECORD]->(t:DataRecord)
RETURN r.record_id AS record_id, r.name AS record_name, r.section AS section, f.file_id AS file_id,
       coalesce(f.program_id, f.file_name) AS source,
       [e IN elems WHERE any(sfx IN ['-ID', '-KEY', '-NBR', '-NUM', '-NO', '-CODE', '-CD'] WHERE e.name ENDS WITH sfx) | e.name] AS key_fields,
       size(elems) AS field_count, r.total_bytes AS total_bytes,
       CASE WHEN r.section = 'COPYBOOK' THEN users ELSE [f.program_id] END AS programs_using,
       collect(CASE WHEN rel IS NULL THEN null ELSE {type: rel.type, to_record_id: t.record_id, to_record_name: t.name,
                     via_field: rel.via_field, confidence: rel.confidence} END) AS relationships
ORDER BY record_id
```

`fetch-data-model` returns the entity records with their outgoing
relationships. WORKING-STORAGE records' `FILE_BUFFER` and `COPY_EXPANSION`
relationships are read with the following query.

```cypher
// REVFORGE-QUERY: fetch-other-relationships (read)
// params: system_id
MATCH (s:System {system_id: $system_id})-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(a:DataRecord)
WHERE NOT a.section IN ['COPYBOOK', 'FILE']
MATCH (a)-[rel:RELATED_RECORD]->(b:DataRecord)
RETURN a.record_id AS from_record_id, a.name AS from_record_name, rel.type AS type,
       b.record_id AS to_record_id, b.name AS to_record_name, rel.via_field AS via_field, rel.confidence AS confidence
ORDER BY from_record_id, type, to_record_id
```

```cypher
// REVFORGE-QUERY: fetch-redefines-groups (read)
// params: system_id
MATCH (s:System {system_id: $system_id})-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(:DataRecord)
      -[:CONTAINS_FIELD*0..]->(x)-[:REDEFINES]->(anchor)
WHERE x.status = 'ACTIVE'
WITH anchor, collect(DISTINCT x) AS aliases
RETURN coalesce(anchor.field_id, anchor.record_id) AS storage_anchor, anchor.name AS anchor_name,
       coalesce(anchor.bytes, anchor.total_bytes) AS bytes,
       [a IN aliases | coalesce(a.field_id, a.record_id)] AS aliases,
       [a IN aliases | coalesce(a.bytes, a.total_bytes)] AS alias_bytes,
       any(a IN aliases WHERE coalesce(a.bytes, a.total_bytes) <> coalesce(anchor.bytes, anchor.total_bytes)) AS bytes_mismatch
ORDER BY storage_anchor
```

```cypher
// REVFORGE-QUERY: data-registry-stats (read)
// params: system_id
MATCH (s:System {system_id: $system_id})-[:HAS_FILE]->(f:SourceFile)
OPTIONAL MATCH (f)-[:DEFINES_RECORD]->(r:DataRecord {status: 'ACTIVE'})
WITH s, collect(r) AS recs
CALL { WITH s MATCH (s)-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(:DataRecord {status: 'ACTIVE'})
       -[:CONTAINS_FIELD*1..]->(x:DataField {status: 'ACTIVE'})
       RETURN count(DISTINCT x) AS fields,
              count(DISTINCT CASE WHEN NOT x.is_group AND NOT x.is_condition THEN x END) AS elementary_fields,
              count(DISTINCT CASE WHEN x.is_condition THEN x END) AS conditions,
              count(DISTINCT CASE WHEN x.occurs_max IS NOT NULL THEN x END) AS occurs_tables,
              count(DISTINCT CASE WHEN x.redefines_path IS NOT NULL THEN x END) AS redefines_fields }
CALL { WITH s MATCH (s)-[:HAS_FILE]->(:SourceFile)-[:DEFINES_RECORD]->(:DataRecord)-[rel:RELATED_RECORD]->()
       RETURN count(rel) AS relationships }
CALL { WITH s MATCH (s)-[:HAS_FILE]->(:SourceFile)-[u:USES_COPYBOOK]->() RETURN count(u) AS copy_usages }
RETURN size(recs) AS records,
       size([r IN recs WHERE r.section = 'COPYBOOK']) AS copybook_records,
       size([r IN recs WHERE r.section <> 'COPYBOOK']) AS program_records,
       size([r IN recs WHERE r.section = 'FILE']) AS file_records,
       fields, elementary_fields, conditions, occurs_tables, redefines_fields, relationships, copy_usages
```

### Assembly

`data_artifact.json` is written in three steps.

**1. Write the small sections** with Write. `data_layouts/_catalogue/_head.json`
holds the opening `{`, `meta`, `stats`, `redefines_groups` and `data_model`,
each followed by a comma. `data_model.entities` comes from `fetch-data-model`;
`data_model.relationships` from both relationship queries, numbered `REL-001`,
`REL-002`, … in that order.

**2. Concatenate the fragments** with this basic shell command. It joins the
one-line entries with commas and adds no logic of its own:

```bash
cd "$OUTPUT_DIR/data_layouts/_catalogue" && {
  cat _head.json
  printf '"record_catalogue": ['; cat *.records.jsonl | grep -v '^\s*$' | paste -sd, -; printf '],\n'
  printf '"field_catalogue": [';  cat *.fields.jsonl  | grep -v '^\s*$' | paste -sd, -; printf '],\n'
  printf '"condition_catalogue": ['; cat *.conditions.jsonl | grep -v '^\s*$' | paste -sd, -; printf '],\n'
  printf '"issues": ['; cat *.issues.jsonl | grep -v '^\s*$' | paste -sd, -; printf ']\n}\n'
} > "$OUTPUT_DIR/data_artifact.json"
```

**3. Check the artifact.** Count its catalogue entries with Grep and compare
them with `data-registry-stats`. `record_catalogue` must equal `records`, and
`condition_catalogue` must equal `conditions`. The `field_catalogue` equals
`elementary_fields` plus the elementary 01/77 records. A mismatch is logged as
an `error` and reported.

---

## Output schema — data_artifact.json

```json
{
  "meta": {
    "generated_at": "ISO-8601 timestamp",
    "agent_version": "3_data@1.0",
    "source_artifacts": ["inventory_artifact.json", "parser_artifact.json"],
    "total_records": 187,
    "total_fields": 2341,
    "total_conditions": 312,
    "system_id": "SYS-CARDDEMO-001",
    "system_name": "CARDDEMO",
    "data_run_ids": ["DRUN-20261025T101500Z-12345"]
  },
  "stats": {
    "copybook_records": 31,
    "program_ws_records": 156,
    "redefines_groups": 48,
    "occurs_tables": 23,
    "high_shared_fields": 89,
    "candidate_relationships": 34,
    "unresolved_copy_stubs": 3
  },
  "record_catalogue": [
    {
      "record_id": "REC-CVACT01Y-ACCOUNT-RECORD",
      "record_name": "ACCOUNT-RECORD",
      "source_id": "CVACT01Y",
      "source_type": "copybook",
      "source_file": "app/copy/CVACT01Y.CPY",
      "used_by_programs": ["CBACT01C", "COACT01C", "COACT02C"],
      "total_fields": 24,
      "total_bytes": 300,
      "has_redefines": true,
      "has_occurs": false,
      "field_ids": ["FLD-REC-CVACT01Y-ACCOUNT-RECORD-ACCT-ID"]
    }
  ],
  "field_catalogue": [
    {
      "field_id": "FLD-REC-CVACT01Y-ACCOUNT-RECORD-ACCT-ID",
      "record_id": "REC-CVACT01Y-ACCOUNT-RECORD",
      "field_name": "ACCT-ID",
      "qualified_name": "ACCOUNT-RECORD.ACCT-ID",
      "level": 5,
      "normalized_type": "STRING",
      "length": 11,
      "decimal_places": 0,
      "signed": false,
      "storage_type": "DISPLAY",
      "pic_raw": "X(11)",
      "is_filler": false,
      "is_condition": false,
      "redefines": null,
      "occurs_max": null,
      "source_line": 7,
      "used_by_programs": ["CBACT01C", "COACT01C", "COACT02C"],
      "shared_level": "high_shared"
    }
  ],
  "redefines_groups": [],
  "condition_catalogue": [],
  "data_model": {
    "entities": [
      {
        "entity_id": "ENT-ACCOUNT-RECORD",
        "display_name": "Account record",
        "primary_record": "REC-CVACT01Y-ACCOUNT-RECORD",
        "key_fields": ["ACCT-ID"],
        "field_count": 24,
        "programs_using": ["CBACT01C", "COACT01C", "COACT02C"]
      }
    ],
    "relationships": [
      {
        "relationship_id": "REL-001",
        "type": "SHARED_KEY",
        "from_entity": "ENT-ACCOUNT-RECORD",
        "to_entity": "ENT-CARD-RECORD",
        "via_field": "ACCT-ID",
        "confidence": "high",
        "note": "Both records contain ACCT-ID X(11)"
      },
      {
        "relationship_id": "REL-002",
        "type": "FILE_BUFFER",
        "from_entity": "ENT-ACCT-FILE-FD",
        "to_entity": "ENT-WS-ACCT-BUFFER",
        "confidence": "high",
        "note": "FD ACCT-FILE ↔ WS-ACCT-REC pattern match"
      }
    ]
  },
  "issues": [
    {
      "severity": "warning",
      "type": "unresolved_copy_stub",
      "program": "CBACT01C",
      "copybook": "EXTCOPY1",
      "message": "Copybook EXTCOPY1 not found in registry — stub left unresolved"
    }
  ]
}
```

REVFORGE field notes:
- **The example above shows the reference harness's original name-based IDs.** In REVFORGE
  output, `record_id` / `field_id` are the permanent IDs, and the name-based
  values move to `record_key` / `field_key`, as in the fragment formats above.
- **`data_model.entities`:**
  - `entity_id` is `ENT-` + the Record ID and `primary_record` is the
    Record ID.
  - `display_name` is the record name with its first letter capitalised and
    the rest lowercase, and hyphens replaced by spaces. It is a display label,
    not an interpretation.
  - Each entity also has `section`, `source` and `total_bytes`.
- **`data_model.relationships`:** `from_entity` / `to_entity` are `ENT-` +
  Record ID. Each also has `from_record_id` and `to_record_id`.
- **Statistics:** `meta.total_records`, `total_fields` and `total_conditions`
  and the `stats` counts come from `data-registry-stats`, the REDEFINES groups
  and the issues. `program_ws_records` counts every non-copybook record.
- The order of the keys is: `meta`, `stats`, `redefines_groups`, `data_model`,
  `record_catalogue`, `field_catalogue`, `condition_catalogue`, `issues`.

---

## Error handling

| Condition | Action |
|---|---|
| Layout file for a program not found | Log `error`, skip that program's WS, continue |
| Two records have identical names (different sources) | Append source ID suffix to disambiguate, log `warning` |
| REDEFINES chain is circular | Log `error`, break chain at the cycle point |
| Field qualified name collision after REPLACING | Append `_ALT` suffix, log `warning` |
| Relationship candidate has low field count match | Set `confidence: "low"`, include but flag |
| Condition values cannot be parsed (complex expression) | Record raw text, set `parsed: false`, log `info` |
| A file's data run is not completed | Do not build the artifact; report which files are open or failed |
| Catalogue counts differ from `data-registry-stats` | Log `error` with both counts; report the artifact as inconsistent |
