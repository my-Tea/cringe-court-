# Judge Gavel.exe — game-ready asset

Built from your reference art. Voxel model, 67 cubes, 10-bone rig, 5 animations,
19 palette textures. Source of truth: `GavelExe.bbmodel` (opens in Blockbench).

## Deliverable

| File | What |
|---|---|
| `GavelExe.bbmodel` | Full project — geometry, rig, textures, all 5 animations. 71 KB |
| `final-*.png` | 4 pose renders, side-lit viewport |

## Specs

| Property | Value |
|---|---|
| Format | `free` (generic model — exports to glTF/OBJ) |
| Dimensions | 34 × 63 × 17 units (W×H×D) |
| Cubes | 67 |
| Bones | 10 |
| Materials | 19 (`m_*` textures, 16×16 each) |
| Animations | 5 (71 keyframes total) |

## Rig

```
root
├── hips      (pivot 0,20,0)
├── torso     (pivot 0,28,0)
├── head      (pivot 0,44,0)
├── armL      (pivot -12,41,0) → foreL (pivot -12,30,0)
├── armR      (pivot  12,41,0) → foreR (pivot  12,30,0)
├── legL      (pivot  -5,20,0)
└── legR      (pivot   5,20,0)
```

Standard humanoid hierarchy — maps 1:1 onto Three.js / Unity / Godot skeleton
conventions. Elbows are separate bones, so forearm rotation works.

## Animations

| Name | Length | Loop | Bones | What it's for |
|---|---|---|---|---|
| `idle` | 2.0 s | loop | 6 | Breathing, subtle sway. Default state |
| `gavel_raise` | 0.6 s | once | 4 | Wind-up before a strike |
| `gavel_strike` | 0.5 s | once | 4 | The impact. Fast in, settle out |
| `point` | 0.8 s | once | 4 | Accusatory point at a party |
| `verdict` | 1.2 s | once | 4 | Full "case closed" beat — raise, strike, settle |

`gavel_raise` → `gavel_strike` chains into a 1.1 s swing. `verdict` is
standalone for one-shot dramatic moments.

## Palette

Straight from your illustration, hue-shifted per material family:

| Material | Hex | Use |
|---|---|---|
| `robeBase` | `#5C1A26` | Main burgundy robe |
| `robeLight` | `#8A2C3C` | Lit folds |
| `robeDark` | `#3A0B14` | Deep creases |
| `fur` | `#FAFAFA` | Ermine mantle |
| `gold` | `#D4AF37` | Trim, emblem, glasses |
| `goldBright` | `#E5C158` | Laurel epaulets |
| `hairBase` | `#E6E6E6` | Silver hair |
| `beard` | `#F0F0F0` | Beard |
| `skinBase` | `#E8C4A8` | Face, hands |
| `collar` | `#1C1E26` | Inner tunic, trousers |

## Design notes

The reference is a **2D anime illustration**; this is a **voxel interpretation**.
Three deliberate choices:

- **Silhouette over detail.** At this scale, the fur mantle and the gavel arm
  carry the character. Fine robe embroidery was dropped — it becomes noise.
- **The glasses are 1px.** They read at native size but vanish at thumbnail.
  If the character needs to read small, thicken them.
- **The gavel is not modelled yet.** The right hand is empty because all three
  gavel animations currently rotate the arm, not a prop. Add the gavel as a child
  of `foreR` and the animations will carry it automatically.

## Known gaps (honest)

1. **No gavel prop** — biggest gap. The strike animations read as a punch.
2. **No texture atlas** — 19 separate 16×16 textures. Works, but for a real game
   you want one atlas + a single material (draw-call reasons).
3. **No GLB yet** — the `gltf` codec crashed the plugin when called directly.
   Export manually: `File → Export → glTF` in Blockbench. Safe from the GUI.
4. **Robe skirt is rigid** — no cloth bones. It will clip when he sits.
5. **Poses rendered via app screenshot** — the offscreen-view renderer caches
   transforms and returns identical frames. Screenshot capture is the reliable
   path. Same reason the pose PNGs show the Blockbench chrome.

## Next

Say the word and I'll add the gavel prop (with a proper `foreR` parent), split
the robe skirt into 2–3 cloth bones, and export a GLB so it drops straight into
Three.js.
