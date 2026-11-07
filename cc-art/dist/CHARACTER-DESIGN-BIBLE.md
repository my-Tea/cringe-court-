# CringeCourt — Hero Cast Design Bible

**This is the authoritative look for the four courtroom heroes** in the roam
3D stage: Miss Ratio, Counsel Chaos, Judge Gavel.exe, and Clerk Ctrl+S.

It **supersedes** the pink/purple chibi notes in `CHARACTER-SPEC.md` **for these
four heroes only**. Jurors, gallery, bailiff, and the player wardrobe stay on the
voxel / layered-sprite paths in that file.

Runtime: stylized low-poly meshes in `HeroAvatar`
(`packages/scene/src/roam/three/heroAvatar.ts`). Optional Tripo/Blender GLBs may
replace the built mesh via `packages/scene/assets/roam/heroes/{id}/hero.glb`.

---

## Hybrid cast rule

| Role | Look | Runtime |
|---|---|---|
| Judge, Prosecutor, Defense, Clerk | This bible | `HeroAvatar` (procedural now; GLB when dropped) |
| Jurors, gallery, bailiff, player skins | Existing voxel cast | `VoxelAvatar` + `cast.json` |
| Courtroom / plaza | Unchanged | Existing boxes / dressing |

Do **not** rebuild room geometry for a cast refresh.

---

## Palette (locked)

| Hero | Primary | Secondary | Accent | Hair | Read |
|---|---|---|---|---|---|
| **Miss Ratio** (prosecutor) | Burgundy `#6B1C2E` | Charcoal `#2A2430` | Cream `#F3EDE2` | Near-black `#1A1214` | Sharp, smug, aggressive |
| **Counsel Chaos** (defense) | Forest green `#1F4D3A` | Night `#1C2430` | Warm cream `#F0E6D2` | Dark brown `#2B1F14` | Rounder, chaotic, clever |
| **Judge Gavel.exe** | Navy-black `#121826` | Slate `#2C3344` | Ivory `#F4F0E8` | Silver `#D8D4CC` | Heavy, authoritative |
| **Clerk Ctrl+S** | Dusty blue `#5B7A8C` | Steel `#3D5160` | Paper `#F0EADF` | Brown `#3A2E28` | Quiet, precise |

Dialogue HUD plates and callouts reuse these exact hex values.

---

## Silhouettes

### Miss Ratio — Prosecutor

- Feminine, sharp shoulders, slim burgundy blazer.
- **Asymmetric lock** falling over one eye; high contrast brows.
- Prop: cream evidence folder with burgundy stripe.
- Signature beat: finger point + **OBJECTION!** (when she is the one objecting) / smug lean when she is winning.

### Counsel Chaos — Defense

- Broader, looser silhouette; forest-green jacket; gold-ish tie.
- **Quiff / cowlick** hair volume on top.
- Prop: short case / briefcase.
- Signature beat: both-hands **objection** lean, explain gestures, victory bounce.

### Judge Gavel.exe

- Wide navy-black robe, ivory collar / fur ring, silver hair + beard.
- Prop: **oversized gavel** in the right hand.
- Signature beat: raise → slam → **ORDER!**; talk with slow authority.

### Clerk Ctrl+S

- Compact dusty-blue suit, neat bun.
- Prop: **clipboard** always in hand.
- Signature beat: thinking / scribble pose; quieter than counsel.

---

## Poses (shared `NpcPose`)

Heroes and voxel background cast share the same pose ids. Signature set for the
show:

`stand` · `sit` · `talk` · `gavel` · `point` · `objection` · `smug` · `shock` ·
`lean` · `explain` · `facepalm` · `cheer` · `panic` · `victory` · `defeat` ·
`cross_arms` · `thinking`

### Signature timing (heroes)

- **Miss Ratio `objection`:** wind-up lean → crash-forward point → chin-lift hold
  (angry brows + shouting mouth). Camera shake on hit.
- **Counsel Chaos `objection`:** open-palm body twist (must not read as Miss Ratio’s
  same clip in a green suit).
- **Judge `gavel`:** raise → pause → slam with angry face.
- **Faces:** brows / eyes / mouth drive mood from pose (`angry`, `shock`, `smug`,
  `talk`, …) so reactions read in close-ups.

### Cast reactions

`stageLine` / `reactionSteps` in `beats.ts` fire opposing counsel + gallery +
clerk (+ light judge tell) on objections, counters, smugs and gavels — including
AI-supplied lines, not only builtins.

**Fairness:** juror clips stay vote-agnostic (`cheer` / `shock` / `facepalm`
only — never a “guilty” or “not-cooked” pose).

Beat text → pose mapping lives in `poseForLine` (`packages/scene/src/roam/beats.ts`).

---

## Voice babble (no TTS)

Wordless Web Audio recipes under `packages/audio/src/recipes/voice.ts`:

| Cue | Character | Pitch feel |
|---|---|---|
| `voice.judge` | Judge | Low, slow |
| `voice.prosecutor` | Miss Ratio | High, fast, pan left |
| `voice.defense` | Counsel Chaos | Mid, pan right |
| `voice.clerk` | Clerk | Mid-high, short |
| `voice.narrator` / sides | Narration / Versus | Soft / mirrored pans |

Fired from roam `#setDialogue` and the classic engine director on each line.

---

## GLB drop-in (optional)

```
packages/scene/assets/roam/heroes/
  prosecutor/hero.glb
  defense/hero.glb
  judge/hero.glb
  clerk/hero.glb
```

Normalize before drop:

1. Feet at origin, Y-up.
2. Face **−Z**.
3. World height ≈ current cast (`~100 × CAST_SCALE`).
4. Prefer a single skinned mesh + clips named after `NpcPose` ids when retargeting.

Until a GLB exists, `HeroAvatar` builds the silhouette procedurally from this bible.

---

## What this does **not** change

- Courtroom / plaza / lobby meshes.
- Six-juror voxel redesign.
- Settlement / AI transcript logic.
- Real speech synthesis.
