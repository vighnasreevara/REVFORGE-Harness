# Gaps and assumptions register

**System:** Portfolio Management System (system ID `SYS-PORTFOLIO-001`)
**Generated:** 2026-10-28T17:46:04Z (completed 2026-10-30)
**Total gaps:** 217 (6 critical, 86 high, 50 medium, 75 low)

GAP and ASM numbers are run-local register identifiers. Permanent identifiers (File, Path, Paragraph, Statement, Record and Field IDs) are copied unchanged from the upstream artifacts and were checked read-only against the source registry (see the verification note at the end of this register). Where an item has no permanent ID the register says so; no ID was created.

Because more than 100 gaps were found, the register starts with summary tables and then gives the detail by severity. Gaps 1 to 123 come from the structure, data, logic and diagram analysis; gaps 124 to 217 are one entry per business rule that is not confirmed/high or that Agent 5 flagged for SME (subject matter expert) review.

---

## Summary by severity and type

| Severity | Count | Gap types |
|---|---|---|
| Critical | 6 | EMPTY_SOURCE (1), CIRCULAR_COPY (1), UNRESOLVED_COPYBOOK (4) |
| High | 86 | UNRESOLVED_CALL (3), UNRESOLVABLE_PATH (14), RECURSIVE_PERFORM (1), INVALID_QUALIFICATION (3), UNDECLARED_DATA_NAME (15), SME_REVIEW_REQUIRED (50) |
| Medium | 50 | UNSTRUCTURED_FLOW (10), RUNTIME_CONDITIONAL_TRANSFER (3), AMBIGUOUS_DATA_REFERENCE (4), SUSPECTED_LOGIC_DEFECT (23), UNSUPPORTED_CONSTRUCT (8), UNCONFIRMED_RELATIONSHIP (1), DIAGRAM_RENDER_UNVERIFIED (1) |
| Low | 75 | DEAD_CODE_CONFIRMED (4), MISSING_PROGRAM_ID (1), PRECOMPILER_PROVIDED (1), DIAGRAM_TRUNCATED (5), DIAGRAM_INCOMPLETE (20), MEDIUM_CONFIDENCE_RULE (44) |

Gap types with **no findings**: ALTER_STATEMENT, PARSE_FAILURE, INFINITE_LOOP_RISK (no loop was classified POTENTIAL_INFINITE_LOOP; loops that may not end are listed as SUSPECTED_LOGIC_DEFECT), DYNAMIC_CALL, REDEFINES_MISMATCH (the data artifact records no REDEFINES), GOTO_USAGE (no GO TO in any program), UNKNOWN_FIELD_TYPE, RULE_NOT_DIAGRAMMED (all 154 rules are annotated in at least one diagram).

Merged types: the 14 low-confidence rules all also require SME review, so LOW_CONFIDENCE_RULE appears only as a secondary type of their SME gaps. Paragraphs with untranslated statements and pseudocode "id_unresolved" notes are merged into the UNRESOLVABLE_PATH and data-reference gaps of the same program. The 8 parser dead-code candidates are covered by the 4 DEAD_CODE_CONFIRMED gaps and GAP-055.

Grouping note: data-reference gaps are grouped one per program and reason (every affected name is listed), and Agent 4 warnings are grouped one gap per program and type. This is coarser than the one-gap-per-name rule of the gap detector; nothing is omitted.

## Summary by program

| Program | File ID | Structural gaps | Rule gaps |
|---|---|---|---|
| BCHCTL00 | SYS-PORTFOLIO-001-FIL-0042 | GAP-010, GAP-108 | GAP-124, GAP-216 |
| CKPRST | SYS-PORTFOLIO-001-FIL-0043 | GAP-028, GAP-083 | GAP-125, GAP-198, GAP-199, GAP-200 |
| HISTLD00 | SYS-PORTFOLIO-001-FIL-0044 | GAP-011, GAP-029, GAP-098, GAP-099, GAP-109 | GAP-126, GAP-127, GAP-209, GAP-210 |
| POSUPDT | SYS-PORTFOLIO-001-FIL-0045 | GAP-001, GAP-110 | — |
| PRCSEQ00 | SYS-PORTFOLIO-001-FIL-0046 | GAP-030, GAP-060, GAP-100 | GAP-128 to GAP-135, GAP-201 to GAP-205 |
| RCVPRC00 | SYS-PORTFOLIO-001-FIL-0047 | GAP-061, GAP-101 | GAP-136, GAP-201 to GAP-205 |
| RPTAUD00 | SYS-PORTFOLIO-001-FIL-0048 | GAP-012, GAP-031, GAP-062, GAP-111 | GAP-206 to GAP-208 |
| RPTPOS00 | SYS-PORTFOLIO-001-FIL-0049 | GAP-013, GAP-032, GAP-112 | GAP-137, GAP-213, GAP-214 |
| RPTSTA00 | SYS-PORTFOLIO-001-FIL-0050 | GAP-005, GAP-014, GAP-033, GAP-063, GAP-113 | — |
| RTNANA00 | SYS-PORTFOLIO-001-FIL-0051 | GAP-043, GAP-064, GAP-084, GAP-098 | GAP-138, GAP-139 |
| RTNCDE00 | SYS-PORTFOLIO-001-FIL-0052 | GAP-044, GAP-098 | GAP-140 |
| AUDPROC | SYS-PORTFOLIO-001-FIL-0053 | GAP-065 | GAP-206 to GAP-208 |
| DB2CMT | SYS-PORTFOLIO-001-FIL-0054 | GAP-098 | GAP-141 |
| DB2CONN | SYS-PORTFOLIO-001-FIL-0055 | GAP-007, GAP-098, GAP-106, GAP-114 | GAP-142, GAP-143 |
| DB2ERR | SYS-PORTFOLIO-001-FIL-0056 | GAP-086, GAP-098 | GAP-144, GAP-145 |
| DB2STAT | SYS-PORTFOLIO-001-FIL-0057 | GAP-066, GAP-085, GAP-098 | GAP-146 |
| ERRPROC | SYS-PORTFOLIO-001-FIL-0058 | — | — |
| CURSMGR | SYS-PORTFOLIO-001-FIL-0059 | GAP-015, GAP-045, GAP-098, GAP-115 | GAP-147 |
| DB2ONLN | SYS-PORTFOLIO-001-FIL-0060 | GAP-046, GAP-067, GAP-087, GAP-098 | GAP-148 |
| DB2RECV | SYS-PORTFOLIO-001-FIL-0061 | GAP-025, GAP-047, GAP-056, GAP-068, GAP-098 | GAP-149, GAP-150, GAP-151, GAP-215 |
| ERRHNDL | SYS-PORTFOLIO-001-FIL-0062 | GAP-048, GAP-058, GAP-088, GAP-097, GAP-098 | GAP-152, GAP-153 |
| INQHIST | SYS-PORTFOLIO-001-FIL-0063 | GAP-016, GAP-026, GAP-034, GAP-049, GAP-053, GAP-069, GAP-098 | GAP-154, GAP-155 |
| INQONLN | SYS-PORTFOLIO-001-FIL-0064 | GAP-035, GAP-050, GAP-054, GAP-107 | GAP-156, GAP-157 |
| INQPORT | SYS-PORTFOLIO-001-FIL-0065 | GAP-004, GAP-027, GAP-036, GAP-051, GAP-055 | GAP-158, GAP-213 |
| SECMGR | SYS-PORTFOLIO-001-FIL-0066 | GAP-052, GAP-070, GAP-098 | GAP-159 |
| PORTADD | SYS-PORTFOLIO-001-FIL-0067 | GAP-059, GAP-071 | GAP-160, GAP-161, GAP-162, GAP-211, GAP-212 |
| PORTDEL | SYS-PORTFOLIO-001-FIL-0068 | GAP-072 | GAP-163, GAP-164, GAP-165, GAP-211, GAP-212, GAP-217 |
| PORTMSTR | SYS-PORTFOLIO-001-FIL-0069 | GAP-037, GAP-073, GAP-090, GAP-091, GAP-094, GAP-102 | GAP-166 to GAP-171 |
| PORTREAD | SYS-PORTFOLIO-001-FIL-0070 | GAP-074 | GAP-172, GAP-173, GAP-211, GAP-212 |
| PORTTEST | SYS-PORTFOLIO-001-FIL-0071 | GAP-075, GAP-089 | GAP-174, GAP-175, GAP-176, GAP-211, GAP-212 |
| PORTTRAN | SYS-PORTFOLIO-001-FIL-0072 | GAP-003, GAP-076, GAP-093, GAP-103, GAP-105 | GAP-177 to GAP-182, GAP-206 to GAP-208, GAP-214 |
| PORTUPDT | SYS-PORTFOLIO-001-FIL-0073 | GAP-077 | GAP-183, GAP-211, GAP-212 |
| PORTVALD | SYS-PORTFOLIO-001-FIL-0074 | GAP-078 | GAP-184, GAP-185, GAP-186 |
| TSTGEN00 | SYS-PORTFOLIO-001-FIL-0075 | GAP-017, GAP-038, GAP-057, GAP-116 | GAP-187, GAP-188, GAP-211, GAP-212, GAP-214 |
| TSTVAL00 | SYS-PORTFOLIO-001-FIL-0076 | GAP-018, GAP-039, GAP-079, GAP-117 | GAP-189, GAP-190 |
| UTLMNT00 | SYS-PORTFOLIO-001-FIL-0077 | GAP-019, GAP-040, GAP-118 | GAP-188, GAP-191 |
| UTLMON00 | SYS-PORTFOLIO-001-FIL-0078 | GAP-006, GAP-008, GAP-020, GAP-041, GAP-080, GAP-119 | GAP-192, GAP-193 |
| UTLVAL00 | SYS-PORTFOLIO-001-FIL-0079 | GAP-021, GAP-042, GAP-081, GAP-120 | GAP-194, GAP-213, GAP-214 |
| DB2HNDL | SYS-PORTFOLIO-001-FIL-0080 | GAP-022, GAP-082, GAP-098, GAP-121 | — |
| ERRHANDL | SYS-PORTFOLIO-001-FIL-0081 | GAP-009, GAP-122 | GAP-195, GAP-196, GAP-197 |
| FILEHNDL | SYS-PORTFOLIO-001-FIL-0082 | GAP-023, GAP-024, GAP-095, GAP-123 | — |
| PROGNAME | SYS-PORTFOLIO-001-FIL-0083 | GAP-096 | — |
| Copybook SQLCA | SYS-PORTFOLIO-001-FIL-0017 | GAP-002, GAP-098 | — |
| System-wide | — | GAP-092, GAP-104 | — |

---

## Critical gaps — must resolve before BRD sign-off

### GAP-001 — POSUPDT source file is empty (1 byte)
**Type:** Empty source (also: missing program ID) | **Program:** POSUPDT (`SYS-PORTFOLIO-001-FIL-0045`) | **Line:** —

The source file `src/programs/batch/POSUPDT.cbl` is 1 byte (a single blank). It has no identification, data or procedure part, so the file name was used as the program ID, parsing recorded "empty" and logic translation recorded "empty". The name suggests a position-update routine, but nothing in the source supports any statement about its behaviour.

**Impact:** POSUPDT is absent from every rule, data and process chapter. Its diagram FLOW-POSUPDT is a 2-node placeholder.

**Recommended action:** Obtain the real POSUPDT source from the production library or confirm it is retired; re-run the pipeline. *SME review required.*

### GAP-002 — Copybook SQLCA includes itself (circular copy)
**Type:** Circular copy | **Copybook:** SQLCA (`SYS-PORTFOLIO-001-FIL-0017`, record `SYS-PORTFOLIO-001-FIL-0017-REC-0001`) | **Line:** 6

The shared copybook SQLCA (a copybook is a shared COBOL data definition file) contains an instruction to include itself. It defines only SQL status constants (SQL-STATUS-CODES) and not the standard DB2 communication fields SQLCODE / SQLERRMC. It is used by 14 programs.

**Impact:** The real DB2 communication area used at compile time is undocumented; every SQL result test in those programs lacks a Field ID (GAP-098).

**Recommended action:** Confirm with the DB2 team which SQLCA the precompiler supplies; remove the self-inclusion and re-run Agent 3.

### GAP-003 — COPY PORTREC in PORTTRAN not found
**Type:** Unresolved copybook | **Program:** PORTTRAN (`SYS-PORTFOLIO-001-FIL-0072`) | **Line:** 40

PORTTRAN includes copybook PORTREC as the layout of its portfolio file, but PORTREC is not in the repository. Six names (PORT-ID, PORT-TOTAL-UNITS, PORT-TOTAL-COST, PORTFOLIO-RECORD, PORT-ACCOUNT-NO, PORT-RECORD) therefore have no Field IDs.

**Impact:** The portfolio-existence check (BR-106) and the unreachable position update (BR-112, BR-114) rest on an unknown layout.

**Recommended action:** Locate PORTREC in a load library, external PDS or vendor library; add it and re-run Agent 3 onwards.

### GAP-004 — EXEC SQL INCLUDE SQLPOS in INQPORT not found
**Type:** Unresolved copybook | **Program:** INQPORT (`SYS-PORTFOLIO-001-FIL-0065`) | **Line:** 21

The online position inquiry includes the DB2 member SQLPOS (probably a DCLGEN table declaration), which is not in the repository; the area WS-DB2-POSITION therefore has no content. This is a source gap, not an analysis gap.

**Impact:** The DB2 position layout used by the online inquiry is unknown (BR-077).

**Recommended action:** Locate the SQLPOS DCLGEN member; add it and re-run Agent 3 onwards.

### GAP-005 — COPY DB2STAT in RPTSTA00 names a program
**Type:** Unresolved copybook | **Program:** RPTSTA00 (`SYS-PORTFOLIO-001-FIL-0050`) | **Line:** 35

RPTSTA00 includes "DB2STAT" as a record layout, but no such copybook exists; the name matches the program DB2STAT (`SYS-PORTFOLIO-001-FIL-0057`). The DB2 statistics record layout is unavailable.

**Impact:** The DB2 statistics input of the statistics report cannot be described (see GAP-014, GAP-033).

**Recommended action:** Locate the DB2STAT layout copybook; add it and re-run Agent 3 onwards.

### GAP-006 — COPY DB2STAT in UTLMON00 names a program
**Type:** Unresolved copybook | **Program:** UTLMON00 (`SYS-PORTFOLIO-001-FIL-0078`) | **Line:** 43

UTLMON00 includes "DB2STAT" as a record layout; no such copybook exists. The DB2 statistics record read by the monitoring utility has no layout.

**Impact:** The monitoring utility's DB2 statistics input cannot be described (BR-129, BR-130).

**Recommended action:** As GAP-005.

---

## High severity gaps

### GAP-007 — CALL to DELAY in DB2CONN cannot be resolved
**Type:** Unresolved call | **Program:** DB2CONN (`SYS-PORTFOLIO-001-FIL-0055`), paragraph 1000-CONNECT (`SYS-PORTFOLIO-001-FIL-0055-PAR-0002`), statement `SYS-PORTFOLIO-001-FIL-0055-STMT-000041` | **Line:** 86

Between failed DB2 connection attempts DB2CONN calls an external routine DELAY, which is not in the repository.

**Impact:** The wait behaviour (BR-047) is unknown. **Recommended action:** Determine whether DELAY is a load-library, vendor or OS routine and document its interface. *SME review required.*

### GAP-008 — CALL to ILBOABN0 in UTLMON00 cannot be resolved
**Type:** Unresolved call (also an unresolvable path) | **Program:** UTLMON00 (`SYS-PORTFOLIO-001-FIL-0078`), paragraph 2000-PROCESS (`SYS-PORTFOLIO-001-FIL-0078-PAR-0006`), statement `SYS-PORTFOLIO-001-FIL-0078-STMT-000022` | **Line:** 186

The monitoring cycle calls the system runtime routine ILBOABN0 with the current minute; whether control returns cannot be traced.

**Impact:** The cycle-end rule BR-130 is uncertain. **Recommended action:** Confirm the purpose of ILBOABN0 here and whether control returns. *SME review required.*

### GAP-009 — CALL to CEE3ABD in ERRHANDL cannot be resolved
**Type:** Unresolved call (also an unresolvable path) | **Program:** ERRHANDL (`SYS-PORTFOLIO-001-FIL-0081`), paragraph 8500-INITIATE-ABEND (`SYS-PORTFOLIO-001-FIL-0081-PAR-0011`), statement `SYS-PORTFOLIO-001-FIL-0081-STMT-000040` | **Line:** 186

The error-handling template calls the Language Environment service CEE3ABD, which requests abnormal termination; whether control returns cannot be traced.

**Impact:** The final return-code rules BR-132 to BR-134 are runtime-dependent. **Recommended action:** Confirm the expected behaviour. *SME review required.*

### Unresolvable execution paths (GAP-010 to GAP-023)

Each row is one program; each missing target is listed in `gaps_register.json` with its Statement ID, Paragraph ID and line. "Source" means the performed paragraph is absent from the source; "analysis" means it exists elsewhere but could not be traced for this program.

| Gap | Program (File ID) | Missing targets | Cause | Impact | Related rules |
|---|---|---|---|---|---|
| GAP-010 | BCHCTL00 (`SYS-PORTFOLIO-001-FIL-0042`) | 11: 1100-OPEN-FILES, 1200-READ-CONTROL-RECORD, 1300-VALIDATE-PROCESS, 1400-UPDATE-START-STATUS, 2100-READ-CONTROL-RECORD, 2200-CHECK-DEPENDENCIES, 3100-READ-CONTROL-RECORD, 3200-UPDATE-PROCESS-STATUS, 3300-WRITE-CONTROL-RECORD, 4100-UPDATE-COMPLETION, 4200-CLOSE-FILES (statements STMT-000004 to 000009, 000011 to 000015) | source ("to be implemented" comment) | No batch-control file processing can be documented | BR-002 |
| GAP-011 | HISTLD00 (`SYS-PORTFOLIO-001-FIL-0044`) | 3: CONNECT-TO-DB2 (STMT-000019, line 117), DB2-ERROR-ROUTINE (STMT-000076, line 172), DISCONNECT-FROM-DB2 (STMT-000050, line 216) | analysis (procedure code inside copybook DBPROC, not registered) | DB2 connect/error/disconnect handling undocumented | BR-004, BR-006 |
| GAP-012 | RPTAUD00 (`SYS-PORTFOLIO-001-FIL-0048`) | 7: 2110, 2120, 2210, 2220, 2310, 2320, 2330 (STMT-000020 to 000026) | source | Audit-report body undocumented; no audit-report rule extracted | — |
| GAP-013 | RPTPOS00 (`SYS-PORTFOLIO-001-FIL-0049`) | 5: 2210, 2220, 2310, 2320, 2330 (STMT-000028 to 000032) | source | Transaction-activity and summary sections undocumented | BR-034 |
| GAP-014 | RPTSTA00 (`SYS-PORTFOLIO-001-FIL-0050`) | 7: 2110, 2210, 2310, 2320, 2410, 2420, 2430 (STMT-000043, 000046, 000027 to 000031) | source | Statistics report content undocumented | — |
| GAP-015 | CURSMGR (`SYS-PORTFOLIO-001-FIL-0059`) | 2: P300-FETCH-DATA (STMT-000015, line 52), P400-CLOSE-CURSOR (STMT-000013, line 55) | source (file cut off at line 91) | History fetch and cursor close undocumented | BR-057 |
| GAP-016 | INQHIST (`SYS-PORTFOLIO-001-FIL-0063`) | 1: recursive PERFORM of P150-DB2-CONNECT (STMT-000043, line 114) | analysis (recursion; tracing stopped) | Behaviour after a successful DB2 recovery undocumented; *SME review required* | BR-071 |
| GAP-017 | TSTGEN00 (`SYS-PORTFOLIO-001-FIL-0075`) | 8: 2210, 2220, 2310, 2320, 2410, 2420, 2510, 2520 | source | Generated test content undocumented | BR-124 |
| GAP-018 | TSTVAL00 (`SYS-PORTFOLIO-001-FIL-0076`) | 7: 2200 to 2800 test-run, validation, metric and detail paragraphs | source | Test execution and judgement undocumented | BR-126, BR-127 |
| GAP-019 | UTLMNT00 (`SYS-PORTFOLIO-001-FIL-0077`) | 11: 2210 to 2230, 2310 to 2330, 2410 to 2430, 2510, 2520 | source | File maintenance work undocumented | BR-128 |
| GAP-020 | UTLMON00 (`SYS-PORTFOLIO-001-FIL-0078`) | 13: 1310, 2110 to 2140, 2210 to 2240, 2310, 2320, 2410, 2420 | source | Metric collection, thresholds and alerts undocumented | BR-129, BR-130 |
| GAP-021 | UTLVAL00 (`SYS-PORTFOLIO-001-FIL-0079`) | 8: 2210, 2220, 2310, 2320, 2410, 2420, 2510, 2520 (STMT-000018 to 000025) | source | Data-validation rules unknown | BR-131 |
| GAP-022 | DB2HNDL (`SYS-PORTFOLIO-001-FIL-0080`) | 1: 2310-PROCESS-CURSOR-ROW (STMT-000038, line 174) | source (template expects a user paragraph) | Template only | — |
| GAP-023 | FILEHNDL (`SYS-PORTFOLIO-001-FIL-0082`) | 2: 2110-PROCESS-VSAM-RECORD (STMT-000029), 2310-PROCESS-INPUT-RECORD (STMT-000032) — both inside dead code | source | Template only; no executable path affected | — |

**Recommended action (all):** Locate the complete source (or confirm the programs are unfinished or templates), then re-run the pipeline. For GAP-011, review the DBPROC procedure copybook with the developers.

### GAP-024 — FILEHNDL: recursive PERFORM cycles through 3000-TERMINATE
**Type:** Recursive PERFORM | **Program:** FILEHNDL (`SYS-PORTFOLIO-001-FIL-0082`) | **Statements:** STMT-000016, 000033, 000022 (cycle via 9100-VSAM-ERROR); STMT-000016, 000034, 000035, 000026 (cycle via 9200-SEQ-ERROR)

On a bad file status the error paragraphs call the termination step while it is still active — a recursive call whose behaviour is undefined. Tracing stopped there. **Impact:** Termination on file errors in the template is undefined. **Recommended action:** Do not copy this pattern into business programs.

### Invalid qualifications (GAP-025 to GAP-027)

A qualified name such as "X OF Y" refers to field X inside group Y. In these cases the group holds a copied record that starts its own top-level record, so the field is not inside the named group and the reference resolves to nothing. The candidate Field IDs below are evidence only and are not assigned to the references.

| Gap | Program | Names | Candidate Field IDs (evidence only) | Related rules |
|---|---|---|---|---|
| GAP-025 | DB2RECV (`SYS-PORTFOLIO-001-FIL-0061`), P110-ATTEMPT-RECONNECT, lines 86/93/98 | DB2-REQUEST-TYPE, DB2-RESPONSE-CODE, DB2-SQLCODE OF WS-DB2-REQUEST | SYS-PORTFOLIO-001-FIL-0018-FLD-000001, -FLD-000005, -FLD-000008 | BR-065 |
| GAP-026 | INQHIST (`SYS-PORTFOLIO-001-FIL-0063`), STMT-000041 (line 118), STMT-000029 (line 190) | INQCOM-ERROR-MSG, INQCOM-RESPONSE-CODE OF WS-COMMAREA | SYS-PORTFOLIO-001-FIL-0020-FLD-000008, -FLD-000007 | BR-071 |
| GAP-027 | INQPORT (`SYS-PORTFOLIO-001-FIL-0065`), STMT-000015, 000018, 000019 | INQCOM-ERROR-MSG, INQCOM-RESPONSE-CODE OF WS-COMMAREA | SYS-PORTFOLIO-001-FIL-0020-FLD-000008, -FLD-000007 | BR-077 |

**Recommended action:** Ask the developers which fields are intended and correct the references. *SME review required.*

### Undeclared data names (GAP-028 to GAP-042)

Each name below is used by the program but declared nowhere in the program or the copybooks it includes; the program as written would not compile, and the names have no Field ID.

| Gap | Program (File ID) | Undeclared names | Related rules | SME |
|---|---|---|---|---|
| GAP-028 | CKPRST (`SYS-PORTFOLIO-001-FIL-0043`) | ENTRY-POINT-INIT, -TAKE, -COMMIT, -RESTART (STMT-000001, line 29) | BR-003 | Yes |
| GAP-029 | HISTLD00 (`SYS-PORTFOLIO-001-FIL-0044`) | 13 TH-* history fields (lines 146-158); BCT-RECORDS-READ, BCT-RECORDS-WRITTEN (lines 192-193) | BR-007 | Yes |
| GAP-030 | PRCSEQ00 (`SYS-PORTFOLIO-001-FIL-0046`) | WS-SUB (dependency loop subscript; STMT-000037, 000038, 000087, 000088) | BR-013, BR-015, BR-016 | Yes |
| GAP-031 | RPTAUD00 (`SYS-PORTFOLIO-001-FIL-0048`) | WS-ERROR-MESSAGE (lines 97, 104, 111, 145) | — | No |
| GAP-032 | RPTPOS00 (`SYS-PORTFOLIO-001-FIL-0049`) | END-OF-POSITIONS, WS-ERROR-MESSAGE, POS-DESCRIPTION, POS-CURRENT-VALUE, POS-PREVIOUS-VALUE | BR-034 | Yes |
| GAP-033 | RPTSTA00 (`SYS-PORTFOLIO-001-FIL-0050`) | WS-ERROR-MESSAGE, END-OF-DB2-STATS, END-OF-BATCH-STATS | — | No |
| GAP-034 | INQHIST (`SYS-PORTFOLIO-001-FIL-0063`) | WS-DB2-TOKEN (STMT-000014, line 125) | — | No |
| GAP-035 | INQONLN (`SYS-PORTFOLIO-001-FIL-0064`) | WS-COMMAREA-FUNCTION (line 62), WS-ERROR-MESSAGE (lines 84, 135) | BR-072, BR-073 | Yes |
| GAP-036 | INQPORT (`SYS-PORTFOLIO-001-FIL-0065`) | WS-COMMAREA-ACCOUNT-NO, POSITION-ACCOUNT OF WS-POSITION-RECORD (STMT-000009, 000010) | BR-077 | Yes |
| GAP-037 | PORTMSTR (`SYS-PORTFOLIO-001-FIL-0069`) | 35 names in 2100-HANDLE-VSAM-ERROR and 2100-LOG-PORTFOLIO-UPDATE (LS-PROGRAM-ID, ERR-CAT-VSAM, LS-CATEGORY, WS-FILE-STATUS, LS-ERROR-CODE, ERR-VSAM-DUPKEY, ERR-WARNING, LS-SEVERITY, ERR-VSAM-22, LS-ERROR-TEXT, ERR-VSAM-NOTFND, ERR-VSAM-23, ERR-ERROR, ERR-OTHER, PORT-KEY, LS-ERROR-DETAILS, LS-ERROR-REQUEST, LS-AUDIT-REQUEST, LS-SYSTEM-ID, USERID, LS-USER-ID, LS-PROGRAM, TERMINAL-ID, LS-TERMINAL, LS-TYPE, LS-ACTION, LS-STATUS, LS-PORT-ID, PORT-ACCOUNT-NO, LS-ACCT-NO, WS-BEFORE-IMAGE, LS-BEFORE-IMAGE, PORT-RECORD, LS-AFTER-IMAGE, LS-MESSAGE) | BR-098 | Yes |
| GAP-038 | TSTGEN00 (`SYS-PORTFOLIO-001-FIL-0075`) | WS-ERROR-MESSAGE | — | No |
| GAP-039 | TSTVAL00 (`SYS-PORTFOLIO-001-FIL-0076`) | WS-ERROR-MESSAGE | — | No |
| GAP-040 | UTLMNT00 (`SYS-PORTFOLIO-001-FIL-0077`) | WS-ERROR-MESSAGE | — | No |
| GAP-041 | UTLMON00 (`SYS-PORTFOLIO-001-FIL-0078`) | WS-ERROR-MESSAGE | — | No |
| GAP-042 | UTLVAL00 (`SYS-PORTFOLIO-001-FIL-0079`) | WS-ERROR-MESSAGE | — | No |

**Recommended action:** Locate the missing declarations (often a missing copybook) or confirm the source is incomplete.

### Business rules requiring SME review (high)

Each rule below was extracted from the code, but Agent 5 flagged it for SME review. The note is copied from the rules artifact. Full rule text is in Chapter 5 of the BRD.

| Gap | Rule | Program, paragraph (Paragraph ID) | Confidence | SME review note |
|---|---|---|---|---|
| GAP-124 | BR-002 Require batch prerequisites to be satisfied | BCHCTL00, 2000-CHECK-PREREQUISITES (`SYS-PORTFOLIO-001-FIL-0042-PAR-0003`) | Medium | How prerequisites are judged cannot be traced: WS-PREREQ-MET is set only by PERFORM 2200-CHECK-DEPENDENCIES — paragraph not present in the source; PERFORM 2100-READ-CONTROL-RECORD — paragraph not present in the source; program logic_status partial. |
| GAP-125 | BR-003 Route checkpoint requests by entry point | CKPRST, (unnamed) (`SYS-PORTFOLIO-001-FIL-0043-PAR-0001`) | Low | The four condition names ENTRY-POINT-INIT / -TAKE / -COMMIT / -RESTART are declared nowhere in the program or its copybooks (field_id_unresolved), so the selector field and its values are unknown; every routed paragraph is an empty stub; program logic_status partial and would not compile as written. |
| GAP-127 | BR-007 Derive checkpoint totals in the batch control record | HISTLD00, 2310-UPDATE-CHECKPOINT (`SYS-PORTFOLIO-001-FIL-0044-PAR-0011`) | Medium | Target fields BCT-RECORDS-READ and BCT-RECORDS-WRITTEN are not declared in BATCH-CONTROL-RECORD or elsewhere (field_id_unresolved); SME should confirm where the checkpoint totals are stored. |
| GAP-129 | BR-013 Reject process start at the first failed dependency check | PRCSEQ00, 2200-CHECK-DEPENDENCIES (`SYS-PORTFOLIO-001-FIL-0046-PAR-0012`) | Medium | Dependency loop subscript WS-SUB is not declared in PRCSEQ00 or its copybooks (field_id_unresolved). |
| GAP-130 | BR-015 Reject process start while a hard dependency is not done | PRCSEQ00, 2210-CHECK-DEP-STATUS (`SYS-PORTFOLIO-001-FIL-0046-PAR-0013`) | Medium | Dependency table subscript WS-SUB is not declared in scope (field_id_unresolved); capped at medium per partial evidence. |
| GAP-131 | BR-016 Enforce dependency return code does not exceed the allowed maximum | PRCSEQ00, 2210-CHECK-DEP-STATUS (`SYS-PORTFOLIO-001-FIL-0046-PAR-0013`) | Medium | Dependency table subscript WS-SUB is not declared in scope (field_id_unresolved); capped at medium per partial evidence. |
| GAP-137 | BR-034 Calculate position percentage change against previous value | RPTPOS00, 2110-FORMAT-POSITION (`SYS-PORTFOLIO-001-FIL-0049-PAR-0007`) | Medium | Operands POS-CURRENT-VALUE and POS-PREVIOUS-VALUE are not declared in POSREC or any layout in scope (field_id_unresolved), so their source and type are unknown; result field WS-POS-CHANGE-PCT has no Field ID; a zero previous value is not guarded (no ON SIZE ERROR). Transaction activity and summary totals come from 2210/2220/2310/2320/2330 - paragraphs not present in the source. |
| GAP-138 | BR-036 Calculate grand totals of return code counts per fetched program row | RTNANA00, P220-PROCESS-DETAIL (`SYS-PORTFOLIO-001-FIL-0051-PAR-0008`) | Medium | FETCH statement SYS-PORTFOLIO-001-FIL-0051-STMT-000026 is flagged ambiguous upstream (statement_ambiguous): it fetches into numeric-edited fields (PIC ZZZ,ZZ9) that are then used as ADD operands; behaviour is compiler-dependent. |
| GAP-141 | BR-044 Calculate commit, rollback and savepoint statistics counters | DB2CMT, 2100-ISSUE-COMMIT and others (`SYS-PORTFOLIO-001-FIL-0054-PAR-0004`) | Low | Operational statistics counters with no business decision attached; business relevance unclear (signal 2). The counters have no Field IDs listed in the branch map. Savepoint restores are counted as rollbacks. |
| GAP-142 | BR-047 Allow a wait before the next DB2 connection attempt while retries remain | DB2CONN, 1000-CONNECT (`SYS-PORTFOLIO-001-FIL-0055-PAR-0002`) | Medium | The wait is CALL 'DELAY' (STMT-000041), an external routine not present in the source registry (path_unresolvable); its behaviour and the wait length DB2-RETRY-WAIT cannot be traced. |
| GAP-146 | BR-056 Calculate elapsed time and apply 65 percent CPU time estimate | DB2STAT, 3100-CALC-TIMES (`SYS-PORTFOLIO-001-FIL-0057-PAR-0007`) | Medium | The elapsed-time COMPUTE (STMT-000027) is flagged ambiguous upstream (statement_ambiguous): the second NUMVAL lacks the FUNCTION keyword. CPU time is an estimate, not a measurement; SME should confirm the 0.65 factor is intended. |
| GAP-147 | BR-057 Route cursor requests by request type | CURSMGR, (unnamed) (`SYS-PORTFOLIO-001-FIL-0059-PAR-0001`) | Medium | Fetch and close outcomes are unknown: PERFORM P300-FETCH-DATA — paragraph not present in the source; PERFORM P400-CLOSE-CURSOR — paragraph not present in the source (truncated source). |
| GAP-149 | BR-062 Route DB2 recovery requests by recovery request type | DB2RECV, (unnamed) (`SYS-PORTFOLIO-001-FIL-0061-PAR-0001`) | Medium | RECV-CURSOR is ambiguous (field_id_ambiguous): it matches both the 88-level FLD-000008 and the PIC X(18) field FLD-000013, so which one the cursor branch tests cannot be determined; capped at medium per partial evidence. |
| GAP-150 | BR-065 Handle reconnect response by marking recovery success or retry | DB2RECV, P110-ATTEMPT-RECONNECT (`SYS-PORTFOLIO-001-FIL-0061-PAR-0004`) | Medium | Qualification DB2-RESPONSE-CODE OF WS-DB2-REQUEST does not resolve (field_id_unresolved; candidate SYS-PORTFOLIO-001-FIL-0018-FLD-000005): the copybook items belong to their own 01 level. |
| GAP-152 | BR-068 Require an error trace ID and generate one when missing | ERRHNDL, P100-INIT-ERROR-HANDLER (`SYS-PORTFOLIO-001-FIL-0062-PAR-0002`) | Medium | Generation statement MOVE FUNCTION RANDOM TO ERR-TRACE-ID (STMT-000026) is flagged ambiguous (numeric RANDOM into an alphanumeric field); ERRHND is copied into both WS-ERROR-AREA and DFHCOMMAREA and the unqualified ERR-* names make the addressed copy undeterminable (program_partial). |
| GAP-153 | BR-069 Handle error severity by selecting abend, continue or return action | ERRHNDL, P400-DETERMINE-ACTION (`SYS-PORTFOLIO-001-FIL-0062-PAR-0008`) | Medium | ERRHND is copied into both WS-ERROR-AREA and DFHCOMMAREA; the unqualified ERR-* names make it undeterminable which copy is tested and set (program_partial); capped at medium per partial evidence. |
| GAP-155 | BR-071 Handle DB2 recovery result in history inquiry | INQHIST, P150-DB2-CONNECT (`SYS-PORTFOLIO-001-FIL-0063-PAR-0004`) | Medium | The success outcome is unknown — PERFORM P150-DB2-CONNECT THRU P150-EXIT (recursive PERFORM of the active range, listed in unresolvable_paths; behaviour undefined, no retry limit). Field INQCOM-ERROR-MSG OF WS-COMMAREA does not resolve (field_id_unresolved; candidate SYS-PORTFOLIO-001-FIL-0020-FLD-000008). |
| GAP-156 | BR-072 Route inquiry dialogue by function code | INQONLN, P100-PROCESS-REQUEST (`SYS-PORTFOLIO-001-FIL-0064-PAR-0002`) | Medium | Subject WS-COMMAREA-FUNCTION is not declared in INQONLN or its copybooks (field_id_unresolved); the literal values match the INQCOM-FUNCTION 88-levels only by value, not by Field ID; capped at medium per partial evidence. |
| GAP-157 | BR-073 Enforce compliance for inquiry access by ending the session when security fails | INQONLN, P100-PROCESS-REQUEST (`SYS-PORTFOLIO-001-FIL-0064-PAR-0002`) | Medium | Error message target WS-ERROR-MESSAGE is not declared (field_id_unresolved); capped at medium per partial evidence. |
| GAP-158 | BR-077 Route position inquiry result by position-found indicator | INQPORT, (unnamed) (`SYS-PORTFOLIO-001-FIL-0065-PAR-0001`) | Medium | INQCOM-ERROR-MSG OF WS-COMMAREA does not resolve (field_id_unresolved; candidate SYS-PORTFOLIO-001-FIL-0020-FLD-000008) and the read key WS-COMMAREA-ACCOUNT-NO is not declared; capped at medium per partial evidence. |
| GAP-159 | BR-080 Enforce compliance for resource access through the authorisation table | SECMGR, P200-CHECK-AUTH (`SYS-PORTFOLIO-001-FIL-0066-PAR-0004`) | Medium | The count is selected INTO :WS-DB2-AREA (the group holding the SQLCA copy) and compared as a group > 0 (STMT-000006 statement_ambiguous, SME review upstream); WS-DB2-AREA has no Field ID (record-level item). |
| GAP-160 | BR-082 Reject duplicate portfolio keys on batch add | PORTADD, 2100-VALIDATE-AND-ADD (`SYS-PORTFOLIO-001-FIL-0067-PAR-0004`) | Medium | WRITE PORT-RECORD (STMT-000014) is flagged ambiguous upstream (statement_ambiguous): the record name is declared under both FDs; capped at medium per partial evidence. |
| GAP-168 | BR-095 Validate portfolio status is active, inactive or closed | PORTMSTR, 2100-VALIDATE-PORTFOLIO (`SYS-PORTFOLIO-001-FIL-0069-PAR-0004`) | Confirmed | The valid set here is A, I, C (88-level VALID-STATUS in PORTMSTR), while copybook PORTFLIO's PORT-STATUS domain used by PORTADD is A, C, S. SME should confirm which status domain is authoritative and what 'I' and 'S' mean. |
| GAP-171 | BR-098 Report every successful portfolio update to the audit trail | PORTMSTR, 2100-LOG-PORTFOLIO-UPDATE (`SYS-PORTFOLIO-001-FIL-0069-PAR-0011`) | Medium | The audit-request field names (LS-AUDIT-REQUEST, USERID, TERMINAL-ID, PORT-ACCOUNT-NO, WS-BEFORE-IMAGE and others - 35 names) are not declared in PORTMSTR and there are no COPY statements (field_id_unresolved); program_partial: the program would not compile as written, so the audit record content cannot be confirmed. |
| GAP-172 | BR-099 Calculate portfolio listing record count per record read | PORTREAD, 2000-PROCESS (`SYS-PORTFOLIO-001-FIL-0070-PAR-0003`) | Low | Listing counter with no business decision depending on it (signal 2); purpose beyond run reporting is unclear. |
| GAP-173 | BR-100 Report total portfolio records listed at termination | PORTREAD, 2000-PROCESS / 3000-TERMINATE (`SYS-PORTFOLIO-001-FIL-0070-PAR-0003`) | Low | Listing total with no business decision depending on it (signal 2). |
| GAP-174 | BR-101 Cap generated test portfolio records at 100 | PORTTEST, 0000-MAIN (`SYS-PORTFOLIO-001-FIL-0071-PAR-0001`) | Low | Test-data volume cap in a test utility, not a production business rule (signal 2); failed writes are not counted, so the loop may not end. |
| GAP-175 | BR-102 Derive test portfolio ID and account number from the record count | PORTTEST, 2100-GENERATE-KEY (`SYS-PORTFOLIO-001-FIL-0071-PAR-0004`) | Low | Test-data derivation (signal 2); COMPUTE into the alphanumeric PORT-ACCOUNT-NO (STMT-000017) and STRING of 9 characters into the 8-character PORT-ID without ON OVERFLOW (STMT-000015) are flagged ambiguous (statement_ambiguous). |
| GAP-176 | BR-103 Derive test portfolio total value and 10 percent cash balance | PORTTEST, 2400-GENERATE-FINANCIAL-INFO (`SYS-PORTFOLIO-001-FIL-0071-PAR-0007`) | Low | Test-data formula (signal 2); the 10% cash ratio is a test convention whose business meaning is unconfirmed; the COBOL target names are not listed in the branch map (pseudocode names total_value / cash_balance used). |
| GAP-177 | BR-106 Require the transaction's portfolio to exist on the portfolio master | PORTTRAN, 2110-CHECK-PORTFOLIO (`SYS-PORTFOLIO-001-FIL-0072-PAR-0005`) | Medium | Key field PORT-ID comes from COPY PORTREC, which is not in the copybook registry (field_id_unresolved); capped at medium per partial evidence. |
| GAP-178 | BR-111 Route position update by transaction type (unreachable code) | PORTTRAN, 2200-UPDATE-POSITIONS (`SYS-PORTFOLIO-001-FIL-0072-PAR-0008`) | Low | Confirmed dead code: 2200-UPDATE-POSITIONS is never performed (no PERFORM, GO TO or THRU reference), so this routing never executes on any path (program_partial). It documents designed, not actual, behaviour. SME should confirm whether position updates are expected to happen elsewhere. |
| GAP-179 | BR-112 Restrict sale quantity to units held (unreachable code) | PORTTRAN, 2220-PROCESS-SELL (`SYS-PORTFOLIO-001-FIL-0072-PAR-0010`) | Low | Confirmed dead code (2220-PROCESS-SELL is reachable only from the dead 2200-UPDATE-POSITIONS); PORT-TOTAL-UNITS comes from the unresolved COPY PORTREC (field_id_unresolved). The no-short-selling check never executes; SME should confirm whether it is enforced elsewhere. |
| GAP-180 | BR-113 Flag transaction audit action by transaction type (unreachable code) | PORTTRAN, 2300-UPDATE-AUDIT-TRAIL (`SYS-PORTFOLIO-001-FIL-0072-PAR-0013`) | Low | Confirmed dead code (2300-UPDATE-AUDIT-TRAIL is transitively unreachable); no transaction audit record is written by this program. SME should confirm the intended audit mapping (buy=CREATE, sell=DELETE, transfer/fee=UPDATE). |
| GAP-181 | BR-114 Calculate position units and cost by transaction type (unreachable code) | PORTTRAN, 2210/2220/2240 (`SYS-PORTFOLIO-001-FIL-0072-PAR-0009`) | Low | Confirmed dead code (2210/2220/2240 are transitively unreachable); PORT-TOTAL-UNITS and PORT-TOTAL-COST come from the unresolved COPY PORTREC (field_id_unresolved). No position arithmetic is applied on any executable path. |
| GAP-184 | BR-120 Validate portfolio ID numeric suffix | PORTVALD, 1000-VALIDATE-ID (`SYS-PORTFOLIO-001-FIL-0074-PAR-0002`) | Medium | Logic review (review_flag, STMT-000006): characters 5-8 are moved into a 10-character work field, which then holds 4 characters plus spaces, so the NUMERIC test is always true and as written no portfolio ID can pass. SME should confirm the intended suffix length and whether this defect is known. |
| GAP-185 | BR-121 Validate account number is numeric and not zero | PORTVALD, 2000-VALIDATE-ACCOUNT (`SYS-PORTFOLIO-001-FIL-0074-PAR-0003`) | Medium | Logic review (review_flag, STMT-000009): the NUMERIC test covers the whole 50-character input field, so a 10-digit account number followed by spaces is rejected. SME should confirm the intended account-number length. |
| GAP-186 | BR-123 Enforce amount within the minimum and maximum allowed | PORTVALD, 4000-VALIDATE-AMOUNT (`SYS-PORTFOLIO-001-FIL-0074-PAR-0005`) | Medium | Logic review (review_flag): per upstream review the minimum and maximum constants equal the full S9(13)V99 range, so the test cannot be true for a valid numeric value; SME should confirm the intended limits. |
| GAP-187 | BR-124 Route test data generation by configured test type | TSTGEN00, 2100-GENERATE-TEST-DATA (`SYS-PORTFOLIO-001-FIL-0075-PAR-0007`) | Medium | Every generator delegates to paragraphs not present in the source (path_unresolvable): 2210-GEN-PORT-DATA, 2220-WRITE-PORT-RECORD, 2310-GEN-TRAN-DATA, 2320-WRITE-TRAN-RECORD, 2410-GEN-DATA-ERRORS, 2420-GEN-PROCESS-ERRORS, 2510-GEN-LARGE-PORTFOLIO, 2520-GEN-LARGE-TRANSACTION; so no test record is shown to be written. |
| GAP-189 | BR-126 Route test execution by test type | TSTVAL00, 2100-EXECUTE-TEST (`SYS-PORTFOLIO-001-FIL-0076-PAR-0007`) | Medium | All routed test routines are paragraphs not present in the source (path_unresolvable): 2200-RUN-FUNCTIONAL-TEST, 2300-RUN-INTEGRATION-TEST, 2400-RUN-PERFORMANCE-TEST, 2500-RUN-ERROR-TEST, and the follow-on 2600-VALIDATE-RESULTS / 2700-UPDATE-METRICS / 2800-WRITE-TEST-DETAIL. |
| GAP-190 | BR-127 Calculate test success rate percentage | TSTVAL00, 2900-WRITE-SUMMARY (`SYS-PORTFOLIO-001-FIL-0076-PAR-0008`) | Medium | The operands are updated only by PERFORM 2700-UPDATE-METRICS — paragraph not present in the source (path_unresolvable), so how passed and total tests are counted is unknown; division by zero is possible when no tests are counted (no ON SIZE ERROR). |
| GAP-191 | BR-128 Route file maintenance by maintenance function | UTLMNT00, 2100-PROCESS-FUNCTION (`SYS-PORTFOLIO-001-FIL-0077-PAR-0006`) | Medium | All four functions delegate to 11 paragraphs not present in the source (path_unresolvable): 2210-OPEN-VSAM, 2220-ARCHIVE-RECORDS, 2230-CLOSE-VSAM, 2310-ANALYZE-SPACE, 2320-DELETE-OLD, 2330-UPDATE-CATALOG, 2410-EXPORT-DATA, 2420-DELETE-DEFINE, 2430-IMPORT-DATA, 2510-COLLECT-STATS, 2520-GENERATE-REPORT. |
| GAP-192 | BR-129 Allow monitoring alert when a threshold is met | UTLMON00, 2400-GENERATE-ALERTS (`SYS-PORTFOLIO-001-FIL-0078-PAR-0010`) | Medium | The indicator THRESHOLD-MET is set only by the threshold-check paragraphs 2210-CHECK-UTILIZATION .. 2240-CHECK-ERRORS, and the alert is built by PERFORM 2410-FORMAT-ALERT and PERFORM 2420-WRITE-ALERT — all paragraphs not present in the source (path_unresolvable). The thresholds and alert content are unknown. |
| GAP-193 | BR-130 Restrict monitoring cycles to before hour 23 | UTLMON00, 0000-MAIN (`SYS-PORTFOLIO-001-FIL-0078-PAR-0001`) | Low | Signal 2. The loop termination WS-HOUR = 23 is flagged ambiguous upstream (statement_ambiguous): ACCEPT FROM TIME into a group starting with WS-DATE may mean WS-HOUR never receives the hour; CALL 'ILBOABN0' is a system routine not in the registry (path_unresolvable). Most of the monitoring cycle is in paragraphs not present in the source. |
| GAP-194 | BR-131 Route data validation checks by validation type | UTLVAL00, 2100-PROCESS-VALIDATION (`SYS-PORTFOLIO-001-FIL-0079-PAR-0006`) | Medium | The eight check paragraphs are not present in the source (path_unresolvable): 2210/2220 integrity, 2310/2320 cross-reference, 2410/2420 format, 2510-ACCUMULATE-POSITIONS / 2520-VERIFY-BALANCES; the actual validation rules are unknown. |
| GAP-195 | BR-132 Derive program return code 12 when severe errors were counted | ERRHANDL, 8000-CHECK-FINAL-STATUS (`SYS-PORTFOLIO-001-FIL-0081-PAR-0005`) | Medium | Template program. Whether control reaches 8000-CHECK-FINAL-STATUS depends on the preceding abend scenario: CALL 'CEE3ABD' (STMT-000040) is an external routine not in the registry (path_unresolvable). |
| GAP-196 | BR-133 Derive program return code 8 when errors were counted | ERRHANDL, 8000-CHECK-FINAL-STATUS (`SYS-PORTFOLIO-001-FIL-0081-PAR-0005`) | Medium | Template program; reachability depends on CALL 'CEE3ABD' (external routine not in the registry, path_unresolvable). |
| GAP-197 | BR-134 Derive program return code 4 when only warnings were counted | ERRHANDL, 8000-CHECK-FINAL-STATUS (`SYS-PORTFOLIO-001-FIL-0081-PAR-0005`) | Medium | Template program; reachability depends on CALL 'CEE3ABD' (external routine not in the registry, path_unresolvable). |
| GAP-212 | BR-149 Validate portfolio status is active, closed or suspended | copybook PORTFLIO (`SYS-PORTFOLIO-001-FIL-0009`), line 25 | Medium | Inconsistent status domains: copybook PORTFLIO declares A (active) / C (closed) / S (suspended), while PORTMSTR validates A / I / C (BR-095). 'C' could mean closed in both, but 'S' and 'I' each exist in only one. SME should confirm the authoritative portfolio status set. |
| GAP-215 | BR-152 Route DB2 request type as connect, disconnect or status (shared copybook) | copybook DB2REQ (`SYS-PORTFOLIO-001-FIL-0018`), line 6 | Low | Signal 2: the shared copybook DB2REQ declares the same request types as DB2ONLN's own declaration (BR-059), but the only program in scope (DB2RECV) merely moves 'C' into it through an unresolved qualification (BR-065). Purpose of the shared copy is unclear. |
| GAP-216 | BR-153 Select batch control process mode | BCHCTL00 (`SYS-PORTFOLIO-001-FIL-0042`), line 42 (declaration) | Low | Signal 2: the process mode is set in every dispatch branch of BR-001 but never tested in the source present; it would be read only by paragraphs not present in the source, so its effect is unknown. |

**Recommended action (all rows):** Present the extracted rule description to a subject matter expert for confirmation or correction.

---

## Medium severity gaps

### Unstructured flow (GAP-043 to GAP-052)

These programs call groups of paragraphs as ranges ("PERFORM ... THRU", where control runs from the first named paragraph through to the last). No program uses GO TO or ALTER. Flow tracing across ranges is approximated.

| Gap | Program (File ID) | Construct | Related rules |
|---|---|---|---|
| GAP-043 | RTNANA00 (`SYS-PORTFOLIO-001-FIL-0051`) | 6 THRU ranges | — |
| GAP-044 | RTNCDE00 (`SYS-PORTFOLIO-001-FIL-0052`) | 5 THRU ranges (STMT-000027 to 000031) | BR-038 |
| GAP-045 | CURSMGR (`SYS-PORTFOLIO-001-FIL-0059`) | 4 THRU ranges (STMT-000013 to 000016) | BR-057 |
| GAP-046 | DB2ONLN (`SYS-PORTFOLIO-001-FIL-0060`) | THRU ranges nested 3 levels deep | BR-059 |
| GAP-047 | DB2RECV (`SYS-PORTFOLIO-001-FIL-0061`) | THRU ranges and an early loop exit | BR-062, BR-063 |
| GAP-048 | ERRHNDL (`SYS-PORTFOLIO-001-FIL-0062`) | 4 THRU ranges (STMT-000001 to 000004) | BR-068, BR-069 |
| GAP-049 | INQHIST (`SYS-PORTFOLIO-001-FIL-0063`) | 7 THRU ranges, one recursive | BR-070, BR-071 |
| GAP-050 | INQONLN (`SYS-PORTFOLIO-001-FIL-0064`) | 7 THRU ranges | BR-072 |
| GAP-051 | INQPORT (`SYS-PORTFOLIO-001-FIL-0065`) | 4 THRU ranges | BR-077 |
| GAP-052 | SECMGR (`SYS-PORTFOLIO-001-FIL-0066`) | 3 THRU ranges | BR-078 |

**Recommended action:** Map the ranges manually; consider refactoring them into structured calls before modernisation.

### Run-time conditional transfers (GAP-053 to GAP-055)

The online programs register CICS (the online transaction monitor) error handlers with HANDLE CONDITION: when a listed condition occurs, CICS jumps to the named paragraph. These jumps happen only at run time and are drawn only as uncertain runtime edges.

| Gap | Program | Conditions → handler | Statement | Note |
|---|---|---|---|---|
| GAP-053 | INQHIST (`SYS-PORTFOLIO-001-FIL-0063`) | ERROR → P999-ERROR-ROUTINE (`SYS-PORTFOLIO-001-FIL-0063-PAR-0012`) | STMT-000008, line 86 | No CICS RETURN coded on that path |
| GAP-054 | INQONLN (`SYS-PORTFOLIO-001-FIL-0064`) | ERROR, PGMIDERR, NOTFND → P900-ERROR-ROUTINE (`SYS-PORTFOLIO-001-FIL-0064-PAR-0010`) | STMT-000001, line 40 | Does not return to the failing command |
| GAP-055 | INQPORT (`SYS-PORTFOLIO-001-FIL-0065`) | ERROR → P999-ERROR-ROUTINE (`SYS-PORTFOLIO-001-FIL-0065-PAR-0010`); NOTFND → P900-NOT-FOUND | STMT-000007, line 61 | Agent 4 dismissed the parser's dead-code candidates P999-ERROR-ROUTINE / P999-EXIT for this reason |

**Recommended action:** Confirm the intended handling; replace handler registration with explicit response checks before modernisation.

### Ambiguous data references (GAP-056 to GAP-059)

| Gap | Program | Name(s) | Evidence (candidate IDs are evidence only) | Related rules | SME |
|---|---|---|---|---|---|
| GAP-056 | DB2RECV (`SYS-PORTFOLIO-001-FIL-0061`) | RECV-CURSOR (lines 56, 128) declared twice | SYS-PORTFOLIO-001-FIL-0061-FLD-000013, SYS-PORTFOLIO-001-FIL-0061-FLD-000008 | BR-062 | Yes |
| GAP-057 | TSTGEN00 (`SYS-PORTFOLIO-001-FIL-0075`) | WS-PORT-STATUS, WS-TRAN-STATUS each declared twice | SYS-PORTFOLIO-001-FIL-0075-FLD-000005 / -000022; SYS-PORTFOLIO-001-FIL-0075-FLD-000006 / -000028 | — | No |
| GAP-058 | ERRHNDL (`SYS-PORTFOLIO-001-FIL-0062`) | 14 ERR-* names; error copybook copied into both working storage and the communication area | records SYS-PORTFOLIO-001-FIL-0062-REC-0001, SYS-PORTFOLIO-001-FIL-0062-REC-0004 | BR-068, BR-069 | Yes |
| GAP-059 | PORTADD (`SYS-PORTFOLIO-001-FIL-0067`) | PORT-RECORD declared under both files (STMT-000010, 000014) | — | BR-082 | Yes |

### Suspected logic defects (GAP-060 to GAP-082)

Agent 4 warned that the code as written may not behave as intended. These are findings about the code, not confirmed defects; each needs developer confirmation.

| Gap | Program (File ID) | Finding | Statement(s) / line | Related rules | SME |
|---|---|---|---|---|---|
| GAP-060 | PRCSEQ00 (`…FIL-0046`) | Build loop ends only on status '10' (may not end on repeated read errors); sequence table (100 entries) and dependency table (10 entries) not bounds-checked | STMT-000026 (line 168), STMT-000031, STMT-000037 | BR-010, BR-015, BR-016, BR-022 | No |
| GAP-061 | RCVPRC00 (`…FIL-0047`) | Error routine does not stop processing; recovery continues after a record is not found; nested I/O in browse loops | PAR-0005; STMT-000046, 000049 | BR-028 to BR-030 | Yes |
| GAP-062 | RPTAUD00 (`…FIL-0048`) | Error handler ends the program inside a called step without closing files | STMT-000030 (line 147) | — | No |
| GAP-063 | RPTSTA00 (`…FIL-0050`) | Error handler ends with return code 12 without closing files; writes not status-checked | STMT-000035 (line 185) | — | No |
| GAP-064 | RTNANA00 (`…FIL-0051`) | Fetch loop ends only on SQL code 100 | STMT-000014 (line 144) | BR-035, BR-036 | No |
| GAP-065 | AUDPROC (`…FIL-0053`) | Header move overwrites the audit timestamp; file closed after failed open | STMT-000010, STMT-000023 | BR-143 to BR-145 | Yes |
| GAP-066 | DB2STAT (`…FIL-0057`) | 8 selected columns do not line up with an 11-item host structure | STMT-000030 (line 190) | BR-055 | No |
| GAP-067 | DB2ONLN (`…FIL-0060`) | Status response code overwritten unconditionally | STMT-000016 (line 117) | BR-059, BR-061 | No |
| GAP-068 | DB2RECV (`…FIL-0061`) | No default branch for unknown recovery request types | STMT-000001 (line 48) | BR-062 | No |
| GAP-069 | INQHIST (`…FIL-0063`) | Processing continues after a failed DB2 recovery | STMT-000042 (line 119) | BR-070, BR-071 | Yes |
| GAP-070 | SECMGR (`…FIL-0066`) | Authorisation count selected into a group and compared as text | STMT-000006 (line 79) | BR-080 | Yes |
| GAP-071 | PORTADD (`…FIL-0067`) | Processing loop still runs after an open failure | STMT-000023 (line 100) | BR-084, BR-085 | No |
| GAP-072 | PORTDEL (`…FIL-0068`) | Processing loop runs on closed files after an open failure | STMT-000031 (line 126) | BR-088, BR-089 | Yes |
| GAP-073 | PORTMSTR (`…FIL-0069`) | Error paragraph ends the run inside a called step; error text never returned | STMT-000037 (line 237), PAR-0009 | BR-090, BR-091 | No |
| GAP-074 | PORTREAD (`…FIL-0070`) | Read loop runs on an unopened file after an open failure | STMT-000021 (line 81) | BR-099, BR-100 | No |
| GAP-075 | PORTTEST (`…FIL-0071`) | Generation loop never ends on persistent write failure | STMT-000002 (line 48) | BR-101 | No |
| GAP-076 | PORTTRAN (`…FIL-0072`) | Error record passed to ERRPROC is 370 bytes vs ERRPROC's 354-byte interface | STMT-000064 (line 316) | BR-104 | Yes |
| GAP-077 | PORTUPDT (`…FIL-0073`) | Unknown action still rewritten; text value moved to a number; loop runs after open failure | STMT-000013, 000030, 000022 | BR-116, BR-117 | No |
| GAP-078 | PORTVALD (`…FIL-0074`) | ID numeric check cannot succeed; account check rejects padded values; amount range cannot fail | STMT-000006 (line 63), STMT-000009 (line 77) | BR-120, BR-121, BR-123 | Yes |
| GAP-079 | TSTVAL00 (`…FIL-0076`) | Success rate may divide by zero | STMT-000031 (line 212) | BR-127 | Yes |
| GAP-080 | UTLMON00 (`…FIL-0078`) | Loop end condition (hour = 23) may never be met | STMT-000002 (line 130) | BR-130 | Yes |
| GAP-081 | UTLVAL00 (`…FIL-0079`) | Error handler never stops the run; error line may precede report open | PAR-0012 (line 186) | BR-131 | Yes |
| GAP-082 | DB2HNDL (`…FIL-0080`) | Cursor loop does not handle negative SQL codes (template) | STMT-000022 (line 165) | — | No |

(`…FIL-00NN` abbreviates `SYS-PORTFOLIO-001-FIL-00NN`; statement IDs are prefixed by the same File ID, e.g. `SYS-PORTFOLIO-001-FIL-0046-STMT-000026`.)

**Recommended action:** Review each finding with the developers before modernisation; record which behaviour is intended.

### Unsupported or non-standard constructs (GAP-083 to GAP-090)

| Gap | Program | Construct | Statement(s) / line | Related rules | SME |
|---|---|---|---|---|---|
| GAP-083 | CKPRST (`…FIL-0043`) | Parameter received as a level-05 group | — | BR-003 | No |
| GAP-084 | RTNANA00 (`…FIL-0051`) | Fetch into display-formatted numbers then used in additions | STMT-000026 (line 170) | BR-036 | Yes |
| GAP-085 | DB2STAT (`…FIL-0057`) | NUMVAL without FUNCTION keyword; host-structure mismatch | STMT-000027 (line 181), STMT-000030 | BR-056 | Yes |
| GAP-086 | DB2ERR (`…FIL-0056`) | Non-standard ACCEPT FROM TIME STAMP | STMT-000004 (line 75) | BR-050 | Yes |
| GAP-087 | DB2ONLN (`…FIL-0060`) | STRING with the same field as sender and receiver | STMT-000009 (line 85) | BR-059 | Yes |
| GAP-088 | ERRHNDL (`…FIL-0062`) | RANDOM into an alphanumeric trace ID; overlapping STRING | STMT-000026, STMT-000021 | BR-068 | Yes |
| GAP-089 | PORTTEST (`…FIL-0071`) | 9 characters into 8; RANDOM into a 1-digit subscript; COMPUTE into text | STMT-000015, 000016, 000017 | BR-102 | No |
| GAP-090 | PORTMSTR (`…FIL-0069`) | File declares 100-byte records; layout totals 103 bytes (record `SYS-PORTFOLIO-001-FIL-0069-REC-0001`) | line 31 | — | No |

### GAP-091 — REL-002: PORT-ID link between the PORTFLIO record and the PORTMSTR record is unconfirmed
**Type:** Unconfirmed relationship (confidence low) | **Records:** `SYS-PORTFOLIO-001-FIL-0009-REC-0001` (PORTFLIO PORT-RECORD) and `SYS-PORTFOLIO-001-FIL-0069-REC-0001` (PORTMSTR PORTFOLIO-RECORD)

Both records contain PORT-ID, but type or length differ, and the two programs use conflicting portfolio status domains (A/I/C vs A/C/S; BR-095, BR-149). **Impact:** It is not confirmed that the batch maintenance programs and PORTMSTR maintain the same master file. **Recommended action:** Validate with the data architect. *SME review required.*

### GAP-092 — Visual rendering of the 65 Mermaid diagrams is unverified
**Type:** Diagram render unverified | **Scope:** all 65 diagrams

Agent 6 checked the diagram files structurally only. **Recommended action:** Render all 65 files with Mermaid v10 or later before publishing.

---

## Low severity gaps

### Confirmed dead code (GAP-093 to GAP-096)

| Gap | Program | Unreachable paragraph(s) | Note |
|---|---|---|---|
| GAP-093 | PORTTRAN (`SYS-PORTFOLIO-001-FIL-0072`) | 2200-UPDATE-POSITIONS (`SYS-PORTFOLIO-001-FIL-0072-PAR-0008`) and its callees 2210/2220/2230/2240 (PAR-0009 to PAR-0012) and the audit-trail paragraphs | No position update or audit write executes; BR-111 to BR-114 describe this unreachable logic. *SME review required.* |
| GAP-094 | PORTMSTR (`SYS-PORTFOLIO-001-FIL-0069`) | 2100-HANDLE-VSAM-ERROR (`SYS-PORTFOLIO-001-FIL-0069-PAR-0010`) | Source comment calls it an example |
| GAP-095 | FILEHNDL (`SYS-PORTFOLIO-001-FIL-0082`) | 2100-READ-VSAM, 2200-WRITE-VSAM, 2300-READ-SEQUENTIAL (PAR-0004 to PAR-0006) | Template examples |
| GAP-096 | PROGNAME (`SYS-PORTFOLIO-001-FIL-0083`) | 9000-HANDLE-ERROR (`SYS-PORTFOLIO-001-FIL-0083-PAR-0005`) | Template |

**Recommended action:** Confirm with the development team whether the code is intentionally retired or accidentally unreachable.

### GAP-097 — ERRHNDL: PROGRAM-ID found only through the file name
The source (`SYS-PORTFOLIO-001-FIL-0062`) is free-format; the declared ID on line 2 equals the fallback ID used. No action needed beyond noting the format.

### GAP-098 — SQLCODE / SQLERRMC have no Field ID in 14 DB2 programs
HISTLD00, RTNANA00, RTNCDE00, DB2CMT, DB2CONN, DB2ERR, DB2STAT, CURSMGR, DB2ONLN, DB2RECV, ERRHNDL, INQHIST, SECMGR and DB2HNDL test the standard DB2 result fields, which the DB2 precompiler supplies; they are not defined in the repository (see GAP-002). SQL result tests are documented by their standard meaning (0 success, +100 no row found, negative error).

### Diagram limitations (GAP-099 to GAP-123)

"Display" means detail was left out of the drawing only to keep it readable; it is not missing business logic and remains in the logic files and Appendix B.

| Gap | Diagram | Kind | Cause | Limitation (from the diagram index) | Related gaps |
|---|---|---|---|---|---|
| GAP-099 | FLOW-HISTLD00 | Truncated | display | 7 paragraphs folded into step nodes (20-node limit) | GAP-109 |
| GAP-100 | FLOW-PRCSEQ00 | Truncated | display | 10 paragraphs folded into step and rule nodes | — |
| GAP-101 | FLOW-RCVPRC00 | Truncated | display | 10 paragraphs represented by rule/step nodes; three rewrites drawn as one step | — |
| GAP-102 | FLOW-PORTMSTR | Truncated | display | Validation detailed in FLOW-PORTMSTR-VALIDATION | — |
| GAP-103 | FLOW-PORTTRAN | Truncated | display | Split into overview, validation and unreachable-logic diagrams | — |
| GAP-104 | COMP-UNRESOLVED | Incomplete | source | All seven edges point at targets not in the repository | GAP-003 to GAP-009 |
| GAP-105 | COMP-PORTTRAN | Incomplete | source | PORTREC unresolved; AUDPROC call and rewrites in dead code | GAP-003, GAP-093 |
| GAP-106 | COMP-DB2CONN | Incomplete | source | DELAY call unsupported | GAP-007 |
| GAP-107 | SEQ-INQONLN-HISTORY | Incomplete | source + analysis | Cursor fetch/close missing; recursion stops tracing; routing uncertain | GAP-015, GAP-016, GAP-035 |
| GAP-108 | FLOW-BCHCTL00 | Incomplete | source | 11 placeholders; no file I/O traceable | GAP-010 |
| GAP-109 | FLOW-HISTLD00 | Incomplete | analysis | DB2 paragraphs not registered; flow after error routine not drawn | GAP-011, GAP-029 |
| GAP-110 | FLOW-POSUPDT | Incomplete | source | Empty source; 2-node placeholder | GAP-001 |
| GAP-111 | FLOW-RPTAUD00 | Incomplete | source | 7 missing paragraphs | GAP-012, GAP-031 |
| GAP-112 | FLOW-RPTPOS00 | Incomplete | source | 5 missing paragraphs; 5 undeclared names | GAP-013, GAP-032 |
| GAP-113 | FLOW-RPTSTA00 | Incomplete | source | 7 missing paragraphs; DB2STAT layout missing | GAP-005, GAP-014 |
| GAP-114 | FLOW-DB2CONN | Incomplete | source | DELAY unsupported; CONNECT step has no Statement ID | GAP-007 |
| GAP-115 | FLOW-CURSMGR | Incomplete | source | Source cut off at line 91 | GAP-015 |
| GAP-116 | FLOW-TSTGEN00 | Incomplete | source + display | 8 placeholders; open checks summarised | GAP-017, GAP-057 |
| GAP-117 | FLOW-TSTVAL00 | Incomplete | source + display | 7 placeholders; open checks summarised | GAP-018, GAP-079 |
| GAP-118 | FLOW-UTLMNT00 | Incomplete | source + display | 11 placeholders; open checks summarised | GAP-019 |
| GAP-119 | FLOW-UTLMON00 | Incomplete | source + analysis + display | 13 placeholders; ILBOABN0; DB2STAT layout | GAP-006, GAP-008, GAP-020 |
| GAP-120 | FLOW-UTLVAL00 | Incomplete | source + display | 8 placeholders | GAP-021, GAP-081 |
| GAP-121 | FLOW-DB2HNDL | Incomplete | source | Row handler missing | GAP-022, GAP-082 |
| GAP-122 | FLOW-ERRHANDL | Incomplete | analysis | CEE3ABD return untraceable | GAP-009 |
| GAP-123 | FLOW-FILEHNDL | Incomplete | analysis | Recursive call stops tracing | GAP-023, GAP-024 |

### Medium-confidence business rules (low)

These rules are likely correct but rest on medium-strength evidence and were not flagged for SME review; validation is recommended.

| Gap | Rule | Program, paragraph (Paragraph ID) | Basis |
|---|---|---|---|
| GAP-126 | BR-006 Calculate history load counters per record | HISTLD00, 2100-READ-HISTORY / 2200-LOAD-TO-DB2 (`SYS-PORTFOLIO-001-FIL-0044-PAR-0009`) | Medium, complete evidence |
| GAP-128 | BR-012 Route no-ready-process outcome when the sequence is exhausted | PRCSEQ00, 2100-FIND-NEXT-READY (`SYS-PORTFOLIO-001-FIL-0046-PAR-0011`) | Medium, complete evidence |
| GAP-132 | BR-017 Check sequence table entry matches the control record job name | PRCSEQ00, 3200-UPDATE-SEQUENCE-TABLE (`SYS-PORTFOLIO-001-FIL-0046-PAR-0016`) | Medium, complete evidence |
| GAP-133 | BR-018 Calculate count of active processes per sequence entry | PRCSEQ00, 3300-CHECK-COMPLETION (`SYS-PORTFOLIO-001-FIL-0046-PAR-0017`) | Medium, complete evidence |
| GAP-134 | BR-019 Calculate count of failed processes per sequence entry | PRCSEQ00, 3300-CHECK-COMPLETION (`SYS-PORTFOLIO-001-FIL-0046-PAR-0017`) | Medium, complete evidence |
| GAP-135 | BR-022 Derive process sequence number from load order | PRCSEQ00, 1210-ADD-TO-SEQUENCE (`SYS-PORTFOLIO-001-FIL-0046-PAR-0009`) | Medium, complete evidence |
| GAP-136 | BR-032 Select recovery completion message by return code | RCVPRC00, 3100-UPDATE-FINAL-STATUS (`SYS-PORTFOLIO-001-FIL-0047-PAR-0017`) | Medium, complete evidence |
| GAP-139 | BR-037 Derive return code analysis report totals line | RTNANA00, P300-GENERATE-REPORT (`SYS-PORTFOLIO-001-FIL-0051-PAR-0010`) | Medium, complete evidence |
| GAP-140 | BR-041 Calculate return code count, maximum and minimum within a time window | RTNCDE00, P500-ANALYZE-CODES (`SYS-PORTFOLIO-001-FIL-0052-PAR-0010`) | Medium, complete evidence |
| GAP-143 | BR-049 Calculate DB2 connection retry count per failed attempt | DB2CONN, 1000-CONNECT (`SYS-PORTFOLIO-001-FIL-0055-PAR-0002`) | Medium, complete evidence |
| GAP-144 | BR-052 Handle unlisted DB2 error severity by SQL code sign | DB2ERR, 1100-SET-SEVERITY (`SYS-PORTFOLIO-001-FIL-0056-PAR-0003`) | Medium, complete evidence |
| GAP-145 | BR-054 Handle unlisted DB2 error diagnosis by SQL code sign | DB2ERR, 2000-DIAGNOSE-ERROR (`SYS-PORTFOLIO-001-FIL-0056-PAR-0005`) | Medium, complete evidence |
| GAP-148 | BR-061 Calculate active online DB2 connection count | DB2ONLN, P110-ESTABLISH-CONNECTION / P200-PROCESS-DISCONNECT (`SYS-PORTFOLIO-001-FIL-0060-PAR-0004`) | Medium, complete evidence |
| GAP-151 | BR-067 Calculate DB2 reconnect retry count per failed attempt | DB2RECV, P100-RECOVER-CONNECTION (`SYS-PORTFOLIO-001-FIL-0061-PAR-0002`) | Medium, complete evidence |
| GAP-154 | BR-070 Handle online DB2 connection failure by requesting DB2 recovery | INQHIST, P150-DB2-CONNECT (`SYS-PORTFOLIO-001-FIL-0063-PAR-0004`) | Medium, complete evidence |
| GAP-161 | BR-084 Calculate portfolio add outcome counters per input record | PORTADD, 2100-VALIDATE-AND-ADD (`SYS-PORTFOLIO-001-FIL-0067-PAR-0004`) | Medium, complete evidence |
| GAP-162 | BR-085 Report portfolio add run totals at termination | PORTADD, 2100 / 3000-TERMINATE (`SYS-PORTFOLIO-001-FIL-0067-PAR-0004`) | Medium, complete evidence |
| GAP-163 | BR-086 Require portfolio to exist before applying a deletion request | PORTDEL, 2100-PROCESS-DELETE (`SYS-PORTFOLIO-001-FIL-0068-PAR-0004`) | Medium, complete evidence |
| GAP-164 | BR-088 Calculate portfolio deletion outcome counters per request | PORTDEL, 2200-DELETE-RECORD (`SYS-PORTFOLIO-001-FIL-0068-PAR-0005`) | Medium, complete evidence |
| GAP-165 | BR-089 Report portfolio deletion run totals at termination | PORTDEL, 2200 / 3000-TERMINATE (`SYS-PORTFOLIO-001-FIL-0068-PAR-0005`) | Medium, complete evidence |
| GAP-166 | BR-091 Require portfolio validation to pass before create or update | PORTMSTR, 2000-CREATE-PORTFOLIO (`SYS-PORTFOLIO-001-FIL-0069-PAR-0003`) | Medium, complete evidence |
| GAP-167 | BR-092 Reject creation of a portfolio ID that already exists | PORTMSTR, 2000-CREATE-PORTFOLIO (`SYS-PORTFOLIO-001-FIL-0069-PAR-0003`) | Medium, complete evidence |
| GAP-169 | BR-096 Require portfolio to exist when reading | PORTMSTR, 3000-READ-PORTFOLIO (`SYS-PORTFOLIO-001-FIL-0069-PAR-0005`) | Medium, complete evidence |
| GAP-170 | BR-097 Reject update or deletion of a portfolio that does not exist | PORTMSTR, 4000-UPDATE / 5000-DELETE (`SYS-PORTFOLIO-001-FIL-0069-PAR-0006`) | Medium, complete evidence |
| GAP-182 | BR-115 Calculate transaction read, processed and error counts per transaction | PORTTRAN, 2000/2100/9000 (`SYS-PORTFOLIO-001-FIL-0072-PAR-0003`) | Medium, complete evidence |
| GAP-183 | BR-116 Require portfolio to exist before applying an update transaction | PORTUPDT, 2100-PROCESS-UPDATE (`SYS-PORTFOLIO-001-FIL-0073-PAR-0004`) | Medium, complete evidence |
| GAP-188 | BR-125 Cap utility error count at 100 before ending with return code 12 | TSTGEN00 and UTLMNT00, 9999-ERROR-HANDLER (`SYS-PORTFOLIO-001-FIL-0075-PAR-0013`, `SYS-PORTFOLIO-001-FIL-0077-PAR-0012`) | Medium, complete evidence |
| GAP-198 | BR-135 Validate checkpoint status is a declared checkpoint status | copybook CKPRST (`SYS-PORTFOLIO-001-FIL-0003`), line 12 | Medium, declared value domain |
| GAP-199 | BR-136 Validate checkpoint phase is a declared processing phase | copybook CKPRST (`SYS-PORTFOLIO-001-FIL-0003`), line 28 | Medium, declared value domain |
| GAP-200 | BR-137 Validate checkpoint restart mode is normal, restart or recover | copybook CKPRST (`SYS-PORTFOLIO-001-FIL-0003`), line 45 | Medium, declared value domain |
| GAP-201 | BR-138 Validate process type is initialisation, processing, report or termination | copybook PRCSEQ (`SYS-PORTFOLIO-001-FIL-0004`), line 13 | Medium, declared value domain |
| GAP-202 | BR-139 Validate process run frequency is daily, weekly or monthly | copybook PRCSEQ (`SYS-PORTFOLIO-001-FIL-0004`), line 19 | Medium, declared value domain |
| GAP-203 | BR-140 Validate process active-day pattern | copybook PRCSEQ (`SYS-PORTFOLIO-001-FIL-0004`), line 41 | Medium, declared value domain |
| GAP-204 | BR-141 Flag month-end-only processes | copybook PRCSEQ (`SYS-PORTFOLIO-001-FIL-0004`), line 45 | Medium, declared value domain |
| GAP-205 | BR-142 Validate process holiday-run indicator is skip or run | copybook PRCSEQ (`SYS-PORTFOLIO-001-FIL-0004`), line 47 | Medium, declared value domain |
| GAP-206 | BR-143 Report audit record type | copybook AUDITLOG (`SYS-PORTFOLIO-001-FIL-0005`), line 15 | Medium, declared value domain |
| GAP-207 | BR-144 Report audit action as a declared audit action | copybook AUDITLOG (`SYS-PORTFOLIO-001-FIL-0005`), line 19 | Medium, declared value domain |
| GAP-208 | BR-145 Report audit outcome status | copybook AUDITLOG (`SYS-PORTFOLIO-001-FIL-0005`), line 28 | Medium, declared value domain |
| GAP-209 | BR-146 Validate history record type | copybook HISTREC (`SYS-PORTFOLIO-001-FIL-0008`), line 14 | Medium, declared value domain |
| GAP-210 | BR-147 Validate history action code | copybook HISTREC (`SYS-PORTFOLIO-001-FIL-0008`), line 18 | Medium, declared value domain |
| GAP-211 | BR-148 Validate client type is individual, corporate or trust | copybook PORTFLIO (`SYS-PORTFOLIO-001-FIL-0009`), line 18 | Medium, declared value domain |
| GAP-213 | BR-150 Validate position status is active, closed or pending | copybook POSREC (`SYS-PORTFOLIO-001-FIL-0011`), line 17 | Medium, declared value domain |
| GAP-214 | BR-151 Validate transaction status is pending, done, failed or reversed | copybook TRNREC (`SYS-PORTFOLIO-001-FIL-0014`), line 24 | Medium, declared value domain |
| GAP-217 | BR-154 Report portfolio deletion reason | PORTDEL (`SYS-PORTFOLIO-001-FIL-0068`), line 50 (declaration) | Medium, declared value domain |

**Recommended action (all rows):** Confirm the rule with a business analyst or developer familiar with the domain.

---

## Assumptions

| ID | Assumption | Basis | Confidence |
|---|---|---|---|
| ASM-001 | Program type (batch, batch subprogram, online, online subprogram) is taken from the entry type recorded by Agent 4, because Agent 1 classified all 42 programs as subtype "unknown". | inventory_artifact issues (subtype_unclassified); logic files execution_traces.entry_type; diagrams_artifact COMP-OVERVIEW limitations | Medium |
| ASM-002 | The 20 value-domain rules BR-135 to BR-154 are declared value lists (88-level condition names), not executable checks in the programs that include their copybooks. | rules_artifact rules_by_program_note and rule set RS-014 description | High |
| ASM-003 | The maximum restart count for recovery (BCT-MAX-RESTARTS) is 3, as stated by the Agent 4 narrative for the BCHCON constant. | rules_artifact BR-029 threshold_value note | Medium |
| ASM-004 | SQLCODE and SQLERRMC have their standard DB2 meaning and are supplied by the precompiler's SQLCA. | logic files trace_issues (field_id_unresolved, SQLCODE) | Medium |
| ASM-005 | Relationship cardinalities in the entity-relationship diagrams follow the diagram skill's type table and are assumed, not measured; copy-expansion relationships are drawn one-to-one. | diagrams_artifact ERD-MAIN and ERD-DB2-WORK-AREAS limitations | Medium |
| ASM-006 | Seven duplicate rules were merged by name (for example the 100-error cap in HISTLD00 and PORTTRAN, BR-004); each merged rule carries a merge note. | rules_artifact meta.duplicates_merged_detail | High |
| ASM-007 | DB2HNDL, ERRHANDL, FILEHNDL and PROGNAME are templates (under `src/templates`), not business programs; PORTTEST, TSTGEN00 and TSTVAL00 are test tools. | inventory_artifact file paths; logic file narratives | High |
| ASM-008 | Several subprograms (CKPRST, RTNCDE00, PORTVALD, RCVPRC00, PRCSEQ00) have no caller in the repository; they are assumed to be called from outside the analysed code. | diagrams_artifact COMP-OVERVIEW-ISOLATED, COMP-RCVPRC00 and COMP-PRCSEQ00 limitations | Medium |

---

## Permanent ID verification

Every distinct full permanent ID cited in `gaps_register.json` and `brd.md` was checked read-only against the source registry with the query `verify-diagram-source-ids`, in one batch on 2026-10-31.

| Kind | Checked | Bad |
|---|---|---|
| File IDs | 83 | 0 |
| Path IDs | 50 | 0 |
| Section IDs | 0 | 0 |
| Paragraph IDs | 158 | 0 |
| Statement IDs | 305 | 0 |
| Record IDs | 89 | 0 |
| Field IDs | 188 | 0 |
| **Total** | **873** | **0** |

Result: **consistent = true**; no ID was removed. Abbreviated Field ID references in the BRD tables (for example `…-FLD-000007` following a full ID of the same file) are shorthand for IDs of that file and were not sent separately.
