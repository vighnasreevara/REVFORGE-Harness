/**
 * Program-scoped local generation authorisation (STEP 16, policy
 * `program_scoped_local_v1`, adopted by the project owner).
 *
 * For deterministic LOCAL conversion only, a project-owner-accepted record
 * bound to exact source and copybook hashes and one output directory
 * replaces the G1/G2 signature requirement. No Ed25519 signature is
 * required by this policy. It never changes historical gate records.
 * It never enables the orchestrator's F5/agent generation, which still
 * requires G1 and G2. It never discloses source to any external service.
 *
 * Records live in workflow/generation and are sealed in the audit log:
 *   LGP-NNNN  policy adoption
 *   LGA-NNNN  one authorisation per program scope
 * A changed source or copybook hash, another program, another output
 * directory, an expired record or a broken seal makes the check fail closed.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { mutate, Workflow } from '../orchestrator/orchestrator';

export const LOCAL_POLICY_ID = 'program_scoped_local_v1';
export const GENERATION_DIR = 'generation';
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');

export interface LocalAuthorizationInput {
  program: string;
  source: { path: string; sha256: string };
  copybooks: Array<{ path: string; sha256: string }>;
  output_dir: string;
  purpose: string;
  external_ai_disclosure: 'none';
  ai_review_in_session_permitted: boolean;
  license_note?: string;
  /** JCL and DB2 definitions the program depends on (hash-bound like copybooks). */
  dependencies?: Array<{ path: string; sha256: string }>;
  /** A consolidated scope manifest (repo-relative) that the accepted text binds by hash. */
  scope_manifest?: { path: string; sha256: string };
  accepted_by: string;
  accepted_at: string;
  valid_until: string;
  presented_text: string;
  acceptance_evidence: string;
}

const list = (wf: Workflow, prefix: string) => (fs.existsSync(wf.store.p(GENERATION_DIR)) ? wf.store.list(GENERATION_DIR).filter((f) => f.startsWith(prefix)).map((f) => wf.store.readRecord(GENERATION_DIR, f)) : []);
export const policyRecords = (wf: Workflow) => list(wf, 'LGP-');
export const authorizationRecords = (wf: Workflow) => list(wf, 'LGA-');

function sealed(wf: Workflow, event: string, idKey: string, id: string): string | null {
  let h: string | null = null;
  for (const e of wf.store.readAudit()) if (e.event === event && (e.data as any)[idKey] === id) h = (e.data as any).sha256;
  return h;
}

/** Records the policy adoption (once) and the program authorisation; returns their IDs. */
export function recordLocalAuthorization(wf: Workflow, input: LocalAuthorizationInput, policyStatement: string): { policy_id: string; authorization_id: string } {
  return mutate(wf, 'local generation authorisation', () => {
    let policy = policyRecords(wf).find((p) => p.policy === LOCAL_POLICY_ID);
    if (!policy) {
      const id = `LGP-${String(policyRecords(wf).length + 1).padStart(4, '0')}`;
      policy = { contract: 'pilot/local-generation-record', contract_version: '1.0', kind: 'policy_adoption', record_id: id, policy: LOCAL_POLICY_ID, statement: policyStatement, adopted_by: input.accepted_by, adopted_at: input.accepted_at, acceptance_evidence: input.acceptance_evidence, presented_text_sha256: sha(input.presented_text) };
      const v = wf.run.ctx.contracts.validate('pilot/local-generation-record', policy);
      if (!v.valid) throw new Error(`policy record violates its contract: ${v.errors.join('; ')}`);
      const f = wf.store.writeRecord(GENERATION_DIR, `${id}.json`, policy);
      wf.store.append('local_generation_policy_adopted', { record_id: id, policy: LOCAL_POLICY_ID, adopted_by: input.accepted_by, sha256: sha256File(f) });
    }
    const id = `LGA-${String(authorizationRecords(wf).length + 1).padStart(4, '0')}`;
    // Fixed fields come last so the input can never override them.
    const rec = { ...input, contract: 'pilot/local-generation-record', contract_version: '1.0', kind: 'program_authorization', record_id: id, policy: LOCAL_POLICY_ID, policy_record: policy.record_id, presented_text_sha256: sha(input.presented_text) };
    const v = wf.run.ctx.contracts.validate('pilot/local-generation-record', rec);
    if (!v.valid) throw new Error(`authorisation record violates its contract: ${v.errors.join('; ')}`);
    const f = wf.store.writeRecord(GENERATION_DIR, `${id}.json`, rec);
    wf.store.append('local_generation_authorized', { record_id: id, program: input.program, source_sha256: input.source.sha256, output_dir: input.output_dir, accepted_by: input.accepted_by, sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { policy_id: policy.record_id, authorization_id: id };
  });
}

/** Fail-closed check of a local generation for one program into one output directory. */
export function checkLocalAuthorization(wf: Workflow, ctx: RuntimeContext, program: string, outDir: string, at = new Date()): { ok: boolean; checks: Array<{ id: string; ok: boolean; detail: string }>; authorization: any | null } {
  const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const policy = policyRecords(wf).find((p) => p.policy === LOCAL_POLICY_ID) ?? null;
  add('policy_adopted', !!policy && sealed(wf, 'local_generation_policy_adopted', 'record_id', policy.record_id) === sha256File(wf.store.p(GENERATION_DIR, `${policy.record_id}.json`)), policy ? `${policy.record_id} adopted by ${policy.adopted_by} on ${policy.adopted_at}` : `policy ${LOCAL_POLICY_ID} has not been adopted`);
  const recs = authorizationRecords(wf).filter((r) => r.program === program).sort((a, b) => (a.record_id < b.record_id ? 1 : -1));
  const a = recs[0] ?? null;
  add('program_authorized', !!a, a ? `${a.record_id} authorises ${program}` : `no local generation authorisation exists for ${program}`);
  if (!a || !policy) return { ok: false, checks, authorization: a };
  add('record_sealed', sealed(wf, 'local_generation_authorized', 'record_id', a.record_id) === sha256File(wf.store.p(GENERATION_DIR, `${a.record_id}.json`)), `${a.record_id} matches its audit seal`);
  add('not_expired', Date.parse(a.valid_until) > at.getTime() && Date.parse(a.accepted_at) <= at.getTime(), `valid ${a.accepted_at} to ${a.valid_until}`);
  const root = ctx.sourceRoot;
  const hashOk = (rel: string, expected: string) => !!root && fs.existsSync(path.join(root, rel)) && sha(fs.readFileSync(path.join(root, rel))) === expected;
  add('source_unchanged', hashOk(a.source.path, a.source.sha256), `${a.source.path} sha256 ${a.source.sha256.slice(0, 16)}…${hashOk(a.source.path, a.source.sha256) ? '' : ' DOES NOT MATCH (or the source root is not configured)'}`);
  const badCopy = a.copybooks.filter((c: any) => !hashOk(c.path, c.sha256)).map((c: any) => c.path);
  add('copybooks_unchanged', !badCopy.length, badCopy.length ? `changed or missing: ${badCopy.join(', ')}` : `${a.copybooks.length} copybook(s) unchanged`);
  if (a.dependencies) {
    const badDep = a.dependencies.filter((c: any) => !hashOk(c.path, c.sha256)).map((c: any) => c.path);
    add('dependencies_unchanged', !badDep.length, badDep.length ? `changed or missing: ${badDep.join(', ')}` : `${a.dependencies.length} dependency file(s) unchanged`);
  }
  if (a.scope_manifest) {
    const mf = path.join(ctx.repoRoot, a.scope_manifest.path);
    const ok = fs.existsSync(mf) && sha(fs.readFileSync(mf)) === a.scope_manifest.sha256;
    add('scope_manifest_unchanged', ok, `${a.scope_manifest.path}${ok ? '' : ' changed or missing'}`);
  }
  const rel = path.relative(ctx.repoRoot, path.resolve(outDir)).split(path.sep).join('/').replace(/\/$/, '');
  add('output_dir_authorized', rel === a.output_dir.replace(/\/$/, ''), `requested ${rel}; authorised ${a.output_dir}`);
  add('no_external_disclosure', a.external_ai_disclosure === 'none', `external AI disclosure: ${a.external_ai_disclosure}`);
  return { ok: checks.every((c) => c.ok), checks, authorization: a };
}

/**
 * The consolidated scope (STEP 17): an authorisation record carrying the scope
 * manifest whose hash is unchanged, and the integration directory it names.
 */
export function integrationScope(wf: Workflow, ctx: RuntimeContext): { ok: boolean; detail: string; manifest: any | null; integration_dir: string | null; scope_manifest: { path: string; sha256: string } | null } {
  const rec = authorizationRecords(wf).find((r: any) => r.scope_manifest);
  if (!rec) return { ok: false, detail: 'no consolidated scope manifest is recorded', manifest: null, integration_dir: null, scope_manifest: null };
  const mf = path.join(ctx.repoRoot, rec.scope_manifest.path);
  if (!fs.existsSync(mf) || sha(fs.readFileSync(mf)) !== rec.scope_manifest.sha256) return { ok: false, detail: `${rec.scope_manifest.path} changed or is missing`, manifest: null, integration_dir: null, scope_manifest: rec.scope_manifest };
  const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  return { ok: true, detail: `${rec.scope_manifest.path} unchanged`, manifest, integration_dir: manifest.integration_dir ?? null, scope_manifest: rec.scope_manifest };
}
