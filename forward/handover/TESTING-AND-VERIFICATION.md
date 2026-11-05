# Testing and verification

These are **recorded results** from STEP-25, at commit `d2c3409` plus the uncommitted STEP-25 changes. They are not a live CI status. Raw records:
- `forward/reports/step-25/regression-runs.jsonl` (environment B, developer tree);
- `forward/reports/step-25/clean-clone-runs.jsonl` (environment A, pure checkout).

## What each kind of test proves

| Kind | Proves | Does not prove |
|---|---|---|
| Structural mapping (STEP-22 reconciliation) | a Java element exists at the same permanent identity | that it behaves the same |
| Source-derived tests (pilot fixtures, program tests, scenarios) | the Java produces the results the COBOL source says it should, on those inputs | equivalence with the legacy runtime |
| Engineering gates (readiness, conversion validation) | the source is understood enough to convert; the conversion output is complete and labelled | equivalence; they never authorize generation |
| Legacy equivalence (F6, G6) | the same inputs give the same outputs in COBOL and Java | **not achieved:** no COBOL runtime or captured runs |

## STEP-25 final regression (environment B, sequential)

| Check | Exit | Result |
|---|---|---|
| Forward `npm run build` | 0 | no errors |
| `doctor` | 0 | OK: 24 OK, 0 FAIL |
| `sync-agents --check` | 0 | 21 entries in sync, no drift |
| `bmad doctor` | 0 | OK, bmad-method@6.12.4 staged |
| `bmad governance --scope programs:PORTREAD` | 3 | `BMAD_BLOCKED` (expected) |
| `pilot integrate` | 0 | 41 programs and 15 jobs integrated; POSUPDT excluded; 120 Java files compiled. Runtime unit tests 34/34; program tests 1,388 pass, 532 blocked as expected, 0 fail (of 1,920); scenarios 69 pass, 141 blocked as expected, 0 fail (of 210); integration tests 3 pass, 36 blocked as expected, 0 fail (of 39) |
| Java `RuntimeTests` | 0 | **34/34** |
| `pilot validate` (42 programs) | — | **41/42** pass; POSUPDT fails (empty source) |
| `pilot readiness` (42 programs) | — | **6/42** pass: PORTADD, PORTREAD, PORTTEST, PORTUPDT, PORTVALD, PROGNAME |
| Forward `npm test`, first run | 1 | 417/418: one failure in a new STEP-25 test, diagnosed below |
| Forward `npm test`, after the test correction | 0 | **418/418** (412 existing + 6 STEP-25), 277 s |
| Dashboard typecheck | 0 | strict TypeScript, no errors |
| Dashboard `npm test` | 0 | **40/40**; 137 evidence files, none missing or modified |
| Dashboard build | 0 | succeeds |
| Dashboard smoke | 0 | **20/20** (headless Edge, production CSP) |
| Dashboard metrics (report into a scratch folder) | 0 | 18/18 primary, 25/25 coverage, 114/114 cross-checks; regenerated STEP-24 evidence identical to the committed files except the baseline line |
| STEP-25 audit | — | before the correction: 79 pass, 1 fail (line-ending finding); **after it: 80/80 pass** |

**The first-run failure.**
- **What failed:** the new STEP-25 test assumed that every tracked dashboard file is listed by commit blob.
- **Why:** `forward/dashboard/scripts/evidence-report.ts` is tracked *and* modified in STEP-25, so `backup.js` correctly archives it as `modified`.
- **Fix:** the assertion now uses "listed by blob or archived". That is the STEP-10 definition of recoverable. The test also now requires that archived dashboard files are only modified or new ones. The failing run is kept in the record.

**Local state change caused by the regression** (snapshots before and after):
- The 145 generated program sources are unchanged (tree `d31fac95…`).
- `pilot integrate` rebuilt the derived integration copy `generated/java/app/` and changed exactly two run-record files: `workflow/audit.jsonl` (one appended event) and `workflow/state.json`.
- No Java was regenerated.

**Speed.** The full forward suite took 4–5 minutes, against 42–68 minutes in STEP-24. The STEP-10 backup test no longer archives the dashboard's 25,000 dependency files.

## Pure checkout (environment A, clean clone at `C:/rfv25`)

A clone of `d2c3409` with only the STEP-25 candidate files overlaid. There were no run records, generated Java, COBOL source or pre-installed dependencies: `npm ci` fetched them from the npm registry or the local npm cache, so this is not an offline demonstration.

| Check | Result |
|---|---|
| Forward `npm ci`, build | pass |
| `doctor` | OK: 23 OK, 1 WARN (COBOL source not configured, expected), 0 FAIL |
| `sync-agents --check` | 21 in sync |
| `javac -Xlint:all -Werror` of the 20 hand-written runtime files | pass |
| `RuntimeTests` from the hand-written runtime alone | **34/34** |
| Dashboard `npm ci`, build, tests, smoke | pass, **40/40**, **20/20** |
| Backup and git-policy tests | 10/10 |
| STEP-25 audit (before the correction) | 71 pass, 7 not verifiable here (restricted source, run records, generated Java), 2 fail (one finding, corrected below) |

**Finding, since corrected.** `output/diagram/diagrams_artifact.json` was committed with LF line endings, but its recorded SHA-256 is of its CRLF bytes, so a fresh checkout failed the hash check and G0. The correction is described in [SOURCE-TRACEABILITY.md](SOURCE-TRACEABILITY.md) and verified in the next section.

## Earlier environmental timeouts

In STEP-23 and STEP-24, two full runs on a heavily loaded machine had one `javac`/`java` subprocess hit the 300 s limit. Each time, the suite passed on its own and a full rerun passed. Those runs remain recorded in their reports. No timeout was changed and no test was weakened.

## Line-ending correction: verification

The correction is staged: a `-text` exception for the one file, and the exact CRLF bytes in its blob. It is not yet committed.

| Check | Result |
|---|---|
| Recorded hash (STEP-22, run baseline manifest; 790,963 bytes) | `bde93ef6400a7317…` |
| Former committed blob (LF, 764,582 bytes) | `7154d49b225fadef…` |
| Former blob with LF→CRLF | `bde93ef6400a7317…`: **exact match**; identical to the working copy; JSON structurally identical |
| Staged diff ignoring CR at end of line | empty: 26,381 CR bytes added, nothing else |
| Control fresh clone of `d2c3409` | artifact `7154d49b…`; G0 **FAIL**: stale baseline |
| Fresh clone of the repaired commit (same blob IDs as staged) | artifact `bde93ef6…`; `i/crlf w/crlf attr/-text`; clean status; G0 **PASS** (11 inputs match) |
| STEP-25 audit in that clone | 79 pass, 0 fail, 1 not verifiable (generated Java not attached) |
| Full forward `npm test` in that clone, with all local assets attached | **418/418**; doctor 24 OK, 0 WARN |
| Developer tree with the correction staged | audit 80/80; build; doctor OK; BMad doctor OK; `RuntimeTests` 34/34; backup and restore tests 22/22; dashboard 40/40, build, smoke 20/20, metrics 18/18, 25/25 and 114/114 |
| Developer tree `npm test` with the correction staged | 414/418, and doctor shows `[WARN] reverse_harness_untouched` |

The last row is expected until the correction is committed. The harness treats *any* uncommitted change under `output/` as a change to the reverse harness:
- doctor warns, and two tests assert a clean `git status` for `output/`;
- two more tests (step3 F1/F2) are blocked, because G0's `reverse_harness_unchanged` check fails.

The protections were not weakened. With the correction committed, the same suite passes 418/418, as the row above shows. Generated Java is unchanged (145 files, tree `d31fac95…`), and no dashboard evidence input changed: the artifact is not a dashboard source, and the dashboard evidence is still byte-identical.

