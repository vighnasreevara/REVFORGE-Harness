# Application modernization status

Generated 2026-11-03T17:27:55.941Z from run `FWD-20261031T172520Z-66b3` (baseline `352b97f0bbcb…`).

**Workflow (F5) Java generation authorised: NO**. Blockers: config generation.java_generation_allowed is false (project authority); no authorised orchestrator.java_target_dir; G4 is BLOCKED (needs signed G2, G3 and G4 approvals by trusted signers); trust store: TRUST_NOT_CONFIGURED.

**Program-scoped local generation authorised (policy program_scoped_local_v1): 42 program(s)** (BCHCTL00 under LGA-0002, CKPRST under LGA-0003, HISTLD00 under LGA-0004, POSUPDT under LGA-0005, PRCSEQ00 under LGA-0006, RCVPRC00 under LGA-0007, RPTAUD00 under LGA-0008, RPTPOS00 under LGA-0009, RPTSTA00 under LGA-0010, RTNANA00 under LGA-0011, RTNCDE00 under LGA-0012, AUDPROC under LGA-0013, DB2CMT under LGA-0014, DB2CONN under LGA-0015, DB2ERR under LGA-0016, DB2STAT under LGA-0017, ERRPROC under LGA-0018, CURSMGR under LGA-0019, DB2ONLN under LGA-0020, DB2RECV under LGA-0021, ERRHNDL under LGA-0022, INQHIST under LGA-0023, INQONLN under LGA-0024, INQPORT under LGA-0025, SECMGR under LGA-0026, PORTADD under LGA-0027, PORTDEL under LGA-0028, PORTMSTR under LGA-0029, PORTREAD under LGA-0030, PORTTEST under LGA-0031, PORTTRAN under LGA-0032, PORTUPDT under LGA-0033, PORTVALD under LGA-0001, TSTGEN00 under LGA-0034, TSTVAL00 under LGA-0035, UTLMNT00 under LGA-0036, UTLMON00 under LGA-0037, UTLVAL00 under LGA-0038, DB2HNDL under LGA-0039, ERRHANDL under LGA-0040, FILEHNDL under LGA-0041, PROGNAME under LGA-0042). Every other program stays blocked.

No source analysis or architecture preparation is counted as a converted program below.

## Program counts

| Measure | Count |
|---|---|
| Programs in inventory | 42 |
| Programs attempted (analysed) | 42 |
| Programs locally authorised | 42 |
| Programs with Java generated | 41 |
| Programs compiled | 41 |
| Programs tested | 41 |
| COMPLETE | 2 |
| PARTIAL | 39 |
| FAILED | 1 |
| BLOCKED | 0 |
| NOT_ATTEMPTED | 0 |
| SOURCE_READINESS PASS | 1 |
| Parsed completely by the local converter | 1 |
| Converter-ready (parse + pre-emission checks) | 1 |

## Programs

| Program | Source | SHA-256 | Copybooks | Rules | SOURCE_READINESS | STEP 15 subset parser | Generation authorised | Java files | Compiled | Tests | Status | Blocked by / outstanding |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BCHCTL00 | yes | `876e218a3c1a…` | BCHCTL, BCHCON, ERRHAND | 3 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 9) | yes (LGA-0002) | 4 | COMPILED | 63 passed, 22 blocked as expected, 0 failed | **PARTIAL** | 11 open gap(s): UNDEFINED_PROCEDURE 11 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| CKPRST | yes | `870875c04b84…` | CKPRST, CKPRST, RETHND | 1 | FAIL (complete_program, dependencies_identified) | unsupported: FILE records (line 6) | yes (LGA-0003) | 2 | COMPILED | 39 passed, 8 blocked as expected, 0 failed | **PARTIAL** | 6 open gap(s): UNDECLARED_NAME 2, UNTRANSLATED_STATEMENT 4 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| HISTLD00 | yes | `148f75d448f2…` | HISTREC, BCHCTL, DBTBLS, SQLCA, SQLCA, DBPROC, ERRHAND, BCHCON | 4 | FAIL (copybooks_resolved, dependencies_identified) | unsupported: FILE records (line 6) | yes (LGA-0004) | 7 | COMPILED | 87 passed, 27 blocked as expected, 0 failed | **PARTIAL** | 25 open gap(s): UNSUPPORTED_DATA 3, UNDEFINED_PROCEDURE 2, UNDECLARED_NAME 16, EXTERNAL_SYSTEM_BOUNDARY 4 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| POSUPDT | no | `36a9e7f1c95b…` | - | 0 | FAIL (source_available) | unsupported: missing PROGRAM-ID (line 1) | yes (LGA-0005) | 0 | not run | not run | **FAILED** | the source cannot be converted: missing PROGRAM-ID |
| PRCSEQ00 | yes | `bf37a5d7a464…` | PRCSEQ, BCHCTL, BCHCON, ERRHAND | 15 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 6) | yes (LGA-0006) | 4 | COMPILED | 78 passed, 14 blocked as expected, 0 failed | **PARTIAL** | 5 open gap(s): UNDECLARED_NAME 4, COMPILER_OPTION_DEPENDENT 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| RCVPRC00 | yes | `7dd7e5cfb2b6…` | BCHCTL, PRCSEQ, BCHCON, ERRHAND | 11 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 9) | yes (LGA-0007) | 4 | COMPILED | 83 passed, 8 blocked as expected, 0 failed | **PARTIAL** | 1 open gap(s): COMPILER_OPTION_DEPENDENT 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| RPTAUD00 | yes | `1407e0aa1ad4…` | AUDITLOG, ERRHAND, RTNCODE | 0 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 7) | yes (LGA-0008) | 4 | COMPILED | 35 passed, 16 blocked as expected, 0 failed | **PARTIAL** | 14 open gap(s): UNSUPPORTED_DATA 3, UNDECLARED_NAME 4, UNDEFINED_PROCEDURE 7 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| RPTPOS00 | yes | `032436b2a4bd…` | POSREC, TRNREC, RTNCODE, ERRHAND | 1 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 6) | yes (LGA-0009) | 5 | COMPILED | 47 passed, 19 blocked as expected, 0 failed | **PARTIAL** | 17 open gap(s): UNSUPPORTED_DATA 4, UNDECLARED_NAME 8, UNDEFINED_PROCEDURE 5 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| RPTSTA00 | yes | `8b18c42b786a…` | DB2STAT, SQLCA, SQLCA, DBPROC, ERRHAND, BCHCTL, RTNCODE, ERRHAND | 0 | FAIL (copybooks_resolved, dependencies_identified, unsupported_documented) | unsupported: WS-CPU-TIME USAGE PACKED_DECIMAL (line 28) | yes (LGA-0010) | 4 | COMPILED | 45 passed, 18 blocked as expected, 0 failed | **PARTIAL** | 16 open gap(s): UNSUPPORTED_DATA 5, UNDECLARED_NAME 6, UNDEFINED_PROCEDURE 5 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| RTNANA00 | yes | `c9c49d1bea7a…` | SQLCA, SQLCA | 3 | FAIL (copybooks_resolved, dependencies_identified, unsupported_documented) | unsupported: FILE records (line 25) | yes (LGA-0011) | 3 | COMPILED | 34 passed, 6 blocked as expected, 0 failed | **PARTIAL** | 5 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 3, UNDECLARED_NAME 2 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| RTNCDE00 | yes | `7cb951ea1f41…` | SQLCA, SQLCA, RTNCODE | 4 | FAIL (copybooks_resolved) | unsupported: nested group WS-CURRENT-DATE (line 16) | yes (LGA-0012) | 4 | COMPILED | 21 passed, 5 blocked as expected, 0 failed | **PARTIAL** | 4 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 2, UNDECLARED_NAME 2 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| AUDPROC | yes | `c688d44dee1a…` | AUDITLOG | 0 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 7) | yes (LGA-0013) | 3 | COMPILED | 14 passed, 3 blocked as expected, 0 failed | **PARTIAL** | 1 open gap(s): COMPILER_OPTION_DEPENDENT 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| DB2CMT | yes | `d753db038a2a…` | SQLCA, SQLCA, DBPROC, ERRHAND | 3 | FAIL (copybooks_resolved, unsupported_documented) | unsupported: nested group DB2-ERROR-MESSAGE (line 11) | yes (LGA-0014) | 4 | COMPILED | 42 passed, 14 blocked as expected, 0 failed | **PARTIAL** | 8 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 4, UNDECLARED_NAME 4 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| DB2CONN | yes | `488a9dcd9fa7…` | SQLCA, SQLCA, DBPROC, ERRHAND | 5 | FAIL (copybooks_resolved, dependencies_identified, unsupported_documented) | unsupported: nested group DB2-ERROR-MESSAGE (line 11) | yes (LGA-0015) | 4 | COMPILED | 37 passed, 14 blocked as expected, 0 failed | **PARTIAL** | 10 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 4, UNDECLARED_NAME 5, UNDEFINED_EXTERNAL_CALL 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| DB2ERR | yes | `cb599435c5ae…` | DBTBLS, SQLCA, SQLCA, DBPROC, ERRHAND | 5 | FAIL (copybooks_resolved, dependencies_identified, unsupported_documented) | unsupported: WS-ERRLOG-REC PIC null (line 18) | yes (LGA-0016) | 4 | COMPILED | 53 passed, 10 blocked as expected, 0 failed | **PARTIAL** | 6 open gap(s): UNDECLARED_NAME 3, COMPILER_OPTION_DEPENDENT 1, EXTERNAL_SYSTEM_BOUNDARY 2 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| DB2STAT | yes | `082eb02647d2…` | SQLCA, SQLCA, DBPROC, ERRHAND | 2 | FAIL (copybooks_resolved, dependencies_identified, unsupported_documented) | unsupported: WS-CPU-TIME USAGE PACKED_DECIMAL (line 28) | yes (LGA-0017) | 4 | COMPILED | 33 passed, 21 blocked as expected, 0 failed | **PARTIAL** | 13 open gap(s): COMPILER_OPTION_DEPENDENT 2, EXTERNAL_SYSTEM_BOUNDARY 5, UNDECLARED_NAME 6 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| ERRPROC | yes | `b9bbfaaaaec4…` | ERRHAND | 0 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 27) | yes (LGA-0018) | 2 | COMPILED | 16 passed, 5 blocked as expected, 0 failed | **PARTIAL** | 3 open gap(s): COMPILER_OPTION_DEPENDENT 1, UNTRANSLATED_STATEMENT 2 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| CURSMGR | yes | `5e367102d18d…` | SQLCA, SQLCA | 2 | FAIL (evaluation error) | unsupported: WS-DB2-AREA PIC null (line 15) | yes (LGA-0019) | 3 | COMPILED | 18 passed, 17 blocked as expected, 0 failed | **PARTIAL** | 8 open gap(s): UNDEFINED_PROCEDURE 3, EXTERNAL_SYSTEM_BOUNDARY 2, UNDECLARED_NAME 2, UNTRANSLATED_STATEMENT 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| DB2ONLN | yes | `651889f0e13a…` | SQLCA, SQLCA, ERRHND | 3 | FAIL (copybooks_resolved) | unsupported: WS-DB2-AREA PIC null (line 15) | yes (LGA-0020) | 4 | COMPILED | 20 passed, 12 blocked as expected, 0 failed | **PARTIAL** | 7 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 4, UNDECLARED_NAME 3 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| DB2RECV | yes | `ca0e1dc9a3e8…` | SQLCA, SQLCA, ERRHND, DB2REQ | 6 | FAIL (copybooks_resolved, dependencies_identified) | unsupported: WS-DB2-AREA PIC null (line 15) | yes (LGA-0021) | 5 | COMPILED | 26 passed, 13 blocked as expected, 0 failed | **PARTIAL** | 9 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 5, UNDECLARED_NAME 3, UNSUPPORTED_DATA 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| ERRHNDL | yes | `11304d286466…` | ERRHND, SQLCA, SQLCA, ERRHND | 2 | FAIL (copybooks_resolved, dependencies_identified) | unsupported: WS-ERROR-AREA PIC null (line 15) | yes (LGA-0022) | 4 | COMPILED | 19 passed, 18 blocked as expected, 0 failed | **PARTIAL** | 17 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 2, UNSUPPORTED_DATA 2, UNDECLARED_NAME 13 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| INQHIST | yes | `ab4b4e2072fb…` | INQCOM, SQLCA, SQLCA, INQCOM | 2 | FAIL (copybooks_resolved, dependencies_identified) | unsupported: WS-COMMAREA PIC null (line 14) | yes (LGA-0023) | 4 | COMPILED | 23 passed, 16 blocked as expected, 0 failed | **PARTIAL** | 14 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 9, UNSUPPORTED_DATA 2, UNDECLARED_NAME 3 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| INQONLN | yes | `a05307ca63e1…` | INQCOM, ERRHND, INQCOM | 5 | FAIL (dependencies_identified) | unsupported: WS-COMMAREA PIC null (line 15) | yes (LGA-0024) | 4 | COMPILED | 17 passed, 21 blocked as expected, 0 failed | **PARTIAL** | 19 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 13, UNSUPPORTED_DATA 1, UNDECLARED_NAME 5 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| INQPORT | yes | `5c752c924310…` | INQCOM, POSREC, SQLPOS, INQCOM | 1 | FAIL (copybooks_resolved, dependencies_identified) | unsupported: WS-COMMAREA PIC null (line 14) | yes (LGA-0025) | 4 | COMPILED | 19 passed, 15 blocked as expected, 0 failed | **PARTIAL** | 13 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 4, UNSUPPORTED_DATA 4, UNDECLARED_NAME 5 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| SECMGR | yes | `74281106e716…` | SQLCA, SQLCA, ERRHND | 3 | FAIL (copybooks_resolved, dependencies_identified) | unsupported: WS-DB2-AREA PIC null (line 15) | yes (LGA-0026) | 4 | COMPILED | 16 passed, 13 blocked as expected, 0 failed | **PARTIAL** | 8 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 5, UNDECLARED_NAME 3 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| PORTADD | yes | `86cd685a216b…` | PORTFLIO, PORTFLIO | 5 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 11) | yes (LGA-0027) | 3 | COMPILED | 27 passed, 12 blocked as expected, 0 failed | **PARTIAL** | 7 open gap(s): UNDECLARED_NAME 7 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| PORTDEL | yes | `baaab39ebebe…` | PORTFLIO | 5 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 11) | yes (LGA-0028) | 3 | COMPILED | 27 passed, 4 blocked as expected, 0 failed | **PARTIAL** | 1 open gap(s): COMPILER_OPTION_DEPENDENT 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| PORTMSTR | yes | `9d1c7f7740ef…` | - | 9 | FAIL (dependencies_identified) | unsupported: FILE records (line 33) | yes (LGA-0029) | 2 | COMPILED | 25 passed, 22 blocked as expected, 0 failed | **PARTIAL** | 20 open gap(s): UNDECLARED_NAME 20 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| PORTREAD | yes | `1e90eef73115…` | PORTFLIO | 2 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 11) | yes (LGA-0030) | 3 | COMPILED | 19 passed, 0 blocked as expected, 0 failed | **COMPLETE** | equivalence: EQUIVALENCE_UNVERIFIED |
| PORTTEST | yes | `5cee7bdd6395…` | PORTFLIO, ERRHAND | 3 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 11) | yes (LGA-0031) | 3 | COMPILED | 28 passed, 5 blocked as expected, 0 failed | **PARTIAL** | 3 open gap(s): COMPILER_OPTION_DEPENDENT 3 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| PORTTRAN | yes | `6e8485dfeb00…` | TRNREC, PORTREC, ERRHAND, AUDITLOG | 13 | FAIL (copybooks_resolved, dependencies_identified, unsupported_documented) | unsupported: FILE records (line 6) | yes (LGA-0032) | 4 | COMPILED | 40 passed, 24 blocked as expected, 0 failed | **PARTIAL** | 22 open gap(s): UNSUPPORTED_DATA 6, UNDECLARED_NAME 15, UNTRANSLATED_STATEMENT 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| PORTUPDT | yes | `e386049e473b…` | PORTFLIO | 2 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 11) | yes (LGA-0033) | 3 | COMPILED | 28 passed, 2 blocked as expected, 0 failed | **PARTIAL** | 1 open gap(s): DATA_CONVERSION_UNDEFINED 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| PORTVALD | yes | `5957fd225462…` | PORTVAL | 6 | PASS | supported, 1 gap(s) | yes (LGA-0001) | 2 | COMPILED | 32 passed, 2 blocked as expected, 0 failed | **PARTIAL** | 1 open gap(s): DATA_CONVERSION_UNDEFINED 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| TSTGEN00 | yes | `9c6cd375f322…` | PORTFLIO, TRNREC, RTNCODE, ERRHAND | 2 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 43) | yes (LGA-0034) | 5 | COMPILED | 47 passed, 16 blocked as expected, 0 failed | **PARTIAL** | 14 open gap(s): UNDECLARED_NAME 6, UNDEFINED_PROCEDURE 8 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| TSTVAL00 | yes | `acdb86f9d38d…` | RTNCODE, ERRHAND | 2 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 45) | yes (LGA-0035) | 3 | COMPILED | 54 passed, 22 blocked as expected, 0 failed | **PARTIAL** | 13 open gap(s): UNDECLARED_NAME 6, UNDEFINED_PROCEDURE 7 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| UTLMNT00 | yes | `ea0333db7c05…` | RTNCODE, ERRHAND | 2 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 40) | yes (LGA-0036) | 3 | COMPILED | 37 passed, 25 blocked as expected, 0 failed | **PARTIAL** | 16 open gap(s): UNDECLARED_NAME 5, UNDEFINED_PROCEDURE 11 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| UTLMON00 | yes | `3e74b5376896…` | DB2STAT, SQLCA, SQLCA, DBPROC, ERRHAND, RTNCODE, ERRHAND | 2 | FAIL (copybooks_resolved, dependencies_identified, unsupported_documented) | unsupported: WS-CPU-TIME USAGE PACKED_DECIMAL (line 28) | yes (LGA-0037) | 3 | COMPILED | 40 passed, 25 blocked as expected, 0 failed | **PARTIAL** | 21 open gap(s): UNDECLARED_NAME 5, UNSUPPORTED_DATA 2, UNDEFINED_PROCEDURE 13, UNDEFINED_EXTERNAL_CALL 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| UTLVAL00 | yes | `953100864283…` | POSREC, TRNREC, RTNCODE, ERRHAND | 1 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILE records (line 6) | yes (LGA-0038) | 5 | COMPILED | 51 passed, 19 blocked as expected, 0 failed | **PARTIAL** | 17 open gap(s): UNDECLARED_NAME 6, UNSUPPORTED_DATA 3, UNDEFINED_PROCEDURE 8 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| DB2HNDL | yes | `6f7d5fb2ad1c…` | SQLCA, SQLCA | 0 | FAIL (copybooks_resolved, dependencies_identified) | unsupported: HV-TOTAL-VALUE USAGE PACKED_DECIMAL (line 40) | yes (LGA-0039) | 3 | COMPILED | 9 passed, 14 blocked as expected, 0 failed | **PARTIAL** | 12 open gap(s): EXTERNAL_SYSTEM_BOUNDARY 10, UNDECLARED_NAME 2 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| ERRHANDL | yes | `22548dd957ea…` | - | 3 | FAIL (dependencies_identified, unsupported_documented) | unsupported: FILLER is declared more than once (qualification is outside the subset) (line 33) | yes (LGA-0040) | 2 | COMPILED | 21 passed, 3 blocked as expected, 0 failed | **PARTIAL** | 1 open gap(s): UNTRANSLATED_STATEMENT 1 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| FILEHNDL | yes | `d9ca04c39498…` | - | 0 | FAIL (complete_program, dependencies_identified, unsupported_documented) | unsupported: FILE records (line 50) | yes (LGA-0041) | 2 | COMPILED | 9 passed, 2 blocked as expected, 0 failed | **PARTIAL** | 2 open gap(s): UNDEFINED_PROCEDURE 2 (paths blocked); equivalence: EQUIVALENCE_UNVERIFIED |
| PROGNAME | yes | `6199f4b373e5…` | - | 0 | FAIL (dependencies_identified) | unsupported: PERFORM UNTIL (line 57) | yes (LGA-0042) | 2 | COMPILED | 9 passed, 0 blocked as expected, 0 failed | **COMPLETE** | equivalence: EQUIVALENCE_UNVERIFIED |

## Integrated Java application

`forward/generated/java/app/`: 41 programs, 120 Java files, compilation **COMPILED**. Excluded: POSUPDT (conversion FAILED: the source cannot be converted: missing PROGRAM-ID).

| Test layer | Passed | Blocked as expected | Failed | Total |
|---|---|---|---|---|
| Runtime unit tests | 31 | 0 | 0 | 31 |
| Program checks (VALUE, gap probes, scenarios) | 1388 | 532 | 0 | 1920 |
|   of which source-derived scenarios | 69 | 141 | 0 | 210 |
| Integration tests (CALLs, JCL jobs) | 3 | 36 | 0 | 39 |

JCL jobs converted to job definitions: 15 (RPTAUD00: RPTAUD00; RPTPOS00: RPTPOS00; RPTSTA00: RPTSTA00; PORTADD: PORTADD; PORTDEF: IDCAMS (not converted); PORTDEL: PORTDEL; PORTREAD: PORTREAD; PORTTEST: PORTTEST; PORTUPDT: PORTUPDT; RTNANA00: RTNANA00; TSTGEN00: TSTGEN00; TSTVAL00: TSTVAL00; UTLMNT00: UTLMNT00; UTLMON00: UTLMON00; UTLVAL00: UTLVAL00).

Database: 0 SQL operations implemented against DB2; 42 executable EXEC SQL and 36 EXEC CICS statements are explicit boundaries (no DB2 or CICS available; no SQLCODE or response is invented).

## Construct families in the source (STEP 15 inventory; translated by the STEP 17 converter unless listed as gaps)

| Construct family | Programs | Which |
|---|---|---|
| file_io | 29 | BCHCTL00, HISTLD00, PRCSEQ00, RCVPRC00, RPTAUD00, RPTPOS00, RPTSTA00, RTNANA00, RTNCDE00, AUDPROC, DB2STAT, ERRPROC, CURSMGR, INQONLN, INQPORT, PORTADD, PORTDEL, PORTMSTR, PORTREAD, PORTTEST, PORTTRAN, PORTUPDT, TSTGEN00, TSTVAL00, UTLMNT00, UTLMON00, UTLVAL00, DB2HNDL, FILEHNDL |
| display_accept | 26 | HISTLD00, PRCSEQ00, RCVPRC00, RPTAUD00, RPTPOS00, RPTSTA00, RTNANA00, AUDPROC, DB2CMT, DB2ERR, DB2STAT, ERRPROC, PORTADD, PORTDEL, PORTMSTR, PORTREAD, PORTTEST, PORTTRAN, PORTUPDT, TSTGEN00, TSTVAL00, UTLMNT00, UTLMON00, DB2HNDL, ERRHANDL, FILEHNDL |
| file_section | 24 | BCHCTL00, CKPRST, HISTLD00, PRCSEQ00, RCVPRC00, RPTAUD00, RPTPOS00, RPTSTA00, RTNANA00, AUDPROC, ERRPROC, PORTADD, PORTDEL, PORTMSTR, PORTREAD, PORTTEST, PORTTRAN, PORTUPDT, TSTGEN00, TSTVAL00, UTLMNT00, UTLMON00, UTLVAL00, FILEHNDL |
| arithmetic | 21 | HISTLD00, PRCSEQ00, RCVPRC00, RPTPOS00, RTNANA00, DB2CMT, DB2CONN, DB2STAT, DB2ONLN, DB2RECV, PORTADD, PORTDEL, PORTREAD, PORTTEST, PORTTRAN, PORTUPDT, TSTGEN00, TSTVAL00, UTLMNT00, UTLVAL00, ERRHANDL |
| embedded_sql | 15 | HISTLD00, RTNANA00, RTNCDE00, DB2CMT, DB2CONN, DB2ERR, DB2STAT, CURSMGR, DB2ONLN, DB2RECV, ERRHNDL, INQHIST, INQPORT, SECMGR, DB2HNDL |
| intrinsic_function | 15 | BCHCTL00, PRCSEQ00, RCVPRC00, RTNANA00, RTNCDE00, DB2CMT, DB2CONN, DB2ERR, DB2STAT, DB2ONLN, ERRHNDL, SECMGR, PORTTEST, PORTTRAN, UTLMNT00 |
| perform_loop | 13 | PRCSEQ00, RCVPRC00, RPTPOS00, RPTSTA00, DB2CONN, DB2STAT, DB2RECV, TSTGEN00, TSTVAL00, UTLMNT00, UTLMON00, UTLVAL00, DB2HNDL |
| call | 12 | BCHCTL00, HISTLD00, PRCSEQ00, RCVPRC00, DB2CMT, DB2CONN, DB2ERR, DB2STAT, PORTMSTR, PORTTRAN, UTLMON00, ERRHANDL |
| cics | 8 | CURSMGR, DB2ONLN, DB2RECV, ERRHNDL, INQHIST, INQONLN, INQPORT, SECMGR |
| string_ops | 6 | RTNANA00, DB2ERR, DB2ONLN, ERRHNDL, PORTTEST, PORTTRAN |
| packed_decimal | 4 | DB2STAT, INQHIST, PORTMSTR, DB2HNDL |
| occurs | 2 | PRCSEQ00, INQHIST |

## Copybooks

| Copybook | Path | Used by | Data records (F2) | Java model |
|---|---|---|---|---|
| BCHCON | src/copybook/batch/BCHCON.cpy | BCHCTL00, HISTLD00, PRCSEQ00, RCVPRC00 | 1 | GENERATED with BCHCTL00 (forward/generated/java/BCHCTL00/), HISTLD00 (forward/generated/java/HISTLD00/), PRCSEQ00 (forward/generated/java/PRCSEQ00/), RCVPRC00 (forward/generated/java/RCVPRC00/) |
| BCHCTL | src/copybook/batch/BCHCTL.cpy | BCHCTL00, HISTLD00, PRCSEQ00, RCVPRC00, RPTSTA00 | 1 | GENERATED with BCHCTL00 (forward/generated/java/BCHCTL00/), HISTLD00 (forward/generated/java/HISTLD00/), PRCSEQ00 (forward/generated/java/PRCSEQ00/), RCVPRC00 (forward/generated/java/RCVPRC00/), RPTSTA00 (forward/generated/java/RPTSTA00/) |
| CKPRST | src/copybook/batch/CKPRST.cpy | CKPRST | 2 | GENERATED with CKPRST (forward/generated/java/CKPRST/) |
| PRCSEQ | src/copybook/batch/PRCSEQ.cpy | PRCSEQ00, RCVPRC00 | 2 | GENERATED with PRCSEQ00 (forward/generated/java/PRCSEQ00/), RCVPRC00 (forward/generated/java/RCVPRC00/) |
| AUDITLOG | src/copybook/common/AUDITLOG.cpy | RPTAUD00, AUDPROC, PORTTRAN | 1 | GENERATED with RPTAUD00 (forward/generated/java/RPTAUD00/), AUDPROC (forward/generated/java/AUDPROC/), PORTTRAN (forward/generated/java/PORTTRAN/) |
| COMMON | src/copybook/common/COMMON.cpy | - | 7 | NOT_GENERATED |
| ERRHAND | src/copybook/common/ERRHAND.cpy | BCHCTL00, HISTLD00, PRCSEQ00, RCVPRC00, RPTAUD00, RPTPOS00, RPTSTA00, DB2CMT, DB2CONN, DB2ERR, DB2STAT, ERRPROC, PORTTEST, PORTTRAN, TSTGEN00, TSTVAL00, UTLMNT00, UTLMON00, UTLVAL00 | 5 | GENERATED with BCHCTL00 (forward/generated/java/BCHCTL00/), HISTLD00 (forward/generated/java/HISTLD00/), PRCSEQ00 (forward/generated/java/PRCSEQ00/), RCVPRC00 (forward/generated/java/RCVPRC00/), RPTAUD00 (forward/generated/java/RPTAUD00/), RPTPOS00 (forward/generated/java/RPTPOS00/), RPTSTA00 (forward/generated/java/RPTSTA00/), DB2CMT (forward/generated/java/DB2CMT/), DB2CONN (forward/generated/java/DB2CONN/), DB2ERR (forward/generated/java/DB2ERR/), DB2STAT (forward/generated/java/DB2STAT/), ERRPROC (forward/generated/java/ERRPROC/), PORTTEST (forward/generated/java/PORTTEST/), PORTTRAN (forward/generated/java/PORTTRAN/), TSTGEN00 (forward/generated/java/TSTGEN00/), TSTVAL00 (forward/generated/java/TSTVAL00/), UTLMNT00 (forward/generated/java/UTLMNT00/), UTLMON00 (forward/generated/java/UTLMON00/), UTLVAL00 (forward/generated/java/UTLVAL00/) |
| HISTREC | src/copybook/common/HISTREC.cpy | HISTLD00 | 1 | GENERATED with HISTLD00 (forward/generated/java/HISTLD00/) |
| PORTFLIO | src/copybook/common/PORTFLIO.cpy | PORTADD, PORTDEL, PORTREAD, PORTTEST, PORTUPDT, TSTGEN00 | 1 | GENERATED with PORTADD (forward/generated/java/PORTADD/), PORTDEL (forward/generated/java/PORTDEL/), PORTREAD (forward/generated/java/PORTREAD/), PORTTEST (forward/generated/java/PORTTEST/), PORTUPDT (forward/generated/java/PORTUPDT/), TSTGEN00 (forward/generated/java/TSTGEN00/) |
| PORTVAL | src/copybook/common/PORTVAL.cpy | PORTVALD | 4 | GENERATED with PORTVALD (forward/generated/java/PORTVALD/) |
| POSREC | src/copybook/common/POSREC.cpy | RPTPOS00, INQPORT, UTLVAL00 | 1 | GENERATED with RPTPOS00 (forward/generated/java/RPTPOS00/), INQPORT (forward/generated/java/INQPORT/), UTLVAL00 (forward/generated/java/UTLVAL00/) |
| RETHND | src/copybook/common/RETHND.cpy | CKPRST | 2 | GENERATED with CKPRST (forward/generated/java/CKPRST/) |
| RTNCODE | src/copybook/common/RTNCODE.cpy | RPTAUD00, RPTPOS00, RPTSTA00, RTNCDE00, TSTGEN00, TSTVAL00, UTLMNT00, UTLMON00, UTLVAL00 | 1 | GENERATED with RPTAUD00 (forward/generated/java/RPTAUD00/), RPTPOS00 (forward/generated/java/RPTPOS00/), RPTSTA00 (forward/generated/java/RPTSTA00/), RTNCDE00 (forward/generated/java/RTNCDE00/), TSTGEN00 (forward/generated/java/TSTGEN00/), TSTVAL00 (forward/generated/java/TSTVAL00/), UTLMNT00 (forward/generated/java/UTLMNT00/), UTLMON00 (forward/generated/java/UTLMON00/), UTLVAL00 (forward/generated/java/UTLVAL00/) |
| TRNREC | src/copybook/common/TRNREC.cpy | RPTPOS00, PORTTRAN, TSTGEN00, UTLVAL00 | 1 | GENERATED with RPTPOS00 (forward/generated/java/RPTPOS00/), PORTTRAN (forward/generated/java/PORTTRAN/), TSTGEN00 (forward/generated/java/TSTGEN00/), UTLVAL00 (forward/generated/java/UTLVAL00/) |
| DBPROC | src/copybook/db2/DBPROC.cpy | HISTLD00, RPTSTA00, DB2CMT, DB2CONN, DB2ERR, DB2STAT, UTLMON00 | 1 | GENERATED with HISTLD00 (forward/generated/java/HISTLD00/), RPTSTA00 (forward/generated/java/RPTSTA00/), DB2CMT (forward/generated/java/DB2CMT/), DB2CONN (forward/generated/java/DB2CONN/), DB2ERR (forward/generated/java/DB2ERR/), DB2STAT (forward/generated/java/DB2STAT/), UTLMON00 (forward/generated/java/UTLMON00/) |
| DBTBLS | src/copybook/db2/DBTBLS.cpy | HISTLD00, DB2ERR | 2 | GENERATED with HISTLD00 (forward/generated/java/HISTLD00/), DB2ERR (forward/generated/java/DB2ERR/) |
| SQLCA | src/copybook/db2/SQLCA.cpy | HISTLD00, RPTSTA00, RTNANA00, RTNCDE00, DB2CMT, DB2CONN, DB2ERR, DB2STAT, CURSMGR, DB2ONLN, DB2RECV, ERRHNDL, INQHIST, SECMGR, UTLMON00, DB2HNDL | 1 | GENERATED with HISTLD00 (forward/generated/java/HISTLD00/), RPTSTA00 (forward/generated/java/RPTSTA00/), RTNANA00 (forward/generated/java/RTNANA00/), RTNCDE00 (forward/generated/java/RTNCDE00/), DB2CMT (forward/generated/java/DB2CMT/), DB2CONN (forward/generated/java/DB2CONN/), DB2ERR (forward/generated/java/DB2ERR/), DB2STAT (forward/generated/java/DB2STAT/), CURSMGR (forward/generated/java/CURSMGR/), DB2ONLN (forward/generated/java/DB2ONLN/), DB2RECV (forward/generated/java/DB2RECV/), ERRHNDL (forward/generated/java/ERRHNDL/), INQHIST (forward/generated/java/INQHIST/), SECMGR (forward/generated/java/SECMGR/), UTLMON00 (forward/generated/java/UTLMON00/), DB2HNDL (forward/generated/java/DB2HNDL/) |
| DB2REQ | src/copybook/online/DB2REQ.cpy | DB2RECV | 1 | GENERATED with DB2RECV (forward/generated/java/DB2RECV/) |
| ERRHND | src/copybook/online/ERRHND.cpy | DB2ONLN, DB2RECV, ERRHNDL, INQONLN, SECMGR | 1 | GENERATED with DB2ONLN (forward/generated/java/DB2ONLN/), DB2RECV (forward/generated/java/DB2RECV/), ERRHNDL (forward/generated/java/ERRHNDL/), INQONLN (forward/generated/java/INQONLN/), SECMGR (forward/generated/java/SECMGR/) |
| INQCOM | src/copybook/online/INQCOM.cpy | INQHIST, INQONLN, INQPORT | 1 | GENERATED with INQHIST (forward/generated/java/INQHIST/), INQONLN (forward/generated/java/INQONLN/), INQPORT (forward/generated/java/INQPORT/) |
| ERRLOG | src/database/db2/ERRLOG.sql | - | 0 | NOT_GENERATED |
| PORTPLAN | src/database/db2/PORTPLAN.sql | - | 0 | NOT_GENERATED |
| POSHIST | src/database/db2/POSHIST.sql | - | 0 | NOT_GENERATED |
| RTNCODES | src/database/db2/RTNCODES.sql | - | 0 | NOT_GENERATED |
| DB2-DEFINITIONS | src/database/db2/db2-definitions.sql | - | 0 | NOT_GENERATED |

## DB2 definitions

| Definition | Tables | Used by (embedded SQL) | Java |
|---|---|---|---|
| src/database/db2/db2-definitions.sql | PORTFOLIO_MASTER, INVESTMENT_POSITIONS, TRANSACTION_HISTORY | - | NOT_GENERATED (SQL communication-area and status-code semantics unresolved; open decisions: DR-F2-0011-001, DR-DB2CONN-002, DR-DB2ERR-001, DR-DB2RECV-002, DR-DB2HNDL-002, RVW-REC-SYS-PORTFOLIO-001-FIL-0056-REC-0003) |
| src/database/db2/ERRLOG.sql | ERRLOG | DB2ERR, ERRHNDL | NOT_GENERATED (SQL communication-area and status-code semantics unresolved; open decisions: DR-F2-0011-001, DR-DB2CONN-002, DR-DB2ERR-001, DR-DB2RECV-002, DR-DB2HNDL-002, RVW-REC-SYS-PORTFOLIO-001-FIL-0056-REC-0003) |
| src/database/db2/PORTPLAN.sql | - | - | NOT_GENERATED (SQL communication-area and status-code semantics unresolved; open decisions: DR-F2-0011-001, DR-DB2CONN-002, DR-DB2ERR-001, DR-DB2RECV-002, DR-DB2HNDL-002, RVW-REC-SYS-PORTFOLIO-001-FIL-0056-REC-0003) |
| src/database/db2/POSHIST.sql | POSHIST | HISTLD00 | NOT_GENERATED (SQL communication-area and status-code semantics unresolved; open decisions: DR-F2-0011-001, DR-DB2CONN-002, DR-DB2ERR-001, DR-DB2RECV-002, DR-DB2HNDL-002, RVW-REC-SYS-PORTFOLIO-001-FIL-0056-REC-0003) |
| src/database/db2/RTNCODES.sql | RTNCODES | RTNANA00, RTNCDE00 | NOT_GENERATED (SQL communication-area and status-code semantics unresolved; open decisions: DR-F2-0011-001, DR-DB2CONN-002, DR-DB2ERR-001, DR-DB2RECV-002, DR-DB2HNDL-002, RVW-REC-SYS-PORTFOLIO-001-FIL-0056-REC-0003) |

## JCL

| JCL | Programs executed | Launcher |
|---|---|---|
| src/jcl/batch/RPTAUD.jcl | RPTAUD00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/batch/RPTPOS.jcl | RPTPOS00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/batch/RPTSTA.jcl | RPTSTA00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/portfolio/PORTADD.jcl | PORTADD | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/portfolio/PORTDEF.jcl | IDCAMS | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/portfolio/PORTDEL.jcl | PORTDEL | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/portfolio/PORTREAD.jcl | PORTREAD | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/portfolio/PORTTEST.jcl | PORTTEST | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/portfolio/PORTUPDT.jcl | PORTUPDT | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/RTNANA.jcl | RTNANA00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/test/TSTGEN.jcl | TSTGEN00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/test/TSTVAL.jcl | TSTVAL00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/utility/UTLMNT.jcl | UTLMNT00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/utility/UTLMON.jcl | UTLMON00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |
| src/jcl/utility/UTLVAL.jcl | UTLVAL00 | NOT_GENERATED (scheduler, dataset and restart semantics are not converted) |

## Business rules

154 canonical rules, judged on each rule's own statement span: IMPLEMENTED_VERIFIED 67, IMPLEMENTED_VERIFIED_TO_GAP 15, IMPLEMENTED_EXERCISED 0, IMPLEMENTED_NOT_EXERCISED 40, BLOCKED 32, NOT_GENERATED 0 (equivalence with the legacy system unverified). By F1 disposition: mapped 108, deferred_decision 17, contradictory 2, deferred_scope 14, not_a_requirement 16. Per-rule program, line, requirements and status are in the JSON (`rules.list`).

## Gap groups

217 reverse-engineering gap groups (critical 6, high 86, medium 50, low 75); none is resolved by this step.

