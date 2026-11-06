import type { CourtLine, Exhibit, Filing } from '@cringe-court/core';
import { sideLabel } from '@cringe-court/modes-versus';
import { t } from '@/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { stagePose } from '@/art/art';
import { guideArt } from '@/art/art';
import { cx, DialogueBox, Icon, type ImpactKind, ImpactText, PaperButton, Stamp, useReducedMotion } from '@/ds';
import { agentName } from '../copy';
import { useVersus } from '../runtime/context';
import styles from './Courtroom.module.css';

export interface CourtroomSeat {
  seat: number;
  committed: boolean;
  revealed: boolean;
}

export interface CourtroomProps {
  lines: readonly CourtLine[];
  exhibits: readonly Exhibit[];
  filing: Filing;
  /** Jury box: seats taken so far (empty seats are drawn up to `jurySize`). */
  seats?: readonly CourtroomSeat[];
  jurySize?: number;
  /** After the verdict the agents react. */
  verdict?: 'a' | 'b' | 'none' | null;
  autoPlay?: boolean;
  /** Small label over the stage ("Preview: not frozen yet"). */
  banner?: string;
  className?: string;
}

const JUROR_TAG = {
  empty: 'versus.court.jury.empty',
  opened: 'versus.court.jury.opened',
  sealed: 'versus.court.jury.sealed',
  seated: 'versus.court.jury.seated',
} as const;

function calloutFor(line: CourtLine, index: number): ImpactKind | null {
  if (index === 0) return 'order';
  const head = line.text.trimStart().toUpperCase();
  if (head.startsWith('OBJECTION')) return 'objection';
  if (head.startsWith('COUNTER')) return 'counter';
  if (line.beat === 'laugh') return 'cook';
  return null;
}

function speakerOf(line: CourtLine): 'side-a' | 'side-b' | 'judge' {
  return line.speaker === 'side-a' || line.speaker === 'side-b' ? line.speaker : 'judge';
}

/**
 * The shared trial: both agents argue the frozen transcript in front of the
 * judge and the jury box, one line at a time. Everyone in the case watches the
 * same lines. A plain transcript is always one click away (and is what screen
 * readers get line by line through the dialogue box).
 */
export function Courtroom({ lines, exhibits, filing, seats = [], jurySize = 3, verdict = null, autoPlay = false, banner, className }: CourtroomProps) {
  const { audio } = useVersus();
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);
  const [typed, setTyped] = useState(false);
  const timer = useRef<number | null>(null);
  const line = lines[Math.min(index, lines.length - 1)];
  const last = index >= lines.length - 1;
  // Playback stops by itself once the last line has been typed out.
  const isPlaying = playing && !(last && typed);

  const go = useCallback(
    (i: number) => {
      setTyped(false);
      setIndex(Math.max(0, Math.min(lines.length - 1, i)));
    },
    [lines.length],
  );

  // Sound for each new line (silent unless the user turned sound on).
  useEffect(() => {
    if (!line) return;
    const who = speakerOf(line);
    if (index === 0) audio.handle({ type: 'hearing.opened' });
    else if (calloutFor(line, index) === 'objection') audio.handle({ type: 'objection', by: who === 'judge' ? 'judge' : who });
    else if (line.beat === 'gavel') audio.handle({ type: 'order' });
    else if (line.beat === 'laugh') audio.handle({ type: 'crowd', reaction: 'laugh' });
    else if (line.beat === 'present-evidence') audio.handle({ type: 'case.stamped' });
    else if (who !== 'judge') audio.handle({ type: 'statement.started', by: who });
  }, [line, index, audio]);

  // Auto-advance once a line has been typed out.
  useEffect(() => {
    if (!playing || !typed || !line || last) return;
    const pause = reduced ? Math.max(2500, line.text.length * 45) : 1700;
    timer.current = window.setTimeout(() => go(index + 1), pause);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [playing, typed, line, last, index, go, reduced]);

  const onDone = useCallback(() => setTyped(true), []);

  if (!line) return null;
  const who = speakerOf(line);
  const callout = calloutFor(line, index);
  const exhibit = line.exhibitId ? exhibits.find((x) => x.id === line.exhibitId) : undefined;
  const nameA = sideLabel('a', filing.sides.a, { quotes: true });
  const nameB = sideLabel('b', filing.sides.b, { quotes: true });
  const speakerName = who === 'side-a' ? t('versus.court.speaker', { agent: agentName('a'), name: nameA }) : who === 'side-b' ? t('versus.court.speaker', { agent: agentName('b'), name: nameB }) : t('versus.court.judge');
  const juryOut = line.segment === 'jury-out';

  const poseA = verdict === 'a' ? 'happy' : verdict === 'b' ? 'defeated' : who === 'side-a' && callout === 'objection' ? 'objection' : 'talking';
  const poseB = verdict === 'b' ? 'happy' : verdict === 'a' ? 'defeated' : who === 'side-b' && callout ? 'angry' : 'talking';
  const poseJudge = who === 'judge' ? (line.beat === 'gavel' ? 'objection' : 'talking') : 'idle';

  return (
    <section className={cx(styles.court, className)} aria-label={t('versus.court.aria')}>
      <div className={styles.stage} data-speaker={who}>
        <img className={styles.backdrop} src={guideArt('colonnade')} alt="" />
        <div className={styles.light} aria-hidden />
        {banner && <p className={styles.banner}>{banner}</p>}

        <figure className={styles.bench} data-at="a" data-active={who === 'side-a' || undefined}>
          <img src={stagePose('side-a', poseA)} alt="" data-pixel className={styles.sprite} />
          <figcaption className={styles.plate} data-side="a">
            {agentName('a')} <span>{nameA}</span>
          </figcaption>
        </figure>

        <figure className={styles.bench} data-at="judge" data-active={who === 'judge' || undefined}>
          <img src={stagePose('judge', poseJudge)} alt="" data-pixel className={styles.sprite} />
          <figcaption className={styles.plate} data-side="judge">
            {t('versus.court.judge')}
          </figcaption>
        </figure>

        <figure className={styles.bench} data-at="b" data-active={who === 'side-b' || undefined}>
          <img src={stagePose('side-b', poseB)} alt="" data-pixel className={styles.sprite} />
          <figcaption className={styles.plate} data-side="b">
            {agentName('b')} <span>{nameB}</span>
          </figcaption>
        </figure>

        <div className={styles.juryBox} aria-label={t('versus.court.jury.aria', { seated: seats.length, size: jurySize })} role="img">
          {Array.from({ length: jurySize }, (_, i) => {
            const seat = seats[i];
            const state = !seat ? 'empty' : seat.revealed ? 'opened' : seat.committed ? 'sealed' : 'seated';
            return (
              <div key={i} className={styles.juror} data-state={state}>
                {seat && <img src={stagePose('juror', 'seated')} alt="" data-pixel />}
                <span className={styles.jurorTag}>{t(JUROR_TAG[state])}</span>
              </div>
            );
          })}
        </div>

        {callout && !juryOut && (
          <div className={styles.callout} data-at={who} key={`c-${index}`}>
            <ImpactText kind={callout} size="md" animate />
          </div>
        )}
        {juryOut && (
          <div className={styles.juryOut} key={`j-${index}`}>
            <Stamp tone="case-number" size="lg" animate>
              {t('versus.court.juryOut')}
            </Stamp>
          </div>
        )}
        {exhibit && (
          <aside className={styles.exhibit} key={`x-${index}`} aria-label={t('versus.court.exhibit.aria', { title: exhibit.title })}>
            <p className={styles.exhibitLabel}>
              {t('versus.court.exhibit.label', { side: exhibit.submittedBy === 'court' ? t('versus.court.exhibit.court') : exhibit.submittedBy.toUpperCase() })}
            </p>
            <p className={styles.exhibitTitle}>{exhibit.title}</p>
            <p className={styles.exhibitBody}>{exhibit.body}</p>
          </aside>
        )}
      </div>

      <div aria-live="polite" className={styles.dialogue}>
        <DialogueBox speaker={who} expression={callout === 'objection' ? 'shocked' : line.beat === 'smug' || line.beat === 'laugh' ? 'smug' : 'neutral'} speakerName={speakerName} text={line.text} onDone={onDone} />
      </div>

      <div className={styles.controls}>
        <PaperButton size="sm" variant="ghost" iconStart={<Icon name="arrow-left" />} onClick={() => go(index - 1)} disabled={index === 0}>
          {t('common.action.back')}
        </PaperButton>
        <PaperButton
          size="sm"
          variant={isPlaying ? 'maroon' : 'gold'}
          onClick={() => {
            if (!isPlaying && last) go(0);
            setPlaying(!isPlaying);
          }}
          aria-pressed={isPlaying}
        >
          {isPlaying ? t('versus.court.pause') : last ? t('versus.court.replay') : index === 0 ? t('versus.court.play') : t('versus.court.resume')}
        </PaperButton>
        <PaperButton size="sm" variant="ghost" iconEnd={<Icon name="arrow-right" />} onClick={() => go(index + 1)} disabled={last}>
          {t('versus.court.next')}
        </PaperButton>
        <span className={styles.progress} aria-live="off">
          {t('versus.court.progress', { n: index + 1, total: lines.length })}
        </span>
      </div>

      <details className={styles.transcript}>
        <summary>{t('versus.court.transcript', { count: lines.length })}</summary>
        <ol className={styles.transcriptList}>
          {lines.map((l, i) => {
            const s = speakerOf(l);
            return (
              <li key={l.id} data-speaker={s} aria-current={i === index ? 'step' : undefined}>
                <button type="button" onClick={() => go(i)} className={styles.transcriptLine}>
                  <span className={styles.transcriptWho}>{s === 'side-a' ? agentName('a') : s === 'side-b' ? agentName('b') : t('versus.court.judgeShort')}</span>
                  <span>{l.text}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
