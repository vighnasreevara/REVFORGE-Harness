# G2 approval checklist: `programs:RTNCDE00`

**Generated:** 2026-11-01, from `approval readiness --scope programs:RTNCDE00` (sealed `operations/g2-approval-readiness-0001`; machine-readable: `approval-readiness.json`).

**Current position:**

| Item | Value |
|---|---|
| Scope digest | `88d8562c1b30170f33446a43303d54d47fd102ec25c3d79249749d6dfd126f13` |
| Baseline | `352b97f0…4d24a068` |
| Scope readiness | NOT_READY (5 blocking findings) |
| G2 | UNVERIFIED |
| Trust | **TRUST_NOT_CONFIGURED** |

| # | Actor | Action | Status |
|---|---|---|---|
| 1 | Key custodian | Provision the external trust store with real signers: `requirements_approver`, `business_sme`, `technical_authority`, `exception_approver`, `product_owner`, `architecture_approver`, `story_approver`, `data_owner`. Validate with `trust doctor --file`. | PENDING |
| 2 | `business_sme` (decision RVW-REQ-RTNCDE00-004) | Review RP-8d2dd33787: citation line 121 → 122 for REQ-RTNCDE00-004. Re-verified today. If correct, sign `resolved_requires_update` with `selected_option = RP-8d2dd33787`, then apply it with `workflow correct … --kind citation_line`. | PENDING |
| 3a | `technical_authority` | DR-DB2CONN-002: may the design assume standard DB2 SQLCODE semantics? Cross-scope: DB2CMT, DB2CONN, HISTLD00, RTNANA00, RTNCDE00. | BLOCKED (no signer) |
| 3b | `technical_authority` | DR-F2-0011-001: where does the real SQLCA layout come from? Shared by 15 DB2 program scopes. | BLOCKED (no signer) |
| 3c | `business_sme` or `exception_approver` | RVW-REQ-RTNCDE00-003: decide whether the severe status value `'F'` is established. The dossier shows it is the VALUE of 88 RC-STATUS-SEVERE (`RTNCODE.cpy:20`), which the cited EVALUATE sets at line 78. | BLOCKED (no signer) |
| 4 | Operator | Re-evaluate after each import or correction (`approval readiness`). Resolutions bound to changed content are rejected and must be re-requested. | PENDING |
| 5 | Operator | `approval export-request --scope programs:RTNCDE00 --requested-by <operator>` (only when READY) | BLOCKED |
| 6 | `requirements_approver` (not the requester) | Sign the approval statement outside REVFORGE. | BLOCKED |
| 7 | Operator | `approval verify` / `approval import`, then `workflow gate --gate G2` | BLOCKED |
| 8 | Operator | `workflow advance --to REQUIREMENTS_APPROVED` (the only allowed next transition; guard G2) | BLOCKED |

**Requirement content hashes (what an approval would bind):**

| Requirement | Hash | Status |
|---|---|---|
| REQ-RTNCDE00-001 | `70a3b283f57b…` | REQUIRES_SME_DECISION |
| REQ-RTNCDE00-002 | — | VERIFIED |
| REQ-RTNCDE00-003 | `ec665cc58b23…` | REQUIRES_EVIDENCE |
| REQ-RTNCDE00-004 | `0ac2f6b674b5…` | CONTRADICTED; changes when the correction is applied |

The full list, including the runtime requirements, is in `approval-readiness.json`.

**Unsigned resolution requests**, bound to scope, baseline, item hashes and expiry (2026-11-08):
- `resolution-requests/DR-DB2CONN-002.request.json`
- `resolution-requests/DR-F2-0011-001.request.json`
- `resolution-requests/RVW-REQ-RTNCDE00-003.request.json`
- `resolution-requests/RVW-REQ-RTNCDE00-004.request.json` (`DRQ-8833eafb100b`)

**Readiness is not approval.** G2 passes only on a re-verified signed approval by a requirements approver.
