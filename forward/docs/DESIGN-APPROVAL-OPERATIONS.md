# Design approval operations (G3 architecture, G4 story set)

This guide is for the operator and the signers who approve an architecture (G3) or a development story set (G4) for one G2-approved scope.

G3 and G4 use the same trust model as G2:
- the external trust store ([TRUST-CONFIGURATION-GUIDE.md](TRUST-CONFIGURATION-GUIDE.md));
- Ed25519 signatures over canonical JSON;
- separation of duties;
- records sealed in the audit chain.

A schema-valid document is never enough. A gate passes only while a signed approval of the **exact current** artefact re-verifies.

## 1. Order of work

1. **G2 PASS** for the scope, then `workflow advance --to REQUIREMENTS_APPROVED`.
2. **F3 delivers the architecture.** Run `workflow prepare --agent F3 --programs …`; the agent writes its outputs; then run `workflow record --receipt …` and `workflow advance --to ARCHITECTURE_DRAFTED`.
3. **Check G3 readiness.** Run `workflow g3 blockers`. It must show only `human_approval` as failing.
4. **Request G3 approval:** `workflow architecture approval-request --requested-by <operator>`. This creates `DREQ-NNNN`, and it is refused unless the architecture validates.
5. **Sign.** Run `workflow architecture approval-statement --request DREQ-NNNN --signer <id> --role architecture_approver --decision approved --out stmt.canonical`, then sign it outside the harness:

   ```sh
   openssl pkeyutl -sign -inkey <key.pem> -rawin -in stmt.canonical | base64 -w0
   ```

   Wrap the result as `{"contract":"signed-design-approval","statement":<stmt>,"signature":{"algorithm":"ed25519","value":"…"}}`.
6. **Verify and import.** `workflow approval verify --file signed.json` (read-only), then `workflow approval import --file signed.json`. This writes `DAP-NNNN`.
7. **Pass and advance.** Run `workflow gate --gate G3` and `workflow advance --to ARCHITECTURE_APPROVED`.
8. **Repeat for G4.** F4 delivers the stories (they must name the G2 `APR-…` and G3 `DAP-…` approvals in `approval_baseline`). Then:
   - `workflow stories approval-request`;
   - a `story_approver` signs;
   - import;
   - `workflow gate --gate G4`;
   - `workflow advance --to STORIES_APPROVED`.

## 2. What G3 checks

**Prerequisites:** G2 PASS on the current baseline and a fresh G2 re-evaluation PASS.

**Architecture checks:**

| Area | Requirement |
|---|---|
| F3 output | An accepted, completed F3 receipt whose files are unchanged. Both record types valid (`component_design`, `architecture_decisions`) and on the current baseline. |
| Approval binding | `approved_inputs.requirements_approval` is the current G2 approval. |
| Requirements | Every approved requirement is mapped to a component, and no component cites anything else. |
| Units | Components replace only scope units, and every primary program is replaced. |
| Dependencies | The component dependency graph is acyclic, with no dangling references. |
| Technology | Every framework choice has an ADR with alternatives; no framework is assumed. |
| ADR sources | ADRs cite scope sources. |
| Compatibility risks | Each risk has testing implications and an architecture-owner approval. |
| Data contracts | F2 data-contract receipts are named when the scope has data records. |
| Compatibility concerns | Every concern that applies to the scope is addressed by an ADR or deferred to a resolved decision (see below). |
| Runtime requirements | Every runtime requirement is treated by a concern. |
| Assumptions | Material assumptions are backed by resolved decisions. |
| Decisions | No unresolved blocking decision remains in scope. |

**Compatibility concerns are derived from source facts:**

| Concern | Applies when |
|---|---|
| decimal precision, record layouts | data records in scope |
| file organization | file-operation items in scope |
| return codes | programs in scope |
| batch execution, JCL dependencies | JCL jobs reference scope programs |
| DB2 transactions | `SQL_INCLUDE` edges |
| CICS interfaces | `CICS_*` edges |
| checkpoint / restart | approved requirement text mentions it |
| shared dependencies | dependency units or outside calls |

**Approvals:**
- An approval by `architecture_approver`.
- If any ADR has `behavior_change: true`, also a separate approval by `technical_authority` from a different signer.
- A valid rejection of the same artefact blocks G3.

## 3. What G4 checks

**Prerequisites:** G3 PASS on the current baseline and a fresh G3 re-evaluation PASS (which re-evaluates G2).

**Story checks:**

| Area | Requirement |
|---|---|
| F4 output | An accepted, completed F4 receipt whose files are unchanged, valid against `forward/development-stories`, on the current baseline. |
| Approval binding | Stories name the current G2 and G3 approvals. |
| Story IDs | Unique. |
| Requirements | Every approved requirement is covered, and no story cites anything else (no unsupported behaviour). |
| Architecture | Story components are approved components that implement the story's requirements. |
| Epics | Epics reference known components and stories. |
| Dependencies | Story dependencies exist and are acyclic; the implementation order is reported. |
| Acceptance criteria | Concrete, and each verifies a scope source. |
| Testing | Every story has independent testing expectations. |
| Data contracts | Cited data contracts are scope records. |
| Blockers | No unresolved blocking decision; every story is `ready`. |
| Trace | End to end: COBOL source → reverse rule → approved requirement → component → story. |

**Approval:** by `story_approver`.

**Self-approval is rejected:**
- the requester;
- the authoring agent (F3 / F4 or its `fe-*` name);
- any automated identity.

## 4. What an approval is bound to

Every request and signed statement binds:
- the baseline manifest;
- the scope digest;
- the approved-requirements content hash;
- the artefact (receipt, files and sha256 values);
- the dependency manifest (units with source hashes, data contracts, runtime requirements, decisions; for G4 also the architecture hash);
- the upstream approvals (G2 for G3; G2 and G3 for G4);
- the signer and role;
- the signing time.

**Also checked:** the policy digest and the request expiry. Replays are rejected: one decision per signer per request, and no reused signature.

## 5. Invalidation

At every evaluation, each recorded approval is re-verified. When it no longer matches, the gate stops passing. If the workflow is at or beyond the matching approval state, it moves to BLOCKED.

An `INV-NNNN` record (`orchestrator/approval-invalidation`) names:
- the causes:
  - `baseline_changed`;
  - `scope_changed`;
  - `requirements_changed`;
  - `artifact_changed`;
  - `dependency_changed`;
  - `upstream_invalidated`;
  - `signer_revoked_or_invalid`;
  - `record_tampered`;
  - `trust_unavailable`;
- the failed checks;
- the downstream approvals affected (a G3 approval lists the G4 approvals built on it).

**Cascade.** A failing G2 re-evaluates G3 and G4; a failing G3 re-evaluates G4.

**Nothing is deleted or rewritten.** A new approval needs a new request on the current content.

## 6. Commands

| Command | Writes |
|---|---|
| `workflow g3 evaluate\|blockers`, `workflow g4 evaluate\|blockers` | nothing (read-only) |
| `workflow gate --gate G3\|G4` | a gate result, a `design/evaluations/G3E\|G4E` record and any new `INV` record |
| `workflow architecture\|stories approval-request --requested-by ID` | `design/requests/DREQ-NNNN` (refused, and audited, when the artefact does not validate) |
| `workflow architecture\|stories approval-statement --request DREQ-N --signer ID --role R --decision approved\|rejected [--out FILE]` | nothing (prints the canonical text to sign) |
| `workflow approval verify\|import --file SIGNED.json` | `design/approvals/DAP-NNNN` on import (also handles G2) |

No command marks a gate PASS from a flag.
