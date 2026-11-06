import { CANCEL_LABELS, ZERO_USDC, addUsdc, formatUsdc } from '@cringe-court/core';
import { claimable, type VersusCase, type Viewer } from '@cringe-court/modes-versus';
import { Icon, PaperButtonLink, Stamp } from '@/ds';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { ClaimCard } from './VerdictPanel';
import { PaperSection } from './PaperSection';

const WHY: Partial<Record<string, string>> = {
  'consent-missed': 'Invites expire with the consent window. Side A paid nothing; the platform absorbed the AI intake (D6).',
  'consent-declined': 'Side B said no. The case closed privately and nothing was ever charged.',
  withdrawn: 'A side withdrew consent before funding closed. That is always allowed.',
  'funding-missed': 'Both halves have to arrive before the funding window closes. Whoever paid gets every cent back.',
  'jury-unfilled': 'Not enough verified jurors took a seat in time. Both sides and every seated juror are refunded in full.',
  'ai-unfair': 'The balance check failed twice, so the court refused to put a lopsided case in front of a jury (D1).',
  'ai-failed': 'The AI counsel could not prepare the case. Nothing was charged.',
  protective: 'The court cancelled for its own reasons. Everyone is refunded, and jurors who did their part get a stipend.',
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
        <Stamp tone="no-verdict" size="lg" animate sub={total > 0n ? 'Full refunds' : 'Nothing charged'}>
          Case dismissed
        </Stamp>
        <h2 id="dismissed-title" className={styles.panelTitle}>
          {CANCEL_LABELS[s.reason]}
        </h2>
        <p className={styles.muted}>{WHY[s.reason] ?? 'The case closed before a verdict.'}</p>
        {total > 0n && (
          <p className={styles.claimLine}>
            <Icon name="sparkle" aria-hidden /> {formatUsdc(total)} in refunds and returned bonds {refunds.length === 1 ? 'is' : 'are'} on the ledger to claim.
            {viewer !== 'spectator' && mine === 0n && ' Yours is already claimed, or you had nothing in.'}
          </p>
        )}
        {pendingLapse && (
          <p className={styles.claimLine}>
            <Icon name="clock" aria-hidden /> A payment is in escrow. It becomes claimable in full the moment the funding window closes (the contract releases it, not the app).
          </p>
        )}
        <div className={styles.inlineActions}>
          <PaperButtonLink to={versusPaths.newCase}>Start a new case</PaperButtonLink>
          <PaperButtonLink to={versusPaths.cases} variant="ghost">
            My cases
          </PaperButtonLink>
        </div>
      </PaperSection>
      <ClaimCard c={c} caseNumber={s.caseNumber} />
    </div>
  );
}
