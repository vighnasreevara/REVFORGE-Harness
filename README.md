# REVFORGE — Evidence-Governed COBOL-to-Java Modernization Harness

Author: **Vighnasree Vara**

```
COBOL  →  Reverse Engineering  →  BRD  →  Forward Engineering  →  Java 21  →  Verification
```

REVFORGE modernizes a legacy COBOL application under strict evidence rules:
- every claim traces back to a source line;
- every unknown becomes a recorded gap;
- nothing is called verified unless a recorded result supports it.

| Start here | |
|---|---|
| **[Reverse Engineering](reverse/README.md)** | seven agents: COBOL → BRD, 154 business rules, 65 diagrams, permanent source IDs |
| **[Forward Engineering](forward/README.md)** | seven agents, the orchestrator, the converter and Java 21 runtime, quality gates, two human gates (G1, G2) with automated pre-checks, mandatory BMad |
| **[End-to-end architecture](forward/handover/ARCHITECTURE.md)** | diagrams of the whole system |
| **[Dashboard](forward/dashboard/)** | read-only Modernization Command Center ([operations](forward/handover/DASHBOARD-OPERATIONS.md)) |
| **[Client dashboard prototype](forward/dashboard-prototype/README.md)** | plain-language dashboard for non-technical clients: the problem, the architecture, the agents running live, the outputs, the Udara comparison and the BMad stages (one HTML file, no build) |
| **[Executable demonstration](forward/demo/gates/README.md)** | the two-gate workflow (two pre-checks, G1, G2, five automated steps) end to end on a synthetic program ([sample report](forward/demo/gates/sample-run/DEMO-REPORT.md)) |
| **[Evidence and reconciliation reports](forward/reports/README.md)** | the report catalog: [reverse-forward reconciliation](forward/reports/REVERSE-FORWARD-RECONCILIATION.md), [final reconciliation](forward/reports/STEP-22-FINAL-RECONCILIATION.md), [master gap register](forward/reports/STEP-23-MASTER-GAP-REGISTER.md) |
| **[CI results](https://github.com/vighnasreevara/REVFORGE-Harness/actions/workflows/revforge-ci.yml)** | four jobs on every push and pull request |

**Current status.** The engineering handover is complete; the modernization is not.
- 41 of 42 programs have Java, and 2 of them are complete under the harness criteria.
- 569 gap records are open.
- The governed workflow has passed its BASELINE and EVIDENCE pre-checks. Real G1 is UNVERIFIED and G2 BLOCKED.
- **Legacy COBOL-to-Java behavioural equivalence has not been established.**

See [Project status](#project-status).

## Architecture in brief

| Layer | What it is | Status |
|---|---|---|
| **A. [Reverse engineering](reverse/README.md)** (`reverse/`, `output/`) | Seven Claude Code agents and their 14 skills exchange JSON artifacts. They produce a BRD, 154 business rules, 65 Mermaid diagrams and a gaps register. Every element carries a permanent source ID from a Neo4j registry, accessed over MCP. | complete for the sample system |
| **B. [Forward engineering](forward/README.md)** (`forward/`) | Seven agents and their 14 skills under a deterministic TypeScript orchestrator; a COBOL-to-Java converter with a hand-written Java 21 runtime; two engineering quality gates (`SOURCE_READINESS`, `CONVERSION_VALIDATION`); two automated pre-checks (`BASELINE`, `EVIDENCE`) and two human gates, G1 and G2, with signed approvals; mandatory BMad | Java for 41 of 42 programs, from historical local conversions only; real pre-checks PASS, G1 UNVERIFIED, G2 BLOCKED; BMad LIVE execution blocked |
| **C. [Governance demonstration](forward/demo/gates/README.md)** (`forward/demo/gates/`) | An isolated synthetic two-gate run that executes the pre-checks, the G1 and G2 approvals, story validation, compilation, tests, independent verification, review and completion. The BMad lifecycle is only simulated. | 9/9 demo steps pass in CI; changes nothing in the real project |

**How the layers connect:**
- Reverse writes artifacts to `output/`; forward reads them from there and never writes back.
- The baseline manifest binds every reverse artifact by SHA-256; the BASELINE pre-check re-hashes them.
- Permanent source IDs are carried through requirements, architecture, stories, Java and tests.

**Two kinds of gates:**
- **Engineering quality gates** decide whether a single program can be converted and whether a conversion is what its label says. They never authorize generation.
- **The governed workflow** has two human gates, G1 (approved requirements) and G2 (approved architecture). Everything else is automated: the BASELINE and EVIDENCE pre-checks before G1, and story validation, build, independent testing and review after G2. The run completes after the F7 review; there is no human acceptance gate.

**Gate numbering.** G1 is the requirements approval and G2 the architecture approval. They were called G2 and G3 before 2026-11-09, and the workflow had nine gates (G0–G8) before 2026-11-08. Workflow records written earlier keep their original names; the runtime reads them through a mapping and never rewrites them. Dated reports and the handover package keep the numbering of their date.

## Setup

After cloning, install the Claude Code discovery copies of the agents and skills. They are generated, not committed:

```bash
cd forward
npm ci
npm run setup     # build, install all 42 definitions into .claude/, verify (works on Windows and Linux)
```

Claude Code then finds all 14 agents and 28 skills in `.claude/agents/` and `.claude/skills/`. Start or restart Claude Code in the repository root after setup. Requirements: Node.js 20+, plus JDK 21 for the Java and demo steps.

## Quick demo

```bash
cd forward
npm ci
npm run demo:gates    # runs the synthetic two-gate demonstration (Node.js 20+, JDK 21)
npm run demo:test     # happy path and negative paths
```

Expected result: nine `DEMO PASS` rows and the verdict `SYNTHETIC_DEMO_COMPLETED`. Each negative-path test injects one defect and must be stopped at the right step with exit code 1. The defects include:
- an altered source hash;
- a forged, missing or wrong-role approval;
- a compilation failure;
- Java that differs from the independent oracle;
- tampered evidence.

**Isolation.**
- Every record says `environment: SYNTHETIC_INTERVIEW_DEMO`, `production_authorization: NOT_GRANTED`, `real_bmad_execution: NOT_EXECUTED` and `legacy_equivalence: NOT_ESTABLISHED`.
- Approvals are signed with an ephemeral key that the real trust store does not accept.
- The demonstration writes nothing to the real workflow, configuration or evidence.

## Repository layout

```
reverse/                 Reverse engineering
  agents/  skills/       canonical definitions: 7 agents (1_inventory_c … 7_synthesis_c), 14 skills
  docs/                  design notes for the permanent-ID enhancements (Agents 1–3)
output/                  Reverse artifacts: inventory, parser, data, logic, rules, diagram, final_report (BRD)
forward/                 Forward engineering
  agents/  skills/       canonical definitions: 7 agents (F1–F7), 14 skills
  runtime/               TypeScript orchestrator and CLI, converter, Java 21 runtime library
  config/ contracts/     configuration and JSON Schema contracts
  integrations/bmad/     pinned BMad release and isolated executor
  verification/          evidence and semantic checks
  dashboard/             read-only Modernization Command Center
  dashboard-prototype/   client dashboard prototype (one HTML file)
  demo/gates/            synthetic two-gate demonstration
  tests/                 test suites
  reports/  handover/    engineering reports and evidence, final handover package
  docs/                  operations guides
.claude/agents/          generated, git-ignored: discovery copies of all 14 agents (npm run setup)
.claude/skills/          generated, git-ignored: discovery copies of all 28 skills (npm run setup)
.github/workflows/       CI
licenses/  LICENSE  THIRD_PARTY_NOTICES.md
```

**One source of truth for agents and skills.** The only tracked definitions are in `reverse/agents`, `reverse/skills`, `forward/agents` and `forward/skills`; edit them there. Claude Code discovers agents and skills only under `.claude/`, so `npm run setup` (which runs `sync-agents`) generates byte-identical, git-ignored copies there. They are plain file copies: no symlinks or junctions. After editing a definition, reinstall:

```bash
cd forward
node dist/runtime/src/cli.js sync-agents           # reinstall all 42 copies into .claude/
node dist/runtime/src/cli.js sync-agents --check   # exit 1 on a missing, edited or unregistered copy (CI runs this)
```

Only `.claude/agents/` and `.claude/skills/` are ignored; other Claude Code configuration such as `.claude/settings.json` is unaffected. Git cannot see changes in ignored files, so `doctor` and the reverse-harness checks compare the installed copies with their sources instead. An edited, source-less or unregistered copy is still reported as a local change.

**Why `output/` is at the root.** The reverse artifacts keep their original location, because historical evidence pins them by path: the workflow baseline, the source-integrity records, the CI integrity checks and the dashboard evidence. See [reverse/README.md](reverse/README.md#why-the-artifacts-stay-in-output).

## Dashboards

**Client dashboard prototype.** [`forward/dashboard-prototype/`](forward/dashboard-prototype/README.md) is the approved, plain-language dashboard for non-technical clients. Open `index.html` in a browser; it needs no build. It explains the problem and the architecture, replays a labelled demo run with the agents working live, and shows the outputs, the Udara comparison and the BMad stages. Its figures are a snapshot of this repository. The layout rules it follows are in [`CLAUDE.md`](CLAUDE.md).

**Modernization Command Center.** `forward/dashboard/` is the read-only **REVFORGE Modernization Command Center** (React, TypeScript, Vite). Its 12 sections:
- Executive overview, Reverse vs forward, Programs, Business rules;
- Master gap register, Dependency analysis, Root cause and roadmap, Diagrams;
- BMad governance, Testing and readiness, Handover and evidence, Evidence validation.

```bash
cd forward/dashboard
npm ci
npm run dev        # http://127.0.0.1:5180 (copies the committed evidence first)
npm test           # frontend tests
npm run build      # production build into dist/
npm run smoke      # after build: CSP, evidence hashes, routes in headless Edge/Chrome
```

**Evidence pipeline:**
- Only files committed at `HEAD` are copied, with their SHA-256.
- A file is loaded only when its SHA-256 matches the manifest.
- Every total is recounted and cross-checked.
- Missing or altered evidence is shown as *unavailable*; it is never loaded or replaced.

The hash check proves the served copies are consistent with the locally produced manifest. It does not authenticate the repository or a deployment.

## BMad (AI drafting stages)

BMad Method 6.12.4 is the AI method the forward agents work through to draft standard project documents. REVFORGE governs it strictly: BMad never approves anything, its output is an optional draft for the next agent, and every result is checked before it counts.

| Forward step | BMad workflow | Produces |
|---|---|---|
| F1 Requirements | `bmad-prd` | product requirements document (PRD) |
| F3 Architecture | `bmad-architecture` | architecture document |
| F4 Planning | `bmad-create-epics-and-stories`, `bmad-sprint-planning` | epics and stories, sprint plan |
| F5 Build | `bmad-build` | implementation |
| F7 Review | `bmad-code-review` | code review |

F2 (data mapping) and F6 (independent testing) stay outside BMad on purpose: F2 has no BMad counterpart, and F6 must be independent of the implementation.

**Status.**
- **Mandatory, enforced, not yet run live.** A governed run needs a verified LIVE BMad result for every stage. There are none yet, so the real run is `BMAD_BLOCKED`. The 41 Java programs come from the local deterministic converter and are recorded as not BMad-governed.
- **Locked route to the AI provider: built and verified.** LIVE runs execute Claude Code in the whole-process sandbox, which reaches only `api.anthropic.com:443` through an allowlist proxy. `bmad executor egress-test` proves this (provider reachable, everything else refused, the key file invisible) and records `forward/integrations/bmad/isolation/egress-test-report.json`. LIVE stays off: `live_execution.requested` is `false`.
- **Synthetic MOCK run: done, at no cost.** BMad was run through the runtime on the synthetic project in MOCK mode (no AI provider called). PRD, architecture and epics-and-stories ran with sealed packets. Sprint planning stopped, because a mock cannot supply real upstream results. Build and review were refused: there is no generation authorization, no build and no independent F6 test yet. The verdict stayed `BMAD_BLOCKED`, as intended.

Details: [forward/README.md](forward/README.md#6-mandatory-bmad-enforcement) and [forward/docs/BMAD-INTEGRATION-OPERATIONS.md](forward/docs/BMAD-INTEGRATION-OPERATIONS.md).

## From prototype to the real project

Everything technical is in place. What remains needs people, and a budget for the AI calls:

1. **Name the real signers** (requirements approver, architecture approver, business SME, technical authority, data owner, project owner). Each creates their own Ed25519 key, and an administrator adds the public keys to the trust store. Some roles must be different people.
2. **Resolve the business decisions** and the blocking findings, then the requirements approver **signs G1**.
3. **The data owner signs the disclosure authorization** that allows the selected files to be sent to the AI provider, with limits on cost, files, bytes and runs.
4. **The project owner switches BMad to LIVE** (`live_execution.requested`) and sets `bmad.provider_credential_file`. The first stages then run for real.
5. **Forward engineering continues:** architecture and **G2**, stories, build (with generation authorized), independent testing and review.

The client dashboard shows the same steps, with synthetic signers each marked "replace with a real person".

## Documentation

| Topic | Document |
|---|---|
| Reverse engineering | [reverse/README.md](reverse/README.md) |
| Forward engineering | [forward/README.md](forward/README.md), [in depth](forward/handover/FORWARD-ENGINEERING.md) |
| Architecture (diagrams) | [forward/handover/ARCHITECTURE.md](forward/handover/ARCHITECTURE.md) |
| BMad governance | [forward/handover/BMAD-GOVERNANCE.md](forward/handover/BMAD-GOVERNANCE.md), [integration and provider egress](forward/docs/BMAD-INTEGRATION-OPERATIONS.md) |
| Client dashboard prototype | [forward/dashboard-prototype/README.md](forward/dashboard-prototype/README.md) |
| Dashboard layout rules | [CLAUDE.md](CLAUDE.md) |
| Testing and verification | [forward/handover/TESTING-AND-VERIFICATION.md](forward/handover/TESTING-AND-VERIFICATION.md), [test catalog](forward/tests/README.md) |
| Known limitations | [forward/handover/KNOWN-LIMITATIONS.md](forward/handover/KNOWN-LIMITATIONS.md) |
| Reports and development history | [forward/reports/README.md](forward/reports/README.md) (by topic and by STEP) |
| Final handover assessment | [forward/reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md](forward/reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md) |
| Installation and runbook | [forward/handover/INSTALLATION-AND-RUNBOOK.md](forward/handover/INSTALLATION-AND-RUNBOOK.md) |

## Installation and restrictions

| Environment | Contains | Can run |
|---|---|---|
| **Pure Git checkout** | committed code, reports, reverse artifacts, dashboard | forward build, doctor, agent sync check, policy tests, Java runtime tests, dashboard, the synthetic demonstration, CI |
| **Developer environment** | the checkout plus the authorized COBOL source root, local run records (`forward/runs/`), generated Java (`forward/generated/`), BMad staging and executor | the full forward test suite, `pilot integrate` / `validate` / `readiness`, the source-integrity audit |
| **Fully authorized modernization environment** | the above plus DB2, CICS, platform services, a legacy COBOL runtime, signed authorizations and isolated BMad infrastructure | governed BMad runs, gates G1 and G2 with real signers, the automated build, test and review steps, equivalence testing. **This environment does not exist yet.** |

**Not in Git:**
- the restricted COBOL source (`references/`, see `THIRD_PARTY_NOTICES.md`);
- generated Java;
- workflow run records;
- credentials (`.mcp.json`; a template is in `.mcp.json.example`).

**Requirements:**
- *Reverse engineering:* [Claude Code](https://claude.com/claude-code), a Neo4j instance and the Neo4j Cypher MCP server (`mcp-neo4j-cypher`). See [reverse/README.md](reverse/README.md#running-the-pipeline).
- *Forward engineering:* Node.js 20 or later, JDK 21 (`REVFORGE_JAVA_HOME`) and Python 3. Build and test with `cd forward && npm ci && npm run build && npm test`. The full suite needs the developer environment.

**CI.** [`.github/workflows/revforge-ci.yml`](.github/workflows/revforge-ci.yml) runs four jobs:
- forward;
- dashboard;
- the synthetic demonstration;
- repository and report integrity.

All of them work on a pure checkout. Source-dependent checks are reported as not run, never as passed.

## Project status

| Classification | Meaning |
|---|---|
| **Engineering handover complete** | documentation, reports, dashboard, provenance and supported reproducibility checks are complete |
| **Conditional engineering closure** | 569 gaps, external dependencies (DB2, CICS, platform), 108 business decisions and the BMad prerequisites remain |
| **Not production-ready** | no production replacement criteria exist; 39 programs are partial and 1 is missing |
| **Legacy COBOL equivalence not established** | no legacy COBOL execution has been compared with the Java |

| Measure | Value |
|---|---|
| COBOL programs | 42: **41 with Java** (historical local conversions, not BMad-governed); 2 COMPLETE under harness criteria; 39 PARTIAL; 1 MISSING |
| Business rules | 154: **67 Java-verified** by source-derived tests; 15 verified up to a downstream gap; 40 unreachable; 32 blocked |
| Open gap records | **569**, all OPEN, in 23 root-cause groups and 5 remediation phases |
| COBOL-equivalent programs or rules | **0** |

*COMPLETE*, *compiles* and *passes source-derived tests* do not mean equivalent to the legacy COBOL program.

## Recent changes

| Pull request | Change |
|---|---|
| [#4](https://github.com/vighnasreevara/REVFORGE-Harness/pull/4) | Only two human gates remain. The former G0/G1 became automated pre-checks, G4 became automated story validation, and the former G5–G8 became result checks: tests must pass and the F7 review must recommend acceptance. Also added: the client dashboard prototype and the dashboard layout rules. |
| [#5](https://github.com/vighnasreevara/REVFORGE-Harness/pull/5) | The two gates are numbered G1 and G2 everywhere; older records keep working. |
| [#6](https://github.com/vighnasreevara/REVFORGE-Harness/pull/6) | The verified provider-egress component for LIVE BMad runs, with its self-test. |
| [#7](https://github.com/vighnasreevara/REVFORGE-Harness/pull/7) | Client dashboard: the BMad tab and the synthetic MOCK run. |
| [#8](https://github.com/vighnasreevara/REVFORGE-Harness/pull/8) | README updates: dashboards, BMad, the path to the real project, and this history. |

## License

- **This project:** MIT License, © 2026 Vighnasree Vara (see `LICENSE`).
- **Third-party portions:** the reverse agent and skill definitions (`reverse/agents/`, `reverse/skills/` and the copies generated from them in `.claude/`) are derived from an Apache-2.0-licensed project and keep that license. See `THIRD_PARTY_NOTICES.md` and `licenses/APACHE-2.0-upstream-harness.txt`.
