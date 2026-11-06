/**
 * The share card (V4 §5: "collectible-looking … without implying an NFT").
 * Bragging rights only: no names, no wallets, no amounts won from the other
 * side (there are none, GAME-MODES §3 step 6).
 *
 * `shareCardSvg` renders a 1200×630 card from a model and a theme. The package
 * holds no colours: the app passes its design tokens in, so the card always
 * matches the style guide.
 */
import { CATEGORIES, formatCaseNumber, type CourtLine } from '@cringe-court/core';
import { sideLabel } from './definition';
import type { VersusCase } from './world';

export interface ShareCardModel {
  caseLabel: string;
  title: string;
  category: string;
  outcome: 'a' | 'b' | 'mistrial';
  /** "SIDE B WINS" / "MISTRIAL". */
  headline: string;
  /** "SIDE B “Sir Loin”". */
  winner: string | null;
  loser: string | null;
  tally: readonly [number, number];
  completed: number;
  appointed: number;
  /** The best public line from the frozen transcript. */
  quote: { speaker: string; text: string } | null;
  sentence: string | null;
  /** First 10 hex chars of the transcript fingerprint, so the card is checkable. */
  fingerprint: string;
}

function bestLine(lines: readonly CourtLine[], winner: 0 | 1 | null): CourtLine | null {
  const fromWinner = lines.filter((l) => (winner === null ? l.bench !== undefined : l.bench === winner));
  return fromWinner.find((l) => l.beat === 'objection') ?? fromWinner.find((l) => l.segment === 'closing') ?? fromWinner[0] ?? null;
}

export function shareCardModel(c: VersusCase): ShareCardModel | null {
  const s = c.state;
  if (s.stage !== 'verdict' && s.stage !== 'share' && s.stage !== 'appeal') return null;
  const v = s.verdict;
  const winnerChoice = v.kind === 'ballot-0' ? 0 : v.kind === 'ballot-1' ? 1 : null;
  const aLabel = sideLabel('a', s.filing.sides.a);
  const bLabel = sideLabel('b', s.filing.sides.b);
  const line = bestLine(s.transcript.lines, winnerChoice);
  return {
    caseLabel: formatCaseNumber(s.caseNumber),
    title: s.filing.title,
    category: CATEGORIES[s.filing.category],
    outcome: winnerChoice === null ? 'mistrial' : winnerChoice === 0 ? 'a' : 'b',
    headline: winnerChoice === null ? 'MISTRIAL' : `SIDE ${winnerChoice === 0 ? 'A' : 'B'} WINS`,
    winner: winnerChoice === null ? null : winnerChoice === 0 ? aLabel : bLabel,
    loser: winnerChoice === null ? null : winnerChoice === 0 ? bLabel : aLabel,
    tally: v.tally,
    completed: v.completedDuty,
    appointed: v.appointed,
    quote: line ? { speaker: line.speaker === 'side-a' ? 'Agent A' : line.speaker === 'side-b' ? 'Agent B' : 'Judge Gavel.exe', text: line.text } : null,
    sentence: s.sentence?.text ?? null,
    fingerprint: s.transcript.hash.slice(0, 10),
  };
}

/** Post text for X / native share. */
export function shareText(m: ShareCardModel, url: string): string {
  const result = m.outcome === 'mistrial' ? `MISTRIAL (${m.tally[0]}–${m.tally[1]}). Everyone got their money back.` : `${m.winner} wins ${Math.max(...m.tally)}–${Math.min(...m.tally)}.`;
  return `${m.caseLabel} · Versus Court: “${m.title}”. ${result} A random verified jury decided. #CringeCourt (testnet) ${url}`;
}

export interface ShareTheme {
  paper: string;
  paperDeep: string;
  ink: string;
  inkMuted: string;
  frame: string;
  frameDark: string;
  accent: string;
  sideA: string;
  sideB: string;
  mistrial: string;
  onStamp: string;
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy word wrap for SVG text (no layout engine in SVG). */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line ? `${line} ${w}` : w).length > maxChars) {
      if (line) lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/[\s.,;:!?]+$/, '').slice(0, maxChars - 1)}…`;
  }
  return lines;
}

export function shareCardSvg(m: ShareCardModel, t: ShareTheme): string {
  const stampColor = m.outcome === 'a' ? t.sideA : m.outcome === 'b' ? t.sideB : t.mistrial;
  const title = wrapText(`“${m.title}”`, 34, 2);
  const quote = m.quote ? wrapText(m.quote.text, 58, 3) : [];
  const serif = "Georgia, 'Times New Roman', serif";
  const mono = "'Courier New', ui-monospace, monospace";
  const sub = m.outcome === 'mistrial' ? 'No verdict · both sides refunded' : `${m.winner} beat ${m.loser}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${esc(`${m.caseLabel}: ${m.headline}`)}">
  <rect width="1200" height="630" fill="${t.paperDeep}"/>
  <rect x="22" y="22" width="1156" height="586" rx="26" fill="${t.paper}" stroke="${t.frameDark}" stroke-width="4"/>
  <rect x="38" y="38" width="1124" height="554" rx="18" fill="none" stroke="${t.frame}" stroke-width="6"/>
  <rect x="50" y="50" width="1100" height="530" rx="12" fill="none" stroke="${t.frameDark}" stroke-width="1.5" stroke-dasharray="2 6"/>
  ${[
    [38, 38],
    [1162, 38],
    [38, 592],
    [1162, 592],
  ]
    .map(([x, y]) => `<g transform="translate(${x} ${y}) rotate(45)"><rect x="-13" y="-13" width="26" height="26" fill="${t.frame}" stroke="${t.frameDark}" stroke-width="3"/><rect x="-5" y="-5" width="10" height="10" fill="${t.accent}"/></g>`)
    .join('\n  ')}
  <text x="96" y="122" font-family="${mono}" font-size="22" letter-spacing="4" fill="${t.inkMuted}">VERSUS COURT · ${esc(m.caseLabel)} · ${esc(m.category.toUpperCase())}</text>
  ${title.map((l, i) => `<text x="96" y="${188 + i * 56}" font-family="${serif}" font-size="50" font-weight="700" fill="${t.ink}">${esc(l)}</text>`).join('\n  ')}
  <g transform="translate(860 300) rotate(-8)">
    <rect x="-230" y="-78" width="460" height="156" rx="18" fill="none" stroke="${stampColor}" stroke-width="10"/>
    <rect x="-214" y="-62" width="428" height="124" rx="10" fill="none" stroke="${stampColor}" stroke-width="3"/>
    <text x="0" y="22" text-anchor="middle" font-family="${serif}" font-size="${m.headline.length > 10 ? 64 : 76}" font-weight="900" letter-spacing="3" fill="${stampColor}">${esc(m.headline)}</text>
  </g>
  <text x="96" y="${title.length > 1 ? 330 : 280}" font-family="${serif}" font-size="30" fill="${t.ink}">${esc(sub)}</text>
  <text x="96" y="${title.length > 1 ? 380 : 330}" font-family="${mono}" font-size="26" fill="${t.inkMuted}">Jury ${m.tally[0]}–${m.tally[1]} · ${m.completed} of ${m.appointed} jurors finished duty</text>
  ${quote.length ? `<rect x="96" y="420" width="6" height="${quote.length * 34 + 10}" fill="${t.accent}"/>` : ''}
  ${quote.map((l, i) => `<text x="124" y="${450 + i * 34}" font-family="${serif}" font-size="26" font-style="italic" fill="${t.ink}">${esc(i === 0 ? `“${l}` : l)}${i === quote.length - 1 ? '”' : ''}</text>`).join('\n  ')}
  ${m.quote ? `<text x="124" y="${468 + quote.length * 34}" font-family="${mono}" font-size="20" fill="${t.inkMuted}">— ${esc(m.quote.speaker)}</text>` : ''}
  <text x="96" y="566" font-family="${mono}" font-size="18" fill="${t.inkMuted}">Bragging rights only · testnet · transcript ${esc(m.fingerprint)}…</text>
  <text x="1104" y="566" text-anchor="end" font-family="${serif}" font-size="30" font-weight="700" fill="${t.accent}">CringeCourt</text>
</svg>`;
}
