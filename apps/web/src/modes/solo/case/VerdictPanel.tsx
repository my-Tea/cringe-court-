import { useEffect, useMemo } from 'react';
import { formatUsdc, type ReceiptLine, type ShareState, type VerdictState } from '@cringe-court/core';
import {
  NPC_PERSONAS,
  filerReceipt,
  revenueDisclosure,
  shareSummary,
  verdictTone,
  type SoloSession,
  type SoloSnapshot,
} from '@cringe-court/modes-solo';
import { Alert, Amount, Badge, DialogueBox, PaperButton, PaperPanel, Stamp, type PaperPanelProps } from '@/ds';
import { t } from '@/i18n';
import { jurorArt } from '../lib/art';
import { caseSound } from '../lib/sound';
import { ShareCard } from '../share/ShareCard';
import styles from './CasePage.module.css';
import paper from './VerdictPanel.module.css';

/** The hero's backing sheet follows the outcome. */
const BACKING: Record<ReturnType<typeof verdictTone>, NonNullable<PaperPanelProps['backing']>> = {
  guilty: 'maroon',
  'not-cooked': 'gold',
  'no-verdict': 'cream',
};

type Decided = VerdictState | ShareState;

export interface VerdictPanelProps {
  snap: SoloSnapshot & { trial: Decided };
  /** Live session (null when shown from the docket). */
  session: SoloSession | null;
}

export function VerdictPanel({ snap, session }: VerdictPanelProps) {
  const tState = snap.trial;
  const tone = verdictTone(tState);
  const summary = useMemo(() => shareSummary(tState), [tState]);
  const disclosure = revenueDisclosure(tState.settlement, tState.terms);
  const paid = tState.terms.payerShares[0] ?? tState.terms.target;
  const back = filerReceipt(tState.settlement, snap.filer);
  const lines: ReceiptLine[] = [
    {
      kind: 'fee',
      label: t('solo.verdict.paid'),
      amount: paid,
    },
    ...back,
  ];
  const refundDue = back.some((l) => l.kind === 'refund');
  // The verdict sting plays once, when the verdict is first shown live.
  const live = session !== null;
  useEffect(() => {
    if (live) caseSound({ type: 'verdict.read', outcome: tone });
  }, [live, tone]);
  const sentenceMood = tone === 'guilty' ? 'smug' : tone === 'not-cooked' ? 'neutral' : 'shocked';

  return (
    <div className={styles.verdict}>
      <PaperPanel
        as="section"
        tone="cream"
        edge="torn"
        elevation={4}
        backing={BACKING[tone]}
        padding="none"
        unfold
        className={paper.hero}
        data-outcome={tone}
        aria-labelledby="verdict-title"
      >
        <div className={paper.heroInner}>
          <p className={styles.eyebrow}>{t('solo.verdict.eyebrow')}</p>
          <h2 id="verdict-title" className="cc-visually-hidden">
            {t('solo.verdict.heading', { label: tState.verdict.label })}
          </h2>
          <Stamp tone={tone} size="xl" animate sub={tone === 'no-verdict' ? t('solo.verdict.fullRefund') : summary.caseLabel}>
            {tState.verdict.label}
          </Stamp>
          <p className={styles.headline}>{summary.headline}</p>
          <p className={styles.tally}>
            <span>
              {tState.terms.ballot[0]} <strong>{tState.verdict.tally[0]}</strong>
            </span>
            <span aria-hidden>·</span>
            <span>
              {tState.terms.ballot[1]} <strong>{tState.verdict.tally[1]}</strong>
            </span>
            <span className={styles.tallyNote}>
              {t('solo.verdict.tallyNote', { completed: tState.verdict.completedDuty, appointed: tState.verdict.appointed, needed: tState.terms.threshold })}
            </span>
          </p>
        </div>
      </PaperPanel>

      {tState.sentence && (
        <PaperPanel tone="cream" edge="cut" elevation={3} backing="gold" padding="none">
          <DialogueBox
            className={paper.sentence}
            speaker="judge"
            expression={sentenceMood}
            text={tState.sentence.text}
            speakerName={t('solo.verdict.sentenceBy')}
          />
        </PaperPanel>
      )}

      <ul className={`${styles.votes} ${paper.votes}`} role="list" aria-label={t('solo.verdict.votes')}>
        {tState.seats.map((seat, i) => {
          const p = NPC_PERSONAS[i];
          const choice = seat.choice;
          return (
            <PaperPanel
              as="li"
              key={seat.account}
              tone="cream"
              edge="cut"
              elevation={2}
              padding="sm"
              backing={choice === undefined ? 'none' : 'gold'}
            >
              <div className={paper.vote}>
                {p && <img src={jurorArt(p.id)} alt="" data-pixel className={styles.voteSprite} />}
                <div>
                  <strong>{p?.name ?? t('solo.verdict.juror', { n: seat.seat })}</strong>
                  <p>{choice !== undefined && p ? `“${p.says[choice]}”` : t('solo.verdict.noReveal')}</p>
                </div>
                <Badge tone={choice === 0 ? 'danger' : choice === 1 ? 'success' : 'neutral'}>
                  {choice !== undefined ? tState.terms.ballot[choice] : t('solo.verdict.noVote')}
                </Badge>
              </div>
            </PaperPanel>
          );
        })}
      </ul>

      <div className={styles.money}>
        <PaperPanel as="section" tone="cream" edge="cut" elevation={2} backing="gold" padding="md" aria-labelledby="receipt-title">
          <header className={paper.cardHead}>
            <p className={paper.cardEyebrow}>{t('solo.verdict.money.eyebrow')}</p>
            <h3 id="receipt-title" className={paper.cardTitle}>
              {refundDue ? t('solo.verdict.money.refund') : t('solo.verdict.money.spent')}
            </h3>
          </header>
          <dl className={styles.ledger}>
            {lines.map((l, i) => (
              <div key={`${l.kind}-${i}`}>
                <dt>{l.label}</dt>
                <dd>
                  <Amount value={l.amount} direction={l.kind === 'fee' ? 'debit' : 'credit'} />
                </dd>
              </div>
            ))}
          </dl>
          {!refundDue && (
            <p className={styles.small}>
              {t('solo.verdict.money.paidNote', { pool: formatUsdc(tState.terms.juryPool), fees: formatUsdc(disclosure.fees) })}
            </p>
          )}
          {refundDue &&
            (snap.claimed ? (
              <Alert tone="success" title={t('solo.verdict.refund.claimedTitle')} live="polite">
                {t('solo.verdict.refund.claimedBody', { amount: formatUsdc(paid) })}
              </Alert>
            ) : session ? (
              <PaperButton onClick={() => void session.claimRefund()} loading={snap.busy === 'claiming'}>
                {t('solo.verdict.refund.claim', { amount: formatUsdc(paid) })}
              </PaperButton>
            ) : null)}
        </PaperPanel>

        <PaperPanel as="section" tone="kraft" edge="cut" elevation={1} padding="md" aria-labelledby="court-kept-title">
          <header className={paper.cardHead}>
            <p className={paper.cardEyebrow}>{t('solo.verdict.kept.eyebrow')}</p>
            <h3 id="court-kept-title" className={paper.cardTitle}>
              {t('solo.verdict.kept.heading')}
            </h3>
          </header>
          <dl className={styles.ledger}>
            <div>
              <dt>{t('solo.verdict.kept.fees')}</dt>
              <dd>
                <Amount value={disclosure.fees} />
              </dd>
            </div>
            <div>
              <dt>{t('solo.verdict.kept.forfeits')}</dt>
              <dd>
                <Amount value={disclosure.forfeits} />
              </dd>
            </div>
            <div>
              <dt>{t('solo.verdict.kept.unearned')}</dt>
              <dd>
                <Amount value={disclosure.unearnedBonus} />
              </dd>
            </div>
            <div className={styles.total}>
              <dt>{t('solo.verdict.kept.total')}</dt>
              <dd>
                <Amount value={disclosure.total} />
              </dd>
            </div>
          </dl>
          <p className={styles.small}>
            {t('solo.verdict.kept.note', { completed: disclosure.attendance.completed, seats: disclosure.attendance.seats })}
          </p>
        </PaperPanel>
      </div>

      <details className={styles.record}>
        <summary>{t('solo.verdict.record.summary')}</summary>
        <dl className={styles.ledger}>
          <div>
            <dt>{t('solo.verdict.record.fingerprint')}</dt>
            <dd className={styles.hash}>{tState.transcript.hash}</dd>
          </div>
          <div>
            <dt>{t('solo.verdict.record.counsel')}</dt>
            <dd>
              {t('solo.verdict.record.counselValue', { model: tState.transcript.model, provider: tState.transcript.provider === 'fixture' ? t('solo.verdict.record.fixture') : t('solo.verdict.record.compute') })}
            </dd>
          </div>
          {Object.entries(snap.txs).map(([step, tx]) => (
            <div key={step}>
              <dt>{t('solo.verdict.record.tx', { step })}</dt>
              <dd className={styles.hash}>
                {tx.explorerUrl.startsWith('https://') ? (
                  <a href={tx.explorerUrl} target="_blank" rel="noopener noreferrer">
                    {tx.hash}
                  </a>
                ) : (
                  tx.hash
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className={styles.small}>{t('solo.verdict.record.note')}</p>
      </details>

      <ShareCard summary={summary} onShared={session ? (channel) => session.shared(channel) : undefined} />
    </div>
  );
}
