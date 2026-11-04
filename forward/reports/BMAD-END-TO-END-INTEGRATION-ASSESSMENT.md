# BMAD end-to-end integration assessment

**Classification: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.** No BMad workflow has executed for any scope, and no LIVE receipt exists.

**COBOL equivalence: not established.**

Evidence is in `forward/reports/bmad-end-to-end/`. STEP 21 records are referenced, not duplicated.

## 1. Audit findings (file level)

| # | Question | Answer | Evidence | Files |
|---|---|---|---|---|
| Q1 | Are all six workflow bindings valid? | **YES** | bmad doctor: 6 valid bindings; definitions re-derived from the pinned 6.12.4 release; shims refused | `forward/integrations/bmad/bindings.json`, `forward/runtime/src/bmad/bindings.ts`, `forward/runtime/src/bmad/release.ts` |
| Q2 | Can each workflow be prepared with correct inputs? | **NOT FOR PORTREAD NOW** | packet preparation requires eligibility (G2 for the exact scope, workflow state, upstream receipts); every workflow is refused for programs:PORTREAD (workflow-binding-validation.json); MOCK preparation is tested on synthetic scopes (tests/step6-9) | `forward/runtime/src/bmad/adapter.ts#preparePacket`, `forward/runtime/src/bmad/eligibility.ts`, `forward/runtime/src/bmad/mapping.ts` |
| Q3 | Does every workflow run under the required authorization and isolation boundary? | **YES (enforced); none can run** | executeLive requires a recorded preflight that permits the launch; the new sandbox runner re-checks the preflight, the recorded disclosure authorization and every source/input hash and runs only inside sandbox.sh (network none) | `forward/runtime/src/bmad/executor.ts#executeLive`, `forward/runtime/src/bmad/preflight.ts`, `forward/runtime/src/bmad/runner.ts`, `forward/integrations/bmad/isolation/sandbox.sh` |
| Q4 | Are BMad outputs consumed by the next F1-F7 stage? | **FIXED (wired); not demonstrated** | before: only later BMad bindings read earlier receipts; F1-F7 dispatch packets never included BMad output. Now verified LIVE BMad documents are optional, non-authoritative inputs of F3 (PRD), F4 (PRD, architecture), F5 (stories, sprint) and F7 (build); F1, F2 and F6 never receive them. No real receipt exists, so no packet has received one | `forward/runtime/src/orchestrator/orchestrator.ts#prepare`, `forward/runtime/src/bmad/governance.ts#verifiedDrafts` |
| Q5 | Does the workflow stop when a required stage fails? | **YES** | governedRun stops at the first BLOCKED / EXECUTION_FAILED / EXECUTED_REJECTED stage; later stages NOT_ATTEMPTED (tests/bmad-e2e, step21) | `forward/runtime/src/bmad/governance.ts#governedRun` |
| Q6 | Are actual LIVE receipts validated? | **YES (logic); 0 exist** | recordResult re-evaluates the LIVE gate from preflight facts; governance.receiptCounts requires accepted, sealed, intact, current-digest LIVE receipts with unchanged documents | `forward/runtime/src/bmad/adapter.ts#recordResult`, `forward/runtime/src/bmad/governance.ts#receiptCounts` |
| Q7 | Can local-generation output be marked BMad-compliant? | **NO** | compliance is computed from BMad receipts only; LGA conversions print LOCAL_LGA_NOT_BMAD_GOVERNED; historical records are not relabelled | `forward/runtime/src/commands/pilot.ts`, `forward/runtime/src/bmad/governance.ts#governanceVerdict` |
| Q8 | Can any command bypass mandatory governance? | **CLOSED for new authorisations** | before: `pilot authorize` could create a NEW local-generation authorisation without BMad evidence; now refused BMAD_BLOCKED without verified receipts up to sprint and accepted F2. Re-conversion under the existing LGA records (convert-app / generate) stays permitted as historical, non-BMad work until those records expire on 2026-12-03; workflow generation needs BMad evidence (generationAuthorized); top-level `generate` refuses | `forward/runtime/src/commands/pilot.ts#authorize`, `forward/runtime/src/orchestrator/orchestrator.ts#bmadLifecycleEvidence`, `forward/runtime/src/orchestrator/orchestrator.ts#generationAuthorized`, `forward/runtime/src/cli.ts#generate` |
| Q9 | Are all source, authorization and engineering gates preserved? | **YES** | no gate, check or expected test result was changed; regression-results.json | `forward/runtime/src/orchestrator/gates.ts`, `forward/runtime/src/pilot/gates.ts` |
| Q10 | What still prevents end-to-end execution? | **EXTERNAL** | trust store, signed disclosure authorization, PORTREAD G2 (12 findings), workflow state, live_execution.requested, runner and egress inside the boundary, F6 receipt for PORTREAD, generation authority for Build (blockers.json) | `forward/reports/bmad-end-to-end/blockers.json` |

## 2. Technical changes in this pass

| Change | Files |
|---|---|
| LIVE runner adapter. It refuses without a permitted recorded preflight, a recorded disclosure authorization and current hashes; builds a minimal workspace with the pinned workflow definition; runs Claude Code inside `sandbox.sh`; and returns outputs through the receipt validator. It is wired into `bmad governed-run`. | `runtime/src/bmad/runner.ts`, `runtime/src/commands/bmad.ts` |
| F2/F6 independent evidence in the verdict and the governed run: F2 is needed before architecture, F6 before review, and both for BMAD_COMPLIANT | `runtime/src/bmad/governance.ts`, `contracts/bmad/governed-run.schema.json` |
| BMad output consumption: verified LIVE drafts become optional, non-authoritative inputs of F3, F4, F5 and F7 dispatch packets | `runtime/src/orchestrator/orchestrator.ts`, `runtime/src/bmad/governance.ts` |
| Bypass closed: a new local-generation authorization (`pilot authorize`) needs BMad lifecycle evidence. Historical LGA records are unchanged. | `runtime/src/commands/pilot.ts`, `runtime/src/orchestrator/orchestrator.ts` (`bmadLifecycleEvidence`) |
| Controlled simulation: stage test doubles only with `simulation: true`. Results are never sealed and never BMAD_COMPLIANT. | `runtime/src/bmad/governance.ts` |
| `REVFORGE_RECONCILE_DEST`: a fresh reconciliation without overwriting earlier mappings | `tools/reverse-forward-reconcile.py` |
| 12 end-to-end tests | `tests/bmad-e2e.test.ts` |

## 3. Workflows for `programs:PORTREAD`

| Binding | Workflow | Agent | Gates | Installed | Eligible now |
|---|---|---|---|---|---|
| BMAD-PRD | `bmad-prd` | F1 | G2 | yes | False |
| BMAD-ARCH | `bmad-architecture` | F3 | G2 | yes | False |
| BMAD-EPICS | `bmad-create-epics-and-stories` | F4 | G2, G3 | yes | False |
| BMAD-SPRINT | `bmad-sprint-planning` | F4 | G2, G3, G4 | yes | False |
| BMAD-BUILD | `bmad-build` | F5 | G2, G3, G4 | yes | False |
| BMAD-REVIEW | `bmad-code-review` | F7 | G2, G3, G4, G5, G6 | yes | False |

## 4. Lifecycle (F1–F7)

| Stage | BMad | Integration | Gate |
|---|---|---|---|
| Reverse artefacts | - | the 11 reverse artefacts, verified unchanged by SHA-256 | provenance |
| Source and provenance validation | - | baseline manifest, source hashes, readiness gate | gate |
| F1 Requirements | bmad-prd (BMAD-PRD) | F1 drafts source-grounded requirements; BMAD-PRD renders the G2-approved requirements only | G2 |
| F2 Data mapping | none (independent) | accepted F2 deliveries per unit are required before architecture | independent |
| F3 Architecture | bmad-architecture (BMAD-ARCH) | F3 receives verified PRD drafts as optional inputs | G3 |
| F4 Epics, stories, sprint | bmad-create-epics-and-stories, bmad-sprint-planning | F4 receives PRD and architecture drafts; stories stay draft until G4 | G4 |
| Human approval gates | - | signed G2/G3/G4 approvals by trusted signers | gates |
| F5 Build + local converter | bmad-build (BMAD-BUILD) | F5 and the deterministic converter stay the implementation mechanism; Build needs authorised generation | G5 |
| F6 Independent testing | none (independent) | an accepted F6 receipt covering the scope is required before review | G6 |
| F7 Code review | bmad-code-review (BMAD-REVIEW) | reviews recorded implementation with the F6 receipt; reviewer is not the implementer | G7 |
| Final gates | - | G7/G8 and acceptance stay outside BMad | G8 |

## 5. PORTREAD pilot

| Item | Value |
|---|---|
| Governed run | BGR-0004 (LIVE): **BMAD_BLOCKED**, stopped at requirements by BPF-0013 (11 blockers) |
| F2 | ACCEPTED |
| F6 | MISSING |
| Java | COMPLETE {'PASS': 19, 'BLOCKED_AS_EXPECTED': 0, 'FAIL': 0, 'total': 19}: LOCAL_LGA_NOT_BMAD_GOVERNED, unchanged |

## 6. Regression (sequential)

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
| `node --test dist/tests/step6..9 + step21 + bmad-e2e + step16/17 (BMad, authorization, preflight, governance, r` | 0 | # tests 145 # pass 145 # fail 0  |
| `node dist/runtime/src/cli.js pilot integrate` | 0 | integrated 41 program(s), 15 job(s); excluded: POSUPDT (conversion FAILED: the source cannot be converted: missing PROGRAM-ID)   compilation: COMPILED (120 Java files)   runtime unit tests: {"PASS":34,"BLOCKED_AS_EXPECTED":0,"FAIL |
| `java -cp generated/java/app/classes revforge.cobol.testing.RuntimeTests` | 0 | SUMMARY/34/0/0 |
| `npm test` | 0 | ℹ tests 412 ℹ pass 412 ℹ fail 0 ℹ skipped 0  |
| `pilot validate` (42) | 41 exit 0 | POSUPDT (empty source) is the non-zero one |
| `pilot readiness` (42) | 6 PASS | unchanged |

**History:** when this assessment was first produced, `npm test` had 10 failures (398/408). All 10 came from repository state, not from this integration: commit `d26f4dd` made `forward/` tracked, which broke tests assuming no tracked `.java` and an untracked `forward/`. Commit `b3e7e86` fixed them (forward/reports/GIT-REGRESSION-STABILIZATION.md). The table above is the regression after that fix.

## 7. Final reconciliation (recalculated)

| Artifact | Counts |
|---|---|
| Programs | reverse_total 42, complete 2, partial 39, missing 1 |
| Business rules | reverse_total 154, IMPLEMENTED_VERIFIED_TO_GAP 15, IMPLEMENTED_NOT_EXERCISED 40, BLOCKED 32, IMPLEMENTED_VERIFIED 67 |
| Paragraphs | reverse_total 402, mapped 390, unmapped 12, executed_by_passing_tests 95 |
| Statements | reverse_total 1936, MAPPED 1337, GAP 599 |
| PERFORM edges | reverse_total 524, STRUCTURAL 397, GAP 127 |
| Branches | reverse_total 254, STRUCTURAL 190, GAP 64 |
| Loops | reverse_total 32, STRUCTURAL 26, GAP 6 |
| Fields | reverse_total 1009, CONSISTENT 966, NOT_REPRESENTED 43 |
| Records | reverse_total 231, REPRESENTED 196, NOT_REPRESENTED 35 |
| Level-88 conditions | reverse_total 259, TEST_VERIFIED 257, STRUCTURAL 2 |
| Copybooks | reverse_total 25, MODEL 13, COMPLETE_IN_PROGRAM 6, NOT_USED 6 |
| Diagrams | reverse_total 65, STRUCTURAL 33, UNMAPPABLE 5, PARTIAL 19, STRUCTURAL_ONLY 8 |
| JCL jobs | reverse_total 15, IMPLEMENTED_BLOCKED_AT_STEP 11, STEP_NOT_CONVERTED (utility) 1, IMPLEMENTED_TEST_VERIFIED 3 |
| External operations | reverse_total 99, IMPLEMENTED 12, GAP EXTERNAL_SYSTEM_BOUNDARY 78, DECLARATIVE (no run-time effect) 3, GAP UNDEFINED_EXTERNAL_CALL 2, GAP UNDECLARED_NAME 3, GAP UNTRANSLATED_STATEMENT 1 |
| Reverse gaps | reverse_total 217, STILL_UNRESOLVED 138, RECLASSIFIED_OR_GROUPED 42, RESOLVED_WITH_CODE_EVIDENCE 10, NOT_COMPARABLE 27 |
| Forward gaps | forward_total 391, RECLASSIFIED_OR_GROUPED 280, NEWLY_INTRODUCED_IN_FORWARD 81 |

Process-flow edges: 912 in total; 639 are supported by Java structure (unchanged).

**Master Gap Register:** 569 records (forward_gap 391, reverse_gap 174, verification_or_integration 4). By severity: medium 378, high 109, critical 8, low 74.

**Dashboard data:** `dashboard-bmad.json`.

## 8. Remaining external actions

| # | Responsible | Action |
|---|---|---|
| 1 | trust custodian (administrator) | provision the approval trust store with public keys (data_owner, requirements_approver, business_sme, technical_authority) |
| 2 | business_sme | resolve the PORTFLIO portfolio-status contradiction (DR-PORTMSTR-001, DR-PORTUPDT-001) and confirm REQ-PORTREAD-001/002 |
| 3 | technical_authority | source-verified evidence or signed adjudication for the PORTFLIO records, PORTREAD file operations and RT-PORTREAD-002/003 |
| 4 | requirements_approver | signed G2 approval for programs:PORTREAD at the current scope digest |
| 5 | data_owner | sign and import the disclosure request ADA-8154d6398d4d before it expires on 2026-11-06 (re-prepare it after that) |
| 6 | operator (F6) | dispatch F6 independent testing for PORTREAD and record its receipt |
| 7 | administrator | install pinned Node.js and Claude Code inside WSL2 and provide a verified provider-egress allowlist with the provider credential injected only into the runner |
| 8 | project owner | set live_execution.requested only after the above; authorise generation (flag, java_target_dir, G3/G4) before the implementation stage |

## 9. Compliance

| Criterion | Met | Evidence |
|---|---|---|
| All required BMad workflows mapped and executable | no | mapped and valid; none executable for any scope now |
| Valid authorization for the exact scope | no | no signed disclosure authorization; G2 not approved |
| Execution boundary verified | no | offline isolation tested; runner and provider egress absent |
| Actual BMad workflows executed | no | 0 |
| Real execution receipts validated | no | 0 |
| Outputs consumed by F1-F7 | no | wired (dispatch drafts); never demonstrated |
| F2 and F6 evidence incorporated | yes | required by the verdict and the governed run (PORTREAD: F2 accepted, F6 missing) |
| Existing engineering gates pass / unchanged | yes | regression-results.json |
| No unauthorized fallback | yes | fallback none; new LGA authorisations blocked; simulations never recorded |
