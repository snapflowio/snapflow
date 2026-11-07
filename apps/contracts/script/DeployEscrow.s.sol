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
import { EscrowDeployer } from "./base/EscrowDeployer.sol";

/// @notice Deploys the escrow for an existing USDC token at the broadcaster's deterministic address (see
/// `predict`). The broadcaster deploys and grants the operating roles, then starts the delayed hand-over of the admin
/// role to `ESCROW_ADMIN`, which must accept it after the delay.
///
/// Environment: ESCROW_USDC, ESCROW_ADMIN, ESCROW_FEE_RECIPIENT, ESCROW_COMPLIANCE, ESCROW_PAUSER,
/// ESCROW_FEE_CAP_BPS, ESCROW_DISPUTE_WINDOW_SECONDS. Run it through `moon run contracts:deploy-base-sepolia` or
/// `contracts:deploy-base`, which verify the source and record the result in deployments/<chainId>.json.
contract DeployEscrow is EscrowDeployer {
    error PendingAdminMismatch(address expected, address actual);

    function run() external returns (SnapflowEscrow escrow) {
        address finalAdmin = vm.envAddress("ESCROW_ADMIN");
        EscrowConfig memory config = EscrowConfig({
            token: IERC20(vm.envAddress("ESCROW_USDC")),
            feeRecipient: vm.envAddress("ESCROW_FEE_RECIPIENT"),
            compliance: vm.envAddress("ESCROW_COMPLIANCE"),
            pauser: vm.envAddress("ESCROW_PAUSER"),
            feeCapBps: uint16(vm.envUint("ESCROW_FEE_CAP_BPS")),
            disputeWindow: uint64(vm.envUint("ESCROW_DISPUTE_WINDOW_SECONDS"))
        });

        vm.startBroadcast();
        escrow = _deployEscrow(config);
        if (finalAdmin != msg.sender) escrow.beginDefaultAdminTransfer(finalAdmin);
        vm.stopBroadcast();

        (address pendingAdmin,) = escrow.pendingDefaultAdmin();
        address expectedPending = finalAdmin == msg.sender ? address(0) : finalAdmin;
        if (pendingAdmin != expectedPending) revert PendingAdminMismatch(expectedPending, pendingAdmin);
        console.log("SnapflowEscrow", address(escrow));
    }

    /// @notice Prints the escrow address the sender (`--sender`) gets on every chain, before deploying anything.
    function predict() external view returns (address escrow) {
        escrow = predictEscrow(msg.sender);
        console.log("SnapflowEscrow", escrow);
    }
}
