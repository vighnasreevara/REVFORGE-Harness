# Forward engineering

## Components

| Component | Location | Role |
|---|---|---|
| CLI | `forward/runtime/src/cli.ts` (`node dist/runtime/src/cli.js`) | Every command: `doctor`, `validate`, `plan`, `workflow …`, `verification …`, `workbench …`, `pilot …`, `bmad …` |
| Orchestrator | `forward/runtime/src/orchestrator/` | Agent registry F1–F7, 16 workflow states, gates G0–G8, least-privilege write scopes, run store with a hash-chained audit log |
| Contracts | `forward/contracts/` | JSON Schema (Ajv 8) for inputs, deliverables, receipts, approvals, BMad records |
| Approvals and decisions | `forward/runtime/src/approval/` | Ed25519-signed approvals for G2/G3/G4 and signed decision resolutions, verified against a trust store |
| Verification | `forward/verification/src/`, `runtime/src/blockers/`, `runtime/src/remediation/`, `runtime/src/openai/` | Deterministic source checks, blocker audits, root-cause registry, remediation proposals (never applied), OpenAI packet preparation (never sent live) |
| Disclosure and isolation | `runtime/src/disclosure/`, `runtime/src/isolation/` | Signed disclosure authorizations for external AI providers; isolated execution boundary checks |
| Local converter (pilot) | `forward/runtime/src/pilot/` | COBOL reader and converter to Java, conversion validation, source readiness, application integration |
| Java runtime | `forward/runtime/java/revforge/cobol/` (20 tracked files) | COBOL data semantics for generated programs; `RuntimeTests` (34 tests) and the integration harness |
| BMad governance | `forward/runtime/src/bmad/`, `forward/integrations/bmad/` | Eligibility, preflight, governed runs, receipts, executor and isolation checks |
| Agents and skills | `forward/agents/fe-*.agent.md`, `forward/skills/fe-*/` (14) | F1–F7 definitions; copied to `.claude/` by `sync-agents` |
| Reports | `forward/reports/` | STEP reports and machine evidence |

## The F1–F7 agents

| Agent | Definition | Skills | Gate it feeds |
|---|---|---|---|
| F1 Requirements Analyst | `fe-requirements-analyst` | source-grounded-requirements, uncertainty-decision-register | G2 |
| F2 Data Mapping Specialist | `fe-data-mapping-specialist` | copybook-layout-contract, cobol-runtime-file-semantics | G2 |
| F3 Java Architect | `fe-java-architect` | java-architecture-spine, legacy-compatibility-adr | G3 |
| F4 Development Planner | `fe-development-planner` | evidence-backed-stories, sprint-readiness | G4 |
| F5 Java Developer | `fe-java-developer` | java-batch-implementation, compiler-repair | G5 |
| F6 Independent Tester | `fe-independent-tester` | independent-fixture-design, legacy-java-equivalence | G6 |
| F7 Independent Reviewer | `fe-independent-reviewer` | adversarial-code-review, end-to-end-trace-audit | G7 |

Agents run as Claude Code subagents on runtime-prepared packets: dispatch, then receipt, then `workflow record`. The runtime hashes and validates every output, and decides gates and transitions. Agents never approve.

## Two Java paths, kept separate

1. **Governed workflow path (G2–G8 and BMad).** This is the only path for new governed development. It is closed: Java generation through the workflow needs `generation.java_generation_allowed` (currently `false`), G4 PASS and BMad lifecycle evidence up to sprint.
2. **Historical local conversions (`LGA-*`).** Program-scoped local generation authorizations, accepted by the project owner, let the local converter produce Java for 41 programs (`pilot convert-app`). They stay valid as historical records, classified `LOCAL_LGA_NOT_BMAD_GOVERNED`. With mandatory BMad, a *new* local authorization (`pilot authorize`) is refused with `BMAD_BLOCKED` unless the scope has BMad lifecycle evidence. STEP-25 did not regenerate any Java.

## Coverage

Recounted in STEP-25 from the STEP-22 detail records; see `forward/reports/step-25/coverage.json`.

| Area | Result |
|---|---|
| Programs | 42: 41 with Java; COMPLETE 2 (PORTREAD, PROGNAME); PARTIAL 39; MISSING 1 (POSUPDT) |
| Business rules | 154: 67 verified by passing source-derived tests; 15 verified to a downstream gap; 40 unreachable; 32 blocked |
| Paragraphs | 402: 390 mapped; 95 executed by passing tests |
| Statements | 1,936: 1,337 mapped; 599 at explicit gaps; 414 executed by passing tests |
| PERFORM edges | 524: 397 structurally matched |
| Branches / loops | 190 of 254 / 26 of 32 mapped |
| Fields / records | 966 of 1,009 consistent / 196 of 231 represented |
| Level-88 conditions | 257 of 259 value-tested |
| Copybooks | 25: 19 used and complete (13 models, 6 complete in program); 6 not used |
| Diagrams | 65: 60 with a comparable Java counterpart; 5 without |
| JCL jobs | 15: 3 pass an end-to-end Java test; 11 blocked at a gap step; 1 needs IDCAMS (utility, not converted) |
| Engineering gates | conversion validation 41/42; source readiness 6/42 |

"COMPLETE" means complete under the current harness criteria: the program compiled, every check passes, conversion validation and readiness pass, and no forward gap is open. **It does not mean equivalent to the legacy program.**

## Where to look next

- [BMAD-GOVERNANCE.md](BMAD-GOVERNANCE.md): why no new governed development can start yet.
- [GAP-AND-REMEDIATION-SUMMARY.md](GAP-AND-REMEDIATION-SUMMARY.md): what blocks the 39 partial programs.
- `forward/README.md` and `forward/docs/*.md`: operator guides for each command family.
