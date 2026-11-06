import type { AudioEngine } from '@cringe-court/audio';
import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { __setAppAudioForTests } from '@/platform/audio';
import { CaseSounds } from '../components/CaseSounds';

vi.mock('../state/hooks', () => ({ useCourtNowMs: () => 0 }));

const fake = { handle: vi.fn(), setAmbience: vi.fn() };
beforeEach(() => {
  fake.handle.mockClear();
  fake.setAmbience.mockClear();
  __setAppAudioForTests(fake as unknown as AudioEngine);
});
afterEach(() => __setAppAudioForTests(null));

const detail = (over: Partial<Pick<CaseDetail, 'phase' | 'verdict'>> & { filled?: number; sealed?: number; opened?: number } = {}) =>
  ({
    phase: over.phase ?? 'recruiting',
    phaseEndsAt: null,
    verdict: over.verdict ?? null,
    seats: { filled: over.filled ?? 0, total: 7, sealed: over.sealed ?? 0, opened: over.opened ?? 0 },
  }) as unknown as CaseDetail;
const fired = (type: string) => fake.handle.mock.calls.filter(([e]) => e.type === type);

describe('grand jury case-state sound', () => {
  it('a phase change fires phase.entered exactly once', () => {
    const { rerender } = render(<CaseSounds detail={detail({ phase: 'recruiting' })} />);
    expect(fake.setAmbience).toHaveBeenCalledWith('lobby');
    rerender(<CaseSounds detail={detail({ phase: 'recruiting' })} />);
    rerender(<CaseSounds detail={detail({ phase: 'commit' })} />);
    rerender(<CaseSounds detail={detail({ phase: 'commit' })} />);
    expect(fired('phase.entered')).toEqual([[{ type: 'phase.entered', phase: 'commit' }]]);
  });

  it('seats, seals and reveals fire once per increase', () => {
    const { rerender } = render(<CaseSounds detail={detail({ filled: 1 })} />);
    rerender(<CaseSounds detail={detail({ filled: 2 })} />);
    rerender(<CaseSounds detail={detail({ filled: 2, sealed: 1 })} />);
    rerender(<CaseSounds detail={detail({ filled: 2, sealed: 1, opened: 1 })} />);
    rerender(<CaseSounds detail={detail({ filled: 2, sealed: 1, opened: 1 })} />);
    expect(fired('juror.seated')).toEqual([[{ type: 'juror.seated', index: 1 }]]);
    expect(fired('ballot.committed')).toHaveLength(1);
    expect(fired('ballot.revealed')).toHaveLength(1);
  });

  it('the verdict fires verdict.read exactly once, including no-verdict', () => {
    const v = (kind: string) => detail({ phase: 'settled', verdict: { kind } as never });
    const { rerender } = render(<CaseSounds detail={detail({ phase: 'finalizing' })} />);
    rerender(<CaseSounds detail={v('ballot-0')} />);
    rerender(<CaseSounds detail={v('ballot-0')} />);
    expect(fired('verdict.read')).toEqual([[{ type: 'verdict.read', outcome: 'side-a' }]]);
    const again = render(<CaseSounds detail={detail({ phase: 'finalizing' })} />);
    again.rerender(<CaseSounds detail={v('no-verdict')} />);
    expect(fired('verdict.read').at(-1)).toEqual([{ type: 'verdict.read', outcome: 'no-verdict' }]);
  });

  it('opening an already-decided case stays silent', () => {
    render(<CaseSounds detail={detail({ phase: 'settled', filled: 7, sealed: 7, opened: 7, verdict: { kind: 'ballot-1' } as never })} />);
    expect(fake.handle).not.toHaveBeenCalled();
  });
});
