/**
 * Ballot salts on this device (V4 §7, ARCHITECTURE rule 3: the salt never leaves
 * the client) plus the "Secret Verdict Scroll": a copyable backup of everything
 * needed to reveal, so a lost tab never costs a bond.
 */
import { bytesToHex, caseNumber as toCaseNumber, isHex, type BallotChoice, type CaseNumber, type Hex, type SaltVault, type SealedBallot } from '@cringe-court/core';

/** The subset of the Web Storage API the vault needs (localStorage in the app). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const PREFIX = 'cc:gj:ballot:';

/** A SaltVault on Web Storage with CSPRNG salts. */
export class StorageSaltVault implements SaltVault {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly random: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b),
  ) {}

  #key(caseNumber: CaseNumber, juror: Hex): string {
    return `${PREFIX}${caseNumber}:${juror.toLowerCase()}`;
  }

  async save(ballot: SealedBallot): Promise<void> {
    this.storage.setItem(this.#key(ballot.caseNumber, ballot.juror), JSON.stringify(ballot));
  }

  async load(caseNumber: CaseNumber, juror: Hex): Promise<SealedBallot | null> {
    const raw = this.storage.getItem(this.#key(caseNumber, juror));
    if (!raw) return null;
    try {
      const b = JSON.parse(raw) as SealedBallot;
      return b.caseNumber === caseNumber && isHex(b.salt, 32) ? b : null;
    } catch {
      return null;
    }
  }

  async remove(caseNumber: CaseNumber, juror: Hex): Promise<void> {
    this.storage.removeItem(this.#key(caseNumber, juror));
  }

  newSalt(): Hex {
    return bytesToHex(this.random(new Uint8Array(32)));
  }
}

/** In-memory Web Storage stand-in (tests, private mode fallback). */
export class MemoryStorage implements KeyValueStorage {
  readonly #m = new Map<string, string>();
  getItem(key: string): string | null {
    return this.#m.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.#m.set(key, value);
  }
  removeItem(key: string): void {
    this.#m.delete(key);
  }
}

const SCROLL_PREFIX = 'ccgj1';

/**
 * Encode a sealed ballot as a scroll: `ccgj1.<case>.<juror>.<choice>.<salt>.<commitment>`.
 * It contains the choice, so it stays private until the reveal.
 */
export function encodeScroll(b: Pick<SealedBallot, 'caseNumber' | 'juror' | 'choice' | 'salt' | 'commitment'>): string {
  return [SCROLL_PREFIX, b.caseNumber, b.juror.toLowerCase(), b.choice, b.salt, b.commitment].join('.');
}

export class ScrollError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScrollError';
  }
}

export function decodeScroll(text: string): Omit<SealedBallot, 'savedAt'> {
  const parts = text.trim().split('.');
  if (parts[0] !== SCROLL_PREFIX) throw new ScrollError('That is not a Grand Jury scroll.');
  if (parts.length !== 6) throw new ScrollError('This scroll is damaged: some of it is missing.');
  const [, n, juror, choice, salt, commitment] = parts as [string, string, string, string, string, string];
  if (!/^\d+$/.test(n)) throw new ScrollError('This scroll is damaged: bad case number.');
  if (!isHex(juror, 20) || !isHex(salt, 32) || !isHex(commitment, 32)) throw new ScrollError('This scroll is damaged: bad hex.');
  if (choice !== '0' && choice !== '1') throw new ScrollError('This scroll is damaged: bad choice.');
  return { caseNumber: toCaseNumber(Number(n)), juror: juror as Hex, choice: Number(choice) as BallotChoice, salt: salt as Hex, commitment: commitment as Hex };
}
