#!/usr/bin/env node
/**
 * Local integrity and recovery manifest for the uncommitted forward
 * implementation (STEP 9). Records the path, size and sha256 of every
 * implementation file under forward/ (sources, contracts, config, docs,
 * tests, integration metadata, reports) and of the forward agent and skill
 * definitions under .claude/. It stores hashes only: no file content, no
 * COBOL source, no workflow records, no keys. It is not a Git commit.
 *
 *   node forward/tools/recovery-manifest.js [--out FILE]   write the manifest
 *   node forward/tools/recovery-manifest.js --verify FILE  compare the tree with a manifest
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const forward = path.resolve(__dirname, '..');
const repo = path.resolve(forward, '..');
const EXCLUDE = [/^forward\/(dist|node_modules|runs)\//, /^forward\/integrations\/bmad\/(staging|executor)\//, /^forward\/reports\/step-9\/recovery-manifest\.json$/];
// An actual PEM private-key block (header followed by base64 key data), not code or docs that merely name it.
const PRIVATE = /-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[A-Za-z0-9+/=\r\n]{40,}/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(repo, p).split(path.sep).join('/');
    if (EXCLUDE.some((r) => r.test(rel + (e.isDirectory() ? '/' : '')))) continue;
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) walk(p, out);
    else out.push(rel);
  }
  return out;
}

function build() {
  const files = [...walk(forward), ...['agents', 'skills'].flatMap((d) => {
    const base = path.join(repo, '.claude', d);
    return fs.existsSync(base) ? walk(base).filter((r) => /\/fe-/.test(r)) : [];
  })].sort();
  const entries = [];
  const warnings = [];
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(repo, rel));
    if (PRIVATE.test(buf.toString('latin1'))) warnings.push(`${rel} contains private key material (excluded)`);
    else entries.push({ path: rel, bytes: buf.length, sha256: crypto.createHash('sha256').update(buf).digest('hex') });
  }
  let git = null;
  try {
    git = { commit: execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), branch: execFileSync('git', ['-C', repo, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim() };
  } catch {
    git = null;
  }
  const tree = crypto.createHash('sha256').update(entries.map((e) => `${e.path}\t${e.sha256}\n`).join('')).digest('hex');
  return { contract: 'forward-recovery-manifest', contract_version: '1.0', generated_at: new Date().toISOString(), git, note: 'hashes only: no content, no COBOL source, no workflow records, no keys; not a Git commit', excluded: EXCLUDE.map(String), files: entries.length, tree_sha256: tree, warnings, entries };
}

const args = process.argv.slice(2);
if (args[0] === '--verify') {
  const m = JSON.parse(fs.readFileSync(args[1], 'utf8'));
  const now = new Map(build().entries.map((e) => [e.path, e.sha256]));
  const changed = m.entries.filter((e) => now.has(e.path) && now.get(e.path) !== e.sha256).map((e) => e.path);
  const missing = m.entries.filter((e) => !now.has(e.path)).map((e) => e.path);
  const added = [...now.keys()].filter((p) => !m.entries.some((e) => e.path === p));
  console.log(JSON.stringify({ ok: !changed.length && !missing.length, changed, missing, added }, null, 2));
  process.exit(!changed.length && !missing.length ? 0 : 1);
}
const out = args[0] === '--out' ? path.resolve(args[1]) : path.join(forward, 'reports', 'step-9', 'recovery-manifest.json');
const m = build();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(m, null, 2) + '\n', 'utf8');
console.log(`recovery manifest: ${m.files} file(s), tree ${m.tree_sha256.slice(0, 16)}…, ${m.warnings.length} warning(s) -> ${out}`);
