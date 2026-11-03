/**
 * The two active engineering quality gates (STEP 14). They are composed only
 * from existing verification components; nothing here re-implements a check.
 *
 *   SOURCE_READINESS(program)
 *     source available (SourceReader); copybooks resolved (parsed DATA
 *     DIVISION); F1/F2 delivered (coverage ledgers); behaviour classified
 *     (pilot/scope); dependencies identified (approval/closure per
 *     behaviour, fail-closed); unsupported behaviour documented as gaps;
 *     unknowns documented as decisions.
 *
 *   CONVERSION_VALIDATION(conversion output)
 *     evidence intact (verifyPilotEvidence); compiled; tests executed and
 *     passed; statement-level traceability (trace audit); no fabrication
 *     (every gap has an INCOMPLETE placeholder and a blocked path); accurate
 *     COMPLETE/PARTIAL/FAILED label (contract pilot/pilot-result).
 *
 * Engineering gates are NOT authorisation. Generation authorisation (the
 * config flag and G4, i.e. the signed G2-G4 approvals) is reported next to
 * each gate exactly as the orchestrator computes it, and is never changed,
 * bypassed or implied here. The historical G0-G8 records are untouched.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildSnapshot } from '../approval/snapshot';
import { evaluateScope, parseSelector } from '../approval/scope';
import { behaviourClosure } from '../approval/closure';
import { SourceReader } from '../blockers/deterministic';
import { unitKey } from '../orchestrator/extracts';
import { generationAuthorized, Workflow } from '../orchestrator/orchestrator';
import { trustDoctor } from '../operations/trust';
import { behaviourScope } from './scope';
import { verifyPilotEvidence } from './pilot';
import { RuntimeContext } from '../core/config';

export interface GateCheck {
  id: string;
  ok: boolean;
  detail: string;
}
export interface EngineeringGate {
  gate: 'SOURCE_READINESS' | 'CONVERSION_VALIDATION';
  subject: string;
  status: 'PASS' | 'FAIL';
  checks: GateCheck[];
  note: string;
}

/** Generation authorisation exactly as the orchestrator computes it (reported, never altered). */
export function authorisationStatus(wf: Workflow, ctx: RuntimeContext, program?: string): any {
  const s = wf.state;
  const blockers: string[] = [];
  if (!ctx.config.generation.java_generation_allowed) blockers.push('config generation.java_generation_allowed is false (project authority)');
  if (!(ctx.config as any).orchestrator?.java_target_dir) blockers.push('no authorised orchestrator.java_target_dir');
  if (s.gates.G4?.status !== 'PASS') blockers.push(`G4 is ${s.gates.G4?.status ?? 'NOT_RUN'} (needs signed G2, G3 and G4 approvals by trusted signers)`);
  const trust = trustDoctor(ctx).status;
  if (trust !== 'TRUST_CONFIGURED') blockers.push(`trust store: ${trust}`);
  return {
    generation_authorized: generationAuthorized(wf.run, s),
    blockers,
    gates: Object.fromEntries(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'].map((g) => [g, s.gates[g]?.status ?? 'NOT_RUN'])),
    trust,
    program_g2_scope: program ? (() => {
      const ev = evaluateScope(buildSnapshot(wf), parseSelector(`programs:${program}`));
      return { readiness: ev.readiness, blocking: ev.summary.blocking, scope_sha256: ev.scope_sha256 };
    })() : null,
    note: 'Engineering gates never authorise generation. Java may be generated only when generation_authorized is true.',
  };
}

export function sourceReadiness(wf: Workflow, program: string): EngineeringGate & { behaviours: any[]; gaps: any[]; closures: any[]; open_decisions: any[] } {
  const snap = buildSnapshot(wf);
  const checks: GateCheck[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const p = snap.sys.programs.find((x) => x.program_id === program);
  if (!p) throw new Error(`unknown program ${program}`);
  const reader = new SourceReader(snap);
  const src = reader.byFileId(p.file_id);
  add('source_available', !!src && src.pf.statements.length > 0, src ? `${src.rel} sha256 ${src.sha256}; ${src.pf.statements.length} statement(s) in ${src.pf.paragraphs.length} paragraph(s)` : 'the program source is not available (configure the COBOL source root)');
  if (!src) return { gate: 'SOURCE_READINESS', subject: program, status: 'FAIL', checks, note: '', behaviours: [], gaps: [], closures: [], open_decisions: [] };
  const empty = src.pf.paragraphs.filter((q, i) => !src.pf.statements.some((s) => s.line >= q.line && s.line < (src.pf.paragraphs[i + 1]?.line ?? Infinity)));
  add('complete_program', !empty.length, empty.length ? `paragraph(s) without statements (stub or template): ${empty.map((q) => q.name).join(', ')}` : 'every paragraph contains statements');
  const unresolvedInc = src.dd.includes.filter((i) => !i.resolved || i.circular);
  add('copybooks_resolved', !unresolvedInc.length, unresolvedInc.length ? `unresolved or circular includes: ${unresolvedInc.map((i) => `${i.name}@${i.line}`).join(', ')}` : `all ${src.dd.includes.length} include(s) resolved: ${src.dd.includes.map((i) => i.name).join(', ') || 'none'}`);
  const ev = evaluateScope(snap, parseSelector(`programs:${program}`));
  const ledger = ev.units.flatMap((u) => (u.unit_kind === 'program' ? ['F1', 'F2'] : ['F2']).map((a) => ({ a, u, s: snap.coverage[a as 'F1' | 'F2'].get(unitKey({ unit_kind: u.unit_kind as any, name: u.name, file_id: u.file_id })) })));
  const missing = ledger.filter((x) => x.s !== undefined && x.s !== 'completed');
  add('requirements_and_data_mapping_delivered', !missing.length && ledger.some((x) => x.a === 'F1' && x.s === 'completed'), missing.length ? `missing deliveries: ${missing.map((x) => `${x.a}:${x.u.name}=${x.s}`).join(', ')}` : `F1/F2 deliveries accepted for ${ev.units.map((u) => u.name).join(', ')}`);
  const bs = behaviourScope(wf, `programs:${program}`).programs.find((x: any) => x.program === program);
  const behaviours = (bs?.behaviours ?? []).map((b: any) => ({ behaviour_id: b.behaviour_id, kind: b.kind, classification: b.classification, lines: b.source_lines, inputs: b.inputs, outputs: b.outputs, side_effects: b.side_effects, unresolved: b.unresolved_dependencies.map((u: any) => u.name), covered_by: b.covered_by }));
  add('behaviour_classified', behaviours.length > 0, behaviours.length ? `${behaviours.length} behaviour(s): ${['VERIFIED_CANDIDATE', 'PARTIAL', 'GAP'].map((c) => `${behaviours.filter((b: any) => b.classification === c).length} ${c}`).join(', ')}` : 'no behaviour could be derived from the entry logic');
  // A named entry paragraph is closed too (its closure spans everything it performs); an unnamed entry is covered
  // by the behaviour classification of its dispatch statements.
  const pf = src.pf;
  const namedEntry = pf.paragraphs.length && !pf.statements.some((s) => s.line >= (pf.procedure_start ?? 1) && s.line < pf.paragraphs[0].line) ? pf.paragraphs[0].name : null;
  const targets = [...new Set([...(namedEntry ? [namedEntry] : []), ...behaviours.filter((b: any) => b.kind === 'performed_range').map((b: any) => b.behaviour_id.split(':')[1])])];
  const closures = targets.map((entry) => {
    const c = behaviourClosure(snap, program, entry, reader);
    return { behaviour_id: `${program}:${entry}`, status: c.status, unresolved_reasons: c.unresolved_reasons, units: c.units.map((u) => u.name), external: c.external, undeclared: c.undeclared.map((u) => u.name), sha256: c.sha256 };
  });
  const unresolved = closures.filter((c: any) => c.status !== 'RESOLVED');
  add('dependencies_identified', !unresolved.length, unresolved.length ? `closure UNRESOLVED for ${unresolved.map((c: any) => `${c.behaviour_id} (${c.unresolved_reasons[0]})`).join('; ')}` : `${closures.length} behaviour closure(s) resolved; units ${[...new Set(closures.flatMap((c: any) => c.units))].join(', ')}; external operations ${closures.reduce((n: number, c: any) => n + c.external.length, 0)}`);
  const gaps = bs?.gaps ?? [];
  const undocumented = behaviours.filter((b: any) => b.classification !== 'VERIFIED_CANDIDATE' && b.kind === 'performed_range' && !gaps.some((g: any) => g.behaviour_id === b.behaviour_id));
  add('unsupported_documented', !undocumented.length, undocumented.length ? `non-verified behaviour without a gap: ${undocumented.map((b: any) => b.behaviour_id).join(', ')}` : `${gaps.length} gap(s) document every PARTIAL/GAP behaviour`);
  const open = ev.findings.filter((f) => f.kind.startsWith('decision') && f.outcome === 'REQUIRES_SME_DECISION').map((f) => ({ id: f.id, blocking: f.blocking, question: snap.register.get(f.id)?.question ?? '' }));
  add('unknowns_documented', true, `${open.length} open decision(s) record the remaining questions (${open.filter((d) => d.blocking).length} blocking for approval); none is resolved or assumed here`);
  return {
    gate: 'SOURCE_READINESS',
    subject: program,
    status: checks.every((c) => c.ok) ? 'PASS' : 'FAIL',
    checks,
    note: 'An engineering gate: it states that the source is understood well enough to convert, with every unknown documented. It is not a G2 approval and does not authorise generation.',
    behaviours,
    gaps,
    closures,
    open_decisions: open,
  };
}

export function conversionValidation(ctx: RuntimeContext, outDir: string, inputDir?: string): EngineeringGate & { label: string | null } {
  const checks: GateCheck[] = [];
  const add = (id: string, ok: boolean, detail: string) => checks.push({ id, ok, detail });
  const resultFile = path.join(outDir, 'pilot-result.json');
  if (!fs.existsSync(resultFile)) {
    add('conversion_output', false, `no conversion result in ${outDir}`);
    return { gate: 'CONVERSION_VALIDATION', subject: outDir, status: 'FAIL', checks, note: '', label: null };
  }
  const r = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  const ev = verifyPilotEvidence(outDir, inputDir);
  add('evidence_intact', ev.ok, ev.ok ? 'every input and output matches the evidence manifest' : ev.problems.slice(0, 5).join('; '));
  add('compiled', r.compilation?.status === 'COMPILED', `compilation: ${r.compilation?.status ?? 'NOT_RUN'}${r.compilation?.javac ? ` (${r.compilation.javac})` : ''}`);
  const c = r.execution?.counts;
  add('tests_passed', r.execution?.status === 'EXECUTED' && !!c && c.FAIL === 0 && c.PASS > 0, c ? `${c.PASS} passed, ${c.BLOCKED_AS_EXPECTED} blocked as expected, ${c.FAIL} failed of ${c.total}` : `execution: ${r.execution?.status ?? 'NOT_RUN'}`);
  const ta = r.trace_audit;
  add('traceability', !!ta && ta.mapped_statements === ta.statements && ta.statements > 0, ta ? `${ta.mapped_statements}/${ta.statements} COBOL statements mapped to Java lines; ${ta.gaps_traced} gap(s) traced` : 'no trace audit');
  const fabricated = (r.gap_trace ?? []).filter((g: any) => !g.java?.placeholder || !(r.execution?.cases ?? []).some((k: any) => k.gap_id === g.gap_id && k.status === 'BLOCKED_AS_EXPECTED'));
  add('no_fabrication', !fabricated.length && (r.gaps ?? []).every((g: any) => g.status === 'OPEN') && ta?.verdict === 'NO_FINDINGS', fabricated.length ? `gap(s) without an explicit placeholder or a demonstrated blocked path: ${fabricated.map((g: any) => g.gap_id).join(', ')}` : `${(r.gaps ?? []).length} gap(s) kept OPEN behind INCOMPLETE placeholders; no default replaces missing behaviour`);
  // STEP 17: COMPLETE also needs behaviour shown by a source-derived scenario (results without the field: as before).
  const expected = r.compilation?.status !== 'COMPILED' || r.execution?.counts?.FAIL ? 'FAILED' : (r.gaps ?? []).length || r.behaviour_verified === false ? 'PARTIAL' : 'COMPLETE';
  const contract = ctx.contracts.validate('pilot/pilot-result', r);
  add('label_accurate', r.conversion_status === expected && contract.valid && (r.validation?.kind !== 'FIXTURE_BASED' || r.equivalence === 'EQUIVALENCE_UNVERIFIED'), `labelled ${r.conversion_status}; evidence says ${expected}; contract ${contract.valid ? 'valid' : contract.errors.slice(0, 2).join('; ')}; equivalence ${r.equivalence}`);
  return {
    gate: 'CONVERSION_VALIDATION',
    subject: `${r.inspection?.program_id ?? '?'} (${outDir})`,
    status: checks.every((x) => x.ok) ? 'PASS' : 'FAIL',
    checks,
    note: 'PASS means the conversion is verified as labelled (COMPLETE or PARTIAL); it never means legacy runtime equivalence without a COBOL reference run.',
    label: r.conversion_status ?? null,
  };
}

/** Complete-program candidates for the first conversion, ranked by external dependencies, unresolved includes and size. */
export function conversionCandidates(wf: Workflow): any[] {
  const snap = buildSnapshot(wf);
  const reader = new SourceReader(snap);
  const cls = new Map(snap.classification.map((c) => [c.file_id, c]));
  return snap.sys.programs
    .map((p) => {
      const s = reader.byFileId(p.file_id);
      const c = cls.get(p.file_id);
      if (!s) return { program: p.program_id, eligible: false, reasons: ['source not available'] };
      const pf = s.pf;
      const cics = s.file.lines.filter((l) => /EXEC\s+CICS/i.test(l)).length;
      const empty = pf.paragraphs.filter((q, i) => !pf.statements.some((x) => x.line >= q.line && x.line < (pf.paragraphs[i + 1]?.line ?? Infinity))).map((q) => q.name);
      const unres = s.dd.includes.filter((i) => !i.resolved || i.circular).map((i) => i.name);
      const reasons: string[] = [];
      if (!pf.statements.length) reasons.push('no procedure statements');
      if (empty.length) reasons.push(`stub paragraph(s) without statements: ${empty.join(', ')}`);
      if (c && c.modernization_scope !== 'candidate') reasons.push(`classified ${c.class} (${c.modernization_scope})`);
      if (unres.length) reasons.push(`unresolved includes: ${unres.join(', ')}`);
      const external = pf.sql.length + cics + pf.calls.length + pf.io.length;
      return {
        program: p.program_id,
        eligible: !reasons.length,
        reasons,
        metrics: { code_lines: s.codeLines, paragraphs: pf.paragraphs.length, statements: pf.statements.length, sql: pf.sql.length, cics, calls: pf.calls.length, file_io: pf.io.length, includes: s.dd.includes.map((i) => i.name), external_operations: external },
        source: { path: s.rel, sha256: s.sha256 },
      };
    })
    .sort((a: any, b: any) => Number(b.eligible) - Number(a.eligible) || (a.metrics?.external_operations ?? 99) - (b.metrics?.external_operations ?? 99) || (a.metrics?.includes.length ?? 99) - (b.metrics?.includes.length ?? 99) || (a.metrics?.statements ?? 9999) - (b.metrics?.statements ?? 9999));
}
