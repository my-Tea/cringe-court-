import { useSyncExternalStore } from 'react';
import { Button } from '@/ds';
import { t } from '@/i18n';
import { setSound, soundEngine } from './sound';
import { SoloIcon } from './SoloIcon';

/** Sound on/off. Off until the user asks (browsers need a gesture anyway). */
export function SoundToggle() {
  const engine = soundEngine();
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  if (snap.state === 'unavailable') return null;
  const on = snap.state === 'running' && !snap.settings.muted;
  return (
    <Button size="sm" variant="ghost" aria-pressed={on} onClick={() => void setSound(!on)} iconStart={<SoloIcon name={on ? 'sound' : 'muted'} />}>
      {t('solo.sound.toggle')}
    </Button>
  );
}
