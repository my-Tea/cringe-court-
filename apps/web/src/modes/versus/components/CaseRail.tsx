import { formatUsdc, type SideId } from '@cringe-court/core';
import {
  OUTCOME_LABELS,
  PREVIEW_OUTCOMES,
  claimable,
  claimedBy,
  previewOutcome,
  sideCharges,
  sideLabel,
  sideStatus,
  type DemoJuryPlan,
  type VersusCase,
  type Viewer,
} from '@cringe-court/modes-versus';
import { useMemo, useState } from 'react';
import { Amount, Badge, Card, CardBody, CardHeader, CardTitle, Icon, PaperButton, Portrait, RadioCards, TestnetBadge } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <li className={styles.chip} data-on={on || undefined}>
      <Icon name={on ? 'check' : 'clock'} aria-hidden />
      <span>
        {label}
        <span className="cc-visually-hidden">{on ? ': done' : ': not yet'}</span>
      </span>
    </li>
  );
}

function PartyRow({ c, side, viewer }: { c: VersusCase; side: SideId; viewer: Viewer }) {
  const st = sideStatus(c, side);
  const s = c.state;
  const pastBriefs = s.stage !== 'filing' && s.stage !== 'evidence';
  return (
    <li className={styles.party} data-side={side}>
      <Portrait character={side === 'a' ? 'side-a' : 'side-b'} size="sm" ring={side === 'a' ? 'side-a' : 'side-b'} expression={st.joined ? 'neutral' : 'shocked'} alt="" />
      <div className={styles.partyBody}>
        <p className={styles.partyName}>
          {sideLabel(side, s.filing.sides[side])}
          {viewer === side && <Badge tone={side === 'a' ? 'side-a' : 'side-b'}>you</Badge>}
        </p>
        {st.joined ? (
          <ul className={styles.chips} role="list">
            <Check on={st.briefed} label="Briefed" />
            <Check on={st.approvedBrief} label="Brief approved" />
            {pastBriefs && <Check on={st.approvedDraft} label="Draft approved" />}
            {c.caseNumber !== null && <Check on={st.paid} label="Paid" />}
          </ul>
        ) : (
          <p className={styles.muted}>Invited, not answered yet</p>
        )}
      </div>
    </li>
  );
}

function MoneyCard({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  const { persona } = useVersus();
  const terms = c.state.terms;
  const charges = sideCharges(terms);
  const mine = viewer === 'a' ? charges[0] : viewer === 'b' ? charges[1] : null;
  const owed = claimable(c, persona.account);
  const claimed = claimedBy(c, persona.account);
  const previews = useMemo(() => PREVIEW_OUTCOMES.map((o) => previewOutcome(terms, o)), [terms]);
  return (
    <Card as="section" aria-labelledby="money-title" padding="md">
      <CardHeader eyebrow="Follow the money">
        <CardTitle id="money-title" as="h2">
          Who pays what <TestnetBadge />
        </CardTitle>
      </CardHeader>
      <CardBody className={styles.money}>
        {mine && (
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
              <dt>Your half</dt>
              <dd>
                <Amount value={mine.total} />
              </dd>
            </div>
          </dl>
        )}
        {!mine && (
          <p className={styles.muted}>
            Each side pays {formatUsdc(charges[0].total)}. Jurors post a {formatUsdc(terms.bondPerJuror)} bond and earn {formatUsdc(terms.successBonusPerJuror)} for finishing.
          </p>
        )}
        {(owed > 0n || claimed !== null) && (
          <p className={styles.claimLine} data-claimed={claimed !== null || undefined}>
            <Icon name={claimed !== null ? 'check' : 'sparkle'} aria-hidden />
            {claimed !== null ? `You claimed ${formatUsdc(claimed)}` : `${formatUsdc(owed)} is waiting for you to claim`}
          </p>
        )}
        <details className={styles.outcomes}>
          <summary>What happens in every outcome</summary>
          <table className={styles.outcomeTable}>
            <caption className="cc-visually-hidden">Net cost to each side and what the court keeps, per outcome</caption>
            <thead>
              <tr>
                <th scope="col">Outcome</th>
                <th scope="col">Each side nets</th>
                <th scope="col">Court keeps</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((p) => (
                <tr key={p.outcome}>
                  <th scope="row">{OUTCOME_LABELS[p.outcome]}</th>
                  <td>
                    {p.sideCost[0] === p.sideCost[1] ? `−${formatUsdc(p.sideCost[0], { unit: false })}` : `A −${formatUsdc(p.sideCost[0], { unit: false })} · B −${formatUsdc(p.sideCost[1], { unit: false })}`}
                  </td>
                  <td>{formatUsdc(p.courtKeeps, { unit: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.fine}>
            Computed from this case’s frozen terms with the same settlement maths the contract uses. If Side B never answers, the platform absorbs Side A’s AI intake
            (about 0.0072 USDC, D6). Forfeited juror bonds are kept and disclosed per case (D13); no price here depends on them.
          </p>
        </details>
      </CardBody>
    </Card>
  );
}

function DemoControls({ c }: { c: VersusCase }) {
  const { desk, run } = useVersus();
  const [plan, setPlan] = useState<DemoJuryPlan>('reliable');
  const s = c.state;
  const recruiting = s.stage === 'jury' && s.step === 'recruiting';
  const canSkip =
    (s.stage === 'filing' && s.step === 'awaiting-consent') ||
    (s.stage === 'counsel' && s.step === 'funding') ||
    (s.stage === 'jury' && (s.step === 'recruiting' || s.step === 'commit' || s.step === 'reveal'));
  if (!recruiting && !canSkip) return null;
  return (
    <Card as="section" tone="sunken" aria-labelledby="demo-title" padding="md" className={styles.demo}>
      <CardHeader eyebrow="Demo controls (D14)">
        <CardTitle id="demo-title" as="h2">
          Speed up the demo
        </CardTitle>
      </CardHeader>
      <CardBody className={styles.demoBody}>
        <p className={styles.fine}>Demo deadlines are shorter than production (24 h / 30 / 20 / 10 min). These buttons exist only in the demo build.</p>
        {recruiting && (
          <>
            <RadioCards
              legend="Simulated jurors"
              name={`plan-${c.trialId}`}
              value={plan}
              onValueChange={(v) => setPlan(v as DemoJuryPlan)}
              options={[
                { value: 'reliable', label: 'All show up', description: 'Every simulated juror commits and reveals' },
                { value: 'one-no-show', label: 'One no-show', description: 'Shows a forfeited bond' },
                { value: 'two-no-shows', label: 'Two no-shows', description: 'Likely MISTRIAL with full refunds' },
              ]}
            />
            <PaperButton variant="maroon" fullWidth iconStart={<Icon name="user" />} onClick={() => void run(() => desk.seatDemoJurors(c.trialId, plan), { success: 'Simulated jurors took the empty seats' })}>
              Seat simulated jurors
            </PaperButton>
          </>
        )}
        {canSkip && (
          <PaperButton variant="ghost" fullWidth iconStart={<Icon name="clock" />} onClick={() => void run(() => desk.skipAhead(c.trialId))}>
            Skip to the deadline
          </PaperButton>
        )}
      </CardBody>
    </Card>
  );
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function ActivityFeed({ c }: { c: VersusCase }) {
  const items = [...c.activity].reverse().slice(0, 12);
  return (
    <Card as="section" aria-labelledby="activity-title" padding="md">
      <CardHeader eyebrow="Court record">
        <CardTitle id="activity-title" as="h2">
          What happened
        </CardTitle>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className={styles.muted}>Nothing yet.</p>
        ) : (
          <ol className={styles.feed}>
            {items.map((a, i) => (
              <li key={`${a.seq}-${i}`} data-kind={a.kind} data-side={a.side}>
                <time dateTime={new Date(a.at * 1000).toISOString()}>{timeFmt.format(a.at * 1000)}</time>
                <span>{a.text}</span>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

export function CaseRail({ c, viewer }: { c: VersusCase; viewer: Viewer }) {
  return (
    <aside className={styles.rail} aria-label="Case details">
      <Card as="section" aria-labelledby="parties-title" padding="md">
        <CardHeader eyebrow="The sides">
          <CardTitle id="parties-title" as="h2">
            Side A vs Side B
          </CardTitle>
        </CardHeader>
        <CardBody>
          <ul className={styles.parties} role="list">
            <PartyRow c={c} side="a" viewer={viewer} />
            <PartyRow c={c} side="b" viewer={viewer} />
          </ul>
        </CardBody>
      </Card>
      <MoneyCard c={c} viewer={viewer} />
      <DemoControls c={c} />
      <ActivityFeed c={c} />
    </aside>
  );
}
