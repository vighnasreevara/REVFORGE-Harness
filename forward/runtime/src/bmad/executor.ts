/**
 * Isolated BMad LIVE executor (STEP 7). The forward orchestrator stays the
 * authority: this module only
 *   - diagnoses the isolated execution environment (a verified copy of the
 *     pinned release with its npm dependencies, uv in a private venv, an
 *     isolated HOME and installed synthetic workspaces under
 *     forward/integrations/bmad/executor, never the repository .claude/);
 *   - decides whether a LIVE execution of one binding for one scope would be
 *     allowed, listing every missing precondition;
 *   - builds the execution manifest (the exact Claude Code headless command,
 *     its working directory, tool restrictions and inputs) without running it;
 *   - routes the outcome of an execution through the Step 6 receipt validator
 *     (`handleExecutionOutcome`), so a failed run or an unverified completion
 *     claim is recorded and rejected.
 * There is no CLI command that executes BMad. `executeLive` refuses unless
 * every precondition holds; in STEP 7 they cannot all hold (no AI-provider
 * disclosure authorization type exists for Claude Code, LIVE is not requested
 * and the scope is not approved).
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { mutate, OrchestratorError, Workflow } from '../orchestrator/orchestrator';
import { BMAD_RECORDS, evaluateEligibility, recordResult } from './adapter';
import { bmadPaths, Check, filesUnder, installationImpact, verifyRelease } from './release';
import { loadBindings } from './bindings';

export const BOUND_SKILLS = ['bmad-prd', 'bmad-architecture', 'bmad-create-epics-and-stories', 'bmad-sprint-planning', 'bmad-build', 'bmad-code-review'];
/**
 * A binding that stays disabled regardless of eligibility. Build is disabled while the project configuration does not
 * authorise Java generation (generation.java_generation_allowed and an authorised orchestrator.java_target_dir); the
 * G2 approval it also needs is checked by its eligibility.
 */
export function disabledReason(ctx: RuntimeContext, bindingId: string): string | null {
  if (bindingId !== 'BMAD-BUILD') return null;
  const cfg: any = ctx.config;
  if (!cfg.generation?.java_generation_allowed) return 'Build is disabled: production Java generation is not authorised (generation.java_generation_allowed is false)';
  if (!cfg.orchestrator?.java_target_dir) return 'Build is disabled: no authorised orchestrator.java_target_dir';
  return null;
}
export const PROVIDER = { name: 'anthropic', runner: 'claude-code-cli' };

export function executorPaths(ctx: RuntimeContext) {
  const dir = path.join(bmadPaths(ctx).dir, 'executor');
  return { dir, pkg: path.join(dir, 'bmad-method-6.12.4'), uv: path.join(dir, 'venv', process.platform === 'win32' ? 'Scripts/uv.exe' : 'bin/uv'), home: path.join(dir, 'home'), workspaces: path.join(dir, 'workspaces'), uvCache: path.join(dir, 'uv-cache') };
}

/** Runs a version probe; injectable so tests can simulate a missing runtime. */
export type Probe = (program: string, args: string[]) => string | null;
export const defaultProbe: Probe = (program, args) => {
  try {
    return execFileSync(program, args, { encoding: 'utf8', timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' && !/\.exe$/i.test(program) }).trim().split(/\r?\n/)[0];
  } catch {
    return null;
  }
};

const norm = (p: string) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
const within = (p: string, dir: string) => norm(p) === norm(dir) || norm(p).startsWith(norm(dir) + '/');

export interface ExecutorDoctor {
  ok_for_installation: boolean;
  ok_for_live: boolean;
  checks: Check[];
  workspaces: Array<{ name: string; path: string; skills: string[]; bound_skills_verified: boolean; problems: string[] }>;
  versions: Record<string, string | null>;
}

/** Workspaces with an installed BMad: `.claude/skills` and `_bmad/` inside the executor directory. */
export function inspectWorkspaces(ctx: RuntimeContext): ExecutorDoctor['workspaces'] {
  const ep = executorPaths(ctx);
  const rel = verifyRelease(ctx);
  const pinned: Record<string, string> = rel.ok ? JSON.parse(fs.readFileSync(bmadPaths(ctx).pin, 'utf8')).files : {};
  if (!fs.existsSync(ep.workspaces)) return [];
  return fs.readdirSync(ep.workspaces, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const ws = path.join(ep.workspaces, d.name);
    const skillsDir = path.join(ws, '.claude', 'skills');
    const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).sort() : [];
    const problems: string[] = [];
    if (!fs.existsSync(path.join(ws, '_bmad', 'config.toml'))) problems.push('_bmad/config.toml missing');
    for (const s of BOUND_SKILLS) {
      const w = rel.registry.find((x) => x.workflow_id === s);
      if (!skills.includes(s) || !w) {
        problems.push(`${s} not installed`);
        continue;
      }
      for (const f of filesUnder(path.join(skillsDir, s))) {
        const key = `${w.path}/${f}`;
        if (!(key in pinned)) problems.push(`${s}/${f} is not in the pinned release`);
        else if (sha256File(path.join(skillsDir, s, f)) !== pinned[key]) problems.push(`${s}/${f} differs from the pinned release`);
      }
    }
    if (skills.some((s) => rel.registry.find((x) => x.workflow_id === s)?.lifecycle === 'shim')) problems.push('deprecated shims are installed');
    return { name: d.name, path: ws, skills, bound_skills_verified: problems.length === 0, problems };
  });
}

export function executorDoctor(ctx: RuntimeContext, probe: Probe = defaultProbe): ExecutorDoctor {
  const ep = executorPaths(ctx);
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const rel = verifyRelease(ctx);
  add('release_verified', rel.ok, rel.ok ? `${rel.package}@${rel.version} staged release matches the pin` : rel.checks.filter((c) => !c.ok).map((c) => c.detail).join(' | '));
  // The executor copy: every pinned file identical; only npm's node_modules and lock file added.
  let copyOk = false;
  let copyDetail = `no executor copy at ${ep.pkg}`;
  if (fs.existsSync(ep.pkg) && rel.ok) {
    const pinned: Record<string, string> = JSON.parse(fs.readFileSync(bmadPaths(ctx).pin, 'utf8')).files;
    const diff = Object.entries(pinned).filter(([f, h]) => sha256File(path.join(ep.pkg, f)) !== h).map(([f]) => f);
    const extra = filesUnder(ep.pkg).filter((f) => !(f in pinned) && !f.startsWith('node_modules/') && f !== 'package-lock.json');
    copyOk = !diff.length && !extra.length;
    copyDetail = copyOk ? `executor copy identical to the pin (${Object.keys(pinned).length} files)` : `executor copy differs from the pin: ${[...diff.map((f) => `~${f}`), ...extra.map((f) => `+${f}`)].slice(0, 6).join(', ')}`;
  }
  add('executor_copy', copyOk, copyDetail);
  const pkgJson = fs.existsSync(path.join(ep.pkg, 'package.json')) ? JSON.parse(fs.readFileSync(path.join(ep.pkg, 'package.json'), 'utf8')) : { dependencies: {} };
  const missingDeps = Object.keys(pkgJson.dependencies ?? {}).filter((d) => !fs.existsSync(path.join(ep.pkg, 'node_modules', d, 'package.json')));
  const lock = path.join(ep.pkg, 'package-lock.json');
  add('npm_dependencies', fs.existsSync(ep.pkg) && !missingDeps.length && fs.existsSync(lock), !fs.existsSync(ep.pkg) ? 'not provisioned' : missingDeps.length ? `missing npm runtime dependencies: ${missingDeps.join(', ')}` : `${Object.keys(pkgJson.dependencies ?? {}).length} runtime dependencies installed (lock ${String(sha256File(lock)).slice(0, 16)}…, --ignore-scripts)`);
  const versions: Record<string, string | null> = { uv: fs.existsSync(ep.uv) ? probe(ep.uv, ['--version']) : null, python: probe(process.platform === 'win32' ? 'python' : 'python3', ['--version']), claude: probe('claude', ['--version']), node: process.version };
  add('uv', !!versions.uv, versions.uv ? `${versions.uv} in the isolated venv` : 'uv is not installed in the isolated venv (BMad activation scripts run with uv)');
  const py = /Python (\d+)\.(\d+)/.exec(versions.python ?? '');
  add('python', !!py && (Number(py[1]) > 3 || (Number(py[1]) === 3 && Number(py[2]) >= 11)), versions.python ? `${versions.python} (>= 3.11 required by BMad scripts)` : 'python not found');
  add('claude_cli', !!versions.claude, versions.claude ? `Claude Code CLI ${versions.claude} (headless runner for BMad skills)` : 'Claude Code CLI not found: BMad skills run inside a Claude Code session');
  const ws = inspectWorkspaces(ctx);
  const good = ws.filter((w) => w.bound_skills_verified);
  add('isolated_workspace', good.length > 0, good.length ? `${good.length} installed workspace(s) with the six bound workflows byte-identical to the pin: ${good.map((w) => w.name).join(', ')}` : ws.length ? ws.map((w) => `${w.name}: ${w.problems.slice(0, 3).join('; ')}`).join(' | ') : 'no installed BMad workspace');
  const isolated = within(ep.dir, path.join(ctx.forwardDir, 'integrations', 'bmad')) && !within(ep.dir, path.join(ctx.repoRoot, '.claude'));
  add('isolation', isolated && installationImpact(ctx).checks.every((c) => c.ok), isolated ? 'executor and workspaces live under forward/integrations/bmad/executor; repository .claude/, _bmad/ and _bmad-output/ untouched' : 'executor directory is not isolated');
  const home = fs.existsSync(ep.home) ? filesUnder(ep.home) : [];
  add('isolated_home', fs.existsSync(ep.home), fs.existsSync(ep.home) ? `isolated HOME for the installer and uv (${home.length} file(s) written there)` : 'no isolated HOME directory');
  const installation = ['release_verified', 'executor_copy', 'npm_dependencies', 'uv', 'python', 'isolated_workspace', 'isolation', 'isolated_home'].every((id) => checks.find((c) => c.id === id)!.ok);
  // LIVE needs a model provider. Disclosure to it needs its own signed authorization; the OpenAI source-export authorization cannot cover it.
  add('provider_disclosure_authorization', false, `no signed AI-provider disclosure authorization exists for ${PROVIDER.name} (${PROVIDER.runner}); signed source-export authorizations are bound to provider 'openai' by contract and do not authorise disclosure to Claude`);
  const requested = !!loadBindings(ctx).config?.live_execution.requested;
  add('live_requested', requested, requested ? 'bindings.json requests LIVE (necessary, never sufficient)' : 'bindings.json live_execution.requested is false');
  return { ok_for_installation: installation, ok_for_live: checks.every((c) => c.ok), checks, workspaces: ws, versions };
}

/* ------------------------------------------------------------------ */
/* eligibility and manifest                                            */
/* ------------------------------------------------------------------ */

export function executorEligibility(wf: Workflow, bindingKey: string, scope: string, probe: Probe = defaultProbe): { binding_id: string; workflow_id: string; agent: string; scope: string; scope_sha256: string | null; eligible: boolean; reasons: string[]; workflow_checks: any[]; executor_checks: Check[] } {
  const e = evaluateEligibility(wf, bindingKey, scope, 'LIVE');
  const d = executorDoctor(wf.run.ctx, probe);
  const reasons = [...e.record.reasons];
  const off = disabledReason(wf.run.ctx, e.binding.binding_id);
  if (off) reasons.push(off);
  // Installation, disclosure authorization and the LIVE request are executor checks; the scope- and workflow-specific
  // authorization, isolation and limits are decided by the execution preflight that executeLive requires.
  for (const c of d.checks.filter((x) => !x.ok)) reasons.push(`executor ${c.id}: ${c.detail}`);
  return { binding_id: e.binding.binding_id, workflow_id: e.binding.workflow_id, agent: e.binding.agent, scope: e.record.scope, scope_sha256: e.record.scope_sha256, eligible: reasons.length === 0, reasons, workflow_checks: e.record.checks, executor_checks: d.checks };
}

/** The exact headless command a LIVE execution would run (built, validated, never executed here). */
export function executionManifest(wf: Workflow, bindingKey: string, scope: string, opts: { packet?: any; probe?: Probe; maxBudgetUsd?: number } = {}): any {
  const ctx = wf.run.ctx;
  const el = executorEligibility(wf, bindingKey, scope, opts.probe);
  const d = executorDoctor(ctx, opts.probe);
  const ws = d.workspaces.find((w) => w.bound_skills_verified) ?? null;
  const rel = verifyRelease(ctx);
  const outDir = opts.packet?.allowed_outputs.output_dir ?? null;
  const inputs = (opts.packet?.inputs ?? []).map((i: any) => ({ name: i.name, path: i.path, sha256: i.sha256 }));
  const prompt = `/${el.workflow_id} Fast path. Use only the input files listed in execution-inputs.json in this directory. Write every output and a normalised result.json (contract bmad/output-*) to ./output. Do not approve anything.`;
  const manifest = {
    contract: 'bmad/execution-manifest',
    contract_version: '1.0',
    prepared_at: new Date().toISOString(),
    mode: 'DRY_RUN',
    binding_id: el.binding_id,
    workflow_id: el.workflow_id,
    agent: el.agent,
    scope: el.scope,
    scope_sha256: el.scope_sha256,
    release: { package: rel.package ?? 'bmad-method', version: rel.version ?? 'unknown', directory_sha256: rel.directory_sha256 },
    workspace: { path: ws ? path.relative(ctx.repoRoot, ws.path).split(path.sep).join('/') : '(none installed)', isolated: d.checks.find((c) => c.id === 'isolation')!.ok, home: path.relative(ctx.repoRoot, executorPaths(ctx).home).split(path.sep).join('/'), claude_dir: ws ? path.relative(ctx.repoRoot, path.join(ws.path, '.claude')).split(path.sep).join('/') : '(none)', installed_skills: ws?.skills ?? [], installation_record: null },
    provider: { name: PROVIDER.name, runner: PROVIDER.runner, data_disclosure: 'Prompts, mapped inputs and tool results are sent to the model provider. The BMad architecture workflow also asks for web research, which is disabled here (WebFetch/WebSearch disallowed).', authorization_id: null },
    command: {
      program: 'claude',
      args: ['-p', prompt, '--output-format', 'json', '--no-session-persistence', '--permission-mode', 'dontAsk', '--setting-sources', 'project', '--strict-mcp-config', '--restricted', '--allowedTools', 'Read,Glob,Grep,Write,Edit', '--disallowedTools', 'WebFetch,WebSearch,Bash,PowerShell', ...(opts.maxBudgetUsd ? ['--max-budget-usd', String(opts.maxBudgetUsd)] : [])],
      cwd: ws ? path.relative(ctx.repoRoot, ws.path).split(path.sep).join('/') : '(none)',
      env_allowlist: ['PATH', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'TEMP', 'TMP', 'UV_CACHE_DIR', 'UV_NO_PYTHON_DOWNLOADS'],
    },
    inputs,
    output_dir: outDir,
    preconditions: [...el.workflow_checks.map((c: any) => ({ id: `workflow:${c.id}`, ok: c.ok, detail: c.detail })), ...el.executor_checks.map((c) => ({ id: `executor:${c.id}`, ok: c.ok, detail: c.detail })), ...(disabledReason(ctx, el.binding_id) ? [{ id: 'binding_enabled', ok: false, detail: disabledReason(ctx, el.binding_id)! }] : [])],
    executable: el.eligible,
    blockers: el.reasons,
  };
  const v = ctx.contracts.validate('bmad/execution-manifest', manifest);
  if (!v.valid) throw new Error(`execution manifest violates bmad/execution-manifest: ${v.errors.join('; ')}`);
  return manifest;
}

/* ------------------------------------------------------------------ */
/* execution                                                           */
/* ------------------------------------------------------------------ */

export interface ExecutionOutcome {
  exit_code: number;
  stdout_sha256: string | null;
  result_file: string | null;
  error?: string;
  /** Provider-egress proxy summary of a LIVE launch (log SHA-256, allowed / denied counts; never headers or payload). */
  egress?: import('../isolation/egress').EgressSummary;
}

/** Seals the provider-egress summary of one execution as a BEG record (one per launch that started the proxy). */
function recordEgress(wf: Workflow, packetId: string, egress: NonNullable<ExecutionOutcome['egress']>): string {
  const n = wf.store.list(BMAD_RECORDS).filter((f) => f.startsWith('BEG-')).length + 1;
  const rid = `BEG-${String(n).padStart(4, '0')}`;
  const file = wf.store.writeRecord(BMAD_RECORDS, `${rid}.json`, { record_id: rid, packet_id: packetId, recorded_at: new Date().toISOString(), kind: 'provider_egress', egress });
  wf.store.append('bmad_egress_recorded', { record: `${BMAD_RECORDS}/${rid}.json`, packet_id: packetId, allowed: egress.connections_allowed, denied: egress.connections_denied, log_sha256: egress.log_sha256, sha256: sha256File(file) });
  return rid;
}
export type Runner = (manifest: any) => ExecutionOutcome;

/** Records what an execution returned. A failure is recorded and never becomes a receipt; a completion claim must pass the receipt validator. */
export function handleExecutionOutcome(wf: Workflow, packetId: string, outcome: ExecutionOutcome): { execution_record: string; status: 'failed' | 'completed_validated' | 'completed_rejected'; receipt: any | null; egress_record?: string } {
  if (outcome.exit_code !== 0 || !outcome.result_file) {
    const id = mutate(wf, `bmad execution failed ${packetId}`, () => {
      const egressRecord = outcome.egress ? recordEgress(wf, packetId, outcome.egress) : null;
      const n = wf.store.list(BMAD_RECORDS).filter((f) => f.startsWith('BEX-')).length + 1;
      const rid = `BEX-${String(n).padStart(4, '0')}`;
      const file = wf.store.writeRecord(BMAD_RECORDS, `${rid}.json`, { record_id: rid, packet_id: packetId, recorded_at: new Date().toISOString(), status: 'failed', exit_code: outcome.exit_code, stdout_sha256: outcome.stdout_sha256, error: outcome.error ?? (outcome.result_file ? null : 'no result file was produced'), ...(outcome.egress ? { egress_record: egressRecord, egress: outcome.egress } : {}) });
      wf.store.append('bmad_execution_failed', { record: `${BMAD_RECORDS}/${rid}.json`, packet_id: packetId, exit_code: outcome.exit_code, sha256: sha256File(file) });
      wf.store.writeState(wf.state);
      return rid;
    });
    return { execution_record: id, status: 'failed', receipt: null };
  }
  const egressRecord = outcome.egress
    ? mutate(wf, `bmad egress ${packetId}`, () => {
        const rid = recordEgress(wf, packetId, outcome.egress!);
        wf.store.writeState(wf.state);
        return rid;
      })
    : null;
  const receipt = recordResult(wf, packetId, outcome.result_file);
  return { execution_record: receipt.receipt_id, status: receipt.accepted ? 'completed_validated' : 'completed_rejected', receipt, ...(egressRecord ? { egress_record: egressRecord } : {}) };
}

/** Guarded LIVE execution. Refuses unless every precondition holds; reached only through the governed dispatcher (`bmad governed-run`, STEP 21). */
export function executeLive(wf: Workflow, packetId: string, runner: Runner, probe: Probe = defaultProbe): any {
  const pf = wf.store.p(BMAD_RECORDS, `${packetId}.json`);
  if (!fs.existsSync(pf)) throw new OrchestratorError(`no BMad packet ${packetId}`, 'USAGE');
  const packet = JSON.parse(fs.readFileSync(pf, 'utf8'));
  if (packet.mode !== 'LIVE') throw new OrchestratorError(`${packetId} is a ${packet.mode} packet; LIVE execution needs a LIVE packet`, 'BMAD_MODE');
  const manifest = executionManifest(wf, packet.binding_id, packet.scope, { packet, probe });
  if (!manifest.executable) throw new OrchestratorError(`BMad LIVE execution of ${packet.workflow_id} refused`, 'BMAD_LIVE_NOT_AUTHORIZED', manifest.blockers);
  // The sealed execution preflight is the launch authority (authorization, exposure, isolation, limits, boundary).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const launch = require('./preflight').preflight(wf, packet.binding_id, packet.scope, { probe, record: true });
  if (!launch.launch_permitted) throw new OrchestratorError(`BMad LIVE execution of ${packet.workflow_id} refused by preflight ${launch.record_id}`, 'BMAD_LIVE_NOT_AUTHORIZED', launch.refusal_reasons ?? []);
  return handleExecutionOutcome(wf, packetId, runner({ ...manifest, mode: 'LIVE', preflight_id: launch.record_id, authorization_id: launch.authorization_id }));
}
