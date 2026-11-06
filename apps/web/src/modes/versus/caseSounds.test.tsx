import type { AudioEngine } from '@cringe-court/audio';
import type { VersusCase } from '@cringe-court/modes-versus';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { CaseSounds } from './components/CaseSounds';
import { VersusContext, type VersusRuntime } from './runtime/context';

const audio = { handle: vi.fn(), setAmbience: vi.fn() };
beforeEach(() => {
  audio.handle.mockClear();
  audio.setAmbience.mockClear();
});

type Seat = { seat: number; juror: string; committed: boolean; revealed: boolean };
const seat = (n: number, committed = false, revealed = false): Seat => ({ seat: n, juror: `0x${n}`, committed, revealed });
const kase = (phase: string, seats: Seat[] = [], state: Record<string, unknown> = { stage: 'jury' }) => ({ chain: { phase, seats }, state }) as unknown as VersusCase;
const view = (c: VersusCase) => (
  <VersusContext.Provider value={{ audio: audio as unknown as AudioEngine } as VersusRuntime}>
    <CaseSounds c={c} />
  </VersusContext.Provider>
);
const fired = (type: string) => audio.handle.mock.calls.filter(([e]) => e.type === type);

describe('versus case-state sound', () => {
  it('a phase change fires phase.entered exactly once; first sight only sets the bed', () => {
    const { rerender } = render(view(kase('recruiting')));
    expect(audio.setAmbience).toHaveBeenCalledWith('lobby');
    expect(audio.handle).not.toHaveBeenCalled();
    rerender(view(kase('recruiting')));
    rerender(view(kase('commit')));
    rerender(view(kase('commit')));
    expect(fired('phase.entered')).toEqual([[{ type: 'phase.entered', phase: 'commit' }]]);
  });

  it('seats, sealed ballots and opened scrolls fire once each as they change', () => {
    const { rerender } = render(view(kase('recruiting', [seat(1)])));
    rerender(view(kase('recruiting', [seat(1), seat(2)])));
    expect(fired('juror.seated')).toEqual([[{ type: 'juror.seated', index: 1 }]]);
    rerender(view(kase('commit', [seat(1, true), seat(2)])));
    rerender(view(kase('commit', [seat(1, true), seat(2)])));
    expect(fired('ballot.committed')).toHaveLength(1);
    rerender(view(kase('reveal', [seat(1, true, true), seat(2, true)])));
    expect(fired('ballot.revealed')).toHaveLength(1);
  });

  it('the verdict fires verdict.read exactly once, including no-verdict', () => {
    const { rerender } = render(view(kase('finalizing', [], { stage: 'jury' })));
    const decided = (kind: string) => kase('settled', [], { stage: 'verdict', verdict: { kind } });
    rerender(view(decided('ballot-1')));
    rerender(view(decided('ballot-1')));
    expect(fired('verdict.read')).toEqual([[{ type: 'verdict.read', outcome: 'side-b' }]]);
    const none = render(view(kase('finalizing')));
    none.rerender(view(decided('no-verdict')));
    expect(fired('verdict.read').at(-1)).toEqual([{ type: 'verdict.read', outcome: 'no-verdict' }]);
  });

  it('a dismissed case refunds once', () => {
    const { rerender } = render(view(kase('recruiting')));
    rerender(view(kase('cancelled', [], { stage: 'closed' })));
    rerender(view(kase('cancelled', [], { stage: 'closed' })));
    expect(fired('settlement')).toEqual([[{ type: 'settlement', kind: 'refund' }]]);
  });
});
