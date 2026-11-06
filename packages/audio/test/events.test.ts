import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AMBIENCE_PRESETS } from '../src/ambience.ts';
import { isCueId } from '../src/cues.ts';
import {
  ANIMATION_SOUND_CUES,
  PHASE_AMBIENCE,
  cueForAnimationSound,
  cuesForEvent,
  type CaseAudioEvent,
} from '../src/events.ts';

const ALL_EVENTS: CaseAudioEvent[] = [
  ...(['draft', 'pre-trial', 'recruiting', 'preparing', 'commit', 'reveal', 'finalizing', 'settled', 'cancelled'] as const).map(
    (phase) => ({ type: 'phase.entered', phase }) as const,
  ),
  { type: 'court.entered' },
  { type: 'case.stamped' },
  { type: 'hearing.opened' },
  { type: 'order' },
  { type: 'statement.started', by: 'prosecution' },
  { type: 'objection', by: 'defense' },
  ...(['murmur', 'laugh', 'gasp', 'applause'] as const).map((reaction) => ({ type: 'crowd', reaction }) as const),
  { type: 'teaser.jury-out' },
  { type: 'juror.seated', index: 2 },
  { type: 'bond.posted' },
  { type: 'ballot.committed' },
  { type: 'ballot.revealed' },
  { type: 'vote.counted', index: 4 },
  ...[0, 1, 5, 10, 11, 29, 30, 31, 90].map((secondsLeft) => ({ type: 'deadline.tick', secondsLeft }) as const),
  ...(['guilty', 'not-cooked', 'side-a', 'side-b', 'no-verdict'] as const).map((outcome) => ({ type: 'verdict.read', outcome }) as const),
  ...(['payout', 'refund', 'forfeit'] as const).map((kind) => ({ type: 'settlement', kind }) as const),
  { type: 'tx.confirmed' },
  { type: 'tx.failed' },
];

describe('cuesForEvent', () => {
  it('maps every event to valid cues and presets', () => {
    for (const e of ALL_EVENTS) {
      const s = cuesForEvent(e);
      for (const c of s.cues) {
        expect(isCueId(c.cue), `${e.type} → ${c.cue}`).toBe(true);
        expect(c.delay ?? 0).toBeGreaterThanOrEqual(0);
        if (c.pan !== undefined) expect(Math.abs(c.pan)).toBeLessThanOrEqual(1);
      }
      if (s.ambience) expect(AMBIENCE_PRESETS).toContain(s.ambience);
    }
  });

  it('gives each verdict its sting and the gallery’s reaction', () => {
    const cues = (outcome: 'guilty' | 'not-cooked' | 'side-a' | 'no-verdict') =>
      cuesForEvent({ type: 'verdict.read', outcome }).cues.map((c) => c.cue);
    expect(cues('guilty')).toEqual(['verdict_guilty', 'crowd_gasp']);
    expect(cues('not-cooked')).toEqual(['verdict_not_cooked', 'crowd_applause']);
    expect(cues('side-a')).toEqual(['verdict_decided', 'crowd_applause']);
    expect(cues('no-verdict')).toEqual(['verdict_none', 'crowd_murmur']);
  });

  it('warns once at 30 s, ticks with rising urgency in the last 10 s, and buzzes at 0', () => {
    const at = (secondsLeft: number, warnAt?: number) =>
      cuesForEvent(warnAt === undefined ? { type: 'deadline.tick', secondsLeft } : { type: 'deadline.tick', secondsLeft, warnAt }).cues;
    expect(at(31)).toEqual([]);
    expect(at(30).map((c) => c.cue)).toEqual(['timer_warning']);
    expect(at(60, 60).map((c) => c.cue)).toEqual(['timer_warning']);
    expect(at(11)).toEqual([]);
    expect(at(10)[0]?.intensity).toBeCloseTo(0.1);
    expect(at(1)[0]?.intensity).toBeCloseTo(1);
    expect(at(0).map((c) => c.cue)).toEqual(['timer_expired']);
    expect(at(-3)).toEqual([]);
  });

  it('places prosecution left and defense right', () => {
    expect(cuesForEvent({ type: 'statement.started', by: 'prosecution' }).cues[0]?.pan).toBeLessThan(0);
    expect(cuesForEvent({ type: 'statement.started', by: 'defense' }).cues[0]?.pan).toBeGreaterThan(0);
  });

  it('commits a ballot with the same sound whatever the vote (no tally leak)', () => {
    expect(cuesForEvent({ type: 'ballot.committed' })).toEqual({ cues: [{ cue: 'ballot_seal' }] });
  });

  it('covers every case phase from @cringe-court/core', () => {
    // Pinned copy of CasePhase from v3/p3-app-shell packages/core/src/case.ts.
    expect(Object.keys(PHASE_AMBIENCE).sort()).toEqual(
      ['draft', 'pre-trial', 'recruiting', 'preparing', 'commit', 'reveal', 'finalizing', 'settled', 'cancelled'].sort(),
    );
  });
});

describe('animation sound labels (cc-art/dist/animation/animations.json)', () => {
  const lib = JSON.parse(readFileSync(join(import.meta.dirname, '../../../cc-art/dist/animation/animations.json'), 'utf8')) as unknown;
  const steps: { animation: string; sound: string }[] = [];
  const walk = (v: unknown, name: string) => {
    if (Array.isArray(v)) v.forEach((x) => walk(x, name));
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if (typeof o.sound === 'string') steps.push({ animation: name, sound: o.sound });
      for (const [k, x] of Object.entries(o)) walk(x, typeof x === 'object' && x && !Array.isArray(x) && 'duration' in (x as object) ? k : name);
    }
  };
  walk(lib, '');

  it('finds the labels in the art library', () => {
    expect(new Set(steps.map((s) => s.sound))).toEqual(new Set(Object.keys(ANIMATION_SOUND_CUES)));
  });

  it('maps every label to a cue, and verdict gavels to the full sting', () => {
    for (const s of steps) expect(isCueId(cueForAnimationSound(s.sound, s.animation))).toBe(true);
    expect(cueForAnimationSound('gavel', 'verdict_guilty')).toBe('verdict_guilty');
    expect(cueForAnimationSound('gavel', 'verdict_not_cooked')).toBe('verdict_not_cooked');
    expect(cueForAnimationSound('gavel')).toBe('gavel_strike');
    expect(cueForAnimationSound('kazoo')).toBeNull();
    const verdictGavels = steps.filter((s) => s.sound === 'gavel').map((s) => s.animation).sort();
    expect(verdictGavels).toEqual(['verdict_guilty', 'verdict_not_cooked']);
  });
});
