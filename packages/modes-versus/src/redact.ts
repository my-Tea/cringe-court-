/**
 * The redaction pass (V4 §12, GAME-MODES §3 "no real names, photos or contact
 * details in either intake (the agent redacts them)"). It runs on everything
 * that can become public: each side's story, nickname and exhibits. Private
 * notes are redacted too, because they reach a model prompt.
 *
 * Pattern-based and conservative: it removes contact details and identifiers a
 * stranger could use to find someone, plus likely first names: a capitalised
 * word right after a cue ("ask Priya", "my roommate Sam") and a compact list of
 * common given names that are rarely ordinary words. It cannot know every name;
 * each side still reviews and approves the result.
 */
export type RedactionKind = 'email' | 'url' | 'phone' | 'wallet' | 'ens' | 'handle' | 'number' | 'name';

export interface RedactionHit {
  kind: RedactionKind;
  /** What was removed (kept client-side so the user can see why). */
  match: string;
}

export interface Redacted {
  text: string;
  hits: readonly RedactionHit[];
}

export const REDACTION_LABELS: Readonly<Record<RedactionKind, string>> = {
  email: 'email address',
  url: 'link',
  phone: 'phone number',
  wallet: 'wallet address',
  ens: 'ENS name',
  handle: 'social handle',
  number: 'long number',
  name: 'first name',
};

const PLACEHOLDER: Readonly<Record<RedactionKind, string>> = {
  email: '[email removed]',
  url: '[link removed]',
  phone: '[number removed]',
  wallet: '[wallet removed]',
  ens: '[name removed]',
  handle: '[handle removed]',
  number: '[number removed]',
  name: '[name removed]',
};

/** Capitalised words that follow a cue but are not names. */
const NOT_NAMES = new Set(
  (
    'I Me My Mine Myself You Your Yours He Him His She Her Hers We Us Our They Them Their It Its This That These Those The A An ' +
    'Side Agent Sides Everyone Everybody Anyone Someone Nobody Somebody Everything Anything Something Nothing Both Each All Any Some ' +
    'Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April May June July August September October November December ' +
    'Court Judge Jury Honor Your Please Again Later Now Today Tonight Tomorrow Yesterday Then There Here What When Why How Who Which Where If But And Or So Not No Yes ' +
    'Dad Mom Mum Mama Papa Grandma Grandpa'
  ).split(' '),
);

const CUE_VERBS =
  'ask|asks|asked|asking|tell|tells|told|telling|call|calls|called|calling|text|texts|texted|texting|message|messages|messaged|dm|dms|dmed|ping|pinged|email|emailed|thank|thanked|thanks|blame|blamed|ghost|ghosted|ask|invite|invited|warn|warned';
const CUE_RELATIONS =
  'friend|ex|roommate|flatmate|housemate|boyfriend|girlfriend|partner|wife|husband|fiance|fiancee|crush|date|coworker|colleague|boss|neighbou?r|cousin|sister|brother|bestie|buddy|mate|classmate|landlord|manager|teammate';

const COMMON_NAMES =
  'Aaron Adam Aditya Ahmed Aisha Alex Alexander Alexis Alice Alicia Amanda Amit Amy Ana Andrea Andrew Angela Anita Ankit Anna Anthony Arjun Ashley Barbara Ben Benjamin Beth Betty Brandon Brian Brittany Carlos Carol Caroline Catherine Charles Charlotte Chloe Christina Christopher Claire Daniel David Deepak Derek Diana Diego Dmitri Dylan Elena Elijah Elizabeth Ella Emily Emma Eric Ethan Eva Fatima Felix Fiona Frank Gabriel George Hannah Harry Heather Henry Isabella Jacob Jake James Jamal Jason Jennifer Jessica Jordan Joseph Joshua Julia Justin Karen Kate Katherine Kayla Kevin Kimberly Kyle Laura Lauren Leah Liam Lily Linda Lisa Logan Lucas Lucy Luis Madison Marcus Maria Marie Mariam Matthew Megan Mei Melissa Michael Michelle Mohammed Mohammad Monica Nadia Natalie Nathan Nicholas Nicole Nina Noah Olivia Omar Oscar Patricia Paul Pooja Priya Rachel Rahul Raj Rebecca Richard Rohan Rohit Ryan Samantha Sanjay Sara Sarah Sean Sergio Shreya Simon Sofia Sophia Stephanie Steven Susan Tanya Taylor Thomas Tiffany Timothy Tom Tyler Vanessa Victoria Vikram Vivek Wei Yasmin Zachary Zoe Zara';

const NAME_WORD = '[A-Z][a-z\u00C0-\u017F]{2,}(?:-[A-Z][a-z]+)?';
const NAME_RULES: readonly RegExp[] = [
  new RegExp(`\\b((?:${CUE_VERBS})\\s+)(${NAME_WORD})(?![\\w'’-]*\\.[a-z])`, 'gi'),
  new RegExp(`\\b((?:my|our|his|her|their)\\s+(?:${CUE_RELATIONS})\\s+)(${NAME_WORD})`, 'gi'),
];
const COMMON_NAME_RE = new RegExp(`\\b(${COMMON_NAMES.split(' ').join('|')})\\b`, 'g');

// Order matters: emails before handles, URLs before ENS, wallets before long numbers.
const RULES: ReadonlyArray<{ kind: RedactionKind; re: RegExp }> = [
  { kind: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'url', re: /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi },
  { kind: 'url', re: /\b[a-z0-9-]+\.(?:com|net|org|io|xyz|app|co|me|gg|tv|ly)(?:\/[^\s]*)?\b/gi },
  { kind: 'wallet', re: /\b0x[a-fA-F0-9]{40}\b/g },
  { kind: 'ens', re: /\b[a-z0-9-]{3,}\.eth\b/gi },
  { kind: 'handle', re: /(^|[^\w@])@[A-Za-z0-9_]{2,30}\b/g },
  { kind: 'phone', re: /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?)?\d{3,5}[\s.-]\d{3,6}(?:[\s.-]\d{2,6})?\b/g },
  { kind: 'number', re: /\b\d{9,}\b/g },
];

export interface RedactOptions {
  /** Look for first names. Off for the nickname a player chose for themselves. Default true. */
  names?: boolean;
}

function redactNames(input: string, hits: RedactionHit[]): string {
  let text = input;
  const take = (name: string): string | null => {
    if (NOT_NAMES.has(name)) return null;
    hits.push({ kind: 'name', match: name });
    return PLACEHOLDER.name;
  };
  for (const re of NAME_RULES) {
    // The cue is case-insensitive (the "i" flag), but the name itself must be capitalised.
    text = text.replace(re, (m: string, cue: string, name: string) => (/^[A-Z]/.test(name) ? `${cue}${take(name) ?? name}` : m));
  }
  return text.replace(COMMON_NAME_RE, (name: string) => take(name) ?? name);
}

export function redact(input: string, options: RedactOptions = {}): Redacted {
  let text = input;
  const hits: RedactionHit[] = [];
  for (const { kind, re } of RULES) {
    text = text.replace(re, (match: string, lead?: string) => {
      // The handle rule captures the character before "@" so "a@b" (email) and "x@y" stay intact.
      const prefix = kind === 'handle' && typeof lead === 'string' ? lead : '';
      hits.push({ kind, match: match.slice(prefix.length) });
      return `${prefix}${PLACEHOLDER[kind]}`;
    });
  }
  if (options.names !== false) text = redactNames(text, hits);
  return { text, hits };
}

/**
 * Redaction placeholders already present in stored text, as hits. A brief is
 * stored redacted, so re-running redact() on it finds nothing; this lets the
 * case room report the same removals the review screen showed. "[number removed]"
 * is shared by phone numbers and long numbers and is reported as a phone number.
 */
export function placeholderHits(text: string): readonly RedactionHit[] {
  const hits: RedactionHit[] = [];
  const seen: Array<[RedactionKind, string]> = [
    ['email', PLACEHOLDER.email],
    ['url', PLACEHOLDER.url],
    ['phone', PLACEHOLDER.phone],
    ['wallet', PLACEHOLDER.wallet],
    ['name', PLACEHOLDER.name],
    ['handle', PLACEHOLDER.handle],
  ];
  for (const [kind, ph] of seen) {
    for (let i = text.indexOf(ph); i !== -1; i = text.indexOf(ph, i + ph.length)) hits.push({ kind, match: ph });
  }
  return hits;
}

/** "2 phone numbers and a link" — for the review screen. */
export function describeHits(hits: readonly RedactionHit[]): string {
  if (hits.length === 0) return 'Nothing needed removing.';
  const counts = new Map<RedactionKind, number>();
  for (const h of hits) counts.set(h.kind, (counts.get(h.kind) ?? 0) + 1);
  const parts = [...counts].map(([kind, n]) => (n === 1 ? `1 ${REDACTION_LABELS[kind]}` : `${n} ${REDACTION_LABELS[kind]}s`));
  const list = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `Removed ${list}.`;
}
