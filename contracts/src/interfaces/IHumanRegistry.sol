// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/// @notice Source of verified-human eligibility for CringeCourt.
/// @dev `humanId` is an app-scoped pseudonym (a keyed hash of the World ID
///      nullifier, see packages/world-id), never the raw nullifier. The same
///      person gets the same humanId on every wallet, which is what lets the
///      court exclude a case's own parties from its jury.
interface IHumanRegistry {
    /// @return humanId zero if `wallet` has no live attestation
    /// @return level   0 none, 1 device, 2 document, 3 orb (proof of human)
    function humanOf(address wallet) external view returns (bytes32 humanId, uint8 level);
}
