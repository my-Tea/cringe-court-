import type { DocketEntry } from '@cringe-court/modes-grand-jury';
import { Link } from 'react-router';
import { t } from '@/i18n';
import { Countdown, Icon, PaperPanel, Stamp, cx } from '@/ds';
import { categoryLabel, deadlineLabel, isClosed, paths } from '../lib';
import styles from '../GrandJury.module.css';
import { BallotChip, FundingMeter, JuryBox, StatusBadge } from './parts';

/** One case on the docket. The whole card is the link; inner content stays plain text. */
export function CaseCard({ entry, nowMs }: { entry: DocketEntry; nowMs: number }) {
  const e = entry;
  const closed = isClosed(e.status);
  const titleId = `case-${e.caseNumber}-title`;
  return (
    <PaperPanel
      as="article"
      tone={closed ? 'kraft' : 'cream'}
      edge="cut"
      elevation={closed ? 1 : 2}
      backing={e.sponsor ? 'gold' : 'none'}
      padding="md"
      className={cx(styles.caseCard, closed && styles.caseCardClosed)}
      data-status={e.status}
      aria-labelledby={titleId}
    >
      <header className={styles.caseCardHead}>
        <span className={styles.caseLabel}>{e.label}</span>
        <StatusBadge status={e.status} />
      </header>
      <p className={styles.caseCardEyebrow}>
        {e.file.title} · {categoryLabel(e.file.category)}
      </p>
      <h3 id={titleId} className={styles.caseCardQuestion}>
        <Link to={paths.case(e.caseNumber)} className={styles.stretchedLink}>
          {e.file.question}
        </Link>
      </h3>
      <p className={styles.caseCardHook}>{e.file.hook}</p>
      <div className={styles.caseCardBallot} aria-label={t('grandJury.card.ballotLabel')}>
        <BallotChip bench={0} size="sm">
          {e.ballot[0]}
        </BallotChip>
        <span className={styles.vs} aria-hidden>
          {t('grandJury.card.vs')}
        </span>
        <BallotChip bench={1} size="sm">
          {e.ballot[1]}
        </BallotChip>
      </div>

      <div className={styles.caseCardBody}>
        {e.status === 'summoning' && <FundingMeter raised={e.raised} target={e.target} summoners={e.summoners} compact />}
        {(e.status === 'seating' || e.status === 'in-session' || e.status === 'opening-scrolls' || e.status === 'settle-ready') && <JuryBox entry={e} compact />}
        {e.status === 'verdict' && e.verdict && (
          <div className={styles.caseCardVerdict}>
            <Stamp tone={e.verdict.kind === 'ballot-0' ? 'guilty' : 'side-a'} size="sm">
              {e.verdict.label}
            </Stamp>
            <span className={styles.tallyText}>
              {t('grandJury.card.tally', { a: e.verdict.tally[0], b: e.verdict.tally[1], total: e.verdict.appointed })}
            </span>
          </div>
        )}
        {e.status === 'mistrial' && (
          <div className={styles.caseCardVerdict}>
            <Stamp tone="no-verdict" size="sm">
              {t('grandJury.card.noVerdict')}
            </Stamp>
            <span className={styles.tallyText}>{t('grandJury.card.refunded')}</span>
          </div>
        )}
        {e.status === 'cancelled' && <p className={styles.caseCardNote}>{t('grandJury.card.dismissed')}</p>}
      </div>

      <footer className={styles.caseCardFoot}>
        {e.phaseEndsAt !== null && e.phaseStartedAt !== null ? (
          <Countdown compact label={deadlineLabel(e)} startsAt={e.phaseStartedAt * 1000} endsAt={e.phaseEndsAt * 1000} now={nowMs} />
        ) : (
          <span className={styles.caseCardFootNote}>
            {e.gallery.tally ? t('grandJury.card.gallery', { count: e.gallery.total }) : e.status === 'settle-ready' ? t('grandJury.card.settleNow') : ' '}
          </span>
        )}
        {e.sponsor && (
          <span className={styles.presentedBy}>
            <Icon name="star" /> {t('grandJury.card.presentedBy', { name: e.sponsor.name })}
          </span>
        )}
      </footer>
    </PaperPanel>
  );
}
