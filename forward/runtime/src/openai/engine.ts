/**
 * Two-pass independent verification engine (STEP 5).
 *
 *  review   Pass A for a bounded, prioritised selection of the Step 4.5
 *           packets: source evidence only -> independent interpretation,
 *           every citation re-checked locally.
 *  compare  Pass B for packets whose Pass A was recorded with verified
 *           findings: the independent interpretation is compared with the
 *           existing (Claude / reverse / F1-F2) interpretations.
 *
 * The runtime stays the authority: model output is untrusted, schema- and
 * citation-validated, recorded as ADVISORY and never resolves a decision,
 * changes a requirement, a blocker, a gate or the workflow state. LIVE calls
 * leave the machine only through the provider's guarded fetch, which
 * re-evaluates the signed source-export authorization on the exact bytes of
 * every attempt. OFFLINE never calls a provider; MOCK uses the offline mock.
 */
import { canonicalize, digest } from '../approval/canonical';
import { buildSnapshot, Snapshot } from '../approval/snapshot';
import { sha256File } from '../core/fsutil';
import { sourceRunKey } from '../core/model';
import { OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { analyse, Analysis } from '../blockers/pipeline';
import { latestStep45 } from '../blockers/records';
import { leakCheck } from '../blockers/openai';
import { evaluateEgress, EgressEvaluation, safeSourcePath } from './authorization';
import { CitationValidator } from './citations';
import { apiKeyPresent, costUsd, loadOpenAIConfig, Mode, OpenAIConfig, redact } from './config';
import { INSTRUCTIONS_A, INSTRUCTIONS_B, passAData, passBData, SCHEMA_NAME, TEMPLATE_VERSION, unwrapData, wrapData } from './prompts';
import { MockProvider, OpenAIResponsesProvider, Provider, ProviderError, ProviderRequest, ProviderResult } from './provider';

export const OPENAI_DIR = 'openai';
export const LIVE_NOT_AUTHORIZED = 'LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED';
const SEV = ['critical', 'high', 'medium', 'low'];
const PASS_A_KEYS = ['packet_id', 'pass', 'data_classification', 'sources', 'definitions', 'control_flow', 'question', 'missing_context'].sort().join();
const PASS_B_KEYS = ['packet_id', 'pass', 'data_classification', 'independent_interpretation', 'existing_interpretations', 'conflicting_interpretations', 'deterministic_results', 'sources'].sort().join();

/* ------------------------------------------------------------------ */
/* packets                                                             */
/* ------------------------------------------------------------------ */

export interface PacketSet {
  queue: { id: string; record: any } | null;
  passA: Map<string, any>;
  passB: Map<string, any>;
  checks: Array<{ id: string; ok: boolean; detail: string }>;
}

/** Loads the latest prepared packet set and verifies it against its audit seals, contracts and baseline. */
export function loadPacketSet(wf: Workflow): PacketSet {
  const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
  const q = latestStep45(wf, 'openai-verification-queue');
  if (!q) return { queue: null, passA: new Map(), passB: new Map(), checks: [{ id: 'prepared', ok: false, detail: "no prepared packet set; run 'verification openai prepare'" }] };
  const seals = new Map<string, string>();
  for (const e of wf.store.readAudit()) if (e.event === 'step45_record_written') seals.set((e.data as any).record, (e.data as any).sha256);
  const rec = (id: string) => {
    const file = wf.store.p('step45', `${id}.json`);
    const ok = seals.get(`step45/${id}.json`) === sha256File(file);
    checks.push({ id: `sealed:${id}`, ok, detail: ok ? `${id} matches its audit seal` : `${id} does not match its audit seal` });
    return wf.store.readRecord('step45', `${id}.json`);
  };
  rec(q.id);
  const a = rec(q.record.pass_a_record.id);
  const b = rec(q.record.pass_b_record.id);
  for (const [name, doc] of [['verification/openai-pass-a', a], ['verification/openai-pass-b', b]] as const) {
    const v = wf.run.ctx.contracts.validate(name, doc);
    checks.push({ id: `contract:${name}`, ok: v.valid, detail: v.valid ? `${name} valid` : v.errors.slice(0, 3).join('; ') });
  }
  checks.push({ id: 'baseline', ok: a.baseline_manifest_sha256 === wf.run.manifestSha256, detail: a.baseline_manifest_sha256 === wf.run.manifestSha256 ? 'packets bound to the current baseline' : 'packets were prepared on a different baseline' });
  const bad = (q.record.packets as any[]).filter((p) => p.leak_check?.leaked);
  checks.push({ id: 'pass_a_independence', ok: !bad.length, detail: bad.length ? `${bad.length} packet(s) failed the Step 4.5 leak check` : 'no Pass A packet contains an existing interpretation (Step 4.5 leak check)' });
  return { queue: q, passA: new Map((a.packets as any[]).map((p) => [p.packet_id, p])), passB: new Map((b.packets as any[]).map((p) => [p.packet_id, p])), checks };
}

export interface Eligibility {
  packet_id: string;
  root_cause_id: string;
  category: string;
  eligible: boolean;
  reasons: string[];
  priority: number[];
  deterministic_status: string | null;
}

export function eligibility(a: Analysis, set: PacketSet, cfg: OpenAIConfig): Eligibility[] {
  const det = new Map<string, any>(a.det.results.map((r: any) => [r.root_cause_id, r]));
  const roots = new Map(a.reg.roots.map((r) => [r.root_cause_id, r]));
  const establishes = new Set(['VERIFIED_DETERMINISTICALLY', 'CONTRADICTED_BY_SOURCE', 'SOURCE_CITATION_CORRECTED', 'EXTERNAL_DEPENDENCY_MISSING']);
  return (set.queue?.record.packets ?? []).map((q: any) => {
    const p = set.passA.get(q.packet_id);
    const reasons: string[] = [];
    const r = roots.get(q.root_cause_id);
    if (!p) reasons.push('no Pass A packet');
    if (!set.passB.has(q.packet_id)) reasons.push('no Pass B packet');
    if (!r) reasons.push('root cause no longer in the current registry');
    else if (!r.blocking) reasons.push('root cause no longer blocking');
    else if (r.resolution_status === 'resolved') reasons.push('root cause decisions already resolved');
    const avail = (p?.sources ?? []).filter((s: any) => s.available);
    if (!avail.length) reasons.push('required source evidence is not available in the checkout');
    for (const s of avail) {
      const abs = safeSourcePath(a.snap.wf.run.ctx, s.path);
      const now = abs ? sha256File(abs) : null;
      if (now !== s.sha256) reasons.push(`stale source ${s.path} (packet ${String(s.sha256).slice(0, 12)}…, now ${String(now).slice(0, 12)}…)`);
    }
    if (q.leak_check?.leaked) reasons.push('Pass A leak check failed');
    const d = det.get(q.root_cause_id);
    const catRank = cfg.selection.category_priority.indexOf(q.category);
    return {
      packet_id: q.packet_id,
      root_cause_id: q.root_cause_id,
      category: q.category,
      eligible: reasons.length === 0,
      reasons,
      // Lower sorts first: category priority, facts not yet established, severity, then larger downstream impact.
      priority: [catRank < 0 ? 99 : catRank, establishes.has(d?.status) ? 1 : 0, SEV.indexOf(r?.severity ?? 'low'), -((r?.related.decisions.length ?? 0) + (r?.approval_scope_impact.application_blocking_findings ?? 0))],
      deterministic_status: d?.status ?? null,
    };
  });
}

export function select(el: Eligibility[], cfg: OpenAIConfig, opts: { packets?: string[]; max?: number }): { selected: Eligibility[]; blocked: Eligibility[]; not_selected: number } {
  const blocked = el.filter((e) => !e.eligible);
  let pool = el.filter((e) => e.eligible);
  if (opts.packets?.length) {
    const unknown = opts.packets.filter((p) => !el.some((e) => e.packet_id === p));
    if (unknown.length) throw new OrchestratorError(`unknown packets: ${unknown.join(', ')}`, 'USAGE');
    pool = pool.filter((e) => opts.packets!.includes(e.packet_id));
  }
  pool.sort((x, y) => {
    for (let i = 0; i < x.priority.length; i++) if (x.priority[i] !== y.priority[i]) return x.priority[i] - y.priority[i];
    return x.packet_id < y.packet_id ? -1 : 1;
  });
  const max = Math.min(opts.max ?? cfg.selection.max_packets, cfg.selection.max_packets);
  return { selected: pool.slice(0, max), blocked, not_selected: Math.max(0, pool.length - max) };
}

/* ------------------------------------------------------------------ */
/* execution helpers                                                   */
/* ------------------------------------------------------------------ */

async function withLock<T>(wf: Workflow, op: string, fn: () => Promise<T>): Promise<T> {
  const cp = wf.store.verifyCheckpoint();
  if (!cp.ok) throw new OrchestratorError('workflow checkpoint verification failed; refusing to continue', 'CHECKPOINT_INVALID', cp.problems);
  wf.store.lock(op);
  try {
    return await fn();
  } finally {
    wf.store.unlock();
  }
}

function seal(wf: Workflow, sub: string, name: string, data: any): { path: string; sha256: string } {
  const file = wf.store.writeRecord(sub, name, data);
  const sha = sha256File(file)!;
  wf.store.append('openai_record_written', { record: `${sub}/${name}`, sha256: sha });
  return { path: `${sub}/${name}`, sha256: sha };
}

function nextRunId(wf: Workflow): string {
  return `OVR-${String(wf.store.list(OPENAI_DIR).filter((f) => /^OVR-\d{4}\.json$/.test(f)).length + 1).padStart(4, '0')}`;
}

/** The model-output contract, read from the contracts directory (the same file used for local validation). */
export function modelSchema(wf: Workflow, pass: 'A' | 'B'): any {
  const f = require('path').join(wf.run.ctx.forwardDir, 'contracts', 'openai', pass === 'A' ? 'pass-a-output.schema.json' : 'pass-b-output.schema.json');
  return JSON.parse(require('fs').readFileSync(f, 'utf8'));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([p, new Promise<T>((_, rej) => (t = setTimeout(() => rej(new ProviderError('timeout', true, `no response within ${ms} ms`)), ms)))]);
  } finally {
    if (t) clearTimeout(t);
  }
}

async function pool<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  });
  await Promise.all(workers);
  return out;
}

interface Budget {
  calls: number;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface RunOptions {
  mode: Mode;
  provider?: Provider;
  packets?: string[];
  max?: number;
  configOverride?: Partial<OpenAIConfig>;
  /** Test hook: transport used by the real provider in LIVE mode (defaults to global fetch). */
  transport?: (url: any, init?: any) => Promise<any>;
}

/** Validates the exact request body against the fixed template and the pass-specific data shape. */
export function checkPayload(body: any, pass: 'A' | 'B'): string[] {
  const problems: string[] = [];
  if (body?.instructions !== (pass === 'A' ? INSTRUCTIONS_A : INSTRUCTIONS_B)) problems.push('instructions are not the fixed verifier template');
  if (body?.text?.format?.type !== 'json_schema' || body?.text?.format?.strict !== true) problems.push('Structured Outputs (text.format json_schema, strict) is required');
  if ('response_format' in (body ?? {})) problems.push('response_format is a Chat Completions parameter and must not be sent to the Responses API');
  if ('tools' in (body ?? {}) || 'tool_choice' in (body ?? {})) problems.push('no tools may be offered to the verifier');
  if (body?.store !== false) problems.push('store must be false');
  const items = body?.input;
  if (!Array.isArray(items) || items.length !== 1 || items[0]?.content?.length !== 1 || items[0].content[0].type !== 'input_text') problems.push('input must be exactly one DATA block');
  const data = unwrapData(items?.[0]?.content?.[0]?.text ?? '');
  if (!data) problems.push('DATA block is missing or malformed');
  else {
    const keys = Object.keys(data).sort().join();
    if (keys !== (pass === 'A' ? PASS_A_KEYS : PASS_B_KEYS)) problems.push(`DATA block keys [${keys}] are not the Pass ${pass} contract`);
    if (data.pass !== pass) problems.push('DATA block pass mismatch');
  }
  return problems;
}

/* ------------------------------------------------------------------ */
/* core call with budget, guard, retries                               */
/* ------------------------------------------------------------------ */

interface CallContext {
  wf: Workflow;
  cfg: OpenAIConfig;
  mode: Mode;
  runId: string;
  provider: Provider | null;
  budget: Budget;
  requests: any[];
  liveCount: () => Map<string, number>;
  /** Egress evaluations made by the network guard, by packet|pass (latest attempt). */
  evals: Map<string, EgressEvaluation>;
}

async function callWithPolicy(cc: CallContext, req: ProviderRequest): Promise<{ result: ProviderResult | null; failure: { kind: string; retryable: boolean; detail: string } | null; attempts: number }> {
  const body = (require('./provider') as typeof import('./provider')).responsesBody(req, cc.cfg.request.store);
  const bodyText = JSON.stringify(body);
  const payloadProblems = checkPayload(body, req.pass);
  if (payloadProblems.length) return { result: null, failure: { kind: 'egress_blocked', retryable: false, detail: `payload rejected before sending: ${payloadProblems.join('; ')}` }, attempts: 0 };
  const maxAttempts = 1 + cc.cfg.request.max_retries;
  let last: { kind: string; retryable: boolean; detail: string } | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const estIn = Math.ceil((req.instructions.length + req.data_text.length) / 4);
    const estCost = costUsd(cc.cfg, { input_tokens: estIn, cached_input_tokens: 0, output_tokens: req.max_output_tokens }) ?? 0;
    const b = cc.cfg.budget;
    const over = cc.budget.calls + 1 > b.max_calls_per_run ? `call budget ${b.max_calls_per_run} reached` : cc.budget.input_tokens + estIn > b.max_input_tokens_per_run ? `input-token budget ${b.max_input_tokens_per_run} would be exceeded (estimate ${estIn})` : cc.budget.output_tokens + req.max_output_tokens > b.max_output_tokens_per_run ? `output-token budget ${b.max_output_tokens_per_run} would be exceeded` : cc.budget.cost_usd + estCost > b.max_cost_usd_per_run ? `cost budget $${b.max_cost_usd_per_run} would be exceeded (estimate $${estCost})` : null;
    const reqRec: any = { request_id: `${cc.runId}/${req.packet_id}/${req.pass}/${attempt}`, packet_id: req.packet_id, pass: req.pass, attempt, mode: cc.mode, provider: cc.provider?.name ?? 'none', model: req.model, template_version: TEMPLATE_VERSION, payload_sha256: digest(bodyText), payload_chars: bodyText.length, started_at: new Date().toISOString(), egress: null as EgressEvaluation | null, outcome: '', response_id: null, usage: null, error: null };
    cc.requests.push(reqRec);
    // The egress decision for this exact payload is always evaluated and recorded (LIVE enforces it at the network boundary).
    const evalNow = (url: string, text: string) => {
      const data = unwrapData(JSON.parse(text)?.input?.[0]?.content?.[0]?.text ?? '');
      const ev = evaluateEgress(cc.wf, cc.cfg, cc.mode, { url, model: JSON.parse(text).model, instructions: JSON.parse(text).instructions, packet_id: data?.packet_id ?? req.packet_id, pass: data?.pass ?? req.pass, data, payload_text: text }, (id) => cc.liveCount().get(id) ?? 0);
      reqRec.egress = ev;
      return ev;
    };
    if (over) {
      reqRec.outcome = 'blocked_budget';
      evalNow(cc.cfg.endpoint, bodyText);
      return { result: null, failure: { kind: 'budget', retryable: false, detail: over }, attempts: attempt };
    }
    if (cc.mode === 'OFFLINE' || !cc.provider) {
      evalNow(cc.cfg.endpoint, bodyText);
      reqRec.outcome = 'not_sent_offline';
      return { result: null, failure: null, attempts: attempt };
    }
    if (!cc.provider.network) evalNow(cc.cfg.endpoint, bodyText); // MOCK: recorded as the LIVE eligibility of this payload
    try {
      cc.budget.calls++;
      cc.evals.delete(`${req.packet_id}|${req.pass}`);
      const res = await withTimeout(cc.provider.call(req), cc.cfg.request.timeout_ms);
      if (cc.provider.network) reqRec.egress = cc.evals.get(`${req.packet_id}|${req.pass}`) ?? null;
      reqRec.outcome = 'response';
      reqRec.response_id = res.response_id;
      const usage = res.usage ?? { input_tokens: 0, cached_input_tokens: 0, output_tokens: 0 };
      reqRec.usage = { ...usage, cost_usd: costUsd(cc.cfg, usage), source: cc.provider.network ? 'provider_reported' : 'mock_estimate' };
      cc.budget.input_tokens += usage.input_tokens;
      cc.budget.cached_input_tokens += usage.cached_input_tokens;
      cc.budget.output_tokens += usage.output_tokens;
      cc.budget.cost_usd += costUsd(cc.cfg, usage) ?? 0;
      if (cc.provider.network && reqRec.egress?.allowed) cc.liveCount().set(reqRec.egress.authorization_id, (cc.liveCount().get(reqRec.egress.authorization_id) ?? 0) + 1);
      return { result: res, failure: null, attempts: attempt };
    } catch (e: any) {
      if (cc.provider.network) reqRec.egress = cc.evals.get(`${req.packet_id}|${req.pass}`) ?? null;
      const pe = e instanceof ProviderError ? e : new ProviderError('other', false, String(e?.message ?? e));
      reqRec.outcome = pe.kind === 'egress_blocked' ? 'blocked_at_network_boundary' : 'error';
      reqRec.error = { kind: pe.kind, retryable: pe.retryable, status: pe.status, message: redact(pe.message, cc.cfg) };
      last = { kind: pe.kind, retryable: pe.retryable, detail: redact(pe.message, cc.cfg) };
      if (pe.kind === 'egress_blocked') cc.budget.calls--; // nothing left the machine
      if (!pe.retryable || attempt === maxAttempts) return { result: null, failure: last, attempts: attempt };
      await sleep(cc.cfg.request.retry_base_delay_ms * 2 ** (attempt - 1));
    } finally {
      reqRec.finished_at = new Date().toISOString();
    }
  }
  return { result: null, failure: last, attempts: maxAttempts };
}

function parseOutput(wf: Workflow, res: ProviderResult, pass: 'A' | 'B', packetId: string): { output: any | null; failures: any[] } {
  if (res.refusal) return { output: null, failures: [{ kind: 'refusal', retryable: false, detail: res.refusal.slice(0, 500) }] };
  if (res.status === 'incomplete' || res.incomplete_reason) return { output: null, failures: [{ kind: 'incomplete', retryable: false, detail: `response incomplete (${res.incomplete_reason ?? 'unknown reason'})` }] };
  if (res.status !== 'completed') return { output: null, failures: [{ kind: 'other', retryable: false, detail: `response status ${res.status}` }] };
  let out: any;
  try {
    out = JSON.parse(res.output_text ?? '');
  } catch (e) {
    return { output: null, failures: [{ kind: 'invalid_json', retryable: false, detail: `output is not JSON: ${(e as Error).message}` }] };
  }
  const v = wf.run.ctx.contracts.validate(pass === 'A' ? 'openai/pass-a-output' : 'openai/pass-b-output', out);
  if (!v.valid) return { output: null, failures: [{ kind: 'invalid_schema', retryable: false, detail: v.errors.slice(0, 5).join('; ') }] };
  if (out.packet_id !== packetId || out.pass !== pass) return { output: null, failures: [{ kind: 'packet_mismatch', retryable: false, detail: `output names ${out.packet_id}/${out.pass}, expected ${packetId}/${pass}` }] };
  return { output: out, failures: [] };
}

function relatedOf(a: Analysis, rootId: string) {
  const r = a.reg.roots.find((x) => x.root_cause_id === rootId);
  const rulesRun = a.snap.set.artifacts.rules ? sourceRunKey(a.snap.set.artifacts.rules) : null;
  const gapsRun = a.snap.set.artifacts.gaps ? sourceRunKey(a.snap.set.artifacts.gaps) : null;
  return {
    decisions: r?.related.decisions ?? [],
    rules: (r?.related.rules ?? []).map((id) => ({ id, scope: 'run-local', source_run: rulesRun })),
    gaps: (r?.related.gaps ?? []).map((id) => ({ id, scope: 'run-local', source_run: gapsRun })),
    requirements: r?.related.requirements ?? [],
    data_contracts: r?.related.data_contracts ?? [],
  };
}

function provider(cfg: OpenAIConfig, mode: Mode, opts: RunOptions, wf: Workflow, liveCount: () => Map<string, number>, onEval: (ev: EgressEvaluation) => void): Provider | null {
  if (mode === 'OFFLINE') return null;
  if (mode === 'MOCK') return opts.provider && !opts.provider.network ? opts.provider : new MockProvider();
  // LIVE: always the real provider, whose only fetch is guarded on the exact outgoing bytes.
  const guard = (url: string, text: string | null) => {
    if (text === null) return { allowed: false, reason: 'request body is not inspectable' };
    let body: any;
    try {
      body = JSON.parse(text);
    } catch {
      return { allowed: false, reason: 'request body is not JSON' };
    }
    const data = unwrapData(body?.input?.[0]?.content?.[0]?.text ?? '');
    const pass = data?.pass === 'B' ? 'B' : 'A';
    const problems = checkPayload(body, pass);
    if (problems.length) return { allowed: false, reason: problems.join('; ') };
    const ev = evaluateEgress(wf, cfg, mode, { url, model: body.model, instructions: body.instructions, packet_id: data.packet_id, pass, data, payload_text: text }, (id) => liveCount().get(id) ?? 0);
    onEval(ev);
    return { allowed: ev.allowed, reason: ev.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`).join('; ') };
  };
  return new OpenAIResponsesProvider(cfg, guard, opts.transport);
}

function liveCounts(wf: Workflow): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of wf.store.list(OPENAI_DIR).filter((x) => /^OVR-\d{4}\.json$/.test(x))) {
    const r = wf.store.readRecord(OPENAI_DIR, f);
    for (const q of r.requests ?? []) if (q.mode === 'LIVE' && q.egress?.allowed && q.outcome === 'response') m.set(q.egress.authorization_id, (m.get(q.egress.authorization_id) ?? 0) + 1);
  }
  return m;
}

function versionOf(wf: Workflow, sub: string, packet: string): number {
  return wf.store.list(sub).filter((f) => f.startsWith(`${packet}.`)).length + 1;
}

/* ------------------------------------------------------------------ */
/* review (Pass A) and compare (Pass B)                                */
/* ------------------------------------------------------------------ */

/** Process-level LIVE prerequisites; any failure means no provider is created and nothing is sent. */
function liveGate(wf: Workflow, cfg: OpenAIConfig, mode: Mode): string[] {
  if (mode !== 'LIVE') return [];
  const why: string[] = [];
  if (!cfg.network_enabled) why.push('openai_verification.network_enabled is false');
  if (!apiKeyPresent(cfg)) why.push(`${cfg.api_key_env} is not set`);
  if (!cfg.model) why.push('no model configured');
  // Reported for completeness; each request is still evaluated at the network boundary.
  const { trust, states } = (require('./authorization') as typeof import('./authorization')).authorizationStates(wf, cfg);
  if (!trust.usable) why.push(`no usable trust anchor (${trust.problems.join('; ') || 'not configured'})`);
  if (!states.some((s) => s.valid)) why.push(states.length ? 'no imported source-export authorization is currently valid' : 'no signed source-export authorization has been imported');
  return why;
}

export async function runReview(wf: Workflow, opts: RunOptions): Promise<any> {
  return withLock(wf, `openai review ${opts.mode}`, async () => {
    const { config: cfg, errors } = loadOpenAIConfig(wf.run.ctx, opts.configOverride);
    const fatal = errors.filter((e) => !/pricing is not configured/.test(e));
    if (fatal.length) throw new OrchestratorError('OpenAI verification configuration is invalid', 'CONFIG', fatal);
    const a = analyse(wf);
    const set = loadPacketSet(wf);
    if (!set.checks.every((c) => c.ok)) throw new OrchestratorError('prepared packet set failed integrity checks', 'PACKETS', set.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`));
    const el = eligibility(a, set, cfg);
    const sel = select(el, cfg, { packets: opts.packets, max: opts.max });
    const runId = nextRunId(wf);
    const live = liveGate(wf, cfg, opts.mode);
    const counts = liveCounts(wf);
    const requests: any[] = [];
    const budget: Budget = { calls: 0, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, cost_usd: 0 };
    const evals = new Map<string, EgressEvaluation>();
    const prov = live.length ? null : provider(cfg, opts.mode, opts, wf, () => counts, (ev) => evals.set(`${ev.packet_id}|${ev.pass}`, ev));
    const cc: CallContext = { wf, cfg, mode: opts.mode, runId, provider: prov, budget, requests, liveCount: () => counts, evals };
    const started = new Date().toISOString();
    const results = await pool(sel.selected, cfg.request.concurrency, async (e) => {
      const packet = set.passA.get(e.packet_id);
      const interps = (set.passB.get(e.packet_id)?.existing_interpretations ?? []).map((x: any) => x.text);
      const data = passAData(packet);
      // Independence: the Pass A request is built from the Pass A packet only, and checked for leaked interpretation text.
      const leak = leakCheck({ ...data, sources: [], definitions: [] }, interps);
      const req: ProviderRequest = { pass: 'A', packet_id: e.packet_id, model: cfg.model ?? 'unconfigured', instructions: INSTRUCTIONS_A, data_text: wrapData(data), schema_name: SCHEMA_NAME.A, schema: modelSchema(wf, 'A'), max_output_tokens: cfg.request.max_output_tokens, timeout_ms: cfg.request.timeout_ms };
      if (live.length) {
        requests.push({ request_id: `${runId}/${e.packet_id}/A/0`, packet_id: e.packet_id, pass: 'A', attempt: 0, mode: opts.mode, provider: 'openai', model: req.model, template_version: TEMPLATE_VERSION, payload_sha256: digest(JSON.stringify((require('./provider') as typeof import('./provider')).responsesBody(req, false))), egress: null, outcome: 'blocked_live_prerequisites', error: { kind: 'egress_blocked', message: live.join('; ') } });
        return { packet: e.packet_id, status: 'blocked', record: null, reasons: live };
      }
      if (leak.leaked) return { packet: e.packet_id, status: 'blocked', record: null, reasons: [`Pass A data contains interpretation text: ${leak.matches.join(' | ')}`] };
      const call = await callWithPolicy(cc, req);
      if (opts.mode === 'OFFLINE') return { packet: e.packet_id, status: 'planned', record: null, reasons: [] };
      const failures = call.failure ? [call.failure] : [];
      let output: any = null;
      if (call.result) {
        const p = parseOutput(wf, call.result, 'A', e.packet_id);
        output = p.output;
        failures.push(...p.failures);
      }
      const snap: Snapshot = a.snap;
      const v = new CitationValidator(snap, packet);
      const findings: any[] = [];
      const base = (kind: string, i: number) => ({ finding_id: `${runId}/${e.packet_id}/A/${kind}/${i + 1}`, verification_run_id: runId, baseline_manifest_sha256: wf.run.manifestSha256, root_cause_id: e.root_cause_id, packet_id: e.packet_id, pass: 'A', model: call.result?.model ?? req.model, template_version: TEMPLATE_VERSION, response_id: call.result?.response_id ?? null, executed_at: new Date().toISOString(), source_files: packet.sources.filter((s: any) => s.available).map((s: any) => ({ path: s.path, file_id: s.file_id, sha256: s.sha256 })) });
      (output?.operations ?? []).forEach((op: any, i: number) => {
        const r = v.checkOperation(op);
        findings.push({ ...base('operation', i), kind: 'operation', content: op, citations: r.citations, evidence_integrity: r.ok ? 'VERIFIED' : 'REJECTED', rejection_reasons: r.reasons, semantic_review: 'ADVISORY_UNREVIEWED', deterministic_support: { citations_verified: r.citations.every((c) => c.status === 'VERIFIED'), operation_present_in_source: !r.reasons.some((x) => /not present|no arithmetic/.test(x)), root_cause_deterministic_status: e.deterministic_status }, human_review_required: true, uncertainty: output.cannot_establish });
      });
      (output?.missing_dependencies ?? []).forEach((d: any, i: number) => {
        const r = v.checkDependency(d);
        findings.push({ ...base('missing_dependency', i), kind: 'missing_dependency', content: d, citations: r.citations, evidence_integrity: r.ok ? 'VERIFIED' : 'REJECTED', rejection_reasons: r.reasons, semantic_review: 'ADVISORY_UNREVIEWED', deterministic_support: { citations_verified: r.citations.every((c) => c.status === 'VERIFIED'), operation_present_in_source: null, root_cause_deterministic_status: e.deterministic_status }, human_review_required: true, uncertainty: output.cannot_establish });
      });
      const ok = findings.filter((f) => f.evidence_integrity === 'VERIFIED' && f.kind === 'operation').length;
      const status = failures.length ? (call.failure?.kind === 'budget' ? 'blocked' : 'failed') : !findings.length || !ok ? 'rejected' : ok === findings.length ? 'accepted' : 'partially_accepted';
      const rec = {
        contract: 'openai-pass-a-result',
        contract_version: '1.0',
        verification_run_id: runId,
        packet_id: e.packet_id,
        pass: 'A',
        version: versionOf(wf, `${OPENAI_DIR}/pass-a`, e.packet_id),
        status,
        mode: opts.mode,
        provider: prov?.name ?? 'none',
        model: call.result?.model ?? req.model,
        template_version: TEMPLATE_VERSION,
        baseline_manifest_sha256: wf.run.manifestSha256,
        root_cause_id: e.root_cause_id,
        related: relatedOf(a, e.root_cause_id),
        request: { attempts: call.attempts, payload_sha256: digest(JSON.stringify((require('./provider') as typeof import('./provider')).responsesBody(req, false))), data_sha256: digest(data), schema: SCHEMA_NAME.A },
        response: { response_id: call.result?.response_id ?? null, status: call.result?.status ?? null, refusal: call.result?.refusal ?? null, incomplete_reason: call.result?.incomplete_reason ?? null },
        model_output: output,
        findings,
        failures,
        untrusted_instructions_observed: output?.untrusted_instructions_observed ?? [],
        provenance: { pass_a_inputs_exclude_interpretations: true, built_from: `Step 4.5 Pass A packet ${set.queue!.record.pass_a_record.id}`, leak_check: leak, packet_sha256: digest(packet) },
      };
      const vv = wf.run.ctx.contracts.validate('openai/pass-result', rec);
      if (!vv.valid) throw new OrchestratorError('Pass A result violates its contract', 'CONTRACT', vv.errors);
      const sealed = seal(wf, `${OPENAI_DIR}/pass-a`, `${e.packet_id}.v${rec.version}.json`, rec);
      return { packet: e.packet_id, status, record: sealed.path, reasons: failures.map((f: any) => `${f.kind}: ${f.detail}`) };
    });
    const run = runRecord(wf, cfg, runId, 'review', opts.mode, prov, started, set, el, sel, requests, budget, results, live);
    seal(wf, OPENAI_DIR, `${runId}.json`, run);
    wf.store.writeState(wf.state);
    return run;
  });
}

export async function runCompare(wf: Workflow, opts: RunOptions & { reviewRun: string }): Promise<any> {
  return withLock(wf, `openai compare ${opts.mode}`, async () => {
    const { config: cfg, errors } = loadOpenAIConfig(wf.run.ctx, opts.configOverride);
    const fatal = errors.filter((e) => !/pricing is not configured/.test(e));
    if (fatal.length) throw new OrchestratorError('OpenAI verification configuration is invalid', 'CONFIG', fatal);
    if (!wf.store.list(OPENAI_DIR).includes(`${opts.reviewRun}.json`)) throw new OrchestratorError(`unknown review run ${opts.reviewRun}`, 'USAGE');
    const review = wf.store.readRecord(OPENAI_DIR, `${opts.reviewRun}.json`);
    if (review.kind !== 'review') throw new OrchestratorError(`${opts.reviewRun} is not a review run`, 'USAGE');
    const a = analyse(wf);
    const set = loadPacketSet(wf);
    if (!set.checks.every((c) => c.ok)) throw new OrchestratorError('prepared packet set failed integrity checks', 'PACKETS', set.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`));
    const runId = nextRunId(wf);
    const live = liveGate(wf, cfg, opts.mode);
    const counts = liveCounts(wf);
    const requests: any[] = [];
    const budget: Budget = { calls: 0, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, cost_usd: 0 };
    const evals = new Map<string, EgressEvaluation>();
    const prov = live.length ? null : provider(cfg, opts.mode, opts, wf, () => counts, (ev) => evals.set(`${ev.packet_id}|${ev.pass}`, ev));
    const cc: CallContext = { wf, cfg, mode: opts.mode, runId, provider: prov, budget, requests, liveCount: () => counts, evals };
    const started = new Date().toISOString();
    const seals = new Map<string, string>();
    for (const e of wf.store.readAudit()) if (e.event === 'openai_record_written') seals.set((e.data as any).record, (e.data as any).sha256);
    const items = (review.results as any[]).filter((r) => r.record && (!opts.packets?.length || opts.packets.includes(r.packet)));
    const results = await pool(items, cfg.request.concurrency, async (r) => {
      const file = wf.store.p(...String(r.record).split('/'));
      if (seals.get(r.record) !== sha256File(file)) return { packet: r.packet, status: 'blocked', record: null, reasons: [`${r.record} does not match its audit seal`] };
      const passA = JSON.parse(require('fs').readFileSync(file, 'utf8'));
      if (!['accepted', 'partially_accepted'].includes(passA.status)) return { packet: r.packet, status: 'blocked', record: null, reasons: [`Pass A ${passA.status}: no verified independent interpretation to compare`] };
      const pa = set.passA.get(r.packet);
      const pb = set.passB.get(r.packet);
      if (!pa || !pb) return { packet: r.packet, status: 'blocked', record: null, reasons: ['packet no longer in the prepared set'] };
      if (pb.pass_a_sha256 !== digest(pa)) return { packet: r.packet, status: 'blocked', record: null, reasons: ['Pass B packet is not bound to this Pass A packet'] };
      const data = passBData(pa, pb, passA);
      const req: ProviderRequest = { pass: 'B', packet_id: r.packet, model: cfg.model ?? 'unconfigured', instructions: INSTRUCTIONS_B, data_text: wrapData(data), schema_name: SCHEMA_NAME.B, schema: modelSchema(wf, 'B'), max_output_tokens: cfg.request.max_output_tokens, timeout_ms: cfg.request.timeout_ms };
      if (live.length) return { packet: r.packet, status: 'blocked', record: null, reasons: live };
      const call = await callWithPolicy(cc, req);
      if (opts.mode === 'OFFLINE') return { packet: r.packet, status: 'planned', record: null, reasons: [] };
      const failures = call.failure ? [call.failure] : [];
      let output: any = null;
      if (call.result) {
        const p = parseOutput(wf, call.result, 'B', r.packet);
        output = p.output;
        failures.push(...p.failures);
      }
      const v = new CitationValidator(a.snap, pa);
      const supplied = new Set(data.existing_interpretations.map((x: any) => x.interpretation_id));
      const findings: any[] = [];
      (output?.comparisons ?? []).forEach((c: any, i: number) => {
        const cites = [...(c.citations ?? []), ...(c.differences ?? []).flatMap((d: any) => d.citations ?? [])].map((x: any) => v.check(x));
        const reasons = [...(supplied.has(c.interpretation_id) ? [] : [`interpretation ${c.interpretation_id} was not supplied (fabricated reference)`]), ...cites.filter((x) => x.status === 'REJECTED').flatMap((x) => x.reasons)];
        findings.push({ finding_id: `${runId}/${r.packet}/B/comparison/${i + 1}`, verification_run_id: runId, baseline_manifest_sha256: wf.run.manifestSha256, root_cause_id: passA.root_cause_id, packet_id: r.packet, pass: 'B', model: call.result?.model ?? req.model, template_version: TEMPLATE_VERSION, response_id: call.result?.response_id ?? null, executed_at: new Date().toISOString(), source_files: passA.findings[0]?.source_files ?? [], kind: 'comparison', content: c, classification: c.classification, citations: cites, evidence_integrity: reasons.length ? 'REJECTED' : 'VERIFIED', rejection_reasons: reasons, semantic_review: 'ADVISORY_UNREVIEWED', deterministic_support: { citations_verified: cites.every((x) => x.status === 'VERIFIED'), root_cause_deterministic_status: pb.deterministic_results?.status ?? null }, human_review_required: true });
      });
      const missing = [...supplied].filter((id) => !(output?.comparisons ?? []).some((c: any) => c.interpretation_id === id));
      const ok = findings.filter((f) => f.evidence_integrity === 'VERIFIED').length;
      const status = failures.length ? (call.failure?.kind === 'budget' ? 'blocked' : 'failed') : !findings.length ? 'rejected' : ok === findings.length && !missing.length ? 'accepted' : ok ? 'partially_accepted' : 'rejected';
      const rec: any = {
        contract: 'openai-pass-b-result',
        contract_version: '1.0',
        verification_run_id: runId,
        packet_id: r.packet,
        pass: 'B',
        version: versionOf(wf, `${OPENAI_DIR}/pass-b`, r.packet),
        status,
        mode: opts.mode,
        provider: prov?.name ?? 'none',
        model: call.result?.model ?? req.model,
        template_version: TEMPLATE_VERSION,
        baseline_manifest_sha256: wf.run.manifestSha256,
        root_cause_id: passA.root_cause_id,
        related: relatedOf(a, passA.root_cause_id),
        request: { attempts: call.attempts, payload_sha256: digest(JSON.stringify((require('./provider') as typeof import('./provider')).responsesBody(req, false))), data_sha256: digest(data), schema: SCHEMA_NAME.B, pass_a_result: r.record },
        response: { response_id: call.result?.response_id ?? null, status: call.result?.status ?? null, refusal: call.result?.refusal ?? null, incomplete_reason: call.result?.incomplete_reason ?? null },
        model_output: output,
        findings,
        interpretations_not_compared: missing,
        failures,
        untrusted_instructions_observed: output?.untrusted_instructions_observed ?? [],
        provenance: { pass_a_inputs_exclude_interpretations: true, pass_a_result: r.record, pass_b_packet_sha256: digest(pb) },
      };
      const vv = wf.run.ctx.contracts.validate('openai/pass-result', rec);
      if (!vv.valid) throw new OrchestratorError('Pass B result violates its contract', 'CONTRACT', vv.errors);
      const sealed = seal(wf, `${OPENAI_DIR}/pass-b`, `${r.packet}.v${rec.version}.json`, rec);
      if (output && status !== 'failed') {
        const adv = advisory(a, runId, rec, output, v);
        const vr = wf.run.ctx.contracts.validate('openai/review-recommendation', adv);
        if (!vr.valid) throw new OrchestratorError('advisory review violates its contract', 'CONTRACT', vr.errors);
        seal(wf, `${OPENAI_DIR}/advisory`, `${r.packet}.v${versionOf(wf, `${OPENAI_DIR}/advisory`, r.packet)}.json`, adv);
      }
      return { packet: r.packet, status, record: sealed.path, reasons: failures.map((f: any) => `${f.kind}: ${f.detail}`) };
    });
    const run = runRecord(wf, cfg, runId, 'compare', opts.mode, prov, started, set, null, null, requests, budget, results, live);
    run.review_run = opts.reviewRun;
    seal(wf, OPENAI_DIR, `${runId}.json`, run);
    wf.store.writeState(wf.state);
    return run;
  });
}

const OUTCOME: Record<string, string> = {
  SUPPORTS_EXISTING: 'SUPPORTS_EXISTING_FINDING',
  CONTRADICTS_EXISTING: 'CONTRADICTS_EXISTING_FINDING',
  EVIDENCE_INSUFFICIENT: 'EXISTING_EVIDENCE_INSUFFICIENT',
  DETERMINISTIC_CHECK_REQUIRED: 'ADDITIONAL_DETERMINISTIC_CHECKS_REQUIRED',
  CORRECTION_PROPOSAL_JUSTIFIED: 'CORRECTION_PROPOSAL_JUSTIFIED',
  HUMAN_REVIEW_REQUIRED: 'HUMAN_REVIEW_REQUIRED',
};

function advisory(a: Analysis, runId: string, rec: any, out: any, v: CitationValidator): any {
  const root = a.reg.roots.find((x) => x.root_cause_id === rec.root_cause_id);
  const rem = out.recommendation.suggested_remediation;
  const proposals: any[] = [];
  if (rem) {
    const cites = (rem.citations ?? []).map((c: any) => v.check(c));
    proposals.push({ proposal_id: `AIP-${digest({ runId, packet: rec.packet_id, rem }).slice(0, 10)}`, kind: rem.kind, description: rem.description, target_reference: rem.target_reference, citations: cites, deterministically_supported: cites.length > 0 && cites.every((c: any) => c.status === 'VERIFIED'), status: 'advisory_proposed', requires: 'a deterministic STEP 4.5 remediation check, a signed resolution by the required authority and a validated versioned correction; nothing is applied from model output' });
  }
  const integrityOk = rec.findings.length > 0 && rec.findings.every((f: any) => f.evidence_integrity === 'VERIFIED');
  return {
    contract: 'openai-advisory-review',
    contract_version: '1.0',
    verification_run_id: runId,
    packet_id: rec.packet_id,
    root_cause_id: rec.root_cause_id,
    related_decisions: rec.related.decisions,
    rules: rec.related.rules,
    gaps: rec.related.gaps,
    requirements: rec.related.requirements,
    data_contracts: rec.related.data_contracts,
    advisory_outcome: integrityOk ? OUTCOME[out.recommendation.outcome] : 'HUMAN_REVIEW_REQUIRED',
    model_recommendation: out.recommendation.outcome,
    classifications: rec.findings.reduce((m: Record<string, number>, f: any) => ((m[f.classification] = (m[f.classification] ?? 0) + 1), m), {}),
    evidence_integrity: integrityOk ? 'all model citations verified locally' : 'one or more model citations or references were rejected; the model recommendation is not relied on',
    deterministic_support: { root_cause_status: a.det.results.find((r: any) => r.root_cause_id === rec.root_cause_id)?.status ?? null, note: 'deterministic source results remain the stronger evidence where they exist' },
    further_deterministic_checks: out.recommendation.further_deterministic_checks,
    proposals,
    human_review_required: true,
    authority: root?.required_authority ?? [],
    model_human_review: out.recommendation.human_review,
    binding: 'advisory only: does not resolve decisions, change requirements, reduce blockers or alter any gate',
  };
}

function runRecord(wf: Workflow, cfg: OpenAIConfig, runId: string, kind: 'review' | 'compare', mode: Mode, prov: Provider | null, started: string, set: PacketSet, el: Eligibility[] | null, sel: any, requests: any[], budget: Budget, results: any[], live: string[]): any {
  const anyLive = requests.some((r) => r.mode === 'LIVE' && r.outcome === 'response');
  const rec: any = {
    contract: 'openai-verification-run',
    contract_version: '1.0',
    verification_run_id: runId,
    kind,
    mode,
    provider: prov?.name ?? 'none',
    model: mode === 'MOCK' ? 'mock-deterministic-syntactic-v1' : cfg.model,
    configured_model: cfg.model,
    template_version: TEMPLATE_VERSION,
    started_at: started,
    finished_at: new Date().toISOString(),
    baseline_manifest_sha256: wf.run.manifestSha256,
    packet_source: { queue: set.queue?.id ?? null, pass_a: set.queue?.record.pass_a_record ?? null, pass_b: set.queue?.record.pass_b_record ?? null, integrity: set.checks },
    selection: el ? { eligible: el.filter((e) => e.eligible).length, blocked: sel.blocked.map((b: any) => ({ packet: b.packet_id, reasons: b.reasons })), selected: sel.selected.map((s: any) => ({ packet: s.packet_id, root_cause_id: s.root_cause_id, category: s.category, deterministic_status: s.deterministic_status })), not_selected: sel.not_selected, max_packets: cfg.selection.max_packets } : { from_review_run: true },
    requests: requests.map((r) => ({ ...r, error: r.error ? { ...r.error, message: redact(String(r.error.message ?? ''), cfg) } : null })),
    usage: { calls: budget.calls, input_tokens: budget.input_tokens, cached_input_tokens: budget.cached_input_tokens, output_tokens: budget.output_tokens, cost_usd: Math.round(budget.cost_usd * 1e6) / 1e6, usage_source: !budget.calls ? 'none' : prov?.network ? 'provider_reported' : 'mock_estimate', pricing: cfg.pricing },
    budget: cfg.budget,
    results,
    live_status: anyLive ? 'LIVE_EXECUTED_WITH_VERIFIED_AUTHORIZATION' : mode === 'LIVE' ? `${LIVE_NOT_AUTHORIZED}: ${live.join('; ') || 'no request passed the egress guard'}` : `${LIVE_NOT_AUTHORIZED} (mode ${mode}; no network request was made)`,
  };
  const v = wf.run.ctx.contracts.validate('openai/verification-run', rec);
  if (!v.valid) throw new OrchestratorError('verification run violates its contract', 'CONTRACT', v.errors);
  return rec;
}

export function listRuns(wf: Workflow): any[] {
  return wf.store.list(OPENAI_DIR).filter((f) => /^OVR-\d{4}\.json$/.test(f)).map((f) => wf.store.readRecord(OPENAI_DIR, f));
}

export function usageSummary(wf: Workflow): any {
  const runs = listRuns(wf);
  const by = (src: string) => runs.filter((r) => r.usage.usage_source === src).reduce((m, r) => ({ calls: m.calls + r.usage.calls, input_tokens: m.input_tokens + r.usage.input_tokens, cached_input_tokens: m.cached_input_tokens + r.usage.cached_input_tokens, output_tokens: m.output_tokens + r.usage.output_tokens, cost_usd: Math.round((m.cost_usd + r.usage.cost_usd) * 1e6) / 1e6 }), { calls: 0, input_tokens: 0, cached_input_tokens: 0, output_tokens: 0, cost_usd: 0 });
  return {
    runs: runs.map((r) => ({ id: r.verification_run_id, kind: r.kind, mode: r.mode, calls: r.usage.calls, input_tokens: r.usage.input_tokens, output_tokens: r.usage.output_tokens, cost_usd: r.usage.cost_usd, usage_source: r.usage.usage_source, live_status: r.live_status })),
    actual_provider_usage: by('provider_reported'),
    simulated_mock_usage: by('mock_estimate'),
    note: 'Mock usage is a local estimate (characters / 4) used to exercise budgets; it is not OpenAI usage and has no cost.',
  };
}

export function sha(x: unknown): string {
  return digest(canonicalize(x));
}

export { buildSnapshot };
