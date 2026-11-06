# Accessibility audit (WCAG 2.2 AA)

Audited on 2026-11-03/04 on branch `v3/polish`, against the production build of
`main` at e2dc50a (integration merged) plus this branch. Scope: every route, all
three modes end to end, the first-person roaming courtroom and its classic-stage
fallback, and phone, tablet and desktop widths.

**Bottom line.** Before this pass, axe found 3 rule failures across the app, and the
real-browser walkthrough found a WCAG 2.1.2 keyboard trap (the first-person
courtroom swallowed Tab), plus 2 overflow and 2 target-size problems. All of these
are fixed. After the fixes:

- A sweep of 20 routes at 5 widths (320, 360, 390, 820 and 1440 px) finds 0 axe
  violations (WCAG 2.0/2.1/2.2 A and AA plus best practice, contrast included).
- Nothing scrolls sideways and the console logs no errors.
- A keyboard-only walkthrough of every mode completes at 1280 px, and at 390 px
  with reduced motion.

## Method

| Check | Tool | Where |
|---|---|---|
| Rules (names, roles, ARIA, landmarks, headings, contrast, target size, scrollable regions) | axe-core 4 in headless Chrome, tags `wcag2a/aa`, `wcag21a/aa`, `wcag22aa`, `best-practice` | `tools/a11y/sweep.mjs`: every route × 390/820/1440 px (and 320/360 px for reflow), screenshots reviewed |
| Keyboard-only flows | Playwright driving **only** Tab, Shift+Tab, arrows, Enter, Space, Esc, W/E | `tools/a11y/kbflow.mjs`: Solo, Versus (three personas) and Grand Jury, at 1280 px and at 390 px with reduced motion |
| Tab order and focus visibility | first 40 Tab stops per route: accessible name, visible ring, element size | `sweep.mjs`, `tabseq.mjs`; suspect rings checked in cropped screenshots |
| Reflow (1.4.10) | horizontal overflow at 320 px, which equals 1280 px at 400 % zoom | `sweep.mjs` with `VIEWS` |
| Component a11y | vitest-axe in jsdom (existing suites in every mode, plus ds tests) | `npm test` |
| Contrast of hard-wired paper pairs | WCAG ratio unit tests | `ds/papercraft.test.ts`, `ds/tokens.test.ts` |
| Copy reaches the accessibility tree from the catalog | pseudo-locale render of 17 routes | `i18n/pseudoRender.test.tsx` |

## Findings and fixes

| # | WCAG | Severity | Where | Problem | Fix |
|---|---|---|---|---|---|
| 1 | 2.1.2 No keyboard trap | **Critical** | First-person courtroom, all 3 modes | The room bound Tab to "skip a line" and called `preventDefault`, so a keyboard user who tabbed in could never tab out (seen live: 27 Tab presses stayed on `role=application`). | `Tab` is never bound. Skip a line is now `X`, and the legend reads "X skip a line · Tab leave the room · Esc pause". Regression test in `scene/roam/__tests__/logic.test.ts`. `docs/ROAM.md` updated. |
| 2 | 2.5.3 Label in name | Serious | Header brand link, every page | `aria-label="CringeCourt home"` while the SVG wordmark draws "CRINGECOURT" three times (extrude, outline, face). | No aria-label. The name comes from visually hidden text, and the logo SVG is `aria-hidden`. |
| 3 | 2.1.1 Keyboard | Serious | Grand Jury hearing transcript | Scrollable `<ol>` with no focusable content, so keyboard users could not scroll it. | `tabIndex=0` plus its existing label. |
| 4 | 1.4.3 Contrast | Serious | Roam bar ghost buttons (Skip beat, Replay, Full screen) | Cream-on-cream (1.06:1) when the parchment surface rules won over the local colour. | The bar is `data-surface="wood"`, so ghost buttons take the light ink by role. |
| 5 | 2.5.3 Label in name | Serious | Touch controls (Pause "II", Hop "⤒", Interact "✋") | The glyph text did not match the `aria-label`. | Glyphs are wrapped in `aria-hidden` spans. |
| 6 | 2.5.8 Target size | Serious | Roam controls legend at tablet width | The legend ran past the bottom of the room, which clipped "Hide controls" to 17 px. | The legend scrolls inside the room (`max-height`, `overflow:auto`). |
| 7 | 2.5.8 Target size | Serious | Landing header at 320 px | The "Enter court" button sat on top of the How-to-play tab. | The header button is hidden at 22.5rem and below. The court tab and the big "Enter the court" plate remain. |
| 8 | 1.4.10 Reflow | Moderate | Settings → Connections terms table at 390 px | The table pushed the page 23 px sideways. | It is a focusable, labelled scroll region, with tighter cells on phones. |
| 9 | 1.4.10 Reflow | Moderate | Leaderboard (and any hero ribbon) at 390 px | Ribbon tails made the page scroll 9 px sideways. | `<main>` uses `overflow-x: clip`. Decoration can never cause sideways scroll, and sticky still works. |
| 10 | 1.4.4 / 1.4.10 | Minor (visual) | Hero ribbons on phones ("HOW / TO / PLAY") | One word per line at 390 px. | The ribbon steps down a size on phones. |
| 11 | 3.3.2 Labels | Minor (consistency) | Mixed forms (Solo confession, Versus new case) | Two label styles in one form. | `Field` labels use the paper label style. Copy is unchanged. |

Things that were checked and found correct, so not changed:

- **Focus after navigation.** Client-side route changes move focus to `<main>`,
  so screen readers start at the new page (existing test in `app.test.tsx`).
  The new page-enter animation does not remount, so focus is unaffected.
- **Focus after a failed submit.** Submitting the Solo filing with errors moves
  focus to the error summary, which links each error (confirmed in the
  keyboard-only run).
- **Dialogs.** Radix dialogs (menu sheet, confirmations) and the roam pause and
  exhibit dialogs trap Tab, take focus on open and return it on close. Esc opened
  the pause dialog in all six keyboard runs.
- **Focus visibility.** One ring for the product: deep teal on parchment, gold on
  wood. Paper fields ring the whole strip (`:focus-within`), and card links ring the
  whole card (`::after`). The sweep's early "no ring" flags were all one of these
  two patterns, or a 120 ms transition caught mid-way, and were confirmed visually.
- **Names.** Across 40 Tab stops on every route at two widths, 0 focusable
  elements had no accessible name.
- **Live regions.** These announce politely: the Grand Jury hearing feed while it
  plays, docket result counts, the roam HUD, the Versus briefing chat, the case
  header, and the counsel, jury and verdict panels. Countdown timers are labelled but
  not live, so they do not chatter every second.
- **Reduced motion.** It follows the system setting by default, and users can
  override it from the header, the footer, Settings or the roam pause menu. See
  `docs/STYLE-GUIDE.md` §9.11 for what it switches off.
- **Language.** `<html lang>` follows the active locale.

## Keyboard-only walkthroughs (all pass)

Each run reaches every control by Tab or arrows and activates it with Enter or Space.

- **Solo:** /solo → File a confession → submit empty (focus goes to the error
  summary) → category radio, Use the example, private notes → File → Ask Counsel
  Chaos, pick an angle radio, add an exhibit → Watch the free teaser → Approve and
  send → Freeze the transcript → Pay 1.20 → **first-person trial** → jury → verdict
  → Download PNG → docket.
- **Versus:** three tabs. A files the case and gets an invite. B joins and briefs.
  Both approve the brief and the draft, and both pay their half. The juror posts a
  bond. A seats simulated jurors. The juror watches the **first-person trial**, seals
  and opens the Secret Verdict Scroll. A reaches the verdict and the case list.
- **Grand Jury:** docket filter → case → Summon with 1.00 → seat 107 (World ID mock,
  swear in) → **first-person trial** → seal ballot → reveal → settle → collect → My court.
- **Roaming courtroom, in every mode:**
  - Enter the room through "Use keyboard only".
  - Walk with W, turn with ←. The rendered frame changed in every run.
  - Interact with E. Esc opens the pause dialog and Esc closes it.
  - **Classic stage** switches the view (`data-view=classic`), and **First person**
    switches it back.
  - Tab leaves the room.

## Not verified

- Real screen readers (NVDA, JAWS, VoiceOver, TalkBack). Names, roles and live
  regions were checked through axe and the DOM, not by listening.
- Safari and Firefox, real phones and tablets, and Windows High Contrast. A
  `forced-colors` CSS path exists but was not exercised.
- 3D canvas content (the roaming room and the voxel stage) is drawn, not DOM. It has
  text equivalents: the zone and prompt live region, the transcript and the classic
  stage. Contrast inside the 3D scene was not measured.
- Speech-input and switch-control users beyond what 2.5.3 and the keyboard paths imply.
- Text-spacing overrides (1.4.12) and 200 % text-only zoom were not run separately.
  Reflow was checked at 320 px.

## Re-running

See `tools/a11y/README.md`. `npm test` covers the unit-level parts in CI:
vitest-axe suites, contrast pairs, motion tokens, catalog and pseudo-locale, and
the keyboard-trap regression.
