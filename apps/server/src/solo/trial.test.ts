import { MockInferenceClient, CourtAI } from '@cringe-court/ai/court';
import { describe, expect, it, vi } from 'vitest';
import { confessionHash, createSoloTrials, screenConfession, type StakeReader } from './trial';

const TX = `0x${'ab'.repeat(32)}`;
const TITLE = 'The Tiny Tie';
const STORY = 'I bought a memecoin because the dog on the logo looked financially responsible.';
const stakes = (contentHash: `0x${string}`): StakeReader => ({ filing: async () => ({ caseId: 7n, contentHash }) });
const writer = () => new CourtAI(new MockInferenceClient());

describe('Solo trial', () => {
  it('writes the trial only for a real stake on this exact confession', async () => {
    const trials = createSoloTrials({ writer: writer(), stakes: stakes(confessionHash(TITLE, STORY)) });
    const r = await trials.trial(TX, TITLE, STORY);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lines.length).toBeGreaterThan(3);
  });

  it('refuses a stake made for a different confession, without calling the model', async () => {
    const ai = writer();
    const spy = vi.spyOn(ai, 'generateTrial');
    const trials = createSoloTrials({ writer: ai, stakes: stakes(confessionHash(TITLE, 'something else entirely, and much cheaper')) });
    expect(await trials.trial(TX, TITLE, STORY)).toMatchObject({ ok: false, reason: 'wrong-confession' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses a transaction that is not a stake', async () => {
    const trials = createSoloTrials({ writer: writer(), stakes: { filing: async () => null } });
    expect(await trials.trial(TX, TITLE, STORY)).toMatchObject({ ok: false, reason: 'not-a-stake' });
  });

  it('writes one trial per case, however many times it is asked', async () => {
    const ai = writer();
    const spy = vi.spyOn(ai, 'generateTrial');
    const trials = createSoloTrials({ writer: ai, stakes: stakes(confessionHash(TITLE, STORY)) });
    await trials.trial(TX, TITLE, STORY);
    await trials.trial(TX, TITLE, STORY);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('screenConfession', () => {
  it('passes a real confession and stops one too short to try, before anyone pays', () => {
    expect(screenConfession(TITLE, STORY)).toEqual({ ok: true });
    expect(screenConfession(TITLE, 'oops')).toMatchObject({ ok: false });
  });
});
