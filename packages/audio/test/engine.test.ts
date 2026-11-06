import { describe, expect, it, vi } from 'vitest';
import { AudioEngine, type AudioEngineOptions } from '../src/engine.ts';
import { CUES } from '../src/cues.ts';
import { dbToGain, memoryStore } from '../src/settings.ts';
import type { MockParam } from './mock-audio-context.ts';
import { FakeMedia, FakeTarget, FakeTimers, MockAudioContext, asAudioContext } from './mock-audio-context.ts';

function setup(opts: Partial<AudioEngineOptions> & { reducedOS?: boolean } = {}) {
  const contexts: MockAudioContext[] = [];
  const timers = new FakeTimers();
  const doc = new FakeTarget();
  const media = new FakeMedia(opts.reducedOS ?? false);
  const store = memoryStore();
  const onError = vi.fn();
  const engine = new AudioEngine({
    createContext: () => {
      const c = new MockAudioContext();
      contexts.push(c);
      return asAudioContext(c);
    },
    store,
    timers,
    document: doc as unknown as Document,
    matchMedia: () => media,
    seed: 1,
    onError,
    ...opts,
  });
  return { engine, contexts, timers, doc, media, store, onError, ctx: () => contexts[0]! };
}

/** The voice-level gain node a cue was played through (first node created for it). */
function voiceLevel(ctx: MockAudioContext, from: number): MockParam {
  const node = ctx.created[from] as unknown as { gain: MockParam };
  return node.gain;
}

describe('without Web Audio (SSR, tests, old browsers)', () => {
  it('is a quiet no-op that still keeps settings', async () => {
    const store = memoryStore();
    const e = new AudioEngine({ createContext: null, store, document: null, matchMedia: null });
    expect(e.state).toBe('unavailable');
    expect(e.play('gavel_strike')).toBeNull();
    expect(e.handle({ type: 'verdict.read', outcome: 'guilty' })).toEqual([]);
    await expect(e.unlock()).resolves.toBe(false);
    e.setAmbience('lobby');
    e.setVolume('music', 0.3);
    expect(store.saved?.music).toBe(0.3);
    expect(e.attachUnlock(new FakeTarget())).toBeTypeOf('function');
    e.dispose();
    expect(e.state).toBe('disposed');
  });

  it('detects the absence of AudioContext on globalThis by default', () => {
    const e = new AudioEngine({ store: memoryStore(), document: null, matchMedia: null });
    expect(e.state).toBe('unavailable'); // Node has no AudioContext
  });
});

describe('unlocking', () => {
  it('creates no AudioContext until the first gesture', async () => {
    const { engine, contexts } = setup();
    expect(engine.state).toBe('locked');
    expect(engine.play('ui_click')).toBeNull();
    expect(contexts).toHaveLength(0);
    await expect(engine.unlock()).resolves.toBe(true);
    expect(contexts).toHaveLength(1);
    expect(engine.state).toBe('running');
    await engine.unlock();
    expect(contexts).toHaveLength(1);
  });

  it('unlocks from the first pointer/key/touch and then removes its listeners', async () => {
    const { engine } = setup();
    const target = new FakeTarget();
    engine.attachUnlock(target);
    expect(target.count('pointerdown')).toBe(1);
    expect(target.count('keydown')).toBe(1);
    expect(target.count('touchend')).toBe(1);
    target.dispatch('keydown');
    await vi.waitFor(() => expect(engine.state).toBe('running'));
    await vi.waitFor(() => expect(target.count()).toBe(0));
  });

  it('stays locked (and keeps listening) when the browser refuses to resume', async () => {
    const contexts: MockAudioContext[] = [];
    const e = new AudioEngine({
      createContext: () => {
        const c = new MockAudioContext();
        c.blockResume = true;
        contexts.push(c);
        return asAudioContext(c);
      },
      store: memoryStore(),
      document: null,
      matchMedia: null,
      timers: new FakeTimers(),
    });
    const target = new FakeTarget();
    e.attachUnlock(target);
    target.dispatch('pointerdown');
    await expect(e.unlock()).resolves.toBe(false);
    expect(e.state).toBe('locked');
    expect(target.count()).toBe(3);
    contexts[0]!.blockResume = false;
    await expect(e.unlock()).resolves.toBe(true);
  });
});

describe('playing', () => {
  it('plays through the mixer to the destination', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    const h = engine.play('gavel_strike');
    expect(h?.cue).toBe('gavel_strike');
    expect(ctx().sources().filter((s) => s.kind === 'oscillator').length).toBeGreaterThan(0);
    for (const s of ctx().sources()) expect(ctx().reaches(s)).toBe(true);
  });

  it('returns null when muted or when master/sfx is at zero', async () => {
    const { engine } = setup();
    await engine.unlock();
    engine.setMuted(true);
    expect(engine.play('stamp')).toBeNull();
    engine.setMuted(false);
    engine.setVolume('sfx', 0);
    expect(engine.play('stamp')).toBeNull();
    engine.setVolume('sfx', 1);
    engine.setVolume('master', 0);
    expect(engine.play('stamp')).toBeNull();
    engine.setVolume('master', 1);
    expect(engine.play('stamp')).not.toBeNull();
  });

  it('rate-limits rapid repeats per cue', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    expect(engine.play('ui_hover')).not.toBeNull();
    expect(engine.play('ui_hover')).toBeNull();
    expect(engine.play('ui_click')).not.toBeNull(); // other cues are unaffected
    ctx().currentTime += CUES.ui_hover.minIntervalMs / 1000 + 0.01;
    expect(engine.play('ui_hover')).not.toBeNull();
  });

  it('steals the oldest voice when a cue exceeds its polyphony', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    const first = ctx().created.length;
    engine.play('verdict_guilty'); // maxVoices 1
    ctx().currentTime = 2;
    const firstSources = ctx().sources().filter((s) => ctx().created.indexOf(s) >= first);
    expect(engine.play('verdict_guilty')).not.toBeNull();
    for (const s of firstSources) expect(s.stoppedAt!).toBeLessThanOrEqual(2.05);
  });

  it('clamps bad options instead of throwing', async () => {
    const { engine, onError } = setup();
    await engine.unlock();
    expect(engine.play('vote_tick', { intensity: Number.NaN, pan: 9, delay: -3, step: 1e9 })).not.toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('never throws when Web Audio does; reports to onError instead', async () => {
    const { engine, ctx, onError } = setup();
    await engine.unlock();
    (ctx() as unknown as { createOscillator: () => never }).createOscillator = () => {
      throw new Error('boom');
    };
    expect(engine.play('ui_click')).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'play:ui_click');
  });

  it('disconnects finished voices after their tail', async () => {
    const { engine, ctx, timers } = setup();
    await engine.unlock();
    const from = ctx().created.length;
    engine.play('ui_click');
    const nodes = ctx().created.slice(from);
    expect(nodes.every((n) => n.disconnected === 0)).toBe(true);
    timers.advance(5000);
    expect(nodes.every((n) => n.disconnected > 0)).toBe(true);
  });

  it('handle() plays the mapped cues for a case event', async () => {
    const { engine } = setup();
    await engine.unlock();
    const handles = engine.handle({ type: 'verdict.read', outcome: 'guilty' });
    expect(handles.map((h) => h.cue)).toEqual(['verdict_guilty', 'crowd_gasp']);
    expect(engine.getSnapshot().ambience).toBe('lobby');
  });
});

describe('Reduce sound', () => {
  it('follows prefers-reduced-motion by default: skips decorative cues, softens stings', async () => {
    const { engine, ctx } = setup({ reducedOS: true });
    await engine.unlock();
    expect(engine.getSnapshot().reduced).toBe(true);
    expect(engine.play('crowd_laugh')).toBeNull();
    expect(engine.play('ui_hover')).toBeNull();
    const from = ctx().created.length;
    expect(engine.play('gavel_strike')).not.toBeNull();
    expect(voiceLevel(ctx(), from).value).toBeCloseTo(dbToGain(CUES.gavel_strike.gainDb - 6), 6);
    const from2 = ctx().created.length;
    expect(engine.play('ui_click')).not.toBeNull();
    expect(voiceLevel(ctx(), from2).value).toBeCloseTo(dbToGain(CUES.ui_click.gainDb), 6);
  });

  it('lets the player override the OS either way, and tracks OS changes live', async () => {
    const { engine, media } = setup({ reducedOS: false });
    const seen: boolean[] = [];
    engine.subscribe(() => seen.push(engine.getSnapshot().reduced));
    media.set(true);
    expect(engine.getSnapshot().reduced).toBe(true);
    engine.setReduceSound('full');
    expect(engine.getSnapshot().reduced).toBe(false);
    media.set(false);
    engine.setReduceSound('reduced');
    expect(engine.getSnapshot().reduced).toBe(true);
    engine.setReduceSound('system');
    expect(engine.getSnapshot().reduced).toBe(false);
    expect(seen).toEqual([true, false, true, false]); // the OS change under 'full' is not a change
  });

  it('accepts the app’s own effective motion setting', () => {
    const { engine } = setup();
    engine.setSystemReduced(true);
    expect(engine.getSnapshot().reduced).toBe(true);
  });
});

describe('settings and persistence', () => {
  it('loads saved settings and saves every change', () => {
    const store = memoryStore({ master: 0.4, muted: true });
    const { engine } = setup({ store });
    expect(engine.settings.master).toBe(0.4);
    expect(engine.settings.muted).toBe(true);
    engine.toggleMuted();
    expect(store.saved?.muted).toBe(false);
    engine.setVolume('music', 2);
    expect(store.saved?.music).toBe(1);
  });

  it('survives a store that throws', () => {
    const onError = vi.fn();
    const { engine } = setup({
      onError,
      store: {
        load: () => {
          throw new Error('denied');
        },
        save: () => {
          throw new Error('quota');
        },
      },
    });
    expect(engine.settings.master).toBe(0.8);
    engine.setVolume('sfx', 0.5);
    expect(engine.settings.sfx).toBe(0.5);
    expect(onError.mock.calls.map((c) => c[1])).toEqual(['settings.load', 'settings.save']);
  });

  it('applies volumes to the bus gains with the perceptual curve', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    engine.setVolume('master', 0.5);
    const master = ctx().created.find((n) => n.kind === 'gain' && n.outputs.some((o) => 'kind' in o && o.kind === 'biquad')) as unknown as { gain: MockParam };
    const target = master.gain.events.filter((e) => e.kind === 'target').at(-1);
    expect(target?.value).toBeCloseTo(dbToGain(-24), 6);
    engine.setMuted(true);
    expect(master.gain.events.filter((e) => e.kind === 'target').at(-1)?.value).toBe(0);
  });

  it('gives useSyncExternalStore a stable snapshot', () => {
    const { engine } = setup();
    const a = engine.getSnapshot();
    expect(engine.getSnapshot()).toBe(a);
    engine.setVolume('sfx', engine.settings.sfx); // no change
    expect(engine.getSnapshot()).toBe(a);
    const cb = vi.fn();
    const off = engine.subscribe(cb);
    engine.setVolume('sfx', 0.2);
    expect(engine.getSnapshot()).not.toBe(a);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    engine.setVolume('sfx', 0.3);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('ambience', () => {
  it('remembers the preset while locked and starts it on unlock', async () => {
    const { engine, timers, ctx } = setup();
    engine.setAmbience('lobby');
    expect(timers.intervals).toBe(0);
    await engine.unlock();
    expect(timers.intervals).toBe(1);
    const sourcesBefore = ctx().sources().length;
    expect(sourcesBefore).toBeGreaterThan(5);
    timers.advance(3000); // keeps scheduling ahead without creating new long-lived sources
    expect(engine.getSnapshot().ambience).toBe('lobby');
  });

  it('stops the bed when muted, reduced or at zero music volume, and resumes after', async () => {
    const { engine, timers } = setup();
    await engine.unlock();
    engine.setAmbience('session');
    expect(timers.intervals).toBe(1);
    engine.setMuted(true);
    expect(timers.intervals).toBe(0);
    engine.setMuted(false);
    expect(timers.intervals).toBe(1);
    engine.setReduceSound('reduced');
    expect(timers.intervals).toBe(0);
    engine.setReduceSound('full');
    engine.setVolume('music', 0);
    expect(timers.intervals).toBe(0);
    engine.setVolume('music', 0.5);
    expect(timers.intervals).toBe(1);
    engine.setAmbience('off');
    expect(timers.intervals).toBe(0);
  });

  it('ducks the bed under big stings', async () => {
    const { engine, ctx } = setup();
    await engine.unlock();
    engine.play('verdict_guilty');
    const duck = ctx().created.filter((n) => n.kind === 'gain').map((n) => (n as unknown as { gain: MockParam }).gain)
      .find((p) => p.events.some((e) => e.kind === 'target' && Math.abs(e.value - dbToGain(-14)) < 1e-9));
    expect(duck).toBeDefined();
  });
});

describe('page visibility and teardown', () => {
  it('suspends while hidden and resumes when visible', async () => {
    const { engine, doc, ctx } = setup();
    await engine.unlock();
    doc.visibilityState = 'hidden';
    doc.dispatch('visibilitychange');
    await vi.waitFor(() => expect(engine.state).toBe('suspended'));
    expect(engine.play('ui_click')).toBeNull();
    doc.visibilityState = 'visible';
    doc.dispatch('visibilitychange');
    await vi.waitFor(() => expect(engine.state).toBe('running'));
    expect(ctx().calls).toEqual(['resume', 'suspend', 'resume']);
  });

  it('dispose() closes the context and removes every listener and timer', async () => {
    const { engine, doc, media, timers, ctx } = setup();
    await engine.unlock();
    engine.setAmbience('lobby');
    engine.play('gavel_triple');
    engine.dispose();
    expect(ctx().state).toBe('closed');
    expect(doc.count('visibilitychange')).toBe(0);
    expect(media.listenerCount).toBe(0);
    expect(timers.pending.size).toBe(0);
    expect(engine.play('ui_click')).toBeNull();
    await expect(engine.unlock()).resolves.toBe(false);
  });
});
