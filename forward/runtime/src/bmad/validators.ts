/**
 * BMad result validators (STEP 6). A result is the normalised JSON envelope
 * of one workflow run plus the documents it lists. It is accepted only when
 * it satisfies its JSON contract AND the semantic checks for its workflow:
 * it is bound to its packet, scope digest and baseline; its documents exist
 * inside the packet's allowed output location with the stated hashes; it
 * asserts no approval; and it cites only what the mapped inputs contain.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { sha256File } from '../core/fsutil';
import { isCodeGenerationPath } from '../core/guard';
import { findAgent } from '../orchestrator/agents';
import { canWrite, PolicyRoots } from '../orchestrator/permissions';
import { Check } from './release';

const APPROVAL_KEY = /^(approved|approval|approvals|approved_by|accepted_by|sign_?off|gate_status|gate_result|gate_passed|passed_gates)$/i;
const APPROVAL_VALUE = /^(approved|accepted|pass|passed|signed[-_ ]?off)$/i;

/** Paths in the result that assert an approval or a passed gate. */
export function approvalAssertions(v: unknown, at = '$'): string[] {
  const out: string[] = [];
  if (Array.isArray(v)) v.forEach((x, i) => out.push(...approvalAssertions(x, `${at}[${i}]`)));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (APPROVAL_KEY.test(k)) out.push(`${at}.${k}`);
      else if (/(^|_)(status|readiness_verdict|decision)$/i.test(k) && typeof x === 'string' && APPROVAL_VALUE.test(x)) out.push(`${at}.${k}=${x}`);
      out.push(...approvalAssertions(x, `${at}.${k}`));
    }
  }
  return out;
}

const norm = (p: string) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
const within = (p: string, dir: string) => norm(p) === norm(dir) || norm(p).startsWith(norm(dir).replace(/\/+$/, '') + '/');

export interface ValidationContext {
  ctx: RuntimeContext;
  packet: any;
  /** Mapped input documents of the packet, by name (read back from the packet directory). */
  inputs: Record<string, any>;
  roots: PolicyRoots;
  /** Current scope digest and baseline, re-derived at validation time. */
  current: { scope_sha256: string | null; manifest_sha256: string };
  /** Documents of upstream results the packet supplied (path -> sha256), e.g. the implementation under review. */
  upstreamDocuments: Map<string, string>;
  /** Accepted F6 receipt IDs. */
  independentTestReceipts: string[];
  /** Upstream implementation receipt IDs and their producing agents. */
  implementationReceipts: Map<string, string>;
}

export function validateResult(v: ValidationContext, result: any): { ok: boolean; checks: Check[]; documents: Array<{ path: string; sha256: string }> } {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const P = v.packet;
  const c = v.ctx.contracts.validate(P.output_contract, result);
  add('contract', c.valid, c.valid ? `${P.output_contract} valid` : c.errors.slice(0, 6).join('; '));
  if (!c.valid) return { ok: false, checks, documents: [] };

  // Binding to the packet and to current content.
  const bound = result.packet_id === P.packet_id && result.binding_id === P.binding_id && result.workflow_id === P.workflow_id && result.agent === P.agent && result.mode === P.mode && result.scope === P.scope;
  add('bound_to_packet', bound, bound ? `result is for ${P.packet_id} (${P.binding_id}, ${P.agent}, ${P.mode}, ${P.scope})` : `result names ${result.packet_id}/${result.binding_id}/${result.workflow_id}/${result.agent}/${result.mode}/${result.scope}, packet is ${P.packet_id}/${P.binding_id}/${P.workflow_id}/${P.agent}/${P.mode}/${P.scope}`);
  const digest = result.scope_sha256 === P.scope_sha256 && P.scope_sha256 === v.current.scope_sha256;
  add('scope_current', digest, digest ? 'result, packet and current scope digest agree' : `stale: result ${String(result.scope_sha256).slice(0, 12)}…, packet ${String(P.scope_sha256).slice(0, 12)}…, current ${String(v.current.scope_sha256).slice(0, 12)}…`);
  const base = result.baseline_manifest_sha256 === P.baseline.manifest_sha256 && P.baseline.manifest_sha256 === v.current.manifest_sha256;
  add('baseline_current', base, base ? 'baseline manifest unchanged' : 'baseline manifest differs from the packet or the result');
  const producerOk = (P.mode === 'MOCK' && result.produced_by.kind === 'mock') || (P.mode === 'LIVE' && result.produced_by.kind === 'agent' && result.produced_by.id === findAgent(P.agent)?.name);
  add('producer', producerOk, producerOk ? `produced by ${result.produced_by.kind} ${result.produced_by.id}` : `a ${P.mode} result must be produced by ${P.mode === 'MOCK' ? 'the mock producer' : findAgent(P.agent)?.name}, not ${result.produced_by.kind} ${result.produced_by.id}`);
  const assertions = approvalAssertions({ ...result, contract: undefined });
  add('no_approval_assertion', !assertions.length, assertions.length ? `result asserts approval: ${assertions.slice(0, 4).join(', ')}` : 'result asserts no approval or passed gate');

  // Documents: inside the allowed output location, permitted for the agent, hashes match.
  const agent = findAgent(P.agent)!;
  const docs: Array<{ path: string; sha256: string }> = [];
  const docProblems: string[] = [];
  for (const d of result.documents as Array<{ path: string; sha256: string; kind: string }>) {
    const abs = path.resolve(v.ctx.repoRoot, d.path);
    const inOut = within(abs, path.resolve(v.ctx.repoRoot, P.allowed_outputs.output_dir));
    const inJava = !!P.allowed_outputs.java_target_dir && within(abs, path.resolve(v.ctx.repoRoot, P.allowed_outputs.java_target_dir));
    if (!inOut && !inJava) docProblems.push(`${d.path} is outside the packet's allowed output locations`);
    const perm = canWrite(agent, abs, v.roots);
    if (!perm.allowed) docProblems.push(`${d.path}: ${perm.reason}`);
    if ((isCodeGenerationPath(abs) || d.kind === 'java' || d.kind === 'build') && !P.allowed_outputs.may_write_code) docProblems.push(`${d.path}: ${P.binding_id} may not produce code or build files`);
    const h = fs.existsSync(abs) ? sha256File(abs) : null;
    if (h !== d.sha256) docProblems.push(`${d.path}: ${h ? 'sha256 differs from the stated hash' : 'missing'}`);
    docs.push({ path: d.path, sha256: d.sha256 });
  }
  add('documents', !docProblems.length, docProblems.length ? docProblems.slice(0, 6).join(' | ') : `${docs.length} document(s) present inside the allowed output location with matching hashes`);

  // Workflow-specific semantics.
  const reqDoc = v.inputs['approved-requirements'];
  const usable = new Set<string>((reqDoc?.requirements ?? []).filter((r: any) => r.usable).map((r: any) => r.id));
  const reqById = new Map<string, any>((reqDoc?.requirements ?? []).map((r: any) => [r.id, r]));
  const unknown = (ids: string[]) => ids.filter((id) => !usable.has(id));
  const covered = (ids: Iterable<string>) => [...usable].filter((id) => ![...ids].includes(id));
  switch (P.output_contract) {
    case 'bmad/output-prd': {
      const ids = result.functional_requirements.map((r: any) => r.revforge_requirement_id);
      add('prd_no_new_requirements', !unknown(ids).length, unknown(ids).length ? `functional requirements cite requirements outside the approved scope: ${unknown(ids).join(', ')}` : 'every functional requirement is an approved scope requirement');
      add('prd_complete', !covered(ids).length, covered(ids).length ? `approved requirements missing from the PRD: ${covered(ids).join(', ')}` : `all ${usable.size} approved requirement(s) are rendered`);
      const refProblems: string[] = [];
      for (const fr of result.functional_requirements) {
        const src = reqById.get(fr.revforge_requirement_id);
        if (!src) continue;
        const allowed = new Set<string>((src.source_refs ?? []).map((r: any) => JSON.stringify(Object.entries(r).filter(([, x]) => typeof x === 'string' && /^SYS-/.test(x as string)).sort())));
        for (const r of fr.source_refs) {
          const key = JSON.stringify(Object.entries(r).filter(([, x]) => typeof x === 'string' && /^SYS-/.test(x as string)).sort());
          if (!allowed.has(key)) refProblems.push(`${fr.fr_id} cites a source reference that ${fr.revforge_requirement_id} does not have`);
        }
      }
      add('prd_source_refs', !refProblems.length, refProblems.length ? refProblems.slice(0, 4).join(' | ') : 'every cited permanent source reference belongs to the requirement');
      const scopeRules = new Set<string>((v.inputs['business-rules']?.rules ?? []).map((r: any) => r.id));
      const badRules = result.functional_requirements.flatMap((r: any) => r.rule_ids).filter((id: string) => !scopeRules.has(id));
      add('prd_rules_in_scope', !badRules.length, badRules.length ? `rules outside the scope: ${[...new Set(badRules)].join(', ')}` : 'cited rules belong to the scope (IDs are run-local to the recorded rules source run)');
      const decIds = new Set<string>((v.inputs.decisions?.decisions ?? []).map((d: any) => d.id));
      const badDec = result.assumptions.map((a: any) => a.decision_id).filter((id: string) => !decIds.has(id));
      add('prd_assumptions_decided', !badDec.length, badDec.length ? `assumptions cite unknown decisions: ${badDec.join(', ')}` : 'assumptions cite scope decisions only');
      break;
    }
    case 'bmad/output-architecture': {
      const ids = [...result.decisions.flatMap((d: any) => d.requirement_ids), ...result.components.flatMap((c: any) => c.requirement_ids)];
      add('arch_requirements_in_scope', !unknown(ids).length, unknown(ids).length ? `cites requirements outside the approved scope: ${[...new Set(unknown(ids))].join(', ')}` : 'decisions and components trace to approved requirements');
      add('arch_coverage', !covered(ids).length, covered(ids).length ? `approved requirements no component or decision addresses: ${covered(ids).join(', ')}` : 'every approved requirement is addressed');
      const units = new Set<string>((reqDoc?.requirements ?? []).flatMap((r: any) => r.units ?? []));
      for (const d of v.inputs['data-contracts']?.data_contracts ?? []) for (const u of d.units ?? []) units.add(u);
      const badUnits = result.components.flatMap((c: any) => c.cobol_units).filter((u: string) => !units.has(u));
      add('arch_units_in_scope', !badUnits.length, badUnits.length ? `components cite COBOL units outside the scope: ${[...new Set(badUnits)].join(', ')}` : 'components cite scope units only');
      break;
    }
    case 'bmad/output-epics': {
      const stories = result.epics.flatMap((e: any) => e.stories);
      const ids = [...result.epics.flatMap((e: any) => e.requirement_ids), ...stories.flatMap((s: any) => s.requirement_ids)];
      add('stories_requirements_in_scope', !unknown(ids).length, unknown(ids).length ? `cites requirements outside the approved scope: ${[...new Set(unknown(ids))].join(', ')}` : 'epics and stories trace to approved requirements');
      add('stories_coverage', !covered(stories.flatMap((s: any) => s.requirement_ids)).length, covered(stories.flatMap((s: any) => s.requirement_ids)).length ? `approved requirements without a story: ${covered(stories.flatMap((s: any) => s.requirement_ids)).join(', ')}` : 'every approved requirement has a story');
      const dup = stories.map((s: any) => s.story_id).filter((x: string, i: number, a: string[]) => a.indexOf(x) !== i);
      add('stories_unique', !dup.length, dup.length ? `duplicate story IDs: ${dup.join(', ')}` : `${stories.length} unique story ID(s)`);
      break;
    }
    case 'bmad/output-sprint': {
      const known = new Set<string>((v.inputs.stories?.story_ids ?? []) as string[]);
      const bad = result.stories.map((s: any) => s.story_id).filter((id: string) => !known.has(id));
      add('sprint_stories_approved', !bad.length, bad.length ? `stories that are not approved inputs: ${bad.join(', ')}` : 'sprint covers approved stories only');
      break;
    }
    case 'bmad/output-build': {
      const known = new Set<string>((v.inputs.stories?.story_ids ?? []) as string[]);
      const bad = [...result.story_ids, ...result.files.flatMap((f: any) => f.story_ids)].filter((id: string) => !known.has(id));
      add('build_stories_approved', !bad.length, bad.length ? `implements stories that are not approved inputs: ${[...new Set(bad)].join(', ')}` : 'implements approved stories only');
      const outside = result.files.filter((f: any) => !P.allowed_outputs.java_target_dir || !within(path.resolve(v.ctx.repoRoot, f.path), path.resolve(v.ctx.repoRoot, P.allowed_outputs.java_target_dir)));
      add('build_in_java_target', !outside.length, outside.length ? `files outside the authorised Java target: ${outside.map((f: any) => f.path).join(', ')}` : 'every file is inside the authorised Java target directory');
      const hashBad = result.files.filter((f: any) => sha256File(path.resolve(v.ctx.repoRoot, f.path)) !== f.sha256);
      add('build_file_hashes', !hashBad.length, hashBad.length ? `missing or changed files: ${hashBad.map((f: any) => f.path).join(', ')}` : 'file hashes match');
      add('build_result_consistent', (result.status === 'built') === (result.build.exit_code === 0), `status ${result.status} with exit code ${result.build.exit_code}`);
      break;
    }
    case 'bmad/output-review': {
      const implAgent = v.implementationReceipts.get(result.implementation_receipt);
      add('review_real_implementation', !!implAgent, implAgent ? `reviews recorded implementation ${result.implementation_receipt}` : `${result.implementation_receipt} is not a recorded implementation result supplied by the packet`);
      add('review_not_self', !!implAgent && implAgent !== P.agent, implAgent === P.agent ? `${P.agent} cannot review its own implementation` : 'reviewer differs from the implementer');
      add('review_independent_tests', v.independentTestReceipts.includes(result.independent_test_receipt), v.independentTestReceipts.includes(result.independent_test_receipt) ? `independent F6 receipt ${result.independent_test_receipt} referenced` : `${result.independent_test_receipt} is not an accepted F6 receipt`);
      const badFiles = result.reviewed_files.filter((f: any) => v.upstreamDocuments.get(f.path) !== f.sha256);
      add('review_files_current', !badFiles.length, badFiles.length ? `reviewed files are not the recorded implementation: ${badFiles.map((f: any) => f.path).join(', ')}` : 'reviewed files are the recorded implementation, unchanged');
      break;
    }
  }
  return { ok: checks.every((x) => x.ok), checks, documents: docs };
}
