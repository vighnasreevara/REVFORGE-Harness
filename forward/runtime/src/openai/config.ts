/**
 * OpenAI verification configuration (config `openai_verification`, validated
 * by the forward-config contract). Strict, disabled-by-default values; the
 * model is never substituted. The API key is read only from the configured
 * environment variable and never stored, printed or treated as authorization.
 */
import { RuntimeContext } from '../core/config';

export type Mode = 'OFFLINE' | 'MOCK' | 'LIVE';

export interface OpenAIConfig {
  mode: Mode;
  network_enabled: boolean;
  provider: 'openai';
  endpoint: string;
  model: string | null;
  model_verification?: { source?: string; verified_on?: string; capabilities?: string[]; context_window?: number; max_output_tokens?: number; note?: string };
  api_key_env: string;
  request: { max_output_tokens: number; timeout_ms: number; max_retries: number; retry_base_delay_ms: number; concurrency: number; store: false };
  budget: { max_calls_per_run: number; max_input_tokens_per_run: number; max_output_tokens_per_run: number; max_cost_usd_per_run: number };
  pricing: { currency: 'USD'; input_per_1m: number; cached_input_per_1m: number; output_per_1m: number; source?: string; verified_on?: string } | null;
  selection: { max_packets: number; category_priority: string[]; prepare_also_categories?: string[] };
  template_version: string;
  source_export: { required_roles: string[]; purpose: 'independent_semantic_verification' };
}

export const DEFAULT_OPENAI: OpenAIConfig = {
  mode: 'OFFLINE',
  network_enabled: false,
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1/responses',
  model: null,
  api_key_env: 'OPENAI_API_KEY',
  request: { max_output_tokens: 6000, timeout_ms: 180000, max_retries: 2, retry_base_delay_ms: 2000, concurrency: 2, store: false },
  budget: { max_calls_per_run: 10, max_input_tokens_per_run: 200000, max_output_tokens_per_run: 60000, max_cost_usd_per_run: 5 },
  pricing: null,
  selection: { max_packets: 5, category_priority: ['contradictory_business_rules', 'unsupported_business_interpretation', 'data_layout_inconsistency', 'control_flow_uncertainty', 'runtime_behavior_uncertainty', 'incorrect_source_citation', 'missing_evidence'], prepare_also_categories: [] },
  template_version: 'revforge-ovr-1.0',
  source_export: { required_roles: ['data_owner'], purpose: 'independent_semantic_verification' },
};

/** Loads and validates the configuration; errors are returned, never silently defaulted around. */
export function loadOpenAIConfig(ctx: RuntimeContext, override?: Partial<OpenAIConfig>): { config: OpenAIConfig; errors: string[] } {
  const raw: any = (ctx.config as any).openai_verification;
  const merged: any = raw ? { ...DEFAULT_OPENAI, ...raw, request: { ...DEFAULT_OPENAI.request, ...(raw.request ?? {}) }, budget: { ...DEFAULT_OPENAI.budget, ...(raw.budget ?? {}) }, selection: { ...DEFAULT_OPENAI.selection, ...(raw.selection ?? {}) } } : { ...DEFAULT_OPENAI };
  const cfg = { ...merged, ...(override ?? {}) } as OpenAIConfig;
  const errors: string[] = [];
  if (raw) {
    const v = ctx.contracts.validate('forward-config', { ...(ctx.config as any), openai_verification: { ...cfg } });
    if (!v.valid) errors.push(...v.errors.filter((e) => e.includes('openai_verification')));
  }
  if (cfg.network_enabled && cfg.mode !== 'LIVE') errors.push('network_enabled is true but mode is not LIVE');
  if (cfg.model !== null && !cfg.model_verification?.verified_on) errors.push(`model ${cfg.model} has no recorded capability verification (model_verification.verified_on)`);
  if (cfg.pricing === null) errors.push('pricing is not configured: cost accounting will report null cost');
  return { config: cfg, errors };
}

/** True when an API key is present; the key itself never leaves this function. */
export function apiKeyPresent(cfg: OpenAIConfig): boolean {
  const k = process.env[cfg.api_key_env];
  return typeof k === 'string' && k.trim().length > 0;
}

export function apiKey(cfg: OpenAIConfig): string | null {
  const k = process.env[cfg.api_key_env];
  return typeof k === 'string' && k.trim() ? k.trim() : null;
}

const KEY_LIKE = /\bsk-[A-Za-z0-9_-]{8,}\b/g;

/** Removes the configured API key and anything key-shaped from text destined for records or logs. */
export function redact(text: string, cfg?: OpenAIConfig): string {
  let out = String(text ?? '');
  const k = cfg ? apiKey(cfg) : null;
  if (k) out = out.split(k).join('[REDACTED_API_KEY]');
  return out.replace(KEY_LIKE, '[REDACTED_KEY]').replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]');
}

export function costUsd(cfg: OpenAIConfig, u: { input_tokens: number; cached_input_tokens: number; output_tokens: number }): number | null {
  if (!cfg.pricing) return null;
  const p = cfg.pricing;
  const fresh = Math.max(0, u.input_tokens - u.cached_input_tokens);
  return Math.round(((fresh * p.input_per_1m + u.cached_input_tokens * p.cached_input_per_1m + u.output_tokens * p.output_per_1m) / 1_000_000) * 1e6) / 1e6;
}
