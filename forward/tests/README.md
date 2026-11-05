# Forward engineering tests

`node:test` suites for the forward harness: the TypeScript runtime and CLI, the orchestrator and gates, approvals, the local converter, BMad governance, verification, and the backup tool. Every file is named after what it tests. The historical STEP names (`step1.test.ts` …) are mapped in [`../docs/TEST-FILE-RENAME-MAP.md`](../docs/TEST-FILE-RENAME-MAP.md).

**Environments:**
- **CI:** runs on a pure Git checkout and is included in `.github/workflows/revforge-ci.yml`. Individual tests that need the COBOL source or generated Java skip themselves there; the *CI skips* column counts them.
- **Developer:** needs the git-ignored BMad staging release and executor installation (`forward/integrations/bmad/staging`, `executor`). It is not run in CI, by design.

Counts are from the full developer-environment run: 418 tests in 25 files, all passing.

| Test file | Responsibility | Main components | Tests | Environment (CI skips) |
|---|---|---|---|---|
| `reverse-artifact-intake-and-planning.test.ts` | dynamic program discovery, reverse-artifact JSON validation, missing artifacts, permanent-ID preservation, run-local IDs, grouped-gap expansion, the generation guard, readiness without source, cross-platform paths, no hard-coded system knowledge | `core/` (artifacts, model, config, guard, paths), `commands/plan`, `validate`, `doctor`, `verification/src/ids` | 36 | CI |
| `workflow-orchestrator-and-gates.test.ts` | the seven-agent registry, input/output declarations, state transitions, resume and checkpoint integrity, G0/G1, fail-closed G2–G8, tool and path permissions, template/application classification | `orchestrator/` (agents, states, gates, permissions, classification, store) | 43 | CI |
| `agent-skills-deliverables-and-batches.test.ts` | the 14 skills (registration, metadata, duplicates), deliverable contracts and run bindings, copybook layouts and numeric mappings (F2), write/hash/self-approval protection, batches and the coverage ledger, `.claude/` protection | `orchestrator/` (skills, ledger, permissions), `verification/src/numeric` | 41 | CI |
| `deliverable-reconciliation-and-source-verification.test.ts` | per-ID reconciliation of agent deliverables, transcript access evidence, independent field and text-claim verification against the source, versioned corrections | `remediation/` (remediation, transcripts), `orchestrator/skills` | 14 | CI |
| `g2-requirements-approval.test.ts` | G2 readiness and evidence outcomes, decision resolution, Ed25519-signed human approval, packets and receipts | `approval/` (approvals, decisions, packets, scope, snapshot) | 22 | CI |
| `g2-blocker-analysis-and-review-packets.test.ts` | blocker-count reconciliation and root causes, deterministic COBOL verification, conflicts and scope readiness, remediation proposals, independent-review packet preparation, gates staying protected | `blockers/` (audit, deterministic, rootcauses, queue, readiness, openai, egress) | 15 | CI (1) |
| `openai-independent-verification.test.ts` | OpenAI verification disabled by default, signed source-export authorization at the network boundary, two-pass verification (offline: mock provider and fake transport), secrecy and protected gates | `openai/` (config, authorization, engine, provider, prompts) | 12 | CI |
| `decision-workbench-and-scope-evidence.test.ts` | scope selection and evidence packages, decision packets and traceability, signed citation corrections and trust readiness, OpenAI pilot preparation without a network call | `workbench/`, `commands/workbench`, `remediation/` | 7 | CI |
| `bmad-release-and-adapter.test.ts` | the pinned BMad release (tarball, extracted files, workflow catalogue), bindings, eligibility rules, the adapter on a synthetic workflow, protection | `bmad/` (release, bindings, eligibility, adapter, validators) | 27 | Developer |
| `g3-g4-design-approvals-and-bmad-executor.test.ts` | scope reconciliation, G3 architecture and G4 story-set approvals, dependency-aware invalidation and trust, the isolated BMad executor | `design/approvals`, `bmad/` (executor, mapping, reconcile, release) | 28 | Developer |
| `trusted-decisions-disclosure-and-preflight.test.ts` | trust provisioning, signed decision resolution, citation correction propagation, G2 operations, provider-specific AI disclosure authorization, the BMad execution preflight | `operations/`, `disclosure/disclosure`, `bmad/preflight` | 16 | Developer |
| `cobol-context-verification-and-isolation.test.ts` | the dependency-aware COBOL resolver, source-context verification in the workflow, whole-process isolation, the isolation-aware preflight | `context/context`, `isolation/isolation`, `bmad/preflight` | 17 | CI |
| `evidence-adjudication-and-backup-recovery.test.ts` | adjudication of earlier and new evidence, shared dependencies and review packages, the recoverable backup (inventory, unsafe archives, restore) | `context/adjudication`, `operations/package`, `tools/backup.js` | 16 | CI |
| `synthetic-conversion-pilot.test.ts` | VERIFIED/PARTIAL/GAP classification, the isolated synthetic COBOL-to-Java pilot (real `javac`/`java` when a JDK is present), gap traceability, recovery completeness, the real workflow staying fail-closed | `pilot/` (pilot, plan, cobol-subset, java-emit), `tools/backup.js` | 15 | CI (3) |
| `g2-semantic-dependencies-and-closure.test.ts` | G2 semantic dependency edges, behaviour classification and verified-subset closure, the real run staying unapproved | `approval/semantic`, `context/semantic-findings`, `pilot/scope` | 8 | CI (3) |
| `behaviour-scopes-and-scoped-approval.test.ts` | typed behaviour scopes, deterministic dependency closure, shared-decision attribution, deferred gaps, scoped Ed25519 approval; RTNCDE00 regression on the real run (read-only) | `approval/` (scope, closure, approvals), `design/design` | 12 | CI (6) |
| `source-readiness-and-conversion-validation.test.ts` | the SOURCE_READINESS and CONVERSION_VALIDATION engineering gates, candidate ranking, the undefined-MOVE hazard, generation authorization unchanged | `pilot/gates`, `approval/closure` | 7 | CI (3) |
| `local-converter-language-support.test.ts` | the extended local converter (entry paragraphs, reference modification, class tests, conditions, INITIALIZE, decimal scale, binary items, copybooks) and its guards; real programs stay unconverted | `pilot/` (cobol-subset, java-emit, gates) | 6 | CI (2) |
| `program-scoped-generation-authorization.test.ts` | program-scoped local generation authorization (missing, expired, tampered or mismatched → refused; valid → generate, compile, test, audit); real run PORTVALD only | `pilot/` (authorization, generate, gates) | 12 | CI (2) |
| `full-application-conversion.test.ts` | the full-application converter (front end, Java back end, runtime), the consolidated authorization and guards, JCL and the CONVERSION_VALIDATION label rule, the real campaign (read-only) | `pilot/` (cobol-app, app-convert, app-integrate, java-app) | 20 | CI (3) |
| `readiness-closure-corrections.test.ts` | readiness closure corrections (compiler-defined names, SPECIAL-NAMES, INDEXED BY, a missing PERFORM target fails closed); reserved words never become paragraph headers | `approval/closure`, `pilot/cobol-app` | 9 | CI (7) |
| `mandatory-bmad-governance.test.ts` | mandatory BMad governance: every blocked condition keeps a governed run BMAD_BLOCKED with no fallback; failed, invalid and MOCK receipts never count | `bmad/` (governance, preflight, executor, adapter, eligibility) | 13 | Developer |
| `dashboard-backup-exclusion-policy.test.ts` | backup exclusion policy 2: the dashboard's reproducible output is excluded, its source stays recoverable, policy-1 archives still verify | `tools/backup.js` | 6 | CI |
| `bmad-e2e.test.ts` | BMad end to end: receipts, drafts and forward consumption | `bmad/` (adapter, executor, governance, preflight, runner), `disclosure/` | 12 | Developer |
| `git-policy.test.ts` | the Git tracking policy: the hand-written Java runtime tracked, generated Java and class files ignored | `helpers/gitpolicy.ts` | 4 | CI |

**Totals:**
- 25 files and 418 tests.
- **CI:** 20 files, 322 tests (30 skip themselves on a pure checkout).
- **Developer only:** 5 files, 96 tests.

## Running

From `forward/`:

```bash
npm run build                                   # compiles runtime and tests into dist/
npm test                                        # build + every file (developer environment for all 418)
node --test dist/tests/synthetic-conversion-pilot.test.js          # one file
node --test --test-name-pattern "recovery completeness" dist/tests/synthetic-conversion-pilot.test.js   # one test
```

The CI selection is the exact list in `.github/workflows/revforge-ci.yml` (job *Forward engineering*). Run it locally by pasting that `node --test …` command after `npm run build`.

**Environment variables** (only where the test needs them):
- `REVFORGE_JAVA_HOME`: a JDK 21. Tests that compile Java skip without it and never fake a result.
- `REVFORGE_COBOL_SOURCE_ROOT`: the authorized COBOL source. Tests that read the real source or run skip without it.

## Helpers and fixtures

| Helper | Provides |
|---|---|
| `helpers/fixture.ts` | `makeFixture()`: a small synthetic reverse-engineering dataset in a temporary directory; `FORWARD_DIR`, `cleanup` |
| `helpers/g2fixture.ts` | `setupG2()`: a delivered synthetic G2 workflow with checkable COBOL source, in-memory test signers, signing helpers |
| `helpers/designfixture.ts` | `designFixture()`: the G2 → G3 → G4 workflow with design-role signers, architecture and story deliverables |
| `helpers/contextfixture.ts` | `contextFixture()`: a synthetic source-context case (a copybook declaring level-88 conditions) for evidence adjudication |
| `helpers/outputs.ts` | a test-only reference producer of minimal F1/F2 deliverables that satisfy the contracts |
| `helpers/gitpolicy.ts` | the Java tracking policy (hand-written runtime tracked, all other Java not) |

**Conventions:**
- Synthetic fixtures and keys live in temporary directories.
- The real workflow run, reverse artifacts and COBOL source are only ever **read**.
- No test makes a network call or a live AI or BMad call.
- A test that cannot run its real check (no JDK, no source, no namespace support) skips and says why. It never passes by assumption.
