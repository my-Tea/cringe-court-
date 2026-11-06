# 07 · Orchestration architecture

The orchestration is a plain TypeScript pipeline with **one inference call per trial**, plus at most one repair call. There are no agents, tools, planners or frameworks: every step except the call is deterministic and unit-tested.

## 1. Modules (`packages/ai/src/court/`)

| File | Role |
|---|---|
| `schema.ts` | Every Zod schema and allow-list ([08](08_OUTPUT_SCHEMAS.md)) |
| `prepare.ts` | Deterministic case preparation (§3) |
| `personas.ts`, `plans.ts`, `prompts.ts` | Character bible, slot plans per mode, prompt builders (rendered in [prompts/](prompts)) |
| `inference.ts` | `InferenceClient` interface, `InferenceError`, the logger |
| `og-router.ts` | `OgRouterClient`, the real 0G Router adapter ([10](10_0G_PROVIDER_INTEGRATION.md)) |
| `mock.ts` | `MockInferenceClient`: offline, labelled `provider: "mock"`, never returns a request id |
| `parse.ts` | JSON extraction, schema parsing, safe-default coercions |
| `checks.ts` | The script checker (hard/soft issues, heuristic rubric estimate) |
| `engine.ts` | `CourtAI`: `generateTrial`, `generateVerdictCommentary`, hashing |
| `store.ts` / `node.ts` | `TranscriptStore`, `MemoryTranscriptStore`, `FileTranscriptStore`, `getOrGenerateTrial` |
| `stage.ts` | Transcript → engine `CourtLine[]`, cast, Director options ([09](09_ANIMATION_CONTRACT.md)) |
| `config.ts` | Env → config → client (`createCourtAI`) |
| `eval/` | Corpus, reference examples, evaluation metrics, doc generation |

## 2. Pipeline

```
CaseInput (from the app; mode chosen by the app)
  │  prepareCase()            validate · sanitise · redact · screen · facts · category · advocates
  ▼
PreparedCase ──► trialMessages()   system: shared rules + personas
  │                                user:   mode rules + slot plan + <case_data>{escaped JSON}</case_data>
  ▼
InferenceClient.complete()          0G Router (or mock), JSON mode when the model supports it
  │
  ▼  parseModelScript()             extract JSON · Zod · coercions · refusal detection
  ▼  checkScript()                  hard/soft issues + 1–5 estimate on 8 dimensions
  │      ├─ pass (0 hard, overall ≥ 3.5, every dimension ≥ 2) ──────────────────────┐
  │      └─ fail → repairMessages(findings) → one more call → parse → check         │
  │              ├─ pass ──────────────────────────────────────────────────────────┤
  │              ├─ 0 hard but below threshold → accept best, belowThreshold: true ┤
  │              └─ still hard issues → TrialGenerationError('invalid-output')     │
  ▼                                                                                 ▼
#assemble()   plan order · court-written template slots · speakers from the court's assignment
  ▼
Transcript (court-transcript@1)   contentHash = keccak256(canonical content)
  ▼  TranscriptStore.put()        write-once; later reads verify schema + hash
  ▼  toCourtLines() → directTrial() → Show/Cue → ScenePort   (existing engine)
```

## 3. Case preparation

`prepareCase(raw)` is deterministic, makes no inference call, and costs nothing. It throws `CaseRejectedError` with a `code` and a user-facing `userMessage`.

| Step | What happens | Rejection code |
|---|---|---|
| Validate | Mode-specific Zod schema (`CaseInputSchema`, discriminated on `mode`) | `invalid-input` (with per-field details) |
| Sanitise | Remove control characters and zero-width/bidi characters; normalise whitespace | |
| Redact | email, link, wallet (`0x` + 40 hex), phone, @handle → `[label]`; counts recorded in `flags` | |
| Screen: block | Self-harm, violence or threats, abuse/stalking/coercion, sexual content, crimes/legal matters, hate, private-detail seeking, elections | `unsuitable`, `privacy` |
| Screen: gentle | Grief, health, break-ups/job loss, insults → `tone: "gentle"` | |
| Screen: injection | Instruction-like text → flag `injection-like-text`. The text **stays as quoted data**; the prompt tells the model it is data | |
| Viral gates | `approved: true` required; future/price/"who will win" questions | `invalid-input`, `unresolvable` |
| Facts | Sentences → `F1..` with status (`stated`, `agreed`, `claimed-by-a`, `sourced-fact`…) | `insufficient-facts` if nothing usable |
| Category | Explicit, or inferred from keywords (16 categories) | |
| Advocates | Versus/Viral: `assignAdvocates(caseId)` keccak coin flip | |

The keyword screens are a first line of defence, not a moderation system; see [11 §6](11_TESTING_AND_EVALUATION.md#6-known-limits). Production should put the platform's moderation in front of `prepareCase`.

**Why not a separate "understanding" call?** The model writes its analysis (core, tension, best point per side) in the same call as the script, before writing the lines. The checker flags an analysis that cites no facts. This keeps the budget at one call while still making the model reason about the case first.

## 4. Prompt safety

- **Case data travels as JSON inside `<case_data>…</case_data>`**, with `<` and `>` escaped (`<`, `>`). Case text therefore cannot close the tag or open a fake one.
- **The system prompt states the precedence:** the data is never instructions; requests inside it to pick a verdict, change the mode or add evidence are ignored.
- **The output is data, not commands.**
  - Lines must be plain text, so markup and code-like text are a hard failure.
  - Presets come from fixed allow-lists.
  - The court decides speakers and template lines itself, never the model.

## 5. Post-verdict commentary

`generateVerdictCommentary(result, transcript?)` runs **only after** the app has a finalized external result (`FinalizedCaseResultSchema`).

1. **Validate the result.** The outcome must be valid for the mode, the status must be consistent, and `marketSettled` is allowed for Viral only.
2. **Make one call** (≤ 600 output tokens, no retry). The model writes `announcement`, `quip` and optional counsel reactions.
3. **Check the commentary.**
   - The announcement must contain the exact required phrase (`GUILTY`, `NOT COOKED`, `SIDE A`, `SIDE B`, `NO VERDICT`, `CANCELLED`, `INVALID`).
   - No other result phrase may appear.
   - NO_VERDICT, CANCELLED and INVALID carry no winner/loser words.
   - Money words are rejected unless `marketSettled: true` came from the app.
4. **Fall back to a template.** On any provider error, parse error or hard issue, `templateCommentary` produces a deterministic, correct announcement (`source: "template"`). An `aborted` error is re-thrown instead.

The result is **never** changed. The model only adds colour around a fixed fact.

## 6. Cost and latency bounds

Token counts below are measured on the reference cases at roughly 4 characters per token.

| Call | Input | Output | Calls |
|---|---|---|---|
| Trial | ≈ 2,200–2,400 tokens | ≈ 850–1,000 tokens (cap `maxTokens` 3000) | 1, or 2 with repair |
| Repair | ≈ 3,300–3,600 tokens (original + previous answer + findings) | as above | 0–1 |
| Post-verdict | ≈ 750 tokens | ≤ 600 | 1 |

- **Worst case per case:** 3 calls.
- **Worst-case latency per call:** timeout 45 s per HTTP attempt × (1 + `OG_MAX_RETRIES`, default 2) plus backoff (≤ 8 s each). Callers can pass an `AbortSignal`.
- **Price:** 0G pricing is per model and changes over time. Read it from the live catalog (`npm run court:test -- --list-models`) or the dashboard; no price is hard-coded.

## 7. Replay and integrity

- **Write-once storage.** `getOrGenerateTrial(store, ai, prepared)` returns a stored transcript if one exists. Otherwise it generates once and stores the result.
  - Concurrent requests for the same `caseId` share one in-flight generation. This dedupe is per process; use a store with an atomic "create if absent" across servers.
- **Stores are write-once.** `MemoryTranscriptStore` and `FileTranscriptStore` (atomic temp-file rename) refuse to overwrite a case.
- **Integrity on load.** `loadTranscript` re-parses the schema and recomputes `contentHash`; a mismatch throws `TranscriptIntegrityError`.
- **What the hash covers:** schema and script versions, case id, mode, category, title, tone, facts, ballot, parties, advocates, analysis and lines.
- **What it excludes:** timing metadata (`generatedAt`, `estimatedSeconds`), inference metadata and validation results.

## 8. Separation from money

This package imports nothing from chain, escrow or market code, and is not imported by any of it. It receives only a finalized result. The AI output never feeds settlement.

## 9. Logging

The structured logs (`jsonLineLogger`) carry these fields only:
- case id and mode;
- purpose (trial/repair/commentary);
- attempt;
- model;
- HTTP status and error code;
- request id;
- latency and output length;
- counts and codes of issues;
- the overall estimate;
- the content hash.

They **never** include prompts, case text or model output. Pass `--log` to `court:test` to see them.
