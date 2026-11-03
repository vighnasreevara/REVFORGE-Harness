# STEP 12 report: first real COBOL pilot scope (RTNCDE00)

Real run: `FWD-20261031T172520Z-66b3` (baseline `352b97f0…4d24a068`), 2026-11-02.

**Strategy:** convert verified, approved behaviour; preserve unresolved gaps; never invent missing behaviour.

| Layer | RTNCDE00 |
|---|---|
| Smallest source-verified, independently implementable behaviour | **P200 "set return code"** (lines 64–81) |
| Approved by a human | **nothing** |
| Approvable today with the existing engine without the shared SQLCA decisions | **no** (limitations L1, L2) |
| G2 | **UNVERIFIED** |
| Real Java generated | **none** |

## 1. Files changed

**New:**

| Area | Files |
|---|---|
| Runtime | `runtime/src/approval/semantic.ts`, `runtime/src/context/semantic-findings.ts`, `runtime/src/pilot/scope.ts` |
| Contracts | `contracts/verification/semantic-dependency.schema.json`, `contracts/pilot/verified-scope.schema.json` |
| Tests | `tests/step12.test.ts` |
| Reports | `reports/STEP-12-REPORT.md`; `reports/step-12/` (see deliverables below) |

**Modified:**

| File | Change |
|---|---|
| `runtime/src/approval/snapshot.ts` | applies semantic dependency edges after the register is built |
| `runtime/src/operations/package.ts` | uses the shared `decisionNames` |
| `runtime/src/pilot/plan.ts` | uses the shared `reachedStatements` / `usesWord` |
| `runtime/src/commands/context.ts` | `verification context dependencies [--record]` |
| `runtime/src/commands/pilot.ts` | `pilot scope` |
| `tests/helpers/contextfixture.ts` | optional `extraEdit` hook (additive) |

**Not modified:** reverse agents and skills, `output/`, the original COBOL, Neo4j, earlier records (ESU, EAR, receipts, gates, approvals), Git history.

**Deliverables** (`reports/step-12/`):

| Deliverable | File |
|---|---|
| Verified-scope manifest (machine-readable, contract `pilot/verified-scope`) | `verified-scope-programs_RTNCDE00.json` |
| Behaviour and dependency classification | `behaviour-classification.md` |
| Deferred-gap handoff | `gap-handoff.md` (also the `gaps` array of the manifest) |
| Proposed Java design | `p200-java-design.md` |
| Proposed test cases | `p200-proposed-tests.json` |
| Signed-approval prerequisite checklist | `approval-checklist.md` |
| Refreshed review package and fresh requests | `review-package-programs_RTNCDE00.{json,md}`, `resolution-requests/` |
| Refreshed modernization plan | `modernization-plan-programs_RTNCDE00.json` |
| Semantic dependency findings | `semantic-dependencies.json` |
| Recovery results | `recovery/` |

## 2. Tests

**Build:** OK.

**Baseline before changes: 309/309.** After the G2 semantic fix, before adding tests: 309/309 (no earlier test changed). **Final: 317 tests, 317 passed, 0 failed, 0 skipped** (309 existing plus 8 new).

| Required regression test | Test (`tests/step12.test.ts`) |
|---|---|
| G2 semantic dependency classification | `1`, `3` |
| SQLCODE-dependent behaviour | `6` (real run) |
| Verified subset dependency closure | `5`, `7/8/9` |
| Shared dependencies | `6` (DR-F2-0011-001 is reached through the included SQLCA copybook), `7/8/9` (L2 classification) |
| Unrelated gaps do not block an independent scope | `5` (overlapping requirements excluded), `6` (RT-001 and REQ-003 unaffected), `7/8/9` (P200 gaps non-blocking) |
| Required gaps remain blocking | `7/8/9` |
| Exact scope hashes | `7/8/9` (the subset digest differs from the program digest; content and gap IDs are deterministic) |
| No automatic approval | `7/8/9`, `2` (only a signed resolution clears an edge) |
| No production Java generation | `10` |
| Historical record immutability | `4` (receipts unchanged; no re-recording), `7/8/9` (EAR hashes and audit unchanged by evaluation) |

**Other checks run:**
- source and dependency verification (`verification context dependencies`);
- RTNCDE00 classification (`pilot scope`, `pilot plan`);
- G2 eligibility (`approval readiness` for the program and the subset);
- BMad dry-run;
- workflow status (checkpoint #177 verified);
- protected-file integrity (§11).

## 3. The G2 semantic dependency defect and its resolution

**Symptom (Step 11).** RT-RTNCDE00-002 and -003 were G2 VERIFIED although their response codes (`IF SQLCODE = 0`, lines 113 and 135) depend on SQLCODE, which is declared nowhere and is the subject of the open blocking decisions DR-DB2CONN-002 and DR-F2-0011-001.

**Diagnosis:**

| Candidate cause | Finding |
|---|---|
| Structural vs semantic verification | **Yes.** The claim check verifies literals in the cited statement. The symbol resolver (`statementReferences`) silently drops names that are declared nowhere ("not a data name of this program"), so `SQLCODE` never surfaced. |
| Missing transitive dependency edges | **Yes, the root cause.** Runtime requirements are created with `open_decisions: []`, and scope evaluation attaches decisions only to `kind === 'requirement'` through F1's declared `affected_requirements`. No edge could ever exist from an F2 runtime contract, or from any behaviour, to a decision about a name it uses. |
| Incorrect evidence-status selection | No |
| Stale result | No (re-evaluated live) |
| Incorrect scope classification | No |

**Fix (generic; `approval/semantic.ts`).**
- **What it does:** for every requirement and runtime requirement, follow the cited paragraph and every paragraph it PERFORMs (THRU ranges, transitively). Link the item to each **blocking** decision on the program, or on a copybook it includes, that names a word the reached statements use but the program declares nowhere.
- **What counts as a name:**
  - literals never count;
  - in embedded SQL only `:host` variables count;
  - paragraph, section, file, program and copybook names never count, and neither do COBOL/CICS reserved words.
- **How the link behaves:** it is added to the item's open decisions. While the decision is open, the item is REQUIRES_SME_DECISION (fail-closed). A signed resolution clears it through the existing mechanism (test 2).
- **What it never does:** invalidate a requirement permanently, or change a decision.

**Effect:**

| | Before | After |
|---|---|---|
| RTNCDE00 scope | NOT_READY, 6 blocking | NOT_READY, **8 blocking** (RT-002 and RT-003 now wait for DR-DB2CONN-002 + DR-F2-0011-001) |
| RT-RTNCDE00-001 (no SQL) | VERIFIED | VERIFIED (unaffected) |
| Application | 398 blocking | **417 blocking** |
| Items newly linked | — | 70 items, 128 edges; most were already blocking for other reasons |

- **Planner and G2 now agree.** The Step 11 plan's RT-002 and RT-003 discrepancy is gone.
- **The first version was too broad and was narrowed before recording.** It linked 85 items, including paragraph names (`P300-FETCH-DATA`), verbs (`WRITE`), the class test `NUMERIC`, file names and the CICS option `RIDFLD`.
- **Remaining non-SQL edges are genuine undeclared data names,** verified in the source. For example, `ENTRY-POINT-INIT` is tested by `WHEN` but declared nowhere; `WS-ERROR-MESSAGE` and `POS-*` belong to missing copybooks.

**Records.**
- **What was recorded:** each new edge, as `SDF-0001…SDF-0070` (contract `verification/semantic-dependency`), versioned and sealed (`semantic_dependency_recorded`; audit 254 → 324).
- **Re-recording:** an unchanged finding is not recorded again.
- **History:** no earlier record was changed (test 4, and the EAR hashes in test 7/8/9).

## 4. Independently implementable behaviours

| Behaviour | Class | Approvable subset? |
|---|---|---|
| **P200-SET-RETURN-CODE** (64–81) | VERIFIED_CANDIDATE | **yes, by requirement closure:** REQ-002, REQ-003, RT-001 |
| P100-INIT-RETURN-CODES (54–59) | VERIFIED_CANDIDATE | no: only REQ-001 covers it, and REQ-001 also covers P400/P500 |
| P300-GET-RETURN-CODE (86–89) | VERIFIED_CANDIDATE | no: same reason |
| NO-MATCH (unknown request type) | VERIFIED_CANDIDATE | no: same reason |

**The selected candidate (P200):**

| | |
|---|---|
| Source | RTNCDE00.cbl `7cb951ea…`, RTNCODE.cpy `27eabb51…` |
| Content sha256 | `50ce87ac…` |
| Inputs | RC-NEW-CODE (FLD-000011), RC-HIGHEST-CODE (FLD-000010) |
| Outputs | RC-HIGHEST-CODE, RC-CURRENT-CODE (FLD-000009), RC-STATUS (88-levels FLD-000013..016), RC-RESPONSE-CODE (FLD-000018) |
| Side effects, SQL, external calls | none |
| No-taint check | no input is written by a blocked behaviour |
| Rules | BR-039, BR-040 |
| Control-flow boundary | `PERFORM P200 THRU P200-EXIT`; the dispatch is excluded |
| Domain restriction | inputs beyond ±9999 depend on the unknown TRUNC option, so they are rejected rather than truncated (non-blocking gaps) |

The traceability matrix, design and 12 proposed tests are in `p200-java-design.md` and `p200-proposed-tests.json`.

## 5. Excluded or deferred behaviours

| Behaviour | Reason |
|---|---|
| ENTRY-DISPATCH | PARTIAL: it routes into blocked branches |
| P100, P300, NO-MATCH | verified, but only REQ-001 covers them. Fix: an SME splits REQ-001 per request type (`resolved_requires_update`), not done here. |
| P400 log | PARTIAL: CURRENT-DATE move independent; INSERT external; SQLCODE outcome dependent |
| P500 analyse | GAP: external SELECT plus SQLCODE outcome; REQ-004's citation is also contradicted |

## 6. Gaps

**8 gaps: 4 blocking, 4 non-blocking.** All are OPEN; full detail is in `gap-handoff.md`.

| Gap | Blocking | Precise reason |
|---|---|---|
| `GAP-RTNCDE00-P400-LOG-RETURN-CODE-SQLCODE` | yes | response 0/8 depends on undeclared SQLCODE (DR-DB2CONN-002, DR-F2-0011-001) |
| `GAP-RTNCDE00-P400-LOG-RETURN-CODE-SQL-INSERT-RTNCODES` | yes | external DB2 INSERT: timestamp conversion of the 16-character host variable, duplicate key, status |
| `GAP-RTNCDE00-P500-ANALYZE-CODES-SQLCODE` | yes | response 0/8 depends on SQLCODE |
| `GAP-RTNCDE00-P500-ANALYZE-CODES-SQL-SELECT-RTNCODES` | yes | external DB2 SELECT: empty window (NULL MAX/MIN without indicators), timestamp comparison |
| `GAP-RTNCDE00-P200-…-TRUNC-RC-HIGHEST-CODE`, `…-TRUNC-RC-CURRENT-CODE` | no | binary truncation beyond ±9999 depends on the unknown compiler TRUNC option |
| `GAP-RTNCDE00-P300-…-TRUNC-RC-RETURN-VALUE`, `…-TRUNC-RC-HIGHEST-RETURN` | no | same |

## 7. Does an approvable smaller scope exist?

**In the source: yes,** P200 with REQ-002, REQ-003 and RT-001.

**In the existing G2 engine: not without a policy change.** The read-only evaluation of `requirements:REQ-RTNCDE00-002,REQ-RTNCDE00-003` (digest `a46bd86f…`) is NOT_READY with 5 blocking findings:
- the 2 candidate requirements (each waiting for its review decision);
- **L1:** runtime requirements cannot be named in a requirements selector and are all included, so SQLCODE-blocked RT-002 and RT-003 enter the subset;
- **L2:** DR-F2-0011-001 (a SQLCA unit decision with no affected requirements) applies although P200 never reaches SQLCA.

**Minimal policy changes proposed, not implemented:**
- allow RT-* IDs in requirements selectors;
- apply unit-level decisions to a subset only through a semantic edge, and list them as traceable deferrals otherwise.

Under the current engine, the candidate needs the same five signatures as the whole program. Approval of a subset would bind to its own digest and never imply approval of RTNCDE00.

## 8. Exact remaining human actions

1. **Key custodian:** trust store (TRUST_NOT_CONFIGURED today).
2. **Business SME, for the candidate:**
   - RVW-REQ-RTNCDE00-003: `resolved_no_change` selecting ESU-0002 (`DRQ-8a56c9fba2f7`);
   - RVW-REQ-RTNCDE00-002: `resolved_requires_update` (re-cite, revise) or `approved_exception` (`DRQ-61ecf91d935f`). REQ-002 cannot be excluded: it specifies P200 outputs.
3. **Project authority:** accept or reject the L1/L2 policy change.
4. **Technical authority** (required under the current engine, and for all deferred behaviour): DR-DB2CONN-002 (`DRQ-68646916d34f`), DR-F2-0011-001 (`DRQ-2df78db54de2`). Also the compile options (TRUNC) and the database-interaction specification.
5. **Business SME, for deferred behaviour:** RVW-REQ-RTNCDE00-004 (`DRQ-169036e9539b`, RP-8d2dd33787). Optionally split REQ-001 to free P100, P300 and NO-MATCH.
6. **Requirements approver:** signs the G2 request for the exact READY scope.

Fresh requests expire 2026-11-09. The Step 5.5 and Step 8 RVW-003 requests are stale.

## 9. G0–G8

| Gate | Status |
|---|---|
| G0 | PASS |
| G1 | PASS |
| G2 | **UNVERIFIED** |
| G3 | BLOCKED |
| G4 | BLOCKED |
| G5 | BLOCKED |
| G6 | BLOCKED |
| G7 | BLOCKED |
| G8 | BLOCKED |

**Workflow state:** REQUIREMENTS_DRAFTED.

## 10. Real Java generation

**None.**
- `java_generation_allowed: false`, and generation is unauthorised.
- No `.java` file is tracked.
- The only Java on disk is the Step 11 synthetic pilot output.
- The P200 design is a document, not code.

## 11. Recovery integrity

### Restore-verified backup

Taken with no tests running; nothing uploaded. Location: `C:\Users\vighn\revforge-backups\revforge-forward-20261102T204922Z\`

| | |
|---|---|
| Archive | sha256 `170fd12316df0d8659a04782ed35de780807bd5d70bca81e15cc63bf332b80eb`, 2,440,753 bytes |
| Contents | 643 files (6,807,586 bytes); tree `093dab5c…` |
| Archive verification | 643 entries, relative, no traversal, no links |
| Excluded | runs, build output, executor, original COBOL, credentials, report exports, pilot output, transient test workspace. No file was excluded as a secret. |

| Restore into a disposable checkout at `b092004` | Code only | With separately held local assets |
|---|---|---|
| Git baseline, 643 files present, every sha256, nothing extra, tracked files intact, 7 agents and 14 skills, no secrets, build | all ok | all ok |
| **Tests** | 308 pass, 1 fail, 8 skip | **317 / 317 pass, 0 skipped** |

The code-only failure and skips are exactly the tests that need the separately held run, executor or COBOL source:
- **Fails:** Step 6 #25.
- **Skips:**
  - Step 11: 2/11, 10/12, 16;
  - Step 12: 6, 7/8/9, 10;
  - Step 4.5 real run;
  - Step 7 #30.

Both temporary checkouts were deleted.

### Final backup with the finished documentation

The Step 11 archive predated the last report and doc edits. Here, this report was completed after the restore-verified backup, so a **final backup** was taken afterwards with the same mechanism, again with no tests running, and its archive was verified. Code and tests are identical to the restore-verified backup; only the report files differ.

| | |
|---|---|
| Location | `C:\Users\vighn\revforge-backups\revforge-forward-20261102T205946Z\` |
| Archive | sha256 `d0a2dd2e69cd2a669114c780bb9bc4322e575c019e7b29f632b77d36de66db0b`, 2,441,894 bytes |
| Contents | 643 files; tree `e0672fc5…` |
| Verification | 643 safe entries; no file excluded as a secret |

The only text that postdates this archive is the table above, which records the archive's own hash.

### Integrity

| Item | Status |
|---|---|
| `output/` | 534 files, all sha256 unchanged |
| Original COBOL | 87 checked source files unchanged; no file under `references/` modified since Step 10 |
| Tracked files | none changed; commit `b092004` |
| Workflow: writes in Step 12 | only 70 new `SDF` records in `context/`, 2 sealed `g2-approval-readiness` records in `operations/` (written by `approval readiness`, by design), the appended audit and the checkpoint |
| Workflow: audit and checkpoint | 254 → 326; checkpoint #177 verified |
| Workflow: earlier records | no EAR, ESU, receipt, gate or approval changed; no APR or RES record exists |
| Recovery manifest | regenerated (`reports/step-9/recovery-manifest.json`)

## 12. Real F1–F7 or BMad execution

**None.**
- **BMad:** `bmad dry-run --workflow bmad-prd --scope programs:RTNCDE00` reported **would be REFUSED (nothing written)**: wrong state, G2 not passed, the scope is not approved, and LIVE is refused for 5 reasons.
- **No calls:** no provider or AI call was made, and no agent was dispatched.

## 13. Exact next action to begin authorized Java implementation

**First, a key custodian installs the trust store.** Then either:

- **(a) Accept L1/L2.** If the project authority accepts the minimal policy change, implement it, then have the business SME sign RVW-003 and RVW-002, re-run `pilot scope`, and if the subset is READY, export and sign the G2 request for its exact digest; or
- **(b) Current engine.** Additionally obtain the technical authority's two SQLCA resolutions.

**After G2:** G3 (ADRs for the domain restriction and the excluded dispatch), G4 (one story for P200), and the generation flag with a target directory. Only then F5 may implement P200, using the proposed tests as its acceptance basis.

**Not started:** Step 13.
