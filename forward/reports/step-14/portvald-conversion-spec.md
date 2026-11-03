# PORTVALD: conversion specification, gap report and proposed Java design

> **Prepared, not converted.** No PORTVALD Java was generated. Generation is not authorised (see §6). This document is the complete, source-grounded basis for the first conversion once it is authorised. It is **non-authoritative**: not an approved F3/F4 output.

## 1. Source identity

| | |
|---|---|
| Program | `src/programs/portfolio/PORTVALD.cbl`, sha256 `5957fd22546258ae4d9e28847269168d1824bf8d11a9e661f9f62a5adc47f603`; 50 statements in 5 paragraphs |
| Copybook | `src/copybook/common/PORTVAL.cpy`, sha256 `8d9c7666b01561c4eba4d1e0a95b9da62baaa60c9dcfc2aa5effff06854104bf` (the only include; resolved) |
| External dependencies | **none**: no SQL, CICS, CALL or file I/O |
| F1 / F2 | delivered (REQ-PORTVALD-001..003, RT-PORTVALD-001..002, data record FIL-0074-REC-0001) |
| Engineering gate | **SOURCE_READINESS: PASS** (`reports/step-14/source-readiness-PORTVALD.json`) |

## 2. Interface (RT-PORTVALD-001)

`PROCEDURE DIVISION USING LS-VALIDATION-REQUEST` (103 bytes, passed by reference):

| Field | PIC | Role |
|---|---|---|
| LS-VALIDATE-TYPE | X(1) | `I`, `A`, `T` or `M` (88-levels LS-VAL-ID/ACCT/TYPE/AMT) |
| LS-INPUT-VALUE | X(50) | the value to validate (space-padded) |
| LS-RETURN-CODE | S9(4) COMP | output |
| LS-ERROR-MSG | X(50) | output (space-padded) |

**Constants** (PORTVAL.cpy, never modified by the program):
- return codes: VAL-SUCCESS 0, VAL-INVALID-ID 1, -ACCT 2, -TYPE 3, -AMT 4;
- messages: VAL-ERR-ID / -ACCT / -TYPE / -AMT;
- VAL-ID-PREFIX `'PORT'`;
- VAL-MIN-AMOUNT / VAL-MAX-AMOUNT ±9999999999999.99.

## 3. Behaviour, as written

| Behaviour | Lines | Class | As-written semantics |
|---|---|---|---|
| Dispatch | 33–49 | PARTIAL (it routes into the amount check) | INITIALIZE VAL-WORK-AREAS. `I`→1000, `A`→2000, `T`→3000, `M`→4000. **Otherwise** return code 1 and message `'Invalid validation type'`. Then GOBACK. |
| 1000 validate ID | 56–71 | VERIFIED | If `LS-INPUT-VALUE(1:4)` ≠ `'PORT'` → 1, `'Invalid Portfolio ID format'`. Otherwise `LS-INPUT-VALUE(5:4)` is moved into X(10), padded with 6 spaces, so `NOT NUMERIC` is **always true** → 1, same message. **No ID can pass as written.** |
| 2000 validate account | 77–86 | VERIFIED | If the **whole 50-character** value is not all digits, or is all zeros → 2, `'Invalid Account Number format'`. Otherwise 0, spaces. |
| 3000 validate type | 92–103 | VERIFIED | Exactly `STK`, `BND`, `MMF` or `ETF`, space-padded, case-sensitive → 0, spaces. Otherwise 3, `'Invalid Investment Type'`. |
| 4000 validate amount | 109–120 | **PARTIAL** | `MOVE LS-INPUT-VALUE (X(50)) TO VAL-TEMP-NUM (S9(13)V99)`. **Defined only for all-digit content** (the value is its low-order 13 digits, `.00`). It always lies within the full-range bounds → 0, spaces. **Any other content: not defined by the source** (gap). |

## 4. Gaps and preserved suspected defects

**Gap: unsupported behaviour, must fail explicitly.**

| | |
|---|---|
| ID | `GAP-PORTVALD-4000-VALIDATE-AMOUNT-ALNUM-TO-NUMERIC-VAL-TEMP-NUM` (blocking for that path) |
| Source | line 109 |
| What is missing | the result of moving non-digit, decimal, signed or space-padded content into a numeric item. It depends on the compiler and the data representation. |
| Java treatment | only all-digit input is supported. Anything else throws an explicit `UnsupportedLegacyBehaviourException(gap ID)`. No return code is invented. |
| Needed | the business rule for amount input (SME), or the compile options plus a captured legacy run |

**Suspected defects: known behaviour, preserved, not corrected.**

| Decision | Behaviour preserved | Who decides |
|---|---|---|
| DR-PORTVALD-001 | type `I` never succeeds | business SME: keep or correct (a correction changes behaviour and needs approval) |
| DR-PORTVALD-002 | account must be 50 digits | business SME |
| DR-PORTVALD-003 | the amount range check can never fail | business SME |

**Advisory:**
- DR-F2-PKT0010-002 (code page) matters only for byte-level interchange with COBOL callers.
- The return-code values are constants 0–4, so no TRUNC hazard exists.

## 5. Proposed Java 21 design (non-authoritative)

| Element | Responsibility | COBOL |
|---|---|---|
| `ValidationRequest` (mutable, caller-owned) | `type` (char), `inputValue` (String, exactly 50 characters, space-padded), `returnCode` (int), `errorMessage` (String, 50 characters) | lines 21–29 |
| `PortfolioValidator.validate(ValidationRequest r)` | dispatch, as written; WHEN OTHER → 1 and `"Invalid validation type"` | 33–49 |
| `validateId`, `validateAccount`, `validateType` | as-written semantics, including the preserved suspected defects | 52–103 |
| `validateAmount` | all-digit content → 0; anything else → `UnsupportedLegacyBehaviourException` (gap) | 105–120 |
| `Cobol.isNumeric(String)`, `Cobol.pad(String, int)` | the NUMERIC class test (every character `0`–`9`) and space padding | — |

- **No framework, no I/O, no external dependency.**
- **Tests:** JUnit 5 or a plain runner; the 17 source-derived cases are in `portvald-test-cases.json` (V01–V17).
- **Expected conversion label: PARTIAL.** The amount path is unsupported for non-digit input. It may be COMPLETE only if the gap is resolved.
- **Validation:** CONVERSION_VALIDATION (engineering gate 2) then checks compilation, tests, statement traceability, the explicit unsupported path and the label. Without a COBOL reference run, validation is fixture-based and equivalence stays **UNVERIFIED**.

## 6. Why no Java was generated

The existing generation guard, which the two engineering gates do **not** replace, reports `generation_authorized: false`:
1. `generation.java_generation_allowed` is `false`. Only the project authority may change it.
2. No `orchestrator.java_target_dir` is authorised.
3. G4 is BLOCKED: generation requires G4 PASS, which needs signed G2 (PORTVALD: NOT_READY, 11 blocking), G3 and G4 approvals.
4. The trust store is not configured, so no approval can be signed.

**No other path would be valid:**
- the local deterministic generator converts **synthetic** programs only, by design;
- the F5 agent path (Claude through BMad) additionally needs a signed source-disclosure authorisation, an isolated runner and egress, none of which exist.
