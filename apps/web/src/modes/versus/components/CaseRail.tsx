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
import { formatDateTime, t } from '@/i18n';
import { Amount, Badge, Card, CardBody, CardHeader, CardTitle, Icon, PaperButton, Portrait, RadioCards, TestnetBadge } from '@/ds';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';

function Check({ on, label }: { on: boolean; label: string }) {
  return (
    <li className={styles.chip} data-on={on || undefined}>
      <Icon name={on ? 'check' : 'clock'} aria-hidden />
      <span>
        {label}
        <span className="cc-visually-hidden">{on ? t('versus.rail.chip.done') : t('versus.rail.chip.notYet')}</span>
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
          {viewer === side && <Badge tone={side === 'a' ? 'side-a' : 'side-b'}>{t('versus.rail.you')}</Badge>}
        </p>
        {st.joined ? (
          <ul className={styles.chips} role="list">
            <Check on={st.briefed} label={t('versus.rail.chip.briefed')} />
            <Check on={st.approvedBrief} label={t('versus.rail.chip.briefApproved')} />
            {pastBriefs && <Check on={st.approvedDraft} label={t('versus.rail.chip.draftApproved')} />}
            {c.caseNumber !== null && <Check on={st.paid} label={t('versus.rail.chip.paid')} />}
          </ul>
        ) : (
          <p className={styles.muted}>{t('versus.rail.invited')}</p>
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
      <CardHeader eyebrow={t('versus.rail.money.eyebrow')}>
        <CardTitle id="money-title" as="h2">
          {t('versus.rail.money.title')} <TestnetBadge />
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
              <dt>{t('versus.rail.money.yourHalf')}</dt>
              <dd>
                <Amount value={mine.total} />
              </dd>
            </div>
          </dl>
        )}
        {!mine && (
          <p className={styles.muted}>
            {t('versus.rail.money.jurors', { side: formatUsdc(charges[0].total), bond: formatUsdc(terms.bondPerJuror), bonus: formatUsdc(terms.successBonusPerJuror) })}
          </p>
        )}
        {(owed > 0n || claimed !== null) && (
          <p className={styles.claimLine} data-claimed={claimed !== null || undefined}>
            <Icon name={claimed !== null ? 'check' : 'sparkle'} aria-hidden />
            {claimed !== null ? t('versus.rail.money.claimed', { amount: formatUsdc(claimed) }) : t('versus.rail.money.owed', { amount: formatUsdc(owed) })}
          </p>
        )}
        <details className={styles.outcomes}>
          <summary>{t('versus.rail.outcomes.summary')}</summary>
          <table className={styles.outcomeTable}>
            <caption className="cc-visually-hidden">{t('versus.rail.outcomes.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('versus.rail.outcomes.outcome')}</th>
                <th scope="col">{t('versus.rail.outcomes.eachNets')}</th>
                <th scope="col">{t('versus.rail.outcomes.courtKeeps')}</th>
              </tr>
            </thead>
            <tbody>
              {previews.map((p) => (
                <tr key={p.outcome}>
                  <th scope="row">{OUTCOME_LABELS[p.outcome]}</th>
                  <td>
                    {p.sideCost[0] === p.sideCost[1]
                      ? t('versus.rail.outcomes.same', { amount: formatUsdc(p.sideCost[0], { unit: false }) })
                      : t('versus.rail.outcomes.split', { a: formatUsdc(p.sideCost[0], { unit: false }), b: formatUsdc(p.sideCost[1], { unit: false }) })}
                  </td>
                  <td>{formatUsdc(p.courtKeeps, { unit: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.fine}>
            {t('versus.rail.outcomes.fine')}
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
      <CardHeader eyebrow={t('versus.rail.demo.eyebrow')}>
        <CardTitle id="demo-title" as="h2">
          {t('versus.rail.demo.title')}
        </CardTitle>
      </CardHeader>
      <CardBody className={styles.demoBody}>
        <p className={styles.fine}>{t('versus.rail.demo.note')}</p>
        {recruiting && (
          <>
            <RadioCards
              legend={t('versus.rail.demo.jurors')}
              name={`plan-${c.trialId}`}
              value={plan}
              onValueChange={(v) => setPlan(v as DemoJuryPlan)}
              options={[
                { value: 'reliable', label: t('versus.rail.demo.plan.reliable'), description: t('versus.rail.demo.plan.reliableHint') },
                { value: 'one-no-show', label: t('versus.rail.demo.plan.one'), description: t('versus.rail.demo.plan.oneHint') },
                { value: 'two-no-shows', label: t('versus.rail.demo.plan.two'), description: t('versus.rail.demo.plan.twoHint') },
              ]}
            />
            <PaperButton variant="maroon" fullWidth iconStart={<Icon name="user" />} onClick={() => void run(() => desk.seatDemoJurors(c.trialId, plan), { success: t('versus.rail.demo.seated') })}>
              {t('versus.rail.demo.seat')}
            </PaperButton>
          </>
        )}
        {canSkip && (
          <PaperButton variant="ghost" fullWidth iconStart={<Icon name="clock" />} onClick={() => void run(() => desk.skipAhead(c.trialId))}>
            {t('versus.rail.demo.skip')}
          </PaperButton>
        )}
      </CardBody>
    </Card>
  );
}

function ActivityFeed({ c }: { c: VersusCase }) {
  const items = [...c.activity].reverse().slice(0, 12);
  return (
    <Card as="section" aria-labelledby="activity-title" padding="md">
      <CardHeader eyebrow={t('versus.rail.feed.eyebrow')}>
        <CardTitle id="activity-title" as="h2">
          {t('versus.rail.feed.title')}
        </CardTitle>
      </CardHeader>
      <CardBody>
        {items.length === 0 ? (
          <p className={styles.muted}>{t('versus.rail.feed.empty')}</p>
        ) : (
          <ol className={styles.feed}>
            {items.map((a, i) => (
              <li key={`${a.seq}-${i}`} data-kind={a.kind} data-side={a.side}>
                <time dateTime={new Date(a.at * 1000).toISOString()}>{formatDateTime(a.at * 1000, { hour: 'numeric', minute: '2-digit' })}</time>
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
    <aside className={styles.rail} aria-label={t('versus.rail.aria')}>
      <Card as="section" aria-labelledby="parties-title" padding="md">
        <CardHeader eyebrow={t('versus.rail.parties.eyebrow')}>
          <CardTitle id="parties-title" as="h2">
            {t('versus.rail.parties.title')}
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
