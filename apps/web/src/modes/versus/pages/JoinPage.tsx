import { CATEGORIES, CANCEL_LABELS, formatUsdc } from '@cringe-court/core';
import { parseInviteCode, sideCharges, viewerOf } from '@cringe-court/modes-versus';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Alert, Button, Countdown, Dialog, DialogClose, DialogContent, DialogTrigger, EmptyState, Icon, LoadingState, PaperButton, PaperButtonLink, Portrait, Stamp, TextField } from '@/ds';
import { PageHead } from '../components/PageHead';
import { WorldIdDialog } from '../components/WorldIdDialog';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';
import { PaperSection } from '../components/PaperSection';

function CodeForm({ initial = '', error }: { initial?: string; error?: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<string | undefined>(error);
  return (
    <form
      className={styles.codeForm}
      onSubmit={(e) => {
        e.preventDefault();
        const r = parseInviteCode(value);
        if (!r.ok) setProblem(r.message);
        else navigate(versusPaths.joinCode(r.code));
      }}
      noValidate
    >
      <TextField
        label="Invite code"
        hint="8 characters, like K7QM-2XPA. Case and dashes don’t matter."
        value={value}
        onChange={(e) => {
          setValue(e.target.value.toUpperCase());
          setProblem(undefined);
        }}
        error={problem}
        autoComplete="off"
        spellCheck={false}
        className={styles.codeField}
      />
      <PaperButton type="submit" size="lg" iconEnd={<Icon name="arrow-right" />}>
        Open invite
      </PaperButton>
    </form>
  );
}

/** Side B's door: enter a code (or follow a link), read the invite, accept with World ID or decline. */
export function JoinPage() {
  const { code: raw } = useParams();
  useDocumentTitle('Join a Versus case');
  const { snapshot, persona, desk, run, now } = useVersus();
  const navigate = useNavigate();

  if (!raw) {
    return (
      <>
        <PageHead eyebrow="Versus Court · invite" title="Someone took you to court" lede="Enter the code from your invite. You will see what you are agreeing to before anything is shared or charged." />
        <div className={styles.page}>
          <PaperSection as="div" padding="lg" className={styles.narrow}>
            <CodeForm />
          </PaperSection>
        </div>
      </>
    );
  }

  const parsed = parseInviteCode(raw);
  const head = <PageHead eyebrow="Versus Court · invite" title="You have been summoned" />;
  if (!parsed.ok) {
    return (
      <>
        {head}
        <div className={styles.page}>
          <PaperSection as="div" padding="lg" className={styles.narrow}>
            <CodeForm initial={raw} error={parsed.message} />
          </PaperSection>
        </div>
      </>
    );
  }
  if (!snapshot) {
    return (
      <>
        {head}
        <div className={styles.page}>
          <LoadingState title="Finding your invite…" />
        </div>
      </>
    );
  }

  const c = snapshot.cases.find((x) => x.code === parsed.code);
  if (!c) {
    return (
      <>
        {head}
        <div className={styles.page}>
          <EmptyState
            title="No case with that code here"
            character="clerk"
            expression="shocked"
            actions={
              <PaperButtonLink to={versusPaths.join} variant="maroon">
                Try another code
              </PaperButtonLink>
            }
          >
            The demo court lives in this browser, so the invite only works in a tab of the same browser that filed it. Check the code, or ask Side A to open the invite here.
          </EmptyState>
        </div>
      </>
    );
  }

  const viewer = viewerOf(c, persona.account);
  const s = c.state;
  const title = s.filing.title;

  if (viewer === 'a' || viewer === 'b') {
    return (
      <>
        {head}
        <div className={styles.page}>
          <EmptyState
            title={viewer === 'a' ? 'This is your own invite' : 'You already joined this case'}
            character={viewer === 'a' ? 'side-a' : 'side-b'}
            actions={<PaperButtonLink to={versusPaths.case(c.trialId)}>Open the case</PaperButtonLink>}
          >
            {viewer === 'a'
              ? 'Send the link or code to the other side. To try it yourself, open the link in a new tab: each tab is a separate demo persona.'
              : `“${title}” is waiting for you in the case room.`}
          </EmptyState>
        </div>
      </>
    );
  }

  if (!(s.stage === 'filing' && s.step === 'awaiting-consent')) {
    const closed = s.stage === 'closed';
    return (
      <>
        {head}
        <div className={styles.page}>
          <EmptyState
            title={closed ? 'This invite is closed' : 'Someone already accepted this invite'}
            character="judge"
            expression="neutral"
            actions={
              <PaperButtonLink to={versusPaths.cases} variant="maroon">
                My cases
              </PaperButtonLink>
            }
          >
            {closed ? `${CANCEL_LABELS[s.reason]}. Nobody was charged.` : 'Each case has exactly two sides. If you are one of them, switch to that persona in the bar above.'}
          </EmptyState>
        </div>
      </>
    );
  }

  const share = sideCharges(s.terms)[1];
  const consentEnds = s.consentEndsAt;
  return (
    <>
      {head}
      <div className={styles.page}>
        <PaperSection as="article" padding="lg" ribbon="Summons" className={styles.summons} aria-labelledby="summons-title">
          <div className={styles.summonsTop}>
            <Portrait character="side-a" expression="smug" size="lg" ring="side-a" alt="Side A" />
            <div>
              <p className={styles.eyebrow}>{CATEGORIES[s.filing.category]}</p>
              <h2 id="summons-title" className={styles.summonsTitle}>
                “{title}”
              </h2>
              <p className={styles.muted}>Side A wants to settle this in Versus Court, and invited you to be Side B.</p>
            </div>
            <Stamp tone="filed" size="sm" className={styles.summonsStamp}>
              Charges filed
            </Stamp>
          </div>

          {consentEnds !== null && <Countdown label="Answer by" startsAt={(consentEnds - (s.terms.deadlines.preTrial ?? 0)) * 1000} endsAt={consentEnds * 1000} now={now * 1000} />}

          <ul className={styles.ruleList} role="list">
            <li>
              <Icon name="lock" aria-hidden />
              <span>
                <strong>You get your own AI agent.</strong> You brief Agent B in private; Side A never sees your notes, and you never see theirs.
              </span>
            </li>
            <li>
              <Icon name="eye" aria-hidden />
              <span>
                <strong>You read Side A’s story after you accept</strong>, and approve your own public version before the trial is frozen. No real names, ever.
              </span>
            </li>
            <li>
              <Icon name="scales" aria-hidden />
              <span>
                <strong>You pay {formatUsdc(share.total)} test USDC</strong> only after both of you approve the trial. Withdraw any time before then and nothing is charged.
              </span>
            </li>
            <li>
              <Icon name="star" aria-hidden />
              <span>
                <strong>Bragging rights only.</strong> No wager: nobody wins the other side’s money. On NO VERDICT or any failure, you get your own half back.
              </span>
            </li>
          </ul>

          <Alert tone="info" title="Petty fights only">
            If this is about safety, money owed, custody or anything serious, decline. Those are routed out of CringeCourt, not into it.
          </Alert>

          <div className={styles.summonsActions}>
            <Dialog>
              <DialogTrigger asChild>
                <PaperButton variant="ghost">Decline</PaperButton>
              </DialogTrigger>
              <DialogContent
                title="Decline the invite?"
                description="The case closes privately. Side A is told you declined, and nobody is charged."
                size="sm"
                footer={
                  <>
                    <DialogClose asChild>
                      <PaperButton variant="ghost">Keep it open</PaperButton>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button variant="danger" onClick={() => void run(() => desk.declineInvite(c.trialId), { success: 'Invite declined. Nobody was charged.' })}>
                        Decline
                      </Button>
                    </DialogClose>
                  </>
                }
              />
            </Dialog>
            <WorldIdDialog
              title="Prove you are a unique human"
              purpose="One human, one side: Side A cannot also be Side B, and neither side can sit on this jury."
              confirmLabel="Verify & accept"
              onVerified={async () => {
                const ok = await run(() => desk.acceptInvite(c.trialId), { success: 'You are Side B. Time to brief your agent.' });
                if (ok) navigate(versusPaths.case(c.trialId));
              }}
              trigger={
                <PaperButton size="lg" iconStart={<Icon name="gavel" />}>
                  Accept & become Side B
                </PaperButton>
              }
            />
          </div>
          <p className={styles.fine}>
            Not you? <Link to={versusPaths.landing}>Read how Versus works</Link>.
          </p>
        </PaperSection>
      </div>
    </>
  );
}
