import { useEffect, useRef, useState } from 'react';
import type { JurySeat, JuryState } from '@cringe-court/core';
import { NPC_PERSONAS, isDemoTerms, type SoloSession, type SoloSnapshot } from '@cringe-court/modes-solo';
import { Alert, Badge, Button, Countdown, ErrorState, PaperButton, PaperPanel, PaperRibbon, Spinner, Stamp, useReducedMotion } from '@/ds';
import { jurorArt, sceneArt } from '../lib/art';
import type { DemoClock } from '../lib/demoCourt';
import { SoloIcon } from '../lib/SoloIcon';
import { useDeadlineCues } from '@/platform/audio';
import { caseSound } from '../lib/sound';
import { SoundToggle } from '../lib/SoundToggle';
import { t, type MessageKey } from '@/i18n';
import { JURY_PACING, JURY_PACING_FAST, useJuryDirector } from './useJuryDirector';
import styles from './JuryStage.module.css';

const STEPS = ['solo.jury.steps.seated', 'solo.jury.steps.scroll', 'solo.jury.steps.open', 'solo.jury.steps.verdict'] as const satisfies readonly MessageKey[];

function stepIndex(tState: JuryState): number {
  if (tState.step === 'recruiting' || tState.step === 'briefing') return 0;
  if (tState.step === 'commit') return 1;
  if (tState.step === 'reveal') return 2;
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

function seatStatus(
  seat: JurySeat | undefined,
  step: JuryState['step'],
  ballot: readonly [string, string],
): {
  text: string;
  tone: 'neutral' | 'info' | 'highlight' | 'danger' | 'success';
} {
  if (!seat) return { text: t('solo.jury.seat.empty'), tone: 'neutral' };
  if (seat.revealed && seat.choice !== undefined)
    return {
      text: ballot[seat.choice],
      tone: seat.choice === 0 ? 'danger' : 'success',
    };
  if (seat.committed)
    return {
      text: step === 'reveal' ? t('solo.jury.seat.opening') : t('solo.jury.seat.sealed'),
      tone: 'highlight',
    };
  return {
    text: step === 'commit' ? t('solo.jury.seat.deciding') : t('solo.jury.seat.seated'),
    tone: 'info',
  };
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
  const tState = snap.trial;
  const demo = isDemoTerms(tState.terms);
  const current = stepIndex(tState);
  const sealed = tState.seats.filter((s) => s.committed).length;
  const opened = tState.seats.filter((s) => s.revealed).length;
  const seated = tState.seats.length;

  // Sound for each visible jury moment (silent until the user turns sound on).
  const prev = useRef({ seated, sealed, opened });
  useEffect(() => {
    const p = prev.current;
    if (seated > p.seated) caseSound({ type: 'juror.seated', index: seated - 1 });
    if (sealed > p.sealed) caseSound({ type: 'ballot.committed' });
    if (opened > p.opened) {
      caseSound({ type: 'ballot.revealed' });
      caseSound({ type: 'vote.counted', index: opened - 1 });
    }
    prev.current = { seated, sealed, opened };
  }, [seated, sealed, opened]);

  // Deadline warnings for whichever window is open (once per second, last 30 s).
  const endsAt = tState.step === 'commit' ? tState.commitEndsAt : tState.step === 'reveal' ? tState.revealEndsAt : tState.step === 'recruiting' ? tState.recruitEndsAt : null;
  useDeadlineCues(endsAt ? endsAt * 1000 : null, now);

  const announce =
    tState.step === 'recruiting'
      ? t('solo.jury.announce.recruiting', { seated: tState.seats.length, size: tState.terms.jurySize })
      : tState.step === 'commit'
        ? t('solo.jury.announce.commit', { sealed, size: tState.terms.jurySize })
        : tState.step === 'reveal'
          ? t('solo.jury.announce.reveal', { opened, size: tState.terms.jurySize })
          : t('solo.jury.announce.closed');

  return (
    <section className={styles.stage} aria-labelledby="jury-title">
      <header className={styles.head}>
        <div>
          <p className={styles.eyebrow}>{t('solo.jury.eyebrow')}</p>
          <PaperRibbon as="h2" id="jury-title" tone="maroon" className={styles.title}>
            {tState.step === 'finalizing' ? t('solo.jury.heading.counting') : t('solo.jury.heading.out')}
          </PaperRibbon>
        </div>
        <p className={styles.stepNote}>
          {t('solo.jury.stepNote', { n: current + 1, total: STEPS.length, name: t(STEPS[current]!) })}
        </p>
      </header>

      {demo && (
        <Alert tone="info" title={t('solo.jury.demo.title')}>
          {t('solo.jury.demo.body', { commit: tState.terms.deadlines.commit / 60, reveal: tState.terms.deadlines.reveal / 60 })}
        </Alert>
      )}

      <div className={styles.box} style={{ ['--_set' as string]: `url(${sceneArt('jury')})` }}>
        <ol className={styles.seats} role="list" aria-label={t('solo.jury.seats')}>
          {NPC_PERSONAS.map((p, i) => {
            const seat = tState.seats[i];
            const status = seatStatus(seat, tState.step, tState.terms.ballot);
            const said = seat?.revealed && seat.choice !== undefined ? p.says[seat.choice] : null;
            return (
              <li
                key={p.id}
                className={styles.seat}
                data-filled={Boolean(seat) || undefined}
                data-state={seat?.revealed ? 'revealed' : seat?.committed ? 'sealed' : seat ? 'seated' : 'empty'}
              >
                <div className={styles.figure}>
                  <img src={jurorArt(p.id)} alt="" data-pixel className={styles.sprite} />
                  {seat?.committed && !seat.revealed && (
                    <span className={styles.scroll} aria-hidden>
                      <SoloIcon name="scroll" />
                    </span>
                  )}
                  {said && <p className={styles.bubble}>“{said}”</p>}
                </div>
                <PaperPanel
                  tone="cream"
                  edge="cut"
                  elevation={seat ? 2 : 1}
                  backing={seat?.revealed ? 'gold' : 'none'}
                  padding="none"
                  className={styles.plateSheet}
                >
                  <div className={styles.plate}>
                    <span className={styles.seatNo}>{t('solo.jury.seatNo', { n: i + 1 })}</span>
                    <strong className={styles.name}>{p.name}</strong>
                    <span className={styles.bio}>{p.bio}</span>
                    <Badge tone={status.tone} dot={status.tone === 'info' || status.tone === 'highlight' ? 'pulse' : undefined}>
                      {status.text}
                    </Badge>
                  </div>
                </PaperPanel>
              </li>
            );
          })}
        </ol>
        <PaperPanel
          tone={tState.step === 'reveal' || tState.step === 'finalizing' ? 'gold' : 'maroon'}
          edge="zigzag"
          elevation={3}
          padding="sm"
          className={styles.ballotBox}
          aria-hidden
        >
          {tState.step === 'reveal' || tState.step === 'finalizing' ? t('solo.jury.box.open') : t('solo.jury.box.sealed')}
        </PaperPanel>
      </div>

      <p className="cc-visually-hidden" aria-live="polite">
        {announce}
      </p>

      <div className={styles.timers}>
        {tState.step === 'commit' && tState.commitEndsAt && (
          <Countdown
            label={t('solo.jury.timer.commit')}
            startsAt={(tState.commitEndsAt - tState.terms.deadlines.commit) * 1000}
            endsAt={tState.commitEndsAt * 1000}
            now={now}
            compact
          />
        )}
        {tState.step === 'reveal' && tState.revealEndsAt && (
          <Countdown
            label={t('solo.jury.timer.reveal')}
            startsAt={(tState.revealEndsAt - tState.terms.deadlines.reveal) * 1000}
            endsAt={tState.revealEndsAt * 1000}
            now={now}
            compact
          />
        )}
        {tState.step === 'recruiting' && (
          <Countdown
            label={t('solo.jury.timer.recruit')}
            startsAt={(tState.recruitEndsAt - tState.terms.deadlines.recruitment) * 1000}
            endsAt={tState.recruitEndsAt * 1000}
            now={now}
            compact
          />
        )}
        {tState.step === 'finalizing' && (
          <p className={styles.finalizing}>
            <Spinner size="sm" label={null} /> {t('solo.jury.finalizing')}
          </p>
        )}
      </div>

      {snap.error ? (
        <ErrorState
          title={t('solo.jury.error.title')}
          headingLevel={3}
          compact
          details={snap.error.message}
          onRetry={() => {
            session.clearError();
            setRunning(true);
          }}
          retryLabel={t('solo.jury.error.retry')}
        >
          {t('solo.jury.error.body')}
        </ErrorState>
      ) : (
        <div className={styles.actions}>
          <PaperButton variant="maroon" size="sm" onClick={() => setRunning((r) => !r)} iconStart={<SoloIcon name={running ? 'pause' : 'play'} />}>
            {running ? t('solo.jury.pause') : t('solo.jury.resume')}
          </PaperButton>
          <SoundToggle />
          {!fast && !reduced && (
            <Button variant="ghost" size="sm" onClick={() => setFast(true)}>
              {t('solo.jury.fastForward')}
            </Button>
          )}
          <Stamp tone="case-number" size="sm">
            {t('solo.jury.progress', { sealed, opened, size: tState.terms.jurySize })}
          </Stamp>
        </div>
      )}
    </section>
  );
}
