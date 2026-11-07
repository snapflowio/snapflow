// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { Test } from "forge-std/Test.sol";
import { EscrowInvariants } from "./EscrowInvariants.sol";
import { EscrowHandler } from "./handlers/EscrowHandler.sol";

/// @notice Escrow invariants, checked after every random call sequence.
contract Escrow_Invariant_Test is Test, EscrowInvariants {
    function setUp() external {
        handler = new EscrowHandler();
        targetContract(address(handler));
    }

    function invariant_FundsAreConserved() external view {
        _assertFundsAreConserved();
    }

    function invariant_ChannelsNeverDecrease() external view {
        _assertChannelsNeverDecrease();
    }

    function invariant_FeeNeverAboveCap() external view {
        _assertFeeNeverAboveCap();
    }

    function invariant_MoneyOnlyReachesParties() external view {
        _assertMoneyOnlyReachesParties();
    }
}
