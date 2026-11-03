# SYNRC01: synthetic pilot specification

> **SYNTHETIC.** This program was written for the REVFORGE Step 11 conversion pilot. It is not taken from, not derived from and not equivalent to any program of the portfolio being modernised. It contains no confidential source.

## Purpose

SYNRC01 is a callable subprogram that keeps a caller-held severity summary of numeric codes. All state lives in the caller's 24-byte `SYN-REQUEST` area. The program keeps nothing between calls, except the working-storage item `WS-EXT-RC`.

## Interface: `SYN-REQUEST` (24 characters, all DISPLAY)

| Pos | Len | Field | PIC | Meaning |
|---|---|---|---|---|
| 1 | 1 | SYN-ACTION | X | `R` reset, `P` post, `Q` query, `U` publish |
| 2 | 5 | SYN-INPUT-CODE | S9(4) SIGN LEADING SEPARATE | code to post (`+0005`, `-0001`) |
| 7 | 5 | SYN-LAST-CODE | S9(4) SIGN LEADING SEPARATE | last accepted code |
| 12 | 5 | SYN-PEAK-CODE | S9(4) SIGN LEADING SEPARATE | highest accepted code |
| 17 | 1 | SYN-SEVERITY | X | `C` clear, `N` notice, `T` fault, `A` abort |
| 18 | 5 | SYN-OUT-CODE | S9(4) SIGN LEADING SEPARATE | query output |
| 23 | 2 | SYN-RESULT | 9(2) | result of this call |

## Behaviour

| Action | Effect |
|---|---|
| `R` reset | LAST, PEAK and OUT become `+0000`; SEVERITY becomes `C`; RESULT becomes `00`. |
| `P` post, input < 0 | **Error case.** RESULT becomes `20`; nothing else changes. |
| `P` post, input >= 0 | LAST := input. PEAK := input only if input > PEAK (equal keeps PEAK). SEVERITY := `C` for 0, `N` for 1–3, `T` for 4–11, `A` for anything else (12 and above). RESULT := `00`. |
| `Q` query | OUT := PEAK; RESULT := `00`. |
| `U` publish | **Unresolved.** Calls external program `SYNEXT01`, passing PEAK and `WS-EXT-RC`. RESULT becomes `00` if `WS-EXT-RC` is 0 after the call, otherwise `30`. `SYNEXT01` is deliberately **not provided**. Its behaviour, its effect on PEAK and the value it leaves in `WS-EXT-RC` are unknown. This is the pilot's preserved gap. |
| anything else (including lower-case letters) | **Error case.** RESULT becomes `90`; nothing else changes. |

Comparisons are numeric. Fields not mentioned above are unchanged.

## Test contract

- **Inputs.** Each fixture case gives the 24-character image before the call. The expected result is either the image after the call, or `BLOCKED` with the gap ID for a path that depends on the unresolved call.
- **Who wrote the expectations, and how.** The pilot author derived them from this specification by hand, and recorded them before any Java was generated. They were not produced by running the Java. They have not been reviewed by an independent human; treat them as specification-derived, not as reference behaviour.
- **COBOL reference run.** A reference run of the COBOL needs a COBOL compiler. With a compiler, `SYNDRV01` reads one image per line, calls `SYNRC01` and displays the resulting image. Without one, validation is fixture-based only, and no runtime COBOL/Java equivalence is claimed.
