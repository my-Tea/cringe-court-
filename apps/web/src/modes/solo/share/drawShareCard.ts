/**
 * The verdict share card, drawn on a canvas so it exports as a real PNG with no
 * screenshot library. Colours come from the token palette only (no raw hex).
 */
import type { ShareSummary, VerdictTone } from '@cringe-court/modes-solo';
import { t } from '@/i18n';
import { alpha, fontFamily, palette } from '@/ds/tokens';

export type ShareFormat = 'landscape' | 'square';

export const SHARE_SIZES: Readonly<Record<ShareFormat, { width: number; height: number }>> = {
  landscape: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
};

export const shareFormatLabel = (format: ShareFormat): string => t(format === 'landscape' ? 'solo.share.format.landscape' : 'solo.share.format.square');

export interface ShareAssets {
  /** Portrait of whoever is quoted. */
  speaker?: CanvasImageSource;
  /** The three juror sprites. */
  jurors?: readonly CanvasImageSource[];
}

/** The subset of CanvasRenderingContext2D the card uses (so tests can record calls). */
export type CardContext = Pick<
  CanvasRenderingContext2D,
  | 'save'
  | 'restore'
  | 'fillRect'
  | 'strokeRect'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'arcTo'
  | 'fill'
  | 'stroke'
  | 'fillText'
  | 'measureText'
  | 'translate'
  | 'rotate'
  | 'drawImage'
  | 'setLineDash'
> & {
  fillStyle: CanvasRenderingContext2D['fillStyle'];
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  imageSmoothingEnabled: boolean;
};

const TONE_COLOR: Readonly<Record<VerdictTone, string>> = {
  guilty: palette.royal[700],
  'not-cooked': palette.green[700],
  'no-verdict': palette.neutral[700],
};

const display = (px: number, weight = 700) => `${weight} ${px}px ${fontFamily.display}`;
const body = (px: number, weight = 500) => `${weight} ${px}px ${fontFamily.body}`;
const mono = (px: number, weight = 600) => `${weight} ${px}px ${fontFamily.mono}`;
const pixel = (px: number, weight = 700) => `${weight} ${px}px ${fontFamily.pixel}`;

function roundRect(ctx: CardContext, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Greedy word wrap; the last allowed line ends with an ellipsis if it overflows. */
export function wrap(ctx: Pick<CardContext, 'measureText'>, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i]!;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = words[i]!;
    if (lines.length === maxLines) {
      line = '';
      const last = lines[maxLines - 1]!;
      let cut = last;
      while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
      lines[maxLines - 1] = `${cut.trimEnd()}…`;
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function diamond(ctx: CardContext, cx: number, cy: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function frame(ctx: CardContext, w: number, h: number): void {
  ctx.fillStyle = palette.neutral[100];
  ctx.fillRect(0, 0, w, h);
  // Faint voxel grid, like the courtroom floor.
  ctx.strokeStyle = alpha(palette.gold[500], 0.12);
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
    ctx.stroke();
  }
  // Ornate double frame: maroon band, gold rule, corner diamonds.
  ctx.lineWidth = 14;
  ctx.strokeStyle = palette.royal[900];
  roundRect(ctx, 14, 14, w - 28, h - 28, 26);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = palette.gold[500];
  roundRect(ctx, 30, 30, w - 60, h - 60, 16);
  ctx.stroke();
  for (const [x, y] of [
    [30, 30],
    [w - 30, 30],
    [30, h - 30],
    [w - 30, h - 30],
  ] as const) {
    diamond(ctx, x, y, 13, palette.gold[300]);
    diamond(ctx, x, y, 6, palette.royal[900]);
  }
}

function stamp(ctx: CardContext, s: ShareSummary, cx: number, cy: number, scale: number): void {
  const color = TONE_COLOR[s.tone];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  const label = s.verdictLabel;
  // Fit the label inside the stamp's maximum width, whatever the face.
  const maxText = 330 * scale;
  let size = Math.round(76 * scale);
  ctx.font = pixel(size);
  while (size > 24 && ctx.measureText(label).width > maxText) {
    size -= 2;
    ctx.font = pixel(size);
  }
  const w = Math.max(ctx.measureText(label).width + 70 * scale, 300 * scale);
  const h = 150 * scale;
  ctx.fillStyle = alpha(color, 0.08);
  roundRect(ctx, -w / 2, -h / 2, w, h, 18 * scale);
  ctx.fill();
  ctx.lineWidth = 9 * scale;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.lineWidth = 3 * scale;
  roundRect(ctx, -w / 2 + 12 * scale, -h / 2 + 12 * scale, w - 24 * scale, h - 24 * scale, 10 * scale);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -8 * scale);
  ctx.font = pixel(Math.round(18 * scale), 600);
  ctx.fillText(s.tone === 'no-verdict' ? t('solo.share.card.fullRefund') : t('solo.share.card.verdict', { caseLabel: s.caseLabel }), 0, 44 * scale);
  ctx.restore();
}

function tally(ctx: CardContext, s: ShareSummary, cx: number, y: number): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.neutral[900];
  ctx.font = pixel(64);
  ctx.fillText(`${s.tally[0]} – ${s.tally[1]}`, cx, y);
  ctx.font = mono(16);
  ctx.fillStyle = palette.neutral[700];
  ctx.fillText(`${s.ballot[0]}  ·  ${s.ballot[1]}`, cx, y + 30);
}

function jurors(ctx: CardContext, assets: ShareAssets, cx: number, y: number, size: number): void {
  const list = assets.jurors ?? [];
  list.forEach((img, i) => {
    const x = cx + (i - (list.length - 1) / 2) * size * 0.8 - size / 2;
    ctx.drawImage(img, x, y, size, size * 1.3);
  });
}

function quote(ctx: CardContext, s: ShareSummary, assets: ShareAssets, x: number, y: number, w: number, maxLines: number): number {
  if (!s.quote) return y;
  ctx.font = body(26, 500);
  const pad = 24;
  const portrait = assets.speaker ? 88 : 0;
  const textW = w - pad * 2 - (portrait ? portrait + 20 : 0);
  const lines = wrap(ctx, `“${s.quote.text}”`, textW, maxLines);
  const h = Math.max(portrait + pad * 2, pad * 2 + lines.length * 34 + 30);
  ctx.fillStyle = palette.gold[100];
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.fillStyle = palette.royal[700];
  ctx.fillRect(x, y + 10, 6, h - 20);
  if (assets.speaker) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(assets.speaker, x + pad, y + pad, portrait, portrait);
    ctx.lineWidth = 3;
    ctx.strokeStyle = palette.gold[500];
    ctx.strokeRect(x + pad, y + pad, portrait, portrait);
  }
  const tx = x + pad + (portrait ? portrait + 20 : 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = palette.neutral[900];
  lines.forEach((l, i) => ctx.fillText(l, tx, y + pad + 26 + i * 34));
  ctx.font = display(18, 600);
  ctx.fillStyle = palette.royal[900];
  ctx.fillText(t('solo.share.card.quoteBy', { by: s.quote.by }), tx, y + pad + 26 + lines.length * 34 + 6);
  return y + h;
}

function footer(ctx: CardContext, s: ShareSummary, w: number, h: number): void {
  const bandH = 54;
  const y = h - 30 - bandH;
  ctx.fillStyle = palette.royal[900];
  ctx.fillRect(32, y, w - 64, bandH);
  ctx.textBaseline = 'middle';
  ctx.font = `italic 600 22px ${fontFamily.display}`;
  ctx.fillStyle = palette.gold[300];
  ctx.textAlign = 'left';
  ctx.fillText(t('solo.share.card.footer', { app: t('common.app.name'), tagline: t('common.app.tagline') }), 58, y + bandH / 2);
  ctx.font = mono(14, 500);
  ctx.fillStyle = palette.gold[100];
  ctx.textAlign = 'right';
  ctx.fillText(t('solo.share.card.testnet', { fingerprint: s.fingerprint }), w - 58, y + bandH / 2);
}

function header(ctx: CardContext, s: ShareSummary, x: number, y: number): number {
  let top = y;
  // The style-guide wordmark: maroon serif with a gold rule and diamonds.
  ctx.font = display(40, 800);
  ctx.fillStyle = palette.gold[700];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const brand = t('common.app.name');
  ctx.fillText(brand, x + 2, top + 42);
  ctx.fillStyle = palette.royal[900];
  ctx.fillText(brand, x, top + 40);
  const markW = ctx.measureText(brand).width;
  ctx.fillStyle = palette.gold[500];
  ctx.fillRect(x + markW + 18, top + 26, 120, 3);
  diamond(ctx, x + markW + 18, top + 27, 6, palette.gold[500]);
  diamond(ctx, x + markW + 138, top + 27, 6, palette.gold[500]);
  top += 62;
  ctx.font = mono(18);
  ctx.fillStyle = palette.gold[900];
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const label = t('solo.share.card.header', { caseLabel: s.caseLabel, category: s.category.toUpperCase() });
  ctx.fillText(label, x, top + 18);
  return top + 36;
}

/** Draw the whole card. Assets are optional: anything missing is skipped, never fatal. */
export function drawShareCard(ctx: CardContext, s: ShareSummary, format: ShareFormat, assets: ShareAssets = {}): void {
  const { width: w, height: h } = SHARE_SIZES[format];
  ctx.save();
  frame(ctx, w, h);
  if (format === 'landscape') {
    let y = header(ctx, s, 64, 58);
    ctx.font = display(50);
    ctx.fillStyle = palette.royal[900];
    const title = wrap(ctx, s.title, 640, 2);
    title.forEach((l, i) => ctx.fillText(l, 64, y + 46 + i * 56));
    y += 46 + (title.length - 1) * 56 + 40;
    ctx.font = body(28, 700);
    ctx.fillStyle = palette.neutral[900];
    ctx.fillText(s.headline, 64, y);
    quote(ctx, s, assets, 64, y + 24, 650, 3);
    stamp(ctx, s, 950, 200, 1);
    tally(ctx, s, 950, 360);
    jurors(ctx, assets, 950, 400, 64);
  } else {
    let y = header(ctx, s, 72, 64);
    ctx.font = display(58);
    ctx.fillStyle = palette.royal[900];
    const title = wrap(ctx, s.title, w - 144, 2);
    title.forEach((l, i) => ctx.fillText(l, 72, y + 54 + i * 64));
    y += 54 + (title.length - 1) * 64;
    stamp(ctx, s, w / 2, y + 150, 1.25);
    tally(ctx, s, w / 2, y + 330);
    ctx.textAlign = 'center';
    ctx.font = body(32, 700);
    ctx.fillStyle = palette.neutral[900];
    ctx.fillText(s.headline, w / 2, y + 410);
    ctx.textAlign = 'left';
    const bottom = quote(ctx, s, assets, 72, y + 450, w - 144, 3);
    jurors(ctx, assets, w / 2, Math.min(bottom + 28, h - 250), 88);
  }
  footer(ctx, s, w, h);
  ctx.restore();
}
