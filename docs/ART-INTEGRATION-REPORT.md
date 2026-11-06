# Art integration report (v3 / P2)

Branch `v3/p2-art-integration`, cut from `main` (`e090550`). PRs #1–#17 merged as real merge
commits (PR history preserved) in the brief's order. Every source conflict was resolved by hand;
generated outputs were never hand-merged: they were regenerated from the merged sources.

**Bottom line:** `cd cc-art && node build-all.mjs --check` regenerates every generated asset in
the repo and exits 0 (no diff). Two consecutive runs were clean. A from-scratch rebuild (all
generated outputs deleted first, then rebuilt, including the 11 courtroom scene renders)
reproduced every tracked generated file byte for byte. The only files it did not bring back are
the legacy ones listed in §4.

## 1. Merge order and per-PR resolution

| # | PR | Conflicts | Resolution | Regenerated |
|---|---|---|---|---|
| 1 | #17 village-set decision | none | — | — |
| 2 | #6 judge gavel prop | none | — | Verified: `add-gavel.py` is idempotent on the committed model; `preview.mjs` reproduces `preview-rest.png` |
| 3 | #13 judge GLB | none | — | Verified: `bbmodel2glb.py` reproduces `GavelExe.glb` byte for byte; `glbcheck.py check` → OK |
| 4 | #3 UI trial moments | none | — | — |
| 5 | #4 brand kit | `ui-kit.mjs` (+ mirror) | Kept #4's `pixel-font.mjs` split. Moved #3's 18 new glyphs (0–9 `# / + ( ) , % =`) into `pixel-font.mjs` `GLYPHS`. Kept #3's `textW`/`fitSize`/`textAt` helpers in `ui-kit.mjs` | `ui-kit.mjs`, `brand-kit.mjs`: byte-identical |
| 6 | #9 ballot props | none | — | `export.mjs`: 47 props / 1036 boxes, `out/props` = `dist/sprites/props` |
| 7 | #1 voxel poses | `ASSET-COMPLETE.md` | Kept #1's voxel regenerate commands plus brand-kit | `export-vox`, `export-player-vox`: no diff |
| 8 | #2 voxel expressions | `vox-chars.mjs` (2 hunks) + 188 PNGs | Took #2's `head({… expr})` calls and the moved defense bandage; kept #1's `tag('head', out)`. `char-render.mjs` auto-merged (#1 affine `M` + #2 depth buffer); reviewed | 188 PNGs regenerated (not merged). 10/10 poses and 8/8 expressions distinct for all 8 characters |
| 9 | #5 juror variants | `vox-chars.mjs` (3 hunks), `export-vox.mjs` imports + 41 PNGs | Kept #5's `juror(variant)` builder. Added #2's `expr` pass-through and open `rims()` glasses. Added #1's `tag('head')`, `tag('armL')` on the popcorn (only when the variant has it) and `posed()` | `export-vox` + `export-player-vox`. Variant sheet reviewed |
| 10 | #7 Versus sides | `lineup.png` only | **Semantic gap from #7's own notes:** `side()` now passes `expr`, tags hair and mask as `head`, and returns `posed()` | Side A/B: 10/10 poses (were 1/10 on the PR branch), 8/8 expressions |
| 11 | #10 first-person hands | `char-render.mjs`, `vox-chars.mjs` | Renderer: kept #1's `bounds` + `boundsOf` and #10's `fixedScale`/`center`/transparent options (all default-off). Gavel: kept #10's shared `gavelBoxes()`, tagged `armR`. Dropped the pre-rig `lift`. #1 had already fixed the mirrored end cap, so #10's `mirrorCapAboutGx` compatibility flag (which existed only to keep the bug byte-identical) was removed | Hands regenerated (changed by #2's depth buffer; skin sheet reviewed). Judge PNGs unchanged |
| 12 | #11 gallery NPCs + seated | `vox-chars.mjs` (juror limbs) | Kept #5's variant colours and skin-tone hands. Added `seat: pose === 'seated'`, so every juror variant can sit | `export-vox` (182), `export-gallery` (48; front 3/4 views now use the face rig), `animations.json` |
| 13 | #12 idle variants | `vox-base`, `vox-chars`, `export-vox`, `animations.mjs`, docs, generated JSON | `posed()` looks up `POSES`, then `EXTRA_POSES`, then the per-character `over` (idle_a/b/c). Kept #12's `across` axis and #11's leg hinges. `export-vox` exports both seated and idle variants. **Fixes:** #12's validator rejected #11's `seated` pose, so `EXTRA_POSES` ids are now accepted (PNG existence is still checked). #12 predates #7, so Side A/B had no idle table and no animations; I added idle variants, signatures and weights for both | 212 sprites. Idle variants 4/4 distinct from idle for all 10 characters. `animations.json`: 11 characters, 106 animations, validation passes |
| 14 | #14 character props | `vox-chars.mjs` (5 hunks), `GAP-ANALYSIS.md` | Held items come from #14's `held-props.mjs`, tagged to the hand groups. **One gavel:** #10 and #14 each added a `gavelBoxes()`. Unified in `held-props.mjs` as `gavelBoxes(gx, gy, gz = 0)` with both caps about `gx`. At `gx = 0` this equals #14's prop boxes in the same order; at the Judge's `gx` it equals #1's fix. `fp-hands.mjs` imports it from there | Every output byte-identical: 53 props / 1138 boxes, characters, hands |
| 15 | #15 props `.bbmodel` | `ASSET-COMPLETE.md` | Kept #15's counts and the #11/#12 rows | `export-bbmodel.mjs`: byte-identical. `validate-bbmodel.mjs`: OK, 53 groups / 1138 elements / 27 textures. Props sheet reproduces with `propSheet(out, 4, 8)` |
| 16 | #8 portraits | `ASSET-COMPLETE.md` | Added `export-portraits.mjs` to the commands | 10 characters × 4 expressions × 3 sizes. Expression contrast now comes from #2's rig (the weakness #8 flagged); Side A/B included |
| 17 | #16 anonymous defendant | `ASSET-COMPLETE.md` | **Break fixed:** `export-defendant.mjs` regex-scraped `GLYPHS` out of `ui-kit.mjs` source. After #4 that crashed (`TypeError`). It now imports `{ GLYPHS }` from `pixel-font.mjs` | Defendant sets regenerated (changed by #2's renderer); contact sheet reviewed |

**#18 (game modes and economics docs): not merged here, on purpose.** It merges cleanly into this
branch on its own. However, P1's PR #19 imported #18's files as a copy and then extended them
(D1–D14, calculator A26/A27). Merging #18 here as well gives six add/add conflicts between #19 and
this PR (`docs/ECONOMICS.md`, `docs/GAME-MODES.md`, `cringe_econ.py`, three CSVs; checked with
`git merge-tree`). #19 already carries a superset of #18, so #18's content reaches `main` through
#19. `build-all.mjs` runs the economics calculator whenever it is present.

## 2. Integration work beyond the merges

- **`cc-art/build-all.mjs`**: a single driver for every generator, in dependency order: blocks;
  props, the `dist` copy and the contact sheet; `.bbmodel` and its validator; scene renders and
  layout; voxel characters, gallery, player, hands, portraits and defendant; the animation library;
  UI, FX and brand; the `dist/source` mirror; the Judge gavel, GLB, GLB check and previews;
  economics. Use `--check` to fail on any diff, `--skip-scene` to skip the 11 slow renders, and
  `--only a,b` to run named steps. Before this, several outputs had no committed command at all.
- **`judge/tools/glbcheck.py preview`**: `preview-glb.png` had been assembled by hand in #13. I
  recovered its frames by pixel-matching each panel (rest, then `gavel_strike` at 0 / 0.18 / 0.25 s,
  yaw 80, pitch 4) and added a subcommand that renders it. The output is byte-identical to the
  committed file. `render` behaves as before.
- **Stale outputs caught by `--check`**: `dist/brand/*` wordmarks and share card, and
  `judge/dist/preview-rest.png`, render through `char-render.mjs`. #1, #2 and #10 changed that
  renderer after these files were committed, so they were regenerated (and reviewed).
- **Docs**: the regenerate instructions now point at `build-all.mjs`, and the current-state counts
  are updated in INDEX, ASSET-COMPLETE, ANIMATION-GUIDE and CHARACTER-SPEC (10 characters, 212
  sprites, 106 animations, 53 props). Historical sections are left as they were.

## 3. Checks run

| Check | Result |
|---|---|
| `node build-all.mjs --check --skip-scene`, twice in a row | exit 0 both times, "every regenerated output matches" |
| `shot.mjs` + `exportscene.mjs` (11 renders, 1606 boxes, 55 props placed) | byte-identical to `main` |
| From-scratch rebuild: 1382 tracked generated files deleted (incl. the 7 economics CSVs, run while #18 was still on the branch), then `build-all.mjs` (incl. scene) | 1373 files reproduced byte for byte, 0 modified. The first attempt found a real bug: `writeAnimationLibrary` did not create `dist/animation/` (fixed in `fix(cc-art)` commit). The 9 files not reproduced are the hand-written `characters/README.md` and the 8 legacy files below |
| Distinctness (sha1): poses / expressions / idle variants | 10/10 · 8/8 · 4/4 (with idle) for all 10 characters |
| `validateAnimationLibrary` (runs on write) | passes: 11 characters, 106 animations, every referenced pose PNG exists |
| `validate-bbmodel.mjs` | OK: 53 groups, 1138 elements, 27 textures |
| `glbcheck.py check GavelExe.glb` | OK (74 cubes, 5 animations) |
| `add-gavel.py` on the committed model | idempotent (no change) |
| `cringe_econ.py` | not on this branch (see #18 note); `build-all.mjs` skips it until #19 is merged, then runs it |
| `git merge-tree origin/v3/p1-decisions HEAD` | no conflicts (P1 and P2 combine cleanly) |
| `dist/source` mirror | every mirrored file equals its `cc-art/` source |
| Visual review (contact sheets) | Judge poses, defense expressions, juror variants, Side A/B, idle variants, gallery, hands, portraits, defendant, share card, Judge rest |

Environment: Node v20.19.2, Python 3.13.5, pngjs 7.0.0 (installed outside the repo, not vendored).

## 4. Not verified / known gaps

- **No engine or Blockbench**: nothing has been loaded in a game engine or opened in the
  Blockbench GUI. That covers the props `.bbmodel`, the Judge GLB's euler and sign convention,
  hold anchors, the idle-variant state machine and the stamp sequence. Same limits as the
  source PRs.
- **My Side A/B additions are taste calls**, reviewed on sheets only: idle variants, objection
  callouts "SIDE A OBJECTS!" / "SIDE B OBJECTS!", and weights. Arms are rigid (no elbow), so
  "hands on hips" is approximate.
- **Domino mask**: on Side A/B it covers the lower brows, so brow-only expressions read weaker
  on them.
- **Carried over from the PRs, not fixed here**:
  - Gallery back views of short-haired and bald NPCs can read as faces.
  - The Judge's held gavel floats about 6 units from the hand.
  - Stamp text is illegible at 32 px.
  - `characters/README.md` is still the stale chibi text.
  - `GAP-ANALYSIS.md` historical counts.
- **Legacy files no generator produces**: they were on `main` before any PR, come from retired 2D
  or earlier pipelines, and no PR touches them. They are left in place and listed here:
  - `cc-art/dist/scene/pov_defence.png`, `pov_jury.png`, `pov_witness.png` and their `cc-art/out/scene/`
    copies: renders of shots that are no longer in `scene.mjs` `SHOTS`.
  - `cc-art/dist/characters/_previews/lineup_tmp.png`: written only by the retired `export-all.mjs`.
  - `cc-art/dist/characters/player/hairColor/F08CBE.png`: the old 2D player palette had a pink hair colour;
    the voxel `export-player-vox.mjs` does not.
  - The top-level `cc-art/out/*.png` sheets (`v3_*`, `v4_*`, `judge2d*`, `_face_test` and others) come from
    earlier pipelines and were not part of this test. No PR touches them.

  Removing these files is a separate cleanup decision; nothing in the repo references them.
- **Scene renders**: on this shared machine they took 43 min wall-clock (77 s CPU), so
  `--check` runs used `--skip-scene`. The scene was verified separately, plus once in the
  from-scratch rebuild.
