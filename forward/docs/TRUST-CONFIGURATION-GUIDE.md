# Trust configuration guide (key custodian)

This guide is for the organization's **key custodian** and the operator who runs the REVFORGE forward runtime.

**What the runtime trusts.** Human authority comes from Ed25519 signatures, checked against an **external trust store** that you provision. The harness never:
- generates a signing key;
- creates or trusts an identity on its own;
- stores a private key.

**Without a trust store:**
- `workbench trust` reports `TRUST_NOT_CONFIGURED`;
- no decision resolution, requirements approval or source-export authorization can be imported;
- G2 stays `UNVERIFIED`.

## 1. Roles the runtime checks

| Role | Authority | Where it is checked |
|---|---|---|
| `requirements_approver` | Signs the G2 approval statement for a READY scope. Cannot be the requester. | `workflow approval import` |
| `business_sme` | Signs business, review and scope decision resolutions (and scope decisions together with `product_owner`). | `workflow decisions resolve` |
| `product_owner` | Signs scope decisions. | `workflow decisions resolve` |
| `technical_authority` | Signs technical, data-layout and runtime-semantics decisions. | `workflow decisions resolve` |
| `exception_approver` | Signs `approved_exception` outcomes. Only for items that lack evidence; never for contradicted items. | `workflow decisions resolve` |
| `data_owner` | Signs source-export authorizations and revocations for independent OpenAI verification. | `verification openai authorize` / `revoke` |
| `architecture_approver` | Signs the G3 approval of one exact F3 architecture for a G2-approved scope. | `workflow approval import` (signed-design-approval, gate G3) |
| `technical_authority` (G3 co-approval) | Must also sign G3 when an ADR changes legacy behaviour (`behavior_change: true`). The signer must differ from the architecture approver. | `workflow approval import` (gate G3) |

**Configuration.** Role names and which decision kinds need which roles are set in `forward/config/forward.config.json` (`approval.roles`, `openai_verification.source_export.required_roles`). Changing them changes the policy digest and invalidates existing approvals. The G3 roles are fixed in the runtime's design-approval policy (`DESIGN_POLICY`, digest bound into every G3 request); see [DESIGN-APPROVAL-OPERATIONS.md](DESIGN-APPROVAL-OPERATIONS.md). There is no story-approval role: the former G4 story-set approval was replaced by an automated story validation, so a `story_approver` entry in a trust store grants nothing.

## 2. Provision signers

1. **Each person generates their own key pair** on a machine or HSM they control. The private key never leaves it.

   ```sh
   openssl genpkey -algorithm ed25519 -out ~/.keys/revforge-<name>.pem
   openssl pkey -in ~/.keys/revforge-<name>.pem -pubout -out <name>.pub.pem
   ```

2. **Verify each person's identity and authority** through your normal organizational process, out of band, before accepting their public key.

3. **Write the trust store.** It follows the contract `forward/contracts/orchestrator/approval-trust-store.schema.json`:

   ```json
   {
     "contract": "approval-trust-store",
     "contract_version": "1.0",
     "issued_by": "<custodian name / office>",
     "issued_at": "2026-11-01T09:00:00Z",
     "signers": [
       { "signer_id": "<id>", "display_name": "<name>", "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n", "roles": ["business_sme"], "valid_until": "2027-11-01T00:00:00Z" }
     ]
   }
   ```

   **Separation of duties:** give the requester, the SMEs and the requirements approver different identities. Self-approval is rejected.

4. **Store the file outside the workflow** (not under `forward/runs/` or `output/`) and make it read-only for the operator account. The runtime refuses a trust store that:
   - contains private key material;
   - lives in a workflow-writable location;
   - fails its contract.

   It ignores signers whose ID looks like an agent or automation identity (`F1`–`F7`, `fe-*`, `runtime`, `claude*`, …).

5. **Point the runtime at it:**

   ```sh
   export REVFORGE_APPROVAL_TRUST_STORE=/secure/revforge/trust-store.json
   ```

   Alternatively, set `approval.trust_store` in the configuration.

6. **Validate before installing (STEP 8).** Run `trust doctor --file <candidate>` and `trust roles --file <candidate>` against the file before pointing the runtime at it.
   - It checks location, contract, private-key absence, Ed25519 key format, one key per identity, known roles, validity windows, revocation, optional `scopes` restrictions, conflicting role combinations and role coverage.
   - `trust verify-signature --signer <id> --message <file> --signature <b64>` proves a signer's key matches the trusted public key.
   - A placeholder-only template is at `forward/config/examples/trust-store.example.json`.

   **Scope restriction:** a signer entry may list `scopes` (for example `["programs:RTNCDE00"]`). Such a signer can only sign resolutions, approvals and disclosure authorizations for those scopes.

7. **Check the result:**

   ```sh
   node forward/dist/runtime/src/cli.js workbench trust --run <RUN> --scope <scope>
   ```

   This reports `TRUST_CONFIGURED`, or `TRUST_INCOMPLETE` with the roles that have no valid signer.

## 3. Sign and verify a decision resolution

1. **Export the request** (the operator):

   ```sh
   workflow decisions template --decision <ID> --out req.json
   ```

   `workbench report` also writes one request per blocking decision to `forward/reports/step-5.5/resolution-requests/`.

2. **Complete it** (the authorized person). Fill in:
   - `outcome`: one of `allowed_outcomes`;
   - `selected_option` (for citation corrections, the proposal ID);
   - `resolution_text`;
   - `justification`;
   - `signer_id`;
   - `role`: one of `required_roles_by_outcome[outcome]`;
   - `resolved_at`.

   Do not change the binding fields: `decision_sha256`, `baseline_manifest_sha256`, `affected_*` and `original_problem`.

3. **Sign the canonical JSON:**

   ```sh
   node -e "const {canonicalize}=require('./forward/dist/runtime/src/approval/canonical');process.stdout.write(canonicalize(JSON.parse(require('fs').readFileSync('req.json','utf8'))))" > req.canonical
   openssl pkeyutl -sign -inkey ~/.keys/revforge-<name>.pem -rawin -in req.canonical | base64 -w0 > req.sig
   ```

   Wrap the result as `{"contract":"signed-decision-resolution","resolution":<req.json>,"signature":{"algorithm":"ed25519","value":"<req.sig>"}}`.

4. **Verify, then record:**

   ```sh
   workflow decisions resolve --file signed.json --dry-run   # verify only
   workflow decisions resolve --file signed.json             # record
   ```

   Every check is listed:
   - signature, role and not-an-agent;
   - binding to the decision content, the baseline, the affected items and their hashes;
   - outcome allowed;
   - supersession;
   - not replayed;
   - timestamp.

   A rejection is written to the audit log.

## 4. Citation corrections (technical reviewer)

1. **Review** `forward/reports/step-5.5/correction-review.json`, which shows:
   - the original and proposed line text;
   - the current source hashes;
   - a fresh re-derivation from the source.

2. **If the correction is right,** sign the item's review decision (`RVW-…`) with:
   - `outcome: resolved_requires_update`;
   - `selected_option`: the proposal ID.

3. **Then apply it:**

   ```sh
   workflow correct --packet <PKT> --file draft_requirements.json --pointer <pointer> --kind citation_line --proposal <RP-…> --authorized-by <RES-…> --reason "<why>"
   ```

   The runtime applies it only if all of these hold:
   - the resolution is the effective, signature-verified one;
   - it names this proposal;
   - the item and source hashes are unchanged;
   - re-deriving the citation from source gives the same value.

   The original deliverable is never modified; a versioned overlay is written instead.

## 5. Revocation

- **A signer:** set `"revoked": true` (or a past `valid_until`) in the trust store. Every resolution, approval and authorization signed by that signer stops counting at the next evaluation.
- **A source-export authorization:** the data owner signs a `source-export-revocation` and the operator runs `verification openai revoke --file signed-revocation.json`.
- **Rotation:** add the new key under a new `signer_id`, then revoke the old one.

## 6. Requirements approval for a scope

```sh
workflow g2 evaluate --scope <scope>                                              # must be READY
workflow approval request --scope <scope> --requested-by <operator id>          # AREQ-NNNN (immutable, digest-bound)
workflow approval statement --request AREQ-NNNN --signer <approver id> --role requirements_approver --decision approved --out stmt.canonical
openssl pkeyutl -sign -inkey ~/.keys/revforge-<approver>.pem -rawin -in stmt.canonical | base64 -w0 > stmt.sig
# signed-approval.json = {"contract":"signed-approval","statement":<stmt.canonical>,"signature":{"algorithm":"ed25519","value":"<stmt.sig>"}}
workflow approval verify --file signed-approval.json                            # read-only validation
workflow approval import --file signed-approval.json
workflow gate --gate G2
workflow advance --to REQUIREMENTS_APPROVED
```

**What the approval is bound to:** the exact scope digest and baseline. Any later change to the scope's content, decisions, sources or policy invalidates it, and G2 drops out of PASS.
