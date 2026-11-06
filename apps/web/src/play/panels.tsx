import type { ModeId } from '@cringe-court/core';
import { LOOK_OPTIONS, randomLook, type PlayerLook } from '@cringe-court/scene/roam';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Badge, Icon, PaperButton, PaperPanel, PaperRibbon, Tabs, cx, type IconName } from '@/ds';
import { t, type MessageKey } from '@/i18n';
import { MODE_PRESENTATION } from '@/pages/modeContent';
import { ACCESSORY_KEYS, EFFECT_KEYS, HAIR_KEYS, MODE_KEYS, OUTFIT_KEYS } from './keys';
import type { QuestStep } from './profile';
import styles from './PlayPage.module.css';

/* ── Shared frame ─────────────────────────────────────────────────── */

function StationPanel({ id, title, icon, wide, children, footer }: { id: string; title: string; icon: IconName; wide?: boolean; children: ReactNode; footer: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // Move focus into the panel when it opens (the room had it), so Tab and Enter work at once.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }, []);
  return (
    <div ref={ref} className={styles.scrim}>
      <PaperPanel as="section" tone="maroon" edge="cut" elevation={4} backing="gold" padding="lg" unfold className={cx(styles.station, wide && styles.stationWide)} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`}>
        <PaperRibbon as="h2" id={`${id}-title`} sparks className={styles.stationTitle}>
          <Icon name={icon} aria-hidden /> {title}
        </PaperRibbon>
        <div className={styles.stationBody}>{children}</div>
        <div className={styles.stationFooter}>{footer}</div>
      </PaperPanel>
    </div>
  );
}

/* ── Verify ───────────────────────────────────────────────────────── */

export function VerifyPanel({ mock, done, onVerify, onClose }: { mock: boolean; done: boolean; onVerify: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <StationPanel
      id="verify"
      title={t('play.verify.title')}
      icon="shield"
      footer={
        <>
          <PaperButton variant="ghost" onClick={onClose} disabled={busy}>
            {t('play.verify.later')}
          </PaperButton>
          <PaperButton
            data-autofocus
            iconStart={<Icon name={done ? 'check' : 'user'} />}
            loading={busy}
            disabled={done}
            onClick={async () => {
              setBusy(true);
              try {
                await onVerify();
              } finally {
                setBusy(false);
              }
            }}
          >
            {done ? t('play.verify.done') : t('play.verify.cta')}
          </PaperButton>
        </>
      }
    >
      <div className={styles.verify}>
        <span className={styles.verifyMark} aria-hidden>
          <Icon name="user" />
        </span>
        <div className={styles.verifyCopy}>
          <p>{t('play.verify.body')}</p>
          <ul role="list" className={styles.points}>
            <li>
              <Icon name="check" aria-hidden /> {t('play.verify.point1')}
            </li>
            <li>
              <Icon name="check" aria-hidden /> {t('play.verify.point2')}
            </li>
            <li>
              <Icon name="info" aria-hidden /> {mock ? t('play.verify.mock') : t('play.verify.real')}
            </li>
          </ul>
          {mock ? <Badge tone="info">{t('shell.identity.mock.label')}</Badge> : null}
        </div>
      </div>
    </StationPanel>
  );
}

/* ── Wardrobe ─────────────────────────────────────────────────────── */

type Tab = 'outfit' | 'hair' | 'accessories' | 'effects';

function OptionGrid<T extends string>({ label, options, value, onPick, keyFor }: { label: string; options: readonly T[]; value: string; onPick: (v: T) => void; keyFor: (v: T) => MessageKey }) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.grid}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} className={cx(styles.tile, value === o && styles.tileOn)} onClick={() => onPick(o)}>
          <span className={styles.tileGlyph} aria-hidden>
            {value === o ? <Icon name="check" /> : <Icon name="sparkle" />}
          </span>
          <span>{t(keyFor(o))}</span>
        </button>
      ))}
    </div>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: readonly string[]; value: number; onPick: (i: number) => void }) {
  return (
    <fieldset className={styles.swatchSet}>
      <legend className={styles.swatchLegend}>{label}</legend>
      <div role="radiogroup" aria-label={label} className={styles.swatches}>
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={t('play.wardrobe.swatch', { number: i + 1 })}
            className={cx(styles.swatch, value === i && styles.swatchOn)}
            // Swatches are palette colours (LOOK_OPTIONS), drawn as the chip itself.
            style={{ background: c }}
            onClick={() => onPick(i)}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function WardrobePanel({ look, onChange, onConfirm, onCancel }: { look: PlayerLook; onChange: (l: PlayerLook) => void; onConfirm: () => void; onCancel: () => void }) {
  const [tab, setTab] = useState<Tab>('outfit');
  const set = (patch: Partial<PlayerLook>) => onChange({ ...look, ...patch });
  const items = [
    {
      value: 'outfit',
      label: t('play.wardrobe.tab.outfit'),
      content: (
        <div className={styles.tabBody}>
          <OptionGrid label={t('play.wardrobe.tab.outfit')} options={LOOK_OPTIONS.outfits} value={look.outfit} onPick={(outfit) => set({ outfit })} keyFor={(o) => OUTFIT_KEYS[o]} />
          <Swatches label={t('play.wardrobe.palette.outfit')} colors={LOOK_OPTIONS.outfitColors} value={look.outfitColor} onPick={(outfitColor) => set({ outfitColor })} />
        </div>
      ),
    },
    {
      value: 'hair',
      label: t('play.wardrobe.tab.hair'),
      content: (
        <div className={styles.tabBody}>
          <OptionGrid label={t('play.wardrobe.tab.hair')} options={LOOK_OPTIONS.hairs} value={look.hair} onPick={(hair) => set({ hair })} keyFor={(o) => HAIR_KEYS[o]} />
          <Swatches label={t('play.wardrobe.palette.hair')} colors={LOOK_OPTIONS.hairColors} value={look.hairColor} onPick={(hairColor) => set({ hairColor })} />
          <Swatches label={t('play.wardrobe.palette.skin')} colors={LOOK_OPTIONS.skins} value={look.skin} onPick={(skin) => set({ skin })} />
        </div>
      ),
    },
    {
      value: 'accessories',
      label: t('play.wardrobe.tab.accessories'),
      content: (
        <div className={styles.tabBody}>
          <OptionGrid label={t('play.wardrobe.tab.accessories')} options={LOOK_OPTIONS.accessories} value={look.accessory} onPick={(accessory) => set({ accessory })} keyFor={(o) => ACCESSORY_KEYS[o]} />
        </div>
      ),
    },
    {
      value: 'effects',
      label: t('play.wardrobe.tab.effects'),
      content: (
        <div className={styles.tabBody}>
          <OptionGrid label={t('play.wardrobe.tab.effects')} options={LOOK_OPTIONS.effects} value={look.effect} onPick={(effect) => set({ effect })} keyFor={(o) => EFFECT_KEYS[o]} />
        </div>
      ),
    },
  ];
  return (
    <StationPanel
      id="wardrobe"
      title={t('play.wardrobe.title')}
      icon="star"
      wide
      footer={
        <>
          <PaperButton variant="ghost" onClick={onCancel}>
            {t('play.wardrobe.cancel')}
          </PaperButton>
          <PaperButton variant="maroon" iconStart={<Icon name="refresh" />} onClick={() => onChange({ ...randomLook(Math.floor(Math.random() * 1e9)), effect: look.effect })}>
            {t('play.wardrobe.randomize')}
          </PaperButton>
          <PaperButton data-autofocus iconStart={<Icon name="check" />} onClick={onConfirm}>
            {t('play.wardrobe.confirm')}
          </PaperButton>
        </>
      }
    >
      <p className={styles.lede}>{t('play.wardrobe.lede')}</p>
      <Tabs items={items} label={t('play.wardrobe.tabs')} value={tab} onValueChange={(v) => setTab(v as Tab)} variant="pills" />
    </StationPanel>
  );
}

/* ── Trial gates ──────────────────────────────────────────────────── */

const MODE_ICON: Readonly<Record<ModeId, IconName>> = { solo: 'gavel', versus: 'users', 'grand-jury': 'scales' };

export function TrialPanel({ mode, chosen, onChoose, onClose }: { mode: ModeId; chosen: ModeId | null; onChoose: () => void; onClose: () => void }) {
  const m = MODE_PRESENTATION[mode];
  const name = t(MODE_KEYS[mode]);
  return (
    <StationPanel
      id="trial"
      title={t('play.trial.title')}
      icon={MODE_ICON[mode]}
      footer={
        <>
          <PaperButton variant="ghost" onClick={onClose}>
            {t('play.trial.others')}
          </PaperButton>
          <PaperButton data-autofocus iconStart={<Icon name={MODE_ICON[mode]} />} onClick={onChoose}>
            {t('play.trial.choose', { mode: name })}
          </PaperButton>
        </>
      }
    >
      <p className={styles.lede}>{t('play.trial.lede')}</p>
      <div className={styles.modeCard}>
        <p className={styles.modeEyebrow}>
          {t(m.eyebrow)} {chosen === mode ? <Badge tone="success">{t('play.trial.chosen')}</Badge> : null}
        </p>
        <h3 className={styles.modeHeadline}>{t(m.headline)}</h3>
        <p>{t(m.pitch)}</p>
        <ol className={styles.modeSteps}>
          {m.steps.slice(0, 3).map((s) => (
            <li key={s}>{t(s)}</li>
          ))}
        </ol>
      </div>
    </StationPanel>
  );
}

/* ── Quest tracker ────────────────────────────────────────────────── */

const STEPS: ReadonlyArray<{ id: QuestStep; label: MessageKey; hint: MessageKey }> = [
  { id: 'verify', label: 'play.quest.verify', hint: 'play.quest.hint.verify' },
  { id: 'wardrobe', label: 'play.quest.wardrobe', hint: 'play.quest.hint.wardrobe' },
  { id: 'trial', label: 'play.quest.trial', hint: 'play.quest.hint.trial' },
  { id: 'enter', label: 'play.quest.enter', hint: 'play.quest.hint.enter' },
];

export function QuestTracker({ step, onSkip }: { step: QuestStep; onSkip: (() => void) | null }) {
  const at = STEPS.findIndex((s) => s.id === step);
  const current = STEPS[at]!;
  return (
    <section className={styles.quest} aria-labelledby="quest-title">
      <h2 id="quest-title" className={styles.questTitle}>
        {t('play.quest.title')}
      </h2>
      <ol className={styles.questList}>
        {STEPS.map((s, i) => (
          <li key={s.id} className={cx(styles.questItem, i < at && styles.questDone, i === at && styles.questNow)} aria-current={i === at ? 'step' : undefined}>
            <span className={styles.questMark} aria-hidden>
              {i < at ? <Icon name="check" /> : i + 1}
            </span>
            <span>
              {t(s.label)}
              <span className="cc-visually-hidden"> · {i < at ? t('play.quest.done') : i === at ? t('play.quest.next') : ''}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className={styles.questHint} role="status">
        {t(current.hint)}
      </p>
      {onSkip ? (
        <PaperButton size="sm" variant="ghost" onClick={onSkip}>
          {t('play.quest.skip')}
        </PaperButton>
      ) : null}
    </section>
  );
}
