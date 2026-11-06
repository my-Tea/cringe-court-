import { describe, expect, it } from 'vitest';
import { monotonicUnixClock } from '../clock';

describe('monotonicUnixClock (B19)', () => {
  it('starts at the wall clock and then ignores wall-clock jumps', () => {
    let wall = 1_800_000_000_000;
    let mono = 5_000;
    const now = monotonicUnixClock({ now: () => mono }, () => wall);
    expect(now()).toBe(1_800_000_000);
    mono += 10_000;
    wall += 3_549_000; // the host clock jumps forward ~1 h, as seen in the playtest
    expect(now()).toBe(1_800_000_010);
    wall -= 7_200_000; // and backwards
    mono += 1_000;
    expect(now()).toBe(1_800_000_011);
  });

  it('never steps backwards', () => {
    let mono = 100;
    const now = monotonicUnixClock({ now: () => mono }, () => 0);
    mono = 2_000;
    const a = now();
    mono = 1_000;
    expect(now()).toBe(a);
  });

  it('falls back to the wall clock without a monotonic source', () => {
    const now = monotonicUnixClock(null, () => 42_000);
    expect(now()).toBe(42);
  });
});
