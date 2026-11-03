import { checkPermanentIdOwnership, checkRunLocalRefs, Finding, KnownIdentities } from '../../../verification/src/references';
import { ArtifactSet, loadArtifacts } from '../core/artifacts';
import { RuntimeContext } from '../core/config';
import { discoverSystem } from '../core/model';

export interface ValidationReport {
  ok: boolean;
  findings: Finding[];
  set: ArtifactSet;
}

export function knownIdentities(set: ArtifactSet): KnownIdentities | null {
  const inv = set.artifacts.inventory;
  if (!inv?.valid) return null;
  const d = inv.data;
  const fileIds = new Set<string>();
  const pathIds = new Set<string>();
  for (const r of [...(d.file_registry ?? []), ...(d.copybook_registry ?? []), ...(d.jcl_registry ?? []), ...(d.other_file_registry ?? [])]) {
    if (r.file_id) fileIds.add(r.file_id);
    if (r.path_id) pathIds.add(r.path_id);
  }
  return {
    systemId: d.meta.system_id,
    fileIds,
    pathIds,
    ruleIds: new Set(((set.artifacts.rules?.data?.business_rules ?? []) as any[]).map((r) => r.rule_id)),
    gapIds: new Set(((set.artifacts.gaps?.data?.gaps ?? []) as any[]).map((g) => g.gap_id)),
  };
}

/** Validates input structures (contracts) and cross-artifact references. Read-only. */
export function runValidation(ctx: RuntimeContext, preloaded?: ArtifactSet): ValidationReport {
  const set = preloaded ?? loadArtifacts(ctx);
  const findings: Finding[] = [];

  for (const a of Object.values(set.artifacts)) {
    if (!a.present) {
      findings.push({ severity: a.required ? 'error' : 'warning', code: a.required ? 'required_artifact_missing' : 'optional_artifact_missing', artifact: a.repo_path, message: a.errors[0] ?? 'missing' });
      continue;
    }
    if (!a.parsed) {
      findings.push({ severity: 'error', code: 'artifact_unparseable', artifact: a.repo_path, message: a.errors.join('; ') });
      continue;
    }
    if (!a.valid) findings.push({ severity: a.required ? 'error' : 'warning', code: 'contract_violation', artifact: a.repo_path, message: a.errors.slice(0, 10).join('; ') });
  }
  for (const f of [...set.logicFiles, ...set.rawStructureFiles]) {
    if (!f.valid) findings.push({ severity: 'error', code: f.present ? 'per_program_file_invalid' : 'per_program_file_missing', artifact: f.repo_path, message: f.errors.join('; ') });
  }

  const known = knownIdentities(set);
  if (known) {
    // System ID consistency.
    for (const a of Object.values(set.artifacts)) {
      const sid = a.data?.meta?.system_id;
      if (a.format === 'json' && sid && sid !== known.systemId) {
        findings.push({ severity: 'error', code: 'system_id_mismatch', artifact: a.repo_path, message: `meta.system_id ${sid} differs from the inventory's ${known.systemId}` });
      }
    }
    // Permanent ID ownership across artifacts.
    for (const k of ['parser', 'data', 'logic', 'rules', 'diagrams', 'gaps']) {
      const a = set.artifacts[k];
      if (a?.parsed) findings.push(...checkPermanentIdOwnership(a.repo_path, a.data, known));
    }
    for (const f of set.logicFiles) if (f.data) findings.push(...checkPermanentIdOwnership(f.repo_path, f.data, known));

    // Run-local reference integrity.
    const rules = set.artifacts.rules?.data;
    const gaps = set.artifacts.gaps?.data;
    if (rules) {
      const setIds = new Set(((rules.rule_sets ?? []) as any[]).map((s) => s.rule_set_id));
      findings.push(...checkRunLocalRefs(set.artifacts.rules.repo_path, ((rules.rule_sets ?? []) as any[]).flatMap((s) => s.rule_ids ?? []), known.ruleIds, 'rule'));
      const badSets = ((rules.business_rules ?? []) as any[]).filter((r) => r.rule_set_id && !setIds.has(r.rule_set_id)).map((r) => `${r.rule_id}->${r.rule_set_id}`);
      if (badSets.length) findings.push({ severity: 'error', code: 'dangling_rule_set_ref', artifact: set.artifacts.rules.repo_path, message: `rules cite unknown rule sets: ${badSets.slice(0, 20).join(', ')}` });
    }
    if (gaps) {
      const gl = (gaps.gaps ?? []) as any[];
      const gapRuleRefs = gl.flatMap((g) => [...(g.related_rule_ids ?? []), ...((g.affected ?? []) as any[]).map((i) => i?.rule_id).filter(Boolean)]);
      findings.push(...checkRunLocalRefs(set.artifacts.gaps.repo_path, gapRuleRefs, known.ruleIds, 'rule'));
      findings.push(...checkRunLocalRefs(set.artifacts.gaps.repo_path, gl.flatMap((g) => g.related_gap_ids ?? []), known.gapIds, 'gap'));
      const noRef = gl.filter((g) => !g.source_program && !g.source_ids?.file_id && !(g.source_ids?.file_ids ?? []).length).map((g) => g.gap_id);
      if (noRef.length) findings.push({ severity: 'info', code: 'gap_without_source_reference', artifact: set.artifacts.gaps.repo_path, message: `${noRef.length} system-level gap(s) carry no program or File ID (handled explicitly): ${noRef.join(', ')}` });
      const dups = gl.map((g) => g.gap_id).filter((id, i, a) => a.indexOf(id) !== i);
      if (dups.length) findings.push({ severity: 'error', code: 'duplicate_gap_id', artifact: set.artifacts.gaps.repo_path, message: dups.join(', ') });
    }

    const sys = discoverSystem(set);
    for (const m of sys.coverage_mismatches) findings.push({ severity: 'warning', code: 'coverage_mismatch', message: m });
    const dupProg = sys.programs.filter((p) => p.duplicate_program_id).map((p) => `${p.program_id} (${p.file_id})`);
    if (dupProg.length) findings.push({ severity: 'warning', code: 'duplicate_program_id', message: dupProg.join(', ') });
    if (sys.unresolved_edges.length)
      findings.push({ severity: 'info', code: 'unresolved_inventory_edges', message: `${sys.unresolved_edges.length} unresolved call/include edge(s) recorded by the inventory (expected to appear as gaps)` });
  }

  return { ok: !findings.some((f) => f.severity === 'error'), findings, set };
}
