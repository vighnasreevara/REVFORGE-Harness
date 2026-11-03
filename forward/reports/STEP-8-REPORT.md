# STEP 8 report: trusted human decision operations, provider-specific AI authorization and G2 unblocking

Real run: `FWD-20261031T172520Z-66b3` (baseline `352b97f0…4d24a068`). Date: 2026-11-01.

**What was done:**
- **Implemented:** the operator workflow, trust validation, scope- and expiry-bound signed resolutions, signer scope restrictions, remediation binding, provider-specific disclosure authorization, the execution preflight, the readiness checklist and the CLI commands.
- **Tested with synthetic evidence:** every control, using synthetic signers in temporary fixtures.
- **Executed against real artifacts:** diagnostics, dossiers, resolution requests, proposal revalidation, preflight, readiness and gate re-evaluation.

**What was not done:**
- **Awaiting external authorization:** trust provisioning, all four decisions, G2 approval, Claude disclosure.
- **Human-approved:** **nothing**. No real human resolution, approval or authorization was supplied or imported.

## 1. Git

- **Branch / commit:** `main` / `b092004` (unchanged).
- **Working tree:** no tracked file modified. `forward/` and the `fe-*` agent and skill files are untracked, as before.
- **Ignored:** `.mcp.json` (still ignored, untouched).
- **Commits:** none; nothing pushed.

## 2. Files

**Created:**

| Area | Files |
|---|---|
| Runtime | `runtime/src/operations/trust.ts`, `operations/decisions.ts`, `operations/readiness.ts`; `runtime/src/disclosure/disclosure.ts`; `runtime/src/bmad/preflight.ts`; `runtime/src/commands/operations.ts` |
| Contracts | `contracts/orchestrator/ai-disclosure-authorization`, `signed-ai-disclosure-authorization`, `ai-disclosure-record`, `signed-ai-disclosure-revocation`; `contracts/bmad/execution-preflight` |
| Config | `config/examples/trust-store.example.json` (placeholders only) |
| Tests | `tests/step8.test.ts` |
| Docs | `docs/HUMAN-DECISION-OPERATIONS.md`, `docs/CLAUDE-DISCLOSURE-AUTHORIZATION.md` |
| Reports | `reports/STEP-8-REPORT.md`, `reports/step-8/` (dossiers, 4 resolution requests, proposal review, preflight, readiness, `RTNCDE00-G2-CHECKLIST.md`) |

**Modified:**

| File | Change |
|---|---|
| `runtime/src/approval/decisions.ts` | Optional `scope` / `expires_at` / `request_id` bindings in templates. New checks: `scope_binding`, `signer_scope`, `not_expired`, `request_binding`, `remediation_binding`. |
| `runtime/src/approval/trust.ts` | Optional per-signer `scopes`; `scopeAllowed` |
| `runtime/src/approval/approvals.ts`, `runtime/src/design/approvals.ts` | Signer-scope check for G2/G3/G4 |
| `runtime/src/bmad/executor.ts` | `--max-budget-usd` in the manifest |
| `runtime/src/orchestrator/permissions.ts` | `operations/` is runtime-only |
| `runtime/src/cli.ts`, `runtime/src/commands/bmad.ts` | New commands |
| Contracts | `approval-trust-store` (optional `scopes`), `signed-decision-resolution` and `decision-resolution-record` (optional bindings) |
| `tests/helpers/designfixture.ts` | Citation-line, no-resolve and `data_owner` options |
| `tests/step55.test.ts` | One assertion tightened (see §3) |
| `docs/TRUST-CONFIGURATION-GUIDE.md` | Validation and scopes |

Existing signed records remain valid: the new fields are optional and are checked whenever present.

## 3. Tests

**261 passed, 0 failed, 0 skipped**: the 245 existing tests plus 16 new test cases covering the 27 required items:

| Items | What is tested |
|---|---|
| 1 | role provisioning validation, incl. TRUST_NOT_CONFIGURED and the custodian signature self-test |
| 2–6 | unknown signer, wrong role, invalid public key, expired authority, revoked signer |
| 7 | signed scope- and expiry-bound resolution |
| 8–9 | wrong decision binding, wrong requirement hash, wrong scope, expired request, unsigned decision; also signer-scope restriction |
| 10–12 | citation correction under its signed resolution; unauthorized correction; invalidation after the change |
| 13 | shared-dependency re-evaluation across every scope containing a copybook |
| 14–15 | G2 readiness, signed request/response, self-approval; plus clarification and dossiers |
| 16 | provider-specific authorization (incl. revocation and replay) |
| 17–18 | OpenAI ≠ Claude in both directions |
| 19–20 | file-scope restriction and hash mismatch |
| 21, 23 | unauthorized execution refused; sealed preflight refusal |
| 22 | missing enforceable boundary refuses even with G2 PASS and a valid Claude authorization |
| 24–27 | no Java, historical records, reverse artifacts, G3/G4 paths intact |

**One existing test changed, by tightening, not weakening:** `step55` "citation correction…". It expected a resolution naming a **nonexistent** proposal (`RP-0000000000`) to be *recorded*. The new `remediation_binding` check now rejects it at import. The test asserts that rejection, and that the correction still cannot be applied.

## 4. Commands executed against the real workflow

```
npm run build; npm test                                    # 261/261
doctor | validate | agents | skills                        # exit 0
trust doctor; trust roles                                  # TRUST_NOT_CONFIGURED
decisions review --scope programs:RTNCDE00                 # 4 dossiers, sealed decision-dossiers-0001, 4 requests exported
remediation impact --scope programs:RTNCDE00 --proposal RP-8d2dd33787
provider authorization doctor --scope programs:RTNCDE00
bmad executor preflight --workflow bmad-architecture --scope programs:RTNCDE00   # REFUSED, sealed BPF-0001
approval readiness --scope programs:RTNCDE00               # sealed g2-approval-readiness-0001
workflow gate --gate G2|G3|G4; workflow g2 evaluate --scope programs:RTNCDE00
workflow status; workflow resume
```

## 5. Trust store

**TRUST_NOT_CONFIGURED.** No trust store is configured, and none was created; the example file contains placeholders only.

All eight policy roles are uncovered:
- `requirements_approver`;
- `business_sme`;
- `technical_authority`;
- `exception_approver`;
- `product_owner`;
- `architecture_approver`;
- `story_approver`;
- `data_owner`.

## 6–9. RTNCDE00 decisions, correction, evidence and shared impact

| Decision | Kind / class | Who may sign | Status |
|---|---|---|---|
| RVW-REQ-RTNCDE00-004 | review / direct | `business_sme` | open; awaiting signer |
| RVW-REQ-RTNCDE00-003 | review / direct | `business_sme` or `exception_approver` | open; awaiting signer |
| DR-DB2CONN-002 | technical / cross-scope | `technical_authority` | open; awaiting signer |
| DR-F2-0011-001 | data layout / shared dependency | `technical_authority` | open; awaiting signer |

**Decision A — citation correction (RP-8d2dd33787):**
- **Status:** re-validated today, not applied.
- **The correction:** REQ-RTNCDE00-004 (hash `0ac2f6b674b5…`) cites `STMT-000024` at line 121 (`P500-ANALYZE-CODES.`), which is outside the statement (lines 122–133). The proposal is line 122 (`EXEC SQL`).
- **Checks:** item unchanged; source hashes unchanged (`RTNCDE00.cbl 7cb951ea…`, `RTNCODE.cpy`, `SQLCA.cpy`); re-derived from source: 1/1 stated value at line 122.
- **Authorization:** NOT_AUTHORIZED. It needs a `business_sme` resolution of RVW-REQ-RTNCDE00-004 with `resolved_requires_update` and `selected_option = RP-8d2dd33787`, and then `workflow correct`.
- **After applying:** the requirement gets a new hash, is re-evaluated, and stale requests are rejected. The tests show this happening.

**Decision B — evidence for REQ-RTNCDE00-003 (hash `ec665cc58b23…`):**
- **The claim:** 0 = SUCCESS (`'S'`), 1–4 WARNING (`'W'`), 5–8 ERROR (`'E'`), any other value SEVERE (`'F'`); response code 0.
- **What the cited EVALUATE (line 70) shows:** it sets condition names (`RC-STATUS-SUCCESS/WARNING/ERROR/SEVERE`), not literal letters.
- **Why the checker flags it:** it finds 3 of the 4 stated values in the cited statement; `'F'` is missing.
- **What can be independently established:** `'F'` is the VALUE of `88 RC-STATUS-SEVERE` at `RTNCODE.cpy:20`, and the cited statement sets that condition at line 78 (`WHEN OTHER`). The value is therefore reachable from the cited code through the condition name, but the citation does not name the defining line.
- **What remains:** a human must decide whether this establishes the claim:
  - `resolved_requires_update`, for example adding the 88-level citation;
  - `approved_exception`;
  - or excluding the requirement.
- **What was not done:** nothing was invented, and the verifier was not changed to auto-accept this. The prepared independent-review packet `OAV-EVD-af66b09e34` is referenced but was not sent.

**Decision C — SQLCA:**
- **The source:** `SQLCA.cpy` line 6 is `EXEC SQL INCLUDE SQLCA END-EXEC` (it includes itself). It defines only `01 SQL-STATUS-CODES` (seven SQLSTATE constants: `'00000'`, `'02000'`, `'23505'`, `'40001'`, `'40003'`, `'08001'`, `'58004'`). It has no SQLCODE or SQLERRMC field, and no reverse artifact holds the real layout.
- **DR-DB2CONN-002** asks whether the design may assume the standard DB2 SQLCODE meaning.
  - **Recorded options:** confirm the precompiler-supplied standard SQLCA, or supply the real layout.
  - **Affects:** 9 requirements in DB2CMT, DB2CONN, HISTLD00, RTNANA00 and RTNCDE00.
- **DR-F2-0011-001** asks where the SQLCA layout comes from.
  - **Recorded options:** the IBM-documented standard layout as an external dependency; JDBC SQLException/SQLState mapping using SQL-STATUS-CODES; or obtaining the real member from the source library and re-running reverse engineering.
  - **Affects:** 15 DB2 program scopes (CURSMGR, DB2CMT, DB2CONN, DB2ERR, DB2HNDL, DB2ONLN, DB2RECV, DB2STAT, ERRHNDL, HISTLD00, INQHIST, INQONLN, RTNANA00, RTNCDE00, SECMGR).
- **No resolution was selected.**

**Shared impact.** Resolving either SQLCA decision re-evaluates every listed scope (shown by `decisions impact`, and covered by test 13). Baseline and dependency hashes are preserved.

## 10–11. Signed-resolution capabilities and real imports

**Capabilities.** Verified against:
- the decision content hash and kind;
- the workflow, run and baseline;
- the affected requirement and item hashes;
- the scope (membership);
- the signer role, Ed25519 key and signature;
- signer validity, revocation and scope restriction;
- request expiry and request-ID integrity;
- the allowed outcome;
- the named remediation proposal (existence, target, item and source hashes);
- supersession;
- replay.

**Rejected:** unsigned JSON, agent identities and self-approval. Historic records are immutable.

**Real human resolutions imported:** none.

## 12–14. Provider-specific disclosure and enforcement limits

**The mechanism** (`ai-disclosure-authorization`, signed by `data_owner`) binds:
- provider, service and endpoint host;
- model(s);
- the scope and its digest;
- the exact source files and sha256 values;
- classification and purpose;
- workflows;
- limits (files, bytes, cost, runs);
- the validity window;
- the baseline.

It is re-verified at every use and revocable. OpenAI and Claude authorizations never stand in for each other; the OpenAI source-export contract is bound to `openai` by schema.

**Claude/BMad status:** **NOT AUTHORIZED**. There are 0 disclosure records and the trust store is not configured.

**Enforcement limits:**
- **No network-level enforcement:** Claude Code's model traffic is end-to-end TLS that REVFORGE cannot inspect.
- **No OS filesystem isolation:** the CLI's tool restrictions are not OS-enforced.

The launch boundary is therefore **not technically enforceable**, and LIVE execution is blocked. There is no force option.

## 15. BMad preflight (real)

`bmad-architecture` for `programs:RTNCDE00`: **REFUSED** (sealed `BPF-0001`); nothing was launched.

| Result | Checks |
|---|---|
| Passed | scope, release pinned, binding and agent, tool restrictions and outputs |
| Failed | G2 exact scope, workflow state, provider authorization, source hashes (nothing to compare against), authorized content only (3 files would be exposed, none authorized), runtime execution authorization (LIVE not requested), limits, enforceable launch boundary |

## 16–20. State and integrity

| Item | Status |
|---|---|
| Gates | G0 PASS, G1 PASS, **G2 UNVERIFIED** (application: NOT_READY, 395 blocking), **G3 BLOCKED**, **G4 BLOCKED**, G5–G8 BLOCKED |
| RTNCDE00 readiness | NOT_READY: 5 blocking findings, digest `88d8562c…` (unchanged since Step 5.5); approval not possible now |
| Workflow | REQUIREMENTS_DRAFTED; checkpoint #159 verified; resume OK |
| Audit | 198 → 208 entries: two operations records, the preflight refusal, G2/G3/G4 evaluations, resume; chain verified |
| New run records | 9: dossiers, readiness, `BPF-0001`, G2/G3/G4 evaluations and gate results. All 236 prior records unchanged. |
| `output/` | 534 files unchanged |
| COBOL | 371 files unchanged |
| `.claude/` | 44 files unchanged |
| Plan files | unchanged |
| AI provider calls | **none**: OpenAI records unchanged (8), no BMad execution or receipt records, no executor run |
| Java | **none**; generation not authorized |

## 21. Exact human actions still required

1. **Key custodian:** provision the real trust store (all eight roles, one identity per person, `valid_until`, optional scopes). Validate it with `trust doctor --file`, prove each key with `trust verify-signature`, then install it via `REVFORGE_APPROVAL_TRUST_STORE`.
2. **`business_sme`:** decide RVW-REQ-RTNCDE00-004. If the citation is approved, sign `resolved_requires_update` with `RP-8d2dd33787`. The operator then applies the correction and re-runs `approval readiness`.
3. **`business_sme` or `exception_approver`:** decide RVW-REQ-RTNCDE00-003 on the `'F'` evidence.
4. **`technical_authority`:** decide DR-DB2CONN-002 and DR-F2-0011-001. These are shared: the resolution applies to 5 and 15 scopes respectively.
5. **Operator:** after each import, re-export any request whose bound content changed.
6. **G2:** once READY, export the G2 request. A `requirements_approver` (not the requester) signs it; the operator verifies, imports, runs `workflow gate --gate G2` and `workflow advance --to REQUIREMENTS_APPROVED`.

## 22. Conditions for authorized F3 execution

**F3 through the forward dispatcher** (a human-run F3 agent) needs:
- G2 PASS for exactly `programs:RTNCDE00`;
- state REQUIREMENTS_APPROVED;
- the dispatcher then prepares the F3 packet. G3 needs a signed architecture approval afterwards.

**F3 via BMad LIVE** additionally needs:
1. a `data_owner`-signed Anthropic / `claude-code-cli` disclosure authorization for the scope's files and `bmad-architecture`;
2. `live_execution.requested: true`;
3. **an OS-enforced launch boundary** (container or VM mounting only the authorized files, with egress restricted to the authorized host), which does not exist yet;
4. a passing preflight.

Until then, LIVE stays blocked.

Step 9 was not started.
