/**
 * Redaction across the wire: what one device may see of the Versus fact log.
 *
 * Clients replay the log to rebuild the case room, so redaction must keep every
 * fact in place (same count, same order) and keep every rule satisfied, or the
 * replay would diverge. It never deletes a fact; it blanks fields, using values
 * the trial rules accept (an empty note, a null angle, a short sealed marker
 * for a story that must be non-empty).
 *
 * Levels, per case and per device:
 *   a | b     a party. Its own brief in full; the other side's public story and
 *             nickname, never its private notes or angle (the information wall).
 *   public    the case is on the ledger (jury stage onward): anyone may watch.
 *             Public text only; every private note and angle stays stripped.
 *   granted   this device opened the invite (code or signed link) but is not a
 *             party: the summons (title, category, terms), nothing else. An
 *             invitee reads neither story before accepting.
 *   none      someone else's private case: sealed entirely (title, code,
 *             stories, exhibits, drafts).
 *
 * Ballots need no redaction: a commit carries only its commitment, and the salt
 * stays on the juror's device until the reveal (demo jurors' salts are derived
 * and labelled simulations).
 */
import type { CounselDraft, Exhibit, FilingPatch, SideId } from '@cringe-court/core';
import type { Fact, InviteCode, VersusCase } from '@cringe-court/modes-versus';

export type ViewLevel = SideId | 'public' | 'granted' | 'none';

export const SEALED = '[sealed]';

export function sealedCode(trialId: string): InviteCode {
  return `SEALED-${trialId}` as InviteCode;
}

export interface Viewer {
  account: string;
  grants: ReadonlySet<string>;
}

export function levelOf(c: VersusCase, viewer: Viewer): ViewLevel {
  const me = viewer.account.toLowerCase();
  if (c.parties.a?.account === me) return 'a';
  if (c.parties.b?.account === me) return 'b';
  if (c.caseNumber !== null) return 'public';
  if (viewer.grants.has(c.trialId)) return 'granted';
  return 'none';
}

function stripPrivate(patch: FilingPatch): FilingPatch {
  const out: FilingPatch = { ...patch };
  if (out.privateNotes !== undefined) out.privateNotes = '';
  if (out.angle !== undefined) out.angle = null;
  return out;
}

function sealPatch(patch: FilingPatch): FilingPatch {
  const out = stripPrivate(patch);
  if (out.story !== undefined && out.story.trim()) out.story = SEALED;
  if (out.nickname !== undefined) out.nickname = null;
  return out;
}

function sealExhibit(x: Exhibit): Exhibit {
  return { ...x, title: SEALED, body: SEALED };
}

function sealDraft(d: CounselDraft): CounselDraft {
  return { ...d, lines: d.lines.map((l) => ({ ...l, text: SEALED })) };
}

/** One fact as a viewer at `level` may see it. Facts without a case pass through. */
export function redactFact(f: Fact, level: ViewLevel): Fact {
  if (level === 'a' || level === 'b') {
    return f.type === 'brief' && f.side !== level ? { ...f, patch: stripPrivate(f.patch) } : f;
  }
  const sealed = level === 'none';
  switch (f.type) {
    case 'open':
      // A public case's code is harmless: consent closed before the case reached the ledger.
      return sealed ? { ...f, title: SEALED, code: sealedCode(f.trialId) } : f;
    case 'brief':
      return { ...f, patch: level === 'public' ? stripPrivate(f.patch) : sealPatch(f.patch) };
    case 'exhibit':
      return level === 'public' ? f : { ...f, exhibit: sealExhibit(f.exhibit) };
    case 'drafted':
      return level === 'public' ? f : { ...f, draft: sealDraft(f.draft), balance: { ...f.balance, reasons: [] } };
    default:
      return f;
  }
}

export function trialOf(f: Fact): string | null {
  return 'trialId' in f ? f.trialId : null;
}
