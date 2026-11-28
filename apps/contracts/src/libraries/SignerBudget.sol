// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { SignerGrant } from "../types/EscrowTypes.sol";
import { EscrowLimits } from "./EscrowLimits.sol";

library SignerBudget {
    function refill(SignerGrant memory grant, uint64 now_) internal pure {
        uint64 effectiveAt = grant.pendingEffectiveAt;
        if (effectiveAt != 0 && effectiveAt <= now_) {
            _accrue(grant, effectiveAt);
            grant.hourlyCap = grant.pendingHourlyCap;
            grant.pendingHourlyCap = 0;
            grant.pendingEffectiveAt = 0;
        }
        _accrue(grant, now_);
    }

    function capacity(uint96 hourlyCap) internal pure returns (uint128) {
        return uint128(hourlyCap) * EscrowLimits.SIGNER_BURST_HOURS;
    }

    function _accrue(SignerGrant memory grant, uint64 until) private pure {
        uint256 accrued = grant.remainder + uint256(until - grant.updatedAt) * grant.hourlyCap;
        uint256 available = grant.available + accrued / EscrowLimits.SECONDS_PER_HOUR;
        uint128 full = capacity(grant.hourlyCap);
        grant.updatedAt = until;
        if (available >= full) {
            grant.available = full;
            grant.remainder = 0;
            return;
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        grant.available = uint128(available);
        // forge-lint: disable-next-line(unsafe-typecast)
        grant.remainder = uint16(accrued % EscrowLimits.SECONDS_PER_HOUR);
    }
}
