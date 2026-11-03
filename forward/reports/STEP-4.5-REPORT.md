# STEP 4.5 — G2 blocker consolidation, root causes and deterministic source verification

Run `FWD-20261031T172520Z-66b3`, baseline `352b97f0bbcbdb149c1118791aaabaa2e8e9972716bc77adc3a2f0644d24a068`, generated 2026-10-31T21:57:29.663Z by `verification report`. Every figure below is computed from the sealed records listed at the end; nothing was resolved, approved or excluded by this analysis.

## 1. Count reconciliation

| Count | Value | What it counts |
|---|---|---|
| register_decisions | 449 | Every decision in the canonical register: decisions raised by accepted F1/F2 deliveries, cross-batch decisions of the current consolidation record, and decisions the runtime derives (one review decision per item that is  |
| blocking_unresolved_decisions | 367 | Register decisions with blocking=true whose current resolution status is not resolved (open, stale or untrusted). A property of the whole register, independent of any scope. |
| scope_blocking_findings | 395 | Findings of scope application with blocking=true. One finding per evaluated subject: item (requirement, runtime requirement, file-operation set, data record), canonical rule, applicable non-item decision, recorded contra |
| requires_evidence_findings | 250 | Findings whose outcome is REQUIRES_EVIDENCE, blocking or not (unresolved dependencies that a gap or decision already tracks are REQUIRES_EVIDENCE but not blocking). |
| contradicted_findings | 11 | Findings whose outcome is CONTRADICTED: citation or attribute mismatches found by the source check, contradictory rule dispositions, and contradictions recorded by F1. Several may describe one underlying conflict (see th |

- Register decisions by origin: derived:review:data_record 116, derived:review:requirement 86, derived:review:runtime_requirement 68, agent:business 42, agent:data_layout 39, agent:technical 36, agent:runtime_semantics 23, agent:scope 12, derived:review:file_operations 11, derived:scope 10, consolidation 3, derived:unaddressed_gap 3.
- Blocking unresolved decisions by origin: derived:review:data_record 116, derived:review:requirement 86, derived:review:runtime_requirement 68, agent:technical 22, agent:business 22, agent:scope 12, derived:review:file_operations 11, agent:data_layout 10, derived:scope 10, agent:runtime_semantics 7, consolidation 3.
- Each blocking decision appears in the application scope 86× as its own finding and 281× through the item it reviews (0 not in scope).
- Blocking findings: 395 = item_with_own_review_decision 281, decision:agent:business 22, decision:agent:technical 22, non_decision:rule_coverage:rule 19, decision:agent:scope 12, decision:derived:scope 10, decision:agent:data_layout 10, decision:agent:runtime_semantics 7, item_blocked_only_by_other_decisions 4, non_decision:reconciliation:rule 3, decision:consolidation 3, non_decision:contradiction:contradiction 2 (balanced: true). 24 blocking findings have no decision behind them (rules, contradictions, coverage, packets, dependencies); 4 items are blocked only through another subject's decision.
- REQUIRES_EVIDENCE findings: 250 = 243 blocking + 7 non-blocking (data_contract 116, runtime_evidence 70, requirement_evidence 57, dependency 7).
- CONTRADICTED findings: 11 (requirement_evidence:requirement 5, contradiction:contradiction 2, rule_coverage:rule 2, runtime_evidence:runtime_requirement 2).
- G2 check table: the rows sum to 409 but cover 395 distinct blocking findings (rows overlap: canonical_rule_coverage∩cross_batch_reconciliation=3, canonical_rule_coverage∩contradicted_claims=2, requirement_evidence∩contradicted_claims=5, runtime_evidence∩contradicted_claims=2, semantic_contradictions∩contradicted_claims=2); 0 blocking findings are in no row.

## 2. Root causes

**Unique root causes:** the 395 blocking findings stem from 174 distinct primary root causes; the 367 blocking decisions from 213; together 226. The registry holds 395 roots in all; 359 are linked (primarily or secondarily) to something blocking.

395 root causes (359 blocking) link all 449/449 decisions and 395/395 blocking findings (unmapped: 0). 274 decisions share their primary root cause with at least one other decision (94 roots carry several decisions). Grouping removed no decision and no blocker.

Blocking root causes by category: unsupported_business_interpretation 126, missing_evidence 122, control_flow_uncertainty 57, data_layout_inconsistency 22, program_scope_uncertainty 11, missing_source_or_dependency 7, incorrect_source_citation 7, runtime_behavior_uncertainty 3, contradictory_business_rules 2, approval_prerequisite 2.

Largest blocking root causes:

| Root cause | Category | Decisions | Blocking findings | Program scopes blocked | Evidence |
|---|---|---|---|---|---|
| RC-SRC-3b9f4685e9 CIRCULAR_COPY GAP-002: Copybook SQLCA includes itself (circular copy) | missing_source_or_dependency | 7 | 21 | 15 | VERIFIED_DETERMINISTICALLY |
| RC-EVD-858ebbfdee data_record evidence of UTLMON00 not established (reverse_only) | missing_evidence | 10 | 10 | 1 | VERIFIED_DETERMINISTICALLY |
| RC-EVD-a154c29744 data_record evidence of TSTGEN00 not established (reverse_only) | missing_evidence | 8 | 8 | 1 | VERIFIED_DETERMINISTICALLY |
| RC-EVD-913d69f1b0 data_record evidence of TSTVAL00 not established (reverse_only) | missing_evidence | 8 | 8 | 1 | VERIFIED_DETERMINISTICALLY |
| RC-DAT-7f35a1065f UNDECLARED_DATA_NAME GAP-029: HISTLD00: 13 history source fields and 2 checkpoin | data_layout_inconsistency | 6 | 9 | 1 | VERIFIED_DETERMINISTICALLY |
| RC-CON-2df0c44b86 Contradictory rules BR-095, BR-117, BR-149 | contradictory_business_rules | 4 | 11 | 7 | VERIFIED_DETERMINISTICALLY |
| RC-SRC-7e4d52eac2 Unresolved dependency PORTREC | missing_source_or_dependency | 4 | 10 | 1 | EXTERNAL_DEPENDENCY_MISSING |
| RC-SRC-20147a4495 Unresolved dependency DB2STAT | missing_source_or_dependency | 6 | 6 | 2 | VERIFIED_STRUCTURALLY |
| RC-BIZ-2581bd44ea Interpretation of BR-006 (Calculate history load counters per record) unconfirme | unsupported_business_interpretation | 4 | 8 | 1 | INSUFFICIENT_EVIDENCE |
| RC-EVD-33ceb1ea55 data_record evidence of UTLMNT00 not established (reverse_only) | missing_evidence | 6 | 6 | 1 | VERIFIED_DETERMINISTICALLY |
| RC-EVD-b660877525 data_record evidence of UTLVAL00 not established (reverse_only) | missing_evidence | 6 | 6 | 1 | VERIFIED_DETERMINISTICALLY |
| RC-FLW-7480c2e09b SUSPECTED_LOGIC_DEFECT GAP-078: PORTVALD: two field checks cannot behave as desc | control_flow_uncertainty | 3 | 8 | 1 | VERIFIED_STRUCTURALLY |
| RC-FLW-40635a14c3 DEAD_CODE_CONFIRMED GAP-093: PORTTRAN: position update and audit logic is never  | control_flow_uncertainty | 2 | 9 | 1 | VERIFIED_STRUCTURALLY |
| RC-CON-a5f4b1d4fd Batches disagree on rules declared in SYS-PORTFOLIO-001-FIL-0005 | contradictory_business_rules | 4 | 7 | 4 | VERIFIED_DETERMINISTICALLY |
| RC-BIZ-a28c3d71b6 Interpretation of BR-112 (Restrict sale quantity to units held (unreachable code | unsupported_business_interpretation | 2 | 9 | 1 | INSUFFICIENT_EVIDENCE |

## 3. Deterministic source verification

Source root configured (env, 292 files, read-only); 42/42 programs structurally verified (every parser statement and paragraph at its cited line). Source files changed since the previous run: none (vs deterministic-verification-0003).

Root-cause outcomes: INSUFFICIENT_EVIDENCE 182, VERIFIED_STRUCTURALLY 136, VERIFIED_DETERMINISTICALLY 58, EXTERNAL_DEPENDENCY_MISSING 9, CONTRADICTED_BY_SOURCE 5, NOT_APPLICABLE_WITH_EVIDENCE 3, SOURCE_CITATION_CORRECTED 2.

Next step required: REQUIRES_INDEPENDENT_SEMANTIC_REVIEW 243, REQUIRES_TECHNICAL_SME 126, REQUIRES_BUSINESS_SME 17, REQUIRES_SOURCE 5, REQUIRES_PROPOSAL_REVIEW 2, REQUIRES_APPROVAL 2.

Facts computed from the source (not interpretations):

- BCHCTL00: PERFORM 1100-OPEN-FILES at line 84 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 1200-READ-CONTROL-RECORD at line 85 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 1300-VALIDATE-PROCESS at line 86 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 1400-UPDATE-START-STATUS at line 87 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 2100-READ-CONTROL-RECORD at line 91 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 2200-CHECK-DEPENDENCIES at line 92 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 3100-READ-CONTROL-RECORD at line 101 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 3200-UPDATE-PROCESS-STATUS at line 102 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 3300-WRITE-CONTROL-RECORD at line 103 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 4100-UPDATE-COMPLETION at line 107 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- BCHCTL00: PERFORM 4200-CLOSE-FILES at line 108 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- HISTLD00: PERFORM CONNECT-TO-DB2 at line 117 has no paragraph in the PROCEDURE DIVISION (a paragraph of that name is in member DBPROC, which is copied into the DATA DIVISION at line 45).
- HISTLD00: PERFORM DB2-ERROR-ROUTINE at line 172 has no paragraph in the PROCEDURE DIVISION (a paragraph of that name is in member DBPROC, which is copied into the DATA DIVISION at line 45).
- HISTLD00: PERFORM DISCONNECT-FROM-DB2 at line 216 has no paragraph in the PROCEDURE DIVISION (a paragraph of that name is in member DBPROC, which is copied into the DATA DIVISION at line 45).
- RPTAUD00: PERFORM 2110-READ-AUDIT-RECORDS at line 127 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTAUD00: PERFORM 2120-SUMMARIZE-AUDIT at line 128 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTAUD00: PERFORM 2210-READ-ERROR-RECORDS at line 131 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTAUD00: PERFORM 2220-SUMMARIZE-ERRORS at line 132 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTAUD00: PERFORM 2310-WRITE-AUDIT-SUMMARY at line 135 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTAUD00: PERFORM 2320-WRITE-ERROR-SUMMARY at line 136 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTAUD00: PERFORM 2330-WRITE-CONTROL-SUMMARY at line 137 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTPOS00: PERFORM 2210-READ-TRANSACTIONS at line 144 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTPOS00: PERFORM 2220-SUMMARIZE-ACTIVITY at line 145 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTPOS00: PERFORM 2310-WRITE-TOTALS at line 148 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTPOS00: PERFORM 2320-WRITE-EXCEPTIONS at line 149 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTPOS00: PERFORM 2330-WRITE-METRICS at line 150 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTSTA00: PERFORM 2110-ACCUMULATE-DB2-STATS at line 150 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTSTA00: PERFORM 2210-ACCUMULATE-BATCH-STATS at line 162 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTSTA00: PERFORM 2310-CALC-DB2-METRICS at line 169 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTSTA00: PERFORM 2320-CALC-BATCH-METRICS at line 170 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTSTA00: PERFORM 2410-WRITE-DB2-SECTION at line 173 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTSTA00: PERFORM 2420-WRITE-BATCH-SECTION at line 174 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- RPTSTA00: PERFORM 2430-WRITE-TREND-ANALYSIS at line 175 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- CURSMGR: PERFORM THRU P200-EXIT at line 49 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- CURSMGR: PERFORM P300-FETCH-DATA at line 52 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- CURSMGR: PERFORM THRU P300-EXIT at line 52 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- CURSMGR: PERFORM P400-CLOSE-CURSOR at line 55 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- CURSMGR: PERFORM THRU P400-EXIT at line 55 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTGEN00: PERFORM 2210-GEN-PORT-DATA at line 185 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTGEN00: PERFORM 2220-WRITE-PORT-RECORD at line 186 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTGEN00: PERFORM 2310-GEN-TRAN-DATA at line 192 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTGEN00: PERFORM 2320-WRITE-TRAN-RECORD at line 193 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTGEN00: PERFORM 2410-GEN-DATA-ERRORS at line 197 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTGEN00: PERFORM 2420-GEN-PROCESS-ERRORS at line 198 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTGEN00: PERFORM 2510-GEN-LARGE-PORTFOLIO at line 201 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTGEN00: PERFORM 2520-GEN-LARGE-TRANSACTION at line 202 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2210-OPEN-VSAM at line 150 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2220-ARCHIVE-RECORDS at line 151 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2230-CLOSE-VSAM at line 152 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2310-ANALYZE-SPACE at line 156 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2320-DELETE-OLD at line 157 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2330-UPDATE-CATALOG at line 158 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2410-EXPORT-DATA at line 162 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2420-DELETE-DEFINE at line 163 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2430-IMPORT-DATA at line 164 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2510-COLLECT-STATS at line 168 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMNT00: PERFORM 2520-GENERATE-REPORT at line 169 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTVAL00: PERFORM 2200-RUN-FUNCTIONAL-TEST at line 190 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTVAL00: PERFORM 2300-RUN-INTEGRATION-TEST at line 192 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTVAL00: PERFORM 2400-RUN-PERFORMANCE-TEST at line 194 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTVAL00: PERFORM 2500-RUN-ERROR-TEST at line 196 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTVAL00: PERFORM 2600-VALIDATE-RESULTS at line 202 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTVAL00: PERFORM 2700-UPDATE-METRICS at line 203 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- TSTVAL00: PERFORM 2800-WRITE-TEST-DETAIL at line 204 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 1310-STORE-CONFIG at line 177 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2110-GET-CPU-METRICS at line 190 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2120-GET-MEMORY-METRICS at line 191 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2130-GET-DASD-METRICS at line 192 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2140-GET-DB2-METRICS at line 193 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2210-CHECK-UTILIZATION at line 196 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2220-CHECK-RESPONSE at line 197 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2230-CHECK-QUEUES at line 198 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2240-CHECK-ERRORS at line 199 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2310-LOG-RESOURCES at line 203 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2320-LOG-PERFORMANCE at line 204 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2410-FORMAT-ALERT at line 208 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLMON00: PERFORM 2420-WRITE-ALERT at line 209 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLVAL00: PERFORM 2210-CHECK-POSITION-INTEGRITY at line 165 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLVAL00: PERFORM 2220-CHECK-TRANSACTION-INTEGRITY at line 166 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLVAL00: PERFORM 2310-CHECK-POSITION-XREF at line 169 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLVAL00: PERFORM 2320-CHECK-TRANSACTION-XREF at line 170 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLVAL00: PERFORM 2410-CHECK-POSITION-FORMAT at line 173 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLVAL00: PERFORM 2420-CHECK-TRANSACTION-FORMAT at line 174 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLVAL00: PERFORM 2510-ACCUMULATE-POSITIONS at line 177 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- UTLVAL00: PERFORM 2520-VERIFY-BALANCES at line 178 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- DB2HNDL: PERFORM 2310-PROCESS-CURSOR-ROW at line 174 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- FILEHNDL: WRITE VSAM-FILE at line 130, but the file is opened only INPUT.
- FILEHNDL: PERFORM 2110-PROCESS-VSAM-RECORD at line 122 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- FILEHNDL: PERFORM 2310-PROCESS-INPUT-RECORD at line 144 has no paragraph in the PROCEDURE DIVISION or in any member copied into it.
- PORTMSTR: FD PORTFOLIO-FILE declares RECORD CONTAINS 100; its record(s) occupy PORTFOLIO-RECORD=103 bytes.
- PORTADD: WRITE INPUT-FILE at line 125, but the file is opened only INPUT.

### Tracked Step 3.5 issues (located through config/tracked-issues.json)

| Issue | Root cause(s) | Deterministic outcome | Next step | What the source establishes |
|---|---|---|---|---|
| HISTLD00 commit counting | RC-DAT-7f35a1065f, RC-BIZ-fed4a6b0cb, RC-BIZ-2581bd44ea (+3) | VERIFIED_DETERMINISTICALLY, INSUFFICIENT_EVIDENCE, INSUFFICIENT_EVIDENCE | REQUIRES_TECHNICAL_SME, REQUIRES_INDEPENDENT_SEMANTIC_REVIEW | which referenced names have no declaration in the available source; which cited facts the source supports; which cited facts the source supports |
| RCVPRC00 restart limit | RC-BIZ-b5e1f50128, RC-BIZ-1d4eecf2c2 | INSUFFICIENT_EVIDENCE, INSUFFICIENT_EVIDENCE | REQUIRES_INDEPENDENT_SEMANTIC_REVIEW | which cited facts the source supports; which cited facts the source supports |
| PORTMSTR record length 100 vs 103 | RC-FLW-d087285b74 | VERIFIED_DETERMINISTICALLY | REQUIRES_TECHNICAL_SME | the cited location and its control-flow context |
| PORTMSTR/PORTFLIO status value conflict | RC-DAT-451cfc946a, RC-FLW-d087285b74, RC-CON-2df0c44b86 (+5) | INSUFFICIENT_EVIDENCE, VERIFIED_DETERMINISTICALLY, VERIFIED_DETERMINISTICALLY | REQUIRES_TECHNICAL_SME, REQUIRES_BUSINESS_SME | the cited location and its control-flow context; the declared value domains and where (and whether) the code tests them |
| FILEHNDL write to input-only file | RC-FLW-e7336d7945, RC-FLW-a3f92de4a3, RC-SCP-b14e46fccb (+3) | INSUFFICIENT_EVIDENCE, INSUFFICIENT_EVIDENCE, VERIFIED_STRUCTURALLY | REQUIRES_TECHNICAL_SME, REQUIRES_BUSINESS_SME | how the program is invoked and what its classification rests on |
| SQLCA self-inclusion | RC-SRC-3b9f4685e9, RC-FLW-33b7660eaa, RC-FLW-40571b4390 (+2) | VERIFIED_DETERMINISTICALLY, VERIFIED_DETERMINISTICALLY, VERIFIED_STRUCTURALLY | REQUIRES_TECHNICAL_SME, REQUIRES_INDEPENDENT_SEMANTIC_REVIEW | the member includes itself, so its layout cannot be expanded from the repository; which control-flow targets are absent; the cited location and its control-flow context |
| SQLPOS missing | RC-SRC-f00adc1298, RC-BIZ-f3b5408705 | EXTERNAL_DEPENDENCY_MISSING, INSUFFICIENT_EVIDENCE | REQUIRES_SOURCE, REQUIRES_INDEPENDENT_SEMANTIC_REVIEW | the reference exists and SQLPOS is absent from the provided source; which cited facts the source supports |
| DB2STAT copied as copybook | RC-SRC-20147a4495, RC-SRC-bc0c8b8535, RC-FLW-7422e4e0b6 (+8) | VERIFIED_STRUCTURALLY, EXTERNAL_DEPENDENCY_MISSING, INSUFFICIENT_EVIDENCE | REQUIRES_TECHNICAL_SME, REQUIRES_SOURCE | the member exists in the checkout; the reference exists and ILBOABN0 is absent from the provided source |
| PORTREC missing | RC-SRC-7e4d52eac2, RC-FLW-40635a14c3, RC-BIZ-3a44af94b5 (+2) | EXTERNAL_DEPENDENCY_MISSING, VERIFIED_STRUCTURALLY, VERIFIED_STRUCTURALLY | REQUIRES_SOURCE, REQUIRES_TECHNICAL_SME, REQUIRES_INDEPENDENT_SEMANTIC_REVIEW | the reference exists and PORTREC is absent from the provided source; the cited location and its control-flow context; the cited source exists with the stated statements and values |

### Contradicted citations

| Item | Outcome | Analysis |
|---|---|---|
| REQ-HISTLD00-002 | CONTRADICTED_BY_SOURCE | the stated values are equally supported at line=166 and statement_id=SYS-PORTFOLIO-001-FIL-0044-STMT-000025; the source does not decide |
| REQ-PORTADD-005 | CONTRADICTED_BY_SOURCE | no stated value occurs at either candidate location |
| REQ-PRCSEQ00-002 | SOURCE_CITATION_CORRECTED | 1/4 stated value(s) occur at line=181 (lines 181-181) -> propose line=181 (not every stated value occurs there) |
| REQ-RCVPRC00-005 | CONTRADICTED_BY_SOURCE | no stated value occurs at either candidate location |
| REQ-RTNCDE00-004 | SOURCE_CITATION_CORRECTED | 1/1 stated value(s) occur at line=122 (lines 122-133) -> propose line=122 |
| RT-DB2CONN-003 | CONTRADICTED_BY_SOURCE | the claim states no literal values, so the source cannot tell whether the statement (line=111 or statement_id=SYS-PORTFOLIO-001-FIL-0055-STMT-000011) or the line is wrong |
| RT-HISTLD00-003 | CONTRADICTED_BY_SOURCE | the stated values are equally supported at line=181 and statement_id=SYS-PORTFOLIO-001-FIL-0044-STMT-000043; the source does not decide |

## 4. Remediation proposals

2 proposal(s) (citation_correction 2); new 0, changed 0, unchanged 2. **Authorised: 0.** None is applied; each needs a signed resolution and a validated versioned correction.

| Proposal | Kind | Target | Original → proposed | Authority |
|---|---|---|---|---|
| RP-09cd2b5251 v1 | citation_correction | REQ-PRCSEQ00-002 /requirements/6/source_refs/2/line | 180 → 181 | business_sme |
| RP-8d2dd33787 v1 | citation_correction | REQ-RTNCDE00-004 /requirements/26/source_refs/0/line | 121 → 122 | business_sme |

## 5. Review queue (one entry per blocking root cause)

359 entries; full decision view unchanged (449 decisions).

| Class | Meaning | Root causes | Decisions linked |
|---|---|---|---|
| A | deterministically verifiable technical issues | 34 | 112 |
| B | interpretation disagreements for independent semantic review (Step 5) | 231 | 328 |
| C | genuine business decisions | 16 | 33 |
| D | technical / architecture decisions | 67 | 132 |
| E | missing source or dependency | 9 | 24 |
| Z | approval prerequisites | 2 | 0 |

Readiness for review: awaiting_independent_semantic_review 231, ready_for_human_decision 83, ready_for_technical_review 34, awaiting_source_or_documentation 9, awaiting_trust_provisioning_and_ready_scope 2. By functional area: batch 88, online 79, portfolio 70, common 29, utility 25, test 15, program 10, test+utility 9, batch+common+portfolio 8, error 7, database 5, common+portfolio 4, portfolio+test 3, online+portfolio 3, system-wide 2, batch+common+database+online 1, batch+utility 1.

## 6. Scope readiness (existing G2 evaluator)

Application: NOT_READY 1; programs: NOT_READY 42; shared-dependency scopes: NOT_READY 14; requirements: NOT_READY 114. Trust anchor usable: false.

| Scope | Readiness | Blocking | Specific | Shared | Source-evidence | SME | Technical | Root causes |
|---|---|---|---|---|---|---|---|---|
| application | NOT_READY | 395 | 371 | 24 | 254 | 102 | 39 | 174 |
| BCHCTL00 | NOT_READY | 12 | 5 | 7 | 5 | 5 | 2 | 6 |
| CKPRST | NOT_READY | 3 | 2 | 1 | 1 | 2 | 0 | 2 |
| HISTLD00 | NOT_READY | 19 | 11 | 8 | 8 | 6 | 5 | 10 |
| POSUPDT | NOT_READY | 3 | 3 | 0 | 1 | 2 | 0 | 2 |
| PRCSEQ00 | NOT_READY | 12 | 7 | 5 | 10 | 2 | 0 | 8 |
| RCVPRC00 | NOT_READY | 9 | 4 | 5 | 7 | 2 | 0 | 7 |
| RPTAUD00 | NOT_READY | 11 | 5 | 6 | 2 | 7 | 2 | 4 |
| RPTPOS00 | NOT_READY | 8 | 7 | 1 | 2 | 3 | 3 | 3 |
| RPTSTA00 | NOT_READY | 5 | 5 | 0 | 1 | 1 | 3 | 2 |
| RTNANA00 | NOT_READY | 10 | 7 | 3 | 6 | 2 | 2 | 4 |
| RTNCDE00 | NOT_READY | 5 | 3 | 2 | 2 | 1 | 2 | 2 |
| AUDPROC | NOT_READY | 12 | 6 | 6 | 4 | 8 | 0 | 4 |
| DB2CMT | NOT_READY | 30 | 7 | 23 | 20 | 7 | 3 | 13 |
| DB2CONN | NOT_READY | 20 | 12 | 8 | 13 | 5 | 2 | 10 |
| DB2ERR | NOT_READY | 21 | 14 | 7 | 15 | 4 | 2 | 9 |
| DB2STAT | NOT_READY | 18 | 10 | 8 | 12 | 4 | 2 | 9 |
| ERRPROC | NOT_READY | 5 | 5 | 0 | 3 | 2 | 0 | 4 |
| CURSMGR | NOT_READY | 12 | 7 | 5 | 6 | 1 | 5 | 7 |
| DB2ONLN | NOT_READY | 9 | 6 | 3 | 5 | 2 | 2 | 5 |
| DB2RECV | NOT_READY | 30 | 12 | 18 | 19 | 7 | 4 | 13 |
| ERRHNDL | NOT_READY | 10 | 7 | 3 | 4 | 3 | 3 | 5 |
| INQHIST | NOT_READY | 52 | 12 | 40 | 34 | 10 | 8 | 23 |
| INQONLN | NOT_READY | 79 | 10 | 69 | 52 | 16 | 11 | 38 |
| INQPORT | NOT_READY | 9 | 9 | 0 | 3 | 3 | 3 | 6 |
| SECMGR | NOT_READY | 10 | 8 | 2 | 6 | 2 | 2 | 5 |
| PORTADD | NOT_READY | 10 | 6 | 4 | 6 | 3 | 1 | 5 |
| PORTDEL | NOT_READY | 8 | 4 | 4 | 6 | 2 | 0 | 5 |
| PORTMSTR | NOT_READY | 31 | 10 | 21 | 16 | 13 | 2 | 14 |
| PORTREAD | NOT_READY | 12 | 8 | 4 | 9 | 3 | 0 | 6 |
| PORTTEST | NOT_READY | 11 | 8 | 3 | 8 | 3 | 0 | 7 |
| PORTTRAN | NOT_READY | 33 | 12 | 21 | 15 | 16 | 2 | 14 |
| PORTUPDT | NOT_READY | 13 | 9 | 4 | 10 | 3 | 0 | 6 |
| PORTVALD | NOT_READY | 11 | 8 | 3 | 4 | 7 | 0 | 4 |
| TSTGEN00 | NOT_READY | 18 | 14 | 4 | 14 | 3 | 1 | 9 |
| TSTVAL00 | NOT_READY | 17 | 17 | 0 | 14 | 2 | 1 | 6 |
| UTLMNT00 | NOT_READY | 15 | 14 | 1 | 11 | 3 | 1 | 7 |
| UTLMON00 | NOT_READY | 17 | 17 | 0 | 12 | 3 | 2 | 6 |
| UTLVAL00 | NOT_READY | 12 | 12 | 0 | 9 | 2 | 1 | 6 |
| DB2HNDL | NOT_READY | 10 | 9 | 1 | 6 | 2 | 2 | 4 |
| ERRHANDL | NOT_READY | 9 | 9 | 0 | 6 | 2 | 1 | 4 |
| FILEHNDL | NOT_READY | 10 | 10 | 0 | 7 | 2 | 1 | 6 |
| PROGNAME | NOT_READY | 6 | 6 | 0 | 4 | 2 | 0 | 3 |
| shared:BCHCON | NOT_READY | 37 | 27 | 10 | 21 | 9 | 7 | 19 |
| shared:BCHCTL | NOT_READY | 42 | 32 | 10 | 22 | 10 | 10 | 21 |
| shared:PRCSEQ | NOT_READY | 16 | 11 | 5 | 14 | 2 | 0 | 11 |
| shared:AUDITLOG | NOT_READY | 38 | 23 | 15 | 17 | 17 | 4 | 17 |
| shared:ERRHAND | NOT_READY | 216 | 187 | 29 | 139 | 53 | 24 | 91 |
| shared:PORTFLIO | NOT_READY | 55 | 50 | 5 | 38 | 15 | 2 | 28 |
| shared:POSREC | NOT_READY | 29 | 28 | 1 | 14 | 8 | 7 | 15 |
| shared:RTNCODE | NOT_READY | 107 | 95 | 12 | 67 | 24 | 16 | 43 |
| shared:TRNREC | NOT_READY | 71 | 45 | 26 | 40 | 24 | 7 | 32 |
| shared:DBPROC | NOT_READY | 66 | 54 | 12 | 44 | 16 | 6 | 27 |
| shared:DBTBLS | NOT_READY | 34 | 25 | 9 | 20 | 8 | 6 | 14 |
| shared:SQLCA | NOT_READY | 144 | 131 | 13 | 98 | 33 | 13 | 60 |
| shared:ERRHND | NOT_READY | 79 | 45 | 34 | 52 | 16 | 11 | 38 |
| shared:INQCOM | NOT_READY | 79 | 31 | 48 | 52 | 16 | 11 | 38 |

Requirement scopes: 114; READY 0; fewest blockers: REQ-RTNCDE00-002 (1), REQ-RTNCDE00-003 (2), REQ-RCVPRC00-001 (3), REQ-RCVPRC00-002 (3), REQ-RTNCDE00-001 (3).

## 7. Independent semantic review packets (prepared, not sent)

231 packet(s); status NOT_AUTHORIZED 231; leaks detected 0; packets without available source 12. Source export: **NOT_AUTHORIZED** — no signed source-export authorization has been recorded; trust anchor not provisioned. Packets are prepared locally and must not leave this machine.

Pass A (source only) and Pass B (existing interpretations) are separate sealed records; Pass B binds Pass A by hash; a strict Pass A schema and a 6-word shingle check reject any interpretation text in Pass A.

## 8. Gate and approval status

Application scope NOT_READY (395 blocking). Trust anchor not provisioned. No decision was resolved, no requirement approved, no correction applied by STEP 4.5.

## Sealed records

| Record | SHA-256 |
|---|---|
| workflow/step45/blocker-count-audit-0004.json (blocker-count-audit) | `221d2634601363b267ee535508c19d61ad101a828de672d1a5b7dd15aa6fda27` |
| workflow/step45/root-cause-registry-0004.json (root-cause-registry) | `c619c24d3da5638a63689054aaaf865b6091015ec4cb4e717250a40417049a38` |
| workflow/step45/deterministic-verification-0004.json (deterministic-verification) | `f6783439c16cc5a01167bb08681216455c282d4a4b62e96dd39003f4a9cab8be` |
| workflow/step45/remediation-proposals-0004.json (remediation-proposals) | `d0406661f363308c4913b702b36b34063005a35dfb1cbc2771dc6f340d24e50b` |
| workflow/step45/decision-review-queue-0004.json (decision-review-queue) | `7cc53e17f85e13b89dbde485a1f47f9131a45555fb0d592d00eeaae002556e8b` |
| workflow/step45/scope-readiness-0004.json (scope-readiness) | `dd6cbd9b1fa3ec1552f5cfa8c2a1e8520a5015064ed2c98f20954e0a20750be9` |
| workflow/step45/openai-pass-a-0004.json (openai-pass-a) | `b67b199e278164c778eb9c3a1cb05267a3e9196547aa643e06e78191415f60f8` |
| workflow/step45/openai-pass-b-0004.json (openai-pass-b) | `794060b6e2d0055d3f65d845ccdb85d56a531d0ca95d0f8fc3991bfa25af7264` |
| workflow/step45/openai-verification-queue-0004.json (openai-verification-queue) | `985a54fd0ad8253752f6dfbaaecf50476ac3f726f5bd9cd60bbf1d1a42f36c16` |
