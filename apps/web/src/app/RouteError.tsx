import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink, ErrorState } from '@/ds';

/** Last-resort boundary: something threw while rendering a route. */
export function RouteError() {
  const error = useRouteError();
  const details = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : String(error);
  return (
    <ErrorState
      title="The court hit a snag"
      headingLevel={1}
      details={details}
      onRetry={() => window.location.reload()}
      retryLabel="Reload"
      actions={
        <ButtonLink to="/" variant="secondary" reloadDocument>
          Back to the courthouse
        </ButtonLink>
      }
    >
      Nothing was charged and no case changed. Reload to try again.
    </ErrorState>
  );
}
