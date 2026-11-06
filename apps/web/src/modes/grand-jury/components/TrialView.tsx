import { CHARACTER_NAMES, SPEAKER_CHARACTER, type CourtLine } from '@cringe-court/core';
import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { useCallback, useEffect, useState } from 'react';
import { DialogueBox, ImpactText, PaperPanel, Portrait, RoundIconButton, cx, useMotion } from '@/ds';
import { portraitOf, sound } from '../lib';
import styles from '../GrandJury.module.css';

/**
 * The seam where the hearing is staged. Today it is a papercraft "spotlight"
 * stage: the three speakers on paper risers, one line at a time in the
 * dialogue box, with step and autoplay controls. The first-person
 * <RoamCourtroom> (v3/roam-fp) replaces the body of this component and drives
 * the same beats through `roam.runBeat(line)`: every beat it needs is a
 * `CourtLine` from `hearingLines(detail)`. Nothing else in the Grand Jury
 * changes when it is swapped.
 */
export interface TrialViewProps {
  detail: CaseDetail;
  /** Line to start on (defaults to the first). */
  startAt?: number;
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

/** The beats a hearing plays, in order: the frozen transcript, then the judge's sentence once there is a verdict. */
export function hearingLines(detail: CaseDetail): readonly CourtLine[] {
  return detail.sentence ? [...detail.transcript, detail.sentence] : detail.transcript;
}

const RISERS = [
  { key: 'for', character: 'prosecutor', bench: 0 },
  { key: 'court', character: 'judge', bench: undefined },
  { key: 'against', character: 'defense', bench: 1 },
] as const;

export function TrialView({ detail, startAt = 0 }: TrialViewProps) {
  const { reduced } = useMotion();
  const lines = hearingLines(detail);
  const [index, setIndex] = useState(Math.min(startAt, Math.max(0, lines.length - 1)));
  const [autoplay, setAutoplay] = useState(false);
  const [typed, setTyped] = useState(false);
  const line = lines[index];
  const last = index >= lines.length - 1;

  const go = useCallback(
    (to: number) => {
      setTyped(false);
      setIndex(Math.max(0, Math.min(lines.length - 1, to)));
    },
    [lines.length],
  );

  // Autoplay waits for the typewriter, then holds the line long enough to read it.
  useEffect(() => {
    if (!autoplay || !typed) return;
    if (last) {
      setAutoplay(false);
      return;
    }
    const id = window.setTimeout(() => go(index + 1), reduced ? 2600 : 1400);
    return () => window.clearTimeout(id);
  }, [autoplay, typed, last, index, go, reduced]);

  // Courtroom cues for the beats that have one (objection sting, gavel).
  useEffect(() => {
    if (!autoplay || !line?.beat) return;
    if (line.beat === 'objection') sound({ type: 'objection', by: line.bench === 1 ? 'defense' : 'prosecution' });
    else if (line.beat === 'gavel') sound({ type: 'order' });
    else if (line.beat === 'gasp') sound({ type: 'crowd', reaction: 'gasp' });
  }, [autoplay, line]);

  const onDone = useCallback(() => setTyped(true), []);

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
          The hearing
        </h2>
        <p className={styles.trialCounter} aria-live="polite">
          Line {index + 1} of {lines.length}
          {detail.transcriptTeaser && ' · free teaser'}
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
        <RoundIconButton label="Previous line" icon="arrow-left" tone="gold" onClick={() => go(index - 1)} disabled={index === 0} />
        <RoundIconButton
          label={autoplay ? 'Pause the hearing' : 'Play the hearing'}
          icon={autoplay ? 'close' : 'gavel'}
          tone="royal"
          size="lg"
          pressed={autoplay}
          onClick={() => {
            if (last && !autoplay) go(0);
            setAutoplay((a) => !a);
          }}
        />
        <RoundIconButton label="Next line" icon="arrow-right" tone="gold" onClick={() => go(index + 1)} disabled={last} />
      </div>
    </PaperPanel>
  );
}
