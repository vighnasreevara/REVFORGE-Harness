/**
 * STEP 4.5 analysis records. Every analysis run writes a new, numbered record
 * under workflow/step45/ (never overwriting an earlier one) and seals its
 * hash in the audit log. These records are analysis outputs: none of them
 * resolves, approves or changes any decision, requirement, receipt or gate.
 */
import * as path from 'path';
import { sha256File } from '../core/fsutil';
import { Workflow } from '../orchestrator/orchestrator';

export const STEP45_DIR = 'step45';

export function nextRecordId(wf: Workflow, name: string): string {
  const n = wf.store.list(STEP45_DIR).filter((f) => f.startsWith(`${name}-`)).length + 1;
  return `${name}-${String(n).padStart(4, '0')}`;
}

/** Writes a sealed record; must be called inside mutate(). */
export function sealStep45(wf: Workflow, name: string, data: Record<string, unknown>, schema?: string): { id: string; file: string; sha256: string } {
  if (schema) {
    const v = wf.run.ctx.contracts.validate(schema, data);
    if (!v.valid) throw new Error(`${name} violates ${schema}: ${v.errors.slice(0, 5).join('; ')}`);
  }
  const id = nextRecordId(wf, name);
  const file = wf.store.writeRecord(STEP45_DIR, `${id}.json`, { record_id: id, ...data });
  const sha256 = sha256File(file)!;
  wf.store.append('step45_record_written', { record: `${STEP45_DIR}/${id}.json`, kind: name, sha256 });
  wf.store.writeState(wf.state);
  return { id, file, sha256 };
}

export function latestStep45(wf: Workflow, name: string): { id: string; record: any; file: string } | null {
  const files = wf.store.list(STEP45_DIR).filter((f) => f.startsWith(`${name}-`));
  if (!files.length) return null;
  const f = files[files.length - 1];
  return { id: f.replace(/\.json$/, ''), record: wf.store.readRecord(STEP45_DIR, f), file: path.join(wf.store.p(STEP45_DIR), f) };
}

export function relPath(wf: Workflow, abs: string): string {
  return path.relative(wf.run.ctx.repoRoot, abs).split(path.sep).join('/');
}
