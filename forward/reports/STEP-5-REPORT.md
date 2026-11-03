# STEP 5: independent OpenAI semantic verification

Run `FWD-20261031T172520Z-66b3`, baseline `352b97f0bbcbdb149c1118791aaabaa2e8e9972716bc77adc3a2f0644d24a068`, 2026-10-31. Branch `main`, commit `b092004`. Nothing was committed or pushed.

**Result: `LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED`.** No real OpenAI call was made. All execution below is either OFFLINE or MOCK. Mock results exercise the pipeline and are not semantic verification.

## 1. What was implemented

| Component | Files |
|---|---|
| OpenAI SDK adapter (Responses API, Structured Outputs) | `runtime/src/openai/provider.ts` |
| Signed source-export authorization and network-boundary guard | `runtime/src/openai/authorization.ts` (+ guarded `fetch` in `provider.ts`) |
| Fixed verifier templates and DATA blocks | `runtime/src/openai/prompts.ts` |
| Citation validator (local, read-only) | `runtime/src/openai/citations.ts` |
| Two-pass engine: selection, budgets, retries, timeouts, concurrency, persistence, advisory records | `runtime/src/openai/engine.ts` |
| Configuration and redaction | `runtime/src/openai/config.ts` |
| Report and usage | `runtime/src/openai/report.ts` |
| CLI: `verification openai doctor\|packets\|prepare\|review\|compare\|report\|usage\|authorize\|revoke\|authorization-request` | `runtime/src/commands/openai.ts` |
| Model-output and record contracts | `contracts/openai/` (7 schemas) and `contracts/orchestrator/signed-source-export-{authorization,revocation}.schema.json` |
| Tests | `tests/step5.test.ts` (12 tests covering all 32 required scenarios) |
| Operations guide | `docs/OPENAI-VERIFICATION-OPERATIONS.md` |

**Modified files:**
- `package.json` and `package-lock.json`: added `openai@7.35.0`, pinned; published 2026-10-16.
- `config/forward.config.json` and `contracts/forward-config.schema.json`: new `openai_verification` section; network disabled and OFFLINE by default.
- `runtime/src/blockers/openai.ts`:
  - export status is now computed from verified authorizations (still `NOT_AUTHORIZED`);
  - per-packet status is `AUTHORIZED_FOR_EXPORT` only when a packet is in a valid authorization's scope;
  - optional extra categories for packet preparation.
- `runtime/src/blockers/pipeline.ts`: preparation uses the configured `prepare_also_categories`.
- `runtime/src/commands/verification.ts`: routes `verification openai …`.
- `runtime/src/cli.ts`: `main` can await asynchronous commands; usage text.

**SDK and API.** Calls go through `client.responses.create` with:
- `instructions`;
- one `input_text` DATA item;
- `text.format = { type: "json_schema", name, schema, strict: true }`;
- `max_output_tokens`;
- `store: false`;
- no tools.

The Chat Completions `response_format` parameter is never sent, and the guard refuses any payload containing it. SDK-internal retries are disabled, so every retry passes through the engine and the guard again. Refusals (`content[].type === "refusal"`), `status: "incomplete"` with `incomplete_details.reason`, invalid JSON, schema violations and API errors are each recorded as separate failure kinds:
- **Retryable:** timeout, 429, 5xx, 409, connection errors.
- **Not retryable:** 400, 401, 403, 404, 422, and egress refusals.

**Model.** The configured model is `gpt-6-astra`. On 2026-10-31 I checked its official model page and the Structured Outputs guide:
- Responses API `v1/responses` and `structured_outputs` are supported;
- 1,050,000-token context and 128,000 max output tokens;
- pricing is $10 input, $1 cached input, $50 output per 1M tokens.

The verification source and date are recorded in the configuration. The model is never substituted. The schemas use only the strict subset the guide lists: every field required, `additionalProperties: false`, nullable via type unions, `$defs`/`$ref`, no `allOf`/`not`/`if`, no `minLength`.

## 2. Authorization and trust (actual state)

| Prerequisite | State |
|---|---|
| `network_enabled` | `false` (default) |
| `OPENAI_API_KEY` | not set |
| Trust anchor | not provisioned (`approval.trust_store` is null) |
| Signed source-export authorizations | none |

An export authorization is signed by a separate `data_owner` role and verified against the trust store. It binds:
- the baseline;
- exact file paths and SHA-256;
- the packets;
- the provider and endpoint;
- the model(s);
- the purpose and data classification;
- the passes and disclosure level;
- size and request limits;
- the validity window.

It can be revoked by a signed revocation. Before every HTTP request, retries included, the guard re-checks:
- that the authorization is still valid;
- that every excerpt line is the current text of an authorized, unchanged file;
- the model, destination, template and data shape;
- the limits;
- that no credentials are present.

There is no bypass path.

## 3. Execution on the real packets

| Step | Result |
|---|---|
| Step 4.5 packet set (`openai-verification-queue-0004`) | Valid: audit seals, contracts, baseline and the Pass A leak check all pass. 231 packets, all `NOT_AUTHORIZED`; 219 eligible, 12 blocked (source not in the checkout). |
| `verification openai prepare` | `openai-verification-queue-0005`: 233 packets (adds 2 contradictory-rule roots), all `NOT_AUTHORIZED`, 0 leaks. 221 eligible, 12 blocked. |
| `review --mode MOCK` (OVR-0001) | 5 packets. **Exposed a validator defect:** only the first excerpt range of a multi-range file was treated as supplied, so 90 valid citations were rejected. Fixed, with a regression test. OVR-0001 is kept as recorded. |
| `review --mode MOCK` (OVR-0003) | 5 packets selected by priority: 2 contradictory-rule roots, then 3 business-interpretation roots. Pass A: all 5 accepted; 118 operations, **118/118 citations verified locally**; 0 missing dependencies. 216 eligible packets not selected (bounded batch of 5). |
| `compare --mode MOCK` (OVR-0004) | Pass B: 49 comparisons: 36 PARTIAL_AGREEMENT, 10 INSUFFICIENT_EVIDENCE, 3 DISAGREEMENT. Advisory outcomes: 3 EXISTING_EVIDENCE_INSUFFICIENT, 2 HUMAN_REVIEW_REQUIRED. 0 advisory proposals. |
| `review --mode LIVE` (OVR-0002, OVR-0005) | Refused before any provider existed. The reasons: network disabled; no API key; no trust anchor; no export authorization. **0 network requests.** |
| `verification openai report` / `usage` | `reports/openai-verification-report.md` and `.json`. **Actual provider usage: 0 calls, 0 tokens, $0.** Simulated mock usage: 15 calls, an estimate of characters ÷ 4 with no real cost. |

**What the mock disagreements mean.** The 3 DISAGREEMENTs (DR-INQPORT-001; BR-144 and BR-145 in the AUDITLOG cross-batch root) come from the mock's literal-overlap rule: a value stated in the interpretation does not occur in the lines the mock cited. They are not semantic findings. They show the comparison, the classification and the advisory-record path work end to end.

## 4. Status and integrity

- **Gates:** G0 PASS, G1 PASS, G2 UNVERIFIED (395 blocking findings; no trust anchor; no approval), G3–G8 BLOCKED. The workflow is in REQUIREMENTS_DRAFTED; checkpoint #136 is verified and resume works.
- **Unchanged:**
  - all 176 pre-existing workflow records (receipts, deliverables, decisions, Step 4.5 records, gates);
  - all 534 reverse `output/` files;
  - the COBOL checkout (clean git status).

  The audit chain (167 entries) is linked, and the 3 earlier history entries are identical.
- **No decision resolved:** every decision keeps its resolution status, and the blocker count is unchanged (also proven in tests).
- **No Java:** none exists, and generation is not authorized.
- **No secrets:** no key-shaped string appears in any record, report or audit entry.
- **Tests:** 183/183 pass (171 existing plus 12 new). The only existing-test interaction was the "no hard-coded system names" guard, which caught a constant named like a real copybook; I renamed the constant.

## 5. Distinctions

| Category | In this step |
|---|---|
| Implemented integration | SDK adapter, guard, two-pass engine, validator, contracts, CLI, budgets, accounting |
| Mock execution | OVR-0001, OVR-0003 (Pass A) and OVR-0004 (Pass B) on 5 real packets; offline, syntactic and literal-overlap only |
| Real OpenAI execution | **None** (`LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED`) |
| Deterministically verified evidence | Step 4.5 results unchanged; Step 5 verified that mock citations match the source (evidence exists, not interpretation) |
| AI-advisory findings | Only mock outputs, labelled as such; none relied on |
| Human-authorized decisions | None (0 resolutions, 0 approvals, 0 export authorizations) |

## 6. Remaining prerequisites for LIVE verification and BMad integration

1. A key custodian provisions the trust store, including a `data_owner` public key.
2. A data owner signs a source-export authorization for a bounded packet set.
3. An operator sets `network_enabled: true` and `mode: LIVE`, provides `OPENAI_API_KEY`, and re-verifies the model and pricing documentation.
4. A LIVE review and compare run on a small batch, with their advisory results routed to the Step 4.5 review queue.
5. SMEs and technical authorities sign resolutions for the blocking decisions (367).
6. A signed G2 approval of a READY scope is given.

BMad integration should not begin before G2 passes on approved requirements.
