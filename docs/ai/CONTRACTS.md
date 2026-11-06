# Contracts

Two different contracts show up in `docs/ai`. One is the on-chain court, which this layer is forbidden to touch. The other is the data contract between the model and the game. Both are summarised here so the sponsor stack and the settlement stack stay easy to tell apart.

## 1. Smart contracts stay outside the model

[The AI README](README.md) and [07 §8](07_ORCHESTRATION_ARCHITECTURE.md#8-separation-from-money) are explicit: jury voting, World ID, escrow, markets and settlement live elsewhere, and the AI never touches them.

`packages/ai` imports nothing from the chain, escrow or market code, and none of that code imports it. The model receives a case the app has already accepted, and later a result the app has already finalized. Model output never feeds a payout.

The chain package those docs point at is [`contracts/`](../../contracts/README.md). It is a separate Hardhat project, testnet only, not part of the root npm workspace. Front ends are meant to go through `packages/chain-client`, not call the Solidity directly. World ID verification lives in `packages/world-id`.

| Contract | Job |
|---|---|
| `CringeCourt.sol` | Solo, Versus and Viral: jury, ballots, deadlines, settlement |
| `CourtMath.sol` | Pure settlement math, mirrored in `packages/chain-client/src/settlement.ts` |
| `HumanRegistry.sol` | World ID attestation: wallet to human id, level and expiry |
| `config/terms.json` | Every amount and window. Copied onto a case at creation and frozen for that case |

Money is testnet USDC (6 decimals). A case locks a juror bond, a protocol fee and an **AI fee** (`aiFeePerAgent`: 0.20 on Solo and Versus, 0.50 on Viral in the published terms). On a real verdict the AI fee is sent to the AI treasury. On NO VERDICT the payers get their fees back, including the AI fee, and the AI treasury receives 0.

That treasury transfer is not a call to 0G. Inference is paid in 0G credits on the Compute Router ([OG-ARC](OG-ARC.md)). The on-chain AI fee is the game’s charge for the performance. The two payment rails do not talk to each other.

Settlement outcomes the chain can produce, and which the AI is only allowed to *announce*:

| Mode | Ballot the humans cast | Other terminal states |
|---|---|---|
| Solo | `GUILTY` / `NOT_COOKED` | `NO_VERDICT`, `CANCELLED`, `INVALID` |
| Versus | `SIDE_A` / `SIDE_B` | same three |
| Viral | `SIDE_A` / `SIDE_B`, resolved outside the model | same three. Spectators may hold testnet predictions. The model is not told the odds |

Viral is the only place the app may set `marketSettled: true` on the finalized result. If that flag is absent, money words in the commentary are rejected and a template is used. If the app sets it, the judge may say that settlement happened. Amounts and advice are still forbidden.

## 2. The handoff the app must make

The model never sees a wallet, a bond or a ballot tally. The app crosses the boundary with two typed objects from [08](08_OUTPUT_SCHEMAS.md).

**In, before any inference.** A mode-specific `CaseInput`. The app chooses `solo`, `versus` or `viral`. Preparation then validates, redacts emails, links, wallets, phones and handles, and refuses harm, privacy-seeking, elections and unapproved Viral questions. No 0G call happens for a rejected case.

**Out, after the chain or the jury is done.** A `FinalizedCaseResult`: case id, mode, status (`FINALIZED`, `CANCELLED` or `INVALID`), outcome, summary, title, and the optional Viral `marketSettled` flag. The outcome must be legal for that mode. `generateVerdictCommentary` checks that the announcement contains the exact phrase and no other result phrase. Any provider error or any doubt falls back to `templateCommentary`, which states the real result and records `source: "template"`.

The transcript’s `contentHash` is keccak256 of the canonical script. That is an integrity check for replay, not an on-chain commitment. Nothing in this layer submits it to `CringeCourt.sol`.

## 3. The data contract the model has to satisfy

This is the contract in [08](08_OUTPUT_SCHEMAS.md) and [09](09_ANIMATION_CONTRACT.md). The model fills a schema. The engine performs it. Nothing the model returns is executed.

A trial script is `court-transcript@1`:

- Analysis first: what the case is about, the comic tension, the strongest point on each side, and the fact ids used.
- Then one line per slot. Solo has 9 slots and runs about 60–100 seconds. Versus and Viral have 11 slots and run about 70–110 seconds.
- Court-written slots ignore the model. Solo’s jury-out line, and Viral’s question plus “Result pending”, are templates.

Each model line may only use:

| Field | Allowed values |
|---|---|
| Speaker | `judge`, `clerk`, `prosecutor`, `defense` |
| Emotion | neutral, confident, smug, angry, shocked, nervous, sad, amused, exasperated, triumphant |
| Animation | talk, point, desk-slam, objection, gasp, laugh, smug, sweat, cry, gavel, present-evidence, dramatic-pause |
| Camera | auto, wide_courtroom, judge_closeup, prosecution_closeup, defense_closeup, clerk_desk, jury_box, gallery |
| Crowd | none, gasp, laugh, murmur |

`gavel` is judge-only. `objection` is counsel-only. Anything else in those two slots is rewritten to a safe preset. An unknown speaker is a hard failure, not a coercion.

Hard failures (repaired once, then rejected) include a missing or duplicate slot, a verdict leak, a judge who picks a side, invented evidence or numbers, Viral money talk, and a rebuttal that does not engage the line it was told to answer. Soft failures lower the score. The trial is accepted when there are zero hard issues, the heuristic overall is at least 3.5, and every dimension is at least 2.

## 4. How a transcript becomes the show

`toCourtLines` maps the transcript onto the engine’s existing `CourtLine` type. `directTrial` compiles that into cues. The court layer adds no event bus.

| Model field | What the game does |
|---|---|
| `text` | Dialogue, rendered as text. Never parsed as markup or code |
| `animation` | A named beat: sound, effect, opponent reaction, crowd |
| `camera` | A named shot. `auto` on counsel uses that advocate’s own desk |
| `crowd` | gasp, laugh or murmur |
| `emotion` | Stored on the line. No renderer reads it yet |
| `answers` | Optional caption for the words a rebuttal is hitting |
| `source: "template"` | Procedure. The UI may style it differently from model lines |

`courtDirectorOptions` sets the read-aloud pace to 15 characters per second so the show lasts about `estimatedSeconds`. The Director’s old 7-second cap would rush a court line.

The web app and server do not fetch a stored transcript and play it yet. The functions are ready. The call site is not.
