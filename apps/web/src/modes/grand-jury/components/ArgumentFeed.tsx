import { CHARACTER_NAMES, SPEAKER_CHARACTER, type CourtLine, type Segment } from '@cringe-court/core';
import type { CaseDetail, LogEntry } from '@cringe-court/modes-grand-jury';
import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Portrait, cx, useMotion } from '@/ds';
import { ago, hearingLines, portraitOf } from '../lib';
import styles from '../GrandJury.module.css';
import { CourtPanel } from './parts';

const SEGMENT_LABEL: Record<Segment, string> = {
  'call-to-order': 'Call to order',
  opening: 'Opening',
  exhibit: 'Exhibit',
  rebuttal: 'Rebuttal',
  closing: 'Closing',
  'jury-out': 'The jury is out',
  sentence: 'Sentence',
};

const EXPRESSION: Partial<Record<NonNullable<CourtLine['beat']>, 'smug' | 'shocked' | 'defeated'>> = {
  smug: 'smug',
  objection: 'shocked',
  gasp: 'shocked',
  cry: 'defeated',
  sweat: 'defeated',
  'desk-slam': 'shocked',
};

function Line({ line, detail }: { line: CourtLine; detail: CaseDetail }) {
  const character = portraitOf(SPEAKER_CHARACTER[line.speaker]);
  const exhibit = line.exhibitId ? detail.file.sources.find((s) => s.id === line.exhibitId) : undefined;
  const position = line.bench !== undefined ? detail.ballot[line.bench] : null;
  return (
    <li className={styles.line} data-bench={line.bench ?? 'court'}>
      <Portrait character={character} expression={line.beat ? (EXPRESSION[line.beat] ?? 'neutral') : 'neutral'} size="sm" ring={line.bench === 0 ? 'accent' : line.bench === 1 ? 'side-a' : 'highlight'} alt="" />
      <div className={styles.bubble}>
        <p className={styles.lineMeta}>
          <span className={styles.lineSpeaker}>{CHARACTER_NAMES[SPEAKER_CHARACTER[line.speaker]]}</span>
          {position && <span className={styles.linePosition}>for {position}</span>}
          <span className={styles.lineSegment}>{SEGMENT_LABEL[line.segment]}</span>
        </p>
        <p className={styles.lineText}>{line.text}</p>
        {exhibit && (
          <p className={styles.exhibit}>
            <Icon name="document" /> Exhibit {exhibit.id}: {exhibit.label}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * The argument feed: the frozen AI transcript, played as a hearing. Before the
 * jury is seated only the D3 teaser is public. "Play the hearing" reveals one
 * line at a time; reduced motion shows everything at once.
 */
export function ArgumentFeed({ detail }: { detail: CaseDetail }) {
  const { reduced } = useMotion();
  const lines = hearingLines(detail);
  const [shown, setShown] = useState(lines.length);
  const playing = shown < lines.length;
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setShown((s) => s + 1), 1800);
    return () => window.clearTimeout(id);
  }, [playing, shown]);

  useEffect(() => {
    if (playing) listRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
  }, [shown, playing, reduced]);

  return (
    <CourtPanel
      id="feed-title"
      tone="cream"
      edge="torn"
      className={styles.feedCard}
      eyebrow={detail.transcriptTeaser ? 'Free teaser' : 'Full transcript'}
      title="The arguments"
      icon="megaphone"
      action={
        !reduced &&
        lines.length > 1 && (
          <Button size="sm" variant="ghost" iconStart={<Icon name={playing ? 'close' : 'refresh'} />} onClick={() => setShown(playing ? lines.length : 1)}>
            {playing ? 'Show all' : 'Replay as a feed'}
          </Button>
        )
      }
    >
        <ol ref={listRef} className={styles.feed} aria-live={playing ? 'polite' : 'off'} aria-label="Transcript">
          {lines.slice(0, shown).map((l) => (
            <Line key={l.id} line={l} detail={detail} />
          ))}
        </ol>
        {detail.transcriptTeaser && (
          <div className={styles.locked}>
            <Icon name="lock" />
            <div>
              <p className={styles.lockedTitle}>{detail.status === 'cancelled' ? 'The full hearing never ran.' : 'Exhibits, rebuttals and closings unlock when all seven jurors are sworn in.'}</p>
              <p className={styles.lockedNote}>The whole transcript is already written and frozen, so nobody can tweak it after seeing the money.</p>
            </div>
          </div>
        )}
        <p className={styles.provenance}>
          <Icon name="info" /> Drafted by {detail.provider === 'fixture' ? 'the demo fixture counsel (0G Compute in production)' : '0G Compute'}, same model and budget for both sides. Fingerprint{' '}
          <code className={styles.hash} title={detail.transcriptHash}>
            {detail.transcriptHash.slice(0, 10)}…{detail.transcriptHash.slice(-6)}
          </code>{' '}
          recorded on the ledger before any vote.
        </p>
    </CourtPanel>
  );
}

const LOG_ICON: Record<LogEntry['kind'], 'document' | 'star' | 'gavel' | 'user' | 'lock' | 'unlock' | 'scales' | 'alert' | 'sparkle' | 'check'> = {
  published: 'document',
  sponsored: 'star',
  summoned: 'sparkle',
  funded: 'check',
  seated: 'user',
  'in-session': 'gavel',
  sealed: 'lock',
  'scrolls-open': 'unlock',
  opened: 'document',
  'settle-ready': 'scales',
  verdict: 'gavel',
  cancelled: 'alert',
};

/** The public court record, newest first. Never shows who voted what. */
export function CourtRecord({ log, now, limit = 12 }: { log: readonly LogEntry[]; now: number; limit?: number }) {
  const [all, setAll] = useState(false);
  const items = [...log].reverse();
  const visible = all ? items : items.slice(0, limit);
  return (
    <CourtPanel id="record-title" tone="kraft" elevation={1} eyebrow="Public, on the ledger" title="Court record">
        <ol className={styles.record}>
          {visible.map((l) => (
            <li key={l.id} className={cx(styles.recordItem)} data-kind={l.kind}>
              <span className={styles.recordIcon} aria-hidden>
                <Icon name={LOG_ICON[l.kind]} />
              </span>
              <span className={styles.recordText}>{l.text}</span>
              <time className={styles.recordTime} dateTime={new Date(l.at * 1000).toISOString()}>
                {ago(now - l.at)}
              </time>
            </li>
          ))}
        </ol>
        {items.length > limit && (
          <Button size="sm" variant="ghost" onClick={() => setAll((a) => !a)}>
            {all ? 'Show recent only' : `Show all ${items.length} entries`}
          </Button>
        )}
    </CourtPanel>
  );
}
