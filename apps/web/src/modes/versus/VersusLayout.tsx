import { Outlet } from 'react-router';
import { PersonaBar } from './components/PersonaBar';
import { VersusProvider } from './runtime/VersusProvider';
import styles from './versus.module.css';

/** Every /versus/* page shares one demo court (one provider) and the persona bar. */
export function VersusLayout() {
  return (
    <VersusProvider>
      <div className={styles.versus}>
        <PersonaBar />
        <Outlet />
      </div>
    </VersusProvider>
  );
}
