import { Switch, useMotion } from '@/ds';

/** Lets people override the OS motion setting for this site. */
export function MotionToggle() {
  const { preference, setPreference, reduced } = useMotion();
  return (
    <Switch
      label="Reduce motion"
      description={preference === 'system' ? 'Following your device setting' : 'Your choice for this site'}
      checked={reduced}
      onCheckedChange={(next) => setPreference(next ? 'reduced' : 'full')}
    />
  );
}
