import type { BackendError } from '@cringe-court/net';
import { t } from '@/i18n';

/**
 * Words for a court-server failure. Transport failures are translated here;
 * a refusal by the court's rules carries the court's own message (the same
 * English the local demo shows for the same refusal).
 */
export function describeBackendError(err: BackendError): string {
  switch (err.code) {
    case 'unreachable':
      return t('backend.error.unreachable');
    case 'timeout':
      return t('backend.error.timeout');
    case 'rate-limited':
      return t('backend.error.rateLimited', { seconds: err.retryAfter ?? 5 });
    case 'unauthorized':
      return t('backend.error.unauthorized');
    case 'full':
      return t('backend.error.full');
    case 'disabled':
      return t('backend.error.disabled');
    case 'server':
      return t('backend.error.server');
    case 'bad-response':
      return t('backend.error.badResponse');
    default:
      return err.message;
  }
}
