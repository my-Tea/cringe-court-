import { BASE_MODES } from '@cringe-court/core';
import { describe, expect, it } from 'vitest';
import { loadWebModes, type WebModeModule } from './registry';

describe('web mode registry', () => {
  it('always has the three base modes', () => {
    const { registry, modules } = loadWebModes({});
    expect(registry.list()).toHaveLength(3);
    expect(modules.size).toBe(0);
  });

  it('registers a discovered mode folder over the base definition', () => {
    const mod: WebModeModule = { definition: { ...BASE_MODES.solo, rules: { ...BASE_MODES.solo.rules, maxExhibits: 2 } }, routes: [{ path: 'play' }] };
    const { registry, modules } = loadWebModes({ './solo/mode.tsx': mod });
    expect(registry.get('solo').rules.maxExhibits).toBe(2);
    expect(modules.get('solo')?.routes).toHaveLength(1);
  });

  it('rejects a folder that does not match its mode id', () => {
    expect(() => loadWebModes({ './versus/mode.ts': { definition: BASE_MODES.solo } })).toThrow(/folder must be named/);
  });
});
