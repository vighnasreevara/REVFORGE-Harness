// One vocabulary for every status shown in the dashboard. A tone describes the
// kind of evidence, not optimism: "verified" (green) is used only where a
// passing test or gate is recorded, never because a Java file exists.

export type Tone = 'verified' | 'structural' | 'partial' | 'blocked' | 'missing' | 'neutral' | 'unestablished' | 'serious';

export interface StatusInfo {
  tone: Tone;
  label: string;
  hint?: string;
}

export const PROGRAM_STATUS: Record<string, StatusInfo> = {
  COMPLETE: { tone: 'verified', label: 'Complete (current criteria)', hint: 'Java compiled, every check passes, conversion validation passes and no open forward gap. COBOL equivalence is not established.' },
  PARTIAL: { tone: 'partial', label: 'Partial', hint: 'Java exists but checks are blocked at gaps or the program has open gaps.' },
  MISSING: { tone: 'missing', label: 'Missing', hint: 'No Java: the source cannot be converted.' },
};

export const RULE_STATUS: Record<string, StatusInfo> = {
  IMPLEMENTED_VERIFIED: { tone: 'verified', label: 'Java-verified (source-derived tests)', hint: 'Passing scenarios derived from the COBOL source assert this rule. Not a legacy-execution comparison.' },
  IMPLEMENTED_VERIFIED_TO_GAP: { tone: 'partial', label: 'Verified up to a downstream gap', hint: 'Scenarios assert the rule, then their paths end at an expected gap.' },
  IMPLEMENTED_NOT_EXERCISED: { tone: 'neutral', label: 'Unreachable (implemented, not exercised)', hint: 'Java implements the rule site but no executable path reaches it.' },
  BLOCKED: { tone: 'blocked', label: 'Blocked', hint: 'The rule site itself is a gap.' },
};

export const SEVERITY: Record<string, StatusInfo> = {
  critical: { tone: 'blocked', label: 'Critical' },
  high: { tone: 'serious', label: 'High' },
  medium: { tone: 'partial', label: 'Medium' },
  low: { tone: 'neutral', label: 'Low' },
};

export const READINESS: Record<string, StatusInfo> = {
  PASS: { tone: 'verified', label: 'Readiness pass' },
  FAIL: { tone: 'blocked', label: 'Readiness fail' },
};

export const CONFIDENCE: Record<string, StatusInfo> = {
  EVIDENCED: { tone: 'structural', label: 'Evidenced', hint: 'Recorded evidence links the two nodes.' },
  EVIDENCED_BY_TEXT: { tone: 'structural', label: 'Evidenced by text', hint: 'STEP-17 evidence text names the gap site.' },
  HYPOTHESIS: { tone: 'unestablished', label: 'Hypothesis', hint: 'A likely relation that no record proves.' },
};

export const DIAGRAM_MAPPING: Record<string, StatusInfo> = {
  STRUCTURAL: { tone: 'structural', label: 'Structural', hint: 'Every bound node maps to Java structure.' },
  PARTIAL: { tone: 'partial', label: 'Partial' },
  STRUCTURAL_ONLY: { tone: 'neutral', label: 'Structural only', hint: 'Comparable structure but no node-level binding.' },
  UNMAPPABLE: { tone: 'missing', label: 'No comparable counterpart' },
};

export const STAGE_STATUS: Record<string, StatusInfo> = {
  RECEIPT_VERIFIED: { tone: 'verified', label: 'Receipt verified' },
  EXECUTED_REJECTED: { tone: 'blocked', label: 'Executed, rejected' },
  EXECUTION_FAILED: { tone: 'blocked', label: 'Execution failed' },
  BLOCKED: { tone: 'blocked', label: 'Blocked' },
  NOT_ATTEMPTED: { tone: 'neutral', label: 'Not attempted' },
};

export const COVERAGE_KIND: Record<string, StatusInfo> = {
  structural: { tone: 'structural', label: 'Structural mapping', hint: 'A Java element exists at the same identity. Says nothing about behaviour.' },
  implemented: { tone: 'partial', label: 'Implemented functionality', hint: 'Java implements the element (or the element is blocked at a gap).' },
  test: { tone: 'verified', label: 'Test execution', hint: 'Executed by passing source-derived tests in the harness.' },
  verification: { tone: 'verified', label: 'Source-derived verification', hint: 'Assessed against criteria derived from the COBOL source.' },
  equivalence: { tone: 'unestablished', label: 'Legacy equivalence', hint: 'Compared with legacy COBOL execution. No such evidence exists.' },
};

export function statusOf(table: Record<string, StatusInfo>, key: string | null | undefined): StatusInfo {
  if (!key) return { tone: 'neutral', label: 'Not recorded' };
  return table[key] ?? { tone: 'neutral', label: key };
}

/** Chart fills: the reference status palette plus one structural blue (light, dark). */
export const TONE_FILL: Record<Tone, [string, string]> = {
  verified: ['#0ca30c', '#0ca30c'],
  structural: ['#2a78d6', '#3987e5'],
  partial: ['#fab219', '#fab219'],
  serious: ['#ec835a', '#ec835a'],
  blocked: ['#d03b3b', '#e66767'],
  missing: ['#d03b3b', '#e66767'],
  neutral: ['#898781', '#898781'],
  unestablished: ['#6250d6', '#9085e9'],
};

export const CATEGORY_LABEL: Record<string, string> = {
  SOURCE_MISSING: 'Source missing',
  EXTERNAL_DEPENDENCY: 'External dependency',
  BUSINESS_DECISION_REQUIRED: 'Business decision required',
  REVERSE_ARTIFACT_QUALITY: 'Reverse documentation quality',
  SOURCE_DEFECT: 'Source defect',
  UNSUPPORTED_COBOL_SEMANTICS: 'Unsupported COBOL construct',
  DATA_LAYOUT_GAP: 'Data layout',
  LEGACY_EQUIVALENCE_GAP: 'Legacy equivalence',
  AUTHORIZATION_OR_GOVERNANCE: 'Governance',
  TEST_COVERAGE_GAP: 'Test coverage',
};

export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c;
