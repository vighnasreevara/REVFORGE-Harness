/**
 * Registry of the reverse-engineering harness: the seven reverse agents and
 * the fourteen skills they run, in pipeline order. Their canonical
 * definitions live in reverse/agents and reverse/skills; Claude Code
 * discovers them through byte-identical copies under .claude/ (see mirror.ts).
 *
 * Names, order and skill assignments are those of the reverse pipeline; this
 * file only lists them so that sync and drift checks can enumerate them.
 */
export interface ReverseAgent {
  /** Agent name (also the file name stem: <name>.agent.md). */
  name: string;
  /** Pipeline position, 1 to 7. */
  order: number;
  /** The two skills the agent runs, in the order it runs them. */
  skills: [string, string];
}

export const REVERSE_AGENTS: ReverseAgent[] = [
  { name: '1_inventory_c', order: 1, skills: ['file-walker', 'dependency-graph'] },
  { name: '2_parser_c', order: 2, skills: ['cobol-ast-parser', 'section-mapper'] },
  { name: '3_data_c', order: 3, skills: ['record-layout-parser', 'data-dictionary-builder'] },
  { name: '4_logic_c', order: 4, skills: ['control-flow-tracer', 'pseudocode-generator'] },
  { name: '5_rules_c', order: 5, skills: ['condition-classifier', 'rule-tagger'] },
  { name: '6_diagram_c', order: 6, skills: ['component-mapper', 'sequence-builder'] },
  { name: '7_synthesis_c', order: 7, skills: ['gap-detector', 'section-assembler'] },
];

export const REVERSE_SKILLS: Array<{ name: string; owner: string }> = REVERSE_AGENTS.flatMap((a) => a.skills.map((s) => ({ name: s, owner: a.name })));
