# Third-party notices

## legacy-modernization-harness

- Source: https://github.com/Udaradg/legacy-modernization-harness
- Commit: `f0c47e0bdf202177b3274c0984dc3cf1528d50f3`
- Author: Udara Dharmasena
- License: Apache License 2.0 (full text: [`licenses/APACHE-2.0-upstream-harness.txt`](licenses/APACHE-2.0-upstream-harness.txt))

The files listed below are derived from that repository and were modified for REVFORGE by Vighnasree Vara. They remain subject to the Apache License 2.0. All other REVFORGE content is licensed under the MIT License (see [`LICENSE`](LICENSE)).

The sample COBOL codebase analysed by the pipeline (its `src/` folder) comes from the same repository. It is not redistributed here, but the generated analysis outputs under `output/` quote names, line numbers and fragments from it.

These REVFORGE files are derived from that repository and modified by REVFORGE:

| REVFORGE file | Derived from | Modification |
|---|---|---|
| `.claude/agents/1_inventory_c.agent.md` | `.claude/agents/1_inventory_c.agent.md` | Permanent System/File/Path ID handling via Neo4j; JSON ↔ Neo4j verification |
| `.claude/skills/file-walker/SKILL.md` | `.claude/skills/file-walker/SKILL.md` | Neo4j File Registry registration and identifier fields |
| `.claude/skills/dependency-graph/SKILL.md` | `.claude/skills/dependency-graph/SKILL.md` | Identifier pass-through only |
| `.claude/agents/2_parser_c.agent.md` | `.claude/agents/2_parser_c.agent.md` | Agent 1 identities, parse runs, MODE, collision-free outputs; upstream and JSON ↔ Neo4j identity verification |
| `.claude/skills/cobol-ast-parser/SKILL.md` | `.claude/skills/cobol-ast-parser/SKILL.md` | Statement extraction; permanent Section/Paragraph/Statement IDs via Neo4j |
| `.claude/skills/section-mapper/SKILL.md` | `.claude/skills/section-mapper/SKILL.md` | ID-referenced control flow; Neo4j relationships; run completion |
| `.claude/agents/3_data_c.agent.md` | `.claude/agents/3_data_c.agent.md` | Agent 1/2 identities, data runs, SOURCE_KIND/MODE, collision-free outputs; upstream and JSON ↔ Neo4j identity verification |
| `.claude/skills/record-layout-parser/SKILL.md` | `.claude/skills/record-layout-parser/SKILL.md` | Permanent Record/Field IDs via Neo4j; size computation in Neo4j; copy-expansion links |
| `.claude/skills/data-dictionary-builder/SKILL.md` | `.claude/skills/data-dictionary-builder/SKILL.md` | ID-carrying catalogue; relationships derived in Neo4j; fragment assembly |
| `.claude/agents/4_logic_c.agent.md` | `.claude/agents/4_logic_c.agent.md` | Read-only verification of upstream permanent IDs against Neo4j; collision-free output names; tools Glob, Write, Edit, Neo4j MCP read |
| `.claude/skills/control-flow-tracer/SKILL.md` | `.claude/skills/control-flow-tracer/SKILL.md` | Existing Paragraph/Statement IDs on trace elements; condition fields matched to existing Record/Field IDs by a Neo4j read query |
| `.claude/skills/pseudocode-generator/SKILL.md` | `.claude/skills/pseudocode-generator/SKILL.md` | Added ID reference fields (paragraph, statement per pseudocode line, field, call target); output file names and manifest |
| `.claude/agents/5_rules_c.agent.md` | `.claude/agents/5_rules_c.agent.md` | Read-only verification of reused permanent source IDs against Neo4j; partial-program handling; tools Grep, Glob, Write, Edit, Neo4j MCP read |
| `.claude/skills/condition-classifier/SKILL.md` | `.claude/skills/condition-classifier/SKILL.md` | Added permanent source and field ID references; evidence/unresolved markers for partial programs |
| `.claude/skills/rule-tagger/SKILL.md` | `.claude/skills/rule-tagger/SKILL.md` | Source IDs on rule sources and error entries; confidence cap and SME review for partial evidence; `rules_by_file_id` |
| `.claude/agents/6_diagram_c.agent.md` | `.claude/agents/6_diagram_c.agent.md` | Permanent source IDs as optional index metadata, verified read-only against Neo4j; path evidence classes; tools Grep, Glob, Write, Edit, Neo4j MCP read |
| `.claude/skills/component-mapper/SKILL.md` | `.claude/skills/component-mapper/SKILL.md` | File/Path/Record/Field IDs on nodes; program type from Agent 4 entry type when unclassified; edge evidence |
| `.claude/skills/sequence-builder/SKILL.md` | `.claude/skills/sequence-builder/SKILL.md` | Paragraph/Section/Statement IDs on nodes; confirmed/uncertain/unsupported path rendering (HANDLE CONDITION, recursion, unresolvable paths); rule confidence and SME flags |
| `.claude/agents/7_synthesis_c.agent.md` | `.claude/agents/7_synthesis_c.agent.md` | Permanent source IDs on gaps and BRD content, verified read-only against Neo4j; Agent 6 audit corrections; confirmed/inferred/uncertain labels; verbatim inserts; tools Grep, Glob, Write, Edit, Neo4j MCP read |
| `.claude/skills/gap-detector/SKILL.md` | `.claude/skills/gap-detector/SKILL.md` | REVFORGE field locations; additional gap types; root-cause deduplication; source IDs and evidence on gaps |
| `.claude/skills/section-assembler/SKILL.md` | `.claude/skills/section-assembler/SKILL.md` | Source-ID citations; evidence labels; all 143 rules incl. copybook-level rules; diagram limitations and rendering disclosure; verbatim inserts for diagrams and appendices |
