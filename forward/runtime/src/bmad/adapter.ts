/**
 * Deterministic BMad adapter (STEP 6). It never runs BMad. It:
 *   discovers and verifies the pinned release and its workflow catalogue,
 *   validates the workflow -> agent bindings,
 *   decides eligibility from workflow state, gates, exact approved scope,
 *     baseline and hashes,
 *   prepares an immutable execution packet (mapped inputs, provenance
 *     sidecars, allowed output locations, forbidden actions),
 *   validates a returned result against its contract and semantic checks and
 *     records a receipt, rejecting unverified, stale or unauthorised results.
 * Modes: DISCOVERY (catalogue only), DRY_RUN (eligibility and mapping
 * preview; writes nothing unless asked to record), MOCK (a deterministic
 * stand-in result exercises packet -> validation -> receipt; it is never
 * evidence) and LIVE (refused unless the execution preflight permits the launch; see liveGate). Records live in
 * workflow/bmad and only the runtime writes there. BMad receipts never feed
 * a gate: G2 and G3 read only the forward workflow's own receipts and signed approvals.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { readJson, sha256File } from '../core/fsutil';
import { findAgent } from '../orchestrator/agents';
import { acceptedReceipts, mutate, OrchestratorError, policyRoots, Workflow } from '../orchestrator/orchestrator';
import { agentOutputDir } from '../orchestrator/permissions';
import { BindingConfig, findBinding, loadBindings, LoadedBindings, validateBindings } from './bindings';
import { decide, Facts, gatherFacts, liveGate, LiveFacts, Mode, UpstreamReceipt } from './eligibility';
import { buildMapping, jsonText } from './mapping';
import { bmadPaths, installationImpact, verifyRelease } from './release';
import { validateResult } from './validators';

export const BMAD_RECORDS = 'bmad';
const now = () => new Date().toISOString();
const rel = (ctx: RuntimeContext, p: string) => path.relative(ctx.repoRoot, p).split(path.sep).join('/');

export const FORBIDDEN = [
  'run the BMad installer or write to the repository .claude/, _bmad/ or global Claude Code settings',
  'modify reverse agents, reverse skills, forward agent or skill definitions, output/ artifacts or the original COBOL',
  'write outside the allowed output locations of this packet',
  'add, remove or reinterpret requirements of the approved scope',
  'approve, accept or sign off any artefact or declare any gate passed',
  'write to Neo4j or read credentials (.mcp.json, .env)',
  'generate Java or build files unless the packet authorises a Java target directory',
];

/* ------------------------------------------------------------------ */
/* records                                                             */
/* ------------------------------------------------------------------ */

function nextId(wf: Workflow, prefix: string): string {
  const n = wf.store.list(BMAD_RECORDS).filter((f) => f.startsWith(`${prefix}-`)).length + 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

function seal(wf: Workflow, prefix: string, data: any, event = 'bmad_record_written'): { id: string; file: string; sha256: string } {
  const id = data.packet_id && prefix === 'BPK' ? data.packet_id : data.receipt_id && prefix === 'BRC' ? data.receipt_id : nextId(wf, prefix);
  const file = wf.store.writeRecord(BMAD_RECORDS, `${id}.json`, prefix === 'BPK' || prefix === 'BRC' ? data : { record_id: id, ...data });
  const sha256 = sha256File(file)!;
  wf.store.append(event, { record: `${BMAD_RECORDS}/${id}.json`, kind: prefix, sha256 });
  return { id, file, sha256 };
}

/** Sealed hash of a bmad record from the audit chain (null if never sealed). */
function sealedHash(wf: Workflow, id: string): string | null {
  let h: string | null = null;
  for (const e of wf.store.readAudit()) if ((e.data as any)?.record === `${BMAD_RECORDS}/${id}.json`) h = (e.data as any).sha256;
  return h;
}

export function bmadReceipts(wf: Workflow): any[] {
  return wf.store.list(BMAD_RECORDS).filter((f) => f.startsWith('BRC-')).map((f) => wf.store.readRecord(BMAD_RECORDS, f));
}

/** Recorded BMad results as upstream evidence (sealed hash verified; result read back). */
export function upstreamReceipts(wf: Workflow): UpstreamReceipt[] {
  return bmadReceipts(wf).map((r) => {
    const sealed = sealedHash(wf, r.receipt_id) === sha256File(wf.store.p(BMAD_RECORDS, `${r.receipt_id}.json`));
    const res = readJson(path.resolve(wf.run.ctx.repoRoot, r.result_file));
    const intact = sealed && res.ok && res.sha256 === r.result_sha256;
    return { receipt_id: r.receipt_id, binding_id: r.binding_id, scope_sha256: r.scope_sha256, mode: r.mode, accepted: r.accepted && intact, agent: r.agent, sha256: sha256File(wf.store.p(BMAD_RECORDS, `${r.receipt_id}.json`))!, documents: r.documents, result: res.ok ? res.data : null };
  });
}

/* ------------------------------------------------------------------ */
/* discovery                                                           */
/* ------------------------------------------------------------------ */

export function discovery(ctx: RuntimeContext) {
  const release = verifyRelease(ctx);
  const lb = loadBindings(ctx);
  const bindings = validateBindings(ctx, release, lb);
  const impact = installationImpact(ctx);
  return { release, bindings, impact, loaded: lb, paths: bmadPaths(ctx) };
}

/* ------------------------------------------------------------------ */
/* eligibility                                                         */
/* ------------------------------------------------------------------ */

export interface EligibilityOutcome {
  record: any;
  facts: Facts;
  binding: BindingConfig['bindings'][number];
  loaded: LoadedBindings;
  release: ReturnType<typeof verifyRelease>;
}

export function evaluateEligibility(wf: Workflow, bindingKey: string, scope: string, mode: Mode): EligibilityOutcome {
  const ctx = wf.run.ctx;
  const release = verifyRelease(ctx);
  const loaded = loadBindings(ctx);
  if (!loaded.config) throw new OrchestratorError('BMad bindings are not loadable', 'BMAD_CONFIG', loaded.problems);
  const binding = findBinding(loaded.config, bindingKey);
  if (!binding) throw new OrchestratorError(`unknown BMad binding or workflow '${bindingKey}'`, 'USAGE', loaded.config.bindings.map((b) => `${b.binding_id} (${b.workflow_id})`));
  const bv = validateBindings(ctx, release, loaded).bindings.find((b) => b.binding_id === binding.binding_id) ?? null;
  const facts = gatherFacts(wf, scope, release, bv, upstreamReceipts(wf));
  const d = decide(binding, mode, facts);
  const record = {
    contract: 'bmad/eligibility',
    contract_version: '1.0',
    evaluated_at: now(),
    binding_id: binding.binding_id,
    workflow_id: binding.workflow_id,
    agent: binding.agent,
    mode,
    scope: facts.scope.text,
    scope_sha256: facts.scope.sha256,
    baseline: facts.baseline,
    workflow_state: facts.state,
    eligible: d.eligible,
    checks: d.checks,
    reasons: d.reasons,
    gates: facts.gates,
    g2: facts.g2,
    scope_readiness: facts.scope.readiness,
  };
  const v = ctx.contracts.validate('bmad/eligibility', record);
  if (!v.valid) throw new Error(`eligibility record violates bmad/eligibility: ${v.errors.join('; ')}`);
  return { record, facts, binding, loaded, release };
}

/** Eligibility, sealed (an evaluation is part of the audit trail). */
export function eligibilityCommand(wf: Workflow, bindingKey: string, scope: string, mode: Mode): any {
  return mutate(wf, `bmad eligibility ${bindingKey}`, () => {
    const e = evaluateEligibility(wf, bindingKey, scope, mode);
    const s = seal(wf, 'BEL', e.record);
    wf.store.writeState(wf.state);
    return { record_id: s.id, ...e.record };
  });
}

/* ------------------------------------------------------------------ */
/* dry run                                                             */
/* ------------------------------------------------------------------ */

/** Eligibility plus a mapping preview: what a packet would contain, and why it would be refused. Writes nothing unless `record`. */
export function dryRun(wf: Workflow, bindingKey: string, scope: string, opts: { record?: boolean } = {}): any {
  const e = evaluateEligibility(wf, bindingKey, scope, 'DRY_RUN');
  let preview: any = null;
  let mappingError: string | null = null;
  try {
    const m = buildMapping(wf, e.binding, scope, e.loaded.mapping, e.facts.upstream);
    const req = m.inputs.find((i) => i.name === 'approved-requirements')?.content?.requirements ?? [];
    preview = {
      mapping_version: m.mapping_version,
      scope: m.scope,
      scope_sha256: m.scope_sha256,
      readiness: m.readiness,
      inputs: m.inputs.map((i) => ({ name: i.name, sha256: i.sha256 })),
      requirements: req.map((r: any) => ({ id: r.id, outcome: r.outcome, usable: r.usable, source_refs: r.source_refs.length })),
      provenance_counts: { requirements: m.provenance.requirements.length, runtime_requirements: m.provenance.runtime_requirements.length, rules: m.provenance.rules.length, data_contracts: m.provenance.data_contracts.length, decisions: m.provenance.decisions.length, decisions_blocking_unresolved: m.reconciliation.summary.decisions_blocking_unresolved, approvals: m.provenance.approvals.length, upstream_receipts: m.provenance.upstream_receipts.length },
      rules_source_run: m.provenance.rules[0]?.source_run ?? null,
      reconciliation: m.reconciliation.summary,
      reconciliation_sha256: m.reconciliation.reconciliation_sha256,
      allowed_outputs: { output_dir: rel(wf.run.ctx, path.join(agentOutputDir(policyRoots(wf.run, wf.state), findAgent(e.binding.agent)!), 'bmad', '<packet>')), java_target_dir: e.binding.may_write_code ? e.facts.java_target_dir : null },
    };
  } catch (err) {
    mappingError = (err as Error).message;
  }
  const result = {
    mode: 'DRY_RUN',
    binding_id: e.binding.binding_id,
    workflow_id: e.binding.workflow_id,
    agent: e.binding.agent,
    eligibility: e.record,
    would_prepare: e.record.eligible,
    mock_would_be_refused: decide(e.binding, 'MOCK', e.facts).reasons,
    live_refused_because: liveGate(decide(e.binding, 'LIVE', e.facts).eligible, !!e.loaded.config?.live_execution.requested),
    mapping_preview: preview,
    mapping_error: mappingError,
    executed: false,
  };
  if (!opts.record) return result;
  return mutate(wf, `bmad dry-run ${bindingKey}`, () => {
    const s = seal(wf, 'BDR', result);
    wf.store.writeState(wf.state);
    return { record_id: s.id, ...result };
  });
}

/* ------------------------------------------------------------------ */
/* prepare                                                             */
/* ------------------------------------------------------------------ */

/**
 * Executor and execution-preflight facts for the LIVE gate (STEP 21). Loaded lazily because the preflight and the
 * executor import this module. The preflight is evaluated without recording; nothing is launched.
 */
export function liveFacts(wf: Workflow, bindingKey: string, scope: string): LiveFacts {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { preflight } = require('./preflight');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { executorDoctor } = require('./executor');
  const pf = preflight(wf, bindingKey, scope);
  return { installation_verified: !!executorDoctor(wf.run.ctx).ok_for_installation, authorization_id: pf.authorization_id ?? null, launch_permitted: pf.launch_permitted === true };
}

export function preparePacket(wf: Workflow, bindingKey: string, scope: string, mode: 'MOCK' | 'LIVE'): any {
  return mutate(wf, `bmad prepare ${bindingKey}`, () => {
    const ctx = wf.run.ctx;
    const e = evaluateEligibility(wf, bindingKey, scope, mode);
    const reasons = [...e.record.reasons];
    if (mode === 'LIVE') reasons.push(...liveGate(e.record.eligible, !!e.loaded.config?.live_execution.requested, liveFacts(wf, bindingKey, scope)).filter((r) => !r.startsWith('the workflow is not eligible')));
    const el = seal(wf, 'BEL', e.record);
    if (reasons.length) {
      wf.store.append('bmad_rejected', { binding: e.binding.binding_id, workflow: e.binding.workflow_id, mode, scope: e.record.scope, eligibility: el.id, reasons });
      wf.store.writeState(wf.state);
      throw new OrchestratorError(`BMad ${e.binding.workflow_id} refused for ${e.record.scope} (${mode}); recorded ${el.id}`, mode === 'LIVE' ? 'BMAD_LIVE_NOT_AUTHORIZED' : 'BMAD_NOT_ELIGIBLE', reasons);
    }
    const m = buildMapping(wf, e.binding, scope, e.loaded.mapping, e.facts.upstream);
    const packetId = nextId(wf, 'BPK');
    const inDir = path.join(BMAD_RECORDS, 'packets', packetId, 'inputs');
    const inputs = m.inputs.map((i) => {
      const file = wf.store.writeRecord(inDir, `${i.name}.json`, i.content);
      const sha = sha256File(file)!;
      if (sha !== i.sha256) throw new Error(`mapped input ${i.name} hash mismatch`);
      const prov = { ...m.provenance, input: rel(ctx, file), input_sha256: sha };
      const pv = ctx.contracts.validate('bmad/provenance', prov);
      if (!pv.valid) throw new Error(`provenance for ${i.name} violates bmad/provenance: ${pv.errors.join('; ')}`);
      const pfile = wf.store.writeRecord(inDir, `${i.name}.provenance.json`, prov);
      return { name: i.name, path: rel(ctx, file), sha256: sha, provenance: rel(ctx, pfile), provenance_sha256: sha256File(pfile)! };
    });
    const agent = findAgent(e.binding.agent)!;
    const outDir = path.join(agentOutputDir(policyRoots(wf.run, wf.state), agent), 'bmad', packetId);
    fs.mkdirSync(outDir, { recursive: true });
    const w = e.release.registry.find((x) => x.workflow_id === e.binding.workflow_id)!;
    const packet = {
      contract: 'bmad/execution-packet',
      contract_version: '1.0',
      packet_id: packetId,
      prepared_at: now(),
      mode,
      binding_id: e.binding.binding_id,
      binding_version: e.loaded.config!.binding_version,
      workflow_id: e.binding.workflow_id,
      workflow: { path: w.path, directory_sha256: w.directory_sha256, skill_md_sha256: w.skill_md_sha256 },
      release: { package: e.release.package!, version: e.release.version!, tarball_sha256: e.release.tarball_sha256!, directory_sha256: e.release.directory_sha256! },
      agent: e.binding.agent,
      scope: m.scope,
      scope_sha256: m.scope_sha256,
      baseline: { run_id: wf.run.runId, manifest_sha256: wf.run.manifestSha256 },
      mapping_version: m.mapping_version,
      config_hashes: { bindings: e.loaded.sha256!, registry: e.release.registry_sha256!, mapping: e.loaded.mapping_sha256!, pin: e.release.pin_sha256! },
      eligibility_record: `${BMAD_RECORDS}/${el.id}.json`,
      inputs,
      allowed_outputs: { output_dir: rel(ctx, outDir), java_target_dir: e.binding.may_write_code && e.facts.java_target_dir ? rel(ctx, e.facts.java_target_dir) : null, may_write_code: e.binding.may_write_code },
      forbidden: FORBIDDEN,
      output_contract: e.binding.output_contract,
    };
    const v = ctx.contracts.validate('bmad/execution-packet', packet);
    if (!v.valid) throw new Error(`packet violates bmad/execution-packet: ${v.errors.join('; ')}`);
    const s = seal(wf, 'BPK', packet, 'bmad_packet_prepared');
    wf.store.writeState(wf.state);
    return { ...packet, packet_file: rel(ctx, s.file), packet_sha256: s.sha256 };
  });
}

function loadPacket(wf: Workflow, packetId: string): { packet: any; sha256: string; problems: string[] } {
  if (!/^BPK-\d{4}$/.test(packetId)) throw new OrchestratorError(`invalid packet id ${packetId}`, 'USAGE');
  const f = wf.store.p(BMAD_RECORDS, `${packetId}.json`);
  if (!fs.existsSync(f)) throw new OrchestratorError(`no BMad packet ${packetId}`, 'USAGE');
  const sha = sha256File(f)!;
  const problems: string[] = [];
  if (sealedHash(wf, packetId) !== sha) problems.push(`${packetId} differs from its sealed hash (modified after preparation)`);
  return { packet: JSON.parse(fs.readFileSync(f, 'utf8')), sha256: sha, problems };
}

/* ------------------------------------------------------------------ */
/* mock producer                                                       */
/* ------------------------------------------------------------------ */

/** Deterministic stand-in for a BMad run, built only from the packet's inputs. Never evidence. */
export function mockResult(wf: Workflow, packetId: string): { result_file: string; result: any } {
  const ctx = wf.run.ctx;
  const { packet: P, problems } = loadPacket(wf, packetId);
  if (problems.length) throw new OrchestratorError('packet integrity failed', 'BMAD_PACKET_INVALID', problems);
  if (P.mode !== 'MOCK') throw new OrchestratorError(`${packetId} is a ${P.mode} packet; the mock producer only serves MOCK packets`, 'BMAD_MODE');
  const inp = (n: string) => {
    const i = P.inputs.find((x: any) => x.name === n);
    return i ? JSON.parse(fs.readFileSync(path.resolve(ctx.repoRoot, i.path), 'utf8')) : null;
  };
  const reqs = (inp('approved-requirements')?.requirements ?? []).filter((r: any) => r.usable && r.kind === 'requirement');
  const outDir = path.resolve(ctx.repoRoot, P.allowed_outputs.output_dir);
  const lines = [`# MOCK ${P.workflow_id} result — not evidence`, '', `Packet ${P.packet_id}, scope ${P.scope}, digest ${P.scope_sha256}.`, '', ...reqs.map((r: any) => `- ${r.id}: ${r.content?.statement ?? r.content?.title ?? ''}`), ''];
  const docName = `${P.workflow_id}.mock.md`;
  fs.writeFileSync(path.join(outDir, docName), lines.join('\n'), 'utf8');
  const doc = { path: rel(ctx, path.join(outDir, docName)), sha256: sha256File(path.join(outDir, docName))!, kind: 'markdown' };
  const base = { contract: P.output_contract, contract_version: '1.0', packet_id: P.packet_id, binding_id: P.binding_id, workflow_id: P.workflow_id, agent: P.agent, mode: 'MOCK', scope: P.scope, scope_sha256: P.scope_sha256, baseline_manifest_sha256: P.baseline.manifest_sha256, produced_by: { kind: 'mock', id: 'revforge-bmad-mock' }, produced_at: now(), status: 'draft', documents: [doc] };
  let result: any;
  const ids = reqs.map((r: any) => r.id);
  switch (P.output_contract) {
    case 'bmad/output-prd': {
      const rules = inp('business-rules')?.rules ?? [];
      result = { ...base, functional_requirements: reqs.map((r: any, i: number) => ({ fr_id: `FR-${String(i + 1).padStart(3, '0')}`, revforge_requirement_id: r.id, statement: String(r.content?.statement ?? r.id), source_refs: r.source_refs, rule_ids: rules.filter((x: any) => x.requirement_ids.includes(r.id)).map((x: any) => x.id) })), non_functional_requirements: [], assumptions: (inp('decisions')?.decisions ?? []).filter((d: any) => d.status === 'resolved').map((d: any) => ({ text: String(d.resolution_text ?? d.id), decision_id: d.id })), open_questions: [] };
      break;
    }
    case 'bmad/output-architecture':
      result = { ...base, decisions: [{ adr_id: 'ADR-001', title: 'Mock decision', decision: 'Mock decision derived from the packet', rationale: 'MOCK', requirement_ids: ids }], components: [{ component_id: 'C-001', name: 'Mock component', responsibility: 'MOCK', requirement_ids: ids, cobol_units: [...new Set<string>(reqs.flatMap((r: any) => r.units))] }] };
      break;
    case 'bmad/output-epics':
      result = { ...base, epics: [{ epic_id: 'E-001', title: 'Mock epic', requirement_ids: ids, stories: ids.map((id: string, i: number) => ({ story_id: `S-${String(i + 1).padStart(3, '0')}`, title: `Mock story for ${id}`, requirement_ids: [id], architecture_refs: [], acceptance_criteria: [{ ac_id: 'AC-1', text: 'MOCK' }], status: 'draft' })) }] };
      break;
    default:
      throw new OrchestratorError(`no mock producer for ${P.output_contract}: sprint, build and review need upstream results that a mock cannot supply`, 'BMAD_MODE');
  }
  const rf = path.join(outDir, 'result.json');
  fs.writeFileSync(rf, jsonText(result), 'utf8');
  return { result_file: rel(ctx, rf), result };
}

/* ------------------------------------------------------------------ */
/* record                                                              */
/* ------------------------------------------------------------------ */

/** Validates a returned result against its packet, current state and contract; records a receipt either way. */
export function recordResult(wf: Workflow, packetId: string, resultFile: string): any {
  return mutate(wf, `bmad record ${packetId}`, () => {
    const ctx = wf.run.ctx;
    const { packet: P, sha256: packetSha, problems } = loadPacket(wf, packetId);
    const checks: Array<{ id: string; ok: boolean; detail: string }> = [];
    const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
    add('packet_sealed', !problems.length, problems.length ? problems.join('; ') : `${packetId} matches its sealed hash`);
    const already = bmadReceipts(wf).find((r) => r.packet_id === packetId && r.accepted);
    add('not_replayed', !already, already ? `${packetId} already has accepted receipt ${already.receipt_id}` : 'first accepted result for this packet');
    // Inputs and provenance unchanged.
    const inputs: Record<string, any> = {};
    const inProblems: string[] = [];
    for (const i of P.inputs) {
      if (sha256File(path.resolve(ctx.repoRoot, i.path)) !== i.sha256) inProblems.push(`${i.name} changed`);
      if (sha256File(path.resolve(ctx.repoRoot, i.provenance)) !== i.provenance_sha256) inProblems.push(`${i.name} provenance changed`);
      const j = readJson(path.resolve(ctx.repoRoot, i.path));
      if (j.ok) inputs[i.name] = j.data;
    }
    add('inputs_unchanged', !inProblems.length, inProblems.length ? inProblems.join(', ') : `${P.inputs.length} mapped input(s) and provenance sidecars unchanged`);
    // Release, bindings and eligibility re-checked now: a result for a workflow that is no longer authorised is refused.
    const e = evaluateEligibility(wf, P.binding_id, P.scope, P.mode);
    add('release_unchanged', e.release.ok && e.release.tarball_sha256 === P.release.tarball_sha256 && e.release.directory_sha256 === P.release.directory_sha256, e.release.ok ? 'pinned release verified and identical to the packet' : 'release verification failed');
    const cfgSame = e.loaded.sha256 === P.config_hashes.bindings && e.loaded.mapping_sha256 === P.config_hashes.mapping && e.release.registry_sha256 === P.config_hashes.registry && e.release.pin_sha256 === P.config_hashes.pin;
    add('config_unchanged', cfgSame, cfgSame ? 'bindings, mapping, registry and pin unchanged since preparation' : 'binding, mapping, registry or pin changed since preparation');
    add('still_eligible', e.record.eligible, e.record.eligible ? 'eligibility re-evaluated now: eligible' : `no longer eligible: ${e.record.reasons.join(' | ')}`);
    if (P.mode === 'LIVE') {
      // Re-evaluated at recording time: a LIVE result counts only while the launch it came from is still permitted.
      const lr = liveGate(e.record.eligible, !!e.loaded.config?.live_execution.requested, liveFacts(wf, P.binding_id, P.scope));
      add('live_authorized', !lr.length, lr.length ? lr.join(' | ') : 'LIVE launch still permitted by the execution preflight');
    }
    // Result.
    const abs = path.resolve(ctx.repoRoot, resultFile);
    const rj = readJson(abs);
    let docs: Array<{ path: string; sha256: string }> = [];
    if (!rj.ok) add('result_readable', false, `cannot read result: ${rj.error}`);
    else {
      const roots = policyRoots(wf.run, wf.state);
      const ups = upstreamReceipts(wf);
      const upstreamDocuments = new Map<string, string>();
      for (const f of inputs.implementation?.files ?? []) upstreamDocuments.set(f.path, f.sha256);
      const v = validateResult(
        {
          ctx,
          packet: P,
          inputs,
          roots,
          current: { scope_sha256: e.facts.scope.sha256, manifest_sha256: wf.run.manifestSha256 },
          upstreamDocuments,
          independentTestReceipts: acceptedReceipts(wf).filter((r) => r.receipt?.agent === 'F6').map((r) => r.receipt_id),
          implementationReceipts: new Map(ups.filter((u) => u.binding_id === 'BMAD-BUILD' && u.accepted && u.mode === 'LIVE').map((u) => [u.receipt_id, u.agent])),
        },
        rj.data,
      );
      checks.push(...v.checks);
      docs = v.documents;
    }
    const accepted = checks.every((c) => c.ok);
    const receiptId = nextId(wf, 'BRC');
    const receipt = {
      contract: 'bmad/receipt',
      contract_version: '1.0',
      receipt_id: receiptId,
      recorded_at: now(),
      packet_id: P.packet_id,
      packet_sha256: packetSha,
      binding_id: P.binding_id,
      workflow_id: P.workflow_id,
      agent: P.agent,
      mode: P.mode,
      scope: P.scope,
      scope_sha256: P.scope_sha256,
      baseline: P.baseline,
      result_file: rel(ctx, abs),
      result_sha256: rj.ok ? rj.sha256 : '0'.repeat(64),
      documents: docs,
      accepted,
      violations: checks.filter((c) => !c.ok).map((c) => `${c.id}: ${c.detail}`),
      checks,
      evidence_status: !accepted ? 'REJECTED' : P.mode === 'MOCK' ? 'MOCK_NOT_EVIDENCE' : 'DRAFT_PENDING_HUMAN_APPROVAL',
      counts_toward_gates: false,
      provenance: P.inputs.map((i: any) => ({ input: i.name, provenance: i.provenance, sha256: i.provenance_sha256 })),
    };
    const rv = ctx.contracts.validate('bmad/receipt', receipt);
    if (!rv.valid) throw new Error(`receipt violates bmad/receipt: ${rv.errors.join('; ')}`);
    seal(wf, 'BRC', receipt, accepted ? 'bmad_receipt_recorded' : 'bmad_result_rejected');
    wf.store.writeState(wf.state);
    return receipt;
  });
}

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

export function bmadSummary(wf: Workflow): any {
  const files = wf.store.list(BMAD_RECORDS);
  const read = (prefix: string) => files.filter((f) => f.startsWith(`${prefix}-`)).map((f) => wf.store.readRecord(BMAD_RECORDS, f));
  const integrity = files.map((f) => ({ record: f, ok: sealedHash(wf, f.replace(/\.json$/, '')) === sha256File(wf.store.p(BMAD_RECORDS, f)) }));
  const rejected = wf.store.readAudit().filter((e) => e.event === 'bmad_rejected').map((e) => ({ seq: e.seq, at: e.at, ...(e.data as any) }));
  return {
    eligibility: read('BEL').map((r) => ({ record_id: r.record_id, binding_id: r.binding_id, mode: r.mode, scope: r.scope, eligible: r.eligible, reasons: r.reasons })),
    dry_runs: read('BDR').map((r) => ({ record_id: r.record_id, binding_id: r.binding_id, scope: r.eligibility.scope, would_prepare: r.would_prepare })),
    packets: read('BPK').map((p) => ({ packet_id: p.packet_id, binding_id: p.binding_id, mode: p.mode, scope: p.scope })),
    receipts: read('BRC').map((r) => ({ receipt_id: r.receipt_id, packet_id: r.packet_id, mode: r.mode, accepted: r.accepted, evidence_status: r.evidence_status, violations: r.violations })),
    rejections: rejected,
    records_intact: integrity.every((x) => x.ok),
    integrity,
  };
}
