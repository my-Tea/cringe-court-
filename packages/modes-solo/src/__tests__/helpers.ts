import { expect } from 'vitest';
import { usdc, type Hex } from '@cringe-court/core';
import { MockIdentity, createMockPorts, testAddress, type FixtureCounselOptions } from '@cringe-court/core/testing';
import { EMPTY_DRAFT, NpcJury, SoloSession, TeaserQuota, memoryQuotaStore, type SoloDraft } from '../index';

export const FILER = testAddress('filer');
export const ANGLE = 'The fire drill email was a trap: everyone in the group chat would have replied-all too.';

export const DRAFT: SoloDraft = {
  ...EMPTY_DRAFT,
  category: 'npc-behavior',
  title: 'Reply-all to the whole company',
  story: 'I replied-all "lol same" to a 3,000-person email about the fire drill, then emailed jordan@corp.example to apologise.',
  privateNotes: 'SECRET: my manager also replied-all first.',
  hiddenNames: ['Jordan'],
};

export function setup(options: { counsel?: FixtureCounselOptions; demo?: boolean; balance?: string } = {}) {
  const ports = createMockPorts(options.counsel ? { counsel: options.counsel } : {});
  const accounts = ['tina', 'chad', 'grandma'].map((n) => testAddress(`npc-${n}`));
  ports.chain.mint(FILER, usdc(options.balance ?? '5'));
  accounts.forEach((a) => ports.chain.mint(a, usdc('2')));
  const jury = new NpcJury({
    chainFor: (a: Hex) => ports.chain.as(a),
    nullifierFor: async (a, n) => {
      const id = new MockIdentity({ human: a });
      const r = await id.requestProof({ action: 'accept-jury-seat', signal: `case:${n}:seat` });
      if (!r.ok) throw new Error(r.message);
      return r.proof.nullifierHash;
    },
    salts: ports.salts,
    now: ports.clock.now,
    accounts,
  });
  const clock = { now: ports.clock.now, advanceTo: (t: number) => void ports.clock.advance(Math.max(0, t - ports.clock.now())) };
  const teasers = new TeaserQuota(memoryQuotaStore(), ports.clock.now);
  const session = new SoloSession(
    { counsel: ports.counsel, chain: ports.chain.as(FILER), clock, jury, teasers },
    { filer: FILER, demo: options.demo ?? true, id: 'solo-test-1' },
  );
  return { ports, session, jury, accounts, teasers };
}

/** Drive a session from confession to the funded jury stage. */
export async function toJury(session: SoloSession) {
  expect(session.fileConfession(DRAFT)).toBe(true);
  await session.suggestAngles();
  expect(session.setAngle(session.getSnapshot().angles![1]!.text)).toBe(true);
  await session.approveAndDraft();
  session.approveDraft();
  await session.pay();
}

export async function runJury(session: SoloSession) {
  for (let i = 0; i < 3; i++) await session.seatNextJuror();
  for (let seat = 1; seat <= 3; seat++) await session.commitBallot(seat);
  await session.closeCommit();
  for (let seat = 1; seat <= 3; seat++) await session.revealBallot(seat);
  await session.closeReveal();
  await session.finalize();
}
