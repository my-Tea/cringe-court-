# 0G arc

How CringeCourt uses the sponsor’s compute network and an open model to perform a trial. Source: `docs/ai`, especially [01](01_AI_COURTROOM_VISION.md), [07](07_ORCHESTRATION_ARCHITECTURE.md), [10](10_0G_PROVIDER_INTEGRATION.md) and [11](11_TESTING_AND_EVALUATION.md).

The rule of the whole layer is **AI performs, humans decide.** 0G writes the show. The jury, or an approved resolver, writes the result.

## What 0G is doing here

The court calls the **0G Compute Router**, an OpenAI-compatible gateway in front of 0G’s decentralised providers. The adapter is `OgRouterClient` in `packages/ai/src/court/og-router.ts`. It is plain `fetch`. There is no SDK and no extra dependency.

| Piece | Choice |
|---|---|
| Mainnet gateway | `https://router-api.0g.ai/v1` |
| Call | `POST /chat/completions` |
| Auth | `Authorization: Bearer sk-…` (an inference key). Management keys (`mk-…`) are rejected |
| Catalog | `GET /models` is public. A live read during development listed 62 chat models |
| Model | `OG_MODEL` is required. There is no default. If the id is missing from the live catalog, the client fails with `model-not-found` |
| Spend | Off until `COURT_AI_PROVIDER=0g`. The default provider is `mock` |

Credits are deposited as 0G at [pc.0g.ai](https://pc.0g.ai). Prices are read from the catalog or the dashboard. Nothing in the repo hard-codes a price.

The older adapter, `packages/ai/src/og-compute.ts`, still talks to individual providers through a serving broker for the legacy counsel service. The court layer does not use it. The two can sit side by side.

## Open models, not a private agent stack

Any chat model the Router lists can be selected. The client asks the catalog what that model supports and only then sends optional fields:

- `response_format: { type: json_object }` when the model is marked `json-mode`
- `temperature: 0.85` when the catalog lists `temperature`

If the catalog cannot be reached, the client logs `og.catalog.unavailable` and sends a plain chat request. The parser still pulls the first JSON object out of prose or a code fence.

There is no LangChain, no CrewAI, no tool loop and no planner. One model call writes the whole trial. A second call is allowed only to repair that JSON. After the humans have a final result, one more call writes the judge’s commentary, and that call is never retried.

| Call | Input | Output cap | How often |
|---|---|---|---|
| Trial | about 2,200–2,400 tokens | `maxTokens` 3,000 (typical script 850–1,000) | 1 |
| Repair | about 3,300–3,600 tokens | same | 0 or 1 |
| Post-verdict | about 750 tokens | 600 | 1, after the result exists |

Worst case is 3 calls per case. Each HTTP attempt times out at 45 seconds, with up to 2 retries on retryable failures.

## What the model is allowed to return

The model returns data, never actions. A trial is one JSON object: a short analysis (`core`, `tension`, `benchA`, `benchB`, `factRefs`) and one line per slot in the mode plan. Each line picks an emotion, animation, camera and crowd reaction from fixed lists, plus plain dialogue.

The court, not the model, assigns speakers, writes the vote invitation, and writes the Viral question verbatim. Unknown presets are coerced to safe defaults and recorded. Unknown speakers, missing slots and verdict leaks are rejected.

Case text travels inside `<case_data>…</case_data>` with angle brackets escaped. The system prompt tells the model that player text is data. Requests inside it to pick a winner, add evidence or change the format are ignored.

## Trust in the providers

`OG_TRUST_MODE` chooses who may serve the request.

| Mode | What is sent | What we can say afterwards |
|---|---|---|
| `standard` (default) | no trust header | Non-verifiable. No attestation |
| `verified` | `X-0G-Provider-Trust-Mode: verified` | Routed only to TeeML / TeeTLS providers, if one is healthy |
| `private` | `X-0G-Provider-Trust-Mode: private` | TeeML only, sealed inference |

The transcript stores the mode that was **requested**. The harness does not send `verify_tee` and does not check a TEE signature itself, so `verification` is `none` or `not-verified-by-harness`. The UI must not call a trial TEE-attested until a real check is added.

0G’s published policy is that prompts and completions are processed in memory and not stored, and that 0G does not train on the data. Only billing metadata is kept: request id, model, provider, token counts, trust tier, cost, timestamp.

Request ids are copied only if the provider returned one (`request_id`, then `x-request-id`, then the completion id). The client never invents one. Response headers that start with `x-0g-` or `zg-` are kept, truncated to 500 characters, for a later audit.

## Secrets and failure

The key is read on the server or a developer machine through `loadCourtAIConfig(process.env)`. The browser package never reads `process.env`. Any `VITE_*` variable that looks like an 0G key is rejected so Vite cannot bundle it. The key is not written into logs or transcripts.

| Failure | Retry? | What the player sees |
|---|---|---|
| 401 / 403 | No | Bad or disallowed key |
| 402 | No | Top up at pc.0g.ai |
| 404 / model missing | No | Fix `OG_MODEL` |
| 429 | Yes, after `Retry-After` (capped at 20 s) | Busy |
| 502, timeout, network, bad JSON | Yes, backoff 500 ms × 2ⁿ, cap 8 s | May recover |
| 503 | No | No healthy provider for that model or trust mode |
| Trial still invalid after the repair | No | `invalid-output` |
| Commentary call fails | No | A fixed template announces the real result |

Backoff retries are transport retries. They are separate from the single content-repair turn.

## Replay, so a refresh does not spend again

`getOrGenerateTrial` stores the transcript once per `caseId`. A second request returns the stored script and does not call 0G. The `contentHash` is keccak256 over the canonical content. Loading a transcript recomputes that hash and throws if it was edited. Concurrent requests in one process share one in-flight generation.

Logs carry case id, mode, purpose, attempt, model, HTTP status, request id, latency, issue codes and the content hash. They do not carry the prompt, the case text or the model output.

## What is actually proven

| Done | Not done yet |
|---|---|
| Pipeline, schemas, checks, repair, hashing, replay store | A real inference call. No `sk-` key was available while this was built |
| Router HTTP behaviour against the published docs, with a fake `fetch` | Comedy quality on a live model. The mock writer is a template |
| A live read of the public model catalog | Wiring the typed functions into the web app and server |
| Offline corpus of 60 cases plus 14 adversarial cases | The release gate: 10 live trials per mode, two human reviewers |

Before trusting it in a demo, run the smoke test in [10 §8](10_0G_PROVIDER_INTEGRATION.md#8-live-smoke-test): one Solo trial on 0G, a second run that must replay with zero new calls, then `court:eval` on a few live cases. A live eval should clear a 95% hard-pass rate, zero forbidden terms, a mean heuristic score of at least 3.5, and cross-trial similarity under 0.08. Human reviewers are still the bar for whether it is funny. The target is a mean of 3.8, with every dimension at least 3.0.
