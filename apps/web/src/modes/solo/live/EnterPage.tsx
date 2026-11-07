import { Link } from 'react-router';
import { Icon } from '@/ds';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t } from '@/i18n';
import { soloPaths } from '../lib/paths';
import styles from './live.module.css';

/** The first step in the Solo court: someone else's case, or your own. */
export function EnterPage() {
  useDocumentTitle(t('solo.enter.title'));
  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t('solo.enter.title')}</h1>
      <p className={styles.lede}>{t('solo.enter.lede')}</p>
      <div className={styles.doors}>
        <Link className={styles.door} to={soloPaths.docket}>
          <span className={styles.doorIcon} aria-hidden>
            <Icon name="scales" />
          </span>
          <strong>{t('solo.enter.join.title')}</strong>
          <span>{t('solo.enter.join.body')}</span>
        </Link>
        <Link className={styles.door} to={soloPaths.file} data-autofocus>
          <span className={styles.doorIcon} aria-hidden>
            <Icon name="gavel" />
          </span>
          <strong>{t('solo.enter.file.title')}</strong>
          <span>{t('solo.enter.file.body')}</span>
        </Link>
      </div>
    </div>
  );
}
