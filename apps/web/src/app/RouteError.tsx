import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink, ErrorState } from '@/ds';
import { t } from '@/i18n';

/** Last-resort boundary: something threw while rendering a route. */
export function RouteError() {
  const error = useRouteError();
  const details = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error);
  return (
    <ErrorState
      title={t('shell.error.route.title')}
      headingLevel={1}
      details={details}
      onRetry={() => window.location.reload()}
      retryLabel={t('common.action.reload')}
      actions={
        <ButtonLink to="/" variant="secondary" reloadDocument>
          {t('common.action.backToCourthouse')}
        </ButtonLink>
      }
    >
      {t('shell.error.route.body')}
    </ErrorState>
  );
}
