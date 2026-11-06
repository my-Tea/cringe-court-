import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { memoryQuotaStore } from '@cringe-court/modes-solo';
import { renderWithProviders } from '@/test/render';
import { __setCanRoamForTests } from '@/trial/trialView';
import type { RoamTrialProps } from '@/trial/RoamTrial';
import { CasePage } from '../case/CasePage';
import { FilePage } from '../file/FilePage';
import { resetDemoCourt } from '../lib/demoCourt';

const seen: RoamTrialProps[] = [];
vi.mock('@/trial/RoamTrial', () => ({
  RoamTrial: (props: RoamTrialProps) => {
    seen.push(props);
    return <div data-testid="roam-stub">roam stub</div>;
  },
}));

beforeEach(() => {
  seen.length = 0;
  resetDemoCourt({ latencyMs: 0, store: memoryQuotaStore() });
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  window.localStorage.setItem('cc:motion', 'reduced');
  window.localStorage.removeItem('cc:trial-view');
  __setCanRoamForTests(true);
});
afterEach(() => __setCanRoamForTests(null));

describe('Solo trial in the roaming courtroom', () => {
  it('plays roam first with the frozen transcript as beats, and toggles to the classic stage', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/solo/file" element={<FilePage />} />
        <Route path="/solo/case/:trialId" element={<CasePage />} />
      </Routes>,
      { route: '/solo/file' },
    );
    await user.click(await screen.findByRole('radio', { name: /NPC Behavior/ }));
    await user.click(screen.getByRole('button', { name: /Use the example confession/ }));
    await user.click(screen.getByRole('button', { name: 'File the confession' }));
    await screen.findByRole('heading', { name: 'Brief your lawyer' });
    await user.click(screen.getByRole('button', { name: /Ask Counsel Chaos for angles/ }));
    await user.click(await screen.findByRole('radio', { name: /muscle memory/ }));
    await user.click(screen.getByRole('button', { name: 'Watch the free teaser' }));
    await screen.findByRole('heading', { name: /Free teaser/ });
    await user.click(screen.getByRole('button', { name: /Approve and send to counsel/ }));
    await screen.findByRole('heading', { name: 'Review the script' });
    await user.click(screen.getByRole('button', { name: /Freeze the transcript/ }));
    await screen.findByRole('heading', { name: /Take it to a jury/ });
    await user.click(screen.getByRole('button', { name: /Pay 1.20 USDC and open the case/ }));

    await screen.findByRole('heading', { name: 'All rise' }, { timeout: 8000 });
    expect(await screen.findByTestId('roam-stub')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Courtroom:/ })).not.toBeInTheDocument();
    const props = seen.at(-1)!;
    expect(props.role).toBe('defendant');
    expect(props.spawn).toBe('defendant');
    expect(props.avatar?.model).toBe('creator');
    expect(props.beats.length).toBeGreaterThan(2);
    expect(props.beats[0]!.id).toBe('all-rise');
    expect(props.beats.some((b) => b.id === 'verdict')).toBe(false);
    expect(screen.getByRole('button', { name: /Skip to the jury/ })).toBeInTheDocument();

    props.onExit();
    expect(await screen.findByRole('region', { name: /^Courtroom:/ })).toBeInTheDocument();
    expect(screen.queryByTestId('roam-stub')).not.toBeInTheDocument();
  }, 30000);
});
