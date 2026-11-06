/**
 * The demo NPC jury. In a real Solo case the 3 seats go to random World
 * ID–verified humans from the waiting pool (V4 §10). The testnet demo has no
 * such pool, so three NPC jurors take the seats *through the same ledger*:
 * they post the real bond, commit keccak(choice, salt), keep the salt in the
 * SaltVault and reveal it. The UI must label them as simulated (D14).
 *
 * Votes are deterministic: seeded by the frozen transcript hash and the seat,
 * nudged by each persona's bias and by the balance check, so the same case
 * always gets the same jury.
 */
import { keccak256, type BalanceReport, type BallotChoice, type CaseNumber, type ChainPort, type Hex, type SaltVault } from '@cringe-court/core';

export interface NpcPersona {
  id: string;
  name: string;
  /** One-line bio for the jury box. */
  bio: string;
  /** −1 (always NOT COOKED) .. +1 (always GUILTY). */
  bias: number;
  /** What they say as their scroll opens, per choice [GUILTY, NOT COOKED]. */
  says: readonly [string, string];
}

export const NPC_PERSONAS: readonly NpcPersona[] = [
  {
    id: 'touch-grass-tina',
    name: 'Touch-Grass Tina',
    bio: 'Has been offline since 2019. Judges everyone.',
    bias: 0.2,
    says: ['Bro is cooked. Log off.', 'Honestly? Relatable. Not cooked.'],
  },
  {
    id: 'chronically-online-chad',
    name: 'Chronically Online Chad',
    bio: 'Has seen worse before breakfast. Usually forgives.',
    bias: -0.2,
    says: ['Even I can’t defend this. Guilty.', 'Let bro cook. I’ve done worse today.'],
  },
  {
    id: 'grandma-wifi',
    name: 'Grandma Wi-Fi',
    bio: 'Thinks the cloud is weather. Votes on vibes.',
    bias: 0,
    says: ['In my day we called this “a disgrace”.', 'Oh, the poor dear. Not cooked.'],
  },
];

export interface NpcJuror {
  seat: number;
  account: Hex;
  persona: NpcPersona;
}

export interface NpcJuryDeps {
  /** The ledger, signing as a given juror. */
  chainFor: (juror: Hex) => ChainPort;
  /** A World ID nullifier for this juror's seat (mock verifier in the demo). */
  nullifierFor: (juror: Hex, caseNumber: CaseNumber) => Promise<Hex>;
  salts: SaltVault;
  now: () => number;
  /** Juror accounts, one per persona. */
  accounts: readonly Hex[];
}

/** Deterministic 0..1 from a hash. */
function unit(seed: string): number {
  return parseInt(keccak256(seed).slice(2, 14), 16) / 0xffffffffffff;
}

/**
 * P(GUILTY) for one seat. The weaker-argued bench loses a little ground, so the
 * jury reacts to the show, but every case can go either way.
 */
export function guiltyChance(persona: NpcPersona, balance: BalanceReport | null): number {
  const edge = balance ? (balance.scores[0] - balance.scores[1]) * 0.3 : 0;
  return Math.min(0.9, Math.max(0.1, 0.5 + persona.bias * 0.5 + edge));
}

export function npcChoice(persona: NpcPersona, transcriptHash: Hex, seat: number, balance: BalanceReport | null): BallotChoice {
  return unit(`${transcriptHash}:${seat}:${persona.id}`) < guiltyChance(persona, balance) ? 0 : 1;
}

export class NpcJury {
  readonly jurors: readonly NpcJuror[];

  constructor(private readonly deps: NpcJuryDeps) {
    if (deps.accounts.length < NPC_PERSONAS.length) throw new RangeError('NpcJury needs one account per persona');
    this.jurors = NPC_PERSONAS.map((persona, i) => ({ seat: i + 1, account: deps.accounts[i]!, persona }));
  }

  juror(seat: number): NpcJuror {
    const j = this.jurors[seat - 1];
    if (!j) throw new RangeError(`No NPC juror for seat ${seat}`);
    return j;
  }

  async takeSeat(caseNumber: CaseNumber, seat: number): Promise<NpcJuror> {
    const j = this.juror(seat);
    const nullifier = await this.deps.nullifierFor(j.account, caseNumber);
    await this.deps.chainFor(j.account).acceptSeat(caseNumber, nullifier);
    return j;
  }

  /** Seal a ballot: the choice stays secret (only the commitment goes on-chain). */
  async commit(caseNumber: CaseNumber, seat: number, choice: BallotChoice): Promise<void> {
    const j = this.juror(seat);
    const chain = this.deps.chainFor(j.account);
    const salt = this.deps.salts.newSalt();
    const commitment = chain.commitmentFor(caseNumber, j.account, choice, salt);
    await this.deps.salts.save({ caseNumber, juror: j.account, choice, salt, commitment, savedAt: this.deps.now() });
    await chain.commit(caseNumber, commitment);
  }

  async reveal(caseNumber: CaseNumber, seat: number): Promise<BallotChoice> {
    const j = this.juror(seat);
    const ballot = await this.deps.salts.load(caseNumber, j.account);
    if (!ballot) throw new Error(`${j.persona.name} lost their salt`);
    await this.deps.chainFor(j.account).reveal(caseNumber, ballot.choice, ballot.salt);
    await this.deps.salts.remove(caseNumber, j.account);
    return ballot.choice;
  }
}
