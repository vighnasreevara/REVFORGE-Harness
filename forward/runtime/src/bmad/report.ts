/** Markdown rendering of the BMad integration status (STEP 6). */
export function renderBmadReport(data: any, d: any): string {
  const L: string[] = [];
  L.push('# BMad integration status', '');
  L.push(`Generated ${data.generated_at}. Package \`${data.release.package}@${data.release.version}\`: staged and verified = **${data.release.verified}**, installed = **false**.`, '');
  L.push('## Release verification', '', '| Check | Result | Detail |', '|---|---|---|');
  for (const c of data.release.checks) L.push(`| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${String(c.detail).replace(/\|/g, '\\|')} |`);
  for (const c of data.impact.checks) L.push(`| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${String(c.detail).replace(/\|/g, '\\|')} |`);
  L.push('', '## Bindings', '', '| Binding | Workflow | Agent | Gates | Valid |', '|---|---|---|---|---|');
  for (const b of data.bindings.bindings) {
    const cfg = d.loaded.config?.bindings.find((x: any) => x.binding_id === b.binding_id);
    L.push(`| ${b.binding_id} | \`${b.workflow_id}\` | ${b.agent} | ${cfg?.requires_gates.join(', ') ?? ''} | ${b.ok ? 'yes' : 'NO'} |`);
  }
  const w = data.workflow;
  L.push('', '## Workflow records', '');
  if (!w || w.error) L.push(`No workflow: ${w?.error ?? 'none'}`);
  else {
    L.push(`Records intact: **${w.records_intact}** (${w.integrity.length} record(s)).`, '');
    L.push(`- Eligibility evaluations: ${w.eligibility.length} (${w.eligibility.filter((x: any) => x.eligible).length} eligible)`);
    L.push(`- Recorded dry runs: ${w.dry_runs.length}`);
    L.push(`- Packets: ${w.packets.length}`);
    L.push(`- Receipts: ${w.receipts.length} (${w.receipts.filter((x: any) => x.accepted).length} accepted; none counts toward a gate)`);
    L.push(`- Refusals: ${w.rejections.length}`);
    for (const r of w.rejections.slice(-10)) L.push(`  - #${r.seq} ${r.workflow} ${r.mode} ${r.scope}: ${r.reasons.slice(0, 3).join('; ')}`);
  }
  L.push('');
  return L.join('\n');
}
