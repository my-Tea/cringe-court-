import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { ButtonLink, EmptyState, Icon, Stamp } from '@/ds';
import { t } from '@/i18n';
import styles from './pages.module.css';

export function NotFoundPage() {
  useDocumentTitle(t('shell.notFound.docTitle'));
  return (
    <div className={styles.notFound}>
      <Stamp tone="no-verdict" size="lg" animate sub={t('shell.notFound.sub')}>
        {t('shell.notFound.stamp')}
      </Stamp>
      <EmptyState
        title={t('shell.notFound.title')}
        character="judge"
        expression="shocked"
        headingLevel={1}
        actions={
          <ButtonLink to={paths.home} iconStart={<Icon name="arrow-left" />}>
            {t('common.action.backToCourthouse')}
          </ButtonLink>
        }
      >
        {t('shell.notFound.body')}
      </EmptyState>
    </div>
  );
}
