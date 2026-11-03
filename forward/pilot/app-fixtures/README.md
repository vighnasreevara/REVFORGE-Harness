# Source-derived scenarios for the converted programs (STEP 17)

One JSON file per program: `forward/pilot/app-fixtures/<PROGRAM>.json`. The converter runs these scenarios against the generated Java after every conversion (`pilot convert-app`), and records them in the program's `pilot-result.json`.

**Expected results must be derived from the COBOL source**, from the copybooks it includes and from this contract. They must never come from running or reading the generated Java. A scenario author may read the following files:
- the program source and copybooks under `references/udara-legacy-modernization-harness/src/`;
- the `gaps` array in `forward/generated/java/<PROGRAM>/pilot-result.json`. It maps each gap to its COBOL source line. Read only that array.

## File format

```json
{
  "program": "PORTVALD",
  "provenance": "who wrote it, from which source, when",
  "scenarios": [
    {
      "id": "S01",
      "title": "what the source path does",
      "cobol_lines": [56, 57],
      "kind": "call",
      "set": { "LS-VALIDATE-TYPE": "A", "LS-RETURN-CODE": "0" },
      "datasets": { "PORTFILE": { "records": ["P0000001ACCT..."] } },
      "outputs": ["RPTFILE"],
      "sysin": ["line 1"],
      "parm": "TEXT",
      "clock": "2026-03-04T05:06:07.08Z",
      "expect": {
        "outcome": "GOBACK",
        "return_code": 0,
        "items": { "LS-RETURN-CODE": "2", "LS-ERROR-MSG": "Invalid Account Number format", "SOME-88-NAME": true },
        "display": ["exact DISPLAY lines in order"],
        "display_contains": ["one line that must appear"],
        "datasets": { "RPTFILE": ["record 1", "record 2"] }
      }
    }
  ]
}
```

Every key except `id`, `kind` and `expect` is optional.

### Kinds

**`kind: "call"`**
- The program is CALLed with its own LINKAGE records (those named in PROCEDURE DIVISION USING).
- `set` assigns items before the call.
- Normal end is `GOBACK`.

**`calls`** (with `kind: "call"`)
- A list of earlier CALLs of the same program in the same run unit, for example `[{ "set": {"LS-FUNCTION": "INIT", ...} }]`.
- WORKING-STORAGE persists between CALLs, as in COBOL, so a later function (NEXT, STAT, TERM) can depend on what an earlier one left.
- Each step's `set` is applied before that CALL. The scenario's own `set` is applied last, then the judged CALL runs.
- Do not use `set` on WORKING-STORAGE items to fake earlier state; use `calls`.

**`kind: "main"`**
- The program runs as the main program of a run unit.
- `parm` gives the z/OS PARM, passed as a halfword length followed by the text, to the first USING item.
- Normal end is `END`, including after STOP RUN or GOBACK.
- `return_code` is RETURN-CODE at the end.

### `outcome` values

| Value | Meaning |
|---|---|
| `GOBACK` | A call kind ended normally. |
| `END` | A main kind ended normally. |
| `STOP_RUN` | A called program executed STOP RUN. |
| `BLOCKED AT <file>:<line>` | The path reached the gap at that COBOL line. Use the gap's `origin.file` and `origin.line` from `pilot-result.json`. |
| `BLOCKED RUNTIME-SIZE-ERROR` | An arithmetic result exceeded its receiving item without ON SIZE ERROR. |
| `BLOCKED RUNTIME-TRUNC` | A value beyond the PIC digits was moved into a binary item. |
| `BLOCKED RUNTIME-ALNUM-TO-NUMERIC` | Non-digit content was moved into a numeric item without a static gap. |
| `ABEND S0C7` | Invalid numeric data was used, for example a numeric item that was never set and still holds LOW-VALUES. |
| `ABEND S0CB` | Division by zero without ON SIZE ERROR. |
| `ABEND SUBSCRIPT` / `ABEND REFMOD` | A subscript or reference modification was out of range. |

### Items

- `items` uses COBOL names.
- A name declared more than once is written `NAME OF PARENT`.
- A table element is written `NAME(i)`.
- A level-88 condition takes `true` or `false`.
- Numeric items take decimal strings: `"-12.50"`, `"0"`.
- Alphanumeric, group and edited items are compared right-trimmed.
- FILLER cannot be named.

### Datasets

- Datasets are keyed by DD name, which is the `ASSIGN TO` name.
- Each record is a string.
- Fixed-length (RECFM F and indexed) records are space-padded to the record length.
- Use JSON `\u00XX` escapes for COMP or COMP-3 bytes.
- Output datasets are compared record by record, right-trimmed.
- A dataset that is not listed in `datasets` or `outputs` is not allocated. OPEN then gives FILE STATUS 35.

## Run-time semantics

The legacy platform is IBM z/OS, which the JCL, VSAM and CICS sources establish. The generated Java follows these rules.

### Storage

- WORKING-STORAGE with a VALUE clause starts with that value.
- Storage without a VALUE clause starts as LOW-VALUES (X'00'). Reading such a numeric item gives ABEND S0C7.
- INITIALIZE sets alphanumeric items to spaces and numeric items to zero. FILLER and REDEFINES subordinates are skipped.

### Numeric representation

**Signed DISPLAY items without SEPARATE**
- The sign is overpunched in the last digit: `{ A B C D E F G H I` for +0 to +9, `} J K L M N O P Q R` for -0 to -9.
- For example, S9(4) holding +12 is stored and DISPLAYed as `001B`.

**Unsigned DISPLAY items** hold plain digits.

**COMP and COMP-3 items** are DISPLAYed as their digits, zero-padded to the PIC digit count, with a leading `-` only when the value is negative.

**DISPLAY of literals**
- An alphanumeric literal is shown as written.
- A numeric literal is shown as its plain value, for example `+1` shows as `1`.

### MOVE

- Alphanumeric receiving items are left-justified, space-padded and truncated on the right.
- Numeric receiving items keep the decimal alignment. Excess high-order and low-order digits are truncated.
- An unsigned receiving item stores the absolute value.
- A numeric item moved to an alphanumeric item moves its digits without the sign.
- Alphanumeric content moved into a numeric item is defined only when it is all digits. Anything else is a gap (BLOCKED).

### Arithmetic

- Results are truncated unless ROUNDED (rounding is half away from zero).
- A result too large for its receiving item takes ON SIZE ERROR if the statement has one; otherwise the outcome is BLOCKED RUNTIME-SIZE-ERROR.

### Comparisons

- Alphanumeric comparisons use the EBCDIC collating sequence: space < letters < digits.
- Equality comparisons pad the shorter operand with spaces.

### Files

- FILE STATUS follows the COBOL standard: 00 success, 10 end of file, 22 duplicate key, 23 record not found, 35 file missing on OPEN INPUT or I-O, 41 already open, 42 not open, 43 no prior READ for REWRITE or DELETE, and 46 to 49 for wrong operations.
- AT END and INVALID KEY branches follow the status.
- Indexed files are ordered by key in EBCDIC order.
- READ NEXT continues after the last record read or after the START position.

### Dates and times

- ACCEPT FROM DATE, DATE YYYYMMDD, TIME and DAY use `clock`.
- FUNCTION CURRENT-DATE gives YYYYMMDDHHMMSShh followed by the UTC offset `+hhmm`.

### Gaps

These are BLOCKED gaps, so a path that reaches one ends there:
- executable EXEC SQL and EXEC CICS statements;
- a CALL of a program outside the application;
- a PERFORM or GO TO of a paragraph the source does not define;
- an undeclared name;
- ACCEPT FROM TIME STAMP;
- FUNCTION RANDOM.

Declarative SQL has no run-time effect: INCLUDE, DECLARE, BEGIN/END DECLARE SECTION and WHENEVER.

### CALL

- A CALL of another application program runs the converted program.
- In per-program tests, only the program under test is registered. Unless the CALL has ON EXCEPTION, the outcome is then `BLOCKED RUNTIME-CALL-UNAVAILABLE`.

## What to cover

For each program, cover:
- every path that the source fully defines;
- boundary and invalid inputs where the source handles them;
- at least one path into each family of gaps that the main flow reaches, using `BLOCKED AT`.

Keep each scenario small and record the COBOL lines it relies on in `cobol_lines`. If the source is a template with no reachable defined behaviour, write a scenario that shows where it blocks.
