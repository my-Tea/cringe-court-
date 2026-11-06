import { formatUsdc, type Usdc } from '@cringe-court/core';
import type { CaseDetail, Disclosure } from '@cringe-court/modes-grand-jury';
import { useEffect, useRef } from 'react';
import { Amount, Card, CardBody, CardHeader, CardTitle, Icon, Stamp } from '@/ds';
import { verdictSound } from '../lib';
import styles from '../GrandJury.module.css';

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
          {ballot[0]} <strong>{tally[0]}</strong>
        </span>
        <span data-bench={1}>
          {ballot[1]} <strong>{tally[1]}</strong>
        </span>
        {absent > 0 && (
          <span data-bench="none">
            Did not reveal <strong>{absent}</strong>
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
    row('Raised in total (crowd + sponsor + juror bonds)', d.totalIn),
    row('Paid back to jurors (bonds + rewards)', d.paidToJurors),
    row('Refunded to summoners', d.refundedToFunders),
    row('Fees kept by the protocol', d.fees, d.outcome === 'verdict' ? 'Protocol + AI counsel fee, kept only because there was a verdict.' : undefined),
    row('Forfeited bonds', d.forfeits, 'Bonds of jurors who did not seal or open their ballot in time.'),
    row('Unearned juror rewards', d.unearnedBonus),
    row('Sponsor fee', d.sponsorFee),
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
        <dt>Jurors who completed both windows</dt>
        <dd className={styles.disclosureCount}>
          {d.completed} of {d.appointed}
        </dd>
      </div>
    </dl>
  );
}

/**
 * The verdict, read out: a stamp, the revealed tally, the judge's sentence and
 * the D13 money disclosure. Plays the verdict stinger once per case when it is
 * first shown.
 */
export function VerdictPanel({ detail }: { detail: CaseDetail }) {
  const v = detail.verdict;
  const played = useRef<number | null>(null);
  useEffect(() => {
    if (!v || played.current === detail.caseNumber) return;
    played.current = detail.caseNumber;
    verdictSound(v.kind);
  }, [v, detail.caseNumber]);

  if (detail.status === 'cancelled') {
    return (
      <Card as="section" tone="parchment" aria-labelledby="verdict-title" className={styles.verdictCard} data-outcome="cancelled">
        <CardHeader eyebrow="Dismissed">
          <CardTitle id="verdict-title" as="h2">
            The court never sat
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className={styles.verdictStamp}>
            <Stamp tone="no-verdict" size="lg" animate sub="Full refunds">
              Case dismissed
            </Stamp>
          </div>
          <p className={styles.panelLede}>No fees were kept. Every summoner, sponsor and sworn juror can pull back exactly what they put in.</p>
          {detail.disclosure && (
            <details className={styles.breakdown}>
              <summary>Where the money went</summary>
              <DisclosureList d={detail.disclosure} />
            </details>
          )}
        </CardBody>
      </Card>
    );
  }
  if (!v) return null;
  const won = v.kind === 'ballot-0' ? 0 : v.kind === 'ballot-1' ? 1 : null;
  const winners = won === null ? 0 : v.tally[won];

  return (
    <Card as="section" tone="ornate" aria-labelledby="verdict-title" className={styles.verdictCard} data-outcome={won === null ? 'none' : `bench-${won}`}>
      <CardHeader eyebrow={`${detail.label} · Verdict`}>
        <CardTitle id="verdict-title" as="h2">
          {won === null ? 'No verdict' : `${winners} of ${v.appointed} strangers agreed`}
        </CardTitle>
      </CardHeader>
      <CardBody>
        <div className={styles.verdictStamp}>
          <Stamp tone={won === 0 ? 'guilty' : won === 1 ? 'side-a' : 'no-verdict'} size="xl" animate sub={won === null ? `Needed ${detail.terms.threshold} of ${v.appointed}` : `${v.tally[0]}–${v.tally[1]}`}>
            {won === null ? 'No verdict' : v.label}
          </Stamp>
        </div>
        <TallyPips tally={v.tally} appointed={v.appointed} ballot={detail.ballot} />
        {detail.sentence && (
          <blockquote className={styles.sentence}>
            <p>{detail.sentence.text}</p>
            <footer>The Judge, sentencing</footer>
          </blockquote>
        )}
        <p className={styles.panelLede}>
          {won === null
            ? `Fewer than ${detail.terms.threshold} jurors agreed, so there is no verdict. The protocol keeps no fee: every summoner is refunded.`
            : 'Jurors who sealed and opened on time get their bond back plus the reward. Summoners keep their credit, whatever the verdict.'}
        </p>
        {detail.disclosure && (
          <details className={styles.breakdown}>
            <summary>
              <Icon name="scales" /> Where every {formatUsdc(detail.disclosure.totalIn, { unit: false })} test USDC went
            </summary>
            <DisclosureList d={detail.disclosure} />
          </details>
        )}
      </CardBody>
    </Card>
  );
}
