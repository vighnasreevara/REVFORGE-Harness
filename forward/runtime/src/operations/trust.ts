/**
 * Trust provisioning validation (STEP 8). Validates the organisation's
 * externally provisioned trust store (or a candidate file before it is put
 * in place) against everything the runtime will later rely on: location,
 * contract, public-key format and algorithm, known roles, validity windows,
 * revocation, scope restrictions, separation of duties and role coverage. It
 * can also verify a custodian-supplied test signature, proving that a
 * signer's private key (which never enters REVFORGE) matches the trusted
 * public key. It never creates, modifies or trusts a signer.
 */
import { createPublicKey, verify } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { loadPolicy } from '../approval/policy';
import { AGENT_IDENTITY, keyFingerprint, loadTrustStore } from '../approval/trust';
import { DESIGN_POLICY } from '../design/approvals';
import { loadOpenAIConfig } from '../openai/config';

export interface Check {
  id: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

export interface RoleNeed {
  role: string;
  used_for: string[];
}

/** Every role the runtime's policies require, with what it authorises. Read from the policies, never hardcoded per scope. */
export function requiredRoles(ctx: RuntimeContext): RoleNeed[] {
  const p = loadPolicy(ctx);
  const m = new Map<string, Set<string>>();
  const add = (role: string, use: string) => (m.get(role) ?? m.set(role, new Set()).get(role)!).add(use);
  for (const r of p.roles.requirements_approval) add(r, 'G2 requirements approval');
  for (const r of p.roles.exception) add(r, 'approved_exception decision outcomes');
  for (const [kind, roles] of Object.entries(p.roles.decision)) for (const r of roles) add(r, `${kind} decision resolutions`);
  for (const r of DESIGN_POLICY.G3.approver_roles) add(r, 'G3 architecture approval');
  for (const r of DESIGN_POLICY.G3.co_approval_roles_when_behavior_change) add(r, 'G3 co-approval when legacy behaviour changes');
  for (const r of loadOpenAIConfig(ctx).config.source_export.required_roles) add(r, 'OpenAI source-export authorization');
  for (const r of DISCLOSURE_ROLES) add(r, 'provider-specific AI disclosure authorization (Claude / BMad and others)');
  return [...m.entries()].map(([role, u]) => ({ role, used_for: [...u].sort() })).sort((a, b) => (a.role < b.role ? -1 : 1));
}
export const DISCLOSURE_ROLES = ['data_owner'];

/** Roles that must not be held by the same signer, because one would review what the other approves. */
const CONFLICTS: Array<[string, string, string]> = [
  ['requirements_approver', 'business_sme', 'a requirements approver should not also resolve the business decisions inside the scope they approve'],
  ['requirements_approver', 'architecture_approver', 'requirements and architecture approval should be held by different people'],
];

const norm = (p: string) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
const within = (p: string, dir: string) => norm(p) === norm(dir) || norm(p).startsWith(norm(dir).replace(/\/+$/, '') + '/');

export interface TrustDoctor {
  status: 'TRUST_NOT_CONFIGURED' | 'TRUST_INVALID' | 'TRUST_INCOMPLETE' | 'TRUST_CONFIGURED';
  file: string | null;
  sha256: string | null;
  checks: Check[];
  signers: Array<{ signer_id: string; roles: string[]; fingerprint: string | null; valid_from: string | null; valid_until: string | null; revoked: boolean; scopes: string[] | null; usable: boolean; problems: string[] }>;
  roles: Array<RoleNeed & { signers: string[]; covered: boolean }>;
}

/**
 * Validates the configured trust store, or `candidate` (a file the custodian
 * intends to install) when given. `at` is the evaluation time.
 */
export function trustDoctor(ctx: RuntimeContext, candidate?: string, at = new Date()): TrustDoctor {
  const policy = loadPolicy(ctx);
  const effective = candidate ? { ...policy, trust_store: path.resolve(candidate), trust_store_env: '__REVFORGE_NO_ENV__' } : policy;
  const ts = loadTrustStore(ctx, effective);
  const checks: Check[] = [];
  const add = (id: string, status: Check['status'], detail: string) => checks.push({ id, status, detail });
  const needs = requiredRoles(ctx);
  const out: TrustDoctor = { status: 'TRUST_NOT_CONFIGURED', file: ts.file, sha256: ts.sha256, checks, signers: [], roles: needs.map((n) => ({ ...n, signers: [], covered: false })) };
  if (!ts.configured) {
    add('configured', 'fail', `TRUST_NOT_CONFIGURED: ${ts.problems.join('; ')}`);
    return out;
  }
  add('configured', 'pass', `${ts.origin === 'env' ? `env ${policy.trust_store_env}` : candidate ? 'candidate file' : 'config approval.trust_store'} -> ${ts.file}`);
  if (!fs.existsSync(ts.file!)) {
    add('exists', 'fail', `${ts.file} does not exist`);
    out.status = 'TRUST_INVALID';
    return out;
  }
  // Location: never where the workflow, agents or reverse harness write; outside the repository is preferred.
  const writable = [ctx.runsDir, path.join(ctx.repoRoot, 'output'), path.join(ctx.repoRoot, '.claude'), path.join(ctx.forwardDir, 'integrations')].filter((w) => within(ts.file!, w));
  add('location', writable.length ? 'fail' : within(ts.file!, ctx.repoRoot) ? 'warn' : 'pass', writable.length ? `inside a workflow- or agent-writable location (${writable.join(', ')})` : within(ts.file!, ctx.repoRoot) ? 'inside the repository: allowed, but a location outside the repository, read-only for the operator account, is recommended' : 'outside the repository');
  const text = fs.readFileSync(ts.file!, 'utf8');
  add('no_private_keys', /PRIVATE KEY/.test(text) ? 'fail' : 'pass', /PRIVATE KEY/.test(text) ? 'the file contains private key material; it must hold public keys only' : 'public keys only');
  let doc: any = null;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    add('json', 'fail', `not valid JSON: ${(e as Error).message}`);
  }
  if (doc) {
    const v = ctx.contracts.validate('orchestrator/approval-trust-store', doc);
    add('contract', v.valid ? 'pass' : 'fail', v.valid ? 'orchestrator/approval-trust-store valid' : v.errors.slice(0, 5).join('; '));
  }
  const known = new Set(needs.map((n) => n.role));
  const fps = new Map<string, string>();
  for (const s of (doc?.signers ?? []) as any[]) {
    const problems: string[] = [];
    let fp: string | null = null;
    if (AGENT_IDENTITY.test(s.signer_id)) problems.push('agent or automated identity: ignored');
    try {
      const k = createPublicKey(s.public_key_pem);
      if (k.asymmetricKeyType !== 'ed25519') problems.push(`key type ${k.asymmetricKeyType} is not ed25519`);
      else fp = keyFingerprint(k);
    } catch (e) {
      problems.push(`public key cannot be parsed (${(e as Error).message.split('\n')[0]})`);
    }
    if (fp && fps.has(fp)) problems.push(`same public key as ${fps.get(fp)}: one key must belong to one identity`);
    if (fp) fps.set(fp, s.signer_id);
    const unknown = (s.roles ?? []).filter((r: string) => !known.has(r));
    if (unknown.length) problems.push(`unknown role(s) ${unknown.join(', ')} (not used by any policy)`);
    if (s.valid_from && at < new Date(s.valid_from)) problems.push(`not valid before ${s.valid_from}`);
    if (s.valid_until && at > new Date(s.valid_until)) problems.push(`expired at ${s.valid_until}`);
    if (!s.valid_until) problems.push('no valid_until: signing authority should expire and be renewed');
    if (s.revoked === true) problems.push(`revoked${s.revoked_at ? ` at ${s.revoked_at}` : ''}`);
    for (const [a, b, why] of CONFLICTS) if (s.roles?.includes(a) && s.roles?.includes(b)) problems.push(`holds ${a} and ${b}: ${why}`);
    const loaded = ts.signers.get(s.signer_id);
    const fatal = problems.filter((p) => !/no valid_until|holds /.test(p));
    const usable = !!loaded && !fatal.length;
    out.signers.push({ signer_id: s.signer_id, roles: s.roles ?? [], fingerprint: fp, valid_from: s.valid_from ?? null, valid_until: s.valid_until ?? null, revoked: s.revoked === true, scopes: Array.isArray(s.scopes) ? s.scopes : null, usable, problems });
  }
  for (const s of out.signers) add(`signer:${s.signer_id}`, !s.usable ? 'fail' : s.problems.length ? 'warn' : 'pass', s.problems.length ? s.problems.join('; ') : `ed25519 key ${String(s.fingerprint).slice(0, 16)}…, roles ${s.roles.join(', ')}${s.scopes ? `, scopes ${s.scopes.join(', ')}` : ''}`);
  for (const r of out.roles) {
    r.signers = out.signers.filter((s) => s.usable && s.roles.includes(r.role)).map((s) => s.signer_id);
    r.covered = r.signers.length > 0;
  }
  const missing = out.roles.filter((r) => !r.covered);
  add('role_coverage', missing.length ? 'fail' : 'pass', missing.length ? `no usable signer for ${missing.map((r) => r.role).join(', ')}` : 'every policy role has a usable signer');
  add('separation_of_duties', 'pass', 'enforced at signing time: requesters, authoring agents and automated identities can never approve; conflicting role combinations are flagged per signer above');
  add('algorithm', 'pass', 'Ed25519 signatures over canonical JSON (the only supported algorithm)');
  const invalid = checks.some((c) => c.status === 'fail' && ['exists', 'location', 'no_private_keys', 'json', 'contract'].includes(c.id)) || !out.signers.some((s) => s.usable);
  out.status = invalid ? 'TRUST_INVALID' : missing.length ? 'TRUST_INCOMPLETE' : 'TRUST_CONFIGURED';
  return out;
}

/**
 * Verifies a test signature produced by the custodian with the signer's
 * private key outside REVFORGE over `message` (the exact bytes of a file).
 */
export function verifyTestSignature(ctx: RuntimeContext, signerId: string, messageFile: string, signatureB64: string, candidate?: string): Check[] {
  const d = trustDoctor(ctx, candidate);
  const checks: Check[] = [];
  const s = d.signers.find((x) => x.signer_id === signerId);
  if (!s) return [{ id: 'signer', status: 'fail', detail: `${signerId} is not in the trust store (${d.status})` }];
  checks.push({ id: 'signer', status: s.usable ? 'pass' : 'fail', detail: s.usable ? `${signerId} is usable` : s.problems.join('; ') });
  const doc = JSON.parse(fs.readFileSync(d.file!, 'utf8'));
  const pem = doc.signers.find((x: any) => x.signer_id === signerId).public_key_pem;
  let ok = false;
  try {
    const sig = Buffer.from(signatureB64, 'base64');
    ok = sig.length === 64 && verify(null, fs.readFileSync(messageFile), createPublicKey(pem), sig);
  } catch {
    ok = false;
  }
  checks.push({ id: 'signature', status: ok ? 'pass' : 'fail', detail: ok ? `Ed25519 signature over ${path.basename(messageFile)} (sha256 ${String(sha256File(messageFile)).slice(0, 16)}…) verifies with the trusted key` : 'signature does not verify with the trusted public key' });
  return checks;
}
