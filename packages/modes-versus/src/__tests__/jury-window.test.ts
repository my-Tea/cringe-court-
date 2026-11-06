/**
 * B2 (UX evaluation): a human juror who watches the whole first-person
 * hearing (about 174 s in the playtest) and then thinks for a moment must
 * still be inside the demo commit window. And a longer window must not mean a
 * longer wait: once every seated juror has acted, the demo clock moves on.
 */
import { ManualClock, MemorySaltVault, MockIdentity, testAddress } from '@cringe-court/core/testing';
import { usdc } from '@cringe-court/core';
import { describe, expect, it } from 'vitest';
import { prepareBriefing } from '../briefing';
import { VersusCounsel } from '../counsel';
import { VERSUS_DEMO_DEADLINES } from '../definition';
import { VersusDesk } from '../desk';
import { MemoryFactStore } from '../store';

function rig() {
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
  return { clock, a: desk('alice', 'human-a'), b: desk('bob', 'human-b'), j: desk('juror', 'human-j') };
}

const brief = (happened: string, angle: string) =>
  prepareBriefing({ happened, why: 'Because a deal is a deal and everybody at the table heard it.', privateNotes: '', angle, nickname: '' }).patch;

/** Both sides funded, the human juror plus simulated jurors seated: the commit window has just opened. */
async function seated(t: ReturnType<typeof rig>) {
  const { a, b, j } = t;
  for (const d of [a, b, j]) await d.faucet(usdc('5.00'));
  const { trialId } = await a.fileCase({ title: 'The Last Dumpling', category: 'dating-crimes', patch: brief('We agreed to split the last dumpling and then it vanished.', 'A deal is a deal.') });
  await b.acceptInvite(trialId);
  await b.saveBrief(trialId, 'b', brief('The dumpling was going cold, so I saved it from a lukewarm fate.', 'Hot food waits for no one.'));
  await a.approveBrief(trialId, 'a');
  await b.approveBrief(trialId, 'b');
  await a.runCounsel(trialId);
  await a.approveDraft(trialId, 'a');
  await b.approveDraft(trialId, 'b');
  await a.fund(trialId);
  await b.fund(trialId);
  await j.takeSeat(trialId);
  await a.seatDemoJurors(trialId, 'reliable');
  const s = (await a.world()).case(trialId)!.state;
  expect(s.stage === 'jury' && s.step).toBe('commit');
  return trialId;
}

const step = async (d: VersusDesk, trialId: string) => {
  const s = (await d.world()).case(trialId)!.state;
  return s.stage === 'jury' ? s.step : s.stage;
};

describe('Versus demo commit window vs the hearing (B2)', () => {
  it('a juror who watches the whole first-person hearing, then takes two minutes to decide, can still seal', async () => {
    const t = rig();
    const trialId = await seated(t);
    t.clock.advance(174 + 120);
    await t.a.tick();
    expect(await step(t.a, trialId)).toBe('commit');
    await expect(t.j.commitBallot(trialId, 0)).resolves.toBeUndefined();
    expect(VERSUS_DEMO_DEADLINES.commit).toBeGreaterThanOrEqual(174 + 120);
  });

  it('closes the commit window once every seated juror has sealed, and the reveal window once every sealed scroll is open', async () => {
    const t = rig();
    const trialId = await seated(t);
    await t.j.commitBallot(trialId, 1);
    t.clock.advance(20);
    await t.a.tick(); // the simulated jurors seal
    await t.a.tick(); // everyone has sealed: the clerk closes the window
    expect(await step(t.a, trialId)).toBe('reveal');
    await t.j.revealBallot(trialId);
    t.clock.advance(20);
    await t.a.tick(); // the simulated jurors open theirs
    await t.a.tick(); // everyone has opened: deliberation closes
    await t.a.tick(); // the clerk finalizes
    expect(await step(t.a, trialId)).toBe('verdict');
  });

  it('keeps the window open while a seated juror still has not sealed', async () => {
    const t = rig();
    const trialId = await seated(t);
    t.clock.advance(60);
    await t.a.tick();
    await t.a.tick();
    expect(await step(t.a, trialId)).toBe('commit');
  });
});

describe('Versus demo clock and wall-clock jumps (B19)', () => {
  it('an open invite survives the device clock jumping an hour ahead', async () => {
    const store = new MemoryFactStore();
    const a = new VersusDesk({ store, persona: { id: 'p-a', name: 'a', account: testAddress('a') }, counsel: new VersusCounsel(), identity: new MockIdentity({ human: 'h-a' }), salts: new MemorySaltVault('s-a') });
    const { trialId } = await a.fileCase({ title: 'The Last Dumpling', category: 'dating-crimes', patch: brief('We agreed to split the last dumpling and then it vanished.', 'A deal is a deal.') });
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 3_549_000; // as seen on the playtest host
      const s = (await a.world()).case(trialId)!.state;
      expect(s.stage === 'filing' && s.step).toBe('awaiting-consent');
    } finally {
      Date.now = realNow;
    }
  });
});
