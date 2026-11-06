// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {ICringeCourtTypes} from "./interfaces/ICringeCourt.sol";

/// @title CourtMath
/// @notice Pure settlement rules (V4 §7 and §9, generalised to 2N + 1 jurors by
///         DECISIONS D7/D8). Kept separate so the rules can be read, tested and
///         mirrored in packages/chain-client without the escrow around them.
library CourtMath {
    uint8 internal constant MAX_N = 10;

    function jurySize(uint8 n) internal pure returns (uint8) {
        return 2 * n + 1;
    }

    function pool(uint8 n, uint64 successBonus) internal pure returns (uint128) {
        return uint128(jurySize(n)) * successBonus;
    }

    /// @notice Splits `amount` between Versus sides; Side A carries the odd unit.
    function sideShare(uint256 amount, bool sideA) internal pure returns (uint256) {
        uint256 half = amount / 2;
        return sideA ? amount - half : half;
    }

    /// @notice A verdict needs n + 1 matching revealed votes of the 2n + 1 appointed.
    function outcomeOf(uint8 n, uint8 votes0, uint8 votes1) internal pure returns (ICringeCourtTypes.Outcome) {
        uint8 threshold = n + 1;
        if (votes0 >= threshold) return ICringeCourtTypes.Outcome.Choice0;
        if (votes1 >= threshold) return ICringeCourtTypes.Outcome.Choice1;
        return ICringeCourtTypes.Outcome.NoVerdict;
    }

    struct Input {
        uint8 n;
        uint8 timely; // jurors who committed and revealed in time
        uint8 votes0;
        uint8 votes1;
        uint64 bond;
        uint64 successBonus;
        uint64 failedTrialBonus;
        uint128 poolHeld;
        uint128 protocolFeeHeld;
        uint128 aiFeeHeld;
        uint128 sponsorDeposit;
        uint128 raised;
    }

    /// @notice After the final deadline (or once every juror revealed):
    ///  - verdict: timely jurors get bond + success bonus; absent bonds and the
    ///    unearned part of the pool go to the protocol with the fees.
    ///  - no verdict: timely jurors get bond + failed-trial bonus, paid from
    ///    absent bonds; the rest of the forfeits go to the protocol; payers get
    ///    everything they paid back, fees included.
    ///  - the sponsor fee is earned once the trial ran, verdict or not (D9).
    function settle(Input memory i) internal pure returns (ICringeCourtTypes.Settlement memory s) {
        uint8 size = jurySize(i.n);
        s.timely = i.timely;
        s.absent = size - i.timely;
        s.outcome = outcomeOf(i.n, i.votes0, i.votes1);
        s.forfeitedBonds = uint128(s.absent) * i.bond;
        s.sponsorFee = i.sponsorDeposit;

        if (s.outcome == ICringeCourtTypes.Outcome.NoVerdict) {
            s.bonusPerTimelyJuror = i.failedTrialBonus;
            // Covered by the terms check bond >= 2n * failedTrialBonus: a NO VERDICT
            // needs at least one absent juror, whose bond pays the other 2n.
            s.toTreasury = s.forfeitedBonds - uint128(i.timely) * i.failedTrialBonus + s.sponsorFee;
            s.refundableToPayers = i.raised;
        } else {
            s.bonusPerTimelyJuror = i.successBonus;
            s.unearnedBonus = i.poolHeld - uint128(i.timely) * i.successBonus;
            s.protocolFees = i.protocolFeeHeld;
            s.aiFees = i.aiFeeHeld;
            s.toTreasury = s.forfeitedBonds + s.unearnedBonus + s.protocolFees + s.sponsorFee;
            s.toAiTreasury = s.aiFees;
        }
        s.payoutPerTimelyJuror = uint128(i.bond) + s.bonusPerTimelyJuror;
    }
}
