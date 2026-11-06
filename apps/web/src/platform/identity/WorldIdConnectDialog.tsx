import { useState } from 'react';
import { Alert, Dialog, DialogContent, PaperButton, Spinner } from '@/ds';
import { t } from '@/i18n';
import styles from './WorldIdConnectDialog.module.css';

export interface WorldIdConnectDialogProps {
  /** The World App link; the dialog is open while this is set. */
  uri: string | null;
  onCancel: () => void;
}

/** Shows the World App link while IDKit waits for the user to approve. No QR code is rendered in this build. */
export function WorldIdConnectDialog({ uri, onCancel }: WorldIdConnectDialogProps) {
  const [result, setResult] = useState<{ uri: string; state: 'done' | 'failed' } | null>(null);
  const copied = result && result.uri === uri ? result.state : 'idle';
  const setCopied = (state: 'done' | 'failed') => uri && setResult({ uri, state });
  const copy = async () => {
    if (!uri) return;
    try {
      await navigator.clipboard.writeText(uri);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
  };
  return (
    <Dialog open={uri !== null} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        title={t('shell.worldId.title')}
        description={t('shell.worldId.description')}
        size="sm"
        footer={
          <PaperButton variant="ghost" onClick={onCancel}>
            {t('common.action.cancel')}
          </PaperButton>
        }
      >
        <div className={styles.body}>
          <div className={styles.actions}>
            {uri && (
              <PaperButton onClick={() => window.open(uri, '_blank', 'noopener,noreferrer')}>{t('shell.worldId.open')}</PaperButton>
            )}
            <PaperButton variant="ghost" onClick={copy}>
              {copied === 'done' ? t('shell.worldId.copied') : t('shell.worldId.copy')}
            </PaperButton>
          </div>
          <p className={styles.link} data-testid="world-id-link">
            {uri}
          </p>
          {copied === 'failed' && (
            <Alert tone="warning" title={t('shell.worldId.copyFailed.title')} live="polite">
              {t('shell.worldId.copyFailed.body')}
            </Alert>
          )}
          <p className={styles.status} role="status">
            <Spinner size="sm" label={null} /> {t('shell.worldId.waiting')}
          </p>
          <p className={styles.note}>{t('shell.worldId.note')}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
