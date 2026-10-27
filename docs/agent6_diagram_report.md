# REVFORGE — Agent 6 (6_diagram_c) implementation and run report

Date: 2026-10-26. Inputs: the corrected Agent 1–5 artifacts (see `docs/pre_agent6_corrections_report.md`).
Agent 7 was not started. Nothing was committed (the project root is not a git repository).

## 1. What was implemented

| File | Derived from (reference-harness f0c47e0) | REVFORGE change |
|---|---|---|
| `.claude/agents/6_diagram_c.agent.md` | same path | Tools Read/Grep/Glob/Bash/Write/Edit/Neo4j **read**. Optional, backward-compatible index metadata. Read-only query `verify-diagram-source-ids`. Evidence classes. The same script and path restrictions as Agent 5. |
| `.claude/skills/component-mapper/SKILL.md` | same path | Appended REVFORGE section: File/Path/Record/Field IDs on nodes; program type taken from the Agent 4 `entry_type` when inventory and parser say `unknown`; edge evidence; how to render `COPY_EXPANSION` |
| `.claude/skills/sequence-builder/SKILL.md` | same path | Appended REVFORGE section: Paragraph/Section/Statement IDs; how confirmed, uncertain and unsupported paths are drawn; HANDLE CONDITION, recursion and missing-target rules; rule confidence and SME flags |

the reference harness's skill names, skill order, diagram types, selection rules, limits (20 nodes, top 10, at most 8 flows, 30 messages), Mermaid syntax and output structure are kept unchanged.

- **Metadata in the `.mmd` files:** Mermaid `%%` comments only, which renderers ignore.
- **Metadata in `diagrams_artifact.json`:** optional fields only — `source_ids`, `node_sources`, `edge_evidence`, `rule_annotations`, `limitations` and `incomplete`.
- **Rows added to `THIRD_PARTY_NOTICES.md`:** 3.

## 2. How it was run

1. **component-mapper** produced the overview, the 10 per-program neighbourhood diagrams and the ERD.
2. **sequence-builder** ran next as five parallel runs: the sequence diagrams, then the process flows in four batches of programs. The logic files total 2.3 MB, too much for one run.
3. **Index:** the six index parts were merged into `output/diagram/diagrams_artifact.json` **unchanged**. One read-only ID check was then run over the merged index.

The `6_diagram_c` type was not yet registered when phase 1 started. Phase 1 therefore ran as a general-purpose agent bound by the `6_diagram_c` definition and its tool list. Phase 2 ran as `6_diagram_c`.

## 3. Diagrams generated (60 `.mmd` files)

| reference-harness type | Count | Files |
|---|---|---|
| System component overview | 1 | `component_overview.mmd` (top 20 of 42 programs by connectivity + an OMITTED summary node) |
| Per-program component diagrams | 10 | `component_{ERRPROC, INQHIST, INQONLN, HISTLD00, DB2ERR, DB2RECV, DB2STAT, PORTTRAN, RCVPRC00, CURSMGR}.mmd` |
| Entity-relationship diagram | 1 | `erd.mmd` (20 of 65 entities, 4 relationships) |
| Sequence diagrams | 2 | `sequence_INQHIST.mmd`, `sequence_DB2RECV.mmd` |
| Internal process flow diagrams | 46 files / 42 programs | `flow_{PROGRAM}.mmd` for all 42 programs. UTLVAL00 and UTLMON00 add a `_part2` file and PORTTRAN adds `_part2` and `_part3`, to stay within the 20-node cap. |

**Why only 2 sequence diagrams.** These are the outcome of the reference harness's selection rule; nothing was dropped to save effort. A flow must start at a JCL step or a program with an incoming CICS LINK/XCTL, and must cross at least two program boundaries.

- **13 of the 15 JCL jobs** run programs that make no cross-program CALL.
- **PORTDEF** runs only IDCAMS.
- **UTLMON00's** only CALL is unresolved (ILBOABN0).
- **5 of the 7 CICS entry points** have no onward call.
- **INQONLN**, the top of the online inquiry chain, has no incoming LINK and no JCL step, so the rule does not count it as an entry point. This is logged as a warning in `flow_selection_log`.

## 4. Edge evidence (all diagrams)

| Evidence | Edges / messages | Meaning |
|---|---|---|
| confirmed | 949 | Resolved PERFORM / CALL / LINK / inventory edge, or an outcome of a condition with complete evidence |
| uncertain | 166 | Runtime HANDLE CONDITION handlers, recursion, outcomes of conditions with partial evidence, and the low-confidence ERD relationship |
| unsupported | 83 | PERFORM targets not in the source, and inventory edges with `resolved: false`. Each is drawn as a dotted `?` edge to a `? … — not in source` placeholder (62 placeholder nodes). |

### Source limitations, and how each is shown

- **CICS HANDLE CONDITION.** There are 5 handler transfers, all `uncertain` and labelled `runtime:`, and none is drawn as normal flow:
  - INQHIST: ERROR → P999 (PAR-0012);
  - INQPORT: ERROR → P999 (PAR-0010) and NOTFND → P900 (PAR-0008);
  - INQONLN: ERROR / PGMIDERR / NOTFND → P900;
  - SEQ-INQHIST: an `opt runtime:` block.
- **INQHIST's recursive PERFORM P150.** Drawn as a dotted self-edge `uncertain: recursive PERFORM — tracing stopped` in the flow, and as a Note in the sequence diagram. Nothing is drawn after it. FILEHNDL's recursive cycle on 9100/9200 is drawn the same way.
- **86 unresolvable paths** (Agent 4) in 14 programs. All 86 are named in their program's flow diagram, checked by name or paragraph number.
  - Where the 20-node cap applied, several missing targets share one placeholder: RPTSTA00, TSTGEN00, TSTVAL00, BCHCTL00 and UTLMNT00.
  - No missing target got a node of its own, a Paragraph ID or an outgoing edge. All 62 placeholders carry no Paragraph or Section ID.
- **The seven invalid qualifications** (QUALIFIER_HOLDS_LEVEL01_COPY): no diagram node, edge or index entry uses any of the five candidate Field IDs (FIL-0018-FLD-000001/05/08, FIL-0020-FLD-000007/08). The names are shown without a Field ID.
- **Other unresolved names** have no Field ID: SQLCODE, WS-SUB, WS-DB2-TOKEN, RECV-CURSOR and the undeclared INQPORT keys.
- **Rules.** 196 annotations covering 113 distinct rules. Every `confidence` and `requires_sme_review` value matches `rules_artifact.json`.
  - Placement follows reference-harness: confirmed and high inline; medium and low in footnotes.
  - Low rules carry `⚠`, and SME-flagged rules carry ` · SME review`.
- **Dead code.** The 6 paragraphs Agent 4 confirmed as dead use `:::deadCode`: PORTMSTR 1, PORTTRAN 1, FILEHNDL 3 and PROGNAME 1. PORTTRAN 2200 appears in two split files.
- **Program type.** Inventory and parser record `unknown` for all 42 programs, so the type comes from the Agent 4 `entry_type`: 28 batch, 8 online and 6 unclassified (AUDPROC, DB2CMT, DB2ERR, DB2STAT, PORTTRAN and POSUPDT).

**Incomplete diagrams (22).** `incomplete: true` means the diagram contains an unsupported edge, omits steps for lack of data, or the program has no logic.

| Group | Diagrams |
|---|---|
| Component diagrams and ERD | COMP-OVERVIEW, COMP-PORTTRAN, ERD-MAIN |
| Sequence diagram | SEQ-INQHIST |
| Process flows | FLOW-POSUPDT (empty logic, minimal 2-node diagram), CURSMGR, ERRHANDL, FILEHNDL, TSTVAL00, TSTGEN00, INQHIST, RPTSTA00, DB2HNDL, RPTAUD00, RPTPOS00, UTLVAL00 + PART2, UTLMON00 + PART2, BCHCTL00, UTLMNT00, HISTLD00 |

**Truncated diagrams (13).** the reference harness's SUMMARY node was used. The collapsed paragraphs keep their IDs in `node_sources`.

**Other known gaps** (detailed in `issues`: 10 warnings, 47 info):
- The overview's 20-node cap leaves out the JCL jobs and three unresolved calls (UTLMON00→ILBOABN0, ERRHANDL→CEE3ABD, INQPORT→SQLPOS). Those calls are drawn in the programs' flow diagrams.
- 25 COPY_EXPANSION relationships start from records that are not data_model entities, so they are listed in the index but not drawn.
- Two TSTGEN00 ERD entities have no fields.
- The `PK, FK` attribute syntax needs Mermaid v10 or later.

## 5. Validation

| Check | Result |
|---|---|
| Mermaid syntax | **Structural lint, 60/60 pass.** It checks the type declaration after the front matter, that every edge's nodes are defined, that every class used has a classDef, subgraph/block/`end` balance, sequence participants, ERD entity/attribute/relationship syntax, and quote balance. **No Mermaid parser or renderer was available** (no Node.js). Rendering in Mermaid v10+ is still to be confirmed. |
| Index coverage | 60 index entries ↔ 60 files, each file indexed exactly once; 60 distinct diagram IDs; all 42 programs have a process flow diagram |
| Permanent IDs | 1,720 distinct IDs in the merged index were verified in one read-only query: 75 files, 75 paths, 402 paragraphs, 954 statements, 43 records and 171 fields. 0 bad, `consistent: true`. Each of the six runs also passed its own check. |
| Source-supported only | 0 runtime or HANDLE CONDITION edges marked confirmed; 0 placeholders with a Paragraph ID; 0 invalid-qualification candidate IDs used; rule flags 196/196 match |
| JSON compatibility | `diagrams_artifact.json` parses. It keeps the reference harness's keys `component_diagrams`, `erd`, `sequence_diagrams` and `process_flow_diagrams`, and each entry's reference-harness fields. Additions are optional, either new top-level keys (`meta`, `stats`, `program_types`, `flow_selection_log`, `diagrams_by_file_id`, `source_id_verification`, `issues`) or new entry fields. |
| Neo4j unchanged | 4,957 nodes and 5,929 relationships. The newest `last_seen_at` is still 2026-10-25T17:08:27.984Z. Only read queries were run. |
| Restrictions | No file of Agents 1–5, their outputs or other skills changed after Agent 6 started. The reference repository is clean at f0c47e0. No `.py` files. No Agent 7 or 8 files. |
