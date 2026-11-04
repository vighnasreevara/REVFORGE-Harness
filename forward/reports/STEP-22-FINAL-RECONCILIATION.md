# STEP 22: final reverse vs forward reconciliation

**Status: COMPLETE.** Baseline commit `373fac1`. All evidence is in `forward/reports/step-22/`, and every JSON file defines its fields.

**COBOL-to-Java equivalence: not established.** All verification is structural or from source-derived Java tests; no legacy execution exists.

**BMad: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.**

## 1. Source integrity

| Check | Result |
|---|---|
| Inventoried source files | 83/83 present |
| Size checks | 42/42 recorded sizes match (the inventory records sizes for programs only) |
| SHA-256 against the authorization manifest | 82/82 |
| Reverse artifacts unchanged | 11/11 |
| Generated Java unchanged | True (145 files) |
| Rule identities | 154 in the reverse artifact; identical in Step 17 and now: True |
| Statement identities | 1936/1936 mapped by permanent ID |
| Git stabilization present | {'.gitattributes': True, 'tests/helpers/gitpolicy.ts': True, 'tracked_java': 20} |
| BMad mandatory | True |

**Local modifications:** the STEP 22 files only (5 status entries).

## 2. Summary (numerator/denominator)

| Metric | Value | Definition |
|---|---|---|
| programs_complete | 2/42 | COMPLETE programs / COBOL programs |
| programs_with_java | 41/42 | programs with generated Java / COBOL programs |
| rules_source_derived_tested | 67/154 | rules verified by passing source-derived tests / rules |
| rules_tested_up_to_gap | 15/154 | rules verified up to a downstream gap / rules |
| rules_blocked | 32/154 | rules whose site is a gap / rules |
| rules_cobol_equivalent | 0/154 | rules with legacy-execution equivalence evidence / rules |
| paragraphs_mapped | 390/402 | paragraphs with a Java method at the same identity / paragraphs |
| paragraphs_test_executed | 95/402 | paragraphs executed by passing scenarios / paragraphs |
| statements_mapped | 1337/1936 | statements with a Java statement / statements |
| statements_at_gaps | 599/1936 | statements at explicit gap sites / statements |
| statements_test_executed | 414/1936 | statements executed by passing scenarios / statements |
| perform_edges_structural | 397/524 | PERFORM edges whose Java target matches / PERFORM edges |
| branches_structural | 190/254 | branches with a Java condition / branches |
| loops_structural | 26/32 | loops with a Java loop / loops |
| fields_consistent | 966/1009 | fields with identical attributes / fields |
| conditions_value_checked | 257/259 | level-88 conditions value-checked / conditions |
| records_represented | 196/231 | records represented / records |
| copybooks_complete | 19/19 | complete copybooks / copybooks used by a program |
| diagram_process_edges_supported | 639/912 | process-flow edges supported by Java structure / process-flow edges |
| diagrams_mappable | 60/65 | diagrams with a Java counterpart to compare / diagrams |
| jcl_end_to_end_tested | 3/15 | jobs passing an end-to-end Java test / jobs |
| readiness_pass | 6/42 | programs passing SOURCE_READINESS / programs |
| validation_pass | 41/42 | programs passing CONVERSION_VALIDATION / programs |
| bmad_workflows_executed | 0/6 | bound BMad workflows executed LIVE / bound workflows |

## 3. Programs

{'PARTIAL': 39, 'MISSING': 1, 'COMPLETE': 2}. Recalculated: COMPLETE requires a compiled program, every check passing, conversion validation passing and no open gap.

| Program | Class | Rules | Statements | Gaps | Validation | Readiness |
|---|---|---|---|---|---|---|
| BCHCTL00 | PARTIAL | 3 | {'MAPPED': 19, 'GAP': 11} | 11 | 0 | FAIL |
| CKPRST | PARTIAL | 1 | {'GAP': 5, 'MAPPED': 1} | 6 | 0 | FAIL |
| HISTLD00 | PARTIAL | 4 | {'MAPPED': 45, 'GAP': 32} | 25 | 0 | FAIL |
| POSUPDT | MISSING | 0 | {} | 0 | 1 | FAIL |
| PRCSEQ00 | PARTIAL | 15 | {'MAPPED': 108, 'GAP': 10} | 5 | 0 | FAIL |
| RCVPRC00 | PARTIAL | 11 | {'MAPPED': 104, 'GAP': 1} | 1 | 0 | FAIL |
| RPTAUD00 | PARTIAL | 0 | {'MAPPED': 22, 'GAP': 14} | 14 | 0 | FAIL |
| RPTPOS00 | PARTIAL | 1 | {'MAPPED': 25, 'GAP': 21} | 17 | 0 | FAIL |
| RPTSTA00 | PARTIAL | 0 | {'MAPPED': 25, 'GAP': 24} | 16 | 0 | FAIL |
| RTNANA00 | PARTIAL | 3 | {'MAPPED': 38, 'GAP': 11} | 5 | 0 | FAIL |
| RTNCDE00 | PARTIAL | 4 | {'MAPPED': 32, 'GAP': 8} | 4 | 0 | FAIL |
| AUDPROC | PARTIAL | 0 | {'MAPPED': 26, 'GAP': 1} | 1 | 0 | FAIL |
| DB2CMT | PARTIAL | 3 | {'MAPPED': 24, 'GAP': 32} | 8 | 0 | FAIL |
| DB2CONN | PARTIAL | 5 | {'MAPPED': 18, 'GAP': 28} | 10 | 0 | FAIL |
| DB2ERR | PARTIAL | 5 | {'MAPPED': 50, 'GAP': 13} | 6 | 0 | FAIL |
| DB2STAT | PARTIAL | 2 | {'MAPPED': 27, 'GAP': 39} | 13 | 0 | FAIL |
| ERRPROC | PARTIAL | 0 | {'MAPPED': 30, 'GAP': 3} | 3 | 0 | FAIL |
| CURSMGR | PARTIAL | 2 | {'MAPPED': 10, 'GAP': 10} | 8 | 0 | FAIL |
| DB2ONLN | PARTIAL | 3 | {'MAPPED': 16, 'GAP': 22} | 7 | 0 | FAIL |
| DB2RECV | PARTIAL | 6 | {'MAPPED': 27, 'GAP': 18} | 9 | 0 | FAIL |
| ERRHNDL | PARTIAL | 2 | {'MAPPED': 8, 'GAP': 24} | 17 | 0 | FAIL |
| INQHIST | PARTIAL | 2 | {'MAPPED': 30, 'GAP': 14} | 14 | 0 | FAIL |
| INQONLN | PARTIAL | 5 | {'GAP': 24, 'MAPPED': 21} | 19 | 0 | FAIL |
| INQPORT | PARTIAL | 1 | {'MAPPED': 10, 'GAP': 15} | 13 | 0 | FAIL |
| SECMGR | PARTIAL | 3 | {'MAPPED': 10, 'GAP': 23} | 8 | 0 | FAIL |
| PORTADD | PARTIAL | 5 | {'MAPPED': 21, 'GAP': 12} | 7 | 0 | PASS |
| PORTDEL | PARTIAL | 5 | {'MAPPED': 42, 'GAP': 1} | 1 | 0 | FAIL |
| PORTMSTR | PARTIAL | 9 | {'MAPPED': 73, 'GAP': 26} | 20 | 0 | FAIL |
| PORTREAD | COMPLETE | 2 | {'MAPPED': 24} | 0 | 0 | PASS |
| PORTTEST | PARTIAL | 3 | {'MAPPED': 29, 'GAP': 3} | 3 | 0 | PASS |
| PORTTRAN | PARTIAL | 12 | {'MAPPED': 75, 'GAP': 41} | 22 | 0 | FAIL |
| PORTUPDT | PARTIAL | 2 | {'MAPPED': 33, 'GAP': 1} | 1 | 0 | PASS |
| PORTVALD | PARTIAL | 6 | {'MAPPED': 38, 'GAP': 1} | 1 | 0 | PASS |
| TSTGEN00 | PARTIAL | 2 | {'MAPPED': 35, 'GAP': 18} | 14 | 0 | FAIL |
| TSTVAL00 | PARTIAL | 2 | {'MAPPED': 40, 'GAP': 13} | 13 | 0 | FAIL |
| UTLMNT00 | PARTIAL | 1 | {'MAPPED': 35, 'GAP': 16} | 16 | 0 | FAIL |
| UTLMON00 | PARTIAL | 2 | {'MAPPED': 31, 'GAP': 21} | 21 | 0 | FAIL |
| UTLVAL00 | PARTIAL | 1 | {'MAPPED': 30, 'GAP': 17} | 17 | 0 | FAIL |
| DB2HNDL | PARTIAL | 0 | {'MAPPED': 19, 'GAP': 23} | 12 | 0 | FAIL |
| ERRHANDL | PARTIAL | 3 | {'MAPPED': 45, 'GAP': 1} | 1 | 0 | FAIL |
| FILEHNDL | PARTIAL | 0 | {'MAPPED': 33, 'GAP': 2} | 2 | 0 | FAIL |
| PROGNAME | COMPLETE | 0 | {'MAPPED': 8} | 0 | 0 | PASS |

## 4. Business rules

{'PARTIALLY_TESTED (verified up to a downstream gap)': 15, 'UNREACHABLE (implemented; no executable path reaches it)': 40, 'BLOCKED': 32, 'SOURCE_DERIVED_JAVA_TESTED': 67}.

- Implemented: 122.
- COBOL-equivalent: 0.

## 5. Control flow

- **PERFORM edges:** 524 ({'PERFORM_SIMPLE': 444, 'PERFORM_THRU': 50, 'PERFORM_INLINE': 21, 'PERFORM_UNTIL': 9}). Forward {'STRUCTURAL': 397, 'GAP': 127}; gap kinds {'UNDEFINED_PROCEDURE': 82, 'UNDECLARED_NAME': 42, 'UNSUPPORTED_DATA': 3}.
- **Branches:** 254. Forward {'STRUCTURAL': 190, 'GAP': 64}; gap kinds {'UNDECLARED_NAME': 56, 'UNSUPPORTED_DATA': 8}. Structural only: executing a condition does not verify every outcome.
- **Loops:** 32. Forward {'STRUCTURAL': 26, 'GAP': 6}.
- **Statements:** 1936. Forward {'MAPPED': 1337, 'GAP': 599}; execution {'BLOCKED_PATH': 249, 'NOT_EXECUTED': 674, 'GAP_SITE': 599, 'TEST_EXECUTED': 414}.
- **Recursive PERFORM:** GAP-016 (INQHIST) and GAP-024 (FILEHNDL) are blocked at run time by `RUNTIME-RECURSIVE-PERFORM`. They remain unresolved: their termination is an owner decision.

## 6. Data and copybooks

- **Fields:** {'CONSISTENT': 966, 'NOT_REPRESENTED': 43}. Not represented: {'no converted program uses it': 35, 'its record has no determinable layout in the forward data model: recor': 8}.
- **Level-88 conditions:** {'TEST_VERIFIED': 257, 'STRUCTURAL': 2}.
- **Records:** {'REPRESENTED': 196, 'NOT_REPRESENTED': 35}.
- **Copybooks:** {'MODEL': 13, 'COMPLETE_IN_PROGRAM': 6, 'NOT_USED': 6}.
- **Byte-level equivalence:** not claimed.

## 7. Diagrams

- **Diagrams:** 65 ({'process_flow': 45, 'component': 5, 'component_neighbourhood': 10, 'sequence': 2, 'erd': 3}). Mapping {'STRUCTURAL': 33, 'UNMAPPABLE': 5, 'PARTIAL': 19, 'STRUCTURAL_ONLY': 8}.
- **Process-flow edges:** 912. Supported by Java structure 639, gap-limited 162, unassessable 80, not found in Java 31.
- **Unmappable:** FLOW-POSUPDT, COMP-OVERVIEW-JOBS-PORTFOLIO, COMP-OVERVIEW-JOBS-REPORTING, COMP-UNRESOLVED, COMP-OVERVIEW-ISOLATED.

## 8. JCL and dependencies

- **JCL jobs:** {'IMPLEMENTED_BLOCKED_AT_STEP': 11, 'STEP_NOT_CONVERTED (utility)': 1, 'IMPLEMENTED_TEST_VERIFIED': 3}. No job is claimed COBOL-equivalent.

- **External operations:** {'IMPLEMENTED': 12, 'GAP EXTERNAL_SYSTEM_BOUNDARY': 78, 'DECLARATIVE (no run-time effect)': 3, 'GAP UNDEFINED_EXTERNAL_CALL': 2, 'GAP UNDECLARED_NAME': 3, 'GAP UNTRANSLATED_STATEMENT': 1}.
- **File I/O statements:** {'total': 159, 'forward': {'MAPPED': 124, 'GAP': 35}, 'execution': {'NOT_EXECUTED': 55, 'TEST_EXECUTED': 57, 'GAP_SITE': 35, 'BLOCKED_PATH': 12}}.

| Platform item | Occurrences | Programs | Disposition |
|---|---|---|---|
| ACCEPT FROM TIME STAMP | 10 | AUDPROC, DB2ERR, DB2STAT, ERRHNDL, ERRPROC, PORTDEL, PRCSEQ00, RCVPRC00 | AWAITING_EXTERNAL_DEFINITION (legacy environment / platform service); explicit gap, nothing invented |
| FUNCTION RANDOM | 3 | PORTTEST | AWAITING_EXTERNAL_DEFINITION (legacy environment / platform service); explicit gap, nothing invented |
| FUNCTION USER-ID | 2 | PORTMSTR, PORTTRAN | AWAITING_EXTERNAL_DEFINITION (legacy environment / platform service); explicit gap, nothing invented |
| CEE3ABD | 0 | - | no occurrence |
| ILBOABN0 | 1 | UTLMON00 | AWAITING_EXTERNAL_DEFINITION (legacy environment / platform service); explicit gap, nothing invented |
| DELAY | 2 | DB2CONN, DB2RECV | AWAITING_EXTERNAL_DEFINITION (legacy environment / platform service); explicit gap, nothing invented |
| IDCAMS | 0 | - | job step not converted (PORTDEF JCL); awaiting a platform utility |

## 9. Gaps

- **Reverse:** 217 historical reverse gaps = 10 resolved + 33 represented by forward gap records at the same location + 174 reverse records in the register.
- **Forward:** 391 gaps now, 391 in the register.
- **Verification records:** 4.
- **Register total:** 569 (by severity {'medium': 378, 'high': 109, 'critical': 8, 'low': 74}).

STEP 23 consolidates and presents the register.

## 10. BMad governance

- **Status:** BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.
- **Metrics:** {'configured_workflows': 6, 'authorized_workflows': 0, 'executed_live': 0, 'verified_receipts': 0, 'blocked_workflows': 6, 'mock_receipts_never_evidence': 0, 'governed_runs': 4, 'preflights': 13}.
- **PORTREAD:** BMAD_BLOCKED.
- **Local Java:** LOCAL_LGA_NOT_BMAD_GOVERNED.

## 11. Verification (sequential)

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | TypeScript build |
| `node dist/runtime/src/cli.js pilot integrate` | 0 | integrated 41 program(s), 15 job(s); excluded: POSUPDT (conversion FAILED: the source cannot be converted: missing PROGRAM-ID)   compilation: COMPILED (120 Java files)   runtime unit tests: {"PASS":34 |
| `java -cp generated/java/app/classes revforge.cobol.testing.RuntimeTests` | 0 | SUMMARY/34/0/0 |
| `node dist/runtime/src/cli.js doctor` | 0 | FAIL checks: 0; OK checks: 24 |
| `node dist/runtime/src/cli.js sync-agents --check` | 0 | entries not in sync: 0 |
| `node dist/runtime/src/cli.js bmad doctor` | 0 | bmad doctor: OK — bmad-method@6.12.4 staged; not installed in the repository (isolated executor installation: bmad executor doctor) |
| `node dist/runtime/src/cli.js bmad executor doctor` | 0 | bmad executor: isolated installation VERIFIED; LIVE execution BLOCKED; [FAIL] provider_disclosure_authorization: no signed AI-provider disclosure authorization exists for anthropic (claude-code-cli);  |
| `npm test` | 0 | ℹ tests 412 ℹ pass 412 ℹ fail 0 ℹ skipped 0  |
| `pilot validate` | - | 41/42 |
| `pilot readiness` | - | 6/42 |
| `tools/reverse-forward-reconcile.py` (into reconcile-final/) | 0 | identical to the committed reconcile-run except list order |

## 12. Acceptance

| Criterion | Met |
|---|---|
| reverse artifacts inventoried | True |
| 154 rules classified | True |
| programs and statements recalculated | True |
| 65 diagrams accounted | True |
| fields, records, copybooks reconciled | True |
| 15 JCL jobs assessed | True |
| gap counts reconciled without merging | True |
| verification recorded | True |
| BMad status represented | True |
| no COBOL equivalence claimed | True |
