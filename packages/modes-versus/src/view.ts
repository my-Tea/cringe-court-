/**
 * Per-viewer projections of a Versus case. The UI renders only what these
 * return, which is where the information wall (D1) is enforced on screen:
 * - a side sees its own brief in full (story, private notes, angle);
 * - the other side's *public* story and nickname appear once that side has
 *   briefed, so each side reads the other's current public version before its
 *   own final approval (GAME-MODES §3 step 3; any edit resets both approvals);
 *   never its notes or angle. An invitee sees neither story before accepting;
 * - jurors and spectators see public text only, and only once the case is on
 *   the ledger.
 */
import {
  ZERO_USDC,
  activeDeadline,
  statementFor,
  type Deadline,
  type Hex,
  type ReceiptLine,
  type SideId,
  type TrialState,
  type Usdc,
} from '@cringe-court/core';
import { otherSide } from './definition';
import type { VersusCase } from './world';

export type Viewer = SideId | 'juror' | 'invitee' | 'spectator';

const lower = (a: Hex) => a.toLowerCase();

export function seatsOf(c: VersusCase): readonly { seat: number; account: Hex; committed: boolean; revealed: boolean; choice?: 0 | 1 }[] {
  const s = c.state;
  if ('seats' in s) return s.seats;
  return c.chain?.seats.map((x) => ({ seat: x.seat, account: x.juror, committed: x.committed, revealed: x.revealed, ...(x.choice !== undefined ? { choice: x.choice } : {}) })) ?? [];
}

export function viewerOf(c: VersusCase, account: Hex | null): Viewer {
  if (account) {
    const a = lower(account);
    if (c.parties.a?.account === a) return 'a';
    if (c.parties.b?.account === a) return 'b';
    if (seatsOf(c).some((x) => lower(x.account) === a)) return 'juror';
  }
  if (c.state.stage === 'filing' && c.state.step === 'awaiting-consent') return 'invitee';
  return 'spectator';
}

/** The six steps the case room shows. */
export const VERSUS_STEPS = ['Invite', 'Briefs', 'Counsel', 'Funding', 'Jury', 'Verdict'] as const;

export function stepIndex(s: TrialState): number {
  switch (s.stage) {
    case 'filing':
      return 0;
    case 'evidence':
      return 1;
    case 'counsel':
      return s.step === 'funding' ? 3 : 2;
    case 'jury':
      return 4;
    case 'verdict':
    case 'appeal':
    case 'share':
      return 5;
    case 'closed':
      return s.cancelledFrom === 'filing' ? 0 : s.cancelledFrom === 'evidence' ? 1 : s.cancelledFrom === 'counsel' ? (s.transcript ? 3 : 2) : 4;
    default:
      return 0;
  }
}

export interface SideStatus {
  side: SideId;
  joined: boolean;
  briefed: boolean;
  /** Approved its brief for the current round of evidence (resets on any edit). */
  approvedBrief: boolean;
  approvedDraft: boolean;
  paid: boolean;
  redraftsLeft: number;
  nickname: string | null;
  exhibits: number;
}

export function sideStatus(c: VersusCase, side: SideId): SideStatus {
  const s = c.state;
  const filing = s.filing.sides[side];
  const party = c.parties[side];
  const pastEvidence = s.stage !== 'filing' && s.stage !== 'evidence' && !(s.stage === 'closed' && (s.cancelledFrom === 'filing' || s.cancelledFrom === 'evidence'));
  const approvedBrief = s.stage === 'evidence' ? s.approvals.includes(side) : pastEvidence;
  const counselApprovals = s.stage === 'counsel' ? s.approvals : [];
  const transcriptFrozen = 'transcript' in s && s.transcript !== null;
  const deposits = 'deposits' in s ? s.deposits : (c.chain?.deposits ?? []);
  const paid = Boolean(party && deposits.some((d) => lower(d.account) === party.account));
  const used = s.stage === 'counsel' ? (s.redraftsUsed[side] ?? 0) : 0;
  return {
    side,
    joined: Boolean(party),
    briefed: Boolean(filing?.story.trim()),
    approvedBrief,
    approvedDraft: counselApprovals.includes(side) || transcriptFrozen,
    paid,
    redraftsLeft: Math.max(0, s.rules.redraftsPerSide - used),
    nickname: filing?.nickname ?? null,
    exhibits: 'exhibits' in s ? s.exhibits.filter((x) => x.submittedBy === side).length : 0,
  };
}

export interface VisibleBrief {
  story: string;
  nickname: string | null;
  /** Present for the side's own brief only. */
  privateNotes?: string;
  angle?: string | null;
}

/** What `viewer` may read of `side`'s brief, or null while it is not public yet. */
export function visibleBrief(c: VersusCase, viewer: Viewer, side: SideId): VisibleBrief | null {
  const filing = c.state.filing.sides[side];
  if (!filing) return null;
  if (viewer === side) return { story: filing.story, nickname: filing.nickname, privateNotes: filing.privateNotes, angle: filing.angle };
  const status = sideStatus(c, side);
  const onLedger = c.caseNumber !== null;
  const otherParty = viewer === otherSide(side);
  if ((otherParty && status.briefed) || onLedger) return { story: filing.story, nickname: filing.nickname };
  return null;
}

export interface NextStep {
  /** Short line for lists and the "your move" banner. */
  label: string;
  /** True when this viewer is the one holding the case up. */
  yourMove: boolean;
  deadline: { deadline: Deadline; endsAt: number } | null;
}

export function nextStep(c: VersusCase, viewer: Viewer, account: Hex | null): NextStep {
  const s = c.state;
  const deadline = activeDeadline(s);
  const me = viewer === 'a' || viewer === 'b' ? viewer : null;
  const them = me ? otherSide(me) : null;
  const st = me ? sideStatus(c, me) : null;
  const out = (label: string, yourMove = false): NextStep => ({ label, yourMove, deadline });
  switch (s.stage) {
    case 'filing':
      if (s.step === 'drafting') return out('Draft not filed yet', me === 'a');
      if (viewer === 'invitee') return out('You are invited. Accept or decline.', true);
      return out('Waiting for Side B to accept the invite');
    case 'evidence':
      if (!me) return out('Both sides are briefing their agents');
      if (!st!.briefed) return out('Brief your agent', true);
      if (!st!.approvedBrief) return out('Review and approve your brief', true);
      return out(`Waiting for Side ${them!.toUpperCase()} to approve their brief`);
    case 'counsel':
      if (s.step === 'drafting') return out('The agents are drafting the trial');
      if (s.step === 'review') {
        if (!me) return out('The sides are reviewing the draft');
        return st!.approvedDraft ? out(`Waiting for Side ${them!.toUpperCase()} to approve the draft`) : out('Read the draft, then approve it', true);
      }
      if (!me) return out('Waiting for both sides to pay');
      return st!.paid ? out(`Waiting for Side ${them!.toUpperCase()} to pay their half`) : out('Pay your half to call the jury', true);
    case 'jury': {
      const mine = account ? seatsOf(c).find((x) => lower(x.account) === lower(account)) : undefined;
      if (s.step === 'recruiting') return out(`Jury selection: ${s.seats.length} of ${s.terms.jurySize} seats taken`, viewer === 'spectator');
      if (s.step === 'briefing') return out('The jury is seated');
      if (s.step === 'commit') return mine && !mine.committed ? out('Watch the trial, then seal your scroll', true) : out('The jury is sealing their scrolls');
      if (s.step === 'reveal') return mine && mine.committed && !mine.revealed ? out('Open your scroll before the deadline', true) : out('The jury is opening their scrolls');
      return out('The clerk is counting the scrolls');
    }
    case 'verdict':
    case 'appeal':
    case 'share': {
      const claim = account ? claimable(c, account) : ZERO_USDC;
      if (claim > 0n) return out('Verdict is in. Claim your payout.', true);
      return out(s.verdict.kind === 'no-verdict' ? 'NO VERDICT: both sides refunded' : `Verdict: ${s.verdict.label}`);
    }
    case 'closed': {
      const claim = account ? claimable(c, account) : ZERO_USDC;
      if (claim > 0n) return out('Case dismissed. Claim your refund.', true);
      return out('Case dismissed');
    }
    default:
      return out('');
  }
}

/** What `account` can still claim from the ledger. */
export function claimable(c: VersusCase, account: Hex): Usdc {
  const settlement = 'settlement' in c.state ? c.state.settlement : null;
  if (!settlement) return ZERO_USDC;
  if (c.claims.some((x) => lower(x.account) === lower(account))) return ZERO_USDC;
  return statementFor(settlement, lower(account) as Hex).payout;
}

export function receiptFor(c: VersusCase, account: Hex): readonly ReceiptLine[] {
  const settlement = 'settlement' in c.state ? c.state.settlement : null;
  return settlement ? statementFor(settlement, lower(account) as Hex).lines : [];
}

export function claimedBy(c: VersusCase, account: Hex): Usdc | null {
  return c.claims.find((x) => lower(x.account) === lower(account))?.amount ?? null;
}

/** "Side A" / "Side B" / "Juror 2" for an account on this case. */
export function roleLabel(c: VersusCase, account: Hex): string {
  const a = lower(account);
  if (c.parties.a?.account === a) return 'Side A';
  if (c.parties.b?.account === a) return 'Side B';
  const seat = seatsOf(c).find((x) => lower(x.account) === a);
  return seat ? `Juror ${seat.seat}` : 'Someone';
}

/** Cases this account is part of, most recently active first. */
export function casesFor(cases: readonly VersusCase[], account: Hex): readonly VersusCase[] {
  return cases.filter((c) => viewerOf(c, account) !== 'spectator' && viewerOf(c, account) !== 'invitee').sort((x, y) => y.state.updatedAt - x.state.updatedAt);
}
