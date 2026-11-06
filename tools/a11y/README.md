# Accessibility and responsive audit harness

Real-browser checks behind [docs/A11Y-AUDIT.md](../../docs/A11Y-AUDIT.md). They drive a
production build in headless Chrome and **never click**: every control is reached
with Tab / Shift+Tab / arrows and activated with Enter or Space.

Needs `playwright-core` (not a repo dependency, so `npm install` stays lean) and Chrome:

```sh
npm run build
npx vite preview --outDir apps/web/dist --port 4800 --strictPort &   # from apps/web
npm i --no-save playwright-core                                      # once, in a scratch dir is fine
node tools/a11y/sweep.mjs  http://localhost:4800 /tmp/sweep          # every route × 390/820/1440: axe (WCAG 2.2 AA + best practice, incl. contrast), sideways overflow, 40-stop tab order, screenshots
node tools/a11y/kbflow.mjs http://localhost:4800 /tmp/kb solo 1280   # keyboard-only Solo: file → brief → teaser → pay → first-person trial (walk, interact, pause, classic toggle) → verdict → share → docket
node tools/a11y/kbflow.mjs http://localhost:4800 /tmp/kb versus 390  # three personas (A, B, juror) end to end
RM=1 node tools/a11y/kbflow.mjs http://localhost:4800 /tmp/kb gj 390 # Grand Jury with reduced motion: fund → seat → trial → seal → reveal → settle → collect
node tools/a11y/tabseq.mjs http://localhost:4800 /grand-jury/case/107 45   # print a page's tab order
```

Set `CHROME=/path/to/chrome` if Chrome is elsewhere. Each kbflow run prints a JSON log
(steps, roam walk/pause/toggle results, axe hits per state, console errors).
