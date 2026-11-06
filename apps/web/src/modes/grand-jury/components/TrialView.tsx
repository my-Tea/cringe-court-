import { SPEAKER_CHARACTER, type CourtLine } from '@cringe-court/core';
import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { useCallback, useEffect, useState } from 'react';
import { DialogueBox, ImpactText, OrnateFrame, RoundIconButton, useMotion } from '@/ds';
import styles from '../GrandJury.module.css';

/**
 * The seam where the hearing is staged. Today it is a 2D "spotlight" stage: one
 * line at a time in the dialogue box, with step and autoplay controls. The
 * first-person <RoamCourtroom> (v3/roam-fp) replaces the body of this
 * component and drives the same beats through `roam.runBeat(line)`; nothing
 * else in the Grand Jury needs to change.
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

export function hearingLines(detail: CaseDetail): readonly CourtLine[] {
  return detail.sentence ? [...detail.transcript, detail.sentence] : detail.transcript;
}

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

  const onDone = useCallback(() => setTyped(true), []);

  if (!line) return null;
  const character = SPEAKER_CHARACTER[line.speaker];
  const impact = line.beat ? IMPACT[line.beat] : undefined;
  const side = line.bench === 0 ? 'for' : line.bench === 1 ? 'against' : 'court';

  return (
    <OrnateFrame as="section" tone="wood" padding="md" className={styles.trialView} aria-label="The hearing" data-side={side}>
      <div className={styles.trialSky} aria-hidden />
      <div className={styles.trialStage}>
        {impact && !reduced && (
          <ImpactText key={line.id} kind={impact} size="md" animate className={styles.trialImpact} />
        )}
        <DialogueBox key={line.id} speaker={character} expression={line.beat ? (EXPRESSION[line.beat] ?? 'neutral') : 'neutral'} text={line.text} onDone={onDone} className={styles.trialDialogue} />
      </div>
      <div className={styles.trialControls}>
        <RoundIconButton label="Previous line" icon="arrow-left" onClick={() => go(index - 1)} disabled={index === 0} />
        <RoundIconButton
          label={autoplay ? 'Pause the hearing' : 'Play the hearing'}
          icon={autoplay ? 'close' : 'gavel'}
          tone="royal"
          pressed={autoplay}
          onClick={() => {
            if (last && !autoplay) go(0);
            setAutoplay((a) => !a);
          }}
        />
        <RoundIconButton label="Next line" icon="arrow-right" onClick={() => go(index + 1)} disabled={last} />
        <p className={styles.trialCounter} aria-live="polite">
          Line {index + 1} of {lines.length}
          {detail.transcriptTeaser && ' · teaser'}
        </p>
      </div>
    </OrnateFrame>
  );
}
