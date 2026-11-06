/**
 * Every mode's trial goes through this frame: the first-person roaming
 * courtroom is the primary view, the mode's classic stage the fallback. The
 * choice is one app-wide toggle (`trialView.ts`). Without WebGL2, or if the
 * roam view fails, the classic stage is shown and says why.
 */
import { Component, Suspense, lazy, type ReactNode } from 'react';
import { Alert, Spinner } from '@/ds';
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
  /** The mode's existing stage. */
  classic: ReactNode;
  /** The roaming courtroom for the same hearing. */
  roam: Omit<RoamTrialProps, 'onExit'>;
  /** Extra controls beside the toggle. */
  toolbar?: ReactNode;
}

export function TrialViewFrame({ classic, roam, toolbar }: TrialViewFrameProps) {
  const { view, setView, available } = useTrialView();
  const showRoam = available && view === 'roam';
  return (
    <div className={styles.frame} data-view={showRoam ? 'roam' : 'classic'}>
      <div className={styles.toolbar}>
        <TrialViewToggle />
        {!available && <p className={styles.note}>This browser has no WebGL2, so the hearing plays on the classic stage.</p>}
        {toolbar}
      </div>
      {showRoam ? (
        <RoamBoundary
          fallback={(error) => (
            <>
              <Alert tone="warning" title="The roaming courtroom stopped, so here is the classic stage">
                {error.message}
              </Alert>
              {classic}
            </>
          )}
        >
          <Suspense
            fallback={
              <div className={styles.loading} role="status">
                <Spinner label={null} /> Opening the courtroom doors…
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
