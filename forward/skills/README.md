# Forward-engineering skills (14, two per agent)

This folder is where you edit the forward-engineering skills. The REVFORGE orchestrator validates them here (`orchestrator.skills_dir` in `forward/config/forward.config.json`). The reverse-engineering skills are edited in [`reverse/skills/`](../../reverse/skills/).

Claude Code only discovers skills under `.claude/skills/`, a generated and git-ignored folder: `npm run setup` (`sync-agents`) installs a byte-identical copy of each `fe-*` skill there. Edit only the copies in this folder, then run `node dist/runtime/src/cli.js sync-agents`. Forward agents may not write to this folder.
