# CRINGECOURT.FUN ⚖️💀
## V5: The playable world, the arrival run and the sponsor build state

**Tagline:** *Your Honor, Bro Is Cooked.*
**Date:** November 5, 2026 (during ETHGlobal Mumbai, November 5–7)
**Reads with:** `CringeCourt_V4_Product_Vision_Fairness_Fixes(1).md` (product, money and fairness decisions, unchanged) and `docs/DECISIONS.md` (D1–D14, closed November 2).
**Status:** Describes what the build does now. Money rules, jury sizes, prices and fairness decisions are exactly V4 + D1–D14. Testnet only (D14).

---

## 1. What changed since V4, in one paragraph

V4 imagined an anime courtroom you watch. The build became a voxel world you walk. The courtroom is a Minecraft-style place with a third-person camera, there is an isometric town beside it, and the three sponsor integrations (World, 0G, Arc) are built behind adapters with demo stand-ins. The biggest product change is how a player gets in. The sign-in form, the World ID form and the mode picker were one form after another before anything fun happened. They are now one short walk: **the arrival run**.

## 2. The arrival run (replaces the forms)

Route `/play`, reached from the title screen's Play button.

| Stop | What the player does | What it replaces |
|---|---|---|
| **Shrine of Identity** (spawn island) | Walks to a glowing panel under a stone arch, presses E, verifies with World ID. | The World ID form. Same `IdentityPort`: mock in this build, IDKit when configured. |
| **The Wardrobe** | Steps onto a gold dais. The camera swings round like a mirror, and every pick shows on their own body: outfit, hair, skin, accessory, effect, colours. Randomize, then Confirm. | No customization existed. A new player arrives already dressed from a random roll. |
| **Hall of Trials** | Three walk-through gates (gavel = Solo, crossed blades = Versus, scales = Grand Jury). Stand in a gate's circle, press E, read the card, choose. | The mode picker. Copy comes from the same mode content as the lobby. |
| **Courthouse** | Crosses the last bridge, climbs the grand staircase, presses E at the doors. | The chosen mode's court opens (`/solo`, `/versus`, `/grand-jury`), and the player sits the hearing in their wardrobe look. |

- A glowing seal across each bridge lifts when the stop before it is done, so the order is physical, not a stepper.
- A small "Your way in" tracker shows the four steps and a one-line hint for the current one.
- Progress is remembered on the device: look, verified flag (the screening nullifier only, never a name), and chosen mode. A returning player finds the seals already open and can skip straight to the courthouse.
- Nothing about money moves here. Fees, consent and funding stay in each mode's own flow (V4 §6, D1–D14).

## 2b. Console-style shell: the game is the whole app

The website layout is gone for players. The app opens like a console game:

- **Title screen (`/`):** the logo and a short menu (Play or Continue, New game, How to play, Settings) over the live world, which circles the courthouse slowly. Play glides the camera down into the player's view with no page load.
- **In the game, only the game.** No header, nav bar or footer. Leaderboard, My cases, the three courts, How to play, Settings and Quit to title live in the game menu (Esc, or the Menu button).
- **Panels over a frozen world.** Menu screens and every case-filing step (Solo filing, a new Versus case, the Grand Jury docket) open over the paused, blurred world, each with "Back to the game" and "Menu". Escape steps back on menu screens only; on a filing step it does nothing, so a half-written story is never lost.
- **Hearings play full screen,** with the background world suspended.
- Walking through the courthouse doors with a trial chosen opens that court's first step.
- Developer sandboxes (`/gallery`, `/town`, `/court/walk`, `/courtroom`) keep the old site shell.

## 3. Camera and controls

- **Default view: Minecraft-style third person.** The camera trails about four blocks behind the head. The mouse swings it around the player, and walls pull it in so it never clips. The crosshair stays on and "look at it, press E" works the same as in first person.
- First person stays one click away in the pause menu and in Settings.
- This replaces the earlier fixed isometric rake in the roaming court. The separate `/town` sandbox keeps its isometric view.

## 4. Look and feel

**Identity: warm, not purple.** The canonical sheet is the warm style guide: royal reds, golds, warm ivory stone, greens and sky blues. It is the 30 swatches in `docs/STYLE-GUIDE.md`, and the `courtroom_issue` "image copy 11" sheet matches it swatch for swatch. The purple reference images are used for layout and detail density only: floating islands, ornate panels, banners.

- **Textures:** block-texture-pack style 16×16 tiles with real contrast: bevelled stone bricks, plank floors with seams and nails, polished marble slabs with veins, cobble paving, wool carpet, gold blocks, leaves, grass tops, clay roof tiles. Floors and lawns wear a different tile on top than on their sides, the way a grass block does.
- **Lighting and post-processing** (rendered at the pixel-art resolution, so it is cheap):
  - Neutral tone mapping and soft shadows.
  - Bloom on lamps, stained glass and seals.
  - Ambient occlusion on high quality.
  - A warm afternoon sun outdoors that follows the player, sky haze toward the far islands, and a pixel-art cumulus sky.
- **The courthouse:** rebuilt to the reference sheet:
  - The building: six-column ivory portico, stepped pediment with the scales in a gold roundel, wings with arched windows and royal-red banners, corner towers, and red tile roofs over the lobby and courtroom.
  - The approach: a terrace, a grand staircase with a red runner, and Lady Justice on both newels.
  - The plaza: a sunken plaza with a tiered fountain, lawns, round trees, iron lamps and benches, all on a floating island.
- **Characters walk like Minecraft characters:** legs and the opposite arm swing together, for the player, remote players and the cast.

## 5. Sponsor integrations: honest build state

| Sponsor | Role (V4 §2) | Built | Not yet live |
|---|---|---|---|
| **World** | One verified human per seat; no judging your own case | Verifier, mock verifier, eligibility rules, app adapter. The arrival shrine uses it. | No live Developer Portal call from the app; the court server does not host the verifier. |
| **0G Compute** | Hosts the AI lawyers and the judge's line | `CounselService`, the information wall, the 0G chat client (tested against a fake broker). | The app still plays scripted counsel; the 0G SDK is not wired in; the Compute Pass stays off (D12). |
| **Arc** | Escrow, bonds, commit–reveal ballots, settlement | Contracts, TypeScript client, in-app `ArcLedger`, tested locally. | Not deployed to Arc testnet; the app uses an in-memory twin; relayer and indexer are open work. |

## 6. Asset pipeline

- In-world geometry is generated deterministically in code: courthouse, grounds, arrival islands and the wardrobe's character parts. The same source feeds the game and Blockbench.
- `npx tsx tools/bbmcp/preview-grounds.ts` builds the grounds in Blockbench over its MCP plugin, as a new project tab coloured with the palette and grouped by swatch, and saves preview shots to `.bbshots/grounds/`. From there the model can be inspected, edited and saved as `.bbmodel`.

## 7. What did not change

- Prices, jury sizes (2N+1), thresholds, bonds, refunds and every fairness rule: V4 and D1–D14.
- One angle then freeze, the information wall, the teaser rules, Versus consent.
- Testnet only, with the permanent TESTNET badge.

## 8. Open items carried forward

1. Move the live Solo page onto `ArcLedger`; add the relayer and the indexer.
2. Wire 0G Compute into the modes (the Pass stays off until the V4 gate).
3. A live World ID verification from the deployed app.
4. Send the wardrobe look over the court server so other players see it in Versus and Grand Jury (it is part of the avatar spec already).
5. Bring the stale docs up to date: `ARCHITECTURE.md` (Phase 3), `GAME-MODES.md` ("proposal") and `ROAM.md` (no plaza, no run, no third person).
