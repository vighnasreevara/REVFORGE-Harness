/**
 * demo gates [--out DIR] [--input DIR]
 *
 * Runs the synthetic two-gate workflow demonstration (environment
 * SYNTHETIC_INTERVIEW_DEMO): two pre-checks, the human gates G2 and G3, and
 * five automated steps. Exit 0 only when every step passed and the run
 * completed after the review; otherwise exit 1 with the first failing step's
 * diagnostic. Nothing in the
 * real workflow, configuration or evidence is changed.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { defaultRunsDir, DemoRefused, runDemo } from '../demo/gates';

type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);

export function demoCommand(ctx: RuntimeContext, action: string | undefined, flags: Flags, json: boolean, out: Out, err: Out): number {
  if (action !== 'gates') {
    err('usage: demo gates [--out DIR] [--input DIR] [--json]');
    return 2;
  }
  let res;
  try {
    res = runDemo({ ctx, outDir: str(flags, 'out'), inputDir: str(flags, 'input') });
  } catch (e) {
    if (e instanceof DemoRefused) {
      err(`refused: ${e.message}`);
      return 3;
    }
    throw e;
  }
  const { summary: s, run } = res;
  if (!str(flags, 'out')) {
    fs.mkdirSync(defaultRunsDir(ctx), { recursive: true });
    fs.writeFileSync(path.join(defaultRunsDir(ctx), 'LATEST'), `${s.demo_run_id}\n`);
  }
  if (json) {
    out(JSON.stringify(s, null, 2));
    return res.exitCode;
  }
  const label: Record<string, string> = { PASS: 'DEMO PASS', FAIL: 'DEMO FAIL', BLOCKED: 'DEMO BLOCKED', NOT_RUN: 'NOT RUN' };
  out(`REVFORGE synthetic two-gate (G2, G3) workflow demonstration  [environment ${s.environment}]`);
  out(`demo run ${s.demo_run_id}`);
  out(`synthetic source ${s.baseline.source.path} sha256 ${s.baseline.source.sha256}`);
  out('');
  for (const g of s.steps) {
    const checks = g.checks_total ? `${g.checks_passed}/${g.checks_total} checks` : '';
    out(`  ${`${g.step} ${g.name}`.padEnd(34)} ${`(${g.kind})`.padEnd(12)} ${label[g.demo_status].padEnd(13)} ${checks}`);
    if (g.demo_status !== 'PASS') out(`      ${g.reason}`);
  }
  out('');
  out(`verdict                   ${s.verdict}`);
  out(`production_authorization  ${s.production_authorization}`);
  out(`real_bmad_execution       ${s.real_bmad_execution} (${s.bmad.simulated_stages} BMad stages SIMULATED, ${s.bmad.counted_as_bmad_execution} counted as execution)`);
  out(`legacy_equivalence        ${s.legacy_equivalence}`);
  const rp = s.real_project_status;
  out(`real project (unchanged)  java_generation_allowed=${rp.generation_java_generation_allowed}, bmad mandatory=${rp.bmad_governance_mandatory}, gaps ${typeof rp.gap_register === 'object' ? `${rp.gap_register.open}/${rp.gap_register.records} OPEN` : rp.gap_register}`);
  out('');
  out(`report   ${path.relative(process.cwd(), path.join(run.outDir, 'DEMO-REPORT.md'))}`);
  out(`summary  ${path.relative(process.cwd(), path.join(run.outDir, 'demo-summary.json'))}`);
  return res.exitCode;
}
