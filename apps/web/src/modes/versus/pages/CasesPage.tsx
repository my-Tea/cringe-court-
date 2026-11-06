import { CATEGORIES, formatCaseNumber, formatUsdc } from '@cringe-court/core';
import { VERSUS_STEPS, casesFor, jurorStake, nextStep, stepIndex, viewerOf, type VersusCase } from '@cringe-court/modes-versus';
import { Link } from 'react-router';
import { t } from '@/i18n';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { Badge, EmptyState, Icon, LoadingState, PaperButtonLink, Portrait, Skeleton } from '@/ds';
import { PageHead } from '../components/PageHead';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';

function CaseCard({ c }: { c: VersusCase }) {
  const { persona } = useVersus();
  const viewer = viewerOf(c, persona.account);
  const step = nextStep(c, viewer, persona.account);
  const s = c.state;
  const index = stepIndex(s);
  const closed = s.stage === 'closed';
  return (
    <li className={styles.caseCard} data-your-move={step.yourMove || undefined} data-closed={closed || undefined}>
      <Portrait character={viewer === 'b' ? 'side-b' : viewer === 'a' ? 'side-a' : 'juror'} size="sm" ring={viewer === 'b' ? 'side-b' : viewer === 'a' ? 'side-a' : 'highlight'} alt="" />
      <div className={styles.caseCardBody}>
        <p className={styles.caseCardMeta}>
          {c.caseNumber !== null ? formatCaseNumber(c.caseNumber) : t('versus.cases.private')} · {CATEGORIES[s.filing.category]} · {viewer === 'a' ? t('common.role.sideA') : viewer === 'b' ? t('common.role.sideB') : viewer === 'juror' ? t('common.role.juror') : t('versus.header.viewer.spectator')}
        </p>
        <h3 className={styles.caseCardTitle}>
          <Link to={versusPaths.case(c.trialId)} className={styles.stretched}>
            “{s.filing.title}”
          </Link>
        </h3>
        <p className={styles.caseCardStep}>
          {step.yourMove && <span className={styles.yourMove}>{t('versus.header.yourMove')}</span>}
          {step.label}
        </p>
      </div>
      <div className={styles.caseCardProgress} aria-label={closed ? t('versus.cases.closedAria') : t('versus.cases.stepAria', { n: index + 1, total: VERSUS_STEPS.length, label: VERSUS_STEPS[index]! })} role="img">
        {VERSUS_STEPS.map((label, i) => (
          <span key={label} data-done={i < index || (i === index && (s.stage === 'verdict' || s.stage === 'share')) || undefined} data-current={(i === index && !closed) || undefined} />
        ))}
      </div>
      <Icon name="chevron-right" aria-hidden className={styles.caseCardChevron} />
    </li>
  );
}

/** Your cases on this device, and juries that need a verified human. */
export function CasesPage() {
  useDocumentTitle(t('versus.cases.docTitle'));
  const { snapshot, persona } = useVersus();
  if (!snapshot) {
    return (
      <>
        <PageHead eyebrow={t('common.mode.versus')} title={t('versus.persona.myCases')} />
        <div className={styles.page}>
          <LoadingState title={t('versus.cases.loading')}>
            <Skeleton height="4rem" />
          </LoadingState>
        </div>
      </>
    );
  }
  const mine = casesFor(snapshot.cases, persona.account);
  const duty = snapshot.cases.filter((c) => c.state.stage === 'jury' && c.state.step === 'recruiting' && viewerOf(c, persona.account) === 'spectator');
  const open = mine.filter((c) => c.state.stage !== 'closed' && c.state.stage !== 'share');
  const done = mine.filter((c) => !open.includes(c));
  return (
    <>
      <PageHead
        eyebrow={t('common.mode.versus')}
        title={t('versus.persona.myCases')}
        lede={t('versus.cases.lede')}
        aside={
          <PaperButtonLink to={versusPaths.newCase} size="lg" iconStart={<Icon name="gavel" />}>
            {t('versus.cases.start')}
          </PaperButtonLink>
        }
      />
      <div className={styles.page}>
        {mine.length === 0 ? (
          <EmptyState
            title={t('versus.cases.empty.title')}
            character="side-a"
            expression="smug"
            headingLevel={2}
            actions={
              <>
                <PaperButtonLink to={versusPaths.newCase}>{t('versus.mode.landing.start')}</PaperButtonLink>
                <PaperButtonLink to={versusPaths.join} variant="maroon">
                  {t('versus.mode.landing.join')}
                </PaperButtonLink>
              </>
            }
          >
            {t('versus.cases.empty.body')}
          </EmptyState>
        ) : (
          <>
            {open.length > 0 && (
              <section aria-labelledby="open-title" className={styles.listSection}>
                <h2 id="open-title" className={styles.listTitle}>
                  {t('versus.cases.inProgress')} <Badge tone="accent">{open.length}</Badge>
                </h2>
                <ul className={styles.caseList} role="list">
                  {open.map((c) => (
                    <CaseCard key={c.trialId} c={c} />
                  ))}
                </ul>
              </section>
            )}
            {done.length > 0 && (
              <section aria-labelledby="done-title" className={styles.listSection}>
                <h2 id="done-title" className={styles.listTitle}>
                  {t('versus.cases.closed')}
                </h2>
                <ul className={styles.caseList} role="list">
                  {done.map((c) => (
                    <CaseCard key={c.trialId} c={c} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <section aria-labelledby="duty-title" className={styles.listSection}>
          <h2 id="duty-title" className={styles.listTitle}>
            {t('versus.cases.duty.title')}
          </h2>
          {duty.length === 0 ? (
            <p className={styles.muted}>{t('versus.cases.duty.empty')}</p>
          ) : (
            <ul className={styles.caseList} role="list">
              {duty.map((c) => (
                <li key={c.trialId} className={styles.caseCard}>
                  <Portrait character="juror" size="sm" ring="highlight" alt="" />
                  <div className={styles.caseCardBody}>
                    <p className={styles.caseCardMeta}>
                      {c.caseNumber !== null && formatCaseNumber(c.caseNumber)} · {c.state.stage === 'jury' ? t('versus.cases.duty.seats', { taken: c.state.seats.length, size: c.state.terms.jurySize }) : ''}
                    </p>
                    <h3 className={styles.caseCardTitle}>
                      <Link to={versusPaths.case(c.trialId)} className={styles.stretched}>
                        “{c.state.filing.title}”
                      </Link>
                    </h3>
                    <p className={styles.caseCardStep}>
                      {t('versus.cases.duty.stake', { bond: formatUsdc(jurorStake(c.state.terms).bond), reward: formatUsdc(jurorStake(c.state.terms).reward) })}
                    </p>
                  </div>
                  <Icon name="chevron-right" aria-hidden className={styles.caseCardChevron} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
