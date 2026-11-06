# REVFORGE Forward Engineering

The forward harness turns the reverse-engineering evidence (the BRD, 154 business rules, the data dictionary, logic, diagrams and gaps in [`../output/`](../output/)) into a **governed Java 21 modernization**. A deterministic TypeScript runtime controls the work. Agents produce deliverables, but no agent output can pass a gate, approve anything or authorize Java generation.

```
reverse evidence ─▶ G0 baseline ─▶ G1 evidence ─▶ F1/F2 requirements ─▶ G2 ─▶ F3 architecture ─▶ G3
   ─▶ F4 stories ─▶ G4 ─▶ F5 Java ─▶ G5 build ─▶ F6 independent tests ─▶ G6 ─▶ F7 review ─▶ G7 ─▶ G8 acceptance
```

**Status in one line.** In the real workflow G0 and G1 pass, G2 is UNVERIFIED and G3–G8 are BLOCKED. Java exists for 41 of 42 programs, but only from historical local conversions outside that workflow. 569 gap records are open, and **legacy COBOL equivalence is not established**. See [Modernization status](#9-modernization-status).

## 1. Seven forward agents and their 14 skills

| Agent | Role | Skills | Feeds gate |
|---|---|---|---|
| F1 Requirements Analyst | source-grounded requirements and the decision register | `fe-source-grounded-requirements`, `fe-uncertainty-decision-register` | G2 |
| F2 Data Mapping Specialist | copybook layout contracts and COBOL runtime/file semantics | `fe-copybook-layout-contract`, `fe-cobol-runtime-file-semantics` | G2 |
| F3 Java Architect | Java architecture spine and legacy-compatibility ADRs | `fe-java-architecture-spine`, `fe-legacy-compatibility-adr` | G3 |
| F4 Development Planner | evidence-backed stories and sprint readiness | `fe-evidence-backed-stories`, `fe-sprint-readiness` | G4 |
| F5 Java Developer | implementation inside the authorized Java target only | `fe-java-batch-implementation`, `fe-compiler-repair` | G5 |
| F6 Independent Tester | independent fixtures and legacy-equivalence testing | `fe-independent-fixture-design`, `fe-legacy-java-equivalence` | G6 |
| F7 Independent Reviewer | adversarial review and end-to-end trace audit | `fe-adversarial-code-review`, `fe-end-to-end-trace-audit` | G7 |

The canonical definitions are in [`agents/`](agents/) and [`skills/`](skills/). Claude Code discovers them through byte-identical copies in `.claude/`. Those copies are generated and git-ignored. `npm run setup` (build plus `sync-agents`) installs both the forward and the [reverse](../reverse/README.md) definitions there. `sync-agents --check`, run in CI, fails on a missing, edited or unregistered copy. `orchestrator/skills.ts` validates every skill's metadata, sections, owner, contracts and write scope.

## 2. TypeScript orchestrator

[`runtime/src/orchestrator/`](runtime/src/orchestrator/) is the single deterministic controller.

| Module | Responsibility |
|---|---|
| `states.ts` | the workflow states and their guarded transitions (gate PASS, accepted receipt or dispatch) |
| `gates.ts` | G0–G8 evaluation; every result records its inputs with SHA-256 and the baseline it was evaluated on |
| `orchestrator.ts` | `init`, gates, `advance`, dispatch packets, receipt recording, `status`, `resume` |
| `permissions.ts` | least-privilege write scopes; reverse outputs and definitions, `.claude/`, sources, runtime, contracts and config are never writable by an agent |
| `store.ts` | atomic `state.json` with checkpoint digest, a hash-chained `audit.jsonl`, an operation lock |
| `ledger.ts`, `skills.ts`, `agents.ts`, `mirror.ts`, `reverse.ts` | the unit coverage ledger, the skill and agent registries, and the `.claude/` synchronization |

Every agent works from a **dispatch packet** and returns a **receipt**. The runtime hashes each output, validates it against its JSON Schema contract ([`contracts/`](contracts/), Ajv) and runs the semantic checks in [`verification/src/`](verification/src/). Only then does it accept the receipt. Signed approvals (Ed25519) are handled by [`runtime/src/approval/`](runtime/src/approval/) and [`runtime/src/design/`](runtime/src/design/).

## 3. COBOL-to-Java converter and Java 21 runtime

| Part | Where | What it is |
|---|---|---|
| Converter | [`runtime/src/pilot/`](runtime/src/pilot/) | a COBOL front end (`cobol-app.ts`), a Java back end (`java-app.ts`), application conversion and JCL integration (`app-convert.ts`, `app-integrate.ts`) |
| Java runtime | [`runtime/java/`](runtime/java/) | a hand-written Java 21 library for COBOL semantics: fields and storage, numeric operations, editing, 88-level conditions, files, run units and `CALL`. Its own tests run in CI (`RuntimeTests`, `SUMMARY\|34\|0\|0`). |
| Pilot sandboxes | [`pilot/`](pilot/) | synthetic conversion fixtures, local generation authorizations, the demo's Java sandbox |

The converter never runs on its own authority. Each conversion needs a program-scoped local authorization bound to the source SHA-256 and the output directory. **Generated Java is git-ignored** (`generated/`).

## 4. Two engineering quality gates

| Gate | Decides |
|---|---|
| `SOURCE_READINESS` | whether one program's source is understood well enough to convert: closure of paragraphs, copybooks and calls, and known hazards |
| `CONVERSION_VALIDATION` | whether a conversion output is what its label says: compiled, tested, traced statement by statement, with no fabricated behaviour |

Both are in [`runtime/src/pilot/gates.ts`](runtime/src/pilot/gates.ts) (`pilot readiness`, `pilot validate`). They **never authorize generation and never mean equivalence**.

## 5. G0–G8 governance checkpoints

| Gate | Checkpoint | Passes only when |
|---|---|---|
| G0 | Baseline integrity | every reverse input matches its SHA-256 in the baseline manifest |
| G1 | Evidence verification | permanent IDs, plan outputs and evidence packets are consistent with the reverse inputs |
| G2 | Requirements approval | requirements are complete and a **signed human approval** verifies against the configured trust store |
| G3 | Architecture approval | a signed approval of the validated F3 architecture |
| G4 | Development plan approval | a signed approval of the validated F4 story set |
| G5 | Java build and tests | an authorized Java build compiles and its tests pass |
| G6 | Independent verification | F6 results produced independently of the implementation |
| G7 | Independent review | F7 review and trace audit without critical findings |
| G8 | Acceptance | a signed human acceptance |

A gate passes only on the current baseline, and only after its prerequisite has passed. G5–G8 fail closed. `generation.java_generation_allowed` is `false` in [`config/forward.config.json`](config/forward.config.json); generation also needs G4 PASS.

## 6. Mandatory BMad enforcement

The BMad Method 6.12.4 is **mandatory** for new governed forward development (`bmad_governance.mandatory = true`). Six workflows are bound to the forward agents: PRD, Architecture, Epics and Stories, Sprint Planning, Build and Code Review. A governed run without a valid LIVE BMad receipt stays `BMAD_BLOCKED`, with no fallback. Failed, invalid, MOCK and SIMULATED receipts never count. The pinned release, adapter, isolated executor and preflight are in [`integrations/bmad/`](integrations/bmad/) and [`runtime/src/bmad/`](runtime/src/bmad/).

Status: **enforcement verified; LIVE execution blocked.** No workflow is authorized and none has executed live, so no receipt exists. See [`handover/BMAD-GOVERNANCE.md`](handover/BMAD-GOVERNANCE.md).

## 7. Dashboard and testing

- **Dashboard.** [`dashboard/`](dashboard/) is the read-only Modernization Command Center (React, TypeScript, Vite). It loads only committed evidence whose SHA-256 matches its manifest, and recounts and cross-checks every total. It has its own unit tests, a build and a headless browser smoke test.
- **Tests.** [`tests/`](tests/README.md) holds the `node:test` suites, organized by functionality. In the developer environment every suite runs. CI runs the suites that work on a pure checkout; tests that need the restricted COBOL source or generated Java skip themselves there.
- **CI.** [`.github/workflows/revforge-ci.yml`](../.github/workflows/revforge-ci.yml) has four jobs:
  - forward: `npm run setup` on a fresh checkout, doctor, `sync-agents --check`, tests and the Java runtime tests;
  - dashboard;
  - the synthetic demonstration;
  - repository and report integrity.

## 8. Executable demonstration

[`demo/gates/`](demo/gates/README.md) runs all nine checkpoints, G0–G8, end to end on a small **synthetic** COBOL program:

```bash
cd forward && npm ci
npm run demo:gates    # nine DEMO PASS rows; exit 0 only if all pass
npm run demo:test     # happy path and negative paths
```

It reuses the real converter, Java runtime and gate machinery. Approvals are signed with an ephemeral key for that run, which the real trust store does not accept. BMad stages are SIMULATED and never counted. Every record says `environment: SYNTHETIC_INTERVIEW_DEMO`. The demonstration writes nothing to the real workflow, configuration or evidence. A [sample report](demo/gates/sample-run/DEMO-REPORT.md) is committed.

## 9. Modernization status

Three kinds of Java appear in this project. Keep them apart:

| | What it is | Governed by G0–G8 and BMad? | Status |
|---|---|---|---|
| **Historical local conversions** | Java for 41 of 42 programs, produced by the converter under program-scoped local authorizations; git-ignored | **No**: classified `LOCAL_LGA_NOT_BMAD_GOVERNED`, not retroactively compliant | 2 COMPLETE under harness criteria (PORTREAD, PROGNAME), 39 PARTIAL, 1 MISSING (POSUPDT, empty source) |
| **Governed workflow** | the real G0–G8 workflow over the whole application | Yes | no Java generated: G0–G1 PASS, G2 UNVERIFIED (no trust store configured), G3–G8 BLOCKED |
| **Synthetic demonstration** | one synthetic program, end to end | demo gates only; BMad SIMULATED | 9/9 demo gates PASS; changes nothing in the real project |

| Measure | Value |
|---|---|
| Business rules | 154: 67 Java-verified by source-derived tests, 15 verified up to a downstream gap, 40 unreachable, 32 blocked |
| Open gap records | 569, all OPEN, in 23 root-cause groups |
| COBOL-equivalent programs or rules | **0**: no legacy COBOL run is available to compare against |
| Production readiness | **not production-ready** |

*COMPLETE*, *compiles* and *passes source-derived tests* do not mean equivalent to the legacy COBOL program.

## Folder map

```
forward/
  agents/  skills/        canonical F1–F7 definitions and their 14 skills
  runtime/src/            TypeScript runtime and CLI (orchestrator, approval, design, bmad, pilot, demo, ...)
  runtime/java/           hand-written Java 21 runtime library (tracked)
  config/                 forward.config.json (reverse artifact paths, generation policy, BMad governance)
  contracts/              JSON Schema contracts (input, output, forward deliverables, bmad, demo, ...)
  verification/src/       ID, evidence-class, semantic and numeric checks
  integrations/bmad/      pinned BMad release, bindings, isolated executor
  dashboard/              read-only Modernization Command Center
  demo/gates/             synthetic G0–G8 demonstration
  pilot/                  conversion sandboxes and local authorizations
  tests/                  node:test suites (see tests/README.md)
  reports/                engineering reports and machine evidence (see reports/README.md)
  handover/               final handover package
  docs/                   operations guides (approvals, trust, BMad, OpenAI verification, recovery)
  tools/                  report generators and the backup tool
  generated/  runs/       generated Java and workflow run records (git-ignored, local only)
```

## Commands

```bash
cd forward
npm ci && npm run setup                              # build + install the .claude/ discovery copies
node dist/runtime/src/cli.js doctor                  # environment, inputs, .claude/ drift
node dist/runtime/src/cli.js sync-agents --check     # forward and reverse definitions vs .claude/
node dist/runtime/src/cli.js validate                # reverse artifacts and cross-references
node dist/runtime/src/cli.js workflow status         # the real workflow (needs local run records)
npm test                                             # full suite (developer environment)
```

Requirements: Node.js 20 or later, JDK 21 (`REVFORGE_JAVA_HOME`) and Python 3. The COBOL source is optional, but without it readiness is never reported as ready. Set it with `REVFORGE_COBOL_SOURCE_ROOT`, `cobol_source.root` in the config, or `--source-root`. Exit codes: 0 success, 1 check failed, 2 usage, 3 generation refused, 4 configuration.

## Further reading

- [Report catalog](reports/README.md): the development history (STEP reports) and the reports by topic.
- [Architecture](handover/ARCHITECTURE.md).
- [Forward engineering in depth](handover/FORWARD-ENGINEERING.md).
- [Testing and verification](handover/TESTING-AND-VERIFICATION.md).
- [Known limitations](handover/KNOWN-LIMITATIONS.md).
