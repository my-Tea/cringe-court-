/**
 * Solo intake: the confession form, its validation and the redaction pass
 * (V4 §12: no real names, contact details or wallet addresses in anything the
 * jury, the NPC opponent or the public sees). Pure functions; the UI and the
 * session both call them so the rules live in one place.
 */
import { CATEGORIES, type Category } from '@cringe-court/core';
import { PRIVATE_NOTES_MAX, TITLE_MAX, soloMode } from './definition';

export interface SoloDraft {
  category: Category | null;
  title: string;
  /** The confession as the user wrote it. Redacted before anyone else sees it. */
  story: string;
  /** For Counsel Chaos only (D1). Never redacted for the advocate, never shown to anyone else. */
  privateNotes: string;
  /** Names or handles the user wants hidden, on top of the automatic pass. */
  hiddenNames: readonly string[];
}

export const EMPTY_DRAFT: SoloDraft = { category: null, title: '', story: '', privateNotes: '', hiddenNames: [] };

export const STORY_MIN = 40;
export const STORY_MAX = soloMode.rules.storyMaxChars;
export const ANGLE_MAX = soloMode.rules.angleMaxChars;
export { PRIVATE_NOTES_MAX, TITLE_MAX };

export type DraftField = 'category' | 'title' | 'story' | 'privateNotes';
export type DraftErrors = Partial<Record<DraftField, string>>;

export function validateDraft(d: SoloDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.category) e.category = 'Pick the kind of crime you are confessing to.';
  const title = d.title.trim();
  if (!title) e.title = 'Give the case a title. The jury reads it first.';
  else if (title.length > TITLE_MAX) e.title = `Keep the title under ${TITLE_MAX} characters.`;
  const story = d.story.trim();
  if (!story) e.story = 'Tell the court what you did.';
  else if (story.length < STORY_MIN) e.story = `A little more detail, please: at least ${STORY_MIN} characters so both lawyers have something to argue.`;
  else if (story.length > STORY_MAX) e.story = `The court reads ${STORY_MAX} characters at most.`;
  if (d.privateNotes.length > PRIVATE_NOTES_MAX) e.privateNotes = `Notes for your lawyer stop at ${PRIVATE_NOTES_MAX} characters.`;
  return e;
}

export function validateAngle(angle: string): string | null {
  const a = angle.trim();
  if (!a) return 'Pick an angle or write one line for Counsel Chaos.';
  if (a.length > ANGLE_MAX) return `One line, ${ANGLE_MAX} characters at most.`;
  return null;
}

/* ── Redaction ─────────────────────────────────────────────────────────── */

export type RedactionKind = 'email' | 'url' | 'wallet' | 'ens' | 'phone' | 'handle' | 'name';

export interface Redaction {
  kind: RedactionKind;
  original: string;
  replacement: string;
  /** Offsets in the *original* text. */
  start: number;
  end: number;
}

export interface RedactionResult {
  text: string;
  redactions: readonly Redaction[];
}

export const REDACTION_LABELS: Readonly<Record<RedactionKind, string>> = {
  email: 'Email address',
  url: 'Link',
  wallet: 'Wallet address',
  ens: 'ENS name',
  phone: 'Phone number',
  handle: 'Social handle',
  name: 'Name you asked to hide',
};

const REPLACEMENT: Readonly<Record<RedactionKind, string>> = {
  email: '[email redacted]',
  url: '[link redacted]',
  wallet: '[wallet redacted]',
  ens: '[wallet redacted]',
  phone: '[number redacted]',
  handle: '[@redacted]',
  name: '[name redacted]',
};

// Order matters: earlier patterns win where matches overlap (an email contains an @handle).
const PATTERNS: ReadonlyArray<readonly [RedactionKind, RegExp]> = [
  ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ['url', /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi],
  ['wallet', /\b0x[a-f0-9]{40}\b/gi],
  ['ens', /\b[a-z0-9-]{3,}\.eth\b/gi],
  ['phone', /(?<![\w.])\+?\d[\d\s().-]{7,}\d(?![\w.])/g],
  ['handle', /(?<![\w@[])@[a-z0-9_]{2,30}\b/gi],
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace contact details, wallets and the names the user listed. Deterministic
 * and idempotent: redacting redacted text changes nothing.
 */
export function redact(text: string, hiddenNames: readonly string[] = []): RedactionResult {
  const found: Redaction[] = [];
  const taken = (start: number, end: number) => found.some((r) => start < r.end && end > r.start);
  const add = (kind: RedactionKind, re: RegExp) => {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (taken(start, end)) continue;
      found.push({ kind, original: m[0], replacement: REPLACEMENT[kind], start, end });
    }
  };
  for (const [kind, re] of PATTERNS) add(kind, re);
  const names = [...new Set(hiddenNames.map((n) => n.trim()).filter((n) => n.length >= 2))].sort((a, b) => b.length - a.length);
  for (const name of names) add('name', new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, 'giu'));
  found.sort((a, b) => a.start - b.start);
  let out = '';
  let at = 0;
  for (const r of found) {
    out += text.slice(at, r.start) + r.replacement;
    at = r.end;
  }
  out += text.slice(at);
  return { text: out, redactions: found };
}

/** The public filing for the case: redacted title and story. */
export function publicFiling(d: SoloDraft): { title: string; story: string; redactions: readonly Redaction[] } {
  const title = redact(d.title.trim(), d.hiddenNames);
  const story = redact(d.story.trim(), d.hiddenNames);
  return { title: title.text, story: story.text, redactions: [...title.redactions, ...story.redactions] };
}

/* ── Copy ──────────────────────────────────────────────────────────────── */

export interface CategoryCopy {
  id: Category;
  name: string;
  blurb: string;
  /** Placeholder confession for the story field. */
  example: string;
  exampleTitle: string;
}

export const CATEGORY_COPY: readonly CategoryCopy[] = [
  {
    id: 'crypto-crimes',
    name: CATEGORIES['crypto-crimes'],
    blurb: 'Aped in, held the bag, called the top in the group chat.',
    exampleTitle: 'Bought the top, again',
    example: 'I put my rent money into a coin called $BROCCOLI because a frog avatar said "trust". It went down 94 % in one hour. I told my roommate it was "a long-term position".',
  },
  {
    id: 'dating-crimes',
    name: CATEGORIES['dating-crimes'],
    blurb: 'Ghosting, double-texting, the 2 a.m. "u up".',
    exampleTitle: 'Ghosted after brunch',
    example: 'We had a great brunch. I said "let\'s do this again!" and then never texted back for three weeks because I could not decide which emoji to use.',
  },
  {
    id: 'npc-behavior',
    name: CATEGORIES['npc-behavior'],
    blurb: 'Reply-all, slow walking, "you too" to the waiter.',
    exampleTitle: 'Reply-all to the whole company',
    example: 'I replied-all "lol same" to a 3,000-person email about the fire drill. Then I replied-all again to apologise. Then once more to say sorry for the apology.',
  },
  {
    id: 'internet-crimes',
    name: CATEGORIES['internet-crimes'],
    blurb: 'Hot takes, ratio attempts, posting through it.',
    exampleTitle: 'Posted through it',
    example: 'I posted a hot take that pineapple is a vegetable, got ratioed by a cooking account, and kept posting "source?" under every reply for six hours.',
  },
];

export function categoryCopy(id: Category): CategoryCopy {
  const c = CATEGORY_COPY.find((x) => x.id === id);
  if (!c) throw new RangeError(`Unknown category ${id}`);
  return c;
}
