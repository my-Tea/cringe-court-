/**
 * The cast and the two benches. Every trial has exactly two benches, and a
 * bench's index *is* its ballot choice: a verdict of `ballot-0` means bench 0's
 * argument won. That one rule lets Solo, Versus and Grand Jury share the engine,
 * the ballot contract and the settlement maths (D5).
 */
import type { BallotChoice } from './settlement';

/** Every character the art pipeline generates (cc-art/dist/characters, animations.json). */
export type CharacterId =
  | 'judge'
  | 'prosecutor'
  | 'defense'
  | 'bailiff'
  | 'clerk'
  | 'juror'
  | 'creator'
  | 'side-a'
  | 'side-b'
  | 'ai-narrator'
  | 'player';

export const CHARACTER_NAMES: Readonly<Record<CharacterId, string>> = {
  judge: 'Judge Gavel.exe',
  prosecutor: 'Miss Ratio',
  defense: 'Counsel Chaos',
  bailiff: 'Bailiff',
  clerk: 'Clerk',
  juror: 'Juror',
  creator: 'Creator',
  'side-a': 'Side A',
  'side-b': 'Side B',
  'ai-narrator': 'AI Narrator',
  player: 'You',
};

/** The people a case belongs to. Solo has side `a` only; Grand Jury has none (public). */
export type SideId = 'a' | 'b';

/**
 * Who argues at a bench. Prosecution opens; defense answers. In Versus the
 * "prosecution" bench is Side A, the claimant; in Grand Jury it is the FOR position.
 */
export type CounselRole = 'prosecution' | 'defense';

/** The AI characters that can hold a bench. */
export type CounselCharacter = 'prosecutor' | 'defense' | 'side-a' | 'side-b';

export interface BenchSpec {
  choice: BallotChoice;
  role: CounselRole;
  counsel: CounselCharacter;
  /**
   * Whose advocate this bench is. `null` = an NPC opponent (Solo's Miss Ratio)
   * or a public position (Grand Jury); such a bench only ever sees public text (D1).
   */
  client: SideId | null;
}

export type Benches = readonly [BenchSpec & { choice: 0 }, BenchSpec & { choice: 1 }];

export function benchFor(benches: Benches, choice: BallotChoice): BenchSpec {
  return benches[choice];
}

export function benchOfClient(benches: Benches, side: SideId): BenchSpec | undefined {
  return benches.find((b) => b.client === side);
}
