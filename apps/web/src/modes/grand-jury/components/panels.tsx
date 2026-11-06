import { subUsdc, usdc, type BallotChoice, type Usdc } from '@cringe-court/core';
import { ballotLabel, formatAmount } from '@/i18n/domain';
import { galleryPercents, targetBreakdown, type CaseDetail } from '@cringe-court/modes-grand-jury';
import { useId, useState, type FormEvent } from 'react';
import { Alert, Amount, Button, Countdown, Dialog, DialogContent, Icon, PaperButton, Receipt, TextArea, PaperField, useToast } from '@/ds';
import { t, tRich } from '@/i18n';
import { useCourtContext } from '../state/context';
import { useAction, useCourtNowMs } from '../state/hooks';
import { fundingPromise, sound } from '../lib';
import styles from '../GrandJury.module.css';
import { BallotChip, CourtPanel, FundingMeter, JuryBox } from './parts';

/** Only real explorer links are shown; the demo ledger's memory:// receipts are not links. */
const explorer = (url?: string) => (url?.startsWith('https://') ? url : undefined);

function parseAmount(raw: string): Usdc | null {
  const s = raw.trim().replace(/^\./, '0.');
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(s)) return null;
  try {
    return usdc(s);
  } catch {
    return null;
  }
}

/** "You sealed [chip]. Only you can see this." with the chosen position as a coloured chip. */
function SealedNote({ bench, choice }: { bench: 0 | 1; choice: string }) {
  return <>{tRich('grandJury.sealed.note', { chip: (chunk) => <BallotChip bench={bench}>{chunk}</BallotChip> }, { choice })}</>;
}

/* ── Summon the court (D9) ─────────────────────────────────────────────── */

export function FundingPanel({ detail }: { detail: CaseDetail }) {
  const { demo } = useCourtContext();
  const { toast } = useToast();
  const remaining = subUsdc(detail.target, detail.raised);
  const min = detail.terms.funding.kind === 'crowdfund' ? detail.terms.funding.minContribution : usdc('0.10');
  const [raw, setRaw] = useState('0.50');
  const [touched, setTouched] = useState(false);
  const amount = parseAmount(raw);
  const fieldId = useId();
  const action = useAction((a: Usdc) => demo.court.contribute(detail.caseNumber, a));
  const b = targetBreakdown(detail.terms);

  const invalid =
    amount === null
      ? t('grandJury.fund.invalid.amount')
      : amount > remaining
        ? t('grandJury.fund.invalid.max', { left: formatAmount(remaining) })
        : amount < min && amount !== remaining
          ? t('grandJury.fund.invalid.min', { min: formatAmount(min) })
          : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid || amount === null) return;
    const r = await action.run(amount);
    if (r.ok) {
      sound({ type: 'bond.posted' });
      toast({ tone: 'success', title: t('grandJury.fund.toast.title', { amount: formatAmount(amount) }), description: t('grandJury.fund.toast.body') });
      setTouched(false);
    }
  };

  const quick: { label: string; value: Usdc }[] = [
    { label: '0.10', value: usdc('0.10') },
    { label: '0.50', value: usdc('0.50') },
    { label: '1.00', value: usdc('1.00') },
  ].filter((q) => q.value <= remaining);

  return (
    <CourtPanel id="summon-title" tone="cream" backing="gold" className={styles.actionCard} eyebrow={t('grandJury.fund.eyebrow')} title={t('grandJury.fund.title')}>
      <FundingMeter raised={detail.raised} target={detail.target} summoners={detail.summoners} />
      {detail.viewer.contributed > 0n && (
        <p className={styles.youNote}>
          <Icon name="check" /> {t('grandJury.fund.chipped', { amount: formatAmount(detail.viewer.contributed) })}
        </p>
      )}
      <form onSubmit={submit} className={styles.fundForm} noValidate>
        <fieldset className={styles.quickAmounts}>
          <legend className={styles.quickLegend}>{t('grandJury.fund.quick')}</legend>
          {quick.map((q) => (
            <Button key={q.label} type="button" size="sm" variant={raw === q.label ? 'primary' : 'secondary'} aria-pressed={raw === q.label} onClick={() => setRaw(q.label)}>
              {q.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant={raw === formatAmount(remaining, { unit: false }) ? 'primary' : 'secondary'}
            aria-pressed={raw === formatAmount(remaining, { unit: false })}
            onClick={() => setRaw(formatAmount(remaining, { unit: false }))}
          >
            {t('grandJury.fund.fillRest')}
          </Button>
        </fieldset>
        <PaperField
          id={fieldId}
          label={t('grandJury.fund.field')}
          icon="sparkle"
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => setTouched(true)}
          hint={t('grandJury.fund.hint', { min: formatAmount(min), left: formatAmount(remaining) })}
          error={touched ? (invalid ?? undefined) : undefined}
        />
        {action.error && (
          <Alert tone="danger" title={t('grandJury.fund.error')} live="assertive">
            {action.error}
          </Alert>
        )}
        <PaperButton type="submit" fullWidth loading={action.pending} iconStart={<Icon name="gavel" />}>
          {amount && !invalid ? t('grandJury.fund.submit', { amount: formatAmount(amount) }) : t('grandJury.fund.submitDefault')}
        </PaperButton>
      </form>
      <ul className={styles.promises}>
        <li>
          <Icon name="refresh" /> {fundingPromise('refund')}
        </li>
        <li>
          <Icon name="star" /> {fundingPromise('summoner')}
        </li>
        <li>
          <Icon name="scales" /> {fundingPromise('odds')}
        </li>
      </ul>
      <details className={styles.breakdown}>
        <summary>{t('grandJury.fund.breakdown.summary', { amount: formatAmount(b.target) })}</summary>
        <dl>
          <div>
            <dt>{t('grandJury.fund.breakdown.pool', { jurors: b.jurors, reward: formatAmount(b.rewardPerJuror, { unit: false }) })}</dt>
            <dd>
              <Amount value={b.juryPool} size="sm" />
            </dd>
          </div>
          <div>
            <dt>{t('grandJury.fund.breakdown.protocol')}</dt>
            <dd>
              <Amount value={b.protocolFee} size="sm" />
            </dd>
          </div>
          <div>
            <dt>{t('grandJury.fund.breakdown.ai')}</dt>
            <dd>
              <Amount value={b.aiFee} size="sm" />
            </dd>
          </div>
        </dl>
        <p>{t('grandJury.fund.breakdown.note')}</p>
      </details>
    </CourtPanel>
  );
}

/* ── Juror duty ────────────────────────────────────────────────────────── */

function ScreeningDialog({ open, onOpenChange, detail }: { open: boolean; onOpenChange: (o: boolean) => void; detail: CaseDetail }) {
  const { demo } = useCourtContext();
  const screen = useAction(() => demo.court.screen(detail.caseNumber));
  const offer = useAction(() => demo.court.requestSeat(detail.caseNumber));
  const busy = screen.pending || offer.pending;
  const verify = async () => {
    const r = await screen.run();
    if (!r.ok) return;
    const o = await offer.run();
    if (o.ok) {
      sound({ type: 'case.stamped' });
      onOpenChange(false);
    }
  };
  const error = screen.error ?? offer.error;
  const terminal = error === t('domain.screening.ineligible_level') || error === t('domain.screening.is_party');
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        title={t('grandJury.screening.title')}
        description={t('grandJury.screening.description')}
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('grandJury.screening.notNow')}
            </Button>
            {terminal ? null : (
              <PaperButton onClick={verify} loading={busy} iconStart={<Icon name="eye" />}>
                {error ? t('common.action.retry') : t('grandJury.screening.verify')}
              </PaperButton>
            )}
          </>
        }
      >
        <ul className={styles.screeningList}>
          <li>
            <Icon name="lock" /> {t('grandJury.screening.privacy')}
          </li>
          <li>
            <Icon name="user" /> {t('grandJury.screening.unique')}
          </li>
          <li>
            <Icon name="info" /> {t('grandJury.screening.honest')}
          </li>
        </ul>
        <p className={styles.demoNote}>
          <Icon name="gear" /> {t('grandJury.screening.demo')}
        </p>
        {error && (
          <Alert tone="danger" title={t('grandJury.screening.failed')} live="assertive">
            {error}
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BallotForm({ detail }: { detail: CaseDetail }) {
  const { demo } = useCourtContext();
  const { toast } = useToast();
  const [choice, setChoice] = useState<BallotChoice | null>(null);
  const seal = useAction((c: BallotChoice) => demo.court.seal(detail.caseNumber, c));
  const name = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (choice === null) return;
    const r = await seal.run(choice);
    if (r.ok) {
      toast({ tone: 'success', title: t('grandJury.ballot.sealed'), description: t('grandJury.ballot.toastBody') });
    }
  };
  return (
    <form onSubmit={submit} className={styles.ballotForm}>
      <fieldset className={styles.ballotOptions}>
        <legend className={styles.ballotLegend}>{t('grandJury.ballot.legend')}</legend>
        {([0, 1] as const).map((b) => (
          <label key={b} className={styles.ballotOption} data-bench={b} data-checked={choice === b || undefined}>
            <input type="radio" name={name} value={b} checked={choice === b} onChange={() => setChoice(b)} />
            <span className={styles.ballotOptionTitle}>{ballotLabel(detail.ballot[b])}</span>
            <span className={styles.ballotOptionSummary}>{detail.file.positions[b].summary}</span>
          </label>
        ))}
      </fieldset>
      {seal.error && (
        <Alert tone="danger" title={t('grandJury.ballot.error')} live="assertive">
          {seal.error}
        </Alert>
      )}
      <PaperButton type="submit" variant="maroon" fullWidth disabled={choice === null} loading={seal.pending} iconStart={<Icon name="lock" />}>
        {t('grandJury.ballot.seal')}
      </PaperButton>
      <p className={styles.fineprint}>{t('grandJury.ballot.fineprint')}</p>
    </form>
  );
}

function ScrollBox({ scroll }: { scroll: string }) {
  const { toast } = useToast();
  const id = useId();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(scroll);
      toast({ tone: 'success', title: t('grandJury.scroll.copied.title'), description: t('grandJury.scroll.copied.body') });
    } catch {
      toast({ tone: 'warning', title: t('grandJury.share.copyFailed.title'), description: t('grandJury.scroll.copyFailed.body') });
    }
  };
  const download = () => {
    const blob = new Blob([scroll], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'secret-verdict-scroll.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className={styles.scroll}>
      <label htmlFor={id} className={styles.scrollLabel}>
        <Icon name="document" /> {t('grandJury.scroll.label')}
      </label>
      <textarea id={id} readOnly value={scroll} rows={3} className={styles.scrollText} onFocus={(e) => e.currentTarget.select()} />
      <div className={styles.scrollActions}>
        <Button size="sm" variant="secondary" onClick={copy} iconStart={<Icon name="copy" />}>
          {t('grandJury.scroll.copy')}
        </Button>
        <Button size="sm" variant="ghost" onClick={download} iconStart={<Icon name="arrow-right" />}>
          {t('common.action.download')}
        </Button>
      </div>
      <p className={styles.fineprint}>{t('grandJury.scroll.fineprint')}</p>
    </div>
  );
}

function RevealForm({ detail }: { detail: CaseDetail }) {
  const { demo } = useCourtContext();
  const { toast } = useToast();
  const [scroll, setScroll] = useState('');
  const reveal = useAction((s?: string) => demo.court.reveal(detail.caseNumber, s));
  const open = async (e: FormEvent) => {
    e.preventDefault();
    const r = await reveal.run(detail.viewer.hasSalt ? undefined : scroll);
    if (r.ok) {
      toast({ tone: 'success', title: t('grandJury.reveal.opened'), description: t('grandJury.reveal.toastBody', { choice: ballotLabel(detail.ballot[r.value]) }) });
    }
  };
  return (
    <form onSubmit={open} className={styles.ballotForm}>
      {detail.viewer.hasSalt ? (
        <p className={styles.sealedNote}>
          <Icon name="lock" /> <SealedNote bench={detail.viewer.sealedChoice ?? 0} choice={ballotLabel(detail.ballot[detail.viewer.sealedChoice ?? 0])} />
        </p>
      ) : (
        <TextArea label={t('grandJury.reveal.pasteLabel')} hint={t('grandJury.reveal.pasteHint')} value={scroll} onChange={(e) => setScroll(e.target.value)} rows={3} />
      )}
      {reveal.error && (
        <Alert tone="danger" title={t('grandJury.reveal.error')} live="assertive">
          {reveal.error}
        </Alert>
      )}
      <PaperButton type="submit" variant="maroon" fullWidth loading={reveal.pending} disabled={!detail.viewer.hasSalt && !scroll.trim()} iconStart={<Icon name="unlock" />}>
        {t('grandJury.reveal.open')}
      </PaperButton>
      <p className={styles.fineprint}>{t('grandJury.reveal.fineprint')}</p>
    </form>
  );
}

export function JurorPanel({ detail }: { detail: CaseDetail }) {
  const { demo } = useCourtContext();
  const { toast } = useToast();
  const nowMs = useCourtNowMs();
  const [screening, setScreening] = useState(false);
  const accept = useAction(() => demo.court.acceptSeat(detail.caseNumber));
  const decline = useAction(() => demo.court.declineSeat(detail.caseNumber));
  const settle = useAction(() => demo.court.settle(detail.caseNumber));
  const v = detail.viewer;
  const full = detail.seats.filled >= detail.seats.total;

  const swear = async () => {
    const r = await accept.run();
    if (r.ok) {
      toast({ tone: 'success', title: t('grandJury.juror.toast.title'), description: t('grandJury.juror.toast.body', { bond: formatAmount(detail.terms.bondPerJuror) }) });
    }
  };

  let eyebrow = t('grandJury.juror.eyebrow');
  let title = t('grandJury.juror.title');
  let body: React.ReactNode;

  if (detail.phase === 'recruiting') {
    if (v.seat !== null) {
      title = t('grandJury.juror.seat.title', { n: v.seat });
      body = <p className={styles.panelLede}>{t('grandJury.juror.seat.lede')}</p>;
    } else if (v.isSponsor) {
      body = <Alert title={t('grandJury.juror.sponsor.title')}>{t('grandJury.juror.sponsor.body')}</Alert>;
    } else if (v.offer) {
      title = t('grandJury.juror.offer.title');
      body = (
        <>
          <p className={styles.panelLede}>
            {tRich(
              'grandJury.juror.offer.lede',
              { b: (chunk) => <strong>{chunk}</strong> },
              { bond: formatAmount(detail.terms.bondPerJuror), reward: formatAmount(detail.terms.successBonusPerJuror) },
            )}
          </p>
          <Countdown label={t('grandJury.juror.offer.expires')} startsAt={(v.offer.expiresAt - 180) * 1000} endsAt={v.offer.expiresAt * 1000} now={nowMs} compact />
          {accept.error && (
            <Alert tone="danger" title={t('grandJury.juror.offer.error')} live="assertive">
              {accept.error}
            </Alert>
          )}
          <div className={styles.buttonRow}>
            <PaperButton variant="maroon" onClick={swear} loading={accept.pending} iconStart={<Icon name="gavel" />}>
              {t('grandJury.juror.offer.swear')}
            </PaperButton>
            <Button variant="ghost" onClick={() => void decline.run()} disabled={accept.pending}>
              {t('grandJury.juror.offer.decline')}
            </Button>
          </div>
        </>
      );
    } else if (full) {
      body = <p className={styles.panelLede}>{t('grandJury.juror.full')}</p>;
    } else {
      body = (
        <>
          <p className={styles.panelLede}>
            {t('grandJury.juror.recruit.lede', { bond: formatAmount(detail.terms.bondPerJuror), reward: formatAmount(detail.terms.successBonusPerJuror) })}
          </p>
          <PaperButton fullWidth onClick={() => setScreening(true)} iconStart={<Icon name="user" />}>
            {t('grandJury.juror.recruit.volunteer')}
          </PaperButton>
          <p className={styles.fineprint}>{t('grandJury.juror.recruit.fineprint')}</p>
          <ScreeningDialog open={screening} onOpenChange={setScreening} detail={detail} />
        </>
      );
    }
  } else if (detail.phase === 'commit') {
    eyebrow = v.seat !== null ? t('grandJury.juror.commit.eyebrowSeat', { n: v.seat }) : t('grandJury.juror.commit.eyebrow');
    title = v.seat !== null ? (v.committed ? t('grandJury.ballot.sealed') : t('grandJury.juror.commit.sealTitle')) : t('grandJury.juror.commit.sealing');
    body =
      v.seat === null ? (
        <p className={styles.panelLede}>{t('grandJury.juror.commit.lede')}</p>
      ) : v.committed ? (
        <>
          {v.sealedChoice !== null && (
            <p className={styles.sealedNote}>
              <Icon name="lock" /> <SealedNote bench={v.sealedChoice} choice={ballotLabel(detail.ballot[v.sealedChoice])} />
            </p>
          )}
          {v.scroll && <ScrollBox scroll={v.scroll} />}
        </>
      ) : (
        <BallotForm detail={detail} />
      );
  } else if (detail.phase === 'reveal') {
    eyebrow = v.seat !== null ? t('grandJury.juror.reveal.eyebrowSeat', { n: v.seat }) : t('grandJury.juror.reveal.eyebrow');
    title = v.seat !== null ? (v.revealed ? t('grandJury.reveal.opened') : t('grandJury.juror.reveal.openTitle')) : t('grandJury.juror.reveal.opening');
    body =
      v.seat === null ? (
        <p className={styles.panelLede}>{t('grandJury.juror.reveal.lede')}</p>
      ) : v.revealed ? (
        <p className={styles.panelLede}>{t('grandJury.juror.reveal.counted')}</p>
      ) : v.committed ? (
        <RevealForm detail={detail} />
      ) : (
        <Alert tone="warning" title={t('grandJury.juror.reveal.missed.title')}>
          {t('grandJury.juror.reveal.missed.body')}
        </Alert>
      );
  } else if (detail.phase === 'finalizing') {
    eyebrow = t('grandJury.juror.settle.eyebrow');
    title = t('grandJury.juror.settle.title');
    body = (
      <>
        <p className={styles.panelLede}>{t('grandJury.juror.settle.lede')}</p>
        {settle.error && (
          <Alert tone="danger" title={t('grandJury.juror.settle.error')} live="assertive">
            {settle.error}
          </Alert>
        )}
        <PaperButton fullWidth loading={settle.pending} onClick={() => void settle.run()} iconStart={<Icon name="scales" />}>
          {t('grandJury.juror.settle.button')}
        </PaperButton>
      </>
    );
  } else {
    return null;
  }

  return (
    <CourtPanel id="duty-title" tone="cream" backing="gold" className={styles.actionCard} eyebrow={eyebrow} title={title}>
      <JuryBox entry={detail} viewerSeat={v.seat} />
      {body}
    </CourtPanel>
  );
}

/* ── Claims ────────────────────────────────────────────────────────────── */

export function ClaimPanel({ detail }: { detail: CaseDetail }) {
  const { demo } = useCourtContext();
  const { toast } = useToast();
  const claim = useAction(() => demo.court.claim(detail.caseNumber));
  const c = detail.viewer.claim;
  if (!c) return null;
  const refund = c.lines.some((l) => l.kind === 'refund');
  const run = async () => {
    const r = await claim.run();
    if (r.ok) {
      sound({ type: 'settlement', kind: refund ? 'refund' : 'payout' });
      toast({ tone: 'success', title: t('grandJury.claim.toast.title', { amount: formatAmount(c.amount) }), description: t('grandJury.claim.toast.body') });
    }
  };
  return (
    <CourtPanel
      id="claim-title"
      tone="cream"
      className={styles.actionCard}
      eyebrow={c.claimed ? t('grandJury.claim.eyebrow.done') : t('grandJury.claim.eyebrow.ready')}
      title={refund ? t('grandJury.claim.title.refund') : t('grandJury.claim.title.payout')}
    >
      <Receipt
        caseNumber={detail.caseNumber}
        title={refund ? t('grandJury.claim.receipt.refund') : t('grandJury.claim.receipt.payout')}
        lines={c.lines}
        explorerUrl={explorer()}
        note={refund ? t('grandJury.claim.note.refund') : t('grandJury.claim.note.payout')}
      />
      {c.amount > 0n &&
        (c.claimed ? (
          <p className={styles.youNote}>
            <Icon name="check" /> {t('grandJury.claim.collected')}
          </p>
        ) : (
          <>
            {claim.error && (
              <Alert tone="danger" title={t('grandJury.claim.error')} live="assertive">
                {claim.error}
              </Alert>
            )}
            <PaperButton fullWidth loading={claim.pending} onClick={run} iconStart={<Icon name="sparkle" />}>
              {t('grandJury.claim.button', { amount: formatAmount(c.amount) })}
            </PaperButton>
          </>
        ))}
    </CourtPanel>
  );
}

/* ── The gallery (D11) ─────────────────────────────────────────────────── */

export function GalleryPanel({ detail }: { detail: CaseDetail }) {
  const { demo } = useCourtContext();
  const vote = useAction((c: BallotChoice) => demo.court.galleryVote(detail.caseNumber, c));
  const v = detail.viewer;
  const tally = detail.gallery.tally;
  const pct = tally ? galleryPercents(tally) : null;
  const cast = async (c: BallotChoice) => {
    const r = await vote.run(c);
    if (r.ok) sound({ type: 'crowd', reaction: 'murmur' });
  };
  return (
    <CourtPanel id="gallery-title" tone="kraft" elevation={1} eyebrow={t('grandJury.gallery.eyebrow')} title={t('grandJury.gallery.title')}>
      {pct && tally ? (
        <>
          <p className={styles.panelLede}>{t('grandJury.gallery.says', { count: tally.total })}</p>
          <div className={styles.galleryBars}>
            {([0, 1] as const).map((b) => (
              <div key={b} className={styles.galleryBar} data-bench={b}>
                <span className={styles.galleryBarLabel}>
                  {ballotLabel(detail.ballot[b])}
                  {v.galleryVote === b && <span className={styles.yourPick}> {t('grandJury.gallery.yourCall')}</span>}
                </span>
                <span className={styles.galleryTrack} aria-hidden>
                  <span className={styles.galleryFill} style={{ ['--_pct' as string]: `${pct[b]}%` }} />
                </span>
                <span className={styles.galleryPct}>{pct[b]}%</span>
              </div>
            ))}
          </div>
        </>
      ) : v.galleryVote !== null ? (
        <p className={styles.panelLede}>
          {tRich(
            'grandJury.gallery.called',
            { chip: (chunk) => <BallotChip bench={v.galleryVote!}>{chunk}</BallotChip> },
            { choice: ballotLabel(detail.ballot[v.galleryVote]), count: detail.gallery.total },
          )}
        </p>
      ) : v.galleryBlocked ? (
        <p className={styles.panelLede}>{v.galleryBlocked}</p>
      ) : v.galleryOpen ? (
        <>
          <p className={styles.panelLede}>{t('grandJury.gallery.make')}</p>
          <div className={styles.buttonRow}>
            {([0, 1] as const).map((b) => (
              <Button key={b} variant="secondary" onClick={() => void cast(b)} loading={vote.pending} className={styles.galleryButton} data-bench={b}>
                {ballotLabel(detail.ballot[b])}
              </Button>
            ))}
          </div>
          {vote.error && (
            <Alert tone="danger" title={t('grandJury.gallery.error')} live="assertive">
              {vote.error}
            </Alert>
          )}
        </>
      ) : (
        <p className={styles.panelLede}>{t('grandJury.gallery.closed')}</p>
      )}
    </CourtPanel>
  );
}
