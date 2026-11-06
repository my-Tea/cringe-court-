import { usdc } from '@cringe-court/core';
import { formatAmount } from '@/i18n/domain';
import { NavLink, Outlet } from 'react-router';
import { t, type MessageKey } from '@/i18n';
import { Badge, Button, ErrorState, Icon, LoadingState, Tooltip, cx, useToast } from '@/ds';
import { BackendGate, useBackendLink, type BackendClient } from '@/platform/backend';
import { appLedger } from '@/platform/ledger';
import { ArcWalletChip } from './components/ArcWalletChip';
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
    demo.faucet(usdc('10.00')).then(
      () => toast({ tone: 'success', title: t('grandJury.layout.faucet.toast.title'), description: t('grandJury.layout.faucet.toast.body') }),
      (err: unknown) => toast({ tone: 'danger', title: t('grandJury.layout.faucet.button'), description: err instanceof Error ? err.message : String(err) }),
    );
  };
  return (
    <div className={styles.wallet}>
      <span className={styles.walletLabel}>
        <Icon name="star" /> {t('grandJury.layout.wallet.label')}
      </span>
      <span className={styles.walletBalance} aria-live="polite">
        {balance === null ? '…' : formatAmount(balance)}
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
  const arc = appLedger().kind === 'arc-testnet';
  return (
    <div className={styles.courtBar}>
      <div className={styles.courtBarInner}>
        <nav aria-label={t('grandJury.layout.nav.label')} className={styles.subNav}>
          <ul role="list">
            {NAV.filter((n) => !arc || n.to !== paths.duty).map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} className={({ isActive }) => cx(styles.subNavLink, isActive && styles.subNavActive)}>
                  <Icon name={n.icon} /> {t(n.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        {arc ? <ArcWalletChip /> : <WalletChip />}
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
  return <BackendGate>{(court) => <GrandJuryCourt client={court.kind === 'remote' ? court.client : null} />}</BackendGate>;
}

function CourtRibbon({ client }: { client: BackendClient | null }) {
  const status = useBackendLink(client);
  if (client) {
    return (
      <p className={styles.demoRibbon}>
        <Badge tone={status === t('backend.status.live') ? 'success' : 'highlight'} solid>
          {status ?? t('backend.status.connecting')}
        </Badge>
        <span>{t('backend.gj.ribbon', { host: client.host })}</span>
      </p>
    );
  }
  return (
    <p className={styles.demoRibbon}>
      <Badge tone="info" solid>
        {t('grandJury.layout.ribbon.badge')}
      </Badge>
      <span>{t('grandJury.layout.ribbon.text')}</span>
    </p>
  );
}

function GrandJuryCourt({ client }: { client: BackendClient | null }) {
  return (
    <div className={styles.mode}>
      <CourtProvider
        client={client}
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
        {appLedger().kind === 'arc-testnet' ? null : <CourtRibbon client={client} />}
        <Outlet />
      </CourtProvider>
    </div>
  );
}
