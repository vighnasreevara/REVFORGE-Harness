/**
 * STEP 3.5 remediation: reconciliation, access/provenance supplements,
 * independent source verification, validated technical corrections and
 * cross-batch consolidation. Every operation writes a new, versioned record
 * under workflow/{verification,corrections,consolidation}/ and seals it in
 * the audit log. Original deliverables, receipts and packets are never
 * modified: their SHA-256 values are recorded before and after.
 */
import * as fs from 'fs';
import * as path from 'path';
import { codeText, line as srcLine, normPic, parseDataEntry, rangeText, sourceFile, SourceFile, storageBytes } from '../../../verification/src/cobol-source';
import { loadArtifacts } from '../core/artifacts';
import { readJson, sha256File } from '../core/fsutil';
import { discoverSystem } from '../core/model';
import { mutate, RecordedReceipt, Workflow } from '../orchestrator/orchestrator';
import { accessFor, AccessLevel, filesRead, normPath, parseTranscript, TranscriptAccess } from './transcripts';

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ */
/* record helpers                                                      */
/* ------------------------------------------------------------------ */

function nextId(wf: Workflow, sub: string, prefix: string): string {
  const d = wf.store.p(sub);
  const n = fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).length : 0;
  return `${prefix}-${String(n + 1).padStart(4, '0')}`;
}

function sealRecord(wf: Workflow, sub: string, id: string, data: unknown, event: string, summary: unknown): string {
  const file = wf.store.writeRecord(sub, `${id}.json`, data);
  wf.store.append(event, { record: `${sub}/${id}.json`, sha256: sha256File(file), summary });
  wf.store.writeState(wf.state);
  return file;
}

function acceptedReceiptRecords(wf: Workflow): RecordedReceipt[] {
  return wf.store.list('receipts').map((f) => wf.store.readRecord<RecordedReceipt>('receipts', f)).filter((r) => r.verdict.accepted && r.receipt?.outcome === 'completed');
}

interface Delivery {
  receipt: RecordedReceipt;
  packet: any;
  docs: Map<string, { path: string; abs: string; sha256: string | null; data: any }>;
}

/** Accepted deliveries, with each document read from the latest applied correction if one exists. */
export function deliveries(wf: Workflow, opts: { corrected?: boolean } = {}): Delivery[] {
  const corr = opts.corrected ? latestCorrections(wf) : new Map<string, string>();
  return acceptedReceiptRecords(wf).map((r) => {
    const packet = wf.store.readRecord('packets', `${r.packet_id}.json`);
    const docs = new Map<string, any>();
    for (const o of r.receipt.outputs as any[]) {
      const abs = path.resolve(wf.run.ctx.repoRoot, o.path);
      const use = corr.get(normPath(abs)) ?? abs;
      const j = readJson(use);
      if (j.ok) docs.set(path.basename(o.path), { path: o.path, abs: use, sha256: j.sha256, data: j.data });
    }
    return { receipt: r, packet, docs };
  });
}

/* ------------------------------------------------------------------ */
/* A. reconciliation                                                   */
/* ------------------------------------------------------------------ */

export function reconcile(wf: Workflow, reported: { rule_dispositions?: number; decisions?: number } = {}): any {
  return mutate(wf, 'reconcile', () => {
    const set = loadArtifacts(wf.run.ctx);
    const sys = discoverSystem(set);
    const rules: any[] = set.artifacts.rules.data.business_rules;
    const rbp: Record<string, string[]> = set.artifacts.rules.data.rules_by_program ?? {};
    const dl = deliveries(wf);
    const f1 = dl.filter((d) => d.packet.agent.id === 'F1');
    const entries = new Map<string, Array<{ packet: string; disposition: string; requirement_ids: string[] }>>();
    for (const d of f1) for (const c of d.docs.get('draft_requirements.json')?.data.rule_coverage ?? []) {
      const list = entries.get(c.rule.id) ?? [];
      list.push({ packet: d.packet.packet_id, disposition: c.disposition, requirement_ids: c.requirement_ids ?? [] });
      entries.set(c.rule.id, list);
    }
    const programBatch = new Map<string, string>();
    for (const d of f1) for (const u of d.packet.units) programBatch.set(u.name, d.packet.packet_id);
    const perRule = rules.map((r) => {
      const e = entries.get(r.rule_id) ?? [];
      const dispositions = [...new Set(e.map((x) => x.disposition))];
      const impl = [...new Set([...(r.implemented_in_programs ?? []), ...(r.sources ?? []).map((s: any) => s.program_id).filter(Boolean)])];
      const scopePrograms = Object.entries(rbp).filter(([, ids]) => ids.includes(r.rule_id)).map(([p]) => p);
      const reason = e.length <= 1 ? null
        : r.primary_source?.copybook && !r.primary_source?.program_id
        ? `copybook-declared rule (${r.primary_source.copybook}) listed for programs in several batches: ${impl.map((p) => `${p}→${programBatch.get(p) ?? '?'}`).join(', ')}`
        : impl.length > 1 ? `implemented in ${impl.length} programs in different batches: ${impl.map((p) => `${p}→${programBatch.get(p) ?? '?'}`).join(', ')}`
        : `in scope of programs in several batches: ${[...new Set(scopePrograms.map((p) => programBatch.get(p)).filter(Boolean))].join(', ')}`;
      return {
        rule_id: r.rule_id,
        entry_count: e.length,
        entries: e,
        status: e.length === 0 ? 'missing' : e.length === 1 ? 'single' : dispositions.length === 1 ? 'duplicate_consistent' : 'duplicate_conflicting',
        multi_entry_reason: reason,
      };
    });
    const unknown = [...entries.keys()].filter((id) => !rules.some((r) => r.rule_id === id));
    const totalEntries = [...entries.values()].reduce((n, e) => n + e.length, 0);
    const extra = perRule.reduce((n, r) => n + Math.max(0, r.entry_count - 1), 0);
    const decisions = dl.flatMap((d) => [...d.docs.values()].filter((x) => x.data.contract === 'forward/decision-requests').flatMap((x) => (x.data.decisions as any[]).map((dd) => ({ id: dd.decision_request_id, packet: d.packet.packet_id, agent: d.packet.agent.id, blocking: dd.blocking, gaps: (dd.gap_refs ?? []).map((g: any) => g.gap.id), items: (dd.gap_refs ?? []).flatMap((g: any) => g.items) }))));
    const idCount = new Map<string, number>();
    for (const d of decisions) idCount.set(d.id, (idCount.get(d.id) ?? 0) + 1);
    const gapOverlap = new Map<string, Set<string>>();
    for (const d of decisions) for (const g of d.gaps) gapOverlap.set(g, new Set([...(gapOverlap.get(g) ?? []), d.packet]));
    const byPacket: Record<string, { agent: string; decisions: number; blocking: number }> = {};
    for (const d of decisions) {
      byPacket[d.packet] = byPacket[d.packet] ?? { agent: d.agent, decisions: 0, blocking: 0 };
      byPacket[d.packet].decisions++;
      if (d.blocking) byPacket[d.packet].blocking++;
    }
    const rec = {
      contract: 'reconciliation',
      generated_at: now(),
      baseline_manifest_sha256: wf.run.manifestSha256,
      inputs: dl.map((d) => ({ receipt: d.receipt.receipt_id, packet: d.packet.packet_id, outputs: [...d.docs.values()].map((x) => ({ path: x.path, sha256: x.sha256 })) })),
      rules: {
        canonical: rules.length,
        covered: perRule.filter((r) => r.entry_count > 0).length,
        missing: perRule.filter((r) => r.status === 'missing').map((r) => r.rule_id),
        unknown_ids: unknown,
        coverage_entries: totalEntries,
        extra_entries: extra,
        equation: `${rules.length} canonical + ${extra} additional batch entries = ${rules.length + extra}; observed ${totalEntries}`,
        balanced: rules.length + extra === totalEntries && unknown.length === 0,
        by_status: perRule.reduce((m: Record<string, number>, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {}),
        multi_entry: perRule.filter((r) => r.entry_count > 1),
        reported: reported.rule_dispositions ?? null,
      },
      decisions: {
        total: decisions.length,
        unique_ids: idCount.size,
        duplicate_ids: [...idCount.entries()].filter(([, n]) => n > 1).map(([id]) => id),
        by_agent: { F1: decisions.filter((d) => d.agent === 'F1').length, F2: decisions.filter((d) => d.agent === 'F2').length },
        blocking: decisions.filter((d) => d.blocking).length,
        by_packet: byPacket,
        gaps_referenced_by_multiple_packets: [...gapOverlap.entries()].filter(([, s]) => s.size > 1).map(([g, s]) => ({ gap: g, packets: [...s].sort() })),
        reported: reported.decisions ?? null,
        reported_matches: reported.decisions === undefined ? null : reported.decisions === decisions.length,
      },
      per_rule: perRule,
      decisions_list: decisions,
    };
    const id = nextId(wf, 'verification', 'RECON');
    sealRecord(wf, 'verification', id, rec, 'reconciliation_recorded', { rules_balanced: rec.rules.balanced, decisions: decisions.length });
    void sys;
    return { id, ...rec };
  });
}

/* ------------------------------------------------------------------ */
/* C. access evidence and provenance supplements                       */
/* ------------------------------------------------------------------ */

export function recordAccess(wf: Workflow, packetId: string, transcriptFile: string): any {
  return mutate(wf, `access ${packetId}`, () => {
    if (!fs.existsSync(wf.store.p('packets', `${packetId}.json`))) throw new Error(`unknown packet ${packetId}`);
    const packet = wf.store.readRecord<any>('packets', `${packetId}.json`);
    const t = parseTranscript(transcriptFile);
    const read = filesRead(t);
    const receipt = acceptedReceiptRecords(wf).find((r) => r.packet_id === packetId) ?? null;
    const receiptFile = receipt ? wf.store.p('receipts', `${receipt.receipt_id}.json`) : null;
    const before = receiptFile ? sha256File(receiptFile) : null;
    const supplied = packet.inputs.flatMap((i: any) => i.files.map((f: any) => f.path));
    const perDoc: any[] = [];
    for (const o of (receipt?.receipt.outputs ?? []) as any[]) {
      const j = readJson(path.resolve(wf.run.ctx.repoRoot, o.path));
      if (!j.ok) continue;
      const declared: string[] = ((j.data as any).inputs_used ?? []).map((i: any) => i.path);
      const status = declared.map((p) => ({ path: p, evidence: evidenceFor(t, path.resolve(wf.run.ctx.repoRoot, p)) }));
      perDoc.push({
        output: o.path,
        declared_inputs_used: declared.length,
        declared_and_read: status.filter((s) => s.evidence === 'read').map((s) => s.path),
        declared_grep_file: status.filter((s) => s.evidence === 'grep_file').map((s) => s.path),
        declared_grep_directory_only: status.filter((s) => s.evidence === 'grep_directory').map((s) => s.path),
        declared_not_read: status.filter((s) => s.evidence === 'none').map((s) => s.path),
      });
    }
    const srcRoot = packet.source?.root ? normPath(packet.source.root) : null;
    const sourceReads = [...read].filter((p) => srcRoot && p.startsWith(srcRoot + '/'));
    const rec = {
      contract: 'access-evidence',
      generated_at: now(),
      packet_id: packetId,
      agent: packet.agent,
      receipt_id: receipt?.receipt_id ?? null,
      receipt_sha256_unchanged: before,
      transcript: { path: t.transcript, sha256: t.transcript_sha256, agent_id: t.agent_id, tool_calls: t.tool_calls },
      note: 'Access is evidenced only by Read/Grep/Glob calls recorded in the Claude Code subagent transcript. Packet inputs are what was supplied, not what was read.',
      inputs_supplied: supplied.length,
      supplied_and_read: supplied.filter((p: string) => evidenceFor(t, path.resolve(wf.run.ctx.repoRoot, p)) === 'read'),
      supplied_grep_file: supplied.filter((p: string) => evidenceFor(t, path.resolve(wf.run.ctx.repoRoot, p)) === 'grep_file'),
      supplied_grep_directory_only: supplied.filter((p: string) => evidenceFor(t, path.resolve(wf.run.ctx.repoRoot, p)) === 'grep_directory'),
      supplied_not_read: supplied.filter((p: string) => evidenceFor(t, path.resolve(wf.run.ctx.repoRoot, p)) === 'none'),
      original_source_files_read: sourceReads,
      provenance_by_output: perDoc,
      provenance_status: perDoc.some((d) => d.declared_not_read.length) ? 'declared_inputs_not_evidenced' : perDoc.some((d) => d.declared_grep_directory_only.length) ? 'declared_inputs_weakly_evidenced' : 'declared_inputs_evidenced',
      accesses: t.accesses,
    };
    const id = nextId(wf, 'verification', `ACC-${packetId}`);
    sealRecord(wf, 'verification', id, rec, 'access_evidence_recorded', { packet: packetId, status: rec.provenance_status, source_files_read: sourceReads.length });
    if (receiptFile && sha256File(receiptFile) !== before) throw new Error('receipt changed during access recording');
    return { id, ...rec };
  });
}

/** Read / grep-only / none evidence for one file in a transcript. */
function evidenceFor(t: TranscriptAccess, abs: string): 'read' | 'grep_file' | 'grep_directory' | 'none' {
  const lvl = accessFor(t, abs);
  return lvl === 'read_covering_citation' || lvl === 'file_read_other_lines' ? 'read' : lvl === 'grep_only' ? 'grep_file' : lvl === 'grep_directory_only' ? 'grep_directory' : 'none';
}

/** Latest access-evidence record for a packet. */
function accessRecord(wf: Workflow, packetId: string): TranscriptAccess | null {
  const version = (f: string) => Number(/-(\d{4})\.json$/.exec(f.slice(`ACC-${packetId}`.length))?.[1] ?? 1);
  const files = wf.store.list('verification').filter((f) => f === `ACC-${packetId}.json` || f.startsWith(`ACC-${packetId}-`)).sort((x, y) => version(x) - version(y));
  if (!files.length) return null;
  const r = JSON.parse(fs.readFileSync(wf.store.p('verification', files[files.length - 1]), 'utf8'));
  return { transcript: r.transcript.path, transcript_sha256: r.transcript.sha256, agent_id: r.transcript.agent_id, tool_calls: r.transcript.tool_calls, accesses: r.accesses };
}

/* ------------------------------------------------------------------ */
/* B. independent source verification                                  */
/* ------------------------------------------------------------------ */

export type ClaimResult = 'verified' | 'unverified' | 'contradicted';

export interface Ctx {
  srcRoot: string | null;
  relByFile: Map<string, string>;
  files: Map<string, SourceFile | null>;
  statements: Map<string, any>;
  paragraphs: Map<string, any>;
  layoutItems: Map<string, { file_id: string; record_id: string; item: any; line: number | null }>;
  layoutRecords: Map<string, any>;
}

export function buildCtx(wf: Workflow): Ctx {
  const set = loadArtifacts(wf.run.ctx);
  const inv = set.artifacts.inventory.data;
  const relByFile = new Map<string, string>();
  for (const r of [...inv.file_registry, ...inv.copybook_registry]) relByFile.set(r.file_id, r.relative_path ?? r.path);
  const statements = new Map<string, any>();
  const paragraphs = new Map<string, any>();
  for (const f of set.rawStructureFiles) {
    const pd = f.data?.procedure_division;
    for (const s of pd?.statements ?? []) statements.set(s.statement_id, { ...s, file_id: f.file_id });
    for (const p of pd?.paragraphs ?? []) paragraphs.set(p.paragraph_id, { ...p, file_id: f.file_id });
  }
  const layoutItems = new Map<string, any>();
  const layoutRecords = new Map<string, any>();
  const ldir = path.join(path.dirname(set.artifacts.data.path), 'data_layouts');
  for (const fn of fs.existsSync(ldir) ? fs.readdirSync(ldir).filter((x) => x.endsWith('.json')) : []) {
    const L = JSON.parse(fs.readFileSync(path.join(ldir, fn), 'utf8'));
    for (const rec of L.records ?? []) {
      if (!rec.record_id) continue;
      layoutRecords.set(rec.record_id, { ...rec, file_id: L.file_id });
      const walk = (items: any[]) => {
        for (const it of items ?? []) {
          if (it.field_id) layoutItems.set(it.field_id, { file_id: L.file_id, record_id: rec.record_id, item: it, line: typeof it.line === 'number' ? it.line : null });
          walk(it.children ?? []);
        }
      };
      walk(rec.children ?? []);
    }
  }
  const srcRoot = wf.run.ctx.sourceRoot && fs.existsSync(wf.run.ctx.sourceRoot) ? wf.run.ctx.sourceRoot : null;
  return { srcRoot, relByFile, files: new Map(), statements, paragraphs, layoutItems, layoutRecords };
}

function src(c: Ctx, fileId: string | null): { rel: string | null; abs: string | null; f: SourceFile | null } {
  if (!fileId) return { rel: null, abs: null, f: null };
  const rel = c.relByFile.get(fileId) ?? null;
  if (!rel || !c.srcRoot) return { rel, abs: null, f: null };
  const abs = path.join(c.srcRoot, rel);
  if (!c.files.has(fileId)) c.files.set(fileId, fs.existsSync(abs) ? sourceFile(abs, fs.readFileSync(abs, 'utf8')) : null);
  return { rel, abs, f: c.files.get(fileId) ?? null };
}

const KEYWORD = (t: string) => (t || '').split(/\s+/)[0].toUpperCase();

/** Quoted literals and multi-digit numbers stated in a claim. */
export function claimLiterals(text: string): string[] {
  const out = new Set<string>();
  // A COBOL literal is quoted text not attached to a word (so possessives such as "program's" are ignored).
  for (const m of text.matchAll(/(?<![A-Za-z0-9])'([^'\n]{1,40})'(?![A-Za-z0-9])/g)) out.add(m[1]);
  for (const m of text.matchAll(/(?<![\w.-])(\d{2,})(?![\w-])/g)) out.add(m[1]);
  return [...out];
}

function refRange(c: Ctx, ref: any): { from: number; to: number; problems: string[]; statement: any | null } | null {
  const problems: string[] = [];
  let st: any = null;
  let from: number | null = null;
  let to: number | null = null;
  if (ref.statement_id) {
    st = c.statements.get(ref.statement_id);
    if (!st) problems.push(`statement ${ref.statement_id} not found in the parser structure`);
    else {
      from = st.start_line;
      to = st.end_line ?? st.start_line;
      if (typeof ref.line === 'number' && (ref.line < from! || ref.line > to!)) problems.push(`cited line ${ref.line} is outside ${ref.statement_id} (lines ${from}-${to})`);
    }
  } else if (ref.paragraph_id) {
    const p = c.paragraphs.get(ref.paragraph_id);
    if (!p) problems.push(`paragraph ${ref.paragraph_id} not found`);
    else {
      from = p.start_line;
      to = p.end_line;
      if (typeof ref.line === 'number' && (ref.line < from! || ref.line > to!)) problems.push(`cited line ${ref.line} is outside paragraph ${ref.paragraph_id}`);
    }
  } else if (typeof ref.line === 'number') {
    from = ref.line;
    to = ref.line;
  }
  if (from === null || to === null) return problems.length ? { from: 0, to: 0, problems, statement: st } : null;
  return { from, to, problems, statement: st };
}

/** Verifies a textual claim (requirement or runtime claim) against its cited source. */
export function verifyTextClaim(c: Ctx, text: string, refs: any[]): { result: ClaimResult; reasons: string[]; lines: Record<string, number[]>; checks: any } {
  const reasons: string[] = [];
  const lines: Record<string, number[]> = {};
  let located = 0;
  const cited: string[] = [];
  const whole = new Map<string, string>();
  for (const r of refs ?? []) {
    const s = src(c, r.file_id);
    if (!s.f) {
      if (r.file_id) reasons.push(`source for ${r.file_id} not available`);
      continue;
    }
    whole.set(r.file_id, rangeText(s.f, 1, s.f.lines.length).toUpperCase());
    const rr = refRange(c, r);
    if (!rr) continue;
    if (rr.problems.length) {
      reasons.push(...rr.problems);
      continue;
    }
    const pad = rr.statement || r.paragraph_id ? 0 : 3;
    const t = rangeText(s.f, rr.from - pad, rr.to + pad).toUpperCase();
    if (!t.trim()) {
      reasons.push(`cited lines ${rr.from}-${rr.to} of ${s.rel} contain no code`);
      continue;
    }
    if (rr.statement && !t.includes(KEYWORD(rr.statement.statement_type))) {
      reasons.push(`${r.statement_id} (${rr.statement.statement_type}) not found at lines ${rr.from}-${rr.to} of ${s.rel}`);
      continue;
    }
    located++;
    cited.push(t);
    (lines[s.abs!] = lines[s.abs!] ?? []).push(rr.from);
  }
  const lits = claimLiterals(text);
  const inCited = lits.filter((l) => cited.some((t) => t.includes(l.toUpperCase())));
  const elsewhere = lits.filter((l) => !inCited.includes(l) && [...whole.values()].some((t) => t.includes(l.toUpperCase())));
  const absent = lits.filter((l) => !inCited.includes(l) && !elsewhere.includes(l));
  const checks = { located_refs: located, literals: lits, literals_in_cited_lines: inCited, literals_elsewhere_in_file: elsewhere, literals_not_in_source: absent };
  const contradicted = reasons.some((r) => /not found|outside/.test(r));
  if (contradicted) return { result: 'contradicted', reasons, lines, checks };
  if (!located) return { result: 'unverified', reasons: [...reasons, 'no locatable statement, paragraph or line reference to check'], lines, checks };
  if (absent.length) return { result: 'unverified', reasons: [...reasons, `stated values not found in the cited source: ${absent.join(', ')}`], lines, checks };
  if (elsewhere.length) return { result: 'unverified', reasons: [...reasons, `stated values found in the program but not in the cited lines: ${elsewhere.join(', ')}`], lines, checks };
  return { result: 'verified', reasons, lines, checks };
}

const USAGE_EQ = (claimed: string | null, parsed: string | null): boolean => {
  const n = (u: string | null) => (u === 'COMP' || u === 'COMP-4' ? 'BINARY' : u === 'COMP-3' ? 'PACKED_DECIMAL' : u);
  return n(claimed) === n(parsed);
};

/** Source-derived size of a layout item (elementary: PIC/USAGE; group: sum of non-REDEFINES children). */
function sourceSize(c: Ctx, f: SourceFile, it: any): number | null {
  if (it.level === 88 || it.is_condition) return 0;
  if (typeof it.line !== 'number') return null;
  const e = parseDataEntry(f, it.line);
  if (!e) return null;
  const occ = e.occurs ?? 1;
  if (e.pic) return storageBytes(e.pic, e.usage) * occ;
  let sum = 0;
  for (const ch of it.children ?? []) {
    if (ch.level === 88 || ch.is_condition || ch.type === 'copy_expansion' || ch.include_kind) continue;
    if (ch.redefines) continue;
    const s = sourceSize(c, f, ch);
    if (s === null) return null;
    sum += s;
  }
  return sum * occ;
}

function sourceOffset(c: Ctx, f: SourceFile, recordId: string, fieldId: string): number | null {
  const rec = c.layoutRecords.get(recordId);
  if (!rec) return null;
  let found: number | null = null;
  const walk = (items: any[], base: number): boolean => {
    let cursor = base;
    const byName = new Map<string, number>();
    for (const it of items ?? []) {
      if (it.level === 88 || it.is_condition || it.type === 'copy_expansion' || it.include_kind) continue;
      const off = it.redefines && byName.has(it.redefines) ? byName.get(it.redefines)! : cursor;
      if (it.field_id === fieldId) {
        found = off;
        return true;
      }
      if (walk(it.children ?? [], off)) return true;
      byName.set(it.name, off);
      if (!it.redefines) {
        const s = sourceSize(c, f, it);
        if (s === null) return true;
        cursor += s;
      }
    }
    return false;
  };
  walk(rec.children ?? [], 0);
  return found;
}

export function verifyField(c: Ctx, field: any): { result: ClaimResult; reasons: string[]; line: number | null; file: string | null } {
  const li = field.field_id ? c.layoutItems.get(field.field_id) : undefined;
  if (!li) return { result: 'unverified', reasons: ['field has no locatable layout item'], line: null, file: null };
  const s = src(c, li.file_id);
  if (!s.f) return { result: 'unverified', reasons: ['source not available'], line: li.line, file: s.abs };
  if (li.line === null) return { result: 'unverified', reasons: ['layout item has no source line'], line: null, file: s.abs };
  const raw = srcLine(s.f, li.line);
  if (raw === null || codeText(raw) === null) return { result: 'contradicted', reasons: [`line ${li.line} of ${s.rel} is missing or a comment`], line: li.line, file: s.abs };
  const e = parseDataEntry(s.f, li.line);
  if (!e) return { result: 'unverified', reasons: [`no data entry could be parsed at line ${li.line}`], line: li.line, file: s.abs };
  const reasons: string[] = [];
  const name = String(field.field_name ?? '').toUpperCase();
  if (!(e.name === name || (e.name === 'FILLER' && name.startsWith('FILLER')))) reasons.push(`name ${field.field_name} vs source ${e.name}`);
  if (field.level !== undefined && field.level !== e.level) reasons.push(`level ${field.level} vs source ${e.level}`);
  if (field.cobol_category === 'condition' || field.level === 88) {
    if (e.level !== 88) reasons.push('claimed condition but source entry is not level 88');
  } else if (e.pic) {
    if (field.pic && normPic(field.pic) !== normPic(e.pic)) reasons.push(`PIC ${field.pic} vs source ${e.pic}`);
    if (field.usage && !['GROUP', 'UNKNOWN'].includes(field.usage) && !USAGE_EQ(field.usage, e.usage)) reasons.push(`usage ${field.usage} vs source ${e.usage}`);
    if (typeof field.byte_length === 'number' && field.byte_length !== storageBytes(e.pic, e.usage)) reasons.push(`byte_length ${field.byte_length} vs source-computed ${storageBytes(e.pic, e.usage)}`);
  }
  if ((field.occurs ?? null) !== (e.occurs ?? null) && !(field.occurs === 1 && e.occurs === null)) reasons.push(`occurs ${field.occurs} vs source ${e.occurs}`);
  if (field.offset_basis === 'verified_from_source' && typeof field.offset === 'number') {
    const off = sourceOffset(c, s.f, li.record_id, field.field_id);
    if (off === null) reasons.push('offset could not be recomputed from source');
    else if (off !== field.offset) reasons.push(`offset ${field.offset} vs source-computed ${off}`);
  }
  if (reasons.length) return { result: reasons.every((r) => /could not be recomputed/.test(r)) ? 'unverified' : 'contradicted', reasons, line: li.line, file: s.abs };
  return { result: 'verified', reasons, line: li.line, file: s.abs };
}

export function verifySources(wf: Workflow, opts: { corrected?: boolean } = {}): any {
  return mutate(wf, 'verify-sources', () => {
    const c = buildCtx(wf);
    const claims: any[] = [];
    for (const d of deliveries(wf, { corrected: opts.corrected })) {
      const pk = d.packet;
      const acc = accessRecord(wf, pk.packet_id);
      const available = pk.source?.available === true;
      const access = (file: string | null, lines: number[]): AccessLevel | 'no_transcript' => (!acc ? 'no_transcript' : file ? accessFor(acc, file, lines) : 'not_demonstrated');
      const req = d.docs.get('draft_requirements.json')?.data;
      for (const r of req?.requirements ?? []) {
        if (r.evidence_status !== 'verified_from_source') continue;
        const v = verifyTextClaim(c, `${r.title} ${r.statement}`, r.source_refs);
        const files = Object.keys(v.lines);
        claims.push({ kind: 'requirement', id: r.requirement_id, packet: pk.packet_id, receipt: d.receipt.receipt_id, source_available: available, access_demonstrated: files.length ? files.map((f) => access(f, v.lines[f])) : [access(null, [])], claim_verification: v.result, effective_status: v.result === 'verified' ? 'verified_from_source' : v.result === 'contradicted' ? 'contradicted' : 'unverified', reasons: v.reasons, checks: v.checks, sources: files.map((f) => ({ file: f, lines: v.lines[f] })) });
      }
      const dm = d.docs.get('data_mappings.json')?.data;
      for (const rec of dm?.records ?? []) for (const f of rec.fields ?? []) {
        if (f.evidence_status !== 'verified_from_source') continue;
        const v = verifyField(c, f);
        claims.push({ kind: 'field', id: f.field_id, name: f.field_name, record_id: rec.record_id, packet: pk.packet_id, receipt: d.receipt.receipt_id, source_available: available, access_demonstrated: [access(v.file, v.line ? [v.line] : [])], claim_verification: v.result, effective_status: v.result === 'verified' ? 'verified_from_source' : v.result === 'contradicted' ? 'contradicted' : 'unverified', reasons: v.reasons, sources: v.file ? [{ file: v.file, lines: v.line ? [v.line] : [] }] : [] });
      }
      const fo = d.docs.get('file_operation_requirements.json')?.data;
      for (const p of fo?.programs ?? []) {
        for (const cr of p.compatibility_requirements ?? []) {
          if (cr.evidence_status !== 'verified_from_source') continue;
          const v = verifyTextClaim(c, cr.statement, cr.source_refs);
          const files = Object.keys(v.lines);
          claims.push({ kind: 'runtime_requirement', id: `${p.unit.name}:${cr.statement.slice(0, 50)}`, packet: pk.packet_id, receipt: d.receipt.receipt_id, source_available: available, access_demonstrated: files.map((f) => access(f, v.lines[f])), claim_verification: v.result, effective_status: v.result === 'verified' ? 'verified_from_source' : v.result === 'contradicted' ? 'contradicted' : 'unverified', reasons: v.reasons, checks: v.checks, sources: files.map((f) => ({ file: f, lines: v.lines[f] })) });
        }
        for (const fl of p.files ?? []) for (const op of fl.operations ?? []) {
          if (op.evidence_status !== 'verified_from_source') continue;
          const v = verifyTextClaim(c, `${op.verb} ${fl.select_name}`, [{ file_id: p.unit.file_id, statement_id: op.statement_id, paragraph_id: op.paragraph_id }]);
          const files = Object.keys(v.lines);
          claims.push({ kind: 'file_operation', id: `${p.unit.name}:${fl.select_name}:${op.verb}:${op.statement_id}`, packet: pk.packet_id, receipt: d.receipt.receipt_id, source_available: available, access_demonstrated: files.map((f) => access(f, v.lines[f])), claim_verification: v.result, effective_status: v.result === 'verified' ? 'verified_from_source' : v.result === 'contradicted' ? 'contradicted' : 'unverified', reasons: v.reasons, sources: files.map((f) => ({ file: f, lines: v.lines[f] })) });
        }
      }
    }
    const tally = (k: string) => {
      const xs = claims.filter((x) => x.kind === k);
      const by = (f: (x: any) => string) => xs.reduce((m: Record<string, number>, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {});
      return { claims: xs.length, claim_verification: by((x) => x.claim_verification), access_demonstrated: by((x) => [...new Set(x.access_demonstrated)].sort().join('+') || 'none'), source_available: by((x) => String(x.source_available)) };
    };
    const rec = {
      contract: 'evidence-verification',
      generated_at: now(),
      baseline_manifest_sha256: wf.run.manifestSha256,
      source_root_configured: !!c.srcRoot,
      view: opts.corrected ? 'with validated corrections applied (overlays); originals unchanged' : 'original accepted deliverables',
      statuses: {
        source_available: 'the dispatch packet declared the original source readable',
        access_demonstrated: 'the agent transcript records a successful Read of the cited file covering the cited lines (read_covering_citation), of other lines only, a Grep only, or nothing',
        claim_verification: 'this runtime re-read the source independently: verified = citation resolves to the stated statement/line and every stated literal value appears in the cited lines (fields: name, level, PIC, usage, OCCURS, size and offset match); unverified = not checkable or not supported; contradicted = citation or attribute does not match the source',
      },
      summary: { requirement: tally('requirement'), field: tally('field'), runtime_requirement: tally('runtime_requirement'), file_operation: tally('file_operation') },
      claims,
    };
    const id = nextId(wf, 'verification', 'VER');
    sealRecord(wf, 'verification', id, rec, 'evidence_verification_recorded', rec.summary);
    return { id, ...rec };
  });
}

/* ------------------------------------------------------------------ */
/* E. validated technical corrections (overlays)                       */
/* ------------------------------------------------------------------ */

/** Innermost statement of a file whose line range covers `line`. */
export function statementForLine(statements: any[], fileId: string, lineNo: number): any | null {
  const c = statements.filter((s) => s.file_id === fileId && lineNo >= s.start_line && lineNo <= (s.end_line ?? s.start_line));
  if (!c.length) return null;
  c.sort((a, b) => ((a.end_line ?? a.start_line) - a.start_line) - ((b.end_line ?? b.start_line) - b.start_line));
  return c[0];
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

function getPtr(doc: any, ptr: string): any {
  return ptr.split('/').slice(1).reduce((o, k) => (o === undefined ? undefined : o[decodeURIComponent(k.replace(/~1/g, '/').replace(/~0/g, '~'))]), doc);
}
function setPtr(doc: any, ptr: string, v: any): void {
  const ks = ptr.split('/').slice(1);
  const last = ks.pop()!;
  const parent = ks.reduce((o, k) => o[k], doc);
  parent[last] = v;
}

function latestCorrections(wf: Workflow): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of wf.store.list('corrections')) {
    const r = wf.store.readRecord<any>('corrections', f);
    m.set(normPath(path.resolve(wf.run.ctx.repoRoot, r.target.path)), path.resolve(wf.run.ctx.repoRoot, r.applied_copy.path));
  }
  return m;
}

export interface CorrectionSpec {
  packet: string;
  file: string;
  pointer: string;
  kind: 'count_word' | 'statement_for_line' | 'citation_line';
  count_pointer?: string;
  reason: string;
  /** citation_line only: the signed resolution (RES-NNNN) that authorizes the proposal. */
  authorized_by?: string;
  /** citation_line only: the remediation proposal being applied. */
  proposal_id?: string;
}

/**
 * Applies an objectively verifiable technical correction as a new version of
 * the document (the original stays untouched). The runtime computes the new
 * value itself from the evidence; a correction it cannot verify is refused.
 */
/**
 * Authorization of a citation-line correction (STEP 5.5): the proposal must be
 * in the latest remediation-proposals record for this exact document and
 * pointer; the item's review decision must have an effective, signature-
 * verified resolution with outcome resolved_requires_update whose
 * selected_option is the proposal ID; the source files must still have the
 * proposal's hashes; and re-deriving the citation from the source must give
 * the proposed value. Nothing else can authorize it.
 */
function authorizeCitationLine(wf: Workflow, spec: CorrectionSpec, docPath: string, doc: any): { value: number; evidence: any } {
  if (!spec.authorized_by || !spec.proposal_id) throw new Error('citation_line needs --authorized-by RES-NNNN and --proposal RP-...');
  const { latestStep45 } = require('../blockers/records') as typeof import('../blockers/records');
  const { buildSnapshot } = require('../approval/snapshot') as typeof import('../approval/snapshot');
  const { analyseCitation, SourceReader } = require('../blockers/deterministic') as typeof import('../blockers/deterministic');
  const props = latestStep45(wf, 'remediation-proposals');
  const p = (props?.record.proposals ?? []).find((x: any) => x.proposal_id === spec.proposal_id);
  if (!p) throw new Error(`proposal ${spec.proposal_id} is not in the latest remediation-proposals record`);
  if (p.kind !== 'citation_correction' || !/\/line$/.test(p.target.pointer)) throw new Error(`${spec.proposal_id} is not a citation line correction`);
  if (p.target.document !== docPath || p.target.pointer !== spec.pointer) throw new Error(`${spec.proposal_id} targets ${p.target.document}#${p.target.pointer}, not ${docPath}#${spec.pointer}`);
  const snap = buildSnapshot(wf);
  const decision = p.target.item_kind === 'data_record' ? `RVW-REC-${p.target.item_id}` : `RVW-${p.target.item_id}`;
  const st = snap.resolutions.get(decision);
  const res = st?.effective;
  if (!st || st.status !== 'resolved' || res?.resolution_id !== spec.authorized_by) throw new Error(`${spec.authorized_by} is not the effective, verified resolution of ${decision} (status ${st?.status ?? 'unknown'})`);
  if (res.resolution.outcome !== 'resolved_requires_update' || res.resolution.selected_option !== spec.proposal_id) throw new Error(`${spec.authorized_by} must have outcome resolved_requires_update and selected_option ${spec.proposal_id}`);
  const item = snap.itemById.get(p.target.item_id);
  if (!item || item.sha256 !== p.target.item_sha256) throw new Error(`${p.target.item_id} changed since the proposal was made`);
  for (const h of p.source_hashes ?? []) {
    const abs = snap.ctx.srcRoot ? path.join(snap.ctx.srcRoot, h.path) : null;
    if (!abs || sha256File(abs) !== h.sha256) throw new Error(`source ${h.path} changed since the proposal was made`);
  }
  const again = analyseCitation(snap, new SourceReader(snap), item).find((a) => `${p.target.pointer}`.includes(`/source_refs/${a.ref_index}/`));
  if (!again?.proposed || again.proposed.field !== 'line' || again.proposed.value !== p.proposed_value) throw new Error('re-deriving the citation from the source no longer gives the proposed value');
  if (getPtr(doc, spec.pointer) !== p.original_value) throw new Error(`current value ${getPtr(doc, spec.pointer)} is not the proposal's original value ${p.original_value}`);
  return { value: p.proposed_value as number, evidence: { proposal: p.proposal_id, proposal_record: props!.id, authorized_by: spec.authorized_by, decision, signer: res.resolution.signer_id, role: res.resolution.role, rederived: again } };
}

export function correct(wf: Workflow, spec: CorrectionSpec): any {
  return mutate(wf, `correct ${spec.packet}`, () => {
    const d = acceptedReceiptRecords(wf).find((r) => r.packet_id === spec.packet);
    if (!d) throw new Error(`no accepted receipt for ${spec.packet}`);
    const out = (d.receipt.outputs as any[]).find((o) => path.basename(o.path) === spec.file);
    if (!out) throw new Error(`${spec.file} is not an output of ${spec.packet}`);
    const original = path.resolve(wf.run.ctx.repoRoot, out.path);
    const latest = latestCorrections(wf).get(normPath(original)) ?? original;
    const j = readJson(latest);
    if (!j.ok) throw new Error(j.error);
    const doc = j.data as any;
    const old = getPtr(doc, spec.pointer);
    if (old === undefined) throw new Error(`pointer ${spec.pointer} not found`);
    let next: any;
    const evidence: any = {};
    if (spec.kind === 'count_word') {
      if (typeof old !== 'string' || !spec.count_pointer) throw new Error('count_word needs a string target and --count-pointer');
      const list = getPtr(doc, spec.count_pointer);
      if (!Array.isArray(list)) throw new Error(`count pointer ${spec.count_pointer} is not an array`);
      const n = list.length;
      const m = new RegExp(`^(${NUMBER_WORDS.join('|')}|\\d+)\\b`, 'i').exec(old);
      if (!m) throw new Error('target text does not start with a count');
      const stated = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS.indexOf(m[1].toLowerCase());
      if (stated === n) throw new Error(`stated count ${stated} already equals ${n}: nothing to correct`);
      const word = n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
      next = (m[1][0] === m[1][0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word) + old.slice(m[1].length);
      evidence.stated_count = stated;
      evidence.actual_count = n;
      evidence.count_basis = `${spec.count_pointer} has ${n} entries`;
    } else if (spec.kind === 'citation_line') {
      // Applied only on a verified, signed human resolution that names this exact proposal.
      const auth = authorizeCitationLine(wf, spec, out.path, doc);
      next = auth.value;
      Object.assign(evidence, auth.evidence);
    } else {
      if (!old || typeof old !== 'object' || !old.statement_id || typeof old.line !== 'number') throw new Error('statement_for_line needs a source ref with statement_id and line');
      const c = buildCtx(wf);
      const cur = c.statements.get(old.statement_id);
      if (!cur) throw new Error(`statement ${old.statement_id} not found`);
      if (old.line >= cur.start_line && old.line <= (cur.end_line ?? cur.start_line)) throw new Error('cited line already lies within the cited statement: nothing to correct');
      const inner = statementForLine([...c.statements.values()], cur.file_id, old.line);
      if (!inner) throw new Error(`no statement covers line ${old.line}`);
      const s = src(c, cur.file_id);
      const text = s.f ? rangeText(s.f, inner.start_line, inner.end_line ?? inner.start_line).toUpperCase() : '';
      if (s.f && !text.includes(KEYWORD(inner.statement_type))) throw new Error(`source at line ${old.line} does not contain ${inner.statement_type}`);
      next = { ...old, statement_id: inner.statement_id };
      evidence.cited_statement = { statement_id: cur.statement_id, type: cur.statement_type, lines: [cur.start_line, cur.end_line] };
      evidence.statement_at_line = { statement_id: inner.statement_id, type: inner.statement_type, lines: [inner.start_line, inner.end_line], source_text: text.trim().slice(0, 200) };
    }
    setPtr(doc, spec.pointer, next);
    const id = nextId(wf, 'corrections', 'COR');
    const appliedDir = wf.store.p('corrections', 'applied', spec.packet);
    fs.mkdirSync(appliedDir, { recursive: true });
    const applied = path.join(appliedDir, `${path.basename(spec.file, '.json')}.${id}.json`);
    fs.writeFileSync(applied, JSON.stringify(doc, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    const rec = {
      contract: 'correction',
      correction_id: id,
      created_at: now(),
      kind: spec.kind,
      classification: spec.kind === 'citation_line' ? 'human_authorized' : 'objective_technical',
      reason: spec.reason,
      packet_id: spec.packet,
      receipt_id: d.receipt_id,
      receipt_sha256: sha256File(wf.store.p('receipts', `${d.receipt_id}.json`)),
      target: { path: out.path, original_sha256: sha256File(original), corrected_from_sha256: j.sha256, pointer: spec.pointer },
      old_value: old,
      new_value: next,
      evidence,
      applied_copy: { path: path.relative(wf.run.ctx.repoRoot, applied).split(path.sep).join('/'), sha256: sha256File(applied) },
      validation: wf.run.ctx.contracts.validate(doc.contract, doc),
    };
    if (!rec.validation.valid) {
      fs.rmSync(applied);
      throw new Error(`corrected document would violate ${doc.contract}: ${rec.validation.errors.join('; ')}`);
    }
    sealRecord(wf, 'corrections', id, rec, 'correction_recorded', { packet: spec.packet, file: spec.file, kind: spec.kind });
    if (sha256File(original) !== rec.target.original_sha256) throw new Error('original changed');
    return rec;
  });
}

/* ------------------------------------------------------------------ */
/* D. cross-batch consolidation                                        */
/* ------------------------------------------------------------------ */

export interface TrackedIssues {
  file: string | null;
  sha256: string | null;
  issues: Array<{ issue: string; patterns: RegExp[] }>;
}

/** Tracked issues are configuration (config/tracked-issues.json), never runtime source. */
export function loadTrackedIssues(file: string | null): TrackedIssues {
  if (!file || !fs.existsSync(file)) return { file, sha256: null, issues: [] };
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { file, sha256: sha256File(file), issues: (j.issues ?? []).map((t: any) => ({ issue: String(t.issue), patterns: (t.patterns ?? []).map((x: string) => new RegExp(x, 'i')) })) };
}

export function consolidate(wf: Workflow, opts: { trackedIssuesFile?: string | null } = {}): any {
  const tracked = loadTrackedIssues(opts.trackedIssuesFile === undefined ? path.join(wf.run.ctx.forwardDir, 'config', 'tracked-issues.json') : opts.trackedIssuesFile);
  return mutate(wf, 'consolidate', () => {
    const set = loadArtifacts(wf.run.ctx);
    const rules = new Map<string, any>((set.artifacts.rules.data.business_rules as any[]).map((r) => [r.rule_id, r]));
    const dl = deliveries(wf, { corrected: true });
    const corrections = wf.store.list('corrections').map((f) => wf.store.readRecord<any>('corrections', f));
    const verRecords = wf.store.list('verification').filter((f) => f.startsWith('VER-'));
    const ver = verRecords.length ? wf.store.readRecord<any>('verification', verRecords[verRecords.length - 1]) : null;

    // Rules across F1 batches.
    const byRule = new Map<string, any[]>();
    for (const d of dl.filter((x) => x.packet.agent.id === 'F1'))
      for (const c of d.docs.get('draft_requirements.json')?.data.rule_coverage ?? []) byRule.set(c.rule.id, [...(byRule.get(c.rule.id) ?? []), { packet: d.packet.packet_id, disposition: c.disposition, requirement_ids: c.requirement_ids, reason: c.reason }]);
    const ruleConflicts: any[] = [];
    const ruleOverlaps: any[] = [];
    for (const [id, es] of byRule) {
      if (es.length < 2) continue;
      const disp = [...new Set(es.map((e) => e.disposition))];
      const r = rules.get(id);
      const reverse = { name: r?.name, category: r?.category, confidence: r?.confidence, outcomes: r?.outcomes ?? null, description: r?.description };
      if (disp.length > 1) ruleConflicts.push({ rule_id: id, kind: 'business_interpretation', dispositions: es, reverse_artifact: reverse, resolution: 'SME_DECISION', auto_corrected: false, note: 'Batches disagree on whether this reverse rule is a forward requirement. The reverse artifact records the domain as declared and never tested; whether it becomes a requirement is a business decision, so it is not corrected automatically.' });
      else ruleOverlaps.push({ rule_id: id, disposition: disp[0], packets: es.map((e) => e.packet), requirement_ids: es.flatMap((e) => e.requirement_ids) });
    }
    // Fields across F2 deliveries.
    const byField = new Map<string, any[]>();
    for (const d of dl.filter((x) => x.packet.agent.id === 'F2'))
      for (const rec of d.docs.get('data_mappings.json')?.data.records ?? []) for (const f of rec.fields ?? []) if (f.field_id) byField.set(f.field_id, [...(byField.get(f.field_id) ?? []), { packet: d.packet.packet_id, java_type: f.java_type, cobol_category: f.cobol_category, byte_length: f.byte_length, offset: f.offset }]);
    const fieldConflicts = [...byField.entries()].filter(([, es]) => es.length > 1 && new Set(es.map((e) => `${e.java_type}|${e.cobol_category}|${e.byte_length}|${e.offset}`)).size > 1).map(([id, es]) => ({ field_id: id, mappings: es, resolution: 'SME_DECISION' }));
    const fieldDuplicates = [...byField.entries()].filter(([, es]) => es.length > 1).map(([id]) => id);
    // Requirements referencing the same rule from several batches.
    const reqIds = new Set<string>();
    const dupReq: string[] = [];
    for (const d of dl.filter((x) => x.packet.agent.id === 'F1')) for (const q of d.docs.get('draft_requirements.json')?.data.requirements ?? []) {
      if (reqIds.has(q.requirement_id)) dupReq.push(q.requirement_id);
      reqIds.add(q.requirement_id);
    }
    // Consolidated decision register: originals + one SME decision per conflict.
    const decisions: any[] = [];
    for (const d of dl) for (const x of d.docs.values()) if (x.data.contract === 'forward/decision-requests') for (const dd of x.data.decisions) decisions.push({ ...dd, origin: { packet: d.packet.packet_id, receipt: d.receipt.receipt_id, file: x.path } });
    ruleConflicts.forEach((c, i) => decisions.push({
      decision_request_id: `DR-CONSOLIDATION-${String(i + 1).padStart(3, '0')}`,
      kind: 'business',
      question: `Batches disagree on ${c.rule_id} (${c.reverse_artifact.name}): ${c.dispositions.map((e: any) => `${e.packet}=${e.disposition}`).join(', ')}. Should this declared value domain be a forward requirement?`,
      blocking: true,
      blocking_rationale: 'requirements cannot be approved while batches disagree on a rule disposition',
      status: 'open',
      rule_refs: [c.rule_id],
      origin: { consolidation: true },
    }));
    // Retained source and evidence issues.
    const corpus = decisions.map((d) => ({ id: d.decision_request_id, status: d.status, blocking: d.blocking, text: JSON.stringify(d) }));
    const retained = tracked.issues.map((t) => {
      const hits = corpus.filter((d) => t.patterns.every((p) => p.test(d.text)));
      return { issue: t.issue, decisions: hits.map((h) => h.id), open: hits.filter((h) => h.status === 'open').length, blocking: hits.some((h) => h.blocking), status: hits.length ? 'SME_BLOCKED' : 'NOT_FOUND' };
    });
    const rec = {
      contract: 'consolidation',
      generated_at: now(),
      baseline_manifest_sha256: wf.run.manifestSha256,
      inputs: dl.map((d) => ({ receipt: d.receipt.receipt_id, packet: d.packet.packet_id, documents: [...d.docs.values()].map((x) => ({ path: x.path, used: path.relative(wf.run.ctx.repoRoot, x.abs).split(path.sep).join('/'), sha256: x.sha256 })) })),
      corrections_applied: corrections.map((c) => ({ id: c.correction_id, packet: c.packet_id, target: c.target.path, pointer: c.target.pointer, applied_copy: c.applied_copy })),
      evidence_verification: ver ? { record: verRecords[verRecords.length - 1], summary: ver.summary } : null,
      rules: { conflicts: ruleConflicts, consistent_overlaps: ruleOverlaps, rules_covered: byRule.size },
      fields: { duplicate_field_ids: fieldDuplicates, conflicts: fieldConflicts },
      requirements: { total: reqIds.size, duplicate_ids: dupReq },
      decisions: { total: decisions.length, original: decisions.filter((d) => !d.origin?.consolidation).length, consolidation_added: ruleConflicts.length, blocking: decisions.filter((d) => d.blocking).length, open: decisions.filter((d) => d.status === 'open').length },
      tracked_issues_source: { file: tracked.file ? path.relative(wf.run.ctx.repoRoot, tracked.file).split(path.sep).join('/') : null, sha256: tracked.sha256, issues: tracked.issues.length },
      retained_issues: retained,
      register: decisions,
    };
    const id = nextId(wf, 'consolidation', 'CONS');
    sealRecord(wf, 'consolidation', id, rec, 'consolidation_recorded', { rule_conflicts: ruleConflicts.length, field_conflicts: fieldConflicts.length, decisions: decisions.length });
    return { id, ...rec };
  });
}
