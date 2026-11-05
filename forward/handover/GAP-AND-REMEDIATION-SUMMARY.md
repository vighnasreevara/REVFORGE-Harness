# Gap and remediation summary

The canonical register is `forward/reports/step-23/master-gap-register.json`, also available as `master-gap-register.csv` and on the dashboard at `#/gaps`. This page summarizes it; it does not replace it. STEP-25 re-validated it without changing it: 15 of 15 checks pass, as recorded in `forward/reports/step-25/gap-register-validation.json`.

## Inventory

| | Records |
|---|---|
| Forward gaps (from the Java conversion) | 391 |
| Reverse gaps kept from the reverse register | 174 |
| Verification and integration records | 4 |
| **Total, all OPEN** | **569** (MGR-0001 to MGR-0569, each exactly once) |

The 217 historical reverse gaps all have a disposition:
- 174 are kept as reverse records;
- 33 are represented by forward gap records at the same location;
- 10 are resolved and excluded.

No record has resolution evidence; nothing was marked resolved.

| Severity | Records | Priority | Records |
|---|---|---|---|
| critical | 8 | P0 | 8 |
| high | 109 | P1 | 109 |
| medium | 378 | P2 | 376 |
| low | 74 | P3 | 76 |

Severity is the original recorded value. Priority is derived from severity and category; for example, reverse documentation-quality items become P3. The two are kept as separate fields.

| Category | Records | Category | Records |
|---|---|---|---|
| Source missing | 267 | Source defect | 21 |
| External dependency | 133 | Unsupported COBOL semantics | 6 |
| Business decision required | 108 | Data layout | 4 |
| Reverse documentation quality | 27 | Legacy equivalence / governance / test coverage | 1 / 1 / 1 |

## Root causes and dependencies

- **Root-cause groups:** 23 (RCG-01 to RCG-23). Every record belongs to exactly one, and each group records its owner role, required resolution and closure evidence (`root-cause-groups.json`).
- **Dependency graph** (`dependency-graph.json`): 705 nodes and 877 edges.
  - Edges by confidence: 794 evidenced, 38 evidenced by text, 45 explicitly **hypothetical** (`LIKELY_DECLARES`).
  - No cycles.
  - 215 root blockers and 353 independent gaps.
- **Owners** are roles only (`ownership-matrix.json`). No person is named in the evidence; 28 records need an owner decision.

## Remediation roadmap

There are 5 phases, with no dates, budgets or resources assumed (`remediation-roadmap.json`). The phases hold **570 memberships for 569 unique records**, because MGR-0566 (legacy equivalence) belongs to both phase B and phase D.

| Phase | Groups | Memberships | Exit criterion (abridged) |
|---|---|---|---|
| A. Source and business decisions | RCG-03–07, 10–16, 19 | 400 | source-category readiness checks pass; the gaps disappear on reconversion |
| B. External environments | RCG-01, 02, 08, 09, 20 | 134 | captured runs for each external outcome; boundary gaps specified |
| C. Governed Java implementation | RCG-18, 21, 23 | 7 | BMad governance verdict BMAD_COMPLIANT for the scope; converter changes with regression tests |
| D. Independent verification | RCG-20, 22 | 2 | accepted F6 receipts; scenarios agree with legacy outputs |
| E. Readiness reassessment | RCG-17 | 27 | readiness, validation and reconciliation re-run; reverse diagrams regenerated |

## Rules for closing a record

A record is closed only by the evidence named in its own `closure_criteria` and `verification_method`, re-run through the engineering gates. Closing records is not a dashboard or documentation action. The dashboard is read-only, and STEP-25 changed no record.
