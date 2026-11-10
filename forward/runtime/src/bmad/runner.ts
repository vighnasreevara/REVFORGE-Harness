/**
 * LIVE BMad runner adapter (end-to-end integration). It connects the guarded
 * executor (`executeLive`, which already required a permitted, recorded
 * preflight) to the whole-process sandbox:
 *
 *   1. refuses unless the manifest names a LIVE preflight that permitted the
 *      launch and a disclosure authorization recorded in this run;
 *   2. re-verifies every authorized source file and every mapped input
 *      against its recorded SHA-256 (a stale hash refuses the launch);
 *   3. builds a minimal workspace with exactly those files plus the pinned,
 *      installed definition of the bound workflow (copied, never linked);
 *   4. starts the provider-egress allowlist proxy (isolation/egress.ts) in
 *      WSL, outside the sandbox, and runs the headless Claude Code command
 *      inside `sandbox.sh --net egress` (source and inputs read-only, only
 *      /work/out writable, the only route out is CONNECT to the allowlisted
 *      provider through the proxy). The provider credential is the configured
 *      `bmad.provider_credential_file` (a WSL path), handed to the sandbox as
 *      `--env-file`; this module never reads, logs or copies it;
 *   5. stops the proxy and records its log SHA-256 and an allowed / denied
 *      summary with the execution (never headers or payload);
 *   6. copies the output into the packet's output directory and returns the
 *      result file, which then goes through the receipt validator.
 *
 * The preflight decides whether the egress component counts (`network_isolation`,
 * `enforceable_launch_boundary` need a current, passed egress self-test). The
 * sandbox and proxy functions are injectable for tests only; a test double
 * never produces a LIVE receipt that counts, because its packet, preflight and
 * authorization would not exist.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { sha256File } from '../core/fsutil';
import { Workflow } from '../orchestrator/orchestrator';
import { disclosureRecords } from '../disclosure/disclosure';
import { runSandboxed, SandboxRun, WorkspaceFile, buildWorkspace, validateWorkspace } from '../isolation/isolation';
import { EgressStarter, EgressSummary, providerCredentialFile, startEgressProxy } from '../isolation/egress';
import { BMAD_RECORDS } from './adapter';
import { ExecutionOutcome, executorPaths, inspectWorkspaces, Runner } from './executor';

export type SandboxFn = typeof runSandboxed;

/** Files the runner would place in the workspace, or the reasons it refuses (pure planning, nothing written). */
export function planLaunch(wf: Workflow, manifest: any): { ok: boolean; problems: string[]; src: WorkspaceFile[]; inputs: WorkspaceFile[] } {
  const ctx = wf.run.ctx;
  const problems: string[] = [];
  const src: WorkspaceFile[] = [];
  const inputs: WorkspaceFile[] = [];
  if (manifest?.mode !== 'LIVE') problems.push('the manifest is not a LIVE launch');
  if (!manifest?.preflight_id) problems.push('no recorded preflight is named');
  else {
    let pf: any = null;
    try {
      pf = wf.store.readRecord(BMAD_RECORDS, `${manifest.preflight_id}.json`);
    } catch {
      pf = null;
    }
    if (!pf) problems.push(`preflight ${manifest.preflight_id} is not recorded in this run`);
    else if (pf.launch_permitted !== true) problems.push(`preflight ${manifest.preflight_id} did not permit the launch`);
    else if (pf.workflow_id !== manifest.workflow_id || pf.scope !== manifest.scope) problems.push(`preflight ${manifest.preflight_id} is for ${pf.workflow_id} / ${pf.scope}, not this launch`);
  }
  const auth = disclosureRecords(wf).find((r) => r.authorization_id === manifest?.authorization_id);
  if (!auth) problems.push(`no recorded disclosure authorization ${manifest?.authorization_id ?? '(none)'}`);
  else {
    if (auth.scope !== manifest.scope) problems.push(`authorization ${auth.authorization_id} is for scope ${auth.scope}`);
    if (!(auth.authorization?.workflows ?? []).includes(manifest.workflow_id)) problems.push(`authorization ${auth.authorization_id} does not cover ${manifest.workflow_id}`);
    for (const f of auth.authorization?.source_files ?? []) {
      const abs = ctx.sourceRoot ? path.join(ctx.sourceRoot, f.path) : null;
      if (!abs || !fs.existsSync(abs)) problems.push(`authorized source ${f.path} is not available`);
      else if (sha256File(abs) !== f.sha256) problems.push(`authorized source ${f.path} changed since authorization (stale hash)`);
      else src.push({ source: abs, dest: f.path });
    }
  }
  for (const i of manifest?.inputs ?? []) {
    const abs = path.resolve(ctx.repoRoot, i.path);
    if (!fs.existsSync(abs)) problems.push(`mapped input ${i.name} missing`);
    else if (sha256File(abs) !== i.sha256) problems.push(`mapped input ${i.name} changed (stale hash)`);
    else inputs.push({ source: abs, dest: `mapped/${i.name}.json` });
  }
  const ws = inspectWorkspaces(ctx).find((w) => w.bound_skills_verified);
  if (!ws) problems.push('no installed workspace with the pinned bound workflow definitions');
  else {
    const dir = path.join(ws.path, '.claude', 'skills', manifest?.workflow_id ?? '');
    if (!fs.existsSync(dir)) problems.push(`workflow definition ${manifest?.workflow_id} is not installed`);
    else for (const f of walk(dir)) inputs.push({ source: path.join(dir, f), dest: `.claude/skills/${manifest.workflow_id}/${f}` });
  }
  return { ok: problems.length === 0, problems, src, inputs };
}

function walk(dir: string, rel = ''): string[] {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? walk(dir, r) : e.isFile() ? [r] : [];
  });
}

/** The command run inside the sandbox: Claude Code from the read-only inputs, writing only to /work/out. */
export function sandboxArgv(manifest: any): string[] {
  const args: string[] = [...(manifest.command?.args ?? [])];
  const i = args.indexOf('-p');
  if (i >= 0) args[i + 1] = `/${manifest.workflow_id} Fast path. Read the mapped inputs under /work/inputs/mapped and the authorized source under /work/src only. Write every output and a normalised result.json (contract bmad/output-*) to /work/out. Do not approve anything.`;
  // Non-essential traffic (telemetry, error reporting, update checks) is switched off: the egress proxy would refuse it anyway.
  return ['sh', '-c', 'cd /work/inputs && HOME=/tmp CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 exec claude "$@"', 'claude', ...args];
}

/**
 * The LIVE runner. `sandbox` and `egress` are injectable for tests; the defaults are the real whole-process sandbox and
 * the real allowlist proxy. `credentialFile` overrides the configured `bmad.provider_credential_file` (tests only).
 */
export function sandboxRunner(wf: Workflow, opts: RunnerOptions = {}): Runner {
  return (manifest: any): ExecutionOutcome => {
    const plan = planLaunch(wf, manifest);
    if (!plan.ok) return { exit_code: 126, stdout_sha256: null, result_file: null, error: `runner refused: ${plan.problems.join('; ')}` };
    return launchPlanned(wf, manifest, plan, opts);
  };
}

export interface RunnerOptions {
  sandbox?: SandboxFn;
  egress?: EgressStarter;
  credentialFile?: string | null;
  distro?: string | null;
  timeoutMs?: number;
  /** Where the per-launch workspace is built (default: the executor's runs directory). */
  workspaceRoot?: string;
}

/**
 * Launches an already validated plan: credential path check, minimal workspace, allowlist proxy, sandbox in egress
 * mode, proxy stop and summary, output copy. Called only by `sandboxRunner` after `planLaunch` passed (exported for tests).
 */
export function launchPlanned(wf: Workflow, manifest: any, plan: { src: WorkspaceFile[]; inputs: WorkspaceFile[] }, opts: RunnerOptions = {}): ExecutionOutcome {
  const ctx = wf.run.ctx;
  const credential = opts.credentialFile !== undefined ? opts.credentialFile : providerCredentialFile(ctx);
  if (!credential || !/^\/[^\0\n]+$/.test(credential)) return { exit_code: 126, stdout_sha256: null, result_file: null, error: 'runner refused: no provider credential file is configured (bmad.provider_credential_file must be an absolute WSL path to a mode-600 KEY=VALUE file)' };
  const dir = path.join(opts.workspaceRoot ?? path.join(executorPaths(ctx).dir, 'runs'), `${manifest.binding_id}-${Date.now()}`);
  const ws = buildWorkspace(dir, plan.src, plan.inputs);
  const problems = validateWorkspace(ws);
  if (problems.length) return { exit_code: 126, stdout_sha256: null, result_file: null, error: `workspace refused: ${problems.join('; ')}` };
  const distro = opts.distro ?? null;
  let proxy;
  try {
    proxy = (opts.egress ?? startEgressProxy)(ctx, { distro });
  } catch (e) {
    return { exit_code: 125, stdout_sha256: null, result_file: null, error: `provider egress proxy failed to start: ${(e as Error).message}` };
  }
  let run: SandboxRun;
  let egress: EgressSummary | undefined;
  try {
    run = (opts.sandbox ?? runSandboxed)(ctx, ws, sandboxArgv(manifest), distro, opts.timeoutMs ?? 30 * 60 * 1000, { egressSocket: proxy.socket, envFile: credential });
  } catch (e) {
    egress = stopProxy(proxy);
    return { exit_code: 125, stdout_sha256: null, result_file: null, error: `sandbox launch failed: ${(e as Error).message}`, egress };
  }
  egress = stopProxy(proxy);
  const stdoutSha = createHash('sha256').update(run.stdout ?? '').digest('hex');
  if (run.exit_code !== 0) return { exit_code: run.exit_code ?? 124, stdout_sha256: stdoutSha, result_file: null, error: `workflow exited with ${run.exit_code}: ${(run.stderr ?? '').slice(0, 400)}`, egress };
  const out = path.join(ws.workspace, 'out');
  const target = manifest.output_dir ? path.resolve(ctx.repoRoot, manifest.output_dir) : null;
  if (!target || !fs.existsSync(path.join(out, 'result.json'))) return { exit_code: 0, stdout_sha256: stdoutSha, result_file: null, error: 'the workflow produced no result.json', egress };
  fs.mkdirSync(target, { recursive: true });
  for (const f of walk(out)) {
    fs.mkdirSync(path.dirname(path.join(target, f)), { recursive: true });
    fs.copyFileSync(path.join(out, f), path.join(target, f));
  }
  return { exit_code: 0, stdout_sha256: stdoutSha, result_file: path.join(target, 'result.json'), egress };
}

/** Stops the proxy. If stopping fails, no summary is returned and the execution record carries none (nothing is invented). */
function stopProxy(proxy: { stop(): EgressSummary }): EgressSummary | undefined {
  try {
    return proxy.stop();
  } catch {
    return undefined;
  }
}
