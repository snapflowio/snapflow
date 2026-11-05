// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.38;

import { Math } from "@openzeppelin-contracts/utils/math/Math.sol";
import { ISnapflowEscrow } from "../interfaces/ISnapflowEscrow.sol";
import { EscrowLimits } from "../libraries/EscrowLimits.sol";
import { FeeCapChange } from "../types/EscrowTypes.sol";

/// @notice The platform fee cap and where fees go. A lower cap applies at once; a higher one only after a public
/// timelock, and never above `EscrowLimits.MAX_FEE_BPS`.
abstract contract EscrowFeePolicy is ISnapflowEscrow {
    uint16 private _feeCapBps;
    FeeCapChange private _pendingFeeCap;
    address private _feeRecipient;

    constructor(uint16 initialFeeCapBps, address initialFeeRecipient) {
        _requireValidFeeCap(initialFeeCapBps);
        if (initialFeeRecipient == address(0)) revert ZeroAddress();
        _feeCapBps = initialFeeCapBps;
        _feeRecipient = initialFeeRecipient;
        emit FeeCapUpdated(0, initialFeeCapBps);
        emit FeeRecipientUpdated(address(0), initialFeeRecipient);
    }

    function _scheduleFeeCap(uint16 bps) internal {
        _requireValidFeeCap(bps);
        if (bps <= _feeCapBps) {
            delete _pendingFeeCap;
            _updateFeeCap(bps);
            return;
        }
        // block.timestamp fits uint64 for billions of years.
        // forge-lint: disable-next-line(unsafe-typecast)
        uint64 effectiveAt = uint64(block.timestamp) + EscrowLimits.FEE_CAP_TIMELOCK;
        _pendingFeeCap = FeeCapChange({ bps: bps, effectiveAt: effectiveAt });
        emit FeeCapScheduled(bps, effectiveAt);
    }

    function _cancelFeeCapSchedule() internal {
        if (_pendingFeeCap.effectiveAt == 0) revert NoFeeCapScheduled();
        delete _pendingFeeCap;
        emit FeeCapScheduleCancelled();
    }

    function _applyFeeCap() internal {
        FeeCapChange memory pending = _pendingFeeCap;
        if (pending.effectiveAt == 0) revert NoFeeCapScheduled();
        if (block.timestamp < pending.effectiveAt) revert FeeCapNotReady(pending.effectiveAt);
        delete _pendingFeeCap;
        _updateFeeCap(pending.bps);
    }

    function _setFeeRecipient(address recipient) internal {
        if (recipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(_feeRecipient, recipient);
        _feeRecipient = recipient;
    }

    /// @dev Largest fee allowed on `hostDelta`. Rounds up so cumulative vouchers rounded down off-chain always fit.
    function _allowedFee(uint256 hostDelta) internal view returns (uint256) {
        return Math.mulDiv(hostDelta, _feeCapBps, EscrowLimits.BPS_DENOMINATOR, Math.Rounding.Ceil);
    }

    function _updateFeeCap(uint16 bps) private {
        uint16 previousBps = _feeCapBps;
        _feeCapBps = bps;
        emit FeeCapUpdated(previousBps, bps);
    }

    function _requireValidFeeCap(uint16 bps) private pure {
        if (bps > EscrowLimits.MAX_FEE_BPS) revert FeeCapTooHigh(bps, EscrowLimits.MAX_FEE_BPS);
    }

    function feeCapBps() external view returns (uint16) {
        return _feeCapBps;
    }

    function pendingFeeCap() external view returns (FeeCapChange memory) {
        return _pendingFeeCap;
    }

    function feeRecipient() public view returns (address) {
        return _feeRecipient;
    }
}
