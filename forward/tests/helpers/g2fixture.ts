/**
 * Synthetic G2 workflow fixture shared by STEP 4.5 tests: a planned and
 * delivered workflow with checkable COBOL source for one program, a trust
 * store of in-memory test keys (public keys only on disk) and helpers to
 * sign resolutions and approvals. Nothing here touches the real run.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync, KeyObject, sign as edSign } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { loadContext, RuntimeContext } from '../../runtime/src/core/config';
import { runPlan } from '../../runtime/src/commands/plan';
import { AGENTS } from '../../runtime/src/orchestrator/agents';
import { advance, initWorkflow, loadWorkflow, prepareBatches, recordReceipt, runGate, runPrecheck } from '../../runtime/src/orchestrator/orchestrator';
import { SKILLS } from '../../runtime/src/orchestrator/skills';
import { consolidate } from '../../runtime/src/remediation/remediation';
import { canonicalize } from '../../runtime/src/approval/canonical';
import { resolutionTemplate, resolveDecision } from '../../runtime/src/approval/decisions';
import { buildSnapshot } from '../../runtime/src/approval/snapshot';
import { Fixture, FORWARD_DIR, makeFixture } from './fixture';
import { produceF1, produceF2, readPacket, writeDeliverables } from './outputs';

export const REPO = path.resolve(FORWARD_DIR, '..');
export const RUN = 'FWD-T45';
export type KP = { publicKey: KeyObject; privateKey: KeyObject };
export type Keys = Record<'approver' | 'sme' | 'agent', KP>;
export const SIGNERS = { approver: 'alice.approver', sme: 'bob.sme', agent: 'fe-requirements-analyst' } as const;
export const signText = (text: string, kp: KP) => edSign(null, Buffer.from(text, 'utf8'), kp.privateKey).toString('base64');
const pem = (kp: KP) => kp.publicKey.export({ type: 'spki', format: 'pem' }).toString();

export const BRAVO_SOURCE = [
  '       IDENTIFICATION DIVISION.',
  '       PROGRAM-ID. BRAVO02.',
  '       DATA DIVISION.',
  '       WORKING-STORAGE SECTION.',
  '       01  WS-LIMIT PIC 9(4).',
  '       PROCEDURE DIVISION.',
  '       P1.',
  '           MOVE 1000 TO WS-LIMIT.',
  '           IF WS-LIMIT > 500',
  "              DISPLAY 'HIGH'",
  '           END-IF.',
  '           GOBACK.',
];

export function setupG2(fixtures: Fixture[], opts: { mutate?: (f: Fixture) => void } = {}) {
  const f = makeFixture({ withSource: true });
  fixtures.push(f);
  fs.mkdirSync(path.join(f.repoRoot, '.claude', 'agents'), { recursive: true });
  for (const a of AGENTS) fs.copyFileSync(path.join(REPO, 'forward', 'agents', `${a.name}.agent.md`), path.join(f.repoRoot, '.claude', 'agents', `${a.name}.agent.md`));
  for (const s of SKILLS) f.write(`.claude/skills/${s.name}/SKILL.md`, fs.readFileSync(path.join(REPO, 'forward', 'skills', s.name, 'SKILL.md'), 'utf8'));
  const b = f.programs[1];
  f.write(`output/parser/raw_structure/${b.fileId}__${b.name}.json`, {
    program_summary: {},
    program_id: b.name,
    file_id: b.fileId,
    procedure_division: {
      paragraphs: [{ paragraph_id: `${b.fileId}-PAR-0001`, name: 'P1', start_line: 7, end_line: 12 }],
      statements: [
        { statement_id: `${b.fileId}-STMT-000001`, statement_type: 'MOVE', start_line: 8, end_line: 8 },
        { statement_id: `${b.fileId}-STMT-000002`, statement_type: 'IF', start_line: 9, end_line: 11 },
      ],
    },
  });
  f.write(`cobol-src/${b.rel}`, BRAVO_SOURCE.join('\n') + '\n');
  const rules = f.read('output/rules/rules_artifact.json');
  rules.rules_by_program = { [f.programs[0].name]: ['BR-001', 'BR-003'], [b.name]: ['BR-002'], [f.programs[2].name]: [] };
  f.write('output/rules/rules_artifact.json', rules);
  const mk = (): KP => generateKeyPairSync('ed25519');
  const k: Keys = { approver: mk(), sme: mk(), agent: mk() };
  const cfg = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
  cfg.approval = { ...cfg.approval, trust_store: 'trust/trust-store.json' };
  fs.writeFileSync(f.configPath, JSON.stringify(cfg, null, 2));
  f.write('trust/trust-store.json', {
    contract: 'approval-trust-store',
    contract_version: '1.0',
    issued_by: 'synthetic test custodian',
    signers: [
      { signer_id: SIGNERS.approver, public_key_pem: pem(k.approver), roles: ['requirements_approver'] },
      { signer_id: SIGNERS.sme, public_key_pem: pem(k.sme), roles: ['business_sme', 'technical_authority', 'product_owner'] },
      { signer_id: SIGNERS.agent, public_key_pem: pem(k.agent), roles: ['requirements_approver', 'business_sme'] },
    ],
  });
  opts.mutate?.(f);
  process.env.REVFORGE_COBOL_SOURCE_ROOT = f.sourceRoot;
  const ctx = loadContext({ forwardDir: FORWARD_DIR, configPath: f.configPath });
  runPlan(ctx, { runId: RUN });
  initWorkflow(ctx, RUN);
  assert.equal(runPrecheck(wfOf(ctx), 'EVIDENCE').status, 'PASS');
  assert.equal(advance(wfOf(ctx), 'EVIDENCE_VALIDATED').accepted, true);
  return { f, ctx, k };
}

export const wfOf = (ctx: RuntimeContext) => loadWorkflow(ctx, RUN);

export type Edit = (agent: 'F1' | 'F2', unit: string, docs: Record<string, any>, packet: any) => void;

export function deliverAll(f: Fixture, ctx: RuntimeContext, edit?: Edit) {
  for (const a of ['F1', 'F2'] as const) {
    for (const p of prepareBatches(wfOf(ctx), a, 1)) {
      const packet = readPacket(f.repoRoot, f.runsDir, RUN, p.packet_id);
      const docs = a === 'F1' ? produceF1(f.repoRoot, packet) : produceF2(f.repoRoot, packet);
      edit?.(a, packet.units[0].name, docs, packet);
      const rec = recordReceipt(wfOf(ctx), writeDeliverables(f.repoRoot, packet, docs));
      assert.equal(rec.verdict.accepted, true, `${p.packet_id}: ${rec.verdict.violations.join(' | ')}`);
    }
  }
  assert.equal(advance(wfOf(ctx), 'REQUIREMENTS_DRAFTED').accepted, true);
  consolidate(wfOf(ctx));
}

/** BRAVO02's requirement cites STMT-000001 with the given line and states the value 1000 (or `text`). */
export const citedClaim = (f: Fixture, line: number, text = 'The program sets the processing limit to 1000 before it evaluates the limit.'): Edit => (a, unit, docs) => {
  if (a !== 'F1' || unit !== f.programs[1].name) return;
  const r = docs['draft_requirements.json'].requirements[0];
  r.evidence_status = 'verified_from_source';
  r.statement = text;
  r.source_refs = [{ ...r.source_refs[0], statement_id: `${f.programs[1].fileId}-STMT-000001`, line }];
};

let seq = 0;
export function signResolution(ctx: RuntimeContext, f: Fixture, decisionId: string, outcome: string, kp: KP, signer: string, role: string): any {
  const t = resolutionTemplate(buildSnapshot(wfOf(ctx)), decisionId);
  const res = { ...t, outcome, selected_option: null, resolution_text: `Synthetic resolution for ${decisionId}`, justification: 'Synthetic justification recorded by a test signer', signer_id: signer, role, resolved_at: new Date(Date.now() - 1000).toISOString() };
  const file = path.join(f.repoRoot, `res45-${++seq}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-decision-resolution', resolution: res, signature: { algorithm: 'ed25519', value: signText(canonicalize(res), kp) } }));
  return resolveDecision(wfOf(ctx), file, { build: (w) => buildSnapshot(w) });
}
