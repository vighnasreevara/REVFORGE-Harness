# BMad integration operations

This guide is for the operator of the REVFORGE forward runtime.

**What the integration is.** It connects a pinned, integrity-checked BMad release to the forward workflow through a deterministic adapter. The adapter never runs BMad by itself. Every BMad result is a draft or a recommendation; nothing it produces passes a gate.

## 1. What is staged, and where

| Item | Location |
|---|---|
| Release | `bmad-method@6.12.4`, stable channel, 6.12 line, MIT (BMad Code LLC), published 2026-10-14 |
| Tarball | `forward/integrations/bmad/staging/bmad-method-6.12.4.tgz` (sha256 `4d66c201…cac90a`, npm sha512 integrity verified against the registry) |
| Extracted package | `forward/integrations/bmad/staging/bmad-method-6.12.4/package/` (360 files) |
| Pinned record | `forward/integrations/bmad/release.pin.json`: sha256 of every file, the tarball hashes, Node and Python requirements, and installer facts |
| Workflow registry | `forward/integrations/bmad/workflow-registry.json`: 50 skill definitions, each with lifecycle (active / shim / deprecated / agent) and hashes |
| Bindings | `forward/integrations/bmad/bindings.json` (v1.0.0) |
| Mapping | `forward/integrations/bmad/mapping.json` (v1.0.0) |
| Contracts | `forward/contracts/bmad/*.schema.json` (14) |
| Records | `forward/runs/<run>/workflow/bmad/` (runtime-only; agents cannot write there) |

**Not installed.** The BMad installer was not run.
- With the Claude Code target, it writes to `<directory>/.claude/skills`, `<directory>/_bmad/` and `<directory>/_bmad-output/`. Run in the repository root, that would put BMad skills beside the reverse and forward skills, which is forbidden.
- A sandbox install would need the 13 npm runtime dependencies and `uv` (Python ≥ 3.11). Neither is provisioned: Python 3.12 is present, `uv` is not.

**Version control.** The staging directory is git-ignored. The pin makes it reproducible.

## 2. Re-staging the release on a fresh checkout

```sh
cd forward/integrations/bmad/staging
npm pack bmad-method@6.12.4 --ignore-scripts
mkdir -p bmad-method-6.12.4 && tar -xzf bmad-method-6.12.4.tgz -C bmad-method-6.12.4
node forward/dist/runtime/src/cli.js bmad doctor      # must report OK
```

**If any file differs from the pin,** `bmad doctor` fails and every binding becomes unusable.

**Changing the release** (a new 6.12.x patch, never a v7 preview):
1. Stage the new release in a separate directory.
2. Review the changes.
3. Regenerate the pin and the registry.
4. Review the binding validation.

The runtime never re-pins on its own.

## 3. Commands

All commands accept `--json`. None of them executes BMad.

| Command | Mode | Writes |
|---|---|---|
| `bmad doctor` | DISCOVERY | nothing |
| `bmad workflows` | DISCOVERY | nothing |
| `bmad bindings` | DISCOVERY | nothing |
| `bmad dry-run --workflow W --scope S [--record]` | DRY_RUN | nothing, unless `--record` (sealed `BDR-NNNN`) |
| `bmad eligibility --workflow W --scope S [--mode MOCK\|LIVE]` | — | sealed `BEL-NNNN` |
| `bmad prepare --workflow W --scope S --mode MOCK` | MOCK | `BEL` record, then either an immutable `BPK-NNNN` packet with mapped inputs and provenance sidecars, or a sealed refusal (`bmad_rejected` audit event) |
| `bmad mock --packet BPK-N` | MOCK | a deterministic stand-in result plus a `BRC-NNNN` receipt (`MOCK_NOT_EVIDENCE`) |
| `bmad record --packet BPK-N --file RESULT.json` | MOCK / LIVE | a `BRC-NNNN` receipt, accepted or rejected |
| `bmad report [--out FILE]` | — | `forward/reports/bmad-integration-report.md/.json` |

**There is no `bmad run`.** It exits with code 2. Execution belongs to the forward workflow dispatcher and its gates.

**LIVE is refused in STEP 6.** `prepare --mode LIVE` exits with code 3 and lists every reason. `bindings.json live_execution.requested` alone cannot enable LIVE. LIVE also needs all of the following, none of which exists in STEP 6:
- an eligible workflow;
- a recorded, verified isolated installation;
- a signed execution authorization;
- an executor that dispatches through the workflow.

## 4. Bindings and gate rules

| Binding | BMad workflow | Agent | Requires |
|---|---|---|---|
| BMAD-PRD | `bmad-prd` | F1 | G1 PASS for the exact scope; state REQUIREMENTS_APPROVED or later. Renders approved requirements only. |
| BMAD-ARCH | `bmad-architecture` | F3 | G1 PASS for the exact scope; state REQUIREMENTS_APPROVED or ARCHITECTURE_DRAFTED |
| BMAD-EPICS | `bmad-create-epics-and-stories` | F4 | G1 and G2; recorded (non-mock) architecture results. Stories stay `draft`. |
| BMAD-SPRINT | `bmad-sprint-planning` | F4 | G1 and G2; validated stories (requirement `validated_stories`: an accepted F4 story result for the scope); state STORIES_DRAFTED |
| BMAD-BUILD | `bmad-build` | F5 | G1 and G2; validated stories; an authorised `orchestrator.java_target_dir`; Java generation authorised (config flag plus G2 PASS) |
| BMAD-REVIEW | `bmad-code-review` | F7 | G1 and G2; recorded implementation artefacts with current hashes; an accepted F6 receipt; reviewer ≠ implementer; state REVIEWING |

**Agents that stay outside BMad:**
- **F6** (independent testing) is never bound.
- **F2** (data mapping) has no BMad counterpart.

**Workflow identifiers** were verified from the release's `SKILL.md` frontmatter. Shims are refused; bind the replacement instead. For example:
- `bmad-create-architecture` → `bmad-architecture`;
- `bmad-create-prd` → `bmad-prd`;
- `bmad-quick-dev` → `bmad-build`;
- `bmad-dev-story` and `bmad-create-story` are absorbed into Build.

**Exact scope.** At the moment of checking:
- G1 is re-evaluated, with every signed approval re-verified;
- the scope text and digest must equal the approved ones;
- the state must also record G1 PASS on the current baseline.

## 5. Results, validation and receipts

**What a result is.** A result is a JSON envelope (`bmad/output-prd|architecture|epics|sprint|build|review`) plus the documents it lists.

**Checks before acceptance:**
- the packet still matches its sealed hash, and the result is not a replay;
- the mapped inputs and their provenance sidecars are unchanged;
- the release, bindings, mapping, registry and pin are unchanged;
- eligibility is re-evaluated and still passes; a stale scope digest or baseline is rejected;
- the result satisfies its contract and is bound to the packet, scope digest, baseline, mode and producer;
- it contains no approval assertion anywhere;
- its documents lie inside the packet's output directory (or the authorised Java target for Build) with matching hashes, and `canWrite` allows them for the agent.

**Semantic checks per workflow:**

| Workflow | Checks |
|---|---|
| PRD | no new or missing requirements; source references belong to the requirement; rules and decisions are in scope |
| Architecture | requirements and COBOL units are in scope; every requirement is addressed |
| Stories | traceability, coverage, unique IDs |
| Sprint / Build | only stories from the mapped story inputs; Java only inside the target; file hashes; status consistent with the exit code |
| Review | reviews the recorded implementation; not a self-review; F6 receipt; reviewed file hashes |

**Receipts** always have `counts_toward_gates: false`. Gate G2, the story validation and the workflow transitions after it read only the forward workflow's own receipts and signed approvals.

**Provenance.** Each mapped input has a sidecar (`bmad/provenance`) recording:
- requirement IDs, record hashes, receipts, outcomes and permanent source references;
- rules with their source run (for example `rules@5_rules@1.0#b7ca9ee04731`);
- data contracts;
- decisions with their resolution IDs;
- signed approvals with their scope digest;
- upstream receipts.

## 6. Safeguards

- `bmad doctor` fails if any of these appear in the repository:
  - a `bmad-*` skill in `.claude/skills`;
  - `_bmad/`;
  - `_bmad-output/`.
- `forward/integrations/bmad/staging/` is git-ignored; `.mcp.json` stays ignored.
- Nothing in the adapter writes to `.claude/`, `output/`, `references/`, Neo4j or global settings.

## 7. Scope reconciliation (STEP 7)

`bmad reconcile --scope S` explains every item a scope contributes to a BMad mapping. It is read-only.

**Units** are classed as:
- **primary**: the programs named in the scope;
- **direct dependency**: a copybook, SQL include or called program used directly by a primary;
- **transitive dependency**: needed only by another dependency.

**Requirements, runtime requirements and data contracts** carry an inclusion class:
- **direct**: belongs to a primary unit;
- **shared dependency**: belongs to a dependency unit.

**Decisions** carry one of four classes:

| Class | Meaning |
|---|---|
| direct | affects a primary unit or a scope requirement only |
| cross_scope | affects the scope and units outside it (one decision shared by several scopes) |
| shared_dependency | affects only dependency units of the scope |
| global | names no unit (system-wide gaps; G1 applies them to every scope) |

**Blocking.** Every decision is also flagged as blocking (unresolved and blocking) or non-blocking.

**Membership is unchanged.** Scope membership stays exactly what G1 evaluates; reconciliation only explains it. Since mapping 1.1.0, the BMad mapping and its provenance:
- count runtime requirements separately from business requirements;
- carry each item's inclusion class and reason.

## 8. Isolated executor (STEP 7)

**Location.** `forward/integrations/bmad/executor/` is git-ignored and is never the repository root. It holds:

| Path | Contents |
|---|---|
| `bmad-method-6.12.4/` | a copy of the pinned package. `bmad executor doctor` checks every pinned file. `node_modules/` (13 runtime dependencies, installed with `npm install --omit=dev --ignore-scripts`) and `package-lock.json` are the only additions. |
| `venv/` | `uv` in a private Python venv (pip `--no-cache-dir`) |
| `home/` | an isolated HOME / USERPROFILE for the installer and uv |
| `uv-cache/` | the uv cache |
| `workspaces/<name>/` | synthetic projects with BMad installed by its own installer (`.claude/skills` and `_bmad/` inside the workspace) |

**Provisioning a synthetic workspace (operator, network required):**

```sh
cd forward/integrations/bmad
mkdir -p executor/home executor/workspaces/synthetic-001
cp -r staging/bmad-method-6.12.4/package executor/bmad-method-6.12.4
(cd executor/bmad-method-6.12.4 && npm install --omit=dev --ignore-scripts --no-audit --no-fund --cache ../npm-cache)
python -m venv executor/venv && executor/venv/Scripts/python -m pip install --no-cache-dir uv
cd executor/bmad-method-6.12.4 && HOME=../home USERPROFILE=../home \
  node tools/installer/bmad-cli.js install --directory ../workspaces/synthetic-001 --modules bmm --tools claude-code --yes
node forward/dist/runtime/src/cli.js bmad executor doctor     # installation must be VERIFIED
```

**Executor commands** (none of them executes BMad):

| Command | What it does |
|---|---|
| `bmad executor doctor` | Checks the release, the executor copy, npm dependencies, uv, Python ≥ 3.11, the Claude Code CLI, the installed workspaces (the six bound workflows must be byte-identical to the pin; no shims), isolation and the isolated HOME. Reports the LIVE blockers. |
| `bmad executor eligibility --workflow W --scope S` | Workflow eligibility (state, gates, exact scope), the LIVE gate, executor blockers and disabled bindings (Build is disabled). |
| `bmad executor dry-run --workflow W --scope S [--record]` | The execution manifest (`bmad/execution-manifest`): workspace, isolated HOME, the exact `claude -p` headless command and its tool restrictions, inputs, and every precondition. |
| `bmad executor report [--scope S]` | `forward/reports/bmad-executor-report.json` |

**The LIVE command shape.** A LIVE run would be `claude -p "/<workflow> …" --output-format json --no-session-persistence --permission-mode dontAsk --setting-sources project --strict-mcp-config --restricted --allowedTools Read,Glob,Grep,Write,Edit --disallowedTools WebFetch,WebSearch,Bash,PowerShell`, run in the isolated workspace. Its result goes through `bmad record`: a failure becomes a `BEX` record, and a completion claim must pass the receipt validator.

**LIVE needs, in addition to eligibility:**
1. A signed AI-provider disclosure authorization for Anthropic / Claude Code. **None exists, and no contract for it exists yet**: the OpenAI source-export authorization is bound to provider `openai` by contract and cannot cover Claude.
2. `bindings.json live_execution.requested: true`.

**The workflows themselves also need caution:**
- The BMad architecture workflow asks for web research, which is a further disclosure path; it is disallowed in the manifest.
- Build stays disabled.
