import type { BeatId, QualityLevel, ZoneId } from '@cringe-court/scene/roam';
import type { LegendRow, RoamStrings } from '@cringe-court/scene/roam/react';
import { t, tRich, type MessageKey } from '@/i18n';

const BEAT_KEYS: Readonly<Record<BeatId, MessageKey>> = {
  'all-rise': 'trial.hud.beat.allRise',
  opening: 'trial.hud.beat.opening',
  'counsel-arguing': 'trial.hud.beat.counselArguing',
  'jury-deliberating': 'trial.hud.beat.juryDeliberating',
  verdict: 'trial.hud.beat.verdict',
};

const ZONE_KEYS: Readonly<Record<ZoneId, MessageKey>> = {
  lobby: 'trial.hud.zone.lobby',
  doorway: 'trial.hud.zone.doorway',
  gallery: 'trial.hud.zone.gallery',
  aisle: 'trial.hud.zone.aisle',
  well: 'trial.hud.zone.well',
  dais: 'trial.hud.zone.dais',
  'defendant-table': 'trial.hud.zone.defendantTable',
  'prosecution-table': 'trial.hud.zone.prosecutionTable',
  'witness-stand': 'trial.hud.zone.witnessStand',
  'jury-box': 'trial.hud.zone.juryBox',
  outside: 'trial.hud.zone.outside',
};

const QUALITY_KEYS: Readonly<Record<QualityLevel, MessageKey>> = {
  low: 'trial.hud.quality.low',
  medium: 'trial.hud.quality.medium',
  high: 'trial.hud.quality.high',
};

const QUALITY_NAME_KEYS: Readonly<Record<QualityLevel, MessageKey>> = {
  low: 'trial.hud.quality.name.low',
  medium: 'trial.hud.quality.name.medium',
  high: 'trial.hud.quality.name.high',
};

const EXHIBIT_KEYS: Readonly<Record<string, { title: MessageKey; subtitle: MessageKey; body: MessageKey }>> = {
  'exhibit-a': { title: 'trial.hud.exhibit.a.title', subtitle: 'trial.hud.exhibit.a.subtitle', body: 'trial.hud.exhibit.a.body' },
  'exhibit-b': { title: 'trial.hud.exhibit.b.title', subtitle: 'trial.hud.exhibit.b.subtitle', body: 'trial.hud.exhibit.b.body' },
  'exhibit-c': { title: 'trial.hud.exhibit.c.title', subtitle: 'trial.hud.exhibit.c.subtitle', body: 'trial.hud.exhibit.c.body' },
};

/** A legend row whose message wraps each key cap in `<k>…</k>`. */
const row =
  (key: MessageKey): LegendRow =>
  (cap) =>
    tRich(key, { k: (chunk) => cap(String(chunk)) });

const beatLabels = (): RoamStrings['beatLabels'] => Object.fromEntries((Object.keys(BEAT_KEYS) as BeatId[]).map((id) => [id, t(BEAT_KEYS[id])])) as RoamStrings['beatLabels'];

/** The roaming-courtroom HUD copy in the active locale. Build at render time, not at module load. */
export function roamStrings(): RoamStrings {
  return {
    beatLabels: beatLabels(),
    zoneLabels: Object.fromEntries((Object.keys(ZONE_KEYS) as ZoneId[]).map((id) => [id, t(ZONE_KEYS[id])])) as RoamStrings['zoneLabels'],
    zoneFallback: t('trial.hud.zone.none'),
    roomLabel: t('trial.hud.room'),
    roomRoleDescription: t('trial.hud.roomRole'),
    controlsTitle: t('trial.hud.controls.title'),
    controlsShow: t('trial.hud.controls.show'),
    controlsHide: t('trial.hud.controls.hide'),
    legendTouchRows: [() => t('trial.hud.legend.touch.walk'), () => t('trial.hud.legend.touch.look'), row('trial.hud.legend.touch.buttons')],
    legendKeyboardRows: [
      row('trial.hud.legend.walk'),
      row('trial.hud.legend.mouse'),
      row('trial.hud.legend.pitch'),
      row('trial.hud.legend.run'),
      row('trial.hud.legend.interact'),
      row('trial.hud.legend.skip'),
    ],
    pause: t('trial.hud.pause'),
    skipToMenuView: t('trial.hud.skipToMenu'),
    keyInteract: t('trial.hud.keyInteract'),
    continueTouch: t('trial.hud.continueTouch'),
    continueKey: t('trial.hud.continueKey'),
    continueTap: t('trial.hud.continueTap'),
    beatChip: (label, cinematic) => t(cinematic ? 'trial.hud.beat.chipCinematic' : 'trial.hud.beat.chip', { label }),
    skipBeat: t('trial.hud.skipBeat'),
    exhibitStamp: t('trial.hud.exhibit.stamp'),
    exhibitPutBack: t('trial.hud.exhibit.putBack'),
    exhibitCard: (card) => {
      const keys = EXHIBIT_KEYS[card.id];
      return keys ? { title: t(keys.title), subtitle: t(keys.subtitle), body: t(keys.body) } : card;
    },
    pauseTitle: t('trial.hud.pause.title'),
    pauseResume: t('trial.hud.pause.resume'),
    pauseBackToLobby: t('trial.hud.pause.lobby'),
    pauseGraphicsQuality: t('trial.hud.pause.quality'),
    qualityLevel: (level) => t(QUALITY_KEYS[level]),
    autoQualityNote: (level) => t('trial.hud.quality.lowered', { level: t(QUALITY_NAME_KEYS[level]) }),
    pauseChunkyPixels: t('trial.hud.pause.pixels'),
    pauseReduceMotion: t('trial.hud.pause.motion'),
    captureTitle: t('trial.hud.capture.title'),
    captureMouse: t('trial.hud.capture.mouse'),
    captureKeyboard: row('trial.hud.capture.keyboard'),
    captureClick: t('trial.hud.capture.click'),
    captureKeyboardOnly: t('trial.hud.capture.keyboardOnly'),
    captureDismiss: t('trial.hud.capture.dismiss'),
    touchPause: t('trial.hud.touch.pause'),
    touchHop: t('trial.hud.touch.hop'),
    touchInteract: t('trial.hud.touch.interact'),
    touchInteractWith: (prompt) => t('trial.hud.touch.interactWith', { prompt }),
    touchDragHint: t('trial.hud.touch.drag'),
  };
}
