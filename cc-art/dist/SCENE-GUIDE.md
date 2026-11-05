# CringeCourt — Courtroom Scene

The complete assembled courtroom: **1606 boxes**, **55 prop instances**, one
coherent room. This is the environment an agent wires up — not a prop list.

## What's in here

| File | What it is |
|---|---|
| `scene/courtroom.boxes.json` | **The scene.** Flat array of `{f, t, m}` boxes in world space — geometry only, no placement logic needed |
| `scene/courtroom.layout.json` | Room dims, every prop instance (name, position, rotation, scale, box count), and camera presets |
| `scene/pov_*.png` | 6 first-person renders from in-game camera heights |
| `scene/iso.png`, `cutaway.png` | Overview shots for reference |
| `models/CringeCourt_Props.bbmodel` | The 41 source props, editable in Blockbench |
| `ASSET-GUIDE.md` | Prop catalogue, palette, placement conventions |

**Key idea:** `courtroom.boxes.json` is already in world coordinates. Load it and
emit a mesh per box (or merge with instancing) — there is no assembly step, no
pivot math, nothing to position by hand.

## Room

```
width  (X)  190
depth  (Z)  152
height (Y)  104
wall       5 thick
bay pitch  38   (pilasters and engaged columns land exactly on these)
```

Floor at `y = 0`. Inner wall faces at `x = ±90`, back wall inner face at
`z = −71`, entry wall inner face at `z = +71`.

**Scale reference:** a character is **63 units tall**, eye height **~52**.
Every camera preset uses `y = 48–62`, which is what makes the renders read as
first person rather than as a diorama.

## Layout, zone by zone

Reading from the back wall toward the door:

| Zone | Z range | What's there |
|---|---|---|
| **Apse** | −71 → −60 | Velvet reredos, court seal, twin banners, gothic windows, sconces |
| **Dais** | −66 → −42 | Three-tier steps rising to the judge's bench; throne behind; gavel block |
| **Well** | −56 → −10 | Prosecution desk (left), defence desk (right), witness stand (left), jury box (right), evidence screen (left wall), judge's side desk, ballot box, bookshelves |
| **Bar** | ~+16 | Three railing sections separating the well from the gallery |
| **Gallery** | +16 → +70 | 3 rows × 3 benches, side benches, side windows |
| **Entrance** | +70 | Double doors, neon "ON TRIAL" sign above |

**Sightlines that matter:** from the entrance camera the judge's bench is dead
centre, the defence desk (teal) is right, the prosecution desk is left, and the
carpet runner leads the eye straight down the aisle. That composition is
deliberate — keep it if you move anything.

## Camera presets

From `courtroom.layout.json`:

| Preset | Position | Target | FOV | Use |
|---|---|---|---|---|
| `pov_entrance` | `[0, 58, 66]` | `[0, 38, −64]` | 72 | Opening shot, walking in |
| `pov_well` | `[0, 55, 26]` | `[0, 36, −66]` | 68 | Standing in the well |
| `pov_corner` | `[−46, 56, 40]` | `[10, 34, −60]` | 70 | Prosecution side angle |
| `pov_corner_r` | `[46, 56, 40]` | `[−10, 34, −60]` | 70 | Defence side angle |
| `pov_bench` | `[0, 60, −26]` | `[0, 42, −70]` | 62 | Behind the bench, judge's POV |
| `pov_gallery` | `[0, 62, 66]` | `[0, 30, −30]` | 74 | Wide gallery establishing |
| `iso` / `cutaway` | — | — | 30 / 34 | Reference overviews |

All eye-level shots sit in open floor. **Don't put a camera inside the jury box
or between the desks** — there's no clear volume there and you get wall-filled
frames.

## Wiring the box array

```js
const boxes = await fetch('scene/courtroom.boxes.json').then(r => r.json());

// naive: one mesh per box (1606 draw calls — fine for a demo)
for (const b of boxes) {
  const size = [b.t[0]-b.f[0], b.t[1]-b.f[1], b.t[2]-b.f[2]];
  const centre = [b.f[0]+size[0]/2, b.f[1]+size[1]/2, b.f[2]+size[2]/2];
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), matFor(b.m));
  mesh.position.set(...centre);
  scene.add(mesh);
}

// better: merge by material. There are only 16 distinct colours, so this
// collapses 1606 draw calls to 16.
```

**Merge by material.** `m` is the hex colour. Group boxes by `m`, buffer them
into one geometry per colour, and you get 16 draw calls for the whole room.
This is the single biggest performance win available and it's free.

**Materials.** 16 colours, all from the brand palette. Give marble and velvet a
slight roughness variation, and give windows/lights `emissive` — see the
emissive list in `ASSET-GUIDE.md`.

## Collision

You don't need per-box collision. Build a coarse navmesh from these rules:

- **Walkable:** the aisle `|x| < 26` for all `z`, plus the open well
  `|x| < 50, −34 < z < 14`, plus the gallery `|x| < 80, 20 < z < 68`.
- **Blocked:** the dais (`z < −42`), the desks (3 boxes each at their positions),
  the jury box, the gallery benches, and everything within 6 units of a wall.
- **The bar railing at z ≈ +16** is waist-high — block it, or add a gate.

## Extending it

Everything is code, in `cc-art/`:

| File | Role |
|---|---|
| `scene.mjs` | **Room shell + layout table + camera presets.** Add or move props here |
| `props.mjs` / `detail.mjs` | Prop geometry (41 props, 995 boxes) |
| `render3d.mjs` | Perspective renderer used for the previews |
| `palette.mjs` | 16-material brand palette |

```bash
cd cc-art
node exportscene.mjs   # rebuild courtroom.boxes.json + layout
node shot.mjs          # re-render all camera presets
```

## Known limits

1. **Renders are from my own renderer, not an engine.** No bloom, no shadows, no
   PBR. The reference art has dramatic spotlights — that's a lighting rig you
   add in Three.js. Geometry is correct; the mood is yours to finish.
2. **No navmesh baked.** The collision rules above are prose, not data.
3. **Props aren't separated as instances** in `boxes.json` — it's one flat list.
   Use `layout.json` if you want to toggle individual props at runtime (e.g. swap
   the ballot box between locked and open).
4. **The gallery has no audience.** Seats are modelled and empty.
5. **No LODs.** Merged-by-material at 1606 boxes is light enough to skip them.

## Suggested next steps

1. Merge by material → 16 draw calls.
2. Add three spotlights (positions are in `layout.json` as `spotlight_rig`
   instances) with cone geometry and bloom.
3. Swap `sealed_ballot_box` for `ballot_box_open` on the commit→reveal beat.
4. Place Judge Gavel.exe at `[0, 21, −62]` (on the dais, behind the bench) —
   that's the seat the bench was built around.
