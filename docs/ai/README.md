# CringeCourt AI courtroom: documentation

This folder documents the **courtroom intelligence layer**: the code that turns a case into a short, funny, fair, replayable courtroom performance, using an LLM served by the **0G Compute Router**.

It covers only the AI layer. Jury voting, World ID, escrow, markets and settlement live elsewhere, and the AI never touches them.

Code: [`packages/ai/src/court/`](../../packages/ai/src/court). Import from `@cringe-court/ai/court` (works in browser and Node; contains no secrets). Use `@cringe-court/ai/court/node` for the file-backed transcript store.

## Status (honest)

| Area | State |
|---|---|
| Case preparation, prompts, parsing, validation, repair, assembly, hashing, replay store | Implemented and unit-tested (mock and fixtures) |
| Solo / Versus / Viral trial plans, post-verdict commentary for all 7 outcomes | Implemented and unit-tested |
| 0G Router adapter (`OgRouterClient`) | Implemented against the published 0G docs; HTTP behaviour tested with a fake `fetch` |
| **A real 0G inference call** | **Done on 2026-11-06:** Solo trials run live through the router on `gemini-3.5-flash-lite`, written only after the stake is read from Arc. Earlier note: **Not executed yet.** No API key was available while this was built. The public model catalog (`GET /v1/models`, no key needed) *was* read live. See [10 §8](10_0G_PROVIDER_INTEGRATION.md#8-live-smoke-test) |
| Comedy quality on a real model | **Unmeasured.** The mock writer is template-based; its jokes say nothing about model quality. See [11](11_TESTING_AND_EVALUATION.md) |
| Wiring into the web app / server | Solo on Arc: `apps/server/src/solo/trial.ts`. Versus and Viral are not wired. The layer exposes typed functions; the game's existing engine performs the result ([09](09_ANIMATION_CONTRACT.md)) |

## Read in this order

| # | Document | What it answers |
|---|---|---|
| 01 | [AI courtroom vision](01_AI_COURTROOM_VISION.md) | What the AI does and does not do; the non-negotiables |
| 02 | [Solo case logic](02_SOLO_CASE_LOGIC.md) | GUILTY / NOT COOKED trials, 3 complete examples, acceptance criteria |
| 03 | [Versus case logic](03_VERSUS_CASE_LOGIC.md) | SIDE A / SIDE B disputes, 3 complete examples, acceptance criteria |
| 04 | [Viral case logic](04_VIRAL_CASE_LOGIC.md) | Curated public questions, external resolution, 3 complete examples |
| 05 | [Character personas](05_CHARACTER_PERSONAS.md) | Miss Ratio, Counsel Chaos, Judge Gavel.exe, the Court Clerk |
| 06 | [Comedy and narrative design](06_COMEDY_AND_NARRATIVE_DESIGN.md) | Trial structure, rebuttal consistency, what makes it funny |
| 07 | [Orchestration architecture](07_ORCHESTRATION_ARCHITECTURE.md) | The pipeline, call budget, replay, failure handling |
| 08 | [Output schemas](08_OUTPUT_SCHEMAS.md) | Zod schemas, allow-lists, safe-default coercions |
| 09 | [Animation contract](09_ANIMATION_CONTRACT.md) | How a transcript becomes engine cues |
| 10 | [0G provider integration](10_0G_PROVIDER_INTEGRATION.md) | Setup, env vars, errors, trust modes, verified facts and sources |
| 11 | [Testing and evaluation](11_TESTING_AND_EVALUATION.md) | Tests, corpus, rubric, thresholds, release gates |
| — | [prompts/](prompts) | The exact prompts, **generated from code** (`npm run court:prompts`) |

## Quick start (Windows PowerShell)

```powershell
# Offline, no key needed. Output is clearly labelled MOCK.
npm run court:test -- --example solo
npm run court:test -- --example versus --verdict SIDE_B --cues
npm run court:test -- --case packages/ai/court-cases/viral-cereal-soup.json

# Replay the hand-written reference script (no model at all)
npm run court:test -- --example viral --scripted --verdict NO_VERDICT

# List live 0G chat models (public catalog; no key needed)
npm run court:test -- --list-models

# Real 0G inference (needs a funded sk- key; see doc 10)
Copy-Item packages/ai/.env.court.example .env.court   # then edit it
npm run court:test -- --example solo --provider 0g --env-file .env.court

# Tests
npx vitest run --project ai
npm run court:prompts -- --check
npm run court:eval            # corpus through the mock (plumbing only)
```

## Keeping these docs true

- `docs/ai/prompts/*.md` and the example sections of docs 02–04 are **generated** from code. `packages/ai/src/court/__tests__/docs.test.ts` fails when they drift. Fix with `npm run court:prompts`.
- Every example in docs 02–04 is checked by the real validator in that test.
- The other docs are hand-written. When you change behaviour, change them in the same commit. Each one names the source files it describes.
