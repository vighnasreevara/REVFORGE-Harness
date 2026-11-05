// Dashboard data contracts. Every value is read from a committed evidence file
// (see evidence-sources.json); `source` fields name that file so the UI can cite it.
import type { CrossCheck, Issue } from './check';

export interface ManifestFile {
  path: string;
  missing: boolean;
  bytes?: number;
  sha256?: string;
  git_blob_head?: string | null;
  committed?: boolean;
  matches_head?: boolean;
}

export interface ManifestSource extends ManifestFile {
  key: string;
  step: string;
  required: boolean;
  format: 'json' | 'jsonl';
  last_commit: { sha: string; date: string } | null;
}

export interface ManifestCollection {
  key: string;
  step: string;
  required: boolean;
  dir: string;
  ext: string;
  load: 'eager' | 'lazy';
  files: ManifestFile[];
}

export interface Manifest {
  contract: string;
  baseline_commit: string | null;
  baseline_commit_date: string | null;
  repository: string;
  totals: { files: number; missing: string[]; uncommitted: string[]; modified_since_commit: string[]; bytes: number };
  sources: ManifestSource[];
  collections: ManifestCollection[];
}

/** numerator / denominator as recorded; no percentages are stored anywhere. */
export interface Ratio {
  metric: string;
  numerator: number;
  denominator: number;
  definition: string;
  source: string;
}

export type ProgramClass = 'COMPLETE' | 'PARTIAL' | 'MISSING';

export interface ReadinessCheck {
  id: string;
  ok: boolean;
  detail: string;
}

export interface ReadinessDetail {
  status: string;
  checks: ReadinessCheck[];
  gates: Record<string, string>;
  behaviours: number;
  openDecisions: number;
  blockingGaps: number;
  generationAuthorized: boolean | null;
  source: string;
}

export interface Program {
  id: string;
  fileId: string;
  source: string;
  sourceSha256: string;
  javaClass: string | null;
  javaFiles: string[];
  localAuthorization: string | null;
  classification: ProgramClass;
  paragraphs: { reverse: number | null; mapped: number | null; testExecuted: number | null };
  statements: Record<string, number>;
  ruleStatuses: Record<string, number>;
  ruleIds: string[];
  dependencies: { type: string; to: string; forward: string }[];
  unsupported: Record<string, number>;
  tests: {
    checks: { PASS: number; BLOCKED_AS_EXPECTED: number; FAIL: number; total: number } | null;
    scenarios: { scenarios: number; passed: number; blocked_as_expected: number; failed: number; fixtures: string } | null;
    statementCoverage: { statements: number; executed_in_passing_scenarios: number; executed_only_on_blocked_paths: number } | null;
  };
  validation: { exitCode: number | null; result: string };
  readiness: { status: string; failingChecks: string[] };
  forwardGapIds: string[];
  bmadGovernance: string | null;
  cobolEquivalence: string;
  impact: {
    gaps: number;
    critical: number;
    high: number;
    byCategory: Record<string, number>;
    rootBlockers: string[];
    directReadinessBlockers: string[];
    externalBlockers: number;
    businessDecisionBlockers: number;
    verificationBlockers: number;
    nextActions: string[];
    note: string;
  } | null;
  /** Every register record that names this program (forward + reverse). */
  gapIds: string[];
  maxSeverity: Severity | null;
  readinessDetail: ReadinessDetail | null;
}

export type RuleStatus = 'IMPLEMENTED_VERIFIED' | 'IMPLEMENTED_VERIFIED_TO_GAP' | 'IMPLEMENTED_NOT_EXERCISED' | 'BLOCKED';

export interface RuleTest {
  scenario: string;
  result: string;
  asserted: string[];
}

export interface Rule {
  id: string;
  name: string;
  category: string;
  program: string;
  cobol: string;
  java: string | null;
  tests: RuleTest[];
  verifiedBehaviour: string;
  unverifiedBehaviour: string;
  status: RuleStatus;
  classification: string;
  implemented: boolean;
  cobolEquivalent: boolean;
  reverse: { confidence: string | null; requiresSmeReview: boolean | null; condition: string | null; statementId: string | null; paragraph: string | null };
  description: string | null;
  ruleSet: string | null;
  gapIds: string[];
  flags: {
    blockedByMissingImplementation: boolean;
    affectedByMissingSource: boolean;
    requiresBusinessDecision: boolean;
    needsExternalEnvironment: boolean;
    implementedNotIndependentlyVerified: boolean;
    awaitingLegacyEquivalence: boolean;
  } | null;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface RuleLink {
  rule: string;
  relation: string;
  evidence: string;
}

export interface Gap {
  id: string;
  originalId: string | null;
  inventoryCategory: string;
  sourceRun: string;
  sourceReference: string;
  stableRef: string | null;
  sourcePath: string | null;
  sourceLine: number | null;
  sourceIdentity: string | string[] | null;
  sourceSha256: string | null;
  evidenceSha256: string | null;
  forwardReference: string | null;
  kind: string;
  subject: string;
  description: string;
  programs: string[];
  javaClasses: string[];
  paragraphs: { name: string; paragraph_id: string }[];
  statements: { line: number; statement_id: string }[];
  dataItems: string[];
  copybooks: string[];
  severity: Severity;
  dependencyGroup: string | null;
  category: string;
  rootCauseGroup: string;
  rootCause: string;
  priority: Priority;
  priorityRationale: string;
  status: string;
  verificationState: string;
  rules: string[];
  ruleLinks: RuleLink[];
  diagrams: string[];
  jclJobs: string[];
  externalDependencies: string[];
  owner: string;
  approver: string | null;
  externalOwner: string | null;
  requiredTechnicalAction: string | null;
  requiredBusinessDecision: string | null;
  requiredSourceCorrection: string | null;
  requiredExternalSystem: string | null;
  approvalRequirements: string | null;
  verificationMethod: string | null;
  closureCriteria: string | null;
  resolutionEvidence: unknown;
  originalScope: string | null;
  reverseClassification: string | null;
  /** First recorded required action, in the order technical, business, source, external. */
  nextAction: string | null;
  /** Gap-to-gap edges of the dependency graph. */
  blockedBy: string[];
  blocks: string[];
}

export type Confidence = 'EVIDENCED' | 'EVIDENCED_BY_TEXT' | 'HYPOTHESIS';

export interface GraphNode {
  id: string;
  type: string;
  label: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  evidence: string;
  confidence: Confidence;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootBlockers: string[];
  independentGaps: string[];
  cycles: unknown[];
  summary: { nodes: number; edges: number; byRelation: Record<string, number>; byConfidence: Record<string, number>; rootBlockers: number; independentGaps: number };
}

export interface RootCauseGroup {
  id: string;
  title: string;
  category: string;
  rootCause: string;
  members: string[];
  memberCount: number;
  programs: string[];
  rules: string[];
  dependencies: string[];
  owner: string;
  externalOwner: string | null;
  resolutionRequirements: string;
  validationEvidence: string;
  severityMix: Record<string, number>;
  priorityMix: Record<string, number>;
}

export interface RoadmapPhase {
  phase: string;
  title: string;
  groups: string[];
  gaps: number;
  roles: string[];
  prerequisites: string;
  requiredEvidence: string;
  exitCriteria: string;
  remainingBlockers: string;
  /** Recounted from the groups' members. */
  recountedMembers: number;
}

export interface OwnerRole {
  role: string;
  gaps: number;
  groups: string[];
  approvers: string[];
  externalOwners: string[];
}

export interface Diagram {
  id: string;
  type: string;
  file: string;
  title: string;
  program: string | null;
  programs: string[];
  javaClass: string | null;
  mapping: string;
  reverseNodes: number;
  reverseEdges: number;
  edgesClassified: Record<string, number>;
  edgesNotFoundInJava: number;
  unresolvedNodes: string[];
  rulesAnnotated: string[];
  incomplete: boolean;
  truncated: boolean;
  nodesByForwardMapping: Record<string, number>;
  gaps: number | null;
  gapGroups: Record<string, number>;
  /** Present only when the Mermaid source is among the committed evidence files. */
  mermaidPath: string | null;
  note: string | null;
}

export interface BmadWorkflow {
  order: number;
  bindingId: string;
  workflowId: string;
  purpose: string;
  agent: string;
  allowedStates: string[];
  requiresGates: string[];
  mayWriteCode: boolean;
  mayApprove: boolean;
  configured: boolean;
  stage: string | null;
  stageStatus: string | null;
  preflightId: string | null;
  authorizationId: string | null;
  receiptId: string | null;
  executed: boolean;
  blockers: string[];
}

export interface Bmad {
  status: string;
  release: string;
  mandatory: boolean;
  bindingsValid: boolean;
  liveRequested: boolean;
  metrics: Record<string, number>;
  portread: { verdict: string; exitCode: number | null; f2: { status: string; units: string[]; missing: string[] }; f6: { status: string; receipts: unknown[] } };
  localJava: { programs: number; classification: string };
  governedRun: { id: string; scope: string; status: string; mode: string; startedAt: string; endedAt: string; fallback: string; localConversionInvoked: boolean; note: string } | null;
  preflight: string | null;
  blockers: { check: string; detail: string }[];
  disclosure: { authorizationId: string; signed: boolean; expiresAt: string; note: string } | null;
  independentAgents: { agent: string; reason: string }[];
  registerRecords: string[];
  workflows: BmadWorkflow[];
}

export interface RunRecord {
  command: string;
  exitCode: number | null;
  result: string;
}

export interface Testing {
  summary: Record<string, string | number>;
  step22Runs: RunRecord[];
  step23Runs: RunRecord[];
  integration: {
    programTests: { PASS: number; BLOCKED_AS_EXPECTED: number; FAIL: number; total: number } | null;
    scenarios: { PASS: number; BLOCKED_AS_EXPECTED: number; FAIL: number; total: number } | null;
    runtimeUnitTests: { PASS: number; BLOCKED_AS_EXPECTED: number; FAIL: number; total: number } | null;
  };
  baselineCommit: string | null;
}

export interface CoverageRow {
  metric: string;
  area: string;
  measure: string;
  kind: 'structural' | 'implemented' | 'test' | 'verification' | 'equivalence';
  numerator: number;
  denominator: number;
  definition: string;
  source: string;
  breakdown?: Record<string, number>;
}

export interface DatasetState {
  key: string;
  path: string;
  required: boolean;
  status: 'loaded' | 'missing' | 'invalid';
  integrity: 'verified' | 'mismatch' | 'not-checked';
  message?: string;
}

export interface Validation {
  issues: Issue[];
  crossChecks: CrossCheck[];
  datasets: DatasetState[];
}

export interface Model {
  manifest: Manifest | null;
  baselineCommit: string | null;
  step22BaselineCommit: string | null;
  summary: {
    ratios: Record<string, Ratio>;
    gapsBySeverity: Record<string, number> | null;
    gapsByDependency: Record<string, number> | null;
    reverseHistorical: { total: number; disposition: Record<string, number> } | null;
    bmadStatus: string | null;
    cobolEquivalence: string | null;
    acceptance: { criterion: string; met: boolean }[];
  };
  coverage: CoverageRow[];
  programs: Program[] | null;
  rules: Rule[] | null;
  gaps: Gap[] | null;
  gapSummary: {
    total: number;
    byInventory: Record<string, number>;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
    byPriority: Record<string, number>;
    byStatus: Record<string, number>;
    byOwner: Record<string, number>;
    reverseHistorical: { total: number; disposition: Record<string, number>; arithmetic: string } | null;
  } | null;
  graph: DependencyGraph | null;
  groups: RootCauseGroup[] | null;
  roadmap: { phases: RoadmapPhase[]; memberships: number; uniqueMembers: number; multiPhase: { id: string; phases: string[] }[] } | null;
  owners: { roles: OwnerRole[]; ownerReviewRequired: number; names: string } | null;
  diagrams: { list: Diagram[]; summary: { total: number; byType: Record<string, number>; mapping: Record<string, number>; processFlowEdges: Record<string, number>; edgesNotFoundInJava: number } } | null;
  bmad: Bmad | null;
  testing: Testing | null;
  jcl: { job: string; source: string; status: string; integrationTest: string; forwardJob: string | null; restart: string }[] | null;
  validation: Validation;
}
