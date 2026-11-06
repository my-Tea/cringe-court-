import { useEffect } from 'react';
import type { SoloSession, SoloSnapshot } from '@cringe-court/modes-solo';

export interface JuryPacing {
  seat: number;
  commit: number;
  reveal: number;
  close: number;
}

export const JURY_PACING: JuryPacing = { seat: 1100, commit: 1000, reveal: 1700, close: 1100 };
export const JURY_PACING_FAST: JuryPacing = { seat: 120, commit: 120, reveal: 220, close: 120 };

/**
 * Paces the demo NPC jury one visible step at a time (seat, seal, open), so each
 * step gets its moment on screen. Stops on any error; the UI offers a retry.
 */
export function useJuryDirector(session: SoloSession | null, snap: SoloSnapshot | null, running: boolean, pacing: JuryPacing): void {
  const t = snap?.trial;
  const key = t && t.stage === 'jury' ? `${t.step}:${t.seats.map((s) => `${+s.committed}${+s.revealed}`).join('')}` : (t?.stage ?? '');
  const busy = snap?.busy ?? null;
  const error = snap?.error ?? null;

  useEffect(() => {
    if (!session || !running || busy || error || !t || t.stage !== 'jury') return;
    const seat = session.nextJurorSeat();
    let step: (() => Promise<unknown>) | null = null;
    let delay = pacing.close;
    switch (t.step) {
      case 'recruiting':
        step = () => session.seatNextJuror();
        delay = pacing.seat;
        break;
      case 'commit':
        step = seat ? () => session.commitBallot(seat) : () => session.closeCommit();
        delay = seat ? pacing.commit : pacing.close;
        break;
      case 'reveal':
        step = seat ? () => session.revealBallot(seat) : () => session.closeReveal();
        delay = seat ? pacing.reveal : pacing.close;
        break;
      case 'finalizing':
        step = () => session.finalize();
        break;
      default:
        break;
    }
    if (!step) return;
    const id = window.setTimeout(() => void step!(), delay);
    return () => window.clearTimeout(id);
    // `key` captures every seat change; t itself changes identity on each event.
  }, [session, running, busy, error, key, pacing]);
}
