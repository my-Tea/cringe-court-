import { micro, type Hex, type Usdc } from '@cringe-court/core';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Icon, PaperButton, PaperPanel, PaperRibbon, TestnetBadge } from '@/ds';
import { t } from '@/i18n';
import { backendClient } from '@/platform/backend';
import { platformConfig } from '@/platform/config';
import { identityFor } from '@/platform/identity';
import { appLedger } from '@/platform/ledger';
import styles from './ArcWalletGate.module.css';

const CIRCLE_FAUCET = 'https://faucet.circle.com';
const METAMASK = 'https://metamask.io/download/';
/** A case costs 1.20; the rest covers gas, which Arc charges in USDC. */
const NEEDED = micro(1_300_000n);
const POLL_MS = 5000;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const shown = (v: Usdc) => (Number(v) / 1e6).toFixed(2);

function backend() {
  const config = platformConfig.backend;
  if (!config) throw new Error('This build has no court server.');
  return backendClient(config);
}

/** Passes World ID, then has the relayer put this wallet on Arc's HumanRegistry. */
async function attestOnArc(account: Hex): Promise<void> {
  const ledger = appLedger();
  const client = backend();
  await client.connect();
  // World gives one proof per person, ever: someone already verified here must not be asked again.
  const { verified } = await client.connection.get<{ verified: boolean }>('/api/v1/chain/human');
  if (!verified) {
    const identity = identityFor(platformConfig, 'player', { token: () => client.connection.token, wallet: () => client.account ?? undefined });
    const request = { action: 'accept-jury-seat' as const, signal: 'cringecourt:juror', minLevel: 'orb' as const };
    const proof = await identity.requestProof(request);
    if (!proof.ok) throw new Error(proof.message);
    const screened = await identity.verify(proof.proof, request);
    if (!screened.ok) throw new Error(screened.message);
  }
  const { persona } = await client.connection.get<{ persona: { id: string } }>('/api/v1/sessions/me');
  const message = `CringeCourt: I own this wallet.\nWallet: ${account.toLowerCase()}\nSession: ${persona.id}`;
  const signature = await ledger.sign!(account, message);
  await client.connection.post('/api/v1/chain/attest', { wallet: account, signature });
}

function Step({ n, title, done, children }: { n: number; title: string; done: string | null; children?: React.ReactNode }) {
  return (
    <li className={styles.step} data-done={done ? true : undefined}>
      <span className={styles.mark} aria-hidden>
        {done ? <Icon name="check" /> : n}
      </span>
      <div className={styles.stepBody}>
        <h2 className={styles.stepTitle}>{title}</h2>
        {done ? <p className={styles.done}>{done}</p> : children}
      </div>
    </li>
  );
}

/** Wallet, human, funds: everything the court contract checks before it takes a stake. */
export function ArcWalletGate({ onReady }: { onReady: (account: Hex) => void }) {
  const ledger = appLedger();
  const [account, setAccount] = useState<Hex | null>(null);
  const [level, setLevel] = useState(0);
  const [balance, setBalance] = useState<Usdc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!account) return;
    const [l, b] = await Promise.all([ledger.humanLevel!(account), ledger.port.usdcBalance(account)]);
    setLevel(l);
    setBalance(b);
  }, [account, ledger]);

  useEffect(() => {
    void ledger.connect?.({ silent: true }).then((a) => a && setAccount(a));
  }, [ledger]);

  // The faucet is in another tab, so the balance is watched here.
  useEffect(() => {
    if (!account) return;
    void refresh().catch(() => undefined);
    const poll = setInterval(() => void refresh().catch(() => undefined), POLL_MS);
    return () => clearInterval(poll);
  }, [account, refresh]);

  const attempt = async (run: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const funded = balance !== null && balance >= NEEDED;
  const ready = !!account && level > 0 && funded;

  return (
    <PaperPanel as="section" className={styles.gate} padding="lg">
      <PaperRibbon as="h1" size="lg" sparks>
        {t('solo.arc.title')}
      </PaperRibbon>
      <p className={styles.lede}>
        {t('solo.arc.lede')} <TestnetBadge />
      </p>
      <ol className={styles.steps}>
        <Step n={1} title={t('solo.arc.step.wallet')} done={account ? t('solo.arc.step.wallet.done', { account: short(account) }) : null}>
          {ledger.hasWallet?.() ? (
            <PaperButton loading={busy} onClick={() => void attempt(async () => setAccount((await ledger.connect!()) ?? null))}>
              {t('solo.arc.connect')}
            </PaperButton>
          ) : (
            <a className={styles.link} href={METAMASK} target="_blank" rel="noreferrer">
              {t('solo.arc.install')}
            </a>
          )}
        </Step>
        <Step n={2} title={t('solo.arc.step.human')} done={level > 0 ? t('solo.arc.step.human.done') : null}>
          <p className={styles.body}>{t('solo.arc.step.human.body')}</p>
          <PaperButton
            disabled={!account}
            loading={busy}
            onClick={() =>
              void attempt(async () => {
                await attestOnArc(account!);
                await refresh();
              })
            }
          >
            {t('solo.arc.verify')}
          </PaperButton>
        </Step>
        <Step n={3} title={t('solo.arc.step.funds')} done={funded ? t('solo.arc.step.funds.done', { amount: shown(balance) }) : null}>
          <p className={styles.body}>{t('solo.arc.step.funds.body', { amount: shown(NEEDED) })}</p>
          {balance !== null ? <Badge tone="info">{t('solo.arc.step.funds.done', { amount: shown(balance) })}</Badge> : null}
          <a className={styles.link} href={CIRCLE_FAUCET} target="_blank" rel="noreferrer">
            {t('solo.arc.faucet')}
          </a>
        </Step>
      </ol>
      {error ? (
        <Alert tone="danger" title={t('solo.arc.failed', { message: error })} live="assertive">
          {null}
        </Alert>
      ) : null}
      <PaperButton size="lg" disabled={!ready} onClick={() => onReady(account!)}>
        {t('solo.arc.continue')}
      </PaperButton>
    </PaperPanel>
  );
}
