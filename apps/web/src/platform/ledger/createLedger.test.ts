import { createMemoryChain } from '@cringe-court/chain-client';
import { ChainError, MODES, usdc } from '@cringe-court/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readPlatformConfig, type PlatformConfig } from '../config';
import { createLedger } from './createLedger';
import { probeLedger } from './probe';
import { toChainError } from './mapping';
import { CourtError } from '@cringe-court/chain-client';

const ARC_ENV = {
  VITE_LEDGER: 'arc-testnet',
  VITE_ARC_RPC_URL: 'http://127.0.0.1:1/never-called',
  VITE_ARC_COURT: '0x00000000000000000000000000000000000000c1',
  VITE_ARC_USDC: '0x00000000000000000000000000000000000000c2',
  VITE_ARC_REGISTRY: '0x00000000000000000000000000000000000000c3',
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as unknown as { ethereum?: unknown }).ethereum;
});

describe('createLedger', () => {
  it('defaults to the demo ledger over the memory chain', () => {
    const l = createLedger(readPlatformConfig({}));
    expect(l.kind).toBe('demo');
    expect(l.port.id).toBe('memory');
    expect(l.info.simulated).toBe(true);
    expect(l.connect).toBeUndefined();
  });

  it('builds the arc-testnet ledger read-only without touching the network', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network is off')));
    vi.stubGlobal('fetch', fetchSpy);
    const config = readPlatformConfig(ARC_ENV);
    expect(config.ledger).toBe('arc-testnet');
    const l = createLedger(config);
    expect(l.kind).toBe('arc-testnet');
    expect(l.port.id).toBe('arc-testnet');
    expect(l.port.network).toBe('arc-testnet');
    expect(l.port.chainId).toBe(5042002);
    expect(l.info).toMatchObject({ simulated: false, rpcUrl: ARC_ENV.VITE_ARC_RPC_URL, court: ARC_ENV.VITE_ARC_COURT });
    expect(l.info.explorerTx('0xab')).toBe('https://testnet.arcscan.app/tx/0xab');
    expect(await l.port.account()).toBeNull();
    expect(l.port.commitmentFor(1 as never, '0x00000000000000000000000000000000000000d1', 0, `0x${'11'.repeat(32)}`)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(fetchSpy).not.toHaveBeenCalled();
    // Writes need a wallet; the relayer-backed seat offers are not deployed.
    await expect(l.port.advance(1 as never).catch((e: unknown) => e)).resolves.toBeInstanceOf(ChainError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('attaches an injected wallet on connect, still without network calls', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network is off')));
    vi.stubGlobal('fetch', fetchSpy);
    const account = '0x00000000000000000000000000000000000000AA';
    const request = vi.fn(async () => [account]);
    (window as unknown as { ethereum: unknown }).ethereum = { request };
    const l = createLedger(readPlatformConfig(ARC_ENV));
    expect(request).not.toHaveBeenCalled();
    expect(await l.connect!()).toBe(account.toLowerCase());
    expect(request).toHaveBeenCalledWith({ method: 'eth_requestAccounts' });
    expect(await l.port.account()).toBe(account.toLowerCase());
    expect(fetchSpy).not.toHaveBeenCalled();
    // The seat-offer relayer is the one thing Arc cannot do yet, and it says so.
    const err = await l.port.acceptSeat(1 as never, `0x${'22'.repeat(32)}`).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ChainError);
    expect((err as ChainError).code).not.toBe('network');
  });

  it('connect is a no-op without an injected wallet', async () => {
    const l = createLedger(readPlatformConfig(ARC_ENV));
    expect(await l.connect!()).toBeNull();
  });

  it('refuses an arc-testnet config with no addresses', () => {
    const broken: PlatformConfig = { ...readPlatformConfig({}), ledger: 'arc-testnet' };
    expect(() => createLedger(broken)).toThrow(ChainError);
  });
});

describe('probeLedger', () => {
  it('matches core terms for every mode on the demo ledger', async () => {
    const l = createLedger(readPlatformConfig({}));
    const probes = await probeLedger(l.port);
    expect(probes.map((p) => p.mode)).toEqual(['solo', 'versus', 'grand-jury']);
    expect(probes.map((p) => p.matches)).toEqual([true, true, true]);
    expect(probes.map((p) => p.price)).toEqual([usdc('1.20'), usdc('0.70'), usdc('7.30')]);
    expect(probes.map((p) => p.jurorBond)).toEqual([usdc('0.40'), usdc('0.40'), usdc('1.20')]);
    expect(probes.map((p) => p.seats)).toEqual([3, 3, 7]);
    expect(probes.every((p) => p.enabled && p.diffs.length === 0)).toBe(true);
    expect(MODES.solo.economics.n).toBe(1);
  });

  it('reports differences when the ledger charges something else', async () => {
    const chain = createMemoryChain();
    const source = {
      termsOf: async (m: 0 | 1 | 2) => ({ ...chain.termsOf(m), bond: 500_000n, enabled: m !== 1 }),
    };
    const probes = await probeLedger(source);
    expect(probes[0]!.matches).toBe(false);
    expect(probes[0]!.diffs).toContain('juror bond: app 400000, ledger 500000');
    expect(probes[1]!.diffs).toContain('mode is disabled on the ledger');
  });

  it('maps a transport failure to a network ChainError', async () => {
    const down = { termsOf: async () => Promise.reject(Object.assign(new Error('boom'), { name: 'HttpRequestError' })) };
    const err = await probeLedger(down).catch((e: unknown) => e);
    expect((err as ChainError).code).toBe('network');
  });
});

describe('toChainError', () => {
  it('maps contract error names, with unknown names as rejected', () => {
    const code = (name: string) => toChainError(new CourtError(name)).code;
    expect(code('WrongStatus')).toBe('wrong-phase');
    expect(code('CommitClosed')).toBe('deadline');
    expect(code('CommitmentMismatch')).toBe('bad-reveal');
    expect(code('HumanAlreadySeated')).toBe('duplicate');
    expect(code('BelowMinContribution')).toBe('bad-amount');
    expect(code('JurorNotVerified')).toBe('not-allowed');
    expect(code('SomethingNew')).toBe('rejected');
    expect(toChainError(Object.assign(new Error('x'), { code: 4001 })).code).toBe('rejected');
    expect(toChainError(new Error('read-only port: no wallet client')).code).toBe('not-allowed');
  });
});
