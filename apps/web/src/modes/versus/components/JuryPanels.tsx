import { formatUsdc, usdc } from '@cringe-court/core';
import { jurorStake, seatsOf, sideLabel, type VersusCase, type Viewer } from '@cringe-court/modes-versus';
import { useEffect, useState } from 'react';
import { Alert, Amount, Badge, Button, Card, CardBody, CardHeader, CardTitle, Icon, OrnateFrame, RadioCards, Stamp, useToast } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { TrialView } from './TrialView';
import { WorldIdDialog } from './WorldIdDialog';

function SeatRow({ c }: { c: VersusCase }) {
  const seats = seatsOf(c);
  const size = c.state.terms.jurySize;
  return (
    <ol className={styles.seats} aria-label={`${seats.length} of ${size} jury seats taken`}>
      {Array.from({ length: size }, (_, i) => {
        const seat = seats[i];
        const state = !seat ? 'empty' : seat.revealed ? 'opened' : seat.committed ? 'sealed' : 'seated';
        const demo = seat && c.demoJurors.has(seat.account.toLowerCase());
        return (
          <li key={i} className={styles.seat} data-state={state}>
            <span className={styles.seatNo}>Seat {i + 1}</span>
            <span className={styles.seatState}>{state === 'empty' ? 'Empty' : state === 'opened' ? 'Scroll opened' : state === 'sealed' ? 'Scroll sealed' : 'Seated · bond posted'}</span>
            {demo && <Badge tone="info">Simulated</Badge>}
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
      <OrnateFrame as="section" padding="lg" ribbon="Jury selection" aria-labelledby="jury-title">
        <h2 id="jury-title" className={styles.panelTitle}>
          {viewer === 'juror' ? 'You have a seat. Waiting for the rest of the jury.' : party ? 'Both halves are in. Calling the jury.' : 'This jury needs you'}
        </h2>
        <p className={styles.muted}>
          Three verified humans hear the case. Neither side can sit on their own jury, and each human can hold only one seat (World ID). {c.state.terms.threshold} matching votes decide it.
        </p>
        <SeatRow c={c} />
        {party && (
          <Alert tone="info" title="Where do jurors come from?">
            In production the court draws random verified jurors from the waiting pool. In this demo court, open the case link in another tab to sit as a juror, or fill the seats with simulated jurors from Demo controls.
            <div className={styles.inlineActions}>
              <Button
                size="sm"
                variant="secondary"
                iconStart={<Icon name="copy" />}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(link)
                    .then(() => toast({ title: 'Jury link copied', tone: 'success' }))
                    .catch(() => toast({ title: 'Copy did not work here', tone: 'warning' }))
                }
              >
                Copy jury link
              </Button>
            </div>
          </Alert>
        )}
      </OrnateFrame>

      {!party && viewer !== 'juror' && (
        <Card as="section" tone="ornate" aria-labelledby="summons-title">
          <CardHeader eyebrow="Jury duty · I swear to show up">
            <CardTitle id="summons-title" as="h2">
              Take a seat on “{c.state.filing.title}”
            </CardTitle>
          </CardHeader>
          <CardBody className={styles.stack}>
            <dl className={styles.stakeList}>
              <div>
                <dt>Your bond</dt>
                <dd>
                  <Amount value={stake.bond} />
                </dd>
              </div>
              <div>
                <dt>Reward for finishing</dt>
                <dd>
                  <Amount value={stake.reward} direction="credit" />
                </dd>
              </div>
              <div>
                <dt>Back to you if you finish</dt>
                <dd>
                  <Amount value={stake.bestCase} />
                </dd>
              </div>
            </dl>
            <ul className={styles.ruleList} role="list">
              <li>
                <Icon name="eye" aria-hidden />
                <span>Watch the trial, then seal a Secret Verdict Scroll. Nobody can see your vote until the reveal window.</span>
              </li>
              <li>
                <Icon name="clock" aria-hidden />
                <span>Miss the seal or the reveal deadline and the bond is forfeited. If the jury can’t agree, timely jurors still get their bond back plus {formatUsdc(stake.failedTrialBonus)}.</span>
              </li>
            </ul>
            <div className={styles.inlineActions}>
              {short && (
                <Button variant="secondary" iconStart={<Icon name="plus" />} onClick={() => void run(() => desk.faucet(usdc('5.00')), { success: 'Added 5.00 test USDC' })}>
                  Get test USDC for the bond
                </Button>
              )}
              <WorldIdDialog
                title="Prove you are a unique human"
                purpose="Jury seats need a strong proof of human. The same proof checks you are not one of the two sides."
                confirmLabel={`Verify & post ${formatUsdc(stake.bond)} bond`}
                onVerified={() => run(() => desk.takeSeat(c.trialId), { success: 'You are on the jury. Watch the trial when court opens.' })}
                trigger={
                  <Button size="lg" variant="swear" disabled={short} iconStart={<Icon name="gavel" />}>
                    I swear to show up ({formatUsdc(stake.bond)})
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
          if (choice) void run(() => desk.commitBallot(c.trialId, choice === 'a' ? 0 : 1), { success: 'Scroll sealed. Open it in the reveal window.' });
        }}
      >
        <RadioCards
          legend="Who argued it better?"
          name={`ballot-${c.trialId}`}
          value={choice}
          onValueChange={setChoice}
          options={[
            { value: 'a', label: labels[0], description: 'Agent A’s case', tone: 'side-a' },
            { value: 'b', label: labels[1], description: 'Agent B’s case', tone: 'side-b' },
          ]}
          hint="Your choice is sealed with a secret saved only in this browser. Nobody, including the court, sees it until you open it."
        />
        <Button type="submit" size="lg" variant="swear" disabled={!choice} iconStart={<Icon name="lock" />}>
          Seal my Secret Verdict Scroll
        </Button>
      </form>
    );
  } else if (s.step === 'commit') {
    body = (
      <Alert tone="success" title="Your scroll is sealed">
        {sealed !== null ? `Only this device knows you chose ${labels[sealed]}.` : 'Your choice is saved on this device.'} Come back when the reveal window opens to open it; keep this browser.
      </Alert>
    );
  } else if (s.step === 'reveal' && !seat.committed) {
    body = (
      <Alert tone="danger" title="You missed the commit window">
        Your bond will be forfeited, as the summons said. The rest of the jury still decides.
      </Alert>
    );
  } else if (s.step === 'reveal' && !seat.revealed) {
    body = (
      <div className={styles.stack}>
        <Alert tone="warning" title="Open your scroll now">
          The vote only counts once it is opened. Miss this window and the bond is forfeited.
        </Alert>
        <Button size="lg" iconStart={<Icon name="unlock" />} onClick={() => void run(() => desk.revealBallot(c.trialId), { success: 'Scroll opened. Your vote is counted.' })}>
          Open my scroll{sealed !== null ? ` (${labels[sealed]})` : ''}
        </Button>
      </div>
    );
  } else {
    body = (
      <Alert tone="success" title={seat.revealed ? 'Your vote is counted' : 'Deliberation is closed'}>
        {s.step === 'finalizing' ? 'The clerk is counting the scrolls.' : 'Waiting for the reveal window to close.'}
      </Alert>
    );
  }
  return (
    <Card as="section" tone="ornate" aria-labelledby="ballot-title">
      <CardHeader eyebrow={`Juror · seat ${seat.seat}`}>
        <CardTitle id="ballot-title" as="h2">
          {s.step === 'commit' ? 'Secret Verdict Scroll' : 'Open Your Scroll'}
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
      <OrnateFrame as="section" padding="md" ribbon="Court is in session" aria-label="The trial">
        <TrialView lines={s.transcript.lines} exhibits={s.exhibits} filing={s.filing} seats={seats} jurySize={s.terms.jurySize} />
      </OrnateFrame>
      {viewer === 'juror' ? (
        <BallotPanel c={c} />
      ) : (
        <Card as="section" aria-labelledby="deliberation-title">
          <CardHeader eyebrow="The jury">
            <CardTitle id="deliberation-title" as="h2">
              {s.step === 'reveal' ? 'Opening the scrolls' : s.step === 'finalizing' ? 'Counting' : 'Deliberating'}
            </CardTitle>
          </CardHeader>
          <CardBody className={styles.stack}>
            <div className={styles.tallyRow} role="status">
              <Stamp tone="filed" size="sm">
                {committed} of {s.terms.jurySize} sealed
              </Stamp>
              <Stamp tone="case-number" size="sm">
                {revealed} of {s.terms.jurySize} opened
              </Stamp>
            </div>
            <p className={styles.muted}>Votes stay secret until the reveal window closes, so nobody can be swayed by a live tally.</p>
            <SeatRow c={c} />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
