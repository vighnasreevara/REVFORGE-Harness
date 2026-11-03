# Gap handoff demonstration (synthetic pilot)

> **SYNTHETIC.** This demonstration uses only `forward/pilot/synthetic-rc/cobol/SYNRC01.cbl`, written for this step. It is not taken from, derived from or equivalent to any portfolio program.

## The deliberately unresolved dependency

`A400-PUBLISH` (SYNRC01.cbl line 81) contains `CALL 'SYNEXT01' USING SYN-PEAK-CODE WS-EXT-RC`. **No source exists for SYNEXT01.**

## What REVFORGE did with it

Every row comes from the real run of `pilot run`, via `pilot-result.json` and `source-map.json` (copied to `reports/step-11/pilot/`).

| Requirement | Result |
|---|---|
| Identify the dependency | `GAP-SYNRC01-0001`, kind `UNDEFINED_EXTERNAL_CALL`, subject `SYNEXT01`, status `OPEN` |
| Preserve its original context | Origin `SYNRC01.cbl:81` (sha256 recorded), paragraph `A400-PUBLISH`, plus the paragraph excerpt (lines 80–86) |
| Trace what depends on it | Affected items: `SYN-PEAK-CODE`, `WS-EXT-RC` (passed by reference). Dependent statements: the CALL (81); `IF WS-EXT-RC = 0` (82); the MOVEs nested under it (83, 85). Reached from `PERFORM A400-PUBLISH THRU A400-EXIT` (line 40), the dispatch branch `SYN-ACT-PUBLISH` (`'U'`). |
| Trace to Java | Interface `ExternalSynext01.java` (documents the parameters and that its behaviour is UNKNOWN). Placeholder `UnresolvedSynext01.java` (**INCOMPLETE PLACEHOLDER**, always throws). Call site `Synrc01.java` line 108, in method `a400Publish`. |
| Explicit placeholder only where appropriate | Only at the unresolved call. The source-verified statements after the call (82–85) are translated faithfully, but they cannot run without a real implementation. |
| Keep the dependent path blocked | Fixture C15 (`U…`) produced `BLOCKED GAP-SYNRC01-0001`: BLOCKED_AS_EXPECTED |
| Keep testing unrelated verified behaviour | Reset, post (boundaries 0/1/3/4/11/12/9999, equal and lower peak, negative error), query and unknown action: 14/14 PASS |
| No guessed default | No default return value is used. `WS-EXT-RC` has no VALUE clause; the audit notes that it is read only after the gap writes it. |
| Status | **PARTIAL**: it compiles and every verified path matches, but one gap remains open. The `pilot/pilot-result` contract rejects `COMPLETE` while gaps exist. |

## Refusal of fabricated behaviour (tests)

- **Unsupported construct.** Replacing a MOVE with `COMPUTE … * 2` makes the pilot **FAILED** at inspection (`statement COMPUTE`); no Java is generated.
- **Undeclared name.** A reference to a name declared nowhere becomes an `UNDECLARED_NAME` gap, and generation is refused: there is no type to translate, so none is guessed.

## How this maps to RTNCDE00 (planning only)

The same pattern is proposed for the RTNCDE00 response codes after SQL (see `rtncde00-architecture-preview.md` §4). The unresolved `SQLCODE` meaning (DR-DB2CONN-002 / DR-F2-0011-001) would sit behind a port whose only implementation throws, until a `technical_authority` signs a resolution. **Nothing was generated for RTNCDE00.**
