/**
 * G2 snapshot: everything the requirements gate needs, computed once from the
 * runtime's own records and the current reverse baseline. Every claim is
 * re-verified against the original COBOL source here (never taken from an
 * agent's declaration or from an older verification record), and every item
 * carries the SHA-256 of its exact current content so approvals can bind to it.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ArtifactSet, loadArtifacts } from '../core/artifacts';
import { sha256File } from '../core/fsutil';
import { DiscoveredSystem, discoverSystem } from '../core/model';
import { findAgent } from '../orchestrator/agents';
import { Classification } from '../orchestrator/classification';
import { Unit, unitKey } from '../orchestrator/extracts';
import { evaluateBaselineCheck, GateResult, gateSpec, PrecheckResult } from '../orchestrator/gates';
import { computeLedger } from '../orchestrator/ledger';
import { RecordedReceipt, Workflow } from '../orchestrator/orchestrator';
import { buildCtx, Ctx, deliveries, verifyField, verifyTextClaim } from '../remediation/remediation';
import { digest } from './canonical';
import { buildRegister, RegDecision, resolutionStates, ResolutionState } from './decisions';
import { analyzePackets, latestPacketStatus, PacketReview } from './packets';
import { ApprovalPolicy, loadPolicy, Outcome, policyDigest } from './policy';
import { loadTrustStore, TrustStore } from './trust';

export type ItemKind = 'requirement' | 'runtime_requirement' | 'file_operations' | 'data_record';
export type ComponentSource = 'evidence' | 'sme_flag' | 'reference' | 'traceability';

export interface Component {
  outcome: Outcome;
  reason: string;
  source: ComponentSource;
}

export interface Item {
  kind: ItemKind;
  id: string;
  units: Unit[];
  sha256: string;
  packet: string;
  receipt: string;
  document: string;
  evidence_status: string;
  claim: { result: string; reasons: string[] } | null;
  components: Component[];
  source_refs: any[];
  open_decisions: string[];
  data: any;
  /** STEP 12: decisions linked because the reached behaviour uses a name the program declares nowhere. */
  semantic_dependencies?: import('./semantic').SemanticDependency[];
}

export interface RuleEntry {
  packet: string;
  receipt: string;
  disposition: string;
  requirement_ids: string[];
  decision_requests: string[];
  reason: string;
  sha256: string;
}

export interface Snapshot {
  wf: Workflow;
  at: Date;
  policy: ApprovalPolicy;
  policy_sha256: string;
  trust: TrustStore;
  set: ArtifactSet;
  sys: DiscoveredSystem;
  ctx: Ctx;
  g0: PrecheckResult;
  classification: Classification[];
  receipts: RecordedReceipt[];
  items: Item[];
  itemById: Map<string, Item>;
  rules: Map<string, any>;
  rulesByProgram: Record<string, string[]>;
  ruleEntries: Map<string, RuleEntry[]>;
  contradictions: Array<{ id: string; packet: string; data: any; file_ids: string[]; rule_ids: string[]; decision: string | null; sha256: string }>;
  agentDecisions: Array<{ d: any; packet: string; receipt: string; file: string; sha: string | null }>;
  gaps: any[];
  addressedGaps: Map<string, string[]>;
  consolidation: { required: boolean; record: string | null; current: boolean; problems: string[]; conflicts: any[]; decisions: any[] };
  register: Map<string, RegDecision>;
  resolutions: Map<string, ResolutionState>;
  packets: PacketReview[];
  packetStatus: { id: string; superseded: Set<string> } | null;
  coverage: { F1: Map<string, string>; F2: Map<string, string> };
  access: Map<string, string | null>;
  integrity: { modified_outputs: string[]; receipt_hash_changes: string[]; receipt_hashes: Array<{ receipt_id: string; sha256: string | null }> };
  sourceHashes: Map<string, string | null>;
  verification_digest: string;
  problems: string[];
  /** STEP 9: evidence supplements (ESU) by ID with their currency; effective only when a signed review resolution selects one. */
  contextSupplements: Map<string, { record: any; current: boolean; problems: string[] }>;
  /** STEP 10: evidence adjudications (EAR) with their currency. */
  evidenceAdjudications: Map<string, { record: any; current: boolean; problems: string[] }>;
}

const RANK: Record<Outcome, number> = { CONTRADICTED: 5, REQUIRES_EVIDENCE: 4, REQUIRES_SME_DECISION: 3, APPROVED_EXCEPTION: 2, VERIFIED: 1, EXCLUDED_WITH_JUSTIFICATION: 0 };
export const BLOCKING: Outcome[] = ['CONTRADICTED', 'REQUIRES_EVIDENCE', 'REQUIRES_SME_DECISION'];
export const worst = (os: Outcome[]): Outcome => os.reduce((w, o) => (RANK[o] > RANK[w] ? o : w), 'VERIFIED' as Outcome);
export const sanitize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9-]/g, '-');
const pad = (n: number) => String(n).padStart(3, '0');
const rel = (wf: Workflow, p: string) => path.relative(wf.run.ctx.repoRoot, p).split(path.sep).join('/');

/** Outcome of a claim from its declared evidence status and the runtime's own source check. */
export function evidenceComponents(policy: ApprovalPolicy, status: string, claim: { result: string; reasons: string[] } | null): Component[] {
  switch (status) {
    case 'verified_from_source':
      if (!claim) return [{ outcome: 'REQUIRES_EVIDENCE', reason: 'declared verified_from_source but nothing checkable was cited', source: 'evidence' }];
      if (claim.result === 'verified') return [{ outcome: 'VERIFIED', reason: 'independently re-verified against the original COBOL source by the runtime (source text present; business interpretation still needs human approval)', source: 'evidence' }];
      if (claim.result === 'contradicted') return [{ outcome: 'CONTRADICTED', reason: `the source contradicts the cited evidence: ${claim.reasons.join('; ')}`, source: 'evidence' }];
      return [{ outcome: 'REQUIRES_EVIDENCE', reason: `declared verified_from_source but not confirmed by the runtime: ${claim.reasons.join('; ') || 'unverifiable'}`, source: 'evidence' }];
    case 'reverse_artifact_supported':
      return [{ outcome: policy.g2.reverse_artifact_supported, reason: 'supported by reverse artifacts only; not independently verified against the source', source: 'evidence' }];
    case 'inferred':
      return [{ outcome: 'REQUIRES_SME_DECISION', reason: 'derived by interpretation; an SME must confirm it', source: 'evidence' }];
    default:
      return [{ outcome: 'REQUIRES_EVIDENCE', reason: `evidence status is '${status}'`, source: 'evidence' }];
  }
}

function refComponents(c: Ctx, refs: any[], knownFiles: Set<string>, rawFiles: Set<string>): Component[] {
  const out: Component[] = [];
  for (const r of refs ?? []) {
    if (!r.file_id) out.push({ outcome: 'REQUIRES_EVIDENCE', reason: 'a source reference has no File ID', source: 'reference' });
    else if (!knownFiles.has(r.file_id)) out.push({ outcome: 'REQUIRES_EVIDENCE', reason: `source reference ${r.file_id} is not in the reverse inventory`, source: 'reference' });
    else if (r.statement_id && rawFiles.has(r.file_id) && !c.statements.has(r.statement_id)) out.push({ outcome: 'REQUIRES_EVIDENCE', reason: `statement ${r.statement_id} is not in the parser structure`, source: 'reference' });
    else if (!r.statement_id && r.paragraph_id && rawFiles.has(r.file_id) && !c.paragraphs.has(r.paragraph_id)) out.push({ outcome: 'REQUIRES_EVIDENCE', reason: `paragraph ${r.paragraph_id} is not in the parser structure`, source: 'reference' });
  }
  return out;
}

function latest(wf: Workflow, sub: string, prefix: string): { id: string; record: any } | null {
  const files = wf.store.list(sub).filter((f) => f.startsWith(prefix));
  if (!files.length) return null;
  const f = files[files.length - 1];
  return { id: f.replace(/\.json$/, ''), record: wf.store.readRecord(sub, f) };
}

function latestAccess(wf: Workflow): Map<string, any> {
  const by = new Map<string, { v: number; rec: any }>();
  for (const f of wf.store.list('verification').filter((x) => x.startsWith('ACC-'))) {
    const m = f.match(/^ACC-(PKT-\d{4}-F\d)(?:-(\d{4}))?\.json$/);
    if (!m) continue;
    const v = m[2] ? Number(m[2]) : 1;
    if (!by.has(m[1]) || by.get(m[1])!.v < v) by.set(m[1], { v, rec: wf.store.readRecord('verification', f) });
  }
  return new Map([...by.entries()].map(([k, x]) => [k, x.rec]));
}

export function buildSnapshot(wf: Workflow, at = new Date()): Snapshot {
  const ctx = wf.run.ctx;
  const policy = loadPolicy(ctx);
  const set = loadArtifacts(ctx);
  const sys = discoverSystem(set);
  const c = buildCtx(wf);
  const problems: string[] = [];
  const classification: Classification[] = (() => {
    try {
      return JSON.parse(fs.readFileSync(wf.store.p('program_classification.json'), 'utf8')).programs;
    } catch {
      problems.push('program classification record is missing');
      return [];
    }
  })();
  const knownFiles = new Set<string>(c.relByFile.keys());
  const rawFiles = new Set(set.rawStructureFiles.filter((f) => f.data?.procedure_division).map((f) => f.file_id as string));
  // G2 approves the F1/F2 deliveries only (its required receipts); later agents' receipts are G3+ material
  // and must not change the requirements snapshot, its consolidation or its integrity.
  const g2Agents = new Set<string>(gateSpec('G2')!.required_receipts);
  const dl = deliveries(wf, { corrected: true }).filter((d) => g2Agents.has(d.packet.agent.id));
  const receipts = dl.map((d) => d.receipt);
  const items: Item[] = [];
  const ruleEntries = new Map<string, RuleEntry[]>();
  const contradictions: Snapshot['contradictions'] = [];
  const claimDigest: Array<[string, string, string]> = [];
  const coverageByRule = new Map<string, Set<string>>();

  for (const d of dl) {
    const pk = d.packet.packet_id;
    const rc = d.receipt.receipt_id;
    const req = d.docs.get('draft_requirements.json');
    if (req) {
      for (const cv of req.data.rule_coverage ?? []) {
        const e: RuleEntry = { packet: pk, receipt: rc, disposition: cv.disposition, requirement_ids: cv.requirement_ids ?? [], decision_requests: cv.decision_requests ?? [], reason: cv.reason, sha256: digest(cv) };
        ruleEntries.set(cv.rule.id, [...(ruleEntries.get(cv.rule.id) ?? []), e]);
        if (cv.disposition === 'mapped') for (const r of e.requirement_ids) coverageByRule.set(cv.rule.id, new Set([...(coverageByRule.get(cv.rule.id) ?? []), r]));
      }
      for (const r of req.data.requirements ?? []) {
        const claim = r.evidence_status === 'verified_from_source' ? verifyTextClaim(c, `${r.title} ${r.statement}`, r.source_refs) : null;
        if (claim) claimDigest.push(['requirement', r.requirement_id, claim.result]);
        const comps = [...evidenceComponents(policy, r.evidence_status, claim), ...refComponents(c, r.source_refs, knownFiles, rawFiles)];
        if (r.requires_sme_review) comps.push({ outcome: 'REQUIRES_SME_DECISION', reason: 'flagged for SME review by the requirements analyst', source: 'sme_flag' });
        items.push({ kind: 'requirement', id: r.requirement_id, units: r.units, sha256: digest(r), packet: pk, receipt: rc, document: req.path, evidence_status: r.evidence_status, claim: claim ? { result: claim.result, reasons: claim.reasons } : null, components: comps, source_refs: r.source_refs ?? [], open_decisions: r.open_decisions ?? [], data: r });
      }
      for (const x of req.data.contradictions ?? []) {
        const id = `${pk}:${x.contradiction_id}`;
        contradictions.push({ id, packet: pk, data: x, file_ids: (x.source_refs ?? []).map((s: any) => s.file_id).filter(Boolean), rule_ids: (x.rule_refs ?? []).map((r: any) => r.id), decision: x.decision_request ?? null, sha256: digest(x) });
      }
    }
    const fo = d.docs.get('file_operation_requirements.json');
    for (const p of fo?.data.programs ?? []) {
      (p.compatibility_requirements ?? []).forEach((cr: any, i: number) => {
        const claim = cr.evidence_status === 'verified_from_source' ? verifyTextClaim(c, cr.statement, cr.source_refs) : null;
        const id = `RT-${sanitize(p.unit.name)}-${pad(i + 1)}`;
        if (claim) claimDigest.push(['runtime_requirement', id, claim.result]);
        items.push({ kind: 'runtime_requirement', id, units: [p.unit], sha256: digest({ unit: p.unit, index: i, cr }), packet: pk, receipt: rc, document: fo!.path, evidence_status: cr.evidence_status, claim: claim ? { result: claim.result, reasons: claim.reasons } : null, components: [...evidenceComponents(policy, cr.evidence_status, claim), ...refComponents(c, cr.source_refs, knownFiles, rawFiles)], source_refs: cr.source_refs ?? [], open_decisions: [], data: cr });
      });
      const ops: Array<{ op: any; fl: any }> = [];
      for (const fl of p.files ?? []) for (const op of fl.operations ?? []) ops.push({ op, fl });
      if (ops.length) {
        const comps: Component[] = [];
        const counts: Record<string, number> = {};
        for (const { op, fl } of ops) {
          const claim = op.evidence_status === 'verified_from_source' ? verifyTextClaim(c, `${op.verb} ${fl.select_name}`, [{ file_id: p.unit.file_id, statement_id: op.statement_id, paragraph_id: op.paragraph_id }]) : null;
          if (claim) claimDigest.push(['file_operation', `${p.unit.name}:${fl.select_name}:${op.verb}:${op.statement_id}`, claim.result]);
          for (const k of evidenceComponents(policy, op.evidence_status, claim)) {
            counts[k.outcome] = (counts[k.outcome] ?? 0) + 1;
            if (k.outcome !== 'VERIFIED' && !comps.some((x) => x.outcome === k.outcome)) comps.push({ ...k, reason: `${op.verb} ${fl.select_name} (${op.statement_id ?? 'no statement'}): ${k.reason}` });
          }
        }
        if (!comps.length) comps.push({ outcome: 'VERIFIED', reason: `${ops.length} file operation(s) independently re-verified`, source: 'evidence' });
        else comps.forEach((k) => (k.reason = `${counts[k.outcome]} of ${ops.length} file operation(s) — e.g. ${k.reason}`));
        items.push({ kind: 'file_operations', id: `FO-${sanitize(p.unit.name)}`, units: [p.unit], sha256: digest({ unit: p.unit, files: p.files }), packet: pk, receipt: rc, document: fo!.path, evidence_status: Object.keys(counts).join('+'), claim: null, components: comps, source_refs: [{ file_id: p.unit.file_id }], open_decisions: [], data: { files: (p.files ?? []).map((f: any) => f.select_name), operations: ops.length } });
      }
    }
    const dm = d.docs.get('data_mappings.json');
    for (const rec of dm?.data.records ?? []) {
      const comps: Component[] = [];
      const tally: Record<string, string[]> = {};
      const add = (o: Outcome, field: string, reason: string) => {
        (tally[`${o}|${reason.split(':')[0]}`] = tally[`${o}|${reason.split(':')[0]}`] ?? []).push(field);
      };
      for (const f of rec.fields ?? []) {
        const claim = f.evidence_status === 'verified_from_source' ? verifyField(c, f) : null;
        if (claim) claimDigest.push(['field', f.field_id, claim.result]);
        for (const k of evidenceComponents(policy, f.evidence_status, claim)) if (k.outcome !== 'VERIFIED') add(k.outcome, f.field_id ?? f.field_name, k.reason);
        if (!f.java_type) add('REQUIRES_EVIDENCE', f.field_id ?? f.field_name, 'no Java type could be assigned');
      }
      for (const k of ['evidence_status', 'length_evidence_status']) {
        if (rec[k] === 'unresolved') add('REQUIRES_EVIDENCE', rec.record_id, `record ${k} is unresolved`);
        if (rec[k] === 'inferred') add('REQUIRES_SME_DECISION', rec.record_id, `record ${k} is inferred`);
      }
      for (const [k, fields] of Object.entries(tally)) {
        const [o, why] = k.split('|');
        comps.push({ outcome: o as Outcome, reason: `${fields.length} item(s): ${why} (${fields.slice(0, 4).join(', ')}${fields.length > 4 ? ', …' : ''})`, source: 'evidence' });
      }
      if (!comps.length) comps.push({ outcome: 'VERIFIED', reason: `${(rec.fields ?? []).length} field(s) independently re-verified (name, level, PIC, usage, size, offset)`, source: 'evidence' });
      const id = items.some((x) => x.kind === 'data_record' && x.id === rec.record_id) ? `${rec.record_id}@${pk}` : rec.record_id;
      items.push({ kind: 'data_record', id, units: rec.owner ? [rec.owner] : [], sha256: digest(rec), packet: pk, receipt: rc, document: dm!.path, evidence_status: rec.evidence_status, claim: null, components: comps, source_refs: [{ file_id: rec.owner?.file_id ?? null, record_id: rec.record_id }], open_decisions: [], data: { record_name: rec.record_name, fields: (rec.fields ?? []).length, record: rec } });
    }
  }

  // Traceability: a requirement derived from a rule must be what that rule maps to.
  const rules = new Map<string, any>(((set.artifacts.rules?.data?.business_rules ?? []) as any[]).map((r) => [r.rule_id, r]));
  for (const it of items.filter((x) => x.kind === 'requirement')) {
    for (const ref of it.data.derived_from_rules ?? []) {
      if (!rules.has(ref.id)) it.components.push({ outcome: 'REQUIRES_EVIDENCE', reason: `derived from ${ref.id}, which is not a canonical reverse rule`, source: 'traceability' });
      else if (!coverageByRule.get(ref.id)?.has(it.id)) it.components.push({ outcome: 'REQUIRES_EVIDENCE', reason: `derived from ${ref.id}, but no rule coverage entry maps ${ref.id} to this requirement`, source: 'traceability' });
    }
  }

  // Consolidation must be current: its inputs must be exactly the documents in use now.
  const f1 = dl.filter((d) => d.packet.agent.id === 'F1').length;
  const f2 = dl.filter((d) => d.packet.agent.id === 'F2').length;
  const consRequired = f1 > 1 || f2 > 1;
  const cons = latest(wf, 'consolidation', 'CONS-');
  const consProblems: string[] = [];
  if (consRequired && !cons) consProblems.push('several batches were delivered but no consolidation record exists (run workflow consolidate)');
  if (cons) {
    const now = new Map<string, string | null>();
    for (const d of dl) for (const x of d.docs.values()) now.set(rel(wf, x.abs), x.sha256);
    const then = new Map<string, string | null>();
    for (const i of cons.record.inputs ?? []) for (const x of i.documents ?? []) then.set(x.used, x.sha256);
    const differ = [...new Set([...now.keys(), ...then.keys()])].filter((k) => now.get(k) !== then.get(k));
    if (differ.length) consProblems.push(`${cons.id} was built from different deliverables than are in use now (${differ.slice(0, 3).join(', ')}${differ.length > 3 ? ', …' : ''}); run workflow consolidate`);
    if (cons.record.baseline_manifest_sha256 !== wf.run.manifestSha256) consProblems.push(`${cons.id} was built on a different baseline`);
  }
  const liveConflicts = [...ruleEntries.entries()].filter(([, es]) => new Set(es.map((e) => e.disposition)).size > 1).map(([id]) => id);
  const consConflicts: any[] = cons?.record.rules?.conflicts ?? [];
  for (const id of liveConflicts) if (!consConflicts.some((x) => x.rule_id === id)) consProblems.push(`cross-batch conflict on ${id} has no consolidation decision`);

  // Integrity: accepted deliverables must be byte-identical to what was accepted.
  const accessRecs = latestAccess(wf);
  const modified: string[] = [];
  const receiptChanges: string[] = [];
  const receiptHashes: Array<{ receipt_id: string; sha256: string | null }> = [];
  for (const r of receipts) {
    for (const o of r.verdict.provenance?.outputs ?? []) {
      const now = sha256File(path.resolve(ctx.repoRoot, o.path));
      if (o.runtime_sha256 && now !== o.runtime_sha256) modified.push(`${o.path} (accepted ${o.runtime_sha256.slice(0, 12)}…, now ${String(now).slice(0, 12)}…)`);
    }
    const sha = sha256File(wf.store.p('receipts', `${r.receipt_id}.json`));
    receiptHashes.push({ receipt_id: r.receipt_id, sha256: sha });
    const acc = accessRecs.get(r.packet_id);
    if (acc?.receipt_sha256_unchanged && acc.receipt_sha256_unchanged !== sha) receiptChanges.push(`${r.receipt_id} differs from the hash recorded in its access-evidence record`);
  }

  const gapsDoc = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(wf.run.runDir, 'gap_summary.json'), 'utf8'));
    } catch {
      problems.push('gap_summary.json is missing');
      return { gaps: [] };
    }
  })();
  const addressedGaps = new Map<string, string[]>();
  const agentDecisions: Snapshot['agentDecisions'] = [];
  for (const d of dl) for (const x of d.docs.values()) {
    if (x.data.contract === 'forward/decision-requests') for (const dd of x.data.decisions ?? []) {
      agentDecisions.push({ d: dd, packet: d.packet.packet_id, receipt: d.receipt.receipt_id, file: x.path, sha: x.sha256 });
      for (const g of dd.gap_refs ?? []) addressedGaps.set(g.gap.id, [...(addressedGaps.get(g.gap.id) ?? []), dd.decision_request_id]);
    }
    if (x.data.contract === 'forward/requirements') for (const q of x.data.requirements ?? []) for (const gi of q.gap_items ?? []) {
      const g = String(gi).split('#')[0];
      addressedGaps.set(g, [...(addressedGaps.get(g) ?? []), q.requirement_id]);
    }
  }

  const ledger = (a: 'F1' | 'F2') => new Map(computeLedger(wf, findAgent(a)!).entries.map((e) => [unitKey(e.unit), e.status]));
  const pst = latestPacketStatus(wf);
  const sourceHashes = new Map<string, string | null>();
  for (const [fid, r] of c.relByFile) sourceHashes.set(fid, c.srcRoot ? sha256File(path.join(c.srcRoot, r)) : null);

  const snap: Snapshot = {
    wf,
    at,
    policy,
    policy_sha256: policyDigest(policy),
    trust: loadTrustStore(ctx, policy),
    set,
    sys,
    ctx: c,
    g0: evaluateBaselineCheck(wf.run, wf.state),
    classification,
    receipts,
    items,
    itemById: new Map(items.map((i) => [i.id, i])),
    rules,
    rulesByProgram: set.artifacts.rules?.data?.rules_by_program ?? {},
    ruleEntries,
    contradictions,
    agentDecisions,
    gaps: gapsDoc.gaps ?? [],
    addressedGaps,
    consolidation: { required: consRequired, record: cons?.id ?? null, current: consProblems.length === 0, problems: consProblems, conflicts: consConflicts, decisions: (cons?.record.register ?? []).filter((d: any) => d.origin?.consolidation) },
    register: new Map(),
    resolutions: new Map(),
    packets: analyzePackets(wf),
    packetStatus: pst ? { id: pst.id, superseded: new Set((pst.record.packets ?? []).filter((p: any) => p.status === 'superseded').map((p: any) => p.packet_id)) } : null,
    coverage: { F1: ledger('F1'), F2: ledger('F2') },
    access: new Map([...accessRecs.entries()].map(([k, v]) => [k, v.provenance_status ?? null])),
    integrity: { modified_outputs: modified, receipt_hash_changes: receiptChanges, receipt_hashes: receiptHashes },
    sourceHashes,
    verification_digest: digest(claimDigest.sort((a, b) => (a.join('|') < b.join('|') ? -1 : 1))),
    problems,
    contextSupplements: new Map(),
    evidenceAdjudications: new Map(),
  };
  // Evidence supplements are read after the items exist (their currency is judged against them) and before the register.
  const ctxMod = require('../context/context') as typeof import('../context/context');
  for (const rec of ctxMod.supplements(wf)) {
    const st = ctxMod.supplementState(snap, rec);
    snap.contextSupplements.set(rec.supplement_id, { record: rec, current: st.current, problems: st.problems });
  }
  // STEP 10: a current evidence adjudication that proves an earlier verification rested on false matches
  // supersedes it (fail-closed). Only the latest, sealed version for the exact item and source bytes applies.
  const adjMod = require('../context/adjudication') as typeof import('../context/adjudication');
  const adjs = adjMod.adjudications(wf);
  for (const a of adjs) {
    const it = snap.itemById.get(a.item_id);
    const st = adjMod.adjudicationState(snap, adjs, a, it);
    snap.evidenceAdjudications.set(a.adjudication_id, { record: a, current: st.current, problems: st.problems });
    // The latest record for the item decides. An invalidation that went stale (source or item changed) still
    // fails closed: the earlier checker is not trusted again until a fresh adjudication supersedes it.
    const latestForItem = adjs.filter((x) => x.item_id === a.item_id).every((x) => x.version <= a.version);
    if (!latestForItem || !it || a.result.superseding_status !== 'EVIDENCE_INVALIDATED' || it.claim?.result !== 'verified') continue;
    it.claim = { result: 'unverified', reasons: [st.current ? `${a.adjudication_id}: ${a.result.superseding_reason}` : `${a.adjudication_id} invalidated the earlier verification and is no longer current (${st.problems.join('; ')}): re-adjudication required before the earlier check can count`] };
    it.components = [...evidenceComponents(policy, it.evidence_status, it.claim), ...it.components.filter((c) => c.source !== 'evidence')];
  }
  snap.register = buildRegister(snap);
  snap.resolutions = resolutionStates(snap);
  // STEP 12: link items to the blocking decisions their behaviour semantically depends on (fail-closed).
  (require('./semantic') as typeof import('./semantic')).applySemanticDependencies(snap);
  return snap;
}
