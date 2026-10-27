# Gaps and assumptions register

**System:** Portfolio management system (SYS-PORTFOLIO-001)
**Generated:** 2026-10-27T02:54:19Z
**Total gaps:** 322 (6 critical, 154 high, 79 medium, 83 low)
**Items requiring SME review:** 227

Each gap keeps the permanent source IDs (System, File, Path, Paragraph, Statement, Record and Field IDs) of the elements it concerns; IDs are shown without the `SYS-PORTFOLIO-001-` prefix in this register (full IDs are in `gaps_register.json`). **Cause** says whether a gap comes from missing or external COBOL source (*source*), from analysis that could not be completed statically or depends on run time (*analysis*), or from a diagram display limit (*display*).

---

## Summary

### By severity and type

| Gap type | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| SME_REVIEW_REQUIRED | 0 | 81 | 0 | 0 | 81 |
| UNDECLARED_DATA_NAME | 0 | 47 | 0 | 0 | 47 |
| SUSPECTED_LOGIC_DEFECT | 0 | 0 | 38 | 0 | 38 |
| DIAGRAM_INCOMPLETE | 0 | 0 | 0 | 23 | 23 |
| UNSUPPORTED_CONSTRUCT | 0 | 0 | 18 | 0 | 18 |
| MEDIUM_CONFIDENCE_RULE | 0 | 0 | 0 | 17 | 17 |
| PRECOMPILER_PROVIDED | 0 | 0 | 0 | 14 | 14 |
| UNRESOLVABLE_PATH | 0 | 14 | 0 | 0 | 14 |
| DIAGRAM_TRUNCATED | 0 | 0 | 0 | 13 | 13 |
| UNSTRUCTURED_FLOW | 0 | 0 | 10 | 0 | 10 |
| PSEUDOCODE_ISSUE | 0 | 0 | 0 | 8 | 8 |
| INVALID_QUALIFICATION | 0 | 7 | 0 | 0 | 7 |
| AMBIGUOUS_DATA_REFERENCE | 0 | 0 | 7 | 0 | 7 |
| UNRESOLVED_COPYBOOK | 4 | 0 | 1 | 0 | 5 |
| DEAD_CODE_CONFIRMED | 0 | 0 | 0 | 4 | 4 |
| RUNTIME_CONDITIONAL_TRANSFER | 0 | 0 | 3 | 0 | 3 |
| UNRESOLVED_CALL | 0 | 3 | 0 | 0 | 3 |
| DEAD_CODE | 0 | 0 | 0 | 2 | 2 |
| RULE_NOT_DIAGRAMMED | 0 | 0 | 0 | 1 | 1 |
| MISSING_PROGRAM_ID | 0 | 0 | 0 | 1 | 1 |
| REDEFINES_MISMATCH | 0 | 1 | 0 | 0 | 1 |
| RECURSIVE_PERFORM | 0 | 1 | 0 | 0 | 1 |
| INFINITE_LOOP_RISK | 1 | 0 | 0 | 0 | 1 |
| UNCONFIRMED_RELATIONSHIP | 0 | 0 | 1 | 0 | 1 |
| EMPTY_SOURCE | 1 | 0 | 0 | 0 | 1 |
| DIAGRAM_RENDER_UNVERIFIED | 0 | 0 | 1 | 0 | 1 |
| **Total** | **6** | **154** | **79** | **83** | **322** |

### By cause

| Cause | Gaps | Meaning |
|---|---|---|
| source | 165 | COBOL source missing, empty, truncated or outside the repository |
| analysis | 136 | Unresolved or ambiguous references, runtime-only behaviour, uncertain rules or suspected defects |
| display | 21 | Diagram display limits (node caps, splits, summary nodes, rendering not verified) |

### By program

| Program | Critical | High | Medium | Low | Total | Gap IDs |
|---|---|---|---|---|---|---|
| (system-wide) | 0 | 0 | 8 | 5 | 13 | GAP-161, GAP-168, GAP-211, GAP-222, GAP-223, GAP-224, GAP-225, GAP-226, GAP-240, GAP-241, GAP-246, GAP-247, GAP-248 |
| AUDITLOG | 0 | 3 | 0 | 0 | 3 | GAP-016, GAP-017, GAP-018 |
| AUDPROC | 0 | 0 | 1 | 0 | 1 | GAP-172 |
| BCHCTL | 0 | 1 | 0 | 0 | 1 | GAP-019 |
| BCHCTL, CKPRST, PRCSEQ, AUDITLOG, HISTREC, PORTFLIO, POSREC, RETHND, RTNCODE, TRNREC, DBTBLS, DB2REQ, ERRHND, INQCOM (copybooks) | 0 | 0 | 0 | 1 | 1 | GAP-322 |
| BCHCTL00 | 0 | 5 | 1 | 1 | 7 | GAP-020, GAP-021, GAP-022, GAP-023, GAP-144, GAP-173, GAP-249 |
| CKPRST | 0 | 8 | 1 | 0 | 9 | GAP-024, GAP-025, GAP-026, GAP-027, GAP-097, GAP-098, GAP-099, GAP-100, GAP-174 |
| CURSMGR | 0 | 3 | 2 | 3 | 8 | GAP-028, GAP-029, GAP-145, GAP-212, GAP-227, GAP-250, GAP-282, GAP-300 |
| DB2CMT | 0 | 0 | 1 | 1 | 2 | GAP-175, GAP-301 |
| DB2CONN | 0 | 2 | 0 | 2 | 4 | GAP-030, GAP-158, GAP-283, GAP-302 |
| DB2ERR | 0 | 1 | 1 | 4 | 6 | GAP-031, GAP-162, GAP-284, GAP-285, GAP-303, GAP-314 |
| DB2HNDL | 0 | 1 | 1 | 2 | 4 | GAP-146, GAP-176, GAP-251, GAP-304 |
| DB2ONLN | 0 | 0 | 4 | 2 | 6 | GAP-177, GAP-178, GAP-179, GAP-213, GAP-269, GAP-305 |
| DB2RECV | 0 | 7 | 2 | 3 | 12 | GAP-007, GAP-008, GAP-009, GAP-032, GAP-033, GAP-034, GAP-035, GAP-163, GAP-214, GAP-270, GAP-306, GAP-315 |
| DB2REQ | 0 | 1 | 0 | 0 | 1 | GAP-036 |
| DB2STAT | 0 | 0 | 1 | 2 | 3 | GAP-180, GAP-307, GAP-316 |
| DBTBLS | 0 | 2 | 0 | 0 | 2 | GAP-037, GAP-038 |
| ERRHANDL | 0 | 3 | 0 | 4 | 7 | GAP-039, GAP-040, GAP-159, GAP-252, GAP-286, GAP-287, GAP-288 |
| ERRHND | 0 | 1 | 0 | 0 | 1 | GAP-041 |
| ERRHNDL | 0 | 1 | 4 | 2 | 7 | GAP-042, GAP-164, GAP-181, GAP-215, GAP-228, GAP-299, GAP-308 |
| ERRPROC | 0 | 0 | 1 | 0 | 1 | GAP-182 |
| FILEHNDL | 0 | 2 | 0 | 2 | 4 | GAP-014, GAP-147, GAP-242, GAP-253 |
| HISTLD00 | 0 | 18 | 1 | 3 | 22 | GAP-043, GAP-101, GAP-102, GAP-103, GAP-104, GAP-105, GAP-106, GAP-107, GAP-108, GAP-109, GAP-110, GAP-111, GAP-112, GAP-113, GAP-114, GAP-115, GAP-116, GAP-148, GAP-183, GAP-254, GAP-271, GAP-309 |
| HISTREC | 0 | 2 | 0 | 0 | 2 | GAP-044, GAP-045 |
| INQCOM | 0 | 1 | 0 | 0 | 1 | GAP-046 |
| INQHIST | 0 | 5 | 2 | 5 | 12 | GAP-010, GAP-011, GAP-047, GAP-117, GAP-149, GAP-169, GAP-216, GAP-255, GAP-256, GAP-272, GAP-310, GAP-317 |
| INQONLN | 0 | 7 | 2 | 2 | 11 | GAP-048, GAP-049, GAP-050, GAP-051, GAP-052, GAP-118, GAP-119, GAP-170, GAP-217, GAP-273, GAP-318 |
| INQPORT | 1 | 6 | 3 | 0 | 10 | GAP-003, GAP-012, GAP-013, GAP-053, GAP-054, GAP-120, GAP-121, GAP-171, GAP-184, GAP-218 |
| PORTADD | 0 | 0 | 2 | 0 | 2 | GAP-165, GAP-185 |
| PORTDEL | 0 | 2 | 2 | 0 | 4 | GAP-055, GAP-056, GAP-186, GAP-229 |
| PORTFLIO | 0 | 2 | 0 | 0 | 2 | GAP-057, GAP-058 |
| PORTMSTR | 0 | 4 | 2 | 2 | 8 | GAP-015, GAP-059, GAP-122, GAP-123, GAP-187, GAP-210, GAP-243, GAP-289 |
| PORTREAD | 0 | 0 | 1 | 0 | 1 | GAP-188 |
| PORTTEST | 0 | 0 | 4 | 1 | 5 | GAP-189, GAP-190, GAP-191, GAP-230, GAP-290 |
| PORTTRAN | 1 | 4 | 1 | 4 | 10 | GAP-004, GAP-060, GAP-061, GAP-062, GAP-063, GAP-231, GAP-244, GAP-257, GAP-274, GAP-291 |
| PORTUPDT | 0 | 0 | 3 | 0 | 3 | GAP-192, GAP-193, GAP-232 |
| PORTVALD | 0 | 2 | 4 | 0 | 6 | GAP-064, GAP-065, GAP-194, GAP-195, GAP-196, GAP-233 |
| POSREC | 0 | 1 | 0 | 0 | 1 | GAP-066 |
| POSUPDT | 1 | 0 | 0 | 1 | 2 | GAP-001, GAP-258 |
| PRCSEQ | 0 | 7 | 0 | 0 | 7 | GAP-067, GAP-068, GAP-069, GAP-070, GAP-071, GAP-072, GAP-073 |
| PRCSEQ00 | 0 | 6 | 3 | 7 | 16 | GAP-074, GAP-075, GAP-076, GAP-077, GAP-078, GAP-124, GAP-197, GAP-198, GAP-234, GAP-275, GAP-292, GAP-293, GAP-294, GAP-295, GAP-296, GAP-297 |
| PROGNAME | 0 | 0 | 0 | 2 | 2 | GAP-245, GAP-319 |
| RCVPRC00 | 0 | 1 | 2 | 2 | 5 | GAP-079, GAP-199, GAP-235, GAP-276, GAP-298 |
| RETHND | 0 | 3 | 0 | 0 | 3 | GAP-080, GAP-081, GAP-082 |
| RPTAUD00 | 0 | 4 | 1 | 1 | 6 | GAP-125, GAP-126, GAP-127, GAP-150, GAP-236, GAP-259 |
| RPTPOS00 | 0 | 6 | 3 | 1 | 10 | GAP-128, GAP-129, GAP-130, GAP-131, GAP-132, GAP-151, GAP-200, GAP-201, GAP-237, GAP-260 |
| RPTSTA00 | 1 | 6 | 2 | 1 | 10 | GAP-005, GAP-133, GAP-134, GAP-135, GAP-136, GAP-137, GAP-152, GAP-202, GAP-238, GAP-261 |
| RTNANA00 | 0 | 0 | 2 | 3 | 5 | GAP-203, GAP-219, GAP-277, GAP-311, GAP-320 |
| RTNCDE00 | 0 | 0 | 1 | 2 | 3 | GAP-220, GAP-278, GAP-312 |
| RTNCODE | 0 | 1 | 0 | 0 | 1 | GAP-083 |
| SECMGR | 0 | 1 | 3 | 2 | 6 | GAP-084, GAP-204, GAP-221, GAP-239, GAP-313, GAP-321 |
| TRNREC | 0 | 2 | 0 | 0 | 2 | GAP-085, GAP-086 |
| TSTGEN00 | 0 | 4 | 3 | 2 | 9 | GAP-087, GAP-088, GAP-138, GAP-153, GAP-166, GAP-167, GAP-205, GAP-262, GAP-279 |
| TSTVAL00 | 0 | 4 | 1 | 1 | 6 | GAP-089, GAP-090, GAP-139, GAP-154, GAP-206, GAP-263 |
| UTLMNT00 | 0 | 4 | 1 | 1 | 6 | GAP-091, GAP-092, GAP-140, GAP-155, GAP-207, GAP-264 |
| UTLMON00 | 2 | 5 | 0 | 3 | 10 | GAP-002, GAP-006, GAP-093, GAP-094, GAP-141, GAP-156, GAP-160, GAP-265, GAP-266, GAP-280 |
| UTLVAL00 | 0 | 5 | 2 | 3 | 10 | GAP-095, GAP-096, GAP-142, GAP-143, GAP-157, GAP-208, GAP-209, GAP-267, GAP-268, GAP-281 |

---

## Critical gaps — must resolve before BRD sign-off

### GAP-001 — POSUPDT: source file is empty (1 byte of whitespace)
**Type:** EMPTY_SOURCE | **Program:** POSUPDT | **Cause:** source | **SME review:** Yes

The source file src/programs/batch/POSUPDT.cbl is 1 byte (a single blank, no line terminator): no PROGRAM-ID, no divisions and no PROCEDURE DIVISION. Agent 4 logic_status is 'empty'; nothing was traced and no records or fields were registered. The program name POSUPDT is a filename fallback from the inventory.

**Impact:** POSUPDT's behaviour is entirely absent from the BRD: no execution path, branch, data access or error handling can be described.

**Recommended action:** Obtain the real POSUPDT source from the source library or confirm with the development team that the member is obsolete; re-run the pipeline for it if found.

**Source IDs:** File FIL-0045

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| POSUPDT |  |  |  |  |
| POSUPDT |  |  |  | src/programs/batch/POSUPDT.cbl |
| POSUPDT |  |  |  |  |

**Related:** Gaps: GAP-258 | Diagrams: FLOW-POSUPDT

**Detected in:** rules_artifact, logic_artifact, parser_artifact, data_artifact, inventory_artifact, diagrams_artifact | **Also:** MISSING_PROGRAM_ID

---

### GAP-002 — UTLMON00: main loop UNTIL WS-HOUR = 23 may never end
**Type:** INFINITE_LOOP_RISK | **Program:** UTLMON00 | **Paragraph:** 0000-MAIN | **Line:** 130 | **Cause:** source | **SME review:** Yes

PERFORM 2000-PROCESS UNTIL WS-HOUR = 23 (line 130, STMT-000002, 0000-MAIN) has termination_pattern POTENTIAL_INFINITE_LOOP. The only statement that changes WS-HOUR is ACCEPT WS-TIMESTAMP FROM TIME (line 169, performed at line 136 and at the end of each iteration, line 187). TIME supplies 8 digits HHMMSShh; received by the 16-byte group WS-TIMESTAMP it is placed left-justified in WS-DATE and WS-TIME (including WS-HOUR, bytes 9-10) is space-filled, so WS-HOUR would never equal 23. Whether the unresolved paragraphs or the external CALL 'ILBOABN0' change WS-HOUR or end the program cannot be determined. Flagged ambiguous for SME review.

**Impact:** The monitor may run indefinitely — critical operational risk.

**Recommended action:** Review the loop termination field — confirm it is always set within the loop body (here: how WS-HOUR receives the time), and whether ILBOABN0 or the missing paragraphs end the run.

**Source IDs:** File FIL-0078; Paragraphs FIL-0078-PAR-0001, FIL-0078-PAR-0006; Statements FIL-0078-STMT-000002, FIL-0078-STMT-000016; Fields FIL-0078-FLD-000046

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLMON00 | 0000-MAIN | 130 | FIL-0078-STMT-000002 |  |
| UTLMON00 | 0000-MAIN | 130 | FIL-0078-STMT-000002 | PERFORM 2000-PROCESS UNTIL WS-HOUR = 23 |

**Related:** Rules: BR-094

**Detected in:** rules_artifact, logic_artifact | **Also:** 

---

### GAP-003 — INQPORT includes SQLPOS (EXEC SQL INCLUDE), which is not in the repository
**Type:** UNRESOLVED_COPYBOOK | **Program:** INQPORT | **Line:** 21 | **Cause:** source | **SME review:** No

Program INQPORT has EXEC SQL INCLUDE SQLPOS END-EXEC at line 21, inside 01 WS-DB2-POSITION (WORKING-STORAGE). SQLPOS is not in the copybook registry: the inventory SQL_INCLUDE edge is resolved:false and Agent 3 left it as an unresolved stub, so WS-DB2-POSITION has no registered fields and total_bytes 0. The Agent 6 flow notes that SQLPOS is not used by any procedure statement. This INQPORT->SQLPOS edge is drawn in no diagram (audit D-3): INQPORT is not a top-10 program and the overview leaves out include edges; it is disclosed in the diagram index issues.

**Impact:** The DB2 host-variable layout WS-DB2-POSITION of INQPORT is unknown. Because the edge appears in no diagram, the BRD text is the only place this gap is visible.

**Recommended action:** Locate the missing copybook in a load library, external PDS, or vendor-supplied library. Add to repo and re-run Data Agent.

**Source IDs:** File FIL-0065; Records FIL-0065-REC-0003

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQPORT |  | 21 |  | SQLPOS (SQL_INCLUDE under WS-DB2-POSITION) |
| INQPORT |  | 21 |  | SQLPOS |

**Related:** Diagrams: FLOW-INQPORT

**Detected in:** logic_artifact, data_artifact, parser_artifact, inventory_artifact, diagrams_artifact, agent6_quality_audit | **Also:** UNRESOLVED_REFERENCE

---

### GAP-004 — PORTTRAN: COPY PORTREC cannot be resolved; PORTFOLIO-FILE has no record layout
**Type:** UNRESOLVED_COPYBOOK | **Program:** PORTTRAN | **Line:** 40 | **Cause:** source | **SME review:** No

COPY PORTREC (line 40, under FD PORTFOLIO-FILE) names a copybook that is not in the inventory copybook_registry; no USES_COPYBOOK or EXPANDS_COPY is registered, so FD PORTFOLIO-FILE has no record layout. RECORD KEY PORT-ID (SELECT PORTFOLIO-FILE, line 27) is declared nowhere else. Names expected from PORTREC have no Field/Record ID: PORT-ID (2110-CHECK-PORTFOLIO, 2210-PROCESS-BUY, 2220-PROCESS-SELL, 2240-PROCESS-FEE), PORT-TOTAL-UNITS (2210, 2220), PORT-TOTAL-COST (2210, 2220, 2240), PORTFOLIO-RECORD (2210, 2220, 2240), PORT-ACCOUNT-NO (2300-UPDATE-AUDIT-TRAIL). PORT-RECORD (2300-UPDATE-AUDIT-TRAIL) is also unresolved; Agent 4 states its origin is not known (possibly PORTREC) and that the REWRITE statements name PORTFOLIO-RECORD, a different name.

**Impact:** The portfolio master record layout used by the transaction program is unknown; portfolio look-up (reachable) and position updates (unreachable paragraphs) cannot be fully described.

**Recommended action:** Locate the missing copybook PORTREC in a load library, external PDS, or vendor-supplied library. Add to repo and re-run Data Agent.

**Source IDs:** File FIL-0072; Paragraphs FIL-0072-PAR-0005, FIL-0072-PAR-0009, FIL-0072-PAR-0010, FIL-0072-PAR-0012, FIL-0072-PAR-0013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTTRAN |  | 40 |  | COPY PORTREC (FD PORTFOLIO-FILE) |
| PORTTRAN |  | 27 |  | RECORD KEY PORT-ID |
| PORTTRAN | 2110-CHECK-PORTFOLIO |  |  | PORT-ID |
| PORTTRAN | 2210-PROCESS-BUY |  |  | PORT-ID, PORT-TOTAL-UNITS, PORT-TOTAL-COST, PORTFOLIO-RECORD |
| PORTTRAN | 2220-PROCESS-SELL |  |  | PORT-ID, PORT-TOTAL-UNITS, PORT-TOTAL-COST, PORTFOLIO-RECORD |
| PORTTRAN | 2240-PROCESS-FEE |  |  | PORT-ID, PORT-TOTAL-COST, PORTFOLIO-RECORD |
| PORTTRAN | 2300-UPDATE-AUDIT-TRAIL |  |  | PORT-ACCOUNT-NO, PORT-RECORD (origin not known) |
| PORTTRAN |  | 40 |  | PORTREC |
| PORTTRAN |  | 27 |  | PORT-ID |

**Related:** Rules: BR-072, BR-073, BR-079, BR-080 | Gaps: GAP-257 | Diagrams: COMP-PORTTRAN, FLOW-PORTTRAN, FLOW-PORTTRAN-PART2, FLOW-PORTTRAN-PART3

**Detected in:** logic_artifact, data_artifact, inventory_artifact, parser_artifact, diagrams_artifact | **Also:** UNRESOLVED_REFERENCE, UNDECLARED_DATA_NAME

---

### GAP-005 — RPTSTA00 copies DB2STAT, which exists only as a program, not as a copybook
**Type:** UNRESOLVED_COPYBOOK | **Program:** RPTSTA00 | **Line:** 35 | **Cause:** source | **SME review:** Yes

Program RPTSTA00 has COPY DB2STAT at line 35 in the FILE SECTION, before any FD. No copybook DB2STAT exists; the name matches program src/programs/common/DB2STAT.cbl (SYS-PORTFOLIO-001-FIL-0057). The inventory marked the edge resolved per its registry lookup rule but logged copy_target_not_copybook; Agent 3 left it as an unresolved copy stub (no USES_COPYBOOK or EXPANDS_COPY). SELECT DB2-STATS (line 17) and SELECT BATCH-STATS (line 23) therefore have no FD/record, and RECORD KEY STAT-KEY (line 20) and BCH-KEY (line 26) are not declared in the program or in the expanded copybooks BCHCTL, RTNCODE, ERRHAND ('DB2STAT is unresolved').

**Impact:** The record layouts of the DB2 statistics and batch statistics files read by the report, and their keys, are unknown.

**Recommended action:** Locate the missing copybook in a load library, external PDS, or vendor-supplied library. Add to repo and re-run Data Agent.

**Source IDs:** File FIL-0050

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 |  | 35 |  | DB2STAT |
| RPTSTA00 |  | 35 |  | DB2STAT |
| RPTSTA00 |  | 20 |  | STAT-KEY |
| RPTSTA00 |  | 26 |  | BCH-KEY |

**Related:** Gaps: GAP-134, GAP-135, GAP-136, GAP-152, GAP-224, GAP-238, GAP-261 | Diagrams: COMP-DB2STAT, FLOW-RPTSTA00

**Detected in:** logic_artifact, data_artifact, parser_artifact, inventory_artifact, diagrams_artifact | **Also:** UNDECLARED_DATA_NAME

---

### GAP-006 — UTLMON00 copies DB2STAT, which exists only as a program, not as a copybook
**Type:** UNRESOLVED_COPYBOOK | **Program:** UTLMON00 | **Line:** 43 | **Cause:** source | **SME review:** Yes

Program UTLMON00 has COPY DB2STAT at line 43 directly in the FILE SECTION before any FD. No copybook DB2STAT exists; the name matches program DB2STAT (SYS-PORTFOLIO-001-FIL-0057). The inventory marked the edge resolved per its registry lookup rule but logged copy_target_not_copybook; Agent 3 left it as an unresolved copy stub. SELECT DB2-STATS (line 35) has no FD/record in this program, and RECORD KEY STAT-KEY (line 38) is not declared in the program or in the expanded copybooks RTNCODE, ERRHAND ('DB2STAT is unresolved').

**Impact:** The layout of the DB2 statistics file used by the monitor, and its key, are unknown.

**Recommended action:** Locate the missing copybook in a load library, external PDS, or vendor-supplied library. Add to repo and re-run Data Agent.

**Source IDs:** File FIL-0078

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLMON00 |  | 43 |  | COPY DB2STAT |
| UTLMON00 |  | 38 |  | RECORD KEY STAT-KEY |
| UTLMON00 |  | 43 |  | DB2STAT |
| UTLMON00 |  | 38 |  | STAT-KEY |

**Related:** Gaps: GAP-156, GAP-224, GAP-265 | Diagrams: COMP-DB2STAT, FLOW-UTLMON00

**Detected in:** logic_artifact, data_artifact, parser_artifact, inventory_artifact, diagrams_artifact | **Also:** UNDECLARED_DATA_NAME

---

## High severity gaps

### GAP-007 — DB2RECV: DB2-REQUEST-TYPE OF WS-DB2-REQUEST is an invalid qualification
**Type:** INVALID_QUALIFICATION | **Program:** DB2RECV | **Paragraph:** P110-ATTEMPT-RECONNECT | **Line:** 86 | **Cause:** analysis | **SME review:** Yes

DB2-REQUEST-TYPE OF WS-DB2-REQUEST (line 86, P110-ATTEMPT-RECONNECT): resolve-field-references returned UNRESOLVED with unresolved_reason QUALIFIER_HOLDS_LEVEL01_COPY. WS-DB2-REQUEST holds COPY DB2REQ, whose record DB2-REQUEST-AREA begins with its own 01, so the field is not subordinate to the qualifier. target_id null; the candidate is evidence for review, not a match.

**Impact:** The request type passed to DB2ONLN on reconnect cannot be traced to a confirmed field.

**Recommended action:** Confirm with the development team how WS-DB2-REQUEST and copybook DB2REQ are meant to be combined, and which field the reference addresses.

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0004; Statements FIL-0061-STMT-000007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2RECV | P110-ATTEMPT-RECONNECT | 86 | FIL-0061-STMT-000007 | DB2-REQUEST-TYPE OF WS-DB2-REQUEST |

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-008 — DB2RECV: DB2-RESPONSE-CODE OF WS-DB2-REQUEST is an invalid qualification
**Type:** INVALID_QUALIFICATION | **Program:** DB2RECV | **Paragraph:** P110-ATTEMPT-RECONNECT | **Line:** 93 | **Cause:** analysis | **SME review:** Yes

DB2-RESPONSE-CODE OF WS-DB2-REQUEST (line 93, P110-ATTEMPT-RECONNECT): UNRESOLVED, unresolved_reason QUALIFIER_HOLDS_LEVEL01_COPY (WS-DB2-REQUEST holds COPY DB2REQ, whose record begins with its own 01); target_id null.

**Impact:** The DB2ONLN response code tested after a reconnect attempt cannot be traced to a confirmed field.

**Recommended action:** Confirm with the development team how WS-DB2-REQUEST and copybook DB2REQ are meant to be combined, and which field the reference addresses.

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0004; Statements FIL-0061-STMT-000009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2RECV | P110-ATTEMPT-RECONNECT | 93 | FIL-0061-STMT-000009 | DB2-RESPONSE-CODE OF WS-DB2-REQUEST |

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-009 — DB2RECV: DB2-SQLCODE OF WS-DB2-REQUEST is an invalid qualification
**Type:** INVALID_QUALIFICATION | **Program:** DB2RECV | **Paragraph:** P110-ATTEMPT-RECONNECT | **Line:** 98 | **Cause:** analysis | **SME review:** Yes

DB2-SQLCODE OF WS-DB2-REQUEST (line 98, P110-ATTEMPT-RECONNECT): UNRESOLVED, unresolved_reason QUALIFIER_HOLDS_LEVEL01_COPY (WS-DB2-REQUEST holds COPY DB2REQ, whose record begins with its own 01); target_id null.

**Impact:** The SQL code copied after a failed reconnect cannot be traced to a confirmed field.

**Recommended action:** Confirm with the development team how WS-DB2-REQUEST and copybook DB2REQ are meant to be combined, and which field the reference addresses.

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0004; Statements FIL-0061-STMT-000033

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2RECV | P110-ATTEMPT-RECONNECT | 98 | FIL-0061-STMT-000033 | DB2-SQLCODE OF WS-DB2-REQUEST |

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-010 — INQHIST: INQCOM-ERROR-MSG OF WS-COMMAREA is not a valid qualification
**Type:** INVALID_QUALIFICATION | **Program:** INQHIST | **Paragraph:** P150-DB2-CONNECT | **Line:** 117 | **Cause:** source | **SME review:** Yes

At line 117 (statement STMT-000041) in P150-DB2-CONNECT the reference INQCOM-ERROR-MSG OF WS-COMMAREA is UNRESOLVED with unresolved_reason QUALIFIER_HOLDS_LEVEL01_COPY: WS-COMMAREA holds COPY INQCOM, whose record INQCOM-AREA begins with its own 01, so the field is not subordinate to the qualifier. target_id is null. Agent 3 also records that COPY INQCOM is expanded twice (WORKING-STORAGE line 15 and LINKAGE line 67) without REPLACING.

**Impact:** The field written by this statement has no Field ID; data lineage for the COMMAREA error message is uncertain.

**Recommended action:** Confirm with the development team which INQCOM-ERROR-MSG is meant (the working-storage or linkage copy) and how the compiler resolves this qualification.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0004; Statements FIL-0063-STMT-000041

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQHIST | P150-DB2-CONNECT | 117 | FIL-0063-STMT-000041 | INQCOM-ERROR-MSG OF WS-COMMAREA |

**Related:** Rules: BR-053 | Gaps: GAP-223

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-011 — INQHIST: INQCOM-RESPONSE-CODE OF WS-COMMAREA is not a valid qualification
**Type:** INVALID_QUALIFICATION | **Program:** INQHIST | **Paragraph:** P999-ERROR-ROUTINE | **Line:** 189 | **Cause:** source | **SME review:** Yes

At line 189 (statement STMT-000029) in P999-ERROR-ROUTINE the reference INQCOM-RESPONSE-CODE OF WS-COMMAREA is UNRESOLVED with unresolved_reason QUALIFIER_HOLDS_LEVEL01_COPY (WS-COMMAREA holds COPY INQCOM, whose record begins with its own 01). target_id is null.

**Impact:** The response code set by the error routine has no Field ID; data lineage for the COMMAREA response code is uncertain.

**Recommended action:** Confirm with the development team which INQCOM-RESPONSE-CODE is meant and how the compiler resolves this qualification.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0012; Statements FIL-0063-STMT-000029

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQHIST | P999-ERROR-ROUTINE | 189 | FIL-0063-STMT-000029 | INQCOM-RESPONSE-CODE OF WS-COMMAREA |

**Related:** Gaps: GAP-223

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-012 — INQPORT: INQCOM-ERROR-MSG OF WS-COMMAREA is not a valid qualification
**Type:** INVALID_QUALIFICATION | **Program:** INQPORT | **Paragraph:** P900-NOT-FOUND | **Line:** 98 | **Cause:** source | **SME review:** Yes

INQCOM-ERROR-MSG OF WS-COMMAREA is UNRESOLVED with unresolved_reason QUALIFIER_HOLDS_LEVEL01_COPY: WS-COMMAREA holds COPY INQCOM, which begins with its own 01 INQCOM-AREA, so the field is not subordinate to WS-COMMAREA. It occurs in P900-NOT-FOUND (annotation line 97, statement STMT-000015) and P999-ERROR-ROUTINE (annotation line 104, statement STMT-000018); trace_issues gives lines 98 and 105. target_id null.

**Impact:** The not-found and error messages returned to the caller have no Field ID; lineage of the COMMAREA message is uncertain.

**Recommended action:** Confirm with the development team which INQCOM-ERROR-MSG is meant (working-storage or linkage copy of INQCOM) and how the compiler resolves this qualification.

**Source IDs:** File FIL-0065; Paragraphs FIL-0065-PAR-0008, FIL-0065-PAR-0010; Statements FIL-0065-STMT-000015, FIL-0065-STMT-000018

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQPORT | P900-NOT-FOUND | 98 | FIL-0065-STMT-000015 | INQCOM-ERROR-MSG OF WS-COMMAREA |
| INQPORT | P999-ERROR-ROUTINE | 105 | FIL-0065-STMT-000018 | INQCOM-ERROR-MSG OF WS-COMMAREA |

**Related:** Gaps: GAP-223

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-013 — INQPORT: INQCOM-RESPONSE-CODE OF WS-COMMAREA is not a valid qualification
**Type:** INVALID_QUALIFICATION | **Program:** INQPORT | **Paragraph:** P999-ERROR-ROUTINE | **Line:** 107 | **Cause:** source | **SME review:** Yes

INQCOM-RESPONSE-CODE OF WS-COMMAREA (line 107, P999-ERROR-ROUTINE) is UNRESOLVED with unresolved_reason QUALIFIER_HOLDS_LEVEL01_COPY (same cause as INQCOM-ERROR-MSG). target_id null. The logic file gives no statement ID for line 107; the P999 annotation at line 104 (STMT-000018) names both references.

**Impact:** The response code set by the error routine has no Field ID.

**Recommended action:** Confirm with the development team which INQCOM-RESPONSE-CODE is meant and how the compiler resolves this qualification.

**Source IDs:** File FIL-0065; Paragraphs FIL-0065-PAR-0010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQPORT | P999-ERROR-ROUTINE | 107 |  | INQCOM-RESPONSE-CODE OF WS-COMMAREA |

**Related:** Gaps: GAP-223

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-014 — FILEHNDL: circular PERFORM 3000-TERMINATE -> 9000-CHECK-FILE-STATUS -> 9100/9200 -> 3000-TERMINATE
**Type:** RECURSIVE_PERFORM | **Program:** FILEHNDL | **Paragraph:** 3000-TERMINATE | **Line:** 156 | **Cause:** source | **SME review:** Yes

3000-TERMINATE (line 156, STMT-000016) performs 9000-CHECK-FILE-STATUS, whose error branches perform 9100-VSAM-ERROR / 9200-SEQ-ERROR, which perform 3000-TERMINATE again (lines 179, 187) while it is still active. Agent 4 states a recursive PERFORM has undefined behaviour in COBOL; if a CLOSE fails, the second CLOSE of already-closed files fails again and the chain can repeat. Tracing of this path stopped at the recursive PERFORM. 9100-VSAM-ERROR and 9200-SEQ-ERROR end the run with GOBACK. This cycle is not one of the program's unresolvable_paths (those are the 2 missing targets).

**Impact:** Termination behaviour after a file CLOSE error is undefined and may repeat.

**Recommended action:** Confirm with the development team the intended error handling on CLOSE failure; consider removing the recursive PERFORM before modernisation.

**Source IDs:** File FIL-0082; Paragraphs FIL-0082-PAR-0008, FIL-0082-PAR-0007, FIL-0082-PAR-0009, FIL-0082-PAR-0010; Statements FIL-0082-STMT-000017, FIL-0082-STMT-000018, FIL-0082-STMT-000019, FIL-0082-STMT-000016, FIL-0082-STMT-000033, FIL-0082-STMT-000034, FIL-0082-STMT-000035, FIL-0082-STMT-000022, FIL-0082-STMT-000026

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| FILEHNDL | 9000-CHECK-FILE-STATUS | 163 | FIL-0082-STMT-000017 |  |
| FILEHNDL | 9000-CHECK-FILE-STATUS | 167 | FIL-0082-STMT-000018 |  |
| FILEHNDL | 9000-CHECK-FILE-STATUS | 171 | FIL-0082-STMT-000019 |  |
| FILEHNDL | 3000-TERMINATE | 156 | FIL-0082-STMT-000016 | 9000-CHECK-FILE-STATUS |
| FILEHNDL | 9100-VSAM-ERROR | 179 |  | 3000-TERMINATE |
| FILEHNDL | 9200-SEQ-ERROR | 187 |  | 3000-TERMINATE |

**Detected in:** rules_artifact, logic_artifact, parser_artifact | **Also:** 

---

### GAP-015 — PORTMSTR: FD PORTFOLIO-FILE declares 100 characters but its record computes to 103 bytes
**Type:** REDEFINES_MISMATCH | **Program:** PORTMSTR | **Line:** 32 | **Cause:** source | **SME review:** Yes

Agent 3 reports record_contains_mismatch: FD PORTFOLIO-FILE declares RECORD CONTAINS 100 CHARACTERS (line 32), but its record PORTFOLIO-RECORD (lines 33-39) computes to 103 bytes (10+50+10+1+8 packed S9(13)V99 COMP-3 +24 FILLER).

**Impact:** The physical record length of the portfolio master file is inconsistent; field offsets at the end of the record may not match the stored data.

**Recommended action:** Confirm the actual record length of the portfolio master file with the DBA or file definitions and correct the layout or the RECORD CONTAINS clause.

**Source IDs:** File FIL-0069; Records FIL-0069-REC-0001

**Detected in:** data_artifact | **Also:** 

---

### GAP-016 — BR-110 Report audit record type as transaction, user action or system event — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** AUDITLOG | **Line:** 15 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Report audit record type as transaction, user action or system event. The audit log record defines the audit types transaction ('TRAN'), user action ('USER') and system event ('SYST'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0005; Fields FIL-0005-FLD-000007, FIL-0005-FLD-000008, FIL-0005-FLD-000009, FIL-0005-FLD-000010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 15 |  |  |
|  |  | 16 |  |  |
|  |  | 17 |  |  |

**Related:** Rules: BR-110, BR-111, BR-112

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-017 — BR-111 Report audit action code from the defined action list — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** AUDITLOG | **Line:** 19 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Report audit action code from the defined action list. The audit log record defines the actions create, update, delete, inquire, login, logout, startup and shutdown (8-character codes); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0005; Fields FIL-0005-FLD-000011, FIL-0005-FLD-000012, FIL-0005-FLD-000013, FIL-0005-FLD-000014, FIL-0005-FLD-000015, FIL-0005-FLD-000016, FIL-0005-FLD-000017, FIL-0005-FLD-000018, FIL-0005-FLD-000019

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 19 |  |  |
|  |  | 20 |  |  |
|  |  | 21 |  |  |
|  |  | 22 |  |  |
|  |  | 23 |  |  |
|  |  | 24 |  |  |
|  |  | 25 |  |  |
|  |  | 26 |  |  |

**Related:** Rules: BR-080, BR-110, BR-111

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-018 — BR-112 Report audit outcome status as success, failure or warning — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** AUDITLOG | **Line:** 28 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Report audit outcome status as success, failure or warning. The audit log record defines the outcome statuses success ('SUCC'), failure ('FAIL') and warning ('WARN'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0005; Fields FIL-0005-FLD-000020, FIL-0005-FLD-000021, FIL-0005-FLD-000022, FIL-0005-FLD-000023

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 28 |  |  |
|  |  | 29 |  |  |
|  |  | 30 |  |  |

**Related:** Rules: BR-110, BR-112

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-019 — BR-099 Validate batch control status is a defined status code — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** BCHCTL | **Line:** 16 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate batch control status is a defined status code. Copybook BCTREC defines the batch control status values ready ('R'), active ('A'), waiting ('W') and error ('E') as condition names; none of them is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0002; Fields FIL-0002-FLD-000006, FIL-0002-FLD-000007, FIL-0002-FLD-000008, FIL-0002-FLD-000009, FIL-0002-FLD-000011

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 16 |  |  |
|  |  | 17 |  |  |
|  |  | 18 |  |  |
|  |  | 20 |  |  |

**Related:** Rules: BR-012, BR-099

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-020 — BR-001 Route batch control requests by function code — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** BCHCTL00 | **Paragraph:** 0000-MAIN | **Line:** 61 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Route batch control requests by function code. The program dispatches on the caller's four-character function code (LS-FUNCTION): 'INIT' sets initialize mode and performs 1000-PROCESS-INITIALIZE, 'CHEK' performs 2000-CHECK-PREREQUISITES, 'UPDT' performs 3000-UPDATE-STATUS and 'TERM' performs 4000-PROCESS-TERMINATE; any other code is rejected with 'Invalid function code' and return code 8 via the error routine. The detailed work of the four functions is in paragraphs not present in the source. Implemented in program BCHCTL00, paragraph 0000-MAIN.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0042; Paragraphs FIL-0042-PAR-0001; Statements FIL-0042-STMT-000001; Fields FIL-0042-FLD-000011, FIL-0042-FLD-000012, FIL-0042-FLD-000013, FIL-0042-FLD-000014, FIL-0042-FLD-000015

**Related:** Rules: BR-001, BR-002

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-021 — BR-002 Check batch prerequisites are satisfied — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** BCHCTL00 | **Paragraph:** 2000-CHECK-PREREQUISITES | **Line:** 93 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Check batch prerequisites are satisfied. When the prerequisite flag is satisfied (WS-PREREQ-MET = 'Y'), the system returns success (0) to the caller; otherwise it returns a warning (4). How the flag is set cannot be determined from the present code. Implemented in program BCHCTL00, paragraph 2000-CHECK-PREREQUISITES.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0042; Paragraphs FIL-0042-PAR-0003; Statements FIL-0042-STMT-000010; Fields FIL-0042-FLD-000003, FIL-0042-FLD-000004

**Related:** Rules: BR-001, BR-002

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-022 — BR-129 Check batch prerequisites pending value — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** BCHCTL00 | **Line:** 40 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Check batch prerequisites pending value. BCHCTL00 defines the pending value ('N') of the prerequisite flag; it is not tested by name (the satisfied value 'Y' is, see BR-002).

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0042; Fields FIL-0042-FLD-000003, FIL-0042-FLD-000005

**Related:** Rules: BR-002, BR-129

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-023 — BR-130 Select batch control processing mode — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** BCHCTL00 | **Line:** 42 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select batch control processing mode. BCHCTL00 defines the processing modes initialise ('I'), check prerequisites ('C'), update status ('U') and finalise ('F'); they are set by the function dispatch but no analysed branch tests them.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0042; Fields FIL-0042-FLD-000006, FIL-0042-FLD-000007, FIL-0042-FLD-000008, FIL-0042-FLD-000009, FIL-0042-FLD-000010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| BCHCTL00 |  | 42 |  |  |
| BCHCTL00 |  | 43 |  |  |
| BCHCTL00 |  | 44 |  |  |
| BCHCTL00 |  | 45 |  |  |

**Related:** Rules: BR-001, BR-130

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-024 — BR-003 Route checkpoint requests by entry point — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** CKPRST | **Paragraph:** (UNNAMED) | **Line:** 29 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Route checkpoint requests by entry point. The program selects one of four checkpoint actions (initialise, take checkpoint, commit checkpoint, restart) according to which entry-point condition is true and performs the matching paragraph; with no match nothing is performed and the program returns. The data item behind the conditions is not declared and the target paragraphs execute no statements. Implemented in program CKPRST.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0043; Paragraphs FIL-0043-PAR-0001; Statements FIL-0043-STMT-000001

**Related:** Rules: BR-003

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-025 — BR-100 Validate checkpoint status is a defined status code — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** CKPRST | **Line:** 12 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate checkpoint status is a defined status code. The checkpoint record defines the status values initial ('I'), active ('A'), complete ('C'), failed ('F') and restarted ('R'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0003; Fields FIL-0003-FLD-000005, FIL-0003-FLD-000006, FIL-0003-FLD-000007, FIL-0003-FLD-000008, FIL-0003-FLD-000009, FIL-0003-FLD-000010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 12 |  |  |
|  |  | 13 |  |  |
|  |  | 14 |  |  |
|  |  | 15 |  |  |
|  |  | 16 |  |  |

**Related:** Rules: BR-100

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-026 — BR-101 Select checkpoint processing phase by phase code — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** CKPRST | **Line:** 28 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select checkpoint processing phase by phase code. The checkpoint record defines the phase codes initialise ('00'), read ('10'), process ('20'), update ('30') and terminate ('40'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0003; Fields FIL-0003-FLD-000019, FIL-0003-FLD-000020, FIL-0003-FLD-000021, FIL-0003-FLD-000022, FIL-0003-FLD-000023, FIL-0003-FLD-000024

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 28 |  |  |
|  |  | 29 |  |  |
|  |  | 30 |  |  |
|  |  | 31 |  |  |
|  |  | 32 |  |  |

**Related:** Rules: BR-101

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-027 — BR-102 Select checkpoint restart mode by mode code — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** CKPRST | **Line:** 45 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select checkpoint restart mode by mode code. The checkpoint record defines the restart modes normal ('N'), restart ('R') and recover ('C'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0003; Fields FIL-0003-FLD-000034, FIL-0003-FLD-000035, FIL-0003-FLD-000036, FIL-0003-FLD-000037

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 45 |  |  |
|  |  | 46 |  |  |
|  |  | 47 |  |  |

**Related:** Rules: BR-102

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-028 — BR-043 Route cursor management requests by request type — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** CURSMGR | **Paragraph:** (UNNAMED) | **Line:** 44 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Route cursor management requests by request type. The cursor request type (CURS-REQUEST-TYPE) selects the action: 'D' sets the fetch array size and declares the cursor, 'O' resets the counters and opens the cursor; 'F' and 'C' perform the fetch and close paragraphs, which are not present in the source. With any other request type nothing is performed and control returns to CICS. Implemented in program CURSMGR.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0059; Paragraphs FIL-0059-PAR-0001; Statements FIL-0059-STMT-000001; Fields FIL-0059-FLD-000006, FIL-0059-FLD-000007, FIL-0059-FLD-000008, FIL-0059-FLD-000009, FIL-0059-FLD-000010

**Related:** Rules: BR-043, BR-044

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-029 — BR-134 Select single-row fetch indicator value — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** CURSMGR | **Line:** 38 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select single-row fetch indicator value. CURSMGR defines the no-array-fetch value ('N'); it is not tested by name (the ELSE of the array-fetch test covers it, BR-044).

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0059; Fields FIL-0059-FLD-000013, FIL-0059-FLD-000015

**Related:** Rules: BR-044, BR-134

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-030 — BR-132 Check DB2 disconnected state value — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DB2CONN | **Line:** 28 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Check DB2 disconnected state value. DB2CONN defines the disconnected value ('N') of its connection state; it is set on disconnect but not tested by name.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0055; Fields FIL-0055-FLD-000002

**Related:** Rules: BR-037, BR-132

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-031 — BR-133 Handle DB2 retry indicator values — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DB2ERR | **Line:** 52 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle DB2 retry indicator values. DB2ERR defines the retry indicator values should retry ('Y') and no retry ('N'); they are set by the severity classification and returned to the caller, but no analysed branch tests them.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0056; Fields FIL-0056-FLD-000017, FIL-0056-FLD-000018, FIL-0056-FLD-000019

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2ERR |  | 52 |  |  |
| DB2ERR |  | 53 |  |  |

**Related:** Rules: BR-040, BR-133

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-032 — BR-047 Route DB2 recovery requests by recovery request type — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DB2RECV | **Paragraph:** (UNNAMED) | **Line:** 48 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Route DB2 recovery requests by recovery request type. The recovery request type (RECV-REQUEST-TYPE) selects the recovery: 'C' reconnects with up to three attempts through DB2ONLN, 'T' rolls back the transaction, and the RECV-CURSOR case links to the central error handler with a warning error block. With any other type nothing is performed and control returns to CICS. Implemented in program DB2RECV.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0001; Statements FIL-0061-STMT-000001; Fields FIL-0061-FLD-000005, FIL-0061-FLD-000006, FIL-0061-FLD-000007

**Related:** Rules: BR-047, BR-048, BR-049, BR-050

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-033 — BR-050 Handle cursor recovery outcome according to the central error action — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DB2RECV | **Paragraph:** P300-RECOVER-CURSOR | **Line:** 137 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Handle cursor recovery outcome according to the central error action. Cursor recovery links to the central error handler with a warning error block; when the handler returns the 'continue' action (ERR-ACTION = 'C') the recovery status is set to retry, otherwise to failed. Implemented in program DB2RECV, paragraph P300-RECOVER-CURSOR.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0010; Statements FIL-0061-STMT-000022; Fields FIL-0019-FLD-000011, FIL-0019-FLD-000013

**Related:** Rules: BR-050, BR-052

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-034 — BR-135 Select cursor recovery request type value — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DB2RECV | **Line:** 35 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select cursor recovery request type value. DB2RECV defines the cursor recovery request type ('R') as RECV-CURSOR; because a data field has the same name, the dispatch's use of it cannot be tied to this definition.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0061; Fields FIL-0061-FLD-000005, FIL-0061-FLD-000008

**Related:** Rules: BR-047, BR-135

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-035 — BR-136 Handle recovery status failed or retry — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DB2RECV | **Line:** 44 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle recovery status failed or retry. DB2RECV and INQHIST both define the recovery statuses failed ('F') and retry ('R'); DB2RECV sets them, and only the success value is tested (BR-048, BR-053).

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0061; also files FIL-0063; Fields FIL-0061-FLD-000015, FIL-0061-FLD-000017, FIL-0061-FLD-000018, FIL-0063-FLD-000032

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2RECV |  | 44 |  |  |
| DB2RECV |  | 45 |  |  |
| INQHIST |  | 62 |  |  |
| INQHIST |  | 63 |  |  |

**Related:** Rules: BR-048, BR-053, BR-136

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-036 — BR-126 Select DB2 request type connect, disconnect or status — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DB2REQ | **Line:** 6 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select DB2 request type connect, disconnect or status. Copybook DB2REQ defines the request types connect ('C'), disconnect ('D') and status ('S'); these copybook names are not tested in the analysed programs (DB2ONLN tests its own declarations, BR-045).

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0018; Fields FIL-0018-FLD-000001, FIL-0018-FLD-000002, FIL-0018-FLD-000003, FIL-0018-FLD-000004

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 6 |  |  |
|  |  | 7 |  |  |
|  |  | 8 |  |  |

**Related:** Rules: BR-045, BR-126

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-037 — BR-124 Handle error log type system, application or data — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DBTBLS | **Line:** 37 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle error log type system, application or data. The DB2 ERRLOG record layout defines the error types system ('S'), application ('A') and data ('D'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0016; Fields FIL-0016-FLD-000021, FIL-0016-FLD-000022, FIL-0016-FLD-000023, FIL-0016-FLD-000024

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 37 |  |  |
|  |  | 38 |  |  |
|  |  | 39 |  |  |

**Related:** Rules: BR-124

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-038 — BR-125 Handle error log severity levels 1 to 4 — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** DBTBLS | **Line:** 41 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle error log severity levels 1 to 4. The DB2 ERRLOG record layout defines the severities info (1), warning (2), error (3) and severe (4); DB2ERR moves these numbers directly and no analysed branch tests them by name.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0016; Fields FIL-0016-FLD-000025, FIL-0016-FLD-000026, FIL-0016-FLD-000027, FIL-0016-FLD-000028, FIL-0016-FLD-000029

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 41 |  |  |
|  |  | 42 |  |  |
|  |  | 43 |  |  |
|  |  | 44 |  |  |

**Related:** Rules: BR-040, BR-125

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-039 — BR-142 Detect processing error indicator values — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** ERRHANDL | **Line:** 41 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Detect processing error indicator values. ERRHANDL defines the processing-error values no error ('N') and error occurred ('Y'); neither is tested by name in the analysed code.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0081; Fields FIL-0081-FLD-000012, FIL-0081-FLD-000013, FIL-0081-FLD-000014

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| ERRHANDL |  | 41 |  |  |
| ERRHANDL |  | 42 |  |  |

**Related:** Rules: BR-096, BR-142

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-040 — BR-143 Handle abend indicator values — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** ERRHANDL | **Line:** 44 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle abend indicator values. ERRHANDL defines the abend indicator values perform abend ('Y') and no abend ('N'); neither is tested by name in the analysed code.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0081; Fields FIL-0081-FLD-000015, FIL-0081-FLD-000016, FIL-0081-FLD-000017

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| ERRHANDL |  | 44 |  |  |
| ERRHANDL |  | 45 |  |  |

**Related:** Rules: BR-096, BR-143

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-041 — BR-127 Handle error action return value — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** ERRHND | **Line:** 16 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle error action return value. Copybook ERRHND defines the return action ('R'); ERRHNDL sets it for any severity other than fatal, warning or info, but no analysed branch tests it by name.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0019; Fields FIL-0019-FLD-000011, FIL-0019-FLD-000012

**Related:** Rules: BR-052, BR-127

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-042 — BR-051 Require a trace ID on every logged error — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** ERRHNDL | **Paragraph:** P100-INIT-ERROR-HANDLER | **Line:** 57 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Require a trace ID on every logged error. When the caller supplies no error trace ID (ERR-TRACE-ID blank), the error handler generates one from FUNCTION RANDOM before logging. Implemented in program ERRHNDL, paragraph P100-INIT-ERROR-HANDLER.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0062; Paragraphs FIL-0062-PAR-0002; Statements FIL-0062-STMT-000008; Fields FIL-0019-FLD-000016

**Related:** Rules: BR-051, BR-052

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-043 — BR-004 Enforce commit interval of 1000 loaded history records — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** HISTLD00 | **Paragraph:** 2300-CHECK-COMMIT | **Line:** 180 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Enforce commit interval of 1000 loaded history records. Each processed record increments the commit counter; when the counter reaches or exceeds the commit threshold (WS-COMMIT-THRESHOLD, value 1000) the system commits the DB2 work, resets the counter and rewrites the batch control checkpoint. Otherwise processing continues without a commit. Implemented in program HISTLD00, paragraph 2300-CHECK-COMMIT.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0010; Statements FIL-0044-STMT-000043; Fields FIL-0044-FLD-000006

**Related:** Rules: BR-004, BR-005

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-044 — BR-113 Validate history record type is portfolio, position or transaction — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** HISTREC | **Line:** 14 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate history record type is portfolio, position or transaction. The history record defines the record types portfolio ('PT'), position ('PS') and transaction ('TR'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0008; Fields FIL-0008-FLD-000007, FIL-0008-FLD-000008, FIL-0008-FLD-000009, FIL-0008-FLD-000010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 14 |  |  |
|  |  | 15 |  |  |
|  |  | 16 |  |  |

**Related:** Rules: BR-113

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-045 — BR-114 Validate history action code is add, change or delete — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** HISTREC | **Line:** 18 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate history action code is add, change or delete. The history record defines the actions add ('A'), change ('C') and delete ('D'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0008; Fields FIL-0008-FLD-000011, FIL-0008-FLD-000012, FIL-0008-FLD-000013, FIL-0008-FLD-000014

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 18 |  |  |
|  |  | 19 |  |  |
|  |  | 20 |  |  |

**Related:** Rules: BR-114

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-046 — BR-128 Select inquiry function menu, portfolio, history or exit — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQCOM | **Line:** 6 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select inquiry function menu, portfolio, history or exit. Copybook INQCOM defines the inquiry functions 'MENU', 'INQP', 'INQH' and 'EXIT'; INQONLN dispatches on the same values through an undeclared field, not by these names.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0020; Fields FIL-0020-FLD-000001, FIL-0020-FLD-000002, FIL-0020-FLD-000003, FIL-0020-FLD-000004, FIL-0020-FLD-000005

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 6 |  |  |
|  |  | 7 |  |  |
|  |  | 8 |  |  |
|  |  | 9 |  |  |

**Related:** Rules: BR-054, BR-128

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-047 — BR-053 Retry the history inquiry DB2 connection after successful recovery — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQHIST | **Paragraph:** P150-DB2-CONNECT | **Line:** 113 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Retry the history inquiry DB2 connection after successful recovery. After a failed connect, when the DB2RECV connection recovery reports success (RECV-STATUS = 'S') the connect paragraph is performed again; otherwise the recovery message is copied to the inquiry error message and the error routine returns the SQLCODE to the caller. Implemented in program INQHIST, paragraph P150-DB2-CONNECT.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0004; Statements FIL-0063-STMT-000036; Fields FIL-0063-FLD-000032, FIL-0063-FLD-000033

**Related:** Rules: BR-047, BR-048, BR-053

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-048 — BR-054 Route online inquiry requests by menu function — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQONLN | **Paragraph:** P100-PROCESS-REQUEST | **Line:** 62 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Route online inquiry requests by menu function. The four-character function code selects the online action: 'MENU' displays the menu, 'INQP' links to the portfolio inquiry (INQPORT), 'INQH' links to the history inquiry (INQHIST), 'EXIT' ends the session; any other code goes to the error routine. Implemented in program INQONLN, paragraph P100-PROCESS-REQUEST.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0002; Statements FIL-0064-STMT-000006

**Related:** Rules: BR-054, BR-055

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-049 — BR-055 Enforce compliance for security check by ending the request on failure — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQONLN | **Paragraph:** P100-PROCESS-REQUEST | **Line:** 82 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Enforce compliance for security check by ending the request on failure. After the request has been processed, the security dialogue with SECMGR is run; when it reports a non-zero response the security error is passed to the error routine and the task returns to CICS. Implemented in program INQONLN, paragraph P100-PROCESS-REQUEST.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0002; Statements FIL-0064-STMT-000008; Fields FIL-0064-FLD-000009

**Related:** Rules: BR-055, BR-057, BR-058

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-050 — BR-056 Abend the online inquiry transaction when the error handler requests it — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQONLN | **Paragraph:** P900-ERROR-ROUTINE | **Line:** 131 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Abend the online inquiry transaction when the error handler requests it. The inquiry error routine links to the central error handler with a warning error block; when the handler returns the abend action (ERR-ACTION = 'A') the transaction is abended with code IERR; otherwise the error message is kept and processing continues. Implemented in program INQONLN, paragraph P900-ERROR-ROUTINE.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0010; Statements FIL-0064-STMT-000022; Fields FIL-0019-FLD-000011, FIL-0019-FLD-000014

**Related:** Rules: BR-052, BR-056

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-051 — BR-057 Enforce compliance for READ access check after user validation — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQONLN | **Paragraph:** P050-SECURITY-CHECK | **Line:** 151 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** high

Enforce compliance for READ access check after user validation. The security dialogue first sends a validation request ('V') for the signed-on user to SECMGR; only when it succeeds (response 0) does it send the authorisation request ('A') for READ access to resource INQONLN. Implemented in program INQONLN, paragraph P050-SECURITY-CHECK.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0012; Statements FIL-0064-STMT-000028; Fields FIL-0064-FLD-000009

**Related:** Rules: BR-055, BR-057, BR-058

**Detected in:** rules_artifact | **Also:** 

---

### GAP-052 — BR-058 Report security audit request after access is granted — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQONLN | **Paragraph:** P050-SECURITY-CHECK | **Line:** 161 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** high

Report security audit request after access is granted. When the authorisation request succeeds (response 0), the security dialogue sends the third SECMGR request ('L', audit). Implemented in program INQONLN, paragraph P050-SECURITY-CHECK.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0012; Statements FIL-0064-STMT-000043; Fields FIL-0064-FLD-000009

**Related:** Rules: BR-057, BR-058

**Detected in:** rules_artifact | **Also:** 

---

### GAP-053 — BR-059 Check position exists before displaying it — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQPORT | **Paragraph:** (UNNAMED) | **Line:** 47 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Check position exists before displaying it. When the position was found (WS-POSITION-FOUND = 'Y') the system formats and sends the position display map; otherwise the caller receives the message 'Position not found for account'. Implemented in program INQPORT.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0065; Paragraphs FIL-0065-PAR-0001; Statements FIL-0065-STMT-000003; Fields FIL-0065-FLD-000002, FIL-0065-FLD-000003

**Related:** Rules: BR-054, BR-059

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-054 — BR-137 Check position not-found value — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** INQPORT | **Line:** 27 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Check position not-found value. INQPORT defines the not-found value ('N') of the position-found flag; it is set after an unsuccessful read but not tested by name.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0065; Fields FIL-0065-FLD-000002, FIL-0065-FLD-000004

**Related:** Rules: BR-059, BR-137

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-055 — BR-064 Flag every successful portfolio deletion in the audit file — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTDEL | **Paragraph:** 2200-DELETE-RECORD | **Line:** 159 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Flag every successful portfolio deletion in the audit file. When the DELETE of a portfolio record succeeds (file status '00'), the deleted count is incremented and an audit record is written (timestamp, action 'DELETE', key, reason code, portfolio status). Otherwise the delete error is displayed and counted. Implemented in program PORTDEL, paragraph 2200-DELETE-RECORD.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0068; Paragraphs FIL-0068-PAR-0005; Statements FIL-0068-STMT-000015; Fields FIL-0068-FLD-000018, FIL-0068-FLD-000019

**Related:** Rules: BR-064

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-056 — BR-138 Validate portfolio deletion reason code — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTDEL | **Line:** 50 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate portfolio deletion reason code. PORTDEL defines the deletion reasons closed ('01'), transferred ('02') and requested ('03'); the reason code is written to the audit record but never tested.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0068; Fields FIL-0068-FLD-000004, FIL-0068-FLD-000005, FIL-0068-FLD-000006, FIL-0068-FLD-000007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTDEL |  | 50 |  |  |
| PORTDEL |  | 51 |  |  |
| PORTDEL |  | 52 |  |  |

**Related:** Rules: BR-064, BR-138

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-057 — BR-115 Validate portfolio client type is individual, corporate or trust — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTFLIO | **Line:** 18 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate portfolio client type is individual, corporate or trust. The portfolio record defines the client types individual ('I'), corporate ('C') and trust ('T'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0009; Fields FIL-0009-FLD-000006, FIL-0009-FLD-000007, FIL-0009-FLD-000008, FIL-0009-FLD-000009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 18 |  |  |
|  |  | 19 |  |  |
|  |  | 20 |  |  |

**Related:** Rules: BR-115

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-058 — BR-116 Validate portfolio record status is active, closed or suspended — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTFLIO | **Line:** 25 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate portfolio record status is active, closed or suspended. The portfolio record defines the statuses active ('A'), closed ('C') and suspended ('S'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0009; Fields FIL-0009-FLD-000013, FIL-0009-FLD-000014, FIL-0009-FLD-000015, FIL-0009-FLD-000016

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 25 |  |  |
|  |  | 26 |  |  |
|  |  | 27 |  |  |

**Related:** Rules: BR-063, BR-069, BR-116

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-059 — BR-065 Route portfolio master maintenance by command — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTMSTR | **Paragraph:** 0000-MAIN | **Line:** 86 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Route portfolio master maintenance by command. The caller's command (LS-COMMAND) selects the action: 'C' validates and writes a new portfolio, 'R' reads a portfolio by key and returns its record, 'U' validates and rewrites the portfolio and then logs the update through AUDPROC, 'D' deletes the portfolio by key; any other command gives 'Invalid command' with return code 8. Implemented in program PORTMSTR, paragraph 0000-MAIN.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0069; Paragraphs FIL-0069-PAR-0001; Statements FIL-0069-STMT-000002; Fields FIL-0069-FLD-000023, FIL-0069-FLD-000024, FIL-0069-FLD-000025, FIL-0069-FLD-000026, FIL-0069-FLD-000027

**Related:** Rules: BR-065

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-060 — BR-073 Check transaction portfolio exists on the portfolio file — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTTRAN | **Paragraph:** 2110-CHECK-PORTFOLIO | **Line:** 127 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Check transaction portfolio exists on the portfolio file. The transaction's portfolio ID is used as the key to read the portfolio file; when no portfolio is found the error text is set to 'Invalid Portfolio ID: ' followed by the transaction's portfolio ID. Implemented in program PORTTRAN, paragraph 2110-CHECK-PORTFOLIO.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0072; Paragraphs FIL-0072-PAR-0005; Statements FIL-0072-STMT-000019

**Related:** Rules: BR-072, BR-073

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-061 — BR-078 Route position updates by transaction type (dead code) — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTTRAN | **Paragraph:** 2200-UPDATE-POSITIONS | **Line:** 168 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Route position updates by transaction type (dead code). The source contains a dispatch of position updates by transaction type: 'BU' to buy processing, 'SL' to sell processing, 'TR' to transfer processing and 'FE' to fee processing, followed by an audit-trail update. The paragraph is never performed, so these updates do not happen in the delivered program. Present in program PORTTRAN, paragraph 2200-UPDATE-POSITIONS.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0072; Paragraphs FIL-0072-PAR-0008; Statements FIL-0072-STMT-000024; Fields FIL-0014-FLD-000008

**Related:** Rules: BR-078, BR-079, BR-080

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-062 — BR-079 Restrict sale quantity to units held (dead code) — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTTRAN | **Paragraph:** 2220-PROCESS-SELL | **Line:** 210 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Restrict sale quantity to units held (dead code). The source contains a check that, when the portfolio's total units (PORT-TOTAL-UNITS) are fewer than the sale quantity (TRN-QUANTITY), sets 'Insufficient units for sale' and performs the error routine; otherwise units and cost are reduced and the portfolio rewritten. The paragraph is unreachable, so the check does not run in the delivered program. Present in program PORTTRAN, paragraph 2220-PROCESS-SELL.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0072; Paragraphs FIL-0072-PAR-0010; Statements FIL-0072-STMT-000033; Fields FIL-0014-FLD-000013

**Related:** Rules: BR-078, BR-079

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-063 — BR-080 Report audit action by transaction type (dead code) — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTTRAN | **Paragraph:** 2300-UPDATE-AUDIT-TRAIL | **Line:** 257 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Report audit action by transaction type (dead code). The source maps each transaction type to an audit action: buy 'CREATE', sell 'DELETE', transfer and fee 'UPDATE'. The paragraph is unreachable, so no audit record is produced this way in the delivered program. Present in program PORTTRAN, paragraph 2300-UPDATE-AUDIT-TRAIL.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0072; Paragraphs FIL-0072-PAR-0013; Statements FIL-0072-STMT-000048; Fields FIL-0014-FLD-000008

**Related:** Rules: BR-078, BR-080

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-064 — BR-085 Validate portfolio ID number part is numeric — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTVALD | **Paragraph:** 1000-VALIDATE-ID | **Line:** 63 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** confirmed

Validate portfolio ID number part is numeric. Characters 5 to 8 of the input value are moved into VAL-NUMERIC-CHECK; when it is not numeric the validation returns the invalid-ID code (1), otherwise success (0). As coded, the receiving field is longer than the moved characters, so the test is not numeric for every input. Implemented in program PORTVALD, paragraph 1000-VALIDATE-ID.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0074; Paragraphs FIL-0074-PAR-0002; Statements FIL-0074-STMT-000006; Fields FIL-0010-FLD-000013

**Related:** Rules: BR-067, BR-084, BR-085

**Detected in:** rules_artifact | **Also:** 

---

### GAP-065 — BR-088 Enforce amount within the allowed minimum and maximum — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PORTVALD | **Paragraph:** 4000-VALIDATE-AMOUNT | **Line:** 111 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** confirmed

Enforce amount within the allowed minimum and maximum. When the amount (VAL-TEMP-NUM) is below the minimum (VAL-MIN-AMOUNT) or above the maximum (VAL-MAX-AMOUNT), the validation returns the invalid-amount code (4) with its message; otherwise success (0). As coded, the bounds cover the full range of the amount field. Implemented in program PORTVALD, paragraph 4000-VALIDATE-AMOUNT.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0074; Paragraphs FIL-0074-PAR-0005; Statements FIL-0074-STMT-000016; Fields FIL-0010-FLD-000014, FIL-0010-FLD-000010, FIL-0010-FLD-000011

**Related:** Rules: BR-088

**Detected in:** rules_artifact | **Also:** 

---

### GAP-066 — BR-117 Validate position status is active, closed or pending — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** POSREC | **Line:** 17 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate position status is active, closed or pending. The position record defines the statuses active ('A'), closed ('C') and pending ('P'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0011; Fields FIL-0011-FLD-000010, FIL-0011-FLD-000011, FIL-0011-FLD-000012, FIL-0011-FLD-000013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 17 |  |  |
|  |  | 18 |  |  |
|  |  | 19 |  |  |

**Related:** Rules: BR-117

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-067 — BR-103 Select process sequence type by type code — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ | **Line:** 13 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select process sequence type by type code. The process sequence record defines the process types initialisation ('INI'), processing ('PRC'), reporting ('RPT') and termination ('TRM'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0004; Fields FIL-0004-FLD-000006, FIL-0004-FLD-000007, FIL-0004-FLD-000008, FIL-0004-FLD-000009, FIL-0004-FLD-000010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 13 |  |  |
|  |  | 14 |  |  |
|  |  | 15 |  |  |
|  |  | 16 |  |  |

**Related:** Rules: BR-008, BR-103

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-068 — BR-104 Validate process run frequency is daily, weekly or monthly — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ | **Line:** 19 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate process run frequency is daily, weekly or monthly. The process sequence record defines the frequencies daily ('D'), weekly ('W') and monthly ('M'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0004; Fields FIL-0004-FLD-000012, FIL-0004-FLD-000013, FIL-0004-FLD-000014, FIL-0004-FLD-000015

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 19 |  |  |
|  |  | 20 |  |  |
|  |  | 21 |  |  |

**Related:** Rules: BR-104

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-069 — BR-105 Validate dependency type soft value — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ | **Line:** 30 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate dependency type soft value. The process sequence record defines the soft dependency type ('S') alongside the hard type; the soft value is not tested by name in the analysed programs (a soft dependency that is not done leaves the return code unchanged, see BR-013).

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0004; Fields FIL-0004-FLD-000022, FIL-0004-FLD-000024

**Related:** Rules: BR-013, BR-105

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-070 — BR-106 Validate process not-restartable indicator — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ | **Line:** 38 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate process not-restartable indicator. The process sequence record defines the not-restartable value ('N') of the restart indicator; it is not tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0004; Fields FIL-0004-FLD-000030, FIL-0004-FLD-000032

**Related:** Rules: BR-025, BR-106

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-071 — BR-107 Validate process active days pattern — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ | **Line:** 41 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate process active days pattern. The process sequence record defines three active-day patterns (Monday to Sunday flags): weekdays ('YYYYYNN'), weekend ('NNNNNYY') and all days ('YYYYYYY'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0004; Fields FIL-0004-FLD-000034, FIL-0004-FLD-000035, FIL-0004-FLD-000036, FIL-0004-FLD-000037

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 41 |  |  |
|  |  | 42 |  |  |
|  |  | 43 |  |  |

**Related:** Rules: BR-107

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-072 — BR-108 Validate month-end run indicator — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ | **Line:** 45 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate month-end run indicator. The process sequence record defines the last-day-of-month value ('Y') of the month-end indicator; it is not tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0004; Fields FIL-0004-FLD-000038, FIL-0004-FLD-000039

**Related:** Rules: BR-108

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-073 — BR-109 Validate holiday run indicator — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ | **Line:** 47 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate holiday run indicator. The process sequence record defines whether a process skips holidays ('N') or runs on holidays ('Y'); neither is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0004; Fields FIL-0004-FLD-000040, FIL-0004-FLD-000041, FIL-0004-FLD-000042

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 47 |  |  |
|  |  | 48 |  |  |

**Related:** Rules: BR-109

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-074 — BR-011 Stop dependency checking at the first failing dependency — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ00 | **Paragraph:** 2200-CHECK-DEPENDENCIES | **Line:** 233 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Stop dependency checking at the first failing dependency. The system checks the process's dependencies one by one and stops as soon as a dependency check leaves a non-zero return code. Implemented in program PRCSEQ00, paragraph 2200-CHECK-DEPENDENCIES.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0012; Statements FIL-0046-STMT-000084; Fields FIL-0046-FLD-000021

**Related:** Rules: BR-007, BR-011, BR-012

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-075 — BR-012 Check dependency job has completed — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ00 | **Paragraph:** 2210-CHECK-DEP-STATUS | **Line:** 249 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Check dependency job has completed. For each dependency the system reads the dependency's batch control record and tests whether its status is DONE (BCT-STATUS = 'D'). When the dependency is not done, a hard dependency blocks the process (see the hard-dependency rule); when it is done, its return code is compared with the maximum allowed for that dependency. Implemented in program PRCSEQ00, paragraph 2210-CHECK-DEP-STATUS.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0013; Statements FIL-0046-STMT-000041; Fields FIL-0002-FLD-000006, FIL-0002-FLD-000010

**Related:** Rules: BR-012, BR-013, BR-014

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-076 — BR-013 Block process with warning when a hard dependency has not completed — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ00 | **Paragraph:** 2210-CHECK-DEP-STATUS | **Line:** 250 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Block process with warning when a hard dependency has not completed. When a dependency that is not yet done is a hard dependency (PSR-DEP-TYPE = 'H'), the system sets the warning return code (4), which prevents the process from being started. A soft dependency that is not done leaves the return code unchanged. Implemented in program PRCSEQ00, paragraph 2210-CHECK-DEP-STATUS.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0013; Statements FIL-0046-STMT-000088; Fields FIL-0004-FLD-000022, FIL-0004-FLD-000023

**Related:** Rules: BR-012, BR-013, BR-014

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-077 — BR-014 Enforce dependency return code does not exceed allowed maximum — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ00 | **Paragraph:** 2210-CHECK-DEP-STATUS | **Line:** 254 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Enforce dependency return code does not exceed allowed maximum. When a completed dependency ended with a return code (BCT-RETURN-CODE) greater than the maximum allowed for that dependency (PSR-DEP-RC), the system sets the error return code (8), which prevents the process from being started. Otherwise the dependency is satisfied. Implemented in program PRCSEQ00, paragraph 2210-CHECK-DEP-STATUS.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0013; Statements FIL-0046-STMT-000087; Fields FIL-0002-FLD-000024, FIL-0004-FLD-000025

**Related:** Rules: BR-012, BR-013, BR-014

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-078 — BR-015 Select process table entry by process ID for status refresh — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** PRCSEQ00 | **Paragraph:** 3200-UPDATE-SEQUENCE-TABLE | **Line:** 295 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select process table entry by process ID for status refresh. The system scans the process table for the entry whose process ID equals the job name of the control record just read, copies the control record's status and return code into that entry, and stops the scan. Implemented in program PRCSEQ00, paragraph 3200-UPDATE-SEQUENCE-TABLE.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0016; Statements FIL-0046-STMT-000095; Fields FIL-0046-FLD-000009, FIL-0002-FLD-000002

**Related:** Rules: BR-015

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-079 — BR-131 Select recovery mode sequence or all by name — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** RCVPRC00 | **Line:** 51 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Select recovery mode sequence or all by name. RCVPRC00 defines the recovery modes sequence ('S') and all ('A') as condition names; they are not tested by name (the EVALUATE uses the literals, BR-021).

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0047; Fields FIL-0047-FLD-000004, FIL-0047-FLD-000006, FIL-0047-FLD-000007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RCVPRC00 |  | 51 |  |  |
| RCVPRC00 |  | 52 |  |  |

**Related:** Rules: BR-021, BR-131

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-080 — BR-118 Handle standard return code levels 0, 4, 8, 12 and 16 — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** RETHND | **Line:** 9 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle standard return code levels 0, 4, 8, 12 and 16. Copybook RETHND defines the return code levels success (0), warning (4), error (8), severe (12) and critical (16); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0012; Fields FIL-0012-FLD-000002, FIL-0012-FLD-000003, FIL-0012-FLD-000004, FIL-0012-FLD-000005, FIL-0012-FLD-000006, FIL-0012-FLD-000007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 9 |  |  |
|  |  | 10 |  |  |
|  |  | 11 |  |  |
|  |  | 12 |  |  |
|  |  | 13 |  |  |

**Related:** Rules: BR-032, BR-118

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-081 — BR-119 Handle error type classification codes — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** RETHND | **Line:** 25 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle error type classification codes. Copybook RETHND defines the error types validation ('V'), processing ('P'), database ('D'), file ('F') and security ('S'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0012; Fields FIL-0012-FLD-000017, FIL-0012-FLD-000018, FIL-0012-FLD-000019, FIL-0012-FLD-000020, FIL-0012-FLD-000021, FIL-0012-FLD-000022

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 25 |  |  |
|  |  | 26 |  |  |
|  |  | 27 |  |  |
|  |  | 28 |  |  |
|  |  | 29 |  |  |

**Related:** Rules: BR-119

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-082 — BR-120 Handle error action flag continue, abort or retry — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** RETHND | **Line:** 38 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle error action flag continue, abort or retry. Copybook RETHND defines the action flags continue ('C'), abort ('A') and retry ('R'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0012; Fields FIL-0012-FLD-000029, FIL-0012-FLD-000030, FIL-0012-FLD-000031, FIL-0012-FLD-000032

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 38 |  |  |
|  |  | 39 |  |  |
|  |  | 40 |  |  |

**Related:** Rules: BR-120

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-083 — BR-121 Handle return-code status success, warning, error or severe — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** RTNCODE | **Line:** 17 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Handle return-code status success, warning, error or severe. Copybook RTNCODE defines the statuses success ('S'), warning ('W'), error ('E') and severe ('F'); RTNCDE00 sets them when classifying a return code, but no analysed branch tests them by name.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0013; Fields FIL-0013-FLD-000012, FIL-0013-FLD-000013, FIL-0013-FLD-000014, FIL-0013-FLD-000015, FIL-0013-FLD-000016

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 17 |  |  |
|  |  | 18 |  |  |
|  |  | 19 |  |  |
|  |  | 20 |  |  |

**Related:** Rules: BR-032, BR-121

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-084 — BR-062 Enforce compliance for resource access authorisation — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** SECMGR | **Paragraph:** P200-CHECK-AUTH | **Line:** 90 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Enforce compliance for resource access authorisation. Access is granted (response 0) only when the authorisation table AUTHFILE holds at least one row for the user, resource and access type; otherwise the response is 8 with 'Access denied'. Implemented in program SECMGR, paragraph P200-CHECK-AUTH.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0066; Paragraphs FIL-0066-PAR-0004; Statements FIL-0066-STMT-000022

**Related:** Rules: BR-057, BR-061, BR-062

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-085 — BR-122 Validate transaction type code values buy, sell, transfer and fee — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** TRNREC | **Line:** 15 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate transaction type code values buy, sell, transfer and fee. Copybook TRNREC defines the transaction types buy ('BU'), sell ('SL'), transfer ('TR') and fee ('FE') as condition names; PORTTRAN tests the same values by literal, not by these names.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0014; Fields FIL-0014-FLD-000008, FIL-0014-FLD-000009, FIL-0014-FLD-000010, FIL-0014-FLD-000011, FIL-0014-FLD-000012

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 15 |  |  |
|  |  | 16 |  |  |
|  |  | 17 |  |  |
|  |  | 18 |  |  |

**Related:** Rules: BR-074, BR-122

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-086 — BR-123 Validate transaction status is pending, done, failed or reversed — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** TRNREC | **Line:** 24 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Validate transaction status is pending, done, failed or reversed. Copybook TRNREC defines the transaction statuses pending ('P'), done ('D'), failed ('F') and reversed ('R'); none is tested by name in the analysed programs.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0014; Fields FIL-0014-FLD-000017, FIL-0014-FLD-000018, FIL-0014-FLD-000019, FIL-0014-FLD-000020, FIL-0014-FLD-000021

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 24 |  |  |
|  |  | 25 |  |  |
|  |  | 26 |  |  |
|  |  | 27 |  |  |

**Related:** Rules: BR-123

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE, RULE_NOT_DIAGRAMMED

---

### GAP-087 — BR-089 Route test data generation by configured test type — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** TSTGEN00 | **Paragraph:** 2100-GENERATE-TEST-DATA | **Line:** 167 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Route test data generation by configured test type. The configured test type (CFG-TEST-TYPE) selects the generator: 'PORTFOLIO' portfolio data, 'TRANSACTN' transaction data, 'ERROR' error data, 'VOLUME' volume data; any other type is reported as an invalid test type through the error handler. The generation itself is performed by paragraphs not present in the source. Implemented in program TSTGEN00, paragraph 2100-GENERATE-TEST-DATA.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0075; Paragraphs FIL-0075-PAR-0007; Statements FIL-0075-STMT-000020; Fields FIL-0075-FLD-000001

**Related:** Rules: BR-089, BR-090

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-088 — BR-090 Cap utility and test-generator runs at 100 errors — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** TSTGEN00 | **Paragraph:** 9999-ERROR-HANDLER | **Line:** 213 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** medium

Cap utility and test-generator runs at 100 errors. Each reported error increments the error count; when the count exceeds 100 the program ends with return code 12; otherwise control returns to the calling paragraph and processing continues. Implemented in programs TSTGEN00 and UTLMNT00, paragraph 9999-ERROR-HANDLER.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0075; also files FIL-0077; Paragraphs FIL-0075-PAR-0013, FIL-0077-PAR-0012; Statements FIL-0075-STMT-000030, FIL-0077-STMT-000034; Fields FIL-0075-FLD-000015, FIL-0077-FLD-000017

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTGEN00 | 9999-ERROR-HANDLER | 213 | FIL-0075-STMT-000030 |  |
| UTLMNT00 | 9999-ERROR-HANDLER | 179 | FIL-0077-STMT-000034 |  |

**Related:** Rules: BR-005, BR-081, BR-090

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-089 — BR-091 Route test execution by test type — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** TSTVAL00 | **Paragraph:** 2100-EXECUTE-TEST | **Line:** 188 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Route test execution by test type. The test type (TEST-TYPE) of each test case selects the runner: 'FUNCTIONAL', 'INTEGRATE', 'PERFORM' or 'ERROR'; any other type is reported as an invalid test type and the program ends. The runners are paragraphs not present in the source. Implemented in program TSTVAL00, paragraph 2100-EXECUTE-TEST.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0076; Paragraphs FIL-0076-PAR-0007; Statements FIL-0076-STMT-000022; Fields FIL-0076-FLD-000002

**Related:** Rules: BR-091

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-090 — BR-139 Check test passed indicator — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** TSTVAL00 | **Line:** 86 | **Cause:** source | **SME review:** Yes | **Rule confidence:** low

Check test passed indicator. TSTVAL00 defines the test-passed value ('Y'); no analysed branch tests it.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0076; Fields FIL-0076-FLD-000015, FIL-0076-FLD-000016

**Related:** Rules: BR-091, BR-139

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-091 — BR-092 Route utility maintenance by control function — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** UTLMNT00 | **Paragraph:** 2100-PROCESS-FUNCTION | **Line:** 133 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Route utility maintenance by control function. The control record's function (CTL-FUNCTION) selects the maintenance process: archive, cleanup, reorganise or analyse; any other function is reported as invalid through the error handler. The step paragraphs of each process are not present in the source. Implemented in program UTLMNT00, paragraph 2100-PROCESS-FUNCTION.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0077; Paragraphs FIL-0077-PAR-0006; Statements FIL-0077-STMT-000015; Fields FIL-0077-FLD-000001

**Related:** Rules: BR-090, BR-092

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-092 — BR-140 Check valid maintenance function indicator — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** UTLMNT00 | **Line:** 68 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Check valid maintenance function indicator. UTLMNT00 defines the valid-function value ('Y'); no analysed branch tests it.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0077; Fields FIL-0077-FLD-000009, FIL-0077-FLD-000010

**Related:** Rules: BR-092, BR-140

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-093 — BR-093 Flag monitoring alert when a threshold is met — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** UTLMON00 | **Paragraph:** 2400-GENERATE-ALERTS | **Line:** 207 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Flag monitoring alert when a threshold is met. When the threshold-met flag (WS-THRESHOLD-MET = 'Y') is set, the monitor formats and writes an alert; the alert paragraphs and the paragraphs that would set the flag are not present in the source. Implemented in program UTLMON00, paragraph 2400-GENERATE-ALERTS.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0078; Paragraphs FIL-0078-PAR-0010; Statements FIL-0078-STMT-000035; Fields FIL-0078-FLD-000032, FIL-0078-FLD-000033

**Related:** Rules: BR-093, BR-094

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-094 — BR-094 Restrict monitoring cycles to before hour 23 — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** UTLMON00 | **Paragraph:** 0000-MAIN | **Line:** 130 | **Cause:** source | **SME review:** Yes | **Rule confidence:** low

Restrict monitoring cycles to before hour 23. The monitor repeats its processing cycle until the captured hour (WS-HOUR) equals 23. Whether the loop ever ends cannot be confirmed from the code, and the work done in each cycle is in paragraphs not present in the source. Implemented in program UTLMON00, paragraph 0000-MAIN.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0078; Paragraphs FIL-0078-PAR-0001; Statements FIL-0078-STMT-000002; Fields FIL-0078-FLD-000046

**Related:** Rules: BR-093, BR-094

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-095 — BR-095 Route data validation by validation type — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** UTLVAL00 | **Paragraph:** 2100-PROCESS-VALIDATION | **Line:** 149 | **Cause:** source | **SME review:** Yes | **Rule confidence:** medium

Route data validation by validation type. The validation type (VAL-TYPE) of each control record selects the check: 'INTEGRITY', 'XREF', 'FORMAT' or 'BALANCE'; any other type is reported as 'INVALID VALIDATION TYPE'. What each check validates is in paragraphs not present in the source. Implemented in program UTLVAL00, paragraph 2100-PROCESS-VALIDATION.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0079; Paragraphs FIL-0079-PAR-0006; Statements FIL-0079-STMT-000017; Fields FIL-0079-FLD-000001

**Related:** Rules: BR-095

**Detected in:** rules_artifact | **Also:** MEDIUM_CONFIDENCE_RULE

---

### GAP-096 — BR-141 Detect validation error found indicator — SME review required
**Type:** SME_REVIEW_REQUIRED | **Program:** UTLVAL00 | **Line:** 79 | **Cause:** analysis | **SME review:** Yes | **Rule confidence:** low

Detect validation error found indicator. UTLVAL00 defines the error-found value ('Y'); its error handler sets it, but no analysed branch tests it.

**Impact:** Rule extracted but purpose unclear — may be wrong or incomplete.

**Recommended action:** Present the extracted rule description to a subject matter expert for confirmation or correction.

**Source IDs:** File FIL-0079; Fields FIL-0079-FLD-000013, FIL-0079-FLD-000014

**Related:** Rules: BR-095, BR-141

**Detected in:** rules_artifact | **Also:** LOW_CONFIDENCE_RULE

---

### GAP-097 — CKPRST: condition name ENTRY-POINT-COMMIT is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** CKPRST | **Paragraph:** (UNNAMED) | **Line:** 34 | **Cause:** source | **SME review:** Yes

The EVALUATE TRUE at line 29 tests ENTRY-POINT-COMMIT (WHEN at line 34, selecting PERFORM PROC-COMMIT-CHECKPOINT). Not declared in the program or in copybooks CKPRST and RETHND and nowhere else in the repository source; resolution UNRESOLVED, target_id null.

**Impact:** Which request selects committing a checkpoint cannot be determined statically.

**Recommended action:** Locate the declaration of the ENTRY-POINT-* condition names or confirm the request codes with an SME.

**Source IDs:** File FIL-0043; Paragraphs FIL-0043-PAR-0001; Statements FIL-0043-STMT-000001, FIL-0043-STMT-000007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| CKPRST | (UNNAMED) | 34 | FIL-0043-STMT-000001 | ENTRY-POINT-COMMIT |

**Related:** Rules: BR-003

**Detected in:** logic_artifact | **Also:** 

---

### GAP-098 — CKPRST: condition name ENTRY-POINT-INIT is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** CKPRST | **Paragraph:** (UNNAMED) | **Line:** 30 | **Cause:** source | **SME review:** Yes

The EVALUATE TRUE at line 29 tests ENTRY-POINT-INIT (WHEN at line 30, selecting PERFORM PROC-INIT). Agent 4 reports it is not declared in the program or in copybooks CKPRST and RETHND and appears nowhere else in the repository source; resolution UNRESOLVED, target_id null.

**Impact:** Which request selects checkpoint initialisation cannot be determined statically; the data item tested and its values are unknown.

**Recommended action:** Locate the declaration of the ENTRY-POINT-* condition names (missing copybook or version of CKPRST) or confirm the request codes with an SME.

**Source IDs:** File FIL-0043; Paragraphs FIL-0043-PAR-0001; Statements FIL-0043-STMT-000001, FIL-0043-STMT-000008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| CKPRST | (UNNAMED) | 30 | FIL-0043-STMT-000001 | ENTRY-POINT-INIT |

**Related:** Rules: BR-003

**Detected in:** logic_artifact | **Also:** 

---

### GAP-099 — CKPRST: condition name ENTRY-POINT-RESTART is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** CKPRST | **Paragraph:** (UNNAMED) | **Line:** 36 | **Cause:** source | **SME review:** Yes

The EVALUATE TRUE at line 29 tests ENTRY-POINT-RESTART (WHEN at line 36, selecting PERFORM PROC-RESTART). Not declared in the program or in copybooks CKPRST and RETHND and nowhere else in the repository source; resolution UNRESOLVED, target_id null.

**Impact:** Which request selects restart processing cannot be determined statically.

**Recommended action:** Locate the declaration of the ENTRY-POINT-* condition names or confirm the request codes with an SME.

**Source IDs:** File FIL-0043; Paragraphs FIL-0043-PAR-0001; Statements FIL-0043-STMT-000001, FIL-0043-STMT-000009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| CKPRST | (UNNAMED) | 36 | FIL-0043-STMT-000001 | ENTRY-POINT-RESTART |

**Related:** Rules: BR-003

**Detected in:** logic_artifact | **Also:** 

---

### GAP-100 — CKPRST: condition name ENTRY-POINT-TAKE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** CKPRST | **Paragraph:** (UNNAMED) | **Line:** 32 | **Cause:** source | **SME review:** Yes

The EVALUATE TRUE at line 29 tests ENTRY-POINT-TAKE (WHEN at line 32, selecting PERFORM PROC-TAKE-CHECKPOINT). Not declared in the program or in copybooks CKPRST and RETHND and nowhere else in the repository source; resolution UNRESOLVED, target_id null.

**Impact:** Which request selects taking a checkpoint cannot be determined statically.

**Recommended action:** Locate the declaration of the ENTRY-POINT-* condition names or confirm the request codes with an SME.

**Source IDs:** File FIL-0043; Paragraphs FIL-0043-PAR-0001; Statements FIL-0043-STMT-000001, FIL-0043-STMT-000010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| CKPRST | (UNNAMED) | 32 | FIL-0043-STMT-000001 | ENTRY-POINT-TAKE |

**Related:** Rules: BR-003

**Detected in:** logic_artifact | **Also:** 

---

### GAP-101 — HISTLD00: checkpoint target field BCT-RECORDS-READ is not in BATCH-CONTROL-RECORD
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2310-UPDATE-CHECKPOINT | **Line:** 192 | **Cause:** source | **SME review:** Yes

MOVE WS-RECORDS-READ TO BCT-RECORDS-READ (line 192, 2310-UPDATE-CHECKPOINT) writes to a field not present in BATCH-CONTROL-RECORD (copybook BCHCTL). Resolution UNRESOLVED, target_id null; statement flagged ambiguous (undeclared target field).

**Impact:** Where the records-read count is stored in the batch control record cannot be determined.

**Recommended action:** Confirm the BATCH-CONTROL-RECORD layout version used by HISTLD00 with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0011; Statements FIL-0044-STMT-000044

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2310-UPDATE-CHECKPOINT | 192 | FIL-0044-STMT-000044 | BCT-RECORDS-READ |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-102 — HISTLD00: checkpoint target field BCT-RECORDS-WRITTEN is not in BATCH-CONTROL-RECORD
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2310-UPDATE-CHECKPOINT | **Line:** 193 | **Cause:** source | **SME review:** Yes

MOVE WS-RECORDS-WRITTEN TO BCT-RECORDS-WRITTEN (line 193, 2310-UPDATE-CHECKPOINT) writes to a field not present in BATCH-CONTROL-RECORD (copybook BCHCTL). Resolution UNRESOLVED, target_id null; statement flagged ambiguous (undeclared target field).

**Impact:** Where the records-written count is stored in the batch control record cannot be determined.

**Recommended action:** Confirm the BATCH-CONTROL-RECORD layout version used by HISTLD00 with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0011; Statements FIL-0044-STMT-000045

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2310-UPDATE-CHECKPOINT | 193 | FIL-0044-STMT-000045 | BCT-RECORDS-WRITTEN |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-103 — HISTLD00: RECORD KEY TH-KEY of TRANSACTION-HISTORY is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Line:** 21 | **Cause:** source | **SME review:** Yes

Agent 3 reports that RECORD KEY TH-KEY of SELECT TRANSACTION-HISTORY (line 17; key at line 21) is not declared in HISTLD00 nor in the copybook HISTREC expanded under its FD; no data item named TH-KEY was found in any copybook of the inventory.

**Impact:** The key by which the transaction history file is accessed cannot be identified.

**Recommended action:** Locate the record layout that declares TH-KEY or confirm the key field with the development team.

**Source IDs:** File FIL-0044

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 |  | 21 |  | TH-KEY |
| HISTLD00 |  | 21 |  | TH-KEY |

**Related:** Gaps: GAP-104 | Diagrams: FLOW-HISTLD00

**Detected in:** data_artifact, logic_artifact | **Also:** 

---

### GAP-104 — HISTLD00: source field TH-ACCOUNT-NO is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 146 | **Cause:** source | **SME review:** Yes

MOVE TH-ACCOUNT-NO TO PH-ACCOUNT-NO (line 146, 2200-LOAD-TO-DB2) reads a field that is not declared: no TH-* items exist; the TRANSACTION-HISTORY record (HISTREC) defines HIST-* fields only. Resolution UNRESOLVED, target_id null; statement recorded verbatim and flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-ACCOUNT-NO cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000027

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 146 | FIL-0044-STMT-000027 | TH-ACCOUNT-NO |

**Related:** Gaps: GAP-103

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-105 — HISTLD00: source field TH-AMOUNT is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 154 | **Cause:** source | **SME review:** Yes

MOVE TH-AMOUNT TO PH-AMOUNT (line 154, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-AMOUNT cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000035

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 154 | FIL-0044-STMT-000035 | TH-AMOUNT |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-106 — HISTLD00: source field TH-COST-BASIS is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 157 | **Cause:** source | **SME review:** Yes

MOVE TH-COST-BASIS TO PH-COST-BASIS (line 157, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-COST-BASIS cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000038

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 157 | FIL-0044-STMT-000038 | TH-COST-BASIS |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-107 — HISTLD00: source field TH-FEES is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 155 | **Cause:** source | **SME review:** Yes

MOVE TH-FEES TO PH-FEES (line 155, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-FEES cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000036

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 155 | FIL-0044-STMT-000036 | TH-FEES |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-108 — HISTLD00: source field TH-GAIN-LOSS is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 158 | **Cause:** source | **SME review:** Yes

MOVE TH-GAIN-LOSS TO PH-GAIN-LOSS (line 158, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-GAIN-LOSS cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000039

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 158 | FIL-0044-STMT-000039 | TH-GAIN-LOSS |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-109 — HISTLD00: source field TH-PORTFOLIO-ID is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 147 | **Cause:** source | **SME review:** Yes

MOVE TH-PORTFOLIO-ID TO PH-PORTFOLIO-ID (line 147, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-PORTFOLIO-ID cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000028

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 147 | FIL-0044-STMT-000028 | TH-PORTFOLIO-ID |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-110 — HISTLD00: source field TH-PRICE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 153 | **Cause:** source | **SME review:** Yes

MOVE TH-PRICE TO PH-PRICE (line 153, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-PRICE cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000034

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 153 | FIL-0044-STMT-000034 | TH-PRICE |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-111 — HISTLD00: source field TH-QUANTITY is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 152 | **Cause:** source | **SME review:** Yes

MOVE TH-QUANTITY TO PH-QUANTITY (line 152, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-QUANTITY cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000033

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 152 | FIL-0044-STMT-000033 | TH-QUANTITY |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-112 — HISTLD00: source field TH-SECURITY-ID is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 151 | **Cause:** source | **SME review:** Yes

MOVE TH-SECURITY-ID TO PH-SECURITY-ID (line 151, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-SECURITY-ID cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000032

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 151 | FIL-0044-STMT-000032 | TH-SECURITY-ID |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-113 — HISTLD00: source field TH-TOTAL-AMOUNT is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 156 | **Cause:** source | **SME review:** Yes

MOVE TH-TOTAL-AMOUNT TO PH-TOTAL-AMOUNT (line 156, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-TOTAL-AMOUNT cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000037

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 156 | FIL-0044-STMT-000037 | TH-TOTAL-AMOUNT |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-114 — HISTLD00: source field TH-TRANS-DATE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 148 | **Cause:** source | **SME review:** Yes

MOVE TH-TRANS-DATE TO PH-TRANS-DATE (line 148, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-TRANS-DATE cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000029

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 148 | FIL-0044-STMT-000029 | TH-TRANS-DATE |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-115 — HISTLD00: source field TH-TRANS-TIME is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 149 | **Cause:** source | **SME review:** Yes

MOVE TH-TRANS-TIME TO PH-TRANS-TIME (line 149, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-TRANS-TIME cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000030

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 149 | FIL-0044-STMT-000030 | TH-TRANS-TIME |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-116 — HISTLD00: source field TH-TRANS-TYPE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 150 | **Cause:** source | **SME review:** Yes

MOVE TH-TRANS-TYPE TO PH-TRANS-TYPE (line 150, 2200-LOAD-TO-DB2) reads a field that is not declared (no TH-* items exist; HISTREC defines HIST-* fields only). Resolution UNRESOLVED, target_id null; flagged ambiguous.

**Impact:** Which bytes of HISTORY-RECORD are loaded into PH-TRANS-TYPE cannot be determined.

**Recommended action:** Locate the TH-* record layout or confirm the HIST-* to PH-* mapping with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009; Statements FIL-0044-STMT-000031

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 150 | FIL-0044-STMT-000031 | TH-TRANS-TYPE |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-117 — INQHIST: WS-DB2-TOKEN is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** INQHIST | **Paragraph:** P150-DB2-CONNECT | **Line:** 124 | **Cause:** source | **SME review:** Yes

At line 124 (statement STMT-000014) in P150-DB2-CONNECT, MOVE DB2-CONNECTION-TOKEN TO WS-DB2-TOKEN names a receiving item that is not declared in the program or its copybooks. Agent 4 translated the statement as written, flagged it and listed it in unresolved_statements.

**Impact:** The statement cannot compile as recorded or depends on a definition outside the repository; where the DB2 connection token is kept is unknown.

**Recommended action:** Locate the definition of WS-DB2-TOKEN (missing copybook or source revision) or confirm with the development team that the statement is defective.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0004; Statements FIL-0063-STMT-000014

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQHIST | P150-DB2-CONNECT | 124 | FIL-0063-STMT-000014 | WS-DB2-TOKEN |

**Related:** Rules: BR-053

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-118 — INQONLN: EVALUATE subject WS-COMMAREA-FUNCTION is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** INQONLN | **Paragraph:** P100-PROCESS-REQUEST | **Line:** 62 | **Cause:** source | **SME review:** Yes

At line 62 (statement STMT-000006) in P100-PROCESS-REQUEST, EVALUATE WS-COMMAREA-FUNCTION tests a data name that is not declared in the program or its copybooks; which WHEN branch is taken cannot be determined from the declared data. Copybook INQCOM declares INQCOM-FUNCTION, whose 88-level values are the same four literals ('MENU', 'INQP', 'INQH', 'EXIT'); Agent 4 chose no substitute. The loop flag SESSION-TERMINATED is set only in WHEN 'EXIT' of this EVALUATE.

**Impact:** The function dispatch of the online inquiry menu (and the only normal way the request loop ends) depends on an undeclared item.

**Recommended action:** Confirm with the development team whether WS-COMMAREA-FUNCTION should be INQCOM-FUNCTION or is defined outside the repository.

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0002; Statements FIL-0064-STMT-000006

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQONLN | P100-PROCESS-REQUEST | 62 | FIL-0064-STMT-000006 | WS-COMMAREA-FUNCTION |

**Related:** Rules: BR-054, BR-055

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-119 — INQONLN: WS-ERROR-MESSAGE is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** INQONLN | **Paragraph:** P100-PROCESS-REQUEST | **Line:** 83 | **Cause:** source | **SME review:** Yes

WS-ERROR-MESSAGE is not declared in the program or its copybooks. It is the receiving item of MOVE SEC-ERROR-INFO TO WS-ERROR-MESSAGE (line 83, STMT-000035, P100-PROCESS-REQUEST) and MOVE ERR-MESSAGE TO WS-ERROR-MESSAGE (line 135, STMT-000023, P900-ERROR-ROUTINE). Note: trace_issues lists lines 84 and 135, unresolved_statements lists lines 83 and 135.

**Impact:** Security and error messages are moved to an item with no definition; where they end up is unknown.

**Recommended action:** Locate the definition of WS-ERROR-MESSAGE or confirm with the development team that the statements are defective.

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0002, FIL-0064-PAR-0010; Statements FIL-0064-STMT-000035, FIL-0064-STMT-000023

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQONLN | P100-PROCESS-REQUEST | 83 | FIL-0064-STMT-000035 | WS-ERROR-MESSAGE |
| INQONLN | P900-ERROR-ROUTINE | 135 | FIL-0064-STMT-000023 | WS-ERROR-MESSAGE |

**Related:** Rules: BR-054, BR-055, BR-056

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-120 — INQPORT: POSITION-ACCOUNT OF WS-POSITION-RECORD is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** INQPORT | **Paragraph:** P200-GET-POSITION | **Line:** 74 | **Cause:** source | **SME review:** Yes

POSITION-ACCOUNT (qualified OF WS-POSITION-RECORD) is declared nowhere in INQPORT, INQCOM or POSREC (POSREC defines POS-KEY/POS-PORTFOLIO-ID). It receives the MOVE at line 69/70 (statement STMT-000009) and is the RIDFLD key of the CICS READ of POSFILE at line 74 (statement STMT-000010), both in P200-GET-POSITION. resolve-field-references returned UNRESOLVED with no candidates.

**Impact:** The key used to read the position file is undefined in the repository; the record selected by the inquiry is unknown.

**Recommended action:** Confirm with the development team which POSREC key field is meant (for example POS-KEY) or locate the missing definition.

**Source IDs:** File FIL-0065; Paragraphs FIL-0065-PAR-0004; Statements FIL-0065-STMT-000009, FIL-0065-STMT-000010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQPORT | P200-GET-POSITION | 70 | FIL-0065-STMT-000009 | POSITION-ACCOUNT OF WS-POSITION-RECORD |
| INQPORT | P200-GET-POSITION | 74 | FIL-0065-STMT-000010 | POSITION-ACCOUNT OF WS-POSITION-RECORD (READ RIDFLD) |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-121 — INQPORT: WS-COMMAREA-ACCOUNT-NO is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** INQPORT | **Paragraph:** P200-GET-POSITION | **Line:** 69 | **Cause:** source | **SME review:** Yes

MOVE WS-COMMAREA-ACCOUNT-NO TO POSITION-ACCOUNT OF WS-POSITION-RECORD (line 69, statement STMT-000009, P200-GET-POSITION) uses a sending item declared nowhere in INQPORT, INQCOM or POSREC (INQCOM defines INQCOM-ACCOUNT-NO). Recorded verbatim and flagged ambiguous; the key value read from POSFILE is therefore unknown.

**Impact:** The account key used for the portfolio position inquiry cannot be traced to its source.

**Recommended action:** Confirm with the development team whether WS-COMMAREA-ACCOUNT-NO should be INQCOM-ACCOUNT-NO or is defined outside the repository.

**Source IDs:** File FIL-0065; Paragraphs FIL-0065-PAR-0004; Statements FIL-0065-STMT-000009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQPORT | P200-GET-POSITION | 69 | FIL-0065-STMT-000009 | WS-COMMAREA-ACCOUNT-NO |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-122 — PORTMSTR: 17 data names in dead paragraph 2100-HANDLE-VSAM-ERROR are not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** PORTMSTR | **Paragraph:** 2100-HANDLE-VSAM-ERROR | **Line:** 244 | **Cause:** source | **SME review:** Yes

The dead paragraph 2100-HANDLE-VSAM-ERROR (PAR-0010, lines 243-267) uses LS-PROGRAM-ID, ERR-CAT-VSAM, LS-CATEGORY, WS-FILE-STATUS, LS-ERROR-CODE, ERR-VSAM-DUPKEY, ERR-VSAM-NOTFND, ERR-WARNING, LS-SEVERITY, ERR-VSAM-22, ERR-VSAM-23, LS-ERROR-TEXT, ERR-ERROR, ERR-OTHER, PORT-KEY, LS-ERROR-DETAILS and LS-ERROR-REQUEST; none is declared in PORTMSTR. 13 statements (lines 244-262, including CALL 'ERRPROC' USING LS-ERROR-REQUEST at line 262) are recorded verbatim in unresolved_statements and flagged ambiguous. Grouped as one root cause; each name is listed for per-name splitting.

**Impact:** No effect on executed logic (the paragraph is unreachable), but the intended VSAM error handling cannot be described.

**Recommended action:** Confirm with the development team whether the paragraph is a retired example; if it is to be kept, locate the declarations (likely an error-request copybook).

**Source IDs:** File FIL-0069; Paragraphs FIL-0069-PAR-0010; Statements FIL-0069-STMT-000038, FIL-0069-STMT-000039, FIL-0069-STMT-000040, FIL-0069-STMT-000041, FIL-0069-STMT-000094, FIL-0069-STMT-000095, FIL-0069-STMT-000096, FIL-0069-STMT-000097, FIL-0069-STMT-000098, FIL-0069-STMT-000099, FIL-0069-STMT-000042, FIL-0069-STMT-000043

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 244 | FIL-0069-STMT-000038 | LS-PROGRAM-ID |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 245 | FIL-0069-STMT-000039 | ERR-CAT-VSAM, LS-CATEGORY |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 246 | FIL-0069-STMT-000040 | WS-FILE-STATUS, LS-ERROR-CODE |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 248 | FIL-0069-STMT-000041 | WS-FILE-STATUS, ERR-VSAM-DUPKEY, ERR-VSAM-NOTFND |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 250 | FIL-0069-STMT-000094 | ERR-WARNING, LS-SEVERITY |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 251 | FIL-0069-STMT-000095 | ERR-VSAM-22, LS-ERROR-TEXT |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 253 | FIL-0069-STMT-000096 | ERR-WARNING, LS-SEVERITY |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 254 | FIL-0069-STMT-000097 | ERR-VSAM-23, LS-ERROR-TEXT |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 256 | FIL-0069-STMT-000098 | ERR-ERROR, LS-SEVERITY |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 257 | FIL-0069-STMT-000099 | ERR-OTHER, LS-ERROR-TEXT |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 260 | FIL-0069-STMT-000042 | PORT-KEY, LS-ERROR-DETAILS |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 262 | FIL-0069-STMT-000043 | LS-ERROR-REQUEST (CALL 'ERRPROC' USING) |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-123 — PORTMSTR: 18 data names in reachable 2100-LOG-PORTFOLIO-UPDATE are not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** PORTMSTR | **Paragraph:** 2100-LOG-PORTFOLIO-UPDATE | **Line:** 269 | **Cause:** source | **SME review:** Yes

The reachable paragraph 2100-LOG-PORTFOLIO-UPDATE (PAR-0011, lines 268-288, performed after a successful REWRITE) uses LS-AUDIT-REQUEST, LS-SYSTEM-ID, USERID, LS-USER-ID, LS-PROGRAM, TERMINAL-ID, LS-TERMINAL, LS-TYPE, LS-ACTION, LS-STATUS, LS-PORT-ID, PORT-ACCOUNT-NO, LS-ACCT-NO, WS-BEFORE-IMAGE, LS-BEFORE-IMAGE, PORT-RECORD, LS-AFTER-IMAGE and LS-MESSAGE; none is declared in PORTMSTR and the program has no COPY statements. 13 statements (STMT-000044 to STMT-000057, lines 269-287) are recorded verbatim in unresolved_statements and flagged ambiguous; their layout and the AUDPROC parameter structure (CALL 'AUDPROC' USING LS-AUDIT-REQUEST, line 287) are unknown. Grouped here as one root cause (one paragraph without declarations); each name is listed for per-name splitting.

**Impact:** The audit record sent to AUDPROC after a portfolio update cannot be described; the statements cannot compile as recorded.

**Recommended action:** Locate the missing copybook(s) or source revision that declare these names (likely the AUDPROC request layout) and re-run Agents 3 and 4; otherwise confirm with the development team.

**Source IDs:** File FIL-0069; Paragraphs FIL-0069-PAR-0011; Statements FIL-0069-STMT-000044, FIL-0069-STMT-000045, FIL-0069-STMT-000046, FIL-0069-STMT-000047, FIL-0069-STMT-000048, FIL-0069-STMT-000049, FIL-0069-STMT-000050, FIL-0069-STMT-000051, FIL-0069-STMT-000052, FIL-0069-STMT-000053, FIL-0069-STMT-000054, FIL-0069-STMT-000055, FIL-0069-STMT-000056, FIL-0069-STMT-000057

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 269 | FIL-0069-STMT-000044 | LS-AUDIT-REQUEST |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 271 | FIL-0069-STMT-000045 | LS-SYSTEM-ID |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 272 | FIL-0069-STMT-000046 | USERID, LS-USER-ID |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 273 | FIL-0069-STMT-000047 | LS-PROGRAM |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 274 | FIL-0069-STMT-000048 | TERMINAL-ID, LS-TERMINAL |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 276 | FIL-0069-STMT-000049 | LS-TYPE |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 277 | FIL-0069-STMT-000050 | LS-ACTION |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 278 | FIL-0069-STMT-000051 | LS-STATUS |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 280 | FIL-0069-STMT-000052 | LS-PORT-ID |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 281 | FIL-0069-STMT-000053 | PORT-ACCOUNT-NO, LS-ACCT-NO |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 283 | FIL-0069-STMT-000054 | WS-BEFORE-IMAGE, LS-BEFORE-IMAGE |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 284 | FIL-0069-STMT-000055 | PORT-RECORD, LS-AFTER-IMAGE |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 285 | FIL-0069-STMT-000056 | LS-MESSAGE |
| PORTMSTR | 2100-LOG-PORTFOLIO-UPDATE | 287 | FIL-0069-STMT-000057 | LS-AUDIT-REQUEST (CALL 'AUDPROC' USING) |

**Detected in:** logic_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-124 — PRCSEQ00: loop index and subscript WS-SUB is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** PRCSEQ00 | **Paragraph:** 2200-CHECK-DEPENDENCIES | **Line:** 230 | **Cause:** source | **SME review:** Yes

WS-SUB is used as the PERFORM VARYING index in 2200-CHECK-DEPENDENCIES (line 230) and as a subscript in 2210-CHECK-DEP-STATUS (lines 240, 250, 254), but is not declared in PRCSEQ00 or in the copybooks it uses (PRCSEQ, BCHCTL, BCHCON, ERRHAND). resolve-field-references returned UNRESOLVED (no unresolved_reason, no candidates); target_id null. Recorded as written; not filled in.

**Impact:** The size and type of the dependency loop index are unknown; the dependency-check loop cannot be confirmed to behave as described.

**Recommended action:** Locate the declaration of WS-SUB (missing copybook or source version) or confirm its definition with the development team.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0012, FIL-0046-PAR-0013; Statements FIL-0046-STMT-000037, FIL-0046-STMT-000038, FIL-0046-STMT-000088, FIL-0046-STMT-000087

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PRCSEQ00 | 2200-CHECK-DEPENDENCIES | 230 | FIL-0046-STMT-000037 | WS-SUB |
| PRCSEQ00 | 2210-CHECK-DEP-STATUS | 240 | FIL-0046-STMT-000038 | WS-SUB |
| PRCSEQ00 | 2210-CHECK-DEP-STATUS | 250 | FIL-0046-STMT-000088 | WS-SUB |
| PRCSEQ00 | 2210-CHECK-DEP-STATUS | 254 | FIL-0046-STMT-000087 | WS-SUB |

**Related:** Rules: BR-011, BR-012, BR-013, BR-014

**Detected in:** logic_artifact | **Also:** 

---

### GAP-125 — RPTAUD00: RECORD KEY AUD-KEY of AUDIT-FILE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTAUD00 | **Line:** 20 | **Cause:** source | **SME review:** Yes

Agent 3 reports that RECORD KEY AUD-KEY (SELECT AUDIT-FILE, line 20) is not declared in the program or in the expanded copybooks AUDITLOG, ERRHAND, RTNCODE. AUDIT-FILE also has no FD (see nofd:FILE-SECTION).

**Impact:** The key by which the audit file is read cannot be identified.

**Recommended action:** Locate the record layout that declares AUD-KEY or confirm the key field with the development team.

**Source IDs:** File FIL-0048

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTAUD00 |  | 20 |  | AUD-KEY |
| RPTAUD00 |  | 20 |  | AUD-KEY |

**Related:** Gaps: GAP-224 | Diagrams: FLOW-RPTAUD00

**Detected in:** data_artifact, logic_artifact | **Also:** 

---

### GAP-126 — RPTAUD00: RECORD KEY ERR-KEY of ERROR-FILE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTAUD00 | **Cause:** source | **SME review:** Yes

Agent 3 (carried in the Agent 4 trace_issues) reports that RECORD KEY ERR-KEY (SELECT ERROR-FILE) is not declared in the program or in copybooks AUDITLOG, ERRHAND, RTNCODE. The artifact gives line 20 for the pair of keys; the exact line of the ERR-KEY clause is not recorded.

**Impact:** The key of the error file cannot be identified.

**Recommended action:** Locate the ERROR-FILE record layout defining ERR-KEY or confirm the key with the development team.

**Source IDs:** File FIL-0048

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTAUD00 |  |  |  | ERR-KEY |
| RPTAUD00 |  | 26 |  | ERR-KEY |

**Related:** Gaps: GAP-224 | Diagrams: FLOW-RPTAUD00

**Detected in:** data_artifact, logic_artifact | **Also:** 

---

### GAP-127 — RPTAUD00: WS-ERROR-MESSAGE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTAUD00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 97 | **Cause:** source | **SME review:** Yes

MOVE ... TO WS-ERROR-MESSAGE and DISPLAY WS-ERROR-MESSAGE (lines 97, 104, 111, 145; paragraphs 1100-OPEN-FILES and 9999-ERROR-HANDLER) reference an item that is not declared in RPTAUD00 or its copybooks; resolution UNRESOLVED, target_id null; recorded verbatim and flagged ambiguous.

**Impact:** The size of the error message displayed on open failures is unknown.

**Recommended action:** Locate the declaration of WS-ERROR-MESSAGE or confirm it with the development team.

**Source IDs:** File FIL-0048; Paragraphs FIL-0048-PAR-0003, FIL-0048-PAR-0010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTAUD00 | 1100-OPEN-FILES | 97 |  | WS-ERROR-MESSAGE |
| RPTAUD00 | 1100-OPEN-FILES | 104 |  | WS-ERROR-MESSAGE |
| RPTAUD00 | 1100-OPEN-FILES | 111 |  | WS-ERROR-MESSAGE |
| RPTAUD00 | 9999-ERROR-HANDLER | 145 |  | WS-ERROR-MESSAGE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-128 — RPTPOS00: loop condition END-OF-POSITIONS is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTPOS00 | **Paragraph:** 2100-READ-POSITIONS | **Line:** 126 | **Cause:** source | **SME review:** Yes

The position read loop in 2100-READ-POSITIONS (PERFORM UNTIL END-OF-POSITIONS, line 126) and the SET statements at lines 123 and 129 use condition name END-OF-POSITIONS, which is not declared in the program or its copybooks; resolution UNRESOLVED, target_id null. The loop is classified FILE_EXHAUSTION_LOOP from the SET ... TO TRUE statements in the AT END branches, but the data item it sets is unknown.

**Impact:** The end-of-file flag of the position report loop has no known data item; the loop's termination is inferred, not confirmed.

**Recommended action:** Locate the declaration of END-OF-POSITIONS or confirm it with the development team.

**Source IDs:** File FIL-0049; Paragraphs FIL-0049-PAR-0006; Statements FIL-0049-STMT-000021

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 | 2100-READ-POSITIONS | 126 | FIL-0049-STMT-000021 | END-OF-POSITIONS |
| RPTPOS00 | 2100-READ-POSITIONS | 123 |  | END-OF-POSITIONS |
| RPTPOS00 | 2100-READ-POSITIONS | 129 |  | END-OF-POSITIONS |

**Detected in:** logic_artifact | **Also:** PSEUDOCODE_ISSUE

---

### GAP-129 — RPTPOS00: POS-CURRENT-VALUE is not in POSREC or the program
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTPOS00 | **Paragraph:** 2110-FORMAT-POSITION | **Line:** 137 | **Cause:** source | **SME review:** Yes

POS-CURRENT-VALUE (lines 137, 139, 2110-FORMAT-POSITION) is not declared in copybook POSREC (which declares POS-MARKET-VALUE and POS-COST-BASIS) or the program; resolution UNRESOLVED, target_id null. No substitute is assumed.

**Impact:** The current value used in the position change calculation has no known source field.

**Recommended action:** Confirm the POSREC layout version used by RPTPOS00, or which POSREC field is meant, with the development team.

**Source IDs:** File FIL-0049; Paragraphs FIL-0049-PAR-0007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 | 2110-FORMAT-POSITION | 137 |  | POS-CURRENT-VALUE |
| RPTPOS00 | 2110-FORMAT-POSITION | 139 |  | POS-CURRENT-VALUE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-130 — RPTPOS00: POS-DESCRIPTION is not in POSREC or the program
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTPOS00 | **Paragraph:** 2110-FORMAT-POSITION | **Line:** 135 | **Cause:** source | **SME review:** Yes

POS-DESCRIPTION (line 135, 2110-FORMAT-POSITION) is not declared in copybook POSREC or the program; resolution UNRESOLVED, target_id null.

**Impact:** The position description printed on the report has no known source field.

**Recommended action:** Confirm the POSREC layout version used by RPTPOS00 with the development team.

**Source IDs:** File FIL-0049; Paragraphs FIL-0049-PAR-0007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 | 2110-FORMAT-POSITION | 135 |  | POS-DESCRIPTION |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-131 — RPTPOS00: POS-PREVIOUS-VALUE is not in POSREC or the program
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTPOS00 | **Paragraph:** 2110-FORMAT-POSITION | **Line:** 139 | **Cause:** source | **SME review:** Yes

POS-PREVIOUS-VALUE (lines 139, 140, 2110-FORMAT-POSITION) is not declared in copybook POSREC or the program; resolution UNRESOLVED, target_id null. It is also the divisor of the change-percentage COMPUTE at line 138.

**Impact:** The previous value used in the position change calculation has no known source field.

**Recommended action:** Confirm the POSREC layout version used by RPTPOS00 with the development team.

**Source IDs:** File FIL-0049; Paragraphs FIL-0049-PAR-0007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 | 2110-FORMAT-POSITION | 139 |  | POS-PREVIOUS-VALUE |
| RPTPOS00 | 2110-FORMAT-POSITION | 140 |  | POS-PREVIOUS-VALUE |

**Related:** Gaps: GAP-200

**Detected in:** logic_artifact | **Also:** 

---

### GAP-132 — RPTPOS00: WS-ERROR-MESSAGE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTPOS00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 92 | **Cause:** source | **SME review:** Yes

WS-ERROR-MESSAGE (lines 92, 99, 106, 158; paragraphs 1100-OPEN-FILES and 9999-ERROR-HANDLER) is not declared in the program or in copybooks RTNCODE/ERRHAND (ERRHAND declares ERR-MESSAGE, not WS-ERROR-MESSAGE); resolution UNRESOLVED, target_id null.

**Impact:** The size of the error message displayed on open failures is unknown.

**Recommended action:** Locate the declaration of WS-ERROR-MESSAGE or confirm whether ERR-MESSAGE was intended, with the development team.

**Source IDs:** File FIL-0049; Paragraphs FIL-0049-PAR-0003, FIL-0049-PAR-0011

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 | 1100-OPEN-FILES | 92 |  | WS-ERROR-MESSAGE |
| RPTPOS00 | 1100-OPEN-FILES | 99 |  | WS-ERROR-MESSAGE |
| RPTPOS00 | 1100-OPEN-FILES | 106 |  | WS-ERROR-MESSAGE |
| RPTPOS00 | 9999-ERROR-HANDLER | 158 |  | WS-ERROR-MESSAGE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-133 — RPTSTA00: loop condition END-OF-BATCH-STATS is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTSTA00 | **Paragraph:** 2200-PROCESS-BATCH-STATS | **Line:** 161 | **Cause:** source | **SME review:** Yes

The batch statistics read loop in 2200-PROCESS-BATCH-STATS (UNTIL END-OF-BATCH-STATS, line 161; also lines 158, 164) tests a condition name not declared in the program or its copybooks; resolution UNRESOLVED, target_id null. The loop is classified FILE_EXHAUSTION_LOOP from the SET ... TO TRUE statements in the AT END branches.

**Impact:** The end-of-file flag of the batch statistics loop has no known data item; termination is inferred, not confirmed.

**Recommended action:** Locate the declaration of END-OF-BATCH-STATS or confirm it with the development team.

**Source IDs:** File FIL-0050; Paragraphs FIL-0050-PAR-0008; Statements FIL-0050-STMT-000026

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 | 2200-PROCESS-BATCH-STATS | 161 | FIL-0050-STMT-000026 | END-OF-BATCH-STATS |

**Detected in:** logic_artifact | **Also:** PSEUDOCODE_ISSUE

---

### GAP-134 — RPTSTA00: loop condition END-OF-DB2-STATS is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTSTA00 | **Paragraph:** 2100-PROCESS-DB2-STATS | **Line:** 149 | **Cause:** source | **SME review:** Yes

The DB2 statistics read loop in 2100-PROCESS-DB2-STATS (UNTIL END-OF-DB2-STATS, line 149; also lines 146, 152) tests a condition name not declared in the program or its resolved copybooks; resolution UNRESOLVED, target_id null. Agent 4 notes it may come from the unresolved COPY DB2STAT. The loop is classified FILE_EXHAUSTION_LOOP from the SET ... TO TRUE statements in the AT END branches.

**Impact:** The end-of-file flag of the DB2 statistics loop has no known data item; termination is inferred, not confirmed.

**Recommended action:** Resolve COPY DB2STAT or locate the declaration of END-OF-DB2-STATS.

**Source IDs:** File FIL-0050; Paragraphs FIL-0050-PAR-0007; Statements FIL-0050-STMT-000024

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 | 2100-PROCESS-DB2-STATS | 149 | FIL-0050-STMT-000024 | END-OF-DB2-STATS |

**Related:** Gaps: GAP-005

**Detected in:** logic_artifact | **Also:** PSEUDOCODE_ISSUE

---

### GAP-135 — RPTSTA00: RECORD KEY BCH-KEY of BATCH-STATS is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTSTA00 | **Cause:** source | **SME review:** Yes

Agent 3 (carried in the Agent 4 trace_issues) reports that RECORD KEY BCH-KEY (BATCH-STATS) is not declared in the program or in the expanded copybooks. The artifact gives line 20 for the pair of keys; the exact line of the BCH-KEY clause is not recorded.

**Impact:** The key of the batch statistics file cannot be identified.

**Recommended action:** Locate the BATCH-STATS record layout defining BCH-KEY or confirm the key with the development team.

**Source IDs:** File FIL-0050

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 |  |  |  | BCH-KEY |

**Related:** Gaps: GAP-005

**Detected in:** data_artifact, logic_artifact | **Also:** 

---

### GAP-136 — RPTSTA00: RECORD KEY STAT-KEY of DB2-STATS is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTSTA00 | **Line:** 20 | **Cause:** source | **SME review:** Yes

Agent 3 (carried in the Agent 4 trace_issues) reports that RECORD KEY STAT-KEY (DB2-STATS, line 20) is not declared in the program or in the expanded copybooks.

**Impact:** The key of the DB2 statistics file cannot be identified.

**Recommended action:** Resolve COPY DB2STAT or locate the DB2-STATS record layout defining STAT-KEY.

**Source IDs:** File FIL-0050

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 |  | 20 |  | STAT-KEY |

**Related:** Gaps: GAP-005

**Detected in:** data_artifact, logic_artifact | **Also:** 

---

### GAP-137 — RPTSTA00: WS-ERROR-MESSAGE is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** RPTSTA00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 111 | **Cause:** source | **SME review:** Yes

WS-ERROR-MESSAGE (lines 111, 118, 125, 183; paragraphs 1100-OPEN-FILES and 9999-ERROR-HANDLER) is not declared in the program or in copybooks RTNCODE/ERRHAND/BCHCTL; resolution UNRESOLVED, target_id null.

**Impact:** The size of the error message displayed on open failures is unknown.

**Recommended action:** Locate the declaration of WS-ERROR-MESSAGE or confirm it with the development team.

**Source IDs:** File FIL-0050; Paragraphs FIL-0050-PAR-0003, FIL-0050-PAR-0012

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 | 1100-OPEN-FILES | 111 |  | WS-ERROR-MESSAGE |
| RPTSTA00 | 1100-OPEN-FILES | 118 |  | WS-ERROR-MESSAGE |
| RPTSTA00 | 1100-OPEN-FILES | 125 |  | WS-ERROR-MESSAGE |
| RPTSTA00 | 9999-ERROR-HANDLER | 183 |  | WS-ERROR-MESSAGE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-138 — TSTGEN00: WS-ERROR-MESSAGE is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** TSTGEN00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 124 | **Cause:** source | **SME review:** Yes

WS-ERROR-MESSAGE (lines 124, 131, 138, 145 in 1100-OPEN-FILES; 178 in 2100-GENERATE-TEST-DATA; 212 in 9999-ERROR-HANDLER) is not declared in the program or in copybooks RTNCODE, ERRHAND, PORTFLIO, TRNREC (ERRHAND declares ERR-MESSAGE, a different name). resolve-field-references UNRESOLVED; target_id null. The logic file gives no statement IDs for these lines.

**Impact:** Error messages are moved to an item with no definition.

**Recommended action:** Locate the definition of WS-ERROR-MESSAGE or confirm with the development team whether ERR-MESSAGE was meant.

**Source IDs:** File FIL-0075; Paragraphs FIL-0075-PAR-0003, FIL-0075-PAR-0007, FIL-0075-PAR-0013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTGEN00 | 1100-OPEN-FILES | 124 |  | WS-ERROR-MESSAGE (also lines 131, 138, 145) |
| TSTGEN00 | 2100-GENERATE-TEST-DATA | 178 |  | WS-ERROR-MESSAGE |
| TSTGEN00 | 9999-ERROR-HANDLER | 212 |  | WS-ERROR-MESSAGE |

**Related:** Rules: BR-089, BR-090

**Detected in:** logic_artifact | **Also:** 

---

### GAP-139 — TSTVAL00: WS-ERROR-MESSAGE is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** TSTVAL00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 143 | **Cause:** source | **SME review:** Yes

WS-ERROR-MESSAGE (lines 143, 150, 157, 164 in 1100-OPEN-FILES; 199 in 2100-EXECUTE-TEST; 223 in 9999-ERROR-HANDLER) is not declared in the program or in copybooks RTNCODE, ERRHAND; resolve-field-references UNRESOLVED; target_id null. No statement IDs are given for these lines.

**Impact:** Error messages are moved to an item with no definition.

**Recommended action:** Locate the definition of WS-ERROR-MESSAGE or confirm with the development team which item was meant.

**Source IDs:** File FIL-0076; Paragraphs FIL-0076-PAR-0003, FIL-0076-PAR-0007, FIL-0076-PAR-0010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTVAL00 | 1100-OPEN-FILES | 143 |  | WS-ERROR-MESSAGE (also lines 150, 157, 164) |
| TSTVAL00 | 2100-EXECUTE-TEST | 199 |  | WS-ERROR-MESSAGE |
| TSTVAL00 | 9999-ERROR-HANDLER | 223 |  | WS-ERROR-MESSAGE |

**Related:** Rules: BR-091

**Detected in:** logic_artifact | **Also:** 

---

### GAP-140 — UTLMNT00: WS-ERROR-MESSAGE is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** UTLMNT00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 101 | **Cause:** source | **SME review:** Yes

WS-ERROR-MESSAGE (lines 101, 108, 115 in 1100-OPEN-FILES; 144 in 2100-PROCESS-FUNCTION; 178 in 9999-ERROR-HANDLER) is not declared in the program or in copybooks RTNCODE, ERRHAND; resolve-field-references UNRESOLVED; target_id null. No statement IDs are given for these lines.

**Impact:** Error messages are moved to an item with no definition.

**Recommended action:** Locate the definition of WS-ERROR-MESSAGE or confirm with the development team which item was meant.

**Source IDs:** File FIL-0077; Paragraphs FIL-0077-PAR-0003, FIL-0077-PAR-0006, FIL-0077-PAR-0012

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLMNT00 | 1100-OPEN-FILES | 101 |  | WS-ERROR-MESSAGE (also lines 108, 115) |
| UTLMNT00 | 2100-PROCESS-FUNCTION | 144 |  | WS-ERROR-MESSAGE |
| UTLMNT00 | 9999-ERROR-HANDLER | 178 |  | WS-ERROR-MESSAGE |

**Related:** Rules: BR-090, BR-092

**Detected in:** logic_artifact | **Also:** 

---

### GAP-141 — UTLMON00: WS-ERROR-MESSAGE is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** UTLMON00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 143 | **Cause:** source | **SME review:** Yes

WS-ERROR-MESSAGE (lines 143, 150, 157, 164 in 1100-OPEN-FILES; 219 in 9999-ERROR-HANDLER) is not declared in the program or in copybooks RTNCODE, ERRHAND; resolve-field-references UNRESOLVED; target_id null. No statement IDs are given for these lines.

**Impact:** Error messages are moved to an item with no definition.

**Recommended action:** Locate the definition of WS-ERROR-MESSAGE or confirm with the development team which item was meant.

**Source IDs:** File FIL-0078; Paragraphs FIL-0078-PAR-0003, FIL-0078-PAR-0012

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLMON00 | 1100-OPEN-FILES | 143 |  | WS-ERROR-MESSAGE (also lines 150, 157, 164) |
| UTLMON00 | 9999-ERROR-HANDLER | 219 |  | WS-ERROR-MESSAGE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-142 — UTLVAL00: RECORD KEY TRAN-KEY of TRANSACTION-HISTORY is declared nowhere
**Type:** UNDECLARED_DATA_NAME | **Program:** UTLVAL00 | **Line:** 35 | **Cause:** source | **SME review:** Yes

Agent 3 reports that RECORD KEY TRAN-KEY of SELECT TRANSACTION-HISTORY (line 32; key at line 35) is not declared in UTLVAL00 nor in copybook TRNREC; no data item named TRAN-KEY was found in any copybook of the inventory. (RECORD KEY POS-KEY of POSITION-MASTER is declared in copybook POSREC.)

**Impact:** The key by which UTLVAL00 accesses the transaction history file cannot be identified.

**Recommended action:** Locate the record layout that declares TRAN-KEY or confirm the key field with the development team.

**Source IDs:** File FIL-0079

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLVAL00 |  | 35 |  | TRAN-KEY |

**Related:** Diagrams: FLOW-UTLVAL00

**Detected in:** data_artifact | **Also:** 

---

### GAP-143 — UTLVAL00: WS-ERROR-MESSAGE is not declared
**Type:** UNDECLARED_DATA_NAME | **Program:** UTLVAL00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 110 | **Cause:** source | **SME review:** Yes

WS-ERROR-MESSAGE (lines 110, 117, 124, 131 in 1100-OPEN-FILES; 160 in 2100-PROCESS-VALIDATION; 189 in 9999-ERROR-HANDLER) is not declared in the program or in copybooks RTNCODE/ERRHAND/POSREC/TRNREC; resolve-field-references UNRESOLVED; target_id null. No statement IDs are given for these lines.

**Impact:** Error messages are moved to an item with no definition.

**Recommended action:** Locate the definition of WS-ERROR-MESSAGE or confirm with the development team which item was meant.

**Source IDs:** File FIL-0079; Paragraphs FIL-0079-PAR-0003, FIL-0079-PAR-0006, FIL-0079-PAR-0012

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLVAL00 | 1100-OPEN-FILES | 110 |  | WS-ERROR-MESSAGE (also lines 117, 124, 131) |
| UTLVAL00 | 2100-PROCESS-VALIDATION | 160 |  | WS-ERROR-MESSAGE |
| UTLVAL00 | 9999-ERROR-HANDLER | 189 |  | WS-ERROR-MESSAGE |

**Related:** Rules: BR-095

**Detected in:** logic_artifact | **Also:** 

---

### GAP-144 — BCHCTL00: 11 PERFORM targets are not present in the source
**Type:** UNRESOLVABLE_PATH | **Program:** BCHCTL00 | **Paragraph:** 1000-PROCESS-INITIALIZE | **Line:** 84 | **Cause:** source | **SME review:** Yes

Paragraphs 1000-PROCESS-INITIALIZE, 2000-CHECK-PREREQUISITES, 3000-UPDATE-STATUS and 4000-PROCESS-TERMINATE perform 11 paragraphs that do not exist in the source; 9 of them are named only in a trailing comment block (lines 116-127) listing paragraphs 'to be implemented', and 2 (2100-READ-CONTROL-RECORD, 3100-READ-CONTROL-RECORD) are not listed there either. Agent 4 records them as unresolvable steps with null target IDs and notes that the source as delivered would not compile.

**Impact:** The open/read/validate/update/write/close work on BATCH-CONTROL-FILE behind the INIT, CHEK, UPDT and TERM functions is unknown; BATCH-CONTROL-FILE is never opened, read, written or closed by statements present in the source, and on the INIT, UPDT and TERM paths the return code is whatever the caller passed (or what the missing paragraphs would set).

**Recommended action:** Locate the complete version of BCHCTL00 (or the missing paragraphs) in the source library; until then document the four batch control functions as incomplete and confirm their intended behaviour with an SME.

**Source IDs:** File FIL-0042; Paragraphs FIL-0042-PAR-0002, FIL-0042-PAR-0003, FIL-0042-PAR-0004, FIL-0042-PAR-0005; Statements FIL-0042-STMT-000004, FIL-0042-STMT-000005, FIL-0042-STMT-000006, FIL-0042-STMT-000007, FIL-0042-STMT-000008, FIL-0042-STMT-000009, FIL-0042-STMT-000011, FIL-0042-STMT-000012, FIL-0042-STMT-000013, FIL-0042-STMT-000014, FIL-0042-STMT-000015

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| BCHCTL00 | 1000-PROCESS-INITIALIZE | 84 | FIL-0042-STMT-000004 | 1100-OPEN-FILES |
| BCHCTL00 | 1000-PROCESS-INITIALIZE | 85 | FIL-0042-STMT-000005 | 1200-READ-CONTROL-RECORD |
| BCHCTL00 | 1000-PROCESS-INITIALIZE | 86 | FIL-0042-STMT-000006 | 1300-VALIDATE-PROCESS |
| BCHCTL00 | 1000-PROCESS-INITIALIZE | 87 | FIL-0042-STMT-000007 | 1400-UPDATE-START-STATUS |
| BCHCTL00 | 2000-CHECK-PREREQUISITES | 91 | FIL-0042-STMT-000008 | 2100-READ-CONTROL-RECORD |
| BCHCTL00 | 2000-CHECK-PREREQUISITES | 92 | FIL-0042-STMT-000009 | 2200-CHECK-DEPENDENCIES |
| BCHCTL00 | 3000-UPDATE-STATUS | 101 | FIL-0042-STMT-000011 | 3100-READ-CONTROL-RECORD |
| BCHCTL00 | 3000-UPDATE-STATUS | 102 | FIL-0042-STMT-000012 | 3200-UPDATE-PROCESS-STATUS |
| BCHCTL00 | 3000-UPDATE-STATUS | 103 | FIL-0042-STMT-000013 | 3300-WRITE-CONTROL-RECORD |
| BCHCTL00 | 4000-PROCESS-TERMINATE | 107 | FIL-0042-STMT-000014 | 4100-UPDATE-COMPLETION |
| BCHCTL00 | 4000-PROCESS-TERMINATE | 108 | FIL-0042-STMT-000015 | 4200-CLOSE-FILES |

**Related:** Rules: BR-001, BR-002 | Gaps: GAP-173, GAP-249

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT, PSEUDOCODE_ISSUE

---

### GAP-145 — CURSMGR: source is truncated; fetch and close cursor paragraphs are missing
**Type:** UNRESOLVABLE_PATH | **Program:** CURSMGR | **Paragraph:** (UNNAMED) | **Line:** 52 | **Cause:** source | **SME review:** Yes

The source file ends at line 91 with 'P200-EXIT' and no terminating period or newline. Paragraphs P300-FETCH-DATA, P300-EXIT, P400-CLOSE-CURSOR and P400-EXIT, referenced by PERFORM ... THRU at lines 52 and 55 of the request dispatch, are not present. Recorded as 2 unresolvable steps with null target IDs.

**Impact:** The fetch (CURS-FETCH) and close (CURS-CLOSE) cursor functions cannot be described; only declare and open are traced.

**Recommended action:** Obtain the complete CURSMGR source from the source library and re-run the pipeline for it; confirm the fetch and close behaviour with an SME.

**Source IDs:** File FIL-0059; Paragraphs FIL-0059-PAR-0001; Statements FIL-0059-STMT-000015, FIL-0059-STMT-000013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| CURSMGR | (UNNAMED) | 52 | FIL-0059-STMT-000015 | P300-FETCH-DATA THRU P300-EXIT |
| CURSMGR | (UNNAMED) | 55 | FIL-0059-STMT-000013 | P400-CLOSE-CURSOR THRU P400-EXIT |

**Related:** Rules: BR-043 | Gaps: GAP-212, GAP-250, GAP-256

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT, PSEUDOCODE_ISSUE

---

### GAP-146 — DB2HNDL: PERFORM 2310-PROCESS-CURSOR-ROW target is not declared
**Type:** UNRESOLVABLE_PATH | **Program:** DB2HNDL | **Paragraph:** 2300-CURSOR-EXAMPLE | **Line:** 174 | **Cause:** source | **SME review:** Yes

Agent 4 records 1 unresolvable path in DB2HNDL: PERFORM 2310-PROCESS-CURSOR-ROW (statement STMT-000038, 2300-CURSOR-EXAMPLE; line 174 per trace_issues and unresolved_statements) names a paragraph not defined in the program; it is translated as a call with an !! UNRESOLVED flag. The per-row processing of the cursor loop is unknown. The unresolvable_paths entry itself carries no line or reason field. The source is under src/templates (file db2-handling.cbl).

**Impact:** The per-row processing of the DB2 cursor example is absent from the BRD.

**Recommended action:** Locate the missing paragraph or confirm with the development team that the template is intentionally incomplete.

**Source IDs:** File FIL-0080; Paragraphs FIL-0080-PAR-0006; Statements FIL-0080-STMT-000038

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2HNDL | 2300-CURSOR-EXAMPLE | 174 | FIL-0080-STMT-000038 | 2310-PROCESS-CURSOR-ROW |

**Related:** Gaps: GAP-251

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-147 — FILEHNDL: 2 PERFORM targets are not declared (inside confirmed dead code)
**Type:** UNRESOLVABLE_PATH | **Program:** FILEHNDL | **Paragraph:** 2100-READ-VSAM | **Line:** 122 | **Cause:** source | **SME review:** No

Agent 4 records 2 unresolvable paths in FILEHNDL: PERFORM 2110-PROCESS-VSAM-RECORD (line 122, STMT-000029, 2100-READ-VSAM) and PERFORM 2310-PROCESS-INPUT-RECORD (line 144, STMT-000032, 2300-READ-SEQUENTIAL) name paragraphs not declared in the program (Agent 2 cfg_issues unresolved_target). Both statements lie inside confirmed dead code. The source is a template under src/templates.

**Impact:** Limited: the missing targets are only referenced from unreachable template paragraphs; their record-processing logic is unknown.

**Recommended action:** Confirm with the development team that the template paragraphs are examples; otherwise locate the missing paragraphs.

**Source IDs:** File FIL-0082; Paragraphs FIL-0082-PAR-0004, FIL-0082-PAR-0006; Statements FIL-0082-STMT-000029, FIL-0082-STMT-000032

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| FILEHNDL | 2100-READ-VSAM | 122 | FIL-0082-STMT-000029 | 2110-PROCESS-VSAM-RECORD |
| FILEHNDL | 2300-READ-SEQUENTIAL | 144 | FIL-0082-STMT-000032 | 2310-PROCESS-INPUT-RECORD |

**Related:** Gaps: GAP-253

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-148 — HISTLD00: DB2 connect, error and disconnect PERFORM targets are not paragraphs of the program
**Type:** UNRESOLVABLE_PATH | **Program:** HISTLD00 | **Paragraph:** 1200-CONNECT-DB2 | **Line:** 117 | **Cause:** source | **SME review:** Yes

PERFORM CONNECT-TO-DB2 (line 117), DB2-ERROR-ROUTINE (line 172) and DISCONNECT-FROM-DB2 (line 216) name no paragraph or section of HISTLD00. Agent 3 reports paragraphs with these names as procedure code inside copybook DBPROC (copybook lines 26-63), but COPY DBPROC is in WORKING-STORAGE (line 45), so no procedure paragraph is registered for this program. Recorded as unresolvable steps with null target IDs.

**Impact:** The DB2 connection, DB2 error handling and DB2 disconnection behaviour of the history load is not traced; their logic is not filled in.

**Recommended action:** Confirm how DBPROC's procedure code is meant to be included (COPY placement in the PROCEDURE DIVISION) and document the three DB2 routines from the copybook source with the development team.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0006, FIL-0044-PAR-0009, FIL-0044-PAR-0014; Statements FIL-0044-STMT-000019, FIL-0044-STMT-000076, FIL-0044-STMT-000050

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 1200-CONNECT-DB2 | 117 | FIL-0044-STMT-000019 | CONNECT-TO-DB2 |
| HISTLD00 | 2200-LOAD-TO-DB2 | 172 | FIL-0044-STMT-000076 | DB2-ERROR-ROUTINE |
| HISTLD00 | 3300-DISCONNECT-DB2 | 216 | FIL-0044-STMT-000050 | DISCONNECT-FROM-DB2 |

**Related:** Gaps: GAP-222, GAP-254

**Detected in:** logic_artifact, parser_artifact, data_artifact | **Also:** UNRESOLVED_STATEMENT, PSEUDOCODE_ISSUE

---

### GAP-149 — INQHIST: recursive PERFORM of P150-DB2-CONNECT could not be traced
**Type:** UNRESOLVABLE_PATH | **Program:** INQHIST | **Paragraph:** P150-DB2-CONNECT | **Line:** 114 | **Cause:** analysis | **SME review:** Yes

Agent 4 records 1 unresolvable path in INQHIST. At line 114 (statement STMT-000043) paragraph P150-DB2-CONNECT performs its own range P150-DB2-CONNECT THRU P150-EXIT when RECV-SUCCESS is true. The recursion depth depends on the run-time results of DB2ONLN and DB2RECV, so tracing of this path was stopped. The source has no recursion limit; Agent 4 notes that COBOL does not define recursive PERFORM of an active range.

**Impact:** The DB2 connection-recovery retry path of INQHIST is documented only up to the first recursive entry; the number of retries and the behaviour of a repeated connect are not known from static analysis.

**Recommended action:** Confirm with the development team how the recursive PERFORM behaves at run time (compiler behaviour, retry limit, exit condition) and whether it is intended as a retry loop.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0004; Statements FIL-0063-STMT-000036, FIL-0063-STMT-000013, FIL-0063-STMT-000043; Fields FIL-0063-FLD-000032, FIL-0063-FLD-000033

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQHIST | P150-DB2-CONNECT | 113 | FIL-0063-STMT-000036 |  |
| INQHIST | P150-DB2-CONNECT | 103 | FIL-0063-STMT-000013 |  |
| INQHIST | P150-DB2-CONNECT | 114 | FIL-0063-STMT-000043 | P150-DB2-CONNECT THRU P150-EXIT |

**Related:** Rules: BR-053 | Gaps: GAP-216, GAP-255, GAP-256

**Detected in:** rules_artifact, logic_artifact, parser_artifact | **Also:** RECURSIVE_PERFORM, UNRESOLVED_STATEMENT

---

### GAP-150 — RPTAUD00: all 7 PERFORM targets of the report processing paragraphs are missing
**Type:** UNRESOLVABLE_PATH | **Program:** RPTAUD00 | **Paragraph:** 2100-PROCESS-AUDIT-TRAIL | **Line:** 127 | **Cause:** source | **SME review:** Yes

Paragraphs 2100-PROCESS-AUDIT-TRAIL, 2200-PROCESS-ERROR-LOG and 2300-WRITE-SUMMARY perform 7 paragraphs that are not declared in the program; Agent 4 reports they are also missing from every other source file under src/. Recorded as unresolvable steps.

**Impact:** The reading of the audit and error files and all summary output of the audit report cannot be traced; the report's content is unknown.

**Recommended action:** Locate the complete version of RPTAUD00 (or the missing paragraphs) in the source library; confirm the audit report content with an SME.

**Source IDs:** File FIL-0048; Paragraphs FIL-0048-PAR-0006, FIL-0048-PAR-0007, FIL-0048-PAR-0008; Statements FIL-0048-STMT-000020, FIL-0048-STMT-000021, FIL-0048-STMT-000022, FIL-0048-STMT-000023, FIL-0048-STMT-000024, FIL-0048-STMT-000025, FIL-0048-STMT-000026

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTAUD00 | 2100-PROCESS-AUDIT-TRAIL | 127 | FIL-0048-STMT-000020 | 2110-READ-AUDIT-RECORDS |
| RPTAUD00 | 2100-PROCESS-AUDIT-TRAIL | 128 | FIL-0048-STMT-000021 | 2120-SUMMARIZE-AUDIT |
| RPTAUD00 | 2200-PROCESS-ERROR-LOG | 131 | FIL-0048-STMT-000022 | 2210-READ-ERROR-RECORDS |
| RPTAUD00 | 2200-PROCESS-ERROR-LOG | 132 | FIL-0048-STMT-000023 | 2220-SUMMARIZE-ERRORS |
| RPTAUD00 | 2300-WRITE-SUMMARY | 135 | FIL-0048-STMT-000024 | 2310-WRITE-AUDIT-SUMMARY |
| RPTAUD00 | 2300-WRITE-SUMMARY | 136 | FIL-0048-STMT-000025 | 2320-WRITE-ERROR-SUMMARY |
| RPTAUD00 | 2300-WRITE-SUMMARY | 137 | FIL-0048-STMT-000026 | 2330-WRITE-CONTROL-SUMMARY |

**Related:** Gaps: GAP-259

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT, PSEUDOCODE_ISSUE

---

### GAP-151 — RPTPOS00: 5 PERFORM targets of the transaction and summary sections are missing
**Type:** UNRESOLVABLE_PATH | **Program:** RPTPOS00 | **Paragraph:** 2200-PROCESS-TRANSACTIONS | **Line:** 144 | **Cause:** source | **SME review:** Yes

2200-PROCESS-TRANSACTIONS and 2300-WRITE-SUMMARY perform 5 paragraphs that are not paragraphs or sections of the program; the PROCEDURE DIVISION has no COPY statements, and a source search finds no paragraph of these names in RPTPOS00 or in any copybook of the repository. Recorded as unresolvable steps with null target IDs.

**Impact:** The transaction-activity and summary sections of the position report (totals, exceptions, metrics) cannot be traced.

**Recommended action:** Locate the complete version of RPTPOS00 (or the missing paragraphs); confirm the report's transaction and summary content with an SME.

**Source IDs:** File FIL-0049; Paragraphs FIL-0049-PAR-0008, FIL-0049-PAR-0009; Statements FIL-0049-STMT-000028, FIL-0049-STMT-000029, FIL-0049-STMT-000030, FIL-0049-STMT-000031, FIL-0049-STMT-000032

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 | 2200-PROCESS-TRANSACTIONS | 144 | FIL-0049-STMT-000028 | 2210-READ-TRANSACTIONS |
| RPTPOS00 | 2200-PROCESS-TRANSACTIONS | 145 | FIL-0049-STMT-000029 | 2220-SUMMARIZE-ACTIVITY |
| RPTPOS00 | 2300-WRITE-SUMMARY | 148 | FIL-0049-STMT-000030 | 2310-WRITE-TOTALS |
| RPTPOS00 | 2300-WRITE-SUMMARY | 149 | FIL-0049-STMT-000031 | 2320-WRITE-EXCEPTIONS |
| RPTPOS00 | 2300-WRITE-SUMMARY | 150 | FIL-0049-STMT-000032 | 2330-WRITE-METRICS |

**Related:** Gaps: GAP-260

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT, PSEUDOCODE_ISSUE

---

### GAP-152 — RPTSTA00: 7 PERFORM targets for accumulation, metrics and report writing are missing
**Type:** UNRESOLVABLE_PATH | **Program:** RPTSTA00 | **Paragraph:** 2100-PROCESS-DB2-STATS | **Line:** 150 | **Cause:** source | **SME review:** Yes

2100-PROCESS-DB2-STATS, 2200-PROCESS-BATCH-STATS, 2300-CALCULATE-METRICS and 2400-WRITE-REPORT perform 7 paragraphs that are not paragraphs or sections of the program; a source search finds no paragraph of these names in RPTSTA00 or in any copybook. Recorded as unresolvable steps with null target IDs.

**Impact:** Accumulation of DB2 and batch statistics, metric calculation and the writing of every report section cannot be traced.

**Recommended action:** Locate the complete version of RPTSTA00 (or the missing paragraphs); confirm the statistics report content with an SME.

**Source IDs:** File FIL-0050; Paragraphs FIL-0050-PAR-0007, FIL-0050-PAR-0008, FIL-0050-PAR-0009, FIL-0050-PAR-0010; Statements FIL-0050-STMT-000043, FIL-0050-STMT-000046, FIL-0050-STMT-000027, FIL-0050-STMT-000028, FIL-0050-STMT-000029, FIL-0050-STMT-000030, FIL-0050-STMT-000031

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 | 2100-PROCESS-DB2-STATS | 150 | FIL-0050-STMT-000043 | 2110-ACCUMULATE-DB2-STATS |
| RPTSTA00 | 2200-PROCESS-BATCH-STATS | 162 | FIL-0050-STMT-000046 | 2210-ACCUMULATE-BATCH-STATS |
| RPTSTA00 | 2300-CALCULATE-METRICS | 169 | FIL-0050-STMT-000027 | 2310-CALC-DB2-METRICS |
| RPTSTA00 | 2300-CALCULATE-METRICS | 170 | FIL-0050-STMT-000028 | 2320-CALC-BATCH-METRICS |
| RPTSTA00 | 2400-WRITE-REPORT | 173 | FIL-0050-STMT-000029 | 2410-WRITE-DB2-SECTION |
| RPTSTA00 | 2400-WRITE-REPORT | 174 | FIL-0050-STMT-000030 | 2420-WRITE-BATCH-SECTION |
| RPTSTA00 | 2400-WRITE-REPORT | 175 | FIL-0050-STMT-000031 | 2430-WRITE-TREND-ANALYSIS |

**Related:** Gaps: GAP-005, GAP-261

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT, PSEUDOCODE_ISSUE

---

### GAP-153 — TSTGEN00: 8 PERFORM targets are not declared in the program
**Type:** UNRESOLVABLE_PATH | **Program:** TSTGEN00 | **Paragraph:** 2200-GEN-PORTFOLIO | **Line:** 185 | **Cause:** source | **SME review:** Yes

Agent 4 records 8 unresolvable paths in TSTGEN00: the PERFORM targets 2210-GEN-PORT-DATA, 2220-WRITE-PORT-RECORD (2200-GEN-PORTFOLIO), 2310-GEN-TRAN-DATA, 2320-WRITE-TRAN-RECORD (2300-GEN-TRANSACTION), 2410-GEN-DATA-ERRORS, 2420-GEN-PROCESS-ERRORS (2400-GEN-ERROR-DATA), 2510-GEN-LARGE-PORTFOLIO and 2520-GEN-LARGE-TRANSACTION (2500-GEN-VOLUME-DATA) are not declared as a paragraph or section in this program (Agent 2 resolved=false; no relationship registered). The work done inside the two VARYING loops (2200, 2300) and by 2400/2500 cannot be traced; whether the missing paragraphs modify the loop index WS-RECORDS-WRITTEN or CFG-VOLUME cannot be determined.

**Impact:** The actual test-data generation (portfolio, transaction, error and volume records) is absent from the BRD; only the driver paragraphs are documented.

**Recommended action:** Locate the missing source of these paragraphs (truncated or separate member) or confirm with the development team that the program is incomplete.

**Source IDs:** File FIL-0075; Paragraphs FIL-0075-PAR-0008, FIL-0075-PAR-0009, FIL-0075-PAR-0010, FIL-0075-PAR-0011; Statements FIL-0075-STMT-000046, FIL-0075-STMT-000047, FIL-0075-STMT-000048, FIL-0075-STMT-000049, FIL-0075-STMT-000023, FIL-0075-STMT-000024, FIL-0075-STMT-000025, FIL-0075-STMT-000026

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTGEN00 | 2200-GEN-PORTFOLIO | 185 | FIL-0075-STMT-000046 | 2210-GEN-PORT-DATA |
| TSTGEN00 | 2200-GEN-PORTFOLIO | 186 | FIL-0075-STMT-000047 | 2220-WRITE-PORT-RECORD |
| TSTGEN00 | 2300-GEN-TRANSACTION | 192 | FIL-0075-STMT-000048 | 2310-GEN-TRAN-DATA |
| TSTGEN00 | 2300-GEN-TRANSACTION | 193 | FIL-0075-STMT-000049 | 2320-WRITE-TRAN-RECORD |
| TSTGEN00 | 2400-GEN-ERROR-DATA | 197 | FIL-0075-STMT-000023 | 2410-GEN-DATA-ERRORS |
| TSTGEN00 | 2400-GEN-ERROR-DATA | 198 | FIL-0075-STMT-000024 | 2420-GEN-PROCESS-ERRORS |
| TSTGEN00 | 2500-GEN-VOLUME-DATA | 201 | FIL-0075-STMT-000025 | 2510-GEN-LARGE-PORTFOLIO |
| TSTGEN00 | 2500-GEN-VOLUME-DATA | 202 | FIL-0075-STMT-000026 | 2520-GEN-LARGE-TRANSACTION |

**Related:** Gaps: GAP-262

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-154 — TSTVAL00: 7 PERFORM targets are not declared in the program
**Type:** UNRESOLVABLE_PATH | **Program:** TSTVAL00 | **Paragraph:** 2100-EXECUTE-TEST | **Line:** 190 | **Cause:** source | **SME review:** Yes

Agent 4 records 7 unresolvable paths in TSTVAL00, all in 2100-EXECUTE-TEST: 2200-RUN-FUNCTIONAL-TEST, 2300-RUN-INTEGRATION-TEST, 2400-RUN-PERFORMANCE-TEST, 2500-RUN-ERROR-TEST, 2600-VALIDATE-RESULTS, 2700-UPDATE-METRICS and 2800-WRITE-TEST-DETAIL are not declared as a paragraph or section (Agent 2 resolved=false; no relationship registered). Test execution, result validation, metric update and detail-line writing cannot be traced. EXPECTED-RESULTS and ACTUAL-RESULTS are opened and closed but read by no statement in the program; they may be read by the unresolved paragraphs.

**Impact:** The test-validation behaviour of TSTVAL00 is absent from the BRD; only the driver is documented.

**Recommended action:** Locate the missing source of these paragraphs or confirm with the development team that the program is incomplete.

**Source IDs:** File FIL-0076; Paragraphs FIL-0076-PAR-0007; Statements FIL-0076-STMT-000048, FIL-0076-STMT-000049, FIL-0076-STMT-000050, FIL-0076-STMT-000047, FIL-0076-STMT-000023, FIL-0076-STMT-000024, FIL-0076-STMT-000025

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTVAL00 | 2100-EXECUTE-TEST | 190 | FIL-0076-STMT-000048 | 2200-RUN-FUNCTIONAL-TEST |
| TSTVAL00 | 2100-EXECUTE-TEST | 192 | FIL-0076-STMT-000049 | 2300-RUN-INTEGRATION-TEST |
| TSTVAL00 | 2100-EXECUTE-TEST | 194 | FIL-0076-STMT-000050 | 2400-RUN-PERFORMANCE-TEST |
| TSTVAL00 | 2100-EXECUTE-TEST | 196 | FIL-0076-STMT-000047 | 2500-RUN-ERROR-TEST |
| TSTVAL00 | 2100-EXECUTE-TEST | 202 | FIL-0076-STMT-000023 | 2600-VALIDATE-RESULTS |
| TSTVAL00 | 2100-EXECUTE-TEST | 203 | FIL-0076-STMT-000024 | 2700-UPDATE-METRICS |
| TSTVAL00 | 2100-EXECUTE-TEST | 204 | FIL-0076-STMT-000025 | 2800-WRITE-TEST-DETAIL |

**Related:** Rules: BR-091 | Gaps: GAP-263

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-155 — UTLMNT00: 11 PERFORM targets are not declared in the program
**Type:** UNRESOLVABLE_PATH | **Program:** UTLMNT00 | **Paragraph:** 2200-ARCHIVE-PROCESS | **Line:** 150 | **Cause:** source | **SME review:** Yes

Agent 4 records 11 unresolvable paths in UTLMNT00: 2210-OPEN-VSAM, 2220-ARCHIVE-RECORDS, 2230-CLOSE-VSAM (2200-ARCHIVE-PROCESS), 2310-ANALYZE-SPACE, 2320-DELETE-OLD, 2330-UPDATE-CATALOG (2300-CLEANUP-PROCESS), 2410-EXPORT-DATA, 2420-DELETE-DEFINE, 2430-IMPORT-DATA (2400-REORG-PROCESS), 2510-COLLECT-STATS and 2520-GENERATE-REPORT (2500-ANALYZE-PROCESS) are not declared as paragraphs or sections in this file (no COPY in the PROCEDURE DIVISION; Agent 2 resolved=false). The actual archive, cleanup, reorganisation and analysis work cannot be traced. Several data items and ARCHIVE-FILE / REPORT-FILE are never used by a statement in the program and may be used by the unresolved paragraphs.

**Impact:** The maintenance functions of UTLMNT00 are absent from the BRD; only the dispatcher is documented.

**Recommended action:** Locate the missing source of these paragraphs or confirm with the development team that the program is incomplete.

**Source IDs:** File FIL-0077; Paragraphs FIL-0077-PAR-0007, FIL-0077-PAR-0008, FIL-0077-PAR-0009, FIL-0077-PAR-0010; Statements FIL-0077-STMT-000017, FIL-0077-STMT-000018, FIL-0077-STMT-000019, FIL-0077-STMT-000021, FIL-0077-STMT-000022, FIL-0077-STMT-000023, FIL-0077-STMT-000025, FIL-0077-STMT-000026, FIL-0077-STMT-000027, FIL-0077-STMT-000029, FIL-0077-STMT-000030

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLMNT00 | 2200-ARCHIVE-PROCESS | 150 | FIL-0077-STMT-000017 | 2210-OPEN-VSAM |
| UTLMNT00 | 2200-ARCHIVE-PROCESS | 151 | FIL-0077-STMT-000018 | 2220-ARCHIVE-RECORDS |
| UTLMNT00 | 2200-ARCHIVE-PROCESS | 152 | FIL-0077-STMT-000019 | 2230-CLOSE-VSAM |
| UTLMNT00 | 2300-CLEANUP-PROCESS | 156 | FIL-0077-STMT-000021 | 2310-ANALYZE-SPACE |
| UTLMNT00 | 2300-CLEANUP-PROCESS | 157 | FIL-0077-STMT-000022 | 2320-DELETE-OLD |
| UTLMNT00 | 2300-CLEANUP-PROCESS | 158 | FIL-0077-STMT-000023 | 2330-UPDATE-CATALOG |
| UTLMNT00 | 2400-REORG-PROCESS | 162 | FIL-0077-STMT-000025 | 2410-EXPORT-DATA |
| UTLMNT00 | 2400-REORG-PROCESS | 163 | FIL-0077-STMT-000026 | 2420-DELETE-DEFINE |
| UTLMNT00 | 2400-REORG-PROCESS | 164 | FIL-0077-STMT-000027 | 2430-IMPORT-DATA |
| UTLMNT00 | 2500-ANALYZE-PROCESS | 168 | FIL-0077-STMT-000029 | 2510-COLLECT-STATS |
| UTLMNT00 | 2500-ANALYZE-PROCESS | 169 | FIL-0077-STMT-000030 | 2520-GENERATE-REPORT |

**Related:** Gaps: GAP-264

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-156 — UTLMON00: 13 PERFORM targets are not declared in the program
**Type:** UNRESOLVABLE_PATH | **Program:** UTLMON00 | **Paragraph:** 1300-READ-CONFIG | **Line:** 177 | **Cause:** source | **SME review:** Yes

Agent 4 records 13 unresolvable paths in UTLMON00: 1310-STORE-CONFIG (1300-READ-CONFIG); 2110-GET-CPU-METRICS, 2120-GET-MEMORY-METRICS, 2130-GET-DASD-METRICS, 2140-GET-DB2-METRICS (2100-COLLECT-METRICS); 2210-CHECK-UTILIZATION, 2220-CHECK-RESPONSE, 2230-CHECK-QUEUES, 2240-CHECK-ERRORS (2200-CHECK-THRESHOLDS); 2310-LOG-RESOURCES, 2320-LOG-PERFORMANCE (2300-LOG-STATUS); 2410-FORMAT-ALERT, 2420-WRITE-ALERT (2400-GENERATE-ALERTS). None has a matching paragraph in the file (Agent 2 resolved=false). Configuration storage, metric collection, threshold checks, status logging and alert formatting/writing cannot be traced. THRESHOLD-MET, tested at line 207, is set by no statement in the program and may be set by the unresolved paragraphs 2210-2240.

**Impact:** The monitoring logic of UTLMON00 is absent from the BRD; only the driver loop is documented.

**Recommended action:** Locate the missing source of these paragraphs or confirm with the development team that the program is incomplete.

**Source IDs:** File FIL-0078; Paragraphs FIL-0078-PAR-0005, FIL-0078-PAR-0007, FIL-0078-PAR-0008, FIL-0078-PAR-0009, FIL-0078-PAR-0010; Statements FIL-0078-STMT-000052, FIL-0078-STMT-000024, FIL-0078-STMT-000025, FIL-0078-STMT-000026, FIL-0078-STMT-000027, FIL-0078-STMT-000028, FIL-0078-STMT-000029, FIL-0078-STMT-000030, FIL-0078-STMT-000031, FIL-0078-STMT-000033, FIL-0078-STMT-000034, FIL-0078-STMT-000049, FIL-0078-STMT-000050

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLMON00 | 1300-READ-CONFIG | 177 | FIL-0078-STMT-000052 | 1310-STORE-CONFIG |
| UTLMON00 | 2100-COLLECT-METRICS | 190 | FIL-0078-STMT-000024 | 2110-GET-CPU-METRICS |
| UTLMON00 | 2100-COLLECT-METRICS | 191 | FIL-0078-STMT-000025 | 2120-GET-MEMORY-METRICS |
| UTLMON00 | 2100-COLLECT-METRICS | 192 | FIL-0078-STMT-000026 | 2130-GET-DASD-METRICS |
| UTLMON00 | 2100-COLLECT-METRICS | 193 | FIL-0078-STMT-000027 | 2140-GET-DB2-METRICS |
| UTLMON00 | 2200-CHECK-THRESHOLDS | 196 | FIL-0078-STMT-000028 | 2210-CHECK-UTILIZATION |
| UTLMON00 | 2200-CHECK-THRESHOLDS | 197 | FIL-0078-STMT-000029 | 2220-CHECK-RESPONSE |
| UTLMON00 | 2200-CHECK-THRESHOLDS | 198 | FIL-0078-STMT-000030 | 2230-CHECK-QUEUES |
| UTLMON00 | 2200-CHECK-THRESHOLDS | 199 | FIL-0078-STMT-000031 | 2240-CHECK-ERRORS |
| UTLMON00 | 2300-LOG-STATUS | 203 | FIL-0078-STMT-000033 | 2310-LOG-RESOURCES |
| UTLMON00 | 2300-LOG-STATUS | 204 | FIL-0078-STMT-000034 | 2320-LOG-PERFORMANCE |
| UTLMON00 | 2400-GENERATE-ALERTS | 208 | FIL-0078-STMT-000049 | 2410-FORMAT-ALERT |
| UTLMON00 | 2400-GENERATE-ALERTS | 209 | FIL-0078-STMT-000050 | 2420-WRITE-ALERT |

**Related:** Rules: BR-093 | Gaps: GAP-006, GAP-265, GAP-266, GAP-280

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-157 — UTLVAL00: 8 PERFORM targets are not declared in the program
**Type:** UNRESOLVABLE_PATH | **Program:** UTLVAL00 | **Paragraph:** 2200-CHECK-INTEGRITY | **Line:** 165 | **Cause:** source | **SME review:** Yes

Agent 4 records 8 unresolvable paths in UTLVAL00: 2210-CHECK-POSITION-INTEGRITY, 2220-CHECK-TRANSACTION-INTEGRITY (2200-CHECK-INTEGRITY), 2310-CHECK-POSITION-XREF, 2320-CHECK-TRANSACTION-XREF (2300-CHECK-XREF), 2410-CHECK-POSITION-FORMAT, 2420-CHECK-TRANSACTION-FORMAT (2400-CHECK-FORMAT), 2510-ACCUMULATE-POSITIONS and 2520-VERIFY-BALANCES (2500-CHECK-BALANCE). No paragraph of these names exists in UTLVAL00 or in any copybook. The actual integrity, cross-reference, format and balance checks cannot be traced; several counters and ERROR-FOUND / VAL-PARAMETERS may be used only in the missing paragraphs.

**Impact:** The data-validation checks of UTLVAL00 are absent from the BRD; only the driver is documented.

**Recommended action:** Locate the missing source of these paragraphs or confirm with the development team that the program is incomplete.

**Source IDs:** File FIL-0079; Paragraphs FIL-0079-PAR-0007, FIL-0079-PAR-0008, FIL-0079-PAR-0009, FIL-0079-PAR-0010; Statements FIL-0079-STMT-000018, FIL-0079-STMT-000019, FIL-0079-STMT-000020, FIL-0079-STMT-000021, FIL-0079-STMT-000022, FIL-0079-STMT-000023, FIL-0079-STMT-000024, FIL-0079-STMT-000025

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLVAL00 | 2200-CHECK-INTEGRITY | 165 | FIL-0079-STMT-000018 | 2210-CHECK-POSITION-INTEGRITY |
| UTLVAL00 | 2200-CHECK-INTEGRITY | 166 | FIL-0079-STMT-000019 | 2220-CHECK-TRANSACTION-INTEGRITY |
| UTLVAL00 | 2300-CHECK-XREF | 169 | FIL-0079-STMT-000020 | 2310-CHECK-POSITION-XREF |
| UTLVAL00 | 2300-CHECK-XREF | 170 | FIL-0079-STMT-000021 | 2320-CHECK-TRANSACTION-XREF |
| UTLVAL00 | 2400-CHECK-FORMAT | 173 | FIL-0079-STMT-000022 | 2410-CHECK-POSITION-FORMAT |
| UTLVAL00 | 2400-CHECK-FORMAT | 174 | FIL-0079-STMT-000023 | 2420-CHECK-TRANSACTION-FORMAT |
| UTLVAL00 | 2500-CHECK-BALANCE | 177 | FIL-0079-STMT-000024 | 2510-ACCUMULATE-POSITIONS |
| UTLVAL00 | 2500-CHECK-BALANCE | 178 | FIL-0079-STMT-000025 | 2520-VERIFY-BALANCES |

**Related:** Gaps: GAP-267, GAP-268, GAP-281

**Detected in:** logic_artifact, parser_artifact | **Also:** UNRESOLVED_STATEMENT

---

### GAP-158 — DB2CONN: CALL 'DELAY' targets a program not in the repository
**Type:** UNRESOLVED_CALL | **Program:** DB2CONN | **Paragraph:** 1000-CONNECT | **Line:** 86 | **Cause:** source | **SME review:** Yes

Static CALL 'DELAY' USING DB2-RETRY-WAIT (line 86, 1000-CONNECT) is made between failed DB2 connect attempts. Agent 4 records it as an external program, not part of this program's CFG, whose behaviour is not traced; the calls_made target has no paragraph or section ID. The inventory records the edge DB2CONN -> DELAY as resolved false (not found in the file registry).

**Impact:** The wait behaviour between DB2 connection retries is not documented.

**Recommended action:** Determine if DELAY is in a load library, vendor package, or OS utility. Document its interface (DB2-RETRY-WAIT) and expected behaviour.

**Source IDs:** File FIL-0055; Paragraphs FIL-0055-PAR-0002; Statements FIL-0055-STMT-000041

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2CONN | 1000-CONNECT | 86 | FIL-0055-STMT-000041 | DELAY |

**Related:** Rules: BR-036 | Gaps: GAP-248 | Diagrams: COMP-OVERVIEW, FLOW-DB2CONN

**Detected in:** logic_artifact, inventory_artifact, parser_artifact, diagrams_artifact | **Also:** UNRESOLVED_REFERENCE

---

### GAP-159 — ERRHANDL: CALL 'CEE3ABD' is an external service, not traced
**Type:** UNRESOLVED_CALL | **Program:** ERRHANDL | **Paragraph:** 8500-INITIATE-ABEND | **Line:** 186 | **Cause:** source | **SME review:** Yes

CALL 'CEE3ABD' USING RC-CRITICAL, 3 (line 186, STMT-000040, 8500-INITIATE-ABEND) calls an external Language Environment abend service, not a program of this system; it is not traced and has no paragraph or file ID. 2000-PROCESS performs 8040-HANDLE-ABEND unconditionally (line 169, STMT-000036), and 8040 performs 8500-INITIATE-ABEND. If CEE3ABD abends the run unit as its name indicates, steps 13-15 (3000-TERMINATE, 8000-CHECK-FINAL-STATUS, GOBACK) are not reached; the static trace lists them in source order, and whether they run depends on the external service's behaviour (flagged ambiguous). The source is a template under src/templates/error whose 2000-PROCESS runs every handler once in fixed order.

**Impact:** Whether the final status check and termination run after the abend call is unknown.

**Recommended action:** Determine if CEE3ABD is in a load library, vendor package, or OS utility (Language Environment). Document the interface and expected behaviour.

**Source IDs:** File FIL-0081; Paragraphs FIL-0081-PAR-0011, FIL-0081-PAR-0009, FIL-0081-PAR-0004, FIL-0081-PAR-0005; Statements FIL-0081-STMT-000040, FIL-0081-STMT-000036

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| ERRHANDL | 8500-INITIATE-ABEND | 186 | FIL-0081-STMT-000040 | CEE3ABD |
| ERRHANDL | 8040-HANDLE-ABEND | 169 | FIL-0081-STMT-000036 | path to the abend call (line 169 lies in 8040-HANDLE-ABEND, lines 159-171) |

**Related:** Rules: BR-096, BR-097, BR-098 | Gaps: GAP-248, GAP-252 | Diagrams: FLOW-ERRHANDL, COMP-OVERVIEW

**Detected in:** logic_artifact, inventory_artifact, parser_artifact, diagrams_artifact | **Also:** UNRESOLVED_REFERENCE

---

### GAP-160 — UTLMON00: CALL 'ILBOABN0' target is not in the repository
**Type:** UNRESOLVED_CALL | **Program:** UTLMON00 | **Paragraph:** 2000-PROCESS | **Line:** 186 | **Cause:** source | **SME review:** Yes

CALL 'ILBOABN0' USING WS-MINUTE (line 186, STMT-000022, 2000-PROCESS) is a static CALL to a program that is not in the repository or the registry; its effect (return, or ending the run) cannot be traced. WS-MINUTE (PIC 9(2), in WS-TIME) is space-filled by the ACCEPT in 1200-INIT-PROCESSING. Recorded verbatim and flagged for SME review.

**Impact:** Whether the monitor loop ends through this call is unknown; the process flow has a black hole.

**Recommended action:** Determine if ILBOABN0 is in a load library, vendor package, or OS utility (runtime library). Document the interface and expected behaviour.

**Source IDs:** File FIL-0078; Paragraphs FIL-0078-PAR-0006; Statements FIL-0078-STMT-000022

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLMON00 | 2000-PROCESS | 186 | FIL-0078-STMT-000022 | ILBOABN0 |

**Related:** Gaps: GAP-248, GAP-265 | Diagrams: FLOW-UTLMON00, COMP-OVERVIEW

**Detected in:** logic_artifact, inventory_artifact, parser_artifact, diagrams_artifact | **Also:** UNRESOLVED_STATEMENT, UNRESOLVED_REFERENCE

---

## Medium severity gaps

### GAP-161 — The same data names are declared more than once (duplicate names, copybooks expanded twice)
**Type:** AMBIGUOUS_DATA_REFERENCE | **Program:** system-wide | **Cause:** source | **SME review:** Yes

Agent 3 records duplicate declarations that require qualification: DB2RECV declares RECV-CURSOR twice in RECOVERY-REQUEST-AREA (an 88-level under RECV-REQUEST-TYPE, line 35, and a 10-level PIC X(18) under RECV-ERROR-INFO, line 40; both have their own Field IDs); DB2ERR COPY DBTBLS REPLACING renames ERRLOG-RECORD to WS-ERRLOG-REC, the same name as the enclosing 01 (line 19); PORTADD includes COPY PORTFLIO under two FDs (lines 37 and 40), declaring PORT-RECORD twice. In addition four copybooks are expanded twice without REPLACING (CKPRST in FILE and LINKAGE, line 23; ERRHND in ERRHNDL WORKING-STORAGE and LINKAGE, line 35; INQCOM in INQHIST, line 67, and INQONLN, line 37), so their record and field names are declared in both sections.

**Impact:** Unqualified references to these names are ambiguous; Agent 4 and Agent 6 flag RECV-CURSOR (DB2RECV) as AMBIGUOUS and PORT-RECORD used unqualified in PORTADD.

**Recommended action:** Confirm with the development team which declaration each unqualified reference is meant to use.

**Source IDs:** Records FIL-0016-REC-0002, FIL-0009-REC-0001, FIL-0003-REC-0001, FIL-0003-REC-0002, FIL-0019-REC-0001, FIL-0020-REC-0001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2RECV |  |  |  | RECV-CURSOR |
| DB2ERR |  |  |  | WS-ERRLOG-REC |
| PORTADD |  |  |  | PORT-RECORD |
| CKPRST |  |  |  |  |
| ERRHNDL |  |  |  |  |
| INQHIST |  |  |  |  |
| INQONLN |  |  |  |  |

**Related:** Diagrams: FLOW-DB2RECV, SEQ-DB2RECV, FLOW-PORTADD, FLOW-ERRHNDL

**Detected in:** data_artifact, diagrams_artifact | **Also:** 

---

### GAP-162 — DB2ERR: two 01 items named WS-ERRLOG-REC after COPY DBTBLS REPLACING
**Type:** AMBIGUOUS_DATA_REFERENCE | **Program:** DB2ERR | **Paragraph:** 1000-LOG-ERROR | **Line:** 73 | **Cause:** analysis | **SME review:** Yes

After COPY DBTBLS REPLACING ==ERRLOG-RECORD== BY ==WS-ERRLOG-REC== (lines 19-21), two 01 items carry the name WS-ERRLOG-REC: the enclosing 01 at line 18 and the renamed copybook record ERRLOG-RECORD. resolve-field-references returned RESOLVED to the program record SYS-PORTFOLIO-001-FIL-0056-REC-0001 (registry names differ); which item INITIALIZE (line 73) and the host variable :WS-ERRLOG-REC (line 129) address at compile time is flagged for SME review.

**Impact:** Which layout is initialised and inserted into the DB2 error log table is not certain.

**Recommended action:** Confirm with the development team which WS-ERRLOG-REC the compiler binds at lines 73 and 129, and the resulting error-log row layout.

**Source IDs:** File FIL-0056; Paragraphs FIL-0056-PAR-0002, FIL-0056-PAR-0004

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2ERR | 1000-LOG-ERROR | 73 |  | WS-ERRLOG-REC |
| DB2ERR | 1200-INSERT-ERROR | 129 |  | WS-ERRLOG-REC |

**Detected in:** logic_artifact, parser_artifact, data_artifact | **Also:** 

---

### GAP-163 — DB2RECV: RECV-CURSOR matches two declarations, none chosen
**Type:** AMBIGUOUS_DATA_REFERENCE | **Program:** DB2RECV | **Paragraph:** (UNNAMED) | **Line:** 55 | **Cause:** analysis | **SME review:** Yes

RECV-CURSOR (lines 55, 128; paragraphs (UNNAMED) and P300-RECOVER-CURSOR) matches the 88-level condition under RECV-REQUEST-TYPE (line 35) and the PIC X(18) field under RECV-ERROR-INFO (line 40); resolve-field-references returned AMBIGUOUS; target_id null. No candidate is chosen. Agent 3 notes references require qualification.

**Impact:** Whether the cursor-recovery dispatch and the cursor name passed to ERRHNDL use the condition or the field cannot be confirmed statically.

**Recommended action:** Confirm with the development team which RECV-CURSOR each reference addresses (the source as written may not compile without qualification).

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0001, FIL-0061-PAR-0010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2RECV | (UNNAMED) | 55 |  | RECV-CURSOR |
| DB2RECV | P300-RECOVER-CURSOR | 128 |  | RECV-CURSOR |

**Related:** Rules: BR-047, BR-135

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-164 — ERRHNDL: ERR-* names are declared twice (WORKING-STORAGE and COMMAREA)
**Type:** AMBIGUOUS_DATA_REFERENCE | **Program:** ERRHNDL | **Paragraph:** P100-INIT-ERROR-HANDLER | **Line:** 55 | **Cause:** analysis | **SME review:** Yes

COPY ERRHND is expanded twice without REPLACING (under WS-ERROR-AREA, line 16, and under DFHCOMMAREA, line 35), so ERR-* names are declared twice. Unqualified references such as ERR-TIMESTAMP are not unique in COBOL terms; the lookup resolved each to the single copybook Field ID, which identifies the definition but not which of the two storage instances is meant. Agent 4 annotates ERR-TIMESTAMP and ERR-TRACE-ID (line 55) and the 88-level names tested and set at line 116.

**Impact:** Whether the timestamp, trace ID and recovery action are set in the working copy or in the COMMAREA returned to the caller cannot be confirmed statically.

**Recommended action:** Confirm with the development team which storage instance each unqualified ERR-* reference addresses (the source as written may not compile without qualification).

**Source IDs:** File FIL-0062; Paragraphs FIL-0062-PAR-0002, FIL-0062-PAR-0008; Statements FIL-0062-STMT-000007, FIL-0062-STMT-000024

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| ERRHNDL | P100-INIT-ERROR-HANDLER | 55 | FIL-0062-STMT-000007 | ERR-TIMESTAMP, ERR-TRACE-ID |
| ERRHNDL | P400-DETERMINE-ACTION | 116 | FIL-0062-STMT-000024 | 88-level ERR-* condition names |

**Related:** Rules: BR-051, BR-052

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-165 — PORTADD: PORT-RECORD used unqualified while declared under two FDs
**Type:** AMBIGUOUS_DATA_REFERENCE | **Program:** PORTADD | **Paragraph:** 2100-VALIDATE-AND-ADD | **Line:** 125 | **Cause:** source | **SME review:** Yes

COPY PORTFLIO is included under FD PORTFOLIO-FILE (line 37) and FD INPUT-FILE (line 40), which declares two PORT-RECORDs with the same data names. PORT-RECORD and its fields (PORT-ID, PORT-CLIENT-NAME, PORT-STATUS, PORT-CREATE-DATE, PORT-LAST-MAINT) are used without OF PORTFOLIO-FILE / OF INPUT-FILE qualification at lines 105, 114, 122 and 125. The registry holds one copybook record, so the lookups resolve to the single copybook IDs; which file buffer is meant (READ INTO vs WRITE) is recorded as written and flagged for SME review. For WRITE PORT-RECORD (line 125) Agent 4 notes the intent appears to be PORTFOLIO-FILE.

**Impact:** Which file buffer each statement uses is uncertain; field-to-file lineage of the portfolio add may be wrong.

**Recommended action:** Confirm with the development team which file buffer each unqualified PORT-RECORD reference uses and how the program compiles.

**Source IDs:** File FIL-0067; Paragraphs FIL-0067-PAR-0003, FIL-0067-PAR-0004; Statements FIL-0067-STMT-000010, FIL-0067-STMT-000014; Records FIL-0009-REC-0001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTADD | 2000-PROCESS | 105 | FIL-0067-STMT-000010 | READ ... INTO PORT-RECORD |
| PORTADD | 2100-VALIDATE-AND-ADD | 114 |  | PORT-RECORD fields (unqualified) |
| PORTADD | 2100-VALIDATE-AND-ADD | 122 |  | PORT-RECORD fields (unqualified) |
| PORTADD | 2100-VALIDATE-AND-ADD | 125 | FIL-0067-STMT-000014 | WRITE PORT-RECORD |

**Related:** Rules: BR-063

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-166 — TSTGEN00: WS-PORT-STATUS is declared twice; reference is ambiguous
**Type:** AMBIGUOUS_DATA_REFERENCE | **Program:** TSTGEN00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 129 | **Cause:** source | **SME review:** Yes

WS-PORT-STATUS is declared under WS-FILE-STATUS (line 71, PIC XX, FILE STATUS of PORTFOLIO-OUT) and under WS-PORTFOLIO-DATA (line 98, PIC X(1)); the unqualified test at line 129 (STMT-000011, 1100-OPEN-FILES) cannot be matched to one field. resolve-field-references AMBIGUOUS; target_id null; no candidate chosen.

**Impact:** Which status the open check tests is uncertain.

**Recommended action:** Confirm with the development team which WS-PORT-STATUS is meant and how the compiler resolves it.

**Source IDs:** File FIL-0075; Paragraphs FIL-0075-PAR-0003; Statements FIL-0075-STMT-000011

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTGEN00 | 1100-OPEN-FILES | 129 | FIL-0075-STMT-000011 | WS-PORT-STATUS |

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-167 — TSTGEN00: WS-TRAN-STATUS is declared twice; reference is ambiguous
**Type:** AMBIGUOUS_DATA_REFERENCE | **Program:** TSTGEN00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 136 | **Cause:** source | **SME review:** Yes

WS-TRAN-STATUS is declared under WS-FILE-STATUS (line 72, PIC XX, FILE STATUS of TRANSACTION-OUT) and under WS-TRANSACTION-DATA (line 106, PIC X(1)); the unqualified test at line 136 (STMT-000013, 1100-OPEN-FILES) cannot be matched to one field. resolve-field-references AMBIGUOUS; target_id null; no candidate chosen.

**Impact:** Which status the open check tests is uncertain.

**Recommended action:** Confirm with the development team which WS-TRAN-STATUS is meant and how the compiler resolves it.

**Source IDs:** File FIL-0075; Paragraphs FIL-0075-PAR-0003; Statements FIL-0075-STMT-000013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTGEN00 | 1100-OPEN-FILES | 136 | FIL-0075-STMT-000013 | WS-TRAN-STATUS |

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-168 — Visual rendering of the 60 Mermaid diagrams has not been verified
**Type:** DIAGRAM_RENDER_UNVERIFIED | **Program:** system-wide | **Cause:** display | **SME review:** No

All 60 .mmd files passed a structural lint (diagram type after the front matter, quote balance, edge endpoints defined, classDef for every class, subgraph/end balance, sequence participants and blocks, ERD syntax), but no Mermaid renderer or JavaScript runtime was available, so no diagram was rendered. The diagrams use features that need a recent Mermaid (v10+): front-matter title; 'PK, FK' on one ERD attribute (erd.mmd line 36); '<-->' edges (3 component files); two empty ERD entity blocks TSTGEN00_*_RECORD { } (lines 61-65); Unicode symbols inside quoted labels. The audit names the empty ERD blocks, 'PK, FK' and front matter as the most likely render failures.

**Impact:** A diagram embedded in the BRD may fail to display or display differently in the reader's tool; the diagram content itself was checked against the artifacts.

**Recommended action:** Before publishing the BRD, render all 60 files with Mermaid v10+ on a machine that has a renderer; if erd.mmd fails, drop the two empty { } blocks (audit section 9, item 4).

**Related:** Diagrams: ALL-60

**Detected in:** agent6_quality_audit, diagrams_artifact | **Also:** 

---

### GAP-169 — INQHIST: CICS HANDLE CONDITION ERROR transfers to P999-ERROR-ROUTINE at run time
**Type:** RUNTIME_CONDITIONAL_TRANSFER | **Program:** INQHIST | **Paragraph:** P100-INIT-PROGRAM | **Line:** 86 | **Cause:** analysis | **SME review:** Yes

At line 86 (statement STMT-000008) in P100-INIT-PROGRAM, EXEC CICS HANDLE CONDITION ERROR(P999-ERROR-ROUTINE) registers a handler only. If a later CICS command raises ERROR, control transfers to P999-ERROR-ROUTINE (PAR-0012) without a return point; Agent 4 did not trace that transfer as an executed path and no CFG edge or Neo4j relationship exists for it. When entered through the handler, control after P999-EXIT would fall off the end of the procedure division; that run-time path is not traced.

**Impact:** The error-handling flow of INQHIST after a CICS ERROR condition is not part of the documented execution path.

**Recommended action:** Confirm with the development team which CICS commands can raise ERROR in INQHIST and what happens after P999-ERROR-ROUTINE when it is entered through the handler.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0002, FIL-0063-PAR-0012; Statements FIL-0063-STMT-000008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQHIST | P100-INIT-PROGRAM | 86 | FIL-0063-STMT-000008 | ERROR -> P999-ERROR-ROUTINE (SYS-PORTFOLIO-001-FIL-0063-PAR-0012) |

**Related:** Gaps: GAP-255, GAP-256

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-170 — INQONLN: CICS HANDLE CONDITION ERROR/PGMIDERR/NOTFND transfers to P900-ERROR-ROUTINE at run time
**Type:** RUNTIME_CONDITIONAL_TRANSFER | **Program:** INQONLN | **Paragraph:** (UNNAMED) | **Line:** 40 | **Cause:** analysis | **SME review:** Yes

At line 40 (statement STMT-000001, paragraph (UNNAMED)) EXEC CICS HANDLE CONDITION registers P900-ERROR-ROUTINE (PAR-0010) for ERROR, PGMIDERR and NOTFND. CICS commands coded without RESP (ASSIGN, LINK SECMGR, LINK ERRHNDL, ABEND, RETURN) transfer control there without return when they raise these conditions (GO TO-like). Agent 4 records that, entered this way, P900-ERROR-ROUTINE falls through P900-EXIT into P050-SECURITY-CHECK and P050-EXIT, the end of the program, with no EXEC CICS RETURN, and that a condition raised by the LINK to ERRHNDL inside P900 would re-enter P900. No CFG edge or relationship exists for the transfer.

**Impact:** The run-time error path of the main online inquiry handler is not traced; its end-of-task behaviour after a handled condition is uncertain.

**Recommended action:** Confirm with the development team which commands can raise these conditions, and what the task does after P900-ERROR-ROUTINE when entered through the handler (fall-through into P050-SECURITY-CHECK, possible re-entry).

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0001, FIL-0064-PAR-0010; Statements FIL-0064-STMT-000001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQONLN | (UNNAMED) | 40 | FIL-0064-STMT-000001 | ERROR/PGMIDERR/NOTFND -> P900-ERROR-ROUTINE (SYS-PORTFOLIO-001-FIL-0064-PAR-0010) |

**Related:** Rules: BR-056

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-171 — INQPORT: CICS HANDLE CONDITION ERROR and NOTFND transfer control at run time
**Type:** RUNTIME_CONDITIONAL_TRANSFER | **Program:** INQPORT | **Paragraph:** P100-INIT-PROGRAM | **Line:** 62 | **Cause:** analysis | **SME review:** Yes

EXEC CICS HANDLE CONDITION ERROR(P999-ERROR-ROUTINE) NOTFND(P900-NOT-FOUND) (statement STMT-000007, P100-INIT-PROGRAM, lines 61-63) registers two runtime handlers: ERROR to P999-ERROR-ROUTINE (PAR-0010) and NOTFND to P900-NOT-FOUND (PAR-0008). The transfers happen only if the condition is raised at run time and are not traced as executed paths; no CFG edge or Neo4j relationship exists. Agent 2 flagged P999-ERROR-ROUTINE and P999-EXIT as dead-code candidates; Agent 4 dismissed them because the handler makes P999 a runtime target, and states that whether it can fire is not statically determinable (SME review). The HANDLE CONDITION command is not in the CICS translation table and its pseudocode is flagged !! REVIEW.

**Impact:** P999-ERROR-ROUTINE ('Error accessing position data') is reachable only through the CICS ERROR handler; the error path of INQPORT is not part of the traced flow.

**Recommended action:** Confirm with the development team which CICS commands can raise ERROR or NOTFND in INQPORT and the resulting behaviour of the error and not-found routines.

**Source IDs:** File FIL-0065; Paragraphs FIL-0065-PAR-0002, FIL-0065-PAR-0010, FIL-0065-PAR-0011, FIL-0065-PAR-0008; Statements FIL-0065-STMT-000007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQPORT | P100-INIT-PROGRAM | 62 | FIL-0065-STMT-000007 | ERROR -> P999-ERROR-ROUTINE (SYS-PORTFOLIO-001-FIL-0065-PAR-0010) |
| INQPORT | P100-INIT-PROGRAM | 63 | FIL-0065-STMT-000007 | NOTFND -> P900-NOT-FOUND (SYS-PORTFOLIO-001-FIL-0065-PAR-0008) |

**Related:** Gaps: GAP-218

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-172 — AUDPROC: group MOVE overwrites the audit timestamp and misaligns system fields
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** AUDPROC | **Paragraph:** 2000-PROCESS-AUDIT | **Line:** 74 | **Cause:** analysis | **SME review:** Yes

Agent 4 warns (flagged for SME review, ambiguous) that line 74 moves WS-FORMATTED-TIME into AUD-TIMESTAMP, then line 75 moves the 32-byte group LS-SYSTEM-INFO into the 58-byte group AUD-HEADER, which begins with AUD-TIMESTAMP (AUDITLOG lines 8-13). A group MOVE is an alphanumeric move: the 32 bytes fill the start of AUD-HEADER (over the timestamp) and the rest is space-filled, so the timestamp set at line 74 is overwritten and AUD-SYSTEM-ID .. AUD-TERMINAL do not receive the matching LS- fields.

**Impact:** Audit records written by AUDPROC may carry no timestamp and misplaced system, user and terminal values.

**Recommended action:** Confirm with the development team the intended mapping of LS-SYSTEM-INFO into AUD-HEADER and check sample audit records.

**Source IDs:** File FIL-0053; Paragraphs FIL-0053-PAR-0003; Statements FIL-0053-STMT-000009, FIL-0053-STMT-000010; Fields FIL-0005-FLD-000002, FIL-0053-FLD-000001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| AUDPROC | 2000-PROCESS-AUDIT | 74 | FIL-0053-STMT-000009 | AUD-TIMESTAMP |
| AUDPROC | 2000-PROCESS-AUDIT | 75 | FIL-0053-STMT-000010 | AUD-HEADER <- LS-SYSTEM-INFO |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-173 — BCHCTL00: prerequisite flag WS-PREREQ-MET is tested but never set
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** BCHCTL00 | **Paragraph:** 2000-CHECK-PREREQUISITES | **Line:** 93 | **Cause:** source | **SME review:** Yes

In 2000-CHECK-PREREQUISITES, IF PREREQS-SATISFIED (line 93) tests WS-PREREQ-MET, which has no VALUE clause and is not set by any statement present in the source. Agent 4 notes it would presumably be set by the missing paragraphs 2100-READ-CONTROL-RECORD / 2200-CHECK-DEPENDENCIES; the value tested at run time cannot be determined statically.

**Impact:** Whether the CHEK function reports prerequisites as met (return 0) or not met (return 4) cannot be determined from the delivered source.

**Recommended action:** Confirm with the development team where WS-PREREQ-MET is set (expected in the missing paragraphs 2100/2200) and what values it takes before the prerequisite rule is accepted.

**Source IDs:** File FIL-0042; Paragraphs FIL-0042-PAR-0003; Statements FIL-0042-STMT-000010; Fields FIL-0042-FLD-000004

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| BCHCTL00 | 2000-CHECK-PREREQUISITES | 93 | FIL-0042-STMT-000010 | PREREQS-SATISFIED (parent WS-PREREQ-MET) |

**Related:** Rules: BR-002, BR-129 | Gaps: GAP-144

**Detected in:** logic_artifact | **Also:** 

---

### GAP-174 — CKPRST: the four checkpoint paragraphs contain no executable statements
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** CKPRST | **Paragraph:** PROC-INIT | **Line:** 43 | **Cause:** source | **SME review:** Yes

Agent 2 (carried in the Agent 4 trace_issues) records that paragraphs PROC-INIT, PROC-TAKE-CHECKPOINT, PROC-COMMIT-CHECKPOINT and PROC-RESTART contain only a comment line and a separator period, with no executable statements. The EVALUATE TRUE at line 29 has no WHEN OTHER: if no condition is true, no paragraph is performed and the program goes straight to GOBACK.

**Impact:** No checkpoint initialise, take, commit or restart behaviour can be described from the source; the program as delivered performs no checkpoint work.

**Recommended action:** Confirm with the development team whether CKPRST is a stub or whether a complete version exists in another library.

**Source IDs:** File FIL-0043; Paragraphs FIL-0043-PAR-0002, FIL-0043-PAR-0003, FIL-0043-PAR-0004, FIL-0043-PAR-0005

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| CKPRST | PROC-INIT | 43 |  |  |
| CKPRST | PROC-TAKE-CHECKPOINT |  |  |  |
| CKPRST | PROC-COMMIT-CHECKPOINT |  |  |  |
| CKPRST | PROC-RESTART |  |  |  |

**Related:** Rules: BR-003

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-175 — DB2CMT: CALL 'DB2ERR' passes a parameter layout that does not match DB2ERR's interface
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** DB2CMT | **Paragraph:** 9100-LOG-ERROR | **Line:** 169 | **Cause:** analysis | **SME review:** Yes

Agent 4 warns (flagged for SME review, ambiguous) that CALL 'DB2ERR' USING LS-ERROR-INFO (line 169, 9100-LOG-ERROR) passes an 84-byte group (LS-SQLCODE S9(9) COMP + LS-ERROR-MSG X(80)), but DB2ERR's PROCEDURE DIVISION USING LS-ERROR-REQUEST (SYS-PORTFOLIO-001-FIL-0056-REC-0005, 204 bytes) starts with the 4-byte function code LS-FUNCTION. DB2ERR would read the binary SQLCODE bytes as its function code; its logic takes WHEN OTHER for any value other than 'LOG ', 'DIAG', 'RETR'. The effect is not asserted.

**Impact:** DB2 error logging from DB2CMT may not reach DB2ERR's logging function; DB2 commit/rollback errors may go unlogged.

**Recommended action:** Confirm the intended DB2ERR call interface with the development team and check how DB2CMT errors are actually logged.

**Source IDs:** File FIL-0054; Paragraphs FIL-0054-PAR-0010; Statements FIL-0054-STMT-000023; Records FIL-0056-REC-0005

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2CMT | 9100-LOG-ERROR | 169 | FIL-0054-STMT-000023 | DB2ERR |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-176 — DB2HNDL: cursor loop does not end on a persistent FETCH error
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** DB2HNDL | **Paragraph:** 2300-CURSOR-EXAMPLE | **Line:** 165 | **Cause:** source | **SME review:** Yes

The cursor loop (line 165, STMT-000022, 2300-CURSOR-EXAMPLE; termination_pattern FILE_EXHAUSTION_LOOP) ends only when SQLCODE = +100, set by the FETCH at line 166. The condition is first tested with the SQLCODE left by OPEN PORTFOLIO_CURSOR. A negative SQLCODE from FETCH is not checked inside the loop (9000-CHECK-SQL-STATUS is not performed in 2300), so a persistent FETCH error would repeat the loop without ending it.

**Impact:** A DB2 FETCH error could make the program loop indefinitely.

**Recommended action:** Review the loop termination field — confirm it is always set within the loop body, and add or confirm SQLCODE error checks inside the loop.

**Source IDs:** File FIL-0080; Paragraphs FIL-0080-PAR-0006; Statements FIL-0080-STMT-000022, FIL-0080-STMT-000032

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2HNDL | 2300-CURSOR-EXAMPLE | 165 | FIL-0080-STMT-000022 | PERFORM UNTIL SQLCODE = +100 |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-177 — DB2ONLN: active-connection counter has no visible mechanism to persist across CICS tasks
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** DB2ONLN | **Paragraph:** P100-PROCESS-CONNECT | **Line:** 55 | **Cause:** analysis | **SME review:** Yes

At line 55 (P100-PROCESS-CONNECT) the connection limit check uses WS-ACTIVE-CONNECTIONS (VALUE 0, line 20) against WS-MAX-CONNECTIONS (VALUE 100, line 22). Agent 4 notes both are WORKING-STORAGE items and the source shows no mechanism that keeps the counter across CICS tasks.

**Impact:** The 'Maximum connections reached' limit may not work as described if the counter does not persist between tasks.

**Recommended action:** Confirm with the CICS/DB2 team how the active-connection count is meant to be shared across tasks.

**Source IDs:** File FIL-0060; Paragraphs FIL-0060-PAR-0002; Statements FIL-0060-STMT-000003

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2ONLN | P100-PROCESS-CONNECT | 55 | FIL-0060-STMT-000003 | WS-ACTIVE-CONNECTIONS |

**Related:** Rules: BR-046

**Detected in:** logic_artifact | **Also:** 

---

### GAP-178 — DB2ONLN: connection token STRING uses the same item as sender and receiver
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** DB2ONLN | **Paragraph:** P120-GENERATE-TOKEN | **Line:** 85 | **Cause:** analysis | **SME review:** Yes

STRING DB2-CONNECTION-TOKEN ... INTO DB2-CONNECTION-TOKEN (lines 85-87, P120-GENERATE-TOKEN) uses the same item as sender and receiver. The pseudocode notes: the receiving field is also the first sending field and is already full, so the appended counter cannot fit; the result of an overlapping STRING is ambiguous. WS-ACTIVE-CONNECTIONS is PIC S9(8) COMP (binary).

**Impact:** The connection token returned to callers may not contain the connection counter as intended.

**Recommended action:** Confirm the intended token format with the development team and check sample tokens.

**Source IDs:** File FIL-0060; Paragraphs FIL-0060-PAR-0006; Statements FIL-0060-STMT-000009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2ONLN | P120-GENERATE-TOKEN | 85 | FIL-0060-STMT-000009 | DB2-CONNECTION-TOKEN |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-179 — DB2ONLN: status request overwrites its own response code with the connection count
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** DB2ONLN | **Paragraph:** P300-CHECK-STATUS | **Cause:** analysis | **SME review:** Yes

In P300-CHECK-STATUS the response code is set to 0 or -1 from SQLCODE, then 'SET db2_response_code = ws_active_connections -- unconditionally overwrites the 0 / -1 result set just above' (statement STMT-000016). The narrative states that the status request sets the response code from SQLCODE but then unconditionally overwrites it with the active-connection count.

**Impact:** Callers of the status function cannot tell from the response code whether the DB2 status check failed.

**Recommended action:** Confirm with the development team whether the status response code is meant to carry the connection count.

**Source IDs:** File FIL-0060; Paragraphs FIL-0060-PAR-0010; Statements FIL-0060-STMT-000016

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2ONLN | P300-CHECK-STATUS |  | FIL-0060-STMT-000016 | DB2-RESPONSE-CODE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-180 — DB2STAT: a successful initial insert resets the error return code after a table-creation error
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** DB2STAT | **Paragraph:** 1000-INITIALIZE | **Line:** 85 | **Cause:** analysis | **SME review:** Yes

1000-INITIALIZE performs 1200-INSERT-INITIAL unconditionally (line 85); after a table-creation error (return code 12 set in 9000-ERROR-ROUTINE) a successful insert resets LS-RETURN-CODE to 0.

**Impact:** A caller may be told initialisation succeeded although creation of the statistics table failed.

**Recommended action:** Confirm with the development team whether a table-creation failure should be reported to the caller.

**Source IDs:** File FIL-0057; Paragraphs FIL-0057-PAR-0002; Statements FIL-0057-STMT-000009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2STAT | 1000-INITIALIZE | 85 | FIL-0057-STMT-000009 | LS-RETURN-CODE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-181 — ERRHNDL: message STRING uses ERR-MESSAGE as both sender and receiver
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** ERRHNDL | **Paragraph:** P300-FORMAT-MESSAGE | **Line:** 93 | **Cause:** analysis | **SME review:** Yes

STRING ... ERR-MESSAGE ... INTO ERR-MESSAGE (lines 93-100, P300-FORMAT-MESSAGE) uses the same item as sender and receiver. The pseudocode notes: ERR-MESSAGE is both a sender and the receiver (PIC X(80)); with no ON OVERFLOW clause the text is cut at 80 characters, and the overlapping STRING result is ambiguous.

**Impact:** The formatted error message 'Error in <program> - <message> (<trace id>)' returned to callers may be truncated or garbled.

**Recommended action:** Confirm the intended message format with the development team and check sample ERRLOG rows and returned messages.

**Source IDs:** File FIL-0062; Paragraphs FIL-0062-PAR-0006; Statements FIL-0062-STMT-000021

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| ERRHNDL | P300-FORMAT-MESSAGE | 93 | FIL-0062-STMT-000021 | ERR-MESSAGE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-182 — ERRPROC: a failed OPEN of ERROR-LOG does not stop the WRITE
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** ERRPROC | **Paragraph:** 1000-INITIALIZE | **Line:** 60 | **Cause:** analysis | **SME review:** Yes

When OPEN EXTEND ERROR-LOG fails (IF at line 60, 1000-INITIALIZE), the program only displays the status; 2000-PROCESS-ERROR still runs and WRITE ERROR-LOG-RECORD is attempted on an unopened file. The narrative adds that a non-'00' file status after OPEN or after WRITE is only displayed; processing is not stopped.

**Impact:** Errors reported by callers may not be written to the error log while the caller is still told the requested severity.

**Recommended action:** Confirm with the development team whether a failed open of the error log must stop processing or set a distinct return code.

**Source IDs:** File FIL-0058; Paragraphs FIL-0058-PAR-0002, FIL-0058-PAR-0003; Statements FIL-0058-STMT-000008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| ERRPROC | 1000-INITIALIZE | 60 | FIL-0058-STMT-000008 | ERROR-LOG |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-183 — HISTLD00: the error routine returns to its caller, so failures do not end the run
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** HISTLD00 | **Paragraph:** 9000-ERROR-ROUTINE | **Line:** 228 | **Cause:** analysis | **SME review:** Yes

Agent 4 warns that 9000-ERROR-ROUTINE calls ERRPROC and issues ROLLBACK WORK but returns to its caller; open failures (lines 104-113), a missing control record (line 125) and checkpoint rewrite failures (line 196) do not end the run. After READ INVALID KEY in 1300-INIT-CHECKPOINTS the REWRITE at line 131 is still executed and its status is not checked.

**Impact:** After an open failure, missing control record or failed checkpoint rewrite, processing continues; the outcome of the run in those cases is not what an error stop would give.

**Recommended action:** Confirm with the development team whether 9000-ERROR-ROUTINE is intended to stop the run, and whether the REWRITE after INVALID KEY at line 131 is intended.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0016, FIL-0044-PAR-0005, FIL-0044-PAR-0007, FIL-0044-PAR-0011; Statements FIL-0044-STMT-000055

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 9000-ERROR-ROUTINE |  | FIL-0044-STMT-000055 |  |
| HISTLD00 | 1100-OPEN-FILES | 104 |  |  |
| HISTLD00 | 1300-INIT-CHECKPOINTS | 131 |  |  |
| HISTLD00 | 2310-UPDATE-CHECKPOINT | 196 |  |  |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-184 — INQPORT: SEND MAP response is stored but never tested
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** INQPORT | **Paragraph:** P300-FORMAT-DISPLAY | **Line:** 87 | **Cause:** source | **SME review:** Yes

EXEC CICS SEND MAP at line 87 (statement STMT-000013, P300-FORMAT-DISPLAY) stores RESP in WS-RESPONSE-CODE but the value is not tested afterwards.

**Impact:** A failure to display the position map would go unnoticed by the program.

**Recommended action:** Confirm with the development team whether the unchecked response is intended.

**Source IDs:** File FIL-0065; Paragraphs FIL-0065-PAR-0006; Statements FIL-0065-STMT-000013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQPORT | P300-FORMAT-DISPLAY | 87 | FIL-0065-STMT-000013 | WS-RESPONSE-CODE (RESP of SEND MAP) |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-185 — PORTADD: read loop may not end after a file open failure
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTADD | **Paragraph:** 0000-MAIN | **Line:** 79 | **Cause:** source | **SME review:** Yes

PERFORM 2000-PROCESS UNTIL END-OF-FILE (line 79, STMT-000002, 0000-MAIN; termination_pattern FILE_EXHAUSTION_LOOP). END-OF-FILE is set only on READ AT END (line 107). If the files failed to open, 1000-INITIALIZE performs 3000-TERMINATE (closing the files) and returns; 0000-MAIN then enters the read loop on a closed file, where neither AT END nor NOT AT END fires, so termination on that path cannot be confirmed statically. On that path 3000-TERMINATE also runs twice (lines 100 and 82) and WS-RETURN-CODE stays 8.

**Impact:** On an open failure the batch step may loop instead of ending with an error.

**Recommended action:** Review the loop termination field — confirm it is always set within the loop body, and confirm the intended behaviour after an open failure.

**Source IDs:** File FIL-0067; Paragraphs FIL-0067-PAR-0001, FIL-0067-PAR-0002; Statements FIL-0067-STMT-000002; Fields FIL-0067-FLD-000012

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTADD | 0000-MAIN | 79 | FIL-0067-STMT-000002 | PERFORM 2000-PROCESS UNTIL END-OF-FILE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-186 — PORTDEL: read loop may not end after a file open failure
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTDEL | **Paragraph:** 0000-MAIN | **Line:** 104 | **Cause:** source | **SME review:** Yes

PERFORM 2000-PROCESS UNTIL END-OF-FILE (line 104, STMT-000002, 0000-MAIN; FILE_EXHAUSTION_LOOP). END-OF-FILE is set only on READ DELETE-FILE AT END (line 133). If any file failed to open, 1000-INITIALIZE performs 3000-TERMINATE and returns; 0000-MAIN then enters the read loop on a closed file, where neither AT END nor NOT AT END fires, so termination on that path cannot be confirmed statically. 3000-TERMINATE runs twice on that path (lines 126 and 107).

**Impact:** On an open failure the delete batch may loop instead of ending with an error.

**Recommended action:** Review the loop termination field — confirm it is always set within the loop body, and confirm the intended behaviour after an open failure.

**Source IDs:** File FIL-0068; Paragraphs FIL-0068-PAR-0001, FIL-0068-PAR-0002; Statements FIL-0068-STMT-000002; Fields FIL-0068-FLD-000028

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTDEL | 0000-MAIN | 104 | FIL-0068-STMT-000002 | PERFORM 2000-PROCESS UNTIL END-OF-FILE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-187 — PORTMSTR: CLOSE issued on a file that failed to open
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTMSTR | **Paragraph:** 1000-INITIALIZE | **Line:** 109 | **Cause:** source | **SME review:** Yes

If OPEN I-O PORTFOLIO-FILE fails (line 109, STMT-000065, 1000-INITIALIZE), 9000-ERROR performs 6000-TERMINATE, which issues CLOSE PORTFOLIO-FILE on a file that did not open; the CLOSE status is not checked. Agent 4 also notes that 9000-ERROR (PAR-0009) is reached only by PERFORM and ends with GOBACK, so control never returns to the statement after PERFORM 9000-ERROR.

**Impact:** Error-path behaviour after an open failure depends on run-time handling of the CLOSE.

**Recommended action:** Confirm with the development team the intended error handling after an open failure.

**Source IDs:** File FIL-0069; Paragraphs FIL-0069-PAR-0002, FIL-0069-PAR-0009; Statements FIL-0069-STMT-000065, FIL-0069-STMT-000037

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTMSTR | 1000-INITIALIZE | 109 | FIL-0069-STMT-000065 | OPEN I-O PORTFOLIO-FILE failure path |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-188 — PORTREAD: read loop may not end after a file open failure
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTREAD | **Paragraph:** 0000-MAIN | **Line:** 67 | **Cause:** source | **SME review:** Yes

PERFORM 2000-PROCESS UNTIL END-OF-FILE (line 67, STMT-000002, 0000-MAIN; FILE_EXHAUSTION_LOOP). END-OF-FILE is set only on READ AT END (line 88). If the file failed to open, 1000-INITIALIZE performs 3000-TERMINATE and returns; 0000-MAIN then enters the read loop on a closed file, where neither AT END nor NOT AT END fires; termination on that path cannot be confirmed statically. 3000-TERMINATE runs twice on that path (lines 81 and 70).

**Impact:** On an open failure the read batch may loop instead of ending with an error.

**Recommended action:** Review the loop termination field — confirm it is always set within the loop body, and confirm the intended behaviour after an open failure.

**Source IDs:** File FIL-0070; Paragraphs FIL-0070-PAR-0001; Statements FIL-0070-STMT-000002; Fields FIL-0070-FLD-000009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTREAD | 0000-MAIN | 67 | FIL-0070-STMT-000002 | PERFORM 2000-PROCESS UNTIL END-OF-FILE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-189 — PORTTEST: generated PORT-ID is truncated and may repeat
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTTEST | **Paragraph:** 2100-GENERATE-KEY | **Line:** 83 | **Cause:** source | **SME review:** Yes

STRING 'PORT' WS-RECORD-COUNT (4 + 5 characters) INTO PORT-ID (PIC X(8)) at line 83 (STMT-000015, 2100-GENERATE-KEY) has no ON OVERFLOW clause; only the first 8 characters fit ('PORT' + first 4 digits of the count). Agent 4 notes generated IDs may repeat (info-level note).

**Impact:** Test records may be generated with duplicate keys.

**Recommended action:** Confirm with the development team whether duplicate generated IDs are acceptable for the test file.

**Source IDs:** File FIL-0071; Paragraphs FIL-0071-PAR-0004; Statements FIL-0071-STMT-000015

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTTEST | 2100-GENERATE-KEY | 83 | FIL-0071-STMT-000015 | STRING ... INTO PORT-ID |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-190 — PORTTEST: generation loop does not end if writes keep failing
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTTEST | **Paragraph:** 0000-MAIN | **Line:** 48 | **Cause:** source | **SME review:** Yes

PERFORM 2000-GENERATE-RECORDS UNTIL WS-RECORD-COUNT >= WS-MAX-RECORDS (line 48, STMT-000002, 0000-MAIN; termination_pattern CONDITIONAL_TERMINATION_LOOP). WS-RECORD-COUNT is incremented only when WRITE returns status '00' (line 76). If writes keep failing, the count never reaches WS-MAX-RECORDS (100) and the loop does not terminate.

**Impact:** A persistent write error makes the test-data generator loop indefinitely.

**Recommended action:** Review the loop termination field — confirm it is always set within the loop body, or that a write failure stops the run.

**Source IDs:** File FIL-0071; Paragraphs FIL-0071-PAR-0001, FIL-0071-PAR-0003; Statements FIL-0071-STMT-000002; Fields FIL-0071-FLD-000002, FIL-0071-FLD-000003

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTTEST | 0000-MAIN | 48 | FIL-0071-STMT-000002 | PERFORM 2000-GENERATE-RECORDS UNTIL WS-RECORD-COUNT >= WS-MAX-RECORDS |

**Related:** Rules: BR-070

**Detected in:** logic_artifact | **Also:** 

---

### GAP-191 — PORTTEST: RANDOM subscript is always 0, client-type reference modification starts outside the field
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTTEST | **Paragraph:** 2100-GENERATE-KEY | **Line:** 87 | **Cause:** source | **SME review:** Yes

MOVE FUNCTION RANDOM(WS-RECORD-COUNT) TO WS-TYPE-SUB (line 87, STMT-000016, 2100-GENERATE-KEY): RANDOM returns a value in [0, 1) and WS-TYPE-SUB is PIC 9(1), so the integer part moved is 0; WS-CLIENT-TYPES(WS-TYPE-SUB:1) at line 96 (STMT-000019, 2200-GENERATE-CLIENT-INFO) then uses reference-modification start 0, outside the field. Runtime result depends on compiler bounds checking; recorded verbatim.

**Impact:** Generated test records may all get the same or an invalid client type.

**Recommended action:** Confirm with the development team the intended client-type selection and the compiler's bounds-checking behaviour.

**Source IDs:** File FIL-0071; Paragraphs FIL-0071-PAR-0004, FIL-0071-PAR-0005; Statements FIL-0071-STMT-000016, FIL-0071-STMT-000019

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTTEST | 2100-GENERATE-KEY | 87 | FIL-0071-STMT-000016 | MOVE FUNCTION RANDOM(WS-RECORD-COUNT) TO WS-TYPE-SUB |
| PORTTEST | 2200-GENERATE-CLIENT-INFO | 96 | FIL-0071-STMT-000019 | WS-CLIENT-TYPES(WS-TYPE-SUB:1) |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-192 — PORTUPDT: unknown action code still rewrites and counts as an update
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTUPDT | **Paragraph:** 2200-APPLY-UPDATE | **Line:** 132 | **Cause:** source | **SME review:** Yes

EVALUATE TRUE at line 132 (STMT-000013, 2200-APPLY-UPDATE) has no WHEN OTHER: an update record with an action code other than 'S', 'N' or 'V' changes no field, but REWRITE PORT-RECORD still runs and counts as an update when it succeeds (Agent 4 info note).

**Impact:** Invalid update requests are reported as successful updates.

**Recommended action:** Confirm with the business owner whether unknown action codes should be rejected and not counted.

**Source IDs:** File FIL-0073; Paragraphs FIL-0073-PAR-0005; Statements FIL-0073-STMT-000013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTUPDT | 2200-APPLY-UPDATE | 132 | FIL-0073-STMT-000013 | EVALUATE TRUE (action code) |

**Related:** Rules: BR-082

**Detected in:** logic_artifact | **Also:** 

---

### GAP-193 — PORTUPDT: update loop may not end after a file open failure
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTUPDT | **Paragraph:** 1000-INITIALIZE | **Line:** 105 | **Cause:** source | **SME review:** Yes

When an OPEN fails, 1000-INITIALIZE (line 105, STMT-000022) performs 3000-TERMINATE (closing the files) but neither stops the run nor sets END-OF-FILE. 0000-MAIN then enters PERFORM 2000-PROCESS UNTIL END-OF-FILE (line 86, STMT-000002; FILE_EXHAUSTION_LOOP); a READ on a file that is not open fails with a non-end-of-file status, so neither AT END nor NOT AT END runs and END-OF-FILE is never set. As written the loop may not terminate (recorded for SME review). 3000-TERMINATE is also performed twice on that path (lines 105 and 89).

**Impact:** On an open failure the update batch may loop instead of ending with an error.

**Recommended action:** Review the loop termination field — confirm it is always set within the loop body, and confirm the intended behaviour after an open failure.

**Source IDs:** File FIL-0073; Paragraphs FIL-0073-PAR-0002, FIL-0073-PAR-0001; Statements FIL-0073-STMT-000022, FIL-0073-STMT-000002, FIL-0073-STMT-000003; Fields FIL-0073-FLD-000020

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTUPDT | 1000-INITIALIZE | 105 | FIL-0073-STMT-000022 | PERFORM 3000-TERMINATE on open failure |
| PORTUPDT | 0000-MAIN | 86 | FIL-0073-STMT-000002 | PERFORM 2000-PROCESS UNTIL END-OF-FILE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-194 — PORTVALD: account NUMERIC test covers 50 characters, comment says 10 digits
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTVALD | **Paragraph:** 2000-VALIDATE-ACCOUNT | **Line:** 77 | **Cause:** source | **SME review:** Yes

In 2000-VALIDATE-ACCOUNT (line 77, STMT-000009) the comment says 10 digits, but the NUMERIC test applies to all 50 characters of LS-INPUT-VALUE PIC X(50): a value passes only if all 50 positions are digits. Whether callers pass a 50-digit value cannot be determined from this program (annotation marked ambiguous, not a trace warning).

**Impact:** A 10-digit account number padded with spaces would fail validation.

**Recommended action:** Confirm with the development team the account-number length passed by callers.

**Source IDs:** File FIL-0074; Paragraphs FIL-0074-PAR-0003; Statements FIL-0074-STMT-000009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTVALD | 2000-VALIDATE-ACCOUNT | 77 | FIL-0074-STMT-000009 | LS-INPUT-VALUE NUMERIC test |

**Related:** Rules: BR-086

**Detected in:** logic_artifact | **Also:** 

---

### GAP-195 — PORTVALD: amount range check can never fail as written
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTVALD | **Paragraph:** 4000-VALIDATE-AMOUNT | **Line:** 111 | **Cause:** source | **SME review:** Yes

VAL-TEMP-NUM is PIC S9(13)V99, whose value range is exactly VAL-MIN-AMOUNT (-9999999999999.99) to VAL-MAX-AMOUNT (+9999999999999.99); the out-of-range test (line 111, STMT-000016, 4000-VALIDATE-AMOUNT) can never be true, so 4000-VALIDATE-AMOUNT always returns VAL-SUCCESS. Recorded as written for SME review.

**Impact:** The amount limit check has no effect.

**Recommended action:** Confirm with the business owner the intended amount limits.

**Source IDs:** File FIL-0074; Paragraphs FIL-0074-PAR-0005; Statements FIL-0074-STMT-000016; Fields FIL-0010-FLD-000014, FIL-0010-FLD-000010, FIL-0010-FLD-000011

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTVALD | 4000-VALIDATE-AMOUNT | 111 | FIL-0074-STMT-000016 |  |
| PORTVALD | 4000-VALIDATE-AMOUNT | 111 | FIL-0074-STMT-000016 | VAL-TEMP-NUM range test |

**Related:** Rules: BR-088

**Detected in:** rules_artifact, logic_artifact | **Also:** 

---

### GAP-196 — PORTVALD: ID validation can never succeed as written
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PORTVALD | **Paragraph:** 1000-VALIDATE-ID | **Line:** 63 | **Cause:** source | **SME review:** Yes

Line 62 moves 4 characters (LS-INPUT-VALUE(5:4)) into VAL-NUMERIC-CHECK PIC X(10), padding the remaining 6 positions with spaces; the NUMERIC class test on the whole X(10) field (line 63, STMT-000006, 1000-VALIDATE-ID) is then false for any input, so IS NOT NUMERIC is always true and 1000-VALIDATE-ID can never return VAL-SUCCESS. Recorded as written for SME review.

**Impact:** Every portfolio ID is rejected by this validation as written.

**Recommended action:** Confirm with the development team the intended ID format check.

**Source IDs:** File FIL-0074; Paragraphs FIL-0074-PAR-0002; Statements FIL-0074-STMT-000006; Fields FIL-0010-FLD-000013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTVALD | 1000-VALIDATE-ID | 63 | FIL-0074-STMT-000006 |  |
| PORTVALD | 1000-VALIDATE-ID | 63 | FIL-0074-STMT-000006 | IF VAL-NUMERIC-CHECK IS NOT NUMERIC |

**Related:** Rules: BR-067, BR-084, BR-085

**Detected in:** rules_artifact, logic_artifact | **Also:** 

---

### GAP-197 — PRCSEQ00: process table index is not checked against the OCCURS 100 limit
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PRCSEQ00 | **Paragraph:** 1210-ADD-TO-SEQUENCE | **Line:** 185 | **Cause:** analysis | **SME review:** Yes

In 1210-ADD-TO-SEQUENCE, WS-PROC-IX is incremented once per matching sequence record (line 185) without a check against the OCCURS 100 limit of WS-PROC-ENTRY.

**Impact:** If more than 100 matching sequence records are read, entries would be stored beyond the table; the resulting behaviour is not described by the artifacts.

**Recommended action:** Confirm with the development team the maximum number of processes per sequence and whether a bound check is required.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0009; Statements FIL-0046-STMT-000031; Fields FIL-0046-FLD-000008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PRCSEQ00 | 1210-ADD-TO-SEQUENCE | 185 | FIL-0046-STMT-000031 | WS-PROC-IX (index of WS-PROC-ENTRY) |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-198 — PRCSEQ00: sequence read loop repeats if a READ fails with a status other than end of file
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** PRCSEQ00 | **Paragraph:** 1200-BUILD-SEQUENCE | **Line:** 168 | **Cause:** analysis | **SME review:** Yes

The read loop in 1200-BUILD-SEQUENCE (PERFORM UNTIL WS-PSR-STATUS = '10', line 168) ends only when WS-PSR-STATUS = '10' (set by the AT END branch at line 171 or by the READ itself). Agent 4 notes that a READ that fails with another status takes neither AT END nor NOT AT END, so the loop would repeat; no other status is tested inside the loop.

**Impact:** On a read error other than end of file the sequence build may not end.

**Recommended action:** Review the loop termination field: confirm whether a non-'10' READ failure can occur and whether it should end the loop or route to the error routine.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0008; Statements FIL-0046-STMT-000026; Fields FIL-0046-FLD-000001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PRCSEQ00 | 1200-BUILD-SEQUENCE | 168 | FIL-0046-STMT-000026 | WS-PSR-STATUS |

**Related:** Rules: BR-008

**Detected in:** logic_artifact | **Also:** 

---

### GAP-199 — RCVPRC00: recovery scan loops re-read and rewrite the file they are scanning
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** RCVPRC00 | **Paragraph:** 2200-RECOVER-SEQUENCE | **Line:** 251 | **Cause:** analysis | **SME review:** Yes

Agent 4 warns (!! REVIEW) that both READ NEXT loops on BATCH-CONTROL-FILE (2200-RECOVER-SEQUENCE line 251, 2300-RECOVER-ALL line 272) perform 2100-RECOVER-PROCESS, which issues a keyed READ (line 163) and a REWRITE (lines 210/222/234) on the same file. These statements also set WS-BCT-STATUS (the loop condition field) and, with ACCESS MODE DYNAMIC, the keyed READ changes the position used by the next READ NEXT; loop progress and termination therefore depend on the keys read inside 2100. In addition each loop ends only when WS-BCT-STATUS = '10'; a READ NEXT failing with another status takes neither AT END nor NOT AT END and the loop repeats.

**Impact:** Sequence and all-process recovery may skip, repeat or never finish scanning control records, depending on the keys read; which records are recovered is not certain from static analysis.

**Recommended action:** Review the loop termination field WS-BCT-STATUS and the file positioning with the development team; confirm that the keyed READ/REWRITE inside 2100-RECOVER-PROCESS does not disturb the READ NEXT scan.

**Source IDs:** File FIL-0047; Paragraphs FIL-0047-PAR-0015, FIL-0047-PAR-0016, FIL-0047-PAR-0009; Statements FIL-0047-STMT-000046, FIL-0047-STMT-000049, FIL-0047-STMT-000023, FIL-0047-STMT-000034, FIL-0047-STMT-000038, FIL-0047-STMT-000042; Fields FIL-0047-FLD-000001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RCVPRC00 | 2200-RECOVER-SEQUENCE | 251 | FIL-0047-STMT-000046 | WS-BCT-STATUS |
| RCVPRC00 | 2300-RECOVER-ALL | 272 | FIL-0047-STMT-000049 | WS-BCT-STATUS |
| RCVPRC00 | 2100-RECOVER-PROCESS | 163 |  | keyed READ on BATCH-CONTROL-FILE |

**Related:** Rules: BR-028

**Detected in:** logic_artifact | **Also:** 

---

### GAP-200 — RPTPOS00: possible divide by zero in the position change calculation
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** RPTPOS00 | **Paragraph:** 2110-FORMAT-POSITION | **Line:** 138 | **Cause:** analysis | **SME review:** Yes

Agent 4 warns that the COMPUTE at line 138 (2110-FORMAT-POSITION) divides by POS-PREVIOUS-VALUE with no ON SIZE ERROR clause and no zero test; recorded as written.

**Impact:** A position with a zero previous value would make the change-percentage calculation fail or give an undefined result.

**Recommended action:** Confirm with the development team how a zero previous value should be reported and whether a zero test is required.

**Source IDs:** File FIL-0049; Paragraphs FIL-0049-PAR-0007; Statements FIL-0049-STMT-000026

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 | 2110-FORMAT-POSITION | 138 | FIL-0049-STMT-000026 | POS-PREVIOUS-VALUE |

**Related:** Gaps: GAP-131

**Detected in:** logic_artifact | **Also:** 

---

### GAP-201 — RPTPOS00: READ POSITION-MASTER status is not checked
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** RPTPOS00 | **Paragraph:** 2100-READ-POSITIONS | **Line:** 122 | **Cause:** analysis | **SME review:** Yes

READ POSITION-MASTER (lines 122, 128) has only AT END handling; WS-POSITION-STATUS is not tested after the READs, so I/O errors other than end of file are not handled in the source.

**Impact:** A read error on the position master is not detected; the report's behaviour in that case is not described.

**Recommended action:** Confirm with the development team whether read errors on POSITION-MASTER need handling.

**Source IDs:** File FIL-0049; Paragraphs FIL-0049-PAR-0006

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 | 2100-READ-POSITIONS | 122 |  | WS-POSITION-STATUS |
| RPTPOS00 | 2100-READ-POSITIONS | 128 |  | WS-POSITION-STATUS |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-202 — RPTSTA00: READ status of DB2-STATS and BATCH-STATS is not checked
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** RPTSTA00 | **Paragraph:** 2100-PROCESS-DB2-STATS | **Line:** 145 | **Cause:** analysis | **SME review:** Yes

READs of DB2-STATS and BATCH-STATS (lines 145, 151, 157, 163) have only AT END handling; the file status fields are not tested after the READs.

**Impact:** Read errors on the statistics files are not detected; the report's behaviour in that case is not described.

**Recommended action:** Confirm with the development team whether read errors on the statistics files need handling.

**Source IDs:** File FIL-0050; Paragraphs FIL-0050-PAR-0007, FIL-0050-PAR-0008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 | 2100-PROCESS-DB2-STATS | 145 |  | READ DB2-STATS |
| RPTSTA00 | 2100-PROCESS-DB2-STATS | 151 |  | READ DB2-STATS |
| RPTSTA00 | 2200-PROCESS-BATCH-STATS | 157 |  | READ BATCH-STATS |
| RPTSTA00 | 2200-PROCESS-BATCH-STATS | 163 |  | READ BATCH-STATS |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-203 — RTNANA00: detail FETCH loop has no exit for SQL errors
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** RTNANA00 | **Paragraph:** P200-PROCESS-ANALYSIS | **Line:** 144 | **Cause:** analysis | **SME review:** Yes

Agent 4 warns that the detail loop (PERFORM P220-PROCESS-DETAIL THRU P220-EXIT UNTIL SQLCODE = 100, line 144, in P200-PROCESS-ANALYSIS) ends only when SQLCODE = 100 (no more rows). Any other non-zero SQLCODE from the FETCH skips the IF SQLCODE = 0 branch and the loop repeats the FETCH; there is no exit for SQL errors in the source. SQLCODE is also not checked after DECLARE, OPEN or CLOSE of cursor PRGCUR (lines 126, 139, 148); a negative SQLCODE after OPEN would reach the FETCH loop. The loop's termination_pattern is EXTERNAL_TERMINATION_LOOP (not POTENTIAL_INFINITE_LOOP).

**Impact:** On a DB2 error during the return-analysis fetch the program may loop without ending.

**Recommended action:** Review the loop termination field SQLCODE: confirm with the development team whether SQL errors can occur on the FETCH and how they should end the loop.

**Source IDs:** File FIL-0051; Paragraphs FIL-0051-PAR-0004, FIL-0051-PAR-0008, FIL-0051-PAR-0009; Statements FIL-0051-STMT-000014, FIL-0051-STMT-000026

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RTNANA00 | P200-PROCESS-ANALYSIS | 144 | FIL-0051-STMT-000014 | SQLCODE |

**Related:** Gaps: GAP-311

**Detected in:** logic_artifact | **Also:** 

---

### GAP-204 — SECMGR: request-type EVALUATE has no WHEN OTHER
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** SECMGR | **Paragraph:** (UNNAMED) | **Line:** 42 | **Cause:** source | **SME review:** Yes

EVALUATE TRUE at line 42 (statement STMT-000001, paragraph (UNNAMED)) has no WHEN OTHER: a request type other than V/A/L performs nothing and returns with SEC-RESPONSE-CODE and SEC-ERROR-INFO unchanged (Agent 4 info note).

**Impact:** An unknown security request type returns whatever response code the caller passed in; callers may treat it as success.

**Recommended action:** Confirm with the development team whether callers initialise SEC-RESPONSE-CODE and whether an invalid request type should be rejected.

**Source IDs:** File FIL-0066; Paragraphs FIL-0066-PAR-0001; Statements FIL-0066-STMT-000001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| SECMGR | (UNNAMED) | 42 | FIL-0066-STMT-000001 | EVALUATE TRUE (request type) |

**Related:** Rules: BR-060

**Detected in:** logic_artifact | **Also:** 

---

### GAP-205 — TSTGEN00: processing continues after a failed OPEN; seed READ unchecked
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** TSTGEN00 | **Paragraph:** 9999-ERROR-HANDLER | **Line:** 213 | **Cause:** source | **SME review:** Yes

9999-ERROR-HANDLER (line 213, STMT-000030) ends the program (RETURN-CODE 12, GOBACK) only when WS-ERROR-COUNT > 100; otherwise control returns to the performing statement and processing continues, including after a failed OPEN. Separately, READ RANDOM-SEED (line 150, STMT-000016, 1200-INIT-RANDOM) has no AT END clause and WS-RAND-STATUS is not tested after it; SEED-RECORD is moved to WS-RANDOM-SEED regardless. Both are Agent 4 info-level notes.

**Impact:** The generator may run on unopened files or an unread seed.

**Recommended action:** Confirm with the development team whether an open failure or a missing seed record should stop the run.

**Source IDs:** File FIL-0075; Paragraphs FIL-0075-PAR-0013, FIL-0075-PAR-0004; Statements FIL-0075-STMT-000030, FIL-0075-STMT-000016

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTGEN00 | 9999-ERROR-HANDLER | 213 | FIL-0075-STMT-000030 | error handler returns unless WS-ERROR-COUNT > 100 |
| TSTGEN00 | 1200-INIT-RANDOM | 150 | FIL-0075-STMT-000016 | READ RANDOM-SEED without status check |

**Related:** Rules: BR-090

**Detected in:** logic_artifact | **Also:** 

---

### GAP-206 — TSTVAL00: possible divide by zero in success-rate calculation
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** TSTVAL00 | **Paragraph:** 2900-WRITE-SUMMARY | **Line:** 212 | **Cause:** source | **SME review:** Yes

COMPUTE WS-SUCCESS-RATE = (WS-TESTS-PASSED / WS-TOTAL-TESTS) * 100 (line 212, STMT-000031, 2900-WRITE-SUMMARY) has no ON SIZE ERROR and no zero test. WS-TOTAL-TESTS is set to zero by INITIALIZE (line 173) and no statement in the program changes it; it may be updated only in the unresolved paragraph 2700-UPDATE-METRICS.

**Impact:** The summary step may fail or produce an undefined rate when no tests are counted.

**Recommended action:** Confirm with the development team where WS-TOTAL-TESTS is set and whether a zero check is needed.

**Source IDs:** File FIL-0076; Paragraphs FIL-0076-PAR-0008; Statements FIL-0076-STMT-000031

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| TSTVAL00 | 2900-WRITE-SUMMARY | 212 | FIL-0076-STMT-000031 | COMPUTE WS-SUCCESS-RATE |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-207 — UTLMNT00: processing continues after a failed OPEN
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** UTLMNT00 | **Paragraph:** 9999-ERROR-HANDLER | **Line:** 179 | **Cause:** source | **SME review:** Yes

9999-ERROR-HANDLER (line 179, STMT-000034) ends the program (RETURN-CODE 12, GOBACK) only when WS-ERROR-COUNT > 100; otherwise control returns and processing continues, including after a failed OPEN (Agent 4 info note).

**Impact:** Maintenance functions may run against files that failed to open.

**Recommended action:** Confirm with the development team whether an open failure should stop the run.

**Source IDs:** File FIL-0077; Paragraphs FIL-0077-PAR-0012; Statements FIL-0077-STMT-000034

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLMNT00 | 9999-ERROR-HANDLER | 179 | FIL-0077-STMT-000034 | error handler returns unless WS-ERROR-COUNT > 100 |

**Related:** Rules: BR-090

**Detected in:** logic_artifact | **Also:** 

---

### GAP-208 — UTLVAL00: error handler never stops the run and may write to an unopened file
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** UTLVAL00 | **Paragraph:** 9999-ERROR-HANDLER | **Line:** 186 | **Cause:** source | **SME review:** Yes

9999-ERROR-HANDLER (line 186, STMT-000030) has no GOBACK/STOP RUN: after logging an error it returns and processing continues, so a failed OPEN does not stop the program and RETURN-CODE is never set. If VALIDATION-CONTROL, POSITION-MASTER or TRANSACTION-HISTORY fails to open (lines 111, 118, 125), the handler writes ERROR-RECORD (line 190) before ERROR-REPORT is opened (line 128); if ERROR-REPORT itself fails to open, it writes to the unopened file. The WRITE status is not checked.

**Impact:** Open failures are not reported through the return code and error records may be lost.

**Recommended action:** Confirm with the development team the intended error handling and return-code setting.

**Source IDs:** File FIL-0079; Paragraphs FIL-0079-PAR-0012, FIL-0079-PAR-0003; Statements FIL-0079-STMT-000030

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLVAL00 | 9999-ERROR-HANDLER | 186 | FIL-0079-STMT-000030 | error handler returns |
| UTLVAL00 | 1100-OPEN-FILES | 111 |  | write before open (also lines 118, 125) |
| UTLVAL00 | 9999-ERROR-HANDLER | 190 |  | WRITE ERROR-RECORD |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-209 — UTLVAL00: validation loop may not end after an open or read failure
**Type:** SUSPECTED_LOGIC_DEFECT | **Program:** UTLVAL00 | **Paragraph:** 2000-PROCESS | **Line:** 139 | **Cause:** source | **SME review:** Yes

PERFORM UNTIL END-OF-VALIDATION (line 139, STMT-000016, 2000-PROCESS; FILE_EXHAUSTION_LOOP). END-OF-VALIDATION is set only by the AT END branch of READ VALIDATION-CONTROL. If the file failed to open (processing continues) or a READ fails with a status other than end of file, neither AT END nor NOT AT END runs and the loop may not terminate. WS-VAL-STATUS is not tested in the loop.

**Impact:** The utility may loop indefinitely after a file error.

**Recommended action:** Review the loop termination field — confirm it is always set within the loop body, and check for missing READ status tests.

**Source IDs:** File FIL-0079; Paragraphs FIL-0079-PAR-0005; Statements FIL-0079-STMT-000016; Fields FIL-0079-FLD-000012

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| UTLVAL00 | 2000-PROCESS | 139 | FIL-0079-STMT-000016 | PERFORM UNTIL END-OF-VALIDATION |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-210 — PORT-RECORD (PORTFLIO) and PORTFOLIO-RECORD (PORTMSTR) linked only by the name PORT-ID (REL-002, low confidence)
**Type:** UNCONFIRMED_RELATIONSHIP | **Program:** PORTMSTR | **Cause:** analysis | **SME review:** Yes

Data relationship REL-002 (type NAMING_CONVENTION, confidence low) links copybook record PORT-RECORD (PORTFLIO.cpy) to the PORTMSTR file record PORTFOLIO-RECORD via field PORT-ID. Agent 3 notes: 'Both records contain PORT-ID; normalized_type or length differ'. The field catalogue records PORT-ID as PIC X(8) in PORT-RECORD (path PORT-KEY.PORT-ID) and PIC X(10) in PORTFOLIO-RECORD. The ERD labels it (unconfirmed).

**Impact:** Whether the two portfolio records describe the same entity and share a key is not established; the data model chapter cannot present it as a confirmed relationship.

**Recommended action:** Validate with data architect or DBA whether the shared key field represents a genuine foreign key relationship.

**Source IDs:** File FIL-0009; Records FIL-0009-REC-0001, FIL-0069-REC-0001; Fields FIL-0009-FLD-000002, FIL-0069-FLD-000001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  |  |  |  |
| PORTMSTR |  |  |  |  |

**Related:** Diagrams: ERD-MAIN

**Detected in:** data_artifact, diagrams_artifact | **Also:** 

---

### GAP-211 — Copybook SQLCA includes itself; the DB2 SQLCA structure (SQLCODE, SQLSTATE, ...) is not in the repository
**Type:** UNRESOLVED_COPYBOOK | **Program:** system-wide | **Line:** 6 | **Cause:** source | **SME review:** No

Copybook SQLCA (src/copybook/db2/SQLCA.cpy) contains EXEC SQL INCLUDE SQLCA END-EXEC at line 6, which names itself. The inventory logged self_include and added no edge; Agent 3 did not register the self-reference and left it as an unresolved stub. The copybook defines only the record SQL-STATUS-CODES (35 bytes); the precompiler SQLCA items (SQLCODE, SQLSTATE, ...) are not defined in the repository. Programs that include SQLCA (e.g. CURSMGR, ERRHNDL, SECMGR) therefore get SQL-STATUS-CODES only.

**Impact:** SQLCODE and the other SQLCA items referenced by the DB2 programs have no Field ID; their meaning is the standard DB2 one (classified_conditions: 'precompiler-supplied SQLCA field; standard DB2 meaning').

**Recommended action:** Locate the missing copybook in a load library, external PDS, or vendor-supplied library (or confirm the DB2 precompiler supplies the SQLCA). Add to repo and re-run Data Agent.

**Severity note:** reference-harness maps an unresolved copy stub to critical. Downgraded to medium by the synthesis step because every artifact records the missing content as the SQL communication area (SQLCA) that the DB2 precompiler supplies, with standard DB2 meaning; confirm that these programs are precompiled with the standard DB2 SQLCA (see assumptions). Severity copied from the reference harness table for UNRESOLVED_COPYBOOK. Every logic file that records this stub states that the missing content is the DB2 precompiler SQLCA structure (SQLCODE, SQLSTATE, SQLERRMC, ...); the merge may decide to treat it as PRECOMPILER_PROVIDED context instead.

**Source IDs:** File FIL-0017; Records FIL-0017-REC-0001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 |  | 44 |  | SQLCA |
| RTNCDE00 |  |  |  | SQLCA |
| DB2CMT |  | 21 |  | SQLCA |
| DB2CONN |  | 22 |  | SQLCA |
| DB2ERR |  | 24 |  | SQLCA |
| DB2STAT |  | 32 |  | SQLCA |
| DB2ONLN |  | 16 |  | SQLCA |
| DB2RECV |  | 16 |  | SQLCA |
|  |  | 6 |  | SQLCA |
| CURSMGR |  | 16 |  |  |
| ERRHNDL |  | 19 |  |  |
| SECMGR |  | 16 |  |  |

**Related:** Gaps: GAP-300, GAP-301, GAP-302, GAP-303, GAP-305, GAP-306, GAP-307, GAP-308, GAP-309, GAP-310, GAP-312, GAP-313

**Detected in:** data_artifact, logic_artifact, inventory_artifact | **Also:** PRECOMPILER_PROVIDED

---

### GAP-212 — CURSMGR uses PERFORM ... THRU ranges (unstructured flow), two of them to paragraphs missing from the source
**Type:** UNSTRUCTURED_FLOW | **Program:** CURSMGR | **Paragraph:** (UNNAMED) | **Line:** 46 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for CURSMGR (goto_edges 0, has_alter false). The unstructured constructs are 4 PERFORM ... THRU ranges in the unnamed main paragraph. The ranges P300-FETCH-DATA THRU P300-EXIT (line 52) and P400-CLOSE-CURSOR THRU P400-EXIT (line 55) are resolved:false because neither paragraph exists in the source (truncated file); that missing-target gap is the per-program logic gap paths:CURSMGR.

**Impact:** Flow tracing through the THRU ranges is approximated.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0059; Paragraphs FIL-0059-PAR-0001; Statements FIL-0059-STMT-000014, FIL-0059-STMT-000016, FIL-0059-STMT-000015, FIL-0059-STMT-000013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 46 | FIL-0059-STMT-000014 | P100-DECLARE-CURSOR THRU P100-EXIT |
|  | (UNNAMED) | 49 | FIL-0059-STMT-000016 | P200-OPEN-CURSOR THRU P200-EXIT |
|  | (UNNAMED) | 52 | FIL-0059-STMT-000015 | P300-FETCH-DATA THRU P300-EXIT |
|  | (UNNAMED) | 55 | FIL-0059-STMT-000013 | P400-CLOSE-CURSOR THRU P400-EXIT |

**Related:** Gaps: GAP-145 | Diagrams: FLOW-CURSMGR

**Detected in:** parser_artifact | **Also:** 

---

### GAP-213 — DB2ONLN uses PERFORM ... THRU ranges (unstructured flow)
**Type:** UNSTRUCTURED_FLOW | **Program:** DB2ONLN | **Paragraph:** (UNNAMED) | **Line:** 42 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for DB2ONLN (goto_edges 0, has_alter false). The unstructured constructs are 5 PERFORM ... THRU ranges (3 in the unnamed main paragraph, 1 in P100-PROCESS-CONNECT, 1 in P110-ESTABLISH-CONNECTION).

**Impact:** Flow tracing through the THRU ranges is approximated; a paragraph placed inside a range would run without an explicit PERFORM.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0060; Paragraphs FIL-0060-PAR-0001, FIL-0060-PAR-0002, FIL-0060-PAR-0004; Statements FIL-0060-STMT-000018, FIL-0060-STMT-000019, FIL-0060-STMT-000020, FIL-0060-STMT-000023, FIL-0060-STMT-000030

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 42 | FIL-0060-STMT-000018 | P100-PROCESS-CONNECT THRU P100-EXIT |
|  | (UNNAMED) | 45 | FIL-0060-STMT-000019 | P200-PROCESS-DISCONNECT THRU P200-EXIT |
|  | (UNNAMED) | 48 | FIL-0060-STMT-000020 | P300-CHECK-STATUS THRU P300-EXIT |
|  | P100-PROCESS-CONNECT | 56 | FIL-0060-STMT-000023 | P110-ESTABLISH-CONNECTION THRU P110-EXIT |
|  | P110-ESTABLISH-CONNECTION | 73 | FIL-0060-STMT-000030 | P120-GENERATE-TOKEN THRU P120-EXIT |

**Related:** Gaps: GAP-269 | Diagrams: FLOW-DB2ONLN

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-214 — DB2RECV uses PERFORM ... THRU ranges (unstructured flow)
**Type:** UNSTRUCTURED_FLOW | **Program:** DB2RECV | **Paragraph:** (UNNAMED) | **Line:** 50 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for DB2RECV (goto_edges 0, has_alter false). The unstructured constructs are 5 PERFORM ... THRU ranges (3 in the unnamed main paragraph, 2 in P100-RECOVER-CONNECTION).

**Impact:** Flow tracing through the THRU ranges is approximated; a paragraph placed inside a range would run without an explicit PERFORM.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0001, FIL-0061-PAR-0002; Statements FIL-0061-STMT-000025, FIL-0061-STMT-000027, FIL-0061-STMT-000026, FIL-0061-STMT-000028, FIL-0061-STMT-000043

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 50 | FIL-0061-STMT-000025 | P100-RECOVER-CONNECTION THRU P100-EXIT |
|  | (UNNAMED) | 53 | FIL-0061-STMT-000027 | P200-RECOVER-TRANSACTION THRU P200-EXIT |
|  | (UNNAMED) | 56 | FIL-0061-STMT-000026 | P300-RECOVER-CURSOR THRU P300-EXIT |
|  | P100-RECOVER-CONNECTION | 66 | FIL-0061-STMT-000028 | P110-ATTEMPT-RECONNECT THRU P110-EXIT |
|  | P100-RECOVER-CONNECTION | 72 | FIL-0061-STMT-000043 | P120-WAIT-INTERVAL THRU P120-EXIT |

**Related:** Gaps: GAP-270 | Diagrams: FLOW-DB2RECV

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-215 — ERRHNDL uses PERFORM ... THRU ranges (unstructured flow)
**Type:** UNSTRUCTURED_FLOW | **Program:** ERRHNDL | **Paragraph:** (UNNAMED) | **Line:** 38 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for ERRHNDL (goto_edges 0, has_alter false). The unstructured constructs are 4 PERFORM ... THRU ranges in the unnamed main paragraph.

**Impact:** Flow tracing through the THRU ranges is approximated; a paragraph placed inside a range would run without an explicit PERFORM.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0062; Paragraphs FIL-0062-PAR-0001; Statements FIL-0062-STMT-000001, FIL-0062-STMT-000002, FIL-0062-STMT-000003, FIL-0062-STMT-000004

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 38 | FIL-0062-STMT-000001 | P100-INIT-ERROR-HANDLER THRU P100-EXIT |
|  | (UNNAMED) | 41 | FIL-0062-STMT-000002 | P200-LOG-ERROR THRU P200-EXIT |
|  | (UNNAMED) | 44 | FIL-0062-STMT-000003 | P300-FORMAT-MESSAGE THRU P300-EXIT |
|  | (UNNAMED) | 47 | FIL-0062-STMT-000004 | P400-DETERMINE-ACTION THRU P400-EXIT |

**Related:** Diagrams: FLOW-ERRHNDL

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-216 — INQHIST uses PERFORM ... THRU ranges (unstructured flow), one of them recursive
**Type:** UNSTRUCTURED_FLOW | **Program:** INQHIST | **Paragraph:** (UNNAMED) | **Line:** 70 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for INQHIST (goto_edges 0, has_alter false). The unstructured constructs are 7 PERFORM ... THRU ranges. One of them, PERFORM P150-DB2-CONNECT THRU P150-EXIT at line 114, is issued from inside P150-DB2-CONNECT itself (recursive); that recursion is the per-program logic gap paths:INQHIST.

**Impact:** Flow tracing through the THRU ranges is approximated; the recursive range makes the number of passes run-time dependent.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0001, FIL-0063-PAR-0002, FIL-0063-PAR-0004, FIL-0063-PAR-0006; Statements FIL-0063-STMT-000001, FIL-0063-STMT-000002, FIL-0063-STMT-000003, FIL-0063-STMT-000009, FIL-0063-STMT-000043, FIL-0063-STMT-000042, FIL-0063-STMT-000044

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 70 | FIL-0063-STMT-000001 | P100-INIT-PROGRAM THRU P100-EXIT |
|  | (UNNAMED) | 73 | FIL-0063-STMT-000002 | P200-GET-HISTORY THRU P200-EXIT |
|  | (UNNAMED) | 76 | FIL-0063-STMT-000003 | P300-FORMAT-DISPLAY THRU P300-EXIT |
|  | P100-INIT-PROGRAM | 90 | FIL-0063-STMT-000009 | P150-DB2-CONNECT THRU P150-EXIT |
|  | P150-DB2-CONNECT | 114 | FIL-0063-STMT-000043 | P150-DB2-CONNECT THRU P150-EXIT |
|  | P150-DB2-CONNECT | 119 | FIL-0063-STMT-000042 | P999-ERROR-ROUTINE THRU P999-EXIT |
|  | P200-GET-HISTORY | 151 | FIL-0063-STMT-000044 | P250-FETCH-HISTORY THRU P250-EXIT |

**Related:** Gaps: GAP-149, GAP-272 | Diagrams: FLOW-INQHIST, SEQ-INQHIST

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-217 — INQONLN uses PERFORM ... THRU ranges (unstructured flow)
**Type:** UNSTRUCTURED_FLOW | **Program:** INQONLN | **Paragraph:** (UNNAMED) | **Line:** 46 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for INQONLN (goto_edges 0, has_alter false). The unstructured constructs are 7 PERFORM ... THRU ranges (1 in the unnamed main paragraph, 6 in P100-PROCESS-REQUEST, two of them to P900-ERROR-ROUTINE).

**Impact:** Flow tracing through the THRU ranges is approximated; a paragraph placed inside a range would run without an explicit PERFORM.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0001, FIL-0064-PAR-0002; Statements FIL-0064-STMT-000002, FIL-0064-STMT-000033, FIL-0064-STMT-000032, FIL-0064-STMT-000031, FIL-0064-STMT-000034, FIL-0064-STMT-000007, FIL-0064-STMT-000036

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 46 | FIL-0064-STMT-000002 | P100-PROCESS-REQUEST THRU P100-EXIT |
|  | P100-PROCESS-REQUEST | 64 | FIL-0064-STMT-000033 | P200-DISPLAY-MENU THRU P200-EXIT |
|  | P100-PROCESS-REQUEST | 67 | FIL-0064-STMT-000032 | P300-PORTFOLIO-INQUIRY THRU P300-EXIT |
|  | P100-PROCESS-REQUEST | 70 | FIL-0064-STMT-000031 | P400-HISTORY-INQUIRY THRU P400-EXIT |
|  | P100-PROCESS-REQUEST | 75 | FIL-0064-STMT-000034 | P900-ERROR-ROUTINE THRU P900-EXIT |
|  | P100-PROCESS-REQUEST | 79 | FIL-0064-STMT-000007 | P050-SECURITY-CHECK THRU P050-EXIT |
|  | P100-PROCESS-REQUEST | 85 | FIL-0064-STMT-000036 | P900-ERROR-ROUTINE THRU P900-EXIT |

**Related:** Gaps: GAP-273 | Diagrams: FLOW-INQONLN

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-218 — INQPORT uses PERFORM ... THRU ranges (unstructured flow)
**Type:** UNSTRUCTURED_FLOW | **Program:** INQPORT | **Paragraph:** (UNNAMED) | **Line:** 41 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for INQPORT (goto_edges 0, has_alter false). The unstructured constructs are 4 PERFORM ... THRU ranges in the unnamed main paragraph. Agent 2 also notes that EXEC CICS HANDLE CONDITION (line 61, STMT-000007) names P999-ERROR-ROUTINE (ERROR) and P900-NOT-FOUND (NOTFND); that is not a PERFORM/GO TO/ALTER edge.

**Impact:** Flow tracing through the THRU ranges is approximated; a paragraph placed inside a range would run without an explicit PERFORM.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0065; Paragraphs FIL-0065-PAR-0001; Statements FIL-0065-STMT-000001, FIL-0065-STMT-000002, FIL-0065-STMT-000023, FIL-0065-STMT-000022

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 41 | FIL-0065-STMT-000001 | P100-INIT-PROGRAM THRU P100-EXIT |
|  | (UNNAMED) | 44 | FIL-0065-STMT-000002 | P200-GET-POSITION THRU P200-EXIT |
|  | (UNNAMED) | 48 | FIL-0065-STMT-000023 | P300-FORMAT-DISPLAY THRU P300-EXIT |
|  | (UNNAMED) | 51 | FIL-0065-STMT-000022 | P900-NOT-FOUND THRU P900-EXIT |

**Related:** Gaps: GAP-171 | Diagrams: FLOW-INQPORT

**Detected in:** parser_artifact | **Also:** 

---

### GAP-219 — RTNANA00 uses PERFORM ... THRU ranges (unstructured flow)
**Type:** UNSTRUCTURED_FLOW | **Program:** RTNANA00 | **Paragraph:** (UNNAMED) | **Line:** 97 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for RTNANA00 (goto_edges 0, has_alter false). The unstructured constructs are 6 PERFORM ... THRU ranges, each logged as a warning that obscures control flow. The range-end paragraphs contain only EXIT and are collapsed in the flow diagram.

**Impact:** Flow tracing through the THRU ranges is approximated; a paragraph placed inside a range would run without an explicit PERFORM.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0051; Paragraphs FIL-0051-PAR-0001, FIL-0051-PAR-0004; Statements FIL-0051-STMT-000001, FIL-0051-STMT-000002, FIL-0051-STMT-000003, FIL-0051-STMT-000004, FIL-0051-STMT-000013, FIL-0051-STMT-000014

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 97 | FIL-0051-STMT-000001 | P100-INIT-PROGRAM THRU P100-EXIT |
|  | (UNNAMED) | 100 | FIL-0051-STMT-000002 | P200-PROCESS-ANALYSIS THRU P200-EXIT |
|  | (UNNAMED) | 103 | FIL-0051-STMT-000003 | P300-GENERATE-REPORT THRU P300-EXIT |
|  | (UNNAMED) | 106 | FIL-0051-STMT-000004 | P900-CLOSE-FILES THRU P900-EXIT |
|  | P200-PROCESS-ANALYSIS | 141 | FIL-0051-STMT-000013 | P210-WRITE-HEADERS THRU P210-EXIT |
|  | P200-PROCESS-ANALYSIS | 144 | FIL-0051-STMT-000014 | P220-PROCESS-DETAIL THRU P220-EXIT |

**Related:** Gaps: GAP-277 | Diagrams: FLOW-RTNANA00

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-220 — RTNCDE00 uses PERFORM ... THRU ranges (unstructured flow)
**Type:** UNSTRUCTURED_FLOW | **Program:** RTNCDE00 | **Paragraph:** (UNNAMED) | **Line:** 35 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for RTNCDE00 (goto_edges 0, has_alter false). The unstructured constructs are 5 PERFORM ... THRU ranges in the unnamed main paragraph; each range ends in an EXIT-only paragraph.

**Impact:** Flow tracing through the THRU ranges is approximated; a paragraph placed inside a range would run without an explicit PERFORM.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0052; Paragraphs FIL-0052-PAR-0001; Statements FIL-0052-STMT-000029, FIL-0052-STMT-000031, FIL-0052-STMT-000028, FIL-0052-STMT-000030, FIL-0052-STMT-000027

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 35 | FIL-0052-STMT-000029 | P100-INIT-RETURN-CODES THRU P100-EXIT |
|  | (UNNAMED) | 38 | FIL-0052-STMT-000031 | P200-SET-RETURN-CODE THRU P200-EXIT |
|  | (UNNAMED) | 41 | FIL-0052-STMT-000028 | P300-GET-RETURN-CODE THRU P300-EXIT |
|  | (UNNAMED) | 44 | FIL-0052-STMT-000030 | P400-LOG-RETURN-CODE THRU P400-EXIT |
|  | (UNNAMED) | 47 | FIL-0052-STMT-000027 | P500-ANALYZE-CODES THRU P500-EXIT |

**Related:** Gaps: GAP-278 | Diagrams: FLOW-RTNCDE00

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-221 — SECMGR uses PERFORM ... THRU ranges (unstructured flow)
**Type:** UNSTRUCTURED_FLOW | **Program:** SECMGR | **Paragraph:** (UNNAMED) | **Line:** 44 | **Cause:** analysis | **SME review:** No

Agent 2 sets has_unstructured_flow true for SECMGR (goto_edges 0, has_alter false). The unstructured constructs are 3 PERFORM ... THRU ranges in the unnamed main paragraph.

**Impact:** Flow tracing through the THRU ranges is approximated; a paragraph placed inside a range would run without an explicit PERFORM.

**Recommended action:** Map GO TO targets manually. Consider refactoring GO TO chains into structured PERFORM before modernisation. (Here the constructs are PERFORM ... THRU ranges, not GO TO.)

**Source IDs:** File FIL-0066; Paragraphs FIL-0066-PAR-0001; Statements FIL-0066-STMT-000018, FIL-0066-STMT-000017, FIL-0066-STMT-000016

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  | (UNNAMED) | 44 | FIL-0066-STMT-000018 | P100-VALIDATE-USER THRU P100-EXIT |
|  | (UNNAMED) | 47 | FIL-0066-STMT-000017 | P200-CHECK-AUTH THRU P200-EXIT |
|  | (UNNAMED) | 50 | FIL-0066-STMT-000016 | P300-LOG-ACCESS THRU P300-EXIT |

**Related:** Diagrams: FLOW-SECMGR

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-222 — Copybook DBPROC contains procedure code (paragraphs and CALL 'ERRPROC') that is copied into WORKING-STORAGE
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** system-wide | **Line:** 26 | **Cause:** analysis | **SME review:** Yes

Copybook DBPROC contains procedure code: paragraphs CONNECT-TO-DB2, DISCONNECT-FROM-DB2, DB2-ERROR-ROUTINE and CHECK-SQL-STATUS (copybook lines 26-63) and CALL 'ERRPROC' (line 56). Agent 3 did not parse it as a data layout; only its data record DB2-ERROR-HANDLING is expanded. The inventory does not scan copybooks for edges, so the inherited CALL ERRPROC is not an inventory edge for the programs that copy DBPROC (HISTLD00, DB2CMT, DB2CONN, DB2ERR, DB2STAT). In HISTLD00 three PERFORM targets (CONNECT-TO-DB2, DB2-ERROR-ROUTINE, DISCONNECT-FROM-DB2) are these copybook paragraphs and are not registered for the program.

**Impact:** The DB2 connect, error and disconnect logic held in DBPROC is not traced for any program, and the call to ERRPROC it contains is missing from the dependency graph.

**Recommended action:** Confirm with the development team where DBPROC is copied in the compiled programs (PROCEDURE DIVISION or WORKING-STORAGE) and document its paragraphs and its CALL to ERRPROC.

**Source IDs:** File FIL-0015

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 26 |  |  |
|  |  | 56 |  | ERRPROC |
| HISTLD00 |  |  |  |  |
| DB2CMT |  |  |  |  |
| DB2CONN |  |  |  |  |
| DB2ERR |  | 25 |  |  |
| DB2STAT |  |  |  |  |

**Related:** Gaps: GAP-148, GAP-254 | Diagrams: COMP-ERRPROC, FLOW-HISTLD00

**Detected in:** inventory_artifact, data_artifact, logic_artifact, diagrams_artifact | **Also:** 

---

### GAP-223 — Copybooks whose records are level 01 are copied under a program 01 record (16 occurrences in 12 programs)
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** system-wide | **Cause:** source | **SME review:** Yes

Agent 3 records 16 issues (types copy_level_conflict 7, nested_level_01_copy_expansion 2, level_01_copy_under_01 2, copybook_01_under_program_01 3, copybook_level_01_under_01 1, copybook_level_01_under_record 1) for one pattern: a COPY or EXEC SQL INCLUDE sits under a program 01 record, but the copybook's own record is itself level 01. 'A level-01 inside a copybook starts a new record', so the holder 01 has no subordinate items of its own (inline_bytes 0). Agent 3 registered each as written: EXPANDS_COPY from the holder record, whose total_bytes includes the copybook record. Programs: RTNANA00 (line 32), TSTGEN00 (52, 58), RTNCDE00 (26, 30), INQPORT (15, 18, 38), DB2ERR (19), CURSMGR (16), DB2RECV (16, 25, 28), ERRHNDL (16), SECMGR (16), DB2ONLN (16, 25), INQHIST (15), INQONLN (16).

**Impact:** Holder records (e.g. WS-DB2-AREA, WS-ERROR-AREA, WS-COMMAREA, DFHCOMMAREA) are empty groups; references qualified by the holder (e.g. INQCOM-ERROR-MSG OF WS-COMMAREA) do not resolve. The ERD draws TSTGEN00 PORTFOLIO-RECORD and TRANSACTION-RECORD with no fields.

**Recommended action:** Confirm with the development team how these copybooks are compiled (the holder 01 is an empty group) and whether qualified references by the holder name are intended.

**Source IDs:** Records FIL-0051-REC-0003, FIL-0075-REC-0002, FIL-0075-REC-0003, FIL-0056-REC-0001, FIL-0059-REC-0001, FIL-0060-REC-0001, FIL-0060-REC-0003

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RTNANA00 |  |  |  |  |
| TSTGEN00 |  |  |  |  |
| RTNCDE00 |  |  |  |  |
| INQPORT |  |  |  |  |
| DB2ERR |  |  |  |  |
| CURSMGR |  |  |  |  |
| DB2RECV |  |  |  |  |
| ERRHNDL |  |  |  |  |
| SECMGR |  |  |  |  |
| DB2ONLN |  |  |  |  |
| INQHIST |  |  |  |  |
| INQONLN |  |  |  |  |

**Related:** Gaps: GAP-010, GAP-011, GAP-012, GAP-013, GAP-247 | Diagrams: ERD-MAIN, SEQ-INQHIST, SEQ-DB2RECV

**Detected in:** data_artifact, diagrams_artifact | **Also:** 

---

### GAP-224 — Files declared with SELECT but without an FD / record layout (RPTAUD00, RPTPOS00, RPTSTA00, UTLMON00, UTLVAL00)
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** system-wide | **Cause:** source | **SME review:** Yes

In five programs COPY statements sit directly in the FILE SECTION before any FD, so some SELECTed files have no FD and no file record: RPTAUD00 AUDIT-FILE and ERROR-FILE (COPY AUDITLOG / ERRHAND at lines 35-36; neither copybook contains an FD); RPTPOS00 POSITION-MASTER and TRANSACTION-HISTORY (COPY POSREC / TRNREC at lines 35-36); RPTSTA00 DB2-STATS and BATCH-STATS (COPY DB2STAT / BCHCTL at lines 35-36); UTLMON00 DB2-STATS (COPY DB2STAT at line 43); UTLVAL00 POSITION-MASTER and TRANSACTION-HISTORY (COPY POSREC / TRNREC at lines 44-45; select_without_fd). Agent 3 links the copybook records to the FILE section by EXPANDS_COPY with no fd_name; they are not registered as program FILE records.

**Impact:** Which record layout each of these files has is inferred from the copybook placement only; for RPTSTA00 and UTLMON00 the DB2STAT layout is missing altogether.

**Recommended action:** Confirm with the development team the FD and record layout of each listed file (the compiled version of these programs may differ from the repository source).

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTAUD00 |  | 35 |  |  |
| RPTPOS00 |  | 35 |  |  |
| RPTSTA00 |  | 35 |  |  |
| UTLMON00 |  | 43 |  |  |
| UTLVAL00 |  | 44 |  |  |

**Related:** Gaps: GAP-005, GAP-006, GAP-125, GAP-126, GAP-259, GAP-260 | Diagrams: FLOW-RPTAUD00, FLOW-RPTPOS00, FLOW-RPTSTA00, FLOW-UTLMON00, FLOW-UTLVAL00

**Detected in:** data_artifact, diagrams_artifact | **Also:** 

---

### GAP-225 — Non-standard comment / indicator columns in 15 source lines (14 files)
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** system-wide | **Cause:** source | **SME review:** No

Agent 3 records 14 misplaced_comment_indicator warnings and 1 invalid_indicator_area warning: lines whose first non-blank character in columns 8-72 is '*' (column 8, Area A, instead of the column-7 indicator), or '*>' inline-comment style, were treated as comments and skipped. Files: copybook CKPRST (lines 1, 5), BCHCTL00, HISTLD00, PRCSEQ00, DB2CMT, DB2CONN, DB2STAT, PORTDEL, PORTMSTR, PORTUPDT, DB2HNDL, FILEHNDL (line 1 each), PROGNAME (lines 20, 24, 47, '*>'), and PORTTEST line 1 ('*' in column 3 and '=' in the column-7 indicator area; the line precedes the IDENTIFICATION DIVISION and contains no data entry).

**Impact:** None recorded on data or logic (the lines were skipped as comments and contain no data entry); whether the compiled version treats them the same way is not recorded.

**Recommended action:** Confirm with the development team that these lines are comments in the compiled version.

**Severity note:** Severity from the UNSUPPORTED_CONSTRUCT type row; the artifacts record no effect on data or logic. The consolidator may lower it.

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  |  |  |  |
| BCHCTL00 |  |  |  |  |
| HISTLD00 |  |  |  |  |
| PRCSEQ00 |  |  |  |  |
| DB2CMT |  |  |  |  |
| DB2CONN |  |  |  |  |
| DB2STAT |  |  |  |  |
| PORTDEL |  |  |  |  |
| PORTMSTR |  |  |  |  |
| PORTUPDT |  |  |  |  |
| DB2HNDL |  |  |  |  |
| FILEHNDL |  |  |  |  |
| PROGNAME |  |  |  |  |
| PORTTEST |  |  |  |  |

**Detected in:** data_artifact | **Also:** 

---

### GAP-226 — VALUE clauses that cannot take effect as written (literal longer than PIC, VALUE in FILE / LINKAGE SECTION) - 8 items
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** system-wide | **Cause:** source | **SME review:** No

Agent 3 records VALUE literals longer than their PIC and VALUE clauses in sections where they are not applied; all were recorded as literal text only, not evaluated. Literal longer than PIC: BCHCON BCT-EMERGENCY PIC X(8) VALUE 'EMERGENCY' (9 characters, line 47); DB2HNDL FILLER PIC X(20) VALUE 'DB2 ERROR - SQLCODE: ' (21 characters, line 58); PORTDEL WS-PROGRAM-NAME PIC X(08) VALUE 'PORTDEL  ' (line 69); PORTUPDT WS-PROGRAM-NAME PIC X(08) VALUE 'PORTUPDT ' (line 55); PROGNAME WS-PROGRAM-NAME PIC X(08) VALUE 'PROGNAME ' (line 31). VALUE in FILE SECTION: PRCSEQ00 (copybook PRCSEQ record STANDARD-SEQUENCES, line 34) and RPTAUD00 (ERRHAND copied into the FILE SECTION, line 36). VALUE in LINKAGE SECTION: CURSMGR CURS-ARRAY-FETCH VALUE 'N' (line 36).

**Impact:** The initial values documented for these items may not be what the program sees at run time (values truncated, or not applied to file/linkage storage).

**Recommended action:** Confirm with the development team the intended values; where a constant depends on a FILE/LINKAGE VALUE, confirm how it is actually set.

**Severity note:** Severity from the UNSUPPORTED_CONSTRUCT type row; the artifacts record no effect on logic. The consolidator may lower it.

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  | 47 |  | BCT-EMERGENCY |
| DB2HNDL |  | 58 |  | WS-DB2-ERROR-MSG.FILLER#1 |
| PORTDEL |  | 69 |  | WS-PROGRAM-NAME |
| PORTUPDT |  | 55 |  | WS-PROGRAM-NAME |
| PROGNAME |  | 31 |  | WS-PROGRAM-NAME |
| PRCSEQ00 |  | 34 |  | STANDARD-SEQUENCES |
| RPTAUD00 |  | 36 |  |  |
| CURSMGR |  | 36 |  | CURS-ARRAY-FETCH |

**Detected in:** data_artifact | **Also:** 

---

### GAP-227 — CURSMGR: cursor name and SQL statement text are supplied by the caller at run time
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** CURSMGR | **Paragraph:** P100-DECLARE-CURSOR | **Line:** 70 | **Cause:** analysis | **SME review:** Yes

Agent 4 flags (!! REVIEW) that the cursor name and statement text are host variables supplied by the caller (lines 70, 84, in P100-DECLARE-CURSOR and P200-OPEN-CURSOR); the SQL executed is not known statically.

**Impact:** Which queries CURSMGR runs, and on which tables, cannot be determined from the source.

**Recommended action:** Identify the callers of CURSMGR and the statement texts they pass, or capture them at run time.

**Source IDs:** File FIL-0059; Paragraphs FIL-0059-PAR-0002, FIL-0059-PAR-0004

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| CURSMGR | P100-DECLARE-CURSOR | 70 |  | dynamic cursor / statement text |
| CURSMGR | P200-OPEN-CURSOR | 84 |  | dynamic cursor / statement text |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-228 — ERRHNDL: MOVE FUNCTION RANDOM to an alphanumeric trace ID
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** ERRHNDL | **Paragraph:** P100-INIT-ERROR-HANDLER | **Line:** 58 | **Cause:** analysis | **SME review:** Yes

MOVE FUNCTION RANDOM TO ERR-TRACE-ID (line 58, P100-INIT-ERROR-HANDLER) moves a numeric function result to PIC X(16); Agent 4 notes the resulting character form is compiler-dependent and the trace-ID format is not determinable from the source.

**Impact:** The format of generated trace IDs written to ERRLOG and returned to callers is unknown.

**Recommended action:** Confirm the trace-ID format with the development team or from sample ERRLOG rows.

**Source IDs:** File FIL-0062; Paragraphs FIL-0062-PAR-0002; Statements FIL-0062-STMT-000026

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| ERRHNDL | P100-INIT-ERROR-HANDLER | 58 | FIL-0062-STMT-000026 | ERR-TRACE-ID |

**Related:** Rules: BR-051

**Detected in:** logic_artifact | **Also:** 

---

### GAP-229 — PORTDEL: ACCEPT WS-TIMESTAMP FROM TIME STAMP is not a standard ACCEPT source
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** PORTDEL | **Paragraph:** 2300-WRITE-AUDIT | **Line:** 169 | **Cause:** source | **SME review:** Yes

'ACCEPT WS-TIMESTAMP FROM TIME STAMP' (line 169, STMT-000016, 2300-WRITE-AUDIT) is recorded verbatim: 'TIME STAMP' is not a standard ACCEPT FROM mnemonic (standard forms are DATE, DAY, DAY-OF-WEEK, TIME). The exact timestamp format written to AUD-TIMESTAMP is unknown; flagged ambiguous.

**Impact:** The format of the deletion audit timestamp is unknown.

**Recommended action:** Confirm with the development team which compiler extension provides TIME STAMP and the resulting format.

**Source IDs:** File FIL-0068; Paragraphs FIL-0068-PAR-0006; Statements FIL-0068-STMT-000016

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTDEL | 2300-WRITE-AUDIT | 169 | FIL-0068-STMT-000016 | ACCEPT WS-TIMESTAMP FROM TIME STAMP |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-230 — PORTTEST: COMPUTE into alphanumeric PORT-ACCOUNT-NO
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** PORTTEST | **Paragraph:** 2100-GENERATE-KEY | **Line:** 88 | **Cause:** source | **SME review:** Yes

COMPUTE PORT-ACCOUNT-NO = WS-RECORD-COUNT + 1000000000 (line 88, STMT-000017, 2100-GENERATE-KEY): PORT-ACCOUNT-NO is PIC X(10) (alphanumeric), which is not a valid COMPUTE receiving item in standard COBOL. Recorded verbatim.

**Impact:** The generated account number value depends on compiler extensions.

**Recommended action:** Confirm with the development team how the compiler treats this COMPUTE and the intended account-number format.

**Source IDs:** File FIL-0071; Paragraphs FIL-0071-PAR-0004; Statements FIL-0071-STMT-000017

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTTEST | 2100-GENERATE-KEY | 88 | FIL-0071-STMT-000017 | COMPUTE PORT-ACCOUNT-NO |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-231 — PORTTRAN: FUNCTION USER-ID and STRING of COMP-3 operands (unreachable audit paragraph)
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** PORTTRAN | **Paragraph:** 2300-UPDATE-AUDIT-TRAIL | **Line:** 254 | **Cause:** source | **SME review:** Yes

In 2300-UPDATE-AUDIT-TRAIL (PAR-0013, unreachable from 0000-MAIN): MOVE FUNCTION USER-ID TO AUD-USER-ID (line 254, STMT-000046) uses a function that is not a standard IBM Enterprise COBOL intrinsic; and STRING ... TRN-AMOUNT ... TRN-QUANTITY ... INTO AUD-MESSAGE (line 281, STMT-000053) sends operands that TRNREC declares COMP-3, while STRING operands are normally display usage; the result is not determined statically. Both recorded verbatim and flagged for SME review.

**Impact:** Audit user ID and audit message content are uncertain if the paragraph is ever reconnected.

**Recommended action:** Confirm with the development team the compiler extension for FUNCTION USER-ID and the intended audit message format.

**Source IDs:** File FIL-0072; Paragraphs FIL-0072-PAR-0013; Statements FIL-0072-STMT-000046, FIL-0072-STMT-000053

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTTRAN | 2300-UPDATE-AUDIT-TRAIL | 254 | FIL-0072-STMT-000046 | FUNCTION USER-ID |
| PORTTRAN | 2300-UPDATE-AUDIT-TRAIL | 281 | FIL-0072-STMT-000053 | STRING with COMP-3 TRN-AMOUNT, TRN-QUANTITY |

**Related:** Rules: BR-080

**Detected in:** logic_artifact | **Also:** 

---

### GAP-232 — PORTUPDT: alphanumeric-to-numeric MOVE with compiler-dependent result
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** PORTUPDT | **Paragraph:** 2200-APPLY-UPDATE | **Line:** 138 | **Cause:** source | **SME review:** Yes

MOVE of alphanumeric UPDT-NEW-VALUE X(50) to numeric WS-NUMERIC-WORK S9(13)V99 (line 138, STMT-000030, 2200-APPLY-UPDATE) treats the source as an unsigned integer; a decimal point, sign or other characters are not interpreted and the result is compiler-dependent (annotation marked ambiguous).

**Impact:** Numeric updates with decimals or signs may store wrong values.

**Recommended action:** Confirm with the development team the input format of UPDT-NEW-VALUE and the compiler behaviour.

**Source IDs:** File FIL-0073; Paragraphs FIL-0073-PAR-0005; Statements FIL-0073-STMT-000030

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTUPDT | 2200-APPLY-UPDATE | 138 | FIL-0073-STMT-000030 | MOVE UPDT-NEW-VALUE TO WS-NUMERIC-WORK |

**Related:** Rules: BR-082

**Detected in:** logic_artifact | **Also:** 

---

### GAP-233 — PORTVALD: alphanumeric-to-numeric MOVE with compiler-dependent result
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** PORTVALD | **Paragraph:** 4000-VALIDATE-AMOUNT | **Line:** 109 | **Cause:** source | **SME review:** Yes

MOVE of LS-INPUT-VALUE X(50) to a numeric display item S9(13)V99 (line 109, STMT-000015, 4000-VALIDATE-AMOUNT) treats the source as an unsigned integer; a decimal point, sign or non-digit characters are not interpreted, and the resulting value is compiler-dependent (annotation marked ambiguous).

**Impact:** Amounts with decimals or signs may be validated against a wrong value.

**Recommended action:** Confirm with the development team the amount input format and the compiler behaviour.

**Source IDs:** File FIL-0074; Paragraphs FIL-0074-PAR-0005; Statements FIL-0074-STMT-000015

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTVALD | 4000-VALIDATE-AMOUNT | 109 | FIL-0074-STMT-000015 | MOVE LS-INPUT-VALUE to numeric display item S9(13)V99 |

**Related:** Rules: BR-088

**Detected in:** logic_artifact | **Also:** 

---

### GAP-234 — PRCSEQ00: non-standard ACCEPT ... FROM TIME STAMP
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** PRCSEQ00 | **Paragraph:** 2300-UPDATE-PROCESS-STATUS | **Line:** 271 | **Cause:** analysis | **SME review:** Yes

Agent 4 notes that ACCEPT ... FROM TIME STAMP (line 271, 2300-UPDATE-PROCESS-STATUS) is not a standard ACCEPT source (standard: DATE, DAY, DAY-OF-WEEK, TIME); it was translated as 'current timestamp' and flagged ambiguous.

**Impact:** The format and content of the timestamp recorded when a process status is updated is not confirmed.

**Recommended action:** Confirm with the development team which compiler extension provides FROM TIME STAMP and the format it returns.

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0014; Statements FIL-0046-STMT-000046

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PRCSEQ00 | 2300-UPDATE-PROCESS-STATUS | 271 | FIL-0046-STMT-000046 | ACCEPT ... FROM TIME STAMP |

**Detected in:** logic_artifact | **Also:** PSEUDOCODE_ISSUE

---

### GAP-235 — RCVPRC00: non-standard ACCEPT WS-CURRENT-TIME FROM TIME STAMP
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** RCVPRC00 | **Paragraph:** 2121-RESTART-PROCESS | **Line:** 207 | **Cause:** analysis | **SME review:** Yes

ACCEPT WS-CURRENT-TIME FROM TIME STAMP (line 207, 2121-RESTART-PROCESS) is recorded verbatim and flagged ambiguous: TIME STAMP is not a standard ACCEPT source (DATE, DAY, DAY-OF-WEEK, TIME); its exact content depends on the compiler.

**Impact:** The format of the restart attempt timestamp is not confirmed.

**Recommended action:** Confirm with the development team which compiler extension provides FROM TIME STAMP and the format it returns.

**Source IDs:** File FIL-0047; Paragraphs FIL-0047-PAR-0012; Statements FIL-0047-STMT-000032

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RCVPRC00 | 2121-RESTART-PROCESS | 207 | FIL-0047-STMT-000032 | ACCEPT ... FROM TIME STAMP |

**Detected in:** logic_artifact | **Also:** PSEUDOCODE_ISSUE

---

### GAP-236 — RPTAUD00: AUDIT-FILE and ERROR-FILE are opened and closed but have no FD
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** RPTAUD00 | **Paragraph:** 1100-OPEN-FILES | **Line:** 94 | **Cause:** source | **SME review:** Yes

OPEN INPUT AUDIT-FILE, OPEN INPUT ERROR-FILE and CLOSE of both files (lines 94, 101, 140) reference files that have SELECT entries (lines 17, 23) but no FD in the source; COPY AUDITLOG and COPY ERRHAND appear in the FILE SECTION before any FD and neither contains an FD, so the copybook records are linked from the FILE section, not as file records. Recorded verbatim, flagged ambiguous. REPORT-FILE has FD at line 38 and record REPORT-RECORD.

**Impact:** The record layouts read from the audit and error files are not confirmed.

**Recommended action:** Confirm with the development team which record layouts belong to AUDIT-FILE and ERROR-FILE and where their FDs are defined.

**Source IDs:** File FIL-0048; Paragraphs FIL-0048-PAR-0003, FIL-0048-PAR-0009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTAUD00 | 1100-OPEN-FILES | 94 |  | AUDIT-FILE |
| RPTAUD00 | 1100-OPEN-FILES | 101 |  | ERROR-FILE |
| RPTAUD00 | 3000-CLEANUP | 140 |  | AUDIT-FILE, ERROR-FILE |

**Detected in:** logic_artifact, parser_artifact, data_artifact | **Also:** 

---

### GAP-237 — RPTPOS00: POSITION-MASTER and TRANSACTION-HISTORY have no inline FD
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** RPTPOS00 | **Line:** 35 | **Cause:** source | **SME review:** Yes

SELECT POSITION-MASTER and TRANSACTION-HISTORY have no inline FD; the FILE SECTION has COPY POSREC (line 35) and COPY TRNREC (line 36) directly under it before any FD; records POSITION-RECORD and TRANSACTION-RECORD are linked by EXPANDS_COPY from section SYS-PORTFOLIO-001-FIL-0049-SEC-0002 with no fd_name.

**Impact:** The association of the position and transaction record layouts with their files is assumed from COPY placement, not declared.

**Recommended action:** Confirm with the development team that POSREC and TRNREC are the record layouts of POSITION-MASTER and TRANSACTION-HISTORY.

**Source IDs:** File FIL-0049

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTPOS00 |  | 35 |  | POSITION-MASTER |
| RPTPOS00 |  | 36 |  | TRANSACTION-HISTORY |

**Detected in:** parser_artifact, data_artifact, logic_artifact | **Also:** 

---

### GAP-238 — RPTSTA00: DB2-STATS and BATCH-STATS have SELECT entries but no FD
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** RPTSTA00 | **Line:** 35 | **Cause:** source | **SME review:** Yes

COPY DB2STAT and COPY BCHCTL appear directly under the FILE SECTION with no FD (lines 35, 36); files DB2-STATS and BATCH-STATS have no FD in this source. BCHCTL contains no FD; the BCHCTL record is linked by EXPANDS_COPY from the FILE section SYS-PORTFOLIO-001-FIL-0050-SEC-0002 with no fd_name.

**Impact:** The record layouts read from the two statistics files are not confirmed.

**Recommended action:** Confirm with the development team which record layouts belong to DB2-STATS and BATCH-STATS and where their FDs are defined.

**Source IDs:** File FIL-0050

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RPTSTA00 |  | 35 |  | DB2-STATS |
| RPTSTA00 |  | 36 |  | BATCH-STATS |

**Related:** Gaps: GAP-005

**Detected in:** parser_artifact, data_artifact, logic_artifact | **Also:** 

---

### GAP-239 — SECMGR: SELECT COUNT(*) INTO the SQLCA holder group WS-DB2-AREA
**Type:** UNSUPPORTED_CONSTRUCT | **Program:** SECMGR | **Paragraph:** P200-CHECK-AUTH | **Line:** 81 | **Cause:** source | **SME review:** Yes

In P200-CHECK-AUTH, SELECT COUNT(*) INTO :WS-DB2-AREA (statement STMT-000006; trace_issues gives line 81, the annotation line 79) uses the 01 group that holds the SQLCA copybook content (SQL-STATUS-CODES, 35 bytes of SQLSTATE constants) as the host variable, and IF WS-DB2-AREA > 0 (line 90, STMT-000022) compares it with 0. Agent 4 recorded both verbatim and flagged them ambiguous: the effective numeric comparison cannot be determined from the declarations.

**Impact:** The authorisation decision of SECMGR (access granted when the count is greater than zero) rests on a comparison whose effect is undetermined.

**Recommended action:** Confirm with the development team or DBA which host variable receives the COUNT(*) and how the authorisation test is meant to work.

**Source IDs:** File FIL-0066; Paragraphs FIL-0066-PAR-0004; Statements FIL-0066-STMT-000006, FIL-0066-STMT-000022; Records FIL-0066-REC-0001

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| SECMGR | P200-CHECK-AUTH | 81 | FIL-0066-STMT-000006 | WS-DB2-AREA (host variable) |
| SECMGR | P200-CHECK-AUTH | 90 | FIL-0066-STMT-000022 | IF WS-DB2-AREA > 0 |

**Related:** Rules: BR-062

**Detected in:** logic_artifact | **Also:** 

---

## Low severity gaps

### GAP-240 — Agent 2 found 8 dead-code candidate paragraphs in 5 programs
**Type:** DEAD_CODE | **Program:** system-wide | **Cause:** analysis | **SME review:** Yes

parser_artifact.stats.total_dead_code_candidates is 8: paragraphs with no incoming PERFORM/GO TO/THRU-range edge that are not entry points. INQPORT P999-ERROR-ROUTINE and P999-EXIT (Agent 2 notes they are named by EXEC CICS HANDLE CONDITION, which is not a CFG edge); PORTMSTR 2100-HANDLE-VSAM-ERROR (lines 243-267); PORTTRAN 2200-UPDATE-POSITIONS (lines 167-181); FILEHNDL (template) 2100-READ-VSAM, 2200-WRITE-VSAM, 2300-READ-SEQUENTIAL (lines 113-147); PROGNAME (template) 9000-HANDLE-ERROR (lines 87-90). These are candidates only; confirmation or refutation is Agent 4's (per-program logic gaps).

**Impact:** Unreachable code may represent retired functionality; rules found in it (e.g. BR-078 to BR-080 in PORTTRAN 2200-UPDATE-POSITIONS, per the Agent 6 limitations) may not be active.

**Recommended action:** Confirm with development team whether the code is intentionally retired or accidentally unreachable.

**Source IDs:** Paragraphs FIL-0065-PAR-0010, FIL-0065-PAR-0011, FIL-0069-PAR-0010, FIL-0072-PAR-0008, FIL-0082-PAR-0004, FIL-0082-PAR-0005, FIL-0082-PAR-0006, FIL-0083-PAR-0005

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQPORT | P999-ERROR-ROUTINE | 103 |  |  |
| INQPORT | P999-EXIT | 109 |  |  |
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 243 |  |  |
| PORTTRAN | 2200-UPDATE-POSITIONS | 167 |  |  |
| FILEHNDL | 2100-READ-VSAM | 113 |  |  |
| FILEHNDL | 2200-WRITE-VSAM | 129 |  |  |
| FILEHNDL | 2300-READ-SEQUENTIAL | 139 |  |  |
| PROGNAME | 9000-HANDLE-ERROR | 87 |  |  |

**Related:** Rules: BR-078, BR-079, BR-080 | Gaps: GAP-253, GAP-274 | Diagrams: FLOW-INQPORT, FLOW-PORTMSTR, FLOW-PORTTRAN-PART3, FLOW-FILEHNDL, FLOW-PROGNAME

**Detected in:** parser_artifact, diagrams_artifact | **Also:** 

---

### GAP-241 — Six copybooks are used by no program (COMMON, ERRLOG, PORTPLAN, POSHIST, RTNCODES, DB2-DEFINITIONS)
**Type:** DEAD_CODE | **Program:** system-wide | **Cause:** source | **SME review:** No

The inventory copybook_map lists COMMON, ERRLOG, PORTPLAN, POSHIST, RTNCODES and DB2-DEFINITIONS with no using program. Agent 3 confirms for COMMON: it has no users in the copybook_map and no SQL_INCLUDE edges; its fields are marked shared_level 'local'.

**Impact:** These definitions may represent retired or externally used structures; they do not take part in any traced program.

**Recommended action:** Confirm with development team whether the code is intentionally retired or accidentally unreachable.

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

**Detected in:** inventory_artifact, data_artifact | **Also:** 

---

### GAP-242 — FILEHNDL: template paragraphs 2100-READ-VSAM, 2200-WRITE-VSAM, 2300-READ-SEQUENTIAL are unreachable
**Type:** DEAD_CODE_CONFIRMED | **Program:** FILEHNDL | **Paragraph:** 2100-READ-VSAM | **Line:** 113 | **Cause:** source | **SME review:** No

Agent 4 searched the source for PERFORM / GO TO / THRU references to each name and found none. PERFORM 2000-PROCESS covers only lines 109-112 (comment-only paragraph) and does not fall through into 2100-READ-VSAM; 0000-MAIN ends with GOBACK. Dead code confirmed (template examples).

**Impact:** Unreachable template example code; the program performs no file processing in 2000-PROCESS.

**Recommended action:** Confirm with development team whether the code is intentionally retired or accidentally unreachable.

**Source IDs:** File FIL-0082; Paragraphs FIL-0082-PAR-0004, FIL-0082-PAR-0005, FIL-0082-PAR-0006

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| FILEHNDL | 2100-READ-VSAM | 113 |  | 2100-READ-VSAM |
| FILEHNDL | 2200-WRITE-VSAM | 129 |  | 2200-WRITE-VSAM |
| FILEHNDL | 2300-READ-SEQUENTIAL | 139 |  | 2300-READ-SEQUENTIAL |

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-243 — PORTMSTR: paragraph 2100-HANDLE-VSAM-ERROR is unreachable
**Type:** DEAD_CODE_CONFIRMED | **Program:** PORTMSTR | **Paragraph:** 2100-HANDLE-VSAM-ERROR | **Line:** 243 | **Cause:** source | **SME review:** No

Agent 4 confirms the Agent 2 dead-code candidate 2100-HANDLE-VSAM-ERROR (PAR-0010, line 243): a source search for PERFORM / GO TO / THRU finds only the paragraph header; it follows 9000-ERROR, which ends with GOBACK, so it is not reached by fall-through either. Its header comment (lines 240-242) calls it an 'Example error handling call'.

**Impact:** Unreachable code; may represent retired or example functionality.

**Recommended action:** Confirm with development team whether the code is intentionally retired or accidentally unreachable.

**Source IDs:** File FIL-0069; Paragraphs FIL-0069-PAR-0010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTMSTR | 2100-HANDLE-VSAM-ERROR | 243 |  | 2100-HANDLE-VSAM-ERROR |

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-244 — PORTTRAN: 2200-UPDATE-POSITIONS is dead; its six callees are unreachable
**Type:** DEAD_CODE_CONFIRMED | **Program:** PORTTRAN | **Paragraph:** 2200-UPDATE-POSITIONS | **Line:** 167 | **Cause:** source | **SME review:** Yes

2200-UPDATE-POSITIONS (PAR-0008, lines 167-181) is confirmed dead code: a source search for PERFORM / GO TO / THRU finds only its header at line 167. Agent 4 additionally reports, for SME review and without reclassifying them, that 2210-PROCESS-BUY, 2220-PROCESS-SELL, 2230-PROCESS-TRANSFER, 2240-PROCESS-FEE, 2300-UPDATE-AUDIT-TRAIL and 2310-WRITE-AUDIT-RECORD are performed only from 2200-UPDATE-POSITIONS (or 2310 from 2300) and so are not reached from 0000-MAIN. As a result PORTTRAN only validates and counts transactions; buys, sells, fees, transfer rejection and the AUDPROC audit are never applied.

**Impact:** The position-update and audit functionality of PORTTRAN is never executed; it may be retired or accidentally disconnected.

**Recommended action:** Confirm with development team whether the code is intentionally retired or accidentally unreachable.

**Source IDs:** File FIL-0072; Paragraphs FIL-0072-PAR-0008, FIL-0072-PAR-0009, FIL-0072-PAR-0010, FIL-0072-PAR-0012, FIL-0072-PAR-0013, FIL-0072-PAR-0014, FIL-0072-PAR-0011; Statements FIL-0072-STMT-000024, FIL-0072-STMT-000027, FIL-0072-STMT-000030, FIL-0072-STMT-000032, FIL-0072-STMT-000033, FIL-0072-STMT-000036, FIL-0072-STMT-000040, FIL-0072-STMT-000042, FIL-0072-STMT-000048, FIL-0072-STMT-000049, FIL-0072-STMT-000056; Fields FIL-0014-FLD-000008, FIL-0014-FLD-000013

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTTRAN | 2200-UPDATE-POSITIONS | 168 | FIL-0072-STMT-000024 |  |
| PORTTRAN | 2210-PROCESS-BUY | 184 | FIL-0072-STMT-000027 |  |
| PORTTRAN | 2220-PROCESS-SELL | 210 | FIL-0072-STMT-000033 |  |
| PORTTRAN | 2240-PROCESS-FEE | 233 | FIL-0072-STMT-000040 |  |
| PORTTRAN | 2300-UPDATE-AUDIT-TRAIL | 257 | FIL-0072-STMT-000048 |  |
| PORTTRAN | 2310-WRITE-AUDIT-RECORD | 296 | FIL-0072-STMT-000056 |  |
| PORTTRAN | 2200-UPDATE-POSITIONS | 167 |  | dead_code_confirmed |
| PORTTRAN | 2210-PROCESS-BUY | 182 |  | unreachable_via_dead_code |
| PORTTRAN | 2220-PROCESS-SELL | 201 |  | unreachable_via_dead_code |
| PORTTRAN | 2230-PROCESS-TRANSFER | 226 |  | unreachable_via_dead_code |
| PORTTRAN | 2240-PROCESS-FEE | 231 |  | unreachable_via_dead_code |
| PORTTRAN | 2300-UPDATE-AUDIT-TRAIL | 249 |  | unreachable_via_dead_code |
| PORTTRAN | 2310-WRITE-AUDIT-RECORD | 292 |  | unreachable_via_dead_code |

**Related:** Rules: BR-078, BR-079, BR-080

**Detected in:** rules_artifact, logic_artifact, parser_artifact | **Also:** 

---

### GAP-245 — PROGNAME: 9000-HANDLE-ERROR is unreachable
**Type:** DEAD_CODE_CONFIRMED | **Program:** PROGNAME | **Paragraph:** 9000-HANDLE-ERROR | **Line:** 87 | **Cause:** source | **SME review:** No

A source search for PERFORM / GO TO / THRU 9000-HANDLE-ERROR (PAR-0005) finds only the paragraph header at line 87; the paragraph is last in the program and is not reached by fall-through (control returns from 3000-TERMINATE to the PERFORM at line 59). It would set the return code to WS-ERROR (8). PROGNAME is a program template (src/templates).

**Impact:** Unreachable template error routine; no error conditions are handled at run time.

**Recommended action:** Confirm with development team whether the code is intentionally retired or accidentally unreachable.

**Source IDs:** File FIL-0083; Paragraphs FIL-0083-PAR-0005

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PROGNAME | 9000-HANDLE-ERROR | 87 |  | 9000-HANDLE-ERROR |

**Detected in:** logic_artifact, parser_artifact | **Also:** 

---

### GAP-246 — Diagram index metadata inconsistencies (audit D-1, D-4, D-5, D-6)
**Type:** DIAGRAM_INCOMPLETE | **Program:** system-wide | **Cause:** display | **SME review:** No

The Agent 6 audit lists four minor or cosmetic metadata defects in diagrams_artifact.json. They do not affect accuracy: no relationship, ID or rule flag is changed. D-1: rules_annotated means different things across batches (7 entries differ, e.g. FLOW-UTLVAL00 has rules_annotated [] but rule_annotations [BR-095, BR-141]); rule placement must be read from rule_annotations[].placement. D-4: FLOW-DB2RECV node_count is 20 but 19 nodes are drawn and listed in node_sources. D-5: about 34 flow label segments and 9 overview labels exceed the 50-character label guideline (longest: the RPTSTA00 grouped placeholder, 93), kept long so every missing name stays visible. D-6: in FLOW-RCVPRC00 five edges skip the collapsed 1000, 2100 and 3000 paragraphs; verified correct but not labelled as shortcuts.

**Impact:** None on the accuracy of the BRD, provided rule placement is taken from rule_annotations[].placement and node counts are not quoted from the index for FLOW-DB2RECV.

**Recommended action:** Optional, non-blocking (audit section 9): standardise rules_annotated or document use of rule_annotations[].placement; set FLOW-DB2RECV node_count to 19.

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

**Related:** Rules: BR-095, BR-141 | Diagrams: FLOW-UTLVAL00, FLOW-UTLMON00, FLOW-PORTTRAN, FLOW-DB2RECV, FLOW-RPTSTA00, COMP-OVERVIEW, FLOW-RCVPRC00

**Detected in:** agent6_quality_audit | **Also:** 

---

### GAP-247 — Entity-relationship diagram is incomplete (20-entity limit; 25 relationships not drawn)
**Type:** DIAGRAM_INCOMPLETE | **Program:** system-wide | **Cause:** display | **SME review:** No

erd.mmd has incomplete true. Of 65 entities, 20 are drawn: the reference harness filter yields 24, and the 4 used-by-3+ entities with fewest programs (BATCH-CONTROL-RECORD, DB2-ERROR-HANDLING, BATCH-CONTROL-CONSTANTS, AUDIT-RECORD) were omitted; 41 further entities are isolated low-usage. 25 COPY_EXPANSION relationships (REL-005 to REL-029) start from program working-storage records that are not data_model entities and are listed but not drawn. TSTGEN00_PORTFOLIO_RECORD and TSTGEN00_TRANSACTION_RECORD have field_count 0 and are drawn with no attributes. Cardinalities are the skill defaults, not derived from data; entities without key-suffix fields use their first field as implied PK.

**Impact:** Display limitation; the full model is in data_artifact.data_model. Cardinalities and implied keys in the picture are not findings.

**Recommended action:** Use data_artifact.data_model for the full entity list and relationships; state in the BRD that cardinalities are defaults.

**Related:** Gaps: GAP-223 | Diagrams: ERD-MAIN

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-248 — System component overview is incomplete (20-node limit; external calls and includes not drawn)
**Type:** DIAGRAM_INCOMPLETE | **Program:** system-wide | **Cause:** display | **SME review:** No

component_overview.mmd has incomplete true. With the 20-node cap, 23 programs and 2 unresolved external call targets (ILBOABN0 from UTLMON00, CEE3ABD from ERRHANDL) are summarised in an OMITTED node; the edges PRCSEQ00 -> ERRPROC, UTLMON00 -> ILBOABN0 and ERRHANDL -> CEE3ABD are not drawn in any component diagram. COPY and SQL_INCLUDE edges (89 + 10) are not shown in the overview (they appear in per-program diagrams), and the 15 JCL jobs and program-file accesses are not drawn. The unresolved DB2CONN -> DELAY call is drawn as '? unresolved'.

**Impact:** Mainly a display limitation; the full call topology is in the inventory call_graph. The unresolved external calls are separate source gaps.

**Recommended action:** Use the inventory call_graph and jcl_registry for the complete topology; no diagram change needed for accuracy.

**Related:** Gaps: GAP-158, GAP-159, GAP-160 | Diagrams: COMP-OVERVIEW

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-249 — BCHCTL00 process flow is incomplete: eleven performed paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** BCHCTL00 | **Cause:** source | **SME review:** No

flow_BCHCTL00.mmd has incomplete true. 11 PERFORM targets are not present in the source; the work of 1000, 2000, 3000 and 4000 (BATCH-CONTROL-FILE I/O) is unknown. The missing targets are shown as 4 placeholder nodes grouped by performing paragraph, one dotted '?' edge per missing PERFORM. WS-PREREQ-MET has no VALUE clause and is not set by any statement present, so the prerequisite outcome cannot be determined statically.

**Impact:** The batch-control processing of BCHCTL00 is unknown.

**Recommended action:** Resolve the root-cause gap paths:BCHCTL00.

**Source IDs:** File FIL-0042

**Related:** Gaps: GAP-144 | Diagrams: FLOW-BCHCTL00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-250 — CURSMGR process flow is incomplete: source cut off at line 91
**Type:** DIAGRAM_INCOMPLETE | **Program:** CURSMGR | **Cause:** source | **SME review:** No

flow_CURSMGR.mmd has incomplete true. The source is truncated at line 91: P300-FETCH-DATA, P300-EXIT, P400-CLOSE-CURSOR and P400-EXIT are not in the source, so the fetch and close paths end at unresolved placeholders. The cursor name and SQL statement are caller host variables (dynamic SQL), so the query is unknown statically; SQLCODE has no Field ID.

**Impact:** The fetch and close behaviour of the cursor manager is unknown.

**Recommended action:** Resolve the root-cause gap paths:CURSMGR (obtain the complete source).

**Source IDs:** File FIL-0059

**Related:** Gaps: GAP-145 | Diagrams: FLOW-CURSMGR

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-251 — DB2HNDL process flow is incomplete: 2310-PROCESS-CURSOR-ROW is not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** DB2HNDL | **Cause:** source | **SME review:** No

flow_DB2HNDL.mmd has incomplete true; incomplete_reason: 'Contains an unsupported edge to PERFORM target 2310-PROCESS-CURSOR-ROW, which is not in the source.' Per-row cursor processing is unknown and shown as a placeholder without Paragraph ID.

**Impact:** What the DB2 template does with each fetched row is unknown.

**Recommended action:** Resolve the root-cause gap paths:DB2HNDL.

**Source IDs:** File FIL-0080

**Related:** Gaps: GAP-146 | Diagrams: FLOW-DB2HNDL

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-252 — ERRHANDL process flow is incomplete: termination after CALL CEE3ABD is uncertain
**Type:** DIAGRAM_INCOMPLETE | **Program:** ERRHANDL | **Cause:** source | **SME review:** No

flow_ERRHANDL.mmd has incomplete true. CALL CEE3ABD is an unresolved external call; whether 3000-TERMINATE and GOBACK are reached depends on that service, so the edge into termination is drawn uncertain. 8000-CHECK-FINAL-STATUS is represented by its first decision node to stay within 20 nodes.

**Impact:** The end of the error-handling template's flow is not established.

**Recommended action:** Resolve the root-cause gap call:ERRHANDL>CEE3ABD.

**Source IDs:** File FIL-0081

**Related:** Gaps: GAP-159 | Diagrams: FLOW-ERRHANDL

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-253 — FILEHNDL process flow is incomplete (two paragraphs missing; recursive cycle)
**Type:** DIAGRAM_INCOMPLETE | **Program:** FILEHNDL | **Cause:** source | **SME review:** No

flow_FILEHNDL.mmd has incomplete true. 2110-PROCESS-VSAM-RECORD and 2310-PROCESS-INPUT-RECORD are not in the source (reached only from dead code); the internal INVALID KEY / AT END branches of the three dead-code paragraphs are not drawn; a recursive PERFORM cycle (3000-TERMINATE, 9000-CHECK-FILE-STATUS, 9100-VSAM-ERROR / 9200-SEQ-ERROR) has undefined behaviour and is drawn as dotted self-edges with tracing stopped; file-status outcomes have partial evidence.

**Impact:** Parts of the file-handling template cannot be shown; most of the missing part is reachable only from dead code.

**Recommended action:** Resolve the root-cause gap paths:FILEHNDL.

**Source IDs:** File FIL-0082

**Related:** Gaps: GAP-147, GAP-240 | Diagrams: FLOW-FILEHNDL

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-254 — HISTLD00 process flow is incomplete: DB2 connect / error / disconnect steps are copybook procedure code
**Type:** DIAGRAM_INCOMPLETE | **Program:** HISTLD00 | **Cause:** analysis | **SME review:** No

flow_HISTLD00.mmd has incomplete true. Three PERFORM targets (CONNECT-TO-DB2, DB2-ERROR-ROUTINE, DISCONNECT-FROM-DB2) are procedure code in copybook DBPROC and are not registered for this program; they are shown as '?' placeholders. Several conditions (MORE-RECORDS, INSERT SQLCODE checks, commit threshold, checkpoint REWRITE) have partial evidence; SQLCODE, the 13 TH-* mapping fields, BCT-RECORDS-READ and BCT-RECORDS-WRITTEN have no Field ID.

**Impact:** The DB2 connection and error handling of the history load is not shown.

**Recommended action:** Resolve the root-cause gaps copyproc:DBPROC and paths:HISTLD00.

**Source IDs:** File FIL-0044

**Related:** Gaps: GAP-148, GAP-222 | Diagrams: FLOW-HISTLD00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-255 — INQHIST process flow is incomplete: tracing stopped at the recursive PERFORM
**Type:** DIAGRAM_INCOMPLETE | **Program:** INQHIST | **Paragraph:** P150-DB2-CONNECT | **Line:** 114 | **Cause:** analysis | **SME review:** No

flow_INQHIST.mmd has incomplete true; incomplete_reason: 'Steps after the recursive PERFORM (STMT-000043) are omitted because Agent 4 stopped tracing.' After a run-time ERROR transfer into P999-ERROR-ROUTINE there is no return point, and that continuation is not traced. Unresolved names (WS-DB2-TOKEN, SQLCODE, and two invalid qualifications OF WS-COMMAREA) are shown without Field ID.

**Impact:** What INQHIST does after a successful DB2 reconnection and after a run-time error is not established.

**Recommended action:** Resolve the root-cause gap paths:INQHIST (recursive PERFORM) and the run-time handler gap.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0004; Statements FIL-0063-STMT-000043

**Related:** Gaps: GAP-149, GAP-169 | Diagrams: FLOW-INQHIST

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-256 — INQHIST sequence diagram is incomplete (missing CURSMGR paragraphs, recursion, run-time handler)
**Type:** DIAGRAM_INCOMPLETE | **Program:** INQHIST | **Cause:** source | **SME review:** No

sequence_INQHIST.mmd has incomplete true. The CICS HANDLE CONDITION ERROR handler (P999, PAR-0012) is a run-time transfer shown only as a 'runtime:' note; the recursive PERFORM of P150-DB2-CONNECT is shown as 'uncertain: recursive PERFORM - tracing stopped' with nothing after it; CURSMGR's source is truncated (P300-FETCH-DATA and P400-CLOSE-CURSOR missing), so the fetch and close results and the returns after them are unknown; the DB2RECV and CURSMGR dispatch conditions have partial evidence and are drawn uncertain; invalid qualifications and undeclared / precompiler names carry no Field ID.

**Impact:** The end of the online history inquiry flow (fetch/close results, behaviour after recovery and after errors) is not established.

**Recommended action:** Resolve the root-cause gaps (missing CURSMGR paragraphs, INQHIST recursion, run-time handler).

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0012; Statements FIL-0063-STMT-000043

**Related:** Rules: BR-043, BR-047 | Gaps: GAP-145, GAP-149, GAP-169 | Diagrams: SEQ-INQHIST

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-257 — PORTTRAN component diagram is incomplete: copybook PORTREC is missing
**Type:** DIAGRAM_INCOMPLETE | **Program:** PORTTRAN | **Cause:** source | **SME review:** No

component_PORTTRAN.mmd has incomplete true because COPY PORTREC is unresolved: the PORTFOLIO-FILE record layout and its PORT-* fields have no Record/Field IDs.

**Impact:** Reflects a source gap (missing copybook), not a drawing error.

**Recommended action:** Resolve the root-cause gap copy:PORTTRAN:PORTREC.

**Source IDs:** File FIL-0072

**Related:** Gaps: GAP-004 | Diagrams: COMP-PORTTRAN

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-258 — POSUPDT process flow is a 2-node placeholder (empty source file)
**Type:** DIAGRAM_INCOMPLETE | **Program:** POSUPDT | **Cause:** source | **SME review:** No

flow_POSUPDT.mmd has incomplete true. The source file is 1 byte of whitespace (no PROGRAM-ID, divisions or paragraphs); no execution traces, branches, loops or rules exist, so only a minimal START -> TERMINAL placeholder ('? no PROCEDURE DIVISION') is drawn.

**Impact:** Reflects a source gap; nothing about POSUPDT can be shown.

**Recommended action:** Resolve the root-cause gap empty:POSUPDT.

**Source IDs:** File FIL-0045

**Related:** Gaps: GAP-001 | Diagrams: FLOW-POSUPDT

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-259 — RPTAUD00 process flow is incomplete: seven performed paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** RPTAUD00 | **Cause:** source | **SME review:** No

flow_RPTAUD00.mmd has incomplete true. Seven PERFORM targets (2110, 2120, 2210, 2220, 2310, 2320, 2330) are not in the source; reading and summarising audit and error records and all summary output cannot be traced and are drawn only as unsupported placeholders. AUDIT-FILE and ERROR-FILE have SELECT entries but no FD; WS-ERROR-MESSAGE is declared nowhere.

**Impact:** The audit report's content and calculations are unknown.

**Recommended action:** Resolve the root-cause gaps paths:RPTAUD00 and nofd:FILE-SECTION.

**Source IDs:** File FIL-0048

**Related:** Gaps: GAP-150, GAP-224 | Diagrams: FLOW-RPTAUD00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-260 — RPTPOS00 process flow is incomplete: five performed paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** RPTPOS00 | **Cause:** source | **SME review:** No

flow_RPTPOS00.mmd has incomplete true. Five PERFORM targets (2210, 2220, 2310, 2320, 2330) are not in the source; the transaction-activity and summary sections of the report cannot be traced and are drawn only as unsupported placeholders. POSITION-MASTER has no FD; several names (END-OF-POSITIONS, WS-ERROR-MESSAGE, POS-DESCRIPTION, POS-CURRENT-VALUE, POS-PREVIOUS-VALUE) have no Field ID.

**Impact:** The transaction-activity and summary parts of the position report are unknown.

**Recommended action:** Resolve the root-cause gaps paths:RPTPOS00 and nofd:FILE-SECTION.

**Source IDs:** File FIL-0049

**Related:** Gaps: GAP-151, GAP-224 | Diagrams: FLOW-RPTPOS00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-261 — RPTSTA00 process flow is incomplete: seven performed paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** RPTSTA00 | **Cause:** source | **SME review:** No

flow_RPTSTA00.mmd has incomplete true; incomplete_reason: 'Contains unsupported edges to PERFORM targets that are not in the source; loop bodies after them are omitted.' Seven PERFORM targets do not exist in the source, so accumulation, metric calculation and report-section writing cannot be drawn (2310/2320 and 2410/2420/2430 grouped into one placeholder each). Read-loop bodies are not drawn; COPY DB2STAT is unresolved.

**Impact:** The statistics report's accumulation, metrics and section output are unknown.

**Recommended action:** Resolve the root-cause gaps paths:RPTSTA00 and copy:RPTSTA00:DB2STAT.

**Source IDs:** File FIL-0050

**Related:** Gaps: GAP-005, GAP-152 | Diagrams: FLOW-RPTSTA00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-262 — TSTGEN00 process flow is incomplete: eight performed paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** TSTGEN00 | **Cause:** source | **SME review:** No

flow_TSTGEN00.mmd has incomplete true. Eight PERFORM targets of the generators (2210, 2220, 2310, 2320, 2410, 2420, 2510, 2520) are not in the source, so record generation and writing cannot be traced; they are shown as two shared placeholders to stay within 20 nodes. WS-PORT-STATUS and WS-TRAN-STATUS are ambiguous and WS-ERROR-MESSAGE unresolved (no Field ID).

**Impact:** How TSTGEN00 generates and writes test records is unknown.

**Recommended action:** Resolve the root-cause gap paths:TSTGEN00.

**Source IDs:** File FIL-0075

**Related:** Gaps: GAP-153 | Diagrams: FLOW-TSTGEN00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-263 — TSTVAL00 process flow is incomplete: seven performed paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** TSTVAL00 | **Cause:** source | **SME review:** No

flow_TSTVAL00.mmd has incomplete true. Seven PERFORM targets (2200-RUN-FUNCTIONAL-TEST to 2800-WRITE-TEST-DETAIL) are not in the source, so test execution, validation, metric update and detail writing cannot be traced; 2600, 2700 and 2800 share one unresolved placeholder node to stay within 20 nodes.

**Impact:** The test-validation steps of TSTVAL00 are unknown.

**Recommended action:** Resolve the root-cause gap paths:TSTVAL00.

**Source IDs:** File FIL-0076

**Related:** Gaps: GAP-154 | Diagrams: FLOW-TSTVAL00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-264 — UTLMNT00 process flow is incomplete: eleven performed paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** UTLMNT00 | **Cause:** source | **SME review:** No

flow_UTLMNT00.mmd has incomplete true. 11 PERFORM targets are not present in the source; the archive, cleanup, reorganisation and analysis work cannot be traced. The missing targets are shown as 4 placeholder nodes grouped by performing paragraph; open-status checks, function dispatch and error cap have partial evidence and are uncertain.

**Impact:** The maintenance utility's archive, cleanup, reorganisation and analysis steps are unknown.

**Recommended action:** Resolve the root-cause gap paths:UTLMNT00.

**Source IDs:** File FIL-0077

**Related:** Gaps: GAP-155 | Diagrams: FLOW-UTLMNT00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-265 — UTLMON00 process flow (overview) is incomplete: missing paragraphs and external call ILBOABN0
**Type:** DIAGRAM_INCOMPLETE | **Program:** UTLMON00 | **Cause:** source | **SME review:** No

flow_UTLMON00.mmd has incomplete true. 13 PERFORM targets are not in the source (1310 here; the rest in part 2), so configuration storage, metric collection, threshold checks, status logging and alert output cannot be traced; CALL ILBOABN0 targets a program not in the repository; COPY DB2STAT cannot be expanded. Agent 4 warns the monitoring loop UNTIL hour 23 may never terminate.

**Impact:** Most of the monitor's work and the effect of ILBOABN0 are unknown.

**Recommended action:** Resolve the root-cause gaps paths:UTLMON00, call:UTLMON00>ILBOABN0 and copy:UTLMON00:DB2STAT.

**Source IDs:** File FIL-0078

**Related:** Rules: BR-094 | Gaps: GAP-006, GAP-156, GAP-160 | Diagrams: FLOW-UTLMON00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-266 — UTLMON00 process flow (part 2) is incomplete: twelve monitoring paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** UTLMON00 | **Cause:** source | **SME review:** No

flow_UTLMON00_part2.mmd has incomplete true. 12 PERFORM targets of the monitoring-cycle paragraphs are not in the source; their logic cannot be traced. THRESHOLD-MET is tested but never set by any traceable statement.

**Impact:** Metric collection, thresholds, logging and alerts of the monitor are unknown.

**Recommended action:** Resolve the root-cause gap paths:UTLMON00.

**Source IDs:** File FIL-0078

**Related:** Gaps: GAP-156 | Diagrams: FLOW-UTLMON00-PART2

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-267 — UTLVAL00 process flow (overview) is incomplete: eight check paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** UTLVAL00 | **Cause:** source | **SME review:** No

flow_UTLVAL00.mmd has incomplete true. Eight PERFORM targets (2210, 2220, 2310, 2320, 2410, 2420, 2510, 2520) are not in the source, so the actual integrity, cross-reference, format and balance checks cannot be traced; their placeholders are in part 2. Open-status checks and the validation-type EVALUATE have partial evidence and are uncertain.

**Impact:** The validation checks of UTLVAL00 are unknown.

**Recommended action:** Resolve the root-cause gap paths:UTLVAL00.

**Source IDs:** File FIL-0079

**Related:** Gaps: GAP-157 | Diagrams: FLOW-UTLVAL00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-268 — UTLVAL00 process flow (part 2) is incomplete: the eight check paragraphs are not in the source
**Type:** DIAGRAM_INCOMPLETE | **Program:** UTLVAL00 | **Cause:** source | **SME review:** No

flow_UTLVAL00_part2.mmd has incomplete true. The 8 PERFORM targets of the check paragraphs are not in the source; the checks cannot be traced and are drawn as placeholders.

**Impact:** The validation checks of UTLVAL00 are unknown.

**Recommended action:** Resolve the root-cause gap paths:UTLVAL00.

**Source IDs:** File FIL-0079

**Related:** Gaps: GAP-157 | Diagrams: FLOW-UTLVAL00-PART2

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-269 — Process flow of DB2ONLN is shortened: five exit-only paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** DB2ONLN | **Cause:** display | **SME review:** No

flow_DB2ONLN.mmd has truncated true. To stay within 20 nodes, the five exit paragraphs that end the PERFORM ... THRU ranges are collapsed into one SUMMARY node; ERR_SQL is shared by the connect and disconnect failure branches. The collapsed paragraphs contain only EXIT and carry no business rule.

**Impact:** Display limitation only; no business logic is missing. The collapsed Paragraph IDs are kept on the SUMMARY node.

**Recommended action:** No action needed for accuracy; read the collapsed_paragraph_ids on the SUMMARY node or the DB2ONLN logic file for the omitted steps.

**Source IDs:** File FIL-0060

**Related:** Gaps: GAP-213 | Diagrams: FLOW-DB2ONLN

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-270 — Process flow of DB2RECV is shortened: five exit-only paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** DB2RECV | **Cause:** display | **SME review:** No

flow_DB2RECV.mmd has truncated true. The five exit paragraphs of the PERFORM ... THRU ranges are collapsed into one SUMMARY node to stay within 20 nodes. The collapsed paragraphs contain only EXIT and carry no business rule.

**Impact:** Display limitation only; no business logic is missing.

**Recommended action:** No action needed for accuracy; read the collapsed_paragraph_ids on the SUMMARY node or the DB2RECV logic file for the omitted steps.

**Source IDs:** File FIL-0061

**Related:** Gaps: GAP-214 | Diagrams: FLOW-DB2RECV

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-271 — Process flow of HISTLD00 is shortened: four end-of-run paragraphs folded into the Terminate node
**Type:** DIAGRAM_TRUNCATED | **Program:** HISTLD00 | **Cause:** display | **SME review:** No

flow_HISTLD00.mmd has truncated true. 3100-FINAL-COMMIT, 3200-CLOSE-FILES, 3300-DISCONNECT-DB2 and 3400-DISPLAY-STATS are collapsed into the Terminate node; the final checkpoint call 3100 -> 2310 is not drawn. The collapsed Paragraph IDs are listed on that node. (The diagram is also incomplete; see DIAGRAM_INCOMPLETE.)

**Impact:** Display limitation; the final commit and checkpoint step are not visible in the picture.

**Recommended action:** Cite the HISTLD00 logic file for 3100-3400 and the final checkpoint call.

**Source IDs:** File FIL-0044

**Related:** Diagrams: FLOW-HISTLD00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-272 — Process flow of INQHIST is shortened: six exit-only paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** INQHIST | **Cause:** display | **SME review:** No

flow_INQHIST.mmd has truncated true. Six no-op EXIT paragraphs are collapsed into SUMMARY to stay within 20 nodes; the WS-DB2-TOKEN move (STMT-000014) is not drawn as a separate node. (The diagram is also incomplete because of the recursive PERFORM; see DIAGRAM_INCOMPLETE.)

**Impact:** Display limitation only for the collapsed steps.

**Recommended action:** No action needed for accuracy; read the collapsed_paragraph_ids on the SUMMARY node or the INQHIST logic file.

**Source IDs:** File FIL-0063

**Related:** Gaps: GAP-216 | Diagrams: FLOW-INQHIST

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-273 — Process flow of INQONLN is shortened: six exit-only paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** INQONLN | **Cause:** display | **SME review:** No

flow_INQONLN.mmd has truncated true. Six no-op EXIT paragraphs are collapsed into SUMMARY to stay within 20 nodes; the SECMGR LINK statements STMT-000042 and STMT-000045 are carried on edge labels, and the PERFORM of P900 from the security-failure branch (STMT-000036) is folded into terminal node SEC_RETURN.

**Impact:** Display limitation only; no business logic is missing.

**Recommended action:** No action needed for accuracy; read the collapsed_paragraph_ids on the SUMMARY node or the INQONLN logic file.

**Source IDs:** File FIL-0064

**Related:** Gaps: GAP-217 | Diagrams: FLOW-INQONLN

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-274 — Process flow of PORTTRAN is split into three files
**Type:** DIAGRAM_TRUNCATED | **Program:** PORTTRAN | **Cause:** display | **SME review:** No

flow_PORTTRAN.mmd has truncated true: it is split into an overview, part 2 (validation checks with BR-072..BR-077) and part 3 (dead-code region) to respect the 20-node limit. Nothing is dropped. Part 3 shows 2200-UPDATE-POSITIONS (confirmed dead code) and 2210-2310, reached only from it.

**Impact:** Display limitation only; read the three parts together.

**Recommended action:** Present FLOW-PORTTRAN, FLOW-PORTTRAN-PART2 and FLOW-PORTTRAN-PART3 together.

**Source IDs:** File FIL-0072

**Related:** Gaps: GAP-240 | Diagrams: FLOW-PORTTRAN, FLOW-PORTTRAN-PART2, FLOW-PORTTRAN-PART3

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-275 — Process flow of PRCSEQ00 is shortened: six working paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** PRCSEQ00 | **Cause:** display | **SME review:** No

flow_PRCSEQ00.mmd has truncated true. 19 paragraphs exceed the 20-node budget: 1100-OPEN-FILES, 1210-ADD-TO-SEQUENCE, 1300-CREATE-CONTROL-RECORDS, 2300-UPDATE-PROCESS-STATUS, 3100-READ-CONTROL-STATUS and 4200-CLOSE-FILES are collapsed into SUMMARY. Internal IF / INVALID KEY decisions and the six PERFORM loops are summarised in node labels; the PERFORMs of 9000-ERROR-ROUTINE from those branches are not drawn. The audit notes these are substantive paragraphs (not EXIT-only) and that the BRD should cite the logic file for them.

**Impact:** Display limitation; the collapsed internal logic is in the PRCSEQ00 logic file, not in the picture.

**Recommended action:** Cite the PRCSEQ00 logic file for the collapsed paragraphs; optionally add a _part2 detail diagram (audit section 9, item 5).

**Source IDs:** File FIL-0046

**Related:** Diagrams: FLOW-PRCSEQ00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-276 — Process flow of RCVPRC00 is shortened: eight working paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** RCVPRC00 | **Cause:** display | **SME review:** No

flow_RCVPRC00.mmd has truncated true. 18 paragraphs and 9 inline rules exceed the 20-node cap: 8 internal paragraphs (1000, 1100, 2100, 2121, 2122, 2123, 3000, 3200) are collapsed into SUMMARY; edges that pass through them are labelled with what the collapsed step does; BR-022/BR-023 and BR-025/BR-026 share one rule node each. Error performs from collapsed paragraphs are not drawn. The audit verified that five edges jumping over collapsed paragraphs are correct but not labelled as shortcuts (D-6).

**Impact:** Display limitation; the collapsed internal logic is in the RCVPRC00 logic file. No collapsed paragraph carries a business rule.

**Recommended action:** Cite the RCVPRC00 logic file for the collapsed paragraphs; optionally add a _part2 detail diagram (audit section 9, item 5).

**Source IDs:** File FIL-0047

**Related:** Diagrams: FLOW-RCVPRC00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-277 — Process flow of RTNANA00 is shortened: six exit-only paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** RTNANA00 | **Cause:** display | **SME review:** No

flow_RTNANA00.mmd has truncated true. The six EXIT paragraphs of the PERFORM ... THRU ranges are collapsed into SUMMARY (they contain only EXIT).

**Impact:** Display limitation only; no business logic is missing.

**Recommended action:** No action needed for accuracy; read the collapsed_paragraph_ids on the SUMMARY node or the RTNANA00 logic file for the omitted steps.

**Source IDs:** File FIL-0051

**Related:** Gaps: GAP-219 | Diagrams: FLOW-RTNANA00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-278 — Process flow of RTNCDE00 is shortened: five exit-only paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** RTNCDE00 | **Cause:** display | **SME review:** No

flow_RTNCDE00.mmd has truncated true. The five PERFORM ... THRU ranges each end in an EXIT-only paragraph; these five paragraphs are collapsed into one SUMMARY node (SUMMARY_EXIT), with 11 edges to the shared exit matching the THRU ranges.

**Impact:** Display limitation only; no business logic is missing.

**Recommended action:** No action needed for accuracy; the collapsed Paragraph IDs are listed in collapsed_paragraph_ids.

**Source IDs:** File FIL-0052

**Related:** Gaps: GAP-220 | Diagrams: FLOW-RTNCDE00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-279 — Process flow of TSTGEN00 is shortened: two initialisation paragraphs shown as one summary box
**Type:** DIAGRAM_TRUNCATED | **Program:** TSTGEN00 | **Cause:** display | **SME review:** No

flow_TSTGEN00.mmd has truncated true. 1200-INIT-RANDOM and 1300-INIT-COUNTERS are collapsed into SUMMARY; the four file-status IFs of 1100-OPEN-FILES are drawn as one decision (DEC_OPEN). The audit finds the 3 edges into and out of SUMMARY source-supported and no rule on the collapsed paragraphs. (The diagram is also incomplete for missing source; see the DIAGRAM_INCOMPLETE candidate.)

**Impact:** Display limitation only for the collapsed steps.

**Recommended action:** No action needed for accuracy; read the collapsed_paragraph_ids on the SUMMARY node or the TSTGEN00 logic file for the omitted steps.

**Source IDs:** File FIL-0075

**Related:** Diagrams: FLOW-TSTGEN00

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-280 — Process flow of UTLMON00 is split into two files
**Type:** DIAGRAM_TRUNCATED | **Program:** UTLMON00 | **Cause:** display | **SME review:** No

flow_UTLMON00.mmd has truncated true: it is split into an overview and flow_UTLMON00_part2.mmd to respect the 20-node limit (missing PERFORM targets must each be drawn). Nothing is dropped; 1200-INIT-PROCESSING is drawn twice (initial and end-of-cycle call), both carrying its Paragraph ID.

**Impact:** Display limitation only; read both parts together.

**Recommended action:** Present FLOW-UTLMON00 and FLOW-UTLMON00-PART2 together.

**Source IDs:** File FIL-0078

**Related:** Gaps: GAP-156 | Diagrams: FLOW-UTLMON00, FLOW-UTLMON00-PART2

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-281 — Process flow of UTLVAL00 is split into two files
**Type:** DIAGRAM_TRUNCATED | **Program:** UTLVAL00 | **Cause:** display | **SME review:** No

flow_UTLVAL00.mmd has truncated true: it is split into an overview and flow_UTLVAL00_part2.mmd to respect MAX_NODES_PER_DIAGRAM = 20. Nothing is dropped; the placeholders for the 8 missing PERFORM targets are in part 2.

**Impact:** Display limitation only; read both parts together.

**Recommended action:** Present FLOW-UTLVAL00 and FLOW-UTLVAL00-PART2 together.

**Source IDs:** File FIL-0079

**Related:** Gaps: GAP-157 | Diagrams: FLOW-UTLVAL00, FLOW-UTLVAL00-PART2

**Detected in:** diagrams_artifact, agent6_quality_audit | **Also:** 

---

### GAP-282 — BR-044 Derive cursor fetch array size from the array-fetch indicator — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** CURSMGR | **Paragraph:** P100-DECLARE-CURSOR | **Line:** 64 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Derive cursor fetch array size from the array-fetch indicator. When the caller requests array fetch (CURS-ARRAY-FETCH = 'Y'), the fetch array size is set to the maximum number of rows (WS-MAX-ROWS); otherwise it is set to 1 (single-row fetch). Implemented in program CURSMGR, paragraph P100-DECLARE-CURSOR.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0059; Paragraphs FIL-0059-PAR-0002; Statements FIL-0059-STMT-000004; Fields FIL-0059-FLD-000013, FIL-0059-FLD-000014

**Related:** Rules: BR-043, BR-044

**Detected in:** rules_artifact | **Also:** 

---

### GAP-283 — BR-037 Require an active connection before disconnecting — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** DB2CONN | **Paragraph:** 2000-DISCONNECT | **Line:** 110 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Require an active connection before disconnecting. On a disconnect request the system commits the work and resets the connection only when its connection flag shows it is connected; otherwise nothing is done. Implemented in program DB2CONN, paragraph 2000-DISCONNECT.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0055; Paragraphs FIL-0055-PAR-0004; Statements FIL-0055-STMT-000011; Fields FIL-0055-FLD-000001

**Related:** Rules: BR-037

**Detected in:** rules_artifact | **Also:** 

---

### GAP-284 — BR-040 Classify DB2 error severity and retry eligibility by SQLCODE — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** DB2ERR | **Paragraph:** 1100-SET-SEVERITY | **Line:** 101 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Classify DB2 error severity and retry eligibility by SQLCODE. When logging a DB2 error the system sets the severity and the retry flag from the SQLCODE: deadlock (-911) and timeout (-913) get severity 2 and are marked retryable; connection error (-30081) gets severity 4; duplicate key (-803) and not found (+100) get severity 1; any other negative code gets severity 3 and any other non-negative code severity 1. Only deadlock and timeout are retryable. Implemented in program DB2ERR, paragraph 1100-SET-SEVERITY.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0056; Paragraphs FIL-0056-PAR-0003; Statements FIL-0056-STMT-000017; Fields FIL-0056-FLD-000012

**Related:** Rules: BR-040, BR-041

**Detected in:** rules_artifact | **Also:** 

---

### GAP-285 — BR-041 Handle DB2 error diagnosis with message and return code by SQLCODE — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** DB2ERR | **Paragraph:** 2000-DIAGNOSE-ERROR | **Line:** 141 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Handle DB2 error diagnosis with message and return code by SQLCODE. On a diagnosis request the system returns: deadlock (-911) 'Deadlock detected - retry transaction' with return code 4; timeout (-913) 'Timeout occurred - retry transaction' with 4; connection error (-30081) 'DB2 connection error - check availability' with 12; duplicate key (-803) 'Duplicate key violation' with 8; any other negative code 'Unhandled DB2 error' with 12; any other non-negative code 'DB2 warning condition' with 4. Implemented in program DB2ERR, paragraph 2000-DIAGNOSE-ERROR.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0056; Paragraphs FIL-0056-PAR-0005; Statements FIL-0056-STMT-000020; Fields FIL-0056-FLD-000012

**Related:** Rules: BR-040, BR-041

**Detected in:** rules_artifact | **Also:** 

---

### GAP-286 — BR-096 Derive final return code 12 when any severe error was counted — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** ERRHANDL | **Paragraph:** 8000-CHECK-FINAL-STATUS | **Line:** 109 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Derive final return code 12 when any severe error was counted. At the final status check, when the severe-error count is greater than zero the program's return code is 12; otherwise the error count is checked. This template paragraph runs only if the preceding CALL 'CEE3ABD' returns (flagged upstream). Implemented in program ERRHANDL, paragraph 8000-CHECK-FINAL-STATUS.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0081; Paragraphs FIL-0081-PAR-0005; Statements FIL-0081-STMT-000013; Fields FIL-0081-FLD-000020

**Related:** Rules: BR-096, BR-097, BR-098

**Detected in:** rules_artifact | **Also:** 

---

### GAP-287 — BR-097 Derive final return code 8 when errors but no severe errors were counted — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** ERRHANDL | **Paragraph:** 8000-CHECK-FINAL-STATUS | **Line:** 112 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Derive final return code 8 when errors but no severe errors were counted. With no severe errors, when the error count is greater than zero the return code is 8; otherwise the warning count is checked. Implemented in program ERRHANDL, paragraph 8000-CHECK-FINAL-STATUS.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0081; Paragraphs FIL-0081-PAR-0005; Statements FIL-0081-STMT-000041; Fields FIL-0081-FLD-000019

**Related:** Rules: BR-096, BR-097, BR-098

**Detected in:** rules_artifact | **Also:** 

---

### GAP-288 — BR-098 Derive final return code 4 for warnings only, otherwise 0 — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** ERRHANDL | **Paragraph:** 8000-CHECK-FINAL-STATUS | **Line:** 115 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Derive final return code 4 for warnings only, otherwise 0. With no severe errors and no errors, when the warning count is greater than zero the return code is 4; otherwise it is 0. Implemented in program ERRHANDL, paragraph 8000-CHECK-FINAL-STATUS.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0081; Paragraphs FIL-0081-PAR-0005; Statements FIL-0081-STMT-000043; Fields FIL-0081-FLD-000018

**Related:** Rules: BR-096, BR-097, BR-098

**Detected in:** rules_artifact | **Also:** 

---

### GAP-289 — BR-066 Reject portfolio create or update that fails validation — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PORTMSTR | **Paragraph:** 2000-CREATE-PORTFOLIO | **Line:** 122 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Reject portfolio create or update that fails validation. After the portfolio validation (ID format, name, status), when the return code is not success (0) the error routine ends the request with return code 8: on create the record is not written, on update it is not rewritten. Implemented in program PORTMSTR, paragraphs 2000-CREATE-PORTFOLIO and 4000-UPDATE-PORTFOLIO.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0069; Paragraphs FIL-0069-PAR-0003, FIL-0069-PAR-0006; Statements FIL-0069-STMT-000011, FIL-0069-STMT-000024; Fields FIL-0069-FLD-000022, FIL-0069-FLD-000008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTMSTR | 2000-CREATE-PORTFOLIO | 122 | FIL-0069-STMT-000011 |  |
| PORTMSTR | 4000-UPDATE-PORTFOLIO | 190 | FIL-0069-STMT-000024 |  |

**Related:** Rules: BR-063, BR-066, BR-067, BR-068, BR-069

**Detected in:** rules_artifact | **Also:** 

---

### GAP-290 — BR-070 Cap generated test portfolios at 100 written records — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PORTTEST | **Paragraph:** 0000-MAIN | **Line:** 48 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Cap generated test portfolios at 100 written records. The test generator keeps generating and writing portfolio records until the count of successfully written records reaches the maximum (WS-MAX-RECORDS, 100); failed writes are not counted. Implemented in program PORTTEST, paragraph 0000-MAIN.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0071; Paragraphs FIL-0071-PAR-0001; Statements FIL-0071-STMT-000002; Fields FIL-0071-FLD-000002, FIL-0071-FLD-000003

**Related:** Rules: BR-070

**Detected in:** rules_artifact | **Also:** 

---

### GAP-291 — BR-071 Require each transaction check to pass before the next check runs — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PORTTRAN | **Paragraph:** 2100-VALIDATE-TRANSACTION | **Line:** 113 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Require each transaction check to pass before the next check runs. Transaction validation is a chain driven by the error text (ERR-TEXT): the transaction type check runs only when the portfolio check left no error text, the amount checks run only when no earlier check failed, and finally a transaction with no error text is counted as processed while any error is counted and reported through ERRPROC. Implemented in program PORTTRAN, paragraph 2100-VALIDATE-TRANSACTION.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0072; Paragraphs FIL-0072-PAR-0004; Statements FIL-0072-STMT-000016, FIL-0072-STMT-000014, FIL-0072-STMT-000015; Fields FIL-0007-FLD-000017

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PORTTRAN | 2100-VALIDATE-TRANSACTION | 106 | FIL-0072-STMT-000014 |  |
| PORTTRAN | 2100-VALIDATE-TRANSACTION | 109 | FIL-0072-STMT-000015 |  |
| PORTTRAN | 2100-VALIDATE-TRANSACTION | 113 | FIL-0072-STMT-000016 |  |

**Related:** Rules: BR-071, BR-072, BR-073, BR-074, BR-075, BR-076, BR-077, BR-081

**Detected in:** rules_artifact | **Also:** 

---

### GAP-292 — BR-007 Require clean dependency check before starting a process — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PRCSEQ00 | **Paragraph:** 2000-GET-NEXT-PROCESS | **Line:** 103 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Require clean dependency check before starting a process. After finding the next ready process and checking its dependencies, the system marks the process ACTIVE (with its start time, rewriting its control record) only when the return code is still zero. Otherwise the process is not started and the non-zero return code is returned to the caller. Implemented in program PRCSEQ00, paragraph 2000-GET-NEXT-PROCESS.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0003; Statements FIL-0046-STMT-000009; Fields FIL-0046-FLD-000021

**Related:** Rules: BR-007, BR-011

**Detected in:** rules_artifact | **Also:** 

---

### GAP-293 — BR-010 Return no next process when none is ready — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PRCSEQ00 | **Paragraph:** 2100-FIND-NEXT-READY | **Line:** 216 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Return no next process when none is ready. When the scan of the process table passes the last entry without finding a READY process (WS-SEQUENCE-IX greater than WS-PROCESS-COUNT), the system returns a blank next-process name to the caller. Implemented in program PRCSEQ00, paragraph 2100-FIND-NEXT-READY.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0011; Statements FIL-0046-STMT-000034; Fields FIL-0046-FLD-000004, FIL-0046-FLD-000005

**Related:** Rules: BR-009, BR-010

**Detected in:** rules_artifact | **Also:** 

---

### GAP-294 — BR-016 Count active processes in the run sequence — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PRCSEQ00 | **Paragraph:** 3300-CHECK-COMPLETION | **Line:** 312 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Count active processes in the run sequence. For each process table entry whose status is ACTIVE (BCT-STAT-ACTIVE, 'A') the system adds 1 to the active count, which is used to derive the final sequence status. Implemented in program PRCSEQ00, paragraph 3300-CHECK-COMPLETION.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0017; Statements FIL-0046-STMT-000096; Fields FIL-0046-FLD-000011, FIL-0001-FLD-000003

**Related:** Rules: BR-016, BR-017, BR-019

**Detected in:** rules_artifact | **Also:** 

---

### GAP-295 — BR-017 Count processes in error in the run sequence — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PRCSEQ00 | **Paragraph:** 3300-CHECK-COMPLETION | **Line:** 316 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Count processes in error in the run sequence. For each process table entry whose status is ERROR (BCT-STAT-ERROR, 'E') the system adds 1 to the error count, which is used to derive the final sequence status. Implemented in program PRCSEQ00, paragraph 3300-CHECK-COMPLETION.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0017; Statements FIL-0046-STMT-000097; Fields FIL-0046-FLD-000011, FIL-0001-FLD-000006

**Related:** Rules: BR-016, BR-017, BR-018

**Detected in:** rules_artifact | **Also:** 

---

### GAP-296 — BR-018 Detect run sequence ending with processes in error — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PRCSEQ00 | **Paragraph:** 4100-CHECK-FINAL-STATUS | **Line:** 325 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Detect run sequence ending with processes in error. At termination, when any process in the sequence is in error (error count greater than zero), the system sets the error return code (8) for the sequence. Otherwise the active-process check decides between warning and success. Implemented in program PRCSEQ00, paragraph 4100-CHECK-FINAL-STATUS.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0018; Statements FIL-0046-STMT-000056; Fields FIL-0046-FLD-000007

**Related:** Rules: BR-017, BR-018, BR-019

**Detected in:** rules_artifact | **Also:** 

---

### GAP-297 — BR-019 Return warning when processes are still active at sequence end — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** PRCSEQ00 | **Paragraph:** 4100-CHECK-FINAL-STATUS | **Line:** 328 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Return warning when processes are still active at sequence end. When no process is in error but at least one process is still active, the system sets the warning return code (4) for the sequence; otherwise the sequence ends with success (0). Implemented in program PRCSEQ00, paragraph 4100-CHECK-FINAL-STATUS.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0046; Paragraphs FIL-0046-PAR-0018; Statements FIL-0046-STMT-000098; Fields FIL-0046-FLD-000006

**Related:** Rules: BR-016, BR-018, BR-019

**Detected in:** rules_artifact | **Also:** 

---

### GAP-298 — BR-029 Report recovery outcome according to the overall return code — medium confidence
**Type:** MEDIUM_CONFIDENCE_RULE | **Program:** RCVPRC00 | **Paragraph:** 3100-UPDATE-FINAL-STATUS | **Line:** 284 | **Cause:** analysis | **SME review:** No | **Rule confidence:** medium

Report recovery outcome according to the overall return code. At termination, when the return code is zero the system logs 'Recovery completed successfully' through ERRPROC; otherwise it logs 'Recovery completed with errors'. Implemented in program RCVPRC00, paragraph 3100-UPDATE-FINAL-STATUS.

**Impact:** Rule is likely correct but warrants confirmation.

**Recommended action:** Confirm the rule with a business analyst or developer familiar with the domain (rule is likely correct but warrants confirmation).

**Source IDs:** File FIL-0047; Paragraphs FIL-0047-PAR-0017; Statements FIL-0047-STMT-000050; Fields FIL-0047-FLD-000020

**Related:** Rules: BR-029

**Detected in:** rules_artifact | **Also:** 

---

### GAP-299 — ERRHNDL PROGRAM-ID taken from the filename (source is not in fixed-column layout)
**Type:** MISSING_PROGRAM_ID | **Program:** ERRHNDL | **Line:** 2 | **Cause:** source | **SME review:** No

The inventory did not find PROGRAM-ID in src/programs/online/ERRHNDL.cbl with its fixed-format pattern and used the filename as fallback ID. The file is not in fixed-column layout: 'PROGRAM-ID. ERRHNDL.' starts in column 1 (line 2) and COPY/EXEC statements start in column 4; the declared name equals the fallback ID. Agent 2 records source_format 'free' and Agent 3 read the lines as whole-line program text.

**Impact:** None on the program identity (declared name equals the fallback ID); the free-format layout is non-standard for the rest of the repository.

**Recommended action:** Confirm the program ID with the development team and whether the free-format source is the version that is compiled.

**Source IDs:** File FIL-0062

**Detected in:** inventory_artifact, data_artifact | **Also:** UNSUPPORTED_CONSTRUCT

---

### GAP-300 — CURSMGR: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** CURSMGR | **Paragraph:** P100-DECLARE-CURSOR | **Line:** 74 | **Cause:** source | **SME review:** No

SQLCODE (lines 74, 75, 86, 89; P100-DECLARE-CURSOR, P200-OPEN-CURSOR) is not defined in the program or in copybook SQLCA (precompiler-supplied SQLCA item); resolution UNRESOLVED, target_id null. Agent 3 notes copybook SQLCA (SYS-PORTFOLIO-001-FIL-0017) defines only SQL-STATUS-CODES.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0059; Paragraphs FIL-0059-PAR-0002, FIL-0059-PAR-0004

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| CURSMGR | P100-DECLARE-CURSOR | 74 |  | SQLCODE |
| CURSMGR | P100-DECLARE-CURSOR | 75 |  | SQLCODE |
| CURSMGR | P200-OPEN-CURSOR | 86 |  | SQLCODE |
| CURSMGR | P200-OPEN-CURSOR | 89 |  | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-301 — DB2CMT: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** DB2CMT | **Paragraph:** 2100-ISSUE-COMMIT | **Line:** 92 | **Cause:** source | **SME review:** No

SQLCODE (lines 92, 96, 108, 112, 126, 130, 144, 148; paragraphs 2100-ISSUE-COMMIT, 3000-ROLLBACK, 4000-SAVEPOINT, 5000-RESTORE) is not defined in the program or its copybooks (precompiler-supplied SQLCA item); resolution UNRESOLVED, target_id null.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0054; Paragraphs FIL-0054-PAR-0004, FIL-0054-PAR-0005, FIL-0054-PAR-0006, FIL-0054-PAR-0007

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2CMT | 2100-ISSUE-COMMIT | 92 |  | SQLCODE |
| DB2CMT | 2100-ISSUE-COMMIT | 96 |  | SQLCODE |
| DB2CMT | 3000-ROLLBACK | 108 |  | SQLCODE |
| DB2CMT | 3000-ROLLBACK | 112 |  | SQLCODE |
| DB2CMT | 4000-SAVEPOINT | 126 |  | SQLCODE |
| DB2CMT | 4000-SAVEPOINT | 130 |  | SQLCODE |
| DB2CMT | 5000-RESTORE | 144 |  | SQLCODE |
| DB2CMT | 5000-RESTORE | 148 |  | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-302 — DB2CONN: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** DB2CONN | **Paragraph:** 1000-CONNECT | **Line:** 76 | **Cause:** source | **SME review:** No

SQLCODE (lines 76, 92, 94, 119, 123, 138, 143; paragraphs 1000-CONNECT, 1100-HANDLE-CONN-ERROR, 2000-DISCONNECT, 3000-CHECK-STATUS) is supplied by the DB2 precompiler SQLCA and is not registered in the program or its copybooks; resolution UNRESOLVED, target_id null. Copybook SQLCA (copied at line 22) defines only SQL-STATUS-CODES; its EXEC SQL INCLUDE SQLCA self-include is unresolved.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0055; Paragraphs FIL-0055-PAR-0002, FIL-0055-PAR-0003, FIL-0055-PAR-0004, FIL-0055-PAR-0005

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2CONN | 1000-CONNECT | 76 |  | SQLCODE |
| DB2CONN | 1100-HANDLE-CONN-ERROR | 92 |  | SQLCODE |
| DB2CONN | 1100-HANDLE-CONN-ERROR | 94 |  | SQLCODE |
| DB2CONN | 2000-DISCONNECT | 119 |  | SQLCODE |
| DB2CONN | 2000-DISCONNECT | 123 |  | SQLCODE |
| DB2CONN | 3000-CHECK-STATUS | 138 |  | SQLCODE |
| DB2CONN | 3000-CHECK-STATUS | 143 |  | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-303 — DB2ERR: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** DB2ERR | **Paragraph:** 1200-INSERT-ERROR | **Line:** 132 | **Cause:** source | **SME review:** No

SQLCODE (lines 132, 187; 1200-INSERT-ERROR, 3000-RETRIEVE-ERROR) is not defined in the program or its copybooks (precompiler-supplied SQLCA item); resolution UNRESOLVED, target_id null.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0056; Paragraphs FIL-0056-PAR-0004, FIL-0056-PAR-0006

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2ERR | 1200-INSERT-ERROR | 132 |  | SQLCODE |
| DB2ERR | 3000-RETRIEVE-ERROR | 187 |  | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-304 — DB2HNDL: SQLCODE and SQLERRMC have no Field ID (DB2 precompiler items)
**Type:** PRECOMPILER_PROVIDED | **Program:** DB2HNDL | **Paragraph:** 9000-CHECK-SQL-STATUS | **Line:** 226 | **Cause:** source | **SME review:** No

SQLCODE (lines 165, 173 in 2300-CURSOR-EXAMPLE; 226, 227, 230 in 9000-CHECK-SQL-STATUS) and SQLERRMC (line 228, 9000-CHECK-SQL-STATUS) are precompiler SQLCA fields; resolve-field-references UNRESOLVED; target_id null. Agent 3 records that copybook SQLCA defines only SQL-STATUS-CODES. SQLCODE is also the loop condition field (condition_field_ids resolution UNRESOLVED) of the cursor loop at line 165.

**Impact:** None on business meaning (standard DB2 status fields); the references have no Field ID.

**Recommended action:** No action beyond noting SQLCODE and SQLERRMC as standard DB2 precompiler fields.

**Source IDs:** File FIL-0080; Paragraphs FIL-0080-PAR-0006, FIL-0080-PAR-0010; Statements FIL-0080-STMT-000022

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2HNDL | 2300-CURSOR-EXAMPLE | 165 | FIL-0080-STMT-000022 | SQLCODE (also line 173) |
| DB2HNDL | 9000-CHECK-SQL-STATUS | 226 |  | SQLCODE (also lines 227, 230) |
| DB2HNDL | 9000-CHECK-SQL-STATUS | 228 |  | SQLERRMC |

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-305 — DB2ONLN: SQLCODE and SQLERRMC have no Field ID (DB2 precompiler SQLCA items)
**Type:** PRECOMPILER_PROVIDED | **Program:** DB2ONLN | **Paragraph:** P110-ESTABLISH-CONNECTION | **Line:** 69 | **Cause:** source | **SME review:** No

SQLCODE (lines 69, 71, 76, 94, 98, 110, 113) and SQLERRMC (lines 77, 99) in P110-ESTABLISH-CONNECTION, P200-PROCESS-DISCONNECT and P300-CHECK-STATUS are not defined in the program or in copybook SQLCA (precompiler-supplied SQLCA items); resolution UNRESOLVED, target_id null.

**Impact:** None on behaviour (standard DB2 meaning); the fields cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE and SQLERRMC as standard DB2 SQLCA items; no repository change needed.

**Source IDs:** File FIL-0060; Paragraphs FIL-0060-PAR-0004, FIL-0060-PAR-0008, FIL-0060-PAR-0010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2ONLN | P110-ESTABLISH-CONNECTION | 69 |  | SQLCODE (also lines 71, 76) |
| DB2ONLN | P110-ESTABLISH-CONNECTION | 77 |  | SQLERRMC |
| DB2ONLN | P200-PROCESS-DISCONNECT | 94 |  | SQLCODE (also line 98) |
| DB2ONLN | P200-PROCESS-DISCONNECT | 99 |  | SQLERRMC |
| DB2ONLN | P300-CHECK-STATUS | 110 |  | SQLCODE (also line 113) |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-306 — DB2RECV: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** DB2RECV | **Paragraph:** P200-RECOVER-TRANSACTION | **Line:** 114 | **Cause:** source | **SME review:** No

SQLCODE (lines 114, 119; P200-RECOVER-TRANSACTION) is not defined in the program or in copybook SQLCA (precompiler-supplied SQLCA item); resolution UNRESOLVED with no unresolved_reason; target_id null.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2RECV | P200-RECOVER-TRANSACTION | 114 |  | SQLCODE |
| DB2RECV | P200-RECOVER-TRANSACTION | 119 |  | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-307 — DB2STAT: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** DB2STAT | **Paragraph:** 1100-CREATE-STATS-TABLE | **Line:** 105 | **Cause:** source | **SME review:** No

SQLCODE (lines 105, 122, 149, 171, 200; paragraphs 1100-CREATE-STATS-TABLE, 1200-INSERT-INITIAL, 2000-UPDATE-STATS, 3000-TERMINATE, 4000-DISPLAY-STATS) is not defined in the program or its copybooks (precompiler-supplied SQLCA item); resolution UNRESOLVED, target_id null.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0057; Paragraphs FIL-0057-PAR-0003, FIL-0057-PAR-0004, FIL-0057-PAR-0005, FIL-0057-PAR-0006, FIL-0057-PAR-0008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2STAT | 1100-CREATE-STATS-TABLE | 105 |  | SQLCODE |
| DB2STAT | 1200-INSERT-INITIAL | 122 |  | SQLCODE |
| DB2STAT | 2000-UPDATE-STATS | 149 |  | SQLCODE |
| DB2STAT | 3000-TERMINATE | 171 |  | SQLCODE |
| DB2STAT | 4000-DISPLAY-STATS | 200 |  | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-308 — ERRHNDL: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** ERRHNDL | **Paragraph:** P200-LOG-ERROR | **Line:** 85 | **Cause:** source | **SME review:** No

SQLCODE (line 85, P200-LOG-ERROR) is not defined in the program or in copybook SQLCA (precompiler-supplied SQLCA item); resolution UNRESOLVED, target_id null. Agent 3 notes copybook SQLCA defines only SQL-STATUS-CODES.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0062; Paragraphs FIL-0062-PAR-0004

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| ERRHNDL | P200-LOG-ERROR | 85 |  | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-309 — HISTLD00: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** HISTLD00 | **Paragraph:** 2200-LOAD-TO-DB2 | **Line:** 165 | **Cause:** source | **SME review:** No

SQLCODE is referenced at lines 165 and 168 (INSERT result checks in 2200-LOAD-TO-DB2). It is a precompiler-supplied SQLCA item; the copybook SQLCA self-includes (EXEC SQL INCLUDE SQLCA), so the SQLCA is not defined in the repository and SQLCODE has no Field ID.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0044; Paragraphs FIL-0044-PAR-0009

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| HISTLD00 | 2200-LOAD-TO-DB2 | 165 |  | SQLCODE |
| HISTLD00 | 2200-LOAD-TO-DB2 | 168 | FIL-0044-STMT-000068 | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-310 — INQHIST: SQLCODE has no Field ID (DB2 precompiler item)
**Type:** PRECOMPILER_PROVIDED | **Program:** INQHIST | **Paragraph:** P999-ERROR-ROUTINE | **Line:** 189 | **Cause:** source | **SME review:** No

SQLCODE (line 189, statement STMT-000029, P999-ERROR-ROUTINE) is not defined in the program or in copybook SQLCA; it is a precompiler-supplied SQLCA item. target_id is null. Agent 3 records the SQLCA copybook layout's self-include stub as unresolved, so the precompiler SQLCA items are not defined in the repository copybook.

**Impact:** None on business meaning (standard DB2 status field); the reference has no Field ID.

**Recommended action:** No action beyond noting SQLCODE as a standard DB2 precompiler field.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0012; Statements FIL-0063-STMT-000029

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQHIST | P999-ERROR-ROUTINE | 189 | FIL-0063-STMT-000029 | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-311 — RTNANA00: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** RTNANA00 | **Paragraph:** P200-PROCESS-ANALYSIS | **Line:** 146 | **Cause:** source | **SME review:** No

SQLCODE (lines 146, 180; P200-PROCESS-ANALYSIS, P220-PROCESS-DETAIL) is not defined in the program or in copybook SQLCA: the repository SQLCA declares only SQL-STATUS-CODES and the precompiler SQLCA structure is not present; resolution UNRESOLVED, target_id null.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0051; Paragraphs FIL-0051-PAR-0004, FIL-0051-PAR-0008

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RTNANA00 | P200-PROCESS-ANALYSIS | 146 |  | SQLCODE |
| RTNANA00 | P220-PROCESS-DETAIL | 180 |  | SQLCODE |

**Related:** Gaps: GAP-203

**Detected in:** logic_artifact | **Also:** 

---

### GAP-312 — RTNCDE00: SQLCODE has no Field ID (DB2 precompiler SQLCA item)
**Type:** PRECOMPILER_PROVIDED | **Program:** RTNCDE00 | **Paragraph:** P400-LOG-RETURN-CODE | **Line:** 113 | **Cause:** source | **SME review:** No

SQLCODE (lines 113, 135; P400-LOG-RETURN-CODE, P500-ANALYZE-CODES) is supplied by the DB2 precompiler SQLCA and is not registered; resolution UNRESOLVED, target_id null. Agent 3 notes copybook SQLCA defines only SQL-STATUS-CODES.

**Impact:** None on behaviour (standard DB2 meaning); the field cannot be traced to a registered layout.

**Recommended action:** Document SQLCODE as the standard DB2 SQLCA return code; no repository change needed.

**Source IDs:** File FIL-0052; Paragraphs FIL-0052-PAR-0008, FIL-0052-PAR-0010

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RTNCDE00 | P400-LOG-RETURN-CODE | 113 |  | SQLCODE |
| RTNCDE00 | P500-ANALYZE-CODES | 135 |  | SQLCODE |

**Related:** Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-313 — SECMGR: SQLCODE has no Field ID (DB2 precompiler item)
**Type:** PRECOMPILER_PROVIDED | **Program:** SECMGR | **Paragraph:** P200-CHECK-AUTH | **Line:** 88 | **Cause:** source | **SME review:** No

SQLCODE (lines 88 STMT-000007 in P200-CHECK-AUTH and 127 STMT-000014 in P300-LOG-ACCESS) is not defined in the program or in copybook SQLCA (precompiler-supplied); target_id null. Agent 3 records that copybook SQLCA defines only SQL-STATUS-CODES and that its self-include stub is unresolved.

**Impact:** None on business meaning (standard DB2 status field); the references have no Field ID.

**Recommended action:** No action beyond noting SQLCODE as a standard DB2 precompiler field.

**Source IDs:** File FIL-0066; Paragraphs FIL-0066-PAR-0004, FIL-0066-PAR-0006; Statements FIL-0066-STMT-000007, FIL-0066-STMT-000014

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| SECMGR | P200-CHECK-AUTH | 88 | FIL-0066-STMT-000007 | SQLCODE |
| SECMGR | P300-LOG-ACCESS | 127 | FIL-0066-STMT-000014 | SQLCODE |

**Related:** Rules: BR-062 | Gaps: GAP-211

**Detected in:** logic_artifact, data_artifact | **Also:** 

---

### GAP-314 — DB2ERR: SELECT with subquery summarised in pseudocode
**Type:** PSEUDOCODE_ISSUE | **Program:** DB2ERR | **Paragraph:** 3000-RETRIEVE-ERROR | **Line:** 172 | **Cause:** display | **SME review:** No

The SELECT with subquery at line 172 (3000-RETRIEVE-ERROR) is summarised in the pseudocode; see source lines 172-185.

**Impact:** Minor: the pseudocode does not show the full SQL; the source is available.

**Recommended action:** Refer to source lines 172-185 when the retrieval query must be specified exactly.

**Source IDs:** File FIL-0056; Paragraphs FIL-0056-PAR-0006; Statements FIL-0056-STMT-000021

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2ERR | 3000-RETRIEVE-ERROR | 172 | FIL-0056-STMT-000021 | SELECT with subquery |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-315 — DB2RECV: EXEC CICS DELAY not in the CICS command table
**Type:** PSEUDOCODE_ISSUE | **Program:** DB2RECV | **Paragraph:** P120-WAIT-INTERVAL | **Line:** 105 | **Cause:** display | **SME review:** No

EXEC CICS DELAY (line 105, P120-WAIT-INTERVAL) is not in Agent 4's CICS command table; recorded as CICS DELAY [INTERVAL(WS-RETRY-INTERVAL)].

**Impact:** Minor: the wait between reconnect attempts is described generically; the source is available.

**Recommended action:** Refer to source line 105 for the exact DELAY options.

**Source IDs:** File FIL-0061; Paragraphs FIL-0061-PAR-0006; Statements FIL-0061-STMT-000011

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2RECV | P120-WAIT-INTERVAL | 105 | FIL-0061-STMT-000011 | EXEC CICS DELAY |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-316 — DB2STAT: two statements recorded as written and flagged for review
**Type:** PSEUDOCODE_ISSUE | **Program:** DB2STAT | **Paragraph:** 3100-CALC-TIMES | **Line:** 181 | **Cause:** analysis | **SME review:** Yes

Agent 4 flags two statements as ambiguous: the COMPUTE with FUNCTION NUMVAL over timestamp substrings (line 181, 3100-CALC-TIMES) is recorded as written; the SELECT of 8 columns INTO an 11-item host structure (line 190, 4000-DISPLAY-STATS) is flagged for review.

**Impact:** The elapsed-time calculation and which statistics are displayed are not confirmed in the pseudocode; the source is available.

**Recommended action:** Review source lines 181 and 190 with a developer; confirm the elapsed-time formula and the column-to-host-variable mapping of the display SELECT.

**Source IDs:** File FIL-0057; Paragraphs FIL-0057-PAR-0007, FIL-0057-PAR-0008; Statements FIL-0057-STMT-000027, FIL-0057-STMT-000030

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| DB2STAT | 3100-CALC-TIMES | 181 | FIL-0057-STMT-000027 | COMPUTE ... FUNCTION NUMVAL |
| DB2STAT | 4000-DISPLAY-STATS | 190 | FIL-0057-STMT-000030 | SELECT 8 columns INTO 11-item host structure |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-317 — INQHIST: SQL parameter marker binding not shown
**Type:** PSEUDOCODE_ISSUE | **Program:** INQHIST | **Paragraph:** P200-GET-HISTORY | **Line:** 130 | **Cause:** analysis | **SME review:** Yes

In P200-GET-HISTORY (line 130, statement STMT-000016) the SQL text has a parameter marker (ACCOUNT_NO = ?), but no account number is placed in WS-CURSOR-REQUEST; Agent 4 marks the annotation ambiguous because how the marker is bound is not shown in INQHIST.

**Impact:** Which account the history inquiry selects is not determinable from INQHIST alone.

**Recommended action:** Review CURSMGR's handling of the cursor request and confirm with the development team how the ACCOUNT_NO parameter is supplied.

**Source IDs:** File FIL-0063; Paragraphs FIL-0063-PAR-0006; Statements FIL-0063-STMT-000016

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQHIST | P200-GET-HISTORY | 130 | FIL-0063-STMT-000016 | ACCOUNT_NO = ? (SQL parameter marker) |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-318 — INQONLN: CICS ASSIGN not in the translation table
**Type:** PSEUDOCODE_ISSUE | **Program:** INQONLN | **Paragraph:** P050-SECURITY-CHECK | **Line:** 142 | **Cause:** analysis | **SME review:** No

EXEC CICS ASSIGN at line 142 (statement STMT-000026, P050-SECURITY-CHECK) is not in the CICS translation table; Agent 4 recorded it as CICS ASSIGN [USERID(SEC-USER-ID)].

**Impact:** Minor: the statement is recorded literally; source is available.

**Recommended action:** No action needed beyond confirming that ASSIGN USERID obtains the signed-on user ID.

**Source IDs:** File FIL-0064; Paragraphs FIL-0064-PAR-0012; Statements FIL-0064-STMT-000026

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| INQONLN | P050-SECURITY-CHECK | 142 | FIL-0064-STMT-000026 | EXEC CICS ASSIGN |

**Related:** Rules: BR-057, BR-058

**Detected in:** logic_artifact | **Also:** 

---

### GAP-319 — PROGNAME: single-pass loop outside the loop-pattern catalogue (template placeholder)
**Type:** PSEUDOCODE_ISSUE | **Program:** PROGNAME | **Paragraph:** 0000-MAIN | **Line:** 56 | **Cause:** analysis | **SME review:** No

PERFORM 2000-PROCESS UNTIL END-OF-FILE (line 56, STMT-000002, 0000-MAIN): the termination flag is set unconditionally by the only statement of the body (SET END-OF-FILE TO TRUE, line 75). None of the catalogue patterns applies; Agent 4 recorded it as SINGLE_PASS_LOOP. The template comment at line 74 says main processing logic is still to be added.

**Impact:** Minor; PROGNAME is a template with no business logic.

**Recommended action:** No action needed; note PROGNAME as a template, not a production program.

**Source IDs:** File FIL-0083; Paragraphs FIL-0083-PAR-0001, FIL-0083-PAR-0003; Statements FIL-0083-STMT-000002

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| PROGNAME | 0000-MAIN | 56 | FIL-0083-STMT-000002 | PERFORM 2000-PROCESS UNTIL END-OF-FILE (SINGLE_PASS_LOOP) |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-320 — RTNANA00: cursor SQL summarised in pseudocode
**Type:** PSEUDOCODE_ISSUE | **Program:** RTNANA00 | **Paragraph:** P200-PROCESS-ANALYSIS | **Line:** 126 | **Cause:** display | **SME review:** No

The DECLARE CURSOR with GROUP BY and conditional COUNTs (line 126, P200-PROCESS-ANALYSIS) is summarised in the pseudocode; the full SQL is in source lines 126-137.

**Impact:** Minor: the pseudocode does not show the full SQL; the source is available.

**Recommended action:** Refer to source lines 126-137 when the analysis query must be specified exactly.

**Source IDs:** File FIL-0051; Paragraphs FIL-0051-PAR-0004; Statements FIL-0051-STMT-000011

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| RTNANA00 | P200-PROCESS-ANALYSIS | 126 | FIL-0051-STMT-000011 | DECLARE CURSOR PRGCUR |

**Detected in:** logic_artifact | **Also:** 

---

### GAP-321 — SECMGR: CICS ASSIGN not in the translation table; unused WS-ERROR-AREA
**Type:** PSEUDOCODE_ISSUE | **Program:** SECMGR | **Paragraph:** P100-VALIDATE-USER | **Line:** 57 | **Cause:** analysis | **SME review:** No

EXEC CICS ASSIGN at lines 57 (STMT-000003, P100-VALIDATE-USER) and 108 (P300-LOG-ACCESS; no statement ID given in the issue) is not in the CICS translation table and was recorded as 'CICS ASSIGN' with its options. Agent 4 also notes that WS-ERROR-AREA (COPY ERRHND, line 26) is not referenced by any procedure statement.

**Impact:** Minor; source is available.

**Recommended action:** No action needed beyond confirming the ASSIGN options used.

**Source IDs:** File FIL-0066; Paragraphs FIL-0066-PAR-0002, FIL-0066-PAR-0006; Statements FIL-0066-STMT-000003

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
| SECMGR | P100-VALIDATE-USER | 57 | FIL-0066-STMT-000003 | EXEC CICS ASSIGN |
| SECMGR | P300-LOG-ACCESS | 108 |  | EXEC CICS ASSIGN |
| SECMGR |  | 26 |  | WS-ERROR-AREA (unused) |

**Related:** Rules: BR-061

**Detected in:** logic_artifact | **Also:** 

---

### GAP-322 — 30 copybook-level rules (BR-099 to BR-128) are annotated in no diagram
**Type:** RULE_NOT_DIAGRAMMED | **Program:** BCHCTL, CKPRST, PRCSEQ, AUDITLOG, HISTREC, PORTFLIO, POSREC, RETHND, RTNCODE, TRNREC, DBTBLS, DB2REQ, ERRHND, INQCOM (copybooks) | **Cause:** display | **SME review:** Yes | **Rule confidence:** low

The 30 copybook-level value-set rules BR-099 to BR-128 have no program or paragraph in their primary source (program_id and paragraph null) and are listed only in rules_artifact.rules_by_file_id / business_rules. None of them appears in any diagrams_artifact rule_annotations entry. BR-099 to BR-125 (27 rules) are annotated nowhere and are not mentioned by the Diagram Agent (Agent 6 audit D-2). BR-126 (DB2REQ), BR-127 (ERRHND) and BR-128 (INQCOM) are also not annotated, but the Diagram Agent disclosed this in its issues (type rules_not_annotated). The rules themselves are in the business rules catalogue; each also has its own SME_REVIEW_REQUIRED candidate in this part.

**Impact:** Rules that no diagram annotates are visible only in the rules catalogue; the diagrams do not show where these value sets apply.

**Recommended action:** Present these rules from the business rules catalogue (rules_by_file_id) rather than from the diagrams, and state in the BRD that they are not shown in any diagram. (RULE_NOT_DIAGRAMMED is a REVFORGE type; the reference harness table has no standard action for it.)

| Program | Paragraph | Line | Statement ID | Target / name |
|---|---|---|---|---|
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

**Related:** Rules: BR-099, BR-100, BR-101, BR-102, BR-103, BR-104, BR-105, BR-106, BR-107, BR-108, BR-109, BR-110, BR-111, BR-112, BR-113, BR-114, BR-115, BR-116, BR-117, BR-118, BR-119, BR-120, BR-121, BR-122, BR-123, BR-124, BR-125, BR-126, BR-127, BR-128

**Detected in:** rules_artifact, diagrams_artifact | **Also:** 

---

## Assumptions

| ID | Assumption | Basis | Confidence |
|---|---|---|---|
| ASM-001 | Each program's type (batch / online) is taken from Agent 4's execution_traces[0].entry_type, because the inventory gives every program subtype 'unknown' (no filename starts with CB, CO or CA): 28 batch, 8 online, 6 unclassified (AUDPROC, DB2CMT, DB2ERR, DB2STAT = called_subprogram; PORTTRAN = program_entry; POSUPDT = no trace, logic empty). | diagrams_artifact issues[program_type_from_logic]; inventory_artifact issues[subtype_unknown] (count 42; batch_programs 0, online_programs 0) | medium |
| ASM-002 | SQLCODE, SQLSTATE, SQLERRMC and the other SQLCA items are supplied by the DB2 precompiler and have their standard DB2 meaning; they are not defined in the repository (copybook SQLCA defines only SQL-STATUS-CODES) and carry no Field ID. | classified_conditions.json unresolved[field_id_unresolved SQLCODE].detail 'precompiler-supplied SQLCA field; standard DB2 meaning'; data_artifact issues[sqlca_structure_not_in_copybook] and issues[unresolved_copy_stub SQLCA] | high |
| ASM-003 | The four sources under src/templates (DB2HNDL, ERRHANDL, FILEHNDL, PROGNAME) are templates; they are catalogued and analysed as programs because of their file extension; findings for them are labelled as coming from template sources. | inventory_artifact issues[template_source]; diagrams_artifact FLOW-PROGNAME.limitations ('Program is a template under src/templates'); data_artifact issues[empty_data_section PROGNAME] ('Source is a template') | high |
| ASM-004 | Lines whose comment marker is not in the standard indicator column (column 7) are treated as comments; they contain no data entry. | data_artifact issues[misplaced_comment_indicator] x14 and issues[invalid_indicator_area] ('treated as a comment and skipped') | medium |
| ASM-005 | The two COPY DB2STAT edges (RPTSTA00, UTLMON00) are drawn as confirmed in the diagrams only because the inventory marked them resolved by registry lookup; Agent 3 treats them as unresolved copy stubs. The BRD follows Agent 3 (unresolved). | diagrams_artifact issues[copy_target_is_program] ('Kept as confirmed per evidence rule (resolved:true) with a note'); COMP-DB2STAT.limitations ('doubtful'); inventory_artifact issues[copy_target_not_copybook] | medium |
| ASM-006 | Entity-relationship cardinalities in erd.mmd are the skill defaults per relationship type, and entities without key-suffix fields use their first field as an implied primary key; neither is derived from data. | diagrams_artifact ERD-MAIN.limitations; issues[erd_entity_no_key_fields] | high |

