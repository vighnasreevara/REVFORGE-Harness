# REVFORGE — Agent 6 Quality Audit (before Agent 7)

Date: 2026-10-26. Read-only audit of `output/diagram/` (60 `.mmd` files + `diagrams_artifact.json`).

**What was used:** existing PowerShell, grep and Neo4j **read** queries only.

**What was not changed:** no agent, skill, diagram, JSON artifact, Neo4j data, COBOL source or reference-harness reference. No scripts were saved to the project, and no subagent was used. This report is the only file written.

Labels used for the cause of each limitation:
- **[SRC]** — the COBOL source is missing or outside the repository;
- **[ANL]** — the analysis left it unresolved, or it is only decided at run time;
- **[DSP]** — a display limit from reference-harness: 20 nodes, top 10, splits;
- **[IMP]** — an Agent 6 implementation defect.

---

## 1. Overall assessment

The diagrams **faithfully show the source and the earlier agents' findings**.

- **No fabricated relationships.** Every program call, CICS LINK and COPY edge exists in the inventory. Every edge that cites a statement points to a real statement in the right program, and every PERFORM edge reaches its target. Every file access matches its OPEN mode.
- **Source IDs are correct.** All 1,720 permanent IDs are valid and attached to the right element.
- **Gaps are not hidden.** All 86 unresolved execution paths are visible and traceable. HANDLE CONDITION, recursion and invalid qualifications are drawn as required.

**Defects.** Seven implementation defects, all minor or cosmetic and none blocking (section 8). One is a reference-harness rule gap: 27 copybook-level low-confidence rules appear in no diagram and in no Agent 6 gap record. They remain intact in `rules_artifact.json`.

**Rendering.** Visual rendering is **unverified**: no Mermaid renderer or JavaScript runtime is available, and nothing was installed. Only structural validation was done.

**Decision: READY FOR AGENT 7** (section 10), with the conditions listed there.

## 2. Diagram counts

| Category | Files | Notes |
|---|---|---|
| System component overview | 1 | 20 nodes + an OMITTED summary node (21 drawn), as in the reference harness template |
| Per-program component diagrams | 10 | Top 10 programs by inventory edge count |
| Entity-relationship diagram | 1 | 20 of 65 entities, 4 relationships drawn |
| Sequence diagrams | 2 | INQHIST, DB2RECV (reference-harness selection rule; 22 entry points evaluated) |
| Process flow diagrams | 46 | All 42 programs. UTLVAL00 and UTLMON00 each add a `_part2`; PORTTRAN adds `_part2` and `_part3`. |
| **Total** | **60** | 22 `incomplete: true`, 13 `truncated: true` |

## 3. Mermaid validation

| Check | Result |
|---|---|
| **Rendering with a real Mermaid renderer** | **NOT VERIFIED.** No `node`, `npx`, `mmdc`, `deno`, `bun` or `docker`, and no Mermaid VS Code extension. The only Mermaid code on disk is a bundle inside an unrelated extension's webview, and there is no runtime to execute it. A structural lint is not a render test. |
| Structural lint (60/60 pass) | Checks: the diagram type after the front matter; quote balance; every edge endpoint defined in the same file; every class used has a `classDef`; `subgraph`/`end` balance; sequence participants declared before use and blocks closed; ERD entity, attribute and relationship syntax |
| Drawn diagram vs index entry | All 60 files: the drawn nodes and edges equal the index `node_sources` / `edge_evidence`; each node has a `%% REVFORGE-ID` line; every flowchart `edge_evidence` pair is drawn. One count error, D-4. |
| Risky identifiers | No lowercase `end` node; no lowercase `o`/`x` node after an arrow; no `;` or `#` in sequence text |
| Features that need a recent Mermaid | Front-matter `title` (v10+); `PK, FK` on one ERD attribute (`erd.mmd` line 36); `<-->` edges (3 component files); two empty ERD entity blocks `TSTGEN00_*_RECORD { }` (lines 61–65); Unicode `⚖`/`⚠` inside quoted labels. **These are the most likely render risks.** |
| Labels over the reference harness's 50-character limit | About 34 flow label segments and 9 overview labels. Mostly merged placeholders and summary text kept in full on purpose; cosmetic (D-5). |

## 4. The 22 incomplete diagrams

**Columns:**
- **Cause** uses the labels defined at the top of this report.
- **Kept in JSON?** says where the omitted detail can still be found.
- **Agent 7 can document?** means yes in every row: each diagram's `limitations` / `incomplete_reason` states the gap in plain language.

| # | File | Why incomplete | Cause | Omitted (nodes / edges / paths) | Kept in JSON? |
|---|---|---|---|---|---|
| 1 | `component_overview.mmd` | Node cap; unresolved external DELAY | DSP + ANL | 23 programs and 2 externals in OMITTED; edges PRCSEQ00→ERRPROC, UTLMON00→ILBOABN0, ERRHANDL→CEE3ABD; 15 JCL jobs; file accesses; 99 COPY / SQL_INCLUDE edges | inventory `call_graph`, `jcl_registry`; index `limitations` |
| 2 | `component_PORTTRAN.mmd` | COPY PORTREC is not in the repository | SRC | PORTREC layout; its PORT-* fields have no Record/Field IDs | inventory edge `resolved:false`; index |
| 3 | `erd.mmd` | 20-entity cap; COPY_EXPANSION relationships start from non-entity records | DSP | 45 entities (4 used by 3+ programs); REL-005 to REL-029 not drawn; 2 TSTGEN00 entities have no fields | `data_model`; index `omitted_entities_used_by_3plus`, `omitted_relationships` |
| 4 | `sequence_INQHIST.mmd` | CURSMGR P300/P400 not in source; recursion; runtime handler; partial evidence | SRC + ANL | Fetch/close results and the returns after them; continuation after P999 | CURSMGR / INQHIST logic files `unresolvable_paths`; index |
| 5 | `flow_POSUPDT.mmd` | The source file is 1 byte of whitespace | SRC | Everything (minimal 2-node diagram) | logic `logic_status: empty` |
| 6 | `flow_CURSMGR.mmd` | Source cut off at line 91 (P300/P400 missing) | SRC | Fetch and close paths | logic `unresolvable_paths` (2) |
| 7 | `flow_ERRHANDL.mmd` | CALL CEE3ABD is an external LE service outside the repository | SRC/ANL | Whether 3000-TERMINATE / GOBACK are reached (drawn uncertain) | inventory `resolved:false`; index |
| 8 | `flow_FILEHNDL.mmd` | 2110 / 2310 missing (reached only from dead code); recursive cycle | SRC + ANL | 2 targets; the inner branches of 3 dead paragraphs | logic (2 paths) |
| 9 | `flow_TSTVAL00.mmd` | 7 PERFORM targets missing; 2600–2800 share one placeholder | SRC + DSP | Test execution, metrics, detail writing | logic (7 paths); placeholder `statement_ids` |
| 10 | `flow_TSTGEN00.mmd` | 8 targets missing (2 shared placeholders); 1200/1300 in SUMMARY | SRC + DSP | Record generation and writing | logic (8 paths); placeholder `unresolved_targets` / `statement_ids` |
| 11 | `flow_INQHIST.mmd` | Agent 4 stopped tracing at the recursive PERFORM (STMT-000043) | ANL + DSP | Steps after the recursion; continuation after the runtime ERROR transfer | logic (1 path) |
| 12 | `flow_RPTSTA00.mmd` | 7 targets missing (2310/2320 and 2410–2430 grouped) | SRC + DSP | Accumulation, metrics, report sections; read-loop bodies | logic (7 paths); placeholder `statement_ids` |
| 13 | `flow_DB2HNDL.mmd` | 2310-PROCESS-CURSOR-ROW missing | SRC | Per-row cursor processing | logic (1 path) |
| 14 | `flow_RPTAUD00.mmd` | 7 targets missing | SRC | Reading and summarising audit and error records | logic (7 paths) |
| 15 | `flow_RPTPOS00.mmd` | 5 targets missing | SRC | Transaction-activity and summary sections | logic (5 paths) |
| 16 | `flow_UTLVAL00.mmd` | 8 targets missing (drawn in part 2); split | SRC + DSP | — (continued in part 2) | logic (8 paths) |
| 17 | `flow_UTLVAL00_part2.mmd` | 8 targets missing | SRC | Integrity, cross-reference, format and balance checks | logic |
| 18 | `flow_UTLMON00.mmd` | 1310 missing; external ILBOABN0; split | SRC + DSP | Configuration storage; ILBOABN0 effect | logic (13 paths in total) |
| 19 | `flow_UTLMON00_part2.mmd` | 12 targets missing | SRC | Metric collection, thresholds, logging, alerts | logic |
| 20 | `flow_BCHCTL00.mmd` | 11 targets missing (4 placeholders grouped by performing paragraph) | SRC + DSP | The I/O work of 1000/2000/3000/4000 | logic (11 paths); one `?` edge per missing PERFORM |
| 21 | `flow_UTLMNT00.mmd` | 11 targets missing (4 grouped placeholders) | SRC + DSP | Archive, cleanup, reorganisation, analysis | logic (11 paths); one `?` edge each |
| 22 | `flow_HISTLD00.mmd` | 3 targets are procedure code in copybook DBPROC, not registered for this program; 3100–3400 folded into Terminate | ANL + DSP | DB2 connect / error / disconnect logic; final checkpoint call 3100→2310 | logic (3 paths); Terminate node lists the folded Paragraph IDs |

**Summary by cause:**
- **Missing COBOL source** is the main cause: 15 flows and 2 other diagrams.
- **Unresolved or runtime analysis** applies to the INQHIST recursion, the HISTLD00 copybook procedures, the HANDLE CONDITION continuations, and the FILEHNDL and ERRHANDL behaviour.
- **Display limits** apply to the overview, the ERD, grouped placeholders and splits.
- **No incomplete status was caused by an Agent 6 defect.**

## 5. The 13 shortened diagrams

| Diagram | Mechanism | Collapsed | Rules on collapsed paragraphs | Edges into or out of SUMMARY |
|---|---|---|---|---|
| FLOW-DB2ONLN, DB2RECV, RTNANA00, INQHIST, INQONLN | SUMMARY | 5–6 no-op `EXIT` paragraphs of PERFORM THRU ranges | none | none (standalone note) |
| FLOW-RTNCDE00 | SUMMARY_EXIT | 5 `EXIT` paragraphs | none | 11 edges to the shared exit, matching the THRU ranges |
| FLOW-TSTGEN00 | SUMMARY | 1200-INIT-RANDOM, 1300-INIT-COUNTERS | none | 3 edges (open-check outcomes → init → loop); source-supported |
| FLOW-PRCSEQ00 | SUMMARY | 6 internal paragraphs (1100, 1210, 1300, 2300, 3100, 4200) | none | none; internal IFs and loops are only summarised in labels, and the PERFORMs of 9000 are not drawn (disclosed) |
| FLOW-RCVPRC00 | SUMMARY | 8 internal paragraphs (PAR-0002/04/06/09/12/13/14/18) | none | none; 5 edges skip collapsed paragraphs (D-6) |
| FLOW-HISTLD00 | Folded into the Terminate node | 3100–3400 (PAR-0012 to PAR-0015) | none | — |
| FLOW-UTLVAL00, UTLMON00, PORTTRAN | Split into `_partN` files, no SUMMARY | nothing dropped; continued in the part files | — | — |

Findings:

- **No relationship is lost without disclosure.**
  - Every collapsed paragraph's ID is kept on the SUMMARY node.
  - Every paragraph of all 42 programs is referenced by ID in its program's flow index entries or `.mmd` files: 0 missing.
- **Rule traceability is intact.** No collapsed paragraph carries a business rule.
- **Summary nodes imply no false relationships.**
  - 9 of the 10 SUMMARY nodes are standalone notes or follow real THRU and init flow.
  - In RCVPRC00, five edges jump from a decision straight to a collapsed paragraph's child (1000→1200, 2100→2110, 3000→3100). A Neo4j check confirms each collapsed paragraph really PERFORMs the drawn target, so the shortcuts are valid, though not labelled as shortcuts (D-6).
- **All 196 rule annotations** (113 distinct rules) keep Agent 5's `confidence` and `requires_sme_review`.
  - Flow placement follows reference-harness: confirmed and high inline; medium and low in footnotes with `⚠`, and SME rules marked ` · SME review`.
  - Component diagrams show the reference harness's count badge (`n business rules`, `⚠ n low-confidence`) rather than rule IDs.
  - Sequence diagrams annotate rules as Notes at the decision point, as reference-harness specifies.
- **Is SUMMARY enough?**
  - **Yes** for the EXIT-only collapses (6 diagrams) and the splits (3 diagrams).
  - **For PRCSEQ00 and RCVPRC00**, substantive paragraphs are collapsed. A reference-harness-style detail diagram (`_part2`, same 20-node cap) would show them, and Agent 7 should cite the logic files for those paragraphs. This is optional, and no limit needs to be raised.

## 6. The 86 unresolved execution paths

| Check | Result |
|---|---|
| Shown or documented in the program's flow | **86/86.** Every target name appears in the flow `.mmd` of its program (14 programs). |
| Traceable to the original Statement ID | **86/86.** 77 have their own edge with that `statement_id`. The 9 members of grouped placeholders (RPTSTA00 ×3, TSTGEN00 ×4, TSTVAL00 ×2) are listed in the placeholder's `unresolved_targets` and `statement_ids`. |
| Drawn as confirmed execution | **0.** Missing targets are drawn `unsupported`: dotted `?` edges to `:::unresolved` nodes. All 62 `?` placeholders have no Paragraph ID and no outgoing edges. |
| INQHIST recursive PERFORM (STMT-000043) | Dotted self-edge `uncertain: recursive PERFORM — tracing stopped` (`flow_INQHIST.mmd`); Note in `sequence_INQHIST.mmd`; nothing drawn after it |
| CICS HANDLE CONDITION | 5 transfers, all `uncertain`, dotted and labelled `runtime: on …`, none confirmed: INQHIST ERROR→PAR-0012; INQPORT ERROR→PAR-0010 and NOTFND→PAR-0008; INQONLN ERROR/PGMIDERR/NOTFND→PAR-0010 (COBOL line 40; Agent 4 target ID); and SEQ-INQHIST as an `opt runtime:` block |
| The 7 invalid qualifications | Still unresolved. None of the 5 candidate Field IDs (FIL-0018-FLD-000001/05/08, FIL-0020-FLD-000007/08) appears in any `.mmd` file or index entry. |

## 7. Permanent ID traceability

| Check | Result |
|---|---|
| All IDs exist and are ACTIVE | 1,720 distinct IDs (75 files, 75 paths, 402 paragraphs, 954 statements, 43 records, 171 fields): 0 bad, `consistent: true` |
| Flow and sequence node IDs belong to the diagram's own program | 1,273 checked, 0 from another program (excluding the callee IDs on call nodes) |
| Paragraph-named nodes carry that paragraph's ID | 343 checked, 0 wrong. Two batches name nodes after the paragraph number, two after the ID sequence number; both map correctly. |
| Edges that cite statements | 934 distinct (statement, from, to) triples. **All statements exist.** 669 sit in the from-paragraph; 130 are return edges citing the caller's statement; 88 are sequence edges backed by a real PERFORMS link; 44 belong to sequence participants or summarised and folded nodes, each disclosed. |
| PERFORM edges reach their drawn target | 717 statement→target pairs. 709 match a direct PERFORMS link. The other 8: 5 RCVPRC00 transitive shortcuts (verified); 3 edges into TERMINAL nodes, which carry the main paragraph's ID (PRCSEQ00, RCVPRC00 "close files"; PORTUPDT return after OPEN failure, which Agent 4 flagged) |
| Component nodes vs inventory registry | 90 checked; all match. Program and JCL IDs share names, which is handled correctly. |
| Component edges vs inventory | 84 call/LINK/COPY edges: all exist in `call_graph`; none `resolved:false` shown as confirmed |
| File-access edges | 7 of 7 cite their OPEN statement, and the mode matches (INPUT→reads, I-O→reads/writes, EXTEND→writes). All file statements of the top-10 programs are drawn. |
| ERD Field IDs | 73 of 73 belong to the entity's record (`CONTAINS_FIELD`) and match the attribute name |
| Index schema | reference-harness keys `component_diagrams`, `erd`, `sequence_diagrams`, `process_flow_diagrams` intact. All reference-harness entry fields present on all 60 entries. 60 files ↔ 60 entries, no duplicates. REVFORGE additions are optional only. |
| Neo4j | Unchanged during this audit: read queries only |

**What Agent 7 can rely on:**
- per diagram: `file`, `title`, `description` or `limitations`, `incomplete` / `incomplete_reason`, `truncated`;
- `rule_annotations` with `placement`, `confidence` and `requires_sme_review`;
- `node_sources` and `edge_evidence` with Statement IDs;
- `diagrams_by_file_id`;
- `issues` (57).

Information left out of the visuals remains in `logic_artifact.json` and the logic files (`unresolvable_paths`), `rules_artifact.json`, `inventory_artifact.json` and `data_artifact.json`.

**Tool-contract check of the six Agent 6 runs** (transcripts searched by pattern):
- no Neo4j write and no Python;
- Bash used only for `ls`, `wc`, `date` and `mkdir`;
- no reads under `references/…/output/`.

**Phase 1, which ran as a general-purpose agent:**
- It read `6_diagram_c.agent.md` and `component-mapper/SKILL.md`.
- It used only the allowed tools.
- Its outputs follow the skill. The top 10 match the inventory edge counts; CKPRST's apparent tie comes from two self-loop COPY edges to a same-named copybook, so CURSMGR is correctly 10th.

**No deviation from the intended instructions was found.** Interpretations, all logged in the index:
- The overview degree counts call and LINK edges only.
- The ERD was pruned to 20 entities after the reference harness's filter returned 24.
- the reference harness's "two program boundaries" was read as at least two CALL/LINK edges.

## 8. Defects found

None of these changes a relationship, an ID or a rule flag.

| ID | Type | Severity | Evidence |
|---|---|---|---|
| D-1 | IMP: index consistency | Minor | `rules_annotated` means different things across batches. Batch B2 lists inline rules only (as in the reference harness's template), while B0, B1 and B3 also list footnote rules. 7 entries differ: FLOW-UTLVAL00 (+PART2), FLOW-UTLMON00 (+PART2), FLOW-PORTTRAN (+PART2, +PART3); for example, FLOW-UTLVAL00 has `rules_annotated: []` but `rule_annotations` [BR-095, BR-141]. |
| D-2 | IMP: reference-harness rule ("low rule → `⚠`, do not omit") | Minor | 30 copybook-level low rules, BR-099 to BR-128 (copybooks FIL-0002 to FIL-0020), have no program or paragraph and are annotated in no diagram. **BR-099 to BR-125 (27 rules) are also not mentioned anywhere in `diagrams_artifact.json`**; only BR-126 to BR-128 have an `issues` entry. All 30 are intact in `rules_artifact.json` (`rules_by_file_id`). |
| D-3 | DSP vs reference-harness rule ("unresolved edge: dashed `?`, do not omit") | Minor, disclosed | INQPORT→SQLPOS (SQL_INCLUDE, `resolved:false`) is drawn in no diagram: INQPORT is not a top-10 program, and the overview leaves out include edges. It is disclosed in the index `issues` and `flow_selection_log`. The other 4 unresolved inventory edges are drawn. |
| D-4 | IMP: index count | Cosmetic | FLOW-DB2RECV `node_count: 20`, but 19 nodes are drawn and listed in `node_sources` |
| D-5 | IMP: reference-harness label rule | Cosmetic | About 34 flow label segments and 9 overview labels over 50 characters. The longest is the RPTSTA00 grouped placeholder (93). Placeholders were kept long on purpose so every missing name stays visible. |
| D-6 | IMP: disclosure | Cosmetic | FLOW-RCVPRC00: 5 edges skip the collapsed 1000, 2100 and 3000 paragraphs and go straight to the paragraphs they PERFORM. Verified correct, and SUMMARY lists the collapsed IDs, but the edges carry no "via collapsed paragraph" note. |
| D-7 | IMP: metadata shape | Note | Each grouped-placeholder edge carries only the first Statement ID; the others are on the node (`statement_ids`). The shape is inconsistent but traceable. |
| R-1 | Validation gap | Risk | Mermaid rendering unverified. Most likely failure points: the empty ERD entity blocks, `PK, FK`, front matter (section 3). |

**Not defects** (these are source limitations or deliberate display limits): all 22 incomplete statuses, the 13 truncations, the 2-sequence-diagram outcome, the 6 unclassified program types, and the INQONLN entry-point warning.

## 9. Recommended minimal corrections (optional, non-blocking)

None requires regenerating diagrams or raising limits. Each is a small metadata or markup fix, to be made later only with approval:

1. **D-2:** add one `issues` entry to `diagrams_artifact.json` listing BR-099 to BR-125, saying where the rules live (`rules_artifact.rules_by_file_id`) and that they are not drawn. Optionally add a `⚠ n copybook rules` badge to copybook nodes already drawn (for example TRNREC, FIL-0014 → BR-122/123 in `component_PORTTRAN.mmd`).
2. **D-1:** standardise `rules_annotated` in the 7 entries, or document that consumers should use `rule_annotations[].placement`.
3. **D-4:** set FLOW-DB2RECV `node_count` to 19.
4. **R-1:** before publishing the BRD, render all 60 files with Mermaid v10+ on a machine that has a renderer. If `erd.mmd` fails, drop the two empty `{ }` blocks; the entities are still declared by their relationship lines.
5. **Optional detail diagrams** for PRCSEQ00 and RCVPRC00 (`_part2`, same 20-node cap), if the BRD needs their collapsed internals.

## 10. Final decision

**READY FOR AGENT 7.**

The diagrams contain no fabricated program calls, data relationships or execution paths. All 1,720 permanent IDs are valid and correctly attached. All 86 unresolved paths, the recursion, the 5 runtime HANDLE CONDITION transfers and the 7 invalid qualifications are shown as they should be. Every incomplete or shortened diagram explains its gap, and the detail stays in the upstream JSON.

The defects found (D-1 to D-7) are minor, and none affects accuracy. Agent 7 should:
- take rule placement from `rule_annotations[].placement`, not `rules_annotated`;
- take the 30 copybook-level rules from `rules_artifact.json`;
- describe each incomplete diagram from its `limitations`;
- state that Mermaid rendering has not been verified.

Corrections 1–3 can be made before or after Agent 7. Correction 4 should be done before the BRD is published.
