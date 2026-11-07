import { usdc } from '@cringe-court/core';
import { formatAmount, sideLabel } from '@/i18n/domain';
import { jurorStake, seatsOf, type VersusCase, type Viewer } from '@cringe-court/modes-versus';
import { useEffect, useState } from 'react';
import { t, type MessageKey } from '@/i18n';
import { Alert, Amount, Badge, Button, Card, CardBody, CardHeader, CardTitle, Countdown, Icon, PaperButton, RadioCards, Stamp, useReducedMotion, useToast } from '@/ds';
import { agentName } from '../copy';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { VersusTrialFrame } from './VersusTrialFrame';
import { WorldIdDialog } from './WorldIdDialog';
import { PaperSection } from './PaperSection';

function SeatRow({ c }: { c: VersusCase }) {
  const seats = seatsOf(c);
  const size = c.state.terms.jurySize;
  return (
    <ol className={styles.seats} aria-label={t('versus.jury.seats.aria', { taken: seats.length, size })}>
      {Array.from({ length: size }, (_, i) => {
        const seat = seats[i];
        const state = !seat ? 'empty' : seat.revealed ? 'opened' : seat.committed ? 'sealed' : 'seated';
        const demo = seat && c.demoJurors.has(seat.account.toLowerCase());
        return (
          <li key={i} className={styles.seat} data-state={state}>
            <span className={styles.seatNo}>{t('versus.jury.seats.seat', { n: i + 1 })}</span>
            <span className={styles.seatState}>
              {state === 'empty'
                ? t('versus.jury.seats.empty')
                : state === 'opened'
                  ? t('versus.court.jury.opened')
                  : state === 'sealed'
                    ? t('versus.court.jury.sealed')
                    : t('versus.jury.seats.posted')}
            </span>
            {demo && <Badge tone="info">{t('versus.jury.seats.simulated')}</Badge>}
          </li>
        );
      })}
    </ol>
  );
}

/** Jury selection: spectators can take a seat (World ID + bond); parties wait or use the demo jury. */
export function RecruitingPanel({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  const { desk, run, balance } = useVersus();
  const { toast } = useToast();
  const stake = jurorStake(c.state.terms);
  const party = viewer === 'a' || viewer === 'b';
  const short = balance < stake.bond;
  const link = `${window.location.origin}/versus/case/${c.trialId}`;
  return (
    <div className={styles.stack}>
      <PaperSection as="section" padding="lg" ribbon={t('versus.jury.ribbon')} aria-labelledby="jury-title">
        <h2 id="jury-title" className={styles.panelTitle}>
          {viewer === 'juror' ? t('versus.jury.title.juror') : party ? t('versus.jury.title.party') : t('versus.jury.title.spectator')}
        </h2>
        <p className={styles.muted}>{t('versus.jury.intro', { threshold: c.state.terms.threshold })}</p>
        <SeatRow c={c} />
        {party && (
          <Alert tone="info" title={t('versus.jury.where.title')}>
            {t('versus.jury.where.body')}
            <div className={styles.inlineActions}>
              <PaperButton
                size="sm"
                variant="maroon"
                iconStart={<Icon name="copy" />}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(link)
                    .then(() => toast({ title: t('versus.jury.linkCopied'), tone: 'success' }))
                    .catch(() => toast({ title: t('versus.invite.copyFailed'), tone: 'warning' }))
                }
              >
                {t('versus.jury.copyLink')}
              </PaperButton>
            </div>
          </Alert>
        )}
      </PaperSection>

      {!party && viewer !== 'juror' && (
        <Card as="section" tone="ornate" aria-labelledby="summons-title">
          <CardHeader eyebrow={t('versus.jury.summons.eyebrow')}>
            <CardTitle id="summons-title" as="h2">
              {t('versus.jury.summons.title', { title: c.state.filing.title })}
            </CardTitle>
          </CardHeader>
          <CardBody className={styles.stack}>
            <dl className={styles.stakeList}>
              <div>
                <dt>{t('versus.jury.stake.bond')}</dt>
                <dd>
                  <Amount value={stake.bond} />
                </dd>
              </div>
              <div>
                <dt>{t('versus.jury.stake.reward')}</dt>
                <dd>
                  <Amount value={stake.reward} direction="credit" />
                </dd>
              </div>
              <div>
                <dt>{t('versus.jury.stake.back')}</dt>
                <dd>
                  <Amount value={stake.bestCase} />
                </dd>
              </div>
            </dl>
            <ul className={styles.ruleList} role="list">
              <li>
                <Icon name="eye" aria-hidden />
                <span>{t('versus.jury.rule.watch')}</span>
              </li>
              <li>
                <Icon name="clock" aria-hidden />
                <span>{t('versus.jury.rule.miss', { bonus: formatAmount(stake.failedTrialBonus) })}</span>
              </li>
            </ul>
            <div className={styles.inlineActions}>
              {short && (
                <PaperButton
                  variant="maroon"
                  iconStart={<Icon name="plus" />}
                  onClick={() => void run(() => desk.faucet(usdc('5.00')), { success: t('versus.fund.faucetSuccess') })}
                >
                  {t('versus.jury.faucet')}
                </PaperButton>
              )}
              <WorldIdDialog
                title={t('versus.world.title')}
                purpose={t('versus.jury.world.purpose')}
                confirmLabel={t('versus.jury.world.confirm', { amount: formatAmount(stake.bond) })}
                onVerified={() => run(() => desk.takeSeat(c.trialId), { success: t('versus.jury.seated') })}
                trigger={
                  <Button size="lg" variant="swear" disabled={short} iconStart={<Icon name="gavel" />}>
                    {t('versus.jury.swear', { amount: formatAmount(stake.bond) })}
                  </Button>
                }
              />
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

const ballotId = (trialId: string) => `ballot-${trialId}`;

/** Seconds left at which the HUD turns urgent. */
export const BALLOT_URGENT_SECONDS = 60;

type HudState = 'vote' | 'sealed' | 'open' | 'missed' | 'counted';

const HUD_COPY = {
  vote: { title: 'versus.ballotHud.vote.title', body: 'versus.ballotHud.vote.body', urgent: 'versus.ballotHud.vote.urgent' },
  sealed: { title: 'versus.ballotHud.sealed.title', body: 'versus.ballotHud.sealed.body', urgent: null },
  open: { title: 'versus.ballotHud.open.title', body: 'versus.ballotHud.open.body', urgent: 'versus.ballotHud.open.urgent' },
  missed: { title: 'versus.ballotHud.missed.title', body: 'versus.ballotHud.missed.body', urgent: null },
  counted: { title: 'versus.ballotHud.counted.title', body: 'versus.ballotHud.counted.body', urgent: null },
} as const satisfies Record<HudState, { title: MessageKey; body: MessageKey; urgent: MessageKey | null }>;

/**
 * B2: the juror's ballot, pinned above the hearing while it plays. It says what
 * to do and how long is left, turns urgent in the last minute, and takes the
 * juror straight to the ballot (or opens the scroll in one press), so watching
 * the trial never costs a juror their vote.
 */
export function BallotHud({ c }: { c: VersusCase }) {
  const { desk, run, persona, now } = useVersus();
  const reduced = useReducedMotion();
  const s = c.state;
  const seat = seatsOf(c).find((x) => x.account.toLowerCase() === persona.account.toLowerCase());
  if (s.stage !== 'jury' || !seat || (s.step !== 'commit' && s.step !== 'reveal')) return null;
  const endsAt = s.step === 'commit' ? s.commitEndsAt : s.revealEndsAt;
  if (endsAt === null) return null;
  const span = s.step === 'commit' ? s.terms.deadlines.commit : s.terms.deadlines.reveal;
  const state: HudState = s.step === 'commit' ? (seat.committed ? 'sealed' : 'vote') : !seat.committed ? 'missed' : seat.revealed ? 'counted' : 'open';
  const copy = HUD_COPY[state];
  const urgent = copy.urgent !== null && endsAt - now <= BALLOT_URGENT_SECONDS;
  const toBallot = () => {
    const card = document.getElementById(ballotId(c.trialId));
    card?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    card?.querySelector<HTMLElement>('input[type="radio"]:checked, input[type="radio"], button')?.focus({ preventScroll: true });
  };
  return (
    <section className={styles.ballotHud} data-state={state} data-urgent={urgent || undefined} aria-label={t('versus.ballotHud.aria')}>
      <div className={styles.ballotHudCopy}>
        <strong className={styles.ballotHudTitle}>
          <Icon name={state === 'vote' || state === 'sealed' ? 'lock' : state === 'missed' ? 'clock' : 'unlock'} aria-hidden />
          {t(copy.title)}
        </strong>
        <span aria-live="polite">{urgent && copy.urgent ? t(copy.urgent) : t(copy.body)}</span>
      </div>
      {state !== 'missed' && state !== 'counted' && (
        <Countdown
          compact
          label={t(s.step === 'commit' ? 'versus.header.deadline.commit' : 'versus.header.deadline.reveal')}
          startsAt={(endsAt - span) * 1000}
          endsAt={endsAt * 1000}
          now={now * 1000}
          className={styles.ballotHudTimer}
        />
      )}
      {state === 'vote' && (
        <PaperButton size="sm" variant={urgent ? 'maroon' : undefined} iconEnd={<Icon name="chevron-down" />} onClick={toBallot}>
          {t('versus.ballotHud.vote.action')}
        </PaperButton>
      )}
      {state === 'open' && (
        <PaperButton size="sm" variant={urgent ? 'maroon' : undefined} iconStart={<Icon name="unlock" />} onClick={() => void run(() => desk.revealBallot(c.trialId), { success: t('versus.ballot.openedToast') })}>
          {t('versus.ballotHud.open.action')}
        </PaperButton>
      )}
    </section>
  );
}

function BallotPanel({ c }: { c: VersusCase }) {
  const { desk, run, persona } = useVersus();
  const s = c.state;
  const seat = seatsOf(c).find((x) => x.account.toLowerCase() === persona.account.toLowerCase());
  const [choice, setChoice] = useState<string>('');
  const [sealed, setSealed] = useState<0 | 1 | null>(null);
  useEffect(() => {
    let live = true;
    desk.sealedChoice(c.trialId).then((v) => live && setSealed(v));
    return () => {
      live = false;
    };
  }, [desk, c.trialId, seat?.committed]);
  if (s.stage !== 'jury' || !seat) return null;
  const labels = [sideLabel('a', s.filing.sides.a), sideLabel('b', s.filing.sides.b)] as const;

  let body;
  if (s.step === 'commit' && !seat.committed) {
    body = (
      <form
        className={styles.stack}
        onSubmit={(e) => {
          e.preventDefault();
          if (choice) void run(() => desk.commitBallot(c.trialId, choice === 'a' ? 0 : 1), { success: t('versus.ballot.sealedToast') });
        }}
      >
        <RadioCards
          legend={t('versus.ballot.legend')}
          name={`ballot-${c.trialId}`}
          value={choice}
          onValueChange={setChoice}
          options={[
            { value: 'a', label: labels[0], description: t('versus.ballot.case', { agent: agentName('a') }), tone: 'side-a' },
            { value: 'b', label: labels[1], description: t('versus.ballot.case', { agent: agentName('b') }), tone: 'side-b' },
          ]}
          hint={t('versus.ballot.hint')}
        />
        <Button type="submit" size="lg" variant="swear" disabled={!choice} iconStart={<Icon name="lock" />}>
          {t('versus.ballot.seal')}
        </Button>
      </form>
    );
  } else if (s.step === 'commit') {
    body = (
      <Alert tone="success" title={t('versus.ballot.sealed.title')}>
        {t('versus.ballot.sealed.body', { known: sealed !== null ? 'yes' : 'no', choice: sealed !== null ? labels[sealed] : '' })}
      </Alert>
    );
  } else if (s.step === 'reveal' && !seat.committed) {
    body = (
      <Alert tone="danger" title={t('versus.ballot.missed.title')}>
        {t('versus.ballot.missed.body')}
      </Alert>
    );
  } else if (s.step === 'reveal' && !seat.revealed) {
    body = (
      <div className={styles.stack}>
        <Alert tone="warning" title={t('versus.ballot.open.title')}>
          {t('versus.ballot.open.body')}
        </Alert>
        <PaperButton size="lg" iconStart={<Icon name="unlock" />} onClick={() => void run(() => desk.revealBallot(c.trialId), { success: t('versus.ballot.openedToast') })}>
          {sealed !== null ? t('versus.ballot.open.withChoice', { choice: labels[sealed] }) : t('versus.ballot.open.button')}
        </PaperButton>
      </div>
    );
  } else {
    body = (
      <Alert tone="success" title={seat.revealed ? t('versus.ballot.done.counted') : t('versus.ballot.done.closed')}>
        {s.step === 'finalizing' ? t('versus.ballot.done.counting') : t('versus.ballot.done.waiting')}
      </Alert>
    );
  }
  return (
    <Card as="section" tone="ornate" aria-labelledby="ballot-title" id={ballotId(c.trialId)}>
      <CardHeader eyebrow={t('versus.ballot.eyebrow', { seat: seat.seat })}>
        <CardTitle id="ballot-title" as="h2">
          {s.step === 'commit' ? t('versus.ballot.title.commit') : t('versus.ballot.title.reveal')}
        </CardTitle>
      </CardHeader>
      <CardBody>{body}</CardBody>
    </Card>
  );
}

/** The trial plays for everyone; jurors vote beside it; everyone else sees only counts (never choices). */
export function TrialPanel({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  const s = c.state;
  if (s.stage !== 'jury') return null;
  const seats = seatsOf(c);
  const committed = seats.filter((x) => x.committed).length;
  const revealed = seats.filter((x) => x.revealed).length;
  return (
    <div className={styles.stack}>
      {/* Full-bleed gather → roam → vote reel (Solo parity), not a card inset. */}
      <section aria-label={t('versus.trial.aria')}>
        <p className={styles.eyebrow}>{t('versus.trial.ribbon')}</p>
        {viewer === 'juror' && <BallotHud c={c} />}
        <VersusTrialFrame viewer={viewer} lines={s.transcript.lines} exhibits={s.exhibits} filing={s.filing} seats={seats} jurySize={s.terms.jurySize} />
      </section>
      {viewer === 'juror' ? (
        <BallotPanel c={c} />
      ) : (
        <Card as="section" aria-labelledby="deliberation-title">
          <CardHeader eyebrow={t('versus.trial.jury')}>
            <CardTitle id="deliberation-title" as="h2">
              {s.step === 'reveal' ? t('versus.trial.opening') : s.step === 'finalizing' ? t('versus.trial.counting') : t('versus.trial.deliberating')}
            </CardTitle>
          </CardHeader>
          <CardBody className={styles.stack}>
            <div className={styles.tallyRow} role="status">
              <Stamp tone="filed" size="sm">
                {t('versus.trial.sealed', { n: committed, total: s.terms.jurySize })}
              </Stamp>
              <Stamp tone="case-number" size="sm">
                {t('versus.trial.opened', { n: revealed, total: s.terms.jurySize })}
              </Stamp>
            </div>
            <p className={styles.muted}>{t('versus.trial.secret')}</p>
            <SeatRow c={c} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
