# @cringe-court/modes-solo

Mode 1, **Solo vs NPC** (docs/GAME-MODES.md §2, DECISIONS D1–D3, D12–D14): one
person files a confession, **Counsel Chaos** argues for them, **Miss Ratio** (an
NPC) argues against them, a jury of 3 decides GUILTY / NOT COOKED.

Pure TypeScript on top of `@cringe-court/core`; the web UI lives in
`apps/web/src/modes/solo/`.

| Module | What it owns |
|---|---|
| `definition.ts` | `soloMode` (registered through the ModeRegistry), `soloTerms()`, demo deadlines (D14, labelled), `PASS_ENABLED = false` (D12 gate) |
| `pricing.ts` | Revenue logic: the 1.20 quote (0.90 jury pool + 0.10 court fee + 0.20 AI), outcome previews computed with core `settle()` at 100 % attendance, the per-case D13 disclosure |
| `intake.ts` | Confession validation, the redaction pass (emails, links, phones, @handles, wallets, ENS, names the user lists), category copy |
| `session.ts` | `SoloSession`: drives the core trial state machine through `transition()` from filing to share, using the ports (counsel, chain, jury, teaser quota) |
| `director.ts` | Transcript line → shot (camera, poses, callout, fx, sound cues) for the illustrated courtroom |
| `npcJury.ts` | Demo NPC jurors that take seats through the real ledger port: bond, commit–reveal with salts, deterministic votes |
| `demoCounsel.ts` | Scripted `AiCounselPort` for the testnet demo (balanced, never leaks private notes) |
| `teaser.ts` | D3 teaser limits: 1/day per device, 3/day per signed-in account |
| `share.ts` | What the verdict share card says |

## Revenue model (DECISIONS, Mode 1)

The filer pays **1.20 test USDC** (1.00 with the 0G Compute Pass, which stays off
until V4 §17 gate 2). The court keeps the **0.10 protocol + 0.20 AI fee only on a
verdict**. NO VERDICT, an unfilled jury, an AI failure or a protective cancel
refund the full 1.20. Forfeited bonds are disclosed per case (D13) and never
needed for pricing (rule 1). The free teaser (openings only, no AI verdict)
carries its openings into the paid case.

## Demo vs real adapters

The web app's demo court wires `DemoCounsel`, the in-memory Arc twin
(`MemoryChain`), `MockIdentity` and the NPC jury. Production swaps in the 0G
counsel service (`@cringe-court/ai`), the Arc contract adapter (v3/p5) and the
World ID verified pool: `SoloSession` only talks to ports. Without a `jury`
adapter the session expects seats from the real pool.

## The room behind the trial (TrialView seam)

`apps/web/src/modes/solo/court/Courtroom.tsx` owns the dialogue, transport,
transcript and the screen-reader live region; the room behind it is a
`TrialView` (`court/TrialView.ts`): a component that receives one beat at a time
(`line`, `index`, `cast`, `reducedMotion`) and reports `onReady` / `onError`.
The illustrated stage is always underneath, so a view that fails to load drops
back to it without interrupting the trial. Today the default view is the voxel
courtroom (`@cringe-court/scene`); the first-person roaming courtroom
(`<RoamCourtroom>`, branch `v3/roam-fp`) plugs in by wrapping
`roam.runBeat(line)` in a component with the same props.
