/**
 * Evidence classification, following the labelling rule of the reverse
 * Synthesis agent (.claude/agents/7_synthesis_c.agent.md, "Confirmed, inferred
 * and uncertain"):
 *   confirmed  - rule confidence confirmed/high with complete evidence, or a
 *                resolved structural fact from Agents 1-3;
 *   inferred   - medium-confidence rules, heuristic relationships, agent
 *                interpretations;
 *   uncertain  - low confidence, partial evidence, unresolved, runtime-only,
 *                SME review required.
 * A low-confidence rule is never presented as a verified requirement.
 */

export type EvidenceClass = 'confirmed' | 'inferred' | 'uncertain';

export interface RuleEvidenceInput {
  confidence: string;
  requires_sme_review: boolean;
  dead_code?: boolean | null;
  source_evidence: Array<string | null | undefined>;
}

export interface Classification {
  evidence_class: EvidenceClass;
  reasons: string[];
}

export function classifyRule(r: RuleEvidenceInput): Classification {
  const reasons: string[] = [];
  const conf = (r.confidence || '').toLowerCase();
  const partial = r.source_evidence.some((e) => e !== 'complete');
  if (conf === 'low') reasons.push('low confidence');
  if (partial) reasons.push(r.source_evidence.length === 0 ? 'no source evidence recorded' : 'partial evidence in at least one source');
  if (r.requires_sme_review) reasons.push('SME review required');
  if (r.dead_code) reasons.push('implemented only in confirmed dead code');
  if (!['confirmed', 'high', 'medium', 'low'].includes(conf)) reasons.push(`unrecognised confidence '${r.confidence}'`);
  if (reasons.length > 0) return { evidence_class: 'uncertain', reasons };
  if (conf === 'medium') return { evidence_class: 'inferred', reasons: ['medium confidence'] };
  return { evidence_class: 'confirmed', reasons: [`${conf} confidence with complete evidence`] };
}

/** Diagram edges are supporting evidence; 'unsupported' edges are never treated as behaviour. */
export function diagramEdgeClass(evidence: string | null | undefined): EvidenceClass {
  if (evidence === 'confirmed') return 'confirmed';
  return 'uncertain';
}

/** Structural facts from Agents 1-3 are confirmed only when resolved. */
export function structuralClass(resolved: boolean): EvidenceClass {
  return resolved ? 'confirmed' : 'uncertain';
}

export function tally(classes: EvidenceClass[]): Record<EvidenceClass, number> {
  const t: Record<EvidenceClass, number> = { confirmed: 0, inferred: 0, uncertain: 0 };
  for (const c of classes) t[c] += 1;
  return t;
}
