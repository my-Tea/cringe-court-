# The court server: Versus and Grand Jury across devices

Before this, every Versus and Grand Jury court lived in one browser: an invite
opened anywhere else said "No case with that code here" (UX-EVALUATION B8).
`apps/server` is a small shared server that holds those courts, so two people
on two phones can settle a Versus case and seven jurors on seven devices can
decide a Grand Jury case. Test money only; nothing touches a real chain.

The server is **opt-in**. With no `VITE_BACKEND_URL`, the app runs exactly as
before: every court in the browser, no network.

## Contents

1. Architecture
2. Running it
3. Configuring the web app
4. HTTP API
5. Threat model and redaction across the wire
6. Clock, live updates and reconnects
7. Durability
8. Limits and server configuration
9. What is not production-ready
10. How it is tested

## 1. Architecture

```
 device (browser)                          apps/server (Node http + SSE)
 ───────────────────────────────────       ─────────────────────────────────────────
 Versus screens                            VersusRoom
   VersusProvider ── RemoteVersusDesk        one fact log (JSON lines on disk)
                     └ RemoteFactStore ──▶   validate shape → authorize → World.apply
                        (redacted copy)  ◀─  redact per device on every read
                                             the clerk: a VersusDesk with AI counsel
 Grand Jury screens                        GrandJuryHall
   CourtProvider ── RemoteGrandJuryCourt ─▶  createDemoCourt() built once: ledger twin,
                     (same API as             docket, jury pool, gallery, simulated crowd
                      GrandJuryCourt)         one GrandJuryCourt view per device
                                             command log, replayed at pinned times
 CourtConnection (packages/net)            Sessions (hashed bearer tokens), InviteSigner,
   HTTP + SSE over fetch, poll fallback,     rate limits, CORS, size limits
   skew-corrected clock
```

The server does not have its own copy of the rules. It imports the same
packages the app runs:

- **Versus** is event-sourced (`World` in `@cringe-court/modes-versus`). The
  server keeps the one log and applies every write to a live `World` before it
  is logged. Devices replay their own copy with the same code. The seam is the
  existing `FactStore` port: `RemoteFactStore` implements it, and its `append`
  became async (an additive change: `MemoryFactStore` is unchanged).
- **Grand Jury** runs the offline demo court (`createDemoCourt`) once, on the
  server. Each device gets a `GrandJuryCourt` over the shared ledger twin, docket,
  jury pool and gallery, signing as that device's wallet. The device-side
  `RemoteGrandJuryCourt` has the same methods as `GrandJuryCourt` (the
  `GrandJuryCourtApi` type), so the screens are unchanged.

Why not a remote chain-client `LedgerPort`? Versus and Grand Jury do not use it.
They run on core's in-memory ledger twin inside `World` and the demo court.
Sharing those two seams moves the real game state across devices. A remote
contract port alone would not. Arc testnet stays the separate
`VITE_LEDGER=arc-testnet` path (docs/INTEGRATION.md).

Package layout:

| Where | What |
|---|---|
| `packages/net` | Wire codec (bigint and Map safe), protocol types, `CourtConnection`, `RemoteFactStore`, `RemoteVersusDesk`, `RemoteGrandJuryCourt` |
| `apps/server/src/app.ts` | Routes, CORS, limits, SSE hub, heartbeat |
| `apps/server/src/versus/` | `VersusRoom`, shape checks and authorization (`validate.ts`), redaction (`redact.ts`) |
| `apps/server/src/gj/hall.ts` | `GrandJuryHall`, server-side World ID proof checks |
| `apps/server/src/sessions.ts` | Device sessions, signed invite tokens |
| `apps/server/src/store.ts` | `DurableLog` interface; JSON-lines and memory adapters |
| `apps/web/src/platform/backend/` | `BackendClient` (sessions, status), `BackendGate` (connect / fail / local choice) |

## 2. Running it

```sh
npm install
npm run dev:full          # court server on :8787 + Vite on :5173, wired together
# or separately:
npm run server            # apps/server (JSON-lines store in .data/court-server)
VITE_BACKEND_URL=http://127.0.0.1:8787 npm run dev
```

Open the app in two browsers (or a normal and a private window, or a phone on
your network: set `HOST=0.0.0.0` and add the app's origin to `CC_CORS_ORIGINS`).

Docker (from the repository root):

```sh
docker build -f apps/server/Dockerfile -t cringe-court-server .
docker run -p 8787:8787 -v court-data:/data -e CC_CORS_ORIGINS=https://your.app cringe-court-server
```

The Dockerfile has **not been built** here: the build machine has no Docker.
It is written to match the workspace layout and lockfile. Treat it as a
starting point.

## 3. Configuring the web app

| Variable | Meaning |
|---|---|
| `VITE_BACKEND_URL` | Origin of the court server, e.g. `http://127.0.0.1:8787`. Unset: courts stay in this browser. Not an http(s) URL: ignored, with a warning in Settings → Connections. |

`apps/web/.env.example` and `apps/server/.env.example` list everything.

What a player sees:

- **Connecting** for a moment, then the mode as usual. The persona bar and the
  Grand Jury ribbon say *Shared court · live*.
- **Server unreachable** at load: *The court server is not answering*, with the
  host, the reason, **Try again** and **Play the local demo instead**. The app
  never falls back on its own. Choosing the local demo is remembered on this
  device, labelled (*Local demo*), and reversible (*Use the shared court*, also in
  Settings → Connections).
- **Server lost mid-session**: a *Lost the court server* banner. Actions fail
  with *Could not reach the court server. Nothing was sent.* The device keeps
  what it has and reconnects by itself.
- **Server reset** (it forgot this device's token): a fresh session, and a
  *Fresh seat on the court server* notice saying older cases are gone.

All of this copy is in the i18n catalog (`backend` namespace).

People on one device: each "person" is a court-server session (token and demo
wallet). *Switch persona* in Versus switches between them, per tab, as in the
local demo. A refresh or a closed tab resumes the same session.

## 4. HTTP API

Base path `/api/v1`. JSON through the wire codec: a bigint is `{"$big":"…"}`, a
Map is `{"$map":[[k,v]…]}`. Every response carries `x-court-time` (server wall
clock, ms). Errors are `{ "error": { "code", "message", "retryAfter?" } }`.
Everything except `health` and `POST sessions` needs `Authorization: Bearer <token>`.

| Method and path | Purpose |
|---|---|
| `GET /health` (also `/healthz`) | `{ ok, version, serverTime, features: { demoClock, npcJurors } }` |
| `POST /sessions` | New device session: `{ token, persona: { id, name, account }, features }` (rate-limited per address) |
| `GET /sessions/me` | Resume: the persona for this token, or 401 |
| `GET /events` | Server-Sent Events: `hello`, `versus { length, epoch }`, `gj { version, now }`, and a ping comment every 20 s |
| `GET /versus/log?since=n&epoch=e` | The fact log from `n`, redacted for this device. If `epoch` is not current, the whole log comes back (`reset: true`) |
| `POST /versus/facts` | `{ facts, base }`: append, built on a log of `base` facts. 200 `{ accepted, length, epoch }`; 409 conflict; 422 the court's rules refused it (with the court's message); 400 shape; 403 not yours |
| `POST /versus/access` | `{ code, token? }`: open an invite on this device. A signed link `token` skips the guess limit |
| `GET /versus/invite/:trialId` | Side A only: `{ code, token, expiresAt }` for the invite link (`/versus/join/CODE?t=TOKEN`) |
| `GET /gj/state` | `{ now, version, account, balance, marketingUsed }`. The first call gives the device its 25.00 starting test USDC |
| `GET /gj/docket` | `DocketEntry[]` |
| `GET /gj/cases/:n` | `CaseDetail` for this device (without salts; the device fills in its own) |
| `POST /gj/cases/:n/{contribute,screen,seat-request,seat-decline,seat-accept,commit,reveal,settle,claim,gallery,skip}` | The court's actions. Each returns `{ now, version, result: ActionResult }` |
| `POST /gj/faucet` | `{ amount ≤ 10.00 }` test USDC |

## 5. Threat model and redaction across the wire

The server is the court: it sees both sides' private briefs, because only it
drafts counsel. Devices are not trusted with anything they should not see, and
anything they send is checked.

**What never reaches a device that should not have it** (tested on the raw HTTP
responses and the event stream, not just on screen):

| Level (per case, per device) | Sees |
|---|---|
| `a` / `b` (a party) | Its own brief in full. The other side's public story and nickname. **Never** the other side's private notes or angle |
| `public` (case on the ledger: jury stage on) | Public text: title, stories, exhibits, the frozen transcript. Every private note and angle is blanked |
| `granted` (opened the invite, not a party) | The summons (title, category, terms). Neither story, no exhibits, no drafts |
| `none` (someone else's private case) | A sealed placeholder: title `[sealed]`, code `SEALED-<id>`, stories, exhibits and drafts sealed |

Devices replay their copy of the log, so redaction keeps every fact in place and
every rule satisfied. It blanks fields with values the trial accepts (an empty
note, a null angle, a short sealed marker where a story must not be empty). A
redacted replay never diverges or rejects. When what a device may see changes
(Side B accepts, the case reaches the ledger), its `epoch` changes and it takes
a fresh copy.

Two notes, stated plainly:

- The **angle** steers that side's agent in the public trial, so the agent may
  argue it out loud. The *brief field* never leaves its owner's device.
- The **AI draft** is written by the court from both sides' private notes. It is
  shown to both parties and, once the case is public, to everyone. The notes
  themselves are not.

**Ballots.** The server never holds a vote before the reveal. Sealing computes
the commitment on the device (the salt is saved there first, ARCHITECTURE rule
3) and sends only the commitment. The reveal brings choice and salt, which the
ledger checks against the commitment. Other jurors see only counts (sealed,
opened). The Secret Verdict Scroll still restores a lost salt on another
device. This is stronger than escrowing salts on the server, so salts are not
escrowed. Demo jurors' salts are derived and labelled simulations, as before.

**Input and authorization.**

- Each Versus fact is shape-checked: known types only, exact keys, string
  lengths, hex formats, invite-code checksum, and only the court's canonical
  Versus terms.
- Authorization: a device acts only for its own wallet. Only a device that
  opened the invite (code or signed link) may accept or decline it.
- `drafted`, `counsel-failed` and `sentence` are written only by the server's
  clerk.
- Then `World.apply` enforces the trial rules: a refusal is a 422 and nothing
  is logged.
- Grand Jury: inputs are validated per action. World ID proofs are checked for
  shape and Orb level, and one human (nullifier) holds one seat per case across
  devices.

**Invites.** Codes are 8 symbols with a check symbol. Unsigned lookups count as
guesses: 8 per device then roughly 1 a minute, and 40 per address. Links carry
`trialId.expiry.HMAC(code)` signed with `CC_SECRET`. A forged or expired token
is just another guess.

**Sessions.** The token is 32 random bytes. The server stores only its SHA-256.
Whoever holds the token is that device (demo-grade identity).

**Transport.** CORS has an allow-list (`CC_CORS_ORIGINS`). Bodies are capped at
64 KB (413). `nosniff`, `no-referrer` and `no-store` are set. Header and request
timeouts are set. The live stream sends the token in a header (SSE read through
`fetch`), never in a URL.

## 6. Clock, live updates and reconnects

- **Server time is authoritative.** Every fact gets the server's sequence
  number, time and author on arrival. Devices estimate skew from `x-court-time`
  (the round-trip sample with the shortest delay in the last minute) and run
  their desks and countdowns on server time. A device ten minutes fast or an
  hour slow sees the same deadlines (tested).
- **Demo time.** The demo clock skip moves the shared court clock for everyone
  on that server: Versus adds skew to the one World; Grand Jury skips the shared
  `DemoClock`. Turn it off with `CC_DEMO_CLOCK=off` (the button then explains
  why it is refused).
- **Live updates.** SSE events say *what changed*, never the content. The device
  then pulls its own redacted view. If the stream cannot be held, the connection
  polls every 2 s and keeps trying the stream with backoff.
- **Reconnect.** On every (re)connect the device resyncs. A 401 on the stream
  (the server was reset) leads to a fresh session instead of endless retries.
- **Concurrency.** A Versus write names the log length it was built on. It is a
  conflict only if something touching the same case (or the clock) landed
  since. The desk then rebuilds and retries, as with the local store.

## 7. Durability

`DurableLog` is one interface: an append-only log. Node 20 has no `node:sqlite`
(it arrived in 22.5), so the adapter is JSON lines, one file per stream in
`CC_DATA_DIR`:

- `sessions.jsonl`: sessions and invite grants.
- `versus.jsonl`: the fact log, which is the whole Versus state.
- `grand-jury.jsonl`: genesis time and every command with the court time it
  ran at, plus every simulation tick that changed the world or ran while a case
  was in session. On boot the hall seeds from genesis and replays the commands
  with the clock pinned to each one's time.

A torn last line (crash mid-write) is skipped. A restart keeps sessions, cases
and the Grand Jury court (tested: same raised totals, same court record).
`CC_STORE=memory` keeps nothing.

## 8. Limits and server configuration

| Variable | Default | |
|---|---|---|
| `PORT`, `HOST` | `8787`, `127.0.0.1` | |
| `CC_STORE`, `CC_DATA_DIR` | `file`, `.data/court-server` | `.data/` is git-ignored |
| `CC_CORS_ORIGINS` | local Vite dev and preview origins | comma list, or `*` |
| `CC_SECRET` | generated into `secret.key` (mode 600) | HMAC key for invite links; never committed |
| `CC_DEMO_CLOCK` | `on` | the shared-clock demo control |
| `CC_GJ_NPC_JURORS` | `late` | `late`: humans get first pick, simulated jurors fill what is left in the last third of the recruiting window. `fill`: as offline. `off`: humans only |
| `CC_MAX_SESSIONS` / `CC_MAX_VERSUS_CASES` / `CC_MAX_FACTS` | 5000 / 500 / 50 000 | 503 or 507 with a plain message past them |
| `CC_TRUST_PROXY` | `off` | use `X-Forwarded-For` for rate limits |
| `CC_TICK_MS`, `CC_COUNSEL_LATENCY_MS` | 1000, 1200 | heartbeat; fixture counsel latency |

Rate limits (token buckets, per process):

| Bucket | Limit |
|---|---|
| Per address | 600 burst, 100/s |
| Session creation | 20, then 1 per 10 s |
| Reads per device | 120 burst, 20/s |
| Writes per device | 30 burst, 3/s |
| Faucet | 6, then 1 per 20 s |
| Invite guesses | as in section 5 |

## 9. What is not production-ready

- **Single node, in-process state.** One process holds every court and replays
  logs on boot. No horizontal scaling, no replication, and rate limits are
  per process.
- **Every device replays the whole Versus log** (redacted). That is fine at demo
  scale (hundreds of cases) and wrong at scale. A production server would
  shard per case or send projections.
- **Demo-grade auth.** Bearer tokens with no accounts, no expiry and no device
  binding. A copied token is a copied device.
- **World ID stays mocked.** The server checks proof shape, level and one seat
  per human, but does not verify IDKit proofs cryptographically. With
  `VITE_IDENTITY=world-idkit` the app warns about this.
- **No real chain by default.** Money is the in-memory ledger twin with test
  USDC. Arc testnet remains a separate path.
- **AI counsel is the fixture**, behind the same `AiCounselPort` that 0G Compute
  plugs into. Not wired on the server here.
- **The shared demo clock** affects every case on a server, by design for a
  demo. Turn it off for anything public.
- **The Grand Jury summoning crowd is still simulated** on the server. Jurors
  are real people, with simulated fill-ins per `CC_GJ_NPC_JURORS`.
- **The Dockerfile is unverified** (no Docker on the build machine). No TLS
  (put a proxy in front), and no Cloudflare Worker adapter (not built: not cheap
  enough to do properly next to this).

## 10. How it is tested

`npm test` runs these with the rest (server on a random port, memory store):

| Suite (`apps/server/src/__tests__/`) | Proves |
|---|---|
| `versus.contract.test.ts` | The `FactStore` contract against `MemoryFactStore` and `RemoteFactStore`. One whole Versus case played on one device (memory) and on three devices (server), with identical verdict, money, court record and case number |
| `redaction.test.ts` | On raw responses and the event stream: stranger, invitee, other side and juror never receive a secret. A stranger cannot answer an invite. The server never holds a salt before the reveal |
| `grand-jury.test.ts` | The offline demo court and the remote court seed the same docket and answer the same actions the same way. Seven devices fund, screen, seat, seal, reveal, settle (4–3) and claim. One World ID cannot take two seats. Votes are isolated. A wiped device reveals from its scroll |
| `routes.test.ts` | Health, auth, CORS, 413/415/400, shape checks, wallet ownership, court refusals, signed invites, guess limits, demo-clock switch, faucet cap, write rate limit, session cap |
| `durability.test.ts` | Clock skew (±), live resync, restart from the JSON-lines store with the same sessions, cases and court, and the 401 path after a reset |

`apps/web/src/platform/backend/BackendGate.test.tsx` covers the UI: local
default, connect and resume, unreachable with retry and an explicit local
choice (axe-clean), and the fresh-session notice.

Real browsers: `npm run e2e:backend` (not part of `npm run check`):

1. Starts a server.
2. Builds the app against it.
3. Plays Versus with A, B (mobile) and a juror in separate Playwright contexts:
   signed link, live updates, reload mid-case, server-drafted counsel, payments,
   seal, reveal, verdict on both sides, claims.
4. Plays Grand Jury with seven contexts, through to 4 of 7 and seven claims.
5. Plays the server-down path.

Screenshots and step logs go to `~/cringe-court-v3/screenshots/backend/`.
