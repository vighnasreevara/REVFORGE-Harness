# RTNCDE00: decision package (Step 11 refresh)

**Status: NOT_APPROVED. G2: UNVERIFIED. Trust: TRUST_NOT_CONFIGURED.**

The full package is in [`review-package-programs_RTNCDE00.md`](review-package-programs_RTNCDE00.md) (regenerated 2026-11-02 from the current records; the workflow audit stayed at 254). This addendum adds the current hashes, the signing order and the Step 11 planning view.

## Current identity

| | |
|---|---|
| Scope digest | `bd0fcf24e958fffd47175318ffdc6805b60b97194b304809915eebea4201113a` |
| Baseline manifest | `352b97f0bbcbdb149c1118791aaabaa2e8e9972716bc77adc3a2f0644d24a068` |

| Requirement | Item sha256 |
|---|---|
| REQ-RTNCDE00-001 | `70a3b283f57b4ad031f3f4f6493b33d8cccda01184ab7ba117214bf245cc9c5e` |
| REQ-RTNCDE00-002 | `88a2aeb73bc02e2ecc83895f0da65046b7238dd597036a28e222c7ecddf217de` |
| REQ-RTNCDE00-003 | `ec665cc58b23e4e018cd684d7e7eb95f38767f28db156d80ca4cea4c30b1a28c` |
| REQ-RTNCDE00-004 | `0ac2f6b674b57cdeceab63b1845884a51dc70e50d0eccdbaf9ab57f1a5292269` |
| RT-RTNCDE00-001 | `df9759abc7f29462422df7513c5253527a83e18c5525b4450802ee6db6ef4e60` |
| RT-RTNCDE00-002 | `ba25007532f27658e7138af4bd55952c7a3647e4ded4bac7cf62378fb03af17a` |
| RT-RTNCDE00-003 | `9e704b8a16d5f43dfad07e0a07abdee815875185fbd006ac42162b939ad26a31` |

## The five open decisions, in signing order

| # | Decision | Signer role | Evidence | Remediation available | Fresh unsigned request (expires 2026-11-09) |
|---|---|---|---|---|---|
| 1 | **DR-DB2CONN-002**: which SQLCA, and the meaning of SQLCODE | `technical_authority` | `SQLCA.cpy` line 6 includes itself; it declares only `SQL-STATUS-CODES` (7 VALUEs). SQLCODE is used by 14 programs and SQLERRMC by 2, and neither is declared anywhere. Affects 5 units, 9 requirements, 5 scopes. | none (needs external facts: the real SQLCA member and DB2 version) | `DRQ-8a46d20a555f` |
| 2 | **DR-F2-0011-001**: the SQLCA layout source | `technical_authority` | same facts; 15 program scopes | none | `DRQ-5a06c97411d1` |
| 3 | **RVW-REQ-RTNCDE00-004**: contradicted citation | `business_sme` | cited line 121 is outside the SELECT (122–133) | **RP-8d2dd33787** (121 → 122), re-verified; supports the claim after correction | `DRQ-91faa5b8863b` |
| 4 | **RVW-REQ-RTNCDE00-003**: accept the evidence | `business_sme` (or `exception_approver`) | `ESU-0002` current and CONTEXT_SUPPORTED; `EAR-0003` SOURCE_CHAIN_VERIFIED (RTNCODE lines 17–20) | `resolved_no_change` selecting ESU-0002 | `DRQ-f226cdb8499a` |
| 5 | **RVW-REQ-RTNCDE00-002**: invalidated evidence | `business_sme` (or `exception_approver`) | `EAR-0002` EVIDENCE_INVALIDATED; alternative statements at lines 33–49 and 58; the behaviour is also covered by RT-RTNCDE00-001 | citation update via `resolved_requires_update`, exclusion, or an exception | `DRQ-a9e2249a4258` |

**Why this order:**
- **1–2 first.** They are shared with 5 and 15 scopes, and they decide whether the SQL-dependent portions (REQ-001, REQ-004, RT-002, RT-003) can ever leave the GAP category.
- **3–5.** These are independent of each other.
- **After the decisions,** REQ-RTNCDE00-001 stops blocking once item 1 is resolved.
- **Last:** `approval export-request --scope programs:RTNCDE00`, then a `requirements_approver` who is not the requester signs.

**Other valid request sets.** The Step 10 requests (`DRQ-57f29d19d1f3`, …) still match the current content and are not stale, but only one signed resolution per decision may be imported. **Prefer the Step 11 set.**

**Stale requests: never sign.** The Step 5.5 and Step 8 requests for RVW-REQ-RTNCDE00-003 are stale (the decision content changed).

## Missing SQLCA information (for the technical authority)

- **Missing artifacts:**
  - the real SQLCA member (the repository copy includes itself);
  - declarations (layout and meaning) of SQLCODE and SQLERRMC.
- **Runtime facts needed:**
  - the target DB2 version/runtime;
  - whether the standard meaning (0 = success, negative = error, +100 = no data) may be assumed.
- **Planning consequence:**
  - Today the response codes after SQL stay **GAP** placeholders.
  - A `resolved_no_change` on DR-DB2CONN-002 would let a later step plan them as source-plus-decision supported. It would not approve anything by itself.

## Non-blocking open decisions (recorded, not required for G2)

| Decision | Topic |
|---|---|
| DR-RTNCDE00-001 | inclusive time window; THRU ranges |
| DR-F2-0005-009 | modelling the SQLCA area in Java |
| DR-F2-0005-010 | whether RTNCODE is the authoritative caller contract |
| DR-F2-PKT0010-002 | the DISPLAY code page |

Nothing was signed, resolved or imported. No synthetic identity or test approval was used.
