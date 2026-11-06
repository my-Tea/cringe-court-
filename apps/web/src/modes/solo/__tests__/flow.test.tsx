import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { axe } from 'vitest-axe';
import { memoryQuotaStore } from '@cringe-court/modes-solo';
import { renderWithProviders } from '@/test/render';
import { CasePage } from '../case/CasePage';
import { DocketPage } from '../case/DocketPage';
import { FilePage } from '../file/FilePage';
import { readDocket, resetDemoCourt } from '../lib/demoCourt';

function App({ route }: { route: string }) {
  return renderWithProviders(
    <Routes>
      <Route path="/solo/file" element={<FilePage />} />
      <Route path="/solo/case/:trialId" element={<CasePage />} />
      <Route path="/solo/docket" element={<DocketPage />} />
      <Route path="/solo" element={<p>landing</p>} />
    </Routes>,
    { route },
  );
}

beforeEach(() => {
  resetDemoCourt({ latencyMs: 0, store: memoryQuotaStore() });
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  // Fast jury pacing and no typewriter.
  window.localStorage.setItem('cc:motion', 'reduced');
});

describe('Solo filing → trial → jury → verdict → share', () => {
  it('runs the whole case in the demo court, accessibly', async () => {
    const user = userEvent.setup();
    const { container } = App({ route: '/solo/file' });

    // Step 1: validation summary, then a valid confession.
    expect(await screen.findByRole('heading', { name: 'Confess your crime against common sense' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'File the confession' }));
    const summary = (await screen.findByText('A few things before the court can hear this')).closest('[tabindex="-1"]') as HTMLElement;
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole('link', { name: /kind of crime/ })).toHaveAttribute('href', '#solo-category');
    await user.click(screen.getByRole('radio', { name: /NPC Behavior/ }));
    await user.click(screen.getByRole('button', { name: /Use the example confession/ }));
    await user.type(screen.getByLabelText(/Private notes for Counsel Chaos/), 'SECRET: my manager replied-all first.');
    await user.click(screen.getByRole('button', { name: 'File the confession' }));

    // Step 2: public record, evidence, angle, teaser.
    expect(await screen.findByRole('heading', { name: 'Brief your lawyer' })).toBeInTheDocument();
    expect(screen.queryByText(/SECRET/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Exhibit title'), 'The email');
    await user.type(screen.getByLabelText('What it shows'), 'lol same, sent to everyone@corp.example');
    await user.click(screen.getByRole('button', { name: 'Add exhibit' }));
    expect(await screen.findByText(/\[email redacted\]/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Ask Counsel Chaos for angles/ }));
    await user.click(await screen.findByRole('radio', { name: /muscle memory/ }));
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: 'Watch the free teaser' }));
    expect(await screen.findByRole('heading', { name: /Free teaser/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Approve and send to counsel/ }));

    // Step 4: review, then freeze.
    expect(await screen.findByRole('heading', { name: 'Review the script' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: /Miss Ratio argument strength/ })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: /Freeze the transcript/ }));

    // Step 5: price and outcomes, then pay.
    expect(await screen.findByRole('heading', { name: /Take it to a jury/ })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('NO VERDICT');
    expect(screen.getByRole('switch', { name: /0G Compute Pass/ })).toHaveAttribute('aria-checked', 'false');
    expect(await axe(container)).toHaveNoViolations();
    await user.click(screen.getByRole('button', { name: /Pay 1.20 USDC and open the case/ }));

    // The case: jury seats fill, then the trial.
    expect(await screen.findByRole('heading', { name: 'All rise' }, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.getByText('CASE #0069')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Skip to the jury/ }));

    // Verdict.
    const verdict = await screen.findByRole('heading', { name: /Verdict: (GUILTY|NOT COOKED)/ }, { timeout: 15000 });
    expect(verdict).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'How each juror voted' }).querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'What the court kept' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What the court kept' }).closest('section')).toHaveTextContent(/Total\s*0\.30/);
    // jsdom has no canvas: the card degrades to the caption, which still works.
    expect(screen.getByRole('heading', { name: 'Share the verdict' })).toBeInTheDocument();
    expect(screen.getByText('This browser cannot draw the card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PNG' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('link', { name: /Post on X/ })).toHaveAttribute('href', expect.stringContaining('x.com/intent/post'));
    expect(await axe(container)).toHaveNoViolations();

    // Kept in the docket.
    await waitFor(() => expect(readDocket()).toHaveLength(1));
  }, 40000);
});

describe('Solo docket and missing cases', () => {
  it('shows an empty docket with a way in', async () => {
    const { container } = App({ route: '/solo/docket' });
    expect(await screen.findByRole('heading', { name: 'No verdicts yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /File your first confession/ })).toHaveAttribute('href', '/solo/file');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('explains a case that is not in this browser', async () => {
    const { container } = App({ route: '/solo/case/solo-nope' });
    expect(await screen.findByRole('heading', { level: 1, name: 'This case is not in this browser' })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });
});
