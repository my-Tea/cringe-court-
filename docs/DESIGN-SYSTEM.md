# CringeCourt — Design System

Live catalogue: run the app and open **`/gallery`** (every token, component and
state, with surface and reduced-motion toggles). Code: `apps/web/src/ds/`.

## 1. Grounding

The art bible settles the look: *"the courtroom is the brand, the village is the
exception"* — **neon-noir voxel** everywhere, with 2D pixel UI art. The design
system takes its values from the generated art, not from a new palette:

| Source | What the UI takes from it |
|---|---|
| `cc-art/brand-kit.mjs` | night `#140E1A`, night-lt `#2A1636`, neon `#FF4FB8`, purple `#6B4CA8`, cream `#FFF6E4`, gold `#D9A046` / `#F6C75B`; the neon-rim + gold-corner share-card frame |
| `cc-art/ui-kit.mjs` | parchment `#FFF8EC`, ink `#3A2A24`, burgundy `#6E1B2A`, GUILTY red `#C0392B`, NOT COOKED green `#3E7F50`; buttons with a hard bottom edge; dialogue box (burgundy frame, gold rule) |
| `cc-art/vox-chars.mjs` | Side A teal `#3FB8C9`, Side B orange `#F08A3C` |
| `cc-art/pixel-font.mjs`, voxel wordmark | the pixel display face (Pixelify Sans) |
| `cc-art/dist/characters/*` | portraits (64/128 px) and poses used in states, stages and dialogue |
| `cc-art/dist/ui/icon_*` | domain icons (accuse, bond, commit, reveal, refund, slashed …) |
| V4 §5, §13 | stamps, OBJECTION!/LET BRO COOK impacts, deadline widget, typewriter dialogue, receipts, "Secret Verdict Scroll" naming |

## 2. Tokens

`src/ds/tokens.ts` is the single source of truth; `npm run tokens` writes
`src/ds/tokens.css` (`--cc-*` custom properties) and `--check` fails CI if it is
stale. Components read only CSS variables.

| Group | Tokens |
|---|---|
| Palette | `night` 950–200, `neon` 800–200, `purple`, `gold`, `cream`, `ink`, `burgundy`, `red`, `green`, `teal`, `orange` |
| Semantic colour (41 roles) | canvas, surface(-raised/-sunken), scrim, text(-muted/-subtle), border(-strong), accent(+hover/pressed/shadow/text/on-), secondary, highlight, danger, success/warning/info text+surface, focus, guilty, not-cooked, side-a, side-b, disabled |
| Surfaces | `night` (default) and `parchment`. `data-surface="parchment"` on any element re-maps every role for that subtree; components need no variants |
| Type | display / body / mono families; scale `2xs`–`5xl` (1.25 ratio, fluid `3xl`+); weights; leading; tracking |
| Space | 4 px grid: `space-0` … `space-24` (keys are steps: `space-4` = 16 px) |
| Radius | `none, xs 2, sm 4, md 8, lg 12, xl 18, pill` — small radii keep the pixel edge |
| Control height | `sm 32, md 44, lg 52` px (44 px default meets touch-target guidance) |
| Elevation | `shadow-0…4` (top highlight + drop: light, not shadow, on a dark stage), `glow-accent/highlight/danger`, button `press` edges |
| Motion | durations `instant 0, fast 120, base 200, slow 320, slower 480, dramatic 720` ms; easings `standard, enter, exit, emphasized, stamp (overshoot), pixel (steps)` |
| Layers | `base, raised, sticky, overlay, modal, toast, tooltip` |
| Breakpoints | `sm 640, md 768, lg 1024, xl 1280` (literals in media queries) |

## 3. Components

| Component | Notes |
|---|---|
| `Button`, `ButtonLink`, `IconButton`, `buttonClassName` | primary / secondary / ghost / danger / **swear** (gold, only for committing money or duty); sm/md/lg; icons; `loading` keeps width + `aria-busy`; `disabled` → `aria-disabled` (stays focusable, click swallowed) |
| `Icon` | 21 pixel glyphs defined as 12×12 ASCII grids, one crisp SVG path each |
| `Card` + Header/Title/Description/Body/Footer | default, raised, neon (brand frame), parchment, sunken; `interactive` lifts and glows, `data-card-link` makes the whole card one link |
| `TextField`, `TextArea`, `Select`, `Checkbox`, `Switch`, `RadioCards` | visible labels; hint + error via `aria-describedby`; error has an icon; soft length limit with live counter (D2's 140 chars); native select and radios; radio cards with verdict/side tones |
| `Dialog` (+ sheet variant) | Radix: focus trap & return, Escape, scroll lock; title required; danger tone; footer stacks on phones |
| `ToastProvider` / `useToast` | Radix live region (F8), pause on hover/focus, swipe; errors are assertive and stay 10 s; `verdict` tone |
| `Tabs` | Radix; underline and pills |
| `Tooltip` | Radix; hover + focus; never the only copy of important info |
| `Alert` | info / success / warning / danger; opt-in `polite` / `assertive` announcement |
| `Badge`, `TestnetBadge` | tinted/solid, dot, pulse; testnet badge is hazard-striped and explains itself to screen readers |
| `Skeleton`, `SkeletonText`, `Spinner` | shimmer and four-block pixel spinner; both stop under reduced motion |
| `EmptyState`, `LoadingState`, `ErrorState` | the cast reacts (clerk, narrator, shocked judge); retry + collapsible technical details |
| `Portrait`, `AnonymousPortrait` | voxel busts, crisp scaling, rings per side; the defendant is always a silhouette |
| `Stamp` | GUILTY / NOT COOKED / MISTRIAL / CHARGES FILED / CASE # / SIDE A/B; live text; slam animation |
| `ImpactText` | OBJECTION! / LET BRO COOK / ORDER! / COUNTER! starbursts |
| `Countdown` | deadline widget: big tabular time, draining bar, calm → soon → urgent → ended, `role="timer"` with a spoken label, shows the fixed deadline |
| `Amount` | exact test-USDC (`Usdc` bigint), tabular, credit/debit signs, spoken "test USDC" |
| `PhaseStepper` | ordered list, `aria-current="step"`, collapses to the current label on phones |
| `DialogueBox` | parchment visual-novel box, speaker plate, typewriter + skip; screen readers get the full line at once |
| `Receipt` | torn-paper settlement slip from `ReceiptLine[]`, net total, explorer link |

## 4. Accessibility rules

- **Contrast:** `contrastPairs` in `tokens.ts` lists every text/UI pairing; a unit
  test enforces WCAG 2.1 AA (4.5:1 text, 3:1 UI/large) on **both** surfaces.
- **Focus:** one ring for the product (2 px gold on night, plum on parchment, 2–3 px
  offset), only on `:focus-visible`; `forced-colors` falls back to `Highlight`.
- **Semantics first:** native elements wherever they exist; Radix only for
  dialog, tabs, toast, tooltip. Icon-only buttons require a `label`.
- **Status is never colour alone:** errors have an icon and text, steps say
  "(done)", money says "plus/minus … test USDC".
- **Live regions are deliberate:** toasts, opt-in alerts, loading states and the
  near-limit character counter announce; countdowns do not tick aloud.
- **Navigation:** skip link, focus moves to `<main>` after route changes,
  landmarks (`header`, `nav` ×2 labelled, `main`, `footer`).
- **Lint:** `eslint-plugin-jsx-a11y` strict; **tests:** axe on representative renders.

## 5. Motion rules

- Use duration/easing tokens, never literal times, so reduced motion works everywhere.
- Reduced motion = the OS setting unless the user overrides it (header menu,
  footer, gallery). It collapses durations to 0 ms and stops loops; state changes
  still happen.
- "Dramatic" (720 ms, overshoot) is reserved for verdict-grade beats: stamps,
  impacts, verdict cards.

## 6. Adding a component

1. `src/ds/components/Name/Name.tsx` + `Name.module.css` + `Name.test.tsx`.
2. Read only `--cc-*` variables; use semantic roles, not palette steps, unless
   the colour is part of the art (e.g. burgundy frames).
3. Export from `src/ds/index.ts`; add a specimen to `/gallery` covering every
   variant and state.
4. If it introduces a new text/background pairing, add it to `contrastPairs`.
