/**
 * Canonical agent and skill definitions live outside .claude/:
 *   forward/agents, forward/skills   the seven forward agents and their 14 skills
 *   reverse/agents, reverse/skills   the seven reverse agents and their 14 skills
 * Claude Code discovers agents and skills only under .claude/, so this module
 * keeps a byte-identical copy of exactly the registered ones there:
 *   .claude/agents/<agent>.agent.md   from forward/agents/ or reverse/agents/
 *   .claude/skills/<skill>/           from forward/skills/ or reverse/skills/
 * Only names in the registries (AGENTS and SKILLS for forward, REVERSE_AGENTS
 * and REVERSE_SKILLS for reverse) are ever written or removed. The scope
 * argument selects which side is compared or synchronized; 'forward' is the
 * default, so a forward-only sync never touches a reverse definition.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { AGENTS } from './agents';
import { SKILLS } from './skills';
import { REVERSE_AGENTS, REVERSE_SKILLS } from './reverse';

const sha = (f: string) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function filesUnder(d: string, base = d): string[] {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).split(path.sep).join('/')]));
}

export type MirrorScope = 'forward' | 'reverse' | 'all';

export interface MirrorEntry {
  side: 'forward' | 'reverse';
  kind: 'agent' | 'skill';
  name: string;
  source: string;
  mirror: string;
  status: 'IN_SYNC' | 'MISSING' | 'DIFFERENT' | 'NO_SOURCE';
  files: string[];
}

type Pair = { side: 'forward' | 'reverse'; kind: 'agent' | 'skill'; name: string; source: string; mirror: string };

/** The canonical and Claude Code (mirror) locations of every registered agent and skill in scope. */
export function mirrorPairs(ctx: RuntimeContext, scope: MirrorScope = 'forward'): Pair[] {
  const claude = path.join(ctx.repoRoot, '.claude');
  const side = (s: 'forward' | 'reverse', root: string, agents: Array<{ name: string }>, skills: Array<{ name: string }>): Pair[] => [
    ...agents.map((a) => ({ side: s, kind: 'agent' as const, name: a.name, source: path.join(root, 'agents', `${a.name}.agent.md`), mirror: path.join(claude, 'agents', `${a.name}.agent.md`) })),
    ...skills.map((k) => ({ side: s, kind: 'skill' as const, name: k.name, source: path.join(root, 'skills', k.name), mirror: path.join(claude, 'skills', k.name) })),
  ];
  return [
    ...(scope === 'reverse' ? [] : side('forward', ctx.forwardDir, AGENTS, SKILLS)),
    ...(scope === 'forward' ? [] : side('reverse', path.join(ctx.repoRoot, 'reverse'), REVERSE_AGENTS, REVERSE_SKILLS)),
  ];
}

export function mirrorStatus(ctx: RuntimeContext, scope: MirrorScope = 'forward'): { in_sync: boolean; entries: MirrorEntry[] } {
  const entries: MirrorEntry[] = mirrorPairs(ctx, scope).map((p) => {
    if (!fs.existsSync(p.source)) return { ...p, status: 'NO_SOURCE', files: [] };
    if (p.kind === 'agent') {
      if (!fs.existsSync(p.mirror)) return { ...p, status: 'MISSING', files: [] };
      return { ...p, status: sha(p.source) === sha(p.mirror) ? 'IN_SYNC' : 'DIFFERENT', files: [] };
    }
    const src = filesUnder(p.source).sort();
    const dst = filesUnder(p.mirror).sort();
    if (!dst.length) return { ...p, status: 'MISSING', files: src };
    const same = src.length === dst.length && src.every((f, k) => f === dst[k] && sha(path.join(p.source, f)) === sha(path.join(p.mirror, f)));
    return { ...p, status: same ? 'IN_SYNC' : 'DIFFERENT', files: src };
  });
  return { in_sync: entries.every((e) => e.status === 'IN_SYNC'), entries };
}

/** Copies the canonical definitions in scope over their .claude/ mirrors (the canonical directories are authoritative). */
export function syncMirror(ctx: RuntimeContext, scope: MirrorScope = 'forward'): { written: string[]; entries: MirrorEntry[] } {
  const written: string[] = [];
  const pairs = mirrorPairs(ctx, scope);
  // Check every source first, so a missing definition never leaves a half-synchronized .claude/.
  for (const p of pairs) if (!fs.existsSync(p.source)) throw new Error(`${path.relative(ctx.repoRoot, p.source)} is missing: ${p.side}/${p.kind}s is the source of the ${p.kind} ${p.name}`);
  for (const p of pairs) {
    if (p.kind === 'agent') {
      if (!fs.existsSync(p.mirror) || sha(p.source) !== sha(p.mirror)) {
        fs.mkdirSync(path.dirname(p.mirror), { recursive: true });
        fs.copyFileSync(p.source, p.mirror);
        written.push(path.relative(ctx.repoRoot, p.mirror).split(path.sep).join('/'));
      }
      continue;
    }
    // A skill directory is replaced as a whole, so files removed in forward/ disappear from the mirror too.
    const src = filesUnder(p.source).sort();
    const dst = filesUnder(p.mirror).sort();
    const same = src.length === dst.length && src.every((f, k) => f === dst[k] && sha(path.join(p.source, f)) === sha(path.join(p.mirror, f)));
    if (same) continue;
    fs.rmSync(p.mirror, { recursive: true, force: true });
    for (const f of src) {
      fs.mkdirSync(path.dirname(path.join(p.mirror, f)), { recursive: true });
      fs.copyFileSync(path.join(p.source, f), path.join(p.mirror, f));
    }
    written.push(path.relative(ctx.repoRoot, p.mirror).split(path.sep).join('/') + '/');
  }
  return { written, entries: mirrorStatus(ctx, scope).entries };
}
