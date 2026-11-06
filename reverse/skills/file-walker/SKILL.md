---
name: file-walker
description: >
  Recursively traverses a COBOL repository directory tree. Classifies every
  file by type based on its extension, extracts PROGRAM-ID from COBOL source
  files, and produces the raw file_registry, copybook_registry, and
  jcl_registry that the Inventory Agent assembles into the final artifact.
  REVFORGE: also registers every discovered file in the permanent Neo4j
  File Registry and attaches its System ID, permanent File ID and Path ID.
  Used exclusively by the Inventory Agent (1_inventory).
---

## Purpose

Walk the repository filesystem. For every file found, record its path,
classify its type, and extract key identifiers (PROGRAM-ID for programs,
JOB name for JCL). Produce structured registry lists.

REVFORGE enhancement: every discovered file is registered in the Neo4j File
Registry, which owns the permanent identifiers. The registry, not this skill,
allocates numbers. This skill only reads identifiers back and copies them into
the registry entries (see "Permanent identity registration (Neo4j)").

Do NOT follow cross-references or resolve COPY/CALL statements — that is
the dependency-graph skill's job.

---

## File type classification

| Extension | Type | Subtype logic |
|---|---|---|
| `.cbl`, `.cob` | `program` | Subtype: `batch` if filename starts with `CB`; `online` if starts with `CO` or `CA`; else `unknown` |
| `.cpy` | `copybook` | — |
| `.jcl` | `jcl` | — |
| `.bms` | `bms_map` | CICS screen map |
| `.ctl` | `control_card` | Sort/utility control |
| `.lst` | `listing` | Compiler listing — record path only, skip content scan |
| `.sql`, `.dclgen` | `db2` | DB2 DCLGEN or embedded SQL include |

If an extension does not match any row above, record it with type `unknown`
and log an `info` issue.

---

## COBOL fixed-format column rules

COBOL source files use fixed-column layout. Always apply these rules when
reading any `.cbl` or `.cob` file:

| Columns | Content | Action |
|---|---|---|
| 1–6 | Sequence numbers | Ignore |
| 7 | Indicator | If `*` or `/` → skip this line (comment). If `D` → include (debug line). |
| 8–72 | Program text | Read and scan this range only |
| 73–80 | Identification | Ignore |

In 0-indexed terms: `line[6]` is the indicator, `line[7:72]` is program text.

---

## PROGRAM-ID extraction

For every `.cbl` and `.cob` file, find the PROGRAM-ID using this approach:

```bash
# Grep for PROGRAM-ID, skipping comment lines (column 7 = *)
grep -iE "^.{6}[^*/].{0,1}\s*PROGRAM-ID\.\s+([A-Z0-9\-]+)" "$FILE" | head -1
```

Extraction rules:
- Match is case-insensitive
- Strip trailing period from the extracted name
- Strip surrounding whitespace
- If no PROGRAM-ID is found, fall back to the filename without extension
  (uppercased) and log a `warning` issue

REVFORGE: the extracted PROGRAM-ID is stored unchanged in `program_id` and in
the registry. It is never replaced by, or derived from, the File ID.

---

## JCL JOB name extraction

For every `.jcl` file, extract the JOB card name:

```bash
# First line starting with //JOBNAME JOB
grep -iE "^//([A-Z0-9#@\$]{1,8})\s+JOB\s" "$FILE" | head -1
```

Also extract all EXEC PGM steps:

```bash
# All EXEC PGM lines — captures stepname and program name
grep -iE "^//([A-Z0-9#@\$]{1,8})\s+EXEC\s+PGM=([A-Z0-9\-]+)" "$FILE"
```

---

## Execution steps

```
1. Use Glob to find all files under REPO_ROOT matching target extensions:
   pattern: **/*.{cbl,cob,cpy,jcl,bms,ctl,lst,sql,dclgen}
   Apply EXCLUDE_DIRS filter — skip any path containing an excluded segment.

2. For each file found:
   a. Record absolute path and relative path from REPO_ROOT
   b. Determine type and subtype from extension (see table above)
   c. If type == program:
        - Extract PROGRAM-ID using grep pattern above
        - Record size_bytes
   d. If type == jcl:
        - Extract JOB name
        - Extract all EXEC PGM step bindings
   e. If type == listing: record path only — do not read content

3. Build three separate lists:
   - file_registry      (programs)
   - copybook_registry  (copybooks and db2 includes)
   - jcl_registry       (jcl jobs with their steps)
   REVFORGE: files of any other type (bms_map, control_card, listing,
   unknown) go into a fourth list, other_file_registry, so that every
   discovered file carries its permanent identifiers.

3a. REVFORGE — register identities. For every file from step 2, run the
    procedure in "Permanent identity registration (Neo4j)" and copy the
    returned system_id, file_id and path_id into its registry entry. Also
    record file_name (the original filename, exactly as on disk).

4. Return all lists to the Inventory Agent.
```

---

## Permanent identity registration (Neo4j)

### Identifiers

| Identifier | Format | Example | Allocated by |
|---|---|---|---|
| System ID | `SYS-{SYSTEM_NAME}-{NNN}` | `SYS-BANKING-001` | Neo4j (per-name sequence) |
| File ID | `{SYSTEM_ID}-FIL-{NNNN}` | `SYS-BANKING-001-FIL-0001` | Neo4j (per-system file counter) |
| Path ID | `{SYSTEM_ID}-PATH-{NNNN}` | `SYS-BANKING-001-PATH-0001` | Neo4j (per-system path counter) |
| Program ID | Exactly as declared in `PROGRAM-ID.` | `PAYMENT01` | Extracted from source (unchanged behaviour) |

Numbers are zero-padded to 3 digits (system) or 4 digits (file, path) and
grow naturally beyond that (e.g. `FIL-10000`).

A registered file location is identified by
`system_id + normalized relative path`. Same path → same File ID and Path ID
on every run. A path never seen before → new File ID and Path ID. Numbers are
never reused, because the counters only ever increase.

### Absolute rules

1. **Never compute, guess, or increment a sequence number yourself.** Every
   System ID, File ID and Path ID in the output must be copied verbatim from a
   Neo4j query result in this run.
2. Use only the queries in this section, with values passed as **parameters**
   (never concatenated into the query text).
3. If Neo4j is unreachable, the registry constraints are missing, or any
   discovered file has no identifiers after registration, **stop**. Report the
   error and do not write an artifact with missing or invented identifiers.
4. Never rename, move or modify source files.

### Tools

| Tool | Used for |
|---|---|
| `mcp__neo4j__read_neo4j_cypher` | `verify-registry`, `resolve-system`, `fetch-file-identities`, `verify-registry-integrity` |
| `mcp__neo4j__write_neo4j_cypher` | `register-system`, `register-files` |

Each MCP write call runs as one Neo4j transaction. It returns only update
counters, not rows, so every write is followed by a read that fetches the
identifiers.

**Ordering rule:** send a read only after the writes it depends on have
**returned**. Never put a read in the same parallel tool-call group as the
write it depends on. The MCP server runs concurrent requests concurrently, so
a read sent alongside a write can execute before the write commits.

### Path normalisation

Apply to every discovered file before registration:

1. Make the path relative to `REPO_ROOT`.
2. Use `/` as the separator (convert `\`).
3. Remove any leading `./` or `/`; collapse repeated `/`.
4. Keep the original letter case of every directory and the filename.
5. The path must stay inside `REPO_ROOT`: no `.` or `..` segments.

Example: `D:\repo\src\Programs\PAYMENT.cbl` with `REPO_ROOT=D:\repo` →
`src/Programs/PAYMENT.cbl`. `file_name` is the last segment: `PAYMENT.cbl`.

The `register-files` query rejects (skips) any path that breaks rules 2, 3
or 5. A skipped file has no identifiers in `fetch-file-identities`, which
triggers absolute rule 3.

### Repository identity

Identifies the application so that the same System ID is reused on later runs.
Derive it with basic Bash commands:

```bash
git -C "$REPO_ROOT" remote get-url origin      # remote URL, if REPO_ROOT is in a git repo
git -C "$REPO_ROOT" rev-parse --show-prefix    # REPO_ROOT's path inside that repo ("" at top level)
```

- Git with a remote: `git:{remote}#{prefix}`. Lowercase the remote, strip
  credentials (`user:pass@`), a trailing `/` and a trailing `.git`. Strip the
  trailing `/` from the prefix.
  Example: `git:the upstream legacy-modernization-harness (see THIRD_PARTY_NOTICES.md)#`
- Otherwise: `path:{absolute REPO_ROOT}`, with `/` separators, no trailing
  `/`, lowercased on Windows.
  Example: `path:d:/projects/banking`

### Step 1 — verify the registry is initialised

```cypher
// REVFORGE-QUERY: verify-registry (read)
SHOW CONSTRAINTS YIELD name
WHERE name STARTS WITH 'revforge_registry_'
RETURN count(name) AS registry_constraints, collect(name) AS names
```

Continue only if `registry_constraints = 7`. Otherwise stop and tell the user
to run the one-time initialisation below. The MCP server cannot do it,
because its write tool rejects schema commands.

**One-time initialisation (administrator, via `cypher-shell` or Neo4j Browser):**

```cypher
// REVFORGE-QUERY: init-registry (admin, run once; idempotent)
CREATE CONSTRAINT revforge_registry_system_id IF NOT EXISTS
  FOR (s:System) REQUIRE s.system_id IS UNIQUE;
CREATE CONSTRAINT revforge_registry_system_repository IF NOT EXISTS
  FOR (s:System) REQUIRE s.repository_identity IS UNIQUE;
CREATE CONSTRAINT revforge_registry_system_sequence IF NOT EXISTS
  FOR (q:SystemSequence) REQUIRE q.system_name IS UNIQUE;
CREATE CONSTRAINT revforge_registry_lock IF NOT EXISTS
  FOR (l:RegistryLock) REQUIRE l.name IS UNIQUE;
CREATE CONSTRAINT revforge_registry_file_id IF NOT EXISTS
  FOR (f:SourceFile) REQUIRE f.file_id IS UNIQUE;
CREATE CONSTRAINT revforge_registry_path_id IF NOT EXISTS
  FOR (p:FilePath) REQUIRE p.path_id IS UNIQUE;
CREATE CONSTRAINT revforge_registry_path_key IF NOT EXISTS
  FOR (p:FilePath) REQUIRE p.system_path_key IS UNIQUE;
```

### Step 2 — resolve the System ID

```cypher
// REVFORGE-QUERY: resolve-system (read)
// params: repository_identity (string), system_id (string or null)
MATCH (s:System)
WHERE s.repository_identity = $repository_identity
   OR s.system_id = $system_id
RETURN s.system_id AS system_id, s.system_name AS system_name,
       s.display_name AS display_name,
       s.repository_identity AS repository_identity,
       toString(s.created_at) AS created_at
```

| Result | Action |
|---|---|
| One row, `repository_identity` matches | Reuse its `system_id`. Done — **never** register a second system for the same repository. |
| `SYSTEM_ID` was supplied and its row has a different `repository_identity` | Stop: the System ID belongs to another repository. |
| Two rows | Stop: `SYSTEM_ID` and the repository point to different systems. |
| No rows, `SYSTEM_ID` supplied | Stop: unknown System ID. System IDs come from the registry and cannot be chosen freely. |
| No rows, no `SYSTEM_ID` | Run `register-system` (needs `SYSTEM_NAME`). When it has returned, run `resolve-system` again and use the returned `system_id`. |

`SYSTEM_NAME` must match `[A-Z0-9]{2,20}` (e.g. `BANKING`). Otherwise the
query creates nothing.

```cypher
// REVFORGE-QUERY: register-system (write)
// params: system_name, display_name, repository_identity
// Safe to repeat: creates a System only when none exists for the repository.
MERGE (lock:RegistryLock {name: 'SYSTEM_REGISTRY'})
SET lock.locked_at = datetime()
WITH lock
WHERE $system_name =~ '[A-Z0-9]{2,20}' AND size(trim($repository_identity)) > 0
OPTIONAL MATCH (existing:System {repository_identity: $repository_identity})
WITH existing
FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
  MERGE (seq:SystemSequence {system_name: $system_name})
  SET seq.last_number = coalesce(seq.last_number, 0) + 1
  CREATE (:System {
    system_id: 'SYS-' + $system_name + '-' +
      CASE WHEN seq.last_number < 1000
           THEN right('00' + toString(seq.last_number), 3)
           ELSE toString(seq.last_number) END,
    system_name: $system_name,
    system_number: seq.last_number,
    display_name: $display_name,
    repository_identity: $repository_identity,
    created_at: datetime(),
    file_seq: 0,
    path_seq: 0
  })
)
```

### Step 3 — register files

Send the normalised files in batches of at most 50. Each batch is one write
call:

```cypher
// REVFORGE-QUERY: register-files (write)
// params: system_id, files: [{relative_path, file_name, program_id, file_type}]
// Idempotent: existing paths keep their identifiers; only new paths get numbers.
MATCH (s:System {system_id: $system_id})
SET s.registry_locked_at = datetime()  // exclusive lock: one registration per system at a time
WITH s
UNWIND $files AS f
WITH s, f
WHERE f.relative_path IS NOT NULL AND f.file_name IS NOT NULL
  AND NOT f.relative_path STARTS WITH '/'
  AND NOT f.relative_path CONTAINS '\\'
  AND NOT f.relative_path CONTAINS '//'
  AND NOT f.relative_path =~ '(.*/)?\\.{1,2}(/.*)?'
WITH s, f.relative_path AS relative_path, collect(f)[0] AS f  // de-duplicate within the batch
OPTIONAL MATCH (existing:FilePath {system_path_key: s.system_id + '|' + relative_path})
WITH s, relative_path, f, existing
FOREACH (_ IN CASE WHEN existing IS NULL THEN [1] ELSE [] END |
  SET s.file_seq = coalesce(s.file_seq, 0) + 1,
      s.path_seq = coalesce(s.path_seq, 0) + 1
  CREATE (sf:SourceFile {
    file_id: s.system_id + '-FIL-' +
      CASE WHEN s.file_seq < 10000 THEN right('000' + toString(s.file_seq), 4)
           ELSE toString(s.file_seq) END,
    system_id: s.system_id,
    file_number: s.file_seq,
    file_name: f.file_name,
    program_id: f.program_id,
    file_type: f.file_type,
    registered_at: datetime()
  })
  CREATE (fp:FilePath {
    path_id: s.system_id + '-PATH-' +
      CASE WHEN s.path_seq < 10000 THEN right('000' + toString(s.path_seq), 4)
           ELSE toString(s.path_seq) END,
    system_id: s.system_id,
    path_number: s.path_seq,
    relative_path: relative_path,
    file_name: f.file_name,
    system_path_key: s.system_id + '|' + relative_path,
    associated_file_id: sf.file_id,
    registered_at: datetime()
  })
  CREATE (s)-[:HAS_FILE]->(sf)
  CREATE (sf)-[:LOCATED_AT]->(fp)
)
WITH s, relative_path, f
MATCH (s)-[:HAS_FILE]->(sf:SourceFile)-[:LOCATED_AT]->(:FilePath {system_path_key: s.system_id + '|' + relative_path})
SET sf.program_id = f.program_id,
    sf.file_type = f.file_type
```

- New registrations in a batch = `nodes_created / 2` from the write result
  (one SourceFile plus one FilePath per new file). Use this for the summary;
  do not count by hand.
- Batches may be sent as parallel tool calls. The lock on the System node
  serialises them, and the uniqueness constraints reject any duplicate.
- If a batch fails with a constraint violation or transient error, resend
  the **same** batch once. Re-running is safe, because existing paths are
  never re-numbered. If it fails again, stop.

### Step 4 — fetch identifiers

After **every** `register-files` call has returned successfully (see the
ordering rule), read the identifiers back, at most 50 paths per call:

```cypher
// REVFORGE-QUERY: fetch-file-identities (read)
// params: system_id, relative_paths: [string]
MATCH (s:System {system_id: $system_id})-[:HAS_FILE]->(sf:SourceFile)
      -[:LOCATED_AT]->(fp:FilePath)
WHERE fp.relative_path IN $relative_paths
RETURN fp.relative_path AS relative_path, sf.file_id AS file_id,
       fp.path_id AS path_id, sf.file_name AS file_name,
       sf.program_id AS program_id
ORDER BY sf.file_number
```

Every requested path must come back exactly once. Copy `file_id` and
`path_id` into the matching registry entry. A missing path triggers absolute
rule 3.

### Step 5 — verify integrity

```cypher
// REVFORGE-QUERY: verify-registry-integrity (read)
// params: system_id
MATCH (s:System {system_id: $system_id})
OPTIONAL MATCH (s)-[:HAS_FILE]->(f:SourceFile)
WITH s, count(f) AS files, count(DISTINCT f.file_id) AS distinct_file_ids,
     count(DISTINCT f.file_number) AS distinct_file_numbers,
     max(f.file_number) AS max_file_number
OPTIONAL MATCH (s)-[:HAS_FILE]->(:SourceFile)-[:LOCATED_AT]->(p:FilePath)
WITH s, files, distinct_file_ids, distinct_file_numbers, max_file_number,
     count(p) AS paths, count(DISTINCT p.path_id) AS distinct_path_ids,
     count(DISTINCT p.relative_path) AS distinct_relative_paths
RETURN s.system_id AS system_id, files, distinct_file_ids, paths,
       distinct_path_ids, distinct_relative_paths,
       s.file_seq AS file_counter, s.path_seq AS path_counter,
       (files = distinct_file_ids AND files = distinct_file_numbers
        AND paths = files AND distinct_path_ids = paths
        AND distinct_relative_paths = paths
        AND coalesce(max_file_number, 0) <= s.file_seq) AS consistent
```

`consistent` must be `true`. Otherwise stop and report the row.

---

## Output structures

### file_registry entry

```json
{
  "id": "CBACT01C",
  "program_id": "CBACT01C",
  "system_id": "SYS-CARDDEMO-001",
  "file_id": "SYS-CARDDEMO-001-FIL-0001",
  "path_id": "SYS-CARDDEMO-001-PATH-0001",
  "file_name": "CBACT01C.CBL",
  "path": "app/cbl/CBACT01C.CBL",
  "relative_path": "app/cbl/CBACT01C.CBL",
  "type": "program",
  "subtype": "batch",
  "size_bytes": 14200
}
```

### copybook_registry entry

```json
{
  "id": "CVACT01Y",
  "system_id": "SYS-CARDDEMO-001",
  "file_id": "SYS-CARDDEMO-001-FIL-0002",
  "path_id": "SYS-CARDDEMO-001-PATH-0002",
  "file_name": "CVACT01Y.CPY",
  "path": "app/copy/CVACT01Y.CPY",
  "relative_path": "app/copy/CVACT01Y.CPY",
  "type": "copybook",
  "used_by": []
}
```

Note: `used_by` starts empty here — the dependency-graph skill populates it.

### jcl_registry entry

```json
{
  "id": "ACCTFILE",
  "system_id": "SYS-CARDDEMO-001",
  "file_id": "SYS-CARDDEMO-001-FIL-0003",
  "path_id": "SYS-CARDDEMO-001-PATH-0003",
  "file_name": "ACCTFILE.JCL",
  "path": "app/jcl/ACCTFILE.JCL",
  "relative_path": "app/jcl/ACCTFILE.JCL",
  "job_name": "ACCTFILE",
  "steps": [
    { "step_name": "SORT001", "program": "SORT",     "type": "utility" },
    { "step_name": "ACCTPROC","program": "CBACT01C", "type": "cobol"   }
  ]
}
```

Step `type` rules: if program name is `SORT`, `IDCAMS`, `IEBGENER`,
`IEFBR14`, `DFSRRC00` → `utility`; else → `cobol`.

### other_file_registry entry (REVFORGE)

Files of type `bms_map`, `control_card`, `listing` or `unknown`:

```json
{
  "id": "COSGN00",
  "system_id": "SYS-CARDDEMO-001",
  "file_id": "SYS-CARDDEMO-001-FIL-0004",
  "path_id": "SYS-CARDDEMO-001-PATH-0004",
  "file_name": "COSGN00.bms",
  "path": "app/bms/COSGN00.bms",
  "relative_path": "app/bms/COSGN00.bms",
  "type": "bms_map"
}
```

`id` = filename without extension, uppercased.

### Field rules (all registries)

- `id`, `program_id`, `path`, `relative_path`, `type`, `subtype`,
  `size_bytes`, `job_name`, `steps` and `used_by` keep their existing meaning.
- `path` and `relative_path` both hold the normalised repository-relative path.
- `file_name` is the original filename, unchanged.
- `system_id`, `file_id` and `path_id` are copied from Neo4j results only.

---

## Error handling

| Condition | Action |
|---|---|
| File cannot be read | Log `error` issue, continue to next file (still register its identity) |
| PROGRAM-ID not found in `.cbl` | Use filename as ID, log `warning` |
| Duplicate PROGRAM-ID across two files | Log `error` with both paths — do not deduplicate (each file keeps its own File ID) |
| JOB name not found in `.jcl` | Use filename as ID, log `warning` |
| File extension not in classification table | Record as `unknown` type, log `info` |
| Neo4j MCP tools unavailable or connection fails | Stop — report `error`, write no artifact |
| `verify-registry` returns fewer than 7 constraints | Stop — ask for the one-time initialisation |
| System ID cannot be resolved (see Step 2 table) | Stop — report `error` |
| `register-files` fails twice for the same batch | Stop — report `error` with the batch's paths |
| A discovered file has no identifiers after Step 4 | Stop — report `error` listing the paths |
| `verify-registry-integrity` returns `consistent = false` | Stop — report `error` with the returned row |
