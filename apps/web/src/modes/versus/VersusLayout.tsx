import { Outlet } from 'react-router';
import { BackendGate } from '@/platform/backend';
import { PersonaBar } from './components/PersonaBar';
import { RemoteVersusProvider } from './runtime/RemoteVersusProvider';
import { VersusProvider } from './runtime/VersusProvider';
import styles from './versus.module.css';

/** Every /versus/* page shares one court (one provider) and the persona bar: this device's demo court, or the shared court server. */
export function VersusLayout() {
  const body = (
    <div className={styles.versus}>
      <PersonaBar />
      <Outlet />
    </div>
  );
  return <BackendGate>{(court) => (court.kind === 'remote' ? <RemoteVersusProvider client={court.client}>{body}</RemoteVersusProvider> : <VersusProvider>{body}</VersusProvider>)}</BackendGate>;
}
