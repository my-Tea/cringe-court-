import { useEffect, useState } from 'react';

/** Current time in ms, refreshed every `intervalMs`. Pass `paused` to stop ticking. */
export function useNow(intervalMs = 1000, paused = false): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, paused]);
  return now;
}
