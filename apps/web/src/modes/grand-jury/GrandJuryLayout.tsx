import { formatUsdc, usdc } from '@cringe-court/core';
import { NavLink, Outlet } from 'react-router';
import { t, type MessageKey } from '@/i18n';
import { Badge, Button, ErrorState, Icon, LoadingState, Tooltip, cx, useToast } from '@/ds';
import { paths } from './lib';
import { useCourtContext } from './state/context';
import { CourtProvider } from './state/CourtProvider';
import { useWallet } from './state/hooks';
import styles from './GrandJury.module.css';

const NAV: readonly { to: string; label: MessageKey; icon: 'document' | 'user' | 'scales' }[] = [
  { to: paths.docket, label: 'grandJury.layout.nav.docket', icon: 'document' },
  { to: paths.duty, label: 'grandJury.layout.nav.duty', icon: 'user' },
  { to: paths.pricing, label: 'grandJury.layout.nav.pricing', icon: 'scales' },
];

function WalletChip() {
  const wallet = useWallet();
  const { demo } = useCourtContext();
  const { toast } = useToast();
  const balance = wallet.state === 'ready' ? wallet.data.balance : null;
  const topUp = () => {
    demo.faucet(usdc('10.00'));
    toast({ tone: 'success', title: t('grandJury.layout.faucet.toast.title'), description: t('grandJury.layout.faucet.toast.body') });
  };
  return (
    <div className={styles.wallet}>
      <span className={styles.walletLabel}>
        <Icon name="star" /> {t('grandJury.layout.wallet.label')}
      </span>
      <span className={styles.walletBalance} aria-live="polite">
        {balance === null ? '…' : formatUsdc(balance)}
      </span>
      <Tooltip content={t('grandJury.layout.faucet.tooltip')}>
        <Button size="sm" variant="ghost" onClick={topUp} iconStart={<Icon name="plus" />}>
          {t('grandJury.layout.faucet.button')}
        </Button>
      </Tooltip>
    </div>
  );
}

function CourtBar() {
  return (
    <div className={styles.courtBar}>
      <div className={styles.courtBarInner}>
        <nav aria-label={t('grandJury.layout.nav.label')} className={styles.subNav}>
          <ul role="list">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} className={({ isActive }) => cx(styles.subNavLink, isActive && styles.subNavActive)}>
                  <Icon name={n.icon} /> {t(n.label)}
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
              <LoadingState title={t('grandJury.layout.loading.title')}>{t('grandJury.layout.loading.body')}</LoadingState>
            </div>
          ) : (
            <div className={styles.page}>
              <ErrorState title={t('grandJury.layout.error.title')} onRetry={retry} details={status.error.message}>
                {t('grandJury.layout.error.body')}
              </ErrorState>
            </div>
          )
        }
      >
        <CourtBar />
        <p className={styles.demoRibbon}>
          <Badge tone="info" solid>
            {t('grandJury.layout.ribbon.badge')}
          </Badge>
          <span>{t('grandJury.layout.ribbon.text')}</span>
        </p>
        <Outlet />
      </CourtProvider>
    </div>
  );
}
