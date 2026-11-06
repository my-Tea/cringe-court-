import { createDemoCourt } from '@cringe-court/modes-grand-jury';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { axe } from 'vitest-axe';
import { MotionProvider } from '@/ds/motion/MotionProvider';
import { ToastProvider } from '@/ds/components/Toast/Toast';
import { TooltipProvider } from '@/ds/components/Tooltip/Tooltip';
import grandJury from '../mode';
import { __setDemoCourtForTests } from '../state/context';

const T0 = 1_800_000_000;
const AXE = { rules: { 'color-contrast': { enabled: false } } } as const;

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/grand-jury', children: grandJury.routes ?? [] }], { initialEntries: [path] });
  const utils = render(
    <MotionProvider>
      <TooltipProvider delayDuration={0}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </MotionProvider>,
  );
  return { ...utils, router };
}

let demo: Awaited<ReturnType<typeof createDemoCourt>>;
let now = T0;
/** Let the simulated crowd act for `seconds` of court time, in 5 s steps. */
async function runWorld(seconds: number) {
  for (let t = 0; t < seconds; t += 5) {
    now += 5;
    await demo.sim.tick();
  }
}
beforeEach(async () => {
  // A court on a clock the test controls: the once-a-second heartbeat runs but time only moves in runWorld().
  now = T0;
  demo = await createDemoCourt({ realNow: () => now });
  __setDemoCourtForTests(Promise.resolve(demo));
  document.documentElement.setAttribute('data-reduced-motion', 'true');
});
afterEach(() => {
  demo.dispose();
  __setDemoCourtForTests(null);
});

const caseNumberOf = async (slug: string) => (await demo.court.list()).find((e) => e.file.slug === slug)!.caseNumber;

describe('Grand Jury docket', () => {
  it('lists every case, filters by status, topic and search, and has an empty state', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/grand-jury/docket');
    expect(await screen.findByRole('heading', { level: 1, name: 'The Grand Jury docket' })).toBeInTheDocument();
    expect(await screen.findByText('8 cases')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Happening now' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Decided/ }));
    expect(screen.getByRole('button', { name: /Decided/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('4 of 8 cases')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /All cases/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search the docket' }), 'soup');
    await waitFor(() => expect(screen.getByText('1 of 8 cases')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Is cereal a soup?' })).toHaveAttribute('href', `/grand-jury/case/${await caseNumberOf('cereal-is-soup')}`);

    await user.clear(screen.getByRole('searchbox', { name: 'Search the docket' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search the docket' }), 'zzzz');
    expect(await screen.findByRole('heading', { name: 'No case matches' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('8 cases')).toBeInTheDocument();

    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});

describe('Grand Jury topics', () => {
  it('labels cases with Grand Jury topics, not the Solo crime categories, and filters by them', async () => {
    const user = userEvent.setup();
    renderAt('/grand-jury/docket');
    await screen.findByText('8 cases');
    const group = screen.getByRole('group', { name: 'Topic' });
    expect(within(group).getByRole('button', { name: 'Food fight' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Etiquette' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: /Crypto|Dating|NPC Behavior|Internet Crimes/ })).toBeNull();
    expect(screen.queryByText(/NPC Behavior|Internet Crimes/)).toBeNull();
    await user.click(within(group).getByRole('button', { name: 'Food fight' }));
    expect(await screen.findByText('3 of 8 cases')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Does pineapple belong on pizza?' })).toBeInTheDocument();
  });

  it('shows the topic on the case page header', async () => {
    const n = await caseNumberOf('pineapple-pizza');
    renderAt(`/grand-jury/case/${n}`);
    await screen.findByRole('heading', { level: 1, name: 'Does pineapple belong on pizza?' });
    expect(screen.getByText('Food fight')).toBeInTheDocument();
    expect(screen.queryByText('NPC Behavior')).toBeNull();
  });
});

describe('Grand Jury case page', () => {
  it('summons the court: validates the amount, contributes and credits the viewer', async () => {
    const user = userEvent.setup();
    const n = await caseNumberOf('tabs-vs-spaces');
    const { container } = renderAt(`/grand-jury/case/${n}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Should code be indented with tabs?' })).toBeInTheDocument();
    const field = screen.getByLabelText(/Your contribution/);
    await user.clear(field);
    await user.type(field, '0.01');
    await user.tab();
    expect(await screen.findByText(/Contributions start at/)).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '1.00');
    await user.click(screen.getByRole('button', { name: /Summon with 1.00 USDC/ }));
    expect(await screen.findByText(/You have chipped in 1.00 USDC/)).toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('juror duty: World ID screening, a random seat offer, the oath, then a sealed ballot and a scroll', async () => {
    const user = userEvent.setup();
    const n = await caseNumberOf('pineapple-pizza');
    await runWorld(300); // the crowd fills six of the seven seats and leaves the last one for a visitor
    renderAt(`/grand-jury/case/${n}`);
    await user.click(await screen.findByRole('button', { name: /Volunteer for the jury/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Juror Screening' });
    expect(await axe(dialog, AXE)).toHaveNoViolations();
    await user.click(within(dialog).getByRole('button', { name: /Verify with World ID/ }));
    expect(await screen.findByRole('heading', { name: 'A seat is offered to you' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /I swear to show up/ }));
    expect(await screen.findByRole('heading', { name: 'Seal your ballot' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Seal my ballot/ })).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('radio', { name: /PINEAPPLE BELONGS/ }));
    await user.click(screen.getByRole('button', { name: /Seal my ballot/ }));
    expect(await screen.findByRole('heading', { name: 'Ballot sealed' })).toBeInTheDocument();
    expect((screen.getByLabelText(/Secret Verdict Scroll/) as HTMLTextAreaElement).value).toMatch(new RegExp(`^ccgj1\\.${n}\\.0x[0-9a-f]{40}\\.0\\.`));
  });

  it('shows a settled verdict with the tally, the money disclosure and a share card', async () => {
    const n = await caseNumberOf('hot-dog-sandwich');
    const { container } = renderAt(`/grand-jury/case/${n}`);
    expect(await screen.findByRole('heading', { name: '5 of 7 strangers agreed' })).toBeInTheDocument();
    expect(screen.getByText(/Where every .* test USDC went/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Share card: CASE #\d+, Is a hot dog a sandwich\?/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The gallery' })).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('scrolls to and focuses the verdict heading when settling reveals it (B3)', async () => {
    const user = userEvent.setup();
    const n = await caseNumberOf('k-reply');
    for (let i = 0; i < 200; i++) {
      const c = (await demo.chain.getCase(n))!;
      if (c.phase === 'finalizing') break;
      await runWorld(5);
    }
    expect((await demo.chain.getCase(n))!.phase).toBe('finalizing');
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    renderAt(`/grand-jury/case/${n}`);
    await user.click(await screen.findByRole('button', { name: 'Settle and read the verdict' }));
    const heading = await screen.findByRole('heading', { name: /strangers agreed|No verdict/ });
    const scrolledVerdict = () => scrollIntoView.mock.contexts.some((el) => (el as Element).getAttribute('aria-labelledby') === 'verdict-title');
    await waitFor(() => expect(scrolledVerdict()).toBe(true));
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(heading);
  });

  it('does not steal focus or scroll when an already-decided case loads', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const n = await caseNumberOf('hot-dog-sandwich');
    renderAt(`/grand-jury/case/${n}`);
    await screen.findByRole('heading', { name: '5 of 7 strangers agreed' });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('steps through the hearing in the trial view', async () => {
    const user = userEvent.setup();
    const n = await caseNumberOf('hot-dog-sandwich');
    renderAt(`/grand-jury/case/${n}`);
    const hearing = await screen.findByRole('region', { name: 'The hearing' });
    expect(within(hearing).getByText(/Line 1 of \d+/)).toBeInTheDocument();
    expect(within(hearing).getByRole('button', { name: 'Previous line' })).toBeDisabled();
    await user.click(within(hearing).getByRole('button', { name: 'Next line' }));
    expect(within(hearing).getByText(/Line 2 of \d+/)).toBeInTheDocument();
  });

  it('says so when the case does not exist', async () => {
    renderAt('/grand-jury/case/abc');
    expect(await screen.findByRole('heading', { level: 1, name: 'No such case on the docket' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to the docket/ })).toHaveAttribute('href', '/grand-jury/docket');
  });
});

describe('My court and Who pays', () => {
  it('lists what needs the viewer, then collects a payout', async () => {
    const user = userEvent.setup();
    const { container } = renderAt('/grand-jury/duty');
    expect(await screen.findByRole('heading', { level: 1, name: 'My court' })).toBeInTheDocument();
    expect(await screen.findByText(/Collect 2.10 USDC/)).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
    await user.click(screen.getAllByRole('link', { name: /Collect/ })[0]!);
    await user.click(await screen.findByRole('button', { name: /Collect 2.10 USDC/ }));
    expect(await screen.findByText('Collected.')).toBeInTheDocument();
  });

  it('explains D10: both pricing phases and the hackathon marketing cap', async () => {
    const { container } = renderAt('/grand-jury/pricing');
    expect(await screen.findByRole('heading', { level: 1, name: 'Who pays for a public trial' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Hackathon docket/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sponsored Docket' })).toBeInTheDocument();
    expect(screen.getByText(/7.80 USDC/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Marketing cap used' })).toHaveAttribute('aria-valuemax', '40');
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});

describe('simulation heartbeat', () => {
  it('logs a failing tick instead of leaving an unhandled rejection, and keeps ticking (B9)', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tick = vi.spyOn(demo.sim, 'tick').mockRejectedValue(new Error('Minimum contribution is 0.10 USDC'));
    renderAt('/grand-jury/docket');
    await waitFor(() => expect(tick.mock.calls.length).toBeGreaterThanOrEqual(2), { timeout: 4000 });
    await new Promise((r) => setTimeout(r, 50));
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('simulation tick failed'), expect.any(Error));
    warn.mockRestore();
  });
});

describe('loading and errors', () => {
  it('shows the loading state, then an error with a retry when the court fails to start', async () => {
    let fail!: (e: Error) => void;
    __setDemoCourtForTests(new Promise((_, reject) => (fail = reject)));
    renderAt('/grand-jury/docket');
    expect(await screen.findByText('Calling the court to order…')).toBeInTheDocument();
    await act(async () => fail(new Error('ledger offline')));
    expect(await screen.findByText('The court could not sit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('TrialView seam', () => {
  it('hands every beat to the room behind the hearing (the roam.runBeat hook)', async () => {
    const { TrialView } = await import('../components/TrialView');
    const { renderWithProviders } = await import('@/test/render');
    const detail = (await demo.court.detail(await caseNumberOf('hot-dog-sandwich')))!;
    const beats: number[] = [];
    const user = userEvent.setup();
    renderWithProviders(<TrialView detail={detail} onBeat={(line, i) => beats.push(i) && expect(line.id).toBe(detail.transcript[i]!.id)} />);
    await user.click(screen.getByRole('button', { name: 'Next line' }));
    await user.click(screen.getByRole('button', { name: 'Next line' }));
    expect(beats).toEqual([0, 1, 2]);
  });
});
