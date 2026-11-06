import type { CaseDetail } from '@cringe-court/modes-grand-jury';
import { useState } from 'react';
import { Button, Icon, Tooltip } from '@/ds';
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
  const now = useCourtNow();
  const [busy, setBusy] = useState(false);
  if (!detail.demoTiming || detail.phaseEndsAt === null) return null;
  const left = detail.phaseEndsAt - now;
  if (left <= 0) return null;

  const skip = async () => {
    setBusy(true);
    try {
      await demo.sim.catchUp(detail.caseNumber);
      demo.clock.skip(left + 1);
      await demo.sim.tick();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.demoControls}>
      <Icon name="clock" />
      <span>Demo clock</span>
      <Tooltip content="Moves the demo ledger's clock to this window's deadline. The simulated jurors seal and open their ballots first, as they would have before the deadline.">
        <Button size="sm" variant="ghost" onClick={skip} loading={busy}>
          Skip to the deadline
        </Button>
      </Tooltip>
    </div>
  );
}
