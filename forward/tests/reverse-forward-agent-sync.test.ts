/**
 * Canonical agent and skill locations and their .claude/ discovery copies.
 *
 * reverse/agents and reverse/skills hold the seven reverse agents and their
 * fourteen skills; forward/agents and forward/skills hold the seven forward
 * agents and their fourteen skills. Claude Code discovers them only under
 * .claude/, which `sync-agents` keeps byte-identical. These tests check the
 * registries against the files, the repository's own sync state, drift
 * detection and repair in an isolated copy, and that no forward agent may
 * write a reverse definition.
 */
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { after, describe, test } from 'node:test';
import { AGENTS } from '../runtime/src/orchestrator/agents';
import { mirrorStatus, syncMirror } from '../runtime/src/orchestrator/mirror';
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
  test('in this repository all 42 forward and reverse definitions match their .claude/ copies', () => {
    const st = mirrorStatus({ repoRoot: REPO, forwardDir: FORWARD_DIR } as any, 'all');
    assert.equal(st.entries.length, 42);
    assert.equal(st.entries.filter((e) => e.side === 'reverse').length, 21);
    assert.equal(st.in_sync, true, JSON.stringify(st.entries.filter((e) => e.status !== 'IN_SYNC').map((e) => [e.side, e.name, e.status])));
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
