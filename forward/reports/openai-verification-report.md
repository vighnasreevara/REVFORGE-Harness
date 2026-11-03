# OpenAI independent verification report

Run `FWD-20261031T172520Z-66b3` — baseline `352b97f0bbcbdb149c1118791aaabaa2e8e9972716bc77adc3a2f0644d24a068`. Configured provider openai, model `gpt-6-astra` (capabilities verified 2026-10-31 from https://developers.openai.com/api/docs/models/gpt-6-astra), template revforge-ovr-1.0.

**Live status: LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED.** Network enabled: false; API key present: no; trust anchor: not provisioned; valid source-export authorizations: 0 of 0.

## Runs

| Run | Kind | Mode | Provider/model | Packets | Requests | Live status |
|---|---|---|---|---|---|---|
| OVR-0001 | review | MOCK | mock / mock-deterministic-syntactic-v1 | 5 | 5 | LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED (mode MOCK; no network request was made) |
| OVR-0002 | review | LIVE | none / gpt-6-astra | 5 | 5 | LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED: openai_verification.network_enabled is false; OPENAI_API_KEY is not set |
| OVR-0003 | review | MOCK | mock / mock-deterministic-syntactic-v1 | 5 | 5 | LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED (mode MOCK; no network request was made) |
| OVR-0004 | compare | MOCK | mock / mock-deterministic-syntactic-v1 | 5 | 5 | LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED (mode MOCK; no network request was made) |
| OVR-0005 | review | LIVE | none / gpt-6-astra | 5 | 5 | LIVE_OPENAI_VERIFICATION_NOT_AUTHORIZED: openai_verification.network_enabled is false; OPENAI_API_KEY is not set; no usa |

Latest review OVR-0005: 221 eligible packet(s), 12 blocked, 5 selected (max 5), 216 eligible but not selected.

Blocked packets by reason: required source evidence is not available in the checkout 12.

## Pass A (independent interpretation)

| Packet | Run | Mode | Status | Operations verified / total | Missing deps verified / total | Failures |
|---|---|---|---|---|---|---|
| OAV-BIZ-7fef2e2ab8 | OVR-0001 | MOCK | partially_accepted | 3/31 | 0/0 |  |
| OAV-BIZ-7fef2e2ab8 | OVR-0003 | MOCK | accepted | 31/31 | 0/0 |  |
| OAV-BIZ-a28c3d71b6 | OVR-0001 | MOCK | partially_accepted | 3/31 | 0/0 |  |
| OAV-BIZ-a28c3d71b6 | OVR-0003 | MOCK | accepted | 31/31 | 0/0 |  |
| OAV-BIZ-f3b5408705 | OVR-0001 | MOCK | partially_accepted | 1/11 | 0/0 |  |
| OAV-BIZ-f3b5408705 | OVR-0003 | MOCK | accepted | 11/11 | 0/0 |  |
| OAV-CON-2df0c44b86 | OVR-0001 | MOCK | partially_accepted | 14/38 | 0/0 |  |
| OAV-CON-2df0c44b86 | OVR-0003 | MOCK | accepted | 38/38 | 0/0 |  |
| OAV-CON-a5f4b1d4fd | OVR-0001 | MOCK | accepted | 7/7 | 0/0 |  |
| OAV-CON-a5f4b1d4fd | OVR-0003 | MOCK | accepted | 7/7 | 0/0 |  |

Citations checked locally: 146 verified, 90 rejected (lines N were not in the supplied excerpt 90).

## Pass B (comparison with existing interpretations)

Classifications: PARTIAL_AGREEMENT 36, INSUFFICIENT_EVIDENCE 10, DISAGREEMENT 3.

| Packet | Run | Mode | Status | Comparisons | Disagreements | Not compared |
|---|---|---|---|---|---|---|
| OAV-BIZ-7fef2e2ab8 | OVR-0004 | MOCK | accepted | 11 | 0 | 0 |
| OAV-BIZ-a28c3d71b6 | OVR-0004 | MOCK | accepted | 11 | 0 | 0 |
| OAV-BIZ-f3b5408705 | OVR-0004 | MOCK | accepted | 6 | 1 | 0 |
| OAV-CON-2df0c44b86 | OVR-0004 | MOCK | accepted | 13 | 0 | 0 |
| OAV-CON-a5f4b1d4fd | OVR-0004 | MOCK | accepted | 8 | 2 | 0 |

### Disagreements

| Packet | Interpretation | Classification | Integrity | Explanation |
|---|---|---|---|---|
| OAV-BIZ-f3b5408705 (MOCK) | decision:agent:DR-INQPORT-001 | DISAGREEMENT | VERIFIED | [MOCK, literal overlap only] 0/1 stated value(s) occur in the independently cited lines; semantics were not compared. |
| OAV-CON-a5f4b1d4fd (MOCK) | reverse_rule:BR-144 | DISAGREEMENT | VERIFIED | [MOCK, literal overlap only] 0/1 stated value(s) occur in the independently cited lines; semantics were not compared. |
| OAV-CON-a5f4b1d4fd (MOCK) | reverse_rule:BR-145 | DISAGREEMENT | VERIFIED | [MOCK, literal overlap only] 0/3 stated value(s) occur in the independently cited lines; semantics were not compared. |

## Advisory review records

Outcomes: EXISTING_EVIDENCE_INSUFFICIENT 3, HUMAN_REVIEW_REQUIRED 2. Advisory proposals: 0 (deterministically supported 0). Every record states: advisory only: does not resolve decisions, change requirements, reduce blockers or alter any gate.

## Usage and budget

Actual provider usage: 0 call(s), 0 input / 0 output tokens, $0.

Simulated mock usage (not OpenAI usage, no cost incurred): 15 call(s), 54597 input / 28700 output tokens (would cost $1.98097 at configured pricing).

Per-run budget: {"max_calls_per_run":10,"max_input_tokens_per_run":200000,"max_output_tokens_per_run":60000,"max_cost_usd_per_run":5}.

## What this is and is not

- Mock results come from an offline syntactic reader and a literal-overlap comparison. They exercise the pipeline, contracts and validators; they are not semantic verification.
- A verified citation shows the cited evidence exists; it does not establish that an interpretation is correct.
- Model findings are advisory. No decision was resolved, no requirement approved, no blocker removed and no gate or workflow state changed.

