# CringeCourt — Art Bible & Asset Manifest

**Read this first:** your screenshots are **not 2D pixel art**. The courtroom shot is
**high-density voxel 3D** — smooth volumetric shading, PBR materials, volumetric
spotlights, bloom, depth of field, no black outlines. The village/journey shots are
top-down 2D pixel art in a Minecraft-ish register, and the character portraits are
2D pixel busts (~32–64px).

That means CringeCourt is a **stylised 3D voxel game with 2D UI art**, not a 2D
game. Two separate pipelines, and mixing them up is the main way this goes wrong.

## The one style decision that matters most

Your screenshots show two incompatible looks:

| | Courtroom (the money shot) | Village |
|---|---|---|
| Render | Voxel 3D, smooth PBR, bloom, DOF | Flat 2D pixel, hard edges |
| Palette | Neon magenta/purple on near-black | Earthy greens, browns, creams |
| Vibe | Synthwave anime courtroom | Cozy stardew village |

**Your md says the visual direction is "anime visual-novel styling, neon purple and
pink accents" — so the courtroom is the brand, the village is the exception.**
Recommendation: make neon-noir voxel the global identity and re-tint the village
toward dusk/purple lighting so they read as one world. Otherwise the game looks
like two demos stapled together.

---

# Part 1 — Installation report

## What I installed myself ✅

| Thing | Status | Where |
|---|---|---|
| `sprite-forge` (mine) | ✅ Installed, build-verified | `~/.agents/skills/sprite-forge/` |
| `pixel-art-sprites` | ✅ Installed | `~/.agents/skills/pixel-art-sprites/` |
| `threejs-3d-generator` | ✅ Installed (needs API key) | `~/.agents/skills/threejs-3d-generator/` |
| `threejs-image-generator` | ✅ Installed | `~/.agents/skills/threejs-image-generator/` |
| `threejs-game-ui-designer` | ✅ Installed | `~/.agents/skills/threejs-game-ui-designer/` |
| `threejs-aaa-graphics-builder` | ✅ Installed | `~/.agents/skills/threejs-aaa-graphics-builder/` |
| **Blockbench 5.1.6** | ✅ Installed as a system app | `blockbench` on PATH |
| Three.js r187 | ✅ Verified working headless | used by sprite pipeline |

## What I could NOT install — and exactly why ❌

**1. Blockbench's MCP server.** I installed the *app*, but I cannot finish the MCP
wiring, for two hard blockers:

- **I cannot open the GUI.** This session has no display authorization
  (`DISPLAY` unset; `X0` socket exists but `Authorization required, but no
  authorization protocol specified`). Installing a Blockbench plugin requires
  clicking `File → Plugins → Load Plugin from URL`. There is no CLI for it.
- **This app has no custom-MCP registration path.** I read AutoClaw's own
  `main.cjs` and renderer bundles. MCP appears only inside the bundled vendor SDK
  (Google GenAI `.mcp_tool_use` events, an MCP client class). There is **no user
  settings file, no `mcpServers` config, and no "add MCP server" UI** — only a
  curated `connectorCenter` of first-party connectors (Feishu, 北大法宝, 华宇元典,
  法研…). So there is nowhere for me to register Blockbench even if it were running.

**→ You must do this part.** Two steps, ~3 minutes. Full click-by-click guide is in
`BLOCKBENCH-MCP-SETUP.md`. In short: open Blockbench yourself →
`File → Plugins → Load Plugin from URL` → paste
`https://jasonjgardner.github.io/blockbench-mcp-plugin/mcp.js`. Then tell me, and I
can drive it over `http://localhost:3000/bb-mcp` for the rest of the project —
*if* your AutoClaw build can reach local HTTP MCP through its connector layer.
That last part is unverified and I won't claim otherwise.

**2. `threejs-3d-generator` is installed but dormant.** It needs `TRIPO_API_KEY`
(not set) and `python3` (not on PATH — nixpkgs has 3.14.8 but it isn't in your
profile). It's the only path to *AI-generated 3D models*. If you want it, tell me
and I'll set up Python + walk you through getting a Tripo key.

**3. Aseprite.** In nixpkgs but licence-blocked (`allowUnfree`). You don't need it —
sprite-forge does the same job headless. Say the word if you want it anyway.

---

# Part 2 — Characters to build

Count: **5 hero/story characters + 1 player avatar + background NPC cast.**

## Hero cast (full voxel model + portrait + poses)

| # | Character | Role | Design notes from refs | Animations needed |
|---|---|---|---|---|
| 1 | **Judge Gavel.exe** | Host / judge | Crown, white barrister wig, black+gold robes, gold scales motif, gavel. Throne-like bench. **Centre of every composition** | Idle, gavel raise, gavel **strike** (verdict), point, facepalm, lean-in |
| 2 | **Miss Ratio** | Prosecutor | Magenta braided pigtails w/ gold hair ties, black+magenta suit, cape, holds scales tome. Sharp/stern | Idle, desk slam, **OBJECTION!** point, smug, shocked |
| 3 | **Counsel Chaos** | Defence | Brown spiky voxel hair, pink-tinted sunglasses, white suit, magenta shirt, gold chain. Smug | Idle, **LET BRO COOK** pose, papers fly, shrug, sweat-drop |
| 4 | **The Defendant** | Case subject (Solo mode) | **Anonymous by design** — silhouette/masked portrait, "CHARGES FILED" stamp overlay. Must be swappable per case | Portrait pop-in, stamp impact, slump, celebrate |
| 5 | **Side A / Side B** | Versus mode pair | Generic-but-distinct bodies, **no real names/faces** in entertainment UI. Two colour-coded variants | Idle, argue, rebuttal, concede |

## Player avatar

| # | Character | Notes |
|---|---|---|
| 6 | **First-person hands only** | No body. You need **held-item hands**: gavel-in-hand, pointing hand, holding-phone/evidence. This is the most-seen asset in the game. |

## Background cast (low detail, voxel, ~5–8 variants)

| # | Character | Notes |
|---|---|---|
| 7 | **Juror** ×3 seats | Three distinguishable silhouettes; seated pose. They fill one-by-one (md §5) |
| 8 | **Gallery / audience** | 6–10 repeating NPCs, back-of-head + 3/4 view |
| 9 | **Court clerk / bailiff** | Optional; handy for "receipt" moments |
| 10 | **Bystander villagers** (village scenes) — *cut, see `cc-art/dist/VILLAGE-DECISION.md`* | If you keep village scenes: Mara, Vera, Gus, Clem, Agnes, Milo from your journal shot |

> **Note on the female characters:** both your hero women (Miss Ratio, and the
> magenta-haired prosecutor) exist only as *one* design in the refs. You need a
> **male/female/masc/femme variant policy** decided up front for the defendant and
> Side A/B, or the casting will feel lopsided across cases.

---

# Part 3 — Props & furniture

## Courtroom hero props (voxel, high detail, individually modelled)

| Asset | Notes |
|---|---|
| **Judge's bench + throne** | Tall, gold trim, scales emblem. Seats Gavel.exe |
| **Gavel** | The brand icon. Needs a *hero* version: raised, mid-swing, struck |
| **Gavel sound block** | Small round block; used for the strike |
| **Prosecution desk** | Angled lectern, "PROSECUTOR" panel glow |
| **Defence desk** | Matching, "DEFENCE" panel glow |
| **Witness stand** | Rail + small desk |
| **Jury box** | 3 seats, raised, with verify badges |
| **Evidence screen** | Large wall display, "EVIDENCE" neon header |
| **Sealed ballot box** | The commit-phase prop. Locked lid + unlocked lid = 2 states |
| **Ballot paper / envelope** | Drops into box. Small but narratively critical |
| **Court seal / emblem plaque** | "CRINGECOURT" circular sign behind judge |
| **Case-number stamp** | For "CASE #0069 stamps on screen" |
| **"CHARGES FILED" stamp** | Red, angled |
| **Verdict cards** | GUILTY / NOT COOKED / NO VERDICT — 3 hero 2D cards |
| **Settlement receipt** | Small paper prop for the Arc settlement moment |
| **Courtroom doors** | Double doors, for the "doors swing open" beat |
| **Gallery benches** | 3–4 rows, repeating |
| **Railing / bar** | Separates gallery from well |
| **Podium mic** | For press/conference flavour |
| **Neon "ON TRIAL" sign** | Environmental signage |

## Courtroom dressing (repeatable, lower detail)

| Asset | Notes |
|---|---|
| Purple **banner with scales** | Hanging, pointed bottom, gold trim — 2 variants (long/short) |
| Crown **banner** | The crown-crest banner variant |
| Wall **sconce / lantern** | Warm emissive |
| **Spotlight housing** | Overhead cone rig |
| **Ceiling ring light** | The circular gold halo above the judge |
| **Stone column** | Capital + shaft + plinth, 2 heights |
| **Stone arch / window** | Gothic window with coloured panes |
| **Floor tile** | Polished reflective; 2–3 variants + the circular medallion |
| **Wall panel** | Dark panelled wall, modular |
| **Stair / dais step** | Raised bench platform |
| **Potted plant** | Corner dressing |
| **Camera / press rig** | For the "live trial" framing (seen in ref) |

## Village props (only if village scenes ship)

> **Status: cut (2026-11-02).** See `cc-art/dist/VILLAGE-DECISION.md`. The 17
> courtyard props already built stay (5 furnish the courtroom, 12 form an
> exterior kit); nothing below is built.

Cobblestone plaza tile + circular medallion, dirt path, grass, water, sand,
plank pier, **market stall** ×3 (red/white, blue/white, yellow/white awning),
stall counter + crates + sacks, **covered well**, **lamp post** (emissive),
**bench**, **two-wheel cart**, **fence** (post-and-rail, 4 orientations),
**crop rows**, **pine tree**, **round tree**, **bush**, **mushroom**, **rock**,
**bunting/pennant string**, **potted plant**, **signpost**, pond + lily pad,
dog, duck.

Buildings: **Herb cottage, Guildhall, Chapel, Smithy**, plus 3 generic houses.

---

# Part 4 — UI / 2D art

| Asset | Notes |
|---|---|
| **Character portraits** | 32–64px pixel busts, 4 expressions each (neutral / smug / shocked / defeated) |
| **Dialogue box frame** | Dark maroon + neon pink border (9-slice) |
| **Buttons** | Primary pink, secondary purple-outline, danger, disabled — normal/hover/pressed |
| **Panels** | Journal, Notebook, Board, Menu — parchment-cream style from your refs |
| **Icons** | Journal, Notebook, Board, Accuse, End day, Menu, Sound, Verified badge, Commit, Reveal, Bond, Refund, Slashed |
| **Verdict stamps** | GUILTY / NOT COOKED / NO VERDICT |
| **Timer / deadline widget** | Sunrise→sunset bar; must be *instantly* readable (md §5) |
| **Money receipt card** | Bond / reward / refund / forfeiture |
| **Wordmark "CringeCourt"** | 3D voxel letters, cream face + purple extrusion |
| **Share card** | Collectible case card frame |
| **OBJECTION! / LET BRO COOK** impact text | 2 hero effects |

---

# Part 5 — Build order (recommended)

Don't build 120 assets before proving one frame. Sequence:

1. **Prove the hero frame** — Gavel.exe + bench + one spotlight + neon backdrop.
   If that reads as "better than the ref", the style is locked.
2. **Lock the palette** — one `ramp()` set for neon-magenta world, one for warm
   gold, one for cool stone. Everything downstream inherits these.
3. **Judge Gavel.exe full set** (model + portrait + 6 poses) — the character that
   appears in 100% of marketing.
4. **Courtroom shell** — benches, desks, jury box, floor, walls.
5. **UI kit + 5 portraits** — needed for a playable vertical slice.
6. **Props, one at a time**, only as a scene needs them.
7. **Village set last** (or cut it — see the style note at the top).
   **→ Cut.** Rationale in `cc-art/dist/VILLAGE-DECISION.md`.

---

# Part 6 — What I need from you

1. **Upload the real character refs** you mentioned (front/side views if you have
   them). Right now Miss Ratio and Counsel Chaos exist only in one screenshot each.
2. **Confirm the style call**: neon-noir voxel everywhere, or keep the cozy village
   look? This changes every asset.
3. **Tell me the engine** — Three.js (web), Unity, Godot, or Roblox? Determines
   export format and poly budget.
4. **Priority**: do you want the courtroom vertical slice first, or the full
   character cast?

Say the word and I'll start with the hero frame — Gavel.exe on his bench.
