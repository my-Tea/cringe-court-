import { useState } from 'react';
import { t, tRich } from '@/i18n';
import { type CaseNumber, type Hex } from '@cringe-court/core';
import { formatAmount, sideLabel } from '@/i18n/domain';
import { claimable, claimedBy, disclose, receiptFor, roleLabel, seatsOf, type VersusCase, type Viewer } from '@cringe-court/modes-versus';
import { Alert, Badge, Button, Card, CardBody, CardHeader, CardTitle, DialogueBox, Icon, Portrait, Receipt, Spinner, Stamp } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { VersusTrialFrame } from './VersusTrialFrame';
import { ShareCard } from './ShareCard';
import { PaperSection } from './PaperSection';

/** Your receipt from the ledger, and the claim button (pull payments, V4 §9). */
export function ClaimCard({ c, caseNumber }: { c: VersusCase; caseNumber: CaseNumber | null }) {
  const { persona, desk, run, audio } = useVersus();
  const lines = receiptFor(c, persona.account);
  const owed = claimable(c, persona.account);
  const claimed = claimedBy(c, persona.account);
  if (lines.length === 0) return null;
  return (
    <Card as="section" aria-labelledby="receipt-title">
      <CardHeader eyebrow={roleLabel(c, persona.account as Hex)}>
        <CardTitle id="receipt-title" as="h2">
          {t('versus.verdict.settlement')}
        </CardTitle>
      </CardHeader>
      <CardBody className={styles.stack}>
        {caseNumber !== null && <Receipt caseNumber={caseNumber} title={t('versus.verdict.receipt.title')} lines={lines} note={t('versus.verdict.receipt.note')} />}
        {owed > 0n ? (
          <Button
            size="lg"
            variant="swear"
            iconStart={<Icon name="sparkle" />}
            onClick={async () => {
              const ok = await run(() => desk.claim(c.trialId), { success: t('versus.verdict.claimToast', { amount: formatAmount(owed) }) });
              if (ok) audio.handle({ type: 'settlement', kind: 'payout' });
            }}
          >
            {t('versus.verdict.claim', { amount: formatAmount(owed) })}
          </Button>
        ) : claimed !== null ? (
          <Badge tone="success" dot>
            {t('versus.verdict.claimed', { amount: formatAmount(claimed) })}
          </Badge>
        ) : (
          <p className={styles.muted}>{t('versus.verdict.nothingToClaim')}</p>
        )}
      </CardBody>
    </Card>
  );
}

export function VerdictPanel({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  // The replay mounts only once opened, so a closed <details> never builds a WebGL scene.
  const [replayOpen, setReplayOpen] = useState(false);
  // The verdict sting fires from CasePage, once, when the case moves into its verdict.
  const s = c.state;
  if (s.stage !== 'verdict' && s.stage !== 'share' && s.stage !== 'appeal') return null;

  const v = s.verdict;
  const winner = v.kind === 'ballot-0' ? 'a' : v.kind === 'ballot-1' ? 'b' : null;
  const labelA = sideLabel('a', s.filing.sides.a);
  const labelB = sideLabel('b', s.filing.sides.b);
  const youWon = winner !== null && viewer === winner;
  const youLost = winner !== null && (viewer === 'a' || viewer === 'b') && viewer !== winner;
  const d = disclose(s.settlement, s.terms.jurySize);
  const missed = s.terms.jurySize - v.completedDuty;
  const seats = seatsOf(c);

  return (
    <div className={styles.stack}>
      <PaperSection as="section" padding="lg" tone="maroon" aria-labelledby="verdict-title" bodyClassName={styles.verdict} data-outcome={winner ?? 'none'}>
        <p className={styles.eyebrow}>{t('versus.verdict.spoken')}</p>
        <h2 id="verdict-title" className="cc-visually-hidden">
          {t('versus.verdict.heading', {
            result: winner ? t('versus.verdict.wins', { label: winner === 'a' ? labelA : labelB }) : t('versus.verdict.none'),
            a: v.tally[0]!,
            b: v.tally[1]!,
          })}
        </h2>
        <div className={styles.verdictStage} aria-hidden>
          <Portrait character="side-a" size="xl" ring="side-a" expression={winner === 'a' ? 'smug' : winner === 'b' ? 'defeated' : 'shocked'} alt="" />
          <Stamp
            tone={winner === 'a' ? 'side-a' : winner === 'b' ? 'side-b' : 'no-verdict'}
            size="lg"
            animate
            sub={winner ? `${Math.max(...v.tally)}–${Math.min(...v.tally)}` : t('versus.verdict.fullRefund')}
          >
            {winner ? t('versus.verdict.sideWins', { side: winner.toUpperCase() }) : t('versus.verdict.mistrial')}
          </Stamp>
          <Portrait character="side-b" size="xl" ring="side-b" expression={winner === 'b' ? 'smug' : winner === 'a' ? 'defeated' : 'shocked'} alt="" />
        </div>
        <p className={styles.verdictLine}>
          {winner ? (
            <>
              {tRich('versus.verdict.argued', { winner: (chunk) => <strong>{chunk}</strong> }, { label: winner === 'a' ? labelA : labelB })}{' '}
              {youWon ? t('versus.verdict.youWon') : youLost ? t('versus.verdict.youLost') : ''}
            </>
          ) : (
            t('versus.verdict.noVerdictLine')
          )}
        </p>
        <div className={styles.tallyBars} aria-hidden>
          {(['a', 'b'] as const).map((x, i) => (
            <div key={x} className={styles.tallyBar} data-side={x}>
              <span>{x === 'a' ? labelA : labelB}</span>
              <span className={styles.tallyDots}>
                {Array.from({ length: s.terms.jurySize }, (_, j) => (
                  <span key={j} data-on={j < v.tally[i]! || undefined} />
                ))}
              </span>
              <span className={styles.mono}>{v.tally[i]}</span>
            </div>
          ))}
        </div>
        <p className={styles.fineOnWood}>{t('versus.verdict.duty', { completed: v.completedDuty, appointed: v.appointed })}</p>
      </PaperSection>

      {s.sentence ? (
        <DialogueBox speaker="judge" expression="smug" text={s.sentence.text} />
      ) : (
        <p className={styles.thinkingLine} role="status">
          <Spinner size="sm" label={null} /> {t('versus.verdict.sentencing', { judge: t('versus.court.judge') })}
        </p>
      )}

      <ShareCard c={c} />

      <div className={styles.twoCol}>
        <ClaimCard c={c} caseNumber={s.caseNumber} />
        <Card as="section" aria-labelledby="kept-title" tone="sunken">
          <CardHeader eyebrow={t('versus.verdict.disclosure.eyebrow')}>
            <CardTitle id="kept-title" as="h2">
              {t('versus.verdict.disclosure.title')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className={styles.breakdown}>
              <div>
                <dt>{t('versus.verdict.disclosure.fees')}</dt>
                <dd>{formatAmount(d.fees)}</dd>
              </div>
              <div>
                <dt>{t('versus.verdict.disclosure.forfeits')}</dt>
                <dd>{formatAmount(d.forfeits)}</dd>
              </div>
              <div>
                <dt>{t('versus.verdict.disclosure.unearned')}</dt>
                <dd>{formatAmount(d.unearnedBonus)}</dd>
              </div>
              <div className={styles.breakdownTotal}>
                <dt>{t('common.total')}</dt>
                <dd>{formatAmount(d.total)}</dd>
              </div>
            </dl>
            <p className={styles.fine}>{t('versus.verdict.disclosure.attendance', { completed: d.attendance.completed, appointed: d.attendance.appointed, missed })}</p>
          </CardBody>
        </Card>
      </div>

      {missed > 0 && seats.some((x) => !x.revealed) && viewer === 'juror' && (
        <Alert tone="warning" title={t('versus.verdict.missed.title')}>
          {t('versus.verdict.missed.body')}
        </Alert>
      )}

      <details className={styles.replay} onToggle={(e) => setReplayOpen(e.currentTarget.open)}>
        <summary>{t('versus.verdict.replay')}</summary>
        {replayOpen && (
          <VersusTrialFrame
            viewer={viewer}
            lines={s.transcript.lines}
            exhibits={s.exhibits}
            filing={s.filing}
            seats={seats}
            jurySize={s.terms.jurySize}
            verdict={winner ?? 'none'}
          />
        )}
        <p className={styles.fine}>
          {tRich('versus.verdict.fingerprint', { code: (chunk) => <code>{chunk}</code> }, { hash: `${s.transcript.hash.slice(0, 18)}…`, model: s.transcript.model })}
        </p>
      </details>
    </div>
  );
}
