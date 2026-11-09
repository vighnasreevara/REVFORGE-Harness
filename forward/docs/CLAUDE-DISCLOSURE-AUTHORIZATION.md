# Claude / BMad disclosure authorization and execution preflight

This guide is for the data owner who authorizes disclosure of source to an external AI provider, and for the operator who prepares a BMad run.

## 1. Why a separate authorization

A BMad workflow runs inside a Claude Code session, which sends prompts, file contents and tool results to Anthropic. That is disclosure of source to an external provider, and it needs its own explicit, signed authorization.

**What does not count:**
- **The OpenAI source-export authorization.** It is a different contract (`signed-source-export-authorization`), bound by its schema to provider `openai`. It is read only by the OpenAI egress path and never authorizes Claude, BMad or any other provider.
- **Anything else outside the signed record.** An API key, an active Claude Code login or a configuration flag is not authorization.

## 2. The authorization

Contract `orchestrator/ai-disclosure-authorization`, signed as `signed-ai-disclosure-authorization` by a `data_owner`. It binds:

| Field | Meaning |
|---|---|
| `provider` | `name` (`anthropic` \| `openai` \| `other`), `service` (`claude-code-cli` for Claude Code), `endpoint_host` |
| `models` | `exact` model IDs or an approved model `class` |
| `scope` | selector text and scope digest |
| `source_files` | the exact files (file ID, path, sha256). Only files of the scope's units can be listed. |
| `data_classification`, `purpose`, `workflows` | the BMad workflow IDs permitted |
| `limits` | `max_files`, `max_bytes`, `max_cost_usd`, `max_runs` |
| `not_before`, `expires_at` | the validity window |
| baseline | workflow, run and baseline |

**Integrity.** The `authorization_id` (`ADA-…`) is derived from the content, so any change after preparation is detected.

**Lifecycle commands:**

```sh
provider authorization doctor [--scope S]
provider authorization prepare --provider anthropic --service claude-code-cli --scope programs:<P> \
   --workflows bmad-architecture --models <model-id> --purpose "<why>" --classification confidential \
   [--files a,b] [--max-cost-usd N] [--max-runs N] [--ttl-hours H] --out ada.json
# the data owner signs the canonical JSON of ada.json (signer_id, role=data_owner, signed_at filled in) outside REVFORGE
provider authorization verify --file signed-ada.json
provider authorization import --file signed-ada.json      # DAU-NNNN, audit-sealed
provider authorization revoke --file signed-revocation.json
```

**Re-verified at every use.** An authorization stops counting when any of these happens:
- the signer is revoked or expired;
- the scope content or any authorized source file changes;
- the baseline changes;
- it expires;
- it is revoked;
- the record is tampered with.

An authorization for one provider, service, scope or workflow never covers another.

## 3. Enforcement: what is and is not technically enforced

**Investigated runner:** Claude Code CLI 2.1.302 (headless `claude -p`).

**Network.** Model requests are end-to-end TLS from the CLI to the provider. REVFORGE cannot intercept or verify request content at the network boundary; an HTTPS proxy would see only the destination host. **No network-level enforcement is claimed.**

**Filesystem.** File tools run as the operator's OS user. `--restricted`, `--allowedTools`, `--disallowedTools` and `--permission-mode dontAsk` are enforced by the CLI itself, not by the OS. No container, separate user or mount boundary makes the original COBOL, reverse outputs or credentials unreadable to the session.

**Controls that exist:**
- an isolated workspace with a hash-verified BMad installation;
- an isolated HOME;
- `--restricted`, with web and shell tools disallowed;
- `--strict-mcp-config`;
- `--setting-sources project`;
- `--max-budget-usd` taken from the authorization;
- outputs accepted only through the receipt validator;
- sealed preflight, packet, receipt and audit records.

**Conclusion.** Without an OS-enforced boundary (for example a container or VM that mounts only the authorized files, with egress restricted to the authorized host), the authorization cannot be technically enforced. **LIVE execution is therefore blocked.** There is no force-run option.

## 4. Execution preflight

```sh
bmad executor preflight --workflow <bmad-workflow> --scope programs:<P>
```

This seals `workflow/bmad/BPF-NNNN` (contract `bmad/execution-preflight`); pass `--no-record` for a dry check. It never launches anything. Checks:
1. the scope;
2. G1 PASS for exactly this scope, re-verified now;
3. workflow state;
4. the pinned BMad release;
5. binding and agent (Build disabled);
6. current source hashes against the authorization;
7. a provider-specific signed disclosure authorization for `anthropic` / `claude-code-cli`, this scope and this workflow;
8. only authorized content would be exposed (the scope's source files and mapped inputs, plus workspace content), within the file and byte limits;
9. tool restrictions and output locations;
10. runtime execution authorization (verified isolated installation, LIVE requested);
11. limits (cost via `--max-budget-usd`, files, bytes, runs; per-request token limits are not exposed by the CLI);
12. an enforceable launch boundary.

**BMad never decides its own eligibility.** The orchestrator runs every check, and any failure refuses.
