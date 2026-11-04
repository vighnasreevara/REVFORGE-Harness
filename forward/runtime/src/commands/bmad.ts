/**
 * `bmad <action>`: controlled BMad integration (STEP 6).
 *   doctor        release integrity, installation impact, binding validation
 *   workflows     verified workflow catalogue of the pinned release
 *   bindings      workflow -> agent bindings and their validation
 *   eligibility   gate / scope / baseline eligibility of one binding (sealed)
 *   dry-run       eligibility plus mapping preview; writes nothing unless --record
 *   prepare       immutable execution packet (MOCK; LIVE is refused)
 *   mock          deterministic stand-in result for a MOCK packet (never evidence)
 *   record        validate a returned result and record a receipt
 *   report        summary of BMad records and integrity
 * There is deliberately no `run`: execution belongs to the forward workflow
 * dispatcher and its gates.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { loadWorkflow, OrchestratorError } from '../orchestrator/orchestrator';
import { bmadSummary, discovery, dryRun, eligibilityCommand, mockResult, preparePacket, recordResult } from '../bmad/adapter';
import { Mode, MODES } from '../bmad/eligibility';
import { renderBmadReport } from '../bmad/report';
import { reconcileScope } from '../bmad/reconcile';
import { buildSnapshot } from '../approval/snapshot';
import { executionManifest, executorDoctor, executorEligibility } from '../bmad/executor';
import { governanceVerdict, governedRun } from '../bmad/governance';
import { ISOLATION_REPORT, isolationEvidence, preflight } from '../bmad/preflight';
import { assessHost, runIsolationTests, sandboxScript } from '../isolation/isolation';
import { scopeSourceFiles } from '../disclosure/disclosure';
import { mutate } from '../orchestrator/orchestrator';
import { sha256File } from '../core/fsutil';

type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);

const USAGE = 'bmad: use doctor | workflows | bindings | reconcile | eligibility | dry-run | prepare | mock | record | report | governance --scope S | governed-run --scope S  (--workflow W --scope S [--mode DRY_RUN|MOCK|LIVE] [--packet BPK-N] [--file RESULT.json])';

export function bmadCommand(ctx: RuntimeContext, action: string | undefined, flags: Flags, json: boolean, out: Out, err: Out, sub?: string): number {
  const print = (o: unknown, text: () => void) => (json ? out(JSON.stringify(o, null, 2)) : text());
  const need = (k: string) => {
    const v = str(flags, k);
    if (!v) throw new OrchestratorError(`--${k} is required`, 'USAGE');
    return v;
  };
  const mode = (def: Mode): Mode => {
    const m = (str(flags, 'mode') ?? def).toUpperCase() as Mode;
    if (!MODES.includes(m)) throw new OrchestratorError(`unknown mode ${m}; use ${MODES.join(', ')}`, 'USAGE');
    return m;
  };
  try {
    switch (action) {
      case 'doctor': {
        const d = discovery(ctx);
        const checks = [...d.release.checks, ...d.impact.checks, { id: 'bindings', ok: d.bindings.ok, detail: d.bindings.ok ? `${d.bindings.bindings.length} binding(s) valid` : [...d.bindings.problems, ...d.bindings.bindings.filter((b) => !b.ok).map((b) => `${b.binding_id}: ${b.checks.filter((c) => !c.ok).map((c) => c.detail).join('; ')}`)].join(' | ') }];
        const ok = checks.every((c) => c.ok);
        print({ ok, mode: 'DISCOVERY', package: d.release.package, version: d.release.version, checks, installed: false, staged: d.release.package_dir }, () => {
          for (const c of checks) out(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
          out(`bmad doctor: ${ok ? 'OK' : 'FAILED'} — ${d.release.package}@${d.release.version} staged; not installed in the repository (isolated executor installation: bmad executor doctor)`);
        });
        return ok ? 0 : 1;
      }
      case 'workflows': {
        const d = discovery(ctx);
        const list = d.release.registry.map((w) => ({ workflow_id: w.workflow_id, lifecycle: w.lifecycle, forwards_to: w.forwards_to, path: w.path, menu_code: w.menu_code, verified: d.release.ok && (d.release.workflow_problems.get(w.workflow_id) ?? ['?']).length === 0, problems: d.release.workflow_problems.get(w.workflow_id) ?? [] }));
        print({ package: d.release.package, version: d.release.version, release_verified: d.release.ok, workflows: list }, () => {
          for (const w of list) out(`  ${w.verified ? 'OK ' : 'BAD'} ${w.workflow_id.padEnd(34)} ${w.lifecycle.padEnd(10)} ${w.forwards_to ? `-> ${w.forwards_to}` : w.path}`);
          out(`${list.length} workflow definition(s); release ${d.release.ok ? 'verified' : 'NOT verified'}`);
        });
        return d.release.ok ? 0 : 1;
      }
      case 'bindings': {
        const d = discovery(ctx);
        print({ ok: d.bindings.ok, problems: d.bindings.problems, binding_version: d.loaded.config?.binding_version ?? null, mapping_version: d.loaded.mapping?.mapping_version ?? null, bindings: d.bindings.bindings.map((b) => ({ ...b, workflow: undefined })), independent_agents: d.loaded.config?.independent_agents ?? [] }, () => {
          for (const b of d.bindings.bindings) {
            const cfg = d.loaded.config!.bindings.find((x) => x.binding_id === b.binding_id)!;
            out(`  ${b.ok ? 'OK ' : 'BAD'} ${b.binding_id.padEnd(12)} ${b.workflow_id.padEnd(30)} -> ${b.agent}  gates ${cfg.requires_gates.join(',')}${cfg.requires.length ? `  needs ${cfg.requires.join(',')}` : ''}`);
            for (const c of b.checks.filter((x) => !x.ok)) out(`      - ${c.id}: ${c.detail}`);
          }
          for (const a of d.loaded.config?.independent_agents ?? []) out(`  independent: ${a.agent} — ${a.reason}`);
          out(`bindings ${d.loaded.config?.binding_version} / mapping ${d.loaded.mapping?.mapping_version}: ${d.bindings.ok ? 'valid' : 'INVALID'}`);
        });
        return d.bindings.ok ? 0 : 1;
      }
      case 'eligibility': {
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const r = eligibilityCommand(wf, need('workflow'), need('scope'), mode('MOCK'));
        print(r, () => {
          for (const c of r.checks) out(`  [${c.ok ? 'ok' : 'NO'}] ${c.id}: ${c.detail}`);
          out(`${r.record_id}: ${r.workflow_id} for ${r.scope} (${r.mode}) — ${r.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);
        });
        return r.eligible ? 0 : 1;
      }
      case 'dry-run': {
        // A usage error is reported before the run is loaded, so it does not depend on the local run records.
        const m = mode('DRY_RUN');
        if (m !== 'DRY_RUN') throw new OrchestratorError(`dry-run only runs in DRY_RUN mode; use 'bmad prepare --mode MOCK' for a mock packet`, 'USAGE');
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const r = dryRun(wf, need('workflow'), need('scope'), { record: flags.record === true || str(flags, 'record') === 'true' });
        print(r, () => {
          out(`${r.workflow_id} (${r.binding_id} -> ${r.agent}) for ${r.eligibility.scope}: ${r.would_prepare ? 'would prepare' : 'would be REFUSED'}${r.record_id ? ` — ${r.record_id}` : ' (nothing written)'}`);
          for (const x of r.eligibility.reasons) out(`  - ${x}`);
          if (r.mapping_preview) {
            out(`  mapping ${r.mapping_preview.mapping_version}: ${r.mapping_preview.inputs.map((i: any) => i.name).join(', ')}`);
            out(`  provenance: ${JSON.stringify(r.mapping_preview.provenance_counts)}; rules source run ${r.mapping_preview.rules_source_run}`);
            for (const q of r.mapping_preview.requirements) out(`    ${q.id}: ${q.outcome}${q.usable ? '' : ' (not usable until approved)'}`);
          } else out(`  mapping error: ${r.mapping_error}`);
          out(`  LIVE refused: ${r.live_refused_because.length} reason(s)`);
        });
        return 0;
      }
      case 'prepare': {
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const m = mode('MOCK');
        if (m !== 'MOCK' && m !== 'LIVE') throw new OrchestratorError(`prepare takes --mode MOCK or LIVE`, 'USAGE');
        const p = preparePacket(wf, need('workflow'), need('scope'), m);
        print(p, () => out(`${p.packet_id}: ${p.workflow_id} -> ${p.agent} for ${p.scope} (${p.mode}); ${p.inputs.length} input(s); outputs only in ${p.allowed_outputs.output_dir}`));
        return 0;
      }
      case 'mock': {
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const r = mockResult(wf, need('packet'));
        const rec = flags['no-record'] ? null : recordResult(loadWorkflow(ctx, wf.run.runId), need('packet'), r.result_file);
        print({ result_file: r.result_file, receipt: rec }, () => {
          out(`mock result: ${r.result_file}`);
          if (rec) out(`${rec.receipt_id}: ${rec.accepted ? 'accepted' : 'REJECTED'} (${rec.evidence_status}, counts toward gates: ${rec.counts_toward_gates})`);
          for (const v of rec?.violations ?? []) out(`  - ${v}`);
        });
        return rec && !rec.accepted ? 1 : 0;
      }
      case 'record': {
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const rec = recordResult(wf, need('packet'), path.resolve(need('file')));
        print(rec, () => {
          out(`${rec.receipt_id}: ${rec.accepted ? 'accepted' : 'REJECTED'} (${rec.evidence_status})`);
          for (const v of rec.violations) out(`  - ${v}`);
        });
        return rec.accepted ? 0 : 1;
      }
      case 'report': {
        const d = discovery(ctx);
        let summary: any = null;
        try {
          summary = bmadSummary(loadWorkflow(ctx, str(flags, 'run') ?? 'latest'));
        } catch (e) {
          summary = { error: (e as Error).message };
        }
        const data = { generated_at: new Date().toISOString(), release: { package: d.release.package, version: d.release.version, verified: d.release.ok, checks: d.release.checks, installed: false }, impact: d.impact, bindings: { ok: d.bindings.ok, problems: d.bindings.problems, bindings: d.bindings.bindings.map((b) => ({ ...b, workflow: undefined })) }, workflow: summary };
        const outFile = path.resolve(str(flags, 'out') ?? path.join(ctx.forwardDir, 'reports', 'bmad-integration-report.md'));
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, renderBmadReport(data, d), 'utf8');
        fs.writeFileSync(outFile.replace(/\.md$/, '') + '.json', JSON.stringify(data, null, 2) + '\n', 'utf8');
        print({ report: outFile, ...data }, () => out(`report: ${outFile}`));
        return 0;
      }
      case 'reconcile': {
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const r = reconcileScope(buildSnapshot(wf), need('scope'));
        print(r, () => {
          out(`${r.scope} (digest ${r.scope_sha256.slice(0, 16)}…), baseline ${r.baseline.manifest_sha256.slice(0, 16)}…`);
          for (const u of r.units) out(`  unit ${u.name.padEnd(10)} ${u.unit_kind.padEnd(8)} ${u.relation}${u.needed_by.length ? ` (needed by ${u.needed_by.join(', ')} via ${u.via.join(', ')})` : ''}`);
          for (const x of [...r.requirements, ...r.runtime_requirements, ...r.data_contracts]) out(`  ${x.kind.padEnd(19)} ${x.id.padEnd(36)} ${x.outcome.padEnd(22)} ${x.inclusion}: ${x.reason}`);
          for (const d of r.decisions) out(`  decision ${d.id.padEnd(24)} ${d.effective_blocking ? 'BLOCKING' : 'non-blocking'} ${d.status.padEnd(8)} ${d.class}: ${d.reason}`);
          out(`  rules: ${r.rules.map((x) => x.id).join(', ')} (source run ${r.rules[0]?.source_run ?? '-'})`);
          out(`  excluded: ${r.excluded.requirements} requirement(s), ${r.excluded.decisions} decision(s), ${r.excluded.rules} rule(s) outside the scope; duplicate IDs: ${r.unique_ids.duplicates.length}`);
          out(`  summary: ${JSON.stringify(r.summary)}`);
        });
        return 0;
      }
      case 'isolation': {
        if (sub === 'doctor') {
          const a = assessHost(ctx);
          const ev = isolationEvidence(ctx);
          print({ ...a, isolation_tested: ev.tested, isolation_problems: ev.problems }, () => {
            out(`host: ${a.host.os ?? a.host.platform} (hypervisor ${a.host.hypervisor_present}); WSL2: ${a.wsl.available ? `${a.wsl.distro} ${a.wsl.os} kernel ${a.wsl.kernel}` : 'not available'}`);
            for (const [k, v] of Object.entries(a.primitives)) out(`  ${v.available ? 'yes' : 'no '} ${k}: ${v.detail}`);
            for (const b of a.boundaries) out(`  ${b.enforceable ? 'ENFORCEABLE    ' : 'NOT ENFORCEABLE'} ${b.boundary}: ${b.how} (${b.limits})`);
            for (const x of a.admin_actions_required) out(`  admin: ${x}`);
            out(`isolation: ${ev.tested ? 'ISOLATION_TESTED' : a.status}${ev.tested ? '' : ` (${ev.problems.join('; ')})`}`);
          });
          return 0;
        }
        if (sub === 'manifest') {
          const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
          const scope = need('scope');
          const files = scopeSourceFiles(buildSnapshot(wf), scope);
          const plan = { contract: 'bmad/workspace-plan', scope, network: 'none', mounts: [{ name: 'src', target: '/work/src', mode: 'ro' }, { name: 'inputs', target: '/work/inputs', mode: 'ro' }, { name: 'out', target: '/work/out', mode: 'rw' }], src_files: files.map((f) => ({ path: f.path, file_id: f.file_id, sha256: f.sha256, bytes: f.bytes })), inputs: 'the mapped inputs of the prepared packet (hashes in the packet)', excluded: ['user home', 'credentials and SSH keys', 'signing keys and the trust store', 'Windows drives', 'unrelated repositories', 'host control sockets'], built: false, note: 'a plan only: the workspace is materialised from these exact files (copied, never linked) only for an authorised run' };
          print(plan, () => {
            out(`workspace plan for ${scope} (not built): network none; mounts src ro, inputs ro, out rw`);
            for (const f of plan.src_files) out(`  src/${f.path} ${f.sha256.slice(0, 16)}... (${f.bytes} bytes)`);
            out(`  excluded: ${plan.excluded.join(', ')}`);
          });
          return 0;
        }
        if (sub === 'test') {
          const r = runIsolationTests(ctx);
          if (flags.record === true) {
            fs.writeFileSync(ISOLATION_REPORT(ctx), JSON.stringify(r, null, 2) + '\n', 'utf8');
            const dir = path.join(ctx.forwardDir, 'reports', 'step-9');
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, 'isolation-test-report.json'), JSON.stringify(r, null, 2) + '\n', 'utf8');
          }
          print(r, () => {
            for (const c of [...r.host_checks, ...r.sandbox_checks]) out(`  [${c.passed ? 'PASS' : 'FAIL'}] ${c.test}: ${c.detail}`);
            out(`isolation suite: ${r.executed ? (r.all_passed ? 'ALL PASSED' : 'FAILURES') : `NOT EXECUTED (${r.reason_not_executed})`} — ${r.status}; synthetic data only${flags.record === true ? '; recorded' : ''}`);
          });
          return r.all_passed ? 0 : 1;
        }
        err('bmad isolation: use doctor | manifest --scope S | test [--record] (synthetic data only; no LIVE launch exists)');
        return 2;
      }
      case 'executor': {
        if (sub === 'doctor') {
          const d = executorDoctor(ctx);
          print(d, () => {
            for (const c of d.checks) out(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
            out(`bmad executor: isolated installation ${d.ok_for_installation ? 'VERIFIED' : 'NOT ready'}; LIVE execution ${d.ok_for_live ? 'possible' : 'BLOCKED'}`);
          });
          return d.ok_for_installation ? 0 : 1;
        }
        if (sub === 'eligibility') {
          const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
          const r = executorEligibility(wf, need('workflow'), need('scope'));
          print(r, () => {
            out(`${r.workflow_id} (${r.binding_id} -> ${r.agent}) LIVE for ${r.scope}: ${r.eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'}`);
            for (const x of r.reasons) out(`  - ${x}`);
          });
          return r.eligible ? 0 : 1;
        }
        if (sub === 'dry-run') {
          const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
          const m = executionManifest(wf, need('workflow'), need('scope'));
          let record: string | null = null;
          if (flags.record === true) {
            record = mutate(wf, 'bmad executor dry-run', () => {
              const n = wf.store.list('bmad').filter((f) => f.startsWith('BXM-')).length + 1;
              const id = `BXM-${String(n).padStart(4, '0')}`;
              const file = wf.store.writeRecord('bmad', `${id}.json`, { record_id: id, ...m });
              wf.store.append('bmad_record_written', { record: `bmad/${id}.json`, kind: 'BXM', sha256: sha256File(file) });
              wf.store.writeState(wf.state);
              return id;
            });
          }
          print({ record, ...m }, () => {
            out(`${m.workflow_id} LIVE execution manifest for ${m.scope}: executable=${m.executable}${record ? ` — ${record}` : ' (nothing written, nothing executed)'}`);
            out(`  workspace: ${m.workspace.path} (isolated ${m.workspace.isolated}); HOME ${m.workspace.home}`);
            out(`  command: ${m.command.program} ${m.command.args.map((a: string) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
            out(`  provider: ${m.provider.name} via ${m.provider.runner}; authorization ${m.provider.authorization_id ?? 'none'}`);
            for (const b of m.blockers) out(`  - ${b}`);
          });
          return 0;
        }
        if (sub === 'preflight') {
          const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
          const r = preflight(wf, need('workflow'), need('scope'), { record: !flags['no-record'], assessment: assessHost(ctx) });
          print(r, () => {
            for (const c of r.checks) out(`  [${c.ok ? 'ok' : 'NO'}] ${c.id}: ${c.detail}`);
            out(`${r.workflow_id} LIVE preflight for ${r.scope}: ${r.launch_permitted ? 'PERMITTED' : 'REFUSED'} — ${r.execution_status}${r.record_id ? `; sealed ${r.record_id}` : ''} (nothing launched)`);
          });
          return r.launch_permitted ? 0 : 1;
        }
        if (sub === 'report') {
          const d = executorDoctor(ctx);
          let real: any[] = [];
          try {
            const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
            const scope = str(flags, 'scope');
            if (scope) real = ['bmad-prd', 'bmad-architecture', 'bmad-create-epics-and-stories', 'bmad-sprint-planning', 'bmad-build', 'bmad-code-review'].map((w) => executorEligibility(wf, w, scope));
          } catch (e) {
            real = [{ error: (e as Error).message }];
          }
          const data = { generated_at: new Date().toISOString(), doctor: d, eligibility: real };
          const file = path.resolve(str(flags, 'out') ?? path.join(ctx.forwardDir, 'reports', 'bmad-executor-report.json'));
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
          print({ report: file, ...data }, () => {
            out(`report: ${file}`);
            out(`  installation ${d.ok_for_installation ? 'verified' : 'not ready'}; LIVE ${d.ok_for_live ? 'possible' : 'blocked'}`);
            for (const r of real) out(`  ${r.workflow_id ?? '?'}: ${r.eligible ? 'eligible' : `${(r.reasons ?? [r.error]).length} blocker(s)`}`);
          });
          return 0;
        }
        err('bmad executor: use doctor | preflight --workflow W --scope S | eligibility --workflow W --scope S | dry-run --workflow W --scope S [--record] | report [--scope S] [--out FILE] (there is no execute command)');
        return 2;
      }
      case 'governance': {
        // STEP 21: the mandatory-BMad verdict of one scope, from the recorded receipts (read-only).
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const v = governanceVerdict(wf, need('scope'));
        print(v, () => {
          out(`${v.scope}: ${v.status}${v.mandatory ? ' (BMad is mandatory for governed runs)' : ''}`);
          for (const s of v.stages) out(`  ${s.stage.padEnd(14)} ${s.workflow_id.padEnd(30)} ${s.agent} ${s.status}${s.receipt_id ? ` ${s.receipt_id}` : ''} - ${s.reasons[0]}`);
          out(`  ${v.acceptance}`);
        });
        return v.status === 'BMAD_COMPLIANT' ? 0 : 3;
      }
      case 'governed-run': {
        // STEP 21: the governed dispatcher. No LIVE runner exists on this host, so a stage that the preflight would
        // permit is still blocked here; nothing falls back to the local converter.
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const r = governedRun(wf, need('scope'), { runner: null, assessment: assessHost(ctx) });
        print(r, () => {
          out(`${r.record_id} ${r.scope}: ${r.status} (fallback: ${r.fallback}; local conversion invoked: ${r.local_conversion_invoked})`);
          for (const s of r.stages) out(`  ${s.stage.padEnd(14)} ${s.workflow_id.padEnd(30)} ${s.status}${s.preflight_id ? ` ${s.preflight_id}` : ''}${s.blockers.length ? ` - ${s.blockers.length} blocker(s): ${s.blockers[0]}` : ''}`);
        });
        return r.status === 'BMAD_COMPLIANT' ? 0 : 3;
      }
      case 'run':
        err('bmad run does not exist: BMad workflows are executed only through the governed dispatcher (bmad governed-run --scope S) and its gates');
        return 2;
      default:
        err(USAGE);
        return 2;
    }
  } catch (e) {
    if (e instanceof OrchestratorError) {
      if (json) out(JSON.stringify({ ok: false, code: e.code, message: e.message, details: e.details }, null, 2));
      err(`bmad ${action}: ${e.message}`);
      for (const d of e.details) err(`  - ${d}`);
      return e.code === 'USAGE' ? 2 : e.code === 'BMAD_LIVE_NOT_AUTHORIZED' ? 3 : 1;
    }
    err(`bmad ${action}: ${(e as Error)?.message ?? e}`);
    return 1;
  }
}
