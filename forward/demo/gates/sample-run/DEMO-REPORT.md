# Synthetic G0–G8 gate demonstration report

> **Environment: SYNTHETIC_INTERVIEW_DEMO.** This report is about one synthetic example program. It grants no production authorisation, records no real approval and executes no BMad workflow. The real modernization status is listed at the end and is unchanged.

**Verdict: SYNTHETIC_DEMO_ACCEPTED**

| Field | Value |
|---|---|
| Demo run | `DEMO-20261106T012948Z-6fd7` |
| Started / finished | 2026-11-06T01:29:48.917Z / 2026-11-06T01:29:54.169Z |
| production_authorization | NOT_GRANTED |
| real_bmad_execution | NOT_EXECUTED |
| legacy_equivalence | NOT_ESTABLISHED |
| Environment | Node v22.12.0, win32 x64; javac 21.0.13.0.2 |
| Output directory | `forward/demo/gates/runs/DEMO-20261106T012948Z-6fd7` |

## Baseline

| File | SHA-256 |
|---|---|
| `source/DEMOORD1.cbl` (synthetic COBOL) | `f8e365894768f8ecb1054a78f7ac8c9b92143461edb718e4a1a95e74c1582d82` |
| `reverse/reverse-evidence.json` (synthetic reverse-engineering evidence) | `44554ec8643a2bf4554d42617d1edb7a0e308620be95aaea2602f6770feba8d0` |
| `requirements/requirements.json` (requirements) | `947822e721167f4efa658ce8cd4977b113453743dd2f87fc12b0b5594fa64be8` |
| `requirements/data-contract.json` (data contract) | `8ca544aa13201df7e753fa00d661925f256b4495c6dff7ecb809674414e11856` |
| `design/architecture.json` (architecture specification) | `67e443d90ba6041f42f3b650151bcb015a4bd8ac6bf6123cc6e8f5a95281f01b` |
| `design/development-plan.json` (development plan) | `66be58bb390b27e49de2e8ff3389f26517e21ebaaa6dd93f82424d62889610c4` |
| `tests/functional-tests.json` (functional and boundary test fixtures) | `8d8f8b4190cef5984efacb1a388c9870bf51deeedd1b07fea55ad4c6da4c7772` |
| `baseline.json` | `c72c400a47739cef1cc89a05ab275bc6c2fbab443efb5aa7892e010ef0f5be75` |

## Gate results

| Gate | Result | Checks | Responsibility | Approval evidence |
|---|---|---|---|---|
| G0 Baseline Integrity | **DEMO PASS** | 6/6 | runtime: deterministic integrity checks of the synthetic baseline | none (automatic check) |
| G1 Evidence Verification | **DEMO PASS** | 10/10 | runtime: re-parses the synthetic COBOL and verifies the synthetic reverse evidence (reverse agents 1-5 analogue) | none (automatic check) |
| G2 Requirements Approval | **DEMO PASS** | 18/18 | synthetic F1 requirements and F2 data contract; approved by the synthetic demo authority | Ed25519 demo approval, role demo_requirements_approver |
| G3 Architecture Approval | **DEMO PASS** | 17/17 | synthetic F3 architecture; approved by the synthetic demo authority | Ed25519 demo approval, role demo_architecture_approver |
| G4 Development Plan Approval | **DEMO PASS** | 18/18 | synthetic F4 stories and acceptance criteria; approved by the synthetic demo authority | Ed25519 demo approval, role demo_planning_approver (demo planning only, never Java generation authorisation) |
| G5 Java Build and Tests | **DEMO PASS** | 11/11 | deterministic local converter (F5 analogue, no AI agent); javac -Werror; TestMain functional and boundary scenarios | none (executed build and test evidence) |
| G6 Independent Verification | **DEMO PASS** | 9/9 | independent specification oracle (F6 analogue) written from the requirements only | none (executed comparison evidence) |
| G7 Independent Review | **DEMO PASS** | 12/12 | independent review checks (F7 analogue) by synthetic-demo-reviewer | none (structured review result) |
| G8 Synthetic Acceptance | **DEMO PASS** | 15/15 | synthetic demo authority (not a business owner or production approver) | Ed25519 demo acceptance, role demo_acceptance_authority |

### G0 Baseline Integrity: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| baseline_contract | pass | baseline.json satisfies demo/baseline |
| source_present | pass | source/DEMOORD1.cbl (3990 bytes) |
| source_hash | pass | SHA-256 f8e365894768f8ecb1054a78f7ac8c9b92143461edb718e4a1a95e74c1582d82 matches the recorded baseline |
| required_inputs | pass | 6 required inputs present with their recorded SHA-256 |
| no_unexpected_files | pass | the synthetic input tree holds exactly the baselined files |
| isolated_output | pass | demo run directory forward/demo/gates/runs/DEMO-20261106T012948Z-6fd7 is outside the real workflow runs and the inputs |

Evidence: `baseline.json`, `source/DEMOORD1.cbl`

### G1 Evidence Verification: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| prerequisite | pass | G0 PASS on this baseline (result 7e695ee2643e…) |
| reverse_contract | pass | reverse/reverse-evidence.json satisfies demo/reverse-evidence |
| source_parses | pass | the COBOL parses deterministically (DEMOORD1, 4 paragraphs) |
| file_identity | pass | SYN-DEMO-FIL-0001 source/DEMOORD1.cbl DEMOORD1: hash matches the source |
| paragraphs_match_source | pass | 4 paragraphs match name and line range |
| statements_match_source | pass | 31 statements match line, paragraph and verb |
| fields_match_source | pass | 13 fields match name, offset and length |
| ids_unique | pass | 62 synthetic identities, 62 distinct |
| references_resolve | pass | every statement, field and rule reference resolves, and every rule names the lines of its statements |
| rules_trace_every_statement | pass | 10 rules trace all 31 statements |

Evidence: `reverse/reverse-evidence.json`

### G2 Requirements Approval: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| prerequisite | pass | G1 PASS on this baseline (result e3c2fd046392…) |
| requirements_contract | pass | requirements/requirements.json satisfies demo/requirements |
| dataContract_contract | pass | requirements/data-contract.json satisfies demo/data-contract |
| rules_covered_by_requirements | pass | all 10 business rules are covered by 8 requirements |
| worked_examples | pass | 10 worked examples cover every calculation and validation requirement |
| uncertainties_documented | pass | 5 uncertainties documented (4 resolved, 1 accepted limitation), none blocking |
| data_contract_matches_source | pass | LS-ORDER 77 bytes vs parsed LS-ORDER 77 bytes; 9 interface fields match name, offset and length |
| approval_present | pass | approvals/G2.approval.json |
| approval_contract | pass | satisfies demo/approval |
| approval_gate_and_decision | pass | gate G2, decision approved |
| approval_subject_bound | pass | binds requirements_package e152b6260ccc369b… (the current content) |
| approval_run_and_baseline_bound | pass | run DEMO-20261106T012948Z-6fd7, baseline c72c400a4773… |
| approval_prior_gates_bound | pass | binds the PASS results of G0, G1 |
| approval_synthetic_signer | pass | synthetic-demo-authority (SYNTHETIC_DEMO_AUTHORITY): a synthetic demo authority, not a real stakeholder |
| approval_role | pass | signed in the role demo_requirements_approver |
| approval_not_production | pass | production_authorization: NOT_GRANTED |
| approval_signature | pass | Ed25519 signature by synthetic-demo-authority (role demo_requirements_approver, key 23b77c1dadb72838…) verifies against the demo trust store |
| approval_not_in_real_trust_store | pass | the real trust store does not accept it (real trust store not configured) |

Evidence: `requirements/requirements.json`, `requirements/data-contract.json`, `approvals/G2.approval.json`

### G3 Architecture Approval: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| prerequisite | pass | G2 PASS on this baseline (result e4a979316662…) |
| architecture_contract | pass | design/architecture.json satisfies demo/architecture |
| references_accepted_requirements | pass | requirements 947822e72116…, data contract 8ca544aa1320… (must equal the G2-approved content) |
| requirements_allocated | pass | every requirement is allocated to a component |
| dependencies_documented | pass | 3 component dependencies, all resolvable |
| decisions_documented | pass | 3 architecture decisions, each tied to requirements |
| approval_present | pass | approvals/G3.approval.json |
| approval_contract | pass | satisfies demo/approval |
| approval_gate_and_decision | pass | gate G3, decision approved |
| approval_subject_bound | pass | binds architecture 67e443d90ba6041f… (the current content) |
| approval_run_and_baseline_bound | pass | run DEMO-20261106T012948Z-6fd7, baseline c72c400a4773… |
| approval_prior_gates_bound | pass | binds the PASS results of G0, G1, G2 |
| approval_synthetic_signer | pass | synthetic-demo-authority (SYNTHETIC_DEMO_AUTHORITY): a synthetic demo authority, not a real stakeholder |
| approval_role | pass | signed in the role demo_architecture_approver |
| approval_not_production | pass | production_authorization: NOT_GRANTED |
| approval_signature | pass | Ed25519 signature by synthetic-demo-authority (role demo_architecture_approver, key 23b77c1dadb72838…) verifies against the demo trust store |
| approval_not_in_real_trust_store | pass | the real trust store does not accept it (real trust store not configured) |

Evidence: `design/architecture.json`, `approvals/G3.approval.json`

### G4 Development Plan Approval: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| prerequisite | pass | G3 PASS on this baseline (result 8125e5fec99b…) |
| plan_contract | pass | design/development-plan.json satisfies demo/development-plan |
| references_approved_design | pass | requirements 947822e72116…, architecture 67e443d90ba6… |
| stories_trace_requirements | pass | 4 stories cover all 8 requirements |
| acceptance_criteria | pass | 10 acceptance criteria and 7 tasks |
| epics_consistent | pass | 1 epic(s) hold exactly the 4 stories |
| not_generation_authorisation | pass | plan: java_generation_authorization NOT_GRANTED; real configuration generation.java_generation_allowed is false (unchanged) |
| approval_present | pass | approvals/G4.approval.json |
| approval_contract | pass | satisfies demo/approval |
| approval_gate_and_decision | pass | gate G4, decision approved |
| approval_subject_bound | pass | binds development_plan 66be58bb390b27e4… (the current content) |
| approval_run_and_baseline_bound | pass | run DEMO-20261106T012948Z-6fd7, baseline c72c400a4773… |
| approval_prior_gates_bound | pass | binds the PASS results of G0, G1, G2, G3 |
| approval_synthetic_signer | pass | synthetic-demo-authority (SYNTHETIC_DEMO_AUTHORITY): a synthetic demo authority, not a real stakeholder |
| approval_role | pass | signed in the role demo_planning_approver |
| approval_not_production | pass | production_authorization: NOT_GRANTED |
| approval_signature | pass | Ed25519 signature by synthetic-demo-authority (role demo_planning_approver, key 23b77c1dadb72838…) verifies against the demo trust store |
| approval_not_in_real_trust_store | pass | the real trust store does not accept it (real trust store not configured) |

Evidence: `design/development-plan.json`, `approvals/G4.approval.json`

### G5 Java Build and Tests: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| prerequisite | pass | G4 PASS on this baseline (result a95cfbdafcdc…) |
| java_21_toolchain | pass | javac 21.0.13.0.2 (REVFORGE_JAVA_HOME) |
| converter_inspection | pass | the local converter parsed DEMOORD1 |
| no_open_gaps | pass | the converter translated every statement without a gap placeholder |
| source_to_java_traceability | pass | all 31 synthetic statement IDs map to Java lines |
| compiled | pass | javac exit 0 (-Werror), 34 class files |
| test_harness_completed | pass | TestMain exit 0; SUMMARY\|22\|0\|0 |
| generated_checks | pass | 6/6 VALUE-clause and level-88 checks passed |
| functional_tests | pass | 16/16 functional scenarios passed |
| boundary_tests | pass | 9/9 boundary scenarios passed |
| requirements_tested | pass | every requirement has at least one passing scenario |

Evidence: `g5/generation.json`, `g5/source-map.json`, `g5/traceability.json`, `g5/build.json`, `g5/functional-results.json`

### G6 Independent Verification: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| prerequisite | pass | G5 PASS on this baseline (result f3cd98da1509…) |
| oracle_independent | pass | the oracle module (oracle.js, sha256 a915cec4541e…) loads no other module: it cannot call the converter, the Java or the runtime |
| oracle_matches_requirement_examples | pass | the oracle reproduces all 10 worked examples of the requirements |
| java_is_g5_build | pass | 34 class files unchanged since G5 |
| comparison_executed | pass | TestMain exit 0; SUMMARY\|314\|0\|0; 308 cases run |
| java_matches_oracle | pass | all 308 cases match the oracle |
| boundary_cases | pass | 44/44 boundary cases match |
| negative_cases | pass | 112/112 negative cases match |
| requirements_exercised | pass | every requirement is exercised by oracle cases (outputs preset with caller garbage in every case) |

Evidence: `g6/oracle-cases.json`, `g6/oracle-fixture.json`, `g6/comparison-results.json`

**Establishes:** The generated Java returns the same subtotal, discount, shipping, total and return code as an independent oracle written from the requirements, on every listed input (boundary, negative, seeded random and worked examples).

**Does not establish:** Equivalence with an executed COBOL program: no COBOL runtime was executed in this demonstration, so legacy behavioural equivalence is NOT_ESTABLISHED.

### G7 Independent Review: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| prerequisite | pass | G6 PASS on this baseline (result faa75a28a6fa…) |
| gate_results_intact | pass | G0-G6 result files match their recorded SHA-256 |
| test_evidence_integrity | pass | 18 evidence files re-hashed, all unchanged |
| requirements_coverage | pass | each of 8 requirements has a story, passing functional tests and matching oracle cases |
| traceability_complete | pass | every rule traces rule -> requirement -> story -> Java statements -> passing tests |
| build_evidence | pass | javac exit 0, 34 class files, javac 21.0.13.0.2 |
| no_unexplained_behaviour | pass | the Java that was built and tested is exactly the converter output; every Java statement maps to a COBOL line |
| no_fabricated_behaviour | pass | 31 Java statement mappings all point to recorded COBOL statements; no gap placeholders |
| inputs_unchanged | pass | synthetic source and inputs still match the baseline; no file was added or changed |
| real_configuration_unchanged | pass | forward.config.json unchanged; generation.java_generation_allowed false; bmad_governance.mandatory true |
| real_records_untouched | pass | the real workflow runs and the reverse-engineering artifacts were not modified by this run |
| separation_of_duties | pass | implementer deterministic-local-converter; test authors: hand-written fixtures (G5) and the independent oracle (G6); reviewer synthetic-demo-reviewer; approver synthetic-demo-authority |

Evidence: `gates/G7.review.json`

### G8 Synthetic Acceptance: DEMO PASS

| Check | Result | Detail |
|---|---|---|
| prerequisite | pass | G7 PASS on this baseline (result d495e63232a5…) |
| approval_present | pass | approvals/G8.approval.json |
| approval_contract | pass | satisfies demo/approval |
| approval_gate_and_decision | pass | gate G8, decision approved |
| approval_subject_bound | pass | binds review_result a87bbf4e2839bc05… (the current content) |
| approval_run_and_baseline_bound | pass | run DEMO-20261106T012948Z-6fd7, baseline c72c400a4773… |
| approval_prior_gates_bound | pass | binds the PASS results of G0, G1, G2, G3, G4, G5, G6, G7 |
| approval_synthetic_signer | pass | synthetic-demo-authority (SYNTHETIC_DEMO_AUTHORITY): a synthetic demo authority, not a real stakeholder |
| approval_role | pass | signed in the role demo_acceptance_authority |
| approval_not_production | pass | production_authorization: NOT_GRANTED |
| approval_signature | pass | Ed25519 signature by synthetic-demo-authority (role demo_acceptance_authority, key 23b77c1dadb72838…) verifies against the demo trust store |
| approval_not_in_real_trust_store | pass | the real trust store does not accept it (real trust store not configured) |
| g0_to_g7_passed | pass | G0-G7 all PASS for this demo baseline |
| evidence_complete | pass | 19 evidence files present and unchanged |
| no_unresolved_critical_findings | pass | review decision PASS; 0 unresolved critical finding(s) |

Evidence: `approvals/G8.approval.json`

**Acceptance:** SYNTHETIC_DEMO_ACCEPTED. Accepted by a synthetic demo authority for the synthetic example only. Not business-owner, production or real-project acceptance.

## Build and tests

- Compiler: javac 21.0.13.0.2; exit code 0; 34 class files (javac -Werror).
- Functional scenarios: 16/16 passed (9 boundary); 6 generated VALUE/level-88 checks.
- Independent oracle: 308/308 cases matched (44 boundary, 112 negative, 142 seeded, 10 worked examples; seed 20261105).

## BMad lifecycle (SIMULATED)

Release bmad-method@6.12.4; mandatory in the real configuration: true. Live execution: **NOT_EXECUTED**. Counted as BMad execution: 0 of 6.

| Binding | Workflow | Agent | Forward activity | Demo gate | Mode | Demo preflight | Real receipt counter |
|---|---|---|---|---|---|---|---|
| BMAD-PRD | bmad-prd | F1 | requirements (F1) -> PRD rendering of the approved requirements | G2 | SIMULATED | WOULD_BE_ELIGIBLE_IN_DEMO | SIM-DEMO-20261106T012948Z-6fd7-BMAD-PRD is a SIMULATED receipt (MOCK_NOT_EVIDENCE): never BMad execution evidence |
| BMAD-ARCH | bmad-architecture | F3 | architecture (F3) | G3 | SIMULATED | WOULD_BE_ELIGIBLE_IN_DEMO | SIM-DEMO-20261106T012948Z-6fd7-BMAD-ARCH is a SIMULATED receipt (MOCK_NOT_EVIDENCE): never BMad execution evidence |
| BMAD-EPICS | bmad-create-epics-and-stories | F4 | epics and stories (F4) | G4 | SIMULATED | WOULD_BE_ELIGIBLE_IN_DEMO | SIM-DEMO-20261106T012948Z-6fd7-BMAD-EPICS is a SIMULATED receipt (MOCK_NOT_EVIDENCE): never BMad execution evidence |
| BMAD-SPRINT | bmad-sprint-planning | F4 | sprint planning (F4) | G4 | SIMULATED | WOULD_BE_ELIGIBLE_IN_DEMO | SIM-DEMO-20261106T012948Z-6fd7-BMAD-SPRINT is a SIMULATED receipt (MOCK_NOT_EVIDENCE): never BMad execution evidence |
| BMAD-BUILD | bmad-build | F5 | implementation (F5; here the deterministic converter) | G5 | SIMULATED | WOULD_BE_ELIGIBLE_IN_DEMO | SIM-DEMO-20261106T012948Z-6fd7-BMAD-BUILD is a SIMULATED receipt (MOCK_NOT_EVIDENCE): never BMad execution evidence |
| BMAD-REVIEW | bmad-code-review | F7 | code review (F7) | G7 | SIMULATED | WOULD_BE_ELIGIBLE_IN_DEMO | SIM-DEMO-20261106T012948Z-6fd7-BMAD-REVIEW is a SIMULATED receipt (MOCK_NOT_EVIDENCE): never BMad execution evidence |

G6-G8 stay outside BMad, as in the real design. Real governed workflow: BMAD_BLOCKED (unchanged: no LIVE receipt exists).

## Negative paths

The demo test suite (`forward/tests/synthetic-gate-demonstration.test.ts`) runs the demonstration with injected defects and checks that each one is blocked at the right gate with a diagnostic and a nonzero exit code. Run it with `npm run demo:test`.

## Real project status (read-only, unchanged)

| Item | Value |
|---|---|
| generation.java_generation_allowed | false |
| bmad_governance.mandatory | true |
| approval.trust_store | null (not configured) |
| Real workflow gates | G0 PASS, G1 PASS, G2 UNVERIFIED, G3 BLOCKED, G4 BLOCKED, G5 BLOCKED, G6 BLOCKED, G7 BLOCKED, G8 BLOCKED |
| Master gap register | 569 records, 569 OPEN |
| Business-rule identities | 154 |
| Real BMad execution | NOT_EXECUTED (no LIVE receipt) |
| Legacy equivalence | NOT_ESTABLISHED |
| Production readiness | NOT_PRODUCTION_READY |
| Engineering quality gates | SOURCE_READINESS and CONVERSION_VALIDATION (pilot/gates.ts) are unchanged and separate from the demo gates |

## Limitations

- Synthetic interview demonstration only: one small synthetic program, synthetic evidence and a synthetic demo authority.
- Demo approvals are signed with an ephemeral key created for this run; they are not real human, business-owner or production approvals.
- production_authorization is NOT_GRANTED: no real gate, approval, receipt or Java generation authorisation was created or changed.
- BMad lifecycle steps are SIMULATED; no BMad workflow was executed and real mandatory BMad execution remains blocked.
- G6 compares the Java with an independent specification oracle; no COBOL runtime was executed, so legacy equivalence is NOT_ESTABLISHED.
- The real modernization is unchanged: real G2 is UNVERIFIED and G3-G8 BLOCKED, the gap register stays OPEN, and the project is not production ready.
