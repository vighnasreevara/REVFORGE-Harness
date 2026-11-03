/**
 * Trust anchor for human approvals. Signer identities, Ed25519 public keys and
 * roles come from an externally provisioned trust store; the harness only
 * reads it. A store that is missing, malformed, contains private key material
 * or lives where the workflow (or an agent) can write it is not trusted.
 */
import { createHash, createPublicKey, KeyObject, verify } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { ApprovalPolicy } from './policy';

/** Identities that can never sign: forward agents, the runtime itself and automated actors. */
export const AGENT_IDENTITY = /^(F[1-7]|fe-.*|runtime|orchestrator|claude.*|agent.*|bot.*|automation.*)$/i;

export interface Signer {
  signer_id: string;
  display_name: string | null;
  roles: string[];
  key: KeyObject;
  fingerprint: string;
  valid_from: string | null;
  valid_until: string | null;
  revoked: boolean;
  /** Scope selectors the signer may sign for; null = unrestricted. */
  scopes: string[] | null;
}

export interface TrustStore {
  configured: boolean;
  usable: boolean;
  file: string | null;
  origin: 'env' | 'config' | 'none';
  sha256: string | null;
  signers: Map<string, Signer>;
  problems: string[];
}

const norm = (p: string) => path.resolve(p).replace(/\\/g, '/').toLowerCase();

export function keyFingerprint(key: KeyObject): string {
  return createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}

export function loadTrustStore(ctx: RuntimeContext, policy: ApprovalPolicy): TrustStore {
  const fromEnv = policy.trust_store_env ? process.env[policy.trust_store_env] : undefined;
  const file = fromEnv ? path.resolve(fromEnv) : policy.trust_store ? path.resolve(ctx.repoRoot, policy.trust_store) : null;
  const origin: TrustStore['origin'] = fromEnv ? 'env' : policy.trust_store ? 'config' : 'none';
  const ts: TrustStore = { configured: !!file, usable: false, file, origin, sha256: null, signers: new Map(), problems: [] };
  if (!file) {
    ts.problems.push(`no trust store is configured (approval.trust_store is null and ${policy.trust_store_env} is not set)`);
    return ts;
  }
  if (!fs.existsSync(file)) {
    ts.problems.push(`trust store ${file} does not exist`);
    return ts;
  }
  // The trust anchor must not live where the workflow or an agent writes.
  for (const w of [ctx.runsDir, path.join(ctx.repoRoot, 'output')]) {
    if (norm(file) === norm(w) || norm(file).startsWith(norm(w) + '/')) ts.problems.push(`trust store ${file} is inside a workflow- or agent-writable location (${w})`);
  }
  const text = fs.readFileSync(file, 'utf8');
  ts.sha256 = sha256File(file);
  if (/PRIVATE KEY/.test(text)) {
    ts.problems.push('trust store contains private key material; it must hold public keys only');
    return ts;
  }
  let doc: any;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    ts.problems.push(`trust store is not valid JSON: ${(e as Error).message}`);
    return ts;
  }
  const v = ctx.contracts.validate('orchestrator/approval-trust-store', doc);
  if (!v.valid) {
    ts.problems.push(...v.errors.slice(0, 10).map((e) => `trust store contract: ${e}`));
    return ts;
  }
  for (const s of doc.signers as any[]) {
    if (ts.signers.has(s.signer_id)) {
      ts.problems.push(`duplicate signer ${s.signer_id}`);
      continue;
    }
    if (AGENT_IDENTITY.test(s.signer_id)) {
      ts.problems.push(`signer ${s.signer_id} is an agent or automated identity and is ignored`);
      continue;
    }
    let key: KeyObject;
    try {
      key = createPublicKey(s.public_key_pem);
    } catch (e) {
      ts.problems.push(`signer ${s.signer_id}: public key cannot be parsed (${(e as Error).message})`);
      continue;
    }
    if (key.asymmetricKeyType !== 'ed25519') {
      ts.problems.push(`signer ${s.signer_id}: key type ${key.asymmetricKeyType} is not ed25519`);
      continue;
    }
    ts.signers.set(s.signer_id, { signer_id: s.signer_id, display_name: s.display_name ?? null, roles: s.roles, key, fingerprint: keyFingerprint(key), valid_from: s.valid_from ?? null, valid_until: s.valid_until ?? null, revoked: s.revoked === true, scopes: Array.isArray(s.scopes) ? s.scopes : null });
  }
  // A store whose location is unsafe is not usable at all; individual bad signers are just skipped.
  ts.usable = ts.signers.size > 0 && !ts.problems.some((p) => /writable location/.test(p));
  if (!ts.signers.size) ts.problems.push('trust store has no usable signer');
  return ts;
}

export interface SignatureCheck {
  ok: boolean;
  problems: string[];
  signer: Signer | null;
}

/** Verifies an Ed25519 signature by `signerId` over the UTF-8 bytes of `text`, at time `at`, for one of `roles`. */
export function verifySignature(ts: TrustStore, signerId: string, text: string, signatureB64: string, roles: string[], at = new Date()): SignatureCheck {
  const problems: string[] = [];
  if (!ts.usable) return { ok: false, problems: ts.problems.length ? ts.problems : ['trust store is not usable'], signer: null };
  if (AGENT_IDENTITY.test(signerId)) return { ok: false, problems: [`${signerId} is an agent or automated identity; agents cannot approve`], signer: null };
  const s = ts.signers.get(signerId);
  if (!s) return { ok: false, problems: [`signer ${signerId} is not in the trust store`], signer: null };
  if (s.revoked) problems.push(`signer ${signerId} has been revoked`);
  if (s.valid_from && at < new Date(s.valid_from)) problems.push(`signer ${signerId} is not valid before ${s.valid_from}`);
  if (s.valid_until && at > new Date(s.valid_until)) problems.push(`signer ${signerId} expired at ${s.valid_until}`);
  if (roles.length && !roles.some((r) => s.roles.includes(r))) problems.push(`signer ${signerId} (roles ${s.roles.join(', ')}) lacks a required role (${roles.join(' or ')})`);
  let sig: Buffer;
  try {
    sig = Buffer.from(String(signatureB64 ?? ''), 'base64');
  } catch {
    sig = Buffer.alloc(0);
  }
  let valid = false;
  try {
    valid = sig.length === 64 && verify(null, Buffer.from(text, 'utf8'), s.key, sig);
  } catch {
    valid = false;
  }
  if (!valid) problems.push('signature does not verify against the signer public key (tampered content or wrong key)');
  return { ok: problems.length === 0, problems, signer: s };
}

/** True when the signer may sign for `scope` (selector text). Unrestricted signers may sign for any scope. */
export function scopeAllowed(signer: Signer | null, scope: string | null): boolean {
  if (!signer || !signer.scopes) return true;
  if (!scope) return false;
  const norm = (x: string) => x.replace(/\s+/g, '').toUpperCase();
  return signer.scopes.some((s) => norm(s) === norm(scope));
}
