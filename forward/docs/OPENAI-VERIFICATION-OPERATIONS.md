# OpenAI independent verification: operations

This guide is for operators of the REVFORGE forward runtime, for the data owner who authorizes source export, and for the key custodian. It explains how independent OpenAI verification works, how source export is authorized, how to run it safely, and how to read the results.

**What the verifier is.** OpenAI is used as an independent analyst. The TypeScript runtime remains the authority for:
- dispatch;
- integrity;
- contract validation;
- citation checking;
- decisions;
- gates;
- workflow state.

Every model finding is **advisory**. Nothing produced by the model resolves a decision, approves a requirement, removes a blocker, changes a gate or advances the workflow.

## 1. Modes

| Mode | Network | What happens |
|---|---|---|
| `OFFLINE` (default) | none | Selects packets, builds the exact requests and records whether each would be allowed in LIVE mode; no provider is called. |
| `MOCK` | none | Runs the complete two-pass pipeline with an offline deterministic mock. The mock reads the excerpts syntactically and compares literals; it is **not** semantic verification, and its results are labelled `mock`. |
| `LIVE` | OpenAI Responses API | Runs only when **all** of these hold: `openai_verification.network_enabled = true`, `mode = LIVE`, the API key is set, a model is configured, a trust anchor is usable, and a signed source-export authorization covers the packet. |

**Not proof of authorization:**
- an API key;
- a CLI flag;
- a G2 requirements approval;
- a statement by an agent.

## 2. Configuration (`openai_verification` in `forward/config/forward.config.json`)

| Setting | Value / behaviour |
|---|---|
| `mode` | `OFFLINE` by default |
| `network_enabled` | `false` by default |
| `endpoint` | `https://api.openai.com/v1/responses` |
| `model` | `gpt-6-astra`; never substituted |
| `model_verification` | Records where and when the model's capabilities were verified (official model page, 2026-10-31: Responses API supported, `structured_outputs` supported, 1,050,000-token context, 128,000 max output tokens). Re-verify before LIVE use. |
| `pricing` | $10 input, $1 cached input, $50 output per 1M tokens, from the official model page on 2026-10-31. If pricing is `null`, cost is reported as null. |
| `request` | Output-token cap, timeout, retries (backoff applied by the engine; SDK-internal retries are off), concurrency, `store: false` |
| `budget` | Per-run caps on calls, input tokens, output tokens and USD. They are checked before every attempt, retries included. |
| `selection` | `max_packets` (bounded batch) and `category_priority`. `prepare_also_categories` additionally prepares packets for, by default, contradictory business rules. |
| `source_export.required_roles` | `["data_owner"]`: the trust-store role that may authorize export |

**SDK.** The runtime uses the official `openai` package pinned at `7.35.0`, calling `client.responses.create` with:
- `text.format` `{ type: "json_schema", name, schema, strict: true }`;
- `store: false`;
- no tools.

`response_format`, the Chat Completions parameter, is never sent to the Responses API. The runtime refuses any payload that contains it.

## 3. Source-export authorization (data owner)

Export is authorized per baseline, per file hash and per packet, by a signed record that the runtime verifies against the external trust store. This is the same trust store used for G2, but with a **separate role** (`data_owner`).

1. **The key custodian** adds the data owner's Ed25519 **public** key with role `data_owner` to the trust store (see `HUMAN-APPROVAL-OPERATIONS.md` §4). No private key ever enters the repository.
2. **The operator** prepares an unsigned request:

   ```sh
   node forward/dist/runtime/src/cli.js verification openai authorization-request --run <RUN> --packets OAV-...,OAV-... --out export-request.json
   ```

3. **The data owner reviews it.** The request binds:
   - the baseline digest;
   - the exact source files and their SHA-256 (`scope.files`);
   - the packets;
   - the destination provider and endpoint;
   - the permitted model(s);
   - the purpose (`independent_semantic_verification`);
   - the data classification;
   - the passes (A and/or B);
   - the disclosure level: `source_excerpts_only` forbids Pass B, which sends derived analysis;
   - limits (requests, characters per request, excerpt lines per request);
   - `not_before` and `expires_at`.

4. **The data owner sets the remaining fields:** `authorization_id` (`SEA-…`), `signer_id`, `role` and the expiry.
5. **The data owner signs** the UTF-8 canonical JSON of `authorization` (keys sorted, no whitespace) with Ed25519. Wrap the result as:

   ```json
   {"contract":"signed-source-export-authorization","authorization":{…},"signature":{"algorithm":"ed25519","value":"<base64>"}}
   ```

   ```sh
   node -e "const {canonicalize}=require('./forward/dist/runtime/src/approval/canonical');process.stdout.write(canonicalize(JSON.parse(require('fs').readFileSync('export-request.json','utf8'))))" > export.canonical
   openssl pkeyutl -sign -inkey ~/.keys/data-owner.pem -rawin -in export.canonical | base64 -w0 > export.sig
   ```

6. **The operator imports it:**

   ```sh
   verification openai authorize --file signed-export.json
   ```

   It is recorded only if all of these hold:
   - the signature verifies;
   - the signer holds `data_owner`;
   - the baseline, run and workflow match;
   - it is unexpired and its ID is unique.

   Rejected imports are written to the audit log.

7. **To revoke,** import a signed `source-export-revocation` with `verification openai revoke --file …`. Revoking or expiring the signer in the trust store also invalidates every authorization that signer issued.

**At the network boundary.** The SDK is given a guarded `fetch`. Before **every** HTTP request, including each retry, the runtime re-parses the exact outgoing body and re-checks:
- the destination, the model, the fixed instructions, and that Structured Outputs is strict with no tools and `store: false`;
- the Pass A or Pass B data shape;
- that the authorization is valid now and not revoked;
- the packet, pass and disclosure scope;
- that every excerpt line is the current text of an authorized, unchanged file under the safe source root;
- the size and request limits;
- that no credential-like material is present.

A refused request never reaches the network. There is no alternate send path: the Step 4.5 `sendVerificationPacket` always refuses.

## 4. Running

```sh
verification openai doctor                      # configuration, SDK, key presence (never shown), trust, authorizations, LIVE status
verification openai packets                     # integrity of the prepared packet set, eligibility, selection preview
verification openai prepare                     # (re)prepare packets from the current root causes
verification openai review  --mode MOCK [--max N] [--packets OAV-...]   # Pass A
verification openai compare --mode MOCK --review-run OVR-NNNN          # Pass B + advisory records
verification openai report  [--out FILE]        # Markdown and JSON report
verification openai usage                       # actual provider usage vs simulated mock usage
```

Replace `--mode MOCK` with `--mode LIVE` only after `doctor` shows `LIVE_PREREQUISITES_MET`.

**Packets that are blocked** (with the exact reason):
- no source evidence in the checkout;
- stale source hashes;
- a root cause that is resolved or no longer blocking;
- a failed leak check.

**Priority order:** category, then whether deterministic evidence already establishes the fact (those go later), then severity, then downstream impact.

## 5. What is recorded (under `forward/runs/<run>/workflow/openai/`, each sealed in the audit log)

- **`OVR-NNNN.json`:** the run record. It holds the selection, every request attempt and its egress evaluation, the payload hash, the outcome and any redacted error, usage, budget and live status.
- **`pass-a/<packet>.vN.json`:** the independent interpretation. Each finding records its citations, each locally checked, together with:
  - the source file IDs and hashes;
  - the model, template and response IDs;
  - the evidence integrity (`VERIFIED` or `REJECTED`);
  - the semantic status (`ADVISORY_UNREVIEWED`);
  - deterministic support;
  - missing context.
- **`pass-b/<packet>.vN.json`:** comparisons with each existing interpretation, classified as `AGREEMENT`, `PARTIAL_AGREEMENT`, `DISAGREEMENT`, `INSUFFICIENT_EVIDENCE` or `UNSUPPORTED_INTERPRETATION`.
- **`advisory/<packet>.vN.json`:** the advisory outcome, linked to the root cause, decisions, rules and gaps (with their reverse-run binding) and requirements, plus advisory proposals marked `deterministically_supported`. Every record carries `binding: "advisory only…"`.

**How citations are checked locally.** Each citation must:
- name a supplied file inside the source root;
- match its current hash;
- cite existing lines that were in the supplied excerpt;
- quote text that occurs in those lines (fixed-format columns removed);
- carry a real permanent ID for that file and those lines.

Operations must actually appear in the cited lines, and the data names they use must be declared. A dependency must be referenced in the cited lines and genuinely absent. Invented lines, fields, IDs, calculations and dependencies are rejected individually.

## 6. Prompt-injection controls

- **Instructions:** fixed and versioned (`revforge-ovr-1.0`). All source, comments, literals, reverse artifacts and earlier outputs go only into a delimited DATA block that the instructions declare untrusted. The model reports any embedded instructions in `untrusted_instructions_observed`; nothing acts on them.
- **No capabilities:** no tools, no file access, no browsing. Model output is parsed as JSON, validated against the local contract and checked citation by citation. It cannot cause a file read outside the packet, a command, or a change to a decision or gate.
- **Pass A independence:** Pass A is built only from the Step 4.5 Pass A packet. A shingle leak check and a strict data-shape check (at build time and at the network boundary) reject any interpretation text.

## 7. Interpreting results

| Kind of result | What it is |
|---|---|
| Deterministically verified evidence (Step 4.5) | Stronger than any model statement. |
| A verified model citation | Proves the cited evidence exists, not that the interpretation is correct. |
| Agreement between two models | Does not establish business correctness. |
| Disagreements and advisory proposals | Go to the Step 4.5 review queue for deterministic re-checks and **signed** human decisions. |

## 8. Cost and usage

- **Live runs:** usage comes from the provider's reported `usage` (`input_tokens`, `input_tokens_details.cached_tokens`, `output_tokens`), priced with the configured rates.
- **Mock runs:** usage is a local estimate (characters ÷ 4), reported separately as simulated usage with no real cost.
- **Budgets:** checked before each attempt from an estimate, then charged with actual usage.
