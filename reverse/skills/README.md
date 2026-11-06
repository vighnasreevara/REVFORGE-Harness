# Reverse-engineering skills (14, two per agent)

This folder holds the canonical definitions of the fourteen reverse-engineering skills. Edit them here. Each agent in [`../agents/`](../agents/) runs two of them, in pipeline order; [`../README.md`](../README.md) has the table.

Claude Code discovers skills only under `.claude/skills/`, a generated and git-ignored folder: `npm run setup` (`sync-agents`) installs a byte-identical copy of each skill there. The agent definitions load their skills from `.claude/skills/<name>/SKILL.md`. Edit only the copies in this folder, then run `node dist/runtime/src/cli.js sync-agents` from `forward/`. Forward agents may not write to this folder.

These definitions are derived from an Apache-2.0-licensed project; see [`../../THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md).
