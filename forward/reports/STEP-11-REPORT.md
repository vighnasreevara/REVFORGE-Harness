# STEP 11 report: final architecture readiness and small COBOL-to-Java pilot

Real run: `FWD-20261031T172520Z-66b3` (baseline `352b97f0…4d24a068`), 2026-11-02.

Principle applied: **convert what is verified, preserve what is unknown, never fabricate missing behaviour.**

| Layer | RTNCDE00 |
|---|---|
| Planning category | VERIFIED 2 · PARTIAL 3 · GAP 2 (non-authoritative) |
| Accepted by an authorized reviewer | **none** |
| Human decisions resolved | **none** (5 open) |
| Requirements approved | **none** |
| Scope READY | **no** (6 blocking findings) |
| G2 PASS | **no** (UNVERIFIED) |
| Java for RTNCDE00 | **none generated** |

## 1. Git

- **Branch / commit:** `main` / `b092004` (unchanged).
- **Tracked files:** none modified (`git status --untracked-files=no` is empty).
- **Commits:** none; nothing pushed.
- **Untracked:** the Steps 1–11 work stays untracked (`forward/`, `.claude/agents/fe-*`, `.claude/skills/fe-*`).

## 2. Files

**Created:**

| Area | Files |
|---|---|
| Planning | `runtime/src/pilot/plan.ts` |
| Pilot | `runtime/src/pilot/cobol-subset.ts`, `runtime/src/pilot/java-emit.ts`, `runtime/src/pilot/pilot.ts` |
| CLI | `runtime/src/commands/pilot.ts` (`pilot plan`, `pilot run`) |
| Contracts | `contracts/pilot/modernization-plan.schema.json`, `contracts/pilot/pilot-result.schema.json` |
| Synthetic pilot inputs | `pilot/synthetic-rc/{pilot.json, SPEC.md, cobol/SYNRC01.cbl, cobol/SYNDRV01.cbl, fixtures/cases.json}`, `pilot/.gitignore` |
| Tests | `tests/step11.test.ts` |
| Docs | `docs/PILOT-OPERATIONS.md` |
| Reports | `reports/STEP-11-REPORT.md`; `reports/step-11/` (architecture inventory, modernization plan JSON and Markdown, architecture preview, gap handoff, pilot evidence, review package, decision addendum, fresh requests, recovery results) |

**Modified:**

| File | Change |
|---|---|
| `runtime/src/cli.ts` | registers `pilot`; usage lines |
| `tools/backup.js` | excludes pilot output and the transient test workspace; `restore-test --checkout [--with-local-assets] [--cleanup]`; retrying cleanup; records skipped tests and failure details |
| `docs/PROJECT-RECOVERY-OPERATIONS.md` | checkout restore; pilot output exclusion |

**Generated pilot output** (reproducible, excluded from backups): `pilot/synthetic-rc/out/`, holding 7 Java sources, the classes, the source map, the result and the evidence manifest.

Reverse agents and skills, `output/`, original COBOL, Neo4j, historical records, receipts, approvals and audit events were not modified.

## 3. Tests

**Build:** OK.

**Full suite (final code): 309 tests, 309 passed, 0 failed, 0 skipped** (the 294 existing, unchanged, plus 15 new test cases covering the 16 required items). The same 309/309 was reproduced inside the disposable restored checkout (§11).

| # | Required item | Test |
|---|---|---|
| 1 | verified/partial/gap classification | `1` |
| 2 | no fabricated behaviour | `2` (COMPUTE refused; undeclared name refused) and `2/11` |
| 3 | dependency-aware partial conversion | `3` |
| 4 | unresolved-path blocking | `4/7/9` |
| 5 | synthetic Java compilation and execution | `5/6` |
| 6 | validated fixture comparisons | `5/6`, `6` (a wrong expectation gives FAILED) |
| 7 | missing COBOL compiler | `4/7/9`, `7` (no JDK) |
| 8 | gap-to-Java traceability | `8` (with a tamper-evident manifest) |
| 9 | no fake equivalence | `4/7/9` (the contract rejects it) |
| 10 | no test approvals in the real workflow | `10/12` |
| 11 | G2 stays fail-closed | `2/11` |
| 12 | G3–G8 stay blocked | `10/12` |
| 13 | recovery completeness | `13` (disposable git checkout) |
| 14 | protected-source integrity | `14`, plus the integrity checks in §19 |
| 15 | no external AI calls | `15` |
| 16 | no production Java generation | `16` and the `8` workflow test |

**JDK for the Java tests.** The Java tests need a JDK. The suite was run with `REVFORGE_JAVA_HOME` set to the JDK already installed on this machine (Microsoft OpenJDK 21.0.13; nothing installed). Without a JDK those tests skip and say why; they never fake a result.

**Defects the real tool runs exposed (and fixed):**
- **`javac -Werror`:** the generated exception class lacked `serialVersionUID`.
- **Planner:** words inside embedded SQL (`TIMESTAMP`, `COUNT`) were taken for COBOL names. Only `:host` variables are COBOL names now.
- **Step 10 restore** could not run git-dependent tests. This is now covered by the checkout restore.
- **Backup tool:** a backup taken during a test run could capture `forward/tests/.tmp/`; cleanup could throw on Windows file locks (§11).
- **Step 11 test 2/11** ignored the configured COBOL source root inside a restored checkout.

## 4. Synthetic COBOL execution

**Not executed.** No COBOL compiler exists on this machine; Windows `PATH`, WSL Ubuntu and Docker were all checked, and nothing was installed. The pilot reports `COBOL_COMPILER_UNAVAILABLE`.

**What a reference run would need.** With a compiler, `SYNDRV01` would capture reference outputs automatically (`REVFORGE_COBC` or `cobc`). That code path has **not been exercised**.

## 5. Java compilation and execution

**Real, with JDK 21.0.13.**

| Item | Result |
|---|---|
| Generated sources | 7 (288 lines) |
| `javac -Xlint:all -Werror` | **COMPILED** |
| `java` harness against the 15 fixture cases | **14 PASS, 1 BLOCKED_AS_EXPECTED, 0 FAIL** |
| Trace audit | 33/33 COBOL statements mapped to Java lines; no findings |
| Evidence manifest | sha256 `5563a2a1…`, verified |

The pilot evidence is in `reports/step-11/pilot/`.

**Validation kind: FIXTURE_BASED. Equivalence: EQUIVALENCE_UNVERIFIED.**
- The Java was compared only with the specification-derived expectations, which were written before generation.
- They have not been reviewed by an independent human.
- This is **not** runtime COBOL/Java equivalence.

## 6. Verified versus unverified functionality

**Synthetic pilot:**

| Behaviour | Category | Evidence |
|---|---|---|
| Reset (`R`), post (`P`, including the negative-code error → 20), query (`Q`), unknown action (→ 90) | VERIFIED | translated from source; fixtures pass |
| Publish (`U`) through `CALL 'SYNEXT01'` | **GAP** (`GAP-SYNRC01-0001`) | blocked placeholder |
| Program status | **PARTIAL** | never COMPLETE |

**RTNCDE00 (planning only):** see §10.

## 7. Real F1–F7 agent invocations

**None in Step 11.** No agent, BMad workflow or AI provider was invoked. F1/F2 deliveries on the real run date from earlier steps.

## 8. Mocked or deterministic stages

| Stage | What actually ran |
|---|---|
| F1–F4 on the synthetic workflow fixture | Deliverables pre-authored by the test helpers, processed by the **real** orchestrator, receipt validator and G2/G3/G4 approval code with synthetic in-memory keys, all in a temporary fixture repository. The fixture reached `STORIES_APPROVED` (G4 PASS). |
| F5 on that fixture | Real `prepare` returned `may_write_code=false` and `generation_authorized=false` ("Java generation is not authorised"). G5 stays fail-closed. |
| Pilot "extraction / gap analysis / implementation / review" | Deterministic tools (subset parser, generator, trace audit), **not** the F1/F5/F7 agents |
| Pilot "testing" | Real `javac`/`java` processes against fixtures (not the F6 agent) |
| F3 | Not executed; the architecture preview is hand-written and non-authoritative |
| BMad | Not run (adapter unchanged; LIVE refused since Step 9) |

Synthetic approvals and receipts exist only in the temporary fixture; none touched the real run.

## 9. Gap preservation

`GAP-SYNRC01-0001` (`UNDEFINED_EXTERNAL_CALL SYNEXT01`, `SYNRC01.cbl:81`, OPEN):
- **Context kept:** the original context is preserved (file hash, paragraph excerpt).
- **Dependents traced:** dependent statements (81, 82, 83, 85), the affected items, and the dispatch branch `SYN-ACT-PUBLISH`.
- **Java trace:** interface `ExternalSynext01`, INCOMPLETE PLACEHOLDER `UnresolvedSynext01` (always throws), call site `Synrc01.java:108`.
- **Blocking proven:** fixture C15 → `BLOCKED GAP-SYNRC01-0001`.
- **Unrelated paths still tested:** they pass.
- **No defaults:** no default value is used anywhere.

The full account is in `reports/step-11/gap-handoff-demonstration.md`.

## 10. RTNCDE00 readiness

| Requirement | Plan category / class | G2 outcome (unchanged) |
|---|---|---|
| REQ-RTNCDE00-001 dispatch | **PARTIAL** (37 independent, 6 SQLCODE-dependent statements) | REQUIRES_SME_DECISION |
| REQ-RTNCDE00-002 highest code | **GAP**: INSUFFICIENT_EVIDENCE (`EAR-0002` invalidated; behaviour covered by RT-001) | REQUIRES_EVIDENCE |
| REQ-RTNCDE00-003 severity | **VERIFIED** in source (`EAR-0003`, `ESU-0002`); **not accepted** | REQUIRES_EVIDENCE |
| REQ-RTNCDE00-004 analyse | **GAP**: CONTRADICTED (citation 121; RP-8d2dd33787 pending) | CONTRADICTED |
| RT-RTNCDE00-001 | **VERIFIED** | VERIFIED |
| RT-RTNCDE00-002 log row | **PARTIAL** (timestamp and INSERT independent; 0/8 response depends on SQLCODE) | VERIFIED |
| RT-RTNCDE00-003 analyse query | **PARTIAL** (SELECT independent; response depends on SQLCODE) | VERIFIED |

**Finding.** G2 calls RT-002 and RT-003 VERIFIED, although their response codes depend on the unresolved SQLCODE. The scope is blocked anyway; the G2 policy was **not** changed.

**Scope:** NOT_READY; 6 blocking findings; digest `bd0fcf24e958fffd47175318ffdc6805b60b97194b304809915eebea4201113a` (unchanged).

**Documents:**
- `reports/step-11/rtncde00-modernization-plan.md`, covering the nine questions per requirement: evidence, hashes, meaning, missing information, dependencies, independence, decisions, Java responsibility, tests.
- `reports/step-11/rtncde00-architecture-preview.md` (**NON-AUTHORITATIVE**). It separates confirmed constraints [C], proposed choices [P] and gaps [GAP]: plain Java 21, no framework, caller-owned area, ports for the two SQL operations, and a throwing placeholder for the response mapping after SQL.

**Decision package (refreshed; nothing signed):** `reports/step-11/review-package-programs_RTNCDE00.md` and `decision-package-addendum.md`.

| Signing order | Decision | Role | Fresh request |
|---|---|---|---|
| 1 | DR-DB2CONN-002 | `technical_authority` | `DRQ-8a46d20a555f` |
| 2 | DR-F2-0011-001 | `technical_authority` | `DRQ-5a06c97411d1` |
| 3 | RVW-REQ-RTNCDE00-004 | `business_sme` | `DRQ-91faa5b8863b` |
| 4 | RVW-REQ-RTNCDE00-003 | `business_sme` | `DRQ-f226cdb8499a` |
| 5 | RVW-REQ-RTNCDE00-002 | `business_sme` | `DRQ-a9e2249a4258` |

- **Expiry:** all fresh requests expire 2026-11-09.
- **Stale (never to be signed):** the Step 5.5 and Step 8 requests for RVW-003.
- **Also valid:** the Step 10 requests still match the current content; prefer the Step 11 set.

## 11. Backup and restore

### Final backup (outside the repository; nothing uploaded)

`C:\Users\vighn\revforge-backups\revforge-forward-20261102T195212Z\`

| | |
|---|---|
| Archive | `revforge-forward-20261102T195212Z.tgz`, sha256 `5817694a8044960a895706b9a4b2c7965f800b987cbebf798c8a55188a9403ec`, 2,418,973 bytes |
| Contents | 636 files (6,728,245 bytes); tree sha256 `7c8a4d4346bf3a2d16ecb8b6782c76fd9b104d0f992464254f134e77789cfc7d` |
| Recorded baseline | commit `b092004`, Node v22.12.0, the lockfile hash, BMad pin 6.12.4 |
| Included | runtime and verification code, contracts, tests, the 7 forward agents, the 14 forward skills, config templates, lockfile, BMad integration metadata, docs and the pilot sources |
| Excluded (with reasons) | workflow runs, `dist`, `node_modules`, report exports, the provisioned executor, original COBOL, credential files, pilot output, the transient test workspace. No file was excluded as a secret. |
| Archive verification | 636 entries, relative, no traversal, no links |

The intermediate backups (`…T174142Z`, `…T175416Z`, `…T191324Z`, `…T193254Z`) are superseded. They were made while the defects below were being diagnosed.

### Restore into a disposable git checkout at `b092004`

Results are in `reports/step-11/recovery/`. The temporary directories were deleted afterwards.

| Check | Code only | With separately held local assets |
|---|---|---|
| Archive hash, safe entries | ok | ok |
| Git baseline: HEAD = `b092004` | ok | ok |
| 636 files present; every sha256 matches | ok | ok |
| Nothing extra; no excluded path restored | ok | ok |
| No tracked file changed by the restore | ok | ok |
| 7 agents, 14 skills | ok | ok |
| No secrets | ok | ok |
| TypeScript build | ok | ok |
| **Test suite** | **303 passed, 1 failed, 5 skipped** | **309 / 309 passed, 0 skipped** |

The "local assets" are the current workflow runs and the provisioned BMad executor, both copied into the disposable checkout, plus `REVFORGE_COBOL_SOURCE_ROOT` read in place. None of them is part of the archive.

**Recovery verdict:**
- **The implementation is fully recoverable.** All 309 tests pass in a fresh checkout at the recorded commit plus the archive, once the separately held assets are attached.
- **Without those assets**, exactly the tests that need them cannot run:
  - Step 6 #25 fails: `bmad dry-run` needs a plan run in `forward/runs`.
  - Five tests skip:
    - Step 11 tests 2/11, 10/12 and 16 need the real run (and the COBOL source);
    - Step 4.5 real-run integration needs the real run;
    - Step 7 #30 needs the provisioned executor.
- **The assets are not in the archive by design:** workflow runs are sensitive and the executor is reproducible. They must be backed up separately, with permission.

### The Step 10 restore's 3 failures and 5 skips (investigated)

| Earlier result | Cause | Now |
|---|---|---|
| Step 10 backup tests 23/24 and 26/27 failed | `git ls-files` in a bare extract (not a git repository) | pass in the checkout restore |
| Step 6 #25 failed | needs a workflow run (excluded) | passes with local assets |
| Step 1 and Step 3 (×2) skipped | `output/` was absent from a bare extract | run in the checkout restore (tracked `output/`) |
| Step 4.5 real-run test skipped | needs the real run | runs with local assets |
| Step 7 #30 skipped | needs the provisioned executor | runs with local assets |

### Defects found and fixed while verifying recovery

| Defect | Fix |
|---|---|
| **Concurrent backup could capture the transient test workspace.** A backup taken while tests ran could include `forward/tests/.tmp/` (the Step 3 scratch workflow), whose files change during the run. Test 13 inside the restored checkout failed intermittently with "hashes_match: 4 changed: forward/tests/.tmp/runs-s3/…". None of the real backups contained it, because none was taken during a test run. | The path is now excluded, with a regression assertion. |
| **Cleanup could throw on Windows.** Removing the temporary checkout could fail on a briefly locked `.git` file. | The tool retries, and reports a failed cleanup instead of throwing. |
| **Killed test runs were opaque.** | Restore reports now record the signal or error and the failing-test details. |

## 12. G0–G8 (real run, read-only)

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

## 13. Trust store

**TRUST_NOT_CONFIGURED.** No signer exists for any role. No keys were generated, and no signers were invented.

## 14. External AI calls

**None.**
- **Workflow unchanged:** no file in the real workflow changed after the Step 10 report, including the `openai/` and `bmad/` records.
- **No BMad execution:** there are no BMad execution or receipt records.
- **No network:** the pilot and planner import no provider or network module (test 15).

## 15. Approved production architecture

**None.** No F3 dispatch, receipt or approval exists. The preview is non-authoritative.

## 16. Production Java generation

**None.**
- **Generation is unauthorized:** `java_generation_allowed: false` and G4 has not passed.
- The `generate` command is refused.
- **The only Java on disk** is the synthetic pilot output under `forward/pilot/synthetic-rc/out/` (test 16).

## 17. Exact prerequisites for the first real authorized conversion (RTNCDE00)

1. **Trust:** a key custodian provisions the trust store (all roles, one identity per person) and installs it via `REVFORGE_APPROVAL_TRUST_STORE`.
2. **Technical authority:** obtains the real SQLCA member and the DB2 runtime facts, then signs **DR-DB2CONN-002** and **DR-F2-0011-001**.
3. **Business SME:** signs RVW-REQ-RTNCDE00-004 (RP-8d2dd33787), -003 (ESU-0002) and -002 (citation update, exclusion or exception). The operator applies the corrections, re-runs `approval package` and `pilot plan`, and checks that the planning categories match the decisions.
4. **G2:** `approval export-request`; a `requirements_approver` (not the requester) signs; import; G2 PASS; advance to REQUIREMENTS_APPROVED.
5. **G3:** F3 is dispatched through the workflow (the preview may inform it but is not evidence); ADRs cover the open non-blocking decisions (interface contract, code page, TRUNC option, timestamp conversion, NULL aggregates); an `architecture_approver` signs.
6. **G4:** F4 stories (one per VERIFIED component; the PARTIAL portions keep their gap placeholders); a `story_approver` signs.
7. **Generation authorisation:** the project authority sets `java_generation_allowed` and an explicit `java_target_dir`; F5 runs inside that directory only.
8. **G5/G6 evidence:** a Maven (or equivalent) build; independent fixtures (F6). Equivalence additionally needs a trusted COBOL/DB2 reference run, which needs a COBOL compiler and DB2, neither of which is available here.
9. **Optional BMad LIVE:** this additionally needs the Step 9 prerequisites.

**Not started:** Step 12.

## 18–19. Integrity

| Item | Status |
|---|---|
| `output/` | 534 files, all sha256 match the earlier snapshot |
| Original COBOL | all 87 checked source files match their earlier sha256; no file under `references/` modified since Step 10 (372 files counted with `find`, which includes the nested `.git`; the Step 10 figure of 371 used a different count) |
| `.claude/` | the reverse agents and skills (tracked) are unchanged |
| Workflow | audit 254 entries and checkpoint #174 (Step 10), both unchanged by Step 11. `pilot plan` and `approval package` were read-only on the workflow; they wrote exports only. |
