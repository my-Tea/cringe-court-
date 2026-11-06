# 01 · AI courtroom vision

> **"AI performs; humans decide."**
> The AI writes and stages a short comedic trial. It never decides the result. The jury, or an approved external resolver, does that.

## 1. What the AI layer does

Given a case the application has already accepted, the court AI:

1. **Prepares the case deterministically.** It validates, sanitises and redacts the case, screens it for safety, numbers the facts (F1, F2…), picks a category and assigns sides. No inference is involved. See [07 §3](07_ORCHESTRATION_ARCHITECTURE.md#3-case-preparation).
2. **Writes the whole trial in one model call.** The script has slot-by-slot dialogue for the four characters, plus the model's own short analysis of the case: its core, its comic tension, and the strongest point for each side.
3. **Validates the result.** That means the schema, the allow-lists, grounding, rebuttal consistency, neutrality, length and safety. If anything fails, it makes **at most one repair call**.
4. **Assembles a transcript.** Court-written template lines are added (the vote invitation, the viral question verbatim). The transcript is hashed (`keccak256` over canonical JSON) and stored write-once, so a refresh replays the same trial.
5. **After the external result is final**, it writes optional judge commentary in **one call**. That commentary is validated so that it states the result exactly. If the call or the validation fails, a deterministic template is used instead.

The engine already in the repo performs the transcript (`directTrial`, then `Show`/`Cue`, then `ScenePort`). See [09](09_ANIMATION_CONTRACT.md).

## 2. What the AI layer never does

| Never | Enforced by |
|---|---|
| Choose the mode | The app passes `mode`; the prompt says it is fixed; plans are per mode |
| Decide, predict or hint at a verdict | Prompt rules; `verdict-leak` and `neutrality` hard checks; the jury-out line is a template |
| Change the final result | Post-verdict output must contain the exact result phrase and no other; a template is used on any doubt |
| Discuss bets, odds, payouts or markets | `viral-money-talk` hard check; post-verdict money words rejected unless `marketSettled` is supplied by the app |
| Invent evidence, numbers or quotes | `fabricated-evidence`, `invented-number`, `invented-quote` hard checks |
| Execute anything the model returns | Output is data only: Zod-validated, allow-listed presets, plain text lines (`code-like` hard check) |
| See secrets or raw personal data | Redaction before prompting; the API key is server-side only (`VITE_*` key variables are rejected) |
| Regenerate on refresh | `getOrGenerateTrial` with a write-once `TranscriptStore` |

## 3. The three modes (chosen by the app)

| Mode | Who files | Ballot | Who argues what |
|---|---|---|---|
| **Solo** ([02](02_SOLO_CASE_LOGIC.md)) | One player confesses a questionable decision | `GUILTY` / `NOT_COOKED` | Miss Ratio prosecutes, Counsel Chaos defends |
| **Versus** ([03](03_VERSUS_CASE_LOGIC.md)) | Two participants in a dispute | `SIDE_A` / `SIDE_B` | A court coin flip on the case id assigns each advocate a side |
| **Viral** ([04](04_VIRAL_CASE_LOGIC.md)) | Curators approve a public question | `SIDE_A` / `SIDE_B`, resolved externally | Same coin flip; the judge gives neutral background and a balanced close |

## 4. Quality bar

A trial is good when a viewer who knows nothing about the case would:

- understand it within the first line;
- recognise specific details from the case, not a template with the nouns swapped;
- hear each counsel answer what the other just said;
- laugh at least twice;
- feel that both sides had a real chance.

This is measured by the rubric in [11](11_TESTING_AND_EVALUATION.md) (8 dimensions, scored 1–5).

**Runtime targets:**
- Solo: 60–100 s.
- Versus and Viral: 70–110 s, because they have two extra exchanges.

## 5. Budget

- **Per trial:** 1 inference call, or 2 if the repair is needed (`maxAttempts`, configurable 1–3).
- **Per verdict:** 1 call for commentary, never retried.
- No agent loop, no tool calls, and no framework (no LangChain or CrewAI).
- Cost figures are in [07 §6](07_ORCHESTRATION_ARCHITECTURE.md#6-cost-and-latency-bounds).
