/**
 * The share card: the screenshot moment of a public verdict ("4 of 7 strangers
 * agreed"). A pure model, a share text, and a 1200×630 SVG renderer. Colours
 * are passed in (the web app reads them from the design tokens), so this file
 * never hard-codes a palette.
 */
import { galleryPercents } from './gallery';
import type { DocketEntry } from './court';

export interface ShareCard {
  caseLabel: string;
  title: string;
  question: string;
  /** Big stamp text: the verdict label, "NO VERDICT", or the live status. */
  headline: string;
  tone: 'verdict' | 'no-verdict' | 'live' | 'cancelled';
  subline: string;
  /** Revealed votes per side, once there is a result. */
  tally: readonly [number, number] | null;
  appointed: number;
  ballot: readonly [string, string];
  /** "THE GALLERY SAYS 62% TEAM NOT SOUP", once the reveal window has closed (D11). */
  gallery: string | null;
  url: string;
}

export function buildShareCard(e: DocketEntry, url: string): ShareCard {
  const v = e.verdict;
  const t = e.gallery.tally;
  let gallery: string | null = null;
  if (t && t.total > 0) {
    const [a, b] = galleryPercents(t);
    gallery = a >= b ? `THE GALLERY SAYS ${a}% ${e.ballot[0]}` : `THE GALLERY SAYS ${b}% ${e.ballot[1]}`;
  }
  const base = { caseLabel: e.label, title: e.file.title, question: e.file.question, ballot: e.ballot, appointed: e.terms.jurySize, gallery, url };
  if (e.status === 'verdict' && v) {
    const winner = v.kind === 'ballot-0' ? v.tally[0] : v.tally[1];
    return { ...base, headline: v.label, tone: 'verdict', subline: `${winner} of ${v.appointed} sworn strangers agreed.`, tally: v.tally };
  }
  if (e.status === 'mistrial' && v) {
    return { ...base, headline: 'NO VERDICT', tone: 'no-verdict', subline: `Fewer than ${e.terms.threshold} of ${v.appointed} agreed. Everyone was refunded.`, tally: v.tally };
  }
  if (e.status === 'cancelled') {
    return { ...base, headline: 'CASE DISMISSED', tone: 'cancelled', subline: 'The court never sat. Every summoner was refunded.', tally: null };
  }
  const live =
    e.status === 'summoning'
      ? `The crowd is summoning the court: ${Math.round(e.progress * 100)}% funded.`
      : e.status === 'seating'
        ? `Seating the jury: ${e.seats.filled} of ${e.seats.total} sworn in.`
        : 'Court is in session. Seven strangers are deciding.';
  return { ...base, headline: 'THE JURY IS OUT', tone: 'live', subline: live, tally: null };
}

export function shareText(card: ShareCard): string {
  const head =
    card.tone === 'verdict'
      ? `${card.caseLabel}: “${card.question}” Verdict: ${card.headline}. ${card.subline}`
      : card.tone === 'no-verdict'
        ? `${card.caseLabel}: “${card.question}” NO VERDICT. The internet keeps arguing.`
        : `${card.caseLabel}: “${card.question}” ${card.subline}`;
  return [head, card.gallery, `Your Honor, bro is cooked. ${card.url}`].filter(Boolean).join('\n');
}

/** Colours for the SVG, read from the design tokens by the caller. */
export interface SharePalette {
  parchment: string;
  parchmentDeep: string;
  ink: string;
  muted: string;
  maroon: string;
  maroonDeep: string;
  gold: string;
  goldLight: string;
  teal: string;
  green: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap to at most `lines` lines of `width` characters. */
export function wrap(text: string, width: number, lines: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= width) cur += ' ' + w;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  kept[lines - 1] = `${kept[lines - 1]!.replace(/[.,;:!?]?$/, '')}…`;
  return kept;
}

/** 1200×630 Open Graph-sized card. Pure string; no DOM needed. */
export function renderShareSvg(card: ShareCard, p: SharePalette, fonts = { display: 'Fraunces, Georgia, serif', pixel: '"Pixelify Sans", monospace', body: '"Space Grotesk", system-ui, sans-serif' }): string {
  // Left column (x 80…620) holds the question; the stamp owns the right (660…1100).
  const q = wrap(`“${card.question}”`, 19, 3);
  const sub = wrap(card.subline, 40, 2);
  const gallery = card.gallery ? wrap(card.gallery, 34, 2) : [];
  const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
  const stampColor = card.tone === 'verdict' ? p.maroon : card.tone === 'no-verdict' ? p.teal : card.tone === 'cancelled' ? p.muted : p.gold;
  const headline = wrap(card.headline, 13, 2);
  // Heavy caps run about 0.68 em per glyph; keep the longest line inside the 440-wide stamp.
  const longest = Math.max(...headline.map((l) => l.length));
  const stampSize = Math.min(58, Math.floor(400 / (longest * 0.68)));
  const pips: string[] = [];
  if (card.tally) {
    const votes = [...Array(card.tally[0]).fill(0), ...Array(card.tally[1]).fill(1)] as number[];
    for (let i = 0; i < card.appointed; i++) {
      const v = votes[i];
      const fill = v === 0 ? p.maroon : v === 1 ? p.teal : p.parchmentDeep;
      pips.push(`<circle cx="${700 + i * 58}" cy="470" r="20" fill="${fill}" stroke="${p.ink}" stroke-width="3"/>`);
    }
  }
  const legend = card.tally
    ? [0, 1]
        .map(
          (b) =>
            `<text x="700" y="${516 + b * 26}" font-family="${esc(fonts.body)}" font-size="21" font-weight="700" fill="${b === 0 ? p.maroon : p.teal}">● ${esc(clip(card.ballot[b]!, 26))} ${card.tally![b]}</text>`,
        )
        .join('')
    : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(`${card.caseLabel}: ${card.question} ${card.headline}`)}">`,
    `<rect width="1200" height="630" fill="${p.maroonDeep}"/>`,
    `<rect x="24" y="24" width="1152" height="582" rx="28" fill="${p.parchment}" stroke="${p.gold}" stroke-width="8"/>`,
    `<rect x="44" y="44" width="1112" height="542" rx="18" fill="none" stroke="${p.maroon}" stroke-width="3" stroke-dasharray="2 10" stroke-linecap="round"/>`,
    `<rect x="80" y="70" width="380" height="54" rx="27" fill="${p.maroon}"/>`,
    `<text x="270" y="106" text-anchor="middle" font-family="${esc(fonts.pixel)}" font-size="26" fill="${p.goldLight}">GRAND JURY · ${esc(card.caseLabel.replace('CASE ', ''))}</text>`,
    `<text x="80" y="180" font-family="${esc(fonts.body)}" font-size="26" font-weight="700" letter-spacing="3" fill="${p.muted}">${esc(card.title.toUpperCase())}</text>`,
    ...q.map((l, i) => `<text x="80" y="${240 + i * 58}" font-family="${esc(fonts.display)}" font-size="50" font-weight="800" fill="${p.ink}">${esc(l)}</text>`),
    `<g transform="rotate(-6 880 250)">`,
    `<rect x="660" y="${headline.length > 1 ? 150 : 180}" width="440" height="${headline.length > 1 ? 190 : 130}" rx="16" fill="none" stroke="${stampColor}" stroke-width="10"/>`,
    ...headline.map(
      (l, i) =>
        `<text x="880" y="${(headline.length > 1 ? 232 : 265) + i * 72}" text-anchor="middle" font-family="${esc(fonts.display)}" font-size="${stampSize}" font-weight="900" fill="${stampColor}">${esc(l)}</text>`,
    ),
    `</g>`,
    ...sub.map((l, i) => `<text x="80" y="${240 + (q.length - 1) * 58 + 44 + i * 34}" font-family="${esc(fonts.body)}" font-size="26" fill="${p.ink}">${esc(l)}</text>`),
    ...pips,
    legend,
    ...gallery.map((l, i) => `<text x="80" y="${(gallery.length > 1 ? 494 : 522) + i * 28}" font-family="${esc(fonts.pixel)}" font-size="22" fill="${p.green}">${esc(l)}</text>`),
    `<text x="80" y="566" font-family="${esc(fonts.body)}" font-size="22" fill="${p.muted}">${esc(card.url)} · TESTNET · Your Honor, bro is cooked.</text>`,
    `</svg>`,
  ].join('');
}
