/**
 * Invite codes: what Side A sends Side B ("join with code K7QM-2XPA" or a link).
 *
 * Eight Crockford base-32 symbols (no I, L, O, U, so nothing reads as another
 * letter), shown as two groups of four. The eighth symbol is a check symbol with
 * odd (so invertible mod 32) weights, so any single mistyped symbol is caught
 * before any lookup. Input is forgiving: lower case,
 * spaces, missing dash, and the usual confusions (O→0, I/L→1) are accepted.
 */
export const INVITE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const BODY = 7;

export type InviteCode = string & { readonly __inviteCode: true };

function checkSymbol(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) sum += INVITE_ALPHABET.indexOf(body[i]!) * (2 * i + 1);
  return INVITE_ALPHABET[sum % 32]!;
}

function format(raw: string): InviteCode {
  return `${raw.slice(0, 4)}-${raw.slice(4)}` as InviteCode;
}

/** A fresh code. `random` must return [0, 1); pass a CSPRNG-backed one in the browser. */
export function makeInviteCode(random: () => number): InviteCode {
  let body = '';
  for (let i = 0; i < BODY; i++) body += INVITE_ALPHABET[Math.floor(random() * 32) % 32];
  return format(body + checkSymbol(body));
}

export type InviteParse = { ok: true; code: InviteCode } | { ok: false; reason: 'empty' | 'length' | 'characters' | 'checksum'; message: string };

/** Upper-case, drop separators, fix look-alikes. */
export function normalizeInviteInput(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s\-_.]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export function parseInviteCode(input: string): InviteParse {
  const raw = normalizeInviteInput(input);
  if (!raw) return { ok: false, reason: 'empty', message: 'Enter the 8-character code from your invite.' };
  if ([...raw].some((c) => !INVITE_ALPHABET.includes(c))) {
    return { ok: false, reason: 'characters', message: 'Codes use letters and numbers only (no U).' };
  }
  if (raw.length !== BODY + 1) return { ok: false, reason: 'length', message: `Codes are 8 characters; this one has ${raw.length}.` };
  if (checkSymbol(raw.slice(0, BODY)) !== raw[BODY]) {
    return { ok: false, reason: 'checksum', message: 'That code has a typo somewhere. Check it against your invite.' };
  }
  return { ok: true, code: format(raw) };
}

/** Path of the join page for a code (the app prefixes its origin). */
export function invitePath(code: InviteCode): string {
  return `/versus/join/${code}`;
}

/** A fresh trial id ("vs-" + 10 lower-case base-32 symbols): URL-safe and unrelated to the invite code. */
export function makeTrialId(random: () => number): string {
  let id = 'vs-';
  for (let i = 0; i < 10; i++) id += INVITE_ALPHABET[Math.floor(random() * 32) % 32]!.toLowerCase();
  return id;
}
