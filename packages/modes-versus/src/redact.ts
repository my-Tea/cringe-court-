/**
 * The redaction pass (V4 §12, GAME-MODES §3 "no real names, photos or contact
 * details in either intake (the agent redacts them)"). It runs on everything
 * that can become public: each side's story, nickname and exhibits. Private
 * notes are redacted too, because they reach a model prompt.
 *
 * Pattern-based and conservative: it removes contact details and identifiers a
 * stranger could use to find someone. It does not detect bare first names; the
 * briefing asks people not to use them, and each side approves the result.
 */
export type RedactionKind = 'email' | 'url' | 'phone' | 'wallet' | 'ens' | 'handle' | 'number';

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
};

const PLACEHOLDER: Readonly<Record<RedactionKind, string>> = {
  email: '[email removed]',
  url: '[link removed]',
  phone: '[number removed]',
  wallet: '[wallet removed]',
  ens: '[name removed]',
  handle: '[handle removed]',
  number: '[number removed]',
};

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

export function redact(input: string): Redacted {
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
  return { text, hits };
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
