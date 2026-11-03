/** Markdown rendering of the source-context verification report (STEP 9). */
export function renderContextReport(r: any, recorded: any[], all: any[]): string {
  const L: string[] = [];
  L.push(`# Source-context verification: ${r.scope}`, '');
  L.push(`Generated ${r.generated_at}; baseline \`${String(r.baseline_manifest_sha256).slice(0, 16)}…\`; source available: ${r.source_available}.`, '');
  L.push('| Item | Existing claim check | Dependency-aware result | Values supported through a dependency chain | Contradictions |', '|---|---|---|---|---|');
  for (const x of r.results) L.push(`| ${x.item_id} | ${x.existing.claim_result ?? '-'} | ${x.status} | ${x.literal_support.filter((l: any) => l.support === 'declared_value_of_referenced_condition').map((l: any) => `'${l.literal}'`).join(', ') || '-'} | ${x.contradictions.length} |`);
  L.push('', '## Dependency chains', '');
  for (const x of r.results.filter((y: any) => y.additional_references.length)) {
    L.push(`**${x.item_id}** (${x.status})`, '');
    for (const a of x.additional_references) L.push(`- \`${a.usage}\` ${a.condition} → \`${a.declared_in}:${a.line}\` VALUE ${JSON.stringify(a.values)}, parent ${a.parent}, permanent ID \`${a.condition_id ?? 'none'}\`${a.include_chain.length ? `, via ${a.include_chain.map((c: any) => `COPY ${c.member} (${c.included_from}:${c.line})`).join(' → ')}` : ''}`);
    L.push(`- Source hashes: ${x.source_hashes.map((h: any) => `\`${h.path}\` ${String(h.sha256).slice(0, 12)}…`).join(', ')}`);
    L.push(`- Human decision: ${x.human_decision_needed.why}`, '');
  }
  const unc = r.results.filter((y: any) => y.uncertainties.length || y.metadata_disagreements.length);
  if (unc.length) {
    L.push('## Uncertainties and metadata disagreements', '');
    for (const x of unc) for (const u of [...x.metadata_disagreements, ...x.uncertainties]) L.push(`- ${x.item_id}: ${u}`);
    L.push('');
  }
  L.push('## Evidence supplements', '');
  if (!all.length) L.push('None recorded.');
  for (const s of all) L.push(`- \`${s.supplement_id}\` v${s.version} for ${s.item_id}: ${s.result.status}; acceptance ${s.acceptance.eligible ? 'possible' : 'not possible'} via ${s.acceptance.how}. ${s.effect}.`);
  L.push('', `Recorded in this run: ${recorded.filter((x) => x.new).map((x) => x.supplement_id).join(', ') || 'none'}.`, '');
  return L.join('\n');
}
