/**
 * Approval policy: who may approve what, and how each kind of evidence is
 * treated by G2. Read from the `approval` section of the forward
 * configuration (validated by its contract); omitted values take the strict
 * defaults below. The policy digest is bound into every approval scope, so a
 * policy change invalidates existing approvals.
 */
import { RuntimeContext } from '../core/config';
import { digest } from './canonical';

export type Outcome = 'VERIFIED' | 'REQUIRES_EVIDENCE' | 'REQUIRES_SME_DECISION' | 'CONTRADICTED' | 'EXCLUDED_WITH_JUSTIFICATION' | 'APPROVED_EXCEPTION';
export type DecisionKind = 'business' | 'technical' | 'scope' | 'data_layout' | 'runtime_semantics' | 'review';

export interface ApprovalPolicy {
  trust_store: string | null;
  trust_store_env: string;
  request_ttl_hours: number;
  max_clock_skew_minutes: number;
  require_distinct_requester: boolean;
  roles: { requirements_approval: string[]; exception: string[]; decision: Record<DecisionKind, string[]> };
  g2: {
    default_scope: string;
    reverse_artifact_supported: 'REQUIRES_EVIDENCE' | 'REQUIRES_SME_DECISION';
    allow_exceptions_for: Array<'REQUIRES_EVIDENCE' | 'REQUIRES_SME_DECISION'>;
    accept_independent_verification_without_read_telemetry: boolean;
    blocking_gap_severities: string[];
    include_called_programs: boolean;
  };
}

export const DEFAULT_POLICY: ApprovalPolicy = {
  trust_store: null,
  trust_store_env: 'REVFORGE_APPROVAL_TRUST_STORE',
  request_ttl_hours: 168,
  max_clock_skew_minutes: 10,
  require_distinct_requester: true,
  roles: {
    requirements_approval: ['requirements_approver'],
    exception: ['exception_approver'],
    decision: { business: ['business_sme'], technical: ['technical_authority'], scope: ['business_sme', 'product_owner'], data_layout: ['technical_authority'], runtime_semantics: ['technical_authority'], review: ['business_sme'] },
  },
  g2: {
    default_scope: 'application',
    reverse_artifact_supported: 'REQUIRES_EVIDENCE',
    allow_exceptions_for: ['REQUIRES_EVIDENCE'],
    accept_independent_verification_without_read_telemetry: true,
    blocking_gap_severities: ['critical', 'high'],
    include_called_programs: true,
  },
};

export function loadPolicy(ctx: RuntimeContext): ApprovalPolicy {
  const a: any = (ctx.config as any).approval ?? {};
  return {
    trust_store: a.trust_store ?? DEFAULT_POLICY.trust_store,
    trust_store_env: a.trust_store_env ?? DEFAULT_POLICY.trust_store_env,
    request_ttl_hours: a.request_ttl_hours ?? DEFAULT_POLICY.request_ttl_hours,
    max_clock_skew_minutes: a.max_clock_skew_minutes ?? DEFAULT_POLICY.max_clock_skew_minutes,
    require_distinct_requester: a.require_distinct_requester ?? DEFAULT_POLICY.require_distinct_requester,
    roles: {
      requirements_approval: a.roles?.requirements_approval ?? DEFAULT_POLICY.roles.requirements_approval,
      exception: a.roles?.exception ?? DEFAULT_POLICY.roles.exception,
      decision: { ...DEFAULT_POLICY.roles.decision, ...(a.roles?.decision ?? {}) },
    },
    g2: { ...DEFAULT_POLICY.g2, ...(a.g2 ?? {}) },
  };
}

/** Digest of the parts of the policy that decide G2 outcomes and authority (not the trust store location). */
export function policyDigest(p: ApprovalPolicy): string {
  return digest({ roles: p.roles, g2: p.g2, require_distinct_requester: p.require_distinct_requester });
}
