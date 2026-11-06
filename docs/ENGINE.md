# CringeCourt — Engine, scene and AI service

**Status:** Track p4 (branch `v3/p4-core`). This document covers the shared
trial model and the packages every mode builds on. Mode UIs live in the mode
tracks (`apps/web/src/modes/<mode>/`, `packages/modes-<mode>/`); contracts in
`v3/p5-contracts`; sound in `v3/audio`.

```
packages/
  core/     types, trial state machine, terms, settlement, ports, ModeRegistry; core/testing = port twins
  ai/       CounselService (AiCounselPort) over ChatClient: 0G Compute adapter + offline fixture
  engine/   TrialEngine (case over the ports), JurorSession, Director (transcript → show), ShowPlayer
  scene/    animations.json player, courtroom geometry, sprite atlases, three.js runtime (ScenePort), R3F <Courtroom/>
apps/web/
  src/modes/registry.ts   folder-discovered WebModeModule registry
  src/stage/              TrialStage (reusable stage + overlays) and the /courtroom demo court
```

Dependency direction: `core` ← `ai`, `engine`, `scene` ← `apps/web`. `engine`
and `scene` never import each other; they meet at `ScenePort`.

---

## 1. The trial state machine (`core/src/trial.ts`)

```
filing ─▶ evidence ─▶ counsel ─▶ jury ─▶ verdict ─▶ share
   │          │      (prosecution   │        │  ▲
   │          │       & defense)    │        ▼  │
   │          │          │          │      appeal
   └──────────┴──────────┴──────────┴─▶ closed (cancelled; refunds)
```

| Stage | Steps | Leaves on |
|---|---|---|
| `filing` | `drafting`, `awaiting-consent` (Versus) | `FILING_SUBMITTED`, `CONSENT_GIVEN` / `CONSENT_DECLINED`, consent deadline |
| `evidence` | `collecting` | every approver's `EVIDENCE_APPROVED`; `MODERATION_REJECTED` |
| `counsel` | `drafting` → `review` → `funding` | `COUNSEL_DRAFTED` (balance gate, one automatic redraft, then `ai-unfair`), `REDRAFT_REQUESTED` (one per side, D2), `DRAFT_APPROVED` freezes the transcript, `CASE_OPENED`, `FUNDS_DEPOSITED` until the target (and sponsor) is met |
| `jury` | `recruiting` → `briefing` → `commit` → `reveal` → `finalizing` | `SEAT_FILLED` ×(2N+1), `COURT_OPENED`, `BALLOT_COMMITTED`, commit deadline, `BALLOT_REVEALED`, reveal deadline, `VERDICT_RECORDED` |
| `verdict` | `announced` | `SENTENCE_READ`, `APPEAL_REQUESTED`, `SHARED` |
| `appeal` | `requested` | `APPEAL_FILED` (a new case), `APPEAL_WITHDRAWN`, appeal deadline |
| `share` | `open` | `SHARED` (repeatable) |
| `closed` | `cancelled` | `REFUNDED` once |

- `TRIAL_MACHINE` lists every event each stage accepts and where it may lead.
  `transition()` rejects anything else and checks every result against the table.
  A compile-time check fails the build if an event type is accepted nowhere.
- The reducer is pure: `now` arrives with each call. It never throws for a rule
  violation; it returns `{ ok: false, error }` with the reason.
- **Sealed ballots:** a seat's `choice` is only set by `BALLOT_REVEALED`.
- **Benches = ballot options.** Bench 0 argues ballot 0 (GUILTY / SIDE A / FOR).
  A verdict of `ballot-0` means bench 0 won. One rule for every mode (D5).
- `chainPhaseOf()` maps a trial state to the on-chain `CasePhase`.
- **Appeals** are off in every base mode. A mode can enable them in its rules:
  only the losing side, inside a window, and an appeal is a *new case* with a new
  jury and new escrow (the old verdict stands; fees stay fixed per case).

## 2. Terms and settlement

`termsFor(mode, options)` freezes a mode's constants into `CaseTerms` (rule 2:
immutable per case), including `payerShares` (Solo [1.20], Versus [0.70, 0.70]
less a side's own Pass waiver) and the sponsor slot.

`settle()` is V4 §9 generalised to 2N + 1 jurors and N + 1 to win. It returns
per-party receipt lines and asserts that money in equals money out. Tests pin
every row of the V4 §9 table, the Grand Jury 4-of-7 rule, protective
cancellation and every attendance pattern for Solo.

## 3. Ports (`core/src/ports`)

| Port | Production adapter | Twin (`@cringe-court/core/testing`) |
|---|---|---|
| `AiCounselPort` | `CounselService` + `OgComputeChatClient` (`@cringe-court/ai`) | `FixtureCounsel`; also `createFixtureCounsel()` from `@cringe-court/ai` |
| `ChainPort` | Arc testnet contract (v3/p5-contracts) | `MemoryChain` (phases by time, commit–reveal, exact settlement, claims) |
| `JuryPort` | waiting pool service | `MockJury` (seeded, auditable draws) |
| `IdentityPort` | World IDKit | `MockIdentity` (stable nullifiers, reuse and conflict checks, cancel/not-verified/error paths) |
| `SaltVault` | browser storage | `MemorySaltVault` |
| `AudioPort` | `@cringe-court/audio` (v3/audio) | `RecordingAudio` (the demo court uses a silent adapter until audio merges) |
| `ScenePort` | `CourtroomRuntime` via `asScenePort()` (`@cringe-court/scene`) | `RecordingScene` |

`createMockPorts()` builds a full, consistent set on one `ManualClock`.

**Alignment with v3/p5-contracts** (read from `origin/v3/p5-contracts`, not merged here):

- **Settlement:** `p5-oracle.test.ts` runs all 28 scenarios of p5's hand-written
  oracle (`contracts/test/fixtures/settlement-scenarios.json`, copied verbatim)
  through core `settle()`: verdict, per-juror payout, treasury + AI treasury
  total and refunds all agree.
- **Commitment:** `MemoryChain.commitmentFor` uses the same encoding as
  `CringeCourt.commitmentOf`: `keccak256(abi.encode(chainid, court, caseId,
  juror, uint8 choice, bytes32 salt))`, chain id 5042002. Not cross-run against
  viem's bytes (viem is not a dependency here).
- **Port shape:** p5 ships its own contract-shaped `ChainPort` in
  `packages/chain-client`. Core's `ChainPort` is the app-level port; the Arc
  adapter wraps chain-client:

  | core `ChainPort` | p5 chain-client |
  |---|---|
  | `createCase({ terms, transcriptHash, payers })` | `fileSolo` / `openVersus` / `publishGrandJury` (by `terms.mode`) |
  | `fund(n, amount)` | Solo: paid in `fileSolo`; Versus B: `joinVersus`; Grand Jury: `contribute` (after `approveUsdc`) |
  | `sponsor(n, amount)` | `publishGrandJury({ sponsor, sponsorAmount })` |
  | `acceptSeat(n, nullifier)` | `acceptSeat(offer)` (signed seat offer; identity via `HumanRegistry`) |
  | jury filled → court opens | `openCourt(caseId, transcriptHash)` (p5 records the transcript hash here, after recruitment) |
  | `commitmentFor` / `commit` / `reveal` | `commitmentOf` / `commitVote` / `revealVote` |
  | `advance` / `finalize` | `cancelExpired` / `finalize` (returns the settlement) |
  | `claim(n)` | `claimRefund(caseId)` for payers, `withdraw()` for juror balances |
  | `subscribe` | `onEvent` |

  The one semantic difference: core records the transcript hash when the case is
  created (frozen before paying, D2), p5 when the court opens. The adapter keeps
  the hash from `createCase` and sends it with `openCourt`.

## 3b. Audio alignment

`@cringe-court/audio` (v3/audio) uses its own cue ids. `apps/web/src/stage/audioCues.ts`
maps every core `AudioCueId` to one of them or to `null` (music beds and ambience
are driven by that package's phase ambience; character babble has no recipe). A
test pins the map against the audio package's cue list as read from `origin/v3/audio`.

## 4. Modes plug in

- `ModeDefinition` = config + rules + benches + staging + terms + bench labels.
  `BASE_MODES` holds Solo, Versus and Grand Jury; mode packages build on them with
  `extendMode()`.
- `briefsFor()` is the D1 information wall in one place: a bench gets its own
  client's private notes and angle and only the other side's public text.
- Web: `apps/web/src/modes/<mode>/mode.tsx` default-exports a `WebModeModule`;
  `registry.ts` discovers it with `import.meta.glob` and mounts its routes under
  `/<mode>/`. Adding a mode edits no shared file.

## 5. The engine (`@cringe-court/engine`)

**TrialEngine** runs one case: intents (`editFiling`, `approveEvidence`,
`requestRedraft`, `approveDraft`, `fund`, `tick`, `readSentence`, `share`) call
ports and dispatch events. It mirrors the ledger: chain events and `sync()`
reconcile deposits, seats, ballots, deadlines, verdict and cancellation, and
stale or duplicate ledger events are recorded in `ignored` instead of thrown.
The settlement it shows is recomputed from the ledger's case view with `settle()`.

**JurorSession** is one juror's duty: World ID screen → bond → sealed commit
(salt saved before sending) → reveal → claim, with typed results for every
unhappy path.

**Director** compiles a frozen transcript into a `Show` of cues: camera shots by
speaker (prosecution camera-left, defense camera-right), beats → animations,
sounds and fx, the other bench's reaction, exhibits on the evidence screen, and
ends on THE JURY IS OUT. Ceremonies (case opened, jury seated, ballot committed,
reveal, verdict, settlement) are separate shows. The ballot show takes no choice,
so it cannot leak one.

**ShowPlayer** performs a show through ScenePort and AudioPort with an injectable
clock, pause, next line, speed and abort, and maps system-animation sound labels
to audio cues.

## 6. The courtroom (`@cringe-court/scene`)

- `parseAnimationLibrary()` validates `animations.json` with JSON paths in errors.
  `sampleAnimation()` is ANIMATION-GUIDE §3 (pose/expression snap, transform lerp).
- `CharacterAnimator` implements `stateMachine.rules`: loops vs one-shots,
  blocking + a one-deep queue, objection may cut into talk, idle variants after 2–4
  base loops with no immediate repeat, talk ↔ idle alternation while dialogue
  streams, `reset()` for scene changes.
- `mergeByMaterial()` turns the 1606 boxes into 16 draw calls; emissive glass,
  sconces and the neon sign; spotlight rig with light cones and moods (house,
  spotlight, tense, guilty, acquitted, mistrial, blackout).
- Characters are camera-facing billboards from per-character atlases
  (`npm run atlas -w @cringe-court/scene [-- --check]`), generated from the pose
  PNGs with the panel flood-filled away. 63 world units per character.
- `CourtroomRuntime` owns the scene graph, camera moves (eased; cuts under reduced
  motion), shake/flash/impact/sweat/tears, the ballot-box lid, the evidence-screen
  glow and occlusion fade (an actor between camera and subject fades out).
- `<Courtroom runtime/>` (R3F) renders it; `useCourtroom()` loads data + atlases.

## 7. What is not verified

- **0G Compute** is not called live. The adapter follows the serving-broker
  inference flow (`getServiceMetadata`, `getRequestHeaders`, `processResponse`)
  through an injected interface; method names and the response-id header are not
  confirmed against the current SDK (see `packages/ai/README.md`).
- **Arc contracts**: the Arc adapter (core `ChainPort` over p5's chain-client) is
  not written; the mapping above is the plan. Settlement maths and the commitment
  encoding are aligned and tested.
- **World IDKit**: only the mock verifier exists.
- **Audio**: the demo court is silent until `@cringe-court/audio` merges; cue ids
  are defined in core (`AUDIO_CUES`) and may need mapping to that package's ids.
- **Rendering** was checked in headless Chrome with SwiftShader (software WebGL),
  not on real GPUs, Safari or Firefox. Frame rate on low-end phones is unmeasured.
- Expressions: pose sprites already carry their expression, so the animator's
  `expression` channel is sampled but not drawn as a separate face layer.
