import { formatAmount } from '@/i18n/domain';
import { Button, Icon, useToast } from '@/ds';
import { t } from '@/i18n';
import { useArcWallet } from '@/platform/ledger';
import { CIRCLE_FAUCET, METAMASK_DOWNLOAD } from '../arcLib';
import styles from '../GrandJury.module.css';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** The player's own MetaMask and real balance. There is no in-app wallet on Arc. */
export function ArcWalletChip() {
  const { account, balance, connect, hasWallet } = useArcWallet();
  const { toast } = useToast();
  if (!hasWallet) {
    return (
      <a className={styles.wallet} href={METAMASK_DOWNLOAD} target="_blank" rel="noreferrer">
        {t('grandJury.arc.install')}
      </a>
    );
  }
  if (!account) {
    return (
      <Button size="sm" iconStart={<Icon name="user" />} onClick={() => void connect().catch((e: unknown) => toast({ tone: 'danger', title: t('grandJury.arc.failed', { message: e instanceof Error ? e.message : String(e) }) }))}>
        {t('grandJury.arc.connect')}
      </Button>
    );
  }
  return (
    <div className={styles.wallet}>
      <span className={styles.walletLabel}>
        <Icon name="user" /> {short(account)}
      </span>
      <span className={styles.walletBalance} aria-live="polite">
        {balance === null ? '…' : formatAmount(balance)}
      </span>
      <a href={CIRCLE_FAUCET} target="_blank" rel="noreferrer">
        {t('grandJury.arc.getUsdc')}
      </a>
    </div>
  );
}
