/**
 * Authorised local COBOL-to-Java generation (STEP 16).
 *
 * Runs the deterministic local converter (convertCore) on ONE real program
 * only when checkLocalAuthorization passes for exactly that program and
 * output directory. Nothing else is resolved: COPY members come only from
 * the hash-bound copybooks of the authorisation, every CALL target is
 * treated as unavailable (a gap), and the source and copybook hashes are
 * re-checked after generation before the operation is sealed in the audit
 * log (`local_generation_performed`). The global java_generation_allowed
 * flag, the orchestrator guard and G0-G8 are not consulted or changed.
 * No source leaves the machine.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { mutate, Workflow } from '../orchestrator/orchestrator';
import { sourceFile } from '../../../verification/src/cobol-source';
import { checkLocalAuthorization } from './authorization';
import { convertCore, detectToolchain, PilotRefused, Toolchain } from './pilot';

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');

/**
 * Converts reviewed test cases (contract pilot/conversion-test-cases: id, type,
 * input, expected return_code/message or unsupported gap) into the converter's
 * field-list fixtures `type|input|rc|message`. A note of the form
 * "(with a previous return code N and message 'M' ...)" sets the initial
 * output fields; otherwise they start as 0 and spaces.
 */
export function fieldListFixtures(cases: any): any {
  const prior = /\s*\(with a previous return code (\d+) and message '([^']*)'[^)]*\)\s*$/;
  return {
    contract: 'pilot/fixtures',
    contract_version: '1.0',
    synthetic: false,
    program: cases.program,
    format: 'type|value|rc|message (alphanumeric fields right-trimmed on output)',
    provenance: `Converted mechanically from reviewed test cases (${cases.status ?? 'status unknown'}); expected results come from the cases, never from executing the generated Java.`,
    cases: cases.cases.map((k: any) => {
      const m = prior.exec(k.input);
      const value = m ? k.input.slice(0, m.index) : k.input;
      const input = `${k.type}|${value}|${m ? m[1] : 0}|${m ? m[2] : ''}`;
      const expected = k.expected.unsupported ? { blocked: true, reason: k.expected.unsupported } : { image: `${k.type}|${value}|${k.expected.return_code}|${k.expected.message}` };
      return { id: k.id, title: k.note ?? k.id, input, expected, cobol_lines: k.cobol_lines };
    }),
  };
}

export interface GenerateOptions {
  program: string;
  out: string;
  cases: any;
  casesFile: string;
  javaPackage: string;
  toolchain?: Toolchain;
  at?: Date;
}

export function generateAuthorized(wf: Workflow, ctx: RuntimeContext, o: GenerateOptions): any {
  const out = path.resolve(o.out);
  const auth = checkLocalAuthorization(wf, ctx, o.program, out, o.at);
  if (!auth.ok) throw new PilotRefused(`local generation of ${o.program} is not authorised: ${auth.checks.filter((c) => !c.ok).map((c) => `${c.id} (${c.detail})`).join('; ')}`);
  const a = auth.authorization;
  if (o.cases.program !== o.program) throw new PilotRefused(`the test cases are for ${o.cases.program}, not ${o.program}`);
  const root = ctx.sourceRoot!;
  const progFile = path.join(root, a.source.path);
  const copy = new Map<string, string>(a.copybooks.map((c: any) => [path.basename(c.path).replace(/\.[^.]+$/, '').toUpperCase(), path.join(root, c.path)]));
  const resolve = (m: string) => {
    const f = copy.get(m.toUpperCase());
    return f ? sourceFile(f, fs.readFileSync(f, 'utf8')) : null;
  };
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  const inputs = [
    { path: a.source.path, sha256: a.source.sha256 },
    ...a.copybooks.map((c: any) => ({ path: c.path, sha256: c.sha256 })),
    { path: path.relative(ctx.repoRoot, o.casesFile).split(path.sep).join('/'), sha256: sha(fs.readFileSync(o.casesFile)) },
  ];
  const authorization = { record_id: a.record_id, policy: a.policy, program: a.program, source_sha256: a.source.sha256, output_dir: a.output_dir, accepted_by: a.accepted_by, accepted_at: a.accepted_at, valid_until: a.valid_until, checks: auth.checks };
  const r = convertCore({
    progFile,
    resolve,
    available: new Set<string>(),
    pkg: o.javaPackage,
    out,
    fixtures: fieldListFixtures(o.cases),
    inputs,
    statement: `Authorised local deterministic generation under ${a.record_id} (${a.policy}); not an F5 agent generation and not a G2-G4 approval.`,
    synthetic: false,
    isolation: { output_dir: out, workflow_used: true, approvals_used: false, production_generation: false, external_ai_calls: false, authorization_record: a.record_id },
    tc: o.toolchain ?? detectToolchain(),
    refDir: path.dirname(progFile),
    refDef: {},
    authorization,
  });
  // The inputs must still be the authorised ones after generation.
  const after = checkLocalAuthorization(wf, ctx, o.program, out, o.at);
  if (!after.ok) throw new PilotRefused(`the authorised inputs changed during generation: ${after.checks.filter((c) => !c.ok).map((c) => c.id).join(', ')}`);
  mutate(wf, 'local generation performed', () => {
    wf.store.append('local_generation_performed', {
      record_id: a.record_id,
      program: o.program,
      output_dir: a.output_dir,
      source_sha256: a.source.sha256,
      conversion_status: r.conversion_status,
      compilation: r.compilation?.status ?? 'NOT_RUN',
      execution: r.execution?.counts ?? null,
      gaps: (r.gaps ?? []).map((g: any) => g.gap_id),
      evidence_manifest_sha256: r.evidence?.manifest_sha256 ?? null,
    });
    wf.store.writeState(wf.state);
  });
  return r;
}
