# STEP 21: mandatory BMAD integration and the PORTREAD pilot

**Status: PARTIAL: ENFORCEMENT IMPLEMENTED AND VERIFIED, LIVE EXECUTION BLOCKED.** No BMad workflow has executed, and none is counted as executed.

mandatory enforcement, the governed dispatcher, receipt counting and the LIVE gate are implemented and tested; the LIVE runner adapter (launching the manifest command inside the boundary) cannot be implemented and verified until a runner exists inside the boundary, and consumption of real BMad outputs by F1-F7 cannot be demonstrated without a real run.

**COBOL equivalence: not established.**

Machine-readable evidence is in `forward/reports/step-21/`.

## 1. Status by level

| Level | Result |
|---|---|
| Installed | Yes: `bmad-method@6.12.4` in the isolated executor workspace `synthetic-001`, never in the repository (by design) |
| Configured | Yes: pinned release, 6 valid bindings, `bmad_governance.mandatory: true` |
| Mapped | 6 workflows (section 2) |
| Unit-tested | Yes: 101 BMad, authorization, preflight and governance tests pass (steps 6–9 and 21); the positive case is an explicit test double |
| Authorized | 0: no signed disclosure authorization and no G2 approval |
| Actually executed | 0 |
| Receipt-verified | 0 |
| Blocked | 6 of 6 stages for `programs:PORTREAD` |

## 2. Workflow mapping

| Stage | Binding | BMad workflow | Agent | Gates | Definition | In workspace |
|---|---|---|---|---|---|---|
| requirements | BMAD-PRD | `bmad-prd` | F1 | G2 | active `src/bmm-skills/plan/bmad-prd` | yes |
| architecture | BMAD-ARCH | `bmad-architecture` | F3 | G2 | active `src/bmm-skills/plan/bmad-architecture` | yes |
| stories | BMAD-EPICS | `bmad-create-epics-and-stories` | F4 | G2, G3 | active `src/bmm-skills/plan/bmad-create-epics-and-stories` | yes |
| sprint | BMAD-SPRINT | `bmad-sprint-planning` | F4 | G2, G3, G4 | active `src/bmm-skills/plan/bmad-sprint-planning` | yes |
| implementation | BMAD-BUILD | `bmad-build` | F5 | G2, G3, G4 | active `src/bmm-skills/ship/bmad-build` | yes |
| review | BMAD-REVIEW | `bmad-code-review` | F7 | G2, G3, G4, G5, G6 | active `src/bmm-skills/ship/bmad-code-review` | yes |

**Outside BMad:** F2 (data mapping) and F6 (independent testing). Acceptance is the F6 receipt plus gates G6–G8.

**How outputs are consumed:** an accepted receipt becomes an upstream input of the next binding. BMad receipts never count toward gates G3–G8, F1–F7 and the local converter stay the authority, and an accepted BMad output is a draft pending human approval. None of this has run with real BMad output.

## 3. Mandatory enforcement implemented

| Change | File |
|---|---|
| `bmad_governance.mandatory: true`: every governed run needs a verified LIVE receipt per stage, otherwise BMAD_BLOCKED; Java generation through the workflow also needs the stages up to sprint (`generationAuthorized`) | `forward/config/forward.config.json`, `runtime/src/orchestrator/orchestrator.ts` |
| Governance verdict, receipt counting rule and the governed dispatcher `bmad governed-run --scope S`: stages run in order, a sealed preflight comes before every launch, the first blocked stage stops the run, the run is sealed as `BGR-NNNN`, fallback is `none` and the local converter is never invoked | `runtime/src/bmad/governance.ts`, `contracts/bmad/governed-run.schema.json`, `runtime/src/commands/bmad.ts` |
| LIVE gate defect fixed: `liveGate` refused unconditionally (STEP 6 text), and a LIVE receipt always carried `live_authorized: false`, so even an authorized run could never be accepted. Both now evaluate the real installation, disclosure-authorization and preflight facts, and still refuse when any fact is missing. | `runtime/src/bmad/eligibility.ts`, `runtime/src/bmad/adapter.ts` |
| `executeLive` now requires a recorded preflight that permits the launch. The stale `liveGate` reasons were removed from executor eligibility. | `runtime/src/bmad/executor.ts` |
| BMAD-BUILD is disabled exactly while the configuration does not authorize generation (flag plus target directory); it was previously a hard-coded constant | `runtime/src/bmad/executor.ts`, `runtime/src/bmad/preflight.ts` |
| Isolation doctor detects Docker Desktop outside PATH (reported only; no boundary depends on it) | `runtime/src/isolation/isolation.ts` |
| 13 tests: every requested negative condition, MOCK vs LIVE, failed execution, invalid receipt, and the test-double positive case | `tests/step21.test.ts` |

Local LGA conversions remain valid historical records. They are labelled `LOCAL_LGA_NOT_BMAD_GOVERNED` and never counted as BMad runs. No earlier receipt or record was modified.

## 4. PORTREAD pilot

| Item | Value |
|---|---|
| Source | `src/programs/portfolio/PORTREAD.cbl` sha256 `1e90eef73115c6065dfeee8ca7a0ad8cff96a22cfa50789c62baec4ec22b5aa1` |
| Copybook | `src/copybook/common/PORTFLIO.cpy` |
| Disclosure set | 2 files, 5634 bytes; nothing else |
| Rules | BR-099 IMPLEMENTED_VERIFIED, BR-100 IMPLEMENTED_VERIFIED |
| Reverse gaps | GAP-074 SUSPECTED_LOGIC_DEFECT, GAP-172 SME_REVIEW_REQUIRED, GAP-173 SME_REVIEW_REQUIRED |
| Java | COMPLETE {'PASS': 19, 'BLOCKED_AS_EXPECTED': 0, 'FAIL': 0, 'total': 19} under LGA-0030 (local, not BMad-governed; unchanged) |
| Readiness | PASS (STEP 20) |
| G2 | NOT_READY: 12 blocking findings (not 417); no approval |
| Authorization | unsigned request `ADA-8154d6398d4d` |
| Governed run | BGR-0003: BMAD_BLOCKED, stopped at requirements by BPF-0012 |

## 5. G2 for `programs:PORTREAD`

12 blocking findings: GENUINE_CROSS_SCOPE 4, GENUINE_POLICY 6, GENUINE 2. No classification defect was found.

| Finding | Outcome | Classification | Resolving role |
|---|---|---|---|
| PKT-0003-F1:CON-PKT0003-001 | CONTRADICTED | GENUINE_CROSS_SCOPE | business_sme |
| PKT-0004-F1:CON-PKT0004-001 | CONTRADICTED | GENUINE_CROSS_SCOPE | business_sme |
| BR-149 | CONTRADICTED | GENUINE_CROSS_SCOPE | business_sme |
| SYS-PORTFOLIO-001-FIL-0070-REC-0001 | REQUIRES_EVIDENCE | GENUINE_POLICY | technical_authority |
| SYS-PORTFOLIO-001-FIL-0070-REC-0002 | REQUIRES_EVIDENCE | GENUINE_POLICY | technical_authority |
| SYS-PORTFOLIO-001-FIL-0070-REC-0003 | REQUIRES_EVIDENCE | GENUINE_POLICY | technical_authority |
| FO-PORTREAD | REQUIRES_EVIDENCE | GENUINE_POLICY | technical_authority |
| RT-PORTREAD-002 | REQUIRES_EVIDENCE | GENUINE_POLICY | technical_authority |
| RT-PORTREAD-003 | REQUIRES_EVIDENCE | GENUINE_POLICY | technical_authority |
| DR-PORTUPDT-001 | REQUIRES_SME_DECISION | GENUINE_CROSS_SCOPE | business_sme |
| REQ-PORTREAD-001 | REQUIRES_SME_DECISION | GENUINE | business_sme / requirements_approver |
| REQ-PORTREAD-002 | REQUIRES_SME_DECISION | GENUINE | business_sme / requirements_approver |

## 6. Environment

| Component | State |
|---|---|
| Host | Node v22.12.0 and Claude Code 2.1.302 are installed, but outside any boundary |
| WSL2 Ubuntu | No Node, Claude Code, bubblewrap or socat; sudo needs a password |
| Docker Desktop 29.9.2 | Present on the host, but not configured or tested as a boundary |
| Offline isolation | Tested |
| Network | Default-deny; no verified provider egress |

**Nothing was installed and no network route was created.** Setup instructions and diagnostics are in `environment-readiness.json`.

## 7. Regression (sequential)

| Command | Exit | Result |
|---|---|---|
| `npm run build` | 0 | TypeScript build |
| `node dist/runtime/src/cli.js doctor` | 0 | FAIL checks: 0; OK checks: 24 |
| `node dist/runtime/src/cli.js sync-agents --check` | 0 | entries not in sync: 0 |
| `node dist/runtime/src/cli.js bmad doctor` | 0 | bmad doctor: OK — bmad-method@6.12.4 staged; not installed in the repository (isolated executor installation: bmad executor doctor) |
| `node dist/runtime/src/cli.js bmad executor doctor` | 0 | bmad executor: isolated installation VERIFIED; LIVE execution BLOCKED; [FAIL] provider_disclosure_authorization: no signed AI-provider disclosure authorization exists for anthropic (claude-code-cli); signed sour [FAIL] live_requested: bindings.json live_execut |
| `node dist/runtime/src/cli.js bmad isolation doctor` | 0 |  yes docker_host: Docker version 29.9.2, build a82e528; no podman_host: not installed on the host; yes linux_unshare: /usr/bin/unshare; yes linux_setpriv: /usr/bin/setpriv; no linux_bwrap: not installed; no linux_docker: not installed; no linux_podman: not ins |
| `node dist/runtime/src/cli.js provider authorization doctor` | 0 |   anthropic/claude-code-cli: NOT AUTHORIZED — 0 record(s)   openai/responses-api: NOT AUTHORIZED — 0 record(s)   trust: TRUST_NOT_CONFIGURED. OpenAI source-export authorizations (verification openai authorize) are a separate contract bound to provider 'openai' |
| `node dist/runtime/src/cli.js bmad governance --scope programs:PORTREAD` | 3 | programs:PORTREAD: BMAD_BLOCKED (BMad is mandatory for governed runs) |
| `node dist/runtime/src/cli.js workflow g2 evaluate --scope programs:PORTREAD` | 1 | scope programs:PORTREAD: NOT_READY — 2 unit(s), 12 blocking finding(s); digest c6b1864a61d126f8f09c5b2e5aace229df1da15dc8314fa0d07f16a756a6178f |
| `node --test dist/tests/step6..9 + step21 (BMad adapter, authorization, preflight, governance)` | 0 | # tests 101 # pass 101 # fail 0  |
| `node dist/runtime/src/cli.js pilot integrate` | 0 | integrated 41 program(s), 15 job(s); excluded: POSUPDT (conversion FAILED: the source cannot be converted: missing PROGRAM-ID)   compilation: COMPILED (120 Java files)   runtime unit tests: {"PASS":34,"BLOCKED_AS_EXPECTED":0,"FAIL":0,"total":34}   program test |
| `java -cp generated/java/app/classes revforge.cobol.testing.RuntimeTests` | 0 | SUMMARY/34/0/0 |
| `npm test` | 0 | ℹ tests 396 ℹ pass 396 ℹ fail 0 ℹ skipped 0  |
| `node --test dist/tests/step6..9 + step21 (after LGA label wiring)` | 0 | # tests 101 # pass 101 # fail 0  |
| `npm test (after LGA label wiring)` | 1 | ℹ tests 396 ℹ pass 395 ℹ fail 1 ℹ skipped 0  |
| `node --test step11 '15. the pilot and planner make no external AI or network calls' (after inlining the label)` | 0 | # tests 1 # pass 1 # fail 0  |
| `npm test (final, after inlining the label)` | 0 | ℹ tests 396 ℹ pass 396 ℹ fail 0 ℹ skipped 0  |
| `pilot validate` (42 runs) | 41 exit 0 | POSUPDT (empty source) is the non-zero one |
| `pilot readiness` (42 runs) | 6 PASS | unchanged from STEP 20 |

`bmad governance` exits 3 because the scope is BMAD_BLOCKED; that is the expected result.

One intermediate `npm test` failed (395/396). The STEP 11 guard "the pilot and planner make no external AI or network calls" rejects any import of the BMad modules from `commands/pilot.ts`, which my first wiring of the LGA label had added. The label is now computed from configuration inside `pilot.ts`, with no BMad import; the guard passes and the final `npm test` result is the last row of the table.

No earlier test or gate was weakened.

## 8. Remaining external actions

| # | Action | Responsible |
|---|---|---|
| 1 | Provision the approval trust store with public keys | trust custodian (administrator) |
| 2 | Resolve the portfolio-status contradiction (DR-PORTMSTR-001, DR-PORTUPDT-001) for copybook PORTFLIO | business_sme |
| 3 | Source-verified evidence (re-delivery or signed adjudication) for the PORTFLIO records, PORTREAD file operations and RT-PORTREAD-002/003 | technical_authority |
| 4 | Confirm REQ-PORTREAD-001/002 | business_sme |
| 5 | Sign the G2 approval for `programs:PORTREAD` | requirements_approver (distinct from the requester) |
| 6 | Sign and import `ADA-8154d6398d4d`, re-prepared if expired | data_owner |
| 7 | Install pinned Node.js and Claude Code inside WSL2, and provide a verified provider-egress allowlist | administrator |
| 8 | Set `live_execution.requested` only after 1–7 | project owner |
| 9 | Authorize generation (flag, target directory, G3/G4) before the implementation stage | project owner and approvers |

## 9. Next milestone

**First real LIVE BMad stage for PORTREAD (`bmad-prd`, F1).** After actions 1–8:
1. Re-run `bmad executor preflight --workflow bmad-prd --scope programs:PORTREAD`.
2. Implement and test the LIVE runner adapter inside the verified boundary.
3. Execute through `bmad governed-run --scope programs:PORTREAD` and record and verify the receipt.
4. Continue stage by stage. The local converter stays the implementation mechanism, and the PORTREAD Java is changed only by an approved, evidence-backed story.
