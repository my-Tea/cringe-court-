import { useState } from 'react';
import { Alert, Dialog, DialogContent, PaperButton, Spinner } from '@/ds';
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
        title="Verify with World ID"
        description="Open World App and approve the request. The court never learns who you are."
        size="sm"
        footer={
          <PaperButton variant="ghost" onClick={onCancel}>
            Cancel
          </PaperButton>
        }
      >
        <div className={styles.body}>
          <div className={styles.actions}>
            {uri && (
              <PaperButton onClick={() => window.open(uri, '_blank', 'noopener,noreferrer')}>Open in World App</PaperButton>
            )}
            <PaperButton variant="ghost" onClick={copy}>
              {copied === 'done' ? 'Link copied' : 'Copy link'}
            </PaperButton>
          </div>
          <p className={styles.link} data-testid="world-id-link">
            {uri}
          </p>
          {copied === 'failed' && (
            <Alert tone="warning" title="Could not copy" live="polite">
              Select the link above and copy it by hand.
            </Alert>
          )}
          <p className={styles.status} role="status">
            <Spinner size="sm" label={null} /> Waiting for World App…
          </p>
          <p className={styles.note}>Honest note: this build does not render a QR code. On a computer, send the link to your phone and open it in World App.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
