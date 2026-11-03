/**
 * Provider-specific AI disclosure authorization (STEP 8). A data owner signs
 * (Ed25519, external trust store) an authorization to disclose exactly the
 * listed source files (by sha256) of one scope to one provider and service,
 * for listed workflows, purpose, classification and limits, inside a
 * validity window. It authorizes nothing else:
 *   - another provider or service (an OpenAI source-export authorization is
 *     a different contract, bound to provider 'openai', and is never read
 *     here; this authorization is never read by the OpenAI egress path);
 *   - another scope, file, file version or workflow;
 *   - anything after expiry or revocation.
 * An API key or an active Claude Code login is not an authorization.
 */
import * as fs from 'fs';
import * as path from 'path';
import { canonicalize, digest } from '../approval/canonical';
import { evaluateScope, parseSelector } from '../approval/scope';
import { buildSnapshot, Snapshot } from '../approval/snapshot';
import { AGENT_IDENTITY, scopeAllowed, verifySignature } from '../approval/trust';
import { sha256File } from '../core/fsutil';
import { mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { DISCLOSURE_ROLES } from '../operations/trust';

export const DISCLOSURE_DIR = 'authorizations/disclosure';
export const PROVIDERS: Record<string, { services: string[]; endpoint_hosts: string[] }> = {
  anthropic: { services: ['claude-code-cli'], endpoint_hosts: ['api.anthropic.com'] },
  openai: { services: ['responses-api'], endpoint_hosts: ['api.openai.com'] },
};

export interface PrepareOptions {
  provider: string;
  service: string;
  scope: string;
  workflows: string[];
  models: string[];
  modelMode?: 'exact' | 'class';
  purpose: string;
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  files?: string[];
  ttlHours?: number;
  limits?: { max_files?: number; max_bytes?: number; max_cost_usd?: number; max_runs?: number };
}

/** Source files of a scope's units (primary and dependencies), with their current hashes. */
export function scopeSourceFiles(snap: Snapshot, scope: string): Array<{ file_id: string; path: string; sha256: string; bytes: number }> {
  const ev = evaluateScope(snap, parseSelector(scope));
  const out: Array<{ file_id: string; path: string; sha256: string; bytes: number }> = [];
  for (const u of ev.units) {
    const rel = snap.ctx.relByFile.get(u.file_id);
    if (!rel || !snap.ctx.srcRoot) continue;
    const abs = path.join(snap.ctx.srcRoot, rel);
    const h = sha256File(abs);
    if (h) out.push({ file_id: u.file_id, path: rel, sha256: h, bytes: fs.statSync(abs).size });
  }
  return out.sort((a, b) => (a.path < b.path ? -1 : 1));
}

export const authorizationIdOf = (a: any) => `ADA-${digest({ ...a, authorization_id: undefined, signer_id: undefined, role: undefined, signed_at: undefined }).slice(0, 12)}`;

/** Unsigned authorization for a data owner to review and sign outside REVFORGE. */
export function prepareDisclosure(wf: Workflow, o: PrepareOptions): any {
  const snap = buildSnapshot(wf);
  const p = PROVIDERS[o.provider];
  if (!p) throw new OrchestratorError(`unknown provider ${o.provider} (known: ${Object.keys(PROVIDERS).join(', ')})`, 'USAGE');
  if (!p.services.includes(o.service)) throw new OrchestratorError(`service ${o.service} is not a service of ${o.provider} (${p.services.join(', ')})`, 'USAGE');
  const ev = evaluateScope(snap, parseSelector(o.scope));
  const all = scopeSourceFiles(snap, ev.selector_text);
  const files = o.files?.length ? all.filter((f) => o.files!.includes(f.path) || o.files!.includes(f.file_id)) : all;
  const unknown = (o.files ?? []).filter((x) => !all.some((f) => f.path === x || f.file_id === x));
  if (unknown.length) throw new OrchestratorError(`files outside scope ${ev.selector_text}: ${unknown.join(', ')}`, 'USAGE');
  const now = new Date();
  const a: any = {
    contract: 'ai-disclosure-authorization',
    contract_version: '1.0',
    authorization_id: '',
    workflow_id: wf.state.workflow_id,
    run_id: wf.run.runId,
    baseline_manifest_sha256: wf.run.manifestSha256,
    provider: { name: o.provider, service: o.service, endpoint_host: p.endpoint_hosts[0] },
    models: { mode: o.modelMode ?? 'exact', values: o.models },
    scope: { selector_text: ev.selector_text, scope_sha256: ev.scope_sha256 },
    source_files: files.map((f) => ({ file_id: f.file_id, path: f.path, sha256: f.sha256 })),
    data_classification: o.classification,
    purpose: o.purpose,
    workflows: o.workflows,
    limits: { max_files: o.limits?.max_files ?? files.length, max_bytes: o.limits?.max_bytes ?? files.reduce((n, f) => n + f.bytes, 0), max_cost_usd: o.limits?.max_cost_usd ?? 5, max_runs: o.limits?.max_runs ?? 1 },
    not_before: now.toISOString(),
    expires_at: new Date(now.getTime() + (o.ttlHours ?? 72) * 3600000).toISOString(),
    prepared_at: now.toISOString(),
    signer_id: '',
    role: '',
    signed_at: '',
  };
  a.authorization_id = authorizationIdOf(a);
  const v = wf.run.ctx.contracts.validate('orchestrator/ai-disclosure-authorization', a);
  if (!v.valid) throw new OrchestratorError('disclosure authorization violates its contract', 'CONTRACT', v.errors);
  return a;
}

export function disclosureRecords(wf: Workflow): any[] {
  return wf.store.list(DISCLOSURE_DIR).filter((f) => f.startsWith('DAU-')).map((f) => wf.store.readRecord(DISCLOSURE_DIR, f));
}
export function disclosureRevocations(wf: Workflow): any[] {
  return wf.store.list(`${DISCLOSURE_DIR}/revocations`).map((f) => wf.store.readRecord(`${DISCLOSURE_DIR}/revocations`, f));
}
function sealedHash(wf: Workflow, recordId: string): string | null {
  let h: string | null = null;
  for (const e of wf.store.readAudit()) if (e.event === 'disclosure_authorized' && (e.data as any).record_id === recordId) h = (e.data as any).sha256;
  return h;
}

/** Verifies a signed disclosure authorization against current content. `existing` re-verifies an imported record. */
export function verifyDisclosure(wf: Workflow, snap: Snapshot, signed: any, opts: { existing?: any } = {}): { ok: boolean; checks: Array<{ id: string; ok: boolean; detail: string }> } {
  const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const v = wf.run.ctx.contracts.validate('orchestrator/signed-ai-disclosure-authorization', signed);
  add('contract', v.valid, v.valid ? 'signed AI disclosure authorization satisfies its contract' : v.errors.slice(0, 5).join('; '));
  if (!v.valid) return { ok: false, checks };
  const a = signed.authorization;
  const prov = PROVIDERS[a.provider.name];
  add('provider', !!prov && prov.services.includes(a.provider.service) && prov.endpoint_hosts.includes(a.provider.endpoint_host), prov ? `${a.provider.name} / ${a.provider.service} at ${a.provider.endpoint_host}` : `unknown provider ${a.provider.name}`);
  add('content_id', a.authorization_id === authorizationIdOf(a), a.authorization_id === authorizationIdOf(a) ? `${a.authorization_id} matches the authorized content` : 'authorization_id does not match its content (altered after preparation)');
  add('workflow_binding', a.workflow_id === wf.state.workflow_id && a.run_id === wf.run.runId && a.baseline_manifest_sha256 === wf.run.manifestSha256 && snap.g0.status === 'PASS', a.baseline_manifest_sha256 === wf.run.manifestSha256 ? `bound to ${a.run_id} on the current baseline (G0 ${snap.g0.status})` : 'bound to another workflow, run or baseline');
  const sig = verifySignature(snap.trust, a.signer_id, canonicalize(a), signed.signature.value, DISCLOSURE_ROLES, snap.at);
  add('trust_anchor', snap.trust.usable, snap.trust.usable ? 'trust store usable' : snap.trust.problems.join('; ') || 'TRUST_NOT_CONFIGURED');
  add('signature', sig.ok, sig.ok ? `Ed25519 signature by ${a.signer_id} (${a.role}) verified` : sig.problems.join('; '));
  add('role', DISCLOSURE_ROLES.includes(a.role) && !!sig.signer?.roles.includes(a.role), DISCLOSURE_ROLES.includes(a.role) ? `role ${a.role}` : `role ${a.role} cannot authorize disclosure (needs ${DISCLOSURE_ROLES.join(' or ')})`);
  add('not_agent', !AGENT_IDENTITY.test(a.signer_id), AGENT_IDENTITY.test(a.signer_id) ? `${a.signer_id} is an automated identity` : 'human signer');
  add('signer_scope', scopeAllowed(sig.signer, a.scope.selector_text), scopeAllowed(sig.signer, a.scope.selector_text) ? 'signer may sign for this scope' : `signer is restricted to ${sig.signer!.scopes!.join(', ')}`);
  const t = snap.at.getTime();
  const window = t >= Date.parse(a.not_before) - 600000 && t <= Date.parse(a.expires_at);
  add('validity_window', window, window ? `valid ${a.not_before} .. ${a.expires_at}` : `outside its validity window (${a.not_before} .. ${a.expires_at})`);
  let scopeOk = false;
  let scopeDetail = '';
  try {
    const ev = evaluateScope(snap, parseSelector(a.scope.selector_text));
    scopeOk = ev.scope_sha256 === a.scope.scope_sha256;
    scopeDetail = scopeOk ? `scope ${ev.selector_text} unchanged` : `scope ${ev.selector_text} content changed since authorization`;
  } catch (e) {
    scopeDetail = (e as Error).message;
  }
  add('scope_current', scopeOk, scopeDetail);
  const inScope = new Map(scopeSourceFiles(snap, a.scope.selector_text).map((f) => [f.path, f]));
  const outside = a.source_files.filter((f: any) => !inScope.has(f.path));
  const changed = a.source_files.filter((f: any) => inScope.has(f.path) && inScope.get(f.path)!.sha256 !== f.sha256);
  add('source_files', !outside.length && !changed.length && a.source_files.length <= a.limits.max_files, outside.length ? `files outside the scope: ${outside.map((f: any) => f.path).join(', ')}` : changed.length ? `source changed since authorization: ${changed.map((f: any) => f.path).join(', ')}` : `${a.source_files.length} file(s), exact hashes current`);
  const revoked = disclosureRevocations(wf).find((r) => r.authorization_id === a.authorization_id);
  add('not_revoked', !revoked, revoked ? `revoked by ${revoked.revocation.signer_id} at ${revoked.revocation.revoked_at}: ${revoked.revocation.reason}` : 'not revoked');
  if (!opts.existing) {
    const used = disclosureRecords(wf).find((r) => r.authorization_id === a.authorization_id || r.signature?.value === signed.signature.value);
    add('not_replayed', !used, used ? `${used.record_id} already recorded this authorization` : 'first import');
  } else {
    const ok = sealedHash(wf, opts.existing.record_id) === sha256File(wf.store.p(DISCLOSURE_DIR, `${opts.existing.record_id}.json`));
    add('record_intact', ok, ok ? `${opts.existing.record_id} matches its sealed hash` : `${opts.existing.record_id} was altered after import`);
  }
  return { ok: checks.every((c) => c.ok), checks };
}

const readSigned = (file: string) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new OrchestratorError(`cannot read ${file}: ${(e as Error).message}`, 'USAGE');
  }
};

export function importDisclosure(wf: Workflow, file: string): any {
  return mutate(wf, 'disclosure import', () => {
    const signed = readSigned(file);
    const snap = buildSnapshot(wf);
    const r = verifyDisclosure(wf, snap, signed);
    if (!r.ok) {
      wf.store.append('disclosure_authorization_rejected', { authorization_id: signed?.authorization?.authorization_id ?? null, provider: signed?.authorization?.provider?.name ?? null, file_sha256: sha256File(file), problems: r.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`) });
      wf.store.writeState(wf.state);
      return { imported: false, checks: r.checks };
    }
    const id = `DAU-${String(disclosureRecords(wf).length + 1).padStart(4, '0')}`;
    const a = signed.authorization;
    const sig = verifySignature(snap.trust, a.signer_id, canonicalize(a), signed.signature.value, [], snap.at);
    const rec = { contract: 'ai-disclosure-record', contract_version: '1.0', record_id: id, authorization_id: a.authorization_id, recorded_at: new Date().toISOString(), recorded_by: 'runtime', provider: a.provider.name, service: a.provider.service, scope: a.scope.selector_text, signer: { signer_id: a.signer_id, role: a.role, key_fingerprint: sig.signer!.fingerprint }, trust_store_sha256: snap.trust.sha256!, authorization: a, signature: signed.signature, verification: { checks: r.checks } };
    const v = wf.run.ctx.contracts.validate('orchestrator/ai-disclosure-record', rec);
    if (!v.valid) throw new OrchestratorError('disclosure record violates its contract', 'CONTRACT', v.errors);
    const f = wf.store.writeRecord(DISCLOSURE_DIR, `${id}.json`, rec);
    wf.store.append('disclosure_authorized', { record_id: id, authorization_id: a.authorization_id, provider: a.provider.name, service: a.provider.service, scope: a.scope.selector_text, expires_at: a.expires_at, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { imported: true, record_id: id, authorization_id: a.authorization_id, checks: r.checks };
  });
}

export function revokeDisclosure(wf: Workflow, file: string): any {
  return mutate(wf, 'disclosure revoke', () => {
    const signed = readSigned(file);
    const snap = buildSnapshot(wf);
    const v = wf.run.ctx.contracts.validate('orchestrator/signed-ai-disclosure-revocation', signed);
    const checks: Array<{ id: string; ok: boolean; detail: string }> = [{ id: 'contract', ok: v.valid, detail: v.valid ? 'valid' : v.errors.join('; ') }];
    if (v.valid) {
      const r = signed.revocation;
      const sig = verifySignature(snap.trust, r.signer_id, canonicalize(r), signed.signature.value, DISCLOSURE_ROLES, snap.at);
      checks.push({ id: 'signature', ok: sig.ok && DISCLOSURE_ROLES.includes(r.role), detail: sig.ok ? `signed by ${r.signer_id}` : sig.problems.join('; ') });
      checks.push({ id: 'authorization_exists', ok: disclosureRecords(wf).some((x) => x.authorization_id === r.authorization_id), detail: r.authorization_id });
    }
    if (!checks.every((c) => c.ok)) {
      wf.store.append('disclosure_revocation_rejected', { file_sha256: sha256File(file), problems: checks.filter((c) => !c.ok).map((c) => c.detail) });
      wf.store.writeState(wf.state);
      return { revoked: false, checks };
    }
    const n = wf.store.list(`${DISCLOSURE_DIR}/revocations`).length + 1;
    const id = `DRV-${String(n).padStart(4, '0')}`;
    const f = wf.store.writeRecord(`${DISCLOSURE_DIR}/revocations`, `${id}.json`, { record_id: id, authorization_id: signed.revocation.authorization_id, recorded_at: new Date().toISOString(), revocation: signed.revocation, signature: signed.signature });
    wf.store.append('disclosure_revoked', { record_id: id, authorization_id: signed.revocation.authorization_id, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { revoked: true, record_id: id, checks };
  });
}

/** Valid authorizations (re-verified now) covering this provider, service, scope and workflow. */
export function disclosureStatus(wf: Workflow, q: { provider: string; service: string; scope?: string; workflow?: string }, snap: Snapshot = buildSnapshot(wf)): { valid: any[]; rejected: Array<{ record_id: string; reasons: string[] }>; considered: number } {
  const valid: any[] = [];
  const rejected: Array<{ record_id: string; reasons: string[] }> = [];
  const recs = disclosureRecords(wf);
  for (const r of recs) {
    const a = r.authorization;
    const reasons: string[] = [];
    if (a.provider.name !== q.provider || a.provider.service !== q.service) reasons.push(`authorizes ${a.provider.name}/${a.provider.service}, not ${q.provider}/${q.service}`);
    if (q.scope && a.scope.selector_text !== q.scope) reasons.push(`authorizes scope ${a.scope.selector_text}, not ${q.scope}`);
    if (q.workflow && !a.workflows.includes(q.workflow)) reasons.push(`does not authorize workflow ${q.workflow}`);
    const v = verifyDisclosure(wf, snap, { contract: 'signed-ai-disclosure-authorization', authorization: a, signature: r.signature }, { existing: r });
    reasons.push(...v.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`));
    if (reasons.length) rejected.push({ record_id: r.record_id, reasons });
    else valid.push(r);
  }
  return { valid, rejected, considered: recs.length };
}
