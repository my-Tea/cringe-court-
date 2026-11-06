# 08 · Output schemas

All schemas are Zod 4 and live in `packages/ai/src/court/schema.ts`. Types are inferred from them, so the code and these tables cannot disagree for long. If they do, the code wins and this page is wrong.

## 1. Enumerations

| Name | Values |
|---|---|
| `COURT_MODES` | solo, versus, viral |
| `COURT_SPEAKERS` | judge, clerk, prosecutor, defense |
| `EMOTIONS` | neutral, confident, smug, angry, shocked, nervous, sad, amused, exasperated, triumphant |
| `ANIMATIONS` | talk, point, desk-slam, objection, gasp, laugh, smug, sweat, cry, gavel, present-evidence, dramatic-pause |
| `CAMERAS` | auto, wide_courtroom, judge_closeup, prosecution_closeup, defense_closeup, clerk_desk, jury_box, gallery |
| `CROWD_REACTIONS` | none, gasp, laugh, murmur |
| `CASE_CATEGORIES` | 16 categories (finance, crypto, dating, …); see `schema.ts` |
| `OUTCOMES` | GUILTY, NOT_COOKED, SIDE_A, SIDE_B, NO_VERDICT, CANCELLED, INVALID |

## 2. Inputs

- **`CaseInputSchema`** is a discriminated union on `mode`: `SoloCaseInputSchema`, `VersusCaseInputSchema` and `ViralCaseInputSchema`. Field tables are in [02](02_SOLO_CASE_LOGIC.md#1-input), [03](03_VERSUS_CASE_LOGIC.md#1-input) and [04](04_VIRAL_CASE_LOGIC.md#1-input).
- **`PreparedCaseSchema`** is the output of `prepareCase`. It holds the case id, mode, title, category, tone, `facts[]` (`{id: F1.., text, status, sourceId?}`), ballot, parties, advocates (two-sided modes), viral details, flags and an input hash.
- **`FinalizedCaseResultSchema`** is the app's final result, needed for post-verdict commentary. It holds the case id, mode, status (`FINALIZED | CANCELLED | INVALID`), outcome, summary, title and optional `marketSettled` (Viral only). A `superRefine` enforces three rules:
  - the outcome must be valid for the mode;
  - the status must agree with the outcome;
  - `marketSettled` is allowed for Viral only.

## 3. What the model returns

### Trial: `ModelScriptSchema`

```jsonc
{
  "analysis": {
    "core": "10–300 chars: what the case is really about",
    "tension": "5–300: the comic contradiction",
    "benchA": "5–300: strongest point for ballot option 1",
    "benchB": "5–300: strongest point for ballot option 2",
    "factRefs": ["F1"]
  },
  "lines": [
    {
      "slot": "L02",                 // must be a model slot of the mode plan
      "speaker": "prosecutor",       // must match the plan's speaker for the slot
      "emotion": "smug",             // allow-list, default "neutral"
      "animation": "point",          // allow-list, default "talk"
      "camera": "auto",              // allow-list, default "auto"
      "crowd": "none",               // allow-list, default "none"
      "text": "plain dialogue",      // 1+ chars; length judged by the checker per slot
      "factRefs": ["F1"],            // known fact ids only
      "answers": "3–12 quoted words" // reply slots: the words being answered (≤160 chars)
    }
  ]
}
```

### Refusal: `RefusalSchema`

`{"refusal": "unsuitable" | "insufficient-facts", "reason"?: string}` becomes `TrialGenerationError('refused')`, with no retry.

### Post-verdict: `ModelCommentarySchema`

`announcement` (5–200 chars), `quip` (5–240 chars), and optional `prosecutorReaction` and `defenseReaction`.

## 4. Transcript (`TranscriptSchema`, `court-transcript@1`)

| Field | Meaning |
|---|---|
| `schemaVersion`, `scriptVersion` | `court-transcript@1`, and the plan version (e.g. `solo-trial@1`) |
| `caseId`, `mode`, `category`, `title`, `tone` | From preparation |
| `facts`, `ballot`, `parties`, `advocates?` | From preparation |
| `analysis` | The model's case understanding |
| `lines[]` | `TranscriptLineSchema`: `id`, `segment`, `speaker`, `bench?` (0/1, counsel only), `emotion`, `animation`, `camera`, `crowd`, `text`, `factRefs`, `answers?`, **`source: "model" \| "template"`** |
| `estimatedSeconds` | Read-aloud estimate (characters / 15 + 0.6 s per line) |
| `inference` | `provider` (`0g-router` \| `mock`), `model`, `requestIds[]` (**only ids the provider actually returned**), `trustMode`, `verification` (`none` \| `not-verified-by-harness`), `responseMeta`, `calls`, `latencyMs`, `usage?` |
| `validation` | `ok`, `scores` (8 dimensions), `overall`, `belowThreshold`, `attempts`, `issues[]`, `coercions[]` |
| `generatedAt` | ISO timestamp |
| `contentHash` | `0x…` keccak256 of the canonical content fields ([07 §7](07_ORCHESTRATION_ARCHITECTURE.md#7-replay-and-integrity)) |

## 5. Safe defaults and coercions

These live in `parse.ts`. Small, harmless deviations are corrected **and recorded** in `validation.coercions`. Anything that could change meaning is rejected instead.

| Model output | Result |
|---|---|
| Unknown emotion | `neutral` |
| Unknown animation | `talk` |
| `gavel` by anyone but the judge | `point` |
| `objection` by the judge or clerk | `talk` |
| `present-evidence` by the clerk | `talk` |
| Unknown camera | `auto` |
| Unknown crowd reaction | `none` |
| `factRefs` not a list | `[]` |
| Unknown fact ids | Dropped |
| JSON wrapped in prose or code fences | The first JSON object is extracted |
| A line for a court-written (template) slot | Ignored; the template wins |
| **Unknown speaker** | **Rejected** (schema error → repair) |
| **Unknown or duplicate slot, missing slot, wrong speaker** | **Hard issue** → repair |
| Empty or invalid JSON | Parse error → repair |

Nothing in the output is ever executed. Text is rendered as text; presets are looked up in fixed tables.

## 6. Issue codes

Hard issues trigger a repair, and if they persist, rejection. Soft issues lower the rubric estimate.

| Hard | Soft |
|---|---|
| `missing-slot`, `duplicate-slot`, `unknown-slot`, `wrong-speaker` | `long`, `short` |
| `too-long` (>1.25× slot max), `too-short` (<0.5× slot min) | `no-fact-ref`, `generic-line`, `analysis-unreferenced` |
| `pii`, `code-like` | `stock-opener`, `shouting`, `slang-overuse`, `catchphrase-overuse`, `objection-overuse` |
| `verdict-leak`, `neutrality` | `misquoted-answer`, `missing-answer-quote`, `repetition` |
| `fabricated-evidence`, `invented-number`, `invented-quote` | `trial-long`, `trial-short` |
| `viral-money-talk` | `imbalance` (>1.4×) |
| `non-responsive`, `duplicate-line` | `insult` (standard tone) |
| `trial-too-long` (>1.4× budget), `imbalance` (>2×), `ungrounded-trial` | |
| `insult` (gentle tone) | |
