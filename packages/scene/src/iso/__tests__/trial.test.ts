import { describe, expect, it } from 'vitest';
import { TOWN_URLS } from '../../assets';
import { readJson } from '../../__tests__/fixtures';
import { mergeLibraries, type PropLibraryFile } from '../library';
import { TOWN_MAPS } from '../maps/town';
import { TOWN_DIALOGUE } from '../maps/dialogue';
import { IsoController } from '../controller';
import { IsoTrial } from '../trial';
import { BEAT_IDS } from '../../roam/types';

const library = mergeLibraries(
  (await readJson(TOWN_URLS.props)) as PropLibraryFile,
  (await readJson(TOWN_URLS.buildings)) as PropLibraryFile,
);

const make = () => {
  const controller = new IsoController({
    maps: TOWN_MAPS,
    library,
    dialogue: TOWN_DIALOGUE,
    start: 'square',
  });
  return { controller, trial: new IsoTrial({ controller }) };
};

/** Run the trial for `seconds` in 60 Hz ticks. */
function run(trial: IsoTrial, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) trial.update(1 / 60);
}

describe('IsoTrial', () => {
  it('moves to the courthouse before playing', () => {
    const { controller, trial } = make();
    expect(controller.mapId).toBe('square');
    void trial.run('all-rise');
    expect(controller.mapId).toBe('courthouse');
  });

  it('plays every built-in beat to completion', async () => {
    for (const beat of BEAT_IDS) {
      const { trial } = make();
      const done = trial.run(beat);
      // The scripts are short; 60 s of ticks is far more than any of them needs.
      run(trial, 60);
      await expect(done).resolves.toBeUndefined();
      expect(trial.state.beat, `${beat} did not finish`).toBeNull();
      expect(trial.running).toBe(false);
    }
  });

  it('shows the lines the script provides', () => {
    const { trial } = make();
    void trial.run('opening');
    // The beat looks at counsel for 0.7s before the first line.
    run(trial, 1.2);
    // Something must be on screen: a beat that says nothing is a bug.
    expect(trial.line).not.toBeNull();
    expect(trial.line!.text.length).toBeGreaterThan(0);
  });

  it('uses AI counsel lines when the mode supplies them', () => {
    const { trial } = make();
    void trial.run('opening', {
      lines: [
        { speaker: 'prosecutor', text: 'THE SANDWICH WAS COLD.' },
        { speaker: 'defense', text: 'It was a salad.' },
      ],
    });
    let seen = '';
    for (let i = 0; i < 60 * 20; i++) {
      trial.update(1 / 60);
      if (trial.line) seen += trial.line.text;
    }
    expect(seen).toContain('SANDWICH');
  });

  it('fires a verdict callout for each verdict kind', () => {
    for (const verdict of ['guilty', 'not-cooked', 'mistrial'] as const) {
      const { trial } = make();
      let sawCallout = false;
      const onChange = (s: { callout: unknown }) => {
        if (s.callout) sawCallout = true;
      };
      const t2 = new IsoTrial({ controller: trial.controller, onChange });
      void t2.run('verdict', { verdict });
      for (let i = 0; i < 60 * 40 && !sawCallout; i++) t2.update(1 / 60);
      expect(sawCallout, `no callout for verdict ${verdict}`).toBe(true);
    }
  });

  it('honours a custom verdict headline', () => {
    const { controller } = make();
    const callouts: string[] = [];
    const trial = new IsoTrial({
      controller,
      onChange: (s) => {
        if (s.callout) callouts.push(s.callout.text);
      },
    });
    void trial.run('verdict', { verdict: 'side-a', verdictText: 'SIDE A WINS' });
    for (let i = 0; i < 60 * 40; i++) trial.update(1 / 60);
    expect(callouts.join(' ')).toContain('SIDE A');
  });

  it('plays the gavel cue', () => {
    const played: string[] = [];
    const { controller } = make();
    const trial = new IsoTrial({ controller, audio: { play: (c) => played.push(c) } });
    void trial.run('all-rise');
    run(trial, 40);
    expect(played.length).toBeGreaterThan(0);
  });

  it('can be skipped', async () => {
    const { trial } = make();
    const done = trial.run('jury-deliberating');
    run(trial, 0.1);
    trial.skip();
    await expect(done).resolves.toBeUndefined();
    expect(trial.running).toBe(false);
  });

  it('skipping with nothing running is a no-op', () => {
    const { trial } = make();
    expect(() => trial.skip()).not.toThrow();
  });

  it('replacing a running beat resolves the first promise', async () => {
    const { trial } = make();
    const first = trial.run('opening');
    run(trial, 0.1);
    const second = trial.run('verdict');
    await expect(first).resolves.toBeUndefined();
    run(trial, 60);
    await expect(second).resolves.toBeUndefined();
  });

  it('reports progress while running', () => {
    const { trial } = make();
    void trial.run('counsel-arguing');
    run(trial, 0.4);
    expect(trial.state.beat).toBe('counsel-arguing');
    expect(trial.state.steps).toBeGreaterThan(0);
    expect(trial.state.step).toBeGreaterThanOrEqual(0);
  });

  it('advanceDialogue drops the line to fully shown', () => {
    const { trial } = make();
    void trial.run('opening');
    run(trial, 1.2);
    expect(trial.dialogueBusy()).toBe(true);
    trial.advanceDialogue();
    expect(trial.line!.shown).toBe(trial.line!.text.length);
  });
});
