import { useEffect, useMemo } from 'react';
import { formatUsdc, type ReceiptLine, type ShareState, type VerdictState } from '@cringe-court/core';
import { NPC_PERSONAS, filerReceipt, revenueDisclosure, shareSummary, verdictTone, type SoloSession, type SoloSnapshot } from '@cringe-court/modes-solo';
import { Alert, Amount, Badge, Button, Card, CardBody, CardHeader, CardTitle, DialogueBox, Stamp } from '@/ds';
import { jurorArt } from '../lib/art';
import { caseSound } from '../lib/sound';
import { ShareCard } from '../share/ShareCard';
import styles from './CasePage.module.css';

type Decided = VerdictState | ShareState;

export interface VerdictPanelProps {
  snap: SoloSnapshot & { trial: Decided };
  /** Live session (null when shown from the docket). */
  session: SoloSession | null;
}

export function VerdictPanel({ snap, session }: VerdictPanelProps) {
  const t = snap.trial;
  const tone = verdictTone(t);
  const summary = useMemo(() => shareSummary(t), [t]);
  const disclosure = revenueDisclosure(t.settlement, t.terms);
  const paid = t.terms.payerShares[0] ?? t.terms.target;
  const back = filerReceipt(t.settlement, snap.filer);
  const lines: ReceiptLine[] = [{ kind: 'fee', label: 'You paid: jury pool, court fee and AI counsel', amount: paid }, ...back];
  const refundDue = back.some((l) => l.kind === 'refund');
  // The verdict sting plays once, when the verdict is first shown live.
  const live = session !== null;
  useEffect(() => {
    if (live) caseSound({ type: 'verdict.read', outcome: tone });
  }, [live, tone]);
  const sentenceMood = tone === 'guilty' ? 'smug' : tone === 'not-cooked' ? 'neutral' : 'shocked';

  return (
    <div className={styles.verdict}>
      <section className={styles.verdictHero} data-tone={tone} aria-labelledby="verdict-title">
        <p className={styles.eyebrow}>Phase 4 · The verdict</p>
        <h2 id="verdict-title" className="cc-visually-hidden">
          Verdict: {t.verdict.label}
        </h2>
        <Stamp tone={tone} size="xl" animate sub={tone === 'no-verdict' ? 'Full refund' : summary.caseLabel}>
          {t.verdict.label}
        </Stamp>
        <p className={styles.headline}>{summary.headline}</p>
        <p className={styles.tally}>
          <span>
            {t.terms.ballot[0]} <strong>{t.verdict.tally[0]}</strong>
          </span>
          <span aria-hidden>·</span>
          <span>
            {t.terms.ballot[1]} <strong>{t.verdict.tally[1]}</strong>
          </span>
          <span className={styles.tallyNote}>
            {t.verdict.completedDuty} of {t.verdict.appointed} jurors voted and revealed · {t.terms.threshold} needed
          </span>
        </p>
      </section>

      {t.sentence && <DialogueBox speaker="judge" expression={sentenceMood} text={t.sentence.text} speakerName="Judge Gavel.exe · sentence" />}

      <ul className={styles.votes} role="list" aria-label="How each juror voted">
        {t.seats.map((seat, i) => {
          const p = NPC_PERSONAS[i];
          const choice = seat.choice;
          return (
            <li key={seat.account} className={styles.vote}>
              {p && <img src={jurorArt(p.id)} alt="" data-pixel className={styles.voteSprite} />}
              <div>
                <strong>{p?.name ?? `Juror ${seat.seat}`}</strong>
                <p>{choice !== undefined && p ? `“${p.says[choice]}”` : 'Did not reveal in time.'}</p>
              </div>
              <Badge tone={choice === 0 ? 'danger' : choice === 1 ? 'success' : 'neutral'}>{choice !== undefined ? t.terms.ballot[choice] : 'No vote'}</Badge>
            </li>
          );
        })}
      </ul>

      <div className={styles.money}>
        <Card tone="parchment" as="section" aria-labelledby="receipt-title">
          <CardHeader eyebrow="Your money">
            <CardTitle id="receipt-title" as="h3">
              {refundDue ? 'You get it all back' : 'Where your payment went'}
            </CardTitle>
          </CardHeader>
          <CardBody>
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
                The jury reached a verdict, so the case is paid for: {formatUsdc(t.terms.juryPool)} rewarded the jurors who voted on time and{' '}
                {formatUsdc(disclosure.fees)} covered the court fee and both AI lawyers.
              </p>
            )}
            {refundDue &&
              (snap.claimed ? (
                <Alert tone="success" title="Refund claimed" live="polite">
                  {formatUsdc(paid)} is back in your demo wallet.
                </Alert>
              ) : session ? (
                <Button onClick={() => void session.claimRefund()} loading={snap.busy === 'claiming'}>
                  Claim your {formatUsdc(paid)} refund
                </Button>
              ) : null)}
          </CardBody>
        </Card>

        <Card as="section" aria-labelledby="court-kept-title">
          <CardHeader eyebrow="Disclosed on every case (D13)">
            <CardTitle id="court-kept-title" as="h3">
              What the court kept
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className={styles.ledger}>
              <div>
                <dt>Court fee + AI counsel</dt>
                <dd>
                  <Amount value={disclosure.fees} />
                </dd>
              </div>
              <div>
                <dt>Forfeited juror bonds</dt>
                <dd>
                  <Amount value={disclosure.forfeits} />
                </dd>
              </div>
              <div>
                <dt>Unearned jury rewards</dt>
                <dd>
                  <Amount value={disclosure.unearnedBonus} />
                </dd>
              </div>
              <div className={styles.total}>
                <dt>Total</dt>
                <dd>
                  <Amount value={disclosure.total} />
                </dd>
              </div>
            </dl>
            <p className={styles.small}>
              Attendance {disclosure.attendance.completed}/{disclosure.attendance.seats}. Fees are kept only when the jury reaches a verdict; a
              mistrial refunds you in full.
            </p>
          </CardBody>
        </Card>
      </div>

      <details className={styles.record}>
        <summary>Trial record</summary>
        <dl className={styles.ledger}>
          <div>
            <dt>Transcript fingerprint (frozen before payment)</dt>
            <dd className={styles.hash}>{t.transcript.hash}</dd>
          </div>
          <div>
            <dt>Counsel</dt>
            <dd>
              {t.transcript.model} ({t.transcript.provider === 'fixture' ? 'scripted demo counsel' : '0G Compute'})
            </dd>
          </div>
          {Object.entries(snap.txs).map(([step, tx]) => (
            <div key={step}>
              <dt>Ledger tx · {step}</dt>
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
        <p className={styles.small}>Demo ledger: an in-browser twin of the Arc testnet court contract. Nothing here is real money.</p>
      </details>

      <ShareCard summary={summary} onShared={session ? (channel) => session.shared(channel) : undefined} />
    </div>
  );
}
