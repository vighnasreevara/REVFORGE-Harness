/**
 * Demo-only approvals for the synthetic workflow demonstration (the human gates G1 and G2).
 *
 * Each demo run creates a fresh Ed25519 key pair in memory. The private key
 * never touches the disk and is gone when the process ends; only the public
 * key is written, into a demo trust store inside the demo run directory.
 * Signatures are verified with the production verifier
 * (approval/trust: loadTrustStore + verifySignature) pointed at that demo
 * store, so the same checks apply: an Ed25519 signature over the canonical
 * statement, signer identity, role, validity window and tampering.
 *
 * The signer is a synthetic demo authority (signer_id "synthetic-demo-…"),
 * never a real stakeholder, and every record states
 * production_authorization: NOT_GRANTED. The real configuration names no
 * trust store, so a demo approval can never verify in the real workflow.
 */
import { createPublicKey, generateKeyPairSync, KeyObject, sign } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { canonicalize } from '../approval/canonical';
import { DEFAULT_POLICY } from '../approval/policy';
import { keyFingerprint, loadTrustStore, verifySignature } from '../approval/trust';
import { RuntimeContext } from '../core/config';

export const DEMO_ENV = 'SYNTHETIC_INTERVIEW_DEMO';
export const DEMO_SIGNER = 'synthetic-demo-authority';
export const DEMO_ROLES: Record<'G1' | 'G2', string> = {
  G1: 'demo_requirements_approver',
  G2: 'demo_architecture_approver',
};
export const SIGNER_STATEMENT = 'Synthetic demonstration authority created for one demo run. Not a real stakeholder, business owner or production approver.';

/** The canonical text a demo approval signature covers: the record without its signature. */
export function statementText(record: any): string {
  const { signature, ...body } = record;
  return canonicalize(body);
}

/** An ephemeral signing authority. The private key lives only in this closure. */
export class EphemeralAuthority {
  private readonly privateKey: KeyObject;
  readonly publicKeyPem: string;
  readonly created_at: string;

  constructor(now = new Date()) {
    const kp = generateKeyPairSync('ed25519');
    this.privateKey = kp.privateKey;
    this.publicKeyPem = kp.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    this.created_at = now.toISOString();
  }

  /** Signs an unsigned approval record and returns the signed copy. */
  sign(record: any): any {
    const unsigned = { ...record, signature: { algorithm: 'Ed25519', value: '' } };
    const value = sign(null, Buffer.from(statementText(unsigned), 'utf8'), this.privateKey).toString('base64');
    return { ...unsigned, signature: { algorithm: 'Ed25519', value } };
  }

  /** Writes the demo trust store (public key only) and returns its path. */
  writeTrustStore(dir: string, validUntil: string): string {
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'demo-trust-store.json');
    const store = {
      contract: 'approval-trust-store',
      contract_version: '1.0',
      issued_by: 'REVFORGE synthetic gate demonstration (ephemeral, one demo run)',
      issued_at: this.created_at,
      signers: [{ signer_id: DEMO_SIGNER, display_name: 'Synthetic demo authority (not a real person)', public_key_pem: this.publicKeyPem, roles: Object.values(DEMO_ROLES), valid_from: this.created_at, valid_until: validUntil }],
    };
    fs.writeFileSync(file, JSON.stringify(store, null, 2) + '\n');
    return file;
  }
}

export interface ApprovalCheck {
  id: string;
  ok: boolean;
  detail: string;
}

/**
 * Verifies a signed demo approval with the production signature verifier, against the demo trust store only.
 * `policy.trust_store_env` is emptied so a real trust store named in the environment is never consulted.
 * The store on disk is trusted only if its signer key is the run's own key (`pinnedPublicKeyPem`, held in
 * memory since the run started): a store replaced during the run cannot introduce another key.
 */
export function verifyDemoSignature(ctx: RuntimeContext, trustStoreFile: string, record: any, role: string, pinnedPublicKeyPem: string, at = new Date()): ApprovalCheck {
  const ts = loadTrustStore(ctx, { ...DEFAULT_POLICY, trust_store: trustStoreFile, trust_store_env: '' });
  if (!ts.usable) return { id: 'signature', ok: false, detail: `demo trust store unusable: ${ts.problems.join('; ')}` };
  const pinned = keyFingerprint(createPublicKey(pinnedPublicKeyPem));
  const stored = ts.signers.get(DEMO_SIGNER);
  if (!stored || stored.fingerprint !== pinned || ts.signers.size !== 1) return { id: 'signature', ok: false, detail: `the demo trust store no longer holds only this run's key (pinned ${pinned.slice(0, 16)}…, store ${stored ? stored.fingerprint.slice(0, 16) + '…' : 'no demo signer'}): it was replaced after the run started` };
  const v = verifySignature(ts, String(record?.signer?.signer_id ?? ''), statementText(record ?? {}), String(record?.signature?.value ?? ''), [role], at);
  return { id: 'signature', ok: v.ok, detail: v.ok ? `Ed25519 signature by ${record.signer.signer_id} (role ${role}, key ${v.signer!.fingerprint.slice(0, 16)}…) verifies against the demo trust store` : v.problems.join('; ') };
}
