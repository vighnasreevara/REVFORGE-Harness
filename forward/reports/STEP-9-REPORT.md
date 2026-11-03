# STEP 9 report: dependency-aware COBOL evidence verification and Claude/BMad execution isolation

**Run:** `FWD-20261031T172520Z-66b3` (baseline `352b97f0…4d24a068`), 2026-11-01.

The following are distinct states, and this report never treats one as another:

| State | Meaning |
|---|---|
| Evidence found | the resolver located a declaration |
| Evidence independently verified | a deterministic dependency chain from the cited statement |
| Interpretation confirmed | only a signed human can do this |
| Human decision resolved | a signed resolution exists |
| Requirements approved | G2 PASS |
| Isolation configured | the launcher is present |
| Isolation tested | the offline suite passed |
| Execution authorized | every preflight check passed |

**This step reached:** evidence found and independently verified, isolation configured, and isolation tested.

**This step did not reach:** interpretation confirmed, any human decision resolved, requirements approved, or execution authorized.

## 1. Git

- **Branch / commit:** `main` / `b092004` (unchanged).
- **Working tree:** no tracked file modified.
- **Commits:** none; nothing pushed.
- **Ignored:** `.mcp.json` (untouched).

**Recovery manifest.** Because Steps 1–9 are uncommitted, `forward/tools/recovery-manifest.js` writes `reports/step-9/recovery-manifest.json`:
- every implementation file (path, size, sha256; about 290 files);
- a tree digest (recorded in the manifest itself, not here, because the manifest also hashes this report);
- 0 private-key warnings;
- **hashes only:** no content, no COBOL source, no workflow records, no keys;
- `--verify` compares the tree with the manifest.

## 2. Files

**Created:**

| Area | Files |
|---|---|
| Verification | `verification/src/context.ts` (pure resolver) |
| Runtime | `runtime/src/context/context.ts`, `runtime/src/context/report.ts`, `runtime/src/isolation/isolation.ts`, `runtime/src/commands/context.ts` |
| Isolation launcher | `integrations/bmad/isolation/sandbox.sh`, `integrations/bmad/isolation/isolation-test-report.json` |
| Contracts | `contracts/verification/evidence-supplement`, `contracts/verification/context-report` |
| Tools | `tools/recovery-manifest.js` |
| Tests | `tests/step9.test.ts` |
| Docs | `docs/COBOL-CONTEXT-VERIFICATION.md`, `docs/ISOLATED-CLAUDE-BMAD-EXECUTION.md` |
| Reports | `reports/STEP-9-REPORT.md`, `reports/step-9/*` |

**Modified:**

| File | Change |
|---|---|
| `runtime/src/approval/snapshot.ts` | Loads supplements and their currency (before the decision register) |
| `runtime/src/approval/scope.ts` | A signed `resolved_no_change` that selects a current CONTEXT_SUPPORTED supplement upgrades the item's REQUIRES_EVIDENCE evidence components |
| `runtime/src/approval/decisions.ts` | `evidence_supplement_binding` check; the derived review decision offers `resolved_no_change` and lists the supplement as evidence only while an eligible, current supplement exists |
| `runtime/src/bmad/preflight.ts` | Isolation evidence, workspace, filesystem, network, secrets and runner checks; the execution statuses |
| `runtime/src/commands/bmad.ts`, `runtime/src/commands/verification.ts` | New commands |
| `runtime/src/orchestrator/permissions.ts` | `context/` is runtime-only |
| `contracts/bmad/execution-preflight` | Isolation fields |
| `tests/helpers/designfixture.ts` | `mutate` / `edit` hooks |

**Not modified:** reverse agents, skills and outputs; the COBOL source; Neo4j; historical receipts, approvals and audit entries.

## 3. Tests

**278 passed, 0 failed, 0 skipped:** the 261 existing tests plus 17 new test cases covering the 30 required items.

| Item(s) | What is tested |
|---|---|
| 1–2 | level-88 definition and parent |
| 3 | cross- and nested-copybook chains |
| 4–5 | duplicate and qualified names |
| 6 | missing copybook |
| 7 | incorrect cited line |
| 8 | a literal without a dependency is never evidence |
| 9 | source-hash mismatch |
| 10–11 | fixed format, comments, continued literals |
| 12 | permanent-ID integrity and catalogue disagreement |
| 13–14 | versioned immutable supplements; no automatic SME resolution |
| 15–16 | G2 fail-closed; acceptance only by a signed resolution; invalidation on source change |
| 17–22 | the **real** offline isolation suite |
| 21 | workspace traversal, absolute-path and mount refusals |
| 23 | missing isolation runtime |
| 24–26 | invalid or wrong-provider authorization; preflight refusal |
| 27–30 | receipt and reverse-output integrity, no AI calls, no Java |

There is also a contradiction test. No earlier test was changed.

## 4. New source-context verification capabilities

**What the resolver does:**
- builds a symbol index from the COPY-expanded DATA DIVISION, recording data items and level-88 conditions with their parent, ancestors, record, declaring file and line, VALUE(S) and COPY inclusion chain (nested copybooks included);
- applies `OF`/`IN` qualification; ambiguous names stay ambiguous and undefined names stay undefined;
- reads statement logical text: fixed-format areas and comments are dropped, continued literals are joined;
- classifies each reference by usage (`sets_true`, `sets_false`, `tested`, `referenced`);
- assigns literal support only through the statement or a condition it actually SETs or tests;
- attaches permanent IDs from the reverse catalogue and cross-checks its line, values and parent against the source;
- detects label/value contradictions and citation mismatches.

**Levels reported separately:** symbol exists, resolves, value declared, statement references it, runtime effect. Business interpretation is always `not_established_requires_human`.

## 5. REQ-RTNCDE00-003

- **Existing check:** unverified. The cited EVALUATE (line 70) holds 3 of 4 values; `'F'` is "missing".
- **Dependency-aware result:** **CONTEXT_SUPPORTED**. All four values are the declared VALUES of conditions the cited statement SETs (`SET … TO TRUE`):

| Condition | Declared at | Value | Permanent ID |
|---|---|---|---|
| RC-STATUS-SUCCESS | `src/copybook/common/RTNCODE.cpy:17` | `'S'` | `FIL-0013-FLD-000013` |
| RC-STATUS-WARNING | `src/copybook/common/RTNCODE.cpy:18` | `'W'` | `FIL-0013-FLD-000014` |
| RC-STATUS-ERROR | `src/copybook/common/RTNCODE.cpy:19` | `'E'` | `FIL-0013-FLD-000015` |
| RC-STATUS-SEVERE | `src/copybook/common/RTNCODE.cpy:20` | `'F'` | `FIL-0013-FLD-000016` |

- **Chain details:** the parent of all four is RC-STATUS (`FLD-000012`), reached through `COPY RTNCODE`. The reverse catalogue agrees with the source on line, values and parent.
- **Supplement:** `ESU-0002` (v1, eligible).
- **What it does not establish:** the intended business meaning is **not** confirmed. A `business_sme` must sign `resolved_no_change` selecting ESU-0002 for it to count (new request `reports/step-9/RVW-REQ-RTNCDE00-003.request.json`, `DRQ-c442a6d2a5fc`).

## 6. REQ-RTNCDE00-004

- **Result:** **CITATION_MISMATCH**, unchanged. Line 121 is outside STMT-000024 (lines 122–133).
- **The `'A'` value:** it is declared by RC-ANALYZE (`RTNCODE.cpy:10`), but the cited SQL statement never references that condition, so it is **not** counted. The `A` dispatch happens in a different, uncited statement.
- **Supplement:** `ESU-0003` documents this; it cannot be accepted.
- **Still needed:** the citation correction RP-8d2dd33787 (Step 8) and the signed review.

**Advisory — REQ-RTNCDE00-002:**
- The existing check marked it verified only because `'S'` matched as a **substring** of `RC-HIGHEST-CODE`; the claim's `('S')` refers to the request code.
- **New result:** CONTEXT_UNSUPPORTED, documented as advisory `ESU-0001`.
- **G2 effect:** unchanged (the item stays VERIFIED under existing policy). A reviewer should confirm or extend the citation.

## 7. Additional source references verified

**RTNCDE00:**
- 7 items: 5 CONTEXT_SUPPORTED, 1 CONTEXT_UNSUPPORTED, 1 CITATION_MISMATCH;
- 13 dependency chains, of which 9 support claimed values;
- 0 contradictions, 0 metadata disagreements.

**Application-wide:**
- 226 items: 147 CONTEXT_SUPPORTED, 16 CONTEXT_PARTIAL, 29 CONTEXT_UNSUPPORTED, 25 CONTEXT_UNRESOLVED, 9 CITATION_MISMATCH;
- 169 dependency chains; 87 claimed values supported only through them;
- **17 items** newly supported that the old check left unverified, e.g. REQ-RTNCDE00-003, REQ-BCHCTL00-001, REQ-DB2CMT-001, REQ-DB2ERR-001..003, REQ-CURSMGR-001/002, REQ-DB2RECV-001/002/006;
- **7 items** the old check verified but the new one does not support (advisory: REQ-RTNCDE00-002, REQ-PORTDEL-002/004, REQ-PORTUPDT-003, RT-PORTADD-001, RT-RCVPRC00-001/002);
- 0 contradictions; 0 catalogue/source disagreements;
- **unresolved COPY members:** SQLCA (circular), SQLPOS, PORTREC.

**Reports:** `reports/step-9/context-verification-report.*` and `reports/step-9/application/`.

## 8. Evidence supplements created

Three supplements, recorded in `workflow/context/`, sealed in the audit chain and immutable:

| Supplement | Item | Status |
|---|---|---|
| `ESU-0001` | REQ-RTNCDE00-002 | advisory |
| `ESU-0002` | REQ-RTNCDE00-003 | eligible |
| `ESU-0003` | REQ-RTNCDE00-004 | citation mismatch |

No requirement, receipt or decision was changed.

## 9. Impact on G2 readiness

**RTNCDE00:** still **NOT_READY** with 5 blocking findings (1 CONTRADICTED, 1 REQUIRES_EVIDENCE, 9 REQUIRES_SME_DECISION components).

**The scope digest changed** (`88d8562c…` → `dc7da3c0…`) because RVW-REQ-RTNCDE00-003 now offers acceptance of ESU-0002:
- the Step 8 request for that decision is stale, and a new one was exported;
- the other three decisions are unchanged.

**What could change it:** once a `business_sme` signs it, REQ-RTNCDE00-003's evidence defect can clear without an exception approval.

**Application:** G2 UNVERIFIED, 395 blocking.

## 10–14. Isolation

**Mechanism:** whole-process sandbox in WSL2 (`sandbox.sh`):
- user, mount, network, PID, IPC and UTS namespaces;
- `pivot_root` into a minimal root;
- `/usr` read-only;
- source and inputs read-only;
- one writable output directory;
- private `/tmp`;
- no network;
- all capabilities dropped and `no_new_privs`;
- `env -i`.

**Not used:**
- **The built-in Claude Code sandbox:** shell-only per the official documentation.
- **Docker or Podman:** not available.

**Host (actual):**
- Windows 11 Home, hypervisor present;
- no Docker, Podman, Windows Sandbox or Hyper-V manager;
- WSL2 Ubuntu 24.04.4 (kernel 6.6.87.2) with `unshare`, `setpriv` and unprivileged namespaces;
- no bubblewrap, socat, Node.js or Claude Code in WSL;
- sudo needs a password.

**Offline isolation suite** (synthetic COBOL project only): **all 19 checks passed**, so the status is **ISOLATION_TESTED** (launcher `959c1592…`).

| Area | Result |
|---|---|
| Filesystem | Authorized files readable. Windows drives, home, root, `/etc/shadow` and a planted host secret all unreachable. Source write-protected (EROFS) and unchanged on the host. Only `/work/out` writable (inputs, `/usr`, `/`, `/etc` refused). |
| Credentials | No credential paths and no environment leakage. |
| Escapes | Symlink to a host path not followable; traversal finds nothing. `mount`, `unshare`, `chroot` and `cmd.exe` all fail (CapEff 0, NoNewPrivs 1, 1 visible PID). No host-control socket. |
| Workspace builder | Refuses extra mounts, writable source mounts, symlinked inputs, traversal or absolute destinations, and unlisted or changed files. |
| Network | No route to 1.1.1.1:443, 8.8.8.8:53 or 140.82.112.3:443, and no DNS (default deny). |

## 15. Remaining security limitations

1. **Claude Code and Node.js are not installed inside WSL2**, so the runner cannot run within the boundary. Status: **EXECUTION_UNSUPPORTED**. Fixing this is an administrator action.
2. **No provider-egress component exists.** The boundary has no network at all. A LIVE run needs a separately verified allowlist proxy outside the namespace (for example the official sandbox runtime with bubblewrap and socat, which needs sudo, or a container or VM firewall).
3. **TLS to the provider is end-to-end.** Payload content cannot be inspected, and a hostname allowlist does not prove the payload is authorized. Only the minimal workspace limits what can be disclosed.
4. **Not a VM boundary.** The namespaces share the WSL2 kernel.

## 16–18. Preflight, disclosure and trust

**BMad preflight** (`bmad-architecture`, `programs:RTNCDE00`): **REFUSED**, recorded as `BPF-0002` with status **EXECUTION_UNSUPPORTED**. Nothing was launched.

| Result | Checks |
|---|---|
| Passed (6 of 17) | scope, release pinned, binding, tool restrictions, filesystem isolation (tested), host secrets excluded |
| Failed (11) | G2, workflow state, provider authorization, source hashes, content exposure, runtime authorization, limits, workspace manifest, network egress, runner inside the boundary, launch boundary |

**Claude disclosure authorization:** none (0 records).

**Trust store:** **TRUST_NOT_CONFIGURED**.

## 19–23. State and integrity

| Item | Status |
|---|---|
| Gates | G0 PASS, G1 PASS, **G2 UNVERIFIED**, **G3 BLOCKED**, **G4 BLOCKED**, G5–G8 BLOCKED |
| Workflow | REQUIREMENTS_DRAFTED; checkpoint #167 verified; resume OK |
| Audit | 208 → 221 entries; chain verified |
| New run records | 12 (3 ESU, context report, readiness, `BPF-0002`, G2/G3/G4 evaluations and gate results); all 245 prior records unchanged |
| `output/` | 534 files unchanged |
| Original COBOL | 371 files unchanged |
| `.claude/` agents and skills | unchanged. The only difference since Step 8 is that Claude Code's own transient `scheduled_tasks.lock` file was removed between sessions; it is not an agent, skill or setting. |
| AI provider calls | **none**: OpenAI records unchanged (8), no BMad execution or receipt records, no Claude invocation |
| Java | **none** |

## 24. Remaining prerequisites for legitimate F3 execution

1. **Trust store** with real signers for all roles (Step 8 checklist).
2. **Signed resolutions** of the four RTNCDE00 decisions:
   - RVW-REQ-RTNCDE00-003, now via ESU-0002 (`business_sme`) or by exception;
   - RVW-REQ-RTNCDE00-004, with correction RP-8d2dd33787;
   - DR-DB2CONN-002 and DR-F2-0011-001 (`technical_authority`; shared with 5 and 15 scopes).
3. **G2.** The scope becomes READY; a `requirements_approver` (not the requester) signs; G2 PASS; advance to REQUIREMENTS_APPROVED. **This allows F3 through the forward dispatcher.**
4. **For BMad LIVE F3, additionally:**
   - Node.js and Claude Code installed inside the isolated environment;
   - a verified provider-egress component;
   - a `data_owner`-signed Anthropic / `claude-code-cli` disclosure authorization for the scope's files and `bmad-architecture`;
   - `live_execution.requested: true`;
   - a fresh isolation test;
   - a passing preflight.

Step 10 was not started.
