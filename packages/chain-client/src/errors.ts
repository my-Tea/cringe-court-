/**
 * Every revert surfaces as a CourtError whose `code` is the Solidity custom
 * error name (e.g. "CommitClosed"), from both the viem adapter and the mock,
 * so UI copy can switch on one set of names.
 */
export class CourtError extends Error {
  constructor(
    readonly code: string,
    readonly args: readonly unknown[] = [],
    message?: string,
  ) {
    super(message ?? (args.length ? `${code}(${args.map(String).join(", ")})` : code));
    this.name = "CourtError";
  }
}

export function isCourtError(e: unknown, code?: string): e is CourtError {
  return e instanceof CourtError && (code === undefined || e.code === code);
}

/** Plain-language copy for the reverts a juror or party can actually hit. */
export const COURT_ERROR_COPY: Record<string, string> = {
  ModeDisabled: "This court is closed for now.",
  PassDisabled: "The 0G Compute Pass isn't available yet. The standard price covers your AI.",
  PartyNotVerified: "Verify you're a human first, so you can be kept off your own jury.",
  SamePerson: "You can't take yourself to court.",
  NotCounterparty: "This invite is for someone else.",
  NotCreator: "Only the person who opened this case can do that.",
  DeadlinePassed: "That deadline has passed.",
  NotExpired: "That deadline hasn't passed yet.",
  BelowMinContribution: "Contributions start at 0.10 test USDC.",
  SponsorRequired: "Public cases need a sponsor before they can be published.",
  MarketingCapReached: "The marketing budget for unsponsored public cases is used up.",
  OfferExpired: "This seat offer timed out. Wait for the next one; declining never costs you anything.",
  InvalidSeatOffer: "This seat offer isn't valid for you.",
  AlreadySeated: "You already hold a seat on this jury.",
  PartyCannotServe: "People in a case can't sit on its jury.",
  JurorNotVerified: "Juror Screening needed: verify with World ID to take a paid seat.",
  HumanAlreadySeated: "One seat per human. You're already on this jury with another wallet.",
  NotJuror: "Only seated jurors can vote on this case.",
  CommitClosed: "The secret ballot window has closed.",
  RevealNotOpen: "It isn't time to open your scroll.",
  NoCommitment: "There's no sealed ballot from you to open.",
  AlreadyRevealed: "Your scroll is already open.",
  InvalidChoice: "Pick one of the two sides.",
  CommitmentMismatch: "That scroll doesn't match your sealed ballot. Check you're using the saved scroll for this case.",
  NotFinalizable: "The court can't be settled until every scroll is open or the reveal deadline passes.",
  InsufficientReserve: "The platform's incident reserve is too low to open this court.",
  NotRefundable: "This case isn't refundable.",
  NothingToClaim: "Nothing to collect.",
};
