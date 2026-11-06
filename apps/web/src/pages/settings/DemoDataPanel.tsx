import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTrigger, Icon, PaperButton, useToast } from '@/ds';
import { DEMO_DATA_GROUPS, clearDemoData, countDemoData } from './demoData';
import styles from './Settings.module.css';

/** Lists what the demo courts keep in this browser and clears it on request. */
export function DemoDataPanel({ onCleared = () => window.location.reload() }: { onCleared?: () => void }) {
  const { toast } = useToast();
  const [counts, setCounts] = useState(() => countDemoData());
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  const reset = () => {
    const removed = clearDemoData();
    setCounts(countDemoData());
    toast({ tone: 'success', title: 'Demo court cleared', description: `${removed} saved ${removed === 1 ? 'entry' : 'entries'} removed. Fresh docket, fresh drama.` });
    onCleared();
  };

  return (
    <div className={styles.stack}>
      <p className={styles.body}>
        The demo courts run entirely in this browser. Cases, drafts, Versus personas and sealed ballots are saved here and nowhere
        else. Your sound and motion choices are kept when you reset.
      </p>
      <dl className={styles.rows}>
        {DEMO_DATA_GROUPS.map((g) => {
          const n = counts.get(g.prefix) ?? 0;
          return (
            <div key={g.prefix} className={styles.row}>
              <dt>{g.label}</dt>
              <dd>
                {n} {n === 1 ? 'entry' : 'entries'}
              </dd>
            </div>
          );
        })}
      </dl>
      <Dialog>
        <DialogTrigger asChild>
          <PaperButton variant="maroon" size="md" iconStart={<Icon name="refresh" />} disabled={total === 0}>
            Reset demo court
          </PaperButton>
        </DialogTrigger>
        <DialogContent
          title="Reset the demo court?"
          description="Every demo case, draft, persona and sealed ballot in this browser is deleted. Sealed ballots you have not revealed yet can never be revealed afterwards."
          tone="danger"
        >
          <div className={styles.dialogActions}>
            <DialogClose asChild>
              <PaperButton variant="ghost" size="md">
                Keep my cases
              </PaperButton>
            </DialogClose>
            <PaperButton variant="maroon" size="md" onClick={reset}>
              Reset everything
            </PaperButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
