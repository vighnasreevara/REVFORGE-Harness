# STEP 10 report: evidence adjudication, RTNCDE00 approval readiness and recoverable project protection

Real run: `FWD-20261031T172520Z-66b3` (baseline `352b97f0…4d24a068`), 2026-11-02.

| Layer | RTNCDE00 status |
|---|---|
| Source evidence found | REQ-001, REQ-003, RT-001 |
| Deterministically verified | REQ-001, REQ-003, RT-001..003 |
| Accepted by an authorized reviewer | **none** |
| Human decision resolved | **none** |
| Requirement approved | **none** |
| Scope READY | **no** (6 blocking findings) |
| G2 PASS | **no** |

## 1. Git

- **Branch / commit:** `main` / `b092004` (unchanged).
- **Tracked files:** none modified (`git diff` is empty).
- **Untracked (implementation):** `forward/`, `.claude/agents/fe-*` (7), `.claude/skills/fe-*` (14).
- **Ignored:**
  - `references/` (original COBOL);
  - `forward/runs/`, `forward/node_modules/`;
  - `forward/integrations/bmad/staging` and the provisioned executor;
  - `.mcp.json` (untouched).
- **Commits:** none; nothing pushed.

## 2. Files

**Created:**

| Area | Files |
|---|---|
| Runtime | `runtime/src/context/adjudication.ts`, `runtime/src/operations/package.ts`, `runtime/src/operations/package-render.ts` |
| Contracts | `contracts/verification/evidence-adjudication`, `contracts/verification/evidence-adjudication-report` |
| Tools | `tools/backup.js` |
| Tests | `tests/step10.test.ts`, `tests/helpers/contextfixture.ts` |
| Docs | `docs/EVIDENCE-ADJUDICATION-OPERATIONS.md`, `docs/PROJECT-RECOVERY-OPERATIONS.md` |
| Reports | `reports/STEP-10-REPORT.md`, `reports/step-10/*` (adjudication, review package JSON and Markdown, fresh resolution requests, SQLCA fact sheets, backup and restore results) |

**Modified:**

| File | Change |
|---|---|
| `runtime/src/approval/snapshot.ts` | Applies the latest `EVIDENCE_INVALIDATED` adjudication fail-closed, even when stale |
| `runtime/src/context/context.ts` | A superseded supplement version is never current |
| `verification/src/context.ts` | A multi-character value inside a longer statement literal counts; single characters still need a whole literal |
| `runtime/src/commands/context.ts`, `runtime/src/commands/operations.ts` | `verification context adjudicate`, `decisions facts`, `approval package` |

## 3. Build and tests

**Build:** OK.

**Tests: 294 passed, 0 failed, 0 skipped** (the 278 existing plus 16 new test cases covering the 30 items).

During development, the first full run failed the Step 1 guard (runtime source must name no inventory member). A message in the new fact-sheet code named the SQLCA copybook. The **code** was made generic; the test was not changed.

No earlier test was modified.

**Final full run:** after all fixes, 294 / 294 pass. That includes the Step 1 guard and the new Step 10 regression assertion that no implementation source is excluded from the backup.

**Recovery manifest** regenerated (`reports/step-9/recovery-manifest.json`): 314 files, tree `7f4fa661…`, 0 warnings.

## 4. The 17 findings newly supported in Step 9

All 17 were re-followed from the original COBOL (`EAR` records, versioned and sealed):

| Classification | Findings |
|---|---|
| SOURCE_CHAIN_VERIFIED (16) | REQ-BCHCTL00-001, REQ-RTNCDE00-003, REQ-DB2CMT-001, REQ-DB2CONN-001, REQ-DB2ERR-001, REQ-DB2ERR-002, REQ-DB2ERR-003, REQ-DB2STAT-001, REQ-CURSMGR-001, REQ-CURSMGR-002, REQ-DB2RECV-002, REQ-DB2RECV-006, REQ-ERRHNDL-002, REQ-INQONLN-003, REQ-PORTUPDT-002, RT-BCHCTL00-004 |
| SOURCE_CHAIN_AMBIGUOUS (1) | REQ-DB2RECV-001: a duplicate symbol |

- **Partial, contradicted, unavailable:** 0.
- **One more finding.** After the containment fix in §5, **REQ-DB2CONN-003** is also SOURCE_CHAIN_VERIFIED, making 18 newly supported.
- **Human acceptance.** All of them still need human acceptance: verified evidence is not acceptance.

## 5. The seven questionable earlier verifications

The earlier checker was reproduced exactly; each value it matched was classified by how it matched.

| Finding | Earlier match | Result | Diagnosis |
|---|---|---|---|
| REQ-RTNCDE00-002 | `'S'` only inside the name `RC-HIGHEST-CODE` | **EVIDENCE_INVALIDATED** | incorrect method; unsupported citation; the claim is supported by other, uncited statements (dispatch on RC-SET-CODE) |
| REQ-PORTUPDT-003 | `'00'` only inside a data name | **EVIDENCE_INVALIDATED** | same: alternative statement STMT-000012 |
| RT-PORTADD-001 | `'A'` only inside a data name | **EVIDENCE_INVALIDATED** | same: alternative statement STMT-000011 |
| RT-RCVPRC00-002 | `'S'` and `'A'` only inside data names | **EVIDENCE_INVALIDATED** | same: alternative statements STMT-000007 and STMT-000018 |
| REQ-PORTDEL-002 | real literals (`'DELETE'`, message text) | **EARLIER_VERIFICATION_CONFIRMED** | the earlier result is defensible |
| REQ-PORTDEL-004 | real literals (parts of DISPLAY messages) | **EARLIER_VERIFICATION_CONFIRMED** | defensible |
| RT-RCVPRC00-001 | real literals `'P'`, `'S'`, `'A'` | **EARLIER_VERIFICATION_CONFIRMED** | defensible |

**The three defensible ones.** These were wrongly flagged by the Step 9 verifier itself: it required exact equality for values quoted from longer DISPLAY literals. That is now fixed generically (a multi-character value contained in a statement literal counts; single characters still need a whole literal).

**Effect on G2.**
- The four invalidated verifications no longer count. The G2 snapshot treats them as unverified while their adjudication is current.
- If source or content changes, they stay unverified until a fresh adjudication.
- **Result:** application-wide blocking findings went from 395 to **398**. No decision was resolved.

## 6. RTNCDE00 requirements (current)

| Item | G2 outcome | Evidence |
|---|---|---|
| REQ-RTNCDE00-001 | REQUIRES_SME_DECISION | Deterministically verified (5 request codes via the RC-* conditions of RTNCODE). Blocked by DR-DB2CONN-002 (SQLCA/SQLCODE semantics); no SQLCA layout or DB2 behaviour is assumed. |
| REQ-RTNCDE00-002 | **REQUIRES_EVIDENCE** (was VERIFIED) | Earlier verification invalidated (`EAR-0002`); its cited statement (lines 64–66) does not support `('S')`. New review decision **RVW-REQ-RTNCDE00-002**. |
| REQ-RTNCDE00-003 | REQUIRES_EVIDENCE | `ESU-0002` revalidated: current, CONTEXT_SUPPORTED, SOURCE_CHAIN_VERIFIED (`EAR-0003`). S/W/E/F come from RTNCODE.cpy lines 17–20, which the cited EVALUATE SETs; permanent IDs FLD-000013..16; hashes current. Open until a `business_sme` signs `resolved_no_change` selecting ESU-0002. |
| REQ-RTNCDE00-004 | CONTRADICTED | CITATION_MISMATCH (`ESU-0003`, not acceptable). RP-8d2dd33787 (121 → 122) re-verified today; it supports the full claim after correction. Not applied: needs a signed `business_sme` resolution naming RP-8d2dd33787 for the current requirement hash `0ac2f6b6…`. |
| RT-RTNCDE00-001..003 | VERIFIED | Deterministically supported. |

## 7–8. Supplements and citation proposals

**Supplements** (none accepted by a reviewer):
- `ESU-0002`: eligible, pending signed acceptance;
- `ESU-0001`: advisory, superseded in effect by `EAR-0002`;
- `ESU-0003`: citation mismatch, not acceptable.

**Citation proposal:** `RP-8d2dd33787` is re-verified and pending authorization.

## 9. SQLCA decisions (independently verified)

**What the source shows:**
- `src/copybook/db2/SQLCA.cpy` (sha256 `03e8f64a…`) line 6 is `EXEC SQL INCLUDE SQLCA END-EXEC.` (it includes itself).
- It declares only `01 SQL-STATUS-CODES` with **7** VALUE clauses (SQLSTATE strings).
- **14** programs include it.

**What is missing:** `SQLCODE` (used by 14 programs) and `SQLERRMC` (used by 2) are declared nowhere in the repository. A DB2 precompiler or runtime would normally supply them, which the repository cannot confirm.

| Decision | Kind | Scope | Outcomes |
|---|---|---|---|
| **DR-DB2CONN-002** | technical | 5 program units (DB2CMT, DB2CONN, HISTLD00, RTNANA00, RTNCDE00), 9 requirements, **5** program scopes | `resolved_no_change`, `excluded_from_scope`, `resolved_requires_update`; signer `technical_authority` |
| **DR-F2-0011-001** | data layout | the SQLCA member, **15** program scopes (the 14 direct includers plus INQONLN, which reaches SQLCA through a called program) | `resolved_no_change`, `excluded_from_scope`; signer `technical_authority` |

The A–E separation (source, external environment, unsupported assumptions, missing artifacts, what must be decided) is in `reports/step-10/facts-*.json` and the review package. **No technical resolution was chosen.**

## 10–12. Blocking findings, digest, outstanding decisions

**RTNCDE00:** NOT_READY with **6** blocking findings:
- REQ-RTNCDE00-004 CONTRADICTED;
- REQ-RTNCDE00-002 REQUIRES_EVIDENCE;
- REQ-RTNCDE00-003 REQUIRES_EVIDENCE;
- DR-DB2CONN-002 and DR-F2-0011-001 REQUIRES_SME_DECISION;
- REQ-RTNCDE00-001 REQUIRES_SME_DECISION.

**Scope digest:** `bd0fcf24e958fffd47175318ffdc6805b60b97194b304809915eebea4201113a`. It was `dc7da3c0…` at Step 9; it changed because of the REQ-002 invalidation.

**Outstanding human decisions (5):**
- DR-DB2CONN-002, DR-F2-0011-001 (`technical_authority`);
- RVW-REQ-RTNCDE00-002, RVW-REQ-RTNCDE00-003 (`business_sme`, or `exception_approver` for an exception);
- RVW-REQ-RTNCDE00-004 (`business_sme`).

**Requests:**
- **Fresh:** DRQ-57f29d19d1f3, DRQ-021673fc0ffe, DRQ-d97a957c0425, DRQ-51fb7a227533, DRQ-01b26705489e (`reports/step-10/resolution-requests/`).
- **Stale, flagged and never to be reused:** the Step 5.5 and Step 8 requests for RVW-REQ-RTNCDE00-003. The decision content changed.

## 13–14. Trust and G2

**Trust:** **TRUST_NOT_CONFIGURED.** No signer exists for any role.

**G2:**
- RTNCDE00 NOT_READY;
- application NOT_READY (398 blocking);
- G2 **UNVERIFIED** (no trust anchor, no approval);
- G3 and G4 BLOCKED.

The human signing runbook is in `docs/EVIDENCE-ADJUDICATION-OPERATIONS.md`, `docs/HUMAN-DECISION-OPERATIONS.md` and the review package (§22 below).

## 15–16. Backup and restore

**Backup** (outside the repository; nothing uploaded): `C:\Users\vighn\revforge-backups\revforge-forward-20261102T161730Z\`
- **Archive:** `revforge-forward-20261102T161730Z.tgz`, sha256 `4729066cc8c02b0ac05d8c88e602631327d8f92003b3f688ad7ac296e3f094dc`, 2,375,049 bytes.
- **Contents:** 620 files (6,575,379 bytes); tree sha256 `dd60c7e527c27e64883051861dfc5a61dd63aceb22bb70143ae763658e970b0b`.
- **Recorded versions:** commit `b092004`, Node v22.12.0, lockfile sha256 `81f6e85e…`, BMad pin 6.12.4.
- **Superseded first backup.** An earlier backup (`…T160504Z`, 618 files) is incomplete and should not be relied on. Its restore test showed that the backup tool had excluded `tests/step10.test.ts`, because the file contained a synthetic database-password string used to test the secret detector.
  - **Fix:** the test now assembles that string at runtime.
  - **Regression check:** a new assertion fails if any implementation source is ever excluded as a "secret".
  - The detector itself was not weakened.
- **Agents and skills:** 7 forward agents, 14 forward skills.
- **Alongside the archive:** `inventory.json`, `SHA256SUMS`, `RESTORE.md`.
- **Excluded (listed with reasons, no content):**
  - workflow runs;
  - `node_modules`, `dist`;
  - report exports that may quote COBOL;
  - the provisioned executor;
  - original COBOL;
  - credential files;
  - secret-shaped content.

  Only the documented synthetic test key prefix `sk-test-REVFORGE-` is allowlisted.
- **Archive verification:** 620 entries, all relative, no traversal, no links.

**Restore test** (isolated temp directory, never the repository; removed afterwards): `reports/step-10/restore-test.json`

| Check | Result |
|---|---|
| archive hash, safe entries | ok |
| 620 files present, every sha256 matches | ok |
| nothing extra; no excluded path restored | ok |
| 7 agents, 14 skills | ok |
| no secret patterns | ok |
| TypeScript build of the restored sources | **ok** |
| test suite in the restored tree | **286 / 294 passed, 3 failed, 5 skipped** |

**The 3 failures and 5 skips are all environmental**; each was diagnosed by re-running it in the restored tree:
- Two are Step 10 backup tests. `git ls-files` fails because a bare extract is not a git checkout; the full restore procedure checks out the recorded commit first.
- One is Step 6 test 25. `bmad dry-run` needs an existing workflow run, and runs are deliberately excluded as sensitive. It returned "no plan run found" (exit 1, not the expected 2).
- The 5 skips need the original COBOL or reverse outputs, which are not in a code-only backup.

**Overall:** the code, agents, skills, contracts and docs are fully recoverable and build cleanly. Full behavioural recovery additionally needs:
- the git checkout at `b092004`;
- the separately held workflow runs;
- the COBOL source and reverse outputs.

## 17–18. Isolation and Claude/BMad

- **Isolation:** **ISOLATION_TESTED** (Step 9 offline suite, unchanged and not weakened).
- **Executor:** Node.js and Claude Code are not inside the boundary, and there is no provider connectivity.
- **Claude disclosure authorization:** none.
- **BMad preflight:** **REFUSED**, `EXECUTION_UNSUPPORTED` (sealed `BPF-0003`); nothing launched.
- **LIVE:** unauthorized.

## 19–21. Integrity

| Item | Status |
|---|---|
| Workflow | REQUIREMENTS_DRAFTED; checkpoint #173 verified; resume OK |
| Audit | 221 → 254 entries; chain verified |
| New records | 32: 25 adjudications, `BPF-0003`, G2/G3/G4 evaluations and gate results. All 257 prior records unchanged. |
| `output/` | 534 files unchanged |
| Original COBOL | 371 files unchanged |
| `.claude/` | unchanged |
| AI calls | **none**: OpenAI records unchanged (8), no BMad execution or receipt records |
| Java | **none** |

## 22. Exact remaining actions before F3 can begin

1. **Key custodian** provisions the trust store (all roles, one identity per person). Then `trust doctor --file` and `trust verify-signature`, and install via `REVFORGE_APPROVAL_TRUST_STORE`.
2. **Technical authority** signs DR-DB2CONN-002 and DR-F2-0011-001 (shared with 5 and 15 scopes).
3. **Business SME** signs:
   - RVW-REQ-RTNCDE00-003, accepting ESU-0002 or otherwise;
   - RVW-REQ-RTNCDE00-004, selecting RP-8d2dd33787; then the operator applies the correction with `workflow correct … --kind citation_line`;
   - RVW-REQ-RTNCDE00-002: update the citation to the supporting dispatch statement, exclude, or except.
4. **REQ-RTNCDE00-001** stops blocking once DR-DB2CONN-002 is resolved (and anything else its review reports).
5. **Operator** re-runs `approval package` after every import or correction, and exports fresh requests when digests change.
6. **Once READY:** `approval export-request`; a `requirements_approver` (not the requester) signs; `approval verify` / `approval import`; `workflow gate --gate G2` reaches PASS; `workflow advance --to REQUIREMENTS_APPROVED`.

**Then F3** can be dispatched through the forward workflow. BMad LIVE additionally needs the Step 9 prerequisites (runner inside the boundary, verified provider egress, signed Claude disclosure authorization, LIVE requested, passing preflight).

Step 11 was not started.
