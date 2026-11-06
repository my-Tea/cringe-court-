/** The first-visit onboarding card's memory (B4): once seen through or dismissed, it stays away. */

/** Remembers that the player has seen (or dismissed) the onboarding card, per browser. */
export const ONBOARDED_STORAGE_KEY = 'cc:roam-onboarded';

export function readOnboarded(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(ONBOARDED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeOnboarded(): void {
  try {
    window.localStorage.setItem(ONBOARDED_STORAGE_KEY, '1');
  } catch {
    /* storage blocked: the card stays dismissed for this page only */
  }
}
