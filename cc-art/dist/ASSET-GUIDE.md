# CringeCourt — Asset Integration Guide

**Read this before wiring anything.** Every asset here is a **voxel box model**:
the authoritative geometry is a list of axis-aligned boxes, not a mesh. Two
representations ship side by side:

| Form | Path | Use for |
|---|---|---|
| **`.bbmodel`** (authoritative) | `models/CringeCourt_Props.bbmodel` | Source of truth. Open in Blockbench to edit, export to GLB/OBJ |
| **Isometric PNGs** | `sprites/props/*.png` | 2D HUD/menu art, item thumbnails, quick previews |
| **Block textures** | `textures/blocks/*.png` | 16×16 tileable surfaces for terrain/architecture |
| **Manifest** | `sprites/props/manifest.json` | Bounds + footprints for programmatic placement |

---

## 1. Conventions — read once, applies everywhere

**Units.** 1 unit ≈ 1 voxel ≈ 1/16 of a default Minecraft block. A human-scale
prop is ~24 units tall. Judge Gavel.exe is 63 units.

**Origin.** Every prop is authored with its **origin at the base centre** —
`y = 0` is the ground plane, `x = 0, z = 0` is the footprint centre. Drop any
prop at a floor position and it sits correctly with **no offset maths**. This is
the single most important convention here.

**Facing.** Props face **+Z** (toward the default camera). To rotate, rotate
around Y only.

**Symmetry.** Paired parts are mirrored across X. Nothing asymmetric uses a
mirror helper, so mirroring a whole prop is safe.

**Palette.** 20 materials, all named `p_<hex>`. See §5.

---

## 2. Models

### `CringeCourt_Props.bbmodel`
One project containing **all 41 props**, each as a separate root group in the
outliner.

```
Project: CringeCourt_Props
├── 995 cubes, 21 textures
├── 41 root groups (one per prop, named exactly as in §4)
└── meta: { format_version: "5.0", model_format: "free", box_uv: false }
```

**Why one file, not 41:** one texture pool, one import. Split them at build time
if your engine needs one mesh per prop — each group is already an independent
subtree, so `group → mesh` is a 1:1 split with no cleanup.

**Import path:**
- **Three.js** — export GLB from Blockbench (`File → Export → glTF`), load with
  `GLTFLoader`. Each root group arrives as a separate `Object3D`; find by `.name`.
- **Unity / Godot** — same GLB, or export OBJ. Set import scale so 1 unit = your
  chosen world scale (Unity default 1 unit = 1 m would make these tiny; scale
  ×0.1 or set the import factor to 16).
- **Blockbench as live source** — if the Blockbench MCP is running, models can be
  edited and re-read without touching disk.

### Per-prop bounds
`sprites/props/manifest.json` gives, for every prop:
```json
{ "name": "judge_bench", "label": "Judge bench + high back",
  "boxes": 40, "size": [38, 47, 24], "footprint": { "w": 38, "d": 24 },
  "height": 47, "pivot": [0,0,0], "image": "judge_bench.png" }
```
Use `footprint` for collision, `height` for camera targeting and occlusion.

Character-held props (`judge_gavel*`, `exhibit_a_paper`, `popcorn_bucket`, `papers_stack`)
also carry `holdAnchor` (grip point in prop space; x/z centred, y=0 on the ground,
front toward +z) and `heldBy: { character, hand, handOffset }`. To attach to a hand,
put the prop at `handJoint - holdAnchor`; `handOffset` (hand joint minus grip) is the
offset baked into the original character pose. Geometry source: `held-props.mjs`.

---

## 3. Block textures

All 16×16, **tileable** — the noise lattice wraps, so tiling has no visible seam.
Verified with a seam test (wrap-edge delta ≈ interior delta).

| File | Surface | Notes |
|---|---|---|
| `marble.png` | White marble | Faint veins. Walls, floors, statuary |
| `marble_floor.png` | Polished floor tile | Gold inlay border, meant to butt against itself |
| `pillar.png` | Column shaft | Vertical fluting, tiles vertically only |
| `gold.png` | Polished gold | Sheened. Trim, capitals, ornaments |
| `roof.png` | Burgundy shingles | Staggered rows, tiles in both axes |
| `wood.png` | Warm wood | 4px boards, staggered seams |
| `grass.png` | Grass | Bladed, tiling |
| `cobble.png` | Cobblestone | Voronoi stones with mortar |
| `carpet.png` | Red carpet | Gold trim rows top & bottom — **tiles along Z only** |
| `water.png` | Water | Diagonal dither + caustics |
| `velvet.png` | Velvet | Vertical folds |
| `banner.png` | Banner cloth | Burgundy with gold scales glyph |
| `parchment.png` | Paper | UI panels, documents |

**Tiling gotchas:**
- `carpet.png` and `banner.png` have deliberate top/bottom borders — use them as
  strips, not as freely tiling fields.
- `pillar.png` only tiles vertically (the fluting is horizontal detail).

---

## 4. Prop catalogue (41)

Grouped by room. Names are the exact group names inside the `.bbmodel` and the
PNG filenames.

### Courtroom — hero props
| Name | What it is | Size W×H×D | Boxes | Notes |
|---|---|---|---|
| `judge_bench` | Judge's bench + high back | 38×47×24 | 40 | Tallest hero prop. Raised back panel reads as authority. Place on a dais |
| `gavel` | Judge's gavel | 16×23×7 | 17 | **Held prop** — parent to `foreR` of a character rig, not to the floor |
| `gavel_block` | Gavel sound block | 11×4×11 | 12 | Pair with the gavel for the strike beat |
| `prosecutor_desk` | Prosecution lectern | 25×27×15 | 22 | Raised reading stand on top |
| `defense_desk` | Defence lectern | 25×27×15 | 22 | Same build, **teal** plaque instead of gold — that's the only difference |
| `witness_stand` | Witness box + rail | 21×19×17 | 22 | Back wall + front rail; open at the sides |
| `jury_box` | Three-seat jury box | 45×15×17 | 35 | Three velvet blocks. Fill seats one-by-one on recruitment |
| `evidence_screen` | Wall evidence display | 33×27×6 | 23 | Glowing screen. Wall-mount: rotate to face −Z |
| `sealed_ballot_box` | Ballot box, locked | 20×25×17 | 23 | Commit phase |
| `ballot_box_open` | Ballot box, unlocked | 20×30×17 | 19 | Reveal phase — swap meshes, don't animate the lid |
| `court_seal` | Scales-of-justice seal | 30×23×6 | 22 | Wall art behind the bench |
| `courtroom_door` | Double doors | 29×38×5 | 28 | For the "doors swing open" beat. Two leaves; pivot each at its inner edge to swing |
| `gallery_bench` | Gallery bench row | 33×12×13 | 25 | Repeat 3–4× for the gallery |
| `railing` | Bar railing | 37×17×4 | 27 | Separation between gallery and well |
| `ceiling_ring` | Circular ceiling halo | 34×3×34 | 40 | Gold ring. Overhead only — place at ceiling height |
| `spotlight_rig` | Spotlight housing | 11×11×11 | 16 | Emissive lens at the bottom (−Y). Point down |
| `column` | Marble column | 15×38×16 | 22 | Base + shaft + gold capital. Repeat for porticoes |
| `arch_window` | Gothic lit window | 19×28×4 | 22 | Wall-mount. Glass is emissive |
| `dais_step` | Raised dais platform | 49×4×25 | 23 | Carpet inset on top; gold nosing at the front edge |
| `wall_panel` | Modular wall panel | 33×26×3 | 22 | Tiles horizontally to build walls |
| `sconce` | Wall sconce | 11×18×7 | 13 | Warm emissive tip. Wall-mount |
| `neon_sign` | "ON TRIAL" neon | 38×13×3 | 15 | Magenta tube — the one non-palette emissive (`#FF7AC6`). Intentional |
| `banner_scales` | Hanging scales banner | 13×29×2 | 26 | **Hangs** — anchor at the top, not the base. Trust the mesh, not the pivot note |

> ⚠️ **`banner_scales` and `neon_sign` are the exceptions to the base-origin
> rule.** Model space has them extending upward from y=0, but visually they hang
> from above. Anchor them at their **top** edge, i.e. offset by `−height`.

### Courtyard / village
| Name | What it is | Size W×H×D | Notes |
|---|---|---|---|
| `fountain` | Two-tier fountain | 29×21×29 | 34 | Water surfaces are separate boxes — animate UV scroll on them |
| `lamp_post` | Lit street lamp | 9×36×9 | 20 | Emissive glass at y 26–32 |
| `bench` | Park bench | 29×13×11 | 30 | Seat + backrest |
| `barrel` | Wooden barrel | 12×14×12 | 12 | Gold bands |
| `crate` | Wooden crate | 11×11×12 | 15 | Cross-plank pattern |
| `bookshelf` | Court library shelf | 21×28×9 | 44 | Three shelves, books are coloured boxes |
| `throne_chair` | Red velvet armchair | 21×36×17 | 29 | High back + gold crest + arms |
| `judge_desk` | Wood desk, papers | 31×13×19 | 23 | Papers + small scales on top |
| `trunk` | Treasure trunk | 18×14×14 | 22 | Gold clasp + corner straps |
| `tree_round` | Round leafy tree | 20×31×19 | 17 | Trunk + stacked canopy |
| `tree_pine` | Pine tree | 16×28×16 | 14 | Tapered tiers |
| `bush` | Shrub | 13×9×11 | 8 | Low hedge |
| `flower_bed` | Stone-edged flower bed | 21×5×15 | 27 | Flowers are single boxes |
| `signpost` | Wooden signpost | 15×20×3 | 14 | Board at the top |
| `market_stall` | Stall + striped awning | 27×20×19 | 53 | Awning is 8 alternating stripes |
| `bunting` | Pennant string | 43×7×1 | 38 | 9 flags, 4-colour cycle. Hangs — anchor at top |
| `cart` | Two-wheel cart | 21×14×18 | 30 | Simplifies wheels to blocks; add real wheels if needed |

---

## 5. Palette (20 materials)

Every material is `p_<hex>` inside the `.bbmodel`. Use these exact values so new
assets match.

| Hex | Name | Where it's used |
|---|---|---|
| `#FFF9ED` | Marble white | Marble, parchment, bright highlights |
| `#DCC8B0` | Warm stone | Marble mid-tone, shading |
| `#A9917D` | Stone | Stone faces, pillar shadow |
| `#7B645A` | Dark stone | Deep shadow, mortar |
| `#4A3A32` | Near-black brown | Ink, poles, outlines |
| `#7A1C2E` | **Burgundy** | Brand colour. Robes, banners, carpet |
| `#A32D3F` | Crimson | Velvet mid, carpet field |
| `#CE4A44` | Red | Roof shingles |
| `#E07A3F` | Warm orange | Roof highlight |
| `#D9A046` | **Gold** | All trim and ornament |
| `#F6C75B` | Bright gold | Capitals, brackets, lit gold |
| `#FFF2C7` | Pale gold | Highlights, finials |
| `#8B5E2A` | Dark wood | Wood base |
| `#B77D3A` | Mid wood | Wood light, boards |
| `#3E7F50` | Leaf green | Foliage |
| `#6EBF73` | Grass green | Grass, lit foliage |
| `#A9D98F` | Light green | Canopy top |
| `#4D7CC5` | Water blue | Water base |
| `#BDF5FF` | Pale cyan | Water highlight, glass |
| `#3F8FA8` | Teal accent | Defence plaque, books |

Two **off-palette** emissives, used deliberately:

| Hex | Where |
|---|---|
| `#FFD79A` | Sconce hot tip, lamp glass |
| `#FF7AC6` | Neon sign tube |

---

## 6. Wiring notes per system

**Placing props.** `mesh.position.set(x, 0, z)` — no Y offset needed. Rotate
`mesh.rotation.y` in 90° steps to keep the voxel grid aligned.

**Collision.** Use `footprint.w × footprint.d` from the manifest as a box
collider, height from `manifest.height`.

**Ballot box state machine.** Two separate models
(`sealed_ballot_box` / `ballot_box_open`). Swap visible meshes on the
commit→reveal transition. Don't try to animate the lid — they're different
silhouettes.

**Doors.** `courtroom_door` is one mesh with two leaves. To swing, split the two
leaf cubes into separate objects and pivot each at its inner vertical edge.

**Gavel strike.** `gavel` is a **held** prop. Parent it to the character's
`foreR` bone at local `[0, 0, 0]`; it inherits the arm swing. `gavel_block` stays
on the bench. Contact point is roughly `[0, 0, 0]` at the gavel head.

**Emissive surfaces** (for bloom): `evidence_screen` glass, `sconce` tip,
`lamp_post` glass, `neon_sign` tube, `arch_window` glass. In Three.js give these
materials `emissive` + `emissiveIntensity`; the base colour is already bright.

**Water.** `fountain` water boxes + the `water.png` tile. Scroll UVs on Y for
flow.

**Banners.** Anchor at the **top** edge (see the warning in §4). They're flat
(1 unit deep) — double-side the material or they vanish from behind.

---

## 7. Regenerating / extending

The whole set is code, not hand-modelling:

```bash
cd cc-art
node export.mjs        # rebuild all prop PNGs + manifest
node -e "import('./render.mjs').then(m=>m.propSheet('./out/props_sheet.png',4,7))"
```

| File | Role |
|---|---|
| `palette.mjs` | Brand palette + material aliases + ramps |
| `props.mjs` | **All 41 base silhouettes** — large boxes. Add a prop here |
| `detail.mjs` | **Detail layer** — appended geometry per prop (995 total boxes) |
| `blocks.mjs` | 13 procedural 16×16 block textures |
| `render.mjs` | Isometric renderer (1 unit = 1px, then integer upscale) |
| `export.mjs` | Writes PNGs + `manifest.json` |
| `core.mjs` | Canvas, tileable noise, dither, colour parsing |

### Detail layers

Every prop is built in **two passes**:

1. `props.mjs` — the **base silhouette** (large boxes that define the shape)
2. `detail.mjs` — the **detail layer** (mouldings, studs, spindles, insets,
   brackets, hinges, glass panes, scrollwork)

`props.mjs` merges `DETAILS` into each prop at import time, so consumers only
ever see the combined box list. Keeping them apart means you can tune detail
density without touching the silhouette, and re-read the base shape if a prop
starts reading as noise.

**Detail budget per prop:** 3–40 boxes. Hero props (bench, jury box, stall) get
the most; simple props (bush, barrel) stay deliberately light. If a prop needs
more, add to `DETAILS[name]` — the renderer gives boxes under 9 units of total
volume a +6% contrast boost so small details stay legible at 1×.

**To add a prop:** append to `PROPS` in `props.mjs` —
```js
new_prop: { label: '...', parts: [ b([x0,y0,z0], [x1,y1,z1], M.gold) ] }
```
then rerun `export.mjs`. Mirror with `pair()` for symmetric parts.

---

## 8. Known gaps

1. **No GLB in this bundle.** Blockbench's `gltf` codec crashed when called
   headlessly. Export from the GUI: `File → Export → glTF`. Safe there.
2. **Props are one `.bbmodel`.** Split by group before import if your engine
   wants one mesh per prop.
3. **`banner_scales` pivot is wrong** for its visual use — it's authored
   base-origin like everything else, but hangs. Documented above; anchor manually.
4. **No LODs.** 995 boxes across 41 props is still light, but a full courtroom (60+ instances) will want instancing
   at this scale, but a full courtroom (60+ instances) will want instancing.
5. **Village props are thinner than courtroom props** — the reference art
   emphasises the courtroom, so courtyard assets are functional, not hero-grade.

---

## 9. File index

```
cc-art/dist/
├── models/CringeCourt_Props.bbmodel   995 cubes · 21 textures · 41 groups
├── textures/blocks/*.png              13 tileable 16×16 surfaces
├── sprites/props/*.png                41 props (+ @4x versions)
├── sprites/props/manifest.json        bounds, footprints, heights
├── preview_blocks.png                 texture contact sheet
└── preview_props@4x.png               all 41 props, isometric
```
