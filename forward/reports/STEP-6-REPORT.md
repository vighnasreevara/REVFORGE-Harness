# STEP 6 report: controlled BMad integration

Real run: `FWD-20261031T172520Z-66b3`. Baseline manifest sha256 `352b97f0…4d24a068`. Branch `main`, commit `b092004`. Nothing committed or pushed.

**Outcome.** The BMad 6.12.4 release is staged and verified. Six workflows are bound to forward agents behind the existing gates. **No BMad workflow ran on the real run:** G2 is UNVERIFIED, so every real request was refused, and the refusal was recorded.

## 1. Starting point

- **Git:** `main` / `b092004`. The forward work is untracked.
- **Tests:** 190/190 passing before this step.
- **Workflow:** state REQUIREMENTS_DRAFTED; G0 PASS, G1 PASS, G2 UNVERIFIED, G3–G8 BLOCKED; checkpoint #143; audit 182 entries.
- **Inputs read:** the Step 5.5 package for `programs:RTNCDE00` (scope digest `88d8562c…`), the F1–F7 registry, the 14 forward skills and the gates.

## 2. Release selected

- **Release:** `bmad-method@6.12.4`, latest stable patch of the 6.12 line.
  - Published 2026-10-14, more than two weeks before staging.
  - Includes the 6.12.3 / 6.12.4 `install --yes` and Windows UTF-8 fixes.
  - Previews and v7 were not considered; a v7 / `next` pin is refused by contract.
- **License:** MIT (BMad Code LLC). LICENSE sha256 is recorded in the pin.
- **Integrity:**
  - tarball sha256 `4d66c201b6200c56ab1924ac75dc9210b2235b4fd4a44beafe588b20b5cac90a`;
  - npm sha512 integrity and sha1 shasum verified against the registry;
  - 360 extracted files, directory digest `c69ee567…cd931`.

## 3. Dependencies

| Area | Requirement |
|---|---|
| Node | `>=20.12.0` (local Node 22.12 is compatible) |
| npm runtime dependencies | 13, e.g. `@clack/prompts`, `commander`, `yaml`, `semver`. Not installed. |
| Install-time lifecycle scripts | none. `prepare` (husky) runs only for development installs, and staging used `--ignore-scripts`. |
| Python | ≥ 3.11 via `uv`, for skill activation scripts (`render_skill.py`, `resolve_config.py`, `resolve_customization.py`). Python 3.12 is present; `uv` is not installed. |

## 4. Installation impact and decision

- **What the installer would write** with the Claude Code target (`platform-codes.yaml`, `claude-code`):
  - `<directory>/.claude/skills/<skill>`;
  - `<directory>/_bmad/`;
  - `<directory>/_bmad-output/`;
  - with `global_target_dir`: `~/.claude/skills`.
- **Decision: staged, not installed.**
  - A repository-root install would modify `.claude/skills`, which is forbidden.
  - A sandbox install needs the npm dependencies and `uv`, which are not provisioned.
  - No installer was run. No global settings, plugins or `.claude/` files were touched.

## 5. Workflow catalogue (verified from the release)

- **Discovery:** 50 `SKILL.md` definitions under `src/`, from frontmatter and `module-help.csv`. Of these:
  - 24 active;
  - 21 shims / deprecated;
  - 5 agent personas.
- **Bound workflows,** all active and non-shim:
  - `bmad-prd` (src/bmm-skills/plan, menu PRD);
  - `bmad-architecture` (CA);
  - `bmad-create-epics-and-stories` (CE);
  - `bmad-sprint-planning` (SP);
  - `bmad-build` (ship, BD);
  - `bmad-code-review` (CR).
- **Shims detected and refused,** for example:
  - `bmad-create-architecture` → `bmad-architecture`;
  - `bmad-create-prd` → `bmad-prd`;
  - `bmad-quick-dev` → `bmad-build`;
  - `bmad-dev-story`, `bmad-create-story`.
- **Claude Code compatibility:** `claude-code` is a preferred installer target, and the skills use Claude Code subagents where available.
  - Activation of several skills (`bmad-build`, `bmad-sprint-planning`, shims) requires `uv run` of `_bmad/scripts`, so they cannot run without an install.

## 6. Bindings (`bindings.json` v1.0.0)

| Binding | Workflow | Agent | Gates | Also requires |
|---|---|---|---|---|
| BMAD-PRD | bmad-prd | F1 | G2 (exact scope) | state REQUIREMENTS_APPROVED or later; renders approved requirements only |
| BMAD-ARCH | bmad-architecture | F3 | G2 (exact scope) | — |
| BMAD-EPICS | bmad-create-epics-and-stories | F4 | G2, G3 | recorded non-mock architecture |
| BMAD-SPRINT | bmad-sprint-planning | F4 | G2, G3, G4 | approved stories |
| BMAD-BUILD | bmad-build | F5 | G2, G3, G4 | approved stories, authorised Java dir, generation authorised |
| BMAD-REVIEW | bmad-code-review | F7 | G2–G6 | real implementation artefacts, F6 receipt, reviewer ≠ implementer |

- **Independent:** F6 (never bound) and F2.
- **Validation of all 6 bindings** checks that each:
  - is registered, active and unmodified;
  - names a known agent;
  - has a code permission equal to the agent's;
  - covers the agent's dispatch gate;
  - is not F6;
  - requires G2;
  - never approves;
  - has a registered output contract and a defined mapping.
- **Result:** all 6 valid.

## 7. Adapter (`forward/runtime/src/bmad/`)

| File | Responsibility |
|---|---|
| `release.ts` | Discovers and verifies the release: pin contract, release line, lifecycle scripts, tarball sha256/sha512/size, per-file manifest (modified / added / missing), workflows re-derived and compared with the registry, installation impact |
| `bindings.ts` | Loads and validates bindings and the mapping |
| `eligibility.ts` | Gathers facts from runtime records; `decide()` is pure; `liveGate()` |
| `mapping.ts` | Versioned mapping and provenance |
| `validators.ts` | Contract plus semantic checks per workflow; approval-assertion scan |
| `adapter.ts` | Packets, mock producer, result recording, sealed records and audit events, summary |
| `report.ts` | Status report rendering |

**The adapter's 15 duties map to these files as follows:**

| Duties | Where |
|---|---|
| discover the release; verify workflows | `verifyRelease` |
| bind workflows to agents | `validateBindings` |
| check state, gates and scope; verify the baseline | `decide` + `gatherFacts` (G2 re-evaluated, recorded gates, scope digest, G0 via G2) |
| prepare packets with output locations; enforce permissions | `preparePacket` + `canWrite` |
| validate outputs | `validateResult` |
| record provenance and receipts | sidecars + `BRC` |
| reject unverified, stale or unauthorized results | `recordResult` re-checks |

## 8. Contracts (`forward/contracts/bmad/`, 14)

- `release-pin`, `workflow-registry`, `binding-config`, `mapping-spec`;
- `provenance`, `eligibility`, `execution-packet`, `receipt`;
- `output-prd`, `output-architecture`, `output-epics`, `output-sprint`, `output-build`, `output-review`.

## 9. Modes

| Mode | Behaviour |
|---|---|
| DISCOVERY | doctor / workflows / bindings; read-only |
| DRY_RUN | eligibility plus mapping preview; writes nothing unless `--record` |
| MOCK | deterministic stand-in result. Receipt `MOCK_NOT_EVIDENCE`; never counts as upstream evidence or toward a gate. |
| LIVE | always refused in STEP 6. The config flag alone cannot enable it; it also needs eligibility, a recorded isolated installation, a signed execution authorization and a dispatcher-integrated executor. |

## 10. CLI

- **Commands:** `bmad doctor | workflows | bindings | eligibility | dry-run | prepare | mock | record | report`, all with `--json`.
- **`bmad run` does not exist** (exit 2).
- **Exit codes for a refused `prepare`:** 1 (not eligible), 3 (LIVE not authorized).

## 11. Tests

- **`tests/step6.test.ts`:** 27 new tests covering:
  - release verification and tamper detection (modified workflow, added file, tampered tarball, v7 pin);
  - shim, invented-ID, F6 and code-permission bindings;
  - every eligibility rule, including exact scope and mock non-evidence;
  - LIVE refusal;
  - a sealed refusal without G2;
  - a read-only dry run;
  - a full MOCK packet → provenance → receipt on a G2-approved synthetic scope;
  - rejection of added requirements, approval assertions and out-of-location documents;
  - stale, modified-packet and replay rejection;
  - permissions;
  - installation-impact detection;
  - the CLI.
- **Full suite:** **217/217** passing (190 existing preserved, plus 27).

## 12. Real checks on `FWD-20261031T172520Z-66b3`

| Check | Result |
|---|---|
| build | OK |
| doctor / validate / agents / skills | exit 0 / 0 / 0 / 0 |
| `bmad doctor` | OK: 11/11 checks |
| `bmad workflows` | 50 definitions verified |
| `bmad bindings` | 6/6 valid |
| `bmad dry-run --workflow bmad-prd --scope programs:RTNCDE00` | would be REFUSED; nothing written (audit stayed at 182). Mapping preview: 5 inputs; provenance 7 requirements, 4 rules (source run `rules@5_rules@1.0#b7ca9ee04731`), 5 data contracts, 10 decisions, 0 approvals. Scope digest `88d8562c…`, identical to Step 5.5. Requirements: REQ-RTNCDE00-001 REQUIRES_SME_DECISION, -002 VERIFIED, -003 REQUIRES_EVIDENCE, -004 CONTRADICTED. |
| dry runs of the other five workflows | all refused, each with its missing gates and prerequisites (e.g. build: G3, G4, approved stories, Java dir, generation) |
| real gate rejection: `bmad prepare --workflow bmad-prd … --mode MOCK` | refused; `BEL-0001` sealed, `bmad_rejected` audited; no packet |
| real LIVE refusal: `bmad prepare --workflow bmad-architecture … --mode LIVE` | refused (exit 3), 8 reasons; `BEL-0002` sealed |
| `bmad eligibility` | NOT ELIGIBLE; `BEL-0003` sealed |
| mock receipt run | performed only on synthetic G2-approved fixtures (tests 17, 18, 20, 22): accepted `MOCK_NOT_EVIDENCE` receipts; G3 still not PASS. `bmad mock` on the real run fails because there is no packet. |
| G2 re-evaluation | UNVERIFIED: NOT_READY, 395 blocking findings; failing checks unchanged; trust anchor and human approval are absent |
| `bmad report` | `forward/reports/bmad-integration-report.md/.json`; records intact |
| workflow status / resume | REQUIREMENTS_DRAFTED; checkpoint #147 verified; resume OK |

## 13. Integrity

Before/after sha256 comparison:

| Area | Result |
|---|---|
| `output/` (534 files) | unchanged |
| original COBOL (371 files) | unchanged |
| `.claude/` (44 files) | unchanged |
| plan run files (49) | unchanged |
| workflow records | only `audit.jsonl` and `state.json` appended |
| new workflow records | `bmad/BEL-0001..0003`, `g2/G2E-0009`, `gates/G2-0025` |
| previously existing records | unchanged |

- **Audit:** 182 → 190 entries; chain verified.
- **Workflow state:** not advanced.
- **Permissions:** `workflow/bmad` was added to the runtime-only records in `permissions.ts`.

## 14. Git

- **Tracked files:** none modified (`git diff` is empty).
- **New files:** only under `forward/`.
- **Ignored:**
  - `forward/integrations/bmad/staging/` (tarball and package);
  - `.mcp.json` (still ignored, untouched).
- **Commits:** none; nothing pushed.

## 15. Status

| Item | Status |
|---|---|
| BMad installed | **No** (staged and verified only) |
| BMad discovered | **Yes**: 50 workflow definitions verified against the pin |
| Adapter implemented | **Yes**: discovery, bindings, eligibility, mapping and provenance, packets, validators, receipts |
| Mock-tested | **Yes**: synthetic fixtures only |
| Real BMad workflow executed | **No**. Every real request was refused because G2 is blocked. |
| Approved artefact | **None**. No BMad result can approve anything, and none exists for the real run. |

## 16. Limitations and what unblocks the next step

**Limitations:**
- LIVE has no executor, no installation record and no execution-authorization contract.
- The sprint, build and review mock producers are intentionally absent, because they need real upstream results.
- G3 and G4 remain fail-closed evaluators, so stories, sprint and build cannot become eligible until a later step implements those gates.

**What unblocks a real BMad PRD or architecture run on `programs:RTNCDE00`:**
1. Configure the trust store.
2. Resolve the 4 blocking decisions and the citation correction for REQ-RTNCDE00-004.
3. Obtain a signed G2 approval for the exact scope digest.
4. Get G2 PASS.
5. Advance to REQUIREMENTS_APPROVED.
6. Separately, authorize and implement LIVE execution through the dispatcher.

Step 7 was not started.
