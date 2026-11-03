# G2 readiness — programs:RTNCDE00

Readiness **NOT_READY**; G2 can pass: **false**. Scope digest `88d8562c1b30170f33446a43303d54d47fd102ec25c3d79249749d6dfd126f13`.

- Unique root causes: 3
- Blocking findings: 5
- Blocking decisions: DR-DB2CONN-002, DR-F2-0011-001, RVW-REQ-RTNCDE00-003, RVW-REQ-RTNCDE00-004
- Trust: TRUST_NOT_CONFIGURED

## Why G2 cannot pass

- scope is NOT_READY: 5 blocking finding(s) from 3 root cause(s)
- TRUST_NOT_CONFIGURED: no usable trust anchor with the required roles
- no signed requirements approval has been imported for this (or any) scope

## Failing checks

| Check | Blocking | Items |
|---|---|---|
| requirement_evidence | 3 | requirement:REQ-RTNCDE00-004 (CONTRADICTED), requirement:REQ-RTNCDE00-003 (REQUIRES_EVIDENCE), requirement:REQ-RTNCDE00-001 (REQUIRES_SME_DECISION) |
| contradicted_claims | 1 | requirement:REQ-RTNCDE00-004 (CONTRADICTED) |
| blocking_decisions | 2 | decision:technical:DR-DB2CONN-002 (REQUIRES_SME_DECISION), decision:data_layout:DR-F2-0011-001 (REQUIRES_SME_DECISION) |

## Source evidence issues

| Item | Outcome | Reason |
|---|---|---|
| requirement:REQ-RTNCDE00-004 | CONTRADICTED | CONTRADICTED: the source contradicts the cited evidence: cited line 121 is outside SYS-PORTFOLIO-001-FIL-0052-STMT-000024 (lines 122-133) |
| requirement:REQ-RTNCDE00-003 | REQUIRES_EVIDENCE | REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: stated values found in the program but not in the cited lines: F |
| requirement:REQ-RTNCDE00-001 | REQUIRES_SME_DECISION | REQUIRES_SME_DECISION: blocked by DR-DB2CONN-002 (open) |

## Trust roles

| Role | Covered | Signers |
|---|---|---|
| business_sme | no | — |
| data_owner | no | — |
| exception_approver | no | — |
| requirements_approver | no | — |
| technical_authority | no | — |
