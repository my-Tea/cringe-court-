import { type Usdc } from '@cringe-court/core';
import { formatAmount, pricingName } from '@/i18n/domain';
import { CURRENT_PRICING, PRICING, crowdSize, marketingBudgetLeft, type PricingProfile } from '@cringe-court/modes-grand-jury';
import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t, tRich } from '@/i18n';
import { Amount, Badge, Icon, PaperButtonLink, PaperPanel, PaperRibbon } from '@/ds';
import { CourtPanel } from '../components/parts';
import { fundingPromise, paths } from '../lib';
import { useCourtContext } from '../state/context';
import styles from '../GrandJury.module.css';

const bold = { b: (chunk: ReactNode) => <strong>{chunk}</strong> };

const share = (part: Usdc, whole: Usdc) => (whole > 0n ? (Number(part) / Number(whole)) * 100 : 0);

/** Where one case's target goes, as a stacked paper strip. */
function TargetSplit({ p }: { p: PricingProfile }) {
  const parts = [
    { key: 'pool', label: t('grandJury.pricing.split.pool', { jurors: p.jurors, reward: formatAmount(p.successBonus, { unit: false }) }), value: p.juryPool },
    { key: 'protocol', label: t('grandJury.pricing.protocolFee'), value: p.protocolFee },
    { key: 'ai', label: t('grandJury.pricing.aiCounselFee'), value: p.aiFee },
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
            <dt>{t('grandJury.pricing.target')}</dt>
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
    <PaperPanel
      as="article"
      tone={current ? 'cream' : 'kraft'}
      edge="cut"
      backing={current ? 'gold' : 'none'}
      elevation={current ? 3 : 1}
      padding="md"
      className={styles.phaseCol}
      aria-labelledby={`phase-${p.phase}`}
    >
      <p className={styles.panelEyebrow}>{p.phase === 'hackathon' ? t('grandJury.pricing.phase.hackathon') : t('grandJury.pricing.phase.launch')}</p>
      <h3 id={`phase-${p.phase}`} className={styles.panelTitle}>
        {pricingName(p.phase)} {current && <Badge tone="success">{t('grandJury.pricing.running')}</Badge>}
      </h3>
      <dl className={styles.terms}>
        <div>
          <dt>{t('grandJury.pricing.term.protocol')}</dt>
          <dd>{formatAmount(p.protocolFee)}</dd>
        </div>
        <div>
          <dt>{t('grandJury.pricing.term.ai')}</dt>
          <dd>{formatAmount(p.aiFee)}</dd>
        </div>
        <div>
          <dt>{t('grandJury.pricing.target')}</dt>
          <dd>
            {formatAmount(p.target)}{' '}
            <span className={styles.termsNote}>{t('grandJury.pricing.term.people', { people: crowdSize(p.target, p.typicalTicket), ticket: formatAmount(p.typicalTicket, { unit: false }) })}</span>
          </dd>
        </div>
        <div>
          <dt>{t('grandJury.pricing.term.sponsor')}</dt>
          <dd>
            {p.sponsorRequired
              ? t('grandJury.pricing.term.sponsorRequired', { floor: formatAmount(p.sponsorFloor!) })
              : t('grandJury.pricing.term.sponsorOptional', { floor: formatAmount(p.sponsorFloor!) })}
          </dd>
        </div>
        <div>
          <dt>{t('grandJury.pricing.term.review')}</dt>
          <dd>{t('grandJury.pricing.term.reviewBody', { cost: formatAmount(p.reviewCost) })}</dd>
        </div>
        <div>
          <dt>{t('grandJury.pricing.term.publication')}</dt>
          <dd>{p.marketingCap !== null ? t('grandJury.pricing.term.publicationCap', { cap: p.marketingCap }) : t('grandJury.pricing.term.publicationSponsor')}</dd>
        </div>
        <div>
          <dt>{t('grandJury.pricing.term.modelled')}</dt>
          <dd>
            <span className={styles.modelled} data-sign={p.modelledContribution.startsWith('-') ? 'neg' : 'pos'}>
              {p.modelledContribution.replace('-', '−')}
            </span>{' '}
            <span className={styles.termsNote}>({t('grandJury.pricing.term.fullAttendance', { value: p.contributionFullAttendance.replace('-', '−') })})</span>
          </dd>
        </div>
      </dl>
    </PaperPanel>
  );
}

/** D10, in plain words: who pays for a Grand Jury case, where it goes, and how the court plans to break even. */
export function PricingPage() {
  useDocumentTitle(t('grandJury.pricing.docTitle'));
  const { demo } = useCourtContext();
  const p = CURRENT_PRICING;
  const used = demo.court.docket.list().filter((c) => c.basis === 'marketing-cap').length;
  const left = marketingBudgetLeft(p, used);

  return (
    <div className={styles.page}>
      <header className={styles.docketHero}>
        <p className={styles.kicker}>
          <Icon name="scales" /> {t('grandJury.pricing.kicker')}
        </p>
        <PaperRibbon as="h1" tone="maroon" size="lg" sparks className={styles.heroRibbon}>
          {t('grandJury.pricing.title')}
        </PaperRibbon>
        <p className={styles.heroLede}>{t('grandJury.pricing.lede')}</p>
      </header>

      <div className={styles.pricingGrid}>
        <CourtPanel
          id="split-title"
          tone="cream"
          backing="gold"
          eyebrow={t('grandJury.pricing.split.eyebrow')}
          title={t('grandJury.pricing.split.title', { amount: formatAmount(p.target) })}
          icon="sparkle"
        >
          <TargetSplit p={p} />
          <p className={styles.panelLede}>
            {t('grandJury.pricing.split.lede', { bond: formatAmount(p.bond), reward: formatAmount(p.successBonus), threshold: p.threshold, jurors: p.jurors })}
          </p>
        </CourtPanel>

        <CourtPanel id="promise-title" tone="cream" eyebrow={t('grandJury.pricing.promise.eyebrow')} title={t('grandJury.pricing.promise.title')} icon="shield">
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
            <li>
              <Icon name="crown" /> {fundingPromise('sponsor')}
            </li>
          </ul>
        </CourtPanel>
      </div>

      <section aria-labelledby="phases-title">
        <h2 id="phases-title" className={styles.sectionTitle}>
          <Icon name="clock" /> {t('grandJury.pricing.phases')}
        </h2>
        <div className={styles.phaseGrid}>
          <PhaseColumn p={PRICING.hackathon} current={p.phase === 'hackathon'} />
          <PhaseColumn p={PRICING.launch} current={p.phase === 'launch'} />
        </div>
      </section>

      {p.marketingCap !== null && p.marketingBudget !== null && left !== null && (
        <CourtPanel id="budget-title" tone="kraft" elevation={1} eyebrow={t('grandJury.pricing.budget.eyebrow')} title={t('grandJury.pricing.budget.title')} icon="trophy">
          <div className={styles.meter}>
            <div className={styles.meterTop}>
              <span className={styles.meterRaised}>{used}</span>
              <span className={styles.meterTarget}>{t('grandJury.pricing.budget.published', { cap: p.marketingCap })}</span>
            </div>
            <div
              className={styles.meterTrack}
              role="progressbar"
              aria-label={t('grandJury.pricing.budget.label')}
              aria-valuemin={0}
              aria-valuemax={p.marketingCap}
              aria-valuenow={used}
              aria-valuetext={t('grandJury.pricing.budget.valuetext', { used, cap: p.marketingCap })}
            >
              <div className={styles.meterFill} style={{ ['--_pct' as string]: `${(used / p.marketingCap) * 100}%` }} />
            </div>
          </div>
          <p className={styles.panelLede}>
            {t('grandJury.pricing.budget.lede', {
              budget: formatAmount(p.marketingBudget),
              cap: p.marketingCap,
              each: p.modelledContribution.replace('-', ''),
              left: formatAmount(left),
              next: p.marketingCap + 1,
            })}
          </p>
        </CourtPanel>
      )}

      <CourtPanel id="why-title" tone="cream" edge="clean" eyebrow={t('grandJury.pricing.why.eyebrow')} title={t('grandJury.pricing.why.title')} icon="book">
        <ul className={styles.whyList}>
          <li>{tRich('grandJury.pricing.why.fee', bold)}</li>
          <li>{tRich('grandJury.pricing.why.sponsor', bold)}</li>
          <li>{tRich('grandJury.pricing.why.review', bold)}</li>
          <li>{tRich('grandJury.pricing.why.blend', bold)}</li>
        </ul>
        <p className={styles.fineprint}>{t('grandJury.pricing.why.fineprint')}</p>
      </CourtPanel>

      <div className={styles.centerRow}>
        <PaperButtonLink to={paths.docket} size="lg" iconEnd={<Icon name="arrow-right" />}>
          {t('grandJury.backToDocket')}
        </PaperButtonLink>
      </div>
    </div>
  );
}
