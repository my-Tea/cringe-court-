import { describe, expect, it } from 'vitest';
import { readPlatformConfig } from '../config';
import { identityFor, identityInfo } from './createIdentity';

describe('identityFor / identityInfo', () => {
  it('defaults to the mock', () => {
    const c = readPlatformConfig({});
    expect(identityFor(c, 'h').id).toBe('mock');
    expect(identityInfo(c)).toEqual({ kind: 'mock', label: 'Mock World ID', detail: 'Mock World ID (demo personas)' });
  });
  it('chooses World IDKit when configured', () => {
    const c = readPlatformConfig({ VITE_IDENTITY: 'world-idkit', VITE_WORLD_APP_ID: 'app_abc', VITE_WORLD_BACKEND_URL: 'https://verify.example.com/api' });
    const p = identityFor(c, 'h');
    expect(p.id).toBe('world-idkit');
    expect(p.appId).toBe('app_abc');
    expect(identityInfo(c).detail).toBe('World ID · app_abc · verifier backend verify.example.com');
  });
  it('falls back to the mock when half configured', () => {
    expect(identityFor(readPlatformConfig({ VITE_IDENTITY: 'world-idkit' }), 'h').id).toBe('mock');
  });
});
