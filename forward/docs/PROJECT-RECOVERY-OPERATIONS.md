# Project recovery operations

This guide is for the operator who protects and restores the uncommitted forward implementation.

There are two tools:
- `forward/tools/backup.js` creates a **restorable** code-only backup.
- `forward/tools/recovery-manifest.js` records hashes only, for change detection.

Neither tool uploads anything or commits anything.

## Create a backup

```sh
node forward/tools/backup.js create --dest <DIR outside the repository>
```

The default destination is `~/revforge-backups`; a destination inside the repository is refused. The tool writes `revforge-forward-<UTC timestamp>/` containing:

| File | Contents |
|---|---|
| `revforge-forward-<stamp>.tgz` | the archive (relative paths) |
| `inventory.json` | every file's path, size and sha256; the tree digest; versions (Node, git commit and branch, package dependencies, lockfile hash, BMad pin); the exclusion list with reasons (no excluded content) |
| `SHA256SUMS` | hashes of the archive and the inventory |
| `RESTORE.md` | step-by-step restore instructions |

**Discovery is explicit.** `git ls-files --others` (untracked), `--ignored` (ignored) and `git diff` (modified) list the candidates, and every candidate is classified.

**Included:**
- `forward/`: runtime, verification, contracts, config and examples, tests, tools, docs, top-level reports, package files;
- BMad integration metadata, pins, the isolation launcher and the pinned staged release;
- `forward/agents/` and `forward/skills/` (the forward agents and skills; the copies in `.claude/agents/fe-*` and `.claude/skills/fe-*` are also included and can be recreated with `sync-agents`).

**Excluded:**
- `forward/dist`, `forward/node_modules`;
- `forward/runs` (workflow records, which are sensitive: back these up separately, with permission);
- report exports under `forward/reports/step-*` and `forward/reports/*.json` (they may quote original COBOL);
- the provisioned BMad executor (reproducible);
- synthetic pilot output under `forward/pilot/*/out/` (reproducible with `pilot run`);
- the transient test workspace `forward/tests/.tmp/`, which exists only while tests run;
- `references/` (original COBOL);
- `.env`, `.mcp.json` and local settings;
- any file whose content looks like a private key, API key or password.

**One allowlisted value.** The only allowed secret-shaped value is the documented synthetic test key prefix `sk-test-REVFORGE-`.

## Verify and restore

```sh
node forward/tools/backup.js verify <archive>                 # relative paths only; no traversal, no links
node forward/tools/backup.js restore-test <archive> [--checkout [--with-local-assets]] [--build] [--test] [--cleanup]
```

**Disposable git checkout (`--checkout`).** This mode restores into a fresh clone of the local repository at the commit recorded in the inventory. The original repository is only read. The archive is extracted into the clone, and two extra checks run:
- `git_baseline`: HEAD equals the recorded commit;
- `tracked_files_intact`: the archive changed no tracked file.

The backup tests that call `git` work in this mode.

**Separately held assets (`--with-local-assets`, requires `--checkout`).** For the test run only, this option:
- copies the current workflow runs and the provisioned BMad executor into the disposable checkout;
- points the tests at the configured `REVFORGE_COBOL_SOURCE_ROOT`, read in place.

These assets are never part of the archive. The temporary directory is always deleted afterwards, because it then holds sensitive workflow records.

`restore-test` extracts into a new temporary directory (never the repository) and checks:
- the archive hash;
- that entries are safe;
- that every file is present at its relative path with a matching sha256;
- that nothing unexpected is present;
- that the 7 forward agent definitions and 14 forward skills are present;
- that no secret patterns are present;
- that no excluded path was restored.

**Optional build and tests:**
- `--build` builds the restored sources, using the current local `node_modules` (no network).
- `--test` also runs the test suite in the restored tree. Tests that need the real reverse outputs, workflow runs or the provisioned BMad executor (all excluded from a code-only backup) are reported as they fail or skip; the report says so. The backup tests also call `git ls-files`, so they fail in a bare extract that is not a git checkout.

**Tests must not look like secrets.** A test that exercises the secret detector must assemble its synthetic secrets at runtime (for example `'NEO4J_' + 'PASSWORD=…'`). Otherwise the test file itself is excluded from the backup. A Step 10 test fails if any implementation source is excluded this way.

## Full restore

1. Check out the recorded commit.
2. Extract the archive into the checkout root.
3. Install dependencies: `cd forward && npm ci`.
4. Build and test: `npm test`.
5. Re-provision what the backup excludes:
   - workflow runs, from their own authorized backup;
   - the BMad executor (see `BMAD-INTEGRATION-OPERATIONS.md`);
   - the COBOL source and reverse outputs, from their own location.
