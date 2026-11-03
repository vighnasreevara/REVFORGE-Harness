/**
 * Forward agents and skills live in forward/agents and forward/skills (the
 * single place to edit them; the reverse harness stays in .claude/). Claude
 * Code discovers agents and skills only under .claude/, so this module keeps a
 * byte-identical copy of exactly the forward ones there:
 *   .claude/agents/<fe-agent>.agent.md   from forward/agents/
 *   .claude/skills/<fe-skill>/            from forward/skills/
 * Only names in the forward registries (AGENTS, SKILLS) are ever written or
 * removed; reverse-harness files are never touched.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { AGENTS } from './agents';
import { SKILLS } from './skills';

const sha = (f: string) => createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function filesUnder(d: string, base = d): string[] {
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(path.join(d, e.name), base) : [path.relative(base, path.join(d, e.name)).split(path.sep).join('/')]));
}

export interface MirrorEntry {
  kind: 'agent' | 'skill';
  name: string;
  source: string;
  mirror: string;
  status: 'IN_SYNC' | 'MISSING' | 'DIFFERENT' | 'NO_SOURCE';
  files: string[];
}

/** The forward (canonical) and Claude Code (mirror) locations of every forward agent and skill. */
export function mirrorPairs(ctx: RuntimeContext): Array<{ kind: 'agent' | 'skill'; name: string; source: string; mirror: string }> {
  const fwdAgents = path.join(ctx.forwardDir, 'agents');
  const fwdSkills = path.join(ctx.forwardDir, 'skills');
  return [
    ...AGENTS.map((a) => ({ kind: 'agent' as const, name: a.name, source: path.join(fwdAgents, `${a.name}.agent.md`), mirror: path.join(ctx.repoRoot, '.claude', 'agents', `${a.name}.agent.md`) })),
    ...SKILLS.map((s) => ({ kind: 'skill' as const, name: s.name, source: path.join(fwdSkills, s.name), mirror: path.join(ctx.repoRoot, '.claude', 'skills', s.name) })),
  ];
}

export function mirrorStatus(ctx: RuntimeContext): { in_sync: boolean; entries: MirrorEntry[] } {
  const entries: MirrorEntry[] = mirrorPairs(ctx).map((p) => {
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

/** Copies forward/agents and forward/skills over their .claude/ mirrors (forward is authoritative). */
export function syncMirror(ctx: RuntimeContext): { written: string[]; entries: MirrorEntry[] } {
  const written: string[] = [];
  for (const p of mirrorPairs(ctx)) {
    if (!fs.existsSync(p.source)) throw new Error(`${path.relative(ctx.repoRoot, p.source)} is missing: forward/${p.kind}s is the source of the ${p.kind} ${p.name}`);
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
  return { written, entries: mirrorStatus(ctx).entries };
}
