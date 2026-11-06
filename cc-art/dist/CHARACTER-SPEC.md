# CringeCourt — Character Asset System

**This is the authoritative spec for characters.** Read `SCENE-GUIDE.md` for the
courtroom and `ASSET-GUIDE.md` for props. If anything conflicts, **this file wins
for characters**.

**Art direction:** anime-inspired chibi. Exaggerated, stupid, funny, chaotic.
Every character should look entertaining with no dialogue. Warm palette — cream,
burgundy, gold, red, navy, purple. Bold outlines, expressive faces, polished 2D
sprites. **Not** generic fantasy RPG, **not** serious realistic anime. The goal is
a courtroom where everyone looks slightly unhinged.

---

## 1. The one architectural rule

**Do not generate one image per combination.** The player avatar is a **layered
sprite system** — one base body plus swappable layers composited at runtime.
Fixed characters use the same layering for expressions.

```
canvas 512 × 512 @ 2x (256 × 256 logical)
all layers share: same canvas, same anchor, same camera angle, same outline weight
```

Layers draw **bottom → top**. Each layer is a full-canvas transparent PNG; only
the pixels that layer owns are opaque. This is what makes any hairstyle work with
any body without re-rendering.

---

## 2. Fixed characters (6)

Generated once, never randomized. Priority order: **Judge → Prosecutor →
Defense → Bailiff → Clerk → AI Narrator**.

Every fixed character ships **10 poses** and **8 expressions** (§4, §5).

### 2.1 Judge Gavel.exe — `judge/`

| Trait | Spec |
|---|---|
| Build | Old, heavyset, authoritative, ridiculously expressive |
| Hair | Long wild **white/silver**, swept back |
| Beard | Full white beard + moustache, bushy brows |
| Eyes | **Hidden** behind black sunglasses with pixel glint |
| Robe | Dark **maroon/purple** judicial robe, **white fur collar**, gold accents |
| Neck | White shirt/cravat visible at the collar |
| Chain | **Gold chain with round scales medallion** |
| Prop | **Oversized wooden gavel** — signature, roughly head-sized |
| Personality | Dramatic, pompous, delighted by his own rulings |

**Fixed. Do not customize.** Signature beat: raising the gavel, shouting
**"ORDER!"**

> ⚠️ **Conflict with existing asset.** The voxel `GavelExe.bbmodel` I built
> earlier has **gold wire glasses** and no sunglasses. This reference is
> authoritative — the Judge wears **black pixel sunglasses** and a gold scales
> chain. Rebuild or restyle the voxel model before shipping it.

### 2.2 Miss Ratio — Prosecutor — `prosecutor/`

| Trait | Spec |
|---|---|
| Build | Feminine, aggressive, smug, overconfident |
| Hair | Long voluminous **pink/magenta**, swept side bangs |
| Eyes | **Pink/red** |
| Outfit | Dark burgundy/black blazer, white shirt, **red tie** |
| Accessories | **Gold scales earrings**; dark sunglasses pushed up on her head |
| Personality | Treats every dumb decision as a crime against common sense |
| Signature | Dramatic pointing finger, **"OBJECTION!"** |

### 2.3 Counsel Chaos — Defense — `defense/`

| Trait | Spec |
|---|---|
| Build | Masculine, chaotic, clever, sarcastic |
| Hair | Messy spiky **dark brown**, small ahoge/cowlick |
| Eyes | **Brown/amber** |
| Outfit | Dark **navy/purple** suit jacket, white shirt, red tie, gold details |
| Accessories | **Bandage on one cheek** |
| Personality | Can defend absolutely anything |
| Prop | Document reading **"EXHIBIT A (EXCUSE)"** |
| Signature | **"COUNTER!"** |

### 2.4 Bailiff — `bailiff/`

| Trait | Spec |
|---|---|
| Build | Broad, stern uniform; funny reactions under the seriousness |
| Outfit | **Navy police-style uniform**, cap with badge, belt, epaulettes |
| Accessories | Badge, whistle, cuffs on belt |
| Role | Maintains order, keeps the peace |
| Expressions | Mostly deadpan — the joke is the one crack in it |

### 2.5 Clerk — `clerk/`

| Trait | Spec |
|---|---|
| Build | Feminine, **overworked**, permanently tired |
| Hair | Brown, tied up, strands escaping |
| Eyes | Behind **round glasses** |
| Outfit | Cream blouse, burgundy waistcoat, gold buttons |
| Accessories | Glasses, **armful of stacked papers**, pen behind ear |
| Expressions | Tired, stressed, dead-eyed, quietly furious |

### 2.6 AI Narrator — 0G — `ai-narrator/`

| Trait | Spec |
|---|---|
| Build | **Small floating robot**, no legs, hovers |
| Face | **Digital screen face** — LED mouth/eyes, emotive glyphs |
| Body | Cream/white chassis, **purple + cyan** accents, gold trim |
| Prop | Floating papers orbiting it |
| States | idle, loading, processing, success, failure, narration |

This one is **not humanoid** — it doesn't use the human body base. It has its own
sprite set with 6 states.

---

### 2.7 The Defendant (anonymous) — `defendant/`

Not a fixed character: a per-case stand-in for the accused. Hooded or masked
voxel bust, no face, no skin, deliberately different from the Creator's pink
hoodie so it never reveals who the creator is (pseudonymous, never a promise of
perfect anonymity). Swappable parameters: mask (`bag` / `censor` / `hood`),
hoodie accent (burgundy, magenta, near-black, mustard, plum), eye-glint colour,
and a 6-bit booking-tag barcode. `variantForCase(caseId)` derives them
deterministically (FNV-1a → mulberry32). Poses: neutral, smug, shocked, defeated,
slump, celebrate, plus the "CHARGES FILED" composite and a 4-frame stamp-impact
sequence for `case_accepted`. Implementation: `defendant-vox.mjs`,
`export-defendant.mjs`; details in ASSET-COMPLETE.md.

## 3. Juror / Voter — `juror/`

A **recognizable generic NPC**, and explicitly **not** the player's appearance.
Several variants share one silhouette so a jury reads as a group.

| Trait | Spec |
|---|---|
| Build | Androgynous, slouchy |
| Hair | Shaggy **brown** under a cap |
| Eyes | Brown, mostly hidden by **oversized round glasses** |
| Outfit | **Blue/purple hoodie**, dark shirt underneath |
| Accessories | **Blue baseball cap with cat/paw motif**, **over-ear headphones with cat-face decal**, round glasses |
| Prop | **Red-and-white striped popcorn bucket** |

Generate **6–8 colour variants** (cap and hoodie hue shifts) so three jurors in a
box don't look cloned. Reactions matter more than detail here.

**Seated pose (implemented, juror only):** `juror/poses/seated.png` (front) and
`seated_threeq.png`, from `EXTRA_POSES.seated` in `vox-base.mjs`: thighs
horizontal, shins vertical, body lowered 13 units. It needs the rig-ready
`legs({ seat: true })` geometry, so it is outside the shared 10 poses and is not
available on other characters yet. The 6-8 colour variants above are not part of
this work. Animation: `seated_idle` (juror only) in `animations.json`.

### Gallery / audience NPCs — `gallery/`

8 seated, low-detail background NPCs for the gallery benches, generated from a
seed by `gallery-npcs.mjs` (`node export-gallery.mjs [seed] [count]`, default
seed `0xC0FFEE`, so output is reproducible). Parameters: 8 hair styles x 8 hair
colours, 6 skin tones, 4 top styles x 9 top colours, 8 accessories (glasses,
headphones, cap, beanie, scarf, backpack, earrings, none); leg and shoe colour
vary too. Each NPC has `back` (camera behind the bench), `back3q` and `threeq`
(front 3/4), transparent PNGs @1x/@2x sharing one framing so they align on a
bench. Previews: `_previews/gallery.png`, `_previews/gallery_benches.png`.
Back views are the identity carrier (hair back, backpack, band, cap strap, hood).
Seated NPCs read best on a bench; the bench is only in the preview.

---

## 4. Expressions — 8 per character

One PNG per expression, **head/shoulders only**, same crop and anchor. Composite
as a layer over the body pose.

| ID | Name | Read |
|---|---|---|
| `neutral` | Neutral | Default resting face |
| `happy` | Happy | Genuine delight |
| `angry` | Angry | Fury, veins, shouting |
| `shocked` | Shocked | Eyes bulging, jaw open |
| `laughing` | Laughing | Eyes closed, head back |
| `crying` | Crying | Streaming tears |
| `confused` | Confused | Squint, sweat drop, "?" |
| `smug` | Smug | Half-lidded, insufferable |

**Filenames:** `expressions/<id>.png` — e.g. `judge/expressions/shocked.png`.

---

## 5. Poses — 10 per character

Full-body, arms/legs included. The spec requires exactly these:

| ID | Name | Use |
|---|---|---|
| `idle` | Front / idle | Loop in the scene |
| `talking` | Talking | Mouth open, gesture — dialogue |
| `happy` | Happy | Reaction |
| `angry` | Angry | Reaction |
| `shocked` | Shocked | Reaction |
| `laughing` | Laughing | Reaction |
| `crying` | Crying | Reaction |
| `confused` | Confused | Reaction |
| `objection` | Objection / action | The signature beat |
| `defeated` | Defeated | Slumped, face-down |

**Filenames:** `poses/<id>.png`.

**Per-character signature overrides** on `objection`:

| Character | Pose |
|---|---|
| Judge | Gavel raised, "ORDER!" |
| Prosecutor | Leaning forward, pointing, "OBJECTION!" |
| Defense | Holding EXHIBIT A, other hand out, "COUNTER!" |
| Juror | Clutching popcorn, wide eyes, "…" |
| Creator | Collapsed face-down, despair |

---

## 6. Player avatar — voxel parts

**Status: not built.** The earlier 2D layered-sprite prototype was rejected — it
looked crude beside the voxel cast — and its code and renders have been **deleted**.
`cc-art/player.mjs` no longer exists; nothing should reference it.

The player must be built the **same way as the other 8 characters**: as box
lists in `cc-art/chibi-chars.mjs`, sharing `chibi-base.mjs` proportions.

### 6.1 Why voxel, not layers

The cast is 3D voxel. A 2D layered sprite in that room reads as a sticker pasted
on — wrong lighting, wrong shadow, wrong silhouette. Box lists also give
consistency for free: change a parameter and every pose updates.

### 6.2 Parts model

The player is one body assembled from swappable **part groups**, each a box list:

| Slot | Options | Notes |
|---|---|---|
| `body` | masculine, feminine, androgynous | Torso+limb proportions via the same `H` constants |
| `head` | round, angular, long | Replaces the skull block set |
| `eyes` | round, sharp, sleepy, sparkle | Face-layer boxes |
| `hair` | short, long, ponytail, buns, messy, buzz, afro, spiky | 8–20 masses each, same as the cast |
| `clothing` | tee, hoodie, shirt, suit, jacket, robe, meme | Torso+arm coverage |
| `accessory` | glasses, headphones, cap, chain, earrings, mask, shades | Sits over head/neck |

**Colours are tints, not separate parts.** Skin and hair take a hex at build
time — 6 skin tones × 7 hair colours come free from one geometry set.

### 6.3 Combination

`buildPlayer({ body, head, eyes, hair, clothing, accessory, skin, hairColor, clothingColor })`
concatenates the box lists and returns one array — identical shape to
`CHARACTERS[id].parts()`, so the same renderer and the same in-game loader work.

Rough count: **~90 configurations × ~100 boxes** — no pre-rendered grid, ever.

### 6.4 Preview UI

Compose on change, re-render at `yaw: 18, pitch: 9` (the `threeq` view — it is
the most flattering and the most readable). Save the config object, never a
baked image.

## 7. Animation system

Characters are **sprite-swapped**, not skeletally animated. An animation is a
**timeline of pose + expression + transform**, driven by a small state machine.

### 7.1 Animation definition schema

```json
{
  "id": "judge_order",
  "character": "judge",
  "loop": false,
  "duration": 1.4,
  "tracks": [
    { "t": 0.0,  "pose": "idle",      "expression": "neutral",  "transform": { "x": 0,  "y": 0,  "scale": 1.0,  "rot": 0 } },
    { "t": 0.15, "pose": "objection", "expression": "angry",    "transform": { "x": 0,  "y": -6, "scale": 1.06, "rot": -2 }, "fx": "shake" },
    { "t": 0.55, "pose": "objection", "expression": "angry",    "transform": { "x": 0,  "y": -6, "scale": 1.06, "rot": -2 } },
    { "t": 0.9,  "pose": "talking",   "expression": "smug",     "transform": { "x": 0,  "y": 0,  "scale": 1.0,  "rot": 0 } },
    { "t": 1.4,  "pose": "idle",      "expression": "neutral",  "transform": { "x": 0,  "y": 0,  "scale": 1.0,  "rot": 0 } }
  ]
}
```

- `t` = seconds from animation start
- Each track entry is a **keyframe**; interpolate `transform` linearly, **snap**
  `pose`/`expression` (sprite swap, no blending — this is a sprite game)
- `fx` triggers an effect layer: `shake`, `flash`, `impact`, `sweat`, `tears`

### 7.2 Required animations

**Per fixed character** (6):

| ID | Duration | Loop | Trigger |
|---|---|---|---|
| `idle` | 2.0 | ✅ | Default state |
| `talk` | 1.2 | ✅ | Dialogue playing |
| `react_happy` | 0.9 | ❌ | Positive outcome |
| `react_angry` | 0.9 | ❌ | Negative outcome |
| `react_shocked` | 0.8 | ❌ | Reveal |
| `objection` | 1.4 | ❌ | Signature beat |
| `defeated` | 1.6 | ❌ | Verdict against them |

**Global / system animations:**

| ID | Duration | Notes |
|---|---|---|
| `enter_court` | 2.4 | Doors swing, spotlight, case number stamps |
| `case_accepted` | 1.6 | Defendant portrait pops, "CHARGES FILED" stamp |
| `jury_seated` | 2.0 | Three seats fill one by one, badges glow |
| `bond_committed` | 1.4 | "JURY DUTY ACCEPTED" receipt |
| `ballot_commit` | 1.6 | Ballot drops into sealed box — **no tally shown** |
| `ballot_reveal` | 1.8 | Seals unlock |
| `verdict_guilty` | 2.2 | Gavel strike, lighting shift, giant card |
| `verdict_not_cooked` | 2.2 | Same, green treatment |
| `verdict_none` | 2.0 | NO VERDICT card |
| `settlement` | 1.2 | Receipt slides in |

### 7.3 State machine

```
        ┌──────────┐
        │   idle   │◄────────────────────┐
        └────┬─────┘                     │
             │ trigger                   │
             ▼                           │
        ┌──────────┐   on end    ┌───────┴──────┐
        │  action  │────────────►│  return_idle │
        └────┬─────┘             └──────────────┘
             │ interrupt
             ▼
        ┌──────────┐
        │  react   │───► (chains back to idle)
        └──────────┘
```

Rules:
- `idle` and `talk` loop; everything else is one-shot
- A one-shot **interrupts** any loop and blocks new triggers until it ends
  (except `objection`, which may interrupt `talk`)
- Never leave a character mid-one-shot when a scene transition fires — snap to
  `idle`
- Talking: alternate `talk` ↔ `idle` on a 1.2–2.4s random interval while
  dialogue streams

### 7.4 Performance notes

- **Preload one character's poses+expressions** when they enter a scene (~18
  images at ~40 KB each ≈ 700 KB). Don't load all 6 up front.
- Poses and expressions are small PNGs — **use a texture atlas per character**
  to cut draw calls. One atlas per character = 1 draw call for the body, 1 for
  the face layer.
- Cache composed player avatars by a hash of the layer config. Two players with
  the same config should hit cache.

---

## 8. Manifest schema

Every character (and the player) ships a `manifest.json`:

```json
{
  "id": "judge",
  "label": "Judge Gavel.exe",
  "role": "judge",
  "fixed": true,
  "canvas": { "w": 512, "h": 512, "scale": 2 },
  "anchors": { "head": [256, 132], "eye": 138, "neck": [256, 232], "foot": 470 },
  "poses": {
    "idle": "poses/idle.png",
    "talking": "poses/talking.png",
    "objection": "poses/objection.png"
  },
  "expressions": {
    "neutral": "expressions/neutral.png",
    "angry": "expressions/angry.png"
  },
  "animations": ["idle", "talk", "objection", "defeated"],
  "props": { "gavel": "props/gavel.png" },
  "palette": { "robe": "#5C1A26", "fur": "#FAFAFA", "gold": "#D9A046" }
}
```

Player manifest replaces `poses`/`expressions` with the **layer library**:

```json
{
  "id": "player",
  "fixed": false,
  "layers": [
    { "order": 0, "slot": "base",        "path": "base/{gender}.png",          "options": ["masculine","feminine","androgynous"] },
    { "order": 1, "slot": "face",        "path": "faces/{shape}.png",           "options": ["round","angular","long"] },
    { "order": 2, "slot": "eyes",        "path": "eyes/{style}.png",            "options": ["round","sharp","sleepy","sparkle"] },
    { "order": 3, "slot": "hair_back",   "path": "hairstyles/{style}/back.png", "options": ["short","long","ponytail"] },
    { "order": 4, "slot": "clothing",    "path": "clothing/{item}.png",         "options": ["tee","hoodie","suit"] },
    { "order": 5, "slot": "hair_front",  "path": "hairstyles/{style}/front.png","options": ["short","long","ponytail"] },
    { "order": 6, "slot": "accessory",   "path": "accessories/{item}.png",      "options": ["glasses","cap","chain"] }
  ],
  "tints": {
    "skin":  { "layer": "base", "hues": ["#F5D5BE","#E8C4A8","#C49A7A","#A87B5C","#7C5842","#5A3D2E"] },
    "hair":  { "layer": "hair_back", "hues": ["#1A1A1A","#6B4226","#E6D08A","#FF9AC6","#9B6BE0","#6BD6D6","#DCDCDC"] }
  }
}
```

Saving an avatar = `{ gender, skin, shape, eyes, hairStyle, hairColor, clothing, clothingColor, accessories[] }`.

---

## 9. Directory layout

```
assets/characters/
├── judge/           { manifest.json, poses/, expressions/, props/ }
├── prosecutor/
├── defense/
├── bailiff/
├── clerk/
├── ai-narrator/
├── juror/
│   ├── variants/    (6–8 colour variants)
│   └── ...
├── player/
│   ├── base/           masculine | feminine | androgynous
│   ├── faces/          round | angular | long
│   ├── eyes/           round | sharp | sleepy | sparkle
│   ├── hairstyles/     <id>/back.png, <id>/front.png
│   ├── clothing/       <id>/base.png  (+ <id>/<colour>.json tint)
│   ├── accessories/    <id>.png
│   ├── expressions/    neutral | happy | angry | shocked | laughing | crying | confused | smug
│   ├── poses/          idle | talking | objection | defeated
│   └── fx/             sweat | tears | blush | sparkle
└── previews/        one contact sheet per character + one per player category
```

---

## 10. Build order

Priority is explicit — follow it.

1. **Character consistency** — Judge first, fully done (10 poses + 8 expressions +
   manifest + preview sheet). He is the brand.
2. **Player customization** — base + faces + eyes + 2 hairstyles + 2 clothing + 2
   accessories, with a working preview. Prove the layer stack before adding parts.
3. **Expressions** — full 8 for the remaining fixed cast.
4. **Animation poses** — the 10 poses for each fixed character.
5. **Extra cosmetic variations** — more hairstyles, clothing, colours.

**Do not compromise quality to generate more variations.** Nineteen good parts
beat fifty sloppy ones — the layer system means you can always add later.

---

## 11. Integration contract (for the coding agent)

**Rendering.** Composite layers onto one `<canvas>` or into a `THREE.Sprite`. Never
bake to an image unless exporting a share card.

**In the 3D courtroom.** Characters are **2D billboards** in the voxel scene.
Use `THREE.Sprite` or a camera-facing quad, positioned at:

| Character | World position | Notes |
|---|---|---|
| Judge | `[0, 21, -62]` | Behind the bench, on the dais |
| Prosecutor | `[-56, 0, -22]` | At the prosecution desk |
| Defense | `[56, 0, -22]` | At the defence desk |
| Witness | `[-30, 0, -38]` | At the witness stand |
| Jurors ×3 | `[84, 0, -40]` | In the jury box |
| Bailiff | `[0, 0, 40]` | By the bar railing |
| Clerk | `[-30, 0, -6]` | Side desk |
| Player | camera-relative | First-person: hands/props only, or over-shoulder |

Billboard sprite height should match **63 world units** (the character height the
courtroom was built around). Scale the 512px sprite accordingly.

**First-person caveat.** The player is first-person, so the avatar is mostly seen
in profile/menus/case cards. Prioritise the **face layer quality** over full-body
detail for the player — that's what actually gets seen. First-person hand sprites
(gavel, point, phone, evidence, relaxed) live in `characters/player/hands/`; see
ASSET-COMPLETE.md.

**Asset loading.** Characters are independent of the scene — load them
per-scene, not at startup (§7.4).

---

## 12. Open questions for the user

1. **Sprite resolution** — 256 logical (512 @2x) as specced, or 128 logical for a
   crisper pixel-art look that matches the voxel scene better?
2. **The Judge conflict** — restyle the existing voxel `GavelExe` to match this
   reference (black pixel shades, gold scales chain), or keep the gold glasses?
3. **Billboard or full voxel characters?** The reference is 2D anime, but the
   courtroom is 3D voxel. Confirm billboards are acceptable rather than modelling
   everyone.

---

## 13. What actually ships today

Honest status, so nobody plans against art that doesn't exist.

| Deliverable | State |
|---|---|
| `CHARACTER-SPEC.md` (this file) | ✅ Complete |
| `ANIMATION-GUIDE.md` | ✅ Complete |
| `animation/animations.json` | ✅ 11 characters, 106 animations, 10 system, validated |
| **Player avatar** | ❌ Not built — voxel parts plan in §6 |
| **Characters (8)** | ✅ **Shipped** — 643 boxes total, 3 views each, see `characters/` |
| Expressions for the cast | ⬜ None — neutral render only |

| Animation poses | ⬜ None — timeline data exists, poses do not |
| FX sprites | ⬜ None |
| Callout bubbles ("ORDER!") | ⬜ None |

### What the character build proves

`source/chibi-chars.mjs` defines all 8 characters as box lists. It validates:

- **Chibi proportions** — head is 34 of 80 units (42%), matching the reference sheet
- **Consistent framing** — every character renders at the same scale from the
  same anchors, so a lineup reads as one cast
- **Hair as stacked masses** — 8–20 overlapping blocks per character, which is
  what stops them looking like blobs

Two renderer bugs were found and fixed while building these, both documented in
`char-render.mjs`: an inverted painter sort (every character rendered as the
back of their head) and a backwards yaw sign. If you rewrite the renderer,
check those two first — both present as "the character has no face".

```bash
cd cc-art
node export-chars.mjs   # rebuild all character PNGs + manifest
```

To add a character, append an entry to `CHARACTERS` in `chibi-chars.mjs` and
re-run `export-chars.mjs`.
### The Judge conflict, restated

The existing voxel `GavelExe.bbmodel` (in `models/`) has **gold wire glasses**.
This reference and this spec call for **black pixel sunglasses** plus a **gold
scales medallion chain**. Pick one before generating the Judge's 2D sprites, or
you'll ship two different judges.
