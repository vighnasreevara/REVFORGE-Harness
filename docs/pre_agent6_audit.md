# Pre-Agent 6 audit

**Scope:** a read-only audit of the 192 unmatched ID references and the 88 unresolvable execution paths carried by Agents 4 and 5, and of Agent 5's tool use.
**Inputs:** the Agent 2–5 JSON artifacts in `output/`, the COBOL source in `references/upstream-harness/src`, Neo4j (read-only MCP queries only) and the Agent 5 run log.
**Changes made:** none. No agent, skill, artifact, source file, permanent ID or Neo4j data was modified.

## Summary

| Question | Answer |
|---|---|
| Invalid permanent IDs | **0.** All 3,189 distinct IDs in the Agent 4 logic files and all 1,131 in the Agent 5 rule files exist exactly once in Neo4j; every statement, paragraph, record and field among them is ACTIVE |
| Matched IDs point to the right element | **Yes.** Agent 4: 1,005 step, branch and loop references match the statement's paragraph and line range; 2,047 field references name the registered field. Agent 5: 260 statement references match paragraph, file and line; 509 field references (379 checked against the data artifact plus 130 against Neo4j) name the registered field |
| 192 unmatched references | 80 missing field definitions, 85 missing paragraphs, 3 ambiguous, **7 existing identities missed by Agent 4**, 17 other verified causes (16 precompiler fields, 1 index name) |
| 88 unresolvable paths | 85 missing target paragraphs (source), 1 recursion correctly stopped, **2 CICS HANDLE CONDITION targets that exist** (Agent 2 limitation, handled inconsistently by Agent 4) |
| Agent 5 preserved uncertainty | **Yes.** Every condition that encloses an unresolvable path is marked `evidence: "partial"`; no rule built on one is above `medium` or lacks `requires_sme_review` |
| Agent 5 tool compliance | Exceeded its instruction-level Bash allow-list with **read-only** commands; it also read the reference harness's sample rules output. **No** source file, upstream artifact or Neo4j data was modified, and no rule was copied |
| 143 rules trustworthy within stated confidence | **Yes** |
| Agent 6 can proceed | **Yes**, with the three non-blocking Agent 4 corrections below proposed for review |

## Task 1 — the 192 unmatched ID references

The 192 are the sum of `unresolved_ids` in the 42 Agent 4 program summaries: **107 field names** (104 `UNRESOLVED`, 3 `AMBIGUOUS`, counted once per program and name) and **85 paragraph targets**. They are unresolved references: every one carries `target_id: null`, and none is an invalid ID.

Each field name was looked up in Neo4j three ways (read-only):
1. among the ACTIVE records and fields in the program's data scope (its own records plus the copybooks it uses), ignoring the qualifier;
2. through the qualifying record's `EXPANDS_COPY` link;
3. anywhere in the system.

Each paragraph target was looked up in the program and in all other programs.

### Category counts

| Category | Count | Meaning |
|---|---|---|
| 1. Missing source definition | **165** | 80 field names with no definition in the program's scope; 85 PERFORM targets with no paragraph in the program |
| 2. Ambiguous source identity | **3** | The name has two definitions in scope; correctly left `null` with both candidates |
| 3. Existing Neo4j identity not matched by the agent | **7** | The field exists and resolves uniquely through the qualifying record's copy expansion |
| 4. Other verified cause | **17** | 16 precompiler-supplied DB2 fields (`SQLCODE` ×14, `SQLERRMC` ×2); 1 `INDEXED BY` index name (`WS-PROC-IX`), which is not a data item and has no Field ID by design |
| **Total** | **192** | |

### Per program

| Program | Missing field | Missing paragraph | Ambiguous | Agent miss | Precompiler | Index name | Total |
|---|---|---|---|---|---|---|---|
| BCHCTL00 | | 11 | | | | | 11 |
| CKPRST | 4 | | | | | | 4 |
| CURSMGR | | 2 | | | 1 | | 3 |
| DB2CMT | | | | | 1 | | 1 |
| DB2CONN | | | | | 1 | | 1 |
| DB2ERR | | | | | 1 | | 1 |
| DB2HNDL | | 1 | | | 2 | | 3 |
| DB2ONLN | | | | | 2 | | 2 |
| DB2RECV | | | 1 | 3 | 1 | | 5 |
| DB2STAT | | | | | 1 | | 1 |
| ERRHNDL | | | | | 1 | | 1 |
| FILEHNDL | | 2 | | | | | 2 |
| HISTLD00 | 15 | 3 | | | 1 | | 19 |
| INQHIST | 1 | | | 2 | 1 | | 4 |
| INQONLN | 2 | | | | | | 2 |
| INQPORT | 2 | | | 2 | | | 4 |
| PORTMSTR | 35 | | | | | | 35 |
| PORTTRAN | 6 | | | | | | 6 |
| PRCSEQ00 | 1 | | | | | 1 | 2 |
| RPTAUD00 | 1 | 7 | | | | | 8 |
| RPTPOS00 | 5 | 5 | | | | | 10 |
| RPTSTA00 | 3 | 7 | | | | | 10 |
| RTNANA00 | | | | | 1 | | 1 |
| RTNCDE00 | | | | | 1 | | 1 |
| SECMGR | | | | | 1 | | 1 |
| TSTGEN00 | 1 | 8 | 2 | | | | 11 |
| TSTVAL00 | 1 | 7 | | | | | 8 |
| UTLMNT00 | 1 | 11 | | | | | 12 |
| UTLMON00 | 1 | 13 | | | | | 14 |
| UTLVAL00 | 1 | 8 | | | | | 9 |
| **Total** | **80** | **85** | **3** | **7** | **16** | **1** | **192** |

### Evidence and examples

**Category 3 — existing identities missed (Agent 4 defect).** In each case the qualifier is a program 01 that holds a `COPY` of a copybook whose own 01 contains the field. The lookup checks ancestors along `CONTAINS_FIELD` only, so it never reaches the copybook field.

| Program | Name as written | Source | Existing ID |
|---|---|---|---|
| DB2RECV | `DB2-REQUEST-TYPE OF WS-DB2-REQUEST` | DB2RECV.cbl 27–28 `01 WS-DB2-REQUEST. COPY DB2REQ.`; DB2REQ.cpy line 5 | FIL-0018-FLD-000001 |
| DB2RECV | `DB2-RESPONSE-CODE OF WS-DB2-REQUEST` | DB2REQ.cpy line 9 | FIL-0018-FLD-000005 |
| DB2RECV | `DB2-SQLCODE OF WS-DB2-REQUEST` | DB2REQ.cpy line 12 | FIL-0018-FLD-000008 |
| INQHIST, INQPORT | `INQCOM-ERROR-MSG OF WS-COMMAREA` | `01 WS-COMMAREA. COPY INQCOM.` (INQHIST 14–15, INQPORT 14–15); INQCOM.cpy line 12 | FIL-0020-FLD-000008 |
| INQHIST, INQPORT | `INQCOM-RESPONSE-CODE OF WS-COMMAREA` | INQCOM.cpy line 11 | FIL-0020-FLD-000007 |

Note: strictly, a copybook that begins with its own `01` starts a new record, so `OF WS-COMMAREA` is not valid COBOL qualification. The field identity is still unique and certain.

**Category 2 — ambiguous (correctly unresolved).**
- DB2RECV `RECV-CURSOR` is both an 88-level (line 35) and a field (line 40); candidates FIL-0061-FLD-000013 and FLD-000008.
- TSTGEN00 `WS-PORT-STATUS` (lines 71, 98) and `WS-TRAN-STATUS` (lines 72, 106) are each declared twice.

**Category 4 — other verified causes.**
- `SQLCODE` / `SQLERRMC` are not defined anywhere in the repository. `SQLCA.cpy` defines only `SQL-STATUS-CODES` and itself contains `EXEC SQL INCLUDE SQLCA` (line 6); the real SQLCA comes from the DB2 precompiler.
- `WS-PROC-IX` is `INDEXED BY` (PRCSEQ00.cbl line 56).

**Category 1 — missing source definitions.** No definition exists in the program's scope. Where a name of the same spelling exists elsewhere, it is in a file the program does not copy, so matching it would be wrong.
- PORTMSTR (35): it has no COPY at all. 32 names are defined only in files it never includes: ERRHAND.cpy (`ERR-*`), PORTFLIO.cpy (`PORT-*`), and the LINKAGE of ERRPROC (`LS-ERROR-*`) and AUDPROC (`LS-AUDIT-*`). The program passes `LS-ERROR-REQUEST` and `LS-AUDIT-REQUEST` to those programs (lines 262, 287). `USERID`, `TERMINAL-ID` and `WS-BEFORE-IMAGE` are defined nowhere.
- HISTLD00 (15): `TH-*` (13) and `BCT-RECORDS-READ/WRITTEN` (2) are defined nowhere. HISTREC.cpy defines `HIST-*`.
- PORTTRAN (6): from the missing copybook PORTREC (line 40). Same-named items in PORTFLIO.cpy and PORTMSTR are not in its scope.
- CKPRST `ENTRY-POINT-*` (4), RPTPOS00 `POS-*` and `END-OF-POSITIONS` (5), RPTSTA00 `END-OF-*` (2), `WS-ERROR-MESSAGE` (9 programs), INQONLN `WS-COMMAREA-FUNCTION`, INQPORT `WS-COMMAREA-ACCOUNT-NO` and `POSITION-ACCOUNT`, INQHIST `WS-DB2-TOKEN`, PRCSEQ00 `WS-SUB`: no declaration with a level number anywhere in the source.
- 85 paragraph targets: see Task 2.

## Task 2 — the 88 unresolvable execution paths

Every path originates from an ACTIVE, registered statement of its own program. The statement's ID, type and line were checked in Neo4j; none has a registered control-flow edge, except the INQHIST case below.

| Category | Count | Programs | Target exists? | Correct status? |
|---|---|---|---|---|
| A. Target paragraph absent from the program | **85** | BCHCTL00 11, UTLMON00 13, UTLMNT00 11, TSTGEN00 8, UTLVAL00 8, RPTAUD00 7, RPTSTA00 7, TSTVAL00 7, RPTPOS00 5, HISTLD00 3, CURSMGR 2, FILEHNDL 2, DB2HNDL 1 | No: 79 exist nowhere; 3 exist only as paragraphs of other programs (`1100-OPEN-FILES`, `2200-CHECK-DEPENDENCIES`, `4200-CLOSE-FILES`, unreachable by PERFORM); 3 (HISTLD00) exist only as text in DBPROC.cpy, which is copied into WORKING-STORAGE | Yes — source limitation |
| B. Recursive PERFORM | **1** | INQHIST STMT-000043 (line 114): P150-DB2-CONNECT performs itself (P150 spans lines 95–126) | Yes (PAR-0004/0005); Agent 2 edges registered | Yes — Agent 4 recorded the cycle and stopped tracing; no path was missed |
| C. CICS `HANDLE CONDITION` target | **2** | INQPORT STMT-000007 (line 61): `ERROR(P999-ERROR-ROUTINE)`, `NOTFND(P900-NOT-FOUND)` | Yes (PAR-0010, PAR-0008) | Partly. Agent 2 registers no edge for HANDLE CONDITION (documented limitation). Agent 4 left these unresolvable, whereas for INQHIST and INQONLN it copied the paragraph ID by exact name. This is an inconsistency between parallel executions; the runtime jump stays flagged in all three |

### Comparison with Agent 2's 87 unresolved PERFORM targets

Agent 2 counted target **names**; Agent 4 counts unresolvable **paths** (originating statements):

| | Count |
|---|---|
| Agent 2 target names | 87 |
| − CURSMGR THRU end names `P300-EXIT`, `P400-EXIT` (one path each with its start) | −2 |
| = Agent 4 category A paths | **85** |
| + INQHIST recursion (target exists) | +1 |
| + INQPORT HANDLE CONDITION (targets exist) | +2 |
| = Agent 4 unresolvable paths | **88** |

Categories B and C are not in Agent 2's 87 because their targets exist. They are also not counted in `unresolved_ids`, which is why 85 paths but 88 entries.

### Did Agent 4 miss a valid path?

- **Category A:** no; the targets do not exist.
- **Category B:** no; the path is recorded and the cycle is stopped deliberately.
- **Category C:** the two INQPORT handler paragraphs exist and could have been linked by name, as in INQHIST and INQONLN. This is the only place where an existing execution target is not referenced.

### Did Agent 5 preserve the uncertainty?

- Of the 88 originating statements, 14 lie inside a classified condition (via their parent-statement chain). All 16 enclosing conditions have `evidence: "partial"`, and every rule built on them has `requires_sme_review: true` and confidence at most `medium`.
- The other 74 are unconditional PERFORMs in driver paragraphs, so no condition encloses them. Of the 16 rule mentions of these target names, 15 explicitly say "paragraph not present in the source" or "unknown", and all are flagged for review. The remaining mention (BR-011) refers to PRCSEQ00's own existing `2200-CHECK-DEPENDENCIES`, not BCHCTL00's missing one, and is already flagged for a different gap (`WS-SUB`).
- No unresolvable path is presented as a confirmed business outcome.

## Task 3 — Agent 5 tool compliance

**Instruction exceeded.** `.claude/agents/5_rules_c.agent.md`, Constraints:

> REVFORGE: do not create or run Python or any other scripts. Read with Read, Glob and Grep; write with Write and Edit; basic Bash only (`date`, `ls`, `wc`).

The tool list (`tools: Read, Grep, Glob, Bash, Write, Edit, mcp__neo4j__read_neo4j_cypher`) grants Bash without restriction, so the allow-list is an instruction only and nothing enforces it.

**What was run** (from the run log; 32 Bash calls):
- Allowed: `date`, `ls`, `wc`.
- Outside the list, all read-only: `grep`, `sed -n`, `awk`, `head`, `tail`, `find`, `sort`, `xargs`.
- One write-type command: `mkdir -p output/rules`, creating the output directory.

**Additional finding.** The agent listed and read `references/upstream-harness/output/rules/`. That folder holds the reference harness's own sample `rules_artifact.json` and `classified_conditions.json`, generated for the same COBOL sample: 90 rules covering the same 37 programs. Reading the reference is not prohibited, but it risks contaminating independent results. Comparison:
- 0 of 143 rule names are identical;
- 0 descriptions are identical;
- the only shared 8-word phrases are the skill's template sentence "Implemented in program X, paragraph Y".

The reference repository is unchanged (`git status` clean).

**Modifications: none outside the outputs.**
- **Files:** all writes were Write/Edit calls to `output/rules/classified_conditions.json`, `output/rules/rules_artifact.json` and a notes file in the session scratchpad.
- **Upstream outputs:** no inventory, parser, data or logic file changed after the run started.
- **Neo4j:** the run log contains exactly 2 Neo4j tool calls, both `read_neo4j_cypher` (the two batches of `verify-rule-source-ids`). Neo4j still has 4,957 nodes and 5,929 relationships, with an unchanged latest timestamp.

**Smallest proposed correction (not applied).** In `.claude/agents/5_rules_c.agent.md`, Constraints, replace the last REVFORGE bullet with:

> REVFORGE: do not create or run Python or any other scripts. Use the Read, Glob and Grep **tools** for every file read and search. Bash may run only `date` and `mkdir -p <OUTPUT_DIR>`; never `grep`, `sed`, `awk`, `head`, `tail`, `find` or other commands in Bash. Do not read anything under `references/` (it contains outputs for the same codebase).

To enforce it rather than rely on instructions, a project permission rule could deny Bash commands other than `date` and `mkdir` for this agent. That is a settings change for the user to decide. Agents 1–4 carry similar instruction-only Bash limits, so the same wording would apply to them.

## Genuine agent implementation defects

| # | Agent / file | Defect | Effect | Proposed minimal change (not applied) |
|---|---|---|---|---|
| D1 | Agent 4 — `.claude/skills/control-flow-tracer/SKILL.md`, query `resolve-field-references` | Qualifier is not followed through `EXPANDS_COPY` | 7 references (DB2RECV 3, INQHIST 2, INQPORT 2) left `null` though the field exists uniquely | In the `field_hits` subquery, also match `(r)-[:CONTAINS_FIELD*0..]->(h)-[:EXPANDS_COPY]->(cr)-[:CONTAINS_FIELD*1..]->(x)` and count `h.name` / `r.name` among the ancestors |
| D2 | Agent 4 — same skill, "Field ID lookup" | `INDEXED BY` index names are looked up as fields | 1 spurious `UNRESOLVED` (PRCSEQ00 `WS-PROC-IX`) | Add "index names (`INDEXED BY`)" to the list of names that are not looked up |
| D3 | Agent 4 — same skill, Phase 2 REVFORGE note | No rule for CICS `HANDLE CONDITION` targets (no Agent 2 edge) | INQPORT 2 paths unresolvable while INQHIST and INQONLN resolved by name | Add: "a `HANDLE CONDITION` target is recorded as an unstructured step whose `target_paragraph_id` is copied by exact name from the program's `procedure_division.paragraphs`; `null` if no paragraph has that name" |
| D4 | Agent 5 — `.claude/agents/5_rules_c.agent.md` | Bash allow-list not followed; reference output read | No data effect | Wording above; optional permission rule |

Applying D1–D3 would need a rerun of Agent 4 for DB2RECV, INQHIST, INQPORT and PRCSEQ00, then Agent 5. That would remove 8 unmatched references and 2 unresolvable paths. **None is required for Agent 6**: the affected references are `null` and flagged, not wrong.

## Legitimate source limitations that should remain unresolved

- 85 PERFORM targets with no paragraph (79 nowhere, 3 only in other programs, 3 only as text in a WORKING-STORAGE copybook)
- 80 field names with no definition in the program (PORTMSTR's undeclared request areas, HISTLD00's `TH-*`, the missing PORTREC copybook, CKPRST's `ENTRY-POINT-*`, undeclared `WS-ERROR-MESSAGE`, and the rest)
- 3 genuinely ambiguous names (duplicate declarations)
- 16 precompiler-supplied `SQLCODE` / `SQLERRMC` references (environment, not in the repository)
- INQHIST's recursive PERFORM (real source behaviour)

## Trustworthiness of the 143 rules

The rules are trustworthy within their stated confidence:
- every rule traces to a registered, ACTIVE statement and paragraph;
- every field ID names the registered field;
- every rule touched by an unresolved path or name is capped at `medium` and flagged for SME review;
- none presents a missing paragraph's behaviour as fact;
- none was copied from the reference harness's sample output.

The 7 category-3 references make some DB2RECV, INQHIST and INQPORT rules **more conservative than necessary** (lower confidence, missing Field IDs). They are not incorrect.

## Can Agent 6 proceed?

**Yes.** No blocking issue was found. Agent 6 can consume `logic_artifact.json`, the program logic files and `rules_artifact.json` as they are. Unresolvable paths must be drawn as unresolved (Agent 4 marks them, and Agent 5 keeps the review flags). D1–D4 are recommended for review and can be applied later without affecting Agent 6's inputs, other than adding 7 field IDs and 2 resolved handler paths.
