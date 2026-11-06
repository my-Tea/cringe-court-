import { Icon } from '@/ds';
import { t, type MessageKey } from '@/i18n';
import { useTrialView, type TrialViewKind } from './trialView';
import styles from './TrialViewToggle.module.css';

const OPTIONS: ReadonlyArray<{ value: TrialViewKind; label: MessageKey; icon: 'eye' | 'document' }> = [
  { value: 'roam', label: 'trial.view.roam', icon: 'eye' },
  { value: 'classic', label: 'trial.view.classic', icon: 'document' },
];

/** Paper segmented switch between the roaming courtroom and the classic stage. Hidden when WebGL2 is missing. */
export function TrialViewToggle({ className }: { className?: string }) {
  const { view, setView, available } = useTrialView();
  if (!available) return null;
  return (
    <div role="group" aria-label={t('trial.view.group')} className={[styles.group, className].filter(Boolean).join(' ')}>
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" className={styles.option} aria-pressed={view === o.value} onClick={() => setView(o.value)}>
          <Icon name={o.icon} />
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}
