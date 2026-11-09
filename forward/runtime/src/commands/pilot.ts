/**
 * Pilot commands (STEP 11):
 *   pilot plan --scope S [--export-dir D]   source-backed VERIFIED / PARTIAL / GAP plan (read-only on the workflow)
 *   pilot run [--dir D] [--out O]           isolated synthetic conversion pilot (no workflow, gates or approvals)
 * Neither command approves, resolves or excludes anything, and the pilot
 * never converts a program from the real COBOL source tree.
 */
import { createHash } from 'crypto';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { OrchestratorError, bmadLifecycleEvidence, loadWorkflow } from '../orchestrator/orchestrator';
import { writeExport } from '../operations/decisions';
import { modernizationPlan } from '../pilot/plan';
import { PilotRefused, runPilot } from '../pilot/pilot';
import { behaviourScope } from '../pilot/scope';
import { authorisationStatus, conversionCandidates, conversionValidation, sourceReadiness } from '../pilot/gates';
import { applicationStatus, renderApplicationStatus } from '../pilot/application';
import { checkLocalAuthorization, recordLocalAuthorization } from '../pilot/authorization';
import { generateAuthorized } from '../pilot/generate';
import { convertAppProgram } from '../pilot/app-convert';
import { integrateApp } from '../pilot/app-integrate';
import { authorizationRecords } from '../pilot/authorization';
import * as fs from 'fs';

/** STEP 21: a local (LGA) conversion is historically authorised and never BMad-governed (the label mirrors bmad/governance). */
const localConversionGovernance = (ctx: RuntimeContext): string =>
  (ctx.config as any).bmad_governance?.mandatory ? 'LOCAL_LGA_NOT_BMAD_GOVERNED (BMad is mandatory for governed runs; this conversion ran under a local-generation authorization)' : 'LOCAL_LGA';
type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);

export function pilotCommand(ctx: RuntimeContext, action: string | undefined, flags: Flags, json: boolean, out: Out, err: Out): number {
  const print = (o: unknown, text: () => void) => (json ? out(JSON.stringify(o, null, 2)) : text());
  const pilotRoot = path.join(ctx.forwardDir, 'pilot');
  try {
    switch (action) {
      case 'plan': {
        const scope = str(flags, 'scope');
        if (!scope) throw new OrchestratorError('--scope is required', 'USAGE');
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const plan = modernizationPlan(wf, scope);
        const v = ctx.contracts.validate('pilot/modernization-plan', plan);
        if (!v.valid) throw new OrchestratorError(`modernization plan violates its contract: ${v.errors.join('; ')}`, 'CHECK_FAILED');
        const dir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-11'));
        const name = `modernization-plan-${plan.scope.replace(/[^A-Za-z0-9]+/g, '_')}.json`;
        writeExport(dir, name, plan);
        print({ written: path.join(dir, name), ...plan }, () => {
          out(`${plan.scope}: ${plan.readiness}; digest ${plan.scope_sha256.slice(0, 16)}… (${plan.status})`);
          for (const r of plan.requirements) out(`  ${r.id.padEnd(20)} ${r.category.padEnd(8)} ${r.support_class.padEnd(32)} G1 ${r.g2.outcome}`);
          out(`  written: ${path.join(dir, name)}`);
        });
        return 0;
      }
      case 'scope': {
        const scope = str(flags, 'scope');
        if (!scope) throw new OrchestratorError('--scope is required', 'USAGE');
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const m = behaviourScope(wf, scope);
        const v = ctx.contracts.validate('pilot/verified-scope', m);
        if (!v.valid) throw new OrchestratorError(`verified-scope manifest violates its contract: ${v.errors.join('; ')}`, 'CHECK_FAILED');
        const dir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-12'));
        const name = `verified-scope-${m.scope.replace(/[^A-Za-z0-9]+/g, '_')}.json`;
        writeExport(dir, name, m);
        print({ written: path.join(dir, name), ...m }, () => {
          for (const p of m.programs) {
            for (const b of p.behaviours ?? []) out(`  ${b.behaviour_id.padEnd(34)} ${b.classification.padEnd(19)} covered by ${b.covered_by.join(', ') || '-'}`);
            out(`  selected candidate: ${p.selected_candidate ? `${p.selected_candidate.behaviour_id} (${p.selected_candidate.requirements.map((r: any) => r.id).join(', ')})` : `none: ${p.no_candidate_reason}`}`);
            if (p.g2_subset_eligibility) out(`  G1 subset ${p.g2_subset_eligibility.selector}: ${p.g2_subset_eligibility.readiness}; ${JSON.stringify(p.g2_subset_eligibility.counts)}; limitations ${p.g2_subset_eligibility.limitations.map((l: any) => l.id).join(', ') || 'none'}`);
            out(`  gaps: ${(p.gaps ?? []).length} (${(p.gaps ?? []).filter((g: any) => g.blocking).length} blocking)`);
          }
          out(`  written: ${path.join(dir, name)}`);
        });
        return 0;
      }
      case 'application': {
        // Application-wide status: readiness, converter capability (parse only), authorisation, honest per-program status.
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const s = applicationStatus(wf, ctx);
        const dir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-15'));
        writeExport(dir, 'application-status.json', s);
        writeExport(path.join(ctx.forwardDir, 'reports'), 'APPLICATION-MODERNIZATION-STATUS.md', renderApplicationStatus(s));
        print(s.counts, () => out(`programs ${s.counts.programs}: ${['COMPLETE', 'PARTIAL', 'FAILED', 'BLOCKED', 'NOT_ATTEMPTED'].map((k) => `${k} ${s.counts[k]}`).join(', ')}; SOURCE_READINESS PASS ${s.counts.source_readiness_pass}; converter-ready ${s.counts.converter_ready}; locally authorised ${s.counts.locally_authorised}; Java generated ${s.counts.java_generated}; workflow generation authorised ${s.authorisation.generation_authorized}`));
        return 0;
      }
      case 'candidates': {
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const list = conversionCandidates(wf);
        const dir = str(flags, 'export-dir');
        if (dir) writeExport(path.resolve(dir), 'conversion-candidates.json', list);
        print(list, () => {
          for (const c of list.slice(0, 15)) out(`  ${c.eligible ? 'ELIGIBLE  ' : 'excluded  '} ${c.program.padEnd(10)} ${c.metrics ? `external ${c.metrics.external_operations}, includes ${c.metrics.includes.join('+') || '-'}, ${c.metrics.statements} statements` : ''} ${c.reasons.join('; ')}`);
        });
        return 0;
      }
      case 'readiness': {
        // Engineering gate 1 plus the unchanged authorisation status.
        const program = str(flags, 'program');
        if (!program) throw new OrchestratorError('--program is required', 'USAGE');
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const g = sourceReadiness(wf, program);
        const auth = authorisationStatus(wf, ctx, program);
        const dir = str(flags, 'export-dir');
        if (dir) writeExport(path.resolve(dir), `source-readiness-${program}.json`, { ...g, authorisation: auth });
        print({ ...g, authorisation: auth }, () => {
          out(`SOURCE_READINESS ${program}: ${g.status}`);
          for (const c of g.checks) out(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
          out(`  generation authorised: ${auth.generation_authorized}${auth.blockers.length ? ` — ${auth.blockers.join('; ')}` : ''}`);
        });
        return g.status === 'PASS' ? 0 : 1;
      }
      case 'validate': {
        // Engineering gate 2 on a conversion output directory.
        const out_ = str(flags, 'out');
        if (!out_) throw new OrchestratorError('--out is required', 'USAGE');
        const g = conversionValidation(ctx, path.resolve(out_), str(flags, 'dir') ? path.resolve(str(flags, 'dir')!) : undefined);
        print(g, () => {
          out(`CONVERSION_VALIDATION ${g.subject}: ${g.status} (label ${g.label ?? '-'})`);
          for (const c of g.checks) out(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
        });
        return g.status === 'PASS' ? 0 : 1;
      }
      case 'run': {
        const dir = path.resolve(str(flags, 'dir') ?? path.join(pilotRoot, 'synthetic-rc'));
        const r = runPilot({ dir, pilotRoot, out: str(flags, 'out') ? path.resolve(str(flags, 'out')!) : undefined, forbiddenRoots: [ctx.sourceRoot ?? '',path.join(ctx.repoRoot, 'output'), path.join(ctx.repoRoot, 'references')] });
        const v = ctx.contracts.validate('pilot/pilot-result', r);
        if (!v.valid) throw new OrchestratorError(`pilot result violates its contract: ${v.errors.join('; ')}`, 'CHECK_FAILED');
        print(r, () => {
          out(`pilot ${r.inspection?.program_id ?? '?'} (SYNTHETIC): ${r.conversion_status}: ${r.conversion_status_reason ?? r.failure?.construct ?? ''}`);
          out(`  compilation: ${r.compilation?.status ?? 'NOT_RUN'}; execution: ${r.execution?.status ?? 'NOT_RUN'} ${r.execution?.counts ? JSON.stringify(r.execution.counts) : ''}`);
          out(`  COBOL reference: ${r.cobol_reference?.status ?? 'NOT_RUN'}; validation: ${r.validation?.kind ?? '-'}; equivalence: ${r.equivalence ?? '-'}`);
          for (const g of r.gaps ?? []) out(`  gap ${g.gap_id} ${g.kind} ${g.subject} at ${g.origin.file}:${g.origin.line} (OPEN)`);
          out(`  output: ${r.isolation.output_dir}`);
        });
        return r.conversion_status === 'FAILED' ? 1 : 0;
      }
      case 'authorize': {
        // Records a project-owner-accepted program-scoped local generation authorisation (policy program_scoped_local_v1).
        const file = str(flags, 'input');
        if (!file) throw new OrchestratorError('--input is required (an authorisation input file holding the exact accepted text)', 'USAGE');
        const inp = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
        // One accepted text may cover several programs (a consolidated scope): one record per program.
        const all = inp.authorizations ?? [inp.authorization];
        if (!ctx.sourceRoot) throw new OrchestratorError('the COBOL source root is not configured; the source hashes cannot be confirmed', 'CHECK_FAILED');
        for (const a of all) {
          for (const f of [a.source, ...a.copybooks, ...(a.dependencies ?? [])]) {
            const abs = path.join(ctx.sourceRoot, f.path);
            const h = fs.existsSync(abs) ? createHash('sha256').update(fs.readFileSync(abs)).digest('hex') : null;
            if (h !== f.sha256) throw new OrchestratorError(`${a.program} ${f.path}: the current sha256 does not match the accepted record; the authorisation is void`, 'CHECK_FAILED');
          }
          if (a.scope_manifest) {
            const mf = path.join(ctx.repoRoot, a.scope_manifest.path);
            if (!fs.existsSync(mf) || createHash('sha256').update(fs.readFileSync(mf)).digest('hex') !== a.scope_manifest.sha256) throw new OrchestratorError(`${a.scope_manifest.path}: the scope manifest does not match the accepted record`, 'CHECK_FAILED');
          }
        }
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        // With mandatory BMad governance a NEW local-generation authorisation needs the scope's BMad lifecycle evidence
        // (verified LIVE receipts up to sprint and the accepted F2 data mapping). Existing records stay valid as
        // historical, non-BMad authorisations; nothing is relabelled.
        const ungoverned = all.map((a: any) => ({ program: a.program, e: bmadLifecycleEvidence(wf, `programs:${a.program}`, 'sprint') })).filter((x: any) => x.e.required && !x.e.ok);
        if (ungoverned.length) throw new OrchestratorError(`BMAD_BLOCKED: a new local-generation authorisation needs BMad lifecycle evidence for ${ungoverned.map((x: any) => x.program).join(', ')}`, 'BMAD_BLOCKED', ungoverned.flatMap((x: any) => x.e.reasons.map((r: string) => `${x.program}: ${r}`)));
        const done = all.map((a: any) => ({ program: a.program, ...recordLocalAuthorization(wf, a, inp.policy_statement) }));
        print(done, () => done.forEach((d: any) => out(`recorded ${d.authorization_id} for ${d.program} under ${d.policy_id}`)));
        return 0;
      }
      case 'authorization': {
        const program = str(flags, 'program');
        if (!program) throw new OrchestratorError('--program is required', 'USAGE');
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const outDir = path.resolve(str(flags, 'out') ?? path.join(ctx.forwardDir, 'generated', 'java', program));
        const r = checkLocalAuthorization(wf, ctx, program, outDir);
        print({ ok: r.ok, checks: r.checks, record_id: r.authorization?.record_id ?? null }, () => {
          out(`local generation of ${program}: ${r.ok ? 'AUTHORISED' : 'NOT AUTHORISED'}`);
          for (const c of r.checks) out(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
        });
        return r.ok ? 0 : 1;
      }
      case 'integrate': {
        // STEP 17: the integrated application (all authorised, compiled programs + JCL jobs) and its tests.
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const r = integrateApp(wf, ctx);
        const t = r.tests;
        print({ ...r, tests: t ? { runtime_unit: t.runtime_unit, program_tests: { counts: t.program_tests.counts, scenario_counts: t.program_tests.scenario_counts }, integration: t.integration } : null }, () => {
          out(`integrated ${r.programs.length} program(s), ${r.jobs.length} job(s); excluded: ${r.excluded.map((x: any) => `${x.program} (${x.reason})`).join('; ') || 'none'}`);
          out(`  compilation: ${r.compilation?.status} (${r.files} Java files)${r.compilation?.diagnostics?.length ? ' ' + r.compilation.diagnostics.slice(0, 5).join(' / ') : ''}`);
          if (t) {
            out(`  runtime unit tests: ${JSON.stringify(t.runtime_unit.counts)}`);
            out(`  program tests (isolated): ${JSON.stringify(t.program_tests.counts)}; scenarios ${JSON.stringify(t.program_tests.scenario_counts)}`);
            out(`  integration tests: ${JSON.stringify(t.integration.counts)}`);
            for (const c of [...t.cases.runtime, ...t.cases.programs, ...t.cases.integration].filter((x: any) => x.status === 'FAIL')) out(`  FAIL ${c.id}: ${(c.detail ?? '').slice(0, 300)}`);
          }
        });
        return r.compilation?.status === 'COMPILED' && t && !t.runtime_unit.counts.FAIL && !t.program_tests.counts.FAIL && !t.integration.counts.FAIL ? 0 : 1;
      }
      case 'convert-app': {
        // STEP 17: full-application conversion of every authorised program (or one with --program).
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const authorised = [...new Set(authorizationRecords(wf).map((r: any) => r.program as string))];
        const only = str(flags, 'program');
        const todo = only ? [only] : authorised;
        const rows: any[] = [];
        for (const program of todo) {
          const outDir = path.join(ctx.forwardDir, 'generated', 'java', program);
          try {
            const r = convertAppProgram(wf, ctx, { program, out: outDir, available: new Set(authorised) });
            const v = ctx.contracts.validate('pilot/pilot-result', r);
            rows.push({ program, status: r.conversion_status, governance: localConversionGovernance(ctx), compilation: r.compilation?.status ?? 'NOT_RUN', counts: r.execution?.counts ?? null, gaps: (r.gaps ?? []).length, contract: v.valid ? 'valid' : v.errors.slice(0, 3).join('; '), reason: r.conversion_status_reason });
          } catch (e) {
            if (!(e instanceof PilotRefused)) throw e;
            rows.push({ program, status: 'BLOCKED', reason: e.message });
          }
        }
        print(rows, () => rows.forEach((x) => out(`${x.program.padEnd(9)} ${String(x.status).padEnd(8)} ${String(x.compilation ?? '').padEnd(18)} ${x.counts ? `${x.counts.PASS}/${x.counts.BLOCKED_AS_EXPECTED}/${x.counts.FAIL}` : '-'} gaps=${x.gaps ?? '-'} ${x.contract && x.contract !== 'valid' ? `CONTRACT: ${x.contract}` : ''} ${x.status === 'FAILED' || x.status === 'BLOCKED' ? x.reason : ''}`)));
        return rows.some((x) => x.status === 'FAILED') ? 1 : 0;
      }
      case 'generate': {
        // Real program conversion under a scoped local authorisation only.
        const program = str(flags, 'program');
        const casesFile = str(flags, 'cases');
        if (!program || !casesFile) throw new OrchestratorError('--program and --cases are required', 'USAGE');
        const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
        const outDir = path.resolve(str(flags, 'out') ?? path.join(ctx.forwardDir, 'generated', 'java', program));
        const cases = JSON.parse(fs.readFileSync(path.resolve(casesFile), 'utf8'));
        const r = generateAuthorized(wf, ctx, { program, out: outDir, cases, casesFile: path.resolve(casesFile), javaPackage: `revforge.generated.${program.toLowerCase().replace(/[^a-z0-9]/g, '')}` });
        const v = ctx.contracts.validate('pilot/pilot-result', r);
        if (!v.valid) throw new OrchestratorError(`generation result violates its contract: ${v.errors.join('; ')}`, 'CHECK_FAILED');
        print(r, () => {
          out(`generation ${program} (AUTHORISED ${r.authorization.record_id}): ${r.conversion_status}: ${r.conversion_status_reason ?? r.failure?.construct ?? ''}`);
          out(`  governance: ${localConversionGovernance(ctx)}`);
          out(`  compilation: ${r.compilation?.status ?? 'NOT_RUN'}; execution: ${r.execution?.status ?? 'NOT_RUN'} ${r.execution?.counts ? JSON.stringify(r.execution.counts) : ''}`);
          out(`  COBOL reference: ${r.cobol_reference?.status ?? 'NOT_RUN'}; validation: ${r.validation?.kind ?? '-'}; equivalence: ${r.equivalence ?? '-'}`);
          for (const g of r.gaps ?? []) out(`  gap ${g.gap_id} ${g.kind} ${g.subject} at ${g.origin.file}:${g.origin.line} (OPEN)`);
          out(`  output: ${r.isolation.output_dir}`);
        });
        return r.conversion_status === 'FAILED' ? 1 : 0;
      }
      default:
        err('usage: pilot plan --scope S | pilot scope --scope S | pilot candidates | pilot readiness --program P | pilot validate --out O [--dir D] | pilot run [--dir D] [--out O] | pilot authorize --input F | pilot authorization --program P | pilot generate --program P --cases F   (each with optional --export-dir D)');
        return 2;
    }
  } catch (e) {
    if (e instanceof PilotRefused) {
      err(`pilot refused: ${e.message}`);
      return 3;
    }
    if (e instanceof OrchestratorError) {
      err(`pilot: ${e.message}`);
      return e.code === 'USAGE' ? 2 : 1;
    }
    throw e;
  }
}
