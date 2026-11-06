import { useState, type ReactElement } from 'react';
import { Badge, Dialog, DialogContent, DialogTrigger, Icon, PaperButton } from '@/ds';
import styles from '../versus.module.css';

export interface WorldIdDialogProps {
  title: string;
  /** Why this proof is needed, in one sentence. */
  purpose: string;
  confirmLabel: string;
  /** Runs the command that requests the proof. Resolve true to close the dialog. */
  onVerified: () => Promise<unknown>;
  trigger: ReactElement;
}

/**
 * The World ID step. In this build the proof comes from the mock verifier
 * (staging, D14), and the dialog says so; the real IDKit widget replaces the
 * confirm button behind the same IdentityPort.
 */
export function WorldIdDialog({ title, purpose, confirmLabel, onVerified, trigger }: WorldIdDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={title}
        description={purpose}
        size="sm"
        footer={
          <>
            <PaperButton variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </PaperButton>
            <PaperButton
              iconStart={<Icon name="check" />}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onVerified();
                } finally {
                  setBusy(false);
                  setOpen(false);
                }
              }}
            >
              {confirmLabel}
            </PaperButton>
          </>
        }
      >
        <div className={styles.worldId}>
          <span className={styles.worldIdMark} aria-hidden>
            <Icon name="user" />
          </span>
          <div>
            <p className={styles.worldIdTitle}>
              World ID <Badge tone="info">Staging · mock verifier</Badge>
            </p>
            <ul className={styles.worldIdList} role="list">
              <li>
                <Icon name="check" aria-hidden /> Shared with the court: a one-time code for this case (a nullifier). No name, face or wallet history.
              </li>
              <li>
                <Icon name="check" aria-hidden /> One human, one role: the same person cannot be both sides, or a side and a juror.
              </li>
              <li>
                <Icon name="info" aria-hidden /> This demo build verifies with a mock; nothing is sent to World.
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
