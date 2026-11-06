# @cringe-court/ai

The real `AiCounselPort` for CringeCourt: the AI prosecution and defense, the intake angle suggestions and Judge Gavel.exe's sentence line. The legacy counsel service has zero runtime dependencies beyond `@cringe-court/core`, and it never imports the 0G SDK. The court intelligence layer (`./court`, below) adds `zod`, which the repo already uses.

```
CounselService (AiCounselPort)  -->  ChatClient  -->  OgComputeChatClient  -->  injected OgBroker (0G SDK)
                                                 \->  FixtureChatClient (offline, deterministic)
```

## The information wall (D1)

`buildBenchPrompt` builds a bench's prompt only from that bench's own `CounselBrief` plus the other bench's `publicText`. The other side's `privateNotes` and `angle` never enter the prompt, so they cannot leak into its lines. Tests build real Solo, Versus and Grand Jury requests with `BASE_MODES` and `briefsFor` and assert this on both the prompt builder and the messages actually sent to the client.

User text (stories, angle, exhibits, nickname, title, verdict label) is capped and placed as JSON inside a single `<case_data>` block. `<` and `>` are escaped inside it, so text cannot close the block, and the system prompt says everything inside is data, never instructions.

## Fairness

- One model call per bench, with the same `maxOutputTokens`, temperature, response format and input budget. Bench calls run sequentially so failures are deterministic.
- A prompt over `budget.maxInputTokens` (about 4 chars per token) throws `CounselError('budget-exceeded')` and is not retried.
- Judge lines ("call to order", "THE JURY IS OUT") are templates, not model output. The AI never produces a verdict. `sentence()` only flavours the human verdict label it is given, and falls back to a template if the model fails.
- Teaser scope (D3) is call to order, openings and "THE JURY IS OUT." only. On a full draft without an explicit redraft, openings carried over from a teaser are kept and the model is told not to rewrite them.
- `redraft: 0 | 1` with a complete `carryOver` re-calls only that bench and keeps the other bench's lines.
- `assessBalance` is deterministic: each bench needs an opening (and a closing in full scope), and the shorter bench must reach 60% of the longer one's word count.

## Output contract

The model must answer `{"lines":[{"segment","beat"?,"text","exhibitId"?}]}`. Parsing is strict (Segment and Beat unions from core, 280 char clamp, known exhibit ids only) but tolerates code fences and prose around the JSON. Anything else is a retryable `invalid-output`; the service retries once by default.

## 0G Compute wiring

```ts
import { CounselService, OgComputeChatClient, createOgBrokerFromSdk } from '@cringe-court/ai';
// App code (not this package) owns the SDK import and wallet.
const sdkBroker = await createZGComputeNetworkBroker(wallet);

const client = new OgComputeChatClient({
  broker: createOgBrokerFromSdk(sdkBroker),
  // userBroker: createOgBrokerFromSdk(userSdkBroker), // D12 Pass; off by default
  providerAddress: process.env.OG_PROVIDER!,
  timeoutMs: 60_000,
});
const counsel = new CounselService({ client, model: 'og-compute' });
```

Flow per call: `getServiceMetadata` (cached) -> `getRequestHeaders(provider, userContent)` -> `POST {endpoint}/chat/completions` (OpenAI-compatible) -> `processResponse(provider, content, chatId)`. HTTP 429 maps to `rate-limited`, 5xx, network errors and timeouts to `unavailable` (all retryable), abort to `aborted`, a failed verification to `invalid-output`. `payer: 'user-credits'` without a `userBroker` throws `CounselError('unavailable', 'Personal 0G credits are not enabled (D12 gate)')`.

## What is not verified

- The method names `getServiceMetadata`, `getRequestHeaders` and `processResponse` match what public 0G docs and search results describe, but they were NOT checked against the live SDK. Search results suggest the package was renamed from `@0glabs/0g-serving-broker` to `@0gfoundation/0g-compute-ts-sdk`, that `getServiceMetadata` may take an optional model argument, and that the argument order and meaning of `getRequestHeaders` and `processResponse` differ between versions. `createOgBrokerFromSdk` is the single place to adjust.
- The chat id is read from the `ZG-Res-Key` response header, falling back to the body `id`. That header is from memory of the docs, not confirmed.
- No test talks to a real provider; everything uses a fake broker and fake fetch.

## Court intelligence layer (`@cringe-court/ai/court`)

A separate, newer layer that writes and validates a complete comedic trial for Solo, Versus and Viral cases with one 0G Router call (plus at most one repair), stores it write-once with a content hash, and hands the game typed `CourtLine`s for the existing Director. It does not replace or change the counsel service above.

```
prepareCase -> trialMessages -> InferenceClient (OgRouterClient | MockInferenceClient)
            -> parseModelScript -> checkScript (-> one repair) -> Transcript (hash) -> TranscriptStore
            -> toCourtLines + courtCast + courtDirectorOptions -> engine directTrial()
```

- Entry points: `@cringe-court/ai/court` (browser-safe, no secrets) and `@cringe-court/ai/court/node` (`FileTranscriptStore`).
- Configuration: `loadCourtAIConfig(env)` / `createCourtAI(config)`; env vars and setup in [docs/ai/10](../../docs/ai/10_0G_PROVIDER_INTEGRATION.md). Template: [`.env.court.example`](.env.court.example).
- Developer runner: `npm run court:test` (see the header of `scripts/court-test.ts`), corpus: `npm run court:eval`, generated prompt docs: `npm run court:prompts`.
- Full documentation: [docs/ai/README.md](../../docs/ai/README.md).
- **Live 0G inference has not been executed yet** (no credentials during development); see docs/ai/10 §8.
