/**
 * BMad workflow bindings (STEP 6). A binding ties one verified BMad workflow
 * of the pinned release to one REVFORGE forward agent, the gates and
 * artefacts it needs, and the output contract its result must satisfy. The
 * bindings are configuration; their validation is not: a binding is unusable
 * if its workflow is not an active definition of the verified release (shims,
 * deprecated and agent-persona skills are refused, never silently followed),
 * if its agent's permissions disagree with it, or if it would make F6 depend
 * on BMad.
 */
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { readJson } from '../core/fsutil';
import { findAgent } from '../orchestrator/agents';
import { STATES } from '../orchestrator/states';
import { bmadPaths, Check, ReleaseVerification, WorkflowEntry } from './release';

export type Requirement = 'architecture_artifacts' | 'validated_stories' | 'java_target_dir' | 'generation_authorized' | 'implementation_artifacts' | 'independent_test_receipt' | 'reviewer_not_implementer';

export interface Binding {
  binding_id: string;
  workflow_id: string;
  purpose: string;
  revforge_target: string;
  agent: 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6' | 'F7';
  allowed_states: string[];
  requires_gates: string[];
  requires_exact_scope: true;
  requires: Requirement[];
  output_contract: string;
  may_write_code: boolean;
  may_approve: false;
}

export interface BindingConfig {
  contract: 'bmad/binding-config';
  binding_version: string;
  release: { package: string; version: string };
  live_execution: { requested: boolean; note: string };
  bindings: Binding[];
  independent_agents: Array<{ agent: string; reason: string }>;
}

export interface LoadedBindings {
  config: BindingConfig | null;
  sha256: string | null;
  mapping: any | null;
  mapping_sha256: string | null;
  problems: string[];
}

export function loadBindings(ctx: RuntimeContext): LoadedBindings {
  const p = bmadPaths(ctx);
  const out: LoadedBindings = { config: null, sha256: null, mapping: null, mapping_sha256: null, problems: [] };
  const b = readJson(p.bindings);
  if (!b.ok) out.problems.push(`cannot read ${path.basename(p.bindings)}: ${b.error}`);
  else {
    const v = ctx.contracts.validate('bmad/binding-config', b.data);
    if (!v.valid) out.problems.push(`bindings.json fails bmad/binding-config: ${v.errors.join('; ')}`);
    else {
      out.config = b.data as BindingConfig;
      out.sha256 = b.sha256;
    }
  }
  const m = readJson(p.mapping);
  if (!m.ok) out.problems.push(`cannot read ${path.basename(p.mapping)}: ${m.error}`);
  else {
    const v = ctx.contracts.validate('bmad/mapping-spec', m.data);
    if (!v.valid) out.problems.push(`mapping.json fails bmad/mapping-spec: ${v.errors.join('; ')}`);
    else {
      out.mapping = m.data;
      out.mapping_sha256 = m.sha256;
    }
  }
  return out;
}

export interface BindingValidation {
  binding_id: string;
  workflow_id: string;
  agent: string;
  ok: boolean;
  checks: Check[];
  workflow: WorkflowEntry | null;
}

/** Validates every binding against the verified release and the runtime's agent registry. */
export function validateBindings(ctx: RuntimeContext, rel: ReleaseVerification, lb: LoadedBindings = loadBindings(ctx)): { ok: boolean; problems: string[]; bindings: BindingValidation[] } {
  const problems = [...lb.problems];
  const out: BindingValidation[] = [];
  const cfg = lb.config;
  if (!cfg) return { ok: false, problems, bindings: out };
  if (cfg.release.package !== rel.package || cfg.release.version !== rel.version) problems.push(`bindings target ${cfg.release.package}@${cfg.release.version} but the verified release is ${rel.package}@${rel.version}`);
  const ids = new Set<string>();
  for (const b of cfg.bindings) {
    const checks: Check[] = [];
    const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
    add('unique_binding', !ids.has(b.binding_id), ids.has(b.binding_id) ? `duplicate binding ${b.binding_id}` : 'binding ID is unique');
    ids.add(b.binding_id);
    const w = rel.registry.find((x) => x.workflow_id === b.workflow_id) ?? null;
    add('workflow_registered', !!w, w ? `${b.workflow_id} is registered at ${w.path}` : `${b.workflow_id} is not a workflow of the pinned release`);
    if (w) {
      add('workflow_active', w.lifecycle === 'active', w.lifecycle === 'active' ? 'active (not a shim or deprecated definition)' : `${b.workflow_id} is ${w.lifecycle}${w.forwards_to ? ` (forwards to ${w.forwards_to})` : ''}; bind the replacement explicitly`);
      const probs = rel.workflow_problems.get(b.workflow_id) ?? ['not verified'];
      add('workflow_unmodified', rel.ok && probs.length === 0, probs.length ? probs.join(', ') : rel.ok ? 'definition matches the pinned hashes' : 'release verification failed');
    }
    const a = findAgent(b.agent);
    add('agent_known', !!a, a ? `${b.agent} ${a.name}` : `unknown agent ${b.agent}`);
    if (a) {
      add('agent_code_permission', b.may_write_code === a.may_write_code, b.may_write_code === a.may_write_code ? `may_write_code=${b.may_write_code} agrees with ${a.id}` : `binding may_write_code=${b.may_write_code} disagrees with ${a.id} (${a.may_write_code})`);
      const gate = a.requires_gate;
      add('agent_gate_included', !gate || b.requires_gates.includes(gate), `agent dispatch gate ${gate ?? 'none'} is ${!gate || b.requires_gates.includes(gate) ? '' : 'NOT '}covered by the binding's gates (${b.requires_gates.join(', ')})`);
    }
    add('not_independent_tester', b.agent !== 'F6', b.agent === 'F6' ? 'F6 independent testing may not be bound to a BMad workflow' : 'F6 stays independent of BMad');
    const badStates = b.allowed_states.filter((s) => !(STATES as readonly string[]).includes(s));
    add('states_known', !badStates.length, badStates.length ? `unknown workflow state(s): ${badStates.join(', ')}` : `allowed in ${b.allowed_states.join(', ')}`);
    add('g2_required', b.requires_gates.includes('G1') && b.requires_exact_scope === true, 'every binding requires G1 PASS for the exact approved scope');
    add('never_approves', b.may_approve === false, 'BMad results are drafts or recommendations; approval stays with signed humans');
    if (b.workflow_id === 'bmad-build') add('build_constraints', b.requires_gates.includes('G2') && b.requires.includes('java_target_dir') && b.requires.includes('generation_authorized'), 'build requires G2, an authorised Java target directory and generation authorisation');
    if (b.workflow_id === 'bmad-code-review') add('review_constraints', b.requires.includes('implementation_artifacts') && b.requires.includes('independent_test_receipt') && b.requires.includes('reviewer_not_implementer') && b.agent !== 'F5', 'review requires real implementation artefacts, an independent F6 receipt and a reviewer other than the implementer');
    if (b.workflow_id === 'bmad-sprint-planning') add('sprint_constraints', b.requires_gates.includes('G2') && b.requires.includes('validated_stories'), 'sprint planning requires G2 and validated stories');
    if (b.workflow_id === 'bmad-create-epics-and-stories') add('stories_constraints', b.requires.includes('architecture_artifacts'), 'stories require recorded architecture artefacts');
    add('output_contract', ctx.contracts.names.includes(b.output_contract), ctx.contracts.names.includes(b.output_contract) ? `${b.output_contract} is a registered contract` : `${b.output_contract} is not a registered contract`);
    add('mapping_defined', !!lb.mapping?.inputs?.[b.binding_id], lb.mapping?.inputs?.[b.binding_id] ? `mapping ${lb.mapping.mapping_version} defines ${lb.mapping.inputs[b.binding_id].length} input(s)` : `mapping.json defines no inputs for ${b.binding_id}`);
    out.push({ binding_id: b.binding_id, workflow_id: b.workflow_id, agent: b.agent, ok: checks.every((c) => c.ok), checks, workflow: w });
  }
  if (cfg.bindings.some((b) => b.agent === 'F6')) problems.push('F6 must stay independent');
  return { ok: !problems.length && out.every((b) => b.ok), problems, bindings: out };
}

export function findBinding(cfg: BindingConfig, key: string): Binding | undefined {
  const k = key.toLowerCase();
  return cfg.bindings.find((b) => b.binding_id.toLowerCase() === k || b.workflow_id === k);
}
