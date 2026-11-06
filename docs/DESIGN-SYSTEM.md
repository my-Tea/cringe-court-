# CringeCourt — Design System

> **Visual identity: see [`docs/STYLE-GUIDE.md`](STYLE-GUIDE.md) (canonical).**
> The night / neon-noir / parchment palette this document originally described
> is **void** (superseded 2026-11-03 by the CringeCourt pixel-art style guide,
> `docs/assets/style-guide.png`). STYLE-GUIDE.md §8 lists exactly which parts of
> this file it replaces; the sections below have been updated to match.

Live catalogue: run the app and open **`/gallery`** (every token, component and
state, with surface and reduced-motion toggles). Code: `apps/web/src/ds/`.

## 1. Grounding

~~Neon-noir voxel everywhere, with values taken from the brand-kit, UI-kit and
vox-chars colours.~~ **Void.** The identity is now the style guide: warm
parchment surfaces, deep maroon and gold, teal for secondary/info, greens for
success, blues for sky; rounded ornate frames, pixel-art feel, an isometric
courthouse with a red carpet and gold scale banners. All 30 colours, the rules
and the measured pairings are in [`STYLE-GUIDE.md`](STYLE-GUIDE.md).

Still taken from the art pipeline:

| Source | What the UI takes from it |
|---|---|
| `docs/assets/style-guide.png` | palette, frames, round icon tiles, typography direction; interim courthouse / colonnade crops (`apps/web/scripts/gen-guide-art.py`) |
| `cc-art/dist/characters/*` | portraits (64/128 px) and poses used in states, stages and dialogue |
| `cc-art/dist/ui/icon_*` | domain icons (accuse, bond, commit, reveal, refund, slashed …), recoloured to the style guide |
| V4 §5, §13 | stamps, OBJECTION!/LET BRO COOK impacts, deadline widget, typewriter dialogue, receipts, "Secret Verdict Scroll" naming |

## 2. Tokens

`src/ds/tokens.ts` is the single source of truth; `npm run tokens` writes
`src/ds/tokens.css` (`--cc-*` custom properties) and `--check` fails CI if it is
stale. Components read only CSS variables.

| Group | Tokens |
|---|---|
| Palette | the 30 style-guide swatches: `royal`, `teal`, `gold`, `neutral`, `green`, `blue`, steps 900/700/500/300/100 (STYLE-GUIDE.md §1) |
| Semantic colour (46 roles) | canvas, surface(-raised/-sunken), scrim, text(-muted/-subtle), border(-strong), frame(-light/-dark), accent(+hover/pressed/shadow/text/on-), secondary, highlight, danger, success/warning/info text+surface, focus, guilty, not-cooked, side-a, side-b, sky(-light), disabled |
| Surfaces | `parchment` (default, on `:root`) and `wood` (deep maroon-and-wood). `data-surface="wood"` on any element re-maps every role for that subtree; components need no variants |
| Type | display (Fraunces, soft serif) / pixel (Pixelify Sans) / body (Space Grotesk) / mono families; scale `2xs`–`5xl` (1.25 ratio, fluid `3xl`+); weights; leading; tracking |
| Space | 4 px grid: `space-0` … `space-24` (keys are steps: `space-4` = 16 px) |
| Radius | `none, xs 2, sm 4, md 8, lg 12, xl 18, 2xl 28, pill` — rounded like the style-guide frames and tiles |
| Control height | `sm 32, md 44, lg 52` px (44 px default meets touch-target guidance) |
| Elevation | `shadow-0…4` (warm ink-brown drop with a hard pixel edge; gold top light on wood), `ring-accent/highlight/danger` (gold ornate rims), `bevel` (tile edge), button `press` edges |
| Motion | durations `instant 0, fast 120, base 200, slow 320, slower 480, dramatic 720` ms; easings `standard, enter, exit, emphasized, stamp (overshoot), pixel (steps)` |
| Layers | `base, raised, sticky, overlay, modal, toast, tooltip` |
| Breakpoints | `sm 640, md 768, lg 1024, xl 1280` (literals in media queries) |

## 3. Components

| Component | Notes |
|---|---|
| `Button`, `ButtonLink`, `IconButton`, `buttonClassName` | primary / secondary / ghost / danger / **swear** (gold, only for committing money or duty); sm/md/lg; icons; `loading` keeps width + `aria-busy`; `disabled` → `aria-disabled` (stays focusable, click swallowed) |
| `Icon` | 25 pixel glyphs (incl. the style-guide scales, document, gear, star) defined as 12×12 ASCII grids, one crisp SVG path each |
| `RoundIconButton`, `RoundIconLink`, `RoundIconTile` | the style guide's round ornate icon tiles: maroon (or gold) face, gold rim, pixel glyph; label required; `pressed` toggle; tile variant for captioned links |
| `OrnateFrame`, `OrnateCorners` | the parchment frame: gold double rule, pixel corner knots, optional maroon ribbon title; `tone` parchment / wood |
| `Card` + Header/Title/Description/Body/Footer | default, raised, ornate (style-guide frame), parchment (frame + maroon top rule), sunken; `interactive` lifts, `data-card-link` makes the whole card one link |
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
  Measured ratios: STYLE-GUIDE.md §4.
- **Palette only:** tests reject any role or generated variable that is not a
  style-guide colour, and any raw hex / `rgb()` / `hsl()` in components, pages,
  the shell or the gallery.
- **Focus:** one ring for the product (2 px deep teal on parchment, gold on wood, 2–3 px
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
   the colour is part of the art (e.g. gold frame bands, maroon ribbons).
3. Export from `src/ds/index.ts`; add a specimen to `/gallery` covering every
   variant and state.
4. If it introduces a new text/background pairing, add it to `contrastPairs`.
