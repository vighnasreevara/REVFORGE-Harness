/**
 * Evidence-based program classification: application, template, test tool or
 * utility. Each signal comes from a reverse artifact (inventory path, Agent 4
 * narrative, inventory/gap notes). Agreement of independent signals gives a
 * confirmed class; one signal gives an inferred class; conflicting or absent
 * signals give an uncertain class. Classification never authorises
 * modernisation: anything other than a confirmed or inferred application
 * needs a scope decision.
 */
import { ProgramRecord } from '../core/model';

export type ProgramClass = 'application' | 'template' | 'test_tool' | 'utility';

export interface ClassSignal {
  source: 'inventory.relative_path' | 'logic.program_narrative' | 'inventory.issues' | 'gaps.description';
  value: string;
  implies: ProgramClass;
}

export interface Classification {
  program_id: string;
  file_id: string;
  class: ProgramClass | 'unknown';
  confidence: 'confirmed' | 'inferred' | 'uncertain';
  signals: ClassSignal[];
  conflicts: string[];
  modernization_scope: 'candidate' | 'requires_scope_decision';
  scope_reason: string;
}

const PATH_RULES: Array<[RegExp, ProgramClass]> = [
  [/(^|\/)templates?(\/|$)/i, 'template'],
  [/(^|\/)(tests?|testing)(\/|$)/i, 'test_tool'],
  [/(^|\/)(util|utils|utility|utilities)(\/|$)/i, 'utility'],
];

/** Phrases describing what a program is (not words that merely occur in business text). */
const NARRATIVE_RULES: Array<[RegExp, ProgramClass]> = [
  [/\b(program |batch |file-handling |error-handling )?template\b/i, 'template'],
  [/\bnot a business program\b/i, 'template'],
  [/\btest[- ]data (program|generator)\b|\btest[- ]validation driver\b|\btest (harness|driver|tool)\b/i, 'test_tool'],
  [/\b(maintenance|monitoring|validation|file-maintenance|system-monitoring|data-validation) utility\b/i, 'utility'],
];

const APPLICATION_DIR = /(^|\/)(programs?|src)\/[^/]+\//i;

export function classifyProgram(p: ProgramRecord, narrative: string | null, inventoryNotes: string[], gapTexts: string[]): Classification {
  const signals: ClassSignal[] = [];
  const rel = p.relative_path ?? '';
  for (const [re, cls] of PATH_RULES) if (re.test(rel)) signals.push({ source: 'inventory.relative_path', value: rel, implies: cls });

  // Only the first sentence of the narrative describes what the program *is*.
  const firstSentence = (narrative ?? '').split(/(?<=\.)\s/)[0] ?? '';
  for (const [re, cls] of NARRATIVE_RULES) {
    const m = re.exec(firstSentence);
    if (m) signals.push({ source: 'logic.program_narrative', value: m[0], implies: cls });
  }
  for (const n of inventoryNotes) if (/\btemplate\b/i.test(n) && /\b(is|as) a template\b/i.test(n)) signals.push({ source: 'inventory.issues', value: n.slice(0, 160), implies: 'template' });
  for (const g of gapTexts) {
    const m = /\b(is|as) a (program )?template\b/i.exec(g);
    if (m) signals.push({ source: 'gaps.description', value: m[0], implies: 'template' });
  }

  const kinds = [...new Set(signals.map((s) => s.implies))];
  const sources = new Set(signals.map((s) => s.source));
  const conflicts: string[] = [];
  let cls: Classification['class'];
  let confidence: Classification['confidence'];
  if (kinds.length === 0) {
    // No non-application signal. An application directory is weak positive evidence.
    cls = 'application';
    confidence = APPLICATION_DIR.test(rel) && narrative ? 'inferred' : 'uncertain';
  } else if (kinds.length === 1) {
    cls = kinds[0];
    confidence = sources.size >= 2 ? 'confirmed' : 'inferred';
    if (sources.size === 1 && sources.has('logic.program_narrative')) conflicts.push(`source path '${rel}' does not indicate ${kinds[0]}; classification rests on the narrative only`);
  } else {
    cls = 'unknown';
    confidence = 'uncertain';
    conflicts.push(`signals disagree: ${kinds.join(' vs ')}`);
  }
  const candidate = cls === 'application' && confidence !== 'uncertain';
  return {
    program_id: p.program_id,
    file_id: p.file_id,
    class: cls,
    confidence,
    signals,
    conflicts,
    modernization_scope: candidate ? 'candidate' : 'requires_scope_decision',
    scope_reason: candidate
      ? 'evidence indicates an application program; modernisation still requires approved requirements and gates'
      : cls === 'application'
        ? 'too little evidence to confirm that this is an application program'
        : `classified as ${cls} (${confidence}); a human must decide whether it is in modernisation scope`,
  };
}
