import type { JuryWindow } from '@cringe-court/modes-solo';
import { Alert } from '@/ds';
import { t, type MessageKey } from '@/i18n';

const WHAT: Readonly<Record<JuryWindow, MessageKey>> = {
  recruitment: 'solo.case.lapsed.recruitment',
  commit: 'solo.case.lapsed.commit',
  reveal: 'solo.case.lapsed.reveal',
};

/**
 * B1/B19: says which jury window closed before everyone acted in it (a paused
 * jury, a background tab, a sleeping laptop), so a NO VERDICT or a dismissal
 * never looks like it came from nowhere.
 */
export function LapsedNote({ lapsed }: { lapsed: readonly JuryWindow[] | undefined }) {
  if (!lapsed?.length) return null;
  return (
    <Alert tone="warning" title={t('solo.case.lapsed.title')}>
      {lapsed.map((w) => t(WHAT[w])).join(' ')} {t('solo.case.lapsed.why')}
    </Alert>
  );
}
