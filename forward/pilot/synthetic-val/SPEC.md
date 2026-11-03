# SYNVAL01: synthetic converter fixture

> **SYNTHETIC.** This program was written for the Step 15 converter tests. It is not taken from, derived from or equivalent to any program of the portfolio being modernised.

## Purpose

SYNVAL01 is an order-entry validation subroutine. It exercises the construct families the local converter now supports:
- a copybook in WORKING-STORAGE, with groups, decimal scale and VALUE continuation;
- a binary return code;
- reference modification, the NUMERIC class test and comparison with ZEROS;
- abbreviated combined relations, AND/OR conditions;
- `EXIT PARAGRAPH`, INITIALIZE of a group, and a named entry paragraph;
- one undefined alphanumeric-to-numeric MOVE.

## Interface `OV-REQUEST`

| Field | PIC | Meaning |
|---|---|---|
| OV-KIND | X | `C` code, `Q` quantity, `S` status, `P` price |
| OV-VALUE | X(12) | the value to check (space-padded) |
| OV-RC | S9(4) COMP | result code |
| OV-MESSAGE | X(30) | message (space-padded) |

## Behaviour

| Kind | Rule | Failure result |
|---|---|---|
| `C` | `OV-VALUE(1:4)` must equal `'ORD-'`, and `OV-VALUE(5:3)` must be all digits | 11, `Order code rejected` |
| `Q` | `OV-VALUE(1:4)` must be all digits and not `'0000'` | 12, `Quantity rejected` |
| `S` | `OV-VALUE` must be exactly `NEW`, `HLD` or `CAN` (space-padded, case-sensitive) | 13, `Status rejected` |
| `P` | `OV-VALUE(1:7)` is moved into `OV-PRICE` (`S9(7)V99`) and must lie within 1.00–5000.00 inclusive | 14, `Price out of range` |
| other | — | 19, `Unknown request kind` |

**On success** the result code is 0 and the message is spaces. Every path writes both outputs.

**The price MOVE is only defined for all-digit content.** For all-digit content the value is a whole number of units with `.00` decimals. For any other content the result is **not defined by the source**: the converter must preserve it as a gap and fail that path explicitly.

## Test contract

- **Harness format.** The interface contains a binary field, so the harness uses one line per call: `kind|value|rc|message`. Alphanumeric fields are right-trimmed on output.
- **Expectations.** They were derived by hand from this specification before any Java was generated.
- **No reference run.** No COBOL compiler is available, so there is no reference run and no equivalence claim.
