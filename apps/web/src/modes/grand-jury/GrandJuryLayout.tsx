import { formatUsdc, usdc } from '@cringe-court/core';
import { NavLink, Outlet } from 'react-router';
import { Badge, Button, ErrorState, Icon, LoadingState, Tooltip, cx, useToast } from '@/ds';
import { paths } from './lib';
import { CourtProvider, useCourtContext } from './state/CourtProvider';
import { useWallet } from './state/hooks';
import styles from './GrandJury.module.css';

const NAV = [
  { to: paths.docket, label: 'Docket', icon: 'document' as const },
  { to: paths.duty, label: 'My court', icon: 'user' as const },
  { to: paths.pricing, label: 'Who pays', icon: 'scales' as const },
];

function WalletChip() {
  const wallet = useWallet();
  const { demo } = useCourtContext();
  const { toast } = useToast();
  const balance = wallet.state === 'ready' ? wallet.data.balance : null;
  const topUp = () => {
    demo.faucet(usdc('10.00'));
    toast({ tone: 'success', title: '10.00 test USDC added', description: 'Testnet money from the faucet. It has no value.' });
  };
  return (
    <div className={styles.wallet}>
      <span className={styles.walletLabel}>
        <Icon name="star" /> Test wallet
      </span>
      <span className={styles.walletBalance} aria-live="polite">
        {balance === null ? '…' : formatUsdc(balance)}
      </span>
      <Tooltip content="Mint test USDC from the testnet faucet stand-in">
        <Button size="sm" variant="ghost" onClick={topUp} iconStart={<Icon name="plus" />}>
          Faucet
        </Button>
      </Tooltip>
    </div>
  );
}

function CourtBar() {
  return (
    <div className={styles.courtBar}>
      <div className={styles.courtBarInner}>
        <nav aria-label="Grand Jury" className={styles.subNav}>
          <ul role="list">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} className={({ isActive }) => cx(styles.subNavLink, isActive && styles.subNavActive)}>
                  <Icon name={n.icon} /> {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <WalletChip />
      </div>
    </div>
  );
}

/**
 * Shell for every Grand Jury page: one court for the whole session, the mode's
 * own navigation, the test wallet, and honest loading/error states while the
 * court comes up.
 */
export function GrandJuryLayout() {
  return (
    <div className={styles.mode}>
      <CourtProvider
        fallback={(status, retry) =>
          status.state === 'loading' ? (
            <div className={styles.page}>
              <LoadingState title="Calling the court to order…">Seeding the public docket on the testnet ledger twin.</LoadingState>
            </div>
          ) : (
            <div className={styles.page}>
              <ErrorState title="The court could not sit" onRetry={retry} details={status.error.message}>
                The Grand Jury ledger did not load. Nothing was charged.
              </ErrorState>
            </div>
          )
        }
      >
        <CourtBar />
        <p className={styles.demoRibbon}>
          <Badge tone="info" solid>
            Testnet
          </Badge>
          <span>Demo docket with shortened deadlines (minutes, not days). Test USDC only, a mock World ID verifier, and a simulated crowd.</span>
        </p>
        <Outlet />
      </CourtProvider>
    </div>
  );
}
