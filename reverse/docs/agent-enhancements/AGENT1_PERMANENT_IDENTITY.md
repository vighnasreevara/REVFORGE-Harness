# Agent 1 — Permanent identity and the Neo4j File Registry

**Agent:** `1_inventory_c` · **Skills:** `file-walker` (enhanced), `dependency-graph` (identifier pass-through only)
**Workflow (unchanged):** Inventory Agent → file-walker → dependency-graph → `inventory_artifact.json`

## 1. Scope

Exactly five enhancements, and nothing else:

| # | Enhancement | Where |
|---|---|---|
| 1 | System ID `SYS-{NAME}-{NNN}`, permanent, one per repository | file-walker Step 2 |
| 2 | Permanent File ID `{SYSTEM_ID}-FIL-{NNNN}` | file-walker Step 3 |
| 3 | Path ID `{SYSTEM_ID}-PATH-{NNNN}` for the registered location | file-walker Step 3 |
| 4 | Program ID kept exactly as extracted (extraction logic unchanged) | file-walker, PROGRAM-ID section |
| 5 | Permanent Neo4j File Registry: constraints and transactional allocation | file-walker "Permanent identity registration" |

**Unchanged:**
- File discovery, the extension table, the subtype rule and the PROGRAM-ID and JCL greps.
- `dependency-graph` logic.
- Agents 2–8.
- Agent and skill names, and the execution order.

**Not built:**
- No Python engine or scripts.
- No new agents or skills.
- No content hashing.

## 2. Files

| File | Status | Change |
|---|---|---|
| `.claude/agents/1_inventory_c.agent.md` | New (from reference) | Identity inputs, MCP tools, prerequisites, summary lines, identity constraints |
| `.claude/skills/file-walker/SKILL.md` | New (from reference) | Step 3a and the "Permanent identity registration (Neo4j)" section; identifier fields in outputs; `other_file_registry` for files outside the three lists; registry error rows |
| `.claude/skills/dependency-graph/SKILL.md` | New (from reference) | `meta.system_id` / `meta.system_name`, `other_file_registry`, "Identifier pass-through" paragraph |
| `.mcp.json` | New | Neo4j MCP server; every connection value comes from environment variables |
| `THIRD_PARTY_NOTICES.md` | New | Apache-2.0 attribution for the derived files |
| This document | New | — |

Apart from the added lines, only these original lines changed:
- file-walker: "Return all three lists" became "Return all lists"; two error-handling rows were extended.
- Agent: description, tools, and two sentences.
- dependency-graph: a comma after `total_files_scanned`.

## 3. How allocation works

```
Claude (file-walker)                     Neo4j (via MCP)
────────────────────                     ───────────────
discover files, extract PROGRAM-ID       (unchanged behaviour)
normalise relative paths
resolve-system ───────── read ─────────► System by repository identity
[first run] register-system ── write ──► lock → SystemSequence+1 → System
register-files (≤50/batch) ── write ───► lock System node
                                         for each new path:
                                           file_seq+1, path_seq+1
                                           CREATE SourceFile, FilePath
                                         existing path: no new number
   …wait for every write to return…
fetch-file-identities ─── read ────────► file_id, path_id per path
verify-registry-integrity ─ read ──────► consistent = true
copy IDs verbatim into registry entries
```

Why duplicates cannot happen:

1. **Sequences live in Neo4j.** `SystemSequence.last_number`, `System.file_seq` and `System.path_seq` only increase. Claude never computes a number.
2. **Each batch is one transaction.** The MCP write tool runs each call through `driver.execute_query`, which is a single managed transaction with automatic retry of transient errors.
3. **One lock per system.** The first statement writes a property on the System node, which takes an exclusive lock until commit. Concurrent registrations for that system queue on it, so each one reads the counter and the existing paths only after the previous one has committed.
4. **Uniqueness constraints are the safety net.** They exist on `file_id`, `path_id`, `system_path_key` (`system_id|relative_path`), `system_id` and `repository_identity`. A duplicate is rejected even if a query is wrong.
5. **Registration is idempotent.** An existing path is matched by `system_path_key` and never renumbered, so re-sending a batch is safe.

## 4. Registry structure

```
(:System {system_id, system_name, system_number, display_name,
          repository_identity, created_at, file_seq, path_seq})
   │
   ├─[:HAS_FILE]──►(:SourceFile {file_id, system_id, file_number, file_name,
   │                             program_id, file_type, registered_at})
   │                    │
   │                    └─[:LOCATED_AT]──►(:FilePath {path_id, system_id, path_number,
   │                                                  relative_path, file_name,
   │                                                  system_path_key, associated_file_id,
   │                                                  registered_at})
(:SystemSequence {system_name, last_number})     // per-name System ID sequence
(:RegistryLock {name: 'SYSTEM_REGISTRY'})        // serialises system registration
```

Constraints (all prefixed `revforge_registry_`): `system_id`, `system_repository`, `system_sequence`, `lock`, `file_id`, `path_id`, `path_key`.

## 5. Example output

These are from the verification run against the reference harness's sample, registered as `SYS-PORTFOLIO-001`. `subtype` comes from the unchanged prefix rule.

```json
{
  "id": "INQONLN",
  "program_id": "INQONLN",
  "system_id": "SYS-PORTFOLIO-001",
  "file_id": "SYS-PORTFOLIO-001-FIL-0064",
  "path_id": "SYS-PORTFOLIO-001-PATH-0064",
  "file_name": "INQONLN.cbl",
  "path": "src/programs/online/INQONLN.cbl",
  "relative_path": "src/programs/online/INQONLN.cbl",
  "type": "program",
  "subtype": "unknown",
  "size_bytes": 5890
}
```

```json
{
  "id": "PORTFLIO",
  "system_id": "SYS-PORTFOLIO-001",
  "file_id": "SYS-PORTFOLIO-001-FIL-0009",
  "path_id": "SYS-PORTFOLIO-001-PATH-0009",
  "file_name": "PORTFLIO.cpy",
  "path": "src/copybook/common/PORTFLIO.cpy",
  "relative_path": "src/copybook/common/PORTFLIO.cpy",
  "type": "copybook",
  "used_by": []
}
```

## 6. Verification (2026-10-20)

**Environment:**
- Neo4j 5.26.0 Community (local, temporary) and `mcp-neo4j-cypher` 0.6.0.
- Queries were extracted **verbatim from `file-walker/SKILL.md`** and run with `cypher-shell`.
- The real MCP server was also driven over stdio.

| # | Check | Result |
|---|---|---|
| 1 | System ID: register, re-register, second repo with the same name, invalid name | `SYS-BANKING-001`; re-run created nothing; second repo got `SYS-BANKING-002`; invalid name created nothing ✓ |
| 2 | Repeated scans: PAYMENT/CUSTOMER/BALANCE, then + ACCOUNT, then an unchanged re-run (order shuffled) | FIL-0001..0003 kept; ACCOUNT = FIL-0004; re-run created 0 nodes; results identical ✓ |
| 3 | Path IDs on repeated scans | PATH-0001..0004 unchanged ✓ |
| 4 | Program IDs | Stored as extracted (`PAYMENT01`, `CUSTMNT`, …); never replaced by File IDs ✓ |
| 5 | Same filename in different folders (`COMMON.cpy` ×2) | FIL-0005 and FIL-0006 ✓ |
| 6 | Invalid paths (`../`, `\`, leading `/`, `./`, `a/../b`) and a duplicate within one batch | 5 rejected; duplicate registered once ✓ |
| 7a | Concurrency: 20 parallel transactions × 5 different files | 100 files, all transactions succeeded ✓ |
| 7b | Concurrency: 20 parallel transactions, same file | 1 registration, 19 reused it ✓ |
| 7c | Concurrency: 20 parallel transactions, the same 30 files shuffled | 30 registrations ✓ |
| 7d | After 7a–c | 131 files, 131 unique File IDs and Path IDs, numbers 1–131 with no gaps; lock waits of 11–509 ms show the transactions queued on the lock ✓ |
| 8 | Direct inserts of a duplicate `file_id`, path key or `system_id` | All rejected by constraints ✓ |
| 9 | Rollover | FIL-9999 → FIL-10000 → FIL-10001 ✓ |
| 10 | Real sample (83 files) × 3 scans; scan 2 ran both batches in parallel, reversed | Scan 1: 83 registered; scans 2 and 3: 0 created; ID lists byte-identical; integrity `consistent` ✓ |
| 11 | Real MCP server over stdio | Tools `read/write_neo4j_cypher`; `verify-registry` OK; `register-files` OK; write tool rejects schema; read tool rejects writes ✓ |
| 12 | Reference repository | `git status` clean, HEAD `f0c47e0…` ✓ |

## 7. Limitations and open items

1. **Not yet run end to end through Claude Code with MCP.** MCP servers load at session start, so this session used `cypher-shell` plus a direct stdio run of the MCP server, with identical query text. The first real agent run after restarting Claude Code is the remaining acceptance step. The full `inventory_artifact.json` for the sample was not regenerated, because dependency-graph was not re-run.
2. **Registry initialisation needs an administrator.** The MCP write tool rejects schema commands, so the 7 constraints are created once with `cypher-shell` or Neo4j Browser. The agent checks for them and stops if they are missing.
3. **Security note.** `mcp-neo4j-cypher` 0.6.0's *read* tool executed a `CREATE CONSTRAINT` (it blocks only queries typed `w`). The skill never relies on this. Restricting it requires a separate read-only database user, and role-based access is a Neo4j Enterprise feature.
4. **MCP runs requests concurrently.** A read issued alongside a write ran before the write committed. The skill's ordering rule prevents this; it is an instruction, not something the database enforces.
5. **Copying IDs into JSON depends on the model.** Neo4j guarantees uniqueness, but placing the fetched IDs into the JSON relies on Claude following the skill. The fetch-per-path step and the integrity query reduce that risk. With no Python allowed, nothing deterministic re-checks the JSON against Neo4j.
6. **Identity is path-based, as specified.** A renamed or moved file gets a new File ID and Path ID. A deleted file keeps its ID in the registry (never reused) but is not marked inactive. Rename and delete handling are outside this scope.
7. **Path keys are case-sensitive.** The same file reached with different letter casing would be registered as a new location.
8. **Repository identity.** If the git remote URL changes, the agent stops rather than guessing. Updating `System.repository_identity` is an administrator action.
9. **PROGRAM-ID extraction is unchanged, so known misses remain.** `ERRHNDL.cbl` declares `PROGRAM-ID.` in column 1, which the original grep does not match, so it uses the filename fallback (same value here).
10. **Local registry location.** The registry database lives at `%USERPROFILE%\.revforge\neo4j` (data in `neo4j\data`), with Java at `%USERPROFILE%\.revforge\jdk-21`. Moved there from the temporary install on 2026-10-20 with a byte-identical registry snapshot. Start it with `%USERPROFILE%\.revforge\start-neo4j.cmd`, or install it as a Windows service (requires administrator).

## 8. Setup

1. Run Neo4j 5.x and set `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` and optionally `NEO4J_DATABASE` as environment variables (never in files).
2. Install the MCP server: `pip install mcp-neo4j-cypher`. If it is not on `PATH`, set `REVFORGE_NEO4J_MCP_COMMAND` to the executable's full path.
3. Run the `init-registry` block from `file-walker/SKILL.md` once.
4. Restart Claude Code in the project and approve the `neo4j` server from `.mcp.json`.
5. Run `1_inventory_c` with `REPO_ROOT` and, on the first run, `SYSTEM_NAME`.
