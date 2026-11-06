# 10 · 0G provider integration

The court AI calls the **0G Compute Router**, an OpenAI-compatible gateway in front of 0G's decentralised compute providers.

The adapter is `OgRouterClient` in `packages/ai/src/court/og-router.ts`. It uses plain `fetch`, with no SDK and no new dependencies.

> **Status: implemented, not yet exercised live.** No API key was available during development, so **no real inference request has been sent.** The HTTP behaviour (headers, retries, error mapping, request-id extraction) is tested with a fake `fetch` that follows the published docs. The public model catalog *was* fetched live. Run the smoke test in §8 before relying on it.

## 1. Verified facts and sources

Checked on 2026-11-06. If 0G changes these, update this table and the adapter together.

| Fact | Source |
|---|---|
| **Mainnet base URL** is `https://router-api.0g.ai/v1`. Testnet is a separate environment with its own URL, balances and keys | [Router overview](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview) |
| **OpenAI-compatible**: `POST /chat/completions`, OpenAI request and response shapes | Router overview |
| **Auth**: `Authorization: Bearer <API key>`. Inference keys are `sk-…`; management keys (`mk-…`) cannot run inference | [Authentication](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/authentication) |
| **`GET /models` is public** and lists each model's `supported_parameters` | [Models](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/models); live catalog read during development (62 chat models listed) |
| **Errors** use `{"error":{"message","type","code"},"request_id"}`. `request_id` is top-level and present "when available" | [Errors](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/errors) |
| **Status codes**: 400 / 401 / 402 / 403 are not retryable without a change. 429: honour `Retry-After`. 502: failover exhausted, a retry may help. 503: no healthy provider, unlikely to resolve in seconds | Errors |
| **Trust modes** `standard` (default; "non-verifiable: no attestation or signed proof to check"), `verified` (TeeML / TeeTLS providers) and `private` (TeeML only; sealed inference). Set per request with `X-0G-Provider-Trust-Mode`, or per API key in the dashboard | [Privacy & ZDR](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/privacy) |
| **Retention**: prompts and completions are processed in memory and not stored. Only billing metadata is kept (request id, model, provider, token counts, trust tier, cost, timestamp). 0G states it does not train on your data | Privacy & ZDR |
| An optional `verify_tee: true` request field asks the Router to verify the provider's TEE signature synchronously | Privacy & ZDR (**not used by this harness**, §5) |

**Not hard-coded, on purpose:**
- **Model id.** `OG_MODEL` is required; there is no default. The client checks it against the live catalog and fails with `model-not-found` if it is absent.
- **Prices.** They vary by model and over time.

## 2. Setup (Windows PowerShell)

1. **Create an account and an API key.** Go to https://pc.0g.ai, open API Keys, and create an `sk-…` key. Deposit 0G for credits; Deposits & Billing in the docs explains how.
2. **Pick a model:**
   ```powershell
   npm run court:test -- --list-models
   ```
   Prefer a model marked `json-mode`, meaning it supports `response_format`.
3. **Configure the key locally.** `.env.court` is git-ignored.
   ```powershell
   Copy-Item packages/ai/.env.court.example .env.court
   notepad .env.court   # set OG_API_KEY and OG_MODEL
   ```
4. **Run one real trial:**
   ```powershell
   npm run court:test -- --example solo --provider 0g --env-file .env.court --log
   ```
5. **Optional: run the same thing with session environment variables** instead of a file:
   ```powershell
   $env:COURT_AI_PROVIDER = "0g"; $env:OG_API_KEY = "sk-..."; $env:OG_MODEL = "<model id>"
   npm run court:test -- --example versus --verdict SIDE_A
   Remove-Item Env:OG_API_KEY
   ```

## 3. Configuration

`loadCourtAIConfig(env)` in `config.ts` reads only these variables.

| Variable | Default | Notes |
|---|---|---|
| `COURT_AI_PROVIDER` | `mock` | `mock` \| `0g`. Spending credits is an explicit opt-in |
| `OG_API_KEY` | — | Required for `0g`. Must not start with `mk-` |
| `OG_MODEL` | — | Required for `0g`. A chat model id from the live catalog |
| `OG_BASE_URL` | `https://router-api.0g.ai/v1` | Must be https (localhost http allowed for tests) |
| `OG_TRUST_MODE` | `standard` | `standard` \| `verified` \| `private` |
| `OG_TIMEOUT_MS` | `45000` | Per HTTP attempt (1 000–300 000) |
| `OG_MAX_RETRIES` | `2` | Retries for retryable failures only (0–5) |
| `OG_JSON_MODE` | `auto` | `auto` reads the catalog; `on` / `off` force it |

All problems are reported together as a `CourtConfigError`.

**Secret handling:**
- Any `VITE_*` variable whose name contains OG/0G and KEY/SECRET is rejected, because Vite would bundle it into the browser.
- The key is read only on the server and the developer machine.
- `@cringe-court/ai/court` itself never reads `process.env`. The server passes its env explicitly: `createCourtAI(loadCourtAIConfig(process.env))`.
- The key never appears in logs or transcripts.

## 4. Request

```http
POST {OG_BASE_URL}/chat/completions
Authorization: Bearer sk-…
Content-Type: application/json
X-0G-Provider-Trust-Mode: verified        # only when OG_TRUST_MODE is verified or private

{ "model": "<OG_MODEL>", "messages": [...], "max_tokens": 3000,
  "temperature": 0.85,                    # only if the catalog lists temperature
  "response_format": {"type":"json_object"} }   # only if the catalog lists response_format
```

**When the catalog is unreachable:**
- The client logs `og.catalog.unavailable`.
- It sends a plain request without the optional fields.
- The parser still extracts JSON from prose or code fences.

## 5. Trust modes: what is and is not claimed

| `OG_TRUST_MODE` | Header sent | `transcript.inference.trustMode` | `verification` |
|---|---|---|---|
| `standard` | none | `standard` | `none` |
| `verified` | `X-0G-Provider-Trust-Mode: verified` | `verified` | `not-verified-by-harness` |
| `private` | `X-0G-Provider-Trust-Mode: private` | `private` | `not-verified-by-harness` |

**What this records:** the mode that was **requested**. The Router docs say verified and private requests are routed only to TEE providers. If no such provider is available, they fail with 503 `no_provider_for_trust_mode`.

**What this does not do:** the harness does not check any attestation or signature itself, and does not send `verify_tee`. That is why `verification` is never "verified".

**Rules for the UI:**
- Do not claim a trial was TEE-attested unless you add verification (for example `verify_tee`, or dstack-verifier on the provider attestation) and record its result.
- Standard mode has no attestation at all.

## 6. Errors and retries

Every failure becomes an `InferenceError(code, message, retryable, status?, requestId?)`.

| HTTP / condition | `code` | Retried? | User-facing meaning |
|---|---|---|---|
| 400 | `bad-request` | No | Request rejected (model or feature mismatch) |
| 401 | `auth` | No | Key missing or invalid |
| 402 | `insufficient-balance` | No | Top up at pc.0g.ai |
| 403 | `forbidden` | No | Key not allowed |
| 404 | `not-found` | No | Endpoint or model not found |
| model absent from catalog | `model-not-found` | No | Fix `OG_MODEL` |
| 429 | `rate-limited` | Yes, after `Retry-After` (numeric seconds, capped at 20 s), else backoff | Busy |
| 502 | `provider-error` | Yes | Providers failed; may recover |
| 503 | `no-provider` | **No** | No healthy provider; try another model or wait |
| other 5xx | `provider-error` | Yes | |
| timeout / network | `timeout` / `network` | Yes | |
| non-JSON or empty body | `invalid-response` | Yes | |
| caller abort | `aborted` | No | |
| bad config | `config` | No | |

**Retry policy:**
- Backoff is 500 ms × 2ⁿ, capped at 8 s.
- At most `OG_MAX_RETRIES` retries, so 3 HTTP attempts by default.
- This is separate from the court's single *content* repair turn ([07 §2](07_ORCHESTRATION_ARCHITECTURE.md#2-pipeline)).

**Where errors surface:**
- **Trial generation:** an `InferenceError` propagates to the caller, which shows a retry message.
- **Post-verdict:** any `InferenceError` except `aborted` falls back to the template announcement.

## 7. Request ids and response metadata

**Request ids are never invented.** `requestIds` contains only identifiers the provider actually returned, chosen per response in this order:
1. body `request_id`;
2. the `x-request-id` header;
3. the completion `id`.

If none is present, nothing is recorded. The mock always records none.

**`responseMeta` keeps raw evidence verbatim** for audit, with values truncated to 500 characters:
- `x-0g-*` and `zg-*` headers;
- `x-request-id`;
- `completionId`;
- body fields starting with `x_0g`, `x0g` or `provider`.

The 0G docs do not currently document provider or attestation fields on successful responses, so expect this to be mostly empty until the smoke test shows what is really returned.

## 8. Live smoke test

Run this once with a funded key, then record the outcome below. Never paste the key into an issue or chat.

```powershell
npm run court:test -- --example solo --provider 0g --env-file .env.court --log --save .court-transcripts
npm run court:test -- --example solo --provider 0g --env-file .env.court --save .court-transcripts   # must replay, 0 new calls
npm run court:eval -- --provider 0g --env-file .env.court --mode solo --limit 3 --out eval-solo.json
```

**What to check:**
1. The banner shows `Provider: 0G Compute Router`.
2. `request ids` lists real ids.
3. `og.chat.ok` log lines show HTTP latency.
4. The second command prints the stored transcript without calling the provider.
5. Record which `responseMeta` keys appear, and update §7.

| Date | Model | Trust mode | Result | Notes |
|---|---|---|---|---|
| — | — | — | **not yet run** | No credentials during development |

## 9. Relationship to the older adapter

`packages/ai/src/og-compute.ts` (`OgComputeChatClient`) is the earlier adapter, used by the existing counsel service. It talks to individual providers through an injected serving-broker SDK.

The court layer does not use it and does not change it. The two can coexist. Moving the legacy service to the Router is a separate decision.
