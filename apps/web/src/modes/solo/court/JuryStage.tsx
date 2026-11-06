import { useEffect, useState } from 'react';
import type { JurySeat, JuryState } from '@cringe-court/core';
import { NPC_PERSONAS, isDemoTerms, type SoloSession, type SoloSnapshot } from '@cringe-court/modes-solo';
import { Alert, Badge, Button, Countdown, ErrorState, PhaseStepper, Spinner, Stamp, cx, useReducedMotion } from '@/ds';
import { jurorArt, sceneArt } from '../lib/art';
import type { DemoClock } from '../lib/demoCourt';
import { SoloIcon } from '../lib/SoloIcon';
import { JURY_PACING, JURY_PACING_FAST, useJuryDirector } from './useJuryDirector';
import styles from './JuryStage.module.css';

const STEPS = ['Jury seated', 'Secret Verdict Scroll', 'Open your scroll', 'Verdict'];

function stepIndex(t: JuryState): number {
  if (t.step === 'recruiting' || t.step === 'briefing') return 0;
  if (t.step === 'commit') return 1;
  if (t.step === 'reveal') return 2;
  return 3;
}

function useDemoNow(clock: DemoClock): number {
  const [now, setNow] = useState(() => clock.now() * 1000);
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock.now() * 1000), 1000);
    return () => window.clearInterval(id);
  }, [clock]);
  return now;
}

function seatStatus(seat: JurySeat | undefined, step: JuryState['step'], ballot: readonly [string, string]): { text: string; tone: 'neutral' | 'info' | 'highlight' | 'danger' | 'success' } {
  if (!seat) return { text: 'Seat empty', tone: 'neutral' };
  if (seat.revealed && seat.choice !== undefined) return { text: ballot[seat.choice], tone: seat.choice === 0 ? 'danger' : 'success' };
  if (seat.committed) return { text: step === 'reveal' ? 'Opening scroll…' : 'Scroll sealed', tone: 'highlight' };
  return { text: step === 'commit' ? 'Deciding…' : 'Seated · bond posted', tone: 'info' };
}

export interface JuryStageProps {
  session: SoloSession;
  snap: SoloSnapshot & { trial: JuryState };
  clock: DemoClock;
}

/**
 * The jury box. Three demo NPC jurors take their seats (posting the 0.40 bond),
 * seal their ballots (commit) and open them (reveal) on the in-browser ledger.
 * Choices stay hidden until each reveal, exactly like the contract (V4 §7).
 */
export function JuryStage({ session, snap, clock }: JuryStageProps) {
  const reduced = useReducedMotion();
  const [running, setRunning] = useState(true);
  const [fast, setFast] = useState(false);
  useJuryDirector(session, snap, running, fast || reduced ? JURY_PACING_FAST : JURY_PACING);
  const now = useDemoNow(clock);
  const t = snap.trial;
  const demo = isDemoTerms(t.terms);
  const current = stepIndex(t);
  const sealed = t.seats.filter((s) => s.committed).length;
  const opened = t.seats.filter((s) => s.revealed).length;

  const announce =
    t.step === 'recruiting'
      ? `Seating the jury: ${t.seats.length} of ${t.terms.jurySize}.`
      : t.step === 'commit'
        ? `Ballots sealed: ${sealed} of ${t.terms.jurySize}.`
        : t.step === 'reveal'
          ? `Scrolls opened: ${opened} of ${t.terms.jurySize}.`
          : 'Deliberation closed. Counting the votes.';

  return (
    <section className={styles.stage} aria-labelledby="jury-title">
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>Phase 3 · The jury</p>
          <h2 id="jury-title" className={styles.title}>
            {t.step === 'finalizing' ? 'Counting the scrolls' : 'The jury is out'}
          </h2>
        </div>
        <PhaseStepper steps={STEPS} current={current} label="Jury progress" className={styles.stepper} />
      </header>

      {demo && (
        <Alert tone="info" title="Demo jury: three NPCs, real procedure">
          In a live case three random World ID–verified humans take these seats. Here, NPC jurors post the real 0.40 test-USDC bond and seal
          real commit–reveal ballots on the in-browser ledger. Deadlines are demo settings ({t.terms.deadlines.commit / 60} min to seal, {t.terms.deadlines.reveal / 60} min to open; live cases use 20 and 10) and the demo clock skips ahead once everyone is done.
        </Alert>
      )}

      <div className={styles.box} style={{ ['--_set' as string]: `url(${sceneArt('jury')})` }}>
        <ol className={styles.seats} role="list" aria-label="Jury seats">
          {NPC_PERSONAS.map((p, i) => {
            const seat = t.seats[i];
            const status = seatStatus(seat, t.step, t.terms.ballot);
            const said = seat?.revealed && seat.choice !== undefined ? p.says[seat.choice] : null;
            return (
              <li key={p.id} className={styles.seat} data-filled={Boolean(seat) || undefined} data-state={seat?.revealed ? 'revealed' : seat?.committed ? 'sealed' : seat ? 'seated' : 'empty'}>
                <div className={styles.figure}>
                  <img src={jurorArt(p.id)} alt="" data-pixel className={styles.sprite} />
                  {seat?.committed && !seat.revealed && (
                    <span className={styles.scroll} aria-hidden>
                      <SoloIcon name="scroll" />
                    </span>
                  )}
                  {said && <p className={styles.bubble}>“{said}”</p>}
                </div>
                <div className={styles.plate}>
                  <span className={styles.seatNo}>Seat {i + 1}</span>
                  <strong className={styles.name}>{p.name}</strong>
                  <span className={styles.bio}>{p.bio}</span>
                  <Badge tone={status.tone} dot={status.tone === 'info' || status.tone === 'highlight' ? 'pulse' : undefined}>
                    {status.text}
                  </Badge>
                </div>
              </li>
            );
          })}
        </ol>
        <div className={cx(styles.ballotBox, t.step === 'reveal' || t.step === 'finalizing' ? styles.open : undefined)} aria-hidden>
          <span>{t.step === 'reveal' || t.step === 'finalizing' ? 'OPEN' : 'SEALED'}</span>
        </div>
      </div>

      <p className="cc-visually-hidden" aria-live="polite">
        {announce}
      </p>

      <div className={styles.timers}>
        {t.step === 'commit' && t.commitEndsAt && (
          <Countdown label="Secret Verdict Scroll closes" startsAt={(t.commitEndsAt - t.terms.deadlines.commit) * 1000} endsAt={t.commitEndsAt * 1000} now={now} compact />
        )}
        {t.step === 'reveal' && t.revealEndsAt && (
          <Countdown label="Scrolls must be opened" startsAt={(t.revealEndsAt - t.terms.deadlines.reveal) * 1000} endsAt={t.revealEndsAt * 1000} now={now} compact />
        )}
        {t.step === 'recruiting' && (
          <Countdown label="Seats must fill" startsAt={(t.recruitEndsAt - t.terms.deadlines.recruitment) * 1000} endsAt={t.recruitEndsAt * 1000} now={now} compact />
        )}
        {t.step === 'finalizing' && (
          <p className={styles.finalizing}>
            <Spinner size="sm" label={null} /> Finalizing on the ledger. Anyone can do this once the reveal window closes.
          </p>
        )}
      </div>

      {snap.error ? (
        <ErrorState
          title="The jury hit a snag"
          headingLevel={3}
          compact
          details={snap.error.message}
          onRetry={() => {
            session.clearError();
            setRunning(true);
          }}
          retryLabel="Resume the jury"
        >
          Nothing was lost: every step so far is on the ledger.
        </ErrorState>
      ) : (
        <div className={styles.actions}>
          <Button variant="secondary" size="sm" onClick={() => setRunning((r) => !r)} iconStart={<SoloIcon name={running ? 'pause' : 'play'} />}>
            {running ? 'Pause the jury' : 'Resume the jury'}
          </Button>
          {!fast && !reduced && (
            <Button variant="ghost" size="sm" onClick={() => setFast(true)}>
              Fast-forward
            </Button>
          )}
          <Stamp tone="case-number" size="sm">
            {`Sealed ${sealed}/${t.terms.jurySize} · Open ${opened}/${t.terms.jurySize}`}
          </Stamp>
        </div>
      )}
    </section>
  );
}
