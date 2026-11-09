# Human approval operations (G1: approved requirements)

This guide is for the people who operate the REVFORGE forward workflow and for the humans who approve its requirements. It explains:
- how the G1 gate decides;
- how trust anchors are provisioned;
- how decisions and approvals are signed;
- what invalidates an approval.

The harness can tell whether requirements are **ready** to be decided. Only a signed, verified human approval can make **G1 PASS**. No CLI flag, configuration value or agent statement can approve anything.

> **Gate numbering.** This gate was named G2 until 2026-11-09, and its CLI command was `workflow g2` (now `workflow g1`). Workflows created before that date keep G2 in their records, and their signed approvals name G2; the runtime still accepts those for such workflows. The readiness report keeps its historical file name, `G2-READINESS-REPORT.md`.

## 1. What G1 checks

Every run of `workflow gate --gate G1` rebuilds the evidence from the runtime's own records. It does this again before each transition to `REQUIREMENTS_APPROVED` and each F3 dispatch. The rebuild covers:

| Check | Meaning |
|---|---|
| baseline_integrity | The baseline manifest and reverse artifacts are unchanged (the BASELINE pre-check is re-evaluated). |
| deliverable_integrity | Every accepted deliverable and receipt is byte-identical to what was accepted. |
| canonical_rule_coverage | Every canonical reverse rule in scope has a disposition. Deferred or contradictory rules block until their decisions are resolved. |
| cross_batch_reconciliation | The consolidation record is current, and batch disagreements are resolved. |
| requirement_evidence / runtime_evidence | The runtime re-checks each claim against the original COBOL source. Agent statements are never accepted as evidence. |
| contradicted_claims / semantic_contradictions | Citation mismatches and recorded contradictions block. |
| blocking_decisions | Decisions in scope that are open, stale or untrusted block. |
| data_contracts | Each unit has an F2 data contract, and field layouts are verified or covered by a signed exception. |
| source_references / traceability | File, statement and paragraph IDs resolve, and requirements trace to rule coverage. |
| scoped_gaps | Gaps that no decision or requirement addresses, and unresolved dependencies, are covered. |
| scope_classification | Programs whose classification needs a scope decision are decided, and receipt-less packets are accounted for. |
| trust_anchor | A usable, externally provisioned trust store exists. |
| human_approval | A signed approval of this exact scope digest re-verifies now. |

Each item in scope is classified as one of six outcomes:

| Outcome | Blocks G1? | Meaning |
|---|---|---|
| VERIFIED | No | Independently re-verified, or resolved. A verified citation proves the source text exists. It does not prove the business interpretation; the human approval covers that. |
| REQUIRES_EVIDENCE | Yes | Not independently verified. |
| REQUIRES_SME_DECISION | Yes | An SME must decide or confirm. |
| CONTRADICTED | Yes | The source or a recorded contradiction disagrees with the item. Never eligible for an exception. |
| EXCLUDED_WITH_JUSTIFICATION | No | Outside the decision, with a recorded reason. |
| APPROVED_EXCEPTION | No | Accepted by a signed exception. Allowed only for the outcomes the policy lists. |

### Status meanings

- **BLOCKED**: the EVIDENCE pre-check (gate G1 in the former nine-gate design, not today's G1) has not passed on the current baseline.
- **FAIL**: the evidence base is not intact. Either the baseline changed or an accepted deliverable or receipt was altered.
- **UNVERIFIED**: the scope is not ready, there is no trust anchor, or no valid approval exists.
- **PASS**: all of the following are true:
  - the scope is READY;
  - every check passes;
  - an approval re-verifies against the current content.

## 2. Scopes

| Scope | Selector | Contents |
|---|---|---|
| Entire application | `--scope application` | Every discovered program and copybook. |
| Program set | `--scope programs:A,B` | The selected programs plus their shared dependencies: included copybooks and, by policy, statically called programs. |
| Requirement set | `--scope requirements:REQ-X-001,REQ-Y-002` | Exactly those requirements, plus decisions, data contracts and contradictions of their units and dependencies. |

These rules decide which decisions affect a scope:
- A decision that affects no unit or requirement in the scope does not block it. It is listed under `excluded.decisions` with the reason.
- A decision on a shared dependency always applies.
- A unit excluded by a signed resolution cannot hide its blockers from a scope that still depends on it (finding `excluded_dependency`).

## 3. Roles and policy

Roles and evidence policy live in the `approval` section of `forward/config/forward.config.json`. The policy digest is bound into every scope digest, so changing the policy invalidates existing approvals.

| Purpose | Default role(s) |
|---|---|
| Approve requirements (G1) | `requirements_approver` |
| Sign an `approved_exception` | `exception_approver` |
| Resolve business decisions and review decisions | `business_sme` |
| Resolve technical, data_layout and runtime_semantics decisions | `technical_authority` |
| Resolve scope decisions | `business_sme` or `product_owner` |

Default evidence policy:
- `reverse_artifact_supported: REQUIRES_EVIDENCE`
- `allow_exceptions_for: [REQUIRES_EVIDENCE]`
- `accept_independent_verification_without_read_telemetry: true`
- `blocking_gap_severities: [critical, high]`

### Provenance policy

Step 3.5 showed that agent read telemetry was missing for F2. Under the current policy:
- A claim is accepted only when the runtime itself re-verifies it against the source.
- Read telemetry is recorded but not required.
- No claim is ever accepted on the agent's own declaration.

Every G1 evaluation records this policy.

## 4. Provisioning the trust anchor (key custodian)

The harness never creates or trusts a signer itself. A key custodian does the following outside the repository.

1. **Each signer generates their own key pair** on their own machine, or in an HSM or KMS where the platform supports exportable Ed25519 public keys:

   ```sh
   openssl genpkey -algorithm ed25519 -out ~/.keys/revforge-approver.pem    # private: never leaves the signer
   openssl pkey -in ~/.keys/revforge-approver.pem -pubout -out approver.pub.pem
   ```

2. **The custodian collects the public keys** (`*.pub.pem`) and confirms each signer's identity and role out of band.

3. **The custodian writes the trust store**, which follows the contract `forward/contracts/orchestrator/approval-trust-store.schema.json`:

   ```json
   {
     "contract": "approval-trust-store",
     "contract_version": "1.0",
     "issued_by": "Modernisation programme key custodian",
     "issued_at": "2026-11-01T09:00:00Z",
     "signers": [
       { "signer_id": "j.smith", "display_name": "Jane Smith", "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n", "roles": ["requirements_approver"], "valid_until": "2027-11-01T00:00:00Z" },
       { "signer_id": "p.jones", "public_key_pem": "-----BEGIN PUBLIC KEY-----\n...", "roles": ["business_sme"] }
     ]
   }
   ```

4. **The custodian stores the file outside the workflow** and gives it restrictive permissions. Point the harness at it with either:
   - the environment variable `REVFORGE_APPROVAL_TRUST_STORE=/secure/path/trust-store.json`, or
   - `approval.trust_store` in the configuration.

The runtime refuses a trust store that:
- contains private key material (`PRIVATE KEY`);
- lives under `forward/runs/` or `output/`;
- fails its contract.

It ignores signers whose ID is an agent or automation identity (`F1`–`F7`, `fe-*`, `runtime`, `claude*`, `agent*`, …).

**Rotation and revocation:**
- To revoke a signer, set `"revoked": true` or a past `valid_until`.
- Every approval and resolution is re-verified against the current store at each G1 evaluation, so revocation takes effect immediately and G1 drops to UNVERIFIED.
- Rotating a key works the same way: add the new key under a new `signer_id`, and revoke the old one.

**Never put private keys in this repository**, the runs directory, the configuration or a ticket. The repository holds public keys only, and only if the custodian chooses to keep the store there (for example, under `forward/config/`).

## 5. Procedure

All commands are `node forward/dist/runtime/src/cli.js workflow … --run <RUN>`. Add `--json` for machine-readable output.

### 5.1 Inspect readiness

```sh
workflow g1 evaluate --scope programs:PROGA            # outcome summary; exit 0 only when READY
workflow g1 blockers --scope programs:PROGA            # every blocking finding with its reason
workflow g1 blockers --per-program                     # one line per single-program scope
workflow g1 report --out forward/reports/G2-READINESS-REPORT.md
workflow packets review                                # record superseded receipt-less packets (no receipts are created)
```

### 5.2 Resolve decisions (authorised humans only)

```sh
workflow decisions list --scope programs:PROGA --status open --blocking
workflow decisions template --decision DR-PROGA-001 --out res.json
```

**Fill in the template.** Leave every binding field exactly as generated: `decision_sha256`, `baseline_manifest_sha256`, `affected_*` and `original_problem`. Fill in:
- `outcome`: one of `allowed_outcomes`;
- `selected_option`;
- `resolution_text` (at least 10 characters);
- `justification` (at least 10 characters);
- `signer_id`;
- `role`: one of `required_roles_by_outcome[outcome]`;
- `resolved_at`.

**Sign the exact canonical bytes** of the `resolution` object (keys sorted, no whitespace):

```sh
node -e "const {canonicalize}=require('./forward/dist/runtime/src/approval/canonical');process.stdout.write(canonicalize(JSON.parse(require('fs').readFileSync('res.json','utf8'))))" > res.canonical
openssl pkeyutl -sign -inkey ~/.keys/revforge-sme.pem -rawin -in res.canonical | base64 -w0 > res.sig
```

**Wrap the result** as `{"contract":"signed-decision-resolution","resolution":<res.json>,"signature":{"algorithm":"ed25519","value":"<res.sig>"}}`. Then verify and record it:

```sh
workflow decisions resolve --file signed-res.json --dry-run
workflow decisions resolve --file signed-res.json
```

**Choosing an outcome:**

| Outcome | Effect |
|---|---|
| `resolved_no_change` | The drafted requirement stands; an SME confirms an inferred interpretation. |
| `resolved_requires_update` | The affected requirements stay blocked until their content changes (a new content hash), and then they are re-evaluated. |
| `excluded_from_scope` | Excludes the affected requirements, or, for scope and unit-level decisions, the affected units, with your justification. |
| `approved_exception` | Accepts REQUIRES_EVIDENCE items as they are. Needs the `exception_approver` role and is never available for CONTRADICTED. |

To change a decision, sign a new resolution whose `supersedes` names the current one. The template fills this in. Earlier resolutions are never edited or deleted.

### 5.3 Approve requirements

```sh
workflow approval request --scope programs:PROGA --requested-by p.operator      # refused unless READY
workflow approval statement --request AREQ-0001 --signer j.smith --role requirements_approver --decision approved --out stmt.canonical
openssl pkeyutl -sign -inkey ~/.keys/revforge-approver.pem -rawin -in stmt.canonical | base64 -w0 > stmt.sig
```

**Build the signed file** `{"contract":"signed-approval","statement":<contents of stmt.canonical>,"signature":{"algorithm":"ed25519","value":"<stmt.sig>"}}`. Then verify, import and advance:

```sh
workflow approval verify --file signed-approval.json      # read-only
workflow approval import --file signed-approval.json      # records APR-NNNN, or audits the rejection
workflow gate --gate G1
workflow advance --to REQUIREMENTS_APPROVED               # re-evaluates G1 first
```

Before signing, the approver must read the request in `workflow/approvals/requests/AREQ-NNNN.json`. It lists:
- the scope units;
- every requirement with its content hash and outcome;
- the exclusions and exceptions.

The approval covers the requirements and their business interpretation. It does not cover architecture or code.

## 6. What makes an approval invalid

An imported approval is re-verified at every G1 evaluation. It stops counting in any of these cases:
- **The baseline changed:** a reverse artifact changed (G1 FAIL) or a COBOL source file in scope changed.
- **The content changed:**
  - a requirement or data contract changed, including through a validated correction;
  - a decision resolution was added or superseded;
  - the policy changed;
  - packet supersession was re-recorded;
  - the scope digest no longer matches.
- **The trust changed:** the signer was revoked, expired or lost the role, or the trust store was removed.
- **The record was tampered with:** the approval record or its request no longer matches the hash sealed in the audit log.

When the workflow is already in `REQUIREMENTS_APPROVED` or a later state and G1 stops passing, the workflow moves to `BLOCKED`. F3 cannot be dispatched until a new approval of the new content is imported.

## 7. Rejected approvals and resolutions

The following are rejected and recorded in the audit log (`approval_rejected` / `decision_resolution_rejected`). Nothing is recorded as approved or resolved.

- **Requester and signer:**
  - self-approval (the signer is the requester);
  - an agent identity as signer or requester.
- **Key and role:**
  - an unknown signer or a wrong key;
  - a missing role.
- **Content:**
  - a tampered statement, request or resolution;
  - a statement bound to another request or scope;
  - stale content, an expired request, or a replayed signature.
- **Policy:**
  - an outcome the decision does not allow;
  - a missing `supersedes`.
