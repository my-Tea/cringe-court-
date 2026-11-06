import { type Usdc } from '@cringe-court/core';
import { ballotLabel, caseLabel, formatAmount, verdictLabel } from '@/i18n/domain';
import type { CaseDetail, Disclosure } from '@cringe-court/modes-grand-jury';
import { Amount, Icon, Stamp } from '@/ds';
import { t } from '@/i18n';
import styles from '../GrandJury.module.css';
import { CourtPanel } from './parts';

/** Seven pips, coloured by the revealed side; grey for jurors who never revealed. */
function TallyPips({ tally, appointed, ballot }: { tally: readonly [number, number]; appointed: number; ballot: readonly [string, string] }) {
  const pips = Array.from({ length: appointed }, (_, i) => (i < tally[0] ? 0 : i < tally[0] + tally[1] ? 1 : null));
  const absent = appointed - tally[0] - tally[1];
  return (
    <figure className={styles.tally}>
      <ol className={styles.pips} aria-hidden>
        {pips.map((p, i) => (
          <li key={i} className={styles.pip} data-bench={p ?? 'none'} style={{ ['--_i' as string]: i }} />
        ))}
      </ol>
      <figcaption className={styles.tallyLegend}>
        <span data-bench={0}>
          {ballotLabel(ballot[0])} <strong>{tally[0]}</strong>
        </span>
        <span data-bench={1}>
          {ballotLabel(ballot[1])} <strong>{tally[1]}</strong>
        </span>
        {absent > 0 && (
          <span data-bench="none">
            {t('grandJury.verdict.absent')} <strong>{absent}</strong>
          </span>
        )}
      </figcaption>
    </figure>
  );
}

const row = (label: string, value: Usdc, note?: string) => ({ label, value, note });

/** D13: where every unit of the case's money went, from the same settle() the ledger pays with. */
export function DisclosureList({ d }: { d: Disclosure }) {
  const rows = [
    row(t('grandJury.disclosure.totalIn'), d.totalIn),
    row(t('grandJury.disclosure.paidToJurors'), d.paidToJurors),
    row(t('grandJury.disclosure.refunded'), d.refundedToFunders),
    row(t('grandJury.disclosure.fees'), d.fees, d.outcome === 'verdict' ? t('grandJury.disclosure.feesNote') : undefined),
    row(t('grandJury.disclosure.forfeits'), d.forfeits, t('grandJury.disclosure.forfeitsNote')),
    row(t('grandJury.disclosure.unearned'), d.unearnedBonus),
    row(t('grandJury.disclosure.sponsorFee'), d.sponsorFee),
  ];
  return (
    <dl className={styles.disclosure}>
      {rows.map((r) => (
        <div key={r.label}>
          <dt>
            {r.label}
            {r.note && <span className={styles.disclosureNote}>{r.note}</span>}
          </dt>
          <dd>
            <Amount value={r.value} size="sm" />
          </dd>
        </div>
      ))}
      <div>
        <dt>{t('grandJury.disclosure.completed')}</dt>
        <dd className={styles.disclosureCount}>{t('grandJury.disclosure.completedCount', { completed: d.completed, appointed: d.appointed })}</dd>
      </div>
    </dl>
  );
}

/**
 * The verdict, read out: a stamp, the revealed tally, the judge's sentence and
 * the D13 money disclosure. The verdict stinger plays from CaseSounds.
 */
export function VerdictPanel({ detail }: { detail: CaseDetail }) {
  const v = detail.verdict;

  if (detail.status === 'cancelled') {
    return (
      <CourtPanel
        id="verdict-title"
        tone="cream"
        className={styles.verdictCard}
        data-outcome="cancelled"
        eyebrow={t('grandJury.verdict.cancelled.eyebrow')}
        title={t('grandJury.verdict.cancelled.title')}
      >
        <div className={styles.verdictStamp} style={{ ['--_len' as string]: 14 }}>
          <Stamp tone="no-verdict" size="lg" animate sub={t('grandJury.verdict.cancelled.sub')}>
            {t('grandJury.verdict.cancelled.stamp')}
          </Stamp>
        </div>
        <p className={styles.panelLede}>{t('grandJury.verdict.cancelled.lede')}</p>
        {detail.disclosure && (
          <details className={styles.breakdown}>
            <summary>{t('grandJury.verdict.moneySummary')}</summary>
            <DisclosureList d={detail.disclosure} />
          </details>
        )}
      </CourtPanel>
    );
  }
  if (!v) return null;
  const won = v.kind === 'ballot-0' ? 0 : v.kind === 'ballot-1' ? 1 : null;
  const winners = won === null ? 0 : v.tally[won];

  return (
    <CourtPanel
      id="verdict-title"
      tone="maroon"
      backing="gold"
      elevation={3}
      unfold
      className={styles.verdictCard}
      data-outcome={won === null ? 'none' : `bench-${won}`}
      eyebrow={t('grandJury.verdict.eyebrow', { label: caseLabel(detail.label) })}
      title={won === null ? t('grandJury.verdict.none') : t('grandJury.verdict.agreed', { winners, total: v.appointed })}
      icon="gavel"
    >
      <div className={styles.verdictStamp} style={{ ['--_len' as string]: won === null ? 10 : v.label.length }}>
        <Stamp
          tone={won === 0 ? 'guilty' : won === 1 ? 'side-a' : 'no-verdict'}
          size="lg"
          animate
          sub={
            won === null ? t('grandJury.verdict.needed', { threshold: detail.terms.threshold, total: v.appointed }) : t('grandJury.verdict.range', { a: v.tally[0], b: v.tally[1] })
          }
        >
          {won === null ? t('grandJury.verdict.none') : verdictLabel(v.label)}
        </Stamp>
      </div>
      <TallyPips tally={v.tally} appointed={v.appointed} ballot={detail.ballot} />
      {detail.sentence && (
        <blockquote className={styles.sentence}>
          <p>{detail.sentence.text}</p>
          <footer>{t('grandJury.verdict.sentencing')}</footer>
        </blockquote>
      )}
      <p className={styles.panelLede}>{won === null ? t('grandJury.verdict.lede.none', { threshold: detail.terms.threshold }) : t('grandJury.verdict.lede.verdict')}</p>
      {detail.disclosure && (
        <details className={styles.breakdown}>
          <summary>
            <Icon name="scales" /> {t('grandJury.verdict.whereEvery', { amount: formatAmount(detail.disclosure.totalIn, { unit: false }) })}
          </summary>
          <DisclosureList d={detail.disclosure} />
        </details>
      )}
    </CourtPanel>
  );
}
