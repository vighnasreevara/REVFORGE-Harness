# Evidence adjudication and signed evidence acceptance

This guide is for the operator, the business SME and the requirements approver.

## The layers (never interchangeable)

| Layer | Who | Record |
|---|---|---|
| Source evidence found | the resolver | context report |
| Deterministically verified | the adjudicator, re-following every chain from the original COBOL | `EAR-NNNN` (SOURCE_CHAIN_*) |
| Accepted by an authorized reviewer | a signed `resolved_no_change` that selects the exact `ESU-NNNN` | `RES-NNNN` |
| Human decision resolved | any signed resolution of the decision | `RES-NNNN` |
| Scope READY | no blocking finding remains | G2 scope evaluation |
| G2 PASS | a signed approval by a requirements approver, re-verified | `APR-NNNN` + gate result |

## What the adjudicator checks

```sh
verification context adjudicate [--scope programs:<P>] [--record]
```

It writes `forward/reports/step-10/evidence-adjudication*.json`, and with `--record` it seals `workflow/context/EAR-NNNN`.

**Newly supported findings** (the earlier check did not verify them, the dependency-aware check does). Every chain is re-followed: source hashes, permanent IDs, catalogue agreement (line, values, parent), every stated value and the citation. Classes:

| Class | Meaning |
|---|---|
| `SOURCE_CHAIN_VERIFIED` | complete |
| `SOURCE_CHAIN_PARTIAL` | something is missing or disagrees |
| `SOURCE_CHAIN_AMBIGUOUS` | a duplicate name |
| `SOURCE_CHAIN_CONTRADICTED` | the source says otherwise |
| `SOURCE_CHAIN_UNAVAILABLE` | the source changed or is missing |

**Questionable earlier verifications** (the earlier check verified them, the dependency-aware check does not):
1. **Reproduction.** The earlier check (`verifyTextClaim`) is reproduced exactly, and each value it matched is classified as `literal`, `number`, `word`, or `substring_of_name` (found only inside a data name such as `RC-HIGHEST-CODE`).
2. **Diagnosis:**
   - `INCORRECT_VERIFICATION_METHOD`;
   - `UNSUPPORTED_SOURCE_CITATION`;
   - `CORRECT_CLAIM_ALTERNATIVE_EVIDENCE` (other statements in the program support the value);
   - `INCORRECT_CLAIM`;
   - `GENUINE_SEMANTIC_UNCERTAINTY`;
   - `EARLIER_VERIFICATION_DEFENSIBLE`.
3. **Outcome.** If the earlier result rests only on substring matches (or the claim is contradicted), the record carries **`EVIDENCE_INVALIDATED`**. Otherwise it carries `EARLIER_VERIFICATION_CONFIRMED`.

## How G2 selects evidence (fail-closed)

- **An invalidated verification.** The latest `EAR` for an item that says `EVIDENCE_INVALIDATED` makes the G2 snapshot treat the earlier verification as **unverified**. If that record later goes stale (source or item changed), the item stays unverified until a fresh adjudication supersedes it. A stale record never re-enables a false verification.
- **Alternative evidence** is shown to reviewers but never counts automatically. A reviewer updates the citation through the normal correction or resolution path.
- **Evidence supplements** (`ESU-NNNN`) count only when all of these hold:
  - a signed `resolved_no_change` of the item's review decision names the **exact** supplement;
  - the supplement is the **latest version** for the item;
  - it is current (sealed, same baseline, same item and source bytes);
  - it is `CONTEXT_SUPPORTED`.

  Superseded, stale, partial, contradicted, advisory or citation-mismatch supplements never count.
- **Conflicts.** Disagreeing evidence is reported, and the unfavourable result applies.
- **Records.** Records are versioned and immutable; nothing is deleted or rewritten. An evidence change never resolves a decision.

## Signing an evidence acceptance (business SME)

```sh
approval package --scope programs:<P>            # plain-English package + fresh unsigned requests
decisions export-request --decision RVW-<item> --scope programs:<P> --out req.json
```

1. **Inspect** the cited lines and the dependency chain shown in the package. Read the source; the package only points to it.
2. **Fill in** `outcome: resolved_no_change` and `selected_option: ESU-NNNN`, plus `resolution_text`, `justification`, `signer_id`, `role: business_sme` and `resolved_at`.
3. **Sign** the canonical JSON outside REVFORGE.
4. **Verify, then import:**

   ```sh
   decisions verify-resolution --file signed.json
   decisions import-resolution --file signed.json
   ```

**A request becomes stale** when the decision content, an item hash, the baseline, the effective resolution or the expiry changes. It is then rejected at import, and `approval package` lists it under "stale earlier requests". Never sign a stale request: export a fresh one.
