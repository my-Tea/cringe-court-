import { micro, type CaseNumber, type ChainCase, type Hex, type Usdc } from '@cringe-court/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PaperButton, PaperRibbon, useToast } from '@/ds';
import { useDocumentTitle } from '@/app/useDocumentTitle';
import { t } from '@/i18n';
import { formatAmount } from '@/i18n/domain';
import { backendClient } from '@/platform/backend';
import { platformConfig } from '@/platform/config';
import { appLedger, useArcWallet } from '@/platform/ledger';
import { questionOf } from '../arcLib';
import styles from '../GrandJury.module.css';

const CHIPS: readonly Usdc[] = [micro(100_000n), micro(500_000n), micro(1_000_000n)];
const POLL_MS = 20000;

async function publishCase(): Promise<void> {
  const config = platformConfig.backend;
  if (!config) return;
  const client = backendClient(config);
  await client.connect();
  await client.connection.post('/api/v1/chain/grand-jury/publish', {});
}

/** The Grand Jury on Arc: only cases that exist on chain, funded only from the player's own wallet. */
export function ArcDocketPage() {
  useDocumentTitle(t('grandJury.arc.title'));
  const ledger = appLedger();
  const wallet = useArcWallet();
  const { toast } = useToast();
  const [cases, setCases] = useState<readonly ChainCase[] | null>(null);
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState<CaseNumber | null>(null);
  const [receipt, setReceipt] = useState<{ amount: Usdc; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(false);

  const load = useCallback(async () => {
    const all = await ledger.port.listCases({ mode: 'grand-jury', phase: 'pre-trial' });
    setCases(all);
    return all;
  }, [ledger]);

  useEffect(() => {
    const first = async () => {
      if ((await load()).length > 0 || asked.current) return;
      asked.current = true;
      setOpening(true);
      await publishCase();
      await load();
    };
    first()
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setOpening(false));
    const poll = setInterval(() => {
      if (!document.hidden) void load().catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [load]);

  const chip = async (caseNumber: CaseNumber, amount: Usdc) => {
    setBusy(caseNumber);
    setError(null);
    setReceipt(null);
    try {
      // A remembered address is not permission: MetaMask must authorize this site and be on Arc right now.
      const account: Hex | null = await wallet.connect();
      if (!account) return;
      const paid = await ledger.port.fund(caseNumber, amount);
      setReceipt({ amount, url: paid.explorerUrl });
      toast({ tone: 'success', title: t('grandJury.arc.done', { amount: formatAmount(amount) }) });
      await Promise.all([load(), wallet.refresh()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={styles.arcDocket}>
      <PaperRibbon as="h1" size="lg" sparks>
        {t('grandJury.arc.title')}
      </PaperRibbon>
      <p>{t('grandJury.arc.lede')}</p>
      {error ? (
        <Alert tone="danger" title={t('grandJury.arc.failed', { message: error })} live="assertive">
          {null}
        </Alert>
      ) : null}
      {receipt ? (
        <p role="status">
          {t('grandJury.arc.done', { amount: formatAmount(receipt.amount) })}{' '}
          <a href={receipt.url} target="_blank" rel="noreferrer">
            {t('grandJury.arc.tx')}
          </a>
        </p>
      ) : null}
      {cases === null ? <p role="status">{t('grandJury.arc.loading')}</p> : null}
      {opening ? <p role="status">{t('grandJury.arc.opening')}</p> : null}
      {cases?.length === 0 && !opening ? <p>{t('grandJury.arc.empty')}</p> : null}
      <ol className={styles.arcCases}>
        {cases?.map((c) => (
          <li key={c.number} className={styles.arcCase}>
            <p className={styles.arcCaseNo}>{t('grandJury.arc.case', { number: String(c.number) })}</p>
            <h2>{questionOf(c.transcriptHash) ?? t('grandJury.arc.unknown')}</h2>
            <progress max={Number(c.terms.target)} value={Number(c.raised)} aria-label={t('grandJury.arc.raised', { raised: formatAmount(c.raised), target: formatAmount(c.terms.target) })} />
            <p>{t('grandJury.arc.raised', { raised: formatAmount(c.raised), target: formatAmount(c.terms.target) })}</p>
            {c.deadlines.funding ? <p>{t('grandJury.arc.closes', { time: new Date(c.deadlines.funding * 1000).toLocaleString() })}</p> : null}
            <div className={styles.arcChips}>
              {CHIPS.map((amount) => (
                <PaperButton key={String(amount)} size="sm" loading={busy === c.number} onClick={() => void chip(c.number, amount)}>
                  {t('grandJury.arc.chip', { amount: formatAmount(amount) })}
                </PaperButton>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
