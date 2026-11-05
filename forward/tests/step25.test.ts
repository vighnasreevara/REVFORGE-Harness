/**
 * STEP 25: backup exclusion policy 2. The dashboard's reproducible output
 * (node_modules, dist, coverage, public/evidence) is left out of the code-only
 * backup; its source stays recoverable; archives made under policy 1 still verify.
 * Temporary directories only; the repository is read, never written.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { FORWARD_DIR } from './helpers/fixture';

const backup = require(path.join(FORWARD_DIR, 'tools', 'backup.js'));
const temps: string[] = [];
after(() => {
  for (const t of temps) fs.rmSync(t, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
});
const tmpdir = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'revforge-step25-'));
  temps.push(d);
  return d;
};
const excluded = (rel: string, policy = backup.EXCLUDE_POLICY) => backup.excludeRules(policy).some(([re]: [RegExp]) => re.test(rel));
const GENERATED = /^forward\/dashboard\/(node_modules|dist|coverage|public\/evidence)\//;

describe('STEP 25 — dashboard backup exclusion policy', () => {
  test('1/2. only the reproducible dashboard output is excluded; dashboard source never is', () => {
    for (const p of [
      'forward/dashboard/node_modules/react/index.js',
      'forward/dashboard/node_modules/.vite/deps/x.js',
      'forward/dashboard/dist/index.html',
      'forward/dashboard/dist/assets/index-abc.js',
      'forward/dashboard/coverage/lcov.info',
      'forward/dashboard/public/evidence/manifest.json',
      'forward/dashboard/public/evidence/forward/reports/step-23/master-gap-register.json',
    ])
      assert.ok(excluded(p), `${p} must be excluded`);
    for (const p of [
      'forward/dashboard/package.json',
      'forward/dashboard/package-lock.json',
      'forward/dashboard/README.md',
      'forward/dashboard/evidence-sources.json',
      'forward/dashboard/index.html',
      'forward/dashboard/vite.config.ts',
      'forward/dashboard/src/App.tsx',
      'forward/dashboard/src/evidence/model.ts',
      'forward/dashboard/src/pages/dist/Notes.tsx',
      'forward/dashboard/scripts/sync-evidence.mjs',
      'forward/dashboard/tests/evidence.test.ts',
      'forward/dashboard/public/favicon.svg',
      'forward/dashboard/node_modules.md',
    ])
      assert.ok(!excluded(p), `${p} is dashboard source and must not be excluded`);
  });

  test('1. every tracked dashboard source file is recoverable from the commit; no generated file is archived', () => {
    const d = backup.discover();
    // Recoverable = listed with its blob at the recorded commit, or archived (a tracked file with uncommitted
    // modifications is archived as 'modified', exactly as in the STEP 10 inventory test).
    const tracked = new Set([...d.tracked, ...d.included].map((f: any) => f.path));
    for (const p of ['forward/dashboard/package.json', 'forward/dashboard/package-lock.json', 'forward/dashboard/README.md', 'forward/dashboard/evidence-sources.json', 'forward/dashboard/src/App.tsx', 'forward/dashboard/scripts/sync-evidence.mjs'])
      assert.ok(tracked.has(p), `${p} is recoverable`);
    assert.ok(d.included.filter((f: any) => f.path.startsWith('forward/dashboard/')).every((f: any) => f.source === 'modified' || f.source === 'untracked'), 'only modified or new dashboard source is archived');
    const listed = spawnSync('git', ['-C', path.resolve(FORWARD_DIR, '..'), 'ls-files', 'forward/dashboard'], { encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean);
    assert.ok(listed.length > 0);
    assert.deepEqual(listed.filter((p) => !tracked.has(p)), [], 'all tracked dashboard files are in the recovery set');
    assert.deepEqual(d.included.filter((f: any) => GENERATED.test(f.path)).map((f: any) => f.path), [], 'no reproducible dashboard output is archived');
    // When the generated folders exist locally they are listed as exclusions with a reason (content not recorded).
    for (const dir of ['node_modules', 'dist', 'public/evidence']) {
      if (!fs.existsSync(path.join(FORWARD_DIR, 'dashboard', dir))) continue;
      const key = `forward/dashboard/${dir.split('/')[0]}`;
      assert.ok(d.excluded.some((e: any) => e.path.startsWith(key) && /reproducible/.test(e.reason)), `${dir} is reported as excluded`);
    }
  });

  test('6. secret scanning still covers the dashboard and the tracked tree', () => {
    const d = backup.discover();
    assert.deepEqual(d.tracked_secrets, []);
    assert.deepEqual(d.excluded.filter((e: any) => /secret/.test(e.reason) && /^forward\/dashboard\/(src|scripts|tests)\//.test(e.path)), [], 'no dashboard source is mistaken for a secret');
    assert.equal(backup.hasSecret('NEO4J_' + 'PASSWORD=hunter2isnotreal')?.[1], 'database password assignment');
    assert.equal(backup.hasSecret('key sk-ant-' + 'B'.repeat(30))?.[1], 'API key');
  });

  test('7. policy 1 rules are unchanged and still apply to archives without a recorded policy', () => {
    const p1 = backup.excludeRules(undefined).map(([re]: [RegExp]) => String(re));
    assert.deepEqual(p1, backup.excludeRules(1).map(([re]: [RegExp]) => String(re)));
    assert.equal(backup.excludeRules(2).length, backup.EXCLUDE.length);
    assert.ok(!p1.some((r: string) => r.includes('dashboard')), 'policy 1 has no dashboard rule');
    assert.ok(excluded('forward/node_modules/x.js', 1) && excluded('forward/runs/x.json', 1) && excluded('forward/reports/step-9/x.json', 1), 'policy 1 rules are kept');
    assert.equal(excluded('forward/dashboard/node_modules/x.js', 1), false);
  });

  test('3/4/5/7. a policy-1 archive holding dashboard dependencies verifies under its own rules, and is flagged under policy 2', () => {
    const d = tmpdir();
    const rel = 'forward/dashboard/node_modules/pkg/index.js';
    fs.mkdirSync(path.join(d, 'src', path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(d, 'src', rel), 'module.exports = 1;\n');
    const bytes = fs.readFileSync(path.join(d, 'src', rel));
    const archive = path.join(d, 'legacy.tgz');
    const t = spawnSync(backup.TAR, ['-czf', archive, '-C', path.join(d, 'src'), rel], { encoding: 'utf8' });
    assert.equal(t.status, 0, t.stderr);
    const head = spawnSync('git', ['-C', path.resolve(FORWARD_DIR, '..'), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    const inv: any = {
      contract: 'forward-backup-inventory',
      contract_version: '1.0',
      archive: 'legacy.tgz',
      archive_sha256: crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'),
      files: 1,
      versions: { git: { commit: head, branch: 'main' } },
      exclusions: [],
      entries: [{ path: rel, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), source: 'ignored' }],
    };
    fs.writeFileSync(path.join(d, 'inventory.json'), JSON.stringify(inv));
    const legacy = backup.restoreTest(archive, { build: false, test: false, cleanup: true });
    const check = (r: any, id: string) => r.checks.find((c: any) => c.id === id);
    assert.equal(check(legacy, 'archive_hash').ok, true);
    assert.equal(check(legacy, 'files_present').ok, true);
    assert.equal(check(legacy, 'hashes_match').ok, true);
    assert.equal(check(legacy, 'no_excluded_paths').ok, true, 'an archive created before policy 2 is checked against policy 1');
    inv.exclusion_policy = 2;
    fs.writeFileSync(path.join(d, 'inventory.json'), JSON.stringify(inv));
    const current = backup.restoreTest(archive, { build: false, test: false, cleanup: true });
    assert.equal(check(current, 'no_excluded_paths').ok, false, 'under policy 2 the same archive content is an excluded path');
  });

  test('3/4/5. a real backup records policy 2, carries no dashboard output, and restores with every check passing', () => {
    const b = backup.create(tmpdir());
    const inv = JSON.parse(fs.readFileSync(b.inventory, 'utf8'));
    assert.equal(inv.exclusion_policy, backup.EXCLUDE_POLICY);
    assert.deepEqual(inv.entries.filter((e: any) => GENERATED.test(e.path)).map((e: any) => e.path), []);
    assert.ok(inv.tracked_at_commit.entries.some((e: any) => e.path === 'forward/dashboard/package-lock.json' && /^[0-9a-f]{40}$/.test(e.blob)), 'dashboard lockfile recoverable with its blob');
    assert.equal(backup.verify(b.archive).ok, true);
    const r = backup.restoreTest(b.archive, { build: false, test: false, cleanup: true });
    for (const c of r.checks) assert.ok(c.ok, `${c.id}: ${c.detail}`);
    // Committed-file integrity still works: a tracked dashboard file recorded with a wrong blob is detected.
    const i = inv.tracked_at_commit.entries.findIndex((e: any) => e.path.startsWith('forward/dashboard/'));
    assert.ok(i >= 0);
    inv.tracked_at_commit.entries[i].blob = '0'.repeat(40);
    fs.writeFileSync(b.inventory, JSON.stringify(inv));
    const r2 = backup.restoreTest(b.archive, { build: false, test: false, cleanup: true });
    assert.equal(r2.checks.find((c: any) => c.id === 'tracked_at_commit').ok, false);
  });
});
