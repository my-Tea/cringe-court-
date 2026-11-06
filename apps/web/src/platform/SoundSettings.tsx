import type { VolumeChannel } from '@cringe-court/audio';
import { useId, useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, IconButton, Icon, PaperButton, RadioCards, RoundIconButton, Switch, Tooltip, cx } from '@/ds';
import { appAudio, useAudioSettings } from './audio';
import styles from './SoundSettings.module.css';

const CHANNELS: readonly { channel: VolumeChannel; label: string }[] = [
  { channel: 'master', label: 'Master' },
  { channel: 'sfx', label: 'Effects' },
  { channel: 'music', label: 'Music' },
];

const REDUCE_OPTIONS = [
  { value: 'system', label: 'Match my motion setting', description: 'Quieter when your device or the app asks for reduced motion.' },
  { value: 'reduced', label: 'Reduced', description: 'Soft cues only, no crowd or room ambience.' },
  { value: 'full', label: 'Full', description: 'Every cue, always.' },
] as const;

function VolumeSlider({ channel, label }: { channel: VolumeChannel; label: string }) {
  const id = useId();
  const { settings } = useAudioSettings();
  const pct = Math.round(settings[channel] * 100);
  return (
    <div className={styles.slider}>
      <label htmlFor={id} className={styles.sliderLabel}>
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={pct}
        aria-valuetext={`${pct} percent`}
        className={styles.range}
        style={{ ['--_fill' as string]: `${pct}%` }}
        onChange={(e) => appAudio().setVolume(channel, Number(e.target.value) / 100)}
      />
      <output htmlFor={id} className={styles.sliderValue}>
        {pct}%
      </output>
    </div>
  );
}

/** The full sound panel: mute, three volumes, Reduce sound, and a test sound. For /settings and the header dialog. */
export function SoundSettings({ className }: { className?: string }) {
  const { settings, state } = useAudioSettings();
  const [tested, setTested] = useState<'idle' | 'played' | 'silent'>('idle');
  const unavailable = state === 'unavailable';

  const playTest = async () => {
    const e = appAudio();
    const ok = await e.unlock();
    const handle = ok ? e.play('gavel_strike') : null;
    setTested(handle ? 'played' : 'silent');
  };

  return (
    <div className={cx(styles.panel, className)}>
      <Switch
        label="Sound on"
        description={unavailable ? 'This browser has no Web Audio, so the court stays silent.' : 'Gavels, stamps, the gallery and the courtroom hum.'}
        checked={!settings.muted}
        disabled={unavailable}
        onCheckedChange={(on) => {
          appAudio().setMuted(!on);
          if (on) void appAudio().unlock();
        }}
      />
      <div className={styles.sliders} role="group" aria-label="Volume">
        {CHANNELS.map((c) => (
          <VolumeSlider key={c.channel} channel={c.channel} label={c.label} />
        ))}
      </div>
      <RadioCards
        legend="Reduce sound"
        name="cc-reduce-sound"
        options={REDUCE_OPTIONS}
        value={settings.reduceSound}
        onValueChange={(v) => appAudio().setReduceSound(v as 'system' | 'reduced' | 'full')}
      />
      <div className={styles.test}>
        <PaperButton size="sm" variant="maroon" iconStart={<Icon name="gavel" />} disabled={unavailable} onClick={() => void playTest()}>
          Play a test sound
        </PaperButton>
        <p className={styles.testNote} role="status">
          {tested === 'played' ? 'Order in the court!' : tested === 'silent' ? (settings.muted ? 'Sound is off. Turn it on to hear the gavel.' : 'Nothing played. Check your device volume.') : ''}
        </p>
      </div>
    </div>
  );
}

/**
 * The header control: a round papercraft button that mutes / unmutes in one
 * click, with a small neighbour that opens the sound settings dialog.
 */
export function SoundButton({ className }: { className?: string }) {
  const { settings, state } = useAudioSettings();
  if (state === 'unavailable') return null;
  const muted = settings.muted;
  const toggle = () => {
    appAudio().setMuted(!muted);
    if (muted) void appAudio().unlock();
  };
  return (
    <div className={cx(styles.button, className)}>
      <Tooltip content={muted ? 'Sound is off' : 'Sound is on'}>
        <RoundIconButton icon={muted ? 'volume-off' : 'volume'} label={muted ? 'Unmute sound' : 'Mute sound'} tone={muted ? 'royal' : 'gold'} onClick={toggle} />
      </Tooltip>
      <Dialog>
        <Tooltip content="Sound settings">
          <DialogTrigger asChild>
            <IconButton label="Sound settings" icon={<Icon name="chevron-down" />} size="sm" />
          </DialogTrigger>
        </Tooltip>
        <DialogContent title="Sound settings" description="Volumes are saved on this device." size="sm">
          <SoundSettings />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The mute switch alone, for the phone menu sheet (full settings live on /settings). */
export function SoundMuteSwitch() {
  const { settings, state } = useAudioSettings();
  if (state === 'unavailable') return null;
  return (
    <Switch
      label="Sound"
      description={settings.muted ? 'Muted on this device' : 'Gavels, stamps and the courtroom hum'}
      checked={!settings.muted}
      onCheckedChange={(on) => {
        appAudio().setMuted(!on);
        if (on) void appAudio().unlock();
      }}
    />
  );
}
