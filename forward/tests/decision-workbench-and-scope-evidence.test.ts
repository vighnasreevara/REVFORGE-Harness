/**
 * STEP 5.5: scope selection, evidence package, decision packets, correction
 * review and signed citation-line correction, trust readiness, OpenAI pilot
 * preparation, checklist and G2 readiness. Synthetic fixtures and synthetic
 * signers only; nothing here touches the real workflow or the network.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { loadContext } from '../runtime/src/core/config';
import { sha256File } from '../runtime/src/core/fsutil';
import { main } from '../runtime/src/cli';
import { advance, generationAuthorized, prepare, runGate } from '../runtime/src/orchestrator/orchestrator';
import { canonicalize } from '../runtime/src/approval/canonical';
import { resolutionTemplate, resolveDecision } from '../runtime/src/approval/decisions';
import { buildSnapshot } from '../runtime/src/approval/snapshot';
import { analyse } from '../runtime/src/blockers/pipeline';
import { cmdOpenAI, cmdRemediation } from '../runtime/src/blockers/pipeline';
import { correct } from '../runtime/src/remediation/remediation';
import { candidatesRecord } from '../runtime/src/commands/workbench';
import { checklist, correctionReview, decisionPackets, evidencePackage, openaiPilot, scopeReadinessReport, trustReadiness } from '../runtime/src/workbench/workbench';
import { cleanup, Fixture, FORWARD_DIR } from './helpers/fixture';
import { citedClaim, deliverAll, KP, RUN, setupG2, SIGNERS, signText, wfOf } from './helpers/g2fixture';

const fixtures: Fixture[] = [];
beforeEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  delete process.env.REVFORGE_APPROVAL_TRUST_STORE;
  delete process.env.OPENAI_API_KEY;
});
afterEach(() => {
  delete process.env.REVFORGE_COBOL_SOURCE_ROOT;
  while (fixtures.length) cleanup(fixtures.pop()!);
});

const BATCH_REL = 'src/programs/batch/BRAVO02.cbl';

/** BRAVO02 becomes an application program (path evidence) with checkable source; the others stay unclassified. */
function setup(line = 8) {
  const { f, ctx, k } = setupG2(fixtures, {
    mutate: (fx) => {
      const b = fx.programs[1];
      const inv = fx.read('output/inventory/inventory_artifact.json');
      for (const r of inv.file_registry) if (r.program_id === b.name) Object.assign(r, { path: BATCH_REL, relative_path: BATCH_REL });
      fx.write('output/inventory/inventory_artifact.json', inv);
      fx.write(`cobol-src/${BATCH_REL}`, fs.readFileSync(path.join(fx.sourceRoot, b.rel), 'utf8'));
      // A second, independent classification signal: the program narrative describes business processing.
      const lf = `output/logic/program_logic/${b.fileId}__${b.name}_logic.json`;
      const logic = fx.read(lf);
      logic.program_narrative = `${b.name} validates transactions against the processing limit and records the result.`;
      fx.write(lf, logic);
    },
  });
  deliverAll(f, ctx, citedClaim(f, line));
  cmdOpenAI(wfOf(ctx));
  return { f, ctx, k };
}

function hashTree(dir: string): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (!fs.existsSync(dir)) return out;
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[path.relative(dir, p)] = sha256File(p);
    }
  };
  walk(dir);
  return out;
}

function signRes(ctx: any, f: Fixture, decision: string, outcome: string, kp: KP, signer: string, role: string, extra: any = {}) {
  const t = resolutionTemplate(buildSnapshot(wfOf(ctx)), decision);
  const res = { ...t, outcome, selected_option: null, resolution_text: `Synthetic resolution for ${decision}`, justification: 'Synthetic justification recorded by a test signer', signer_id: signer, role, resolved_at: new Date(Date.now() - 1000).toISOString(), ...extra };
  const file = path.join(f.repoRoot, `r-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify({ contract: 'signed-decision-resolution', resolution: res, signature: { algorithm: 'ed25519', value: signText(canonicalize(res), kp) } }));
  return resolveDecision(wfOf(ctx), file, { build: (w) => buildSnapshot(w) });
}

describe('S55-A. scope selection and evidence package', () => {
  test('dynamic selection recommends the meaningful application scope; templates/unclassified programs need a signed scope decision', () => {
    const { f, ctx } = setup();
    const a = analyse(wfOf(ctx));
    const c = candidatesRecord(a);
    const [alpha, bravo, charlie] = f.programs.map((p) => p.name);
    assert.equal(c.recommended.scope, `programs:${bravo}`);
    assert.equal(c.top_three.length, 3);
    for (const other of [alpha, charlie]) {
      const x = c.programs.find((p: any) => p.primary === other);
      assert.equal(x.meaningful, false);
      assert.match(x.meaningful_reasons.join(' '), /not an application function|scope decision|no requirement/);
      const d = a.snap.register.get(`SCOPE-${other}`);
      assert.ok(d && d.blocking, 'non-application programs keep an open, blocking scope decision; nothing is excluded automatically');
      assert.equal(a.snap.resolutions.get(`SCOPE-${other}`)!.status, 'open');
    }
  });

  test('the evidence package carries the dependency closure, hashes, citations and change impact without dropping shared dependencies', () => {
    const { f, ctx } = setup();
    const a = analyse(wfOf(ctx));
    const scope = `programs:${f.programs[1].name}`;
    const pkg = evidencePackage(a, scope);
    assert.deepEqual(pkg.dependency_closure.dependencies.map((d: any) => d.name), [f.copybooks[0].name]);
    assert.ok(pkg.change_impact.scopes_sharing_units.includes(f.programs[0].name) && pkg.change_impact.scopes_sharing_units.includes(f.programs[2].name));
    const req = pkg.requirements[0];
    assert.equal(req.g2_outcome, 'VERIFIED');
    assert.ok(req.citations[0].source_sha256 && req.citations[0].excerpt.some((l: any) => /MOVE 1000/.test(l.text)));
    assert.equal(pkg.baseline.manifest_sha256, wfOf(ctx).run.manifestSha256);
    assert.ok(pkg.data_contracts.some((d: any) => d.owner === f.copybooks[0].name), 'the shared copybook data contract stays in scope');
    assert.match(pkg.status, /not approved/);
  });
});

describe('S55-B. decision packets, traceability and scope boundaries', () => {
  test('every blocking decision is traceable to a root-cause packet; unrelated decisions stay out; shared blockers stay in', () => {
    const { f, ctx } = setup();
    const a = analyse(wfOf(ctx));
    const scope = `programs:${f.programs[1].name}`;
    const p = decisionPackets(a, scope);
    const inPackets = new Set(p.packets.flatMap((x: any) => x.decisions.map((d: any) => d.decision_id)));
    const readiness = scopeReadinessReport(a, scope, trustReadiness(a, ['business_sme']));
    for (const d of readiness.blocking_decisions) assert.ok(inPackets.has(d), `${d} has a packet`);
    for (const d of inPackets) assert.ok(a.snap.register.has(d as string));
    assert.ok(![...inPackets].some((d) => String(d).includes(f.programs[0].name)), 'decisions of the unrelated program do not appear');
    assert.ok([...inPackets].some((d) => String(d).startsWith('RVW-REC-') && String(d).includes(f.copybooks[0].fileId)), 'the shared copybook blocker is kept');
    for (const x of p.packets) {
      assert.ok(['A', 'B', 'C', 'D', 'E', 'Z'].includes(x.class));
      for (const d of x.decisions) for (const o of d.supported_outcomes) assert.ok(o.effect && o.authorized_roles.length);
    }
    const list = checklist(a, evidencePackage(a, scope), p, correctionReview(a, scope), trustReadiness(a, ['business_sme']), openaiPilot(a, scope));
    assert.equal(new Set(list.consolidated_human_workload.flatMap((w: any) => w.decisions)).size, inPackets.size);
    assert.ok(list.actions.every((x: any) => x.verified_by && x.role && Array.isArray(x.depends_on)));
  });
});

describe('S55-C. corrections, trust and signatures', () => {
  test('a citation correction is reviewed against current source and applied only with a valid signed resolution naming it', () => {
    const { f, ctx, k } = setup(12);
    cmdRemediation(wfOf(ctx));
    const a = analyse(wfOf(ctx));
    const scope = `programs:${f.programs[1].name}`;
    const review = correctionReview(a, scope);
    assert.equal(review.proposals.length, 1);
    const p = review.proposals[0];
    assert.equal(p.verified_now, true);
    assert.deepEqual([p.original_value, p.proposed_value], [12, 8]);
    assert.match(p.proposed_line_text, /MOVE 1000/);
    const item = a.snap.itemById.get(p.item)!;
    const spec = { packet: item.packet, file: path.basename(p.document), pointer: p.pointer, kind: 'citation_line' as const, reason: 'reviewed citation', proposal_id: p.proposal_id, authorized_by: 'RES-0001' };
    assert.throws(() => correct(wfOf(ctx), spec), /not the effective, verified resolution/);
    // A resolution signed with the wrong key is rejected and still cannot authorize the correction.
    const bad = signRes(ctx, f, p.authorization.decision, 'resolved_requires_update', k.approver, SIGNERS.sme, 'business_sme', { selected_option: p.proposal_id });
    assert.equal(bad.recorded, false);
    assert.ok(bad.checks.some((c: any) => c.id === 'signature' && !c.ok));
    // A validly signed resolution that names a different (non-existent) proposal does not authorize it either:
    // since STEP 8 it is rejected at import (remediation_binding), so the correction still cannot be applied.
    const other = signRes(ctx, f, p.authorization.decision, 'resolved_requires_update', k.sme, SIGNERS.sme, 'business_sme', { selected_option: 'RP-0000000000' });
    assert.equal(other.recorded, false);
    assert.ok(other.checks.some((c: any) => c.id === 'remediation_binding' && !c.ok));
    assert.throws(() => correct(wfOf(ctx), spec), /not the effective, verified resolution/);
    const good = signRes(ctx, f, p.authorization.decision, 'resolved_requires_update', k.sme, SIGNERS.sme, 'business_sme', { selected_option: p.proposal_id });
    assert.equal(good.recorded, true, JSON.stringify(good.checks));
    const orig = path.join(f.repoRoot, p.document);
    const before = sha256File(orig);
    const c = correct(wfOf(ctx), { ...spec, authorized_by: good.resolution_id });
    assert.equal(c.new_value, 8);
    assert.equal(c.classification, 'human_authorized');
    assert.equal(c.evidence.authorized_by, good.resolution_id);
    assert.equal(sha256File(orig), before, 'the original deliverable is untouched');
  });

  test('trust readiness reports missing anchors and roles; nothing is generated or trusted by the harness', () => {
    const { f, ctx } = setup();
    const a = analyse(wfOf(ctx));
    const t = trustReadiness(a, ['requirements_approver', 'business_sme', 'data_owner']);
    assert.equal(t.status, 'TRUST_INCOMPLETE');
    assert.deepEqual(t.roles.filter((r: any) => !r.covered).map((r: any) => r.role), ['data_owner']);
    const cfg = JSON.parse(fs.readFileSync(f.configPath, 'utf8'));
    cfg.approval.trust_store = null;
    fs.writeFileSync(f.configPath, JSON.stringify(cfg, null, 2));
    process.env.REVFORGE_COBOL_SOURCE_ROOT = f.sourceRoot;
    const a2 = analyse(wfOf(loadContext({ forwardDir: FORWARD_DIR, configPath: f.configPath })));
    assert.equal(trustReadiness(a2, ['requirements_approver']).status, 'TRUST_NOT_CONFIGURED');
    assert.equal(fs.readFileSync(path.join(f.repoRoot, 'trust', 'trust-store.json'), 'utf8').includes('PRIVATE'), false);
  });

  test('a valid signed resolution is verified and recorded; an unknown signer is refused', () => {
    const { f, ctx, k } = setup();
    const scope = `programs:${f.programs[1].name}`;
    const decision = `SCOPE-${f.programs[1].name}`;
    const a0 = analyse(wfOf(ctx));
    const has = a0.snap.register.has(decision);
    const target = has ? decision : scopeReadinessReport(a0, scope, trustReadiness(a0, [])).blocking_decisions[0];
    const unknown: KP = generateKeyPairSync('ed25519');
    assert.equal(signRes(ctx, f, target, 'excluded_from_scope', unknown, 'nobody.unknown', 'business_sme').recorded, false);
    const ok = signRes(ctx, f, target, a0.snap.register.get(target)!.allowed_outcomes.includes('resolved_no_change') ? 'resolved_no_change' : 'excluded_from_scope', k.sme, SIGNERS.sme, 'business_sme');
    assert.equal(ok.recorded, true, JSON.stringify(ok.checks));
    const after = scopeReadinessReport(analyse(wfOf(ctx)), scope, trustReadiness(analyse(wfOf(ctx)), []));
    assert.ok(!after.blocking_decisions.includes(target), 'a verified resolution stops the decision from blocking');
  });
});

describe('S55-D. pilot preparation and protections', () => {
  test('the OpenAI pilot is prepared with an unsigned authorization request and no network call; G2, gates, Java and reverse files stay protected', () => {
    const { f, ctx } = setup();
    const wd = wfOf(ctx).store.dir;
    const guarded = ['receipts', 'agents', 'decisions', 'approvals', 'step45', 'authorizations'];
    const before = Object.fromEntries(guarded.map((d) => [d, hashTree(path.join(wd, d))]));
    const outBefore = hashTree(path.join(f.repoRoot, 'output'));
    const srcBefore = hashTree(f.sourceRoot);
    const http = require('http');
    const https = require('https');
    const net = require('net');
    const calls: string[] = [];
    const saved = { hr: http.request, sr: https.request, nc: net.connect, fetch: (globalThis as any).fetch };
    const trap = (n: string) => () => {
      calls.push(n);
      throw new Error(`network call attempted: ${n}`);
    };
    Object.assign(http, { request: trap('http') });
    Object.assign(https, { request: trap('https') });
    Object.assign(net, { connect: trap('net') });
    (globalThis as any).fetch = trap('fetch');
    let code: number;
    try {
      code = main(['workbench', 'report', '--config', f.configPath, '--run', RUN, '--export-dir', path.join(f.repoRoot, 'wb'), '--out', path.join(f.repoRoot, 'STEP55.md')], () => {}, () => {}) as number;
    } finally {
      Object.assign(http, { request: saved.hr });
      Object.assign(https, { request: saved.sr });
      Object.assign(net, { connect: saved.nc });
      (globalThis as any).fetch = saved.fetch;
    }
    assert.equal(code!, 0);
    assert.deepEqual(calls, []);
    const pilot = JSON.parse(fs.readFileSync(path.join(f.repoRoot, 'wb', 'openai-pilot.json'), 'utf8'));
    assert.equal(pilot.status, 'LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED');
    assert.ok(pilot.cases.length <= 3);
    if (pilot.cases.length) {
      const req = JSON.parse(fs.readFileSync(path.join(f.repoRoot, 'wb', 'openai-pilot-authorization-request.json'), 'utf8'));
      assert.equal(req.contract, 'source-export-authorization');
      assert.ok(!('signature' in req) && req.scope.files.every((x: any) => /^[0-9a-f]{64}$/.test(x.sha256)));
    }
    for (const fname of ['first-scope-recommendation.md', 'scope-evidence-package.json', 'decision-packets.md', 'approval-operations-checklist.md', 'scope-g2-readiness.md', 'correction-review.json', 'trust-readiness.json']) assert.ok(fs.existsSync(path.join(f.repoRoot, 'wb', fname)), fname);
    for (const d of guarded) assert.deepEqual(hashTree(path.join(wd, d)), before[d], `${d} unchanged`);
    assert.equal(wfOf(ctx).store.list('approvals').filter((x) => x.startsWith('APR-')).length, 0, 'no approval created');
    assert.equal(runGate(wfOf(ctx), 'G2').status, 'UNVERIFIED');
    assert.equal(advance(wfOf(ctx), 'REQUIREMENTS_APPROVED').accepted, false);
    for (const g of ['G3', 'G4', 'G5', 'G6', 'G7', 'G8'] as const) assert.equal(runGate(wfOf(ctx), g).status, 'BLOCKED', g);
    assert.equal(generationAuthorized(wfOf(ctx).run, wfOf(ctx).state), false);
    assert.throws(() => prepare(wfOf(ctx), 'F5'), /may only be dispatched/);
    assert.equal(wfOf(ctx).store.verifyCheckpoint().ok, true);
    assert.equal(wfOf(ctx).store.verifyAudit().ok, true);
    assert.deepEqual(hashTree(path.join(f.repoRoot, 'output')), outBefore);
    assert.deepEqual(hashTree(f.sourceRoot), srcBefore);
  });
});
