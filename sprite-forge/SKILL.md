---
name: sprite-forge
description: Generates production-ready pixel-art game sprites, tileable block textures, item icons and multi-frame animations as real PNG files with engine-ready atlas JSON, then verifies them mechanically (palette budget, no anti-aliasing, no tiling seams). Use when the user wants pixel art, sprites, sprite sheets, tilesets, block textures, item icons, or game art — especially for voxel/Minecraft-style, first-person, or survival/crafting games; and when a style must stay consistent across many assets.
---

# Sprite Forge

Pixel art fails for one specific reason: the output is a *picture of* pixel art —
soft, anti-aliased, on an arbitrary grid — instead of actual pixel art. Everything
here exists to make the failure impossible. Every asset is drawn as integer pixels
on a fixed grid, with a hand-built colour ramp, then checked by code before delivery.

## Hard rules

1. **Integer grid only.** Asset dimensions are fixed (16×16 is the voxel-block
   standard). Never resize by non-integer factors.
2. **No anti-aliasing, ever.** Every pixel is alpha 0 or 255. `check.mjs` fails the
   build on any partial alpha — treat that failure as a real bug, not a warning.
3. **Hue-shifted ramps, not brightness ramps.** Use `ramp(hue, sat, {...})` from
   `scripts/core.mjs`. Shadows shift cool (blue/violet), highlights shift warm
   (yellow/orange). A ramp that only changes lightness reads as muddy; this one
   reads as depth. This is the single biggest quality difference.
4. **Palette budget.** Blocks ≤ 8 colours, items ≤ 10. Enforced by `check.mjs`.
   A tight palette forces good design decisions.
5. **Legibility at 1×.** If the silhouette is not identifiable at native size, the
   asset has failed regardless of detail at 8×. Judge at 1×, deliver at 1× plus an
   integer-upscaled copy for review.
6. **Tileables must wrap.** Use `tileNoise()` which wraps its lattice, so the tile
   boundary is statistically identical to any interior neighbour. Verified by
   `seamScore()`.

## Assets this skill produces

| Kind | Size | Notes |
|---|---|---|
| Block textures | 16×16 | top / side / bottom variants per block |
| Item icons | 16×16 | held tools, weapons, pickups |
| Break/crack animation | 16×16 × 10 frames | drawn over the targeted block |
| Atlases | grid-packed | uniform cells + JSON frame rects |

## Workflow

1. **Fix the style contract first** — grid size, palette ramp per material, outline
   colour. Write it down before drawing; drifting ramps across 40 assets is what
   makes generated art look assembled from different games.
2. **Block textures** → `scripts/tiles.mjs`. Add a generator to the `TILES` map.
   Use `tileNoise` + `bucketize` with an ordered dither, plus one structure pass
   (blades for grass, cracks for stone, staggered grooves for planks). Noise alone
   gives TV static; structure alone gives wallpaper. Both = a material.
3. **Items** → `scripts/items.mjs`. Prefer an explicit pixel map for anything with
   a distinct silhouette (sword, axe, food) — a map is reviewable line by line.
   Prefer geometry (`pickaxeHead`) for symmetric curved forms, where a map is
   error-prone and an arc is exact.
4. **Animations** → `scripts/break.mjs`. Each frame must be a *superset* of the
   previous one so damage reads as progressive, never flickering.
5. **Pack** → `scripts/sheet.mjs` for a uniform-cell sheet + JSON. Bottom-align
   frames on a shared baseline so characters stand on the ground plane.
6. **Verify** → `node build.mjs` runs the build, then `scripts/check.mjs`
   (palette, alpha, silhouette connectivity, seams) and writes `out/report.json`.
   Fix every reported problem before showing the user anything.
7. **Review at two zoom levels** — `out/preview/tiles-contact.png` (tiled 2×2 so
   seams are visible) and the `@4x`/`@8x` copies. Never judge from the 1× file
   alone; never ship the upscaled file as the asset.

## Commands

```bash
npm install                 # once: pngjs only, no native deps
node build.mjs              # full asset set → ./out
node build.mjs ./art        # custom output dir
node scripts/check.mjs      # verification only
```

## Extending for a specific game

- **New material**: add a `ramp()` for it, then a generator in `TILES`. Copy the
  structure of the closest existing generator (`planks` for man-made, `stone` for
  natural, `crystal` for the emissive hero block).
- **New item**: add a 16-row pixel map + legend entries. Keep the outline colour
  shared across all items so the set reads as one game.
- **Style direction**: adjust `dark`/`light`/`shift` in the ramp, not the drawing
  code. Lower `shift` = flatter and more retro; higher = richer and more modern.

## Environment notes

- Pure Node + `pngjs`. No ImageMagick, no Python, no GUI required — it runs
  headless on any machine.
- For *interactive* authoring or voxel model work, hand off to Aseprite
  (`nix run nixpkgs#aseprite`, or the official binary) or Blockbench
  (`nix run nixpkgs#blockbench`). Blockbench is the better fit for a Minecraft-like
  game because it exports directly to Minecraft JSON models and `.glb`.
- Aseprite reads the packed sheets (`File > Import Sprite Sheet`) if a human needs
  to touch up frames.
