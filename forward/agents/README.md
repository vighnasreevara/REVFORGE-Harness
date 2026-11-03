# Forward-engineering agents (F1–F7)

This folder is where you edit the seven forward-engineering agent definitions. The REVFORGE orchestrator reads them from here (`orchestrator.agents_dir` in `forward/config/forward.config.json`). The reverse-engineering agents 1–7 stay in `.claude/agents/`.

Claude Code only discovers agents under `.claude/agents/`, so a byte-identical copy is kept there. After editing a file here, run:

```
node dist/runtime/src/cli.js sync-agents          # copy forward/agents and forward/skills to .claude/
node dist/runtime/src/cli.js sync-agents --check  # report drift (doctor reports it too)
```

Never edit the copies in `.claude/agents/fe-*`; `sync-agents` overwrites them. Forward agents may not write to this folder.
