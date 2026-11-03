# STEP 3.5: STEP 3 defect remediation report

Run: `FWD-20261031T172520Z-66b3`. Workflow state: `REQUIREMENTS_DRAFTED`.
Date: 2026-10-31.

Record directory: all sealed records are under `forward/runs/FWD-20261031T172520Z-66b3/workflow/`, in the `verification/`, `corrections/` and `consolidation/` folders. Each record is written only by the runtime, appended to the audit log and checkpointed (checkpoint #79 verified).

Scope:
- No reverse artifact, reverse agent or skill, COBOL source, Neo4j data or Git history was changed.
- Nothing was committed or pushed.
- F3–F7 were not run, and no Java was generated.

## Summary

| # | Issue | Final status | Blocks G2 |
|---|-------|--------------|-----------|
| A1 | 154 canonical rules vs 163 dispositions | VERIFIED (balanced, accounted per ID) | No |
| A2 | Duplicated rule dispositions across batches | VERIFIED. 5 consistent; 3 conflicting, handed to D | Through D |
| A3 | Reported 153 decisions vs actual 152 | FIXED (report arithmetic error; the counts were not changed) | No |
| B | Independent check of claims marked verified from source | VERIFIED (re-checked). The contradictions and unverified claims remain **OPEN** | **Yes** |
| C | PKT-0010-F2 `inputs_used` presented as proof of reading | FIXED going forward. The historical defect is **OPEN** (systemic across all 5 F2 packets, recorded) | **Yes** |
| D | BR-143/144/145 disagreement between batches | SME_BLOCKED (DR-CONSOLIDATION-001..003) | **Yes** |
| D2 | Other disagreements between batches | VERIFIED: none (0 field conflicts, 0 duplicate requirement IDs) | No |
| E1 | PKT-0005-F2 "Sixteen" should be "Fifteen" | FIXED (COR-0001) | No |
| E2 | PKT-0005-F2 wrong statement ID for line 183 | FIXED (COR-0002) | No |
| E3 | 9 retained source and evidence issues | SME_BLOCKED (all 9 are linked to open decisions) | **Yes** |
| R1 | Regression found during this step: tracked-issue regex stored as a backspace | FIXED (CONS-0003 supersedes CONS-0002) | No |

**G2 status:** still UNVERIFIED and fail-closed. G2 implementation was **not started**: no G2 specification was supplied, and the instruction was to stop after this report.

Health checks:
- Tests: **134/134 pass** (120 existing and 14 new in `forward/tests/step35.test.ts`).
- `doctor`, `validate`, `skills` (14/14) and `agents` (7) report OK.
- `resume` restores `REQUIREMENTS_DRAFTED`.

---

## A. Numerical reconciliation

### A1: 154 vs 163

- **Defect:** STEP 3 reported 163 rule dispositions against 154 canonical rules, with no per-ID accounting.
- **Root cause:** a rule declared in a copybook, or implemented by programs in different batches, is placed in the scope of every batch whose programs use it. Each of those batches records its own disposition, so one rule can have several entries.
- **Evidence inspected:** `rule_coverage` in all three accepted F1 deliveries, checked against `output/rules/rules_artifact.json`.
- **Result:** `RECON-0002` gives 154 canonical rules plus 9 additional batch entries, equal to the 163 entries observed, so the totals are **balanced**.
  - Status counts: 146 single, 5 duplicate_consistent, 3 duplicate_conflicting.
  - 0 rules missing; 0 unknown IDs.

| Rule | Entries | Status | Reason |
|------|---------|--------|--------|
| BR-004 | 2 | consistent | HISTLD00 is in PKT-0002, PORTTRAN in PKT-0004 |
| BR-148, BR-149, BR-151 | 2 each | consistent | copybook-declared rule listed for programs in several batches |
| BR-150 | 3 | consistent | copybook-declared rule listed for programs in several batches |
| BR-143, BR-144, BR-145 | 2 each | **conflicting** | see D |

- Extra entries: 1 + 3 + 2 + 3 = 9.
- **Files changed:**
  - `runtime/src/remediation/remediation.ts` (`reconcile`)
  - `runtime/src/commands/workflow.ts` (`workflow reconcile`)
- **Test:** `S35-A … batch entries reconcile to canonical rules`.
- **Status:** VERIFIED. **Blocks G2:** no.

### A3: 153 vs 152 decisions

- **Defect:** the STEP 3 report said there were 153 decisions.
- **Root cause:** an arithmetic error in my STEP 3 report. The deliveries are correct.
- **Evidence:** per-packet counts in RECON-0002 give 152 decisions with 152 unique IDs and no duplicates. 73 of them are blocking.

| Agent | Total | Per packet |
|-------|-------|------------|
| F1 | 95 | 33 + 33 + 29 |
| F2 | 57 | 26 + 14 + 9 + 5 + 3 |

- **Fix:** the reconciliation now takes the reported total as an input and flags any mismatch (`reported 153: DOES NOT MATCH`). No counts were adjusted.
- **Test:** the same S35-A test checks `reported_matches === false` when the reported total is wrong.
- **Status:** FIXED. **Blocks G2:** no.

## B. Independent source verification

- **Defect:** the 69 requirements and 775 fields marked `verified_from_source` were taken on the agents' word.
- **Root cause:** the status was an agent declaration. The runtime never re-checked the claim against the COBOL text.
- **What was built:**
  - `verification/src/cobol-source.ts`, a fixed-format COBOL reader: data-entry parsing, PIC expansion, and storage sizing for DISPLAY, COMP and COMP-3.
  - `verifySources`, which keeps four statuses separate for every claim:
    - `source_available`
    - `access_demonstrated` (from the agent's own transcript)
    - `claim_verification` (re-derived by the runtime from source)
    - `effective_status`
  - How claims are checked:
    - **Fields:** name, level, PIC, usage, byte length, OCCURS and offset, all recomputed from the source text.
    - **Text claims:** the cited statement or paragraph is resolved, the cited line must fall inside it, the statement keyword must be present, and each quoted literal or number must appear in the cited range.
- **Results (VER-0002; VER-0003 is the same view after corrections):**

| Claim kind | Claims | Verified | Unverified | Contradicted | Access demonstrated |
|------------|--------|----------|------------|--------------|---------------------|
| Requirements | 69 | 33 | 31 | **5** | 68 read the cited lines; 1 not demonstrated |
| Fields | 775 | 775 | 0 | 0 | 775 read |
| Runtime requirements | 64 | 44 (44) | 17 (18) | **3 (2)** | 52 read, 2 other lines, 6 directory grep only, 4 none |
| File operations | 104 | 104 | 0 | 0 | 104 read |

Figures in brackets are from VER-0003. COR-0002 fixes the RTNANA00 citation, but the literals that claim states cannot be found at the corrected line, so that claim moves from contradicted to unverified, not to verified.

- **Contradicted: the citation line falls outside the cited statement.**
  - Requirements: REQ-HISTLD00-002 (cites 138, statement at 166), REQ-PRCSEQ00-002, REQ-RCVPRC00-005, REQ-RTNCDE00-004, REQ-PORTADD-005.
  - Runtime requirements: HISTLD00 commit interval, DB2CONN DISC, and RTNANA00 totals (corrected by COR-0002).
  - These are **not** auto-corrected. Each needs the correct statement chosen, and the claim's wording may rest on the wrong line.
- **Unverified:** for 31 requirements and 17/18 runtime claims, either a stated literal is not found in the cited range or there is no reference precise enough to locate. They are now reported as unverified, not as `verified_from_source`.
- **Files changed:**
  - `verification/src/cobol-source.ts` (new)
  - `runtime/src/remediation/remediation.ts` (`buildCtx`, `verifyField`, `verifyTextClaim`, `claimLiterals`, `verifySources`)
  - `workflow verify-sources [--corrected]`
- **Tests (S35-B):**
  - correct fields verified (COMP-3, COMP, 88-level);
  - wrong PIC, usage, size, offset, name or level contradicted;
  - missing source or unknown field reported unverified;
  - text claims checked four ways: supported, misplaced line, absent literal, unlocatable;
  - possessive apostrophes are not extracted as literals (a regression found while doing B);
  - innermost statement selection;
  - the four statuses kept separate end to end.
- **Status:** the verification is VERIFIED. The 5 + 2 contradictions and the unverified claims are **OPEN**. **Blocks G2:** yes, because requirements with contradicted citations cannot be approved.

## C. Provenance of `inputs_used`

- **Defect:** PKT-0010-F2 lists every supplied input as "used".
- **Root cause:** my STEP 3 dispatch prompts told agents to copy the packet inputs into `inputs_used`. So `inputs_used` records what was *supplied*, not what was *read*. Nothing compared it with real tool activity.
- **Evidence:** each packet's own subagent transcript, parsed for Read, Grep and Glob calls. Failed calls are excluded.
  - Grep on a specific file and grep on a whole directory are counted separately.
  - A directory grep does not show which content was used, so it counts only as weak evidence.
- **Result (ACC-…-0003):** the defect is **systemic in F2**, not limited to PKT-0010.

| Packet | Status | Supplied | Supplied & read | Original COBOL files read |
|--------|--------|----------|-----------------|---------------------------|
| PKT-0002-F1 | weakly_evidenced | 52 | 13 | 7 |
| PKT-0003-F1 | weakly_evidenced | 52 | 19 | 6 |
| PKT-0004-F1 | evidenced | 52 | 18 | 5 |
| PKT-0005-F2 | **not_evidenced** | 63 | 5 | 13 |
| PKT-0006-F2 | **not_evidenced** | 63 | 17 | 5 |
| PKT-0007-F2 | **not_evidenced** | 63 | 4 | 1 |
| PKT-0010-F2 | **not_evidenced** | 49 | 3 | 14 |
| PKT-0011-F2 | **not_evidenced** | 29 | 3 | 6 |

- **Correction:**
  - **Historical records:** receipts and deliverables were **not rewritten**. Each packet has a supplemental, versioned record (`ACC-<packet>[-NNNN]`) that lists, per output, the declared inputs that were read, found only by grep, or not read. Each record also confirms that the receipt hash is unchanged. No access log was fabricated: the evidence is the transcript itself, identified by its hash.
  - **Future receipts:**
    - The receipt schema now has an optional `declared_reads` field.
    - Receipt provenance records `inputs_supplied`, `declared_reads` and `inputs_used_declared` separately, with `status: agent_declared_unverified` until `workflow verify-access` attaches transcript evidence.
- **Files changed:**
  - `runtime/src/remediation/transcripts.ts` (new)
  - `remediation.ts` (`recordAccess`)
  - `orchestrator.ts` (provenance access block, `declaredInputsUsed`)
  - `contracts/orchestrator/agent-receipt.schema.json`
  - `permissions.ts` (runtime-only record directories)
  - `workflow verify-access`
- **Tests (S35-C):**
  - access levels: read covering the citation, read of other lines, file grep, directory grep, failed read, none;
  - a declared-but-unread input gives `declared_inputs_not_evidenced`, the receipt hash is unchanged, and a second run creates a new version;
  - new receipts carry supplied inputs, declared reads and access status separately.
- **Status:** the mechanism is FIXED. The historical F2 provenance is **OPEN**: it cannot be repaired after the fact, only disclosed. **Blocks G2:** yes, until F2 claims are approved on independently verified evidence (B) or F2 is re-run with transcript-backed reads.

## D. Consistency across batches

- **Defect:** BR-143/144/145 are `mapped` in PKT-0002-F1 and `not_a_requirement` in PKT-0004-F1.
- **Root cause:** a real difference in interpretation. The reverse artifact describes these rules as a "declared value domain; assigned by callers, never tested". Whether such a domain is a requirement is a business question, not a technical error.
- **Fix:** CONS-0003 does not auto-correct these rules. It adds open, blocking decisions DR-CONSOLIDATION-001..003 to the consolidated register, which now has 155 decisions: 152 original plus 3, of which 76 are blocking and all are open.
  - Other checks: the 5 consistent overlaps are listed; 0 fields mapped differently; 0 fields mapped twice; 0 duplicate requirement IDs.
  - Consolidation reads the corrected versions of documents (COR-0001/0002 overlays).
- **Files changed:** `remediation.ts` (`consolidate`), `workflow consolidate`.
- **Test:** `S35-D/E … cross-batch disagreements become open blocking SME decisions`. It checks that the conflict is recorded, `auto_corrected=false`, the reverse-artifact outcome is quoted, and a DR-CONSOLIDATION decision is added.
- **Status:** BR-143/144/145 are SME_BLOCKED. "Other disagreements" is VERIFIED as none. **Blocks G2:** yes.

## E. Text and source discrepancies

### E1 / E2: PKT-0005-F2 corrections

| ID | Target | Original | Corrected | Evidence |
|----|--------|----------|-----------|----------|
| COR-0001 | `data_mappings.json` `/unresolved_findings/2/description` | "Sixteen catalogued items…" | "Fifteen catalogued items…" | The finding lists 15 `source_refs`; the runtime counts them itself |
| COR-0002 | `file_operation_requirements.json` `/programs/9/compatibility_requirements/3/source_refs/0` | `…FIL-0051-STMT-000026` | `…FIL-0051-STMT-000045` | Line 183 is `ADD WS-DTL-TOTAL TO WS-PROGRAM-COUNT`; the innermost covering statement is resolved from the parser structure, and its keyword is checked in source |

- **How corrections are applied:** the runtime computes the new value itself (it never takes a value from the caller) and refuses when there is nothing to correct. The corrected copy goes to `corrections/applied/…` and is validated against the contract. Original and corrected hashes are both recorded.
- **Originals preserved:** the PKT-0005-F2 deliverables and RCPT-0008-F2 still match their pre-STEP-3.5 hashes.
- **Files changed:** `remediation.ts` (`correct`, `statementForLine`), `workflow correct`.
- **Tests:**
  - an incorrect count is corrected and the original stays unchanged;
  - re-correction is refused;
  - a target that is not an output is refused;
  - consolidation uses the corrected copy;
  - `statementForLine` picks the innermost statement.
- **Status:** FIXED. **Blocks G2:** no.

### E3: Retained issues (not auto-corrected; no Field IDs invented)

| Issue | Status | Linked decisions |
|-------|--------|------------------|
| HISTLD00 commit counting | SME_BLOCKED | DR-HISTLD00-003, -004, DR-F2-0005-012, -018 |
| RCVPRC00 restart limit | SME_BLOCKED | DR-RCVPRC00-002 |
| PORTMSTR record length 100 vs 103 | SME_BLOCKED | DR-PORTMSTR-004, DR-F2-P0006-003, -014 |
| PORTMSTR/PORTFLIO status values | SME_BLOCKED | 13 decisions (DR-PORTMSTR-001…, DR-F2-P0006-…) |
| FILEHNDL write to input-only file | SME_BLOCKED | DR-FILEHNDL-001, -002, DR-F2-P0007-003, -009 |
| SQLCA self-inclusion | SME_BLOCKED | 7 decisions |
| SQLPOS missing | SME_BLOCKED | DR-INQPORT-001, DR-F2-P0006-001 |
| DB2STAT used as a copybook | SME_BLOCKED | 11 decisions |
| PORTREC missing | SME_BLOCKED | DR-PORTTRAN-001, DR-F2-P0007-001 |

- **Change:** the issue patterns live in `forward/config/tracked-issues.json`, and each CONS record stores that file's hash. Putting them in runtime source broke the STEP 1 rule against hard-coded system knowledge, which an existing test caught.
- **Blocks G2:** yes.

### R1: Regression found during this step

- **Defect:** writing the config through a bash heredoc stored `\b103\b` as the backspace character. In CONS-0002 the PORTMSTR length issue was therefore reported `NOT_FOUND`.
- **Fix:** the pattern was corrected and CONS-0003 recorded. CONS-0002 is kept as the superseded record.
- **Test:** the shipped patterns must contain no control characters, and the word-boundary pattern must still match.
- **Status:** FIXED.

## What blocks G2

`workflow gate G2` reports UNVERIFIED, for these reasons:
- no human approval is recorded, and the G2 content evaluator is not implemented;
- 76 open blocking decisions (73 original plus DR-CONSOLIDATION-001..003);
- 5 requirements and 2 runtime claims with contradicted citations (B);
- F2 provenance is not evidenced (C);
- packets PKT-0001-F1, PKT-0008-F2 and PKT-0009-F2 still have no receipt.

## New commands

```
workflow reconcile      --run R [--reported-dispositions N --reported-decisions N]
workflow verify-access  --run R --packet P --transcript <subagent.jsonl>
workflow verify-sources --run R [--corrected]
workflow correct        --run R --packet P --file F --pointer /json/ptr --kind count_word|statement_for_line [--count-pointer /ptr] --reason "…"
workflow consolidate    --run R
```
