/**
 * Demo clocks that survive wall-clock jumps (UX evaluation B19).
 *
 * The in-browser demo courts time their windows (invites, juries) in unix
 * seconds. Reading `Date.now()` on every tick means an NTP correction, a
 * restored VM or a changed system clock can expire a window in one step, so
 * an invite closes mid-acceptance or a jury becomes a mistrial for no reason
 * the player can see. This clock reads the wall clock once, then moves only as
 * fast as the monotonic `performance.now()`. Reloading re-anchors it, so time
 * that really passed between visits still counts. Live cases use the chain's
 * own block time and never this.
 */

export interface MonotonicSource {
  now(): number;
}

/** Unix seconds (fractional), anchored to the wall clock once and advanced monotonically. */
export function monotonicUnixClock(perf: MonotonicSource | null = globalThis.performance ?? null, wallMs: () => number = Date.now): () => number {
  if (!perf || typeof perf.now !== 'function') return () => wallMs() / 1000;
  const anchor = wallMs() - perf.now();
  let last = -Infinity;
  return () => {
    // Never step backwards, even if a polyfilled source does.
    last = Math.max(last, (anchor + perf.now()) / 1000);
    return last;
  };
}
