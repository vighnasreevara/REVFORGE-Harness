# RTNCDE00: source-backed modernization plan

**Status: NON-AUTHORITATIVE.** This is a planning classification only. Nothing here approves, resolves or excludes anything. The source data is [`modernization-plan-programs_RTNCDE00.json`](modernization-plan-programs_RTNCDE00.json), produced by `pilot plan --scope programs:RTNCDE00` (read-only; the workflow audit stayed at 254 entries).

## Scope facts

| | |
|---|---|
| Baseline | `FWD-20261031T172520Z-66b3`, manifest `352b97f0…4d24a068` |
| Scope digest | `bd0fcf24e958fffd47175318ffdc6805b60b97194b304809915eebea4201113a` (unchanged since Step 10) |
| G2 readiness | **NOT_READY**: 6 blocking findings; G2 **UNVERIFIED** |
| `src/programs/batch/RTNCDE00.cbl` | sha256 `7cb951ea1f418c19ddd61c0eca00f21108af5f364b5ecf05742cbc428862994e` |
| `src/copybook/common/RTNCODE.cpy` | sha256 `27eabb519319258b07b32f09ab60e80a18f6658a118e96c8fa01411fc473cbc9` |
| `src/copybook/db2/SQLCA.cpy` | sha256 `03e8f64ae705fe87324100488072c05d179fb75f64db0dc0cf753f23ab10afc7` |
| `src/database/db2/RTNCODES.sql` | sha256 `3a2ca982d9386f58dbc1419880db285a2775866c0f341e86300da8894140400e` (table definition found for both SQL statements) |
| Names declared nowhere | `SQLCODE`, `SQLERRMC`, under the open blocking decisions DR-DB2CONN-002 and DR-F2-0011-001 (`technical_authority`) |
| Open non-blocking decisions | DR-RTNCDE00-001 (inclusive window, THRU ranges), DR-F2-0005-009 (SQLCA modelling), DR-F2-0005-010 (interface contract), DR-F2-PKT0010-002 (code page) |

## Classification

| Requirement | Category | Class | G2 outcome (unchanged) | Reached statements: independent / dependent |
|---|---|---|---|---|
| REQ-RTNCDE00-001 | **PARTIAL** | PARTIALLY_SUPPORTED | REQUIRES_SME_DECISION (blocking) | 37 / 6 |
| REQ-RTNCDE00-002 | **GAP** | INSUFFICIENT_EVIDENCE | REQUIRES_EVIDENCE (blocking) | 13 / 0 |
| REQ-RTNCDE00-003 | **VERIFIED** | FULLY_SOURCE_SUPPORTED | REQUIRES_EVIDENCE (blocking: not yet accepted) | 13 / 0 |
| REQ-RTNCDE00-004 | **GAP** | CONTRADICTED | CONTRADICTED (blocking) | 1 / 3 |
| RT-RTNCDE00-001 | **VERIFIED** | FULLY_SOURCE_SUPPORTED | VERIFIED | 13 / 0 |
| RT-RTNCDE00-002 | **PARTIAL** | PARTIALLY_SUPPORTED | VERIFIED | 2 / 3 |
| RT-RTNCDE00-003 | **PARTIAL** | PARTIALLY_SUPPORTED | VERIFIED | 1 / 3 |

**A finding for the reviewers.** G2 reports RT-RTNCDE00-002 and RT-RTNCDE00-003 as VERIFIED. Their response codes (lines 113–117 and 135–139), however, depend on `IF SQLCODE = 0`, and `SQLCODE` is declared nowhere. G2 does not list these two runtime requirements under DR-DB2CONN-002. The scope is still blocked by that decision, so no wrong approval is possible today. The planner classifies them PARTIAL, and the G2 policy was not changed.

## Per requirement

### REQ-RTNCDE00-001: request dispatch (PARTIAL)

| | |
|---|---|
| **1. Evidence** | `RTNCDE00.cbl` lines 33–49 (EVALUATE TRUE, STMT-000001) and the paragraphs it performs (P100–P500 with their EXIT paragraphs). Condition values come from `RTNCODE.cpy` lines 6–10: `I`, `S`, `G`, `L`, `A`. Checked by the deterministic claim check. |
| **2. Hashes** | RTNCDE00, RTNCODE and SQLCA, as above |
| **3. Source-supported meaning** | Dispatch on RC-REQUEST-TYPE. `I` initializes the codes area and sets the status to `S`, response 0. `S` sets a new code. `G` copies current, highest and status, response 0. `L` inserts one RTNCODES row. `A` runs the count/max/min query. Any other value does nothing (there is no WHEN OTHER). |
| **4. Missing** | The meaning of `SQLCODE` (lines 113 and 135): the real SQLCA member, and declarations of SQLCODE and SQLERRMC |
| **5. Dependencies** | RTNCODE 88-levels; SQLCA; table RTNCODES |
| **6. Independent?** | Only the `I`, `S`, `G` branches and the unknown-type no-op; and for `L`/`A`, the statements before the SQL outcome check. The `L`/`A` response codes are a preserved gap. |
| **7. Decisions** | DR-DB2CONN-002 and DR-F2-0011-001 (`technical_authority`, blocking); DR-RTNCDE00-001 (non-blocking) |
| **8. Java responsibility** | Request-type dispatcher; initialize, set and get handlers; two external-interface calls (log, analyse) |
| **9. Tests** | Each declared value `I`/`S`/`G`/`L`/`A` selects its branch; an undeclared value (e.g. `X`, lower-case `i`) changes nothing. The `L`/`A` response-code tests are blocked until the SQLCODE decision. |

### REQ-RTNCDE00-002: highest code (GAP: insufficient evidence)

| | |
|---|---|
| **1. Evidence** | Cited lines 64–66: `IF RC-NEW-CODE > RC-HIGHEST-CODE` / `MOVE RC-NEW-CODE TO RC-HIGHEST-CODE`. `EAR-0002` invalidated the earlier verification (the `'S'` was matched only inside a data name). Alternative statements that do support the value exist (the dispatch at lines 37–39). |
| **3. Source-supported meaning** | The comparison and move are in the source. The same behaviour is also stated, and verified, in RT-RTNCDE00-001 ("keeps the highest code seen in the caller's area"). |
| **4. Missing** | A citation that supports the stated value `('S')` |
| **6. Independent?** | Not as drafted. The behaviour is covered by RT-RTNCDE00-001 (VERIFIED). |
| **7. Decision** | RVW-REQ-RTNCDE00-002 (`business_sme`, or `exception_approver` for an exception): update the citation, exclude, or grant an exception |
| **8. Java** | Highest-code tracking inside the set handler |
| **9. Tests** | New code > highest (replaced); new code = highest (kept); new code < highest (kept); negative codes (signed comparison) |

### REQ-RTNCDE00-003: severity classification (VERIFIED in source; not accepted)

| | |
|---|---|
| **1. Evidence** | Lines 70–79 (EVALUATE RC-NEW-CODE). Status values come from `RTNCODE.cpy` lines 17–20: `S`/`W`/`E`/`F` (FLD-000013..16). `EAR-0003` is SOURCE_CHAIN_VERIFIED and `ESU-0002` is current. |
| **3. Meaning** | 0 → `S`; 1–4 → `W`; 5–8 → `E`; any other value, including negatives, → `F`; then response 0 |
| **4. Missing** | Nothing in the source. Evidence acceptance is still missing: verified evidence is **not** acceptance. |
| **6. Independent?** | Yes, once the scope is approved |
| **7. Decision** | RVW-REQ-RTNCDE00-003 (`business_sme`: `resolved_no_change` selecting ESU-0002, or another outcome) |
| **8. Java** | Pure severity classifier |
| **9. Tests** | 0; 1 and 4; 5 and 8; −1 and 9 (OTHER); the extremes of the S9(4) COMP range (see the architecture preview, numeric semantics) |

### REQ-RTNCDE00-004: analyse window (GAP: contradicted citation; SQLCODE-dependent)

| | |
|---|---|
| **1. Evidence** | The cited line 121 is the paragraph header, outside the SELECT at lines 122–133. Proposal RP-8d2dd33787 (121 → 122) is re-verified, and supports the claim after correction. |
| **3. Meaning** | `SELECT COUNT(*), MAX(RETURN_CODE), MIN(RETURN_CODE) … WHERE PROGRAM_ID = :RC-PROGRAM-ID AND TIMESTAMP >= :RC-START-TIME AND TIMESTAMP <= :RC-END-TIME`; response 0 if `SQLCODE = 0`, otherwise 8 |
| **4. Missing** | The corrected citation; the SQLCODE meaning; the behaviour when no rows match (MAX/MIN would be NULL with no indicator variables), which is not established |
| **7. Decisions** | RVW-REQ-RTNCDE00-004 (`business_sme`, RP-8d2dd33787); DR-DB2CONN-002 and DR-F2-0011-001; DR-RTNCDE00-001 (non-blocking: inclusive window) |
| **8. Java** | Analytics port (query) plus the response mapping, which stays a gap |
| **9. Tests** | Window boundaries equal to start and to end; no matching rows (blocked) |

### RT-RTNCDE00-001: classification and highest code (VERIFIED)

Lines 64–81 (paragraph P200). This covers the same behaviour as REQ-002 and REQ-003, verified deterministically, and needs no decision. Its tests are those of REQ-002 and REQ-003.

### RT-RTNCDE00-002: log row (PARTIAL)

| | |
|---|---|
| **Independent** | Line 94 `MOVE FUNCTION CURRENT-DATE TO WS-CURRENT-TIME` (keeps the first 16 characters, `YYYYMMDDHHMMSShh`); line 96 `INSERT INTO RTNCODES` with six host variables, against the table defined in `RTNCODES.sql` |
| **Dependent** | Lines 113–116: response 0/8 from `SQLCODE` |
| **Missing** | The SQLCODE meaning. Also not established: how DB2 converts the 16-character host variable into the `TIMESTAMP` column. This is not a COBOL fact and is recorded as missing information for the SQL runtime decision. |

### RT-RTNCDE00-003: analyse query (PARTIAL)

| | |
|---|---|
| **Independent** | Line 122, the SELECT (shape and predicate) |
| **Dependent** | Lines 135–138, the SQLCODE response |

## What can be implemented, once (and only once) the scope is approved

| Component | Source | Category |
|---|---|---|
| Severity classifier | REQ-003, RT-001 | VERIFIED |
| Highest-code tracking | RT-001 (and REQ-002 after its citation is fixed) | VERIFIED |
| Initialize and get handlers; dispatch of `I`/`S`/`G`; unknown-type no-op | REQ-001, independent portion | PARTIAL → independent portion |
| Log-row construction and the log port call | RT-002, independent portion | PARTIAL → independent portion |
| Analyse-query port call | RT-003, independent portion | PARTIAL → independent portion |
| Response codes after SQL (`L`, `A`) | REQ-001, REQ-004, RT-002, RT-003 | **GAP**: blocked placeholder until DR-DB2CONN-002 and DR-F2-0011-001 |
