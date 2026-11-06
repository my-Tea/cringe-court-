import { formatUsdc, type Usdc } from '@cringe-court/core';
import { CURRENT_PRICING, FUNDING_PROMISES, PRICING, crowdSize, marketingBudgetLeft, type PricingProfile } from '@cringe-court/modes-grand-jury';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Amount, Badge, Icon, PaperButtonLink, PaperPanel, PaperRibbon } from '@/ds';
import { CourtPanel } from '../components/parts';
import { paths } from '../lib';
import { useCourtContext } from '../state/CourtProvider';
import styles from '../GrandJury.module.css';

const share = (part: Usdc, whole: Usdc) => (whole > 0n ? (Number(part) / Number(whole)) * 100 : 0);

/** Where one case's target goes, as a stacked paper strip. */
function TargetSplit({ p }: { p: PricingProfile }) {
  const parts = [
    { key: 'pool', label: `Jury pool: ${p.jurors} × ${formatUsdc(p.successBonus, { unit: false })} rewards`, value: p.juryPool },
    { key: 'protocol', label: 'Protocol fee', value: p.protocolFee },
    { key: 'ai', label: 'AI counsel fee (0G Compute)', value: p.aiFee },
  ];
  return (
    <figure className={styles.split}>
      <div className={styles.splitBar} aria-hidden>
        {parts.map((x) => (
          <span key={x.key} className={styles.splitPart} data-part={x.key} style={{ ['--_w' as string]: `${share(x.value, p.target)}%` }} />
        ))}
      </div>
      <figcaption>
        <dl className={styles.splitLegend}>
          {parts.map((x) => (
            <div key={x.key} data-part={x.key}>
              <dt>{x.label}</dt>
              <dd>
                <Amount value={x.value} size="sm" />
              </dd>
            </div>
          ))}
          <div data-part="total">
            <dt>Crowdfund target</dt>
            <dd>
              <Amount value={p.target} size="sm" />
            </dd>
          </div>
        </dl>
      </figcaption>
    </figure>
  );
}

function PhaseColumn({ p, current }: { p: PricingProfile; current: boolean }) {
  return (
    <PaperPanel as="article" tone={current ? 'cream' : 'kraft'} edge="cut" backing={current ? 'gold' : 'none'} elevation={current ? 3 : 1} padding="md" className={styles.phaseCol} aria-labelledby={`phase-${p.phase}`}>
      <p className={styles.panelEyebrow}>{p.phase === 'hackathon' ? 'Phase 1 · now, on testnet' : 'Phase 2 · launch pricing'}</p>
      <h3 id={`phase-${p.phase}`} className={styles.panelTitle}>
        {p.name} {current && <Badge tone="success">Running</Badge>}
      </h3>
      <dl className={styles.terms}>
        <div>
          <dt>Protocol fee</dt>
          <dd>{formatUsdc(p.protocolFee)}</dd>
        </div>
        <div>
          <dt>AI fee</dt>
          <dd>{formatUsdc(p.aiFee)}</dd>
        </div>
        <div>
          <dt>Crowdfund target</dt>
          <dd>
            {formatUsdc(p.target)} <span className={styles.termsNote}>≈ {crowdSize(p.target)} people at {formatUsdc(p.typicalTicket, { unit: false })}</span>
          </dd>
        </div>
        <div>
          <dt>Sponsor</dt>
          <dd>{p.sponsorRequired ? `≥ ${formatUsdc(p.sponsorFloor!)} per funded case, committed before publishing` : `Optional slot (≥ ${formatUsdc(p.sponsorFloor!)}); the budget assumes none`}</dd>
        </div>
        <div>
          <dt>Review cost target</dt>
          <dd>≤ {formatUsdc(p.reviewCost)} per case, a human signs off every case</dd>
        </div>
        <div>
          <dt>Publication rule</dt>
          <dd>{p.marketingCap !== null ? `At most ${p.marketingCap} editorially chosen cases` : 'Only with a sponsor commitment, or inside an explicit marketing cap'}</dd>
        </div>
        <div>
          <dt>Modelled result per case</dt>
          <dd>
            <span className={styles.modelled} data-sign={p.modelledContribution.startsWith('-') ? 'neg' : 'pos'}>
              {p.modelledContribution.replace('-', '−')}
            </span>{' '}
            <span className={styles.termsNote}>({p.contributionFullAttendance.replace('-', '−')} if every juror shows up)</span>
          </dd>
        </div>
      </dl>
    </PaperPanel>
  );
}

/** D10, in plain words: who pays for a Grand Jury case, where it goes, and how the court plans to break even. */
export function PricingPage() {
  useDocumentTitle('Who pays: Grand Jury pricing');
  const { demo } = useCourtContext();
  const p = CURRENT_PRICING;
  const used = demo.court.docket.list().filter((c) => c.basis === 'marketing-cap').length;
  const left = marketingBudgetLeft(p, used);

  return (
    <div className={styles.page}>
      <header className={styles.docketHero}>
        <p className={styles.kicker}>
          <Icon name="scales" /> Decision D10
        </p>
        <PaperRibbon as="h1" tone="maroon" size="lg" sparks className={styles.heroRibbon}>
          Who pays for a public trial
        </PaperRibbon>
        <p className={styles.heroLede}>
          A Grand Jury case is a show the crowd buys a ticket to. Nobody bets, nobody gets odds, and nothing a summoner gets depends on the verdict. Here is every number.
        </p>
      </header>

      <div className={styles.pricingGrid}>
        <CourtPanel id="split-title" tone="cream" backing="gold" eyebrow="One case, today" title={`Where ${formatUsdc(p.target)} goes`} icon="sparkle">
          <TargetSplit p={p} />
          <p className={styles.panelLede}>
            Jurors post a {formatUsdc(p.bond)} bond each and get it back with a {formatUsdc(p.successBonus)} reward for sealing and opening on time. {p.threshold} of {p.jurors}{' '}
            matching votes make a verdict.
          </p>
        </CourtPanel>

        <CourtPanel id="promise-title" tone="cream" eyebrow="What a summoner is promised" title="Refunds, credit, no odds" icon="shield">
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
            <li>
              <Icon name="crown" /> {FUNDING_PROMISES.sponsor}
            </li>
          </ul>
        </CourtPanel>
      </div>

      <section aria-labelledby="phases-title">
        <h2 id="phases-title" className={styles.sectionTitle}>
          <Icon name="clock" /> Two phases, both decided now
        </h2>
        <div className={styles.phaseGrid}>
          <PhaseColumn p={PRICING.hackathon} current={p.phase === 'hackathon'} />
          <PhaseColumn p={PRICING.launch} current={p.phase === 'launch'} />
        </div>
      </section>

      {p.marketingCap !== null && p.marketingBudget !== null && left !== null && (
        <CourtPanel id="budget-title" tone="kraft" elevation={1} eyebrow="Hackathon dashboard" title="Marketing budget" icon="trophy">
          <div className={styles.meter}>
            <div className={styles.meterTop}>
              <span className={styles.meterRaised}>{used}</span>
              <span className={styles.meterTarget}>/ {p.marketingCap} unsponsored cases published</span>
            </div>
            <div
              className={styles.meterTrack}
              role="progressbar"
              aria-label="Marketing cap used"
              aria-valuemin={0}
              aria-valuemax={p.marketingCap}
              aria-valuenow={used}
              aria-valuetext={`${used} of ${p.marketingCap} cases`}
            >
              <div className={styles.meterFill} style={{ ['--_pct' as string]: `${(used / p.marketingCap) * 100}%` }} />
            </div>
          </div>
          <p className={styles.panelLede}>
            Modelled budget {formatUsdc(p.marketingBudget)} ({p.marketingCap} × {p.modelledContribution.replace('-', '')}), {formatUsdc(left)} left. The cost is editor time and 0G
            testnet compute; the publishing tool refuses case {p.marketingCap + 1}.
          </p>
        </CourtPanel>
      )}

      <CourtPanel id="why-title" tone="cream" edge="clean" eyebrow="Why the blend" title="Three moderate moves beat one extreme move" icon="book">
        <ul className={styles.whyList}>
          <li>
            <strong>Fee only</strong> (protocol 2.97) works only if fans ignore a 34 % higher target, and charges them for a safety review they never see.
          </li>
          <li>
            <strong>Sponsor only</strong> (2.05) breaks even with 0.0053 to spare; one sponsor slipping sinks the case.
          </li>
          <li>
            <strong>Review only</strong> (0.84) means cutting the safety review that keeps public-figure cases out of defamation territory.
          </li>
          <li>
            <strong>The Sponsored Docket</strong> raises the fee by 0.50, asks a sponsor for about 1.00 per 1,000 views, and trims review through tooling. It is the only option that
            stays positive at every tested funding elasticity and with zero forfeit revenue.
          </li>
        </ul>
        <p className={styles.fineprint}>Numbers are modelled per published case (docs/DECISIONS.md D10). Before launch they are re-solved with measured funding, review time and views.</p>
      </CourtPanel>

      <div className={styles.centerRow}>
        <PaperButtonLink to={paths.docket} size="lg" iconEnd={<Icon name="arrow-right" />}>
          Back to the docket
        </PaperButtonLink>
      </div>
    </div>
  );
}
