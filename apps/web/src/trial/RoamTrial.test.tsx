import { render } from '@testing-library/react';
import type { UseRoamOptions } from '@cringe-court/scene/roam/react';
import { RoamTrial } from './RoamTrial';
import { HEARING_PACE_STORAGE_KEY, setHearingPace } from './hearingPace';

const made: UseRoamOptions[] = [];
let mounts = 0;
vi.mock('@cringe-court/scene/roam/react', async () => {
  const { useState } = await import('react');
  return {
    // Like the real hook: one controller per mount, built from the options it mounted with.
    useRoamCourtroom: (options: UseRoamOptions) => {
      useState(() => ++mounts);
      made.push(options);
      return { status: 'loading', controller: null, data: null, error: null };
    },
    RoamCourtroom: () => null,
  };
});

beforeEach(() => {
  made.length = 0;
  mounts = 0;
  window.localStorage.removeItem(HEARING_PACE_STORAGE_KEY);
});

describe('RoamTrial', () => {
  it('seats by role: a new room when a spectator takes a jury seat (B6), with the jury size and the saved pace', () => {
    setHearingPace('highlights');
    const view = render(<RoamTrial beats={[]} label="Courtroom" role="spectator" jurors={7} onExit={() => undefined} />);
    expect(made.at(-1)).toMatchObject({ role: 'spectator', spawn: 'aisle', jurors: 7, pace: 'highlights' });
    view.rerender(<RoamTrial beats={[]} label="Courtroom" role="spectator" jurors={7} onExit={() => undefined} />);
    expect(mounts).toBe(1);
    view.rerender(<RoamTrial beats={[]} label="Courtroom" role="juror" jurors={7} onExit={() => undefined} />);
    expect(made.at(-1)).toMatchObject({ role: 'juror', spawn: 'jury-box', jurors: 7 });
    expect(mounts).toBe(2);
  });

  it('defaults: Side A starts at the prosecution table, a jury of three, the standard pace', () => {
    render(<RoamTrial beats={[]} label="Courtroom" role="side-a" onExit={() => undefined} />);
    expect(made.at(-1)).toMatchObject({ role: 'side-a', spawn: 'prosecution', jurors: 3, pace: 'standard' });
  });
});
