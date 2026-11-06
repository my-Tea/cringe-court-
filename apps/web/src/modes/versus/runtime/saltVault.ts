/**
 * Ballot salts on this device (ARCHITECTURE rule 3: the salt never leaves the
 * client). Saved before the commitment is sent, so a refresh or a closed tab
 * does not cost the juror their bond; losing this storage means a missed
 * reveal, which the juror UI warns about.
 */
import type { CaseNumber, Hex, SaltVault, SealedBallot } from '@cringe-court/core';

const PREFIX = 'cc:versus:salt:';

const keyOf = (caseNumber: CaseNumber, juror: Hex) => `${PREFIX}${caseNumber}:${juror.toLowerCase()}`;

export class LocalSaltVault implements SaltVault {
  constructor(private readonly storage: Storage = window.localStorage) {}

  async save(ballot: SealedBallot): Promise<void> {
    this.storage.setItem(keyOf(ballot.caseNumber, ballot.juror), JSON.stringify(ballot));
  }

  async load(caseNumber: CaseNumber, juror: Hex): Promise<SealedBallot | null> {
    const raw = this.storage.getItem(keyOf(caseNumber, juror));
    if (!raw) return null;
    try {
      const b = JSON.parse(raw) as SealedBallot;
      return b.choice === 0 || b.choice === 1 ? b : null;
    } catch {
      return null;
    }
  }

  async remove(caseNumber: CaseNumber, juror: Hex): Promise<void> {
    this.storage.removeItem(keyOf(caseNumber, juror));
  }

  newSalt(): Hex {
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    return `0x${Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')}` as Hex;
  }
}

/** Forget every saved scroll (demo reset). */
export function clearSalts(storage: Storage = window.localStorage): void {
  for (let i = storage.length - 1; i >= 0; i--) {
    const k = storage.key(i);
    if (k?.startsWith(PREFIX)) storage.removeItem(k);
  }
}
