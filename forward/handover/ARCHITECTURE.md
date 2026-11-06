# REVFORGE architecture

This document describes the system as it is implemented in the repository at the handover baseline. Every component named here exists in the repository. Where something is designed but not operational, for example a live BMad run, the text says so.

Contents:
1. [End-to-end architecture](#1-end-to-end-architecture)
2. [Reverse engineering agent flow](#2-reverse-engineering-agent-flow)
3. [Forward engineering F1–F7 flow](#3-forward-engineering-f1f7-flow)
4. [BMad lifecycle integration](#4-bmad-lifecycle-integration)
5. [Source provenance and permanent IDs](#5-source-provenance-and-permanent-ids)
6. [Verification and approval gates](#6-verification-and-approval-gates)
7. [Dashboard evidence pipeline](#7-dashboard-evidence-pipeline)
8. [Final handover flow](#8-final-handover-flow)
9. [Technology stack](#9-technology-stack)
10. [Synthetic end-to-end gate demonstration](#10-synthetic-end-to-end-gate-demonstration)

---

## 1. End-to-end architecture

```mermaid
flowchart LR
  SRC["Original COBOL source<br/>(restricted checkout, references/)"]
  NEO[("Neo4j permanent-ID registry<br/>via Neo4j Cypher MCP")]
  subgraph REV["Reverse engineering: 7 Claude Code agents"]
    RA["1_inventory_c … 7_synthesis_c"]
  end
  OUT["output/: 11 artifacts<br/>inventory, parser, data, logic,<br/>rules, diagrams, BRD, gaps"]
  subgraph FWD["Forward engineering: forward/"]
    RT["TypeScript runtime and CLI<br/>orchestrator, governance checkpoints G0–G8, contracts"]
    FA["Agents F1–F7 (Claude Code subagents,<br/>dispatch-and-receipt)"]
    PIL["Local converter (pilot)<br/>under local generation authorizations"]
    EQG{{"Engineering quality gates<br/>SOURCE_READINESS · CONVERSION_VALIDATION"}}
    JRT["Java 21 runtime library<br/>forward/runtime/java (20 files)"]
    DEMO["Synthetic G0–G8 demonstration<br/>forward/demo/gates<br/>SYNTHETIC_INTERVIEW_DEMO"]
  end
  GEN["forward/generated/java<br/>(git-ignored, local only)"]
  BMAD["BMad Method 6.12.4<br/>mandatory governance:<br/>LIVE EXECUTION BLOCKED"]
  REP["Reports STEP-17 to STEP-25<br/>reconciliation, master gap register"]
  DASH["Dashboard forward/dashboard<br/>(read-only)"]
  HO["Handover package forward/handover"]

  SRC --> RA
  RA <--> NEO
  RA --> OUT
  OUT --> RT
  RT --> FA
  RT --> PIL
  PIL --> EQG
  EQG --> GEN
  JRT --> GEN
  RT -. "synthetic inputs only" .-> DEMO
  RT -. "governed runs, preflights" .-> BMAD
  GEN --> REP
  OUT --> REP
  REP --> DASH
  REP --> HO
  DASH --> HO
```

The arrow from the runtime to BMad is dotted because no BMad workflow has executed. The runtime records governed runs and preflights, all of which stopped as `BMAD_BLOCKED` before launch.

Two separate families of gates appear here (see [section 6](#6-verification-and-approval-gates)):
- **Engineering quality gates.** `SOURCE_READINESS` and `CONVERSION_VALIDATION` judge each local conversion.
- **Governance checkpoints.** G0–G8 govern the workflow.

The synthetic demonstration (dotted, [section 10](#10-synthetic-end-to-end-gate-demonstration)) exercises G0–G8 on synthetic inputs only, and writes nothing into the real workflow.

---

## 2. Reverse engineering agent flow

```mermaid
flowchart TD
  SRC["COBOL codebase<br/>42 programs, 25 copybooks, 15 JCL jobs"]
  A1["1_inventory_c<br/>file-walker, dependency-graph"]
  A2["2_parser_c<br/>cobol-ast-parser, section-mapper"]
  A3["3_data_c<br/>record-layout-parser, data-dictionary-builder"]
  A4["4_logic_c<br/>control-flow-tracer, pseudocode-generator"]
  A5["5_rules_c<br/>condition-classifier, rule-tagger"]
  A6["6_diagram_c<br/>component-mapper, sequence-builder"]
  A7["7_synthesis_c<br/>gap-detector, section-assembler"]
  NEO[("Neo4j registry")]
  O1["output/inventory"]
  O2["output/parser"]
  O3["output/data"]
  O4["output/logic"]
  O5["output/rules: 154 rules"]
  O6["output/diagram: 65 Mermaid diagrams"]
  O7["output/final_report: BRD, 217 gaps"]

  SRC --> A1 --> A2 --> A3 --> A4 --> A5 --> A6 --> A7
  A1 -- "writes System, File, Path IDs" --> NEO
  A2 -- "writes Section, Paragraph, Statement IDs" --> NEO
  A3 -- "writes Record, Field IDs" --> NEO
  A4 -. "read-only verification" .-> NEO
  A5 -. "read-only verification" .-> NEO
  A6 -. "read-only verification" .-> NEO
  A7 -. "read-only verification" .-> NEO
  A1 --> O1
  A2 --> O2
  A3 --> O3
  A4 --> O4
  A5 --> O5
  A6 --> O6
  A7 --> O7
```

Agents pass JSON artifacts to each other. Neo4j is used only for identity: Agents 1–3 register permanent IDs, and Agents 4–7 reuse them and verify them read-only. The agent definitions are in `.claude/agents/1_inventory_c.agent.md` … `7_synthesis_c.agent.md` and their skills in `.claude/skills/`.

---

## 3. Forward engineering F1–F7 flow

```mermaid
flowchart TD
  IN["Reverse artifacts output/<br/>+ baseline manifest (SHA-256)"]
  G0{"G0 Baseline integrity"}
  G1{"G1 Evidence verification"}
  F1["F1 fe-requirements-analyst<br/>requirements + decision register"]
  F2["F2 fe-data-mapping-specialist<br/>data contracts, file semantics"]
  G2{"G2 Approved requirements<br/>signed human approval"}
  F3["F3 fe-java-architect<br/>architecture spine, ADRs"]
  G3{"G3 Approved architecture"}
  F4["F4 fe-development-planner<br/>stories, sprint readiness"]
  G4{"G4 Approved stories"}
  F5["F5 fe-java-developer<br/>implementation (needs generation authorization)"]
  G5{"G5 Java build and tests"}
  F6["F6 fe-independent-tester<br/>fixtures, legacy equivalence"]
  G6{"G6 Independent behavioural verification"}
  F7["F7 fe-independent-reviewer<br/>adversarial review, trace audit"]
  G7{"G7 Independent review"}
  G8{"G8 Human acceptance"}

  IN --> G0 --> G1
  G1 --> F1
  G1 --> F2
  F1 --> G2
  F2 --> G2
  G2 --> F3 --> G3 --> F4 --> G4 --> F5 --> G5 --> F6 --> G6 --> F7 --> G7 --> G8
```

Each agent runs as a Claude Code subagent on a dispatch packet prepared by the runtime (`workflow prepare` / `workflow batches`). It writes its deliverables and a `receipt.json`, which the operator records with `workflow record`. The runtime validates every output against its JSON Schema contract and decides gates and state transitions; no agent output can pass a gate.

**Recorded state:** G0 and G1 pass; G2 is `UNVERIFIED` (not approved; 417 blocking findings for PORTREAD); G3–G8 are `BLOCKED`. The 41 existing Java programs come from the local converter under historical local generation authorizations (`LGA-*`). They are classified `LOCAL_LGA_NOT_BMAD_GOVERNED` and did not pass through G2–G8.

---

## 4. BMad lifecycle integration

```mermaid
flowchart LR
  subgraph LIFE["Governed lifecycle for one exact scope"]
    PRD["1 BMAD-PRD<br/>bmad-prd · F1"]
    ARCH["2 BMAD-ARCH<br/>bmad-architecture · F3"]
    EPI["3 BMAD-EPICS<br/>bmad-create-epics-and-stories · F4"]
    SPR["4 BMAD-SPRINT<br/>bmad-sprint-planning · F4"]
    BLD["5 BMAD-BUILD<br/>bmad-build · F5"]
    REV["6 BMAD-REVIEW<br/>bmad-code-review · F7"]
    PRD --> ARCH --> EPI --> SPR --> BLD --> REV
  end
  F2["F2 data mapping<br/>(independent of BMad)"]
  F6["F6 independent testing<br/>(independent of BMad)"]
  PF{"Preflight BPF<br/>G2 scope, workflow state,<br/>signed disclosure, isolation,<br/>runner, egress, limits"}
  REC["Verified LIVE receipt<br/>per stage"]
  GR["Governed run BGR<br/>BMAD_COMPLIANT only if every<br/>stage has a verified receipt"]

  PF -->|"permitted (never so far)"| PRD
  F2 -->|"accepted delivery required"| GR
  F6 -->|"accepted receipt required"| GR
  LIFE --> REC --> GR
```

Bindings are in `forward/integrations/bmad/bindings.json`, and the release pin in `release.pin.json`. **Recorded state:** 4 governed runs and 13 preflights, none permitted; BGR-0004 for `programs:PORTREAD` is `BMAD_BLOCKED` at BMAD-PRD, and the other five stages were not attempted. There are 0 receipts. F2 is `ACCEPTED`; F6 is `MISSING`.

---

## 5. Source provenance and permanent IDs

```mermaid
flowchart LR
  LINE["COBOL line<br/>src/programs/portfolio/PORTREAD.cbl"]
  FILE["File ID<br/>SYS-PORTFOLIO-001-FIL-0070"]
  PAR["Paragraph ID<br/>…-FIL-0070-PAR-nnnn"]
  STMT["Statement ID<br/>…-FIL-0070-STMT-nnnnnn"]
  FLD["Record / Field IDs<br/>…-REC-nnnn / …-FLD-nnnnnn"]
  RULE["Business rule BR-nnn<br/>output/rules"]
  REQ["Requirement / data contract<br/>F1, F2 deliverables"]
  JAVA["Java class and method<br/>forward/generated/java"]
  TEST["Source-derived scenario<br/>forward/pilot/app-fixtures"]
  GAP["Gap record MGR-nnnn<br/>STEP-23 register"]
  REC["Reconciliation<br/>STEP-22 statement, paragraph,<br/>rule, field reconciliations"]

  LINE --> FILE --> PAR --> STMT
  FILE --> FLD
  STMT --> RULE
  FLD --> RULE
  RULE --> REQ --> JAVA --> TEST
  STMT --> REC
  JAVA --> REC
  TEST --> REC
  STMT --> GAP
  RULE --> GAP
```

Permanent IDs are created once by reverse Agents 1–3 and never repaired or re-created. `BR-`, `GAP-` and `MGR-` IDs are catalogue IDs bound to the recorded artifact hashes.

---

## 6. Verification and approval gates

REVFORGE has two distinct kinds of gates:

| Kind | Gates | Question | Authorizes generation? |
|---|---|---|---|
| **Engineering quality gates** | `SOURCE_READINESS`, `CONVERSION_VALIDATION` (`runtime/src/pilot/gates.ts`) | Is this program's source understood well enough to convert? Is this conversion output verified as labelled? | No |
| **Governance checkpoints** | G0–G8 (`runtime/src/orchestrator/gates.ts`, approval and design modules) | Has the governed workflow reached each stage with verified evidence and signed human approvals? | Only G4 PASS, together with the configuration flag and BMad stages up to sprint |

### 6.1 Engineering quality gates

- **SOURCE_READINESS** (`pilot readiness`): 6 of 42 programs pass.
- **CONVERSION_VALIDATION** (`pilot validate`): 41 of 42 programs pass.

Neither authorizes generation, and neither is equivalence.

### 6.2 Governance checkpoints G0–G8 (real workflow status)

```mermaid
flowchart TD
  G0["G0 Baseline integrity · implemented · PASS"]
  G1["G1 Evidence verification · implemented · PASS"]
  G2["G2 Approved requirements · signed human approval · UNVERIFIED"]
  G3["G3 Approved architecture · signed approval · BLOCKED"]
  G4["G4 Approved stories · signed approval · BLOCKED"]
  G5["G5 Java build and tests · fail-closed · BLOCKED"]
  G6["G6 Independent behavioural verification · fail-closed · BLOCKED"]
  G7["G7 Independent review · fail-closed · BLOCKED"]
  G8["G8 Human acceptance · fail-closed · BLOCKED"]
  GEN{"Java generation through the workflow<br/>needs generation.java_generation_allowed<br/>AND G4 PASS AND BMad stages to sprint"}
  G0 --> G1 --> G2 --> G3 --> G4 --> G5 --> G6 --> G7 --> G8
  G4 --> GEN
```

Signed approvals use Ed25519 and are verified against a configured trust store (`REVFORGE_APPROVAL_TRUST_STORE`), which is not configured in this environment. A synthetic run of all nine checkpoints is described in [section 10](#10-synthetic-end-to-end-gate-demonstration); it does not change any status above.

---

## 7. Dashboard evidence pipeline

```mermaid
flowchart LR
  REG["evidence-sources.json<br/>30 files + 2 collections"]
  GIT[("Git HEAD<br/>committed reports")]
  SYNC["scripts/sync-evidence.mjs<br/>copy committed files only"]
  PUB["public/evidence/<br/>137 copies + manifest.json<br/>(SHA-256, git blob, last commit)"]
  LOAD["src/evidence/loader.ts<br/>fetch + SHA-256 check"]
  MODEL["src/evidence/model.ts<br/>recount + 114 cross-checks"]
  PAGES["12 read-only pages"]
  REP["scripts/evidence-report.ts<br/>forward/reports/step-24"]

  REG --> SYNC
  GIT --> SYNC --> PUB --> LOAD --> MODEL --> PAGES
  MODEL --> REP
```

Missing, malformed or altered evidence becomes an *evidence unavailable* state. It is never replaced by zero or by sample data.

---

## 8. Final handover flow

```mermaid
flowchart TD
  S22["STEP-22 final reconciliation"]
  S23["STEP-23 master gap register<br/>569 OPEN records"]
  S24["STEP-24 dashboard"]
  AUD["STEP-25 audit<br/>tools/step25-final.py"]
  REG["STEP-25 regression<br/>forward + dashboard"]
  BK["Backup policy 2<br/>tools/backup.js"]
  DOCS["forward/handover/<br/>13 documents"]
  MAN["HANDOVER-MANIFEST.json<br/>SHA-256 of every referenced file"]
  ASM["STEP-25 assessment<br/>CONDITIONAL_ENGINEERING_CLOSURE"]
  NEXT["Owner actions:<br/>source, environments, decisions,<br/>authorizations, equivalence evidence"]

  S22 --> AUD
  S23 --> AUD
  S24 --> REG
  BK --> REG
  AUD --> MAN
  REG --> MAN
  DOCS --> MAN
  MAN --> ASM --> NEXT
```

---

## 9. Technology stack

The table lists only technologies that are in use, and only the roles the repository evidence shows.

| Technology | Role in REVFORGE | Where |
|---|---|---|
| Claude Code | Runs the 7 reverse agents and the F1–F7 forward subagents (agent and skill definitions in `.claude/`). It would also host BMad workflows, but that is not authorized. | `.claude/agents`, `.claude/skills`, `forward/agents`, `forward/skills` |
| Neo4j + Neo4j Cypher MCP server | Permanent-ID registry for the reverse run (4,957 nodes and 5,929 relationships in the recorded run). The forward runtime never contacts Neo4j. | `.mcp.json.example` (credentials stay in the git-ignored `.mcp.json`) |
| TypeScript 5.6 / Node.js 20+ | Forward runtime, CLI, orchestrator, gates, converter, verification, BMad governance | `forward/runtime/src`, `forward/verification/src` |
| JSON Schema + Ajv 8 | Contracts for every input, deliverable, receipt and record | `forward/contracts` |
| COBOL structural analysis | Reverse parsing by the agent skills (`cobol-ast-parser`, `section-mapper`) and a deterministic COBOL reader and converter in the runtime (`runtime/src/pilot/cobol-app.ts`, `verification/src/cobol-source.ts`) | as named |
| Java 21 | Target language. Hand-written runtime library with COBOL data semantics, plus the runtime and integration test harness; generated programs compile with `javac -Werror` | `forward/runtime/java/revforge/cobol` |
| BMad Method 6.12.4 | Mandatory governance model for new governed forward development: 6 bound workflows, preflights, governed runs. Staged and pinned, not installed in the repository, never executed. | `forward/integrations/bmad` |
| OpenAI API client (`openai` 7.35) | Optional independent verification (Pass A/Pass B). Never run live: network disabled, no key, no authorization. | `forward/runtime/src`, `docs/OPENAI-VERIFICATION-OPERATIONS.md` |
| Python 3 | Report and reconciliation generators (`forward/tools/*.py`) | `forward/tools` |
| React 19, TypeScript, Vite 6, Tailwind 3 | Read-only dashboard | `forward/dashboard` |
| Recharts 3 | Dashboard distribution charts (with table views) | `forward/dashboard/src/components/charts.tsx` |
| Cytoscape.js 3 | Dependency-graph neighbourhoods | `forward/dashboard/src/components/GraphCanvas.tsx` |
| Mermaid 11 | Reverse diagrams (`output/diagram/diagrams/*.mmd`), rendered in the dashboard in strict mode; also these architecture diagrams | as named |

---

## 10. Synthetic end-to-end gate demonstration

`npm run demo:gates` (in `forward/`) runs all nine governance checkpoints on one small synthetic COBOL program, `forward/demo/gates/synthetic/source/DEMOORD1.cbl`. The run is in the separate environment `SYNTHETIC_INTERVIEW_DEMO`. Every demo gate executes its checks; a gate never passes without evaluating them, and the run stops at the first gate that does not pass.

```mermaid
flowchart LR
  IN["Synthetic inputs<br/>forward/demo/gates/synthetic<br/>(baseline-hashed)"]
  subgraph DG["Demo gates (runtime/src/demo/gates.ts)"]
    D0["G0 baseline hashes"] --> D1["G1 evidence vs re-parsed COBOL"] --> D2["G2 requirements + signed demo approval"] --> D3["G3 architecture + signed demo approval"] --> D4["G4 plan + signed demo approval"] --> D5["G5 converter, javac -Werror, scenarios"] --> D6["G6 independent oracle vs Java"] --> D7["G7 independent review"] --> D8["G8 signed synthetic acceptance"]
  end
  KEY["Ephemeral Ed25519 key<br/>(memory only) and demo trust store"]
  BM["BMad bindings PRD to REVIEW<br/>SIMULATED, never counted"]
  OUT["forward/demo/gates/runs/ID<br/>results, evidence, DEMO-REPORT.md<br/>(git-ignored)"]
  IN --> D0
  KEY -.-> D2
  KEY -.-> D3
  KEY -.-> D4
  KEY -.-> D8
  DG --> BM
  DG --> OUT
```

**Reused production components:**
- the STEP-17 converter (`parseApp`, `emitApp`);
- the Java runtime library and `TestMain`;
- the canonical JSON digest;
- the Ed25519 verifier (`loadTrustStore`, `verifySignature`), pointed at a per-run demo trust store;
- the BMad receipt counter (`receiptCounts`), which refuses the SIMULATED records;
- the contract registry, with new `demo/*` contracts.

**Separate from the real workflow:**
- The demo has its own state file, run directory and trust store. It never calls the real orchestrator, and never writes a real gate result, approval, receipt or authorization.
- Its G4 is demo planning approval, never Java generation authorization: `generation.java_generation_allowed` stays `false`.
- Its G6 compares the Java with an independent oracle written from the requirements. No COBOL runtime is executed, so legacy equivalence stays `NOT_ESTABLISHED`.
- The engineering quality gates `SOURCE_READINESS` and `CONVERSION_VALIDATION` are not used or changed by the demonstration.

Negative paths are covered by `forward/tests/synthetic-gate-demonstration.test.ts`, which the CI job *Synthetic G0–G8 gate demonstration* runs. The operating notes are in `forward/demo/gates/README.md`.
