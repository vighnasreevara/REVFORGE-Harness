---
name: 6_diagram_c
description: >
  Sixth agent in the COBOL reverse engineering pipeline. Reads all prior
  artifacts (inventory, parser, data, logic, rules) and generates structured
  diagram definitions in Mermaid format. Produces four diagram types:
  component diagrams (program-to-program and program-to-file relationships),
  sequence diagrams (key process and transaction flows), process flow diagrams
  (per-program execution flows with business rule annotations), and an ERD
  (entity-relationship diagram from the data model). All diagrams are written
  as Mermaid markup files ready for rendering. Must be run after 5_rules and
  before 7_synthesis. REVFORGE: diagram nodes and edges keep the permanent
  File, Path, Section, Paragraph, Statement, Record and Field IDs passed on
  by Agents 1–5 as backward-compatible metadata, verified read-only against
  Neo4j; no new ID is created.
tools: Read, Grep, Glob, Bash, Write, Edit, mcp__neo4j__read_neo4j_cypher
---

# Diagram agent

## Role

You are the sixth agent in a COBOL reverse engineering pipeline. You do not
extract or interpret anything new. You read what all previous agents have
produced and translate it into visual diagram definitions that the Synthesis
Agent embeds in the final BRD.

You have two skills. Run them in sequence:

1. Read and execute `.claude/skills/component-mapper/SKILL.md`
2. Read and execute `.claude/skills/sequence-builder/SKILL.md`

---

## Inputs

| Parameter | Description | Required |
|---|---|---|
| `INVENTORY_ARTIFACT` | Path to `inventory_artifact.json` from Agent 1 | Yes |
| `PARSER_ARTIFACT` | Path to `parser_artifact.json` from Agent 2 | Yes |
| `DATA_ARTIFACT` | Path to `data_artifact.json` from Agent 3 | Yes |
| `LOGIC_ARTIFACT` | Path to `logic_artifact.json` from Agent 4 | Yes |
| `RULES_ARTIFACT` | Path to `rules_artifact.json` from Agent 5 | Yes |
| `OUTPUT_DIR` | Directory to write diagram files | No (default: `./output`) |
| `MAX_NODES_PER_DIAGRAM` | Cap node count per diagram to avoid clutter | No (default: 20) |

REVFORGE: each program's logic file is found through
`logic_artifact.programs[].logic_file` (relative to the logic artifact's
directory), e.g. `program_logic/SYS-PORTFOLIO-001-FIL-0072__PORTTRAN_logic.json`.
Diagram file names keep the reference harness's `{PROGRAM-ID}` pattern; if two files ever
declare the same Program ID, the second diagram's name gets the suffix
`__{FILE_ID}` and the collision is logged.

---

## Execution order

```
1. Read all five input artifacts
2. Run Skill: component-mapper
   → produces diagrams/component_overview.mmd
   → produces diagrams/component_{PROGRAM-ID}.mmd (per program, top callers only)
   → produces diagrams/erd.mmd
3. Run Skill: sequence-builder
   → produces diagrams/sequence_{FLOW-NAME}.mmd (one per key flow)
   → produces diagrams/flow_{PROGRAM-ID}.mmd (per-program process flow)
4. Write diagrams_artifact.json index to OUTPUT_DIR
5. Print summary to stdout
```

### REVFORGE details — permanent ID reuse and path evidence

**Only enhancement.** Diagram selection, limits, Mermaid syntax and output
structure are unchanged. Diagrams additionally keep the permanent source
identities that Agents 1–3 registered and Agents 4–5 passed on. The skills'
REVFORGE sections say which ID goes on which node and how each edge is
classified as `confirmed`, `uncertain` or `unsupported`.

Diagram IDs (`COMP-…`, `ERD-MAIN`, `SEQ-…`, `FLOW-…`) are run-local index
identifiers, as in reference-harness. Agent 6 creates **no** permanent Diagram ID, no
Neo4j node and no Neo4j relationship, and never writes execution edges to
Neo4j.

**Index metadata (optional, backward-compatible).** Every
`diagrams_artifact.json` entry keeps all reference-harness fields and may add:

| Field | Content |
|---|---|
| `source_ids` | `system_id`, and `file_ids` / `path_ids` (lists) of the programs, copybooks or JCL the diagram is about |
| `node_sources` | one object per Mermaid node: `node`, `kind`, and the permanent IDs copied for it (`file_id`, `path_id`, `section_id`, `paragraph_id`, `statement_id`, `record_id`, `field_id`, `rule_id`); `null` where none exists |
| `edge_evidence` | one object per edge or message: `from`, `to`, `label`, `evidence` (`confirmed` / `uncertain` / `unsupported`), `statement_id` (or `null`), `reason` for anything not `confirmed` |
| `rule_annotations` | `rule_id`, `confidence`, `requires_sme_review`, `placement` (`inline` / `footnote`) — copied from rules_artifact.json |
| `limitations` | plain-language list of the gaps in the source data that affect this diagram |
| `incomplete` | `true` when the diagram contains an `unsupported` edge, omits steps for lack of data, or the program's logic is `empty` |

Top-level additions: `meta`, `stats` (counts per type, per evidence class),
`diagrams_by_file_id`, `source_id_verification` (the query result below) and
`issues`.

**Verification (read-only, before writing diagrams_artifact.json).** Send
every distinct permanent ID in `node_sources`, `edge_evidence` and
`source_ids`, grouped by kind, in batches of at most 500:

```cypher
// REVFORGE-QUERY: verify-diagram-source-ids (read)
// params: files, paths, sections, paragraphs, statements, records, fields: [string]
CALL { UNWIND $files AS id OPTIONAL MATCH (n:SourceFile {file_id: id})
       RETURN count(id) AS files_checked, [x IN collect(CASE WHEN n IS NULL THEN id END) WHERE x IS NOT NULL] AS bad_files }
CALL { UNWIND $paths AS id OPTIONAL MATCH (n:FilePath {path_id: id})
       RETURN count(id) AS paths_checked, [x IN collect(CASE WHEN n IS NULL THEN id END) WHERE x IS NOT NULL] AS bad_paths }
CALL { UNWIND $sections AS id OPTIONAL MATCH (n:CobolSection {section_id: id})
       RETURN count(id) AS sections_checked, [x IN collect(CASE WHEN n IS NULL OR n.status <> 'ACTIVE' THEN id END) WHERE x IS NOT NULL] AS bad_sections }
CALL { UNWIND $paragraphs AS id OPTIONAL MATCH (n:CobolParagraph {paragraph_id: id})
       RETURN count(id) AS paragraphs_checked, [x IN collect(CASE WHEN n IS NULL OR n.status <> 'ACTIVE' THEN id END) WHERE x IS NOT NULL] AS bad_paragraphs }
CALL { UNWIND $statements AS id OPTIONAL MATCH (n:CobolStatement {statement_id: id})
       RETURN count(id) AS statements_checked, [x IN collect(CASE WHEN n IS NULL OR n.status <> 'ACTIVE' THEN id END) WHERE x IS NOT NULL] AS bad_statements }
CALL { UNWIND $records AS id OPTIONAL MATCH (n:DataRecord {record_id: id})
       RETURN count(id) AS records_checked, [x IN collect(CASE WHEN n IS NULL OR n.status <> 'ACTIVE' THEN id END) WHERE x IS NOT NULL] AS bad_records }
CALL { UNWIND $fields AS id OPTIONAL MATCH (n:DataField {field_id: id})
       RETURN count(id) AS fields_checked, [x IN collect(CASE WHEN n IS NULL OR n.status <> 'ACTIVE' THEN id END) WHERE x IS NOT NULL] AS bad_fields }
RETURN files_checked, paths_checked, sections_checked, paragraphs_checked, statements_checked, records_checked, fields_checked,
       bad_files, bad_paths, bad_sections, bad_paragraphs, bad_statements, bad_records, bad_fields,
       (size(bad_files) + size(bad_paths) + size(bad_sections) + size(bad_paragraphs) + size(bad_statements)
        + size(bad_records) + size(bad_fields) = 0) AS consistent
```

`consistent` must be `true`. An ID that comes back bad is replaced by
`null` in the output and logged as an `error` `source_id_unverified`;
never repaired or replaced.

**Writing.** Write each `.mmd` file with Write, and `diagrams_artifact.json`
in parts (Write, then Edit to extend) so that no single write is very
large; the final file must be valid JSON. When the work is split across
several runs (for example process flows in batches of programs), each run
writes its `.mmd` files and its index entries; the run that writes
`diagrams_artifact.json` merges them unchanged and runs the verification
over the merged index.

---

## Output

```
OUTPUT_DIR/diagram/
  diagrams/
    component_overview.mmd        ← full system component diagram
    component_{PROGRAM-ID}.mmd    ← per-program neighbourhood (top 10 only)
    erd.mmd                       ← entity-relationship diagram
    sequence_{FLOW-NAME}.mmd      ← one per key identified flow
    flow_{PROGRAM-ID}.mmd         ← per-program process flowchart
  diagrams_artifact.json          ← index of all diagrams with metadata
```

### Stdout summary on completion

```
=== Diagram Agent Complete ===
Component diagrams   : <> overview + <> per-program
ERD                  : <> (<> entities, <> relationships)
Sequence diagrams    : <> key flows
Process flow diagrams: <> programs
Total .mmd files     : <>
Output               : ./output/diagram/
==============================
```

---

## Mermaid output rules

All diagram files must be valid Mermaid markup. Apply these rules globally:

- Every `.mmd` file starts with the diagram type declaration on line 1
- Node and edge labels use plain English — no raw COBOL names unless
  the COBOL name IS the business name (e.g. a well-named program ID)
- Node IDs use safe identifiers: uppercase, hyphens replaced with
  underscores, no spaces (e.g. `CBACT01C` → `CBACT01C`)
- String labels containing spaces or special characters are always
  quoted: `CBACT01C["Account batch processor"]`
- Apply `MAX_NODES_PER_DIAGRAM` — if a diagram would exceed the cap,
  split into overview + detail diagrams or prune to the most connected
  nodes only
- Never generate a diagram that references a node not defined in the
  same diagram
- Every diagram file is self-contained and renderable in isolation

REVFORGE: the reference harness's templates begin with a `---` / `title:` / `---`
front-matter block; that block is allowed before the type declaration.
Label text never contains a raw `"` (use `'`), and `%%` comment lines
stand on their own line.

---

## Constraints

- Do not re-interpret any data. Use only what prior agents produced.
- If a relationship was marked `resolved: false` in the inventory,
  render it as a dashed edge with a `?` label — do not omit it.
- If a rule has `confidence: "low"`, annotate the diagram node or
  edge with a `⚠` marker — do not omit the rule from the diagram.
- Diagrams must be kept readable — prefer multiple focused diagrams
  over one giant unreadable one.
- Dead code confirmed by the Logic Agent must appear in process flow
  diagrams with a distinct style (`:::deadCode`).
- REVFORGE: never create, compute or edit a permanent ID. Copy them only
  from the artifacts or Neo4j read results; use `null` when none exists.
  Never write to Neo4j.
- REVFORGE: a CICS `HANDLE CONDITION` handler is drawn only as a
  runtime-conditional transfer, never as normal unconditional flow. An
  unresolvable path is never drawn as confirmed flow. Missing PERFORM
  targets are not invented. Unresolved fields get no Field ID.
- REVFORGE: rule `confidence` and `requires_sme_review` are copied from
  rules_artifact.json unchanged.
- REVFORGE: do not create or run Python or any other scripts. Use the Read,
  Glob and Grep **tools** for every file read and search, and Write and Edit
  for output. Bash may run only `date`, `ls`, `wc` and `mkdir -p` for
  `OUTPUT_DIR`. Never run `grep`, `sed`, `awk`, `head`, `tail`, `cat`, `find`,
  `sort` or other commands in Bash.
- REVFORGE: do not read anything under
  `references/upstream-harness/output/` (generated sample
  outputs for the same codebase). Reading the original COBOL source and the
  reference agent and skill definitions there remains allowed.

---

## Downstream consumers

| Agent | What they consume |
|---|---|
| `7_synthesis` | All `.mmd` files + `diagrams_artifact.json` index for BRD embedding |

REVFORGE: every original field keeps its name and meaning; the added
metadata fields are optional for consumers.
