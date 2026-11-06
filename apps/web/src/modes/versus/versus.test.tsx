import { createAudioEngine } from '@cringe-court/audio';
import { usdc } from '@cringe-court/core';
import { ManualClock, MemorySaltVault, MockIdentity, testAddress } from '@cringe-court/core/testing';
import { MemoryFactStore, VersusCounsel, VersusDesk, makeInviteCode, prepareBriefing, type Persona } from '@cringe-court/modes-versus';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router';
import { axe } from 'vitest-axe';
import type { RoamTrialProps } from '@/trial/RoamTrial';
import { __setCanRoamForTests } from '@/trial/trialView';
import { renderWithProviders } from '@/test/render';
import { CasePage } from './pages/CasePage';
import { CasesPage } from './pages/CasesPage';
import { JoinPage } from './pages/JoinPage';
import { NewCasePage } from './pages/NewCasePage';
import { VersusProvider } from './runtime/VersusProvider';

const roamSeen: RoamTrialProps[] = [];
vi.mock('@/trial/RoamTrial', () => ({
  RoamTrial: (props: RoamTrialProps) => {
    roamSeen.push(props);
    return <div data-testid="roam-stub">roam stub</div>;
  },
}));

/* One shared court (fact log + clock + counsel) and three people acting on it. */
function court() {
  const clock = new ManualClock(1_767_225_600);
  const store = new MemoryFactStore();
  const counsel = new VersusCounsel();
  const audio = createAudioEngine();
  let r = 0;
  const random = () => ((r = (r * 9301 + 49297) % 233280), r / 233280);
  const people: Record<'alice' | 'bob' | 'juror' | 'stranger', { persona: Persona; human: string; salts: MemorySaltVault; desk: VersusDesk }> = {} as never;
  for (const name of ['alice', 'bob', 'juror', 'stranger'] as const) {
    const persona: Persona = { id: `p-${name}`, name, account: testAddress(name) };
    const salts = new MemorySaltVault(`salt-${name}`);
    const human = `human-${name}`;
    people[name] = { persona, human, salts, desk: new VersusDesk({ store, persona, counsel, identity: new MockIdentity({ human }), salts, clock: clock.now, random }) };
  }

  /** Renders `ui` at `route` as `who`, under the same court. */
  function view(who: keyof typeof people, route: string, ui?: ReactElement) {
    const p = people[who];
    return renderWithProviders(
      <VersusProvider store={store} persona={p.persona} counsel={counsel} identity={() => new MockIdentity({ human: p.human })} salts={p.salts} clock={clock.now} audio={audio} tickMs={0}>
        {ui ?? (
          <Routes>
            <Route path="/versus/new" element={<NewCasePage />} />
            <Route path="/versus/join" element={<JoinPage />} />
            <Route path="/versus/join/:code" element={<JoinPage />} />
            <Route path="/versus/case/:trialId" element={<CasePage />} />
            <Route path="/versus/cases" element={<CasesPage />} />
          </Routes>
        )}
      </VersusProvider>,
      { route },
    );
  }
  return { clock, store, people, view, a: people.alice.desk, b: people.bob.desk, j: people.juror.desk };
}

const briefA = prepareBriefing({
  happened: 'We agreed to split the last dumpling. I went for napkins and came back to an empty plate.',
  why: 'A split is a contract. Napkin duty is a public service, not abandonment.',
  privateNotes: 'SECRET-A: this is the third dumpling incident this year.',
  angle: 'A deal is a deal.',
  nickname: 'Napkin Knight',
});
const briefB = prepareBriefing({
  happened: 'The dumpling was going cold. Leaving food unattended is a forfeit, everyone knows that.',
  why: 'Hot food waits for no one. I saved it from a tragic, lukewarm fate.',
  privateNotes: 'SECRET-B: I had already eaten four.',
  angle: 'Hot food waits for no one.',
  nickname: '',
});

type Court = ReturnType<typeof court>;

/** A well-formed invite code (valid check character) that is not `taken`. */
function validCodeOtherThan(taken: string): string {
  for (let seed = 1; ; seed++) {
    const code = makeInviteCode(() => (seed * 0.137) % 1);
    if (code !== taken) return code;
  }
}

async function filed(t: Court) {
  return t.a.fileCase({ title: 'The Last Dumpling', category: 'npc-behavior', patch: briefA.patch });
}

async function toFunding(t: Court) {
  const { trialId, code } = await filed(t);
  await t.b.acceptInvite(trialId);
  await t.b.saveBrief(trialId, 'b', briefB.patch);
  await t.a.addExhibit(trialId, 'a', { title: 'Group chat', body: 'me: splitting it 50/50 ok? them: deal' });
  await t.a.approveBrief(trialId, 'a');
  await t.b.approveBrief(trialId, 'b');
  await t.a.runCounsel(trialId);
  await t.a.approveDraft(trialId, 'a');
  await t.b.approveDraft(trialId, 'b');
  return { trialId, code };
}

async function toJury(t: Court) {
  await t.a.faucet(usdc('5.00'));
  await t.b.faucet(usdc('5.00'));
  await t.j.faucet(usdc('5.00'));
  const ids = await toFunding(t);
  await t.a.fund(ids.trialId);
  await t.b.fund(ids.trialId);
  return ids;
}

async function toVerdict(t: Court) {
  const ids = await toJury(t);
  await t.j.takeSeat(ids.trialId);
  await t.a.seatDemoJurors(ids.trialId, 'reliable');
  await t.j.commitBallot(ids.trialId, 0);
  t.clock.advance(30);
  await t.a.tick();
  await t.a.skipAhead(ids.trialId);
  await t.j.revealBallot(ids.trialId);
  t.clock.advance(30);
  await t.a.tick();
  await t.a.skipAhead(ids.trialId);
  await t.a.tick();
  await t.a.tick();
  return ids;
}

/** The paper section under a ribbon ("Pay your half", "Jury selection", …). */
async function panel(ribbon: string): Promise<HTMLElement> {
  const label = await screen.findByText(ribbon);
  return label.closest('section') as HTMLElement;
}

// Colour contrast needs real layout and CSS; the token pairs are checked in the design-system suite.
const AXE = { rules: { 'color-contrast': { enabled: false } } };

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('Versus: new case', () => {
  it('validates the case step, then moves on to the private briefing with Agent A', async () => {
    const t = court();
    const user = userEvent.setup();
    const { container } = t.view('alice', '/versus/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Settle it in court' })).toBeInTheDocument();
    expect(screen.getByText(/only once you have both approved the trial/)).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: /Brief Agent A/ }));
    expect(screen.getByText('Give the case a title')).toBeInTheDocument();
    expect(screen.getByText('Pick a category')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Case title/), 'The Last Dumpling');
    await user.click(screen.getByRole('radio', { name: /NPC Behavior/i }));
    await user.click(screen.getByRole('button', { name: /Brief Agent A/ }));
    expect(screen.getByRole('region', { name: 'Briefing' })).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});

describe('Versus: invite and join', () => {
  it('rejects a malformed code with a clear message', async () => {
    const t = court();
    const user = userEvent.setup();
    t.view('bob', '/versus/join');
    expect(await screen.findByRole('heading', { level: 1, name: 'Someone took you to court' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Invite code'), 'nope');
    await user.click(screen.getByRole('button', { name: /Open invite/ }));
    expect(screen.getByLabelText('Invite code')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows an empty state for a well-formed code that matches no case', async () => {
    const t = court();
    const { code } = await filed(t);
    t.view('bob', `/versus/join/${validCodeOtherThan(code)}`);
    expect(await screen.findByText('No case with that code here')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try another code' })).toHaveAttribute('href', '/versus/join');
  });

  it('gives Side A the invite with code and link, and Side B the summons', async () => {
    const t = court();
    const { trialId, code } = await filed(t);

    const a = t.view('alice', `/versus/case/${trialId}`);
    expect(await screen.findByText(code)).toBeInTheDocument();
    expect(await axe(a.container, AXE)).toHaveNoViolations();
    a.unmount();

    const user = userEvent.setup();
    const b = t.view('bob', `/versus/join/${code}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'You have been summoned' })).toBeInTheDocument();
    expect(screen.getAllByText(/The Last Dumpling/).length).toBeGreaterThan(0);
    // Side A's private notes never reach Side B, on the invite or anywhere else.
    expect(document.body.textContent).not.toContain('SECRET-A');
    expect(await axe(b.container, AXE)).toHaveNoViolations();

    await user.click(screen.getByRole('button', { name: /Accept/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/mock verifier/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Verify/ }));
    await waitFor(async () => expect((await t.b.world()).case(trialId)?.parties.b).toBeDefined());
  });
});

describe('Versus: honest invite pages (B8, B16)', () => {
  it('shows a closed invite under a closed hero, not the summons hero', async () => {
    const t = court();
    const { trialId, code } = await filed(t);
    await t.a.withdraw(trialId, 'a');
    t.view('bob', `/versus/join/${code}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'This invite has closed' })).toBeInTheDocument();
    expect(screen.queryByText('You have been summoned')).not.toBeInTheDocument();
  });

  it('shows an unknown invite under a not-found hero with an honest same-browser message', async () => {
    const t = court();
    const { code } = await filed(t);
    t.view('bob', `/versus/join/${validCodeOtherThan(code)}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'We can’t find that invite' })).toBeInTheDocument();
    expect(screen.queryByText('You have been summoned')).not.toBeInTheDocument();
    expect(screen.getByText(/keeps cases in this browser.*same browser.*can’t travel between devices/)).toBeInTheDocument();
  });

  it('labels the invite copy buttons as same-browser and says so next to them', async () => {
    const t = court();
    const { trialId } = await filed(t);
    t.view('alice', `/versus/case/${trialId}`);
    expect(await screen.findByRole('button', { name: 'Copy invite link (same browser)' })).toBeInTheDocument();
    expect(screen.getByTestId('invite-same-browser')).toHaveTextContent(/only work in this browser/);
  });
});

describe('Versus: no internal decision ids in player copy (item 7)', () => {
  it('keeps (D1)-style codes out of every Versus string', async () => {
    const { en } = await import('@/i18n');
    for (const [key, value] of Object.entries(en.versus)) expect(value, key).not.toMatch(/\(D\d+\)|, D\d+\)/);
  });
});

describe('Versus: the case room', () => {
  it('reports the same redactions in the case room as the review screen did (B11)', async () => {
    const t = court();
    const briefPhone = prepareBriefing({
      happened: 'We agreed to split the last dumpling. Call me on 555-123-4567 if you disagree, ok.',
      why: 'A split is a contract. Napkin duty is a public service, not abandonment.',
      privateNotes: '',
      angle: 'A deal is a deal.',
      nickname: 'Napkin Knight',
    });
    expect(briefPhone.redactions.story.map((h) => h.kind)).toEqual(['phone']);
    const { trialId } = await t.a.fileCase({ title: 'The Last Dumpling', category: 'npc-behavior', patch: briefPhone.patch });
    await t.b.acceptInvite(trialId);
    t.view('alice', `/versus/case/${trialId}`);
    await screen.findByRole('heading', { level: 1, name: /The Last Dumpling/ });
    expect(await screen.findByText(/Redaction pass: Removed 1 phone number/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Nothing needed removing');
  });

  it('shows a loading state, then an empty state for an unknown case', async () => {
    const t = court();
    t.view('alice', '/versus/case/vs-nope');
    expect(screen.getByText('Opening the case file…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'No such case in this court' })).toBeInTheDocument();
  });

  it('keeps a case private from strangers until the jury is called', async () => {
    const t = court();
    const { trialId } = await filed(t);
    await t.b.acceptInvite(trialId);
    t.view('stranger', `/versus/case/${trialId}`);
    expect(await screen.findByText('This case is still private')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('SECRET');
  });

  it('lets each side brief their own agent, and only sees their own private notes', async () => {
    const t = court();
    const { trialId } = await filed(t);
    await t.b.acceptInvite(trialId);
    await t.b.saveBrief(trialId, 'b', briefB.patch);
    const { container } = t.view('bob', `/versus/case/${trialId}`);
    await screen.findByRole('heading', { level: 1, name: /The Last Dumpling/ });
    expect(document.body.textContent).toContain('SECRET-B');
    expect(document.body.textContent).not.toContain('SECRET-A');
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('asks both sides to pay their half once the draft is approved', async () => {
    const t = court();
    await t.a.faucet(usdc('5.00'));
    const { trialId } = await toFunding(t);
    const user = userEvent.setup();
    const { container } = t.view('alice', `/versus/case/${trialId}`);
    const pay = await panel('Pay your half');
    expect(within(pay).getAllByText(/0\.70/).length).toBeGreaterThan(0);
    expect(await axe(container, AXE)).toHaveNoViolations();
    await user.click(within(pay).getByRole('button', { name: /Pay/ }));
    await waitFor(async () => expect((await t.a.world()).case(trialId)?.state).toMatchObject({ stage: 'counsel' }));
    expect(await screen.findByText('Your half is in escrow')).toBeInTheDocument();
  });

  it('invites a verified stranger onto the jury once both halves are in', async () => {
    const t = court();
    const { trialId } = await toJury(t);
    const { container } = t.view('juror', `/versus/case/${trialId}`);
    expect(await panel('Jury selection')).toBeInTheDocument();
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('runs the shared trial for a seated juror and seals the ballot (commit)', async () => {
    const t = court();
    const { trialId } = await toJury(t);
    await t.j.takeSeat(trialId);
    await t.a.seatDemoJurors(trialId, 'reliable');
    const user = userEvent.setup();
    const { container } = t.view('juror', `/versus/case/${trialId}`);
    const session = await panel('Court is in session');
    // The trial view and its transcript are always there for the jury.
    expect(within(session).getAllByText(/Napkin Knight|Side A/).length).toBeGreaterThan(0);
    expect(await axe(container, AXE)).toHaveNoViolations();
    await user.click(screen.getAllByRole('radio')[0]!);
    await user.click(screen.getByRole('button', { name: /Seal/ }));
    expect(await screen.findByText('Your scroll is sealed')).toBeInTheDocument();
    expect(await t.j.sealedChoice(trialId)).toBe(0);
  });

  it('shows the verdict, the settlement receipt and the share card to both sides', async () => {
    const t = court();
    const { trialId } = await toVerdict(t);
    const w = await t.a.world();
    expect(w.case(trialId)?.state.stage).toMatch(/verdict|appeal|share/);
    const { container } = t.view('alice', `/versus/case/${trialId}`);
    expect(await screen.findByText('The jury has spoken')).toBeInTheDocument();
    expect(screen.getByText('Settlement receipt')).toBeInTheDocument();
    expect(screen.getByText('Share card preview')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SECRET-[AB]/);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });

  it('tells a no-show mistrial apart from a real verdict (B13)', async () => {
    const t = court();
    const { trialId } = await toJury(t);
    await t.j.takeSeat(trialId);
    await t.a.seatDemoJurors(trialId, 'two-no-shows');
    await t.j.commitBallot(trialId, 0);
    t.clock.advance(30);
    await t.a.tick();
    await t.a.skipAhead(trialId);
    await t.j.revealBallot(trialId);
    await t.a.skipAhead(trialId);
    await t.a.tick();
    await t.a.tick();
    expect((await t.a.world()).case(trialId)?.state).toMatchObject({ stage: 'verdict', verdict: { kind: 'no-verdict' } });
    t.view('alice', `/versus/case/${trialId}`);
    expect(await screen.findByText('No verdict')).toBeInTheDocument();
    expect(screen.queryByText('The jury has spoken')).not.toBeInTheDocument();
    expect(screen.getByText(/Mistrial: no verdict\. Claim your refund\./)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Verdict is in|Claim your payout|could not agree/);
    expect(screen.getByText(/^MISTRIAL\. Not enough jurors opened their scrolls/)).toBeInTheDocument();
  });

  it('refunds the side that paid when the other misses the funding deadline', async () => {
    const t = court();
    await t.a.faucet(usdc('5.00'));
    const { trialId } = await toFunding(t);
    await t.a.fund(trialId);
    await t.a.skipAhead(trialId);
    await t.a.tick();
    const { container } = t.view('alice', `/versus/case/${trialId}`);
    await screen.findByRole('heading', { level: 1, name: /The Last Dumpling/ });
    expect(document.body.textContent).toMatch(/refund/i);
    expect(await axe(container, AXE)).toHaveNoViolations();
  });
});

describe('Versus: my cases', () => {
  it('shows an empty docket, then the cases this persona is part of', async () => {
    const t = court();
    const first = t.view('alice', '/versus/cases');
    expect(await screen.findByText('No cases yet')).toBeInTheDocument();
    expect(await axe(first.container, AXE)).toHaveNoViolations();
    first.unmount();

    await act(async () => {
      await filed(t);
    });
    const second = t.view('alice', '/versus/cases');
    expect((await screen.findAllByText(/The Last Dumpling/)).length).toBeGreaterThan(0);
    expect(await axe(second.container, AXE)).toHaveNoViolations();
  });
});


describe('Versus: the trial in the roaming courtroom', () => {
  beforeEach(() => {
    roamSeen.length = 0;
    window.localStorage.removeItem('cc:trial-view');
    __setCanRoamForTests(true);
  });
  afterEach(() => __setCanRoamForTests(null));

  it('seats a juror in the jury view, plays roam first without a verdict, and falls back to the classic stage on exit', async () => {
    const t = court();
    const { trialId } = await toJury(t);
    await t.j.takeSeat(trialId);
    await t.a.seatDemoJurors(trialId, 'reliable');
    t.view('juror', `/versus/case/${trialId}`);
    await panel('Court is in session');
    expect(await screen.findByTestId('roam-stub')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /^Courtroom/ })).not.toBeInTheDocument();
    const props = roamSeen.at(-1)!;
    expect(props.role).toBe('juror');
    expect(props.spawn).toBe('jury-box');
    expect(props.avatar).toMatchObject({ model: 'creator', name: 'juror' });
    expect(props.beats.length).toBeGreaterThan(2);
    expect(props.beats.some((b) => b.id === 'verdict')).toBe(false);
    act(() => props.onExit());
    await waitFor(() => expect(screen.queryByTestId('roam-stub')).not.toBeInTheDocument());
  });

  it('seats Side A at the prosecution table (the filer’s side) and ends the replay with a verdict beat', async () => {
    const t = court();
    const { trialId } = await toVerdict(t);
    const user = userEvent.setup();
    t.view('alice', `/versus/case/${trialId}`);
    await screen.findByText('The jury has spoken');
    expect(screen.queryByTestId('roam-stub')).not.toBeInTheDocument();
    await user.click(screen.getByText('Watch the trial again'));
    expect(await screen.findByTestId('roam-stub')).toBeInTheDocument();
    const props = roamSeen.at(-1)!;
    expect(props.role).toBe('side-a');
    expect(props.spawn).toBe('prosecution');
    expect(props.beats.at(-1)!.id).toBe('verdict');
  });
});
