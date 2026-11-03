# RTNCDE00: deferred-gap handoff

**8 gaps: 4 blocking, 4 non-blocking.** All are OPEN. None was deleted, resolved or excluded.

- **Machine-readable copy:** the `gaps` array of [`verified-scope-programs_RTNCDE00.json`](verified-scope-programs_RTNCDE00.json).
- **Stable IDs:** gap IDs are derived deterministically from program, paragraph and subject, and are identical on re-evaluation (test 7/8/9).
- **Source:** every gap carries the original source path and sha256 (`RTNCDE00.cbl` `7cb951ea…`).

## Blocking gaps (they block an execution path)

| Gap ID | Source | Missing fact | Why conversion is unsafe | Affected requirements | Affected Java component | Required action | Validation evidence | Path blocked |
|---|---|---|---|---|---|---|---|---|
| `GAP-RTNCDE00-P400-LOG-RETURN-CODE-SQLCODE` | lines 113, 114, 116 (`IF SQLCODE = 0`, `MOVE 0`, `MOVE 8`) | SQLCODE is declared nowhere; the real SQLCA member is missing (the repository copy includes itself) | the 0/8 response code depends on a value whose meaning is not established | REQ-001, RT-002 | outcome mapping of P400, behind a port whose only implementation throws | DR-DB2CONN-002 and DR-F2-0011-001: signed resolutions by `technical_authority` | the real SQLCODE definition for the target runtime, plus a captured legacy run of each branch | request `'L'` → P400 |
| `GAP-RTNCDE00-P400-LOG-RETURN-CODE-SQL-INSERT-RTNCODES` | line 96 (`INSERT INTO RTNCODES`) | DB2 behaviour: product and version, conversion of the 16-character `WS-CURRENT-TIME` into `TIMESTAMP`, duplicate key on (TIMESTAMP, PROGRAM_ID) | the result and its status come from an external database | REQ-001, RT-002 | database port `INSERT RTNCODES` (interface only) | an approved database-interaction specification (technical authority) recorded as an ADR at G3 | a captured run against the real or an approved equivalent database, including errors | request `'L'` → P400 |
| `GAP-RTNCDE00-P500-ANALYZE-CODES-SQLCODE` | lines 135, 136, 138 | as above | the 0/8 response depends on SQLCODE | REQ-001, REQ-004, RT-003 | outcome mapping of P500 | DR-DB2CONN-002, DR-F2-0011-001 | as above | request `'A'` → P500 |
| `GAP-RTNCDE00-P500-ANALYZE-CODES-SQL-SELECT-RTNCODES` | line 122 (`SELECT COUNT/MAX/MIN … FROM RTNCODES`) | DB2 behaviour: an empty window (NULL MAX/MIN without indicator variables), timestamp comparison semantics | the results come from an external database | REQ-001, REQ-004, RT-003 | database port `SELECT RTNCODES` (interface only) | database-interaction ADR (technical authority) | captured runs, including an empty window | request `'A'` → P500 |

## Non-blocking gaps (domain restrictions; they block only out-of-range inputs)

| Gap ID | Source | Missing fact | Effect | Affected requirements | Java treatment (proposed) | Required action | Validation evidence |
|---|---|---|---|---|---|---|---|
| `GAP-RTNCDE00-P200-SET-RETURN-CODE-TRUNC-RC-HIGHEST-CODE` | line 65 | compiler TRUNC option (RC-HIGHEST-CODE `S9(4)` binary) | values beyond ±9999 behave by the TRUNC option | REQ-001/002/003, RT-001 | reject inputs outside −9999..9999; never truncate | the compile options of RTNCDE00 (technical authority) | the compile listing or JCL (TRUNC setting), or a captured run with 10000 |
| `GAP-RTNCDE00-P200-SET-RETURN-CODE-TRUNC-RC-CURRENT-CODE` | line 68 | same | same | same | same | same | same |
| `GAP-RTNCDE00-P300-GET-RETURN-CODE-TRUNC-RC-RETURN-VALUE` | line 86 | same | same | REQ-001 | same | same | same |
| `GAP-RTNCDE00-P300-GET-RETURN-CODE-TRUNC-RC-HIGHEST-RETURN` | line 87 | same | same | REQ-001 | same | same | same |

## Unresolved decisions that are not source gaps

| Decision | Topic |
|---|---|
| DR-RTNCDE00-001 | inclusive time window; THRU ranges |
| DR-F2-0005-009 | modelling the SQLCA area |
| DR-F2-0005-010 | the caller-interface contract |
| DR-F2-PKT0010-002 | the code page |

These are non-blocking open decisions. They are recorded in the review package and are not converted into gaps here.
