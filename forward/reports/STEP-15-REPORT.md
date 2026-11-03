# STEP 15 report: complete local COBOL-to-Java implementation

Real run: `FWD-20261031T172520Z-66b3`, 2026-11-02.

## Summary

**Delivered:** the existing local converter was extended to every construct PORTVALD and its copybook use, and proven end to end on two synthetic programs:
- compiled with `javac -Werror`;
- 32/32 source-derived cases pass;
- 2 gaps blocked as expected;
- 72/72 statements traced;
- CONVERSION_VALIDATION PASS, labelled PARTIAL.

All 42 real programs were analysed: inventory, SOURCE_READINESS, and converter capability (parse only).

**Not delivered: no Java was generated from any real COBOL program.** Generation is still unauthorised (§10). Every real program is **BLOCKED**, so the real conversion count is **0**. The converter itself is ready for PORTVALD: it parses PORTVALD completely, with its single documented gap.

| Result | Count |
|---|---|
| Real programs with Java generated | **0 / 42** |
| Real programs COMPLETE / PARTIAL / FAILED | 0 / 0 / 0 |
| Real programs BLOCKED | **42** |
| Real programs NOT_ATTEMPTED | 0 (all were analysed) |
| Programs passing SOURCE_READINESS | 1 (PORTVALD) |
| Programs the converter parses completely | 1 (PORTVALD) |
| Synthetic programs converted, compiled and tested | 2 (SYNRC01, SYNVAL01), both PARTIAL by design |

## 1. Baseline verification

| | |
|---|---|
| Step 14 state | confirmed: commit `b092004`; `java_generation_allowed: false`; workflow audit at 327 |
| Build | OK |
| Baseline suite (before any Step 15 edit) | **336 / 336** |

## 2. Backup verification

**Pre-change protection.** This is the Step 14 final backup `revforge-forward-20261102T215540Z`, restore-verified at 336/336. All code in it is identical to the pre-Step-15 state; only `STEP-14-REPORT.md` was written after it.

**Ordering.** As in Step 14, I began editing before taking a new Step 15 backup. That earlier verified backup already covered every line of code that changed.

**Final backup:** `C:\Users\vighn\revforge-backups\revforge-forward-20261102T225103Z\`, taken with no tests running.

| | |
|---|---|
| Contents | 657 files; archive sha256 `803a86cc5a0f8bfa2dd71af34080f6270a2ddfa225a39fba85c1becb5cc3f23f`; tree `bc248372…` |
| Verification | 657 safe entries; no file excluded as a secret; original COBOL and credentials excluded |
| Restore | into a disposable checkout at `b092004` with the separately held local assets: **all 13 checks pass, 342 / 342 tests**; the checkout was deleted afterwards |

**Integrity:**
- `output/`: 534 files unchanged.
- COBOL: 87 checked sources unchanged; nothing under `references/` modified.
- Tracked files: none changed.
- Workflow: no file written in Step 15 (audit 327).
- Commits and pushes: none.

## 3. Files changed

**New:**

| Area | Files |
|---|---|
| Runtime | `runtime/src/pilot/application.ts` (application-wide status and construct backlog; parse-only for real programs) |
| Synthetic fixture | `pilot/synthetic-val/{pilot.json, SPEC.md, cobol/SYNVAL01.cbl, cobol/SYNVALC.cpy, fixtures/cases.json}` |
| Tests | `tests/step15.test.ts` |
| Reports | `reports/STEP-15-REPORT.md`, `reports/APPLICATION-MODERNIZATION-STATUS.md` (generated), `reports/step-15/` (`application-status.json`, both pilot results, recovery) |

**Rewritten in place** (the same converter extended, not a second one):

| File | What changed |
|---|---|
| `runtime/src/pilot/cobol-subset.ts` | parser and gap analysis |
| `runtime/src/pilot/java-emit.ts` | Java generator |

**Modified:** `runtime/src/commands/pilot.ts` adds `pilot application`.

**Generated:** synthetic pilot output under `pilot/*/out` (12 Java files; reproducible, excluded from backups).

**No new** agents, skills, orchestrator, approval engine, framework or dependency.

## 4. Existing converter limitations (before this step)

The Step 11 converter handled one synthetic subset:
- DISPLAY sign-separate integers and `PIC X`;
- an unnamed entry;
- simple relations;
- MOVE, SET, IF, EVALUATE, PERFORM THRU and CALL.

It refused PORTVALD at its first construct (a named `0000-MAIN` entry). Its tokenizer would also have misread digit-led paragraph names (`0000-MAIN` as the number `000`). That defect was found and fixed here.

## 5. New COBOL language support

| Construct | Translation | Test |
|---|---|---|
| Copybook in WORKING-STORAGE; WORKING-STORAGE groups of elementary items | instance fields; group known for INITIALIZE | SYNVAL01 |
| PIC with `V9(m)` scale; signed zoned DISPLAY; binary COMP | `int` (scale 0, ≤9 digits) or `BigDecimal`; MOVE truncates high-order digits and drops excess decimals | SYNVAL01 F13–F17 |
| VALUE (including continuation lines, signed decimals) | initialisers | SYNVAL01 |
| Reference modification `X(s:l)` | `Cobol.substr` (bounds checked at conversion) | SYNVAL01 F01–F07 |
| `[NOT] =`, `EQUAL`/`GREATER`/`LESS`, AND/OR/NOT, abbreviated combined relations | Java boolean expressions | unit test, SYNVAL01 F08–F12 |
| `IS [NOT] NUMERIC` on alphanumeric data | every character a digit | SYNVAL01 F03, F07 |
| Comparison with `ZEROS` / `SPACES` | figurative of the operand's length | SYNVAL01 F06 |
| `INITIALIZE` group or item | numeric to zero, alphanumeric to spaces | SYNVAL01 |
| `EXIT PARAGRAPH` | `return` from the paragraph method | SYNVAL01, unit test |
| Named entry paragraph, PERFORM without THRU | method calls | SYNVAL01 |
| Field-list harness when the interface has binary fields | `kind\|value\|rc\|message` | SYNVAL01 |
| **Alphanumeric-to-numeric MOVE** | defined only for all-digit content; **anything else throws the gap** (`DATA_CONVERSION_UNDEFINED`) | SYNVAL01 F18, BLOCKED |
| **Variable MOVE into a binary item** | throws the gap beyond the PIC digits (TRUNC option); constants that fit are moved unguarded | unit test |

**Refused with a source location, never dropped:**
- COMP-3 / PACKED-DECIMAL;
- nested groups, OCCURS, REDEFINES;
- PERFORM UNTIL/VARYING/TIMES;
- alphanumeric `<` / `>` (collating sequence);
- FILE SECTION;
- EXEC SQL / EXEC CICS;
- COMPUTE and arithmetic verbs.

## 6. Local converter architecture (unchanged shape)

**Flow:** `pilot run` → strict subset parser (`cobol-subset.ts`, reusing the verification `parseDataDivision`) → gap analysis → Java 21 generator (`java-emit.ts`) → `javac -Xlint:all -Werror` → fixture harness → trace audit → SHA-256 evidence manifest → CONVERSION_VALIDATION (`pilot validate`).

**Supporting commands:** SOURCE_READINESS (`pilot readiness`) and application status (`pilot application`).

**Agents:**
- F1 and F2 outputs are reused through the readiness gate.
- F3 and F4 stay light.
- F5 is not dispatched: no LLM is needed for supported syntax, and generation is unauthorised anyway.
- F6 and F7 checks are embodied in the fixtures and trace audit.

## 7. Windows execution compatibility

Everything ran natively on Windows: Node 22, TypeScript, and the existing Microsoft JDK 21.0.13. **No WSL2, Docker or container was used.** The historical isolation tests are preserved.

**Execution safety:** only **synthetic** generated Java was executed. Executing generated Java from real programs would remain subject to the same authorisation.

## 8. SHA-256 handling

**Reused unchanged.** Hashes cover:
- source and copybook identities in every result;
- pilot evidence manifests (SYNRC01 `eee74f69…`, SYNVAL01 `be70abdb…`), verified by CONVERSION_VALIDATION;
- the per-program `source_sha256` in the application status;
- backup inventories.

## 9. Ed25519 policy handling

**Unchanged.** Signature verification remains available, and the existing policy still mandates signed G2–G4 approvals for generation. No key, signer or approval was created.

## 10. Authorisation decision and evidence status

**Policy owner:** the project authority. It owns `generation.java_generation_allowed` and `orchestrator.java_target_dir` in `config/forward.config.json`, plus the approval policy that requires G4 PASS through signed G2–G4 approvals.

**Status: generation NOT authorised.** The guard reports exactly four blockers:

| # | Blocker |
|---|---|
| 1 | `java_generation_allowed` is `false` |
| 2 | no `orchestrator.java_target_dir` |
| 3 | G4 is BLOCKED |
| 4 | TRUST_NOT_CONFIGURED |

**No program-scoped local-conversion authorisation was implemented or activated.** Section 4.2 permits it only after a formal replacement decision by the project authority. None exists, and the step prompt itself is not that decision.

**Source access, stated plainly.** In earlier steps of this session, Claude Code displayed real COBOL source (including PORTVALD and RTNCDE00) in tool output while analysing it. In this step, real-source outputs were limited to metadata: paths, hashes, construct names and line numbers. The converter itself sends nothing anywhere.

## 11. PORTVALD conversion result

**BLOCKED** (authorisation). Engineering readiness:
- **SOURCE_READINESS:** PASS (Step 14, re-confirmed).
- **Converter:** parses PORTVALD completely (parse only). It finds exactly the expected gap, `GAP-PORTVALD-4000-VALIDATE-AMOUNT-ALNUM-TO-NUMERIC-VAL-TEMP-NUM`, and passes the pre-emission checks (single LINKAGE, entry ends with GOBACK, no external calls).
- **Expected label once generated:** PARTIAL. The as-written ID, account and range behaviours would be preserved (DR-PORTVALD-001..003); the amount path is guarded.

## 12. Java files actually generated

| Program | Files |
|---|---|
| Real programs | **none** |
| SYNRC01 (synthetic) | 7 files: `Synrc01`, `SynRequest`, `Cobol`, `ExternalSynext01`, `UnresolvedSynext01`, `UnresolvedGapException`, `PilotHarness` |
| SYNVAL01 (synthetic) | 5 files: `Synval01`, `OvRequest`, `Cobol`, `UnresolvedGapException`, `PilotHarness` |

## 13. Java compilation

| Program | Result |
|---|---|
| SYNRC01 | **COMPILED** (`javac -Xlint:all -Werror`, JDK 21.0.13) |
| SYNVAL01 | **COMPILED** (same) |
| Real programs | not run |

## 14. Java tests executed

| Program | Result |
|---|---|
| SYNRC01 | 14 passed, 1 blocked as expected, 0 failed; 33/33 statements traced |
| SYNVAL01 | **18 passed, 1 blocked as expected, 0 failed**; 39/39 statements traced |
| Java integration tests | none: no generated programs call one another |
| Real programs | none |

## 15. Legacy equivalence status

**"Legacy runtime equivalence not established; only source-derived fixture validation completed."** No COBOL compiler is available.

## 16. Two-gate evaluation

**SOURCE_READINESS** (`application-status.json`): **1 / 42 PASS** (PORTVALD). Failing checks across the other 41:

| Check | Programs failing |
|---|---|
| `dependencies_identified` (unknown names, unresolved closures) | 36 |
| `unsupported_documented` | 26 |
| `copybooks_resolved` | 17 |
| `complete_program` (PROGNAME, CKPRST) | 2 |
| `source_available` (POSUPDT, empty) | 1 |
| evaluation error | 1: CURSMGR PERFORMs a paragraph that does not exist in its source (already recorded as DR-CURSMGR-001); this surfaced as an error rather than a structured finding |

**CONVERSION_VALIDATION:** SYNRC01 **PASS (PARTIAL)**, SYNVAL01 **PASS (PARTIAL)**; real programs not run.

## 17. Gaps and unsupported behaviour

**Synthetic gaps (open):**
- `GAP-SYNRC01-0001` (undefined CALL);
- `GAP-SYNVAL01-0001` (undefined alphanumeric-to-numeric MOVE).

**Real-program gaps.** Program-level gaps, with stable IDs, are in `application-status.json`. The 217 reverse gap groups are unchanged and none is resolved.

**Converter backlog** (programs containing each construct family the converter does not yet translate):

| Construct family | Programs |
|---|---|
| file I/O | 29 |
| DISPLAY/ACCEPT | 26 |
| FILE SECTION | 24 |
| arithmetic verbs | 21 |
| embedded SQL | 15 |
| intrinsic functions | 15 |
| PERFORM loops | 13 |
| CALL between programs | 12 |
| CICS | 8 |
| string operations | 6 |
| COMP-3 | 4 |
| OCCURS | 2 |

**Not implemented in this step, deliberately:** these are what most programs need next. Implementing them without being able to validate them on the real programs they serve would add untested surface, so they are reported as the backlog.

## 18. Full test suite

| Suite | Result |
|---|---|
| TypeScript harness | **342 / 342 passed**, 0 failed, 0 skipped (336 existing, unchanged, plus 6 new) |
| Java compilation | 2 / 2 synthetic programs |
| Java tests | 32 passed, 2 blocked as expected, 0 failed (synthetic) |
| Java integration tests | 0 run |
| Legacy differential tests | 0 run |

**Defects fixed during the step:**
- tokenizer (digit-led paragraph names);
- generator (a spurious `L` suffix on variable MOVE sources);
- a message naming a real copybook in runtime code, caught by the Step 1 guard.

## 19. Exact remaining blockers

1. **Authorisation (project authority):** either the signed G2–G4 approvals (trust store, signers, SME decisions DR-PORTVALD-001..003 and the reviews), or a formal, recorded replacement policy (program-scoped local-conversion authorisation bound to the source digest and target directory). Then `java_generation_allowed` plus `java_target_dir`.
2. **Source-access decision:** whether Claude Code may read protected source (relevant to F5/LLM assistance; the deterministic converter does not need it).
3. **Converter backlog** for the other 41 programs (table in §17), led by file I/O and FILE SECTION, arithmetic verbs, DISPLAY, PERFORM loops, CALL linking, then SQL and CICS. The last two also depend on the unresolved SQL communication-area semantics and the CICS environment.
4. **Validation:** without a COBOL compiler, every result stays fixture-validated only.

**Not started:** Step 16.
