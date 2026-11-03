# STEP 13 report: granular G2 approval for verified COBOL behaviour

Real run: `FWD-20261031T172520Z-66b3` (baseline `352b97f0…4d24a068`), 2026-11-02.

| Layer | RTNCDE00 P200 ("set return code", lines 64–81) |
|---|---|
| Dependency closure | **RESOLVED**: RTNCDE00 and RTNCODE only; no SQL, no undeclared names |
| SQLCA decisions | **excluded from the subset** with recorded reasons; **still blocking the program** |
| Blocking findings in the subset | **2**: its own evidence reviews (RVW-REQ-RTNCDE00-002, -003) |
| Approved | **nothing**; trust TRUST_NOT_CONFIGURED; G2 UNVERIFIED |
| Java | **none** |

## 1. Files changed

**New:**

| Area | Files |
|---|---|
| Runtime | `runtime/src/approval/closure.ts` (dependency closure) |
| Tests | `tests/step13.test.ts` |
| Reports | `reports/STEP-13-REPORT.md`; `reports/step-13/` (scope evidence manifests for P200 and P400, scoped gap handoff, approval prerequisites, subset review package and fresh requests) |

**Modified:**

| File | Change |
|---|---|
| `runtime/src/approval/scope.ts` | typed `behaviour` selector; closure-based units, items, decision attribution and findings; digest binding. Existing selectors and their digests are unchanged. |
| `runtime/src/approval/approvals.ts` | approval request binds `runtime_requirements` and, for behaviour scopes, the closure, items, decisions and gaps |
| `contracts/orchestrator/approval-request.schema.json` | optional, validated `scope.behaviour` |
| `runtime/src/commands/operations.ts` | `approval scope` |
| `runtime/src/cli.ts` | usage text |
| `docs/PILOT-OPERATIONS.md` | section 1b |

**Not modified:** the original COBOL, reverse outputs, reverse agents and skills, Neo4j, earlier records, Git history.

## 2. Tests

| Run | Result |
|---|---|
| Baseline before changes | 317 / 317 |
| **Final** | **329 tests, 329 passed, 0 failed, 0 skipped** (317 existing plus 12 new test cases covering the 24 required items; no earlier test changed) |
| `doctor` | OK |
| `validate` | OK (0 errors, 0 warnings) |
| `agents` | 7 OK |
| `skills` | 14 / 14 installed |

| # | Required test | Test case |
|---|---|---|
| 1 | Mixed functional and runtime scopes | real 1/2 |
| 2 | Exact identity and hashes | real 1/2 |
| 3 | Direct data dependencies | real 3/6 |
| 4 | Indirect SQL (an input written by embedded SQL elsewhere) | fixture 4/5 |
| 5 | PERFORM and CALL closure | real 3/6, fixture 4/5 |
| 6 | Level-88 copybook dependencies | real 3/6 |
| 7 | SQLCA included when applicable | real 7/8 (P400, program) |
| 8 | SQLCA excluded when provably unrelated | real 7/8 (P200) |
| 9 | Unknown dependency blocks | fixture 9 |
| 10 | Missing required runtime requirement | real 10/11/14 |
| 11 | Omitted business rule | real 10/11/14 |
| 12 | Deferred-gap traceability | real 12/13 |
| 13 | Numeric-range uncertainty | real 12/13 |
| 14 | Invalidated evidence | real 10/11/14 |
| 15 | Changed source baseline | fixture 15/16/17 |
| 16 | Changed dependency closure | fixture 15/16/17 |
| 17 | Stale or replayed approval | fixture 15/16/17 |
| 18 | Synthetic valid scoped approval | fixture 18/19/21 |
| 19 | No program approval from a subset approval | fixture 18/19/21 |
| 20 | G2 blocked without genuine signers | fixture 20, real 20/22/23/24 |
| 21 | G3 respects the exact subset | fixture 18/19/21 |
| 22 | No unauthorised Java | fixture 18/19/21, real 20/22/23/24 |
| 23 | Audit immutability | fixture 23, real 20/22/23/24 |
| 24 | Reverse-output protection | real 20/22/23/24 |

## 3. How requirement scopes work now

**Existing scopes are unchanged.** `application`, `programs:` and `requirements:` keep their rules and digests (the latter still refuses RT-* IDs; tested).

**New: `behaviour:PROGRAM:PARAGRAPH:requirement=ID,…,runtime_requirement=ID`.**
- **Typed identities.** Each item names its kind. A wrong kind, ID or program is refused. The selector text is canonical.
- **Units and items.** They come from the deterministic **dependency closure** (`approval/closure.ts`):
  - **direct:** the PERFORM range, entry paragraph THRU the paragraph every PERFORM of it names;
  - **transitive:**
    - performed paragraphs;
    - the dispatch trigger;
    - every statement in the program that writes a consumed input (by MOVE, SET, INITIALIZE of an ancestor group, arithmetic or SQL INTO), with that writer's own SQL and undeclared-name dependencies;
    - statically CALLed programs;
    - the copybooks that declare referenced fields and conditions (by file identity);
    - the SQL communication area whenever any closure statement or input writer is embedded SQL.
- **Items in scope:** only the selected items, plus the data contracts whose fields the closure references, plus file operations only if the closure performs file I/O.
- **Fail-closed.** Each of these makes the closure **UNRESOLVED**, which blocks the scope:
  - every word must be a keyword, declared, a paragraph, a file, a literal, or an undeclared name owned by a blocking decision; anything else is an unknown dependency;
  - an ambiguous reference;
  - GO TO, ALTER, a dynamic CALL, EXEC CICS, ENTRY;
  - a missing target, a CALL to a program outside the inventory, conflicting THRU ranges;
  - unavailable source.
- **Additional blocking findings:**
  - an unselected requirement or runtime requirement whose cited line lies inside the behaviour (`missing_required_item`);
  - a rule whose source lies inside it with no selected requirement (`omitted_rule`);
  - every blocking gap inside the closure.
- **Approval binding.** The digest includes the closure hash, source identity, typed items with content hashes, the full decision attribution and the deferred gaps. The approval request carries them explicitly (`scope.behaviour`, contract-validated) and states that it approves nothing else in the program. The existing Ed25519 trust, request, replay, expiry and self-approval checks apply unchanged.
- **Downstream.** A behaviour approval yields `approvedScope` with exactly its requirements, and the existing G3 check refuses components citing anything else. F5 still needs the generation flag (tested).

## 4. P200 dependency closure (real)

| | |
|---|---|
| Source | `RTNCDE00.cbl` sha256 `7cb951ea1f418c19ddd61c0eca00f21108af5f364b5ecf05742cbc428862994e` |
| Closure | RESOLVED, sha256 `3d6bf30c…` |
| Direct | lines 64–81 and 83; range `P200-SET-RETURN-CODE THRU P200-EXIT` |
| Trigger | line 37 `WHEN RC-SET-CODE` (RTNCODE.cpy:7, `'S'`, FLD-000003) |
| Inputs | RC-NEW-CODE (FLD-000011), RC-HIGHEST-CODE (FLD-000010) |
| Transitive writers | P100 lines 54 (`INITIALIZE RC-CODES-AREA`) and 57: no SQL, no undeclared names |
| Outputs | RC-HIGHEST-CODE, RC-CURRENT-CODE (FLD-000009), RC-STATUS (via 88-levels S/W/E/F, RTNCODE.cpy 17–20, FLD-000013..016), RC-RESPONSE-CODE (FLD-000018) |
| Units | RTNCDE00 (primary), RTNCODE (declares every referenced name) |
| External operations, CALLs, undeclared names | none |

**Contrast (positive control): P400.** Its closure includes SQLCA (embedded INSERT at line 96) and uses undeclared SQLCODE (line 113). There the SQLCA decisions and gaps apply.

## 5. SQLCA decisions that apply, and why

**For P200: none.**

**They apply to:**
- `programs:RTNCDE00` (8 blocking findings, including DR-DB2CONN-002 and DR-F2-0011-001);
- the P400 and P500 behaviours;
- every other affected program scope.

## 6. SQLCA decisions excluded from P200, and why

| Decision | Reason recorded by the attribution |
|---|---|
| DR-F2-0011-001 (SQLCA layout) | "concerns SQLCA, which RTNCDE00 includes but the closure does not: no closure field or condition is declared there, no closure statement or input writer is embedded SQL, and the closure uses none of SQLCA, SQLCODE, SQLSTATE, SQLERRMC" |
| DR-DB2CONN-002 (SQLCODE semantics) | its affected requirements (REQ-RTNCDE00-001, -004 and 7 others) are outside the selection, and nothing in the closure uses its subject (SQLCODE, SQLERRMC, SQLCA) |
| DR-F2-0005-009 (SQLCA modelling, advisory) | its subject (SQLCA, WS-DB2-AREA, SQL-STATUS-CODES, SQLCODE, SQLERRMC) lies outside the closure |

**Other exclusions:**
- **RVW-REQ-RTNCDE00-004:** affects only REQ-004.
- **DR-RTNCDE00-001 (advisory):** affects REQ-001 and REQ-004. Note that it asks whether THRU ranges carry behaviour; for P200 the closure itself shows that `P200-EXIT` contains only `EXIT`.

**Applicable but non-blocking (advisory):**
- DR-F2-0005-010 (the RTNCODE caller contract);
- DR-F2-PKT0010-002 (code page of RTNCODE);
- RVW-GAP-092 and RVW-GAP-104 (global).

**How the exclusion was established.** The program's own name never counts as a subject inside the closure. The first version of the attribution let DR-DB2CONN-002 apply merely because its question names RTNCDE00; that was corrected before any record was produced.

## 7. Source-evidence issues (unchanged, still blocking P200)

- **REQ-RTNCDE00-002:** REQUIRES_EVIDENCE. EAR-0002 invalidated the earlier verification (`'S'` matched only inside RC-HIGHEST-CODE). It cannot simply be excluded: dropping it makes the scope report it as a missing required item and BR-039 as an omitted rule (tested).
- **REQ-RTNCDE00-003:** REQUIRES_EVIDENCE until a signed acceptance of ESU-0002. The source chain is verified (EAR-0003); verified evidence is still not acceptance.
- **RT-RTNCDE00-001:** VERIFIED.
- **Domain restriction.** Two numeric-range gaps (`…TRUNC-RC-HIGHEST-CODE`, `…TRUNC-RC-CURRENT-CODE`) are in the closure as non-blocking `deferred_domain` findings. ±9999 is a **proposed supported input domain**. An input beyond it must fail as an unsupported pilot case, and no COBOL result or rejection is implied.

## 8. Exact pending human decisions

| For | Decision | Role | Fresh request (expires 2026-11-09) |
|---|---|---|---|
| **P200 subset** | RVW-REQ-RTNCDE00-002 | `business_sme` / `exception_approver` | `DRQ-a25fb8eb7a96` |
| **P200 subset** | RVW-REQ-RTNCDE00-003 | `business_sme` / `exception_approver` | `DRQ-cab3ba15ddb8` |
| Full program | DR-DB2CONN-002, DR-F2-0011-001 | `technical_authority` | Step 12 package `DRQ-68646916d34f`, `DRQ-2df78db54de2` |
| Full program | RVW-REQ-RTNCDE00-004 | `business_sme` | `DRQ-169036e9539b` |

Details are in `reports/step-13/p200-approval-prerequisites.md`.

## 9. Full program versus subset (real, read-only)

| Scope | Readiness | Blocking |
|---|---|---|
| `behaviour:…P200…` | NOT_READY | **2**: REQ-002, REQ-003 |
| `programs:RTNCDE00` | NOT_READY | 8: adds DR-DB2CONN-002, DR-F2-0011-001, REQ-001, REQ-004, RT-002, RT-003 |
| `application` | NOT_READY | 417 (unchanged since Step 12) |

**G2:** UNVERIFIED.

## 10. Current scope digests

| Scope | Digest |
|---|---|
| P200 subset | **`4e205c3d74de80ad3ae110ffd0d352715eb7bce6c662c8be4a7e403097055219`** |
| `programs:RTNCDE00` | `3c8aa823d8353b384d12a341c029d729b74c3306c823fc38e05a8a0559a75dc4` (unchanged) |
| `application` | `362e4f76b7611248…` |

## 11. Approval and trust

- **TRUST_NOT_CONFIGURED;** no signer for any role.
- **No records:** no approval or resolution record exists.
- **Synthetic signers** were used only in temporary test fixtures.

## 12. Does an independently approvable subset exist?

**Yes.** The existing engine can now represent `behaviour:RTNCDE00:P200-SET-RETURN-CODE` with REQ-002, REQ-003 and RT-001. Its dependency closure is resolved and independent of SQLCA. It becomes READY when the two evidence reviews are signed and imported (plus the REQ-002 revision if chosen), and passes G2 only with a genuine signed approval of its exact digest.

## 13. Audit and checkpoint integrity

- **Workflow writes in Step 13:** one sealed `operations/g2-approval-readiness-0005.json` (written by `approval readiness`, by design), the audit append and the checkpoint.
- **Audit and checkpoint:** audit 326 → 327; checkpoint #178 verified.
- **Read-only operations:** all scope evaluations, `approval scope` and `approval package` were read-only on the workflow (package exports only).
- **Earlier records:** no EAR, ESU, SDF, receipt, gate or approval record changed.
- **Protected files:** `output/` 534 files unchanged; the 87 checked COBOL sources are unchanged, and nothing under `references/` was modified; no tracked file changed.

## 14. Real BMad or F1–F7 execution

**None.**
- **BMad:** `bmad dry-run --workflow bmad-prd --scope <P200 subset>` would be **REFUSED** (state, G2 not passed, scope not approved); nothing was written.
- **AI and agents:** no AI provider call was made, and no agent was dispatched.

## 15. Production Java

**None.** `java_generation_allowed: false`, no tracked `.java` file, and generation stays unauthorised even after a synthetic subset G2 PASS (tested).

## 16. Exact prerequisites for authorised P200 Java implementation

1. **Key custodian:** a trust store with real signers.
2. **Business SME:** signs RVW-REQ-RTNCDE00-003 (accept ESU-0002) and RVW-REQ-RTNCDE00-002 (`resolved_requires_update` with the citation revision, or `approved_exception`). The operator imports them and applies any revision.
3. **Operator:** `approval scope` on the P200 scope must show READY; then `approval export-request`.
4. **Requirements approver** (not the requester): signs. Then import, `workflow gate --gate G2` gives PASS for the subset only, and the workflow advances to REQUIREMENTS_APPROVED.
5. **G3:** an F3 architecture for exactly REQ-002, REQ-003 and RT-001. The existing check refuses anything wider. It needs ADRs for the supported ±9999 domain and the excluded dispatch.
6. **G4:** F4 stories traced to that architecture.
7. **Generation:** the project authority sets `java_generation_allowed` and a `java_target_dir`. Only then F5 may implement P200, and its result must be labelled a partial implementation of RTNCDE00, never equivalent to the program.

**Not started:** Step 14.
