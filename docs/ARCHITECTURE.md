# CringeCourt — Architecture

**Status:** Phase 3 (app shell). This document fixes the module boundaries, the
types the modules share, and how data moves between them. Later phases fill in
the adapters (Arc contracts, 0G Compute, World IDKit) and the trial engine
without changing those boundaries.

Inputs: [`DECISIONS.md`](DECISIONS.md) (D1–D14 and the implementation
constants), [`GAME-MODES.md`](GAME-MODES.md), the V4 product vision
([`idea/`](../idea/)), and the art bible + generated art in [`cc-art/`](../cc-art/).

---

## 1. Stack, and why

| Concern | Choice | Why |
|---|---|---|
| Repo | **npm workspaces monorepo** (`apps/*`, `packages/*`) | npm is already what `cc-art` uses; no extra tool to install. pnpm would also work; npm keeps the setup to one command. |
| App | **Vite 8 + React 19 + TypeScript (strict)** | Fast builds, no server needed: everything that matters runs on chain or in adapters. A static SPA deploys anywhere. |
| Routing | **React Router 7** (data router, library mode) | Lazy routes (the gallery is split out), error boundaries per route, scroll restoration. |
| Styling | **CSS Modules + CSS custom properties** generated from a TS token file | Zero runtime cost, scoped class names, real CSS (`:has`, `color-mix`, container-free). Tokens stay typed and testable. No utility framework: the design system *is* the vocabulary. |
| Accessible primitives | **Radix UI** for Dialog, Tabs, Toast, Tooltip | These four are where hand-rolled a11y usually fails (focus trap/return, roving tabindex, live regions). Everything else is native HTML (button, input, select, fieldset/radio, details). |
| Fonts | `@fontsource` packages, self-hosted | No third-party font CDN; Pixelify Sans (display), Space Grotesk (body), JetBrains Mono (money/time). |
| Tests | **Vitest** (two projects: `core` in node, `web` in jsdom) + Testing Library + vitest-axe | One runner for domain logic and components; axe catches structural a11y regressions. |
| Lint | ESLint 9 flat config: typescript-eslint, react-hooks, **jsx-a11y (strict)**, react-refresh | ESLint 9, not 10: `eslint-plugin-jsx-a11y` does not support 10 yet, and the a11y rules matter more. |
| Art | Imported straight from `cc-art/dist` via the `@art` alias | No copied, drifting assets. `import.meta.glob` fails the build if a referenced file is missing; Vite fingerprints only the files actually used. |

---

## 2. Repository layout

```
package.json              workspaces + root scripts (dev, build, test, lint, typecheck, tokens, check)
tsconfig.base.json        strict compiler settings shared by every package
tsconfig.json             project references (tsc -b type-checks everything)
vitest.config.ts          test projects: packages/core, apps/web
eslint.config.js          one lint config for app + packages (art tools excluded)

packages/
  core/                   @cringe-court/core — pure TypeScript, no DOM, no SDKs
    src/money.ts          Usdc branded bigint, parse/format, exact arithmetic
    src/modes.ts          ModeConfig for solo / versus / grand-jury (DECISIONS constants)
    src/case.ts           CaseNumber, CasePhase state machine, Verdict, ReceiptLine, CaseSummary
    src/ports.ts          AiCourtProvider (0G), JurorVerifier (World), CourtLedger (Arc)

apps/
  web/                    @cringe-court/web — the Vite SPA
    index.html            sets the motion preference before first paint
    scripts/gen-tokens.ts tokens.ts → tokens.css (with --check)
    scripts/gen-guide-art.py  style-guide crops → src/art/guide/*.webp (with --check)
    src/
      main.tsx            fonts, reset, tokens, base CSS, <App/>
      app/                providers, router, AppShell (header/nav/footer), route error boundary
      art/art.ts          typed access to cc-art/dist (portraits, poses, UI icons, brand) and the style-guide crops
      ds/                 the design system (see docs/DESIGN-SYSTEM.md; identity in docs/STYLE-GUIDE.md)
        tokens.ts         single source of truth for every token
        tokens.css        generated; committed; checked in CI
        styles/           reset, base, fonts
        motion/           MotionProvider (system / reduced / full)
        components/       one folder per component: .tsx + .module.css + .test.tsx
        lib/              cx, contrast, useNow
      pages/              Home, Solo/Versus/Grand Jury mode pages, 404
      gallery/            /gallery: every token, component and state

cc-art/, judge/, …        the art pipeline (unchanged by this phase)
docs/                     decisions, economics, architecture, design system, STYLE-GUIDE.md (canonical identity)
```

Track p4 added `packages/ai`, `packages/engine` and `packages/scene`, the trial
state machine and every port with its twin; see [`ENGINE.md`](ENGINE.md).

Later phases add, without moving anything above:

```
packages/contracts/       Solidity (Foundry) for Arc testnet: escrow, bonds, commit–reveal, settlement
packages/engine/          trial engine: phase transitions, deadlines, settlement maths (pure, uses core)
packages/adapters/        og-compute, world-idkit, arc-viem + fixture/mock twins
```

---

## 3. Types first

The shared vocabulary lives in `@cringe-court/core` and has **no runtime
dependencies**. Everything else imports from it; it imports from nothing.

### Money

```ts
type Usdc = bigint & { readonly [usdcBrand]: true };   // micro-USDC, 6 decimals
usdc('1.20')            // parse from a decimal *string* (never a float)
formatUsdc(x)           // "1.20 USDC", trims, never rounds
addUsdc / subUsdc / mulUsdc
```

Amounts are branded `bigint`s so a juror's refund can never be `0.30000000000000004`
and a plain number can't be passed where money is expected.

### Modes

```ts
type ModeId = 'solo' | 'versus' | 'grand-jury';
interface ModeConfig {
  id; name; tagline; cast;
  ballot: readonly [string, string];            // GUILTY / NOT COOKED, SIDE A / SIDE B, reviewed titles
  funding: FundingModel;                        // filer-pays | split(2) | crowdfund(min, sponsor)
  economics: ModeEconomics;                     // n, bond, bonuses, fees, Pass waiver, stipend
  deadlines: Deadlines;                         // pre-trial, recruitment, commit, reveal (seconds)
}
MODES: Record<ModeId, ModeConfig>               // DECISIONS.md "Implementation constants"
GRAND_JURY_LAUNCH                               // D10 Sponsored Docket profile (7.80, sponsor ≥ 2.00)
jurySize(m) = 2N+1   verdictThreshold(m) = N+1   juryPool(m)   caseCharge(m)
```

`core.test.ts` pins every number in the DECISIONS table (3/7 jurors, 2/4 to win,
pools 0.90/0.90/6.30, charges 1.20/1.40/7.30, launch 7.80, bond = 0.40 × N,
bonus = 75 % of bond). If the decision record changes, the test must change with it.

### Case lifecycle

```
draft → pre-trial → recruiting → preparing → commit → reveal → finalizing → settled
          (Versus consent / GJ funding)                         ↘ cancelled (from any live phase; always refunds)
```

`CasePhase`, `PHASE_TRANSITIONS` and `canTransition()` encode it. `PHASE_LABELS`
gives the player-facing names (commit = "Secret Verdict Scroll", reveal = "Open
Your Scroll", per V4 §13). `Verdict` records the tally, the jurors who completed
duty and the appointed count, so the UI can show "2 of 3" honestly.
`ReceiptLine { kind: bond-returned | reward | refund | forfeit | stipend | fee }`
is what every settlement screen renders.

### Ports (adapters)

```ts
interface AiCourtProvider { id: 'og-compute' | 'fixture'; argue(req): ArgumentResult; sentence(label, hash) }
interface JurorVerifier   { id: 'world-idkit' | 'mock';   screen(caseNumber): ScreeningResult }
interface CourtLedger     { id: 'arc-testnet' | 'memory'; network: 'arc-testnet';
                            getCase, listCases, fund, acceptSeat, commit, reveal, finalize }
interface CourtServices   { ai; verifier; ledger }
```

Rules:

1. **Only adapters import sponsor SDKs.** Pages and the engine see the ports.
2. **Every port has a deterministic twin** (`fixture`, `mock`, `memory`) used by
   tests, the gallery and offline demos. The twin is chosen at startup from
   config, never by `if (import.meta.env.DEV)` inside feature code.
3. **The salt never leaves the client.** `commit` takes a commitment hash;
   `reveal` takes the choice and salt. Salt storage is an app concern with its own
   reliability tests (V4 §7 UX safeguard).
4. `network` is the literal `'arc-testnet'` (D14): a mainnet ledger does not
   type-check.

---

## 4. Data flow

```
             ┌───────────────────────── apps/web ─────────────────────────┐
 user ──▶    │ pages (Home, Mode, Case, Ballot…)                          │
             │   │ read: CaseSummary, ModeConfig       ▲ render: ds/*      │
             │   ▼                                     │                   │
             │ engine (later): phase rules, deadlines, settlement preview  │
             │   │ calls ports                                             │
             └───┼─────────────────────────────────────────────────────────┘
                 ▼
     CourtServices { ai, verifier, ledger }  ← chosen once at startup
        │               │                 │
   0G Compute      World IDKit       Arc testnet contracts
   (arguments,     (juror           (escrow, bonds, commit–reveal,
    sentence)       screening)        deadlines, payouts, refunds, fee splits)
```

- **Source of truth for money and phase is the chain.** The app never computes a
  payout it then trusts; it previews with the engine and displays what the ledger
  reports.
- **Source of truth for arguments is the frozen transcript**, identified by
  `transcriptHash`, recorded before voting.
- **Configuration is per case and immutable** (DECISIONS rule 2): the app reads a
  case's own fees and deadlines, never the current global constants, once a case
  exists. `MODES` is only for cases not yet created (pricing pages, filing).

---

## 5. The web app

### Shell

`AppShell` provides: skip link, sticky header (wordmark, main nav, permanent
**TESTNET** badge with explanation, mobile menu as a Radix sheet), `<main
tabIndex=-1>` that receives focus after client-side navigation, footer with nav,
reduced-motion setting and the testnet/entertainment disclaimer, and
`ScrollRestoration`. `RouteError` is the last-resort error boundary.

### Routes

| Path | Page | Notes |
|---|---|---|
| `/` | Home | Hero stage (judge, prosecutor, defense poses), the three courts with live numbers from `core`, how a trial works, fair-play rules, CTA |
| `/solo`, `/versus`, `/grand-jury` | ModePage | Pitch, cast, the numbers (from `MODES`), steps, who pays/keeps/refunds. Filing is visibly disabled with the reason |
| `/gallery` | GalleryPage (lazy chunk) | Every token, component and state; surface and motion toggles; replay animations |
| `*` | 404 | "Case dismissed" stamp + empty state |

### Providers (outside → in)

`MotionProvider` → `TooltipProvider` → `ToastProvider` → `RouterProvider`.
A later phase adds `ServicesProvider` (the `CourtServices` instance) and a
wallet provider between Toast and Router.

### Motion preference

`index.html` sets `<html data-reduced-motion>` before first paint from
`localStorage['cc:motion']` and the OS setting. `MotionProvider` keeps it in
sync (OS changes, user override). `tokens.css` collapses every
`--cc-duration-*` to `0ms` under it, and loop animations (spinner, skeleton,
spotlight, caret, urgent timer) switch off.

---

## 6. Quality gates

```bash
npm run tokens -- --check   # tokens.css matches tokens.ts
npm run lint                # ESLint incl. jsx-a11y strict
npm run typecheck           # tsc -b over core, web, node configs
npm test                    # vitest: core (node) + web (jsdom, axe)
npm run build               # vite production build
npm run check               # all of the above, in that order
```

The contrast of every semantic text/UI pair is a unit test on both surfaces
(parchment and wood), so a palette change that breaks WCAG AA fails CI rather
than a user. Colours are restricted to the 30 style-guide swatches
(docs/STYLE-GUIDE.md); a test rejects raw colours outside the token layer.

---

## 7. What this phase does not do

- No contracts, no 0G calls, no World ID, no wallet. The ports are defined; the
  adapters and their mocks arrive in later phases.
- No case data: pages render the decided rules and constants only.
- No server. If one becomes necessary (e.g. salt backup, moderation queue), it
  gets its own port first.
