import { formatUsdc, usdc, type SideId } from '@cringe-court/core';
import { otherSide, sideCharges, sideStatus, type VersusCase } from '@cringe-court/modes-versus';
import { Alert, Amount, Badge, Button, Dialog, DialogClose, DialogContent, DialogTrigger, Icon, OrnateFrame, Portrait, Spinner, TestnetBadge } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { WithdrawButton } from './BriefPanel';
import { TrialView } from './TrialView';

/** Both agents are writing. The clerk in any party tab runs the draft. */
export function DraftingPanel({ c }: { c: VersusCase }) {
  const s = c.state;
  const attempt = s.stage === 'counsel' ? s.attempt : 1;
  const redraft = s.stage === 'counsel' ? s.pendingRedraft : null;
  return (
    <OrnateFrame as="section" padding="lg" tone="wood" aria-labelledby="drafting-title" className={styles.drafting}>
      <div className={styles.draftingStage} aria-hidden>
        <Portrait character="side-a" expression="smug" size="xl" ring="side-a" alt="" />
        <span className={styles.vs}>VS</span>
        <Portrait character="side-b" expression="smug" size="xl" ring="side-b" alt="" />
      </div>
      <h2 id="drafting-title" className={styles.panelTitle}>
        {redraft === null ? 'The agents are drafting the trial' : `Agent ${redraft === 0 ? 'A' : 'B'} is redrafting`}
      </h2>
      <p role="status" className={styles.draftingStatus}>
        <Spinner size="sm" label={null} /> Attempt {attempt}: same model, same token budget for both sides. A balance check runs before you see it.
      </p>
      <p className={styles.fine}>Each agent sees its own side’s notes and only the other side’s public story (D1).</p>
    </OrnateFrame>
  );
}

function BalanceMeter({ scores, ok }: { scores: readonly [number, number]; ok: boolean }) {
  return (
    <div className={styles.balance}>
      <p className={styles.balanceTitle}>
        Balance check <Badge tone={ok ? 'success' : 'danger'}>{ok ? 'Fair fight' : 'Lopsided'}</Badge>
      </p>
      {(['a', 'b'] as const).map((side, i) => (
        <div key={side} className={styles.balanceRow} data-side={side}>
          <span>Agent {side.toUpperCase()}</span>
          <meter min={0} max={1} low={0.6} optimum={1} value={scores[i]} aria-label={`Agent ${side.toUpperCase()} argument strength`}>
            {Math.round(scores[i]! * 100)}%
          </meter>
          <span className={styles.mono}>{Math.round(scores[i]! * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/** Each side reads the whole draft, may redraft its own agent once (D2), then approves. Two approvals freeze it. */
export function DraftReviewPanel({ c, side }: { c: VersusCase; side: SideId }) {
  const { desk, run } = useVersus();
  const s = c.state;
  if (s.stage !== 'counsel' || !s.draft) return null;
  const me = sideStatus(c, side);
  const them = otherSide(side);
  const themStatus = sideStatus(c, them);
  return (
    <div className={styles.stack}>
      <OrnateFrame as="section" padding="md" ribbon="The draft" aria-label="Draft trial">
        <TrialView lines={s.draft.lines} exhibits={s.exhibits} filing={s.filing} banner="Draft · frozen once both sides approve" />
      </OrnateFrame>
      <section className={styles.reviewBar} aria-labelledby="approve-title">
        <div>
          <h2 id="approve-title" className={styles.panelSubtitle}>
            Happy with how Agent {side.toUpperCase()} argued?
          </h2>
          <p className={styles.muted}>
            After both of you approve, the transcript is frozen and fingerprinted; nothing changes after payment. {themStatus.approvedDraft ? `Side ${them.toUpperCase()} has approved.` : `Side ${them.toUpperCase()} has not approved yet.`}
          </p>
          {s.balance && <BalanceMeter scores={s.balance.scores} ok={s.balance.ok} />}
        </div>
        <div className={styles.reviewBarActions}>
          {me.approvedDraft ? (
            <Badge tone="success" dot>
              You approved the draft
            </Badge>
          ) : (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" disabled={me.redraftsLeft === 0} iconStart={<Icon name="refresh" />}>
                    {me.redraftsLeft === 0 ? 'Redraft used' : 'Redraft my agent (1 left)'}
                  </Button>
                </DialogTrigger>
                <DialogContent
                  title={`Redraft Agent ${side.toUpperCase()}?`}
                  description={`Your agent writes its lines again. Agent ${them.toUpperCase()}’s lines stay word for word. You get one redraft per case (D2).`}
                  size="sm"
                  footer={
                    <>
                      <DialogClose asChild>
                        <Button variant="ghost">Keep this draft</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button onClick={() => void run(() => desk.requestRedraft(c.trialId, side), { success: `Agent ${side.toUpperCase()} is redrafting` })}>Redraft</Button>
                      </DialogClose>
                    </>
                  }
                />
              </Dialog>
              <Button size="lg" iconStart={<Icon name="check" />} onClick={() => void run(() => desk.approveDraft(c.trialId, side), { success: 'Draft approved' })}>
                Approve the draft
              </Button>
            </>
          )}
        </div>
      </section>
      <div className={styles.panelFooter}>
        <WithdrawButton c={c} side={side} />
      </div>
    </div>
  );
}

/** Each side pays its own half on the ledger; when both are in, the court calls a jury. */
export function FundingPanel({ c, side }: { c: VersusCase; side: SideId }) {
  const { desk, run, balance } = useVersus();
  const s = c.state;
  const mine = sideCharges(s.terms)[side === 'a' ? 0 : 1];
  const me = sideStatus(c, side);
  const them = otherSide(side);
  const themStatus = sideStatus(c, them);
  const short = balance < mine.total;
  return (
    <OrnateFrame as="section" padding="lg" ribbon="Pay your half" aria-labelledby="fund-title">
      <div className={styles.fundGrid}>
        <div>
          <h2 id="fund-title" className={styles.panelTitle}>
            The transcript is frozen. Time to pay.
          </h2>
          <p className={styles.muted}>
            Your half goes into the case escrow on Arc testnet. When both halves are in, three random verified jurors are called. <TestnetBadge />
          </p>
          <dl className={styles.breakdown}>
            {mine.parts.map((p) => (
              <div key={p.label}>
                <dt>{p.label}</dt>
                <dd>
                  <Amount value={p.amount} size="sm" />
                </dd>
              </div>
            ))}
            <div className={styles.breakdownTotal}>
              <dt>You pay</dt>
              <dd>
                <Amount value={mine.total} size="lg" direction="debit" />
              </dd>
            </div>
          </dl>
        </div>
        <div className={styles.fundSides}>
          {(['a', 'b'] as const).map((x) => {
            const st = x === side ? me : themStatus;
            return (
              <div key={x} className={styles.fundSide} data-side={x} data-paid={st.paid || undefined}>
                <Portrait character={x === 'a' ? 'side-a' : 'side-b'} size="sm" ring={x === 'a' ? 'side-a' : 'side-b'} alt="" />
                <span>
                  Side {x.toUpperCase()}
                  {x === side && ' (you)'}
                </span>
                <Badge tone={st.paid ? 'success' : 'neutral'} dot={!st.paid ? 'pulse' : true}>
                  {st.paid ? 'Paid' : 'Waiting'}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {me.paid ? (
        <Alert tone="success" title="Your half is in escrow">
          {themStatus.paid ? 'Both halves are in.' : `Waiting for Side ${them.toUpperCase()}. If they don’t pay before the deadline, your ${formatUsdc(mine.total)} is refunded in full.`}
        </Alert>
      ) : (
        <div className={styles.payRow}>
          <p className={styles.balanceLine}>
            Demo wallet: <Amount value={balance} size="sm" />
          </p>
          {short && (
            <Button variant="secondary" iconStart={<Icon name="plus" />} onClick={() => void run(() => desk.faucet(usdc('5.00')), { success: 'Added 5.00 test USDC' })}>
              Get test USDC
            </Button>
          )}
          <Button size="lg" variant="swear" disabled={short} iconStart={<Icon name="scales" />} onClick={() => void run(() => desk.fund(c.trialId), { success: `Paid ${formatUsdc(mine.total)} (test USDC)` })}>
            Pay {formatUsdc(mine.total)}
          </Button>
        </div>
      )}
      <p className={styles.fine}>No wager: the winner gets bragging rights and a share card, never the other side’s money. On NO VERDICT or any failure you get your own half back.</p>
      <div className={styles.panelFooter}>
        <WithdrawButton c={c} side={side} paid={me.paid} />
      </div>
    </OrnateFrame>
  );
}
