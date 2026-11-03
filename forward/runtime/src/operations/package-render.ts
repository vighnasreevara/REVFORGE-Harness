/** Plain-English rendering of a G2 review package (STEP 10). */
export function renderPackage(p: any): string {
  const L: string[] = [];
  L.push(`# Review package: ${p.scope}`, '');
  L.push(`**Status: ${p.status}.** This package is complete for review; it is not an approval.`, '');
  L.push(`- Scope digest: \`${p.scope_sha256}\``, `- Source baseline: \`${p.baseline_manifest_sha256}\``, `- Readiness: **${p.readiness}** (${p.blocking_findings.length} blocking finding(s))`, `- G2: **${p.g2.status}**`, `- Trust: **${p.trust.status}**${p.trust.uncovered.length ? ` (no signer for ${p.trust.uncovered.join(', ')})` : ''}`, '');
  L.push('## Units in scope', '', '| Unit | Kind | Relation | Source sha256 |', '|---|---|---|---|');
  for (const u of p.units) L.push(`| ${u.name} | ${u.unit_kind} | ${u.relation} | \`${String(u.source_sha256).slice(0, 16)}…\` |`);
  L.push('', '## Requirements and their evidence', '');
  L.push('Each layer is separate: finding source evidence is not verification, verification is not acceptance, and acceptance is not approval.', '');
  L.push('| Requirement | G2 outcome | Earlier check | Dependency-aware check | Evidence found | Verified | Accepted by reviewer | Decision resolved |', '|---|---|---|---|---|---|---|---|');
  for (const r of p.requirements) L.push(`| ${r.id} | ${r.g2_outcome}${r.blocking ? ' (blocking)' : ''} | ${r.earlier_claim_check ?? '-'} | ${r.context_status} | ${r.layers.source_evidence_found ? 'yes' : 'no'} | ${r.layers.deterministically_verified ? 'yes' : 'no'} | ${r.layers.accepted_by_authorised_reviewer ? 'yes' : 'no'} | ${r.layers.human_decision_resolved ? 'yes' : 'no'} |`);
  L.push('');
  for (const r of p.requirements) {
    L.push(`### ${r.id}`, '', `> ${r.statement ?? '(no statement)'}`, '');
    for (const i of r.inspect) L.push(`- **Inspect** \`${i.file}\` lines ${i.lines.join('–')}${i.cited_line !== null ? ` (cited line ${i.cited_line}${i.cited_line_inside_statement === false ? ', **outside the statement**' : ''})` : ''}.`);
    for (const c of r.chains) L.push(`- Dependency: the statement ${c.usage === 'sets_true' ? 'sets' : 'tests'} **${c.condition}**, declared at \`${c.declared}\` with VALUE ${JSON.stringify(c.values)} (${c.permanent_id ?? 'no permanent ID'}).`);
    for (const s of r.supplements) L.push(`- Evidence supplement \`${s.id}\` v${s.version}: ${s.status}; ${s.current ? 'current' : `not current (${s.problems.join('; ')})`}; ${s.eligible ? 'can be accepted by a signed review' : 'cannot be accepted'}.`);
    for (const a of r.adjudications) L.push(`- Adjudication \`${a.id}\` v${a.version}: ${a.classification}${a.superseding_status ? `, ${a.superseding_status}` : ''}; ${a.current ? 'current' : 'not current'}.`);
    if (r.blocking) L.push(`- **Why it blocks:** ${r.g2_reasons.slice(0, 3).join(' | ')}`);
    L.push('');
  }
  L.push('## Blocking decisions', '');
  for (const d of p.decisions_blocking) {
    L.push(`### ${d.decision_id} (${d.kind}, ${d.class})`, '', d.question, '');
    L.push(`Allowed outcomes: ${d.outcomes.map((o: any) => `\`${o.outcome}\` (${o.roles.join(' or ')})`).join(', ')}.`, '');
    if (d.facts) {
      const s = d.facts.separation;
      L.push(`Affects ${d.facts.counts.affected_units} unit(s), ${d.facts.counts.affected_requirements} requirement(s), ${d.facts.counts.affected_program_scopes} program scope(s).`, '');
      L.push('- **What the source shows:** ' + s.A_source_demonstrates.join('; '));
      L.push('- **What an external environment may provide:** ' + (s.B_external_environment_may_provide.join('; ') || 'nothing identified'));
      L.push('- **Unsupported assumptions:** ' + s.C_unsupported_assumptions.join('; '));
      L.push('- **Missing artefacts:** ' + (s.D_missing_artifacts.join('; ') || 'none identified'));
      L.push('- **To decide:** ' + s.E_must_be_decided, '');
    }
  }
  L.push('## Remediation proposals', '');
  for (const c of p.remediation_proposals) L.push(`- \`${c.proposal_id}\` ${c.item} ${c.pointer}: ${c.from} → ${c.to} ("${String(c.original_line_text ?? '').trim()}" → "${String(c.proposed_line_text ?? '').trim()}"); re-verified now: ${c.verified_now}; supports the full claim after correction: ${c.claim_supported_after_correction}; authorised only by a signed \`${c.decision}\` (${c.roles.join('/')}).`);
  if (!p.remediation_proposals.length) L.push('None.');
  L.push('', '## Unsigned resolution requests', '');
  for (const r of p.fresh_requests) L.push(`- ${r.decision_id}: \`${r.request_id}\` (expires ${r.expires_at})`);
  const stale = p.stale_requests.filter((s: any) => s.stale);
  if (stale.length) {
    L.push('', '**Stale earlier requests (must not be signed or reused):**', '');
    for (const s of stale) L.push(`- ${s.decision_id} \`${s.request_id ?? '(no request id)'}\` in \`${s.file.replace(/\\/g, '/').split('/forward/')[1] ?? s.file}\`: ${s.reasons.join('; ')}`);
  }
  L.push('', '## What G2 READY needs', '');
  for (const c of p.ready_conditions) L.push(`- ${c}`);
  L.push('', '## What G2 PASS needs', '');
  for (const c of p.pass_conditions) L.push(`- ${c}`);
  L.push('');
  return L.join('\n');
}
