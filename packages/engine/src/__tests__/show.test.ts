import { BASE_MODES, type CourtLine, type SceneSignal, type Verdict } from '@cringe-court/core';
import { FixtureCounsel, RecordingAudio, RecordingScene } from '@cringe-court/core/testing';
import { describe, expect, it } from 'vitest';
import { ShowPlayer, directBallotCommitted, directTrial, directVerdict, lineSeconds, type PlayerEvent } from '../index';

const solo = BASE_MODES.solo;
const cast = solo.staging(solo.terms());

async function transcript(scope: 'teaser' | 'full' = 'full'): Promise<readonly CourtLine[]> {
  const draft = await new FixtureCounsel().draft({
    trialId: 't',
    mode: 'solo',
    category: 'internet-crimes',
    title: 'Reply-all',
    ballot: ['GUILTY', 'NOT COOKED'],
    benches: solo.benches,
    briefs: [
      { choice: 0, role: 'prosecution', counsel: 'prosecutor', client: null, publicText: 'They replied all.' },
      { choice: 1, role: 'defense', counsel: 'defense', client: 'a', publicText: 'They replied all.' },
    ],
    exhibits: [{ id: 'x1', submittedBy: 'a', kind: 'quote', title: 'The frog', body: 'ribbit' }],
    scope,
    payer: ['platform', 'platform'],
    budget: { maxInputTokens: 1000, maxOutputTokens: 400 },
    attempt: 1,
  });
  return draft.lines;
}

const instant = () => Promise.resolve();

describe('Director', () => {
  it('cuts to the speaker’s close-up, maps beats to animations and sounds, and ends on THE JURY IS OUT', async () => {
    const lines = await transcript();
    const show = directTrial('t', lines, cast);
    const says = show.cues.filter((c) => c.kind === 'say');
    expect(says).toHaveLength(lines.length);
    expect(show.cues).toContainEqual({ kind: 'system', animation: 'enter_court', wait: true });
    expect(show.cues).toContainEqual(expect.objectContaining({ kind: 'animate', actor: 'prosecutor', animation: 'objection' }));
    expect(show.cues).toContainEqual(expect.objectContaining({ kind: 'animate', actor: 'defense', animation: 'react_shocked' }));
    expect(show.cues).toContainEqual({ kind: 'prop', state: { prop: 'evidence_screen', state: 'on', exhibitId: 'x1' } });
    expect(show.cues.at(-1)).toEqual({ kind: 'card', card: 'jury-out', text: 'THE JURY IS OUT' });
    const shots = show.cues.flatMap((c) => (c.kind === 'camera' ? [c.shot] : []));
    expect(shots).toEqual(expect.arrayContaining(['close_judge', 'close_prosecution', 'close_defense', 'close_jury']));
    expect(show.seconds).toBeGreaterThan(10);
    expect(Object.keys(show.lineStarts)).toHaveLength(lines.length);
  });

  it('never shows a verdict card in the trial show (D3)', async () => {
    const show = directTrial('t', await transcript('teaser'), cast);
    expect(show.cues.some((c) => c.kind === 'card' && (c.card === 'verdict' || c.card === 'mistrial'))).toBe(false);
  });

  it('rejects a speaker missing from the cast', async () => {
    const lines = await transcript();
    expect(() => directTrial('t', lines, cast.filter((c) => c.actor !== 'defense'))).toThrow(/not in the cast/);
  });

  it('the ballot show carries no choice or tally (privacy-critical)', () => {
    const show = directBallotCommitted();
    expect(JSON.stringify(show)).not.toMatch(/GUILTY|NOT COOKED|tally|choice/i);
  });

  it('verdict shows: guilty, side win and mistrial', () => {
    const v = (kind: Verdict['kind'], label: string): Verdict => ({ kind, label, tally: [2, 1], completedDuty: 3, appointed: 3 });
    const guilty = directVerdict(v('ballot-0', 'GUILTY'), cast, { id: 'S01', speaker: 'judge', segment: 'sentence', text: 'Log off.' });
    expect(guilty.cues).toContainEqual({ kind: 'system', animation: 'verdict_guilty', wait: true });
    expect(guilty.cues).toContainEqual({ kind: 'animate', actor: 'creator', animation: 'defeated' });
    expect(guilty.cues).toContainEqual(expect.objectContaining({ kind: 'sound', cue: 'stinger.verdict-guilty' }));
    const none = directVerdict(v('no-verdict', 'NO VERDICT'), cast, null);
    expect(none.cues).toContainEqual({ kind: 'card', card: 'mistrial', text: 'MISTRIAL' });
    expect(lineSeconds('x')).toBe(1.8);
  });
});

describe('ShowPlayer', () => {
  it('performs every cue through the ports and streams dialogue to the UI', async () => {
    const scene = new RecordingScene();
    const audio = new RecordingAudio();
    const player = new ShowPlayer({ scene, audio, sleep: instant });
    const events: PlayerEvent[] = [];
    player.subscribe((e) => events.push(e));
    const lines = await transcript();
    const show = directTrial('t', lines, cast);
    expect(await player.play(show)).toEqual({ aborted: false });
    expect(events.filter((e) => e.type === 'line').map((e) => (e.type === 'line' ? e.line.id : ''))).toEqual(lines.map((l) => l.id));
    expect(events.at(-1)).toEqual({ type: 'done', show: 't', aborted: false });
    expect(scene.of('animate').filter((c) => c.animation === 'talk')).toHaveLength(lines.length);
    expect(audio.cues()).toEqual(expect.arrayContaining(['music.trial', 'voice.judge', 'voice.prosecutor', 'stinger.objection', 'stinger.jury-out']));
    expect(scene.of('system').map((c) => c.animation)).toEqual(['enter_court']);
  });

  it('maps system-animation sound labels to audio cues', async () => {
    const listeners: ((s: SceneSignal) => void)[] = [];
    const scene = new RecordingScene();
    scene.subscribe = (fn) => {
      listeners.push(fn);
      return () => listeners.splice(listeners.indexOf(fn), 1);
    };
    scene.system = async (animation) => {
      listeners.forEach((fn) => fn({ type: 'action', animation, action: 'gavel_strike', sound: 'gavel' }));
    };
    const audio = new RecordingAudio();
    await new ShowPlayer({ scene, audio, sleep: instant }).play({ id: 'x', cues: [{ kind: 'system', animation: 'verdict_guilty', wait: true }], seconds: 0, lineStarts: {} });
    expect(audio.cues()).toEqual(['sfx.gavel']);
    expect(listeners).toHaveLength(0);
  });

  it('skips a line, pauses and aborts', async () => {
    const scene = new RecordingScene();
    const audio = new RecordingAudio();
    let slept = 0;
    const player = new ShowPlayer({ scene, audio, sleep: async (ms) => void (slept += ms), tickMs: 100 });
    const lines = await transcript('teaser');
    const show = directTrial('t', lines, cast);
    const ctrl = new AbortController();
    let lineCount = 0;
    player.subscribe((e) => {
      if (e.type === 'line') {
        lineCount++;
        player.skipLine();
        if (lineCount === 2) ctrl.abort();
      }
    });
    const result = await player.play(show, { signal: ctrl.signal });
    expect(result.aborted).toBe(true);
    expect(lineCount).toBe(2);
    expect(slept).toBeLessThan(1000);
  });
});
