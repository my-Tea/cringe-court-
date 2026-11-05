# Asset Completeness Report

**Style: VOXEL, 4.5–5.0 heads tall (realistic proportions, NOT chibi).**

The earlier 2D hand-drawn and chibi-voxel passes were both replaced. Every
character now matches the Judge reference: cubic head ≈23% of total height,
box-built body, flat-shaded voxel look.

Verified against the filesystem.

---

## Complete

| Asset family | Count | Status |
|---|---|---|
| **Character expressions** | **64** (8 chars × 8) | ✅ Passed a real expression string into each builder |
| **Character poses** | **80** (8 chars × 10) | ✅ Every character has all 10 |
| **Character masters** | 8 `sprite.png` + `@2x` | ✅ |
| **Player parts** | **58** + default, voxel | ✅ Matches cast proportions (4.5 heads) |
| **UI kit** | **34** assets (47 with @2x icons) | ✅ |
| **FX sprites** | **10** | ✅ |
| **Props** | 82 (41 props @1x + @4x) | ✅ |
| **Block textures** | 13 | ✅ |
| **Scene renders** | 11 | ✅ |
| **3D models** | `.bbmodel` (995 elements) | ✅ |
| **Animation data** | 85 char (incl. 3 idle variants x 8 characters) + 10 system | ✅ |

### What closed the previous gaps

The last gap report listed **126 missing pose/expression PNGs** and **30 UI assets**
as blocking. Both are now filled:

- **126 → 144 generated.** 8 characters × (8 expressions + 10 poses).
- **0 → 34 UI assets.** Dialogue box, name plate, 4 buttons, 3 panels, 4 stamps,
  3 callouts, 13 icons, 3 verdict cards, timer, receipt.
- **0 → 10 FX.** 4-frame impact burst, flash, sweat, tear, blush, sparkle, shake.

---

## Expressions

Every character now has all 8, verified on disk:

```
characters/<id>/expressions/{neutral,happy,angry,shocked,laughing,crying,confused,smug}.png
```

Each is a **real redraw**, not a tint. The face system changes eyes (round / sharp /
sleepy / sparkle), mouth (neutral / smile / grin / shout / frown / smirk / grit),
brow tilt, blush strength, plus expression extras — tears, sweat, anger veins,
shock lines, laugh arcs.

### Known limitation: the Judge

His **8 expressions look similar** because black sunglasses cover his eyes — his
focal point and his joke. The differences are in the mouth and beard (shout opens
it), but at a glance they read alike.

That is faithful to the character, not a bug. If you want more separation, the
options are: (a) let the shades lift on shocked/crying, or (b) give him expressive
brows above the shades. Say the word and I'll do (b) — it's a 10-line change.

---

## Poses

```
characters/<id>/poses/{idle,talking,happy,angry,shocked,laughing,crying,confused,objection,defeated}.png
characters/<id>/poses/{idle_a,idle_b,idle_c}.png    (idle variants, + @2x of each)
```

Idle variants are per-character rig deltas (`IDLE` in `vox-chars.mjs`; `across` in the
rig swings a raised hand to the midline). Preview: `characters/_previews/idle-variants.png`
(rows: character; columns: idle, a, b, c). Picking rules are in ANIMATION-GUIDE.md.

Data-driven: `POSES` in `vox-base.mjs` gives each pose per-arm swing (`out`/`fwd`),
head `nod`/`tilt`, and body `lean`/`sway`/`dy`. Boxes are tagged into rig groups
(`head`, `armL`, `armR`, `body`) and `posed()` applies one rotation per group, so the
gavel, papers and popcorn follow the hand holding them. The AI Narrator has no limbs,
so its poses come from the body lean/sway/bob alone. The Judge overrides `objection`
and `angry` to raise the gavel instead of pointing.

Each pose wears its matching expression where one exists (`angry` pose → `angry` face),
and a character's 10 poses share one framing, so frames keep the same scale when
swapped mid-animation. Verified by hash: all 10 pose PNGs differ for every character.

> Earlier revisions of this report claimed the 10 poses already differed. They did
> not: the voxel builders ignored `pose`, so 6 of 8 characters shipped 10 identical
> pose PNGs. Fixed on `feat/voxel-poses`.

---

## UI kit (`ui/`)

| Asset | Size | Notes |
|---|---|---|
| `dialogue_box.png` | 640×200 | 9-slice, gold inner rule, pixel font header |
| `name_plate.png` | 240×52 | Burgundy plate |
| `button_{primary,secondary,danger,disabled}.png` | 240×64 | Drop shadow + gold bevel |
| `panel_{journal,notebook,board}.png` | 420–560 | Parchment with burgundy header |
| `stamp_{guilty,not_cooked,no_verdict,charges_filed}.png` | 360×110 | Angled ink stamp |
| `callout_{order,objection,counter}.png` | 420×150 | Comic burst |
| `card_{guilty,not_cooked,no_verdict}.png` | 360×200 | Verdict card |
| 13 × `icon_*.png` + `badge_verified.png` | 48×48 (+@2x) | Journal, board, accuse, commit, reveal, bond, refund, slashed… |
| `timer_widget.png` | 320×96 | Sunset gradient + deadline bar |
| `receipt_card.png` | 300×260 | Settlement layout |

The pixel font is a **built-in 5×7 bitmap** in `ui-kit.mjs` — no font file to ship.

---

## FX (`fx/`)

`impact_0..3` (4-frame burst), `flash`, `sweat`, `tear`, `blush`, `sparkle`, `shake`.

---

## Player (`characters/player/`)

| Category | Files |
|---|---|
| `body/` | 3 — masculine, feminine, androgynous |
| `skin/` | 6 tones |
| `eyes/` | 4 — round, sharp, sleepy, sparkle |
| `hair/` | 8 — short, long, ponytail, buns, messy, buzz, afro, spiky |
| `hairColor/` | 7 |
| `clothing/` | 7 — tee, hoodie, shirt, suit, jacket, robe, meme |
| `clothingColor/` | 7 |
| `accessory/` | 8 — none, glasses, shades, cap, headphones, chain, earrings, mask |
| `expression/` | 8 |
| `default.png` | assembled avatar |

`composePlayer({...})` in `source/sprite-player.mjs` stacks them in verified order.

**Honest note:** the player avatar is the **weakest art in the bundle**. It was
built before the v3/v4 engine upgrade, so it uses the older 2-tone shading while
the 8 NPCs use the 5-tone ramp system. Rebuilding the player on `pen3.mjs` would
match the cast. That is the highest-value remaining polish item.

---

## Tooling (`source/`)

| File | Role |
|---|---|
| `pen3.mjs` | Sprite engine: 5-tone cel ramps, gradients, tapered locks, outline |
| `artkit.mjs` | Material ramps + shared face parts (eye, brow, mouth, blush) |
| `chars-v4-core.mjs` | Pose/expression tables + body/face/hair builders |
| `chars-v4.mjs` | All 8 character definitions, parameterised |
| `ui-kit.mjs` | UI assets + the 5×7 bitmap font |
| `fx-kit.mjs` | FX sprites |
| `sprite-player.mjs` | Player compositor |
| `vox-base.mjs` / `vox-chars.mjs` | Voxel anatomy, pose rig, all 8 characters |
| `char-render.mjs` | Orthographic voxel renderer (supports per-box transforms) |
| `export-vox.mjs` | Bulk export → 144 character sprites + sheets |
| `export-player-vox.mjs` | Player parts → 58 sprites |
| `animations.mjs` | 54 animations, 10 system |

Regenerate everything:

```bash
cd cc-art
npm install --no-save pngjs   # the only dependency; not vendored
node export-vox.mjs          # characters (export-all.mjs is the retired 2D pipeline)
node export-player-vox.mjs   # player parts
node ui-kit.mjs              # UI
node fx-kit.mjs              # FX
```

---

## What remains (all optional polish)

| Item | Why it's optional |
|---|---|
| Rebuild player on `pen3` | Biggest quality win, but the existing parts function |
| Judge expression separation | Faithful as-is; a taste call |
| Animated (multi-frame) idle gestures | Idle variants exist as held poses; continuous motion is polish |
| Wordmark, share card | Marketing, not gameplay |
| GLB export of the `.bbmodel` | Needs a GUI click in Blockbench |

**Nothing blocking remains.** Every asset the animation system references now
exists at the path it expects.
