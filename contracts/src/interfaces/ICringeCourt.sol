// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/// @title ICringeCourt types
/// @notice Shared enums, structs, events and errors of the CringeCourt escrow.
///         Every amount is in USDC base units (6 decimals: 400_000 = 0.40 USDC).
interface ICringeCourtTypes {
    /// @dev 0 = Mode 1 Solo vs NPC, 1 = Mode 2 Versus, 2 = Mode 3 Grand Jury
    enum Mode {
        Solo,
        Versus,
        GrandJury
    }

    enum Status {
        None,
        Pending, // Versus: waiting for Side B to consent and fund. Grand Jury: crowdfunding.
        Recruiting, // fully funded; jurors accept seats and post bonds
        Preparing, // jury full; AI prepares and freezes the transcript
        Voting, // court open: commit window, then reveal window
        Finalized,
        Cancelled
    }

    /// @dev Choice 0 / 1 are the two ballot positions: GUILTY / NOT COOKED (Mode 1),
    ///      SIDE A / SIDE B (Mode 2), the two reviewed titles (Mode 3). Labels are
    ///      case metadata and never stored on-chain (D5).
    enum Outcome {
        None,
        Choice0,
        Choice1,
        NoVerdict
    }

    enum CancelReason {
        None,
        ConsentExpired, // Versus: Side B did not fund before the consent deadline
        InviteWithdrawn, // Versus: Side A withdrew before Side B funded
        FundingExpired, // Grand Jury: target not reached by the funding deadline
        JuryNotFilled, // recruitment window ended without a full jury
        PreparationFailed, // operator: AI could not prepare a fair case (D1 balance gate)
        PreparationExpired, // nobody opened the court before the preparation deadline
        ProtectiveCancel // operator: platform fault or fairness incident (V4 §8)
    }

    /// @notice UI-facing phase, derived from status and the clock.
    enum Phase {
        None,
        AwaitingCounterparty,
        Crowdfunding,
        Recruiting,
        Preparing,
        Commit,
        Reveal,
        Finalizable,
        Expired, // a deadline passed; anyone may call cancelExpired
        Finalized,
        Cancelled
    }

    /// @notice Per-mode terms. Snapshotted into every case at creation and
    ///         immutable for that case (DECISIONS rule 2).
    struct Terms {
        uint8 n; // jury = 2n + 1, verdict threshold = n + 1
        uint8 minJurorLevel; // IHumanRegistry level required to take a seat
        uint8 minPartyLevel; // level required to file / join as a party (0 = not required)
        bool enabled;
        bool passEnabled; // 0G Compute Pass waiver allowed (D12, off by default)
        bool demoTiming; // windows are demo-speed and must be labelled as such (V4 §8, D14)
        uint64 bond; // per juror
        uint64 successBonus; // per timely juror when there is a verdict
        uint64 failedTrialBonus; // per timely juror on NO VERDICT, paid from forfeits
        uint64 protocolFee; // per case
        uint64 aiFeePerAgent; // Solo and Grand Jury: one agent; Versus: one per side
        uint64 incidentStipend; // per committed juror on a protective cancel, platform-funded
        uint64 minContribution; // Grand Jury crowdfund minimum
        uint64 sponsorFloor; // Grand Jury: deposit that counts as a sponsored case (0 = no rule)
        uint32 pendingWindow; // Versus consent / Grand Jury funding window
        uint32 recruitWindow;
        uint32 prepWindow;
        uint32 commitWindow;
        uint32 revealWindow;
    }

    struct Case {
        Mode mode;
        Status status;
        Outcome outcome;
        CancelReason cancelReason;
        uint8 jurySize;
        uint8 seated;
        uint8 committed;
        uint8 revealed;
        uint8 votes0;
        uint8 votes1;
        bool sponsored;
        address creator; // Solo filer, Versus Side A, Grand Jury curator
        address counterparty; // Versus Side B
        address sponsor; // Grand Jury sponsor
        bytes32 creatorHuman;
        bytes32 counterpartyHuman;
        bytes32 contentHash; // approved public case text at filing
        bytes32 transcriptHash; // frozen trial transcript fingerprint, set when the court opens
        uint64 createdAt;
        uint64 pendingDeadline;
        uint64 recruitDeadline;
        uint64 prepDeadline;
        uint64 commitDeadline;
        uint64 revealDeadline;
        uint128 target; // what the payers owe in total
        uint128 raised; // what the payers have paid in
        uint128 poolHeld;
        uint128 protocolFeeHeld;
        uint128 aiFeeHeld;
        uint128 sponsorDeposit;
        uint128 stipendLocked;
    }

    struct Juror {
        bool seated;
        bool revealed;
        uint8 seat;
        uint8 choice;
        bytes32 humanId;
        bytes32 commitment;
    }

    /// @notice Settlement receipt, emitted on finalize so every case discloses
    ///         where the money went, including absence revenue (D13).
    struct Settlement {
        Outcome outcome;
        uint8 timely;
        uint8 absent;
        uint128 payoutPerTimelyJuror; // bond back + bonus
        uint128 bonusPerTimelyJuror;
        uint128 forfeitedBonds;
        uint128 unearnedBonus;
        uint128 protocolFees;
        uint128 aiFees;
        uint128 sponsorFee;
        uint128 toTreasury;
        uint128 toAiTreasury;
        uint128 refundableToPayers;
    }

    event TermsUpdated(Mode indexed mode, Terms terms);
    event TreasuryUpdated(address treasury, address aiTreasury);
    event RegistryUpdated(address registry);
    event MarketingCapUpdated(uint32 cap);
    event ReserveFunded(address indexed from, uint256 amount);
    event ReserveWithdrawn(address indexed to, uint256 amount);

    event CaseCreated(
        uint256 indexed caseId, Mode indexed mode, address indexed creator, address counterparty, bytes32 contentHash
    );
    event PaymentReceived(uint256 indexed caseId, address indexed payer, uint256 amount, bool passUsed);
    event SponsorDeposited(uint256 indexed caseId, address indexed sponsor, uint256 amount, bool sponsored);
    event RecruitmentOpened(uint256 indexed caseId, uint64 recruitDeadline);
    event SeatAccepted(uint256 indexed caseId, address indexed juror, uint8 seat);
    event JuryFilled(uint256 indexed caseId, uint64 prepDeadline);
    event CourtOpened(uint256 indexed caseId, bytes32 transcriptHash, uint64 commitDeadline, uint64 revealDeadline);
    event VoteCommitted(uint256 indexed caseId, address indexed juror);
    event VoteRevealed(uint256 indexed caseId, address indexed juror, uint8 choice);
    event CaseFinalized(uint256 indexed caseId, Settlement settlement);
    event CaseCancelled(uint256 indexed caseId, CancelReason reason, uint256 stipendsPaid);
    event IncidentStipendPaid(uint256 indexed caseId, address indexed juror, uint256 amount);
    event RefundClaimed(uint256 indexed caseId, address indexed payer, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    error ModeDisabled(Mode mode);
    error InvalidTerms(string why);
    error ZeroAddress();
    error PassDisabled();
    error PartyNotVerified(address party);
    error SamePerson();
    error NotCounterparty();
    error NotCreator();
    error WrongMode();
    error WrongStatus(Status status);
    error DeadlinePassed(uint64 deadline);
    error NotExpired();
    error BelowMinContribution(uint256 minimum);
    error SponsorRequired(uint256 floor);
    error MarketingCapReached(uint32 cap);
    error OfferExpired();
    error InvalidSeatOffer();
    error AlreadySeated();
    error PartyCannotServe();
    error JurorNotVerified();
    error HumanAlreadySeated();
    error NotJuror();
    error ZeroValue();
    error CommitClosed();
    error RevealNotOpen();
    error NoCommitment();
    error AlreadyRevealed();
    error InvalidChoice();
    error CommitmentMismatch();
    error NotFinalizable();
    error InsufficientReserve(uint256 needed, uint256 available);
    error NotRefundable();
    error NothingToClaim();
}
