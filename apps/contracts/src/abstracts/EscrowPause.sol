// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Math } from "@openzeppelin-contracts/utils/math/Math.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { ClaimsFreeze } from "../types/EscrowTypes.sol";
import { EscrowBase } from "./EscrowBase.sol";

abstract contract EscrowPause is EscrowBase {
    ClaimsFreeze private _freeze = ClaimsFreeze({ since: 0, until: 0, accumulated: 0, armed: true });

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function freezeClaims(uint64 duration) external onlyRole(CLAIMS_FREEZE_ROLE) {
        if (duration == 0 || duration > EscrowLimits.MAX_CLAIMS_FREEZE) {
            revert ClaimsFreezeTooLong(duration, EscrowLimits.MAX_CLAIMS_FREEZE);
        }
        ClaimsFreeze memory freeze = _freeze;
        if (!freeze.armed) revert ClaimsFreezeUnavailable();
        uint64 now64 = _now64();
        uint64 until = now64 + duration;
        _freeze = ClaimsFreeze({
            since: now64, until: until, accumulated: freeze.accumulated + _elapsedFrozen(freeze), armed: false
        });
        emit ClaimsFrozen(msg.sender, until);
    }

    function rearmClaimsFreeze() external onlyRole(DEFAULT_ADMIN_ROLE) {
        ClaimsFreeze storage freeze = _freeze;
        if (freeze.armed) revert ClaimsFreezeArmed();
        uint64 rearmAt = freeze.since + EscrowLimits.CLAIMS_FREEZE_COOLDOWN;
        if (_now64() < rearmAt) revert ClaimsFreezeCoolingDown(rearmAt);
        freeze.armed = true;
        emit ClaimsFreezeRearmed();
    }

    function claimsFreeze() external view returns (ClaimsFreeze memory) {
        return _freeze;
    }

    function unfrozenTime() public view returns (uint64) {
        return _now64() - _frozenSeconds();
    }

    function _frozenSeconds() internal view returns (uint64) {
        ClaimsFreeze memory freeze = _freeze;
        return freeze.accumulated + _elapsedFrozen(freeze);
    }

    function _requireClaimsNotFrozen() internal view {
        ClaimsFreeze memory freeze = _freeze;
        if (_isFrozen(freeze)) revert ClaimsAreFrozen(freeze.until);
    }

    function _isFrozen(ClaimsFreeze memory freeze) private view returns (bool) {
        return freeze.since != 0 && block.timestamp < freeze.until;
    }

    function _elapsedFrozen(ClaimsFreeze memory freeze) private view returns (uint64) {
        if (freeze.since == 0) return 0;
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint64(Math.min(block.timestamp, freeze.until)) - freeze.since;
    }
}
