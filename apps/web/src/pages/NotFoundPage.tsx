import { paths } from '@/app/routes';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { ButtonLink, EmptyState, Icon, Stamp } from '@/ds';
import styles from './pages.module.css';

export function NotFoundPage() {
  useDocumentTitle('Case not found');
  return (
    <div className={styles.notFound}>
      <Stamp tone="no-verdict" size="lg" animate sub="Error 404">
        Case dismissed
      </Stamp>
      <EmptyState
        title="This page was never filed"
        character="judge"
        expression="shocked"
        headingLevel={1}
        actions={
          <ButtonLink to={paths.home} iconStart={<Icon name="arrow-left" />}>
            Back to the courthouse
          </ButtonLink>
        }
      >
        The court searched every docket. Check the address, or head back and pick a court.
      </EmptyState>
    </div>
  );
}
