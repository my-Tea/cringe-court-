# CringeCourt — Style Guide (canonical)

> **Canonical.** This file and its source image are the visual identity of
> CringeCourt. Where any other document disagrees (notably the old night/neon
> palette in `docs/DESIGN-SYSTEM.md`), this file wins.

![CringeCourt pixel-art style guide](assets/style-guide.png)

Source: `docs/assets/style-guide.png`, "CringeCourt: *Your Honor, Bro Is
Cooked.*" pixel-art style guide (Chayan, 2026-11-03). The printed hex labels in
the image are authoritative; the swatch pixels in the PNG are not sampled.

Code: `apps/web/src/ds/tokens.ts` (palette, roles, contrast pairs) →
`tokens.css` (generated). Live: `/gallery` (switch Parchment / Wood).

---

## 1. Palette (30 swatches)

Each ramp is written dark → light. Token names are `--cc-<family>-<step>`, with
steps 900 / 700 / 500 / 300 / 100 in the order printed in the guide.

| Group (guide) | Token family | 900 | 700 | 500 | 300 | 100 | Role in the identity |
|---|---|---|---|---|---|---|---|
| Royal Palette | `royal` | `#7A1C2E` | `#A32D3F` | `#CE4A44` | `#E07A3F` | `#FFD79A` | Brand maroon: title, banners, primary buttons, red carpet; orange/peach for Side B and danger tints |
| Accents | `teal` | `#2E5F73` | `#3F8FA8` | `#58B7C6` | `#8EDBC8` | `#F0F8E7` | Secondary actions, info, focus ring, Side A; fountain water |
| Golds | `gold` | `#8B5E2A` | `#B77D3A` | `#D9A046` | `#F6C75B` | `#FFF2C7` | Ornate frames, rims, scales, the swear button; `gold-100` is the page parchment |
| Neutrals | `neutral` | `#4A3A32` | `#7B645A` | `#A9917D` | `#DCC8B0` | `#FFF9ED` | Ink, wood, stone; `neutral-100` is the cream card/panel |
| Greens | `green` | `#1F5B3A` | `#3E7F50` | `#6EBF73` | `#A9D98F` | `#DFF3D6` | Success, NOT COOKED; trees and lawns |
| Blues (Env) | `blue` | `#2F4F8F` | `#4D7CC5` | `#7FA9E6` | `#BFD7F5` | `#EAF4FF` | Environment only: sky over the courthouse, distance haze |

## 2. Usage rules

1. **Only these 30 colours.** No other hex, `rgb()` or `hsl()` literal may
   appear in components, pages, the shell or the gallery. Translucency is a
   palette colour with alpha (`alpha()` in `tokens.ts`, or
   `color-mix(in srgb, var(--cc-…) N%, transparent)` in CSS). Enforced by
   `tokens.test.ts`: every role is a palette colour, `tokens.css` contains only
   palette colours, and a source scan rejects raw colours.
2. **Components use semantic roles** (`--cc-color-*`). Palette steps
   (`--cc-gold-500` …) are allowed only where the colour *is* the art: frame
   bands, corner knots, ribbons, the round icon tiles, the hero title.
3. **Parchment is the default surface.** `gold-100` page, `neutral-100`
   cards. Use the **wood** surface (`data-surface="wood"`: `neutral-900` wood,
   `royal-900` velvet panels, gold type) for one deep band per view at most:
   the footer, toasts, a verdict panel, stage overlays.
4. **Maroon leads, gold frames.** Primary actions and big headings are maroon
   (`royal-900`); gold is for rims, rules, ornaments and the swear button.
   **Gold is never body text on cream** (`gold-300` on `gold-100` is 1.42:1):
   when a "gold" label is needed on parchment, use `highlight-shadow`
   (`gold-900`, 5.03:1).
5. **Teal = secondary / info, green = success, blue = environment.** Blue
   never carries meaning in UI chrome; it is sky and distance.
6. **Danger vs. primary:** both are royal. Primary is `royal-900` in a gold rim;
   danger is `royal-700` with a dark rim and is always paired with an icon or
   explicit wording ("Refund everyone", "Slash bond").
7. **Sides:** Side A is teal (`teal-700` / wood `teal-500`), Side B is
   coral-orange (`royal-500` / wood `royal-100`). Solid side badges sit on the
   deeper `secondary` / `danger` roles so their labels reach 4.5:1.

## 3. Semantic roles

| Role | Parchment (default) | Wood |
|---|---|---|
| `canvas` | `#FFF2C7` gold-100 | `#4A3A32` neutral-900 |
| `surface` | `#FFF9ED` neutral-100 | `#7A1C2E` royal-900 |
| `surface-raised` | `#FFF9ED` neutral-100 | `#7A1C2E` royal-900 |
| `surface-sunken` | `#FFF2C7` gold-100 | `#4A3A32` neutral-900 |
| `scrim` | `rgb(74 58 50 / 0.62)` | `rgb(74 58 50 / 0.78)` |
| `text` | `#4A3A32` neutral-900 | `#FFF9ED` neutral-100 |
| `text-muted` | `#7B645A` neutral-700 | `#FFD79A` royal-100 |
| `text-subtle` | `#8B5E2A` gold-900 | `#DCC8B0` neutral-300 |
| `border` | `#DCC8B0` neutral-300 | `#7B645A` neutral-700 |
| `border-strong` | `#8B5E2A` gold-900 | `#A9917D` neutral-500 |
| `frame` | `#D9A046` gold-500 | `#D9A046` gold-500 |
| `frame-light` | `#F6C75B` gold-300 | `#F6C75B` gold-300 |
| `frame-dark` | `#8B5E2A` gold-900 | `#8B5E2A` gold-900 |
| `accent` | `#7A1C2E` royal-900 | `#F6C75B` gold-300 |
| `accent-hover` | `#A32D3F` royal-700 | `#FFD79A` royal-100 |
| `accent-pressed` | `#7A1C2E` royal-900 | `#D9A046` gold-500 |
| `accent-shadow` | `#4A3A32` neutral-900 | `#8B5E2A` gold-900 |
| `accent-text` | `#7A1C2E` royal-900 | `#F6C75B` gold-300 |
| `on-accent` | `#FFF9ED` neutral-100 | `#4A3A32` neutral-900 |
| `secondary` | `#2E5F73` teal-900 | `#8EDBC8` teal-300 |
| `secondary-hover` | `#3F8FA8` teal-700 | `#F0F8E7` teal-100 |
| `secondary-text` | `#2E5F73` teal-900 | `#8EDBC8` teal-300 |
| `highlight` | `#F6C75B` gold-300 | `#F6C75B` gold-300 |
| `on-highlight` | `#7A1C2E` royal-900 | `#7A1C2E` royal-900 |
| `highlight-shadow` | `#8B5E2A` gold-900 | `#8B5E2A` gold-900 |
| `danger` | `#A32D3F` royal-700 | `#A32D3F` royal-700 |
| `danger-hover` | `#7A1C2E` royal-900 | `#7A1C2E` royal-900 |
| `danger-shadow` | `#4A3A32` neutral-900 | `#8B5E2A` gold-900 |
| `danger-text` | `#A32D3F` royal-700 | `#FFD79A` royal-100 |
| `on-danger` | `#FFF9ED` neutral-100 | `#FFF9ED` neutral-100 |
| `danger-surface` | `#FFD79A` royal-100 | `#7A1C2E` royal-900 |
| `success-text` | `#1F5B3A` green-900 | `#A9D98F` green-300 |
| `success-surface` | `#DFF3D6` green-100 | `#1F5B3A` green-900 |
| `warning-text` | `#8B5E2A` gold-900 | `#FFF2C7` gold-100 |
| `warning-surface` | `#FFF9ED` neutral-100 | `#8B5E2A` gold-900 |
| `info-text` | `#2E5F73` teal-900 | `#F0F8E7` teal-100 |
| `info-surface` | `#F0F8E7` teal-100 | `#2E5F73` teal-900 |
| `focus` | `#2E5F73` teal-900 | `#F6C75B` gold-300 |
| `guilty` | `#A32D3F` royal-700 | `#E07A3F` royal-300 |
| `not-cooked` | `#3E7F50` green-700 | `#6EBF73` green-500 |
| `side-a` | `#3F8FA8` teal-700 | `#58B7C6` teal-500 |
| `side-b` | `#CE4A44` royal-500 | `#FFD79A` royal-100 |
| `sky` | `#BFD7F5` blue-300 | `#2F4F8F` blue-900 |
| `sky-light` | `#EAF4FF` blue-100 | `#4D7CC5` blue-700 |
| `disabled-surface` | `#DCC8B0` neutral-300 | `#7B645A` neutral-700 |
| `disabled-text` | `#7B645A` neutral-700 | `#DCC8B0` neutral-300 |

## 4. Approved text / surface pairings (measured)

WCAG 2.1 relative-luminance contrast, computed from the token values by
`apps/web/src/ds/lib/contrast.ts`; every row is a unit test
(`apps/web/src/ds/tokens.test.ts`) on both surfaces. 4.5:1 = body text,
3:1 = large text and UI parts (WCAG 1.4.3 / 1.4.11).

| Use | Text / mark | Surface | Parchment | Wood | Needs |
|---|---|---|---|---|---|
| body text | `text` | `canvas` | `#4A3A32` on `#FFF2C7` **9.67** | `#FFF9ED` on `#4A3A32` **10.31** | 4.5:1 |
| text on panels | `text` | `surface` | `#4A3A32` on `#FFF9ED` **10.31** | `#FFF9ED` on `#7A1C2E` **9.85** | 4.5:1 |
| text on cards | `text` | `surface-raised` | `#4A3A32` on `#FFF9ED` **10.31** | `#FFF9ED` on `#7A1C2E` **9.85** | 4.5:1 |
| text in inputs and wells | `text` | `surface-sunken` | `#4A3A32` on `#FFF2C7` **9.67** | `#FFF9ED` on `#4A3A32` **10.31** | 4.5:1 |
| secondary text | `text-muted` | `canvas` | `#7B645A` on `#FFF2C7` **4.93** | `#FFD79A` on `#4A3A32` **7.95** | 4.5:1 |
| secondary text on panels | `text-muted` | `surface` | `#7B645A` on `#FFF9ED` **5.25** | `#FFD79A` on `#7A1C2E` **7.59** | 4.5:1 |
| secondary text on cards | `text-muted` | `surface-raised` | `#7B645A` on `#FFF9ED` **5.25** | `#FFD79A` on `#7A1C2E` **7.59** | 4.5:1 |
| hints, placeholders | `text-subtle` | `canvas` | `#8B5E2A` on `#FFF2C7` **5.03** | `#DCC8B0` on `#4A3A32` **6.66** | 4.5:1 |
| hints on panels | `text-subtle` | `surface` | `#8B5E2A` on `#FFF9ED` **5.37** | `#DCC8B0` on `#7A1C2E` **6.36** | 4.5:1 |
| placeholders in inputs | `text-subtle` | `surface-sunken` | `#8B5E2A` on `#FFF2C7` **5.03** | `#DCC8B0` on `#4A3A32` **6.66** | 4.5:1 |
| links | `accent-text` | `canvas` | `#7A1C2E` on `#FFF2C7` **9.24** | `#F6C75B` on `#4A3A32` **6.82** | 4.5:1 |
| links on cards | `accent-text` | `surface-raised` | `#7A1C2E` on `#FFF9ED` **9.85** | `#F6C75B` on `#7A1C2E` **6.51** | 4.5:1 |
| primary button label | `on-accent` | `accent` | `#FFF9ED` on `#7A1C2E` **9.85** | `#4A3A32` on `#F6C75B` **6.82** | 4.5:1 |
| primary button hover | `on-accent` | `accent-hover` | `#FFF9ED` on `#A32D3F` **6.67** | `#4A3A32` on `#FFD79A` **7.95** | 4.5:1 |
| primary button pressed | `on-accent` | `accent-pressed` | `#FFF9ED` on `#7A1C2E` **9.85** | `#4A3A32` on `#D9A046` **4.67** | 4.5:1 |
| swear button label | `on-highlight` | `highlight` | `#7A1C2E` on `#F6C75B` **6.51** | `#7A1C2E` on `#F6C75B` **6.51** | 4.5:1 |
| danger button label | `on-danger` | `danger` | `#FFF9ED` on `#A32D3F` **6.67** | `#FFF9ED` on `#A32D3F` **6.67** | 4.5:1 |
| danger button hover | `on-danger` | `danger-hover` | `#FFF9ED` on `#7A1C2E` **9.85** | `#FFF9ED` on `#7A1C2E` **9.85** | 4.5:1 |
| secondary button label | `secondary-text` | `canvas` | `#2E5F73` on `#FFF2C7` **6.26** | `#8EDBC8` on `#4A3A32` **6.75** | 4.5:1 |
| secondary button on cards | `secondary-text` | `surface-raised` | `#2E5F73` on `#FFF9ED` **6.67** | `#8EDBC8` on `#7A1C2E` **6.45** | 4.5:1 |
| error banner | `danger-text` | `danger-surface` | `#A32D3F` on `#FFD79A` **5.14** | `#FFD79A` on `#7A1C2E` **7.59** | 4.5:1 |
| field error | `danger-text` | `canvas` | `#A32D3F` on `#FFF2C7` **6.25** | `#FFD79A` on `#4A3A32` **7.95** | 4.5:1 |
| field error on cards | `danger-text` | `surface-raised` | `#A32D3F` on `#FFF9ED` **6.67** | `#FFD79A` on `#7A1C2E` **7.59** | 4.5:1 |
| success banner | `success-text` | `success-surface` | `#1F5B3A` on `#DFF3D6` **6.85** | `#A9D98F` on `#1F5B3A` **4.97** | 4.5:1 |
| warning banner | `warning-text` | `warning-surface` | `#8B5E2A` on `#FFF9ED` **5.37** | `#FFF2C7` on `#8B5E2A` **5.03** | 4.5:1 |
| info banner | `info-text` | `info-surface` | `#2E5F73` on `#F0F8E7` **6.43** | `#F0F8E7` on `#2E5F73` **6.43** | 4.5:1 |
| focus ring | `focus` | `canvas` | `#2E5F73` on `#FFF2C7` **6.26** | `#F6C75B` on `#4A3A32` **6.82** | 3:1 |
| focus ring on cards | `focus` | `surface-raised` | `#2E5F73` on `#FFF9ED` **6.67** | `#F6C75B` on `#7A1C2E` **6.51** | 3:1 |
| input borders | `border-strong` | `canvas` | `#8B5E2A` on `#FFF2C7` **5.03** | `#A9917D` on `#4A3A32` **3.62** | 3:1 |
| input borders on cards | `border-strong` | `surface-raised` | `#8B5E2A` on `#FFF9ED` **5.37** | `#A9917D` on `#7A1C2E` **3.46** | 3:1 |
| GUILTY marks | `guilty` | `canvas` | `#A32D3F` on `#FFF2C7` **6.25** | `#E07A3F` on `#4A3A32` **3.62** | 3:1 |
| GUILTY marks on cards | `guilty` | `surface-raised` | `#A32D3F` on `#FFF9ED` **6.67** | `#E07A3F` on `#7A1C2E` **3.46** | 3:1 |
| NOT COOKED marks | `not-cooked` | `canvas` | `#3E7F50` on `#FFF2C7` **4.31** | `#6EBF73` on `#4A3A32` **4.82** | 3:1 |
| NOT COOKED marks on cards | `not-cooked` | `surface-raised` | `#3E7F50` on `#FFF9ED` **4.60** | `#6EBF73` on `#7A1C2E` **4.61** | 3:1 |
| Side A marks | `side-a` | `canvas` | `#3F8FA8` on `#FFF2C7` **3.29** | `#58B7C6` on `#4A3A32` **4.64** | 3:1 |
| Side A marks on cards | `side-a` | `surface-raised` | `#3F8FA8` on `#FFF9ED` **3.51** | `#58B7C6` on `#7A1C2E` **4.43** | 3:1 |
| Side B marks | `side-b` | `canvas` | `#CE4A44` on `#FFF2C7` **4.01** | `#FFD79A` on `#4A3A32` **7.95** | 3:1 |
| Side B marks on cards | `side-b` | `surface-raised` | `#CE4A44` on `#FFF9ED` **4.27** | `#FFD79A` on `#7A1C2E` **7.59** | 3:1 |

Component-level pairings that use palette steps directly (checked by hand with the same formula):

| Where | Foreground | Background | Ratio | Needs |
|---|---|---|---|---|
| Round icon button glyph (royal) | `gold-300` `#F6C75B` | `royal-700` `#A32D3F` (lightest point of the face) | 4.41 | 3:1 (UI) |
| Round icon button glyph (royal), face edge | `gold-300` | `royal-900` `#7A1C2E` | 6.51 | 3:1 |
| Round icon button glyph (gold tone) | `royal-900` | `gold-300` | 6.51 | 3:1 |
| Ribbon / speaker plate | `gold-100` `#FFF2C7` | `royal-900` | 9.24 | 4.5:1 |
| TESTNET badge | `royal-900` | `gold-300` (stripes `gold-500` are under a `gold-300` text halo) | 6.51 | 4.5:1 |
| Hero title | `royal-900` | `blue-300` `#BFD7F5` (top of the sky) | 7.01 | 3:1 (large) |
| Hero lede over the sky gradient | `neutral-700` `#7B645A` | `blue-100` `#EAF4FF` (it sits below the 38 % stop) | 4.95 | 4.5:1 |
| Footer type (wood) | `gold-300` / `royal-100` | `neutral-900` | 6.82 / 7.95 | 4.5:1 |

**Pairings to avoid** (fail AA, do not use for text): `gold-300`/`gold-500` on
any cream; `royal-300` (`#E07A3F`) on cream (2.67–2.85); `royal-500` text on
`#DCC8B0`; `teal-500` or lighter on cream; `neutral-700` on `neutral-300`
(3.39); anything on `blue-500`/`blue-700` except `neutral-900`.

What changed to pass AA (pairings, not palette identity): gold labels on cream
→ `highlight-shadow`; the TESTNET badge became maroon on gold; solid Side A/B
badges moved to `secondary` / `danger` backgrounds; Countdown and PhaseStepper
"current" text moved from gold to `gold-900`; wood GUILTY marks use
`royal-300` (3.62) because `royal-500` is 2.41 on wood.

## 5. Art direction

- **Pixel art, isometric.** Scenes are isometric pixel art with crisp edges
  (`image-rendering: pixelated` for sprites; never smooth-scale pixel art).
  Voxel characters from `cc-art` stay the cast.
- **The courthouse.** A cream-stone isometric courthouse with maroon roofs,
  gold trims and finials, columns, lanterns, trees and a fountain; it sits
  under a pale blue sky with peach haze and distant arches.
- **Red carpet.** A maroon (`royal-700`/`royal-900`) carpet with gold edging
  runs up the stairs to the doors: the path into court. Use it as the visual
  metaphor for "file a case".
- **Gold scale banners.** Maroon banners with a gold border and a gold scales
  emblem hang from gold rods. The scales glyph (`<Icon name="scales">`) is the
  brand mark (header, favicon, crest over the hero title).
- **Rounded ornate frames.** Panels are rounded rectangles with a gold band,
  a dark-gold outer line, a hairline inner rule and small ornaments at the
  corners (`OrnateFrame`, `Card tone="ornate" | "parchment"`).
- **Four round icon buttons.** Maroon rounded tiles in a gold rim with a gold
  pixel glyph: **scales, document, gear, star** (`RoundIconButton`,
  `RoundIconLink`, `RoundIconTile`). Hover lightens the glyph; press sinks the
  tile onto its edge.
- **Parchment frame.** The empty cream panel with a gold rule and corner
  flourishes (right column of the guide) is the default container for
  documents, receipts, dialogue and verdicts.
- **Typography.** A heavy, soft old-style serif for the title and headings
  (Fraunces, `SOFT 100`), maroon with a gold-and-ink extrusion for the hero
  title; the italic serif motto "*Your Honor, Bro Is Cooked.*" between gold
  rules with diamonds; small-caps serif signature lines ("PIXEL ART STYLE
  GUIDE ◆ CRINGECOURT —— BOLD. POLISHED. TIMELESS."). Pixelify Sans keeps a
  pixel accent on eyebrows, badges, stamps and counters.
- **Ornaments.** Gold diamonds `◆` (`.cc-diamond`) and fading gold rules mark
  section heads, the motto and the footer signature.
- **Tone.** Bold, polished, timeless; warm daylight rather than neon night.

## 6. Interim scene art

Until dedicated renders exist, `apps/web/scripts/gen-guide-art.py`
(`npm run guide-art -w @cringe-court/web [-- --check]`, needs Pillow) crops two
pieces of the style-guide sheet into `apps/web/src/art/guide/`:

| File | Crop (sheet px) | Used for |
|---|---|---|
| `courthouse.webp` | x 428, y 24, 662×770, edges feathered | home hero |
| `colonnade.webp` | x 1112, y 92, 360×334 | mode-card and mode-page stage backdrop |

These are reference art, not final production assets: they are fixed at the
sheet's resolution (no @2x) and should be replaced by native renders.

## 7. Palette remap for the cc-art renders (PR #20)

Recoloured and regenerated in this change (cheap and verified by eye):
`cc-art/ui-kit.mjs` (60 files in `dist/ui/`), `cc-art/brand-kit.mjs` (wordmark ×3,
share card, case card in `dist/brand/`), `cc-art/fx-kit.mjs`
(cream `#FFF6E4` → `#FFF9ED`, 5 FX PNGs).

**Not regenerated:** the voxel/pixel character, scene, prop and player
generators (`artkit.mjs`, `vox-chars.mjs`, `vox-base.mjs`, `player-vox.mjs`,
`chibi-base.mjs`, `sprite-player.mjs`, `sprite-parts.mjs`, `defendant-vox.mjs`,
`chars-v4-core.mjs`, `judge-v2.mjs`, their `dist/source/` mirrors and the JSON
manifests they emit). They drive ~1,400 committed renders whose byte-for-byte
reproducibility is a PR #20 guarantee; changing their colours is an art pass,
not a token swap. The old values they still contain, and the palette colour
each should become when that pass happens:

| Old (used in character/scene art) | Meaning there | Remap to |
|---|---|---|
| `#140E1A` | night backdrop / panel | `#4A3A32` (wood) or `#7A1C2E` |
| `#2A1636` | portrait backdrop | `#7A1C2E` |
| `#3A2A24` | ink / outline | `#4A3A32` |
| `#3FB8C9` | Side A team colour | `#3F8FA8` (shade `#2E5F73`, light `#8EDBC8`) |
| `#F08A3C` | Side B team colour | `#E07A3F` (shade `#CE4A44`, light `#FFD79A`) |
| `#6B4CA8` | purple hair / cloth | `#2E5F73` (or keep as character colour, see below) |
| `#6E1B2A` | burgundy robe / frames | `#7A1C2E` |
| `#C0392B` | red shirt (juror D) / GUILTY | `#A32D3F` |
| `#FF4FB8` | neon pink accents | `#A32D3F` (glows → `#F6C75B`) |
| `#FFF6E4`, `#FFF8EC` | cream / paper | `#FFF9ED` |

Character skin, hair and clothing colours are character design rather than UI
palette; the art pass should decide per character which of these to remap. The
web app does not depend on those colours (tokens carry the identity), and the
pose cutouts are shown in front of the parchment and colonnade backdrops.

## 8. What this supersedes in `docs/DESIGN-SYSTEM.md`

- §1 *Grounding*: the "neon-noir voxel everywhere" direction and the source
  table of brand-kit / ui-kit / vox-chars colours. **Void.**
- §2 *Tokens*: the Palette row (`night`, `neon`, `purple`, `cream`, `ink`,
  `burgundy`, `red`, `orange` …), the Surfaces row (`night` default +
  `parchment`), the Radius note ("small radii keep the pixel edge") and the
  Elevation row (light-not-shadow, neon glows). Replaced by §1–§3 here.
- §3 *Components*: the Card "neon" tone (now `ornate`), the Toast/Tooltip
  night styling, the Icon count (now 25 glyphs) and the absence of
  `RoundIconButton` / `OrnateFrame`.
- §4 *Accessibility*: the focus-ring colours ("gold on night, plum on
  parchment"): now teal on parchment, gold on wood.
