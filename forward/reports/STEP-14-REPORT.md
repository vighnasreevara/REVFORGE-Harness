# STEP 14 report: simplify and prioritise real COBOL-to-Java conversion

Real run: `FWD-20261031T172520Z-66b3`, 2026-11-02.

**Outcome:** the first complete real program, **PORTVALD**, was selected, passes **SOURCE_READINESS**, and is fully prepared for conversion. **No real Java was generated**, because generation is not authorised under the existing guard, which the two engineering gates do not replace (§12). The two-gate workflow itself works end to end on the synthetic program (CONVERSION_VALIDATION PASS, labelled PARTIAL).

## 1. Files changed

**New:**

| Area | Files |
|---|---|
| Runtime | `runtime/src/pilot/gates.ts` (the two engineering gates, candidate ranking, authorisation report) |
| Tests | `tests/step14.test.ts` |
| Reports | `reports/STEP-14-REPORT.md`; `reports/step-14/`: `conversion-candidates.json`, `source-readiness-PORTVALD.json`, `portvald-conversion-spec.md`, `portvald-test-cases.json`, `recovery/` |

**Modified:**

| File | Change |
|---|---|
| `runtime/src/approval/closure.ts` | shared `moveHazards` (undefined alphanumeric-to-numeric MOVE; TRUNC only for variable senders); `PARAGRAPH`/`SECTION` keywords; new gap kind `DATA_CONVERSION_UNDEFINED` |
| `runtime/src/pilot/scope.ts` | a named entry paragraph is recognised as the dispatch; uses `moveHazards`, so an undefined conversion makes a behaviour PARTIAL |
| `runtime/src/commands/pilot.ts` | `pilot candidates`, `pilot readiness --program`, `pilot validate --out` |
| `runtime/src/cli.ts` | usage text |

**Not modified:**
- original COBOL, reverse outputs, Neo4j, workflow records (the audit stayed at 327), historical approvals and G0–G8 records;
- the 7 agents and 14 skills;
- `config/forward.config.json` (`java_generation_allowed` is still `false`);
- Git history.

## 2. Build and tests

| Run | Result |
|---|---|
| Baseline (Step 13 code, built before any edit) | **329 / 329** |
| Final | **336 / 336 passed, 0 failed, 0 skipped** (329 existing, unchanged, plus 7 new) |

**Defects found while building the gates, and fixed:**
- **Undefined conversion counted as verified.** The behaviour classification called PORTVALD's amount check VERIFIED although line 109's alphanumeric-to-numeric MOVE is undefined for non-digit content.
- **False truncation hazards.** TRUNC gaps were raised for unchanged VALUE constants.
- **Unchecked entry paragraph.** A named entry paragraph was neither recognised as the dispatch nor closed, so an unknown name in it went unchecked.

**Earlier findings unchanged:** RTNCDE00 still has its 8 gaps with the same IDs (tested).

## 3. Backup verification

| Backup | When | Contents | Verification |
|---|---|---|---|
| Protective, `revforge-forward-20261102T214552Z` | **after** the first Step 14 edits had begun (deviation: Task 1 asked for it before any change; the edits so far were additive and in-repo) | 647 files, archive `db631089…` | 647 safe entries |
| **Final**, `revforge-forward-20261102T215540Z` | end of the step | 648 files, archive sha256 `6f4ffdf395d09d14815cf2499b5c8a7ab259c966ce359c35cb9af15281d566ae`, tree `14344c3b…` | 648 safe entries, no secrets |

**Restore of the final backup** (`reports/step-14/recovery/`):
- **Where:** a disposable git checkout at `b092004`, with the separately held local assets attached.
- **Integrity checks:** all 13 passed (baseline, hashes, nothing extra, tracked files intact, 7 agents and 14 skills, no secrets, build).
- **Tests:** **336 / 336**.
- **Cleanup:** the temporary checkout was deleted.

## 4. Old versus simplified active architecture

| | Before | Active now |
|---|---|---|
| Engineering readiness | spread across G2 scope evaluation, the Step 11–13 planners and the closure | **SOURCE_READINESS** (`pilot readiness --program P`) |
| Engineering acceptance | G5/G6, which were fail-closed and never implemented | **CONVERSION_VALIDATION** (`pilot validate --out O`) |
| Human authorisation | config flag + G4 (signed G2–G4) | **unchanged**: reported next to each gate, never bypassed |
| G0–G8 | active state machine | **retained** with history and compatibility; no gate re-marked |
| Conversion target | P200 (a paragraph) | **a complete program** chosen by a generic ranking; P200 remains available as evidence, not as the default |

Both gates are compositions of existing components, not new verification systems:
- **SOURCE_READINESS:** `SourceReader`, the parsed DATA DIVISION, the F1/F2 coverage ledgers, `behaviourScope`, `behaviourClosure` and the G2 decision register.
- **CONVERSION_VALIDATION:** `verifyPilotEvidence`, the pilot trace audit, the gap trace and the `pilot/pilot-result` contract.

## 5. How the seven agents are reused

| Agent | Role in the simplified flow | Status for PORTVALD |
|---|---|---|
| F1 | requirements | delivered earlier (REQ-PORTVALD-001..003, 3 open SME decisions) |
| F2 | data mapping | delivered earlier (RT-PORTVALD-001..002, PORTVAL record) |
| F3 | Java architecture | kept light: the proposed design in `portvald-conversion-spec.md` §5 (non-authoritative) |
| F4 | development planning | kept light: one unit of work, 17 test cases |
| F5 | Java generation | **not dispatched**: generation is unauthorised (§12) |
| F6 | independent testing | the test cases are ready; CONVERSION_VALIDATION is ready |
| F7 | independent review | the trace audit inside CONVERSION_VALIDATION; no agent dispatched |

## 6. Selected program: PORTVALD

`pilot candidates` ranks every program. A program is eligible only with:
- available source;
- no stub paragraphs;
- `modernization_scope: candidate`;
- resolved includes.

Eligible programs are then ordered by external operations, includes and size.

| Rank | Program | External ops | Includes | Statements |
|---|---|---|---|---|
| **1** | **PORTVALD** | **0** | PORTVAL | 50 |
| 2 | PORTREAD | 1 (file) | PORTFLIO | 26 |
| 3 | AUDPROC | 1 (file) | AUDITLOG | 30 |

**Excluded:**
- PROGNAME: a template;
- CKPRST: stub paragraphs and undeclared entry conditions;
- POSUPDT: empty source.

**Why PORTVALD is suitable:**
- It is a complete callable subroutine (85 lines, 5 paragraphs, 50 statements) with one copybook.
- It has no SQL, CICS, CALL or file I/O.
- Its business behaviour is clear (validating a portfolio ID, account number, investment type and amount, with return codes 0–4 and fixed messages).
- Its data is plain DISPLAY and alphanumeric, except one binary return code that only ever receives constants 0–4.
- Every output is checkable with in-memory tests.

## 7. Source and copybook dependency coverage

| | |
|---|---|
| Source | `PORTVALD.cbl` `5957fd22…`; `PORTVAL.cpy` `8d9c7666…` (resolved) |
| SOURCE_READINESS checks | **PASS**: source available; complete program; copybooks resolved; F1/F2 delivered; 5 behaviours classified (3 VERIFIED, 2 PARTIAL); 5 closures RESOLVED (units PORTVALD, PORTVAL; 0 external operations); every PARTIAL behaviour documented by a gap; 6 open decisions recorded (3 blocking for approval) |

## 8. Java generated

**None for PORTVALD.**

The only Java on disk is the synthetic SYNRC01 pilot output, regenerated in this step to exercise CONVERSION_VALIDATION.

## 9. Java compilation results

| Program | Result |
|---|---|
| PORTVALD | not run (no authorised generation) |
| Synthetic SYNRC01 | `javac -Werror` (JDK 21.0.13): **COMPILED** |

## 10. Tests executed

| Test set | Result |
|---|---|
| Full suite | 336 / 336, plus the same in the restored checkout |
| Synthetic conversion, CONVERSION_VALIDATION | **PASS**: 14 passed, 1 blocked as expected, 33/33 statements traced, label **PARTIAL**, equivalence UNVERIFIED (fixture-based) |
| PORTVALD | 17 source-derived cases prepared (`portvald-test-cases.json`); none executed, because there is no Java |

## 11. Unsupported behaviour and gaps (PORTVALD)

**Gap: undefined behaviour, which must fail explicitly.**
- `GAP-PORTVALD-4000-VALIDATE-AMOUNT-ALNUM-TO-NUMERIC-VAL-TEMP-NUM` (line 109). The result for amount input that is not all digits is not defined by the source.

**Suspected defects: known behaviour, preserved, not corrected.**
- **DR-PORTVALD-001:** an ID can never pass.
- **DR-PORTVALD-002:** an account must be 50 digits.
- **DR-PORTVALD-003:** the amount range check can never fail.

These are open SME decisions; a conversion would preserve the behaviour as written.

**Expected conversion label: PARTIAL.**

## 12. Missing permissions and technical dependencies

**Authorisation** (reported by `pilot readiness`; none is bypassed):
1. `generation.java_generation_allowed` is `false`. Only the project authority may change it.
2. No `orchestrator.java_target_dir` is authorised.
3. G4 is BLOCKED. Generation requires G4 PASS, which requires signed G2 (PORTVALD: NOT_READY, 11 blocking, digest `87492994…`), G3 and G4 approvals.
4. TRUST_NOT_CONFIGURED: no trusted signer exists.

**Technical dependencies:**
- **Deterministic generator:** the local generator converts **synthetic** programs only (a deliberate safeguard). It does not yet support PORTVALD's constructs: reference modification, class tests, `EXIT PARAGRAPH`, combined abbreviated conditions, INITIALIZE.
- **F5 agent path** (Claude through BMad): it additionally needs a signed source-disclosure authorisation, an isolated runner and verified egress, none of which exist.
- **COBOL reference:** no COBOL compiler, so any conversion validates against source-derived fixtures only, never runtime equivalence.

## 13. Did the first real complete-program conversion succeed?

**No. It was not performed**, because it is not authorised. Every safe preparation step is complete:
- selection;
- SOURCE_READINESS PASS;
- an as-written behaviour specification;
- the gap and defect record;
- the Java design;
- 17 test cases;
- a validated CONVERSION_VALIDATION gate.

## 14. What is required to finish the first conversion

1. **A project-authority decision on how generation is authorised.**
   - **Either** keep the current rule: provision the trust store, have SMEs resolve DR-PORTVALD-001..003 and the review decisions, approve G2, then G3 and G4.
   - **Or** formally amend the policy so that generation needs SOURCE_READINESS PASS plus an explicit signed generation authorisation for a named program and target directory. That is a policy change only the authority may make; it was not made here.
2. **Set `java_generation_allowed` and an `orchestrator.java_target_dir`** (project authority).
3. **Choose the generation path.**
   - **Either** extend the local deterministic generator to PORTVALD's constructs and allow it for authorised real programs (no source disclosure).
   - **Or** sign a source-disclosure authorisation and provision the isolated F5/BMad runner.
4. **Run the conversion:** generate the Java, run the 17 cases, run `pilot validate`, and expect a PARTIAL label because of the amount gap.

**Not started:** Step 15.
