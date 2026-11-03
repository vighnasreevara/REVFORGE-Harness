# P200 behaviour scope: unsigned approval prerequisites

**Status: NOT_READY (2 blocking). G2: UNVERIFIED. Trust: TRUST_NOT_CONFIGURED.** Nothing is signed or approved.

| | |
|---|---|
| Scope | `behaviour:RTNCDE00:P200-SET-RETURN-CODE:requirement=REQ-RTNCDE00-002,requirement=REQ-RTNCDE00-003,runtime_requirement=RT-RTNCDE00-001` |
| Scope digest | `4e205c3d74de80ad3ae110ffd0d352715eb7bce6c662c8be4a7e403097055219` |
| Program scope (for comparison) | `programs:RTNCDE00`, NOT_READY, 8 blocking, digest `3c8aa823…` |
| Review package | `review-package-behaviour_RTNCDE00_P200_…{json,md}` |

**Requirement content hashes:**

| Item | sha256 |
|---|---|
| REQ-RTNCDE00-002 | `88a2aeb7…` |
| REQ-RTNCDE00-003 | `ec665cc5…` |
| RT-RTNCDE00-001 | `df9759ab…` |

## Decisions needed for this subset (fresh unsigned requests, expire 2026-11-09)

| Decision | Role | Current evidence | Request |
|---|---|---|---|
| RVW-REQ-RTNCDE00-002 | `business_sme` (or `exception_approver`) | EAR-0002 invalidated the earlier verification: the `'S'` was found only inside the data name RC-HIGHEST-CODE. REQ-002 specifies P200's current-code and highest-code outputs, so **excluding it leaves those outputs unspecified** (the scope would then report REQ-002 as a missing required item and BR-039 as an omitted rule; tested). The paths are `resolved_requires_update` (cite the supporting statements, revise through `workflow correct`) or `approved_exception`. | `DRQ-a25fb8eb7a96` |
| RVW-REQ-RTNCDE00-003 | `business_sme` (or `exception_approver`) | ESU-0002 is current and CONTEXT_SUPPORTED; EAR-0003 is SOURCE_CHAIN_VERIFIED. The S/W/E/F values are declared at RTNCODE.cpy lines 17–20. Acceptance means `resolved_no_change` selecting ESU-0002. | `DRQ-cab3ba15ddb8` |

**Not needed for this subset:**
- **Excluded by the dependency analysis:** DR-DB2CONN-002, DR-F2-0011-001, RVW-REQ-RTNCDE00-004, DR-RTNCDE00-001, DR-F2-0005-009. Each still applies to the program scope and every other affected scope.
- **Advisory, applicable but non-blocking:** DR-F2-0005-010 (caller interface contract), DR-F2-PKT0010-002 (code page), RVW-GAP-092, RVW-GAP-104.

## Order of actions

1. **Key custodian:** trust store with real signers for `business_sme`, `exception_approver` and `requirements_approver` (one identity per person). `trust doctor` must report TRUST_CONFIGURED.
2. **Business SME** (outside REVFORGE): sign RVW-REQ-RTNCDE00-003 and RVW-REQ-RTNCDE00-002. The operator then runs `decisions verify-resolution` / `decisions import-resolution`, and applies the REQ-002 revision if one is chosen.
3. **Operator:** `approval scope --scope <scope>`. The content hashes and digest will change; the scope must be READY.
4. **Operator:** `approval export-request --scope <scope> --requested-by <operator>`. This binds the closure, items, decisions and gaps.
5. **Requirements approver** (not the requester): sign; then `approval verify` / `approval import`; `workflow gate --gate G2`.

**What G2 PASS covers:** P200 only. A subset approval approves nothing else in RTNCDE00 (tested). Program G2 still needs everything in `programs:RTNCDE00`.
