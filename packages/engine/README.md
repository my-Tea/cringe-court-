# @cringe-court/engine

Runs a trial through the ports and performs it on stage.

- `TrialEngine`: one case over `AiCounselPort` + `ChainPort`, using the core
  state machine; mirrors the ledger (`sync()`, `tick()`).
- `JurorSession`: World ID screen → bond → sealed commit → reveal → claim.
- `directTrial()` and the ceremony directors: transcript / verdict → `Show`.
- `ShowPlayer`: performs a `Show` through `ScenePort` + `AudioPort`; pause,
  next line, speed, abort.

See [`docs/ENGINE.md`](../../docs/ENGINE.md) §5 and the demo court
(`apps/web/src/stage/demoCourt.ts`) for a complete wiring.
