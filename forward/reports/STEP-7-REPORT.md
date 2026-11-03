# STEP 7 report: scope reconciliation, G3/G4 approval gates and safe BMad execution

Real run: `FWD-20261031T172520Z-66b3` (baseline `352b97f0…4d24a068`).

**What was done:**
- **Implemented:** G3/G4 evaluators, signed design approvals, dependency-aware invalidation, scope reconciliation, the isolated executor.
- **Synthetic testing:** a full G2 → G3 → G4 flow with synthetic signers, in temporary fixtures only.
- **Real isolated installation:** BMad installed by its own installer into a synthetic workspace, and BMad activation code run there.

**What was not done:**
- **No real execution:** no BMad AI workflow and no real project workflow ran.
- **No approval:** no real requirement, architecture or story was approved.

In the real workflow, G3 and G4 are BLOCKED because G2 has not passed.

## 1. Git

- **Branch:** `main`.
- **Commit:** `b092004` (unchanged).
- **Working tree:** no tracked file modified (`git diff` is empty). The untracked files are `forward/` and the `fe-*` agent and skill files from earlier steps.
- **Git-ignored:**
  - `forward/integrations/bmad/staging/` and `forward/integrations/bmad/executor/` (both reproducible);
  - `.mcp.json` (still ignored, untouched).
- **Commits:** none; nothing pushed.

## 2. Files

**Created:**

| Area | Files |
|---|---|
| Runtime | `runtime/src/bmad/reconcile.ts`, `runtime/src/bmad/executor.ts`, `runtime/src/design/design.ts`, `runtime/src/design/approvals.ts` |
| Contracts | `contracts/orchestrator/design-approval-request`, `signed-design-approval`, `design-approval-record`, `approval-invalidation`; `contracts/bmad/scope-reconciliation`, `execution-manifest` (each `*.schema.json`) |
| Tests | `tests/step7.test.ts`, `tests/helpers/designfixture.ts` |
| Docs and reports | `docs/DESIGN-APPROVAL-OPERATIONS.md`, `reports/STEP-7-REPORT.md`, `reports/bmad-executor-report.json` |
| Executor | `integrations/bmad/executor/.gitignore`, plus the git-ignored provisioned executor |

**Modified:**

| File | Change |
|---|---|
| `runtime/src/approval/scope.ts`, `runtime/src/approval/snapshot.ts` | **G2 defect fix**, see §7 |
| `runtime/src/orchestrator/orchestrator.ts` | G3/G4 fresh evaluation, blocking, cascade |
| `runtime/src/orchestrator/gates.ts` | G3/G4 marked implemented |
| `runtime/src/orchestrator/permissions.ts` | `design/` is runtime-only |
| `runtime/src/bmad/mapping.ts`, `runtime/src/bmad/adapter.ts`, `runtime/src/bmad/eligibility.ts` | reconciliation in mapping; wording |
| `runtime/src/commands/bmad.ts`, `runtime/src/commands/workflow.ts`, `runtime/src/cli.ts` | new commands |
| `contracts/bmad/provenance.schema.json` | separate runtime requirements; decision class |
| `contracts/forward/architecture-record.schema.json` | optional `compatibility_concerns`, `assumptions` |
| `contracts/forward/development-stories.schema.json` | description only |
| `integrations/bmad/mapping.json` | v1.1.0 |
| `tests/step2.test.ts` | the implemented-gates inventory now lists G3/G4 and asserts G5–G8 are fail-closed |
| `docs/BMAD-INTEGRATION-OPERATIONS.md`, `docs/TRUST-CONFIGURATION-GUIDE.md` | executor, reconciliation, design roles |
| `reports/bmad-integration-report.md/.json` | regenerated |

**Not modified:** reverse agents and skills, `output/`, the original COBOL, Neo4j, `.claude/`, Git history.

## 3. Tests

**245 passed, 0 failed, 0 skipped**: the 217 existing tests plus 28 new ones.

**The new tests:**
1. scope expansion explained;
2. decision classification and exclusion of unrelated decisions;
3. a missing shared-dependency data contract blocks G3;
4. G3 blocked without G2;
5. G3 not passed without a real F3 output;
6. a signed G3 PASS;
7. unauthorized architecture signers (wrong role, agent identity, requester, forged key);
8. a stale architecture approval, with an invalidation record;
9. G4 blocked without G3;
10. missing stories;
11. missing requirement coverage and unsupported behaviour;
12. a signed G4 PASS reaching STORIES_APPROVED;
13. an invalid story approver; F4 cannot self-approve;
14. changed story contents;
15. an upstream requirement change invalidating G2, G3 and G4;
16. a revoked signer;
17. a BMad hash mismatch in the executor copy;
18. missing runtime dependencies;
19. protected writes refused;
20. a wrong workflow binding;
21. a fake completion receipt rejected;
22. a synthetic execution failure recorded;
23. checkpoint integrity, and a tampered approval record;
24. G2 still fail-closed;
25. G5–G8 still protected;
26. no Java generation authorized;
27. reverse and COBOL integrity;
28. LIVE refused with a contract-valid manifest, and no execute command exists;
29. regression: F3/F4 work never changes the G2 scope;
30. **real isolated execution:** BMad's `resolve_customization.py` run by the isolated `uv` in the installed synthetic workspace.

Tests 25 and 26 share one test case, and so do 21 and 22.

## 4–6. RTNCDE00: direct versus expanded scope

`bmad reconcile --scope programs:RTNCDE00` (scope digest `88d8562c…`, unchanged; baseline `352b97f0…`).

**The difference is real expansion, not a bug in scope membership.** Step 6's mapping preview reported it badly: it counted 3 runtime requirements as requirements and gave no reason for including each decision. Since mapping 1.1.0 it counts them separately, and every item carries an inclusion class and reason.

**Units:**

| Unit | Kind | Relation |
|---|---|---|
| RTNCDE00 | program | primary |
| RTNCODE | copybook | direct dependency (COPY) |
| SQLCA | copybook | direct dependency (SQL_INCLUDE) |

There are no transitive dependencies.

**Requirements: 4 direct (all on RTNCDE00); identical to Step 5.5.**

| Requirement | Outcome |
|---|---|
| REQ-RTNCDE00-001 | REQUIRES_SME_DECISION |
| REQ-RTNCDE00-002 | VERIFIED |
| REQ-RTNCDE00-003 | REQUIRES_EVIDENCE |
| REQ-RTNCDE00-004 | CONTRADICTED |

**Runtime requirements: 3,** RT-RTNCDE00-001…003, all VERIFIED and direct. These are the extra "requirements" in Step 6's count of 7 (4 + 3).

**Data contracts: 5** — 3 records of RTNCDE00 (direct) and 1 each from RTNCODE and SQLCA (shared dependency).

**Rules: 4** (BR-038…041), source run `rules@5_rules@1.0#b7ca9ee04731`; identical to Step 5.5.

**Decisions: 10 = 4 blocking (identical to Step 5.5) + 6 non-blocking.**

| Decision | Blocking | Class | Reason |
|---|---|---|---|
| DR-DB2CONN-002 | yes | cross_scope | RTNCDE00 plus DB2CMT, DB2CONN, HISTLD00, RTNANA00 |
| DR-F2-0011-001 | yes | shared_dependency | SQLCA |
| RVW-REQ-RTNCDE00-003 | yes | direct | REQ-RTNCDE00-003 |
| RVW-REQ-RTNCDE00-004 | yes | direct | REQ-RTNCDE00-004 |
| DR-RTNCDE00-001 | no | direct | REQ-RTNCDE00-001/-004 |
| DR-F2-0005-010 | no | direct | RTNCDE00 layout |
| DR-F2-0005-009 | no | cross_scope | RTNCDE00 and RTNANA00 (nested SQLCA) |
| DR-F2-PKT0010-002 | no | shared_dependency | encoding of 14 copybooks, including RTNCODE |
| RVW-GAP-092 | no | global | GAP-092: Mermaid diagram rendering; no unit |
| RVW-GAP-104 | no | global | GAP-104: diagram edges; no unit |

**Why the global decisions are included:** G2's scope evaluator applies unit-less system-wide gaps to every scope. They are retained, labelled `global`, and non-blocking.

**Excluded:** 110 requirements, 159 decisions and 150 rules outside the scope. No duplicate IDs. No stale data: the digest is identical to Step 5.5.

## 7. G3: architecture approval

**Implementation.** G3 was previously fail-closed; it is now implemented (`design/approvals.ts`, `design/design.ts`).

**What G3 PASS requires** (all re-verified at every evaluation):
- G2 PASS recorded on the baseline, plus a fresh G2 re-evaluation with its approval re-verified;
- the real F3 output (accepted, completed receipt; files unchanged);
- valid `forward/architecture-record` documents of both record types on the current baseline, bound to the current G2 approval;
- every approved requirement mapped to a component, with nothing outside the scope;
- every primary program replaced, and scope units only;
- an acyclic component graph;
- a framework choice justified by an ADR (no Spring default is assumed);
- ADRs citing scope sources;
- compatibility risks with testing implications;
- F2 data contracts named;
- every runtime requirement treated;
- every applicable compatibility concern addressed by an ADR or a resolved decision;
- no unbacked material assumption;
- no open blocking decision;
- a signed `architecture_approver` approval of this exact artefact;
- a separate `technical_authority` approval when an ADR changes legacy behaviour.

**Compatibility concerns are derived from source facts:** decimal precision, record layouts, file organization, return codes, batch/JCL, DB2 (`SQL_INCLUDE`), CICS (`CICS_*` edges), checkpoint/restart, shared dependencies.

**State machine:**
- G3 blocks the workflow if it fails at ARCHITECTURE_APPROVED or later;
- G3 is re-evaluated at the ARCHITECTURE_APPROVED transition and at F4 dispatch.

**G2 defect found and fixed.** Two G2 inputs counted later agents' work:
- the packet-provenance check counted *any* receipt-less packet (including a newly dispatched F3 packet) as a G2 blocker;
- the G2 snapshot included F3/F4 receipts, which made the F1/F2 consolidation look stale.

Either effect alone meant that starting F3 work invalidated G2, so G3 was unreachable. Both now consider only G2's required agents (F1/F2, read from the gate spec). Regression test 29 covers this.

The real workflow has only F1/F2 packets and receipts, so its G2 result, its 395 blocking findings and the RTNCDE00 digest are unchanged.

## 8. G4: story-set approval

**What G4 PASS requires:**
- G3 PASS recorded on the baseline, plus a fresh G3 re-evaluation (which re-evaluates G2);
- the real F4 output (files unchanged);
- valid `forward/development-stories` documents on the current baseline, naming the current G2 and G3 approvals;
- unique stories;
- every approved requirement covered, and no unsupported behaviour;
- components that are approved and actually implement the story's requirements;
- consistent epics;
- existing, acyclic dependencies (the implementation order is reported);
- concrete acceptance criteria tied to scope sources;
- independent testing expectations;
- scope data contracts;
- no unresolved blockers, and every story `ready`;
- the end-to-end trace: COBOL source → reverse rule → approved requirement → component → story;
- a signed `story_approver` approval of the exact story set.

**F4 cannot approve its own stories:** agent identities and `fe-*` names are rejected.

## 9. Signers and trust

**Reused, not duplicated:** the existing trust store, Ed25519 verification and the `AGENT_IDENTITY` rule.

**Roles:**

| Gate | Role |
|---|---|
| G3 | `architecture_approver` |
| G3 co-approval (when behaviour changes) | `technical_authority`, a distinct signer |
| G4 | `story_approver` |

**Approvals bind:**
- the baseline;
- the scope digest;
- the approved-requirements hash;
- the artefact hash;
- the dependency manifest;
- the upstream approval IDs and file hashes;
- signer, role and signing time;
- the policy digest;
- request expiry.

**Rejected:** unknown signers, unauthorized roles, agent or requester self-approval, tampered artefacts or records, replays, expired requests, and changed requirements, architecture or baseline.

**Invalidation:** revocation invalidates current approvals, and every invalidation is recorded as `INV-NNNN` with its causes and downstream impact; records are never deleted.

**Synthetic keys only:** synthetic keys exist only in test fixtures. The real workflow has **no trust store configured** (TRUST_NOT_CONFIGURED); none was created.

## 10–12. BMad installation and execution

| Item | Status |
|---|---|
| Staged release | verified: 360 files, `bmad doctor` OK, 6/6 bindings valid |
| Real repository install | **none**: repository `.claude/`, `_bmad/` and `_bmad-output/` are untouched |
| Isolated installation | **Yes, genuine.** BMad's own installer (`bmad-cli.js install --modules bmm --tools claude-code --yes`), run from a hash-verified copy of 6.12.4, installed into `executor/workspaces/synthetic-001` (29 skills, no shims, `_bmad/`). HOME/USERPROFILE were isolated, and nothing was written there. The six bound workflows are byte-identical to the pin. The real `~/.claude` and repository `.claude/` were hashed before and after: 273 files unchanged. |
| Runtime dependencies | 13 npm runtime dependencies (122 packages, `--ignore-scripts`, lock `f31f85fa…`) in the executor copy; `uv 0.13.6` in a private venv; Python 3.12.10; Claude Code CLI 2.1.302 |
| Genuine isolated BMad execution | **Partial.** BMad's deterministic activation script (`resolve_customization.py`) ran via the isolated `uv`, offline, in the synthetic workspace, for `bmad-architecture` (manually) and `bmad-prd` (test 30). No BMad *AI workflow* (a Claude Code session) was run: it would send content to Anthropic, and no authorization for that disclosure exists. |
| Real project workflow executed | **No.** Every real request was refused. |

**Executor safeguards:**
- the execution manifest builds a restricted `claude -p` command (`--restricted`, `dontAsk`, `--strict-mcp-config`, `--setting-sources project`, web and shell tools disallowed);
- there is no execute command;
- `executeLive` refuses unless every precondition holds;
- failures become `BEX` records, and completion claims must pass the receipt validator.

## 13–17. Real workflow state and integrity

| Item | Status |
|---|---|
| Gates | G0 PASS, G1 PASS, **G2 UNVERIFIED** (NOT_READY, 395 blocking; no trust anchor; no approval), **G3 BLOCKED**, **G4 BLOCKED**, G5–G8 BLOCKED |
| Workflow state | REQUIREMENTS_DRAFTED; checkpoint #152 verified; resume OK |
| Audit | 190 → 198 entries: G2/G3/G4 evaluations, one refused architecture approval request, resume; chain verified |
| New run records | `g2/G2E-0010`, `gates/G2-0026`, `gates/G3-0027`, `gates/G4-0028`, `design/evaluations/G3E-0001`, `design/evaluations/G4E-0001`. The 230 prior records are unchanged. |
| `output/` | 534 files unchanged |
| Original COBOL | 371 files unchanged |
| `.claude/` | 44 files unchanged |
| Plan files | 49 files unchanged |
| Java | **none generated**; generation not authorized; Build binding disabled |

## 18. Blockers before an authorized F3 execution on RTNCDE00

1. **Trust store.** The custodian must provision it with real `requirements_approver`, `business_sme`, `technical_authority`, `exception_approver`, `architecture_approver` and `story_approver` signers.
2. **Resolve the 4 blocking decisions:** DR-DB2CONN-002, DR-F2-0011-001, RVW-REQ-RTNCDE00-003, RVW-REQ-RTNCDE00-004.
3. **Correct REQ-RTNCDE00-004.** It is CONTRADICTED; apply the citation correction RP-8d2dd33787 via a signed RVW resolution.
4. **Evidence for REQ-RTNCDE00-003** (REQUIRES_EVIDENCE) and an SME decision for REQ-RTNCDE00-001.
5. **G2 approval.** Request a signed G2 approval for `programs:RTNCDE00`, reach G2 PASS, then advance to REQUIREMENTS_APPROVED.
6. **Dispatch F3** through the forward dispatcher (a manual F3 agent run is possible after step 5).
7. **For BMad LIVE only:**
   - a signed AI-provider disclosure authorization for Anthropic / Claude Code, which first needs a contract, an import command and a policy;
   - `live_execution.requested: true`;
   - a LIVE packet type that hands the packet to the isolated workspace.

## 19. Requirements for Step 8

- **AI-provider disclosure authorization.** A contract and import command for Anthropic / Claude Code, separate from the OpenAI one. Rules for per-provider data classes, and for web research, which BMad architecture requests.
- **LIVE path.** LIVE packet preparation and a per-packet copy of the synthetic workspace, then executor runs through `executeLive`. Result normalization from BMad markdown output to `bmad/output-*`, then receipts.
- **G3 → F3 receipts.** Decide how accepted BMad architecture results become F3 receipts (or stay advisory) without bypassing the dispatcher.
- **G5–G8 evaluators.** Implement them (build, independent testing, review, acceptance), and a Java-generation authorization gate. Build stays disabled until then.
- **F3 / F4 skills.** Update `fe-java-architecture-spine` and `fe-evidence-backed-stories` so F3 emits `compatibility_concerns` and `assumptions`, and F4 names the G2/G3 approval IDs.

Step 8 was not started.
