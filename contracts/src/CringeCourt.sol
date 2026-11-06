// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ICringeCourtTypes} from "./interfaces/ICringeCourt.sol";
import {IHumanRegistry} from "./interfaces/IHumanRegistry.sol";
import {CourtMath} from "./CourtMath.sol";

/// @title CringeCourt
/// @notice Case escrow, juror bonds, commit-reveal ballots, deadlines and
///         settlement for all three modes (docs/DECISIONS.md). Testnet only (D14).
/// @dev Money moves by pull payment: settlement credits `claimable`, payers
///      reclaim with `claimRefund`, and nobody's transfer can block another's.
///      There is no pause: once duty is slashable the platform has no lever over
///      the deadlines (D13 safeguard 3).
contract CringeCourt is ICringeCourtTypes, AccessControl, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    /// @notice Opens the court with the frozen transcript; may fail preparation or protectively cancel.
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    /// @notice Signs random seat offers from the verified waiting pool (V4 §6 step 3).
    bytes32 public constant ASSIGNER_ROLE = keccak256("ASSIGNER_ROLE");
    /// @notice Publishes editorially reviewed Grand Jury cases (V4 §12, D10).
    bytes32 public constant CURATOR_ROLE = keccak256("CURATOR_ROLE");

    bytes32 public constant SEAT_OFFER_TYPEHASH =
        keccak256("SeatOffer(uint256 caseId,address juror,uint64 expiresAt)");

    IERC20 public immutable usdc;
    IHumanRegistry public registry;
    address public treasury;
    address public aiTreasury;

    uint256 public caseCount;
    uint256 public reserveBalance;
    uint256 public reserveLocked;
    uint32 public marketingCap;
    uint32 public marketingUsed;

    mapping(Mode => Terms) private _terms;
    mapping(uint256 caseId => Case) private _cases;
    mapping(uint256 caseId => Terms) private _caseTerms;
    mapping(uint256 caseId => address[]) private _jurorList;
    mapping(uint256 caseId => mapping(address juror => Juror)) private _jurors;
    mapping(uint256 caseId => mapping(bytes32 humanId => bool)) private _humanSeated;
    mapping(uint256 caseId => mapping(address payer => uint256)) public paidBy;
    mapping(address account => uint256) public claimable;

    constructor(IERC20 usdc_, IHumanRegistry registry_, address admin, address treasury_, address aiTreasury_)
        EIP712("CringeCourt", "1")
    {
        if (
            address(usdc_) == address(0) || address(registry_) == address(0) || admin == address(0)
                || treasury_ == address(0) || aiTreasury_ == address(0)
        ) revert ZeroAddress();
        usdc = usdc_;
        registry = registry_;
        treasury = treasury_;
        aiTreasury = aiTreasury_;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------
    // Admin: terms apply to cases created afterwards only
    // ---------------------------------------------------------------------

    function setTerms(Mode mode, Terms calldata t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _validateTerms(mode, t);
        _terms[mode] = t;
        emit TermsUpdated(mode, t);
    }

    function setTreasuries(address treasury_, address aiTreasury_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (treasury_ == address(0) || aiTreasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        aiTreasury = aiTreasury_;
        emit TreasuryUpdated(treasury_, aiTreasury_);
    }

    function setRegistry(IHumanRegistry registry_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(registry_) == address(0)) revert ZeroAddress();
        registry = registry_;
        emit RegistryUpdated(address(registry_));
    }

    /// @notice Grand Jury cases without a qualifying sponsor must fit in this
    ///         marketing budget (D10: hackathon cap of 40 published cases).
    function setMarketingCap(uint32 cap) external onlyRole(DEFAULT_ADMIN_ROLE) {
        marketingCap = cap;
        emit MarketingCapUpdated(cap);
    }

    /// @notice Platform operating balance for incident stipends (V4 §8). Anyone may top it up.
    function fundReserve(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroValue();
        reserveBalance += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit ReserveFunded(msg.sender, amount);
    }

    /// @notice Withdraws reserve that no open court has locked.
    function withdrawReserve(uint256 amount, address to) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        uint256 free = reserveBalance - reserveLocked;
        if (amount > free) revert InsufficientReserve(amount, free);
        reserveBalance -= amount;
        usdc.safeTransfer(to, amount);
        emit ReserveWithdrawn(to, amount);
    }

    // ---------------------------------------------------------------------
    // Mode 1 — Solo vs NPC
    // ---------------------------------------------------------------------

    /// @notice Files and pays for a Solo case: pool + protocol fee + AI fee
    ///         (1.20 at default terms, 1.00 with the 0G Compute Pass).
    function fileSolo(bytes32 contentHash, bool usePass) external nonReentrant returns (uint256 caseId) {
        Terms storage t = _requireEnabled(Mode.Solo);
        if (usePass && !t.passEnabled) revert PassDisabled();
        bytes32 human = _requireParty(msg.sender, t);

        caseId = _createCase(Mode.Solo, t, contentHash);
        Case storage c = _cases[caseId];
        c.creator = msg.sender;
        c.creatorHuman = human;
        c.poolHeld = CourtMath.pool(t.n, t.successBonus);
        c.protocolFeeHeld = t.protocolFee;
        c.aiFeeHeld = usePass ? 0 : t.aiFeePerAgent;
        c.target = c.poolHeld + c.protocolFeeHeld + c.aiFeeHeld;
        emit CaseCreated(caseId, Mode.Solo, msg.sender, address(0), contentHash);

        _collect(caseId, msg.sender, c.target, usePass);
        _openRecruitment(c, caseId, t);
    }

    /// @notice Files a Solo case with the jury the player chose: 3, 5 or 7 seats.
    ///         One absent bond covers the failed-trial bonus of every other juror, so
    ///         the bond is that bonus times (jurors - 1). The success bonus is 75% of
    ///         the bond, and the filer pays it for every seat, plus the flat fees.
    function fileSoloJury(bytes32 contentHash, uint8 jurors) external nonReentrant returns (uint256 caseId) {
        Terms storage base = _requireEnabled(Mode.Solo);
        (uint8 n, uint64 bond, uint64 successBonus) = _jury(base, jurors);
        bytes32 human = _requireParty(msg.sender, base);

        caseId = _createCase(Mode.Solo, base, contentHash);
        Terms storage t = _caseTerms[caseId];
        t.n = n;
        t.bond = bond;
        t.successBonus = successBonus;

        Case storage c = _cases[caseId];
        c.jurySize = jurors;
        c.creator = msg.sender;
        c.creatorHuman = human;
        c.poolHeld = CourtMath.pool(n, successBonus);
        c.protocolFeeHeld = t.protocolFee;
        c.aiFeeHeld = t.aiFeePerAgent;
        c.target = c.poolHeld + c.protocolFeeHeld + c.aiFeeHeld;
        emit CaseCreated(caseId, Mode.Solo, msg.sender, address(0), contentHash);

        _collect(caseId, msg.sender, c.target, false);
        _openRecruitment(c, caseId, t);
    }

    /// @notice What a Solo filer pays, and what each juror stakes and can earn, for a jury size.
    function soloPrice(uint8 jurors) external view returns (uint256 price, uint64 bond, uint64 successBonus) {
        Terms storage t = _terms[Mode.Solo];
        uint8 n;
        (n, bond, successBonus) = _jury(t, jurors);
        price = uint256(CourtMath.pool(n, successBonus)) + t.protocolFee + t.aiFeePerAgent;
    }

    function _jury(Terms storage t, uint8 jurors) internal view returns (uint8 n, uint64 bond, uint64 successBonus) {
        if (jurors != 3 && jurors != 5 && jurors != 7) revert InvalidTerms("jurors");
        n = (jurors - 1) / 2;
        bond = t.failedTrialBonus * (jurors - 1);
        successBonus = (bond * 3) / 4;
    }

    // ---------------------------------------------------------------------
    // Mode 2 — Versus
    // ---------------------------------------------------------------------

    /// @notice Side A opens a Versus case and escrows its half (0.70 at default
    ///         terms). Fully refundable if Side B never funds (D4, D6).
    function openVersus(address sideB, bytes32 contentHash, bool usePass)
        external
        nonReentrant
        returns (uint256 caseId)
    {
        Terms storage t = _requireEnabled(Mode.Versus);
        if (sideB == address(0)) revert ZeroAddress();
        if (sideB == msg.sender) revert SamePerson();
        if (usePass && !t.passEnabled) revert PassDisabled();
        bytes32 human = _requireParty(msg.sender, t);

        caseId = _createCase(Mode.Versus, t, contentHash);
        Case storage c = _cases[caseId];
        c.creator = msg.sender;
        c.counterparty = sideB;
        c.creatorHuman = human;
        c.status = Status.Pending;
        c.pendingDeadline = uint64(block.timestamp) + t.pendingWindow;
        emit CaseCreated(caseId, Mode.Versus, msg.sender, sideB, contentHash);

        _payVersusSide(c, caseId, t, msg.sender, true, usePass);
    }

    /// @notice Side B consents by funding its half before the consent deadline.
    function joinVersus(uint256 caseId, bool usePass) external nonReentrant {
        Case storage c = _cases[caseId];
        if (c.mode != Mode.Versus || c.status == Status.None) revert WrongMode();
        if (msg.sender != c.counterparty) revert NotCounterparty();
        if (c.status != Status.Pending) revert WrongStatus(c.status);
        if (block.timestamp >= c.pendingDeadline) revert DeadlinePassed(c.pendingDeadline);
        Terms storage t = _caseTerms[caseId];
        if (usePass && !t.passEnabled) revert PassDisabled();
        bytes32 human = _requireParty(msg.sender, t);
        if (human != bytes32(0) && human == c.creatorHuman) revert SamePerson();
        c.counterpartyHuman = human;

        _payVersusSide(c, caseId, t, msg.sender, false, usePass);
        _openRecruitment(c, caseId, t);
    }

    /// @notice Side A may withdraw the invite before Side B funds; full refund.
    function withdrawInvite(uint256 caseId) external nonReentrant {
        Case storage c = _cases[caseId];
        if (c.mode != Mode.Versus || c.status == Status.None) revert WrongMode();
        if (msg.sender != c.creator) revert NotCreator();
        if (c.status != Status.Pending) revert WrongStatus(c.status);
        _cancel(c, caseId, CancelReason.InviteWithdrawn);
    }

    // ---------------------------------------------------------------------
    // Mode 3 — Grand Jury
    // ---------------------------------------------------------------------

    /// @notice Publishes a reviewed public case and opens its crowdfund. A
    ///         sponsor deposit, if any, is pulled from `sponsor` now ("committed
    ///         before the case is published", D10); the sponsor must have
    ///         approved this contract. The sponsor has no say over content or verdict.
    function publishGrandJury(bytes32 contentHash, address sponsor, uint128 sponsorAmount)
        external
        onlyRole(CURATOR_ROLE)
        nonReentrant
        returns (uint256 caseId)
    {
        Terms storage t = _requireEnabled(Mode.GrandJury);
        if (sponsorAmount > 0 && sponsor == address(0)) revert ZeroAddress();

        bool sponsored = t.sponsorFloor > 0 && sponsorAmount >= t.sponsorFloor;
        if (t.sponsorFloor > 0 && !sponsored) {
            if (marketingUsed >= marketingCap) {
                if (marketingCap == 0) revert SponsorRequired(t.sponsorFloor);
                revert MarketingCapReached(marketingCap);
            }
            marketingUsed += 1;
        }

        caseId = _createCase(Mode.GrandJury, t, contentHash);
        Case storage c = _cases[caseId];
        c.creator = msg.sender;
        c.status = Status.Pending;
        c.pendingDeadline = uint64(block.timestamp) + t.pendingWindow;
        c.target = CourtMath.pool(t.n, t.successBonus) + t.protocolFee + t.aiFeePerAgent;
        c.sponsored = sponsored;
        emit CaseCreated(caseId, Mode.GrandJury, msg.sender, address(0), contentHash);

        if (sponsorAmount > 0) {
            c.sponsor = sponsor;
            c.sponsorDeposit = sponsorAmount;
            usdc.safeTransferFrom(sponsor, address(this), sponsorAmount);
            emit SponsorDeposited(caseId, sponsor, sponsorAmount, sponsored);
        }
    }

    /// @notice "Summon the court": contribute toward the target. Only what the
    ///         target still needs is taken; the final top-up may be below the
    ///         minimum. Contributions earn nothing that depends on the outcome (D9).
    /// @return accepted the amount actually taken
    function contribute(uint256 caseId, uint256 amount) external nonReentrant returns (uint256 accepted) {
        Case storage c = _cases[caseId];
        if (c.mode != Mode.GrandJury || c.status == Status.None) revert WrongMode();
        if (c.status != Status.Pending) revert WrongStatus(c.status);
        if (block.timestamp >= c.pendingDeadline) revert DeadlinePassed(c.pendingDeadline);
        Terms storage t = _caseTerms[caseId];

        uint256 remaining = c.target - c.raised;
        accepted = amount < remaining ? amount : remaining;
        if (accepted < t.minContribution && accepted < remaining) revert BelowMinContribution(t.minContribution);

        _collect(caseId, msg.sender, accepted, false);
        if (c.raised == c.target) {
            c.poolHeld = CourtMath.pool(t.n, t.successBonus);
            c.protocolFeeHeld = t.protocolFee;
            c.aiFeeHeld = t.aiFeePerAgent;
            _openRecruitment(c, caseId, t);
        }
    }

    // ---------------------------------------------------------------------
    // Jury
    // ---------------------------------------------------------------------

    /// @notice Accepts a randomly offered seat and posts the bond ("I SWEAR TO
    ///         SHOW UP"). Declining an offer is simply not calling this.
    /// @param signature EIP-712 SeatOffer(caseId, juror = msg.sender, expiresAt) by an ASSIGNER
    function acceptSeat(uint256 caseId, uint64 expiresAt, bytes calldata signature) external nonReentrant {
        Case storage c = _cases[caseId];
        if (c.status != Status.Recruiting) revert WrongStatus(c.status);
        if (block.timestamp >= c.recruitDeadline) revert DeadlinePassed(c.recruitDeadline);
        if (block.timestamp >= expiresAt) revert OfferExpired();
        address signer = ECDSA.recover(seatOfferDigest(caseId, msg.sender, expiresAt), signature);
        if (!hasRole(ASSIGNER_ROLE, signer)) revert InvalidSeatOffer();

        Juror storage j = _jurors[caseId][msg.sender];
        if (j.seated) revert AlreadySeated();
        if (msg.sender == c.creator || msg.sender == c.counterparty || msg.sender == c.sponsor) {
            revert PartyCannotServe();
        }
        Terms storage t = _caseTerms[caseId];
        (bytes32 human, uint8 level) = registry.humanOf(msg.sender);
        if (human == bytes32(0) || level < t.minJurorLevel) revert JurorNotVerified();
        if (human == c.creatorHuman || human == c.counterpartyHuman) revert PartyCannotServe();
        if (_humanSeated[caseId][human]) revert HumanAlreadySeated();

        j.seated = true;
        j.seat = c.seated;
        j.humanId = human;
        _humanSeated[caseId][human] = true;
        _jurorList[caseId].push(msg.sender);
        c.seated += 1;
        emit SeatAccepted(caseId, msg.sender, j.seat);

        usdc.safeTransferFrom(msg.sender, address(this), t.bond);

        if (c.seated == c.jurySize) {
            c.status = Status.Preparing;
            c.prepDeadline = uint64(block.timestamp) + t.prepWindow;
            emit JuryFilled(caseId, c.prepDeadline);
        }
    }

    /// @notice Freezes the transcript fingerprint and opens the court. Deadlines
    ///         are fixed from here on. Locks the platform-funded incident stipend
    ///         for every seat, so a protective cancel can always pay it.
    function openCourt(uint256 caseId, bytes32 transcriptHash) external onlyRole(OPERATOR_ROLE) {
        Case storage c = _cases[caseId];
        if (c.status != Status.Preparing) revert WrongStatus(c.status);
        if (block.timestamp >= c.prepDeadline) revert DeadlinePassed(c.prepDeadline);
        if (transcriptHash == bytes32(0)) revert ZeroValue();
        Terms storage t = _caseTerms[caseId];

        uint256 stipends = uint256(c.jurySize) * t.incidentStipend;
        uint256 free = reserveBalance - reserveLocked;
        if (stipends > free) revert InsufficientReserve(stipends, free);
        reserveLocked += stipends;
        c.stipendLocked = uint128(stipends);

        c.transcriptHash = transcriptHash;
        c.status = Status.Voting;
        c.commitDeadline = uint64(block.timestamp) + t.commitWindow;
        c.revealDeadline = c.commitDeadline + t.revealWindow;
        emit CourtOpened(caseId, transcriptHash, c.commitDeadline, c.revealDeadline);
    }

    /// @notice The AI could not prepare a fair case (D1 balance gate): full refunds, no slashing.
    function failPreparation(uint256 caseId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Case storage c = _cases[caseId];
        if (c.status != Status.Preparing) revert WrongStatus(c.status);
        _cancel(c, caseId, CancelReason.PreparationFailed);
    }

    /// @notice Commits a hidden ballot: `commitmentOf(caseId, juror, choice, salt)`.
    ///         May be replaced until the commit window closes (e.g. after losing
    ///         the salt). The window closes at its deadline, or as soon as every
    ///         juror has committed, which opens the reveal early.
    function commitVote(uint256 caseId, bytes32 commitment) external {
        Case storage c = _cases[caseId];
        if (c.status != Status.Voting) revert WrongStatus(c.status);
        Juror storage j = _jurors[caseId][msg.sender];
        if (!j.seated) revert NotJuror();
        if (commitment == bytes32(0)) revert ZeroValue();
        if (block.timestamp >= c.commitDeadline || c.committed == c.jurySize) revert CommitClosed();

        if (j.commitment == bytes32(0)) c.committed += 1;
        j.commitment = commitment;
        emit VoteCommitted(caseId, msg.sender);
    }

    /// @notice Opens the secret verdict scroll. The reveal deadline never moves.
    function revealVote(uint256 caseId, uint8 choice, bytes32 salt) external {
        Case storage c = _cases[caseId];
        if (c.status != Status.Voting) revert WrongStatus(c.status);
        Juror storage j = _jurors[caseId][msg.sender];
        if (!j.seated) revert NotJuror();
        if (!_revealOpen(c)) revert RevealNotOpen();
        if (j.commitment == bytes32(0)) revert NoCommitment();
        if (j.revealed) revert AlreadyRevealed();
        if (choice > 1) revert InvalidChoice();
        if (commitmentOf(caseId, msg.sender, choice, salt) != j.commitment) revert CommitmentMismatch();

        j.revealed = true;
        j.choice = choice;
        c.revealed += 1;
        if (choice == 0) c.votes0 += 1;
        else c.votes1 += 1;
        emit VoteRevealed(caseId, msg.sender, choice);
    }

    /// @notice Settles the case. Permissionless; possible once every juror has
    ///         revealed, otherwise only after the reveal deadline (V4 §6 step 9).
    function finalize(uint256 caseId) external nonReentrant {
        Case storage c = _cases[caseId];
        if (c.status != Status.Voting) revert WrongStatus(c.status);
        if (!_finalizable(c)) revert NotFinalizable();
        Terms storage t = _caseTerms[caseId];

        Settlement memory s = CourtMath.settle(
            CourtMath.Input({
                n: t.n,
                timely: c.revealed,
                votes0: c.votes0,
                votes1: c.votes1,
                bond: t.bond,
                successBonus: t.successBonus,
                failedTrialBonus: t.failedTrialBonus,
                poolHeld: c.poolHeld,
                protocolFeeHeld: c.protocolFeeHeld,
                aiFeeHeld: c.aiFeeHeld,
                sponsorDeposit: c.sponsorDeposit,
                raised: c.raised
            })
        );

        c.status = Status.Finalized;
        c.outcome = s.outcome;
        reserveLocked -= c.stipendLocked;
        c.stipendLocked = 0;

        address[] storage list = _jurorList[caseId];
        for (uint256 k; k < list.length; ++k) {
            if (_jurors[caseId][list[k]].revealed) claimable[list[k]] += s.payoutPerTimelyJuror;
        }
        claimable[treasury] += s.toTreasury;
        claimable[aiTreasury] += s.toAiTreasury;
        emit CaseFinalized(caseId, s);
    }

    // ---------------------------------------------------------------------
    // Cancellation
    // ---------------------------------------------------------------------

    /// @notice Anyone may cancel a case whose pending, recruitment or
    ///         preparation deadline passed. Nobody is slashed; everyone is refunded.
    function cancelExpired(uint256 caseId) external nonReentrant {
        Case storage c = _cases[caseId];
        CancelReason reason;
        if (c.status == Status.Pending && block.timestamp >= c.pendingDeadline) {
            reason = c.mode == Mode.Versus ? CancelReason.ConsentExpired : CancelReason.FundingExpired;
        } else if (c.status == Status.Recruiting && block.timestamp >= c.recruitDeadline) {
            reason = CancelReason.JuryNotFilled;
        } else if (c.status == Status.Preparing && block.timestamp >= c.prepDeadline) {
            reason = CancelReason.PreparationExpired;
        } else {
            revert NotExpired();
        }
        _cancel(c, caseId, reason);
    }

    /// @notice Platform fault or fairness incident (V4 §8): everyone is
    ///         refunded and jurors who already committed get the incident stipend
    ///         from the platform reserve, never from other jurors' bonds. Not
    ///         possible once the result is fixed (reveal deadline passed or all revealed).
    function protectiveCancel(uint256 caseId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Case storage c = _cases[caseId];
        Status st = c.status;
        if (st != Status.Pending && st != Status.Recruiting && st != Status.Preparing && st != Status.Voting) {
            revert WrongStatus(st);
        }
        if (st == Status.Voting && _finalizable(c)) revert WrongStatus(st);
        _cancel(c, caseId, CancelReason.ProtectiveCancel);
    }

    // ---------------------------------------------------------------------
    // Claims
    // ---------------------------------------------------------------------

    function claimRefund(uint256 caseId) external nonReentrant returns (uint256) {
        return _claimRefund(caseId, msg.sender);
    }

    /// @notice Permissionless: sends a payer's refund to the payer (keepers, batch UX).
    function claimRefundFor(uint256 caseId, address payer) external nonReentrant returns (uint256) {
        return _claimRefund(caseId, payer);
    }

    function withdraw() external nonReentrant returns (uint256 amount) {
        amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function termsOf(Mode mode) external view returns (Terms memory) {
        return _terms[mode];
    }

    function caseTerms(uint256 caseId) external view returns (Terms memory) {
        return _caseTerms[caseId];
    }

    function getCase(uint256 caseId) external view returns (Case memory) {
        return _cases[caseId];
    }

    function jurorsOf(uint256 caseId) external view returns (address[] memory) {
        return _jurorList[caseId];
    }

    function jurorOf(uint256 caseId, address juror) external view returns (Juror memory) {
        return _jurors[caseId][juror];
    }

    function isRefundable(uint256 caseId) public view returns (bool) {
        Case storage c = _cases[caseId];
        return c.status == Status.Cancelled || (c.status == Status.Finalized && c.outcome == Outcome.NoVerdict);
    }

    function phaseOf(uint256 caseId) external view returns (Phase) {
        Case storage c = _cases[caseId];
        Status st = c.status;
        if (st == Status.None) return Phase.None;
        if (st == Status.Finalized) return Phase.Finalized;
        if (st == Status.Cancelled) return Phase.Cancelled;
        if (st == Status.Pending) {
            if (block.timestamp >= c.pendingDeadline) return Phase.Expired;
            return c.mode == Mode.Versus ? Phase.AwaitingCounterparty : Phase.Crowdfunding;
        }
        if (st == Status.Recruiting) return block.timestamp >= c.recruitDeadline ? Phase.Expired : Phase.Recruiting;
        if (st == Status.Preparing) return block.timestamp >= c.prepDeadline ? Phase.Expired : Phase.Preparing;
        if (_finalizable(c)) return Phase.Finalizable;
        return _revealOpen(c) ? Phase.Reveal : Phase.Commit;
    }

    /// @notice What one payer owes at the current terms. Solo: the whole charge.
    ///         Versus: one side's half (Side A carries any odd base unit).
    ///         Grand Jury: the crowdfund target (`usePass` and `sideA` ignored).
    function quote(Mode mode, bool sideA, bool usePass) external view returns (uint256) {
        Terms storage t = _terms[mode];
        uint256 pool_ = CourtMath.pool(t.n, t.successBonus);
        if (mode == Mode.GrandJury) return pool_ + t.protocolFee + t.aiFeePerAgent;
        uint256 ai = usePass ? 0 : t.aiFeePerAgent;
        if (mode == Mode.Versus) {
            return CourtMath.sideShare(pool_, sideA) + CourtMath.sideShare(t.protocolFee, sideA) + ai;
        }
        return pool_ + t.protocolFee + ai;
    }

    /// @notice Ballot commitment. Binds chain, court, case and juror so a
    ///         commitment can't be copied to another seat or deployment.
    function commitmentOf(uint256 caseId, address juror, uint8 choice, bytes32 salt) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), caseId, juror, choice, salt));
    }

    function seatOfferDigest(uint256 caseId, address juror, uint64 expiresAt) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(SEAT_OFFER_TYPEHASH, caseId, juror, expiresAt)));
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _validateTerms(Mode mode, Terms calldata t) internal pure {
        if (t.n == 0 || t.n > CourtMath.MAX_N) revert InvalidTerms("n");
        if (t.bond == 0) revert InvalidTerms("bond");
        // One absent bond must cover the failed-trial bonus of the other 2n jurors (V4 §9).
        if (uint256(t.failedTrialBonus) * 2 * t.n > t.bond) revert InvalidTerms("failedTrialBonus");
        if (t.recruitWindow == 0 || t.prepWindow == 0 || t.commitWindow == 0 || t.revealWindow == 0) {
            revert InvalidTerms("window");
        }
        if (mode == Mode.Solo) {
            if (t.pendingWindow != 0 || t.minContribution != 0 || t.sponsorFloor != 0) revert InvalidTerms("solo");
        } else if (mode == Mode.Versus) {
            if (t.pendingWindow == 0) revert InvalidTerms("pendingWindow");
            if (t.minContribution != 0 || t.sponsorFloor != 0) revert InvalidTerms("versus");
        } else {
            if (t.pendingWindow == 0) revert InvalidTerms("pendingWindow");
            if (t.passEnabled) revert InvalidTerms("pass"); // no single payer in Mode 3 (D12)
            if (CourtMath.pool(t.n, t.successBonus) + t.protocolFee + t.aiFeePerAgent == 0) {
                revert InvalidTerms("target");
            }
        }
    }

    function _requireEnabled(Mode mode) internal view returns (Terms storage t) {
        t = _terms[mode];
        if (!t.enabled) revert ModeDisabled(mode);
    }

    /// @dev Parties must be verified humans when the terms ask for it, so they
    ///      can be excluded from their own jury on every wallet (V4 §6 step 4, §10).
    function _requireParty(address party, Terms storage t) internal view returns (bytes32 human) {
        uint8 level;
        (human, level) = registry.humanOf(party);
        if (t.minPartyLevel > 0 && (human == bytes32(0) || level < t.minPartyLevel)) revert PartyNotVerified(party);
    }

    function _createCase(Mode mode, Terms storage t, bytes32 contentHash) internal returns (uint256 caseId) {
        if (contentHash == bytes32(0)) revert ZeroValue();
        caseId = ++caseCount;
        _caseTerms[caseId] = t;
        Case storage c = _cases[caseId];
        c.mode = mode;
        c.jurySize = CourtMath.jurySize(t.n);
        c.contentHash = contentHash;
        c.createdAt = uint64(block.timestamp);
    }

    function _payVersusSide(Case storage c, uint256 caseId, Terms storage t, address payer, bool sideA, bool usePass)
        internal
    {
        uint128 poolPart = uint128(CourtMath.sideShare(CourtMath.pool(t.n, t.successBonus), sideA));
        uint128 feePart = uint128(CourtMath.sideShare(t.protocolFee, sideA));
        uint128 aiPart = usePass ? 0 : t.aiFeePerAgent;
        c.poolHeld += poolPart;
        c.protocolFeeHeld += feePart;
        c.aiFeeHeld += aiPart;
        uint128 amount = poolPart + feePart + aiPart;
        c.target += amount;
        _collect(caseId, payer, amount, usePass);
    }

    function _collect(uint256 caseId, address payer, uint256 amount, bool passUsed) internal {
        if (amount == 0) revert ZeroValue();
        Case storage c = _cases[caseId];
        c.raised += uint128(amount);
        paidBy[caseId][payer] += amount;
        emit PaymentReceived(caseId, payer, amount, passUsed);
        usdc.safeTransferFrom(payer, address(this), amount);
    }

    function _openRecruitment(Case storage c, uint256 caseId, Terms storage t) internal {
        c.status = Status.Recruiting;
        c.recruitDeadline = uint64(block.timestamp) + t.recruitWindow;
        emit RecruitmentOpened(caseId, c.recruitDeadline);
    }

    function _revealOpen(Case storage c) internal view returns (bool) {
        return (block.timestamp >= c.commitDeadline || c.committed == c.jurySize)
            && block.timestamp < c.revealDeadline;
    }

    function _finalizable(Case storage c) internal view returns (bool) {
        return block.timestamp >= c.revealDeadline || c.revealed == c.jurySize;
    }

    function _cancel(Case storage c, uint256 caseId, CancelReason reason) internal {
        bool voting = c.status == Status.Voting;
        c.status = Status.Cancelled;
        c.cancelReason = reason;

        Terms storage t = _caseTerms[caseId];
        uint256 stipendsPaid;
        address[] storage list = _jurorList[caseId];
        for (uint256 k; k < list.length; ++k) {
            address juror = list[k];
            uint256 amount = t.bond;
            if (voting && reason == CancelReason.ProtectiveCancel && _jurors[caseId][juror].commitment != bytes32(0))
            {
                amount += t.incidentStipend;
                stipendsPaid += t.incidentStipend;
                emit IncidentStipendPaid(caseId, juror, t.incidentStipend);
            }
            claimable[juror] += amount;
        }

        reserveLocked -= c.stipendLocked;
        reserveBalance -= stipendsPaid;
        c.stipendLocked = 0;

        if (c.sponsorDeposit > 0) claimable[c.sponsor] += c.sponsorDeposit;
        emit CaseCancelled(caseId, reason, stipendsPaid);
    }

    function _claimRefund(uint256 caseId, address payer) internal returns (uint256 amount) {
        if (!isRefundable(caseId)) revert NotRefundable();
        amount = paidBy[caseId][payer];
        if (amount == 0) revert NothingToClaim();
        paidBy[caseId][payer] = 0;
        usdc.safeTransfer(payer, amount);
        emit RefundClaimed(caseId, payer, amount);
    }
}
