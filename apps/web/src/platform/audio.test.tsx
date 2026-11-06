import type { AudioEngine } from '@cringe-court/audio';
import { SETTINGS_STORAGE_KEY } from '@cringe-court/audio';
import { act, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionProvider } from '@/ds/motion/MotionProvider';
import { AudioMotionBridge, __setAppAudioForTests, appAudio, appAudioPort, caseCue, useAudioSettings, useChangeCue, useDeadlineCues, usePhaseCue } from './audio';

function fakeEngine() {
  return { handle: vi.fn(), setAmbience: vi.fn(), setSystemReduced: vi.fn(), play: vi.fn(() => null), unlock: vi.fn(async () => false), setMuted: vi.fn(), stopAll: vi.fn() };
}
const asEngine = (f: ReturnType<typeof fakeEngine>) => f as unknown as AudioEngine;

afterEach(() => __setAppAudioForTests(null));

describe('appAudio', () => {
  it('is one lazily created engine, and a safe no-op without Web Audio (jsdom)', () => {
    const a = appAudio();
    expect(appAudio()).toBe(a);
    expect(a.getSnapshot().state).toBe('unavailable');
    expect(() => caseCue({ type: 'verdict.read', outcome: 'guilty' })).not.toThrow();
    expect(a.play('gavel_strike')).toBeNull();
  });

  it('persists settings under the package storage key and exposes them live', () => {
    const { result } = renderHook(() => useAudioSettings());
    expect(result.current.settings.muted).toBe(false);
    act(() => appAudio().setVolume('master', 0.25));
    expect(result.current.settings.master).toBe(0.25);
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}').master).toBe(0.25);
  });

  it('routes core cues and case events through the shared engine', () => {
    const f = fakeEngine();
    __setAppAudioForTests(asEngine(f));
    caseCue({ type: 'case.stamped' });
    expect(f.handle).toHaveBeenCalledWith({ type: 'case.stamped' });
    appAudioPort.play('sfx.gavel');
    expect(f.play).toHaveBeenCalled();
    appAudioPort.setMuted(true);
    expect(f.setMuted).toHaveBeenCalledWith(true);
  });
});

describe('AudioMotionBridge', () => {
  it('feeds the app motion preference into the engine', () => {
    const f = fakeEngine();
    __setAppAudioForTests(asEngine(f));
    window.localStorage.setItem('cc:motion', 'reduced');
    render(
      <MotionProvider>
        <AudioMotionBridge />
      </MotionProvider>,
    );
    expect(f.setSystemReduced).toHaveBeenLastCalledWith(true);
  });
});

describe('usePhaseCue', () => {
  it('sets the bed for the first phase, then fires phase.entered once per change', () => {
    const f = fakeEngine();
    const { rerender } = renderHook(({ p }) => usePhaseCue(p, asEngine(f)), { initialProps: { p: 'recruiting' as const as 'recruiting' | 'commit' } });
    expect(f.setAmbience).toHaveBeenCalledWith('lobby');
    expect(f.handle).not.toHaveBeenCalled();
    rerender({ p: 'recruiting' });
    rerender({ p: 'commit' });
    rerender({ p: 'commit' });
    expect(f.handle).toHaveBeenCalledTimes(1);
    expect(f.handle).toHaveBeenCalledWith({ type: 'phase.entered', phase: 'commit' });
  });
});

describe('useDeadlineCues', () => {
  it('ticks once per second near the end and stays silent on first sight', () => {
    const f = fakeEngine();
    const end = 100_000;
    const { rerender } = renderHook(({ now }) => useDeadlineCues(end, now, asEngine(f)), { initialProps: { now: 95_000 } });
    expect(f.handle).not.toHaveBeenCalled();
    rerender({ now: 95_100 });
    expect(f.handle).not.toHaveBeenCalled();
    rerender({ now: 96_000 });
    rerender({ now: 96_400 });
    expect(f.handle).toHaveBeenCalledTimes(1);
    expect(f.handle).toHaveBeenCalledWith({ type: 'deadline.tick', secondsLeft: 4 });
  });
});

describe('useChangeCue', () => {
  it('does not fire on mount or on equal values', () => {
    const f = fakeEngine();
    const { rerender } = renderHook(({ n }) => useChangeCue(n, (k, was) => (k > was ? { type: 'bond.posted' } : null), asEngine(f)), { initialProps: { n: 3 } });
    rerender({ n: 3 });
    expect(f.handle).not.toHaveBeenCalled();
    rerender({ n: 4 });
    expect(f.handle).toHaveBeenCalledTimes(1);
  });
});
