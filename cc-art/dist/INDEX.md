# CringeCourt — Asset Bundle Index

Start here. Five guides, in the order a coding agent should read them.

| Order | File | Answers |
|---|---|---|
| 1 | **`SCENE-GUIDE.md`** | What the courtroom is, where everything sits, how to load it |
| 2 | **`ASSET-GUIDE.md`** | All 41 props, 13 block textures, palette, placement conventions |
| 3 | **`CHARACTER-SPEC.md`** | Every character, the layer system, customization, manifests |
| 4 | **`ANIMATION-GUIDE.md`** | Playback, state machine, all 54 animations |
| 5 | **`ASSET-COMPLETE.md`** | Final inventory + what remains (optional polish only) |
| 6 | `GAP-ANALYSIS.md` | Historical: what the gaps were before they were filled |
| 7 | `VILLAGE-DECISION.md` | Why the village set was cut, what stays, when to reopen |

## Machine-readable data

| File | Contents |
|---|---|
| `scene/courtroom.boxes.json` | **1606 boxes** in world space — the whole room, ready to mesh |
| `scene/courtroom.layout.json` | Room dims, 55 prop instances, 8 camera presets |
| `animation/animations.json` | 8 characters, 55 animations, 10 system animations, state machine |
| `characters/manifest.json` | Per-character boxes, sizes, materials, files |
| `sprites/props/manifest.json` | Per-prop bounds, footprints, heights |
| `models/CringeCourt_Props.bbmodel` | 41 props, editable in Blockbench |

## Renders

| Folder | Contents |
|---|---|
| `scene/pov_*.png` | 6 first-person angles + iso + cutaway |
| `preview_blocks.png` | 13 block textures, tiled 2×2 to show seams |
| `preview_props@4x.png` | All 41 props, isometric |
| `characters/_previews/lineup.png` | All 8 characters, equal scale |
| `characters/_previews/gallery.png`, `gallery_benches.png` | 8 seated gallery NPCs: back / rear 3/4 / front 3/4, and on benches |
| `characters/gallery/` | Gallery NPC sprites + manifest (seeded) |

## Quick start

```js
// room
const boxes = await fetch('scene/courtroom.boxes.json').then(r => r.json());
// merge by `m` (the hex colour) → 16 draw calls for the entire courtroom

// characters are 2D billboards, 63 world units tall
// animation: pose + expression snap, transform lerps
const anim = (await fetch('animation/animations.json').then(r => r.json()))
  .characters.judge.animations.find(a => a.id === 'objection');
```

## Status

| Area | State |
|---|---|
| Courtroom | ✅ 1606 boxes, 8 camera presets, validated |
| Props | ✅ 41 props / 995 boxes, manifest + bbmodel |
| Block textures | ✅ 13 tileable 16×16 |
| Characters | ✅ 8 voxel characters, 643 boxes, 3 views each |
| Animation data | ✅ 54 animations, validated, timed |
| Expressions | ✅ **64** (8 per character) |
| Poses | ✅ **80** (10 per character) |
| UI kit | ✅ **34** assets |
| FX | ✅ **10** |
| Player parts | ✅ **60** |
| First-person hands | ✅ 7 poses x 6 skin tones (+ left mirrors), `characters/player/hands/` |

## Three things to know before you start

1. **The courtroom is 1606 boxes in world space.** No assembly step. Merge by
   material and you're done.
2. **Characters are voxel box lists**, not drawn sprites — same system as the
   courtroom, so they match. Rebuild poses from the same parameters.
3. **Pose/expression snap, transform lerps.** Cross-fading poses kills the
   hand-drawn feel.
