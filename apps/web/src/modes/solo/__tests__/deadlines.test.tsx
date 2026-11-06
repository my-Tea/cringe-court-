import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { axe } from 'vitest-axe';
import { EMPTY_DRAFT, memoryQuotaStore, type SoloSession } from '@cringe-court/modes-solo';
import { renderWithProviders } from '@/test/render';
import { CasePage } from '../case/CasePage';
import { resetDemoCourt, type DemoCourt } from '../lib/demoCourt';

/**
 * B1 (UX evaluation): the jury is paused (or the tab sleeps) past a jury
 * window. The case page must carry on to the outcome the ledger reached and
 * show the refund, not loop on "The jury hit a snag".
 */
async function paidCase(court: DemoCourt): Promise<SoloSession> {
  const session = court.startSession();
  expect(
    session.fileConfession({
      ...EMPTY_DRAFT,
      category: 'npc-behavior',
      title: 'Reply-all to the whole company',
      story: 'I replied-all "lol same" to a 3,000-person email about the fire drill, then apologised to everyone.',
    }),
  ).toBe(true);
  await session.suggestAngles();
  session.setAngle(session.getSnapshot().angles![0]!.text);
  await session.approveAndDraft();
  session.approveDraft();
  await session.pay();
  expect(session.getSnapshot().trial.stage).toBe('jury');
  return session;
}

function renderCase(session: SoloSession) {
  return renderWithProviders(
    <Routes>
      <Route path="/solo/case/:trialId" element={<CasePage />} />
    </Routes>,
    { route: `/solo/case/${session.trial.id}` },
  );
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  window.localStorage.setItem('cc:motion', 'reduced');
});

describe('Solo jury deadlines that pass while the jury is paused (B1)', () => {
  it('commit window closed with one scroll sealed: NO VERDICT, says why, and the 1.20 refund is claimable', async () => {
    const court = resetDemoCourt({ latencyMs: 0, store: memoryQuotaStore() });
    const session = await paidCase(court);
    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    await session.commitBallot(1);
    court.clock.advanceTo(court.clock.now() + 16 * 60);

    const user = userEvent.setup();
    const { container } = renderCase(session);
    expect(await screen.findByRole('heading', { name: 'Verdict: NO VERDICT' }, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('The jury hit a snag')).not.toBeInTheDocument();
    expect(screen.getByText('Time ran out on part of the jury')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Claim your 1.20 USDC refund' }));
    expect(await screen.findByText('Refund claimed')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it('jury never filled before its window closed: case dismissed with a claimable refund', async () => {
    const court = resetDemoCourt({ latencyMs: 0, store: memoryQuotaStore() });
    const session = await paidCase(court);
    await session.seatNextJuror();
    court.clock.advanceTo(court.clock.now() + 6 * 60);

    const user = userEvent.setup();
    const { container } = renderCase(session);
    expect(await screen.findByRole('heading', { name: 'Case dismissed' }, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByText('The jury hit a snag')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Claim your 1.20 USDC refund' }));
    expect(await screen.findByText('Refund claimed')).toBeInTheDocument();
    await waitFor(async () => expect(await court.chain.usdcBalance(court.filer)).toBe(10_000_000n));
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);
});

describe('Solo demo clock (B19)', () => {
  it('a wall-clock jump on the device does not move the demo court clock', () => {
    const court = resetDemoCourt({ latencyMs: 0, store: memoryQuotaStore() });
    const before = court.clock.now();
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 3_549_000; // the host jumped ~1 h forward (playtest)
      expect(court.clock.now() - before).toBeLessThan(5);
    } finally {
      Date.now = realNow;
    }
    // Deliberate demo skips still work.
    court.clock.advanceTo(before + 600);
    expect(court.clock.now()).toBeGreaterThanOrEqual(before + 600);
  });
});
