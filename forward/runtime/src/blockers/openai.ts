/**
 * Preparation of independent semantic-review packets for Step 5. Nothing is
 * sent: transmission is refused by the egress guard and source export is
 * NOT_AUTHORIZED until a signed authorization exists.
 *
 * Two passes are kept physically separate:
 *   Pass A  source evidence only: excerpts with line numbers and hashes,
 *           data definitions computed from the source, control-flow context,
 *           a neutral question and the expected output contract. It must not
 *           contain the existing (Claude) interpretation; a strict schema and
 *           a shingle leak check enforce that.
 *   Pass B  the existing interpretations, conflicting views and the
 *           deterministic results, for comparison with Pass A's answer.
 * Only cited files are excerpted; credential-like literals are redacted.
 */
import { canonicalize, digest } from '../approval/canonical';
import { Snapshot } from '../approval/snapshot';
import { contextFor, excerpt } from '../../../verification/src/facts';
import { LayoutNode } from '../../../verification/src/layout';
import { ExportAuthorization } from './egress';
import { SourceReader } from './deterministic';
import { Registry, RootCause } from './rootcauses';

export const DATA_CLASSIFICATION = 'confidential: proprietary application source code and derived analysis';
const SECRET = /\b(PASSWORD|PASSWD|PWD|SECRET|API-?KEY|TOKEN|CREDENTIAL)[A-Z0-9-]*\b[^']*VALUE\s+'([^']+)'/i;

/**
 * Packet-set export status. Export is decided per request by the STEP 5
 * egress guard (signed source-export authorization verified against the
 * trust store); this summary reports NOT_AUTHORIZED unless a currently valid
 * authorization exists, and even then only the packets in its scope qualify.
 */
export function exportAuthorization(snap: Snapshot): ExportAuthorization {
  const records = snap.wf.store.list('authorizations').filter((f) => f.startsWith('EXPORT-'));
  let valid: any[] = [];
  if (records.length) {
    const { authorizationStates } = require('../openai/authorization') as typeof import('../openai/authorization');
    const { loadOpenAIConfig } = require('../openai/config') as typeof import('../openai/config');
    valid = authorizationStates(snap.wf, loadOpenAIConfig(snap.wf.run.ctx).config).states.filter((s) => s.valid);
  }
  return {
    status: valid.length ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
    reason: valid.length ? `valid signed source-export authorization(s): ${valid.map((s) => s.authorization_id).join(', ')} (scope-limited; every request is re-checked at the network boundary)` : `${records.length ? 'no imported source-export authorization is currently valid' : 'no signed source-export authorization has been recorded'}; trust anchor ${snap.trust.usable ? 'usable' : 'not provisioned'}. Packets are prepared locally and must not leave this machine.`,
    authorization_record: valid[0]?.record ?? null,
  };
}

interface Loc {
  file_id: string;
  from: number;
  to: number;
}

export function locations(snap: Snapshot, r: RootCause): Loc[] {
  const locs: Loc[] = [];
  const addRef = (ref: any) => {
    if (!ref?.file_id) return;
    const st = ref.statement_id ? snap.ctx.statements.get(ref.statement_id) : null;
    if (st) locs.push({ file_id: ref.file_id, from: st.start_line, to: st.end_line ?? st.start_line });
    else if (typeof ref.line === 'number') locs.push({ file_id: ref.file_id, from: ref.line, to: ref.line });
  };
  for (const k of r.related.findings) {
    const [kind, id] = k.split('|');
    const it = snap.items.find((x) => x.kind === kind && x.id === id);
    it?.source_refs.forEach(addRef);
  }
  for (const id of r.related.rules) {
    const ps = snap.rules.get(id)?.primary_source;
    if (ps) addRef({ file_id: ps.source_ids?.file_id, statement_id: ps.source_ids?.statement_id ?? null, line: ps.line ?? null });
  }
  for (const d of r.related.primary_decisions.slice(0, 10)) snap.register.get(d)?.source_refs.slice(0, 5).forEach(addRef);
  if (r.source.location?.file_id && r.source.location.line) locs.push({ file_id: r.source.location.file_id, from: r.source.location.line, to: r.source.location.line });
  // Merge per file, with two lines of context, at most 40 lines per range.
  const byFile = new Map<string, Array<[number, number]>>();
  for (const l of locs) byFile.set(l.file_id, [...(byFile.get(l.file_id) ?? []), [Math.max(1, l.from - 2), Math.min(l.to + 2, l.from + 40)]]);
  const out: Loc[] = [];
  for (const [f, rs] of byFile) {
    rs.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const x of rs) if (merged.length && x[0] <= merged[merged.length - 1][1] + 1) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], x[1]);
    else merged.push([...x] as [number, number]);
    for (const [from, to] of merged.slice(0, 6)) out.push({ file_id: f, from, to });
  }
  return out.slice(0, 12);
}

function definitionOf(n: LayoutNode, usage: string) {
  return { name: n.name, level: n.level, pic: n.pic, usage, occurs: n.occurs, redefines: n.redefines, size_bytes: n.size, defined_at_line: n.line, condition_names: n.conditions.map((c) => ({ name: c.name, values: c.values })) };
}

const QUESTION: Record<string, string> = {
  default: 'Using only the source excerpts and definitions provided, state precisely what each excerpt does: the conditions it tests, the values it compares, assigns or computes, the data items it changes, and where control goes next. Cite line numbers for every statement. List explicitly what cannot be determined from these excerpts alone.',
  control_flow_uncertainty: 'Using only the source excerpts and definitions provided, describe the control flow: which paragraphs are performed or jumped to, the loop and termination conditions, and the paths by which each excerpt is reached or left. Cite line numbers. List explicitly what cannot be determined from these excerpts alone.',
  runtime_behavior_uncertainty: 'Using only the source excerpts and definitions provided, describe the run-time behaviour: file open modes and I/O, database commit or rollback points, counters and thresholds, error and restart handling. Cite line numbers. List explicitly what depends on the run-time environment and cannot be determined from these excerpts.',
  contradictory_business_rules: 'Using only the source excerpts and definitions provided, list every value each data item can take according to its declarations, and every place the code assigns or tests those values. Cite line numbers. State whether the excerpts are mutually consistent, without assuming which one is intended.',
};

const OUTPUT_CONTRACT = {
  type: 'object',
  required: ['packet_id', 'pass', 'findings', 'cannot_determine'],
  properties: {
    packet_id: { type: 'string' },
    pass: { enum: ['A', 'B'] },
    findings: { type: 'array', items: { type: 'object', required: ['lines', 'statement'], properties: { lines: { type: 'array', items: { type: 'integer' } }, statement: { type: 'string' }, conditions: { type: 'array' }, data_effects: { type: 'array' }, control_transfers: { type: 'array' } } } },
    cannot_determine: { type: 'array', items: { type: 'string' } },
    comparison: { type: 'array', description: 'Pass B only: per supplied interpretation, agree | disagree | insufficient_evidence with cited lines' },
  },
};

/** 6-word shingles of interpretation texts found in the non-source parts of Pass A. */
export function leakCheck(passA: any, interpretations: string[]): { leaked: boolean; matches: string[] } {
  const { sources: _s, definitions: _d, ...rest } = passA;
  const hay = ` ${canonicalize(rest).toUpperCase().replace(/[^A-Z0-9]+/g, ' ')} `;
  const matches: string[] = [];
  for (const t of interpretations) {
    const words = t.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i + 6 <= words.length; i++) {
      const sh = ` ${words.slice(i, i + 6).join(' ')} `;
      if (hay.includes(sh)) {
        matches.push(sh.trim());
        break;
      }
    }
  }
  return { leaked: matches.length > 0, matches };
}

export function interpretationsFor(snap: Snapshot, r: RootCause): Array<{ source: string; id: string; text: string }> {
  const out: Array<{ source: string; id: string; text: string }> = [];
  for (const k of r.related.findings) {
    const [kind, id] = k.split('|');
    const it = snap.items.find((x) => x.kind === kind && x.id === id);
    if (it?.kind === 'requirement') out.push({ source: 'requirement', id, text: `${it.data.title}. ${it.data.statement}` });
    if (it?.kind === 'runtime_requirement') out.push({ source: 'runtime_requirement', id, text: it.data.statement });
  }
  for (const id of r.related.rules) {
    const rule = snap.rules.get(id);
    if (rule) out.push({ source: 'reverse_rule', id, text: [rule.name, rule.description, rule.outcomes ? JSON.stringify(rule.outcomes) : ''].filter(Boolean).join('. ') });
  }
  for (const d of r.related.decisions.slice(0, 15)) {
    const x = snap.register.get(d);
    if (x && x.origin.type !== 'derived') out.push({ source: `decision:${x.origin.type}`, id: d, text: x.question });
  }
  for (const c of snap.contradictions.filter((x) => x.rule_ids.some((id) => r.related.rules.includes(id)))) out.push({ source: 'contradiction', id: c.id, text: c.data.description });
  return out;
}

export function preparePackets(snap: Snapshot, reg: Registry, det: any, reader = new SourceReader(snap), opts: { alsoCategories?: string[] } = {}): { queue: any; passA: any; passB: any } {
  const auth = exportAuthorization(snap);
  const res = new Map<string, any>(det.results.map((x: any) => [x.root_cause_id, x]));
  // Roots that need independent semantic review, plus (from STEP 5 configuration) blocking roots of the listed categories.
  const also = new Set(opts.alsoCategories ?? []);
  const selected = reg.roots.filter((r) => r.blocking && (res.get(r.root_cause_id)?.next_step === 'REQUIRES_INDEPENDENT_SEMANTIC_REVIEW' || also.has(r.category)));
  const passA: any[] = [];
  const passB: any[] = [];
  const queue: any[] = [];
  for (const r of selected) {
    const packet_id = `OAV-${r.root_cause_id.slice(3)}`;
    const sources: any[] = [];
    const definitions: any[] = [];
    const flow: any[] = [];
    const redactions: any[] = [];
    const seenDefs = new Set<string>();
    for (const l of locations(snap, r)) {
      const src = reader.byFileId(l.file_id);
      if (!src) {
        sources.push({ file_id: l.file_id, path: snap.ctx.relByFile.get(l.file_id) ?? null, sha256: null, lines: [l.from, l.to], excerpt: [], available: false });
        continue;
      }
      const lines = excerpt(src.file, l.from, l.to).map((x) => {
        const m = SECRET.exec(x.text);
        if (!m) return x;
        redactions.push({ path: src.rel, line: x.line, reason: 'credential-like literal' });
        return { line: x.line, text: x.text.replace(`'${m[2]}'`, "'<REDACTED>'") };
      });
      sources.push({ file_id: l.file_id, path: src.rel, sha256: src.sha256, lines: [l.from, l.to], excerpt: lines, available: true });
      const tokens = new Set(lines.flatMap((x) => (x.text.toUpperCase().match(/[A-Z][A-Z0-9-]*[A-Z0-9]/g) ?? [])));
      for (const rec of src.dd.records) {
        const walk = (n: LayoutNode, inh: string | null) => {
          const usage = n.usage_explicit ? (n.usage as string) : inh ?? 'DISPLAY';
          if ((tokens.has(n.name) || n.conditions.some((c) => tokens.has(c.name))) && !seenDefs.has(`${src.rel}#${n.name}`)) {
            seenDefs.add(`${src.rel}#${n.name}`);
            definitions.push({ file: src.rel, ...definitionOf(n, usage) });
          }
          n.children.forEach((c) => walk(c, n.usage_explicit ? n.usage : inh));
        };
        walk(rec.root, null);
      }
      if (src.pf.procedure_start && l.from > src.pf.procedure_start) {
        const c = contextFor(src.pf, l.from);
        flow.push({ file: src.rel, lines: [l.from, l.to], paragraph: c.paragraph, paragraph_lines: [c.from, c.to], performed_from_lines: c.performed_from, perform_until_in_paragraph: src.pf.performs.filter((p) => p.line >= c.from && p.line <= c.to && p.until).map((p) => ({ line: p.line, target: p.target, until: p.until })) });
      }
    }
    const missing: string[] = [];
    for (const prog of r.source.programs) {
      const s = reader.byProgram(prog);
      for (const i of s?.dd.includes.filter((x) => !x.resolved) ?? []) missing.push(`${prog}: ${i.circular ? 'circular' : 'unresolved'} include ${i.name} at line ${i.line}`);
      for (const c of s?.pf.calls.filter((x) => !snap.sys.programs.some((p) => p.program_id === x.target)) ?? []) missing.push(`${prog}: CALL ${c.target} at line ${c.line} has no source in the checkout`);
    }
    const a = {
      packet_id,
      pass: 'A',
      baseline_manifest_sha256: snap.wf.run.manifestSha256,
      root_cause_id: r.root_cause_id,
      data_classification: DATA_CLASSIFICATION,
      export_authorization: { status: auth.status, reason: auth.reason },
      sources,
      definitions: definitions.slice(0, 60),
      control_flow: flow,
      question: QUESTION[r.category] ?? QUESTION.default,
      missing_context: [...new Set(missing)].slice(0, 20),
      output_contract: OUTPUT_CONTRACT,
      redactions,
    };
    const interps = interpretationsFor(snap, r);
    const leak = leakCheck(a, interps.map((x) => x.text));
    const d = res.get(r.root_cause_id);
    const b = {
      packet_id,
      pass: 'B',
      pass_a_sha256: digest(a),
      root_cause_id: r.root_cause_id,
      export_authorization: { status: auth.status, reason: auth.reason },
      existing_interpretations: interps,
      conflicting_interpretations: [
        ...snap.consolidation.conflicts.filter((c: any) => r.related.rules.includes(c.rule_id)).map((c: any) => ({ rule: c.rule_id, dispositions: c.dispositions.map((e: any) => ({ packet: e.packet, disposition: e.disposition, reason: e.reason })) })),
        ...snap.contradictions.filter((c) => c.rule_ids.some((id) => r.related.rules.includes(id))).map((c) => ({ contradiction: c.id, description: c.data.description })),
      ],
      deterministic_results: { status: d?.status, next_step: d?.next_step, establishes: d?.establishes, does_not_establish: d?.does_not_establish, checks: (d?.checks ?? []).map((c: any) => ({ id: c.id, subject: c.subject, status: c.status, detail: c.detail })) },
      question: 'Compare your Pass A answer with each existing interpretation below. For each one state agree, disagree or insufficient_evidence, citing the source lines; identify any statement in an interpretation that the source does not support. Do not resolve business intent.',
      output_contract: OUTPUT_CONTRACT,
    };
    const usable = sources.some((s) => s.available) && !leak.leaked;
    passA.push(a);
    passB.push(b);
    const inScope = auth.status === 'AUTHORIZED' && (() => {
      const { authorizationStates } = require('../openai/authorization') as typeof import('../openai/authorization');
      const { loadOpenAIConfig } = require('../openai/config') as typeof import('../openai/config');
      return authorizationStates(snap.wf, loadOpenAIConfig(snap.wf.run.ctx).config).states.some((s) => s.valid && s.authorization.scope.packets.includes(packet_id));
    })();
    queue.push({ packet_id, root_cause_id: r.root_cause_id, title: r.title, category: r.category, pass_a_sha256: digest(a), pass_b_sha256: digest(b), sources: sources.length, source_lines: sources.reduce((n, s) => n + s.excerpt.length, 0), definitions: a.definitions.length, interpretations_in_pass_b: interps.length, leak_check: leak, redactions: redactions.length, status: inScope && usable ? 'AUTHORIZED_FOR_EXPORT' : 'NOT_AUTHORIZED', usable_when_authorized: usable });
  }
  const tally = (f: (q: any) => string) => queue.reduce((m: Record<string, number>, q) => ((m[f(q)] = (m[f(q)] ?? 0) + 1), m), {});
  return {
    queue: {
      contract: 'openai-verification-queue',
      contract_version: '1.0',
      generated_at: snap.at.toISOString(),
      baseline_manifest_sha256: snap.wf.run.manifestSha256,
      transmission: 'none — preparation only; the egress guard refuses every send in STEP 4.5',
      export_authorization: auth,
      data_classification: DATA_CLASSIFICATION,
      separation: 'Pass A (source only) and Pass B (existing interpretations) are separate sealed records; Pass B binds Pass A by hash; a strict Pass A schema and a 6-word shingle check reject any interpretation text in Pass A.',
      summary: { packets: queue.length, by_status: tally((q) => q.status), by_category: tally((q) => q.category), leaks_detected: queue.filter((q) => q.leak_check.leaked).length, without_available_source: queue.filter((q) => !q.usable_when_authorized).length },
      packets: queue,
    },
    passA: { contract: 'openai-pass-a', contract_version: '1.0', generated_at: snap.at.toISOString(), baseline_manifest_sha256: snap.wf.run.manifestSha256, export_authorization: auth.status, packets: passA },
    passB: { contract: 'openai-pass-b', contract_version: '1.0', generated_at: snap.at.toISOString(), baseline_manifest_sha256: snap.wf.run.manifestSha256, export_authorization: auth.status, packets: passB },
  };
}
