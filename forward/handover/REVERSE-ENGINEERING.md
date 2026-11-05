# Reverse engineering

The reverse harness turns the COBOL codebase into traceable, evidence-classified documentation. It is complete for the sample portfolio system. Its outputs are committed in `output/`, and their hashes are recorded in `forward/reports/step-22/source-integrity.json`.

## Agents, skills and outputs

| # | Agent (`.claude/agents/`) | Skills (`.claude/skills/`) | Output | Permanent IDs |
|---|---|---|---|---|
| 1 | `1_inventory_c` | file-walker, dependency-graph | `output/inventory/inventory_artifact.json` | creates System, File, Path |
| 2 | `2_parser_c` | cobol-ast-parser, section-mapper | `output/parser/parser_artifact.json`, `raw_structure/*.json` (42) | creates Section, Paragraph, Statement |
| 3 | `3_data_c` | record-layout-parser, data-dictionary-builder | `output/data/data_artifact.json`, `data_layouts/` | creates Record, Field |
| 4 | `4_logic_c` | control-flow-tracer, pseudocode-generator | `output/logic/logic_artifact.json`, `program_logic/` (42) | reuses, read-only check |
| 5 | `5_rules_c` | condition-classifier, rule-tagger | `output/rules/rules_artifact.json`, `classified_conditions.json` | reuses |
| 6 | `6_diagram_c` | component-mapper, sequence-builder | `output/diagram/diagrams_artifact.json`, `diagrams/*.mmd` (65) | reuses |
| 7 | `7_synthesis_c` | gap-detector, section-assembler | `output/final_report/brd.md`, `brd_summary.md`, `gaps_register.json` / `.md` | reuses |

Agents exchange JSON artifacts. Neo4j, reached through the Neo4j Cypher MCP server, is used only for identity. Agents 4–7 verify the IDs they cite with read-only queries and create none.

## Results

| Measure | Value |
|---|---|
| Inventoried files | 83 (42 programs, 25 copybooks, 15 JCL, 1 BMS map) |
| Paragraphs / statements | 402 / 1,936 |
| Records / fields / level-88 conditions | 231 / 1,009 / 259 |
| Business rules | 154 (36 confirmed, 25 high, 79 medium, 14 low confidence; 50 flagged for SME review) |
| Diagrams | 65 (45 process flow, 15 component, 3 ERD, 2 sequence) |
| Historical gaps | 217 (6 critical, 86 high, 50 medium, 75 low) |

## Principles that carry into forward engineering

- **Evidence classes.** Every rule and diagram edge is *confirmed*, *inferred* or *uncertain*.
- **No invented behaviour.** Missing paragraphs, copybooks and programs become gaps, never guessed logic. For example, POSUPDT's source is a single blank byte and is recorded as such.
- **Stable identities.** Permanent IDs are never repaired or re-created. `BR-` and `GAP-` IDs are run-local catalogue IDs bound to the artifact hashes.

## What happened to the 217 reverse gaps

STEP-22 and STEP-23 gave each of the 217 historical gaps one disposition:

| Disposition | Count |
|---|---|
| Resolved, excluded from the register | 10 |
| Represented by forward gap records at the same location | 33 |
| Kept as reverse records in the STEP-23 register | 174 |

The arithmetic is in `forward/reports/step-23/gap-summary.json`.

## Re-running

Re-running needs Claude Code, a Neo4j instance with the Cypher MCP server (`.mcp.json` from `.mcp.json.example`, never committed) and the authorized COBOL source; see [INSTALLATION-AND-RUNBOOK.md](INSTALLATION-AND-RUNBOOK.md). A re-run changes the catalogue IDs' binding hashes, so the forward baseline would then need a new G0.
