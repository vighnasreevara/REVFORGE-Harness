# Agent 2 — Parser Agent with permanent Section, Paragraph and Statement IDs

**Agent:** `2_parser_c` · **Skills:** `cobol-ast-parser` → `section-mapper` (names and order unchanged)
**Workflow:** Agent 1 inventory → cobol-ast-parser → section-mapper → `raw_structure/` + `parser_artifact.json`

## 1. Design

**Who does what:**

- **Claude (LLM)** reads the COBOL and does all source analysis: divisions, sections, paragraphs, data entries, every executable statement with its nesting, and control flow.
- **Neo4j** owns identity:
  - it allocates every Section, Paragraph and Statement ID from per-file counters;
  - it matches statements to their registered predecessors **deterministically, inside one transaction**;
  - it enforces uniqueness.
- Claude never picks or computes an ID, and no Python or parser engine is involved.

### Identity keys (never line numbers)

| ID | Format | Identity |
|---|---|---|
| Section | `{FILE_ID}-SEC-NNNN` | File ID + division + section name (`#n` suffix for duplicate declarations, flagged `REVIEW_REQUIRED`) |
| Paragraph | `{FILE_ID}-PAR-NNNN` | File ID + parent Section ID (or `PROGRAM`) + paragraph name |
| Statement | `{FILE_ID}-STMT-NNNNNN` | Evidence-based match inside the scope *paragraph + parent statement + branch* |

### Statement matching (`register-statements`, steps in order)

| Step | Evidence | Result |
|---|---|---|
| A | Same normalized text and same previous/next sibling text, unique on both sides | reuse — `UNCHANGED` |
| B | Same normalized text, unique on both sides | reuse — `MATCHED_BY_TEXT` |
| C | Identical duplicates, same count on both sides | reuse in order — `MATCHED_BY_ORDER` |
| D | Text changed; both neighbours matched; exactly one unmatched old statement of the same type in the gap | reuse — `MODIFIED` |
| E | Same text as unmatched old statements but undecidable | **new** ID, `REVIEW_REQUIRED`, `REVIEW_CANDIDATE` links to every candidate |
| — | No evidence | new ID — `NEW` |

**Normalized text** is the statement's own text with whitespace collapsed and one trailing period removed. For compound statements it is the **header only**, so a change inside an IF body does not change the IF.

**Lifecycle rules:**
- Statements not seen in a completed run become `INACTIVE`. Numbers are never reused.
- A statement moved to another paragraph or parent gets a new ID, because its scope differs.

## 2. Files

| File | Change |
|---|---|
| `.claude/agents/2_parser_c.agent.md` | From the reference. Additions: Agent 1 identity inputs, `MODE` (`full`/`parse`/`manifest`) and `PARSE_RUN_ID`, prerequisites, collision-free output `raw_structure/{FILE_ID}__{PROGRAM_ID}.json`, the overwrite guard, a one-line `program_summary`, the no-scripts rule, and the tools Write, Edit and Neo4j MCP |
| `.claude/skills/cobol-ast-parser/SKILL.md` | From the reference; the reference harness's phases 1–4 kept. Additions: format detection (fixed/free, misplaced `*`), Area-A paragraph rule, Phase 5 (statement extraction: types, branches, text rules, fields), Phase 6 (identity registration: 7 queries plus admin init), the output schema with IDs, error rows |
| `.claude/skills/section-mapper/SKILL.md` | From the reference; all edge types and the CFG schema kept. Additions: edges from the statement list with grep as cross-check, `*_id` fields on nodes and edges, `register-control-flow`, `finalize-parse-run`, `verify-parse-integrity`, manifest fields, the dead-code rule clarified |
| `THIRD_PARTY_NOTICES.md` | Attribution rows for the 3 derived files |
| This document | — |

Agent 1, Agents 3–8, `references/` and all COBOL sources are unchanged.

## 3. Neo4j model

```
(:SourceFile)-[:HAS_PARSER_STATE]->(:ParserSequence {file_id, sec_seq, par_seq, stmt_seq, active_run_id, last_completed_run_id})
(:SourceFile)-[:HAS_SECTION]->(:CobolSection {section_id, identity_key, division, name, start_line, end_line, status, review_status})
(:SourceFile|CobolSection)-[:HAS_PARAGRAPH]->(:CobolParagraph {paragraph_id, identity_key, name, section_id, start_line, end_line, status, review_status})
(:CobolParagraph)-[:CONTAINS_STATEMENT]->(:CobolStatement)                    // top-level statements
(:CobolStatement)-[:CONTAINS_STATEMENT {branch}]->(:CobolStatement)           // nesting (THEN, ELSE, WHEN …, BODY, AT END …)
(:CobolStatement)-[:PERFORMS {edge_type, role}]->(:CobolParagraph|CobolSection)
(:CobolStatement)-[:TRANSFERS_CONTROL_TO {edge_type, role}]->(:CobolParagraph) // GO TO, GO TO DEPENDING, ALTER
(:CobolStatement)-[:REVIEW_CANDIDATE]->(:CobolStatement)
CobolStatement: statement_id, statement_number, paragraph_id, parent_statement_id, branch, scope_key, depth,
                sibling_index, statement_type, source_text, normalized_text, prev_text, next_text,
                start_line, end_line, extraction_status, status, review_status, last_match, last_run_id
```

**Constraints** (6, all prefixed `revforge_parser_`):
- `state_file`
- `section_id`, `section_key`
- `paragraph_id`, `paragraph_key`
- `statement_id`

**Indexes:** `statement_scope` and `statement_run`.

Agent 1's nodes and constraints are untouched. Agent 2 only adds relationships from `SourceFile`.

## 4. Concurrency and safety

- **Per-file lock.** Every write first sets a property on the file's `ParserSequence` node. That takes an exclusive lock until commit, so registrations for one file are serialised; different files run in parallel.
- **Atomic matching and allocation.** Matching and numbering run inside one statement, so one transaction (MCP `execute_query`).
- **Uniqueness constraints** reject duplicates even if a query were wrong.
- **Idempotent within a run.** Statements already registered in the run (by `local_id`) are skipped, so a resent batch never duplicates.
- **Per-file parse lock (added in the readiness review).**
  - Every execution has a unique `worker_id`.
  - `begin-parse-run` takes the database lock **before** checking ownership. It grants the file only when the file is free, or the same run and worker are resuming, or `takeover_run_id` names the holder.
  - Every write checks `run_id` + `worker_id`. A refused run changes nothing and stops with `parse_run_locked`.
  - A stale lock (a crashed run) is taken over only when the operator passes `PARSE_TAKEOVER_RUN_ID` for that exact run. The takeover is recorded in `taken_over_run_id`.
  - Simultaneous parsing of the same File ID is therefore **prevented**, not merged. Different files still parse in parallel.

## 5. Verification results (2026-10-22 … 2026-10-24)

### Query tests (`cypher-shell`, queries extracted verbatim from the skills)

| Test | Result |
|---|---|
| Nesting 3 levels; children find parents across depth levels | ✓ |
| Identical repeat run | all `UNCHANGED`, same IDs ✓ |
| Whitespace / re-wrap / line shifts | same IDs ✓ |
| Inserted statement | new ID; neighbours keep theirs ✓ |
| Modified nested statement (`'BIG'` → `'HUGE'`) | same ID, `MODIFIED` ✓ |
| Statement moved to another paragraph | new ID; old one `INACTIVE` ✓ |
| Ambiguous duplicate removal | new ID, `REVIEW_REQUIRED`, 2 candidates ✓ |
| 10 parallel batches × 20 statements, one file | 200 unique IDs, no gaps ✓ |
| Resend after a partially registered batch (after the fix) | only the missing statement added; a second resend adds 0 ✓ |
| Regression of the full scenario after the fix | identical match results ✓ |

### End-to-end on the reference harness's sample (42 programs, Claude Code LLM workflow, Neo4j MCP)

| | Run 1 (`…ACC1`) | Run 2 (`…ACC2`) |
|---|---|---|
| Runner | general-purpose subagents following `2_parser_c.agent.md` (the agent type was not yet registered) | the registered `2_parser_c` agent |
| Programs completed / integrity consistent | 42 / 42 | 42 / 42 |
| Statements (active) | 1,937 | 1,936 |
| Paragraphs / sections | 401 / 140 | 402 / 140 |
| Control-flow relationships | 465 | 466 |
| New statement IDs | 1,850 new + 87 reused from the pilot run | **0** |
| Statement IDs identical in both runs (same paragraph, parent, branch, type, text) | — | **1,936 of 1,937** |
| Paragraph IDs identical | — | **401 of 401** |

The one difference is CURSMGR line 91, `P200-EXIT` with no period in a truncated file:
- Run 1 recorded it as an `UNKNOWN` / `UNCERTAIN` statement. That statement is now `INACTIVE`, and its ID is never reused.
- Run 2 recorded it as a paragraph (new PAR-0005).

The skill now states this rule explicitly, so later runs are deterministic.

### Fixture tests (`SYS-PARSERTEST-001`, registered by Agent 1; real `2_parser_c` agent)

| Version | Result |
|---|---|
| v1 baseline | 17 statements, all registered, nesting correct |
| v2 +17 blank lines | 17/17 same IDs ✓ |
| v3 two inserted statements (top level and nested) | 17 kept their IDs; 2 new (000018, 000019) ✓ |
| v4 `M,S,M,S,M` → `M,S,M` | surviving `S` gets a new ID `REVIEW_REQUIRED` with both candidates; old ones `INACTIVE` + flagged ✓ |

**Other checks:**
- Agent 1 registry re-verified: 83 files, consistent ✓
- Reference repository: `git status` clean ✓
- No Python files ✓
- `raw_structure` JSON: 42/42 valid, every ID present, parents resolve ✓
- JSON ↔ Neo4j: exact match ✓

## 5a. Readiness review (2026-10-24)

| # | Check | Result |
|---|---|---|
| 1 | `parser_artifact.json` and 42 `raw_structure` files generated, valid, consistent with the inventory | PASS |
| 2 | 140 sections, 402 paragraphs and 1,936 active statements linked to their Agent 1 File IDs | PASS: 0 unlinked, 0 unreachable, 0 prefix mismatches |
| 3 | 87 unresolved PERFORM targets investigated | PASS: 0 parser mistakes. Paragraph extraction matches the source exactly (391 named + 11 unnamed). The targets break down as follows: 79 defined nowhere; 5 exist only as paragraphs of *other* programs (BCHCTL00, CURSMGR), which a PERFORM cannot reach; 3 (HISTLD00) exist only in `DBPROC.cpy`, which HISTLD00 copies into WORKING-STORAGE (line 45), so its procedure paragraphs cannot be performed. All 87 are genuine source defects |
| 4 | The 13 partial programs are exactly those with unresolved targets; each target is named in that program's issues | PASS: 87/87 recorded; manifest and file statuses agree |
| 5 | No duplicate IDs after the pilot, 2 full runs and resumed runs | PASS: 0 duplicate IDs, 0 doubly-occupied statement positions, 0 counter gaps |
| 6 | Same-File-ID parsing prevented | PASS after the fix. Query tests: 10 simultaneous begins gave 1 owner, and 9 writes were no-ops. End-to-end with the real agent: a lock held by a crashed run was refused (`parse_run_locked`); an explicit takeover then reused all 17 IDs |
| 7 | Data definitions available to Agent 3, including partial programs | PASS: WORKING-STORAGE/LINKAGE items match the source in 42/42 programs; every DATA DIVISION COPY / SQL INCLUDE recorded as a stub; FD headers present (layouts left to Agent 3 by design) |
| 8 | reference-harness reference unchanged | PASS: `git status` clean, HEAD `f0c47e0` |

## 6. Limitations and open items

1. **Extraction is LLM judgement.** Statement boundaries come from Claude reading the source, guided by explicit rules. On well-formed code, a full re-run reproduced 99.95% of IDs (1,936/1,937). Malformed source can be read differently in different runs until a rule covers it (the CURSMGR case, now covered). Any difference shows up as `NEW`/`INACTIVE`/`REVIEW_REQUIRED`, never as a silently wrong ID.
2. **Instruction-level rules.** The parse lock is enforced by the database. "Send a read only after its write has returned" is still an instruction, not something the database enforces. Two agents broke it once each and corrected themselves. Also, MCP 0.6.0 cannot run schema commands, so the 6 parser constraints need a one-time admin setup.
3. **Statement IDs are not in source order.** They are allocated level by level. Use `start_line`, `sibling_index` or `local_id` for order.
4. **Statement text is whitespace-normalised for matching.** Spacing inside literals is therefore not distinguished.
5. **Not handled:** nested or batch programs in one file (only the first is parsed, and a warning is logged); DECLARATIVES; copybook statements in the PROCEDURE DIVISION (they stay stubs). `EXEC CICS HANDLE CONDITION` targets and `EXIT PERFORM` produce no edges.
6. **Not all 21 PERFORM_INLINE edges are in Neo4j.** By design, inline loops are represented by `CONTAINS_STATEMENT {branch: 'BODY'}`.
7. **Defects in the source code, reported as found:**
   - 70+ PERFORM targets are not declared in the sample (e.g. BCHCTL00, UTLMNT00, TSTGEN00); 13 programs are `partial` because of them;
   - `CURSMGR` is truncated;
   - `POSUPDT` is empty.
8. **Two statements with placeholder neighbour context (TSTVAL00).** Their neighbour context came from an early partial batch. They re-matched `MATCHED_BY_TEXT` in Run 2 with the same IDs.
9. **Run-1 runner.** Run 1 used general-purpose subagents following the agent definition, because the `2_parser_c` type loads only at session start. Run 2 and all fixture runs used the registered agent.
