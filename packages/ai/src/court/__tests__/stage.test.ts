/**
 * Integration with the existing game engine: a generated transcript compiles
 * through the Director into the typed Cue stream the ScenePort renderer plays,
 * and the ShowPlayer can skip through it. No parallel event bus.
 */
import { BASE_MODES } from '@cringe-court/core';
import { directTrial, directVerdict, type Cue } from '@cringe-court/engine';
import { describe, expect, it } from 'vitest';
import { CourtAI } from '../engine';
import { EXAMPLE_INPUTS, exampleScript } from '../eval/examples';
import { MockInferenceClient } from '../mock';
import { prepareCase } from '../prepare';
import { PLANS } from '../plans';
import { commentaryToCourtLines, courtCast, courtDirectorOptions, toCourtLines } from '../stage';
import type { CourtMode } from '../schema';

async function trial(mode: CourtMode) {
  return new CourtAI(new MockInferenceClient({ responses: [exampleScript(mode)] })).generateTrial(prepareCase(EXAMPLE_INPUTS[mode]));
}

const says = (cues: readonly Cue[]) => cues.filter((c): c is Extract<Cue, { kind: 'say' }> => c.kind === 'say');

describe('transcript -> Director cues', () => {
  it.each(['solo', 'versus', 'viral'] as const)('%s compiles into a show with one dialogue cue per line, in order', async (mode) => {
    const t = await trial(mode);
    const show = directTrial(t.caseId, toCourtLines(t), courtCast(mode));
    expect(says(show.cues).map((c) => c.line.id)).toEqual(t.lines.map((l) => l.id));
    expect(Object.keys(show.lineStarts)).toEqual(t.lines.map((l) => l.id));
    expect(show.seconds).toBeGreaterThan(30);
  });

  it.each(['solo', 'versus', 'viral'] as const)('%s performed with courtDirectorOptions lasts about the estimate, inside the runtime target', async (mode) => {
    const t = await trial(mode);
    const show = directTrial(t.caseId, toCourtLines(t), courtCast(mode), courtDirectorOptions());
    expect(Math.abs(show.seconds - t.estimatedSeconds)).toBeLessThan(6);
    expect(show.seconds).toBeGreaterThanOrEqual(PLANS[mode].targetSeconds[0]);
    expect(show.seconds).toBeLessThanOrEqual(PLANS[mode].targetSeconds[1]);
  });

  it('the clerk performs at the clerk mark, and falls back when a cast has no clerk', async () => {
    const t = await trial('solo');
    const lines = toCourtLines(t);
    const withClerk = directTrial('x', lines, courtCast('solo'));
    expect(says(withClerk.cues)[0]?.actor).toBe('clerk');
    const noClerk = courtCast('solo').filter((c) => c.actor !== 'clerk');
    expect(says(directTrial('x', lines, noClerk).cues)[0]?.actor).toBe('judge');
  });

  it('frames each advocate at their own desk even when Miss Ratio argues ballot option 1', async () => {
    const t = await trial('versus');
    const show = directTrial(t.caseId, toCourtLines(t), courtCast('versus'));
    for (const [i, cue] of show.cues.entries()) {
      if (cue.kind !== 'say' || (cue.actor !== 'prosecutor' && cue.actor !== 'defense')) continue;
      const camera = show.cues.slice(0, i).reverse().find((c): c is Extract<Cue, { kind: 'camera' }> => c.kind === 'camera');
      expect(camera?.shot, cue.line.id).toBe(cue.actor === 'prosecutor' ? 'close_prosecution' : 'close_defense');
    }
  });

  it('maps animations to existing beats and carries emotion for the portrait', async () => {
    const t = await trial('solo');
    const lines = toCourtLines(t);
    expect(lines.find((l) => l.id === 'L04')).toMatchObject({ beat: 'desk-slam', emotion: 'angry', bench: 0 });
    expect(lines.find((l) => l.id === 'L01')?.beat).toBeUndefined();
    const show = directTrial(t.caseId, lines, courtCast('solo'));
    expect(show.cues).toContainEqual({ kind: 'sound', cue: 'sfx.desk-slam', pan: -0.6 });
    expect(show.cues).toContainEqual({ kind: 'sound', cue: 'sfx.crowd-laugh' });
  });

  it('ends the trial at the jury-out card, never at a verdict', async () => {
    const t = await trial('solo');
    const show = directTrial(t.caseId, toCourtLines(t), courtCast('solo'));
    expect(show.cues.filter((c) => c.kind === 'card').map((c) => (c as { card: string }).card)).toEqual(['jury-out']);
  });

  it('legacy casts still play: the existing solo staging works unchanged', async () => {
    const t = await trial('solo');
    const def = BASE_MODES.solo;
    expect(() => directTrial(t.caseId, toCourtLines(t), def.staging(def.terms()))).not.toThrow();
  });

  it('post-verdict commentary plays in the verdict ceremony', async () => {
    const court = new CourtAI(new MockInferenceClient());
    const c = await court.generateVerdictCommentary({ caseId: 'example-solo-dog', mode: 'solo', status: 'FINALIZED', outcome: 'NOT_COOKED', summary: 'Bought a memecoin for its dog mascot.' });
    const lines = commentaryToCourtLines(c);
    expect(lines.every((l) => l.segment === 'sentence')).toBe(true);
    const show = directVerdict({ kind: 'ballot-1', label: 'NOT COOKED', tally: [1, 2], completedDuty: 3, appointed: 3 }, courtCast('solo'), lines[0] ?? null);
    expect(says(show.cues)[0]?.line.text).toContain('NOT COOKED');
  });
});
