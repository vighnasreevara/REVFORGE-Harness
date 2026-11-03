# COBOL source-context verification

This guide is for the operator and the reviewers who evaluate requirement evidence.

## What it does

The existing claim check compares the values a requirement states with the text of its cited statement. It misses business values declared elsewhere, such as a level-88 condition in a copybook, and it matches single-letter values as plain substrings.

The dependency-aware verifier (`verification/src/context.ts`, `runtime/src/context/context.ts`) re-checks each cited executable statement against the original COBOL:

1. **Statement range.** It takes the statement range from the parser's permanent statement ID; a cited line outside the range is a `CITATION_MISMATCH`.
2. **Logical text.** It reads the statement's logical text:
   - fixed-format sequence and identification areas are dropped;
   - comment lines are skipped;
   - continued literals are joined;
   - literals are kept apart from data names.
3. **Resolution.** It resolves every data and condition name the statement uses through the COPY-expanded DATA DIVISION. For each it records:
   - the declaring file and line;
   - the parent item and the record;
   - the declared VALUE(S);
   - the COPY inclusion chain, nested copybooks included;
   - `OF`/`IN` qualification.

   Duplicate names are **ambiguous** until qualified; names it cannot find stay **undefined**; unresolvable or circular COPY members are reported.
4. **Support for each stated value.** A value is supported only if it is in the statement itself, or is the declared VALUE of a condition the statement actually `SET`s or tests. A value that merely occurs elsewhere is reported as `unrelated_occurrence_only` and never counts.
5. **Permanent IDs.** It attaches permanent IDs from the reverse data catalogue (condition ID, parent field ID) and cross-checks the catalogue's line, values and parent against the source. Disagreements are reported.
6. **Contradictions.** A claim that pairs a label with a value (e.g. `SEVERE ('F')`) is a contradiction when the referenced condition with that label declares a different value.

## Verification levels (kept apart)

| Level | Meaning |
|---|---|
| `symbol_exists` | a referenced name is declared |
| `symbol_resolved` | it resolves unambiguously |
| `value_declared` | it declares VALUE(S) |
| `statement_references` | the cited statement SETs or tests it |
| `runtime_effect_supported` | the statement SETs it (assigns the value to the parent item) |
| `business_interpretation` | always `not_established_requires_human` |

**Statuses:** `CONTEXT_SUPPORTED`, `CONTEXT_PARTIAL`, `CONTEXT_UNSUPPORTED`, `CONTEXT_UNRESOLVED`, `CONTEXT_CONTRADICTED`, `CITATION_MISMATCH`, `SOURCE_UNAVAILABLE`, `NOT_APPLICABLE`.

## Commands

```sh
verification context doctor                        # source root, parser statements, data catalogue, symbol indexes
verification context check --item REQ-...          # one item, read-only, every chain and level listed
verification context report --scope programs:<P> [--record] [--export-dir DIR]
```

`report --record`:
- seals `workflow/operations/context-report-NNNN`;
- records **evidence supplements** (`workflow/context/ESU-NNNN`, contract `verification/evidence-supplement`).

**Supplements are versioned and immutable:**
- identical content is not recorded twice;
- a changed result is a new version that names the one it supersedes.

**Advisory supplements** document items the existing check accepted but the dependency-aware check does not support. They cannot be accepted as evidence.

## How G2 uses it

A supplement has **no effect** on its own: it never resolves a decision, changes an outcome or alters a requirement or receipt.

When a current supplement with status `CONTEXT_SUPPORTED` exists for an item, the item's review decision (`RVW-<item>`) also offers `resolved_no_change`. The authorized role (policy: `business_sme`) may then sign that outcome with `selected_option = ESU-…`. Only then do the item's REQUIRES_EVIDENCE components count as verified.

**The selection is refused when:**
- the supplement is stale (item, source or baseline changed);
- it is partial, contradicted or a citation mismatch;
- it concerns another item.

**Re-verified at every evaluation.** A source change after acceptance makes the item block again. G2 still requires a signed approval.
