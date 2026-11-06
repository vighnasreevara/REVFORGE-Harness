# Forward-engineering agents (F1–F7)

This folder is where you edit the seven forward-engineering agent definitions. The REVFORGE orchestrator reads them from here (`orchestrator.agents_dir` in `forward/config/forward.config.json`). The reverse-engineering agents 1–7 are edited in [`reverse/agents/`](../../reverse/agents/).

Claude Code only discovers agents under `.claude/agents/`. That folder is generated and git-ignored: `npm run setup` installs a byte-identical copy of every definition there. After editing a file here, run:

```
node dist/runtime/src/cli.js sync-agents          # install forward/ and reverse/ definitions into .claude/
node dist/runtime/src/cli.js sync-agents --check  # report drift (doctor reports it too)
```

Never edit the copies in `.claude/agents/`; `sync-agents` overwrites them. Forward agents may not write to this folder.
