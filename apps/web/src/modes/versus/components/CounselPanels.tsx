import { usdc, type SideId } from '@cringe-court/core';
import { formatAmount } from '@/i18n/domain';
import { otherSide, sideCharges, sideStatus, type VersusCase } from '@cringe-court/modes-versus';
import { t } from '@/i18n';
import { Alert, Amount, Badge, Button, Dialog, DialogClose, DialogContent, DialogTrigger, Icon, PaperButton, Portrait, Spinner, TestnetBadge } from '@/ds';
import { agentName, letter } from '../copy';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { WithdrawButton } from './BriefPanel';
import { TrialView } from './TrialView';
import { PaperSection } from './PaperSection';

/** Both agents are writing. The clerk in any party tab runs the draft. */
export function DraftingPanel({ c }: { c: VersusCase }) {
  const s = c.state;
  const attempt = s.stage === 'counsel' ? s.attempt : 1;
  const redraft = s.stage === 'counsel' ? s.pendingRedraft : null;
  return (
    <PaperSection as="section" padding="lg" tone="maroon" aria-labelledby="drafting-title" bodyClassName={styles.drafting}>
      <div className={styles.draftingStage} aria-hidden>
        <Portrait character="side-a" expression="smug" size="xl" ring="side-a" alt="" />
        <span className={styles.vs}>{t('versus.draft.vs')}</span>
        <Portrait character="side-b" expression="smug" size="xl" ring="side-b" alt="" />
      </div>
      <h2 id="drafting-title" className={styles.panelTitle}>
        {redraft === null ? t('versus.draft.title') : t('versus.draft.redrafting', { agent: agentName(redraft === 0 ? 'a' : 'b') })}
      </h2>
      <p role="status" className={styles.draftingStatus}>
        <Spinner size="sm" label={null} /> {t('versus.draft.attempt', { attempt })}
      </p>
      <p className={styles.fine}>{t('versus.draft.note')}</p>
    </PaperSection>
  );
}

function BalanceMeter({ scores, ok }: { scores: readonly [number, number]; ok: boolean }) {
  return (
    <div className={styles.balance}>
      <p className={styles.balanceTitle}>
        {t('versus.balance.title')} <Badge tone={ok ? 'success' : 'danger'}>{ok ? t('versus.balance.fair') : t('versus.balance.lopsided')}</Badge>
      </p>
      {(['a', 'b'] as const).map((side, i) => (
        <div key={side} className={styles.balanceRow} data-side={side}>
          <span>{agentName(side)}</span>
          <meter min={0} max={1} low={0.6} optimum={1} value={scores[i]} aria-label={t('versus.balance.strength', { agent: agentName(side) })}>
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
      <PaperSection as="section" padding="md" ribbon={t('versus.review.ribbon')} aria-label={t('versus.review.aria')}>
        <TrialView lines={s.draft.lines} exhibits={s.exhibits} filing={s.filing} banner={t('versus.review.banner')} />
      </PaperSection>
      <section className={styles.reviewBar} aria-labelledby="approve-title">
        <div>
          <h2 id="approve-title" className={styles.panelSubtitle}>
            {t('versus.review.question', { agent: agentName(side) })}
          </h2>
          <p className={styles.muted}>
            {t('versus.review.frozen', {
              status: themStatus.approvedDraft ? t('versus.review.themApproved', { side: letter(them) }) : t('versus.review.themPending', { side: letter(them) }),
            })}
          </p>
          {s.balance && <BalanceMeter scores={s.balance.scores} ok={s.balance.ok} />}
        </div>
        <div className={styles.reviewBarActions}>
          {me.approvedDraft ? (
            <Badge tone="success" dot>
              {t('versus.review.approved')}
            </Badge>
          ) : (
            <>
              <Dialog>
                <DialogTrigger asChild>
                  <PaperButton variant="maroon" disabled={me.redraftsLeft === 0} iconStart={<Icon name="refresh" />}>
                    {me.redraftsLeft === 0 ? t('versus.redraft.used') : t('versus.redraft.mine')}
                  </PaperButton>
                </DialogTrigger>
                <DialogContent
                  title={t('versus.redraft.title', { agent: agentName(side) })}
                  description={t('versus.redraft.description', { other: agentName(them) })}
                  size="sm"
                  footer={
                    <>
                      <DialogClose asChild>
                        <PaperButton variant="ghost">{t('versus.redraft.keep')}</PaperButton>
                      </DialogClose>
                      <DialogClose asChild>
                        <PaperButton onClick={() => void run(() => desk.requestRedraft(c.trialId, side), { success: t('versus.draft.redrafting', { agent: agentName(side) }) })}>
                          {t('versus.redraft.confirm')}
                        </PaperButton>
                      </DialogClose>
                    </>
                  }
                />
              </Dialog>
              <PaperButton
                size="lg"
                iconStart={<Icon name="check" />}
                onClick={() => void run(() => desk.approveDraft(c.trialId, side), { success: t('versus.review.approveSuccess') })}
              >
                {t('versus.review.approve')}
              </PaperButton>
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
    <PaperSection as="section" padding="lg" ribbon={t('versus.fund.ribbon')} aria-labelledby="fund-title">
      <div className={styles.fundGrid}>
        <div>
          <h2 id="fund-title" className={styles.panelTitle}>
            {t('versus.fund.title')}
          </h2>
          <p className={styles.muted}>
            {t('versus.fund.body')} <TestnetBadge />
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
              <dt>{t('versus.fund.youPay')}</dt>
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
                  {t('versus.exhibits.sideBadge', { side: letter(x) })}
                  {x === side && t('versus.fund.you')}
                </span>
                <Badge tone={st.paid ? 'success' : 'neutral'} dot={!st.paid ? 'pulse' : true}>
                  {st.paid ? t('versus.rail.chip.paid') : t('versus.fund.waiting')}
                </Badge>
              </div>
            );
          })}
        </div>
      </div>

      {me.paid ? (
        <Alert tone="success" title={t('versus.fund.escrow')}>
          {themStatus.paid ? t('versus.fund.bothIn') : t('versus.fund.waitingFor', { side: letter(them), amount: formatAmount(mine.total) })}
        </Alert>
      ) : (
        <div className={styles.payRow}>
          <p className={styles.balanceLine}>
            {t('versus.fund.wallet')} <Amount value={balance} size="sm" />
          </p>
          {short && (
            <PaperButton variant="maroon" iconStart={<Icon name="plus" />} onClick={() => void run(() => desk.faucet(usdc('5.00')), { success: t('versus.fund.faucetSuccess') })}>
              {t('versus.fund.faucet')}
            </PaperButton>
          )}
          <Button
            size="lg"
            variant="swear"
            disabled={short}
            iconStart={<Icon name="scales" />}
            onClick={() => void run(() => desk.fund(c.trialId), { success: t('versus.fund.paid', { amount: formatAmount(mine.total) }) })}
          >
            {t('versus.fund.pay', { amount: formatAmount(mine.total) })}
          </Button>
        </div>
      )}
      <p className={styles.fine}>{t('versus.fund.fine')}</p>
      <div className={styles.panelFooter}>
        <WithdrawButton c={c} side={side} paid={me.paid} />
      </div>
    </PaperSection>
  );
}
