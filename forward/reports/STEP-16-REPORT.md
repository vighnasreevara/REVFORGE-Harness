# STEP 16: first real COBOL-to-Java generation (PORTVALD)

PORTVALD was converted to Java 21 with the existing deterministic local converter, under a program-scoped authorization that the project owner accepted. The Java compiles cleanly. 16 of the 17 reviewed test cases pass. The 17th, V14, stays blocked by the open amount-conversion gap, as required. The program is classified **PARTIAL**.

No other program was authorized, so no other program was converted. Equivalence with a real COBOL execution has not been established, because no COBOL compiler is available.

## Counts

| Measure | Value |
|---|---|
| Harness (TypeScript) tests | **354 / 354 passed**: 342 baseline + 12 new, 0 failed, 0 skipped |
| Java tests: fixture harness inside the conversion | 17 cases: **16 PASS, 1 BLOCKED_AS_EXPECTED (V14), 0 FAIL** |
| Java tests: separate direct `java` run | 26 inputs (17 Step 14 cases + 9 extra edge probes): **26 / 26 as expected** |
| COBOL differential tests | **0**. No COBOL compiler is available (`COBOL_COMPILER_UNAVAILABLE`), so equivalence is unverified. |
| Programs converted (Java generated, compiled, tested) | **1** (PORTVALD) |
| Programs PARTIAL | **1** (PORTVALD) |
| Programs COMPLETE / FAILED | 0 / 0 |
| Programs BLOCKED | **41** |
| Programs NOT_ATTEMPTED | 0 |

Java fixture validation is complete. Equivalence between the executed COBOL and the Java has not been established.

## 1. Baseline test results

- **Before any Step 16 change:** 342 / 342 passed.
- **Pre-generation backup:** `revforge-forward-20261102T233508Z` (660 entries) verified. Its restore test passed 342 / 342.
  - The first restore attempt showed 327 passed and 15 skipped, because the COBOL source root was not set.
  - With the source root set, the restore test passed 342 / 342.
- **Git:** branch `main`, HEAD `b092004`. The untracked set was the same as at the start.

## 2. Files modified

All paths are under `forward/`.

| File | Change |
|---|---|
| `runtime/src/pilot/pilot.ts` | `convertCore()` extracted from `runPilot`, so the synthetic pilot and authorized generation share one converter. Compile results now record the command, exit code and class files. The synthetic refusals are unchanged. |
| `runtime/src/pilot/authorization.ts` | **New.** Policy and authorization records (LGP/LGA) with audit sealing, and the fail-closed `checkLocalAuthorization`. |
| `runtime/src/pilot/generate.ts` | **New.** `generateAuthorized`, plus the conversion from reviewed test cases into field-list fixtures. |
| `runtime/src/pilot/application.ts` | Reads validated authorized output from `forward/generated/java/<P>/`. Maps rules to Java lines through the source map. Shows models for authorized copybooks. |
| `runtime/src/commands/pilot.ts` | New `pilot authorize`, `pilot authorization` and `pilot generate`. |
| `contracts/pilot/local-generation-record.schema.json` | **New.** Contract for LGP and LGA records. |
| `contracts/pilot/pilot-result.schema.json` | `synthetic` may be `false` only with an `authorization` block. The isolation constants still apply to synthetic results. `external_ai_calls` is always `false`. |
| `pilot/authorizations/PORTVALD.authorization-input.json` | **New.** The exact accepted text and record. It contains hashes and paths, not source. |
| `tests/step16.test.ts` | **New.** 12 tests. |
| `tests/step11.test.ts` | Invariant 16 is made precise, not weakened: Java may exist only in synthetic pilot output, or in a generation directory whose local authorization passes for exactly that program and directory. The checks for the F5 guard, the `generate` refusal and "no tracked Java" are unchanged. |
| `tools/backup.js` | Excludes `forward/generated/`. |
| `.gitignore` | Adds `generated/`. |
| `docs/PILOT-OPERATIONS.md` | New section 3, "Authorised local generation". |
| `reports/STEP-16-REPORT.md`, `reports/APPLICATION-MODERNIZATION-STATUS.md` | This report, and the regenerated status. |
| `reports/step-16/application-status.json`, `reports/step-16/portvald-review.json` | Machine exports. |

**Workflow store** (run `FWD-20261031T172520Z-66b3`):
- new files `generation/LGP-0001.json` and `generation/LGA-0001.json`;
- 3 new audit events (327 → 330): `local_generation_policy_adopted`, `local_generation_authorized` and `local_generation_performed`;
- no existing record was modified.

## 3. Authorization policy and evidence

- **Policy:** `program_scoped_local_v1` (LGP-0001), adopted by **Vighnasree Vara** on 2026-11-02.
  - It applies to deterministic local conversion only.
  - Under it, a project-owner-accepted record bound to exact source hashes replaces the G2–G4 signature requirement. No Ed25519 signature is needed.
  - The G0–G8 records are untouched. F5 and any AI-agent generation still require G2–G4.
- **Evidence:**
  - The answer "Accept as stated" in this Claude Code session, with owner name "Vighnasree Vara".
  - The exact text presented is stored in the record. Its sha256 is `9fee4e90…81e06df` (1,126 characters).
  - The record is sealed in the audit log. A modified record fails `record_sealed`, which is tested.
- **What did not change:**
  - `generation.java_generation_allowed` is still `false`.
  - `generationAuthorized()` (the F5 guard) is unchanged and still returns `false`.
  - `authorisationStatus` still reports its 4 blockers.
  - The `generate` command (F5) still refuses.
  - No approval, signer, key or force flag was created.

## 4. Authorized program and source hashes

LGA-0001: **PORTVALD only**. Valid from 2026-11-02 to 2026-12-02.

| Input | Path | SHA-256 |
|---|---|---|
| Program | `src/programs/portfolio/PORTVALD.cbl` | `5957fd22546258ae4d9e28847269168d1824bf8d11a9e661f9f62a5adc47f603` |
| Copybook | `src/copybook/common/PORTVAL.cpy` | `8d9c7666b01561c4eba4d1e0a95b9da62baaa60c9dcfc2aa5effff06854104bf` |

The hashes are checked at three points: when the record is created, before generation and after generation. Both were re-confirmed unchanged at the end of the step. COPY members are resolved only from the hash-bound copybook list. Every CALL target is treated as unavailable, which makes it a gap.

Other refusals were demonstrated with the real record:
- PORTUPDT and RTNCDE00 → `program_authorized` FAIL;
- `generated/java/OTHER` → `output_dir_authorized` FAIL.

## 5. Approved output directory

`forward/generated/java/PORTVALD/` must match exactly; a parent or sibling directory is refused.
- It is git-ignored (checked with `git check-ignore`).
- It is excluded from code backups: the final backup lists 15 files there as excluded, and the archive contains no `.java` file.
- `git ls-files '*.java'` returns nothing.
- It can be rebuilt with `pilot generate --program PORTVALD --cases reports/step-14/portvald-test-cases.json`.

## 6. Actual Java files generated

Package `revforge.generated.portvald`, 311 lines in total.

| File | Purpose |
|---|---|
| `Portvald.java` (111 lines) | The program: one method per paragraph, WORKING-STORAGE as instance fields |
| `LsValidationRequest.java` (32) | LINKAGE record (from copybook PORTVAL), length 103 |
| `Cobol.java` (119) | Helpers: MOVE semantics, alphanumeric compare and padding, NUMERIC class test, decimal truncation, the gap guard |
| `UnresolvedGapException.java` (18) | Thrown on any path that depends on an open gap; never turned into a default |
| `PilotHarness.java` (31) | Fixture harness (stdin to stdout) |

The output directory also holds `source-map.json`, `pilot-result.json` and `evidence-manifest.json` (the sha256 of every input and output).

## 7. Java compilation result

**COMPILED**:
- command: `javac 21.0.13` with `-encoding UTF-8 -Xlint:all -Werror`;
- exit code 0, 0 diagnostics, 7 class files.

## 8. Java test results

**Fixture harness** (part of the conversion; validated by CONVERSION_VALIDATION):
- 16 PASS: V01–V13 and V15–V17.
- V14 (`M|100.00`) ends `BLOCKED GAP-PORTVALD-0001`, which is the expected result.

**Separate direct `java` run** (`scratchpad/javarun16.py`). Inputs and expectations were rebuilt from the Step 14 cases, independently of the converter's fixture conversion. All 26 lines came out as expected:
- all 17 Step 14 cases;
- 9 extra probes:
  - a 49-digit account → 2;
  - a 50-nines account → 0;
  - a 50-digit amount with a high-order 1 → 0 (truncation, see RV-16-01);
  - empty and signed amounts → BLOCKED;
  - `ETFX` → 3;
  - `PORT` → 1;
  - an empty type → 1, "Invalid validation type";
  - an initial return code of 99999 → `INVALID_INPUT` (a harness limit).

**Behaviours preserved as written:**
- **ID check:** it has no success path. The 4 characters moved into X(10) leave spaces, so the NUMERIC test always fails (V01, V02).
- **Account:** exactly 50 digits, and not all zeros.
- **Types:** STK, BND, MMF and ETF, case-sensitive and space-padded.
- **Invalid validation type:** WHEN OTHER returns code 1.

**CONVERSION_VALIDATION on the output: PASS, label PARTIAL.** It checks:
- evidence intact;
- compiled;
- tests;
- traceability;
- no fabrication;
- the label is accurate.

## 9. Source-to-Java traceability

- **39 / 39** COBOL procedure statements are mapped to Java lines (`source-map.json`). Every Java statement carries a `PORTVALD.cbl:<line>` comment.
- **Paragraph mapping:** 0000-MAIN → `p0000Main`, 1000 → `p1000ValidateId`, 2000 → `p2000ValidateAccount`, 3000 → `p3000ValidateType`, 4000 → `p4000ValidateAmount` (blocked by the gap).
- **Trace audit verdict:** NO_FINDINGS.
- **Business rules** (from the application status JSON):

| Rule | Status | Java location |
|---|---|---|
| BR-118 | generated | `Portvald.java:41` |
| BR-119 | generated | `Portvald.java:63` |
| BR-120 | generated | `Portvald.java:69` |
| BR-121 | generated | `Portvald.java:80` |
| BR-122 | generated | `Portvald.java:91` |
| BR-123 | generated but blocked by GAP-PORTVALD-0001 | `Portvald.java:103` |

The application total is 5 of 154 rules implemented in generated Java, all fixture-tested and none equivalence-verified.

## 10. Unsupported behavior

**GAP-PORTVALD-0001** (stable reference `GAP-PORTVALD-4000-VALIDATE-AMOUNT-ALNUM-TO-NUMERIC-VAL-TEMP-NUM`, DATA_CONVERSION_UNDEFINED):
- Location: PORTVALD.cbl:109, where alphanumeric LS-INPUT-VALUE X(50) is moved into VAL-TEMP-NUM S9(13)V99.
- Content that is not all digits throws `UnresolvedGapException`. This includes decimals, signs, spaces and the empty value. No return code is invented.
- The gap stays **OPEN**.
- Resolving it needs either the business rule for such input, or the compiler options plus a captured legacy run.

**Independent review** (`reports/step-16/portvald-review.json`):
- **Who reviewed:** Claude Code in this session, as LGA-0001 allows. This is **not independent of the converter's author and not a human review**.
- **What was checked:**
  - dispatch and WHEN OTHER;
  - the ID, account and type checks;
  - the gap guard;
  - EXIT PARAGRAPH and GOBACK;
  - INITIALIZE;
  - every path writing both output fields;
  - decimal handling (BigDecimal scale 2, truncating);
  - the binary return code;
  - field lengths;
  - compilation.
- **Result:** 0 correctness defects.
- **Findings:**
  - **RV-16-01 (MEDIUM).** V13's all-digit amount path depends on a 50-digit alphanumeric value moving into a numeric item. 50 digits exceeds the 18 or 31-digit numeric limits, so the result may depend on the compiler. The amount branch is already classified GAP, so its passing test is not counted as verified behaviour. An owner must decide whether to confirm it with a legacy run or widen the gap.
  - **RV-16-02 (LOW).** Return code 4 (amount out of range) can never be produced (DR-PORTVALD-003, preserved).
  - **RV-16-03 (LOW).** The harness accepts at most 4-digit initial return codes, while the COMP field can hold up to 32,767. This affects the harness only.
  - **RV-16-04 (INFO).** Naming differs from the Step 14 spec: `UnresolvedGapException` instead of `UnsupportedLegacyBehaviourException`. Behaviour is the same.
  - **RV-16-05 (INFO).** Equivalence is unverified.

## 11. Program conversion status

**PORTVALD: PARTIAL.** The supported paths are generated, compiled and pass their tests, but GAP-PORTVALD-0001 stays open and its path is blocked. It is not COMPLETE: the amount gap is unresolved, and no COBOL reference run exists.

## 12. Remaining technical gaps

**PORTVALD:**
- GAP-PORTVALD-0001 is open.
- RV-16-01 needs an owner decision.
- DR-PORTVALD-001/002/003 (the as-written ID, account and amount rules) remain open business decisions. They are preserved, not corrected.
- There is no COBOL reference run.

**Application:**
- None of the 217 reverse-engineering gap groups is resolved by this step.
- No Java exists for the DB2 definitions, JCL or other copybooks. PORTVAL's record class is generated with PORTVALD.
- The first construct the converter refuses in each of the other 41 programs (see section 13):

| First refused construct | Programs |
|---|---|
| FILE SECTION records | 22 |
| Group items without a PIC (nested groups, DB2, COMMAREA and error areas) | 12 |
| PACKED-DECIMAL / COMP-3 | 4 |
| Duplicate FILLER | 1 |
| PERFORM UNTIL | 1 |
| Missing PROGRAM-ID (POSUPDT) | 1 |

**Converter backlog by construct presence** (unchanged from Step 15):

| Construct family | Programs |
|---|---|
| File I/O | 29 |
| DISPLAY/ACCEPT | 26 |
| FD | 24 |
| Arithmetic | 21 |
| SQL | 15 |
| Intrinsic functions | 15 |
| Loops | 13 |
| CALL | 12 |
| CICS | 8 |

## 13. Status of all 42 programs

The full table is in `reports/APPLICATION-MODERNIZATION-STATUS.md`.

- **PARTIAL (1):** PORTVALD. Local authorization LGA-0001, 5 Java files, compiled, 16 passed and 1 blocked.
- **BLOCKED (41):** every program below has no generation authorization, fails SOURCE_READINESS, and is not parsed by the converter. The table gives the first refused construct.

| First refused construct | Programs |
|---|---|
| FILE SECTION records | AUDPROC, BCHCTL00, CKPRST, ERRPROC, FILEHNDL, HISTLD00, PORTADD, PORTDEL, PORTMSTR, PORTREAD, PORTTEST, PORTTRAN, PORTUPDT, PRCSEQ00, RCVPRC00, RPTAUD00, RPTPOS00, RTNANA00, TSTGEN00, TSTVAL00, UTLMNT00, UTLVAL00 |
| Group item without a PIC | CURSMGR, DB2CMT, DB2CONN, DB2ERR, DB2ONLN, DB2RECV, ERRHNDL, INQHIST, INQONLN, INQPORT, RTNCDE00, SECMGR |
| PACKED-DECIMAL | DB2HNDL, DB2STAT, RPTSTA00, UTLMON00 |
| Other | ERRHANDL (duplicate FILLER), PROGNAME (PERFORM UNTIL), POSUPDT (missing PROGRAM-ID) |

No result was fabricated for any blocked program.

## 14. Backup verification

- **Pre-generation:** `revforge-forward-20261102T233508Z`. Verify OK (660 entries). Restore test with checkout, local assets, build and test: **342 / 342**.
- **Final:** `revforge-forward-20261103T000309Z`:

| Property | Value |
|---|---|
| Files | 663 |
| Archive sha256 | `b4b6fd45…059811f` |
| Tree sha256 | `3bc671ea…a0552` |
| Excluded | `forward/generated/java` (15 files) |
| Verify | OK (663 entries, no problems) |
| Restore test (checkout, local assets, build, test) | **353 / 354 passed, 0 failed, 1 skipped** |

The one skipped test checks the generated PORTVALD output. That output is excluded from backups by design and is rebuilt with `pilot generate`; every other Step 16 test ran in the restored copy.

- **Extra archive:** a first `create` attempt also produced `revforge-forward-20261103T000303Z` before its log redirect failed. It is a valid but redundant archive and can be deleted.

## 15. Mandatory security controls preserved

- **No external AI or BMad calls:**
  - no OpenAI, Claude API or BMad execution;
  - no source sent to any external service;
  - the authorization records `external_ai_disclosure: none`, and the contract enforces it.
- **Credentials:** `NEO4J_PASSWORD` and the `.mcp.json` values were neither printed nor used. Neo4j was not touched.
- **Protected material unchanged:**
  - original COBOL: both hashes re-confirmed;
  - `output/`, the reverse agents and skills, and the historical receipts, approvals and audit events (new events were only appended);
  - G0–G8 and the trust store.
- **No fabricated approvals:** no fake approvals, signers, keys, AUTO_APPROVE or force flags. The global generation flag and the F5 guard are unchanged.
- **Scoped generation:**
  - generation is limited to PORTVALD and its exact output directory;
  - unauthorized programs, directories, changed hashes, expired records and tampered records are refused (tested).
- **No inventory names in the runtime:** `runtime/src` names no program or copybook. The step1 guard passes, and Step 16 adds an explicit check on the new modules.
- **Nothing committed or pushed.** No agents, skills or engineering gates were added. No Spring Boot, no Neo4j rebuild, no WSL2.
- **Disclosure:** the generated Java and its gap excerpt were read in this session for the review, as LGA-0001 permits. This report quotes no COBOL source.

## 16. Next eligible conversion batch

No further program is eligible yet:
- PORTVALD's authorization does not cover any other program;
- no other program passes SOURCE_READINESS or is parsed completely by the converter.

The converter was therefore not extended speculatively.

**Proposed next batch (for the project owner to decide):**

1. **CKPRST.** Its only backlog family is the FD and its record. The converter would need FILE SECTION records and sequential file I/O semantics, including OPEN, READ AT END, WRITE, CLOSE and file status.
2. **ERRHANDL.** It needs duplicate-FILLER handling, arithmetic, DISPLAY and a CALL. The CALL requires its target in scope, or it stays a gap.

**The largest structural unlock** is FILE SECTION records plus sequential file I/O. It is the first blocker in 22 programs.

**Before any of these can be generated:**
- their F1/F2 deliverables and blocking decisions must make SOURCE_READINESS pass;
- the project owner must accept a separate program-scoped authorization record for each program, or for an explicitly identified batch with a dependency manifest.

There is no application-wide authorization.

Step 17 was not started.
