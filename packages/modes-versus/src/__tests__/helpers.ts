import { ManualClock, MemorySaltVault, MockIdentity, testAddress } from '@cringe-court/core/testing';
import { BASE_MODES, briefsFor, type CounselRequest, type Filing } from '@cringe-court/core';
import { prepareBriefing } from '../briefing';
import { VersusCounsel } from '../counsel';
import { VersusDesk } from '../desk';
import { MemoryFactStore } from '../store';

export function rig() {
  const clock = new ManualClock(1_767_225_600);
  const store = new MemoryFactStore();
  const counsel = new VersusCounsel();
  let r = 0;
  const random = () => ((r = (r * 9301 + 49297) % 233280), r / 233280);
  const desk = (name: string, human: string) =>
    new VersusDesk({
      store,
      persona: { id: `p-${name}`, name, account: testAddress(name) },
      counsel,
      identity: new MockIdentity({ human }),
      salts: new MemorySaltVault(`salt-${name}`),
      clock: clock.now,
      random,
    });
  return { clock, store, counsel, a: desk('alice', 'human-a'), b: desk('bob', 'human-b'), j: desk('juror', 'human-j') };
}

export type Rig = ReturnType<typeof rig>;

export const briefA = prepareBriefing({
  happened: 'We agreed to split the last dumpling. I went for napkins and came back to an empty plate. Call me at 555-123-4567.',
  why: 'A split is a contract. Napkin duty is a public service, not abandonment.',
  privateNotes: 'SECRET-A: this is the third dumpling incident this year.',
  angle: 'A deal is a deal.',
  nickname: 'Napkin Knight',
});

export const briefB = prepareBriefing({
  happened: 'The dumpling was going cold. Leaving food unattended is a forfeit, everyone knows that.',
  why: 'Hot food waits for no one. I saved it from a tragic, lukewarm fate.',
  privateNotes: 'SECRET-B: I had already eaten four.',
  angle: 'Hot food waits for no one.',
  nickname: '',
});

/** Files a case, has both sides brief and approve, runs counsel and approves the draft. Stops at funding. */
export async function toFunding(t: Rig) {
  const { a, b } = t;
  const { trialId, code } = await a.fileCase({ title: 'The Last Dumpling', category: 'dating-crimes', patch: briefA.patch });
  await b.acceptInvite(trialId);
  await b.saveBrief(trialId, 'b', briefB.patch);
  await a.addExhibit(trialId, 'a', { title: 'Group chat', body: 'me: splitting it 50/50 ok? them: deal' });
  await b.addExhibit(trialId, 'b', { title: 'Thermometer', body: 'Dumpling at 31°C, well below serving temperature.' });
  await a.approveBrief(trialId, 'a');
  await b.approveBrief(trialId, 'b');
  await a.runCounsel(trialId);
  await a.approveDraft(trialId, 'a');
  await b.approveDraft(trialId, 'b');
  return { trialId, code };
}

export const filing: Filing = {
  category: 'dating-crimes',
  title: 'The Last Dumpling',
  context: '',
  sides: {
    a: { account: null, story: 'We agreed to split it. I fetched napkins. The plate was empty on return.', privateNotes: 'PRIVATE-NOTES-ALPHA third incident', angle: 'A deal is a deal.', nickname: 'Napkin Knight' },
    b: { account: null, story: 'It was going cold. I saved it from a lukewarm fate. Hot food waits for no one.', privateNotes: 'PRIVATE-NOTES-BRAVO ate four already', angle: null, nickname: null },
  },
};

export function request(overrides: Partial<CounselRequest> = {}): CounselRequest {
  return {
    trialId: 'vs-testcase01',
    mode: 'versus',
    category: filing.category,
    title: filing.title,
    ballot: ['SIDE A', 'SIDE B'],
    benches: BASE_MODES.versus.benches,
    briefs: briefsFor(BASE_MODES.versus.benches, filing),
    exhibits: [
      { id: 'ex-a1', submittedBy: 'a', kind: 'text', title: 'Group chat', body: 'me: splitting 50/50? them: deal' },
      { id: 'ex-b1', submittedBy: 'b', kind: 'text', title: 'Thermometer', body: 'Dumpling at 31 degrees.' },
    ],
    scope: 'full',
    payer: ['platform', 'platform'],
    budget: { maxInputTokens: 6000, maxOutputTokens: 1200 },
    attempt: 1,
    ...overrides,
  };
}

/** Runs a case to a human-jury verdict (3 jurors: one real, two demo bots). */
export async function toVerdict(t: Rig) {
  const { a, b, j, clock } = t;
  const { usdc } = await import('@cringe-court/core');
  await a.faucet(usdc('5.00'));
  await b.faucet(usdc('5.00'));
  await j.faucet(usdc('5.00'));
  const { trialId } = await toFunding(t);
  await a.fund(trialId);
  await b.fund(trialId);
  await j.takeSeat(trialId);
  await a.seatDemoJurors(trialId, 'reliable');
  await j.commitBallot(trialId, 1);
  clock.advance(30);
  await a.tick();
  await a.skipAhead(trialId);
  await j.revealBallot(trialId);
  clock.advance(30);
  await a.tick();
  await a.skipAhead(trialId);
  await a.tick();
  await a.tick();
  return trialId;
}
