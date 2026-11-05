# Test file rename map

The forward test files were renamed from their historical development STEP numbers to names that describe what they test. The renames used `git mv`, so `git log --follow forward/tests/<new name>` shows each file's full history.

- **Test content:** unchanged, with one exception. `synthetic-conversion-pilot.test.ts` checks that its own source file is recoverable from a backup, so the path it names changed from `forward/tests/step11.test.ts` to `forward/tests/synthetic-conversion-pilot.test.ts`.
- **Test counts:** identical before and after (418 tests in 25 files).
- **CI selection:** the same 20 files, renamed in `.github/workflows/revforge-ci.yml`.

**Historical records keep the old names.** STEP reports, their generators in `forward/tools/` and machine-readable run evidence (`forward/reports/**`) record what ran at the time. They are not rewritten. Use this table to map an old name in those records to the current file.

| Original file | New file | Historical STEP | What it tests | Environment |
|---|---|---|---|---|
| `step1.test.ts` | `reverse-artifact-intake-and-planning.test.ts` | STEP 1 | reverse-artifact discovery and validation, permanent and run-local IDs, gap expansion, the generation guard, readiness without source | CI |
| `step2.test.ts` | `workflow-orchestrator-and-gates.test.ts` | STEP 2 | agent registry, workflow states, resume and checkpoints, G0/G1, fail-closed G2–G8, permissions, classification | CI |
| `step3.test.ts` | `agent-skills-deliverables-and-batches.test.ts` | STEP 3 | the 14 skills, deliverable contracts, F2 copybook layouts, write/hash/self-approval protection, batches and ledger | CI |
| `step35.test.ts` | `deliverable-reconciliation-and-source-verification.test.ts` | STEP 3.5 | per-ID reconciliation, access evidence, independent source verification, versioned corrections | CI |
| `step4.test.ts` | `g2-requirements-approval.test.ts` | STEP 4 | G2 readiness, decision resolution, signed human approval, packets and receipts | CI |
| `step45.test.ts` | `g2-blocker-analysis-and-review-packets.test.ts` | STEP 4.5 | blocker reconciliation and root causes, deterministic COBOL verification, remediation proposals, review packets | CI |
| `step5.test.ts` | `openai-independent-verification.test.ts` | STEP 5 | OpenAI verification boundary and authorization, two-pass verification (offline) | CI |
| `step55.test.ts` | `decision-workbench-and-scope-evidence.test.ts` | STEP 5.5 | scope selection, evidence packages, decision packets, citation corrections, trust readiness, pilot preparation | CI |
| `step6.test.ts` | `bmad-release-and-adapter.test.ts` | STEP 6 | the pinned BMad release, catalogue, bindings, eligibility, adapter | Developer (BMad staging) |
| `step7.test.ts` | `g3-g4-design-approvals-and-bmad-executor.test.ts` | STEP 7 | scope reconciliation, G3/G4 approvals, invalidation, the isolated BMad executor | Developer (BMad executor) |
| `step8.test.ts` | `trusted-decisions-disclosure-and-preflight.test.ts` | STEP 8 | trust provisioning, signed decisions, AI disclosure authorization, BMad execution preflight | Developer (BMad executor) |
| `step9.test.ts` | `cobol-context-verification-and-isolation.test.ts` | STEP 9 | COBOL source-context verification, whole-process isolation, isolation-aware preflight | CI |
| `step10.test.ts` | `evidence-adjudication-and-backup-recovery.test.ts` | STEP 10 | evidence adjudication, review packages, the recoverable backup | CI |
| `step11.test.ts` | `synthetic-conversion-pilot.test.ts` | STEP 11 | VERIFIED/PARTIAL/GAP classification, the synthetic conversion pilot, recovery completeness | CI |
| `step12.test.ts` | `g2-semantic-dependencies-and-closure.test.ts` | STEP 12 | G2 semantic dependency edges, behaviour classification and closure | CI |
| `step13.test.ts` | `behaviour-scopes-and-scoped-approval.test.ts` | STEP 13 | typed behaviour scopes, dependency closure, scoped Ed25519 approval, RTNCDE00 regression | CI |
| `step14.test.ts` | `source-readiness-and-conversion-validation.test.ts` | STEP 14 | the SOURCE_READINESS and CONVERSION_VALIDATION engineering gates | CI |
| `step15.test.ts` | `local-converter-language-support.test.ts` | STEP 15 | local converter language support and guards | CI |
| `step16.test.ts` | `program-scoped-generation-authorization.test.ts` | STEP 16 | program-scoped local generation authorization | CI |
| `step17.test.ts` | `full-application-conversion.test.ts` | STEP 17 | full-application converter, consolidated authorization, JCL, the real campaign (read-only) | CI |
| `step20.test.ts` | `readiness-closure-corrections.test.ts` | STEP 20 | readiness closure corrections, reserved words in the converter | CI |
| `step21.test.ts` | `mandatory-bmad-governance.test.ts` | STEP 21 | mandatory BMad governance and receipt counting | Developer (BMad executor) |
| `step25.test.ts` | `dashboard-backup-exclusion-policy.test.ts` | STEP 25 | backup exclusion policy 2 for the dashboard's reproducible output | CI |

**Unchanged:** `bmad-e2e.test.ts` (Developer) and `git-policy.test.ts` (CI) already had descriptive names. The helpers under `tests/helpers/` are unchanged.

**Compiled output:** `npm run build` cleans `dist/` before compiling, so `dist/tests/` holds only the new names (`dist/` is git-ignored).
