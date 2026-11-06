import type { SoloSnapshot } from '@cringe-court/modes-solo';
import { useEffect, useState } from 'react';
import { Alert, PaperButton, PaperPanel } from '@/ds';
import { t } from '@/i18n';
import { appLedger } from '@/platform/ledger';

/** After a real stake. There is no scripted jury here: a real case waits for real jurors, or pays the filer back. */
export function ArcCaseStatus({ snap }: { snap: SoloSnapshot }) {
  const ledger = appLedger();
  const caseNumber = 'caseNumber' in snap.trial ? snap.trial.caseNumber : null;
  const tx = snap.txs.opened;
  const [deadline, setDeadline] = useState<number | null>(null);
  const [refunded, setRefunded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (caseNumber === null) return;
    void ledger.port.getCase(caseNumber).then((c) => setDeadline(c?.deadlines.recruitment ?? null));
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(tick);
  }, [caseNumber, ledger]);

  const refund = async () => {
    if (caseNumber === null) return;
    setBusy(true);
    setError(null);
    try {
      await ledger.port.advance(caseNumber);
      await ledger.port.claim(caseNumber);
      setRefunded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PaperPanel as="section" padding="lg" aria-labelledby="arc-status">
      <h2 id="arc-status">{t('solo.arc.status.title')}</h2>
      <p>{t('solo.arc.status.body')}</p>
      {tx ? (
        <p>
          <a href={tx.explorerUrl} target="_blank" rel="noreferrer">
            {t('solo.arc.status.tx')}
          </a>
        </p>
      ) : null}
      {deadline ? <p>{t('solo.arc.status.deadline', { time: new Date(deadline * 1000).toLocaleString() })}</p> : null}
      {error ? (
        <Alert tone="danger" title={t('solo.arc.failed', { message: error })}>
          {null}
        </Alert>
      ) : null}
      {refunded ? <p role="status">{t('solo.arc.status.refunded')}</p> : null}
      {deadline && now >= deadline * 1000 && !refunded ? (
        <PaperButton loading={busy} onClick={() => void refund()}>
          {t('solo.arc.status.refund')}
        </PaperButton>
      ) : null}
    </PaperPanel>
  );
}
