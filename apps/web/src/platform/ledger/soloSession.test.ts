/**
 * modes-solo's SoloSession + NpcJury, unchanged, over ArcLedger(createMemoryChain):
 * the app-level port really is swappable for the contract-shaped one.
 */
import { MemorySaltVault, MockIdentity, FixtureCounsel, testAddress } from '@cringe-court/core/testing';
import { usdc, type Hex } from '@cringe-court/core';
import { EMPTY_DRAFT, NpcJury, SoloSession, TeaserQuota, memoryQuotaStore, type SoloDraft } from '@cringe-court/modes-solo';
import { describe, expect, it } from 'vitest';
import { readPlatformConfig } from '../config';
import { createLedger } from './createLedger';

const DRAFT: SoloDraft = {
  ...EMPTY_DRAFT,
  category: 'npc-behavior',
  title: 'Reply-all to the whole company',
  story: 'I replied-all "lol same" to a 3,000-person email about the fire drill, then emailed jordan@corp.example to apologise.',
  privateNotes: 'SECRET: my manager also replied-all first.',
  hiddenNames: ['Jordan'],
};

function setup() {
  let offset = 0;
  const now = () => Math.floor(Date.now() / 1000) + offset;
  const clock = { now, advanceTo: (t: number) => void (offset += Math.max(0, t - now())) };
  const ledger = createLedger(readPlatformConfig({}), { clock: now });
  const demo = ledger.demo!;
  const filer = testAddress('filer');
  demo.faucet(filer, usdc('5'));
  const accounts = ['tina', 'chad', 'grandma'].map((n) => testAddress(`npc-${n}`));
  accounts.forEach((a) => demo.faucet(a, usdc('2')));
  const jury = new NpcJury({
    chainFor: (a: Hex) => ledger.port.as(a),
    nullifierFor: async (a, n) => {
      const r = await new MockIdentity({ human: a }).requestProof({ action: 'accept-jury-seat', signal: `case:${n}:seat` });
      if (!r.ok) throw new Error(r.message);
      return r.proof.nullifierHash;
    },
    salts: new MemorySaltVault(),
    now,
    accounts,
  });
  const session = new SoloSession(
    { counsel: new FixtureCounsel(), chain: ledger.port.as(filer), clock, jury, teasers: new TeaserQuota(memoryQuotaStore(), now) },
    { filer, demo: true, id: 'solo-arc-1' },
  );
  return { ledger, demo, filer, accounts, session };
}

describe('SoloSession + NpcJury over ArcLedger(memory)', () => {
  it('runs confession to verdict on the contract-shaped chain', async () => {
    const { ledger, demo, filer, accounts, session } = setup();
    expect(session.fileConfession(DRAFT)).toBe(true);
    await session.suggestAngles();
    session.setAngle(session.getSnapshot().angles![1]!.text);
    await session.approveAndDraft();
    session.approveDraft();
    await session.pay();
    expect(session.getSnapshot().error).toBeNull();
    expect(await ledger.port.usdcBalance(filer)).toBe(usdc('3.80'));

    for (let i = 0; i < 3; i++) await session.seatNextJuror();
    expect(session.getSnapshot().error).toBeNull();
    for (let seat = 1; seat <= 3; seat++) await session.commitBallot(seat);
    await session.closeCommit();
    for (let seat = 1; seat <= 3; seat++) await session.revealBallot(seat);
    await session.closeReveal();
    await session.finalize();

    const snap = session.getSnapshot();
    expect(snap.error).toBeNull();
    expect(['verdict', 'share']).toContain(snap.trial.stage);
    const caseNumber = (snap.trial as { caseNumber: number }).caseNumber as never;
    const onChain = (await ledger.port.getCase(caseNumber))!;
    expect(onChain.phase).toBe('settled');
    expect(onChain.seats.map((s) => s.juror)).toEqual(accounts.map((a) => a.toLowerCase()));
    expect(demo.chain.getCase(1n).transcriptHash).toBe(onChain.transcriptHash);
    // Whatever the verdict, the ledger holds exactly what went in: 1.20 + 3 × 0.40.
    expect(demo.chain.courtBalance()).toBe(usdc('1.20') + usdc('1.20') + demo.chain.reserve().balance);
    // The filer is owed a refund only on NO VERDICT; otherwise the claim is refused, as on core's twin.
    await session.claimRefund();
    const refunded = onChain.verdict?.kind === 'no-verdict';
    expect(session.getSnapshot().error?.message ?? null).toBe(refunded ? null : 'Nothing to claim');
    if (refunded) expect(await ledger.port.usdcBalance(filer)).toBe(usdc('5'));
  });
});
