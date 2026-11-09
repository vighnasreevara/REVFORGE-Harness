/**
 * Synthetic end-to-end demonstration of the two-gate forward workflow
 * (environment SYNTHETIC_INTERVIEW_DEMO).
 *
 * A self-contained run of the nine forward steps on one small, committed,
 * synthetic COBOL program (forward/demo/gates/synthetic): two automated
 * pre-checks (BASELINE, EVIDENCE), the two human gates G2 (requirements) and
 * G3 (architecture), each with a signed demo approval, and five automated
 * steps (STORIES, BUILD, VERIFY, REVIEW, COMPLETE). Every step result is
 * computed from checks executed in this run; a step never PASSes without
 * evaluating its checks.
 *
 * Isolation from the real modernization:
 *   - inputs come only from forward/demo/gates/synthetic; the real reverse
 *     artifacts, COBOL source, workflow runs and generated Java are never read
 *     as inputs (only counted read-only for the real-project status section);
 *   - output goes to its own run directory (default forward/demo/gates/runs/,
 *     git-ignored); a directory inside the real runs, output/ or reports is refused;
 *   - approvals use an ephemeral demo key and a demo trust store, never the
 *     real trust anchor; records say production_authorization: NOT_GRANTED;
 *   - nothing here calls the real orchestrator, writes a real gate, receipt,
 *     approval or authorisation, or changes the configuration;
 *   - BMad lifecycle steps are SIMULATED records that the real receipt
 *     counter (bmad/governance.receiptCounts) refuses as execution evidence.
 *
 * These demo steps are governance checkpoints. They are distinct from the
 * two engineering quality gates SOURCE_READINESS and CONVERSION_VALIDATION
 * (pilot/gates.ts), which this module does not change or replace.
 */
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { canonicalize, digest } from '../approval/canonical';
import { loadPolicy } from '../approval/policy';
import { loadTrustStore } from '../approval/trust';
import { bmadMandatory, GOVERNED_STAGES, receiptCounts } from '../bmad/governance';
import { RuntimeContext } from '../core/config';
import { listJava, RUNTIME_DIR } from '../pilot/app-convert';
import { AppProgram, parseApp, walkStmts } from '../pilot/cobol-app';
import { emitApp } from '../pilot/java-app';
import { detectToolchain, Toolchain } from '../pilot/pilot';
import { DemoOrder, expectedResult, generateCases, OracleCase } from './oracle';
import { DEMO_ENV, DEMO_ROLES, DEMO_SIGNER, EphemeralAuthority, SIGNER_STATEMENT, statementText, verifyDemoSignature } from './signing';

export { DEMO_ENV };
export type DemoStepId = 'BASELINE' | 'EVIDENCE' | 'G2' | 'G3' | 'STORIES' | 'BUILD' | 'VERIFY' | 'REVIEW' | 'COMPLETE';
export type DemoStepKind = 'precheck' | 'gate' | 'automated';
export type DemoStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_RUN';
export const DEMO_STEPS: DemoStepId[] = ['BASELINE', 'EVIDENCE', 'G2', 'G3', 'STORIES', 'BUILD', 'VERIFY', 'REVIEW', 'COMPLETE'];
/** The only human gates, each needing a signed (demo) approval. */
export const DEMO_GATES = ['G2', 'G3'] as const;
export type ApprovalGate = (typeof DEMO_GATES)[number];

export const IMPLEMENTER: string = 'deterministic-local-converter';
export const REVIEWER: string = 'synthetic-demo-reviewer';
const ORACLE_SEED = 20261105;
const ORACLE_SEEDED_CASES = 240;

export const STEP_SPECS: Record<DemoStepId, { name: string; kind: DemoStepKind; prerequisite: DemoStepId | null; responsibility: string; approval_evidence: string }> = {
  BASELINE: { name: 'Baseline pre-check', kind: 'precheck', prerequisite: null, responsibility: 'runtime: deterministic integrity checks of the synthetic baseline', approval_evidence: 'none (automatic check)' },
  EVIDENCE: { name: 'Evidence pre-check', kind: 'precheck', prerequisite: 'BASELINE', responsibility: 'runtime: re-parses the synthetic COBOL and verifies the synthetic reverse evidence (reverse agents 1-5 analogue)', approval_evidence: 'none (automatic check)' },
  G2: { name: 'Requirements Approval', kind: 'gate', prerequisite: 'EVIDENCE', responsibility: 'synthetic F1 requirements and F2 data contract; approved by the synthetic demo authority', approval_evidence: `Ed25519 demo approval, role ${DEMO_ROLES.G2}` },
  G3: { name: 'Architecture Approval', kind: 'gate', prerequisite: 'G2', responsibility: 'synthetic F3 architecture; approved by the synthetic demo authority', approval_evidence: `Ed25519 demo approval, role ${DEMO_ROLES.G3}` },
  STORIES: { name: 'Story validation', kind: 'automated', prerequisite: 'G3', responsibility: 'runtime: synthetic F4 stories and acceptance criteria checked against the approved requirements and architecture', approval_evidence: 'none (automatic check; there is no story approval gate)' },
  BUILD: { name: 'Java build and tests', kind: 'automated', prerequisite: 'STORIES', responsibility: 'deterministic local converter (F5 analogue, no AI agent); javac -Werror; TestMain functional and boundary scenarios', approval_evidence: 'none (executed build and test evidence)' },
  VERIFY: { name: 'Independent verification', kind: 'automated', prerequisite: 'BUILD', responsibility: 'independent specification oracle (F6 analogue) written from the requirements only', approval_evidence: 'none (executed comparison evidence)' },
  REVIEW: { name: 'Independent review', kind: 'automated', prerequisite: 'VERIFY', responsibility: `independent review checks (F7 analogue) by ${REVIEWER}`, approval_evidence: 'none (structured review result)' },
  COMPLETE: { name: 'Completion', kind: 'automated', prerequisite: 'REVIEW', responsibility: 'runtime: completes the synthetic run when every earlier step passed, all evidence is intact and the review has no blocking finding', approval_evidence: 'none (completion after the F7 review; no human acceptance gate)' },
};

export class DemoRefused extends Error {}

export interface Check {
  id: string;
  ok: boolean;
  detail: string;
}

/** Test and demonstration hooks. Each one simulates a defect so that the steps can be shown to block it. */
export interface DemoHooks {
  /** Called with each unsigned approval and the signer; returns the record to submit (or null to submit none). */
  approve?: (gate: ApprovalGate, unsigned: any, sign: (r: any) => any) => any | null;
  /** Called after the converter has written the Java sources (before compilation). */
  afterGeneration?: (javaSrcDir: string) => void;
  /** Called after a step result has been written. */
  afterStep?: (step: DemoStepId, run: DemoRun) => void;
}

export interface DemoOptions {
  ctx: RuntimeContext;
  inputDir?: string;
  outDir?: string;
  runId?: string;
  toolchain?: Toolchain;
  hooks?: DemoHooks;
  now?: () => Date;
}

export interface DemoRun {
  ctx: RuntimeContext;
  id: string;
  inputDir: string;
  outDir: string;
  startedAt: string;
  authority: EphemeralAuthority;
  trustStore: string;
  tc: Toolchain;
  hooks: DemoHooks;
  now: () => Date;
  snapshots: { inputs: string; runs: string; reverse: string; config: string | null };
}

const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const shaFile = (p: string): string | null => (fs.existsSync(p) && fs.statSync(p).isFile() ? sha(fs.readFileSync(p)) : null);
const posix = (p: string) => p.split(path.sep).join('/');
const inside = (child: string, parent: string) => {
  const r = path.relative(path.resolve(parent), path.resolve(child));
  return r === '' || (!r.startsWith('..') && !path.isAbsolute(r));
};
const readJson = (p: string): any => JSON.parse(fs.readFileSync(p, 'utf8'));
function writeJson(p: string, v: unknown): string {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const text = JSON.stringify(v, null, 2) + '\n';
  fs.writeFileSync(p, text);
  return sha(text);
}
function listFiles(d: string): string[] {
  return fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listFiles(path.join(d, e.name)) : [path.join(d, e.name)])) : [];
}
/** A cheap fingerprint of a directory tree: relative paths, sizes and modification times. */
function treeFingerprint(d: string): string {
  return sha(listFiles(d).sort().map((f) => {
    const s = fs.statSync(f);
    return `${posix(path.relative(d, f))}|${s.size}|${s.mtimeMs}`;
  }).join('\n'));
}
const check = (id: string, ok: boolean, detail: string): Check => ({ id, ok, detail });

export const defaultInputDir = (ctx: RuntimeContext) => path.join(ctx.forwardDir, 'demo', 'gates', 'synthetic');
export const defaultRunsDir = (ctx: RuntimeContext) => path.join(ctx.forwardDir, 'demo', 'gates', 'runs');

/* ------------------------------------------------------------------ */
/* run setup and state                                                 */
/* ------------------------------------------------------------------ */

export function initRun(o: DemoOptions): DemoRun {
  const ctx = o.ctx;
  const now = o.now ?? (() => new Date());
  const start = now();
  const id = o.runId ?? `DEMO-${start.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${sha(String(Math.random())).slice(0, 4)}`;
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new DemoRefused(`invalid demo run id: ${id}`);
  const inputDir = path.resolve(o.inputDir ?? defaultInputDir(ctx));
  const outDir = path.resolve(o.outDir ?? path.join(defaultRunsDir(ctx), id));
  for (const [dir, why] of [
    [ctx.runsDir, 'the real workflow runs'],
    [path.join(ctx.repoRoot, 'output'), 'the real reverse-engineering artifacts'],
    [path.join(ctx.forwardDir, 'reports'), 'the historical reports'],
    [path.join(ctx.forwardDir, 'generated'), 'the real generated Java'],
    [inputDir, 'the synthetic inputs'],
  ] as const) {
    if (inside(outDir, dir)) throw new DemoRefused(`demo output ${outDir} is inside ${why} (${dir}); the demonstration writes only to its own run directory`);
  }
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) throw new DemoRefused(`demo output ${outDir} already exists and is not empty`);
  fs.mkdirSync(outDir, { recursive: true });
  const authority = new EphemeralAuthority(start);
  const trustStore = authority.writeTrustStore(path.join(outDir, 'trust'), new Date(start.getTime() + 24 * 3600 * 1000).toISOString());
  const run: DemoRun = {
    ctx, id, inputDir, outDir, startedAt: start.toISOString(), authority, trustStore,
    tc: o.toolchain ?? detectToolchain(), hooks: o.hooks ?? {}, now,
    snapshots: { inputs: treeFingerprint(inputDir), runs: treeFingerprint(ctx.runsDir), reverse: treeFingerprint(path.join(ctx.repoRoot, 'output')), config: shaFile(ctx.configPath) },
  };
  writeJson(path.join(outDir, 'state.json'), { contract: 'demo/state', environment: DEMO_ENV, demo_run_id: id, started_at: run.startedAt, steps: {} });
  return run;
}

const stateFile = (run: DemoRun) => path.join(run.outDir, 'state.json');
export const readState = (run: DemoRun): any => readJson(stateFile(run));
const resultFile = (run: DemoRun, g: DemoStepId) => path.join(run.outDir, 'steps', `${g}.result.json`);
const rel = (run: DemoRun, p: string) => posix(path.relative(run.outDir, p));
const inRel = (run: DemoRun, p: string) => posix(path.relative(run.inputDir, p));
const baselineFile = (run: DemoRun) => path.join(run.inputDir, 'baseline.json');

/** A prerequisite counts only when its persisted result is PASS, unchanged since it was written, and on this baseline. */
export function stepPassed(run: DemoRun, g: DemoStepId): { ok: boolean; detail: string } {
  const e = readState(run).steps[g];
  if (!e) return { ok: false, detail: `${g} has not been evaluated in demo run ${run.id}` };
  if (e.demo_status !== 'PASS') return { ok: false, detail: `${g} is ${e.demo_status}` };
  if (shaFile(resultFile(run, g)) !== e.result_sha256) return { ok: false, detail: `${g} result file is missing or changed since it was recorded` };
  if (e.baseline_sha256 !== shaFile(baselineFile(run))) return { ok: false, detail: `${g} passed on a different baseline` };
  return { ok: true, detail: `${g} PASS on this baseline (result ${String(e.result_sha256).slice(0, 12)}…)` };
}

function priorSteps(run: DemoRun, upTo: DemoStepId): Array<{ step: string; status: string; result_sha256: string }> {
  const st = readState(run).steps;
  return DEMO_STEPS.slice(0, DEMO_STEPS.indexOf(upTo)).map((g) => ({ step: g, status: st[g]?.demo_status ?? 'NOT_RUN', result_sha256: st[g]?.result_sha256 ?? '0'.repeat(64) }));
}

/* ------------------------------------------------------------------ */
/* inputs                                                              */
/* ------------------------------------------------------------------ */

const P = {
  baseline: 'baseline.json',
  reverse: 'reverse/reverse-evidence.json',
  requirements: 'requirements/requirements.json',
  dataContract: 'requirements/data-contract.json',
  architecture: 'design/architecture.json',
  plan: 'design/development-plan.json',
  functional: 'tests/functional-tests.json',
};
const inp = (run: DemoRun, k: keyof typeof P) => path.join(run.inputDir, P[k]);
function loadInput(run: DemoRun, k: keyof typeof P, contract: string | null, checks: Check[]): any | null {
  const f = inp(run, k);
  if (!fs.existsSync(f)) {
    checks.push(check(`${k}_present`, false, `${P[k]} is missing`));
    return null;
  }
  let doc: any;
  try {
    doc = readJson(f);
  } catch (e) {
    checks.push(check(`${k}_parses`, false, `${P[k]} is not valid JSON: ${(e as Error).message}`));
    return null;
  }
  if (contract) {
    const v = run.ctx.contracts.validate(contract, doc);
    checks.push(check(`${k}_contract`, v.valid, v.valid ? `${P[k]} satisfies ${contract}` : `${P[k]}: ${v.errors.slice(0, 4).join('; ')}`));
    if (!v.valid) return null;
  }
  return doc;
}

function parseSource(run: DemoRun, baseline: any): { prog: AppProgram | null; error: string | null; file: string } {
  const file = path.join(run.inputDir, baseline?.source?.path ?? 'source/DEMOORD1.cbl');
  try {
    return { prog: parseApp(file, path.basename(file), () => null), error: null, file };
  } catch (e) {
    return { prog: null, error: (e as Error).message, file };
  }
}

function programStatements(prog: AppProgram): Array<{ line: number; paragraph: string | null; kind: string }> {
  const out: Array<{ line: number; paragraph: string | null; kind: string }> = [];
  prog.paragraphs.forEach((q) => q.sentences.forEach((ss) => walkStmts(ss, (s) => out.push({ line: s.origin.line, paragraph: q.name, kind: s.kind }))));
  return out.sort((a, b) => a.line - b.line);
}

/* ------------------------------------------------------------------ */
/* approvals                                                           */
/* ------------------------------------------------------------------ */

const approvalFile = (run: DemoRun, g: ApprovalGate) => path.join(run.outDir, 'approvals', `${g}.approval.json`);

function approvalSubject(run: DemoRun, g: ApprovalGate): { kind: string; path: string; sha256: string } {
  if (g === 'G2') {
    const r = shaFile(inp(run, 'requirements')) ?? '';
    const d = shaFile(inp(run, 'dataContract')) ?? '';
    return { kind: 'requirements_package', path: `${P.requirements} + ${P.dataContract}`, sha256: digest({ requirements: r, data_contract: d }) };
  }
  return { kind: 'architecture', path: P.architecture, sha256: shaFile(inp(run, 'architecture')) ?? '0'.repeat(64) };
}

/** Presents the statement to the synthetic demo authority and records what comes back (the hook may simulate a defect). */
export function requestApproval(run: DemoRun, g: ApprovalGate): string | null {
  const unsigned = {
    contract: 'demo/approval',
    contract_version: '1.0',
    environment: DEMO_ENV,
    approval_id: `DAP-${g}-${run.id}`,
    gate: g,
    decision: 'approved',
    subject: approvalSubject(run, g),
    binding: { demo_run_id: run.id, baseline_sha256: shaFile(baselineFile(run)) ?? '0'.repeat(64), source_sha256: shaFile(path.join(run.inputDir, 'source', 'DEMOORD1.cbl')) ?? '0'.repeat(64), prior_steps: priorSteps(run, g) },
    signer: { signer_id: DEMO_SIGNER, role: DEMO_ROLES[g], kind: 'SYNTHETIC_DEMO_AUTHORITY', statement: SIGNER_STATEMENT },
    production_authorization: 'NOT_GRANTED',
    signed_at: run.now().toISOString(),
  };
  const signer = (r: any) => run.authority.sign(r);
  const rec = run.hooks.approve ? run.hooks.approve(g, unsigned, signer) : signer(unsigned);
  if (!rec) return null;
  const f = approvalFile(run, g);
  writeJson(f, rec);
  return f;
}

/** Every check a demo approval must pass. */
function verifyApproval(run: DemoRun, g: ApprovalGate): { checks: Check[]; evidence: Array<{ path: string; sha256: string; role: string }> } {
  const checks: Check[] = [];
  const f = approvalFile(run, g);
  if (!fs.existsSync(f)) return { checks: [check('approval_present', false, `no ${g} demo approval was submitted (${rel(run, f)} is missing)`)], evidence: [] };
  checks.push(check('approval_present', true, `${rel(run, f)}`));
  const rec = readJson(f);
  const v = run.ctx.contracts.validate('demo/approval', rec);
  checks.push(check('approval_contract', v.valid, v.valid ? 'satisfies demo/approval' : v.errors.slice(0, 4).join('; ')));
  checks.push(check('approval_gate_and_decision', rec.gate === g && rec.decision === 'approved', `gate ${rec.gate}, decision ${rec.decision}`));
  const subject = approvalSubject(run, g);
  checks.push(check('approval_subject_bound', rec.subject?.sha256 === subject.sha256 && rec.subject?.kind === subject.kind, rec.subject?.sha256 === subject.sha256 ? `binds ${subject.kind} ${subject.sha256.slice(0, 16)}… (the current content)` : `approval binds ${String(rec.subject?.sha256).slice(0, 16)}…, current ${subject.kind} is ${subject.sha256.slice(0, 16)}…`));
  const baseline = shaFile(baselineFile(run));
  const source = shaFile(path.join(run.inputDir, 'source', 'DEMOORD1.cbl'));
  checks.push(check('approval_run_and_baseline_bound', rec.binding?.demo_run_id === run.id && rec.binding?.baseline_sha256 === baseline && rec.binding?.source_sha256 === source, `run ${rec.binding?.demo_run_id}, baseline ${String(rec.binding?.baseline_sha256).slice(0, 12)}…, source ${String(rec.binding?.source_sha256).slice(0, 12)}…${rec.binding?.demo_run_id === run.id && rec.binding?.baseline_sha256 === baseline && rec.binding?.source_sha256 === source ? '' : ' (does not match this run, baseline and source)'}`));
  const prior = priorSteps(run, g);
  const priorOk = prior.every((p) => p.status === 'PASS') && canonicalize(prior) === canonicalize(rec.binding?.prior_steps ?? []);
  checks.push(check('approval_prior_steps_bound', priorOk, priorOk ? `binds the PASS results of ${prior.map((p) => p.step).join(', ')}` : 'the prior step results bound by the approval are not the current PASS results'));
  checks.push(check('approval_synthetic_signer', /^synthetic-demo-/.test(rec.signer?.signer_id ?? '') && rec.signer?.kind === 'SYNTHETIC_DEMO_AUTHORITY', `${rec.signer?.signer_id} (${rec.signer?.kind}): a synthetic demo authority, not a real stakeholder`));
  checks.push(check('approval_role', rec.signer?.role === DEMO_ROLES[g], rec.signer?.role === DEMO_ROLES[g] ? `signed in the role ${DEMO_ROLES[g]}` : `signed in the role ${rec.signer?.role}; ${g} needs ${DEMO_ROLES[g]}`));
  checks.push(check('approval_not_production', rec.production_authorization === 'NOT_GRANTED', `production_authorization: ${rec.production_authorization}`));
  checks.push({ ...verifyDemoSignature(run.ctx, run.trustStore, rec, DEMO_ROLES[g], run.authority.publicKeyPem, run.now()), id: 'approval_signature' });
  // The same record must never verify against the real trust anchor.
  const real = loadTrustStore(run.ctx, loadPolicy(run.ctx));
  const known = real.usable && real.signers.has(rec.signer?.signer_id);
  checks.push(check('approval_not_in_real_trust_store', !known, known ? 'the demo signer exists in the real trust store' : `the real trust store does not accept it (${real.usable ? 'signer unknown' : 'real trust store not configured'})`));
  return { checks, evidence: [{ path: rel(run, f), sha256: shaFile(f)!, role: `${g} demo approval` }] };
}

/* ------------------------------------------------------------------ */
/* gate evaluators                                                     */
/* ------------------------------------------------------------------ */

interface Outcome {
  checks: Check[];
  evidence: Array<{ path: string; sha256: string; role: string }>;
  details?: Record<string, unknown>;
}

function baselineCheck(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const baseline = loadInput(run, 'baseline', 'demo/baseline', checks);
  if (!baseline) return { checks, evidence: [] };
  const src = path.join(run.inputDir, baseline.source.path);
  const srcSha = shaFile(src);
  checks.push(check('source_present', !!srcSha, srcSha ? `${baseline.source.path} (${fs.statSync(src).size} bytes)` : `${baseline.source.path} is missing`));
  checks.push(check('source_hash', srcSha === baseline.source.sha256 && !!srcSha && fs.statSync(src).size === baseline.source.bytes, srcSha === baseline.source.sha256 ? `SHA-256 ${srcSha} matches the recorded baseline` : `SHA-256 ${srcSha ?? 'none'} does not match the recorded ${baseline.source.sha256}`));
  const bad = (baseline.inputs as any[]).filter((i) => shaFile(path.join(run.inputDir, i.path)) !== i.sha256);
  checks.push(check('required_inputs', !bad.length, bad.length ? `missing or changed: ${bad.map((i) => i.path).join(', ')}` : `${baseline.inputs.length} required inputs present with their recorded SHA-256`));
  const expected = new Set([P.baseline, baseline.source.path, ...baseline.inputs.map((i: any) => i.path), 'README.md']);
  const unexpected = listFiles(run.inputDir).map((f) => inRel(run, f)).filter((f) => !expected.has(f));
  checks.push(check('no_unexpected_files', !unexpected.length, unexpected.length ? `unexpected files in the synthetic inputs: ${unexpected.join(', ')}` : 'the synthetic input tree holds exactly the baselined files'));
  checks.push(check('isolated_output', !inside(run.outDir, run.ctx.runsDir) && !inside(run.outDir, run.inputDir), `demo run directory ${posix(path.relative(run.ctx.repoRoot, run.outDir)) || run.outDir} is outside the real workflow runs and the inputs`));
  return { checks, evidence: [{ path: P.baseline, sha256: shaFile(baselineFile(run))!, role: 'baseline (input)' }, ...(srcSha ? [{ path: baseline.source.path, sha256: srcSha, role: 'synthetic COBOL source (input)' }] : [])], details: { source: { path: baseline.source.path, sha256: srcSha }, inputs: baseline.inputs } };
}

function evidenceCheck(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const baseline = readJson(baselineFile(run));
  const rev = loadInput(run, 'reverse', 'demo/reverse-evidence', checks);
  if (!rev) return { checks, evidence: [] };
  const { prog, error } = parseSource(run, baseline);
  checks.push(check('source_parses', !!prog, prog ? `the COBOL parses deterministically (${prog.program_id}, ${prog.paragraphs.length} paragraphs)` : `parse failed: ${error}`));
  if (!prog) return { checks, evidence: [] };
  const srcSha = shaFile(path.join(run.inputDir, baseline.source.path));
  checks.push(check('file_identity', rev.file.sha256 === srcSha && rev.file.path === baseline.source.path && rev.file.program_id === prog.program_id, `${rev.file.file_id} ${rev.file.path} ${rev.file.program_id}: ${rev.file.sha256 === srcSha ? 'hash matches the source' : `hash ${String(rev.file.sha256).slice(0, 12)}… does not match the source`}`));
  const paraOk = rev.paragraphs.length === prog.paragraphs.length && prog.paragraphs.every((q, i) => rev.paragraphs[i].name === q.name && rev.paragraphs[i].first_line === q.origin.line && rev.paragraphs[i].last_line === q.end.line);
  checks.push(check('paragraphs_match_source', paraOk, paraOk ? `${prog.paragraphs.length} paragraphs match name and line range` : 'paragraph names or line ranges differ from the source'));
  const lines = fs.readFileSync(path.join(run.inputDir, baseline.source.path), 'utf8').replace(/\r\n?/g, '\n').split('\n');
  const parsed = programStatements(prog);
  const parName = new Map<string, string>(rev.paragraphs.map((p: any) => [p.paragraph_id, p.name]));
  const stmtProblems: string[] = [];
  if (parsed.length !== rev.statements.length) stmtProblems.push(`${rev.statements.length} recorded vs ${parsed.length} parsed statements`);
  parsed.forEach((s, i) => {
    const r = rev.statements[i];
    if (!r || r.line !== s.line || parName.get(r.paragraph_id) !== s.paragraph) stmtProblems.push(`statement at line ${s.line}`);
    else if ((lines[s.line - 1] ?? '').trim().split(/\s+/)[0].toUpperCase() !== r.verb) stmtProblems.push(`${r.statement_id}: verb ${r.verb} is not at line ${s.line}`);
  });
  checks.push(check('statements_match_source', !stmtProblems.length, stmtProblems.length ? stmtProblems.slice(0, 5).join('; ') : `${parsed.length} statements match line, paragraph and verb`));
  const items = prog.data.items.filter((it) => it.level !== 1 && !it.filler);
  const fieldProblems = items.filter((it) => !rev.fields.some((f: any) => f.name === it.name && f.offset === it.off && f.length === it.size)).map((it) => it.name);
  if (rev.fields.length !== items.length) fieldProblems.push(`${rev.fields.length} recorded vs ${items.length} parsed fields`);
  checks.push(check('fields_match_source', !fieldProblems.length, fieldProblems.length ? `differ: ${fieldProblems.join(', ')}` : `${items.length} fields match name, offset and length`));
  const all = [rev.file.file_id, rev.file.path_id, ...rev.paragraphs.map((x: any) => x.paragraph_id), ...rev.statements.map((x: any) => x.statement_id), ...rev.records.map((x: any) => x.record_id), ...rev.fields.map((x: any) => x.field_id), ...rev.business_rules.map((x: any) => x.rule_id)];
  checks.push(check('ids_unique', new Set(all).size === all.length, `${all.length} synthetic identities, ${new Set(all).size} distinct`));
  const ids = new Set(all);
  const stmtLine = new Map<string, number>(rev.statements.map((s: any) => [s.statement_id, s.line]));
  const refProblems: string[] = [];
  for (const s of rev.statements) if (!ids.has(s.paragraph_id)) refProblems.push(`${s.statement_id} -> ${s.paragraph_id}`);
  for (const f of rev.fields) if (!ids.has(f.record_id)) refProblems.push(`${f.field_id} -> ${f.record_id}`);
  for (const r of rev.business_rules) {
    for (const x of [r.paragraph_id, ...r.statement_ids, ...r.field_ids]) if (!ids.has(x)) refProblems.push(`${r.rule_id} -> ${x}`);
    const ls = r.statement_ids.map((x: string) => stmtLine.get(x)).sort((a: number, b: number) => a - b);
    if (canonicalize(ls) !== canonicalize([...r.source_lines].sort((a: number, b: number) => a - b))) refProblems.push(`${r.rule_id}: source lines do not match its statements`);
  }
  checks.push(check('references_resolve', !refProblems.length, refProblems.length ? refProblems.slice(0, 5).join('; ') : 'every statement, field and rule reference resolves, and every rule names the lines of its statements'));
  const uncovered = rev.statements.filter((s: any) => !rev.business_rules.some((r: any) => r.statement_ids.includes(s.statement_id)));
  checks.push(check('rules_trace_every_statement', !uncovered.length, uncovered.length ? `statements without a rule: ${uncovered.map((s: any) => s.statement_id).join(', ')}` : `${rev.business_rules.length} rules trace all ${rev.statements.length} statements`));
  return { checks, evidence: [{ path: P.reverse, sha256: shaFile(inp(run, 'reverse'))!, role: 'synthetic reverse evidence (input)' }], details: { paragraphs: rev.paragraphs.length, statements: rev.statements.length, fields: rev.fields.length, business_rules: rev.business_rules.length } };
}

function gateG2(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const rev = readJson(inp(run, 'reverse'));
  const req = loadInput(run, 'requirements', 'demo/requirements', checks);
  const dc = loadInput(run, 'dataContract', 'demo/data-contract', checks);
  if (req && dc) {
    const ruleIds = new Set<string>(rev.business_rules.map((r: any) => r.rule_id));
    const unknown = req.requirements.flatMap((q: any) => q.rule_ids.filter((x: string) => !ruleIds.has(x)).map((x: string) => `${q.requirement_id}->${x}`));
    const uncovered = [...ruleIds].filter((x) => !req.requirements.some((q: any) => q.rule_ids.includes(x)));
    checks.push(check('rules_covered_by_requirements', !unknown.length && !uncovered.length, unknown.length || uncovered.length ? `unknown rule references ${unknown.join(', ') || 'none'}; rules without a requirement ${uncovered.join(', ') || 'none'}` : `all ${ruleIds.size} business rules are covered by ${req.requirements.length} requirements`));
    const reqIds = new Set<string>(req.requirements.map((q: any) => q.requirement_id));
    const badEx = req.examples.flatMap((e: any) => e.requirement_ids.filter((x: string) => !reqIds.has(x)).map((x: string) => `${e.id}->${x}`));
    const noEx = req.requirements.filter((q: any) => q.kind !== 'initialization' && !req.examples.some((e: any) => e.requirement_ids.includes(q.requirement_id))).map((q: any) => q.requirement_id);
    checks.push(check('worked_examples', !badEx.length && !noEx.length, badEx.length || noEx.length ? `unknown example references ${badEx.join(', ') || 'none'}; requirements without an example ${noEx.join(', ') || 'none'}` : `${req.examples.length} worked examples cover every calculation and validation requirement`));
    const open = req.uncertainties.filter((u: any) => u.status === 'OPEN' && u.blocking);
    checks.push(check('uncertainties_documented', req.uncertainties.length > 0 && !open.length, open.length ? `blocking open uncertainties: ${open.map((u: any) => u.id).join(', ')}` : `${req.uncertainties.length} uncertainties documented (${req.uncertainties.filter((u: any) => u.status === 'RESOLVED').length} resolved, ${req.uncertainties.filter((u: any) => u.status === 'ACCEPTED_LIMITATION').length} accepted limitation), none blocking`));
    const { prog } = parseSource(run, readJson(baselineFile(run)));
    const linkage = prog?.data.records.find((r) => r.section === 'LINKAGE') ?? null;
    const lfields = prog ? prog.data.items.filter((it) => it.record.name === linkage?.name && it.level !== 1 && it.kind !== 'GROUP') : [];
    const mism = lfields.filter((it) => !dc.fields.some((f: any) => f.name === it.name && f.offset === it.off && f.length === it.size)).map((it) => it.name);
    const extra = dc.fields.filter((f: any) => !lfields.some((it) => it.name === f.name)).map((f: any) => f.name);
    checks.push(check('data_contract_matches_source', !!linkage && dc.record.length === linkage.size && dc.record.name === linkage.name && !mism.length && !extra.length, linkage ? `${dc.record.name} ${dc.record.length} bytes vs parsed ${linkage.name} ${linkage.size} bytes; ${lfields.length} interface fields${mism.length || extra.length ? `; differ: ${[...mism, ...extra].join(', ')}` : ' match name, offset and length'}` : 'no LINKAGE record in the source'));
  }
  const a = verifyApproval(run, 'G2');
  checks.push(...a.checks);
  return { checks, evidence: [{ path: P.requirements, sha256: shaFile(inp(run, 'requirements')) ?? '0'.repeat(64), role: 'requirements (input)' }, { path: P.dataContract, sha256: shaFile(inp(run, 'dataContract')) ?? '0'.repeat(64), role: 'data contract (input)' }, ...a.evidence], details: req ? { requirements: req.requirements.length, examples: req.examples.length, uncertainties: req.uncertainties.length } : {} };
}

function gateG3(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const arch = loadInput(run, 'architecture', 'demo/architecture', checks);
  const req = readJson(inp(run, 'requirements'));
  if (arch) {
    checks.push(check('references_accepted_requirements', arch.requirements_ref.sha256 === shaFile(inp(run, 'requirements')) && arch.data_contract_ref.sha256 === shaFile(inp(run, 'dataContract')), `requirements ${arch.requirements_ref.sha256.slice(0, 12)}…, data contract ${arch.data_contract_ref.sha256.slice(0, 12)}… (must equal the G2-approved content)`));
    const reqIds = new Set<string>(req.requirements.map((q: any) => q.requirement_id));
    const unmapped = [...reqIds].filter((r) => !arch.components.some((c: any) => c.requirement_ids.includes(r)));
    const unknown = arch.components.flatMap((c: any) => c.requirement_ids).concat(arch.decisions.flatMap((d: any) => d.requirement_ids)).filter((r: string) => !reqIds.has(r));
    checks.push(check('requirements_allocated', !unmapped.length && !unknown.length, unmapped.length || unknown.length ? `unallocated ${unmapped.join(', ') || 'none'}; unknown ${unknown.join(', ') || 'none'}` : `every requirement is allocated to a component`));
    const comps = new Set<string>(arch.components.map((c: any) => c.component_id));
    const badDeps = arch.dependencies.filter((d: any) => !comps.has(d.from) || !comps.has(d.to));
    checks.push(check('dependencies_documented', arch.dependencies.length > 0 && !badDeps.length, badDeps.length ? `dependencies naming unknown components: ${badDeps.map((d: any) => `${d.from}->${d.to}`).join(', ')}` : `${arch.dependencies.length} component dependencies, all resolvable`));
    checks.push(check('decisions_documented', arch.decisions.length > 0 && arch.decisions.every((d: any) => d.requirement_ids.length > 0), `${arch.decisions.length} architecture decisions, each tied to requirements`));
  }
  const a = verifyApproval(run, 'G3');
  checks.push(...a.checks);
  return { checks, evidence: [{ path: P.architecture, sha256: shaFile(inp(run, 'architecture')) ?? '0'.repeat(64), role: 'architecture (input)' }, ...a.evidence], details: arch ? { components: arch.components.length, decisions: arch.decisions.length } : {} };
}

function storyValidation(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const plan = loadInput(run, 'plan', 'demo/development-plan', checks);
  const req = readJson(inp(run, 'requirements'));
  const arch = readJson(inp(run, 'architecture'));
  if (plan) {
    checks.push(check('references_approved_design', plan.requirements_ref.sha256 === shaFile(inp(run, 'requirements')) && plan.architecture_ref.sha256 === shaFile(inp(run, 'architecture')), `requirements ${plan.requirements_ref.sha256.slice(0, 12)}…, architecture ${plan.architecture_ref.sha256.slice(0, 12)}…`));
    const reqIds = new Set<string>(req.requirements.map((q: any) => q.requirement_id));
    const comps = new Set<string>(arch.components.map((c: any) => c.component_id));
    const uncovered = [...reqIds].filter((r) => !plan.stories.some((s: any) => s.requirement_ids.includes(r)));
    const unknown = plan.stories.flatMap((s: any) => [...s.requirement_ids.filter((r: string) => !reqIds.has(r)), ...s.component_ids.filter((c: string) => !comps.has(c))]);
    checks.push(check('stories_trace_requirements', !uncovered.length && !unknown.length, uncovered.length || unknown.length ? `requirements without a story ${uncovered.join(', ') || 'none'}; unknown references ${unknown.join(', ') || 'none'}` : `${plan.stories.length} stories cover all ${reqIds.size} requirements`));
    checks.push(check('acceptance_criteria', plan.stories.every((s: any) => s.acceptance_criteria.length > 0 && s.tasks.length > 0), `${plan.stories.reduce((n: number, s: any) => n + s.acceptance_criteria.length, 0)} acceptance criteria and ${plan.stories.reduce((n: number, s: any) => n + s.tasks.length, 0)} tasks`));
    const inEpic = new Set<string>(plan.epics.flatMap((e: any) => e.story_ids));
    const storyIds = new Set<string>(plan.stories.map((s: any) => s.story_id));
    checks.push(check('epics_consistent', [...storyIds].every((s) => inEpic.has(s)) && [...inEpic].every((s) => storyIds.has(s)), `${plan.epics.length} epic(s) hold exactly the ${storyIds.size} stories`));
    checks.push(check('not_generation_authorisation', plan.java_generation_authorization === 'NOT_GRANTED' && run.ctx.config.generation.java_generation_allowed === false, `plan: java_generation_authorization ${plan.java_generation_authorization}; real configuration generation.java_generation_allowed is ${run.ctx.config.generation.java_generation_allowed} (unchanged)`));
  }
  return { checks, evidence: [{ path: P.plan, sha256: shaFile(inp(run, 'plan')) ?? '0'.repeat(64), role: 'development plan (input)' }], details: plan ? { stories: plan.stories.length, java_generation_authorization: plan.java_generation_authorization } : {} };
}

/**
 * Where the BUILD step writes the generated Java and classes. Inside the repository, synthetic Java follows the
 * existing rule for synthetic conversions: it lives only under the git-ignored pilot sandbox
 * forward/pilot/<name>/out/java/ (excluded from backups as reproducible), never beside real evidence.
 * A run directory outside the repository (tests, CI) keeps it inside the run directory.
 */
export function javaWorkspace(run: DemoRun): string {
  return inside(run.outDir, run.ctx.repoRoot) ? path.join(run.ctx.forwardDir, 'pilot', 'demo-gates', 'out', 'java', run.id) : path.join(run.outDir, 'build', 'java');
}

function runTestMain(run: DemoRun, classes: string, cls: string, fixtures: string): { exit: number | null; cases: Array<{ id: string; status: string; detail: string }>; summary: string | null; stderr: string[] } {
  const x = spawnSync(run.tc.java.java!, ['-cp', classes, 'revforge.cobol.testing.TestMain', cls, fixtures], { encoding: 'latin1', timeout: 600000 });
  const out = (x.stdout ?? '').split(/\r?\n/);
  return {
    exit: x.status,
    cases: out.filter((l) => l.startsWith('CASE|')).map((l) => {
      const [, id, status, , detail] = l.split('|');
      return { id, status, detail: detail ?? '' };
    }),
    summary: out.find((l) => l.startsWith('SUMMARY|')) ?? null,
    stderr: (x.stderr ?? '').trim().split(/\r?\n/).filter(Boolean).slice(0, 20),
  };
}

function buildAndTest(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const evidence: Outcome['evidence'] = [];
  const baseline = readJson(baselineFile(run));
  const rev = readJson(inp(run, 'reverse'));
  const req = readJson(inp(run, 'requirements'));
  const tc = run.tc;
  const jv = tc.java.version ?? '';
  checks.push(check('java_21_toolchain', tc.java.available && /\b21(\.|\b)/.test(jv), tc.java.available ? `${jv} (${tc.java.source})` : 'JAVA_TOOLCHAIN_UNAVAILABLE: no javac via REVFORGE_JAVA_HOME, JAVA_HOME or PATH; nothing compiled'));
  const { prog, error, file } = parseSource(run, baseline);
  checks.push(check('converter_inspection', !!prog, prog ? `the local converter parsed ${prog.program_id}` : `the converter refused the source: ${error}`));
  if (!prog || !tc.java.available) return { checks, evidence };
  const lines = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').split('\n');
  const em = emitApp(prog, { available: new Set([prog.program_id]), lineText: (_f, l) => (lines[l - 1] ?? '').replace(/\s+$/, '') });
  const g5dir = path.join(run.outDir, 'build');
  const javaDir = javaWorkspace(run);
  const srcDir = path.join(javaDir, 'src');
  for (const [r, text] of Object.entries(em.files)) {
    fs.mkdirSync(path.dirname(path.join(srcDir, r)), { recursive: true });
    fs.writeFileSync(path.join(srcDir, r), text);
  }
  const emitted = Object.keys(em.files).sort().map((r) => ({ path: rel(run, path.join(srcDir, r)), sha256: sha(em.files[r]) }));
  const converterModules = ['cobol-app', 'java-app'].map((m) => {
    const ts = path.join(run.ctx.forwardDir, 'runtime', 'src', 'pilot', `${m}.ts`);
    const js = require.resolve(`../pilot/${m}`);
    const f = fs.existsSync(ts) ? ts : js;
    return { path: posix(path.relative(run.ctx.repoRoot, f)), sha256: shaFile(f)! };
  });
  const generation = { implementer: IMPLEMENTER, converter: 'REVFORGE local deterministic converter (STEP-17 parseApp/emitApp); no AI agent', converter_modules: converterModules, input: { path: baseline.source.path, sha256: shaFile(file) }, files: emitted, gaps: em.gaps.length, provenance_note: 'Generated by the existing converter; no Java was written by hand.' };
  evidence.push({ path: 'build/generation.json', sha256: writeJson(path.join(g5dir, 'generation.json'), generation), role: 'generation provenance' });
  evidence.push({ path: 'build/source-map.json', sha256: writeJson(path.join(g5dir, 'source-map.json'), em.source_map), role: 'COBOL-to-Java source map' });
  run.hooks.afterGeneration?.(srcDir);
  checks.push(check('no_open_gaps', em.gaps.length === 0, em.gaps.length ? `${em.gaps.length} gap(s): ${em.gaps.map((g) => `${g.gap_id} ${g.kind}`).join(', ')}` : 'the converter translated every statement without a gap placeholder'));
  // Statement-level traceability: every synthetic statement ID maps to a Java line.
  const trace = rev.statements.map((s: any) => {
    const m = em.source_map.statements.filter((x) => x.cobol_line === s.line);
    return { statement_id: s.statement_id, cobol_line: s.line, verb: s.verb, java: m.map((x) => ({ file: x.java_file, line: x.java_line, kind: x.kind })) };
  });
  const untraced = trace.filter((t: any) => !t.java.length);
  evidence.push({ path: 'build/traceability.json', sha256: writeJson(path.join(g5dir, 'traceability.json'), { environment: DEMO_ENV, statements: trace }), role: 'statement traceability' });
  checks.push(check('source_to_java_traceability', !untraced.length, untraced.length ? `statements without Java: ${untraced.map((t: any) => t.statement_id).join(', ')}` : `all ${trace.length} synthetic statement IDs map to Java lines`));
  // Compilation with the tracked hand-written runtime library.
  const runtimeFiles = listJava(RUNTIME_DIR(run.ctx.forwardDir)).sort();
  const genFiles = listJava(srcDir).sort();
  const compiled = genFiles.map((f) => ({ path: rel(run, f), sha256: shaFile(f)! }));
  const classes = path.join(javaDir, 'classes');
  fs.mkdirSync(classes, { recursive: true });
  const argFile = path.join(javaDir, 'javac-args.txt');
  fs.writeFileSync(argFile, [...runtimeFiles, ...genFiles].map((f) => `"${f.replace(/\\/g, '/')}"`).join('\n'));
  const args = ['-encoding', 'UTF-8', '-Xlint:all', '-Werror', '-d', classes, `@${argFile}`];
  const cc = spawnSync(tc.java.javac!, args, { encoding: 'utf8', timeout: 600000 });
  const build = { command: `javac -encoding UTF-8 -Xlint:all -Werror -d ${rel(run, classes)} @javac-args.txt (${runtimeFiles.length} runtime + ${genFiles.length} generated files)`, javac: jv, exit_code: cc.status, diagnostics: `${cc.stdout ?? ''}${cc.stderr ?? ''}`.trim().split(/\r?\n/).filter(Boolean).slice(0, 40), compiled_sources: compiled, emitted_sources: emitted, sources_modified_after_generation: canonicalize(compiled.map((c) => c.sha256)) !== canonicalize(emitted.map((e) => e.sha256)) };
  const classFiles = listFiles(classes).filter((f) => f.endsWith('.class'));
  const classesSha = sha(classFiles.sort().map((f) => `${rel(run, f)}|${shaFile(f)}`).join('\n'));
  evidence.push({ path: 'build/build.json', sha256: writeJson(path.join(g5dir, 'build.json'), { ...build, class_files: classFiles.length, classes_sha256: classesSha }), role: 'build record' });
  checks.push(check('compiled', cc.status === 0 && classFiles.length > 0, cc.status === 0 ? `javac exit 0 (-Werror), ${classFiles.length} class files` : `javac exit ${cc.status}: ${build.diagnostics.slice(0, 3).join(' | ')}`));
  if (cc.status !== 0) return { checks, evidence, details: { build } };
  // Functional and boundary scenarios (hand-written from the requirements).
  const fx = readJson(inp(run, 'functional'));
  const t = runTestMain(run, classes, `${em.pkg}.${em.cls}`, inp(run, 'functional'));
  evidence.push({ path: 'build/functional-results.json', sha256: writeJson(path.join(g5dir, 'functional-results.json'), { environment: DEMO_ENV, command: `java -cp ${rel(run, classes)} revforge.cobol.testing.TestMain ${em.pkg}.${em.cls} ${P.functional}`, exit_code: t.exit, summary: t.summary, cases: t.cases, stderr: t.stderr }), role: 'functional test results' });
  checks.push(check('test_harness_completed', t.exit === 0 && !!t.summary, `TestMain exit ${t.exit}; ${t.summary ?? 'no SUMMARY line'}`));
  const generated = t.cases.filter((c) => /^(INIT|C88) /.test(c.id));
  checks.push(check('generated_checks', generated.length > 0 && generated.every((c) => c.status === 'PASS'), `${generated.filter((c) => c.status === 'PASS').length}/${generated.length} VALUE-clause and level-88 checks passed`));
  const byId = new Map(t.cases.map((c) => [c.id, c]));
  const scen = fx.scenarios as any[];
  const failed = scen.filter((s) => byId.get(s.id)?.status !== 'PASS');
  checks.push(check('functional_tests', !failed.length, failed.length ? `${failed.length} of ${scen.length} failed: ${failed.slice(0, 3).map((s) => `${s.id} ${byId.get(s.id)?.detail ?? 'not run'}`).join(' | ')}` : `${scen.length}/${scen.length} functional scenarios passed`));
  const boundary = scen.filter((s) => s.boundary);
  checks.push(check('boundary_tests', boundary.length > 0 && boundary.every((s) => byId.get(s.id)?.status === 'PASS'), `${boundary.filter((s) => byId.get(s.id)?.status === 'PASS').length}/${boundary.length} boundary scenarios passed`));
  const noTest = req.requirements.filter((q: any) => !scen.some((s) => s.requirement_ids.includes(q.requirement_id) && byId.get(s.id)?.status === 'PASS')).map((q: any) => q.requirement_id);
  checks.push(check('requirements_tested', !noTest.length, noTest.length ? `requirements without a passing scenario: ${noTest.join(', ')}` : `every requirement has at least one passing scenario`));
  return { checks, evidence, details: { build: { exit_code: cc.status, javac: jv, class_files: classFiles.length, classes_sha256: classesSha }, java: { package: em.pkg, class: em.cls, classes_dir: rel(run, classes) }, tests: { scenarios: scen.length, passed: scen.length - failed.length, boundary: boundary.length, generated_checks: generated.length }, sources_modified_after_generation: build.sources_modified_after_generation } };
}

function fixtureFor(c: OracleCase): any {
  const set: Record<string, string> = { 'LS-TIER': c.order.tier, 'LS-LINE-COUNT': String(c.order.line_count) };
  for (let i = 0; i < 5; i++) {
    const [q, u] = c.order.lines[i] ?? [1, 0];
    set[`LS-QTY(${i + 1})`] = String(q);
    set[`LS-UNIT-CENTS(${i + 1})`] = String(u);
  }
  Object.assign(set, { 'LS-SUBTOTAL-CENTS': String(c.preset.subtotal), 'LS-DISCOUNT-CENTS': String(c.preset.discount), 'LS-SHIPPING-CENTS': String(c.preset.shipping), 'LS-TOTAL-CENTS': String(c.preset.total), 'LS-RETURN-CODE': String(c.preset.return_code) });
  const e = c.expected;
  return { id: c.id, title: c.title, kind: 'call', set, expect: { outcome: 'GOBACK', items: { 'LS-SUBTOTAL-CENTS': String(e.subtotal), 'LS-DISCOUNT-CENTS': String(e.discount), 'LS-SHIPPING-CENTS': String(e.shipping), 'LS-TOTAL-CENTS': String(e.total), 'LS-RETURN-CODE': String(e.return_code) } } };
}

function independentVerification(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const evidence: Outcome['evidence'] = [];
  const req = readJson(inp(run, 'requirements'));
  const g5r = readJson(resultFile(run, 'BUILD'));
  const g6dir = path.join(run.outDir, 'verify');
  // Independence: the compiled oracle module loads nothing (no converter, Java runtime or process launcher).
  const oracleJs = require.resolve('./oracle');
  const code = fs.readFileSync(oracleJs, 'utf8');
  const imports = [...code.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2]);
  checks.push(check('oracle_independent', !imports.length, imports.length ? `the oracle module loads ${imports.join(', ')}` : `the oracle module (${path.basename(oracleJs)}, sha256 ${sha(code).slice(0, 12)}…) loads no other module: it cannot call the converter, the Java or the runtime`));
  const exProblems = req.examples.filter((e: any) => canonicalize(expectedResult(e.order as DemoOrder)) !== canonicalize(e.expected)).map((e: any) => `${e.id}: oracle ${canonicalize(expectedResult(e.order))} vs requirement ${canonicalize(e.expected)}`);
  checks.push(check('oracle_matches_requirement_examples', !exProblems.length, exProblems.length ? exProblems.slice(0, 3).join(' | ') : `the oracle reproduces all ${req.examples.length} worked examples of the requirements`));
  // The Java under test is exactly the build the BUILD step verified.
  const classesDir = path.join(run.outDir, g5r.details.java.classes_dir);
  const classFiles = listFiles(classesDir).filter((f) => f.endsWith('.class'));
  const classesSha = sha(classFiles.sort().map((f) => `${rel(run, f)}|${shaFile(f)}`).join('\n'));
  checks.push(check('java_is_verified_build', classesSha === g5r.details.build.classes_sha256, classesSha === g5r.details.build.classes_sha256 ? `${classFiles.length} class files unchanged since BUILD` : 'the compiled classes changed after BUILD'));
  const cases = generateCases(ORACLE_SEED, ORACLE_SEEDED_CASES, req.examples);
  evidence.push({ path: 'verify/oracle-cases.json', sha256: writeJson(path.join(g6dir, 'oracle-cases.json'), { environment: DEMO_ENV, seed: ORACLE_SEED, note: 'Inputs and expected results computed by the independent oracle before the Java was run.', cases }), role: 'oracle cases and expectations' });
  const fxFile = path.join(g6dir, 'oracle-fixture.json');
  evidence.push({ path: 'verify/oracle-fixture.json', sha256: writeJson(fxFile, { program: 'DEMOORD1', provenance: 'generated from verify/oracle-cases.json', scenarios: cases.map(fixtureFor) }), role: 'oracle fixture for TestMain' });
  const t = runTestMain(run, classesDir, `${g5r.details.java.package}.${g5r.details.java.class}`, fxFile);
  const byId = new Map(t.cases.map((c) => [c.id, c]));
  const results = cases.map((c) => ({ id: c.id, category: c.category, status: byId.get(c.id)?.status ?? 'NOT_RUN', detail: byId.get(c.id)?.detail ?? '' }));
  evidence.push({ path: 'verify/comparison-results.json', sha256: writeJson(path.join(g6dir, 'comparison-results.json'), { environment: DEMO_ENV, exit_code: t.exit, summary: t.summary, results }), role: 'Java vs oracle comparison' });
  checks.push(check('comparison_executed', t.exit === 0 && !!t.summary && results.every((r) => r.status !== 'NOT_RUN'), `TestMain exit ${t.exit}; ${t.summary ?? 'no SUMMARY'}; ${results.length} cases run`));
  const mism = results.filter((r) => r.status !== 'PASS');
  checks.push(check('java_matches_oracle', !mism.length, mism.length ? `${mism.length} of ${results.length} cases differ: ${mism.slice(0, 3).map((m) => `${m.id} (${cases.find((c) => c.id === m.id)?.title}): ${m.detail}`).join(' | ')}` : `all ${results.length} cases match the oracle`));
  const count = (k: string) => results.filter((r) => r.category === k);
  for (const k of ['boundary', 'negative']) {
    const xs = count(k);
    checks.push(check(`${k}_cases`, xs.length >= 10 && xs.every((r) => r.status === 'PASS'), `${xs.filter((r) => r.status === 'PASS').length}/${xs.length} ${k} cases match`));
  }
  const noCase = req.requirements.filter((q: any) => !cases.some((c) => c.requirement_ids.includes(q.requirement_id))).map((q: any) => q.requirement_id);
  checks.push(check('requirements_exercised', !noCase.length, noCase.length ? `requirements no oracle case exercises: ${noCase.join(', ')}` : `every requirement is exercised by oracle cases (outputs preset with caller garbage in every case)`));
  return {
    checks,
    evidence,
    details: {
      cases: { total: results.length, boundary: count('boundary').length, negative: count('negative').length, seeded: count('seeded').length, example: count('example').length, matched: results.length - mism.length, seed: ORACLE_SEED },
      establishes: 'The generated Java returns the same subtotal, discount, shipping, total and return code as an independent oracle written from the requirements, on every listed input (boundary, negative, seeded random and worked examples).',
      does_not_establish: 'Equivalence with an executed COBOL program: no COBOL runtime was executed in this demonstration, so legacy behavioural equivalence is NOT_ESTABLISHED.',
      cobol_reference: 'NOT_EXECUTED',
    },
  };
}

function independentReview(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const findings: Array<{ id: string; severity: 'critical' | 'major' | 'minor' | 'info'; blocking: boolean; detail: string }> = [];
  const finding = (c: Check, severity: 'critical' | 'major' = 'critical') => {
    checks.push(c);
    if (!c.ok) findings.push({ id: `RF-${String(findings.length + 1).padStart(2, '0')}`, severity, blocking: true, detail: `${c.id}: ${c.detail}` });
  };
  const state = readState(run).steps;
  const results: Record<string, any> = {};
  const earlier = DEMO_STEPS.slice(0, DEMO_STEPS.indexOf('REVIEW'));
  for (const g of earlier) results[g] = fs.existsSync(resultFile(run, g)) ? readJson(resultFile(run, g)) : null;
  // 1. Step results and evidence integrity.
  const changedResults = earlier.filter((g) => shaFile(resultFile(run, g)) !== state[g]?.result_sha256);
  finding(check('step_results_intact', !changedResults.length, changedResults.length ? `changed or missing results: ${changedResults.join(', ')}` : `${earlier.join(', ')} result files match their recorded SHA-256`));
  const evid = earlier.flatMap((g) => (results[g]?.evidence ?? []).map((e: any) => ({ g, ...e })));
  const changedEvidence = evid.filter((e: any) => {
    const base = /\(input\)$/.test(e.role) ? run.inputDir : run.outDir;
    return shaFile(path.join(base, e.path)) !== e.sha256;
  });
  finding(check('test_evidence_integrity', !changedEvidence.length, changedEvidence.length ? `evidence changed after it was recorded: ${changedEvidence.map((e: any) => `${e.g}:${e.path}`).join(', ')}` : `${evid.length} evidence files re-hashed, all unchanged`));
  // 2. Requirements coverage and traceability.
  const req = readJson(inp(run, 'requirements'));
  const plan = readJson(inp(run, 'plan'));
  const rev = readJson(inp(run, 'reverse'));
  const fx = readJson(inp(run, 'functional'));
  const fr = fs.existsSync(path.join(run.outDir, 'build', 'functional-results.json')) ? readJson(path.join(run.outDir, 'build', 'functional-results.json')) : { cases: [] };
  const cr = fs.existsSync(path.join(run.outDir, 'verify', 'comparison-results.json')) ? readJson(path.join(run.outDir, 'verify', 'comparison-results.json')) : { results: [] };
  const oc = fs.existsSync(path.join(run.outDir, 'verify', 'oracle-cases.json')) ? readJson(path.join(run.outDir, 'verify', 'oracle-cases.json')) : { cases: [] };
  const passF = new Set<string>(fr.cases.filter((c: any) => c.status === 'PASS').map((c: any) => c.id));
  const passO = new Set<string>(cr.results.filter((c: any) => c.status === 'PASS').map((c: any) => c.id));
  const coverage = req.requirements.map((q: any) => ({
    requirement_id: q.requirement_id,
    rules: q.rule_ids,
    stories: plan.stories.filter((s: any) => s.requirement_ids.includes(q.requirement_id)).map((s: any) => s.story_id),
    functional_tests: fx.scenarios.filter((s: any) => s.requirement_ids.includes(q.requirement_id) && passF.has(s.id)).map((s: any) => s.id),
    oracle_cases: oc.cases.filter((c: any) => c.requirement_ids.includes(q.requirement_id) && passO.has(c.id)).length,
  }));
  const gaps = coverage.filter((c: any) => !c.stories.length || !c.functional_tests.length || !c.oracle_cases);
  finding(check('requirements_coverage', !gaps.length, gaps.length ? `incompletely verified: ${gaps.map((c: any) => c.requirement_id).join(', ')}` : `each of ${coverage.length} requirements has a story, passing functional tests and matching oracle cases`));
  const trace = fs.existsSync(path.join(run.outDir, 'build', 'traceability.json')) ? readJson(path.join(run.outDir, 'build', 'traceability.json')).statements : [];
  const javaFor = new Set<string>(trace.filter((t: any) => t.java.length).map((t: any) => t.statement_id));
  const brokenChains = rev.business_rules.filter((r: any) => !r.statement_ids.every((s: string) => javaFor.has(s)) || !req.requirements.some((q: any) => q.rule_ids.includes(r.rule_id))).map((r: any) => r.rule_id);
  finding(check('traceability_complete', !brokenChains.length && trace.length === rev.statements.length, brokenChains.length ? `broken rule chains: ${brokenChains.join(', ')}` : `every rule traces rule -> requirement -> story -> Java statements -> passing tests`));
  // 3. Build evidence and unexplained behaviour.
  const build = fs.existsSync(path.join(run.outDir, 'build', 'build.json')) ? readJson(path.join(run.outDir, 'build', 'build.json')) : null;
  finding(check('build_evidence', !!build && build.exit_code === 0 && build.class_files > 0, build ? `javac exit ${build.exit_code}, ${build.class_files} class files, ${build.javac}` : 'no build record'));
  const now = (build?.compiled_sources ?? []).map((c: any) => ({ ...c, now: shaFile(path.join(run.outDir, c.path)) }));
  const edited = build ? build.sources_modified_after_generation || now.some((c: any) => c.now !== c.sha256) : true;
  finding(check('no_unexplained_behaviour', !edited && results.BUILD?.details?.sources_modified_after_generation === false, edited ? 'the compiled Java differs from what the converter emitted (an unexplained manual change)' : 'the Java that was built and tested is exactly the converter output; every Java statement maps to a COBOL line'));
  const sm = fs.existsSync(path.join(run.outDir, 'build', 'source-map.json')) ? readJson(path.join(run.outDir, 'build', 'source-map.json')) : { statements: [], gaps: [] };
  const knownLines = new Set<number>(rev.statements.map((s: any) => s.line));
  const strays = sm.statements.filter((m: any) => !knownLines.has(m.cobol_line));
  finding(check('no_fabricated_behaviour', !strays.length && !(sm.gaps ?? []).length, strays.length ? `Java statements mapped to no synthetic COBOL statement: ${strays.length}` : `${sm.statements.length} Java statement mappings all point to recorded COBOL statements; no gap placeholders`));
  // 4. No forbidden modifications.
  const baseline = readJson(baselineFile(run));
  const inputsNow = (baseline.inputs as any[]).every((i) => shaFile(path.join(run.inputDir, i.path)) === i.sha256) && shaFile(path.join(run.inputDir, baseline.source.path)) === baseline.source.sha256;
  finding(check('inputs_unchanged', inputsNow && treeFingerprint(run.inputDir) === run.snapshots.inputs, inputsNow ? 'synthetic source and inputs still match the baseline; no file was added or changed' : 'the synthetic source or inputs changed during the run'));
  const cfg = readJson(run.ctx.configPath);
  finding(check('real_configuration_unchanged', shaFile(run.ctx.configPath) === run.snapshots.config && cfg.generation?.java_generation_allowed === false && cfg.bmad_governance?.mandatory === true, `forward.config.json ${shaFile(run.ctx.configPath) === run.snapshots.config ? 'unchanged' : 'CHANGED'}; generation.java_generation_allowed ${cfg.generation?.java_generation_allowed}; bmad_governance.mandatory ${cfg.bmad_governance?.mandatory}`));
  finding(check('real_records_untouched', treeFingerprint(run.ctx.runsDir) === run.snapshots.runs && treeFingerprint(path.join(run.ctx.repoRoot, 'output')) === run.snapshots.reverse, 'the real workflow runs and the reverse-engineering artifacts were not modified by this run'));
  // 5. Separation of responsibilities.
  const approvers = DEMO_GATES.map((g) => (fs.existsSync(approvalFile(run, g)) ? readJson(approvalFile(run, g)).signer?.signer_id : null));
  const separated = REVIEWER !== IMPLEMENTER && approvers.every((a) => a && a !== IMPLEMENTER && a !== REVIEWER) && !/oracle/i.test(IMPLEMENTER);
  finding(check('separation_of_duties', separated, `implementer ${IMPLEMENTER}; test authors: hand-written fixtures (BUILD) and the independent oracle (VERIFY); reviewer ${REVIEWER}; approver ${approvers[0] ?? 'none'}`), 'major');
  const reviewFile = path.join(run.outDir, 'steps', 'REVIEW.review.json');
  const review = { contract: 'demo/review', environment: DEMO_ENV, demo_run_id: run.id, reviewer: REVIEWER, implementer: IMPLEMENTER, reviewed_at: run.now().toISOString(), coverage, findings, decision: findings.some((f) => f.blocking) ? 'FAIL' : 'PASS', production_authorization: 'NOT_GRANTED' };
  const reviewSha = writeJson(reviewFile, review);
  return { checks, evidence: [{ path: rel(run, reviewFile), sha256: reviewSha, role: 'structured review result' }], details: { findings: findings.length, blocking_findings: findings.filter((f) => f.blocking).length, decision: review.decision } };
}

function completion(run: DemoRun): Outcome {
  const checks: Check[] = [];
  const earlier = DEMO_STEPS.slice(0, DEMO_STEPS.indexOf('COMPLETE'));
  const prior = earlier.map((g) => ({ g, ...stepPassed(run, g) }));
  checks.push(check('earlier_steps_passed', prior.every((p) => p.ok), prior.every((p) => p.ok) ? `${earlier.join(', ')} all PASS for this demo baseline` : prior.filter((p) => !p.ok).map((p) => p.detail).join('; ')));
  const ev = earlier.flatMap((g) => (fs.existsSync(resultFile(run, g)) ? readJson(resultFile(run, g)).evidence ?? [] : []));
  const bad: string[] = ev.filter((e: any) => shaFile(path.join(/\(input\)$/.test(e.role) ? run.inputDir : run.outDir, e.path)) !== e.sha256).map((e: any) => e.path);
  // Also the artifacts the evidence describes: every baselined input, the Java that was built and its classes.
  const baseline = readJson(baselineFile(run));
  for (const i of [baseline.source, ...baseline.inputs]) if (shaFile(path.join(run.inputDir, i.path)) !== i.sha256) bad.push(i.path);
  const buildFile = path.join(run.outDir, 'build', 'build.json');
  const build = fs.existsSync(buildFile) ? readJson(buildFile) : null;
  for (const c of build?.compiled_sources ?? []) if (shaFile(path.join(run.outDir, c.path)) !== c.sha256) bad.push(c.path);
  const g5d = fs.existsSync(resultFile(run, 'BUILD')) ? readJson(resultFile(run, 'BUILD')).details : null;
  if (g5d?.java) {
    const cdir = path.join(run.outDir, g5d.java.classes_dir);
    if (sha(listFiles(cdir).filter((f) => f.endsWith('.class')).sort().map((f) => `${rel(run, f)}|${shaFile(f)}`).join('\n')) !== g5d.build.classes_sha256) bad.push(`${g5d.java.classes_dir} (class files)`);
  }
  const artifacts = 1 + baseline.inputs.length + (build?.compiled_sources?.length ?? 0) + (g5d?.java ? 1 : 0);
  checks.push(check('evidence_complete', ev.length > 0 && !!build && !bad.length, bad.length ? `missing or changed evidence: ${bad.join(', ')}` : `${ev.length} evidence files and ${artifacts} inputs, Java sources and class sets present and unchanged`));
  const reviewFile = path.join(run.outDir, 'steps', 'REVIEW.review.json');
  const review = fs.existsSync(reviewFile) ? readJson(reviewFile) : null;
  const critical = (review?.findings ?? []).filter((f: any) => f.blocking || f.severity === 'critical');
  const approvals = fs.existsSync(path.join(run.outDir, 'approvals')) ? fs.readdirSync(path.join(run.outDir, 'approvals')).sort() : [];
  checks.push(check('approvals_g2_g3_only', approvals.join() === 'G2.approval.json,G3.approval.json', `signed demo approvals: ${approvals.join(', ') || 'none'} (the only human gates are G2 and G3; completion needs no human acceptance)`));
  const granted = ev.length === 0 || [...earlier.map((g) => (fs.existsSync(resultFile(run, g)) ? readJson(resultFile(run, g)).production_authorization : null)), review?.production_authorization].some((x) => x !== 'NOT_GRANTED');
  checks.push(check('production_not_granted', !granted, granted ? 'a step result or the review grants or omits production_authorization' : 'every step result and the review say production_authorization NOT_GRANTED'));
  checks.push(check('no_unresolved_critical_findings', !!review && review.decision === 'PASS' && !critical.length, review ? `review decision ${review.decision}; ${critical.length} unresolved critical finding(s)` : 'no review result'));
  const ok = checks.every((c) => c.ok);
  return { checks, evidence: review ? [{ path: rel(run, reviewFile), sha256: shaFile(reviewFile)!, role: 'structured review result' }] : [], details: { completion: ok ? 'SYNTHETIC_DEMO_COMPLETED' : 'NOT_COMPLETED', meaning: 'Completed automatically after the independent review of the synthetic example. Not business-owner, production or real-project acceptance.' } };
}

const EVALUATORS: Record<DemoStepId, (run: DemoRun) => Outcome> = { BASELINE: baselineCheck, EVIDENCE: evidenceCheck, G2: gateG2, G3: gateG3, STORIES: storyValidation, BUILD: buildAndTest, VERIFY: independentVerification, REVIEW: independentReview, COMPLETE: completion };

/** Evaluates one demo step (BLOCKED unless its prerequisite has a verified PASS) and persists the result. */
export function evaluateDemoStep(run: DemoRun, step: DemoStepId): any {
  const spec = STEP_SPECS[step];
  const at = run.now().toISOString();
  let status: DemoStatus;
  let outcome: Outcome;
  let reason: string;
  const pre = spec.prerequisite ? stepPassed(run, spec.prerequisite) : { ok: true, detail: 'no prerequisite' };
  if (!pre.ok) {
    status = 'BLOCKED';
    outcome = { checks: [check('prerequisite', false, pre.detail)], evidence: [] };
    reason = `prerequisite ${spec.prerequisite} has not passed: ${pre.detail}`;
  } else {
    try {
      outcome = EVALUATORS[step](run);
    } catch (e) {
      outcome = { checks: [check('evaluator_error', false, `the evaluator failed: ${(e as Error).message}`)], evidence: [] };
    }
    if (spec.prerequisite) outcome.checks.unshift(check('prerequisite', true, pre.detail));
    const failed = outcome.checks.filter((c) => !c.ok);
    status = !outcome.checks.length ? 'FAIL' : failed.length ? 'FAIL' : 'PASS';
    reason = failed.length ? failed.map((c) => `${c.id}: ${c.detail}`).join(' | ') : !outcome.checks.length ? 'no check was evaluated' : `${outcome.checks.length} checks passed`;
  }
  const result = {
    contract: 'demo/step-result',
    contract_version: '1.0',
    environment: DEMO_ENV,
    demo_run_id: run.id,
    step,
    kind: spec.kind,
    name: spec.name,
    demo_status: status,
    reason,
    prerequisite: spec.prerequisite,
    responsibility: spec.responsibility,
    approval_evidence: spec.approval_evidence,
    checks: outcome.checks,
    evidence: outcome.evidence,
    evaluated_at: at,
    production_authorization: 'NOT_GRANTED',
    details: { ...(outcome.details ?? {}), baseline_sha256: shaFile(baselineFile(run)) },
  };
  const v = run.ctx.contracts.validate('demo/step-result', result);
  if (!v.valid) throw new Error(`demo step result violates its contract: ${v.errors.join('; ')}`);
  const file = resultFile(run, step);
  const resultSha = writeJson(file, result);
  const st = readState(run);
  st.steps[step] = { demo_status: status, result_file: rel(run, file), result_sha256: resultSha, baseline_sha256: result.details.baseline_sha256, evaluated_at: at };
  writeJson(stateFile(run), st);
  run.hooks.afterStep?.(step, run);
  return result;
}

/* ------------------------------------------------------------------ */
/* BMad simulation and real-project status (read-only)                 */
/* ------------------------------------------------------------------ */

const STAGE_INPUT: Record<string, { step: DemoStepId; activity: string; input: keyof typeof P | null }> = {
  'BMAD-PRD': { step: 'G2', activity: 'requirements (F1) -> PRD rendering of the approved requirements', input: 'requirements' },
  'BMAD-ARCH': { step: 'G3', activity: 'architecture (F3)', input: 'architecture' },
  'BMAD-EPICS': { step: 'STORIES', activity: 'epics and stories (F4)', input: 'plan' },
  'BMAD-SPRINT': { step: 'STORIES', activity: 'sprint planning (F4)', input: 'plan' },
  'BMAD-BUILD': { step: 'BUILD', activity: 'implementation (F5; here the deterministic converter)', input: null },
  'BMAD-REVIEW': { step: 'REVIEW', activity: 'code review (F7)', input: null },
};

export function simulateBmad(run: DemoRun): any {
  const bindingsFile = path.join(run.ctx.forwardDir, 'integrations', 'bmad', 'bindings.json');
  const doc = fs.existsSync(bindingsFile) ? readJson(bindingsFile) : { bindings: [], release: null, live_execution: null };
  const records = GOVERNED_STAGES.map((s, i) => {
    const b = (doc.bindings as any[]).find((x) => x.binding_id === s.binding_id);
    const map = STAGE_INPUT[s.binding_id];
    const pre: Check[] = [];
    pre.push(check('binding_present', !!b && b.workflow_id === s.workflow_id && b.agent === s.agent, b ? `${s.binding_id} -> ${b.workflow_id} (agent ${b.agent})` : `${s.binding_id} is not in bindings.json`));
    pre.push(check('release_pinned', doc.release?.package === 'bmad-method' && doc.release?.version === '6.12.4', `release ${doc.release?.package}@${doc.release?.version}`));
    for (const g of (b?.requires_gates ?? []) as string[]) {
      const demoGate = (DEMO_GATES as readonly string[]).includes(g) ? (g as DemoStepId) : null;
      const p = demoGate ? stepPassed(run, demoGate) : { ok: false, detail: `unknown gate ${g}` };
      pre.push(check(`requires_${g}`, p.ok, `binding requires ${g}: demo ${p.detail}`));
    }
    const gp = stepPassed(run, map.step);
    pre.push(check('demo_stage_step', gp.ok, `${map.step}: ${gp.detail}`));
    const inputs = map.input ? [{ path: P[map.input], sha256: shaFile(inp(run, map.input)) ?? '0'.repeat(64) }] : [];
    const facts = { receipt_id: `SIM-${run.id}-${s.binding_id}`, binding_id: s.binding_id, mode: 'SIMULATED', accepted: true, intact: true, evidence_status: 'SIMULATED', scope: 'programs:DEMOORD1', scope_sha256: 'synthetic', documents_intact: true };
    const counted = receiptCounts(facts, s.binding_id, 'programs:DEMOORD1', 'synthetic');
    const rec = {
      contract: 'demo/bmad-simulation',
      contract_version: '1.0',
      environment: DEMO_ENV,
      record_id: `BSIM-${String(i + 1).padStart(2, '0')}`,
      binding_id: s.binding_id,
      workflow_id: s.workflow_id,
      agent: s.agent,
      stage: s.stage,
      activity: map.activity,
      mode: 'SIMULATED',
      counts_as_bmad_execution: false,
      preflight: { decision: pre.every((c) => c.ok) ? 'WOULD_BE_ELIGIBLE_IN_DEMO' : 'BLOCKED', checks: pre },
      demo_step: map.step,
      inputs,
      real_receipt_check: { function: 'bmad/governance.receiptCounts', counts: counted.ok, reason: counted.reason },
      note: 'Simulation only: no BMad workflow, installer or provider was invoked. The real receipt counter refuses this record as execution evidence.',
    };
    const v = run.ctx.contracts.validate('demo/bmad-simulation', rec);
    if (!v.valid) throw new Error(`BMad simulation record violates its contract: ${v.errors.join('; ')}`);
    writeJson(path.join(run.outDir, 'bmad', `${rec.record_id}-${s.binding_id}.json`), rec);
    return rec;
  });
  return {
    release: doc.release ? `${doc.release.package}@${doc.release.version}` : null,
    mandatory_in_real_configuration: bmadMandatory(run.ctx),
    live_execution: 'NOT_EXECUTED',
    simulated_stages: records.length,
    would_be_eligible_in_demo: records.filter((r) => r.preflight.decision === 'WOULD_BE_ELIGIBLE_IN_DEMO').length,
    counted_as_bmad_execution: records.filter((r) => r.real_receipt_check.counts).length,
    acceptance_outside_bmad: 'independent verification (F6) and completion after the F7 review stay outside BMad, as in the real design',
    real_governed_workflow: 'BMAD_BLOCKED (unchanged: no LIVE receipt exists)',
    stages: records.map((r) => ({ binding_id: r.binding_id, workflow_id: r.workflow_id, agent: r.agent, stage: r.stage, activity: r.activity, demo_step: r.demo_step, mode: r.mode, preflight: r.preflight.decision, counts_as_bmad_execution: r.counts_as_bmad_execution, real_receipt_check: r.real_receipt_check.reason })),
  };
}

/** Read-only facts about the real project, reported next to the demo so the two are never confused. */
export function realProjectStatus(ctx: RuntimeContext): any {
  const cfg = ctx.config as any;
  let gates: any = 'NOT_AVAILABLE (no local workflow run records in this checkout; they are git-ignored)';
  try {
    const latest = path.join(ctx.runsDir, 'LATEST');
    if (fs.existsSync(latest)) {
      const st = readJson(path.join(ctx.runsDir, fs.readFileSync(latest, 'utf8').trim(), 'workflow', 'state.json'));
      gates = Object.fromEntries(DEMO_GATES.map((g) => [g, st.gates?.[g]?.status ?? 'NOT_RUN']));
    }
  } catch {
    gates = 'NOT_READABLE';
  }
  const count = (file: string, f: (d: any) => any) => {
    try {
      return fs.existsSync(file) ? f(readJson(file)) : 'NOT_AVAILABLE';
    } catch {
      return 'NOT_READABLE';
    }
  };
  return {
    generation_java_generation_allowed: cfg.generation?.java_generation_allowed,
    bmad_governance_mandatory: cfg.bmad_governance?.mandatory,
    approval_trust_store: cfg.approval?.trust_store ?? null,
    real_workflow_gates: gates,
    gap_register: count(path.join(ctx.forwardDir, 'reports', 'step-23', 'master-gap-register.json'), (d) => {
      const recs = d.records ?? d.gaps ?? Object.values(d).find(Array.isArray) ?? [];
      return { records: recs.length, open: recs.filter((r: any) => r.status === 'OPEN').length };
    }),
    business_rule_identities: count(path.join(ctx.repoRoot, 'output', 'rules', 'rules_artifact.json'), (d) => new Set((d.business_rules ?? []).map((r: any) => r.rule_id)).size),
    real_bmad_execution: 'NOT_EXECUTED (no LIVE receipt)',
    legacy_equivalence: 'NOT_ESTABLISHED',
    production_readiness: 'NOT_PRODUCTION_READY',
    engineering_quality_gates: 'SOURCE_READINESS and CONVERSION_VALIDATION (pilot/gates.ts) are unchanged and separate from the demo steps',
  };
}

/* ------------------------------------------------------------------ */
/* the runner                                                          */
/* ------------------------------------------------------------------ */

export const LIMITATIONS = [
  'Synthetic interview demonstration only: one small synthetic program, synthetic evidence and a synthetic demo authority.',
  'Demo approvals are signed with an ephemeral key created for this run; they are not real human, business-owner or production approvals.',
  'production_authorization is NOT_GRANTED: no real gate, approval, receipt or Java generation authorisation was created or changed.',
  'BMad lifecycle steps are SIMULATED; no BMad workflow was executed and real mandatory BMad execution remains blocked.',
  'VERIFY compares the Java with an independent specification oracle; no COBOL runtime was executed, so legacy equivalence is NOT_ESTABLISHED.',
  'The real modernization is unchanged: real G2 is UNVERIFIED and G3 BLOCKED, the gap register stays OPEN, and the project is not production ready.',
];

export function runDemo(o: DemoOptions): { summary: any; run: DemoRun; exitCode: number } {
  const run = initRun(o);
  const statuses: Record<string, any> = {};
  let stopped: DemoStepId | null = null;
  for (const g of DEMO_STEPS) {
    if (stopped) {
      statuses[g] = { step: g, kind: STEP_SPECS[g].kind, name: STEP_SPECS[g].name, demo_status: 'NOT_RUN', reason: `not run: ${stopped} did not pass`, result: null };
      continue;
    }
    if (g === 'G2' || g === 'G3') requestApproval(run, g);
    const r = evaluateDemoStep(run, g);
    statuses[g] = { step: g, kind: r.kind, name: r.name, demo_status: r.demo_status, reason: r.reason, result: rel(run, resultFile(run, g)), checks_passed: r.checks.filter((c: Check) => c.ok).length, checks_total: r.checks.length };
    if (r.demo_status !== 'PASS') stopped = g;
  }
  const bmad = simulateBmad(run);
  const accepted = !stopped && readJson(resultFile(run, 'COMPLETE')).details?.completion === 'SYNTHETIC_DEMO_COMPLETED';
  const baseline = readJson(baselineFile(run));
  const summary = {
    contract: 'demo/run-summary',
    contract_version: '1.0',
    environment: DEMO_ENV,
    demo_run_id: run.id,
    started_at: run.startedAt,
    finished_at: run.now().toISOString(),
    verdict: accepted ? 'SYNTHETIC_DEMO_COMPLETED' : 'SYNTHETIC_DEMO_FAILED',
    stopped_at: stopped,
    production_authorization: 'NOT_GRANTED',
    real_bmad_execution: 'NOT_EXECUTED',
    legacy_equivalence: 'NOT_ESTABLISHED',
    steps: DEMO_STEPS.map((g) => statuses[g]),
    baseline: { file: P.baseline, sha256: shaFile(baselineFile(run)), source: baseline.source, inputs: baseline.inputs },
    bmad,
    real_project_status: realProjectStatus(run.ctx),
    environment_info: { node: process.version, platform: `${process.platform} ${process.arch}`, java: run.tc.java.version, java_source: run.tc.java.source, cobol_compiler: run.tc.cobol.available ? run.tc.cobol.version : 'not available (not used)', input_dir: posix(path.relative(run.ctx.repoRoot, run.inputDir)), output_dir: posix(path.relative(run.ctx.repoRoot, run.outDir)) || run.outDir, trust_store: rel(run, run.trustStore), private_key: 'in memory only; never written' },
    limitations: LIMITATIONS,
  };
  const v = run.ctx.contracts.validate('demo/run-summary', summary);
  if (!v.valid) throw new Error(`demo summary violates its contract: ${v.errors.join('; ')}`);
  writeJson(path.join(run.outDir, 'demo-summary.json'), summary);
  fs.writeFileSync(path.join(run.outDir, 'DEMO-REPORT.md'), renderReport(run, summary));
  return { summary, run, exitCode: accepted ? 0 : 1 };
}

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */

const LABEL: Record<DemoStatus, string> = { PASS: 'DEMO PASS', FAIL: 'DEMO FAIL', BLOCKED: 'DEMO BLOCKED', NOT_RUN: 'NOT RUN' };
const cell = (s: unknown) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

export function renderReport(run: DemoRun, s: any): string {
  const L: string[] = [];
  const result = (g: DemoStepId) => (fs.existsSync(resultFile(run, g)) ? readJson(resultFile(run, g)) : null);
  L.push('# Synthetic two-gate (G2, G3) workflow demonstration report', '');
  L.push(`> **Environment: ${DEMO_ENV}.** This report is about one synthetic example program. It grants no production authorisation, records no real approval and executes no BMad workflow. The real modernization status is listed at the end and is unchanged.`, '');
  L.push(`**Verdict: ${s.verdict}**${s.stopped_at ? ` (stopped at ${s.stopped_at})` : ''}`, '');
  L.push('| Field | Value |', '|---|---|');
  L.push(`| Demo run | \`${s.demo_run_id}\` |`, `| Started / finished | ${s.started_at} / ${s.finished_at} |`, `| production_authorization | ${s.production_authorization} |`, `| real_bmad_execution | ${s.real_bmad_execution} |`, `| legacy_equivalence | ${s.legacy_equivalence} |`);
  L.push(`| Environment | Node ${s.environment_info.node}, ${s.environment_info.platform}; ${cell(s.environment_info.java ?? 'no Java')} |`, `| Output directory | \`${s.environment_info.output_dir}\` |`, '');
  L.push('## Baseline', '', '| File | SHA-256 |', '|---|---|', `| \`${s.baseline.source.path}\` (synthetic COBOL) | \`${s.baseline.source.sha256}\` |`);
  for (const i of s.baseline.inputs) L.push(`| \`${i.path}\` (${i.role}) | \`${i.sha256}\` |`);
  L.push(`| \`${s.baseline.file}\` | \`${s.baseline.sha256}\` |`, '');
  L.push('## Step results', '', 'Only **G2** and **G3** are gates (human decisions with a signed demo approval). BASELINE and EVIDENCE are automated pre-checks; STORIES, BUILD, VERIFY, REVIEW and COMPLETE are automated steps.', '');
  L.push('| Step | Kind | Result | Checks | Responsibility | Approval evidence |', '|---|---|---|---|---|---|');
  for (const g of s.steps) {
    const spec = STEP_SPECS[g.step as DemoStepId];
    L.push(`| ${g.step} ${g.name} | ${spec.kind} | **${LABEL[g.demo_status as DemoStatus]}** | ${g.checks_total ? `${g.checks_passed}/${g.checks_total}` : '–'} | ${cell(spec.responsibility)} | ${cell(spec.approval_evidence)} |`);
  }
  L.push('');
  for (const g of DEMO_STEPS) {
    const r = result(g);
    L.push(`### ${g} ${STEP_SPECS[g].name}: ${r ? LABEL[r.demo_status as DemoStatus] : 'NOT RUN'}`, '');
    if (!r) {
      L.push('Not evaluated: an earlier step did not pass.', '');
      continue;
    }
    if (r.demo_status !== 'PASS') L.push(`**Reason:** ${cell(r.reason)}`, '');
    L.push('| Check | Result | Detail |', '|---|---|---|');
    for (const c of r.checks) L.push(`| ${c.id} | ${c.ok ? 'pass' : '**FAIL**'} | ${cell(c.detail)} |`);
    if (r.evidence.length) L.push('', `Evidence: ${r.evidence.map((e: any) => `\`${e.path}\``).join(', ')}`);
    if (g === 'VERIFY' && r.details?.establishes) L.push('', `**Establishes:** ${r.details.establishes}`, '', `**Does not establish:** ${r.details.does_not_establish}`);
    if (g === 'COMPLETE' && r.details?.completion) L.push('', `**Completion:** ${r.details.completion}. ${r.details.meaning}`);
    L.push('');
  }
  const g5 = result('BUILD');
  if (g5?.details?.build) {
    L.push('## Build and tests', '', `- Compiler: ${cell(g5.details.build.javac)}; exit code ${g5.details.build.exit_code}; ${g5.details.build.class_files} class files (javac -Werror).`);
    if (g5.details.tests) L.push(`- Functional scenarios: ${g5.details.tests.passed}/${g5.details.tests.scenarios} passed (${g5.details.tests.boundary} boundary); ${g5.details.tests.generated_checks} generated VALUE/level-88 checks.`);
    const g6 = result('VERIFY');
    if (g6?.details?.cases) L.push(`- Independent oracle: ${g6.details.cases.matched}/${g6.details.cases.total} cases matched (${g6.details.cases.boundary} boundary, ${g6.details.cases.negative} negative, ${g6.details.cases.seeded} seeded, ${g6.details.cases.example} worked examples; seed ${g6.details.cases.seed}).`);
    L.push('');
  }
  L.push('## BMad lifecycle (SIMULATED)', '', `Release ${s.bmad.release}; mandatory in the real configuration: ${s.bmad.mandatory_in_real_configuration}. Live execution: **${s.bmad.live_execution}**. Counted as BMad execution: ${s.bmad.counted_as_bmad_execution} of ${s.bmad.simulated_stages}.`, '');
  L.push('| Binding | Workflow | Agent | Forward activity | Demo step | Mode | Demo preflight | Real receipt counter |', '|---|---|---|---|---|---|---|---|');
  for (const b of s.bmad.stages) L.push(`| ${b.binding_id} | ${b.workflow_id} | ${b.agent} | ${cell(b.activity)} | ${b.demo_step} | ${b.mode} | ${b.preflight} | ${cell(b.real_receipt_check)} |`);
  L.push('', `${s.bmad.acceptance_outside_bmad}. Real governed workflow: ${s.bmad.real_governed_workflow}.`, '');
  L.push('## Negative paths', '', 'The demo test suite (`forward/tests/synthetic-gate-demonstration.test.ts`) runs the demonstration with injected defects and checks that each one is blocked at the right step with a diagnostic and a nonzero exit code. Run it with `npm run demo:test`.', '');
  L.push('## Real project status (read-only, unchanged)', '', '| Item | Value |', '|---|---|');
  const rp = s.real_project_status;
  L.push(`| generation.java_generation_allowed | ${rp.generation_java_generation_allowed} |`, `| bmad_governance.mandatory | ${rp.bmad_governance_mandatory} |`, `| approval.trust_store | ${rp.approval_trust_store ?? 'null (not configured)'} |`);
  L.push(`| Real workflow gates (G2, G3) | ${cell(typeof rp.real_workflow_gates === 'string' ? rp.real_workflow_gates : Object.entries(rp.real_workflow_gates).map(([k, v]) => `${k} ${v}`).join(', '))} |`);
  L.push(`| Master gap register | ${cell(typeof rp.gap_register === 'object' ? `${rp.gap_register.records} records, ${rp.gap_register.open} OPEN` : rp.gap_register)} |`, `| Business-rule identities | ${rp.business_rule_identities} |`);
  L.push(`| Real BMad execution | ${rp.real_bmad_execution} |`, `| Legacy equivalence | ${rp.legacy_equivalence} |`, `| Production readiness | ${rp.production_readiness} |`, `| Engineering quality gates | ${cell(rp.engineering_quality_gates)} |`, '');
  L.push('## Limitations', '', ...s.limitations.map((x: string) => `- ${x}`), '');
  return L.join('\n');
}

export { statementText };
