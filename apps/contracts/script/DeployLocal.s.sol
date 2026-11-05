// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { Script } from "forge-std/Script.sol";
import { console } from "forge-std/console.sol";
import { SnapflowEscrow } from "../src/SnapflowEscrow.sol";
import { MockUSDC } from "../test/mocks/MockUSDC.sol";

/// @notice Development deployment on a local anvil chain: a mock USDC, the escrow with the broadcaster holding every
/// role, and test USDC minted to each address in LOCAL_FUNDED_ACCOUNTS (comma separated).
///
/// Environment: ESCROW_FEE_RECIPIENT, ESCROW_FEE_CAP_BPS, ESCROW_DISPUTE_WINDOW_SECONDS, LOCAL_FUNDED_ACCOUNTS,
/// LOCAL_FUNDING_AMOUNT (base units).
contract DeployLocal is Script {
    string private constant ACCOUNT_SEPARATOR = ",";

    function run() external returns (MockUSDC usdc, SnapflowEscrow escrow) {
        address[] memory funded = vm.envAddress("LOCAL_FUNDED_ACCOUNTS", ACCOUNT_SEPARATOR);
        uint256 amount = vm.envUint("LOCAL_FUNDING_AMOUNT");

        vm.startBroadcast();
        usdc = new MockUSDC();
        escrow = new SnapflowEscrow(
            IERC20(address(usdc)),
            msg.sender,
            vm.envAddress("ESCROW_FEE_RECIPIENT"),
            uint16(vm.envUint("ESCROW_FEE_CAP_BPS")),
            uint64(vm.envUint("ESCROW_DISPUTE_WINDOW_SECONDS"))
        );
        escrow.grantRole(escrow.COMPLIANCE_ROLE(), msg.sender);
        escrow.grantRole(escrow.PAUSER_ROLE(), msg.sender);
        for (uint256 i; i < funded.length; ++i) {
            usdc.mint(funded[i], amount);
        }
        vm.stopBroadcast();

        console.log("USDC", address(usdc));
        console.log("SnapflowEscrow", address(escrow));
    }
}
