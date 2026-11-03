/**
 * Human decision operations commands (STEP 8). Thin operator-facing commands
 * over the existing runtime: trust validation, decision review and signed
 * resolution import, citation remediation review, G2 approval readiness,
 * provider-specific disclosure authorization. Every command supports --json;
 * none signs, resolves, approves or marks a gate PASS.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { loadWorkflow, mutate, OrchestratorError } from '../orchestrator/orchestrator';
import { buildSnapshot } from '../approval/snapshot';
import { evaluateScope, parseSelector } from '../approval/scope';
import { resolveDecision } from '../approval/decisions';
import { analyse } from '../blockers/pipeline';
import { correctionReview } from '../workbench/workbench';
import { trustDoctor, verifyTestSignature, requiredRoles } from '../operations/trust';
import { decisionDossiers, exportResolutionRequest, requestClarification, sealOps, sharedImpact, writeExport } from '../operations/decisions';
import { approvalReadiness } from '../operations/readiness';
import { disclosureStatus, importDisclosure, prepareDisclosure, revokeDisclosure, verifyDisclosure } from '../disclosure/disclosure';
import { workflowCommand } from './workflow';
import { dependencyFactSheet, reviewPackage } from '../operations/package';
import { renderPackage } from '../operations/package-render';

type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);

export function operationsCommand(ctx: RuntimeContext, command: string, action: string | undefined, sub: string | undefined, flags: Flags, json: boolean, out: Out, err: Out): number {
  const print = (o: unknown, text: () => void) => (json ? out(JSON.stringify(o, null, 2)) : text());
  const need = (k: string) => {
    const v = str(flags, k);
    if (!v) throw new OrchestratorError(`--${k} is required`, 'USAGE');
    return v;
  };
  const runId = str(flags, 'run') ?? 'latest';
  const exportDir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-8'));
  try {
    switch (`${command} ${action ?? ''}`.trim()) {
      /* ---------------- trust ---------------- */
      case 'trust doctor': {
        const d = trustDoctor(ctx, str(flags, 'file'));
        print(d, () => {
          for (const c of d.checks) out(`[${c.status.toUpperCase().padEnd(4)}] ${c.id}: ${c.detail}`);
          out(`trust: ${d.status}${d.file ? ` (${d.file})` : ''}`);
        });
        return d.status === 'TRUST_CONFIGURED' ? 0 : 1;
      }
      case 'trust roles': {
        const d = trustDoctor(ctx, str(flags, 'file'));
        const roles = d.roles.length ? d.roles : requiredRoles(ctx).map((r) => ({ ...r, signers: [], covered: false }));
        print({ status: d.status, roles }, () => {
          for (const r of roles) out(`  ${r.covered ? 'covered  ' : 'MISSING  '} ${r.role.padEnd(22)} ${r.signers.join(', ') || '-'}   (${r.used_for.join('; ')})`);
          out(`trust: ${d.status}`);
        });
        return 0;
      }
      case 'trust verify-signature': {
        const c = verifyTestSignature(ctx, need('signer'), path.resolve(need('message')), need('signature'), str(flags, 'file'));
        print({ ok: c.every((x) => x.status === 'pass'), checks: c }, () => c.forEach((x) => out(`[${x.status.toUpperCase()}] ${x.id}: ${x.detail}`)));
        return c.every((x) => x.status === 'pass') ? 0 : 1;
      }

      /* ---------------- decisions ---------------- */
      case 'decisions review': {
        const wf = loadWorkflow(ctx, runId);
        const scope = need('scope');
        const d = decisionDossiers(wf, scope, { all: flags.all === true });
        const sealed = flags['no-record'] ? null : mutate(wf, 'decisions review', () => {
          const s = sealOps(wf, 'decision-dossiers', d);
          wf.store.writeState(wf.state);
          return s;
        });
        const files: string[] = [];
        if (!flags['no-export']) {
          files.push(writeExport(exportDir, 'decision-dossiers.json', d));
          for (const x of d.dossiers) files.push(writeExport(path.join(exportDir, 'resolution-requests'), `${x.decision_id}.request.json`, exportResolutionRequest(loadWorkflow(ctx, runId), x.decision_id, d.scope)));
        }
        print({ record: sealed?.id ?? null, exports: files, ...d }, () => {
          for (const x of d.dossiers) {
            out(`${x.decision_id} [${x.kind}, ${x.inclusion.class}] ${x.status} — roles: ${[...new Set(x.allowed_outcomes.flatMap((o: any) => o.roles))].join('/')}; signers available: ${[...new Set(x.allowed_outcomes.flatMap((o: any) => o.signers_available))].join(', ') || 'none'}`);
            out(`  question: ${x.question.slice(0, 220)}`);
            for (const e of x.evidence_analysis.requirements) for (const m of e.missing_values ?? []) out(`  ${e.id}: ${m.finding}`);
            for (const p of x.remediation) out(`  remediation ${p.proposal_id}: ${p.pointer} ${p.original_value} -> ${p.proposed_value}; re-verified now: ${p.verified_now}`);
            for (const q of x.independent_review) out(`  independent review packet ${q.packet_id}: ${q.status}`);
            out(`  shared impact: ${x.shared_impact.map((s: any) => `${s.scope} (${s.readiness})`).join(', ') || 'none'}`);
          }
          out(`${d.dossiers.length} dossier(s) for ${d.scope}; trust ${d.trust_status}${sealed ? `; sealed ${sealed.id}` : ''}${files.length ? `; exports in ${exportDir}` : ''}`);
        });
        return 0;
      }
      case 'decisions export-request': {
        const wf = loadWorkflow(ctx, runId);
        const r = exportResolutionRequest(wf, need('decision'), need('scope'), str(flags, 'ttl-hours') ? Number(str(flags, 'ttl-hours')) : undefined);
        const file = str(flags, 'out');
        if (file) fs.writeFileSync(path.resolve(file), JSON.stringify(r, null, 2) + '\n', 'utf8');
        print({ written: file ?? null, request: r }, () => out(file ? `${r.request_id}: unsigned resolution request for ${r.decision_id} (scope ${r.scope}, expires ${r.expires_at}) written to ${path.resolve(file)}` : JSON.stringify(r, null, 2)));
        return 0;
      }
      case 'decisions verify-resolution':
      case 'decisions import-resolution': {
        const wf = loadWorkflow(ctx, runId);
        const r = resolveDecision(wf, path.resolve(need('file')), { dryRun: action === 'verify-resolution', build: (w) => buildSnapshot(w) });
        const ok = action === 'verify-resolution' ? r.ok : r.recorded;
        print(r, () => {
          out(action === 'verify-resolution' ? `signed resolution ${r.ok ? 'VALID' : 'INVALID'} for ${r.decision}` : r.recorded ? `RECORDED ${r.resolution_id} for ${r.decision}` : `REJECTED ${r.decision ?? ''} (recorded in the audit log)`);
          for (const c of r.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
        });
        return ok ? 0 : 1;
      }
      case 'decisions clarify': {
        const wf = loadWorkflow(ctx, runId);
        const r = requestClarification(wf, need('decision'), need('requested-by'), str(flags, 'to') ?? '(unassigned)', need('question'));
        print(r, () => out(`${r.record_id}: clarification requested on ${r.decision_id} (the decision stays open)`));
        return 0;
      }
      case 'decisions facts': {
        const wf = loadWorkflow(ctx, runId);
        const f = dependencyFactSheet(buildSnapshot(wf), need('decision'));
        if (!f) throw new OrchestratorError(`unknown decision ${str(flags, 'decision')}`, 'UNKNOWN_DECISION');
        print(f, () => {
          out(`${f.decision_id} (${f.kind}): ${f.counts.affected_units} unit(s), ${f.counts.affected_requirements} requirement(s), ${f.counts.affected_program_scopes} program scope(s)`);
          for (const [k, v] of Object.entries(f.separation)) out(`  ${k}: ${Array.isArray(v) ? (v as string[]).join(' | ') : v}`);
        });
        return 0;
      }
      case 'decisions impact': {
        const wf = loadWorkflow(ctx, runId);
        const snap = buildSnapshot(wf);
        const d = snap.register.get(need('decision'));
        if (!d) throw new OrchestratorError(`unknown decision ${str(flags, 'decision')}`, 'UNKNOWN_DECISION');
        const scopes = sharedImpact(snap, d.affected_units.map((u) => u.name));
        print({ decision_id: d.decision_id, units: d.affected_units.map((u) => u.name), requirements: d.affected_requirements, scopes }, () => {
          out(`${d.decision_id}: units ${d.affected_units.map((u) => u.name).join(', ') || 'none'}; ${scopes.length} program scope(s) affected`);
          for (const s of scopes) out(`  ${s.scope.padEnd(24)} ${s.readiness.padEnd(9)} blocking ${s.blocking} (contains ${s.contains.join(', ')})`);
        });
        return 0;
      }

      /* ---------------- remediation ---------------- */
      case 'remediation review':
      case 'remediation impact': {
        const wf = loadWorkflow(ctx, runId);
        const a = analyse(wf);
        const scope = str(flags, 'scope') ?? null;
        const r = correctionReview(a, scope);
        const only = str(flags, 'proposal');
        const rows = only ? r.proposals.filter((p: any) => p.proposal_id === only) : r.proposals;
        if (only && !rows.length) throw new OrchestratorError(`${only} is not in the latest remediation proposals${scope ? ` for ${scope}` : ''}`, 'USAGE');
        const withImpact = rows.map((p: any) => {
          const item = a.snap.itemById.get(p.item);
          return { ...p, item_sha256: item?.sha256 ?? null, source_files: (item?.source_refs ?? []).filter((x: any) => x?.relative_path).map((x: any) => x.relative_path), affected_scopes: action === 'impact' ? sharedImpact(a.snap, item?.units.map((u) => u.name) ?? []) : undefined };
        });
        print({ ...r, proposals: withImpact }, () => {
          for (const p of withImpact) {
            out(`${p.proposal_id} ${p.item} (${String(p.item_sha256).slice(0, 12)}…) ${p.pointer}: ${p.original_value} -> ${p.proposed_value}`);
            out(`  original line: ${p.original_line_text ?? '-'}`);
            out(`  proposed line: ${p.proposed_line_text ?? '-'}`);
            for (const c of p.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
            out(`  authorization: ${p.authorization.status} via ${p.authorization.decision} (${p.authorization.decision_status}); roles ${p.authorization.required_roles.join('/')}`);
            if (p.affected_scopes) out(`  scopes affected: ${p.affected_scopes.map((s: any) => s.scope).join(', ')}`);
          }
          out(`${withImpact.length} proposal(s); ${withImpact.filter((p: any) => p.verified_now).length} re-verified against the current source`);
        });
        return 0;
      }

      /* ---------------- approval ---------------- */
      case 'approval readiness': {
        const wf = loadWorkflow(ctx, runId);
        const r = approvalReadiness(wf, need('scope'));
        const sealed = flags['no-record'] ? null : mutate(wf, 'approval readiness', () => {
          const s = sealOps(wf, 'g2-approval-readiness', r);
          wf.store.writeState(wf.state);
          return s;
        });
        if (!flags['no-export']) {
          writeExport(exportDir, 'approval-readiness.json', r);
        }
        print({ record: sealed?.id ?? null, ...r }, () => {
          out(`${r.scope}: ${r.readiness} (${r.blocking_findings} blocking); G2 ${r.g2.status}${r.g2.for_this_scope ? ' for this scope' : ''}; trust ${r.trust.status}`);
          for (const s of r.steps) out(`  ${s.step}. [${s.status}] ${s.actor}: ${s.action}\n       ${s.detail}`);
          out(`  next transitions: ${r.allowed_next_transitions.map((t: any) => `${t.to} (${t.guard}${t.satisfied === false ? ', not satisfied' : ''})`).join(', ')}`);
          out(`  ${r.note}`);
        });
        return r.approval_possible_now ? 0 : 1;
      }
      case 'approval package': {
        const wf = loadWorkflow(ctx, runId);
        const dir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-10'));
        const p = reviewPackage(wf, need('scope'), { exportDir: dir, staleDirs: [path.join(ctx.forwardDir, 'reports')] });
        const name = `review-package-${p.scope.replace(/[^A-Za-z0-9]+/g, '_')}`;
        writeExport(dir, `${name}.json`, p);
        writeExport(dir, `${name}.md`, renderPackage(p));
        print({ written: path.join(dir, `${name}.md`), ...p }, () => {
          out(`${p.scope}: ${p.readiness}, ${p.blocking_findings.length} blocking finding(s); digest ${p.scope_sha256.slice(0, 16)}…; status ${p.status}`);
          for (const d of p.decisions_blocking) out(`  decision ${d.decision_id} (${d.outcomes.map((o: any) => o.roles.join('/')).filter((x: string, i: number, a: string[]) => a.indexOf(x) === i).join(', ')})`);
          out(`  fresh requests: ${p.fresh_requests.map((r: any) => r.request_id).join(', ')}; stale earlier requests: ${p.stale_requests.filter((x: any) => x.stale).length}`);
          out(`  written: ${path.join(dir, `${name}.md`)}`);
        });
        return 0;
      }
      case 'approval scope': {
        // STEP 13: inspect a scope (any kind): dependency closure, decision attribution, deferred gaps, and the difference to a comparison scope.
        const wf = loadWorkflow(ctx, runId);
        const snap = buildSnapshot(wf);
        const ev = evaluateScope(snap, parseSelector(need('scope')));
        const cmpText = str(flags, 'compare') ?? (ev.behaviour ? `programs:${ev.behaviour.closure.program}` : null);
        const cmp = cmpText ? evaluateScope(snap, parseSelector(cmpText)) : null;
        const blockingIds = (e: any) => new Set<string>(e.findings.filter((f: any) => f.blocking).map((f: any) => f.id));
        const diff = cmp ? { compare_scope: cmp.selector_text, compare_readiness: cmp.readiness, compare_blocking: cmp.summary.blocking, compare_scope_sha256: cmp.scope_sha256, blocking_only_in_compare: [...blockingIds(cmp)].filter((x) => !blockingIds(ev).has(x)).sort(), blocking_only_in_scope: [...blockingIds(ev)].filter((x) => !blockingIds(cmp).has(x)).sort() } : null;
        const report = { scope: ev.selector_text, scope_sha256: ev.scope_sha256, readiness: ev.readiness, blocking: ev.summary.blocking, units: ev.units, blocking_findings: ev.findings.filter((f) => f.blocking), behaviour: ev.behaviour ?? null, difference: diff, note: 'Inspection only: nothing is approved, resolved or excluded.' };
        const dir = str(flags, 'export-dir');
        if (dir) writeExport(path.resolve(dir), `scope-${ev.selector_text.replace(/[^A-Za-z0-9]+/g, '_').slice(0, 120)}.json`, report);
        print(report, () => {
          out(`${ev.selector_text}: ${ev.readiness}, ${ev.summary.blocking} blocking; digest ${ev.scope_sha256}`);
          if (ev.behaviour) {
            const c = ev.behaviour.closure;
            out(`  closure ${c.status} (${c.sha256.slice(0, 16)}…): ${c.program} ${c.range.join(' THRU ')}; source ${c.source?.path} ${String(c.source?.sha256).slice(0, 16)}…`);
            for (const r of c.unresolved_reasons) out(`    UNRESOLVED: ${r}`);
            out(`  units: ${c.units.map((u) => `${u.name} (${c.unit_reasons[u.name]})`).join('; ')}`);
            out(`  inputs: ${c.inputs.join(', ')}; outputs: ${c.outputs.join(', ')}; external: ${c.external.map((e) => `${e.operation} ${e.target} @${e.line}`).join(', ') || 'none'}; undeclared: ${c.undeclared.map((u) => u.name).join(', ') || 'none'}`);
            for (const w of c.input_writers) out(`  input ${w.field} also written at ${w.paragraph}:${w.line} (${w.via})${w.depends_on.length ? ` depending on ${w.depends_on.join(', ')}` : ''}${w.sql ? ' by embedded SQL' : ''}`);
            for (const a of ev.behaviour.decision_attribution) out(`  ${a.applicable ? 'APPLIES ' : 'excluded'} ${a.decision_id.padEnd(22)} ${a.blocking ? 'blocking ' : 'advisory '} ${a.reason}`);
            for (const g of ev.behaviour.gaps) out(`  gap ${g.gap_id}: ${g.handoff}`);
          }
          for (const f of ev.findings.filter((x) => x.blocking)) out(`  BLOCKING ${f.kind} ${f.id}: ${f.outcome}${f.decisions.length ? ` (${f.decisions.join(', ')})` : ''}`);
          if (diff) out(`  vs ${diff.compare_scope}: ${diff.compare_readiness}, ${diff.compare_blocking} blocking; only there: ${diff.blocking_only_in_compare.join(', ') || 'none'}`);
        });
        return 0;
      }
      case 'approval export-request':
        return workflowCommand(ctx, 'approval', flags, json, out, err, 'request');
      case 'approval verify':
      case 'approval import':
        return workflowCommand(ctx, 'approval', flags, json, out, err, action);

      /* ---------------- provider authorization ---------------- */
      case 'provider authorization': {
        const wf = loadWorkflow(ctx, runId);
        if (sub === 'doctor') {
          const snap = buildSnapshot(wf);
          const rows = [
            { provider: 'anthropic', service: 'claude-code-cli' },
            { provider: 'openai', service: 'responses-api' },
          ].map((q) => ({ ...q, ...disclosureStatus(wf, { ...q, scope: str(flags, 'scope') }, snap) }));
          const trust = trustDoctor(ctx);
          print({ trust: trust.status, providers: rows.map((r) => ({ provider: r.provider, service: r.service, valid: r.valid.map((v: any) => v.authorization_id), rejected: r.rejected, considered: r.considered })) }, () => {
            for (const r of rows) out(`  ${r.provider}/${r.service}: ${r.valid.length ? `AUTHORIZED (${r.valid.map((v: any) => v.authorization_id).join(', ')})` : 'NOT AUTHORIZED'} — ${r.considered} record(s)${r.rejected.length ? `; ${r.rejected.map((x) => `${x.record_id}: ${x.reasons[0]}`).join(' | ')}` : ''}`);
            out(`  trust: ${trust.status}. OpenAI source-export authorizations (verification openai authorize) are a separate contract bound to provider 'openai' and never authorize Claude / BMad.`);
          });
          return 0;
        }
        if (sub === 'prepare') {
          const a = prepareDisclosure(wf, {
            provider: need('provider'),
            service: need('service'),
            scope: need('scope'),
            workflows: need('workflows').split(',').map((x) => x.trim()),
            models: need('models').split(',').map((x) => x.trim()),
            modelMode: (str(flags, 'model-mode') as any) ?? 'exact',
            purpose: need('purpose'),
            classification: (str(flags, 'classification') as any) ?? 'confidential',
            files: str(flags, 'files')?.split(',').map((x) => x.trim()),
            ttlHours: str(flags, 'ttl-hours') ? Number(str(flags, 'ttl-hours')) : undefined,
            limits: { max_cost_usd: str(flags, 'max-cost-usd') ? Number(str(flags, 'max-cost-usd')) : undefined, max_runs: str(flags, 'max-runs') ? Number(str(flags, 'max-runs')) : undefined },
          });
          const file = str(flags, 'out');
          if (file) fs.writeFileSync(path.resolve(file), JSON.stringify(a, null, 2) + '\n', 'utf8');
          print({ written: file ?? null, authorization: a }, () => out(file ? `${a.authorization_id}: unsigned ${a.provider.name}/${a.provider.service} disclosure authorization for ${a.scope.selector_text} (${a.source_files.length} file(s)) written to ${path.resolve(file)}; a data_owner signs it outside REVFORGE` : JSON.stringify(a, null, 2)));
          return 0;
        }
        if (sub === 'verify' || sub === 'import') {
          const file = path.resolve(need('file'));
          if (sub === 'verify') {
            let signed: any;
            try {
              signed = JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch (e) {
              throw new OrchestratorError(`cannot read ${file}: ${(e as Error).message}`, 'USAGE');
            }
            const r = verifyDisclosure(wf, buildSnapshot(wf), signed);
            print(r, () => {
              out(`disclosure authorization ${r.ok ? 'VALID' : 'INVALID'}`);
              for (const c of r.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
            });
            return r.ok ? 0 : 1;
          }
          const r = importDisclosure(wf, file);
          print(r, () => {
            out(r.imported ? `IMPORTED ${r.record_id} (${r.authorization_id})` : 'REJECTED (recorded in the audit log)');
            for (const c of r.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
          });
          return r.imported ? 0 : 1;
        }
        if (sub === 'revoke') {
          const r = revokeDisclosure(wf, path.resolve(need('file')));
          print(r, () => out(r.revoked ? `REVOKED (${r.record_id})` : `REJECTED: ${r.checks.filter((c: any) => !c.ok).map((c: any) => c.detail).join('; ')}`));
          return r.revoked ? 0 : 1;
        }
        err('provider authorization: use doctor [--scope S] | prepare --provider P --service S --scope S --workflows W --models M --purpose TEXT [--classification C] [--files ...] [--out FILE] | verify --file F | import --file F | revoke --file F');
        return 2;
      }
      default:
        err('use: trust doctor|roles|verify-signature | decisions review|export-request|verify-resolution|import-resolution|clarify|impact | remediation review|impact | approval readiness|export-request|verify|import | provider authorization doctor|prepare|verify|import|revoke');
        return 2;
    }
  } catch (e) {
    if (e instanceof OrchestratorError) {
      if (json) out(JSON.stringify({ ok: false, code: e.code, message: e.message, details: e.details }, null, 2));
      err(`${command} ${action ?? ''}: ${e.message}`);
      for (const d of e.details) err(`  - ${d}`);
      return e.code === 'USAGE' ? 2 : 1;
    }
    err(`${command} ${action ?? ''}: ${(e as Error)?.message ?? e}`);
    return 1;
  }
}
