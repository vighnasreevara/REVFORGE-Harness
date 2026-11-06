# REVFORGE Reverse Engineering

A pipeline of seven Claude Code agents reads a COBOL codebase and produces a traceable **Business Requirements Document (BRD)**, a business-rule catalogue, Mermaid diagrams and a gaps register. Every element they report is tied to a **permanent source ID** held in a Neo4j registry. As a result, a rule, gap, diagram node or BRD sentence can be traced back to the exact COBOL statement it came from.

```
COBOL source ─▶ 1 inventory ─▶ 2 parser ─▶ 3 data ─▶ 4 logic ─▶ 5 rules ─▶ 6 diagram ─▶ 7 synthesis ─▶ BRD
                  │              │            │
                  └──── permanent System/File/Path, Section/Paragraph/Statement, Record/Field IDs (Neo4j via MCP)
```

The forward-engineering harness ([`../forward/`](../forward/README.md)) consumes the outputs. The reverse side never reads anything from forward.

## Contents of this folder

| Path | What it holds |
|---|---|
| [`agents/`](agents/) | The canonical definitions of the seven reverse agents (`1_inventory_c` … `7_synthesis_c`) |
| [`skills/`](skills/) | The canonical definitions of their 14 skills, two per agent |
| [`docs/`](docs/) | Design notes for the permanent-ID enhancements of Agents 1–3 |

The **artifacts the pipeline produced** are in [`../output/`](../output/), at the repository root. They were not moved; see [Why the artifacts stay in `output/`](#why-the-artifacts-stay-in-output).

## The pipeline

| # | Agent | Skills (in order) | Writes | Identity role |
|---|---|---|---|---|
| 1 | `1_inventory_c` | file-walker, dependency-graph | `output/inventory/` | registers System, File and Path IDs |
| 2 | `2_parser_c` | cobol-ast-parser, section-mapper | `output/parser/` | registers Section, Paragraph and Statement IDs and the control-flow edges |
| 3 | `3_data_c` | record-layout-parser, data-dictionary-builder | `output/data/` | registers Record and Field IDs; copybook expansion and REDEFINES |
| 4 | `4_logic_c` | control-flow-tracer, pseudocode-generator | `output/logic/` | reuses IDs, verified read-only |
| 5 | `5_rules_c` | condition-classifier, rule-tagger | `output/rules/` | reuses IDs, verified read-only |
| 6 | `6_diagram_c` | component-mapper, sequence-builder | `output/diagram/` | reuses IDs, verified read-only |
| 7 | `7_synthesis_c` | gap-detector, section-assembler | `output/final_report/` | reuses IDs, verified read-only |

The agents run in this order and pass **JSON artifacts** to each other. Neo4j is used only for identity. Agents 1–3 register IDs in it; Agents 4–7 only read from it.

**Principles:**
- **Permanent source IDs.** IDs are stable across runs, for example `SYS-PORTFOLIO-001-FIL-0072-STMT-000025`. They are never re-created or repaired downstream.
- **Evidence classes.** Every rule and diagram edge is labelled *confirmed*, *inferred* or *uncertain*. Unresolvable paths, runtime-only CICS `HANDLE CONDITION` transfers and recursion are never shown as confirmed flow.
- **No invented behaviour.** Missing paragraphs, copybooks and external programs become documented gaps, never guessed logic.

## Results on the sample portfolio system

| Measure | Value |
|---|---|
| Programs / copybooks / JCL jobs | 42 / 25 / 15 |
| Records / fields / 88-level conditions | 231 / 1,009 / 259 |
| Paragraphs / statements | 402 / 1,936 |
| Business rules | 154: 36 confirmed, 25 high, 79 medium and 14 low confidence; 50 flagged for SME review |
| Historical reverse gaps | 217: 6 critical, 86 high, 50 medium, 75 low |
| Mermaid diagrams | 65: 15 component, 3 ERD, 2 sequence, 45 process flow |
| Permanent IDs verified against Neo4j | 873 cited in the BRD and 1,568 in the diagram index; none invalid |

Key deliverables:
- [`output/final_report/brd.md`](../output/final_report/brd.md) and [`brd_summary.md`](../output/final_report/brd_summary.md): the BRD and its executive summary.
- [`output/final_report/gaps_register.md`](../output/final_report/gaps_register.md) and `.json`: the reverse gaps register.
- [`output/rules/rules_artifact.json`](../output/rules/rules_artifact.json): the 154 business rules.
- [`output/diagram/diagrams/`](../output/diagram/diagrams/): the Mermaid sources.

## Where Claude Code finds the agents: `.claude/`

Claude Code discovers agents and skills only under `.claude/agents/` and `.claude/skills/`. The repository therefore keeps a byte-identical copy of every reverse and forward definition there. **Edit only the canonical copies** (`reverse/agents`, `reverse/skills`, `forward/agents`, `forward/skills`), then reinstall and check:

```bash
cd forward && npm ci && npm run build
node dist/runtime/src/cli.js sync-agents                    # install forward/ and reverse/ definitions into .claude/
node dist/runtime/src/cli.js sync-agents --check            # report drift (exit 1 if any); CI runs this
node dist/runtime/src/cli.js sync-agents --scope reverse    # only the reverse side
```

`doctor` reports reverse and forward drift separately (`reverse_agents_mirror`, `forward_agents_mirror`). The agent definitions refer to their skills by their Claude Code path, `.claude/skills/<name>/SKILL.md`. That is where Claude Code loads them, so those references are unchanged. No forward agent may write anything under `reverse/`.

## Running the pipeline

**Requirements:**
- [Claude Code](https://claude.com/claude-code);
- a Neo4j instance (Aura or self-hosted);
- the Neo4j Cypher MCP server (`mcp-neo4j-cypher`).

Copy `.mcp.json.example` to `.mcp.json` with your connection details. That file is git-ignored and never committed. Then point `1_inventory_c` at the COBOL root and run `1_inventory_c` to `7_synthesis_c` in order. The sample COBOL source is restricted and not redistributed (see [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)).

## Why the artifacts stay in `output/`

The reverse artifacts were **not** moved to `reverse/output/`. Their path is part of recorded, hash-bound evidence:
- The real forward workflow's baseline manifest records every reverse input as `output/...` with its SHA-256. G0 re-hashes those paths, and the G0/G1 results are bound to that manifest.
- The STEP-22 source-integrity record and the STEP-25 integrity check pin the reverse artifacts by their `output/` paths.
- The CI integrity job pins artifact hashes by path.
- The dashboard evidence manifest keys rule and diagram evidence by path.
- Six historical report generators read from `output/`.

Moving the files would mean either rewriting those records, which is not allowed, or routing every consumer through a path-compatibility resolver. That resolver could not be fully verified against the real workflow without appending new gate results to it. The artifacts therefore keep their recorded location, and their bytes, permanent IDs and rule IDs are unchanged.

## License

The seven agent definitions and their 14 skills are derived from an Apache-2.0-licensed project and were modified for REVFORGE. They keep that license; see [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md).
