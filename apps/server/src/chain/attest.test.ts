import { describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { attestWallet, chainHumanId, ownershipMessage, type HumanWriter } from './attest';
import type { HumanRecord } from '../world/humans';

const player = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const stranger = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ea870594951055ddf1b7a0f');
const human: HumanRecord = { humanId: 'abc123', wallet: '0x0000000000000000000000000000000000000001', level: 2, verifiedAt: 1 };

function writer(level = 0): HumanWriter & { attest: ReturnType<typeof vi.fn> } {
  return { levelOf: async () => level, attest: vi.fn(async () => '0xfeed' as const) };
}
const signed = (by = player) => by.signMessage({ message: ownershipMessage('p-1', player.address) });

describe('attestWallet', () => {
  it('attests a verified human who proves they own the wallet', async () => {
    const w = writer();
    const r = await attestWallet({ writer: w, human, personaId: 'p-1', wallet: player.address, signature: await signed() });
    expect(r).toEqual({ ok: true, txHash: '0xfeed' });
    expect(w.attest).toHaveBeenCalledWith(player.address, chainHumanId('abc123'), 2);
  });

  it('refuses a wallet the caller did not sign for, and sends nothing', async () => {
    const w = writer();
    const r = await attestWallet({ writer: w, human, personaId: 'p-1', wallet: player.address, signature: await signed(stranger) });
    expect(r).toEqual({ ok: false, reason: 'bad-signature' });
    expect(w.attest).not.toHaveBeenCalled();
  });

  it('refuses a signature made for another session', async () => {
    const w = writer();
    const r = await attestWallet({ writer: w, human, personaId: 'p-2', wallet: player.address, signature: await signed() });
    expect(r).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('refuses anyone who has not passed World ID', async () => {
    const r = await attestWallet({ writer: writer(), human: undefined, personaId: 'p-1', wallet: player.address, signature: await signed() });
    expect(r).toEqual({ ok: false, reason: 'not-verified' });
  });

  it('spends no gas on a wallet already attested', async () => {
    const w = writer(2);
    expect(await attestWallet({ writer: w, human, personaId: 'p-1', wallet: player.address, signature: await signed() })).toEqual({ ok: true, txHash: null });
    expect(w.attest).not.toHaveBeenCalled();
  });

  it('says so when no relayer is configured', async () => {
    expect(await attestWallet({ writer: null, human, personaId: 'p-1', wallet: player.address, signature: '0x00' })).toEqual({ ok: false, reason: 'disabled' });
  });
});

describe('chainHumanId', () => {
  it('keeps a bytes32 id and hashes anything else to one', () => {
    const id = `0x${'ab'.repeat(32)}`;
    expect(chainHumanId(id)).toBe(id);
    expect(chainHumanId('abc123')).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
