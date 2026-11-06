# CringeCourt audio

Package: `packages/audio` (`@cringe-court/audio`). Every sound is **synthesised live with
Web Audio** from code in `packages/audio/src/recipes/`. There are no audio files to load,
license or cache. The `.ogg` files in `packages/audio/renders/` are listening copies made
by `npm run render` from the same code. They are dedicated to the public domain (CC0),
and the app never loads them.

- [Cue list](#cue-list)
- [Wiring it into the app](#wiring-it-into-the-app)
- [Case events → sound](#case-events--sound)
- [Ambience bed](#ambience-bed)
- [Settings, Reduce sound and persistence](#settings-reduce-sound-and-persistence)
- [How it is built](#how-it-is-built)
- [Verification](#verification)
- [Known limits](#known-limits)

## Cue list

`CueId` is a string union, so a typo is a type error. Ids use snake_case to match
`cc-art/dist/animation/animations.json`.

**Reduced** shows what the cue does under *Reduce sound*:

- `play`: plays unchanged.
- `soften`: plays 6 dB quieter, with intensity capped at 0.5.
- `skip`: not played.

**Dry length** is the cue before the reverb tail. **RMS** is from the 44.1 kHz render at
unity volume, measured over the render including its tail. Use it to compare cues with
each other, not as a loudness standard.

| Cue | Group | What it is / when to use | Dry length | Reduced | RMS dBFS |
|---|---|---|---|---|---|
| `gavel_strike` | Gavel | One wooden strike on the sound block, with the hall answering. Calls the court to order. | 0.25 s | soften | −29.6 |
| `gavel_triple` | Gavel | Three strikes, the last one hardest. For "ORDER!" and for silencing a rowdy gallery. | 0.95 s | soften | −27.8 |
| `objection` | Drama | A whoosh into a brass stab and a body hit. Plays under the OBJECTION! callout. | 0.8 s | soften | −26.9 |
| `crowd_murmur` | Gallery | The gallery whispers among itself, swells and settles. | 2.75 s | skip | −27.9 |
| `crowd_laugh` | Gallery | A ripple of laughter from a dozen voices that dies out. | 3.15 s | skip | −28.4 |
| `crowd_gasp` | Gallery | A sharp collective inhale and a stunned murmur. | 1.7 s | skip | −28.9 |
| `crowd_applause` | Gallery | A short burst of clapping that thins out. | 3 s | skip | −30.9 |
| `verdict_guilty` | Verdicts | Gavel, timpani, then a short-short-long brass phrase that ends on a dark chord. | 2.8 s | soften | −20.9 |
| `verdict_not_cooked` | Verdicts | Gavel, then a rising bell arpeggio over a warm major chord and a cymbal swell. | 2.8 s | soften | −24.2 |
| `verdict_decided` | Verdicts | Gavel and a two-chord (IV→I) fanfare that takes no side. For Versus verdicts. | 2.8 s | soften | −22.6 |
| `verdict_none` | Verdicts | A muted "wah-wah" brass line that sags downward. For NO VERDICT / MISTRIAL. | 2.25 s | soften | −23.4 |
| `vote_tick` | Jury & ballots | A marimba tick; `step` climbs a pentatonic scale as votes are counted. | 0.43 s | play | −29.8 |
| `ballot_seal` | Jury & ballots | Paper slides in, the lid drops, the latch clicks. Commit; carries no vote information. | 0.57 s | play | −28.5 |
| `ballot_unlock` | Jury & ballots | A key turns, the seal gives, a soft chime. Reveal; also the `unlock` animation sound. | 1.15 s | play | −35.9 |
| `timer_warning` | Deadlines | Two soft rising pulses when a deadline enters its warning window. | 0.47 s | play | −32.5 |
| `timer_tick` | Deadlines | One clock tick for the final seconds; `intensity` makes it brighter. | 0.07 s | soften | −41.6 |
| `timer_expired` | Deadlines | A low buzzer under a bell: the deadline passed. | 1.16 s | soften | −24.4 |
| `stamp` | Foley | A rubber stamp thumps onto paper. CHARGES FILED, case accepted, receipts. | 0.18 s | play | −29.0 |
| `paper` | Foley | A short rustle of papers. Statements, exhibits, ballots rising. | 0.5 s | play | −35.8 |
| `coin` | Foley | A coin drops and bounces. Bond posted, payout, refund. | 0.99 s | play | −30.4 |
| `door_creak` | Foley | The heavy courtroom door creaks open and settles. | 1.54 s | skip | −26.5 |
| `ui_click` | Interface | A soft, short tick for buttons and taps. | 0.04 s | play | −40.8 |
| `ui_hover` | Interface | A barely-there tick on hover. Use it only for pointer devices. | 0.03 s | skip | −59.2 |
| `ui_toggle` | Interface | Two quick ticks; `step` 1 = on (rises), 0 = off (falls). | 0.09 s | play | −40.3 |
| `ui_toast` | Interface | A two-note glass chime for neutral notifications. | 0.7 s | play | −34.7 |
| `ui_confirm` | Interface | Three rising marimba notes: a transaction landed. | 0.57 s | play | −30.2 |
| `ui_error` | Interface | Two falling, muffled notes. Never harsh. | 0.31 s | play | −34.1 |

Every cue also has a polyphony limit and a minimum repeat interval in `src/cues.ts`, so
hover spam and double clicks cannot pile up. The big stings duck the ambience bed while
they play.

## Wiring it into the app

### 1. One engine per page

```ts
// apps/web/src/audio.ts
import { createAudioEngine } from '@cringe-court/audio';

export const audio = createAudioEngine({
  onError: import.meta.env.DEV ? (e, where) => console.warn('[audio]', where, e) : undefined,
});
audio.attachUnlock(); // the first pointerdown / keydown / touchend unlocks audio
```

The engine is safe to construct during SSR or in tests. With no `AudioContext` it reports
`state: 'unavailable'` and every call is a no-op. It never creates an `AudioContext`
before a user gesture, because browsers would block it and log warnings.

Behaviour:

- `play()` returns `null` while the engine is locked, muted, skipped by Reduce sound or
  rate-limited. Fire and forget; there is no need to check the result.
- Errors from Web Audio go to `onError`. Sound can never throw into the UI.
- While the tab is hidden, the engine suspends the context and resumes it when the tab
  comes back.
- On Safari 16.4+, it sets `navigator.audioSession.type = 'ambient'`. CringeCourt then
  mixes with the player's music and respects the ringer switch.

### 2. A settings panel with `useSyncExternalStore`

```tsx
import { useSyncExternalStore } from 'react';
import { audio } from '@/audio';

export function useAudio() {
  return useSyncExternalStore(audio.subscribe, audio.getSnapshot, audio.getSnapshot);
}

function SoundSettings() {
  const { settings, reduced, state } = useAudio();
  return (
    <>
      <Slider label="Master" value={settings.master} onChange={(v) => audio.setVolume('master', v)} />
      <Slider label="Effects" value={settings.sfx} onChange={(v) => audio.setVolume('sfx', v)} />
      <Slider label="Courtroom ambience" value={settings.music} onChange={(v) => audio.setVolume('music', v)} />
      <Switch label="Mute" checked={settings.muted} onCheckedChange={(m) => audio.setMuted(m)} />
      <Switch label="Reduce sound" checked={reduced} onCheckedChange={(r) => audio.setReduceSound(r ? 'reduced' : 'full')} />
    </>
  );
}
```

`getSnapshot()` returns the same object until something changes, as React requires.

The app shell already has its own Reduce-motion toggle (`MotionProvider`, `cc:motion`).
To make "Reduce motion" also reduce sound, feed it the effective value:
`useEffect(() => audio.setSystemReduced(reduced), [reduced])`. The player can still
override this with `setReduceSound('full' | 'reduced')`.

### 3. Design-system sounds

| Component / interaction | Call |
|---|---|
| `Button` press | `audio.play('ui_click')` on `pointerdown` (not on `click`, so the sound lands on the touch) |
| Pointer hover on primary actions | `audio.play('ui_hover')`, only when `event.pointerType === 'mouse'` |
| `Switch` | `audio.play('ui_toggle', { step: next ? 1 : 0 })` |
| `Toast` (info) | `audio.play('ui_toast')` |
| `Toast` / `Alert` (error) | `audio.play('ui_error')` |
| Wallet tx confirmed / failed | `audio.handle({ type: 'tx.confirmed' })` / `{ type: 'tx.failed' }` |
| `Countdown` | once per second: `audio.handle({ type: 'deadline.tick', secondsLeft })` |

### 4. Animation timelines

`animations.json` steps carry `sound` labels (`door_creak`, `stamp`, `coin`, `paper`,
`unlock`, `gavel`). When a step fires:

```ts
import { cueForAnimationSound } from '@cringe-court/audio';
const cue = step.sound && cueForAnimationSound(step.sound, animationName);
if (cue) audio.play(cue);
```

The `gavel` step of `verdict_guilty` and `verdict_not_cooked` maps to the whole verdict
sting. The sting starts with that gavel on beat 0, so the gavel does not play twice.
`test/events.test.ts` reads the real `animations.json` and fails if a new label has no
cue.

## Case events → sound

The app reports *what happened*, and `audio.handle(event)` decides what it sounds like.
The mapping is the pure function `cuesForEvent`, which is unit-tested.

`CourtPhase` is a structural copy of `CasePhase` from `@cringe-court/core`, so the two are
assignable to each other.

| Event | Sound | Ambience |
|---|---|---|
| `phase.entered` `draft` | — | off |
| `phase.entered` `pre-trial` | `gavel_strike` | session |
| `phase.entered` `recruiting` / `preparing` | — | lobby |
| `phase.entered` `commit` | `paper` (soft) | deliberation |
| `phase.entered` `reveal` | — | deliberation |
| `phase.entered` `finalizing` | — | verdict (held breath) |
| `phase.entered` `settled` | — | lobby |
| `phase.entered` `cancelled` | `stamp` (soft) | off |
| `court.entered` | `door_creak` | |
| `case.stamped` | `stamp` | |
| `hearing.opened` | `gavel_strike` | session |
| `order` | `gavel_triple` | |
| `statement.started { by }` | `paper`, panned to the bench (prosecution / Side A left, defense / Side B right) | |
| `objection { by }` | `objection` (panned), then `crowd_murmur` at +0.7 s | |
| `crowd { reaction }` | `crowd_murmur` / `crowd_laugh` / `crowd_gasp` / `crowd_applause` | |
| `teaser.jury-out` (D3 "THE JURY IS OUT") | `gavel_strike`, `crowd_murmur` at +0.4 s | lobby |
| `juror.seated { index }` | `vote_tick`, step = 2 × index | |
| `bond.posted` | `coin` | |
| `ballot.committed` | `ballot_seal`, identical for every vote | |
| `ballot.revealed` | `ballot_unlock` | |
| `vote.counted { index }` | `vote_tick`, step = index (rising scale) | |
| `deadline.tick { secondsLeft, warnAt = 30 }` | `timer_warning` at `warnAt`; `timer_tick` for 10…1 with rising intensity; `timer_expired` at 0 | |
| `verdict.read guilty` | `verdict_guilty`, `crowd_gasp` at +0.95 s | lobby |
| `verdict.read not-cooked` | `verdict_not_cooked`, `crowd_applause` at +1.1 s | lobby |
| `verdict.read side-a` / `side-b` | `verdict_decided`, softer applause at +1.4 s | lobby |
| `verdict.read no-verdict` | `verdict_none`, `crowd_murmur` at +1.6 s | lobby |
| `settlement payout` / `refund` | `coin` ×2 | |
| `settlement forfeit` | `ui_error` | |
| `tx.confirmed` / `tx.failed` | `ui_confirm` / `ui_error` | |

**By mode.** All three modes use the same events. Two cases need care:

- **Versus** (Mode 2): read `side-a` / `side-b`. Both people are listening, so the sting
  is the neutral `verdict_decided`.
- **Grand Jury** (Mode 3): the gallery is the point. Fire `crowd` reactions from
  aggregated spectator reactions, throttled. The cue limits stop overlap.

**Privacy.** `ballot.committed` must sound the same for every vote. If it did not, the
sound would leak the ballot before reveal (see ANIMATION-GUIDE §6). The test suite pins
this.

## Ambience bed

`audio.setAmbience(preset)` crossfades over about 2.5 s between these presets:

| Preset | Room tone | Gallery murmur | Tension drone | Clock | Incidentals |
|---|---|---|---|---|---|
| `lobby` | ● | full, bright | — | — | frequent |
| `session` | ● | hushed | — | — | rare |
| `deliberation` | ● | near silent | ● | ● soft wall clock | very rare |
| `verdict` | ● | — | ● low | — | — |
| `off` | | | | | |

Incidentals are coughs, chair creaks, footsteps and shuffled papers. Layers run
continuously, and presets only move their levels. Talkers and incidentals are scheduled
four seconds ahead from a 1 s timer.

The bed is on the **music** bus (the "Ambience" slider). It stops while the engine is
muted, under Reduce sound, or with the music slider at 0, and restarts when allowed. A
preset set while the engine is locked is remembered and starts on unlock.

## Settings, Reduce sound and persistence

```ts
interface AudioSettings {
  master: number; sfx: number; music: number; // slider positions 0..1
  muted: boolean;
  reduceSound: 'system' | 'reduced' | 'full'; // system = follow prefers-reduced-motion
}
```

**Defaults:** master 0.8, sfx 0.9, music 0.7, unmuted, `system`.

**Volume curve.** Sliders map to decibels over a 48 dB range (`sliderToGain`): 1 → 0 dB,
0.5 → −24 dB, 0 → silence. The middle of the slider sounds like the middle.

**Persistence hook.** The engine takes a `SettingsStore`:

```ts
interface SettingsStore { load(): unknown; save(s: AudioSettings): void }
```

The default is `localStorageStore()` (key `cc:audio`, versioned JSON). The engine falls
back to `memoryStore()` when localStorage is unavailable. To sync settings to an account,
pass your own store. Loaded data is validated with `normalizeSettings`, and a store that
throws is reported to `onError` and ignored.

**Reduce sound** (`reduced === true`):

- skips crowd sounds, hover and the door;
- softens gavels, stings and the timer;
- turns off the ambience bed and music ducking;
- keeps every informative cue (clicks, ticks, ballots, coins, errors).

## How it is built

```
src/
  cues.ts         CueId union + per-cue mix spec (gain, reverb, length, voices, rate limit, reduced)
  dsp.ts          seeded RNG, noise buffers, courtroom impulse response, Synth voice builder
  recipes/        instruments (gavel, brass, timpani, marimba, bells) and one recipe per cue
  mixer.ts        buses (sfx, music) each with reverb → master → 35 Hz rumble filter → limiter
  ambience.ts     the courtroom bed
  events.ts       case events → cues, animation sound labels → cues
  engine.ts       AudioEngine (unlock, settings, voices, ambience, visibility, dispose)
  render.ts       offline rendering through the same graph, analysis, WAV encoding
```

The synthesis techniques:

- **Gavel:** modal synthesis of a hardwood block, plus contact noise and a low knock.
- **Crowd:** voices are a glottal sawtooth with breath noise through three formant
  filters that glide between vowel targets at syllable rate. Laughs are aspirated "ha"
  pulses. Gasps are noise through a rising resonance.
- **Applause:** written sample by sample into a buffer (hundreds of resonant clap bursts).
  This avoids creating hundreds of nodes.
- **Room:** every bus shares one synthetic stereo impulse response (1.9 s, darkening
  tail).

## Verification

Run these from `packages/audio`:

| Command | What it proves |
|---|---|
| `npm test` | Mocked-AudioContext unit tests. The mock throws where browsers throw (exponential ramp to 0, non-finite values, negative times, double `start`). The suite covers every cue at three intensities and three steps, plus the engine, events, settings and animation labels. It also renders every cue for real with `node-web-audio-api` and checks the samples: finite, peak below −0.5 dBFS, audible, on time, decays; deterministic per seed; pitch rises with `step`; ambience presets. |
| `npm run typecheck` | Strict TypeScript, using the app shell's compiler options |
| `npm run render` / `render:check` | Writes `renders/*.ogg` plus `manifest.json` with SHA-256 hashes of the PCM. `render:check` re-renders and fails on any drift. |
| `npm run browser-check` | Builds the demo, opens it in headless Chrome and plays every cue through the browser's own Web Audio. It measures the signal at the destination with an analyser tap and fails on any engine or console error. |
| `npm run demo` | The Sound Stage: every cue, the mixer, Reduce sound, ambience presets, and a scripted Mode 1 trial driven through `engine.handle()` with a live log |

## Known limits

- **Nobody has listened to these sounds yet.** Sound design was checked with
  spectrograms, level measurements and the tests above. It needs a listening pass on real
  speakers and headphones before launch, especially the crowd voices and the door creak,
  which are the hardest to synthesise convincingly.
- **Not tested on real devices.** iOS Safari unlock, `audioSession` and Firefox have not
  been run; only headless Chrome and node-web-audio-api have.
- **Render hashes are platform-specific.** Renders are deterministic on one machine and
  renderer version. Other platforms may differ in the last bits of floating point, so
  `render:check` is a same-environment drift check.
- **No music.** The "music" bus carries the ambience bed. A score could later live on the
  same bus.
