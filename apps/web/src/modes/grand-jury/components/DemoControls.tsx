import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { useState } from 'react';
import { Button, Icon, Tooltip, useToast } from '@/ds';
import { t } from '@/i18n';
import { useCourtContext } from '../state/context';
import { useCourtNow } from '../state/hooks';
import styles from '../GrandJury.module.css';

/**
 * Demo-only time travel: jump to the end of the current window so a visitor can
 * see the whole case in a minute. The contracts would wait; the demo ledger's
 * clock just moves forward (it never moves back).
 */
export function DemoControls({ detail }: { detail: CaseDetail }) {
  const { demo } = useCourtContext();
  const { toast } = useToast();
  const now = useCourtNow();
  const [busy, setBusy] = useState(false);
  if (!detail.demoTiming || detail.phaseEndsAt === null) return null;
  const left = detail.phaseEndsAt - now;
  if (left <= 0) return null;

  const skip = async () => {
    setBusy(true);
    try {
      await demo.skip(detail.caseNumber);
    } catch (err) {
      toast({ tone: 'danger', title: t('grandJury.demo.clock'), description: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.demoControls}>
      <Icon name="clock" />
      <span>{t('grandJury.demo.clock')}</span>
      <Tooltip content={t('grandJury.demo.skip.tooltip')}>
        <Button size="sm" variant="ghost" onClick={skip} loading={busy}>
          {t('grandJury.demo.skip.button')}
        </Button>
      </Tooltip>
    </div>
  );
}
