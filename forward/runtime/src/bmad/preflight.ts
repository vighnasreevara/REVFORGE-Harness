/**
 * BMad execution preflight (STEP 8). Before any future real BMad AI workflow
 * the orchestrator — never BMad — runs every check below and seals the
 * result. It never launches anything. In STEP 8 the launch boundary is not
 * technically enforceable, so every preflight refuses.
 *
 * Launch boundary (what was established about Claude Code 2.x as the runner):
 *   - Model requests go from the Claude Code CLI over TLS directly to the
 *     provider. REVFORGE cannot intercept or verify request content at the
 *     network boundary (an HTTPS proxy would only see the destination host),
 *     so no network-level enforcement is claimed.
 *   - File tools run as the operator's OS user. Tool permission rules and
 *     --restricted are enforced by the CLI itself, not by the operating
 *     system; there is no container, separate user or mount boundary that
 *     makes files outside the workspace unreadable.
 * The controls that do exist are listed; the gaps make LIVE blocked.
 * Network: the boundary is default-deny. `network_isolation` and
 * `enforceable_launch_boundary` can pass for LIVE only with a current,
 * executed, fully passed provider-egress self-test (`bmad executor
 * egress-test`) whose recorded hashes match the current egress-proxy.mjs and
 * sandbox.sh. Every other check (signatures, disclosure authorization,
 * live_execution.requested, limits) still applies.
 */
import * as path from 'path';
import { buildSnapshot } from '../approval/snapshot';
import { evaluateScope, parseSelector } from '../approval/scope';
import { sha256File } from '../core/fsutil';
import { mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { authorizationStates } from '../openai/authorization';
import { loadOpenAIConfig } from '../openai/config';
import { disclosureStatus, scopeSourceFiles } from '../disclosure/disclosure';
import { BMAD_RECORDS, evaluateEligibility } from './adapter';
import { disabledReason, executionManifest, executorDoctor, inspectWorkspaces, Probe, PROVIDER, defaultProbe } from './executor';
import { buildMapping } from './mapping';
import { filesUnder } from './release';
import { HostAssessment, IsolationTestReport, sandboxScript } from '../isolation/isolation';
import { egressEvidence, EgressTestReport, PROVIDER_ALLOWLIST } from '../isolation/egress';
import * as fs from 'fs';

export const RUNNER = { provider: 'anthropic', service: 'claude-code-cli' };

export const ISOLATION_REPORT = (ctx: any) => path.join(path.dirname(sandboxScript(ctx)), 'isolation-test-report.json');
const MAX_REPORT_AGE_MS = 7 * 24 * 3600000;

/** The recorded offline isolation test report, if it is complete, passed, recent and for the current sandbox launcher. */
export function isolationEvidence(ctx: any, at = new Date()): { tested: boolean; report: IsolationTestReport | null; problems: string[] } {
  const f = ISOLATION_REPORT(ctx);
  if (!fs.existsSync(f)) return { tested: false, report: null, problems: ['no isolation test report: run bmad isolation test --record'] };
  const r: IsolationTestReport = JSON.parse(fs.readFileSync(f, 'utf8'));
  const problems: string[] = [];
  if (!r.executed) problems.push(`the isolation suite was not executed: ${r.reason_not_executed}`);
  if (!r.all_passed) problems.push(`isolation checks failed: ${[...r.host_checks, ...r.sandbox_checks].filter((c) => !c.passed).map((c) => c.test).join(', ')}`);
  if (r.sandbox_sha256 !== sha256File(sandboxScript(ctx))) problems.push('the sandbox launcher changed since it was tested');
  if (at.getTime() - Date.parse(r.executed_at) > MAX_REPORT_AGE_MS) problems.push(`the isolation test report is older than 7 days (${r.executed_at})`);
  return { tested: !problems.length, report: r, problems };
}

export type EgressEvidence = { verified: boolean; report: EgressTestReport | null; problems: string[] };

export function launchBoundary(ws: string | null, iso?: { tested: boolean; problems: string[]; runnerInside?: boolean; egress?: { verified: boolean; problems: string[] } }): { network_enforcement: boolean; network_default_deny: boolean; filesystem_isolation: boolean; enforceable: boolean; controls: string[]; gaps: string[] } {
  const tested = !!iso?.tested;
  // Provider egress counts only on top of a tested boundary: the proxy narrows a default-deny network, it never replaces it.
  const egress = tested && !!iso?.egress?.verified;
  const gaps: string[] = [];
  if (!tested) gaps.push(`filesystem: no tested whole-process boundary${iso?.problems.length ? ` (${iso.problems.join('; ')})` : ''}; Claude Code file tools would run as the operator OS user and permission rules are enforced by the CLI, not the OS`);
  if (!egress && !!iso?.egress?.verified) gaps.push('network: provider egress is verified, but it counts only on top of a tested whole-process boundary, which is missing');
  else if (!egress) gaps.push(`network: the tested boundary has no network at all; a LIVE run needs the provider-egress component (egress-proxy.mjs + sandbox.sh --net egress, allowlist ${PROVIDER_ALLOWLIST.join(', ')}), which exists but is not verified on this host${iso?.egress?.problems.length ? ` (${iso.egress.problems.join('; ')})` : ''}: run bmad executor egress-test. Even then, TLS to the provider is end-to-end: request content cannot be inspected, so only the minimal workspace limits what can be disclosed`);
  if (!iso?.runnerInside) gaps.push('runner: Claude Code and Node are not installed inside the isolated Linux environment, so the runner cannot execute within the boundary');
  return {
    network_enforcement: egress,
    network_default_deny: tested,
    filesystem_isolation: tested,
    enforceable: tested && egress && !!iso?.runnerInside,
    controls: [
      ...(egress ? [`provider egress verified on this host: CONNECT-only allowlist proxy outside the namespaces (${PROVIDER_ALLOWLIST.join(', ')}), loopback-only network namespace, no DNS, no other route; destination enforcement only (TLS payloads are end-to-end and not inspected)`] : []),
      tested ? 'whole-process boundary (WSL2 namespaces + pivot_root, read-only source/inputs, single writable output, no network, no capabilities, no_new_privs) tested offline on this host' : `isolated workspace ${ws ? 'with a hash-verified BMad installation' : '(none installed)'} and isolated HOME`,
      'headless run with --restricted (no Bash/PowerShell/code execution), --disallowedTools WebFetch,WebSearch,Bash,PowerShell',
      '--allowedTools Read,Glob,Grep,Write,Edit with --permission-mode dontAsk (anything else is denied, never prompted)',
      '--strict-mcp-config (no MCP servers) and --setting-sources project (no user settings)',
      '--max-budget-usd from the signed authorization',
      'outputs accepted only through the receipt validator (contract, hashes, output location, scope digest)',
      'sealed preflight, packet, receipt and audit records',
    ],
    gaps,
  };
}

export function preflight(wf: Workflow, bindingKey: string, scope: string, opts: { probe?: Probe; record?: boolean; isolation?: { tested: boolean; report: IsolationTestReport | null; problems: string[] }; egress?: EgressEvidence; assessment?: HostAssessment | null } = {}): any {
  const run = () => {
    const ctx = wf.run.ctx;
    const probe = opts.probe ?? defaultProbe;
    const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
    const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
    const snap = buildSnapshot(wf);
    let ev: any = null;
    try {
      ev = evaluateScope(snap, parseSelector(scope));
      add('scope', true, `${ev.selector_text} (digest ${ev.scope_sha256.slice(0, 16)}…, ${ev.readiness})`);
    } catch (e) {
      add('scope', false, (e as Error).message);
    }
    const e = evaluateEligibility(wf, bindingKey, scope, 'LIVE');
    const ck = (id: string) => e.record.checks.find((c: any) => c.id === id);
    const g2 = ['gate_G1', 'g2_reverified', 'exact_scope'].map(ck).filter(Boolean);
    add('g2_exact_scope', g2.length === 3 && g2.every((c: any) => c.ok), g2.filter((c: any) => !c.ok).map((c: any) => c.detail).join(' | ') || 'G1 PASS for exactly this scope, re-verified now');
    add('workflow_state', !!ck('workflow_state')?.ok, ck('workflow_state')?.detail ?? 'unknown');
    add('release_pinned', !!ck('release_verified')?.ok, ck('release_verified')?.detail ?? 'unknown');
    const disabled = disabledReason(wf.run.ctx, e.binding.binding_id);
    add('binding_and_agent', !!ck('binding_valid')?.ok && !disabled, disabled ?? ck('binding_valid')?.detail ?? 'unknown');

    // Provider-specific authorization: only an anthropic / claude-code-cli disclosure authorization can count.
    const st = disclosureStatus(wf, { provider: RUNNER.provider, service: RUNNER.service, scope: ev?.selector_text ?? scope, workflow: e.binding.workflow_id }, snap);
    const auth = st.valid[st.valid.length - 1] ?? null;
    const openaiAuths = (() => {
      try {
        return authorizationStates(wf, loadOpenAIConfig(ctx).config).states.length;
      } catch {
        return 0;
      }
    })();
    add('provider_authorization', !!auth, auth ? `${auth.authorization_id} (${auth.record_id}) authorizes ${RUNNER.provider}/${RUNNER.service} for ${auth.scope} and ${e.binding.workflow_id}` : `no valid signed disclosure authorization for ${RUNNER.provider}/${RUNNER.service}, scope ${ev?.selector_text ?? scope}, workflow ${e.binding.workflow_id} (${st.considered} disclosure record(s) considered${st.rejected.length ? `; rejected: ${st.rejected.map((r) => `${r.record_id}: ${r.reasons[0]}`).join(' | ')}` : ''}); ${openaiAuths} OpenAI source-export authorization(s) exist and are not applicable to Claude`);

    const scopeFiles = ev ? scopeSourceFiles(snap, ev.selector_text) : [];
    const authorized = new Map<string, string>((auth?.authorization.source_files ?? []).map((f: any) => [f.path, f.sha256]));
    const changed = scopeFiles.filter((f) => authorized.has(f.path) && authorized.get(f.path) !== f.sha256);
    add('source_hashes_current', snap.g0.status === 'PASS' && !changed.length && !!auth, snap.g0.status !== 'PASS' ? `baseline not intact (baseline pre-check ${snap.g0.status})` : !auth ? 'no authorization to compare source hashes against' : changed.length ? `source changed since authorization: ${changed.map((f) => f.path).join(', ')}` : `${authorized.size} authorized file(s) match the current source`);

    // What would be exposed: the scope's source files the mapped inputs derive from, plus every non-vendor workspace file.
    const exposed = new Set<string>();
    try {
      const m = buildMapping(wf, e.binding, scope, e.loaded.mapping, [], snap);
      for (const r of [...m.provenance.requirements, ...m.provenance.runtime_requirements]) for (const ref of r.source_refs ?? []) if (ref?.relative_path) exposed.add(ref.relative_path);
    } catch {
      /* mapping errors are reported by other checks */
    }
    for (const f of scopeFiles) exposed.add(f.path);
    const ws = inspectWorkspaces(ctx).find((w) => w.bound_skills_verified) ?? null;
    if (ws) for (const f of filesUnder(ws.path)) if (!/^(\.claude|_bmad|_bmad-output)\//.test(f) && f !== 'README.md') exposed.add(`workspace:${f}`);
    const would = [...exposed].sort();
    const unauthorized = would.filter((f) => !authorized.has(f));
    const bytes = scopeFiles.filter((f) => authorized.has(f.path)).reduce((n, f) => n + f.bytes, 0);
    const lim = auth?.authorization.limits;
    add('authorized_content_only', !!auth && !unauthorized.length && (!lim || (authorized.size <= lim.max_files && bytes <= lim.max_bytes)), !auth ? `${would.length} file(s) would be exposed and none is authorized` : unauthorized.length ? `unauthorized file(s) would be exposed: ${unauthorized.join(', ')}` : `only authorized files (${authorized.size}, ${bytes} bytes) would be exposed`);

    const manifest = executionManifest(wf, bindingKey, scope, { probe, maxBudgetUsd: lim?.max_cost_usd });
    const a = manifest.command.args;
    const toolsOk = ['--restricted', '--strict-mcp-config', '--disallowedTools', '--allowedTools', '--permission-mode', '--no-session-persistence'].every((x) => a.includes(x)) && a[a.indexOf('--permission-mode') + 1] === 'dontAsk';
    add('tools_and_outputs', toolsOk && manifest.workspace.isolated, toolsOk ? `restricted tool set; outputs only through the receipt validator into the agent's bmad output directory; workspace isolated ${manifest.workspace.isolated}` : 'the launch command lacks a required restriction');
    const d = executorDoctor(ctx, probe);
    const runtimeOk = d.ok_for_installation && !!e.loaded.config?.live_execution.requested && !disabled;
    add('runtime_execution_authorization', runtimeOk, !d.ok_for_installation ? 'isolated executor installation not verified' : !e.loaded.config?.live_execution.requested ? 'bindings.json live_execution.requested is false' : disabled ?? 'executor installation verified and LIVE requested');
    const priorRuns = wf.store.list(BMAD_RECORDS).filter((f) => /^(BRC|BEX)-/.test(f)).map((f) => wf.store.readRecord(BMAD_RECORDS, f)).filter((r: any) => r.mode === 'LIVE' || r.status === 'failed').length;
    add('limits', !!lim && a.includes('--max-budget-usd') && priorRuns < lim.max_runs, !lim ? 'no authorized limits (cost, files, bytes, runs)' : `cost <= $${lim.max_cost_usd} (--max-budget-usd), files <= ${lim.max_files}, bytes <= ${lim.max_bytes}, runs ${priorRuns}/${lim.max_runs}; per-request token limits are not exposed by the Claude Code CLI`);
    // Whole-process isolation (STEP 9): the offline-tested boundary, a minimal workspace plan, and the runner inside it.
    const iso = opts.isolation ?? isolationEvidence(ctx, snap.at);
    const eg = opts.egress ?? egressEvidence(ctx, snap.at);
    const host = opts.assessment ?? null;
    const runnerInside = !!host && !!host.primitives.linux_claude?.available && !!host.primitives.linux_node?.available;
    add('workspace_manifest', !!auth && !unauthorized.length, !auth ? 'no minimal workspace can be planned without an authorization naming its files' : unauthorized.length ? `the planned workspace would contain unauthorized files: ${unauthorized.join(', ')}` : `planned workspace: ${authorized.size} authorized source file(s) read-only, mapped inputs read-only, one output directory`);
    add('filesystem_isolation', iso.tested, iso.tested ? `whole-process boundary tested offline (${iso.report!.executed_at}, launcher ${String(iso.report!.sandbox_sha256).slice(0, 12)}...)` : iso.problems.join('; '));
    const egressOk = iso.tested && eg.verified;
    add('network_isolation', egressOk, !iso.tested ? `network isolation not tested${eg.verified ? ' (provider egress is verified, but it counts only on top of a tested whole-process boundary)' : ''}` : egressOk ? `default-deny verified (no route, no DNS); provider egress verified (${eg.report!.executed_at}, proxy ${String(eg.report!.proxy_sha256).slice(0, 12)}..., sandbox ${String(eg.report!.sandbox_sha256).slice(0, 12)}...): only CONNECT to ${PROVIDER_ALLOWLIST.join(', ')} leaves the boundary` : `default-deny verified (no route, no DNS); the provider-egress component exists but is not verified (${eg.problems.join('; ')}), so a LIVE run could not reach the provider without weakening the boundary`);
    add('host_secrets_excluded', iso.tested, iso.tested ? 'only src (ro), inputs (ro) and out (rw) are mounted; no home, credentials, signing keys, Windows drives or host sockets inside the boundary (tested)' : 'not tested');
    add('runner_inside_boundary', runnerInside, runnerInside ? 'Claude Code and Node are available inside the isolated environment' : host ? 'Claude Code and Node are not installed inside the WSL2 environment: the runner cannot run inside the boundary' : 'host not assessed (run bmad isolation doctor)');
    const boundary = launchBoundary(ws?.path ?? null, { tested: iso.tested, problems: iso.problems, runnerInside, egress: { verified: eg.verified, problems: eg.problems } });
    add('enforceable_launch_boundary', boundary.enforceable, boundary.enforceable ? 'enforceable for LIVE: tested whole-process boundary, verified provider egress, runner inside the boundary' : `not enforceable for LIVE: ${boundary.gaps.join(' | ')}`);

    const reasons = checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`);
    const rec = {
      contract: 'bmad/execution-preflight',
      contract_version: '1.0',
      evaluated_at: snap.at.toISOString(),
      binding_id: e.binding.binding_id,
      workflow_id: e.binding.workflow_id,
      agent: e.binding.agent,
      scope: ev?.selector_text ?? scope,
      scope_sha256: ev?.scope_sha256 ?? null,
      baseline_manifest_sha256: wf.run.manifestSha256,
      provider: { name: PROVIDER.name, service: RUNNER.service },
      authorization_id: auth?.authorization_id ?? null,
      exposure: { authorized_files: [...authorized.keys()].sort(), would_expose: would, unauthorized },
      launch_boundary: boundary,
      isolation: { tested: iso.tested, report_executed_at: iso.report?.executed_at ?? null, sandbox_sha256: iso.report?.sandbox_sha256 ?? null, problems: iso.problems },
      egress: { verified: egressOk, report_executed_at: eg.report?.executed_at ?? null, proxy_sha256: eg.report?.proxy_sha256 ?? null, sandbox_sha256: eg.report?.sandbox_sha256 ?? null, allowlist: [...PROVIDER_ALLOWLIST], problems: eg.problems },
      execution_status: checks.every((c) => c.ok) ? 'EXECUTION_AUTHORIZED' : !runnerInside || !boundary.network_enforcement ? 'EXECUTION_UNSUPPORTED' : 'EXECUTION_BLOCKED',
      checks,
      launch_permitted: reasons.length === 0,
      refusal_reasons: reasons,
    };
    const v = ctx.contracts.validate('bmad/execution-preflight', rec);
    if (!v.valid) throw new OrchestratorError('preflight record violates its contract', 'CONTRACT', v.errors);
    if (!opts.record) return { record_id: null, ...rec };
    const n = wf.store.list(BMAD_RECORDS).filter((f) => f.startsWith('BPF-')).length + 1;
    const id = `BPF-${String(n).padStart(4, '0')}`;
    const f = wf.store.writeRecord(BMAD_RECORDS, `${id}.json`, { record_id: id, ...rec });
    wf.store.append(rec.launch_permitted ? 'bmad_preflight_passed' : 'bmad_preflight_refused', { record: `${BMAD_RECORDS}/${id}.json`, workflow: rec.workflow_id, scope: rec.scope, failed: checks.filter((c) => !c.ok).map((c) => c.id), sha256: sha256File(f) });
    wf.store.writeState(wf.state);
    return { record_id: id, ...rec };
  };
  return opts.record ? mutate(wf, `bmad preflight ${bindingKey}`, run) : run();
}
void path;
