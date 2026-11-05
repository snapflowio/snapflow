// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { Script } from "forge-std/Script.sol";
import { SnapflowEscrow } from "../src/SnapflowEscrow.sol";

/// @notice Deploys the escrow for an existing USDC token. The broadcaster deploys and grants the operating roles, then
/// starts the delayed hand-over of the admin role to `ESCROW_ADMIN`, which must accept it after the delay.
///
/// Environment: ESCROW_USDC, ESCROW_ADMIN, ESCROW_FEE_RECIPIENT, ESCROW_COMPLIANCE, ESCROW_PAUSER,
/// ESCROW_FEE_CAP_BPS, ESCROW_DISPUTE_WINDOW_SECONDS.
contract DeployEscrow is Script {
    function run() external returns (SnapflowEscrow escrow) {
        address finalAdmin = vm.envAddress("ESCROW_ADMIN");
        vm.startBroadcast();
        escrow = deploy(
            IERC20(vm.envAddress("ESCROW_USDC")),
            vm.envAddress("ESCROW_FEE_RECIPIENT"),
            vm.envAddress("ESCROW_COMPLIANCE"),
            vm.envAddress("ESCROW_PAUSER"),
            uint16(vm.envUint("ESCROW_FEE_CAP_BPS")),
            uint64(vm.envUint("ESCROW_DISPUTE_WINDOW_SECONDS"))
        );
        if (finalAdmin != msg.sender) escrow.beginDefaultAdminTransfer(finalAdmin);
        vm.stopBroadcast();
    }

    function deploy(
        IERC20 usdc,
        address feeRecipient,
        address compliance,
        address pauser,
        uint16 feeCapBps,
        uint64 disputeWindow
    )
        public
        returns (SnapflowEscrow escrow)
    {
        escrow = new SnapflowEscrow(usdc, msg.sender, feeRecipient, feeCapBps, disputeWindow);
        escrow.grantRole(escrow.COMPLIANCE_ROLE(), compliance);
        escrow.grantRole(escrow.PAUSER_ROLE(), pauser);
    }
}
