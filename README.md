# REVFORGE — Evidence-Governed COBOL-to-Java Modernization Harness

Author: **Vighnasree Vara**

REVFORGE modernizes a legacy COBOL application under strict evidence rules: every claim is traceable to a source line, every unknown becomes a recorded gap, and nothing is presented as verified unless a recorded result supports it.

```
COBOL source → Reverse Engineering → Business Requirements Document → permanent source identities
  → Forward Engineering → Java 21 implementation → independent verification
  → gap reconciliation → dashboard and handover
```

**Current status.** The engineering handover is complete; the modernization is not. The Java replacement is incomplete: 41 of 42 programs have Java, 2 are complete under the harness criteria, and 569 gap records are open. **Legacy COBOL-to-Java behavioural equivalence has not been established.** See [Project status](#project-status).

---

## Reverse engineering

A pipeline of seven Claude Code agents reads the COBOL codebase and produces a traceable Business Requirements Document (BRD).
- **JSON artifacts.** The agents pass JSON artifacts from one to the next.
- **Permanent IDs.** A Neo4j registry gives every source element a permanent ID: system, file, path, section, paragraph, statement, record and field. Every rule, gap, diagram and BRD statement can therefore be traced back to the exact COBOL line it came from.

| # | Agent | Skills | Produces |
|---|---|---|---|
| 1 | `1_inventory_c` | file-walker, dependency-graph | `output/inventory/inventory_artifact.json`. Registers System, File and Path IDs in Neo4j. |
| 2 | `2_parser_c` | cobol-ast-parser, section-mapper | `output/parser/`. Registers Section, Paragraph and Statement IDs and the control-flow edges. |
| 3 | `3_data_c` | record-layout-parser, data-dictionary-builder | `output/data/`. Registers Record and Field IDs, copybook expansion and REDEFINES. |
| 4 | `4_logic_c` | control-flow-tracer, pseudocode-generator | `output/logic/`. Execution traces, branches, loops and pseudocode. Reuses IDs (read-only). |
| 5 | `5_rules_c` | condition-classifier, rule-tagger | `output/rules/`. 154 classified business rules with confidence and SME flags. |
| 6 | `6_diagram_c` | component-mapper, sequence-builder | `output/diagram/`. 65 Mermaid diagrams plus a source-ID index. |
| 7 | `7_synthesis_c` | gap-detector, section-assembler | `output/final_report/`. Gaps register and BRD. |

The reverse-engineering agent definitions are in `.claude/agents/` and their skills in `.claude/skills/`.

**Principles:**
- **Permanent source IDs.** Agents 1–3 register stable IDs in Neo4j, for example `SYS-PORTFOLIO-001-FIL-0072-STMT-000025`. Agents 4–7 only *reuse* them, and verify them with read-only queries before writing their outputs.
- **Evidence classes.** Every rule and diagram edge is labelled *confirmed*, *inferred* or *uncertain*. Unresolvable paths, runtime-only CICS `HANDLE CONDITION` transfers and recursion are never presented as confirmed flow.
- **No invented behaviour.** Missing paragraphs, copybooks and external programs become documented gaps, never guessed logic.
- **JSON communication.** Agents exchange JSON artifacts. Neo4j is used only for identity.

**Results on the sample portfolio system:**

| Measure | Value |
|---|---|
| Programs / copybooks / JCL jobs | 42 / 25 / 15 |
| Records / fields / 88-level conditions | 231 / 1,009 / 259 |
| Paragraphs / statements | 402 / 1,936 |
| Business rules | 154: 36 confirmed, 25 high, 79 medium, 14 low confidence; 50 flagged for SME review |
| Historical reverse gaps | 217: 6 critical, 86 high, 50 medium, 75 low |
| Mermaid diagrams | 65: 15 component, 3 ERD, 2 sequence, 45 process flow |
| Permanent IDs verified against Neo4j | 873 cited in the BRD; 1,568 in the diagram index; none invalid |

Key deliverables:
- `output/final_report/brd.md` and `brd_summary.md`: the BRD and its executive summary.
- `output/final_report/gaps_register.md` / `.json`: the reverse gaps register.
- `output/diagram/diagrams/*.mmd`: the diagrams.

## Forward engineering

The forward harness (`forward/`) turns the reverse artifacts into a governed modernization. A TypeScript runtime is the single deterministic controller. It manages:
- JSON Schema contracts (Ajv);
- workflow state transitions;
- engineering gates G0–G8;
- signed approvals;
- agent dispatch packets and receipts.

Agents produce deliverables, but no agent output can pass a gate or approve anything.

| Agent | Role | Gate |
|---|---|---|
| F1 Requirements Analyst | source-grounded requirements and the decision register | G2 |
| F2 Data Mapping Specialist | copybook layout contracts and COBOL file semantics | G2 |
| F3 Java Architect | Java architecture spine and legacy-compatibility ADRs | G3 |
| F4 Development Planner | evidence-backed stories and sprint readiness | G4 |
| F5 Java Developer | implementation inside the authorised Java target only | G5 |
| F6 Independent Tester | independent fixtures and legacy-equivalence testing | G6 |
| F7 Independent Reviewer | adversarial review and end-to-end trace audit | G7 |

The agent definitions are in `forward/agents/` and the 14 skills in `forward/skills/` (`sync-agents` copies both into `.claude/`).

Alongside the workflow, a local converter (`forward/runtime/src/pilot/`) and a hand-written Java 21 runtime library (`forward/runtime/java/`) produced Java for 41 programs. This was done under historical, program-scoped local authorizations. Generated Java is git-ignored and stays local.

### BMad governance

The BMad Method 6.12.4 is **mandatory** for new governed forward development:
- Six workflows are bound to the forward agents: PRD, Architecture, Epics and Stories, Sprint Planning, Build, Code Review.
- F2 and F6 stay independent of BMad, but their evidence is required.

Current status: **BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.**
- **What is configured:** all six workflows; enforcement is tested.
- **What has executed:** nothing. No workflow is authorized, none has executed live, and no receipt exists.
- **What blocks it:** missing approvals, a signed disclosure authorization, isolation and network infrastructure, and live-execution and generation authorization.
- **Historical local Java:** it is *not* retroactively BMad-compliant. It stays classified `LOCAL_LGA_NOT_BMAD_GOVERNED`.

See [BMAD-GOVERNANCE.md](forward/handover/BMAD-GOVERNANCE.md).

### Java modernization coverage

| Measure | Value |
|---|---|
| COBOL programs | 42: **41 with Java**; 2 COMPLETE under harness criteria (PORTREAD, PROGNAME); 39 PARTIAL; 1 MISSING (POSUPDT, empty source) |
| Business rules | 154: **67 Java-verified** by source-derived tests; 15 verified up to a downstream gap; 40 unreachable; 32 blocked |
| Open gap records | **569**, all OPEN, in 23 root-cause groups and 5 remediation phases |
| COBOL-equivalent programs or rules | **0** |

*COMPLETE*, *compiles* and *passes source-derived tests* do not mean equivalent to the legacy COBOL program. That needs a run of the legacy system on the same inputs, and none is available.

## Dashboard

`forward/dashboard/` is the read-only **REVFORGE Modernization Command Center** (React, TypeScript, Vite). Its 12 sections:
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
- The dashboard loads a file only when its SHA-256 matches the manifest, and every total is recounted and cross-checked.
- Missing, altered or unverifiable evidence is shown as *unavailable*; it is never loaded or replaced.

**What the hash check proves.** The manifest is produced locally from the Git checkout. The browser check therefore proves the served copies are consistent with that manifest. It does not authenticate the repository or a deployment, which would need a separate trust mechanism such as signed releases.

## Documentation

| Topic | Document |
|---|---|
| Architecture (8 diagrams) | [forward/handover/ARCHITECTURE.md](forward/handover/ARCHITECTURE.md) |
| Forward engineering | [forward/handover/FORWARD-ENGINEERING.md](forward/handover/FORWARD-ENGINEERING.md) |
| BMad governance | [forward/handover/BMAD-GOVERNANCE.md](forward/handover/BMAD-GOVERNANCE.md) |
| Testing and verification | [forward/handover/TESTING-AND-VERIFICATION.md](forward/handover/TESTING-AND-VERIFICATION.md) |
| Known limitations | [forward/handover/KNOWN-LIMITATIONS.md](forward/handover/KNOWN-LIMITATIONS.md) |
| Final reconciliation | [forward/reports/STEP-22-FINAL-RECONCILIATION.md](forward/reports/STEP-22-FINAL-RECONCILIATION.md) |
| Master gap register | [forward/reports/STEP-23-MASTER-GAP-REGISTER.md](forward/reports/STEP-23-MASTER-GAP-REGISTER.md) |
| Dashboard assessment | [forward/reports/STEP-24-DASHBOARD-ASSESSMENT.md](forward/reports/STEP-24-DASHBOARD-ASSESSMENT.md) |
| Final handover assessment | [forward/reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md](forward/reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md) |
| Installation and runbook | [forward/handover/INSTALLATION-AND-RUNBOOK.md](forward/handover/INSTALLATION-AND-RUNBOOK.md) |

## Installation and restrictions

| Environment | Contains | Can run |
|---|---|---|
| **Pure Git checkout** | committed code, reports, reverse artifacts, dashboard | forward build, doctor, policy and backup tests, Java runtime library tests, dashboard (install, build, tests, smoke), CI |
| **Developer environment** | the checkout plus the authorized COBOL source root, local run records (`forward/runs/`), generated Java (`forward/generated/`), BMad staging and executor | the full forward test suite, `pilot integrate` / `validate` / `readiness`, source-integrity audit |
| **Fully authorized modernization environment** | the above plus DB2, CICS, platform services, a legacy COBOL runtime, signed authorizations and isolated BMad infrastructure | governed BMad runs, gates G2–G8, equivalence testing. **This environment does not exist yet.** |

**Not in Git:**
- the restricted COBOL source (`references/`, see `THIRD_PARTY_NOTICES.md`);
- generated Java;
- workflow run records;
- credentials (`.mcp.json`; a template is in `.mcp.json.example`).

**Reverse-engineering requirements:**
- [Claude Code](https://claude.com/claude-code);
- a Neo4j instance (Aura or self-hosted);
- the Neo4j Cypher MCP server (`mcp-neo4j-cypher`).

To run it, copy `.mcp.json.example` to `.mcp.json` with your connection details, point the inventory agent at the COBOL root, and run `1_inventory_c` to `7_synthesis_c` in order.

**Forward requirements:** Node.js 20 or later, JDK 21 (`REVFORGE_JAVA_HOME`) and Python 3. To build and test:

```bash
cd forward && npm ci && npm run build && npm test
```

The full test suite needs the developer environment; see the runbook.

**CI.** `.github/workflows/revforge-ci.yml` runs the checks that work on a pure checkout. Source-dependent checks are not run in CI, by design.

## Project status

| Classification | Meaning |
|---|---|
| **Engineering handover complete** | documentation, reports, dashboard, provenance and supported reproducibility checks are complete |
| **Conditional engineering closure** | 569 gaps, external dependencies (DB2, CICS, platform), 108 business decisions and the BMad prerequisites remain |
| **Not production-ready** | no production replacement criteria exist; 39 programs are partial and 1 is missing |
| **Legacy COBOL equivalence not established** | no legacy COBOL execution has been compared with the Java |

## Repository layout

```
.claude/agents/        Reverse-engineering agents (1–7), plus synced copies of the forward agents
.claude/skills/        Reverse-engineering skills, plus synced copies of the forward skills
output/                Reverse artifacts (inventory, parser, data, logic, rules, diagram, final_report)
forward/               Forward harness: runtime, contracts, agents F1–F7, skills, tools, tests, reports
forward/dashboard/     Read-only modernization dashboard
forward/handover/      Final handover package
docs/                  Design notes for the permanent-ID enhancements (Agents 1–3)
licenses/              Third-party license texts
LICENSE                MIT License (this project)
THIRD_PARTY_NOTICES.md Attribution for derived files
.mcp.json.example      Template for the Neo4j MCP server configuration
```

## License

- **This project:** MIT License, © 2026 Vighnasree Vara (see `LICENSE`).
- **Third-party portions:** some agent and skill definitions are derived from an Apache-2.0-licensed project and keep that license. See `THIRD_PARTY_NOTICES.md` and `licenses/APACHE-2.0-upstream-harness.txt`.
