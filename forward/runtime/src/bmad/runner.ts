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
 *   4. runs the headless Claude Code command inside `sandbox.sh` (network
 *      none, source and inputs read-only, only /work/out writable);
 *   5. copies the output into the packet's output directory and returns the
 *      result file, which then goes through the receipt validator.
 *
 * The provider route and the provider credential are not part of this module:
 * they belong to the separately verified egress component the preflight checks
 * (`network_isolation`, `enforceable_launch_boundary`). The sandbox function is
 * injectable for tests only; a test double never produces a LIVE receipt that
 * counts, because its packet, preflight and authorization would not exist.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { sha256File } from '../core/fsutil';
import { Workflow } from '../orchestrator/orchestrator';
import { disclosureRecords } from '../disclosure/disclosure';
import { runSandboxed, SandboxRun, WorkspaceFile, buildWorkspace, validateWorkspace } from '../isolation/isolation';
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
  return ['sh', '-c', 'cd /work/inputs && HOME=/tmp exec claude "$@"', 'claude', ...args];
}

/** The LIVE runner. `sandbox` is injectable for tests; the default is the real whole-process sandbox. */
export function sandboxRunner(wf: Workflow, opts: { sandbox?: SandboxFn; distro?: string | null; timeoutMs?: number } = {}): Runner {
  return (manifest: any): ExecutionOutcome => {
    const plan = planLaunch(wf, manifest);
    if (!plan.ok) return { exit_code: 126, stdout_sha256: null, result_file: null, error: `runner refused: ${plan.problems.join('; ')}` };
    const ctx = wf.run.ctx;
    const dir = path.join(executorPaths(ctx).dir, 'runs', `${manifest.binding_id}-${Date.now()}`);
    const ws = buildWorkspace(dir, plan.src, plan.inputs);
    const problems = validateWorkspace(ws);
    if (problems.length) return { exit_code: 126, stdout_sha256: null, result_file: null, error: `workspace refused: ${problems.join('; ')}` };
    let run: SandboxRun;
    try {
      run = (opts.sandbox ?? runSandboxed)(ctx, ws, sandboxArgv(manifest), opts.distro ?? null, opts.timeoutMs ?? 30 * 60 * 1000);
    } catch (e) {
      return { exit_code: 125, stdout_sha256: null, result_file: null, error: `sandbox launch failed: ${(e as Error).message}` };
    }
    const stdoutSha = createHash('sha256').update(run.stdout ?? '').digest('hex');
    if (run.exit_code !== 0) return { exit_code: run.exit_code ?? 124, stdout_sha256: stdoutSha, result_file: null, error: `workflow exited with ${run.exit_code}: ${(run.stderr ?? '').slice(0, 400)}` };
    const out = path.join(ws.workspace, 'out');
    const target = manifest.output_dir ? path.resolve(ctx.repoRoot, manifest.output_dir) : null;
    if (!target || !fs.existsSync(path.join(out, 'result.json'))) return { exit_code: 0, stdout_sha256: stdoutSha, result_file: null, error: 'the workflow produced no result.json' };
    fs.mkdirSync(target, { recursive: true });
    for (const f of walk(out)) {
      fs.mkdirSync(path.dirname(path.join(target, f)), { recursive: true });
      fs.copyFileSync(path.join(out, f), path.join(target, f));
    }
    return { exit_code: 0, stdout_sha256: stdoutSha, result_file: path.join(target, 'result.json') };
  };
}
