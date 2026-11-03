# P200 "set return code": proposed Java design

> **NON-AUTHORITATIVE.** Not an F3 deliverable, not approved (G2 UNVERIFIED, G3 BLOCKED). **No RTNCDE00 Java was generated.** The synthetic SYNRC01 pilot of Step 11 is a fixture, not evidence for this design.

## Scope

| | |
|---|---|
| Behaviour | `RTNCDE00:P200-SET-RETURN-CODE`, lines 64–81 (`PERFORM P200-SET-RETURN-CODE THRU P200-EXIT`) |
| Candidate content sha256 | `50ce87acb17377c8989de885e326578cda0a14c8977931c962d87e480cee8bfa` |
| Requirements | REQ-RTNCDE00-002 (`88a2aeb7…`, BR-039); REQ-RTNCDE00-003 (`ec665cc5…`, BR-040); RT-RTNCDE00-001 (`df9759ab…`) |
| Overlapping, **not** in the subset | REQ-RTNCDE00-001 (it also covers P400/P500) |
| Excluded | the dispatch (lines 33–49), P100, P300, P400, P500, NO-MATCH, all SQL, and any byte-level layout or code page |

## Responsibilities

| Java element | Responsibility | COBOL |
|---|---|---|
| `ReturnCodeState` (value object) | The four caller-owned fields P200 reads or writes: `newCode`, `highestCode`, `currentCode` (int, S9(4) binary), `status` (enum `SUCCESS('S')`, `WARNING('W')`, `ERROR('E')`, `SEVERE('F')`, plus `UNSET(' ')`), `responseCode` (int, S9(8) binary). Other area fields are not modelled here. | RTNCODE.cpy lines 13–22 (FLD-000009, -010, -011, -013..016, -018) |
| `SetReturnCode.apply(ReturnCodeState s)` | 1. If `s.newCode > s.highestCode` (signed), set `highestCode := newCode`. 2. `currentCode := newCode`. 3. `status := classify(newCode)`. 4. `responseCode := 0`. | lines 64–66, 68, 70–79, 81 |
| `SeverityClassifier.classify(int code)` | 0 → SUCCESS; 1..4 → WARNING; 5..8 → ERROR; otherwise (including negatives) → SEVERE | lines 70–79; RTNCODE lines 17–20 |
| `CodeDomain.require(int v)` | Rejects values outside −9999..9999 with `IllegalArgumentException`. This is a proposed **domain restriction**: the COBOL result for such values depends on the unknown TRUNC option (gaps `…TRUNC-RC-HIGHEST-CODE`, `…TRUNC-RC-CURRENT-CODE`). It is never a silent truncation. | lines 65, 68 |

**Error behaviour.**
- P200 has no error path in the source; it always ends with response 0.
- The only Java exception is the domain restriction above, for inputs the source does not define.

**Boundaries.**
- There is no port: P200 needs no unresolved dependency.
- It is invoked directly. The dispatcher that maps `'S'` to it belongs to REQ-001, which is excluded until that requirement is split or the SQLCODE decisions are resolved.

**No framework.** Plain Java 21; JUnit 5 for tests (to be justified in the G3 ADR).

## Test oracle

**Source-derived:** expected values follow the statement semantics of lines 64–81 and the 88-level values. This is **not** a legacy execution: no COBOL compiler is available, so **no equivalence is claimed**. The cases are in [`p200-proposed-tests.json`](p200-proposed-tests.json).

| ID | Input (new, highest, response before) | Expected (highest, current, status, response) | Covers |
|---|---|---|---|
| T01 | 0, 0, 8 | 0, 0, S, 0 | WHEN 0; response overwritten |
| T02 | 1, 0, 0 | 1, 1, W, 0 | lower WARNING boundary; new highest |
| T03 | 4, 9, 0 | 9, 4, W, 0 | upper WARNING boundary; highest kept |
| T04 | 5, 5, 0 | 5, 5, E, 0 | lower ERROR boundary; equal keeps highest |
| T05 | 8, 3, 0 | 8, 8, E, 0 | upper ERROR boundary |
| T06 | 9, 8, 0 | 9, 9, F, 0 | first OTHER value |
| T07 | −1, 0, 0 | 0, −1, F, 0 | negative: OTHER; signed comparison |
| T08 | 9999, −9999, 0 | 9999, 9999, F, 0 | upper PIC limit |
| T09 | −9999, −9999, 0 | −9999, −9999, F, 0 | lower PIC limit; equal keeps |
| T10 | 2, −5, 0 | 2, 2, W, 0 | negative stored highest |
| T11 | 10000, 0, 0 | **rejected** (domain restriction) | `GAP-…TRUNC-*`: excluded behaviour |
| T12 | any valid | fields P200 does not write are unchanged | control-flow boundary |

## Traceability (COBOL → requirement → Java)

| COBOL line | Statement | Requirements | Java |
|---|---|---|---|
| 64–66 | `IF RC-NEW-CODE > RC-HIGHEST-CODE` / `MOVE RC-NEW-CODE TO RC-HIGHEST-CODE` | REQ-002 (cited), RT-001 | `apply` step 1 |
| 68 | `MOVE RC-NEW-CODE TO RC-CURRENT-CODE` | REQ-002 | `apply` step 2 |
| 70–79 | `EVALUATE RC-NEW-CODE … SET RC-STATUS-…` | REQ-003 (cited), RT-001 (cited) | `SeverityClassifier.classify` |
| 81 | `MOVE 0 TO RC-RESPONSE-CODE` | REQ-003 | `apply` step 4 |

**Outputs not named in any requirement.** RC-CURRENT-CODE, RC-RESPONSE-CODE and RC-STATUS are not named literally (the requirement text says "current code", "response code" and SUCCESS/…). The reviewer must confirm the wording covers them (`output_specification` in the manifest).
