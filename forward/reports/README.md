# Forward-engineering reports: catalog

This folder holds the reports and machine-readable evidence produced while the COBOL application was modernized. Most of it is **historical evidence**: it records what was found, run and decided at each development STEP, and it is never rewritten. Many folders are still named after the STEP that produced them (`step-4.5/`, `step-22/` …). Use this catalog, or the topic pages, to find a report by what it covers.

**Navigation only.** This catalog and the [`by-topic/`](by-topic/) pages only describe and link. They hold no results of their own and duplicate no data. Where they differ from a linked report, the report is authoritative.

## Find reports by topic

| Topic page | Answers |
|---|---|
| [Source integrity and traceability](by-topic/source-integrity-and-traceability.md) | Is the evidence tied to the exact COBOL source, reverse artifacts and repository state? Does it trace to the permanent source IDs? |
| [Reverse–forward reconciliation](by-topic/reverse-forward-reconciliation.md) | For each reverse-engineered element, what exists in Java, and how was it verified? |
| [Business-rule verification](by-topic/business-rule-verification.md) | Is each business rule implemented and tested? |
| [Requirements evidence and G2 approval](by-topic/requirements-evidence-and-g2-approval.md) | How were requirements checked against the source? What blocks G2, and what must a human decide or sign? |
| [Independent AI verification](by-topic/independent-ai-verification.md) | How is OpenAI verification gated, and what has run? |
| [BMad governance and execution](by-topic/bmad-governance-and-execution.md) | How is BMad staged, bound and enforced? What blocks live execution? |
| [COBOL-to-Java conversion](by-topic/cobol-to-java-conversion.md) | How was the code converted, what was generated, and how complete is it? |
| [Backup and recovery](by-topic/backup-and-recovery.md) | Can the project be backed up and restored, and was each restore verified? |
| [Master gap register](by-topic/master-gap-register.md) | What is unresolved, why, who owns it, and in what order should it be remediated? |
| [Dashboard validation](by-topic/dashboard-validation.md) | Does the dashboard show only verified evidence, with metrics that agree with it? |
| [Engineering handover and quality](by-topic/engineering-handover-and-quality.md) | What was handed over, under which conditions, and what was verified? |

**Record types used below:**
- **Historical:** a record of a past STEP. It is never edited, moved or renamed.
- **Historical, hash-bound:** historical, and also recorded by SHA-256 in [`../handover/HANDOVER-MANIFEST.json`](../handover/HANDOVER-MANIFEST.json), the dashboard evidence manifest or `step-22/source-integrity.json`. Changing a byte breaks a check.
- **Living:** a current-state report that a runtime command overwrites when it runs again.

## Report documents

| Report | Descriptive name | Responsibility | Topic | Record type | Path used by |
|---|---|---|---|---|---|
| [STEP-3.5-REPORT.md](STEP-3.5-REPORT.md) | agent deliverable defect remediation | per-ID reconciliation of agent deliverables, independent source verification, versioned corrections | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | — |
| [STEP-4.5-REPORT.md](STEP-4.5-REPORT.md) | G2 blocker root causes and deterministic verification | blocker counts, root causes, deterministic COBOL verification, remediation proposals | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | `runtime/src/commands/verification.ts` (writes it) |
| [STEP-5-REPORT.md](STEP-5-REPORT.md) | OpenAI semantic verification boundary | the verification pipeline and its authorization boundary; offline and mock execution only | [AI verification](by-topic/independent-ai-verification.md) | Historical | — |
| [STEP-5.5-REPORT.md](STEP-5.5-REPORT.md) | G2 decision workbench and first scope | scope candidates, decision packets, trust readiness, the first-scope recommendation | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | `runtime/src/commands/workbench.ts` (writes it) |
| [STEP-6-REPORT.md](STEP-6-REPORT.md) | BMad release staging and adapter | the pinned BMad release, bindings, eligibility, the adapter | [BMad](by-topic/bmad-governance-and-execution.md) | Historical | — |
| [STEP-7-REPORT.md](STEP-7-REPORT.md) | scope reconciliation, G3/G4 gates and BMad executor | design approval gates and the isolated BMad executor | [BMad](by-topic/bmad-governance-and-execution.md) | Historical | — |
| [STEP-8-REPORT.md](STEP-8-REPORT.md) | trusted decisions and G2 unblocking | trusted decision operations, provider-specific AI authorization, the RTNCDE00 G2 checklist | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | — |
| [STEP-9-REPORT.md](STEP-9-REPORT.md) | COBOL evidence verification and execution isolation | dependency-aware source-context verification; Claude/BMad process isolation | [source integrity](by-topic/source-integrity-and-traceability.md) | Historical | — |
| [STEP-10-REPORT.md](STEP-10-REPORT.md) | evidence adjudication and RTNCDE00 approval readiness | adjudicated evidence, the review package, the first recoverable backup | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | — |
| [STEP-11-REPORT.md](STEP-11-REPORT.md) | architecture readiness and synthetic conversion pilot | the architecture inventory, the RTNCDE00 plan, the isolated synthetic pilot, recovery completeness | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | — |
| [STEP-12-REPORT.md](STEP-12-REPORT.md) | RTNCDE00 pilot scope and behaviour classification | semantic dependencies, behaviour classification, the verified scope | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | — |
| [STEP-13-REPORT.md](STEP-13-REPORT.md) | scoped approval of verified behaviour | typed behaviour scopes, review packages, approval prerequisites | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | — |
| [STEP-14-REPORT.md](STEP-14-REPORT.md) | source readiness and conversion prioritisation | the two engineering gates; PORTVALD selected and prepared | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | — |
| [STEP-15-REPORT.md](STEP-15-REPORT.md) | local converter completion | the converter extended and proven on synthetic programs | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | — |
| [STEP-16-REPORT.md](STEP-16-REPORT.md) | first real generation (PORTVALD) | program-scoped authorization, generation, compilation, test review | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | — |
| [STEP-17-FINAL-REPORT.md](STEP-17-FINAL-REPORT.md) | full-application conversion | the integrated Java application and what was not converted | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | `runtime/src/pilot/app-integrate.ts` (names it) |
| [STEP-17-FUNCTIONAL-ASSESSMENT.md](STEP-17-FUNCTIONAL-ASSESSMENT.md) | functional completeness assessment | rule-level test status after conversion | [business rules](by-topic/business-rule-verification.md) | Historical | — |
| [STEP-20-REMEDIATION-ASSESSMENT.md](STEP-20-REMEDIATION-ASSESSMENT.md) | gap remediation and converter improvements | converter defects fixed, readiness before and after, BMad preflight | [conversion](by-topic/cobol-to-java-conversion.md) | Historical, hash-bound | handover manifest; `tools/step20-report.py`, `reverse-forward-report.py`, `step25-final.py` |
| [STEP-21-BMAD-INTEGRATION-ASSESSMENT.md](STEP-21-BMAD-INTEGRATION-ASSESSMENT.md) | mandatory BMad governance and PORTREAD pilot | enforcement, the governed dispatcher, receipt counting, the LIVE gate | [BMad](by-topic/bmad-governance-and-execution.md) | Historical, hash-bound | handover manifest; `tools/step21-report.py`, `step25-final.py` |
| [STEP-22-FINAL-RECONCILIATION.md](STEP-22-FINAL-RECONCILIATION.md) | final reverse–forward reconciliation | the authoritative element-by-element reconciliation and source hashes | [reconciliation](by-topic/reverse-forward-reconciliation.md) | Historical, hash-bound | dashboard Handover page; handover manifest; `tools/step22-final.py`, `step25-final.py` |
| [STEP-23-MASTER-GAP-REGISTER.md](STEP-23-MASTER-GAP-REGISTER.md) | master gap register | consolidation, root causes, impact, ownership, the roadmap | [gap register](by-topic/master-gap-register.md) | Historical, hash-bound | dashboard Handover page; handover manifest; `tools/step23-gaps.py`, `step25-final.py` |
| [STEP-24-DASHBOARD-ASSESSMENT.md](STEP-24-DASHBOARD-ASSESSMENT.md) | dashboard assessment | dashboard architecture, acceptance, metric validation, tests | [dashboard](by-topic/dashboard-validation.md) | Historical, hash-bound | handover manifest; `handover/DASHBOARD-OPERATIONS.md`; `tools/step25-final.py` |
| [STEP-25-FINAL-HANDOVER-ASSESSMENT.md](STEP-25-FINAL-HANDOVER-ASSESSMENT.md) | final handover assessment | conditional engineering closure, quality gates, provenance | [handover](by-topic/engineering-handover-and-quality.md) | Historical, hash-bound | CI integrity job; handover manifest and checklist; `tools/step25-final.py` |
| [REVERSE-FORWARD-RECONCILIATION.md](REVERSE-FORWARD-RECONCILIATION.md) | first reverse–forward reconciliation | the first reconciliation of reverse artifacts against the Java application | [reconciliation](by-topic/reverse-forward-reconciliation.md) | Historical | `tools/reverse-forward-report.py` (writes it) |
| [BMAD-END-TO-END-INTEGRATION-ASSESSMENT.md](BMAD-END-TO-END-INTEGRATION-ASSESSMENT.md) | BMad end-to-end enforcement verification | the final BMad classification, the bypass audit, the lifecycle mapping | [BMad](by-topic/bmad-governance-and-execution.md) | Historical, hash-bound | dashboard Handover page; handover manifest; `tools/bmad-e2e-report.py`, `step25-final.py` |
| [GIT-REGRESSION-STABILIZATION.md](GIT-REGRESSION-STABILIZATION.md) | Git tracking and regression stabilization | the tracking policy, fresh-clone results, backup compatibility | [source integrity](by-topic/source-integrity-and-traceability.md) | Historical, hash-bound | dashboard Handover page; handover manifest; `tools/git-stabilization-report.py`, `bmad-e2e-report.py`, `step25-final.py` |
| [POST-HANDOVER-QUALITY-REVIEW.md](POST-HANDOVER-QUALITY-REVIEW.md) | post-handover quality review | the dashboard fail-closed fixes, the CI, verification | [handover](by-topic/engineering-handover-and-quality.md) | Historical | — |
| [G2-READINESS-REPORT.md](G2-READINESS-REPORT.md) | G2 readiness and blockers (current) | G2 readiness of the real run | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Living (`workflow g2 report`) | `docs/HUMAN-APPROVAL-OPERATIONS.md` |
| [APPLICATION-MODERNIZATION-STATUS.md](APPLICATION-MODERNIZATION-STATUS.md) | application modernization status (current) | per-program conversion status | [conversion](by-topic/cobol-to-java-conversion.md) | Living (`pilot`) | `runtime/src/commands/pilot.ts` (writes it) |
| [openai-verification-report.md](openai-verification-report.md) and [.json](openai-verification-report.json) | OpenAI verification status (current) | the provider, model and authorization state | [AI verification](by-topic/independent-ai-verification.md) | Living (`openai`) | `runtime/src/commands/openai.ts` (writes it) |
| [bmad-integration-report.md](bmad-integration-report.md) and [.json](bmad-integration-report.json) | BMad integration status (current) | the staged and installed state, record integrity | [BMad](by-topic/bmad-governance-and-execution.md) | Living (`bmad`) | `runtime/src/commands/bmad.ts` (writes it) |
| [bmad-executor-report.json](bmad-executor-report.json) | BMad executor status (current) | the executor state | [BMad](by-topic/bmad-governance-and-execution.md) | Living (`bmad`) | `runtime/src/commands/bmad.ts` (writes it) |

## Evidence folders

| Folder | Descriptive name | Contains | Topic | Record type | Path used by |
|---|---|---|---|---|---|
| [`step-4.5/`](step-4.5/) | G2 blocker root-cause evidence | blocker-count audit, root-cause registry, deterministic verification, decision and OpenAI queues, remediation proposals, scope readiness | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | `runtime/src/commands/verification.ts` |
| [`step-5.5/`](step-5.5/) | G2 decision workbench evidence | scope candidates and evidence package, decision packets, correction review, trust readiness, OpenAI pilot preparation, resolution requests | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | `runtime/src/commands/workbench.ts` |
| [`step-8/`](step-8/) | trusted decisions and G2 operations evidence | RTNCDE00 G2 checklist, approval readiness, decision dossiers, remediation review, BMad preflight, resolution requests | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | `runtime/src/commands/operations.ts` |
| [`step-9/`](step-9/) | COBOL context verification and isolation evidence | context verification reports (program and application), approval readiness, isolation assessment and tests, recovery manifest | [source integrity](by-topic/source-integrity-and-traceability.md) | Historical | `runtime/src/commands/bmad.ts`, `context.ts`; `tools/recovery-manifest.js`; `tests/dashboard-backup-exclusion-policy.test.ts` |
| [`step-10/`](step-10/) | evidence adjudication and RTNCDE00 review package | evidence adjudication, decision facts, review package, resolution requests, backup and restore test | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | `runtime/src/commands/context.ts`, `operations.ts` |
| [`step-11/`](step-11/) | architecture inventory and synthetic pilot | architecture inventory, RTNCDE00 plan and preview, synthetic pilot result, recovery checks, review package | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | `runtime/src/commands/pilot.ts` |
| [`step-12/`](step-12/) | RTNCDE00 pilot scope evidence | behaviour classification, semantic dependencies, verified scope, P200 Java design and proposed tests, approval checklist, recovery checks | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | `runtime/src/commands/context.ts`, `pilot.ts` |
| [`step-13/`](step-13/) | scoped behaviour approval evidence | typed behaviour scopes, review packages, P200 approval prerequisites and gap handoff | [requirements](by-topic/requirements-evidence-and-g2-approval.md) | Historical | `tools/git-stabilization-report.py` |
| [`step-14/`](step-14/) | PORTVALD source readiness | conversion candidates, PORTVALD spec and test cases, source readiness, recovery checks | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | — |
| [`step-15/`](step-15/) | local converter completion evidence | application status, synthetic pilot results, recovery checks | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | `runtime/src/commands/pilot.ts` |
| [`step-16/`](step-16/) | PORTVALD generation review | application status, PORTVALD review | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | — |
| [`step-17/`](step-17/) | full-application conversion status | application status, business-rule reconciliation | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | `tools/reverse-forward-reconcile.py`, `step22-final.py`, `step23-gaps.py`, `step25-final.py` |
| [`step-20/`](step-20/) | gap remediation and readiness runs | converter defects, implementation changes, rule and gap updates, per-program readiness before and after, BMad preflight captures, STEP-19 reconciliation baseline | [conversion](by-topic/cobol-to-java-conversion.md) | Historical | CI JSON check (`readiness-before/CURSMGR.json` by SHA); `tools/step20-report.py`, `step21-report.py`, `reverse-forward-report.py` |
| [`step-21/`](step-21/) | mandatory BMad governance evidence | installation audit, workflow mapping, receipt validation, blockers, environment readiness, PORTREAD pilot and unsigned authorization request, regression | [BMad](by-topic/bmad-governance-and-execution.md) | Historical | `tools/step21-report.py`, `step23-gaps.py`, `step25-final.py` |
| [`step-22/`](step-22/) | final reverse–forward reconciliation | per-element reconciliations, source integrity, verification results, readiness, reconcile runs, an interrupted run kept as a record | [reconciliation](by-topic/reverse-forward-reconciliation.md) | Historical, hash-bound | dashboard (`evidence-sources.json`, `evidence-report.ts`, `model.ts`, pages); handover documents and manifest; `tools/step22-final.py`, `step23-gaps.py`, `step25-final.py` |
| [`step-23/`](step-23/) | master gap register | the register (JSON, CSV), summaries, root causes, impacts, dependency graph, ownership, roadmap, validation | [gap register](by-topic/master-gap-register.md) | Historical, hash-bound | dashboard (`evidence-sources.json`, pages); handover documents and manifest; `tests/dashboard-backup-exclusion-policy.test.ts`; `tools/step23-gaps.py`, `step25-final.py` |
| [`step-24/`](step-24/) | dashboard validation | metric validation, evidence mapping, architecture, page inventory, build, test, smoke, accessibility and performance results | [dashboard](by-topic/dashboard-validation.md) | Historical, hash-bound | `dashboard/scripts/evidence-report.ts`; handover documents and manifest; `tools/step25-final.py` |
| [`step-25/`](step-25/) | final handover validation | quality gates, regression, clean-clone runs, integrity, coverage, gap-register, BMad and dashboard validation, snapshots | [handover](by-topic/engineering-handover-and-quality.md) | Historical, hash-bound | CI workflow; handover documents and manifest; `tools/step25-final.py` |
| [`bmad-end-to-end/`](bmad-end-to-end/) | BMad end-to-end integration evidence | compliance, bypass and architecture audits, lifecycle mapping, live runner status, PORTREAD governed run, reconcile re-run, regression | [BMad](by-topic/bmad-governance-and-execution.md) | Historical, hash-bound | dashboard (`evidence-sources.json`, BMad page); handover manifest; `tools/bmad-e2e-report.py`, `step25-final.py` |
| [`git-stabilization/`](git-stabilization/) | Git tracking and regression stabilization evidence | tracking policy, integrity, fresh-clone runs and failures, backup compatibility and restore, test changes | [source integrity](by-topic/source-integrity-and-traceability.md) | Historical | `tools/git-stabilization-report.py` |
| [`reverse-forward/`](reverse-forward/) | first reverse–forward reconciliation evidence | per-element mappings, gap reconciliation, summary, verification runs | [reconciliation](by-topic/reverse-forward-reconciliation.md) | Historical | `tools/reverse-forward-reconcile.py`, `reverse-forward-report.py`, `step20-report.py`, `step21-report.py` |

## Why the folders keep their STEP names

The descriptive names above are **labels, not new paths**. No report or folder was moved or renamed, for these reasons:
- **The runtime writes into them.** The forward runtime commands write into `step-4.5`, `step-5.5`, `step-8`, `step-9`, `step-10`, `step-11`, `step-12` and `step-15`.
- **Tools and CI read them.** The Python audit tools, the dashboard evidence pipeline, the CI workflow and the tests read many of these paths directly.
- **Hashes are recorded by path.** The handover manifest, the dashboard evidence manifest and `step-22/source-integrity.json` record SHA-256 hashes by path.
- **Reports cite each other.** The historical reports cite each other's paths, and they must stay readable as written.

A rename would break every one of these links and the audit trail. The topic pages give each report a descriptive entry point instead.

**Opening the reports in VS Code:** an optional workspace, [`../docs/revforge-reports.code-workspace`](../docs/revforge-reports.code-workspace), adds *Reports by topic* as a separate Explorer root. It also opens historical evidence read-only in the editor. It hides nothing, changes no runtime behaviour, and is used only when you open it (**File → Open Workspace from File…**).

## Forward planning run reports (STEP 1)

`plan` writes one run directory per execution under `forward/runs/<run-id>/` (Git-ignored). Run IDs have the form `FWD-<UTC timestamp>-<4 hex>`, and `forward/runs/LATEST` names the most recent run. Every JSON report is validated against its contract in `forward/contracts/output/` before it is written. If a report does not satisfy its contract, the run stops and the report is not written.

All STEP 1 reports have `status: "draft"`. They are planning material derived from the reverse-engineering artifacts. They have not been reviewed by an SME, and the forward runtime performs no live Neo4j verification.

| File | Contract | Content |
|---|---|---|
| `baseline_manifest.json` | `output/baseline-manifest` | Git branch, commit and dirty state; SHA-256, agent version and run IDs of every reverse input; combined hashes of the per-program logic and raw-structure files; the `source_runs` table that run-local IDs point to; COBOL source availability; Neo4j verification results recorded upstream, attributed and never presented as live checks. |
| `program_inventory.json` | `output/program-inventory` | Programs discovered from the inventory and joined by File ID with parser, logic, rules, gaps and diagrams; copybooks and other include members; JCL jobs; dependency edges; unresolved edges; coverage mismatches. |
| `evidence_packets/<FILE_ID>__<PROGRAM>.json` | `output/evidence-packet` | One per selected program: permanent identity, parse and logic status, dependencies, data records, implemented rules and rules in scope through a copybook (each with confidence, SME flag and evidence class), direct and inherited gaps with their expanded item IDs, supporting diagrams, and a readiness assessment. |
| `rule_summary.json` | `output/rule-summary` | Every business rule as a run-local reference, with counts by category, confidence and evidence class. |
| `gap_summary.json` | `output/gap-summary` | Every gap, with each grouped gap expanded into items (`GAP-NNN#NN`); the permanent and catalogue IDs extracted from each item; a reference status (`permanent_id`, `name_or_line_only`, `catalogue_only`, `none`); and the assumptions. |
| `decision_backlog.json` | `output/decision-backlog` | Open decisions (`DEC-NNNN`, local to the run): source access, gap resolutions (critical and high, or SME-flagged), rule confirmations and assumption confirmations. Decisions for critical gaps are blocking. |
| `readiness_report.json` / `.md` | `output/readiness-report` | Overall readiness (`not_ready`, `conditionally_ready` or `ready`) with its reasons, the checks, per-program readiness (`blocked`, `needs_sme_decision` or `design_candidate`) with blockers and cautions, and source availability. |

### Identifier policy

- **Permanent source IDs** (`SYS-…`, `…-FIL-NNNN`, `…-PATH-NNNN`, `…-SEC-`, `…-PAR-`, `…-STMT-`, `…-REC-`, `…-FLD-`) are copied unchanged. A `null` recorded upstream stays `null`.
- **Catalogue IDs** (`BR-`, `RS-`, `GAP-`, `ASM-`, …) are run-local. They always appear as `{ "id", "scope": "run-local", "source_run" }`, where `source_run` is a key in the manifest's `source_runs` (artifact, agent version, generation time, SHA-256).
- **Evidence classes** follow the reverse Synthesis agent's rule:
  - **confirmed**: confirmed or high confidence with complete evidence.
  - **inferred**: medium confidence.
  - **uncertain**: low confidence, partial evidence, SME review required, or dead code.
- **Diagrams** are supporting evidence only.

### Readiness rules

A program is **blocked** in any of these cases:
- it has no parser or logic entry;
- its parse or logic status is `empty`, `failed` or `skipped`;
- a critical gap names it directly.

It **needs an SME decision** if it has any of these:
- unresolvable paths or unresolved IDs;
- rules flagged for SME review or with uncertain evidence;
- high-severity gaps;
- unresolved call or include references;
- a duplicate Program ID;
- a non-`VALID` upstream verdict;
- a critical or high gap inherited from an included copybook.

Otherwise it is a **design candidate**.

The overall status is **`ready`** only when all of the following hold:
- every selected program is a design candidate;
- no check failed or warned;
- no blocking decision is open;
- the original COBOL source is available.

## Test file names in historical reports

The STEP reports and their machine evidence refer to the forward test files by their historical names (`step1.test.ts` to `step25.test.ts`), because they record what ran at the time. They are left unchanged. The files now have descriptive names; see [`docs/TEST-FILE-RENAME-MAP.md`](../docs/TEST-FILE-RENAME-MAP.md) for the mapping and [`tests/README.md`](../tests/README.md) for what each file covers.
