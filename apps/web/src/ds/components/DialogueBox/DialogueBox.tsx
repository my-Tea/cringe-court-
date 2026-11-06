import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import type { CharacterId, Expression } from '../../../art/art';
import { CHARACTERS } from '../../../art/art';
import { useReducedMotion } from '../../motion/MotionProvider';
import { cx } from '../../lib/cx';
import { Button } from '../Button/Button';
import { Portrait } from '../Portrait/Portrait';
import styles from './DialogueBox.module.css';

export interface DialogueBoxProps {
  speaker: CharacterId;
  expression?: Expression;
  /** Override the plate name (e.g. a Versus nickname). */
  speakerName?: string;
  text: string;
  /** Characters per second for the typewriter. */
  speed?: number;
  /** Called once the full line is shown (typed out or skipped). */
  onDone?: () => void;
  className?: string;
}

/**
 * Typewriter dialogue (V4 §5). Screen readers get the whole line at once, never
 * the letter-by-letter animation; reduced motion shows it instantly.
 */
export function DialogueBox({ speaker, expression = 'neutral', speakerName, text, speed = 45, onDone, className }: DialogueBoxProps) {
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState({ text, count: reduced ? text.length : 0 });
  // A new line restarts the typewriter (state reset during render, not in an effect).
  if (typed.text !== text) setTyped({ text, count: reduced ? text.length : 0 });
  const shown = reduced ? text.length : typed.count;
  const done = shown >= text.length;

  useEffect(() => {
    if (done) {
      onDone?.();
      return;
    }
    const id = window.setTimeout(() => setTyped((t) => ({ ...t, count: t.count + 1 })), 1000 / speed);
    return () => window.clearTimeout(id);
  }, [done, shown, speed, onDone]);

  const name = speakerName ?? CHARACTERS[speaker];
  return (
    <figure className={cx(styles.box, className)} data-surface="parchment">
      <figcaption className={styles.speaker}>{name}</figcaption>
      <Portrait character={speaker} expression={expression} size="lg" ring="highlight" alt="" />
      <blockquote className={styles.text}>
        <span className="cc-visually-hidden">{text}</span>
        <span aria-hidden>
          {text.slice(0, shown)}
          {!done && <span className={styles.caret} />}
        </span>
      </blockquote>
      {!done && (
        <Button size="sm" variant="ghost" className={styles.skip} onClick={() => setTyped({ text, count: text.length })}>
          {t('ds.dialogue.skip')}
        </Button>
      )}
    </figure>
  );
}
