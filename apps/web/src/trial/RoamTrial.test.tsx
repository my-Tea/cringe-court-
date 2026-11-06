import { render } from '@testing-library/react';
import type { UseRoamOptions } from '@cringe-court/scene/roam/react';
import type { PlayerRole } from '@cringe-court/scene/roam';
import { RoamTrial, type RoamTrialProps } from './RoamTrial';
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

/** Props as an object: `role` here is the courtroom role, not an ARIA role. */
const trial = (role: PlayerRole, jurors?: number): RoamTrialProps => ({ beats: [], label: 'Courtroom', role, ...(jurors ? { jurors } : {}), onExit: () => undefined });

describe('RoamTrial', () => {
  it('seats by role: a new room when a spectator takes a jury seat (B6), with the jury size and the saved pace', () => {
    setHearingPace('highlights');
    const view = render(<RoamTrial {...trial('spectator', 7)} />);
    expect(made.at(-1)).toMatchObject({ role: 'spectator', spawn: 'aisle', jurors: 7, pace: 'highlights' });
    view.rerender(<RoamTrial {...trial('spectator', 7)} />);
    expect(mounts).toBe(1);
    view.rerender(<RoamTrial {...trial('juror', 7)} />);
    expect(made.at(-1)).toMatchObject({ role: 'juror', spawn: 'jury-box', jurors: 7 });
    expect(mounts).toBe(2);
  });

  it('defaults: Side A starts at the prosecution table, a jury of three, the standard pace', () => {
    render(<RoamTrial {...trial('side-a')} />);
    expect(made.at(-1)).toMatchObject({ role: 'side-a', spawn: 'prosecution', jurors: 3, pace: 'standard' });
  });
});
