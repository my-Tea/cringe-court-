# Integration: one app over every package

How `apps/web` sits on top of the packages built on separate tracks, and what
each service runs on in this build. Testnet only (D14).

## Platform layer (`apps/web/src/platform/`)

| Port | Default (demo) | Real service (env) | Code |
|---|---|---|---|
| Ledger (core `ChainPort`) | `ArcLedger` over chain-client `createMemoryChain` (the contract's exact state machine, check order, error names and settlement) | `ArcLedger` over `createViemChainPort` on Arc testnet (chain 5042002), injected wallet | `platform/ledger/` |
| Identity (core `IdentityPort`) | mock personas under world-id's real eligibility rules (Orb for jurors, Device for parties, parties excluded, one seat per human) | World IDKit in the browser plus a verifier backend (`/rp-context`, `/verify`) running `IdkitVerifier` | `platform/identity/` |
| Audio | one shared `@cringe-court/audio` engine for every mode (`appAudio()`), settings saved as `cc:audio` | same | `platform/audio.ts` |
| AI counsel | scripted fixture counsel | 0G Compute adapter in `packages/ai` (not wired in this build) | per mode |
| Court server (Versus, Grand Jury) | none: every court lives in this browser | `apps/server` shared by every device: `RemoteFactStore` / `RemoteGrandJuryCourt` from `packages/net` (docs/BACKEND.md) | `platform/backend/` |

Configuration is read once from Vite env (`platform/config.ts`):

```
VITE_LEDGER=demo | arc-testnet
VITE_ARC_RPC_URL, VITE_ARC_COURT, VITE_ARC_USDC, VITE_ARC_REGISTRY
VITE_IDENTITY=mock | world-idkit
VITE_WORLD_APP_ID, VITE_WORLD_BACKEND_URL
VITE_BACKEND_URL            shared court server for Versus and Grand Jury (unset = this browser only)
```

`apps/web/.env.example` lists them all. With `VITE_BACKEND_URL` set, the Versus
and Grand Jury layouts go through `BackendGate`. It shows an honest error if the
server cannot be reached and offers the local demo as an explicit,
remembered, reversible choice. It never falls back silently. `npm run dev:full`
starts the server and the app wired together.

A half-configured service falls back to its demo adapter, and Settings shows a
warning that names the missing variables. `/settings` → *Court connections*
lists the active adapters. It also reads every mode's terms from the ledger
through the adapter and checks them against the terms the app shows players.

`@cringe-court/world-id` is server-side (`node:crypto`), so the browser imports
only `@cringe-court/world-id/client` (types, eligibility, level mapping, copy).
A test walks that entry's import graph and asserts that nothing in it imports `node:`.

### Known gaps between core's port and the contract (ledger)

Covered by tests in `platform/ledger/*.test.ts`:

- The Grand Jury sponsor pays at `publishGrandJury`, so call `ArcLedger.publishGrandJury({ sponsorAmount })` there. Core's `sponsor()` after `createCase` throws `not-allowed`.
- Seat offers (ASSIGNER), `openCourt` (OPERATOR), Grand Jury publishing (CURATOR) and attestations (ATTESTER) are backend roles.
  - The demo plays them in the browser with public throwaway keys.
  - On Arc there is no relayer yet, so `acceptSeat` fails with a clear `not-allowed` and a full jury waits in `preparing`.
- Solo and Versus Side A pay inside `createCase`, because that is what `fileSolo` and `openVersus` do.
- Reveal opens as soon as every juror has committed. Time-driven phase changes have no contract event, so subscribers poll `getCase`.
- Titles, categories and Grand Jury contributor lists are not stored on-chain. An indexer is needed after a reload.

The mode flows still run on their own twins: Solo (`SoloSession` and the NPC
jury) in the browser; Versus (an event-sourced case room) and Grand Jury (the
demo court) in the browser by default, or on the shared court server with
`VITE_BACKEND_URL` (docs/BACKEND.md). `soloSession.test.ts` shows Solo running end to end on `ArcLedger(memory)`.
Moving the live Solo page onto it is the next step.

## Trials in the first-person courtroom (`apps/web/src/trial/`)

- **`TrialViewFrame`**: every mode's trial goes through it. The roaming courtroom (`<RoamCourtroom>`, docs/ROAM.md) is the primary view, and the mode's own stage is the fallback.
  - **Toggle:** *First person / Classic stage* is one app-wide choice, saved as `cc:trial-view`.
  - **WebGL2:** without it the classic stage is used, with a note.
  - **Errors:** if the roam view throws, an error boundary shows the classic stage.
- **`RoamTrial`**: loaded lazily, because it carries three.js. It seats the player and plays the hearing as roam beats.
  - The beats are built by `beatsFromLines` from the mode's frozen transcript and, once revealed, its verdict.
  - Controls: skip beat, replay, full screen.

| Mode | Role / spawn | Verdict beat |
|---|---|---|
| Solo | defendant at the defendant's table | none: the trial plays before the NPC jury, and the verdict panel replaces it |
| Versus | side-a / side-b at the defendant's table, a juror in the jury view, others in the aisle | on the replay after the verdict (SIDE A WINS / SIDE B WINS / NO VERDICT) |
| Grand Jury | a seated juror in the jury view, the public gallery in the aisle | only after the scrolls are opened (D11), with the case's ballot labels |

The roam beats seat the player at the defendant's table during cinematics in
every mode. That is roam's beat script, not a per-mode choice.

## App shell

- **Lobby (`/court`):** the three courts, a *Your cases* row (each mode's docket, from `WebModeModule.docket`) and a demo-court call to action.
- **Header:** the tabs, the testnet badge, the sound button (mute, plus the settings dialog) and the Settings gear. On phones the gear and sound move into the menu sheet.
- **Settings (`/settings`):**
  - *Sound*: mute, master, effects and music, reduce sound, and a test sound.
  - *Motion*.
  - *Court connections*: the adapters and a live terms check.
  - *Demo data*: per-mode counts and a reset that keeps your preferences.

## Checks

- `npm run check`: builds `chain-client` and `world-id`, then runs the generators, lint, typecheck, the vitest projects and the build.
- `npm run check:full`: `check`, plus the chain-client tests (memory and EVM conformance on a throwaway Hardhat node), the world-id tests and the contracts tests (`contracts/`, which needs `npm ci` there first).
