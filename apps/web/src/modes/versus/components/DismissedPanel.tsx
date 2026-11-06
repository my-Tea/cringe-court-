import { ZERO_USDC, addUsdc } from '@cringe-court/core';
import { cancelLabel, formatAmount } from '@/i18n/domain';
import { claimable, type VersusCase, type Viewer } from '@cringe-court/modes-versus';
import { t, type MessageKey } from '@/i18n';
import { Icon, PaperButtonLink, Stamp } from '@/ds';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { ClaimCard } from './VerdictPanel';
import { PaperSection } from './PaperSection';

const WHY: Partial<Record<string, MessageKey>> = {
  'consent-missed': 'versus.dismissed.why.consent-missed',
  'consent-declined': 'versus.dismissed.why.consent-declined',
  withdrawn: 'versus.dismissed.why.withdrawn',
  'funding-missed': 'versus.dismissed.why.funding-missed',
  'jury-unfilled': 'versus.dismissed.why.jury-unfilled',
  'ai-unfair': 'versus.dismissed.why.ai-unfair',
  'ai-failed': 'versus.dismissed.why.ai-failed',
  protective: 'versus.dismissed.why.protective',
};

/** Dismissed: why, and the refund (if anyone paid) to claim. */
export function DismissedPanel({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  const { persona } = useVersus();
  const s = c.state;
  if (s.stage !== 'closed') return null;
  const refunds = s.settlement?.statements.filter((st) => st.party !== 'protocol' && st.party !== 'platform') ?? [];
  const total = addUsdc(ZERO_USDC, ...refunds.map((r) => r.payout));
  const pendingLapse = s.settlement === null && s.cancelledFrom === 'counsel' && s.transcript !== null && c.chain?.phase === 'pre-trial';
  const mine = claimable(c, persona.account);
  return (
    <div className={styles.stack}>
      <PaperSection as="section" padding="lg" aria-labelledby="dismissed-title" bodyClassName={styles.dismissed}>
        <Stamp tone="no-verdict" size="lg" animate sub={total > 0n ? t('versus.dismissed.fullRefunds') : t('versus.dismissed.nothingCharged')}>
          {t('versus.dismissed.stamp')}
        </Stamp>
        <h2 id="dismissed-title" className={styles.panelTitle}>
          {cancelLabel(s.reason)}
        </h2>
        <p className={styles.muted}>{t(WHY[s.reason] ?? 'versus.dismissed.why.default')}</p>
        {total > 0n && (
          <p className={styles.claimLine}>
            <Icon name="sparkle" aria-hidden /> {t('versus.dismissed.refunds', { amount: formatAmount(total), count: refunds.length })}
            {viewer !== 'spectator' && mine === 0n && ` ${t('versus.dismissed.yoursClaimed')}`}
          </p>
        )}
        {pendingLapse && (
          <p className={styles.claimLine}>
            <Icon name="clock" aria-hidden /> {t('versus.dismissed.escrow')}
          </p>
        )}
        <div className={styles.inlineActions}>
          <PaperButtonLink to={versusPaths.newCase}>{t('versus.dismissed.newCase')}</PaperButtonLink>
          <PaperButtonLink to={versusPaths.cases} variant="ghost">
            {t('versus.dismissed.myCases')}
          </PaperButtonLink>
        </div>
      </PaperSection>
      <ClaimCard c={c} caseNumber={s.caseNumber} />
    </div>
  );
}
