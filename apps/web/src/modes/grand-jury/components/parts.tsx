import { formatUsdc, type Usdc } from '@cringe-court/core';
import { STATUS_LABELS, type DocketEntry, type DocketStatus } from '@cringe-court/modes-grand-jury';
import type { ReactNode } from 'react';
import { Badge, Icon, PaperPanel, Portrait, cx, type IconName, type PaperEdge, type PaperTone } from '@/ds';
import { STATUS_TONE } from '../lib';
import styles from '../GrandJury.module.css';

/**
 * Every Grand Jury panel: a sheet of card with an eyebrow, a heading and a body.
 * `tone="maroon"` is the velvet card for the moment that matters (the verdict,
 * the ballot); `cream` is the default; `kraft` is quiet background material.
 */
export function CourtPanel({
  id,
  eyebrow,
  title,
  icon,
  action,
  tone = 'cream',
  edge = 'cut',
  elevation = 2,
  backing = 'none',
  unfold,
  className,
  children,
  ...rest
}: {
  id: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  icon?: IconName;
  /** Right of the heading (a small button). */
  action?: ReactNode;
  tone?: PaperTone;
  edge?: PaperEdge;
  elevation?: 0 | 1 | 2 | 3 | 4;
  backing?: 'none' | 'gold' | 'maroon' | 'cream';
  unfold?: boolean;
  className?: string;
  children: ReactNode;
  'data-outcome'?: string;
}) {
  return (
    <PaperPanel as="section" tone={tone} edge={edge} elevation={elevation} backing={backing} unfold={unfold} padding="md" aria-labelledby={id} className={cx(styles.panel, className)} {...rest}>
      <header className={styles.panelHead}>
        <div className={styles.panelHeadText}>
          {eyebrow && <p className={styles.panelEyebrow}>{eyebrow}</p>}
          <h2 id={id} className={styles.panelTitle}>
            {icon && <Icon name={icon} className={styles.panelTitleIcon} />}
            {title}
          </h2>
        </div>
        {action}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </PaperPanel>
  );
}

export function StatusBadge({ status, className }: { status: DocketStatus; className?: string }) {
  const s = STATUS_TONE[status];
  return (
    <Badge tone={s.tone} dot={s.dot} className={className}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

/** Crowdfund progress toward the frozen target (D9). */
export function FundingMeter({ raised, target, summoners, compact }: { raised: Usdc; target: Usdc; summoners: number; compact?: boolean }) {
  const pct = target > 0n ? Math.min(100, Math.round((Number(raised) / Number(target)) * 100)) : 0;
  const text = `${formatUsdc(raised)} of ${formatUsdc(target)} raised by ${summoners} ${summoners === 1 ? 'summoner' : 'summoners'}`;
  return (
    <div className={cx(styles.meter, compact && styles.meterCompact)}>
      <div className={styles.meterTop}>
        <span className={styles.meterRaised}>{formatUsdc(raised, { unit: false })}</span>
        <span className={styles.meterTarget}>/ {formatUsdc(target)}</span>
        <span className={styles.meterPct}>{pct}%</span>
      </div>
      <div className={styles.meterTrack} role="progressbar" aria-label="Crowdfunding" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={text}>
        <div className={styles.meterFill} style={{ ['--_pct' as string]: `${pct}%` }} />
      </div>
      {!compact && (
        <p className={styles.meterNote}>
          <Icon name="user" /> {summoners} {summoners === 1 ? 'summoner' : 'summoners'} so far
        </p>
      )}
    </div>
  );
}

type SeatState = 'empty' | 'sworn' | 'sealed' | 'opened' | 'absent';

/** The seven chairs. Never shows how anyone voted before the verdict. */
export function JuryBox({ entry, viewerSeat, compact }: { entry: Pick<DocketEntry, 'seats' | 'status' | 'phase'>; viewerSeat?: number | null; compact?: boolean }) {
  const { filled, total, sealed, opened } = entry.seats;
  const closed = entry.status === 'verdict' || entry.status === 'mistrial' || entry.status === 'settle-ready';
  const seats: SeatState[] = Array.from({ length: total }, (_, i) => {
    if (i >= filled) return 'empty';
    if (entry.phase === 'reveal' || closed) return i < opened ? 'opened' : closed ? 'absent' : 'sealed';
    if (entry.phase === 'commit') return i < sealed ? 'sealed' : 'sworn';
    return 'sworn';
  });
  const label: Record<SeatState, string> = { empty: 'open seat', sworn: 'sworn in', sealed: 'ballot sealed', opened: 'scroll opened', absent: 'did not reveal' };
  const summary =
    entry.phase === 'commit'
      ? `${sealed} of ${total} ballots sealed`
      : entry.phase === 'reveal' || closed
        ? `${opened} of ${total} scrolls opened`
        : `${filled} of ${total} jurors sworn in`;
  return (
    <figure className={cx(styles.juryBox, compact && styles.juryBoxCompact)}>
      <ol className={styles.seats} aria-label="Jury seats">
        {seats.map((s, i) => (
          <li key={i} className={styles.seat} data-state={s} data-you={viewerSeat === i + 1 || undefined}>
            <span className={styles.chair} aria-hidden>
              {s === 'empty' ? <Icon name="plus" /> : s === 'opened' ? <Icon name="document" /> : s === 'sealed' ? <Icon name="lock" /> : s === 'absent' ? <Icon name="close" /> : <Icon name="user" />}
            </span>
            <span className="cc-visually-hidden">
              Seat {i + 1}: {label[s]}
              {viewerSeat === i + 1 ? ' (you)' : ''}
            </span>
          </li>
        ))}
      </ol>
      <figcaption className={styles.juryCaption}>{summary}</figcaption>
    </figure>
  );
}

/** A ballot title, coloured by bench: FOR = maroon, AGAINST = teal. */
export function BallotChip({ bench, children, size = 'md' }: { bench: 0 | 1; children: string; size?: 'sm' | 'md' }) {
  return (
    <span className={styles.ballotChip} data-bench={bench} data-size={size}>
      {children}
    </span>
  );
}

/** The two public positions with their AI counsel. */
export function Benches({ entry }: { entry: Pick<DocketEntry, 'file' | 'ballot'> }) {
  const counsel = [
    { character: 'prosecutor' as const, name: 'Miss Ratio' },
    { character: 'defense' as const, name: 'Counsel Chaos' },
  ];
  return (
    <div className={styles.benches}>
      {([0, 1] as const).map((b) => (
        <section key={b} className={styles.bench} data-bench={b} aria-labelledby={`bench-${b}`}>
          <Portrait character={counsel[b]!.character} size="md" ring={b === 0 ? 'accent' : 'side-a'} alt="" />
          <div className={styles.benchText}>
            <p className={styles.benchWho}>
              {counsel[b]!.name} argues {b === 0 ? 'for' : 'against'}
            </p>
            <h3 id={`bench-${b}`} className={styles.benchTitle}>
              {entry.ballot[b]}
            </h3>
            <p className={styles.benchSummary}>{entry.file.positions[b].summary}</p>
          </div>
        </section>
      ))}
    </div>
  );
}
