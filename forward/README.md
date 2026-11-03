# REVFORGE Forward Engineering Harness

This is the forward-engineering side of REVFORGE. It takes the reverse-engineering artifacts in `../output/` and builds a modernisation plan from them.

This is **STEP 1: repository audit and executable foundation.** It adds a TypeScript runtime and CLI, JSON Schema contracts (Ajv v8), evidence-validation utilities and planning reports. It generates no Java code, and it never modifies the reverse harness, its outputs or Neo4j.

## Layout

```
forward/
  runtime/src/        CLI (cli.ts), commands (doctor, validate, plan), core modules
  verification/src/   ID classification, evidence classes, reference-integrity checks
  contracts/          JSON Schema contracts: common, forward-config, input/*, output/*
  config/             forward.config.json (artifact paths, selection, generation policy)
  reports/            Documentation of the generated reports
  tests/              node:test suites and a synthetic-fixture builder
  runs/               Generated run results (Git-ignored)
```

## Requirements

- Node.js 20 or later.
- The reverse artifacts in `../output/`.
- Optional: the original COBOL source library. Set `cobol_source.root` in the config, the environment variable `REVFORGE_COBOL_SOURCE_ROOT`, or `--source-root`. Without the source, planning relies on the artifacts alone and readiness is never reported as `ready`.

## Usage

```bash
cd forward
npm install
npm run build
node dist/runtime/src/cli.js doctor          # environment and inputs
node dist/runtime/src/cli.js validate        # contracts and cross-references
node dist/runtime/src/cli.js plan --all      # full discovered system
node dist/runtime/src/cli.js plan --programs PROG1,PROG2   # subset (Program or File IDs)
npm test                                     # build and run all tests
```

The exit codes are:

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | A check or validation failed |
| 2 | Usage error |
| 3 | Generation refused |
| 4 | Configuration error |

## Principles

- **Dynamic discovery.** Programs, copybooks, JCL and dependencies come from the inventory artifact. No program name, count or business rule is hard-coded, and a test checks this.
- **Permanent IDs are preserved.** Source IDs are copied unchanged and never created or repaired.
- **Run-local catalogue IDs.** `BR-`, `GAP-` and similar IDs are bound to the exact reverse run (artifact SHA-256) recorded in the baseline manifest.
- **Gaps are expanded.** Grouped gaps are expanded into addressable items.
- **Confidence is kept.** Confidence, SME flags and confirmed/inferred/uncertain evidence are preserved.
- **Diagrams are supporting evidence only.**
- **No live Neo4j verification.** None is claimed, and verification results recorded upstream are reported with attribution.
- **Generation is guarded.** Java generation requires both the config flag and an approved gate. Gates arrive in a later step, so it is always refused in STEP 1.

See `reports/README.md` for the report descriptions.

## STEP 2: the Forward Orchestrator

The orchestrator (`runtime/src/orchestrator/`) is the single deterministic controller of the forward workflow. Claude Code subagents do the analysis. The runtime decides:
- what may run, and which inputs it gets;
- whether an agent's outputs are accepted;
- gate results and state transitions;
- the audit trail.

No agent output can pass a gate or move the workflow into an approval state.

| Module | Role |
|---|---|
| `agents.ts` | Registry of the seven agents F1–F7: inputs, outputs, dispatch states, required gate, skills, allowed tools, forbidden actions. Also checks the definition files `.claude/agents/fe-*.agent.md` against it. |
| `states.ts` | The 16 workflow states plus `INITIALIZED`, and the allowed transitions. Each transition is guarded by a gate PASS, an accepted receipt or a dispatch. `BLOCKED` may only return to the state it blocked; `ACCEPTED` and `FAILED` are terminal. |
| `gates.ts` | G0 (baseline integrity) and G1 (evidence verification) are fully evaluated. G2–G8 fail closed: they return `BLOCKED`, `NOT_RUN` or `UNVERIFIED`, never `PASS`. Every result records its status, reason, inputs with SHA-256 and timestamp. |
| `permissions.ts` | Least-privilege write scopes: each agent writes only to `workflow/agents/<F#>/`. Reverse outputs, `.claude`, COBOL sources, the forward runtime/contracts/config and the runtime's records are never writable. Java goes only to an authorised target directory, and only when generation is authorised. |
| `classification.ts` | Evidence-based classification as application, template, test tool or utility, from the source path, the logic narrative and notes. Anything that is not an application candidate needs a scope decision. |
| `store.ts` | Atomic `state.json` with a checkpoint digest, a hash-chained `audit.jsonl`, an operation lock, and gate, packet, receipt and approval records. |
| `orchestrator.ts` | `init`, `runGate`, `advance`, `prepare` (dispatch packets), `recordReceipt`, `status`, `blockedReport`, `resume`. |

Workflow commands operate on a plan run. `--run` defaults to `latest`.

```bash
node dist/runtime/src/cli.js agents                     # registry + definition checks + skill status
node dist/runtime/src/cli.js workflow init              # G0, classification, BASELINE_LOADED
node dist/runtime/src/cli.js workflow gate --gate G1    # or --gate all
node dist/runtime/src/cli.js workflow advance --to EVIDENCE_VALIDATED
node dist/runtime/src/cli.js workflow transitions       # allowed moves and their guards
node dist/runtime/src/cli.js workflow prepare --agent F1 [--programs A,B]
node dist/runtime/src/cli.js workflow record --receipt receipt.json
node dist/runtime/src/cli.js workflow status | blocked | resume
```

Run records live in `runs/<run>/workflow/`:

```
state.json  audit.jsonl  program_classification.json
gates/  packets/  receipts/  approvals/  agents/F1..F7/
```

## STEP 3: skills, deliverable contracts and real F1/F2 execution

| Area | Implementation |
|---|---|
| Agents | The seven forward agent definitions are in `forward/agents/fe-*.agent.md` (the orchestrator reads them there; `config/forward.config.json` → `orchestrator.agents_dir`). `sync-agents` copies them to `.claude/agents/` so Claude Code can use them; `sync-agents --check` and `doctor` report drift. Edit only the `forward/` copies. |
| Skills | 14 skills in `forward/skills/fe-*/SKILL.md` (copied to `.claude/skills/` by `sync-agents`), two per agent. Each has 12 required sections and a `revforge-skill` metadata block. `orchestrator/skills.ts` validates them: front matter, sections, owner, contracts, write scope, tools, requested operations, duplicates and unexpected `fe-*` directories. A skill counts as `INSTALLED` only when it passes. |
| Contracts | 11 canonical deliverable contracts plus a shared header in `contracts/forward/` (see `contracts/README.md`), and `verification/src/semantic.ts` for the deterministic semantic checks. |
| Dispatch | Batched packets (`workflow batches`) with dynamically discovered units and runtime extracts in `workflow/extracts/<packet>/`. Each packet records rule and gap scope, source availability and skill hashes, and has its own output directory and `receipt_path`. |
| Receipts | Output paths must lie inside the packet's own directory. The runtime hashes every output (agents may give `sha256: null`), validates it against its contract and runs the semantic checks. Skill files must be unchanged since dispatch. Provenance is recorded in the receipt verdict. |
| Coverage | `orchestrator/ledger.ts` tracks every unit. A stage transition such as `REQUIREMENTS_DRAFTED` requires the ledger to be complete; one finished batch never completes a stage. |
| Git protection | Only the 7 `fe-*` agent files and the 14 `fe-*` skill directories may be added under `.claude/`. Everything else there is still checked. |

Execution is a manual dispatch-and-receipt handoff:
1. The runtime prepares the packets.
2. Claude Code invokes the `fe-*` subagent with its packet.
3. The agent writes its deliverables and `receipt.json`.
4. The operator runs `workflow record --receipt <path>`.

**Limits:**
- `verified_from_source` is accepted only when the packet had the source available. The runtime cannot prove that an agent actually read the lines it cites.
- Cross-batch consistency of copybook-level rule dispositions is not yet checked.

**Limits in STEP 2:**
- The 14 skills are not installed, so every packet is `NOT DISPATCHABLE` and lists `SKILL_NOT_INSTALLED`.
- No command records human approvals, so G2, G3, G4 and G8 cannot pass and the approval states are unreachable.
- Java generation stays disabled.
- New project agents are visible to Claude Code only after the session is restarted.
