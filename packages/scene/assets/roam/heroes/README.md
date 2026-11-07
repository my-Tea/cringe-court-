# Roam hero cast (Blockbench → GLB)

Stylized low-poly courtroom agents for the first-person roam stage. Each folder
is one drop-in character: editable Blockbench source, a glTF binary for Three.js,
and a `manifest.json` that maps animation clips.

**Look authority:** [`cc-art/dist/CHARACTER-DESIGN-BIBLE.md`](../../../../../cc-art/dist/CHARACTER-DESIGN-BIBLE.md)  
**Runtime loaders:** `packages/scene/src/roam/three/glbHero.ts`, `heroAvatar.ts`  
**Preview shots (committed):** [`.bbshots/heroes/`](../../../../../.bbshots/heroes/)

Authoring is **offline Blockbench only** (desktop MCP). The roam renderer stays
Three.js — these GLBs replace the procedural mesh when clips load cleanly.

---

## Cast at a glance

| Dir | In-game name | Role | Revision | Signature clips |
|---|---|---|---|---|
| `prosecutor/` | **Miss Ratio** | Side A / prosecution | `v7-polished` | idle, talk, point, **objection** |
| `defense/` | **Counsel Chaos** | Side B / defence | `v1-dense` | idle, talk, point, objection |
| `judge/` | **Judge Gavel.exe** | Bench | `v1-dense` | idle, talk, point, objection, **gavel** |
| `clerk/` | **Clerk Ctrl+S** | Record | `v1-dense` | idle, talk, point, objection |
| `bailiff/` | **Officer Bonk** | Security | `v1-dense` | idle, talk, point, objection |
| `defendant/` | **You** | Player stand-in | `v1-dense` | idle, talk, point, objection |
| `creator/` | Wardrobe base | Player customise seed | — | (mesh only / shared pipeline) |
| `juror/` … `juror-f/` | Jury box | Seated jurors | `v1-dense` | idle, talk, point, objection |

Miss Ratio is the most polished hero (Phase 3+ craft). The rest of the cast
follows the same silhouette language so the courtroom reads as one show.

---

## Overall look (preview shots)

Paths below are relative to this README. Open the PNGs in
[`.bbshots/heroes/`](../../../../../.bbshots/heroes/) for full resolution.

### Lead counsel — Miss Ratio

| Front | Three-quarter | Isometric |
|---|---|---|
| ![Miss Ratio front](../../../../../.bbshots/heroes/miss-ratio-front.png) | ![Miss Ratio ¾](../../../../../.bbshots/heroes/miss-ratio-threequarter.png) | ![Miss Ratio iso](../../../../../.bbshots/heroes/miss-ratio-iso.png) |

**Anim peaks** (what the mixer should sell in roam):

| Idle | Talk | Point | Objection |
|---|---|---|---|
| ![idle](../../../../../.bbshots/heroes/miss-ratio-anim-idle.png) | ![talk](../../../../../.bbshots/heroes/miss-ratio-anim-talk.png) | ![point](../../../../../.bbshots/heroes/miss-ratio-anim-point.png) | ![objection](../../../../../.bbshots/heroes/miss-ratio-anim-objection.png) |

Also: `miss-ratio-side.png` for orthographic limb checks.

### Bench & counsel

| Judge | Defense (Counsel Chaos) | Clerk |
|---|---|---|
| ![Judge front](../../../../../.bbshots/heroes/judge/front.png) | ![Defense front](../../../../../.bbshots/heroes/defense/front.png) | ![Clerk front](../../../../../.bbshots/heroes/clerk/front.png) |
| ![Judge ¾](../../../../../.bbshots/heroes/judge/threequarter.png) | ![Defense ¾](../../../../../.bbshots/heroes/defense/threequarter.png) | ![Clerk ¾](../../../../../.bbshots/heroes/clerk/threequarter.png) |
| ![Judge iso](../../../../../.bbshots/heroes/judge/iso.png) | ![Defense iso](../../../../../.bbshots/heroes/defense/iso.png) | ![Clerk iso](../../../../../.bbshots/heroes/clerk/iso.png) |

Loose top-level aliases (same frames, older capture names):
`judge-front.png`, `defense-front.png`, `clerk-front.png`, …
`prosecutor-front.png` / `prosecutor-threequarter.png`.

### Supporting cast

| Bailiff | Defendant | Juror A | Juror B | Juror C |
|---|---|---|---|---|
| ![Bailiff](../../../../../.bbshots/heroes/bailiff/front.png) | ![Defendant](../../../../../.bbshots/heroes/defendant/front.png) | ![Juror A](../../../../../.bbshots/heroes/juror-a/front.png) | ![Juror B](../../../../../.bbshots/heroes/juror-b/front.png) | ![Juror C](../../../../../.bbshots/heroes/juror-c/front.png) |

Each of those folders also has `iso.png` and `threequarter.png`.

---

## Per-character files

```
heroes/{id}/
  hero.glb          # Runtime mesh + AnimationClips (glTF binary)
  hero.bbmodel      # Blockbench project (edit / re-export)
  manifest.json     # Clip map, palette notes, rebuild command
  README.md         # Optional one-liner (placeholders ok)
```

### `manifest.json` contract

| Field | Meaning |
|---|---|
| `id` / `name` | Folder id and display name |
| `revision` | Craft pass label (`v7-polished`, `v1-dense`, …) |
| `source` | Always `Blockbench MCP free-format` for this cast |
| `files.glb` / `files.bbmodel` | Filenames in the same folder |
| `clips[]` | `id`, `exportName` (GLB animation name), `loop`, `seconds` |
| `rebuild` / `validate` | Exact CLI to regenerate / smoke-check |
| `palette` | Optional locked hexes (Miss Ratio has the full set) |
| `notes` | Human craft notes for reviewers |

Clip `exportName` values must match the GLB JSON chunk
(`animation.prosecutor_objection`, `animation.judge_gavel`, …). The headless
validator parses those tracks before we trust a drop-in.

---

## Conventions (do not break)

1. **Feet at origin, Y-up.** World facing: character looks down **−Z** after load
   (see `glbHero.ts`), same as procedural heroes.
2. **Scale** is normalised in-loader against `HERO_MESH_HEIGHT` / `CAST_SCALE` so
   counsel and the judge sit in the same room as voxel props.
3. **Generic Model (`free`)** Blockbench format with bone rig + animation mode —
   not pure cube-only Sketchfab dumps.
4. **No room geometry** in these files. Heroes only; the courtroom mesh stays
   elsewhere.
5. **Provenance** lives in each manifest’s `source` field + this README. The PNGs
   under `.bbshots/heroes/` are **our** Blockbench preview captures for review,
   not third-party stock.

---

## How the game uses them

1. Roam asks for an avatar model id (`prosecutor`, `judge`, `defendant`, …).
2. `loadGlbHero(model)` tries `assets/roam/heroes/{model}/hero.glb`.
3. If the GLB has usable clips → that hero is used.
4. Otherwise → procedural `HeroAvatar` mesh with the same palette language.

Wiring lives in `packages/scene/src/roam/three/avatar.ts` (prefer GLB when present).

---

## Rebuild / validate

Needs Blockbench desktop MCP listening (default `http://localhost:3000/bb-mcp`).

```bash
# Full cast pipeline
npx tsx tools/bbmcp/build-heroes.ts

# Miss Ratio only (highest craft)
npx tsx tools/bbmcp/build-miss-ratio.ts

# Dense cast (judge / defense / clerk / …)
npx tsx tools/bbmcp/build-cast.ts

# Smoke-check clips in a GLB
node tools/bbmcp/validate-hero-glb.mjs packages/scene/assets/roam/heroes/prosecutor/hero.glb
```

Shared helpers: `tools/bbmcp/hero-kit.ts`.

After a rebuild, drop fresh previews into `.bbshots/heroes/{id}/` (and update the
Miss Ratio anim peaks if counsel motion changed).

---

## Design notes (short)

| Hero | Read | Palette cue |
|---|---|---|
| Miss Ratio | Sharp, smug, aggressive | Burgundy `#6B1C2E` · charcoal · cream · gold trim |
| Counsel Chaos | Rounder, chaotic, clever | Forest `#1F4D3A` · night · warm cream |
| Judge Gavel.exe | Heavy, authoritative | Navy · slate · ivory fur · silver hair |
| Clerk Ctrl+S | Quiet, precise | Dusty blue · steel · paper |

Dialogue plates and roam callouts reuse these hexes so HUD and mesh agree.

More detail, hybrid cast rules, and “what not to rebuild” live in the design
bible. Process / approval notes for Miss Ratio’s craft passes:
[`docs/art/MISS-RATIO-CHECKPOINT.md`](../../../../../docs/art/MISS-RATIO-CHECKPOINT.md).

---

## Shot index (complete)

| Path under `.bbshots/heroes/` | What it is |
|---|---|
| `miss-ratio-{front,side,threequarter,iso}.png` | Prosecutor turnaround |
| `miss-ratio-anim-{idle,talk,point,objection}.png` | Prosecutor clip peaks |
| `prosecutor-{front,threequarter}.png` | Alias captures |
| `{judge,defense,clerk,bailiff,defendant}/{front,iso,threequarter}.png` | Per-hero turnaround |
| `{judge,defense,clerk}-{front,threequarter}.png` | Loose alias captures |
| `juror-{a,b,c}/{front,iso,threequarter}.png` | Jury sample faces |

If a reviewer asks “where did this look come from?”: **Blockbench MCP free-format
builds in-repo**, guided by the character design bible — not external concept
PNGs (those isometric refs were never checked in; see the checkpoint doc).
