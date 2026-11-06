# CringeCourt — Animation Integration

How to wire character animation. Companion to `CHARACTER-SPEC.md` (what the
assets are) — this file is **how they move**.

Machine-readable source: `animation/animations.json` — 8 characters,
**55 character animations** (54 shared-set + juror `seated_idle`), **10 system animations**.

---

## 1. The model in one paragraph

Characters are **sprite-swapped, not skeletally animated**. An animation is a list
of keyframes, and each keyframe names a **pose**, an **expression**, a
**transform**, and optionally an **fx**. Pose and expression **snap** (instant
sprite change — this is a sprite game, do not cross-fade). Only `transform`
(`x`, `y`, `scale`, `rot`) **interpolates linearly** between keyframes.

That split is deliberate: snapping poses keeps the chunky hand-drawn feel, while
smooth transforms keep micro-motion from looking stuttery.

---

## 2. Schema

```json
{
  "id": "objection",
  "character": "judge",
  "loop": false,
  "duration": 1.4,
  "interrupt": "talk",
  "callout": "ORDER!",
  "tracks": [
    { "t": 0.0,  "pose": "idle",      "expression": "neutral", "transform": {"x":0,"y":0,"scale":1.0,"rot":0} },
    { "t": 0.15, "pose": "objection", "expression": "angry",   "transform": {"x":0,"y":-6,"scale":1.06,"rot":-2}, "fx": "shake" },
    { "t": 0.55, "pose": "objection", "expression": "angry",   "transform": {"x":0,"y":-6,"scale":1.06,"rot":-2} },
    { "t": 0.9,  "pose": "talking",   "expression": "smug",    "transform": {"x":0,"y":0,"scale":1.0,"rot":0} },
    { "t": 1.4,  "pose": "idle",      "expression": "neutral", "transform": {"x":0,"y":0,"scale":1.0,"rot":0} }
  ]
}
```

| Field | Meaning |
|---|---|
| `t` | Seconds from start. Must be ascending. |
| `pose` | Filename stem in `poses/` — snapped |
| `expression` | Filename stem in `expressions/` — snapped |
| `transform` | Pixel offset + scale + degrees. **Interpolated.** |
| `fx` | `shake` \| `flash` \| `impact` \| `sweat` \| `tears` |
| `loop` | `true` for `idle` / `talk` only (idle variants are one-shot) |
| `variantOf` | `"idle"` on `idle_a`/`idle_b`/`idle_c` — marks an idle variant |
| `weight` | Idle variants only: pick probability for that character (sums to 1) |
| `interruptible` | Idle variants only: any trigger cuts them off immediately |
| `interrupt` | This animation may interrupt the named loop |
| `callout` | Text to flash (rendered by the UI layer, not the sprite) |

---

## 3. Playback

```js
function play(anim, t) {                    // t in seconds
  const tracks = anim.tracks;
  let a = tracks[0], b = tracks[tracks.length - 1];
  for (let i = 0; i < tracks.length - 1; i++) {
    if (t >= tracks[i].t && t <= tracks[i + 1].t) { a = tracks[i]; b = tracks[i + 1]; break; }
  }
  // pose + expression snap to the LAST keyframe at or before t
  const snapped = t >= b.t ? b : a;
  // transform interpolates between a and b
  const span = b.t - a.t;
  const k = span <= 0 ? 1 : Math.min(1, Math.max(0, (t - a.t) / span));
  const lerp = (p, q) => p + (q - p) * k;
  return {
    pose: snapped.pose,
    expression: snapped.expression,
    transform: {
      x: lerp(a.transform.x, b.transform.x),
      y: lerp(a.transform.y, b.transform.y),
      scale: lerp(a.transform.scale, b.transform.scale),
      rot: lerp(a.transform.rot, b.transform.rot),
    },
    fx: snapped.fx || null,
  };
}
```

**Looping:** `t = elapsed % duration`. **One-shot:** clamp at `duration`, then
fire `onEnd` and return to `idle`.

---

## 4. State machine

```
        ┌──────────┐
        │   idle   │◄────────────────────────┐
        └────┬─────┘                         │
             │ trigger                     │
             ▼                             │
        ┌──────────┐   onEnd   ┌───────────┴──┐
        │  action  │──────────►│  return_idle │
        └────┬─────┘           └──────────────┘
             │ interrupt
             ▼
        ┌──────────┐
        │   react  │───► chains back to idle
        └──────────┘
```

Rules, enforced in `animations.json → stateMachine.rules`:

1. `idle` and `talk` loop; everything else is one-shot.
2. A one-shot **interrupts** any loop and blocks new triggers until it ends.
3. **`objection` may interrupt `talk`** — no other one-shot may.
4. **Never leave a character mid-one-shot across a scene transition** — snap to
   `idle`. A character frozen mid-objection during a verdict card looks broken.
5. While dialogue streams, alternate `talk` ↔ `idle` on a **1.2–2.4 s random**
   interval. Fixed intervals read robotic.

### Idle variants

Every character (all 8 in `animations.json`, i.e. the cast plus Creator, minus the
player) has three variants of `idle`: `idle_a`, `idle_b`, `idle_c`. Each is a small
rig delta from base idle (judge: adjusts shades / taps gavel / strokes beard;
juror: munches popcorn / leans back / leans in; AI Narrator: hover bob left, lean in,
hover bob right, and so on). Art: `characters/<id>/poses/idle_{a,b,c}[@2x].png`, same
framing as the other poses. Data: `animations[]` entries with `variantOf: "idle"`,
a `note` naming the action, and a per-character `weight`. Policy:
`stateMachine.idleVariants`.

How a runtime picks one:

```js
// in base idle only; loopsLeft = randInt(2, 4) when idle (re)starts
onIdleLoopEnd() {
  if (--loopsLeft > 0) return;                         // keep looping base idle
  const v = idle.variants.filter(a => a.id !== lastVariant);   // noImmediateRepeat
  const pick = weightedRandom(v, a => a.weight);       // weights are per character
  lastVariant = pick.id;
  play(pick);                                          // one-shot: idle -> idle_x -> idle
}                                                      // onEnd: back to base idle, loopsLeft re-rolled
```

Any `talk` or reaction interrupts a variant at once and snaps to the new state; do not
start a variant straight out of a reaction without one fresh base-idle loop.

---

## 5. Character signature beats

`objection` is overridden per character. The pose, expression, fx and callout
differ even though the timing is shared — that consistency is what makes cuts
feel like one show.

| Character | Pose | Expression | FX | Callout |
|---|---|---|---|---|
| Judge | objection | angry | shake | **ORDER!** |
| Prosecutor | objection | angry | impact | **OBJECTION!** |
| Defense | objection | confused | flash | **COUNTER!** |
| Juror | objection | shocked | sweat | … |
| Bailiff | objection | angry | shake | ORDER! |
| Clerk | objection | confused | sweat | — |
| Creator/Defendant | defeated | crying | tears | IT WAS A JOKE BRO! |

---

## 6. System animations (10)

These are **scene-level**, not attached to a character. They drive the room.

| ID | Duration | Key beats |
|---|---|---|
| `enter_court` | 2.4 | doors_open → spotlight_on → case_number_stamp → idle |
| `case_accepted` | 1.6 | portrait_pop → stamp_charges_filed → idle |
| `jury_seated` | 2.0 | seat_1 → seat_2 → seat_3 → badges_glow → idle |
| `bond_committed` | 1.4 | receipt_in → idle |
| `ballot_commit` | 1.6 | ballot_rise → ballot_drop → sealed_box_shut → idle |
| `ballot_reveal` | 1.8 | seals_unlock → ballots_reveal → idle |
| `verdict_guilty` | 2.2 | gavel_strike → lighting_shift_red → card_guilty |
| `verdict_not_cooked` | 2.2 | gavel_strike → lighting_shift_green → card_not_cooked |
| `verdict_none` | 2.0 | card_no_verdict → idle |
| `settlement` | 1.2 | receipt_slide_in → idle |

Each `step` has `t`, `action`, and optional `sound` / `fx`. Bind `action` strings
to your own functions — the JSON is the timeline, not the implementation.

**`ballot_commit` is privacy-critical:** it must show the ballot entering the box
and **no tally**. If a player can infer the vote from the animation, the
commit-reveal guarantee is theatre.

---

## 7. Wiring in the 3D courtroom

Characters are **2D billboards** in the voxel scene.

| Character | Position | Facing |
|---|---|---|
| Judge | `[0, 21, -62]` | +Z (toward room) |
| Prosecutor | `[-56, 0, -22]` | +Z |
| Defense | `[56, 0, -22]` | +Z |
| Witness | `[-30, 0, -38]` | +Z |
| Jurors ×3 | `[84, 0, -40]` | −X |
| Bailiff | `[0, 0, 40]` | +Z |
| Clerk | `[-30, 0, -6]` | +Z |

**Sprite height = 63 world units** — the character height the courtroom was
dimensioned around. Scale the 512px canvas to match (63 / 512 ≈ 0.123 world units
per sprite pixel).

Billboard with `THREE.Sprite` (cheapest, always faces camera) or a camera-facing
quad if you need per-layer draw control. **Use a per-character texture atlas** —
one atlas = 1 draw call for body, 1 for the face layer.

---

## 8. Loading

**Do not preload all 6 characters.** Each character needs ~18 images
(10 poses + 8 expressions) at ~40 KB ≈ 700 KB:

- Preload a character's atlas when they **first enter a scene**.
- Preload `idle` + `neutral` only at startup (one small image per character).
- The player avatar is **not built yet** (see CHARACTER-SPEC.md §6). When it is,
  it uses the same box-list pipeline as the cast — the same preload rules apply.

---

## 9. Authoring new animations

1. Add the entry to `cc-art/animations.mjs` under `shared` (reusable) or inline.
2. Keep `t` ascending; first keyframe at `0`; last keyframe at `duration`.
3. End every one-shot on `idle` / `neutral` unless the pose is intentionally a
   resting state (`defeated` ends slumped, which is correct).
4. Regenerate:
   ```bash
   cd cc-art
   node -e "import('./animations.mjs').then(m=>console.log(m.writeAnimationLibrary('./dist/animation/animations.json')))"
   ```
5. Validate: `writeAnimationLibrary` now runs `validateAnimationLibrary`, which
   throws if a keyframe names a pose that is not a core pose or `idle_a/b/c`, if a
   `characters/<id>/poses/<pose>.png` is missing (run `export-vox.mjs` first),
   or if idle variant weights do not sum to 1. Expressions are not yet checked.

## 10. Known gaps

1. **No FX sprites yet.** `shake`/`flash`/`impact`/`sweat`/`tears` are named in
   the timeline but no sprite exists for them. UI-layer work.
2. **No sound files.** `sound` keys are labels.
3. **Callouts are text**, not art. The reference shows "ORDER!" in a comic
   burst — that bubble is a UI asset, not yet built.
4. **Idle variants are static poses held ~1.4 s**, not multi-frame gestures (no
   continuous munching or foot tapping). Held-prop variants (popcorn, papers) move
   rigidly with the hand. The player avatar has no idle variants yet.
