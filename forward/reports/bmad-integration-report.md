# BMad integration status

Generated 2026-11-01T03:36:39.540Z. Package `bmad-method@6.12.4`: staged and verified = **true**, installed = **false**.

## Release verification

| Check | Result | Detail |
|---|---|---|
| pin_record | PASS | bmad/release-pin valid (bmad-method@6.12.4, stable) |
| release_line | PASS | 6.12.4 on channel stable (stable 6.12 line required; previews and v7 are refused) |
| no_lifecycle_scripts | PASS | the pinned package declares no install-time lifecycle scripts |
| tarball_integrity | PASS | tarball sha256 4d66c201b6200c56… and npm sha512 integrity match the pin |
| extracted_files | PASS | 360 extracted file(s) match the pinned manifest (digest c69ee567f3741124…) |
| workflow_registry | PASS | 50 workflow definition(s) registered for bmad-method@6.12.4 |
| workflow_definitions | PASS | every registered workflow definition re-derived from the staged files and unchanged |
| repo_claude_skills_untouched | PASS | no BMad skill is installed in the repository .claude/skills |
| repo_bmad_config_absent | PASS | no _bmad/ directory at the repository root |
| repo_bmad_output_absent | PASS | no _bmad-output/ directory at the repository root |

## Bindings

| Binding | Workflow | Agent | Gates | Valid |
|---|---|---|---|---|
| BMAD-PRD | `bmad-prd` | F1 | G2 | yes |
| BMAD-ARCH | `bmad-architecture` | F3 | G2 | yes |
| BMAD-EPICS | `bmad-create-epics-and-stories` | F4 | G2, G3 | yes |
| BMAD-SPRINT | `bmad-sprint-planning` | F4 | G2, G3, G4 | yes |
| BMAD-BUILD | `bmad-build` | F5 | G2, G3, G4 | yes |
| BMAD-REVIEW | `bmad-code-review` | F7 | G2, G3, G4, G5, G6 | yes |

## Workflow records

Records intact: **true** (3 record(s)).

- Eligibility evaluations: 3 (0 eligible)
- Recorded dry runs: 0
- Packets: 0
- Receipts: 0 (0 accepted; none counts toward a gate)
- Refusals: 2
  - #184 bmad-prd MOCK programs:RTNCDE00: workflow_state: workflow state is REQUIREMENTS_DRAFTED; BMAD-PRD is allowed only in REQUIREMENTS_APPROVED, ARCHITECTURE_DRAFTED, ARCHITECTURE_APPROVED, STORIES_DRAFTED, STORIES_APPROVED; gate_G2: G2 has not passed on the current baseline; g2_reverified: G2 re-evaluated now: UNVERIFIED — G2 not approved for scope application: NOT_READY (395 blocking finding(s)); failing checks: canonical_rule_coverage, cross_batch_reconciliation, requirement_evidence, runtime_evidence, semantic_contradictions, contradicted_claims, blocking_decisions, data_contracts, scope_classification, readiness, trust_anchor, human_approval
  - #186 bmad-architecture LIVE programs:RTNCDE00: workflow_state: workflow state is REQUIREMENTS_DRAFTED; BMAD-ARCH is allowed only in REQUIREMENTS_APPROVED, ARCHITECTURE_DRAFTED; gate_G2: G2 has not passed on the current baseline; g2_reverified: G2 re-evaluated now: UNVERIFIED — G2 not approved for scope application: NOT_READY (395 blocking finding(s)); failing checks: canonical_rule_coverage, cross_batch_reconciliation, requirement_evidence, runtime_evidence, semantic_contradictions, contradicted_claims, blocking_decisions, data_contracts, scope_classification, readiness, trust_anchor, human_approval
