# Village set — cut from the asset spec

**Decision (2026-11-02): the village set is cut.** The 17 existing courtyard props stay
in the bundle (5 already furnish the courtroom; 12 form an optional exterior
kit). No village buildings, village NPCs, village tiles or village scene will be
built.

This closes the open question in `ART-BIBLE-AND-ASSET-MANIFEST.md` Part 5 step 7
("Village set last (or cut it)").

---

## Why

| # | Reason | Source |
|---|---|---|
| 1 | **The product has no village.** The idea doc's three modes (§4 A Solo, B Versus, C Viral Cases), the animation beats (§5) and the 11-step trial journey (§6) all take place in the courtroom or in app UI. No step sends the player to a village, plaza or map. | `idea/…V4…md` §4, §5, §6 |
| 2 | **The hackathon scope doesn't ask for it.** The essential MVP (§14) is a Solo case, three jurors, 0G arguments, World check, ballots, verdict, settlement, "a polished anime-style courtroom and a shareable verdict card". Village scenes aren't in MVP, Next or Stretch. | `idea/…V4…md` §14 |
| 3 | **It breaks the brand.** The art bible says the two looks are incompatible (neon-noir voxel courtroom vs. flat, earthy, cozy pixel village) and that "the courtroom is the brand, the village is the exception". Shipping both risks "two demos stapled together". | Art bible, "The one style decision that matters most" |
| 4 | **The art bible already made it conditional.** Part 3: "Village props (only if village scenes ship)". Part 2 #10: "Bystander villagers — *If* you keep village scenes". Part 5 #7: "Village set last (or cut it)". | Art bible Parts 2, 3, 5 |
| 5 | **The cost is real, the payoff isn't.** The full list is 4 named buildings + 3 houses, ~25 prop types, 6 named NPCs, plus ground tiles and a scene layout: about as much work again as the courtroom, for a screen no trial uses. The same effort goes further on gallery NPCs, hands and idle variants, which appear in every trial. | Art bible Part 3, "Village props" |

## What stays

The asset guide's "Courtyard / village" table lists 17 props, all already
modelled, exported and in `CringeCourt_Props.bbmodel`. They split in two:

- **Used by the courtroom (5):** `bench` (×2), `bookshelf` (×2), `throne_chair`,
  `judge_desk`, `trunk` are placed in `scene/courtroom.layout.json`. They are
  courtroom furniture now and are unaffected by this decision.
- **Outdoor only (12):** `fountain`, `lamp_post`, `barrel`, `crate`,
  `tree_round`, `tree_pine`, `bush`, `flower_bed`, `signpost`, `market_stall`,
  `bunting`, `cart`. None is placed in the courtroom layout. They cost nothing
  to keep and work as a **courthouse-exterior / lobby kit**, e.g. for a menu
  backdrop or a "court is in recess" screen.

If you use them, use them under the courtroom's dusk/neon lighting rather than
the flat daylight village look (art bible recommendation).

## What is cut

- Buildings: Herb cottage, Guildhall, Chapel, Smithy, 3 generic houses
- Village NPCs: Mara, Vera, Gus, Clem, Agnes, Milo; dog, duck
- Village ground: cobblestone plaza + medallion, dirt path, grass, water edge,
  sand, plank pier, pond + lily pad, crop rows, fences (4 orientations)
- Remaining village props: covered well, stall counter/sacks, mushroom, rock,
  potted plant (a courtroom `potted_plant` exists separately on `feat/ballot-props`)
- A village scene layout and camera presets

## When to reopen

Reopen only if the product doc adds a screen that needs it, for example:

1. a **world map / hub** where Daily Featured Cases (§11) are picked from
   buildings, or
2. a **Viral Cases plaza** (§4 Mode C) where spectators walk between case
   stalls.

If that happens, build the smallest version that serves the screen. A
courthouse-steps exterior from the 12 outdoor props plus one courthouse
facade, lit at dusk with the courtroom palette, is a better start than the
original cozy village.
