# @cringe-court/audio

Procedural Web Audio for CringeCourt: 27 typed cues, a courtroom ambience bed, and a case-event → sound map. No audio files.

```ts
import { createAudioEngine } from '@cringe-court/audio';
const audio = createAudioEngine();
audio.attachUnlock();                                     // first gesture unlocks
audio.play('gavel_strike');
audio.handle({ type: 'verdict.read', outcome: 'guilty' }); // sting + gasp + ambience
```

Docs: [`docs/AUDIO.md`](../../docs/AUDIO.md) (cue list, wiring, event mapping, settings, verification).

| Script | |
|---|---|
| `npm test` | unit tests (mock AudioContext) + real renders (node-web-audio-api) |
| `npm run typecheck` | strict TS |
| `npm run demo` | Sound Stage demo page (vite) |
| `npm run browser-check` | demo self-test in headless Chrome |
| `npm run render` / `render:check` | CC0 listening renders + hash manifest / drift check |

Dev note: `node-web-audio-api` 2.x is used for offline rendering (1.0.x has a sawtooth-automation bug that blew up the crowd voices); its `engines` says Node ≥ 22 but it installs and passes on Node 20.19 here.
