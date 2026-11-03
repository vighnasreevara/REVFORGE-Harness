# Step 17: functional completeness assessment

## Final business-rule verification (latest pass)

This is a follow-up within Step 17. No new step or framework was added. Authorization, SHA-256 checks and both engineering gates are unchanged.

| Final status | Rules | Evidence |
|---|---|---|
| **IMPLEMENTED_VERIFIED** | **67** | A passing source-derived scenario executes the rule, or for 18 copybook level-88 rules, a generated condition check passes |
| **IMPLEMENTED_VERIFIED_TO_GAP** | **15** | The rule executes and every state it produces before the path's downstream gap matches the source; the path then ends at that expected gap |
| IMPLEMENTED_NOT_EXERCISED | 40 | Not reached. 38 sit behind a gap on every path; 2 are dead code that PORTTRAN never performs. None was forced to run. |
| BLOCKED | 32 | A gap lies inside the rule's own logic |
| **Total** | **154** | All rule identities preserved |

### What this pass did

**Partly tested rules: 16, now 0.**
- 41 new F6 scenarios assert each rule's own effects before its downstream gap: mode fields and 88-levels, return codes, error texts, counters, DISPLAY lines and rewritten or deleted records.
- 15 rules moved to VERIFIED_TO_GAP. BR-097 (PORTMSTR update or delete of a missing record) moved to fully VERIFIED, because that path ends normally.
- **F7 review caveats:**
  - **BR-046 and BR-060:** only one branch is reachable; the other needs a successful SQL CONNECT.
  - **BR-126:** the rule sets no data; its branches are distinguished by the gap each reaches.
  - **BR-089:** the reverse output locates this termination rule at the counter ADD; the totals DISPLAY itself is verified by normal-end scenarios.

**Unreachable rules: 40.**
- The source-traced reasons were re-checked by hand for 5 claims: PORTTRAN 2200 is never performed; the INQONLN security check runs after dispatch; PRCSEQ00 WS-SUB is undeclared; UTLMON00 DB2-STATS has no FD; BCHCTL00 2100 is undefined.
- No paragraph-level probe was used to bypass a gap.

**Testing and fixture defects fixed:**
- **Weak assertions:** a scenario asserting only "no DISPLAY" no longer counts as evidence of a rule.
- **Two wrong fixture expectations (PORTMSTR V01/V03):** they expected FILE STATUS '23' after the call, but 9000-ERROR (line 234) performs 6000-TERMINATE, whose CLOSE (line 228) resets the status to '00'. They were corrected from the source; the Java was already right.

**Per-rule detail:** `reports/step-17/business-rules-reconciliation.json` holds, for each of the 154 rules:
- status;
- COBOL `file:line` and statement span;
- Java location;
- the scenarios that executed it, with their results and the asserted state (470 test executions in all);
- blockers;
- exact reasons and review notes;
- the remaining evidence required.

### Remaining evidence required

| Rule group | Evidence still needed |
|---|---|
| All 82 implemented rules | Legacy execution results, for COBOL runtime equivalence |
| 15 VERIFIED_TO_GAP rules | Resolution of each downstream gap, then an end-to-end scenario |
| 38 rules behind gaps, and the 32 blocked rules | The missing dependency or corrected source: DB2/CICS runtime, PORTREC/SQLPOS/DB2STAT members, declarations, paragraphs, or the TIME STAMP environment definition |
| 2 dead-code rules | An owner decision whether PORTTRAN should post positions |

### Tests run

| Test layer | Result |
|---|---|
| Java compilation | 120 files, `-Xlint:all -Werror`: COMPILED |
| Runtime unit tests | 31 / 31 |
| Per-program checks | 1,920: 1,388 passed, 532 blocked as expected, 0 failed. Includes 210 scenarios (69 passed, 141 blocked as expected). |
| Integration | 39: 3 passed, 36 blocked as expected, 0 failed |
| Harness regression | 374 / 374 passed |

**Equivalence:** no COBOL runtime equivalence is claimed. No legacy execution results exist.

---

## Earlier pass

The rest of this document is the earlier assessment. Its rule table is superseded by the table above.

This is a follow-up within Step 17. No new step, agent, skill, gate or framework was added.

Per-rule detail is in `reports/step-17/business-rules-reconciliation.json` (154 rules). Every rule has its program, COBOL `file:line` and statement span, its Java location, its status, the exact blocking gaps and its resolvability.

**Bottom line:**
- Of 154 business rules, **66 are implemented and verified** by a passing source-derived test, and another 56 are implemented in Java but not proven.
- **32 are blocked** by gaps inside the rule's own logic.
- None of the 32 blocked rules can be resolved from the authorized source and reverse-engineering outputs without inventing code, data, SQL/CICS behaviour or a business decision.
- **Behavioural equivalence with the legacy system is not established.** There is no COBOL compiler and no captured legacy run, so no differential test was possible.

## 1. What changed in this pass

**Rule reconciliation is now exact.** A rule is now judged on its own COBOL statement span (from the parser's statement boundaries), not on its paragraph. Statement coverage is recorded in the generated Java. The earlier summary (74 implemented, 60 blocked, 20 unexplained) had two faults:
- It was too coarse: it called a rule blocked if any gap was in the same paragraph.
- It called "implemented" without checking that a test executed the rule.

**The 20 unexplained rules** are level-88 value-domain declarations, 18 of them in copybooks, for example `PORT-STATUS 88 PORT-ACTIVE 'A'`. They are now verified through generated condition checks: SET TO TRUE stores the declared value, encoded independently, and the condition then tests true.

**10 new source-derived scenarios** reach previously unexecuted rules: PRCSEQ00 NEXT, STAT and TERM, and RCVPRC00 sequence and recovery decisions. They use a new `calls` sequence, because WORKING-STORAGE persists across CALLs in one run unit. All 10 behave exactly as predicted from the source: 7 pass and 3 end at the named gap.

**Converter defects found and fixed:**
- `EXEC SQL DECLARE GLOBAL TEMPORARY TABLE` was treated as declarative. It is executable SQL and is now a boundary gap. Covered by a regression test.
- Level-88 checks were counted as behavioural scenarios. That would have let a gap-free program be labelled COMPLETE without any scenario. No label was actually affected, and it is fixed.

## 2. Business rules (154)

| Status | Rules | Meaning |
|---|---|---|
| **IMPLEMENTED_VERIFIED** | **66** | Java present, no gap in the rule's statement span, executed by a passing source-derived scenario. 48 are procedural rules in 13 programs; 18 are copybook level-88 rules verified by condition checks. |
| IMPLEMENTED_EXERCISED | 16 | Executed, but only on scenario paths that end at an expected gap later, so the full outcome is unproven |
| IMPLEMENTED_NOT_EXERCISED | 40 | Translated; 38 cannot be reached without first executing a gap; 2 are dead code that the source never performs (PORTTRAN 2200/2300) |
| **BLOCKED** | **32** | A gap lies inside the rule's own logic |

**Blockers inside the 32 BLOCKED rules:**

| Blocker | Count | Notes |
|---|---|---|
| Undeclared name | 27 | SQLCODE, DFHRESP and EIB fields (DB2/CICS precompilers), WS-SUB, the missing PORTREC fields, ambiguous duplicate declarations |
| EXEC SQL / EXEC CICS boundary | 7 | |
| Undefined paragraph | 3 | |
| No layout | 3 | |
| Non-standard ACCEPT FROM TIME STAMP / FUNCTION RANDOM | 2 | |

The reverse-engineering gap register gives the same causes:
- **GAP-002:** SQLCA only includes itself.
- **GAP-003:** PORTREC is not in the repository.
- **GAP-004:** the SQLPOS DCLGEN is missing.
- **GAP-086:** TIME STAMP is non-standard.

## 3. Executable end-to-end workflows

Each workflow below has passing source-derived tests.

| Workflow | Kind | What runs to completion | Where it stops |
|---|---|---|---|
| PORTVALD portfolio validation | CALLed service | ID, account (50 digits), investment type (STK/BND/MMF/ETF), invalid type; 16 of 17 reviewed cases | Non-digit amount (business decision) |
| PORTREAD | JCL job | Reads the KSDS master in key order, displays records and the total | – |
| PORTUPDT | JCL job | Status, name and value updates with REWRITE, not-found counting | Non-digit value (business decision) |
| PORTDEL | JCL job | Empty run; not-found handling with the full 18-byte key | Successful delete stops at audit ACCEPT FROM TIME STAMP |
| PORTMSTR | CALL | Create, read and update on the KSDS; ID-format and command validation; open failure | Audit CALL after update (undeclared LS-AUDIT-REQUEST) |
| RTNCDE00 return-code management | CALL | Initialise, set (highest code, status S/W/E/F), get | Log and analysis (SQL) |
| PRCSEQ00 process sequencing | CALL sequence | INIT builds control records in key order; STAT; TERM return code | NEXT (undeclared WS-SUB) |
| RCVPRC00 recovery | CALL sequence | INIT validation; sequence recovery: bypass (RC 4), terminate after more than 3 restarts (RC 8), boundary at 3 | Restart path (TIME STAMP) |
| DB2ERR SQLCODE diagnosis | CALL | Classifies -911, -913, -30081, -803, -204, +100 and 0 into return codes and messages | Logging (SQL, TIME STAMP) |
| DB2CMT / DB2CONN | CALL | Statistics initialisation and display; disconnect when not connected | Every real commit or connect (DB2) |

**Integration:**
- 3 JCL jobs (PORTREAD, PORTUPDT, PORTDEL) run end-to-end through the converted job definitions, mapping DD statements to data sets.
- 15 cross-program CALLs reach the converted ERRPROC, whose first statement is a gap.
- No online (CICS) or DB2 workflow can execute.

## 4. Unresolved dependencies

| Dependency | What it blocks | What would resolve it |
|---|---|---|
| DB2: 41 executable SQL statements, precompiler SQLCA (SQLCODE), SQLPOS DCLGEN | RTNANA00, RTNCDE00 L/A, the DB2* programs, SECMGR, HISTLD00 | A DB2 instance or an approved data-access design validated against DB2, with the precompiler's SQLCA. No embedded database is a permitted dependency here. |
| CICS: 36 EXEC CICS statements; translator-supplied EIB and DFHRESP | INQONLN, INQPORT, INQHIST, SECMGR, CURSMGR, DB2ONLN, DB2RECV | A CICS environment or an approved replacement for COMMAREA, RESP and LINK |
| Missing members PORTREC, SQLPOS, DB2STAT (names a program) | PORTTRAN, INQPORT, RPTSTA00, UTLMON00 | The members from the original load or PDS libraries |
| ACCEPT FROM TIME STAMP (8 sites), FUNCTION RANDOM, FUNCTION USER-ID | ERRPROC and AUDPROC (every CALL into them), PORTDEL delete, RCVPRC00 restart, PORTTEST | The legacy environment's definition of these sources |
| External programs CEE3ABD, ILBOABN0, DELAY; utility IDCAMS | ERRHANDL, UTLMON00, DB2CONN retry; PORTDEF job | Platform services (LE abend, delay, VSAM define) |
| Source defects | 27 rule blockers: undeclared names, undefined paragraphs (82 sites), duplicate declarations, empty `01 X. COPY Y` groups, SELECTs without FD | Corrected source from the owner; the converter must not invent them |
| Business decisions | Non-digit amounts (PORTVALD V14, PORTUPDT V); whether PORTTRAN should post positions (2200 is never performed) | Owner or SME decision |
| Specification conflict | `vsam-definitions.txt` (PORTMSTR KSDS 400 bytes, 12-byte key) vs the PORTMSTR FD (103-byte record, RECORD CONTAINS 100, 10-byte key) | Owner decision; the Java follows the program source |

## 5. Dangerous legacy defects, preserved and flagged

The Java keeps all of these as written. They are not silently changed.

1. **Endless loops on OPEN failure in PORTREAD, PORTDEL, PORTADD and PORTUPDT.**
   - The error path closes the files but does not stop.
   - The main loop then READs a closed file: status 47, never AT END.
   - FILEHNDL instead recurses through PERFORM 9100 → 3000 → 9000 → 9100.
2. **Authorization after the action in INQONLN.** It dispatches the portfolio and history inquiries before `P050-SECURITY-CHECK` (verified at lines 63–79). The check cannot prevent unauthorized inquiry.
3. **Silent data loss in PORTTRAN.** Validated transactions are counted as processed, but no position or audit record is written: 2200-UPDATE-POSITIONS is never performed (verified).
4. **Failures marked as done in RCVPRC00.**
   - A non-restartable failed process is marked DONE (RC 4), so dependent jobs proceed.
   - Sequence recovery reuses the caller's single process ID for every record.
5. **Wrong records updated in PRCSEQ00.** Keys are built from stale record-area fields (PSR-VERSION, BCT-SEQUENCE-NO), and START compares a date with process IDs. There is no OCCURS-100 bound check.
6. **Unconditional rewrites in PORTUPDT.** An unknown update action is still rewritten and counted as an update.
7. **Truncated records in PORTMSTR.** The record is 103 bytes but `RECORD CONTAINS 100`, and LS-PORTFOLIO is X(100), so 3 bytes are lost on every create and read.
8. **Impossible success path in PORTVALD.** No portfolio ID can pass, the amount range check is unreachable, and an invalid type returns code 1.
9. **Corrupt timestamps in DB2ERR and DB2ONLN.**
   - CURRENT-DATE substrings give corrupt log dates and times.
   - A STRING overflows into an 8-byte field.
   - The response code is overwritten by the connection count.
   - A STRING writes into its own source.
10. **Divide by zero in TSTVAL00.** It aborts (S0CB) with no test cases.
11. **Self-inflicted abends in UTLMON00 and PORTTEST.**
    - UTLMON00 has a real-time loop until 23:00 that calls the IBM abend routine every cycle.
    - PORTTEST takes a refmod subscript of 0 from FUNCTION RANDOM, generates duplicate PORT-IDs, and loops forever on a persistent write error.
12. **Addressability fault in RTNCDE00.** Its USING record is an empty group.

## 6. Verification performed

| Check | Result |
|---|---|
| Java compilation, integrated application | 120 files, `javac 21 -Xlint:all -Werror`: **COMPILED** |
| Runtime unit tests (COBOL semantics) | 31 / 31 passed |
| Per-program checks | 1,883: 1,385 passed, 498 blocked as expected, **0 failed**. Includes VALUE checks, level-88 condition checks, gap probes and 173 source-derived scenarios (66 passed, 107 blocked as expected). |
| Integration tests | 30: 3 passed, 27 blocked as expected, **0 failed** |
| Harness (TypeScript) tests | 374 / 374 passed |
| Trusted legacy comparison | **None possible.** No COBOL compiler or captured legacy run exists anywhere available. The upstream `output/` folder holds analysis artifacts, not program runs. |

**Level of behavioural equivalence.** Source-level conformance only:
- 66 rules behave as source-derived expectations predict on the paths tested.
- Expectations were written from the COBOL by agents of the same model family that built the converter, without seeing the Java. That is not independent human review.
- Platform representations not settled by the source are documented assumptions: datasets in ISO-8859-1 with EBCDIC overpunch, EBCDIC collation, LOW-VALUES for storage without VALUE.
- No equivalence with the production COBOL system is claimed.

Nothing was committed or pushed. The original COBOL and the reverse outputs are unchanged.
