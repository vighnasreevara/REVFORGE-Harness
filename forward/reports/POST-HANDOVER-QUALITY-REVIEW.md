# Post-handover quality review

| | |
|---|---|
| Baseline | `e87b1a610a5e10e25bf8836044643e3c4ee27cd3` (STEP-25 release), clean working tree |
| Scope | four findings from an independent repository review; focused fixes only |
| Status | **COMPLETE**: all four findings corrected and validated locally. GitHub Actions has not run yet; it runs only after the change is pushed. |
| Committed | nothing (for review) |

## 1. Findings

| # | Finding | Confirmed on the baseline |
|---|---|---|
| 1 | The dashboard accepts data from evidence files whose SHA-256 does not match the manifest | yes |
| 2 | The root README describes mainly reverse engineering | yes |
| 3 | The final handover documents say STEP-25 is still staged and not committed | yes |
| 4 | There are no GitHub Actions workflows | yes |

## 2. Root causes

1. **`loader.ts` / `loadOne()`** computed the digest, recorded a mismatch as an issue, and then **still parsed the bytes and returned them with status `loaded`**. A missing Web Crypto (`not-checked`) or a missing recorded hash was not treated as a failure at all. **`loadText()`** returned Mermaid text whatever its integrity, and `MermaidView` rendered it with only a badge.
2. **The README** predates the forward harness and was never rewritten for it.
3. **The STEP-25 assessment and checklist** were written before the commit, and nothing recorded the later release verification.
4. **CI** was never set up. The test suite mixes checks that need local-only assets (restricted source, run records, BMad staging) with checks that don't, so a naïve `npm test` in CI would fail predictably.

## 3. Code changes

| File | Change |
|---|---|
| `forward/dashboard/src/evidence/loader.ts` | `verifyBytes()` returns `verified` only when a well-formed recorded SHA-256 exists, Web Crypto is available and the digests match. `loadOne()` parses only verified bytes; everything else is `rejected` with a reason. `loadText()` returns text only for a manifest-listed, verified path, and otherwise returns `unauthorized` / `missing` / `rejected` with no text. |
| `forward/dashboard/src/evidence/types.ts` | dataset status `rejected`; integrity `no-expected-hash` |
| `forward/dashboard/src/components/MermaidView.tsx` | renders or shows source only for verified text; otherwise an alert ("Diagram unavailable: …"). It clears any previous render. Mermaid stays in strict mode. |
| `forward/dashboard/src/pages/EvidencePage.tsx` | shows "rejected (not loaded)", the reason, and an integrity label (mismatch / no recorded hash / unverifiable) |
| `forward/dashboard/src/pages/Comparison.tsx` | unavailable whenever the final summary is not loaded (before, a derived row could keep the page partly populated) |
| `forward/dashboard/scripts/smoke.mjs` | opt-in `REVFORGE_SMOKE_NO_SANDBOX=1` for ephemeral CI runners |
| `forward/dashboard/README.md` | fail-closed behaviour, and what the hash check proves and does not prove |
| `README.md` | rewritten for the whole project. Reverse agents, skills, the permanent-ID principles, results, layout, license and attribution are kept. |
| `forward/reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md` | a post-release note at the top and §16 Post-Release Verification Addendum. The original text is unchanged. |
| `forward/handover/FINAL-HANDOVER-CHECKLIST.md` | current status for items 6, 16 and 17 (assessment-time state kept in italics); a post-release addendum |
| `forward/handover/HANDOVER-MANIFEST.json` | regenerated with the new `manifest` mode: exactly the two edited documents changed hash |
| `forward/tools/step25-final.py` | modes `manifest` (rewrites only the manifest) and `check [--summary F]` (writes nothing; exit 1 on any FAIL; Markdown summary that lists not-run checks) |
| `.github/workflows/revforge-ci.yml` | new: three jobs (§6) |

No change to COBOL source, generated Java, Java logic, rule or gap identities, BMad configuration, approval gates, or the STEP-22 to STEP-25 machine evidence.

## 4. Evidence-integrity guarantees (dashboard)

- A file is loaded into the model **only if** all of these hold:
  - the manifest lists it with a SHA-256;
  - Web Crypto is available;
  - the bytes match;
  - and it parses.
- Missing, altered, hash-less or unverifiable files are **rejected**, and the affected sections show *evidence unavailable*. Nothing is replaced by zero, an empty list or a sample.
- Mermaid sources are rendered only for manifest-listed paths, after the same verification.
- **Trust limit (documented):** the manifest is generated locally from the Git checkout. The browser check proves the served copies are consistent with that manifest. It does not authenticate the manifest, the repository or a deployment.

## 5. Tests added

`forward/dashboard/tests/missing.test.tsx` now has 16 tests (previously 5). The dashboard suite is **51** (previously 40).

| Requested case | Test |
|---|---|
| 1 missing required JSON is unavailable | `1. a missing required dataset…` (+ the gap-register page state) |
| 2 altered JSON with valid syntax is rejected | `2. altered content with valid syntax is rejected before parsing…` |
| 3 modified gap register cannot populate the dashboard | `3.` (model `gaps` null; page shows the alert; no altered value rendered) |
| 4 modified program reconciliation | `4.` (program explorer unavailable, no table) |
| 5 modified rule reconciliation | `5.` (rules explorer unavailable) |
| 6 mismatched summary cannot influence totals | `6.` (no ratios or coverage; comparison page unavailable; altered value not shown) |
| 7 altered Mermaid not rendered | `7.` (alert; no `<pre>`, no source button, injected text absent) |
| 8 unauthorized diagram path refused | `8.` (unlisted `.mmd`, `../../.mcp.json`, a JSON report path) |
| 9 invalid JSON unavailable | `9.` (hash recorded for the broken bytes → `invalid`), plus mismatched invalid JSON → `rejected` |
| 10 absent expected SHA-256 rejected | `10.` |
| 11 unavailable Web Crypto fails closed | `11.` (every dataset rejected; every model section null; Mermaid refused) |
| 12 valid evidence still loads | `12.` (all verified; 42 / 154 / 569 / 65) |
| Evidence Validation page shows failures | `the evidence validation page lists every rejected file with its reason` |

**Mutation check.** With the baseline (pre-fix) `loader.ts` temporarily put back, 11 of the 16 tests fail: every tampering, missing-hash, Web Crypto and unauthorized-path case. The 5 that still pass cover missing files, no manifest and valid evidence. With the fixed loader restored byte-for-byte, all 16 pass.

The previous "altered evidence copy" test asserted that the altered total flowed into a cross-check. It was rewritten to assert the stronger fail-closed behaviour: the altered file is rejected, and no cross-check uses it.

## 6. CI checks added (`.github/workflows/revforge-ci.yml`)

**Common to all jobs:**
- triggers: push and pull request to `main`, and manual dispatch;
- `permissions: contents: read`; checkout with `persist-credentials: false`; no secrets used;
- actions pinned to commit SHAs (checkout v4.2.2, setup-node v4.4.0, setup-java v4.7.1, setup-python v5.6.0).

| Job | Commands |
|---|---|
| **Forward (pure checkout)** | `npm ci`; `npm run build`; `doctor`; `sync-agents --check`; 20 test files that pass on a pure checkout; `javac -Xlint:all -Werror` of the 20 hand-written runtime files; `RuntimeTests` must print `SUMMARY\|34\|0\|0` |
| **Dashboard** | `npm ci`; `npm run evidence` (must report missing / uncommitted / modified 0); `typecheck`; `npm test`; metric validation into a temp folder (must report `ALL_METRICS_AGREE`); `build`; smoke test with the runner's preinstalled Chrome |
| **Repository and report integrity** | CRLF artifact: `-text`, SHA-256 `bde93ef6…`, 790,963 bytes. No restricted source, generated Java, run records or credentials tracked. The 13 handover documents, manifest and assessment exist. Every tracked JSON/JSONL parses. `step25-final.py check` (register, graph, coverage, BMad state, provenance) |

**How the forward test set was chosen.** Each test file was run separately in a clean checkout with no local assets:
- **In CI:** git-policy, step1–5, 35, 45, 55, 9–17, 20 and 25. Tests inside them that need the COBOL source or generated Java skip themselves.
- **Not run in CI, by design:** bmad-e2e, step6, step7, step8 and step21. They fail without the git-ignored BMad staging and executor ("staged tarball … is missing").

**Not run in CI:** the full `npm test`; `pilot integrate`, `validate` and `readiness`; source-integrity checks against the restricted source. The job summary lists these as *not run*. Source-dependent audit checks show `NOT RUN (needs the developer environment)`, never PASS. The summary states that CI does not establish COBOL equivalence, live BMad execution or production readiness.

**Two pre-existing non-JSON files**, accepted in CI only with their exact committed SHA-256:
- `forward/reports/step-20/readiness-before/CURSMGR.json`: an empty capture;
- `output/data/data_layouts/_catalogue/_head.json`: a reverse catalogue fragment.

Neither was changed, and neither is a dashboard or audit input.

## 7. Historical evidence preservation

- `git diff` shows no change under:
  - `output/`;
  - `forward/reports/step-22`, `step-23`, `step-24`, `step-25`;
  - `forward/runtime`, `config`, `integrations`, `contracts`, `agents`, `skills`;
  - `.claude/`.
- `step25-final.py check`: 80/80, with:
  - 154 rule IDs unchanged;
  - 569 gap records OPEN (15/15 register checks);
  - 11/11 reverse artifacts at their recorded hashes;
  - the CRLF artifact `bde93ef6…`;
  - 145 generated Java sources unchanged;
  - BMad still blocked.
- The dashboard evidence: 137 files; none missing, uncommitted or modified.
- **Handover manifest:** regenerated with `manifest` mode, so the STEP-25 evidence is untouched. Hash changes:
  - `forward/handover/FINAL-HANDOVER-CHECKLIST.md`: `f9a96b8a3959…` → `4583a4c0a4e3…`;
  - `forward/reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md`: `6a0bb62e2bc3…` → `25665e1243ae…`;
  - `baseline_commit`: `d2c3409` → `e87b1a6`.

  All 54 entries match their files.

## 8. Remaining limitations

- **GitHub-hosted CI has not run yet.** The workflow YAML parses, and every step's commands were run locally (Windows, Git Bash), but the first real run happens after the push. Linux-specific behaviour (paths, Chrome sandbox, Temurin JDK) is verified only by that run.
- **CI covers the pure checkout.** The BMad suites, pilot gates and source-integrity checks need the developer environment.
- **The dashboard hash check proves consistency, not authenticity** (§4).
- **The STEP-10 backup tool** treats *staged* changes as committed, so its recovery check fails while files are staged. This was found during the STEP-25 release and is unchanged here.
- All project-level limitations stand (see `forward/handover/KNOWN-LIMITATIONS.md`):
  - 569 open gaps;
  - BMad live execution blocked;
  - no legacy equivalence;
  - not production-ready.

## 9. Validation results

Run locally and sequentially, after all changes.

| Check | Result |
|---|---|
| Dashboard `npm ci` / typecheck | 400 packages / clean |
| Dashboard `npm test` | **51/51** |
| Dashboard build / smoke | OK / **20/20** |
| Dashboard metric validation | 18/18 primary, 114/114 cross-checks |
| Forward `npm ci` / build | OK / no errors |
| Forward `npm test` (developer environment) | **418/418** |
| Java `RuntimeTests` | 34/34 |
| `doctor` / `sync-agents` / `bmad doctor` | 24 OK, 0 WARN, 0 FAIL / 21 in sync / OK |
| `bmad governance --scope programs:PORTREAD` | `BMAD_BLOCKED`, exit 3 (expected) |
| `step25-final.py check` | 80/80 (developer tree); 73 pass, 0 fail, 7 not run (pure checkout) |
| Pure clean checkout (`C:/rfv31`, no local assets) | forward build; 20 CI test files pass, 5 BMad files fail as expected; dashboard 51/51, smoke 20/20 (with the CI sandbox flag) |
| CI integrity job steps, extracted from the YAML and run locally | all pass |
| Workflow YAML | parses; `contents: read`; every action pinned to a 40-character SHA; all 20 listed test files exist |

**A one-off slow run.** In the clean checkout, one `step10` test took 2,344 s during the per-file sweep. Re-run on its own, the whole file took 53 s and the test 2.4 s, so it is not reproducible and is consistent with the earlier machine-load slowdowns. The CI forward job allows 60 minutes.

## 10. Recommendation

The four corrections are ready for review and commit as one focused quality commit. After pushing, confirm the first GitHub Actions run. If the Linux run differs from the local results, fix the workflow, not the tests or the evidence.

Classifications are unchanged: ENGINEERING_HANDOVER_COMPLETE · CONDITIONAL_ENGINEERING_CLOSURE · NOT_PRODUCTION_READY · LEGACY_EQUIVALENCE_NOT_ESTABLISHED. BMad: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.
