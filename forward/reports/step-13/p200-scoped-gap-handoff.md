# P200 behaviour scope: gap handoff

**Machine-readable sources:**
- `scope-behaviour_RTNCDE00_P200_…json` (`behaviour.gaps`, `behaviour.closure`), from `approval scope --scope behaviour:RTNCDE00:P200-SET-RETURN-CODE:requirement=REQ-RTNCDE00-002,requirement=REQ-RTNCDE00-003,runtime_requirement=RT-RTNCDE00-001 --json`.
- Gap IDs are identical to the Step 12 handoff (regression test 12/13).

**Nothing is resolved here.** Every gap below stays OPEN and stays in the full-program report.

## Evidence the closure provides

| | |
|---|---|
| Source | `src/programs/batch/RTNCDE00.cbl` sha256 `7cb951ea1f418c19ddd61c0eca00f21108af5f364b5ecf05742cbc428862994e` |
| Closure status | RESOLVED; sha256 `3d6bf30c…` |
| Direct statements | lines 64–81, plus 83 (`P200-EXIT. EXIT`); range `P200-SET-RETURN-CODE THRU P200-EXIT` |
| Trigger | line 37 `WHEN RC-SET-CODE` (`RTNCODE.cpy:7`, value `'S'`) |
| Inputs | RC-NEW-CODE, RC-HIGHEST-CODE |
| Writers of those inputs elsewhere | `P100-INIT-RETURN-CODES` lines 54 (`INITIALIZE RC-CODES-AREA`) and 57 (`MOVE 0 TO RC-HIGHEST-CODE`); neither is SQL, and neither depends on an undeclared name |
| Units | RTNCDE00 (primary), RTNCODE (declares every referenced field and condition). **SQLCA is not in the closure.** |
| External operations | none (no embedded SQL, CALL or file I/O in the statements or the input writers) |
| Undeclared names used | none |

## Gaps

| Gap ID | In closure | Blocking | Missing information | Execution paths affected | Why it does (not) affect P200 | Evidence of independence | Handoff |
|---|---|---|---|---|---|---|---|
| `GAP-RTNCDE00-P200-SET-RETURN-CODE-TRUNC-RC-HIGHEST-CODE` | **yes** | no | compiler TRUNC option for binary `RC-HIGHEST-CODE` `S9(4)` (line 65) | inputs beyond ±9999 | **Proposed supported input domain**, not legacy behaviour: such an input must fail explicitly as an *unsupported pilot case*. No COBOL result or rejection is implied. | — | technical authority: the compile options (listing or JCL) |
| `GAP-RTNCDE00-P200-SET-RETURN-CODE-TRUNC-RC-CURRENT-CODE` | **yes** | no | same (line 68) | same | same | — | same |
| `GAP-RTNCDE00-P300-GET-RETURN-CODE-TRUNC-RC-RETURN-VALUE` | no | no | TRUNC option (line 86) | P300 inputs beyond ±9999 | P300 is not in the closure and writes nothing P200 reads | line 86 is not a closure statement or input writer | same |
| `GAP-RTNCDE00-P300-GET-RETURN-CODE-TRUNC-RC-HIGHEST-RETURN` | no | no | TRUNC option (line 87) | same | same | line 87, same | same |
| `GAP-RTNCDE00-P400-LOG-RETURN-CODE-SQLCODE` | no | yes | meaning of undeclared SQLCODE (lines 113–116) | request `'L'` | P400 writes only WS-CURRENT-TIME and RC-RESPONSE-CODE, neither of which P200 reads | none of lines 113–116 is a closure statement or input writer | DR-DB2CONN-002, DR-F2-0011-001 (technical authority) |
| `GAP-RTNCDE00-P400-LOG-RETURN-CODE-SQL-INSERT-RTNCODES` | no | yes | DB2 INSERT behaviour (line 96) | request `'L'` | the INSERT writes no field P200 reads | line 96 is outside the closure | database-interaction ADR at G3 |
| `GAP-RTNCDE00-P500-ANALYZE-CODES-SQLCODE` | no | yes | SQLCODE meaning (lines 135–138) | request `'A'` | P500 writes RC-TOTAL-CODES, RC-MAX-CODE, RC-MIN-CODE and RC-RESPONSE-CODE; P200 reads none of them | lines 135–138 are outside the closure | DR-DB2CONN-002, DR-F2-0011-001 |
| `GAP-RTNCDE00-P500-ANALYZE-CODES-SQL-SELECT-RTNCODES` | no | yes | DB2 SELECT behaviour (line 122) | request `'A'` | the SELECT writes only P500 outputs | line 122 is outside the closure | database-interaction ADR at G3 |

**Shared output, noted but not a dependency.** RC-RESPONSE-CODE is also written by P400 and P500, under SQLCODE, in *other* invocations. P200 always writes it as 0 and never reads it.
