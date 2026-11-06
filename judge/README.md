# Judge Gavel.exe — game-ready asset

Built from your reference art. Voxel model, 74 cubes, 11-bone rig, 5 animations,
19 palette textures. Source of truth: `GavelExe.bbmodel` (opens in Blockbench).

## Deliverable

| File | What |
|---|---|
| `GavelExe.bbmodel` | Full project — geometry, rig, textures, all 5 animations. 71 KB |
| `GavelExe.glb` | glTF 2.0 binary, generated from the `.bbmodel` by `tools/bbmodel2glb.py` (rigid bone hierarchy, 74 cube meshes, 19 materials, 5 animations). 150 KB |
| `preview-glb.png` | Rendered from the GLB (not the bbmodel): rest, then `gavel_strike` at 0 s / 0.18 s / 0.25 s |
| `final-*.png` | 4 pose renders, side-lit viewport (not in this repo) |
| `preview-rest.png` | Rest pose, 3/4 + side, from `tools/preview.mjs` |
| `../tools/add-gavel.py` | Idempotently adds the gavel bone (re-run after re-exporting from Blockbench) |
| `../tools/bbmodel2glb.py` | Offline, deterministic `.bbmodel` -> `.glb` converter (stdlib only) |
| `../tools/glbcheck.py` | Stdlib GLB inspector (`check`) and software renderer (`render`) that reads only the GLB |
| `../tools/preview.mjs` | Renders any `.bbmodel` rest pose without the Blockbench GUI |

## Specs

| Property | Value |
|---|---|
| Format | `free` (generic model — exports to glTF/OBJ) |
| Dimensions | 34 × 63 × 17 units (W×H×D) |
| Cubes | 74 (67 body + 7 gavel) |
| Bones | 11 |
| Materials | 19 (`m_*` textures, 16×16 each) |
| Animations | 5 (71 keyframes total) |

## Rig

```
root
├── hips      (pivot 0,20,0)
├── torso     (pivot 0,28,0)
├── head      (pivot 0,44,0)
├── armL      (pivot -12,41,0) → foreL (pivot -12,30,0)
├── armR      (pivot  12,41,0) → foreR (pivot  12,30,0) → gavel (pivot 13,21.5,0)
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
- **The gavel is a child of `foreR`.** Handle runs forward through the fist,
  mallet head across its front end, gold bands and striking faces. Because it
  is parented to the forearm, all five animations carry it with no keyframe
  changes. It has its own `gavel` bone (pivot in the fist) for future wrist
  flicks.

## Known gaps (honest)

1. ~~No gavel prop~~ — added (`gavel` bone under `foreR`, 7 cubes).
2. **No texture atlas** — 19 separate 16×16 textures. Works, but for a real game
   you want one atlas + a single material (draw-call reasons).
3. **GLB is converter-made, not Blockbench-made** — the `gltf` codec crashed
   the plugin when called headless, so `tools/bbmodel2glb.py` writes the GLB
   itself. See "GLB export" below for conventions and what is unverified.
4. **Robe skirt is rigid** — no cloth bones. It will clip when he sits.
5. **Poses rendered via app screenshot** — the offscreen-view renderer caches
   transforms and returns identical frames. Screenshot capture is the reliable
   path. Same reason the pose PNGs show the Blockbench chrome.

## Next

Remaining: split the robe skirt into 2–3 cloth bones, and verify the GLB
against a Blockbench GUI export (checklist below).

## GLB export

Regenerate after any `.bbmodel` change (output is byte-identical for the same input):

```
python3 judge/tools/bbmodel2glb.py                      # dist/GavelExe.bbmodel -> dist/GavelExe.glb
python3 judge/tools/bbmodel2glb.py in.bbmodel out.glb --scale 0.03125 --fps 30
python3 judge/tools/glbcheck.py check judge/dist/GavelExe.glb
python3 judge/tools/glbcheck.py render judge/dist/GavelExe.glb out.png --anim gavel_strike --time 0.18 --yaw 80 --pitch 4
python3 judge/tools/glbcheck.py preview judge/dist/GavelExe.glb judge/dist/preview-glb.png   # the committed 4-frame strip
```

Conventions (also in the `bbmodel2glb.py` docstring):

- **Units**: Blockbench px x 1/16 = metres (Blockbench's own glTF scale). The
  model is 63 px = 3.9 m tall; use `--scale 0.03125` for a ~2 m person, or scale
  the root node in-engine.
- **Axes**: not flipped. Y up, front is **-Z** (Blockbench "north"); glTF's
  nominal front is +Z, so turn it 180 deg about Y in-engine if needed.
- **Hierarchy**: one node per bone, translation = pivot minus parent pivot; each
  cube is a child node with its own mesh. **Rigid parenting, no skin**: every
  cube follows exactly one bone, so joints/inverse-bind matrices add nothing.
  Cube rotation (none in this model) is baked about the cube's own origin.
- **Rest pose**: bone `rotation` fields are applied as node rotations (torso 9,
  head 8, armR 16, foreR 12 deg about X). The model therefore rests slightly
  hunched with the arm forward, as in Blockbench; `preview-rest.png` ignores
  these (`preview.mjs` only draws boxes), so it looks straighter.
- **Euler order**: Three.js `ZYX` (R = Rz Ry Rx), right-handed.
- **Animation**: additive on the rest pose. Animation X/Y are negated and Z kept
  before adding to the rest euler (Blockbench animator convention). Evidence the
  sign is right: `gavel_strike`/`verdict` raise the gavel overhead at t = 0 and
  bring it down at 0.12 s with this sign, and swing it backwards with the other.
- **Interpolation**: every key in this model is `catmullrom`; it is baked to
  LINEAR samples at 30 fps (uniform Catmull-Rom on euler, endpoints duplicated)
  plus exact key times. Pure `linear`/`step` channels map to LINEAR/STEP.
  CUBICSPLINE is not used. Bones with no keys get no channel.
- **UVs / textures**: per-face UVs normalised by texture size; PNGs embedded
  unchanged, NEAREST sampler (9728), one material per texture (19 draw calls
  per pose, 74 meshes). No atlas yet (gap 2).
- **Finding**: every face uses UV `[0,0,1,1]` on a 16x16 texture, i.e. only the
  top-left texel, which is the darker 1-px edge shade (e.g. robe `#4F1621`, not
  the `#5C1A26` fill that `preview.mjs` samples). The GLB keeps this faithfully;
  it is why GLB renders look a shade darker/noisier than `preview-rest.png`.
  Fix in the model (UV to e.g. `[4,4,5,5]`) when baking the atlas.

Verified with the official `gltf-validator` (0 errors/warnings/infos/hints),
`glbcheck.py check`, and `preview-glb.png`. Not loaded in Three.js, Unity,
Godot or Blender.

### Still needs the Blockbench GUI

1. **Cross-check the converter** with `File -> Export -> glTF` from the same
   `.bbmodel`: compare rest pose (rotation order/sign) and `gavel_strike`
   frame at 0 s; if the arm swings the wrong way, flip `ANIM_ROT_SIGN` in
   `bbmodel2glb.py`. Position-channel signs (`ANIM_POS_SIGN`) are untested
   (no position keys exist) and scale keys are ignored.
2. **Texture atlas** baking (gap 2) and the UV fix above: Blockbench's
   "Merge textures"/atlas tooling; then the converter can emit one material.
3. **Cloth bones for the skirt** (gap 4): needs bone placement in the outliner;
   the converter will pick up new groups automatically.
4. Optional: swap to Blockbench's exporter if its GLB turns out richer (it
   crashed headless, not necessarily in the GUI).
