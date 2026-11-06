import { Switch, useMotion } from '@/ds';
import { t } from '@/i18n';

/** Lets people override the OS motion setting for this site. */
export function MotionToggle() {
  const { preference, setPreference, reduced } = useMotion();
  return (
    <Switch
      label={t('shell.motion.label')}
      description={preference === 'system' ? t('shell.motion.system') : t('shell.motion.chosen')}
      checked={reduced}
      onCheckedChange={(next) => setPreference(next ? 'reduced' : 'full')}
    />
  );
}
