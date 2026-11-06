import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTrigger, Icon, PaperButton, useToast } from '@/ds';
import { t } from '@/i18n';
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
    toast({ tone: 'success', title: t('shell.demoData.cleared.title'), description: t('shell.demoData.cleared.body', { count: removed }) });
    onCleared();
  };

  return (
    <div className={styles.stack}>
      <p className={styles.body}>
        {t('shell.demoData.intro')}
      </p>
      <dl className={styles.rows}>
        {DEMO_DATA_GROUPS.map((g) => {
          const n = counts.get(g.prefix) ?? 0;
          return (
            <div key={g.prefix} className={styles.row}>
              <dt>{t(g.label)}</dt>
              <dd>
                {t('shell.demoData.entries', { count: n })}
              </dd>
            </div>
          );
        })}
      </dl>
      <Dialog>
        <DialogTrigger asChild>
          <PaperButton variant="maroon" size="md" iconStart={<Icon name="refresh" />} disabled={total === 0}>
            {t('shell.demoData.reset')}
          </PaperButton>
        </DialogTrigger>
        <DialogContent
          title={t('shell.demoData.confirm.title')}
          description={t('shell.demoData.confirm.body')}
          tone="danger"
        >
          <div className={styles.dialogActions}>
            <DialogClose asChild>
              <PaperButton variant="ghost" size="md">
                {t('shell.demoData.confirm.keep')}
              </PaperButton>
            </DialogClose>
            <PaperButton variant="maroon" size="md" onClick={reset}>
              {t('shell.demoData.confirm.reset')}
            </PaperButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
