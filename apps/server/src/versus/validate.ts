/**
 * Every fact a device sends is checked twice: its *shape* here (types, sizes,
 * formats; no unknown keys), then its *meaning* by the court's own rules when
 * the room applies it to the World. Shape checks run first so nothing odd ever
 * reaches the log that every device replays.
 *
 * Authorization is the third gate (who may write what), in `authorize`.
 */
import { CATEGORIES, keccak256, type Hex } from '@cringe-court/core';
import { FAUCET_MAX, demoJurorAccount, parseInviteCode, versusTerms, type FactBody, type VersusCase } from '@cringe-court/modes-versus';
import { encodeWire } from '@cringe-court/net';
import { levelOf, type Viewer } from './redact';

export class BadFact extends Error {}

/** Facts only the court writes (its AI clerk), never a device. */
export const CLERK_ONLY: ReadonlySet<FactBody['type']> = new Set(['drafted', 'counsel-failed', 'sentence']);

export const MAX_BATCH = 16;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const hex = (n: number) => new RegExp(`^0x[0-9a-fA-F]{${n * 2}}$`);
const ADDRESS = hex(20);
const WORD = hex(32);
const TRIAL = /^vs-[0-9a-z]{10}$/;
const SIDE = new Set(['a', 'b']);

function str(v: unknown, field: string, max: number, opts: { nullable?: boolean; min?: number } = {}): void {
  if (v === null && opts.nullable) return;
  if (typeof v !== 'string') throw new BadFact(`${field} must be text`);
  if (v.length > max) throw new BadFact(`${field} is longer than ${max} characters`);
  if (opts.min && v.trim().length < opts.min) throw new BadFact(`${field} is empty`);
}

function keys(o: Record<string, unknown>, allowed: readonly string[], what: string): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw new BadFact(`${what}: unexpected field “${k.slice(0, 24)}”`);
}

const BASE = ['type', 'seq', 'at', 'by'];

/** The canonical Versus terms this server accepts (demo deadlines; any Pass waiver combination). */
const ALLOWED_TERMS = new Set(
  [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ].map((w) => encodeWire(versusTerms({ demo: true, passWaivers: w }))),
);

/** Shape check for one incoming fact. Returns the body (seq/at/by are the court's to set). */
export function checkShape(raw: unknown): FactBody {
  if (!isObj(raw)) throw new BadFact('A fact must be an object');
  const f = raw;
  const t = f.type;
  const need = (field: string, re: RegExp, label = field) => {
    if (typeof f[field] !== 'string' || !re.test(f[field] as string)) throw new BadFact(`${label} is malformed`);
  };
  const side = () => {
    if (!SIDE.has(f.side as string)) throw new BadFact('side must be a or b');
  };
  switch (t) {
    case 'open': {
      keys(f, [...BASE, 'trialId', 'code', 'account', 'nullifier', 'category', 'title', 'terms'], 'open');
      need('trialId', TRIAL);
      need('account', ADDRESS);
      need('nullifier', WORD);
      const code = typeof f.code === 'string' ? parseInviteCode(f.code) : null;
      if (!code?.ok || code.code !== f.code) throw new BadFact('code is not a valid invite code');
      if (typeof f.category !== 'string' || !(f.category in CATEGORIES)) throw new BadFact('Unknown category');
      str(f.title, 'title', 80, { min: 1 });
      if (!ALLOWED_TERMS.has(encodeWire(f.terms))) throw new BadFact('These are not the court’s Versus terms');
      break;
    }
    case 'brief': {
      keys(f, [...BASE, 'trialId', 'side', 'account', 'patch'], 'brief');
      need('trialId', TRIAL);
      need('account', ADDRESS);
      side();
      if (!isObj(f.patch)) throw new BadFact('patch must be an object');
      keys(f.patch, ['story', 'privateNotes', 'angle', 'nickname', 'account'], 'patch');
      if ('story' in f.patch) str(f.patch.story, 'story', 1200);
      if ('privateNotes' in f.patch) str(f.patch.privateNotes, 'privateNotes', 2000);
      if ('angle' in f.patch) str(f.patch.angle, 'angle', 140, { nullable: true });
      if ('nickname' in f.patch) str(f.patch.nickname, 'nickname', 24, { nullable: true });
      if ('account' in f.patch && (typeof f.patch.account !== 'string' || !ADDRESS.test(f.patch.account))) throw new BadFact('patch.account is malformed');
      break;
    }
    case 'submit':
    case 'fund':
    case 'claim':
      keys(f, [...BASE, 'trialId', 'account'], t);
      need('trialId', TRIAL);
      need('account', ADDRESS);
      break;
    case 'approve-brief':
    case 'redraft':
    case 'approve-draft':
    case 'withdraw':
      keys(f, [...BASE, 'trialId', 'side', 'account'], t);
      need('trialId', TRIAL);
      need('account', ADDRESS);
      side();
      break;
    case 'consent':
      keys(f, [...BASE, 'trialId', 'account', 'nullifier'], t);
      need('trialId', TRIAL);
      need('account', ADDRESS);
      need('nullifier', WORD);
      break;
    case 'decline':
    case 'finalize':
      keys(f, [...BASE, 'trialId'], t);
      need('trialId', TRIAL);
      break;
    case 'exhibit': {
      keys(f, [...BASE, 'trialId', 'side', 'account', 'exhibit'], t);
      need('trialId', TRIAL);
      need('account', ADDRESS);
      side();
      const x = f.exhibit;
      if (!isObj(x)) throw new BadFact('exhibit must be an object');
      keys(x, ['id', 'submittedBy', 'kind', 'title', 'body', 'redacted'], 'exhibit');
      if (typeof x.id !== 'string' || !/^[ab]-\d{1,2}$/.test(x.id)) throw new BadFact('exhibit id is malformed');
      if (x.submittedBy !== f.side) throw new BadFact('An exhibit belongs to the side that submits it');
      if (!['text', 'screenshot', 'link', 'quote'].includes(x.kind as string)) throw new BadFact('Unknown exhibit kind');
      str(x.title, 'exhibit title', 120, { min: 1 });
      str(x.body, 'exhibit body', 1200, { min: 1 });
      if (x.redacted !== true) throw new BadFact('Exhibits must pass the redaction pass first');
      break;
    }
    case 'exhibit-removed':
      keys(f, [...BASE, 'trialId', 'side', 'account', 'exhibitId'], t);
      need('trialId', TRIAL);
      need('account', ADDRESS);
      side();
      need('exhibitId', /^[ab]-\d{1,2}$/);
      break;
    case 'faucet':
      keys(f, [...BASE, 'account', 'amount'], t);
      need('account', ADDRESS);
      if (typeof f.amount !== 'bigint' || f.amount <= 0n || f.amount > FAUCET_MAX) throw new BadFact('Faucet amount is out of range');
      break;
    case 'seat':
      keys(f, [...BASE, 'trialId', 'account', 'nullifier', 'demo'], t);
      need('trialId', TRIAL);
      need('account', ADDRESS);
      need('nullifier', WORD);
      if (f.demo !== undefined && f.demo !== 'reliable' && f.demo !== 'no-show') throw new BadFact('Unknown demo juror plan');
      break;
    case 'commit':
      keys(f, [...BASE, 'trialId', 'account', 'commitment'], t);
      need('trialId', TRIAL);
      need('account', ADDRESS);
      need('commitment', WORD);
      break;
    case 'reveal':
      keys(f, [...BASE, 'trialId', 'account', 'choice', 'salt'], t);
      need('trialId', TRIAL);
      need('account', ADDRESS);
      need('salt', WORD);
      if (f.choice !== 0 && f.choice !== 1) throw new BadFact('choice must be 0 or 1');
      break;
    case 'share':
      keys(f, [...BASE, 'trialId', 'channel'], t);
      need('trialId', TRIAL);
      if (!['link', 'image', 'x', 'native'].includes(f.channel as string)) throw new BadFact('Unknown share channel');
      break;
    case 'clock':
      keys(f, [...BASE, 'seconds'], t);
      if (!Number.isInteger(f.seconds) || (f.seconds as number) < 1 || (f.seconds as number) > 86_400) throw new BadFact('The demo clock moves forward by up to a day at a time');
      break;
    default:
      throw new BadFact(typeof t === 'string' && CLERK_ONLY.has(t as FactBody['type']) ? 'Only the court writes that' : 'Unknown fact');
  }
  const { seq: _seq, at: _at, by: _by, ...body } = f;
  return body as unknown as FactBody;
}

export class Forbidden extends Error {}

/** Demo juror seat k on a case, as the desk's demo control writes it. */
function demoSeatOf(trialId: string, account: Hex, nullifier: Hex): number | null {
  for (let k = 1; k <= 12; k++) {
    if (demoJurorAccount(trialId, k).toLowerCase() === account.toLowerCase()) {
      return keccak256(`demo-human:${trialId}:${k}`).toLowerCase() === nullifier.toLowerCase() ? k : null;
    }
  }
  return null;
}

export interface AuthorizeOptions {
  demoClock: boolean;
}

/**
 * Who may write what. Returns the author to record per fact (`by`): the
 * device's persona, or `clerk` for the labelled demo jurors it summons.
 */
export function authorize(bodies: readonly FactBody[], viewer: Viewer & { personaId: string }, cases: (trialId: string) => VersusCase | undefined, o: AuthorizeOptions): string[] {
  const me = viewer.account.toLowerCase();
  const demoAccounts = new Set<string>();
  for (const b of bodies) {
    if (b.type === 'seat' && b.demo) {
      if (demoSeatOf(b.trialId, b.account, b.nullifier) === null) throw new Forbidden('That is not one of this case’s demo juror seats');
      demoAccounts.add(b.account.toLowerCase());
    }
  }
  return bodies.map((b) => {
    if (b.type === 'clock' && !o.demoClock) throw new Forbidden('Moving the court clock is switched off on this server: every case here shares one clock.');
    if (b.type === 'seat' && b.demo) return 'clerk';
    if (b.type === 'faucet' && demoAccounts.has(b.account.toLowerCase())) return 'clerk';
    if ('account' in b && b.account.toLowerCase() !== me) throw new Forbidden('A device can only act for its own wallet');
    if (b.type === 'consent' || b.type === 'decline') {
      const c = cases(b.trialId);
      // Only a device that opened the invite (code or signed link) may answer it.
      if (!c || !viewer.grants.has(b.trialId)) throw new Forbidden('Open the invite with its code or link first');
      if (b.type === 'decline' && levelOf(c, viewer) === 'a') throw new Forbidden('Side A withdraws instead of declining');
    }
    if (b.type === 'share') {
      const c = cases(b.trialId);
      const level = c ? levelOf(c, viewer) : 'none';
      if (level !== 'a' && level !== 'b') throw new Forbidden('Only the two sides share their verdict');
    }
    return viewer.personaId;
  });
}
