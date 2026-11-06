# CringeCourt — Asset Gap Analysis

Verified against the filesystem, not from memory. Every count below was read off
disk on 2026-11-01.

---

## 1. What exists

| Area | Quantity | Location | State |
|---|---|---|---|
| Courtroom scene | **1606 boxes** in world space | `scene/courtroom.boxes.json` | ✅ Complete |
| Scene renders | 11 (6 POV + iso + cutaway) | `scene/*.png` | ✅ Complete |
| Props | **53** (1138 boxes) | `sprites/props/` | ✅ Complete |
| Block textures | **13** tileable 16×16 | `textures/blocks/` | ✅ Complete |
| Prop model | `.bbmodel`, 1138 elements, 53 groups | `models/` | ✅ Complete |
| Animation data | **54 char anims + 10 system** | `animation/animations.json` | ✅ Data complete, **no art** |
| Voxel characters | **8** (643 boxes total) | `characters/<id>/` | ⚠️ Only front/¾/side renders |
| Player parts | **58 PNGs** across 9 categories | `characters/player/` | ⚠️ Works, but art is rough |

---

## 2. What is missing

### 🔴 Critical — blocks the game from being playable

| # | Asset | Missing | Why it blocks |
|---|---|---|---|
| 1 | **Character poses** | **0 / 10** per character × 7 = **70 needed** | Animation data names `idle`, `talking`, `objection`… but those PNGs don't exist. Nothing can animate. |
| 2 | **Character expressions** | **0 / 8** per character × 7 = **56 needed** | Same — `animations.json` references `angry`, `shocked`… with no files behind them. |
| 3 | **UI kit** | **0 / 30** | No dialogue box, no buttons, no panels, no stamps. The game has no interface. |
| 4 | **Verdict cards** | 0 / 3 | GUILTY / NOT COOKED / NO VERDICT — the payoff moment has no art. |

### 🟠 Important — needed for the intended experience

| # | Asset | Missing | Notes |
|---|---|---|---|
| 5 | **FX sprites** | 0 / 7 | `shake`, `flash`, `impact`, `sweat`, `tears`, `blush`, `sparkle`. Referenced in every animation timeline. |
| 6 | **Callout bubbles** | 0 / 5 | "ORDER!" / "OBJECTION!" / "COUNTER!" comic bursts. Referenced as `callout` in `animations.json`. |
| 7 | **Juror variants** | 0 / 6–8 | Spec asks for colour variants so a jury doesn't look cloned. Only 1 base exists. |
| 8 | **Timer widget** | 0 / 1 | Deadline display — must be instantly readable (md §5). |

### 🟡 Nice to have — polish

| # | Asset | Missing |
|---|---|---|
| 9 | Wordmark "CringeCourt" | 0 / 1 |
| 10 | Share card frame | 0 / 1 |
| 11 | Case-card template | 0 / 1 |
| 12 | ~~Character-specific props as separate sprites~~ | ✅ Done: `judge_gavel` (+ `_raised`, `_strike`), `exhibit_a_paper`, `popcorn_bucket`, `papers_stack` in `sprites/props/` with `holdAnchor`. Bailiff has no baked held item |
| 13 | Idle animation variants | ✅ 3 per char (`idle_a/b/c`) as held poses; multi-frame idle gestures still open |

---

## 3. The animation problem, stated plainly

`animation/animations.json` is **complete and validated** — 54 character
animations across 8 characters, plus 10 system animations, with a state machine.

But it is **data with no art behind it**. Every keyframe says:

```json
{ "t": 0.15, "pose": "objection", "expression": "angry" }
```

…and there is no `judge/poses/objection.png` and no `judge/expressions/angry.png`.

**So the wiring exists and the sprites don't.** That is the single biggest gap in
the project. A coding agent reading the guide would build a working animation
system that displays nothing.

---

## 4. Recommended build order

The spec's own priority is: *Character consistency → Player customization →
Expressions → Animation poses → Extra cosmetics.* I'd follow it, with one change.

| Phase | Work | Output | Why this order |
|---|---|---|---|
| **1** | **Expressions** for the Judge (8) | 8 PNGs | One character, fully expressive, proves the pipeline. He is the brand. |
| **2** | **Poses** for the Judge (10) | 10 PNGs | Completes the Judge. After this, one character is genuinely shippable. |
| **3** | **UI kit** (30) | Dialogue box, buttons, panels, stamps, timer | Without this there is no game, no matter how good the characters are. |
| **4** | Expressions + poses for remaining 5 humans | 90 PNGs | Bulk work, pipeline already proven in phases 1–2. |
| **5** | FX + callouts (12) | Sweat, tears, impact, "ORDER!" | Makes the animations actually land. |
| **6** | Player art polish | Rebuild hair/shoulders | The avatar appears on every screen. |
| **7** | Juror variants, wordmark, share card | Polish | Last. |

**Rationale for pulling UI to phase 3:** the characters are useless without a
dialogue box, and UI is fast, deterministic work — it doesn't need art iteration.

---

## 5. Numbers

| | Count |
|---|---|
| Assets complete | ~1,700 boxes + 130 PNGs |
| **PNGs still needed** | **~180** |
| ├ Character poses | 70 |
| ├ Character expressions | 56 |
| ├ UI kit | 30 |
| ├ FX + callouts | 12 |
| └ Polish | ~12 |
| **Estimated phases** | 7 |

---

## 6. Honest risk

**The sprite art quality is not yet at the reference bar.** The Judge 2D sprite
and the player avatar are recognisable but crude next to the character sheet you
supplied. Generating 126 more pose/expression PNGs at that quality level would
lock in mediocrity.

Two ways forward, and this is a decision you should make before phase 1:

- **A. Push quality first.** Iterate on the Judge's single sprite until it
  genuinely looks good, *then* mass-produce poses. Slower start, but 126
  derivative assets inherit the good base.
- **B. Mass-produce now.** Get all 126 PNGs at current quality, then improve in
  a second pass. Faster to "complete", but risks never doing the second pass.

I recommend **A**. The pipeline is the hard part and it's nearly done; the drawing
is what looks wrong. Fixing one character properly teaches what the other six
need.

---

## 7. What a coding agent can start on today

Even with the art gaps, these are unblocked:

1. Load `scene/courtroom.boxes.json`, merge by material → 16 draw calls.
2. Build the camera rig from the 8 presets in `courtroom.layout.json`.
3. Implement the animation state machine from `animations.json` — it will run
   correctly the moment sprites appear at the expected paths.
4. Place the 8 voxel characters at the positions in `ANIMATION-GUIDE.md` §7.
5. Wire the player compositor (`source/sprite-player.mjs`) — 58 parts already
   exist and combinine correctly.

Only stubbed art, not stubbed logic.
