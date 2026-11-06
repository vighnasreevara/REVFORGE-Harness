# Reverse-engineering agents (1–7)

This folder holds the canonical definitions of the seven reverse-engineering agents, `1_inventory_c` to `7_synthesis_c`. Edit them here. The pipeline and its outputs are described in [`../README.md`](../README.md).

Claude Code discovers agents only under `.claude/agents/`. That folder is generated and git-ignored: `npm run setup` in `forward/` installs a byte-identical copy there. After editing a file here, run from `forward/`:

```
node dist/runtime/src/cli.js sync-agents          # install reverse/ and forward/ definitions into .claude/
node dist/runtime/src/cli.js sync-agents --check  # report drift (doctor and CI report it too)
```

Never edit the copies in `.claude/agents/`, because `sync-agents` overwrites them. Forward agents may not write to this folder.

These definitions are derived from an Apache-2.0-licensed project; see [`../../THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md).
