# Git regression stabilization

**Cause.** Commit `d26f4dd` (forward/ committed and pushed) broke 10 tests that encoded the old layout. They assumed forward/ was untracked and that no `.java` file was tracked at all. No product behaviour, gate or governance rule was involved.

## 1. Failures and root causes

| Test | Area | Root cause |
|---|---|---|
| `step10.test.ts`: 23/24. the inventory covers the implementation (agents, skills, sources, lockfile) and excludes secrets | backup inventory | the backup discovered only untracked, ignored and modified files; after d26f4dd the forward implementation is tracked, so forward/package.json and the other required files were no longer "included" |
| `step10.test.ts`: 26/27. a real backup restores into an isolated directory with every hash, agent and skill intact | backup restore | a bare extract held only the archive; the 7 agents and 14 skills are now tracked, so the restore counted 0 of each |
| `step11.test.ts`: 13. recovery completeness: pilot sources and STEP 11 code are backed up ... | backup inventory + checkout restore | same as 23/24; in checkout mode the archived uncommitted modifications of tracked files then tripped tracked_files_intact |
| `step11.test.ts`: 16. no production Java generation ... | Java tracking | asserted `git ls-files *.java` empty; the 20 hand-written runtime files are tracked since d26f4dd |
| `step12.test.ts`: 10. no production Java generation | Java tracking | same assertion |
| `step13.test.ts`: 20/22/23/24. real G2 stays blocked, no Java, nothing written, reverse outputs protected | Java tracking | same assertion |
| `step14.test.ts`: PORTVALD: SOURCE_READINESS passes ...; generation stays unauthorised | Java tracking | same assertion |
| `step15.test.ts`: generation authorisation is still enforced ... | Java tracking | same assertion |
| `step16.test.ts`: generated output is git-ignored, excluded from backups, and no Java is tracked | Java tracking | same assertion |
| `step17.test.ts`: generated output stays out of git and backups | Java tracking | same assertion |

## 2. Tracking policy

| Category | Git | Enforced by |
|---|---|---|
| Hand-written Java runtime (forward/runtime/java/revforge/cobol/**, package revforge.cobol*) | tracked | tests/helpers/gitpolicy.ts javaTrackingViolation; git-policy.test.ts checks all of it is tracked |
| Generated Java programs (forward/generated/**, package revforge.app.*) | ignored (forward/.gitignore: generated/) | git-policy.test.ts check-ignore; any tracked one is a violation |
| Compiled classes | ignored | git-policy.test.ts: no tracked .class |
| TypeScript sources, tests, tools, contracts, docs, config | tracked | repository layout |
| Build output and dependencies (forward/dist, forward/node_modules) | ignored | forward/.gitignore |
| Run-local records (forward/runs/*) | ignored except runs/.gitkeep | forward/.gitignore |
| Reports | tracked (existing policy since d26f4dd); excluded from backup archives | tools/backup.js EXCLUDE |
| COBOL reference checkout, OpenWiki, credentials (.mcp.json, settings.local.json, .env) | ignored, never tracked | root .gitignore; backup secret scan of tracked files |

Tracked `.java` files: 20, all hand-written runtime. Generated Java tracked: 0.

## 3. Changes

| File | Change |
|---|---|
| `forward/tests/helpers/gitpolicy.ts` | new: path- and package-based Java tracking classifier |
| `forward/tests/git-policy.test.ts` | new: positive and negative classifier cases; the real repository tracks exactly the runtime; generated Java and classes stay ignored |
| `forward/tests/step11..17.test.ts` | `git ls-files *.java` empty  ->  no tracking-policy violation (7 assertions) |
| `forward/tests/step10.test.ts` | implementation must be recoverable (archived or tracked at the commit); no excluded root except the empty runs/.gitkeep; no committed secret; a tampered tracked blob is detected |
| `forward/tests/step11.test.ts` | recovery completeness over archived + tracked files; no committed secret |
| `forward/tools/backup.js` | tracked files listed with git blob ids (tracked_at_commit) and secret-scanned (create refuses on a committed secret); restore verifies them against the commit tree; agents/skills counted over archive + commit; tracked_files_intact allows exactly the recorded modifications; the excluded-path check reads the archive |
| `forward/tests/step3.test.ts` | fresh-clone fix: the placeholder-section edit matches CRLF as well as LF (a Windows checkout holds CRLF; the edit silently did nothing) |
| `forward/runtime/src/commands/bmad.ts` | fresh-clone fix: `bmad dry-run --mode MOCK` is refused as a usage error before the run is loaded, so the result no longer depends on local run records |
| `.gitattributes` | new: `* text=auto eol=lf`. A Windows checkout with core.autocrlf=true wrote every text file with CRLF, changing the SHA-256 of hash-bound evidence (authorization manifest, reverse artifacts, BMad pin and bindings) and voiding the LGA records in a fresh clone; checkouts now reproduce the committed bytes |
| `forward/tests/step10.test.ts (26/27)` | fresh-clone fix: the archived-entry tamper case runs only when the archive has entries (a pristine clone has no uncommitted file); the tracked-file tamper case always runs |
| `forward/tools/git-stabilization-report.py` | new: this report |

No assertion was removed or made unconditional. Every check either still fails on the condition it guarded or was extended with a negative case.

## 4. Backup

Restore test (checkout of the recorded commit + archive, build and test): **PASS**.

| Check | OK | Detail |
|---|---|---|
| archive_hash | True | archive sha256 c6813c1a2dec51c4… |
| archive_entries_safe | True | 414 entries: relative, no traversal, no links |
| git_baseline | True | disposable checkout at d26f4dd02c706eecf5d4649d8ef68d315c6e2e59 |
| extracted | True | extracted into C:\Users\vighn\AppData\Local\Temp\revforge-restore-2sweDk\repo |
| tracked_at_commit | True | 665 tracked files recoverable from commit d26f4dd02c706eecf5d4649d8ef68d315c6e2e59 with their recorded blobs |
| files_present | True | 414 files present at their original relative paths |
| hashes_match | True | every sha256 matches the inventory |
| nothing_extra | True | no unexpected files or links |
| tracked_files_intact | True | the archive changed no tracked file of the baseline commit except the 15 recorded uncommitted modification(s) |
| agents_and_skills | True | 7 forward agent definitions, 14 forward skills (expected 7 and 14) |
| no_secrets | True | no private keys, API keys or passwords in the restored files |
| no_excluded_paths | True | no excluded path was restored from the archive |
| restored_build | True | TypeScript build of the restored sources succeeded |
| restored_tests | True | restored test run: 381/412 passed, 0 failed, 31 skipped |

Tests in the restored checkout: 381/412 passed, 0 failed, 31 skipped (no COBOL source attached).

## 5. Fresh clone of the committed HEAD

| Step | Exit | Result |
|---|---|---|
| git clone into C:/rfc (fresh, no local assets) | 0 | HEAD 44e99ef; git status entries: 0 |
| hand-written Java runtime in the clone | 0 | 20 tracked; 20 on disk |
| hash-bound files reproduce their committed bytes | 0 | forward/pilot/authorizations/APPLICATION.authorization-manifest.json=same output/inventory/inventory_artifact.json=same forward/integrations/bmad/release.pin.json=same forward/integrations/bmad/bindings.json=same  |
| reverse artifacts present | 0 | data diagram final_report inventory logic parser rules  |
| absent by policy | 0 | references: absent; forward/generated: absent; BMad staging package: absent; forward/runs records: 0; .mcp.json: absent |
| npm ci --offline | 0 | added 10 packages in 8s |
| npm run build | 0 | 0 TypeScript errors |
| javac forward/runtime/java | 0 | 20 sources; 0 errors |
| RuntimeTests | 0 | SUMMARY/34/0/0 |
| sync-agents --check | 0 | entries not in sync: 0 |
| doctor (no COBOL source root) | 0 | FAIL: 0 |
| bmad doctor | 1 | bmad doctor: FAILED — bmad-method@6.12.4 staged; not installed in the repository (isolated executor installation: bmad executor doctor) |
| governance and generation restrictions | 0 | {"mandatory":true,"java_generation_allowed":false,"trust_store":null} |
| npm test (fresh clone, no local assets) | 1 | ℹ tests 400 ℹ pass 341 ℹ fail 18 ℹ skipped 41  |

**`npm test` in the fresh clone of the committed HEAD:** 341/400 passed, 18 failed, 41 skipped. That HEAD predates this pass's repairs, and the clone has no COBOL source, BMad staging or run records.

| Cause | Failures |
|---|---|
| test assumed the backup archive is non-empty; a pristine clone has no uncommitted file (FIXED in this pass: tests/step10.test.ts) | 1 |
| BMad staging release absent (git-ignored; re-staged per BMAD-INTEGRATION-OPERATIONS.md) | 17 |

The committed state was also verified in a clean short-path clone with the separately held local assets attached (dependencies, BMad staging and executor, run records, generated Java, COBOL source root): see the last rows of the regression table.

## 6. Regression (working repository, sequential)

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | TypeScript build |
| `node dist/runtime/src/cli.js doctor` | 0 | FAIL checks: 0; OK checks: 24 |
| `node dist/runtime/src/cli.js sync-agents --check` | 0 | entries not in sync: 0 |
| `node dist/runtime/src/cli.js bmad doctor` | 0 | bmad doctor: OK — bmad-method@6.12.4 staged; not installed in the repository (isolated executor installation: bmad executor doctor) |
| `node dist/runtime/src/cli.js bmad executor doctor` | 0 | bmad executor: isolated installation VERIFIED; LIVE execution BLOCKED; [FAIL] provider_disclosure_authorization: no signed AI-provider disclosure authorization exists for anthropic (claude-code-cli); signed sour [FAIL] live_reques |
| `node dist/runtime/src/cli.js bmad isolation doctor` | 0 |  yes docker_host: Docker version 29.9.2, build a82e528; no podman_host: not installed on the host; yes linux_unshare: /usr/bin/unshare; yes linux_setpriv: /usr/bin/setpriv; no linux_bwrap: not installed; no linux_docker: not insta |
| `node dist/runtime/src/cli.js provider authorization doctor` | 0 |   anthropic/claude-code-cli: NOT AUTHORIZED — 0 record(s)   openai/responses-api: NOT AUTHORIZED — 0 record(s)   trust: TRUST_NOT_CONFIGURED. OpenAI source-export authorizations (verification openai authorize) are a separate contr |
| `node dist/runtime/src/cli.js bmad governance --scope programs:PORTREAD` | 3 | programs:PORTREAD: BMAD_BLOCKED (BMad is mandatory for governed runs) |
| `node dist/runtime/src/cli.js workflow g2 evaluate --scope programs:PORTREAD` | 1 | scope programs:PORTREAD: NOT_READY — 2 unit(s), 12 blocking finding(s); digest c6b1864a61d126f8f09c5b2e5aace229df1da15dc8314fa0d07f16a756a6178f |
| `node --test dist/tests/step6..9 + step21 + bmad-e2e + git-policy + step10/16/17 (BMad, governance, git policy,` | 0 | # tests 165 # pass 165 # fail 0  |
| `node dist/runtime/src/cli.js pilot integrate` | 0 | integrated 41 program(s), 15 job(s); excluded: POSUPDT (conversion FAILED: the source cannot be converted: missing PROGRAM-ID)   compilation: COMPILED (120 Java files)   runtime unit tests: {"PASS":34,"BLOCKED_AS_EXPECTED":0,"FAIL |
| `java -cp generated/java/app/classes revforge.cobol.testing.RuntimeTests` | 0 | SUMMARY/34/0/0 |
| `npm test` | 0 | ℹ tests 412 ℹ pass 412 ℹ fail 0 ℹ skipped 0  |
| `npm test (final, after the CRLF test fix and dry-run usage ordering)` | 0 | ℹ tests 412 ℹ pass 412 ℹ fail 0 ℹ skipped 0  |
| `npm test in a clean clone of commit 44e99ef (C:/rfv) with local assets attached` | 0 | ℹ tests 400 ℹ pass 400 ℹ fail 0 ℹ skipped 0 (the 12 BMad end-to-end tests are not part of this commit) |
| `pilot validate` (42) | 41 exit 0 | POSUPDT (empty source) is the non-zero one |
| `pilot readiness` (42) | 6 PASS | unchanged |

## 7. BMad governance and integrity

- **Governance:** `bmad_governance.mandatory` is still true, `java_generation_allowed` false and `live_execution.requested` false. No governance code was changed in this pass.
- **Reverse artifacts:** unchanged (11/11 SHA-256 matches).
- **Counts:** {"programs": 42, "business_rules": 154, "paragraphs": 402, "statements": 1936, "perform_edges": 524, "fields": 1009, "diagrams": 65, "jcl": 15}. Master Gap Register: 569 records. Neither file was touched.
- **Generated Java:** no program regenerated (tree hash recorded in integrity.json).

## 8. Remaining limitations

- A fresh clone has no COBOL source (`references/` is ignored by policy), so source-dependent tests skip and readiness/validation cannot run there.
- A fresh clone has no BMad staging release or isolated executor (git-ignored; re-staged per BMAD-INTEGRATION-OPERATIONS.md), so `bmad doctor` fails there.
- A fresh clone has no generated Java (git-ignored by policy); it is regenerated only under a valid authorization.
- Dependencies need the npm registry or a local npm cache.
- Windows path length: the longest tracked path is 177 characters (forward/reports/step-13/...). A clone into a deep directory fails at checkout ("Filename too long", exit 128) unless it is cloned to a short path or with `git -c core.longpaths=true clone`. The first fresh-clone attempt here failed for this reason and was repeated in a short path. Historical report names were not renamed.
- The repairs in this pass are uncommitted (no commit or push was made).
