import { BASE_MODES, briefsFor, type Filing } from '@cringe-court/core';
import { VersusCounsel } from '@cringe-court/modes-versus';
import { BeatRunner, beatScript, type BeatHost, type BeatId, type BeatOptions, type BeatStep } from '@cringe-court/scene/roam';
import { describe, expect, it } from 'vitest';
import { playVersusTrial, roamSpeaker, versusBeats, type RoamBeatPort } from './beats';

const filing: Filing = {
  category: 'npc-behavior',
  title: 'The Last Dumpling',
  context: '',
  sides: {
    a: { account: null, story: 'We agreed to split it. I fetched napkins. The plate was empty on return.', privateNotes: 'third incident', angle: 'A deal is a deal.', nickname: 'Napkin Knight' },
    b: { account: null, story: 'It was going cold. I saved it from a lukewarm fate. Hot food waits for no one.', privateNotes: '', angle: null, nickname: null },
  },
};

async function transcript() {
  const draft = await new VersusCounsel().draft({
    trialId: 'vs-roambeats',
    mode: 'versus',
    category: filing.category,
    title: filing.title,
    ballot: ['SIDE A', 'SIDE B'],
    benches: BASE_MODES.versus.benches,
    briefs: briefsFor(BASE_MODES.versus.benches, filing),
    exhibits: [{ id: 'ex-a1', submittedBy: 'a', kind: 'text', title: 'Group chat', body: 'me: splitting 50/50? them: deal' }],
    scope: 'full',
    payer: ['platform', 'platform'],
    budget: { maxInputTokens: 6000, maxOutputTokens: 1200 },
    attempt: 1,
  });
  return draft.lines;
}

/** A host that records what the roam beat runner applies, with no dialogue delay. */
function recorder(): BeatHost & { steps: BeatStep[] } {
  const steps: BeatStep[] = [];
  return { steps, apply: (s) => void steps.push(s), dialogueBusy: () => false, clearDialogue: () => {} };
}

describe('versusBeats', () => {
  it('maps agents onto the counsel benches and keeps the judge', () => {
    expect(roamSpeaker({ speaker: 'side-a', bench: 0 })).toBe('prosecutor');
    expect(roamSpeaker({ speaker: 'side-b', bench: 1 })).toBe('defense');
    expect(roamSpeaker({ speaker: 'judge' })).toBe('judge');
  });

  it('turns a real Versus transcript into roam beats that say every line, in order', async () => {
    const lines = await transcript();
    const beats = versusBeats(lines, 'b');
    expect(beats.map((b) => b.id)).toEqual(['all-rise', 'opening', 'counsel-arguing', 'jury-deliberating', 'verdict']);
    const said = beats.flatMap((b) => b.options.lines ?? []).map((l) => l.text);
    expect(said).toEqual(lines.filter((l) => l.segment !== 'sentence').map((l) => l.text));
    expect(beats.at(-1)!.options).toEqual({ verdict: 'side-b', verdictText: 'SIDE B WINS' });

    // Every beat is a valid script for the roam runner, and plays to the end.
    for (const b of beats) {
      const host = recorder();
      const runner = new BeatRunner(b.id, beatScript(b.id, b.options), host);
      runner.start();
      for (let i = 0; i < 200 && !runner.advance(0.5); i++);
      expect(runner.state).toBe('done');
      const spoken = host.steps.filter((s): s is Extract<BeatStep, { kind: 'say' }> => s.kind === 'say').map((s) => s.text);
      for (const l of b.options.lines ?? []) expect(spoken).toContain(l.text);
    }
  });

  it('reads NO VERDICT as a mistrial', async () => {
    expect(versusBeats(await transcript(), 'none').at(-1)!.options).toEqual({ verdict: 'mistrial', verdictText: 'NO VERDICT' });
    expect(versusBeats(await transcript()).some((b) => b.id === 'verdict')).toBe(false);
  });

  it('keeps beat tags so OBJECTION callouts fire on Versus lines that never say the word', async () => {
    const lines = await transcript();
    const tagged = versusBeats(lines).flatMap((b) => b.options.lines ?? []).filter((l) => l.beat === 'objection');
    expect(tagged.length).toBeGreaterThan(0);
    expect(tagged.some((l) => !/\bobjection\b/i.test(l.text))).toBe(true);
  });
});

describe('playVersusTrial', () => {
  function fakeRoam() {
    const calls: [BeatId, BeatOptions | undefined][] = [];
    let skipped = 0;
    const port: RoamBeatPort = {
      runBeat: async (id, options) => void calls.push([id, options]),
      skipBeat: () => void skipped++,
    };
    return { port, calls, skips: () => skipped };
  }

  it('runs each beat through roam.runBeat in order', async () => {
    const beats = versusBeats(await transcript(), 'a');
    const roam = fakeRoam();
    expect(await playVersusTrial(roam.port, beats)).toBe(true);
    expect(roam.calls.map(([id]) => id)).toEqual(beats.map((b) => b.id));
  });

  it('stops and skips the current beat when aborted', async () => {
    const beats = versusBeats(await transcript(), 'a');
    const ctrl = new AbortController();
    const calls: BeatId[] = [];
    const port: RoamBeatPort = {
      runBeat: async (id) => {
        calls.push(id);
        if (calls.length === 2) ctrl.abort();
      },
      skipBeat: () => calls.push('verdict'),
    };
    expect(await playVersusTrial(port, beats, ctrl.signal)).toBe(false);
    expect(calls).toEqual(['all-rise', 'opening', 'verdict']);
  });
});
