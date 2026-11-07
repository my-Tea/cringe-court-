/**
 * Every mode's trial goes through this frame: the first-person roaming
 * courtroom is the primary view, the mode's classic stage the fallback. The
 * choice is one app-wide toggle (`trialView.ts`). Without WebGL2, or if the
 * roam view fails, the classic stage is shown and says why.
 */
import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Alert, Spinner } from '@/ds';
import { t } from '@/i18n';
import type { RoamTrialProps } from './RoamTrial';
import { TrialViewToggle } from './TrialViewToggle';
import { useTrialView } from './trialView';
import styles from './Trial.module.css';

const RoamTrial = lazy(async () => ({ default: (await import('./RoamTrial')).RoamTrial }));

class RoamBoundary extends Component<{ fallback: (error: Error) => ReactNode; children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override render() {
    return this.state.error ? this.props.fallback(this.state.error) : this.props.children;
  }
}

export interface TrialViewFrameProps {
  /** Hide the toolbar, for a recording. */
  bare?: boolean;
  /** The mode's existing stage. */
  classic: ReactNode;
  /** The roaming courtroom for the same hearing. */
  roam: Omit<RoamTrialProps, 'onExit'>;
  /** Extra controls beside the toggle. */
  toolbar?: ReactNode;
}

export function TrialViewFrame({ classic, roam, toolbar, bare = false }: TrialViewFrameProps) {
  const { view, setView, available } = useTrialView();
  const showRoam = available && view === 'roam';
  return (
    <div className={styles.frame} data-view={showRoam ? 'roam' : 'classic'}>
      {bare ? null : (
        <div className={styles.toolbar}>
          <TrialViewToggle />
          {!available && <p className={styles.note}>{t('trial.view.noWebgl')}</p>}
          {toolbar}
        </div>
      )}
      {showRoam ? (
        <RoamBoundary
          fallback={(error) => (
            <>
              <Alert tone="warning" title={t('trial.view.stopped')}>
                {error.message}
              </Alert>
              {classic}
            </>
          )}
        >
          <Suspense
            fallback={
              <div className={styles.loading} role="status">
                <Spinner label={null} /> {t('trial.view.opening')}
              </div>
            }
          >
            <RoamTrial {...roam} onExit={() => setView('classic')} />
          </Suspense>
        </RoamBoundary>
      ) : (
        classic
      )}
    </div>
  );
}
