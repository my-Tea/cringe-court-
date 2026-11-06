import { createDemoCourt } from '@cringe-court/modes-grand-jury';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { MotionProvider } from '@/ds/motion/MotionProvider';
import { ToastProvider } from '@/ds/components/Toast/Toast';
import { TooltipProvider } from '@/ds/components/Tooltip/Tooltip';
import type { RoamTrialProps } from '@/trial/RoamTrial';
import { __setCanRoamForTests } from '@/trial/trialView';
import grandJury from '../mode';
import { __setDemoCourtForTests } from '../state/context';

const seen: RoamTrialProps[] = [];
vi.mock('@/trial/RoamTrial', () => ({
  RoamTrial: (props: RoamTrialProps) => {
    seen.push(props);
    return <div data-testid="roam-stub">roam stub</div>;
  },
}));

const T0 = 1_800_000_000;
let demo: Awaited<ReturnType<typeof createDemoCourt>>;
let now = T0;

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/grand-jury', children: grandJury.routes ?? [] }], { initialEntries: [path] });
  return render(
    <MotionProvider>
      <TooltipProvider delayDuration={0}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </TooltipProvider>
    </MotionProvider>,
  );
}
const caseNumberOf = async (slug: string) => (await demo.court.list()).find((e) => e.file.slug === slug)!.caseNumber;

beforeEach(async () => {
  seen.length = 0;
  now = T0;
  demo = await createDemoCourt({ realNow: () => now });
  __setDemoCourtForTests(Promise.resolve(demo));
  document.documentElement.setAttribute('data-reduced-motion', 'true');
  window.localStorage.removeItem('cc:trial-view');
  __setCanRoamForTests(true);
});
afterEach(() => {
  __setCanRoamForTests(null);
  demo.dispose();
  __setDemoCourtForTests(null);
});

describe('Grand Jury hearing in the roaming courtroom', () => {
  it('a gallery spectator watches from the aisle; a revealed verdict ends the hearing; onExit shows the classic stage', async () => {
    renderAt(`/grand-jury/case/${await caseNumberOf('hot-dog-sandwich')}`);
    expect(await screen.findByTestId('roam-stub')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'The hearing' })).not.toBeInTheDocument();
    const props = seen.at(-1)!;
    expect(props.role).toBe('spectator');
    expect(props.spawn).toBe('aisle');
    expect(props.avatar?.model).toBe('creator');
    expect(props.beats[0]!.id).toBe('all-rise');
    const verdict = props.beats.at(-1)!;
    expect(verdict.id).toBe('verdict');
    expect(['side-a', 'side-b']).toContain(verdict.options.verdict);
    expect(verdict.options.verdictText).toMatch(/\S/);

    props.onExit();
    expect(await screen.findByRole('region', { name: 'The hearing' })).toBeInTheDocument();
    expect(screen.queryByTestId('roam-stub')).not.toBeInTheDocument();
  });

  it('no verdict beat before the scrolls are opened', async () => {
    renderAt(`/grand-jury/case/${await caseNumberOf('tabs-vs-spaces')}`);
    await screen.findByTestId('roam-stub');
    expect(seen.at(-1)!.beats.some((b) => b.id === 'verdict')).toBe(false);
  });

  it('a seated juror watches from the jury box', async () => {
    const user = userEvent.setup();
    const n = await caseNumberOf('pineapple-pizza');
    for (let t = 0; t < 300; t += 5) {
      now += 5;
      await demo.sim.tick();
    }
    renderAt(`/grand-jury/case/${n}`);
    await user.click(await screen.findByRole('button', { name: /Volunteer for the jury/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Juror Screening' });
    await user.click(await within(dialog).findByRole('button', { name: /Verify with World ID/ }));
    await user.click(await screen.findByRole('button', { name: /I swear to show up/ }));
    await waitFor(() => expect(seen.at(-1)!.role).toBe('juror'));
    expect(seen.at(-1)!.spawn).toBe('jury-view');
    expect(seen.at(-1)!.beats.some((b) => b.id === 'verdict')).toBe(false);
  });
});
