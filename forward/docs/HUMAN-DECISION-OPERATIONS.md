# Human decision operations (toward a legitimate G2 approval)

This guide is for the operator who drives a scope to G2, and for the signers who decide.

Every human decision is a deliberate, externally authenticated act:
- an Ed25519 signature by a key whose public half is in the organization's trust store;
- the private key never enters REVFORGE.

Nothing in REVFORGE signs, resolves or approves by default. Every command supports `--json`.

## 0. Prerequisite: trust (key custodian)

1. Each signer generates a key pair on a machine or HSM they control. See [TRUST-CONFIGURATION-GUIDE.md](TRUST-CONFIGURATION-GUIDE.md).
2. The custodian writes the trust store from [`forward/config/examples/trust-store.example.json`](../config/examples/trust-store.example.json). It contains placeholders only.
   - Give each person one identity.
   - Set `valid_until`.
   - Optionally restrict a signer to `scopes`.
3. Validate the candidate file **before** installing it:

   ```sh
   trust doctor --file /secure/revforge/trust-store.json
   trust roles --file /secure/revforge/trust-store.json
   ```

   `trust doctor` checks:
   - location (not workflow- or agent-writable);
   - the contract;
   - that there are no private keys;
   - each key parses as Ed25519;
   - one key per identity;
   - roles are ones the policies use;
   - validity windows, revocation and scope restrictions;
   - conflicting role combinations;
   - role coverage.

   It reports `TRUST_NOT_CONFIGURED`, `TRUST_INVALID`, `TRUST_INCOMPLETE` or `TRUST_CONFIGURED`.
4. **Prove each key works.** The signer signs a challenge file outside REVFORGE, then run:

   ```sh
   trust verify-signature --signer <id> --message challenge.txt --signature <base64>
   ```

5. **Install it:** `export REVFORGE_APPROVAL_TRUST_STORE=/secure/revforge/trust-store.json`. Make the file read-only for the operator account.

**Roles used by the policies:**

| Role | Signs |
|---|---|
| `business_sme` | business, review and scope decisions |
| `product_owner` | scope decisions |
| `technical_authority` | technical, data-layout and runtime-semantics decisions, and the G3 co-approval |
| `exception_approver` | `approved_exception` outcomes |
| `requirements_approver` | G2 |
| `architecture_approver` | G3 |
| `data_owner` | OpenAI source-export authorizations and AI disclosure authorizations |

## 1. Review the pending decisions

```sh
decisions review --scope programs:<PROGRAM>
```

This produces one dossier per blocking decision. It is sealed as `workflow/operations/decision-dossiers-NNNN` and exported to `forward/reports/step-8/decision-dossiers.json`. Each dossier contains:
- the exact question, the recorded options, each allowed outcome with the roles that may sign it, and the signers available now;
- every affected requirement: its claim, the cited lines read now from the original COBOL (with sha256), and whether the cited line lies inside the cited statement;
- **evidence analysis**: which stated values the cited statements contain. For each missing value, it shows where it occurs in the scope's sources, including 88-level condition names and whether the cited code sets or tests them. It also lists what the source establishes and what it does not;
- remediation proposals, re-derived from the source now;
- the prepared independent-verification packet (never sent);
- **shared impact**: every program scope that contains the decision's units, with its readiness.

**Supporting commands:**

| Command | What it does |
|---|---|
| `decisions impact --decision <ID>` | Shows which scopes a shared decision touches |
| `decisions clarify --decision <ID> --requested-by <you> --to <who> --question "<text>"` | Records a clarification request; the decision stays open |

## 2. Prepare, sign, verify and import a resolution

```sh
decisions export-request --decision <ID> --scope programs:<PROGRAM> --out <ID>.request.json
```

**Bindings.** The request binds the decision content hash, the baseline, the affected item hashes, the scope and an expiry, and carries a request ID (`DRQ-…`). `decisions review` also exports one request per dossier to `forward/reports/step-8/resolution-requests/`.

**What the signer fills in:**
- `outcome` (one of `allowed_outcomes`);
- `selected_option`: for a citation correction, the proposal ID `RP-…`;
- `resolution_text`;
- `justification`;
- `signer_id`;
- `role` (one of `required_roles_by_outcome[outcome]`);
- `resolved_at`.

**Never edit the binding fields.** Sign the canonical JSON outside REVFORGE, then wrap it as `signed-decision-resolution` (see the trust guide).

```sh
decisions verify-resolution --file <ID>.signed.json   # read-only, every check listed
decisions import-resolution --file <ID>.signed.json   # records RES-NNNN or records the rejection
```

**Rejected:**
- forged signatures and unknown signers;
- unauthorized roles and agent identities;
- signers expired, revoked or outside their scope restriction;
- a changed decision, changed item hashes or a different baseline;
- a decision that is not in the stated scope;
- an expired request or a tampered request ID;
- an outcome that is not allowed;
- a `selected_option` naming a proposal that does not exist, targets another item, or whose item or source changed;
- replays;
- unsigned JSON.

## 3. Citation corrections

```sh
remediation review --scope programs:<PROGRAM>              # all proposals in scope, re-derived now
remediation impact --proposal RP-…                         # plus every scope containing the item
```

The review shows:
- the original and proposed citation, with the source text of both lines;
- the source sha256;
- the requirement hash;
- the reason and the authorizing decision (`RVW-<item>`) with its required role.

**Applying a correction**, only after the signed `resolved_requires_update` resolution naming the proposal is imported:

```sh
workflow correct --packet <PKT> --file draft_requirements.json --pointer <pointer> --kind citation_line --proposal RP-… --authorized-by RES-… --reason "<why>"
```

**What happens:**
- The original deliverable is never modified; a versioned overlay is written.
- The requirement gets a new content hash and is re-evaluated against the corrected citation.
- Requests and approvals bound to the old content stop verifying.

## 4. Evidence the source does not settle

When a dossier shows a missing value with **no** occurrence in the scope's sources, the value cannot be established from the source. A signer must then:
- exclude the requirement with justification;
- or request an update;
- or, where policy allows, approve an exception.

When the value occurs through a condition name the cited code sets, the dossier says so. A human still decides whether that establishes the claim; for example, by approving a requirement update that cites the defining line.

**Independent verification.** Prepared OpenAI packets are listed but never sent. Sending one needs a signed OpenAI source-export authorization and an explicit LIVE run (see `OPENAI-VERIFICATION-OPERATIONS.md`).

## 5. G2 readiness and approval

```sh
approval readiness --scope programs:<PROGRAM>
```

This is sealed as `g2-approval-readiness-NNNN` and exported. It shows:
- the trust status and role coverage;
- the blocking decisions with roles and signers;
- the citation corrections;
- outstanding evidence;
- shared dependencies with the other scopes they affect;
- requirement content hashes;
- re-approval rules;
- the step-by-step checklist;
- allowed next transitions.

**Readiness is not approval.** When the scope is READY:

```sh
approval export-request --scope programs:<PROGRAM> --requested-by <operator>
workflow approval statement --request AREQ-NNNN --signer <approver> --role requirements_approver --decision approved --out stmt.canonical
# the approver signs stmt.canonical outside REVFORGE
approval verify --file signed-approval.json
approval import --file signed-approval.json
workflow gate --gate G2
workflow advance --to REQUIREMENTS_APPROVED
```

**Separation of duties:** the requester can never approve.

**Re-approval:** any later resolution, correction, source or baseline change makes the approval stale. G2 then stops passing, the G3 approval built on it is invalidated, and the F4 story set stops validating, so F5 cannot be dispatched.
