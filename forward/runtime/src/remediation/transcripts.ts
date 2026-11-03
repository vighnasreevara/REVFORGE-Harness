/**
 * Access evidence from a Claude Code subagent transcript (JSONL). Only tool
 * calls the transcript actually records are reported: Read (with the line
 * window it returned), Grep and Glob, each with whether the call succeeded.
 * Nothing is inferred from packet inputs or from an agent's own statements.
 */
import * as fs from 'fs';
import * as path from 'path';
import { sha256File } from '../core/fsutil';

export interface ToolAccess {
  tool: 'Read' | 'Grep' | 'Glob';
  path: string;
  offset: number | null;
  limit: number | null;
  pattern: string | null;
  ok: boolean;
  at: string | null;
}

export interface TranscriptAccess {
  transcript: string;
  transcript_sha256: string | null;
  agent_id: string | null;
  tool_calls: number;
  accesses: ToolAccess[];
}

/** Default Read window when no limit is given (Claude Code reads up to 2000 lines). */
export const DEFAULT_READ_LIMIT = 2000;

export function normPath(p: string): string {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

export function parseTranscript(file: string): TranscriptAccess {
  const uses = new Map<string, ToolAccess>();
  const errors = new Set<string>();
  let agentId: string | null = null;
  let calls = 0;
  for (const l of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!l.trim()) continue;
    let e: any;
    try {
      e = JSON.parse(l);
    } catch {
      continue;
    }
    agentId = agentId ?? e.agentId ?? null;
    const content = Array.isArray(e.message?.content) ? e.message.content : [];
    for (const c of content) {
      if (c.type === 'tool_use') {
        calls++;
        const i = c.input ?? {};
        if (c.name === 'Read' && i.file_path) uses.set(c.id, { tool: 'Read', path: i.file_path, offset: i.offset ?? null, limit: i.limit ?? null, pattern: null, ok: true, at: e.timestamp ?? null });
        if (c.name === 'Grep') uses.set(c.id, { tool: 'Grep', path: i.path ?? '.', offset: null, limit: null, pattern: i.pattern ?? null, ok: true, at: e.timestamp ?? null });
        if (c.name === 'Glob') uses.set(c.id, { tool: 'Glob', path: i.path ?? '.', offset: null, limit: null, pattern: i.pattern ?? null, ok: true, at: e.timestamp ?? null });
      } else if (c.type === 'tool_result' && c.is_error) errors.add(c.tool_use_id);
    }
  }
  for (const [id, u] of uses) if (errors.has(id)) u.ok = false;
  return { transcript: file, transcript_sha256: sha256File(file), agent_id: agentId, tool_calls: calls, accesses: [...uses.values()] };
}

export type AccessLevel = 'read_covering_citation' | 'file_read_other_lines' | 'grep_only' | 'grep_directory_only' | 'not_demonstrated';

/** Strongest demonstrated access to `file` (and, if given, to every cited line). */
export function accessFor(t: TranscriptAccess | null, file: string, lines: number[] = []): AccessLevel {
  if (!t) return 'not_demonstrated';
  const target = normPath(file);
  const reads = t.accesses.filter((a) => a.tool === 'Read' && a.ok && normPath(a.path) === target);
  if (reads.length) {
    if (!lines.length) return 'read_covering_citation';
    const covered = (n: number) => reads.some((r) => {
      const from = r.offset ?? 1;
      const to = from + (r.limit ?? DEFAULT_READ_LIMIT) - 1;
      return n >= from && n <= to;
    });
    return lines.every(covered) ? 'read_covering_citation' : 'file_read_other_lines';
  }
  const greps = t.accesses.filter((a) => a.tool === 'Grep' && a.ok);
  if (greps.some((a) => normPath(a.path) === target)) return 'grep_only';
  // A Grep over a containing directory searched the file but does not show which content was used.
  if (greps.some((a) => target.startsWith(normPath(a.path) + '/'))) return 'grep_directory_only';
  return 'not_demonstrated';
}

/** Files read successfully (normalised paths). */
export function filesRead(t: TranscriptAccess): Set<string> {
  return new Set(t.accesses.filter((a) => a.tool === 'Read' && a.ok).map((a) => normPath(a.path)));
}
