// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.8.30;

import { EscrowInvariants } from "./EscrowInvariants.sol";
import { EscrowHandler } from "./handlers/EscrowHandler.sol";

/// @notice Medusa harness (medusa.json): Medusa calls the handler's actions on this contract and checks the shared
/// invariants as `property_` functions after every call. Forge does not run it, as it has no test or invariant
/// functions.
contract EscrowProperties is EscrowHandler, EscrowInvariants {
    constructor() {
        handler = this;
    }

    function property_FundsAreConserved() external view returns (bool) {
        _assertFundsAreConserved();
        return true;
    }

    function property_ChannelsNeverDecrease() external view returns (bool) {
        _assertChannelsNeverDecrease();
        return true;
    }

    function property_FeeNeverAboveCap() external view returns (bool) {
        _assertFeeNeverAboveCap();
        return true;
    }

    function property_MoneyOnlyReachesParties() external view returns (bool) {
        _assertMoneyOnlyReachesParties();
        return true;
    }
}
