# Review package: behaviour:RTNCDE00:P200-SET-RETURN-CODE:requirement=REQ-RTNCDE00-002,requirement=REQ-RTNCDE00-003,runtime_requirement=RT-RTNCDE00-001

**Status: NOT_APPROVED.** This package is complete for review; it is not an approval.

- Scope digest: `4e205c3d74de80ad3ae110ffd0d352715eb7bce6c662c8be4a7e403097055219`
- Source baseline: `352b97f0bbcbdb149c1118791aaabaa2e8e9972716bc77adc3a2f0644d24a068`
- Readiness: **NOT_READY** (2 blocking finding(s))
- G2: **UNVERIFIED**
- Trust: **TRUST_NOT_CONFIGURED** (no signer for architecture_approver, business_sme, data_owner, exception_approver, product_owner, requirements_approver, story_approver, technical_authority)

## Units in scope

| Unit | Kind | Relation | Source sha256 |
|---|---|---|---|
| RTNCODE | copybook | direct_dependency | `27eabb519319258b…` |
| RTNCDE00 | program | primary | `7cb951ea1f418c19…` |

## Requirements and their evidence

Each layer is separate: finding source evidence is not verification, verification is not acceptance, and acceptance is not approval.

| Requirement | G2 outcome | Earlier check | Dependency-aware check | Evidence found | Verified | Accepted by reviewer | Decision resolved |
|---|---|---|---|---|---|---|---|
| REQ-RTNCDE00-002 | REQUIRES_EVIDENCE (blocking) | unverified | CONTEXT_UNSUPPORTED | no | no | no | no |
| REQ-RTNCDE00-003 | REQUIRES_EVIDENCE (blocking) | unverified | CONTEXT_SUPPORTED | yes | yes | no | no |
| RT-RTNCDE00-001 | VERIFIED | verified | CONTEXT_SUPPORTED | yes | yes | no | no |

### REQ-RTNCDE00-002

> When a new return code is set ('S'), if it is greater than the highest code recorded so far (RC-HIGHEST-CODE) it becomes the new highest code; otherwise the highest code is kept. In both cases the current code becomes the new code. The highest code is held in the caller's request area, so it persists only as long as the caller keeps that area.

- **Inspect** `src/programs/batch/RTNCDE00.cbl` lines 64–66 (cited line 64).
- Evidence supplement `ESU-0001` v1: CONTEXT_UNSUPPORTED; current; cannot be accepted.
- Adjudication `EAR-0002` v1: SOURCE_CHAIN_PARTIAL, EVIDENCE_INVALIDATED; current.
- **Why it blocks:** REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: EAR-0002: the earlier verification relied on value(s) 'S' matched only as a substring inside a data name in the cited text, and no cited statement supports them; other statements in the program do support the value (alternative evidence for a citation update by a reviewer) | REQUIRES_SME_DECISION: blocked by RVW-REQ-RTNCDE00-002 (open)

### REQ-RTNCDE00-003

> When a new return code is set, the system classifies it: 0 is SUCCESS ('S'), 1 to 4 is WARNING ('W'), 5 to 8 is ERROR ('E') and any other value is SEVERE ('F'). The response code is then set to 0.

- **Inspect** `src/programs/batch/RTNCDE00.cbl` lines 70–79 (cited line 70).
- Dependency: the statement sets **RC-STATUS-SUCCESS**, declared at `src/copybook/common/RTNCODE.cpy:17` with VALUE ["S"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000013).
- Dependency: the statement sets **RC-STATUS-WARNING**, declared at `src/copybook/common/RTNCODE.cpy:18` with VALUE ["W"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000014).
- Dependency: the statement sets **RC-STATUS-ERROR**, declared at `src/copybook/common/RTNCODE.cpy:19` with VALUE ["E"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000015).
- Dependency: the statement sets **RC-STATUS-SEVERE**, declared at `src/copybook/common/RTNCODE.cpy:20` with VALUE ["F"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000016).
- Evidence supplement `ESU-0002` v1: CONTEXT_SUPPORTED; current; can be accepted by a signed review.
- Adjudication `EAR-0003` v1: SOURCE_CHAIN_VERIFIED; current.
- **Why it blocks:** REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: stated values found in the program but not in the cited lines: F | REQUIRES_SME_DECISION: blocked by RVW-REQ-RTNCDE00-003 (open)

### RT-RTNCDE00-001

> SET request classifies the new code: 0 success, 1-4 warning, 5-8 error, anything else severe, and keeps the highest code seen in the caller's area (state lives in the caller-supplied RC-REQUEST-AREA, not in this program).

- **Inspect** `src/programs/batch/RTNCDE00.cbl` lines 70–79 (cited line 70).
- Dependency: the statement sets **RC-STATUS-SUCCESS**, declared at `src/copybook/common/RTNCODE.cpy:17` with VALUE ["S"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000013).
- Dependency: the statement sets **RC-STATUS-WARNING**, declared at `src/copybook/common/RTNCODE.cpy:18` with VALUE ["W"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000014).
- Dependency: the statement sets **RC-STATUS-ERROR**, declared at `src/copybook/common/RTNCODE.cpy:19` with VALUE ["E"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000015).
- Dependency: the statement sets **RC-STATUS-SEVERE**, declared at `src/copybook/common/RTNCODE.cpy:20` with VALUE ["F"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000016).

## Blocking decisions

### RVW-REQ-RTNCDE00-002 (review, direct)

requirement REQ-RTNCDE00-002 (RTNCDE00) is not approvable as drafted: REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: EAR-0002: the earlier verification relied on value(s) 'S' matched only as a substring inside a data name in the cited text, and no cited statement supports them; other statements in the program do support the value (alternative evidence for a citation update by a reviewer)

Allowed outcomes: `excluded_from_scope` (business_sme), `resolved_requires_update` (business_sme), `approved_exception` (exception_approver).

### RVW-REQ-RTNCDE00-003 (review, direct)

requirement REQ-RTNCDE00-003 (RTNCDE00) is not approvable as drafted: REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: stated values found in the program but not in the cited lines: F

Allowed outcomes: `resolved_no_change` (business_sme), `excluded_from_scope` (business_sme), `resolved_requires_update` (business_sme), `approved_exception` (exception_approver).

## Remediation proposals

None.

## Unsigned resolution requests

- RVW-REQ-RTNCDE00-002: `DRQ-a25fb8eb7a96` (expires 2026-11-09T21:31:57.675Z)
- RVW-REQ-RTNCDE00-003: `DRQ-cab3ba15ddb8` (expires 2026-11-09T21:31:59.591Z)

**Stale earlier requests (must not be signed or reused):**

- RVW-REQ-RTNCDE00-003 `(no request id)` in `reports/step-5.5/resolution-requests/RVW-REQ-RTNCDE00-003.resolution-request.json`: the decision content changed (new options, evidence or affected items)
- RVW-REQ-RTNCDE00-003 `DRQ-9c84eab7a611` in `reports/step-8/resolution-requests/RVW-REQ-RTNCDE00-003.request.json`: the decision content changed (new options, evidence or affected items)

## What G2 READY needs

- requirement REQ-RTNCDE00-002 must stop blocking (REQUIRES_EVIDENCE)
- requirement REQ-RTNCDE00-003 must stop blocking (REQUIRES_EVIDENCE)

## What G2 PASS needs

- the scope is READY (no blocking finding)
- a trust store with a usable requirements_approver
- an approval request exported for the current scope digest
- a signed approval by a requirements_approver who is not the requester, imported and re-verified
- G2 re-evaluated to PASS for exactly behaviour:RTNCDE00:P200-SET-RETURN-CODE:requirement=REQ-RTNCDE00-002,requirement=REQ-RTNCDE00-003,runtime_requirement=RT-RTNCDE00-001
