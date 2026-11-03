/**
 * External egress guard. STEP 4.5 prepares independent-review packets but
 * must never transmit source or analysis to an external service. Every
 * transmission path goes through assertEgressAllowed(), which refuses unless
 * a verified source-export authorization exists AND the current step enables
 * transmission — and no step up to 4.5 does. There is no client here.
 */
export class EgressBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EgressBlockedError';
  }
}

export interface ExportAuthorization {
  status: 'AUTHORIZED' | 'NOT_AUTHORIZED';
  reason: string;
  authorization_record: string | null;
}

/** Transmission is not implemented before Step 5; this always refuses in STEP 4.5. */
export const TRANSMISSION_ENABLED = false;

export function assertEgressAllowed(purpose: string, auth: ExportAuthorization): void {
  if (auth.status !== 'AUTHORIZED') throw new EgressBlockedError(`external transmission refused (${purpose}): source export is NOT_AUTHORIZED — ${auth.reason}`);
  if (!TRANSMISSION_ENABLED) throw new EgressBlockedError(`external transmission refused (${purpose}): transmission is not enabled in this step`);
}

/** The only entry point for sending a verification packet; it cannot succeed in STEP 4.5. */
export function sendVerificationPacket(packetId: string, auth: ExportAuthorization): never {
  assertEgressAllowed(`verification packet ${packetId}`, auth);
  throw new EgressBlockedError('no external review client exists in STEP 4.5');
}
