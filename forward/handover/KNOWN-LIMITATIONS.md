# Known limitations

These are facts about the current state, not risks that might occur. The 569 open gap records in `forward/reports/step-23/master-gap-register.json` give the detail for every item; counts below are taken from that register.

## Engineering limitations

| Limitation | Extent | Owner role | Register |
|---|---|---|---|
| **Legacy equivalence not established** | No COBOL compiler or captured legacy runs: equivalence is `NOT_ESTABLISHED` for all 42 programs and 154 rules | QA / independent verification; Platform engineering | RCG-20 (MGR-0566) |
| **Missing source** | 267 SOURCE_MISSING records: missing COPY/INCLUDE members (RCG-03, 50), PERFORMed paragraphs missing from source (RCG-04, 93), names declared nowhere (RCG-05, 121), POSUPDT empty source (RCG-19, 3) | COBOL maintainer | category SOURCE_MISSING |
| **Source defects** | 21 records: statements invalid as written (RCG-10, 7), SELECT without FD or invalid file definitions (RCG-06, 13), unresolvable control flow (RCG-16, 1) | COBOL maintainer; RCG-16 needs an owner decision | category SOURCE_DEFECT |
| **DB2 and CICS** | 75 records need a DB2 runtime and precompiler (RCG-01); 44 need a CICS environment (RCG-02) | DB2 administrator, CICS administrator | category EXTERNAL_DEPENDENCY |
| **Platform services** | 12 legacy environment definitions (TIME STAMP, RANDOM, USER-ID); 2 platform utilities (CEE3ABD, ILBOABN0, DELAY, IDCAMS) | Platform engineering | RCG-08, RCG-09 |
| **Business decisions** | 108 records need a signed SME decision: rule interpretation (82), suspected logic defects (19), dead code (3), recursive PERFORM termination (2), undefined data conversions (2) | Business SME | category BUSINESS_DECISION_REQUIRED |
| **Unsupported COBOL semantics** | 6 records the reverse analysis or converter cannot support | Java engineering team | category UNSUPPORTED_COBOL_SEMANTICS |
| **Data layouts** | 4 record layouts not determinable as written; byte-level file behaviour unverified | Data architect | RCG-07 |
| **Incomplete Java coverage** | 39 of 42 programs PARTIAL; POSUPDT MISSING; 599 statements at explicit gaps; 12 JCL jobs not end-to-end tested | — | STEP-22 |
| **BMad live execution** | 0 live runs; 8 prerequisites unresolved (see BMAD-GOVERNANCE.md) | Security / authorization approver; Platform engineering | RCG-21 (MGR-0567), RCG-22 (MGR-0568) |
| **Ownership** | Owners are roles, not people; 28 records need an owner decision (OWNER_REVIEW_REQUIRED) | Project owner | ownership-matrix.json |

## Operational limitations

1. **Production readiness is undefined.** No production replacement criteria, cut-over plan, performance or operational acceptance exists.
2. **Recorded results, not live CI.** Reports and the dashboard show results recorded at a commit. The repository has no CI pipeline.
3. **Restricted source is required** for source readiness, conversion and the source-integrity checks. A pure Git checkout cannot run them (see [INSTALLATION-AND-RUNBOOK.md](INSTALLATION-AND-RUNBOOK.md), environments A/B/C).
4. **Resource-sensitive tests.** Under heavy machine load, a full `npm test` has twice timed out a `javac`/`java` subprocess (300 s limit). The affected suite passed on its own each time, and full reruns passed. No timeout was raised or test weakened.
5. **Dashboard verification scope.** Mermaid rendering was browser-verified for sample diagrams. Accessibility was verified structurally and by tests; no WCAG audit tool or screen reader was used.
6. **`recovery-manifest.js`.** This hash-only change-detection tool, unlike `backup.js`, has no dashboard exclusion. If re-run, it would hash the dashboard's installed dependencies. It is not part of the backup, it has no test, and STEP-25 left it unchanged.
7. **Third-party BMad.** The staged release is pinned but not installed or executed; its behaviour in this harness is untested live.
