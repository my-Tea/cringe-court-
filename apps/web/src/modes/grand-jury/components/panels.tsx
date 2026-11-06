import { formatUsdc, subUsdc, usdc, type BallotChoice, type Usdc } from '@cringe-court/core';
import { FUNDING_PROMISES, galleryPercents, targetBreakdown, type CaseDetail } from '@cringe-court/modes-grand-jury';
import { useId, useState, type FormEvent } from 'react';
import {
  Alert,
  Amount,
  Button,
  Countdown,
  Dialog,
  DialogContent,
  Icon,
  PaperButton,
  Receipt,
  TextArea,
  PaperField,
  useToast,
} from '@/ds';
import { useCourtContext } from '../state/context';
import { useAction, useCourtNowMs } from '../state/hooks';
import { sound } from '../lib';
import styles from '../GrandJury.module.css';
import { BallotChip, CourtPanel, FundingMeter, JuryBox } from './parts';

/** Only real explorer links are shown; the demo ledger's memory:// receipts are not links. */
const explorer = (url?: string) => (url?.startsWith('https://') ? url : undefined);

function parseAmount(raw: string): Usdc | null {
  const t = raw.trim().replace(/^\./, '0.');
  if (!/^\d{1,6}(\.\d{1,6})?$/.test(t)) return null;
  try {
    return usdc(t);
  } catch {
    return null;
  }
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
      ? 'Enter an amount like 0.50.'
      : amount > remaining
        ? `Only ${formatUsdc(remaining)} is left to raise.`
        : amount < min && amount !== remaining
          ? `Contributions start at ${formatUsdc(min)}.`
          : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (invalid || amount === null) return;
    const r = await action.run(amount);
    if (r.ok) {
      sound({ type: 'bond.posted' });
      toast({ tone: 'success', title: `You summoned the court with ${formatUsdc(amount)}`, description: 'Your Summoner credit is on the case page. Refunded in full if the trial does not happen.' });
      setTouched(false);
    }
  };

  const quick: { label: string; value: Usdc }[] = [
    { label: '0.10', value: usdc('0.10') },
    { label: '0.50', value: usdc('0.50') },
    { label: '1.00', value: usdc('1.00') },
  ].filter((q) => q.value <= remaining);

  return (
    <CourtPanel id="summon-title" tone="cream" backing="gold" className={styles.actionCard} eyebrow="Step 1 · Anyone can chip in" title="Summon the court">
        <FundingMeter raised={detail.raised} target={detail.target} summoners={detail.summoners} />
        {detail.viewer.contributed > 0n && (
          <p className={styles.youNote}>
            <Icon name="check" /> You have chipped in {formatUsdc(detail.viewer.contributed)}. Thanks, Summoner.
          </p>
        )}
        <form onSubmit={submit} className={styles.fundForm} noValidate>
          <fieldset className={styles.quickAmounts}>
            <legend className={styles.quickLegend}>Quick amounts (test USDC)</legend>
            {quick.map((q) => (
              <Button key={q.label} type="button" size="sm" variant={raw === q.label ? 'primary' : 'secondary'} aria-pressed={raw === q.label} onClick={() => setRaw(q.label)}>
                {q.label}
              </Button>
            ))}
            <Button type="button" size="sm" variant={raw === formatUsdc(remaining, { unit: false }) ? 'primary' : 'secondary'} aria-pressed={raw === formatUsdc(remaining, { unit: false })} onClick={() => setRaw(formatUsdc(remaining, { unit: false }))}>
              Fill the rest
            </Button>
          </fieldset>
          <PaperField
            id={fieldId}
            label="Your contribution (test USDC)"
            icon="sparkle"
            inputMode="decimal"
            autoComplete="off"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => setTouched(true)}
            hint={`From ${formatUsdc(min)}. ${formatUsdc(remaining)} left to raise.`}
            error={touched ? (invalid ?? undefined) : undefined}
          />
          {action.error && (
            <Alert tone="danger" title="That didn’t go through" live="assertive">
              {action.error}
            </Alert>
          )}
          <PaperButton type="submit" fullWidth loading={action.pending} iconStart={<Icon name="gavel" />}>
            Summon with {amount && !invalid ? formatUsdc(amount) : 'test USDC'}
          </PaperButton>
        </form>
        <ul className={styles.promises}>
          <li>
            <Icon name="refresh" /> {FUNDING_PROMISES.refund}
          </li>
          <li>
            <Icon name="star" /> {FUNDING_PROMISES.summoner}
          </li>
          <li>
            <Icon name="scales" /> {FUNDING_PROMISES.noOdds}
          </li>
        </ul>
        <details className={styles.breakdown}>
          <summary>Where the {formatUsdc(b.target)} goes</summary>
          <dl>
            <div>
              <dt>Jury pool ({b.jurors} × {formatUsdc(b.rewardPerJuror, { unit: false })})</dt>
              <dd>
                <Amount value={b.juryPool} size="sm" />
              </dd>
            </div>
            <div>
              <dt>Protocol fee</dt>
              <dd>
                <Amount value={b.protocolFee} size="sm" />
              </dd>
            </div>
            <div>
              <dt>AI counsel fee (0G Compute)</dt>
              <dd>
                <Amount value={b.aiFee} size="sm" />
              </dd>
            </div>
          </dl>
          <p>Fees are only kept when the trial reaches a verdict. Otherwise every summoner is refunded pro rata.</p>
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
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent
        title="Juror Screening"
        description="Before you take a paid seat, the court checks you are a real, unique person with World ID (Orb level)."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Not now
            </Button>
            <PaperButton onClick={verify} loading={busy} iconStart={<Icon name="eye" />}>
              {error ? 'Try again' : 'Verify with World ID'}
            </PaperButton>
          </>
        }
      >
        <ul className={styles.screeningList}>
          <li>
            <Icon name="lock" /> We never learn who you are. Nothing about your identity is shown to anyone.
          </li>
          <li>
            <Icon name="user" /> One human, one seat: the same person cannot sit twice on this jury, even with another wallet.
          </li>
          <li>
            <Icon name="info" /> Honest note: this proves you are one human. It does not prove you are impartial. That part is on you.
          </li>
        </ul>
        <p className={styles.demoNote}>
          <Icon name="gear" /> Demo build: a mock World ID verifier stands in for IDKit, the same flow the staging app uses.
        </p>
        {error && (
          <Alert tone="danger" title="Screening did not pass" live="assertive">
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
      sound({ type: 'ballot.committed' });
      toast({ tone: 'success', title: 'Ballot sealed', description: 'Keep your Secret Verdict Scroll. You will open it in the next window.' });
    }
  };
  return (
    <form onSubmit={submit} className={styles.ballotForm}>
      <fieldset className={styles.ballotOptions}>
        <legend className={styles.ballotLegend}>Your secret ballot</legend>
        {([0, 1] as const).map((b) => (
          <label key={b} className={styles.ballotOption} data-bench={b} data-checked={choice === b || undefined}>
            <input type="radio" name={name} value={b} checked={choice === b} onChange={() => setChoice(b)} />
            <span className={styles.ballotOptionTitle}>{detail.ballot[b]}</span>
            <span className={styles.ballotOptionSummary}>{detail.file.positions[b].summary}</span>
          </label>
        ))}
      </fieldset>
      {seal.error && (
        <Alert tone="danger" title="Ballot not sealed" live="assertive">
          {seal.error}
        </Alert>
      )}
      <PaperButton type="submit" variant="maroon" fullWidth disabled={choice === null} loading={seal.pending} iconStart={<Icon name="lock" />}>
        Seal my ballot
      </PaperButton>
      <p className={styles.fineprint}>Only a fingerprint of your vote goes on the ledger. The secret that opens it stays on this device.</p>
    </form>
  );
}

function ScrollBox({ scroll }: { scroll: string }) {
  const { toast } = useToast();
  const id = useId();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(scroll);
      toast({ tone: 'success', title: 'Scroll copied', description: 'Paste it somewhere private. It reveals your vote.' });
    } catch {
      toast({ tone: 'warning', title: 'Could not copy', description: 'Select the scroll text and copy it by hand.' });
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
        <Icon name="document" /> Secret Verdict Scroll
      </label>
      <textarea id={id} readOnly value={scroll} rows={3} className={styles.scrollText} onFocus={(e) => e.currentTarget.select()} />
      <div className={styles.scrollActions}>
        <Button size="sm" variant="secondary" onClick={copy} iconStart={<Icon name="copy" />}>
          Copy scroll
        </Button>
        <Button size="sm" variant="ghost" onClick={download} iconStart={<Icon name="arrow-right" />}>
          Download
        </Button>
      </div>
      <p className={styles.fineprint}>If this tab is lost, paste the scroll here during the reveal window and your bond is safe. Keep it secret until then.</p>
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
      sound({ type: 'ballot.revealed' });
      toast({ tone: 'success', title: 'Scroll opened', description: `Your vote for ${detail.ballot[r.value]} is counted. Your bond comes back at settlement.` });
    }
  };
  return (
    <form onSubmit={open} className={styles.ballotForm}>
      {detail.viewer.hasSalt ? (
        <p className={styles.sealedNote}>
          <Icon name="lock" /> You sealed <BallotChip bench={detail.viewer.sealedChoice ?? 0}>{detail.ballot[detail.viewer.sealedChoice ?? 0]}</BallotChip>. Only you can see this.
        </p>
      ) : (
        <TextArea
          label="Paste your Secret Verdict Scroll"
          hint="This device doesn’t have your sealed ballot. The scroll you saved when you sealed it opens it."
          value={scroll}
          onChange={(e) => setScroll(e.target.value)}
          rows={3}
        />
      )}
      {reveal.error && (
        <Alert tone="danger" title="Scroll not opened" live="assertive">
          {reveal.error}
        </Alert>
      )}
      <PaperButton type="submit" variant="maroon" fullWidth loading={reveal.pending} disabled={!detail.viewer.hasSalt && !scroll.trim()} iconStart={<Icon name="unlock" />}>
        Open my scroll
      </PaperButton>
      <p className={styles.fineprint}>Miss this window and the bond is forfeited (disclosed on the case page).</p>
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
      sound({ type: 'juror.seated', index: detail.seats.filled });
      toast({ tone: 'success', title: 'You are sworn in', description: `Bond of ${formatUsdc(detail.terms.bondPerJuror)} posted. Come back when the court is in session.` });
    }
  };

  let eyebrow = 'Step 2 · Verified humans only';
  let title = 'Join the jury';
  let body: React.ReactNode;

  if (detail.phase === 'recruiting') {
    if (v.seat !== null) {
      title = `You hold seat ${v.seat}`;
      body = <p className={styles.panelLede}>Your bond is in. The hearing opens and ballots start sealing as soon as all seven seats are filled.</p>;
    } else if (v.isSponsor) {
      body = <Alert title="Sponsors can’t serve">The sponsor of a case cannot sit on its jury.</Alert>;
    } else if (v.offer) {
      title = 'A seat is offered to you';
      body = (
        <>
          <p className={styles.panelLede}>
            You were drawn from the verified pool. Accepting posts a <strong>{formatUsdc(detail.terms.bondPerJuror)}</strong> bond. You get it back with a{' '}
            <strong>{formatUsdc(detail.terms.successBonusPerJuror)}</strong> reward if you seal and open your ballot on time.
          </p>
          <Countdown label="Offer expires" startsAt={(v.offer.expiresAt - 180) * 1000} endsAt={v.offer.expiresAt * 1000} now={nowMs} compact />
          {accept.error && (
            <Alert tone="danger" title="Seat not taken" live="assertive">
              {accept.error}
            </Alert>
          )}
          <div className={styles.buttonRow}>
            <PaperButton variant="maroon" onClick={swear} loading={accept.pending} iconStart={<Icon name="gavel" />}>
              I swear to show up
            </PaperButton>
            <Button variant="ghost" onClick={() => void decline.run()} disabled={accept.pending}>
              Decline (free)
            </Button>
          </div>
        </>
      );
    } else if (full) {
      body = <p className={styles.panelLede}>All seven seats are taken.</p>;
    } else {
      body = (
        <>
          <p className={styles.panelLede}>
            Seven verified strangers decide. Pass a quick World ID check, take a random seat offer and post a {formatUsdc(detail.terms.bondPerJuror)} bond. Show up for both
            windows and you earn {formatUsdc(detail.terms.successBonusPerJuror)} on top of your bond.
          </p>
          <PaperButton fullWidth onClick={() => setScreening(true)} iconStart={<Icon name="user" />}>
            Volunteer for the jury
          </PaperButton>
          <p className={styles.fineprint}>Declining an offer never costs anything. Only an accepted seat can be forfeited, and only for not showing up.</p>
          <ScreeningDialog open={screening} onOpenChange={setScreening} detail={detail} />
        </>
      );
    }
  } else if (detail.phase === 'commit') {
    eyebrow = v.seat !== null ? `Seat ${v.seat} · Secret ballot` : 'The jury is deliberating';
    title = v.seat !== null ? (v.committed ? 'Ballot sealed' : 'Seal your ballot') : 'Ballots are sealing';
    body =
      v.seat === null ? (
        <p className={styles.panelLede}>Seven jurors are sealing secret ballots. Nobody, including the court, can see a vote until the scrolls are opened.</p>
      ) : v.committed ? (
        <>
          {v.sealedChoice !== null && (
            <p className={styles.sealedNote}>
              <Icon name="lock" /> You sealed <BallotChip bench={v.sealedChoice}>{detail.ballot[v.sealedChoice]}</BallotChip>. Only you can see this.
            </p>
          )}
          {v.scroll && <ScrollBox scroll={v.scroll} />}
        </>
      ) : (
        <BallotForm detail={detail} />
      );
  } else if (detail.phase === 'reveal') {
    eyebrow = v.seat !== null ? `Seat ${v.seat} · Reveal` : 'Opening the scrolls';
    title = v.seat !== null ? (v.revealed ? 'Scroll opened' : 'Open your scroll') : 'Jurors are opening their scrolls';
    body =
      v.seat === null ? (
        <p className={styles.panelLede}>The tally stays hidden until the window closes. Four matching votes are needed for a verdict.</p>
      ) : v.revealed ? (
        <p className={styles.panelLede}>Your vote is counted. Your bond and reward are paid at settlement.</p>
      ) : v.committed ? (
        <RevealForm detail={detail} />
      ) : (
        <Alert tone="warning" title="You didn’t seal a ballot in time">
          Your bond will be forfeited at settlement. This is disclosed on the case page.
        </Alert>
      );
  } else if (detail.phase === 'finalizing') {
    eyebrow = 'Anyone can do this';
    title = 'Settle the case';
    body = (
      <>
        <p className={styles.panelLede}>Every deadline has passed. Settlement is permissionless: anyone can trigger it, and the ledger pays everyone by the same rules.</p>
        {settle.error && (
          <Alert tone="danger" title="Not settled" live="assertive">
            {settle.error}
          </Alert>
        )}
        <PaperButton fullWidth loading={settle.pending} onClick={() => void settle.run()} iconStart={<Icon name="scales" />}>
          Settle and read the verdict
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
      toast({ tone: 'success', title: `${formatUsdc(c.amount)} collected`, description: 'It is back in your test wallet.' });
    }
  };
  return (
    <CourtPanel id="claim-title" tone="cream" className={styles.actionCard} eyebrow={c.claimed ? 'Collected' : 'Ready to collect'} title={refund ? 'Your refund' : 'Your payout'}>
        <Receipt
          caseNumber={detail.caseNumber}
          title={refund ? 'Refund receipt' : 'Jury duty receipt'}
          lines={c.lines}
          explorerUrl={explorer()}
          note={refund ? 'Refunds are pulled by you; nobody can keep them from you.' : 'Rewards come only from the jury pool and forfeited bonds, never from the outcome you voted for.'}
        />
        {c.amount > 0n &&
          (c.claimed ? (
            <p className={styles.youNote}>
              <Icon name="check" /> Collected.
            </p>
          ) : (
            <>
              {claim.error && (
                <Alert tone="danger" title="Not collected" live="assertive">
                  {claim.error}
                </Alert>
              )}
              <PaperButton fullWidth loading={claim.pending} onClick={run} iconStart={<Icon name="sparkle" />}>
                Collect {formatUsdc(c.amount)}
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
    <CourtPanel id="gallery-title" tone="kraft" elevation={1} eyebrow="Free · points only · never binding" title="The gallery">
        {pct && tally ? (
          <>
            <p className={styles.panelLede}>THE GALLERY SAYS… ({tally.total} {tally.total === 1 ? 'call' : 'calls'})</p>
            <div className={styles.galleryBars}>
              {([0, 1] as const).map((b) => (
                <div key={b} className={styles.galleryBar} data-bench={b}>
                  <span className={styles.galleryBarLabel}>
                    {detail.ballot[b]}
                    {v.galleryVote === b && <span className={styles.yourPick}> (your call)</span>}
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
            You called it for <BallotChip bench={v.galleryVote}>{detail.ballot[v.galleryVote]}</BallotChip>. The gallery’s tally stays hidden until the jury’s reveal window
            closes, so it can’t sway the jurors. {detail.gallery.total} calls so far.
          </p>
        ) : v.galleryBlocked ? (
          <p className={styles.panelLede}>{v.galleryBlocked}</p>
        ) : v.galleryOpen ? (
          <>
            <p className={styles.panelLede}>Make your call. It’s free, it doesn’t count toward the verdict, and the tally stays hidden until the jury has revealed.</p>
            <div className={styles.buttonRow}>
              {([0, 1] as const).map((b) => (
                <Button key={b} variant="secondary" onClick={() => void cast(b)} loading={vote.pending} className={styles.galleryButton} data-bench={b}>
                  {detail.ballot[b]}
                </Button>
              ))}
            </div>
            {vote.error && (
              <Alert tone="danger" title="Not counted" live="assertive">
                {vote.error}
              </Alert>
            )}
          </>
        ) : (
          <p className={styles.panelLede}>The gallery is closed.</p>
        )}
    </CourtPanel>
  );
}
