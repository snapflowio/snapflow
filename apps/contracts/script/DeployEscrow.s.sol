// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { console } from "forge-std/console.sol";
import { SnapflowEscrow } from "../src/SnapflowEscrow.sol";
import { EscrowRoles } from "../src/types/EscrowTypes.sol";
import { EscrowDeployer } from "./base/EscrowDeployer.sol";
import { ISafe } from "./base/ISafe.sol";

contract DeployEscrow is EscrowDeployer {
    string private constant ADDRESS_SEPARATOR = ",";

    error SafeMissing(address safe);
    error SafeThresholdMismatch(uint256 expected, uint256 actual);
    error SafeOwnerCountMismatch(uint256 expected, uint256 actual);
    error SafeOwnerMissing(address owner);
    error SafeOwnerUnexpected(address owner);
    error GuardianIsSafe(address guardian);
    error GuardianIsFeeReceiver(address guardian);
    error FeeReceiverIsSafe(address feeReceiver);
    error TokenMissing(address token);

    function run() external returns (SnapflowEscrow escrow) {
        address safe = vm.envAddress("ESCROW_SAFE");
        address feeReceiver = vm.envAddress("ESCROW_FEE_RECEIVER");
        address guardian = vm.envAddress("ESCROW_GUARDIAN");
        IERC20 token = IERC20(vm.envAddress("ESCROW_USDC"));
        _requireSafe(safe, vm.envAddress("ESCROW_SAFE_OWNERS", ADDRESS_SEPARATOR), vm.envUint("ESCROW_SAFE_THRESHOLD"));
        _requireSafe(
            feeReceiver,
            vm.envAddress("ESCROW_FEE_RECEIVER_OWNERS", ADDRESS_SEPARATOR),
            vm.envUint("ESCROW_FEE_RECEIVER_THRESHOLD")
        );
        if (feeReceiver == safe) revert FeeReceiverIsSafe(feeReceiver);
        if (guardian == safe) revert GuardianIsSafe(guardian);
        if (guardian == feeReceiver) revert GuardianIsFeeReceiver(guardian);
        if (address(token).code.length == 0) revert TokenMissing(address(token));

        vm.startBroadcast();
        escrow = _deployEscrow(
            EscrowConfig({
                token: token,
                roles: EscrowRoles({
                    admin: safe, pauser: safe, guardian: guardian, claimsFreezer: safe, compliance: safe
                }),
                windows: _envWindows(),
                depositCaps: _envDepositCaps()
            }),
            feeReceiver
        );
        vm.stopBroadcast();

        console.log("SnapflowEscrow", address(escrow));
        console.log("Fee receiver", feeReceiver);
    }

    function predict() external view returns (address escrow) {
        escrow = predictEscrow(msg.sender);
        console.log("SnapflowEscrow", escrow);
    }

    function _requireSafe(address safe, address[] memory expectedOwners, uint256 expectedThreshold) private view {
        if (safe.code.length == 0) revert SafeMissing(safe);
        uint256 threshold = ISafe(safe).getThreshold();
        if (threshold != expectedThreshold) revert SafeThresholdMismatch(expectedThreshold, threshold);
        address[] memory owners = ISafe(safe).getOwners();
        if (owners.length != expectedOwners.length) {
            revert SafeOwnerCountMismatch(expectedOwners.length, owners.length);
        }
        for (uint256 i; i < expectedOwners.length; ++i) {
            if (!_contains(owners, expectedOwners[i])) revert SafeOwnerMissing(expectedOwners[i]);
            if (!_contains(expectedOwners, owners[i])) revert SafeOwnerUnexpected(owners[i]);
        }
    }

    function _contains(address[] memory list, address item) private pure returns (bool) {
        for (uint256 i; i < list.length; ++i) {
            if (list[i] == item) return true;
        }
        return false;
    }
}
