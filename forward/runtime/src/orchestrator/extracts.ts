/**
 * Runtime-prepared, deterministic input extracts for a dispatch packet. They
 * are slices of the reverse artifacts for the packet's units (nothing is
 * interpreted or invented); offsets in the F2 worksheet are computed from the
 * reverse layout tree and labelled as such. Extracts are written by the
 * runtime only and hashed into the packet like any other input.
 */
import * as fs from 'fs';
import * as path from 'path';
import { allowedJavaTypes, cobolCategory } from '../../../verification/src/numeric';
import { ArtifactSet } from '../core/artifacts';
import { DiscoveredSystem, normalizeGaps, sourceRunKey } from '../core/model';
import { gapScopePrograms } from '../core/planning';
import { Classification } from './classification';

export interface Unit {
  unit_kind: 'program' | 'copybook';
  name: string;
  file_id: string;
}

export function unitKey(u: Unit): string {
  return `${u.unit_kind}:${u.file_id}`;
}

/** All coverage units for an agent's unit kinds, discovered dynamically. */
export function allUnits(sys: DiscoveredSystem, kinds: Array<'program' | 'copybook'>): Unit[] {
  const out: Unit[] = [];
  if (kinds.includes('program')) for (const p of sys.programs) out.push({ unit_kind: 'program', name: p.program_id, file_id: p.file_id });
  if (kinds.includes('copybook')) for (const c of sys.copybooks) if (c.type === 'copybook' && c.file_id) out.push({ unit_kind: 'copybook', name: c.name, file_id: c.file_id });
  return out;
}

/** Rule IDs in scope for a set of program units: implemented there, or declared in a copybook they use. */
export function rulesInScope(set: ArtifactSet, programs: string[]): string[] {
  const rules: any[] = set.artifacts.rules?.data?.business_rules ?? [];
  const rbp: Record<string, string[]> = set.artifacts.rules?.data?.rules_by_program ?? {};
  const ps = new Set(programs);
  const ids = new Set<string>();
  for (const r of rules) {
    const impl = new Set<string>([...(r.implemented_in_programs ?? []), ...((r.sources ?? []) as any[]).map((s) => s.program_id).filter(Boolean)]);
    if ([...impl].some((p) => ps.has(p))) ids.add(r.rule_id);
  }
  for (const p of programs) for (const id of rbp[p] ?? []) ids.add(id);
  return rules.map((r) => r.rule_id).filter((id) => ids.has(id));
}

export function gapsInScope(set: ArtifactSet, sys: DiscoveredSystem, units: Unit[]): string[] {
  const gaps = normalizeGaps(set.artifacts.gaps);
  const programs = new Set(units.filter((u) => u.unit_kind === 'program').map((u) => u.name));
  const files = new Set(units.map((u) => u.file_id));
  return gaps.filter((g) => g.file_ids.some((f) => files.has(f)) || gapScopePrograms(g, sys).some((p) => programs.has(p))).map((g) => g.ref.id);
}

function writeJson(dir: string, name: string, data: unknown): string {
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
  return p;
}

/* ------------------------------------------------------------------ */
/* F1                                                                  */
/* ------------------------------------------------------------------ */

export function buildF1Extracts(dir: string, set: ArtifactSet, sys: DiscoveredSystem, units: Unit[], classification: Classification[], runDir: string, repoRoot: string): string[] {
  const programs = units.filter((u) => u.unit_kind === 'program').map((u) => u.name);
  const ruleIds = new Set(rulesInScope(set, programs));
  const rulesA = set.artifacts.rules;
  const gapsA = set.artifacts.gaps;
  const gapIds = new Set(gapsInScope(set, sys, units));
  const normalized = normalizeGaps(gapsA).filter((g) => gapIds.has(g.ref.id));
  const rel = (p: string) => path.relative(repoRoot, p).split(path.sep).join('/');
  const ctx = units.map((u) => {
    const p = sys.programs.find((x) => x.file_id === u.file_id);
    const c = classification.find((x) => x.file_id === u.file_id);
    return {
      unit: u,
      classification: c ? { class: c.class, confidence: c.confidence, modernization_scope: c.modernization_scope, conflicts: c.conflicts } : null,
      relative_path: p?.relative_path ?? null,
      parse_status: p?.parse?.status ?? null,
      logic_status: p?.logic?.status ?? null,
      entry_types: p?.logic?.entry_types ?? [],
      logic_file: p?.logic?.logic_file ? `output/logic/${p.logic.logic_file}` : null,
      evidence_packet: rel(path.join(runDir, 'evidence_packets', `${u.file_id}__${u.name}.json`)),
      rules_in_scope: rulesInScope(set, [u.name]),
    };
  });
  return [
    writeJson(dir, 'rules_extract.json', {
      extract: 'rules',
      source_run: sourceRunKey(rulesA),
      note: 'Verbatim business_rules entries of the reverse rules artifact that are in scope for this packet (implemented in, or declared in a copybook used by, the packet programs). Every rule listed in rules_in_scope must receive exactly one rule_coverage disposition.',
      rules_in_scope: [...ruleIds],
      rules: (rulesA.data.business_rules as any[]).filter((r) => ruleIds.has(r.rule_id)),
    }),
    writeJson(dir, 'gaps_extract.json', {
      extract: 'gaps',
      source_run: sourceRunKey(gapsA),
      note: 'Verbatim gaps relevant to this packet plus every expanded affected item (GAP-NNN#NN). Expansion is not resolution.',
      gaps: (gapsA.data.gaps as any[]).filter((g) => gapIds.has(g.gap_id)),
      expanded_items: normalized.flatMap((g) => g.items.map((i) => ({ item_id: i.item_id, gap_id: g.ref.id, severity: g.severity, reference_status: i.reference_status, program_id: i.program_id, file_id: i.file_id, detail: i.detail }))),
      assumptions: gapsA.data.assumptions ?? [],
    }),
    writeJson(dir, 'program_context.json', { extract: 'program_context', units: ctx }),
  ];
}

/* ------------------------------------------------------------------ */
/* F2                                                                  */
/* ------------------------------------------------------------------ */

interface WorksheetField {
  field_id: string | null;
  field_name: string;
  path: string | null;
  level: number;
  cobol_category: string;
  pic: string | null;
  usage: string;
  signed: boolean | null;
  digits: number | null;
  decimals: number | null;
  byte_length: number | null;
  occurs: number | null;
  offset: number | null;
  offset_basis: 'computed_from_reverse_layout' | 'unresolved';
  redefines: string | null;
  redefines_field_id: string | null;
  value: string | null;
  allowed_java_types: string[];
  source_line: number | null;
}

function layoutFileFor(dataDir: string, fileId: string): string | null {
  const dir = path.join(dataDir, 'data_layouts');
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).find((n) => n.startsWith(`${fileId}__`) && n.endsWith('.json'));
  return f ? path.join(dir, f) : null;
}

/** Walks a layout record tree, computing byte offsets from item sizes (REDEFINES share the redefined item's offset). */
function worksheet(record: any, catalogue: Map<string, any>): { fields: WorksheetField[]; notes: string[] } {
  const fields: WorksheetField[] = [];
  const notes: string[] = [];
  const walk = (items: any[], base: number | null) => {
    let cursor = base;
    const offsetsByName = new Map<string, number | null>();
    for (const it of items ?? []) {
      if (it.type === 'copy_expansion' || it.include_kind) continue;
      const isCond = it.is_condition === true || it.level === 88;
      const cat = it.field_id ? catalogue.get(it.field_id) : undefined;
      const pp = it.pic_parsed ?? {};
      const isGroup = !isCond && (it.type === 'GROUP' || (!it.pic && Array.isArray(it.children) && it.children.some((c: any) => c.level !== 88)));
      const facts = {
        normalized_type: cat?.normalized_type ?? pp.normalized_type ?? null,
        storage_type: cat?.storage_type ?? pp.storage_type ?? null,
        length: cat?.length ?? pp.length ?? null,
        decimal_places: cat?.decimal_places ?? pp.decimal_places ?? null,
        is_condition: isCond,
        is_group: isGroup,
      };
      const occurs = typeof it.occurs === 'number' ? it.occurs : it.occurs?.max ?? it.occurs?.times ?? null;
      const bytes = typeof it.bytes === 'number' ? it.bytes : null;
      let offset: number | null = isCond ? null : cursor;
      if (!isCond && it.redefines) {
        offset = offsetsByName.has(it.redefines) ? (offsetsByName.get(it.redefines) as number | null) : null;
        if (offset === null) notes.push(`${it.name}: REDEFINES ${it.redefines} target offset unknown`);
      }
      const redefTarget = it.redefines ? fields.find((f) => f.field_name === it.redefines && f.level === it.level) : undefined;
      fields.push({
        field_id: it.field_id ?? null,
        field_name: it.name,
        path: it.path ?? null,
        level: it.level,
        cobol_category: cobolCategory(facts),
        pic: it.pic ?? null,
        usage: isCond ? 'CONDITION' : isGroup ? 'GROUP' : String(facts.storage_type ?? 'UNKNOWN'),
        signed: isCond || isGroup ? null : (cat?.signed ?? pp.signed ?? null),
        digits: isCond || isGroup ? null : facts.length,
        decimals: isCond || isGroup ? null : facts.decimal_places,
        byte_length: isCond ? null : bytes,
        occurs,
        offset,
        offset_basis: offset === null ? 'unresolved' : 'computed_from_reverse_layout',
        redefines: it.redefines ?? null,
        redefines_field_id: redefTarget?.field_id ?? null,
        value: it.value ?? (Array.isArray(it.values) ? it.values.join(',') : null),
        allowed_java_types: allowedJavaTypes(facts),
        source_line: typeof it.line === 'number' ? it.line : null,
      });
      if (!isCond) {
        offsetsByName.set(it.name, offset);
        if (Array.isArray(it.children) && it.children.length) walk(it.children, offset);
        if (!it.redefines) cursor = cursor === null || bytes === null ? null : cursor + bytes * (occurs ?? 1);
      } else if (Array.isArray(it.children)) walk(it.children, null);
    }
  };
  walk(record.children ?? [], 0);
  return { fields, notes };
}

export function buildF2Extracts(dir: string, set: ArtifactSet, sys: DiscoveredSystem, units: Unit[], repoRoot: string): string[] {
  const data = set.artifacts.data.data;
  const dataDir = path.dirname(set.artifacts.data.path);
  const catalogue = new Map<string, any>((data.field_catalogue as any[]).filter((f) => f.field_id).map((f) => [f.field_id, f]));
  const conds = data.condition_catalogue as any[];
  const unitFiles = new Set(units.map((u) => u.file_id));
  const records = (data.record_catalogue as any[]).filter((r) => unitFiles.has(r.file_id));
  const out: any[] = [];
  for (const r of records) {
    const lf = layoutFileFor(dataDir, r.file_id);
    let ws: { fields: WorksheetField[]; notes: string[] } = { fields: [], notes: ['layout file not found; offsets unresolved'] };
    if (lf) {
      const L = JSON.parse(fs.readFileSync(lf, 'utf8'));
      const rec = (L.records as any[]).find((x) => x.record_id === r.record_id);
      if (rec) ws = worksheet(rec, catalogue);
    }
    out.push({
      record: r,
      catalogue_fields: (data.field_catalogue as any[]).filter((f) => f.record_id === r.record_id),
      condition_names: conds.filter((c) => c.parent_record_id === r.record_id),
      layout_worksheet: ws.fields,
      worksheet_notes: ws.notes,
    });
  }
  const issues = (data.issues as any[]).filter((i) => unitFiles.has(i.file_id) || units.some((u) => i.program_id === u.name || i.copybook === u.name));
  const unresolvedStubs = issues.filter((i) => /unresolved_copy_stub|copy_target_is_program/.test(String(i.type)));
  const rel = (p: string) => path.relative(repoRoot, p).split(path.sep).join('/');
  const fileContext = units
    .filter((u) => u.unit_kind === 'program')
    .map((u) => {
      const p = sys.programs.find((x) => x.file_id === u.file_id);
      const raw = set.rawStructureFiles.find((f) => f.file_id === u.file_id);
      return {
        unit: u,
        relative_path: p?.relative_path ?? null,
        entry_types: p?.logic?.entry_types ?? [],
        file_control_entries: raw?.data?.environment_division?.file_control_entries ?? [],
        file_section: raw?.data?.data_division?.file_section ?? null,
        raw_structure_file: raw ? raw.repo_path : null,
        logic_file: p?.logic?.logic_file ? `output/logic/${p.logic.logic_file}` : null,
        calls_out: p?.calls_out ?? [],
        includes: p?.includes ?? [],
        jcl_jobs: p?.jcl_jobs ?? [],
        layout_file: (() => {
          const lf = layoutFileFor(dataDir, u.file_id);
          return lf ? rel(lf) : null;
        })(),
      };
    });
  return [
    writeJson(dir, 'data_extract.json', {
      extract: 'data',
      note: 'Verbatim record/field/condition catalogue entries for the packet units, plus a runtime layout worksheet. Worksheet offsets are computed from reverse layout item sizes (offset_basis computed_from_reverse_layout) and are NOT source-verified. allowed_java_types is the only permitted set for java_type.',
      units,
      records: out,
      issues,
      unresolved_copy_stubs: unresolvedStubs,
    }),
    writeJson(dir, 'file_context.json', { extract: 'file_context', units: fileContext }),
  ];
}
