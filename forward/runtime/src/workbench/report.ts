/**
 * STEP 5.5 reports, rendered from the sealed workbench records only.
 */
const esc = (s: unknown) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const t = (o: Record<string, number> | undefined) => Object.entries(o ?? {}).map(([k, v]) => `${k} ${v}`).join(', ') || 'none';

export function renderCandidates(c: any): string {
  const L: string[] = ['# First approval scope: recommendation and comparison', ''];
  L.push(`Generated ${c.generated_at}. ${c.programs.length} program scopes and ${c.requirements.length} requirement scopes evaluated with the existing G1 evaluator. **This is a proposal, not an approval.**`, '');
  L.push(`Ranking: meaningful scopes first (application program with source text and a source-verified requirement), then the lowest workload score (root causes weighted ${t(c.weights.class)}, plus ${c.weights.dependency} per shared dependency), then fewer units, then more requirements.`, '');
  L.push('## Top three program scopes', '');
  for (const x of c.top_three) L.push(`### ${x.rank}. ${x.scope}`, '', x.explanation, '');
  L.push(`## Recommended first scope: \`${c.recommended?.scope ?? 'none'}\``, '', c.recommended ? c.recommendation_reason : 'No meaningful scope found.', '');
  L.push('## All program scopes', '', '| Rank | Scope | Meaningful | Score | Root causes (A/B/C/D/E) | Reqs | Deps | Blocking | Not recommended because |', '|---|---|---|---|---|---|---|---|---|');
  c.programs.forEach((x: any, i: number) => L.push(`| ${i + 1} | ${x.primary} | ${x.meaningful ? 'yes' : 'no'} | ${x.workload_score} | ${['A', 'B', 'C', 'D', 'E'].map((k) => (x.root_causes[k] ?? []).length).join('/')} | ${x.requirements.length} | ${x.units.length - 1} | ${x.blocking_findings} | ${esc(x.meaningful_reasons.join('; '))} |`));
  L.push('', '## Narrowest alternatives (requirement scopes)', '', '| Scope | Score | Root causes (A/B/C/D/E) | Blocking |', '|---|---|---|---|');
  for (const x of c.requirements.slice(0, 10)) L.push(`| ${x.primary} | ${x.workload_score} | ${['A', 'B', 'C', 'D', 'E'].map((k) => (x.root_causes[k] ?? []).length).join('/')} | ${x.blocking_findings} |`);
  return L.join('\n') + '\n';
}

export function renderPackets(p: any): string {
  const L: string[] = [`# Human decision packets — ${p.scope}`, '', p.rule, '', `Scope digest \`${p.scope_sha256}\`. ${p.summary.root_causes} root cause(s) (${t(p.summary.by_class)}), ${p.summary.blocking_decisions} blocking decision(s).`, ''];
  for (const x of p.packets) {
    L.push(`## ${x.root_cause_id} — class ${x.class}: ${x.class_meaning}`, '', `**${esc(x.title)}**`, '');
    L.push(`- **What the COBOL appears to do:** ${esc(x.what_the_cobol_appears_to_do)}`);
    L.push(`- **Objective technical fact:** ${x.objective_technical_fact.proven ? 'yes' : 'no'} — ${esc(x.objective_technical_fact.statement)}`);
    L.push(`- **Why the issue exists:** ${esc(x.why_the_issue_exists.join(' | ')).slice(0, 900)}`);
    L.push(`- **Why human judgment is needed:** ${esc(x.why_human_judgment_is_needed)}`);
    L.push(`- **Affected:** requirements ${x.affected.requirements.join(', ') || 'none'}; data contracts ${x.affected.data_contracts.join(', ') || 'none'}`);
    L.push(`- **Authorized roles:** ${x.authorized_roles.join(', ')}`);
    if (x.ai_advisory) L.push(`- **AI advisory:** ${x.ai_advisory.runs.join(', ')} — ${x.ai_advisory.note}`);
    L.push('', 'Source evidence:', '');
    for (const s of x.source_evidence) {
      L.push(`\`${s.path}\` lines ${s.lines.join('-')} (sha256 ${String(s.sha256).slice(0, 16)}…)`, '', '```cobol', ...s.excerpt.map((l: any) => `${String(l.line).padStart(5)} ${l.text}`), '```', '');
    }
    for (const d of x.decisions) {
      L.push(`**Decision ${d.decision_id}** (${d.kind}, ${d.origin}, status ${d.status}): ${esc(d.question)}`, '');
      for (const o of d.supported_outcomes) L.push(`- \`${o.outcome}\` — ${o.effect} *Who:* ${o.authorized_roles.join(' or ')}.`);
      if (d.resolution_request) L.push(`- Resolution request: \`${d.resolution_request}\``);
      L.push('');
    }
  }
  return L.join('\n') + '\n';
}

export function renderChecklist(c: any): string {
  const L: string[] = [`# Approval operations checklist — ${c.scope}`, '', `${c.summary.actions} actions (${c.summary.done} done, ${c.summary.pending} pending, ${c.summary.blocked} blocked). Human workload: ${c.summary.root_causes} root cause(s) covering ${c.summary.decisions} decision(s); every original decision is kept.`, ''];
  L.push('| # | Actor | Action | IDs | Role | Status | Depends on | Verified by |', '|---|---|---|---|---|---|---|---|');
  for (const a of c.actions) L.push(`| ${a.step} | ${a.actor} | ${esc(a.action)} | ${esc(a.ids.join(', ')).slice(0, 300)} | ${esc(a.role)} | ${a.status} | ${a.depends_on.join(', ')} | \`${esc(a.verified_by)}\` |`);
  L.push('', '## Consolidated human workload (by root cause)', '', '| Root cause | Class | Decisions | Roles |', '|---|---|---|---|');
  for (const w of c.consolidated_human_workload) L.push(`| ${w.root_cause_id} ${esc(w.title).slice(0, 70)} | ${w.class} | ${w.decisions.join(', ')} | ${w.authorized_roles.join(', ')} |`);
  return L.join('\n') + '\n';
}

export function renderReadiness(r: any, trust: any): string {
  const L: string[] = [`# G1 readiness — ${r.scope}`, '', `Readiness **${r.readiness}**; G1 can pass: **${r.g2_can_pass}**. Scope digest \`${r.scope_sha256}\`.`, ''];
  L.push(`- Unique root causes: ${r.unique_root_causes}`, `- Blocking findings: ${r.blocking_findings}`, `- Blocking decisions: ${r.blocking_decisions.join(', ') || 'none'}`, `- Trust: ${trust.status}`, '');
  L.push('## Why G1 cannot pass', '', ...r.why_g2_cannot_pass.map((x: string) => `- ${x}`), '');
  L.push('## Failing checks', '', '| Check | Blocking | Items |', '|---|---|---|');
  for (const c of r.failing_checks) L.push(`| ${c.check} | ${c.blocking} | ${esc(c.items.join(', ')).slice(0, 400)} |`);
  L.push('', '## Source evidence issues', '', '| Item | Outcome | Reason |', '|---|---|---|');
  for (const s of r.source_evidence_issues) L.push(`| ${s.kind}:${s.id} | ${s.outcome} | ${esc(s.reason).slice(0, 250)} |`);
  L.push('', '## Trust roles', '', '| Role | Covered | Signers |', '|---|---|---|');
  for (const x of trust.roles) L.push(`| ${x.role} | ${x.covered ? 'yes' : 'no'} | ${x.signers.join(', ') || '—'} |`);
  return L.join('\n') + '\n';
}

export function renderStep55(all: any): string {
  const { candidates: c, pkg, packets, corrections, trust, pilot, readiness, checklist, sealed } = all;
  const L: string[] = ['# STEP 5.5 — G1 approval readiness, human decision workbench and first modernization scope', ''];
  L.push(`Run \`${pkg.baseline.run_id}\`, baseline \`${pkg.baseline.manifest_sha256}\`, generated ${pkg.generated_at} by \`workbench report\`. Everything below is **preparation**: no decision was resolved, no correction applied, no authorization signed, no approval created, no source sent.`, '');
  L.push('## 1. Candidate scopes', '');
  for (const x of c.top_three) L.push(`${x.rank}. ${x.explanation}`);
  L.push('', `**Recommended first scope: \`${c.recommended?.scope}\`.** ${c.recommendation_reason}`, '');
  L.push('## 2. Scope coverage', '');
  L.push(`- Units: ${pkg.dependency_closure.primary.join(', ')} (primary); shared dependencies: ${pkg.dependency_closure.dependencies.map((d: any) => `${d.name} (${d.unit_kind})`).join(', ') || 'none'}.`);
  L.push(`- Requirements: ${pkg.requirements.map((r: any) => `${r.requirement_id} [${r.g2_outcome}]`).join(', ')}.`);
  L.push(`- Business rules: ${pkg.business_rules.map((r: any) => `${r.rule_id} [${r.g2_outcome}]`).join(', ') || 'none'}.`);
  L.push(`- Data contracts: ${pkg.data_contracts.length}; file/runtime contracts: ${pkg.file_runtime_contracts.length}.`);
  L.push(`- Scope digest \`${pkg.manifest.scope_sha256}\`; readiness ${pkg.manifest.readiness}.`, '');
  L.push('## 3. Root causes and decisions', '');
  L.push('| Root cause | Class | Title | Decisions in scope | Deterministic |', '|---|---|---|---|---|');
  for (const r of pkg.root_causes) L.push(`| ${r.root_cause_id} | ${r.class} | ${esc(r.title).slice(0, 90)} | ${r.decisions_in_scope.join(', ')} | ${r.deterministic.status} |`);
  L.push('', `Blocking decisions (${pkg.blocking_decisions.length}): ${pkg.blocking_decisions.map((d: any) => `${d.decision_id} (${d.kind})`).join(', ')}.`, '');
  L.push('## 4. Evidence and citation problems', '');
  for (const e of pkg.evidence_defects) L.push(`- ${e.kind} ${e.id}: ${e.outcome} — ${esc(e.reasons[0]).slice(0, 220)}`);
  L.push('', `Citation corrections in scope: ${corrections.proposals.length} (verified against current source now: ${corrections.summary.verified_now}; authorized: 0).`);
  for (const p of corrections.proposals) L.push(`- ${p.proposal_id} v${p.version}: ${p.item} ${p.pointer} ${p.original_value} → ${p.proposed_value}; original line \`${esc(p.original_line_text)}\`, proposed line \`${esc(p.proposed_line_text)}\`; checks ${p.checks.map((x: any) => `${x.id}=${x.ok ? 'ok' : 'FAIL'}`).join(', ')}; authorization ${p.authorization.status} via ${p.authorization.decision}.`);
  L.push('', '## 5. Human review work', '', `${checklist.summary.root_causes} root cause(s), ${checklist.summary.decisions} decision(s); ${checklist.summary.actions} ordered actions (${checklist.summary.done} done, ${checklist.summary.pending} pending, ${checklist.summary.blocked} blocked). See \`step-5.5/approval-operations-checklist.md\`.`, '');
  L.push('## 6. Trust', '', `Status: **${trust.status}**${trust.problems.length ? ` (${trust.problems.join('; ')})` : ''}. Roles needed: ${trust.roles.map((r: any) => `${r.role} ${r.covered ? 'covered' : 'missing'}`).join(', ')}.`, '');
  L.push('## 7. OpenAI live pilot (prepared, not sent)', '', `Status **${pilot.status}** — blocked by: ${pilot.blocked_by.join('; ')}. ${pilot.cases.length} case(s) prepared from ${pilot.unsettled_eligible} unsettled eligible packet(s) in scope (of ${pilot.candidates_in_scope}).`, '');
  for (const x of pilot.cases) L.push(`- ${x.packet_id} (${x.category}, deterministic ${x.deterministic_status}): ${x.source_evidence.map((s: any) => `${s.path} ${s.lines.join('-')}`).join('; ')}; estimated ≤ ${x.estimated_tokens.pass_a_input + x.estimated_tokens.pass_b_input_max} input / ≤ ${x.estimated_tokens.pass_a_output_max + x.estimated_tokens.pass_b_output_max} output tokens, ≤ $${x.estimated_cost_usd_upper_bound}.`);
  L.push('', `Total upper bound: $${pilot.total_estimate.cost_usd_upper_bound} at the configured rates. Source-export authorization request: unsigned, \`step-5.5/openai-pilot-authorization-request.json\`.`, '');
  L.push('## 8. G1 for this scope', '', `Readiness **${readiness.readiness}**, ${readiness.unique_root_causes} unique root cause(s), ${readiness.blocking_findings} blocking finding(s), ${readiness.blocking_decisions.length} blocking decision(s). G1 can pass: **no**.`, '', ...readiness.why_g2_cannot_pass.map((x: string) => `- ${x}`), '');
  L.push('## Sealed records', '', '| Record | SHA-256 |', '|---|---|');
  for (const [k, v] of Object.entries(sealed as Record<string, any>)) L.push(`| workflow/step55/${v.id}.json (${k}) | \`${v.sha256}\` |`);
  return L.join('\n') + '\n';
}
