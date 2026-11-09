/**
 * Source-export authorization: the only thing that can permit COBOL source
 * or derived confidential analysis to leave this machine. It is signed
 * (Ed25519) by a data owner whose key and role are in the externally
 * provisioned trust store, and bound to the baseline, the exact files and
 * hashes, the packets, the destination, the model(s), the purpose, the data
 * classification, the passes, the disclosure level, size limits and an
 * expiry. Requirements approval (G1) is a different authority and never
 * implies export.
 *
 * evaluateEgress() is called on the final bytes of every outgoing request
 * attempt, so a retry or a changed file is re-checked every time.
 */
import * as fs from 'fs';
import * as path from 'path';
import { canonicalize, digest } from '../approval/canonical';
import { loadPolicy } from '../approval/policy';
import { loadTrustStore, TrustStore, verifySignature } from '../approval/trust';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { apiKey, apiKeyPresent, Mode, OpenAIConfig } from './config';

export const AUTH_DIR = 'authorizations';

export interface Check {
  id: string;
  ok: boolean;
  detail: string;
}

function sealed(wf: Workflow, event: string, key: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of wf.store.readAudit()) if (e.event === event) m.set((e.data as any)[key], (e.data as any).sha256);
  return m;
}

export function authorizationRecords(wf: Workflow): any[] {
  return wf.store.list(AUTH_DIR).filter((f) => f.startsWith('EXPORT-')).map((f) => ({ file: f, ...wf.store.readRecord(AUTH_DIR, f) }));
}
export function revocationRecords(wf: Workflow): any[] {
  return wf.store.list(AUTH_DIR).filter((f) => f.startsWith('REVOKE-')).map((f) => ({ file: f, ...wf.store.readRecord(AUTH_DIR, f) }));
}

/** Verifies a signed authorization (or revocation) against the current trust store. */
function verifySigned(trust: TrustStore, payload: any, sig: string, roles: string[], at: Date): Check[] {
  const s = verifySignature(trust, payload.signer_id, canonicalize(payload), sig, roles, at);
  return [
    { id: 'trust_anchor', ok: trust.usable, detail: trust.usable ? `trust store ${String(trust.sha256).slice(0, 16)}…` : trust.problems.join('; ') || 'no usable trust anchor' },
    { id: 'signature', ok: s.ok && !!s.signer?.roles.includes(payload.role), detail: s.ok ? (s.signer!.roles.includes(payload.role) ? `Ed25519 signature by ${payload.signer_id} (${payload.role}) verified` : `signer does not hold role ${payload.role}`) : s.problems.join('; ') },
    { id: 'role', ok: roles.includes(payload.role), detail: roles.includes(payload.role) ? `role ${payload.role} may authorize source export` : `role ${payload.role} cannot authorize source export (needs ${roles.join(' or ')})` },
  ];
}

export interface AuthorizationState {
  authorization_id: string;
  record: string;
  valid: boolean;
  checks: Check[];
  authorization: any;
}

/** Re-verifies every imported authorization now (signature, seal, baseline, validity window, revocation). */
export function authorizationStates(wf: Workflow, cfg: OpenAIConfig, at = new Date()): { trust: TrustStore; states: AuthorizationState[] } {
  const ctx = wf.run.ctx;
  const trust = loadTrustStore(ctx, loadPolicy(ctx));
  const seals = sealed(wf, 'source_export_authorized', 'record');
  const revSeals = sealed(wf, 'source_export_revoked', 'record');
  const revoked = new Map<string, string>();
  for (const r of revocationRecords(wf)) {
    const ok = revSeals.get(r.file) === sha256File(wf.store.p(AUTH_DIR, r.file)) && verifySigned(trust, r.revocation, r.signature.value, cfg.source_export.required_roles, at).every((c) => c.ok);
    if (ok) revoked.set(r.revocation.authorization_id, `${r.file}: ${r.revocation.reason}`);
  }
  const states = authorizationRecords(wf).map((r) => {
    const a = r.authorization;
    const checks: Check[] = [
      { id: 'record_intact', ok: seals.get(r.file) === sha256File(wf.store.p(AUTH_DIR, r.file)), detail: seals.get(r.file) === sha256File(wf.store.p(AUTH_DIR, r.file)) ? `${r.file} matches its audit seal` : `${r.file} was altered after import` },
      ...verifySigned(trust, a, r.signature.value, cfg.source_export.required_roles, at),
      { id: 'baseline', ok: a.baseline_manifest_sha256 === wf.run.manifestSha256 && a.run_id === wf.run.runId && a.workflow_id === wf.state.workflow_id, detail: a.baseline_manifest_sha256 === wf.run.manifestSha256 ? 'bound to the current baseline' : 'bound to a different baseline' },
      { id: 'validity_window', ok: at >= new Date(a.not_before) && at <= new Date(a.expires_at), detail: at > new Date(a.expires_at) ? `expired at ${a.expires_at}` : at < new Date(a.not_before) ? `not valid before ${a.not_before}` : `valid until ${a.expires_at}` },
      { id: 'not_revoked', ok: !revoked.has(a.authorization_id), detail: revoked.has(a.authorization_id) ? `revoked (${revoked.get(a.authorization_id)})` : 'not revoked' },
    ];
    return { authorization_id: a.authorization_id, record: r.file, valid: checks.every((c) => c.ok), checks, authorization: a };
  });
  return { trust, states };
}

function readJsonFile(file: string): any {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new OrchestratorError(`cannot read ${file}: ${(e as Error).message}`, 'USAGE');
  }
}

/** Imports a signed source-export authorization after verification; invalid ones are rejected and audited. */
export function importAuthorization(wf: Workflow, cfg: OpenAIConfig, file: string): { imported: boolean; record: string | null; checks: Check[] } {
  return mutate(wf, 'openai authorize', () => {
    const signed = readJsonFile(file);
    const v = wf.run.ctx.contracts.validate('orchestrator/signed-source-export-authorization', signed);
    const checks: Check[] = [{ id: 'contract', ok: v.valid, detail: v.valid ? 'satisfies its contract' : v.errors.slice(0, 5).join('; ') }];
    if (v.valid) {
      const a = signed.authorization;
      const trust = loadTrustStore(wf.run.ctx, loadPolicy(wf.run.ctx));
      checks.push(...verifySigned(trust, a, signed.signature.value, cfg.source_export.required_roles, new Date()));
      checks.push({ id: 'baseline', ok: a.baseline_manifest_sha256 === wf.run.manifestSha256 && a.run_id === wf.run.runId && a.workflow_id === wf.state.workflow_id, detail: 'must bind the current workflow, run and baseline' });
      checks.push({ id: 'validity_window', ok: new Date() <= new Date(a.expires_at) && new Date(a.not_before) < new Date(a.expires_at), detail: `not_before ${a.not_before}, expires ${a.expires_at}` });
      checks.push({ id: 'unique', ok: !authorizationRecords(wf).some((r) => r.authorization.authorization_id === a.authorization_id || r.signature.value === signed.signature.value), detail: 'authorization ID and signature not previously imported' });
    }
    if (!checks.every((c) => c.ok)) {
      wf.store.append('source_export_authorization_rejected', { file_sha256: sha256File(file), problems: checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`) });
      wf.store.writeState(wf.state);
      return { imported: false, record: null, checks };
    }
    const n = authorizationRecords(wf).length + 1;
    const name = `EXPORT-${String(n).padStart(4, '0')}.json`;
    const f = wf.store.writeRecord(AUTH_DIR, name, { contract: 'source-export-authorization-record', recorded_at: new Date().toISOString(), recorded_by: 'runtime', authorization: signed.authorization, signature: signed.signature, verification: { checks } });
    wf.store.append('source_export_authorized', { record: name, authorization_id: signed.authorization.authorization_id, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { imported: true, record: name, checks };
  });
}

export function importRevocation(wf: Workflow, cfg: OpenAIConfig, file: string): { imported: boolean; record: string | null; checks: Check[] } {
  return mutate(wf, 'openai revoke', () => {
    const signed = readJsonFile(file);
    const v = wf.run.ctx.contracts.validate('orchestrator/signed-source-export-revocation', signed);
    const checks: Check[] = [{ id: 'contract', ok: v.valid, detail: v.valid ? 'satisfies its contract' : v.errors.slice(0, 5).join('; ') }];
    if (v.valid) {
      const trust = loadTrustStore(wf.run.ctx, loadPolicy(wf.run.ctx));
      checks.push(...verifySigned(trust, signed.revocation, signed.signature.value, cfg.source_export.required_roles, new Date()));
    }
    if (!checks.every((c) => c.ok)) {
      wf.store.append('source_export_revocation_rejected', { problems: checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`) });
      wf.store.writeState(wf.state);
      return { imported: false, record: null, checks };
    }
    const name = `REVOKE-${String(revocationRecords(wf).length + 1).padStart(4, '0')}.json`;
    const f = wf.store.writeRecord(AUTH_DIR, name, { contract: 'source-export-revocation-record', recorded_at: new Date().toISOString(), revocation: signed.revocation, signature: signed.signature });
    wf.store.append('source_export_revoked', { record: name, authorization_id: signed.revocation.authorization_id, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { imported: true, record: name, checks };
  });
}

/* ------------------------------------------------------------------ */
/* egress evaluation of one outgoing request                          */
/* ------------------------------------------------------------------ */

export interface OutgoingRequest {
  url: string;
  model: string;
  instructions: string;
  packet_id: string;
  pass: 'A' | 'B';
  data: any; // the parsed DATA block actually being sent
  payload_text: string; // the exact serialized request body
}

export interface EgressEvaluation {
  evaluated_at: string;
  allowed: boolean;
  mode: Mode;
  packet_id: string;
  pass: 'A' | 'B';
  payload_sha256: string;
  authorization_id: string | null;
  checks: Check[];
}

/** A payload line equals the source line, or the source line with one quoted literal replaced by '<REDACTED>'. */
function sameLine(real: string | undefined, sent: string): boolean {
  if (real === undefined) return false;
  if (real === sent) return true;
  if (!sent.includes("'<REDACTED>'")) return false;
  const [pre, post] = sent.split("'<REDACTED>'", 2);
  return real.startsWith(pre) && real.endsWith(post) && /^'[^']*'$/.test(real.slice(pre.length, real.length - post.length));
}

const SECRET_MARKERS = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bsk-[A-Za-z0-9_-]{16,}\b/, /NEO4J_PASSWORD/i, /"mcpServers"/];

/** Safe absolute path of a source file inside the configured root (no traversal, no symlink escape). */
export function safeSourcePath(ctx: RuntimeContext, rel: string): string | null {
  if (!ctx.sourceRoot || !rel || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) return null;
  const root = fs.realpathSync(ctx.sourceRoot);
  const abs = path.resolve(root, rel);
  if (!fs.existsSync(abs)) return null;
  const real = fs.realpathSync(abs);
  const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
  return norm(real).startsWith(norm(root) + '/') ? real : null;
}

/**
 * Decides whether the exact outgoing request may leave the machine. Every
 * excerpt line in the payload must be the current text of an authorized file
 * whose hash is unchanged; nothing else from the source may be present.
 */
export function evaluateEgress(wf: Workflow, cfg: OpenAIConfig, mode: Mode, req: OutgoingRequest, priorLiveRequests: (authorizationId: string) => number, at = new Date()): EgressEvaluation {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  add('mode_live', mode === 'LIVE', mode === 'LIVE' ? 'LIVE mode' : `mode ${mode} never transmits`);
  add('network_enabled', cfg.network_enabled, cfg.network_enabled ? 'network enabled in configuration' : 'openai_verification.network_enabled is false (disabled by default)');
  add('api_key', apiKeyPresent(cfg), apiKeyPresent(cfg) ? `${cfg.api_key_env} is set (a key is credentials, not authorization)` : `${cfg.api_key_env} is not set`);
  add('model_configured', !!cfg.model && req.model === cfg.model, cfg.model ? (req.model === cfg.model ? `model ${cfg.model}` : `request model ${req.model} differs from configured ${cfg.model}`) : 'no model configured');
  add('destination', req.url === cfg.endpoint, req.url === cfg.endpoint ? `destination ${cfg.endpoint}` : `request URL ${req.url} is not the configured endpoint ${cfg.endpoint}`);
  const payloadSha = digest(req.payload_text);
  const { trust, states } = authorizationStates(wf, cfg, at);
  add('trust_anchor', trust.usable, trust.usable ? 'trust anchor usable' : trust.problems.join('; ') || 'no trust anchor');
  const valid = states.filter((s) => s.valid);
  const covering = valid.filter((s) => s.authorization.scope.packets.includes(req.packet_id));
  add('authorization', covering.length > 0, covering.length ? `covered by ${covering.map((s) => s.authorization_id).join(', ')}` : states.length ? `no valid authorization covers ${req.packet_id} (${states.map((s) => `${s.authorization_id}: ${s.checks.filter((c) => !c.ok).map((c) => c.detail).join('; ') || 'packet not in scope'}`).join(' | ')})` : 'no signed source-export authorization has been imported');
  const a = covering[0]?.authorization ?? null;
  if (a) {
    add('authorization_destination', a.destination.provider === 'openai' && a.destination.endpoint === req.url, `authorized destination ${a.destination.endpoint}`);
    add('authorization_model', a.models.includes(req.model), a.models.includes(req.model) ? `model ${req.model} authorized` : `model ${req.model} not in authorized models ${a.models.join(', ')}`);
    add('authorization_purpose', a.purpose === cfg.source_export.purpose, `purpose ${a.purpose}`);
    add('authorization_pass', a.passes.includes(req.pass), a.passes.includes(req.pass) ? `pass ${req.pass} authorized` : `pass ${req.pass} not authorized`);
    if (req.pass === 'B') add('authorization_disclosure', a.disclosure === 'source_excerpts_and_derived_analysis', `disclosure ${a.disclosure}${a.disclosure === 'source_excerpts_only' ? ': derived analysis (Pass B) may not be sent' : ''}`);
    const { DATA_CLASSIFICATION } = require('../blockers/openai') as typeof import('../blockers/openai');
    add('data_classification', a.data_classification === DATA_CLASSIFICATION && req.data?.data_classification === DATA_CLASSIFICATION, `classification ${a.data_classification}`);
    add('size_limit', req.payload_text.length <= a.limits.max_chars_per_request, `${req.payload_text.length} chars (limit ${a.limits.max_chars_per_request})`);
    const used = priorLiveRequests(a.authorization_id);
    add('request_limit', used < a.limits.max_requests, `${used} prior LIVE request(s) under ${a.authorization_id} (limit ${a.limits.max_requests})`);
    // Content: every excerpt line must be the current text of an authorized, unchanged file.
    const allowedFiles = new Map<string, string>((a.scope.files as any[]).map((f) => [f.path, f.sha256]));
    let lines = 0;
    const problems: string[] = [];
    for (const s of req.data?.sources ?? []) {
      if (!s.excerpt?.length) continue;
      lines += s.excerpt.length;
      if (!allowedFiles.has(s.path)) {
        problems.push(`${s.path} is not in the authorized file scope`);
        continue;
      }
      const abs = safeSourcePath(wf.run.ctx, s.path);
      const now = abs ? sha256File(abs) : null;
      if (!abs) problems.push(`${s.path} is outside the configured source root or missing`);
      else if (now !== allowedFiles.get(s.path) || s.sha256 !== now) problems.push(`${s.path} hash changed since authorization (authorized ${String(allowedFiles.get(s.path)).slice(0, 12)}…, now ${String(now).slice(0, 12)}…)`);
      else {
        const text = fs.readFileSync(abs, 'utf8').replace(/\r\n?/g, '\n').split('\n');
        for (const l of s.excerpt) if (!sameLine(text[l.line - 1], l.text)) problems.push(`${s.path}:${l.line} in the payload is not the source text`);
      }
    }
    add('source_content', problems.length === 0, problems.length ? problems.slice(0, 5).join('; ') : 'every excerpt line is current text of an authorized file');
    add('excerpt_limit', lines <= a.limits.max_excerpt_lines_per_request, `${lines} excerpt line(s) (limit ${a.limits.max_excerpt_lines_per_request})`);
  }
  const key = apiKey(cfg);
  const leaked = SECRET_MARKERS.some((re) => re.test(req.payload_text)) || (!!key && req.payload_text.includes(key));
  add('no_secrets', !leaked, leaked ? 'payload contains credential-like material' : 'no credential-like material');
  return { evaluated_at: at.toISOString(), allowed: checks.every((c) => c.ok), mode, packet_id: req.packet_id, pass: req.pass, payload_sha256: payloadSha, authorization_id: a?.authorization_id ?? null, checks };
}

/** Unsigned authorization payload for a data owner to review, complete and sign outside the harness. */
export function authorizationTemplate(wf: Workflow, cfg: OpenAIConfig, packetIds: string[], passA: any[]): any {
  const files = new Map<string, string>();
  for (const id of packetIds) {
    const p = passA.find((x) => x.packet_id === id);
    if (!p) throw new OrchestratorError(`unknown packet ${id}`, 'USAGE');
    for (const s of p.sources) if (s.available && s.sha256) files.set(s.path, s.sha256);
  }
  const { DATA_CLASSIFICATION } = require('../blockers/openai') as typeof import('../blockers/openai');
  const now = new Date();
  return {
    contract: 'source-export-authorization',
    contract_version: '1.0',
    authorization_id: 'SEA-<choose-an-id>',
    workflow_id: wf.state.workflow_id,
    run_id: wf.run.runId,
    baseline_manifest_sha256: wf.run.manifestSha256,
    destination: { provider: 'openai', endpoint: cfg.endpoint },
    models: cfg.model ? [cfg.model] : [],
    purpose: cfg.source_export.purpose,
    data_classification: DATA_CLASSIFICATION,
    scope: { packets: packetIds, files: [...files].sort().map(([p, s]) => ({ path: p, sha256: s })) },
    passes: ['A', 'B'],
    disclosure: 'source_excerpts_and_derived_analysis',
    limits: { max_requests: packetIds.length * 2 * (cfg.request.max_retries + 1), max_chars_per_request: 200000, max_excerpt_lines_per_request: 400 },
    not_before: now.toISOString(),
    expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
    signer_id: '<data owner signer id>',
    role: cfg.source_export.required_roles[0],
  };
}
