/**
 * Translation tables between core's app-level ledger vocabulary and p5's
 * contract-shaped chain-client: ids, money, phases, terms and errors.
 */
import {
  CancelReason,
  COURT_ERROR_COPY,
  CourtError,
  Mode as ChainMode,
  Outcome,
  Phase as ChainPhase,
  Status,
  type CaseView,
  type Terms as ChainTerms,
} from '@cringe-court/chain-client';
import {
  ChainError,
  MODES,
  caseNumber as toCaseNumber,
  micro,
  termsFor,
  type CaseNumber,
  type CasePhase,
  type CaseTerms,
  type ModeConfig,
  type ModeId,
  type Usdc,
  type VerdictKind,
} from '@cringe-court/core';

/* ── ids and money ── */

export const caseIdOf = (n: CaseNumber): bigint => BigInt(n);
export const caseNumberOf = (id: bigint): CaseNumber => toCaseNumber(Number(id));
/** Both money modules count micro-USDC (6 decimals): the bigint is the same number. */
export const usdcOf = (amount: bigint): Usdc => micro(amount);

/* ── modes ── */

const MODE_TO_CHAIN: Readonly<Record<ModeId, ChainMode>> = {
  solo: ChainMode.Solo,
  versus: ChainMode.Versus,
  'grand-jury': ChainMode.GrandJury,
};
export const chainModeOf = (mode: ModeId): ChainMode => MODE_TO_CHAIN[mode];
export function modeIdOf(mode: ChainMode): ModeId {
  return mode === ChainMode.Solo ? 'solo' : mode === ChainMode.Versus ? 'versus' : 'grand-jury';
}

/* ── phases ── */

/**
 * The contract's lazily-evaluated `Phase` as core's `CasePhase`. `Expired` is
 * "a deadline passed and nobody has called `cancelExpired` yet": the case
 * stays in the phase it expired from until `advance()` cancels it.
 */
export function casePhaseOf(phase: ChainPhase, status: Status): CasePhase | null {
  switch (phase) {
    case ChainPhase.None:
      return null;
    case ChainPhase.AwaitingCounterparty:
    case ChainPhase.Crowdfunding:
      return 'pre-trial';
    case ChainPhase.Recruiting:
      return 'recruiting';
    case ChainPhase.Preparing:
      return 'preparing';
    case ChainPhase.Commit:
      return 'commit';
    case ChainPhase.Reveal:
      return 'reveal';
    case ChainPhase.Finalizable:
      return 'finalizing';
    case ChainPhase.Finalized:
      return 'settled';
    case ChainPhase.Cancelled:
      return 'cancelled';
    case ChainPhase.Expired:
      return status === Status.Pending ? 'pre-trial' : status === Status.Recruiting ? 'recruiting' : 'preparing';
  }
}

export const CANCEL_REASONS: Readonly<Record<number, string>> = {
  [CancelReason.ConsentExpired]: 'funding-missed',
  [CancelReason.InviteWithdrawn]: 'invite-withdrawn',
  [CancelReason.FundingExpired]: 'funding-missed',
  [CancelReason.JuryNotFilled]: 'jury-unfilled',
  [CancelReason.PreparationFailed]: 'preparation-failed',
  [CancelReason.PreparationExpired]: 'preparation-expired',
  [CancelReason.ProtectiveCancel]: 'protective',
};

export function verdictKindOf(outcome: Outcome): VerdictKind {
  return outcome === Outcome.Choice0 ? 'ballot-0' : outcome === Outcome.Choice1 ? 'ballot-1' : 'no-verdict';
}

/** The deadline that ends the case's current phase, in unix seconds. */
export function phaseEndsAtOf(c: CaseView, phase: CasePhase): number | null {
  const at = (v: bigint): number | null => (v > 0n ? Number(v) : null);
  switch (phase) {
    case 'pre-trial':
      return at(c.pendingDeadline);
    case 'recruiting':
      return at(c.recruitDeadline);
    case 'preparing':
      return at(c.prepDeadline);
    case 'commit':
      return at(c.commitDeadline);
    case 'reveal':
      return at(c.revealDeadline);
    default:
      return null;
  }
}

/* ── terms ── */

/** The app-level terms of a case as the contract holds them. */
export function termsFromChain(mode: ModeId, t: ChainTerms, sponsorDeposit: bigint | null = null): CaseTerms {
  const base = MODES[mode];
  const agents = BigInt(mode === 'versus' ? 2 : 1);
  const config: ModeConfig = {
    ...base,
    economics: {
      ...base.economics,
      n: t.n,
      bondPerJuror: micro(t.bond),
      successBonusPerJuror: micro(t.successBonus),
      failedTrialBonusPerTimelyJuror: micro(t.failedTrialBonus),
      protocolFee: micro(t.protocolFee),
      aiFee: micro(t.aiFeePerAgent * agents),
      incidentStipend: micro(t.incidentStipend),
    },
    deadlines: {
      preTrial: t.pendingWindow > 0 ? t.pendingWindow : null,
      recruitment: t.recruitWindow,
      commit: t.commitWindow,
      reveal: t.revealWindow,
    },
    funding: base.funding.kind === 'crowdfund' ? { kind: 'crowdfund', minContribution: micro(t.minContribution), sponsorDeposit: null } : base.funding,
  };
  return termsFor(config, { sponsorDeposit: sponsorDeposit === null ? null : micro(sponsorDeposit) });
}

/** Money and seat differences between two terms, in plain words. Windows are not money and are not compared. */
export function diffTerms(app: CaseTerms, chain: CaseTerms): string[] {
  const out: string[] = [];
  const num = (label: string, a: bigint | number, b: bigint | number) => {
    if (a !== b) out.push(`${label}: app ${a}, ledger ${b}`);
  };
  num('jury seats', app.jurySize, chain.jurySize);
  num('verdict threshold', app.threshold, chain.threshold);
  num('juror bond', app.bondPerJuror, chain.bondPerJuror);
  num('success bonus', app.successBonusPerJuror, chain.successBonusPerJuror);
  num('failed-trial bonus', app.failedTrialBonusPerTimelyJuror, chain.failedTrialBonusPerTimelyJuror);
  num('protocol fee', app.protocolFee, chain.protocolFee);
  num('AI fee', app.aiFee, chain.aiFee);
  num('incident stipend', app.incidentStipend, chain.incidentStipend);
  num('case price', app.target, chain.target);
  if (app.payerShares.length !== chain.payerShares.length || app.payerShares.some((s, i) => s !== chain.payerShares[i])) {
    out.push(`payer shares: app [${app.payerShares.join(', ')}], ledger [${chain.payerShares.join(', ')}]`);
  }
  if (app.funding.kind === 'crowdfund' && chain.funding.kind === 'crowdfund') {
    num('minimum contribution', app.funding.minContribution, chain.funding.minContribution);
  }
  return out;
}

/* ── errors ── */

type Code = ChainError['code'];

const CODES: Readonly<Record<string, Code>> = {
  // phase
  WrongStatus: 'wrong-phase',
  WrongMode: 'wrong-phase',
  NotExpired: 'wrong-phase',
  RevealNotOpen: 'wrong-phase',
  NotFinalizable: 'wrong-phase',
  NotRefundable: 'wrong-phase',
  // deadlines
  DeadlinePassed: 'deadline',
  CommitClosed: 'deadline',
  OfferExpired: 'deadline',
  // who may act
  NotCounterparty: 'not-allowed',
  NotCreator: 'not-allowed',
  SamePerson: 'not-allowed',
  PartyCannotServe: 'not-allowed',
  PartyNotVerified: 'not-allowed',
  JurorNotVerified: 'not-allowed',
  InvalidSeatOffer: 'not-allowed',
  ECDSAInvalidSignature: 'not-allowed',
  NotJuror: 'not-allowed',
  NoCommitment: 'not-allowed',
  NothingToClaim: 'not-allowed',
  ModeDisabled: 'not-allowed',
  PassDisabled: 'not-allowed',
  SponsorRequired: 'not-allowed',
  MarketingCapReached: 'not-allowed',
  AccessControlUnauthorizedAccount: 'not-allowed',
  // money
  BelowMinContribution: 'bad-amount',
  ZeroValue: 'bad-amount',
  ZeroAddress: 'bad-amount',
  ERC20InsufficientBalance: 'bad-amount',
  ERC20InsufficientAllowance: 'bad-amount',
  // ballots
  CommitmentMismatch: 'bad-reveal',
  InvalidChoice: 'bad-reveal',
  // repeats
  AlreadySeated: 'duplicate',
  HumanAlreadySeated: 'duplicate',
  AlreadyRevealed: 'duplicate',
};

const NETWORK_NAMES = new Set([
  'HttpRequestError',
  'TimeoutError',
  'WebSocketRequestError',
  'TransportRequestTimeoutError',
  'RpcRequestError',
  'UrlRequiredError',
]);

function chainOfCauses(e: unknown): unknown[] {
  const out: unknown[] = [];
  for (let cur: unknown = e; cur && out.length < 8; cur = (cur as { cause?: unknown }).cause) out.push(cur);
  return out;
}

/** A thrown value from chain-client or viem as core's ChainError. Never throws. */
export function toChainError(e: unknown): ChainError {
  if (e instanceof ChainError) return e;
  if (e instanceof CourtError) {
    const err = new ChainError(CODES[e.code] ?? 'rejected', COURT_ERROR_COPY[e.code] ?? e.message);
    err.cause = e;
    return err;
  }
  const causes = chainOfCauses(e);
  const message = e instanceof Error ? e.message : String(e);
  let err: ChainError;
  if (/read-only port/i.test(message)) {
    err = new ChainError('not-allowed', 'Connect a wallet first');
  } else if (causes.some((c) => (c as { name?: string }).name === 'UserRejectedRequestError' || (c as { code?: number }).code === 4001)) {
    err = new ChainError('rejected', 'The wallet request was declined');
  } else if (
    causes.some((c) => NETWORK_NAMES.has((c as { name?: string }).name ?? '')) ||
    causes.some((c) => c instanceof TypeError && /fetch|network/i.test((c as Error).message))
  ) {
    err = new ChainError('network', 'Could not reach Arc testnet. Check your connection and try again.');
  } else {
    err = new ChainError('rejected', message);
  }
  err.cause = e;
  return err;
}
