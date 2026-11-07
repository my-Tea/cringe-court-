/**
 * Scrolls open one by one — same vote reel Solo live uses, fed by each mode's
 * real seats / case tally (not a sandbox walk script).
 */
import { useEffect, useState } from 'react';
import { Stamp, useReducedMotion } from '@/ds';
import { t } from '@/i18n';
import styles from './Hearing.module.css';

/** How long before the next juror opens their scroll. */
export const VOTE_SEAL_MS = 1400;
/** Pause after the last vote before handing off. */
export const VOTE_HOLD_MS = 900;

export interface VoteScroll {
  seat: number;
  name: string;
  /** 0 / 1 once opened; null = absent (never revealed). */
  choice: 0 | 1 | null;
  line?: string;
}

export interface VoteRevealProps {
  votes: readonly VoteScroll[];
  ballot: readonly [string, string];
  onDone: () => void;
  title?: string;
  body?: string;
  /** Optional stamp after the reel (case already decided). */
  outcomeLabel?: string | null;
}

function tallyOf(votes: readonly VoteScroll[]): readonly [number, number] {
  let a = 0;
  let b = 0;
  for (const v of votes) {
    if (v.choice === 0) a += 1;
    else if (v.choice === 1) b += 1;
  }
  return [a, b];
}

/** Multiplayer-looking vote reel: scrolls seal one by one, tally updates live. */
export function VoteReveal({ votes, ballot, onDone, title, body, outcomeLabel }: VoteRevealProps) {
  const reduced = useReducedMotion();
  const [opened, setOpened] = useState(reduced ? votes.length : 0);
  const revealed = votes.slice(0, opened);
  const tally = tallyOf(revealed);

  useEffect(() => {
    if (reduced || opened >= votes.length) {
      const id = window.setTimeout(onDone, VOTE_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setOpened((n) => n + 1), VOTE_SEAL_MS);
    return () => window.clearTimeout(id);
  }, [reduced, opened, votes.length, onDone]);

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{title ?? t('trial.vote.title')}</h1>
      <p className={styles.lede}>{body ?? t('trial.vote.body', { jurors: votes.length })}</p>
      <div className={styles.tallyBoard} role="status" aria-live="polite">
        <span>
          {ballot[0]} <strong>{tally[0]}</strong>
        </span>
        <span aria-hidden>·</span>
        <span>
          {ballot[1]} <strong>{tally[1]}</strong>
        </span>
        <span className={styles.hint}>{t('trial.vote.progress', { sealed: opened, jurors: votes.length })}</span>
      </div>
      <ul className={styles.voteList} aria-label={t('trial.vote.list')}>
        {votes.map((v, i) => {
          const open = i < opened;
          const label = v.choice === null ? t('trial.vote.absent') : ballot[v.choice];
          return (
            <li key={v.seat} className={open ? styles.voteOpen : styles.voteSealed} data-choice={open && v.choice !== null ? v.choice : undefined}>
              <strong>{v.name}</strong>
              <span>{open ? (v.line ? `“${v.line}”` : label) : t('trial.vote.sealed')}</span>
              <em>{open ? label : '…'}</em>
            </li>
          );
        })}
      </ul>
      {opened >= votes.length ? (
        outcomeLabel ? (
          <Stamp tone="filed" size="lg" animate>
            {outcomeLabel}
          </Stamp>
        ) : (
          <p role="status">{t('trial.vote.done')}</p>
        )
      ) : null}
    </div>
  );
}
