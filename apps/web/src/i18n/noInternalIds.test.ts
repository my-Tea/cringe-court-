import { en } from './catalog';

/** Internal decision codes ("D14", "D10") are design-doc shorthand, never player-visible copy (UX evaluation §4.1). */
describe('player-visible copy', () => {
  it.each(Object.entries(en))('%s has no internal decision IDs', (_name, messages) => {
    const offenders = Object.entries(messages as Record<string, string>).filter(([, v]) => /\bD\d{1,2}\b/.test(v));
    expect(offenders).toEqual([]);
  });
});
