/**
 * Generation guard. STEP 1 produces planning artifacts only; any attempt to
 * write generated code (Java sources, build files, a src/main tree) is refused
 * unless the configuration explicitly authorises generation AND an approved
 * gate says so. Gates are not implemented in STEP 1, so generation is always
 * refused here.
 */

export class GenerationNotAuthorizedError extends Error {
  readonly code = 'GENERATION_NOT_AUTHORIZED';
  constructor(message: string) {
    super(message);
    this.name = 'GenerationNotAuthorizedError';
  }
}

export interface GenerationPolicy {
  java_generation_allowed: boolean;
  current_step: string;
}

/** Approved gates are introduced in later steps; STEP 1 has none. */
export interface GateApproval {
  gate_id: string;
  approved: boolean;
}

const CODE_EXTENSIONS = ['.java', '.kt', '.groovy', '.scala'];
const BUILD_FILES = ['pom.xml', 'build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts'];

export function isCodeGenerationPath(p: string): boolean {
  const n = p.replace(/\\/g, '/').toLowerCase();
  const base = n.split('/').pop() ?? n;
  if (CODE_EXTENSIONS.some((e) => base.endsWith(e))) return true;
  if (BUILD_FILES.includes(base)) return true;
  return /(^|\/)src\/(main|test)\/(java|kotlin|resources)(\/|$)/.test(n);
}

export function assertGenerationAllowed(policy: GenerationPolicy, gates: GateApproval[] = []): void {
  if (!policy.java_generation_allowed) {
    throw new GenerationNotAuthorizedError(
      `Java generation is not authorised in ${policy.current_step}: configuration has generation.java_generation_allowed=false.`,
    );
  }
  const approved = gates.some((g) => g.gate_id === 'GENERATION' && g.approved);
  if (!approved) {
    throw new GenerationNotAuthorizedError(
      `Java generation requires an approved generation gate; none exists in ${policy.current_step}.`,
    );
  }
}

/** Used by every output writer: refuses code-generation paths. */
export function assertNotCodeOutput(p: string, policy: GenerationPolicy, gates: GateApproval[] = []): void {
  if (isCodeGenerationPath(p)) assertGenerationAllowed(policy, gates);
}
