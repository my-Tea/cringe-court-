import type { CourtLine } from '@cringe-court/core';
import { beatsFromLines, playBeats, roamSpeakerOf, type PlannedBeat, type RoamBeatPort } from './beats';

const L = (speaker: string, segment: CourtLine['segment'], text: string, bench?: 0 | 1): CourtLine =>
  ({ id: text, speaker, segment, beat: 'gavel', text, ...(bench === undefined ? {} : { bench }) }) as CourtLine;

const LINES: CourtLine[] = [
  L('judge', 'call-to-order', 'Order'),
  L('prosecutor', 'opening', 'Cooked', 0),
  L('prosecutor', 'opening', 'Very cooked', 0),
  L('prosecutor', 'exhibit', 'Exhibit A', 0),
  L('defense', 'rebuttal', 'Nope', 1),
  L('defense', 'closing', 'Bye', 1),
  L('judge', 'jury-out', 'Jury out'),
  L('judge', 'sentence', 'Sentence'),
];

describe('beatsFromLines', () => {
  it('groups consecutive lines of the same beat and skips the sentence line', () => {
    const beats = beatsFromLines(LINES);
    expect(beats.map((b) => b.id)).toEqual(['all-rise', 'opening', 'counsel-arguing', 'jury-deliberating']);
    expect(beats[1]!.options.lines).toHaveLength(2);
    expect(beats[2]!.options.lines?.map((l) => l.text)).toEqual(['Exhibit A', 'Nope', 'Bye']);
  });

  it('appends the verdict beat when given', () => {
    const beats = beatsFromLines(LINES, { kind: 'guilty', text: 'GUILTY' });
    expect(beats.at(-1)).toEqual({ id: 'verdict', options: { verdict: 'guilty', verdictText: 'GUILTY' } });
    expect(beats).toHaveLength(5);
  });

  it('maps speakers by bench and known ids', () => {
    expect(roamSpeakerOf({ speaker: 'x' as never, bench: 0 })).toBe('prosecutor');
    expect(roamSpeakerOf({ speaker: 'x' as never, bench: 1 })).toBe('defense');
    expect(roamSpeakerOf({ speaker: 'side-a' as never })).toBe('prosecutor');
    expect(roamSpeakerOf({ speaker: 'side-b' as never })).toBe('defense');
    expect(roamSpeakerOf({ speaker: 'bailiff' as never })).toBe('bailiff');
    expect(roamSpeakerOf({ speaker: 'mystery' as never })).toBe('narrator');
  });

  it('keeps CourtLine beat tags on dialogue so roam can slam OBJECTION without the word', () => {
    const lines = [
      { id: '1', speaker: 'side-a', bench: 0 as const, segment: 'rebuttal' as const, beat: 'objection' as const, text: 'Listen to that again.' },
    ];
    const beats = beatsFromLines(lines);
    expect(beats[0]!.options.lines?.[0]).toEqual({ speaker: 'prosecutor', text: 'Listen to that again.', beat: 'objection' });
  });
});

describe('playBeats', () => {
  const beats: PlannedBeat[] = [
    { id: 'all-rise', options: {} },
    { id: 'opening', options: {} },
    { id: 'verdict', options: {} },
  ];

  it('runs every beat in order and reports indexes', async () => {
    const ran: string[] = [];
    const port: RoamBeatPort = { runBeat: async (id) => void ran.push(id), skipBeat: vi.fn() };
    const seen: number[] = [];
    expect(await playBeats(port, beats, undefined, (i) => seen.push(i))).toBe(true);
    expect(ran).toEqual(['all-rise', 'opening', 'verdict']);
    expect(seen).toEqual([0, 1, 2]);
  });

  it('aborting skips the current beat and stops', async () => {
    const ac = new AbortController();
    const ran: string[] = [];
    let release: () => void = () => {};
    const skipBeat = vi.fn(() => release());
    const port: RoamBeatPort = {
      runBeat: (id) => {
        ran.push(id);
        return new Promise<void>((r) => (release = r));
      },
      skipBeat,
    };
    const p = playBeats(port, beats, ac.signal);
    ac.abort();
    expect(await p).toBe(false);
    expect(skipBeat).toHaveBeenCalled();
    expect(ran).toEqual(['all-rise']);
  });

  it('does not start when already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const runBeat = vi.fn();
    expect(await playBeats({ runBeat, skipBeat: vi.fn() }, beats, ac.signal)).toBe(false);
    expect(runBeat).not.toHaveBeenCalled();
  });
});
