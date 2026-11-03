# RTNCDE00: signed-approval prerequisite checklist (Step 12)

**Status: nothing is signed, nothing is approved. Trust: TRUST_NOT_CONFIGURED. G2: UNVERIFIED.**

- **Review package:** [`review-package-programs_RTNCDE00.md`](review-package-programs_RTNCDE00.md), regenerated with the current hashes.
- **Scope manifest:** [`verified-scope-programs_RTNCDE00.json`](verified-scope-programs_RTNCDE00.json).

| Scope | Digest | Readiness |
|---|---|---|
| `programs:RTNCDE00` | `3c8aa823d8353b384d12a341c029d729b74c3306c823fc38e05a8a0559a75dc4` | NOT_READY, 8 blocking |
| Candidate subset `requirements:REQ-RTNCDE00-002,REQ-RTNCDE00-003` | `a46bd86f8c4c8c85af59c444c65d3e39b561b70740d19db8fd003e3abe1978bd` | NOT_READY, 5 blocking |

## A. Decisions needed for the small candidate (P200)

| Decision | Role | What to decide | Fresh unsigned request (expires 2026-11-09) |
|---|---|---|---|
| **RVW-REQ-RTNCDE00-003** | `business_sme` | `resolved_no_change` selecting **ESU-0002**: the S/W/E/F values are proved by RTNCODE.cpy lines 17–20 (EAR-0003 SOURCE_CHAIN_VERIFIED). Or another allowed outcome. | `DRQ-8a56c9fba2f7` |
| **RVW-REQ-RTNCDE00-002** | `business_sme` (or `exception_approver`) | The earlier verification was invalidated (EAR-0002). REQ-002 specifies outputs of P200 (current and highest code), so it **cannot be excluded** without leaving those outputs unspecified. Possible paths: `resolved_requires_update` (cite the supporting statements and revise the item through `workflow correct`), or `approved_exception`. | `DRQ-61ecf91d935f` |

RT-RTNCDE00-001 is already VERIFIED and needs no decision.

## B. Decisions needed only for deferred functionality

| Decision | Role | Deferred behaviour | Fresh request |
|---|---|---|---|
| RVW-REQ-RTNCDE00-004 | `business_sme` | P500 analyse (RP-8d2dd33787, citation 121 → 122) | `DRQ-169036e9539b` |

## C. Decisions required by shared dependencies

| Decision | Role | Shared with | Effect on the candidate | Fresh request |
|---|---|---|---|---|
| DR-DB2CONN-002 | `technical_authority` | 5 programs | not reached by P200; blocks P400/P500, RT-002, RT-003, REQ-001, REQ-004 | `DRQ-68646916d34f` |
| DR-F2-0011-001 | `technical_authority` | 15 program scopes (SQLCA) | not reached by P200, but under the current engine it **still blocks the candidate subset** (limitation L2, below) | `DRQ-2df78db54de2` |

**Stale (never sign):** the Step 5.5 and Step 8 requests for RVW-REQ-RTNCDE00-003.

## D. Can the existing engine approve the candidate alone?

**Not yet.** A read-only evaluation of the subset shows two precise limitations. They are reported here, and none was worked around.

| | Limitation | Effect | Minimal policy change proposed (not implemented) |
|---|---|---|---|
| **L1** | `requirements:` selectors accept only REQ-* IDs. Runtime requirements (RT-*) cannot be named, and every runtime requirement, file-operation and data-record item of the unit is included. | RT-RTNCDE00-002 and RT-RTNCDE00-003 (SQLCODE-blocked) are in the subset, and RT-001 is included only implicitly | allow RT-* IDs in the selector; include data contracts only when a selected item references their fields |
| **L2** | A unit-level decision with no affected requirements applies to every scope on the unit | DR-F2-0011-001 blocks the subset although P200 never reaches SQLCA | apply such a decision to a requirements subset only when a selected item reaches its subject (the semantic edge G2 now computes). Otherwise list it as a reviewable, traceable deferral: never excluded, and still applied to the program scope. |

**Without a policy change,** the candidate could pass G2 only after **all five** decisions are signed, i.e. the same as the full program. **With L1 and L2 changed,** two signatures (A) plus the G2 approval would suffice for the subset. Approval of the subset would bind to its own digest and would never imply approval of RTNCDE00.

## E. Final G2 requirements (either scope)

1. A key custodian installs a trust store with real signers for every role (one identity per person) via `REVFORGE_APPROVAL_TRUST_STORE`. `trust doctor` must report TRUST_CONFIGURED.
2. The required decisions (A, plus C under the current engine) are signed outside REVFORGE, then verified and imported with `decisions verify-resolution` / `decisions import-resolution`.
3. The operator re-runs `approval package` and `pilot scope`. The scope must be READY.
4. `approval export-request --scope <exact scope>`.
5. A `requirements_approver` who is not the requester signs. Then `approval verify` / `approval import`, and `workflow gate --gate G2`.
6. Only then: G3 (architecture ADRs, including the domain restriction and the TRUNC gap), G4 (stories), and the generation flag with a target directory.
