import type { AudioEngine } from '@cringe-court/audio';
import type { TrialState } from '@cringe-court/core';
import { EMPTY_DRAFT, memoryQuotaStore, type SoloSession } from '@cringe-court/modes-solo';
import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { __setAppAudioForTests } from '@/platform/audio';
import { renderWithProviders } from '@/test/render';
import { CaseSounds } from '../case/CaseSounds';
import { VerdictPanel } from '../case/VerdictPanel';
import { resetDemoCourt } from '../lib/demoCourt';
import { soloPhase } from '../lib/sound';

const fake = { handle: vi.fn(), setAmbience: vi.fn(), play: vi.fn(() => null), getSnapshot: () => ({ state: 'locked', settings: { muted: false } }) };
const state = (stage: string, step?: string) => ({ stage, step }) as unknown as TrialState;

beforeEach(() => {
  fake.handle.mockClear();
  fake.setAmbience.mockClear();
  __setAppAudioForTests(fake as unknown as AudioEngine);
});
afterEach(() => __setAppAudioForTests(null));

describe('solo case-state sound', () => {
  it('maps trial states to court phases', () => {
    expect(soloPhase(state('jury', 'recruiting'))).toBe('recruiting');
    expect(soloPhase(state('jury', 'commit'))).toBe('commit');
    expect(soloPhase(state('verdict', 'announced'))).toBe('settled');
    expect(soloPhase(state('closed', 'cancelled'))).toBe('cancelled');
  });

  it('a phase change fires phase.entered exactly once; opening the case only sets the bed', () => {
    const { rerender } = render(<CaseSounds t={state('jury', 'recruiting')} />);
    expect(fake.setAmbience).toHaveBeenCalledWith('lobby');
    expect(fake.handle).not.toHaveBeenCalled();
    rerender(<CaseSounds t={state('jury', 'recruiting')} />);
    rerender(<CaseSounds t={state('jury', 'commit')} />);
    rerender(<CaseSounds t={state('jury', 'commit')} />);
    expect(fake.handle.mock.calls.filter(([e]) => e.type === 'phase.entered')).toEqual([[{ type: 'phase.entered', phase: 'commit' }]]);
  });

  it('a dismissed case fires one refund sting', () => {
    const { rerender } = render(<CaseSounds t={state('jury', 'recruiting')} />);
    rerender(<CaseSounds t={state('closed', 'cancelled')} />);
    rerender(<CaseSounds t={state('closed', 'cancelled')} />);
    expect(fake.handle.mock.calls.filter(([e]) => e.type === 'settlement')).toHaveLength(1);
  });

  it('the verdict fires verdict.read exactly once, even across re-renders', async () => {
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    const court = resetDemoCourt({ latencyMs: 0, store: memoryQuotaStore() });
    const session: SoloSession = court.startSession();
    session.fileConfession({ ...EMPTY_DRAFT, category: 'dating-crimes', title: 'Ghosted after brunch', story: 'We had brunch, I said let us do this again, then never texted back for three weeks.' });
    session.setAngle('Choosing the right emoji takes time. Three weeks is thorough.');
    await session.approveAndDraft();
    session.approveDraft();
    await session.pay();
    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    await session.commitBallot(2);
    await session.closeCommit();
    await session.revealBallot(2);
    await session.closeReveal();
    await session.finalize();
    const snap = session.getSnapshot();
    if (snap.trial.stage !== 'verdict') throw new Error(snap.trial.stage);
    const { rerender } = renderWithProviders(<VerdictPanel snap={{ ...snap, trial: snap.trial }} session={session} />);
    rerender(<VerdictPanel snap={{ ...snap, trial: snap.trial }} session={session} />);
    expect(fake.handle.mock.calls.filter(([e]) => e.type === 'verdict.read')).toEqual([[{ type: 'verdict.read', outcome: 'no-verdict' }]]);
  });
});
