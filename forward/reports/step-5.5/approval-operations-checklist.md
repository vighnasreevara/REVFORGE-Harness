# Approval operations checklist — programs:RTNCDE00

13 actions (1 done, 7 pending, 4 blocked). Human workload: 3 root cause(s) covering 4 decision(s); every original decision is kept.

| # | Actor | Action | IDs | Role | Status | Depends on | Verified by |
|---|---|---|---|---|---|---|---|
| 1 | claude_code | Prepare the scope recommendation, evidence package, decision packets, correction review, pilot and this checklist |  | runtime (no authority) | done |  | `workbench report (sealed records in workflow/step55)` |
| 2 | key_custodian | Provision the external trust store with public keys for every role this scope needs; set REVFORGE_APPROVAL_TRUST_STORE or approval.trust_store | business_sme, exception_approver, requirements_approver, technical_authority | organizational key custodian | pending |  | `workbench trust => TRUST_CONFIGURED` |
| 3 | data_owner | Optional pilot: review and sign the source-export authorization for the prepared cases, then the operator imports it | OAV-EVD-af66b09e34 | data_owner | pending | 2 | `verification openai doctor => authorization VALID` |
| 4 | claude_code | Optional pilot: run LIVE review and compare on the authorized cases; route advisory records to the review queue | OAV-EVD-af66b09e34 | operator | blocked | 3 | `verification openai report (LIVE_EXECUTED_WITH_VERIFIED_AUTHORIZATION)` |
| 5 | technical_reviewer | Review the citation correction proposals; if correct, sign the item review decision (resolved_requires_update, selected_option = proposal) and apply the correction | RP-8d2dd33787 (RVW-REQ-RTNCDE00-004) | business_sme | pending | 2 | `workflow decisions list (resolved) and a new COR record` |
| 6 | technical_reviewer | Confirm the technical facts established from source (class A) and sign the corresponding review decisions | RVW-REQ-RTNCDE00-004 | technical_authority / business_sme per decision | pending | 2, 5 | `workflow decisions resolve; workflow g2 evaluate --scope` |
| 7 | technical_authority | Decide the technical / architecture questions (class D) | DR-DB2CONN-002, DR-F2-0011-001 | technical_authority | pending | 2 | `workflow decisions list --scope` |
| 8 | business_sme | Confirm, correct or exclude the interpretations that need independent review and business judgment (classes B and C), using the pilot results only as advisory input | RVW-REQ-RTNCDE00-003 | business_sme (exception_approver for approved_exception) | pending | 2, 4 | `workflow decisions list --scope` |
| 9 | technical_reviewer | Supply or account for missing source / runtime dependencies (class E) |  | technical_authority | not_applicable |  | `verification source deterministic` |
| 10 | claude_code | Re-evaluate the scope after the signed actions; if deliverables changed, re-run consolidation and verification first | programs:RTNCDE00 | runtime (no authority) | pending | 5, 6, 7, 8, 9 | `workflow g2 evaluate --scope programs:RTNCDE00` |
| 11 | operator | Export the approval request for the READY scope | programs:RTNCDE00 | operator (requester, not the approver) | blocked | 10 | `workflow approval request --scope programs:RTNCDE00 --requested-by <operator>` |
| 12 | requirements_approver | Review the request and sign the approval statement; the operator imports it | AREQ (to be created) | requirements_approver (not the requester) | blocked | 2, 11 | `workflow approval import (all checks ok)` |
| 13 | claude_code | Evaluate G2 and request the transition | G2 | runtime | blocked | 12 | `workflow gate --gate G2; workflow advance --to REQUIREMENTS_APPROVED` |

## Consolidated human workload (by root cause)

| Root cause | Class | Decisions | Roles |
|---|---|---|---|
| RC-CIT-fd279b78dd Citation of REQ-RTNCDE00-004 contradicted by the source | A | RVW-REQ-RTNCDE00-004 | business_sme |
| RC-EVD-af66b09e34 requirement evidence of RTNCDE00 not established (unconfirmed_claim) | B | RVW-REQ-RTNCDE00-003 | business_sme |
| RC-SRC-3b9f4685e9 CIRCULAR_COPY GAP-002: Copybook SQLCA includes itself (circular copy) | D | DR-DB2CONN-002, DR-F2-0011-001 | technical_authority |
