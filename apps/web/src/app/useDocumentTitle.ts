import { useEffect } from 'react';
import { t } from '@/i18n';

/** Sets document.title as "<page> · CringeCourt" (or just the brand on the home page). */
export function useDocumentTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? t('shell.title.page', { title, app: t('common.app.name') }) : t('shell.title.home', { app: t('common.app.name') });
  }, [title]);
}
