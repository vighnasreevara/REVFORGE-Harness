# REVFORGE — Controlled Defect Corrections Before Agent 6 (D1–D4)

Date: 2026-10-26. Follows `docs/pre_agent6_audit.md`. Agent 6 was not started.
Nothing was committed (the project root is not a git repository).

## 1. What changed

| # | File changed | Change |
|---|---|---|
| D1 | `.claude/skills/control-flow-tracer/SKILL.md` (query `resolve-field-references`) | Qualified lookups now also follow `EXPANDS_COPY`. A field reached through a **fragment** copybook (one with no 01 of its own) resolves. A field reached only through a copybook that begins with its **own 01** stays `UNRESOLVED`, with `unresolved_reason: "QUALIFIER_HOLDS_LEVEL01_COPY"` and `invalid_qualification_candidates` (evidence only, not a match), and is logged as the warning `invalid_qualification`. |
| D2 | same skill | Names declared with INDEXED BY are not looked up as data fields. They are recorded as `{resolution: "INDEX_NAME", target_id: null}`, keep their role in the trace, and are not counted as unresolved. |
| D3 | same skill (Phase 2) | Each condition named in EXEC CICS HANDLE CONDITION becomes one `CICS_HANDLE_CONDITION` step with `target_paragraph_id`, copied only when exactly one registered paragraph matches. Steps carry `unstructured: true` and `runtime_conditional: true`. No CFG edge and no Neo4j relationship are added. A handler target is not documented as a confirmed runtime path. |
| D4 | `.claude/agents/5_rules_c.agent.md` (Constraints) | All reads and searches use the Read, Glob and Grep tools. Bash is limited to `date`, `ls`, `wc` and `mkdir -p`. Agent 5 must not read `references/upstream-harness/output/`; the COBOL source and the reference agent and skill definitions are still allowed. Wording only. |

Backups of every changed file are in the session scratchpad (`backup_before_D1-D4/`).

### Why the seven D1 references stay unresolved

DB2REQ.cpy (line 4, `01 DB2-REQUEST-AREA`) and INQCOM.cpy (line 4, `01 INQCOM-AREA`) each begin with their own 01. Each is copied under a program 01 record:

- DB2RECV lines 27–28: COPY DB2REQ under WS-DB2-REQUEST.
- INQHIST lines 14–15 and 66–67, and INQPORT lines 14–15 and 37–38: COPY INQCOM under WS-COMMAREA and again under DFHCOMMAREA.

A copied 01 starts a separate record, so these fields are not subordinate to the qualifier, and `X OF WS-DB2-REQUEST` or `X OF WS-COMMAREA` is not a valid COBOL qualification. Each name matches exactly one registered field, but a unique name match does not make the qualification valid, so none is used as a target. The fragment-resolution path in the corrected query is untested on real data, because the registry has 0 fragment records.

## 2. Re-run scope

- **Agent 4** (4_logic_c): re-run for DB2RECV, INQHIST, INQPORT and PRCSEQ00 only. `logic_artifact.json` was then updated (step 4) for those four rows, their messages, and the totals.
- **Agent 5** (5_rules_c): a scoped re-run for the same four programs. Entries were edited in place and all COND-, BR-, RS- and EH- IDs were kept.

## 3. Before and after: Agent 4

| Program | Status | unresolved_ids | unresolvable_paths | Change |
|---|---|---|---|---|
| DB2RECV (FIL-0061) | partial → partial | 5 → 5 | 0 → 0 | 3 qualified refs now carry the reason QUALIFIER_HOLDS_LEVEL01_COPY, with candidates FIL-0018-FLD-000001/05/08 |
| INQHIST (FIL-0063) | partial → partial | 4 → 4 | 1 → 1 | 2 qualified refs carry the reason (candidates FIL-0020-FLD-000008/07); HANDLE CONDITION ERROR → PAR-0012 |
| INQPORT (FIL-0065) | partial → partial | 4 → 4 | **2 → 0** | 2 qualified refs carry the reason; ERROR → PAR-0010 and NOTFND → PAR-0008 (the 2 handler "paths" are now registered targets) |
| PRCSEQ00 (FIL-0046) | partial → partial | **2 → 1** | 0 → 0 | WS-PROC-IX is now INDEX_NAME; WS-SUB is still unresolved (not declared) |

Totals across all 42 programs, reconciled against `docs/pre_agent6_audit.md`:

| Metric | Audit | Now | Reason |
|---|---|---|---|
| unresolved_ids | 192 | **191** | D2 −1 (WS-PROC-IX). D1 adds no change: the 7 refs are still unresolved. D3 adds no change: handler targets were counted as paths, not as IDs. |
| fields_unresolved / fields_ambiguous / paragraph_targets / statements | 104 / 3 / 85 / 0 | 103 / 3 / 85 / 0 | 103 + 3 + 85 + 0 = 191 |
| unresolvable_paths | 88 | **86** | D3 −2 (INQPORT). INQHIST's only path is a recursive PERFORM, not a handler, so it remains. |
| logic_status counts | 11 success / 30 partial / 1 empty | unchanged | All four programs stay partial for other reasons: undeclared names, SQLCODE, the RECV-CURSOR ambiguity, the SQLPOS stub, the recursion |

Integrity checks:

- All 4 regenerated files parse and keep every reference-harness key.
- 0 untranslated statements and 0 pseudocode/statement-ID length mismatches.
- All 42 artifact rows match their file `program_summary` exactly.

## 4. Before and after: Agent 5

| Item | Before | After |
|---|---|---|
| Business rules | 143 | **143** |
| Conditions / partial evidence | 519 / 94 | 519 / 94 |
| Error handling entries / rule sets / issues | 157 / 10 / 9 | 157 / 10 / 9 |
| Confidence (confirmed / high / medium / low) | 39 / 10 / 47 / 47 | unchanged |

**Why the rule count does not change.** Rules come from branches and loops. The corrections add no branch and remove none, and every regenerated branch matched an existing condition.

- D1 only explains why the fields are unresolved.
- D2's WS-PROC-IX never appeared in a condition, rule or error entry.
- D3's HANDLE CONDITION steps are registrations, not branches. No Agent 5 entry relied on the two former INQPORT paths, and a handler target is not turned into an outcome.

Entries changed (checked by a diff against the backup; nothing else differs):

- **COND-DB2RECV-P110-001.**
  - DB2-RESPONSE-CODE and DB2-SQLCODE OF WS-DB2-REQUEST get `unresolved_reason` and `invalid_qualification_candidates`.
  - The detail and notes text is corrected. The old text said "Field ID lookup does not follow COPY DB2REQ"; it now says the qualification is invalid.
- **COND-INQHIST-P150-002.**
  - INQCOM-ERROR-MSG gets the reason and candidate.
  - A new `unresolved` entry is added for INQCOM-RESPONSE-CODE. It is reached through the ELSE outcome's PERFORM P999 (line 189) and was missing from the original entry.
- **COND-INQPORT-UNNAMED-001.** INQCOM-ERROR-MSG gets the reason and candidate.
- **BR-053, BR-059** (`sme_review_note`) and **EH-077** (`description`): wording corrected to match.
- **`meta.notes`:** one line appended to record the scoped update.

Evidence, confidence and `requires_sme_review` are unchanged: an invalid qualification is still an unresolved field, so these entries stay partial and capped at medium.

## 5. Verification

- **Permanent IDs, Agent 4.** All 405 distinct IDs in the 4 regenerated logic files exist exactly once in Neo4j and are ACTIVE (405/405, 0 bad, 0 inactive).
- **Permanent IDs, Agent 5.** The `verify-rule-source-ids` query over the in-scope entries checked 39 statements, 24 paragraphs, 0 sections, 15 records, 56 fields and 4 files: 0 bad, `consistent: true`.
- **Schema.** Both rules files parse, the top-level keys are identical, and the array lengths are unchanged. The only new fields are `unresolved_reason` and `invalid_qualification_candidates` inside existing `unresolved` / `fields` entries; they are optional for consumers.
- **Neo4j unchanged.**
  - 4,957 nodes and 5,929 relationships.
  - Newest `last_seen_at`: 2026-10-25T17:08:27.984Z. Newest `last_completed_at` (Agent 3's sequence): 2026-10-25T17:09:24.703Z.
  - Nothing is dated 2026-10-26. Only read queries were run.
- **Restrictions.**
  - The reference repository is at f0c47e0 with a clean working tree.
  - No file under `src/` or `references/` was modified.
  - There are no `.py` files.
  - No new ID type, node, relationship, skill or protocol was added.

## 6. What remains unresolved (by design or upstream)

- **7 invalid qualifications** (QUALIFIER_HOLDS_LEVEL01_COPY), across DB2RECV, INQHIST and INQPORT. They are a source defect: the copybook 01 is nested under a program 01. They need an SME decision; the tooling must not resolve them.
- **SQLCODE** (DB2RECV, INQHIST): supplied by the DB2 precompiler, not by SQLCA.cpy.
- **Undeclared names:** WS-SUB (PRCSEQ00), WS-DB2-TOKEN (INQHIST), and WS-COMMAREA-ACCOUNT-NO and POSITION-ACCOUNT (INQPORT).
- **RECV-CURSOR** (DB2RECV): ambiguous between an 88-level and an X(18) field; no candidate is chosen.
- **INQHIST** recursive PERFORM P150 (1 path). **INQPORT** SQLPOS include stub not in the registry.
- **Portfolio-wide:** 191 unresolved IDs and 86 unresolvable paths, spread across the 30 partial programs and listed per program in `logic_artifact.json`.
- **Untested:** the D1 fragment-copybook resolution path has no test data (the registry has 0 fragments).

## 7. Can Agent 6 proceed?

**Yes, with flags.** Agent 6 consumes `rules_by_program` and the logic files.

- All four corrected defects are fixed or correctly classified.
- The outputs are schema-compatible, and every permanent ID is verified.
- The registry is unchanged.

The remaining unresolved items are documented, flagged `partial` / `requires_sme_review`, and are not presented as confirmed behaviour. Agent 6 should show HANDLE CONDITION targets as conditional (runtime) transfers, not as normal flow edges.
