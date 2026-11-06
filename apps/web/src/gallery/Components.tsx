import { caseNumber, usdc } from '@cringe-court/core';
import { useState } from 'react';
import {
  Alert,
  Amount,
  AnonymousPortrait,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Countdown,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  DialogueBox,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ImpactText,
  LoadingState,
  PhaseStepper,
  Portrait,
  RadioCards,
  Receipt,
  Select,
  Skeleton,
  SkeletonText,
  Spinner,
  Stamp,
  Switch,
  Tabs,
  TestnetBadge,
  TextArea,
  TextField,
  OrnateFrame,
  RoundIconButton,
  RoundIconLink,
  RoundIconTile,
  Tooltip,
  useToast,
} from '@/ds';
import { EXPRESSIONS } from '@/art/art';
import styles from './Gallery.module.css';
import { GallerySection, Specimen } from './Specimen';

const noop = () => {};

export function ButtonSection() {
  const [busy, setBusy] = useState(false);
  return (
    <GallerySection
      id="buttons"
      title="Buttons"
      description="Solid faces in a gold rim on a hard bottom edge, like the style-guide tiles; pressing sinks the face. Gold “swear” is reserved for committing money or duty. Disabled stays focusable (aria-disabled) so its reason can be read."
    >
      <Specimen label="Variants">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="swear">I swear to show up</Button>
      </Specimen>
      <Specimen label="Sizes & icons">
        <Button size="sm">Small</Button>
        <Button>Medium</Button>
        <Button size="lg">Large</Button>
        <Button iconStart={<Icon name="gavel" />}>Strike gavel</Button>
        <Button variant="secondary" iconEnd={<Icon name="arrow-right" />}>
          Next
        </Button>
        <IconButton label="Close" icon={<Icon name="close" />} />
        <IconButton label="Copy case link" icon={<Icon name="copy" />} variant="secondary" />
      </Specimen>
      <Specimen label="States" note="hover · press · focus with keyboard">
        <Button disabled>Disabled</Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
        <Button
          loading={busy}
          onClick={() => {
            setBusy(true);
            window.setTimeout(() => setBusy(false), 1800);
          }}
        >
          {busy ? 'Sealing…' : 'Seal my ballot'}
        </Button>
        <Button variant="swear" loading>
          Locking bond
        </Button>
      </Specimen>
      <Specimen label="Full width" layout="stack">
        <Button fullWidth size="lg" variant="swear" iconStart={<Icon name="lock" />}>
          I swear to show up (0.40 USDC)
        </Button>
      </Specimen>
    </GallerySection>
  );
}

export function ChromeSection() {
  const [pinned, setPinned] = useState(false);
  return (
    <GallerySection
      id="chrome"
      title="Ornate chrome"
      description="The style guide's UI chrome: four round ornate icon buttons (scales, document, gear, star) and the parchment frame. Icon buttons always have an accessible name; a captioned link uses the decorative tile."
    >
      <Specimen label="Round icon buttons" note="<RoundIconButton icon label />">
        <Tooltip content="Courts">
          <RoundIconButton icon="scales" label="Courts" />
        </Tooltip>
        <Tooltip content="Case file">
          <RoundIconButton icon="document" label="Case file" />
        </Tooltip>
        <Tooltip content="Settings">
          <RoundIconButton icon="gear" label="Settings" />
        </Tooltip>
        <Tooltip content={pinned ? 'Unpin case' : 'Pin case'}>
          <RoundIconButton icon="star" label="Pin case" pressed={pinned} onClick={() => setPinned((p) => !p)} />
        </Tooltip>
        <RoundIconButton icon="scales" label="Courts (gold)" tone="gold" />
        <RoundIconButton icon="gavel" label="Gavel (large)" size="lg" />
        <RoundIconLink to="/gallery#chrome" icon="star" label="Gallery (link)" tone="gold" size="lg" />
      </Specimen>
      <Specimen label="Captioned tiles in links" note="<RoundIconTile /> inside <a>">
        {(['scales', 'document', 'gear', 'star'] as const).map((icon) => (
          <a key={icon} href="#chrome" className={styles.tileLink}>
            <RoundIconTile icon={icon} />
            {icon}
          </a>
        ))}
      </Specimen>
      <Specimen label="Parchment frame" note="<OrnateFrame tone ribbon />" layout="grid2">
        <OrnateFrame ribbon="Case #0069">
          <p>
            <strong>The People v. Bro.</strong> Sold ETH for a keyboard because the switches sounded bullish.
          </p>
        </OrnateFrame>
        <OrnateFrame tone="wood" ribbon="Verdict">
          <p>
            Seven sworn jurors found the defendant <strong>COOKED</strong>. Bonds returned.
          </p>
        </OrnateFrame>
        <OrnateFrame padding="lg">
          <p>Empty parchment frame, large padding: the right-hand panel of the style guide.</p>
        </OrnateFrame>
        <OrnateFrame tone="wood" padding="sm">
          <p>Wood, small padding.</p>
        </OrnateFrame>
      </Specimen>
    </GallerySection>
  );
}

export function BadgeSection() {
  return (
    <GallerySection id="badges" title="Badges" description="Short status labels in the pixel face. The TESTNET badge is permanent on every screen (D14).">
      <Specimen label="Tones">
        <Badge>Neutral</Badge>
        <Badge tone="accent">Live</Badge>
        <Badge tone="highlight">Sponsored</Badge>
        <Badge tone="success">Bond returned</Badge>
        <Badge tone="danger">Slashed</Badge>
        <Badge tone="info">Verified</Badge>
        <Badge tone="side-a">Side A</Badge>
        <Badge tone="side-b">Side B</Badge>
      </Specimen>
      <Specimen label="Solid, dot, pulse">
        <Badge tone="accent" solid>
          Guilty
        </Badge>
        <Badge tone="success" dot>
          Juror seated
        </Badge>
        <Badge tone="accent" dot="pulse">
          In session
        </Badge>
        <TestnetBadge />
      </Specimen>
    </GallerySection>
  );
}

export function CardSection() {
  return (
    <GallerySection id="cards" title="Cards" description="Default and raised cards have gold-tinted edges; ornate is the mounted sheet (gold mount, hairline rule, gold photo-corners); parchment adds a maroon top rule for in-world documents; sunken is a well. Interactive cards lift; the title link covers the card.">
      <Specimen label="Tones" layout="grid3">
        {(['default', 'raised', 'ornate', 'parchment', 'sunken'] as const).map((tone) => (
          <Card key={tone} tone={tone}>
            <CardHeader eyebrow={tone}>
              <CardTitle>Case #0069</CardTitle>
              <CardDescription>Sold ETH for a keyboard because the switches sounded bullish.</CardDescription>
            </CardHeader>
            <CardBody>
              <Badge tone="accent">Crypto Crimes</Badge>
            </CardBody>
            <CardFooter>
              <Button size="sm" variant="secondary">
                Open case
              </Button>
            </CardFooter>
          </Card>
        ))}
        <Card interactive>
          <CardHeader eyebrow="interactive">
            <CardTitle>
              <a href="#cards" data-card-link>
                Hover or tab to me
              </a>
            </CardTitle>
            <CardDescription>The whole card is one link target.</CardDescription>
          </CardHeader>
          <CardBody>
            <Amount value={usdc('1.20')} />
          </CardBody>
        </Card>
      </Specimen>
    </GallerySection>
  );
}

export function FormSection() {
  const [angle, setAngle] = useState('');
  const [ballot, setBallot] = useState('guilty');
  const [notify, setNotify] = useState(true);
  return (
    <GallerySection
      id="forms"
      title="Form fields"
      description="Labels are always visible; hints and errors are wired with aria-describedby; errors carry an icon, not just colour. Length limits are soft: a counter warns, nothing is silently cut."
    >
      <Specimen label="Text" layout="grid2">
        <TextField label="Case title" placeholder="The Great Keyboard Incident" hint="This is what the public sees." />
        <TextField label="Nickname" optional placeholder="Side A" />
        <TextField label="Wallet" defaultValue="0x12" error="That address is too short. Paste the full 0x… address." />
        <TextField label="Locked" disabled defaultValue="Fixed when the case opens" />
      </Specimen>
      <Specimen label="Textarea with counter (D2: one angle, ≤ 140 chars)" layout="stack">
        <TextArea
          label="Steer your lawyer"
          hint="One line. Counsel Chaos will run with it."
          maxLength={140}
          value={angle}
          onChange={(e) => setAngle(e.target.value)}
          placeholder="Argue that the keyboard was an investment in productivity."
        />
      </Specimen>
      <Specimen label="Select, checkbox, switch" layout="grid2">
        <Select
          label="Category"
          placeholder="Choose a category"
          options={[
            { value: 'crypto-crimes', label: 'Crypto Crimes' },
            { value: 'dating-crimes', label: 'Dating Crimes' },
            { value: 'npc-behavior', label: 'NPC Behavior' },
            { value: 'internet-crimes', label: 'Internet Crimes' },
          ]}
        />
        <Select label="Disabled" disabled options={[{ value: 'x', label: 'Arc testnet' }]} />
        <Checkbox label="I understand I must reveal my vote" description="Missing the reveal deadline counts as absent and can forfeit the bond." defaultChecked />
        <Checkbox label="I accept the bond terms" error="Accept the bond terms to take the seat." />
        <Switch label="Remind me before the reveal" description="A notification 3 minutes before the deadline." checked={notify} onCheckedChange={setNotify} />
        <Switch label="Disabled switch" checked={false} onCheckedChange={noop} disabled />
      </Specimen>
      <Specimen label="Radio cards (ballots)" layout="stack">
        <RadioCards
          legend="Your secret verdict"
          name="ballot"
          value={ballot}
          onValueChange={setBallot}
          hint="Sealed now, revealed later. Nobody sees it until the reveal."
          options={[
            { value: 'guilty', label: 'GUILTY', description: 'Cooked. No defence survives this.', tone: 'guilty' },
            { value: 'not-cooked', label: 'NOT COOKED', description: 'Let bro cook. It was fine.', tone: 'not-cooked' },
          ]}
        />
        <RadioCards
          legend="Versus ballot"
          name="versus"
          defaultValue="a"
          options={[
            { value: 'a', label: 'SIDE A', tone: 'side-a' },
            { value: 'b', label: 'SIDE B', tone: 'side-b' },
            { value: 'x', label: 'Abstain', description: 'Not allowed on a binary ballot', disabled: true },
          ]}
          error="Pick a side to seal your ballot."
        />
      </Specimen>
    </GallerySection>
  );
}

export function OverlaySection() {
  const { toast } = useToast();
  return (
    <GallerySection id="overlays" title="Dialogs, sheets, toasts & tooltips" description="Radix primitives underneath: focus trap and return, Escape, scroll lock, live regions (F8 jumps to notifications), hover and focus tooltips.">
      <Specimen label="Dialogs">
        <Dialog>
          <DialogTrigger asChild>
            <Button>Accept jury seat</Button>
          </DialogTrigger>
          <DialogContent
            title="Take the seat?"
            description="You lock a 0.40 test USDC bond. You get it back, plus 0.30, if you seal and reveal your vote in time."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="ghost">Not now</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="swear">I swear to show up</Button>
                </DialogClose>
              </>
            }
          >
            <Alert tone="warning" title="Two steps, two deadlines">
              Seal your vote within 20 minutes, then reveal it within the next 10. Miss the reveal and the bond can be forfeited.
            </Alert>
          </DialogContent>
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="danger">Cancel case</Button>
          </DialogTrigger>
          <DialogContent
            tone="danger"
            size="sm"
            title="Cancel this case?"
            description="Everyone is refunded in full. This can't be undone."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="ghost">Keep it</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="danger">Cancel and refund</Button>
                </DialogClose>
              </>
            }
          />
        </Dialog>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open sheet</Button>
          </DialogTrigger>
          <DialogContent variant="sheet" title="Case record" description="Request ids and the frozen transcript fingerprint.">
            <p className="cc-tabular">0x9f3c…a17b</p>
          </DialogContent>
        </Dialog>
      </Specimen>
      <Specimen label="Toasts">
        <Button variant="secondary" onClick={() => toast({ title: 'Ballot sealed', description: 'Come back to reveal it after 19:59.', tone: 'success' })}>
          Success
        </Button>
        <Button variant="secondary" onClick={() => toast({ title: 'Reveal opens in 3 minutes', tone: 'warning' })}>
          Warning
        </Button>
        <Button
          variant="secondary"
          onClick={() =>
            toast({
              title: 'Transaction failed',
              description: 'Nothing was charged. Try again.',
              tone: 'danger',
              action: { label: 'Retry', altText: 'Retry the transaction from the ballot screen', onClick: noop },
            })
          }
        >
          Error with action
        </Button>
        <Button variant="secondary" onClick={() => toast({ title: 'The jury has spoken', description: 'CASE #0069: NOT COOKED, 2 of 3.', tone: 'verdict' })}>
          Verdict
        </Button>
        <Button variant="ghost" onClick={() => toast({ title: 'Link copied' })}>
          Info
        </Button>
      </Specimen>
      <Specimen label="Tooltips">
        <Tooltip content="Commit–reveal: your vote stays hidden until the reveal window.">
          <Button variant="secondary" iconStart={<Icon name="info" />}>
            What is sealing?
          </Button>
        </Tooltip>
        <Tooltip content="Copy case link" side="bottom">
          <IconButton label="Copy case link" icon={<Icon name="copy" />} />
        </Tooltip>
      </Specimen>
    </GallerySection>
  );
}

export function TabsSection() {
  return (
    <GallerySection id="tabs" title="Tabs" description="Arrow keys move between tabs, Home/End jump, panels are labelled by their tab.">
      <Specimen label="Underline" layout="stack">
        <Tabs
          label="Case views"
          items={[
            { value: 'trial', label: 'Trial', content: <p>Opening statements, cross-examination and closing.</p> },
            { value: 'jury', label: 'Jury', content: <p>Three seats. Two seated, one invitation pending.</p> },
            { value: 'money', label: 'Money', content: <p>Case charge 1.20 test USDC, fully refundable on NO VERDICT.</p> },
            { value: 'record', label: 'Record', content: <p />, disabled: true },
          ]}
        />
      </Specimen>
      <Specimen label="Pills" layout="stack">
        <Tabs
          variant="pills"
          label="Docket filter"
          items={[
            { value: 'live', label: 'Live', content: <p>4 trials in session.</p> },
            { value: 'soon', label: 'Starting soon', content: <p>2 juries forming.</p> },
            { value: 'done', label: 'Settled', content: <p>128 verdicts.</p> },
          ]}
        />
      </Specimen>
    </GallerySection>
  );
}

export function FeedbackSection() {
  return (
    <GallerySection id="feedback" title="Alerts, skeletons & spinners" description="Alerts say what happened and what it means for money. Skeletons hold the layout; spinners are four pixel blocks that stop cycling under reduced motion.">
      <Specimen label="Alerts" layout="stack">
        <Alert title="Jury selection runs for 30 minutes">If three seats aren't filled, every bond and your case charge are refunded.</Alert>
        <Alert tone="success" title="Bond returned">0.40 test USDC is back in your wallet, plus a 0.30 reward.</Alert>
        <Alert tone="warning" title="Reveal your vote before 20:29" actions={<Button size="sm" variant="swear">Open your scroll</Button>}>
          A sealed vote that is never revealed doesn't count.
        </Alert>
        <Alert tone="danger" title="World ID check failed" live="polite">
          You can still watch this trial. Jury seats need a verified human.
        </Alert>
      </Specimen>
      <Specimen label="Skeletons" layout="grid2">
        <div aria-busy="true" aria-label="Loading case" style={{ display: 'flex', gap: 'var(--cc-space-4)', width: '100%' }}>
          <Skeleton variant="circle" width="3rem" />
          <div style={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" />
            <SkeletonText lines={3} />
          </div>
        </div>
        <Skeleton height="8rem" />
      </Specimen>
      <Specimen label="Spinners">
        <Spinner size="sm" />
        <Spinner />
        <Spinner size="lg" />
        <span style={{ color: 'var(--cc-color-accent-text)' }}>
          <Spinner size="lg" label="Counsel preparing" />
        </span>
      </Specimen>
    </GallerySection>
  );
}

export function StatesSection() {
  return (
    <GallerySection id="states" title="Empty, loading & error states" description="The cast reacts: the clerk shrugs at empty lists, the narrator waits, the judge is shocked by errors. Each state says what to do next.">
      <Specimen label="States" layout="grid3">
        <Card>
          <EmptyState compact headingLevel={3} title="No cases yet" actions={<Button size="sm">File a case</Button>}>
            Your docket is empty. Confess something.
          </EmptyState>
        </Card>
        <Card>
          <LoadingState compact headingLevel={3} title="Counsel is preparing">
            0G is writing both sides. Usually under a minute.
          </LoadingState>
        </Card>
        <Card>
          <ErrorState compact headingLevel={3} title="Couldn't reach Arc testnet" onRetry={noop} details="RPC timeout after 15000 ms (eth_call)">
            Nothing was charged.
          </ErrorState>
        </Card>
      </Specimen>
    </GallerySection>
  );
}

export function CastSection() {
  return (
    <GallerySection id="cast" title="Portraits" description="Voxel dialogue busts from cc-art, scaled with crisp pixels. The defendant is always an anonymous silhouette.">
      <Specimen label="Expressions" note="neutral · smug · shocked · defeated">
        {EXPRESSIONS.map((e) => (
          <Portrait key={e} character="judge" expression={e} size="lg" alt={`Judge Gavel.exe, ${e}`} />
        ))}
        {EXPRESSIONS.map((e) => (
          <Portrait key={e} character="prosecutor" expression={e} size="lg" alt={`Miss Ratio, ${e}`} />
        ))}
      </Specimen>
      <Specimen label="Sizes & rings">
        <Portrait character="defense" size="xs" />
        <Portrait character="defense" size="sm" ring="accent" />
        <Portrait character="defense" ring="highlight" />
        <Portrait character="side-a" size="lg" ring="side-a" />
        <Portrait character="side-b" size="lg" ring="side-b" />
        <Portrait character="juror" size="xl" />
        <AnonymousPortrait size="xl" ring="accent" />
      </Specimen>
    </GallerySection>
  );
}

export function BrandSection({ replayKey }: { replayKey: number }) {
  // Fixed when the section mounts, so the four countdowns stay in their intended states.
  const [now] = useState(() => Date.now());
  return (
    <GallerySection id="trial" title="Trial moments" description="The signature beats from V4 §5: stamps, impact callouts, the deadline widget, typewriter dialogue, progress and the settlement receipt. Use “Replay animations” in the toolbar.">
      <Specimen label="Stamps" note="live text, animates in">
        <span key={`s-${replayKey}`} style={{ display: 'contents' }}>
          <Stamp animate size="lg" sub="Sentence pending">
            Guilty
          </Stamp>
          <Stamp animate tone="not-cooked" size="lg">
            Not cooked
          </Stamp>
          <Stamp animate tone="no-verdict" sub="Full refund">
            Mistrial
          </Stamp>
          <Stamp animate tone="filed">
            Charges filed
          </Stamp>
          <Stamp animate tone="case-number" size="sm">
            Case #0069
          </Stamp>
          <Stamp animate tone="side-a">
            Side A
          </Stamp>
          <Stamp animate tone="side-b">
            Side B
          </Stamp>
        </span>
      </Specimen>
      <Specimen label="Impact text">
        <span key={`i-${replayKey}`} style={{ display: 'contents' }}>
          <ImpactText animate />
          <ImpactText kind="cook" animate />
          <ImpactText kind="order" size="sm" animate />
          <ImpactText kind="counter" size="sm" animate />
        </span>
      </Specimen>
      <Specimen label="Countdown" note="calm · soon · urgent · ended" layout="grid2">
        <Countdown label="Jury selection" startsAt={now - 5 * 60e3} endsAt={now + 25 * 60e3} />
        <Countdown label="Seal your vote" startsAt={now - 16 * 60e3} endsAt={now + 4 * 60e3} />
        <Countdown label="Reveal your vote" startsAt={now - 9 * 60e3} endsAt={now + 50e3} />
        <Countdown label="Reveal window" startsAt={now - 20 * 60e3} endsAt={now - 1000} />
        <Countdown label="Consent" startsAt={now} endsAt={now + 24 * 3600e3} compact />
      </Specimen>
      <Specimen label="Amounts">
        <Amount value={usdc('0.4')} size="sm" />
        <Amount value={usdc('1.2')} />
        <Amount value={usdc('7.3')} size="lg" />
        <Amount value={usdc('0.3')} direction="credit" size="lg" />
        <Amount value={usdc('0.4')} direction="debit" size="lg" />
        <Amount value={usdc('46.06')} size="xl" />
      </Specimen>
      <Specimen label="Phase stepper" layout="stack">
        <PhaseStepper steps={['Filing', 'Jury selection', 'Counsel preparing', 'Seal votes', 'Reveal votes', 'Verdict']} current={3} />
        <PhaseStepper steps={['Filed', 'Jury seated', 'Arguments', 'Sealed', 'Revealed', 'Settled']} current={6} label="Finished trial" />
      </Specimen>
      <Specimen label="Dialogue box" layout="stack">
        <DialogueBox
          key={`d-${replayKey}`}
          speaker="prosecutor"
          expression="smug"
          text="Your Honour, the defendant sold their ETH for a keyboard. The switches were, quote, 'bullish'. The prosecution rests its case and its eardrums."
        />
      </Specimen>
      <Specimen label="Settlement receipt" layout="grid2">
        <Receipt
          caseNumber={caseNumber(69)}
          title="Juror receipt"
          lines={[
            { kind: 'bond-returned', label: 'Bond returned', amount: usdc('0.40') },
            { kind: 'reward', label: 'Verdict reward', amount: usdc('0.30') },
          ]}
          note="You sealed and revealed on time. Testnet: test USDC has no value."
          explorerUrl="#trial"
        />
        <Receipt
          caseNumber={caseNumber(70)}
          title="Juror receipt"
          lines={[{ kind: 'forfeit', label: 'Bond forfeited (no reveal)', amount: usdc('0.40') }]}
          note="The reveal deadline passed without a reveal. Forfeits are disclosed per case (D13)."
        />
      </Specimen>
    </GallerySection>
  );
}
