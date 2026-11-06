import { toDataURL } from 'qrcode';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, PaperButton, Spinner } from '@/ds';
import { t } from '@/i18n';
import { QR_COLORS } from './qr.tokens';
import styles from './WorldIdConnectDialog.module.css';

export interface WorldIdConnectDialogProps {
  /** The World App link; the dialog is open while this is set. */
  uri: string | null;
  onCancel: () => void;
}

const QR_PX = 240;

/** Shows the World App link as a QR code while IDKit waits for the user to approve on their phone. */
export function WorldIdConnectDialog({ uri, onCancel }: WorldIdConnectDialogProps) {
  const [drawn, setDrawn] = useState<{ uri: string; image: string } | null>(null);
  const qr = drawn && drawn.uri === uri ? drawn.image : null;

  useEffect(() => {
    if (!uri) return;
    let live = true;
    // Twice the shown size, so the code stays sharp on a high-density screen.
    void toDataURL(uri, { width: QR_PX * 2, margin: 2, errorCorrectionLevel: 'M', color: QR_COLORS }).then((image) => {
      if (live) setDrawn({ uri, image });
    });
    return () => {
      live = false;
    };
  }, [uri]);

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
          <div className={styles.qr}>
            {qr ? <img src={qr} alt={t('shell.worldId.qr')} width={QR_PX} height={QR_PX} /> : <Spinner label={t('shell.worldId.waiting')} />}
          </div>
          <p className={styles.status} role="status">
            <Spinner size="sm" label={null} /> {t('shell.worldId.waiting')}
          </p>
          {uri && (
            <PaperButton variant="ghost" onClick={() => window.open(uri, '_blank', 'noopener,noreferrer')}>
              {t('shell.worldId.open')}
            </PaperButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
