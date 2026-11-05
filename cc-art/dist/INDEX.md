# CringeCourt — Asset Bundle Index

Start here. Four guides, in the order a coding agent should read them.

| Order | File | Answers |
|---|---|---|
| 1 | **`SCENE-GUIDE.md`** | What the courtroom is, where everything sits, how to load it |
| 2 | **`ASSET-GUIDE.md`** | All 41 props, 13 block textures, palette, placement conventions |
| 3 | **`CHARACTER-SPEC.md`** | Every character, the layer system, customization, manifests |
| 4 | **`ANIMATION-GUIDE.md`** | Playback, state machine, all 54 animations |

## Machine-readable data

| File | Contents |
|---|---|
| `scene/courtroom.boxes.json` | **1606 boxes** in world space — the whole room, ready to mesh |
| `scene/courtroom.layout.json` | Room dims, 55 prop instances, 8 camera presets |
| `animation/animations.json` | 8 characters, 54 animations, 10 system animations, state machine |
| `characters/player/player-library.json` | Canvas, anchors, layer order, every category option |
| `sprites/props/manifest.json` | Per-prop bounds, footprints, heights |
| `models/CringeCourt_Props.bbmodel` | 41 props, editable in Blockbench |

## Renders

| Folder | Contents |
|---|---|
| `scene/pov_*.png` | 6 first-person angles + iso + cutaway |
| `preview_blocks.png` | 13 block textures, tiled 2×2 to show seams |
| `preview_props@4x.png` | All 41 props, isometric |
| `characters/player/_preview_all.png` | Layer stack: every category in one sheet |

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
| Player layer system | ✅ Working compositor + 46 parts (placeholder art) |
| Animation data | ✅ 54 animations, validated, timed |
| Fixed characters | ⬜ Not generated — spec written, art pending |

## Three things to know before you start

1. **The courtroom is 1606 boxes in world space.** No assembly step. Merge by
   material and you're done.
2. **Player = layered sprites, never pre-rendered combinations.** ~90 PNGs give
   ~2.4M looks. `LAYER_ORDER` in `player.mjs` is the verified draw order.
3. **Pose/expression snap, transform lerps.** Cross-fading poses kills the
   hand-drawn feel.
