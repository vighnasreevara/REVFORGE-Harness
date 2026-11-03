/**
 * `verification openai <action>`: STEP 5 independent verification.
 * Diagnostics never print source content or credentials.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { loadWorkflow, OrchestratorError } from '../orchestrator/orchestrator';
import { analyse } from '../blockers/pipeline';
import { authorizationStates, authorizationTemplate, importAuthorization, importRevocation } from '../openai/authorization';
import { apiKeyPresent, loadOpenAIConfig, Mode, redact } from '../openai/config';
import { eligibility, LIVE_NOT_AUTHORIZED, loadPacketSet, runCompare, runReview, select, usageSummary } from '../openai/engine';
import { openaiReport } from '../openai/report';

type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);
const list = (f: Flags, k: string) => str(f, k)?.split(',').map((x) => x.trim()).filter(Boolean);

function sdkVersion(): string | null {
  try {
    const dir = path.dirname(require.resolve('openai'));
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).version;
  } catch {
    return null;
  }
}

export function openaiCommand(ctx: RuntimeContext, action: string | undefined, flags: Flags, json: boolean, out: Out, err: Out): number | Promise<number> {
  const runId = str(flags, 'run') ?? 'latest';
  const print = (o: unknown, text: () => void) => (json ? out(JSON.stringify(o, null, 2)) : text());
  const fail = (e: unknown) => {
    const { config } = loadOpenAIConfig(ctx);
    if (e instanceof OrchestratorError) {
      err(`verification openai ${action}: ${redact(e.message, config)}`);
      for (const d of e.details) err(`  - ${redact(d, config)}`);
      return 1;
    }
    err(`verification openai ${action}: ${redact((e as Error)?.message ?? String(e), config)}`);
    return 1;
  };
  try {
    const wf = loadWorkflow(ctx, runId);
    const { config: cfg, errors } = loadOpenAIConfig(ctx);
    const modeOf = (): Mode => {
      const m = (str(flags, 'mode') ?? cfg.mode).toUpperCase();
      if (!['OFFLINE', 'MOCK', 'LIVE'].includes(m)) throw new OrchestratorError(`unknown mode ${m} (OFFLINE | MOCK | LIVE)`, 'USAGE');
      return m as Mode;
    };
    switch (action) {
      case 'doctor': {
        const auth = authorizationStates(wf, cfg);
        const set = loadPacketSet(wf);
        const blockers = [
          ...(cfg.network_enabled ? [] : ['openai_verification.network_enabled is false (default)']),
          ...(cfg.mode === 'LIVE' ? [] : [`configured mode is ${cfg.mode}`]),
          ...(apiKeyPresent(cfg) ? [] : [`${cfg.api_key_env} is not set`]),
          ...(cfg.model ? [] : ['no model configured']),
          ...(auth.trust.usable ? [] : [`no usable trust anchor (${auth.trust.problems.join('; ') || 'not configured'})`]),
          ...(auth.states.some((s) => s.valid) ? [] : [auth.states.length ? 'no imported source-export authorization is currently valid' : 'no signed source-export authorization has been imported']),
        ];
        const r = {
          config_valid: errors.filter((e) => !/pricing/.test(e)).length === 0,
          config_errors: errors,
          sdk: { package: 'openai', version: sdkVersion(), api: 'Responses API (client.responses.create) with Structured Outputs text.format json_schema strict' },
          mode: cfg.mode,
          network_enabled: cfg.network_enabled,
          endpoint: cfg.endpoint,
          model: cfg.model,
          model_verification: cfg.model_verification ?? null,
          api_key_present: apiKeyPresent(cfg),
          pricing: cfg.pricing,
          budget: cfg.budget,
          request: cfg.request,
          trust_anchor: { usable: auth.trust.usable, problems: auth.trust.problems },
          authorizations: auth.states.map((s) => ({ id: s.authorization_id, record: s.record, valid: s.valid, failed: s.checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`) })),
          packet_set: set.checks,
          live: blockers.length ? { status: LIVE_NOT_AUTHORIZED, reasons: blockers } : { status: 'LIVE_PREREQUISITES_MET', reasons: ['each request is still checked against the authorization scope at the network boundary'] },
        };
        print(r, () => {
          out(`OpenAI verification doctor — config ${r.config_valid ? 'valid' : 'INVALID'}${errors.length ? ` (${errors.join('; ')})` : ''}`);
          out(`  SDK openai@${r.sdk.version}: ${r.sdk.api}`);
          out(`  mode ${r.mode}; network enabled ${r.network_enabled}; endpoint ${r.endpoint}`);
          out(`  model ${r.model ?? 'not configured'} (verified ${cfg.model_verification?.verified_on ?? 'never'}: ${(cfg.model_verification?.capabilities ?? []).join(', ')})`);
          out(`  API key (${cfg.api_key_env}): ${r.api_key_present ? 'present (not shown; never authorization)' : 'not set'}`);
          out(`  pricing: ${cfg.pricing ? `$${cfg.pricing.input_per_1m}/$${cfg.pricing.cached_input_per_1m}/$${cfg.pricing.output_per_1m} per 1M input/cached/output (verified ${cfg.pricing.verified_on})` : 'not configured'}; budget ${JSON.stringify(cfg.budget)}`);
          out(`  trust anchor: ${auth.trust.usable ? 'usable' : `NOT usable — ${auth.trust.problems.join('; ')}`}`);
          out(`  source-export authorizations: ${auth.states.length ? auth.states.map((s) => `${s.authorization_id} ${s.valid ? 'VALID' : 'INVALID'}`).join(', ') : 'none'}`);
          for (const c of set.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] packets ${c.id}: ${c.detail}`);
          out(`  LIVE: ${r.live.status}`);
          for (const b of r.live.reasons) out(`    - ${b}`);
        });
        return 0;
      }
      case 'packets': {
        const a = analyse(wf);
        const set = loadPacketSet(wf);
        const el = eligibility(a, set, cfg);
        const sel = select(el, cfg, { max: str(flags, 'max') ? Number(str(flags, 'max')) : undefined });
        const why: Record<string, number> = {};
        for (const b of sel.blocked) for (const w of b.reasons) {
          const k = w.replace(/[0-9a-f]{12}…/g, '…').replace(/^stale source .*/, 'stale source hash');
          why[k] = (why[k] ?? 0) + 1;
        }
        const statuses = (set.queue?.record.packets ?? []).reduce((m: Record<string, number>, p: any) => ((m[p.status] = (m[p.status] ?? 0) + 1), m), {});
        const r = { packet_set: set.queue?.id ?? null, integrity: set.checks, packets: el.length, export_status: statuses, eligible: el.filter((e) => e.eligible).length, blocked: sel.blocked.length, blocked_reasons: why, selection_preview: sel.selected.map((s) => ({ packet: s.packet_id, category: s.category, root_cause_id: s.root_cause_id, deterministic_status: s.deterministic_status })) };
        print(r, () => {
          out(`${r.packet_set}: ${r.packets} packet(s); export status ${JSON.stringify(statuses)}; eligible ${r.eligible}; blocked ${r.blocked}`);
          for (const c of set.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
          for (const [k, v] of Object.entries(why)) out(`  blocked: ${v} × ${k}`);
          out(`  selection preview (max ${cfg.selection.max_packets}):`);
          for (const s of r.selection_preview) out(`    ${s.packet} ${s.category} (${s.root_cause_id}; deterministic ${s.deterministic_status})`);
        });
        return set.checks.every((c) => c.ok) ? 0 : 1;
      }
      case 'review':
      case 'compare': {
        const mode = modeOf();
        const run = action === 'review'
          ? runReview(wf, { mode, packets: list(flags, 'packets'), max: str(flags, 'max') ? Number(str(flags, 'max')) : undefined })
          : (() => {
              const rr = str(flags, 'review-run');
              if (!rr) throw new OrchestratorError('verification openai compare: --review-run OVR-NNNN is required', 'USAGE');
              return runCompare(wf, { mode, reviewRun: rr, packets: list(flags, 'packets') });
            })();
        return run.then((r: any) => {
          print(r, () => {
            out(`${r.verification_run_id} ${r.kind} (${r.mode}, provider ${r.provider}, model ${r.model}): ${r.results.length} packet(s)`);
            for (const x of r.results) out(`  ${x.packet}: ${x.status}${x.reasons.length ? ` — ${x.reasons.join('; ').slice(0, 300)}` : ''}`);
            if (r.selection?.blocked) out(`  not eligible: ${r.selection.blocked.length}; eligible but not selected: ${r.selection.not_selected}`);
            out(`  usage: ${r.usage.calls} call(s), ${r.usage.input_tokens}/${r.usage.output_tokens} tokens (${r.usage.usage_source}), $${r.usage.cost_usd}`);
            out(`  ${r.live_status}`);
          });
          return r.results.some((x: any) => x.status === 'failed') ? 1 : 0;
        }, fail);
      }
      case 'report': {
        const r = openaiReport(wf, cfg);
        const file = path.resolve(str(flags, 'out') ?? path.join(ctx.forwardDir, 'reports', 'openai-verification-report.md'));
        fs.writeFileSync(file, r.markdown, 'utf8');
        fs.writeFileSync(file.replace(/\.md$/, '.json'), JSON.stringify(r.data, null, 2) + '\n', 'utf8');
        print({ ...r.data, written: file }, () => out(`report written to ${file}`));
        return 0;
      }
      case 'usage': {
        const u = usageSummary(wf);
        print(u, () => {
          for (const r of u.runs) out(`  ${r.id} ${r.kind} ${r.mode}: ${r.calls} call(s), ${r.input_tokens}/${r.output_tokens} tokens, $${r.cost_usd} (${r.usage_source})`);
          out(`  actual provider usage: ${JSON.stringify(u.actual_provider_usage)}`);
          out(`  simulated mock usage: ${JSON.stringify(u.simulated_mock_usage)}`);
          out(`  ${u.note}`);
        });
        return 0;
      }
      case 'authorize':
      case 'revoke': {
        const file = str(flags, 'file');
        if (!file) throw new OrchestratorError(`verification openai ${action}: --file <signed json> is required`, 'USAGE');
        const r = action === 'authorize' ? importAuthorization(wf, cfg, path.resolve(file)) : importRevocation(wf, cfg, path.resolve(file));
        print(r, () => {
          out(r.imported ? `IMPORTED ${r.record}` : 'REJECTED (recorded in the audit log)');
          for (const c of r.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
        });
        return r.imported ? 0 : 1;
      }
      case 'authorization-request': {
        const ids = list(flags, 'packets');
        if (!ids?.length) throw new OrchestratorError('verification openai authorization-request: --packets OAV-...,OAV-... is required', 'USAGE');
        const set = loadPacketSet(wf);
        const t = authorizationTemplate(wf, cfg, ids, [...set.passA.values()]);
        const file = str(flags, 'out');
        if (file) fs.writeFileSync(path.resolve(file), JSON.stringify(t, null, 2) + '\n', 'utf8');
        print(t, () => out(file ? `unsigned authorization written to ${path.resolve(file)}: a data owner reviews it, sets the ID, signer and expiry, and signs it outside the harness` : JSON.stringify(t, null, 2)));
        return 0;
      }
      default:
        err('verification openai: use doctor | packets | prepare | review --mode OFFLINE|MOCK|LIVE [--max N] [--packets ...] | compare --review-run OVR-NNNN [--mode ...] | report [--out FILE] | usage | authorize --file F | revoke --file F | authorization-request --packets ... [--out FILE]');
        return 2;
    }
  } catch (e) {
    return fail(e);
  }
}
