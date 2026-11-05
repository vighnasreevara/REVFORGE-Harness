# BMad governance

**Status: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.** STEP-25 re-checked this; see `forward/reports/step-25/bmad-governance.json`.

The BMad Method is **mandatory** for new governed forward development (`config/forward.config.json` → `bmad_governance.mandatory: true`). Enforcement is real and tested. No BMad workflow has ever executed, and no BMad receipt of any kind exists.

## Pinned release and bindings

- **Release:** `bmad-method@6.12.4`, pinned in `forward/integrations/bmad/release.pin.json`. It is staged from the npm tarball without running its installer, and is not installed in the repository.
- **Bindings:** `forward/integrations/bmad/bindings.json`, 6 bindings, recorded valid.

| # | Binding | BMad workflow | Agent | Gates required | May write code |
|---|---|---|---|---|---|
| 1 | BMAD-PRD | bmad-prd | F1 | G2 | no |
| 2 | BMAD-ARCH | bmad-architecture | F3 | G2 | no |
| 3 | BMAD-EPICS | bmad-create-epics-and-stories | F4 | G2, G3 | no |
| 4 | BMAD-SPRINT | bmad-sprint-planning | F4 | G2, G3, G4 | no |
| 5 | BMAD-BUILD | bmad-build | F5 | G2, G3, G4 | yes (authorised target only) |
| 6 | BMAD-REVIEW | bmad-code-review | F7 | G2–G6, independent test receipt, reviewer ≠ implementer | no |

No binding may approve anything. **F2** (data mapping) and **F6** (independent testing) stay outside BMad, so the implementation workflow cannot test or approve itself. Their accepted deliveries are nevertheless required evidence for a governed run.

## How enforcement works

| Record | Prefix | What it is |
|---|---|---|
| Preflight | `BPF-` | Checks one stage before launch: exact G2 scope, workflow state, signed provider disclosure, current source hashes, authorized content only, limits, minimal workspace, network isolation, runner inside the boundary, launch boundary. |
| Governed run | `BGR-` | Runs the six stages in order and stops at the first that cannot launch. The verdict is `BMAD_COMPLIANT` only when every stage has a verified LIVE receipt, and F2 and F6 evidence is accepted. |
| Receipt | `BRC-` | Stage receipts. **MOCK receipts are never evidence:** `governance.receiptCounts` counts LIVE verified receipts only. |

**No bypass.**
- Java generation through the workflow needs BMad stages up to sprint.
- A new local generation authorization (`pilot authorize`) is refused with `BMAD_BLOCKED` without that evidence.
- There is no fallback: a blocked governed run never invokes the local converter.

## Recorded state (re-verified in STEP-25)

| Check | Result |
|---|---|
| Configured / authorized workflows | 6 / 0 |
| Live executions / verified live receipts | 0 / 0 |
| BMad records in the local run | 3 BEL, 4 BGR, 13 BPF; **no BRC receipt of any mode** |
| PORTREAD governed run BGR-0004 | `BMAD_BLOCKED`: BMAD-PRD blocked; the 5 later stages not attempted |
| F2 independent mapping | ACCEPTED (units PORTFLIO, PORTREAD) |
| F6 independent testing | MISSING: no accepted receipt |
| `bmad doctor` | OK |
| `bmad governance --scope programs:PORTREAD` | exit 3, `BMAD_BLOCKED` (expected) |

## Unresolved prerequisites

All of these are decisions or infrastructure for the project owner and the data owner. None can be resolved by engineering alone.

1. **Signer trust store.** Not configured (`TRUST_NOT_CONFIGURED`), so no signed approval can be verified.
2. **Signed source-disclosure authorization** for Claude. ADA-8154d6398d4d was prepared unsigned in STEP-21: not before 2026-11-03T20:45:24Z, expires 2026-11-06T20:45:24Z. At the STEP-25 evaluation (2026-11-05, UTC) it was **unsigned and not yet expired**. Unsigned, it authorizes nothing, and after expiry it must be re-prepared. STEP-25 did not sign, renew, extend or use it.
3. **G2 approval for the exact scope.** It is recorded as `UNVERIFIED`, with 417 blocking findings for PORTREAD.
4. **An independent F6 receipt** for the scope.
5. **A verified isolated runtime** with the runner (Claude Code and Node) inside the WSL2 boundary.
6. **An authorized provider network route:** an egress component outside the isolation boundary.
7. **Live execution enablement:** `bindings.json` → `live_execution.requested` is `false`.
8. **Java generation authorization:** `generation.java_generation_allowed` is `false`.

Operator details are in `forward/docs/BMAD-INTEGRATION-OPERATIONS.md`, `forward/docs/CLAUDE-DISCLOSURE-AUTHORIZATION.md` and `forward/docs/ISOLATED-CLAUDE-BMAD-EXECUTION.md`.
