import { usdc } from '@cringe-court/core';
import { ManualClock, MemorySaltVault, MockIdentity, testAddress } from '@cringe-court/core/testing';
import { MemoryFactStore, VersusCounsel, VersusDesk, prepareBriefing, type Persona } from '@cringe-court/modes-versus';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '@/test/render';
import { CasePage } from './pages/CasePage';
import { VersusProvider } from './runtime/VersusProvider';

vi.mock('@/trial/RoamTrial', () => ({ RoamTrial: () => <div data-testid="roam-stub">roam stub</div> }));

/**
 * B2 (UX evaluation): a juror watching the hearing must see their ballot, the
 * time left and a way to it without scrolling past the trial, and must be
 * warned in the last minute.
 */
function court() {
  const clock = new ManualClock(1_767_225_600);
  const store = new MemoryFactStore();
  const counsel = new VersusCounsel();
  let r = 0;
  const random = () => ((r = (r * 9301 + 49297) % 233280), r / 233280);
  const make = (name: string) => {
    const persona: Persona = { id: `p-${name}`, name, account: testAddress(name) };
    const salts = new MemorySaltVault(`salt-${name}`);
    const human = `human-${name}`;
    return { persona, human, salts, desk: new VersusDesk({ store, persona, counsel, identity: new MockIdentity({ human }), salts, clock: clock.now, random }) };
  };
  const a = make('alice');
  const b = make('bob');
  const j = make('juror');
  const view = (route: string) =>
    renderWithProviders(
      <VersusProvider store={store} persona={j.persona} counsel={counsel} identity={() => new MockIdentity({ human: j.human })} salts={j.salts} clock={clock.now} tickMs={0}>
        <Routes>
          <Route path="/versus/case/:trialId" element={<CasePage />} />
        </Routes>
      </VersusProvider>,
      { route },
    );
  return { clock, a: a.desk, b: b.desk, j: j.desk, view };
}

const brief = (happened: string, angle: string) =>
  prepareBriefing({ happened, why: 'Because a deal is a deal and everybody at the table heard it.', privateNotes: '', angle, nickname: '' }).patch;

async function seated(t: ReturnType<typeof court>) {
  for (const d of [t.a, t.b, t.j]) await d.faucet(usdc('5.00'));
  const { trialId } = await t.a.fileCase({ title: 'The Last Dumpling', category: 'npc-behavior', patch: brief('We agreed to split the last dumpling and then it vanished.', 'A deal is a deal.') });
  await t.b.acceptInvite(trialId);
  await t.b.saveBrief(trialId, 'b', brief('The dumpling was going cold, so I saved it from a lukewarm fate.', 'Hot food waits for no one.'));
  await t.a.approveBrief(trialId, 'a');
  await t.b.approveBrief(trialId, 'b');
  await t.a.runCounsel(trialId);
  await t.a.approveDraft(trialId, 'a');
  await t.b.approveDraft(trialId, 'b');
  await t.a.fund(trialId);
  await t.b.fund(trialId);
  await t.j.takeSeat(trialId);
  await t.a.seatDemoJurors(trialId, 'reliable');
  return trialId;
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('Versus juror ballot HUD during the hearing (B2)', () => {
  it('sits above the hearing with the time left and takes the juror to the ballot', async () => {
    const t = court();
    const trialId = await seated(t);
    const user = userEvent.setup();
    const { container } = t.view(`/versus/case/${trialId}`);

    const hud = await screen.findByRole('region', { name: 'Your ballot' });
    const trial = screen.getByRole('region', { name: 'The trial' });
    expect(trial).toContainElement(hud);
    // Before the hearing itself, so it is the first thing a juror sees.
    const hearing = trial.querySelector('[data-view]')!;
    expect(hearing).not.toBeNull();
    expect(hud.compareDocumentPosition(hearing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(hud).getByText('Your vote: not sealed yet')).toBeInTheDocument();
    expect(within(hud).getByRole('timer')).toBeInTheDocument();
    expect(within(hud).getByText(/Scrolls must be sealed in/)).toBeInTheDocument();

    await user.click(within(hud).getByRole('button', { name: /Vote now/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getAllByRole('radio')[0]);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('warns in the last minute, then confirms once the scroll is sealed', async () => {
    const t = court();
    const trialId = await seated(t);
    t.view(`/versus/case/${trialId}`);
    await screen.findByRole('region', { name: 'Your ballot' });

    const s = (await t.a.world()).case(trialId)!.state;
    if (s.stage !== 'jury' || s.commitEndsAt === null) throw new Error('not in commit');
    await act(async () => {
      t.clock.advance(s.commitEndsAt! - t.clock.now() - 45);
      await t.a.faucet(usdc('0.01')); // any write rebuilds the world for the open tab
    });
    const hud = screen.getByRole('region', { name: 'Your ballot' });
    await waitFor(() => expect(within(hud).getByText(/Under a minute left/)).toBeInTheDocument());
    expect(hud).toHaveAttribute('data-urgent');

    await act(async () => {
      await t.j.commitBallot(trialId, 0);
    });
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Your ballot' })).getByText('Sealed. Your vote is locked in')).toBeInTheDocument());
  });
});
