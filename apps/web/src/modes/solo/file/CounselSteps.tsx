import { useEffect, useState } from 'react';
import { CHARACTER_NAMES, formatUsdc, type ClosedState, type CounselState, type Usdc } from '@cringe-court/core';
import { PASS_ENABLED, SEGMENT_TITLES, isDemoTerms, outcomePreviews, soloQuote, type SoloSession, type SoloSnapshot } from '@cringe-court/modes-solo';
import { CANCEL_LABELS } from '@cringe-court/core';
import { Alert, Amount, Badge, Button, EmptyState, ErrorState, Icon, LoadingState, PaperButton, PaperPanel, PaperRibbon, Portrait, Switch, TestnetBadge } from '@/ds';
import styles from './FilePage.module.css';

const DRAFTING_LINES = [
  'Miss Ratio is sharpening her objections…',
  'Counsel Chaos is rehearsing “let bro cook” in the mirror…',
  'Judge Gavel.exe is polishing the gavel…',
  'Both lawyers get the same model and the same budget. Fair is fair (D1).',
];

/** Step 3: both lawyers draft; the balance gate runs before you can see it. */
export function DraftingStep({ session, snap }: { session: SoloSession; snap: SoloSnapshot & { trial: CounselState } }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % DRAFTING_LINES.length), 2200);
    return () => window.clearInterval(id);
  }, []);
  if (snap.error) {
    return (
      <ErrorState title="Counsel could not finish the draft" headingLevel={2} details={snap.error.message} onRetry={() => void session.retryDraft()} retryLabel="Try drafting again">
        Nothing has been charged. If it keeps failing, start over: you can file again any time.
      </ErrorState>
    );
  }
  return (
    <LoadingState title={snap.trial.attempt > 1 ? 'Redrafting your defense' : 'Counsel is preparing the case'} character="defense" expression="smug">
      <span>{DRAFTING_LINES[i]}</span>
    </LoadingState>
  );
}

function BalanceMeter({ scores }: { scores: readonly [number, number] }) {
  return (
    <div className={styles.balance}>
      {(['prosecutor', 'defense'] as const).map((c, b) => (
        <div key={c} className={styles.balanceRow}>
          <span>{CHARACTER_NAMES[c]}</span>
          <meter min={0} max={1} low={0.6} optimum={1} value={scores[b]} aria-label={`${CHARACTER_NAMES[c]} argument strength`}>
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
  const t = snap.trial;
  const used = t.redraftsUsed.a ?? 0;
  const left = t.rules.redraftsPerSide - used;
  const lines = t.draft?.lines ?? [];
  const segments = [...new Set(lines.map((l) => l.segment))];
  return (
    <div className={styles.review}>
      <header className={styles.stepHead}>
        <p className={styles.eyebrow}>Step 4 of 5</p>
        <PaperRibbon as="h2" className={styles.stepTitle}>
          Review the script
        </PaperRibbon>
        <p className={styles.lede}>
          This is exactly what the jury will watch. Approve it to freeze it (it gets a fingerprint before anyone pays), or send Counsel Chaos back
          for one redraft.
        </p>
      </header>
      {t.balance && (
        <PaperPanel as="section" edge="cut" elevation={2} aria-labelledby="balance-title">
          <div className={styles.panelStack}>
            <header>
              <p className={styles.eyebrow}>Fairness gate (D1)</p>
              <h3 id="balance-title" className={styles.panelTitle}>
                Both sides got a real argument
              </h3>
            </header>
            <BalanceMeter scores={t.balance.scores} />
            {t.autoRedraftsUsed > 0 && <p className={styles.small}>The first draft was lopsided, so the court redrafted the weaker side once.</p>}
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
          Freeze the transcript
        </PaperButton>
        <PaperButton size="lg" variant="maroon" disabled={left <= 0} loading={snap.busy === 'drafting'} onClick={() => void session.redraft()} iconStart={<Icon name="refresh" />}>
          {left > 0 ? 'Redraft my defense (1 left)' : 'Redraft used'}
        </PaperButton>
        <Button size="lg" variant="ghost" onClick={() => session.withdraw()}>
          Withdraw (free)
        </Button>
      </div>
      {snap.error && (
        <Alert tone="warning" title="Not possible" live="assertive">
          {snap.error.message}
        </Alert>
      )}
    </div>
  );
}

/** Step 5: pay 1.20 test USDC. Everything the money does is on this screen first. */
export function PayStep({ session, snap, balance }: { session: SoloSession; snap: SoloSnapshot & { trial: CounselState }; balance: Usdc | null }) {
  const t = snap.trial;
  const quote = soloQuote(t.terms);
  const previews = outcomePreviews(t.terms);
  const short = balance !== null && balance < quote.total;
  return (
    <div className={styles.pay}>
      <header className={styles.stepHead}>
        <p className={styles.eyebrow}>Step 5 of 5</p>
        <PaperRibbon as="h2" className={styles.stepTitle}>
          Take it to a jury <TestnetBadge />
        </PaperRibbon>
        <p className={styles.lede}>
          Transcript frozen · fingerprint <span className={styles.mono}>{t.transcript ? `${t.transcript.hash.slice(0, 10)}…${t.transcript.hash.slice(-6)}` : '—'}</span>
        </p>
      </header>
      <div className={styles.payGrid}>
        <PaperPanel as="section" edge="cut" elevation={3} backing="gold" aria-labelledby="price-title">
          <div className={styles.panelStack}>
            <header>
              <p className={styles.eyebrow}>One case, one price</p>
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
                <dt>Total</dt>
                <dd>
                  <Amount value={quote.total} size="lg" />
                </dd>
              </div>
            </dl>
            <Switch
              label="0G Compute Pass: bring your own AI credits (−0.20)"
              description={PASS_ENABLED ? 'Your own 0G credits pay for both lawyers.' : 'Coming once delegated 0G credits are confirmed safe (D12). Off for now.'}
              checked={false}
              onCheckedChange={() => {}}
              disabled={!PASS_ENABLED}
            />
          </div>
        </PaperPanel>
        <PaperPanel as="section" edge="cut" elevation={2} aria-labelledby="outcomes-title">
          <div className={styles.panelStack}>
            <header>
              <p className={styles.eyebrow}>Before you pay</p>
              <h3 id="outcomes-title" className={styles.panelTitle}>
                What happens to your {formatUsdc(quote.total, { unit: false })}
              </h3>
            </header>
            <table className={styles.outcomes}>
              <thead>
                <tr>
                  <th scope="col">If the case ends in…</th>
                  <th scope="col">You get back</th>
                  <th scope="col">Court keeps</th>
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
            <p className={styles.small}>The jury pool pays jurors who vote and reveal on time. Prices are fixed for this case once it opens.</p>
          </div>
        </PaperPanel>
      </div>
      {isDemoTerms(t.terms) && (
        <Alert tone="info" title="Demo court">
          You pay from a demo wallet with free test USDC on an in-browser twin of the Arc testnet contract. Jurors are NPCs and deadlines are demo
          settings.
        </Alert>
      )}
      {snap.error && (
        <Alert tone="danger" title="Payment did not go through" live="assertive">
          {snap.error.message}
        </Alert>
      )}
      <div className={styles.formActions}>
        <PaperButton size="lg" onClick={() => void session.pay()} loading={snap.busy === 'paying'} disabled={short}>
          Pay {formatUsdc(quote.total)} and open the case
        </PaperButton>
        <Button size="lg" variant="ghost" onClick={() => session.withdraw()}>
          Withdraw (free)
        </Button>
        {balance !== null && (
          <p className={styles.small}>
            Demo wallet: <Amount value={balance} size="sm" /> {short && <Badge tone="danger">Not enough test USDC</Badge>}
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
      title={trial.reason === 'withdrawn' ? 'Case withdrawn' : 'Case dismissed'}
      character="judge"
      expression={trial.reason === 'withdrawn' ? 'neutral' : 'shocked'}
      headingLevel={2}
      actions={
        <PaperButton onClick={onRestart} iconStart={<Icon name="plus" />}>
          File a new confession
        </PaperButton>
      }
    >
      {reason}. Nothing was charged{trial.caseNumber ? '; any payment is refunded in full' : ''}.
    </EmptyState>
  );
}
