# STEP 5.5 — G2 approval readiness, human decision workbench and first modernization scope

Run `FWD-20261031T172520Z-66b3`, baseline `352b97f0bbcbdb149c1118791aaabaa2e8e9972716bc77adc3a2f0644d24a068`, generated 2026-11-01T00:14:35.047Z by `workbench report`. Everything below is **preparation**: no decision was resolved, no correction applied, no authorization signed, no approval created, no source sent.

## 1. Candidate scopes

1. programs:RTNCDE00: 4 requirement(s), 3 unit(s) (2 shared dependencies), 5 blocking finding(s) from 3 root cause(s) [D:1 A:1 B:1], workload score 7. Suitable: an application function with source text and at least one source-verified requirement.
2. programs:PORTDEL: 6 requirement(s), 2 unit(s) (1 shared dependency), 8 blocking finding(s) from 6 root cause(s) [C:1 D:1 B:4], workload score 14.5. Suitable: an application function with source text and at least one source-verified requirement.
3. programs:RCVPRC00: 8 requirement(s), 6 unit(s) (5 shared dependencies), 9 blocking finding(s) from 6 root cause(s) [B:6], workload score 14.5. Suitable: an application function with source text and at least one source-verified requirement.

**Recommended first scope: `programs:RTNCDE00`.** programs:RTNCDE00: 4 requirement(s), 3 unit(s) (2 shared dependencies), 5 blocking finding(s) from 3 root cause(s) [D:1 A:1 B:1], workload score 7. Suitable: an application function with source text and at least one source-verified requirement. It is the meaningful program scope with the least weighted human work; 28 other program scope(s) were not recommended (templates, test tools, utilities, empty sources or no verified requirement). It is a proposal for human review, not an approval.

## 2. Scope coverage

- Units: RTNCDE00 (primary); shared dependencies: RTNCODE (copybook), SQLCA (copybook).
- Requirements: REQ-RTNCDE00-004 [CONTRADICTED], REQ-RTNCDE00-003 [REQUIRES_EVIDENCE], REQ-RTNCDE00-001 [REQUIRES_SME_DECISION], REQ-RTNCDE00-002 [VERIFIED].
- Business rules: BR-038 [VERIFIED], BR-039 [VERIFIED], BR-040 [VERIFIED], BR-041 [VERIFIED].
- Data contracts: 5; file/runtime contracts: 3.
- Scope digest `88d8562c1b30170f33446a43303d54d47fd102ec25c3d79249749d6dfd126f13`; readiness NOT_READY.

## 3. Root causes and decisions

| Root cause | Class | Title | Decisions in scope | Deterministic |
|---|---|---|---|---|
| RC-CIT-fd279b78dd | A | Citation of REQ-RTNCDE00-004 contradicted by the source | RVW-REQ-RTNCDE00-004 | SOURCE_CITATION_CORRECTED |
| RC-EVD-af66b09e34 | B | requirement evidence of RTNCDE00 not established (unconfirmed_claim) | RVW-REQ-RTNCDE00-003 | INSUFFICIENT_EVIDENCE |
| RC-SRC-3b9f4685e9 | D | CIRCULAR_COPY GAP-002: Copybook SQLCA includes itself (circular copy) | DR-DB2CONN-002, DR-F2-0011-001 | VERIFIED_DETERMINISTICALLY |

Blocking decisions (4): DR-DB2CONN-002 (technical), RVW-REQ-RTNCDE00-004 (review), RVW-REQ-RTNCDE00-003 (review), DR-F2-0011-001 (data_layout).

## 4. Evidence and citation problems

- requirement REQ-RTNCDE00-004: CONTRADICTED — CONTRADICTED: the source contradicts the cited evidence: cited line 121 is outside SYS-PORTFOLIO-001-FIL-0052-STMT-000024 (lines 122-133)
- requirement REQ-RTNCDE00-003: REQUIRES_EVIDENCE — REQUIRES_EVIDENCE: declared verified_from_source but not confirmed by the runtime: stated values found in the program but not in the cited lines: F
- requirement REQ-RTNCDE00-001: REQUIRES_SME_DECISION — REQUIRES_SME_DECISION: blocked by DR-DB2CONN-002 (open)

Citation corrections in scope: 1 (verified against current source now: 1; authorized: 0).
- RP-8d2dd33787 v1: REQ-RTNCDE00-004 /requirements/26/source_refs/0/line 121 → 122; original line `       P500-ANALYZE-CODES.`, proposed line `           EXEC SQL`; checks item_unchanged=ok, source:src/copybook/common/RTNCODE.cpy=ok, source:src/copybook/db2/SQLCA.cpy=ok, source:src/programs/batch/RTNCDE00.cbl=ok, rederived=ok; authorization NOT_AUTHORIZED via RVW-REQ-RTNCDE00-004.

## 5. Human review work

3 root cause(s), 4 decision(s); 13 ordered actions (1 done, 7 pending, 4 blocked). See `step-5.5/approval-operations-checklist.md`.

## 6. Trust

Status: **TRUST_NOT_CONFIGURED** (no trust store is configured (approval.trust_store is null and REVFORGE_APPROVAL_TRUST_STORE is not set)). Roles needed: business_sme missing, data_owner missing, exception_approver missing, requirements_approver missing, technical_authority missing.

## 7. OpenAI live pilot (prepared, not sent)

Status **LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED** — blocked by: network disabled (openai_verification.network_enabled=false); OPENAI_API_KEY not set; no trust anchor; no signed source-export authorization. 1 case(s) prepared from 1 unsettled eligible packet(s) in scope (of 1).

- OAV-EVD-af66b09e34 (missing_evidence, deterministic INSUFFICIENT_EVIDENCE): src/programs/batch/RTNCDE00.cbl 68-81; estimated ≤ 8032 input / ≤ 12000 output tokens, ≤ $0.68032.

Total upper bound: $0.68032 at the configured rates. Source-export authorization request: unsigned, `step-5.5/openai-pilot-authorization-request.json`.

## 8. G2 for this scope

Readiness **NOT_READY**, 3 unique root cause(s), 5 blocking finding(s), 4 blocking decision(s). G2 can pass: **no**.

- scope is NOT_READY: 5 blocking finding(s) from 3 root cause(s)
- TRUST_NOT_CONFIGURED: no usable trust anchor with the required roles
- no signed requirements approval has been imported for this (or any) scope

## Sealed records

| Record | SHA-256 |
|---|---|
| workflow/step55/scope-candidates-0002.json (scope-candidates) | `d726824b97894ef764d5479a00d41562f246569b9efc37a63e69142199844098` |
| workflow/step55/scope-evidence-package-0001.json (scope-evidence-package) | `0ee805f1f3484adba0cfe5e85aea52707b2ce2aa084636883fdfa39c8883512c` |
| workflow/step55/root-cause-review-queue-0001.json (root-cause-review-queue) | `5d1d6fc7755f32b84bd729e4d67cf86a3475b9ea646f8c4ce1c12f52fd52d6d2` |
| workflow/step55/decision-packets-0001.json (decision-packets) | `c210e203d390aba9ca21ecf457fb91cfbdaf225f790ade519cc1981757c0120a` |
| workflow/step55/correction-review-0001.json (correction-review) | `d9911134b8cab7cc969e51da532e9fb1a36a42eb321979699ddce11fb9da921f` |
| workflow/step55/trust-readiness-0002.json (trust-readiness) | `7e4dd36949466e49bf044318f404cd11a56cfd8d9a9f027b7302deb90893fbe9` |
| workflow/step55/openai-pilot-0002.json (openai-pilot) | `a436e4736865865aeb072a1d60fb2684963e23e6a44b61c157a94f51c15ebc41` |
| workflow/step55/scope-g2-readiness-0002.json (scope-g2-readiness) | `b2170523ee4400d15f3748a67f5672c520a2e46411c71302f2136b5211355dc8` |
| workflow/step55/approval-checklist-0001.json (approval-checklist) | `59e6f54226b6f6ba2854147bafb105e354134f917e4d804a6943e1cd2faf507b` |
