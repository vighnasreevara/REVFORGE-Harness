/**
 * BMad release discovery and integrity verification (STEP 6). The release is
 * staged, never installed: a pinned npm tarball and its extracted package
 * under forward/integrations/bmad/staging. Every extracted file is checked
 * against the pinned sha256 manifest, and the workflow catalogue is derived
 * again from the staged SKILL.md files and compared with the pinned registry,
 * so a modified, added or removed workflow definition is detected before any
 * binding can use it.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { RuntimeContext } from '../core/config';
import { readJson, sha256Buffer, sha256File } from '../core/fsutil';

export const BMAD_DIR_ENV = 'REVFORGE_BMAD_INTEGRATION_DIR';

export interface BmadPaths {
  dir: string;
  pin: string;
  registry: string;
  bindings: string;
  mapping: string;
}

export function bmadPaths(ctx: RuntimeContext): BmadPaths {
  const dir = path.resolve(process.env[BMAD_DIR_ENV] ?? path.join(ctx.forwardDir, 'integrations', 'bmad'));
  return { dir, pin: path.join(dir, 'release.pin.json'), registry: path.join(dir, 'workflow-registry.json'), bindings: path.join(dir, 'bindings.json'), mapping: path.join(dir, 'mapping.json') };
}

export interface Check {
  id: string;
  ok: boolean;
  detail: string;
}

export interface WorkflowEntry {
  workflow_id: string;
  path: string;
  directory_name: string;
  lifecycle: 'active' | 'shim' | 'deprecated' | 'agent';
  forwards_to: string | null;
  phase_dir: string;
  display_name: string | null;
  menu_code: string | null;
  catalog_phase: string | null;
  output_location: string | null;
  skill_md_sha256: string;
  files: number;
  directory_sha256: string;
  requires_python_uv: boolean;
  description: string;
}

/** Files under `dir`, as sorted POSIX relative paths. */
export function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join('/'));
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Pinned digest rule: sha256 over "<relative path>\t<sha256>\n" lines sorted by path. */
export function directoryDigest(dir: string): { files: number; sha256: string } {
  const fl = filesUnder(dir);
  const h = createHash('sha256');
  for (const r of fl) h.update(`${r}\t${sha256File(path.join(dir, r))}\n`, 'utf8');
  return { files: fl.length, sha256: h.digest('hex') };
}

/** Minimal SKILL.md frontmatter reader (top-level keys and one nested level, as the release uses). */
export function skillFrontmatter(text: string): Record<string, string> {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out: Record<string, string> = {};
  if (!m) return out;
  let cur: string | null = null;
  for (const line of m[1].split(/\r?\n/)) {
    const top = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (top) {
      let v = top[2].trim();
      if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === "'" || v[0] === '"')) v = v.slice(1, -1);
      out[top[1]] = v;
      cur = top[1];
      continue;
    }
    const nested = /^\s+([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (nested && cur) out[`${cur}.${nested[1]}`] = nested[2].trim();
  }
  return out;
}

/** Workflow definitions discovered from the staged package (src/**\/SKILL.md). */
export function discoverWorkflows(packageDir: string): Array<Pick<WorkflowEntry, 'workflow_id' | 'path' | 'lifecycle' | 'forwards_to' | 'skill_md_sha256' | 'directory_sha256' | 'files'>> {
  const out = [];
  for (const rel of filesUnder(packageDir)) {
    if (!rel.startsWith('src/') || !rel.endsWith('/SKILL.md')) continue;
    const dir = rel.slice(0, -'/SKILL.md'.length);
    const text = fs.readFileSync(path.join(packageDir, rel), 'utf8');
    const fm = skillFrontmatter(text);
    const desc = fm.description ?? '';
    const lifecycle: WorkflowEntry['lifecycle'] = fm['metadata.lifecycle'] === 'shim' ? 'shim' : /^deprecated/i.test(desc) ? 'deprecated' : dir.includes('/agents/') ? 'agent' : 'active';
    const fwd = /forwards to (bmad-[a-z0-9-]+)/.exec(desc);
    const d = directoryDigest(path.join(packageDir, dir));
    out.push({ workflow_id: fm.name ?? '', path: dir, lifecycle, forwards_to: fwd ? fwd[1] : null, skill_md_sha256: sha256File(path.join(packageDir, rel))!, directory_sha256: d.sha256, files: d.files });
  }
  return out.sort((a, b) => (a.workflow_id < b.workflow_id ? -1 : 1));
}

export interface ReleaseVerification {
  ok: boolean;
  package: string | null;
  version: string | null;
  pin_sha256: string | null;
  registry_sha256: string | null;
  tarball_sha256: string | null;
  directory_sha256: string | null;
  package_dir: string | null;
  checks: Check[];
  modified: string[];
  added: string[];
  missing: string[];
  registry: WorkflowEntry[];
  workflow_problems: Map<string, string[]>;
}

/** Verifies the tarball, every extracted file and the workflow catalogue against the pinned records. */
export function verifyRelease(ctx: RuntimeContext): ReleaseVerification {
  const p = bmadPaths(ctx);
  const checks: Check[] = [];
  const v: ReleaseVerification = { ok: false, package: null, version: null, pin_sha256: null, registry_sha256: null, tarball_sha256: null, directory_sha256: null, package_dir: null, checks, modified: [], added: [], missing: [], registry: [], workflow_problems: new Map() };
  const pin = readJson(p.pin) as { ok: true; data: any; sha256: string } | { ok: false; error: string };
  if (!pin.ok) {
    checks.push({ id: 'pin_record', ok: false, detail: `cannot read ${p.pin}: ${pin.error}` });
    return v;
  }
  const pc = ctx.contracts.validate('bmad/release-pin', pin.data);
  checks.push({ id: 'pin_record', ok: pc.valid, detail: pc.valid ? `bmad/release-pin valid (${pin.data.package}@${pin.data.version}, ${pin.data.channel})` : pc.errors.join('; ') });
  if (!pc.valid) return v;
  const P = pin.data;
  v.package = P.package;
  v.version = P.version;
  v.pin_sha256 = pin.sha256;
  checks.push({ id: 'release_line', ok: P.channel === 'stable' && /^6\.12\.\d+$/.test(P.version), detail: `${P.version} on channel ${P.channel} (stable 6.12 line required; previews and v7 are refused)` });
  checks.push({ id: 'no_lifecycle_scripts', ok: Object.keys(P.node.lifecycle_scripts).length === 0, detail: 'the pinned package declares no install-time lifecycle scripts' });

  const tgz = path.join(p.dir, P.tarball.file);
  if (fs.existsSync(tgz)) {
    const buf = fs.readFileSync(tgz);
    v.tarball_sha256 = sha256Buffer(buf);
    const integrity = 'sha512-' + createHash('sha512').update(buf).digest('base64');
    const ok = v.tarball_sha256 === P.tarball.sha256 && integrity === P.tarball.integrity && buf.length === P.tarball.bytes;
    checks.push({ id: 'tarball_integrity', ok, detail: ok ? `tarball sha256 ${v.tarball_sha256.slice(0, 16)}… and npm sha512 integrity match the pin` : 'staged tarball does not match the pinned sha256 / sha512 / size' });
  } else checks.push({ id: 'tarball_integrity', ok: false, detail: `staged tarball ${P.tarball.file} is missing` });

  const pkgDir = path.join(p.dir, P.extracted.dir);
  v.package_dir = pkgDir;
  const pinned: Record<string, string> = P.files;
  const present = filesUnder(pkgDir);
  const presentSet = new Set(present);
  for (const r of present) {
    if (!(r in pinned)) v.added.push(r);
    else if (sha256File(path.join(pkgDir, r)) !== pinned[r]) v.modified.push(r);
  }
  for (const r of Object.keys(pinned)) if (!presentSet.has(r)) v.missing.push(r);
  const d = directoryDigest(pkgDir);
  v.directory_sha256 = d.sha256;
  const filesOk = !v.added.length && !v.modified.length && !v.missing.length && d.sha256 === P.extracted.directory_sha256;
  checks.push({ id: 'extracted_files', ok: filesOk, detail: filesOk ? `${d.files} extracted file(s) match the pinned manifest (digest ${d.sha256.slice(0, 16)}…)` : `staged package differs from the pin: ${v.modified.length} modified, ${v.added.length} added, ${v.missing.length} missing${[...v.modified, ...v.added, ...v.missing].length ? ` (${[...v.modified, ...v.added, ...v.missing].slice(0, 5).join(', ')})` : ''}` });

  const reg = readJson(p.registry) as { ok: true; data: any; sha256: string } | { ok: false; error: string };
  if (!reg.ok) checks.push({ id: 'workflow_registry', ok: false, detail: `cannot read ${p.registry}: ${reg.error}` });
  else {
    const rc = ctx.contracts.validate('bmad/workflow-registry', reg.data);
    v.registry_sha256 = reg.sha256;
    v.registry = rc.valid ? reg.data.workflows : [];
    const same = rc.valid && reg.data.package === P.package && reg.data.version === P.version;
    checks.push({ id: 'workflow_registry', ok: same, detail: same ? `${reg.data.workflows.length} workflow definition(s) registered for ${P.package}@${P.version}` : rc.valid ? 'registry is for a different release' : rc.errors.join('; ') });
    if (same) {
      const found = new Map(discoverWorkflows(pkgDir).map((w) => [w.workflow_id, w]));
      for (const w of v.registry) {
        const f = found.get(w.workflow_id);
        const probs: string[] = [];
        if (!f) probs.push('definition not found in the staged release');
        else {
          if (f.path !== w.path) probs.push(`moved from ${w.path} to ${f.path}`);
          if (f.lifecycle !== w.lifecycle) probs.push(`lifecycle changed from ${w.lifecycle} to ${f.lifecycle}`);
          if (f.skill_md_sha256 !== w.skill_md_sha256) probs.push('SKILL.md changed');
          if (f.directory_sha256 !== w.directory_sha256) probs.push('workflow files changed');
        }
        v.workflow_problems.set(w.workflow_id, probs);
      }
      const unregistered = [...found.keys()].filter((id) => !v.registry.some((w) => w.workflow_id === id));
      const bad = [...v.workflow_problems.entries()].filter(([, x]) => x.length);
      checks.push({ id: 'workflow_definitions', ok: !bad.length && !unregistered.length, detail: !bad.length && !unregistered.length ? `every registered workflow definition re-derived from the staged files and unchanged` : [...bad.map(([id, x]) => `${id}: ${x.join(', ')}`), ...unregistered.map((id) => `${id}: not in the registry`)].slice(0, 6).join(' | ') });
    }
  }
  v.ok = checks.every((c) => c.ok);
  return v;
}

/** What an installation would touch, and whether anything BMad-shaped has appeared outside staging. */
export function installationImpact(ctx: RuntimeContext): { checks: Check[]; bmad_skills_in_repo: string[] } {
  const repoSkills = path.join(ctx.repoRoot, '.claude', 'skills');
  const bmadSkills = fs.existsSync(repoSkills) ? fs.readdirSync(repoSkills).filter((n) => /^bmad-/.test(n)) : [];
  const checks: Check[] = [
    { id: 'repo_claude_skills_untouched', ok: bmadSkills.length === 0, detail: bmadSkills.length ? `BMad skills found in .claude/skills: ${bmadSkills.join(', ')}` : 'no BMad skill is installed in the repository .claude/skills' },
    { id: 'repo_bmad_config_absent', ok: !fs.existsSync(path.join(ctx.repoRoot, '_bmad')), detail: fs.existsSync(path.join(ctx.repoRoot, '_bmad')) ? '_bmad/ exists at the repository root' : 'no _bmad/ directory at the repository root' },
    { id: 'repo_bmad_output_absent', ok: !fs.existsSync(path.join(ctx.repoRoot, '_bmad-output')), detail: fs.existsSync(path.join(ctx.repoRoot, '_bmad-output')) ? '_bmad-output/ exists at the repository root' : 'no _bmad-output/ directory at the repository root' },
  ];
  return { checks, bmad_skills_in_repo: bmadSkills };
}
