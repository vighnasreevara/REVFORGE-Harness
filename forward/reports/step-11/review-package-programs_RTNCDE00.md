# Review package: programs:RTNCDE00

**Status: NOT_APPROVED.** This package is complete for review; it is not an approval.

- Scope digest: `bd0fcf24e958fffd47175318ffdc6805b60b97194b304809915eebea4201113a`
- Source baseline: `352b97f0bbcbdb149c1118791aaabaa2e8e9972716bc77adc3a2f0644d24a068`
- Readiness: **NOT_READY** (6 blocking finding(s))
- G2: **UNVERIFIED**
- Trust: **TRUST_NOT_CONFIGURED** (no signer for architecture_approver, business_sme, data_owner, exception_approver, product_owner, requirements_approver, story_approver, technical_authority)

## Units in scope

| Unit | Kind | Relation | Source sha256 |
|---|---|---|---|
| RTNCODE | copybook | direct_dependency | `27eabb519319258b…` |
| SQLCA | copybook | direct_dependency | `03e8f64ae705fe87…` |
| RTNCDE00 | program | primary | `7cb951ea1f418c19…` |

## Requirements and their evidence

Each layer is separate: finding source evidence is not verification, verification is not acceptance, and acceptance is not approval.

| Requirement | G2 outcome | Earlier check | Dependency-aware check | Evidence found | Verified | Accepted by reviewer | Decision resolved |
|---|---|---|---|---|---|---|---|
| REQ-RTNCDE00-001 | REQUIRES_SME_DECISION (blocking) | verified | CONTEXT_SUPPORTED | yes | yes | no | no |
| REQ-RTNCDE00-002 | REQUIRES_EVIDENCE (blocking) | unverified | CONTEXT_UNSUPPORTED | no | no | no | no |
| REQ-RTNCDE00-003 | REQUIRES_EVIDENCE (blocking) | unverified | CONTEXT_SUPPORTED | yes | yes | no | no |
| REQ-RTNCDE00-004 | CONTRADICTED (blocking) | contradicted | CITATION_MISMATCH | no | no | no | no |
| RT-RTNCDE00-001 | VERIFIED | verified | CONTEXT_SUPPORTED | yes | yes | no | no |
| RT-RTNCDE00-002 | VERIFIED | verified | CONTEXT_SUPPORTED | no | yes | no | no |
| RT-RTNCDE00-003 | VERIFIED | verified | CONTEXT_SUPPORTED | no | yes | no | no |

### REQ-RTNCDE00-001

> The return-code service selects its action from the request type (RC-REQUEST-TYPE): 'I' initialises the return-code area (program ID spaces, current and highest code 0, status SUCCESS, response code 0); 'S' records a new return code; 'G' returns the current code, the highest code and the status with response code 0; 'L' inserts one row into DB2 table RTNCODES with the current timestamp, program ID, current code, highest code, status and message, setting response code 0 when the insert succeeds (SQLCODE 0) and 8 otherwise; 'A' analyses logged codes over a time window. Any other request type performs nothing and leaves the response code unchanged.

- **Inspect** `src/programs/batch/RTNCDE00.cbl` lines 33–49 (cited line 33).
- Dependency: the statement tests **RC-INITIALIZE**, declared at `src/copybook/common/RTNCODE.cpy:6` with VALUE ["I"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000002).
- Dependency: the statement tests **RC-SET-CODE**, declared at `src/copybook/common/RTNCODE.cpy:7` with VALUE ["S"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000003).
- Dependency: the statement tests **RC-GET-CODE**, declared at `src/copybook/common/RTNCODE.cpy:8` with VALUE ["G"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000004).
- Dependency: the statement tests **RC-LOG-CODE**, declared at `src/copybook/common/RTNCODE.cpy:9` with VALUE ["L"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000005).
- Dependency: the statement tests **RC-ANALYZE**, declared at `src/copybook/common/RTNCODE.cpy:10` with VALUE ["A"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000006).
- **Why it blocks:** REQUIRES_SME_DECISION: blocked by DR-DB2CONN-002 (open)

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

### REQ-RTNCDE00-004

> On an analyse request ('A') the system counts the logged return codes in RTNCODES for the requested program ID whose timestamp is greater than or equal to the caller's start time and less than or equal to the caller's end time, and returns the count, the highest (MAX) and the lowest (MIN) logged return code. The response code is 0 when the query succeeds (SQLCODE 0) and 8 otherwise.

- **Inspect** `src/programs/batch/RTNCDE00.cbl` lines 122–133 (cited line 121, **outside the statement**).
- Evidence supplement `ESU-0003` v1: CITATION_MISMATCH; current; cannot be accepted.
- **Why it blocks:** CONTRADICTED: the source contradicts the cited evidence: cited line 121 is outside SYS-PORTFOLIO-001-FIL-0052-STMT-000024 (lines 122-133) | REQUIRES_SME_DECISION: blocked by DR-DB2CONN-002 (open) | REQUIRES_SME_DECISION: blocked by RVW-REQ-RTNCDE00-004 (open)

### RT-RTNCDE00-001

> SET request classifies the new code: 0 success, 1-4 warning, 5-8 error, anything else severe, and keeps the highest code seen in the caller's area (state lives in the caller-supplied RC-REQUEST-AREA, not in this program).

- **Inspect** `src/programs/batch/RTNCDE00.cbl` lines 70–79 (cited line 70).
- Dependency: the statement sets **RC-STATUS-SUCCESS**, declared at `src/copybook/common/RTNCODE.cpy:17` with VALUE ["S"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000013).
- Dependency: the statement sets **RC-STATUS-WARNING**, declared at `src/copybook/common/RTNCODE.cpy:18` with VALUE ["W"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000014).
- Dependency: the statement sets **RC-STATUS-ERROR**, declared at `src/copybook/common/RTNCODE.cpy:19` with VALUE ["E"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000015).
- Dependency: the statement sets **RC-STATUS-SEVERE**, declared at `src/copybook/common/RTNCODE.cpy:20` with VALUE ["F"] (SYS-PORTFOLIO-001-FIL-0013-FLD-000016).

### RT-RTNCDE00-002

> LOG request inserts one RTNCODES row whose TIMESTAMP is the 16-character CURRENT-DATE prefix (YYYYMMDDHHMMSShh) and reports SQL success/failure only as response code 0/8.

- **Inspect** `src/programs/batch/RTNCDE00.cbl` lines 96–111 (cited line 96).

### RT-RTNCDE00-003

> ANALYZE request returns count, max and min RETURN_CODE for a program within [RC-START-TIME, RC-END-TIME] via a singleton SELECT INTO.

- **Inspect** `src/programs/batch/RTNCDE00.cbl` lines 122–133 (cited line 122).

## Blocking decisions

### DR-DB2CONN-002 (technical, cross_scope)

Copybook SQLCA (src/copybook/db2/SQLCA.cpy) includes itself (EXEC SQL INCLUDE SQLCA at line 6) and defines only SQL-STATUS-CODES, with no SQLCODE or SQLERRMC field; SQLCODE/SQLERRMC therefore have no Field ID in 14 DB2 programs, including HISTLD00, RTNANA00, RTNCDE00, DB2CMT and DB2CONN. Which SQLCA does the precompiler actually supply, and may the forward design assume the standard DB2 SQLCODE meaning (0 success, -803 duplicate key, negative values errors) used in these requirements?

Allowed outcomes: `resolved_no_change` (technical_authority), `excluded_from_scope` (technical_authority), `resolved_requires_update` (technical_authority).

Affects 5 unit(s), 9 requirement(s), 5 program scope(s).

- **What the source shows:** src/copybook/db2/SQLCA.cpy (sha256 03e8f64ae705…) declares SQL-STATUS-CODES with 7 VALUE clause(s); SQLCA line 6 includes itself: "EXEC SQL INCLUDE SQLCA END-EXEC."; SQLCA is included by 14 program(s)
- **What an external environment may provide:** SQLCODE: used by 14 program(s) but declared nowhere in the repository; a DB2 precompiler or runtime normally supplies such names, which the repository cannot confirm; SQLERRMC: used by 2 program(s) but declared nowhere in the repository; a DB2 precompiler or runtime normally supplies such names, which the repository cannot confirm
- **Unsupported assumptions:** any layout, field order or value meaning of SQLCODE, SQLERRMC beyond what the repository declares; the target runtime (e.g. database version) that would supply SQLCA and those names
- **Missing artefacts:** the real SQLCA member (the repository copy includes itself); a declaration of SQLCODE; a declaration of SQLERRMC
- **To decide:** the technical authority must choose one allowed outcome (resolved_no_change, excluded_from_scope, resolved_requires_update); the runtime does not choose

### DR-F2-0011-001 (data_layout, shared_dependency)

Copybook SQLCA (SYS-PORTFOLIO-001-FIL-0017) line 6 contains 'EXEC SQL INCLUDE SQLCA END-EXEC', naming itself. The included SQL communication area (SQLCODE, SQLSTATE, SQLERRMC, ...) has no layout in any reverse artifact. How should the forward design obtain the SQLCA layout and the SQLCODE/SQLSTATE semantics used by the 14 DB2 programs?

Allowed outcomes: `resolved_no_change` (technical_authority), `excluded_from_scope` (technical_authority).

Affects 1 unit(s), 0 requirement(s), 15 program scope(s).

- **What the source shows:** src/copybook/db2/SQLCA.cpy (sha256 03e8f64ae705…) declares SQL-STATUS-CODES with 7 VALUE clause(s); SQLCA line 6 includes itself: "EXEC SQL INCLUDE SQLCA END-EXEC."; SQLCA is included by 14 program(s)
- **What an external environment may provide:** SQLCODE: used by 14 program(s) but declared nowhere in the repository; a DB2 precompiler or runtime normally supplies such names, which the repository cannot confirm; SQLERRMC: used by 2 program(s) but declared nowhere in the repository; a DB2 precompiler or runtime normally supplies such names, which the repository cannot confirm
- **Unsupported assumptions:** any layout, field order or value meaning of SQLCODE, SQLERRMC beyond what the repository declares; the target runtime (e.g. database version) that would supply SQLCA and those names
- **Missing artefacts:** the real SQLCA member (the repository copy includes itself); a declaration of SQLCODE; a declaration of SQLERRMC
- **To decide:** the technical authority must choose one allowed outcome (resolved_no_change, excluded_from_scope); the runtime does not choose

### RVW-REQ-RTNCDE00-002 (review, direct)

requirement REQ-RTNCDE00-002 (RTNCDE00) is not approvable as drafted: REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: EAR-0002: the earlier verification relied on value(s) 'S' matched only as a substring inside a data name in the cited text, and no cited statement supports them; other statements in the program do support the value (alternative evidence for a citation update by a reviewer)

Allowed outcomes: `excluded_from_scope` (business_sme), `resolved_requires_update` (business_sme), `approved_exception` (exception_approver).

### RVW-REQ-RTNCDE00-003 (review, direct)

requirement REQ-RTNCDE00-003 (RTNCDE00) is not approvable as drafted: REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: stated values found in the program but not in the cited lines: F

Allowed outcomes: `resolved_no_change` (business_sme), `excluded_from_scope` (business_sme), `resolved_requires_update` (business_sme), `approved_exception` (exception_approver).

### RVW-REQ-RTNCDE00-004 (review, direct)

requirement REQ-RTNCDE00-004 (RTNCDE00) is not approvable as drafted: CONTRADICTED: the source contradicts the cited evidence: cited line 121 is outside SYS-PORTFOLIO-001-FIL-0052-STMT-000024 (lines 122-133)

Allowed outcomes: `excluded_from_scope` (business_sme), `resolved_requires_update` (business_sme).

## Remediation proposals

- `RP-8d2dd33787` REQ-RTNCDE00-004 /requirements/26/source_refs/0/line: 121 → 122 ("P500-ANALYZE-CODES." → "EXEC SQL"); re-verified now: true; supports the full claim after correction: true; authorised only by a signed `RVW-REQ-RTNCDE00-004` (business_sme).

## Unsigned resolution requests

- DR-DB2CONN-002: `DRQ-8a46d20a555f` (expires 2026-11-09T17:40:45.759Z)
- DR-F2-0011-001: `DRQ-5a06c97411d1` (expires 2026-11-09T17:40:46.363Z)
- RVW-REQ-RTNCDE00-002: `DRQ-a9e2249a4258` (expires 2026-11-09T17:40:47.304Z)
- RVW-REQ-RTNCDE00-003: `DRQ-f226cdb8499a` (expires 2026-11-09T17:40:48.369Z)
- RVW-REQ-RTNCDE00-004: `DRQ-91faa5b8863b` (expires 2026-11-09T17:40:49.530Z)

**Stale earlier requests (must not be signed or reused):**

- RVW-REQ-RTNCDE00-003 `(no request id)` in `reports/step-5.5/resolution-requests/RVW-REQ-RTNCDE00-003.resolution-request.json`: the decision content changed (new options, evidence or affected items)
- RVW-REQ-RTNCDE00-003 `DRQ-9c84eab7a611` in `reports/step-8/resolution-requests/RVW-REQ-RTNCDE00-003.request.json`: the decision content changed (new options, evidence or affected items)

## What G2 READY needs

- requirement REQ-RTNCDE00-004 must stop blocking (CONTRADICTED)
- requirement REQ-RTNCDE00-002 must stop blocking (REQUIRES_EVIDENCE)
- requirement REQ-RTNCDE00-003 must stop blocking (REQUIRES_EVIDENCE)
- decision:technical DR-DB2CONN-002 must stop blocking (REQUIRES_SME_DECISION)
- decision:data_layout DR-F2-0011-001 must stop blocking (REQUIRES_SME_DECISION)
- requirement REQ-RTNCDE00-001 must stop blocking (REQUIRES_SME_DECISION)

## What G2 PASS needs

- the scope is READY (no blocking finding)
- a trust store with a usable requirements_approver
- an approval request exported for the current scope digest
- a signed approval by a requirements_approver who is not the requester, imported and re-verified
- G2 re-evaluated to PASS for exactly programs:RTNCDE00
