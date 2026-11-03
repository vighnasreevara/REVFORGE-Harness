/**
 * Coverage ledger for unit-based agents (F1 programs; F2 programs and
 * copybooks). Units are discovered dynamically; a unit is completed only when
 * an accepted, completed receipt covers it. A stage is complete only when
 * every unit is completed: one finished batch never completes the stage.
 */
import * as fs from 'fs';
import { loadArtifacts } from '../core/artifacts';
import { discoverSystem } from '../core/model';
import { AgentSpec } from './agents';
import { Classification } from './classification';
import { allUnits, Unit, unitKey } from './extracts';
import type { Workflow } from './orchestrator';

export interface LedgerEntry {
  unit: Unit;
  status: 'completed' | 'in_progress' | 'pending';
  packets: string[];
  accepted_receipt: string | null;
  classification: string | null;
  modernization_scope: string | null;
}

export interface Ledger {
  agent: string;
  generated_at: string;
  baseline_manifest_sha256: string;
  units_total: number;
  completed: number;
  in_progress: number;
  pending: number;
  complete: boolean;
  entries: LedgerEntry[];
}

export function computeLedger(wf: Workflow, a: AgentSpec): Ledger {
  const set = loadArtifacts(wf.run.ctx);
  const sys = discoverSystem(set);
  const units = allUnits(sys, a.unit_kinds);
  const packets = wf.store.list('packets').map((f) => wf.store.readRecord<any>('packets', f)).filter((p) => p.agent.id === a.id && Array.isArray(p.units));
  const receipts = wf.store.list('receipts').map((f) => wf.store.readRecord<any>('receipts', f));
  const accepted = new Map<string, string>();
  for (const r of receipts) if (r.verdict.accepted && r.receipt?.outcome === 'completed') accepted.set(r.packet_id, r.receipt_id);
  let classes: Classification[] = [];
  try {
    classes = JSON.parse(fs.readFileSync(wf.store.p('program_classification.json'), 'utf8')).programs;
  } catch {
    classes = [];
  }
  const entries: LedgerEntry[] = units.map((u) => {
    const mine = packets.filter((p) => (p.units as Unit[]).some((x) => unitKey(x) === unitKey(u)));
    const done = mine.find((p) => accepted.has(p.packet_id));
    const open = mine.find((p) => p.dispatchable && !accepted.has(p.packet_id));
    const c = classes.find((x) => x.file_id === u.file_id);
    return {
      unit: u,
      status: done ? 'completed' : open ? 'in_progress' : 'pending',
      packets: mine.map((p) => p.packet_id),
      accepted_receipt: done ? (accepted.get(done.packet_id) as string) : null,
      classification: c ? `${c.class} (${c.confidence})` : u.unit_kind === 'copybook' ? 'copybook' : null,
      modernization_scope: c?.modernization_scope ?? null,
    };
  });
  const count = (s: LedgerEntry['status']) => entries.filter((e) => e.status === s).length;
  return {
    agent: a.id,
    generated_at: new Date().toISOString(),
    baseline_manifest_sha256: wf.run.manifestSha256,
    units_total: entries.length,
    completed: count('completed'),
    in_progress: count('in_progress'),
    pending: count('pending'),
    complete: entries.length > 0 && count('completed') === entries.length,
    entries,
  };
}

export function writeLedger(wf: Workflow, l: Ledger): string {
  fs.mkdirSync(wf.store.p('coverage'), { recursive: true });
  const p = wf.store.p('coverage', `${l.agent}.json`);
  fs.writeFileSync(p, JSON.stringify(l, null, 2) + '\n', 'utf8');
  return p;
}

/** Splits pending units into batches of at most `size`, in discovery order. */
export function planBatches(l: Ledger, size: number): Unit[][] {
  const pending = l.entries.filter((e) => e.status === 'pending').map((e) => e.unit);
  const out: Unit[][] = [];
  for (let i = 0; i < pending.length; i += size) out.push(pending.slice(i, i + size));
  return out;
}
