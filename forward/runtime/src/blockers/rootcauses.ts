/**
 * Canonical root-cause registry.
 *
 * Findings and decisions are linked to the problem they stem from using
 * structural evidence only — never description similarity:
 *   - an unresolved COPY/CALL edge of the inventory (program + line) and the
 *     gaps recorded at that program line           -> one dependency root;
 *   - an origin gap (a source-level problem such as an empty source, a
 *     circular copy or an unresolvable path)          -> one root per gap;
 *   - symptom gaps (SME review, medium confidence, diagram issues) attach to
 *     the origin gaps or rules they name (related_gap_ids/related_rule_ids);
 *   - contradictory rules and the contradictions that cite them form one
 *     component; batch disagreements group by declaring source and pattern;
 *   - a citation the source contradicts is its own root (one per item);
 *   - evidence the agent did not establish groups per unit, item kind and
 *     reason (one delivery omission), decisions without any structural link
 *     stay their own root.
 * Every decision and finding keeps its identity: the registry only links.
 * Grouping is not resolution and changes no blocker.
 */
import { RegDecision } from '../approval/decisions';
import { Finding, ScopeEvaluation } from '../approval/scope';
import { Item, Snapshot } from '../approval/snapshot';
import { digest } from '../approval/canonical';
import { ITEM_KINDS } from './audit';

export type RootCategory =
  | 'missing_source_or_dependency'
  | 'incorrect_source_citation'
  | 'unsupported_business_interpretation'
  | 'contradictory_business_rules'
  | 'data_layout_inconsistency'
  | 'runtime_behavior_uncertainty'
  | 'control_flow_uncertainty'
  | 'missing_evidence'
  | 'program_scope_uncertainty'
  | 'approval_prerequisite';

/** Gap types that describe a source-level problem (origins); all others are symptoms of an origin or a rule. */
export const ORIGIN_GAP_CATEGORY: Record<string, RootCategory> = {
  EMPTY_SOURCE: 'missing_source_or_dependency',
  UNRESOLVED_COPYBOOK: 'missing_source_or_dependency',
  UNRESOLVED_CALL: 'missing_source_or_dependency',
  CIRCULAR_COPY: 'missing_source_or_dependency',
  UNDECLARED_DATA_NAME: 'data_layout_inconsistency',
  INVALID_QUALIFICATION: 'data_layout_inconsistency',
  AMBIGUOUS_DATA_REFERENCE: 'data_layout_inconsistency',
  UNRESOLVABLE_PATH: 'control_flow_uncertainty',
  UNSTRUCTURED_FLOW: 'control_flow_uncertainty',
  RECURSIVE_PERFORM: 'control_flow_uncertainty',
  SUSPECTED_LOGIC_DEFECT: 'control_flow_uncertainty',
  DEAD_CODE_CONFIRMED: 'control_flow_uncertainty',
  UNSUPPORTED_CONSTRUCT: 'control_flow_uncertainty',
  RUNTIME_CONDITIONAL_TRANSFER: 'runtime_behavior_uncertainty',
};

const DECISION_CATEGORY: Record<string, RootCategory> = {
  business: 'unsupported_business_interpretation',
  technical: 'control_flow_uncertainty',
  scope: 'program_scope_uncertainty',
  data_layout: 'data_layout_inconsistency',
  runtime_semantics: 'runtime_behavior_uncertainty',
  review: 'unsupported_business_interpretation',
};

const CODE: Record<RootCategory, string> = {
  missing_source_or_dependency: 'SRC',
  incorrect_source_citation: 'CIT',
  unsupported_business_interpretation: 'BIZ',
  contradictory_business_rules: 'CON',
  data_layout_inconsistency: 'DAT',
  runtime_behavior_uncertainty: 'RUN',
  control_flow_uncertainty: 'FLW',
  missing_evidence: 'EVD',
  program_scope_uncertainty: 'SCP',
  approval_prerequisite: 'APR',
};

/** Precedence when one subject links to several roots: the most fundamental origin is primary. */
const PRIORITY = ['DEP', 'GAP', 'CIT', 'CONTRA', 'XBATCH', 'LAYOUT', 'RULE', 'SCOPE', 'EVID', 'DEC', 'INTERP', 'COVERAGE', 'PACKET', 'CONSOLIDATION', 'APPROVAL'];
const rank = (k: string) => PRIORITY.indexOf(k.split(':')[0]);
const sortKeys = (ks: string[]) => [...new Set(ks)].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1));
const SEV = ['low', 'medium', 'high', 'critical'];

export interface RootCause {
  root_cause_id: string;
  key: string;
  category: RootCategory;
  title: string;
  baseline_manifest_sha256: string;
  source: { programs: string[]; file_ids: string[]; permanent_ids: string[]; location: { program: string | null; file_id: string | null; line: number | null; paragraph: string | null } | null };
  related: { rules: string[]; requirements: string[]; data_contracts: string[]; gaps: string[]; decisions: string[]; primary_decisions: string[]; findings: string[] };
  impacted_programs: string[];
  severity: string;
  blocking: boolean;
  evidence_status: string;
  approval_scope_impact: { application_blocking_findings: number; program_scopes_blocked: string[] };
  required_remediation: string;
  required_authority: string[];
  deterministic_verification_possible: boolean;
  resolution_status: 'open' | 'partially_resolved' | 'resolved' | 'not_a_decision';
}

export interface Registry {
  roots: RootCause[];
  decisionRoots: Map<string, string[]>; // decision -> keys (primary first)
  findingRoots: Map<string, string[]>; // kind|id -> keys (primary first)
  byKey: Map<string, RootCause>;
}

interface Ctx {
  snap: Snapshot;
  rawGaps: Map<string, any>;
  depByGap: Map<string, string>;
  contraKeyByRule: Map<string, string>;
  xbatchKeyByRule: Map<string, string>;
}

function buildCtx(snap: Snapshot): Ctx {
  const rawGaps = new Map<string, any>(((snap.set.artifacts.gaps?.data?.gaps ?? []) as any[]).map((g) => [g.gap_id, g]));
  // Unresolved inventory edge <-> gap at the same program and line.
  const depByGap = new Map<string, string>();
  for (const e of snap.sys.unresolved_edges) for (const g of rawGaps.values()) if (g.source_program === e.from && g.source_line === e.line && e.line !== null) depByGap.set(g.gap_id, `DEP:${e.to}`);
  // Contradictory rules: components over F1 contradictions' rule references and contradictory dispositions.
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  const contraRules = new Set<string>();
  for (const c of snap.contradictions) {
    c.rule_ids.forEach((r) => contraRules.add(r));
    for (let i = 1; i < c.rule_ids.length; i++) union(c.rule_ids[0], c.rule_ids[i]);
  }
  for (const [id, es] of snap.ruleEntries) if (es.some((e) => e.disposition === 'contradictory')) contraRules.add(id);
  const comps = new Map<string, string[]>();
  for (const r of contraRules) comps.set(find(r), [...(comps.get(find(r)) ?? []), r]);
  const contraKeyByRule = new Map<string, string>();
  for (const rs of comps.values()) for (const r of rs) contraKeyByRule.set(r, `CONTRA:${[...rs].sort().join('+')}`);
  // Cross-batch disagreements: grouped by declaring source file and disposition pattern.
  const xbatchKeyByRule = new Map<string, string>();
  for (const c of snap.consolidation.conflicts) {
    const r = snap.rules.get(c.rule_id);
    const file = r?.primary_source?.source_ids?.file_id ?? 'unknown';
    const sig = (c.dispositions ?? []).map((e: any) => `${e.packet}=${e.disposition}`).sort().join(',');
    xbatchKeyByRule.set(c.rule_id, `XBATCH:${file}:${sig}`);
  }
  return { snap, rawGaps, depByGap, contraKeyByRule, xbatchKeyByRule };
}

function gapKey(c: Ctx, gid: string, seen = new Set<string>()): string[] {
  if (seen.has(gid)) return [];
  seen.add(gid);
  if (c.depByGap.has(gid)) return [c.depByGap.get(gid)!];
  const g = c.rawGaps.get(gid);
  if (!g) return [`GAP:${gid}`];
  if (ORIGIN_GAP_CATEGORY[g.gap_type]) return [`GAP:${gid}`];
  // Symptom: attach to the origins it names, else to its rules, else stand alone.
  const origins = (g.related_gap_ids ?? []).filter((x: string) => c.depByGap.has(x) || ORIGIN_GAP_CATEGORY[c.rawGaps.get(x)?.gap_type]).flatMap((x: string) => gapKey(c, x, seen));
  if (origins.length) return origins;
  if ((g.related_rule_ids ?? []).length) return (g.related_rule_ids as string[]).map((r) => ruleKey(c, r));
  return [`GAP:${gid}`];
}

function ruleKey(c: Ctx, rule: string): string {
  return c.contraKeyByRule.get(rule) ?? c.xbatchKeyByRule.get(rule) ?? `RULE:${rule}`;
}

function decisionKeys(c: Ctx, d: RegDecision): string[] {
  if (d.origin.type === 'consolidation') return sortKeys(d.rule_ids.map((r) => ruleKey(c, r)));
  if (d.kind === 'scope' && d.affected_units.length === 1 && d.affected_units[0].unit_kind === 'program') return [`SCOPE:${d.affected_units[0].name}`];
  if (d.origin.type === 'derived') {
    const it = d.origin.item;
    if (it?.kind === 'gap') return gapKey(c, it.id);
    if (it && ITEM_KINDS.includes(it.kind)) {
      const item = c.snap.itemById.get(it.id);
      return item ? itemOwnKeys(c, item) : [`DEC:${d.decision_id}`];
    }
    return [`DEC:${d.decision_id}`];
  }
  const keys = [...d.gap_ids.flatMap((g) => gapKey(c, g)), ...d.rule_ids.map((r) => ruleKey(c, r))];
  return keys.length ? sortKeys(keys) : [`DEC:${d.decision_id}`];
}

/** Roots of an item's own (non-decision) problems. */
function itemOwnKeys(c: Ctx, it: Item): string[] {
  const keys: string[] = [];
  const unit = it.units[0]?.name ?? 'unknown';
  for (const comp of it.components) {
    if (comp.outcome === 'VERIFIED' || comp.outcome === 'APPROVED_EXCEPTION') continue;
    if (comp.outcome === 'CONTRADICTED' && /outside|not found in the parser|not found at lines/.test(comp.reason)) keys.push(`CIT:${it.id}`);
    else if (comp.outcome === 'CONTRADICTED') keys.push(it.kind === 'data_record' ? `LAYOUT:${it.id}` : `CIT:${it.id}`);
    else if (comp.source === 'sme_flag' || /interpretation/.test(comp.reason)) {
      const rules: string[] = (it.data?.derived_from_rules ?? []).map((r: any) => r.id);
      keys.push(...(rules.length ? rules.map((r) => ruleKey(c, r)) : [`INTERP:${it.id}`]));
    } else {
      const why = /reverse artifacts only/.test(comp.reason) ? 'reverse_only' : /declared verified_from_source/.test(comp.reason) ? 'unconfirmed_claim' : /unresolved|no Java type/.test(comp.reason) ? 'unresolved' : 'other';
      keys.push(`EVID:${unit}:${it.kind}:${why}`);
    }
  }
  return sortKeys(keys);
}

function findingKeys(c: Ctx, f: Finding, decisionRoots: Map<string, string[]>): string[] {
  if (ITEM_KINDS.includes(f.kind)) {
    const it = c.snap.items.find((x) => x.kind === f.kind && x.id === f.id);
    const own = it ? itemOwnKeys(c, it) : [];
    const viaDecisions = f.decisions.filter((d) => !d.startsWith('RVW-')).flatMap((d) => decisionRoots.get(d) ?? []);
    return sortKeys([...own, ...viaDecisions]);
  }
  if (c.snap.register.has(f.id)) return decisionRoots.get(f.id) ?? [`DEC:${f.id}`];
  switch (f.kind) {
    case 'rule':
      if (f.outcome === 'EXCLUDED_WITH_JUSTIFICATION' || f.outcome === 'VERIFIED') return [];
      return sortKeys([ruleKey(c, f.id), ...f.decisions.flatMap((d) => decisionRoots.get(d) ?? [])]);
    case 'contradiction': {
      const cr = c.snap.contradictions.find((x) => x.id === f.id);
      return cr?.rule_ids.length ? [ruleKey(c, cr.rule_ids[0])] : [`DEC:${f.id}`];
    }
    case 'unresolved_dependency':
      return [`DEP:${f.id.split('->')[1]}`];
    case 'excluded_dependency':
      return [`SCOPE:${f.id}`];
    case 'packet':
      return [`PACKET:${f.id}`];
    case 'consolidation':
      return ['CONSOLIDATION'];
    default:
      return f.kind.startsWith('coverage') ? [`COVERAGE:${f.id}`] : [`DEC:${f.id}`];
  }
}

function categoryFor(c: Ctx, key: string, decisions: RegDecision[]): RootCategory {
  const [type, rest] = [key.split(':')[0], key.slice(key.indexOf(':') + 1)];
  switch (type) {
    case 'DEP':
      return 'missing_source_or_dependency';
    case 'GAP':
      return ORIGIN_GAP_CATEGORY[c.rawGaps.get(rest)?.gap_type] ?? (decisions[0] ? DECISION_CATEGORY[decisions[0].kind] : 'missing_evidence');
    case 'CIT':
      return 'incorrect_source_citation';
    case 'CONTRA':
    case 'XBATCH':
      return 'contradictory_business_rules';
    case 'LAYOUT':
      return 'data_layout_inconsistency';
    case 'RULE':
    case 'INTERP':
      return 'unsupported_business_interpretation';
    case 'SCOPE':
      return 'program_scope_uncertainty';
    case 'EVID':
    case 'COVERAGE':
    case 'PACKET':
    case 'CONSOLIDATION':
      return 'missing_evidence';
    case 'APPROVAL':
      return 'approval_prerequisite';
    default:
      return decisions[0] ? DECISION_CATEGORY[decisions[0].kind] : 'missing_evidence';
  }
}

const REMEDIATION: Record<RootCategory, string> = {
  missing_source_or_dependency: 'Obtain the missing source member or runtime component (or confirm it is retired/provided by the platform), add it read-only to the source checkout and re-run the affected reverse and forward steps; until then the affected behaviour stays unverified.',
  incorrect_source_citation: 'Correct the citation through a versioned remediation proposal, approved by a signed resolution and applied as a validated correction; then re-verify the claim against the corrected citation.',
  unsupported_business_interpretation: 'Have a business SME confirm, correct or exclude the interpretation (signed resolution); independent semantic review may prepare the question.',
  contradictory_business_rules: 'A business SME must choose the intended behaviour; the source facts establish the conflict but not which side is intended.',
  data_layout_inconsistency: 'A technical authority must decide the authoritative layout; deterministic checks establish sizes, PIC/USAGE and offsets where the source is complete.',
  runtime_behavior_uncertainty: 'A technical authority must confirm the runtime behaviour (file modes, commit and restart semantics, platform services) using the source facts and operational documentation.',
  control_flow_uncertainty: 'A technical authority must confirm the intended control flow; deterministic checks establish targets and references, not intent.',
  missing_evidence: 'Establish the evidence: independently verify the claims against the source (where possible) or deliver the missing analysis; otherwise exclude with justification or, where policy permits, sign an exception.',
  program_scope_uncertainty: 'A business SME or product owner must decide whether the program is in the modernisation scope (signed scope resolution).',
  approval_prerequisite: 'Provision the external trust store and obtain a signed approval of a READY scope.',
};

const DETERMINISTIC: Record<RootCategory, boolean> = {
  missing_source_or_dependency: true,
  incorrect_source_citation: true,
  unsupported_business_interpretation: false,
  contradictory_business_rules: true,
  data_layout_inconsistency: true,
  runtime_behavior_uncertainty: true,
  control_flow_uncertainty: true,
  missing_evidence: true,
  program_scope_uncertainty: false,
  approval_prerequisite: false,
};

export function buildRegistry(snap: Snapshot, app: ScopeEvaluation, programScopes: Map<string, ScopeEvaluation>): Registry {
  const c = buildCtx(snap);
  const decisionRoots = new Map<string, string[]>();
  for (const d of snap.register.values()) decisionRoots.set(d.decision_id, decisionKeys(c, d));
  const findingRoots = new Map<string, string[]>();
  for (const f of app.findings) {
    const ks = findingKeys(c, f, decisionRoots);
    if (ks.length) findingRoots.set(`${f.kind}|${f.id}`, ks);
  }
  // Approval prerequisites are roots of their own (global).
  const approvalKeys: string[] = [];
  if (!snap.trust.usable) approvalKeys.push('APPROVAL:TRUST_ANCHOR');
  approvalKeys.push('APPROVAL:SIGNED_APPROVAL');

  const members = new Map<string, { decisions: Set<string>; primary: Set<string>; findings: Set<string> }>();
  const get = (k: string) => members.get(k) ?? (members.set(k, { decisions: new Set(), primary: new Set(), findings: new Set() }), members.get(k)!);
  for (const [d, ks] of decisionRoots) ks.forEach((k, i) => {
    get(k).decisions.add(d);
    if (i === 0) get(k).primary.add(d);
  });
  for (const [f, ks] of findingRoots) ks.forEach((k) => get(k).findings.add(f));
  approvalKeys.forEach(get);

  // Which program scopes each root blocks.
  const scopesBlocked = new Map<string, Set<string>>();
  for (const [prog, ev] of programScopes) for (const f of ev.findings.filter((x) => x.blocking)) {
    const ks = findingRoots.get(`${f.kind}|${f.id}`) ?? findingKeys(c, f, decisionRoots);
    for (const k of ks) scopesBlocked.set(k, new Set([...(scopesBlocked.get(k) ?? []), prog]));
  }
  const findingByKey = new Map(app.findings.map((f) => [`${f.kind}|${f.id}`, f]));

  const roots: RootCause[] = [];
  for (const [key, m] of [...members.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || (a[0] < b[0] ? -1 : 1))) {
    const decs = [...m.decisions].map((d) => snap.register.get(d)!).filter(Boolean);
    const fnds = [...m.findings].map((f) => findingByKey.get(f)!).filter(Boolean);
    const category = key.startsWith('APPROVAL') ? 'approval_prerequisite' : categoryFor(c, key, decs);
    const [type, rest] = [key.split(':')[0], key.slice(key.indexOf(':') + 1)];
    const gaps = new Set<string>([...decs.flatMap((d) => d.gap_ids), ...(type === 'GAP' ? [rest] : [])]);
    if (type === 'DEP') for (const [g, k] of c.depByGap) if (k === key) gaps.add(g);
    const rules = new Set<string>([...decs.flatMap((d) => d.rule_ids), ...(type === 'RULE' ? [rest] : []), ...(type === 'CONTRA' ? rest.split('+') : []), ...fnds.filter((f) => f.kind === 'rule').map((f) => f.id)]);
    const reqs = new Set<string>([...decs.flatMap((d) => d.affected_requirements), ...fnds.filter((f) => f.kind === 'requirement').map((f) => f.id)]);
    const data = new Set<string>(fnds.filter((f) => f.kind === 'data_record').map((f) => f.id));
    const programs = new Set<string>([...decs.flatMap((d) => d.affected_units.filter((u) => u.unit_kind === 'program').map((u) => u.name)), ...fnds.flatMap((f) => f.units)]);
    const refs = [...decs.flatMap((d) => d.source_refs), ...fnds.flatMap((f) => snap.itemById.get(f.id)?.source_refs ?? [])];
    const fileIds = new Set<string>(refs.map((r: any) => r?.file_id).filter(Boolean));
    const perm = new Set<string>(refs.flatMap((r: any) => Object.values(r ?? {}).filter((v) => typeof v === 'string' && /^SYS-/.test(v as string)) as string[]));
    let location: RootCause['source']['location'] = null;
    const g0 = type === 'GAP' ? c.rawGaps.get(rest) : type === 'DEP' ? [...gaps].map((g) => c.rawGaps.get(g)).find(Boolean) : null;
    if (g0) location = { program: g0.source_program ?? null, file_id: g0.source_ids?.file_id ?? null, line: g0.source_line ?? null, paragraph: g0.source_paragraph ?? null };
    else if (type === 'DEP') {
      const e = snap.sys.unresolved_edges.find((x) => x.to === rest);
      if (e) location = { program: e.from, file_id: snap.sys.programs.find((p) => p.program_id === e.from)?.file_id ?? null, line: e.line, paragraph: null };
    } else if (refs[0]) location = { program: null, file_id: (refs[0] as any).file_id ?? null, line: (refs[0] as any).line ?? null, paragraph: (refs[0] as any).paragraph_id ?? null };
    const sev = [...gaps].map((g) => c.rawGaps.get(g)?.severity).filter(Boolean) as string[];
    const blockingF = fnds.filter((f) => f.blocking);
    const blocking = blockingF.length > 0 || decs.some((d) => d.blocking && snap.resolutions.get(d.decision_id)!.status !== 'resolved') || key.startsWith('APPROVAL');
    let severity = sev.sort((a, b) => SEV.indexOf(b) - SEV.indexOf(a))[0] ?? (blockingF.some((f) => f.outcome === 'CONTRADICTED') ? 'high' : blocking ? 'medium' : 'low');
    if (blockingF.some((f) => f.outcome === 'CONTRADICTED') && SEV.indexOf(severity) < 2) severity = 'high';
    if (key.startsWith('APPROVAL')) severity = 'critical';
    const authority = new Set<string>();
    for (const d of decs) for (const r of snap.policy.roles.decision[d.kind] ?? []) authority.add(r);
    if (category === 'approval_prerequisite') snap.policy.roles.requirements_approval.forEach((r) => authority.add(r));
    if (!authority.size) (category === 'unsupported_business_interpretation' || category === 'contradictory_business_rules' || category === 'program_scope_uncertainty' ? snap.policy.roles.decision.business : snap.policy.roles.decision.technical).forEach((r) => authority.add(r));
    const states = decs.map((d) => snap.resolutions.get(d.decision_id)!.status);
    const resolution: RootCause['resolution_status'] = !decs.length ? 'not_a_decision' : states.every((s) => s === 'resolved') ? 'resolved' : states.some((s) => s === 'resolved') ? 'partially_resolved' : 'open';
    const title =
      type === 'DEP' ? `Unresolved dependency ${rest}` :
      type === 'GAP' ? `${c.rawGaps.get(rest)?.gap_type ?? 'Gap'} ${rest}: ${c.rawGaps.get(rest)?.title ?? ''}` :
      type === 'CIT' ? `Citation of ${rest} contradicted by the source` :
      type === 'CONTRA' ? `Contradictory rules ${rest.split('+').join(', ')}` :
      type === 'XBATCH' ? `Batches disagree on rules declared in ${rest.split(':')[0]}` :
      type === 'RULE' ? `Interpretation of ${rest} (${snap.rules.get(rest)?.name ?? 'rule'}) unconfirmed` :
      type === 'SCOPE' ? `Modernisation scope of ${rest} undecided` :
      type === 'EVID' ? `${rest.split(':')[1]} evidence of ${rest.split(':')[0]} not established (${rest.split(':')[2]})` :
      type === 'LAYOUT' ? `Layout of ${rest} contradicted by the source` :
      type === 'INTERP' ? `Interpretation of ${rest} unconfirmed` :
      type === 'APPROVAL' ? (rest === 'TRUST_ANCHOR' ? 'No trust anchor (trust store) is provisioned' : 'No signed human approval of a READY scope') :
      type === 'DEC' ? `Decision ${rest}${snap.register.get(rest) ? `: ${snap.register.get(rest)!.question.slice(0, 120)}` : ''}` :
      key;
    roots.push({
      root_cause_id: `RC-${CODE[category]}-${digest(key).slice(0, 10)}`,
      key,
      category,
      title: title.slice(0, 240),
      baseline_manifest_sha256: snap.wf.run.manifestSha256,
      source: { programs: [...programs].sort(), file_ids: [...fileIds].sort(), permanent_ids: [...perm].sort().slice(0, 50), location },
      related: { rules: [...rules].sort(), requirements: [...reqs].sort(), data_contracts: [...data].sort(), gaps: [...gaps].sort(), decisions: [...m.decisions].sort(), primary_decisions: [...m.primary].sort(), findings: [...m.findings].sort() },
      impacted_programs: [...new Set([...programs, ...(scopesBlocked.get(key) ?? [])])].sort(),
      severity,
      blocking,
      evidence_status: 'not_yet_checked',
      approval_scope_impact: { application_blocking_findings: blockingF.length, program_scopes_blocked: [...(scopesBlocked.get(key) ?? [])].sort() },
      required_remediation: REMEDIATION[category],
      required_authority: [...authority].sort(),
      deterministic_verification_possible: DETERMINISTIC[category],
      resolution_status: resolution,
    });
  }
  const byKey = new Map(roots.map((r) => [r.key, r]));
  return { roots, decisionRoots, findingRoots, byKey };
}

export function registryRecord(snap: Snapshot, reg: Registry, app: ScopeEvaluation): any {
  const blockingDecisions = [...snap.register.values()].filter((d) => d.blocking && snap.resolutions.get(d.decision_id)!.status !== 'resolved');
  const primaryOf = (d: string) => reg.decisionRoots.get(d)?.[0] ?? null;
  const decisionsPerRoot = new Map<string, number>();
  for (const d of snap.register.keys()) {
    const p = primaryOf(d);
    if (p) decisionsPerRoot.set(p, (decisionsPerRoot.get(p) ?? 0) + 1);
  }
  const grouped = [...snap.register.keys()].filter((d) => (decisionsPerRoot.get(primaryOf(d)!) ?? 0) > 1);
  const blockingFindings = app.findings.filter((f) => f.blocking);
  const orphans = blockingFindings.filter((f) => !reg.findingRoots.has(`${f.kind}|${f.id}`)).map((f) => `${f.kind}|${f.id}`);
  const blockingRoots = reg.roots.filter((r) => r.blocking);
  const primaryOfFindings = new Set(blockingFindings.map((f) => reg.findingRoots.get(`${f.kind}|${f.id}`)?.[0]).filter(Boolean));
  const primaryOfDecisions = new Set(blockingDecisions.map((d) => primaryOf(d.decision_id)).filter(Boolean));
  return {
    contract: 'root-cause-registry',
    contract_version: '1.0',
    generated_at: snap.at.toISOString(),
    baseline_manifest_sha256: snap.wf.run.manifestSha256,
    method: 'Structural links only (inventory edges, gap origin/related IDs, rule IDs, contradiction components, item citations, delivery evidence class). Description similarity is never used. Every decision and finding is preserved and mapped; grouping resolves nothing.',
    summary: {
      root_causes: reg.roots.length,
      blocking_root_causes: blockingRoots.length,
      blocking_root_causes_definition: 'roots linked (primarily or secondarily) to at least one blocking finding or blocking unresolved decision, plus approval prerequisites',
      primary_root_causes_of_blocking_findings: primaryOfFindings.size,
      primary_root_causes_of_blocking_decisions: primaryOfDecisions.size,
      primary_root_causes_of_blocking_findings_or_decisions: new Set([...primaryOfFindings, ...primaryOfDecisions]).size,
      by_category: reg.roots.reduce((m: Record<string, number>, r) => ((m[r.category] = (m[r.category] ?? 0) + 1), m), {}),
      blocking_by_category: blockingRoots.reduce((m: Record<string, number>, r) => ((m[r.category] = (m[r.category] ?? 0) + 1), m), {}),
      register_decisions: snap.register.size,
      blocking_unresolved_decisions: blockingDecisions.length,
      decisions_mapped: [...snap.register.keys()].filter((d) => reg.decisionRoots.has(d)).length,
      decisions_sharing_a_root_with_another_decision: grouped.length,
      roots_with_several_decisions: [...decisionsPerRoot.values()].filter((n) => n > 1).length,
      blocking_findings: blockingFindings.length,
      blocking_findings_mapped: blockingFindings.length - orphans.length,
      blocking_findings_without_root: orphans,
    },
    roots: reg.roots,
    decision_view: [...snap.register.values()].map((d) => ({ decision_id: d.decision_id, origin: d.origin.type, kind: d.kind, blocking: d.blocking, status: snap.resolutions.get(d.decision_id)!.status, sha256: d.sha256, primary_root_cause: reg.byKey.get(primaryOf(d.decision_id)!)?.root_cause_id ?? null, other_root_causes: (reg.decisionRoots.get(d.decision_id) ?? []).slice(1).map((k) => reg.byKey.get(k)?.root_cause_id ?? k) })),
  };
}
