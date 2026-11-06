import { Icon } from '@/ds';
import { useTrialView, type TrialViewKind } from './trialView';
import styles from './TrialViewToggle.module.css';

const OPTIONS: ReadonlyArray<{ value: TrialViewKind; label: string; icon: 'eye' | 'document' }> = [
  { value: 'roam', label: 'First person', icon: 'eye' },
  { value: 'classic', label: 'Classic stage', icon: 'document' },
];

/** Paper segmented switch between the roaming courtroom and the classic stage. Hidden when WebGL2 is missing. */
export function TrialViewToggle({ className }: { className?: string }) {
  const { view, setView, available } = useTrialView();
  if (!available) return null;
  return (
    <div role="group" aria-label="Trial view" className={[styles.group, className].filter(Boolean).join(' ')}>
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" className={styles.option} aria-pressed={view === o.value} onClick={() => setView(o.value)}>
          <Icon name={o.icon} />
          {o.label}
        </button>
      ))}
    </div>
  );
}
