/**
 * JurorSession: one juror's duty on one case. World ID screening before the
 * bond (V4 §10), sealed ballot with a client-only salt (V4 §7), reveal, claim.
 * Every step reports a typed outcome the UI can render, including the unhappy
 * paths the sponsor demo must show (cancelled / not verified / conflicted).
 */
import { ChainError, type BallotChoice, type CaseNumber, type CourtPorts, type Hex, type ReceiptLine, type ScreeningResult } from '@cringe-court/core';

export type DutyStep = 'screen' | 'seat' | 'commit' | 'reveal' | 'claim';

export type DutyResult<T = void> =
  | { ok: true; value: T; explorerUrl?: string }
  | { ok: false; step: DutyStep; reason: string; message: string };

export interface JurorSessionOptions {
  caseNumber: CaseNumber;
  ports: Pick<CourtPorts, 'chain' | 'identity' | 'salts'>;
  /** Nullifiers of the case's parties, for the conflict check. */
  exclude?: readonly Hex[];
  clock?: () => number;
}

const fail = (step: DutyStep, reason: string, message: string): DutyResult<never> => ({ ok: false, step, reason, message });

export class JurorSession {
  readonly caseNumber: CaseNumber;
  readonly #ports: JurorSessionOptions['ports'];
  readonly #exclude: readonly Hex[];
  readonly #clock: () => number;
  #nullifier: Hex | null = null;

  constructor(options: JurorSessionOptions) {
    this.caseNumber = options.caseNumber;
    this.#ports = options.ports;
    this.#exclude = options.exclude ?? [];
    this.#clock = options.clock ?? (() => Math.floor(Date.now() / 1000));
  }

  get nullifier(): Hex | null {
    return this.#nullifier;
  }

  async #me(step: DutyStep): Promise<Hex | DutyResult<never>> {
    const me = await this.#ports.chain.account();
    return me ?? fail(step, 'no-wallet', 'Connect a wallet first.');
  }

  /** World ID for this seat. Required before any bond is deposited. */
  async screen(signal?: AbortSignal): Promise<DutyResult<Hex>> {
    const request = { action: 'accept-jury-seat' as const, signal: `case:${this.caseNumber}:seat`, minLevel: 'orb' as const };
    const proof = await this.#ports.identity.requestProof(request, signal);
    if (!proof.ok) return fail('screen', proof.reason, proof.message);
    const verdict: ScreeningResult = await this.#ports.identity.verify(proof.proof, request, { caseNumber: this.caseNumber, exclude: this.#exclude });
    if (!verdict.ok) return fail('screen', verdict.reason, verdict.message);
    this.#nullifier = verdict.nullifier;
    return { ok: true, value: verdict.nullifier };
  }

  /** Deposit the bond and take the seat ("I SWEAR TO SHOW UP"). */
  async takeSeat(): Promise<DutyResult> {
    if (!this.#nullifier) return fail('seat', 'not-screened', 'Verify with World ID first.');
    return this.#tx('seat', () => this.#ports.chain.acceptSeat(this.caseNumber, this.#nullifier!));
  }

  /** Seal a ballot: salt stays on this device; only the commitment goes on chain. */
  async commit(choice: BallotChoice): Promise<DutyResult> {
    const me = await this.#me('commit');
    if (typeof me !== 'string') return me;
    const salt = this.#ports.salts.newSalt();
    const commitment = this.#ports.chain.commitmentFor(this.caseNumber, me, choice, salt);
    // Save before sending: a lost salt is a missed reveal (V4 §7 UX safeguard).
    await this.#ports.salts.save({ caseNumber: this.caseNumber, juror: me, choice, salt, commitment, savedAt: this.#clock() });
    return this.#tx('commit', () => this.#ports.chain.commit(this.caseNumber, commitment));
  }

  /** Open the sealed ballot with the saved salt. */
  async reveal(): Promise<DutyResult<BallotChoice>> {
    const me = await this.#me('reveal');
    if (typeof me !== 'string') return me;
    const ballot = await this.#ports.salts.load(this.caseNumber, me);
    if (!ballot) return fail('reveal', 'salt-missing', 'This device does not have your sealed ballot. Reveal from the device you voted on.');
    const result = await this.#tx('reveal', () => this.#ports.chain.reveal(this.caseNumber, ballot.choice, ballot.salt));
    if (!result.ok) return result;
    return { ok: true, value: ballot.choice, ...(result.explorerUrl ? { explorerUrl: result.explorerUrl } : {}) };
  }

  /** Pull the bond back plus any reward, then forget the salt. */
  async claim(): Promise<DutyResult<readonly ReceiptLine[]>> {
    const me = await this.#me('claim');
    if (typeof me !== 'string') return me;
    const result = await this.#tx('claim', () => this.#ports.chain.claim(this.caseNumber));
    if (!result.ok) return result;
    await this.#ports.salts.remove(this.caseNumber, me);
    return { ok: true, value: await this.#ports.chain.receipts(this.caseNumber, me), ...(result.explorerUrl ? { explorerUrl: result.explorerUrl } : {}) };
  }

  async #tx(step: DutyStep, fn: () => Promise<{ explorerUrl: string }>): Promise<DutyResult> {
    try {
      const receipt = await fn();
      return { ok: true, value: undefined, explorerUrl: receipt.explorerUrl };
    } catch (err) {
      if (err instanceof ChainError) return fail(step, err.code, err.message);
      return fail(step, 'error', err instanceof Error ? err.message : String(err));
    }
  }
}
