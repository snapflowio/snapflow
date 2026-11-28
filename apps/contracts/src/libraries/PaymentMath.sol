// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { EscrowLimits } from "./EscrowLimits.sol";

library PaymentMath {
    function fee(uint256 paid, uint16 feeBps) internal pure returns (uint256) {
        return paid * feeBps / EscrowLimits.BPS_DENOMINATOR;
    }
}
