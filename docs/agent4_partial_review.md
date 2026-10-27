# Agent 4 — review of the 30 partial programs

**Inputs reviewed:** `output/logic/logic_artifact.json`, the 42 files in `output/logic/program_logic/`, `output/parser/parser_artifact.json`, `output/data/data_artifact.json` and the data layouts, checked against the COBOL source in `references/upstream-harness/src` and against Neo4j with read-only queries. Nothing was changed.

**Result:** no blocking issue. Every partial program has valid, source-grounded execution logic for the code that exists. Every gap is recorded (`unresolvable_paths`, `target_id: null`, `trace_issues` / `pseudocode_issues`). All permanent ID references are correct. Agent 5 can use all 41 non-empty programs, provided that findings touching an unresolved path or name are marked for review.

## 1. Why 13 partial parses became 30 partial logic analyses

The two statuses measure different things:

- **Agent 2 `parse_status: partial`** concerns structure only: a PERFORM target that has no paragraph in the program. 13 programs are in this state.
- **Agent 4 `logic_status: partial`** is set when the program is partial upstream **or** when any element could not be matched to exactly one existing permanent ID. That includes data names in conditions and pseudocode.

The 17 extra programs parse completely, but use at least one data name with no Field ID:

| Extra programs | Count | Only cause |
|---|---|---|
| DB2CMT, DB2CONN, DB2ERR, DB2STAT, DB2ONLN, ERRHNDL, RTNANA00, RTNCDE00, SECMGR | 9 | `SQLCODE` (and `SQLERRMC` in DB2ONLN) — supplied by the DB2 precompiler, not by any repository source |
| CKPRST, DB2RECV, INQHIST, INQONLN, INQPORT, PORTMSTR, PORTTRAN, PRCSEQ00 | 8 | Undeclared or ambiguous data names (mostly source defects; some Agent 4 lookup limits, see §3) |

So the difference is a stricter status rule in Agent 4, not new structural defects. 13 + 17 = 30.

## 2. Root-cause categories

| Code | Category | Origin |
|---|---|---|
| S1 | PERFORM target paragraph does not exist in the program | COBOL source (confirmed in the Agent 2 readiness review: 87 targets defined nowhere, or only in another program or a WORKING-STORAGE copybook) |
| S2 | Data name used but declared nowhere in the repository (including names from a missing copybook) | COBOL source |
| S3 | Data name declared more than once without qualification | COBOL source |
| S4 | Runtime behaviour present in the source (recursive PERFORM; truncated file) | COBOL source |
| E1 | `SQLCODE` / `SQLERRMC` — precompiler-supplied SQLCA fields. The repository's `SQLCA.cpy` defines only `SQL-STATUS-CODES` and itself contains `EXEC SQL INCLUDE SQLCA` | Build environment (not in the repository) |
| A2 | CICS `HANDLE CONDITION` targets have no control-flow edge | Agent 2 (documented limitation) |
| A4-Q | Qualified name `X OF R` where `R` is the 01 that holds a `COPY`: the Field ID lookup does not follow the copy expansion. The field does exist in the copybook | Agent 4 lookup limitation. The source shape (a copybook 01 copied under a program 01) is also non-standard |
| A4-I | `INDEXED BY` index name looked up as a field. Index names are not data items, so they never have a Field ID | Agent 4 classification (harmless) |

## 3. Per-program review

"Safe for Agent 5": **Yes** = all execution logic present; **Yes, flagged** = usable, but rules touching the listed gaps must be marked for review; **Limited** = the program's main processing is in missing paragraphs, so only the control skeleton (open, loop, dispatch, close, error routine) is available.

| Program | Partial reason | Root cause | Affected execution logic | Source evidence | Safe for Agent 5 | Correction needed |
|---|---|---|---|---|---|---|
| BCHCTL00 | 11 PERFORM targets missing | S1 | The whole control-record cycle (open, read, validate, update, close); only the 6 driver paragraphs exist | Targets appear only in a comment block; `PREREQS-SATISFIED` is tested but never set | Limited | No (source) |
| CKPRST | 4 EVALUATE WHEN names undeclared | S2 | The entry-point dispatch conditions; the 4 PROC-* paragraphs contain no executable statements (lines start with `*` in col. 12) | `ENTRY-POINT-INIT/TAKE/COMMIT/RESTART` occur only at CKPRST.cbl 30–36 | Yes, flagged | No (source) |
| CURSMGR | 2 PERFORM THRU ranges missing; `SQLCODE` | S4, S1, E1 | Fetch and close of the cursor (P300, P400): the file is cut off at line 91 | Truncated after `P200-EXIT` | Yes, flagged (open and declare paths complete) | No (source) |
| DB2CMT | `SQLCODE` | E1 | None: all paths traced; only the Field ID of `SQLCODE` is null | SQLCA.cpy lines 6–15 | Yes | No |
| DB2CONN | `SQLCODE` | E1 | None | as above | Yes | No |
| DB2ERR | `SQLCODE` | E1 | None | as above | Yes | No |
| DB2HNDL | 1 PERFORM target missing; `SQLCODE`, `SQLERRMC` | S1, E1 | Per-row processing in the cursor loop (2310-PROCESS-CURSOR-ROW) | Target declared nowhere | Yes, flagged | No (source) |
| DB2ONLN | `SQLCODE`, `SQLERRMC` | E1 | None | SQLCA.cpy | Yes | No |
| DB2RECV | 3 qualified names; `RECV-CURSOR` ambiguous; `SQLCODE` | A4-Q, S3, E1 | None: all paths traced; Field IDs null for 5 names | `DB2-REQUEST-TYPE` etc. exist in DB2REQ.cpy, which is copied under `01 WS-DB2-REQUEST` (line 28); `RECV-CURSOR` is both an 88 (line 35) and a field (line 40) | Yes, flagged | Optional (A4-Q) |
| DB2STAT | `SQLCODE` | E1 | None | SQLCA.cpy | Yes | No |
| ERRHNDL | `SQLCODE` | E1 | None | SQLCA.cpy | Yes | No |
| FILEHNDL | 2 PERFORM targets missing | S1 | Only inside 3 paragraphs confirmed dead (2100, 2200, 2300); 2000-PROCESS has no statements; a recursive error path was stopped | Targets declared nowhere | Yes, flagged | No (source) |
| HISTLD00 | 3 PERFORM targets missing; 16 names undeclared | S1, S2, E1 | DB2 connect, disconnect and error handling; the field mapping uses `TH-*` names | `CONNECT-TO-DB2` etc. exist only as text in DBPROC.cpy, copied into WORKING-STORAGE (line 45); no copybook defines `TH-*` or `BCT-RECORDS-*` (HISTREC defines `HIST-*`) | Yes, flagged | No (source) |
| INQHIST | 2 qualified names; `WS-DB2-TOKEN` undeclared; `SQLCODE`; recursive PERFORM | A4-Q, S2, E1, S4 | The retry path (P150 performs itself at line 114) was recorded and stopped | INQCOM.cpy defines `INQCOM-ERROR-MSG` and `INQCOM-RESPONSE-CODE`, copied under `01 WS-COMMAREA` (line 15) | Yes, flagged | Optional (A4-Q) |
| INQONLN | 2 names undeclared | S2 | The EVALUATE subject (`WS-COMMAREA-FUNCTION`) of the main dispatch | Neither name is declared in the repository | Yes, flagged (dispatch branches are traced; the subject has no Field ID) | No (source) |
| INQPORT | 2 qualified names; 2 names undeclared; SQLPOS missing; 2 HANDLE CONDITION targets | A4-Q, S2, A2 | The error and not-found routines are reachable only through HANDLE CONDITION and have no CFG edge | `EXEC SQL INCLUDE SQLPOS` (line 21) has no file; `WS-COMMAREA-ACCOUNT-NO` and `POSITION-ACCOUNT` declared nowhere | Yes, flagged | Optional (A4-Q, A2) |
| PORTMSTR | 35 names undeclared | S2 | Error-request and audit-request building (2100-HANDLE-VSAM-ERROR, which is dead, and 2100-LOG-PORTFOLIO-UPDATE) | `LS-ERROR-REQUEST` / `LS-AUDIT-REQUEST` are passed to ERRPROC and AUDPROC (lines 262, 287) but the program has no COPY at all | Yes, flagged | No (source) |
| PORTTRAN | 6 names undeclared (PORTREC missing) | S2 | Portfolio-record updates; 2200-UPDATE-POSITIONS and everything below it is dead code | `COPY PORTREC` (line 40) has no file | Yes, flagged | No (source) |
| PRCSEQ00 | `WS-SUB` undeclared; `WS-PROC-IX` | S2, A4-I | None: loops traced; the subscript has no Field ID | `WS-SUB` declared nowhere; `WS-PROC-IX` is `INDEXED BY` (line 56) | Yes, flagged | Optional (A4-I) |
| RPTAUD00 | 7 PERFORM targets missing; `WS-ERROR-MESSAGE` | S1, S2 | Read, summarise and write of the audit and error summaries | Targets declared nowhere | Limited | No (source) |
| RPTPOS00 | 5 PERFORM targets missing; 5 names undeclared | S1, S2 | Transaction reading, activity summary and the totals, exceptions and metrics reports | `POS-DESCRIPTION`, `POS-CURRENT-VALUE` etc. are not in POSREC.cpy | Limited | No (source) |
| RPTSTA00 | 7 PERFORM targets missing; 3 names undeclared | S1, S2 | All statistics accumulation, metrics and report sections | `COPY DB2STAT` names a program, not a copybook | Limited | No (source) |
| RTNANA00 | `SQLCODE` | E1 | None | SQLCA.cpy | Yes | No |
| RTNCDE00 | `SQLCODE` | E1 | None | SQLCA.cpy | Yes | No |
| SECMGR | `SQLCODE` | E1 | None | SQLCA.cpy | Yes | No |
| TSTGEN00 | 8 PERFORM targets missing; `WS-ERROR-MESSAGE`; 2 ambiguous names | S1, S2, S3 | All data-generation and record-writing paragraphs | `WS-PORT-STATUS` / `WS-TRAN-STATUS` declared twice (lines 71/98, 72/106) | Limited | No (source) |
| TSTVAL00 | 7 PERFORM targets missing; `WS-ERROR-MESSAGE` | S1, S2 | All test-execution and validation paragraphs | Targets declared nowhere | Limited | No (source) |
| UTLMNT00 | 11 PERFORM targets missing; `WS-ERROR-MESSAGE` | S1, S2 | All VSAM maintenance operations | Targets declared nowhere | Limited | No (source) |
| UTLMON00 | 13 PERFORM targets missing; `WS-ERROR-MESSAGE`; `COPY DB2STAT` | S1, S2 | All metric collection, checks, logging and alerts | Targets declared nowhere | Limited | No (source) |
| UTLVAL00 | 8 PERFORM targets missing; `WS-ERROR-MESSAGE` | S1, S2 | All integrity, cross-reference, format and balance checks | Targets declared nowhere | Limited | No (source) |

Counts: **Yes** 9 · **Yes, flagged** 12 · **Limited** 9.

The 11 `success` programs (AUDPROC, ERRHANDL, ERRPROC, PORTADD, PORTDEL, PORTREAD, PORTTEST, PORTUPDT, PORTVALD, PROGNAME, RCVPRC00) are fully usable. POSUPDT (1-byte file) is `empty`: there is nothing to extract.

## 4. Checks that apply to all 30

| Check | Result |
|---|---|
| Valid execution logic generated | Yes. Every partial program has its traces, branches and pseudocode for the code present; 0 untranslated statements; pseudocode and statement-ID arrays have equal length in every paragraph |
| Every unresolved or uncertain result documented | Yes. 88 `unresolvable_paths` entries; 192 IDs left `null` with `id_unresolved` issues (104 unresolved field names, 3 ambiguous, 85 paragraph targets); ambiguous statements carry `"ambiguous": true` |
| Permanent ID references correct | Yes. All 3,189 distinct IDs exist once and are ACTIVE in Neo4j; 1,005 step, branch and loop references point to the statement in the right paragraph and line range; 2,047 resolved field references name the registered item |
| Anything invented | No missing paragraph, field or path was filled in |

## 5. Genuine Agent 4 analysis defects (non-blocking)

1. **A4-Q — qualifier through COPY** (INQPORT, INQHIST, DB2RECV; 7 names). The fields exist in the copybook. The lookup could follow `EXPANDS_COPY` when the qualifier is the holding record. They are left `null`, so this is not wrong, only incomplete.
2. **A4-I — index name looked up** (PRCSEQ00 `WS-PROC-IX`). It should be classified like a special register (not looked up). It inflates `unresolved_ids` by 1.
3. **Inconsistent HANDLE CONDITION handling.** For INQHIST and INQONLN the paragraph ID was copied by exact name; for INQPORT the targets were left unresolvable. Both are safe; the difference is LLM variance between parallel executions.
4. **Extra top-level keys** in some logic files (`meta`, `data_run_id`, `field_id_lookups`; PORTTRAN `agent_version`, `generated_at`). They are additions only; no original field is changed.

None of these makes rule extraction unreliable. None was corrected, so that Agent 4 stays as tested.

## 6. Guidance for Agent 5

- Use the logic of all 41 non-empty programs.
- A rule whose condition or outcome involves an unresolvable path (S1, A2, S4) must not be stated as a confirmed business outcome. Keep it as a rule with reduced confidence and mark it for review.
- A rule whose condition uses a name with `target_id: null` keeps the condition text verbatim, carries the name, `field_id: null`, and is marked for review. `SQLCODE` conditions (E1) are standard DB2 semantics and can keep normal confidence; only their Field ID is null.
- For the 9 "Limited" programs, rules can only come from the driver logic present (for example the loop and error thresholds). The missing processing must not be described.
