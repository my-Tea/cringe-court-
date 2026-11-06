/**
 * Bark pools and exhibit cards. Every pool cycles deterministically (no repeats
 * until the pool is exhausted), so tests and screenshots are stable.
 */
import type { DialogueLine } from './types';

export const BARKS: Readonly<Record<string, readonly string[]>> = {
  judge: [
    'The sunglasses stay on. The truth is blinding.',
    'Approach the bench? Bold. The bench approaches no one.',
    'I have reviewed your timeline. All of it. I need a minute.',
    'Order is a state of mind. Mine is "mildly amused".',
    'Objection to your outfit: overruled. Barely.',
  ],
  prosecutor: [
    'Exhibit A speaks for itself. Loudly. In Comic Sans.',
    'I have receipts. Laminated.',
    'Ratio is not a verb. Today it is.',
  ],
  defense: [
    'Relax. I have a plan. It is mostly vibes.',
    'Whatever they ask, say "context". Trust me.',
    'If the jury laughs, that is good. Probably.',
  ],
  bailiff: [
    'Keep it moving, citizen. Shades are regulation.',
    'No running in the courtroom. Walking dramatically is fine.',
    'The gate swings both ways. Like this case.',
  ],
  clerk: ['Everything is saved. Twice. Ctrl+S is a lifestyle.', 'Please speak up, the minutes are in all caps.'],
  juror: ['I am legally not allowed to say, but... wow.', 'I came for jury duty, I stayed for the plot.', 'Is it too late to be a juror for the other side?'],
  gallery: ['I brought popcorn. Do not tell the bailiff.', 'Second row is the best seat. Cringe splash zone.', 'This is better than streaming.'],
  guard: ['Courtroom is through those doors. The street doors stay barred until the hearing is over.', 'Nobody leaves before the gavel.'],
  'locked-doors': ['Locked. A brass bar and a note: "COURT IN SESSION. NO ESCAPING YOUR CRINGE."', 'Still locked. The note now has a smiley face.'],
  bust: ['"Hon. Judge Shades I — first to wear sunglasses indoors, 1987." The plaque is very proud.', 'The bust stares back. Somehow the sunglasses make it worse.'],
  globe: ['You spin the globe. It lands on "the group chat".', 'The globe wobbles. Every country on it is labelled "cringe jurisdiction".'],
  docket: ['TODAY: "The People v. That Post You Made at 3 a.m." — Courtroom 1.', 'Also listed: "Side A v. Side B: Who Ate the Leftovers". Adjourned forever.'],
  'desk-bell': ['Ding. Nobody comes. The clerk is inside, saving things.', 'Ding ding. A sticky note: "please stop".'],
  'ballot-box': ['Sealed tight. Votes are committed, not revealed — the jury reveals together.', 'The wax seal has a tiny gavel on it.'],
};

export interface ExhibitCard {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  /** Palette swatch for the folder. */
  color: string;
}

export const EXHIBIT_CARDS: Readonly<Record<string, ExhibitCard>> = {
  'exhibit-a': {
    id: 'exhibit-a',
    title: 'Exhibit A',
    subtitle: 'The Post',
    body: 'A screenshot, timestamped 03:12. Caption: "nobody asked but here is my 14-part thread on why I am right". 2 likes. One is the defendant.',
    color: '#A32D3F',
  },
  'exhibit-b': {
    id: 'exhibit-b',
    title: 'Exhibit B',
    subtitle: 'The Receipts',
    body: 'A laminated folder of replies, each highlighted in gold. The prosecution has colour-coded the cringe on a scale of "oof" to "delete your account".',
    color: '#D9A046',
  },
  'exhibit-c': {
    id: 'exhibit-c',
    title: 'Exhibit C',
    subtitle: 'The Defence',
    body: 'A single sticky note in the defence\'s handwriting: "it was a bit". Underneath, smaller: "mostly".',
    color: '#4D7CC5',
  },
};

/** Round-robin over named pools. */
export class BarkBook {
  readonly #next = new Map<string, number>();
  constructor(readonly pools: Readonly<Record<string, readonly string[]>> = BARKS) {}

  next(pool: string): string | null {
    const lines = this.pools[pool];
    if (!lines || lines.length === 0) return null;
    const i = this.#next.get(pool) ?? 0;
    this.#next.set(pool, (i + 1) % lines.length);
    return lines[i]!;
  }
}

export type VerdictText = { headline: string; judge: string };

export const BUILTIN_LINES = {
  allRise: [
    { speaker: 'bailiff', text: 'ALL RISE! Court is now in session, the Honourable Judge Gavel.exe presiding.' },
    { speaker: 'judge', text: 'Be seated. The sunglasses stay on: the truth is blinding.' },
  ],
  opening: [
    { speaker: 'judge', text: 'We are here because of a post. A very specific post. Prosecution, your opening.' },
    { speaker: 'prosecutor', text: 'Your Honour, the defendant posted at 3 a.m. with full confidence and zero context. We will prove the cringe.' },
    { speaker: 'defense', text: 'My client was simply cooking. You do not judge a chef by the smoke alarm.' },
  ],
  arguing: [
    { speaker: 'prosecutor', text: 'Exhibit A: fourteen parts. FOURTEEN. Nobody asked for part nine.' },
    { speaker: 'defense', text: 'OBJECTION! Part nine had a meme. A good one.' },
    { speaker: 'judge', text: 'Overruled. I saw the meme. Order! ORDER!' },
    { speaker: 'prosecutor', text: 'The defence calls it a bit. The internet calls it evidence.' },
  ],
  deliberating: [
    { speaker: 'judge', text: 'The jury will now deliberate. Votes are sealed until the reveal. No peeking, Juror 2.' },
    { speaker: 'juror-2', text: 'I was not peeking. I was... squinting supportively.' },
    { speaker: 'juror-1', text: 'Honestly part nine was kind of funny.' },
  ],
} as const satisfies Record<string, readonly DialogueLine[]>;

export const VERDICT_TEXT: Readonly<Record<string, VerdictText>> = {
  guilty: { headline: 'GUILTY OF CRINGE', judge: 'The jury finds the defendant... GUILTY of cringe. Sentence: the post stays up.' },
  'not-cooked': { headline: 'NOT COOKED', judge: 'The jury finds the defendant NOT COOKED. Let bro cook. Court is adjourned.' },
  'side-a': { headline: 'SIDE A WINS', judge: 'The jury sides with Side A. Side B, the leftovers were not yours.' },
  'side-b': { headline: 'SIDE B WINS', judge: 'The jury sides with Side B. Side A, apologise to the group chat.' },
  mistrial: { headline: 'MISTRIAL', judge: 'A split jury. Mistrial! Bonds are refunded. Everybody go home and think about it.' },
};
