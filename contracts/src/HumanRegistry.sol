// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IHumanRegistry} from "./interfaces/IHumanRegistry.sol";

/// @title HumanRegistry
/// @notice Attestations written by the backend after it verifies a World ID
///         proof server-side (V4 §10: never trust a frontend success message).
///         One live wallet per human: re-attesting a humanId to a new wallet
///         revokes the old wallet, so one person cannot hold two identities.
contract HumanRegistry is IHumanRegistry, AccessControl {
    bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");
    uint8 public constant MAX_LEVEL = 3;

    struct Attestation {
        bytes32 humanId;
        uint8 level;
        uint64 expiresAt;
    }

    mapping(address wallet => Attestation) private _attestations;
    mapping(bytes32 humanId => address wallet) public walletOfHuman;

    event Attested(address indexed wallet, bytes32 indexed humanId, uint8 level, uint64 expiresAt);
    event Revoked(address indexed wallet, bytes32 indexed humanId);

    error ZeroWallet();
    error ZeroHumanId();
    error InvalidLevel(uint8 level);
    error AlreadyExpired(uint64 expiresAt);
    error WalletBoundToOtherHuman(address wallet, bytes32 humanId);
    error NotAttested(address wallet);

    constructor(address admin, address attester) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        if (attester != address(0)) _grantRole(ATTESTER_ROLE, attester);
    }

    function attest(address wallet, bytes32 humanId, uint8 level, uint64 expiresAt)
        external
        onlyRole(ATTESTER_ROLE)
    {
        if (wallet == address(0)) revert ZeroWallet();
        if (humanId == bytes32(0)) revert ZeroHumanId();
        if (level == 0 || level > MAX_LEVEL) revert InvalidLevel(level);
        if (expiresAt <= block.timestamp) revert AlreadyExpired(expiresAt);

        bytes32 current = _attestations[wallet].humanId;
        if (current != bytes32(0) && current != humanId) revert WalletBoundToOtherHuman(wallet, current);

        address previous = walletOfHuman[humanId];
        if (previous != address(0) && previous != wallet) {
            delete _attestations[previous];
            emit Revoked(previous, humanId);
        }

        _attestations[wallet] = Attestation(humanId, level, expiresAt);
        walletOfHuman[humanId] = wallet;
        emit Attested(wallet, humanId, level, expiresAt);
    }

    function revoke(address wallet) external onlyRole(ATTESTER_ROLE) {
        bytes32 humanId = _attestations[wallet].humanId;
        if (humanId == bytes32(0)) revert NotAttested(wallet);
        delete _attestations[wallet];
        delete walletOfHuman[humanId];
        emit Revoked(wallet, humanId);
    }

    function humanOf(address wallet) external view returns (bytes32 humanId, uint8 level) {
        Attestation memory a = _attestations[wallet];
        if (a.humanId == bytes32(0) || a.expiresAt <= block.timestamp) return (bytes32(0), 0);
        return (a.humanId, a.level);
    }

    function attestationOf(address wallet) external view returns (Attestation memory) {
        return _attestations[wallet];
    }
}
