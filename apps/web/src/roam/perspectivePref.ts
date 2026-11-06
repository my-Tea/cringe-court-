import type { PerspectiveChoice } from '@cringe-court/scene/roam';

const KEY = 'cc:perspective';

/** Saved view. Anything other than an explicit first person is Auto, the trailing third person. */
export function readPerspective(storage: Storage = window.localStorage): PerspectiveChoice {
  try {
    return storage.getItem(KEY) === 'first' ? 'first' : 'auto';
  } catch {
    return 'auto';
  }
}

export function writePerspective(choice: PerspectiveChoice, storage: Storage = window.localStorage): void {
  try {
    storage.setItem(KEY, choice);
  } catch {
    /* private mode */
  }
}
