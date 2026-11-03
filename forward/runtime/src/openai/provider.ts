/**
 * Verifier providers.
 *
 * OpenAIResponsesProvider uses the official SDK's Responses API with
 * Structured Outputs (text.format json_schema, strict) and store=false. The
 * SDK is given a guarded fetch: every HTTP request the SDK makes passes the
 * egress guard on its exact outgoing bytes first; a refused request never
 * reaches the network. SDK-internal retries are disabled (maxRetries 0) so
 * every retry goes through the engine and the guard again.
 *
 * MockProvider is offline and deterministic. Its default script is a purely
 * syntactic reader of the supplied excerpt (verbs, conditions, targets) and
 * a literal-overlap comparison; it is labelled as a mock everywhere and its
 * outputs are never semantic verification.
 */
import OpenAI from 'openai';
import { claimLiterals } from '../remediation/remediation';
import { EgressBlockedError } from '../blockers/egress';
import { apiKey, OpenAIConfig, redact } from './config';
import { unwrapData } from './prompts';

export interface ProviderRequest {
  pass: 'A' | 'B';
  packet_id: string;
  model: string;
  instructions: string;
  data_text: string;
  schema_name: string;
  schema: any;
  max_output_tokens: number;
  timeout_ms: number;
}

export interface ProviderResult {
  response_id: string | null;
  status: string;
  output_text: string | null;
  refusal: string | null;
  incomplete_reason: string | null;
  usage: { input_tokens: number; cached_input_tokens: number; output_tokens: number } | null;
  model: string | null;
}

export type ErrorKind = 'timeout' | 'rate_limit' | 'server' | 'connection' | 'auth' | 'bad_request' | 'egress_blocked' | 'other';

export class ProviderError extends Error {
  constructor(
    readonly kind: ErrorKind,
    readonly retryable: boolean,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface Provider {
  name: 'openai' | 'mock';
  network: boolean;
  call(req: ProviderRequest): Promise<ProviderResult>;
}

/** Strips JSON-Schema meta keywords that are not part of the Structured Outputs schema. */
export function apiSchema(schema: any): any {
  const { $schema: _s, $id: _i, title: _t, description: _d, ...rest } = schema;
  return rest;
}

/** The request body the Responses API receives (also what the guard re-derives). */
export function responsesBody(req: ProviderRequest, store: false) {
  return {
    model: req.model,
    instructions: req.instructions,
    input: [{ role: 'user' as const, content: [{ type: 'input_text' as const, text: req.data_text }] }],
    text: { format: { type: 'json_schema' as const, name: req.schema_name, schema: apiSchema(req.schema), strict: true } },
    max_output_tokens: req.max_output_tokens,
    store,
  };
}

export type Guard = (url: string, bodyText: string | null) => { allowed: boolean; reason: string };
type FetchLike = (url: any, init?: any) => Promise<any>;

export class OpenAIResponsesProvider implements Provider {
  readonly name = 'openai' as const;
  readonly network = true;
  constructor(
    private readonly cfg: OpenAIConfig,
    private readonly guard: Guard,
    private readonly transport: FetchLike = (u, i) => (globalThis as any).fetch(u, i),
  ) {}

  /** The only fetch the SDK may use: the egress guard runs on the final bytes before every network request. */
  private guardedFetch: FetchLike = async (url, init) => {
    const body = typeof init?.body === 'string' ? init.body : null;
    const g = this.guard(String(url), body);
    if (!g.allowed) throw new EgressBlockedError(`egress refused at the network boundary: ${g.reason}`);
    return this.transport(url, init);
  };

  async call(req: ProviderRequest): Promise<ProviderResult> {
    const key = apiKey(this.cfg);
    if (!key) throw new ProviderError('auth', false, `${this.cfg.api_key_env} is not set`);
    const client = new OpenAI({ apiKey: key, baseURL: this.cfg.endpoint.replace(/\/responses$/, ''), maxRetries: 0, timeout: req.timeout_ms, fetch: this.guardedFetch as any });
    try {
      const res: any = await client.responses.create(responsesBody(req, this.cfg.request.store) as any);
      let refusal: string | null = null;
      for (const item of res.output ?? []) for (const c of item?.content ?? []) if (c?.type === 'refusal') refusal = c.refusal ?? 'refused';
      return {
        response_id: res.id ?? null,
        status: res.status ?? 'unknown',
        output_text: typeof res.output_text === 'string' ? res.output_text : null,
        refusal,
        incomplete_reason: res.incomplete_details?.reason ?? null,
        usage: res.usage ? { input_tokens: res.usage.input_tokens ?? 0, cached_input_tokens: res.usage.input_tokens_details?.cached_tokens ?? 0, output_tokens: res.usage.output_tokens ?? 0 } : null,
        model: res.model ?? null,
      };
    } catch (e: any) {
      throw mapSdkError(e, this.cfg);
    }
  }
}

export function mapSdkError(e: any, cfg: OpenAIConfig): ProviderError {
  const msg = redact(String(e?.message ?? e), cfg);
  const chain = [e, e?.cause, e?.cause?.cause];
  if (chain.some((x) => x instanceof EgressBlockedError || x?.name === 'EgressBlockedError')) return new ProviderError('egress_blocked', false, redact(String(chain.find((x) => x?.name === 'EgressBlockedError')?.message ?? msg), cfg));
  if (e instanceof OpenAI.APIConnectionTimeoutError) return new ProviderError('timeout', true, msg);
  if (e instanceof OpenAI.RateLimitError) return new ProviderError('rate_limit', true, msg, 429);
  if (e instanceof OpenAI.InternalServerError) return new ProviderError('server', true, msg, e.status ?? 500);
  if (e instanceof OpenAI.ConflictError) return new ProviderError('server', true, msg, 409);
  if (e instanceof OpenAI.AuthenticationError || e instanceof OpenAI.PermissionDeniedError) return new ProviderError('auth', false, msg, e.status ?? null);
  if (e instanceof OpenAI.BadRequestError || e instanceof OpenAI.UnprocessableEntityError || e instanceof OpenAI.NotFoundError) return new ProviderError('bad_request', false, msg, e.status ?? null);
  if (e instanceof OpenAI.APIConnectionError) return new ProviderError('connection', true, msg);
  if (e instanceof ProviderError) return e;
  return new ProviderError('other', false, msg);
}

/* ------------------------------------------------------------------ */
/* offline deterministic mock                                          */
/* ------------------------------------------------------------------ */

export type MockScript = (req: ProviderRequest, attempt: number) => Promise<ProviderResult> | ProviderResult;

const VERB = /^\s*(MOVE|ADD|SUBTRACT|MULTIPLY|DIVIDE|COMPUTE|IF|EVALUATE|WHEN|PERFORM|GO\s+TO|CALL|READ|WRITE|REWRITE|DELETE|OPEN|CLOSE|START|EXEC\s+SQL|DISPLAY|SET|INITIALIZE|STRING|UNSTRING|GOBACK|STOP\s+RUN|EXIT)\b/i;
const KIND: Record<string, string> = { MOVE: 'data_movement', SET: 'data_movement', INITIALIZE: 'data_movement', STRING: 'data_movement', UNSTRING: 'data_movement', ADD: 'arithmetic', SUBTRACT: 'arithmetic', MULTIPLY: 'arithmetic', DIVIDE: 'arithmetic', COMPUTE: 'arithmetic', IF: 'condition', EVALUATE: 'condition', WHEN: 'condition', PERFORM: 'control_transfer', GO: 'control_transfer', GOBACK: 'control_transfer', STOP: 'control_transfer', EXIT: 'control_transfer', CALL: 'call', READ: 'file_io', WRITE: 'file_io', REWRITE: 'file_io', DELETE: 'file_io', OPEN: 'file_io', CLOSE: 'file_io', START: 'file_io', EXEC: 'database', DISPLAY: 'other' };

/** Program text of a raw line (fixed-format sequence and indicator areas removed; null for comments). */
function code(raw: string): string | null {
  if (/^[ 0-9]{6}[*/]/.test(raw)) return null;
  if (/^[ 0-9]{6}[ \-dD$]/.test(raw)) return raw.slice(7, 72).trimEnd();
  return raw.trimEnd();
}

export function mockPassA(data: any): any {
  const operations: any[] = [];
  for (const s of data.sources ?? []) {
    for (const l of s.excerpt ?? []) {
      const c = code(l.text);
      if (!c || !c.trim()) continue;
      const m = VERB.exec(c);
      if (!m) continue;
      const verb = m[1].toUpperCase().split(/\s+/)[0];
      const t = c.trim().replace(/\.$/, '');
      const to = /\b(?:TO|GIVING|INTO)\s+([A-Z][A-Z0-9-]*)/i.exec(t)?.[1] ?? null;
      const target = /^(?:PERFORM|CALL|GO\s+TO)\s+'?([A-Z0-9-]+)/i.exec(t)?.[1] ?? null;
      operations.push({
        kind: KIND[verb] ?? 'other',
        description: `[MOCK, syntactic only] line ${l.line}: ${t}`,
        conditions: ['IF', 'EVALUATE', 'WHEN'].includes(verb) ? [t] : /\bUNTIL\b/i.test(t) ? [t.slice(t.toUpperCase().indexOf('UNTIL'))] : [],
        data_read: [],
        data_modified: to && ['data_movement', 'arithmetic'].includes(KIND[verb]) ? [to.toUpperCase()] : [],
        calculation: KIND[verb] === 'arithmetic' ? t : null,
        execution_effect: target ? `control passes to ${target}` : null,
        citations: [{ path: s.path, line_start: l.line, line_end: l.line, quoted_text: c.trim(), permanent_id: null }],
      });
    }
  }
  return {
    packet_id: data.packet_id,
    pass: 'A',
    operations: operations.slice(0, 40),
    missing_dependencies: [],
    cannot_establish: ['[MOCK] business intent and run-time behaviour are not assessed by the offline mock', ...(data.missing_context ?? []).slice(0, 5)],
    untrusted_instructions_observed: [],
  };
}

export function mockPassB(data: any): any {
  const quoted = (data.independent_interpretation?.operations ?? []).flatMap((o: any) => o.citations.map((c: any) => String(c.quoted_text).toUpperCase()));
  const comparisons = (data.existing_interpretations ?? []).map((x: any) => {
    const lits = claimLiterals(x.text).map((l) => l.toUpperCase());
    const found = lits.filter((l) => quoted.some((q: string) => q.includes(l)));
    const classification = !lits.length ? 'INSUFFICIENT_EVIDENCE' : found.length === lits.length ? 'PARTIAL_AGREEMENT' : found.length ? 'PARTIAL_AGREEMENT' : 'DISAGREEMENT';
    return {
      interpretation_id: x.interpretation_id,
      interpretation_source: x.source,
      classification,
      differences: lits.filter((l) => !found.includes(l)).slice(0, 5).map((l) => ({ aspect: 'assumption', independent_reading: `[MOCK] value ${l} does not occur in the independently cited lines`, existing_reading: `the interpretation states ${l}`, citations: [] })),
      explanation: `[MOCK, literal overlap only] ${found.length}/${lits.length} stated value(s) occur in the independently cited lines; semantics were not compared.`,
      citations: [],
    };
  });
  const disagree = comparisons.some((c: any) => c.classification === 'DISAGREEMENT');
  return { packet_id: data.packet_id, pass: 'B', comparisons, recommendation: { outcome: disagree ? 'HUMAN_REVIEW_REQUIRED' : 'EVIDENCE_INSUFFICIENT', human_review: disagree ? 'both' : 'technical', further_deterministic_checks: [], suggested_remediation: null }, untrusted_instructions_observed: [] };
}

const est = (s: string) => Math.ceil(s.length / 4);

export class MockProvider implements Provider {
  readonly name = 'mock' as const;
  readonly network = false;
  readonly calls: ProviderRequest[] = [];
  private attempts = new Map<string, number>();
  constructor(private readonly script?: MockScript) {}
  async call(req: ProviderRequest): Promise<ProviderResult> {
    this.calls.push(req);
    const k = `${req.packet_id}|${req.pass}`;
    const attempt = (this.attempts.get(k) ?? 0) + 1;
    this.attempts.set(k, attempt);
    if (this.script) return this.script(req, attempt);
    const data = unwrapData(req.data_text);
    const out = JSON.stringify(req.pass === 'A' ? mockPassA(data) : mockPassB(data));
    return { response_id: `mock_${req.pass}_${req.packet_id}_${attempt}`, status: 'completed', output_text: out, refusal: null, incomplete_reason: null, usage: { input_tokens: est(req.instructions + req.data_text), cached_input_tokens: 0, output_tokens: est(out) }, model: 'mock-deterministic-syntactic-v1' };
  }
}
