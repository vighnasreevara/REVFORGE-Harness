# Agent 3 — Data Agent with permanent Record and Field IDs

**Agent:** `3_data_c` · **Skills:** `record-layout-parser` → `data-dictionary-builder` (names and order unchanged)
**Workflow:** Agent 1 inventory + Agent 2 `raw_structure` → record-layout-parser → data-dictionary-builder → `data_layouts/` + `data_artifact.json`

## 1. Design

**Who does what:**

- **Claude (LLM)** reads the copybooks, the FILE SECTION records and Agent 2's WORKING-STORAGE / LINKAGE entries. It extracts every record and field: PIC, USAGE, OCCURS, REDEFINES, VALUE, 88-levels and COPY stubs. It also computes each **elementary** item's byte size from a fixed table.
- **Neo4j** owns identity and every derived number:
  - it allocates Record and Field IDs from per-file counters inside one transaction;
  - it matches items to their predecessors by identity key;
  - it computes group, record and expanded-copybook sizes;
  - it derives cross-record relationships deterministically.
- Claude never picks or computes an ID or a group size. No Python or parser engine is involved.

### Identity keys (never line numbers)

| ID | Format | Identity key |
|---|---|---|
| Record | `{FILE_ID}-REC-NNNN` | defining File ID + section (`COPYBOOK`, `FILE`, `WORKING-STORAGE`, `LINKAGE`, `LOCAL-STORAGE`) + record name (`#n` for a repeated name, flagged `REVIEW_REQUIRED`) |
| Field | `{FILE_ID}-FLD-NNNNNN` | Record ID + path: the names from the record down, joined by `.`; `FILLER#k` / `NAME#k` for repeats under one parent |

**Rules:**
- A copybook record is registered **once**, under the copybook's File ID. Programs that copy it get `USES_COPYBOOK` and `EXPANDS_COPY` links to it; the copybook is never registered again per program.
- Items not seen in a completed run become `INACTIVE`. Numbers are never reused. An item that comes back (same key) is reactivated with its old ID.
- Renaming an item or moving it to another parent changes its key, so it gets a new ID and the old one becomes `INACTIVE`.
- the reference harness's name-based keys (`REC-…`, `FLD-…`) are kept in the catalogues as `record_key` / `field_key`. They are not identities.

### Sizes

- **Elementary bytes (LLM, fixed table):**
  - DISPLAY: length, plus 1 for SIGN SEPARATE.
  - COMP-3: floor(digits/2)+1.
  - BINARY/COMP: 2, 4 or 8 bytes, for 1–4, 5–9 or 10–18 digits.
  - COMP-1: 4; COMP-2: 8; INDEX and POINTER: 4.
- **Group and record totals (Neo4j `finalize-data-run`):**
  - add up the elementary bytes, times each OCCURS factor on the path;
  - leave out REDEFINES subtrees;
  - add the totals of expanded copybook records held inside the record (`total_bytes`); `inline_bytes` excludes them.

## 2. Files

| File | Change |
|---|---|
| `.claude/agents/3_data_c.agent.md` | From the reference. Additions:<br>• identity inputs from Agents 1/2<br>• `SOURCE_FILTER`, `SOURCE_KIND`, `MODE` (`full`/`layouts`/`dictionary`), `DATA_RUN_ID`, `DATA_TAKEOVER_RUN_ID`<br>• prerequisites and the per-source order<br>• collision-free output names, the overwrite guard<br>• the no-scripts rule, REVFORGE summary lines<br>• the tools Write, Edit and Neo4j MCP |
| `.claude/skills/record-layout-parser/SKILL.md` | From the reference; the reference harness's phases 1–6 kept. Additions:<br>• input rules (Agent 2 entries, FD records and copybooks from source)<br>• the bytes table and FILLER paths<br>• Phase 7, identity registration, with 9 queries plus admin init |
| `.claude/skills/data-dictionary-builder/SKILL.md` | From the reference; the reference harness's phases 1–5 and the artifact schema kept. Additions:<br>• ID fields on every entry, catalogue fragment formats<br>• Phase 6: `derive-record-relationships` plus 4 read queries<br>• assembly from a head file and fragments, the count check |
| `THIRD_PARTY_NOTICES.md` | Attribution rows for the 3 derived files |
| This document | — |

Agents 1 and 2 (definitions, skills, outputs and Neo4j data), `references/` and all COBOL sources are unchanged.

## 3. Neo4j model

```
(:SourceFile)-[:HAS_DATA_STATE]->(:DataSequence {file_id, rec_seq, fld_seq, active_run_id, active_worker_id, last_completed_run_id})
(:SourceFile)-[:DEFINES_RECORD]->(:DataRecord {record_id, identity_key, section, name, level, total_bytes, inline_bytes, status, review_status, last_run_id})
(:CobolSection)-[:DECLARES_RECORD]->(:DataRecord)                       // Agent 2 section that declares a program record
(:DataRecord|DataField)-[:CONTAINS_FIELD {seq}]->(:DataField {field_id, identity_key, path, pic, normalized_type, storage_type, bytes, occurs_*, value, status})
(:DataField|DataRecord)-[:REDEFINES]->(:DataField|DataRecord)
(:SourceFile)-[:USES_COPYBOOK {line, copybook, include_kind, replacing}]->(:SourceFile)
(:DataRecord|DataField|CobolSection)-[:EXPANDS_COPY {line, target, replacing}]->(:DataRecord)   // copy stub -> copybook records
(:DataRecord)-[:RELATED_RECORD {type, confidence, via}]->(:DataRecord)  // derived; rebuilt by data-dictionary-builder
```

The constraints are `revforge_data_state_file`, `revforge_data_record_id`, `revforge_data_record_key`, `revforge_data_field_id` and `revforge_data_field_key`, plus two run indexes. An administrator creates them once. Agents check them with `verify-data-registry` (5 data / 6 parser / 7 registry).

## 4. Concurrency and safety

- **Per-file data lock.** A run takes the file's lock (`run_id` + `worker_id`), and every write checks it.
  - Another run's lock is refused (`data_run_locked`).
  - A takeover needs `DATA_TAKEOVER_RUN_ID` naming the exact dead run.
  - The counter node is locked first (`SET`) in every write transaction, so concurrent allocation is serialized.
- **Idempotent batches.** Resending a batch never creates a second ID for an existing key. A failed batch rolls back completely.
- **Finalize safeguard.** `finalize-data-run` marks nothing inactive unless the registry saw exactly the expected record and field counts.
- **Fresh runs.** A fresh run (a new run ID) rebuilds the file's derived links (`USES_COPYBOOK`, `EXPANDS_COPY`, `REDEFINES`). A resume keeps them.
- **Ordering.** Copybook runs complete before the programs that expand them. Shared work is split by disjoint `SOURCE_FILTER` under one `DATA_RUN_ID`, with one worker ID per execution.
- **Reads.** A read is sent only after the writes it depends on have returned. The MCP server runs parallel calls concurrently.

## 5. Verification results (2026-10-24 … 2026-10-25)

### Agent 2 data definitions are accessible

- **Agent 2 entries:** the 42 `raw_structure` files hold 928 WORKING-STORAGE / LINKAGE entries, all with lines and PIC. This includes the 13 partly parsed programs.
- **Entries without a PIC:** 25, all of them 01 groups whose content is a COPY stub. Agent 3 expands these.
- **Read by Agent 3 from source:**
  - 20 copybooks, with 564 items;
  - 28 inline FD records in 14 programs.
- **Skipped:** `.sql` DDL files.
- **Partly parsed programs** were processed normally. CURSMGR, for example, has 4 records and 18 fields, all consistent.

### Query tests (`cypher-shell`, queries extracted verbatim from the skills; fixture system `SYS-BANKING-001`)

| Test | Result |
|---|---|
| Copybook with OCCURS 3 of COMP, COMP-3, FILLER and REDEFINES | ACCT-REC total 33 (AMT-TABLE 4×3 = 12 counted in it, COMP-3 5, REDEFINES excluded) |
| Program: FD record, an elementary 01 with an 88, an 01 holding COPY | FD record 15, WS-FLAG 1, WS-ACCT 33 via EXPANDS_COPY; `DECLARES_RECORD` from the Agent 2 section |
| Relationships | SHARED_KEY, FILE_BUFFER, COPY_EXPANSION and a redefines group correct; re-derive rebuilds without duplicates |
| Identical rerun | same IDs, no new nodes |
| Field inserted | only the inserted field gets a new ID |
| Field renamed / restored | rename → new ID, old INACTIVE; restore → old ID reactivated |
| Lock | a second run is refused; explicit takeover works |

### Run 1, the full codebase (the reference harness's sample, run `DRUN-20261024T215053Z-ACC1`)

- **Execution:** 4 copybook executions and 10 program executions, all real `3_data_c` agents with disjoint filters, then one `MODE=dictionary` execution.
- **Completion:** all **62 sources** (20 copybooks, 42 programs) completed, and `verify-data-integrity` returned `consistent` for 62 of 62. No lock conflicts.
- **Registry:**
  - 231 DataRecords (37 copybook, 194 program, of which 28 are FILE records);
  - 1,346 DataFields (979 elementary, 259 condition names, the rest groups);
  - everything ACTIVE; the per-file counters add up to exactly 231 and 1,346;
  - 95 copy usages.
- **`data_artifact.json`** (1.07 MB):
  - it parses (PowerShell `ConvertFrom-Json`);
  - 231 records, 1,009 field entries (979 + 30 elementary 01/77 records), 259 conditions, 65 entities, 29 relationships (COPY_EXPANSION 27, SHARED_KEY 1, NAMING_CONVENTION 1), 113 issues;
  - every count equals `data-registry-stats`;
  - all 231 Record IDs and all 1,238 Field/condition IDs are distinct and well-formed.
- **JSON vs Neo4j:** for each of the 62 files, the artifact's record count, total bytes and non-group field count equal Neo4j's.
- **Output files:** all 62 layout files and 310 catalogue fragments (1,612 entries) parse.
- **Independent source checks:**
  - exactly 5 COBOL files contain OCCURS, matching the 5 OCCURS tables;
  - no source contains REDEFINES, matching 0 REDEFINES.
- **Real source findings that the size computation surfaced:**
  - PORTMSTR's FD says `RECORD CONTAINS 100` but the record computes to 103, because `S9(13)V99 COMP-3` takes 8 bytes;
  - FILEHNDL's VSAM-RECORD (100) matches its `RECORD CONTAINS 100`.

### Repeated-run ID stability

- **Re-registered sources:** the pilot (`DRUN-20261024T212149Z-4362`) had registered AUDITLOG, ERRHAND, RTNCODE and RPTAUD00. Run 1 extracted them again, and every Record and Field ID was reused unchanged with no new nodes. RPTAUD00: 5 records and 27 fields, counters still 5/27.
- **Run 2** (`DRUN-20261025T135019Z-17276`, a separate `3_data_c` execution with a new run ID and worker ID) re-extracted 10 representative sources **from source**, without reading their Run 1 layouts first:

  | Source | Feature tested |
  |---|---|
  | CKPRST copybook | OCCURS; name shared with a program |
  | PRCSEQ | OCCURS; 9 FILLERs |
  | DBTBLS | — |
  | CKPRST program | — |
  | POSUPDT | empty source |
  | DB2ERR | REPLACING |
  | CURSMGR | partly parsed by Agent 2 |
  | INQHIST | OCCURS; copybook 01 placed under a program 01 |
  | PORTTRAN | unresolved stub |
  | TSTGEN00 | 11 records, REPLACING |

  Checked independently in Neo4j against a baseline captured before the run:

  | Check | Result |
  |---|---|
  | Data runs completed by Run 2, no open locks | 10 / 10 |
  | Record / field counters unchanged (no new ID allocated) | 10 / 10 (e.g. PRCSEQ 2/64, INQHIST 8/35, TSTGEN00 11/28) |
  | Nodes created by `register-layout` | 0 |
  | Records / fields that are ACTIVE **and** last seen by Run 2 | 38 / 38 records, 247 / 247 fields |
  | Records / fields made INACTIVE | 0 / 0 |
  | Sum of record `total_bytes` and of field `bytes` per file | identical (e.g. INQHIST 4045 / 3748, CURSMGR 3317 / 3282) |
  | System totals after Run 2 | 231 records, 1,346 fields, all ACTIVE; counters 231 / 1,346 |
  | IDs in the rewritten catalogues vs `data_artifact.json` | 1,469 = 1,469, 0 differences |

  Because identity keys never change, unchanged counters plus "every node re-seen and still active" means every Record and Field ID was matched to itself.

  **What did vary between the runs:** non-identity details written by the LLM in the catalogues. Run 2 recorded the table maximum as `occurs_max` on fields inside OCCURS groups where Run 1 had `null`, and some issue wording differed. Neither affects any ID or size.

  **Dictionary rebuild after Run 2:** a `MODE=dictionary` execution ran again with Run 2's run ID.
  - `derive-record-relationships` deleted 29 relationships and created 29: the **same record pairs**, in the same REL order.
  - The rebuilt `data_artifact.json` parses, has the same counts and the same 1,469 distinct IDs, and lists both run IDs in `meta.data_run_ids`.
  - Only the order of `programs_using` changed, for 8 entities; the sets are the same.

  **Run 2's own deviations:** it read one TSTGEN00 issues file before registering it, and once sent a read in the same parallel group as a write; it re-ran that read on its own with the same result.

### Integrity of earlier agents

- **Neo4j:** Agent 1's 83 files and Agent 2's 140 sections, 402 paragraphs and 1,941 statements are unchanged.
- **Files:** no Agent 1 or Agent 2 definition, skill or output was modified after Agent 3 work began.
- **Other:** `references/` is unchanged, and there are no `.py` files in the project.

## 6. Limitations and open items

1. **REDEFINES is tested only on fixtures.** The sample has no REDEFINES, so `REDEFINES_ALIAS`, redefines groups and the size exclusion were verified only on `SYS-BANKING-001`.
2. **A level-01 copybook copied under a program 01** (for example `01 WS-DB2-AREA. COPY SQLCA.`, where SQLCA starts with its own 01):
   - Agent 3 keeps Agent 2's placement. The program 01 holds the expansion, so its `total_bytes` equals the copybook's and its `inline_bytes` is 0.
   - Strictly, COBOL would start a new record at the copybook's 01. This is flagged as a warning; the issue name differs between executions (for example `copy_level_conflict`, `level_01_copy_under_01`).
3. **Copies held by a section** (a stub directly under an FD or a section) count only in the copybook's own totals, not in any program record.
4. **REPLACING:**
   - expansions keep pointing at the copybook's own Record IDs, and the REPLACING text is stored on the links;
   - renamed copies (for example DB2ERR's `ERRLOG-RECORD` → `WS-ERRLOG-REC`) are not registered as separate records or fields;
   - in TSTGEN00 the REPLACING had no effect on the copybook text.
5. **Unresolved COPY stubs: 5**, all logged and given no IDs:
   - PORTREC (PORTTRAN) and SQLPOS (INQPORT) are not in the inventory;
   - DB2STAT, copied by RPTSTA00 and UTLMON00, is a program;
   - SQLCA includes itself.
6. **OCCURS repeat counts** are stored in Neo4j on the group only. In the catalogues, a field inside a table has `occurs_max: null` (Run 1) or the table maximum (Run 2's rewritten files). The skill doesn't settle which one to use, so it should be stated explicitly.
7. **Issue type names** are LLM-chosen and vary between executions, as do some judgement calls (edited-picture `decimal_places`, `end_line` of items with 88s). They don't affect any ID or size.
8. **`field_key` for elementary 01/77 records:**
   - 4 entries (RPTAUD00, PORTTRAN, UTLMNT00) repeated the record name. They were corrected to `"FLD-" + record_key`, and the skill now has a worked example.
   - `field_key` is a catalogue key only and is not stored in Neo4j.
9. **Fragment line endings:** fragments are written with CRLF, so the assembled artifact contains `\r` before commas. That is valid JSON whitespace.
10. **Rule breaks during Run 1:**
    - several executions used a read-only or no-op shell `for` loop, or a stray `rm` of their own scratch file;
    - one wrote three BCHCTL fragments with a shell loop, then rewrote them from Neo4j results with Write.
    
    No script file was created, and the registry was untouched. The agent definition's "no scripts" rule should stay strict.
11. **The read MCP tool permits schema writes** (carried over from Agents 1–2). Constraints are created by an administrator, not by agents.
12. **Cost:**
    - one full run used about 4.3M subagent tokens (15 executions of ≈0.27–0.37M each);
    - Run 2 (10 sources in one execution) used ≈0.55M;
    - so repeated-run stability was tested on a representative subset, plus the 4 sources registered twice, not on a second full run.
    
    All of this was done by Claude Code agents, not by an engine.
