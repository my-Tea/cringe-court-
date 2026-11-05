# Characters — voxel chibi cast

**8 characters, 643 boxes.** Built the same way as the courtroom and props: as
box lists in code, rendered to PNG. The box list is authoritative.

| File | Contents |
|---|---|
| `manifest.json` | Per-character box counts, sizes, materials, file names |
| `<id>/front.png` | Straight-on view, transparent |
| `<id>/threeq.png` | 3/4 view — the best read of the silhouette |
| `<id>/side.png` | Profile |
| `@2x` versions | 840 × 1080, for UI |
| `_previews/lineup.png` | All 8 side by side at equal scale |

## The cast

| ID | Name | Boxes | Height | Read |
|---|---|---|---|---|
| `judge` | Judge Gavel.exe | **110** | 83 | Silver mane, black pixel shades, full white beard, burgundy robe, gold hem, **oversized gavel in raised hand** |
| `prosecutor` | Miss Ratio | 95 | 84 | Pink twin-tail volume, sharp pink eyes, burgundy suit, sunglasses pushed up, gold scales earrings, pointing arm |
| `defense` | Counsel Chaos | 95 | 91 | Messy brown spikes + cowlick, navy suit, bandage on cheek, **EXHIBIT A paper in hand** |
| `bailiff` | Bailiff | 69 | 87 | Navy uniform, peaked cap with gold badge, epaulettes, whistle |
| `clerk` | Clerk | 83 | 90 | Bun with escaping strands, round glasses, cream blouse + burgundy waistcoat, **armful of papers** |
| `ai-narrator` | AI Narrator (0G) | 25 | 43 | Floating robot, cyan screen face, purple/cyan accents, thruster, orbiting papers. **Not humanoid** |
| `juror` | Juror / Voter | 90 | 86 | Brown hair under blue cap, oversized round glasses, headphones, **popcorn bucket** |
| `creator` | Creator / Defendant | 76 | 90 | Pink hoodie with pixel heart, black pixel shades, messy hair |

## Proportions

Chibi: **head ≈ 34 of 80 total (42%)**, matching the reference sheet.

```
total       80      headBot 46 → headTop 80
head half-w 15      torso half-w 14  (nearly as wide as the head — narrower
                                     and the body vanishes under the head)
torso       20 → 44 legs 0 → 16
eye line    y = 60  mouth y = 52
arms        18 → 42
```

## Why these are box-built, not drawn

Every character is a **list of boxes**, so:

- **They stay consistent.** No drift between poses or expressions — a pose is a
  different box list generated from the same parameters.
- **They match the courtroom.** Same palette, same lighting behaviour, same
  chunky voxel language. A hand-drawn 2D sprite would look pasted on.
- **They're editable.** Change one number and the character updates.

Hair is **8–20 overlapping masses** per character, never one blob. That is the
difference between these and a placeholder: the Judge's mane is 14 separate
blocks, Miss Ratio's twin tails are 4 stacked masses each side.

## Rendering

`sourcel/char-render.mjs` — orthographic projector with supersampled AA and a
two-light rig (warm key from front-above-left, cool fill from the right).

```js
renderCharacter(parts, { w: 420, h: 540, ss: 2, yaw: 18, pitch: 9, bg: [0,0,0,0] })
```

**Two bugs worth knowing about, both fixed and commented in the code:**

1. **Painter sort was inverted.** Sorting `a.z - b.z` drew the face first and then
   painted the back of the head over it — every character rendered as the back of
   their head. Correct is `b.z - a.z`.
2. **Yaw sign was backwards.** Characters face `-Z` and the camera sits on `-Z`,
   so positive yaw has to rotate the opposite way.

Both produced "the character has no face" symptoms that look like geometry bugs
but are pure renderer bugs.

## In-game use

Characters are **2D sprites in a 3D voxel room** — billboards.

- Sprite height should map to **63 world units** in the courtroom (the height the
  room was dimensioned around).
- Positions and facings are tabulated in `../ANIMATION-GUIDE.md` §7.
- Expressions and poses (the 8 expressions / 10 poses from
  `../CHARACTER-SPEC.md`) are **not generated yet** — only the neutral front
  render exists per character.

## Not done

| Item | State |
|---|---|
| 8 expressions per character | ⬜ None |
| 10 poses per character | ⬜ None |
| Player avatar customization | ⬜ **Removed** — the earlier layered prototype was not good enough; rebuild as voxel parts |
| FX sprites (sweat, tears, impact) | ⬜ None |
| Callout bubbles ("ORDER!") | ⬜ None |

The Judge's **black pixel shades** and **gold scales chain** were built to the
character sheet — this settles the earlier conflict with the old `GavelExe.bbmodel`,
which had gold wire glasses. **These voxel characters are now canonical.**
