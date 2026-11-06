/**
 * Canonical agent and skill locations and their .claude/ discovery copies.
 *
 * reverse/agents and reverse/skills hold the seven reverse agents and their
 * fourteen skills; forward/agents and forward/skills hold the seven forward
 * agents and their fourteen skills. Claude Code discovers them only under
 * .claude/, where `npm run setup` (sync-agents) installs byte-identical,
 * git-ignored copies. These tests check the registries against the files,
 * that the copies are generated rather than committed, the repository's own
 * installed state, drift detection and repair in an isolated copy, that the
 * reverse-harness checks still see local changes in the ignored copies, and
 * that no forward agent may write a reverse definition.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { AGENTS } from '../runtime/src/orchestrator/agents';
import { PROTECTED_PREFIXES } from '../runtime/src/commands/plan';
import { gitInfo } from '../runtime/src/core/git';
import { discoveryChanges, mirrorStatus, syncMirror, unexpectedDiscoveryEntries } from '../runtime/src/orchestrator/mirror';
import { canWrite } from '../runtime/src/orchestrator/permissions';
import { REVERSE_AGENTS, REVERSE_SKILLS } from '../runtime/src/orchestrator/reverse';
import { SKILLS } from '../runtime/src/orchestrator/skills';
import { FORWARD_DIR } from './helpers/fixture';

const REPO = path.resolve(FORWARD_DIR, '..');
const REVERSE_DIR = path.join(REPO, 'reverse');
const temps: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rf-agent-sync-'));
  temps.push(d);
  return d;
};
after(() => temps.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

/** An isolated repository root holding copies of both canonical trees and an empty .claude/. */
function isolatedRoot(): { root: string; ctx: any } {
  const root = tmp();
  const fwd = path.join(root, 'forward');
  for (const d of ['agents', 'skills']) {
    fs.cpSync(path.join(FORWARD_DIR, d), path.join(fwd, d), { recursive: true });
    fs.cpSync(path.join(REVERSE_DIR, d), path.join(root, 'reverse', d), { recursive: true });
  }
  return { root, ctx: { repoRoot: root, forwardDir: fwd } };
}

describe('reverse and forward agent registries', () => {
  test('seven reverse agents in pipeline order, each with two distinct skills: fourteen in total', () => {
    assert.deepEqual(REVERSE_AGENTS.map((a) => a.order), [1, 2, 3, 4, 5, 6, 7]);
    assert.equal(REVERSE_SKILLS.length, 14);
    assert.equal(new Set(REVERSE_SKILLS.map((s) => s.name)).size, 14);
    assert.equal(AGENTS.length, 7);
    assert.equal(SKILLS.length, 14);
    const forwardNames = new Set([...AGENTS.map((a) => a.name), ...SKILLS.map((s) => s.name)]);
    for (const n of [...REVERSE_AGENTS.map((a) => a.name), ...REVERSE_SKILLS.map((s) => s.name)]) assert.ok(!forwardNames.has(n), `${n} is registered on both sides`);
  });

  test('every reverse agent and skill has its canonical file, and the canonical directories hold nothing else', () => {
    for (const a of REVERSE_AGENTS) {
      const f = path.join(REVERSE_DIR, 'agents', `${a.name}.agent.md`);
      assert.ok(fs.existsSync(f), f);
      assert.match(fs.readFileSync(f, 'utf8'), new RegExp(`^---\\r?\\nname: ${a.name}\\r?\\n`), `${a.name}: frontmatter name`);
    }
    for (const s of REVERSE_SKILLS) {
      const f = path.join(REVERSE_DIR, 'skills', s.name, 'SKILL.md');
      assert.ok(fs.existsSync(f), f);
      assert.match(fs.readFileSync(f, 'utf8'), new RegExp(`^---\\r?\\nname: ${s.name}\\r?\\n`), `${s.name}: frontmatter name`);
    }
    const agentFiles = fs.readdirSync(path.join(REVERSE_DIR, 'agents')).filter((f) => f !== 'README.md').sort();
    assert.deepEqual(agentFiles, REVERSE_AGENTS.map((a) => `${a.name}.agent.md`).sort());
    const skillDirs = fs.readdirSync(path.join(REVERSE_DIR, 'skills')).filter((f) => f !== 'README.md').sort();
    assert.deepEqual(skillDirs, REVERSE_SKILLS.map((s) => s.name).sort());
  });

  test('each reverse agent references exactly its own two skills, and every reference resolves under .claude/skills', () => {
    const all = new Set(REVERSE_SKILLS.map((s) => s.name));
    for (const a of REVERSE_AGENTS) {
      const text = fs.readFileSync(path.join(REVERSE_DIR, 'agents', `${a.name}.agent.md`), 'utf8');
      const refs = [...new Set([...text.matchAll(/\.claude\/skills\/([a-z0-9-]+)/g)].map((m) => m[1]))].filter((n) => all.has(n)).sort();
      assert.deepEqual(refs, [...a.skills].sort(), a.name);
      for (const s of a.skills) assert.ok(fs.existsSync(path.join(REPO, '.claude', 'skills', s, 'SKILL.md')), `${a.name} -> .claude/skills/${s}`);
    }
  });
});

describe('sync-agents: .claude/ discovery copies', () => {
  test('the .claude/ copies are generated: git-ignored and untracked, while all 42 canonical definitions are tracked', (t) => {
    const ls = (...p: string[]) => spawnSync('git', ['-C', REPO, 'ls-files', '--', ...p], { encoding: 'utf8' });
    const probe = ls('.claude');
    if (probe.status !== 0) return t.skip('not a git checkout');
    assert.deepEqual(probe.stdout.split('\n').filter((l) => /^\.claude\/(agents|skills)\//.test(l)), [], 'no discovery copy is committed');
    const tracked = ls('reverse/agents', 'reverse/skills', 'forward/agents', 'forward/skills').stdout.split('\n');
    assert.equal(tracked.filter((l) => /^(reverse|forward)\/agents\/[^/]+\.agent\.md$/.test(l)).length, 14);
    assert.equal(tracked.filter((l) => /^(reverse|forward)\/skills\/[^/]+\/SKILL\.md$/.test(l)).length, 28);
    const ignored = (p: string) => spawnSync('git', ['-C', REPO, 'check-ignore', '-q', '--no-index', p]).status === 0;
    assert.ok(ignored('.claude/agents/1_inventory_c.agent.md') && ignored('.claude/skills/fe-sprint-readiness/SKILL.md'));
    for (const other of ['.claude/settings.json', '.claude/commands/example.md']) assert.equal(ignored(other), false, `${other} must stay trackable`);
  });

  test('after setup, all 42 forward and reverse definitions are installed in .claude/ and match', () => {
    const ctx = { repoRoot: REPO, forwardDir: FORWARD_DIR } as any;
    const st = mirrorStatus(ctx, 'all');
    assert.equal(st.entries.length, 42);
    assert.equal(st.entries.filter((e) => e.side === 'reverse').length, 21);
    assert.equal(st.in_sync, true, `run "npm run setup" to install the .claude/ discovery copies: ${JSON.stringify(st.entries.filter((e) => e.status !== 'IN_SYNC').map((e) => [e.side, e.name, e.status]))}`);
    assert.deepEqual(unexpectedDiscoveryEntries(ctx), []);
  });

  test('drift on either side is detected and repaired only by a sync of that side', () => {
    const { root, ctx } = isolatedRoot();
    assert.equal(mirrorStatus(ctx, 'all').entries.filter((e) => e.status === 'MISSING').length, 42);
    syncMirror(ctx, 'all');
    assert.equal(mirrorStatus(ctx, 'all').in_sync, true);

    fs.writeFileSync(path.join(root, '.claude', 'agents', 'unregistered.agent.md'), 'not ours');
    fs.appendFileSync(path.join(root, '.claude', 'agents', '3_data_c.agent.md'), 'edited in the wrong place');
    fs.writeFileSync(path.join(root, '.claude', 'skills', 'rule-tagger', 'stale.md'), 'stale');
    fs.appendFileSync(path.join(root, '.claude', 'skills', SKILLS[0].name, 'SKILL.md'), 'edited in the wrong place');
    const drift = (scope: 'forward' | 'reverse' | 'all') => mirrorStatus(ctx, scope).entries.filter((e) => e.status !== 'IN_SYNC').map((e) => `${e.side}:${e.name}:${e.status}`).sort();
    assert.deepEqual(drift('all'), ['forward:' + SKILLS[0].name + ':DIFFERENT', 'reverse:3_data_c:DIFFERENT', 'reverse:rule-tagger:DIFFERENT'].sort());

    // A forward-only sync repairs the forward copy and leaves the reverse drift visible.
    assert.equal(syncMirror(ctx, 'forward').written.length, 1);
    assert.deepEqual(drift('all'), ['reverse:3_data_c:DIFFERENT', 'reverse:rule-tagger:DIFFERENT']);
    // The reverse sync repairs from reverse/ and removes the stale file.
    assert.equal(syncMirror(ctx, 'reverse').written.length, 2);
    assert.equal(mirrorStatus(ctx, 'all').in_sync, true);
    assert.equal(fs.existsSync(path.join(root, '.claude', 'skills', 'rule-tagger', 'stale.md')), false);
    assert.equal(fs.readFileSync(path.join(root, '.claude', 'agents', '3_data_c.agent.md'), 'utf8'), fs.readFileSync(path.join(REVERSE_DIR, 'agents', '3_data_c.agent.md'), 'utf8'));
    // Unregistered files under .claude/ are never touched.
    assert.equal(fs.readFileSync(path.join(root, '.claude', 'agents', 'unregistered.agent.md'), 'utf8'), 'not ours');
  });

  test('a missing canonical definition is reported and the sync refuses before writing anything', () => {
    const { root, ctx } = isolatedRoot();
    fs.rmSync(path.join(root, 'reverse', 'skills', 'gap-detector'), { recursive: true });
    const st = mirrorStatus(ctx, 'reverse');
    assert.equal(st.in_sync, false);
    assert.deepEqual(st.entries.filter((e) => e.status === 'NO_SOURCE').map((e) => e.name), ['gap-detector']);
    assert.throws(() => syncMirror(ctx, 'all'), /reverse[\\/]skills[\\/]gap-detector is missing/);
    assert.equal(fs.existsSync(path.join(root, '.claude')), false, 'nothing was written');
  });
});

describe('local changes in the ignored discovery copies stay visible', () => {
  test('gitInfo reports edited, source-less and unregistered copies under the protected prefixes; a copy not yet installed is not a change', (t) => {
    const { root, ctx } = isolatedRoot();
    fs.copyFileSync(path.join(REPO, '.gitignore'), path.join(root, '.gitignore'));
    const git = (...a: string[]) => spawnSync('git', ['-C', root, '-c', 'user.name=revforge-test', '-c', 'user.email=revforge-test@example.invalid', ...a], { encoding: 'utf8' });
    if (git('init', '-q').status !== 0) return t.skip('git unavailable');
    git('add', '.gitignore', 'forward', 'reverse');
    if (git('commit', '-q', '-m', 'fixture').status !== 0) return t.skip('cannot commit in a temporary repository');
    syncMirror(ctx, 'all');
    assert.equal(git('status', '--porcelain').stdout, '', 'installed copies are ignored by Git');
    assert.deepEqual(gitInfo(root, PROTECTED_PREFIXES).reverse_paths_changed, []);

    fs.appendFileSync(path.join(root, '.claude', 'agents', '2_parser_c.agent.md'), 'edited');
    fs.appendFileSync(path.join(root, '.claude', 'skills', 'fe-sprint-readiness', 'SKILL.md'), 'edited');
    fs.mkdirSync(path.join(root, '.claude', 'skills', 'impostor'));
    fs.writeFileSync(path.join(root, '.claude', 'skills', 'impostor', 'SKILL.md'), '---\nname: impostor\n---\n');
    fs.writeFileSync(path.join(root, '.claude', 'agents', 'rogue.agent.md'), 'rogue');
    fs.rmSync(path.join(root, '.claude', 'agents', '7_synthesis_c.agent.md'));
    const expected = ['.claude/agents/2_parser_c.agent.md', '.claude/agents/rogue.agent.md', '.claude/skills/fe-sprint-readiness/', '.claude/skills/impostor/'];
    assert.equal(git('status', '--porcelain').stdout, '', 'Git itself cannot see these changes');
    assert.deepEqual(discoveryChanges(root), expected);
    assert.deepEqual(gitInfo(root, PROTECTED_PREFIXES).reverse_paths_changed!.slice().sort(), expected);
    assert.deepEqual(gitInfo(root, ['output/']).reverse_paths_changed, [], 'only callers protecting .claude/ see them');
    assert.deepEqual(unexpectedDiscoveryEntries(ctx), ['.claude/agents/rogue.agent.md', '.claude/skills/impostor/']);
    assert.ok(mirrorStatus(ctx, 'reverse').entries.some((e) => e.name === '7_synthesis_c' && e.status === 'MISSING'), 'a removed copy is reported by sync-agents --check as MISSING');

    // An edit to a canonical definition is a tracked change, as before.
    fs.appendFileSync(path.join(root, 'reverse', 'agents', '1_inventory_c.agent.md'), 'edited');
    assert.ok(gitInfo(root, PROTECTED_PREFIXES).reverse_paths_changed!.includes('reverse/agents/1_inventory_c.agent.md'));
  });
});

describe('reverse definitions are protected', () => {
  test('no forward agent may write a reverse agent, skill or design note', () => {
    const roots = { repoRoot: REPO, forwardDir: FORWARD_DIR, workflowDir: path.join(FORWARD_DIR, 'runs', 'x', 'workflow'), sourceRoot: null } as any;
    for (const a of AGENTS) {
      for (const f of [path.join(REVERSE_DIR, 'agents', '1_inventory_c.agent.md'), path.join(REVERSE_DIR, 'skills', 'file-walker', 'SKILL.md'), path.join(REVERSE_DIR, 'docs', 'note.md')]) {
        assert.equal(canWrite(a, f, roots).allowed, false, `${a.name} -> ${f}`);
      }
    }
  });
});
