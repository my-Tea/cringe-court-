import { CHARACTER_NAMES, SPEAKER_CHARACTER, type CourtLine } from '@cringe-court/core';
import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DialogueBox, ImpactText, PaperPanel, Portrait, RoundIconButton, cx, useMotion } from '@/ds';
import { t } from '@/i18n';
import { hearingLines, portraitOf, sound } from '../lib';
import styles from '../GrandJury.module.css';

/**
 * The seam where the hearing is staged. Today it is a papercraft "spotlight"
 * stage: the three speakers on paper risers, one line at a time in the
 * dialogue box, with step and autoplay controls. The first-person
 * <RoamCourtroom> (v3/roam-fp) replaces the body of this component and drives
 * the same beats through `roam.runBeat(line)`: every beat it needs is a
 * `CourtLine` from `hearingLines(detail)` (lib.ts). Nothing else in the Grand Jury
 * changes when it is swapped.
 */
export interface TrialViewProps {
  detail: CaseDetail;
  /** Line to start on (defaults to the first). */
  startAt?: number;
  /**
   * Called with every beat as it comes up (including the first). This is the
   * hand-off a room behind the hearing subscribes to: the roaming courtroom
   * calls `roam.runBeat(line)` here. Decorative only; the dialogue box already
   * speaks every line to assistive tech.
   */
  onBeat?: (line: CourtLine, index: number) => void;
}

const IMPACT: Partial<Record<NonNullable<CourtLine['beat']>, 'objection' | 'order' | 'counter' | 'cook'>> = {
  objection: 'objection',
  gavel: 'order',
  'desk-slam': 'counter',
  smug: 'cook',
};

const EXPRESSION: Partial<Record<NonNullable<CourtLine['beat']>, 'smug' | 'shocked' | 'defeated'>> = {
  smug: 'smug',
  objection: 'shocked',
  gasp: 'shocked',
  cry: 'defeated',
  sweat: 'defeated',
  'desk-slam': 'shocked',
};

const RISERS = [
  { key: 'for', character: 'prosecutor', bench: 0 },
  { key: 'court', character: 'judge', bench: undefined },
  { key: 'against', character: 'defense', bench: 1 },
] as const;

export function TrialView({ detail, startAt = 0, onBeat }: TrialViewProps) {
  const { reduced } = useMotion();
  const lines = hearingLines(detail);
  const [index, setIndex] = useState(Math.min(startAt, Math.max(0, lines.length - 1)));
  const [autoplay, setAutoplay] = useState(false);
  const [typed, setTyped] = useState(false);
  const line = lines[index];
  const last = index >= lines.length - 1;
  // Autoplay ends by itself on the last line.
  const playing = autoplay && !last;

  const go = useCallback(
    (to: number) => {
      setTyped(false);
      setIndex(Math.max(0, Math.min(lines.length - 1, to)));
    },
    [lines.length],
  );

  // Autoplay waits for the typewriter, then holds the line long enough to read it.
  useEffect(() => {
    if (!playing || !typed) return;
    const id = window.setTimeout(() => go(index + 1), reduced ? 2600 : 1400);
    return () => window.clearTimeout(id);
  }, [playing, typed, index, go, reduced]);

  // Courtroom cues for the beats that have one (objection sting, gavel).
  useEffect(() => {
    if (!playing || !line?.beat) return;
    if (line.beat === 'objection') sound({ type: 'objection', by: line.bench === 1 ? 'defense' : 'prosecution' });
    else if (line.beat === 'gavel') sound({ type: 'order' });
    else if (line.beat === 'gasp') sound({ type: 'crowd', reaction: 'gasp' });
  }, [playing, line]);

  const onDone = useCallback(() => setTyped(true), []);

  const beat = useRef(onBeat);
  useEffect(() => {
    beat.current = onBeat;
  });
  useEffect(() => {
    if (line) beat.current?.(line, index);
  }, [line, index]);

  if (!line) return null;
  const speaker = SPEAKER_CHARACTER[line.speaker];
  const character = portraitOf(speaker);
  const impact = line.beat ? IMPACT[line.beat] : undefined;
  const expression = line.beat ? (EXPRESSION[line.beat] ?? 'neutral') : 'neutral';
  const side = line.bench === 0 ? 'for' : line.bench === 1 ? 'against' : 'court';

  return (
    <PaperPanel as="section" tone="maroon" edge="cut" elevation={3} backing="gold" padding="md" className={styles.trialView} aria-labelledby="hearing-title" data-side={side}>
      <header className={styles.trialHead}>
        <h2 id="hearing-title" className={styles.trialTitle}>
          {t('grandJury.trial.title')}
        </h2>
        <p className={styles.trialCounter} aria-live="polite">
          {t(detail.transcriptTeaser ? 'grandJury.trial.counterTeaser' : 'grandJury.trial.counter', { n: index + 1, total: lines.length })}
        </p>
      </header>
      <div className={styles.trialStage}>
        <div className={styles.trialSky} aria-hidden />
        <ul className={styles.risers} aria-hidden>
          {RISERS.map((r) => (
            <li key={r.key} className={cx(styles.riser, r.key === side && styles.riserLit)} data-riser={r.key}>
              <Portrait character={r.character} expression={r.key === side ? expression : 'neutral'} size="lg" ring={r.bench === 0 ? 'accent' : r.bench === 1 ? 'side-a' : 'highlight'} alt="" />
              <span className={styles.riserName}>
                {CHARACTER_NAMES[r.character]}
                {r.bench !== undefined && <span className={styles.riserSide}>{detail.ballot[r.bench]}</span>}
              </span>
            </li>
          ))}
        </ul>
        {impact && !reduced && <ImpactText key={line.id} kind={impact} size="md" animate className={styles.trialImpact} />}
      </div>
      <DialogueBox key={line.id} speaker={character} speakerName={CHARACTER_NAMES[speaker]} expression={expression} text={line.text} onDone={onDone} className={styles.trialDialogue} />
      <div className={styles.trialControls}>
        <RoundIconButton label={t('grandJury.trial.prev')} icon="arrow-left" tone="gold" onClick={() => go(index - 1)} disabled={index === 0} />
        <RoundIconButton
          label={playing ? t('grandJury.trial.pause') : t('grandJury.trial.play')}
          icon={playing ? 'close' : 'gavel'}
          tone="royal"
          size="lg"
          pressed={playing}
          onClick={() => {
            if (playing) return setAutoplay(false);
            if (last) go(0);
            setAutoplay(true);
          }}
        />
        <RoundIconButton label={t('grandJury.trial.next')} icon="arrow-right" tone="gold" onClick={() => go(index + 1)} disabled={last} />
      </div>
    </PaperPanel>
  );
}
