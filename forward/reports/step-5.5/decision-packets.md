# Human decision packets — programs:RTNCDE00

Packets explain; they do not decide. A decision is resolved only by importing a signed resolution from an authorized human (workflow decisions resolve).

Scope digest `88d8562c1b30170f33446a43303d54d47fd102ec25c3d79249749d6dfd126f13`. 3 root cause(s) (A 1, B 1, D 1), 4 blocking decision(s).

## RC-CIT-fd279b78dd — class A: technical fact verifiable from source

**Citation of REQ-RTNCDE00-004 contradicted by the source**

- **What the COBOL appears to do:** Deterministic checks establish whether the cited statement or the cited line is wrong, from the stated values.
- **Objective technical fact:** yes — The source establishes whether the cited statement or the cited line is wrong, from the stated values (SOURCE_CITATION_CORRECTED).
- **Why the issue exists:** CONTRADICTED: the source contradicts the cited evidence: cited line 121 is outside SYS-PORTFOLIO-001-FIL-0052-STMT-000024 (lines 122-133) / REQUIRES_SME_DECISION: blocked by DR-DB2CONN-002 (open) / REQUIRES_SME_DECISION: blocked by RVW-REQ-RTNCDE00-004 (open)
- **Why human judgment is needed:** A technical reviewer must confirm the source fact and authorize the corresponding correction or acceptance; the runtime never applies it on its own.
- **Affected:** requirements REQ-RTNCDE00-004; data contracts none
- **Authorized roles:** business_sme

Source evidence:

`src/programs/batch/RTNCDE00.cbl` lines 119-135 (sha256 7cb951ea1f418c19…)

```cobol
  119            EXIT.
  120            
  121        P500-ANALYZE-CODES.
  122            EXEC SQL
  123                 SELECT COUNT(*),
  124                        MAX(RETURN_CODE),
  125                        MIN(RETURN_CODE)
  126                 INTO :RC-TOTAL-CODES,
  127                      :RC-MAX-CODE,
  128                      :RC-MIN-CODE
  129                 FROM RTNCODES
  130                 WHERE PROGRAM_ID = :RC-PROGRAM-ID
  131                   AND TIMESTAMP >= :RC-START-TIME
  132                   AND TIMESTAMP <= :RC-END-TIME
  133            END-EXEC.
  134            
  135            IF SQLCODE = 0
```

**Decision RVW-REQ-RTNCDE00-004** (review, derived, status open): requirement REQ-RTNCDE00-004 (RTNCDE00) is not approvable as drafted: CONTRADICTED: the source contradicts the cited evidence: cited line 121 is outside SYS-PORTFOLIO-001-FIL-0052-STMT-000024 (lines 122-133)

- `excluded_from_scope` — The affected requirement(s) (or, for a scope decision, the unit) leave the scope with the written justification. A unit another unit in scope depends on cannot be hidden this way. *Who:* business_sme.
- `resolved_requires_update` — The affected item stays blocked until its content changes (new content hash, e.g. an authorized correction or re-delivery); it is then re-evaluated. *Who:* business_sme.
- Resolution request: `forward/reports/step-5.5/resolution-requests/RVW-REQ-RTNCDE00-004.resolution-request.json`

## RC-EVD-af66b09e34 — class B: interpretation needing independent review

**requirement evidence of RTNCDE00 not established (unconfirmed_claim)**

- **What the COBOL appears to do:** Deterministic checks establish which cited facts the source supports.
- **Objective technical fact:** no — The source does not settle this (INSUFFICIENT_EVIDENCE).
- **Why the issue exists:** REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: stated values found in the program but not in the cited lines: F / REQUIRES_SME_DECISION: blocked by RVW-REQ-RTNCDE00-003 (open)
- **Why human judgment is needed:** The source does not establish business intent, and behaviour beyond the cited source text; that needs interpretation needing independent review.
- **Affected:** requirements REQ-RTNCDE00-003; data contracts none
- **Authorized roles:** business_sme

Source evidence:

`src/programs/batch/RTNCDE00.cbl` lines 68-81 (sha256 7cb951ea1f418c19…)

```cobol
   68            MOVE RC-NEW-CODE TO RC-CURRENT-CODE.
   69            
   70            EVALUATE RC-NEW-CODE
   71                WHEN 0
   72                     SET RC-STATUS-SUCCESS TO TRUE
   73                WHEN 1 THRU 4
   74                     SET RC-STATUS-WARNING TO TRUE
   75                WHEN 5 THRU 8
   76                     SET RC-STATUS-ERROR TO TRUE
   77                WHEN OTHER
   78                     SET RC-STATUS-SEVERE TO TRUE
   79            END-EVALUATE.
   80            
   81            MOVE 0 TO RC-RESPONSE-CODE.
```

**Decision RVW-REQ-RTNCDE00-003** (review, derived, status open): requirement REQ-RTNCDE00-003 (RTNCDE00) is not approvable as drafted: REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: stated values found in the program but not in the cited lines: F

- `excluded_from_scope` — The affected requirement(s) (or, for a scope decision, the unit) leave the scope with the written justification. A unit another unit in scope depends on cannot be hidden this way. *Who:* business_sme.
- `resolved_requires_update` — The affected item stays blocked until its content changes (new content hash, e.g. an authorized correction or re-delivery); it is then re-evaluated. *Who:* business_sme.
- `approved_exception` — Items that only lack evidence are accepted as they are by an exception approver. Never available for contradicted items. *Who:* exception_approver.
- Resolution request: `forward/reports/step-5.5/resolution-requests/RVW-REQ-RTNCDE00-003.resolution-request.json`

## RC-SRC-3b9f4685e9 — class D: architecture / technical decision for a technical authority

**CIRCULAR_COPY GAP-002: Copybook SQLCA includes itself (circular copy)**

- **What the COBOL appears to do:** Deterministic checks establish the member includes itself, so its layout cannot be expanded from the repository.
- **Objective technical fact:** yes — The source establishes the member includes itself, so its layout cannot be expanded from the repository (VERIFIED_DETERMINISTICALLY).
- **Why the issue exists:** CONTRADICTED: the source contradicts the cited evidence: cited line 121 is outside SYS-PORTFOLIO-001-FIL-0052-STMT-000024 (lines 122-133) / REQUIRES_SME_DECISION: blocked by DR-DB2CONN-002 (open) / REQUIRES_SME_DECISION: blocked by RVW-REQ-RTNCDE00-004 (open) / blocking decision open — Copybook SQLCA (src/copybook/db2/SQLCA.cpy) includes itself (EXEC SQL INCLUDE SQLCA at line 6) and defines only SQL-STATUS-CODES, with no SQLCODE or SQLERRMC field; SQLCODE/SQLERRMC therefore have no Field ID in 14 DB2 programs, including HISTLD00, RTNANA00, RTNCDE00, DB2CMT and DB2CONN. Which SQLCA / blocking decision open — Copybook SQLCA (SYS-PORTFOLIO-001-FIL-0017) line 6 contains 'EXEC SQL INCLUDE SQLCA END-EXEC', naming itself. The included SQL communication area (SQLCODE, SQLSTATE, SQLERRMC, ...) has no layout in any reverse artifact. How should the forward design obtain the SQLCA layout and the SQL
- **Why human judgment is needed:** The source does not establish which communication area the precompiler actually supplies; that needs architecture / technical decision for a technical authority.
- **Affected:** requirements REQ-RTNCDE00-001, REQ-RTNCDE00-004; data contracts none
- **Authorized roles:** technical_authority

Source evidence:

`src/programs/online/CURSMGR.cbl` lines 14-18 (sha256 5e367102d18d1775…)

```cobol
   14        WORKING-STORAGE SECTION.
   15        01  WS-DB2-AREA.
   16            EXEC SQL INCLUDE SQLCA END-EXEC.
   17            
   18        01  WS-CURSOR-STATS.
```

`src/programs/online/CURSMGR.cbl` lines 42-59 (sha256 5e367102d18d1775…)

```cobol
   42            
   43        PROCEDURE DIVISION USING CURSOR-REQUEST-AREA.
   44            EVALUATE TRUE
   45                WHEN CURS-DECLARE
   46                     PERFORM P100-DECLARE-CURSOR
   47                        THRU P100-EXIT
   48                WHEN CURS-OPEN
   49                     PERFORM P200-OPEN-CURSOR
   50                        THRU P200-EXIT
   51                WHEN CURS-FETCH
   52                     PERFORM P300-FETCH-DATA
   53                        THRU P300-EXIT
   54                WHEN CURS-CLOSE
   55                     PERFORM P400-CLOSE-CURSOR
   56                        THRU P400-EXIT
   57            END-EVALUATE.
   58            
   59            EXEC CICS RETURN END-EXEC.
```

`src/programs/common/DB2CMT.cbl` lines 79-86 (sha256 d753db038a2a0339…)

```cobol
   79            
   80        2000-COMMIT.
   81            IF LS-RECORDS-PROC >= LS-COMMIT-FREQ
   82            OR LS-FORCE-COMMIT
   83                PERFORM 2100-ISSUE-COMMIT
   84            END-IF
   85            .
   86            
```

`src/programs/common/DB2CMT.cbl` lines 107-111 (sha256 d753db038a2a0339…)

```cobol
  107            
  108            IF SQLCODE = 0
  109                ADD 1 TO WS-ROLLBACK-COUNT
  110                MOVE 0 TO LS-RETURN-CODE
  111            ELSE
```

`src/programs/common/DB2CMT.cbl` lines 125-129 (sha256 d753db038a2a0339…)

```cobol
  125            
  126            IF SQLCODE = 0
  127                ADD 1 TO WS-SAVEPOINT-COUNT
  128                MOVE 0 TO LS-RETURN-CODE
  129            ELSE
```

`src/programs/common/DB2CMT.cbl` lines 143-147 (sha256 d753db038a2a0339…)

```cobol
  143            
  144            IF SQLCODE = 0
  145                ADD 1 TO WS-ROLLBACK-COUNT
  146                MOVE 0 TO LS-RETURN-CODE
  147            ELSE
```

**Decision DR-DB2CONN-002** (technical, agent, status open): Copybook SQLCA (src/copybook/db2/SQLCA.cpy) includes itself (EXEC SQL INCLUDE SQLCA at line 6) and defines only SQL-STATUS-CODES, with no SQLCODE or SQLERRMC field; SQLCODE/SQLERRMC therefore have no Field ID in 14 DB2 programs, including HISTLD00, RTNANA00, RTNCDE00, DB2CMT and DB2CONN. Which SQLCA does the precompiler actually supply, and may the forward design assume the standard DB2 SQLCODE meaning (0 success, -803 duplicate key, negative values errors) used in these requirements?

- `resolved_no_change` — The drafted item stands; the decision stops blocking. Any missing source evidence on the item still has to be established separately. *Who:* technical_authority.
- `excluded_from_scope` — The affected requirement(s) (or, for a scope decision, the unit) leave the scope with the written justification. A unit another unit in scope depends on cannot be hidden this way. *Who:* technical_authority.
- `resolved_requires_update` — The affected item stays blocked until its content changes (new content hash, e.g. an authorized correction or re-delivery); it is then re-evaluated. *Who:* technical_authority.
- Resolution request: `forward/reports/step-5.5/resolution-requests/DR-DB2CONN-002.resolution-request.json`

**Decision DR-F2-0011-001** (data_layout, agent, status open): Copybook SQLCA (SYS-PORTFOLIO-001-FIL-0017) line 6 contains 'EXEC SQL INCLUDE SQLCA END-EXEC', naming itself. The included SQL communication area (SQLCODE, SQLSTATE, SQLERRMC, ...) has no layout in any reverse artifact. How should the forward design obtain the SQLCA layout and the SQLCODE/SQLSTATE semantics used by the 14 DB2 programs?

- `resolved_no_change` — The drafted item stands; the decision stops blocking. Any missing source evidence on the item still has to be established separately. *Who:* technical_authority.
- `excluded_from_scope` — The affected requirement(s) (or, for a scope decision, the unit) leave the scope with the written justification. A unit another unit in scope depends on cannot be hidden this way. *Who:* technical_authority.
- Resolution request: `forward/reports/step-5.5/resolution-requests/DR-F2-0011-001.resolution-request.json`

