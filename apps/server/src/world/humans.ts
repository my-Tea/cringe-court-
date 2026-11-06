/**
 * One human, one wallet. The key is humanId (an HMAC of the nullifier).
 * The raw nullifier is never stored.
 */
import type { DurableLog } from '../store';

export interface HumanRecord {
  humanId: string;
  wallet: string;
  level: number;
  verifiedAt: number;
}

export type BindResult = { ok: true; record: HumanRecord } | { ok: false; reason: 'other-wallet' | 'other-human' };

export class HumanStore {
  readonly #rows: HumanRecord[];

  constructor(
    private readonly log: DurableLog<HumanRecord>,
    private readonly clock: () => number,
  ) {
    this.#rows = log.readAll();
  }

  byHuman(humanId: string): HumanRecord | undefined {
    const id = humanId.toLowerCase();
    return this.#rows.find((r) => r.humanId.toLowerCase() === id);
  }

  byWallet(wallet: string): HumanRecord | undefined {
    const id = wallet.toLowerCase();
    for (let i = this.#rows.length - 1; i >= 0; i -= 1) {
      const row = this.#rows[i];
      if (row && row.wallet.toLowerCase() === id) return row;
    }
    return undefined;
  }

  bind(input: { humanId: string; wallet: string; level: number }): BindResult {
    const wallet = input.wallet.toLowerCase();
    const humanId = input.humanId.toLowerCase();
    const existing = this.byHuman(humanId);
    if (existing) {
      if (existing.wallet.toLowerCase() === wallet) return { ok: true, record: existing };
      return { ok: false, reason: 'other-wallet' };
    }
    const taken = this.byWallet(wallet);
    if (taken && taken.humanId.toLowerCase() !== humanId) return { ok: false, reason: 'other-human' };
    const record: HumanRecord = { humanId, wallet, level: input.level, verifiedAt: Math.floor(this.clock() / 1000) };
    this.#rows.push(record);
    this.log.append(record);
    return { ok: true, record };
  }
}
