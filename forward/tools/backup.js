#!/usr/bin/env node
/**
 * Recoverable local backup of the forward implementation (STEP 10). Files committed at the recorded
 * commit are recoverable from git and are listed (with their blob ids) instead of archived again; only
 * untracked, ignored and modified files are archived.
 *
 *   node forward/tools/backup.js create [--dest DIR]            archive + inventory + restore guide (outside the repo)
 *   node forward/tools/backup.js verify ARCHIVE                  safe entry list: no absolute paths, traversal or links
 *   node forward/tools/backup.js restore-test ARCHIVE [--checkout [--with-local-assets]] [--build] [--test] [--cleanup]
 *        restores into a fresh temporary directory (never the repository): a bare extract, or with
 *        --checkout a disposable clone of the local repository at the recorded commit; verifies every
 *        hash, required agents and skills, absence of secrets and (checkout) untouched tracked files;
 *        optionally builds and runs the tests there. --with-local-assets attaches the separately held
 *        workflow runs, provisioned executor and configured COBOL source root for the test run only,
 *        and always deletes the temporary directory afterwards.
 *
 * Discovery uses git: untracked and ignored files are listed explicitly and classified. Included:
 * the forward implementation (runtime, verification, contracts, config, tests, tools, docs, top-level
 * reports, BMad pins/metadata, the pinned BMad staging release, isolation launcher, package files) and
 * the forward agent and skill definitions under .claude/. Excluded (code-only backup): build output,
 * node_modules, workflow runs (sensitive records), report exports with source excerpts, the provisioned
 * BMad executor (reproducible), original COBOL, and anything that looks like a secret.
 * Nothing is uploaded anywhere.
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const forward = path.resolve(__dirname, '..');
const repo = path.resolve(forward, '..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
// Windows: use the built-in bsdtar (GNU tar from Git for Windows treats "C:" as a remote host).
const TAR = process.platform === 'win32' && fs.existsSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe')) ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
const git = (args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const EXCLUDE = [
  [/^forward\/(dist|node_modules|runs)\//, 'build output, dependencies or workflow records (sensitive; separate backup needed)'],
  [/^forward\/integrations\/bmad\/executor\/(?!\.gitignore$)/, 'provisioned BMad executor (reproducible: see BMAD-INTEGRATION-OPERATIONS.md)'],
  [/^forward\/reports\/step-[^/]+\//, 'machine report exports (may quote original COBOL)'],
  [/^forward\/pilot\/[^/]+\/out\//, 'synthetic pilot build output (reproducible with: pilot run)'],
  [/^forward\/generated\//, 'authorised generated Java derived from protected COBOL (reproducible with: pilot generate)'],
  [/^forward\/tests\/\.tmp\//,'transient test workspace (exists only while tests run)'],
  [/^forward\/reports\/[^/]+\.json$/, 'machine report exports (may quote original COBOL)'],
  [/^references\//, 'original COBOL source (not authorised for this backup)'],
  [/(^|\/)\.env(\.|$)|(^|\/)\.mcp\.json$|settings\.local\.json$/, 'credential or local settings file'],
];
const SECRET = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----\s*[A-Za-z0-9+/=\r\n]{40,}/, 'private key block'],
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{24,}/, 'API key'],
  [/\b(?:OPENAI|ANTHROPIC)_API_KEY\s*[=:]\s*["']?[A-Za-z0-9_-]{16,}/, 'API key assignment'],
  [/\bNEO4J_PASSWORD\s*[=:]\s*["']?[^\s"'$<{]{4,}/, 'database password assignment'],
];
/**
 * Documented synthetic test values that look like secrets but are not: the STEP 5 tests use this
 * fake key to prove that keys are redacted. Only this exact prefix is allowed; any other
 * key-shaped value still excludes its file.
 */
const SYNTHETIC = [/\bsk-test-REVFORGE-[0-9a-z]+\b/g];
const hasSecret = (text) => {
  const t = SYNTHETIC.reduce((s, re) => s.replace(re, '[synthetic-test-value]'), text);
  return SECRET.find(([re]) => re.test(t)) ?? null;
};
const REQUIRED = { agents: 7, skills: 14 };

function discover() {
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const ignored = git(['ls-files', '--others', '--ignored', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  const modified = git(['diff', '--name-only', '-z']).split('\0').filter(Boolean);
  const candidates = [...new Set([...untracked, ...ignored, ...modified])].filter((p) => p.startsWith('forward/') || /^\.claude\/(agents|skills)\/fe-/.test(p)).sort();
  const included = [];
  const excluded = [];
  for (const rel of candidates) {
    const rule = EXCLUDE.find(([re]) => re.test(rel));
    if (rule) {
      excluded.push({ path: rel, reason: rule[1] });
      continue;
    }
    const abs = path.join(repo, rel);
    const st = fs.lstatSync(abs);
    if (st.isSymbolicLink()) {
      excluded.push({ path: rel, reason: 'symbolic link' });
      continue;
    }
    if (!st.isFile()) continue;
    const buf = fs.readFileSync(abs);
    const secret = hasSecret(buf.toString('latin1'));
    if (secret) {
      excluded.push({ path: rel, reason: `looks like it contains a secret (${secret[1]}); content not recorded` });
      continue;
    }
    included.push({ path: rel, bytes: buf.length, sha256: sha(buf), source: untracked.includes(rel) ? 'untracked' : ignored.includes(rel) ? 'ignored' : 'modified' });
  }
  // Tracked files of the same roots are recoverable from the recorded commit (they are not archived again). They are
  // listed with their git blob ids so a restore can prove the commit still holds them, and they are scanned for
  // secrets too: a committed secret is a violation, never silently accepted.
  const tracked = [];
  const trackedSecrets = [];
  for (const line of git(['ls-files', '-s', '-z']).split('\0').filter(Boolean)) {
    const tab = line.indexOf('\t');
    const rel = line.slice(tab + 1);
    if (!(rel.startsWith('forward/') || /^\.claude\/(agents|skills)\/fe-/.test(rel)) || modified.includes(rel)) continue;
    const abs = path.join(repo, rel);
    if (!fs.existsSync(abs) || !fs.lstatSync(abs).isFile()) continue;
    const buf = fs.readFileSync(abs);
    const secret = hasSecret(buf.toString('latin1'));
    if (secret) trackedSecrets.push({ path: rel, reason: secret[1] });
    tracked.push({ path: rel, blob: line.slice(0, tab).split(' ')[1], bytes: buf.length, sha256: sha(buf) });
  }
  // Collapse excluded paths to their directories so the inventory stays readable.
  const byDir = new Map();
  for (const e of excluded) {
    const key = e.reason.startsWith('looks like') || e.reason === 'symbolic link' ? e.path : e.path.split('/').slice(0, 3).join('/');
    if (!byDir.has(key)) byDir.set(key, { path: key, reason: e.reason, files: 0 });
    byDir.get(key).files++;
  }
  return { included, excluded: [...byDir.values()], tracked, tracked_secrets: trackedSecrets };
}

/** Agent and skill counts over a list of repository-relative paths. */
const feCounts = (paths) => ({
  agents: paths.filter((p) => /^\.claude\/agents\/fe-.*\.agent\.md$/.test(p)).length,
  skills: new Set(paths.filter((p) => /^\.claude\/skills\/fe-[^/]+\/SKILL\.md$/.test(p)).map((p) => p.split('/')[2])).size,
});

function versions() {
  const pkg = JSON.parse(fs.readFileSync(path.join(forward, 'package.json'), 'utf8'));
  const lock = path.join(forward, 'package-lock.json');
  let pin = null;
  try {
    const p = JSON.parse(fs.readFileSync(path.join(forward, 'integrations', 'bmad', 'release.pin.json'), 'utf8'));
    pin = { package: p.package, version: p.version, tarball_sha256: p.tarball.sha256 };
  } catch {
    pin = null;
  }
  return { node: process.version, platform: `${process.platform} ${os.release()}`, git: { commit: git(['rev-parse', 'HEAD']).trim(), branch: git(['rev-parse', '--abbrev-ref', 'HEAD']).trim() }, package: { name: pkg.name, version: pkg.version, dependencies: pkg.dependencies, devDependencies: pkg.devDependencies }, package_lock_sha256: fs.existsSync(lock) ? sha(fs.readFileSync(lock)) : null, bmad_pin: pin };
}

function create(dest) {
  const root = path.resolve(dest || path.join(os.homedir(), 'revforge-backups'));
  const rr = path.resolve(repo).toLowerCase();
  if (path.resolve(root).toLowerCase().startsWith(rr + path.sep) || path.resolve(root).toLowerCase() === rr) throw new Error(`backup destination ${root} must be outside the repository`);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const dir = path.join(root, `revforge-forward-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  const { included, excluded, tracked, tracked_secrets } = discover();
  if (tracked_secrets.length) throw new Error(`committed files contain secret patterns: ${tracked_secrets.map((t) => `${t.path} (${t.reason})`).join(', ')}`);
  const list = path.join(dir, 'filelist.txt');
  fs.writeFileSync(list, included.map((f) => f.path).join('\n') + '\n', 'utf8');
  const archive = path.join(dir, `revforge-forward-${stamp}.tgz`);
  const r = spawnSync(TAR, ['-czf', archive, '-C', repo, '-T', list], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`tar failed: ${r.stderr}`);
  fs.unlinkSync(list);
  const inv = {
    contract: 'forward-backup-inventory',
    contract_version: '1.0',
    created_at: new Date().toISOString(),
    archive: path.basename(archive),
    archive_sha256: sha(fs.readFileSync(archive)),
    archive_bytes: fs.statSync(archive).size,
    files: included.length,
    total_bytes: included.reduce((n, f) => n + f.bytes, 0),
    tree_sha256: sha(included.map((f) => `${f.path}\t${f.sha256}\n`).join('')),
    required: feCounts([...included, ...tracked].map((f) => f.path)),
    versions: versions(),
    exclusions: excluded,
    entries: included,
    // Recoverable from the recorded commit (a checkout of it), not from the archive.
    tracked_at_commit: { files: tracked.length, tree_sha256: sha(tracked.map((f) => `${f.path}\t${f.blob}\n`).join('')), entries: tracked.map((f) => ({ path: f.path, blob: f.blob, sha256: f.sha256 })) },
  };
  fs.writeFileSync(path.join(dir, 'inventory.json'), JSON.stringify(inv, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'SHA256SUMS'), `${inv.archive_sha256}  ${inv.archive}\n${sha(fs.readFileSync(path.join(dir, 'inventory.json')))}  inventory.json\n`, 'utf8');
  fs.writeFileSync(path.join(dir, 'RESTORE.md'), restoreGuide(inv), 'utf8');
  return { ...inv, entries: undefined, archive_name: inv.archive, dir, archive, inventory: path.join(dir, 'inventory.json') };
}

function restoreGuide(inv) {
  return `# Restoring the REVFORGE forward implementation

Archive: \`${inv.archive}\` (sha256 \`${inv.archive_sha256}\`), ${inv.files} files, created ${inv.created_at} from commit \`${inv.versions.git.commit}\` (${inv.versions.git.branch}).

1. Verify the archive: \`sha256sum -c SHA256SUMS\` (or compare with inventory.json), then
   \`node forward/tools/backup.js verify <archive>\` from any checkout of the tool (rejects absolute paths, traversal and links).
2. Check out commit \`${inv.versions.git.commit}\` of the repository into the target directory.
3. Extract **into that checkout root**: \`tar -xzf ${inv.archive} -C <checkout>\`. Paths are relative (\`forward/...\`, \`.claude/agents/fe-*\`, \`.claude/skills/fe-*\`).
4. Install dependencies: \`cd forward && npm ci\` (Node ${inv.versions.node}; lockfile sha256 \`${inv.versions.package_lock_sha256}\`).
5. Build and test: \`npm test\`.
6. Re-provision what this code-only backup excludes, as needed:
   - workflow runs (\`forward/runs/\`): sensitive records, a separate authorised backup;
   - the BMad executor (\`forward/integrations/bmad/executor/\`): see forward/docs/BMAD-INTEGRATION-OPERATIONS.md;
   - the original COBOL source and reverse outputs: from their own repository / authorised location.
Excluded paths and reasons are listed in inventory.json (no excluded content is recorded).
`;
}

function listEntries(archive) {
  // Names from the plain listing; the entry type (first column of the verbose listing) by position.
  const names = spawnSync(TAR, ['-tzf', archive], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const verbose = spawnSync(TAR, ['-tvzf', archive], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (names.status !== 0 || verbose.status !== 0) throw new Error(`cannot list ${archive}: ${names.stderr || verbose.stderr}`);
  const n = names.stdout.split(/\r?\n/).filter(Boolean);
  const v = verbose.stdout.split(/\r?\n/).filter(Boolean);
  if (n.length !== v.length) throw new Error('archive listing is inconsistent');
  return n.map((name, i) => ({ type: v[i][0], name: name.replace(/ -> .*$/, '') }));
}

function verify(archive) {
  const problems = [];
  const entries = listEntries(archive);
  for (const e of entries) {
    const n = e.name.replace(/\\/g, '/');
    if (n.startsWith('/') || /^[A-Za-z]:/.test(n)) problems.push(`absolute path: ${n}`);
    if (n.split('/').includes('..')) problems.push(`path traversal: ${n}`);
    if (e.type === 'l' || e.type === 'h') problems.push(`link entry: ${n}`);
    if (!/^(forward\/|\.claude\/(agents|skills)\/fe-)/.test(n)) problems.push(`entry outside the expected roots: ${n}`);
  }
  return { ok: !problems.length, entries: entries.length, problems };
}

function restoreTest(archive, opts) {
  const dir = path.dirname(path.resolve(archive));
  const inv = JSON.parse(fs.readFileSync(path.join(dir, 'inventory.json'), 'utf8'));
  const report = { archive: path.resolve(archive), mode: opts.checkout ? 'git_checkout' : 'bare_extract', assets: null, checks: [], build: null, tests: null };
  const add = (id, ok, detail) => report.checks.push({ id, ok, detail });
  add('archive_hash', sha(fs.readFileSync(archive)) === inv.archive_sha256, `archive sha256 ${inv.archive_sha256.slice(0, 16)}…`);
  const v = verify(archive);
  add('archive_entries_safe', v.ok, v.ok ? `${v.entries} entries: relative, no traversal, no links` : v.problems.slice(0, 5).join('; '));
  if (!v.ok) return report;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-restore-'));
  report.restore_dir = tmp;
  let root = tmp;
  if (opts.checkout) {
    // A disposable clone of the local repository at the recorded commit (the source repository is only read).
    root = path.join(tmp, 'repo');
    const commit = inv.versions?.git?.commit;
    const c = spawnSync('git', ['clone', '--quiet', '--no-hardlinks', '--no-checkout', repo, root], { encoding: 'utf8' });
    const co = c.status === 0 ? spawnSync('git', ['-C', root, 'checkout', '--quiet', '--detach', commit], { encoding: 'utf8' }) : c;
    const head = co.status === 0 ? spawnSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() : null;
    add('git_baseline', head === commit, head === commit ? `disposable checkout at ${commit}` : `checkout failed: ${(c.stderr || co.stderr || '').trim()}`);
    if (head !== commit) return report;
  }
  const x = spawnSync(TAR, ['-xzf', archive, '-C', root], { encoding: 'utf8' });
  add('extracted', x.status === 0, x.status === 0 ? `extracted into ${root}` : x.stderr);
  const walk = (d, out = []) => {
    if (!fs.existsSync(d)) return out;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isSymbolicLink()) out.push({ rel: path.relative(root, p).split(path.sep).join('/'), link: true });
      else if (e.isDirectory()) walk(p, out);
      else out.push({ rel: path.relative(root, p).split(path.sep).join('/'), link: false });
    }
    return out;
  };
  // Only the archive's roots are compared (a checkout also holds the tracked repository files).
  const feEntries = (k) => {
    const d = path.join(root, '.claude', k);
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d).filter((n) => n.startsWith('fe-')).flatMap((n) => (fs.statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [{ rel: `.claude/${k}/${n}`, link: false }]));
  };
  const present = opts.checkout ? [...walk(path.join(root, 'forward')), ...feEntries('agents'), ...feEntries('skills')] : walk(root);
  const missing = inv.entries.filter((e) => !fs.existsSync(path.join(root, e.path)));
  const changed = inv.entries.filter((e) => fs.existsSync(path.join(root, e.path)) && sha(fs.readFileSync(path.join(root, e.path))) !== e.sha256);
  // Files recoverable from the recorded commit: every one must still be in that commit with the recorded blob.
  const trackedEntries = inv.tracked_at_commit?.entries ?? [];
  const trackedPaths = new Set(trackedEntries.map((e) => e.path));
  if (trackedEntries.length) {
    const commit = inv.versions?.git?.commit;
    const lt = spawnSync('git', ['-C', repo, 'ls-tree', '-r', '-z', commit], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const tree = new Map(lt.status === 0 ? lt.stdout.split('\0').filter(Boolean).map((l) => [l.slice(l.indexOf('\t') + 1), l.slice(0, l.indexOf('\t')).split(' ')[2]]) : []);
    const bad = trackedEntries.filter((e) => tree.get(e.path) !== e.blob);
    add('tracked_at_commit', lt.status === 0 && !bad.length, lt.status !== 0 ? `commit ${commit} is not available: ${(lt.stderr || '').trim()}` : bad.length ? `${bad.length} tracked file(s) differ from commit ${commit}: ${bad.slice(0, 5).map((b) => b.path).join(', ')}` : `${trackedEntries.length} tracked files recoverable from commit ${commit} with their recorded blobs`);
  }
  const extra = present.filter((p) => !inv.entries.some((e) => e.path === p.rel) && !trackedPaths.has(p.rel));
  add('files_present', !missing.length, missing.length ? `${missing.length} missing: ${missing.slice(0, 5).map((m) => m.path).join(', ')}` : `${inv.entries.length} files present at their original relative paths`);
  add('hashes_match', !changed.length, changed.length ? `${changed.length} changed: ${changed.slice(0, 5).map((m) => m.path).join(', ')}` : 'every sha256 matches the inventory');
  add('nothing_extra', !extra.length, extra.length ? `unexpected: ${extra.slice(0, 5).map((m) => m.rel).join(', ')}` : 'no unexpected files or links');
  if (opts.checkout) {
    // The restore may change exactly the tracked files the backup recorded as modified (uncommitted work, already
    // hash-checked above) and nothing else of the baseline commit.
    const d = spawnSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=no', '-z'], { encoding: 'utf8' });
    const changedTracked = d.status === 0 ? d.stdout.split('\0').filter(Boolean).map((l) => l.slice(3)) : [];
    const recordedModified = new Set(inv.entries.filter((e) => e.source === 'modified').map((e) => e.path));
    const unexpected = changedTracked.filter((p) => !recordedModified.has(p));
    add('tracked_files_intact', d.status === 0 && !unexpected.length, d.status !== 0 ? 'git status failed in the checkout' : unexpected.length ? `tracked files changed by the restore that the backup did not record as modified: ${unexpected.slice(0, 5).join('; ')}` : `the archive changed no tracked file of the baseline commit except the ${changedTracked.length} recorded uncommitted modification(s)`);
  }
  // Restored agents and skills: what the restore holds plus (bare extract) the tracked ones recoverable from the commit.
  const { agents, skills } = feCounts([...new Set([...present.map((p) => p.rel), ...(opts.checkout ? [] : trackedPaths)])]);
  add('agents_and_skills', agents === REQUIRED.agents && skills === REQUIRED.skills, `${agents} forward agent definitions, ${skills} forward skills (expected ${REQUIRED.agents} and ${REQUIRED.skills})${!opts.checkout && trackedPaths.size ? '; tracked ones counted from the recorded commit' : ''}`);
  const leaks = present.filter((p) => !p.link && hasSecret(fs.readFileSync(path.join(root, p.rel)).toString('latin1'))).map((p) => p.rel);
  add('no_secrets', !leaks.length, leaks.length ? `secret patterns found in ${leaks.join(', ')}` : 'no private keys, API keys or passwords in the restored files');
  // The archive must not carry an excluded path (a checkout also holds tracked reports, which git restores, not the archive).
  const fromArchive = listEntries(archive).map((e) => e.name.replace(/\\/g, '/').replace(/\/$/, ''));
  const excludedRestored = fromArchive.filter((n) => EXCLUDE.some(([re]) => re.test(n)));
  add('no_excluded_paths', !excludedRestored.length, excludedRestored.length ? `excluded paths in the archive: ${excludedRestored.slice(0, 5).join(', ')}` : 'no excluded path was restored from the archive');
  // Separately held local assets (never part of the archive), attached only on request and removed afterwards.
  let cobolRoot = '';
  if (opts.localAssets) {
    if (!opts.checkout) throw new Error('--with-local-assets requires --checkout');
    report.assets = [];
    for (const rel of ['forward/runs', 'forward/integrations/bmad/executor']) {
      if (!fs.existsSync(path.join(repo, rel))) continue;
      fs.cpSync(path.join(repo, rel), path.join(root, rel), { recursive: true });
      report.assets.push({ path: rel, origin: 'current local repository (separately held; not in the archive)' });
    }
    cobolRoot = process.env.REVFORGE_COBOL_SOURCE_ROOT || '';
    if (cobolRoot) report.assets.push({ path: 'REVFORGE_COBOL_SOURCE_ROOT', origin: 'read in place from the configured source root (not copied)' });
  }
  if (opts.build || opts.test) {
    // Dependencies come from the current local install (no network); the restored sources are built on their own.
    const nm = path.join(forward, 'node_modules');
    const tnm = path.join(root, 'forward', 'node_modules');
    if (fs.existsSync(nm)) fs.cpSync(nm, tnm, { recursive: true });
    const b = spawnSync(process.execPath, [path.join(tnm, 'typescript', 'bin', 'tsc'), '-p', path.join(root, 'forward', 'tsconfig.json')], { encoding: 'utf8', cwd: path.join(root, 'forward'), maxBuffer: 64 * 1024 * 1024 });
    report.build = { exit_code: b.status, errors: (b.stdout + b.stderr).split('\n').filter((l) => /error TS/.test(l)).slice(0, 10) };
    add('restored_build', b.status === 0, b.status === 0 ? 'TypeScript build of the restored sources succeeded' : `build failed: ${report.build.errors.join(' | ')}`);
    if (opts.test && b.status === 0) {
      const tests = fs.readdirSync(path.join(root, 'forward', 'dist', 'tests')).filter((f) => f.endsWith('.test.js')).map((f) => path.join(root, 'forward', 'dist', 'tests', f));
      const t = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...tests], { encoding: 'utf8', cwd: path.join(root, 'forward'), maxBuffer: 256 * 1024 * 1024, timeout: 30 * 60 * 1000, env: { ...process.env, REVFORGE_COBOL_SOURCE_ROOT: cobolRoot } });
      const num = (k) => Number((new RegExp(`ℹ ${k} (\\d+)`).exec(t.stdout) ?? [])[1] ?? NaN);
      report.tests = {
        exit_code: t.status,
        signal: t.signal ?? null,
        error: t.error ? `${t.error.code ?? ''} ${t.error.message}`.trim() : null,
        tests: num('tests'),
        pass: num('pass'),
        fail: num('fail'),
        skipped: num('skipped'),
        failing: [...new Set([...t.stdout.matchAll(/^\s*✖ (.+?) \(\d/gm)].map((m) => m[1]))].slice(0, 20),
        failure_details: t.stdout.includes('✖ failing tests:') ? t.stdout.slice(t.stdout.indexOf('✖ failing tests:')).split(/\r?\n/).slice(0, 60) : [],
        skipped_tests: [...new Set(t.stdout.split(/\r?\n/).filter((l) => /# SKIP/.test(l)).map((l) => l.trim().replace(/^﹣\s*/, '')))].slice(0, 20),
      };
      add('restored_tests', t.status === 0, `restored test run: ${report.tests.pass}/${report.tests.tests} passed, ${report.tests.fail} failed, ${report.tests.skipped} skipped`);
    }
  }
  if (opts.cleanup || opts.localAssets) {
    // Windows may briefly lock files under .git after git exits: retry, and report rather than throw.
    try {
      fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
      report.cleaned_up = true;
    } catch (e) {
      report.cleaned_up = false;
      report.cleanup_error = `${e.code ?? ''} ${e.message}`.trim();
      add('cleanup', false, `temporary directory ${tmp} could not be removed: ${report.cleanup_error}${opts.localAssets ? ' (it holds a copy of sensitive workflow records: remove it manually)' : ''}`);
    }
  }
  report.ok = report.checks.every((c) => c.ok);
  return report;
}

function main() {
const [cmd, ...rest] = process.argv.slice(2);
const flag = (k) => (rest.indexOf(k) >= 0 ? rest[rest.indexOf(k) + 1] : undefined);
try {
  if (cmd === 'create') console.log(JSON.stringify(create(flag('--dest')), null, 2));
  else if (cmd === 'verify') console.log(JSON.stringify(verify(rest[0]), null, 2));
  else if (cmd === 'restore-test') {
    const r = restoreTest(rest[0], { build: rest.includes('--build'), test: rest.includes('--test'), checkout: rest.includes('--checkout'), localAssets: rest.includes('--with-local-assets'), cleanup: rest.includes('--cleanup') });
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  } else {
    console.error('usage: backup.js create [--dest DIR] | verify ARCHIVE | restore-test ARCHIVE [--checkout [--with-local-assets]] [--build] [--test] [--cleanup]');
    process.exit(2);
  }
} catch (e) {
  console.error(`backup: ${e.message}`);
  process.exit(1);
}
}

if (require.main === module) main();
module.exports = { discover, verify, create, restoreTest, hasSecret, EXCLUDE, SECRET, TAR };
