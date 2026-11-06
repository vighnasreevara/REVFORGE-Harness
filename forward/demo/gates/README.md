# Synthetic G0–G8 gate demonstration

> **Environment: `SYNTHETIC_INTERVIEW_DEMO`.** This demonstration shows how REVFORGE's nine governance checkpoints work on one small synthetic program:
> - it grants **no** production authorization (`production_authorization: NOT_GRANTED`);
> - it executes **no** BMad workflow (`real_bmad_execution: NOT_EXECUTED`);
> - it does **not** establish legacy COBOL equivalence (`legacy_equivalence: NOT_ESTABLISHED`);
> - it leaves the real modernization exactly as it was.

## Run it

From `forward/`, with Node.js 20+ and JDK 21 (`REVFORGE_JAVA_HOME`, `JAVA_HOME` or `javac` on `PATH`):

```bash
npm ci
npm run demo:gates     # build, then run G0–G8; exit code 0 only if all nine pass
npm run demo:test      # happy path and negative paths (19 tests)
```

`demo gates [--out DIR] [--json]` is the CLI form. Each run gets an ID such as `DEMO-20261106T011442Z-ab48`. It writes to `forward/demo/gates/runs/<ID>/` (git-ignored), and `runs/LATEST` names the most recent run:

| Output | Content |
|---|---|
| `DEMO-REPORT.md` | the human-readable report: gates, checks, evidence, build and test results, BMad simulation, real-project status, limitations |
| `demo-summary.json` | the machine-readable summary (contract `demo/run-summary`) |
| `gates/G0.result.json` … `G8.result.json` | each gate's checks, evidence hashes and status (contract `demo/gate-result`) |
| `gates/G7.review.json` | the structured independent review (findings and decision) |
| `approvals/` | the signed demo approvals (contract `demo/approval`) |
| `trust/demo-trust-store.json` | the run's public key only; the private key exists only in memory during the run |
| `g5/` | generation provenance, source map, statement traceability, build record, functional results, Java sources and classes |
| `g6/` | oracle cases with expectations, the TestMain fixture, the comparison results |
| `bmad/` | six SIMULATED BMad lifecycle records |
| `state.json` | the demo's own state (never the real workflow state) |

A complete sample from a real run is committed in [`sample-run/DEMO-REPORT.md`](sample-run/DEMO-REPORT.md) and [`sample-run/demo-summary.json`](sample-run/demo-summary.json). It is a snapshot of one run; regenerate it with `npm run demo:gates`.

Expected console output:

```
  G0 Baseline Integrity            DEMO PASS     6/6 checks
  G1 Evidence Verification         DEMO PASS     10/10 checks
  G2 Requirements Approval         DEMO PASS     18/18 checks
  G3 Architecture Approval         DEMO PASS     17/17 checks
  G4 Development Plan Approval     DEMO PASS     18/18 checks
  G5 Java Build and Tests          DEMO PASS     11/11 checks
  G6 Independent Verification      DEMO PASS     9/9 checks
  G7 Independent Review            DEMO PASS     12/12 checks
  G8 Synthetic Acceptance          DEMO PASS     15/15 checks

verdict                   SYNTHETIC_DEMO_ACCEPTED
production_authorization  NOT_GRANTED
```

## The synthetic example

`synthetic/source/DEMOORD1.cbl` is a 91-line order-pricing program written for this demonstration (MIT; no restricted source). It contains:
- integer cents and an OCCURS 5 line table;
- a 5% and a 15% tier discount at thresholds of 10000 and 50000 cents, truncated to whole cents;
- a shipping charge below a net of 7500 cents;
- return codes 4, 8 and 12 for an unknown tier, a line count outside 1–5 and a zero quantity.

Its interface is the 77-byte `LS-ORDER` record.

| Input | Role |
|---|---|
| `synthetic/baseline.json` | SHA-256 of the source and of every input below (G0) |
| `synthetic/reverse/reverse-evidence.json` | synthetic reverse evidence: `SYN-DEMO-*` file, paragraph, statement, record and field IDs and 10 business rules `DBR-001`…`DBR-010` (G1) |
| `synthetic/requirements/requirements.json` | 8 requirements, 10 worked examples, 5 documented uncertainties (G2) |
| `synthetic/requirements/data-contract.json` | the `LS-ORDER` layout and numeric rules (G2) |
| `synthetic/design/architecture.json` | components, dependencies and 3 ADRs, bound to the requirements by hash (G3) |
| `synthetic/design/development-plan.json` | 4 stories with tasks and acceptance criteria, bound to the requirements and the architecture; `java_generation_authorization: NOT_GRANTED` (G4) |
| `synthetic/tests/functional-tests.json` | 16 hand-written functional and boundary scenarios (G5) |

**Changing an input** invalidates the baseline, so G0 blocks it. That is the point of G0. Update `baseline.json` (and the hash references in `architecture.json` and `development-plan.json`) only as a deliberate, reviewed change.

## What each gate executes

| Gate | Responsibility | Checks | Approval evidence |
|---|---|---|---|
| G0 Baseline Integrity | runtime | source present and SHA-256 equal to the baseline; every required input present and unchanged; no unexpected file; output isolated from the real runs | none |
| G1 Evidence Verification | runtime (reverse agents 1–5 analogue) | the COBOL is re-parsed by the deterministic converter front end; the file identity, paragraphs, 31 statements, verbs and fields of the evidence must equal the parse; IDs unique; every reference resolves; every statement is traced by a rule | none |
| G2 Requirements Approval | synthetic F1 and F2 | every rule covered by a requirement; worked examples for every calculation and validation; no blocking open uncertainty; data contract equal to the parsed `LS-ORDER` layout; the approval | Ed25519 demo approval (`demo_requirements_approver`) |
| G3 Architecture Approval | synthetic F3 | references the approved requirements and data contract by hash; every requirement allocated; dependencies resolvable; decisions documented; the approval | Ed25519 demo approval (`demo_architecture_approver`) |
| G4 Development Plan Approval | synthetic F4 | references the approved requirements and architecture; every requirement in a story; tasks and acceptance criteria; epics consistent; *not* generation authorization (the real `java_generation_allowed` stays `false`); the approval | Ed25519 demo approval (`demo_planning_approver`) |
| G5 Java Build and Tests | deterministic local converter (F5 analogue, no AI) | Java 21 toolchain; the STEP-17 converter translates with no gap; every statement ID maps to Java; `javac -Werror` exit 0; VALUE and level-88 checks; 16 functional scenarios; 9 boundary scenarios; every requirement tested | none (executed evidence) |
| G6 Independent Verification | independent oracle (F6 analogue) | `runtime/src/demo/oracle.ts` loads no module, so it cannot call the converter or the Java; it reproduces the 10 worked examples; the classes are the G5 build; about 300 cases (boundary, negative, seeded random with seed 20261105, worked examples; every case presets the outputs with garbage) must all match | none (executed comparison) |
| G7 Independent Review | `synthetic-demo-reviewer` (F7 analogue) | gate results and all evidence re-hashed; each requirement has a story, passing tests and matching oracle cases; rule → requirement → story → Java → test chains complete; build evidence; the Java built is exactly the converter output; no Java mapped to a non-existent COBOL statement; inputs, real configuration, real runs and reverse artifacts unchanged; separation of duties | none (structured review) |
| G8 Synthetic Acceptance | synthetic demo authority | the approval binds the review result and the G0–G7 results; G0–G7 PASS on this baseline; all evidence present and unchanged; no unresolved critical finding → `SYNTHETIC_DEMO_ACCEPTED` | Ed25519 demo acceptance (`demo_acceptance_authority`) |

**Every demo approval is checked for:**
- contract and gate;
- binding to the exact subject content, the run, the baseline and the prior PASS results;
- a synthetic signer and the required role;
- `production_authorization: NOT_GRANTED`;
- the Ed25519 signature, verified with the production verifier against the run's demo trust store;
- not being accepted by the real trust anchor.

**A prerequisite counts only when** its persisted result is PASS, its file is unchanged since it was recorded, and it was evaluated on the same baseline.

## BMad

The six bindings of the real design are mapped to the demo stages and preflighted with synthetic inputs:

| Binding | Workflow | Agent | Stage | Demo gate |
|---|---|---|---|---|
| BMAD-PRD | `bmad-prd` | F1 | requirements | G2 |
| BMAD-ARCH | `bmad-architecture` | F3 | architecture | G3 |
| BMAD-EPICS | `bmad-create-epics-and-stories` | F4 | stories | G4 |
| BMAD-SPRINT | `bmad-sprint-planning` | F4 | sprint | G4 |
| BMAD-BUILD | `bmad-build` | F5 | implementation | G5 |
| BMAD-REVIEW | `bmad-code-review` | F7 | review | G7 |

Each step is recorded as `SIMULATED` with `counts_as_bmad_execution: false`. The real receipt counter (`bmad/governance.receiptCounts`) refuses it as execution evidence. As in the real design, G6–G8 stay outside BMad. Real mandatory BMad execution remains **blocked**: no BMad workflow, installer or provider is ever invoked.

## Negative paths

`forward/tests/synthetic-gate-demonstration.test.ts` injects one defect per test, through a temporary copy of the inputs or a demo hook. It checks that the run stops at the right gate with a diagnostic and exit code 1:

| Defect | Stops at |
|---|---|
| source edited after the baseline | G0 (`source_hash`) |
| an extra, unbaselined input file | G0 (`no_unexpected_files`) |
| reverse evidence missing (with a consistent baseline) | G1 (`reverse_present`) |
| evidence that does not match the source | G1 (`statements_match_source`) |
| corrupted G2 signature | G2 (`approval_signature`) |
| G2 approval of different requirements content | G2 (`approval_subject_bound`) |
| no G3 approval | G3 (`approval_present`) |
| G4 approval signed with another key | G4 (`approval_signature`) |
| G4 approval in the wrong role | G4 (`approval_role`) |
| generated Java that does not compile | G5 (`compiled`) |
| a behaviour change the functional tests catch | G5 (`functional_tests`) |
| a boundary defect the functional tests miss (platinum at exactly 50000) | G6 (`java_matches_oracle`) |
| test evidence changed after it was recorded | G7 (`test_evidence_integrity`, blocking review finding) |
| unsigned final acceptance | G8 (`approval_signature`) |
| a gate evaluated before its prerequisite, or after its prerequisite's result changed | BLOCKED |
| a SIMULATED BMad receipt or demo approval offered as production evidence | refused by the real receipt counter, the real trust anchor and the generation guard; demo output into the real runs or `output/` is refused |
| any failing gate, through the CLI | exit code 1 with the diagnostic |

## Limits

- One small synthetic program, synthetic evidence and a synthetic demo authority. Nothing here is a real stakeholder approval, business-owner acceptance or production authorization.
- G6 compares the Java with an independent specification oracle. No COBOL runtime is executed, so legacy equivalence is not established.
- The real project is unchanged:
  - real G2 is UNVERIFIED and G3–G8 BLOCKED;
  - `generation.java_generation_allowed` is `false`;
  - BMad is mandatory and LIVE execution is blocked;
  - all 569 gap records are OPEN;
  - the 154 business-rule identities are untouched;
  - the project is not production ready.

  Each demo report restates this status read-only.
- The two engineering quality gates, `SOURCE_READINESS` and `CONVERSION_VALIDATION`, are separate from these governance checkpoints and are not used or changed by the demonstration.
