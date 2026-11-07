// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { StdAssertions } from "forge-std/StdAssertions.sol";
import { EscrowHandler } from "./handlers/EscrowHandler.sol";

/// @notice The escrow invariants over what an EscrowHandler moved, shared by the Foundry invariant test and the Medusa
/// property harness. Each reverts through a forge-std assertion when it does not hold; Medusa supports the same
/// assertion cheatcodes.
abstract contract EscrowInvariants is StdAssertions {
    EscrowHandler internal handler;

    /// @dev 1. Everything deposited is either still held, paid out by a claim, or withdrawn.
    function _assertFundsAreConserved() internal view {
        uint256 escrowBalance = handler.usdc().balanceOf(address(handler.escrow()));
        assertEq(escrowBalance, handler.deposited() - handler.paidOut() - handler.withdrawn());
        uint256 held;
        for (uint256 i; i < handler.customerCount(); ++i) {
            held += handler.escrow().balanceOf(handler.customers(i));
        }
        assertEq(held, escrowBalance);
    }

    /// @dev 2. A channel's cumulative payout never decreases.
    function _assertChannelsNeverDecrease() internal view {
        assertEq(handler.decreasedChannels(), 0);
    }

    /// @dev 3. No claim ever paid a fee above the cap on its host increase.
    function _assertFeeNeverAboveCap() internal view {
        assertEq(handler.feesOverAllowance(), 0);
    }

    /// @dev 4 and 5. Money only reaches customers, hosts or the platform; the escrow is never drained elsewhere.
    function _assertMoneyOnlyReachesParties() internal view {
        uint256 hostsAndPlatform = handler.usdc().balanceOf(handler.platform());
        for (uint256 i; i < handler.hostCount(); ++i) {
            hostsAndPlatform += handler.usdc().balanceOf(handler.hosts(i));
        }
        assertEq(hostsAndPlatform, handler.paidOut());
    }
}
