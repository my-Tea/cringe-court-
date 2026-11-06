/**
 * D11 — the gallery vote. Free, points-only, never binding, stored offchain,
 * one per signed-in spectator per case, appointed jurors excluded, and the tally
 * stays hidden until the jury's reveal window closes so it can't anchor jurors.
 */
import type { BallotChoice, CaseNumber, Hex } from '@cringe-court/core';

export interface GalleryTally {
  votes: readonly [number, number];
  total: number;
}

/** Offchain store (A24: about 500 votes per case at 0.00005 each). */
export interface GalleryStore {
  cast(caseNumber: CaseNumber, account: Hex, choice: BallotChoice): Promise<void>;
  voteOf(caseNumber: CaseNumber, account: Hex): Promise<BallotChoice | null>;
  tally(caseNumber: CaseNumber): Promise<GalleryTally>;
}

export class GalleryVoteError extends Error {
  constructor(
    readonly code: 'already-voted' | 'juror' | 'closed' | 'no-account',
    message: string,
  ) {
    super(message);
    this.name = 'GalleryVoteError';
  }
}

export class MemoryGalleryStore implements GalleryStore {
  readonly #votes = new Map<CaseNumber, Map<string, BallotChoice>>();

  async cast(caseNumber: CaseNumber, account: Hex, choice: BallotChoice): Promise<void> {
    const box = this.#votes.get(caseNumber) ?? new Map<string, BallotChoice>();
    const k = account.toLowerCase();
    if (box.has(k)) throw new GalleryVoteError('already-voted', 'You already called this one. One gallery vote per case.');
    box.set(k, choice);
    this.#votes.set(caseNumber, box);
  }

  async voteOf(caseNumber: CaseNumber, account: Hex): Promise<BallotChoice | null> {
    return this.#votes.get(caseNumber)?.get(account.toLowerCase()) ?? null;
  }

  async tally(caseNumber: CaseNumber): Promise<GalleryTally> {
    const votes: [number, number] = [0, 0];
    for (const c of this.#votes.get(caseNumber)?.values() ?? []) votes[c]++;
    return { votes, total: votes[0] + votes[1] };
  }
}

/** Share of the gallery on each side, as whole percents that add up to 100. */
export function galleryPercents(t: GalleryTally): readonly [number, number] {
  if (t.total === 0) return [0, 0];
  const a = Math.round((t.votes[0] / t.total) * 100);
  return [a, 100 - a];
}
