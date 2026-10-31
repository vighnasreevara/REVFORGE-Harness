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
| 5 | `5_rules_c` | condition-classifier, rule-tagger | `output/rules/`. 154 classified business rules with confidence and SME flags. |
| 6 | `6_diagram_c` | component-mapper, sequence-builder | `output/diagram/`. 65 Mermaid diagrams plus a source-ID index. |
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
| Paragraphs / statements | 402 / 1,936 |
| Business rules | 154: 36 confirmed, 25 high, 79 medium, 14 low confidence; 50 flagged for SME review |
| Gaps | 217: 6 critical, 86 high, 50 medium, 75 low |
| Mermaid diagrams | 65: 15 component, 3 ERD, 2 sequence, 45 process flow (structural check passed; visual rendering still to be verified) |
| Permanent IDs verified against Neo4j | 873 cited in the BRD; 1,568 in the diagram index; none invalid |

These results come from a full clean run of all seven agents on Claude Opus 5.5 (October 2026). Every permanent ID was reused, and the Neo4j registry holds 4,957 nodes and 5,929 relationships.

Reverse engineering is complete. The 6 critical gaps in `output/final_report/gaps_register.md` (for example the empty POSUPDT source and missing copybooks) must be resolved by a subject-matter expert before any forward engineering.

---

## Repository layout

```
.claude/agents/        Agent definitions (1–7)
.claude/skills/        Skill definitions used by the agents
output/                Generated artifacts (inventory, parser, data, logic, rules, diagram, final_report)
docs/                  Design notes for the permanent-ID enhancements (Agents 1–3)
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
