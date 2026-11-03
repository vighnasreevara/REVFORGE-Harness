# STEP 20: gap remediation, converter improvements and BMAD execution

**BMAD status: BMAD BLOCKED.** No STEP 20 change ran under BMad, and none is reported as BMAD-compliant.

**COBOL equivalence: not established.** No COBOL compiler or captured legacy run exists.

Machine-readable records are in `forward/reports/step-20/`:

| File | Contents |
|---|---|
| `bmad-execution.json` | BMad installation, bindings, the six sealed preflights and every blocker |
| `readiness-failures.json` | every failing readiness check per program, before and after, with classification and root cause |
| `converter-defects.json` | converter, runtime and reconciliation-tool defects and fixes |
| `implementation-changes.json` | files changed |
| `business-rule-status-changes.json` | rule status changes (none) |
| `updated-gaps.json` | forward gaps after STEP 20 |
| `regression-evidence.json` | commands, exit codes and results |
| `before-after.json` | the table below |
| `readiness-before/, readiness/` | raw readiness results before and after |
| `baseline-step19/` | copies of the STEP 19 summary and mappings |

## 1. Before and after

| Metric | STEP 19 baseline | STEP 20 result |
|---|---|---|
| Programs complete | 2 | 2 |
| Programs partial | 39 | 39 |
| Paragraphs mapped | 390 | 390 |
| Statements mapped | 1333 | 1337 |
| Statements unmapped | 4 | 0 |
| PERFORM edges matched | 397 | 397 |
| Business rules fully Java-verified | 67 | 67 |
| Business rules verified up to gap | 15 | 15 |
| Fields represented | 966 | 966 |
| Copybooks complete | 13 | 19 |
| Process-flow edges matched | 639 | 639 |
| Forward gaps | 391 | 391 |
| Readiness passes | 1 | 6 |
| Runtime unit tests passing | 31 | 34 |
| Harness tests passing | 374 | 383 |
| Verified COBOL runtime equivalence | 0 | 0 |
| BMAD-executed compliant runs | Unconfirmed | 0 |

All STEP 20 values were recalculated after the changes, from the regenerated reconciliation (`reverse-forward-reconcile.py`) and the recorded runs.

## 2. BMAD execution (Phase B)

| Question | Finding |
|---|---|
| Installed version | `bmad-method@6.12.4`, stable, pinned and integrity-verified (`bmad doctor` OK). Installed only in the isolated executor workspace `synthetic-001`, never in the repository. |
| Workflows available | 50 registered; 6 bound: `bmad-prd` (F1), `bmad-architecture` (F3), `bmad-create-epics-and-stories` and `bmad-sprint-planning` (F4), `bmad-build` (F5, disabled), `bmad-code-review` (F7). F2 and F6 are deliberately unbound. |
| Workflows that execute | **None.** There is no `bmad run`. LIVE execution goes only through `bmad executor preflight`, which refused every workflow. |
| F1–F7 invoke BMad | No. |
| Local converter under BMad | No. It runs under the LGA local-generation authorizations. |
| Execution evidence | No BMad receipt (BRC) exists in any run: no LIVE and no MOCK. |
| Failures silently bypassed | No. The preflights are sealed refusals (BPF-0004..0009) and nothing was launched. |

**Preflight in this step:** each of the six bound workflows for scope `programs:ERRHNDL`, recorded as BPF-0004..0009. All were REFUSED with `EXECUTION_UNSUPPORTED`.

**Blockers, which only the project owner and administrator can remove:**
1. There is no signed `anthropic / claude-code-cli` disclosure authorization, and creating one needs a `data_owner` signature.
2. The trust store is not configured, so no trusted signer exists.
3. G2 is UNVERIFIED (417 blocking findings for the application scope); the workflow state is REQUIREMENTS_DRAFTED.
4. `live_execution.requested` is false.
5. Build is disabled while `java_generation_allowed` is false.
6. Claude Code cannot run inside the tested isolation boundary, and no verified provider-egress component exists.

**Status: BMAD BLOCKED.** STEP 20 work ran only through the existing, explicitly authorized local workflow: LGA-0001..0042 via `pilot convert-app`, which re-verifies the records. This is reported here, not hidden. None of it is BMAD-compliant.

## 3. Readiness (Phase C)

**Result:** readiness rose from 1 of 42 to **6 of 42** PASS, on the gate's own conditions. Newly passing: PORTADD, PORTREAD, PORTTEST, PORTUPDT, PROGNAME.

**Remaining failing checks:** dependencies_identified 30, copybooks_resolved 18, complete_program 2, source_available 1.

**Root-cause classification of the remaining failures:** GENUINE_SOURCE_ISSUE 57, MISSING_DEPENDENCY 51. Each one is listed per program in `readiness-failures.json`.

**Gate defects corrected.** No check was disabled or relaxed, and each correction has a test showing that the unsafe case still fails.

| ID | Defect | Correction |
|---|---|---|
| RG-01 | IBM special register RETURN-CODE reported as an unknown dependency | recognised as a compiler-defined special register and recorded in the closure (special_registers); not a keyword, so it stays visible as a dependency |
| RG-02 | reserved words of OPEN I-O, READ ... NEXT RECORD, DELETE file, DISPLAY ... UPON and ACCEPT ... FROM DATE YYYYMMDD reported as unknown names | added I-O, NEXT, DELETE, UPON, YYYYMMDD to the reserved-word set |
| RG-03 | mnemonic names declared in SPECIAL-NAMES (CONSOLE IS CONS) reported as unknown | names declared by `<system-name> IS <mnemonic>` in SPECIAL-NAMES resolve; an undeclared mnemonic stays unknown (synthetic test) |
| RG-04 | index names declared by OCCURS ... INDEXED BY reported as unknown | index names of the program and its included members resolve (same recognition as the converter) |
| RG-05 | a PERFORM of a paragraph missing from the source aborted the whole readiness gate with an exception (CURSMGR) | the closure of a missing entry paragraph is UNRESOLVED with the reason, as the closure contract states (fail-closed) |
| RG-06 | file I/O and CALL side effects made behaviours PARTIAL, but the gap handoff documented only embedded SQL, so unsupported_documented failed although the cause was known | blocking OPEN gaps EXTERNAL_FILE_RUNTIME and EXTERNAL_PROGRAM_CALL are recorded for them; the behaviour classification is unchanged |

**Genuine source issues and missing dependencies that remain:**
- the circular / precompiler SQLCA (DB2 programs);
- the missing members PORTREC, SQLPOS and DB2STAT;
- missing paragraphs (BCHCTL00, FILEHNDL, HISTLD00, RPTAUD00, DB2HNDL and others);
- undeclared names (WS-SUB, the LS-* and LOG-* items, ENTRY-POINT-*, USERID in PORTMSTR);
- SELECTs without an FD (RPTAUD00, RPTPOS00, UTLVAL00 and others);
- the non-standard `ACCEPT FROM TIME STAMP`;
- CICS command-level names;
- paragraphs without statements (CKPRST, FILEHNDL);
- the empty POSUPDT source.

**Correction to the STEP 19 report:** CURSMGR did not fail readiness; the gate aborted for it (RG-05). The STEP 19 count of 41 FAIL included that crash.

## 4. Converter and runtime (Phases D and E)

**CD-01 (converter front end, `forward/runtime/src/pilot/cobol-app.ts (isHeader)`).**
- Defect: in free-form source a statement `EXIT.` indented less than four columns was taken as a paragraph header named EXIT, so ERRHNDL had four extra paragraphs and its four EXIT statements (lines 61, 90, 102, 118) had no Java mapping.
- Fix: a procedure name is never a reserved verb or scope terminator.
- Regression test: tests/step20.test.ts: free-form `EXIT.` ... (fails without the fix, passes with it).

**CD-02 (Java runtime, `forward/runtime/java/revforge/cobol/CobolProgram.java (perform)`).**
- Defect: a PERFORM that executes itself recursively ran as Java recursion; standard COBOL does not define the result, and termination depends on external results (reverse GAP-016 INQHIST, GAP-024 FILEHNDL).
- Fix: the path is blocked with runtime gap RUNTIME-RECURSIVE-PERFORM when a PERFORM starts while the same range is still active; no recursion limit, no inferred termination; legal nested PERFORMs unchanged.
- Regression test: RuntimeTests: recursive PERFORM blocked; nested PERFORM of a different range runs; a range can be performed again after it returned.

**Regeneration.**
- All 41 convertible programs were regenerated with `pilot convert-app` under their LGA records; POSUPDT still fails because its source is empty.
- Compared with the STEP 19 output, only `Errhndl.java` changed in program source; every program also carries the updated runtime classes.
- For all 41 programs the generated check counts (PASS / BLOCKED / FAIL) and the gap counts are identical before and after.
- No previously correct program changed behaviour on any recorded test.

**Investigated, with no converter defect found:**

| Item | Finding |
|---|---|
| PERFORM edges at gaps | 127: UNDEFINED_PROCEDURE 82, UNDECLARED_NAME 42, UNSUPPORTED_DATA 3. UNDEFINED_PROCEDURE is a PERFORM of a paragraph the source does not contain; the others PERFORM ranges blocked by undeclared names or undeterminable layouts. All are source issues or missing dependencies (undeclared SQLCODE, EIB and DFHRESP names come from the absent DB2 precompiler and CICS translator), so no translation can be added without inventing behaviour. |
| Branches at gaps | 64: UNDECLARED_NAME 56, UNSUPPORTED_DATA 8 |
| Loops at gaps | 6: UNDECLARED_NAME 6 |
| Fields not represented | 43: 35 in COMMON.cpy (COPYed by no program) and 8 in ERRHNDL `WS-ERRLOG-RECORD`, a group without PIC or subordinates in the converter's view. These are source layout issues. |
| Records not represented | 35: 7 COMMON.cpy records and 28 empty groups whose COPY/INCLUDE member starts its own 01 (for example `01 WS-DB2-AREA.` + `EXEC SQL INCLUDE SQLCA`). Layout as written is not determinable. |
| Copybooks reported partial | Reclassified by TD-01. All six had every field represented with identical attributes; they are generated in-program. |
| ERRPROC untranslated DISPLAY (lines 94, 102) | The closing quote of the literal is in column 73, outside fixed-format Area B (8–72). As written the literal is unterminated, so the gap is correct and the issue is genuine source. |
| JCL / IDCAMS / platform | Unchanged. IDCAMS, CEE3ABD, ILBOABN0, DELAY, DB2 and CICS behaviour is not defined by the repository, and none was invented. |

## 5. Business rules

- All 154 rule identities are preserved.
- Status changes in STEP 20: **0**.
- The 15 verified-to-gap rules stop at these downstream gaps: BR-001 (BCHCTL00): RUNTIME-CALL-UNAVAILABLE, UNDEFINED_PROCEDURE; BR-011 (PRCSEQ00): RUNTIME-CALL-UNAVAILABLE; BR-012 (PRCSEQ00): RUNTIME-CALL-UNAVAILABLE; BR-032 (RCVPRC00): RUNTIME-CALL-UNAVAILABLE; BR-046 (DB2CONN): EXTERNAL_SYSTEM_BOUNDARY; BR-055 (DB2STAT): COMPILER_OPTION_DEPENDENT, EXTERNAL_SYSTEM_BOUNDARY, RUNTIME-CALL-UNAVAILABLE; BR-058 (CURSMGR): UNDECLARED_NAME; BR-060 (DB2ONLN): EXTERNAL_SYSTEM_BOUNDARY; BR-085 (PORTADD): UNDECLARED_NAME; BR-087 (PORTDEL): COMPILER_OPTION_DEPENDENT; BR-088 (PORTDEL): COMPILER_OPTION_DEPENDENT; BR-089 (PORTDEL): COMPILER_OPTION_DEPENDENT; BR-101 (PORTTEST): COMPILER_OPTION_DEPENDENT; BR-126 (TSTVAL00): UNDECLARED_NAME, UNDEFINED_PROCEDURE; BR-128 (UTLMNT00): UNDECLARED_NAME, UNDEFINED_PROCEDURE.
- RUNTIME-CALL-UNAVAILABLE (BCHCTL00, PRCSEQ00, RCVPRC00, DB2STAT) is the isolated test of their CALL to ERRPROC. ERRPROC itself stops at `ACCEPT FROM TIME STAMP` (ERRPROC.cbl:57), so linking it does not unblock them.
- None of these gaps is resolvable from the source evidence: missing paragraphs, the legacy environment, DB2 and undeclared names.
- None of the 40 unreachable or 32 blocked rules was unblocked by the STEP 20 corrections. The ERRHNDL EXIT and recursion changes alter no rule path that was previously verified.

## 6. Regression tests and gates (Phase F)

Commands ran sequentially, one at a time.

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | TypeScript build |
| `node dist/runtime/src/cli.js pilot integrate` | 0 | integrated 41 program(s), 15 job(s); excluded: POSUPDT (conversion FAILED: the source cannot be converted: missing PROGRAM-ID)   compilation: COMPILED (120 Java files)   runtime unit tests: {"PASS":34,"BLOCKED_AS_EXPECTED":0,"FAIL":0,"total":34}   program tests (isolated): {"PASS":1388,"BLOCKED_AS_E |
| `java -cp generated/java/app/classes revforge.cobol.testing.RuntimeTests` | 0 | SUMMARY/34/0/0 |
| `node dist/runtime/src/cli.js doctor` | 0 | FAIL checks: 0; OK checks: 24 |
| `node dist/runtime/src/cli.js sync-agents --check` | 0 | entries not in sync: 0 |
| `node dist/runtime/src/cli.js bmad doctor` | 0 | bmad doctor: OK — bmad-method@6.12.4 staged; not installed in the repository (isolated executor installation: bmad executor doctor) |
| `node dist/runtime/src/cli.js bmad executor doctor` | 0 | bmad executor: isolated installation VERIFIED; LIVE execution BLOCKED; [FAIL] provider_disclosure_authorization: no signed AI-provider disclosure authorization exists for anthropic (claude-code-cli); signed source-export authorizat [FAIL] live_requested: bindings.json live_execution.requested is fal |
| `npm test` | 0 | ℹ tests 383 ℹ pass 383 ℹ fail 0 ℹ skipped 0  |
| `pilot validate --out generated/java/<P>` (42 runs) | 41 exit 0, 1 non-zero | non-zero: POSUPDT |
| `pilot readiness --program <P>` (42 runs) | 6 exit 0 | see section 3 |

New tests:
- `tests/step20.test.ts`: 9 tests (gate corrections, each with its fail-closed counterpart, and the converter EXIT case);
- `RuntimeTests`: 3 recursion tests.

No expected output of an existing test was changed.

## 7. Status by evidence level

| Level | Contents |
|---|---|
| Implemented and tested (source-derived Java tests) | 67 rules verified; 15 verified up to a gap; 3 end-to-end JCL jobs; the STEP 20 gate, converter and runtime corrections |
| Structurally mapped | 390 paragraphs; 1337 statements; 397 PERFORM edges; 966 fields |
| Blocked | 32 rules; 391 forward gaps; recursive PERFORM paths (runtime gap) |
| Not independently verified | Everything. There is no COBOL compiler or captured legacy execution. |

## 8. Remaining external dependencies and business decisions

- **D8 COBOL runtime for differential testing**: a COBOL compiler (or captured legacy executions) to run the original programs on the same inputs as the source-derived scenarios.
- **D3 Corrected source (declarations, paragraphs, layouts, invalid statements)**: corrected COBOL from the owner (missing paragraphs and declarations, empty-group layouts, SELECTs without FD, statements invalid as written).
- **D2 CICS runtime**: a CICS environment or an approved replacement design for COMMAREA, RESP, LINK, HANDLE CONDITION and the EIB.
- **D1 DB2 runtime**: a DB2 instance (or an approved, DB2-validated data-access layer) plus the precompiler SQLCA and the missing DCLGEN.
- **D4 Missing COPY/INCLUDE members**: the members PORTREC, SQLPOS and the intended DB2STAT layout from the original libraries.
- **D5 Legacy environment definitions**: the legacy definitions of ACCEPT FROM TIME STAMP, FUNCTION RANDOM and FUNCTION USER-ID.
- **D6 Platform services and utilities**: CEE3ABD, ILBOABN0, DELAY and IDCAMS behaviour (or approved replacements).
- **D7 Business decisions**: owner/SME decisions: non-digit amounts (PORTVALD, PORTUPDT); whether PORTTRAN should post positions (2200 is never performed).
- **BMad LIVE:** a signed Anthropic disclosure authorization, a trust store with trusted signers, G2 approval for the exact scope, `live_execution.requested`, and a runner inside an enforceable boundary with verified provider egress.
- **Owner decision:** the intended termination of the recursive PERFORMs in INQHIST (DB2 reconnect retry) and FILEHNDL (error termination).

## 9. Recommended STEP 21 actions

1. **Unblock BMad** (owner and administrator):
   - configure the trust store;
   - sign the Anthropic disclosure authorization for a single pilot scope, for example `programs:PORTREAD`, which now passes readiness;
   - obtain the signed G2 approval for that scope;
   - provision Node and Claude Code inside the WSL2 boundary, with a verified egress allowlist;
   - then run the bound `bmad-prd` → `bmad-architecture` → stories → review workflows for that scope and record their receipts.
2. **COBOL differential testing:** obtain a COBOL compiler or captured runs and replay the passing scenarios of the six readiness-passing programs first.
3. **Source corrections from the owner:** the missing paragraphs, declarations, FDs and members listed in `readiness-failures.json` (GENUINE_SOURCE_ISSUE, MISSING_DEPENDENCY).
4. **Environment decisions:** DB2 (precompiler SQLCA, DCLGEN) and CICS.
