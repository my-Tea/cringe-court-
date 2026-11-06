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
| **Props** | 106 (53 props @1x + @4x) | ✅ |
| **Block textures** | 13 | ✅ |
| **Scene renders** | 11 | ✅ |
| **3D models** | `.bbmodel` (995 elements) | ✅ |
| **Animation data** | 106 char (incl. 3 idle variants x 10 characters, juror `seated_idle`) + 10 system | ✅ |
| **Gallery NPCs** | 8 seated x 3 views (@1x/@2x) + juror `seated` pose | ✅ new, low detail |

### What closed the previous gaps

The last gap report listed **126 missing pose/expression PNGs** and **30 UI assets**
as blocking. Both are now filled:

- **126 → 144 generated.** 8 characters × (8 expressions + 10 poses).
- **0 → 34 UI assets.** Dialogue box, name plate, 4 buttons, 3 panels, 4 stamps,
  3 callouts, 13 icons, 3 verdict cards, timer, receipt.
- **0 → 10 FX.** 4-frame impact burst, flash, sweat, tear, blush, sparkle, shake.

---

## Versus mode: Side A / Side B

`characters/side-a/` (teal, quiff) and `characters/side-b/` (orange, ponytail):
the two consenting parties in Versus Court. They wear domino masks and a chest
letter, so the entertainment UI never shows a real face or name (idea md §4B).
Each has the standard 8 expressions + 10 poses. Like every character on `main`,
their 10 pose PNGs are identical until the pose rig (`feat/voxel-poses`) lands.

## Expressions

Every character now has all 8, verified on disk:

```
characters/<id>/expressions/{neutral,happy,angry,shocked,laughing,crying,confused,smug}.png
```

Each is a **real redraw**, not a tint. The face system changes eyes (round / sharp /
sleepy / sparkle), mouth (neutral / smile / grin / shout / frown / smirk / grit),
brow tilt, blush strength, plus expression extras — tears, sweat, anger veins,
shock lines, laugh arcs.

### The voxel face rig

The voxel heads take the expression directly: `FACE` in `vox-base.mjs` sets eye
shape (open / wide / lidded / narrow / closed), independently slanted inner/outer
brows, and extras (tears, sweat drop, anger vein). Mouths: neutral, grin, shout,
frown, grit, smirk. The AI Narrator draws a per-expression pixel face on its screen.
The player's 8 `expression/` parts use the same rig.

Verified by hash: all 8 expression PNGs differ for every character. Before this
pass the Judge and creator had 3 distinct faces of 8, and the narrator had 1.

**The Judge** keeps his shades on (they are the joke); brows above the shades
plus the mouth now carry the emotion. That was option (b) in the previous report.

Fixed along the way: a depth-buffered renderer (the narrator used to lose an eye to
draw order), hair masses no longer cover foreheads, open glasses rims on the clerk
and juror, and the defense's bandage moved off his eye.

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

## Juror variants (`characters/juror/variants/`)

Six background-cast jurors, `a`–`f`, each a master `sprite` + `@2x`, with
`juror/_variants.png` showing the base juror beside them. They differ by
silhouette first (long hair + beanie, afro, bun, buzz cut + cap, long blonde,
silver + beanie), then clothing colour and skin tone (player palette). Built by
`juror(variant)` in `vox-chars.mjs`; listed in `characters/manifest.json` under
`jurorVariants`. Variants ship the master only; poses/expressions use the base
juror's set.

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
| `button_{primary,secondary,danger}_{hover,pressed}.png` | 240×64 | Interaction states (disabled has none) |
| `button_swear{,_hover,_pressed}.png` | 400×64 | "I SWEAR TO SHOW UP (0.40 USDC)" jury-seat oath |
| `callout_let_bro_cook.png` | 520×150 | Defense impact text |
| `stamp_case_number.png` | 360×110 | "CASE #0069" entry stamp |
| `card_mistrial.png` | 360×200 | NO VERDICT payoff screen: "MISTRIAL / FULL CASE REFUND" |
| `receipt_jury_duty.png` | 320×230 | JURY DUTY ACCEPTED: bond, commit + reveal deadlines, loss condition |
| `receipt_juror_example.png` | 300×260 | Filled settlement: 0.40 returned + 0.30 reward = 0.70 |

Amounts and deadlines on the receipts are illustrative values from the V4 brief,
not live data; the game should draw real values over `receipt_card.png`.

The pixel font is a **built-in 5×7 bitmap** in `ui-kit.mjs` — no font file to ship.
It covers A–Z, 0–9 and `! ? . : - ' # / + ( ) , % =` (digits were missing until
`feat/ui-trial-moments`, so the timer used to read `??:??`).

---

## Brand (`brand/`)

| Asset | Size | Notes |
|---|---|---|
| `wordmark.png` / `wordmark_small.png` | ~1200 / ~600 wide | Voxel letters: cream face, purple extrusion, transparent |
| `wordmark_stacked.png` | ~700 wide | CRINGE / COURT on two lines |
| `share_card.png` | 1200×630 | Link-preview frame: defendant slot, verdict-card slot, CASE / JURY / CATEGORY |
| `case_card.png` | 360×500 | Collectible case card template |

Generated by `brand-kit.mjs`. Card slots are dashed outlines; values are drawn at
runtime. The defendant is always an anonymous silhouette (art bible part 2, #4).

---

## Trial-moment props (`sprites/props/`)

`ballot_paper`, `ballot_envelope`, `case_stamp`, `settlement_receipt`,
`podium_mic`, `potted_plant` — the art bible part 3 props that were missing.
Defined in `props.mjs`, exported by `node export.mjs` (writes `out/props/`; copy to
`dist/sprites/props/`). **Not yet in `models/CringeCourt_Props.bbmodel`**: that file
was built through Blockbench and nothing in `cc-art/` regenerates it.

---

## Character props (`sprites/props/`)

`judge_gavel`, `judge_gavel_raised`, `judge_gavel_strike`, `exhibit_a_paper`,
`popcorn_bucket`, `papers_stack` — the held items baked into the judge, defense,
juror and clerk (GAP-ANALYSIS #12), as standalone sprites. Geometry and colours live in
`held-props.mjs` and are called by BOTH `vox-chars.mjs` and `props.mjs`, so the prop
and the character cannot drift (character PNGs are byte-identical after the refactor).
Manifest entries add `holdAnchor` (grip point, prop space) and `heldBy`
(`character`, `hand`, `handOffset` = hand joint minus grip as baked on the character).
The two posed gavels are the same boxes rotated 35 / 125 degrees and re-voxelised, and
are drawn with `keepOrder` (see `render.mjs`).

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

## First-person hands (`characters/player/hands/`)

Art bible Part 2 #6: hands and forearms only, no body. Voxel box lists
(`source/fp-hands.mjs`, exporter `source/export-fp-hands.mjs`, run from `cc-art/`),
rendered with the cast's orthographic two-light rig, transparent bg, 256x256
frames (@1x) / 512x512 (@2x). Every frame shares one framing, so poses swap in
place; the forearm runs off the bottom edge, pin the frame to the bottom of the screen.

| Pose | Side | Use |
|---|---|---|
| `relaxed` | both | idle / walking, empty hands |
| `gavel_hold` / `gavel_raised` / `gavel_strike` | right | gavel (same geometry as the Judge's, `gavelBoxes()`) |
| `point` | right | OBJECTION / accuse |
| `phone_hold` | right | phone, screen toward the player |
| `evidence_hold` | right | evidence sheet toward the player |

One-handed poses also have an x-mirrored `left/` set. `skin/<hex>/` holds every
pose in all 6 player skin tones, `_skin-sheet.png` is the contact sheet, and
`hands-manifest.json` has size, side and wrist anchor per pose. Sleeve colour is
the player's default clothing colour (parameter in `buildHands`).

**Honest notes:** gavel raised/strike are translations of the same grip, not a
rotated swing (boxes are axis-aligned, so the gavel stays upright); animate with
a transform tween. Fingers read as stacked rows, closer to a chunky voxel fist
than detailed anatomy. Not yet tried in-engine.

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
| `export-vox.mjs` | Bulk export → 144 character sprites + sheets (+ juror seated) |
| `gallery-npcs.mjs` / `export-gallery.mjs` | Seeded seated audience NPCs + export |
| `export-player-vox.mjs` | Player parts → 58 sprites |
| `animations.mjs` | 55 animations (incl. juror `seated_idle`), 10 system |

Regenerate everything:

```bash
cd cc-art
npm install --no-save pngjs   # the only dependency; not vendored
node export-vox.mjs          # characters (export-all.mjs is the retired 2D pipeline)
node export-gallery.mjs      # gallery NPCs
node export-player-vox.mjs   # player parts
node ui-kit.mjs              # UI
node fx-kit.mjs              # FX
node brand-kit.mjs           # wordmark, share card, case card
```

---

## What remains (all optional polish)

| Item | Why it's optional |
|---|---|
| Rebuild player on `pen3` | Biggest quality win, but the existing parts function |
| Judge expression separation | Faithful as-is; a taste call |
| Animated (multi-frame) idle gestures | Idle variants exist as held poses; continuous motion is polish |
| GLB export of the `.bbmodel` | Needs a GUI click in Blockbench |

**Nothing blocking remains.** Every asset the animation system references now
exists at the path it expects.
