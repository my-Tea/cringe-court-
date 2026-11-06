// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {CringeCourt} from "../src/CringeCourt.sol";
import {HumanRegistry} from "../src/HumanRegistry.sol";
import {ICringeCourtTypes} from "../src/interfaces/ICringeCourt.sol";

/// @notice Broadcasts HumanRegistry and CringeCourt to Arc testnet.
///         Circle USDC is already on the network. CourtMath is compiled into the court.
///         The deployer key is the admin, the attester, and the three court roles.
contract DeployArc is Script, ICringeCourtTypes {
    address internal constant USDC = 0x3600000000000000000000000000000000000000;
    uint256 internal constant ARC_CHAIN_ID = 5042002;

    function run() external {
        require(block.chainid == ARC_CHAIN_ID, "refusing: not Arc testnet");

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address admin = vm.addr(pk);

        vm.startBroadcast(pk);

        HumanRegistry registry = new HumanRegistry(admin, admin);
        CringeCourt court = new CringeCourt(IERC20(USDC), registry, admin, admin, admin);

        court.grantRole(court.OPERATOR_ROLE(), admin);
        court.grantRole(court.ASSIGNER_ROLE(), admin);
        court.grantRole(court.CURATOR_ROLE(), admin);

        court.setTerms(Mode.Solo, _solo());
        court.setTerms(Mode.Versus, _versus());
        court.setTerms(Mode.GrandJury, _grandJury());
        court.setMarketingCap(40);

        vm.stopBroadcast();
        // Reserve funding is a separate transaction. Forge's fork cannot execute
        // Circle's blocklist precompile, so fundReserve is sent with cast after this script.
        uint256 funded = 0;

        console2.log("registry", address(registry));
        console2.log("court", address(court));
        console2.log("usdc", USDC);
        console2.log("admin", admin);
        console2.log("reserve", funded);

        vm.writeFile(
            "deployments/arc-testnet.json",
            string.concat(
                "{\n",
                '  "chainId": 5042002,\n',
                '  "timing": "production",\n',
                '  "pricing": "hackathon",\n',
                '  "usdc": "',
                vm.toString(USDC),
                '",\n',
                '  "registry": "',
                vm.toString(address(registry)),
                '",\n',
                '  "court": "',
                vm.toString(address(court)),
                '",\n',
                '  "admin": "',
                vm.toString(admin),
                '",\n',
                '  "multicall3": "0xcA11bde05977b3631167028862bE2a173976CA11",\n',
                '  "reserve": ',
                vm.toString(funded),
                "\n}\n"
            )
        );
    }

    function _windows() internal pure returns (uint32 recruit, uint32 prep, uint32 commitW, uint32 revealW) {
        return (1800, 3600, 1200, 600);
    }

    function _solo() internal pure returns (Terms memory t) {
        (uint32 recruit, uint32 prep, uint32 commitW, uint32 revealW) = _windows();
        t = Terms({
            n: 1,
            minJurorLevel: 3,
            minPartyLevel: 1,
            enabled: true,
            passEnabled: false,
            demoTiming: false,
            bond: 400000,
            successBonus: 300000,
            failedTrialBonus: 200000,
            protocolFee: 100000,
            aiFeePerAgent: 200000,
            incidentStipend: 200000,
            minContribution: 0,
            sponsorFloor: 0,
            pendingWindow: 0,
            recruitWindow: recruit,
            prepWindow: prep,
            commitWindow: commitW,
            revealWindow: revealW
        });
    }

    function _versus() internal pure returns (Terms memory t) {
        t = _solo();
        t.pendingWindow = 86400;
    }

    function _grandJury() internal pure returns (Terms memory t) {
        t = _solo();
        t.n = 3;
        t.minPartyLevel = 0;
        t.bond = 1_200000;
        t.successBonus = 900000;
        t.protocolFee = 500000;
        t.aiFeePerAgent = 500000;
        t.minContribution = 100000;
        t.sponsorFloor = 2_000000;
        t.pendingWindow = 172800;
    }
}
