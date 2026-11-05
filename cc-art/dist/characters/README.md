# assets/characters/

All character sprites are **transparent PNGs** on a shared canvas so layers
composite without drift.

```
canvas  512 x 512 @2x   (256 x 256 logical)
anchors head[128,66] · eye y=69 · neck[128,116] · hip[128,186] · foot y=235
```
Anchor coords are in **logical (256) space** — multiply by 2 for the 512 canvas.

| Folder | Contents | Status |
|---|---|---|
| `player/` | Layered customization library + working compositor | ✅ **Prototype shipped** |
| `judge/` | Judge Gavel.exe — 10 poses, 8 expressions, gavel prop | ⬜ Not generated |
| `prosecutor/` | Miss Ratio | ⬜ Not generated |
| `defense/` | Counsel Chaos | ⬜ Not generated |
| `bailiff/` | Bailiff | ⬜ Not generated |
| `clerk/` | Clerk | ⬜ Not generated |
| `ai-narrator/` | 0G floating robot (non-humanoid) | ⬜ Not generated |
| `juror/` | Generic jury NPC + 6–8 colour variants | ⬜ Not generated |

The `player/` set is **placeholder art** that proves the layer stack, anchors and
compositor. It is not final art — see `CHARACTER-SPEC.md` for the art direction
and replace layer by layer.

Read `../CHARACTER-SPEC.md` for the asset spec and `../ANIMATION-GUIDE.md` for
how they animate.
