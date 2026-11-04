# STEP 23: Master Gap Register

**Status: COMPLETE.** The register holds 569 records. Every record is OPEN: STEP 23 consolidates, classifies and plans; it resolves nothing.

**COBOL-to-Java equivalence: not established.**

**BMad: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED.**

Machine-readable outputs are in `forward/reports/step-23/`, built by `forward/tools/step23-gaps.py`. The tool is deterministic: a second run on unchanged inputs produced identical hashes, recorded in `validation-results.json`.

## 1. Inventory

| Category | Records |
|---|---|
| forward_gap | 391 |
| reverse_gap | 174 |
| verification_or_integration | 4 |
| **Total** | **569** |

**Historical reverse gaps:** 217 historical reverse gaps = 10 resolved + 33 represented by forward gap records at the same location + 174 reverse records in the register. Each of the 217 has its disposition in `forward/reports/step-22/gap-reconciliation.json`.

Master IDs (MGR-NNNN) are those of the consolidated register, and every original gap ID is kept.

## 2. Classification

| Root-cause category | Records |
|---|---|
| AUTHORIZATION_OR_GOVERNANCE | 1 |
| BUSINESS_DECISION_REQUIRED | 108 |
| DATA_LAYOUT_GAP | 4 |
| EXTERNAL_DEPENDENCY | 133 |
| LEGACY_EQUIVALENCE_GAP | 1 |
| REVERSE_ARTIFACT_QUALITY | 27 |
| SOURCE_DEFECT | 21 |
| SOURCE_MISSING | 267 |
| TEST_COVERAGE_GAP | 1 |
| UNSUPPORTED_COBOL_SEMANTICS | 6 |

- **Severity (original):** {'critical': 8, 'high': 109, 'low': 74, 'medium': 378}.
- **Priority:** {'P0': 8, 'P1': 109, 'P2': 376, 'P3': 76}.
- **Priority rules:**
  - P0: critical severity.
  - P1: high severity (a rule site is blocked).
  - P2: medium severity.
  - P3: low severity, or reverse documentation only.
  - REVIEW: no recorded severity.

The categories map the repository dependency groups D1–D7 and the reverse gap types. REVERSE_ARTIFACT_QUALITY covers the reverse diagram-quality gaps that STEP 19 classed NOT_COMPARABLE.

## 3. Root-cause groups

| Group | Title | Category | Members | Owner |
|---|---|---|---|---|
| RCG-01 | DB2 runtime and precompiler not available | EXTERNAL_DEPENDENCY | 75 | DB2 administrator |
| RCG-02 | CICS environment not available | EXTERNAL_DEPENDENCY | 44 | CICS administrator |
| RCG-03 | COPY/INCLUDE members missing from the source library | SOURCE_MISSING | 50 | COBOL maintainer |
| RCG-04 | Paragraphs PERFORMed but missing from the source | SOURCE_MISSING | 93 | COBOL maintainer |
| RCG-05 | Names used but declared nowhere | SOURCE_MISSING | 121 | COBOL maintainer |
| RCG-06 | SELECT without FD / invalid file definitions | SOURCE_DEFECT | 13 | COBOL maintainer |
| RCG-07 | Record layouts not determinable as written | DATA_LAYOUT_GAP | 4 | Data architect |
| RCG-08 | Legacy environment definitions missing (TIME STAMP, RANDOM, USER-ID) | EXTERNAL_DEPENDENCY | 12 | Platform engineering |
| RCG-09 | Platform services and utilities (CEE3ABD, ILBOABN0, DELAY, IDCAMS) | EXTERNAL_DEPENDENCY | 2 | Platform engineering |
| RCG-10 | Statements invalid as written | SOURCE_DEFECT | 7 | COBOL maintainer |
| RCG-11 | Undefined data conversions need a business rule | BUSINESS_DECISION_REQUIRED | 2 | Business SME |
| RCG-12 | Rule interpretation needs SME confirmation | BUSINESS_DECISION_REQUIRED | 82 | Business SME |
| RCG-13 | Suspected logic defects in the source | BUSINESS_DECISION_REQUIRED | 19 | Business SME |
| RCG-14 | Recursive PERFORM termination | BUSINESS_DECISION_REQUIRED | 2 | Business SME |
| RCG-15 | Dead code | BUSINESS_DECISION_REQUIRED | 3 | Business SME |
| RCG-16 | Unresolvable control flow in the reverse analysis | SOURCE_DEFECT | 1 | OWNER_REVIEW_REQUIRED |
| RCG-17 | Reverse documentation quality (diagrams) | REVERSE_ARTIFACT_QUALITY | 27 | OWNER_REVIEW_REQUIRED |
| RCG-18 | Constructs the reverse analysis could not support | UNSUPPORTED_COBOL_SEMANTICS | 5 | Java engineering team |
| RCG-19 | Empty source (POSUPDT) | SOURCE_MISSING | 3 | COBOL maintainer |
| RCG-20 | Legacy runtime equivalence evidence | LEGACY_EQUIVALENCE_GAP | 1 | QA / independent verification |
| RCG-21 | BMad governance prerequisites | AUTHORIZATION_OR_GOVERNANCE | 1 | Security / authorization approver |
| RCG-22 | Independent F6 test evidence missing | TEST_COVERAGE_GAP | 1 | QA / independent verification |
| RCG-23 | Converter limitation (CALL argument of kind literal) | UNSUPPORTED_COBOL_SEMANTICS | 1 | Java engineering team |

Grouping never removes a record: the members sum to the register total.

## 4. Dependency graph

- **Size:** 705 nodes, 877 edges.
- **By relation:** {'BLOCKS': 1, 'BLOCKS_RULE_SITE': 42, 'ENDS_VERIFIED_PATH': 51, 'FAILS_READINESS': 161, 'LIKELY_DECLARES': 45, 'MAKES_RULE_UNREACHABLE': 38, 'PREREQUISITE_OF': 539}.
- **By confidence:** {'EVIDENCED': 794, 'EVIDENCED_BY_TEXT': 38, 'HYPOTHESIS': 45}.
- **Cycles:** 0.
- **Root blockers:** 215.
- **Independent gaps:** 353.

**HYPOTHESIS edges** link the missing members PORTREC, SQLPOS and DB2STAT to the data gaps of their including programs. They need confirmation once the members exist.

**EVIDENCED_BY_TEXT edges** link unreachable rules to the gap named in their STEP 17 evidence text.

A readable overview is in `dependency-graph.mmd`.

## 5. Program impact

| Program | Class | Readiness | Gaps | Critical | High | Direct readiness blockers |
|---|---|---|---|---|---|---|
| AUDPROC | PARTIAL | FAIL | 2 | 0 | 0 | 1 |
| BCHCTL00 | PARTIAL | FAIL | 15 | 0 | 3 | 11 |
| CKPRST | PARTIAL | FAIL | 7 | 0 | 1 | 0 |
| CURSMGR | PARTIAL | FAIL | 10 | 0 | 5 | 3 |
| DB2CMT | PARTIAL | FAIL | 9 | 0 | 2 | 0 |
| DB2CONN | PARTIAL | FAIL | 14 | 0 | 2 | 1 |
| DB2ERR | PARTIAL | FAIL | 8 | 0 | 0 | 1 |
| DB2HNDL | PARTIAL | FAIL | 14 | 0 | 1 | 0 |
| DB2ONLN | PARTIAL | FAIL | 10 | 0 | 2 | 0 |
| DB2RECV | PARTIAL | FAIL | 13 | 0 | 3 | 3 |
| DB2STAT | PARTIAL | FAIL | 13 | 0 | 1 | 2 |
| ERRHANDL | PARTIAL | FAIL | 5 | 0 | 3 | 1 |
| ERRHNDL | PARTIAL | FAIL | 20 | 0 | 2 | 9 |
| ERRPROC | PARTIAL | FAIL | 3 | 0 | 0 | 1 |
| FILEHNDL | PARTIAL | FAIL | 6 | 0 | 2 | 2 |
| HISTLD00 | PARTIAL | FAIL | 29 | 0 | 3 | 2 |
| INQHIST | PARTIAL | FAIL | 20 | 0 | 4 | 8 |
| INQONLN | PARTIAL | FAIL | 21 | 0 | 2 | 13 |
| INQPORT | PARTIAL | FAIL | 17 | 1 | 3 | 4 |
| PORTADD | PARTIAL | PASS | 12 | 0 | 3 | 0 |
| PORTDEL | PARTIAL | FAIL | 6 | 0 | 0 | 1 |
| PORTMSTR | PARTIAL | FAIL | 30 | 0 | 3 | 12 |
| PORTREAD | COMPLETE | PASS | 3 | 0 | 2 | 0 |
| PORTTEST | PARTIAL | PASS | 8 | 0 | 4 | 0 |
| PORTTRAN | PARTIAL | FAIL | 31 | 1 | 10 | 0 |
| PORTUPDT | PARTIAL | PASS | 3 | 0 | 0 | 0 |
| PORTVALD | PARTIAL | PASS | 5 | 0 | 3 | 0 |
| POSUPDT | MISSING | FAIL | 3 | 2 | 0 | 0 |
| PRCSEQ00 | PARTIAL | FAIL | 13 | 0 | 4 | 5 |
| PROGNAME | COMPLETE | PASS | 1 | 0 | 0 | 0 |
| RCVPRC00 | PARTIAL | FAIL | 4 | 0 | 1 | 1 |
| RPTAUD00 | PARTIAL | FAIL | 18 | 0 | 2 | 10 |
| RPTPOS00 | PARTIAL | FAIL | 21 | 0 | 4 | 7 |
| RPTSTA00 | PARTIAL | FAIL | 21 | 1 | 2 | 5 |
| RTNANA00 | PARTIAL | FAIL | 7 | 0 | 5 | 0 |
| RTNCDE00 | PARTIAL | FAIL | 5 | 0 | 2 | 0 |
| SECMGR | PARTIAL | FAIL | 9 | 0 | 4 | 3 |
| TSTGEN00 | PARTIAL | FAIL | 19 | 0 | 3 | 10 |
| TSTVAL00 | PARTIAL | FAIL | 19 | 0 | 4 | 7 |
| UTLMNT00 | PARTIAL | FAIL | 20 | 0 | 3 | 11 |
| UTLMON00 | PARTIAL | FAIL | 28 | 1 | 4 | 16 |
| UTLVAL00 | PARTIAL | FAIL | 22 | 0 | 3 | 11 |

Readiness: 6 of 42 programs pass. Resolving one gap does not by itself make a program ready, because readiness re-runs every check.

## 6. Business-rule impact

**Statuses (unchanged):** {'BLOCKED': 32, 'IMPLEMENTED_NOT_EXERCISED': 40, 'IMPLEMENTED_VERIFIED': 67, 'IMPLEMENTED_VERIFIED_TO_GAP': 15}.

| Measure | Rules |
|---|---|
| Linked to at least one gap | 130 |
| Blocked by missing implementation | 7 |
| Affected by missing or defective source | 53 |
| Requiring a business decision | 93 |
| Needing an external environment | 29 |
| Awaiting legacy equivalence | all 154 |

## 7. Ownership

| Role | Gaps |
|---|---|
| Business SME | 108 |
| CICS administrator | 44 |
| COBOL maintainer | 287 |
| DB2 administrator | 75 |
| Data architect | 4 |
| Java engineering team | 6 |
| OWNER_REVIEW_REQUIRED | 28 |
| Platform engineering | 14 |
| QA / independent verification | 2 |
| Security / authorization approver | 1 |

All ownership is role-based; no person is named.

## 8. BMad governance blockers

Status: BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED. Preflight: BPF-0013.

| Check | Detail |
|---|---|
| g2_exact_scope | G2 has not passed on the current baseline / G2 re-evaluated now: UNVERIFIED — G2 not approved for scope application: NOT_READY (417 blocking finding(s)); failing checks: canonical_ |
| workflow_state | workflow state is REQUIREMENTS_DRAFTED; BMAD-PRD is allowed only in REQUIREMENTS_APPROVED, ARCHITECTURE_DRAFTED, ARCHITECTURE_APPROVED, STORIES_DRAFTED, STORIES_APPROVED |
| provider_authorization | no valid signed disclosure authorization for anthropic/claude-code-cli, scope programs:PORTREAD, workflow bmad-prd (0 disclosure record(s) considered); 0 OpenAI source-export autho |
| source_hashes_current | no authorization to compare source hashes against |
| authorized_content_only | 2 file(s) would be exposed and none is authorized |
| runtime_execution_authorization | bindings.json live_execution.requested is false |
| limits | no authorized limits (cost, files, bytes, runs) |
| workspace_manifest | no minimal workspace can be planned without an authorization naming its files |
| network_isolation | default-deny verified (no route, no DNS); no verified provider-egress component exists, so a LIVE run could not reach the provider without weakening the boundary |
| runner_inside_boundary | Claude Code and Node are not installed inside the WSL2 environment: the runner cannot run inside the boundary |
| enforceable_launch_boundary | not enforceable for LIVE: network: the tested boundary has no network at all; a LIVE run needs a verified provider-egress component (allowlist proxy outside the namespace), which d |
| f6_independent_evidence | no accepted F6 receipt for PORTREAD (BGR-0004) |

**Disclosure request** ADA-8154d6398d4d: unsigned, expires 2026-11-06T20:45:24.374Z. The expiry is time-dependent: re-check it at use.

## 9. Remediation roadmap

No dates, budgets or resources are assumed.

| Phase | Title | Gaps | Roles | Exit criteria |
|---|---|---|---|---|
| A | Source and business decisions | 400 | Business SME, COBOL maintainer, Data architect, OWNER_REVIEW_REQUIRED | readiness re-run shows the source-category checks passing for the affected programs; the corresponding gaps disappear on reconversion |
| B | External environments | 134 | CICS administrator, DB2 administrator, Platform engineering, QA / independent verification | captured runs exist for each external outcome; boundary gaps have specifications |
| C | Governed Java implementation | 7 | Java engineering team, Security / authorization approver | bmad governance verdict BMAD_COMPLIANT for the scope; converter changes with regression tests |
| D | Independent verification | 2 | QA / independent verification | accepted F6 receipts; scenarios agree with legacy outputs |
| E | Readiness reassessment | 27 | OWNER_REVIEW_REQUIRED | readiness, validation and reconciliation re-run; reverse diagrams regenerated; remaining gaps re-registered |

## 10. Regression (sequential)

| Command | Exit | Result |
|---|---|---|
| `python tools/step23-gaps.py` | 0 | STEP 23 validation: OK |
| `parse every reports/step-23 JSON file` | 0 | 12 JSON files parse |
| `git status --short (non STEP-23 entries)` | 0 | 0 other modified/untracked entries |
| `npm run build` | 0 | TypeScript build |
| `node dist/runtime/src/cli.js doctor` | 0 | FAIL checks: 0; OK checks: 24 |
| `node dist/runtime/src/cli.js sync-agents --check` | 0 | entries not in sync: 0 |
| `node dist/runtime/src/cli.js bmad doctor` | 0 | bmad doctor: OK — bmad-method@6.12.4 staged; not installed in the repository (isolated executor installation: bmad executor doctor) |
| `node dist/runtime/src/cli.js bmad governance --scope programs:PORTREAD` | 3 | programs:PORTREAD: BMAD_BLOCKED (BMad is mandatory for governed runs) |
| `java revforge.cobol.testing.RuntimeTests` | 0 | SUMMARY/34/0/0 |
| `npm test` | 0 | ℹ tests 412 ℹ pass 412 ℹ fail 0 ℹ skipped 0  |
| `python tools/step23-gaps.py (second run, report includes the regression)` | 0 | STEP 23 validation: OK |

## 11. Validation

| Check | OK | Detail |
|---|---|---|
| record_count | True | 569 canonical records; consolidated register 569 |
| unique_master_ids | True | 569 unique |
| unique_original_ids | True | original identities appear once |
| inventory_split | True | {'forward_gap': 391, 'reverse_gap': 174, 'verification_or_integration': 4} |
| reverse_217_dispositions | True | {'REVERSE_RECORD_IN_REGISTER': 174, 'REPRESENTED_BY_FORWARD_GAP_RECORDS': 33, 'RESOLVED (excluded from the register)': 10} |
| represented_reverse_traceable | True | 33 reverse gaps point at existing forward records |
| retained_reverse_present | True | 174 retained reverse records |
| forward_ids_exist | True | every forward record resolves to a pilot-result gap |
| source_references | True | every record has a source reference |
| every_record_grouped_once | True | group memberships sum to the record count |
| owners_present | True | 28 OWNER_REVIEW_REQUIRED |
| actions_and_closure | True | every record has an action, a verification method and a closure criterion |
| priorities_justified | True | {'P2': 376, 'P1': 109, 'P0': 8, 'P3': 76} |
| graph_references_valid | True | 877 edges over 705 nodes |
| graph_cycles | True | 0 cycle(s) |
| rule_ids_valid | True | every linked rule exists among the 154 |
| programs_valid | True | every affected program exists among the 42 |
| diagrams_valid | True | every affected diagram exists among the 65 |
| rule_status_unchanged | True | STEP 22 rule statuses unchanged |
| roadmap_covers_groups | True | every root-cause group is in a phase |
| dashboard_consistent | True | dashboard denominators match the register |
| csv_rows | True | 569 CSV rows |
