import { t } from '@/i18n';

/** "4:05", "1:02:09", "2d 3h". Seconds are floored; negative means 0. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return t('ds.countdown.dayHour', { days: d, hours: h });
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Spoken form for screen readers: "4 minutes 5 seconds". */
export function speakRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const parts: Array<[number, 'common.unit.days' | 'common.unit.hours' | 'common.unit.minutes' | 'common.unit.seconds']> = [
    [Math.floor(total / 86400), 'common.unit.days'],
    [Math.floor((total % 86400) / 3600), 'common.unit.hours'],
    [Math.floor((total % 3600) / 60), 'common.unit.minutes'],
    [total % 60, 'common.unit.seconds'],
  ];
  const spoken = parts.filter(([n]) => n > 0).map(([n, key]) => t(key, { count: n }));
  return spoken.length ? spoken.slice(0, 2).join(' ') : t('ds.countdown.zeroSeconds');
}

export type Urgency = 'calm' | 'soon' | 'urgent' | 'ended';

/** Calm above 25 % left, soon above 10 %, urgent below, ended at 0. */
export function urgencyOf(remainingMs: number, totalMs: number): Urgency {
  if (remainingMs <= 0) return 'ended';
  const left = totalMs > 0 ? remainingMs / totalMs : 1;
  return left > 0.25 ? 'calm' : left > 0.1 ? 'soon' : 'urgent';
}
