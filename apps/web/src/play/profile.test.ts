import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK } from '@cringe-court/scene/roam';
import { currentStep, openGatesFor, readProfile, savedLook, writeProfile, type PlayerProfile } from './profile';

function memory(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

const base: PlayerProfile = { look: DEFAULT_LOOK, dressed: false, verified: null, mode: null };

describe('arrival run profile', () => {
  it('walks the steps in order and lifts one seal per finished stop', () => {
    expect(currentStep(base)).toBe('verify');
    expect(openGatesFor(base)).toEqual([]);
    const verified = { ...base, verified: { nullifier: '0xabc', at: 1 } };
    expect(currentStep(verified)).toBe('wardrobe');
    expect(openGatesFor(verified)).toEqual(['verify']);
    const dressed = { ...verified, dressed: true };
    expect(currentStep(dressed)).toBe('trial');
    expect(openGatesFor({ ...dressed, mode: 'versus' })).toEqual(['verify', 'wardrobe', 'trials']);
    expect(currentStep({ ...dressed, mode: 'versus' })).toBe('enter');
    // A mode chosen without the earlier stops opens nothing past them.
    expect(openGatesFor({ ...base, mode: 'solo' })).toEqual([]);
  });

  it('a first visit rolls and saves a look; a saved profile round-trips', () => {
    const s = memory();
    const first = readProfile(s);
    expect(first.dressed).toBe(false);
    expect(readProfile(s).look).toEqual(first.look);
    writeProfile({ ...first, dressed: true, mode: 'grand-jury' }, s);
    expect(readProfile(s)).toMatchObject({ dressed: true, mode: 'grand-jury' });
  });

  it('the trial room only wears a confirmed look, and survives junk in storage', () => {
    const s = memory();
    expect(savedLook(s)).toBeUndefined();
    writeProfile({ ...base, look: { ...DEFAULT_LOOK, outfit: 'robe' } }, s);
    expect(savedLook(s)).toBeUndefined();
    writeProfile({ ...base, dressed: true, look: { ...DEFAULT_LOOK, outfit: 'robe' } }, s);
    expect(savedLook(s)?.outfit).toBe('robe');
    s.setItem('cc:player', '{not json');
    expect(savedLook(s)).toBeUndefined();
    expect(readProfile(s).mode).toBeNull();
  });
});
