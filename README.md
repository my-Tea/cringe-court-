# cringe-court

**CringeCourt** — a comedy courtroom where AI lawyers argue and a verified human
jury decides. Three modes: Solo (you + your AI vs an NPC AI), Versus (two people,
one AI each) and Grand Jury (a public question anyone can join). Testnet only.

## Run the app

Requires Node ≥ 20.19.

```bash
npm install
npm run dev          # http://localhost:5173  (design gallery at /gallery)
npm run check        # tokens up to date, lint, typecheck, tests, production build
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev server, production build, serve the build |
| `npm test` | Vitest: `packages/core` (node) + `apps/web` (jsdom, Testing Library, axe) |
| `npm run lint` | ESLint (typescript-eslint, react-hooks, jsx-a11y strict) |
| `npm run typecheck` | `tsc -b` over every package |
| `npm run tokens` | regenerate `apps/web/src/ds/tokens.css` from `tokens.ts` (`-- --check` to verify) |
| `npm run art:build` | regenerate all art in `cc-art/` (see `cc-art/build-all.mjs`) |

## Layout

- `apps/web` — Vite + React + TypeScript app: shell, pages, the design system (`src/ds`) and `/gallery`.
- `packages/core` — shared domain types, mode constants (from `docs/DECISIONS.md`) and adapter ports.
- `cc-art` — the art pipeline and generated assets the app imports directly.
- `docs` — [architecture](docs/ARCHITECTURE.md), [design system](docs/DESIGN-SYSTEM.md),
  [decisions](docs/DECISIONS.md), [game modes](docs/GAME-MODES.md), [economics](docs/ECONOMICS.md).
