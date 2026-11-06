import { viewerOf } from '@cringe-court/modes-versus';
import { useParams } from 'react-router';
import { t } from '@/i18n';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { EmptyState, ErrorState, LoadingState, PaperButtonLink } from '@/ds';
import { CaseHeader } from '../components/CaseHeader';
import { CaseSounds } from '../components/CaseSounds';
import { CaseRail } from '../components/CaseRail';
import { StagePanel } from '../components/StagePanel';
import { versusPaths } from '../mode';
import { useVersus } from '../runtime/context';
import styles from '../versus.module.css';

/** One case, as the viewer in this tab sees it: header, the current stage, and the rail. */
export function CasePage() {
  const { trialId } = useParams();
  const { snapshot, error, persona, resetDemo } = useVersus();
  const c = snapshot?.cases.find((x) => x.trialId === trialId);
  useDocumentTitle(c ? c.state.filing.title : t('versus.casePage.title'));

  if (error) {
    return (
      <div className={styles.page}>
        <ErrorState title={t('versus.casePage.error.title')} details={error.message} onRetry={resetDemo} retryLabel={t('versus.persona.reset.confirm')}>
          {t('versus.casePage.error.body')}
        </ErrorState>
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className={styles.page}>
        <LoadingState title={t('versus.casePage.loading')} />
      </div>
    );
  }
  if (!c) {
    return (
      <div className={styles.page}>
        <EmptyState
          title={t('versus.casePage.missing.title')}
          character="clerk"
          expression="shocked"
          headingLevel={1}
          actions={
            <>
              <PaperButtonLink to={versusPaths.cases}>{t('versus.persona.myCases')}</PaperButtonLink>
              <PaperButtonLink to={versusPaths.newCase} variant="maroon">
                {t('versus.cases.start')}
              </PaperButtonLink>
            </>
          }
        >
          {t('versus.casePage.missing.body')}
        </EmptyState>
      </div>
    );
  }

  const viewer = viewerOf(c, persona.account);
  return (
    <>
      <CaseSounds key={c.trialId} c={c} />
      <CaseHeader c={c} viewer={viewer} />
      <div className={styles.room}>
        <div className={styles.roomMain}>
          <StagePanel c={c} viewer={viewer} />
        </div>
        <CaseRail c={c} viewer={viewer} />
      </div>
    </>
  );
}
