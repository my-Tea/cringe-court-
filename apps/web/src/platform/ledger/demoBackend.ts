/**
 * DEMO ONLY. In-browser stand-ins for the backend roles the contracts need:
 *   ASSIGNER  EIP-712-signs random seat offers (V4 section 6, step 3)
 *   ATTESTER  attests World-ID-verified wallets in HumanRegistry
 *   OPERATOR  opens the court (records the transcript hash) when the jury fills
 *   CURATOR   publishes Grand Jury cases
 * They hold deterministic throwaway keys that are public in this source, so they
 * only ever make sense on the in-memory chain. Never wire them to a real network.
 */
import { Level, ROLES, signSeatOffer, type MemoryChain, type SeatOffer } from '@cringe-court/chain-client';
import { ChainError, type Hex } from '@cringe-court/core';
import { keccak256, toHex } from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import type { CourtBackend, SeatOfferRequest, SeatOfferSource } from './arcLedger';
import { t } from '@/i18n';

const demoAccount = (role: string): PrivateKeyAccount => privateKeyToAccount(keccak256(toHex(`cringe-court/demo-only/${role}`)));

const USDC = 1_000_000n;
const YEAR = 365n * 24n * 3600n;

export class DemoBackend implements CourtBackend, SeatOfferSource {
  readonly assigner = demoAccount('assigner');
  readonly attester = demoAccount('attester');
  readonly operator = demoAccount('operator');
  readonly curator = demoAccount('curator');
  /** `${caseId}:${nullifier}` -> wallet, so one World ID takes one seat. */
  readonly #nullifiers = new Map<string, string>();

  constructor(
    private readonly chain: MemoryChain,
    private readonly offerTtl = 600n,
  ) {
    chain.grantRole(ROLES.ASSIGNER, this.assigner.address);
    chain.grantRole(ROLES.ATTESTER, this.attester.address);
    chain.grantRole(ROLES.OPERATOR, this.operator.address);
    chain.grantRole(ROLES.CURATOR, this.curator.address);
    // The operator locks incident stipends from the reserve when it opens a court.
    chain.mint(this.operator.address, 10_000n * USDC);
    chain.approve(this.operator.address, 10_000n * USDC);
    chain.fundReserve(this.operator.address, 10_000n * USDC);
  }

  /** Attest `wallet` as a human at `level` (idempotent). */
  attest(wallet: Hex, level: number): void {
    if (this.chain.humanOf(wallet).level >= level) return;
    const humanId = keccak256(toHex(`demo-human:${wallet.toLowerCase()}`));
    this.chain.attest(this.attester.address, wallet, humanId, level, this.chain.now() + YEAR);
  }

  async verifyParty(wallet: Hex): Promise<void> {
    this.attest(wallet, Level.DEVICE);
  }

  async offerFor(r: SeatOfferRequest): Promise<SeatOffer> {
    const k = `${r.caseId}:${r.nullifier.toLowerCase()}`;
    const holder = this.#nullifiers.get(k);
    if (holder && holder !== r.juror.toLowerCase()) throw new ChainError('duplicate', t('shell.ledger.error.humanSeated'));
    this.#nullifiers.set(k, r.juror.toLowerCase());
    this.attest(r.juror, Math.max(Level.DEVICE, this.chain.caseTerms(r.caseId).minJurorLevel));
    return signSeatOffer(this.assigner, {
      chainId: r.chainId,
      court: r.court as `0x${string}`,
      caseId: r.caseId,
      juror: r.juror,
      expiresAt: this.chain.now() + this.offerTtl,
    });
  }

  async openCourt(caseId: bigint, transcriptHash: Hex): Promise<void> {
    await this.chain.as(this.operator.address).openCourt(caseId, transcriptHash);
  }

  async publishGrandJury(p: { contentHash: Hex; sponsor?: Hex; sponsorAmount?: bigint }): Promise<{ caseId: bigint; txHash: Hex }> {
    const args: { contentHash: Hex; sponsor?: Hex; sponsorAmount?: bigint } = { contentHash: p.contentHash };
    if (p.sponsor) args.sponsor = p.sponsor;
    if (p.sponsorAmount !== undefined) args.sponsorAmount = p.sponsorAmount;
    const r = await this.chain.as(this.curator.address).publishGrandJury(args);
    return { caseId: r.caseId, txHash: r.txHash };
  }
}
