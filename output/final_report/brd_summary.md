# Portfolio management system — Business Requirements Summary

**Full BRD:** brd.md | **Generated:** 2026-10-26 | **System ID:** SYS-PORTFOLIO-001
**Repository analysed:** `references/upstream-harness/src` (read-only COBOL source) | **Pipeline:** REVFORGE agents 1–7 (upstream legacy-modernization-harness f0c47e0)

> This summary condenses Chapter 1 and the rule set highlights of Chapter 5 of `brd.md`. All figures come from the pipeline artifacts. Items marked ⚠ require subject matter expert (SME) review.

## What this system does

The repository holds a portfolio management system for investment portfolios. The domain is *inferred* from program, file and field names such as portfolio, position, investment type and buy / sell / transfer / fee transactions. Batch programs add, update, delete, list and validate portfolio master records (PORTADD, PORTUPDT, PORTDEL, PORTREAD, PORTMSTR, PORTVALD) and validate investment transactions (PORTTRAN). Others load transaction history into the Db2 database (HISTLD00) and produce the daily position, audit, statistics and return-code analysis reports (RPTPOS00, RPTAUD00, RPTSTA00, RTNANA00). Control programs manage batch run order, checkpoints and restart / recovery (BCHCTL00, PRCSEQ00, RCVPRC00, CKPRST). An online inquiry front end under CICS, IBM's online transaction monitor, shows portfolio positions and transaction history after a security check (INQONLN, INQPORT, INQHIST, SECMGR). Shared Db2, error, audit and return-code services, test and utility programs, and four templates complete the code base (source: Agent 4 program narratives).

## Scale

| Measure | Value |
|---|---|
| Programs | 42: 28 batch, 8 online, 6 unclassified (type taken from Agent 4 entry type because the inventory subtype is unknown; ASM-001) |
| Source lines / paragraphs / statements | 7,149 / 402 / 1,936 |
| Business rules / rule sets | 143 / 10 |
| Rule confidence (Rules Agent) | 39 confirmed, 10 high, 47 medium, 47 low; 81 flagged for SME review |
| Data entities / records / fields / 88-level conditions | 65 / 231 / 1,009 / 259 |
| Copybook registry entries | 25 (20 COBOL copybooks + 5 SQL table definition files) |
| JCL jobs / screen map sets | 15 / 1 (INQSET) |
| Files opened in batch / online files / Db2 tables named | 33 / 1 (POSFILE) / 7 |
| Mermaid diagrams | 60 |
| Gaps (critical / high / medium / low) | 322 (6 / 154 / 79 / 83); 227 SME review items; 6 assumptions |

**Findings by evidence:** 45 rules *Confirmed* (confidence confirmed or high, no SME flag) / 17 rules *Inferred* (medium, no SME flag) / 81 rules *Uncertain* (low, or SME-flagged at any confidence). The 81 *Uncertain* rules are extracted candidates that still require validation; they are not verified requirements.

## Key business rules

These are the top rule from five rule sets. All five are rated `confirmed` with complete evidence and no SME flag (*Confirmed* ✓).

| Rule | Rule set | Confidence | Source program | One-sentence summary |
|---|---|---|---|---|
| BR-063 | RS-007 Account validation | Confirmed ✓ | PORTADD (`SYS-PORTFOLIO-001-FIL-0067`), paragraph 2100-VALIDATE-AND-ADD (`SYS-PORTFOLIO-001-FIL-0067-PAR-0004`) | A new portfolio with a blank portfolio ID, a blank client name or a status other than 'A' (active) is counted as an error and not added; a valid one gets today's create and last-maintenance dates and is written. |
| BR-074 | RS-009 Transaction validation | Confirmed ✓ | PORTTRAN (`SYS-PORTFOLIO-001-FIL-0072`), paragraph 2120-CHECK-TRANSACTION-TYPE (`SYS-PORTFOLIO-001-FIL-0072-PAR-0006`) | The transaction type must be 'BU' (buy), 'SL' (sell), 'TR' (transfer) or 'FE' (fee); any other value produces the error 'Invalid Transaction Type'. |
| BR-026 | RS-003 Recovery and restart | Confirmed ✓ | RCVPRC00 (`SYS-PORTFOLIO-001-FIL-0047`), paragraph 2110-DETERMINE-ACTION (`SYS-PORTFOLIO-001-FIL-0047-PAR-0010`) | For a process that is not restartable, the recovery action is TERMINATE when its restart count exceeds the maximum of 3 restarts, otherwise BYPASS. |
| BR-061 | RS-006 Authentication | Confirmed ✓ | SECMGR (`SYS-PORTFOLIO-001-FIL-0066`), paragraph P100-VALIDATE-USER (`SYS-PORTFOLIO-001-FIL-0066-PAR-0002`) | The user ID in a security request must equal the CICS signed-on user ID; otherwise the response is 8, 'User validation failed'. |
| BR-046 | RS-004 Database connection and commit | Confirmed ✓ | DB2ONLN (`SYS-PORTFOLIO-001-FIL-0060`), paragraph P100-PROCESS-CONNECT (`SYS-PORTFOLIO-001-FIL-0060-PAR-0002`) | A new online Db2 connection is made only while fewer than 100 connections are active; otherwise the request is refused with response -1, 'Maximum connections reached'. |

## Data model highlights

The Data Agent recorded 65 entities. These three carry the core business data. Key fields are as identified by the Data Agent (`data_artifact.data_model.entities[].key_fields`).

| Entity (record) | Copybook (File ID) | Record ID | Fields / bytes | Key fields | Used by |
|---|---|---|---|---|---|
| Portfolio record (`PORT-RECORD`) | PORTFLIO (`SYS-PORTFOLIO-001-FIL-0009`) | SYS-PORTFOLIO-001-FIL-0009-REC-0001 | 12 / 148 | PORT-ID, PORT-ACCOUNT-NO | PORTADD, PORTDEL, PORTREAD, PORTTEST, PORTUPDT, TSTGEN00 |
| Transaction record (`TRANSACTION-RECORD`) | TRNREC (`SYS-PORTFOLIO-001-FIL-0014`) | SYS-PORTFOLIO-001-FIL-0014-REC-0001 | 14 / 152 | TRN-SEQUENCE-NO, TRN-PORTFOLIO-ID, TRN-INVESTMENT-ID | PORTTRAN, RPTPOS00, TSTGEN00, UTLVAL00 |
| Position record (`POSITION-RECORD`) | POSREC (`SYS-PORTFOLIO-001-FIL-0011`) | SYS-PORTFOLIO-001-FIL-0011-REC-0001 | 11 / 138 | POS-INVESTMENT-ID, POS-PORTFOLIO-ID | RPTPOS00, UTLVAL00, INQPORT |

⚠ The portfolio master record used by PORTMSTR (`PORTFOLIO-RECORD`) is linked to `PORT-RECORD` only by the shared field name PORT-ID (relationship REL-002, low confidence; GAP-210). PORTTRAN's portfolio record layout (copybook PORTREC) is missing (GAP-004).

## Critical gaps

| Gap | Title | Recommended action |
|---|---|---|
| GAP-001 | POSUPDT: source file is empty (1 byte of whitespace) | Obtain the real POSUPDT source from the source library or confirm with the development team that the member is obsolete; re-run the pipeline for it if found. |
| GAP-002 | UTLMON00: main loop UNTIL WS-HOUR = 23 may never end | Review the loop termination field. Confirm it is always set within the loop body (here: how WS-HOUR receives the time), and whether ILBOABN0 or the missing paragraphs end the run. |
| GAP-003 | INQPORT includes SQLPOS (EXEC SQL INCLUDE), which is not in the repository | Locate the missing copybook in a load library, external PDS, or vendor-supplied library. Add to repo and re-run Data Agent. |
| GAP-004 | PORTTRAN: COPY PORTREC cannot be resolved; PORTFOLIO-FILE has no record layout | Locate the missing copybook PORTREC in a load library, external PDS, or vendor-supplied library. Add to repo and re-run Data Agent. |
| GAP-005 | RPTSTA00 copies DB2STAT, which exists only as a program, not as a copybook | Locate the missing copybook in a load library, external PDS, or vendor-supplied library. Add to repo and re-run Data Agent. |
| GAP-006 | UTLMON00 copies DB2STAT, which exists only as a program, not as a copybook | Locate the missing copybook in a load library, external PDS, or vendor-supplied library. Add to repo and re-run Data Agent. |

The recommended actions are quoted from `gaps_register.json`. The full register (Chapter 9 of `brd.md` and `gaps_register.md`) also lists 154 high, 79 medium and 83 low severity gaps.

## Next steps

1. Resolve the 6 critical gaps with SME review (see Chapter 9).
2. Validate the 47 medium-confidence business rules: 17 *Inferred* rules without an SME flag and 30 medium rules that already carry an SME flag. Then review the 47 low-confidence rules, which are all SME-flagged.
3. Confirm the 1 unconfirmed data relationship (REL-002, GAP-210) with a data architect.
4. Review the 10 programs with unstructured control flow before modernisation: CURSMGR, DB2ONLN, DB2RECV, ERRHNDL, INQHIST, INQONLN, INQPORT, RTNANA00, RTNCDE00 and SECMGR (GAP-212 to GAP-221). In every case this is PERFORM … THRU; no program uses GO TO or ALTER.
5. Work through the remaining SME backlog: 227 register items require SME review. Separately, 154 gaps are rated high severity.

**Diagrams:** all 60 Mermaid diagram files passed a structural lint (an automatic check of the diagram text format), but their visual rendering has not been verified (GAP-168).
