import { useState } from 'react';
import { verdictTone } from '@cringe-court/modes-solo';
import { Link } from 'react-router';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { EmptyState, Icon, PaperButtonLink, PaperPanel, PaperRibbon, Stamp } from '@/ds';
import { t } from '@/i18n';
import { demoCourt, readDocket } from '../lib/demoCourt';
import { soloPaths } from '../lib/paths';
import styles from './CasePage.module.css';
import { categoryLabel, formatCaseNo, verdictLabel } from '@/i18n/domain';

/** /solo/docket — decided Solo cases kept in this browser. */
export function DocketPage() {
  useDocumentTitle(t('solo.docket.doc'));
  const [entries] = useState(readDocket);
  const live = demoCourt().session;
  const liveCase = live && (live.trial.stage === 'jury' ? live.trial : null);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <PaperButtonLink to={soloPaths.landing} variant="maroon" size="sm" iconStart={<Icon name="arrow-left" />}>
          {t('solo.nav.solo')}
        </PaperButtonLink>
        <PaperRibbon as="h1" size="lg" sparks className={styles.title}>
          {t('solo.docket.heading')}
        </PaperRibbon>
        <p className={styles.small}>{t('solo.docket.lede')}</p>
        {entries.length > 0 && (
          <PaperButtonLink to={soloPaths.file} iconStart={<Icon name="plus" />}>
            {t('solo.docket.fileAnother')}
          </PaperButtonLink>
        )}
      </header>

      {liveCase && (
        <PaperPanel edge="cut" elevation={3} backing="gold">
          <p className={styles.eyebrow}>{t('solo.docket.inSession')}</p>
          <Link className={styles.docketLink} to={soloPaths.case(liveCase.id)}>
            {t('solo.docket.live.link', { caseNumber: formatCaseNo(liveCase.caseNumber), title: liveCase.filing.title })}
          </Link>
        </PaperPanel>
      )}

      {entries.length === 0 ? (
        <EmptyState
          title={t('solo.docket.empty.title')}
          headingLevel={2}
          character="clerk"
          actions={
            <PaperButtonLink to={soloPaths.file} iconStart={<Icon name="plus" />}>
              {t('solo.docket.empty.cta')}
            </PaperButtonLink>
          }
        >
          {t('solo.docket.empty.body')}
        </EmptyState>
      ) : (
        <ul className={styles.docket} role="list">
          {entries.map(({ id, snapshot }) => {
            const tr = snapshot.trial;
            if (tr.stage !== 'verdict' && tr.stage !== 'share') return null;
            return (
              <PaperPanel as="li" key={id} edge="cut" elevation={2} className={styles.docketCard}>
                <article className={styles.docketBody}>
                  <Stamp tone={verdictTone(tr)} size="sm">
                    {verdictLabel(tr.verdict.label)}
                  </Stamp>
                  <div>
                    <p className={styles.eyebrow}>{t('solo.docket.row.eyebrow', { caseNumber: formatCaseNo(tr.caseNumber), category: categoryLabel(tr.filing.category) })}</p>
                    <h2 className={styles.docketTitle}>
                      <Link className={styles.docketLink} to={soloPaths.case(id)}>
                        {tr.filing.title}
                      </Link>
                    </h2>
                    <p className={styles.small}>{t('solo.docket.row.summary', { a: tr.verdict.tally[0], b: tr.verdict.tally[1], sentence: tr.sentence?.text ?? '' })}</p>
                  </div>
                </article>
              </PaperPanel>
            );
          })}
        </ul>
      )}
    </div>
  );
}
