# REVFORGE: project overview

**Status at handover: CONDITIONAL ENGINEERING CLOSURE.**
- The engineering handover is complete: documentation, reports, dashboard, provenance and reproducibility checks.
- The modernization is **not production-ready**.
- **COBOL-to-Java behavioural equivalence has not been established.**

See [STEP-25-FINAL-HANDOVER-ASSESSMENT.md](../reports/STEP-25-FINAL-HANDOVER-ASSESSMENT.md).

## What REVFORGE does

REVFORGE is a harness for modernizing a legacy COBOL application with AI agents under strict evidence rules. It has four parts:

1. **Reverse engineering.** Seven Claude Code agents read the COBOL source. They produce a structural model, a data dictionary, control-flow logic, 154 business rules, 65 diagrams, a Business Requirements Document (BRD) and a gaps register. Every element carries a permanent source ID from a Neo4j registry, so every statement can be traced back to the exact COBOL line.
2. **Forward engineering.** A TypeScript runtime controls seven forward agents (F1–F7) through engineering gates G0–G8: requirements, data mapping, architecture, stories, implementation, independent testing and independent review. A local converter produced Java for 41 of the 42 programs, under historical, program-scoped local authorizations.
3. **Governance.** The BMad Method (6.12.4) is mandatory for new governed forward development. Six BMad workflows are bound to the forward agents. Enforcement is verified, but no BMad workflow has ever run: live execution is blocked by missing authorizations and infrastructure.
4. **Evidence and handover.** STEP-22 reconciles every reverse element with the Java, STEP-23 consolidates every open issue into a 569-record master gap register, and STEP-24 presents both in a read-only dashboard.

## Why COBOL modernization needs this

Legacy COBOL often carries decades of business rules with little documentation, missing source members and external dependencies (DB2, CICS, JCL). Rewriting by hand risks silently changing behaviour. REVFORGE reduces that risk in three ways:
- It refuses to invent behaviour: anything unknown becomes a recorded gap.
- It keeps every claim traceable to source evidence.
- It separates *structural mapping*, *passing source-derived tests* and *proven equivalence with the legacy system*. These are three different things, and only the first two have been achieved here, partially.

## What the work produced

| Area | Result | Evidence |
|---|---|---|
| Reverse artifacts | 11 artifacts in `output/`; 154 rules; 65 diagrams; BRD; 217 historical gaps | `output/`, `output/final_report/brd.md` |
| Java implementation | 41 of 42 programs have Java: 2 COMPLETE under the harness criteria (PORTREAD, PROGNAME), 39 PARTIAL, 1 MISSING (POSUPDT, empty source) | `forward/reports/step-22/program-reconciliation.json` |
| Business rules | 67 verified by passing source-derived Java tests; 15 verified up to a downstream gap; 40 unreachable; 32 blocked | `forward/reports/step-22/business-rule-reconciliation.json` |
| Open gaps | 569 records, all OPEN, in 23 root-cause groups and 5 remediation phases | `forward/reports/step-23/` |
| BMad | BMAD ENFORCEMENT VERIFIED — LIVE EXECUTION BLOCKED | `forward/reports/step-23/bmad-governance-blockers.json` |
| Dashboard | 12 pages over 137 hash-verified evidence files | `forward/dashboard/` |
| Tests | Forward harness, Java runtime (34), dashboard (40), browser smoke (20) | [TESTING-AND-VERIFICATION.md](TESTING-AND-VERIFICATION.md) |

## What it does not claim

- **No equivalence:** no program or rule has been compared with a run of the legacy COBOL. Equivalence is `NOT_ESTABLISHED` for all 42 programs and all 154 rules.
- **No production readiness:** production replacement criteria have not been defined, and DB2, CICS, platform services and business decisions are unresolved.
- **No BMad execution:** there are 0 live executions and 0 receipts.

## The handover package

| Document | For |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, eight diagrams, technology stack |
| [REVERSE-ENGINEERING.md](REVERSE-ENGINEERING.md) | The seven reverse agents and their outputs |
| [FORWARD-ENGINEERING.md](FORWARD-ENGINEERING.md) | Runtime, F1–F7, gates, local converter, coverage |
| [BMAD-GOVERNANCE.md](BMAD-GOVERNANCE.md) | BMad bindings, enforcement, blockers |
| [SOURCE-TRACEABILITY.md](SOURCE-TRACEABILITY.md) | Permanent IDs and integrity results |
| [TESTING-AND-VERIFICATION.md](TESTING-AND-VERIFICATION.md) | Test suites and the final regression |
| [GAP-AND-REMEDIATION-SUMMARY.md](GAP-AND-REMEDIATION-SUMMARY.md) | The 569 open records and the roadmap |
| [DASHBOARD-OPERATIONS.md](DASHBOARD-OPERATIONS.md) | Running and refreshing the dashboard |
| [INSTALLATION-AND-RUNBOOK.md](INSTALLATION-AND-RUNBOOK.md) | Setup, commands, backup and restore, troubleshooting |
| [SECURITY-AND-AUTHORIZATION.md](SECURITY-AND-AUTHORIZATION.md) | Restricted source, authorizations, secrets |
| [KNOWN-LIMITATIONS.md](KNOWN-LIMITATIONS.md) | Everything that is still missing or unproven |
| [FINAL-HANDOVER-CHECKLIST.md](FINAL-HANDOVER-CHECKLIST.md) | Item-by-item handover status |
| [HANDOVER-MANIFEST.json](HANDOVER-MANIFEST.json) | Hashes of every referenced report and artifact |
