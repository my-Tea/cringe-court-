import { CHARACTER_NAMES, SPEAKER_CHARACTER, type CourtLine, type Segment } from '@cringe-court/core';
import type { CaseDetail, LogEntry } from '@cringe-court/modes-grand-jury';
import { useEffect, useRef, useState } from 'react';
import { Button, Icon, Portrait, cx, useMotion } from '@/ds';
import { t, tRich, type MessageKey } from '@/i18n';
import { ago, hearingLines, portraitOf } from '../lib';
import styles from '../GrandJury.module.css';
import { CourtPanel } from './parts';

const SEGMENT_LABEL: Record<Segment, MessageKey> = {
  'call-to-order': 'grandJury.feed.segment.callToOrder',
  opening: 'grandJury.feed.segment.opening',
  exhibit: 'grandJury.feed.segment.exhibit',
  rebuttal: 'grandJury.feed.segment.rebuttal',
  closing: 'grandJury.feed.segment.closing',
  'jury-out': 'grandJury.feed.segment.juryOut',
  sentence: 'grandJury.feed.segment.sentence',
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
          {position && <span className={styles.linePosition}>{t('grandJury.feed.for', { position })}</span>}
          <span className={styles.lineSegment}>{t(SEGMENT_LABEL[line.segment])}</span>
        </p>
        <p className={styles.lineText}>{line.text}</p>
        {exhibit && (
          <p className={styles.exhibit}>
            <Icon name="document" /> {t('grandJury.feed.exhibit', { id: exhibit.id, label: exhibit.label })}
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
      eyebrow={detail.transcriptTeaser ? t('grandJury.feed.eyebrow.teaser') : t('grandJury.feed.eyebrow.full')}
      title={t('grandJury.feed.title')}
      icon="megaphone"
      action={
        !reduced &&
        lines.length > 1 && (
          <Button size="sm" variant="ghost" iconStart={<Icon name={playing ? 'close' : 'refresh'} />} onClick={() => setShown(playing ? lines.length : 1)}>
            {playing ? t('grandJury.feed.showAll') : t('grandJury.feed.replay')}
          </Button>
        )
      }
    >
        <ol ref={listRef} className={styles.feed} aria-live={playing ? 'polite' : 'off'} aria-label={t('grandJury.feed.transcriptLabel')}>
          {lines.slice(0, shown).map((l) => (
            <Line key={l.id} line={l} detail={detail} />
          ))}
        </ol>
        {detail.transcriptTeaser && (
          <div className={styles.locked}>
            <Icon name="lock" />
            <div>
              <p className={styles.lockedTitle}>{detail.status === 'cancelled' ? t('grandJury.feed.locked.cancelled') : t('grandJury.feed.locked.title')}</p>
              <p className={styles.lockedNote}>{t('grandJury.feed.locked.note')}</p>
            </div>
          </div>
        )}
        <p className={styles.provenance}>
          <Icon name="info" />{' '}
          {tRich(
            'grandJury.feed.provenance',
            {
              hash: (chunk) => (
                <code className={styles.hash} title={detail.transcriptHash}>
                  {chunk}
                </code>
              ),
            },
            {
              provider: detail.provider === 'fixture' ? t('grandJury.feed.provider.fixture') : t('grandJury.feed.provider.live'),
              hash: `${detail.transcriptHash.slice(0, 10)}…${detail.transcriptHash.slice(-6)}`,
            },
          )}
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
    <CourtPanel id="record-title" tone="kraft" elevation={1} eyebrow={t('grandJury.record.eyebrow')} title={t('grandJury.record.title')}>
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
            {all ? t('grandJury.record.showRecent') : t('grandJury.record.showAll', { count: items.length })}
          </Button>
        )}
    </CourtPanel>
  );
}
