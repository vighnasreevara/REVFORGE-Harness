# STEP-25: Final handover assessment

> **Post-release note (added after release).** STEP-25 was committed and pushed as `e87b1a610a5e10e25bf8836044643e3c4ee27cd3`. Statements below that call the changes *staged* or *not yet committed* describe the state when this assessment was written. Release-time verification is in [§16 Post-Release Verification Addendum](#16-post-release-verification-addendum).

| | |
|---|---|
| Baseline | `d2c34094eaa702110fd34205ae58ac716421ffab` (STEP-24), plus the uncommitted STEP-25 changes |
| Classification | **ENGINEERING_HANDOVER_COMPLETE** (integrity finding corrected byte-exactly; correction staged) · **CONDITIONAL_ENGINEERING_CLOSURE** · **NOT_PRODUCTION_READY** · **LEGACY_EQUIVALENCE_NOT_ESTABLISHED** |
| Handover package | `forward/handover/` (13 documents + `HANDOVER-MANIFEST.json`) |
| Machine evidence | `forward/reports/step-25/` |
| Audit tool | `forward/tools/step25-final.py` (read-only; `snapshot` and `audit` modes) |
| Committed | Nothing yet. All STEP-25 files, including the byte-preservation correction, are staged for review (§15). |

> REVFORGE is **not** production-ready, and **no COBOL-to-Java behavioural equivalence has been established.** The engineering handover is complete; the modernization is not.

---

## 1. Repository integrity

`step-25/repository-integrity.json`: all checks pass.
- `.gitattributes` enforces LF.
- 20 hand-written runtime Java files are tracked, and generated Java is git-ignored.
- No restricted source, generated Java, run records, credentials, class files or dashboard build output is tracked.
- The backup tool's secret scan of tracked files finds nothing.

## 2. Architecture

The architecture is documented in `handover/ARCHITECTURE.md` with eight diagrams, all of which render with Mermaid 11.6 in strict mode in headless Edge:
- end to end;
- reverse agents;
- F1–F7 and gates;
- BMad lifecycle;
- provenance;
- gates;
- dashboard pipeline;
- handover flow.

Every component named there exists in the repository. BMad and OpenAI are shown as not executed.

## 3. Source identity and artifact integrity

`step-25/source-integrity.json`: in environment B, all 11 checks pass after the correction. Before it, 10 passed and 1 failed.

| Check | B: developer tree | A: pure checkout |
|---|---|---|
| Inventoried sources present | 83/83 | not verifiable (restricted) |
| Authorization hashes match | 82/82 | not verifiable |
| File without a recorded authorization hash | `src/maps/INQSET.bms`, disclosed | disclosed |
| Sources unchanged since STEP-22 | 83/83 | not verifiable |
| Reverse artifacts vs STEP-22 hashes | 11/11 | 10/11 before → **11/11** after the correction (fresh clone of the repaired commit) |
| Git blobs vs recorded hashes | 10/11 before → **11/11** (staged) | 11/11 after the correction |
| Reverse artifacts vs run baseline manifest | 11/11 | not verifiable (local run) |
| Generated Java | 145 files, tree `d31fac95…` unchanged | not verifiable (git-ignored) |
| Rule identities | 154, identical in 4 sources | same |
| Statement identities | 1,936 unique, all traced | same |

**Finding, and its correction.** `output/diagram/diagrams_artifact.json` was committed as LF, while its recorded SHA-256 `bde93ef6400a7317…` is of its CRLF bytes. That hash is recorded in STEP-22 and in the run baseline manifest (790,963 bytes), and seven other committed reports bind the same value. A fresh checkout therefore got `7154d49b…`, and G0 against the existing run failed ("stale baseline").

**Exact recovery.** Converting every LF of the committed blob to CRLF reproduces `bde93ef6…` exactly. It is identical to the working copy (26,381 CRLF line endings; no lone CR or LF), and the JSON is structurally identical.

**Correction (staged).**
- One `.gitattributes` line: `output/diagram/diagrams_artifact.json -text`. Normalization stays on for every other file.
- The artifact re-staged with `git add --renormalize`, so its blob holds the exact CRLF bytes. The staged diff, ignoring CR at end of line, is empty.

**Not changed:** no recorded hash, manifest, baseline or other artifact.

**Verified** in throwaway clones whose blob IDs equal the staged ones:

| Check | Result |
|---|---|
| Fresh checkout of the artifact | `bde93ef6…` |
| G0 against the run | **PASS** (control clone: FAIL) |
| STEP-25 audit | 0 failures |
| `npm test` with all local assets attached | **418/418** |

## 4. Implementation coverage

`step-25/coverage.json` recounts from the STEP-22 detail records. All 38 baseline values match; none was reclassified.

| Area | Result |
|---|---|
| Programs | 42: 41 with Java; 2 COMPLETE (PORTREAD, PROGNAME; harness criteria); 39 PARTIAL; 1 MISSING (POSUPDT) |
| Business rules | 154: 67 verified by source-derived tests; 15 to a gap; 40 unreachable; 32 blocked; 0 COBOL-equivalent |
| Paragraphs | 402: 390 mapped, 95 test-executed |
| Statements | 1,936: 1,337 mapped, 599 at gaps, 414 test-executed |
| PERFORM / branches / loops | 397 of 524 / 190 of 254 / 26 of 32 |
| Fields / records / level-88 | 966 of 1,009 / 196 of 231 / 257 of 259 value-tested |
| Copybooks | 25; 19 used and complete; 6 not used |
| Diagrams | 65; 60 with a Java counterpart; 5 without |
| JCL | 15; 3 end-to-end tested; 11 blocked at a gap step; 1 IDCAMS utility not converted |

Implementation coverage is not behavioural equivalence.

## 5. Master gap register

`step-25/gap-register-validation.json`: 15/15 pass.
- **Records:** 569, all OPEN, with no resolution evidence: 391 forward, 174 reverse, 4 verification. IDs MGR-0001–0569 each appear exactly once.
- **Reverse gaps:** all 217 historical reverse gaps have a disposition.
- **Every record** has a root-cause group, separate severity and priority fields, an owner role (28 `OWNER_REVIEW_REQUIRED`), closure criteria and a verification method.
- **Groups:** 23, each record in exactly one.
- **Dependency graph:** 705 nodes and 877 edges (794 evidenced, 38 by text, 45 hypothetical); acyclic.
- **Roadmap:** 5 phases with 570 memberships for 569 unique records.

## 6. BMad governance

`step-25/bmad-governance.json`: 10/10 pass. Status: **BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED**.
- **Configuration:** `bmad-method@6.12.4` is pinned; 6 bindings are valid; governance is mandatory; live execution is not requested; Java generation is not authorized.
- **Execution:** 0 authorized, 0 live, 0 verified receipts. The local BMad records are 3 BEL, 4 BGR and 13 BPF, with **no receipt of any mode**.
- **PORTREAD:** BGR-0004 is `BMAD_BLOCKED` at PRD, and the 5 later stages were not attempted. F2 is accepted; F6 is missing.
- **Disclosure request ADA-8154d6398d4d:** unsigned. At the evaluation time (2026-11-05 05:40 UTC) it had **not yet expired**; it expires 2026-11-06T20:45:24Z. It was not signed, renewed, extended or used. Unsigned, it authorizes nothing; after expiry it must be re-prepared.
- **Eight prerequisites remain:** trust store, signed disclosure, G2 for the exact scope, F6 receipt, isolated runner, provider egress, live enablement, generation authorization.

## 7. Dashboard

`step-25/dashboard-validation.json` and the regression:
- typecheck clean; 40/40 tests; build succeeds; 20/20 smoke checks (headless Edge, production CSP);
- 137 evidence files, none missing or modified;
- 18/18 primary metrics, 25/25 coverage, 114/114 cross-checks;
- the STEP-24 evidence, regenerated into a scratch folder, is identical to the committed files apart from the baseline line.

STEP-25 added `REVFORGE_REPORT_OUT` to `scripts/evidence-report.ts` so this check never overwrites the historical evidence.

## 8. Testing

Results are in `step-25/regression-runs.jsonl`, run sequentially in environment B.

| Check | Result |
|---|---|
| Build | pass |
| `doctor` | 24 OK, 0 FAIL |
| Agent/skill sync | 21 in sync |
| `bmad doctor` | OK |
| `bmad governance` | exit 3 (expected) |
| `pilot integrate` | 41 programs and 15 jobs; runtime 34/34; program tests 1,388 pass, 532 blocked as expected, 0 fail; scenarios 69 / 141 / 0; integration 3 / 36 / 0 |
| `RuntimeTests` | 34/34 |
| `pilot validate` | **41/42** (POSUPDT) |
| `pilot readiness` | **6/42** |
| `npm test` | **418/418** (412 existing + 6 new) after a test correction |

**The one failure.**
- **What:** the first full run gave 417/418.
- **Cause:** a defect in a new STEP-25 test. It assumed every tracked dashboard file is listed by commit blob, but `evidence-report.ts` is tracked and modified, so the backup correctly archives it.
- **Fix:** the assertion was changed to "listed by blob or archived", the STEP-10 definition, and was tightened to require that archived dashboard files are modified or new.
- **Result:** 6/6 on its own, then 418/418. The failing run is kept in the log.

**Local state change**, from snapshots before and after:
- The 145 generated program sources are unchanged.
- `pilot integrate` rebuilt the derived integration copy, appended one event to `workflow/audit.jsonl` and rewrote `workflow/state.json`.
- No Java was regenerated.

## 9. Backup-policy correction

**Problem (measured):** `tools/backup.js` would archive 25,322 reproducible dashboard files, about 285 MB of a 290 MB backup:
- `node_modules`: 25,000 files;
- `dist`: 184;
- `public/evidence`: 138.

**Change:** the smallest exclusion that solves it.
- Two new rules for `forward/dashboard/(node_modules|dist|coverage)/` and `forward/dashboard/public/evidence/` only.
- An `exclusion_policy: 2` field in new inventories.
- `restore-test` checks an archive only against the rules of the policy it was created under, so policy-1 archives still verify.
- Dashboard source, configuration, lockfile, tests, scripts and README are untouched; a test proves that 13 source-like paths are not excluded.

**Result:** a backup is now 364 files (4.2 MB).

**Tests:** `tests/step25.test.ts` adds 6 tests. They cover:
- exclusion precision;
- recoverability of every tracked dashboard file;
- secret scanning;
- unchanged policy-1 rules;
- a policy-1 archive containing dashboard dependencies verifying under policy 1 and being flagged under policy 2;
- a real backup with restore and committed-blob tamper detection.

The STEP-10 backup tests and git-policy tests still pass. `docs/PROJECT-RECOVERY-OPERATIONS.md` is updated.

**Not changed:** `tools/recovery-manifest.js`, a hash-only tool with no tests that writes into the historical `reports/step-9/`. It is documented in KNOWN-LIMITATIONS.md.

## 10. Clean-clone reproducibility

`step-25/clean-clone-runs.jsonl`: environment A, a clone of `d2c3409` at `C:/rfv25` with the STEP-25 candidate files overlaid, and no runs, generated Java, COBOL source or dependencies.

| Check | Result |
|---|---|
| Forward `npm ci`, build | pass |
| `doctor` | 0 FAIL, 1 expected WARN: no COBOL source |
| Sync | 21/21 |
| Hand-written runtime | `javac -Xlint:all -Werror` passes; `RuntimeTests` 34/34 |
| Dashboard | `npm ci`, build, 40/40, 20/20 |
| Backup and git-policy tests | 10/10 |
| STEP-25 audit | before the correction: 71 pass, 7 not verifiable, 2 fail (§3 finding); repaired fresh clone: 79 pass, 0 fail, 1 not verifiable |

Dependencies came from the npm registry or the local npm cache, so offline reproducibility was not demonstrated. Environment C (authorized infrastructure) does not exist yet.

## 11. Handover completeness

`forward/handover/` contains:
- PROJECT-OVERVIEW, ARCHITECTURE;
- REVERSE-ENGINEERING, FORWARD-ENGINEERING, BMAD-GOVERNANCE, SOURCE-TRACEABILITY;
- TESTING-AND-VERIFICATION, GAP-AND-REMEDIATION-SUMMARY;
- DASHBOARD-OPERATIONS, INSTALLATION-AND-RUNBOOK;
- SECURITY-AND-AUTHORIZATION, KNOWN-LIMITATIONS, FINAL-HANDOVER-CHECKLIST;
- `HANDOVER-MANIFEST.json`: version, baseline commit, and SHA-256 and last commit of every referenced report, evidence file and document; source provenance; validation counts; outstanding dependencies.

The documents reference the canonical STEP-22 and STEP-23 files instead of copying them.

## 12. Quality gates

All 15 gates pass, as recorded in `step-25/quality-gates-and-closure.json`. Gate 2 records the §3 finding and its correction; no ID is affected.

## 13. Outstanding external requirements

These need people or infrastructure, not engineering:
- the missing source and corrected source (phase A, 400 memberships);
- 108 business decisions;
- DB2, CICS, platform services and a legacy runtime (phase B);
- the BMad prerequisites (phase C);
- F6 independent testing and legacy-equivalence evidence (phase D);
- named owners;
- production replacement criteria;
- CI;
- review and commit of the staged changes.

## 14. STEP-25 changes

| File | Change |
|---|---|
| `.gitattributes` | one `-text` exception for `output/diagram/diagrams_artifact.json` |
| `output/diagram/diagrams_artifact.json` | blob re-staged with its recorded CRLF bytes; content unchanged |
| `forward/tools/backup.js` | exclusion policy 2 (dashboard reproducible output), policy-aware restore check, exports |
| `forward/tests/step25.test.ts` | new: 6 backup-policy tests |
| `forward/docs/PROJECT-RECOVERY-OPERATIONS.md` | exclusion list updated |
| `forward/dashboard/scripts/evidence-report.ts` | optional `REVFORGE_REPORT_OUT` output folder |
| `forward/tools/step25-final.py` | new: read-only audit |
| `forward/handover/*` | new: 13 documents and the manifest |
| `forward/reports/step-25/*` | new: audit and regression evidence |
| `forward/reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md` | new: this report |

No COBOL source, generated Java, Java business logic, rule or gap identity, approval gate, BMad configuration, STEP-22 to STEP-24 evidence or run record was edited by hand. The reverse artifact's content is unchanged: only its stored line endings now match its recorded hash. The only run-record change is the one `pilot integrate` makes by design.

## 15. Readiness for commit

Every file in §14 is staged by explicit path, and nothing else is staged. Two things to know before committing:
- **In the developer tree, until the commit:** the staged change under `output/` makes doctor report `[WARN] reverse_harness_untouched`, and makes 4 protection tests fail (414/418). This is by design. With the correction committed, the same suite passes 418/418 (§3).
- **Excluded from the commit:** `forward/dashboard/node_modules`, `dist` and `public/evidence`; run records, generated Java, `references/`, `OpenWiki/` and local settings.

The full record is in `step-25/regression-runs.jsonl` (`repair:` entries) and `step-25/clean-clone-runs.jsonl`.

---

## 16. Post-Release Verification Addendum

*Added after the release. It records verification made against the committed state and does not change any statement above, which reflects the state at assessment time.*

| | |
|---|---|
| Commit | `e87b1a610a5e10e25bf8836044643e3c4ee27cd3`, "docs: finalize STEP-25 engineering handover and integrity repair", by Vighnasree Vara |
| Contents | the 34 files of §14; every committed blob identical to the pre-commit staged record |
| Push | normal fast-forward `d2c3409..e87b1a6` to `origin/main` (1 ahead, 0 behind; no force) |
| Remote | `origin/main` = `e87b1a6`; the handover package (14 files), this assessment and the 12 STEP-25 evidence files are present on GitHub |

**Source-integrity repair, as present in the remote:**
- **The committed artifact:** `output/diagram/diagrams_artifact.json` is 790,963 bytes with CRLF line endings, and its SHA-256 is `bde93ef6400a731726e1c214a363d708ac7bcaeb26f53be9047f37c77d09660e`, matching the recorded hash.
- **The `.gitattributes` exception:** present (`output/diagram/diagrams_artifact.json -text`).
- **A fresh clone from GitHub** checks out those exact bytes (`i/crlf w/crlf attr/-text`). In that checkout, 11/11 reverse artifacts match their recorded hashes and all 54 handover-manifest hashes match.

**Regression against the committed state** (developer environment, sequential):

| Check | Result |
|---|---|
| G0 baseline integrity (fresh clone of `e87b1a6`, copy of the run attached) | **PASS**: "11 inputs and per-program file sets match the recorded SHA-256 values" |
| STEP-25 audit | 80/80 in the developer tree; fresh clone 79 pass, 0 fail, 1 not verifiable (generated Java not attached) |
| Forward `npm test` (clean tree) | **418/418** |
| Java `RuntimeTests` | 34/34 |
| Backup and restore tests | 22/22 |
| `doctor` / `sync-agents --check` / `bmad doctor` | 24 OK, 0 WARN, 0 FAIL / 21 in sync / OK |
| `bmad governance --scope programs:PORTREAD` | `BMAD_BLOCKED`, exit 3 (expected) |
| Dashboard | typecheck clean; **40/40** tests; build OK; **20/20** browser smoke checks; 18/18, 25/25 and 114/114 metrics |
| Working tree at the end of release verification | clean; local `HEAD` = `origin/main` |

**Two interruptions during release verification, both resolved before the push:**
- **Backup tests, before the commit: 20/22.** The STEP-10 backup tool treats staged changes as committed, so its recovery check failed while files were staged. Once committed, they pass 22/22.
- **Forward tests, after the commit: one run of 417/418.** A validation step regenerated eight STEP-25 evidence files in place, changing only commit- and time-dependent fields. Those files were restored to their committed versions, and the clean re-run passed 418/418.

**Classifications unchanged:** ENGINEERING_HANDOVER_COMPLETE · CONDITIONAL_ENGINEERING_CLOSURE · NOT_PRODUCTION_READY · LEGACY_EQUIVALENCE_NOT_ESTABLISHED. BMad: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED. All 569 gap records remain OPEN.
