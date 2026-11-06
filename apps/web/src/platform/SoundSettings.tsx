import type { VolumeChannel } from '@cringe-court/audio';
import { useId, useState } from 'react';
import { Dialog, DialogContent, DialogTrigger, IconButton, Icon, PaperButton, RadioCards, RoundIconButton, Switch, Tooltip, cx } from '@/ds';
import { formatNumber, t, type MessageKey } from '@/i18n';
import { appAudio, useAudioSettings } from './audio';
import styles from './SoundSettings.module.css';

const CHANNELS: readonly { channel: VolumeChannel; label: MessageKey }[] = [
  { channel: 'master', label: 'shell.sound.channel.master' },
  { channel: 'sfx', label: 'shell.sound.channel.sfx' },
  { channel: 'music', label: 'shell.sound.channel.music' },
];

const REDUCE_OPTIONS: readonly { value: 'system' | 'reduced' | 'full'; label: MessageKey; description: MessageKey }[] = [
  { value: 'system', label: 'shell.sound.reduce.system.label', description: 'shell.sound.reduce.system.description' },
  { value: 'reduced', label: 'shell.sound.reduce.reduced.label', description: 'shell.sound.reduce.reduced.description' },
  { value: 'full', label: 'shell.sound.reduce.full.label', description: 'shell.sound.reduce.full.description' },
];

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
        aria-valuetext={t('shell.sound.percent', { pct })}
        className={styles.range}
        style={{ ['--_fill' as string]: `${pct}%` }}
        onChange={(e) => appAudio().setVolume(channel, Number(e.target.value) / 100)}
      />
      <output htmlFor={id} className={styles.sliderValue}>
        {formatNumber(pct / 100, { style: 'percent' })}
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
        label={t('shell.sound.on')}
        description={unavailable ? t('shell.sound.unavailable') : t('shell.sound.on.description')}
        checked={!settings.muted}
        disabled={unavailable}
        onCheckedChange={(on) => {
          appAudio().setMuted(!on);
          if (on) void appAudio().unlock();
        }}
      />
      <div className={styles.sliders} role="group" aria-label={t('shell.sound.volume')}>
        {CHANNELS.map((c) => (
          <VolumeSlider key={c.channel} channel={c.channel} label={t(c.label)} />
        ))}
      </div>
      <RadioCards
        legend={t('shell.sound.reduce.legend')}
        name="cc-reduce-sound"
        options={REDUCE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label), description: t(o.description) }))}
        value={settings.reduceSound}
        onValueChange={(v) => appAudio().setReduceSound(v as 'system' | 'reduced' | 'full')}
      />
      <div className={styles.test}>
        <PaperButton size="sm" variant="maroon" iconStart={<Icon name="gavel" />} disabled={unavailable} onClick={() => void playTest()}>
          {t('shell.sound.test')}
        </PaperButton>
        <p className={styles.testNote} role="status">
          {tested === 'played' ? t('shell.sound.test.played') : tested === 'silent' ? t(settings.muted ? 'shell.sound.test.muted' : 'shell.sound.test.silent') : ''}
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
      <Tooltip content={muted ? t('shell.sound.state.off') : t('shell.sound.state.on')}>
        <RoundIconButton icon={muted ? 'volume-off' : 'volume'} label={muted ? t('shell.sound.unmute') : t('shell.sound.mute')} tone={muted ? 'royal' : 'gold'} onClick={toggle} />
      </Tooltip>
      <Dialog>
        <Tooltip content={t('shell.sound.settings')}>
          <DialogTrigger asChild>
            <IconButton label={t('shell.sound.settings')} icon={<Icon name="chevron-down" />} size="sm" />
          </DialogTrigger>
        </Tooltip>
        <DialogContent title={t('shell.sound.settings')} description={t('shell.sound.settings.description')} size="sm">
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
      label={t('shell.sound.switch')}
      description={settings.muted ? t('shell.sound.switch.muted') : t('shell.sound.switch.on')}
      checked={!settings.muted}
      onCheckedChange={(on) => {
        appAudio().setMuted(!on);
        if (on) void appAudio().unlock();
      }}
    />
  );
}
