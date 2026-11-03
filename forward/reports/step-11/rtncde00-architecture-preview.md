# RTNCDE00: Java architecture preview

> **NON-AUTHORITATIVE PREVIEW** for human review and pilot planning only. It is not an F3 deliverable, has no receipt, and is not approved (G3 is BLOCKED). No F3 agent was dispatched; the workflow was not advanced. It may change completely once the open decisions are resolved.

Each statement below is labelled:
- **[C]** a confirmed design constraint, established from the original COBOL (with line references);
- **[P]** a proposed Java design choice, not established by the source and needing approval;
- **[GAP]** behaviour that is not established and stays a preserved gap.

## 1. Execution model

- **[C]** RTNCDE00 is a callable subprogram: `PROCEDURE DIVISION USING RC-REQUEST-AREA` (line 32), ending with `GOBACK` (line 51). There is no file I/O, no CALL and no CICS.
- **[C]** Every input, output and piece of state lives in the caller's area; the program keeps nothing between calls. The only working storage is the timestamp scratch area (lines 15–23) and the included SQLCA area (lines 25–26).
- **[P]** Plain Java 21 library, no framework. Nothing in the source justifies Spring, Spring Batch or any persistence framework. A database access technology (JDBC or other) is **not chosen** here; it belongs behind the ports in §4 and needs its own ADR.

## 2. Entry point and contracts

- **[C] Interface record.** The record is the `RTNCODE` copybook (`01 RETURN-CODE-AREA`), copied inside `01 RC-REQUEST-AREA` (lines 29–30). It contains:
  - RC-REQUEST-TYPE X;
  - RC-PROGRAM-ID X(8);
  - RC-CURRENT-CODE, RC-HIGHEST-CODE, RC-NEW-CODE S9(4) COMP;
  - RC-STATUS X with 88-levels S/W/E/F;
  - RC-MESSAGE X(80);
  - RC-RESPONSE-CODE S9(8) COMP;
  - RC-START-TIME and RC-END-TIME X(26);
  - RC-TOTAL-CODES S9(8) COMP;
  - RC-MAX-CODE and RC-MIN-CODE S9(4) COMP;
  - RC-RETURN-VALUE and RC-HIGHEST-RETURN S9(4) COMP;
  - RC-RETURN-STATUS X.
- **[GAP] Open interface questions.** Whether this record is the authoritative contract for every caller is open (DR-F2-0005-010, non-blocking). So is the byte layout under the nested 01.
- **[P] Entry point.** `ReturnCodeService.handle(ReturnCodeArea area)` mutates a caller-owned `ReturnCodeArea` value object whose fields mirror the record one to one.
- **[P] Byte-image serialisation.** Only if a byte-level contract with COBOL callers is required, and only after the code-page decision (DR-F2-PKT0010-002) and the binary-field decisions (§5).

## 3. Behaviour components

| Component | Source | Status |
|---|---|---|
| `RequestDispatcher`: `I`/`S`/`G`/`L`/`A`; any other value does nothing and leaves the response unchanged (no WHEN OTHER) | lines 33–49; RTNCODE lines 6–10 | [C], from VERIFIED and PARTIAL evidence |
| `Initializer`: INITIALIZE RC-CODES-AREA (numeric to 0, RC-STATUS to space), then program ID to spaces, codes to 0, status `S`, response 0 | lines 54–59 | [C] |
| `SeverityClassifier`: 0 → `S`; 1–4 → `W`; 5–8 → `E`; OTHER (including negatives) → `F` | lines 70–79; RTNCODE lines 17–20 | [C], VERIFIED |
| `HighestCodeTracker`: replace only when new > highest (signed); current := new; response 0 | lines 64–68, 81 | [C], VERIFIED via RT-001 |
| `ResultReader`: copies current, highest and status to the return fields; response 0 | lines 86–89 | [C] |
| `LogRowBuilder`: timestamp = first 16 characters of CURRENT-DATE (`YYYYMMDDHHMMSShh`), program ID, current, highest, status, message | lines 94–110 | [C] independent portion of RT-002 |
| Response after SQL (`L`, `A`) | lines 113–117, 135–139 | **[GAP]** DR-DB2CONN-002, DR-F2-0011-001 |

**[P]** The current time comes from an injected `java.time.Clock`, so tests are deterministic.

## 4. Interfaces for unresolved dependencies

- **[C] Two embedded SQL operations** use table RTNCODES (definition in `src/database/db2/RTNCODES.sql`, sha256 `3a2ca982…`):
  - an INSERT of one row (lines 96–111);
  - a singleton SELECT of COUNT, MAX and MIN over a program and time window (lines 122–133).
- **[P] Ports:**
  - `ReturnCodeLog.insert(LogRow)` returns an `SqlOutcome`;
  - `ReturnCodeAnalytics.analyse(programId, start, end)` returns an `SqlOutcome` plus the count, max and min.
- **[GAP] Mapping the SQL outcome to RC-RESPONSE-CODE.** The source maps `SQLCODE = 0` to 0 and anything else to 8. What `SQLCODE` is, and therefore what the `SqlOutcome` must carry, is unresolved.
  - **Until it is resolved,** the only implementation is an explicit placeholder that throws `UnresolvedGapException("DR-DB2CONN-002")`, the same pattern proven in the synthetic pilot.
  - **Never** a default like "success unless an exception".
- **[GAP] Other SQL runtime behaviour** that is not established:
  - the conversion of the 16-character host variable into a DB2 `TIMESTAMP`;
  - the empty-window result (MAX/MIN NULL without indicator variables);
  - duplicate-key handling on the `(TIMESTAMP, PROGRAM_ID)` primary key.

## 5. Numeric and character semantics

- **[C]** Codes are `S9(4) COMP` (binary), the response is `S9(8) COMP`, and the code comparison is signed (line 64).
- **[GAP] Range of S9(4) COMP.** Under compiler option TRUNC(STD) a MOVE truncates to ±9999; under TRUNC(BIN) the full halfword range is −32768..32767. The compiler options are not in the repository.
- **[P]** Java `int` holds every candidate value. Truncation stays unimplemented until the option is known, and values outside ±9999 are rejected at the boundary rather than silently truncated.
- **[GAP] Alphanumeric encoding.** The code page of the alphanumeric fields is open (DR-F2-PKT0010-002). It matters only for byte-level interchange.

## 6. Error handling

- **[C]** The program has no error handling beyond the response code. It never ABENDs on purpose. An unknown request type is silently ignored.
- **[P]** Java mirrors this: there are no exceptions for business outcomes. `UnresolvedGapException` exists only to block unresolved paths, and is never caught and turned into a response code.

## 7. Test boundaries

| Boundary | Status |
|---|---|
| Unit: dispatcher, initializer, classifier, highest tracking, result reader | runnable after G2 + G3 |
| Port contract tests (log, analytics) with an in-memory fake | the fake may assert the **calls**, never invent SQL outcomes |
| Response-after-SQL tests | blocked until DR-DB2CONN-002 / DR-F2-0011-001 |
| Equivalence with COBOL | needs a trusted COBOL/DB2 reference run; none is available (no COBOL compiler here) |

## 8. Missing external behaviour (summary)

- **The real SQLCA member,** with declarations of SQLCODE and SQLERRMC.
- **DB2 behaviour:**
  - timestamp conversion;
  - NULL aggregates;
  - the duplicate-key outcome.
- **Compiler TRUNC option.**
- **Caller contract and code page.**
- **Inclusive window and THRU semantics.** These are DR-RTNCDE00-001 (non-blocking); the THRU ranges contain only EXIT paragraphs in the source.
