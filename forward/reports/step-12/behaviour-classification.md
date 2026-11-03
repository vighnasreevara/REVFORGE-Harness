# RTNCDE00: behaviour and dependency classification

**Status: NON-AUTHORITATIVE.** Machine-readable source: [`verified-scope-programs_RTNCDE00.json`](verified-scope-programs_RTNCDE00.json), from `pilot scope --scope programs:RTNCDE00`.

| | |
|---|---|
| Baseline | `FWD-20261031T172520Z-66b3` (`352b97f0…4d24a068`) |
| `src/programs/batch/RTNCDE00.cbl` | sha256 `7cb951ea1f418c19…` |
| `src/copybook/common/RTNCODE.cpy` | sha256 `27eabb519319258b…` |
| `src/copybook/db2/SQLCA.cpy` | sha256 `03e8f64ae705fe87…` |
| Program scope digest | `3c8aa823d8353b384d12a341c029d729b74c3306c823fc38e05a8a0559a75dc4` (changed from Step 11's `bd0fcf24…` by the G2 semantic fix) |

## Classification rules

| Class | Rule |
|---|---|
| **VERIFIED_CANDIDATE** | no statement uses a name declared nowhere, and none is external (embedded SQL, CALL, file I/O) |
| **PARTIAL** | some statements are independent, some dependent or external |
| **GAP** | every statement is dependent or external |

A statement nested under a dependent IF or EVALUATE is dependent. Parseability alone never makes a behaviour verified.

## Behaviours

| Behaviour | Lines | Trigger | Inputs | Outputs | Side effects | Class | Covered by |
|---|---|---|---|---|---|---|---|
| ENTRY-DISPATCH | 33–49 | — | RC-REQUEST-TYPE | (routes only) | — | **PARTIAL**: its result is that of the selected branch, two of which are not verified | REQ-001 |
| P100-INIT-RETURN-CODES | 54–59 | `WHEN RC-INITIALIZE` (`'I'`) | — | RC-CODES-AREA (INITIALIZE), RC-PROGRAM-ID, RC-CURRENT-CODE, RC-HIGHEST-CODE, RC-STATUS, RC-RESPONSE-CODE | — | **VERIFIED_CANDIDATE** | REQ-001 only |
| **P200-SET-RETURN-CODE** | 64–81 | `WHEN RC-SET-CODE` (`'S'`) | RC-NEW-CODE, RC-HIGHEST-CODE | RC-HIGHEST-CODE, RC-CURRENT-CODE, RC-STATUS, RC-RESPONSE-CODE | — | **VERIFIED_CANDIDATE** | REQ-001, REQ-002, REQ-003, RT-001 |
| P300-GET-RETURN-CODE | 86–89 | `WHEN RC-GET-CODE` (`'G'`) | RC-CURRENT-CODE, RC-HIGHEST-CODE, RC-STATUS | RC-RETURN-VALUE, RC-HIGHEST-RETURN, RC-RETURN-STATUS, RC-RESPONSE-CODE | — | **VERIFIED_CANDIDATE** | REQ-001 only |
| P400-LOG-RETURN-CODE | 94–117 | `WHEN RC-LOG-CODE` (`'L'`) | CURRENT-DATE, RC-PROGRAM-ID, RC-CURRENT-CODE, RC-HIGHEST-CODE, RC-STATUS, RC-MESSAGE | WS-CURRENT-TIME, RC-RESPONSE-CODE | INSERT INTO RTNCODES | **PARTIAL** (the timestamp move is independent; INSERT is external; 113–116 depend on SQLCODE) | REQ-001, RT-002 |
| P500-ANALYZE-CODES | 122–139 | `WHEN RC-ANALYZE` (`'A'`) | RC-PROGRAM-ID, RC-START-TIME, RC-END-TIME | RC-TOTAL-CODES, RC-MAX-CODE, RC-MIN-CODE, RC-RESPONSE-CODE | SELECT … FROM RTNCODES | **GAP** (the SELECT is external; 135–138 depend on SQLCODE) | REQ-001, REQ-004, RT-003 |
| NO-MATCH | — | no WHEN true (there is no WHEN OTHER) | — | none (nothing changes) | — | **VERIFIED_CANDIDATE** | REQ-001 only |

**Error behaviour in the source:**
- The only error signal is RC-RESPONSE-CODE 8, set after SQL (P400, P500), and that is the SQLCODE gap.
- P100, P200 and P300 always set response 0.
- An unknown request type changes nothing.

## Candidate selection (requirement closure)

A behaviour can form an approvable subset only through requirements that cover nothing but VERIFIED_CANDIDATE behaviour.

| Behaviour | Closure | Why |
|---|---|---|
| **P200-SET-RETURN-CODE** | **holds** with REQ-002, REQ-003, RT-001 | REQ-001 overlaps it, but REQ-001 also covers ENTRY-DISPATCH (PARTIAL), P400 (PARTIAL) and P500 (GAP), so it stays outside the subset, listed |
| P100-INIT-RETURN-CODES | fails | only REQ-001 covers it |
| P300-GET-RETURN-CODE | fails | only REQ-001 covers it |
| NO-MATCH | fails | only REQ-001 covers it |

**Cross-call data flow:** no input of P200 (RC-NEW-CODE, RC-HIGHEST-CODE) is written by a blocked behaviour. P400/P500 write WS-CURRENT-TIME, RC-RESPONSE-CODE, RC-TOTAL-CODES, RC-MAX-CODE and RC-MIN-CODE only.

**Making P100, P300 and NO-MATCH approvable** would need REQ-001 to be split into one requirement per request type. That is a business-SME decision (a `resolved_requires_update` of the dispatch requirement). It was not done here.
