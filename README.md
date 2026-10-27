# REVFORGE Harness

**COBOL reverse engineering with permanent, graph-backed source identity.**

Author: **Vighnasree Vara**

REVFORGE turns a legacy COBOL codebase into a traceable Business Requirements Document (BRD). A pipeline of seven Claude Code agents does the work. They pass JSON artifacts from one to the next, and a Neo4j registry gives every source element a **permanent ID**: every system, file, path, section, paragraph, statement, record and field. Every rule, gap, diagram and BRD statement can therefore be traced back to the exact COBOL line it came from.

---

## Pipeline

| # | Agent | Skills | Produces |
|---|---|---|---|
| 1 | `1_inventory_c` | file-walker, dependency-graph | `output/inventory/inventory_artifact.json`. Registers System, File and Path IDs in Neo4j. |
| 2 | `2_parser_c` | cobol-ast-parser, section-mapper | `output/parser/`. Registers Section, Paragraph and Statement IDs and the control-flow edges. |
| 3 | `3_data_c` | record-layout-parser, data-dictionary-builder | `output/data/`. Registers Record and Field IDs, copybook expansion and REDEFINES. |
| 4 | `4_logic_c` | control-flow-tracer, pseudocode-generator | `output/logic/`. Execution traces, branches, loops and pseudocode. Reuses IDs (read-only). |
| 5 | `5_rules_c` | condition-classifier, rule-tagger | `output/rules/`. 143 classified business rules with confidence and SME flags. |
| 6 | `6_diagram_c` | component-mapper, sequence-builder | `output/diagram/`. 60 Mermaid diagrams plus a source-ID index. |
| 7 | `7_synthesis_c` | gap-detector, section-assembler | `output/final_report/`. Gaps register and BRD. |

The agent definitions are in `.claude/agents/` and the skills in `.claude/skills/`.

### REVFORGE enhancements

- **Permanent source IDs.** Agents 1–3 register stable IDs in Neo4j (for example `SYS-PORTFOLIO-001-FIL-0072-STMT-000025`). Agents 4–7 only *reuse* them, and verify them with read-only queries before writing their outputs.
- **Evidence classes.** Every rule and diagram edge is labelled *confirmed*, *inferred* or *uncertain*. Unresolvable paths, runtime-only CICS `HANDLE CONDITION` transfers and recursion are never presented as confirmed flow.
- **No invented behaviour.** Missing paragraphs, copybooks and external programs become documented gaps, never guessed logic.
- **JSON communication.** Agents exchange JSON artifacts. Neo4j is used only for identity.

---

## Results on the sample portfolio system

| Measure | Value |
|---|---|
| Programs / copybooks / JCL jobs | 42 / 25 / 15 |
| Records / fields / 88-level conditions | 231 / 1,009 / 259 |
| Business rules | 143: 45 confirmed, 17 inferred, 81 uncertain |
| Gaps | 322: 6 critical, 154 high, 79 medium, 83 low |
| Mermaid diagrams | 60 (structural lint passed; visual rendering still to be verified) |
| Permanent IDs cited in the BRD | 2,822, all verified against Neo4j |

Acceptance status (`docs/revforge_reverse_engineering_acceptance.md`):
- Reverse engineering is **complete**.
- Full forward engineering is **not ready**.
- A **limited pilot** (PORTADD + PORTREAD) is conditionally ready.

---

## Repository layout

```
.claude/agents/        Agent definitions (1–7)
.claude/skills/        Skill definitions used by the agents
output/                Generated artifacts (inventory, parser, data, logic, rules, diagram, final_report)
docs/                  Design notes, audits and acceptance review
licenses/              Third-party license texts
LICENSE                MIT License (this project)
THIRD_PARTY_NOTICES.md Attribution for derived files
.mcp.json.example      Template for the Neo4j MCP server configuration
```

Key deliverables:
- `output/final_report/brd.md`: the full Business Requirements Document.
- `output/final_report/brd_summary.md`: the executive summary.
- `output/final_report/gaps_register.md` / `.json`: the gaps and assumptions register.
- `output/diagram/diagrams/*.mmd`: the component, ERD, sequence and process-flow diagrams.

---

## Running the pipeline

1. **Requirements:**
   - [Claude Code](https://claude.com/claude-code);
   - a Neo4j instance (Aura or self-hosted);
   - the Neo4j Cypher MCP server (`mcp-neo4j-cypher`).
2. **Configure Neo4j:** copy `.mcp.json.example` to `.mcp.json` and fill in your connection details. `.mcp.json` is git-ignored, so never commit credentials.
3. **Provide a COBOL codebase:** point the inventory agent at its root. The sample codebase is not included in this repository; see `THIRD_PARTY_NOTICES.md`.
4. **Run the agents in order** from Claude Code (`1_inventory_c` → `7_synthesis_c`). Each agent's inputs and outputs are described in its `.agent.md` file.

---

## License

- **This project:** MIT License, © 2026 Vighnasree Vara (see `LICENSE`).
- **Third-party portions:** some agent and skill definitions are derived from an Apache-2.0-licensed project and keep that license. See `THIRD_PARTY_NOTICES.md` and `licenses/APACHE-2.0-upstream-harness.txt`.
