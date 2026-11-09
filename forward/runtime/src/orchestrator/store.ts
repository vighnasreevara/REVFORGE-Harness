/**
 * Workflow persistence. All records live under forward/runs/<run>/workflow/:
 *   state.json      current state + checkpoint (written atomically)
 *   audit.jsonl     append-only, hash-chained event log
 *   gates/          gate results
 *   packets/        dispatch (input) packets
 *   receipts/       recorded agent receipts with the runtime verdict
 *   approvals/      signed human approval records (APR-*) and approval requests (requests/AREQ-*)
 *   decisions/      signed decision resolutions (RES-*), never edited
 *   g2/             sealed G2 scope evaluations (G2E-*)
 *   packet-status/  packet supersession reviews (PST-*)
 *   step45/         STEP 4.5 blocker analyses (audit, root causes, deterministic checks,
 *                   proposals, review queue, readiness, review packets), never edited
 *   agents/<F#>/    the only place an agent may write its outputs
 *   operation.lock  present while a mutating operation is in progress
 */
import * as fs from 'fs';
import * as path from 'path';
import { sha256Buffer } from '../core/fsutil';
import { AnyState, WorkflowState } from './states';

export interface HistoryEntry {
  seq: number;
  at: string;
  from: AnyState;
  to: WorkflowState;
  guard: string;
  evidence: string | null;
}

export interface BaselineRef {
  run_id: string;
  manifest_path: string;
  manifest_sha256: string;
  inputs: Record<string, string | null>;
  per_program: Record<string, string>;
  git_commit: string | null;
}

export interface WorkflowStateRecord {
  contract: 'workflow-state';
  contract_version: string;
  workflow_id: string;
  run_id: string;
  created_at: string;
  updated_at: string;
  baseline: BaselineRef;
  state: AnyState;
  blocked_from: WorkflowState | null;
  blockers: string[];
  history: HistoryEntry[];
  gates: Record<string, { status: string; result_file: string; evaluated_at: string; baseline_sha256: string }>;
  /** BASELINE and EVIDENCE pre-check results (absent in runs created before the two-gate change). */
  prechecks?: Record<string, { status: string; result_file: string; evaluated_at: string; baseline_sha256: string }>;
  packets: string[];
  receipts: string[];
  checkpoint: { seq: number; at: string; state_sha256: string; audit_head: string; audit_entries: number };
}

export interface AuditEntry {
  seq: number;
  at: string;
  event: string;
  data: unknown;
  prev: string;
  hash: string;
}

const GENESIS = '0'.repeat(64);

export class WorkflowStore {
  readonly dir: string;
  constructor(
    runDir: string,
    private readonly validator?: (s: WorkflowStateRecord) => string[],
  ) {
    this.dir = path.join(runDir, 'workflow');
  }

  p(...parts: string[]): string {
    return path.join(this.dir, ...parts);
  }

  exists(): boolean {
    return fs.existsSync(this.p('state.json'));
  }

  ensureLayout(): void {
    for (const d of ['gates', 'prechecks', 'packets', 'receipts', 'approvals', 'agents']) fs.mkdirSync(this.p(d), { recursive: true });
  }

  /* ---------------- audit chain ---------------- */

  readAudit(): AuditEntry[] {
    if (!fs.existsSync(this.p('audit.jsonl'))) return [];
    return fs
      .readFileSync(this.p('audit.jsonl'), 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as AuditEntry);
  }

  static entryHash(e: Omit<AuditEntry, 'hash'>): string {
    return sha256Buffer(JSON.stringify({ seq: e.seq, at: e.at, event: e.event, data: e.data, prev: e.prev }));
  }

  append(event: string, data: unknown, at = new Date().toISOString()): AuditEntry {
    const entries = this.readAudit();
    const prev = entries.length ? entries[entries.length - 1].hash : GENESIS;
    const base = { seq: entries.length + 1, at, event, data, prev };
    const entry: AuditEntry = { ...base, hash: WorkflowStore.entryHash(base) };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(this.p('audit.jsonl'), JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  verifyAudit(): { ok: boolean; entries: number; head: string; problems: string[] } {
    const problems: string[] = [];
    let prev = GENESIS;
    let entries: AuditEntry[] = [];
    try {
      entries = this.readAudit();
    } catch (e) {
      return { ok: false, entries: 0, head: GENESIS, problems: [`audit log unreadable: ${(e as Error).message}`] };
    }
    entries.forEach((e, i) => {
      if (e.seq !== i + 1) problems.push(`audit entry ${i + 1} has seq ${e.seq}`);
      if (e.prev !== prev) problems.push(`audit entry ${e.seq} does not chain to its predecessor`);
      if (WorkflowStore.entryHash(e) !== e.hash) problems.push(`audit entry ${e.seq} content does not match its hash`);
      prev = e.hash;
    });
    return { ok: problems.length === 0, entries: entries.length, head: prev, problems };
  }

  /* ---------------- state + checkpoint ---------------- */

  static stateDigest(s: WorkflowStateRecord): string {
    const { checkpoint: _c, ...rest } = s;
    return sha256Buffer(JSON.stringify(rest));
  }

  readState(): WorkflowStateRecord {
    return JSON.parse(fs.readFileSync(this.p('state.json'), 'utf8')) as WorkflowStateRecord;
  }

  /** Writes state atomically and seals it with a checkpoint bound to the audit head. */
  writeState(s: WorkflowStateRecord, at = new Date().toISOString()): WorkflowStateRecord {
    s.updated_at = at;
    const audit = this.readAudit();
    const head = audit.length ? audit[audit.length - 1].hash : GENESIS;
    s.checkpoint = { seq: (s.checkpoint?.seq ?? 0) + 1, at, state_sha256: '', audit_head: head, audit_entries: audit.length };
    s.checkpoint.state_sha256 = WorkflowStore.stateDigest(s);
    const problems = this.validator ? this.validator(s) : [];
    if (problems.length) throw new Error(`workflow state violates its contract: ${problems.join('; ')}`);
    const tmp = this.p(`state.json.tmp-${process.pid}`);
    fs.writeFileSync(tmp, JSON.stringify(s, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, this.p('state.json'));
    return s;
  }

  verifyCheckpoint(): { ok: boolean; problems: string[] } {
    const problems: string[] = [];
    let s: WorkflowStateRecord;
    try {
      s = this.readState();
    } catch (e) {
      return { ok: false, problems: [`state.json unreadable: ${(e as Error).message}`] };
    }
    if (WorkflowStore.stateDigest(s) !== s.checkpoint?.state_sha256) problems.push('state.json was modified outside the runtime (checkpoint digest mismatch)');
    const audit = this.verifyAudit();
    problems.push(...audit.problems);
    if (audit.ok) {
      const entries = this.readAudit();
      const atCheckpoint = entries[s.checkpoint.audit_entries - 1];
      const headAtCheckpoint = atCheckpoint ? atCheckpoint.hash : GENESIS;
      if (headAtCheckpoint !== s.checkpoint.audit_head) problems.push('checkpoint does not match the audit log');
      if (entries.length > s.checkpoint.audit_entries) problems.push(`${entries.length - s.checkpoint.audit_entries} audit event(s) recorded after the last checkpoint (interrupted operation)`);
    }
    return { ok: problems.length === 0, problems };
  }

  /* ---------------- operation lock ---------------- */

  lock(op: string): void {
    fs.mkdirSync(this.dir, { recursive: true });
    try {
      fs.writeFileSync(this.p('operation.lock'), JSON.stringify({ op, pid: process.pid, at: new Date().toISOString() }), { flag: 'wx' });
    } catch {
      const info = this.lockInfo();
      throw new Error(`another operation is in progress or was interrupted (${info ? `${info.op} at ${info.at}` : 'unknown'}); run 'workflow resume' to verify and recover`);
    }
  }

  unlock(): void {
    fs.rmSync(this.p('operation.lock'), { force: true });
  }

  lockInfo(): { op: string; pid: number; at: string } | null {
    try {
      return JSON.parse(fs.readFileSync(this.p('operation.lock'), 'utf8'));
    } catch {
      return null;
    }
  }

  writeRecord(sub: string, name: string, data: unknown): string {
    const file = this.p(sub, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) throw new Error(`record already exists: ${sub}/${name}`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    return file;
  }

  readRecord<T = any>(sub: string, name: string): T {
    return JSON.parse(fs.readFileSync(this.p(sub, name), 'utf8')) as T;
  }

  list(sub: string): string[] {
    const d = this.p(sub);
    return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort() : [];
  }
}
