import { RuntimeContext } from '../core/config';
import { AGENTS, checkDefinition } from '../orchestrator/agents';
import { validateSkill, validateSkillInventory } from '../orchestrator/skills';
import { acceptedGateIds, GATES, GateId, gateRecord, GateResult, gateSpec, PRECHECKS, PrecheckId, PrecheckResult, precheckSpec } from '../orchestrator/gates';
import {
  advance,
  agentsDir,
  blockedReport,
  initWorkflow,
  loadWorkflow,
  OrchestratorError,
  prepare,
  prepareBatches,
  recordReceipt,
  resume,
  runGate,
  runPrecheck,
  status,
} from '../orchestrator/orchestrator';
import { allowedTargets } from '../orchestrator/states';
import { computeLedger, writeLedger } from '../orchestrator/ledger';
import { findAgent } from '../orchestrator/agents';
import { consolidate, correct, reconcile, recordAccess, verifySources } from '../remediation/remediation';
import * as fs from 'fs';
import * as path from 'path';
import { approvalStatement, createApprovalRequest, evaluateScopeText, importApproval, statementText, verifyApprovalFile } from '../approval/approvals';
import { resolutionTemplate, resolveDecision } from '../approval/decisions';
import { recordPacketReview } from '../approval/packets';
import { loadPolicy } from '../approval/policy';
import { perProgram, renderReport } from '../approval/report';
import { evaluateScope, parseSelector } from '../approval/scope';
import { buildSnapshot } from '../approval/snapshot';
import { canonicalize } from '../approval/canonical';
import { createDesignRequest, DESIGN_DIR, designStatement, evaluateDesignGate, importDesignApproval, verifyDesignApprovalFile, validateStorySet } from '../design/approvals';

type Out = (s: string) => void;
type Flags = Record<string, string | true>;
const str = (f: Flags, k: string) => (typeof f[k] === 'string' ? (f[k] as string) : undefined);

/** `agents`: registry, definition-file checks and skill installation status. */
export function agentsCommand(ctx: RuntimeContext, json: boolean, out: Out): number {
  const dir = agentsDir(ctx);
  const skillsDir = path.resolve(ctx.repoRoot, (ctx.config as any).orchestrator?.skills_dir ?? '.claude/skills');
  const rows = AGENTS.map((a) => {
    const def = checkDefinition(dir, a);
    return {
      id: a.id,
      name: a.name,
      title: a.title,
      definition: path.relative(ctx.repoRoot, def.path).split(path.sep).join('/'),
      definition_ok: def.present && def.problems.length === 0,
      definition_problems: def.problems,
      tools: def.tools,
      dispatch_states: a.dispatch_states,
      requires_gate: a.requires_gate,
      inputs: a.inputs.map((i) => i.kind),
      outputs: a.outputs.map((o) => o.name),
      skills: a.skills.map((s) => validateSkill(skillsDir, s)).map((s) => ({ name: s.name, status: s.status, problems: s.problems })),
    };
  });
  const ok = rows.every((r) => r.definition_ok) && new Set(rows.map((r) => r.name)).size === rows.length;
  if (json) out(JSON.stringify({ ok, agents: rows }, null, 2));
  else {
    for (const r of rows) {
      out(`${r.id} ${r.name} [${r.definition_ok ? 'definition OK' : 'DEFINITION PROBLEMS'}]`);
      out(`   definition: ${r.definition}; tools: ${r.tools.join(', ') || '(none)'}`);
      out(`   dispatch in: ${r.dispatch_states.join(', ')}; requires ${r.requires_gate}`);
      out(`   skills: ${r.skills.map((s) => `${s.name}=${s.status}`).join(', ')}`);
      for (const p of r.definition_problems) out(`   ! ${p}`);
    }
    out(`agents: ${ok ? 'OK' : 'FAILED'} — ${rows.length} registered`);
  }
  return ok ? 0 : 1;
}

/** `skills`: validate all fourteen forward skills, ownership, duplicates and unexpected fe-* skills. */
export function skillsCommand(ctx: RuntimeContext, json: boolean, out: Out): number {
  const dir = path.resolve(ctx.repoRoot, (ctx.config as any).orchestrator?.skills_dir ?? '.claude/skills');
  const inv = validateSkillInventory(dir);
  if (json) out(JSON.stringify(inv, null, 2));
  else {
    for (const sk of inv.skills) {
      out(`${sk.owner} ${sk.name}: ${sk.status}${sk.sha256 ? ` (sha256 ${sk.sha256.slice(0, 12)}…)` : ''}`);
      for (const p of sk.problems) out(`   ! ${p}`);
    }
    for (const o of inv.ownership) if (!o.ok) out(`ownership problem: ${o.problem}`);
    for (const u of inv.unexpected) out(`unexpected forward skill directory: ${u}`);
    for (const d of inv.duplicates) out(`duplicate skill name: ${d}`);
    out(`skills: ${inv.ok ? 'OK' : 'FAILED'} — ${inv.skills.filter((x) => x.status === 'INSTALLED').length}/${inv.skills.length} installed and valid`);
  }
  return inv.ok ? 0 : 1;
}

/** `workflow <sub>`: orchestrator operations on a plan run. */
export function workflowCommand(ctx: RuntimeContext, sub: string | undefined, flags: Flags, json: boolean, out: Out, err: Out, action?: string): number {
  const runId = str(flags, 'run') ?? 'latest';
  const print = (o: unknown, text: () => void) => (json ? out(JSON.stringify(o, null, 2)) : text());
  try {
    switch (sub) {
      case 'init': {
        const wf = initWorkflow(ctx, runId);
        print({ workflow_id: wf.state.workflow_id, state: wf.state.state, prechecks: wf.state.prechecks, gates: wf.state.gates }, () => {
          out(`workflow ${wf.state.workflow_id} created for run ${wf.state.run_id}`);
          out(`  baseline pre-check: ${wf.state.prechecks?.BASELINE?.status}; state: ${wf.state.state}`);
          out(`  classification: ${wf.store.p('program_classification.json')}`);
        });
        return wf.state.state === 'BLOCKED' ? 1 : 0;
      }
      case 'status': {
        const s = status(loadWorkflow(ctx, runId));
        print(s, () => {
          out(`workflow ${s.workflow_id} — state ${s.state}${s.blocked_from ? ` (blocked from ${s.blocked_from})` : ''}`);
          out(`  pre-checks: ${Object.entries(s.prechecks).map(([c, v]) => `${c}=${v}`).join(' ')}`);
          out(`  gates: ${Object.entries(s.gates).map(([g, v]) => `${g}=${v}`).join(' ')}`);
          out(`  packets: ${s.packets.total} (awaiting receipt: ${s.packets.awaiting_receipt.join(', ') || 'none'}${s.packets.superseded.length ? `; superseded: ${s.packets.superseded.join(', ')} per ${s.packets.packet_status_record}` : ''}); receipts accepted ${s.receipts.accepted}, rejected ${s.receipts.rejected}`);
          out(`  checkpoint #${s.checkpoint.seq}: ${s.checkpoint.verified ? 'verified' : 'NOT VERIFIED — ' + s.checkpoint.problems.join('; ')}`);
          out(`  java generation authorised: ${s.java_generation_authorized}`);
          for (const b of s.blockers) out(`  blocker: ${b}`);
          for (const h of s.history) out(`  ${h}`);
        });
        return 0;
      }
      case 'precheck': {
        // Automated pre-checks (formerly gates G0 and G1): BASELINE and EVIDENCE.
        const c = (str(flags, 'check') ?? (typeof flags.all === 'boolean' ? 'all' : undefined))?.toUpperCase();
        if (!c) {
          err('workflow precheck: specify --check BASELINE, --check EVIDENCE or --check all');
          return 2;
        }
        const ids = c === 'ALL' ? PRECHECKS.map((x) => x.id) : [c];
        const wf = loadWorkflow(ctx, runId);
        const results: PrecheckResult[] = [];
        for (const id of ids) {
          if (!precheckSpec(id)) {
            err(`unknown pre-check ${id}`);
            return 2;
          }
          results.push(runPrecheck(wf, id as PrecheckId));
        }
        print(results, () => {
          for (const r of results) {
            out(`${r.check} ${r.name}: ${r.status} — ${r.reason}`);
            for (const x of r.checks) out(`   [${x.status}] ${x.id}: ${x.detail}`);
          }
        });
        return results.every((r) => r.status === 'PASS') ? 0 : 1;
      }
      case 'gate': {
        const g = (str(flags, 'gate') ?? (typeof flags.all === 'boolean' ? 'all' : undefined))?.toUpperCase();
        if (!g) {
          err('workflow gate: specify --gate G1, --gate G2 or --gate all');
          return 2;
        }
        const ids = g === 'ALL' ? GATES.map((x) => x.id) : [g];
        const wf = loadWorkflow(ctx, runId);
        const results: GateResult[] = [];
        for (const id of ids) {
          if (!gateSpec(id)) {
            err(`unknown gate ${id}`);
            return 2;
          }
          results.push(runGate(wf, id as GateId));
        }
        print(results, () => {
          for (const r of results) {
            out(`${r.gate} ${r.name}: ${r.status} — ${r.reason}`);
            for (const c of r.checks) out(`   [${c.status}] ${c.id}: ${c.detail}`);
            for (const l of r.limitations) out(`   limitation: ${l}`);
          }
        });
        return results.every((r) => r.status === 'PASS') ? 0 : 1;
      }
      case 'advance': {
        const to = str(flags, 'to');
        if (!to) {
          err('workflow advance: specify --to <STATE>');
          return 2;
        }
        const r = advance(loadWorkflow(ctx, runId), to, { reason: str(flags, 'reason') });
        print(r, () => out(`${r.accepted ? 'ACCEPTED' : 'REJECTED'}: ${r.from} -> ${r.to} — ${r.reason}`));
        return r.accepted ? 0 : 1;
      }
      case 'transitions': {
        const wf = loadWorkflow(ctx, runId);
        const t = allowedTargets(wf.state.state, wf.state.blocked_from).map((x) => ({ to: x.to, guard: x.guard }));
        print(t, () => t.forEach((x) => out(`${wf.state.state} -> ${x.to} requires ${JSON.stringify(x.guard)}`)));
        return 0;
      }
      case 'prepare': {
        const agent = str(flags, 'agent');
        if (!agent) {
          err('workflow prepare: specify --agent <F1..F7|fe-name>');
          return 2;
        }
        const programs = str(flags, 'programs')?.split(',').map((x) => x.trim()).filter(Boolean);
        const wf = loadWorkflow(ctx, runId);
        const p = prepare(wf, agent, { programs });
        print(p, () => {
          out(`${p.packet_id} for ${p.agent.name}: ${p.dispatchable ? 'DISPATCHABLE' : 'NOT DISPATCHABLE'}`);
          out(`  packet: ${wf.store.p('packets', p.packet_id + '.json')}`);
          out(`  programs: ${p.programs.length}; inputs: ${p.inputs.length}; output dir: ${p.permissions.output_dir}`);
          for (const s of p.skills) out(`  skill ${s.name}: ${s.status}`);
          for (const b of p.blockers) out(`  blocker: ${b}`);
        });
        return p.dispatchable ? 0 : 1;
      }
      case 'batches': {
        const agent = str(flags, 'agent');
        const size = Number(str(flags, 'size') ?? (ctx.config as any).orchestrator?.batch_size ?? 14);
        if (!agent) {
          err('workflow batches: specify --agent <F1|F2> [--size N]');
          return 2;
        }
        const wf = loadWorkflow(ctx, runId);
        const ps = prepareBatches(wf, agent, size);
        print(ps.map((p) => ({ packet_id: p.packet_id, dispatchable: p.dispatchable, units: p.units.length, receipt_path: p.receipt_path, blockers: p.blockers })), () => {
          if (!ps.length) out('no pending units: nothing to batch');
          for (const p of ps) out(`${p.packet_id}: ${p.units.length} unit(s) — ${p.dispatchable ? 'DISPATCHABLE' : 'NOT DISPATCHABLE: ' + p.blockers.join('; ')}
   receipt: ${p.receipt_path}`);
        });
        return ps.every((p) => p.dispatchable) ? 0 : 1;
      }
      case 'coverage': {
        const agent = str(flags, 'agent');
        const a = agent ? findAgent(agent) : undefined;
        if (!a || !a.unit_kinds.length) {
          err('workflow coverage: specify --agent F1 or F2');
          return 2;
        }
        const wf = loadWorkflow(ctx, runId);
        const l = computeLedger(wf, a);
        const file = writeLedger(wf, l);
        print(l, () => {
          out(`${a.id} coverage: ${l.completed}/${l.units_total} completed, ${l.in_progress} in progress, ${l.pending} pending — ${l.complete ? 'COMPLETE' : 'INCOMPLETE'}`);
          out(`  ledger: ${file}`);
        });
        return 0;
      }
      case 'reconcile': {
        const rd = str(flags, 'reported-dispositions');
        const rc = str(flags, 'reported-decisions');
        const r = reconcile(loadWorkflow(ctx, runId), { rule_dispositions: rd ? Number(rd) : undefined, decisions: rc ? Number(rc) : undefined });
        print({ id: r.id, rules: { ...r.rules, multi_entry: r.rules.multi_entry.length }, decisions: r.decisions }, () => {
          out(`${r.id}: rules ${r.rules.equation} — ${r.rules.balanced ? 'BALANCED' : 'NOT BALANCED'}`);
          out(`  status: ${JSON.stringify(r.rules.by_status)}; missing ${r.rules.missing.length}; unknown IDs ${r.rules.unknown_ids.length}`);
          for (const m of r.rules.multi_entry) out(`  ${m.rule_id} x${m.entry_count} [${m.status}] ${m.entries.map((e: any) => `${e.packet}=${e.disposition}`).join(', ')} — ${m.multi_entry_reason}`);
          out(`  decisions: ${r.decisions.total} (${r.decisions.unique_ids} unique IDs; F1 ${r.decisions.by_agent.F1}, F2 ${r.decisions.by_agent.F2}; ${r.decisions.blocking} blocking)${r.decisions.reported !== null ? ` — reported ${r.decisions.reported}: ${r.decisions.reported_matches ? 'matches' : 'DOES NOT MATCH'}` : ''}`);
          out(`  gaps referenced from several packets: ${r.decisions.gaps_referenced_by_multiple_packets.length}`);
        });
        return r.rules.balanced ? 0 : 1;
      }
      case 'verify-access': {
        const packet = str(flags, 'packet');
        const tr = str(flags, 'transcript');
        if (!packet || !tr) {
          err('workflow verify-access: specify --packet <id> --transcript <subagent jsonl>');
          return 2;
        }
        const r = recordAccess(loadWorkflow(ctx, runId), packet, path.resolve(tr));
        print(r, () => {
          out(`${r.id}: ${r.provenance_status}; ${r.transcript.tool_calls} tool calls; supplied ${r.inputs_supplied}: read ${r.supplied_and_read.length}, grep file ${r.supplied_grep_file.length}, grep dir ${r.supplied_grep_directory_only.length}, none ${r.supplied_not_read.length}; ${r.original_source_files_read.length} original source file(s) read`);
          for (const d of r.provenance_by_output) out(`  ${d.output.split('/').slice(-1)[0]}: declared ${d.declared_inputs_used} -> read ${d.declared_and_read.length}, grep file ${d.declared_grep_file.length}, grep dir only ${d.declared_grep_directory_only.length}, NOT evidenced ${d.declared_not_read.length}`);
        });
        return 0;
      }
      case 'verify-sources': {
        const r = verifySources(loadWorkflow(ctx, runId), { corrected: flags.corrected === true });
        print({ id: r.id, summary: r.summary }, () => {
          out(`${r.id}: source root ${r.source_root_configured ? 'configured' : 'NOT configured'}`);
          for (const [k, v] of Object.entries(r.summary) as any) out(`  ${k}: ${v.claims} claim(s) — verification ${JSON.stringify(v.claim_verification)}; access ${JSON.stringify(v.access_demonstrated)}`);
        });
        return 0;
      }
      case 'correct': {
        const spec = { packet: str(flags, 'packet') as string, file: str(flags, 'file') as string, pointer: str(flags, 'pointer') as string, kind: str(flags, 'kind') as any, count_pointer: str(flags, 'count-pointer'), reason: str(flags, 'reason') ?? '', authorized_by: str(flags, 'authorized-by'), proposal_id: str(flags, 'proposal') };
        if (!spec.packet || !spec.file || !spec.pointer || !spec.kind || !spec.reason) {
          err('workflow correct: --packet --file --pointer --kind count_word|statement_for_line|citation_line [--count-pointer] [--authorized-by RES-NNNN --proposal RP-...] --reason');
          return 2;
        }
        const r = correct(loadWorkflow(ctx, runId), spec);
        print(r, () => {
          out(`${r.correction_id}: ${JSON.stringify(r.old_value).slice(0, 140)}`);
          out(`  -> ${JSON.stringify(r.new_value).slice(0, 140)}`);
          out(`  applied copy: ${r.applied_copy.path}`);
        });
        return 0;
      }
      case 'consolidate': {
        const r = consolidate(loadWorkflow(ctx, runId));
        print({ id: r.id, rules: { conflicts: r.rules.conflicts, overlaps: r.rules.consistent_overlaps.length }, fields: r.fields, decisions: r.decisions, retained_issues: r.retained_issues }, () => {
          out(`${r.id}: ${r.rules.conflicts.length} rule conflict(s), ${r.rules.consistent_overlaps.length} consistent overlap(s), ${r.fields.conflicts.length} field conflict(s), ${r.fields.duplicate_field_ids.length} field(s) mapped twice`);
          for (const c of r.rules.conflicts) out(`  conflict ${c.rule_id}: ${c.dispositions.map((e: any) => `${e.packet}=${e.disposition}`).join(', ')} -> ${c.resolution}`);
          out(`  decisions: ${r.decisions.total} (${r.decisions.original} original + ${r.decisions.consolidation_added} consolidation), ${r.decisions.blocking} blocking, ${r.decisions.open} open`);
          for (const t of r.retained_issues) out(`  retained: ${t.issue} -> ${t.status} (${t.decisions.join(', ') || 'none'})`);
        });
        return 0;
      }
      case 'g1': {
        // Requirements gate G1 (named 'workflow g2' before the 2026-11-09 renumbering; 'g2' is now the architecture gate).
        const wf = loadWorkflow(ctx, runId);
        const scope = str(flags, 'scope') ?? loadPolicy(ctx).g2.default_scope;
        if (action === 'evaluate' || action === 'blockers') {
          if (action === 'blockers' && flags['per-program'] === true) {
            const rows = perProgram(buildSnapshot(wf));
            print(rows, () => {
              for (const r of rows) out(`${r.program.padEnd(10)} ${r.readiness.padEnd(9)} deps ${String(r.dependencies).padStart(2)} blocking ${String(r.blocking).padStart(4)}  ${r.top_blockers.join('; ')}`);
              out(`${rows.filter((r) => r.readiness === 'READY').length}/${rows.length} single-program scopes READY`);
            });
            return 0;
          }
          const ev = evaluateScopeText(wf, scope);
          const blockers = ev.findings.filter((f) => f.blocking);
          print(action === 'evaluate' ? ev : { scope: ev.selector_text, readiness: ev.readiness, scope_sha256: ev.scope_sha256, integrity: ev.integrity, blocking: blockers }, () => {
            out(`scope ${ev.selector_text}: ${ev.readiness} — ${ev.units.length} unit(s), ${ev.summary.blocking} blocking finding(s); digest ${ev.scope_sha256}`);
            out(`  outcomes: ${JSON.stringify(ev.summary.by_outcome)}`);
            out(`  requirements: ${JSON.stringify(ev.summary.requirements)}`);
            for (const [c, o] of Object.entries(ev.summary.by_category)) out(`  ${c}: ${JSON.stringify(o)}`);
            if (!ev.integrity.ok) for (const p of ev.integrity.problems) out(`  integrity: ${p}`);
            out(`  provenance: ${ev.provenance.policy}`);
            if (action === 'blockers') for (const f of blockers) out(`  ${f.outcome.padEnd(21)} ${f.kind.padEnd(22)} ${f.id}: ${f.reasons[0].slice(0, 200)}`);
            else out('  (readiness only; G1 also requires a verified signed approval — see workflow gate --gate G1)');
          });
          return ev.readiness === 'READY' ? 0 : 1;
        }
        if (action === 'report') {
          const rec = gateRecord(wf.state, 'G1');
          const g = rec ? wf.store.readRecord('gates', rec.result_file) : null;
          const r = renderReport(wf, g);
          const file = str(flags, 'out');
          if (file) fs.writeFileSync(path.resolve(file), r.markdown, 'utf8');
          print({ application: { readiness: r.application.readiness, blocking: r.application.summary.blocking, scope_sha256: r.application.scope_sha256 }, programs: r.programs, written: file ?? null }, () => (file ? out(`report written to ${path.resolve(file)}`) : out(r.markdown)));
          return 0;
        }
        err('workflow g1: use evaluate | blockers [--per-program] | report [--out FILE] (with --scope application|programs:A,B|requirements:R1,R2)');
        return 2;
      }
      case 'g2':
      case 'g3': {
        // Architecture gate G2. 'workflow g3' is its deprecated pre-2026-11-09 name, kept as an alias.
        const gate = 'G2' as const;
        if (sub === 'g3') err("note: 'workflow g3' is deprecated; the architecture gate is now G2 ('workflow g2')");
        if (action !== 'evaluate' && action !== 'blockers') {
          err(`workflow ${sub}: use evaluate | blockers (read-only; 'workflow gate --gate ${gate}' records the result)`);
          return 2;
        }
        const o = evaluateDesignGate(loadWorkflow(ctx, runId), gate);
        const failing = o.result.checks.filter((c) => c.status === 'fail');
        print(action === 'evaluate' ? { result: o.result, evaluation: { ...o.evaluation, validation: o.context.validation }, pending_invalidations: o.invalidations } : { gate, status: o.result.status, reason: o.result.reason, blockers: failing, upstream_blocked: o.context.blocked, artifact: o.evaluation.artifact, validation_failures: o.context.validation.checks.filter((c) => !c.ok) }, () => {
          out(`${gate} ${o.result.name}: ${o.result.status} — ${o.result.reason}`);
          for (const c of action === 'evaluate' ? o.result.checks : failing) out(`  [${c.status}] ${c.id}: ${c.detail}`);
          if (action === 'blockers' && o.context.blocked) out(`  upstream: ${o.context.blocked}`);
          if (action === 'blockers') for (const c of o.context.validation.checks.filter((x) => !x.ok)) out(`  validation ${c.id}: ${c.detail}`);
          for (const i of o.invalidations) out(`  invalidated approval ${i.approval_id}: ${i.causes.join(', ')}`);
          out(`  (read-only; 'workflow gate --gate ${gate}' records the result)`);
        });
        return o.result.status === 'PASS' ? 0 : 1;
      }
      case 'stories': {
        if (action !== 'validate') {
          err('workflow stories: use validate (read-only automated check of the F4 story set; F5 needs it to pass)');
          return 2;
        }
        const v = validateStorySet(loadWorkflow(ctx, runId));
        print(v, () => {
          out(`F4 story set: ${v.ok ? 'VALID' : 'NOT VALID'} — ${v.reason}`);
          for (const c of v.checks) out(`  [${c.ok ? 'pass' : 'fail'}] ${c.id}: ${c.detail}`);
          if (v.story_order.length) out(`  implementation order: ${v.story_order.join(' -> ')}`);
        });
        return v.ok ? 0 : 1;
      }
      case 'architecture': {
        const gate = 'G2' as const;
        const wf = loadWorkflow(ctx, runId);
        if (action === 'approval-request') {
          const by = str(flags, 'requested-by');
          if (!by) {
            err(`workflow ${sub} approval-request: --requested-by <human identity> is required`);
            return 2;
          }
          const r = createDesignRequest(wf, gate, by);
          print(r, () => {
            out(`${r.request_id}: ${gate} approval requested for ${r.payload.artifact.kind} ${r.payload.artifact.receipt_id} (${r.payload.scope.selector_text})`);
            out(`  artefact sha256:     ${r.payload.artifact.sha256}`);
            out(`  requirements sha256: ${r.payload.requirements.sha256}`);
            out(`  dependency sha256:   ${r.payload.dependency_manifest.sha256}`);
            out(`  upstream approvals:  ${r.payload.upstream_approvals.map((u: any) => u.approval_id).join(', ')}`);
            out(`  roles: ${r.payload.required_roles.join(' or ')}${r.payload.co_approval_roles.length ? `; co-approval: ${r.payload.co_approval_roles.join(' or ')}` : ''}; expires ${r.payload.expires_at}`);
            out(`  next: workflow ${sub} approval-statement --request ${r.request_id} --signer <id> --role <role> --decision approved --out statement.json, sign outside the harness, then workflow approval import --file signed.json`);
          });
          return 0;
        }
        if (action === 'approval-statement') {
          const id = str(flags, 'request');
          const signer = str(flags, 'signer');
          const role = str(flags, 'role');
          const decision = str(flags, 'decision') as 'approved' | 'rejected' | undefined;
          if (!id || !signer || !role || (decision !== 'approved' && decision !== 'rejected')) {
            err(`workflow ${sub} approval-statement: --request DREQ-NNNN --signer ID --role ROLE --decision approved|rejected [--comment TEXT] [--out FILE]`);
            return 2;
          }
          const req = wf.store.readRecord(`${DESIGN_DIR}/requests`, `${id}.json`);
          if (!acceptedGateIds(wf.state, gate).includes(req.payload.gate)) {
            err(`${id} is a ${req.payload.gate} request, not ${gate}`);
            return 2;
          }
          const text = canonicalize(designStatement(req, signer, role, decision, new Date().toISOString(), str(flags, 'comment')));
          const file = str(flags, 'out');
          if (file) fs.writeFileSync(path.resolve(file), text, 'utf8');
          print({ statement: JSON.parse(text), canonical_text: text, written: file ?? null }, () => out(file ? `canonical statement written to ${path.resolve(file)} (sign these exact bytes with Ed25519)` : text));
          return 0;
        }
        err(`workflow ${sub}: use approval-request --requested-by ID | approval-statement --request DREQ-N --signer ID --role ROLE --decision approved|rejected; import with 'workflow approval import --file'`);
        return 2;
      }
      case 'approval': {
        if (action === 'request') {
          const scope = str(flags, 'scope') ?? loadPolicy(ctx).g2.default_scope;
          const by = str(flags, 'requested-by');
          if (!by) {
            err('workflow approval request: --requested-by <human identity> is required [--scope ...]');
            return 2;
          }
          const r = createApprovalRequest(loadWorkflow(ctx, runId), scope, by);
          print(r, () => {
            out(`${r.request_id}: approval requested for scope ${r.payload.scope.selector_text}`);
            out(`  request sha256: ${r.request_sha256}`);
            out(`  scope sha256:   ${r.payload.scope.scope_sha256}`);
            out(`  expires: ${r.payload.expires_at}; required role: ${r.payload.required_roles.join(' or ')}`);
            out(`  file: ${r.file}`);
            out(`  next: workflow approval statement --request ${r.request_id} --signer <id> --role <role> --decision approved --out statement.json, sign it outside the harness, then workflow approval import --file signed.json`);
          });
          return 0;
        }
        if (action === 'statement') {
          const id = str(flags, 'request');
          const signer = str(flags, 'signer');
          const role = str(flags, 'role');
          const decision = str(flags, 'decision') as 'approved' | 'rejected' | undefined;
          if (!id || !signer || !role || (decision !== 'approved' && decision !== 'rejected')) {
            err('workflow approval statement: --request AREQ-NNNN --signer ID --role ROLE --decision approved|rejected [--comment TEXT] [--out FILE]');
            return 2;
          }
          const wf = loadWorkflow(ctx, runId);
          const req = wf.store.readRecord('approvals/requests', `${id}.json`);
          const text = statementText(approvalStatement(req, signer, role, decision, str(flags, 'comment')));
          const file = str(flags, 'out');
          if (file) fs.writeFileSync(path.resolve(file), text, 'utf8');
          print({ statement: JSON.parse(text), canonical_text: text, written: file ?? null }, () => out(file ? `canonical statement written to ${path.resolve(file)} (sign these exact bytes with Ed25519)` : text));
          return 0;
        }
        if (action === 'verify' || action === 'import') {
          const file = str(flags, 'file');
          if (!file) {
            err(`workflow approval ${action}: --file <signed-approval.json>`);
            return 2;
          }
          const wf = loadWorkflow(ctx, runId);
          let design = false;
          try {
            design = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))?.contract === 'signed-design-approval';
          } catch {
            design = false;
          }
          // A signed architecture (G2) approval goes through the same trust model and verifier family.
          const r = design ? (action === 'verify' ? verifyDesignApprovalFile(wf, path.resolve(file)) : importDesignApproval(wf, path.resolve(file))) : action === 'verify' ? verifyApprovalFile(wf, path.resolve(file)) : importApproval(wf, path.resolve(file));
          const ok = action === 'verify' ? r.ok : r.imported;
          print(r, () => {
            out(action === 'verify' ? `signed approval ${ok ? 'VALID' : 'INVALID'}` : ok ? `IMPORTED ${r.approval_id} (${r.decision})` : 'REJECTED (recorded in the audit log)');
            for (const c of r.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
            if (action === 'import' && ok) out(design ? `  next: workflow gate --gate ${r.gate}, then workflow advance --to ARCHITECTURE_APPROVED` : `  next: workflow gate --gate G1, then workflow advance --to REQUIREMENTS_APPROVED`);
          });
          return ok ? 0 : 1;
        }
        err('workflow approval: use request | statement | verify | import');
        return 2;
      }
      case 'decisions': {
        const wf = loadWorkflow(ctx, runId);
        if (action === 'list') {
          const snap = buildSnapshot(wf);
          const scope = str(flags, 'scope');
          let ids: Set<string> | null = null;
          if (scope) {
            const ev = evaluateScope(snap, parseSelector(scope));
            ids = new Set(ev.findings.flatMap((f) => f.decisions));
          }
          const want = str(flags, 'status');
          const originF = str(flags, 'origin');
          const rows = [...snap.register.values()]
            .filter((d) => !ids || ids.has(d.decision_id))
            .map((d) => ({ decision_id: d.decision_id, kind: d.kind, origin: d.origin.type, blocking: d.blocking, status: snap.resolutions.get(d.decision_id)!.status, outcome: snap.resolutions.get(d.decision_id)!.outcome, resolution: snap.resolutions.get(d.decision_id)!.effective?.resolution_id ?? null, history: snap.resolutions.get(d.decision_id)!.history, units: d.affected_units.map((u) => u.name), requirements: d.affected_requirements, allowed_outcomes: d.allowed_outcomes, sha256: d.sha256, question: d.question }))
            .filter((d) => (!want || d.status === want) && (!originF || d.origin === originF) && (flags.blocking !== true || d.blocking));
          print(rows, () => {
            for (const d of rows) out(`${d.decision_id.padEnd(30)} ${d.origin.padEnd(13)} ${d.kind.padEnd(17)} ${d.blocking ? 'BLOCKING' : 'nonblock'} ${d.status}${d.resolution ? ` ${d.resolution} ${d.outcome}` : ''}  ${d.units.slice(0, 4).join(',')}`);
            const by = (k: string) => rows.filter((d) => d.status === k).length;
            out(`${rows.length} decision(s): ${by('open')} open, ${by('resolved')} resolved, ${by('stale')} stale, ${by('untrusted')} untrusted; ${rows.filter((d) => d.blocking && d.status !== 'resolved').length} blocking unresolved`);
          });
          return 0;
        }
        if (action === 'template') {
          const id = str(flags, 'decision');
          if (!id) {
            err('workflow decisions template: --decision ID [--out FILE]');
            return 2;
          }
          const t = resolutionTemplate(buildSnapshot(wf), id);
          const file = str(flags, 'out');
          if (file) fs.writeFileSync(path.resolve(file), JSON.stringify(t, null, 2) + '\n', 'utf8');
          print(t, () => out(file ? `unsigned resolution template written to ${path.resolve(file)}; a human with role ${JSON.stringify(t.required_roles_by_outcome)} completes and signs it` : JSON.stringify(t, null, 2)));
          return 0;
        }
        if (action === 'resolve') {
          const file = str(flags, 'file');
          if (!file) {
            err('workflow decisions resolve: --file <signed-resolution.json> [--dry-run]');
            return 2;
          }
          const r = resolveDecision(wf, path.resolve(file), { dryRun: flags['dry-run'] === true, build: (w) => buildSnapshot(w) });
          print(r, () => {
            out(r.recorded ? `RECORDED ${r.resolution_id} for ${r.decision}` : r.dry_run ? `dry run: ${r.ok ? 'VALID' : 'INVALID'}` : `REJECTED resolution for ${r.decision ?? '(unknown)'} (recorded in the audit log)`);
            for (const c of r.checks) out(`  [${c.ok ? 'ok' : 'FAIL'}] ${c.id}: ${c.detail}`);
          });
          return r.recorded || (r.dry_run && r.ok) ? 0 : 1;
        }
        err('workflow decisions: use list [--scope S] [--status open|resolved|stale|untrusted] [--origin agent|consolidation|derived] [--blocking] | template --decision ID | resolve --file F [--dry-run]');
        return 2;
      }
      case 'packets': {
        if (action !== 'review') {
          err('workflow packets: use review');
          return 2;
        }
        const r = recordPacketReview(loadWorkflow(ctx, runId));
        print(r, () => {
          out(`${r.id}: ${r.summary.unreceipted} packet(s) without an accepted receipt — ${r.summary.superseded} superseded, ${r.summary.still_required} still required`);
          for (const p of r.packets) out(`  ${p.packet_id} ${p.status.toUpperCase()}: ${p.justification}`);
        });
        return 0;
      }
      case 'record': {
        const file = str(flags, 'receipt');
        if (!file) {
          err('workflow record: specify --receipt <file>');
          return 2;
        }
        const r = recordReceipt(loadWorkflow(ctx, runId), path.resolve(file));
        print(r, () => {
          out(`${r.receipt_id} for ${r.packet_id}: ${r.verdict.accepted ? 'ACCEPTED' : 'REJECTED'}`);
          for (const v of r.verdict.violations) out(`  violation: ${v}`);
        });
        return r.verdict.accepted ? 0 : 1;
      }
      case 'blocked': {
        const r = blockedReport(loadWorkflow(ctx, runId));
        print(r, () => {
          out(`state ${r.state}; blockers: ${r.blockers.join('; ') || 'none'}`);
          for (const t of r.rejected_transitions) out(`  rejected transition ${t.from} -> ${t.to} at ${t.at}: ${t.reason}`);
          for (const d of r.rejected_dispatches) out(`  rejected dispatch ${d.agent} at ${d.at}: ${d.reason}`);
          for (const x of r.rejected_receipts) out(`  rejected receipt ${x.receipt_id}: ${(x.violations ?? []).join('; ')}`);
          for (const g of r.non_passing_gates) out(`  gate ${g.gate}: ${g.status}`);
          for (const p of r.undispatchable_packets) out(`  packet ${p.packet_id} not dispatchable: ${p.blockers.join('; ')}`);
        });
        return 0;
      }
      case 'resume': {
        const r = resume(ctx, runId);
        print(r, () => {
          out(`${r.resumed ? 'RESUMED' : 'NOT RESUMED'} — state ${r.state}`);
          if (r.recovered_lock) out(`  cleared interrupted operation: ${r.recovered_lock.op} (${r.recovered_lock.at})`);
          if (r.interrupted_events_sealed) out('  sealed audit events recorded after the last checkpoint');
          for (const p of r.problems) out(`  problem: ${p}`);
          if (r.action) out(`  ${r.action}`);
          if (r.awaiting_receipt?.length) out(`  awaiting receipt: ${r.awaiting_receipt.join(', ')}`);
        });
        return r.resumed ? 0 : 1;
      }
      default:
        err('workflow: use init | status | gate | advance | transitions | prepare | batches | coverage | record | reconcile | verify-access | verify-sources | correct | consolidate | g2 | approval | decisions | packets | blocked | resume');
        return 2;
    }
  } catch (e) {
    if (e instanceof OrchestratorError) {
      err(`workflow ${sub}: ${e.message}`);
      for (const d of e.details) err(`  - ${d}`);
      return 1;
    }
    if (e instanceof Error) {
      err(`workflow ${sub}: ${e.message}`);
      return 1;
    }
    throw e;
  }
}
