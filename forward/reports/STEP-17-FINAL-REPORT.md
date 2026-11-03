# STEP 17 — Final full-application COBOL-to-Java conversion

> **Update:** the business-rule figures in this report (74 / 60 / 20) were classified by paragraph and are superseded by the per-statement reconciliation in `STEP-17-FUNCTIONAL-ASSESSMENT.md`: 66 verified, 16 exercised, 40 not exercised (unreachable or dead code), 32 blocked. Test counts there are also current.

All 42 inventory programs were processed. 41 now exist as compiled, tested Java 21 inside one integrated plain-Java application at `forward/generated/java/app/`. The 42nd, POSUPDT, has a one-line source file with no program in it, so there was nothing to convert.

The conversion is **not 100%**:
- 2 programs are COMPLETE and 39 are PARTIAL.
- The source sample is largely made of templates and incomplete programs. It uses undeclared names, PERFORMs of paragraphs that don't exist, and copybooks whose structure doesn't fit their COPY site.
- It also depends on DB2 and CICS, which are not available here.

All of that is preserved as 390 explicit, tested gaps rather than invented code. No COBOL compiler or legacy run exists, so equivalence with the legacy system is **unverified**.

## Totals

| Measure | Count |
|---|---|
| COBOL programs inventoried | 42 |
| Programs attempted | 42 |
| Programs with Java generated | 41 |
| Programs compiled (`javac 21 -Xlint:all -Werror`) | 41 |
| Programs tested | 41 |
| **COMPLETE** | **2** (PORTREAD, PROGNAME) |
| **PARTIAL** | **39** |
| **FAILED** | **1** (POSUPDT: the source contains no program, no PROGRAM-ID) |
| BLOCKED / NOT_ATTEMPTED | 0 / 0 |
| Business rules implemented in Java (statement translated in a paragraph without a gap) | 74 of 154 |
| Business rules generated but behind an open gap in the same paragraph | 60 |
| Business rules not implemented | 20: 18 copybook-level rules with no program, 2 whose line maps to no paragraph |
| Copybooks represented in Java | 19 of 25: 15 shared model classes, plus copybooks generated inside programs. 6 copybooks are not COPYed by any program. |
| Database operations implemented | **0**. 41 executable EXEC SQL statements are explicit boundaries; no DB2 is available and no SQLCODE is invented. |
| CICS operations implemented | **0**. 36 EXEC CICS statements are explicit boundaries. |
| Batch behaviours implemented | 15 JCL jobs converted to job definitions with DD-to-DSN, PARM and COND. 14 run converted programs; 1 (PORTDEF) is an IDCAMS utility boundary. 3 jobs run end-to-end to source-defined results: PORTREAD, PORTUPDT, PORTDEL. |
| Java unit tests passed | 31 of 31 runtime unit tests, plus 850 per-program checks passed and 494 blocked as expected, 0 failed (1,344 total) |
| of which source-derived scenarios | 163: 59 passed, 104 blocked as expected, 0 failed (17 programs with at least one passing scenario) |
| Java integration tests passed | 28: 3 passed, 25 blocked as expected, 0 failed (13 cross-program CALLs, 15 JCL jobs) |
| Actual COBOL differential tests | **0**: no COBOL compiler or captured legacy run exists |
| Harness (TypeScript) tests | **369 / 369 passed**: 354 earlier tests and 15 new Step 17 tests. Three earlier tests were adapted to Step 17 facts, as described under Testing. |

Machine-readable detail:
- per program, rule, copybook, job and gap: `forward/reports/step-17/application-status.json`;
- per program: `forward/generated/java/<P>/pilot-result.json` and `source-map.json`;
- integrated build: `forward/generated/java/app/integration-result.json`.

## What was built

All new code is in the existing pipeline. No new agent, skill, gate, framework or approval system was added, and nothing calls an external AI.

### Authorization

One consolidated record, accepted by the project owner (Vighnasree Vara) in this session ("Accept as stated"):
- It reuses policy `program_scoped_local_v1` (LGP-0001).
- It produced one LGA record per program, LGA-0002 to LGA-0042; PORTVALD keeps LGA-0001.
- Each record is bound by hash to the program, its copybooks, its JCL and DB2 dependencies, and the scope manifest `pilot/authorizations/APPLICATION.authorization-manifest.json` (sha256 `7c7bbaea…51af5c`).
- `java_generation_allowed` is still `false`, and the F5 guard and G0–G8 are unchanged.

### Converter, extended rather than replaced

| Component | What it does |
|---|---|
| Front end, `runtime/src/pilot/cobol-app.ts` | COPY REPLACING, continuations, the full data model on the shared layout parser, and the full statement set the 42 programs use |
| Back end, `runtime/src/pilot/java-app.ts` | One class per program, one method per paragraph, PERFORM/THRU fall-through, GO TO, sentence blocks for NEXT SENTENCE |
| Shared copybook models | One class per copybook layout; content is identical across all users |
| Source map | Every COBOL statement mapped to a Java line |
| Gaps | A numbered gap with a Java site and a probe test for every construct the source does not define |

### Runtime, `runtime/java/revforge/cobol` (hand-written, 20 files)

- **Data:** byte-storage views (REDEFINES, OCCURS, group moves); zoned, binary and packed numerics; MOVE category rules; numeric editing.
- **Arithmetic:** ROUNDED and ON SIZE ERROR; an undefined overflow fails explicitly.
- **Comparison:** EBCDIC collation. The JCL, VSAM and CICS sources establish IBM z/OS as the platform.
- **Files:** sequential (RECFM F/V) and indexed (KSDS) files with standard FILE STATUS.
- **Control:** CALL with LINKAGE binding, GOBACK and STOP RUN, ACCEPT and DISPLAY, CURRENT-DATE and NUMVAL.
- **Batch:** the JCL job runner.

### Commands

`pilot authorize` (consolidated input), `pilot convert-app`, `pilot integrate`.

### Integrated application, `forward/generated/java/app/`

120 Java files, compiled together:

| Part | Files | Lines |
|---|---|---|
| Converted programs | 41 | 20,478 |
| Copybook models | 15 | 710 |
| Generated tests | 41 | 1,714 |
| Runtime | 20 | 2,766 |
| Program registry, JCL job table and command-line `Main` | 3 | 115 |

- Run with `java -cp classes revforge.app.Main job <JOB> <data-root>`.
- The output is git-ignored and excluded from code backups. It can be rebuilt with `pilot convert-app` and then `pilot integrate`.

## Testing

- **Runtime unit tests (31).** COBOL language rules: zoned and packed signs, truncation, ROUNDED, SIZE ERROR, editing, collation, STRING, 88-levels, file status.
- **Per program:**
  - INIT checks: VALUE clauses, encoded independently by the converter.
  - Probes: one per gap site, which must throw that gap's ID.
  - Source-derived scenarios.
- **Scenario authors.** Five scenario-author agents wrote 146 of the 163 scenarios, working in the F6 role with the existing `fe-independent-fixture-design` skill:
  - They used only the COBOL source, the fixture contract and the gap list.
  - They never read the generated Java.
  - PORTVALD's 17 scenarios are the reviewed Step 14 cases.
- **Integration (28).**
  - 13 scenarios CALL the converted ERRPROC through the registry, where isolation had made the call unavailable. ERRPROC's first statement (ACCEPT FROM TIME STAMP) is a gap, so these block there, as the source dictates.
  - 15 JCL job runs.
- **Disagreements between scenarios and Java, and how they were resolved.** Each case was decided from the source. No expectation was changed to match the Java.
  - **PORTUPDT S04/S05:** a real converter defect. `88 UPDT-VALUE VALUE 'V'` lost its value because the parser matched `VALUE` inside the name. Fixed, and covered by a regression test in `tests/step17.test.ts`.
  - **PRCSEQ00 Q01:** a runner defect. Datasets were compared before the run unit closed its files. Fixed: the runner now ends the run unit first.
  - **RTNANA00 job:** my own fixture error. The JCL allocates RPTFILE as SYSOUT, so the job follows program scenario S02, not S01.
- **Earlier tests adapted to Step 17 facts.** The same behaviours are still checked:
  - **Step 11 "no unauthorized Java":** now also allows the authorized integration directory and the hand-written runtime.
  - **Step 16 PORTVALD checks:** now check V01–V17 inside the regenerated result.
  - **Step 16 "only PORTVALD authorized":** now requires every other record to belong to the accepted consolidated scope.
- **Not independent.** Converter, runtime and review share one author context (Claude Code in this session). The scenario agents are separate contexts but the same model; none of this is an independent human review.

## Program results

| Program | Source | Authorization | Java files | Compiled | Checks pass / blocked / fail | Scenarios pass / blocked | Rules impl. / blocked / other | Gaps | Status |
|---|---|---|---|---|---|---|---|---|---|
| BCHCTL00 | yes | LGA-0002 | 4 | COMPILED | 48 / 17 / 0 | 0 / 6 | 1 / 1 / 1 | no-para 11 | **PARTIAL** |
| CKPRST | yes | LGA-0003 | 2 | COMPILED | 0 / 8 / 0 | 0 / 2 | 0 / 1 / 0 | invalid-stmt 4, undeclared 2 | **PARTIAL** |
| HISTLD00 | yes | LGA-0004 | 7 | COMPILED | 67 / 27 / 0 | 0 / 2 | 1 / 3 / 0 | undeclared 16, SQL/CICS 4, no-layout 3, no-para 2 | **PARTIAL** |
| POSUPDT | no statements | LGA-0005 | 0 | not run | - | - | 0 / 0 / 0 | - | **FAILED** |
| PRCSEQ00 | yes | LGA-0006 | 4 | COMPILED | 50 / 8 / 0 | 2 / 3 | 11 / 4 / 0 | undeclared 4, compiler 1 | **PARTIAL** |
| RCVPRC00 | yes | LGA-0007 | 4 | COMPILED | 51 / 4 / 0 | 3 / 3 | 10 / 1 / 0 | compiler 1 | **PARTIAL** |
| RPTAUD00 | yes | LGA-0008 | 4 | COMPILED | 12 / 16 / 0 | 0 / 2 | 0 / 0 / 0 | no-para 7, undeclared 4, no-layout 3 | **PARTIAL** |
| RPTPOS00 | yes | LGA-0009 | 5 | COMPILED | 27 / 19 / 0 | 0 / 2 | 0 / 1 / 0 | undeclared 8, no-para 5, no-layout 4 | **PARTIAL** |
| RPTSTA00 | yes | LGA-0010 | 4 | COMPILED | 31 / 18 / 0 | 0 / 2 | 0 / 0 / 0 | undeclared 6, no-layout 5, no-para 5 | **PARTIAL** |
| RTNANA00 | yes | LGA-0011 | 3 | COMPILED | 34 / 6 / 0 | 1 / 1 | 1 / 2 / 0 | SQL/CICS 3, undeclared 2 | **PARTIAL** |
| RTNCDE00 | yes | LGA-0012 | 4 | COMPILED | 12 / 5 / 0 | 5 / 1 | 3 / 1 / 0 | SQL/CICS 2, undeclared 2 | **PARTIAL** |
| AUDPROC | yes | LGA-0013 | 3 | COMPILED | 0 / 3 / 0 | 0 / 2 | 0 / 0 / 0 | compiler 1 | **PARTIAL** |
| DB2CMT | yes | LGA-0014 | 4 | COMPILED | 35 / 14 / 0 | 3 / 6 | 2 / 1 / 0 | SQL/CICS 4, undeclared 4 | **PARTIAL** |
| DB2CONN | yes | LGA-0015 | 4 | COMPILED | 32 / 13 / 0 | 1 / 3 | 1 / 4 / 0 | undeclared 5, SQL/CICS 4, ext-call 1 | **PARTIAL** |
| DB2ERR | yes | LGA-0016 | 4 | COMPILED | 41 / 10 / 0 | 7 / 4 | 5 / 0 / 0 | undeclared 3, SQL/CICS 2, compiler 1 | **PARTIAL** |
| DB2STAT | yes | LGA-0017 | 4 | COMPILED | 29 / 17 / 0 | 0 / 5 | 1 / 1 / 0 | undeclared 6, SQL/CICS 4, compiler 2 | **PARTIAL** |
| ERRPROC | yes | LGA-0018 | 2 | COMPILED | 16 / 5 / 0 | 0 / 2 | 0 / 0 / 0 | invalid-stmt 2, compiler 1 | **PARTIAL** |
| CURSMGR | yes | LGA-0019 | 3 | COMPILED | 12 / 14 / 0 | 0 / 6 | 0 / 2 / 0 | no-para 3, SQL/CICS 2, undeclared 2, invalid-stmt 1 | **PARTIAL** |
| DB2ONLN | yes | LGA-0020 | 4 | COMPILED | 11 / 11 / 0 | 0 / 4 | 1 / 2 / 0 | SQL/CICS 4, undeclared 3 | **PARTIAL** |
| DB2RECV | yes | LGA-0021 | 5 | COMPILED | 11 / 13 / 0 | 0 / 4 | 3 / 3 / 0 | SQL/CICS 5, undeclared 3, no-layout 1 | **PARTIAL** |
| ERRHNDL | yes | LGA-0022 | 4 | COMPILED | 7 / 18 / 0 | 0 / 1 | 0 / 2 / 0 | undeclared 13, SQL/CICS 2, no-layout 2 | **PARTIAL** |
| INQHIST | yes | LGA-0023 | 4 | COMPILED | 10 / 16 / 0 | 0 / 2 | 0 / 2 / 0 | SQL/CICS 9, undeclared 3, no-layout 2 | **PARTIAL** |
| INQONLN | yes | LGA-0024 | 4 | COMPILED | 1 / 21 / 0 | 0 / 2 | 0 / 5 / 0 | SQL/CICS 13, undeclared 5, no-layout 1 | **PARTIAL** |
| INQPORT | yes | LGA-0025 | 4 | COMPILED | 6 / 15 / 0 | 0 / 2 | 0 / 1 / 0 | undeclared 5, SQL/CICS 4, no-layout 4 | **PARTIAL** |
| SECMGR | yes | LGA-0026 | 4 | COMPILED | 7 / 13 / 0 | 0 / 5 | 0 / 3 / 0 | SQL/CICS 5, undeclared 3 | **PARTIAL** |
| PORTADD | yes | LGA-0027 | 3 | COMPILED | 8 / 10 / 0 | 0 / 3 | 1 / 4 / 0 | undeclared 7 | **PARTIAL** |
| PORTDEL | yes | LGA-0028 | 3 | COMPILED | 10 / 2 / 0 | 2 / 1 | 4 / 0 / 1 | compiler 1 | **PARTIAL** |
| PORTMSTR | yes | LGA-0029 | 2 | COMPILED | 11 / 21 / 0 | 5 / 1 | 8 / 1 / 0 | undeclared 20 | **PARTIAL** |
| PORTREAD | yes | LGA-0030 | 3 | COMPILED | 8 / 0 / 0 | 2 / 0 | 2 / 0 / 0 | - | **COMPLETE** |
| PORTTEST | yes | LGA-0031 | 3 | COMPILED | 22 / 4 / 0 | 1 / 1 | 1 / 2 / 0 | compiler 3 | **PARTIAL** |
| PORTTRAN | yes | LGA-0032 | 4 | COMPILED | 16 / 24 / 0 | 0 / 2 | 7 / 5 / 0 | undeclared 15, no-layout 6, invalid-stmt 1 | **PARTIAL** |
| PORTUPDT | yes | LGA-0033 | 3 | COMPILED | 12 / 2 / 0 | 5 / 1 | 1 / 1 / 0 | data-conv 1 | **PARTIAL** |
| PORTVALD | yes | LGA-0001 | 2 | COMPILED | 28 / 2 / 0 | 16 / 1 | 5 / 1 / 0 | data-conv 1 | **PARTIAL** |
| TSTGEN00 | yes | LGA-0034 | 5 | COMPILED | 23 / 16 / 0 | 0 / 2 | 0 / 2 / 0 | no-para 8, undeclared 6 | **PARTIAL** |
| TSTVAL00 | yes | LGA-0035 | 3 | COMPILED | 43 / 18 / 0 | 1 / 5 | 1 / 1 / 0 | no-para 7, undeclared 6 | **PARTIAL** |
| UTLMNT00 | yes | LGA-0036 | 3 | COMPILED | 26 / 21 / 0 | 1 / 5 | 0 / 1 / 0 | no-para 11, undeclared 5 | **PARTIAL** |
| UTLMON00 | yes | LGA-0037 | 3 | COMPILED | 29 / 25 / 0 | 0 / 4 | 1 / 1 / 0 | no-para 13, undeclared 5, no-layout 2, ext-call 1 | **PARTIAL** |
| UTLVAL00 | yes | LGA-0038 | 5 | COMPILED | 29 / 19 / 0 | 0 / 2 | 0 / 1 / 0 | no-para 8, undeclared 6, no-layout 3 | **PARTIAL** |
| DB2HNDL | yes | LGA-0039 | 3 | COMPILED | 9 / 14 / 0 | 0 / 2 | 0 / 0 / 0 | SQL/CICS 10, undeclared 2 | **PARTIAL** |
| ERRHANDL | yes | LGA-0040 | 2 | COMPILED | 17 / 3 / 0 | 0 / 2 | 3 / 0 / 0 | invalid-stmt 1 | **PARTIAL** |
| FILEHNDL | yes | LGA-0041 | 2 | COMPILED | 2 / 2 / 0 | 2 / 0 | 0 / 0 / 0 | no-para 2 | **PARTIAL** |
| PROGNAME | yes | LGA-0042 | 2 | COMPILED | 7 / 0 / 0 | 2 / 0 | 0 / 0 / 0 | - | **COMPLETE** |

Gap-kind short names:

| Short name | Gap kind |
|---|---|
| SQL/CICS | executable EXEC SQL or EXEC CICS |
| undeclared | a name declared nowhere, or ambiguous |
| no-para | a PERFORM or GO TO of a paragraph that does not exist |
| no-layout | an item whose layout is not determinable |
| compiler | behaviour that depends on the compiler (ACCEPT FROM TIME STAMP, FUNCTION RANDOM) |
| invalid-stmt | a statement that is not valid COBOL as written |
| ext-call | a CALL outside the application |
| data-conv | an undefined alphanumeric-to-numeric MOVE |

The "Java files" column counts the program class, its test class and the copybook models it uses.

AUDPROC and CKPRST fail CONVERSION_VALIDATION on `tests_passed` only: every executed path blocks immediately, so no check can pass. Their Java is generated, compiled and probed.

## Unconverted or uncertain behaviour (390 open gaps)

| Gap kind | Count | Cause in the source |
|---|---|---|
| UNDECLARED_NAME | 171 | Names declared nowhere: template programs, copybook field-name mismatches (for example HISTREC vs `TH-*`), SQLCODE (the repository's SQLCA.cpy only INCLUDEs the precompiler's SQLCA), and EIBRESP/DFHRESP (CICS translator) |
| UNDEFINED_PROCEDURE | 82 | PERFORMs of paragraphs that are not in the program; the source as written would not compile |
| EXTERNAL_SYSTEM_BOUNDARY | 77 | 41 EXEC SQL and 36 EXEC CICS; no DB2 or CICS here |
| UNSUPPORTED_DATA | 36 | `01 X. COPY Y.` where Y starts with its own 01 (empty group); SELECTs without an FD |
| COMPILER_OPTION_DEPENDENT | 11 | ACCEPT FROM TIME STAMP (non-standard, 8) and FUNCTION RANDOM (3) |
| UNTRANSLATED_STATEMENT | 9 | 7 are invalid COBOL as written: 4 comments in area B (CKPRST), 2 literals past column 72 (ERRPROC), and 1 paragraph header without a period (CURSMGR). 2 are converter limitations: a CALL 'CEE3ABD' with a numeric-literal argument (ERRHANDL; the target is outside the application in any case) and the non-standard FUNCTION USER-ID (PORTTRAN) |
| UNDEFINED_EXTERNAL_CALL | 2 | CALL 'DELAY' (DB2CONN) and CALL 'ILBOABN0' (UTLMON00): programs outside the inventory |
| DATA_CONVERSION_UNDEFINED | 2 | Alphanumeric-to-numeric MOVEs (PORTVALD V14 and PORTUPDT V); only all-digit content is defined |

**PORTVALD V13/V14.** V13 (an all-digit amount) passes and V14 stays blocked. Equivalence of the amount conversion is not claimed.

**Source defects that the Java preserves.** The scenario authors and the review found these; the Java keeps them as written and does not "fix" them:
- In PORTREAD, PORTDEL, PORTADD and PORTUPDT, an OPEN failure leads to an endless READ loop (the file is closed and the status 47 is not AT END).
- TSTVAL00 divides by zero when there are no test cases (ABEND S0CB).
- PORTMSTR declares RECORD CONTAINS 100 for a 103-byte record.
- RTNCDE00's USING record is an empty group.

**Runtime assumptions.** These representations are not established by any captured data, and are documented:
- datasets are held in ISO-8859-1 with the EBCDIC overpunch sign letters;
- storage without a VALUE clause starts as LOW-VALUES.

## Integrity and security

- **Protected material unchanged:**
  - the original COBOL (manifest hashes re-verified by every conversion);
  - `output/`, the reverse agents and skills, and G0–G8;
  - historical records. The audit log was only appended: 330 to 576 events (41 authorizations, conversion and integration events).
- **No fabrication:** no fake approvals, signers or keys.
- **No external calls:** no external AI, OpenAI or BMad calls; no Neo4j changes. `NEO4J_PASSWORD` and `.mcp.json` values were not used.
- **Source disclosure:** COBOL source was read in this session and by the scenario agents (Claude, same session scope) to develop the converter and write fixtures, as the accepted record permits for review. The sample is the public Apache-2.0 upstream.
- **No inventory names in the runtime:** `runtime/src` names no inventory program (checked by the step1 guard plus a Step 17 check).
- **Not committed:** nothing was committed or pushed (HEAD `b092004`), and generated Java is git-ignored (`git ls-files '*.java'` is empty).

## Build, recovery and backup

| Item | Value |
|---|---|
| Backup | `revforge-forward-20261103T023601Z` |
| Files | 735 |
| Archive sha256 | `d40aa6ae…7c1a91` |
| Tree sha256 | `383bf7a6…299071` |
| Excluded | `forward/generated/java` (1,899 files) |
| Verify | OK (735 entries, no problems) |
| Restore test (checkout, local assets, build, test) | **365 / 369 passed, 0 failed, 4 skipped** |

The 4 skipped tests check the generated output, which backups exclude by design. The fixtures, authorization inputs, manifest, runtime and converter are all in the backup.

**Rebuild from a restored copy:**
1. `npm run build`.
2. Set REVFORGE_COBOL_SOURCE_ROOT and REVFORGE_JAVA_HOME.
3. `node dist/runtime/src/cli.js pilot convert-app`.
4. `node dist/runtime/src/cli.js pilot integrate`.
