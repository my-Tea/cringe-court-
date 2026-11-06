# 09 · Animation contract

**The AI chooses named presets. The game decides everything physical:** positions, timings, assets, rigs and sound files.

The court layer adds **no event bus**. It converts a validated transcript into the engine's existing `CourtLine` type. The existing Director (`packages/engine/src/director.ts`) compiles those lines into its typed `Cue` stream, which `ShowPlayer` performs through `ScenePort`.

Sources:
- `packages/ai/src/court/stage.ts`;
- `packages/engine/src/director.ts`;
- `packages/core/src/ports/counsel.ts` (`CourtLine`, `Beat`, `Emotion`, `CrowdReaction`).

## 1. Integration in four lines

```ts
import { courtCast, courtDirectorOptions, toCourtLines, commentaryToCourtLines } from '@cringe-court/ai/court';
import { directTrial, directVerdict } from '@cringe-court/engine';

const show = directTrial(transcript.caseId, toCourtLines(transcript), courtCast(transcript.mode), courtDirectorOptions());
// later, after the external result: directVerdict(verdict, courtCast(mode), commentaryToCourtLines(commentary)[0] ?? null)
```

These are the only changes made to shared packages, and all are additive:
- `Speaker` gains `'clerk'`;
- `CourtLine` gains the optional `emotion`, `camera` and `crowd` fields;
- the Director maps the clerk and honours `camera` and `crowd`;
- the web stage shows the name "Court Clerk".

The legacy Solo/Versus paths are unchanged.

## 2. Mapping (`toCourtLine`)

| Transcript field | `CourtLine` field | What the Director does with it |
|---|---|---|
| `speaker` | `speaker` | Picks the actor. A cast with no clerk falls back to narrator, then judge |
| `segment` | `segment` | `call-to-order` → `enter_court` system animation. `jury-out` → tense lighting, tension music, jury camera, stinger and "THE JURY IS OUT" card |
| `animation` (≠ `talk`) | `beat` | `BEATS` table: actor animation, sound, effect, opposing-bench reaction, crowd sound (below) |
| `camera` | `camera` | Named presets → layout shots (below). `auto` on counsel → that counsel's **own desk**; otherwise the speaker-based default |
| `crowd` (≠ `none`) | `crowd` | `sfx.crowd-gasp` / `-laugh` / `-murmur`, if the beat has no crowd sound of its own |
| `emotion` | `emotion` | Carried on the `say` cue's line. **No renderer reads it yet** (§5) |
| `bench` | `bench` | Ballot index for counsel |
| `text` | `text` | Dialogue box text. Plain text; never interpreted |

**Camera presets** (`CAMERA_SHOT`):

| Preset | Shot |
|---|---|
| `wide_courtroom` | `pov_well` |
| `judge_closeup` | `close_judge` |
| `prosecution_closeup` | `close_prosecution` |
| `defense_closeup` | `close_defense` |
| `clerk_desk` | `close_witness` |
| `jury_box` | `close_jury` |
| `gallery` | `pov_gallery` |

**Beats** (existing engine table):

| Beat | Animation | Sound | Effect | Opponent reacts | Crowd |
|---|---|---|---|---|---|
| desk-slam | react_angry | sfx.desk-slam | impact | react_shocked | |
| objection | objection | stinger.objection | | react_shocked | gasp |
| point | talk | | | | |
| gasp | react_shocked | | | | gasp |
| laugh | react_happy | | | | laugh |
| smug | react_happy | | | | |
| sweat | react_shocked | | sweat | | |
| cry | defeated | | tears | | murmur |
| gavel | react_angry | sfx.gavel | shake | | |
| present-evidence | talk | sfx.paper | | | |
| dramatic-pause | (0.8 s wait) | | | | |

## 3. Staging and voices

`courtCast(mode)` returns the existing cast definitions:
- Solo uses the Solo staging: judge, both desks, bailiff, clerk, three jurors and the creator at the witness mark.
- Versus and Viral use the grand-jury staging: judge, both desks, bailiff, clerk, seven jurors and the narrator.

The court-ai Versus does **not** use the legacy `side-a`/`side-b` voices, because the advocates are characters. Each advocate always stands at their own desk. Which side they argue is shown by `bench` and the dialogue, not by moving them.

**Voices:**
- The clerk uses `voice.narrator`, panned −0.3. A dedicated clerk voice cue is a game-side TODO.
- Other speakers keep their existing cues.

## 4. Timing

The Director's default line timing is 52 ms per character, capped at **7 s per line**. That suits the short legacy lines, but a 250-character court line would get 7 s, about 36 characters per second, which is unreadable.

`courtDirectorOptions(charsPerSecond = 15)` returns `{ msPerChar: 67, minLineSeconds: 1.8, maxLineSeconds: 25 }`. This matches the reading model the court budgets with, so the show lasts about `transcript.estimatedSeconds`. A test checks both conditions for every mode:
- within 6 s of the estimate;
- inside the mode's target range.

Skipping and fast-forwarding stay with `ShowPlayer`.

## 5. What the game still owns (dependencies)

| Item | State |
|---|---|
| Emotion → facial expression or pose | `emotion` is on every line, but the renderer ignores it today. Map it in the scene layer |
| Clerk voice cue | Uses the narrator voice for now |
| Clerk actor | Both stagings seat a `clerk`. A custom cast without one falls back to narrator, then judge |
| Wiring into the app/server flow (fetch stored transcript → `directTrial` → `ShowPlayer`) | Not done; this layer only exposes functions |
| Phaser | Not present in this repo. The renderer is the existing three.js `ScenePort` implementation; nothing here depends on the renderer |

## 6. Rules

- The game must render `text` as text and never interpret it as markup.
- Unknown presets cannot reach the game. They are coerced or rejected at parse time ([08 §5](08_OUTPUT_SCHEMAS.md#5-safe-defaults-and-coercions)).
- `source: "template"` lines are court-written. The UI may style them as procedure.
- `answers` (the quoted words a rebuttal responds to) is optional display material, for example an "objection target" caption.
