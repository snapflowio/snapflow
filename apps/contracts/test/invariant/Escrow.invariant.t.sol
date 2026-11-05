// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { IERC20 } from "@openzeppelin-contracts/token/ERC20/IERC20.sol";
import { Test } from "forge-std/Test.sol";
import { SnapflowEscrow } from "../../src/SnapflowEscrow.sol";
import { MockUSDC } from "../mocks/MockUSDC.sol";
import { Constants } from "../utils/Constants.sol";
import { EscrowHandler } from "./handlers/EscrowHandler.sol";

/// @notice The five invariants from the design doc, checked after every random call sequence.
contract Escrow_Invariant_Test is Test, Constants {
    MockUSDC private usdc;
    SnapflowEscrow private escrow;
    EscrowHandler private handler;
    address private platform;

    function setUp() external {
        platform = makeAddr("platform");
        usdc = new MockUSDC();
        escrow = new SnapflowEscrow(IERC20(address(usdc)), makeAddr("admin"), platform, FEE_CAP_BPS, DISPUTE_WINDOW);
        handler = new EscrowHandler(escrow, usdc);
        targetContract(address(handler));
    }

    /// @dev 1. Everything deposited is either still held, paid out by a claim, or withdrawn.
    function invariant_FundsAreConserved() external view {
        assertEq(usdc.balanceOf(address(escrow)), handler.deposited() - handler.paidOut() - handler.withdrawn());
        uint256 held;
        for (uint256 i; i < handler.customerCount(); ++i) {
            held += escrow.balanceOf(handler.customers(i));
        }
        assertEq(held, usdc.balanceOf(address(escrow)));
    }

    /// @dev 2. A channel's cumulative payout never decreases.
    function invariant_ChannelsNeverDecrease() external {
        handler.checkChannelsNeverDecrease();
        assertEq(handler.decreasedChannels(), 0);
    }

    /// @dev 3. No claim ever paid a fee above the cap on its host increase.
    function invariant_FeeNeverAboveCap() external view {
        assertEq(handler.feesOverAllowance(), 0);
    }

    /// @dev 4 and 5. Money only reaches customers, hosts or the platform; the escrow is never drained elsewhere.
    function invariant_MoneyOnlyReachesParties() external view {
        uint256 hostsAndPlatform = usdc.balanceOf(platform);
        for (uint256 i; i < handler.hostCount(); ++i) {
            hostsAndPlatform += usdc.balanceOf(handler.hosts(i));
        }
        assertEq(hostsAndPlatform, handler.paidOut());
    }
}
