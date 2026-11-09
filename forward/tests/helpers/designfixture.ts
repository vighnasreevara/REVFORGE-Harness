/**
 * Synthetic G1 -> G2 -> G4 workflow fixture (STEP 7). Builds on the G1
 * fixture: adds synthetic signers for the design roles (public keys only in
 * the trust store; private keys stay in memory), approves the BRAVO02 scope
 * at G1, and produces real F3 / F4 deliverables through the orchestrator's
 * dispatcher and receipt validator. Nothing here touches the real run.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../../runtime/src/core/config';
import { advance, prepare, recordReceipt, runGate, acceptedReceipts } from '../../runtime/src/orchestrator/orchestrator';
import { findAgent } from '../../runtime/src/orchestrator/agents';
import { canonicalize } from '../../runtime/src/approval/canonical';
import { approvalStatement, createApprovalRequest, importApproval, statementText } from '../../runtime/src/approval/approvals';
import { evaluateScope, parseSelector } from '../../runtime/src/approval/scope';
import { buildSnapshot } from '../../runtime/src/approval/snapshot';
import { applicableConcerns, approvedScope } from '../../runtime/src/design/design';
import { createDesignRequest, designStatement, importDesignApproval, StorySetValidation, validateStorySet } from '../../runtime/src/design/approvals';
import { Fixture } from './fixture';
import { citedClaim, deliverAll, Edit, KP, setupG1, SIGNERS, signResolution, signText, wfOf } from './g2fixture';
import { readPacket, writeDeliverables } from './outputs';

export const BRAVO = 'programs:BRAVO02';
export const DESIGN_SIGNERS = { architect: 'erin.architect', techauth: 'frank.techauth', planner: 'grace.storyapprover', exceptions: 'carol.exceptions', dataowner: 'olivia.dataowner' } as const;
export type DesignKeys = Record<keyof typeof DESIGN_SIGNERS, KP>;
const pem = (kp: KP) => kp.publicKey.export({ type: 'spki', format: 'pem' }).toString();

export function trustStorePath(f: Fixture): string {
  return path.join(f.repoRoot, 'trust', 'trust-store.json');
}
export function editTrust(f: Fixture, fn: (j: any) => void): void {
  const j = JSON.parse(fs.readFileSync(trustStorePath(f), 'utf8'));
  fn(j);
  fs.writeFileSync(trustStorePath(f), JSON.stringify(j, null, 2));
}

/** A G1-approved BRAVO02 scope in state REQUIREMENTS_APPROVED, with design-role signers in the trust store. */
export function designFixture(fixtures: Fixture[], opts: { approveG1?: boolean; citeLine?: number; resolve?: boolean; mutate?: (f: Fixture) => void; edit?: Edit } = {}) {
  const { f, ctx, k } = setupG1(fixtures, { mutate: opts.mutate });
  const mk = (): KP => generateKeyPairSync('ed25519');
  const dk: DesignKeys = { architect: mk(), techauth: mk(), planner: mk(), exceptions: mk(), dataowner: mk() };
  editTrust(f, (j) => {
    j.signers.push({ signer_id: DESIGN_SIGNERS.architect, public_key_pem: pem(dk.architect), roles: ['architecture_approver'] });
    j.signers.push({ signer_id: DESIGN_SIGNERS.techauth, public_key_pem: pem(dk.techauth), roles: ['technical_authority'] });
    j.signers.push({ signer_id: DESIGN_SIGNERS.planner, public_key_pem: pem(dk.planner), roles: ['story_approver'] });
    j.signers.push({ signer_id: DESIGN_SIGNERS.exceptions, public_key_pem: pem(dk.exceptions), roles: ['exception_approver'] });
    j.signers.push({ signer_id: DESIGN_SIGNERS.dataowner, public_key_pem: pem(dk.dataowner), roles: ['data_owner'] });
  });
  deliverAll(f, ctx, opts.edit ?? citedClaim(f, opts.citeLine ?? 8));
  for (let i = 0; i < (opts.resolve === false ? 0 : 6); i++) {
    const snap = buildSnapshot(wfOf(ctx));
    const e = evaluateScope(snap, parseSelector(BRAVO));
    const todo = [...new Set(e.findings.filter((x) => x.blocking).flatMap((x) => x.decisions))].filter((id) => snap.register.has(id) && snap.resolutions.get(id)!.status !== 'resolved');
    if (!todo.length) break;
    for (const id of todo) {
      const d = snap.register.get(id)!;
      if (d.allowed_outcomes.includes('approved_exception') && /REQUIRES_EVIDENCE/.test(d.question)) signResolution(ctx, f, id, 'approved_exception', dk.exceptions, DESIGN_SIGNERS.exceptions, 'exception_approver');
      else if (d.allowed_outcomes.includes('resolved_no_change')) signResolution(ctx, f, id, 'resolved_no_change', k.sme, SIGNERS.sme, ['technical', 'data_layout', 'runtime_semantics'].includes(d.kind) ? 'technical_authority' : 'business_sme');
      else signResolution(ctx, f, id, 'excluded_from_scope', k.sme, SIGNERS.sme, 'business_sme');
    }
  }
  if (opts.approveG1 !== false && opts.resolve !== false) {
    const req = createApprovalRequest(wfOf(ctx), BRAVO, 'dave.requester');
    const st = approvalStatement(req, SIGNERS.approver, 'requirements_approver', 'approved');
    const file = path.join(f.repoRoot, 'g2-approval.json');
    fs.writeFileSync(file, JSON.stringify({ contract: 'signed-approval', statement: st, signature: { algorithm: 'ed25519', value: signText(statementText(st), k.approver) } }));
    assert.equal(importApproval(wfOf(ctx), file).imported, true);
    assert.equal(runGate(wfOf(ctx), 'G1').status, 'PASS');
    assert.equal(advance(wfOf(ctx), 'REQUIREMENTS_APPROVED').accepted, true);
  }
  return { f, ctx, k, dk };
}

function header(packet: any, contract: string, agent: 'F3' | 'F4') {
  const a = findAgent(agent)!;
  const first = packet.inputs.flatMap((i: any) => i.files).find((x: any) => x.present);
  return { contract, contract_version: '1.0', authoring_agent: { id: agent, name: a.name }, packet_id: packet.packet_id, baseline: { run_id: packet.baseline.run_id, manifest_sha256: packet.baseline.manifest_sha256 }, generated_at: new Date().toISOString(), skills_used: a.skills, inputs_used: [{ path: first.path, sha256: first.sha256 }], units_covered: packet.units, unresolved_findings: [] as any[] };
}
const ref = (r: any) => ({ file_id: r.file_id ?? null, path_id: r.path_id ?? null, section_id: r.section_id ?? null, paragraph_id: r.paragraph_id ?? null, statement_id: r.statement_id ?? null });

/** Architecture documents an F3 agent would write for the approved scope (`tweak` edits them before delivery). */
export function architectureDocs(ctx: RuntimeContext, packet: any, tweak?: (docs: Record<string, any>) => void): Record<string, any> {
  const snap = buildSnapshot(wfOf(ctx));
  const s = approvedScope(wfOf(ctx), snap);
  assert.ok(s.ok, s.reason);
  const concerns = applicableConcerns(snap, s);
  const f2 = acceptedReceipts(wfOf(ctx)).filter((r) => r.receipt.agent === 'F2').map((r) => r.receipt_id);
  const firstRef = s.requirements.flatMap((r) => r.source_refs).find((r: any) => r?.file_id);
  const primary = s.rec!.units.filter((u) => u.relation === 'primary' && u.unit_kind === 'program');
  const common = { technical_baseline: { java_version: '21', build_tool: 'maven', frameworks: [] }, approved_inputs: { requirements_approval: s.approval_id, data_contract_receipts: f2 } };
  const docs: Record<string, any> = {
    'java_architecture.md': '# Synthetic architecture\n',
    'component_design.json': {
      ...header(packet, 'forward/architecture-record', 'F3'),
      record_type: 'component_design',
      ...common,
      components: primary.map((u) => ({ component_id: `CMP-${u.name}`, name: `${u.name} batch step`, kind: 'batch_job', responsibility: `Re-implements ${u.name}`, replaces_units: [{ unit_kind: 'program', name: u.name, file_id: u.file_id }], requirement_ids: s.requirements.map((r) => r.id), interfaces: [], depends_on: [] })),
      adrs: [],
    },
    'architecture_decisions.json': {
      ...header(packet, 'forward/architecture-record', 'F3'),
      record_type: 'architecture_decisions',
      ...common,
      components: [],
      adrs: [{ adr_id: 'ADR-001', title: 'Plain Java 21 batch step with exact decimal arithmetic', status: 'proposed', existing_cobol_behavior: 'COBOL fixed-point arithmetic and return codes', proposed_java_behavior: 'BigDecimal with the same scale; explicit return-code mapping', behavior_change: false, source_refs: [ref(firstRef)], compatibility_risks: ['rounding of intermediate results'], alternatives: ['Spring Batch (rejected: no framework is needed for one step)'], required_approvals: ['architecture_owner'], testing_implications: ['independent golden-file comparison of numeric results'] }],
      compatibility_concerns: concerns.map((c, i) => ({ concern: c.concern, treatment: 'addressed_by_adr', adr_ids: ['ADR-001'], decision_id: null, requirement_ids: [], runtime_requirement_ids: i === 0 ? s.runtime_ids : [], justification: `Synthetic treatment of ${c.concern} by ADR-001` })),
      assumptions: [],
    },
  };
  tweak?.(docs);
  return docs;
}

/** Dispatches F3 for the scope, delivers the architecture and advances to ARCHITECTURE_DRAFTED. */
export function deliverArchitecture(f: Fixture, ctx: RuntimeContext, tweak?: (docs: Record<string, any>) => void): string {
  const p = prepare(wfOf(ctx), 'F3', { programs: ['BRAVO02'] });
  const packet = readPacket(f.repoRoot, f.runsDir, wfOf(ctx).run.runId, p.packet_id);
  const rec = recordReceipt(wfOf(ctx), writeDeliverables(f.repoRoot, packet, architectureDocs(ctx, packet, tweak)));
  assert.equal(rec.verdict.accepted, true, rec.verdict.violations.join(' | '));
  if (wfOf(ctx).state.state === 'REQUIREMENTS_APPROVED') assert.equal(advance(wfOf(ctx), 'ARCHITECTURE_DRAFTED').accepted, true);
  return rec.receipt_id;
}

/** Signs a design approval statement for the latest request of `gate` and imports it. */
export function signDesign(f: Fixture, ctx: RuntimeContext, request: any, signer: string, kp: KP, role: string, decision: 'approved' | 'rejected' = 'approved', tamper?: (s: any) => void): any {
  const st = designStatement(request, signer, role, decision, new Date(Date.now() - 1000).toISOString());
  const signed = { contract: 'signed-design-approval', statement: st, signature: { algorithm: 'ed25519', value: signText(canonicalize(st), kp) } };
  tamper?.(signed);
  const file = path.join(f.repoRoot, `design-${request.request_id}-${signer}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(signed));
  return importDesignApproval(wfOf(ctx), file);
}

/** F3 delivered, G2 requested, signed by the architect, G2 PASS and ARCHITECTURE_APPROVED. */
export function approveArchitecture(f: Fixture, ctx: RuntimeContext, dk: DesignKeys): { request: any; approval: any } {
  deliverArchitecture(f, ctx);
  const request = createDesignRequest(wfOf(ctx), 'G2', 'dave.requester');
  const approval = signDesign(f, ctx, request, DESIGN_SIGNERS.architect, dk.architect, 'architecture_approver');
  assert.equal(approval.imported, true, JSON.stringify(approval.checks.filter((c: any) => !c.ok)));
  assert.equal(runGate(wfOf(ctx), 'G2').status, 'PASS');
  assert.equal(advance(wfOf(ctx), 'ARCHITECTURE_APPROVED').accepted, true);
  return { request, approval };
}

/** Story documents an F4 agent would write against the current approvals. */
export function storyDocs(ctx: RuntimeContext, packet: any, g3ApprovalId: string, tweak?: (docs: Record<string, any>) => void): Record<string, any> {
  const s = approvedScope(wfOf(ctx), buildSnapshot(wfOf(ctx)));
  const comp = `CMP-${s.rec!.units.find((u) => u.relation === 'primary')!.name}`;
  const stories = s.requirements.map((r, i) => {
    const refs = r.source_refs.filter((x: any) => x?.file_id).map(ref);
    return { story_id: `STORY-${String(i + 1).padStart(3, '0')}`, title: `Implement ${r.id}`, requirement_ids: [r.id], component_ids: [comp], source_refs: refs, implementation_scope: `${comp} logic for ${r.id}`, dependencies: i ? [`STORY-${String(i).padStart(3, '0')}`] : [], data_contracts: [], acceptance_criteria: [{ criterion: `Given the recovered input, the step reproduces the behaviour of ${r.id} exactly`, verifies_source: refs[0] }], testing_expectations: ['F6 independent fixture comparing Java and COBOL reference output'], blocking_decisions: [], readiness: { status: 'ready', unmet: [] } };
  });
  const base = { approval_baseline: { requirements_gate_result: s.approval_id, architecture_gate_result: g3ApprovalId } };
  const docs: Record<string, any> = {
    'epics.json': { ...header(packet, 'forward/development-stories', 'F4'), ...base, epics: [{ epic_id: 'EPIC-001', title: 'Synthetic scope', component_ids: [comp], story_ids: stories.map((x) => x.story_id) }], stories: [] },
    'stories.json': { ...header(packet, 'forward/development-stories', 'F4'), ...base, epics: [], stories },
    'sprint_readiness.md': '# Synthetic sprint readiness\n',
  };
  tweak?.(docs);
  return docs;
}

export function deliverStories(f: Fixture, ctx: RuntimeContext, g3ApprovalId: string, tweak?: (docs: Record<string, any>) => void): string {
  const p = prepare(wfOf(ctx), 'F4', { programs: ['BRAVO02'] });
  const packet = readPacket(f.repoRoot, f.runsDir, wfOf(ctx).run.runId, p.packet_id);
  const rec = recordReceipt(wfOf(ctx), writeDeliverables(f.repoRoot, packet, storyDocs(ctx, packet, g3ApprovalId, tweak)));
  assert.equal(rec.verdict.accepted, true, rec.verdict.violations.join(' | '));
  if (wfOf(ctx).state.state === 'ARCHITECTURE_APPROVED') assert.equal(advance(wfOf(ctx), 'STORIES_DRAFTED').accepted, true);
  return rec.receipt_id;
}

/** G2 approval plus an F4 story set that passes the automated validation: STORIES_DRAFTED, ready for F5. */
export function readyForImplementation(f: Fixture, ctx: RuntimeContext, dk: DesignKeys): { g3: any; validation: StorySetValidation } {
  const g3 = approveArchitecture(f, ctx, dk);
  deliverStories(f, ctx, g3.approval.approval_id);
  const validation = validateStorySet(wfOf(ctx));
  assert.equal(validation.ok, true, validation.reason);
  assert.equal(wfOf(ctx).state.state, 'STORIES_DRAFTED');
  return { g3, validation };
}
