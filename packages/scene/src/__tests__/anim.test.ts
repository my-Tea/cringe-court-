import { describe, expect, it } from 'vitest';
import {
  AnimationLibraryError,
  CharacterAnimator,
  SystemTimeline,
  crossedKeyframes,
  missingPoses,
  parseAnimationLibrary,
  sampleAnimation,
  type TrackAnimation,
} from '../index';
import { rawAnimations, realData } from './fixtures';

function seq(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('animations.json parser (real file)', () => {
  it('parses all 11 characters, 106 character and 10 system animations', async () => {
    const lib = parseAnimationLibrary(await rawAnimations());
    expect(lib.characters.size).toBe(11);
    const total = [...lib.characters.values()].reduce((n, c) => n + c.animations.size, 0);
    expect(total).toBe(106);
    expect(lib.system.size).toBe(10);
    expect(lib.characters.get('ai-narrator')?.animations.get('loading')?.kind).toBe('states');
    expect(lib.idleVariants.baseLoopsBeforeVariant).toEqual([2, 4]);
  });

  it('every keyframe pose has a sprite frame in the atlas', async () => {
    const { animations, atlas } = await realData();
    const missing = missingPoses(animations, (c) => (atlas.characters[c] ? new Set(Object.keys(atlas.characters[c]!.frames)) : null));
    expect(missing).toEqual([]);
  });

  it('rejects malformed timelines with a JSON path', async () => {
    const raw = structuredClone(await rawAnimations()) as { characters: { judge: { animations: { tracks: { t: number }[] }[] } } };
    raw.characters.judge.animations[0]!.tracks[1]!.t = -1;
    expect(() => parseAnimationLibrary(raw)).toThrow(AnimationLibraryError);
    expect(() => parseAnimationLibrary({ schemaVersion: 2 })).toThrow(/unsupported version/);
  });
});

describe('sampler (ANIMATION-GUIDE §3)', () => {
  it('snaps pose/expression, lerps transform, wraps loops and clamps one-shots', async () => {
    const { animations } = await realData();
    const objection = animations.characters.get('judge')!.animations.get('objection') as TrackAnimation;
    const s = sampleAnimation(objection, 0.075); // halfway 0 → 0.15
    expect(s.pose).toBe('idle');
    expect(s.transform.y).toBeCloseTo(objection.tracks[1]!.transform.y / 2);
    const at = sampleAnimation(objection, objection.tracks[1]!.t);
    expect(at.pose).toBe(objection.tracks[1]!.pose);
    expect(sampleAnimation(objection, 99).pose).toBe(objection.tracks.at(-1)!.pose);
    const idle = animations.characters.get('judge')!.animations.get('idle') as TrackAnimation;
    expect(sampleAnimation(idle, idle.duration + 0.5).transform).toEqual(sampleAnimation(idle, 0.5).transform);
  });

  it('reports crossed keyframes once, across loop wraps', async () => {
    const { animations } = await realData();
    const talk = animations.characters.get('judge')!.animations.get('talk') as TrackAnimation;
    const crossed = crossedKeyframes(talk, 0, talk.duration * 2);
    expect(crossed.length).toBe((talk.tracks.length - 1) * 2);
  });
});

describe('CharacterAnimator (stateMachine.rules)', () => {
  it('a one-shot blocks: the next trigger is queued and plays after it', async () => {
    const { animations } = await realData();
    const a = new CharacterAnimator(animations, 'prosecutor', { random: seq(0.5) });
    expect(a.trigger('react_shocked')).toBe('played');
    expect(a.trigger('react_happy')).toBe('queued');
    a.update(2);
    expect(a.animation).toBe('react_happy');
    a.update(2);
    expect(a.mode).toBe('base');
    const events = a.drainEvents().map((e) => `${e.type}:${'animation' in e ? e.animation : ''}`);
    expect(events).toContain('end:react_shocked');
    expect(events).toContain('end:react_happy');
  });

  it('objection may interrupt talk; other one-shots wait for the talk segment', async () => {
    const { animations } = await realData();
    const a = new CharacterAnimator(animations, 'prosecutor', { random: seq(0) });
    a.setTalking(true);
    expect(a.mode).toBe('talk');
    expect(a.trigger('react_happy')).toBe('queued');
    const b = new CharacterAnimator(animations, 'prosecutor', { random: seq(0) });
    b.setTalking(true);
    expect(b.trigger('objection')).toBe('played');
    const start = b.drainEvents().find((e) => e.type === 'start' && e.animation === 'objection');
    expect(start).toMatchObject({ callout: 'OBJECTION!' });
  });

  it('plays an idle variant after 2–4 base loops, never the same twice in a row, and triggers cut it off', async () => {
    const { animations } = await realData();
    // random 0 → 2 loops; picks the first variant by weight.
    const a = new CharacterAnimator(animations, 'judge', { random: seq(0) });
    const idle = animations.characters.get('judge')!.animations.get('idle') as TrackAnimation;
    a.update(idle.duration * 2 + 0.01);
    expect(a.mode).toBe('variant');
    const first = a.animation;
    a.update(5); // variant ends → base
    expect(a.mode).toBe('base');
    a.update(idle.duration * 2 + 0.01);
    expect(a.mode).toBe('variant');
    expect(a.animation).not.toBe(first);
    expect(a.trigger('react_angry')).toBe('played');
    expect(a.mode).toBe('one-shot');
  });

  it('alternates talk and idle while dialogue streams, and reset snaps to idle', async () => {
    const { animations } = await realData();
    const a = new CharacterAnimator(animations, 'defense', { random: seq(0) });
    a.setTalking(true);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(a.update(0.1).animation);
    expect(seen).toEqual(new Set(['talk', 'idle']));
    a.trigger('defeated');
    a.reset();
    expect(a.animation).toBe('idle');
  });

  it('jurors can sit (seated_idle) and the AI Narrator state animations play', async () => {
    const { animations } = await realData();
    const j = new CharacterAnimator(animations, 'juror', { baseIdle: 'seated_idle' });
    expect(j.update(0.1).pose).toBe('seated');
    const n = new CharacterAnimator(animations, 'ai-narrator');
    expect(n.trigger('success')).toBe('played');
    expect(n.update(0.1).animation).toBe('success');
  });
});

describe('SystemTimeline', () => {
  it('fires each step once, including t = 0, then finishes', async () => {
    const { animations } = await realData();
    const t = new SystemTimeline(animations, 'ballot_commit');
    const actions: string[] = [];
    let ticks = 0;
    while (!t.done && ticks++ < 100) actions.push(...t.update(0.1).steps.map((s) => s.action));
    expect(actions).toEqual(['ballot_rise', 'ballot_drop', 'sealed_box_shut', 'idle']);
  });
});
