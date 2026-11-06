import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import { EMPTY_DRAFT, memoryQuotaStore, type SoloSession } from '@cringe-court/modes-solo';
import { renderWithProviders } from '@/test/render';
import { VerdictPanel } from '../case/VerdictPanel';
import { resetDemoCourt } from '../lib/demoCourt';

async function mistrial(session: SoloSession) {
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
}

describe('VerdictPanel', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
  });

  it('shows a mistrial with a full refund the filer can claim', async () => {
    const court = resetDemoCourt({ latencyMs: 0, store: memoryQuotaStore() });
    const session = court.startSession();
    await mistrial(session);
    const snap = session.getSnapshot();
    if (snap.trial.stage !== 'verdict') throw new Error(snap.trial.stage);
    const user = userEvent.setup();
    const { container, rerender } = renderWithProviders(<VerdictPanel snap={{ ...snap, trial: snap.trial }} session={session} />);
    expect(screen.getByRole('heading', { name: 'Verdict: NO VERDICT' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'You get it all back' })).toBeInTheDocument();
    expect(screen.getByText('Mistrial. Everyone gets a refund.')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: /Claim your 1.20 USDC refund/ }));
    await waitFor(() => expect(session.getSnapshot().claimed).toBe(true));
    const after = session.getSnapshot();
    if (after.trial.stage !== 'verdict') throw new Error();
    rerender(<VerdictPanel snap={{ ...after, trial: after.trial }} session={session} />);
    expect(screen.getByText('Refund claimed')).toBeInTheDocument();
  });
});
