import { useEffect, useState } from 'react';
import { CHARACTER_NAMES, formatUsdc, type ClosedState, type CounselState, type Usdc } from '@cringe-court/core';
import { PASS_ENABLED, SEGMENT_TITLES, isDemoTerms, outcomePreviews, soloQuote, type SoloSession, type SoloSnapshot } from '@cringe-court/modes-solo';
import { CANCEL_LABELS } from '@cringe-court/core';
import { Alert, Amount, Badge, Button, EmptyState, ErrorState, Icon, LoadingState, PaperButton, PaperPanel, PaperRibbon, Portrait, Switch, TestnetBadge } from '@/ds';
import { tRich, t, type MessageKey } from '@/i18n';
import styles from './FilePage.module.css';

const DRAFTING_LINES = ['solo.drafting.line1', 'solo.drafting.line2', 'solo.drafting.line3', 'solo.drafting.line4'] as const satisfies readonly MessageKey[];

/** Step 3: both lawyers draft; the balance gate runs before you can see it. */
export function DraftingStep({ session, snap }: { session: SoloSession; snap: SoloSnapshot & { trial: CounselState } }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % DRAFTING_LINES.length), 2200);
    return () => window.clearInterval(id);
  }, []);
  if (snap.error) {
    return (
      <ErrorState title={t('solo.drafting.error.title')} headingLevel={2} details={snap.error.message} onRetry={() => void session.retryDraft()} retryLabel={t('solo.drafting.error.retry')}>
        {t('solo.drafting.error.body')}
      </ErrorState>
    );
  }
  return (
    <LoadingState title={snap.trial.attempt > 1 ? t('solo.drafting.title.redraft') : t('solo.drafting.title.first')} character="defense" expression="smug">
      <span>{t(DRAFTING_LINES[i]!)}</span>
    </LoadingState>
  );
}

function BalanceMeter({ scores }: { scores: readonly [number, number] }) {
  return (
    <div className={styles.balance}>
      {(['prosecutor', 'defense'] as const).map((c, b) => (
        <div key={c} className={styles.balanceRow}>
          <span>{CHARACTER_NAMES[c]}</span>
          <meter min={0} max={1} low={0.6} optimum={1} value={scores[b]} aria-label={t('solo.review.fairness.strength', { name: CHARACTER_NAMES[c] })}>
            {Math.round(scores[b]! * 100)}%
          </meter>
          <span className={styles.mono}>{Math.round(scores[b]! * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

/** Step 4: read the frozen draft, redraft once (D2), approve to freeze. */
export function ReviewStep({ session, snap }: { session: SoloSession; snap: SoloSnapshot & { trial: CounselState } }) {
  const tState = snap.trial;
  const used = tState.redraftsUsed.a ?? 0;
  const left = tState.rules.redraftsPerSide - used;
  const lines = tState.draft?.lines ?? [];
  const segments = [...new Set(lines.map((l) => l.segment))];
  return (
    <div className={styles.review}>
      <header className={styles.stepHead}>
        <p className={styles.eyebrow}>{t('solo.file.stepOf', { n: 4, total: 5 })}</p>
        <PaperRibbon as="h2" className={styles.stepTitle}>
          {t('solo.review.title')}
        </PaperRibbon>
        <p className={styles.lede}>{t('solo.review.lede')}</p>
      </header>
      {tState.balance && (
        <PaperPanel as="section" edge="cut" elevation={2} aria-labelledby="balance-title">
          <div className={styles.panelStack}>
            <header>
              <p className={styles.eyebrow}>{t('solo.review.fairness.eyebrow')}</p>
              <h3 id="balance-title" className={styles.panelTitle}>
                {t('solo.review.fairness.heading')}
              </h3>
            </header>
            <BalanceMeter scores={tState.balance.scores} />
            {tState.autoRedraftsUsed > 0 && <p className={styles.small}>{t('solo.review.fairness.redrafted')}</p>}
          </div>
        </PaperPanel>
      )}
      <div className={styles.script}>
        {segments.map((seg) => (
          <section key={seg} aria-label={SEGMENT_TITLES[seg]} className={styles.scriptSection}>
            <h3 className={styles.scriptHead}>{SEGMENT_TITLES[seg]}</h3>
            <ol role="list" className={styles.scriptLines}>
              {lines
                .filter((l) => l.segment === seg)
                .map((l) => {
                  const who = l.speaker === 'prosecutor' ? 'prosecutor' : l.speaker === 'defense' ? 'defense' : 'judge';
                  return (
                    <li key={l.id} className={styles.scriptLine} data-side={who}>
                      <Portrait character={who} size="sm" alt="" />
                      <div>
                        <strong>{CHARACTER_NAMES[who]}</strong>
                        <p>{l.text}</p>
                      </div>
                    </li>
                  );
                })}
            </ol>
          </section>
        ))}
      </div>
      <div className={styles.formActions}>
        <PaperButton size="lg" onClick={() => session.approveDraft()} iconStart={<Icon name="lock" />}>
          {t('solo.review.freeze')}
        </PaperButton>
        <PaperButton size="lg" variant="maroon" disabled={left <= 0} loading={snap.busy === 'drafting'} onClick={() => void session.redraft()} iconStart={<Icon name="refresh" />}>
          {left > 0 ? t('solo.review.redraft.left') : t('solo.review.redraft.used')}
        </PaperButton>
        <Button size="lg" variant="ghost" onClick={() => session.withdraw()}>
          {t('solo.review.withdraw')}
        </Button>
      </div>
      {snap.error && (
        <Alert tone="warning" title={t('solo.review.error.title')} live="assertive">
          {snap.error.message}
        </Alert>
      )}
    </div>
  );
}

/** Step 5: pay 1.20 test USDC. Everything the money does is on this screen first. */
export function PayStep({ session, snap, balance }: { session: SoloSession; snap: SoloSnapshot & { trial: CounselState }; balance: Usdc | null }) {
  const tState = snap.trial;
  const quote = soloQuote(tState.terms);
  const previews = outcomePreviews(tState.terms);
  const short = balance !== null && balance < quote.total;
  return (
    <div className={styles.pay}>
      <header className={styles.stepHead}>
        <p className={styles.eyebrow}>{t('solo.file.stepOf', { n: 5, total: 5 })}</p>
        <PaperRibbon as="h2" className={styles.stepTitle}>
          {t('solo.pay.title')} <TestnetBadge />
        </PaperRibbon>
        <p className={styles.lede}>
          {tRich('solo.pay.fingerprint', { hash: (c) => <span className={styles.mono}>{c}</span> }, { hash: tState.transcript ? `${tState.transcript.hash.slice(0, 10)}…${tState.transcript.hash.slice(-6)}` : '—' })}
        </p>
      </header>
      <div className={styles.payGrid}>
        <PaperPanel as="section" edge="cut" elevation={3} backing="gold" aria-labelledby="price-title">
          <div className={styles.panelStack}>
            <header>
              <p className={styles.eyebrow}>{t('solo.pay.price.eyebrow')}</p>
              <h3 id="price-title" className={styles.panelTitle}>
                {formatUsdc(quote.total)}
              </h3>
            </header>
            <dl className={styles.quote}>
              {quote.lines.map((l) => (
                <div key={l.id}>
                  <dt>
                    {l.label}
                    <span>{l.detail}</span>
                  </dt>
                  <dd>
                    <Amount value={l.amount} />
                  </dd>
                </div>
              ))}
              <div className={styles.quoteTotal}>
                <dt>{t('solo.pay.total')}</dt>
                <dd>
                  <Amount value={quote.total} size="lg" />
                </dd>
              </div>
            </dl>
            <Switch
              label={t('solo.pay.pass.label')}
              description={PASS_ENABLED ? t('solo.pay.pass.on') : t('solo.pay.pass.off')}
              checked={false}
              onCheckedChange={() => {}}
              disabled={!PASS_ENABLED}
            />
          </div>
        </PaperPanel>
        <PaperPanel as="section" edge="cut" elevation={2} aria-labelledby="outcomes-title">
          <div className={styles.panelStack}>
            <header>
              <p className={styles.eyebrow}>{t('solo.pay.outcomes.eyebrow')}</p>
              <h3 id="outcomes-title" className={styles.panelTitle}>
                {t('solo.pay.outcomes.heading', { amount: formatUsdc(quote.total, { unit: false }) })}
              </h3>
            </header>
            <table className={styles.outcomes}>
              <thead>
                <tr>
                  <th scope="col">{t('solo.pay.outcomes.col.outcome')}</th>
                  <th scope="col">{t('solo.pay.outcomes.col.refund')}</th>
                  <th scope="col">{t('solo.pay.outcomes.col.keeps')}</th>
                </tr>
              </thead>
              <tbody>
                {previews.map((p) => (
                  <tr key={p.outcome}>
                    <th scope="row">{p.title}</th>
                    <td>
                      <Amount value={p.filerRefund} size="sm" />
                    </td>
                    <td>
                      <Amount value={p.courtKeeps} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.small}>{t('solo.pay.outcomes.note')}</p>
          </div>
        </PaperPanel>
      </div>
      {isDemoTerms(tState.terms) && (
        <Alert tone="info" title={t('solo.pay.demo.title')}>
          {t('solo.pay.demo.body')}
        </Alert>
      )}
      {snap.error && (
        <Alert tone="danger" title={t('solo.pay.error.title')} live="assertive">
          {snap.error.message}
        </Alert>
      )}
      <div className={styles.formActions}>
        <PaperButton size="lg" onClick={() => void session.pay()} loading={snap.busy === 'paying'} disabled={short}>
          {t('solo.pay.cta', { amount: formatUsdc(quote.total) })}
        </PaperButton>
        <Button size="lg" variant="ghost" onClick={() => session.withdraw()}>
          {t('solo.review.withdraw')}
        </Button>
        {balance !== null && (
          <p className={styles.small}>
            {t('solo.pay.wallet')} <Amount value={balance} size="sm" /> {short && <Badge tone="danger">{t('solo.pay.shortBadge')}</Badge>}
          </p>
        )}
      </div>
    </div>
  );
}

/** A case closed before payment (withdrawn, AI unfair/failed). Nothing was charged. */
export function DismissedStep({ trial, onRestart }: { trial: ClosedState; onRestart: () => void }) {
  const reason = CANCEL_LABELS[trial.reason];
  return (
    <EmptyState
      title={trial.reason === 'withdrawn' ? t('solo.dismissed.withdrawn') : t('solo.case.closed.title')}
      character="judge"
      expression={trial.reason === 'withdrawn' ? 'neutral' : 'shocked'}
      headingLevel={2}
      actions={
        <PaperButton onClick={onRestart} iconStart={<Icon name="plus" />}>
          {t('solo.dismissed.restart')}
        </PaperButton>
      }
    >
      {trial.caseNumber ? t('solo.dismissed.bodyRefunded', { reason }) : t('solo.dismissed.body', { reason })}
    </EmptyState>
  );
}
