# Roam — the first-person courtroom

Walk the courtroom as the person on trial, in the same voxel art as the rest of
CringeCourt: Minecraft-style blocks, nearest-neighbour pixel textures, a
low-res render upscaled crisp. The world is bounded: a lobby, the courtroom
doors and the courtroom itself. You can't climb furniture, fly or leave.

- **Sandbox:** `/court/walk` (nav: *Walk the court*). It has a trial-beats panel,
  "jump to" buttons, a quality selector and three mocked remote players.
- **Packages:** `@cringe-court/scene/roam` (headless logic and the three.js
  renderer) and `@cringe-court/scene/roam/react` (the `<RoamCourtroom>` component and HUD).

Screenshots live outside the repo, in `~/cringe-court-v3/screenshots/roam/`.
`packages/scene/scripts/roam-shots/` regenerates them (see *Screenshots* below).

## Architecture

```
courtroom.boxes.json ──► world/courtroom.ts  adapt the cutaway into a closed room
cast.json (cc-art)   ──► world/lobby.ts      a second, bounded room outside the doors
                         world/dressing.ts   evidence table + EXHIBIT A/B/C, stained glass, chair, plant, globe
                         world/index.ts      buildRoamWorld(): boxes → solids, rooms, zones, seats,
                                             spawns, interactables, NPC placements, cinematic marks
                                   │
                                   ▼
             RoamController (controller.ts)  headless: fixed-step physics, input, focus, seats,
             ├─ physics.ts   AABB body       dialogue, exhibits, beats, NPC heads, remotes, events
             ├─ input.ts     keys/touch/pad
             ├─ interact.ts  ray + cone focus
             ├─ beats.ts     beat scripts + BeatRunner state machine
             ├─ npc.ts       head tracking
             ├─ remote.ts    RemotePlayerFeed, interpolation, MockRemotePlayers
             ├─ quality.ts   presets + AutoQuality
             └─ audio.ts     feature-detected sound hook
                                   │ view(), npcStates, remotes, focusId, mood (read-only)
                                   ▼
             RoamRenderer (three/)           merged world batches, rigged voxel avatars,
                                             focus outline, mood lighting, shadow budget
                                   │
                                   ▼
             <RoamCourtroom> (react/)        R3F canvas at pixel resolution + HUD
```

All the logic is pure and runs in node. The renderer only reads from the
controller and never writes back. The HUD re-renders only when
`controller.onChange` fires (zone, focus, dialogue, beat, pause and so on),
never once per frame.

### World

- **Derived collision.** Collision is computed from the art, so it follows any
  regenerated courtroom. Boxes at carpet height (top ≤ 2.7) are ground. The dais
  and the boxes buried in it are walkable surfaces (step-up 9). Every other box
  below head height becomes a full-height barrier, so you walk around pews and
  desks and never onto them. Boxes starting above head height are decoration.
  A few invisible barriers keep the judge's platform and the jury box staff-only.
  Each room's bounds are a last line of defence: a step can never end outside
  their union.
- **Fixes to the cutaway, applied as region filters plus added boxes:**
  - Walls, ceiling and coffers are added.
  - The doors are opened. The crest and the wainscot strip that sealed the doorway are removed.
  - The gallery pews are turned to face the bench.
  - The centre pews are removed, so the aisle is real.
  - The railing gate swings into the aisle.
  - The witness stand is moved out from under the judge's bench (nobody could stand in it) onto the dais step, and its aisle-side panel is opened.
- **Palette.** Every in-world colour is one of the 30 swatches
  (`palette.ts`: the STYLE-GUIDE §7 remap, then a hand table, then nearest in
  CIE Lab). A test enforces it. HUD overlays use the `--cc-*` design tokens.

### Player and physics

The player is a square footprint (radius 4.5, height 50, eye 44), moved one
axis at a time against the solids with no tunnelling. The step-up is 9, so the
dais step works. A hop is ≈ 9.6 units: a hop, never flight. Physics runs on a
fixed 60 Hz step (`FixedStepper`, catch-up capped at 8 steps), so the same input
gives the same path at 30, 60 or 144 fps. The camera interpolates between steps.

## Controls

| Action | Keyboard | Mouse | Touch | Gamepad |
| --- | --- | --- | --- | --- |
| Walk / strafe | `W A S D`, `↑ ↓` | — | left joystick (floating) | left stick |
| Turn | `← →` (and `Q`) | look (pointer lock) | drag on the right half | right stick |
| Look up / down | `R F` or `PgUp PgDn` | look | drag | right stick |
| Run | `Shift` | — | push the stick past its ring | L3 |
| Hop | `Space` | — | `⤒` | A |
| Interact / continue | `E` or `Enter` | — | `✋` | X |
| Skip a line | `Tab` | — | `✋` | — |
| Pause / release mouse | `Esc` or `P` | — | `II` | Start |

- **Click to capture the mouse.** `Esc` releases it, and losing the lock opens the
  pause menu. The first screen also offers **Use keyboard only**, because arrows
  can turn and walk without a mouse.
- **The control legend** shows by default on desktop and starts hidden on phones.
- **Skip to menu view** (top right and in the pause menu) calls `onExit`. The
  sandbox uses it to switch to the existing non-roam 3D courtroom view, which
  has a "Back to walking" button that takes focus.
- **Focus management.** The room is one focusable `role="application"` element.
  The pause menu and exhibit panel are modal dialogs that trap Tab, take focus
  on open and give it back to the room on close.
- **Reduced motion.** `prefers-reduced-motion` is followed live (or set
  explicitly, or toggled in the pause menu). It turns off head-bob, screen
  shake, the gavel flash, typewriter text (lines show at once), the callout pop
  and idle sway. Cinematic camera moves cut instead of easing.

## API

```ts
import { RoamController, buildRoamWorld, loadRoamData, MockRemotePlayers, type RemotePlayerFeed } from '@cringe-court/scene/roam';
import { RoamCourtroom, useRoamCourtroom } from '@cringe-court/scene/roam/react';
```

**`useRoamCourtroom(options)`** loads the world and makes one controller. It returns
`{ status: 'loading' | 'ready' | 'error', controller, data, error }`.
Options are the controller options plus `fetcher`.

**`new RoamController(world, options)`**. The options are:

- `reducedMotion`
- `audio`: anything with `play(cue)`, see *Audio*
- `id`, `avatar`, `role`
- `spawn`: a `SpawnId` or `{ pos, yaw, pitch }`
- `remotes`: a `RemotePlayerFeed`
- `now`: a clock for `PlayerState.t`

| Member | What it does |
| --- | --- |
| `update(dt)` | Advance (the component calls it every frame). |
| `runBeat(id, { lines?, verdict?, verdictText? })` | Play a scripted beat; resolves when it ends, is skipped or is replaced. |
| `skipBeat()` | Jump to the beat's end state. |
| `sit(seatId)`, `stand()`, `teleport(spawn)`, `setMood(mood)`, `setPaused(b)`, `setReducedMotion(b)` | Direct control. |
| `keyDown(code, repeat)`, `keyUp(code)`, `look(dYaw, dPitch)`, `setExternalInput(source, { intent, turn, tilt })`, `interact()`, `jump()`, `advanceDialogue()`, `closeExhibit()` | Input. |
| `subscribe(fn)` | Typed `RoamEvent`s: `focus`, `interact`, `zone`, `seat`, `dialogue`, `exhibit`, `beat-start`, `beat-end`, `gavel`, `cue`, `mood`, `callout`, `pause`. |
| `onChange(fn)` + `snapshot()` | HUD state (`RoamSnapshot`). |
| `playerState()` | The networkable `PlayerState`. |
| `view()`, `npcStates`, `remotes`, `focusId`, `mood`, `control`, `seat` | Per-frame reads for renderers. |

**`<RoamCourtroom controller data … />`** props:

- `quality`, `onQualityChange`, `autoQuality` (default on), `pixelated` (default on)
- `touch` (`'auto'` follows `(pointer: coarse)` and the first touch)
- `onExit` (shows "Skip to menu view")
- `label`, `className`, `style`
- `children`: your own overlay, drawn above the HUD
- `onRenderer`

Seats: `defendant`, `witness`, `gallery-left`, `gallery-right`, `lobby-bench`.
Spawns: `lobby`, `doorway`, `aisle`, `well`, `defendant`, `witness`,
`jury-view`, `bench-front`.

### Interactables

The focus rule: a ray from the eye that hits an interactable's hull wins, nearest
first. Otherwise the best-aligned item inside a 0.3 rad cone wins. Range is
measured eye to target. The focused item gets a pulsing gold outline and a prompt
("E: Take the stand"). There are 27 interactables:

- **Seats:** Take the stand, Sit at defendant's table, the gallery pews, the lobby bench.
- **Talk:** Approach the bench, plus every counsel, bailiff, juror and spectator.
- **Exhibits A, B and C:** open a paper exhibit card.
- **Inspect:** the locked street doors, the sunglasses bust, globes, the docket board, the desk bell, the ballot box.

NPC barks cycle without repeats (`dialogue.ts`), with the judge's sunglasses jokes.

### Beats

Every beat begins the same way: `control → cinematic`, then auto-seat at the
defendant's table. The camera eases to whoever is speaking, the beat runs, and
control comes back as `look` (seated; move or press `E` to stand).

| Beat | What happens |
| --- | --- |
| `all-rise` | The defendant rises, the bailiff's "ALL RISE!", a gavel, the judge: "Be seated. The sunglasses stay on…" |
| `opening` | Spotlight mood; the judge, the prosecution, then the defence. |
| `counsel-arguing` | Tense mood; an OBJECTION! callout and stinger; the judge says "Order!" with the gavel. |
| `jury-deliberating` | A JURY IS OUT callout; jurors talk among themselves; murmur. |
| `verdict` | The defendant stands. The verdict mood (guilty / acquitted / mistrial) and a verdict callout (custom text via `verdictText`). Jurors and gallery react (cheer, shock, facepalm). You get free look to watch them. |

- **The gavel** shakes the screen (not with reduced motion), flashes the lights
  and emits `gavel` plus the `sfx.gavel` cue.
- **`lines`** replaces the built-in dialogue: each speaker change adds a camera
  look, which is where modes feed AI counsel output.
- **`BeatRunner`** is the pure state machine (idle → running → done | skipped).
  It runs instant steps in the same frame, waits for timed steps and for each
  line, and `skip()` lands in the final state without the lines, sounds or callouts.

### Audio

Sound is feature-detected and never a hard dependency. `options.audio` takes either:

- the **core `AudioPort`** (dotted cue ids, passes straight through), or
- the **`@cringe-court/audio` engine** (snake_case ids, mapped by `ENGINE_CUES`
  via `audioFromEngine`).

Anything without a callable `play` is ignored. Every cue is also emitted as a
`cue` event. The sandbox passes `createAudioEngine()` and unlocks it on the
first gesture.

### Multiplayer-ready (no network)

`PlayerState` (`id, avatar, role, pos, yaw, pitch, seat, speed, t`) is what Mode 2
(two people) and Mode 3 (public jury gallery) transports should send.
`RemotePlayerFeed` is the transport seam:

- `subscribe(samples)`, plus optional `onLeave` and `tick` (`tick` is for mocks).
- `RemoteInterpolator` renders remotes 120 ms behind, interpolating and never
  extrapolating, and drops out-of-order samples.
- Remote players appear as walking voxel avatars (their `avatar.model` from
  `cast.json`), and NPC heads turn toward them as well as toward you.
- `MockRemotePlayers` (10 Hz samples, walk loops tested against collision) runs
  in the sandbox: a Side B visitor in the aisle and a Side A visitor and a
  grand juror in the lobby.

## How a mode adopts it

```tsx
import { MockRemotePlayers, type BeatId } from '@cringe-court/scene/roam';
import { RoamCourtroom, useRoamCourtroom } from '@cringe-court/scene/roam/react';

export function SoloRoamStage({ audio, onMenuView }: { audio: unknown; onMenuView: () => void }) {
  // Mode 2/3: pass your transport's RemotePlayerFeed instead of the mock.
  const roam = useRoamCourtroom({ audio, spawn: 'lobby', avatar: { model: 'creator', name: 'You' }, role: 'defendant' });

  // Drive beats from the engine's phases; feed AI counsel lines in.
  const onPhase = (beat: BeatId, lines?: { speaker: string; text: string }[]) =>
    roam.controller?.runBeat(beat, { lines, verdict: 'guilty' });

  if (roam.status === 'error') return <p role="alert">{roam.error.message}</p>;
  if (roam.status !== 'ready') return <p>Building the courtroom…</p>;
  return (
    <div style={{ aspectRatio: '16 / 9' }}>
      <RoamCourtroom controller={roam.controller} data={roam.data} onExit={onMenuView} />
    </div>
  );
}
```

Speaker ids for `lines` are `judge`, `prosecutor`, `defense`, `bailiff`,
`clerk`, `juror-1`…`juror-3`, `player`, or `narrator` (no camera move).
Publishing your own player: call `controller.playerState()` at your send rate.

## Performance

- **Static world:** 2,421 boxes in 25 merged batches (≈ 29k triangles), each
  with world-space UVs on one shared 16×16 pixel grid (`TEXEL = 2` units).
  Minecraft face shading is baked into vertex colours; Lambert lighting sits on top.
  Nothing static is re-uploaded.
- **Cast:** 12 NPCs, each a four-node rig (body, head, two arms). Geometry is
  cached per model and posture, with one shared material.
- **Pixel render:** the canvas drawing buffer itself is the low-res target (DPR
  = `pixelHeight / cssHeight`: 200 / 270 / 360 lines for low / medium / high),
  upscaled with `image-rendering: pixelated`. There is no extra full-screen pass.
  With pixels off, DPR is capped per preset (1 / 1.5 / 2).
- **Shadow budget:** a single shadow-casting key light (high 2048², medium 1024²,
  low none), plus 2 / 4 / 8 point lights and a shorter far plane and fog on
  low. Frustum culling uses per-batch bounding spheres.
- **Auto-downgrade:** `AutoQuality` (EMA frame time, 2 s warm-up, 3 s of frames
  over 20 ms) steps down one level and never back up, so it can't oscillate.
  The pause menu says when it happened.
- **Shadow toggles:** quality changes only toggle the light's `castShadow`; the
  renderer's shadow map stays enabled. Toggling `renderer.shadowMap.enabled` at
  runtime left un-recompiled materials and rendered a blank frame in testing.

## Tests

55 tests in `packages/scene/src/roam/__tests__`:

- **World and collision, on the real generated world:**
  - palette-only colours;
  - the reference cast and props;
  - every spawn and seat exit is free;
  - walking lobby → doorway → aisle → well;
  - climbing the dais and reaching every seat exit on foot;
  - furniture blocks (table, pew, desk);
  - you can't leave through walls, the locked street doors or into the jury box,
    even sprint-hopping for 20 s;
  - hops stay hops.
- **Movement math:** walk and sprint speeds, the strafe sign, diagonal
  normalisation, friction, no tunnelling at huge dt, step-up limits,
  frame-rate independence, and the catch-up cap.
- **Focus selection:** ray versus cone, range, slab test, and the real stand and exhibit.
- **Beat runner:** instant and timed steps, waiting on lines, skip, script
  structure, and mode lines.
- **Input mapping:** keys with no auto-repeat on triggers, joystick dead zone,
  rim and sprint, look signs and clamp, gamepad, intent merge.
- **NPC heads** and **remote interpolation**; the mock walkers' paths are
  checked against collision.
- **Quality:** presets, auto-downgrade, warm-up and spike handling.
- **Audio detection.**
- **Controller:** seat and stand, exhibits freeze movement, beats seat you and
  lock the camera then hand back, verdict reactions with free look, skip and
  replace resolve, reduced motion (zero bob and shake, instant text), pause.
- **Renderer, in node (no GL):** batching, nearest-only textures, NPC avatars,
  the quality switches, the focus outline.
- **HUD, in jsdom:** prompts, legend, "Skip to menu view", screen-reader dialogue,
  pause-menu focus and settings, the exhibit dialog, touch joystick and buttons.

## Screenshots

These were taken in headless Chrome with SwiftShader WebGL
(`--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`),
driving the real page through `window.__roam` (`/court/walk?debug&auto=0&quality=high`):

- the lobby entrance, the aisle and the defendant's table;
- the opening (looking at the judge), the witness stand and the jury box;
- an exhibit close-up and two verdict moments;
- the 390×844 mobile controls;
- `roam-walk-sheet.png`: a 12-frame scripted walk, driven by holding `W` and
  steering, from the lobby to the defendant's chair.

To regenerate: start the dev server on `:5191`, then run
`PLAYWRIGHT_CORE=…/playwright-core/index.mjs node packages/scene/scripts/roam-shots/shoot.mjs`
and `node packages/scene/scripts/roam-shots/sheet.mjs` (`OUT` sets the output directory).

## Known limitations

- **Frame rate on real GPUs has not been measured.** Every render check ran on
  SwiftShader, which is a software rasteriser. It is slow enough that
  AutoQuality drops to *low* within seconds, which is why the screenshots
  disable it. The 60 fps target rests on the budget above, not on a measurement.
- **The jury box seats three, like the existing staging.** The art's box is too
  narrow for two tiers, so Grand Jury's seven jurors still need a layout decision.
- **Chibi characters are big next to the room.** Courtroom props were built for
  60-unit people and the cast stands 48, so some framings crowd the view.
  Counsel staging was tuned so they never block the judge or jury sightlines
  from the defendant's table.
- **NPC poses are procedural.** Arm and head swings stand in for the sprite
  animation library: talk, gavel, point, cheer, shock and facepalm. Seated NPCs'
  shins sink slightly into the pews.
- **No network.** `RemotePlayerFeed` is the seam; only the mock exists.
  Remote avatars are not solid.
- **The decorative doors are fixed boxes.** The courtroom doors stand open;
  the street doors are locked by design, and trying them only gives a bark.
- **Pointer lock in iframes or headless browsers** may be refused. The
  component falls back to keyboard turning and never throws.
