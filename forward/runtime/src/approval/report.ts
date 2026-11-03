/**
 * G2 readiness and blocker report: renders the application scope and every
 * single-program scope (with its dependencies) from one snapshot. Derived
 * entirely from runtime evaluations; nothing in it is hand-written.
 */
import { Workflow } from '../orchestrator/orchestrator';
import { evaluateScope, Finding, ScopeEvaluation } from './scope';
import { buildSnapshot, Snapshot } from './snapshot';

export interface PerProgramRow {
  program: string;
  readiness: string;
  dependencies: number;
  blocking: number;
  by_outcome: Record<string, number>;
  requirements: Record<string, number>;
  top_blockers: string[];
}

export function perProgram(snap: Snapshot): PerProgramRow[] {
  return snap.sys.programs.map((p) => {
    const ev = evaluateScope(snap, { kind: 'programs', programs: [p.program_id] });
    return {
      program: p.program_id,
      readiness: ev.readiness,
      dependencies: ev.units.filter((u) => u.role === 'dependency').length,
      blocking: ev.summary.blocking,
      by_outcome: ev.summary.by_outcome,
      requirements: ev.summary.requirements,
      top_blockers: ev.findings.filter((f) => f.blocking).slice(0, 3).map((f) => `${f.outcome} ${f.id}`),
    };
  });
}

const cell = (o: Record<string, number>, k: string) => String(o[k] ?? 0);
const OUT = ['VERIFIED', 'REQUIRES_EVIDENCE', 'REQUIRES_SME_DECISION', 'CONTRADICTED', 'EXCLUDED_WITH_JUSTIFICATION', 'APPROVED_EXCEPTION'];

function blockerTable(fs: Finding[], limit: number): string[] {
  const lines = ['| Outcome | Kind | ID | Reason |', '|---|---|---|---|'];
  for (const f of fs.filter((x) => x.blocking).slice(0, limit)) lines.push(`| ${f.outcome} | ${f.kind} | ${f.id} | ${f.reasons[0].replace(/\|/g, '/').slice(0, 220)} |`);
  return lines;
}

export function renderReport(wf: Workflow, gate: { status: string; reason: string; checks: Array<{ id: string; status: string; detail: string }> } | null): { markdown: string; application: ScopeEvaluation; programs: PerProgramRow[] } {
  const snap = buildSnapshot(wf);
  const app = evaluateScope(snap, { kind: 'application' });
  const rows = perProgram(snap);
  const decisions = [...snap.register.values()];
  const st = (id: string) => snap.resolutions.get(id)!.status;
  const L: string[] = [];
  L.push(`# G2 readiness and blocker report`, '');
  L.push(`Run \`${wf.run.runId}\` — workflow state \`${wf.state.state}\` — generated ${snap.at.toISOString()} by \`workflow g2 report\`.`, '');
  L.push(`Baseline manifest \`${wf.run.manifestSha256}\` (G0 ${snap.g0.status}). Source root ${snap.ctx.srcRoot ? 'configured' : '**not configured**'}. Trust anchor: ${snap.trust.usable ? `usable (${snap.trust.signers.size} signer(s))` : `**none** — ${snap.trust.problems.join('; ')}`}.`, '');
  if (gate) {
    L.push(`## Gate G2: ${gate.status}`, '', gate.reason, '', '| Check | Status | Detail |', '|---|---|---|');
    for (const c of gate.checks) L.push(`| ${c.id} | ${c.status} | ${c.detail.replace(/\|/g, '/').slice(0, 300)} |`);
    L.push('');
  }
  L.push(`## Application scope: ${app.readiness}`, '');
  L.push(`Scope digest \`${app.scope_sha256}\`; ${app.units.length} unit(s); ${app.summary.blocking} blocking finding(s).`, '');
  L.push('| Category | ' + OUT.join(' | ') + ' |', '|---|' + OUT.map(() => '---').join('|') + '|');
  for (const [c, o] of Object.entries(app.summary.by_category).sort()) L.push(`| ${c} | ${OUT.map((k) => cell(o, k)).join(' | ')} |`);
  L.push('', `Requirements: ${OUT.map((k) => `${k} ${cell(app.summary.requirements, k)}`).join(', ')}.`, '');
  L.push(`Integrity: ${app.integrity.ok ? 'intact' : app.integrity.problems.join('; ')}.`, '');
  L.push(`Provenance policy: ${app.provenance.policy}`, '');
  L.push('### Decision register', '');
  const origin = (t: string) => decisions.filter((d) => d.origin.type === t);
  for (const [t, label] of [['agent', 'raised by F1/F2'], ['consolidation', 'cross-batch (consolidation)'], ['derived', 'derived by the runtime (reviews, scope, unaddressed gaps)']] as const) {
    const ds = origin(t);
    L.push(`- ${label}: ${ds.length} (${ds.filter((d) => d.blocking).length} blocking; resolved ${ds.filter((d) => st(d.decision_id) === 'resolved').length})`);
  }
  L.push('', `### First 60 blockers (of ${app.summary.blocking})`, '', ...blockerTable(app.findings, 60), '');
  L.push('## Per-program scopes (program plus its copybooks and called programs)', '');
  L.push('| Program | Readiness | Deps | Blocking | Req VERIFIED | Req REQUIRES_EVIDENCE | Req REQUIRES_SME | Req CONTRADICTED | Top blockers |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) L.push(`| ${r.program} | ${r.readiness} | ${r.dependencies} | ${r.blocking} | ${cell(r.requirements, 'VERIFIED')} | ${cell(r.requirements, 'REQUIRES_EVIDENCE')} | ${cell(r.requirements, 'REQUIRES_SME_DECISION')} | ${cell(r.requirements, 'CONTRADICTED')} | ${r.top_blockers.join('; ').replace(/\|/g, '/')} |`);
  L.push('', `${rows.filter((r) => r.readiness === 'READY').length} of ${rows.length} single-program scopes are READY.`, '');
  return { markdown: L.join('\n') + '\n', application: app, programs: rows };
}
