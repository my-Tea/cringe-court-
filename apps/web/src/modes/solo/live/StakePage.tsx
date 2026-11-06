import type { Usdc } from '@cringe-court/core';
import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { Alert, Icon, PaperButton, TestnetBadge, cx } from '@/ds';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t } from '@/i18n';
import { formatAmount } from '@/i18n/domain';
import { appLedger, useArcWallet } from '@/platform/ledger';
import { soloPaths } from '../lib/paths';
import { attestOnArc } from './attest';
import { confessionHash, readDraft, writeCase } from './liveCase';
import styles from './live.module.css';

const JURIES = [3, 5, 7] as const;
type Jury = (typeof JURIES)[number];
interface Price {
  price: Usdc;
  bond: Usdc;
  successBonus: Usdc;
}

const CIRCLE_FAUCET = 'https://faucet.circle.com';
const METAMASK = 'https://metamask.io/download/';
const RETRY_MS = 4000;

/** Page two: how big a jury, and one button. The wallet only asks for what is actually missing. */
export function StakePage() {
  useDocumentTitle(t('solo.live.stake.title'));
  const ledger = appLedger();
  const navigate = useNavigate();
  const wallet = useArcWallet();
  const [draft] = useState(readDraft);
  const [jurors, setJurors] = useState<Jury>(3);
  const [prices, setPrices] = useState<Partial<Record<Jury, Price>>>({});
  const [level, setLevel] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [priceFailed, setPriceFailed] = useState(false);
  const [priceTry, setPriceTry] = useState(0);

  // One at a time: the public RPC refuses bursts. Prices never change on a page, so one good read is enough.
  useEffect(() => {
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setPriceFailed(false);
    void (async () => {
      try {
        for (const j of JURIES) {
          if (prices[j]) continue;
          const p = await ledger.port.soloPrice(j);
          if (!live) return;
          setPrices((all) => ({ ...all, [j]: p }));
        }
      } catch {
        if (!live) return;
        setPriceFailed(true);
        // Arc recovers on its own, so nobody should have to keep pressing a button.
        retry = setTimeout(() => setPriceTry((n) => n + 1), RETRY_MS);
      }
    })();
    return () => {
      live = false;
      clearTimeout(retry);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `prices` only skips what already loaded
  }, [ledger, priceTry]);

  const readLevel = useCallback(async () => {
    if (wallet.account) setLevel(await ledger.humanLevel!(wallet.account));
  }, [ledger, wallet.account]);

  useEffect(() => {
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const attemptRead = () => {
      readLevel().catch(() => {
        if (live) retry = setTimeout(attemptRead, RETRY_MS);
      });
    };
    attemptRead();
    return () => {
      live = false;
      clearTimeout(retry);
    };
  }, [readLevel]);

  if (!draft) return <Navigate to={soloPaths.file} replace />;

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

  const chosen = prices[jurors];
  const short = !!chosen && wallet.balance !== null && wallet.balance < chosen.price;

  const stake = () =>
    attempt(async () => {
      if (!chosen) return;
      // A remembered address is not permission: MetaMask must authorize this site and be on Arc right now.
      if (!(await wallet.connect())) return;
      const { caseNumber, receipt } = await ledger.port.fileSoloJury({ title: draft.title, contentHash: confessionHash(draft), jurors, price: chosen.price });
      writeCase(String(caseNumber), { ...draft, txHash: receipt.hash, explorerUrl: receipt.explorerUrl, jurors });
      navigate(soloPaths.trial(caseNumber));
    });

  const action = !wallet.hasWallet ? (
    <a className={styles.primaryLink} href={METAMASK} target="_blank" rel="noreferrer">
      {t('solo.live.stake.install')}
    </a>
  ) : !wallet.account ? (
    <PaperButton size="lg" className={styles.primary} loading={busy} onClick={() => void attempt(async () => void (await wallet.connect()))}>
      {t('solo.live.stake.connect')}
    </PaperButton>
  ) : level === 0 ? (
    <>
      <p className={styles.hint}>{t('solo.live.stake.humanWhy')}</p>
      <PaperButton
        size="lg"
        className={styles.primary}
        loading={busy}
        onClick={() =>
          void attempt(async () => {
            if (!(await wallet.connect())) return;
            await attestOnArc(wallet.account!);
            await readLevel();
          })
        }
      >
        {t('solo.live.stake.human')}
      </PaperButton>
    </>
  ) : short ? (
    <>
      <p className={styles.hint}>{t('solo.live.stake.short', { amount: formatAmount(chosen.price) })}</p>
      <a className={styles.primaryLink} href={CIRCLE_FAUCET} target="_blank" rel="noreferrer">
        {t('solo.live.stake.faucet')}
      </a>
    </>
  ) : (
    <PaperButton size="lg" className={styles.primary} loading={busy} disabled={!chosen || level === null} iconStart={<Icon name="gavel" />} onClick={() => void stake()}>
      {busy ? t('solo.live.stake.approve') : t('solo.live.stake.go', { amount: chosen ? formatAmount(chosen.price) : '…' })}
    </PaperButton>
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>{t('solo.live.stake.title')}</h1>
      <p className={styles.lede}>{t('solo.live.stake.lede')}</p>
      <blockquote className={styles.quote}>{draft.story}</blockquote>
      <div className={styles.juries} role="radiogroup" aria-label={t('solo.live.stake.title')}>
        {JURIES.map((j, i) => {
          const p = prices[j];
          return (
            <button key={j} type="button" role="radio" aria-checked={jurors === j} className={cx(styles.jury, jurors === j && styles.juryOn)} style={{ animationDelay: `${i * 80}ms` }} onClick={() => setJurors(j)}>
              <span className={styles.jurySeats} aria-hidden>
                {Array.from({ length: j }, (_, s) => (
                  <span key={s} className={styles.seat} />
                ))}
              </span>
              <strong className={styles.juryName}>{t('solo.live.stake.seats', { jurors: j })}</strong>
              <span className={styles.juryPrice}>{p ? formatAmount(p.price) : '…'}</span>
              <span className={styles.juryNote}>{t('solo.live.stake.toWin', { votes: (j + 1) / 2 })}</span>
              {p ? <span className={styles.juryNote}>{t('solo.live.stake.jurorStake', { amount: formatAmount(p.bond) })}</span> : null}
              {p ? <span className={styles.juryNote}>{t('solo.live.stake.jurorBonus', { amount: formatAmount(p.successBonus) })}</span> : null}
            </button>
          );
        })}
      </div>
      {error ? (
        <Alert tone="danger" title={t('solo.live.stake.failed', { message: error })} live="assertive">
          {null}
        </Alert>
      ) : null}
      {priceFailed ? (
        <div className={styles.actions}>
          <p className={styles.hint} role="alert">
            {t('solo.live.stake.priceFailed')}
          </p>
          <PaperButton variant="maroon" onClick={() => setPriceTry((n) => n + 1)}>
            {t('solo.live.stake.retry')}
          </PaperButton>
        </div>
      ) : null}
      <div className={styles.actions}>{action}</div>
      <div className={styles.row}>
        <Link className={styles.textButton} to={soloPaths.file}>
          {t('solo.live.stake.back')}
        </Link>
        <span className={styles.count}>
          {wallet.balance !== null ? t('solo.live.stake.balance', { amount: formatAmount(wallet.balance) }) : null} <TestnetBadge />
        </span>
      </div>
    </div>
  );
}
