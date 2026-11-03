/**
 * `verification context doctor|check|report` (STEP 9): dependency-aware COBOL
 * source-context verification. `check` is read-only; `report --record` seals
 * the report and records versioned evidence supplements. Nothing here
 * resolves a decision, approves a requirement or changes a receipt.
 */
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { loadWorkflow, mutate, OrchestratorError } from '../orchestrator/orchestrator';
import { buildSnapshot } from '../approval/snapshot';
import { SourceReader } from '../blockers/deterministic';
import { checkItem, contextReport, recordSupplements, supplements } from '../context/context';
import { buildSymbolIndex } from '../../../verification/src/context';
import { sealOps } from '../operations/decisions';
import { renderContextReport } from '../context/report';
import { adjudicationReport, recordAdjudications } from '../context/adjudication';
import { recordSemanticFindings, semanticReport } from '../context/semantic-findings';

type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);

export function contextCommand(ctx: RuntimeContext, action: string | undefined, flags: Flags, json: boolean, out: Out, err: Out): number {
  try {
    return run(ctx, action, flags, json, out, err);
  } catch (e) {
    err(`verification context ${action ?? ''}: ${(e as Error).message}`);
    for (const d of (e as any).details ?? []) err(`  - ${d}`);
    return (e as any).code === 'USAGE' ? 2 : 1;
  }
}

function run(ctx: RuntimeContext, action: string | undefined, flags: Flags, json: boolean, out: Out, err: Out): number {
  const print = (o: unknown, text: () => void) => (json ? out(JSON.stringify(o, null, 2)) : text());
  const wf = loadWorkflow(ctx, str(flags, 'run') ?? 'latest');
  switch (action) {
    case 'doctor': {
      const snap = buildSnapshot(wf);
      const reader = new SourceReader(snap);
      const progs = snap.sys.programs.slice(0, 1000);
      let parsed = 0;
      let symbols = 0;
      let conditions = 0;
      const unresolved = new Set<string>();
      for (const p of progs) {
        const src = reader.byFileId(p.file_id);
        if (!src) continue;
        parsed++;
        const idx = buildSymbolIndex(src.dd, src.abs);
        for (const defs of idx.byName.values()) for (const d of defs) (d.kind === 'condition' ? conditions++ : symbols++);
        for (const u of idx.unresolvedIncludes) unresolved.add(`${u.name}${u.circular ? ' (circular)' : ''}`);
      }
      const checks = [
        { id: 'source_root', ok: reader.available, detail: reader.available ? `original COBOL at ${snap.ctx.srcRoot}` : 'no COBOL source root configured: context verification cannot run' },
        { id: 'parser_statements', ok: snap.ctx.statements.size > 0, detail: `${snap.ctx.statements.size} statement ranges from the parser artifacts` },
        { id: 'data_catalogue', ok: !!(snap.set.artifacts as any).data?.data?.condition_catalogue, detail: `${((snap.set.artifacts as any).data?.data?.condition_catalogue ?? []).length} level-88 conditions in the reverse data catalogue (permanent IDs)` },
        { id: 'symbol_indexes', ok: parsed > 0, detail: `${parsed}/${progs.length} programs parsed: ${symbols} data items and ${conditions} condition declarations (COPY expanded)` },
        { id: 'unresolved_includes', ok: true, detail: unresolved.size ? `unresolved or circular COPY members stay unresolved: ${[...unresolved].join(', ')}` : 'none' },
      ];
      print({ ok: checks.every((c) => c.ok), checks }, () => {
        for (const c of checks) out(`[${c.ok ? 'PASS' : 'FAIL'}] ${c.id}: ${c.detail}`);
      });
      return checks.every((c) => c.ok) ? 0 : 1;
    }
    case 'check': {
      const snap = buildSnapshot(wf);
      const id = str(flags, 'item');
      if (!id) {
        err('verification context check --item <REQUIREMENT-ID>');
        return 2;
      }
      const it = snap.itemById.get(id);
      if (!it) throw new OrchestratorError(`unknown item ${id}`, 'USAGE');
      const r = checkItem(snap, new SourceReader(snap), it);
      print(r, () => {
        out(`${r.item_id}: ${r.status} (existing claim check: ${r.existing.claim_result ?? 'none'})`);
        for (const l of r.literal_support) out(`  '${l.literal}': ${l.support}${l.via.length ? ` via ${l.via.map((v) => `${v.condition} (${v.usage})`).join(', ')}` : ''}`);
        for (const a of r.additional_references) out(`  chain: ${a.usage} ${a.condition} -> ${a.declared_in}:${a.line} VALUE ${JSON.stringify(a.values)} parent ${a.parent} [${a.condition_id ?? 'no permanent ID'}]${a.include_chain.length ? ` via ${a.include_chain.map((c: any) => `COPY ${c.member} at ${c.included_from}:${c.line}`).join(' > ')}` : ''}`);
        out(`  levels: ${Object.entries(r.levels).map(([k, v]) => `${k}=${v}`).join(', ')}`);
        for (const c of r.contradictions) out(`  CONTRADICTION: ${c}`);
        for (const m of r.metadata_disagreements) out(`  metadata: ${m}`);
        for (const u of r.uncertainties) out(`  uncertain: ${u}`);
        out(`  human decision: ${r.human_decision_needed.why}`);
      });
      return 0;
    }
    case 'report': {
      const scope = str(flags, 'scope');
      const r = contextReport(wf, scope);
      const v = ctx.contracts.validate('verification/context-report', r);
      if (!v.valid) throw new OrchestratorError('context report violates its contract', 'CONTRACT', v.errors);
      let sealed: { id: string } | null = null;
      let sups: any[] = [];
      if (flags.record === true) {
        sups = recordSupplements(wf, r);
        sealed = mutate(loadWorkflow(ctx, wf.run.runId), 'context report', (w) => {
          const s = sealOps(w, 'context-report', { ...r, supplements: sups });
          w.store.writeState(w.state);
          return s;
        });
      }
      const dir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-9'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'context-verification-report.json'), JSON.stringify({ ...r, supplements: sups }, null, 2) + '\n', 'utf8');
      fs.writeFileSync(path.join(dir, 'context-verification-report.md'), renderContextReport(r, sups, supplements(loadWorkflow(ctx, wf.run.runId))), 'utf8');
      print({ record: sealed?.id ?? null, supplements: sups, summary: r.summary, export_dir: dir }, () => {
        out(`${r.scope}: ${r.summary.items} item(s) ${JSON.stringify(r.summary.by_status)}; ${r.summary.additional_references_supporting_claims} claim value(s) supported through dependency chains; ${r.summary.contradictions} contradiction(s); ${r.summary.metadata_disagreements} metadata disagreement(s)`);
        for (const s of sups) out(`  ${s.supplement_id} v${s.version} ${s.item_id}: ${s.status}${s.new ? ' (new)' : ' (unchanged, not re-recorded)'}`);
        out(`  ${sealed ? `sealed ${sealed.id}; ` : 'not recorded (use --record); '}exports in ${dir}`);
      });
      return 0;
    }
    case 'adjudicate': {
      const scope = str(flags, 'scope');
      const r = adjudicationReport(wf, scope);
      const v = ctx.contracts.validate('verification/evidence-adjudication-report', r);
      if (!v.valid) throw new OrchestratorError('adjudication report violates its contract', 'CONTRACT', v.errors);
      const recorded = flags.record === true ? recordAdjudications(wf, r) : [];
      const dir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-10'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `evidence-adjudication${scope ? '-' + scope.replace(/[^A-Za-z0-9]+/g, '_') : ''}.json`), JSON.stringify({ ...r, recorded }, null, 2) + '\n', 'utf8');
      print({ summary: r.summary, recorded }, () => {
        for (const x of r.results) out(`  ${x.cohort === 'newly_supported' ? 'NEW ' : 'PREV'} ${x.item_id.padEnd(22)} ${x.classification.padEnd(26)} ${x.superseding_status ?? ''} ${x.diagnosis ? x.diagnosis.join(',') : ''}`);
        out(`${r.scope}: ${r.summary.newly_supported} newly supported, ${r.summary.questionable_earlier_verifications} questionable earlier verification(s); ${r.summary.evidence_invalidated} invalidated, ${r.summary.earlier_verification_confirmed} confirmed${recorded.length ? `; recorded ${recorded.filter((x) => x.new).length} new record(s)` : ' (not recorded; use --record)'}`);
      });
      return 0;
    }
    case 'dependencies': {
      const scope = str(flags, 'scope');
      const r = semanticReport(wf, scope);
      const recorded = flags.record === true ? recordSemanticFindings(wf, r) : [];
      const dir = path.resolve(str(flags, 'export-dir') ?? path.join(ctx.forwardDir, 'reports', 'step-12'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `semantic-dependencies${scope ? '-' + scope.replace(/[^A-Za-z0-9]+/g, '_') : ''}.json`), JSON.stringify({ ...r, recorded }, null, 2) + '\n', 'utf8');
      print({ summary: r.summary, recorded }, () => {
        for (const x of r.results) out(`  ${x.item_id.padEnd(22)} ${x.edges.map((e: any) => `${e.decision_id} (${e.names.join(', ')} at ${e.statements.map((s: any) => s.line).join(', ')})`).join('; ')}`);
        out(`${r.scope}: ${r.summary.items} item(s) newly linked to ${r.summary.edges} blocking decision edge(s)${recorded.length ? `; recorded ${recorded.filter((x) => x.new).length} new record(s)` : ' (not recorded; use --record)'}`);
      });
      return 0;
    }
    default:
      err('verification context: use doctor | check --item ID | report [--scope S] [--record] | adjudicate [--scope S] [--record] [--export-dir DIR] | dependencies [--scope S] [--record] [--export-dir DIR]');
      return 2;
  }
}
