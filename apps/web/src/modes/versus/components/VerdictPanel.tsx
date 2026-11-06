import { formatUsdc, type CaseNumber, type Hex } from '@cringe-court/core';
import { claimable, claimedBy, disclose, receiptFor, roleLabel, seatsOf, sideLabel, type VersusCase, type Viewer } from '@cringe-court/modes-versus';
import { Alert, Badge, Button, Card, CardBody, CardHeader, CardTitle, DialogueBox, Icon, Portrait, Receipt, Spinner, Stamp } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { TrialView } from './TrialView';
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
          Your settlement
        </CardTitle>
      </CardHeader>
      <CardBody className={styles.stack}>
        {caseNumber !== null && <Receipt caseNumber={caseNumber} title="Settlement receipt" lines={lines} note="Test USDC on the Arc testnet memory twin. Every line is computed by the ledger, not the app." />}
        {owed > 0n ? (
          <Button
            size="lg"
            variant="swear"
            iconStart={<Icon name="sparkle" />}
            onClick={async () => {
              const ok = await run(() => desk.claim(c.trialId), { success: `Claimed ${formatUsdc(owed)} to your demo wallet` });
              if (ok) audio.handle({ type: 'settlement', kind: 'payout' });
            }}
          >
            Claim {formatUsdc(owed)}
          </Button>
        ) : claimed !== null ? (
          <Badge tone="success" dot>
            Claimed {formatUsdc(claimed)}
          </Badge>
        ) : (
          <p className={styles.muted}>Nothing to claim on this case.</p>
        )}
      </CardBody>
    </Card>
  );
}

export function VerdictPanel({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
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
        <p className={styles.eyebrow}>The jury has spoken</p>
        <h2 id="verdict-title" className="cc-visually-hidden">
          Verdict: {winner ? `${winner === 'a' ? labelA : labelB} wins` : 'no verdict'}, {v.tally[0]} to {v.tally[1]}
        </h2>
        <div className={styles.verdictStage} aria-hidden>
          <Portrait character="side-a" size="xl" ring="side-a" expression={winner === 'a' ? 'smug' : winner === 'b' ? 'defeated' : 'shocked'} alt="" />
          <Stamp tone={winner === 'a' ? 'side-a' : winner === 'b' ? 'side-b' : 'no-verdict'} size="lg" animate sub={winner ? `${Math.max(...v.tally)}–${Math.min(...v.tally)}` : 'Full refund'}>
            {winner ? `Side ${winner.toUpperCase()} wins` : 'Mistrial'}
          </Stamp>
          <Portrait character="side-b" size="xl" ring="side-b" expression={winner === 'b' ? 'smug' : winner === 'a' ? 'defeated' : 'shocked'} alt="" />
        </div>
        <p className={styles.verdictLine}>
          {winner ? (
            <>
              <strong>{winner === 'a' ? labelA : labelB}</strong> argued it better. {youWon ? 'That’s you. Enjoy it responsibly.' : youLost ? 'Not this time. The share card is still funny.' : ''}
            </>
          ) : (
            'Fewer than two matching votes were opened in time, so there is no verdict. Both sides get their own half back.'
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
        <p className={styles.fineOnWood}>
          {v.completedDuty} of {v.appointed} jurors finished duty. The AI argued; humans decided.
        </p>
      </PaperSection>

      {s.sentence ? (
        <DialogueBox speaker="judge" expression="smug" text={s.sentence.text} />
      ) : (
        <p className={styles.thinkingLine} role="status">
          <Spinner size="sm" label={null} /> Judge Gavel.exe is writing the sentence…
        </p>
      )}

      <ShareCard c={c} />

      <div className={styles.twoCol}>
        <ClaimCard c={c} caseNumber={s.caseNumber} />
        <Card as="section" aria-labelledby="kept-title" tone="sunken">
          <CardHeader eyebrow="Disclosure (D13)">
            <CardTitle id="kept-title" as="h2">
              What the court kept
            </CardTitle>
          </CardHeader>
          <CardBody>
            <dl className={styles.breakdown}>
              <div>
                <dt>Protocol + AI fees</dt>
                <dd>{formatUsdc(d.fees)}</dd>
              </div>
              <div>
                <dt>Forfeited juror bonds</dt>
                <dd>{formatUsdc(d.forfeits)}</dd>
              </div>
              <div>
                <dt>Unearned jury reward</dt>
                <dd>{formatUsdc(d.unearnedBonus)}</dd>
              </div>
              <div className={styles.breakdownTotal}>
                <dt>Total</dt>
                <dd>{formatUsdc(d.total)}</dd>
              </div>
            </dl>
            <p className={styles.fine}>
              Attendance {d.attendance.completed}/{d.attendance.appointed}.{' '}
              {missed > 0 ? `${missed} juror${missed > 1 ? 's' : ''} missed a deadline; forfeits are kept and disclosed, and no price depends on them.` : 'Every juror finished.'}
            </p>
          </CardBody>
        </Card>
      </div>

      {missed > 0 && seats.some((x) => !x.revealed) && viewer === 'juror' && (
        <Alert tone="warning" title="Missed deadlines cost the bond">
          Jurors who did not seal and open their scroll in time forfeit their bond, as the summons said.
        </Alert>
      )}

      <details className={styles.replay}>
        <summary>Watch the trial again</summary>
        <TrialView lines={s.transcript.lines} exhibits={s.exhibits} filing={s.filing} seats={seats} jurySize={s.terms.jurySize} verdict={winner ?? 'none'} />
        <p className={styles.fine}>
          Transcript fingerprint <code>{s.transcript.hash.slice(0, 18)}…</code>, recorded on the ledger before any vote. Model {s.transcript.model}.
        </p>
      </details>
    </div>
  );
}
