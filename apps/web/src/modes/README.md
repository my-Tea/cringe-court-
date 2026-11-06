# Game modes in the web app

Each mode track owns one folder here and one package:

| Mode | Web folder | Package |
|---|---|---|
| Solo | `apps/web/src/modes/solo/` | `packages/modes-solo` (`@cringe-court/modes-solo`) |
| Versus | `apps/web/src/modes/versus/` | `packages/modes-versus` |
| Grand Jury | `apps/web/src/modes/grand-jury/` | `packages/modes-grand-jury` |

The folder's `mode.ts`/`mode.tsx` default-exports a `WebModeModule`
(`registry.ts`): the mode's `ModeDefinition` (rules, benches, staging, terms;
start from `BASE_MODES[id]` with `extendMode()` from `@cringe-court/core`) and
the child routes mounted under `/<mode id>/`. `registry.ts` finds the folder
with `import.meta.glob`, so adding a mode never edits the router or any other
shared file. The mode's landing page stays at `/<mode id>`.

The engine (`@cringe-court/engine`) runs any registered definition; mode code
never branches on another mode's id. Ports come from `@cringe-court/core`; tests
use `@cringe-court/core/testing` (`createMockPorts()`).
