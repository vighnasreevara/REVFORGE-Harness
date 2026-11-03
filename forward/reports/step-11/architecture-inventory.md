# REVFORGE: current architecture inventory (Step 11)

## Already implemented (Steps 1–10; not rebuilt)

| Area | Where | State |
|---|---|---|
| Reverse pipeline | `.claude/agents/1_…7_` with their skills; `output/` (534 files) | complete, untouched |
| Forward agents F1–F7 | `.claude/agents/fe-*.agent.md` (7) | defined; F1/F2 delivered on the real run; F3–F7 never dispatched |
| Forward skills | `.claude/skills/fe-*` (14) | installed |
| Deterministic orchestrator | `runtime/src/orchestrator` (states, gates G0–G8, dispatch, receipts, permissions, checkpointed audit) | real run REQUIREMENTS_DRAFTED |
| Source verification | `verification/src` (COBOL source, layout, numeric, semantic, context) | in use |
| G2 approval machinery | `runtime/src/approval` (snapshot, scope, decisions, canonical signing, trust) | working; waiting for trust and signatures |
| G3/G4 design approvals | `runtime/src/design` | exercised only in synthetic fixtures |
| Blocker pipeline, remediation, workbench | `runtime/src/blockers`, `remediation`, `workbench` | working |
| Evidence context and adjudication | `runtime/src/context` (ESU/EAR) | 25 EAR records on the real run |
| Human operations and review package | `runtime/src/operations` | Step 10 package; refreshed in Step 11 |
| OpenAI verification adapter | `runtime/src/openai` | 8 records; no new calls |
| BMad 6.12.4 integration | `runtime/src/bmad`, `integrations/bmad` (pin, mapping, bindings, isolation) | adapter and preflight; LIVE refused (`EXECUTION_UNSUPPORTED`) |
| WSL2 isolation | `runtime/src/isolation`, `integrations/bmad/isolation` | ISOLATION_TESTED; no runner or egress inside |
| Recovery and integrity | `tools/backup.js`, `tools/recovery-manifest.js` | Step 11 adds the git-checkout restore |
| Contracts | `contracts/**` | 84 schemas (2 of them added in Step 11) |
| Tests | `tests/step*.test.ts` | 294 before Step 11 |

## Added in Step 11 (minimum needed for the pilot-first strategy)

| Addition | Why it was needed |
|---|---|
| `runtime/src/pilot/plan.ts` and `pilot plan` | Gives each requirement a VERIFIED / PARTIAL / GAP class at statement level. This did not exist: G2 classifies approvability, not implementability. |
| `runtime/src/pilot/cobol-subset.ts`, `java-emit.ts`, `pilot.ts` and `pilot run` | Proves conversion, gap preservation and validation end to end on a synthetic program. Strict subset only; this is not a general converter. |
| `contracts/pilot/*` | The result contract makes "COMPLETE with gaps" and "equivalent from fixtures only" invalid by construction. |
| `forward/pilot/synthetic-rc/` | The synthetic COBOL, specification, driver and fixtures |
| `backup.js restore-test --checkout [--with-local-assets]` | Step 10's restore could not run the git-dependent tests or the asset-dependent tests |

## Genuinely missing (not built; needs a decision or a later step)

| Item | Note |
|---|---|
| A general COBOL-to-Java generator for real programs | Deliberately not built. The pilot subset covers no SQL, COMP fields, files, CICS or arithmetic. |
| A COBOL compiler or reference runtime | None on this machine (Windows, WSL and Docker were checked). No equivalence evidence can be produced. |
| A Maven build | No Maven installed; the pilot uses `javac` directly. |
| G5–G8 evaluators | `fail_closed` by design until a later step |

## Waiting only for human authorization

| Item | Who |
|---|---|
| A trust store with real signers for every role | key custodian |
| DR-DB2CONN-002, DR-F2-0011-001 | `technical_authority` |
| RVW-REQ-RTNCDE00-002 / -003 / -004 | `business_sme` (or `exception_approver`) |
| G2 approval of `programs:RTNCDE00` | `requirements_approver` |
| G3 / G4 approvals | `architecture_approver`, `story_approver` |
| Java generation flag plus a target directory | project authority (config) |
| BMad LIVE: runner inside the boundary, verified egress, signed Claude disclosure | operator plus authority |
