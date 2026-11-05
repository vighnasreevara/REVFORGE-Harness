// Copies the committed evidence named in evidence-sources.json, byte for byte,
// into public/evidence/<repo-relative path> and writes public/evidence/manifest.json.
// Read-only towards the repository: it never writes outside public/evidence/.
// Deterministic: the manifest holds no timestamps, only commits and hashes.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DASH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(DASH, '..', '..');
const OUT = path.join(DASH, 'public', 'evidence');
const registry = JSON.parse(fs.readFileSync(path.join(DASH, 'evidence-sources.json'), 'utf8'));

const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 }).trim();
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

let head = null;
let headDate = null;
try {
  head = git('rev-parse', 'HEAD');
  headDate = git('log', '-1', '--format=%cI', 'HEAD');
} catch {
  head = null;
}

// Commit that last changed a source file (its report version), from git history.
function lastCommit(rel) {
  if (!head) return null;
  try {
    const [sha, date] = git('log', '-1', '--format=%H %cI', '--', rel).split(' ');
    return sha ? { sha, date } : null;
  } catch {
    return null;
  }
}

// HEAD blob of every tracked file below the directories we read from.
const headBlobs = new Map();
if (head) {
  const roots = [...new Set([...registry.sources.map((s) => s.path), ...registry.collections.map((c) => c.dir)])];
  for (const line of git('ls-tree', '-r', 'HEAD', '--', ...roots).split('\n').filter(Boolean)) {
    const [meta, p] = line.split('\t');
    headBlobs.set(p, meta.split(' ')[2]);
  }
}

function describe(rel) {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs)) return { path: rel, missing: true };
  const buf = fs.readFileSync(abs);
  const committed = headBlobs.get(rel) ?? null;
  let working = null;
  try { working = git('hash-object', '--', rel); } catch { working = null; }
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.writeFileSync(path.join(OUT, rel), buf);
  return {
    path: rel,
    missing: false,
    bytes: buf.length,
    sha256: sha256(buf),
    git_blob_head: committed,
    committed: committed !== null,
    matches_head: committed !== null && committed === working,
  };
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const sources = registry.sources.map((s) => {
  const d = describe(s.path);
  return { key: s.key, step: s.step, required: s.required, format: s.format ?? 'json', ...d, last_commit: d.missing ? null : lastCommit(s.path) };
});
const collections = registry.collections.map((c) => {
  // Only committed members: a file present on disk but not in HEAD is not evidence.
  const members = [...headBlobs.keys()].filter((p) => p.startsWith(`${c.dir}/`) && p.endsWith(c.ext) && !p.slice(c.dir.length + 1).includes('/')).sort();
  return { key: c.key, step: c.step, required: c.required, dir: c.dir, ext: c.ext, load: c.load, files: members.map(describe) };
});

const all = [...sources, ...collections.flatMap((c) => c.files)];
const manifest = {
  contract: 'dashboard/evidence-manifest',
  baseline_commit: head,
  baseline_commit_date: headDate,
  repository: 'https://github.com/vighnasreevara/REVFORGE-Harness',
  totals: {
    files: all.length,
    missing: all.filter((f) => f.missing).map((f) => f.path),
    uncommitted: all.filter((f) => !f.missing && !f.committed).map((f) => f.path),
    modified_since_commit: all.filter((f) => !f.missing && f.committed && !f.matches_head).map((f) => f.path),
    bytes: all.reduce((n, f) => n + (f.bytes ?? 0), 0),
  },
  sources,
  collections,
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');

const t = manifest.totals;
console.log(`evidence: ${t.files} file(s), ${(t.bytes / 1048576).toFixed(1)} MiB, baseline ${head ? head.slice(0, 12) : 'unknown'}; missing ${t.missing.length}, uncommitted ${t.uncommitted.length}, modified ${t.modified_since_commit.length}`);
for (const p of [...t.missing, ...t.uncommitted, ...t.modified_since_commit]) console.log(`  ! ${p}`);
